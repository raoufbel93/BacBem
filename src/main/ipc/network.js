module.exports = function (context) {
    var ipcMain = context.ipcMain;

    ipcMain.handle('proxy-http-request', async function (event, options) {
        var https = require('https');
        var http = require('http');
        var url = require('url');

        return new Promise(function (resolve) {
            try {
                var parsed = url.parse(options.url);
                var isHttps = parsed.protocol === 'https:';
                var lib = isHttps ? https : http;

                var reqOptions = {
                    hostname: parsed.hostname,
                    port: parsed.port || (isHttps ? 443 : 80),
                    path: parsed.path,
                    method: options.method || 'GET',
                    headers: options.headers || {},
                    rejectUnauthorized: false
                };

                var req = lib.request(reqOptions, function (res) {
                    var data = '';
                    res.on('data', function (chunk) { data += chunk; });
                    res.on('end', function () {
                        try {
                            resolve({ success: true, data: JSON.parse(data) });
                        } catch (e) {
                            resolve({ success: true, data: data });
                        }
                    });
                });

                req.on('error', function (err) {
                    resolve({ success: false, error: err.message });
                });

                req.setTimeout(15000, function () {
                    req.destroy();
                    resolve({ success: false, error: 'Request timeout' });
                });

                if (options.body) {
                    req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
                }
                req.end();
            } catch (err) {
                resolve({ success: false, error: err.message });
            }
        });
    });
};
