(function (global) {
    global.AbsenceTrackingState = {
        loadReportNumber: function (options) {
            var DB = options.DB;
            var doc = options.document;
            var reportNumberEl = doc.getElementById('reportNumber');

            if (!reportNumberEl) return Promise.resolve();

            return Promise.resolve(DB.get('reportNumberData')).then(function (reportData) {
                reportData = reportData || { lastNumber: 0, lastDate: null };

                return Promise.resolve(DB.getSettings()).then(function (settings) {
                    var currentSchoolYear = (settings && settings.schoolYear) || '';
                    var today = new Date().toISOString().split('T')[0];

                    if (reportData.schoolYear && reportData.schoolYear !== currentSchoolYear && currentSchoolYear) {
                        reportData.lastNumber = 0;
                        reportData.schoolYear = currentSchoolYear;
                    }

                    if (reportData.lastDate !== today) {
                        reportData.lastNumber = (reportData.lastNumber || 0) + 1;
                        reportData.lastDate = today;
                        reportData.schoolYear = currentSchoolYear;

                        return Promise.resolve(DB.set('reportNumberData', reportData)).then(function () {
                            reportNumberEl.value = reportData.lastNumber;
                        });
                    }

                    reportNumberEl.value = reportData.lastNumber;
                });
            });
        },

        saveReportNumber: function (options) {
            var DB = options.DB;
            var doc = options.document;
            var reportNumberEl = doc.getElementById('reportNumber');

            if (!reportNumberEl) return Promise.resolve();

            return Promise.resolve(DB.getSettings()).then(function (settings) {
                var currentSchoolYear = (settings && settings.schoolYear) || '';
                return DB.set('reportNumberData', {
                    lastNumber: parseInt(reportNumberEl.value, 10) || 1,
                    lastDate: new Date().toISOString().split('T')[0],
                    schoolYear: currentSchoolYear
                });
            });
        },

        attachViewStateListeners: function (options) {
            var doc = options.document;
            var saveViewState = options.saveViewState;
            var loadFacilitiesData = options.loadFacilitiesData;

            ['absenceDate', 'periodSelect', 'levelSelect', 'streamSelect', 'classSelect', 'studentSearch'].forEach(function (id) {
                var el = doc.getElementById(id);
                if (!el) return;

                el.addEventListener('change', function (e) {
                    Promise.resolve(saveViewState()).then(function () {
                        if (id === 'absenceDate' && typeof loadFacilitiesData === 'function') {
                            return loadFacilitiesData(e.target.value);
                        }
                    });
                });

                if (id === 'studentSearch') {
                    el.addEventListener('keyup', saveViewState);
                }
            });
        },

        saveViewState: function (options) {
            var doc = options.document;
            var storage = options.storage;
            var state = {
                date: doc.getElementById('absenceDate') ? doc.getElementById('absenceDate').value : '',
                period: doc.getElementById('periodSelect') ? doc.getElementById('periodSelect').value : '',
                level: doc.getElementById('levelSelect') ? doc.getElementById('levelSelect').value : '',
                stream: doc.getElementById('streamSelect') ? doc.getElementById('streamSelect').value : '',
                class: doc.getElementById('classSelect') ? doc.getElementById('classSelect').value : '',
                search: doc.getElementById('studentSearch') ? doc.getElementById('studentSearch').value : ''
            };

            storage.setItem('absenceTrackingState', JSON.stringify(state));
            return state;
        },

        restoreViewState: function (options) {
            var doc = options.document;
            var storage = options.storage;
            var loadClasses = options.loadClasses;
            var loadStudentsTable = options.loadStudentsTable;
            var filterStudentsTable = options.filterStudentsTable;
            var saved = storage.getItem('absenceTrackingState', null);
            var state = null;

            if (!saved) return Promise.resolve();

            try {
                state = JSON.parse(saved);
            } catch (e) {
                return Promise.resolve();
            }

            if (state.period && doc.getElementById('periodSelect')) {
                doc.getElementById('periodSelect').value = state.period;
            }

            function restoreSearch() {
                if (state.search && doc.getElementById('studentSearch')) {
                    doc.getElementById('studentSearch').value = state.search;
                    if (typeof filterStudentsTable === 'function') {
                        filterStudentsTable();
                    }
                }
            }

            if (!(state.level && doc.getElementById('levelSelect'))) {
                restoreSearch();
                return Promise.resolve();
            }

            doc.getElementById('levelSelect').value = state.level;

            return Promise.resolve(typeof loadClasses === 'function' ? loadClasses() : null).then(function () {
                return new Promise(function (resolve) {
                    setTimeout(function () {
                        if (state.stream && doc.getElementById('streamSelect')) {
                            doc.getElementById('streamSelect').value = state.stream;

                            if (typeof loadClasses === 'function') {
                                loadClasses();
                            }

                            setTimeout(function () {
                                if (state.class && doc.getElementById('classSelect')) {
                                    doc.getElementById('classSelect').value = state.class;
                                    if (typeof loadStudentsTable === 'function') {
                                        loadStudentsTable();
                                    }
                                }
                                restoreSearch();
                                resolve();
                            }, 100);
                        } else {
                            if (state.class && doc.getElementById('classSelect')) {
                                doc.getElementById('classSelect').value = state.class;
                                if (typeof loadStudentsTable === 'function') {
                                    loadStudentsTable();
                                }
                            }
                            restoreSearch();
                            resolve();
                        }
                    }, 100);
                });
            });
        }
    };
})(window);
