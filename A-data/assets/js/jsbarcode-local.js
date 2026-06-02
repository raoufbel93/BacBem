(function (global) {
    if (global.JsBarcode) return;

    try {
        var req = global.require || (typeof require !== 'undefined' ? require : null);
        if (!req) throw new Error('require unavailable');

        var jsBarcodeFactory = req('jsbarcode');
        if (typeof jsBarcodeFactory !== 'function') {
            throw new Error('jsbarcode export unavailable');
        }

        global.JsBarcode = jsBarcodeFactory;
    } catch (err) {
        console.warn('[LocalAssets] Failed to load JsBarcode locally:', err);
    }
})(window);
