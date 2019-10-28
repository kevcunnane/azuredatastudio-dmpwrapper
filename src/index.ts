//
// Copyright (c) Kevin Cunnane. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//

'use strict';

import * as azdata from 'azdata';
import { Deferred } from './promise';

let counter = 0;
let connectionTracker = new Map<string, Deferred<void>>();
let connectionProviders = new Set<string>();

export interface IDisposable {
    dispose(): void;
}

function onConnectionCompleteHandler(summary: azdata.ConnectionInfoSummary): void {
    let trackedPromise = connectionTracker.get(summary.ownerUri);
    if (trackedPromise) {
        if (summary.connectionId) {
            // Having a connectionId indicates success (not sure why)
            trackedPromise.resolve();
        } else {
            trackedPromise.reject(summary.errorMessage);
        }
        connectionTracker.delete(summary.ownerUri);
    }
}

export class ConnectionContext implements IDisposable {

    private connected: boolean = false;
    private connectionUri: string;
    constructor(private connectionProvider: azdata.ConnectionProvider) {
        if (this.connectionProvider && !connectionProviders.has(connectionProvider.providerId)) {
            this.connectionProvider.registerOnConnectionComplete(onConnectionCompleteHandler);
        }
        this.connectionUri = `untitled:createdb${counter++}`;

    }

    public async tryConnect(connection: azdata.IConnectionProfile | azdata.connection.Connection): Promise<boolean> {
        try {
            let deferred = new Deferred<void>();
            connectionTracker.set(this.connectionUri, deferred);

            let connectRequested = await this.connectionProvider.connect(this.connectionUri, connection);
            if (!connectRequested) {
                return false;
            }
            // Wait on the connection to complete, or 15 seconds (mostly in case our logic is faulty)
            await Promise.race([deferred.promise, this.errorOnTimeout(15000)]);
        } catch (err) {
            return false;
        } finally {
            // Always clean up the connection from the tracker
            connectionTracker.delete(this.connectionUri);
        }

        this.connected = true;
        return this.connected;
    }

    /**
     * Simple execution of a query.
     * The query must be a single resultset response 
     * @param query 
     */
    public async runQueryAndReturn(query: string): Promise<azdata.SimpleExecuteResult> {
        if (!this.connected) {
            throw new Error('Connection must be created before running queries');
        }
        let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(this.connectionProvider.providerId, azdata.DataProviderType.QueryProvider);
        let result = await queryProvider.runQueryAndReturn(this.connectionUri, query);
        return result;
    }

    public dispose() {
        if (this.connected) {
            // Disconnect and ignore any errors since a failure means the connection wasn't really established.
            this.connectionProvider.disconnect(this.connectionUri).then(success => undefined, fail => undefined);
        }
    }

    private errorOnTimeout(ms: number): Promise<void> {
        return new Promise((resolve, reject) => setTimeout(reject, ms));
    }
}
