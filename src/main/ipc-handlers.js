const { app, dialog, ipcMain, safeStorage, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const registerAuthIpcHandlers = require('./ipc/auth');
const registerFileIpcHandlers = require('./ipc/files');
const registerMailIpcHandlers = require('./ipc/mail');
const registerNetworkIpcHandlers = require('./ipc/network');

const { getDb, registerDatabaseIpcHandlers } = require('./database');

function getSecureAuthStorePath() {
    return path.join(app.getPath('userData'), 'auth_secure.dat');
}

function readSecureAuthStore() {
    try {
        const storePath = getSecureAuthStorePath();
        if (!fs.existsSync(storePath)) return {};

        const raw = fs.readFileSync(storePath);
        if (!raw || !raw.length) return {};

        let text = '';
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
            try {
                text = safeStorage.decryptString(raw);
            } catch (decryptErr) {
                text = raw.toString('utf8');
            }
        } else {
            text = raw.toString('utf8');
        }

        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
        console.error('[Auth Store] Read error:', err);
        return {};
    }
}

function writeSecureAuthStore(data) {
    try {
        const storePath = getSecureAuthStorePath();
        const dir = path.dirname(storePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const payload = JSON.stringify(data || {});
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
            fs.writeFileSync(storePath, safeStorage.encryptString(payload));
        } else {
            fs.writeFileSync(storePath, payload, 'utf8');
        }
        return true;
    } catch (err) {
        console.error('[Auth Store] Write error:', err);
        return false;
    }
}

function registerIpcHandlers() {
    registerDatabaseIpcHandlers(ipcMain);

    var context = {
        app: app,
        dialog: dialog,
        fs: fs,
        getDb: getDb,
        ipcMain: ipcMain,
        nodemailer: nodemailer,
        path: path,
        readSecureAuthStore: readSecureAuthStore,
        shell: shell,
        writeSecureAuthStore: writeSecureAuthStore
    };

    registerNetworkIpcHandlers(context);
    registerAuthIpcHandlers(context);
    registerFileIpcHandlers(context);
    registerMailIpcHandlers(context);
}

module.exports = {
    registerIpcHandlers
};
