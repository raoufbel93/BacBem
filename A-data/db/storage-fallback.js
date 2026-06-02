(function (global) {
    global.AppDbModules = global.AppDbModules || {};

    global.AppDbModules.createStorageFallback = function (storage) {
        return {
            get: function (key) {
                var value = storage.getItem(key);
                try {
                    return JSON.parse(value);
                } catch (e) {
                    return value;
                }
            },
            set: function (key, value) {
                storage.setItem(key, JSON.stringify(value));
            },
            getAll: function () {
                var data = {};
                for (var i = 0; i < storage.length; i++) {
                    var key = storage.key(i);
                    var value = storage.getItem(key);
                    try {
                        data[key] = JSON.parse(value);
                    } catch (e) {
                        data[key] = value;
                    }
                }
                return data;
            }
        };
    };
})(window);
