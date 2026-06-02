(function (global) {
    function clonePeriod(period, fallback) {
        return period || fallback || { from: 'Present', to: 'Present' };
    }

    function createStudentSelectionEntry(student, options) {
        var opts = options || {};
        var defaultAm = opts.defaultAm || { from: 'Present', to: 'Present' };
        var defaultPm = opts.defaultPm || { from: 'Present', to: 'Present' };

        return {
            am: clonePeriod(student && student.am, defaultAm),
            pm: clonePeriod(student && student.pm, defaultPm),
            reason: (student && student.reason) || '',
            confirmed: opts.forceConfirmed ? true : !!(student && student.confirmed)
        };
    }

    function createTeacherSelectionEntry(teacher, options) {
        var opts = options || {};
        var entry = {
            type: (teacher && teacher.type) || opts.defaultType || 'حصة',
            reason: (teacher && teacher.reason) || ''
        };

        if (opts.includeDetails) {
            entry.periods = (teacher && teacher.periods) || [];
            entry.periodClasses = (teacher && teacher.periodClasses) || {};
            entry.hours = (teacher && teacher.hours) || 0;
            entry.lateDuration = (teacher && teacher.lateDuration) || 0;
        }

        return entry;
    }

    function createSupervisorSelectionEntry(supervisor, options) {
        var opts = options || {};
        var defaultPeriod = opts.defaultPeriod || 'FULL';

        if (typeof supervisor === 'string') {
            return {
                period: defaultPeriod,
                reason: supervisor,
                from: '',
                to: '',
                lateDuration: ''
            };
        }

        if (supervisor && typeof supervisor.reason === 'string' && !supervisor.period) {
            return {
                period: defaultPeriod,
                reason: supervisor.reason,
                from: '',
                to: '',
                lateDuration: ''
            };
        }

        return {
            period: (supervisor && supervisor.period) || defaultPeriod,
            reason: (supervisor && supervisor.reason) || '',
            from: (supervisor && supervisor.from) || '',
            to: (supervisor && supervisor.to) || '',
            lateDuration: (supervisor && supervisor.lateDuration) || ''
        };
    }

    global.AbsenceTrackingSelection = {
        createStudentSelectionEntry: createStudentSelectionEntry,
        createTeacherSelectionEntry: createTeacherSelectionEntry,
        createSupervisorSelectionEntry: createSupervisorSelectionEntry
    };
})(window);
