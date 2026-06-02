const { app, BrowserWindow } = require('electron');

const { closeDatabase, initDatabase } = require('./src/main/database');
const { registerIpcHandlers } = require('./src/main/ipc-handlers');
const { createWindow } = require('./src/main/windows');

app.commandLine.appendSwitch('ignore-certificate-errors', 'true');

// Fix black screen on machines with incompatible GPU drivers (Windows 11, old Intel HD, etc.)
app.disableHardwareAcceleration();

app.whenReady()
    .then(() => initDatabase())
    .then(() => {
        registerIpcHandlers();
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    })
    .catch((err) => {
        console.error('Failed to start application due to database error:', err);
    });

app.on('window-all-closed', () => {
    closeDatabase();

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    closeDatabase();
});
