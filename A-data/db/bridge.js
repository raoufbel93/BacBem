(function (global) {
    global.AppDbModules = global.AppDbModules || {};

    global.AppDbModules.detectElectronBridge = function (win) {
        try {
            var electronObj = null;
            var req = typeof win !== 'undefined'
                ? (win.require || (typeof require !== 'undefined' ? require : null))
                : null;

            if (!req && typeof win !== 'undefined') {
                try {
                    if (win.parent && win.parent !== win && win.parent.require) {
                        req = win.parent.require;
                    }
                } catch (e) { }

                if (!req) {
                    try {
                        if (win.top && win.top !== win && win.top.require) {
                            req = win.top.require;
                        }
                    } catch (e2) { }
                }
            }

            if (req) {
                try {
                    electronObj = req('electron');
                } catch (e3) { }
            }

            if (electronObj) {
                win.ipcRenderer = electronObj.ipcRenderer;
                win.shell = electronObj.shell;
                console.log('[DB] Electron IPC detected successfully via bridge module');
            } else if (win.ipcRenderer) {
                console.log('[DB] Electron IPC already exposed (e.g. via preload)');
            } else {
                var inherited = false;
                try {
                    if (win.parent && win.parent !== win && win.parent.ipcRenderer) {
                        win.ipcRenderer = win.parent.ipcRenderer;
                        win.shell = win.parent.shell;
                        inherited = true;
                        console.log('[DB] Electron IPC inherited from parent window');
                    }
                } catch (e4) { }

                if (!inherited) {
                    try {
                        if (win.top && win.top !== win && win.top.ipcRenderer) {
                            win.ipcRenderer = win.top.ipcRenderer;
                            win.shell = win.top.shell;
                            inherited = true;
                            console.log('[DB] Electron IPC inherited from top window');
                        }
                    } catch (e5) { }
                }
            }

            win.isElectron = !!(win.ipcRenderer || (typeof process !== 'undefined' && process.versions && process.versions.electron));
            return true;
        } catch (e) {
            console.warn('DB bridge module error:', e);
            return false;
        }
    };
})(window);
