(function (global) {
    function getStorage(target) {
        try {
            return target === 'session' ? global.sessionStorage : global.localStorage;
        } catch (e) {
            return null;
        }
    }

    function getItem(key, fallbackValue, target) {
        var storage = getStorage(target);
        if (!storage) return fallbackValue;

        try {
            var value = storage.getItem(key);
            return value === null ? fallbackValue : value;
        } catch (e) {
            return fallbackValue;
        }
    }

    function setItem(key, value, target) {
        var storage = getStorage(target);
        if (!storage) return false;

        try {
            storage.setItem(key, value);
            return true;
        } catch (e) {
            return false;
        }
    }

    function removeItem(key, target) {
        var storage = getStorage(target);
        if (!storage) return false;

        try {
            storage.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    }

    function getJSON(key, fallbackValue, target) {
        var raw = getItem(key, null, target);
        if (raw === null || raw === undefined || raw === '') return fallbackValue;

        try {
            return JSON.parse(raw);
        } catch (e) {
            return fallbackValue;
        }
    }

    function setJSON(key, value, target) {
        return setItem(key, JSON.stringify(value), target);
    }

    global.AppStorage = global.AppStorage || {};
    global.AppStorage.getItem = getItem;
    global.AppStorage.setItem = setItem;
    global.AppStorage.removeItem = removeItem;
    global.AppStorage.getJSON = getJSON;
    global.AppStorage.setJSON = setJSON;
})(window);
