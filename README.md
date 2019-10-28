# AzureDataStudio DMP Wrapper

A wrapper to simplify using Data Management Protocol APIs in Azure Data Studio.

## Usage
```ts
// Create a Connection context to simplify connecting via the Data Management Protocol
let connectionProvider = azdata.dataprotocol.getProvider<azdata.ConnectionProvider>('MSSQL', azdata.DataProviderType.ConnectionProvider);
let connectionContext = new ConnectionContext(connectionProvider);

// Connect once
let connected = await connectionContext.tryConnect(connection);
if (!connected) {
    return;
}

// Run queries
let result: azdata.SimpleExecuteResult = await connectionContext.runQueryAndReturn('select 1 as MyColumn');
if (result.columnInfo[0].columnName !== 'MyColumn') {
    throw new Error('Query did not work');
} else {
    vscode.window.showInformationMessage(`Value returned from query was ${result.rows[0][0].displayValue}`);
}

// Close connection
connectionContext.dispose();
```

## Licensing
This is free to use under the MIT license