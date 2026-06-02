(function (global) {
    global.AppDbModules = global.AppDbModules || {};

    global.AppDbModules.createResultsService = function (options) {
        var get = options.get;
        var set = options.set;
        var getCurrentAcademicYear = options.getCurrentAcademicYear;
        var getUseSQLite = options.getUseSQLite;
        var getIpcRenderer = options.getIpcRenderer;

        return {
            getResults: function (allYears) {
                return get('institutionSettings').then(function (settings) {
                    var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();

                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-get-results', {
                            academicYear: allYears ? null : currentYear
                        });
                    }

                    return get('schoolResults').then(function (results) {
                        results = results || [];

                        if (!allYears) {
                            return results.filter(function (result) {
                                return !result.academic_year || result.academic_year === currentYear;
                            });
                        }

                        return results;
                    });
                });
            },

            saveResults: function (filteredResults) {
                return get('schoolResults').then(function (allResults) {
                    return get('institutionSettings').then(function (settings) {
                        var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();

                        var resultsToSave = (filteredResults || []).map(function (result) {
                            if (!result.academic_year) {
                                result.academic_year = currentYear;
                            }
                            return result;
                        });

                        var payload = resultsToSave;
                        if (!getUseSQLite()) {
                            var otherYears = (allResults || []).filter(function (result) {
                                return result.academic_year && result.academic_year !== currentYear;
                            });
                            payload = otherYears.concat(resultsToSave);
                        }

                        return set('schoolResults', payload).then(function () {
                            return set('lastUpdate', new Date().toLocaleString());
                        });
                    });
                });
            }
        };
    };
})(window);
