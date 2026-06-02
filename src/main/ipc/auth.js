module.exports = function (context) {
    var ipcMain = context.ipcMain;
    var readSecureAuthStore = context.readSecureAuthStore;
    var writeSecureAuthStore = context.writeSecureAuthStore;

    ipcMain.handle('auth-store-password', async function (event, payload) {
        var store = readSecureAuthStore();
        store.password = payload && payload.password ? String(payload.password) : '';
        return { success: writeSecureAuthStore(store) };
    });

    ipcMain.handle('auth-load-password', async function () {
        var store = readSecureAuthStore();
        return {
            success: true,
            password: store && store.password ? String(store.password) : ''
        };
    });

    ipcMain.handle('auth-clear-password', async function () {
        var store = readSecureAuthStore();
        delete store.password;
        return { success: writeSecureAuthStore(store) };
    });
};
