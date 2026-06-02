const { contextBridge, ipcRenderer, shell } = require('electron');

function createIpcBridge() {
    return {
        invoke: function (channel) {
            return ipcRenderer.invoke.apply(ipcRenderer, arguments);
        },
        on: function (channel, listener) {
            ipcRenderer.on(channel, listener);
        },
        once: function (channel, listener) {
            ipcRenderer.once(channel, listener);
        },
        removeAllListeners: function (channel) {
            ipcRenderer.removeAllListeners(channel);
        }
    };
}

function createShellBridge() {
    return {
        openExternal: function (target) {
            return shell.openExternal(target);
        }
    };
}

const envBridge = {
    isPackaged: process.argv.indexOf('--packaged') !== -1,
    platform: process.platform,
    versions: {
        chrome: process.versions.chrome,
        electron: process.versions.electron,
        node: process.versions.node
    }
};

function exposeLegacyBridge() {
    window.ipcRenderer = window.ipcRenderer || createIpcBridge();
    window.shell = window.shell || createShellBridge();
    window.__IDARA_ENV__ = window.__IDARA_ENV__ || envBridge;
}

if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('ipcRenderer', createIpcBridge());
    contextBridge.exposeInMainWorld('shell', createShellBridge());
    contextBridge.exposeInMainWorld('__IDARA_ENV__', envBridge);
} else {
    process.once('loaded', exposeLegacyBridge);
}
