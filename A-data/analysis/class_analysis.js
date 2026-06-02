function getStudentYear(s) {
    if (window.AppAcademic && typeof window.AppAcademic.getStudentYear === 'function') {
        return window.AppAcademic.getStudentYear(s);
    }
    return s && (s.academic_year || s.schoolYear || s.year || s.school_year || '') || '';
}

function getAnalysisIdentityKey(student) {
    const clean = function (value) {
        return normalizeArabic(value || '');
    };

    const academicYear = clean(getStudentYear(student));

    return [
        'fallback',
        academicYear,
        clean(student && (student.name || student.student_name)),
        clean(student && student.dob),
        clean(student && student.pob),
        clean(student && student.gender),
        clean(student && student.level),
        clean(student && student.class),
        clean(student && student.stream)
    ].join('|');
}

// 1. البيانات الوهمية (Mock Data) كخيار احتياطي

// ترتيب المواد للعرض في القائمة التفصيلية (ثابت حسب HTML)

const orderedSubjects = [

    'عربية', 'أمازيغية', 'فرنسية', 'انجليزية',

    'اسلامية', 'مدنية', 'تاريخ',

    'رياضيات', 'علوم', 'فيزياء',

    'تسيير محاسبي', 'اقتصاد ومناجمنت', 'قانون',

    'هندسة مدنية', 'هندسة ميكانيكية', 'هندسة كهربائية', 'هندسة طرائق',

    'فلسفة', 'لغة ثالثة',

    'معلوماتية', 'ت.تشكيلية', 'موسيقى', 'رياضة'

];

// توليد بيانات عشوائية لـ 15 تلميذ (للعرض الأولي فقط)

// توليد بيانات عشوائية لـ 15 تلميذ (للعرض الأولي فقط)

const mockStudentsData = [];

// ...

// ...

// Global Variables for Data

let studentsData = []; // Define explicitly
let subjects = [];
let exemptSubjects = {};
let teachersList = [];
let classResponsibles = {};
let institutionSettings = {};
let signatureSettings = {};
let secondaryManualDecisions = {};

const SECONDARY_MANUAL_DECISIONS_KEY = 'secondaryManualDecisions';

// Cache for performance
const scoreCache = new Map(); // Key: studentId_subject_trimester -> Score
const statsCache = new Map(); // Key: trimester_subject -> { passed, total, rate }
const analysisNonSubjectPatterns = ['معدل', 'المعدل', 'average', 'avg', 'total', 'المجموع', 'الرتبة', 'التقدير'];

function isAnalysisSubjectKey(key) {

    if (!key) return false;

    const lowerKey = String(key).toLowerCase();
    const normKey = normalizeArabic(String(key));

    return !analysisNonSubjectPatterns.some(pattern =>
        normKey.startsWith(normalizeArabic(pattern)) ||
        lowerKey.startsWith(pattern.toLowerCase())
    );

}

function getTrimesterRankFromLabel(value) {

    const normalized = normalizeArabic(value || '');

    if (normalized === 'annual' || normalized.includes('سنوي')) return 4;
    if (normalized.includes('ثالث') || /\b3\b/.test(normalized)) return 3;
    if (normalized.includes('ثاني') || /\b2\b/.test(normalized)) return 2;
    if (normalized.includes('اول') || /\b1\b/.test(normalized)) return 1;

    return 0;

}

function mergeAnalysisStudentRecords(target, source) {

    const mergedMarks = Object.assign({}, target.marks || {});
    Object.keys(source.marks || {}).forEach(key => {
        const value = source.marks[key];
        if (value !== undefined && value !== null && value !== '') {
            mergedMarks[key] = value;
        }
    });
    target.marks = mergedMarks;

    const mergedAverages = Object.assign({}, target.averages || {});
    Object.keys(source.averages || {}).forEach(key => {
        const value = source.averages[key];
        if (value !== undefined && value !== null && value !== '') {
            mergedAverages[key] = value;
        }
    });
    target.averages = mergedAverages;

    const targetTrimesterRank = getTrimesterRankFromLabel(target.trimester);
    const sourceTrimesterRank = getTrimesterRankFromLabel(source.trimester);

    if (sourceTrimesterRank >= targetTrimesterRank) {
        if (source.trimester) target.trimester = source.trimester;
        if (source.average !== undefined && source.average !== null && source.average !== '') {
            target.average = source.average;
        }
        if (source.decision && source.decision !== '-') {
            target.decision = source.decision;
        }
    }

    if ((!target.average && target.average !== 0) && (source.average || source.average === 0)) {
        target.average = source.average;
    }

    if (!target.dob && source.dob) target.dob = source.dob;
    if (!target.pob && source.pob) target.pob = source.pob;
    if (!target.gender && source.gender) target.gender = source.gender;
    if (!target.level && source.level) target.level = source.level;
    if (!target.class && source.class) target.class = source.class;
    if (!target.stream && source.stream) target.stream = source.stream;
    if (!target.academic_year && source.academic_year) target.academic_year = source.academic_year;

    return target;

}

function collectSubjectsFromStudents(data) {

    const seen = new Set();
    const collected = [];

    (data || []).forEach(student => {
        Object.keys((student && student.marks) || {}).forEach(key => {
            if (!isAnalysisSubjectKey(key)) return;

            const cleanKey = String(key).trim();
            if (!cleanKey || seen.has(cleanKey)) return;

            seen.add(cleanKey);
            collected.push(cleanKey);
        });
    });

    return collected;

}

function getAvailableSubjectsForSelection(data, options) {

    const safeOptions = options || {};
    const trimesterVal = safeOptions.trimesterVal || '1';
    const discoveredSubjects = getSubjectsForTrimester(
        collectSubjectsFromStudents(data),
        trimesterVal
    );

    if (discoveredSubjects.length > 0) {
        return filterSubjectsForContext(safeOptions.level || '', discoveredSubjects, data);
    }

    if (safeOptions.stage === 'secondary' && typeof SubjectManager !== 'undefined') {
        const streamCodes = safeOptions.stream
            ? [safeOptions.stream]
            : Array.from(new Set((data || []).map(student => student.stream).filter(Boolean)));

        const secondarySubjects = [];
        const seen = new Set();

        streamCodes.forEach(streamCode => {
            (SubjectManager.getSubjects('secondary', safeOptions.level, streamCode) || []).forEach(subjectName => {
                const baseName = stripTrimesterSuffix(subjectName);
                const normalizedBase = normalizeArabic(baseName);

                if (!normalizedBase || seen.has(normalizedBase)) return;

                seen.add(normalizedBase);
                secondarySubjects.push(baseName);
            });
        });

        if (secondarySubjects.length > 0) {
            return filterSubjectsForContext(
                safeOptions.level || '',
                getSubjectsForTrimester(secondarySubjects, trimesterVal),
                data
            );
        }
    }

    return filterSubjectsForContext(
        safeOptions.level || '',
        getSubjectsForTrimester(
            subjects.length ? subjects : orderedSubjects,
            trimesterVal
        ),
        data
    );

}

// Helper to get filtered subjects based on level exemption

function filterSubjectsForContext(level, baseSubjects, contextStudents = studentsData) {
    if (window.ExemptSubjectsHelper && typeof window.ExemptSubjectsHelper.filterSubjects === 'function') {
        return window.ExemptSubjectsHelper.filterSubjects(baseSubjects, {
            level,
            students: Array.isArray(contextStudents) ? contextStudents : studentsData,
            exemptSubjects
        });
    }

    return baseSubjects;
}

function getFilteredSubjects(level, baseSubjects) {
    const helperFilteredSubjects = filterSubjectsForContext(level, baseSubjects, studentsData);
    if (helperFilteredSubjects !== baseSubjects) return helperFilteredSubjects;

    const exempt = exemptSubjects;

    // Extract level number (1, 2, 3, 4) from level string (e.g., "السنة الأولى")

    let lvlKey = null;

    if (level.includes('1') || level.includes('أولى')) lvlKey = '1';

    if (level.includes('2') || level.includes('ثانية')) lvlKey = '2';

    if (level.includes('3') || level.includes('ثالثة')) lvlKey = '3';

    if (level.includes('4') || level.includes('رابعة')) lvlKey = '4';

    if (!lvlKey || !exempt[lvlKey]) return baseSubjects;

    const levelExemptions = exempt[lvlKey];

    const mapping = {

        'art': ['ت.تشكيلية', 'التربية التشكيلية', 'فنون تشكيلية', 'رسم'],

        'music': ['موسيقى', 'التربية الموسيقية'],

        'info': ['معلوماتية', 'اعلام الي', 'إعلام آلي'],

        'ama': ['أمازيغية', 'اللغة الأمازيغية', 'الأمازيغية', 'اللغة اﻷمازيغية', 'اﻷمازيغية']

    };

    return baseSubjects.filter(sub => {

        const normSub = normalizeArabic(sub);

        for (const [key, aliases] of Object.entries(mapping)) {

            if (levelExemptions.includes(key)) {

                if (aliases.some(alias => normSub.includes(normalizeArabic(alias)))) {

                    return false;

                }

            }

        }

        return true;

    });

}

// Load Data Function

// Load Data Function

// Load Data Function
async function loadData() {
    const rawStudentsPromise = DB.getResults(true);
    const metadataPromise = Promise.all([
        DB.get('exemptSubjects').catch(() => ({})),
        DB.getTeachers().catch(() => []),
        DB.get('classResponsibles').catch(() => ({})),
        DB.getSettings().catch(() => ({})),
        DB.get('signatureSettings').catch(() => ({})),
        DB.get(SECONDARY_MANUAL_DECISIONS_KEY).catch(() => ({}))
    ]);

    let rawStudentsData = await rawStudentsPromise || [];

    // Deduplicate Data & Pre-calculate Metadata
    const mergedStudents = new Map();
    studentsData = [];
    window.schoolHierarchy = {}; // Global cache for filters: { [year]: { [level]: { classes:Set, streams:Set } } }

    console.time('DataProcessing');
    for (const student of rawStudentsData) {
        const uniqueKey = getAnalysisIdentityKey(student);
        const normalizedStudent = Object.assign({}, student, {
            marks: Object.assign({}, student.marks || {}),
            averages: Object.assign({}, student.averages || {})
        });

        if (mergedStudents.has(uniqueKey)) {
            mergeAnalysisStudentRecords(mergedStudents.get(uniqueKey), normalizedStudent);
        } else {
            mergedStudents.set(uniqueKey, normalizedStudent);
        }
    }

    studentsData = Array.from(mergedStudents.values());

    studentsData.forEach(student => {
        const studentYear = getStudentYear(student);
        if (studentYear && student.level) {
            if (!window.schoolHierarchy[studentYear]) {
                window.schoolHierarchy[studentYear] = {};
            }
            if (!window.schoolHierarchy[studentYear][student.level]) {
                window.schoolHierarchy[studentYear][student.level] = { classes: new Set(), streams: new Set() };
            }
            if (student.class) window.schoolHierarchy[studentYear][student.level].classes.add(student.class);
            if (student.stream) window.schoolHierarchy[studentYear][student.level].streams.add(student.stream);
        }
    });
    console.timeEnd('DataProcessing');

    // Clear caches when loading new data
    scoreCache.clear();
    statsCache.clear();

    [
        exemptSubjects,
        teachersList,
        classResponsibles,
        institutionSettings,
        signatureSettings,
        secondaryManualDecisions
    ] = await metadataPromise;

    exemptSubjects = exemptSubjects || {};
    teachersList = teachersList || [];
    classResponsibles = classResponsibles || {};
    institutionSettings = institutionSettings || {};
    signatureSettings = signatureSettings || {};
    secondaryManualDecisions = secondaryManualDecisions || {};

    if (studentsData.length > 0) {
        console.log("تم تحميل البيانات من التخزين المحلي:", studentsData.length, "سجل (بعد إزالة التكرار)");

        subjects = collectSubjectsFromStudents(studentsData);
        if (!subjects.length) {
            subjects = orderedSubjects; // Fallback
        }
    } else {
        subjects = orderedSubjects;
    }
}

/**

 * Get class responsible teacher name

 * @param {string} level - The level (e.g., 'أولى' or 'أولى متوسط')

 * @param {string} classNum - The class number (e.g., '1' or '01')

 * @returns {string} Teacher name or empty string if not assigned

 */

function getClassResponsibleName(level, classNum, stream = null) {
    if (!classResponsibles || Object.keys(classResponsibles).length === 0) return '';
    
    let teacherId = null;
    const normLevel = normalizeLevelKeyForMatching(level);
    const normStream = stream ? normalizeArabic(stream).replace(/\s+/g, '') : null;
    const cleanClassNum = String(classNum).replace(/^0+/, '');

    // 1. Direct Try with various formats
    const trialKeys = [
        `${level}_${stream ? stream + '_' : ''}${classNum}`,
        `${level}_${stream ? stream + '_' : ''}${cleanClassNum}`
    ];
    
    for (const tk of trialKeys) {
        if (classResponsibles[tk]) {
            teacherId = classResponsibles[tk];
            break;
        }
    }

    // 2. Robust Fallback: Fuzzy matching
    if (!teacherId) {
        const allKeys = Object.keys(classResponsibles);
        for (const key of allKeys) {
            const keyParts = key.split('_');
            if (keyParts.length < 2) continue;

            const kLevel = keyParts[0];
            const kClass = keyParts[keyParts.length - 1];
            const kStream = keyParts.length > 2 ? keyParts.slice(1, keyParts.length - 1).join('_') : null;

            const matchLevel = normalizeLevelKeyForMatching(kLevel) === normLevel;
            const matchClass = String(kClass).replace(/^0+/, '') === cleanClassNum;
            
            let matchStream = true;
            if (stream || kStream) {
                const normKStream = kStream ? normalizeArabic(kStream).replace(/\s+/g, '') : '';
                const normCurrentStream = normStream || '';
                matchStream = normKStream === normCurrentStream || normKStream.includes(normCurrentStream) || normCurrentStream.includes(normKStream);
            }

            if (matchLevel && matchClass && matchStream) {
                teacherId = classResponsibles[key];
                break;
            }
        }
    }

    if (!teacherId) return '';
    const teacher = teachersList.find(t => t.id === teacherId);
    return teacher ? `${teacher.last_name} ${teacher.first_name}` : '';
}

/**
 * Internal helper for fuzzy level matching
 */
function normalizeLevelKeyForMatching(levelStr) {
    if (!levelStr) return '';
    let s = normalizeArabic(levelStr).replace(/\s+/g, '');
    s = s.replace(/السنة/g, '');
    s = s.replace(/متوسط/g, '');
    s = s.replace(/ثانوي/g, '');
    s = s.replace(/أولى|1/g, '1');
    s = s.replace(/ثانية|2/g, '2');
    s = s.replace(/ثالثة|3/g, '3');
    s = s.replace(/رابعة|4/g, '4');
    return s;
}

// عند تحميل الصفحة

document.addEventListener('DOMContentLoaded', async () => {

    await loadData();

    // Fill Dropdowns initially

    populateFilters();

    // Event Listeners

    document.getElementById('trimesterSelect').addEventListener('change', applyFilters);

    const directedBirthYearQuickInput = document.getElementById('directedBirthYearQuickInput');
    if (directedBirthYearQuickInput) {
        directedBirthYearQuickInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                saveDirectedBirthYearQuickSetting();
            }
        });
    }

    document.getElementById('yearSelect').addEventListener('change', () => {
        populateFilters();
        applyFilters();
    });
    document.getElementById('levelSelect').addEventListener('change', () => {

        populateStreams(); // New logic

        populateClassDropdown();

        applyFilters();

    });

    document.getElementById('streamSelect').addEventListener('change', () => {

        populateClassDropdown();

        applyFilters();

    });

    document.getElementById('classSelect').addEventListener('change', () => {

        updateClassResponsibleDisplay();

        applyFilters();

    });

    applyFilters(); // Render initial state (all)

    // Render Icons

    if (typeof IconManager !== 'undefined') IconManager.render();

});

// Populate Level and Class Dropdowns based on Data

// Populate Level and Class Dropdowns based on Data
function populateFilters() {
    const levelSelect = document.getElementById('levelSelect');
    const yearSelect = document.getElementById('yearSelect');
    if (!levelSelect || !yearSelect) return;

    // Standardize Years
    const years = new Set();
    studentsData.forEach(s => {
        const y = getStudentYear(s);
        if (y) years.add(y);
    });
    const sortedYears = [...years].sort((a, b) => b.localeCompare(a));

    if (yearSelect.options.length === 0) {
        yearSelect.innerHTML = '';
        sortedYears.forEach(y => {
            yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
        });
        if (sortedYears.length > 0) yearSelect.value = sortedYears[0];
    }

    const selectedYear = yearSelect.value;
    const yearHierarchy = window.schoolHierarchy && window.schoolHierarchy[selectedYear]
        ? window.schoolHierarchy[selectedYear]
        : null;

    // Standardize Levels based on Year
    const levels = yearHierarchy
        ? Object.keys(yearHierarchy).filter(Boolean).sort()
        : [...new Set(studentsData.filter(s => getStudentYear(s) === selectedYear).map(s => s.level))].filter(l => l).sort();

    levelSelect.innerHTML = '';
    levels.forEach(l => {
        const label = l.replace(' متوسط', '');
        levelSelect.innerHTML += `<option value="${l}">${label}</option>`;
    });

    if (levels.length > 0) {
        levelSelect.value = levels[0];
    }

    populateStreams();
    populateClassDropdown();
}

function populateStreams() {
    const levelSelect = document.getElementById('levelSelect').value;
    const streamSelect = document.getElementById('streamSelect');
    const streamGroup = document.getElementById('streamGroup');
    const stage = institutionSettings.educationStage || 'middle';
    const selectedYear = document.getElementById('yearSelect') ? document.getElementById('yearSelect').value : '';
    const yearHierarchy = window.schoolHierarchy && window.schoolHierarchy[selectedYear]
        ? window.schoolHierarchy[selectedYear]
        : {};

    if (stage === 'secondary') {
        streamGroup.style.display = 'flex';
        streamSelect.innerHTML = '';

        // Optimization: Use hierarchy or SubjectManager
        let availableStreams = [];

        if (yearHierarchy && yearHierarchy[levelSelect]) {
            availableStreams = Array.from(yearHierarchy[levelSelect].streams || []);
        } else {
            // Fallback
            availableStreams = SubjectManager.getStreams(levelSelect);
        }

        // Filter SubjectManager streams to only those present in data?
        // Or just use data streams? Using data streams is safer for "what exists".
        // But SubjectManager has the codes.

        // Let's use SubjectManager for definitions, but filtered by what's actually in data if possible.
        // For now, let's Stick to SubjectManager for canonical order/names, but maybe filter?
        // Actually, previous logic just showed ALL streams for that level defined in SubjectManager.
        // Let's keep it simple: Show what SubjectManager says, as it maps codes to Names.

        const streams = availableStreams.length > 0 ? availableStreams : SubjectManager.getStreams(levelSelect);

        streams.forEach(code => {
            // Optional: Check if this stream actually exists in data?
            // const exists = window.schoolHierarchy[levelSelect]?.streams.has(code);
            // if (!exists) return;

            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = SubjectManager.getStreamName(code);
            streamSelect.appendChild(opt);
        });

    } else {
        streamGroup.style.display = 'none';
        streamSelect.innerHTML = '';
    }
}

function populateClassDropdown() {
    console.time('PopulateClassDropdown');
    const levelSelect = document.getElementById('levelSelect').value;
    const classSelect = document.getElementById('classSelect');
    const selectedYear = document.getElementById('yearSelect') ? document.getElementById('yearSelect').value : '';

    classSelect.innerHTML = '';

    // ADDED: Filter by Stream if Secondary
    const stage = institutionSettings.educationStage || 'middle';
    let classesToRender = [];

    const yearHierarchy = window.schoolHierarchy && window.schoolHierarchy[selectedYear]
        ? window.schoolHierarchy[selectedYear]
        : {};

    if (yearHierarchy && yearHierarchy[levelSelect]) {
        // Use optimized hierarchy
        if (stage === 'secondary') {
            const streamSelect = document.getElementById('streamSelect');
            const selectedStream = streamSelect ? streamSelect.value : '';

            if (selectedStream) {
                // Logic to filter classes by stream is tricky with just Level -> Classes Set
                // We need to know which class belongs to which stream.
                // The hierarchy I built was { classes: Set, streams: Set } which loses the link between class and stream.
                // So for Secondary with streams, we might still need to filter students OR build a better hierarchy.

                // Fallback to filtering if stream is selected, OR improved hierarchy in loadData?
                // Let's stick to filtering for secondary+stream for safety/accuracy now,
                // BUT optimize it:
                // We can traverse studentsData? Or just filter relevantStudents like before.

                // Given the previous code filtered studentsData, let's keep that for secondary-stream precision
                // UNLESS we update loadData to map Stream -> Classes.

                let relevantStudents = studentsData.filter(s => getStudentYear(s) === selectedYear && s.level == levelSelect && s.stream === selectedStream);
                classesToRender = [...new Set(relevantStudents.map(s => s.class))].filter(c => c).sort();

            } else {
                classesToRender = Array.from(yearHierarchy[levelSelect].classes || []).sort();
            }
        } else {
            // Middle school or no stream selected
            classesToRender = Array.from(yearHierarchy[levelSelect].classes || []).sort();
        }
    } else {
        // Fallback
        let relevantStudents = studentsData.filter(s => (!selectedYear || getStudentYear(s) === selectedYear) && s.level == levelSelect);
        if (stage === 'secondary') {
            const streamSelect = document.getElementById('streamSelect');
            const selectedStream = streamSelect ? streamSelect.value : '';
            if (selectedStream) {
                relevantStudents = relevantStudents.filter(s => s.stream === selectedStream);
            }
        }
        classesToRender = [...new Set(relevantStudents.map(s => s.class))].filter(c => c).sort();
    }

    classesToRender.forEach(sec => {
        classSelect.innerHTML += `<option value="${sec}">${sec}</option>`;
    });

    updateClassResponsibleDisplay();
    console.timeEnd('PopulateClassDropdown');
}

/**

 * Update the class responsible teacher name display

 */

function updateClassResponsibleDisplay() {
    const selectedLevel = document.getElementById('levelSelect').value;
    const selectedClass = document.getElementById('classSelect').value;

    // Get stream if visible (secondary stage)
    const streamSelect = document.getElementById('streamSelect');
    const selectedStream = (streamSelect && streamSelect.parentElement.style.display !== 'none') ? streamSelect.value : null;

    const responsibleName = getClassResponsibleName(selectedLevel, selectedClass, selectedStream);
    const displayEl = document.getElementById('classResponsibleDisplay');

    if (displayEl) {
        if (responsibleName) {
            displayEl.innerHTML = `${IconManager.get('teacher')} ${responsibleName}`;
        } else {
            displayEl.innerHTML = '';
        }
    }
}

// Trimester Mapping

const trimesterMap = {

    '1': 'الأول',

    '2': 'الثاني',

    '3': 'الثالث',

    'annual': 'السنوي'

};

function stripTrimesterSuffix(subjectName) {

    return String(subjectName || '')
        .replace(/\s*(?:فصل|ف)\s*[123]\s*$/g, '')
        .trim();

}

function getSubjectsForTrimester(baseSubjects, selectedTrimesterVal) {

    const safeSubjects = Array.isArray(baseSubjects) ? baseSubjects.filter(Boolean) : [];

    const filteredSubjects = safeSubjects.filter(subjectName => {
        if (selectedTrimesterVal === 'annual') {
            return true;
        }

        const normSub = normalizeArabic(subjectName);
        const otherTrimesters = ['1', '2', '3'].filter(t => t !== selectedTrimesterVal);

        for (const t of otherTrimesters) {
            const pattern1 = new RegExp(`ف\\s*${t}(\\s|$)`);
            const pattern2 = new RegExp(`فصل\\s*${t}(\\s|$)`);

            if (pattern1.test(normSub) || pattern2.test(normSub)) {
                return false;
            }
        }

        return true;
    });

    const seen = new Set();

    return filteredSubjects.reduce((result, subjectName) => {
        const baseName = stripTrimesterSuffix(subjectName);
        const normalizedBase = normalizeArabic(baseName);

        if (!normalizedBase || seen.has(normalizedBase)) {
            return result;
        }

        seen.add(normalizedBase);
        result.push(baseName);
        return result;
    }, []);

}

function shouldShowDirectedBirthYearQuickPanel() {
    const trimesterSelect = document.getElementById('trimesterSelect');
    const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '';
    return selectedTrimesterVal === '3' || selectedTrimesterVal === 'annual';
}

function syncDirectedBirthYearQuickPanel() {
    const panel = document.getElementById('directedBirthYearQuickPanel');
    const input = document.getElementById('directedBirthYearQuickInput');
    const currentBadge = document.getElementById('directedBirthYearQuickCurrent');
    const note = document.getElementById('directedBirthYearQuickNote');
    const title = document.getElementById('directedBirthYearQuickTitle');
    const controls = document.getElementById('directedBirthYearQuickControls');
    if (!panel || !input || !currentBadge || !note || !title || !controls) return;

    const shouldShow = shouldShowDirectedBirthYearQuickPanel();
    panel.style.display = shouldShow ? 'block' : 'none';
    if (!shouldShow) return;
    const stage = (institutionSettings || {}).educationStage || 'middle';
    const isSecondary = stage === 'secondary';

    if (isSecondary) {
        title.textContent = 'ملاحظة حول قرار يوجّه';
        note.textContent = 'يمكن تحديد قرار يوجّه للتلميذ يدويا من عمود القرار، وسيتم حفظ الاختيار لاستخدامه لاحقا.';
        controls.style.display = 'none';
        return;
    }

    title.textContent = 'سنة ميلاد الموجَّهين';
    controls.style.display = 'flex';

    const currentYear = parseInt((institutionSettings || {}).directedBirthYear, 10);
    const currentLabel = Number.isFinite(currentYear) ? String(currentYear) : 'غير محددة';

    if (document.activeElement !== input) {
        input.value = Number.isFinite(currentYear) ? String(currentYear) : '';
    }

    currentBadge.textContent = `الحالية: ${currentLabel}`;
    note.textContent = Number.isFinite(currentYear)
        ? `يوجَّه من كان مولودًا في ${currentYear} أو قبلها.`
        : 'أدخل سنة الميلاد المعتمدة لتحديد قرار يوجَّه.';
}

async function saveDirectedBirthYearQuickSetting() {
    const input = document.getElementById('directedBirthYearQuickInput');
    if (!input) return;

    const rawValue = String(input.value || '').trim();
    const parsedYear = parseInt(rawValue, 10);
    const currentYear = new Date().getFullYear();

    if (!rawValue || !Number.isFinite(parsedYear) || parsedYear < 1900 || parsedYear > currentYear) {
        if (typeof showToast === 'function') {
            showToast(`يرجى إدخال سنة صحيحة بين 1900 و${currentYear}`, 'error');
        }
        input.focus();
        input.select();
        return;
    }

    if (!window.DB || typeof DB.getSettings !== 'function' || typeof DB.saveSettings !== 'function') {
        if (typeof showToast === 'function') {
            showToast('تعذر الوصول إلى إعدادات المؤسسة لحفظ سنة الميلاد', 'error');
        }
        return;
    }

    const saveButton = document.querySelector('#directedBirthYearQuickPanel button');

    try {
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = 'جارٍ الحفظ...';
        }

        const nextSettings = {
            ...(await DB.getSettings() || institutionSettings || {}),
            directedBirthYear: parsedYear
        };

        await DB.saveSettings(nextSettings);
        institutionSettings = nextSettings;
        syncDirectedBirthYearQuickPanel();

        if (typeof showToast === 'function') {
            showToast('تم حفظ سنة ميلاد الموجَّهين بنجاح', 'success');
        }

        applyFilters();
    } catch (error) {
        console.error('Failed to save directed birth year from class analysis page:', error);
        if (typeof showToast === 'function') {
            showToast('تعذر حفظ سنة ميلاد الموجَّهين', 'error');
        }
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'حفظ';
        }
    }
}

function normalizeSecondaryManualDecisionCode(value) {
    const normalizedValue = normalizeArabic(String(value || ''))
        .replace(/\s+/g, '')
        .toLowerCase();
    if (!normalizedValue) return '';
    if (normalizedValue === 'directed' || normalizedValue.includes('وجه')) return 'directed';
    if (normalizedValue === 'repeated' || normalizedValue.includes('عيد')) return 'repeated';
    return '';
}

function getSecondaryManualDecisionStorageKey(student) {
    const academicYear = normalizeArabic(getStudentYear(student) || '').replace(/\s+/g, '');
    const rawId = String(student && (student.id || student.student_id || '') || '').trim();
    if (rawId) {
        return ['secondary', academicYear, rawId].join('|');
    }
    const fallbackParts = [
        student && student.name,
        student && student.dob,
        student && student.level,
        student && student.class,
        student && student.stream
    ].map(function (value) {
        return normalizeArabic(String(value || '')).replace(/\s+/g, '');
    });
    return ['secondary', academicYear].concat(fallbackParts).join('|');
}

function getSecondaryManualDecisionLabel(decisionCode) {
    return decisionCode === 'directed' ? 'يوجّه' : 'يعيد';
}

function getSecondaryManualDecisionColor(decisionCode) {
    return decisionCode === 'directed' ? '#7f8c8d' : '#c0392b';
}

function getSavedSecondaryManualDecision(student) {
    const storageKey = getSecondaryManualDecisionStorageKey(student);
    const savedCode = normalizeSecondaryManualDecisionCode(secondaryManualDecisions[storageKey]);
    if (savedCode) {
        return { storageKey: storageKey, decisionCode: savedCode };
    }
    const importedCode = normalizeSecondaryManualDecisionCode(student && student.decision);
    if (importedCode) {
        return { storageKey: storageKey, decisionCode: importedCode };
    }
    return { storageKey: storageKey, decisionCode: 'repeated' };
}

function applySecondaryManualDecisionLocally(storageKey, decisionCode) {
    if (!storageKey) return;
    const decisionLabel = getSecondaryManualDecisionLabel(decisionCode);
    studentsData.forEach(function (student) {
        if (getSecondaryManualDecisionStorageKey(student) === storageKey) {
            student.decision = decisionLabel;
        }
    });
}

async function saveSecondaryStudentDecisionFromClassAnalysis(storageKey, nextDecisionCode) {
    const normalizedCode = normalizeSecondaryManualDecisionCode(nextDecisionCode);
    if (!storageKey || !normalizedCode) return false;

    if (!window.DB || typeof DB.set !== 'function') {
        if (typeof showToast === 'function') {
            showToast('تعذر حفظ قرار التوجيه اليدوي', 'error');
        }
        return false;
    }

    try {
        secondaryManualDecisions = Object.assign({}, secondaryManualDecisions, {
            [storageKey]: normalizedCode
        });
        await DB.set(SECONDARY_MANUAL_DECISIONS_KEY, secondaryManualDecisions);
        applySecondaryManualDecisionLocally(storageKey, normalizedCode);
        applyFilters();
        return true;
    } catch (error) {
        console.error('Failed to save manual secondary decision from class analysis page:', error);
        if (typeof showToast === 'function') {
            showToast('تعذر حفظ قرار التوجيه اليدوي', 'error');
        }
        return false;
    }
}

function applyFilters() {

    const selectedLevel = document.getElementById('levelSelect').value;

    const selectedClass = document.getElementById('classSelect').value;

    const selectedTrimesterVal = document.getElementById('trimesterSelect').value;
    syncDirectedBirthYearQuickPanel();

    // Handle empty trimester selection
    if (!selectedTrimesterVal) {
        document.getElementById('generalStatsBody').innerHTML = '';
        document.getElementById('subjectStatsBody').innerHTML = '';
        const detailedTableBody = document.getElementById('detailedTableBody');
        if (detailedTableBody) detailedTableBody.innerHTML = '<tr><td colspan="20" style="text-align:center; padding: 20px; font-size: 1.1em; color: #7f8c8d;">الرجاء اختيار الفصل الدراسي لعرض النتائج</td></tr>';

        const decisionContainer = document.getElementById('decisionStatsContainer');
        if (decisionContainer) decisionContainer.style.display = 'none';

        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        return;
    }

    const selectedTrimesterName = trimesterMap[selectedTrimesterVal];

    // Relaxed Validation: We allow mismatch to support reading "F1" columns from a "F3" file.

    if (studentsData && studentsData.length > 0) {

        // We no longer block execution here.

        // The logic in getSubjectScore will handle finding the right columns.

    }

    // Optimization: Clear caches when filter changes
    scoreCache.clear();
    statsCache.clear();

    const selectedStream = document.getElementById('streamSelect').value;

    const selectedYear = document.getElementById('yearSelect') ? document.getElementById('yearSelect').value : null;

    console.time('FilterLogic');
    const filteredData = studentsData.filter(s => {
        const matchYear = selectedYear ? (getStudentYear(s) === selectedYear) : true;
        const matchLevel = s.level == selectedLevel;
        const matchClass = s.class == selectedClass;
        const matchStream = selectedStream ? (s.stream === selectedStream) : true;
        return matchYear && matchLevel && matchClass && matchStream;
    });
    console.timeEnd('FilterLogic');

    // Dynamic Subject Loading based on the actual filtered records
    const stage = institutionSettings.educationStage || 'middle';
    const filteredByTrimester = getAvailableSubjectsForSelection(filteredData, {
        stage: stage,
        level: selectedLevel,
        stream: selectedStream,
        trimesterVal: selectedTrimesterVal
    });

    renderDashboard(filteredData, filteredByTrimester);

}

function showNotification(msg, type) {

    showToast(msg, type);

}

function showToast(message, type = 'success') {

    const container = document.getElementById('toastContainer');

    const toast = document.createElement('div');

    toast.className = `toast ${type}`;

    const icon = type === 'error' ? IconManager.get('warning') : IconManager.get('sparkles');

    toast.innerHTML = `

        <span class="toast-icon">${icon}</span>

        <span class="toast-text">${message}</span>

    `;

    container.appendChild(toast);

    // Force reflow

    toast.offsetHeight;

    // Show

    toast.classList.add('show');

    // Hide and remove after 3 seconds

    setTimeout(() => {

        toast.classList.remove('show');

        setTimeout(() => {

            toast.remove();

        }, 500);

    }, 4000);

}

function hasDataForTrimester(data, trimesterVal) {
    if (!data || data.length === 0) return false;
    if (trimesterVal === 'annual') {
        return data.some(s => hasAnnualAverageData(s) || hasAnnualMarksData(s));
    }
    const trimesterMap = { '1': 'الأول', '2': 'الثاني', '3': 'الثالث' };
    const expectedTrimesterName = trimesterMap[trimesterVal];

    return data.some(s => {
        if (s.trimester === expectedTrimesterName || s.trimester === trimesterVal) return true;
        if (s.averages && s.averages[trimesterVal] !== undefined && s.averages[trimesterVal] !== null) return true;

        if (s.marks) {
            const keys = Object.keys(s.marks);
            const pattern1 = new RegExp(`ف\\s*${trimesterVal}(\\s|$)`);
            const pattern2 = new RegExp(`فصل\\s*${trimesterVal}(\\s|$)`);
            if (keys.some(k => pattern1.test(normalizeArabic(k)) || pattern2.test(normalizeArabic(k)))) return true;
        }
        return false;
    });
}

function findAlternativeYearsForCurrentSelection(trimesterVal) {

    const currentYear = document.getElementById('yearSelect') ? document.getElementById('yearSelect').value : '';
    const selectedLevel = document.getElementById('levelSelect') ? document.getElementById('levelSelect').value : '';
    const selectedClass = document.getElementById('classSelect') ? document.getElementById('classSelect').value : '';
    const selectedStream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : '';
    const years = new Set();

    studentsData.forEach(student => {
        const studentYear = getStudentYear(student);
        if (!studentYear || studentYear === currentYear) return;
        if (selectedLevel && student.level != selectedLevel) return;
        if (selectedClass && selectedClass !== 'all' && student.class != selectedClass) return;
        if (selectedStream && student.stream !== selectedStream) return;
        if (hasDataForTrimester([student], trimesterVal)) {
            years.add(studentYear);
        }
    });

    return Array.from(years).sort((a, b) => b.localeCompare(a));

}

function renderDashboard(data, explicitSubjects = null) {

    const selectedLevel = document.getElementById('levelSelect').value;

    const filteredSubjects = filterSubjectsForContext(
        selectedLevel,
        explicitSubjects !== null ? explicitSubjects : subjects,
        data
    );
    const filteredOrderedSubjects = filterSubjectsForContext(
        selectedLevel,
        explicitSubjects !== null ? explicitSubjects : orderedSubjects,
        data
    );

    const trimesterSelect = document.getElementById('trimesterSelect');
    const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';

    if (!hasDataForTrimester(data, selectedTrimesterVal)) {
        const alternativeYears = findAlternativeYearsForCurrentSelection(selectedTrimesterVal);
        const noDataMessage = alternativeYears.length > 0
            ? `لا توجد بيانات لهذا الفصل في السنة المختارة. تتوفر بيانات في: ${alternativeYears.join('، ')}`
            : 'لا توجد بيانات مستوردة لهذا الفصل';

        document.getElementById('generalStatsBody').innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #e74c3c;">${noDataMessage}</td></tr>`;
        document.getElementById('subjectStatsBody').innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #e74c3c;">${noDataMessage}</td></tr>`;
        document.getElementById('gradeDistributionBody').innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 20px; color: #e74c3c;">لا توجد بيانات</td></tr>';
        const tbl = document.getElementById('detailedTableBody');
        if (tbl) tbl.innerHTML = `<tr><td colspan="20" style="text-align:center; padding: 30px; color: #e74c3c;">${noDataMessage}</td></tr>`;

        const decisionContainer = document.getElementById('decisionStatsContainer');
        if (decisionContainer) decisionContainer.style.display = 'none';

        const chartWrapper = document.getElementById('subjectsChart');
        if (chartWrapper) chartWrapper.style.display = 'none';

        return;
    }

    const chartWrapper = document.getElementById('subjectsChart');
    if (chartWrapper) chartWrapper.style.display = 'block';

    renderGeneralStats(data);

    updateDecisionStats(data); // Update Decision Stats (T3 Only)

    renderGradeDistribution(data);

    renderSubjectStats(data, filteredSubjects);

    console.time('RenderHeavy');
    // Defer heavy rendering to allow UI to update first
    setTimeout(() => {
        renderDetailedTable(data, filteredOrderedSubjects);
        initChart(data, filteredSubjects);
        console.timeEnd('RenderHeavy');
    }, 10);

}

// 2. دوال التحليل والحساب

// جدول التعداد العام

function legacyRenderGeneralStats(data = studentsData) {

    const tbody = document.getElementById('generalStatsBody');

    const total = data.length;

    // تصنيف حسب الجنس

    const males = data.filter(s => s.gender === 'ذكر');

    const females = data.filter(s => s.gender === 'أنثى');

    const stats = [

        { label: 'ذكور', data: males },

        { label: 'إناث', data: females },

        { label: 'المجموع', data: data }

    ];

    let html = '';

    stats.forEach(row => {

        const count = row.data.length;

        const avg = (s) => getStudentAverage(s);

        const passed = row.data.filter(s => avg(s) >= 10).length;

        const failed = count - passed;

        const rate = count > 0 ? ((passed / count) * 100).toFixed(2) : 0;

        html += `

            <tr>

                <td>${row.label}</td>

                <td>${count}</td>

                <td class="high-score">${passed}</td>

                <td class="low-score">${failed}</td>

                <td>${rate}%</td>

            </tr>

        `;

    });

    tbody.innerHTML = html;

}

// جدول توزيع المعدلات

function legacyRenderGradeDistribution(data = studentsData) {

    const ranges = [

        { label: '00 - 09.99', min: 0, max: 9.99 },

        { label: '10 - 11.99', min: 10, max: 11.99 },

        { label: '12 - 13.99', min: 12, max: 13.99 },

        { label: '14 - 15.99', min: 14, max: 15.99 },

        { label: '16 - 17.99', min: 16, max: 17.99 },

        { label: '18 - 20.00', min: 18, max: 20 }

    ];

    const tbody = document.getElementById('gradeDistributionBody');

    let html = '';

    ranges.forEach(range => {

        const count = data.filter(s => {

            const avg = getStudentAverage(s);

            return avg >= range.min && avg <= range.max;

        }).length;

        html += `

            <tr>

                <td>${range.label}</td>

                <td>${count}</td>

            </tr>

        `;

    });

    tbody.innerHTML = html;

}

// جدول نتائج المواد (يستخدم subjects الديناميكية للحفاٍ على الأسماء الأصلية)

function legacyRenderSubjectStats(data = studentsData, activeSubjects = subjects) {

    const tbody = document.getElementById('subjectStatsBody');

    let html = '';

    // If subjects list is empty (no marks found), show something

    if (!subjects || subjects.length === 0) {

        html = '<tr><td colspan="5">لا توجد مواد متاحة</td></tr>';

        tbody.innerHTML = html;

        return;

    }

    // Determine Previous Trimester
    const trimesterSelect = document.getElementById('trimesterSelect');
    const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';
    let prevTrimesterVal = null;
    let prevTrimesterName = '';

    if (selectedTrimesterVal === '2') {
        prevTrimesterVal = '1';
        prevTrimesterName = 'الفصل الأول';
    } else if (selectedTrimesterVal === '3') {
        prevTrimesterVal = '2';
        prevTrimesterName = 'الفصل الثاني';
    }

    // Pre-calculate stats for previous trimester ONCE
    if (prevTrimesterVal && !statsCache.has(`stats_${prevTrimesterVal}`)) {
        // Calculate and cache stats for ALL subjects for prev trimester
        const prevStats = {};

        // we need unique list of all potential subjects
        const allSubjects = [...new Set([...subjects, ...Object.keys(subjectAliases)])];

        allSubjects.forEach(sub => {
            // Calculate for this subject
            const scores = data.map(s => getSubjectScore(s, sub, prevTrimesterVal)).filter(m => m !== null && m !== undefined);
            if (scores.length > 0) {
                const passed = scores.filter(m => m >= 10).length;
                const rate = ((passed / scores.length) * 100).toFixed(2);
                prevStats[sub] = rate;
            }
        });
        statsCache.set(`stats_${prevTrimesterVal}`, prevStats);
    }

    // Helper to calculate previous rate efficiently (Using Cache)
    const getPrevRate = (sub) => {
        if (!prevTrimesterVal) return null;

        const cachedStats = statsCache.get(`stats_${prevTrimesterVal}`);
        if (cachedStats && cachedStats[sub] !== undefined) {
            return cachedStats[sub];
        }

        return null;
    };

    activeSubjects.forEach(sub => {

        // Handle potentially missing marks safely by using fuzzy match helper

        // Use currently selected trimester

        const trimesterSelect = document.getElementById('trimesterSelect');

        const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';

        const scores = data.map(s => getSubjectScore(s, sub, selectedTrimesterVal)).filter(m => m !== null && m !== undefined);

        // Show/Hide Comparison Header
        const prevRateHeader = document.getElementById('prevRateHeader');
        if (prevRateHeader) {
            prevRateHeader.style.display = prevTrimesterVal ? 'table-cell' : 'none';
        }

        const currentRateHeader = document.getElementById('currentRateHeader');
        if (currentRateHeader) {
            currentRateHeader.textContent = selectedTrimesterVal !== '1' ? `نسبة ف${selectedTrimesterVal}` : 'نسبة النجاح';
        }

        if (scores.length === 0) {

            html += `<tr><td>${sub}</td><td colspan="${prevTrimesterVal ? 5 : 4}">-</td></tr>`;

            return;

        }

        const passed = scores.filter(s => s >= 10).length;

        const failed = scores.length - passed;

        const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);

        const rate = ((passed / scores.length) * 100).toFixed(2);

        const rateColor = rate < 50 ? 'color: red; font-weight: bold;' : 'color: green;';

        // Tooltip Data

        let tooltipAttr = '';
        let trendIcon = '';
        let prevRateHtml = '';

        if (prevTrimesterVal) {

            const prevRate = getPrevRate(sub);

            // Default empty cell if comparison is active but no data
            prevRateHtml = '<td>-</td>';

            if (prevRate !== null) {

                tooltipAttr = `onmouseenter="showTooltip(event, '${prevTrimesterName}', '${prevRate}%')" onmousemove="moveTooltip(event)" onmouseleave="hideTooltip()"`;

                // Add Trend Arrow
                if (parseFloat(rate) > parseFloat(prevRate)) {
                    trendIcon = '&nbsp;<span style="color:#27ae60; font-size:1em;">▲</span>';
                } else if (parseFloat(rate) < parseFloat(prevRate)) {
                    trendIcon = '&nbsp;<span style="color:#c0392b; font-size:1em;">▼</span>';
                }

                prevRateHtml = `<td style="background-color: #ecf0f1; font-weight: bold; font-size: 1.05em; border-right: 1px dashed #ccc;">${prevRate}%</td>`;

            }

        }

        html += `
            <tr ${tooltipAttr} style="cursor: help;">
                <td>${sub}</td>
                <td>${passed}</td>
                <td>${failed}</td>
                <td>${avg}</td>
                ${prevRateHtml}
                <td style="${rateColor}">${rate}%${trendIcon}</td>
            </tr>
        `;

    });

    tbody.innerHTML = html;

}

// Tooltip Helpers

let tooltipEl = null;

function createTooltip() {

    if (!tooltipEl) {

        tooltipEl = document.createElement('div');

        tooltipEl.className = 'stats-tooltip';

        document.body.appendChild(tooltipEl);

    }

}

function showTooltip(e, title, value) {

    createTooltip();

    tooltipEl.innerHTML = `<strong>${title}</strong>نسبة النجاح: ${value}`;

    tooltipEl.classList.add('visible');

    moveTooltip(e);

}

function moveTooltip(e) {

    if (tooltipEl) {

        const x = e.clientX + 15;

        const y = e.clientY + 15;

        tooltipEl.style.left = `${x}px`;

        tooltipEl.style.top = `${y}px`;

    }

}

function hideTooltip() {

    if (tooltipEl) {

        tooltipEl.classList.remove('visible');

    }

}

// القائمة التفصيلية (تستخدم الـ subjects المفلترة)

function renderDetailedTable(data = studentsData, activeOrderedSubjects = orderedSubjects) {

    // Sort by dynamic average (getStudentAverage) instead of raw property

    const sortedData = [...data].sort((a, b) => getStudentAverage(b) - getStudentAverage(a));

    renderRows(sortedData, activeOrderedSubjects);

}

// Helper to normalize Arabic text (Ignore Hamza, Taa Marbuta/Ha, Ya/Alif Maqsura)

function normalizeArabic(text) {

    if (!text) return "";

    return text.toString()
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ﻷ|ﻹ|ﻵ|ﻻ/g, 'لا')
        .replace(/لأ|لإ|لآ/g, 'لا')
        .replace(/\s+/g, ' ');

}

// Cached getSubjectScore
function _orig_getSubjectScore(student, targetSub, overrideTrimester = null) {
    if (!student.marks) return null;

    // Determine Context Trimester
    const trimesterSelect = document.getElementById('trimesterSelect');
    // If overrideTrimester is provided, use it (e.g. for calculating prev stats), otherwise use UI
    const selectedTrimesterVal = overrideTrimester || (trimesterSelect ? trimesterSelect.value : '1');

    // Create Cache Key
    const studentId = student.id || student.name; // Use ID or Name as unique identifier
    const cacheKey = `${studentId}_${normalizeArabic(targetSub)}_${selectedTrimesterVal}`;

    // Check Cache
    if (scoreCache.has(cacheKey)) {
        return scoreCache.get(cacheKey);
    }

    // --- Existing Logic Start ---

    // Clean targetSub from any existing trimester suffixes (e.g., if it came from a "Subject F2" header)
    const baseTargetSub = targetSub.replace(/(فصل|ف)\s*[123](\s|$)/g, '').trim();

    // Get the file's native trimester (what trimester was this file imported as?)
    // This helps us decide if "Math" (no suffix) means T1, T2, or T3.
    const fileTrimesterName = student.trimester;
    let fileTrimesterVal = '1';
    if (fileTrimesterName === 'الثاني') fileTrimesterVal = '2';
    else if (fileTrimesterName === 'الثالث') fileTrimesterVal = '3';

    const normTarget = normalizeArabic(baseTargetSub);
    const keys = Object.keys(student.marks);

    // 1. Priority: Look for explicit suffix match for the SELECTED trimester (e.g. "Subject F2" if T2 selected)
    const tPattern1 = new RegExp(`ف\\s*${selectedTrimesterVal}(\\s|$)`);
    const tPattern2 = new RegExp(`فصل\\s*${selectedTrimesterVal}(\\s|$)`);

    let bestMatchKey = keys.find(k => {
        const normKey = normalizeArabic(k);

        // OPTIMIZATION: Check loose match only if basic characters match first?
        // No, string includes is fast enough.

        const isSubjectMatch = (normKey.includes(normTarget) ||
            (subjectAliases[baseTargetSub] && subjectAliases[baseTargetSub].some(alias => normKey.includes(normalizeArabic(alias))))) &&
            !['فيزيائية', 'تكنولوجيا', 'اسلامية', 'إسلامية', 'شرعية', 'انسانية', 'اجتماعية'].some(ex => (baseTargetSub.includes('طبيعية') || baseTargetSub === 'علوم') && normKey.includes(normalizeArabic(ex))) &&
            !['فنية', 'تشكيلية', 'فنون', 'رسم'].some(ex => (baseTargetSub === 'رياضة' || baseTargetSub === 'تربية بدنية') && normKey.includes(normalizeArabic(ex))) &&
            !['رياضة', 'بدنية', 'رياضية'].some(ex => (baseTargetSub === 'ت.تشكيلية' || baseTargetSub.includes('فني')) && normKey.includes(normalizeArabic(ex)));

        return isSubjectMatch && (tPattern1.test(normKey) || tPattern2.test(normKey));
    });

    // 2. Fallback: Look for "Generic" match (No suffix), BUT only if safe.
    // It is safe to use "Generic" name ONLY if the file's native trimester matches the selected one.
    if (!bestMatchKey && fileTrimesterVal === selectedTrimesterVal) {
        bestMatchKey = keys.find(k => {
            const normKey = normalizeArabic(k);
            const isSubjectMatch = (normKey.includes(normTarget) ||
                (subjectAliases[baseTargetSub] && subjectAliases[baseTargetSub].some(alias => normKey.includes(normalizeArabic(alias))))) &&
                !['فيزيائية', 'تكنولوجيا', 'اسلامية', 'إسلامية', 'شرعية', 'انسانية', 'اجتماعية'].some(ex => (baseTargetSub.includes('طبيعية') || baseTargetSub === 'علوم') && normKey.includes(normalizeArabic(ex))) &&
                !['فنية', 'تشكيلية', 'فنون', 'رسم'].some(ex => (baseTargetSub === 'رياضة' || baseTargetSub === 'تربية بدنية') && normKey.includes(normalizeArabic(ex))) &&
                !['رياضة', 'بدنية', 'رياضية'].some(ex => (baseTargetSub === 'ت.تشكيلية' || baseTargetSub.includes('فني')) && normKey.includes(normalizeArabic(ex)));

            if (!isSubjectMatch) return false;

            // Ensure this generic match doesn't have SOME OTHER trimester suffix
            const otherTrimesters = ['1', '2', '3'].filter(t => t !== selectedTrimesterVal);
            for (const t of otherTrimesters) {
                if (new RegExp(`ف\\s*${t}(\\s|$)`).test(normKey) || new RegExp(`فصل\\s*${t}(\\s|$)`).test(normKey)) {
                    return false;
                }
            }
            return true;
        });
    }

    // 3. Last Resort: Direct match safety fallback (only if contexts match)
    if (!bestMatchKey && student.marks[baseTargetSub] !== undefined && fileTrimesterVal === selectedTrimesterVal) {
        bestMatchKey = baseTargetSub;
    }

    // Still not found, try original targetSub just in case
    if (!bestMatchKey && student.marks[targetSub] !== undefined && fileTrimesterVal === selectedTrimesterVal) {
        bestMatchKey = targetSub;
    }

    // --- Existing Logic End ---

    const result = bestMatchKey ? student.marks[bestMatchKey] : null;

    // Store in Cache
    scoreCache.set(cacheKey, result);

    return result;
}

// Aliases for matching official subject names to our display columns

const subjectAliases = {

    // -- Langes --

    'عربية': ['لغة عربية', 'أدب عربي', 'اللغة العربية', 'اللغة العربية وآدابها', 'اللغة العربية و آدابها'],

    'لغة عربية': ['عربية', 'أدب عربي', 'اللغة العربية', 'اللغة العربية وآدابها', 'اللغة العربية و آدابها'],

    'فرنسية': ['لغة فرنسية', 'فرنسية', 'اللغة الفرنسية'],

    'لغة فرنسية': ['فرنسية', 'لغة فرنسية', 'اللغة الفرنسية'],

    'انجليزية': ['لغة انجليزية', 'انجليزية', 'اللغة الإنجليزية', 'اللغة الانجليزية'],

    'لغة انجليزية': ['انجليزية', 'لغة انجليزية', 'اللغة الإنجليزية', 'اللغة الانجليزية', 'اللغة الأنجليزية'],

    'لغة ثالثة': ['اللغة اﻷجنبية الثالثة', 'اللغة الأجنبية الثالثة', 'لغة أجنبية ثالثة', 'لغة ثالثة', 'اللغة الثالثة', 'ألمانية', 'اسبانية', 'إسبانية', 'إيطالية', 'ايطالية', 'لغة 3', 'اللغة 3', 'اللغة الأجنبية 3', 'Allemand', 'Espagnol', 'Italien', 'Deutsch', 'Spanish', 'Italian'],

    'أمازيغية': ['اللغة الأمازيغية', 'امازيغية', 'الأمازيغية', 'تاريخ و جغرافيا الأمازيغية', 'لغة أمازيغية'],

    // -- Sciences --

    'رياضيات': ['رياضيات', 'الرياضيات'],

    'علوم': ['علوم طبيعية', 'ع.طبيعية', 'ع الطبيعة و الحياة', 'طبيعة و حياة', 'العلوم الطبيعية', 'علوم', 'علوم الطبيعة والحياة', 'العلوم الطبيعة والحياة'],

    'علوم طبيعية': ['علوم', 'ع.طبيعية', 'ع الطبيعة والحياة', 'ع الطبيعة و الحياة', 'طبيعة و حياة', 'العلوم الطبيعية', 'علوم الطبيعة والحياة', 'العلوم الطبيعة والحياة'],

    'فيزياء': ['علوم فيزيائية', 'ع.فيزيائية', 'تكنولوجيا', 'فيزياء', 'العلوم الفيزيائية'],

    'علوم فيزيائية': ['فيزياء', 'ع.فيزيائية', 'تكنولوجيا', 'العلوم الفيزيائية'],

    'تكنولوجيا': ['هندسة', 'هندسة مدنية', 'هندسة ميكانيكية', 'هندسة طرائق', 'هندسة كهربائية', 'تكنولوجيا'],

    // -- Humanities --

    'اسلامية': ['علوم اسلامية', 'إسلامية', 'التربية الاسلامية', 'شريعة', 'العلوم الإسلامية', 'العلوم الاسلامية', 'التربية الإسلامية', 'تربية إسلامية', 'تربية اسلامية'],

    'علوم اسلامية': ['اسلامية', 'إسلامية', 'التربية الاسلامية', 'شريعة', 'العلوم الإسلامية', 'العلوم الاسلامية'],

    'تاريخ': ['تاريخ', 'اجتماعيات', 'تاريخ و جغرافيا', 'التاريخ والجغرافيا', 'التاريخ و الجغرافيا'],

    'تاريخ وجغرافيا': ['تاريخ', 'جغرافيا', 'اجتماعيات', 'تاريخ و جغرافيا', 'التاريخ والجغرافيا', 'التاريخ و الجغرافيا'],

    'مدنية': ['مدنية', 'تربية مدنية', 'التربية المدنية', 'تربية مدنية'],

    'فلسفة': ['فلسفة', 'الفلسفة'],

    // -- Tech / Management --

    'معلوماتية': ['معلوماتية', 'اعلام', 'إعلام آلي', 'اعلام آلي', 'الإعلام الآلي', 'الاعلام الالي', 'إعلام آلي'],

    'اعلام آلي': ['معلوماتية', 'اعلام', 'إعلام', 'اعلام الي'],

    'تسيير محاسبي': ['تسيير', 'محاسبة', 'تسيير مالي', 'التسيير المحاسبي والمالي', 'ت. المحاسبي و المالي'],

    'اقتصاد ومناجمنت': ['اقتصاد', 'مناجمنت', 'الإقتصاد والمناجمنت'],

    'قانون': ['قانون'],

    'هندسة مدنية': ['هندسة مدنية', 'ه.مدنية'],

    'هندسة ميكانيكية': ['هندسة ميكانيكية', 'ه.ميكانيكية'],

    'هندسة كهربائية': ['هندسة كهربائية', 'ه.كهربائية'],

    'هندسة طرائق': ['هندسة طرائق', 'ه.طرائق'],

    // -- Arts / Sport --

    'ت.تشكيلية': ['ت.تشكيلية', 'فنون تشكيلية', 'التربية التشكيلية', 'رسم', 'فنون', 'التربية الفنية'],

    'موسيقى': ['موسيقى', 'التربية الموسيقية'],

    'رياضة': ['رياضة', 'تربية بدنية', 'التربية البدنية', 'Sport', 'EPS', 'E.P.S', 'ت.بدنية', 'إ.بدنية', 'Education Physique', 'Ed.Physique', 'Physique', 'ت البدنية والرياضية', 'ت البدنية و الرياضية'],

    'تربية بدنية': ['رياضة', 'بدنية', 'التربية البدنية', 'Sport', 'EPS', 'E.P.S', 'ت.بدنية', 'إ.بدنية', 'Education Physique', 'Ed.Physique', 'Physique', 'ت البدنية والرياضية', 'ت البدنية و الرياضية'],

    // -- Other --

    'فلسفة': ['فلسفة', 'الفلسفة']

};

// Capture header info (Institution info from settings) should be inside or global. It was mangled.

function legacyRenderRows(data, activeOrderedSubjects) {

    // Store data globally for modal access

    currentStudentsData = data;

    const tbody = document.getElementById('detailedTableBody');
    const theadRow = document.querySelector('.student-list table thead tr'); // Ensure correct selector

    // Settings for Decision Logic

    const settings = institutionSettings;

    const directedBirthYear = parseInt(settings.directedBirthYear);

    const trimesterSelect = document.getElementById('trimesterSelect');

    const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';

    const isT3 = selectedTrimesterVal === '3';
    const isAnnual = selectedTrimesterVal === 'annual';

    // T2 uses standard comparison
    const hasComparison = selectedTrimesterVal === '2';
    const prevTrimVal = selectedTrimesterVal === '2' ? '1' : null;
    const comparisonHeader = 'م.ف1';
    const stage = institutionSettings.educationStage || 'middle';
    const levelSelect = document.getElementById('levelSelect');
    const levelValue = levelSelect ? levelSelect.value : '';
    const isFinalYear = (stage === 'secondary' && levelValue === '3') ||
        (stage !== 'secondary' && levelValue === '4');
    const showDecisionColumn = (isT3 || isAnnual) && !isFinalYear;

    // FILTER activeOrderedSubjects to remove subjects where ALL students have 0 or '-'
    const subjectsWithMarks = activeOrderedSubjects.filter(sub => {
        return data.some(s => {
            const mark = getSubjectScore(s, sub);
            const numMark = parseFloat(mark);
            return mark !== null && mark !== undefined && mark !== '-' && !isNaN(numMark) && numMark > 0;
        });
    });

    activeOrderedSubjects = subjectsWithMarks;

    // Update Header
    if (theadRow) {

        let headerHtml = `

            <th width="25">#</th>

            <th width="110">اللقب والاسم</th>

            <th width="35" class="gender-col">الجنس</th>

            <th width="75">ت.الميلاد</th>

        `;

        activeOrderedSubjects.forEach(sub => {

            headerHtml += `<th class="vertical-header"><div>${getSubjectAbbreviation(sub)}</div></th>`;

        });

        // T2 Comparison Column

        if (hasComparison) {

            headerHtml += `<th width="45" style="background:#bdc3c7; color:black;">${comparisonHeader}</th>`;

        }

        headerHtml += `

            <th width="45" style="background:#e74c3c; color:white;">المعدل</th>

        `;

        if (isT3) {

            // T3 Specific Columns: Annual Avg + Decision

            // Explicitly added for ALL levels (including 4MS/3AS)

            headerHtml += `<th width="45" class="vertical-header" style="background:#8e44ad; color:white;"><div>م.سنوي</div></th>`;

            if (showDecisionColumn) {

                headerHtml += `<th width="40" class="decision-col" style="background:var(--primary-color); color:white;">القرار</th>`;

            }

        } else if (showDecisionColumn) {

            headerHtml += `<th width="40" class="decision-col" style="background:var(--primary-color); color:white;">القرار</th>`;

        } else if (!isAnnual) {

            // Standard Appreciation Column (T1 & T2)

            headerHtml += `<th width="40" class="appreciation-col" style="background:#e74c3c; color:white;">التقدير</th>`;

        }

        theadRow.innerHTML = headerHtml;

    }

    let html = '';

    if (data.length === 0) {

        tbody.innerHTML = '<tr><td colspan="20">لا توجد بيانات</td></tr>';

        return;

    }

    data.forEach((s, index) => {

        let marksHtml = '';

        // Loop through the FILTERED subjects

        activeOrderedSubjects.forEach(targetSub => {

            const mark = getSubjectScore(s, targetSub);

            const displayMark = mark !== null && mark !== undefined ? mark : '-';

            const color = (typeof mark === 'number' && mark < 10) ? 'red' : 'black';

            marksHtml += `<td style="color:${color}">${displayMark}</td>`;

        });

        const currentAvg = typeof getStudentAverage(s) === 'number' ? getStudentAverage(s) : parseFloat(getStudentAverage(s) || 0);

        let comparisonHtml = '';

        let trendHtml = '';

        if (hasComparison) {

            const avgPrev = getTrimesterAverage(s, prevTrimVal);

            // Prev Trim Column Cell

            comparisonHtml = `<td style="background:#ecf0f1; font-weight:bold; color:#7f8c8d; font-size:0.9em;">${avgPrev > 0 ? avgPrev : '-'}</td>`;

            if (currentAvg > avgPrev && avgPrev > 0) {

                trendHtml = '&nbsp;<span style="color:#27ae60; font-size:1.1em; vertical-align:middle;">▲</span>';

            } else if (currentAvg < avgPrev && avgPrev > 0) {

                trendHtml = '&nbsp;<span style="color:#c0392b; font-size:1.1em; vertical-align:middle;">▼</span>';

            }

        }

        // Final Columns Logic

        let finalColumnsHtml = '';

        if (isT3) {
            const decisionSnapshot = getAnnualDecisionSnapshot(s, directedBirthYear);

            finalColumnsHtml = `

                <td style="font-weight:bold; background:#e8daef;">${decisionSnapshot.annualAverage}</td>

            `;

            if (showDecisionColumn) {

                finalColumnsHtml += `<td class="decision-col" style="font-weight:bold; color:${decisionSnapshot.decisionColor};">${decisionSnapshot.decision}</td>`;

            }

        } else if (showDecisionColumn) {

            const decisionSnapshot = getAnnualDecisionSnapshot(s, directedBirthYear);
            finalColumnsHtml = `<td class="decision-col" style="font-weight:bold; color:${decisionSnapshot.decisionColor};">${decisionSnapshot.decision}</td>`;

        } else if (!isAnnual) {

            // Standard Appreciation (T1, T2)

            finalColumnsHtml = `<td class="appreciation-col">${getAppreciation(currentAvg)}</td>`;

        }

        html += `

            <tr onclick="showStudentModal('${s.id}')" style="cursor:pointer;" title="اضغط لعرض تفاصيل التلميذ">

                <td>${index + 1}</td>

                <td style="text-align:right; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.name}</td>

                <td style="font-size:0.85em;">${s.gender || '-'}</td>

                <td style="white-space: nowrap; font-size:0.85em;">${formatDate(s.dob)}</td>

                ${marksHtml}

                ${comparisonHtml}

                <td style="font-weight:bold; background:#f0f0f0; white-space: nowrap;">${currentAvg.toFixed(2)}${trendHtml}</td>

                ${finalColumnsHtml}

            </tr>

        `;

    });

    // Add Summary Row (Averages)

    let summaryMarksHtml = '';

    activeOrderedSubjects.forEach(sub => {

        const scores = data.map(s => getSubjectScore(s, sub)).filter(m => m !== null && m !== undefined);

        const avg = scores.length > 0 ? (scores.reduce((a, b) => a + Number(b), 0) / scores.length).toFixed(2) : '-';

        summaryMarksHtml += `<td style="font-weight:bold; background:#ecf0f1;">${avg}</td>`;

    });

    // Summary Row Removed as per user request

    /*

    const classAvg = data.length > 0 ? (data.reduce((a, b) => a + (parseFloat(b.average) || 0), 0) / data.length).toFixed(2) : '0';

    html += `

        <tr style="background:#f9f9f9; border-top:2px solid #333;">

            <td colspan="4" style="font-weight:bold; text-align:center;">معدلات المواد</td>

            ${summaryMarksHtml}

            <td style="font-weight:bold; background:#d5dbdb;">${classAvg}</td>

            <td style="background:#ecf0f1;">-</td>

        </tr>

    `;

    */

    tbody.innerHTML = html;

}

// Helper to format date (Remove time part from ISO string)

function formatDate(dateStr) {

    if (!dateStr) return '-';

    // If it contains T, take the first part

    if (dateStr.includes('T')) {

        return dateStr.split('T')[0];

    }

    return dateStr;

}

// Helper to get Appreciation text

function getAppreciation(avg) {
    const excellence = parseFloat(institutionSettings.evalExcellence) || 18;
    const congratulation = parseFloat(institutionSettings.evalCongratulation) || 16;
    const encouragement = parseFloat(institutionSettings.evalEncouragement) || 14;
    const honor = parseFloat(institutionSettings.evalHonor) || 12;

    if (avg >= excellence) return '<span class="high-score">امتياز</span>';
    if (avg >= congratulation) return '<span class="high-score">تهنئة</span>';
    if (avg >= encouragement) return '<span class="high-score" style="color:#2980b9">تشجيع</span>'; // Blueish
    if (avg >= honor) return '<span class="high-score" style="color:#f39c12">ل.شرف</span>'; // Orange

    if (avg >= 10) return ' / ';

    return ''; // Or 'rasib' if needed

}

// الترتيب

function sortStudentsByScore() {

    applyFilters(); // Re-apply filters to sort visible data

}

// Abbreviation Mapping

const headerAbbreviations = {

    'اللغة العربية': 'العربية',

    'اللغة الأمازيغية': 'أمازيغية',

    'اللغة الفرنسية': 'الفرنسية',

    'اللغة الإنجليزية': 'إنجليزية',

    'اللغة الانجليزية': 'إنجليزية',

    'الرياضيات': 'رياضيات',

    'ع الطبيعة و الحياة': 'العلوم',

    'علوم الطبيعة والحياة': 'العلوم',

    'التربية الإسلامية': 'إسلامية',

    'ع الفيزيائية والتكنولوجيا': 'فيزياء',

    'العلوم الفيزيائية': 'فيزياء',

    'التاريخ والجغرافيا': 'تاريخ وج',

    'التربية المدنية': 'مدنية',

    'التربية الموسيقية': 'موسيقية',

    'المعلوماتية': 'معلوماتية',

    'ت البدنية و الرياضية': 'رياضة',

    'التربية البدنية': 'رياضة',

    'التربية التشكيلية': 'تشكيلية',

    'اللغة اﻷمازيغية': 'أمازيغية', // Specific unicode variant if needed

    'اللغة اﻷمازيغية': 'أمازيغية', // Specific unicode variant if needed

    'معدل الفصل': 'م.الفصل',

    'التسيير المحاسبي والمالي': 'ت.مالي',

    'تسيير محاسبي': 'ت.مالي',

    'اقتصاد ومناجمنت': 'اقتصاد',

    'الإقتصاد والمناجمنت': 'اقتصاد',

    'قانون': 'قانون',

    'هندسة مدنية': 'ه.مدنية',

    'هندسة ميكانيكية': 'ه.ميكانيكية',

    'هندسة كهربائية': 'ه.كهربائية',

    'هندسة طرائق': 'ه.طرائق',

    'فلسفة': 'فلسفة',

    'لغة أجنبية ثالثة': 'لغة 3',

    'لغة ثالثة': 'لغة 3',

    'ألمانية': 'أ(Deu)',

    'اسبانية': 'إ(Esp)',

};

function getSubjectAbbreviation(subjectName) {

    if (!subjectName) return '';

    // 1. Remove Trimester Suffixes (ف1, ف2, ف3)

    let cleanName = subjectName.replace(/\s*(ف|فصل)\s*[1-3]\s*$/, '').trim();

    // 2. Normalize for matching

    const norm = normalizeArabic(cleanName);

    // 3. Check exact matches in mapping (using normalized keys if needed)

    for (const [key, abbr] of Object.entries(headerAbbreviations)) {

        if (normalizeArabic(key) === norm) {

            return abbr;

        }

    }

    // 4. Return cleaned name if no match found

    return cleanName;

}

let chartInstance = null;

// الرسم البياني (Bar Chart)

function initChart(data = studentsData, activeSubjects = subjects) {

    if (!activeSubjects || activeSubjects.length === 0) return;

    // Use currently selected trimester
    const trimesterSelect = document.getElementById('trimesterSelect');
    const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';

    // FILTER activeSubjects to remove subjects where ALL students have 0, '-', null or undefined
    activeSubjects = activeSubjects.filter(sub => {
        return data.some(s => {
            const mark = getSubjectScore(s, sub, selectedTrimesterVal);
            const numMark = parseFloat(mark);
            return mark !== null && mark !== undefined && mark !== '-' && !isNaN(numMark) && numMark > 0;
        });
    });

    if (activeSubjects.length === 0) return;

    const ctx = document.getElementById('subjectsChart').getContext('2d');

    const labels = activeSubjects; // Use dynamic subjects for Chart

    const statsData = activeSubjects.map(sub => {

        const scores = data.map(s => getSubjectScore(s, sub, selectedTrimesterVal)).filter(m => m !== null && m !== undefined);

        if (scores.length === 0) return 0;

        const passed = scores.filter(s => s >= 10).length;

        return ((passed / scores.length) * 100).toFixed(1);

    });

    // Define colors based on data

    const backgroundColors = statsData.map(val => val < 50 ? 'rgba(231, 76, 60, 0.7)' : 'rgba(52, 152, 219, 0.7)');

    const borderColors = statsData.map(val => val < 50 ? 'rgba(192, 57, 43, 1)' : 'rgba(52, 152, 219, 1)');

    if (chartInstance) {

        chartInstance.destroy();

    }

    // Custom Plugin for Data Labels

    const dataLabelsPlugin = {

        id: 'dataLabels',

        afterDatasetsDraw(chart, args, options) {

            const { ctx } = chart;

            chart.data.datasets.forEach((dataset, i) => {

                const meta = chart.getDatasetMeta(i);

                meta.data.forEach((bar, index) => {

                    const value = dataset.data[index] + '%';

                    const { x, y } = bar.tooltipPosition();

                    ctx.save();

                    ctx.fillStyle = 'black';

                    ctx.font = 'bold 12px Tajawal';

                    ctx.textAlign = 'center';

                    ctx.textBaseline = 'bottom';

                    ctx.fillText(value, x, y - 5);

                    ctx.restore();

                });

            });

        }

    };

    chartInstance = new Chart(ctx, {

        type: 'bar',

        data: {

            labels: labels,

            datasets: [{

                label: 'نسبة النجاح (%)',

                data: statsData,

                backgroundColor: backgroundColors,

                borderColor: borderColors,

                borderWidth: 1

            }]

        },

        options: {

            animation: { duration: 0 },

            responsive: true,

            maintainAspectRatio: false,

            scales: {

                y: {

                    beginAtZero: true,

                    max: 100

                },

                x: {

                    ticks: {

                        color: 'black',

                        font: {

                            weight: 'bold',

                            family: 'Tajawal',

                            size: 12

                        }

                    }

                }

            },

            plugins: {

                title: {

                    display: true,

                    text: 'نسب النجاح حسب المواد الدراسية',

                    font: { family: 'Tajawal', size: 16 }

                }

            }

        },

        plugins: [dataLabelsPlugin]

    });

}

// Print to New Tab Functionality

function printToNewTab() {

    const printWindow = window.open('', '_blank');

    // Capture the chart as an image first

    // Clone sections

    const dashboard = document.querySelector('.dashboard').cloneNode(true);

    const studentList = document.querySelector('.student-list').cloneNode(true);

    // FILTER: Hide columns where ALL scores are 0 (User Request)
    const table = studentList.querySelector('.data-table');
    if (table) {
        const headers = table.querySelectorAll('thead th');
        const rows = table.querySelectorAll('tbody tr');
        const colCount = headers.length;

        // Identify subject columns (those with vertical-header)
        const subjectIndices = [];
        headers.forEach((th, index) => {
            // FIX: Check classList on the TH element itself
            if (th.classList.contains('vertical-header')) {
                subjectIndices.push(index);
            }
        });

        // Check each subject column
        subjectIndices.forEach(colIndex => {
            let allZero = true;
            for (let i = 0; i < rows.length; i++) {
                const cell = rows[i].children[colIndex];
                if (cell) {
                    const text = cell.textContent.trim();
                    // If any cell is NOT 0 and NOT empty/dash, then column is not all-zero
                    if (text !== '0' && text !== '0.0' && text !== '0.00' && text !== '-' && text !== '') {
                        allZero = false;
                        break;
                    }
                }
            }

            // Hide if all zero
            if (allZero) {
                // Hide header
                headers[colIndex].style.display = 'none';
                // Hide cells
                rows.forEach(row => {
                    if (row.children[colIndex]) {
                        row.children[colIndex].style.display = 'none';
                    }
                });
            }
        });
    }

    // In the dashboard clone, replace the canvas container with the static image using DOM manipulation

    const chartCanvas = document.getElementById('subjectsChart');
    const cloneChartContainer = dashboard.querySelector('.chart-container');

    if (chartCanvas && cloneChartContainer) {
        const chartImage = chartCanvas.toDataURL('image/png');
        cloneChartContainer.innerHTML = `<img src="${chartImage}" style="width:100%; height:100%; object-fit:contain; display:block; margin: 0 auto;">`;
        // Ensure container style in print
        cloneChartContainer.style.height = '230px';
        cloneChartContainer.style.overflow = 'hidden';
        cloneChartContainer.style.display = 'block'; // Ensure it's visible
    }

    const dashboardCloneHtml = dashboard.innerHTML;

    // Capture dynamic title info

    const selectedLevel = document.getElementById('levelSelect').value;

    const selectedClass = document.getElementById('classSelect').value;

    const selectedTrimesterVal = document.getElementById('trimesterSelect').value;

    const yearSelect = document.getElementById('yearSelect');
    const selectedYear = yearSelect ? yearSelect.value : (institutionSettings.schoolYear || '.......');

    const selectedTrimesterName = trimesterMap[selectedTrimesterVal] || selectedTrimesterVal;

    // Get class responsible teacher

    const responsibleName = getClassResponsibleName(selectedLevel, selectedClass);

    const responsibleInfo = responsibleName ? ` | الأستاذ م.القسم: ${responsibleName}` : '';

    // Capture header info (Institution info from settings)

    const settings = institutionSettings;

    // ADDED: Stream Info for Secondary

    let streamInfo = '';

    const stage = settings.educationStage || 'middle';

    if (stage === 'secondary') {

        const streamSelect = document.getElementById('streamSelect');

        const selectedStreamCode = streamSelect ? streamSelect.value : '';

        if (selectedStreamCode) {

            const streamName = (typeof SubjectManager !== 'undefined') ? SubjectManager.getStreamName(selectedStreamCode) : selectedStreamCode;

            streamInfo = ` | الشعبة: ${streamName}`;

        }

    }

    const pageTitle = `تحليل نتائج الفصل ${selectedTrimesterName} لمستوى ${selectedLevel} - القسم ${selectedClass}${streamInfo}${responsibleInfo}`;

    // Capture header info (Institution info from settings)

    // Settings already declared above

    const headerHtml = `

        <div style="font-family: 'Cairo', sans-serif; direction: rtl; margin-bottom: 10px;">

            <div style="text-align: center; margin-bottom: 5px;">

                <h3 style="margin: 0; font-size: 12pt; font-weight: bold;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                <h3 style="margin: 2px 0; font-size: 11pt;">وزارة التربية الوطنية</h3>

            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px;">

                <div style="text-align: right; font-size: 10pt;">

                    <div style="margin-bottom:2px"><strong>مديرية التربية لولاية:</strong> ${settings.wilaya || '.......'}</div>

                    <div style="margin-bottom:2px"><strong>المؤسسة:</strong> ${settings.institutionName || '.......'}</div>

                </div>

                <div style="text-align: left; font-size: 10pt;">

                     <div style="margin-bottom:2px"><strong>السنة الدراسية:</strong> ${selectedYear}</div>

                     <div style="margin-bottom:2px"><strong>البلدية:</strong> ${settings.municipality || '.......'}</div>

                </div>

            </div>

            <div style="text-align: center; background-color: #f9f9f9; padding: 5px; border: 1px solid #ddd; border-radius: 5px;">

                 <h2 style="margin: 0; font-size: 14pt; color: var(--primary-color);">${pageTitle}</h2>

            </div>

        </div>

    `;

    // Capture footer info

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // Get signer info from signature settings

    const sigSettings = signatureSettings;

    const reportConfig = sigSettings.reportSettings?.['class_analysis'] || { signer: 'director', showSignature: true };

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    // Determine title based on signer type and gender

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }

    const signerName = signerData.fullName || settings.managerName || '................';

    const footerHtml = `
        <div style="margin-top: 20px; display: flex; justify-content: flex-end; align-items: flex-start; direction: rtl; font-size: 10pt;">
            <div style="text-align: center; min-width: 150px; line-height: 1.2;">
                <div style="margin-bottom: 8px; font-weight: normal;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                <div style="font-weight: normal; font-size: 14pt;">${signerTitle}</div>
            </div>
        </div>
    `;

    // ADDED: Logic to hide appreciation column if Trimester 2 or 3

    let customPrintStyle = '';

    // T3 Check

    const isT3 = selectedTrimesterVal === '3';

    if (isT3) {
        customPrintStyle += `
            .appreciation-col { display: none !important; }
        `;
    }

    // CONDITIONAL PRINT STYLING FOR LARGE CLASSES OR MANY SUBJECTS

    const rowCount = document.querySelectorAll('#detailedTableBody tr').length;

    // Count subjects (vertical headers) to detect wide tables

    const subjectCount = document.querySelectorAll('.student-list .data-table thead th.vertical-header').length;

    // Fix for truncation when subjects >= 12

    if (subjectCount >= 12) {

        customPrintStyle += `

            .student-list .data-table td {

                font-size: 8pt !important;

                padding: 1px 1px !important;

                white-space: nowrap !important;

            }

            .student-list .data-table th {

                font-size: 8pt !important;

                padding: 1px !important;

            }

            /* Added: Reduce dashboard table padding for many subjects */
            .dashboard .data-table td, .dashboard .data-table th {
                padding: 1px 3px !important;
                line-height: 1.15 !important;
            }

        `;

    }

    if (rowCount > 30) {

        customPrintStyle += `

            .student-list .data-table td {

                padding: 1px 3px !important;

                height: 20px !important;

                line-height: 1.2;

                /* If we already set font-size in subjectCount block, this might override it to 9pt if we are not careful.

                   Let's fallback to 9pt only if not already smaller. But simpler to just let them coexist or prioritize subject count.

                   If subjectCount >= 12, we want 8pt. If rowCount > 30, we want compact height.

                   Let's merge carefullly. */

            }

            /* Ensure we don't accidentally increase font size back if it was set to 8pt */

            .student-list .data-table td {

                font-size: ${subjectCount >= 12 ? '8pt' : '9pt'} !important;

            }

            .student-list .data-table th {

                font-size: ${subjectCount >= 12 ? '8pt' : '9pt'} !important;

                padding: 3px !important;

            }

            .vertical-header div {

                max-height: 130px !important;

                padding: 3px !important;

            }

            .vertical-header {

                height: 130px !important;

            }

        `;

    }

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>طباعة تقرير تحليل القسم</title>

            <!-- No external stylesheet to avoid conflicts -->

            <style>

                @font-face {
                    font-family: 'Cairo';
                    font-style: normal;
                    font-weight: 400;
                    src: url('assets/fonts/Cairo-Regular.ttf') format('truetype');
                }
                @font-face {
                    font-family: 'Cairo';
                    font-style: normal;
                    font-weight: 700;
                    src: url('assets/fonts/Cairo-Bold.ttf') format('truetype');
                }

                @page { margin: 0.8cm; } /* Reduced margin for more space */

                * { margin: 0; padding: 0; box-sizing: border-box; }

                body { font-family: 'Cairo', sans-serif; padding: 0px; background: 'var(--card-bg)'; font-size: 9pt; margin: 0; }

                .navbar, .controls, .btn-analyze, .toast-container { display: none !important; }

                ${customPrintStyle} /* Injected CSS for hiding columns or compacting rows */

                /* Dashboard Page - Always break after */

                .dashboard-page {

                    display: block;

                    page-break-after: always;

                }

                /* Footer styling */

                .static-footer {

                    width: 100%;

                    border-top: 1px dashed #999;

                    padding-top: 5px;

                    background: 'var(--card-bg)';

                    margin-top: 10px;

                }

                /* List Section */

                .list-section {

                    display: block;

                }

                .content-wrapper { display: block; }

                /* Large Sizes for Page 1 (Dashboard) */

                .dashboard .data-table { width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 11pt; font-weight: bold; }

                .dashboard .data-table th, .dashboard .data-table td { border: 1px solid black !important; padding: 2px 4px; text-align: center; height: auto; font-weight: bold; line-height: 1.2; }

                .dashboard .data-table th { background-color: white; color: black; font-weight: bold; }

                .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }

                .dashboard .card { border: 1px solid #eee; padding: 6px; border-radius: 6px; margin-bottom: 3px; }

                .dashboard .card h3 { font-size: 11pt !important; margin-bottom: 3px !important; }

                .dashboard .card p { font-size: 11.5pt !important; margin: 0 !important; }

                /* Ensure Decision Stats is visible in print if T3 */

                #decisionStatsContainer {

                    display: ${isT3 ? 'block' : 'none'} !important;

                    margin-top: 10px;

                    border-top: 1px solid #eee;

                }

                /* Page 2 Text Size */

                .data-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9pt; }

                .data-table th, .data-table td { border: 1pt solid black !important; padding: 4px; text-align: center; }

                /* Fix Vertical Headers Borders - Print Specific */

                .vertical-header {

                    border: 1px solid black !important;

                    vertical-align: bottom !important;

                    background-color: white !important;

                    writing-mode: horizontal-tb !important;

                    transform: none !important;

                    padding: 0 !important;

                    height: auto !important;

                }

                .vertical-header div {

                    writing-mode: vertical-rl;

                    transform: rotate(180deg);

                    white-space: nowrap;

                    padding: 4px;

                    margin: 0 auto;

                    width: 100%;

                    max-height: 150px;

                }

                .student-list .data-table {

                    table-layout: fixed;

                    width: 100% !important;

                }

                .student-list .data-table th,

                .student-list .data-table td {

                    border: 1pt solid black !important;

                    padding: 2px 3px !important;

                    /* Padding is handled by customPrintStyle above if large class */

                    overflow: hidden;

                }

                /* Special Report Customizations (User Request) */

                .gender-col {

                    writing-mode: vertical-rl !important;

                    transform: rotate(180deg) !important;

                    white-space: nowrap;

                    padding: 2px 0 !important;

                    min-height: 60px;

                    width: 25px !important;

                }

                .decision-col {

                    font-size: 0.75rem !important; /* Slightly larger than previous 0.7 */

                    font-weight: bold;

                    min-width: 50px !important; /* Increased width */

                }

                /* Force all headers text to be black, but keep background (which is usually white in print) */

                .data-table th {

                    color: black !important;

                }

                .data-table th { background-color: white !important; color: black; font-size: 8.5pt; }

                .data-table th { background-color: white; color: black; }

                /* Disable Sticky for Print */

                .data-table thead th { position: static !important; }

                /* Balanced Chart Size for Page 1 */

                .chart-container { margin: 2px 0; width: 100% !important; height: 230px !important; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #eee; border-radius: 6px; padding: 2px; }

                .chart-container img { max-height: 100%; width: auto; max-width: 100%; }

                .honor-board { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 5px; }

                .honor-card { padding: 5px !important; font-size: 10pt; margin-bottom: 0px !important;}

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

            <div class="print-page dashboard-page">

                ${headerHtml.replace('font-size: 16pt', 'font-size: 18pt')}

                <div class="content-wrapper">

                    <section class="dashboard">

                        ${dashboardCloneHtml}

                    </section>

                </div>

                <!-- Footer removed from first page as per user request -->

            </div>

            <div class="list-section">

                 <div class="content-wrapper">

                    <section class="student-list">

                        ${studentList.innerHTML}

                    </section>

                </div>

                 <div class="footer static-footer">

                    ${footerHtml}

                </div>

            </div>

            <script>

                window.onload = function() {

                    setTimeout(() => {

                        // window.print(); /* Replaced by global Toolbar */

                    }, 500);

                };

            </script>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

}

// Helper for dynamic average based on selected trimester

function getStudentAverage(student) {

    const trimesterSelect = document.getElementById('trimesterSelect');

    const val = trimesterSelect ? trimesterSelect.value : '1';

    return getTrimesterAverage(student, val);

}

// Low-level helper to get average for a specific trimester

function hasAnnualAverageData(student) {

    if (!student || !student.averages) return false;

    return ['1', '2', '3'].every(trimesterVal =>
        student.averages[trimesterVal] !== undefined &&
        student.averages[trimesterVal] !== null &&
        student.averages[trimesterVal] !== ''
    );

}

function hasAnnualMarksData(student) {

    if (!student || !student.marks) return false;

    const keys = Object.keys(student.marks).map(normalizeArabic);

    return ['1', '2', '3'].every(trimesterVal => {
        const pattern1 = new RegExp(`ف\\s*${trimesterVal}(\\s|$)`);
        const pattern2 = new RegExp(`فصل\\s*${trimesterVal}(\\s|$)`);
        return keys.some(key => pattern1.test(key) || pattern2.test(key));
    });

}

function getStoredTrimesterAverage(student, trimesterVal) {

    if (student.averages && student.averages[trimesterVal] !== undefined && student.averages[trimesterVal] !== null && student.averages[trimesterVal] !== '') {

        return parseFloat(student.averages[trimesterVal]) || 0;

    }

    const trimesterMap = { '1': 'الأول', '2': 'الثاني', '3': 'الثالث' };

    if (student.trimester === trimesterMap[trimesterVal]) {

        return parseFloat(student.average) || 0;

    }

    return 0;

}

function getAnnualAverage(student) {

    const trimesterValues = ['1', '2', '3'].map(trimesterVal => getStoredTrimesterAverage(student, trimesterVal));

    if (trimesterValues.some(value => !value || isNaN(value))) {

        return 0;

    }

    return trimesterValues.reduce((sum, value) => sum + value, 0) / trimesterValues.length;

}

function getTrimesterAverage(student, trimesterVal) {

    if (trimesterVal === 'annual') {

        return getAnnualAverage(student);

    }

    if (student.averages && student.averages[trimesterVal]) {

        return parseFloat(student.averages[trimesterVal]);

    }

    const trimesterMap = { '1': 'الأول', '2': 'الثاني', '3': 'الثالث' };

    if (student.trimester === trimesterMap[trimesterVal]) {

        return parseFloat(student.average) || 0;

    }

    return 0; // No data for this trimester

}

function getAnnualDecisionSnapshot(student, directedBirthYear) {
    const avg1 = getTrimesterAverage(student, '1') || 0;
    const avg2 = getTrimesterAverage(student, '2') || 0;
    const avg3 = getTrimesterAverage(student, '3') || 0;
    const annualAverage = ((avg1 + avg2 + avg3) / 3).toFixed(2);
    const annualAverageNum = parseFloat(annualAverage);
    const birthYear = student && student.dob ? new Date(student.dob).getFullYear() : 0;
    const stage = (institutionSettings || {}).educationStage || 'middle';

    let decision = '';
    let decisionColor = 'black';
    let decisionEditable = false;
    let manualDecisionCode = '';
    let manualDecisionKey = '';

    if (annualAverageNum >= 10) {
        decision = 'ينتقل';
        decisionColor = 'green';
    } else if (annualAverageNum >= 9) {
        decision = 'يستدرك';
        decisionColor = '#d35400';
    } else if (stage === 'secondary') {
        const manualDecision = getSavedSecondaryManualDecision(student);
        manualDecisionCode = manualDecision.decisionCode || 'repeated';
        manualDecisionKey = manualDecision.storageKey || '';
        decisionEditable = true;
        decision = getSecondaryManualDecisionLabel(manualDecisionCode);
        decisionColor = getSecondaryManualDecisionColor(manualDecisionCode);
    } else if (directedBirthYear && birthYear > 0) {
        if (birthYear > directedBirthYear) {
            decision = 'يعيد';
            decisionColor = '#c0392b';
        } else {
            decision = 'يوجّه';
            decisionColor = '#7f8c8d';
        }
    } else {
        decision = 'يعيد';
        decisionColor = 'red';
    }

    return {
        annualAverage: annualAverage,
        annualAverageNum: annualAverageNum,
        decision: decision,
        decisionColor: decisionColor,
        decisionEditable: decisionEditable,
        manualDecisionCode: manualDecisionCode,
        manualDecisionKey: manualDecisionKey
    };
}

// NEW: Function to Update Decision Stats (T3 Only)

function legacyUpdateDecisionStats(data) {

    const trimesterSelect = document.getElementById('trimesterSelect');

    const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';

    const container = document.getElementById('decisionStatsContainer');

    const stage = institutionSettings.educationStage || 'middle';

    const levelSelect = document.getElementById('levelSelect');

    const levelValue = levelSelect ? levelSelect.value : '';

    const isFinalYear = (stage === 'secondary' && levelValue === '3') ||

        (stage !== 'secondary' && levelValue === '4');

    if (selectedTrimesterVal !== '3' || isFinalYear) {

        if (container) container.style.display = 'none';

        return;

    }

    if (container) container.style.display = 'block';

    const settings = institutionSettings;

    const directedBirthYear = parseInt(settings.directedBirthYear);

    let passed = 0;

    let remedial = 0;

    let repeated = 0;

    let directed = 0;

    data.forEach(s => {

        const avg1 = getTrimesterAverage(s, '1') || 0;

        const avg2 = getTrimesterAverage(s, '2') || 0;

        const avg3 = typeof getStudentAverage(s) === 'number' ? getStudentAverage(s) : parseFloat(getStudentAverage(s) || 0);

        const annualAvg = (avg1 + avg2 + avg3) / 3;

        if (annualAvg >= 10) {

            passed++;

        } else if (annualAvg >= 9) {

            remedial++;

        } else {

            // Annual Average < 9

            const birthYear = s.dob ? new Date(s.dob).getFullYear() : 0;

            if (directedBirthYear && birthYear > 0) {

                if (birthYear > directedBirthYear) {

                    repeated++;

                } else {

                    directed++;

                }

            } else {

                repeated++;

            }

        }

    });

    if (tbody) {

        tbody.innerHTML = `

            <tr>

                <td style="font-weight:bold; color:#27ae60;">${passed}</td>

                <td style="font-weight:bold; color:#d35400;">${remedial}</td>

                <td style="font-weight:bold; color:#c0392b;">${repeated}</td>

                <td style="font-weight:bold; color:#7f8c8d;">${directed}</td>

            </tr>

        `;

    }

}

// Student Details Modal Functions

let currentStudentsData = []; // Store reference to current filtered data

function stripHtmlTags(html) {

    return String(html || '').replace(/<[^>]*>/g, '').trim();

}

function getStudentModalSubjects(student) {

    const stage = institutionSettings.educationStage || 'middle';
    const selectedStream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : '';
    const selectedTrimesterVal = document.getElementById('trimesterSelect') ? document.getElementById('trimesterSelect').value : '1';
    let modalSubjects = [];

    if (stage === 'secondary') {
        const streamCode = selectedStream || student.stream || '';
        modalSubjects = streamCode ? SubjectManager.getSubjects(stage, student.level, streamCode) : [];
    } else {
        modalSubjects = getFilteredSubjects(student.level, subjects);
    }

    return getSubjectsForTrimester(modalSubjects, selectedTrimesterVal);

}

function getStudentScoreVisualState(score) {

    if (isNaN(score)) return 'neutral';
    if (score >= 10) return 'good';
    if (score >= 8) return 'warn';
    return 'low';

}

function getStudentScoreNote(score) {

    if (isNaN(score)) return '-';
    if (score >= 10) return 'متحصل على المعدل';
    if (score >= 8) return 'قريب من المعدل';
    return 'يحتاج دعم';

}

function buildStudentModalMarkup(student, marksRows, avg, trimesterVal) {

    const cleanAppreciation = stripHtmlTags(getAppreciation(avg)) || 'بدون تقدير';
    const avgState = getStudentScoreVisualState(avg);
    const passedCount = marksRows.filter(row => row.score >= 10).length;
    const weakCount = marksRows.filter(row => row.score < 10).length;
    const strongCount = marksRows.filter(row => row.score >= 15).length;
    const successRate = marksRows.length > 0 ? Math.round((passedCount / marksRows.length) * 100) : 0;
    const avgProgress = Math.max(0, Math.min(100, (avg / 20) * 100));
    const highestRow = marksRows.length > 0
        ? marksRows.reduce((best, row) => (row.score > best.score ? row : best), marksRows[0])
        : null;
    const lowestRow = marksRows.length > 0
        ? marksRows.reduce((worst, row) => (row.score < worst.score ? row : worst), marksRows[0])
        : null;
    const trimesterLabel = trimesterMap[trimesterVal] || trimesterVal || '-';
    const averageLabel = trimesterVal === 'annual' ? 'المعدل السنوي' : 'المعدل الفصلي';
    const avatarLetter = (student.name || '?').trim().charAt(0) || '?';
    const appreciationBadgeClass = avg >= 10 ? 'good' : (avg >= 8 ? 'warn' : 'low');

    const marksTableRows = marksRows.map((row, index) => {
        const scoreState = getStudentScoreVisualState(row.score);
        const scoreWidth = Math.max(8, Math.min(100, (row.score / 20) * 100));
        return `
            <tr>
                <td class="subject-cell">
                    <div class="student-subject-block">
                        <span class="student-subject-name">${index + 1}. ${row.subject}</span>
                        <span class="student-score-track">
                            <span class="student-score-fill ${scoreState}" style="width:${scoreWidth}%"></span>
                        </span>
                    </div>
                </td>
                <td><span class="student-score-pill ${scoreState}">${row.score.toFixed(2)}</span></td>
                <td><span class="student-score-note ${scoreState}">${getStudentScoreNote(row.score)}</span></td>
            </tr>
        `;
    }).join('');

    return `
        <div class="student-hero">
            <div class="student-meta-card">
                <span class="student-meta-eyebrow">ملف أكاديمي تفصيلي</span>
                <div class="student-meta-top">
                    <div class="student-name-block">
                        <div class="student-avatar">${avatarLetter}</div>
                        <div>
                            <h4>${student.name || '-'}</h4>
                            <p>بطاقة تفصيلية للنقاط والنتائج</p>
                        </div>
                    </div>
                    <span class="student-badge ${appreciationBadgeClass}">${cleanAppreciation}</span>
                </div>
                <div class="student-chip-row">
                    <span class="student-chip">الفترة: ${trimesterLabel}</span>
                    <span class="student-chip">عدد المواد: ${marksRows.length}</span>
                    <span class="student-chip good">فوق المعدل: ${passedCount}</span>
                    <span class="student-chip low">دون المعدل: ${weakCount}</span>
                </div>
                <div class="student-meta-grid">
                    <div class="student-meta-item">
                        <span class="label">المستوى</span>
                        <span class="value">${student.level || '-'}</span>
                    </div>
                    <div class="student-meta-item">
                        <span class="label">القسم</span>
                        <span class="value">${student.class || '-'}</span>
                    </div>
                    <div class="student-meta-item">
                        <span class="label">الجنس</span>
                        <span class="value">${student.gender || '-'}</span>
                    </div>
                    <div class="student-meta-item">
                        <span class="label">تاريخ الميلاد</span>
                        <span class="value">${formatDate(student.dob) || '-'}</span>
                    </div>
                    <div class="student-meta-item">
                        <span class="label">الفترة</span>
                        <span class="value">${trimesterLabel}</span>
                    </div>
                    <div class="student-meta-item">
                        <span class="label">عدد المواد المعروضة</span>
                        <span class="value">${marksRows.length}</span>
                    </div>
                </div>
            </div>

            <div class="student-summary-card">
                <div class="student-summary-top">
                    <h4>لوحة الأداء</h4>
                    <span class="student-summary-kicker">رؤية سريعة لحالة التلميذ</span>
                </div>
                <div class="student-average-panel ${avgState}">
                    <span class="panel-label">${averageLabel}</span>
                    <span class="panel-value">${avg.toFixed(2)}</span>
                    <span class="panel-hint">يمثل ${avgProgress.toFixed(0)}% من السلم العام</span>
                    <div class="student-panel-meter">
                        <span class="student-panel-meter-track">
                            <span class="student-panel-meter-fill" style="width:${avgProgress}%"></span>
                        </span>
                        <div class="student-panel-meter-labels">
                            <span>0</span>
                            <span>10</span>
                            <span>20</span>
                        </div>
                    </div>
                </div>
                <div class="student-summary-grid">
                    <div class="student-stat">
                        <span class="label">نسبة النجاح في المواد</span>
                        <span class="value">${successRate}%</span>
                        <span class="hint">${passedCount} من ${marksRows.length || 0} مادة</span>
                    </div>
                    <div class="student-stat">
                        <span class="label">التقدير</span>
                        <span class="value" style="font-size:1.05rem;">${cleanAppreciation}</span>
                        <span class="hint">حسب عتبات المؤسسة</span>
                    </div>
                    <div class="student-stat">
                        <span class="label">أعلى نقطة</span>
                        <span class="value">${highestRow ? highestRow.score.toFixed(2) : '-'}</span>
                        <span class="hint">${highestRow ? highestRow.subject : 'لا توجد بيانات'}</span>
                    </div>
                    <div class="student-stat">
                        <span class="label">أدنى نقطة</span>
                        <span class="value">${lowestRow ? lowestRow.score.toFixed(2) : '-'}</span>
                        <span class="hint">${lowestRow ? lowestRow.subject : 'لا توجد بيانات'}</span>
                    </div>
                    <div class="student-stat">
                        <span class="label">مواد قوية</span>
                        <span class="value">${strongCount}</span>
                        <span class="hint">مواد بنتيجة 15 فما فوق</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="student-scores-card">
            <div class="student-scores-head">
                <div class="student-scores-title">
                    <div>
                        <h4>تفصيل النقاط حسب المواد</h4>
                        <span class="student-scores-subtitle">تم ترتيب المواد حسب البرنامج الدراسي لسهولة القراءة</span>
                    </div>
                    <div class="student-chip-row">
                        <span class="student-chip good">ناجحة: ${passedCount}</span>
                        <span class="student-chip low">تحتاج متابعة: ${weakCount}</span>
                    </div>
                </div>
            </div>
            <div class="student-scores-table-wrap">
                <table class="student-scores-table">
                    <thead>
                        <tr>
                            <th>المادة</th>
                            <th>النقطة</th>
                            <th>الملاحظة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${marksTableRows || `<tr><td colspan="3" style="padding:20px;color:#64748b;">لا توجد نقاط متاحة لهذا التلميذ</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;

}

function showStudentModal(studentId) {

    const student = currentStudentsData.find(s => s.id == studentId);

    if (!student) return;

    const modal = document.getElementById('studentModal');

    const nameEl = document.getElementById('studentModalName');

    const bodyEl = document.getElementById('studentModalBody');

    nameEl.textContent = `تفاصيل التلميذ`;
    const trimesterVal = document.getElementById('trimesterSelect').value;
    const activeSubjects = getStudentModalSubjects(student);
    const marksRows = activeSubjects.map(subjectName => {
        const rawScore = trimesterVal === 'annual'
            ? getAnnualSubjectScore(student, subjectName)
            : getSubjectScore(student, subjectName, trimesterVal);
        const score = parseAnalysisNumber(rawScore);

        if (rawScore === null || rawScore === undefined || rawScore === '' || isNaN(score)) {
            return null;
        }

        return {
            subject: subjectName,
            score: score
        };
    }).filter(Boolean);

    const avg = typeof getStudentAverage(student) === 'number'
        ? getStudentAverage(student)
        : parseFloat(getStudentAverage(student) || 0);

    bodyEl.innerHTML = buildStudentModalMarkup(student, marksRows, avg, trimesterVal);
    modal.style.display = 'flex';

}

function closeStudentModal() {

    document.getElementById('studentModal').style.display = 'none';

}

// Close modal when clicking outside

document.addEventListener('click', (e) => {

    const modal = document.getElementById('studentModal');

    if (e.target === modal) {

        closeStudentModal();

    }

});

// ============================================
// PRINT COUNCIL REPORT (محضر مجلس الأقسام)
// ============================================

async function printCouncilReport() {
    // 1. Gather current filter selections
    const selectedLevel = document.getElementById('levelSelect').value;
    const selectedClass = document.getElementById('classSelect').value;
    const selectedTrimesterVal = document.getElementById('trimesterSelect').value;

    const yearSelect = document.getElementById('yearSelect');
    const selectedYear = yearSelect ? yearSelect.value : (institutionSettings.schoolYear || '.......');

    if (!selectedLevel || !selectedClass || !selectedTrimesterVal) {
        if (typeof showToast === 'function') {
            showToast('يرجى اختيار الفصل والمستوى والقسم أولاً', 'warning');
        }
        return;
    }

    const trimesterNames = { '1': 'الأول', '2': 'الثاني', '3': 'الثالث' };
    const trimesterName = trimesterNames[selectedTrimesterVal] || selectedTrimesterVal;

    // 2. Get settings and data
    const settings = institutionSettings || {};
    const stage = settings.educationStage || 'middle';
    const stageName = stage === 'secondary' ? 'الثانوي' : 'المتوسط';

    // Stream info for secondary
    let streamInfo = '';
    if (stage === 'secondary') {
        const streamSelect = document.getElementById('streamSelect');
        const selectedStreamCode = streamSelect ? streamSelect.value : '';
        if (selectedStreamCode && typeof SubjectManager !== 'undefined') {
            streamInfo = ` - الشعبة: ${SubjectManager.getStreamName(selectedStreamCode)}`;
        }
    }

    // 3. Get teachers who teach this class
    const assignments = await DB.get('teacherAssignments') || {};
    const classTeachers = [];
    const classNum = String(selectedClass).padStart(2, '0');
    const classNumRaw = String(selectedClass);

    // Build expected class identifiers in the standard format: levelNum + separator + classNum
    // The assignment system stores classes as e.g. "1م01", "3ث02"
    // We need to figure out the level number from selectedLevel
    const levelNumMap = { 'أولى': '1', 'ثانية': '2', 'ثالثة': '3', 'رابعة': '4' };
    const levelNum = levelNumMap[selectedLevel] || selectedLevel;
    const separatorChar = stage === 'secondary' ? 'ث' : 'م';
    const expectedClassId = `${levelNum}${separatorChar}${classNum}`;

    // Get selected stream for secondary filtering
    const filterStream = (stage === 'secondary' && document.getElementById('streamSelect'))
        ? document.getElementById('streamSelect').value : '';
    const techMathVariants = ['tech_math', 'tech_math_civil', 'tech_math_elec', 'tech_math_methods', 'tech_math_mech'];

    // Search all teachers for those who have this class in their schedule
    for (const [teacherId, days] of Object.entries(assignments)) {
        let teachesThisClass = false;

        for (const [dayName, periods] of Object.entries(days)) {
            for (const [periodId, entry] of Object.entries(periods)) {
                let assignedClass = '';
                let assignedStream = '';
                if (typeof entry === 'object' && entry.class) {
                    assignedClass = entry.class;
                    assignedStream = entry.stream || '';
                } else if (typeof entry === 'string') {
                    assignedClass = entry;
                }

                if (assignedClass) {
                    // Exact match against the expected class identifier
                    // e.g. "1م01" === "1م01"
                    let matchFound = (assignedClass === expectedClassId);

                    // Fallback: parse the assigned class to extract level and class numbers
                    if (!matchFound) {
                        const parsed = assignedClass.match(/^(\d+)[مث](\d+)$/);
                        if (parsed) {
                            const aLevel = parsed[1];
                            const aClass = String(parseInt(parsed[2]));
                            matchFound = (aLevel === levelNum) &&
                                (aClass === classNumRaw || parsed[2] === classNum);
                        }
                    }

                    // For secondary: also check stream matches
                    if (matchFound && filterStream && assignedStream) {
                        const isTechMathSelected = techMathVariants.includes(filterStream);
                        const isTechMathAssigned = techMathVariants.includes(assignedStream);
                        if (isTechMathSelected && isTechMathAssigned) {
                            // Both are tech_math variants, consider it a match
                        } else if (assignedStream !== filterStream) {
                            matchFound = false;
                        }
                    }

                    if (matchFound) {
                        teachesThisClass = true;
                        break;
                    }
                }
            }
            if (teachesThisClass) break;
        }

        if (teachesThisClass) {
            const teacher = teachersList.find(t => t.id === teacherId);
            if (teacher) {
                classTeachers.push({
                    name: `${teacher.last_name} ${teacher.first_name}`,
                    subject: teacher.subject || ''
                });
            }
        }
    }

    // Sort teachers alphabetically
    classTeachers.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    const customSettings = JSON.parse(localStorage.getItem('councilSettings')) || {};
    if (customSettings.counselor) {
        classTeachers.unshift({ name: `مستشار التوجيه: ${customSettings.counselor}`, subject: '' });
    }
    if (customSettings.censor) {
        classTeachers.unshift({ name: `الناظر: ${customSettings.censor}`, subject: '' });
    }
    if (customSettings.director) {
        classTeachers.unshift({ name: `المدير: ${customSettings.director}`, subject: '' });
    }

    // 4. Get class responsible teacher
    const responsibleName = getClassResponsibleName(selectedLevel, selectedClass);

    // 4b. Compute class data for page 2
    const selectedStream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : '';
    const classStudents = studentsData.filter(s => {
        const matchLevel = s.level == selectedLevel;
        const matchClass = s.class == selectedClass;
        const matchStream = selectedStream ? (s.stream === selectedStream) : true;
        return matchLevel && matchClass && matchStream;
    });

    // Get active subjects for this class
    let reportSubjects = [];
    if (stage === 'secondary') {
        const streamCode = selectedStream || (classStudents.length > 0 ? classStudents[0].stream : '');
        if (streamCode && typeof SubjectManager !== 'undefined') {
            reportSubjects = SubjectManager.getSubjects(stage, selectedLevel, streamCode);
        }
    } else {
        reportSubjects = typeof getFilteredSubjects === 'function' ? getFilteredSubjects(selectedLevel, subjects) : (subjects || []);
    }

    reportSubjects = getSubjectsForTrimester(reportSubjects, selectedTrimesterVal);

    // Compute subject statistics
    const subjectStats = reportSubjects.map(sub => {
        const scores = classStudents.map(s => getSubjectScore(s, sub, selectedTrimesterVal)).filter(m => m !== null && m !== undefined);
        const total = scores.length;
        const avg = total > 0 ? (scores.reduce((a, b) => a + b, 0) / total).toFixed(2) : '-';
        const ranges = {
            r0_8: scores.filter(s => s < 8).length,
            r8_10: scores.filter(s => s >= 8 && s < 10).length,
            r10_12: scores.filter(s => s >= 10 && s < 12).length,
            r12_15: scores.filter(s => s >= 12 && s < 15).length,
            r15_20: scores.filter(s => s >= 15).length
        };
        return { name: sub, total, avg, ranges };
    });

    // Compute class general stats
    const classAvgs = classStudents.map(s => getTrimesterAverage(s, selectedTrimesterVal)).filter(a => a > 0);
    const totalStudents = classStudents.length;
    const passCount = classAvgs.filter(a => a >= 10).length;
    const failCount = totalStudents - passCount;
    const classAvg = classAvgs.length > 0 ? (classAvgs.reduce((a, b) => a + b, 0) / classAvgs.length).toFixed(2) : '-';

    // Highest / Lowest average with student name
    let highestAvg = 0, highestName = '-', lowestAvg = 20, lowestName = '-';
    classStudents.forEach(s => {
        const avg = getTrimesterAverage(s, selectedTrimesterVal);
        if (avg > 0) {
            if (avg > highestAvg) { highestAvg = avg; highestName = `${s.name || (s.last_name + ' ' + s.first_name)}`; }
            if (avg < lowestAvg) { lowestAvg = avg; lowestName = `${s.name || (s.last_name + ' ' + s.first_name)}`; }
        }
    });

    // Gender stats
    const males = classStudents.filter(s => s.gender === 'ذكر' || s.gender === 'M');
    const females = classStudents.filter(s => s.gender === 'أنثى' || s.gender === 'F');
    const malePass = males.filter(s => getTrimesterAverage(s, selectedTrimesterVal) >= 10).length;
    const femalePass = females.filter(s => getTrimesterAverage(s, selectedTrimesterVal) >= 10).length;
    const maleFail = males.length - malePass;
    const femaleFail = females.length - femalePass;
    const pct = (n, t) => t > 0 ? (n / t * 100).toFixed(1) + '%' : '-';

    const todayObj = new Date();
    const today = `${todayObj.getFullYear()}/${String(todayObj.getMonth() + 1).padStart(2, '0')}/${String(todayObj.getDate()).padStart(2, '0')}`;

    // 5. Build attendance table (2 columns)
    const totalTeachers = classTeachers.length;
    const maxRows = Math.max(Math.ceil(totalTeachers / 2), 7);
    const col1 = classTeachers.slice(0, maxRows);
    const col2 = classTeachers.slice(maxRows);

    // Abbreviate long subject names for the council report
    const shortenSubject = (s) => {
        if (!s) return '';
        return s
            .replace(/العلوم الفيزيائية والتكنولوجيا/g, 'ع فيزيائية')
            .replace(/التربية البدنية والرياضية/g, 'ت بدنية');
    };

    let attendanceRows = '';
    for (let i = 0; i < maxRows; i++) {
        const t1 = col1[i];
        const t2 = col2[i];
        const num1 = String(i + 1).padStart(2, '0');
        const num2 = String(i + maxRows + 1).padStart(2, '0');

        attendanceRows += `
            <tr>
                <td class="cell num-cell">${t1 || i < 7 ? num1 : ''}</td>
                <td class="cell name-cell">${t1 ? t1.name + (t1.subject ? ' (' + shortenSubject(t1.subject) + ')' : '') : ''}</td>
                <td class="cell"></td>
                <td class="cell num-cell">${t2 || i < 7 ? num2 : ''}</td>
                <td class="cell name-cell">${t2 ? t2.name + (t2.subject ? ' (' + shortenSubject(t2.subject) + ')' : '') : ''}</td>
                <td class="cell"></td>
            </tr>
        `;
    }

    // Absent table (2 rows x 2 columns)
    let absentRows = '';
    for (let i = 0; i < 2; i++) {
        absentRows += `
            <tr>
                <td class="cell num-cell">${String(i + 1).padStart(2, '0')}</td>
                <td class="cell name-cell"></td>
                <td class="cell"></td>
                <td class="cell num-cell">${String(i + 3).padStart(2, '0')}</td>
                <td class="cell name-cell"></td>
                <td class="cell"></td>
            </tr>
        `;
    }

    // Get custom settings
    // customSettings already loaded above
    const councilDate = customSettings.date || '..../..../........';
    const councilTime = customSettings.time || '..................';

    // Deliberations texts
    const defaultDelib2 = "- تغيبات التلاميذ قليلة جدا وإن وُجدت يتم معالجتها بالطرق القانونية للتربية ( إحضار الولي أو ما يبرر ذلك..... )\n- لم يتم تسجيل مخالفات تتنافى مع التنظيم الداخلي للمؤسسة.\n- المراقبة اليومية للتلاميذ و مرافقتهم تربويا ونفسيا ومعالجة النقائص في حينها.";
    const defaultDelib5 = "0-9.99 - عليك بالعمل أكثر لتدارك النقائص.    10-11.99 - استفاقة ملحوظة عليك بمواصلة التركيز والجدية لتحسينه.\n12-14.99 - نتائج حسنة ننتظر منك الأفضل.    14.99-15 - عمل يستحق الشكر و التقدير واصل / واصلي.\n15-20.00 - قدرات وإمكانات متميزة نتمنى لك التوفيق.";
    const defaultDelib6 = "- متابعة ملامح التوجيه الأولي للتلميذ.\n- تشجيع التلميذ قدر المستطاع لتحقيق التوجيه الذي يصبو إليه.\n- مرافقة مستشار التوجيه و الإرشاد المدرسي و المهني للتلميذ.";

    const d2 = customSettings.delib2 || defaultDelib2;
    const delib2Html = d2.split('\n').map(l => `<div>${l}</div>`).join('');

    let d5 = customSettings.delib5 || defaultDelib5;
    // Auto bold numeric ranges like 0-9.99 or 15-20.00
    d5 = d5.replace(/(\d+(?:\.\d+)?-\d+(?:\.\d+)?)/g, '<strong>$1</strong>');
    const delib5Html = `<div style="line-height: 1.9;">${d5.split('\n').map(l => `<div>${l}</div>`).join('')}</div>`;

    const d6 = customSettings.delib6 || defaultDelib6;
    const delib6Html = d6.split('\n').map(l => `<div>${l}</div>`).join('');

    // Agenda handling
    let agendaHtml = '';
    if (customSettings.agenda && customSettings.agenda.trim() !== '') {
        const lines = customSettings.agenda.split('\n').filter(l => l.trim() !== '');
        agendaHtml = lines.map(l => `<div>${l}</div>`).join('');
    } else {
        agendaHtml = `
            <div>1 - تحليل ظروف تطبيق المناهج التعليمية واتخاذ الإجراءات الملائمة لمعالجة النقائص المسجلة.</div>
            <div>2 - تشخيص الوضعية المتعلقة بمواظبة التلاميذ وانضباطهم.</div>
            <div>3 - تحليل النتائج المدرسية.</div>
            <div>4 - تقييم عمل التلميذ بالاعتماد على النتائج المحصل عليها.</div>
            <div>5 - تدوين الملاحظات المستخلصة على كشوف التلاميذ.</div>
            <div>6 - دراسة و مناقشة التوجيه التدريجي للتلميذ.</div>
        `;
    }

    const reportHtml = `
        <div class="report-wrapper">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 2px;">
                <div style="font-weight: bold; font-size: 13pt;">الجمهورية الجزائرية الديمقراطية الشعبية</div>
                <div style="font-size: 12pt;">وزارة التربية الوطنية</div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 11pt;">
                <div style="text-align: right;">
                    <div>مديرية التربية لولاية: <strong>${settings.wilaya || '.......'}</strong></div>
                    <div>المؤسسة: <strong>${settings.institutionName || '.......................'}</strong></div>
                </div>
                <div style="text-align: left;">
                    <div>الموسم الدراسي: <strong>${selectedYear}</strong></div>
                </div>
            </div>

            <!-- Title -->
            <div style="text-align: center; margin: 6px 0 4px; border: 2px solid #000; padding: 4px;">
                <div style="font-size: 14pt; font-weight: bold;">محضر مجلس الأقسام للثلاثي ${trimesterName}</div>
                <div style="font-size: 11pt; margin-top: 1px;">المستوى: ${selectedLevel} - القسم: ${classNum}${streamInfo}${responsibleName ? ` | مسؤول القسم: ${responsibleName}` : ''}</div>
            </div>

            <!-- Reference -->
            <div style="font-size: 11pt; margin-bottom: 2px;">
                <strong>المرجع:</strong> القرار رقم 68 المؤرخ في 12 جويلية 2018 المحدد لكيفيات إنشاء مجلس القسم في المتوسطة والثانوية وسيره.
            </div>

            <div style="font-size: 11pt; margin-bottom: 1px;">
                في يوم: ${councilDate}  في الساعة: ${councilTime}  انعقد مجلس القسم: <strong>${stage === 'secondary' ? selectedLevel + (typeof SubjectManager !== 'undefined' ? SubjectManager.getStreamAbbreviation(selectedStream) : '') + classNum : selectedLevel + 'م' + classNum}</strong>
            </div>
            <div style="font-size: 11pt; margin-bottom: 4px;">
                تحت إشراف السيد/ مدير المؤسسة، بحضور أعضاء الفريق الإداري والأساتذة المذكورين أدناه
            </div>

            <!-- Attendance -->
            <div class="section-title">الحاضرون:</div>
            <table class="report-table tight-table" style="font-size: 10.5pt;" cellpadding="0">
                <thead>
                    <tr>
                        <th class="cell" style="width:5%; padding: 0;">الرقم</th>
                        <th class="cell" style="width:25%; padding: 0;">اللقب والاسم (المادة)</th>
                        <th class="cell" style="width:12%; padding: 0;">التوقيع</th>
                        <th class="cell" style="width:5%; padding: 0;">الرقم</th>
                        <th class="cell" style="width:25%; padding: 0;">اللقب والاسم (المادة)</th>
                        <th class="cell" style="width:12%; padding: 0;">التوقيع</th>
                    </tr>
                </thead>
                <tbody>${attendanceRows}</tbody>
            </table>

            <!-- Absent -->
            <div class="section-title">الغياب:</div>
            <table class="report-table tight-table" style="font-size: 10.5pt;" cellpadding="0">
                <thead>
                    <tr>
                        <th class="cell" style="width:5%;">الرقم</th>
                        <th class="cell" style="width:25%;">اللقب والاسم (المادة)</th>
                        <th class="cell" style="width:12%;">التوقيع</th>
                        <th class="cell" style="width:5%;">الرقم</th>
                        <th class="cell" style="width:25%;">اللقب والاسم (المادة)</th>
                        <th class="cell" style="width:12%;">التوقيع</th>
                    </tr>
                </thead>
                <tbody>${absentRows}</tbody>
            </table>

            <!-- Agenda -->
            <div class="section-title" style="margin-top: 12px;">جدول الأعمال:</div>
            <div class="agenda-list">
                ${agendaHtml}
            </div>

            <!-- Deliberations -->
            <div class="section-title" style="margin-top: 8px;">المداولات:</div>
            <div class="deliberations">
                <div class="delib-item"><strong>1 - تحليل ظروف تطبيق المناهج التعليمية واتخاذ الإجراءات الملائمة لمعالجة النقائص المسجلة.</strong></div>
                <div class="delib-sub">
                    <div class="delib-sub-title">- الإجراءات المتخذة بخصوص النقائص:</div>
                    <div class="dotted-line"></div>
                    <div class="dotted-line"></div>
                </div>

                <div class="delib-item"><strong>2 - تشخيص الوضعية المتعلقة بمواظبة التلاميذ وانضباطهم:</strong></div>
                <div class="delib-sub">
                    ${delib2Html}
                </div>

                <div class="delib-item page-break-here"><strong>3 - تحليل النتائج المدرسية:</strong></div>
                <div class="delib-sub">
                    <table class="report-table" style="font-size: 10pt;" cellpadding="0">
                        <thead>
                            <tr>
                                <th class="cell" style="width:15%;">المادة</th>
                                <th class="cell" style="width:5%;">ع-التلاميذ</th>
                                <th class="cell" style="width:7%;">م-المادة</th>
                                <th class="cell" style="width:5%;">النسبة</th>
                                <th class="cell" style="width:5%;">0-8</th>
                                <th class="cell" style="width:5%;">8-9.99</th>
                                <th class="cell" style="width:5%;">10-11.99</th>
                                <th class="cell" style="width:5%;">12-14.99</th>
                                <th class="cell" style="width:5%;">15-20</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${subjectStats.map(s => {
        const passRate = s.total > 0 ? ((s.ranges.r10_12 + s.ranges.r12_15 + s.ranges.r15_20) / s.total * 100).toFixed(2) + '%' : '-';
        return `
                                <tr>
                                    <td class="cell name-cell">${s.name}</td>
                                    <td class="cell">${s.total}</td>
                                    <td class="cell">${s.avg}</td>
                                    <td class="cell">${passRate}</td>
                                    <td class="cell">${s.ranges.r0_8 || ''}</td>
                                    <td class="cell">${s.ranges.r8_10 || ''}</td>
                                    <td class="cell">${s.ranges.r10_12 || ''}</td>
                                    <td class="cell">${s.ranges.r12_15 || ''}</td>
                                    <td class="cell">${s.ranges.r15_20 || ''}</td>
                                </tr>
                            `}).join('')}
                            <tr style="font-weight: bold; background: #f0f0f0;">
                                <td class="cell name-cell">معدل القسم</td>
                                <td class="cell">${totalStudents}</td>
                                <td class="cell">${classAvg}</td>
                                <td class="cell">${totalStudents > 0 ? ((passCount / totalStudents) * 100).toFixed(2) + '%' : '-'}</td>
                                <td class="cell" colspan="5"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="delib-item"><strong>4 - تقييم عمل التلميذ بالاعتماد على النتائج المحصل عليها.</strong></div>
                <div class="delib-sub">
                    <div style="font-weight: bold; margin: 8px 0 4px;">دراسة النتائج العامة للتلميذ والقسم:</div>
                    <table class="report-table" style="font-size: 9.5pt;" cellpadding="0">
                        <thead>
                            <tr>
                                <th class="cell">القسم</th>
                                <th class="cell">عدد التلاميذ</th>
                                <th class="cell">الحاصلون على المعدل</th>
                                <th class="cell">غ. الحاصلين على المعدل</th>
                                <th class="cell">أعلى معدل (اسم التلميذ)</th>
                                <th class="cell">أدنى معدل (اسم التلميذ)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="cell">${stage === 'secondary' ? selectedLevel + (typeof SubjectManager !== 'undefined' ? SubjectManager.getStreamAbbreviation(selectedStream) : '') + classNum : selectedLevel + 'م' + classNum}</td>
                                <td class="cell">${totalStudents}</td>
                                <td class="cell">${passCount}</td>
                                <td class="cell">${failCount}</td>
                                <td class="cell">${highestAvg.toFixed(2)} (${highestName})</td>
                                <td class="cell">${lowestAvg.toFixed(2)} (${lowestName})</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style="font-weight: bold; margin: 10px 0 4px;">دراسة المعدلات العامة حسب الجنس :</div>
                    <table class="report-table" style="font-size: 9pt;" cellpadding="0">
                        <thead>
                            <tr>
                                <th class="cell" rowspan="2">القسم</th>
                                <th class="cell" rowspan="2">م</th>
                                <th class="cell" rowspan="2">عدد التلاميذ</th>
                                <th class="cell" colspan="4" style="background:#d4edda;">الحاصلون على المعدل</th>
                                <th class="cell" colspan="4" style="background:#f8d7da;">غير الحاصلين على المعدل</th>
                            </tr>
                            <tr>
                                <th class="cell">ذكور</th>
                                <th class="cell">النسبة</th>
                                <th class="cell">إناث</th>
                                <th class="cell">النسبة</th>
                                <th class="cell">ذكور</th>
                                <th class="cell">النسبة</th>
                                <th class="cell">إناث</th>
                                <th class="cell">النسبة</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="cell">${stage === 'secondary' ? selectedLevel + (typeof SubjectManager !== 'undefined' ? SubjectManager.getStreamAbbreviation(selectedStream) : '') + classNum : selectedLevel + 'م' + classNum}</td>
                                <td class="cell">${classAvg}</td>
                                <td class="cell">${totalStudents}</td>
                                <td class="cell">${malePass}</td>
                                <td class="cell">${pct(malePass, males.length)}</td>
                                <td class="cell">${femalePass}</td>
                                <td class="cell">${pct(femalePass, females.length)}</td>
                                <td class="cell">${maleFail}</td>
                                <td class="cell">${pct(maleFail, males.length)}</td>
                                <td class="cell">${femaleFail}</td>
                                <td class="cell">${pct(femaleFail, females.length)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="delib-item"><strong>5 - تدوين الملاحظات المستخلصة على كشوف التلاميذ.</strong></div>
                <div class="delib-sub">
                    ${delib5Html}
                </div>

                <div class="delib-item"><strong>6 - دراسة و مناقشة التوجيه التدريجي للتلميذ.</strong></div>
                <div class="delib-sub">
                    ${delib6Html}
                </div>
            </div>

            <!-- Signatures -->
            <div style="margin-top: 5px; font-weight: bold; font-size: 11pt; padding: 0 40px; page-break-inside: avoid;">
                <div style="text-align: left; margin-bottom: 20px;">حرر بـ: ${settings.municipality || '........'} في: ${today}</div>
                <div style="display: flex; justify-content: space-between;">
                    <div style="text-align: right;">إمضاء كاتب الجلسة</div>
                    <div style="text-align: left;">إمضاء المدير</div>
                </div>
            </div>
        </div>
    `;

    // 6. Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>محضر مجلس الأقسام - ${selectedLevel} ${classNum}</title>
                <style>
                    @font-face {
                        font-family: 'Cairo';
                        src: url('../assets/fonts/Cairo-Regular.ttf') format('truetype');
                        font-weight: 400;
                    }
                    @font-face {
                        font-family: 'Cairo';
                        src: url('../assets/fonts/Cairo-Bold.ttf') format('truetype');
                        font-weight: 700;
                    }
                    body {
                        margin: 0; padding: 0; background: #fff;
                        font-family: 'Cairo', sans-serif;
                    }
                    .report-wrapper {
                        direction: rtl; padding: 0; font-size: 12pt; line-height: 1.5;
                    }
                    .section-title {
                        font-weight: bold; font-size: 13pt; margin-bottom: 2px; text-decoration: underline;
                    }
                    .report-table {
                        width: 100%; border-collapse: collapse; margin-bottom: 5px; direction: rtl;
                    }
                    .report-table .cell {
                        border: 1px solid #000; padding: 4px; text-align: center;
                    }
                    .report-table.tight-table .cell {
                        padding: 2px 4px !important;
                    }
                    .report-table .name-cell { text-align: right; }
                    .report-table .num-cell { text-align: center; font-weight: bold; }
                    .report-table thead th { background: #eee; font-weight: bold; }
                    .agenda-list { font-size: 12pt; padding-right: 10px; line-height: 1.6; }
                    .deliberations { font-size: 11.5pt; padding-right: 5px; line-height: 1.6; }
                    .delib-item { margin-top: 5px; }
                    .delib-sub { margin-right: 15px; margin-bottom: 5px; }
                    .delib-sub-title { font-weight: bold; margin-bottom: 2px; }
                    .dotted-line {
                        border-bottom: 1px dotted #999; min-height: 18px; margin-bottom: 4px;
                    }
                    .report-footer {
                        display: flex; justify-content: space-between; margin-top: 20px;
                        font-size: 10pt; color: #555; border-top: 1px solid #ccc; padding-top: 8px;
                    }
                    @media print {
                        @page { size: A4; margin: 0.6cm; }
                        body { -webkit-print-color-adjust: exact; }
                        .page-break-here { page-break-before: always; break-before: page; margin-top: 0; padding-top: 10px; }
                    }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; }
                </style>
            \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>
            <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
                ${reportHtml}
                <script>
                    window.onload = function() {
                        setTimeout(() => { // window.print(); /* Replaced by global Toolbar */ }, 500);
                    }
                </script>
            \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>
            </html>
        `);
        printWindow.document.close();
    } else {
        if (typeof showToast === 'function') {
            showToast('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير', 'warning');
        }
    }
}

// ==========================================
// Council Settings Modal Functions
// ==========================================
function openCouncilSettings() {
    const modal = document.getElementById('councilSettingsModal');
    if (!modal) return;

    const defaultDelib2 = "- تغيبات التلاميذ قليلة جدا وإن وُجدت يتم معالجتها بالطرق القانونية للتربية ( إحضار الولي أو ما يبرر ذلك..... )\n- لم يتم تسجيل مخالفات تتنافى مع التنظيم الداخلي للمؤسسة.\n- المراقبة اليومية للتلاميذ و مرافقتهم تربويا ونفسيا ومعالجة النقائص في حينها.";
    const defaultDelib5 = "0-9.99 - عليك بالعمل أكثر لتدارك النقائص.    10-11.99 - استفاقة ملحوظة عليك بمواصلة التركيز والجدية لتحسينه.\n12-14.99 - نتائج حسنة ننتظر منك الأفضل.    14.99-15 - عمل يستحق الشكر و التقدير واصل / واصلي.\n15-20.00 - قدرات وإمكانات متميزة نتمنى لك التوفيق.";
    const defaultDelib6 = "- متابعة ملامح التوجيه الأولي للتلميذ.\n- تشجيع التلميذ قدر المستطاع لتحقيق التوجيه الذي يصبو إليه.\n- مرافقة مستشار التوجيه و الإرشاد المدرسي و المهني للتلميذ.";

    // Load existing settings
    const settings = JSON.parse(localStorage.getItem('councilSettings')) || {};
    document.getElementById('councilDirectorInput').value = settings.director || '';
    document.getElementById('councilCensorInput').value = settings.censor || '';
    document.getElementById('councilCounselorInput').value = settings.counselor || '';

    document.getElementById('councilDateInput').value = settings.date || '';
    document.getElementById('councilTimeInput').value = settings.time || '';
    document.getElementById('councilAgendaInput').value = settings.agenda || '';

    document.getElementById('councilDelib2Input').value = settings.delib2 || defaultDelib2;
    document.getElementById('councilDelib5Input').value = settings.delib5 || defaultDelib5;
    document.getElementById('councilDelib6Input').value = settings.delib6 || defaultDelib6;

    modal.style.display = 'flex';
}

function closeCouncilSettings() {
    const modal = document.getElementById('councilSettingsModal');
    if (modal) modal.style.display = 'none';
}

function saveCouncilSettings() {
    const director = document.getElementById('councilDirectorInput').value.trim();
    const censor = document.getElementById('councilCensorInput').value.trim();
    const counselor = document.getElementById('councilCounselorInput').value.trim();

    const date = document.getElementById('councilDateInput').value.trim();
    const time = document.getElementById('councilTimeInput').value.trim();
    const agenda = document.getElementById('councilAgendaInput').value.trim();

    const delib2 = document.getElementById('councilDelib2Input').value.trim();
    const delib5 = document.getElementById('councilDelib5Input').value.trim();
    const delib6 = document.getElementById('councilDelib6Input').value.trim();

    const settings = { director, censor, counselor, date, time, agenda, delib2, delib5, delib6 };
    localStorage.setItem('councilSettings', JSON.stringify(settings));

    closeCouncilSettings();
    if (typeof showToast === 'function') {
        showToast('تم حفظ إعدادات المحضر بنجاح', 'success');
    }
}

// ---- INJECTED PE EXEMPTION WRAPPER ----
function getSubjectScore(...args) {
    const student = args[0];
    const trimesterSelect = document.getElementById('trimesterSelect');
    const effectiveTrimester = args[2] || (trimesterSelect ? trimesterSelect.value : '1');
    let score = _orig_getSubjectScore(...args);
    let targetSub = args[1] ? args[1].toString().trim() : '';
    if (effectiveTrimester === 'annual') {
        return getAnnualSubjectScore(student, targetSub);
    }
    if (score !== null && score !== undefined && (targetSub === 'رياضة' || targetSub.includes('بدنية') || targetSub.includes('رياضية'))) {
        let num = typeof score === 'string' ? parseFloat(score.replace(',', '.')) : parseFloat(score);
        if (num === 0 || isNaN(num)) return null;
    }
    return score;
}

function getAnnualSubjectScore(student, targetSub) {
    const trimesterScores = ['1', '2', '3'].map(trimesterVal => getSubjectScore(student, targetSub, trimesterVal));
    const numericScores = trimesterScores.map(score => {
        if (score === null || score === undefined || score === '') return null;
        const numericValue = parseAnalysisNumber(score);
        return isNaN(numericValue) ? null : numericValue;
    });

    if (numericScores.some(score => score === null)) {
        return null;
    }

    return (numericScores.reduce((sum, score) => sum + score, 0) / numericScores.length).toFixed(2);
}

if (typeof _orig_getSubjectScoreByTrimester === 'function') {
    globalThis.getSubjectScoreByTrimester = function (...args) {
        let score = _orig_getSubjectScoreByTrimester(...args);
        let targetSub = args[1] ? args[1].toString().trim() : '';
        if (score !== null && score !== undefined && (targetSub === 'رياضة' || targetSub.includes('بدنية') || targetSub.includes('رياضية'))) {
            let num = typeof score === 'string' ? parseFloat(score.replace(',', '.')) : parseFloat(score);
            if (num === 0 || isNaN(num)) return null;
        }
        return score;
    }
}


// --- Excel Export ---
let classAnalysisXlsxLoadPromise = null;

function ensureClassAnalysisXlsxLoaded() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (classAnalysisXlsxLoadPromise) return classAnalysisXlsxLoadPromise;

    classAnalysisXlsxLoadPromise = new Promise((resolve, reject) => {
        const previousModule = typeof module === 'object' ? module : undefined;
        const previousExports = typeof exports === 'object' ? exports : undefined;
        if (typeof module === 'object') window.module = module;
        if (typeof exports === 'object') window.exports = exports;

        try {
            if (typeof module === 'object') module = undefined;
            if (typeof exports === 'object') exports = undefined;
        } catch (error) {}

        const script = document.createElement('script');
        script.src = '../assets/js/xlsx-js-style.min.js';
        script.onload = () => {
            try {
                if (previousModule !== undefined) module = previousModule;
                if (previousExports !== undefined) exports = previousExports;
            } catch (error) {}
            window.module = previousModule;
            window.exports = previousExports;
            if (window.XLSX) resolve(window.XLSX);
            else reject(new Error('XLSX library did not initialize'));
        };
        script.onerror = () => {
            try {
                if (previousModule !== undefined) module = previousModule;
                if (previousExports !== undefined) exports = previousExports;
            } catch (error) {}
            classAnalysisXlsxLoadPromise = null;
            reject(new Error('Failed to load XLSX library'));
        };
        document.head.appendChild(script);
    });

    return classAnalysisXlsxLoadPromise;
}

async function exportClassAnalysisToExcel() {
    if (!studentsData || studentsData.length === 0) {
        showToast('لا توجد بيانات للتصدير', 'error');
        return;
    }

    const selectedLevel = document.getElementById('levelSelect').value;
    const selectedClass = document.getElementById('classSelect').value;
    const trimesterSelect = document.getElementById('trimesterSelect');
    const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';
    const selectedStream = document.getElementById('streamSelect').value;
    const selectedYear = document.getElementById('yearSelect') ? document.getElementById('yearSelect').value : null;

    if (!selectedTrimesterVal) {
        showToast('الرجاء اختيار الفصل الدراسي أولاً', 'error');
        return;
    }

    // Filter students exactly like the dashboard logic
    let filteredData = studentsData.filter(s => {
        const matchYear = selectedYear ? (getStudentYear(s) === selectedYear) : true;
        const matchLevel = s.level == selectedLevel;
        const matchClass = s.class == selectedClass;
        const matchStream = selectedStream ? (s.stream === selectedStream) : true;
        return matchYear && matchLevel && matchClass && matchStream;
    });

    if (filteredData.length === 0) {
        showToast('لا توجد بيانات للقسم المحدد للتصدير', 'error');
        return;
    }

    const stage = institutionSettings.educationStage || 'middle';
    let baseSubjects = [];
    if (stage === 'secondary') {
        baseSubjects = selectedStream ? SubjectManager.getSubjects(stage, selectedLevel, selectedStream) :
            (filteredData.length > 0 && filteredData[0].stream ? SubjectManager.getSubjects(stage, selectedLevel, filteredData[0].stream) : []);
    } else {
        baseSubjects = getFilteredSubjects(selectedLevel, subjects);
    }

    const filteredByTrimester = getSubjectsForTrimester(baseSubjects, selectedTrimesterVal);

    const isT3 = selectedTrimesterVal === '3';
    const isAnnual = selectedTrimesterVal === 'annual';
    const hasComparison = selectedTrimesterVal === '2';
    const isFinalYear = (stage === 'secondary' && selectedLevel === '3') || (stage !== 'secondary' && selectedLevel === '4');

    // Extract subjects that have marks
    const activeSubjectsForExport = filteredByTrimester.filter(sub => {
        return filteredData.some(s => {
            const mark = getSubjectScore(s, sub);
            return mark !== null && mark !== undefined && mark !== '-' && !isNaN(parseFloat(mark)) && parseFloat(mark) > 0;
        });
    });

    // =====================================================
    // Build multi-section spreadsheet (like printed page)
    // =====================================================
    const aoa = [];
    const sectionStartRows = {};

    // --- SECTION 1: Title & Official Header ---
    const trimesterName = trimesterMap[selectedTrimesterVal] || selectedTrimesterVal;
    const schoolName = institutionSettings.institutionName || '';
    const wilaya = institutionSettings.wilaya || '';
    const schoolYear = institutionSettings.schoolYear || institutionSettings.currentAcademicYear || '';

    // Official Algerian Header Pattern
    aoa.push(['الجمهورية الجزائرية الديمقراطية الشعبية']); // Row 0
    aoa.push(['وزارة التربية الوطنية']); // Row 1
    
    let dirRow = '';
    if (wilaya) dirRow += `مديرية التربية لولاية ${wilaya}`;
    if (schoolName) dirRow += (dirRow ? ' - ' : '') + `المؤسسة: ${schoolName}`;
    aoa.push([dirRow]); // Row 2

    aoa.push([`السنة الدراسية: ${schoolYear}`]); // Row 3
    aoa.push([]); // Row 4 - spacer
    
    aoa.push([`تحليل نتائج وأداء الفوج التربوي`]); // Row 5
    
    let metadata = `المستوى: ${selectedLevel} | القسم: ${selectedClass} | الفصل: ${trimesterName}`;
    if (selectedStream && stage === 'secondary') metadata += ` | الشعبة: ${SubjectManager.getStreamName(selectedStream)}`;
    aoa.push([metadata]); // Row 6
    
    aoa.push([]); // Row 7 - spacer

    // --- SECTION 2: التعداد العام ---
    sectionStartRows.generalStats = aoa.length;
    aoa.push(['📊 التعداد العام']);
    aoa.push(['الفئة', 'العدد', 'ناجحون', 'راسبون', 'المعدل', 'نسبة النجاح']);

    const males = filteredData.filter(s => s.gender === 'ذكر');
    const females = filteredData.filter(s => s.gender === 'أنثى');
    [
        { label: 'ذكور', data: males },
        { label: 'إناث', data: females },
        { label: 'المجموع', data: filteredData }
    ].forEach(row => {
        const count = row.data.length;
        const passed = row.data.filter(s => getStudentAverage(s) >= 10).length;
        const failed = count - passed;
        const averages = row.data.map(s => getStudentAverage(s)).filter(avg => typeof avg === 'number' && !isNaN(avg) && avg > 0);
        const avg = averages.length > 0 ? (averages.reduce((sum, value) => sum + value, 0) / averages.length).toFixed(2) : '-';
        const rate = count > 0 ? ((passed / count) * 100).toFixed(2) + '%' : '0%';
        aoa.push([row.label, count, passed, failed, avg, rate]);
    });
    aoa.push([]);

    // --- SECTION 3: توزيع المعدلات ---
    sectionStartRows.gradeDistribution = aoa.length;
    aoa.push(['📈 توزيع المعدلات']);
    aoa.push(['المجال', 'العدد']);
    [
        { label: '00 - 09.99', min: 0, max: 9.99 },
        { label: '10 - 11.99', min: 10, max: 11.99 },
        { label: '12 - 13.99', min: 12, max: 13.99 },
        { label: '14 - 15.99', min: 14, max: 15.99 },
        { label: '16 - 17.99', min: 16, max: 17.99 },
        { label: '18 - 20.00', min: 18, max: 20 }
    ].forEach(range => {
        const count = filteredData.filter(s => {
            const avg = getStudentAverage(s);
            return avg >= range.min && avg <= range.max;
        }).length;
        aoa.push([range.label, count]);
    });
    aoa.push([]);

    // --- SECTION 4: نتائج المواد ---
    sectionStartRows.subjectStats = aoa.length;
    aoa.push(['📚 نتائج المواد']);
    const subjectHeaders = ['المادة', 'ناجحون', 'راسبون', 'معدل المادة'];
    if (hasComparison) subjectHeaders.push('نسبة ف1');
    subjectHeaders.push('نسبة النجاح');
    aoa.push(subjectHeaders);

    activeSubjectsForExport.forEach(sub => {
        const scores = filteredData.map(s => getSubjectScore(s, sub, selectedTrimesterVal)).filter(m => m !== null && m !== undefined);
        if (scores.length === 0) {
            const emptyRow = [sub, '-', '-', '-'];
            if (hasComparison) emptyRow.push('-');
            emptyRow.push('-');
            aoa.push(emptyRow);
            return;
        }
        const passed = scores.filter(m => m >= 10).length;
        const failed = scores.length - passed;
        const avg = (scores.reduce((a, b) => a + Number(b), 0) / scores.length).toFixed(2);
        const rate = ((passed / scores.length) * 100).toFixed(2) + '%';
        const subRow = [sub, passed, failed, avg];
        if (hasComparison) {
            const prevScores = filteredData.map(s => getSubjectScore(s, sub, '1')).filter(m => m !== null && m !== undefined);
            if (prevScores.length > 0) {
                const prevPassed = prevScores.filter(m => m >= 10).length;
                subRow.push(((prevPassed / prevScores.length) * 100).toFixed(2) + '%');
            } else {
                subRow.push('-');
            }
        }
        subRow.push(rate);
        aoa.push(subRow);
    });
    aoa.push([]);

    // --- SECTION 5: القائمة التفصيلية ---
    sectionStartRows.detailedTable = aoa.length;
    aoa.push(['📋 القائمة التفصيلية للتلاميذ']);

    const detailHeaders = ['الرقم', 'اللقب والاسم', 'الجنس', 'تاريخ الميلاد'];
    activeSubjectsForExport.forEach(sub => detailHeaders.push(getSubjectAbbreviation(sub)));
    if (hasComparison) detailHeaders.push('م.ف1');
    detailHeaders.push('المعدل');
    const showDecisionColumn = (isT3 || isAnnual) && !isFinalYear;
    if (isAnnual) detailHeaders[detailHeaders.length - 1] = 'م.سنوي';
    if (isT3) detailHeaders.push('م.سنوي');
    if (showDecisionColumn) detailHeaders.push('القرار');
    else if (!isT3 && !isAnnual) detailHeaders.push('التقدير');
    aoa.push(detailHeaders);

    filteredData.forEach((s, idx) => {
        const row = [idx + 1, s.name || '', s.gender || '-', formatDate(s.dob) || '-'];
        activeSubjectsForExport.forEach(sub => {
            const mark = getSubjectScore(s, sub);
            row.push(mark !== null && mark !== undefined ? mark : '-');
        });
        const currentAvg = typeof getStudentAverage(s) === 'number' ? getStudentAverage(s) : parseFloat(getStudentAverage(s) || 0);
        if (hasComparison) { const avgPrev = getTrimesterAverage(s, '1'); row.push(avgPrev > 0 ? avgPrev : '-'); }
        row.push(currentAvg > 0 ? currentAvg.toFixed(2) : '-');
        if (isT3 || isAnnual) {
            const decisionSnapshot = getAnnualDecisionSnapshot(s, parseInt(institutionSettings.directedBirthYear));
            if (isT3) row.push(decisionSnapshot.annualAverage);
            if (showDecisionColumn) row.push(decisionSnapshot.decision);
        } else { 
            const appreciation = getAppreciation(currentAvg);
            row.push(appreciation.replace(/<[^>]*>/g, '')); 
        }
        aoa.push(row);
    });

    // Summary Row
    const summaryRow = ['', 'المعدل العام', '', ''];
    activeSubjectsForExport.forEach(sub => {
        const scores = filteredData.map(s => getSubjectScore(s, sub)).filter(m => m !== null && m !== undefined);
        summaryRow.push(scores.length > 0 ? (scores.reduce((a, b) => a + Number(b), 0) / scores.length).toFixed(2) : '-');
    });
    if (hasComparison) summaryRow.push('');
    const allAvgs = filteredData.map(s => getStudentAverage(s)).filter(a => a > 0);
    summaryRow.push(allAvgs.length > 0 ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(2) : '-');
    if (isT3) summaryRow.push('');
    if (showDecisionColumn) summaryRow.push('');
    else if (!isT3 && !isAnnual) summaryRow.push('');
    aoa.push(summaryRow);

    // =====================================================
    // Build Excel with styling
    // =====================================================
    try {
        await ensureClassAnalysisXlsxLoaded();
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const totalCols = detailHeaders.length;

        // Column widths
        const colWidths = [{ wch: 6 }, { wch: 28 }, { wch: 8 }, { wch: 12 }];
        for (let i = 0; i < activeSubjectsForExport.length; i++) colWidths.push({ wch: 8 });
        if (hasComparison) colWidths.push({ wch: 8 });
        colWidths.push({ wch: 8 });
        if (isT3) colWidths.push({ wch: 8 });
        if (showDecisionColumn) colWidths.push({ wch: 8 });
        else if (!isT3 && !isAnnual) colWidths.push({ wch: 12 });
        ws['!cols'] = colWidths;

        // Merges for the new formal header
        if (!ws['!merges']) ws['!merges'] = [];
        for (let r = 0; r <= 3; r++) {
            ws['!merges'].push({ s: { r: r, c: 0 }, e: { r: r, c: totalCols - 1 } });
        }
        ws['!merges'].push({ s: { r: 5, c: 0 }, e: { r: 5, c: totalCols - 1 } });
        ws['!merges'].push({ s: { r: 6, c: 0 }, e: { r: 6, c: totalCols - 1 } });
        
        // Dynamic Merges with correct widths for summary sections
        const gsCols = 6;
        const gdCols = 2;
        const ssCols = subjectHeaders.length;
        const dtCols = totalCols;

        ws['!merges'].push({ s: { r: sectionStartRows.generalStats, c: 0 }, e: { r: sectionStartRows.generalStats, c: gsCols - 1 } });
        ws['!merges'].push({ s: { r: sectionStartRows.gradeDistribution, c: 0 }, e: { r: sectionStartRows.gradeDistribution, c: gdCols - 1 } });
        ws['!merges'].push({ s: { r: sectionStartRows.subjectStats, c: 0 }, e: { r: sectionStartRows.subjectStats, c: ssCols - 1 } });
        ws['!merges'].push({ s: { r: sectionStartRows.detailedTable, c: 0 }, e: { r: sectionStartRows.detailedTable, c: dtCols - 1 } });

        // Section row indices
        const gsHeader = sectionStartRows.generalStats + 1;
        const gsDataStart = gsHeader + 1, gsDataEnd = gsDataStart + 2;
        const gdHeader = sectionStartRows.gradeDistribution + 1;
        const gdDataStart = gdHeader + 1, gdDataEnd = gdDataStart + 5;
        const ssHeader = sectionStartRows.subjectStats + 1;
        const ssDataEnd = sectionStartRows.detailedTable - 2;
        const dtHeader = sectionStartRows.detailedTable + 1;
        const dtDataStart = dtHeader + 1;
        const summaryIdx = aoa.length - 1;

        const BORDER = { style: "thin", color: { rgb: "000000" } }; // Solid black thin border
        const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
        const SECTION_STYLE = {
            font: { name: "Arial", sz: 13, bold: true, color: { rgb: "2C3E50" } },
            alignment: { vertical: "center", horizontal: "right" },
            fill: { patternType: "solid", fgColor: { rgb: "ECF0F1" } }, 
            border: BORDERS
        };

        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            // Determine active width for this row
            let activeWidth = totalCols;
            if (R >= sectionStartRows.generalStats && R < sectionStartRows.gradeDistribution) activeWidth = gsCols;
            else if (R >= sectionStartRows.gradeDistribution && R < sectionStartRows.subjectStats) activeWidth = gdCols;
            else if (R >= sectionStartRows.subjectStats && R < sectionStartRows.detailedTable) activeWidth = ssCols;

            for (let C = range.s.c; C <= range.e.c; ++C) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                
                // Skip styling for extra columns
                if (C >= activeWidth) {
                    if (ws[addr]) delete ws[addr]; // Ensure extra columns stay empty and unstyled
                    continue;
                }

                if (!ws[addr]) ws[addr] = { v: '', t: 's' };

                let font = { name: "Arial", sz: 11 };
                let alignment = { vertical: "center", horizontal: "center", wrapText: true };
                let border = {};
                let fill = undefined;

                // --- Styling Logic for Rows ---
                if (R === 0) { font = { name: "Arial", sz: 15, bold: true }; alignment.horizontal = "center"; }
                else if (R === 1) { font = { name: "Arial", sz: 12, bold: true }; alignment.horizontal = "center"; }
                else if (R === 2) { font = { name: "Arial", sz: 11, bold: true }; alignment.horizontal = "center"; }
                else if (R === 3) { font = { name: "Arial", sz: 10 }; alignment.horizontal = "center"; }
                else if (R === 5) { // Main Title
                    font = { name: "Arial", sz: 18, bold: true, color: { rgb: "2C3E50" } };
                    alignment.horizontal = "center";
                    fill = { patternType: "solid", fgColor: { rgb: "F2F4F4" } };
                    border = BORDERS;
                }
                else if (R === 6) { // Metadata details
                    font = { name: "Arial", sz: 11, bold: true };
                    alignment.horizontal = "center";
                }
                else if (Object.values(sectionStartRows).includes(R)) { ws[addr].s = SECTION_STYLE; continue; }
                else if (R === gsHeader) { font = { name: "Arial", sz: 11, bold: true, color: { rgb: "FFFFFF" } }; fill = { patternType: "solid", fgColor: { rgb: "27AE60" } }; border = BORDERS; }
                else if (R >= gsDataStart && R <= gsDataEnd) { border = BORDERS; if (R === gsDataEnd) font.bold = true; alignment.horizontal = "center"; }
                else if (R === gdHeader) { font = { name: "Arial", sz: 11, bold: true, color: { rgb: "FFFFFF" } }; fill = { patternType: "solid", fgColor: { rgb: "2980B9" } }; border = BORDERS; }
                else if (R >= gdDataStart && R <= gdDataEnd) { border = BORDERS; alignment.horizontal = "center"; }
                else if (R === ssHeader) { font = { name: "Arial", sz: 11, bold: true, color: { rgb: "FFFFFF" } }; fill = { patternType: "solid", fgColor: { rgb: "8E44AD" } }; border = BORDERS; }
                else if (R > ssHeader && R <= ssDataEnd) { border = BORDERS; if (C === 0) { alignment.horizontal = "right"; font.bold = true; } else { alignment.horizontal = "center"; } }
                else if (R === dtHeader) { font = { name: "Arial", sz: 11, bold: true, color: { rgb: "FFFFFF" } }; fill = { patternType: "solid", fgColor: { rgb: "E74C3C" } }; border = BORDERS; }
                else if (R >= dtDataStart && R <= summaryIdx) {
                    border = BORDERS;
                    if (R === summaryIdx) { font.bold = true; fill = { patternType: "solid", fgColor: { rgb: "ECF0F1" } }; }
                    else if (C === 1) { alignment.horizontal = "right"; font.bold = true; }
                }

                ws[addr].s = { font, alignment, border, fill };
            }
        }

        // RTL
        if (!ws["!views"]) ws["!views"] = [];
        ws["!views"].push({ rightToLeft: true });

        const wb = XLSX.utils.book_new();
        wb.Workbook = { Views: [{ RTL: true }] };
        XLSX.utils.book_append_sheet(wb, ws, "نتائج القسم");

        const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        const fileName = `نتائج_القسم_${selectedLevel}_${selectedClass}_${dateStr}.xlsx`;

        if (window.ipcRenderer) {
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            window.ipcRenderer.invoke('save-excel', wbout).then(result => {
                if (result.success) showToast('تم تصدير ملف Excel بنجاح', 'success');
                else if (!result.canceled) showToast('حدث خطأ أثناء الحفظ', 'error');
            }).catch(err => { console.error("Save Excel error:", err); showToast('حدث خطأ أثناء الاتصال بالنظام', 'error'); });
        } else {
            XLSX.writeFile(wb, fileName);
            showToast('تم تصدير ملف Excel بنجاح', 'success');
        }
    } catch (e) {
        console.error("Excel Generation Error:", e);
        showToast('حدث خطأ أثناء توليد ملف الاكسل', 'error');
    }
}

// ===============================
// React shell + TanStack renderers
// ===============================

const classAnalysisElement = (typeof React !== 'undefined' && React.createElement)
    ? React.createElement
    : null;

const CLASS_ANALYSIS_SHELL_HTML = `
    <style>
        .class-analysis-shell .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 18px;
            margin-bottom: 18px;
        }

        .class-analysis-shell .dashboard .card,
        .class-analysis-shell .student-list {
            background: var(--card-bg);
            border: 1px solid #dbe4ef;
            border-radius: 18px;
            box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
            padding: 16px 16px 14px;
        }

        .class-analysis-shell .dashboard .card h3,
        .class-analysis-shell .student-list h2 {
            margin: 0 0 12px 0;
            color: var(--primary-color);
            font-size: 1.02rem;
            font-weight: 800;
        }

        .class-analysis-shell .data-table-container,
        .class-analysis-shell .table-frame {
            overflow-x: auto;
            overflow-y: visible;
            border: 1px solid #d7e1ec;
            border-radius: 16px;
            background: linear-gradient(180deg, #f8fbff 0%, #eef3f8 100%);
        }

        .class-analysis-shell .dashboard .card > .data-table {
            border-radius: 16px;
            overflow: hidden;
        }

        .class-analysis-shell .data-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 0.92rem;
            margin: 0;
        }

        .class-analysis-shell .data-table thead th {
            position: sticky;
            top: 0;
            z-index: 2;
            background: #33475b;
            color: #fff;
            padding: 11px 10px;
            text-align: center;
            font-weight: 800;
            border-left: 1px solid rgba(255,255,255,0.14);
            border-bottom: 1px solid #2a3a4c;
            white-space: nowrap;
        }

        .class-analysis-shell .data-table thead th:first-child {
            border-top-right-radius: 14px;
        }

        .class-analysis-shell .data-table thead th:last-child {
            border-top-left-radius: 14px;
            border-left: none;
        }

        .class-analysis-shell .data-table tbody td {
            background: var(--card-bg);
            color: #1f2937;
            padding: 10px 8px;
            text-align: center;
            border-left: 1px solid var(--border-color);
            border-bottom: 1px solid var(--border-color);
            white-space: nowrap;
            transition: background-color 0.2s ease, transform 0.2s ease;
        }

        .class-analysis-shell .data-table tbody tr:nth-child(even) td {
            background: #f8fbff;
        }

        .class-analysis-shell .data-table tbody tr:hover td {
            background: #eef6ff;
        }

        .class-analysis-shell .data-table tbody tr:last-child td:first-child {
            border-bottom-right-radius: 14px;
        }

        .class-analysis-shell .data-table tbody tr:last-child td:last-child {
            border-bottom-left-radius: 14px;
        }

        .class-analysis-shell .data-table th.vertical-header {
            min-width: 42px;
            width: 42px;
            padding: 0;
        }

        .class-analysis-shell .data-table th.vertical-header div {
            writing-mode: vertical-rl;
            transform: rotate(180deg);
            padding: 10px 0;
            line-height: 1.1;
            letter-spacing: 0.02em;
        }

        .class-analysis-shell .data-table .appreciation-col,
        .class-analysis-shell .data-table .decision-col,
        .class-analysis-shell .data-table .gender-col {
            font-weight: 700;
        }

        .class-analysis-shell .student-list .data-table-container {
            max-height: none;
            overflow-y: visible;
        }

        .class-analysis-shell .student-list .data-table thead th {
            z-index: 3;
        }

        .class-analysis-shell .student-list .data-table tbody td:first-child,
        .class-analysis-shell .student-list .data-table thead th:first-child {
            position: sticky;
            right: 0;
            z-index: 4;
            box-shadow: -1px 0 0 #d7e1ec inset;
        }

        .class-analysis-shell .student-list .data-table tbody td:first-child {
            background: inherit;
        }

        .class-analysis-shell .student-list .data-table tbody tr:nth-child(even) td:first-child {
            background: #f8fbff;
        }

        .class-analysis-shell .student-list .data-table tbody tr:hover td:first-child {
            background: #eef6ff;
        }

        #studentModal .student-detail-modal {
            width: min(980px, 96vw);
            max-width: 980px;
            max-height: 88vh;
            padding: 0;
            border-radius: 24px;
            overflow: hidden;
            background: linear-gradient(180deg, #ffffff 0%, #f7fafc 100%);
            box-shadow: 0 26px 70px rgba(15, 23, 42, 0.24);
            border: 1px solid rgba(148, 163, 184, 0.25);
        }

        #studentModal .student-detail-modal .modal-header {
            background: linear-gradient(135deg, #1f3b57 0%, #355b7a 100%);
            color: #fff;
            padding: 18px 22px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }

        #studentModal .student-detail-modal .modal-header h3 {
            margin: 0;
            font-size: 1.18rem;
            font-weight: 800;
            color: #fff;
        }

        #studentModal .student-detail-modal .modal-close {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            border: none;
            background: rgba(255,255,255,0.16);
            color: #fff;
            font-size: 1.45rem;
            cursor: pointer;
        }

        #studentModal .student-detail-modal .modal-body {
            padding: 20px;
            overflow-y: auto;
            max-height: calc(88vh - 82px);
        }

        #studentModal .student-hero {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
        }

        #studentModal .student-meta-card,
        #studentModal .student-summary-card,
        #studentModal .student-scores-card {
            background: #fff;
            border: 1px solid #dbe4ef;
            border-radius: 18px;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
        }

        #studentModal .student-meta-card {
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        #studentModal .student-meta-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }

        #studentModal .student-name-block {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        #studentModal .student-avatar {
            width: 54px;
            height: 54px;
            border-radius: 16px;
            background: linear-gradient(135deg, #d7ecff 0%, #f0f7ff 100%);
            color: #1d4f7a;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.45rem;
            font-weight: 800;
            border: 1px solid #c8ddf3;
            flex-shrink: 0;
        }

        #studentModal .student-name-block h4 {
            margin: 0 0 4px 0;
            font-size: 1.15rem;
            color: #183b56;
        }

        #studentModal .student-name-block p {
            margin: 0;
            color: #64748b;
            font-size: 0.92rem;
        }

        #studentModal .student-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 8px 14px;
            border-radius: 999px;
            font-weight: 800;
            font-size: 0.9rem;
            white-space: nowrap;
            border: 1px solid transparent;
        }

        #studentModal .student-badge.good {
            color: #166534;
            background: #ecfdf3;
            border-color: #bbf7d0;
        }

        #studentModal .student-badge.warn {
            color: #b45309;
            background: #fff7ed;
            border-color: #fed7aa;
        }

        #studentModal .student-badge.low {
            color: #b91c1c;
            background: #fff1f2;
            border-color: #fecdd3;
        }

        #studentModal .student-badge.neutral {
            color: #334155;
            background: #f1f5f9;
            border-color: #cbd5e1;
        }

        #studentModal .student-meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }

        #studentModal .student-meta-item {
            background: #f8fbff;
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 12px 14px;
        }

        #studentModal .student-meta-item .label {
            display: block;
            color: #64748b;
            font-size: 0.78rem;
            font-weight: 700;
            margin-bottom: 4px;
        }

        #studentModal .student-meta-item .value {
            color: #183b56;
            font-size: 0.95rem;
            font-weight: 800;
        }

        #studentModal .student-summary-card {
            padding: 18px;
        }

        #studentModal .student-summary-card h4,
        #studentModal .student-scores-card h4 {
            margin: 0 0 14px 0;
            color: #183b56;
            font-size: 1rem;
        }

        #studentModal .student-summary-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
        }

        #studentModal .student-stat {
            background: linear-gradient(180deg, #f8fbff 0%, #eef5fb 100%);
            border: 1px solid #d7e3ef;
            border-radius: 16px;
            padding: 14px 12px;
            text-align: center;
        }

        #studentModal .student-stat .label {
            display: block;
            color: #64748b;
            font-size: 0.78rem;
            font-weight: 700;
            margin-bottom: 8px;
        }

        #studentModal .student-stat .value {
            display: block;
            color: #183b56;
            font-size: 1.28rem;
            font-weight: 900;
            line-height: 1.1;
        }

        #studentModal .student-stat .hint {
            display: block;
            color: #64748b;
            font-size: 0.78rem;
            margin-top: 4px;
        }

        #studentModal .student-scores-card {
            padding: 18px;
        }

        #studentModal .student-scores-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }

        #studentModal .student-scores-subtitle {
            color: #64748b;
            font-size: 0.88rem;
            font-weight: 700;
        }

        #studentModal .student-scores-table-wrap {
            border: 1px solid #dbe4ef;
            border-radius: 16px;
            overflow: auto;
            max-height: 46vh;
            background: #fff;
        }

        #studentModal .student-scores-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
        }

        #studentModal .student-scores-table thead th {
            position: sticky;
            top: 0;
            background: #f1f5f9;
            color: #183b56;
            font-size: 0.86rem;
            font-weight: 800;
            padding: 11px 12px;
            border-bottom: 1px solid #dbe4ef;
            text-align: center;
        }

        #studentModal .student-scores-table tbody td {
            padding: 10px 12px;
            border-bottom: 1px solid #edf2f7;
            text-align: center;
            white-space: nowrap;
            font-size: 0.92rem;
        }

        #studentModal .student-scores-table tbody tr:nth-child(even) td {
            background: #fbfdff;
        }

        #studentModal .student-scores-table tbody td.subject-cell {
            text-align: right;
            font-weight: 700;
            color: #183b56;
        }

        #studentModal .student-score-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 74px;
            padding: 7px 12px;
            border-radius: 999px;
            font-weight: 900;
            font-size: 0.98rem;
        }

        #studentModal .student-score-pill.good {
            background: #ecfdf3;
            color: #15803d;
        }

        #studentModal .student-score-pill.low {
            background: #fff1f2;
            color: #dc2626;
        }

        #studentModal .student-score-pill.warn {
            background: #fff7ed;
            color: #c2410c;
        }

        #studentModal .student-score-note {
            font-weight: 800;
            font-size: 0.84rem;
        }

        #studentModal .student-score-note.good {
            color: #15803d;
        }

        #studentModal .student-score-note.low {
            color: #dc2626;
        }

        #studentModal .student-score-note.warn {
            color: #c2410c;
        }

        #studentModal .student-hero {
            grid-template-columns: 1.35fr 0.95fr;
            gap: 18px;
            align-items: stretch;
        }

        #studentModal .student-detail-modal {
            background:
                radial-gradient(circle at top right, rgba(80, 140, 255, 0.12), transparent 28%),
                radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.10), transparent 24%),
                linear-gradient(180deg, #f8fbff 0%, #eff4fa 100%);
        }

        #studentModal .student-detail-modal .modal-header {
            background:
                radial-gradient(circle at top left, rgba(255,255,255,0.16), transparent 22%),
                linear-gradient(135deg, #183a5a 0%, #29557a 55%, #3b6c92 100%);
            padding: 20px 24px;
            border-bottom: 1px solid rgba(255,255,255,0.12);
        }

        #studentModal .student-detail-modal .modal-header h3 {
            font-size: 1.24rem;
            letter-spacing: 0.01em;
        }

        #studentModal .student-detail-modal .modal-body {
            padding: 22px;
        }

        #studentModal .student-meta-card {
            position: relative;
            overflow: hidden;
            padding: 22px;
            background:
                radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 22%),
                linear-gradient(135deg, #214766 0%, #2e5f84 55%, #3f739a 100%);
            border: none;
            color: #fff;
            box-shadow: 0 18px 34px rgba(33, 71, 102, 0.22);
        }

        #studentModal .student-meta-card::after {
            content: '';
            position: absolute;
            left: -40px;
            bottom: -40px;
            width: 160px;
            height: 160px;
            border-radius: 50%;
            background: rgba(255,255,255,0.08);
            filter: blur(1px);
        }

        #studentModal .student-avatar {
            width: 66px;
            height: 66px;
            border-radius: 22px;
            background: rgba(255,255,255,0.16);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.18);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
            font-size: 1.65rem;
        }

        #studentModal .student-name-block h4,
        #studentModal .student-name-block p {
            color: #fff;
        }

        #studentModal .student-name-block p {
            opacity: 0.86;
        }

        #studentModal .student-meta-eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 12px;
            border-radius: 999px;
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.14);
            font-size: 0.8rem;
            font-weight: 800;
            margin-bottom: 10px;
        }

        #studentModal .student-badge {
            background: rgba(255,255,255,0.15);
            color: #fff;
            border-color: rgba(255,255,255,0.14);
            backdrop-filter: blur(6px);
        }

        #studentModal .student-badge.good {
            background: rgba(34, 197, 94, 0.16);
            border-color: rgba(187, 247, 208, 0.3);
        }

        #studentModal .student-badge.warn {
            background: rgba(249, 115, 22, 0.16);
            border-color: rgba(254, 215, 170, 0.3);
        }

        #studentModal .student-badge.low {
            background: rgba(244, 63, 94, 0.16);
            border-color: rgba(254, 205, 211, 0.3);
        }

        #studentModal .student-meta-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
        }

        #studentModal .student-meta-item {
            position: relative;
            z-index: 1;
            background: rgba(255,255,255,0.10);
            border: 1px solid rgba(255,255,255,0.14);
            backdrop-filter: blur(8px);
        }

        #studentModal .student-meta-item .label {
            color: rgba(255,255,255,0.72);
        }

        #studentModal .student-meta-item .value {
            color: #fff;
        }

        #studentModal .student-summary-card {
            padding: 20px;
            background: linear-gradient(180deg, #ffffff 0%, #f7fafc 100%);
            box-shadow: 0 16px 28px rgba(15, 23, 42, 0.06);
        }

        #studentModal .student-summary-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
            flex-wrap: wrap;
        }

        #studentModal .student-summary-kicker {
            color: #64748b;
            font-size: 0.82rem;
            font-weight: 800;
        }

        #studentModal .student-average-panel {
            border-radius: 22px;
            padding: 20px;
            color: #fff;
            background:
                radial-gradient(circle at top, rgba(255,255,255,0.14), transparent 36%),
                linear-gradient(145deg, #102f49 0%, #1d4f73 100%);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
            margin-bottom: 14px;
        }

        #studentModal .student-average-panel.good {
            background:
                radial-gradient(circle at top, rgba(255,255,255,0.14), transparent 36%),
                linear-gradient(145deg, #0f5132 0%, #15803d 100%);
        }

        #studentModal .student-average-panel.warn {
            background:
                radial-gradient(circle at top, rgba(255,255,255,0.14), transparent 36%),
                linear-gradient(145deg, #9a3412 0%, #c2410c 100%);
        }

        #studentModal .student-average-panel.low {
            background:
                radial-gradient(circle at top, rgba(255,255,255,0.14), transparent 36%),
                linear-gradient(145deg, #881337 0%, #be123c 100%);
        }

        #studentModal .student-average-panel .panel-label {
            display: block;
            font-size: 0.84rem;
            opacity: 0.84;
            margin-bottom: 8px;
            font-weight: 700;
        }

        #studentModal .student-average-panel .panel-value {
            display: block;
            font-size: 2.4rem;
            font-weight: 900;
            line-height: 1;
            margin-bottom: 8px;
        }

        #studentModal .student-average-panel .panel-hint {
            display: block;
            font-size: 0.86rem;
            opacity: 0.88;
        }

        #studentModal .student-panel-meter {
            margin-top: 12px;
        }

        #studentModal .student-panel-meter-track {
            width: 100%;
            height: 10px;
            border-radius: 999px;
            background: rgba(255,255,255,0.16);
            overflow: hidden;
        }

        #studentModal .student-panel-meter-fill {
            display: block;
            height: 100%;
            border-radius: 999px;
            background: linear-gradient(90deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.58) 100%);
            box-shadow: 0 0 18px rgba(255,255,255,0.22);
        }

        #studentModal .student-panel-meter-labels {
            display: flex;
            justify-content: space-between;
            margin-top: 7px;
            font-size: 0.77rem;
            opacity: 0.82;
        }

        #studentModal .student-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }

        #studentModal .student-stat {
            text-align: right;
            padding: 15px 14px;
            background: #f8fbff;
        }

        #studentModal .student-scores-card {
            padding: 20px;
            background: rgba(255,255,255,0.88);
            backdrop-filter: blur(10px);
        }

        #studentModal .student-scores-head {
            margin-bottom: 14px;
        }

        #studentModal .student-scores-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }

        #studentModal .student-chip-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        #studentModal .student-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 7px 11px;
            border-radius: 999px;
            background: #eff6ff;
            border: 1px solid #dbeafe;
            color: #1d4f7a;
            font-size: 0.8rem;
            font-weight: 800;
        }

        #studentModal .student-chip.good {
            background: #ecfdf3;
            border-color: #bbf7d0;
            color: #15803d;
        }

        #studentModal .student-chip.low {
            background: #fff1f2;
            border-color: #fecdd3;
            color: #be123c;
        }

        #studentModal .student-scores-table-wrap {
            border-radius: 20px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
        }

        #studentModal .student-scores-table thead th {
            background: linear-gradient(180deg, #f8fbff 0%, #eef3f8 100%);
            font-size: 0.84rem;
            letter-spacing: 0.01em;
        }

        #studentModal .student-scores-table tbody td {
            vertical-align: middle;
        }

        #studentModal .student-subject-block {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 220px;
        }

        #studentModal .student-subject-name {
            font-weight: 800;
            color: #183b56;
        }

        #studentModal .student-score-track {
            position: relative;
            width: 100%;
            height: 8px;
            border-radius: 999px;
            background: #e8edf3;
            overflow: hidden;
        }

        #studentModal .student-score-fill {
            height: 100%;
            border-radius: 999px;
        }

        #studentModal .student-score-fill.good {
            background: linear-gradient(90deg, #34d399 0%, #16a34a 100%);
        }

        #studentModal .student-score-fill.warn {
            background: linear-gradient(90deg, #fbbf24 0%, #f97316 100%);
        }

        #studentModal .student-score-fill.low {
            background: linear-gradient(90deg, #fb7185 0%, #e11d48 100%);
        }

        @media (max-width: 900px) {
            .class-analysis-shell .dashboard-grid {
                grid-template-columns: 1fr;
            }

            .class-analysis-shell .dashboard .card,
            .class-analysis-shell .student-list {
                padding: 12px;
                border-radius: 14px;
            }

            .class-analysis-shell .data-table {
                font-size: 0.86rem;
            }

            .class-analysis-shell .data-table thead th,
            .class-analysis-shell .data-table tbody td {
                padding: 9px 6px;
            }

            #studentModal .student-hero,
            #studentModal .student-summary-grid,
            #studentModal .student-meta-grid {
                grid-template-columns: 1fr;
            }

            #studentModal .student-meta-card,
            #studentModal .student-summary-card,
            #studentModal .student-scores-card {
                padding: 16px;
            }

            #studentModal .student-average-panel .panel-value {
                font-size: 2rem;
            }

            #studentModal .student-detail-modal {
                width: min(96vw, 96vw);
                max-height: 92vh;
                border-radius: 18px;
            }
        }

        /* ====== Dark Mode ====== */
        html[data-theme="dark"] .class-analysis-shell .dashboard .card,
        html[data-theme="dark"] .class-analysis-shell .student-list {
            background: #1e293b !important;
            border-color: #334155 !important;
            color: #e2e8f0;
        }

        html[data-theme="dark"] .class-analysis-shell .dashboard .card h3,
        html[data-theme="dark"] .class-analysis-shell .student-list h2 {
            color: #38bdf8 !important;
        }

        html[data-theme="dark"] .class-analysis-shell .data-table-container,
        html[data-theme="dark"] .class-analysis-shell .table-frame {
            background: #0f172a !important;
            border-color: #334155 !important;
        }

        html[data-theme="dark"] .class-analysis-shell .data-table thead th {
            background: #0f172a !important;
            color: #e2e8f0 !important;
            border-color: #334155 !important;
        }

        html[data-theme="dark"] .class-analysis-shell .data-table tbody td {
            background: #1e293b !important;
            color: #cbd5e1 !important;
            border-color: #334155 !important;
        }

        html[data-theme="dark"] .class-analysis-shell .data-table tbody tr:nth-child(even) td {
            background: #0f172a !important;
        }

        html[data-theme="dark"] .class-analysis-shell .data-table tbody tr:hover td {
            background: rgba(59, 130, 246, 0.15) !important;
        }

        html[data-theme="dark"] .class-analysis-shell .data-table tbody td:first-child {
            color: #38bdf8 !important;
        }

        html[data-theme="dark"] .class-analysis-shell .filter-card {
            background: #0f172a !important;
            border-color: #334155 !important;
        }

        html[data-theme="dark"] .class-analysis-shell .filter-group {
            background: #1e293b !important;
            border-color: #334155 !important;
        }

        html[data-theme="dark"] .class-analysis-shell .filter-group label,
        html[data-theme="dark"] .class-analysis-shell .filter-group select {
            color: #38bdf8 !important;
        }

        html[data-theme="dark"] .class-analysis-shell .page-header {
            background: #1e293b !important;
            border-color: #334155;
        }

        html[data-theme="dark"] .class-analysis-shell .page-header h1 {
            color: #38bdf8 !important;
        }

        html[data-theme="dark"] .class-analysis-shell .page-header p {
            color: #94a3b8 !important;
        }

        html[data-theme="dark"] .class-analysis-shell .chart-container {
            background: #1e293b !important;
            border-radius: 12px;
        }

        html[data-theme="dark"] #classResponsibleContainer {
            border-top-color: #334155 !important;
        }

        html[data-theme="dark"] #decisionStatsContainer {
            border-top-color: #334155 !important;
        }

        html[data-theme="dark"] #councilSettingsModal .modal-content {
            background: #1e293b !important;
            border-color: #334155 !important;
        }

        html[data-theme="dark"] #councilSettingsModal .modal-body {
            color: #e2e8f0;
        }

        html[data-theme="dark"] #councilSettingsModal .modal-body h4 {
            color: #f1f5f9 !important;
        }

        html[data-theme="dark"] #councilSettingsModal .modal-body label {
            color: #38bdf8 !important;
        }

        html[data-theme="dark"] #councilSettingsModal input,
        html[data-theme="dark"] #councilSettingsModal textarea {
            background: #0f172a !important;
            color: #e2e8f0 !important;
            border-color: #334155 !important;
        }

        @media print {
            .class-analysis-shell .dashboard .card,
            .class-analysis-shell .student-list,
            .class-analysis-shell .data-table-container,
            .class-analysis-shell .table-frame {
                box-shadow: none !important;
                border-radius: 0 !important;
                background: transparent !important;
                border-color: #000 !important;
            }

            .class-analysis-shell .data-table {
                border-collapse: collapse !important;
            }

            .class-analysis-shell .data-table thead th,
            .class-analysis-shell .data-table tbody td {
                position: static !important;
                background: #fff !important;
                color: #000 !important;
                border: 1px solid #000 !important;
                box-shadow: none !important;
            }
        }
    </style>
    <div class="container animate-fade-in-up class-analysis-shell">
        <div class="page-header"
            style="background: var(--card-bg); padding: 20px; border-radius: 12px; box-shadow: 0 2px 15px rgba(0,0,0,0.05); margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div class="header-title">
                <h1
                    style="margin: 0; font-size: 1.8rem; color: var(--primary-color); display: flex; align-items: center; gap: 10px;">
                    <span style="background: #e8f6f3; padding: 8px; border-radius: 8px;" data-icon="chart">📈</span>
                    تحليل نتائج الأقسام
                </h1>
                <p style="margin: 5px 0 0 0; color: #7f8c8d; font-size: 0.95rem;">لوحة تحكم تفصيلية لنتائج التلاميذ</p>
            </div>
            <div class="header-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    <button onclick="if(Auth.checkAuth()) openCouncilSettings()" class="btn-analyze"
                        style="background-color: var(--secondary-color); color: white; border: none; padding: 10px; border-radius: 0 8px 8px 0; font-weight: 500; transition: all 0.3s ease; box-shadow: 0 4px 6px rgba(52, 152, 219, 0.2);"
                        title="إعدادات المحضر">
                        <span data-icon="settings">⚙️</span>
                    </button>
                    <button onclick="if(Auth.checkAuth()) printCouncilReport()" class="btn-analyze"
                        style="background-color: var(--secondary-color); color: white; border: none; padding: 10px 20px; border-radius: 8px 0 0 8px; display: flex; align-items: center; gap: 20px; font-weight: 500; transition: all 0.3s ease; box-shadow: 0 4px 6px rgba(52, 152, 219, 0.2);">
                        <span>محضر المجلس</span>
                        <span data-icon="notice2">📄</span>
                    </button>
                    <button onclick="if(Auth.checkAuth()) exportClassAnalysisToExcel()" class="btn-analyze"
                        style="background-color: #27ae60; color: white; border: none; padding: 10px 20px; border-radius: 8px; display: flex; align-items: center; gap: 8px; font-weight: 500; transition: all 0.3s ease; box-shadow: 0 4px 6px rgba(39, 174, 96, 0.2); margin-right: 15px;">
                        <span>تصدير Excel</span>
                        <i class="fas fa-file-excel"></i>
                    </button>
                    <button onclick="if(Auth.checkAuth()) printToNewTab()" class="btn-analyze"
                        style="background-color: var(--secondary-color); color: white; border: none; padding: 10px 20px; border-radius: 8px; display: flex; align-items: center; gap: 8px; font-weight: 500; transition: all 0.3s ease; box-shadow: 0 4px 6px rgba(52, 152, 219, 0.2);">
                        <span>طباعة النتائج</span>
                        <span data-icon="print">🖨️</span>
                    </button>
                </div>
            </div>
        </div>

        <section class="filter-card"
            style="background: var(--bg-color); padding: 6px 8px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
            <div class="controls-container"
                style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; justify-content: flex-start; direction: rtl;">
                <div class="filter-group"
                    style="display: flex; align-items: center; gap: 3px; background: var(--card-bg); padding: 3px 6px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <label
                        style="font-weight: 700; color: var(--primary-color); font-size: 0.72rem; margin: 0; white-space: nowrap;">📅
                        السنة:</label>
                    <select id="yearSelect"
                        style="border: none; background: transparent; font-size: 0.8rem; color: var(--primary-color); padding: 0; font-weight: 600; cursor: pointer; outline: none; min-width: 65px;"></select>
                </div>
                <div class="filter-group"
                    style="display: flex; align-items: center; gap: 3px; background: var(--card-bg); padding: 3px 6px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <label
                        style="font-weight: 700; color: var(--primary-color); font-size: 0.72rem; margin: 0; white-space: nowrap;">🗓️
                        الفصل:</label>
                    <select id="trimesterSelect"
                        style="border: none; background: transparent; font-size: 0.8rem; color: var(--primary-color); padding: 0; font-weight: 600; cursor: pointer; outline: none;">
                        <option value="" selected disabled>--</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="annual">السنوي</option>
                    </select>
                </div>
                <div class="filter-group"
                    style="display: flex; align-items: center; gap: 3px; background: var(--card-bg); padding: 3px 6px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <label
                        style="font-weight: 700; color: var(--primary-color); font-size: 0.72rem; margin: 0; white-space: nowrap;">🎓
                        المستوى:</label>
                    <select id="levelSelect"
                        style="border: none; background: transparent; font-size: 0.8rem; color: var(--primary-color); padding: 0; font-weight: 600; cursor: pointer; outline: none; min-width: 45px;"></select>
                </div>
                <div class="filter-group" id="streamGroup"
                    style="display: none; align-items: center; gap: 3px; background: var(--card-bg); padding: 3px 6px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <label
                        style="font-weight: 700; color: var(--primary-color); font-size: 0.72rem; margin: 0; white-space: nowrap;">🌿
                        الشعبة:</label>
                    <select id="streamSelect"
                        style="border: none; background: transparent; font-size: 0.8rem; color: var(--primary-color); padding: 0; font-weight: 600; cursor: pointer; outline: none; min-width: 55px;">
                        <option value="">-- كل الشعب --</option>
                    </select>
                </div>
                <div class="filter-group"
                    style="display: flex; align-items: center; gap: 3px; background: var(--card-bg); padding: 3px 6px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <label
                        style="font-weight: 700; color: var(--primary-color); font-size: 0.72rem; margin: 0; white-space: nowrap;">👥
                        القسم:</label>
                    <select id="classSelect"
                        style="border: none; background: transparent; font-size: 0.8rem; color: var(--primary-color); padding: 0; font-weight: 600; cursor: pointer; outline: none; min-width: 45px;"></select>
                </div>
            </div>
            <div id="classResponsibleContainer"
                style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-color); display: flex; align-items: center; gap: 10px; color: #27ae60;">
                <span style="font-size: 1.1rem;" data-icon="teacher">👨‍🏫</span>
                <span style="font-weight: 700; font-size: 0.85rem;">مسؤول القسم:</span>
                <span id="classResponsibleDisplay" style="font-weight: bold; font-size: 0.95rem;">-</span>
            </div>
            <div id="directedBirthYearQuickPanel"
                style="display: none; margin-top: 12px; padding: 12px 14px; border-radius: 12px; border: 1px solid #d8b4fe; background: linear-gradient(135deg, #faf5ff, #f5f3ff);">
                    <div
                    style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 220px; flex: 1 1 220px;">
                        <strong id="directedBirthYearQuickTitle" style="color: #6b21a8; font-size: 0.92rem;">سنة ميلاد الموجَّهين</strong>
                        <span id="directedBirthYearQuickNote"
                            style="color: #7c3aed; font-size: 0.78rem;">تُستخدم لتحديد قرار يوجَّه بدل يعيد.</span>
                    </div>
                    <div id="directedBirthYearQuickControls" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span id="directedBirthYearQuickCurrent"
                            style="padding: 6px 10px; border-radius: 999px; background: rgba(124, 58, 237, 0.12); color: #6b21a8; font-weight: 700; font-size: 0.82rem;">الحالية: -</span>
                        <input type="number" id="directedBirthYearQuickInput" min="1900" max="2100" step="1"
                            placeholder="مثال: 2010"
                            style="width: 96px; padding: 8px 10px; border: 1px solid #c4b5fd; border-radius: 8px; background: white; color: #4c1d95; font-weight: 700; outline: none;">
                        <button type="button" onclick="saveDirectedBirthYearQuickSetting()"
                            style="padding: 8px 14px; border: none; border-radius: 8px; background: #7c3aed; color: white; font-weight: 700; cursor: pointer;">حفظ</button>
                    </div>
                </div>
            </div>
        </section>

        <section class="dashboard">
            <div class="dashboard-grid">
                <div class="card">
                    <h3>التعداد العام</h3>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>الفئة</th>
                                <th>العدد</th>
                                <th>ناجحون</th>
                                <th>راسبون</th>
                                <th>المعدل</th>
                                <th>نسبة النجاح</th>
                            </tr>
                        </thead>
                        <tbody id="generalStatsBody"></tbody>
                    </table>

                    <div id="decisionStatsContainer"
                        style="display: none; margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px;">
                        <h4 style="margin-bottom: 5px; color: #8e44ad;">إحصائيات القرارات</h4>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="background-color: #27ae60;">ينتقل</th>
                                    <th style="background-color: #d35400;">يستدرك</th>
                                    <th style="background-color: #c0392b;">يعيد</th>
                                    <th style="background-color: #7f8c8d;">يوجه</th>
                                </tr>
                            </thead>
                            <tbody id="decisionStatsBody"></tbody>
                        </table>
                    </div>
                </div>

                <div class="card">
                    <h3>توزيع المعدلات</h3>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>المجال</th>
                                <th>العدد</th>
                            </tr>
                        </thead>
                        <tbody id="gradeDistributionBody"></tbody>
                    </table>
                </div>
            </div>

            <div class="dashboard-grid">
                <div class="card" style="grid-column: span 2;">
                    <h3>نتائج المواد</h3>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>المادة</th>
                                <th>ناجحون</th>
                                <th>راسبون</th>
                                <th>معدل المادة</th>
                                <th id="prevRateHeader" style="display: none;">نسبة ف1</th>
                                <th id="currentRateHeader">نسبة النجاح</th>
                            </tr>
                        </thead>
                        <tbody id="subjectStatsBody"></tbody>
                    </table>
                </div>
            </div>

            <div class="chart-container" style="margin-top: 20px;">
                <canvas id="subjectsChart"></canvas>
            </div>
        </section>

        <section class="student-list" style="margin-top: 0;">
            <h2 style="margin: 5px 0;">📋 القائمة التفصيلية للتلاميذ</h2>
            <div class="data-table-container">
                <table class="data-table">
                    <thead id="detailedTableHead"></thead>
                    <tbody id="detailedTableBody"></tbody>
                </table>
            </div>
        </section>
    </div>

    <div id="toastContainer" class="toast-container"></div>

    <div id="studentModal" class="modal-overlay" style="display:none;">
        <div class="modal-content animate-pop-in student-detail-modal">
            <div class="modal-header">
                <h3 id="studentModalName">اسم التلميذ</h3>
                <button class="modal-close" onclick="closeStudentModal()">&times;</button>
            </div>
            <div class="modal-body" id="studentModalBody"></div>
        </div>
    </div>

    <div id="councilSettingsModal" class="modal-overlay"
        style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 9999; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
        <div class="modal-content animate-pop-in"
            style="background: #fdfdfd; padding: 0; border-radius: 16px; width: 95%; max-width: 650px; max-height: 95vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.25); border: 1px solid var(--border-color);">
            <div class="modal-header"
                style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 20px 25px; display: flex; justify-content: space-between; align-items: center;">
                <h3
                    style="margin: 0; font-size: 1.4rem; display: flex; align-items: center; gap: 12px; font-weight: 700; color: white !important;">
                    <span style="background: rgba(255,255,255,0.15); padding: 8px; border-radius: 10px;"
                        data-icon="settings">⚙️</span>
                    إعدادات محضر مجلس الأقسام
                </h3>
                <button onclick="closeCouncilSettings()"
                    style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; width: 35px; height: 35px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
            </div>

            <div class="modal-body" style="padding: 25px; overflow-y: auto; max-height: calc(90vh - 140px);">
                <div style="margin-bottom: 25px;">
                    <h4
                        style="margin: 0 0 15px 0; color: #34495e; font-size: 1.05rem; display: flex; align-items: center; gap: 10px;">
                        <span style="color: var(--secondary-color);">👤</span> الطاقم الإداري والتوقيت
                    </h4>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label
                                style="display: block; margin-bottom: 6px; font-size: 0.85rem; font-weight: 700; color: var(--primary-color);">المدير:</label>
                            <input type="text" id="councilDirectorInput" placeholder="اسم المدير..."
                                style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; background: var(--card-bg); outline: none; border-left: 3px solid var(--secondary-color);">
                        </div>
                        <div class="form-group">
                            <label
                                style="display: block; margin-bottom: 6px; font-size: 0.85rem; font-weight: 700; color: var(--primary-color);">الناظر:</label>
                            <input type="text" id="councilCensorInput" placeholder="اسم الناظر..."
                                style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; background: var(--card-bg); outline: none; border-left: 3px solid var(--secondary-color);">
                        </div>
                        <div class="form-group">
                            <label
                                style="display: block; margin-bottom: 6px; font-size: 0.85rem; font-weight: 700; color: var(--primary-color);">مستشار
                                التوجيه:</label>
                            <input type="text" id="councilCounselorInput" placeholder="اسم مستشار التوجيه..."
                                style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; background: var(--card-bg); outline: none; border-left: 3px solid var(--secondary-color);">
                        </div>
                        <div class="form-group">
                            <label
                                style="display: block; margin-bottom: 6px; font-size: 0.85rem; font-weight: 700; color: var(--primary-color);">📅
                                تاريخ الانعقاد:</label>
                            <input type="text" id="councilDateInput" placeholder="الاثنين 12 مارس 2026"
                                style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; background: var(--bg-color); outline: none;">
                        </div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label
                                style="display: block; margin-bottom: 6px; font-size: 0.85rem; font-weight: 700; color: var(--primary-color);">🕒
                                ساعة الانعقاد:</label>
                            <input type="text" id="councilTimeInput" placeholder="مثال: 10:00 صباحا"
                                style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; background: var(--bg-color); outline: none;">
                        </div>
                    </div>
                </div>

                <div
                    style="margin-bottom: 25px; background: var(--bg-color); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <h4
                        style="margin: 0 0 12px 0; color: #34495e; font-size: 1.05rem; display: flex; align-items: center; gap: 10px;">
                        <span style="color: #2980b9;">📝</span> جدول الأعمال
                    </h4>
                    <textarea id="councilAgendaInput" rows="4" placeholder="أدخل عناصر جدول الأعمال (عنصر في كل سطر)..."
                        style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; background: var(--card-bg); resize: vertical; outline: none; line-height: 1.6;"></textarea>
                    <small style="color: #64748b; display: block; margin-top: 8px; font-style: italic;">* اترك الخانة
                        فارغة لاستخدام جدول الأعمال الافتراضي.</small>
                </div>

                <div>
                    <h4
                        style="margin: 0 0 15px 0; color: #34495e; font-size: 1.05rem; display: flex; align-items: center; gap: 10px;">
                        <span style="color: #27ae60;">✍️</span> نصوص المداولات المخصصة
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div class="form-group">
                            <label
                                style="display: block; margin-bottom: 6px; font-size: 0.85rem; font-weight: 700; color: var(--primary-color);">2
                                - تشخيص وضعية الانضباط:</label>
                            <textarea id="councilDelib2Input" rows="2"
                                style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.9rem; background: var(--card-bg); resize: vertical; outline: none;"></textarea>
                        </div>
                        <div class="form-group"
                            style="background: #fffafa; padding: 12px; border-radius: 8px; border: 1px solid #ffebeb;">
                            <label
                                style="display: block; margin-bottom: 6px; font-size: 0.85rem; font-weight: 700; color: #b91c1c;">5
                                - الملاحظات المستخلصة:</label>
                            <textarea id="councilDelib5Input" rows="3"
                                style="width: 100%; padding: 10px; border: 1px solid #fecaca; border-radius: 8px; font-size: 0.9rem; background: var(--card-bg); resize: vertical; outline: none;"></textarea>
                            <small style="color: #991b1b; display: block; margin-top: 5px; font-size: 11px;">* يتم تضييق
                                النطاق الرقمي آليا (مثل 0-9.99).</small>
                        </div>
                        <div class="form-group">
                            <label
                                style="display: block; margin-bottom: 6px; font-size: 0.85rem; font-weight: 700; color: var(--primary-color);">6
                                - دراسة التوجيه التدريجي:</label>
                            <textarea id="councilDelib6Input" rows="2"
                                style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.9rem; background: var(--card-bg); resize: vertical; outline: none;"></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <div style="padding: 18px 25px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; background: #fafafa;">
                <button onclick="closeCouncilSettings()" class="btn-analyze"
                    style="background: var(--border-color); color: #334155; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700;">
                    إلغاء
                </button>
                <button onclick="saveCouncilSettings()" class="btn-analyze"
                    style="background: #27ae60; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700;">
                    حفظ الإعدادات
                </button>
            </div>
        </div>
    </div>
`;

function renderClassAnalysisShell() {
    const mount = document.getElementById('classAnalysisApp');
    if (!mount || mount.getAttribute('data-react-shell') === 'ready') return;

    if (typeof React === 'undefined' || typeof ReactDOM === 'undefined' || !classAnalysisElement) {
        mount.innerHTML = CLASS_ANALYSIS_SHELL_HTML;
    } else {
        const shellNode = classAnalysisElement('div', {
            dangerouslySetInnerHTML: { __html: CLASS_ANALYSIS_SHELL_HTML }
        });

        if (typeof ReactDOM.render === 'function') {
            ReactDOM.render(shellNode, mount);
        } else if (typeof ReactDOM.createRoot === 'function') {
            const root = ReactDOM.createRoot(mount);
            root.render(shellNode);
        } else {
            mount.innerHTML = CLASS_ANALYSIS_SHELL_HTML;
        }
    }

    mount.setAttribute('data-react-shell', 'ready');
}

function renderIntoDomContainer(container, element) {
    if (!container || typeof ReactDOM === 'undefined') return;

    if (typeof ReactDOM.render === 'function') {
        ReactDOM.render(element, container);
        return;
    }

    if (!container.__reactRoot && typeof ReactDOM.createRoot === 'function') {
        container.__reactRoot = ReactDOM.createRoot(container);
    }

    if (container.__reactRoot) {
        container.__reactRoot.render(element);
    }
}

function renderAnalysisTanStackNode(template, context) {
    if (template == null) return null;
    return typeof template === 'function' ? template(context) : template;
}

function renderHtmlContent(html) {
    return classAnalysisElement('span', {
        dangerouslySetInnerHTML: { __html: html || '' }
    });
}

function parseAnalysisNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value.replace(',', '.'));
    return parseFloat(value || 0);
}

function buildAnalysisTanStackTable(data, columns) {
    if (!window.TableCore || typeof window.TableCore.createTable !== 'function' || typeof window.TableCore.getCoreRowModel !== 'function') {
        return null;
    }

    return window.TableCore.createTable({
        data: data || [],
        columns: columns || [],
        state: {
            columnPinning: {
                left: [],
                right: []
            }
        },
        getCoreRowModel: window.TableCore.getCoreRowModel()
    });
}

function AnalysisTanStackBody(props) {
    const columns = props.columns || [];
    const data = props.data || [];
    const table = buildAnalysisTanStackTable(data, columns);
    const rows = table ? table.getRowModel().rows : [];

    if (!rows.length) {
        return classAnalysisElement(React.Fragment, null,
            classAnalysisElement('tr', null,
                classAnalysisElement('td', {
                    colSpan: props.colSpan || Math.max(columns.length, 1),
                    style: props.emptyCellStyle || { textAlign: 'center', padding: '20px', color: '#7f8c8d' }
                }, props.emptyMessage || 'لا توجد بيانات')
            )
        );
    }

    return classAnalysisElement(React.Fragment, null,
        rows.map(function (row, rowIndex) {
            let rowProps = { key: row.id };
            if (typeof props.getRowProps === 'function') {
                rowProps = Object.assign(rowProps, props.getRowProps(row, rowIndex) || {});
            }

            return classAnalysisElement('tr', rowProps,
                row.getVisibleCells().map(function (cell) {
                    const meta = cell.column.columnDef.meta || {};
                    let content = renderAnalysisTanStackNode(cell.column.columnDef.cell, cell.getContext());
                    if (content == null) {
                        content = cell.getValue();
                    }

                    let cellProps = {
                        key: cell.id,
                        className: meta.className || undefined,
                        style: meta.style || undefined,
                        'data-column-id': cell.column.id
                    };

                    if (typeof meta.getCellProps === 'function') {
                        cellProps = Object.assign(cellProps, meta.getCellProps(cell) || {});
                    }

                    return classAnalysisElement('td', cellProps, content);
                })
            );
        })
    );
}

function AnalysisTanStackHead(props) {
    const columns = props.columns || [];
    const table = buildAnalysisTanStackTable([], columns);
    const headerGroups = table ? table.getHeaderGroups() : [];

    return classAnalysisElement(React.Fragment, null,
        headerGroups.map(function (headerGroup) {
            return classAnalysisElement('tr', { key: headerGroup.id },
                headerGroup.headers.map(function (header) {
                    const meta = header.column.columnDef.meta || {};
                    const headerContent = renderAnalysisTanStackNode(header.column.columnDef.header, header.getContext());
                    let headerProps = {
                        key: header.id,
                        colSpan: header.colSpan,
                        className: meta.headerClassName || undefined,
                        style: meta.headerStyle || undefined,
                        'data-column-id': header.column.id
                    };

                    if (typeof meta.getHeaderProps === 'function') {
                        headerProps = Object.assign(headerProps, meta.getHeaderProps(header) || {});
                    }

                    return classAnalysisElement('th', headerProps, headerContent);
                })
            );
        })
    );
}

function renderTanStackBodyById(tbodyId, columns, data, options) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody || !classAnalysisElement) return;

    renderIntoDomContainer(tbody, classAnalysisElement(AnalysisTanStackBody, {
        columns: columns,
        data: data,
        colSpan: options && options.colSpan,
        emptyMessage: options && options.emptyMessage,
        emptyCellStyle: options && options.emptyCellStyle,
        getRowProps: options && options.getRowProps
    }));
}

function renderTanStackHeadById(theadId, columns) {
    const thead = document.getElementById(theadId);
    if (!thead || !classAnalysisElement) return;

    renderIntoDomContainer(thead, classAnalysisElement(AnalysisTanStackHead, {
        columns: columns
    }));
}

function buildGeneralStatsColumns() {
    return [
        { id: 'label', accessorKey: 'label' },
        { id: 'count', accessorKey: 'count' },
        { id: 'passed', accessorKey: 'passed', meta: { className: 'high-score' } },
        { id: 'failed', accessorKey: 'failed', meta: { className: 'low-score' } },
        { id: 'avg', accessorKey: 'avg' },
        {
            id: 'rate',
            accessorKey: 'rate',
            cell: function (info) { return info.getValue() + '%'; }
        }
    ];
}

function buildGradeDistributionColumns() {
    return [
        { id: 'label', accessorKey: 'label' },
        { id: 'count', accessorKey: 'count' }
    ];
}

function buildSubjectStatsColumns(hasComparison) {
    const columns = [
        { id: 'subject', accessorKey: 'subject' },
        { id: 'passed', accessorKey: 'passed' },
        { id: 'failed', accessorKey: 'failed' },
        { id: 'avg', accessorKey: 'avg' }
    ];

    if (hasComparison) {
        columns.push({ id: 'prevRate', accessorKey: 'prevRate' });
    }

    columns.push({
        id: 'rate',
        accessorKey: 'rate',
        cell: function (info) {
            const row = info.row.original;
            const style = {
                color: row.rateColor,
                fontWeight: row.rateColor === 'red' ? 'bold' : 'normal'
            };

            const children = [row.rate + '%'];
            if (row.trend === 'up') {
                children.push(classAnalysisElement('span', {
                    key: 'trend-up',
                    style: { color: '#27ae60', fontSize: '1em', marginRight: '4px' }
                }, '▲'));
            } else if (row.trend === 'down') {
                children.push(classAnalysisElement('span', {
                    key: 'trend-down',
                    style: { color: '#c0392b', fontSize: '1em', marginRight: '4px' }
                }, '▼'));
            }

            return classAnalysisElement('span', { style: style }, children);
        }
    });

    return columns;
}

function renderGeneralStats(data = studentsData) {
    const males = data.filter(function (student) { return student.gender === 'ذكر'; });
    const females = data.filter(function (student) { return student.gender === 'أنثى'; });
    const stats = [
        { label: 'ذكور', data: males },
        { label: 'إناث', data: females },
        { label: 'المجموع', data: data }
    ].map(function (row) {
        const count = row.data.length;
        const passed = row.data.filter(function (student) { return getStudentAverage(student) >= 10; }).length;
        const averages = row.data.map(function (student) {
            return getStudentAverage(student);
        }).filter(function (avg) {
            return typeof avg === 'number' && !isNaN(avg) && avg > 0;
        });

        return {
            label: row.label,
            count: count,
            passed: passed,
            failed: count - passed,
            avg: averages.length > 0 ? (averages.reduce(function (sum, avg) { return sum + avg; }, 0) / averages.length).toFixed(2) : '-',
            rate: count > 0 ? ((passed / count) * 100).toFixed(2) : '0.00'
        };
    });

    renderTanStackBodyById('generalStatsBody', buildGeneralStatsColumns(), stats, {
        colSpan: 6
    });
}

function renderGradeDistribution(data = studentsData) {
    const ranges = [
        { label: '00 - 09.99', min: 0, max: 9.99 },
        { label: '10 - 11.99', min: 10, max: 11.99 },
        { label: '12 - 13.99', min: 12, max: 13.99 },
        { label: '14 - 15.99', min: 14, max: 15.99 },
        { label: '16 - 17.99', min: 16, max: 17.99 },
        { label: '18 - 20.00', min: 18, max: 20 }
    ].map(function (range) {
        return {
            label: range.label,
            count: data.filter(function (student) {
                const avg = getStudentAverage(student);
                return avg >= range.min && avg <= range.max;
            }).length
        };
    });

    renderTanStackBodyById('gradeDistributionBody', buildGradeDistributionColumns(), ranges, {
        colSpan: 2
    });
}

function buildDetailedColumns(activeOrderedSubjects, options) {
    const columns = [
        {
            id: 'index',
            accessorKey: 'index',
            header: '#',
            meta: { headerStyle: { width: '25px' }, style: { width: '25px' } }
        },
        {
            id: 'name',
            accessorKey: 'name',
            header: 'اللقب والاسم',
            meta: {
                headerStyle: { width: '110px' },
                style: { textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
            }
        },
        {
            id: 'gender',
            accessorKey: 'gender',
            header: 'الجنس',
            meta: {
                headerClassName: 'gender-col',
                headerStyle: { width: '35px' },
                style: { fontSize: '0.85em' }
            }
        },
        {
            id: 'dob',
            accessorKey: 'dob',
            header: 'ت.الميلاد',
            meta: {
                headerStyle: { width: '75px' },
                style: { whiteSpace: 'nowrap', fontSize: '0.85em' }
            }
        }
    ];

    activeOrderedSubjects.forEach(function (subjectName, subjectIndex) {
        columns.push({
            id: 'subject_' + subjectIndex,
            accessorFn: function (row) { return row.subjects[subjectIndex]; },
            header: function () {
                return classAnalysisElement('div', null, getSubjectAbbreviation(subjectName));
            },
            cell: function (info) {
                const cellValue = info.getValue();
                return cellValue ? cellValue.display : '-';
            },
            meta: {
                headerClassName: 'vertical-header',
                getCellProps: function (cell) {
                    const value = cell.getValue();
                    return {
                        style: { color: value && value.color ? value.color : 'black' }
                    };
                }
            }
        });
    });

    if (options.hasComparison) {
        columns.push({
            id: 'prevAverage',
            accessorKey: 'prevAverage',
            header: 'م.ف1',
            meta: {
                headerStyle: { width: '45px', background: '#bdc3c7', color: 'black' },
                style: { background: '#ecf0f1', fontWeight: 'bold', color: '#7f8c8d', fontSize: '0.9em' }
            }
        });
    }

    columns.push({
        id: 'currentAverage',
        accessorKey: 'currentAverage',
        header: 'م.الفصل',
        cell: function (info) {
            const row = info.row.original;
            const children = [row.currentAverage];
            if (row.averageTrend === 'up') {
                children.push(classAnalysisElement('span', {
                    key: 'avg-up',
                    style: { color: '#27ae60', fontSize: '1.1em', verticalAlign: 'middle', marginRight: '4px' }
                }, '▲'));
            } else if (row.averageTrend === 'down') {
                children.push(classAnalysisElement('span', {
                    key: 'avg-down',
                    style: { color: '#c0392b', fontSize: '1.1em', verticalAlign: 'middle', marginRight: '4px' }
                }, '▼'));
            }
            return classAnalysisElement('span', null, children);
        },
        meta: {
            getHeaderProps: function () {
                return {
                    onClick: function () { sortStudentsByScore(); },
                    style: {
                        width: '45px',
                        background: '#e74c3c',
                        color: 'white',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                    }
                };
            },
            style: { fontWeight: 'bold', background: '#f0f0f0', whiteSpace: 'nowrap' }
        }
    });

    if (options.isAnnual) {
        columns[columns.length - 1].header = 'م.سنوي';
    }

    const showDecisionColumn = (options.isT3 || options.isAnnual) && !options.isFinalYear;

    if (options.isT3) {
        columns.push({
            id: 'annualAverage',
            accessorKey: 'annualAverage',
            header: function () {
                return classAnalysisElement('div', null, 'م.سنوي');
            },
            meta: {
                headerClassName: 'vertical-header',
                headerStyle: { width: '45px', background: '#8e44ad', color: 'white' },
                style: { fontWeight: 'bold', background: '#e8daef' }
            }
        });

    }

    if (showDecisionColumn) {
        columns.push({
            id: 'decision',
            accessorKey: 'decision',
            header: 'القرار',
            cell: function (info) {
                const row = info.row.original;
                if (row.decisionEditable) {
                    return classAnalysisElement('select', {
                        value: row.manualDecisionCode || 'repeated',
                        title: 'تحديد القرار يدويًا للطور الثانوي',
                        onClick: function (event) { event.stopPropagation(); },
                        onMouseDown: function (event) { event.stopPropagation(); },
                        onChange: async function (event) {
                            event.stopPropagation();
                            const selectEl = event.currentTarget;
                            selectEl.disabled = true;
                            const didSave = await saveSecondaryStudentDecisionFromClassAnalysis(
                                row.manualDecisionKey,
                                event.target.value
                            );
                            if (!didSave) {
                                selectEl.disabled = false;
                                selectEl.value = row.manualDecisionCode || 'repeated';
                            }
                        },
                        style: {
                            width: '100%',
                            minWidth: '78px',
                            fontWeight: 'bold',
                            color: row.decisionColor || 'black',
                            border: '1px solid rgba(44, 62, 80, 0.16)',
                            borderRadius: '8px',
                            background: '#fff',
                            padding: '4px 6px',
                            cursor: 'pointer',
                            direction: 'rtl'
                        }
                    }, [
                        classAnalysisElement('option', { value: 'repeated', key: 'repeated' }, 'يعيد'),
                        classAnalysisElement('option', { value: 'directed', key: 'directed' }, 'يوجّه')
                    ]);
                }
                return classAnalysisElement('span', {
                    style: { color: row.decisionColor || 'black', fontWeight: 'bold' }
                }, info.getValue());
            },
            meta: {
                headerClassName: 'decision-col',
                headerStyle: {
                    width: options.isSecondaryStage ? '88px' : '40px',
                    background: 'var(--primary-color)',
                    color: 'white'
                },
                style: options.isSecondaryStage ? { minWidth: '88px' } : undefined
            }
        });
    } else if (!options.isAnnual) {
        columns.push({
            id: 'appreciation',
            accessorKey: 'appreciation',
            header: 'التقدير',
            cell: function (info) { return renderHtmlContent(info.getValue()); },
            meta: {
                headerClassName: 'appreciation-col',
                headerStyle: { width: '40px', background: '#e74c3c', color: 'white' },
                className: 'appreciation-col'
            }
        });
    }

    return columns;
}

function renderSubjectStats(data = studentsData, activeSubjects = subjects) {
    const tbody = document.getElementById('subjectStatsBody');
    if (!tbody) return;
    const levelSelect = document.getElementById('levelSelect');
    const selectedLevel = levelSelect ? levelSelect.value : '';
    activeSubjects = filterSubjectsForContext(selectedLevel, activeSubjects, data);

    if (!activeSubjects || activeSubjects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">لا توجد مواد متاحة</td></tr>';
        return;
    }

    const trimesterSelect = document.getElementById('trimesterSelect');
    const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';
    let prevTrimesterVal = null;
    let prevTrimesterName = '';

    if (selectedTrimesterVal === '2') {
        prevTrimesterVal = '1';
        prevTrimesterName = 'الفصل الأول';
    } else if (selectedTrimesterVal === '3') {
        prevTrimesterVal = '2';
        prevTrimesterName = 'الفصل الثاني';
    }

    const prevRateHeader = document.getElementById('prevRateHeader');
    if (prevRateHeader) {
        prevRateHeader.style.display = prevTrimesterVal ? 'table-cell' : 'none';
    }

    const currentRateHeader = document.getElementById('currentRateHeader');
    if (currentRateHeader) {
        if (selectedTrimesterVal === 'annual') {
            currentRateHeader.textContent = 'نسبة النجاح السنوية';
        } else {
            currentRateHeader.textContent = selectedTrimesterVal !== '1' ? `نسبة ف${selectedTrimesterVal}` : 'نسبة النجاح';
        }
    }

    if (prevTrimesterVal && !statsCache.has('stats_' + prevTrimesterVal)) {
        const prevStats = {};
        const allSubjects = Array.from(new Set([].concat(subjects || [], Object.keys(subjectAliases || {}))));

        allSubjects.forEach(function (subjectName) {
            const scores = data.map(function (student) {
                return getSubjectScore(student, subjectName, prevTrimesterVal);
            }).filter(function (mark) {
                return mark !== null && mark !== undefined;
            });

            if (scores.length > 0) {
                const passed = scores.filter(function (mark) { return mark >= 10; }).length;
                prevStats[subjectName] = ((passed / scores.length) * 100).toFixed(2);
            }
        });

        statsCache.set('stats_' + prevTrimesterVal, prevStats);
    }

    const rows = [];

    activeSubjects.forEach(function (subjectName) {
        const scores = data.map(function (student) {
            return getSubjectScore(student, subjectName, selectedTrimesterVal);
        }).filter(function (mark) {
            return mark !== null && mark !== undefined;
        });

        if (scores.length === 0) {
            const row = {
                subject: subjectName,
                passed: '-',
                failed: '-',
                avg: '-',
                rate: '-',
                rateColor: 'inherit',
                trend: 'none'
            };
            if (prevTrimesterVal) row.prevRate = '-';
            rows.push(row);
            return;
        }

        const passed = scores.filter(function (mark) { return mark >= 10; }).length;
        const failed = scores.length - passed;
        const avg = (scores.reduce(function (sum, mark) { return sum + Number(mark); }, 0) / scores.length).toFixed(2);
        const rate = ((passed / scores.length) * 100).toFixed(2);
        const row = {
            subject: subjectName,
            passed: passed,
            failed: failed,
            avg: avg,
            rate: rate,
            rateColor: parseFloat(rate) < 50 ? 'red' : 'green',
            trend: 'none',
            prevTrimesterName: prevTrimesterName
        };

        if (prevTrimesterVal) {
            const cachedStats = statsCache.get('stats_' + prevTrimesterVal) || {};
            const prevRate = cachedStats[subjectName];
            row.prevRate = prevRate !== undefined ? (prevRate + '%') : '-';
            if (prevRate !== undefined) {
                row.prevRateValue = prevRate;
                if (parseFloat(rate) > parseFloat(prevRate)) row.trend = 'up';
                else if (parseFloat(rate) < parseFloat(prevRate)) row.trend = 'down';
            }
        }

        rows.push(row);
    });

    renderTanStackBodyById('subjectStatsBody', buildSubjectStatsColumns(!!prevTrimesterVal), rows, {
        colSpan: prevTrimesterVal ? 6 : 5,
        getRowProps: function (row) {
            const item = row.original;
            if (!item.prevRateValue) return {};

            return {
                style: { cursor: 'help' },
                onMouseEnter: function (event) { showTooltip(event, item.prevTrimesterName, item.prevRateValue + '%'); },
                onMouseMove: moveTooltip,
                onMouseLeave: hideTooltip
            };
        }
    });
}

function renderRows(data, activeOrderedSubjects) {
    currentStudentsData = data;

    const settings = institutionSettings || {};
    const directedBirthYear = parseInt(settings.directedBirthYear);
    const trimesterSelect = document.getElementById('trimesterSelect');
    const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';
    const isT3 = selectedTrimesterVal === '3';
    const isAnnual = selectedTrimesterVal === 'annual';
    const isDecisionMode = isT3 || isAnnual;
    const hasComparison = selectedTrimesterVal === '2';
    const prevTrimVal = hasComparison ? '1' : null;
    const stage = institutionSettings.educationStage || 'middle';
    const levelSelect = document.getElementById('levelSelect');
    const levelValue = levelSelect ? levelSelect.value : '';
    const isFinalYear = (stage === 'secondary' && levelValue === '3') || (stage !== 'secondary' && levelValue === '4');
    activeOrderedSubjects = filterSubjectsForContext(levelValue, activeOrderedSubjects, data);

    const subjectsWithMarks = activeOrderedSubjects.filter(function (subjectName) {
        return data.some(function (student) {
            const mark = getSubjectScore(student, subjectName);
            const numericMark = parseAnalysisNumber(mark);
            return mark !== null && mark !== undefined && mark !== '-' && !isNaN(numericMark) && numericMark > 0;
        });
    });

    const rows = data.map(function (student, index) {
        const currentAvgRaw = typeof getStudentAverage(student) === 'number'
            ? getStudentAverage(student)
            : parseFloat(getStudentAverage(student) || 0);

        const row = {
            index: index + 1,
            name: student.name || '',
            gender: student.gender || '-',
            dob: formatDate(student.dob),
            studentId: student.id,
            subjects: subjectsWithMarks.map(function (subjectName) {
                const mark = getSubjectScore(student, subjectName);
                const numericMark = parseAnalysisNumber(mark);
                return {
                    display: mark !== null && mark !== undefined ? mark : '-',
                    color: !isNaN(numericMark) && numericMark < 10 ? 'red' : 'black'
                };
            }),
            currentAverage: (isNaN(currentAvgRaw) ? 0 : currentAvgRaw).toFixed(2),
            averageTrend: 'none',
            appreciation: getAppreciation(currentAvgRaw)
        };

        if (hasComparison) {
            const avgPrevRaw = getTrimesterAverage(student, prevTrimVal);
            const avgPrev = parseAnalysisNumber(avgPrevRaw);
            row.prevAverage = !isNaN(avgPrev) && avgPrev > 0 ? avgPrev.toFixed(2) : '-';
            if (!isNaN(avgPrev) && avgPrev > 0) {
                if (currentAvgRaw > avgPrev) row.averageTrend = 'up';
                else if (currentAvgRaw < avgPrev) row.averageTrend = 'down';
            }
        }

        if (isDecisionMode) {
            const decisionSnapshot = getAnnualDecisionSnapshot(student, directedBirthYear);
            if (isT3) {
                row.annualAverage = decisionSnapshot.annualAverage;
            }
            row.decision = decisionSnapshot.decision;
            row.decisionColor = decisionSnapshot.decisionColor;
            row.decisionEditable = !!decisionSnapshot.decisionEditable;
            row.manualDecisionCode = decisionSnapshot.manualDecisionCode || '';
            row.manualDecisionKey = decisionSnapshot.manualDecisionKey || '';
            student.decision = decisionSnapshot.decision;
        }

        return row;
    });

    const columns = buildDetailedColumns(subjectsWithMarks, {
        hasComparison: hasComparison,
        isT3: isT3,
        isAnnual: isAnnual,
        isFinalYear: isFinalYear,
        isSecondaryStage: stage === 'secondary'
    });

    renderTanStackHeadById('detailedTableHead', columns);
    renderTanStackBodyById('detailedTableBody', columns, rows, {
        colSpan: columns.length,
        getRowProps: function (row) {
            return {
                style: { cursor: 'pointer' },
                title: 'اضغط لعرض تفاصيل التلميذ',
                onClick: function () {
                    if (row.original.studentId !== undefined && row.original.studentId !== null) {
                        showStudentModal(String(row.original.studentId));
                    }
                }
            };
        }
    });
}

function updateDecisionStats(data) {
    const trimesterSelect = document.getElementById('trimesterSelect');
    const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';
    const container = document.getElementById('decisionStatsContainer');
    const stage = institutionSettings.educationStage || 'middle';
    const levelSelect = document.getElementById('levelSelect');
    const levelValue = levelSelect ? levelSelect.value : '';
    const isFinalYear = (stage === 'secondary' && levelValue === '3') || (stage !== 'secondary' && levelValue === '4');

    if (selectedTrimesterVal !== '3' || isFinalYear) {
        if (container) container.style.display = 'none';
        return;
    }

    if (container) container.style.display = 'block';

    const directedBirthYear = parseInt((institutionSettings || {}).directedBirthYear);
    let passed = 0;
    let remedial = 0;
    let repeated = 0;
    let directed = 0;

    data.forEach(function (student) {
        const decisionSnapshot = getAnnualDecisionSnapshot(student, directedBirthYear);

        if (decisionSnapshot.decision === 'ينتقل') {
            passed++;
        } else if (decisionSnapshot.decision === 'يستدرك') {
            remedial++;
        } else if (decisionSnapshot.decision === 'يوجّه') {
            directed++;
        } else {
            repeated++;
        }
    });

    renderTanStackBodyById('decisionStatsBody', [
        { id: 'passed', accessorKey: 'passed', meta: { style: { fontWeight: 'bold', color: '#27ae60' } } },
        { id: 'remedial', accessorKey: 'remedial', meta: { style: { fontWeight: 'bold', color: '#d35400' } } },
        { id: 'repeated', accessorKey: 'repeated', meta: { style: { fontWeight: 'bold', color: '#c0392b' } } },
        { id: 'directed', accessorKey: 'directed', meta: { style: { fontWeight: 'bold', color: '#7f8c8d' } } }
    ], [{
        passed: passed,
        remedial: remedial,
        repeated: repeated,
        directed: directed
    }], {
        colSpan: 4
    });
}

function applyTrialModeLimitations() {
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    if (!user || !(typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted())) return;

    const levelSelect = document.getElementById('levelSelect');
    const classSelect = document.getElementById('classSelect');

    if (levelSelect) {
        levelSelect.disabled = true;
        levelSelect.style.opacity = '0.6';
        levelSelect.title = 'غير متاح في النسخة التجريبية';
    }

    if (classSelect) {
        classSelect.disabled = true;
        classSelect.style.opacity = '0.6';
        classSelect.title = 'غير متاح في النسخة التجريبية';
    }

    const filterCard = document.querySelector('.filter-card');
    if (filterCard && !filterCard.querySelector('.trial-warning-box')) {
        const warningBox = document.createElement('div');
        warningBox.className = 'trial-warning-box';
        warningBox.style.cssText = 'background:#fff3cd;border:1px solid #ffc107;color:#856404;padding:12px;border-radius:8px;margin-bottom:15px;text-align:center;';
        warningBox.innerHTML = '🔒 <strong>النسخة التجريبية:</strong> يمكنك عرض نتائج قسم واحد فقط. <a href="subscription.html" style="color:#856404;font-weight:bold;">تفعيل الاشتراك</a>';
        filterCard.insertBefore(warningBox, filterCard.firstChild);
    }
}

renderClassAnalysisShell();

document.addEventListener('DOMContentLoaded', function () {
    if (typeof IconManager !== 'undefined') {
        IconManager.render();
    }
    applyTrialModeLimitations();
});

