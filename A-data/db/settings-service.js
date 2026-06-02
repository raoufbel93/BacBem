(function (global) {
    global.AppDbModules = global.AppDbModules || {};

    global.AppDbModules.createSettingsService = function (options) {
        var get = options.get;
        var set = options.set;
        var getAuthUser = options.getAuthUser || function () { return null; };
        var localStorageRef = options.localStorage;

        return {
            getSettings: function () {
                return get('institutionSettings').then(function (settings) {
                    settings = settings || {};

                    if (settings.currentAcademicYear) {
                        settings.schoolYear = settings.currentAcademicYear;
                    }

                    var user = getAuthUser();
                    if (user) {
                        settings.wilaya = settings.wilaya || user.wilaya || '';
                        settings.municipality = settings.municipality || user.municipality || '';
                        settings.district = settings.district || user.district || user.daira || '';
                        settings.phone = settings.phone || user.phone || '';
                        settings.institutionName = settings.institutionName || user.institution || '';
                        settings.managerName = settings.managerName || user.manager || '';

                        if (!settings.schoolYear) {
                            settings.schoolYear = user.schoolYear || '';
                        }
                    }

                    return settings;
                });
            },

            saveSettings: function (settings) {
                try {
                    localStorageRef.setItem('institutionSettings', JSON.stringify(settings));
                } catch (e) { }

                return set('institutionSettings', settings);
            }
        };
    };
})(window);
