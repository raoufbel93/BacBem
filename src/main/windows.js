const { app, BrowserWindow } = require('electron');
const path = require('path');

function createSharedWebPreferences() {
    return {
        preload: path.join(app.getAppPath(), 'src', 'main', 'preload.js'),
        nodeIntegration: true,
        nodeIntegrationInSubFrames: true, // Required today because pages still load inside an iframe shell.
        contextIsolation: false, // Keep legacy behavior for now; preload is added for gradual hardening.
        nativeWindowOpen: true,
        enableRemoteModule: false,
        allowRunningInsecureContent: false,
        webSecurity: true,
        spellcheck: false
    };
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false, // Prevent black screen race condition on first load
        backgroundColor: '#09090b', // Match the new Modern Black background
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#09090b', // Match navbar background
            symbolColor: '#ffffff', // Minimize/Maximize/Close button icons color
            height: 32 // Height of the #title-bar div
        },
        webPreferences: createSharedWebPreferences(),
        icon: path.join(app.getAppPath(), 'Design.ico')
    });

    win.setMenu(null);
    win.maximize();

    win.once('ready-to-show', () => {
        win.show();
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url && /^https?:/i.test(url)) {
            return {
                action: 'deny'
            };
        }

        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                width: 1000,
                height: 800,
                autoHideMenuBar: true,
                menuBarVisible: false,
                webPreferences: createSharedWebPreferences()
            }
        };
    });

    win.webContents.on('did-create-window', (childWindow) => {
        childWindow.setMenu(null);
    });

    win.loadFile(path.join(app.getAppPath(), 'index.html'));

    // Open DevTools automatically in development
    if (!app.isPackaged) {
        win.webContents.openDevTools();
        
        // Add development shortcuts
        win.webContents.on('before-input-event', (event, input) => {
            if (input.type === 'keyDown') {
                // F5 or Ctrl+R to reload
                if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r') || (input.meta && input.key.toLowerCase() === 'r')) {
                    win.reload();
                    event.preventDefault();
                }
                // Ctrl+Shift+I to toggle DevTools
                if (input.control && input.shift && input.key.toLowerCase() === 'i') {
                    win.webContents.toggleDevTools();
                    event.preventDefault();
                }
            }
        });
    }
    
    return win;
}

module.exports = {
    createWindow
};
