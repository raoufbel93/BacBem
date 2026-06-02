const ExemptSubjectsHelper = (function () {
    const DEFAULT_EXEMPTION_MAP = {
        art: ['ت.تشكيلية', 'التربية التشكيلية', 'فنون تشكيلية', 'رسم', 'فنون', 'التربية الفنية'],
        music: ['موسيقى', 'التربية الموسيقية'],
        info: ['معلوماتية', 'اعلام', 'إعلام آلي', 'اعلام آلي', 'الإعلام الآلي'],
        ama: ['أمازيغية', 'الأمازيغية', 'اللغة الأمازيغية', 'لغة أمازيغية']
    };

    function normalizeArabic(text) {
        if (!text) return '';
        return text.toString().trim().toLowerCase()
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي');
    }

    function getLevelKey(level) {
        const value = (level || '').toString();
        if (value.includes('1') || value.includes('أولى')) return '1';
        if (value.includes('2') || value.includes('ثانية')) return '2';
        if (value.includes('3') || value.includes('ثالثة')) return '3';
        if (value.includes('4') || value.includes('رابعة')) return '4';
        return null;
    }

    function resolveLevelKeys(options) {
        const levelKeys = new Set();

        if (Array.isArray(options.levels)) {
            options.levels.forEach(level => {
                const key = getLevelKey(level);
                if (key) levelKeys.add(key);
            });
        }

        const directLevelKey = getLevelKey(options.level);
        if (directLevelKey) {
            levelKeys.add(directLevelKey);
        }

        if (!levelKeys.size && Array.isArray(options.students)) {
            options.students.forEach(student => {
                const key = getLevelKey(student && student.level);
                if (key) levelKeys.add(key);
            });
        }

        if (!levelKeys.size && Array.isArray(options.fallbackLevels)) {
            options.fallbackLevels.forEach(level => {
                const key = getLevelKey(level);
                if (key) levelKeys.add(key);
            });
        }

        return Array.from(levelKeys);
    }

    function matchExemptionCode(subjectName, exemptionMap) {
        const normSubject = normalizeArabic(subjectName);
        if (!normSubject) return null;

        for (const [code, aliases] of Object.entries(exemptionMap || DEFAULT_EXEMPTION_MAP)) {
            if (aliases.some(alias => normSubject.includes(normalizeArabic(alias)))) {
                return code;
            }
        }

        return null;
    }

    function isSubjectExempt(subjectName, options = {}) {
        const exemptSubjects = options.exemptSubjects || {};
        const exemptionMap = options.exemptionMap || DEFAULT_EXEMPTION_MAP;
        const levelKeys = resolveLevelKeys(options);
        const code = matchExemptionCode(subjectName, exemptionMap);

        if (!code || !levelKeys.length) return false;

        if (levelKeys.length === 1) {
            return (exemptSubjects[levelKeys[0]] || []).includes(code);
        }

        return levelKeys.every(levelKey => (exemptSubjects[levelKey] || []).includes(code));
    }

    function filterSubjects(subjects, options = {}) {
        return (subjects || []).filter(subjectName => !isSubjectExempt(subjectName, options));
    }

    return {
        normalizeArabic,
        getLevelKey,
        resolveLevelKeys,
        matchExemptionCode,
        isSubjectExempt,
        filterSubjects,
        DEFAULT_EXEMPTION_MAP
    };
})();

window.ExemptSubjectsHelper = ExemptSubjectsHelper;
