(function (global) {
    if (global.qrcode) return;

    try {
        var req = global.require || (typeof require !== 'undefined' ? require : null);
        if (!req) throw new Error('require unavailable');

        var QRCore = req('qrcode/lib/core/qrcode');

        global.qrcode = function (typeNumber, errorCorrectionLevel) {
            var segments = [];
            var qrModel = null;

            return {
                addData: function (data, mode) {
                    if (mode === 'Byte') {
                        segments.push({
                            data: Buffer.from(String(data || ''), 'binary'),
                            mode: 'byte'
                        });
                        return;
                    }

                    segments.push(String(data || ''));
                },
                make: function () {
                    qrModel = QRCore.create(segments, {
                        errorCorrectionLevel: errorCorrectionLevel || 'L'
                    });
                },
                getModuleCount: function () {
                    return qrModel && qrModel.modules ? qrModel.modules.size : 0;
                },
                isDark: function (row, col) {
                    return !!(qrModel && qrModel.modules && qrModel.modules.get(row, col));
                }
            };
        };
    } catch (err) {
        console.warn('[LocalAssets] Failed to load QRCode locally:', err);
    }
})(window);
