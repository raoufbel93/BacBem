(function (global) {
    global.AppDbModules = global.AppDbModules || {};

    global.AppDbModules.createDBSync = function (options) {
        var DB = options.DB;
        var storage = options.storage;

        return {
            _cache: {},
            get: function (key) {
                if (this._cache[key] !== undefined) return this._cache[key];
                var value = storage.getItem(key);
                try { return JSON.parse(value); } catch (e) { return value; }
            },
            set: function (key, value) {
                this._cache[key] = value;
                DB.set(key, value);
                storage.setItem(key, JSON.stringify(value));
            },
            remove: function (key) {
                delete this._cache[key];
                DB.remove(key);
                storage.removeItem(key);
            }
        };
    };
})(window);
