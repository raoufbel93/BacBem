(function (global) {
    var storage = global.AppStorage || {
        getItem: function (key, fallbackValue) {
            try {
                var value = localStorage.getItem(key);
                return value === null ? fallbackValue : value;
            } catch (e) {
                return fallbackValue;
            }
        },
        setItem: function (key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (e2) {
                return false;
            }
        },
        getJSON: function (key, fallbackValue) {
            try {
                var value = localStorage.getItem(key);
                return value ? JSON.parse(value) : fallbackValue;
            } catch (e3) {
                return fallbackValue;
            }
        },
        setJSON: function (key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e4) {
                return false;
            }
        }
    };

    global.StudentListState = {
        allStudents: [],
        filteredStudents: [],
        isInitializing: true,
        studentToDeleteIndex: -1,
        studentToStrikeIndex: -1,
        educationStage: 'middle',
        reactRoot: null,
        storage: storage,
        sync: function (partial) {
            if (!partial || typeof partial !== 'object') return this;
            Object.assign(this, partial);
            return this;
        }
    };
})(window);
