(function (global) {
    global.AppDbModules = global.AppDbModules || {};

    global.AppDbModules.createStudentsService = function (options) {
        var get = options.get;
        var set = options.set;
        var getCurrentAcademicYear = options.getCurrentAcademicYear;
        var getUseSQLite = options.getUseSQLite;
        var getIpcRenderer = options.getIpcRenderer;

        function resolveTargetYear(settings, yearParam) {
            var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();

            if (yearParam === true) {
                return null;
            }

            if (typeof yearParam === 'string' && yearParam.length > 0) {
                return yearParam;
            }

            return currentYear;
        }

        return {
            getStudents: function (includeStruckOff, yearParam) {
                return get('institutionSettings').then(function (settings) {
                    var targetYear = resolveTargetYear(settings, yearParam);

                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-get-students', {
                            includeStruckOff: includeStruckOff,
                            academicYear: targetYear
                        });
                    }

                    return get('studentsList').then(function (students) {
                        students = students || [];

                        if (targetYear !== null) {
                            students = students.filter(function (student) {
                                return !student.academic_year || student.academic_year === targetYear;
                            });
                        }

                        if (includeStruckOff) return students;

                        return students.filter(function (student) {
                            return !student.struck_off;
                        });
                    });
                });
            },

            saveStudents: function (filteredStudents, providedYear) {
                return get('studentsList').then(function (allStudents) {
                    return get('institutionSettings').then(function (settings) {
                        var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();
                        var targetYear = providedYear || currentYear;

                        var otherYears = (allStudents || []).filter(function (student) {
                            return student.academic_year && student.academic_year !== targetYear;
                        });

                        var studentsToSave = (filteredStudents || []).map(function (student) {
                            if (!student.academic_year) {
                                student.academic_year = targetYear;
                            }
                            return student;
                        });

                        return set('studentsList', otherYears.concat(studentsToSave)).then(function () {
                            return set('studentsLastUpdate', new Date().toLocaleString());
                        });
                    });
                });
            }
        };
    };
})(window);
