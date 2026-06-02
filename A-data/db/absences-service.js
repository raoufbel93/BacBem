(function (global) {
    global.AppDbModules = global.AppDbModules || {};

    global.AppDbModules.createAbsencesService = function (options) {
        var init = options.init;
        var get = options.get;
        var set = options.set;
        var getUseSQLite = options.getUseSQLite;
        var getIpcRenderer = options.getIpcRenderer;

        function withInit(callback) {
            return init().then(callback);
        }

        return {
            saveDayAbsences: function (data) {
                return withInit(function () {
                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-save-day-absences', data);
                    }

                    return get('absenceRecords').then(function (records) {
                        records = records || [];
                        records = records.filter(function (record) {
                            return !(record.date === data.date && record.period === data.period);
                        });
                        records.push({
                            date: data.date,
                            period: data.period,
                            students: data.students,
                            teachers: data.teachers,
                            supervisors: data.supervisors,
                            timestamp: new Date().toISOString()
                        });
                        return set('absenceRecords', records);
                    });
                });
            },

            getDayAbsences: function (date, period) {
                return withInit(function () {
                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-get-day-absences', {
                            date: date,
                            period: period || 'ALL'
                        });
                    }

                    return get('absenceRecords').then(function (records) {
                        records = records || [];
                        return records.find(function (record) {
                            return record.date === date && record.period === (period || 'ALL');
                        }) || null;
                    });
                });
            },

            getAbsencesRange: function (startDate, endDate) {
                return withInit(function () {
                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-get-absences-range', {
                            startDate: startDate,
                            endDate: endDate
                        });
                    }

                    return get('absenceRecords').then(function (records) {
                        records = records || [];
                        return records.filter(function (record) {
                            return record.date >= startDate && record.date <= endDate;
                        });
                    });
                });
            },

            getStudentAbsences: function (studentId, startDate, endDate) {
                return withInit(function () {
                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-get-student-absences', {
                            studentId: studentId,
                            startDate: startDate,
                            endDate: endDate
                        });
                    }

                    return get('absenceRecords').then(function (records) {
                        var result = [];
                        records = records || [];

                        records.forEach(function (record) {
                            if (startDate && record.date < startDate) return;
                            if (endDate && record.date > endDate) return;

                            if (record.students) {
                                record.students.forEach(function (student) {
                                    if (String(student.id) === String(studentId)) {
                                        result.push({
                                            date: record.date,
                                            period: record.period,
                                            am: student.am,
                                            pm: student.pm,
                                            reason: student.reason
                                        });
                                    }
                                });
                            }
                        });

                        return result;
                    });
                });
            },

            deleteDayAbsences: function (date, period) {
                return withInit(function () {
                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-delete-day-absences', {
                            date: date,
                            period: period || 'ALL'
                        });
                    }

                    return get('absenceRecords').then(function (records) {
                        records = records || [];
                        records = records.filter(function (record) {
                            return !(record.date === date && record.period === (period || 'ALL'));
                        });
                        return set('absenceRecords', records);
                    });
                });
            },

            getAbsenceHistory: function () {
                return withInit(function () {
                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-get-absence-history');
                    }

                    return get('absenceRecords').then(function (records) {
                        records = records || [];
                        return records.map(function (record) {
                            return {
                                date: record.date,
                                studentCount: record.students ? record.students.length : 0
                            };
                        }).sort(function (a, b) {
                            return b.date.localeCompare(a.date);
                        });
                    });
                });
            },

            saveCanteenAbsences: function (date, studentIds, academicYear) {
                return withInit(function () {
                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-save-canteen-absences', {
                            date: date,
                            studentIds: studentIds,
                            academicYear: academicYear
                        });
                    }

                    return get('canteenAbsences').then(function (data) {
                        data = data || {};
                        data[date] = studentIds;
                        return set('canteenAbsences', data);
                    });
                });
            },

            getCanteenAbsences: function (startDate, endDate) {
                return withInit(function () {
                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-get-canteen-absences', {
                            startDate: startDate,
                            endDate: endDate
                        });
                    }

                    return get('canteenAbsences').then(function (data) {
                        var filtered = {};
                        data = data || {};

                        if (!startDate && !endDate) {
                            return data;
                        }

                        Object.keys(data).forEach(function (date) {
                            if ((!startDate || date >= startDate) && (!endDate || date <= endDate)) {
                                filtered[date] = data[date];
                            }
                        });

                        return filtered;
                    });
                });
            },

            clearAllAbsences: function () {
                return withInit(function () {
                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-clear-all-absences');
                    }

                    return Promise.all([
                        set('absenceRecords', []),
                        set('canteenAbsences', {})
                    ]);
                });
            },

            getAllAbsencesExport: function () {
                return withInit(function () {
                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-get-all-absences-export');
                    }

                    return get('absenceRecords').then(function (records) {
                        return records || [];
                    });
                });
            },

            importAbsences: function (records) {
                return withInit(function () {
                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-import-absences', records);
                    }

                    return set('absenceRecords', records);
                });
            }
        };
    };
})(window);
