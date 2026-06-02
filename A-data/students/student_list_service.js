(function (global) {
    function normalizeBoardingStatus(status) {
        if (status === '\u0646\u0635\u0641 \u062f\u0627\u062e\u0644\u064a') return 'half_board';
        if (status === '\u062f\u0627\u062e\u0644\u064a') return 'boarding';
        if (status === '\u062e\u0627\u0631\u062c\u064a') return 'external';
        return status;
    }

    global.StudentListService = {
        loadSettings: async function (db) {
            return await db.getSettings() || {};
        },
        loadStudents: async function (db, year) {
            return await db.getStudents(true, year);
        },
        saveStudents: async function (db, students, activeYear) {
            return await db.saveStudents(students, activeYear);
        },
        filterStudents: function (students, options) {
            var source = Array.isArray(students) ? students : [];
            var filterOptions = options || {};
            var level = filterOptions.level || '';
            var cls = filterOptions.classValue || '';
            var selectedStatus = filterOptions.selectedStatus || '';
            var stream = filterOptions.stream || '';
            var normalizeLevel = typeof filterOptions.normalizeLevel === 'function' ? filterOptions.normalizeLevel : function (value) { return value; };

            return source.filter(function (student) {
                var matchLevel = level ? normalizeLevel(student.level) === level : true;
                var matchClass = true;

                if (cls) {
                    var studentClass = String(student.class || '').trim();
                    var filterClass = String(cls).trim();
                    matchClass = studentClass === filterClass;

                    if (!matchClass && !isNaN(studentClass) && !isNaN(filterClass)) {
                        matchClass = parseInt(studentClass, 10) === parseInt(filterClass, 10);
                    }
                }

                var matchStream = true;
                if (stream === 'tech_all') {
                    matchStream = Boolean(student.stream && student.stream.startsWith('tech_math'));
                } else if (stream) {
                    matchStream = student.stream === stream;
                }

                var isStruckOff = student.struck_off === true;
                var matchStatus = true;

                if (selectedStatus) {
                    if (['external', 'half_board', 'boarding'].includes(selectedStatus)) {
                        var studentStatus = normalizeBoardingStatus(student.status);
                        if (selectedStatus === 'external') {
                            matchStatus = (!studentStatus || studentStatus === 'external');
                        } else {
                            matchStatus = (studentStatus === selectedStatus);
                        }
                    } else if (!student.social_status || !Array.isArray(student.social_status)) {
                        matchStatus = false;
                    } else {
                        matchStatus = student.social_status.includes(selectedStatus);
                    }
                }

                return matchLevel && matchClass && matchStream && matchStatus && !isStruckOff;
            });
        }
    };
})(window);
