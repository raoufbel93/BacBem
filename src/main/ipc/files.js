module.exports = function (context) {
    var app = context.app;
    var dialog = context.dialog;
    var ipcMain = context.ipcMain;
    var shell = context.shell;
    var fs = context.fs;
    var path = context.path;
    var pathToFileURL = require('url').pathToFileURL;

    ipcMain.handle('save-excel', async function (event, payload) {
        var buffer = payload;
        var defaultFileName = 'export.xlsx';

        if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload.buffer) {
            buffer = payload.buffer;
            if (payload.fileName) {
                defaultFileName = path.basename(String(payload.fileName));
            }
        }

        if (!/\.xlsx$/i.test(defaultFileName)) {
            defaultFileName += '.xlsx';
        }

        var result = await dialog.showSaveDialog({
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
            defaultPath: defaultFileName
        });

        if (result.canceled || !result.filePath) {
            return { success: false };
        }

        try {
            fs.writeFileSync(result.filePath, Buffer.from(buffer));
            return { success: true, filePath: result.filePath };
        } catch (error) {
            console.error('Failed to save file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('show-open-dialog', async function (event, options) {
        var dialogOptions = Object.assign({}, options || {});
        if (!Array.isArray(dialogOptions.properties) || dialogOptions.properties.length === 0) {
            dialogOptions.properties = ['openFile'];
        }
        return dialog.showOpenDialog(dialogOptions);
    });

    ipcMain.handle('select-files', async function (event, options) {
        var filters = (options && options.filters) || [
            { name: 'All Files', extensions: ['*'] },
            { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'] },
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'] }
        ];
        var result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: filters,
            title: options && options.title ? options.title : 'اختر الملفات'
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            return { success: false, files: [] };
        }

        return {
            success: true,
            files: result.filePaths.map(function (filePath) {
                return {
                    path: filePath,
                    filename: path.basename(filePath),
                    size: fs.statSync(filePath).size
                };
            })
        };
    });

    ipcMain.handle('print-to-browser', async function (event, htmlContent) {
        try {
            var tempDir = app.getPath('temp');
            var reportDir = path.join(tempDir, 'idarati_reports');
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
            }
            var tempPath = path.join(reportDir, 'report_' + Date.now() + '.html');
            fs.writeFileSync(tempPath, htmlContent, 'utf8');
            var fileUrl = pathToFileURL(tempPath).href;
            await shell.openExternal(fileUrl);
            return { success: true };
        } catch (err) {
            console.error('Error opening report in browser:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('print-native', async function (event, htmlContent) {
        try {
            var tempDir = app.getPath('temp');
            var reportDir = path.join(tempDir, 'idarati_reports');
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
            }
            var tempPath = path.join(reportDir, 'print_temp_' + Date.now() + '.html');
            fs.writeFileSync(tempPath, htmlContent, 'utf8');

            const { BrowserWindow } = require('electron');
            const parentWindow = BrowserWindow.fromWebContents(event.sender);

            const printWindow = new BrowserWindow({
                parent: parentWindow,
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });

            printWindow.loadFile(tempPath);

            printWindow.webContents.on('did-finish-load', () => {
                setTimeout(() => {
                    printWindow.webContents.print({
                        silent: false,
                        printBackground: true,
                        color: true,
                        margins: { marginType: 'none' }
                    }, () => {
                        printWindow.close();
                        try { fs.unlinkSync(tempPath); } catch (e) { }
                    });
                }, 500);
            });

            return { success: true };
        } catch (err) {
            console.error('Error in native print:', err);
            return { success: false, error: err.message };
        }
    });
};
