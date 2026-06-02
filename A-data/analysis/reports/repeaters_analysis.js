let allData = [];

let institutionSettings = {}; // Store settings

let remedialStudentsLastYear = []; // المستدركون المعيّنون

let allStudentsForAssignment = []; // كل التلاميذ لعرضهم في جدول التعيين

let secondaryManualDecisions = {};
const SECONDARY_MANUAL_DECISIONS_KEY = 'secondaryManualDecisions';

let currentTab = 'repeaters';

// Sorting state for repeaters table
let repeatersSortState = { column: null, direction: 'asc' };

// Sorting state for orientation table
let orientationSortState = { column: null, direction: 'asc' };

// Sort repeaters table function
function sortRepeatersTable(column) {
    // Toggle direction if same column, otherwise start with ascending
    if (repeatersSortState.column === column) {
        repeatersSortState.direction = repeatersSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        repeatersSortState.column = column;
        repeatersSortState.direction = 'asc';
    }

    // Update sort icons
    document.querySelectorAll('#repeatersTab .sortable .sort-icon').forEach(icon => icon.textContent = '⇅');
    const activeHeader = document.querySelector(`#repeatersTab .sortable[data-sort="${column}"] .sort-icon`);
    if (activeHeader) {
        activeHeader.textContent = repeatersSortState.direction === 'asc' ? '↑' : '↓';
    }

    // Refresh the table with sorting applied
    refreshRepeatersList();
}

// Sort orientation table function
function sortOrientationTable(column) {
    if (orientationSortState.column === column) {
        orientationSortState.direction = orientationSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        orientationSortState.column = column;
        orientationSortState.direction = 'asc';
    }

    document.querySelectorAll('#orientationTab .sortable .sort-icon').forEach(icon => icon.textContent = '⇅');
    const activeHeader = document.querySelector(`#orientationTab .sortable[data-sort="${column}"] .sort-icon`);
    if (activeHeader) {
        activeHeader.textContent = orientationSortState.direction === 'asc' ? '↑' : '↓';
    }

    applyOrientationFilters();
}

// Function to refresh repeaters list with current filters and sorting
function refreshRepeatersList() {
    applyFilters();
}

function normalizeArabicText(value) {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, '');
}

function getStudentBirthYear(student) {
    const match = (student && student.dob ? String(student.dob) : '').match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0], 10) : null;
}

function getStudentTrimesterAverage(student, trimester) {
    return getStudentAverageByPeriod(student, trimester);
}

function parseAverageValue(value) {
    const numberValue = typeof value === 'string'
        ? parseFloat(value.replace(',', '.'))
        : parseFloat(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

function getStudentAnnualAverage(student) {
    if (!student) return 0;

    const storedAnnual = [
        student.annualAvg,
        student.annual_avg,
        student.averageAnnual,
        student.annualAverage,
        student.averages && student.averages.annual
    ].map(parseAverageValue).find(value => value > 0);

    if (storedAnnual) return storedAnnual;

    const trimesterValues = ['1', '2', '3']
        .map(trimester => student.averages ? parseAverageValue(student.averages[trimester]) : 0)
        .filter(value => value > 0);

    if (trimesterValues.length === 0) return 0;
    return trimesterValues.reduce((sum, value) => sum + value, 0) / trimesterValues.length;
}

function getStudentAverageByPeriod(student, trimester) {
    if (trimester === 'annual') {
        return getStudentAnnualAverage(student);
    }

    return student && student.averages ? parseAverageValue(student.averages[trimester]) : 0;
}

function normalizeRepeatersText(value) {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, '');
}

function normalizeRepeatersYear(value) {
    const text = String(value || '').trim().replace(/-/g, '/');
    const years = text.match(/\d{4}/g);
    if (years && years.length >= 2) {
        return years.slice(0, 2).sort().join('/');
    }
    return text.replace(/\s+/g, '');
}

function getAnnualMergeKeys(student) {
    const year = normalizeRepeatersYear(getStudentYear(student) || student.academic_year || '');
    const id = String(student && (student.id || student.student_id || '') || '').trim();
    const name = normalizeRepeatersText(student && (student.name || student.fullName || `${student.last_name || student.lastName || ''} ${student.first_name || student.firstName || ''}`));
    const dob = normalizeRepeatersText(student && (student.dob || student.birthDate || student.birth_date || ''));
    const level = normalizeRepeatersText(student && student.level);
    const classNumber = normalizeRepeatersText(student && (student.class || student.className || student.class_name || student.squad));

    const keys = [];
    if (id) keys.push(`id|${year}|${id}`);
    if (name || dob) keys.push(`bio|${year}|${name}|${dob}|${level}|${classNumber}`);
    return keys;
}

function mergeAnnualResultsIntoStudents(students, annualRows) {
    if (!Array.isArray(students) || !Array.isArray(annualRows) || annualRows.length === 0) return students;

    const annualMap = new Map();
    annualRows.forEach(row => {
        getAnnualMergeKeys(row).forEach(key => {
            if (!annualMap.has(key)) annualMap.set(key, row);
        });
    });

    return students.map(student => {
        const annual = getAnnualMergeKeys(student)
            .map(key => annualMap.get(key))
            .find(Boolean);

        if (!annual) return student;

        const annualAvg = getStudentAnnualAverage(annual);
        return {
            ...student,
            annualAvg,
            annual_avg: annualAvg,
            annualDecision: annual.decision || student.annualDecision || student.decision,
            annualResult: annual
        };
    });
}

function normalizeSecondaryManualDecisionCode(value) {
    const normalizedValue = normalizeArabicText(value);
    if (!normalizedValue) return '';
    if (normalizedValue === 'directed' || normalizedValue.includes('وجه')) return 'directed';
    if (normalizedValue === 'repeated' || normalizedValue.includes('عيد')) return 'repeated';
    return '';
}

function getSecondaryManualDecisionStorageKey(student) {
    const academicYear = normalizeArabicText(getStudentYear(student) || '');
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
    ].map(function (part) {
        return normalizeArabicText(part);
    });
    return ['secondary', academicYear].concat(fallbackParts).join('|');
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

function getSecondaryManualDecisionLabel(decisionCode) {
    return decisionCode === 'directed' ? 'يوجّه' : 'يعيد';
}

async function saveSecondaryOrientationDecision(storageKey, nextDecisionCode) {
    const normalizedCode = normalizeSecondaryManualDecisionCode(nextDecisionCode);
    if (!storageKey || !normalizedCode) return false;

    try {
        secondaryManualDecisions = Object.assign({}, secondaryManualDecisions, {
            [storageKey]: normalizedCode
        });
        await DB.set(SECONDARY_MANUAL_DECISIONS_KEY, secondaryManualDecisions);
        return true;
    } catch (error) {
        console.error('Failed to save manual secondary decision from repeaters analysis page:', error);
        Swal.fire({ icon: 'error', title: 'تعذر الحفظ', text: 'حدث خطأ أثناء حفظ قرار التوجيه اليدوي.' });
        return false;
    }
}

function syncOrientationModeUI() {
    const isSecondary = institutionSettings.educationStage === 'secondary';
    const birthYearGroup = document.getElementById('birthYearFilterGroup');
    const note = document.getElementById('orientationSecondaryNote');
    const statsTitle = document.getElementById('orientationStatsTitle');
    const listTitle = document.getElementById('orientationListTitle');
    const head5 = document.getElementById('orientationStatsHead5');
    const head6 = document.getElementById('orientationStatsHead6');
    const head7 = document.getElementById('orientationStatsHead7');
    const head8 = document.getElementById('orientationStatsHead8');
    const decisionHeader = document.getElementById('orientationDecisionHeader');

    if (birthYearGroup) birthYearGroup.style.display = isSecondary ? 'none' : 'flex';
    if (note) note.style.display = isSecondary ? 'block' : 'none';
    if (statsTitle) statsTitle.innerHTML = isSecondary
        ? '<i data-lucide="bar-chart-2"></i> إحصائيات قرارات التوجيه'
        : '<i data-lucide="bar-chart-2"></i> إحصائيات النتائج (>= 16 سنة)';
    if (listTitle) listTitle.innerHTML = isSecondary
        ? '<i data-lucide="list"></i> قائمة التلاميذ المعنيين بالتوجيه اليدوي'
        : '<i data-lucide="list"></i> قائمة التلاميذ (>= 16 سنة)';
    if (head5) head5.textContent = isSecondary ? 'موجّهون ذكور' : 'ناجحون ذكور';
    if (head6) head6.textContent = isSecondary ? 'موجّهون إناث' : 'ناجحون إناث';
    if (head7) head7.textContent = isSecondary ? 'مجموع الموجّهين' : 'المجموع';
    if (head8) head8.textContent = isSecondary ? 'يعيد' : 'نسبة النجاح';
    if (decisionHeader) decisionHeader.style.display = isSecondary ? '' : 'none';
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    } else if (window.IconManager) {
        IconManager.render();
    }
}

document.addEventListener('DOMContentLoaded', async () => {

    await loadData();

    await loadRemedialStudents();

    setupListeners();

});

async function loadData() {
    let rawResults = await DB.getResults(true) || [];
    let students = await DB.getStudents(true) || [];
    let annualResults = await DB.getAnnualResults(true) || [];
    institutionSettings = await DB.getSettings() || {};
    secondaryManualDecisions = await DB.get(SECONDARY_MANUAL_DECISIONS_KEY) || {};

    // Deduplicate and Merge Data (Handles multiple trimesters/files)
    const studentMap = new Map();
    for (const student of rawResults) {
        const cleanStr = (s) => (s || '').toString()
            .normalize('NFKC')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .trim()
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/ﻷ|ﻹ|ﻵ|ﻻ/g, 'لا')
            .replace(/لأ|لإ|لآ/g, 'لا')
            .replace(/\s+/g, '');
        const normSection = (s) => (s || '').toString().trim().replace(/^0+/, '') || "1";

        const normName = cleanStr(student.name);
        const normDob = cleanStr(student.dob);
        const normClass = normSection(student.class);
        const normLevel = cleanStr(student.level);
        const normStream = cleanStr(student.stream);
        const normAcademicYear = cleanStr(getStudentYear(student));

        const uniqueKey = `${normAcademicYear}|${normName}|${normDob}|${normClass}|${normLevel}|${normStream}`;

        const getTrimesterValue = (name) => {
            const n = (name || '').toString().trim();
            if (n.includes('ثاني') || n.includes('2')) return '2';
            if (n.includes('ثالث') || n.includes('3')) return '3';
            return '1'; // Default
        };

        const tVal = getTrimesterValue(student.trimester);

        let targetStudent;
        if (studentMap.has(uniqueKey)) {
            targetStudent = studentMap.get(uniqueKey);
        } else {
            targetStudent = {
                ...student,
                marks: {},
                averages: {},
                class: normSection(student.class),
                name: (student.name || '').trim(),
                dob: (student.dob || '').trim(),
                level: (student.level || '').trim(),
                stream: (student.stream || '').trim()
            };
            studentMap.set(uniqueKey, targetStudent);
        }

        // Merge Marks
        if (student.marks) {
            Object.assign(targetStudent.marks, student.marks);
        }

        // Merge Averages
        if (student.averages) {
            Object.entries(student.averages).forEach(([t, avg]) => {
                if (avg !== undefined && avg !== null) {
                    targetStudent.averages[t] = parseFloat(avg) || 0;
                }
            });
        }

        if (student.average !== undefined) {
            targetStudent.averages[tVal] = parseFloat(student.average) || 0;
        }
    }
    const mergedResults = Array.from(studentMap.values());

    let sourceData = mergeAnnualResultsIntoStudents(mergedResults.length > 0 ? mergedResults : students, annualResults);

    if (sourceData) {
        // Filter ONLY repeaters globally
        allData = sourceData.filter(s => {
            if (s.isRepeater === true || s.repeat === true) return true;
            const checkStr = (val) => val && (String(val).includes("معيد") || String(val).includes("يعيد"));
            if (checkStr(s.repeat) || checkStr(s.status) || checkStr(s.notes)) return true;
            return false;
        }).map(s => {
            return {
                ...s,
                name: s.name || `${s.last_name || ''} ${s.first_name || ''}`.trim(),
                isRepeater: true,
                averages: s.averages || { '1': 0, '2': 0, '3': 0 }
            };
        });

        // Store all students for remedial assignment
        allStudentsForAssignment = sourceData.map(s => ({
            ...s,
            name: s.name || `${s.last_name || ''} ${s.first_name || ''}`.trim()
        }));
    }

    populateYears();
    populateLevelDropdown();
    populateStreamDropdown();
    populateClassDropdown();
    
    populateBirthYears();
    populateOrientationFilters();
    
    applyFilters();
}

function populateLevelDropdown() {
    const levelSelect = document.getElementById('levelSelect');
    const remedialLevelFilter = document.getElementById('remedialLevelFilter');
    const remedialLevelSelect = document.getElementById('remedialLevelSelect');
    const orientationLevelSelect = document.getElementById('orientationLevelSelect');
    
    if (!levelSelect && !remedialLevelFilter && !remedialLevelSelect && !orientationLevelSelect) return;

    const stage = institutionSettings.educationStage || 'middle';
    let html = '<option value="all">كل المستويات</option>';

    if (stage === 'secondary') {
        html += `
            <option value="1">السنة الأولى</option>
            <option value="2">السنة الثانية</option>
            <option value="3">السنة الثالثة</option>
        `;
    } else {
        html += `
            <option value="1">الأولى متوسط</option>
            <option value="2">الثانية متوسط</option>
            <option value="3">الثالثة متوسط</option>
            <option value="4">الرابعة متوسط</option>
        `;
    }

    if (levelSelect) levelSelect.innerHTML = html;
    if (remedialLevelFilter) remedialLevelFilter.innerHTML = html;
    if (remedialLevelSelect) remedialLevelSelect.innerHTML = html;
    if (orientationLevelSelect) orientationLevelSelect.innerHTML = html;

    // Also populate filter for remedial assignment tab once to ensure correctness on load
    populateRemedialFilters();
}

function populateStreamDropdown() {

    const streamContainer = document.getElementById('streamFilterContainer');

    const streamSelect = document.getElementById('streamSelect');

    if (!streamContainer || !streamSelect) return;

    // Show only for secondary

    if (institutionSettings.educationStage !== 'secondary') {

        streamContainer.style.display = 'none';

        return;

    }

    streamContainer.style.display = 'block';

    // Show stream column header for secondary
    const repeatersStreamHeader = document.getElementById('repeatersStreamHeader');
    if (repeatersStreamHeader) repeatersStreamHeader.style.display = '';

    const level = document.getElementById('levelSelect').value;
    const yearSel = document.getElementById('yearSelect');
    const yearVal = yearSel ? yearSel.value : 'all';

    // Filter data by level and year if selected
    let filtered = allData;
    if (yearVal !== 'all') {
        filtered = filtered.filter(s => getStudentYear(s) === yearVal);
    }
    if (level !== 'all') {
        filtered = filtered.filter(s => matchLevel(s.level, level));
    }

    // Extract unique streams

    const streams = [...new Set(filtered.map(s => s.stream).filter(s => s))].sort();

    let html = '<option value="all">كل الشعب</option>';

    streams.forEach(stream => {

        html += `<option value="${stream}">${getStreamLabel(stream)}</option>`;

    });

    // Preserve selection if possible

    const currentVal = streamSelect.value;

    streamSelect.innerHTML = html;

    if (streams.includes(currentVal)) {

        streamSelect.value = currentVal;

    }

}

async function loadRemedialStudents() {

    remedialStudentsLastYear = await DB.get('remedialStudentsLastYear') || [];

    updateAssignedCount();

}

async function saveRemedialStudents() {

    await DB.set('remedialStudentsLastYear', remedialStudentsLastYear);

    updateAssignedCount();

}

function updateAssignedCount() {

    const countEl = document.getElementById('assignedCount');

    if (countEl) {

        countEl.textContent = remedialStudentsLastYear.length;

    }

}

function setupListeners() {
    const yearSel = document.getElementById('yearSelect');
    if(yearSel) yearSel.addEventListener('change', () => {
        populateLevelDropdown();
        populateStreamDropdown();
        populateClassDropdown();
        applyFilters();
    });
    const remYearSel = document.getElementById('remedialYearSelect');
    if(remYearSel) remYearSel.addEventListener('change', () => {
        populateRemedialLevelDropdown?.();
        populateRemedialResultsStreamFilter();
        populateRemedialClassDropdown();
        applyRemedialFilters();
    });

    const orientationYearSel = document.getElementById('orientationYearSelect');
    if(orientationYearSel) orientationYearSel.addEventListener('change', () => {
        populateOrientationFilters();
        applyOrientationFilters();
    });

    const birthYearSel = document.getElementById('birthYearSelect');
    if(birthYearSel) birthYearSel.addEventListener('change', () => {
        populateOrientationFilters();
        applyOrientationFilters();
    });

    const orientationLevelSel = document.getElementById('orientationLevelSelect');
    if(orientationLevelSel) orientationLevelSel.addEventListener('change', () => {
        populateOrientationStreamDropdown();
        populateOrientationClassDropdown();
        applyOrientationFilters();
    });

    const orientationStreamSel = document.getElementById('orientationStreamSelect');
    if(orientationStreamSel) orientationStreamSel.addEventListener('change', () => {
        populateOrientationClassDropdown();
        applyOrientationFilters();
    });

    const orientationClassSel = document.getElementById('orientationClassSelect');
    if(orientationClassSel) orientationClassSel.addEventListener('change', () => {
        applyOrientationFilters();
    });

    const orientationTrimesterSel = document.getElementById('orientationTrimesterSelect');
    if(orientationTrimesterSel) orientationTrimesterSel.addEventListener('change', () => {
        applyOrientationFilters();
    });

    // تبويب المعيدين

    document.getElementById('trimesterSelect').addEventListener('change', applyFilters);

    // Level change triggers stream & class update

    document.getElementById('levelSelect').addEventListener('change', () => {

        populateStreamDropdown();

        populateClassDropdown();

        applyFilters();

    });

    // Stream change triggers class update

    const streamSelect = document.getElementById('streamSelect');

    if (streamSelect) {

        streamSelect.addEventListener('change', () => {

            populateClassDropdown();

            applyFilters();

        });

    }

    document.getElementById('classSelect').addEventListener('change', applyFilters);

    // تبويب المستدركين

    document.getElementById('remedialTrimesterSelect').addEventListener('change', applyRemedialFilters);

    document.getElementById('remedialLevelSelect').addEventListener('change', () => {

        populateRemedialResultsStreamFilter();

        populateRemedialClassDropdown();

        applyRemedialFilters();

    });

    // Listener for Results Stream Filter

    const remedialResStream = document.getElementById('remedialResultsStreamSelect');

    if (remedialResStream) {

        remedialResStream.addEventListener('change', () => {

            populateRemedialClassDropdown();

            applyRemedialFilters();

        });

    }

    document.getElementById('remedialClassSelect').addEventListener('change', applyRemedialFilters);

}

// ===================== دوال التبويبات =====================

function switchTab(tabName) {

    currentTab = tabName;

    // تحديث أزرار التبويب
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // إٍهار/إخفاء المحتوى

    document.getElementById('repeatersTab').style.display = tabName === 'repeaters' ? 'block' : 'none';

    document.getElementById('remedialTab').style.display = tabName === 'remedial' ? 'block' : 'none';

    document.getElementById('orientationTab').style.display = tabName === 'orientation' ? 'block' : 'none';

    // تحميل بيانات التبويب

    if (tabName === 'remedial') {

        populateRemedialFilters(); // Assignment Tab Filters

        populateRemedialResultsStreamFilter(); // Results Tab Filters

        loadAssignmentTable();

        populateRemedialClassDropdown(); // This is for results tab, not assignment tab

        applyRemedialFilters();

    } else if (tabName === 'orientation') {
        
        populateOrientationFilters();
        
        applyOrientationFilters();
        
    }

}

function populateRemedialFilters() {

    // Populate Assignment Tab Filters

    const levelSelect = document.getElementById('remedialLevelFilter');

    const streamSelect = document.getElementById('remedialStreamFilter');

    if (!levelSelect) return;

    // Level is already handled in populateLevelDropdown

    const stage = institutionSettings.educationStage || 'middle';

    // Stream

    if (streamSelect) {

        if (stage === 'secondary') {

            streamSelect.style.display = 'block';
            const streamGroup = document.getElementById('remedialStreamFilterGroup');
            if(streamGroup) streamGroup.style.display = 'flex';

            const yValAssign = document.getElementById('remedialAssignmentYearSelect')?.value || 'all';
            const streams = [...new Set(allStudentsForAssignment
                .filter(s => yValAssign === 'all' || getStudentYear(s) === yValAssign)
                .map(s => s.stream).filter(s => s)
            )].sort();

            let htmlStream = '<option value="all">كل الشعب</option>';

            streams.forEach(stream => {

                htmlStream += `<option value="${stream}">${getStreamLabel(stream)}</option>`;

            });

            if (streamSelect.children.length <= 1 || streamSelect.innerHTML.indexOf(streams[0]) === -1) {

                streamSelect.innerHTML = htmlStream;

            }

        } else {

            streamSelect.style.display = 'none';
            const streamGroup = document.getElementById('remedialStreamFilterGroup');
            if(streamGroup) streamGroup.style.display = 'none';

        }

    }

}

function populateRemedialResultsStreamFilter() {

    const streamContainer = document.getElementById('remedialResultsStreamGroup');

    const streamSelect = document.getElementById('remedialResultsStreamSelect');

    if (!streamContainer || !streamSelect) return;

    // Show only for secondary

    if (institutionSettings.educationStage !== 'secondary') {

        streamContainer.style.display = 'none';

        return;

    }

    streamContainer.style.display = 'block';

    const level = document.getElementById('remedialLevelSelect').value;
    const yearVal = document.getElementById('remedialYearSelect')?.value || 'all';

    const remedialData = getRemedialResultsData();

    // Filter data by level and year if selected

    let filtered = remedialData;

    if (yearVal !== 'all') {
        filtered = filtered.filter(s => getStudentYear(s) === yearVal);
    }

    if (level !== 'all') {

        filtered = filtered.filter(s => matchLevel(s.level, level));

    }

    // Extract unique streams

    const streams = [...new Set(filtered.map(s => s.stream).filter(s => s))].sort();

    let html = '<option value="all">كل الشعب</option>';

    streams.forEach(stream => {

        html += `<option value="${stream}">${getStreamLabel(stream)}</option>`;

    });

    // Preserve selection if possible

    const currentVal = streamSelect.value;

    streamSelect.innerHTML = html;

    if (streams.includes(currentVal)) {

        streamSelect.value = currentVal;

    }

}

function blockTrialPrint() {
    if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {
        const message = (typeof Auth.getBlockedMessage === 'function')
            ? Auth.getBlockedMessage('print')
            : 'الطباعة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.';
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: message });
        return true;
    }
    return false;
}

function printCurrentReport() {
    if (blockTrialPrint()) return;

    if (currentTab === 'repeaters') {

        printReport();

    } else if (currentTab === 'remedial') {

        printRemedialReport();

    } else if (currentTab === 'orientation') {

        printOrientationReport();

    }

}

// ===================== دوال المعيدين (الكود الأصلي) =====================

function matchLevel(studentLevel, targetLevelNum) {

    if (!studentLevel) return false;

    const l = studentLevel.toString().trim();

    if (targetLevelNum === '1') return l.includes('1') || l.includes('أولى') || l.includes('اولى');

    if (targetLevelNum === '2') return l.includes('2') || l.includes('ثانية') || l.includes('ثانيه');

    if (targetLevelNum === '3') return l.includes('3') || l.includes('ثالثة') || l.includes('ثالثه');

    if (targetLevelNum === '4') return l.includes('4') || l.includes('رابعة') || l.includes('رابعه');

    return false;

}

function populateClassDropdown() {

    const level = document.getElementById('levelSelect').value;

    const stream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : 'all';

    const classSelect = document.getElementById('classSelect');

    const yearSel = document.getElementById('yearSelect');
    const yearVal = yearSel ? yearSel.value : 'all';

    // Find all unique classes for this level and year (among repeaters)
    let filtered = allData;
    if (yearVal !== 'all') {
        filtered = filtered.filter(s => getStudentYear(s) === yearVal);
    }
    if (level !== 'all') {
        filtered = filtered.filter(s => matchLevel(s.level, level));
    }

    // Filter classes by stream if secondary

    if (institutionSettings.educationStage === 'secondary' && stream && stream !== 'all') {

        filtered = filtered.filter(s => s.stream === stream);

    }

    const uniqueClasses = [...new Set(filtered.map(s => s.class))].sort();

    let html = '<option value="all">كل الأقسام</option>';

    uniqueClasses.forEach(c => {

        if (c) html += `<option value="${c}">${c}</option>`;

    });

    classSelect.innerHTML = html;

}

function applyFilters() {

    const trimester = document.getElementById('trimesterSelect').value;

    const level = document.getElementById('levelSelect').value;

    const stream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : 'all';

    const classVal = document.getElementById('classSelect').value;
    const yearSel = document.getElementById('yearSelect');
    const yearVal = yearSel ? yearSel.value : 'all';

    let filtered = allData;

    if (yearVal !== 'all') {
        filtered = filtered.filter(s => getStudentYear(s) === yearVal);
    }

    // 1. Filter by Level
    if (level !== 'all') {

        filtered = filtered.filter(s => matchLevel(s.level, level));

    }

    // 2. Filter by Stream (Secondary)

    if (institutionSettings.educationStage === 'secondary' && stream && stream !== 'all') {

        filtered = filtered.filter(s => s.stream === stream);

    }

    // 3. Filter by Class

    if (classVal !== 'all') {

        filtered = filtered.filter(s => s.class === classVal);

    }

    renderStats(filtered, trimester);

    renderList(filtered, trimester);

}



function renderStats(data, trimester) {

    const tbody = document.getElementById('repeatStatsBody');

    const stage = institutionSettings.educationStage || 'middle';

    let levels = [];

    let levelNames = [];

    if (stage === 'secondary') {

        levels = ['1', '2', '3'];

        levelNames = ['السنة الأولى ثانوي', 'السنة الثانية ثانوي', 'السنة الثالثة ثانوي'];

    } else {

        levels = ['1', '2', '3', '4'];

        levelNames = ['الأولى متوسط', 'الثانية متوسط', 'الثالثة متوسط', 'الرابعة متوسط'];

    }

    let html = '';

    levels.forEach((lvl, idx) => {

        // Robust level matching using high-level helper

        const lvlData = data.filter(s => matchLevel(s.level, lvl));

        const currentSelectedLevel = document.getElementById('levelSelect').value;

        if (lvlData.length > 0 || currentSelectedLevel === 'all' || currentSelectedLevel === lvl) {

            const count = lvlData.length;

            const boys = lvlData.filter(s => s.gender === 'ذكر').length;

            const girls = count - boys;

            // Average calculation based on trimester

            const getAvg = (s) => getStudentAverageByPeriod(s, trimester);

            const passedData = lvlData.filter(s => getAvg(s) >= 10);

            const passed = passedData.length;

            const passedBoys = passedData.filter(s => s.gender === 'ذكر').length;

            const passedGirls = passed - passedBoys;

            const rate = count > 0 ? ((passed / count) * 100).toFixed(2) : '0';

            html += `

                <tr>

                    <td style="font-weight:bold;">${levelNames[idx]}</td>

                    <td style="background:var(--bg-color);">${count}</td>

                    <td>${boys}</td>

                    <td>${girls}</td>

                    <td style="color:#2980b9;">${passedBoys}</td>

                    <td style="color:#e67e22;">${passedGirls}</td>

                    <td style="background:#e8f8f5; font-weight:bold; color:green;">${passed}</td>

                    <td style="font-weight:bold; background:#fef9e7;">${rate}%</td>

                </tr>

            `;

        }

    });

    if (html === '') {

        html = '<tr><td colspan="8" style="text-align:center;">لا يوجد معيدون في هذا النطاق</td></tr>';

    }

    tbody.innerHTML = html;

}

// Helper to translate stream codes

function getStreamLabel(streamCode) {

    if (!streamCode) return '-';

    // Clean up code first

    const code = streamCode.toLowerCase().trim();

    const map = {

        'science': 'علوم تجريبية',

        'math': 'رياضيات',

        'math_tech': 'تقني رياضي',

        'tech_math': 'تقني رياضي',

        'languages': 'لغات أجنبية',

        'literature': 'آداب وفلسفة',

        'arts': 'آداب وفلسفة',

        'management': 'تسيير واقتصاد',

        'sport': 'رياضة',

        'common_science': 'جذع مشترك علوم وتكنولوجيا',

        'common_arts': 'جذع مشترك آداب'

    };

    return map[code] || streamCode; // Fallback to original if not found

}

function renderList(data, trimester) {

    const tbody = document.getElementById('repeatListBody');

    // Ensure we don't crash if bad ID

    if (!tbody) return;

    const getAvg = (s) => getStudentAverageByPeriod(s, trimester);

    // Sort by selected column or default to Grade DESC

    let sorted = [...data];

    if (repeatersSortState.column) {
        sorted.sort((a, b) => {
            let valA, valB;

            switch (repeatersSortState.column) {
                case 'level':
                    valA = a.level || '';
                    valB = b.level || '';
                    break;
                case 'class':
                    valA = a.class || '';
                    valB = b.class || '';
                    break;
                case 'stream':
                    valA = getStreamLabel(a.stream || '');
                    valB = getStreamLabel(b.stream || '');
                    break;
                case 'avg':
                    valA = getAvg(a);
                    valB = getAvg(b);
                    break;
                default:
                    valA = getAvg(a);
                    valB = getAvg(b);
            }

            // For numeric comparison
            if (typeof valA === 'number' && typeof valB === 'number') {
                return repeatersSortState.direction === 'asc' ? valA - valB : valB - valA;
            }

            // For string comparison
            const comparison = String(valA).localeCompare(String(valB), 'ar');
            return repeatersSortState.direction === 'asc' ? comparison : -comparison;
        });
    } else {
        sorted.sort((a, b) => getAvg(b) - getAvg(a));
    }

    let html = '';

    // HACK: I cannot easily change the static HTML header from here without selector.

    // BUT looking at `repeaters_analysis.js` lines 247+, it targets `repeatListBody`.

    // I will assume for now I can interpret the request as "Add Stream info to the Name or Class column" OR

    // I will try to rebuild the header via JS if I can find the table.

    // Safest bet for "Secondary" specific changes is often just adding the info.

    // Check education stage

    const isSecondary = (institutionSettings.educationStage === 'secondary');

    // Update Header Visibility

    // We target the 4th column (index 3) which is Stream

    const headerRow = document.querySelector('#repeatListCard .data-table thead tr');

    if (headerRow) {

        if (headerRow.children.length === 6) {

            headerRow.children[3].style.display = isSecondary ? '' : 'none';

        }

    }

    sorted.forEach((s, idx) => {

        const avg = getAvg(s);

        // Conditionally render stream cell

        const streamCell = isSecondary ? `<td>${getStreamLabel(s.stream)}</td>` : '';

        html += `

            <tr>

                <td>${idx + 1}</td>

                <td style="text-align:right; font-weight:bold;">${s.name}</td>

                <td>${s.level}</td>

                ${streamCell}

                <td>${s.class}</td>

                <td style="font-weight:bold; background-color: var(--bg-color);">${avg.toFixed(2)}</td>

            </tr>

        `;

    });

    if (html === '') {

        const colSpan = isSecondary ? 6 : 5;

        html = `<tr><td colspan="${colSpan}" style="text-align:center;">لا توجد بيانات متاحة</td></tr>`;

    }

    tbody.innerHTML = html;

}

// ===================== دوال المستدركين =====================

function loadAssignmentTable() {

    filterStudentsForRemedial();

}

function filterStudentsForRemedial() {
    const yValAssign = document.getElementById('remedialAssignmentYearSelect')?.value || 'all';
    const levelFilter = document.getElementById('remedialLevelFilter')?.value || 'all';
    const streamFilter = document.getElementById('remedialStreamFilter')?.value || 'all';
    const classFilter = document.getElementById('remedialClassFilter')?.value || 'all';
    const searchInput = document.getElementById('remedialSearchInput')?.value || '';

    let filtered = [...allStudentsForAssignment];

    // Filter by year
    if (yValAssign !== 'all') {
        filtered = filtered.filter(s => getStudentYear(s) === yValAssign);
    }

    // Filter by level
    if (levelFilter !== 'all') {
        filtered = filtered.filter(s => matchLevel(s.level, levelFilter));
    }

    // Filter by stream (secondary only)
    if (institutionSettings.educationStage === 'secondary' && streamFilter && streamFilter !== 'all') {
        filtered = filtered.filter(s => s.stream === streamFilter);
    }

    // Filter by class
    if (classFilter !== 'all') {
        filtered = filtered.filter(s => s.class === classFilter);
    }

    // Filter by search query
    if (searchInput.trim()) {
        const q = searchInput.trim().toLowerCase();
        filtered = filtered.filter(s => s.name && s.name.toLowerCase().includes(q));
    }

    renderAssignmentTable(filtered);
    populateAssignmentClassFilter();

    const totalEl = document.getElementById('totalStudentsCount');
    if (totalEl) {
        totalEl.textContent = filtered.length;
    }
}

function populateAssignmentClassFilter() {
    const yValAssign = document.getElementById('remedialAssignmentYearSelect')?.value || 'all';
    const levelFilter = document.getElementById('remedialLevelFilter').value;
    const streamFilter = document.getElementById('remedialStreamFilter') ? document.getElementById('remedialStreamFilter').value : 'all';
    const classSelect = document.getElementById('remedialClassFilter');

    let filtered = allStudentsForAssignment.filter(s => yValAssign === 'all' || getStudentYear(s) === yValAssign);

    if (levelFilter !== 'all') {
        filtered = filtered.filter(s => matchLevel(s.level, levelFilter));
    }

    if (institutionSettings.educationStage === 'secondary' && streamFilter && streamFilter !== 'all') {
        filtered = filtered.filter(s => s.stream === streamFilter);
    }

    const uniqueClasses = [...new Set(filtered.map(s => s.class))].filter(c => c).sort();

    let html = '<option value="all">كل الأقسام</option>';
    uniqueClasses.forEach(c => {
        html += `<option value="${c}">${c}</option>`;
    });
    if (classSelect) classSelect.innerHTML = html;
}

function searchStudentsForRemedial(query) {
    const yValAssign = document.getElementById('remedialAssignmentYearSelect')?.value || 'all';
    const levelFilter = document.getElementById('remedialLevelFilter').value;
    const streamFilter = document.getElementById('remedialStreamFilter') ? document.getElementById('remedialStreamFilter').value : 'all';
    const classFilter = document.getElementById('remedialClassFilter').value;

    let filtered = allStudentsForAssignment.filter(s => yValAssign === 'all' || getStudentYear(s) === yValAssign);

    if (query && typeof query === 'string' && query.trim()) {
        const q = query.trim().toLowerCase();
        filtered = filtered.filter(s => s.name && s.name.toLowerCase().includes(q));
    }

    if (levelFilter !== 'all') {
        filtered = filtered.filter(s => matchLevel(s.level, levelFilter));
    }

    if (institutionSettings.educationStage === 'secondary' && streamFilter && streamFilter !== 'all') {
        filtered = filtered.filter(s => s.stream === streamFilter);
    }

    if (classFilter !== 'all') {
        filtered = filtered.filter(s => s.class === classFilter);
    }

    renderAssignmentTable(filtered);
}

function renderAssignmentTable(students) {

    const tbody = document.getElementById('assignmentTableBody');

    const isSecondary = (institutionSettings.educationStage === 'secondary');

    const colspan = isSecondary ? 6 : 5;

    if (!students || students.length === 0) {

        tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center; padding: 20px;">لا توجد بيانات متاحة</td></tr>`;

        return;

    }

    // ترتيب حسب الاسم

    const sorted = [...students].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

    // Check education stage (already defined above)

    const headerEl = document.getElementById('remedialStreamHeader');

    if (headerEl) {

        headerEl.style.display = isSecondary ? '' : 'none';

    }

    let html = '';

    sorted.forEach((s, idx) => {

        const isAssigned = isStudentRemedial(s);

        const btnStyle = isAssigned

            ? 'background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; font-size: 0.85rem;'

            : 'background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; font-size: 0.85rem;';

        const btnText = isAssigned ? '❌ إلغاء' : '➕ تعيين';

        // Escape single quotes in dynamic values to prevent broken onclick handlers
        const esc = (v) => (v || '').replace(/'/g, "\\'");

        const btnAction = isAssigned

            ? `removeRemedial('${esc(s.name)}', '${esc(s.level)}', '${esc(s.class)}')`

            : `assignAsRemedial('${esc(s.name)}', '${esc(s.level)}', '${esc(s.class)}', '${esc(s.gender)}', '${esc(s.stream)}')`;

        const rowStyle = isAssigned ? 'background-color: #e8f5e9;' : '';

        const streamCell = isSecondary ? `<td>${getStreamLabel(s.stream)}</td>` : '';

        html += `

            <tr style="${rowStyle}">

                <td>${idx + 1}</td>

                <td style="text-align:right; font-weight:bold;">${s.name}</td>

                <td>${s.level || '-'}</td>

                ${streamCell}

                <td>${s.class || '-'}</td>

                <td>

                    <button style="${btnStyle}" onclick="${btnAction}">${btnText}</button>

                </td>

            </tr>

        `;

    });

    tbody.innerHTML = html;

}

function getStudentKey(s) {
    return `${(s.name || '').trim()}|${(s.level || '').trim()}|${(s.class || '').trim()}`;
}

function isStudentRemedial(student) {
    const key = getStudentKey(student);
    return remedialStudentsLastYear.some(r => getStudentKey(r) === key);
}

async function assignAsRemedial(name, level, classVal, gender, stream) {

    if (!isStudentRemedial({ name, level, class: classVal })) {

        remedialStudentsLastYear.push({

            name: name,

            level: level,

            class: classVal,

            gender: gender,

            stream: stream,

            assignedDate: new Date().toISOString().split('T')[0]

        });

        await saveRemedialStudents();

        filterStudentsForRemedial(); // تحديث الجدول

        applyRemedialFilters(); // تحديث قسم النتائج

    }

}

async function removeRemedial(name, level, classVal) {

    const keyToRemove = getStudentKey({ name, level, class: classVal });
    remedialStudentsLastYear = remedialStudentsLastYear.filter(r => getStudentKey(r) !== keyToRemove);

    await saveRemedialStudents();

    filterStudentsForRemedial(); // تحديث الجدول

    applyRemedialFilters(); // تحديث قسم النتائج

}

// ===================== دوال عرض نتائج المستدركين =====================

function populateRemedialClassDropdown() {

    const level = document.getElementById('remedialLevelSelect').value;

    const classSelect = document.getElementById('remedialClassSelect');

    // جمع بيانات المستدركين من schoolResults

    const remedialData = getRemedialResultsData();

    const streamVal = document.getElementById('remedialResultsStreamSelect') ? document.getElementById('remedialResultsStreamSelect').value : 'all';
    const yearVal = document.getElementById('remedialYearSelect')?.value || 'all';

    let filtered = remedialData;

    if (yearVal !== 'all') {
        filtered = filtered.filter(s => getStudentYear(s) === yearVal);
    }

    if (level !== 'all') {

        filtered = filtered.filter(s => matchLevel(s.level, level));

    }

    // Filter by stream (Results)

    if (institutionSettings.educationStage === 'secondary' && streamVal && streamVal !== 'all') {

        filtered = filtered.filter(s => s.stream === streamVal);

    }

    const uniqueClasses = [...new Set(filtered.map(s => s.class))].filter(c => c).sort();

    let html = '<option value="all">كل الأقسام</option>';

    uniqueClasses.forEach(c => {

        html += `<option value="${c}">${c}</option>`;

    });

    classSelect.innerHTML = html;

}

function getRemedialResultsData() {

    // الحصول على نتائج المستدركين من بيانات النتائج الحالية (allStudentsForAssignment is schoolResults)

    const allResults = allStudentsForAssignment;

    const remedialKeys = remedialStudentsLastYear.map(r => getStudentKey(r));

    return allResults.filter(s => remedialKeys.includes(getStudentKey(s)));

}

function applyRemedialFilters() {

    const remedialData = getRemedialResultsData();

    // عرض/إخفاء رسالة عدم وجود مستدركين

    const noMessage = document.getElementById('noRemedialMessage');

    const statsCard = document.getElementById('remedialStatsCard');

    const listCard = document.getElementById('remedialListCard');

    if (remedialStudentsLastYear.length === 0) {

        noMessage.style.display = 'block';

        statsCard.style.display = 'none';

        listCard.style.display = 'none';

        return;

    } else {

        noMessage.style.display = 'none';

        statsCard.style.display = 'block';

        listCard.style.display = 'block';

    }

    const trimester = document.getElementById('remedialTrimesterSelect').value;

    const level = document.getElementById('remedialLevelSelect').value;

    const classVal = document.getElementById('remedialClassSelect').value;
    const yearVal = document.getElementById('remedialYearSelect')?.value || 'all';

    let filtered = remedialData;

    // تصفية حسب السنة
    if (yearVal !== 'all') {
        filtered = filtered.filter(s => getStudentYear(s) === yearVal);
    }

    // تصفية حسب المستوى

    if (level !== 'all') {

        filtered = filtered.filter(s => matchLevel(s.level, level));

    }

    // تصفية حسب الشعبة (Results)

    const streamVal = document.getElementById('remedialResultsStreamSelect') ? document.getElementById('remedialResultsStreamSelect').value : 'all';

    if (institutionSettings.educationStage === 'secondary' && streamVal && streamVal !== 'all') {

        filtered = filtered.filter(s => s.stream === streamVal);

    }

    // تصفية حسب القسم

    if (classVal !== 'all') {

        filtered = filtered.filter(s => s.class === classVal);

    }

    renderRemedialStats(filtered, trimester);

    renderRemedialList(filtered, trimester);

}

function renderRemedialStats(data, trimester) {

    const tbody = document.getElementById('remedialStatsBody');

    const stage = institutionSettings.educationStage || 'middle';

    let levels = [];

    let levelNames = [];

    if (stage === 'secondary') {

        levels = ['1', '2', '3'];

        levelNames = ['السنة الأولى ثانوي', 'السنة الثانية ثانوي', 'السنة الثالثة ثانوي'];

    } else {

        levels = ['1', '2', '3', '4'];

        levelNames = ['الأولى متوسط', 'الثانية متوسط', 'الثالثة متوسط', 'الرابعة متوسط'];

    }

    let html = '';

    levels.forEach((lvl, idx) => {

        const lvlData = data.filter(s => matchLevel(s.level, lvl));

        const currentSelectedLevel = document.getElementById('remedialLevelSelect').value;

        if (lvlData.length > 0 || currentSelectedLevel === 'all' || currentSelectedLevel === lvl) {

            const count = lvlData.length;

            const boys = lvlData.filter(s => s.gender === 'ذكر').length;

            const girls = count - boys;

            const getAvg = (s) => {

                if (trimester === '1') return s.averages['1'] || 0;

                if (trimester === '2') return s.averages['2'] || 0;

                if (trimester === '3') return s.averages['3'] || 0;

                return 0;

            };

            const passedData = lvlData.filter(s => getAvg(s) >= 10);

            const passed = passedData.length;

            const passedBoys = passedData.filter(s => s.gender === 'ذكر').length;

            const passedGirls = passed - passedBoys;

            const rate = count > 0 ? ((passed / count) * 100).toFixed(2) : '0';

            html += `

                <tr>

                    <td style="font-weight:bold;">${levelNames[idx]}</td>

                    <td style="background:var(--bg-color);">${count}</td>

                    <td>${boys}</td>

                    <td>${girls}</td>

                    <td style="color:#2980b9;">${passedBoys}</td>

                    <td style="color:#e67e22;">${passedGirls}</td>

                    <td style="background:#e8f8f5; font-weight:bold; color:green;">${passed}</td>

                    <td style="font-weight:bold; background:#fef9e7;">${rate}%</td>

                </tr>

            `;

        }

    });

    if (html === '') {

        html = '<tr><td colspan="8" style="text-align:center;">لا يوجد مستدركون في هذا النطاق</td></tr>';

    }

    tbody.innerHTML = html;

}

function renderRemedialList(data, trimester) {

    const tbody = document.getElementById('remedialListBody');

    const getAvg = (s) => {

        if (trimester === '1') return s.averages['1'] || 0;

        if (trimester === '2') return s.averages['2'] || 0;

        if (trimester === '3') return s.averages['3'] || 0;

        return 0;

    };

    // ترتيب حسب المعدل تنازلياً

    const sorted = [...data].sort((a, b) => getAvg(b) - getAvg(a));

    // Check education stage

    const isSecondary = (institutionSettings.educationStage === 'secondary');

    // Update Header Visibility for Remedial

    const headerRow = document.querySelector('#remedialListCard .data-table thead tr');

    // Specifically toggle our new header if it exists

    const streamHeader = document.getElementById('remedialResultsStreamHeader');

    if (streamHeader) {

        streamHeader.style.display = isSecondary ? '' : 'none';

    } else if (headerRow && headerRow.children.length >= 4) {

        // Fallback or generic handling if ID not found?

        // Better to rely on ID.

        // headerRow.children[3].style.display = isSecondary ? '' : 'none';

    }

    let html = '';

    sorted.forEach((s, idx) => {

        const avg = getAvg(s);

        const streamCell = isSecondary ? `<td>${getStreamLabel(s.stream)}</td>` : '';

        html += `

            <tr>

                <td>${idx + 1}</td>

                <td style="text-align:right; font-weight:bold;">${s.name}</td>

                <td>${s.level}</td>

                ${streamCell}

                <td>${s.class}</td>

                <td style="font-weight:bold; background-color: var(--bg-color);">${avg.toFixed(2)}</td>

            </tr>

        `;

    });

    if (html === '') {

        html = '<tr><td colspan="5" style="text-align:center;">لا توجد بيانات متاحة</td></tr>';

    }

    tbody.innerHTML = html;

}

// ===================== دوال الطباعة =====================

async function printReport() {
    if (blockTrialPrint()) return;

    const trimester = document.getElementById('trimesterSelect').options[document.getElementById('trimesterSelect').selectedIndex].text;

    const level = document.getElementById('levelSelect').options[document.getElementById('levelSelect').selectedIndex].text;

    const classVal = document.getElementById('classSelect').options[document.getElementById('classSelect').selectedIndex].text;

    // Filter Data Logic duplicated here to ensure we print what's filtered

    // Or simpler: pass the filtered data to printReport?

    // The original code used `document.getElementById('repeatListBody').closest('table').outerHTML`

    // which dumps the valid current view. But since we want to add a column for print that might not be in the view (or if we updated view with "badge"),

    // it is cleaner to regenerate the table for print to have a proper column.

    // Let's re-filter data to be sure

    const selectedTrimesterVal = document.getElementById('trimesterSelect').value;

    const selectedLevelVal = document.getElementById('levelSelect').value;

    const selectedClassVal = document.getElementById('classSelect').value;
    const selectedYearVal = document.getElementById('yearSelect')?.value || 'all';

    let data = allData;

    if (selectedYearVal !== 'all') data = data.filter(s => getStudentYear(s) === selectedYearVal);

    if (selectedLevelVal !== 'all') data = data.filter(s => matchLevel(s.level, selectedLevelVal));

    if (selectedClassVal !== 'all') data = data.filter(s => s.class === selectedClassVal);

    // Sort

    const getAvg = (s) => getStudentAverageByPeriod(s, selectedTrimesterVal);

    data = [...data].sort((a, b) => getAvg(b) - getAvg(a));

    // Get institutional settings - using the same key as institution_analysis.js

    const settings = await DB.getSettings() || {};

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>تقرير المعيدين - ${level}</title>

            <style>

                @page { margin: 0.8cm; size: A4; }

                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 0; font-size: 10pt; }

                .report-header { display: flex; flex-direction: column; align-items: center; margin-bottom: 10px; }

                .report-header h3 { margin: 1px 0; font-size: 10pt; font-weight: bold; }

                .info-row { width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; font-size: 9.5pt; }

                .title-box { text-align: center; margin-top: 10px; width: 100%; }

                .title-box h2 { margin: 5px 0; border: 2pt solid #000; padding: 5px 20px; display: inline-block; border-radius: 6px; font-size: 13pt; background: #fdfdfd; }

                .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9.5pt; }

                .data-table th, .data-table td { border: 1pt solid #000 !important; padding: 6px; text-align: center; }

                .data-table th { background-color: #f2f2f2 !important; color: black !important; font-weight: bold; }

                .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 10pt; }

                .signature-box { text-align: center; min-width: 200px; }

                h3.card-title { margin-bottom: 5px; border-right: 5px solid #333; padding-right: 10px; font-size: 11pt; margin-top: 20px; }

                @media print {

                    .no-print { display: none; }

                }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            <div class="report-header">

                <h3>الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                <h3>وزارة التربية الوطنية</h3>

            </div>

            <div class="info-row">

                <div style="text-align: right;">

                    <div>مديرية التربية لولاية: ${settings.wilaya || '.......'}</div>

                    <div>المؤسسة: ${settings.institutionName || '.......'}</div>

                </div>

                <div style="text-align: left;">

                    <div>البلدية: ${settings.municipality || '.......'}</div>

                    <div>السنة الدراسية: ${document.getElementById('yearSelect')?.value || settings.schoolYear || '.......'}</div>

                </div>

            </div>

            <div class="title-box">

                <h2>نتائج التلاميذ المعيدين - الفصل ${trimester}</h2>

                <div style="margin-top: 5px; font-weight: bold;">المستوى: ${level} | القسم: ${classVal}</div>

            </div>

            <div class="stats-section">

                <!-- Simplified extraction to avoid duplicating card style -->

                <h3 class="card-title">📊 إحصائيات المعيدين</h3>

                ${document.getElementById('repeatStatsBody').closest('table').outerHTML}

            </div>

            <div class="list-section">

                <h3 class="card-title">📋 قائمة التلاميذ المعيدين</h3>

                <table class="data-table">

                    <thead>

                        <tr>

                            <th width="5%">#</th>

                            <th width="${institutionSettings.educationStage === 'secondary' ? '35%' : '45%'}">الاسم واللقب</th>

                            <th width="15%">المستوى</th>

                            <th width="15%">القسم</th>

                            ${institutionSettings.educationStage === 'secondary' ? '<th width="20%">الشعبة</th>' : ''}

                            <th width="10%">المعدل</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${data.map((s, idx) => {

        const getAvg = (st) => {

            if (selectedTrimesterVal === '1') return st.averages['1'] || 0;

            if (selectedTrimesterVal === '2') return st.averages['2'] || 0;

            if (selectedTrimesterVal === '3') return st.averages['3'] || 0;

            return 0;

        };

        return `

                                <tr>

                                    <td>${idx + 1}</td>

                                    <td style="text-align:right; font-weight:bold;">${s.name}</td>

                                    <td>${(s.level == '1') ? 'أولى' :
                (s.level == '2') ? 'ثانية' :
                    (s.level == '3') ? 'ثالثة' :
                        (s.level == '4') ? 'رابعة' : s.level
            }</td>

                                    <td>${s.class}</td>

                                    ${institutionSettings.educationStage === 'secondary' ? `<td>${getStreamLabel(s.stream)}</td>` : ''}

                                    <td style="font-weight:bold;">${getAvg(s).toFixed(2)}</td>

                                </tr>

                            `;

    }).join('')}

                    </tbody>

                </table>

            </div>

            <div class="footer" style="display: flex; justify-content: flex-end;">
                <div class="signature-box">
                    <div style="margin-bottom: 5px;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                    <div>المدير</div>
                </div>
            </div>

            <script>

                window.onload = function() {

                    // window.print(); /* Replaced by global Toolbar */
                    // setTimeout(() => window.close(), 500);

                };

            </script>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

}

async function printRemedialReport() {
    if (blockTrialPrint()) return;

    const trimester = document.getElementById('remedialTrimesterSelect').options[document.getElementById('remedialTrimesterSelect').selectedIndex].text;

    const level = document.getElementById('remedialLevelSelect').options[document.getElementById('remedialLevelSelect').selectedIndex].text;

    const classVal = document.getElementById('remedialClassSelect').options[document.getElementById('remedialClassSelect').selectedIndex].text;

    // Filter Data Logic

    const selectedTrimesterVal = document.getElementById('remedialTrimesterSelect').value;

    const selectedLevelVal = document.getElementById('remedialLevelSelect').value;

    const selectedClassVal = document.getElementById('remedialClassSelect').value;

    const selectedStreamVal = document.getElementById('remedialResultsStreamSelect') ? document.getElementById('remedialResultsStreamSelect').value : 'all';
    const selectedYearVal = document.getElementById('remedialYearSelect')?.value || 'all';

    let data = getRemedialResultsData();

    if (selectedYearVal !== 'all') data = data.filter(s => getStudentYear(s) === selectedYearVal);

    if (selectedLevelVal !== 'all') data = data.filter(s => matchLevel(s.level, selectedLevelVal));

    if (institutionSettings.educationStage === 'secondary' && selectedStreamVal && selectedStreamVal !== 'all') {

        data = data.filter(s => s.stream === selectedStreamVal);

    }

    if (selectedClassVal !== 'all') data = data.filter(s => s.class === selectedClassVal);

    // Sort

    const getAvg = (s) => {

        if (selectedTrimesterVal === '1') return s.averages['1'] || 0;

        if (selectedTrimesterVal === '2') return s.averages['2'] || 0;

        if (selectedTrimesterVal === '3') return s.averages['3'] || 0;

        return 0;

    };

    data = [...data].sort((a, b) => getAvg(b) - getAvg(a));

    // Get Stream Info for Header

    let streamInfo = '';

    const streamEl = document.getElementById('remedialResultsStreamSelect');

    if (institutionSettings.educationStage === 'secondary' && streamEl && streamEl.value !== 'all') {

        streamInfo = ' | الشعبة: ' + streamEl.options[streamEl.selectedIndex].text;

    }

    const settings = await DB.getSettings() || {};

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>تقرير المستدركين - ${level}</title>

            <style>

                @page { margin: 0.8cm; size: A4; }

                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 0; font-size: 10pt; }

                .report-header { display: flex; flex-direction: column; align-items: center; margin-bottom: 10px; }

                .report-header h3 { margin: 1px 0; font-size: 10pt; font-weight: bold; }

                .info-row { width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; font-size: 9.5pt; }

                .title-box { text-align: center; margin-top: 10px; width: 100%; }

                .title-box h2 { margin: 5px 0; border: 2pt solid #000; padding: 5px 20px; display: inline-block; border-radius: 6px; font-size: 13pt; background: #fdfdfd; }

                .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9.5pt; }

                .data-table th, .data-table td { border: 1pt solid #000 !important; padding: 6px; text-align: center; }

                .data-table th { background-color: #f2f2f2 !important; color: black !important; font-weight: bold; }

                .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 10pt; }

                .signature-box { text-align: center; min-width: 200px; }

                h3.card-title { margin-bottom: 5px; border-right: 5px solid #333; padding-right: 10px; font-size: 11pt; margin-top: 20px; }

                @media print {

                    .no-print { display: none; }

                }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            <div class="report-header">

                <h3>الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                <h3>وزارة التربية الوطنية</h3>

            </div>

            <div class="info-row">

                <div style="text-align: right;">

                    <div>مديرية التربية لولاية: ${settings.wilaya || '.......'}</div>

                    <div>المؤسسة: ${settings.institutionName || '.......'}</div>

                </div>

                <div style="text-align: left;">

                    <div>البلدية: ${settings.municipality || '.......'}</div>

                    <div>السنة الدراسية: ${settings.schoolYear || '2025/2026'}</div>

                </div>

            </div>

            <div class="title-box">

                <h2>نتائج التلاميذ المستدركين (السنة الماضية) - الفصل ${trimester}</h2>

                <div style="margin-top: 5px; font-weight: bold;">المستوى: ${level}${streamInfo} | القسم: ${classVal}</div>

                <div style="margin-top: 5px; color: #666;">عدد المستدركين: ${remedialStudentsLastYear.length} تلميذ</div>

            </div>

            <div class="stats-section">

                <h3 class="card-title">📊 إحصائيات المستدركين</h3>

                ${document.getElementById('remedialStatsBody').closest('table').outerHTML}

            </div>

            <div class="list-section">

                <h3 class="card-title">📋 قائمة التلاميذ المستدركين</h3>

                <table class="data-table">

                    <thead>

                        <tr>

                            <th width="5%">#</th>

                            <th width="${institutionSettings.educationStage === 'secondary' ? '35%' : '45%'}">الاسم واللقب</th>

                            <th width="15%">المستوى</th>

                            ${institutionSettings.educationStage === 'secondary' ? '<th width="20%">الشعبة</th>' : ''}

                            <th width="15%">القسم</th>

                            <th width="10%">المعدل</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${data.map((s, idx) => {

        const getAvg = (st) => {

            if (trimester === '1') return st.averages['1'] || 0;

            if (trimester === '2') return st.averages['2'] || 0;

            if (trimester === '3') return st.averages['3'] || 0;

            return 0;

        };

        return `

                                <tr>

                                    <td>${idx + 1}</td>

                                    <td style="text-align:right; font-weight:bold;">${s.name}</td>

                                    <td>${s.level}</td>

                                    ${institutionSettings.educationStage === 'secondary' ? `<td>${getStreamLabel(s.stream)}</td>` : ''}

                                    <td>${s.class}</td>

                                    <td style="font-weight:bold;">${getAvg(s).toFixed(2)}</td>

                                </tr>

                            `;

    }).join('')}

                    </tbody>

                </table>

            </div>

            <div class="footer">

                <div>حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>

                <div class="signature-box">

                    المدير<br><br>

                    <strong>${settings.managerName || '................'}</strong>

                </div>

            </div>

            <script>

                window.onload = function() {

                    // window.print(); /* Replaced by global Toolbar */
                    // setTimeout(() => window.close(), 500);

                };

            </script>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

}

// --- Year Filter Logic ---
function getStudentYear(s) {
    if (!s) return '';
    const y = s.academic_year || s.schoolYear || s.year || s.school_year || '';
    if (y) return y;
    for (const key in s) {
        if (typeof s[key] === 'string' && /\b20\d{2}\b/.test(s[key])) {
            const match = s[key].match(/\b20\d{2}([-/]20\d{2})?\b/);
            if (match) return match[0];
        }
    }
    return '';
}

function populateYears() {
    const yearSelect = document.getElementById('yearSelect');
    const remedialYearSelect = document.getElementById('remedialYearSelect');

    const years = new Set();
    const allItems = [...(typeof allData !== 'undefined' ? allData : []), ...(typeof allStudentsForAssignment !== 'undefined' ? allStudentsForAssignment : [])];
    allItems.forEach(s => {
        const y = getStudentYear(s);
        if (y) years.add(y);
    });

    const sortedYears = [...years].sort((a,b) => b.localeCompare(a));

    if (yearSelect && yearSelect.options.length === 0) {
        let htmlOption = '';
        sortedYears.forEach(y => htmlOption += '<option value="' + y + '">' + y + '</option>');
        yearSelect.innerHTML = htmlOption;
        if (sortedYears.length > 0) yearSelect.value = sortedYears[0];
    }

    if (remedialYearSelect && remedialYearSelect.options.length === 0) {
        let htmlOption = '';
        sortedYears.forEach(y => htmlOption += '<option value="' + y + '">' + y + '</option>');
        remedialYearSelect.innerHTML = htmlOption;
        if (sortedYears.length > 0) remedialYearSelect.value = sortedYears[0];
    }

    const remedialAssignmentYearSelect = document.getElementById('remedialAssignmentYearSelect');
    if (remedialAssignmentYearSelect && remedialAssignmentYearSelect.options.length === 0) {
        let htmlOption = '';
        sortedYears.forEach(y => htmlOption += '<option value="' + y + '">' + y + '</option>');
        remedialAssignmentYearSelect.innerHTML = htmlOption;
        if (sortedYears.length > 0) remedialAssignmentYearSelect.value = sortedYears[0];
    }

    const orientationYearSelect = document.getElementById('orientationYearSelect');
    if (orientationYearSelect && orientationYearSelect.options.length === 0) {
        let htmlOption = '';
        sortedYears.forEach(y => htmlOption += '<option value="' + y + '">' + y + '</option>');
        orientationYearSelect.innerHTML = htmlOption;
        if (sortedYears.length > 0) orientationYearSelect.value = sortedYears[0];
    }

}

// ===================== Orientation Functions =====================

function populateBirthYears() {
    const birthYearSelect = document.getElementById('birthYearSelect');
    if (!birthYearSelect) return;

    const years = new Set();
    allStudentsForAssignment.forEach(s => {
        if (s.dob) {
            const match = s.dob.toString().match(/\b(19|20)\d{2}\b/);
            if (match) years.add(match[0]);
        }
    });

    const sortedYears = [...years].sort((a, b) => b - a);
    let html = '';
    sortedYears.forEach(y => {
        html += `<option value="${y}">${y}</option>`;
    });

    birthYearSelect.innerHTML = html;
    
    // Set default to 2009 if exists, otherwise first year
    if (years.has('2009')) {
        birthYearSelect.value = '2009';
    } else if (sortedYears.length > 0) {
        birthYearSelect.value = sortedYears[0];
    }
}

function populateOrientationFilters() {
    populateOrientationStreamDropdown();
    populateOrientationClassDropdown();
}

function populateOrientationStreamDropdown() {
    const streamContainer = document.getElementById('orientationStreamFilterContainer');
    const streamSelect = document.getElementById('orientationStreamSelect');
    if (!streamContainer || !streamSelect) return;

    if (institutionSettings.educationStage !== 'secondary') {
        streamContainer.style.display = 'none';
        return;
    }

    streamContainer.style.display = 'block';
    
    const birthYear = document.getElementById('birthYearSelect')?.value;
    const yearVal = document.getElementById('orientationYearSelect')?.value || 'all';

    let filtered = allStudentsForAssignment.filter(s => {
        if (yearVal !== 'all' && getStudentYear(s) !== yearVal) return false;
        if (birthYear) {
            const match = (s.dob || '').toString().match(/\b(19|20)\d{2}\b/);
            if (!match || parseInt(match[0]) > parseInt(birthYear)) return false;
        }
        return true;
    });

    const streams = [...new Set(filtered.map(s => s.stream).filter(s => s))].sort();
    let html = '<option value="all">كل الشعب</option>';
    streams.forEach(stream => {
        html += `<option value="${stream}">${getStreamLabel(stream)}</option>`;
    });

    const currentVal = streamSelect.value;
    streamSelect.innerHTML = html;
    if (streams.includes(currentVal)) streamSelect.value = currentVal;
}

function populateOrientationClassDropdown() {
    const level = document.getElementById('orientationLevelSelect')?.value || 'all';
    const stream = document.getElementById('orientationStreamSelect')?.value || 'all';
    const birthYear = document.getElementById('birthYearSelect')?.value;
    const yearVal = document.getElementById('orientationYearSelect')?.value || 'all';
    const classSelect = document.getElementById('orientationClassSelect');

    if (!classSelect) return;

    let filtered = allStudentsForAssignment.filter(s => {
        if (yearVal !== 'all' && getStudentYear(s) !== yearVal) return false;
        if (birthYear) {
            const match = (s.dob || '').toString().match(/\b(19|20)\d{2}\b/);
            if (!match || parseInt(match[0]) > parseInt(birthYear)) return false;
        }
        if (level !== 'all' && !matchLevel(s.level, level)) return false;
        if (institutionSettings.educationStage === 'secondary' && stream !== 'all' && s.stream !== stream) return false;
        return true;
    });

    const uniqueClasses = [...new Set(filtered.map(s => s.class))].sort();
    let html = '<option value="all">كل الأقسام</option>';
    uniqueClasses.forEach(c => {
        if (c) html += `<option value="${c}">${c}</option>`;
    });

    classSelect.innerHTML = html;
}

function applyOrientationFilters() {
    const trimester = document.getElementById('orientationTrimesterSelect')?.value || '1';
    const birthYear = document.getElementById('birthYearSelect')?.value;
    const level = document.getElementById('orientationLevelSelect')?.value || 'all';
    const stream = document.getElementById('orientationStreamSelect')?.value || 'all';
    const classVal = document.getElementById('orientationClassSelect')?.value || 'all';
    const yearVal = document.getElementById('orientationYearSelect')?.value || 'all';

    let filtered = allStudentsForAssignment.filter(s => {
        if (yearVal !== 'all' && getStudentYear(s) !== yearVal) return false;
        if (birthYear) {
            const match = (s.dob || '').toString().match(/\b(19|20)\d{2}\b/);
            if (!match || parseInt(match[0]) > parseInt(birthYear)) return false;
        }
        if (level !== 'all' && !matchLevel(s.level, level)) return false;
        if (institutionSettings.educationStage === 'secondary' && stream !== 'all' && s.stream !== stream) return false;
        if (classVal !== 'all' && s.class !== classVal) return false;
        return true;
    });

    // Apply Sorting
    if (orientationSortState.column) {
        const col = orientationSortState.column;
        const dir = orientationSortState.direction === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
            let valA, valB;
            if (col === 'avg') {
                valA = getStudentAverageByPeriod(a, trimester);
                valB = getStudentAverageByPeriod(b, trimester);
            } else {
                valA = a[col] || '';
                valB = b[col] || '';
            }
            return valA > valB ? dir : (valA < valB ? -dir : 0);
        });
    }

    renderOrientationStats(filtered, trimester);
    renderOrientationList(filtered, trimester);
}

function renderOrientationStats(data, trimester) {
    const tbody = document.getElementById('orientationStatsBody');
    if (!tbody) return;

    const stage = institutionSettings.educationStage || 'middle';
    let levels = stage === 'secondary' ? ['1', '2', '3'] : ['1', '2', '3', '4'];
    let levelNames = stage === 'secondary' ? 
        ['السنة الأولى ثانوي', 'السنة الثانية ثانوي', 'السنة الثالثة ثانوي'] : 
        ['الأولى متوسط', 'الثانية متوسط', 'الثالثة متوسط', 'الرابعة متوسط'];

    let html = '';
    levels.forEach((lvl, idx) => {
        const lvlData = data.filter(s => matchLevel(s.level, lvl));
        const currentSelectedLevel = document.getElementById('orientationLevelSelect').value;

        if (lvlData.length > 0 || currentSelectedLevel === 'all' || currentSelectedLevel === lvl) {
            const count = lvlData.length;
            const boys = lvlData.filter(s => s.gender === 'ذكر').length;
            const girls = count - boys;
            const getAvg = (s) => getStudentAverageByPeriod(s, trimester);
            const passedData = lvlData.filter(s => getAvg(s) >= 10);
            const passed = passedData.length;
            const passedBoys = passedData.filter(s => s.gender === 'ذكر').length;
            const passedGirls = passed - passedBoys;
            const rate = count > 0 ? ((passed / count) * 100).toFixed(2) : '0';

            html += `
                <tr>
                    <td style="font-weight:bold;">${levelNames[idx]}</td>
                    <td style="background:var(--bg-color);">${count}</td>
                    <td>${boys}</td>
                    <td>${girls}</td>
                    <td style="color:#2980b9;">${passedBoys}</td>
                    <td style="color:#e67e22;">${passedGirls}</td>
                    <td style="background:#e8f8f5; font-weight:bold; color:green;">${passed}</td>
                    <td style="font-weight:bold; background:#fef9e7;">${rate}%</td>
                </tr>
            `;
        }
    });

    if (html === '') {
        html = '<tr><td colspan="8" style="text-align:center;">لا توجد بيانات لهذه الفئة</td></tr>';
    }
    tbody.innerHTML = html;
}

function renderOrientationList(data, trimester) {
    const tbody = document.getElementById('orientationListBody');
    if (!tbody) return;

    const isSecondary = institutionSettings.educationStage === 'secondary';
    const streamHeader = document.getElementById('orientationStreamHeader');
    if (streamHeader) streamHeader.style.display = isSecondary ? '' : 'none';

    let html = '';
    data.forEach((s, idx) => {
        const avg = getStudentAverageByPeriod(s, trimester);
        const streamCell = isSecondary ? `<td>${getStreamLabel(s.stream)}</td>` : '';
        html += `
            <tr>
                <td>${idx + 1}</td>
                <td style="text-align:right; font-weight:bold;">${s.name}</td>
                <td>${s.dob || '-'}</td>
                <td>${s.level || '-'}</td>
                ${streamCell}
                <td>${s.class || '-'}</td>
                <td style="font-weight:bold; background-color: var(--bg-color);">${avg.toFixed(2)}</td>
            </tr>
        `;
    });

    if (html === '') {
        html = '<tr><td colspan="6" style="text-align:center;">لا توجد بيانات متاحة</td></tr>';
    }
    tbody.innerHTML = html;
}

async function printOrientationReport() {
    if (blockTrialPrint()) return;
    const trimester = document.getElementById('orientationTrimesterSelect').options[document.getElementById('orientationTrimesterSelect').selectedIndex].text;
    const birthYear = document.getElementById('birthYearSelect').value;
    const level = document.getElementById('orientationLevelSelect').options[document.getElementById('orientationLevelSelect').selectedIndex].text;
    const classVal = document.getElementById('orientationClassSelect').options[document.getElementById('orientationClassSelect').selectedIndex].text;
    
    const selectedTrimesterVal = document.getElementById('orientationTrimesterSelect').value;
    const selectedLevelVal = document.getElementById('orientationLevelSelect').value;
    const selectedClassVal = document.getElementById('orientationClassSelect').value;
    const selectedStreamVal = document.getElementById('orientationStreamSelect') ? document.getElementById('orientationStreamSelect').value : 'all';
    const selectedYearVal = document.getElementById('orientationYearSelect')?.value || 'all';

    let data = allStudentsForAssignment.filter(s => {
        if (selectedYearVal !== 'all' && getStudentYear(s) !== selectedYearVal) return false;
        if (birthYear) {
            const match = (s.dob || '').toString().match(/\b(19|20)\d{2}\b/);
            if (!match || parseInt(match[0]) > parseInt(birthYear)) return false;
        }
        if (selectedLevelVal !== 'all' && !matchLevel(s.level, selectedLevelVal)) return false;
        if (institutionSettings.educationStage === 'secondary' && selectedStreamVal !== 'all' && s.stream !== selectedStreamVal) return false;
        if (selectedClassVal !== 'all' && s.class !== selectedClassVal) return false;
        return true;
    });

    const getAvg = (s) => getStudentAverageByPeriod(s, selectedTrimesterVal);
    data.sort((a, b) => getAvg(b) - getAvg(a));

    const settings = await DB.getSettings() || {};
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير نتائج التوجيه - ${birthYear}</title>
            <style>
                @page { margin: 0.8cm; size: A4; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 0; font-size: 10pt; }
                .report-header { display: flex; flex-direction: column; align-items: center; margin-bottom: 10px; }
                .report-header h3 { margin: 1px 0; font-size: 10pt; font-weight: bold; }
                .info-row { width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; font-size: 9.5pt; }
                .title-box { text-align: center; margin-top: 10px; width: 100%; }
                .title-box h2 { margin: 5px 0; border: 2pt solid #000; padding: 5px 20px; display: inline-block; border-radius: 6px; font-size: 13pt; background: #fdfdfd; }
                .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9.5pt; }
                .data-table th, .data-table td { border: 1pt solid #000 !important; padding: 6px; text-align: center; }
                .data-table th { background-color: #f2f2f2 !important; color: black !important; font-weight: bold; }
                .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 10pt; }
                .signature-box { text-align: center; min-width: 200px; }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>
        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}
            <div class="report-header">
                <h3>الجمهورية الجزائرية الديمقراطية الشعبية</h3>
                <h3>وزارة التربية الوطنية</h3>
            </div>
            <div class="info-row">
                <div style="text-align: right;">
                    <div>مديرية التربية لولاية: ${settings.wilaya || '.......'}</div>
                    <div>المؤسسة: ${settings.institutionName || '.......'}</div>
                </div>
                <div style="text-align: left;">
                    <div>البلدية: ${settings.municipality || '.......'}</div>
                    <div>السنة الدراسية: ${selectedYearVal}</div>
                </div>
            </div>
            <div class="title-box">
                <h2>تحليل نتائج التوجيه (مواليد ${birthYear} فما قبل) - الفصل ${trimester}</h2>
                <div style="margin-top: 5px; font-weight: bold;">المستوى: ${level} | القسم: ${classVal}</div>
            </div>
            <div class="stats-section">
                <h3 class="card-title">📊 إحصائيات النتائج</h3>
                ${document.getElementById('orientationStatsBody').closest('table').outerHTML}
            </div>
            <div class="list-section">
                <h3 class="card-title">📋 قائمة التلاميذ</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th width="5%">#</th>
                            <th>الاسم واللقب</th>
                            <th>تاريخ الميلاد</th>
                            <th>المستوى</th>
                            ${institutionSettings.educationStage === 'secondary' ? '<th>الشعبة</th>' : ''}
                            <th>القسم</th>
                            <th>المعدل</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((s, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td style="text-align:right; font-weight:bold;">${s.name}</td>
                                <td>${s.dob || '-'}</td>
                                <td>${s.level}</td>
                                ${institutionSettings.educationStage === 'secondary' ? `<td>${getStreamLabel(s.stream)}</td>` : ''}
                                <td>${s.class}</td>
                                <td style="font-weight:bold;">${getAvg(s).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="footer" style="display: flex; justify-content: flex-end;">
                <div class="signature-box">
                    <div>حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                    <br>
                    <div>المدير</div>
                </div>
            </div>
        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}\n        </body>
        </html>
    `);
    printWindow.document.close();
}
