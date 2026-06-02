(function (global) {
    var LEVEL_WORDS = {
        '1': 'أولى',
        '2': 'ثانية',
        '3': 'ثالثة',
        '4': 'رابعة'
    };

    function getStudentYear(student, options) {
        var value = '';
        var normalizedOptions = options || {};

        if (student) {
            value = student.academic_year || student.schoolYear || student.year || student.school_year || '';
        }

        value = value == null ? '' : String(value).trim();

        if (normalizedOptions.separator && normalizedOptions.separator !== '/') {
            value = value.replace(/\//g, normalizedOptions.separator);
        }

        return value;
    }

    function getEducationStage(stageValue) {
        return stageValue === 'secondary' ? 'secondary' : 'middle';
    }

    function getLevelNumber(levelValue) {
        if (!levelValue) return '';

        var level = String(levelValue).trim();

        if (level.indexOf('1') !== -1 || level.indexOf('أولى') !== -1 || level.indexOf('الأولى') !== -1 || level.indexOf('One') !== -1) {
            return '1';
        }
        if (level.indexOf('2') !== -1 || level.indexOf('ثانية') !== -1 || level.indexOf('الثانية') !== -1 || level.indexOf('Two') !== -1) {
            return '2';
        }
        if (level.indexOf('3') !== -1 || level.indexOf('ثالثة') !== -1 || level.indexOf('الثالثة') !== -1 || level.indexOf('Three') !== -1) {
            return '3';
        }
        if (level.indexOf('4') !== -1 || level.indexOf('رابعة') !== -1 || level.indexOf('الرابعة') !== -1 || level.indexOf('Four') !== -1) {
            return '4';
        }

        return '';
    }

    function getCanonicalLevel(levelValue) {
        var levelNumber = getLevelNumber(levelValue);
        return LEVEL_WORDS[levelNumber] || '';
    }

    function isValidLevelForStage(levelValue, stageValue) {
        var levelNumber = getLevelNumber(levelValue);
        var stage = getEducationStage(stageValue);

        if (!levelNumber) return false;
        if (stage === 'secondary') return levelNumber === '1' || levelNumber === '2' || levelNumber === '3';
        return levelNumber === '1' || levelNumber === '2' || levelNumber === '3' || levelNumber === '4';
    }

    function getLevelRank(levelValue) {
        var levelNumber = getLevelNumber(levelValue);
        return levelNumber ? parseInt(levelNumber, 10) : 0;
    }

    function formatLevel(levelValue, stageValue, options) {
        var stage = getEducationStage(stageValue);
        var normalizedOptions = options || {};
        var canonicalLevel = getCanonicalLevel(levelValue);
        var includeStageLabel = normalizedOptions.includeStageLabel === true;

        if (!canonicalLevel) {
            return levelValue == null ? '' : String(levelValue).trim();
        }

        if (includeStageLabel) {
            return canonicalLevel + (stage === 'secondary' ? ' ثانوي' : ' متوسط');
        }

        if (stage === 'secondary') {
            return canonicalLevel + ' ثانوي';
        }

        return canonicalLevel;
    }

    function getLevelOptionsByStage(stageValue, options) {
        var stage = getEducationStage(stageValue);
        var normalizedOptions = options || {};
        var maxLevel = stage === 'secondary' ? 3 : 4;
        var result = [];
        var i;

        for (i = 1; i <= maxLevel; i += 1) {
            result.push({
                value: LEVEL_WORDS[String(i)],
                label: formatLevel(LEVEL_WORDS[String(i)], stage, {
                    includeStageLabel: normalizedOptions.includeStageLabel === true
                })
            });
        }

        return result;
    }

    function matchLevel(levelValue, targetLevelNum) {
        if (!levelValue) return false;
        return getLevelNumber(levelValue) === String(targetLevelNum || '').trim();
    }

    global.AppAcademic = global.AppAcademic || {};
    global.AppAcademic.getStudentYear = getStudentYear;
    global.AppAcademic.getEducationStage = getEducationStage;
    global.AppAcademic.getLevelNumber = getLevelNumber;
    global.AppAcademic.getCanonicalLevel = getCanonicalLevel;
    global.AppAcademic.isValidLevelForStage = isValidLevelForStage;
    global.AppAcademic.getLevelRank = getLevelRank;
    global.AppAcademic.formatLevel = formatLevel;
    global.AppAcademic.getLevelOptionsByStage = getLevelOptionsByStage;
    global.AppAcademic.matchLevel = matchLevel;
})(window);
