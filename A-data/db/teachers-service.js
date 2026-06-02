(function (global) {
    global.AppDbModules = global.AppDbModules || {};

    global.AppDbModules.createTeachersService = function (options) {
        var get = options.get;
        var set = options.set;
        var getCurrentAcademicYear = options.getCurrentAcademicYear;
        var getUseSQLite = options.getUseSQLite;
        var getIpcRenderer = options.getIpcRenderer;

        return {
            getTeachers: function (allYears) {
                return get('institutionSettings').then(function (settings) {
                    var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();

                    if (getUseSQLite()) {
                        return getIpcRenderer().invoke('db-get-teachers', {
                            academicYear: allYears ? null : currentYear
                        });
                    }

                    return get('teachersList').then(function (teachers) {
                        teachers = teachers || [];

                        if (!allYears) {
                            return teachers.filter(function (teacher) {
                                return !teacher.academic_year || teacher.academic_year === currentYear;
                            });
                        }

                        return teachers;
                    });
                });
            },

            saveTeachers: function (filteredTeachers) {
                return get('teachersList').then(function (allTeachers) {
                    return get('institutionSettings').then(function (settings) {
                        var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();

                        var otherYears = (allTeachers || []).filter(function (teacher) {
                            return teacher.academic_year && teacher.academic_year !== currentYear;
                        });

                        var teachersToSave = (filteredTeachers || []).map(function (teacher) {
                            if (!teacher.academic_year) {
                                teacher.academic_year = currentYear;
                            }
                            return teacher;
                        });

                        return set('teachersList', otherYears.concat(teachersToSave));
                    });
                });
            }
        };
    };
})(window);
