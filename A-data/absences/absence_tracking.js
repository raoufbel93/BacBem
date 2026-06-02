/**

 * Absence Tracking Module

 * تتبع غيابات التلاميذ والأساتذة والمشرفين

 */

// Global variables

let allStudents = [];

let allTeachers = [];

let allSupervisors = [];

let selectedStudents = new Map(); // Map for student ID -> {am: {from, to}, pm: {from, to}, reason}

let selectedTeachers = new Map(); // Map for teacher ID -> {type, reason, hours, periods}

// Canteen Data

let canteenBeneficiaries = []; // Array of student IDs

let canteenAbsences = {}; // Object: { "YYYY-MM-DD": [studentId1, studentId2] }

let canteenMode = 'tracking'; // 'beneficiaries' or 'tracking'

let selectedSupervisors = new Map(); // Map for supervisor ID -> reason

let teacherAssignments = {}; // Global assignments data

// Pagination State

let currentPage = 1;

const itemsPerPage = 50;

// Consecutive Sort State
let consecutiveSortDir = 'none'; // 'asc', 'desc', 'none'
let absenceRecordsCache = null;
let absenceRecordsCachePromise = null;

function cloneAbsenceRecords(records) {
    if (!Array.isArray(records)) return [];
    if (typeof structuredClone === 'function') {
        return structuredClone(records);
    }
    return JSON.parse(JSON.stringify(records));
}

async function getCachedAbsenceRecords(forceRefresh = false) {
    if (forceRefresh) {
        absenceRecordsCache = null;
        absenceRecordsCachePromise = null;
    }

    if (absenceRecordsCache) {
        return absenceRecordsCache;
    }

    if (absenceRecordsCachePromise) {
        return absenceRecordsCachePromise;
    }

    absenceRecordsCachePromise = (async () => {
        const records = await DB.getAllAbsencesExport() || [];
        records.sort((a, b) => {
            const dateDiff = String(b.date || '').localeCompare(String(a.date || ''));
            if (dateDiff !== 0) return dateDiff;
            return String(b.timestamp || '').localeCompare(String(a.timestamp || ''));
        });
        absenceRecordsCache = records;
        absenceRecordsCachePromise = null;
        return absenceRecordsCache;
    })();

    return absenceRecordsCachePromise;
}

function invalidateAbsenceRecordsCache() {
    absenceRecordsCache = null;
    absenceRecordsCachePromise = null;
}

function getStatusTimeLabel() {
    return new Date().toLocaleTimeString('ar-DZ', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function setSaveStatus(state, customText = '') {
    const indicator = document.getElementById('saveStatusIndicator');
    const dot = document.getElementById('saveStatusDot');
    const text = document.getElementById('saveStatusText');
    if (!indicator || !dot || !text) return;

    const statusMap = {
        idle: {
            text: 'جاهز',
            border: '#d6eaf8',
            bg: '#eef7fd',
            color: '#21618c',
            dot: '#3498db'
        },
        dirty: {
            text: 'توجد تغييرات غير محفوظة',
            border: '#f9e79f',
            bg: '#fef9e7',
            color: '#9a7d0a',
            dot: '#f1c40f'
        },
        saving: {
            text: 'جاري الحفظ...',
            border: '#d4efdf',
            bg: '#edf9f1',
            color: '#1e8449',
            dot: '#27ae60'
        },
        saved: {
            text: `تم الحفظ عند ${getStatusTimeLabel()}`,
            border: '#d4efdf',
            bg: '#edf9f1',
            color: '#1e8449',
            dot: '#27ae60'
        },
        autosaved: {
            text: `تم الحفظ تلقائياً عند ${getStatusTimeLabel()}`,
            border: '#d1f2eb',
            bg: '#e8f8f5',
            color: '#117864',
            dot: '#16a085'
        },
        loaded: {
            text: 'تم تحميل التقرير',
            border: '#e8daef',
            bg: '#f5eef8',
            color: '#7d3c98',
            dot: '#8e44ad'
        },
        error: {
            text: 'تعذر حفظ التغييرات',
            border: '#f5c6cb',
            bg: '#fdecea',
            color: '#c0392b',
            dot: '#e74c3c'
        }
    };

    const config = statusMap[state] || statusMap.idle;
    indicator.style.borderColor = config.border;
    indicator.style.background = config.bg;
    indicator.style.color = config.color;
    dot.style.background = config.dot;
    text.textContent = customText || config.text;
}

function markReportDirty(customText = '') {
    setSaveStatus('dirty', customText || 'توجد تغييرات غير محفوظة');
}

/**

 * Calculate time difference in hours between two times (HH:MM or H:MM)

 * Returns 0 if invalid or empty

 */

function calculateTimeDifference(start, end) {

    if (!start || !end || start === 'Present' || end === 'Present' || start === '-' || end === '-') return 0;

    try {

        const [h1, m1] = start.split(':').map(Number);

        const [h2, m2] = end.split(':').map(Number);

        if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;

        const date1 = new Date(2000, 0, 1, h1, m1);

        const date2 = new Date(2000, 0, 1, h2, m2);

        // Calculate difference exactly

        let diff = (date2 - date1) / (1000 * 60 * 60);

        // Handle negative diffs (across midnight? unlikely for school, but good to handle)

        // Actually, sometimes end time < start time if user error, we should return 0 or abs?

        // Let's return abs to be safe, or 0.

        if (diff < 0) return 0;

        return Math.round(diff * 100) / 100;

    } catch (e) {

        return 0;

    }

}

// Initialize function

// Update Day Name Display

function updateDayName() {

    const dateInput = document.getElementById('absenceDate');

    const dayDisplay = document.getElementById('dayOfDay');

    if (dateInput && dayDisplay && dateInput.value) {

        const date = new Date(dateInput.value);

        const dayName = date.toLocaleDateString('ar-DZ', { weekday: 'long' });

        dayDisplay.textContent = dayName;

    }

}

// Initialize function

async function initPage() {

    // console.log('initPage called');

    // 1. Load Application Settings (Correct Key: 'institutionSettings')

    window.appSettings = await DB.get('institutionSettings') || {};

    // console.log('Loaded App Settings:', window.appSettings);

    // Set today's date

    const today = new Date().toISOString().split('T')[0];

    const absenceDateEl = document.getElementById('absenceDate');

    if (absenceDateEl) {

        absenceDateEl.value = today;

        updateDayName();

    }
    setSaveStatus('idle');

    // Load and set report number
    await loadReportNumber();

    // Load Schedule Settings
    if (typeof loadScheduleSettings === 'function') {
        await loadScheduleSettings();
    }

    // Load data
    await loadAllData();

    // Populate Level Dropdown logic

    populateLevelDropdown();

    // Add event listeners for date and period change

    if (absenceDateEl) {

        absenceDateEl.addEventListener('change', () => checkAndLoadSavedAbsence());

    }

    const reportNumberEl = document.getElementById('reportNumber');

    if (reportNumberEl) {

        reportNumberEl.addEventListener('input', () => markReportDirty('تم تعديل رقم التقرير'));

    }

    const periodSelect = document.getElementById('periodSelect');

    if (periodSelect) {

        periodSelect.addEventListener('change', () => checkAndLoadSavedAbsence());

    }

    // Check for saved absence on load

    await restoreViewState(); // Restore filters first

    await checkAndLoadSavedAbsence(); // Then load data based on filters

    // Load report log
    if (typeof loadReportLog === 'function') await loadReportLog();

    // Attach listeners for view state saving

    attachViewStateListeners();

}

/**

 * Populate Level Dropdown based on Education Stage

 */

function populateLevelDropdown() {

    const levelSelect = document.getElementById('levelSelect');

    if (!levelSelect) return;

    // Clear existing options except default

    levelSelect.innerHTML = '<option value="">-- اختر المستوى --</option>';

    const stage = window.appSettings.educationStage || 'middle';
    const levels = window.AppAcademic && typeof window.AppAcademic.getLevelOptionsByStage === 'function'
        ? window.AppAcademic.getLevelOptionsByStage(stage)
        : [];

    levels.forEach(lvl => {
        const opt = document.createElement('option');
        opt.value = lvl.value;
        opt.textContent = lvl.label;
        levelSelect.appendChild(opt);
    });

    // Also populate Canteen Filter if it exists
    const canteenFilter = document.getElementById('canteenTrackingLevelFilter');
    if (canteenFilter) {
        canteenFilter.innerHTML = '<option value="">كل المستويات</option>';
        levels.forEach(lvl => {
            const opt = document.createElement('option');
            opt.value = lvl.value;
            opt.textContent = lvl.label;
            canteenFilter.appendChild(opt);
        });
    }
}

function normalizeAcademicLevel(levelValue) {
    if (window.AppAcademic && typeof window.AppAcademic.getCanonicalLevel === 'function') {
        return window.AppAcademic.getCanonicalLevel(levelValue) || '';
    }
    return levelValue == null ? '' : String(levelValue).trim();
}

function formatAcademicLevel(levelValue, stageValue, includeStageLabel) {
    if (window.AppAcademic && typeof window.AppAcademic.formatLevel === 'function') {
        return window.AppAcademic.formatLevel(levelValue, stageValue || 'middle', {
            includeStageLabel: includeStageLabel === true
        });
    }
    return normalizeAcademicLevel(levelValue);
}

/**

 * Load report number from storage

 * The report number auto-increments but can be manually edited

 */

async function loadReportNumber() {

    const reportNumberEl = document.getElementById('reportNumber');

    if (!reportNumberEl) return;

    // Get stored report number data

    const reportData = await DB.get('reportNumberData') || { lastNumber: 0, lastDate: null };

    // Get current school year from settings (to reset on new year)

    const settings = await DB.getSettings() || {};

    const currentSchoolYear = settings.schoolYear || '';

    // Check if we need to reset (new school year)

    if (reportData.schoolYear && reportData.schoolYear !== currentSchoolYear && currentSchoolYear) {

        // New school year - reset the counter

        reportData.lastNumber = 0;

        reportData.schoolYear = currentSchoolYear;

    }

    const today = new Date().toISOString().split('T')[0];

    // If today is different from last saved date, increment the number

    if (reportData.lastDate !== today) {

        reportData.lastNumber = (reportData.lastNumber || 0) + 1;

        reportData.lastDate = today;

        reportData.schoolYear = currentSchoolYear;

        await DB.set('reportNumberData', reportData);

    }

    reportNumberEl.value = reportData.lastNumber;

}

/**

 * Save report number when manually changed

 */

async function saveReportNumber() {

    const reportNumberEl = document.getElementById('reportNumber');

    if (!reportNumberEl) return;

    const newNumber = parseInt(reportNumberEl.value) || 1;

    const today = new Date().toISOString().split('T')[0];

    // Get current school year

    const settings = await DB.getSettings() || {};

    const currentSchoolYear = settings.schoolYear || '';

    const reportData = {

        lastNumber: newNumber,

        lastDate: today,

        schoolYear: currentSchoolYear

    };

    await DB.set('reportNumberData', reportData);

    markReportDirty('تم تعديل رقم التقرير');

    // console.log('Report number saved:', newNumber);

}

/**
 * Handle teacher absence reason change (Other option)
 */
window.handleTeacherReasonChange = function () {
    const sel = document.getElementById('teacherAbsenceReason');
    const otherInput = document.getElementById('teacherReasonOther');
    if (!sel || !otherInput) return;

    if (sel.value === 'other') {
        otherInput.style.display = 'block';
        otherInput.focus();
    } else {
        otherInput.style.display = 'none';
        otherInput.value = '';
    }
};

/**
 * Update the text and style of the save button based on whether a report exists
 */
function updateActionButtonUI(exists) {
    const btn = document.getElementById('btnActionReport');
    if (!btn) return;

    if (exists) {
        btn.innerHTML = '💾 حفظ التعديلات';
        btn.style.background = 'linear-gradient(135deg, #e67e22, #d35400)'; // Orange for edit
    } else {
        btn.innerHTML = '💾 إنشاء تقرير';
        btn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)'; // Blue for new
    }
}

/**

 * Get current report number for use in reports

 */

function getCurrentReportNumber() {
    const reportNumberEl = document.getElementById('reportNumber');
    return reportNumberEl ? (reportNumberEl.value.trim() || '-') : '-';
}

// ============================================================
// Holiday Management System
// ============================================================
let appHolidays = [];

async function loadHolidays() {
    appHolidays = (await DB.get('app_holidays')) || [];
    return appHolidays;
}

function isWeekend(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0=Sun, 5=Fri, 6=Sat
    return day === 5 || day === 6;
}

function isHoliday(dateStr) {
    return appHolidays.some(h => h.date === dateStr);
}

function isHolidayOrWeekend(dateStr) {
    return isWeekend(dateStr) || isHoliday(dateStr);
}

function attachViewStateListeners() {

    ['absenceDate', 'periodSelect', 'levelSelect', 'streamSelect', 'classSelect', 'studentSearch'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', async (e) => {
                saveViewState();
                if (id === 'absenceDate') {
                    if (typeof loadFacilitiesData === 'function') {
                        await loadFacilitiesData(e.target.value);
                    }
                }
            });
            if (id === 'studentSearch') el.addEventListener('keyup', saveViewState); // For search
        }
    });

}

// Initialize on page load - handle both cases

if (document.readyState === 'loading') {

    document.addEventListener('DOMContentLoaded', initPage);

} else {

    // DOMContentLoaded already fired

    initPage();

}

/**

 * Save current view state (filters, date)

 */

/**

 * Save current view state (filters, date)

 */

// --- View State Persistence (LocalStorage) ---

function saveViewState() {

    const state = {

        date: document.getElementById('absenceDate').value,

        period: document.getElementById('periodSelect') ? document.getElementById('periodSelect').value : '',

        level: document.getElementById('levelSelect') ? document.getElementById('levelSelect').value : '',

        stream: document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : '',

        class: document.getElementById('classSelect') ? document.getElementById('classSelect').value : '',

        search: document.getElementById('studentSearch') ? document.getElementById('studentSearch').value : ''

    };

    localStorage.setItem('absenceTrackingState', JSON.stringify(state));

    // console.log('Saved view state to LocalStorage:', state);

}

async function restoreViewState() {

    try {

        const saved = localStorage.getItem('absenceTrackingState');

        if (!saved) {

            // console.log('No LocalStorage view state found.');

            return;

        }

        const state = JSON.parse(saved);

        // console.log('Restoring view state from LocalStorage:', state);

        if (state.period && document.getElementById('periodSelect')) {

            document.getElementById('periodSelect').value = state.period;

        }

        if (state.level && document.getElementById('levelSelect')) {

            document.getElementById('levelSelect').value = state.level;

            // Wait for classes loading logic which might depend on streams now

            // We need to trigger loadClasses which handles stream population too

            await loadClasses();

            setTimeout(() => {

                if (state.stream && document.getElementById('streamSelect')) {

                    document.getElementById('streamSelect').value = state.stream;

                    // Trigger stream change effect (filter classes)

                    if (typeof loadClasses === 'function') loadClasses();

                    setTimeout(() => {

                        if (state.class && document.getElementById('classSelect')) {

                            document.getElementById('classSelect').value = state.class;

                            if (typeof loadStudentsTable === 'function') loadStudentsTable();

                        }

                    }, 100);

                } else if (state.class && document.getElementById('classSelect')) {

                    // Middle school case

                    document.getElementById('classSelect').value = state.class;

                    if (typeof loadStudentsTable === 'function') loadStudentsTable();

                }

            }, 100);

        }

        if (state.search && document.getElementById('studentSearch')) {

            document.getElementById('studentSearch').value = state.search;

            if (typeof filterStudentsTable === 'function') filterStudentsTable();

        }

    } catch (e) {

        console.error('Error restoring view state:', e);

    }

}

/**

 * Load all data from localStorage/IndexedDB

 */

async function loadAllData() {

    try {

        // console.log('Starting data load...');

        // Load students

        allStudents = await DB.getStudents(false) || [];

        // console.log('Loaded students:', allStudents.length);

        // Load teachers

        allTeachers = await DB.getTeachers() || [];

        // console.log('Loaded teachers:', allTeachers.length);

        // Load supervisors

        allSupervisors = await DB.get('supervisorsList') || [];

        // Load Canteen Data

        const savedBeneficiaries = await DB.get('canteenBeneficiaries');

        if (savedBeneficiaries) {

            canteenBeneficiaries = savedBeneficiaries;

        }

        const savedCanteenAbsences = await DB.get('canteenAbsences');

        if (savedCanteenAbsences) {

            canteenAbsences = savedCanteenAbsences;

        }

        // Load Canteen Daily Info (Proposed Meal, etc)

        await loadCanteenDailyInfo();

        // Load Teacher Assignments (Esnad)

        teacherAssignments = await DB.get('teacherAssignments') || {};

        // Render teachers table

        renderTeachersTable();

        // Render supervisors table

        renderSupervisorsTable();

        // Update student stats to show institution total
        updateStudentStats();

        // Load Facilities/Notes Data
        const currentDate = document.getElementById('absenceDate').value;
        if (currentDate && typeof loadFacilitiesData === 'function') {
            await loadFacilitiesData(currentDate);
        }

    } catch (error) {

        console.error('Error loading data:', error);

        showToast('خطأ في تحميل البيانات', 'error');

    }

}

/**

 * Switch between tabs

 */

function switchTab(tabName) {

    // Update tab buttons

    document.querySelectorAll('.tab-btn').forEach(btn => {

        btn.classList.remove('active');

        if (btn.dataset.tab === tabName) {

            btn.classList.add('active');

        }

    });

    // Update tab content

    document.querySelectorAll('.tab-content').forEach(content => {

        content.classList.remove('active');

    });

    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Reset Canteen Mode when entering tab

    if (tabName === 'canteen') {

        if (typeof switchCanteenMode === 'function') {

            switchCanteenMode('tracking');

        }

    }

}

// Helper to match levels strictly or loosely

function matchLevel(studentLvl, selectedLvl) {

    if (!studentLvl || !selectedLvl) return false;

    return normalizeAcademicLevel(studentLvl) === normalizeAcademicLevel(selectedLvl);

}

/**

 * Load classes based on selected level

 * Handles Stream logic for Secondary School

 */

function loadClasses() {

    const levelSelect = document.getElementById('levelSelect');

    const classSelect = document.getElementById('classSelect');

    const streamSelect = document.getElementById('streamSelect');

    // Safety check

    if (!levelSelect || !classSelect) return;

    const level = levelSelect.value;

    const stage = window.appSettings.educationStage || 'middle';

    // console.log('loadClasses called, level:', level, 'stage:', stage);

    // Filter Logic

    let studentsInLevel = [];

    if (level) {

        studentsInLevel = allStudents.filter(s => matchLevel(s.level, level));

    }

    // Secondary Stage Handling

    if (stage === 'secondary') {

        if (streamSelect) {

            streamSelect.style.display = 'inline-block';

            // Populate Streams if this trigger was from Level Change (detected by checking if stream options map matches current level streams)

            // Or simply, we re-populate streams if the current options don't look right, or we just re-populate always and try to keep selection?

            // Simpler: If streamSelect is visible, we should populate it based on Level.

            // BUT this function is called on Stream Change too. We shouldn't reset Stream options then.

            // To detect trigger source, we could look at event, but passing it is cleaner.

            // For now, let's check if the stream options are populated for this level?

            // Actually, simplest is:

            // 1. Get current streams from SubjectManager/Data

            if (level && typeof SubjectManager !== 'undefined') {

                const availableStreams = SubjectManager.getStreams(level);

                const currentVal = streamSelect.value;

                // Add all tech_math specialties (they share the same subjects as base tech_math)

                const techMathSpecialties = ['tech_math_civil', 'tech_math_mech', 'tech_math_elec', 'tech_math_methods'];

                // Insert tech_math variants after tech_math in the list (or replace it if we want specific only)

                // Let's replace it to be consistent with student_list

                // const techMathIndex = availableStreams.indexOf('tech_math');
                // if (techMathIndex !== -1) {
                //     availableStreams.splice(techMathIndex, 1, ...techMathSpecialties);
                // }

                // Let's rebuild the stream list options array

                const streamOptionsHTML = ['<option value="">-- اختر الشعبة --</option>'];

                availableStreams.forEach(stream => {

                    streamOptionsHTML.push(`<option value="${stream}">${SubjectManager.getStreamName(stream)}</option>`);

                });

                // Compare with current innerHTML length or content?

                // Just set it.

                // Wait, if change was from Stream Select, we want to KEEP the value.

                // If change was from Level Select, we want to RESET the value.

                // How to distinguish?

                // Maybe we can check if the currently selected stream is valid for the NEW level.

                // If secondary levels, streams overlap (Science in 1AS, 2AS...).

                // But Level 1AS streams != Level 2AS streams.

                // If we force update, we just try to re-select `currentVal` if it exists in new options.

                // Check if current options match the level's streams

                // To avoid UI flicker/reset loops, let's only update if necessary.

                // Actually, let's just update and retain.

                const newHTML = streamOptionsHTML.join('');

                if (streamSelect.innerHTML !== newHTML) {

                    streamSelect.innerHTML = newHTML;

                    // Try to restore value

                    if (availableStreams.includes(currentVal)) {

                        streamSelect.value = currentVal;

                    } else {

                        streamSelect.value = ""; // Reset if invalid for this level

                    }

                }

            } else {

                // No level or no SubjectManager?

                streamSelect.innerHTML = '<option value="">-- اختر الشعبة --</option>';

            }

            // Now Filter Students by Stream if selected

            const selectedStream = streamSelect.value;

            if (selectedStream) {

                studentsInLevel = studentsInLevel.filter(s => s.stream === selectedStream);

            }

        }

    } else {

        if (streamSelect) streamSelect.style.display = 'none';

    }

    // Populate Classes Dropdown

    const currentClass = classSelect.value;

    // Clear current options

    classSelect.innerHTML = '<option value="">-- اختر القسم --</option>';

    if (!level) {

        // If no level, clear table

        loadStudentsTable();

        return;

    }

    const classes = [...new Set(studentsInLevel.map(s => s.class))].filter(c => c).sort((a, b) => {

        const numA = parseInt(a);

        const numB = parseInt(b);

        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;

        return String(a).localeCompare(String(b));

    });

    classes.forEach(cls => {

        const option = document.createElement('option');

        option.value = cls;

        option.textContent = cls;

        if (cls === currentClass) option.selected = true; // Attempt to keep class selected if valid

        classSelect.appendChild(option);

    });

    // Reset page on filter change (if class changed or forced)

    // Actually if we just reloaded classes, we might have invalidated the current class selection

    if (classSelect.value !== currentClass) {

        currentPage = 1;

    }

    // Update stats to show level total

    updateStudentStats();

    // Render the table

    loadStudentsTable();

}

/**

 * Load students table based on selected level, class, AND search

 * Implements Pagination

 */

/**
 * Get short stream name
 */
function getShortStreamName(streamName) {
    if (!streamName) return '';
    const map = {
        'جذع مشترك علوم وتكنولوجيا': 'ج.م.ع.ت',
        'common_science': 'ج.م.ع.ت',
        'جذع مشترك آداب': 'ج.م.آ',
        'common_arts': 'ج.م.آ',
        'علوم تجريبية': 'ع.تجريبية',
        'science': 'ع.تجريبية',
        'تسيير واقتصاد': 'ت.إقتصاد',
        'management': 'ت.إقتصاد',
        'تقني رياضي': 'ت.رياضي',
        'math_tech': 'ت.رياضي',
        'tech_math': 'ت.رياضي',
        'tech_math_electrical': 'ت.رياضي',
        'tech_math_elec': 'ت.رياضي',
        'tech_math_mechanical': 'ت.رياضي',
        'tech_math_mech': 'ت.رياضي',
        'tech_math_civil': 'ت.رياضي',
        'tech_math_civ': 'ت.رياضي',
        'tech_math_ge': 'ت.رياضي',
        'tech_math_methods': 'ت.رياضي',
        'tech_math_proc': 'ت.رياضي',
        'رياضيات': 'رياضيات',
        'math': 'رياضيات',
        'لغات أجنبية': 'ل.أجنبية',
        'languages': 'ل.أجنبية',
        'آداب وفلسفة': 'آ.فلسفة',
        'literature': 'آ.فلسفة',
        'arts': 'آ.فلسفة',
        'sport': 'رياضة'
    };
    return map[streamName] || streamName;
}

/**
 * Toggle Consecutive Days Sort
 */
function toggleConsecutiveSort() {
    if (consecutiveSortDir === 'none') {
        consecutiveSortDir = 'desc'; // Start with most useful (High to Low)
    } else if (consecutiveSortDir === 'desc') {
        consecutiveSortDir = 'asc';
    } else {
        consecutiveSortDir = 'none';
    }

    // Update Icon
    const icon = document.getElementById('sortIcon');
    if (icon) {
        if (consecutiveSortDir === 'desc') icon.textContent = '↓';
        else if (consecutiveSortDir === 'asc') icon.textContent = '↑';
        else icon.textContent = '⇅';
    }

    // Reset pagination to page 1 to see results
    currentPage = 1;

    // Reload table
    loadStudentsTable();
}

let studentsGridInstance = null;
async function loadStudentsTable() {
    const level = document.getElementById('levelSelect').value;
    const classNum = document.getElementById('classSelect').value;
    const streamSelect = document.getElementById('streamSelect');
    const selectedStream = (streamSelect && streamSelect.style.display !== 'none') ? streamSelect.value : '';
    const searchTerm = document.getElementById('studentSearch') ? document.getElementById('studentSearch').value.toLowerCase() : '';
    const currentDate = document.getElementById('absenceDate').value;

    const wrapper = document.getElementById('students-grid-wrapper');
    if (!wrapper) return;

    const stage = window.appSettings.educationStage || 'middle';
    const isSecondary = stage === 'secondary';

    const streamHeader = document.getElementById('streamHeader');
    if (streamHeader) {
        streamHeader.style.display = isSecondary ? '' : 'none';
    }

    const allAbsenceRecords = await getCachedAbsenceRecords();

    let filteredStudents = allStudents;

    if (level) {
        filteredStudents = filteredStudents.filter(s => matchLevel(s.level, level));
    }
    if (selectedStream) {
        if (selectedStream === 'tech_math') {
            filteredStudents = filteredStudents.filter(s => s.stream === 'tech_math' || (s.stream && s.stream.startsWith('tech_math_')));
        } else {
            filteredStudents = filteredStudents.filter(s => s.stream === selectedStream);
        }
    }
    if (classNum) {
        filteredStudents = filteredStudents.filter(s => String(s.class) === String(classNum));
    }

    if (searchTerm) {
        filteredStudents = filteredStudents.filter(s => {
            const fullName = `${s.last_name} ${s.first_name}`.toLowerCase();
            return fullName.includes(searchTerm);
        });
    }

    const consecutiveFilterVal = document.getElementById('consecutiveFilter') ? parseInt(document.getElementById('consecutiveFilter').value) : 0;
    if (consecutiveFilterVal > 0) {
        filteredStudents = filteredStudents.filter(s => {
            const studentId = String(s.id || `${s.last_name}-${s.first_name}`);
            const isSelected = selectedStudents.has(studentId);

            // Compute history-based streak using the centralized function
            const streak = window.calculateConsecutiveDays ? window.calculateConsecutiveDays(studentId, currentDate, allAbsenceRecords, isSelected) : (isSelected ? 1 : 0);
            return streak >= consecutiveFilterVal;
        });
    }

    const totalItems = filteredStudents.length;

    if (totalItems === 0) {
        // Handle empty state manually or via gridjs empty message if instance already exists
        if (studentsGridInstance) {
            try { studentsGridInstance.destroy(); } catch (e) { }
            studentsGridInstance = null;
        }
        wrapper.innerHTML = `<div style="padding: 20px; text-align: center; color: #999;">
            <div style="font-size: 2.5rem; margin-bottom: 10px; opacity: 0.5;">📚</div>
            <p>اختر المستوى والقسم لعرض التلاميذ</p>
        </div>`;
        return;
    }

    const data = filteredStudents.map((student, index) => {
        const studentId = String(student.id || `${student.last_name}-${student.first_name}`);
        let isSelected = selectedStudents.has(studentId);
        let dataState = selectedStudents.get(studentId);

        if (!dataState || typeof dataState !== 'object') {
            let amDefF = '08:00', amDefT = '12:00', pmDefF = '13:00', pmDefT = '17:00';
            if (window.getScheduleForDate) {
                const sched = window.getScheduleForDate(document.getElementById('absenceDate').value);
                if (sched) {
                    amDefF = sched.am_from || amDefF;
                    amDefT = sched.am_to || amDefT;
                    pmDefF = sched.pm_from !== '' ? sched.pm_from : '-';
                    pmDefT = sched.pm_to !== '' ? sched.pm_to : '-';
                    if (sched.am_from === '') amDefF = '-';
                    if (sched.am_to === '') amDefT = '-';
                }
            }
            dataState = {
                am: { from: amDefF, to: amDefT },
                pm: { from: pmDefF, to: pmDefT },
                reason: ''
            };
        }

        const amFromOpts = getAbsenceTimeOptions('AM', dataState.am.from, false);
        const amToOpts = getAbsenceTimeOptions('AM', dataState.am.to, true);
        const pmFromOpts = getAbsenceTimeOptions('PM', dataState.pm.from, false);
        const pmToOpts = getAbsenceTimeOptions('PM', dataState.pm.to, true);

        const detailsStyle = isSelected
            ? 'max-height: 150px; opacity: 1; margin-top: 5px;'
            : 'max-height: 0; opacity: 0; overflow: hidden; margin: 0; padding: 0;';

        let streakDisplay = '0';
        let streakSortVal = 0;

        // Calculate streak exactly as the filter does
        const count = window.calculateConsecutiveDays ? window.calculateConsecutiveDays(studentId, currentDate, allAbsenceRecords, isSelected) : 0;
        streakSortVal = count;

        if (count > 0) {
            streakDisplay = `<div style="display:flex; justify-content:center; align-items:center; gap:5px;"><div class="streak-badge streak-badge-${studentId}"><span style="font-weight:bold; color:red; font-size: 0.85rem;">${count}</span></div></div>`;
        } else {
            streakDisplay = `<div style="display:flex; justify-content:center; align-items:center; gap:5px;"><div class="streak-badge streak-badge-${studentId}">0</div></div>`;
        }

        let checkHtml = `<div style="display:flex; justify-content:center; align-items:center; gap:8px;">
                            <input type="checkbox" class="absence-checkbox"
                                style="transform: scale(1.2); cursor: pointer;"
                                onchange="toggleStudentAbsence('${studentId}', this)"
                                ${isSelected ? 'checked' : ''}>`;
        if (isSelected) {
            checkHtml += `<button class="btn btn-sm return-btn" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem; font-weight:bold;" onclick="removeStudentAbsence('${studentId}')" title="إلغاء الغياب">🔄 العودة</button>`;
        }
        checkHtml += `</div>`;

        const amHtml = `<div class="absence-details" style="${detailsStyle}">
                            <div class="time-input-container">
                                <div class="time-input-group">
                                    <span class="time-label">من</span>
                                    <select class="time-select" onchange="updateStudentAbsence('${studentId}', 'am_from', this.value)">${amFromOpts}</select>
                                </div>
                                <div class="time-input-group">
                                    <span class="time-label">إلى</span>
                                    <select class="time-select" onchange="updateStudentAbsence('${studentId}', 'am_to', this.value)">${amToOpts}</select>
                                </div>
                            </div>
                        </div>`;

        const pmHtml = `<div class="absence-details" style="${detailsStyle}">
                            <div class="time-input-container">
                                <div class="time-input-group">
                                    <span class="time-label">من</span>
                                    <select class="time-select" onchange="updateStudentAbsence('${studentId}', 'pm_from', this.value)">${pmFromOpts}</select>
                                </div>
                                <div class="time-input-group">
                                    <span class="time-label">إلى</span>
                                    <select class="time-select" onchange="updateStudentAbsence('${studentId}', 'pm_to', this.value)">${pmToOpts}</select>
                                </div>
                            </div>
                        </div>`;

        const noteHtml = `<div class="absence-details" style="${detailsStyle}">
                             <input type="text" class="reason-select"
                                    value="${dataState.reason}"
                                    placeholder="اكتب ملاحظة..."
                                    onchange="updateStudentAbsence('${studentId}', 'reason', this.value)">
                          </div>`;

        let rowData = [
            index + 1,
            gridjs.html(`<span style="cursor:pointer; color:#2980b9; font-weight:bold;" onclick="openPreviousAbsencesModal('${studentId}', '${student.last_name} ${student.first_name}')">${student.last_name || ''}</span>`),
            gridjs.html(`<span style="cursor:pointer; color:#2980b9; font-weight:bold;" onclick="openPreviousAbsencesModal('${studentId}', '${student.last_name} ${student.first_name}')">${student.first_name || ''}</span>`),
            student.level || ''
        ];

        if (isSecondary) {
            rowData.push(
                (student.stream && (['tech_math_civil', 'tech_math_elec', 'tech_math_methods', 'tech_math_mech'].includes(student.stream) || student.stream.startsWith('tech_math')))
                    ? 'ت.رياضي' : getShortStreamName(student.stream)
            );
        }

        rowData.push(student.class || '');
        rowData.push(gridjs.html(checkHtml));
        rowData.push(gridjs.html(streakDisplay));
        rowData.push(gridjs.html(amHtml));
        rowData.push(gridjs.html(pmHtml));
        rowData.push(gridjs.html(noteHtml));

        return rowData;
    });

    let columns = [
        { id: 'col_idx', name: '#', width: '60px' },
        { id: 'col_lname', name: 'اللقب', width: '150px' },
        { id: 'col_fname', name: 'الاسم', width: '150px' },
        { id: 'col_level', name: 'المستوى', width: '120px' }
    ];

    if (isSecondary) columns.push({ id: 'col_stream', name: 'الشعبة', width: '120px' });

    columns.push({ id: 'col_class', name: 'القسم', width: '80px' });
    columns.push({ id: 'col_absent', name: 'غائب', width: '150px', sort: false });
    columns.push({ id: 'col_consec', name: gridjs.html('أيام متتالية'), width: '110px', sort: true });
    columns.push({ id: 'col_am', name: 'الحصة الصباحية', width: '120px', sort: false });
    columns.push({ id: 'col_pm', name: 'الحصة المسائية', width: '120px', sort: false });
    columns.push({ id: 'col_note', name: 'ملاحظات', sort: false });

    // Always destroy and recreate the grid to guarantee a fresh render
    // (Grid.js updateConfig does not reliably re-render when row count changes)
    if (studentsGridInstance) {
        try { studentsGridInstance.destroy(); } catch (e) { }
        studentsGridInstance = null;
    }
    wrapper.innerHTML = '';

    studentsGridInstance = new gridjs.Grid({
        columns: columns,
        data: data,
        search: false,
        sort: true,
        pagination: {
            limit: itemsPerPage,
            summary: true
        },
        language: {
            search: { placeholder: 'بحث عن تلميذ...' },
            pagination: {
                previous: 'السابق',
                next: 'التالي',
                navigate: (page, pages) => `صفحة ${page} من ${pages}`,
                page: (page) => `صفحة ${page}`,
                showing: 'عرض',
                of: 'من',
                to: 'إلى',
                results: 'نتائج'
            }
        },
        className: {
            table: 'absence-table',
            thead: 'thead-light'
        },
        style: {
            table: { width: '100%' },
            td: { textAlign: 'center', verticalAlign: 'middle' },
            th: { textAlign: 'center' }
        }
    });

    studentsGridInstance.render(wrapper);

    // Icon consistency for Windows 7
    studentsGridInstance.on('render', () => {
        if (typeof IconManager !== 'undefined') IconManager.render();
    });

    // Post-render hook to apply the .selected class visually to rows with checked checkboxes
    studentsGridInstance.on('ready', () => {
        setTimeout(() => {
            const checkboxes = wrapper.querySelectorAll('.absence-checkbox');
            checkboxes.forEach(chk => {
                if (chk.checked) {
                    const tr = chk.closest('tr');
                    if (tr) tr.classList.add('selected');
                }
            });
        }, 50);
    });
}

function changePage(newPage) {

    if (newPage < 1) return;

    currentPage = newPage;

    loadStudentsTable();

}

/**

 * Filter students table by search (Wrapper to reset page and reload)

 * Replaces old DOM-based filter

 */

function filterStudentsTable() {

    currentPage = 1;

    loadStudentsTable();

}

/**

 * Generate time options

 */

/**

 * Helper to get period times array based on settings

 */

function getPeriodTimes(period, customStart, customEnd, includeNextHour = false) {
    let times = ['Present'];
    let startH, startM, endH;

    if (customStart === '') {
        return times;
    }

    if (customStart && customStart !== '-' && customStart.includes(':')) {
        const parts = customStart.split(':');
        startH = parseInt(parts[0]);
        startM = parts[1];
    } else if (period === 'AM') {
        startH = window.appSettings && window.appSettings.morningEntryTime ? parseInt(window.appSettings.morningEntryTime.split(':')[0]) : 8;
        startM = window.appSettings && window.appSettings.morningEntryTime ? window.appSettings.morningEntryTime.split(':')[1] : '00';
    } else {
        startH = window.appSettings && window.appSettings.eveningEntryTime ? parseInt(window.appSettings.eveningEntryTime.split(':')[0]) : 13;
        startM = window.appSettings && window.appSettings.eveningEntryTime ? window.appSettings.eveningEntryTime.split(':')[1] : '00';
    }

    if (customEnd && customEnd !== '-' && customEnd.includes(':')) {
        endH = parseInt(customEnd.split(':')[0]);
    } else {
        const defaultDuration = period === 'AM' ? 4 : 3;
        endH = startH + defaultDuration;
    }

    // Ensure endH is not before startH
    if (endH < startH) endH = startH + (period === 'AM' ? 4 : 3);

    const loopEndH = includeNextHour ? (endH + 1) : endH;

    for (let h = startH; h <= loopEndH; h++) {
        times.push(`${String(h).padStart(2, '0')}:${startM}`);
    }

    return times;
}

/**
 * Generate time options
 */
function getAbsenceTimeOptions(period, selectedValue, isEndField = false) {
    let customStart = null;
    let customEnd = null;

    if (window.getScheduleForDate) {
        const dateInput = document.getElementById('absenceDate');
        if (dateInput) {
            const sched = window.getScheduleForDate(dateInput.value);
            if (sched) {
                if (period === 'AM') {
                    customStart = sched.am_from;
                    customEnd = sched.am_to;
                } else if (period === 'PM') {
                    customStart = sched.pm_from;
                    customEnd = sched.pm_to;
                } else if (period === 'FULL') {
                    customStart = sched.am_from;
                    customEnd = sched.pm_to;
                }
            }
        }
    }

    let times = getPeriodTimes(period, customStart, customEnd, isEndField);

    if (selectedValue && selectedValue !== 'Present' && selectedValue !== '-' && !times.includes(selectedValue)) {
        const hasPresent = times.includes('Present');
        times = times.filter(t => t !== 'Present');
        times.push(selectedValue);
        times.sort();
        if (hasPresent) times.unshift('Present');
    }

    return times.map(t => {
        const label = t === 'Present' ? 'حاضر' : t;
        return `<option value="${t}" ${t === selectedValue ? 'selected' : ''}>${label}</option>`;
    }).join('');
}

/**

 * Toggle confirmation status for a student

 * @param {string} studentId

 */

function toggleStudentConfirmation(studentId) {

    if (!selectedStudents.has(studentId)) return;

    const data = selectedStudents.get(studentId);

    data.confirmed = !data.confirmed;

    selectedStudents.set(studentId, data);

    // Auto save

    performAutoSave();

    // Refresh table to show update

    loadStudentsTable();

}

/**

 * Update student absence data

 */

function updateStudentAbsence(studentId, field, value) {

    // If not in map (should be if interacting), add it

    let data = selectedStudents.get(studentId);

    if (!data) return; // Should not happen if UI is hidden

    // Update specific field

    if (field === 'reason') data.reason = value;

    else if (field === 'am_from') data.am.from = value;

    else if (field === 'am_to') data.am.to = value;

    else if (field === 'pm_from') data.pm.from = value;

    else if (field === 'pm_to') data.pm.to = value;

    // No auto-delete here. Checkbox controls existence.

    selectedStudents.set(studentId, data);

    updateStudentStats();

    performAutoSave();

}

/**
 * Immediately removes a student's absence // Added "Return" logic
 */
window.removeStudentAbsence = async function (studentId) {
    if (selectedStudents.has(String(studentId))) {
        // البحث عن الـ checkbox الخاص بالتلميذ في واجهة الجدول الحالية لتحديث الشكل مباشرة
        const wrapper = document.getElementById('students-grid-wrapper');
        let checkboxFound = false;

        if (wrapper) {
            const checkboxes = wrapper.querySelectorAll('.absence-checkbox');
            for (let chk of checkboxes) {
                const onchangeAttr = chk.getAttribute('onchange');
                if (onchangeAttr && onchangeAttr.includes(`'${studentId}'`)) {
                    // تفريغ الصندوق واستدعاء دالة التحديث الديناميكية
                    chk.checked = false;
                    await toggleStudentAbsence(String(studentId), chk);
                    checkboxFound = true;
                    break;
                }
            }
        }

        // كإجراء احتياطي إذا لم يكن العنصر موجوداً في الـ DOM (مثلا في صفحة أخرى من Pagination)
        if (!checkboxFound) {
            selectedStudents.delete(String(studentId));
            if (typeof updateStudentStats === 'function') updateStudentStats();
            if (typeof performAutoSave === 'function') performAutoSave();
        }

        if (typeof saveSavedAbsenceData === 'function') await saveSavedAbsenceData();
        if (typeof showToast === 'function') showToast('تم التراجع عن الغياب بنجاح', 'success');
    }
};

/**
 * Toggle student absence (Checkbox handler)
 */

async function toggleStudentAbsence(studentId, checkbox) {

    const row = checkbox.closest('tr');

    const details = row.querySelectorAll('.absence-details');

    if (checkbox.checked) {

        // Get dynamic defaults

        const amTimes = getPeriodTimes('AM');

        const pmTimes = getPeriodTimes('PM');

        // Defaults: Start = index 1 (first after Present), End = last index

        let amDefaultFrom = amTimes.length > 1 ? amTimes[1] : '08:00';

        let amDefaultTo = amTimes.length > 1 ? amTimes[amTimes.length - 1] : '12:00';

        let pmDefaultFrom = pmTimes.length > 1 ? pmTimes[1] : '13:00';

        let pmDefaultTo = pmTimes.length > 1 ? pmTimes[pmTimes.length - 1] : '17:00';

        // Check Schedule Settings override
        const currentDate = document.getElementById('absenceDate').value;
        if (window.getScheduleForDate) {
            const dailySchedule = window.getScheduleForDate(currentDate);
            if (dailySchedule) {
                // Use settings if present, otherwise fallback (or '-' if empty string which means configured as empty)
                // Actually, if settings exist, we should probably stick to them.
                // If user sets empty, they want empty.
                amDefaultFrom = dailySchedule.am_from || amDefaultFrom;
                amDefaultTo = dailySchedule.am_to || amDefaultTo;

                // For PM, specifically handle empty string as '-'
                pmDefaultFrom = dailySchedule.pm_from !== '' ? dailySchedule.pm_from : '-';
                pmDefaultTo = dailySchedule.pm_to !== '' ? dailySchedule.pm_to : '-';

                // Also handle AM empty if needed, but usually AM exists
                if (dailySchedule.am_from === '') amDefaultFrom = '-';
                if (dailySchedule.am_to === '') amDefaultTo = '-';
            }
        }

        // Add with defaults

        selectedStudents.set(studentId, {

            am: { from: amDefaultFrom, to: amDefaultTo },

            pm: { from: pmDefaultFrom, to: pmDefaultTo },

            reason: '',

            confirmed: true // Auto-confirm by default

        });

        row.classList.add('selected');

        // Show details
        details.forEach(el => {
            el.style.maxHeight = '150px';
            el.style.opacity = '1';
            el.style.marginTop = '5px';

            // Sync the dropdowns with the calculated default values so the UI reflects the state
            const amFromSelect = el.querySelector('select[onchange*="am_from"]');
            if (amFromSelect) amFromSelect.value = amDefaultFrom;

            const amToSelect = el.querySelector('select[onchange*="am_to"]');
            if (amToSelect) amToSelect.value = amDefaultTo;

            const pmFromSelect = el.querySelector('select[onchange*="pm_from"]');
            if (pmFromSelect) pmFromSelect.value = pmDefaultFrom;

            const pmToSelect = el.querySelector('select[onchange*="pm_to"]');
            if (pmToSelect) pmToSelect.value = pmDefaultTo;
        });

        // Dynamically inject Return button if it doesn't exist yet
        const checkContainer = checkbox.parentElement;
        if (checkContainer && !checkContainer.querySelector('.return-btn')) {
            const btnStr = `<button class="btn btn-sm return-btn" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem; font-weight:bold;" onclick="removeStudentAbsence('${studentId}')" title="إلغاء الغياب">🔄 العودة</button>`;
            checkContainer.insertAdjacentHTML('beforeend', btnStr);
        }

    } else {

        selectedStudents.delete(studentId);

        row.classList.remove('selected');

        // Dynamically remove Return button if it exists
        const checkContainer = checkbox.parentElement;
        if (checkContainer) {
            const btn = checkContainer.querySelector('.return-btn');
            if (btn) btn.remove();
        }

        // Hide details

        details.forEach(el => {

            el.style.maxHeight = '0';

            el.style.opacity = '0';

            el.style.overflow = 'hidden';

            el.style.marginTop = '0';

            el.style.padding = '0';

        });

    }

    updateStudentStats();
    performAutoSave();

    // Dynamically update the Consecutive Streak Badge in the row without full redraw
    // Search within the row first, then fallback to document-level search
    let streakBadge = row ? row.querySelector('[class*="streak-badge-"]') : null;
    if (!streakBadge) {
        try { streakBadge = document.querySelector(`.streak-badge-${CSS.escape ? CSS.escape(studentId) : studentId}`); } catch (e) { }
    }

    if (streakBadge) {
        if (!checkbox.checked) {
            // Student is no longer absent — streak is immediately 0
            streakBadge.innerHTML = `0`;
        } else {
            const currentDate = document.getElementById('absenceDate').value;
            const records = await getCachedAbsenceRecords();
            const count = window.calculateConsecutiveDays ? window.calculateConsecutiveDays(studentId, currentDate, records, true) : 0;

            if (count > 0) {
                streakBadge.innerHTML = `<span style="font-weight:bold; color:red; font-size: 0.85rem;">${count}</span>`;
            } else {
                streakBadge.innerHTML = `0`;
            }
        }
    }
}

/**

 * Quick add button handler (keep for specific use case or remove?)

 * Assuming the '+' button was for something else?

 */

function addQuickAbsence(studentId) {

    // Maybe just check checks value?

    const checkbox = document.querySelector(`tr[data-student-id="${studentId}"] .absence-checkbox`);

    if (checkbox && !checkbox.checked) {

        checkbox.checked = true;

        toggleStudentAbsence(studentId, checkbox);

    }

}

/**
 * Import yesterday's absences to today
 */
function _importToast(msg, type) {
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: type === 'error' ? 'error' : (type === 'warning' ? 'warning' : 'info'),
            text: msg,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
    } else {
        alert(msg);
    }
}

/**
 * Open the enhanced import modal
 */
window.openImportModal = function () {
    const currentDateStr = document.getElementById('absenceDate').value;
    if (!currentDateStr) {
        _importToast('الرجاء تحديد تاريخ اليوم أولاً', 'error');
        return;
    }

    // Default to yesterday
    const d = new Date(currentDateStr);
    d.setDate(d.getDate() - 1);
    document.getElementById('importDateInput').value = d.toISOString().split('T')[0];

    // Reset validation msg
    const msg = document.getElementById('importValidationMsg');
    if (msg) {
        msg.style.display = 'none';
        msg.innerHTML = '';
    }

    if (typeof openModal === 'function') openModal('importAbsencesModal');
};

/**
 * Set a quick date relative to current today's date
 */
window.setQuickImportDate = function (days) {
    const currentDateStr = document.getElementById('absenceDate').value;
    if (!currentDateStr) return;

    const d = new Date(currentDateStr);
    d.setDate(d.getDate() - days);
    const dateInput = document.getElementById('importDateInput');
    if (dateInput) dateInput.value = d.toISOString().split('T')[0];
};

/**
 * Perform the actual import process
 */
window.confirmAbsenceImport = async function () {
    const dateInput = document.getElementById('importDateInput');
    const selectedDate = dateInput ? dateInput.value : '';
    const todayStr = document.getElementById('absenceDate').value;

    // 1. Validations
    if (!selectedDate) {
        _importToast('الرجاء اختيار تاريخ صالح', 'error');
        return;
    }

    const selDateObj = new Date(selectedDate);
    const todayObj = new Date(todayStr);

    if (selDateObj > todayObj) {
        _importToast('لا يمكن استيراد غيابات من تاريخ في المستقبل', 'error');
        return;
    }

    if (selectedDate === todayStr) {
        _importToast('لا يمكن استيراد غيابات نفس اليوم', 'warning');
        return;
    }

    // 2. Fetch data
    const currentPeriod = document.getElementById('periodSelect') ? document.getElementById('periodSelect').value : 'ALL';
    const record = await DB.getDayAbsences(selectedDate, currentPeriod);

    if (!record || !record.students || record.students.length === 0) {
        _importToast(`لا توجد غيابات مسجلة لتاريخ (${selectedDate})`, 'info');
        return;
    }

    // 3. User Confirmation with Date details
    const confirmResult = await Swal.fire({
        title: 'تأكيد الاستيراد',
        html: `هل أنت متأكد من استيراد <b>${record.students.length}</b> غيابات من يوم <b>${selectedDate}</b> لليوم؟`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'نعم، استورد الآن',
        cancelButtonText: 'إلغاء'
    });

    if (!confirmResult.isConfirmed) return;

    // 4. Processing
    let importedCount = 0;
    let skippedCount = 0;

    record.students.forEach(s => {
        const sId = String(s.id);

        // Prevent duplicate if already in current selection
        if (selectedStudents.has(sId)) {
            skippedCount++;
            return;
        }

        // Apply defaults or inherited values
        let amDefF = '08:00', amDefT = '12:00', pmDefF = '13:00', pmDefT = '17:00';
        if (window.getScheduleForDate) {
            const sched = window.getScheduleForDate(todayStr);
            if (sched) {
                amDefF = sched.am_from || amDefF;
                amDefT = sched.am_to || amDefT;
                pmDefF = sched.pm_from !== '' ? sched.pm_from : '-';
                pmDefT = sched.pm_to !== '' ? sched.pm_to : '-';
            }
        }

        selectedStudents.set(sId, {
            am: s.am || { from: amDefF, to: amDefT },
            pm: s.pm || { from: pmDefF, to: pmDefT },
            reason: s.reason || '',
            confirmed: true
        });

        if (!window.studentReasons) window.studentReasons = new Map();
        window.studentReasons.set(sId, s.reason || '');

        importedCount++;
    });

    // 5. Save and Refresh
    await saveSavedAbsenceData();
    if (typeof closeModal === 'function') closeModal('importAbsencesModal');

    if (typeof loadStudentsTable === 'function') loadStudentsTable();
    if (typeof updateStudentStats === 'function') updateStudentStats();

    // 6. Outcome Summary
    Swal.fire({
        title: 'اكتملت العملية 🎉',
        html: `<div style="text-align: right; direction: rtl;">
                تم استيراد <b>${importedCount}</b> تلميذ(ة) غائب بنجاح.<br>
                تم تجاهل <b>${skippedCount}</b> (موجودون مسبقاً في قائمة اليوم).
               </div>`,
        icon: 'success',
        confirmButtonText: 'حسناً'
    });
};

/**

 * Update student stats

 * Shows: institution total â†’ level total â†’ class total based on selection

 */

function updateStudentStats() {

    const level = document.getElementById('levelSelect').value;

    const classNum = document.getElementById('classSelect').value;

    const streamSelect = document.getElementById('streamSelect');
    const selectedStream = (streamSelect && streamSelect.style.display !== 'none') ? streamSelect.value : '';

    let total = 0;

    let filteredStudents = [];

    if (level && classNum) {

        // Both level and class selected - show class total

        filteredStudents = allStudents.filter(s => matchLevel(s.level, level) && String(s.class) === String(classNum));

        // Also filter by stream if selected
        if (selectedStream) {
            filteredStudents = filteredStudents.filter(s => s.stream === selectedStream);
        }

    } else if (level) {

        // Only level selected - show level total

        filteredStudents = allStudents.filter(s => matchLevel(s.level, level));

        // Also filter by stream if selected
        if (selectedStream) {
            filteredStudents = filteredStudents.filter(s => s.stream === selectedStream);
        }

    } else {

        // Nothing selected - show institution total

        filteredStudents = allStudents;

    }

    total = filteredStudents.length;

    // Count absent students from the filtered set

    let absent = 0;

    filteredStudents.forEach(student => {

        const studentId = String(student.id || `${student.last_name}-${student.first_name}`);

        if (selectedStudents.has(studentId)) {

            absent++;

        }

    });

    const present = total - absent;

    document.getElementById('totalStudents').textContent = total;

    document.getElementById('absentStudents').textContent = absent;

    document.getElementById('presentStudents').textContent = present;

}

/**

 * Render teachers table

 */

/**

 * Render teachers table

 */

let teachersGridInstance = null;

function renderTeachersTable() {
    const wrapper = document.getElementById('teachers-grid-wrapper');
    if (!wrapper) return;

    const searchTerm = document.getElementById('teacherSearch') ? document.getElementById('teacherSearch').value.toLowerCase() : '';
    let filteredTeachers = allTeachers;

    if (searchTerm) {
        filteredTeachers = filteredTeachers.filter(t => {
            const fullName = `${t.last_name || ''} ${t.first_name || ''}`.toLowerCase();
            const subject = (t.subject || '').toLowerCase();
            return fullName.includes(searchTerm) || subject.includes(searchTerm);
        });
    }

    if (filteredTeachers.length === 0) {
        if (teachersGridInstance) {
            try { teachersGridInstance.destroy(); } catch (e) { }
            teachersGridInstance = null;
        }
        wrapper.innerHTML = `<div style="padding: 20px; text-align: center; color: #999;">
            <div style="font-size: 2.5rem; margin-bottom: 10px; opacity: 0.5;">👨‍🏫</div>
            <p>${allTeachers.length === 0 ? 'لا يوجد أساتذة. قم بإضافة الأساتذة من صفحة إدارة الأساتذة.' : 'لا يوجد أساتذة يطابقون البحث.'}</p>
        </div>`;
        updateTeacherStats();
        return;
    }

    const data = filteredTeachers.map((teacher, index) => {
        const teacherId = teacher.id || `${teacher.last_name}-${teacher.first_name}`;
        const isSelected = selectedTeachers.has(teacherId);
        const teacherData = selectedTeachers.get(teacherId) || {};

        let typeDisplay = '-';
        if (isSelected) {
            if (teacherData.type === 'full') typeDisplay = 'يوم كامل';
            else if (teacherData.type === 'partial') typeDisplay = `${teacherData.periods ? teacherData.periods.length : 0} حصص`;
            else if (teacherData.type === 'late') typeDisplay = `تأخر (${teacherData.lateDuration || 0} د)`;
        }

        const actionHtml = `
            <button class="btn btn-sm ${isSelected ? 'btn-danger' : 'btn-outline-primary'}"
                    onclick="openTeacherAbsenceModal('${teacherId}')">
                ${isSelected ? 'تعديل الغياب' : 'تسجيل غياب'}
            </button>
            ${isSelected ? `<button class="btn btn-sm btn-outline-secondary" onclick="removeTeacherAbsence('${teacherId}')" title="حذف الغياب">❌</button>` : ''}
        `;

        return [
            index + 1,
            `${teacher.last_name || ''} ${teacher.first_name || ''}`,
            teacher.subject || '',
            gridjs.html(actionHtml),
            typeDisplay,
            teacherData.reason || '-'
        ];
    });

    const columns = [
        { id: 'col_idx', name: '#', width: '60px' },
        { id: 'col_name', name: 'الاسم الكامل', width: '250px' },
        { id: 'col_subj', name: 'المادة', width: '150px' },
        { id: 'col_absent', name: 'غائب / تسجيل', width: '150px', sort: false },
        { id: 'col_duration', name: 'المدة', width: '100px', sort: false },
        { id: 'col_reason', name: 'السبب', width: '150px', sort: false }
    ];

    // Always destroy and recreate to avoid Grid.js pipeline cache corruption
    if (teachersGridInstance) {
        try { teachersGridInstance.destroy(); } catch (e) { }
        teachersGridInstance = null;
    }
    wrapper.innerHTML = '';

    teachersGridInstance = new gridjs.Grid({
        columns: columns,
        data: data,
        search: false,
        sort: true,
        pagination: {
            limit: 20,
            summary: true
        },
        language: {
            search: { placeholder: 'بحث عن أستاذ...' },
            pagination: {
                previous: 'السابق',
                next: 'التالي',
                navigate: (page, pages) => `صفحة ${page} من ${pages}`,
                page: (page) => `صفحة ${page}`,
                showing: 'عرض',
                of: 'من',
                to: 'إلى',
                results: 'نتائج'
            }
        },
        className: {
            table: 'absence-table',
            thead: 'thead-light'
        },
        style: {
            table: { width: '100%' },
            td: { textAlign: 'center', verticalAlign: 'middle' },
            th: { textAlign: 'center' }
        }
    }).render(wrapper);

    // Icon consistency for Windows 7
    teachersGridInstance.on('render', () => {
        if (typeof IconManager !== 'undefined') IconManager.render();
    });

    updateTeacherStats();
}

function toggleTeacherAbsence(teacherId, checkbox) {

    const row = checkbox.closest('tr');

    const typeSelect = document.getElementById(`type-${teacherId}`);

    const reasonInput = document.getElementById(`reason-teacher-${teacherId}`);

    if (checkbox.checked) {

        selectedTeachers.set(teacherId, { type: 'حصة', reason: '' });

        row.classList.add('selected');

        typeSelect.disabled = false;

        reasonInput.disabled = false;

    } else {

        selectedTeachers.delete(teacherId);

        row.classList.remove('selected');

        typeSelect.disabled = true;

        reasonInput.disabled = true;

    }

    updateTeacherStats();

    performAutoSave(); // Auto-save

}

/**

 * Update teacher absence type

 */

function updateTeacherType(teacherId, type) {

    if (selectedTeachers.has(teacherId)) {

        const data = selectedTeachers.get(teacherId);

        data.type = type;

        selectedTeachers.set(teacherId, data);

        performAutoSave(); // Auto-save

    }

}

/**

 * Update teacher absence reason

 */

function updateTeacherReason(teacherId, reason) {

    if (selectedTeachers.has(teacherId)) {

        const data = selectedTeachers.get(teacherId);

        data.reason = reason;

        selectedTeachers.set(teacherId, data);

        performAutoSave(); // Auto-save

    }

}

/**

 * Select all teachers

 */

function selectAllTeachers() {

    document.querySelectorAll('#teachersTableBody .absence-checkbox').forEach(checkbox => {

        if (!checkbox.checked) {

            checkbox.checked = true;

            checkbox.dispatchEvent(new Event('change'));

        }

    });

    performAutoSave(); // Auto-save

}

/**

 * Deselect all teachers

 */

function deselectAllTeachers() {

    document.querySelectorAll('#teachersTableBody .absence-checkbox').forEach(checkbox => {

        if (checkbox.checked) {

            checkbox.checked = false;

            checkbox.dispatchEvent(new Event('change'));

        }

    });

    performAutoSave(); // Auto-save

}

/**

 * Filter teachers table

 */

function filterTeachersTable() {
    renderTeachersTable();
}

/**

 * Update teacher stats

 */

function updateTeacherStats() {

    document.getElementById('totalTeachers').textContent = allTeachers.length;

    document.getElementById('absentTeachers').textContent = selectedTeachers.size;

}

/**

 * Render supervisors/administrators table

 */

let supervisorsGridInstance = null;

function renderSupervisorsTable() {
    const wrapper = document.getElementById('supervisors-grid-wrapper');
    if (!wrapper) return;

    if (allSupervisors.length === 0) {
        if (supervisorsGridInstance) {
            try { supervisorsGridInstance.destroy(); } catch (e) { }
            supervisorsGridInstance = null;
        }
        wrapper.innerHTML = `<div style="padding: 20px; text-align: center; color: #999;">
             <div style="font-size: 2.5rem; margin-bottom: 10px; opacity: 0.5;">👔</div>
             <p>لا يوجد مشرفين/إداريين. استورد من Excel أو أضف يدوياً.</p>
         </div>`;
        updateSupervisorStats();
        return;
    }

    const data = allSupervisors.map((supervisor, index) => {
        const supId = supervisor.id || supervisor.name;
        const isSelected = selectedSupervisors.has(supId);

        // Handle both object and legacy string format
        let rawData = selectedSupervisors.get(supId);
        let reason = '';
        let period = 'FULL'; // Default

        if (rawData) {
            if (typeof rawData === 'string') {
                reason = rawData;
            } else {
                reason = rawData.reason || '';
                period = rawData.period || 'FULL';
            }
        }

        const roleSelectHtml = `
            <select class="period-select" style="width: 100%; box-sizing: border-box; min-width: 0; padding: 5px; font-size: 0.9rem;"
                    onchange="updateSupervisorRole('${supId}', this.value)">
                <option value="supervisor" ${(!supervisor.role || supervisor.role === 'supervisor') ? 'selected' : ''}>مشرف تربية</option>
                <option value="agent" ${supervisor.role === 'agent' ? 'selected' : ''}>عون مصلحة</option>
                <option value="/" ${supervisor.role === '/' ? 'selected' : ''}>/</option>
            </select>
        `;

        const checkHtml = `
            <input type="checkbox" class="absence-checkbox"
                   onchange="toggleSupervisorAbsence('${supId}', this)"
                   ${isSelected ? 'checked' : ''}>
        `;

        let partialDisplay = period === 'PARTIAL' ? 'block' : 'none';
        let fullTimeOptsFrom = getAbsenceTimeOptions('FULL', rawData ? rawData.from : '08:00', false);
        let fullTimeOptsTo = getAbsenceTimeOptions('FULL', rawData ? rawData.to : '17:00', true);

        // Use a wrapper to hold both the select and the time inputs
        const periodSelectHtml = `
            <div style="display: flex; flex-direction: column; gap: 5px; width: 100%;">
                <select class="period-select" style="width: 100%; box-sizing: border-box; min-width: 0; padding: 5px; font-size: 0.9rem;"
                        id="period-sup-${supId}"
                        onchange="updateSupervisorPeriod('${supId}', this.value)"
                        ${!isSelected ? 'disabled' : ''}>
                    <option value="FULL" ${period === 'FULL' ? 'selected' : ''}>يوم كامل</option>
                    <option value="AM" ${period === 'AM' ? 'selected' : ''}>صباح</option>
                    <option value="PM" ${period === 'PM' ? 'selected' : ''}>مساء</option>
                    <option value="PARTIAL" ${period === 'PARTIAL' ? 'selected' : ''}>غياب جزئي</option>
                    <option value="LATE" ${period === 'LATE' ? 'selected' : ''}>تأخر</option>
                </select>
                <div id="time-inputs-sup-${supId}" style="display: ${period === 'PARTIAL' ? 'block' : 'none'}; background: transparent; padding: 2px 0; width: 100%; box-sizing: border-box; overflow: hidden;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; font-size: 0.8rem; width: 100%;">
                        <span style="font-weight: 600; font-size: 0.75rem;">من:</span>
                        <input type="time" class="supervisor-time-select" onchange="updateSupervisorTime('${supId}', 'from', this.value)" value="${rawData && rawData.from ? rawData.from : '08:00'}" style="width: 75% !important; padding: 2px 4px !important; border: 1px solid #bdc3c7; border-radius: 4px; font-family: inherit;">
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; width: 100%;">
                        <span style="font-weight: 600; font-size: 0.75rem;">إلى:</span>
                        <input type="time" class="supervisor-time-select" onchange="updateSupervisorTime('${supId}', 'to', this.value)" value="${rawData && rawData.to ? rawData.to : '10:00'}" style="width: 75% !important; padding: 2px 4px !important; border: 1px solid #bdc3c7; border-radius: 4px; font-family: inherit;">
                    </div>
                </div>
                <div id="late-inputs-sup-${supId}" style="display: ${period === 'LATE' ? 'block' : 'none'}; background: transparent; padding: 2px 0; width: 100%; box-sizing: border-box;">
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; width: 100%;">
                        <span style="font-weight: 600; font-size: 0.75rem; white-space: nowrap;">المدة (د):</span>
                        <input type="number" class="supervisor-time-select"
                               value="${rawData && rawData.lateDuration ? rawData.lateDuration : ''}"
                               onchange="updateSupervisorLateDuration('${supId}', this.value)"
                               placeholder="د"
                               style="width: 60% !important; height: 24px !important; padding: 0 4px !important;">
                    </div>
                </div>
            </div>
        `;

        const reasonHtml = `
            <input type="text" class="reason-select" style="width: 100%; box-sizing: border-box; min-width: 0; padding: 5px; font-size: 0.9rem;"
                   id="reason-sup-${supId}"
                   placeholder="السبب (اختياري)"
                   value="${reason}"
                   onchange="updateSupervisorReason('${supId}', this.value)"
                   ${!isSelected ? 'disabled' : ''}>
        `;

        const actionHtml = `<button class="btn btn-danger btn-sm" onclick="deleteSupervisor('${supId}')">🗑️</button>`;

        return [
            index + 1,
            supervisor.name || '',
            gridjs.html(roleSelectHtml),
            supervisor.rank || '-',
            gridjs.html(checkHtml),
            gridjs.html(periodSelectHtml),
            gridjs.html(reasonHtml),
            gridjs.html(actionHtml)
        ];
    });

    const columns = [
        { id: 'col_idx', name: '#', width: '50px' },
        { id: 'col_name', name: 'الاسم الكامل', width: '180px' },
        { id: 'col_func', name: 'الوظيفة', width: '130px', sort: false },
        { id: 'col_rank', name: 'الرتبة / السبب', width: '120px' },
        { id: 'col_absent', name: 'غائب', width: '70px', sort: false },
        { id: 'col_duration', name: 'المدة', width: '150px', sort: false },
        { id: 'col_note', name: 'ملاحظات', width: '210px', sort: false },
        { id: 'col_delete', name: 'حذف', width: '60px', sort: false }
    ];

    // Always destroy and recreate to avoid Grid.js pipeline cache corruption
    if (supervisorsGridInstance) {
        try { supervisorsGridInstance.destroy(); } catch (e) { }
        supervisorsGridInstance = null;
    }
    wrapper.innerHTML = '';

    supervisorsGridInstance = new gridjs.Grid({
        columns: columns,
        data: data,
        search: false,
        sort: true,
        pagination: {
            limit: 20,
            summary: true
        },
        language: {
            search: { placeholder: 'بحث عن مشرف...' },
            pagination: {
                previous: 'السابق',
                next: 'التالي',
                navigate: (page, pages) => `صفحة ${page} من ${pages}`,
                page: (page) => `صفحة ${page}`,
                showing: 'عرض',
                of: 'من',
                to: 'إلى',
                results: 'نتائج'
            }
        },
        className: {
            table: 'absence-table',
            thead: 'thead-light'
        },
        style: {
            table: { width: '100%' },
            td: { textAlign: 'center', verticalAlign: 'middle' },
            th: { textAlign: 'center' }
        }
    }).render(wrapper);

    // Icon consistency for Windows 7
    supervisorsGridInstance.on('render', () => {
        if (typeof IconManager !== 'undefined') IconManager.render();
    });

    updateSupervisorStats();
}

function toggleSupervisorAbsence(supId, checkbox) {

    const row = checkbox.closest('tr');

    const periodSelect = document.getElementById(`period-sup-${supId}`);

    const reasonInput = document.getElementById(`reason-sup-${supId}`);

    if (checkbox.checked) {

        // Initialize with defaults

        selectedSupervisors.set(supId, { period: 'FULL', reason: '' });

        row.classList.add('selected');

        periodSelect.disabled = false;

        reasonInput.disabled = false;

    } else {

        selectedSupervisors.delete(supId);

        row.classList.remove('selected');

        periodSelect.disabled = true;

        reasonInput.disabled = true;

        periodSelect.value = 'FULL'; // Reset UI

        reasonInput.value = '';

    }

    updateSupervisorStats();

    saveSavedAbsenceData(); // Auto-save

}

/**

 * Update supervisor reason

 */

function updateSupervisorReason(supId, reason) {

    if (selectedSupervisors.has(supId)) {

        const data = selectedSupervisors.get(supId);

        // Ensure data is object

        if (typeof data === 'string') {

            selectedSupervisors.set(supId, { period: 'FULL', reason: reason });

        } else {

            data.reason = reason;

            selectedSupervisors.set(supId, data);

        }

        saveSavedAbsenceData();

    }

}

/**

 * Update supervisor period

 */

function updateSupervisorLateDuration(supId, value) {
    if (selectedSupervisors.has(supId)) {
        const data = selectedSupervisors.get(supId);
        if (typeof data !== 'string') {
            data.lateDuration = value;
            selectedSupervisors.set(supId, data);
            saveSavedAbsenceData();
        }
    }
}

function updateSupervisorPeriod(supId, period) {
    if (selectedSupervisors.has(supId)) {
        const data = selectedSupervisors.get(supId);

        let newData = data;
        if (typeof data === 'string') {
            newData = { period: period, reason: data };
        } else {
            newData.period = period;
        }

        // Initialize default times if partial is selected
        if (period === 'PARTIAL' && !newData.from) {
            let defaultFrom = '08:00';
            let defaultTo = '10:00';

            if (window.getScheduleForDate) {
                const dateInput = document.getElementById('absenceDate');
                const sched = window.getScheduleForDate(dateInput ? dateInput.value : '');
                if (sched && sched.am_from) {
                    defaultFrom = sched.am_from;
                    const h = parseInt(defaultFrom.split(':')[0]);
                    const m = defaultFrom.split(':')[1];
                    defaultTo = `${String(h + 2).padStart(2, '0')}:${m}`;
                }
            }

            newData.from = defaultFrom;
            newData.to = defaultTo;
        }

        selectedSupervisors.set(supId, newData);

        const timeInputs = document.getElementById(`time-inputs-sup-${supId}`);
        if (timeInputs) {
            timeInputs.style.display = period === 'PARTIAL' ? 'block' : 'none';
        }

        const lateInputs = document.getElementById(`late-inputs-sup-${supId}`);
        if (lateInputs) {
            lateInputs.style.display = period === 'LATE' ? 'block' : 'none';
        }

        saveSavedAbsenceData();
    }
}

function updateSupervisorTime(supId, type, value) {
    if (selectedSupervisors.has(supId)) {
        const data = selectedSupervisors.get(supId);
        if (typeof data !== 'string') {
            data[type] = value;
            selectedSupervisors.set(supId, data);
            saveSavedAbsenceData();
        }
    }
}

/**

 * Filter supervisors table

 */

function filterSupervisorsTable() {

    const search = document.getElementById('supervisorSearch').value.toLowerCase();

    const rows = document.querySelectorAll('#supervisorsTableBody tr[data-supervisor-id]');

    rows.forEach(row => {

        const text = row.textContent.toLowerCase();

        row.style.display = text.includes(search) ? '' : 'none';

    });

}

// Helper to update supervisor role

async function updateSupervisorRole(supId, newRole) {

    const supervisor = allSupervisors.find(s => (s.id || s.name) === supId);

    if (supervisor) {

        supervisor.role = newRole;

        await DB.set('supervisorsList', allSupervisors);

        updateSupervisorStats(); // Update stats if they depend on role, or just to be safe

    }

}

/**

 * Update supervisor stats

 */

function updateSupervisorStats() {

    document.getElementById('totalSupervisors').textContent = allSupervisors.length;

    document.getElementById('absentSupervisors').textContent = selectedSupervisors.size;

}

/**

 * Add supervisor modal

 */

function addSupervisor() {

    document.getElementById('supervisorName').value = '';

    document.getElementById('supervisorModal').classList.add('active');

}

/**

 * Save new supervisor

 */

async function saveSupervisor() {

    const name = document.getElementById('supervisorName').value.trim();

    if (!name) {

        showToast('الرجاء إدخال اسم المشرف', 'error');

        return;

    }

    // Check for duplicate

    if (allSupervisors.some(s => s.name === name)) {

        showToast('هذا المشرف موجود بالفعل', 'error');

        return;

    }

    // Add supervisor

    const newSupervisor = {

        id: Date.now().toString(),

        name: name

    };

    allSupervisors.push(newSupervisor);

    await DB.set('supervisorsList', allSupervisors);

    renderSupervisorsTable();

    closeModal('supervisorModal');

    showToast('تم إضافة المشرف بنجاح', 'success');

}

/**
 * Open Supervisor Stats Modal
 */
function openSupervisorStatsModal() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    document.getElementById('supStatsEndDate').valueAsDate = today;
    document.getElementById('supStatsStartDate').valueAsDate = startOfMonth;

    document.getElementById('supervisorStatsModal').classList.add('active');
}

/**
 * Generate Supervisor Stats Report
 */
async function generateSupervisorStatsReport() {
    const startDateVal = document.getElementById('supStatsStartDate').value;
    const endDateVal = document.getElementById('supStatsEndDate').value;

    if (!startDateVal || !endDateVal) {
        showToast('الرجاء تحديد التاريخ من وإلى', 'warning');
        return;
    }

    if (startDateVal > endDateVal) {
        showToast('تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية', 'warning');
        return;
    }

    // 1. Fetch all absence records
    // 1. Fetch absence records for the date range
    const filteredRecords = await DB.getAbsencesRange(startDateVal, endDateVal) || [];

    if (filteredRecords.length === 0) {
        showToast('لا توجد بيانات غيابات للمشرفين في هذه الفترة', 'info');
        return;
    }

    // 2. Process data
    const events = [];
    const perSupervisorMap = new Map(); // supId -> { name, rank, full, late, partial }
    const summary = {
        FULL: 0,
        LATE: 0,
        PARTIAL: 0
    };

    filteredRecords.forEach(record => {
        if (!record.supervisors || record.supervisors.length === 0) return;

        record.supervisors.forEach(s => {
            const supervisor = allSupervisors.find(as => as.id === s.id);
            const name = supervisor ? supervisor.name : (s.name || s.id);
            const rank = supervisor ? (supervisor.rank || '-') : '-';

            if (!perSupervisorMap.has(s.id)) {
                perSupervisorMap.set(s.id, { name: name, rank: rank, full: 0, late: 0, partial: 0 });
            }
            const supStat = perSupervisorMap.get(s.id);

            let typeLabel = '';
            let detail = '';

            const period = s.period || 'FULL';
            if (period === 'FULL' || period === 'AM' || period === 'PM') {
                typeLabel = period === 'FULL' ? 'غياب كلي' : (period === 'AM' ? 'غياب صباحي' : 'غياب مسائي');
                summary.FULL++;
                supStat.full++;
            } else if (period === 'LATE') {
                typeLabel = 'تأخر';
                detail = s.lateDuration ? `${s.lateDuration} د` : '-';
                summary.LATE++;
                supStat.late++;
            } else if (period === 'PARTIAL') {
                typeLabel = 'غياب جزئي';
                detail = (s.from && s.to) ? `${s.from} - ${s.to}` : '-';
                summary.PARTIAL++;
                supStat.partial++;
            }

            events.push({
                date: record.date,
                name: name,
                type: typeLabel,
                detail: detail,
                reason: s.reason || '-'
            });
        });
    });

    if (events.length === 0) {
        showToast('لا توجد غيابات للمشرفين في هذه الفترة', 'info');
        return;
    }

    // 3. Generate Printable Report
    const settings = await DB.get('institutionSettings') || {};
    const formattedStart = new Date(startDateVal).toLocaleDateString('ar-DZ');
    const formattedEnd = new Date(endDateVal).toLocaleDateString('ar-DZ');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('تم حظر النافذة المنبثقة. الرجاء السماح بها.', 'error');
        return;
    }

    // Individual Stats HTML
    let individualStatsHtml = '';
    Array.from(perSupervisorMap.values())
        .sort((a, b) => (b.full + b.late + b.partial) - (a.full + a.late + a.partial))
        .forEach((stat, idx) => {
            individualStatsHtml += `
            <tr>
                <td>${idx + 1}</td>
                <td style="font-weight:bold; text-align:right;">${stat.name}</td>
                <td>${stat.rank}</td>
                <td>${stat.full}</td>
                <td>${stat.late}</td>
                <td>${stat.partial}</td>
                <td style="background:#f9f9f9; font-weight:bold;">${stat.full + stat.late + stat.partial}</td>
            </tr>
        `;
        });

    let eventsHtml = '';
    events.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach((ev, idx) => {
        eventsHtml += `
            <tr>
                <td>${idx + 1}</td>
                <td>${ev.date}</td>
                <td style="font-weight:bold;">${ev.name}</td>
                <td>${ev.type}</td>
                <td>${ev.detail}</td>
                <td>${ev.reason}</td>
            </tr>
        `;
    });

    const reportHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <title>تقرير إحصائيات غيابات المشرفين</title>
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
                    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
                    padding: 20px;
                    color: #333;
                    background: #fff;
                }
                .report-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
                .report-header h3 { margin: 2px 0; font-size: 16px; font-weight: 700; }

                .header-main { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 20px; }

                .header-right { text-align: right; width: 33%; }
                .header-right p { margin: 2px 0; font-size: 12px; font-weight: 700; }

                .header-center { text-align: center; width: 33%; }
                .title-box {
                    border: 2px solid #333;
                    padding: 10px;
                    display: inline-block;
                    font-weight: 700;
                    font-size: 18px;
                    background: #f9f9f9;
                }

                .header-left { text-align: left; width: 33%; }
                .header-left p { margin: 2px 0; font-size: 12px; font-weight: 700; }

                table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; }
                th, td { border: 1px solid #333; padding: 6px; text-align: center; font-size: 13px; }
                th { background-color: #f0f0f0; font-weight: 700; }

                .summary-container { margin-top: 15px; width: 350px; float: right; }
                .footer { margin-top: 50px; display: flex; justify-content: space-between; clear: both; }
                .signature-box { text-align: center; min-width: 200px; }

                h4 { margin-bottom: 10px; border-right: 5px solid #333; padding-right: 10px; margin-top: 25px; font-weight: 700; }
                .date-range { font-size: 13px; margin-top: 5px; font-weight: normal; }
            </style>
        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>
        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
            <div class="report-header">
                <h3>الجمهورية الجزائرية الديمقراطية الشعبية</h3>
                <h3>وزارة التربية الوطنية</h3>

                <div class="header-main">
                    <div class="header-right">
                        <p>مديرية التربية لولاية ${settings.wilaya || '...'}</p>
                        <p>المؤسسة: ${settings.institutionName || '...'}</p>
                    </div>

                    <div class="header-center">
                        <div class="title-box">
                            تقرير إحصائي لغيابات المشرفين
                        </div>
                        <div class="date-range">
                            من: ${formattedStart} إلى: ${formattedEnd}
                        </div>
                    </div>

                    <div class="header-left">
                        <p>السنة الدراسية: ${settings.schoolYear || '2025/2026'}</p>
                        <p>تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-DZ')}</p>
                    </div>
                </div>
            </div>

            <h4>1. قائمة أحداث الغيابات والتأخرات المفصلة:</h4>
            <table>
                <thead>
                    <tr>
                        <th width="5%">#</th>
                        <th width="15%">التاريخ</th>
                        <th width="25%">المشرف(ة)</th>
                        <th width="15%">النوع</th>
                        <th width="15%">التفاصيل</th>
                        <th width="25%">السبب/ملاحظة</th>
                    </tr>
                </thead>
                <tbody>
                    ${eventsHtml}
                </tbody>
            </table>

            <h4>2. إحصائيات كل موظف على حدة:</h4>
            <table>
                <thead>
                    <tr>
                        <th width="5%">#</th>
                        <th width="30%">اسم الموظف(ة)</th>
                        <th width="15%">الرتبة</th>
                        <th width="12%">غياب كلي</th>
                        <th width="12%">تأخر</th>
                        <th width="12%">غياب جزئي</th>
                        <th width="12%">المجموع</th>
                    </tr>
                </thead>
                <tbody>
                    ${individualStatsHtml}
                </tbody>
            </table>

            <div class="summary-container">
                <h4>3. الملخص العام:</h4>
                <table>
                    <tr>
                        <th style="text-align: right;">إجمالي الغيابات الكلية</th>
                        <td style="font-weight:bold;">${summary.FULL}</td>
                    </tr>
                    <tr>
                        <th style="text-align: right;">إجمالي التأخرات</th>
                        <td style="font-weight:bold;">${summary.LATE}</td>
                    </tr>
                    <tr>
                        <th style="text-align: right;">إجمالي الغيابات الجزئية</th>
                        <td style="font-weight:bold;">${summary.PARTIAL}</td>
                    </tr>
                    <tr style="background:#f0f0f0;">
                        <th style="text-align: right;">المجموع الكلي للعمليات</th>
                        <td style="font-weight:bold;">${summary.FULL + summary.LATE + summary.PARTIAL}</td>
                    </tr>
                </table>
            </div>

            <div class="footer">
                <div class="signature-box">
                    <p>حرر بتاريخ: ${new Date().toLocaleDateString('ar-DZ')}</p>
                    <p><strong>المدير(ة)</strong></p>
                </div>
            </div>
        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>
        </html>
    `;

    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.onload = () => {
        printWindow.focus();
        // printWindow.print(); /* Replaced by global Toolbar */ /* Replaced by global Toolbar */
    };

    closeModal('supervisorStatsModal');
}

/**

 * Delete supervisor

 */

async function deleteSupervisor(supId) {

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "هل أنت متأكد من حذف هذا المشرف؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، احذف!',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    allSupervisors = allSupervisors.filter(s => (s.id || s.name) !== supId);

    selectedSupervisors.delete(supId);

    await DB.set('supervisorsList', allSupervisors);

    renderSupervisorsTable();

    showToast('تم حذف المشرف', 'success');

}

/**

 * Clear all supervisors

 */

async function clearAllSupervisors() {

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "هل أنت متأكد من حذف جميع المشرفين/الإداريين؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف الكل!',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    allSupervisors = [];

    selectedSupervisors.clear();

    await DB.set('supervisorsList', allSupervisors);

    renderSupervisorsTable();

    showToast('تم حذف جميع المشرفين/الإداريين', 'success');

}

/**

 * Handle Excel file selection for supervisors/administrators

 * Imports from same format as teachers but excludes ranks starting with "أستاذ" or "عامل"

 */

function handleSupervisorFileSelect(event) {

    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = async function (e) {

        try {

            const data = new Uint8Array(e.target.result);

            const workbook = XLSX.read(data, { type: 'array' });

            // Process first sheet

            const sheetName = workbook.SheetNames[0];

            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON

            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            let importedCount = 0;

            let skippedCount = 0;

            // Start from row 5 (index 4) to skip header row

            for (let i = 4; i < jsonData.length; i++) {

                const row = jsonData[i];

                if (!row || row.length < 6) continue;

                const lastName = row[2] ? String(row[2]).trim() : '';    // Column C (index 2)

                const firstName = row[3] ? String(row[3]).trim() : '';   // Column D (index 3)

                const rank = row[5] ? String(row[5]).trim() : '';        // Column F (index 5)

                // Skip if rank starts with "أستاذ" or "عامل" - we only want supervisors/administrators

                if (rank.startsWith('أستاذ') || rank.startsWith('عامل')) {

                    skippedCount++;

                    continue;

                }

                // Skip empty names

                if (!lastName && !firstName) {

                    skippedCount++;

                    continue;

                }

                // Skip empty rank

                if (!rank) {

                    skippedCount++;

                    continue;

                }

                const fullName = `${lastName} ${firstName}`.trim();

                // Check for duplicates

                if (allSupervisors.some(s => s.name === fullName)) {

                    skippedCount++;

                    continue;

                }

                // Add new supervisor/administrator

                allSupervisors.push({

                    id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),

                    name: fullName,

                    rank: rank

                });

                importedCount++;

            }

            // Save and refresh

            await DB.set('supervisorsList', allSupervisors);

            renderSupervisorsTable();

            if (importedCount > 0) {

                showToast(`تم استيراد ${importedCount} مشرف/إداري بنجاح`, 'success');

            } else {

                showToast(`لم يتم العثور على مشرفين/إداريين (تم تجاوز ${skippedCount} سجل)`, 'error');

            }

        } catch (error) {

            console.error('Error importing file:', error);

            showToast('حدث خطأ أثناء قراءة الملف. تأكد من صحة التنسيق.', 'error');

        }

    };

    reader.readAsArrayBuffer(file);

    event.target.value = ''; // Reset file input

}

/**

 * Save absences

 */

/**

 * Auto-save absences

 * @param {boolean} silent - Whether to show success toast

 */

/**

 * Auto-save absences

 * @param {boolean} silent - Whether to show success toast

 */

async function performAutoSave(silent = true) {

    try {
        setSaveStatus('saving', 'جاري الحفظ التلقائي...');

        await saveSavedAbsenceData();

        // Refresh report log after saving
        if (typeof loadReportLog === 'function') await loadReportLog();

        if (!silent) showToast('تم الحفظ تلقائياً', 'success');

    } catch (e) {

        console.error('Error auto-saving:', e);
        setSaveStatus('error', 'فشل الحفظ التلقائي');

        if (!silent) showToast('خطأ في الحفٍ التلقائي', 'error');

    }

}

/**

 * View saved absences

 */

async function viewSavedAbsences() {

    let absenceRecords = [...await getCachedAbsenceRecords()];

    const container = document.getElementById('savedAbsencesList');

    if (absenceRecords.length === 0) {

        container.innerHTML = '<p style="text-align: center; color: #999;">لا توجد غيابات محفوٍة</p>';

    } else {

        container.innerHTML = absenceRecords

            .sort((a, b) => new Date(b.date) - new Date(a.date))

            .map(record => `

                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 15px; border-right: 4px solid #e74c3c;">

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">

                        <strong>📅 ${record.date} - ${record.period}</strong>

                        <div>

                            <button class="btn btn-primary btn-sm" onclick="loadAbsenceRecord('${record.date}', '${record.period}')">📝 تحرير</button>

                            <button class="btn btn-danger btn-sm" onclick="deleteAbsenceRecord('${record.date}', '${record.period}')">🗑️ حذف</button>

                        </div>

                    </div>

                    <p>👥 التلاميذ: ${record.students?.length || 0} | 👨‍🏫 الأساتذة: ${record.teachers?.length || 0} | 👔 المشرفين: ${record.supervisors?.length || 0}</p>

                </div>

            `).join('');

    }

    document.getElementById('savedAbsencesModal').classList.add('active');

}

/**

 * Load absence record for editing

 */

async function loadAbsenceRecord(date, period) {

    const record = await DB.getDayAbsences(date, period);

    if (!record) return;

    // Set date and period

    document.getElementById('absenceDate').value = date;

    const pagePeriodSelect = document.getElementById('periodSelect');

    if (pagePeriodSelect) {

        pagePeriodSelect.value = period || 'ALL';

    }

    // Clear current selections

    selectedStudents.clear();

    selectedTeachers.clear();

    selectedSupervisors.clear();

    // Load students
    if (record.students) {
        if (!window.studentReasons) window.studentReasons = new Map();
        window.studentReasons.clear();

        record.students.forEach(s => {
            selectedStudents.set(String(s.id), {
                am: s.am || { from: '08:00', to: '12:00' },
                pm: s.pm || { from: '13:00', to: '17:00' },
                reason: s.reason || '',
                confirmed: true
            });
            window.studentReasons.set(s.id, s.reason || '');
        });
    }

    // Load teachers

    record.teachers?.forEach(t => {

        selectedTeachers.set(t.id, {
            type: t.type,
            reason: t.reason,
            periods: t.periods || [],
            periodClasses: t.periodClasses || {},
            hours: t.hours || 0,
            lateDuration: t.lateDuration || 0
        });

    });

    // Load supervisors
    record.supervisors?.forEach(s => {
        if (typeof s.reason === 'string' && !s.period) {
            // Legacy format - Convert to object
            selectedSupervisors.set(s.id, {
                reason: s.reason,
                period: 'FULL',
                from: '',
                to: '',
                lateDuration: ''
            });
        } else {
            selectedSupervisors.set(s.id, {
                reason: s.reason || '',
                period: s.period || 'FULL',
                from: s.from || '',
                to: s.to || '',
                lateDuration: s.lateDuration || ''
            });
        }
    });

    // Refresh tables

    loadStudentsTable();

    renderTeachersTable();

    renderSupervisorsTable();

    closeModal('savedAbsencesModal');
    setSaveStatus('loaded');

    showToast('تم تحميل السجل للتحرير', 'success');

}

/**

 * Delete absence record

 */

async function deleteAbsenceRecord(date, period) {

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "هل أنت متأكد من حذف هذا السجل؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، احذف!',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    await DB.deleteDayAbsences(date, period);
    invalidateAbsenceRecordsCache();
    setSaveStatus('saved', 'تم حذف السجل وحفظ التغييرات');

    viewSavedAbsences();

    // If we just deleted the currently displayed record, clear the form

    const currentDate = document.getElementById('absenceDate').value;

    const currentPeriod = document.getElementById('periodSelect') ? document.getElementById('periodSelect').value : 'ALL';

    if (date === currentDate && period === currentPeriod) {

        selectedStudents.clear();

        selectedTeachers.clear();

        selectedSupervisors.clear();

        if (window.studentReasons) window.studentReasons.clear();

        loadStudentsTable();

        renderTeachersTable();

        renderSupervisorsTable();

        showToast('تم حذف السجل الحالي وتفريغ النموذج', 'info');

    } else {

        showToast('تم حذف السجل', 'success');

    }

}

/**

 * Check and load saved absence for current date/period

 */

async function checkAndLoadSavedAbsence() {

    const date = document.getElementById('absenceDate').value;

    const period = document.getElementById('periodSelect') ? document.getElementById('periodSelect').value : 'ALL';

    if (!date || !period) return;

    const record = await DB.getDayAbsences(date, period);

    if (record) {

        // Found saved record - load it

        console.log('Found saved record for', date, period, 'with', record.students ? record.students.length : 0, 'students');

        // Clear current selections first

        selectedStudents.clear();

        selectedTeachers.clear();

        selectedSupervisors.clear();

        // Load students

        if (record.students) {

            if (!window.studentReasons) window.studentReasons = new Map();

            window.studentReasons.clear();

            record.students.forEach(s => {

                // Ensure ID is string

                selectedStudents.set(String(s.id), {

                    am: s.am || { from: 'Present', to: 'Present' },

                    pm: s.pm || { from: 'Present', to: 'Present' },

                    reason: s.reason || ''

                });

            });

        }

        // ... (teachers/supervisors loading) ...

        // Load teachers

        if (record.teachers) {

            record.teachers.forEach(t => {

                selectedTeachers.set(t.id, {

                    type: t.type,

                    reason: t.reason,

                    periods: t.periods || [], // Restore periods

                    periodClasses: t.periodClasses || {}, // Restore periodClasses

                    hours: t.hours || 0,       // Restore hours

                    lateDuration: t.lateDuration || 0  // Restore delay duration

                });

            });

        }

        // Load supervisors
        if (record.supervisors) {
            record.supervisors.forEach(s => {
                if (typeof s.reason === 'string' && !s.period) {
                    // Legacy format
                    selectedSupervisors.set(s.id, {
                        reason: s.reason,
                        period: 'FULL',
                        from: '',
                        to: '',
                        lateDuration: ''
                    });
                } else {
                    // Object format
                    selectedSupervisors.set(s.id, {
                        reason: s.reason || '',
                        period: s.period || 'FULL',
                        from: s.from || '',
                        to: s.to || '',
                        lateDuration: s.lateDuration || ''
                    });
                }
            });
        }

        console.log('Loaded', selectedStudents.size, 'students,', selectedTeachers.size, 'teachers');

        // Restore report number
        const reportNumberEl = document.getElementById('reportNumber');
        if (reportNumberEl) {
            reportNumberEl.value = (record.report_number !== undefined && record.report_number !== null) ? record.report_number : '';
        }

        updateActionButtonUI(true);
        setSaveStatus('loaded', 'تم تحميل التقرير المحفوظ');

    } else {

        // No record found for CURRENT date/period

        console.log('No saved record for', date, period);

        // Clear first to be safe

        selectedStudents.clear();

        selectedTeachers.clear();

        selectedSupervisors.clear();

        if (window.studentReasons) window.studentReasons.clear();

        // Automatic persistence removed per user request.

        // User must use "Import Previous" button manually.

        showToast('لم يتم العثور على سجلات لهذا اليوم. يمكنك استيراد الغيابات السابقة يدوياً.', 'info');

        // Clear report number
        const reportNumberEl = document.getElementById('reportNumber');
        if (reportNumberEl) reportNumberEl.value = '';

        updateActionButtonUI(false);

    }

    // Refresh tables

    loadStudentsTable();

    renderTeachersTable();

    renderSupervisorsTable();

    // Refresh stats

    updateStudentStats();

    updateTeacherStats();

    updateSupervisorStats();

    // Refresh report log to highlight active report
    loadReportLog();

}

/**

 * Find most recent absence record before the given date

 */

async function findMostRecentRecord(targetDate, currentPeriod) {

    let absenceRecords = await getCachedAbsenceRecords();

    if (absenceRecords.length === 0) return null;

    // Filter candidates

    const candidates = absenceRecords.filter(r => {

        // Exclude current record

        if (r.date === targetDate && r.period === currentPeriod) return false;

        // Exclude future

        if (r.date > targetDate) return false;

        // Exclude empty records (days with no absences recorded)

        if (!r.students || r.students.length === 0) return false;

        return true;

    });

    if (candidates.length === 0) return null;

    // Sort descending

    candidates.sort((a, b) => {

        const dateDiff = b.date.localeCompare(a.date);

        if (dateDiff !== 0) return dateDiff;

        return (b.timestamp || '').localeCompare(a.timestamp || '');

    });

    return candidates[0];

}

// ... (findMostRecentRecord above) ...

/**

 * Calculate the start date of consecutive absence

 */

function calculateAbsenceStartDate(studentId, allRecords, currentDate) {

    let startDate = currentDate;

    // Check previous records

    for (const record of allRecords) {

        // Stop if we went past the start date (safeguard, though strict filter is better)

        if (record.date >= currentDate) continue;

        // Check if student was absent in this record

        const wasAbsent = record.students && record.students.some(s => String(s.id) === String(studentId));

        if (wasAbsent) {

            startDate = record.date; // Extend start date backwards

        } else {

            // Student was present (record exists but student not in it), break chain

            break;

        }

    }

    return startDate;

}

/**

 * Show list of currently absent students

 */

async function showCurrentAbsencesList() {

    if (selectedStudents.size === 0) {

        showToast('لا يوجد تلاميذ غائبين حالياً', 'info');

        const container = document.getElementById('savedAbsencesList');

        if (document.getElementById('savedAbsencesModal').classList.contains('active')) {

            container.innerHTML = '<p style="text-align: center; color: #999;">لا يوجد تلاميذ غائبين حالياً</p>';

        }

        return;

    }

    const container = document.getElementById('savedAbsencesList'); // Re-using modal container

    const modalTitle = document.querySelector('#savedAbsencesModal h3');

    if (modalTitle) modalTitle.textContent = '📋 القائمة الاسمية للتلاميذ الغائبين (حالياً)';

    const currentDate = document.getElementById('absenceDate').value;

    const isSecondary = (window.appSettings.educationStage === 'secondary');

    // Load all records to calculate start dates
    let absenceRecords = [...await getCachedAbsenceRecords()];

    let html = `
        <div class="table-wrapper">
            <table class="absence-table">
                <thead>
                    <tr>
                        <th width="5%">#</th>
                        <th width="${isSecondary ? '20%' : '25%'}">الاسم واللقب</th>
                        <th width="${isSecondary ? '10%' : '15%'}">المستوى</th>
                        ${isSecondary ? '<th width="10%">الشعبة</th>' : ''}
                        <th width="10%">القسم</th>
                        <th width="15%">غائب منذ</th>
                        <th width="15%">السبب</th>
                        <th width="15%">تبرير/حذف</th>
                    </tr>
                </thead>
                <tbody>
    `;

    let i = 1;
    selectedStudents.forEach((data, id) => {
        // Fix: Use same ID generation logic as loadStudentsTable to match keys
        // console.log('Checking ID from Set:', id, 'Type:', typeof id);

        const student = allStudents.find(s => {
            const sId = String(s.id || `${s.last_name}-${s.first_name}`);
            return sId === String(id);
        });

        // Calculate start date
        const startDate = calculateAbsenceStartDate(id, absenceRecords, currentDate);

        if (student) {
            html += `
                <tr>
                    <td>${i++}</td>
                    <td>${student.last_name} ${student.first_name}</td>
                    <td>${student.level}</td>
                    ${isSecondary ? `<td>${getShortStreamName(student.stream)}</td>` : ''}
                    <td>${student.class}</td>
                    <td style="color: #c0392b; font-weight: bold;">${startDate}</td>
                    <td>${data.reason || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="justifyAbsence('${id}')" title="إزالة الغياب (تبرير)">
                            ✔️ تبرير
                        </button>
                    </td>
                </tr>
            `;

        } else {

            // Fallback for missing student data

            html += `

                <tr style="background: #fff0f0;">

                    <td>${i++}</td>

                    <td colspan="${isSecondary ? 4 : 3}" style="color: red;">خطأ: بيانات التلميذ غير موجودة (ID: ${id})</td>

                    <td style="color: #c0392b; font-weight: bold;">${startDate}</td>

                    <td>${data.reason || '-'}</td>

                    <td>

                        <button class="btn btn-sm btn-success" onclick="justifyAbsence('${id}')" title="إزالة الغياب (تبرير)">

                            ✔️ تبرير

                        </button>

                    </td>

                </tr>

            `;

        }

    });

    html += `

                </tbody>

            </table>

        </div>

        <div style="text-align: center; margin-top: 15px;">

             <!-- Simple Print for this view? -->

             <button class="btn btn-primary" onclick="printElement('savedAbsencesList')">🖨️ طباعة القائمة</button>

        </div>

    `;

    container.innerHTML = html;

    document.getElementById('savedAbsencesModal').classList.add('active');

}

/**

 * Manual Import of Previous Absences

 */

// NEW STREAK AUTO-IMPORT FOR SPECIFIC STUDENT
async function openImportStreakModal(studentId, lastName, firstName) {
    const currentDate = document.getElementById('absenceDate').value;
    if (!currentDate) return;

    let absenceRecords = [...await getCachedAbsenceRecords()];

    // Sort records descending by date
    absenceRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Find the most recent record BEFORE currentDate where this student was absent
    let lastAbsenceDate = null;
    let fallbackToReason = '';

    for (const record of absenceRecords) {
        if (new Date(record.date) >= new Date(currentDate)) continue; // skip today and future

        const studentInfo = record.students?.find(s => String(s.id) === String(studentId));
        if (studentInfo) {
            const isAbsent = (studentInfo.am && (studentInfo.am.from !== '-' || studentInfo.am.to !== '-')) ||
                (studentInfo.pm && (studentInfo.pm.from !== '-' || studentInfo.pm.to !== '-'));
            if (isAbsent) {
                lastAbsenceDate = record.date;
                fallbackToReason = studentInfo.reason || '';
                break;
            }
        }
    }

    if (!lastAbsenceDate) {
        Swal.fire({
            icon: 'info',
            title: 'لا يوجد غياب سابق',
            text: `لم يتم العثور على أي غياب مسجل للتلميذ ${lastName} ${firstName} قبل تاريخ اليوم المختـار.`
        });
        return;
    }

    // Calculate all valid school days between lastAbsenceDate and currentDate (exclusive)
    function getBusinessDaysBetween(startDateStr, endDateStr) {
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        start.setDate(start.getDate() + 1); // Exclusive of start date

        const dates = [];
        let cursor = new Date(start);

        // Use custom holidays if available
        const localHolidays = (window.holidayList && window.holidayList.length > 0) ? window.holidayList : [];

        while (cursor < end) {
            const dayOfWeek = cursor.getDay();
            if (dayOfWeek !== 5 && dayOfWeek !== 6) { // Skip Friday/Saturday
                const checkStr = cursor.toISOString().split('T')[0];
                const isHoliday = localHolidays.some(h => checkStr >= h.start && checkStr <= h.end);
                if (!isHoliday) {
                    dates.push(checkStr);
                }
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return dates;
    }

    const missingDates = getBusinessDaysBetween(lastAbsenceDate, currentDate);

    if (missingDates.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'لا توجد أيام ناقصة',
            text: `الغياب السابق للتلميذ ${lastName} ${firstName} كان في ${lastAbsenceDate}، ولا توجد أيام عمل مفقودة بينه وبين التاريخ الحالي.`
        });
        return;
    }

    // Build Modal UI
    let bodyHtml = `<div style="text-align:center; margin-bottom:15px;">
        <h4>التلميذ: ${lastName} ${firstName}</h4>
        <p style="color:#7f8c8d; font-size:0.9rem;">آخر غياب موثق: <b>${lastAbsenceDate}</b></p>
        <p style="color:#2c3e50; font-weight:bold;">الأيام المتتالية المفقودة للتعليم:</p>
    </div>
    <div style="background:#f8f9fa; padding:15px; border-radius:8px; max-height:250px; overflow-y:auto; border:1px solid #e0e0e0;">`;

    missingDates.forEach(dateStr => {
        bodyHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:8px 0;">
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer; width:100%;">
                    <input type="checkbox" class="streak-import-chk" value="${dateStr}" checked style="transform:scale(1.2);">
                    <span style="font-weight:bold; color:#2980b9;">${dateStr}</span>
                </label>
            </div>
        `;
    });

    bodyHtml += `</div>
    <div style="margin-top:15px;">
        <label style="font-size:0.9rem; font-weight:bold;">السبب / الملاحظة (للأيام المحددة):</label>
        <input type="text" id="streakImportReason" class="form-input" style="width:100%; margin-top:5px;" value="${fallbackToReason}">
    </div>`;

    let modalHtml = `
    <div id="importStreakModal" class="modal-overlay active" style="z-index:9999;">
        <div class="modal-content animate-pop-in" style="max-width:400px;">
            <div class="modal-header"><h3>📥 سحب الغياب المستمر</h3></div>
            <div class="modal-body">${bodyHtml}</div>
            <div class="modal-buttons" style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn btn-success" onclick="saveImportedStreak('${studentId}', '${lastName}', '${firstName}')">حفظ الغيابات المحددة</button>
                <button class="btn btn-danger" onclick="document.getElementById('importStreakModal').remove()">إلغاء</button>
            </div>
        </div>
    </div>`;

    // Append to body
    const existing = document.getElementById('importStreakModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.saveImportedStreak = async function (studentId, lastName, firstName) {
    const checkboxes = document.querySelectorAll('.streak-import-chk:checked');
    if (checkboxes.length === 0) {
        document.getElementById('importStreakModal').remove();
        return;
    }

    const reason = document.getElementById('streakImportReason').value;
    const datesToSave = Array.from(checkboxes).map(chk => chk.value);

    let allAbsenceRecords = cloneAbsenceRecords(await getCachedAbsenceRecords());

    // Find full student info from base array map
    const studentInfo = allStudents.find(s => String(s.id) === String(studentId)) || {};

    let modified = false;

    // Apply absence to valid dates
    for (const dStr of datesToSave) {
        let recordIndex = allAbsenceRecords.findIndex(r => r.date === dStr && (!r.period || r.period === 'ALL'));
        if (recordIndex === -1) {
            allAbsenceRecords.push({
                date: dStr,
                period: 'ALL',
                students: [],
                teachers: [],
                supervisors: [],
                canteen: [],
                stats: { total: 0, justified: 0, unjustified: 0 },
                notes: {}
            });
            recordIndex = allAbsenceRecords.length - 1;
        }

        const record = allAbsenceRecords[recordIndex];
        if (!record.students) record.students = [];

        // Remove if existed to prevent duplicate arrays
        record.students = record.students.filter(s => String(s.id) !== String(studentId));

        // Get dynamic times based on Schedule Settings for that specific missing Date
        let amDefaultFrom = '08:00'; let amDefaultTo = '12:00';
        let pmDefaultFrom = '13:00'; let pmDefaultTo = '17:00';

        if (window.getScheduleForDate) {
            const dailySchedule = window.getScheduleForDate(dStr);
            if (dailySchedule) {
                amDefaultFrom = dailySchedule.am_from || amDefaultFrom;
                amDefaultTo = dailySchedule.am_to || amDefaultTo;
                pmDefaultFrom = dailySchedule.pm_from !== '' ? dailySchedule.pm_from : '-';
                pmDefaultTo = dailySchedule.pm_to !== '' ? dailySchedule.pm_to : '-';
                if (dailySchedule.am_from === '') amDefaultFrom = '-';
                if (dailySchedule.am_to === '') amDefaultTo = '-';
            }
        }

        // Add the forced absence entry for the day
        record.students.push({
            id: studentId,
            last_name: lastName || studentInfo.last_name || '',
            first_name: firstName || studentInfo.first_name || '',
            class: studentInfo.class || '',
            level: studentInfo.level || '',
            stream: studentInfo.stream || '',
            reason: reason,
            am: { from: amDefaultFrom, to: amDefaultTo },
            pm: { from: pmDefaultFrom, to: pmDefaultTo }
        });

        modified = true;
    }

    if (modified) {
        // Save each modified record using the new relational API
        for (const rec of allAbsenceRecords) {
            await DB.saveDayAbsences(rec);
        }
        invalidateAbsenceRecordsCache();
        if (typeof showToast === 'function') {
            showToast('✅ تم جلب وحفظ التواريخ الناقصة بنجاح.');
        } else {
            Swal.fire({ icon: 'success', title: 'تم الحفظ', timer: 1500, showConfirmButton: false });
        }

        // Remove modal
        document.getElementById('importStreakModal').remove();

        // Always refresh table visually immediately to reflect the new larger streak
        if (typeof loadStudentsTable === 'function') {
            loadStudentsTable();
        }
    } else {
        document.getElementById('importStreakModal').remove();
    }
};

/**

 * Justify (Remove) Student Absence from the list

 */

async function justifyAbsence(studentId) {

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "هل أنت متأكد من إزالة هذا التلميذ من قائمة الغياب؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، إزالة',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    selectedStudents.delete(studentId);

    // Update stats and save

    updateStudentStats();

    performAutoSave();

    // Refresh the main table (to uncheck boxes if visible)

    loadStudentsTable();

    // Refresh the modal list

    showCurrentAbsencesList();

    showToast('تم تبرير/إزالة الغياب بنجاح', 'success');

}

/**

 * Helper to print specific element

 */

function printElement(elemId) {

    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? ((typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null) : null;
    if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {

        Swal.fire({
            icon: 'info',
            title: 'ميزة غير متاحة',
            text: 'هذه الميزة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.'
        });

        return;

    }

    const content = document.getElementById(elemId).innerHTML;

    const printWindow = window.open('', '_blank');

    printWindow.document.write('<html dir="rtl"><head><title>طباعة قائمة</title>');

    printWindow.document.write('<style>body{font-family:sans-serif;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;text-align:center;} th{background:#eee;}</style>');

    printWindow.document.write(`\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ""}\n        \n${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n</head><body>\n${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ""}`);

    printWindow.document.write('<h3>القائمة الاسمية للغائبين</h3>');

    printWindow.document.write(content);

    printWindow.document.write(`\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ""}\n        \n${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n</body></html>`);

    printWindow.document.close();

    // printWindow.print(); /* Replaced by global Toolbar */ /* Replaced by global Toolbar */

}

/**

 * Save current absence data to local storage

 */

async function saveSavedAbsenceData(isManual = false) {

    const date = document.getElementById('absenceDate').value;

    const period = document.getElementById('periodSelect') ? document.getElementById('periodSelect').value : 'ALL';

    if (!date) return;

    setSaveStatus('saving', isManual ? 'جاري حفظ التقرير...' : 'جاري الحفظ التلقائي...');

    // Prepare data

    const studentsData = [];

    selectedStudents.forEach((data, id) => {

        // Handle Map value

        if (typeof data === 'object') {

            studentsData.push({

                id: id,

                am: data.am,

                pm: data.pm,

                reason: data.reason

            });

        } else {

            // Fallback for legacy ID-only

            studentsData.push({ id: id, reason: '' }); // Or better default

        }

    });

    const teachersData = [];

    selectedTeachers.forEach((data, id) => {

        teachersData.push({

            id: id,

            type: data.type,

            reason: data.reason,

            periods: data.periods,

            periodClasses: data.periodClasses || {},

            hours: data.hours,

            lateDuration: data.lateDuration || 0

        });

    });

    const supervisorsData = [];

    selectedSupervisors.forEach((data, id) => {
        let reason = '';
        let period = 'FULL';
        let from = '';
        let to = '';
        let lateDuration = '';

        if (typeof data === 'string') {
            reason = data;
        } else {
            reason = data.reason;
            period = data.period;
            from = data.from || '';
            to = data.to || '';
            lateDuration = data.lateDuration || '';
        }

        supervisorsData.push({
            id: id,
            reason: reason,
            period: period,
            from: from,
            to: to,
            lateDuration: lateDuration
        });
    });

    // --- Report Number Logic ---
    const reportNumberEl = document.getElementById('reportNumber');
    let report_number = reportNumberEl ? reportNumberEl.value.trim() : '';

    if (isManual) {
        if (!report_number) {
            showToast('يجب إدخال رقم التقرير يدوياً قبل الحفظ', 'error');
            if (reportNumberEl) reportNumberEl.focus();
            return false; // Stop save
        }

        // Check for duplicates in other reports
        const allReports = await getCachedAbsenceRecords();
        const duplicate = allReports.find(r =>
            String(r.report_number) === String(report_number) &&
            !(r.date === date && r.period === period)
        );

        if (duplicate) {
            showToast(`رقم التقرير ${report_number} مستخدم بالفعل في تقرير بتاريخ ${duplicate.date}. يرجى اختيار رقم آخر.`, 'warning');
            if (reportNumberEl) reportNumberEl.focus();
            return false; // Stop save
        }
    }

    const newRecord = {

        date: date,

        period: period,

        students: studentsData,

        teachers: teachersData,

        supervisors: supervisorsData,

        report_number: report_number,

        timestamp: new Date().toISOString()

    };

    // Save using new relational API
    try {
        await DB.saveDayAbsences(newRecord);
        invalidateAbsenceRecordsCache();
    } catch (error) {
        setSaveStatus('error', isManual ? 'فشل حفظ التقرير' : 'فشل الحفظ التلقائي');
        throw error;
    }

    if (isManual) {
        showToast(`تم حفظ التقرير رقم ${report_number} بنجاح`, 'success');
        // Refresh log
        if (typeof loadReportLog === 'function') loadReportLog();
        // Update button to "Save Changes"
        updateActionButtonUI(true);
        setSaveStatus('saved');
    } else {
        setSaveStatus('autosaved');
    }

    return true;
}

/**

 * Generate daily report

 */

async function generateReport() {

    const date = document.getElementById('absenceDate').value;

    const period = document.getElementById('periodSelect') ? document.getElementById('periodSelect').value : 'ALL';

    if (selectedStudents.size === 0 && selectedTeachers.size === 0 && selectedSupervisors.size === 0) {

        showToast('لا يوجد غيابات لإنشاء التقرير', 'error');

        return;

    }

    // Get settings from DB

    const settings = await DB.getSettings();

    const signatureSettings = await DB.get('signatureSettings') || {};

    // Group students by level and class

    const studentsByClass = {};

    selectedStudents.forEach((data, studentId) => {

        const student = allStudents.find(s => (s.id || `${s.last_name}-${s.first_name}`) === studentId);

        if (student) {

            const key = `${student.level} - ${student.class}`;

            if (!studentsByClass[key]) {

                studentsByClass[key] = [];

            }

            // Extract reason from data object

            let reason = '';

            if (typeof data === 'string') reason = 'غير مبرر'; // Legacy fallback

            else reason = data.reason || 'غير مبرر';

            studentsByClass[key].push({
                ...student,
                reason: reason,
                am: typeof data === 'object' ? data.am : null,
                pm: typeof data === 'object' ? data.pm : null
            });

        }

    });

    // Prepare teacher absences for report

    const teacherAbsences = [];

    selectedTeachers.forEach((data, teacherId) => {
        const teacher = allTeachers.find(t => (t.id || `${t.last_name}-${t.first_name}`) === teacherId);
        if (teacher) {
            // Collect class names for display
            let classesAffected = '-';
            let periodDetails = '';
            if (data.periods && data.periods.length > 0) {
                const pSorted = [...data.periods].sort((a, b) => a - b);
                periodDetails = ` (${pSorted.length} حصص: ${pSorted.join('، ')})`;
            }

            if (data.periodClasses) {
                const classes = Object.values(data.periodClasses).filter(v => v);
                if (classes.length > 0) {
                    classesAffected = [...new Set(classes)].join('، ').replace(/متوسط/g, 'م').replace(/ثانوي/g, 'ث');
                }
            }

            teacherAbsences.push({
                name: `${teacher.last_name} ${teacher.first_name}`,
                subject: teacher.subject,
                type: data.type === 'late' ? 'تأخر' : (data.type === 'full' ? 'يوم كامل' : 'جزئي' + periodDetails),
                notes: data.type === 'late' ? `تأخر (${data.lateDuration} د)` : (classesAffected !== '-' ? `الأقسام: ${classesAffected}` : ''),
                reason: data.reason,
                sections: classesAffected
            });
            if (data.type === 'partial' && teacherAbsences.length > 0) {
                teacherAbsences[teacherAbsences.length - 1].notes = classesAffected !== '-'
                    ? `غياب جزئي - ط§ظ„ط£ظ‚ط³ط§ظ…: ${classesAffected}`
                    : 'غياب جزئي';
            }
        }
    });

    // Prepare supervisor absences for report

    const supervisorAbsences = [];

    selectedSupervisors.forEach((data, supId) => {
        const supervisor = allSupervisors.find(s => (s.id || s.name) === supId);
        if (supervisor) {
            let reason = typeof data === 'string' ? data : data.reason;
            let period = typeof data === 'string' ? 'FULL' : data.period;

            let displayReason = reason;
            if (period === 'PARTIAL' && data.from && data.to) {
                displayReason = `${reason ? reason + ' ' : ''}(من ${data.from} إلى ${data.to})`;
            } else if (period === 'LATE' && data.lateDuration) {
                displayReason = `تأخر (${data.lateDuration} د)`;
                if (reason) displayReason += ` - ${reason}`;
            } else if (period === 'AM') {
                displayReason = `صباح - ${reason}`;
            } else if (period === 'PM') {
                displayReason = `مساء - ${reason}`;
            }

            supervisorAbsences.push({
                name: supervisor.name,
                reason: displayReason
            });
        }
    });

    // Format date

    const dateObj = new Date(date);

    const formattedDate = dateObj.toLocaleDateString('ar-DZ', {

        weekday: 'long',

        year: 'numeric',

        month: 'long',

        day: 'numeric'

    });

    // Get signer info

    const signerType = signatureSettings.signerType || 'director';

    const signerGender = signatureSettings.signerGender || 'male';

    let signerTitle = '';

    if (signerType === 'director') {

        signerTitle = signerGender === 'male' ? 'المدير' : 'المديرة';

    } else {

        signerTitle = signerGender === 'male' ? 'الناظر' : 'الناظرة';

    }

    const signerName = signatureSettings.signerName || '';

    // Generate report HTML

    let reportHtml = `

        <div class="report-header">

            <h3>الجمهورية الجزائرية الديمقراطية الشعبية</h3>

            <h3>وزارة التربية الوطنية</h3>

            <div style="display: flex; justify-content: space-between; margin-top: 20px;">

                <div style="text-align: right;">

                    <p>مديرية التربية لولاية ${settings.wilaya || '...'}</p>

                    <p>${settings.institutionName || 'المؤسسة'}</p>

                </div>

                <div style="text-align: left;">

                    <p>السنة الدراسية: ${settings.schoolYear || '2025/2026'}</p>

                </div>

            </div>

            <h2 style="margin-top: 20px;">📋 التقرير اليومي للغيابات</h2>

            <p><strong>التاريخ:</strong> ${formattedDate} | <strong>الفترة:</strong> ${period}</p>

        </div>

    `;

    // Students section

    if (Object.keys(studentsByClass).length > 0) {

        reportHtml += `

            <div class="report-section">

                <h3>👥 غيابات التلاميذ</h3>

        `;

        for (const [classKey, students] of Object.entries(studentsByClass)) {

            reportHtml += `

                <div style="margin-top: 15px; page-break-inside: avoid;">

                <h4 style="margin: 3px 0; border-bottom: 2px solid #ccc; display: inline-block;">${classKey} (${students.length})</h4>

                <table class="report-table">

                    <thead>

                        <tr>

                            <th rowspan="2" width="3%">#</th>

                            <th rowspan="2" width="20%">اللقب والاسم</th>

                            <th rowspan="2" width="10%">القسم</th>

                            <th colspan="2" width="20%">الصباح</th>

                            <th colspan="2" width="20%">المساء</th>

                            <th rowspan="2" width="7%">عدد س</th>

                            <th rowspan="2" width="20%">ملاحظات</th>

                        </tr>

                        <tr>

                            <th>من</th>

                            <th>إلى</th>

                            <th>من</th>

                            <th>إلى</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${students.map((s, i) => {

                // Calculate duration ( rough estimate or just display 'Full Day' etc)

                // For report, usually we just show AM/PM presence.

                // If user wants specific duration, we might need a helper, but for now specific times are good.

                // Let's deduce "Duration" text based on presence.

                let amDuration = (s.am && s.am.from !== s.am.to) ? 4 : 0; // standard 4 hours?

                // Actually, let's just use a simple logic or keep typically blank/manual if not calculated.

                // Calculate Duration

                const amF = (s.am && s.am.from) || '-';

                const amT = (s.am && s.am.to) || '-';

                const pmF = (s.pm && s.pm.from) || '-';

                const pmT = (s.pm && s.pm.to) || '-';

                const d1 = calculateTimeDifference(amF, amT);

                const d2 = calculateTimeDifference(pmF, pmT);

                const totalDuration = d1 + d2;

                const durationDisplay = totalDuration > 0 ? totalDuration : '-';

                return `

                            <tr>

                                <td>${i + 1}</td>

                                <td style="text-align: right; padding-right: 10px;">${s.last_name} ${s.first_name}</td>

                                <td>${s.level} ${s.class}</td>

                                <td>${amF}</td>

                                <td>${amT}</td>

                                <td>${pmF}</td>

                                <td>${pmT}</td>

                                <td>${durationDisplay}</td>

                                <td>${s.reason || '/'}</td>

                            </tr>

                        `}).join('')}

                    </tbody>

                </table>

            </div>

        `;

        }

        reportHtml += `</div>`;

    }

    // Teachers section

    if (teacherAbsences.length > 0) {

        reportHtml += `

            <div class="report-section">

                <h3>👨‍🏫 غيابات الأساتذة (${teacherAbsences.length})</h3>

                <table class="report-table">

                    <thead>

                        <tr>

                            <th>#</th>

                            <th>الاسم</th>
                            <th>المادة</th>
                            <th>النوع</th>

                            <th>السبب</th>
                            <th>ملاحظات</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${teacherAbsences.map((t, i) => `

                            <tr>

                                <td>${i + 1}</td>

                                <td>${t.name}</td>

                                <td>${t.subject}</td>

                                <td>${t.type}</td>

                                <td>${t.reason || '-'}</td>

                                <td>${t.notes || '-'}</td>

                            </tr>

                        `).join('')}

                    </tbody>

                </table>

                ${teacherAbsences.some(t => t.sections && t.sections !== '-') ? `
                <div style="margin-top: 15px; background: #fdf2f2; border: 1px solid #f8d7da; padding: 10px; border-radius: 8px;">
                    <h4 style="margin: 0 0 10px 0; color: #721c24;">📋 الأقسام التي لم تدرس (بسبب غياب الأساتذة):</h4>
                    <p style="margin: 0; line-height: 1.6;">
                        ${[...new Set(teacherAbsences.map(t => t.sections).filter(s => s && s !== '-').flatMap(s => s.split('، ')))].join(' - ')}
                    </p>
                </div>
                ` : ''}

            </div>

        `;

    }

    // Supervisors section

    if (supervisorAbsences.length > 0) {

        reportHtml += `

            <div class="report-section">

                <h3>👔 غيابات المشرفين (${supervisorAbsences.length})</h3>

                <table class="report-table">

                    <thead>

                        <tr>

                            <th>#</th>

                            <th>الاسم</th>

                            <th>السبب</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${supervisorAbsences.map((s, i) => `

                            <tr>

                                <td>${i + 1}</td>

                                <td>${s.name}</td>

                                <td>${s.reason || '-'}</td>

                            </tr>

                        `).join('')}

                    </tbody>

                </table>

            </div>

        `;

    }

    // Footer with signature

    reportHtml += `

        <div class="report-footer">

            <div></div>

            <div class="signature-box">

                <p>${signerTitle}</p>

                <p style="margin-top: 40px;">${signerName}</p>

            </div>

        </div>

    `;

    // Display report

    document.getElementById('reportPage').innerHTML = reportHtml;

    document.getElementById('reportContainer').classList.add('active');

    document.querySelector('.container').style.display = 'none';

}

/**

 * Close report

 */

function closeReport() {

    document.getElementById('reportContainer').classList.remove('active');

    document.querySelector('.container').style.display = 'block';

}

/**

 * Close modal

 */

function closeModal(modalId) {

    document.getElementById(modalId).classList.remove('active');

}

/**

 * Show toast notification

 */

function showToast(message, type = 'success') {

    // Remove existing toasts

    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');

    toast.className = `toast ${type}`;

    toast.innerHTML = `

        <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>

        <span>${message}</span>

    `;

    // Create container if not exists

    let container = document.querySelector('.toast-container');

    if (!container) {

        container = document.createElement('div');

        container.className = 'toast-container';

        document.body.appendChild(container);

    }

    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);

    setTimeout(() => {

        toast.classList.remove('show');

        setTimeout(() => toast.remove(), 400);

    }, 3000);

}

/**
 * Open Report Settings Modal
 */
window.openReportSettingsModal = async function () {
    const settings = await DB.get('reportOverviewSettings') || {};

    // Title
    document.getElementById('settingReportTitle').value = settings.title || '';

    // Signers
    // Counselor
    document.getElementById('settingShowCounselor').checked = !!settings.showCounselor;
    document.getElementById('settingCounselorTitle').value = settings.counselorTitle || 'مستشار التربية';
    document.getElementById('settingCounselorName').value = settings.counselorName || '';

    // Supervisor
    document.getElementById('settingShowSup').checked = settings.showSup !== false; // Default true
    document.getElementById('settingSupTitle').value = settings.supTitle || 'المشرف العام';
    document.getElementById('settingSupName').value = settings.supName || '';

    // Censor
    document.getElementById('settingShowCensor').checked = settings.showCensor !== false; // Default true
    document.getElementById('settingCensorTitle').value = settings.censorTitle || 'الناظر';
    document.getElementById('settingCensorName').value = settings.censorName || '';

    // Principal
    document.getElementById('settingDirTitle').value = settings.dirTitle || 'المدير';
    document.getElementById('settingDirName').value = settings.dirName || '';

    // Options
    document.getElementById('settingShowHalfBoard').checked = !!settings.showHalfBoard;
    document.getElementById('settingShowObservations').checked = !!settings.showObservations;
    document.getElementById('settingShowCanteenTable').checked = !!settings.showCanteenTable;

    document.getElementById('reportSettingsModal').classList.add('active');
};

/**
 * Close Report Settings Modal
 */
window.closeReportSettingsModal = function () {
    document.getElementById('reportSettingsModal').classList.remove('active');
};

/**
 * Save Report Settings
 */
window.saveReportSettings = async function () {
    const settings = {
        title: document.getElementById('settingReportTitle').value,

        showCounselor: document.getElementById('settingShowCounselor').checked,
        counselorTitle: document.getElementById('settingCounselorTitle').value,
        counselorName: document.getElementById('settingCounselorName').value,

        showSup: document.getElementById('settingShowSup').checked,
        supTitle: document.getElementById('settingSupTitle').value,
        supName: document.getElementById('settingSupName').value,

        showCensor: document.getElementById('settingShowCensor').checked,
        censorTitle: document.getElementById('settingCensorTitle').value,
        censorName: document.getElementById('settingCensorName').value,

        dirTitle: document.getElementById('settingDirTitle').value,
        dirName: document.getElementById('settingDirName').value,

        showHalfBoard: document.getElementById('settingShowHalfBoard').checked,
        showObservations: document.getElementById('settingShowObservations').checked,
        showCanteenTable: document.getElementById('settingShowCanteenTable').checked
    };

    await DB.set('reportOverviewSettings', settings);

    if (typeof showToast === 'function') {
        showToast('تم حفظ إعدادات التقرير بنجاح', 'success');
    }

    closeReportSettingsModal();
};

/**

 * Entry point for General Supervisor Report

 * Checks settings and opens modal if needed

 */

async function generateGeneralSupervisorReport() {

    // alert("Function Called!"); // Removed

    // Trial check

    const authObj = window.Auth || (typeof Auth !== 'undefined' ? Auth : null);

    const user = authObj && authObj.getUser ? authObj.getUser() : null;

    if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {

        Swal.fire({
            icon: 'info',
            title: 'ميزة غير متاحة',
            text: 'هذه الميزة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.'
        });

        return;

    }

    // Check Settings
    let settings = {};
    try {
        const dbSettings = await DB.getSettings();
        if (dbSettings) settings = dbSettings;
        const reportSettings = await DB.get('reportOverviewSettings');
        if (reportSettings) {
            settings = { ...settings, ...reportSettings };
        }
    } catch (e) {
        console.error(e);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: "Error loading settings: " + e.message
        });
    }

    // Always proceed directly, using window.notesData and window.escortData
    proceedGenerateGeneralSupervisorReport({});
}

// function proceedToPrintReportWithObs() { ... } // Removed

/**

 * Actual Generation Logic

 */

async function proceedGenerateGeneralSupervisorReport(observations = {}) {

    // alert("Proceeding to Generate Report..."); // Debug

    const date = document.getElementById('absenceDate').value;

    // --- Styles ---

    const tableStyle = "width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 5px;";

    const thStyle = "border: 1px solid black; background-color: #e0e0e0; padding: 4px; text-align: center; font-weight: bold; font-size: 13px; color: black;";

    const tdStyle = "border: 1px solid black; padding: 2px; text-align: center;";

    const sectionHeaderStyle = "text-align: right; font-weight: bold; margin: 8px 0 4px 0; font-size: 16px; text-decoration: underline; color: #000; display: block;";

    const period = 'كامل'; // Default to full day since selector is removed

    if (!date) {

        showToast('الرجاء تحديد التاريخ', 'error');

        return;

    }

    // Get settings

    let settings = {};

    try {

        const dbSettings = await DB.getSettings();

        if (dbSettings) settings = dbSettings;

        // Merge with Report Overview Settings

        const reportSettings = await DB.get('reportOverviewSettings');

        if (reportSettings) {

            settings = { ...settings, ...reportSettings };

        }

    } catch (e) {

        console.error('Error loading report settings:', e);

    }

    // Prepare Date

    const dateObj = new Date(date);

    const formattedDate = dateObj.toLocaleDateString('fr-FR'); // 31/12/2025 format

    const dayName = dateObj.toLocaleDateString('ar-DZ', { weekday: 'long' });

    // --- Data Processing for Sections ---

    // 1. Teachers

    const teachersData = [];

    selectedTeachers.forEach((data, teacherId) => {

        const teacher = allTeachers.find(t => (t.id || `${t.last_name}-${t.first_name}`) === teacherId);

        if (teacher) {

            teachersData.push({ ...teacher, ...data });

        }

    });

    // 2. Students Grid (Level/Class Stats)
    const stage = settings.educationStage || window.appSettings.educationStage || 'middle';
    const levels = (stage === 'secondary') ? ['1', '2', '3'] : ['1', '2', '3', '4'];

    const statsByLevel = {};

    // Initialize structure

    levels.forEach(lvl => {

        statsByLevel[lvl] = {

            total: 0,

            absent: 0,

            classes: {}

        };

    });

    // Populate all classes first (to show even empty ones)

    // We need to find all unique classes from allStudents to ensure the grid is complete

    const allClassesList = [...new Set(allStudents.map(s => s.class))].sort();

    // Helper to get level key robustly

    const getLevelKey = (lvlStr) => {

        if (!lvlStr) return '0';

        const s = String(lvlStr).trim();

        // Check for digits first

        const match = s.match(/[1-4]/);

        if (match) return match[0];

        // Check Arabic text

        const norm = s.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');

        if (norm.includes('اولى') || norm.includes('اولى') || s.includes('أولى')) return '1';

        if (norm.includes('ثاني') || norm.includes('ثانية')) return '2';

        if (norm.includes('ثالث') || norm.includes('ثالثة')) return '3';

        if (norm.includes('رابع') || norm.includes('رابعة')) return '4';

        return '0';

    };

    // Calculate stats & Populate classes dynamically

    allStudents.forEach(student => {

        const lvl = getLevelKey(student.level);

        const rawCls = student.class;

        // Skip if level invalid or class missing

        if (!statsByLevel[lvl] || !rawCls) return;

        // For secondary: use stream_class as key to distinguish classes from different streams
        let cls;
        let clsDisplayLabel = '';
        if (stage === 'secondary' && student.stream) {
            let streamKey = student.stream;
            let shortStream = '';

            // Group Tech Math streams
            if (['tech_math_civil', 'tech_math_elec', 'tech_math_methods', 'tech_math_mech'].includes(streamKey) || streamKey.startsWith('tech_math')) {
                streamKey = 'tech_math';
                shortStream = 'ت ر';
            } else {
                shortStream = getShortStreamName(student.stream).replace(/\./g, ' ');
            }

            cls = `${streamKey}_${rawCls}`;
            clsDisplayLabel = `${lvl} ${shortStream} ${rawCls}`;
        } else {
            cls = rawCls;
            clsDisplayLabel = '';
        }

        // Ensure class exists in stats

        if (!statsByLevel[lvl].classes[cls]) {

            statsByLevel[lvl].classes[cls] = {

                total: 0, absent: 0,

                extTotal: 0, extAbsent: 0,

                hbTotal: 0, hbAbsent: 0,

                displayLabel: clsDisplayLabel

            };

        }

        // Determine Status (Half-Boarder or External)

        // Check for 'نصف' (half) or 'demi' in status

        const status = student.status ? student.status.toLowerCase() : '';

        const isHalfBoard = status.includes('نصف') || status.includes('demi') || status.includes('ن-د');

        // Increment totals

        statsByLevel[lvl].total++;

        statsByLevel[lvl].classes[cls].total++;

        if (isHalfBoard) {

            statsByLevel[lvl].classes[cls].hbTotal++;

        } else {

            statsByLevel[lvl].classes[cls].extTotal++;

        }

        // Check absence

        const studentId = String(student.id || `${student.last_name}-${student.first_name}`);

        if (selectedStudents.has(studentId)) {

            statsByLevel[lvl].absent++;

            statsByLevel[lvl].classes[cls].absent++;

            if (isHalfBoard) {

                statsByLevel[lvl].classes[cls].hbAbsent++;

            } else {

                statsByLevel[lvl].classes[cls].extAbsent++;

            }

        }

    });

    // 4. Staff (Supervisors)

    const staffData = [];

    selectedSupervisors.forEach((data, supId) => {

        const supervisor = allSupervisors.find(s => (s.id || s.name) === supId);

        if (supervisor) {

            let reason = '';
            let period = 'FULL';
            let from = '';
            let to = '';
            let lateDuration = '';

            if (typeof data === 'string') {
                reason = data;
            } else {
                reason = data.reason;
                period = data.period;
                from = data.from || '';
                to = data.to || '';
                lateDuration = data.lateDuration || '';
            }
            staffData.push({ ...supervisor, reason, period, from, to, lateDuration });

        }

    });

    // --- Notified Students Logic (Correspondence Re-implementation) ---

    const absenceRecords = [...await getCachedAbsenceRecords()]; // Newest first

    const currentDateVal = new Date().toISOString().split('T')[0];

    const notifiedStudentsData = [];

    // Optimize: Create map of absence records for faster lookup if needed,

    // but iteration is fine for report generation scale.

    // Iterate all students to check streaks

    allStudents.forEach(student => {

        const studentId = String(student.id || `${student.last_name}-${student.first_name}`);

        // Logic from correspondence.js

        let streakStartDate = null;

        let streakDays = 0;

        let lastRecordStatus = 'unknown';

        let lastRecordDate = null;

        // Find most recent record

        for (const record of absenceRecords) {

            if (record.date > currentDateVal) continue;

            const isAbsent = record.students && record.students.some(s => String(s.id) === studentId);

            lastRecordStatus = isAbsent ? 'absent' : 'present';

            lastRecordDate = record.date;

            break;

        }

        if (lastRecordStatus === 'absent') {

            streakStartDate = lastRecordDate;

            for (const record of absenceRecords) {

                if (record.date > currentDateVal) continue;

                const isAbsent = record.students && record.students.some(s => String(s.id) === studentId);

                if (isAbsent) {

                    streakStartDate = record.date;

                } else {

                    break;

                }

            }

            // Calc days

            const curr = new Date(currentDateVal);

            const start = new Date(streakStartDate);

            const diffTime = Math.abs(curr - start);

            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            streakDays = diffDays + 1;

        }

        // Determine Status

        let actionLabel = '';

        let isNotified = false;

        if (streakDays >= 33) { actionLabel = 'شطب'; isNotified = true; }

        else if (streakDays >= 18) { actionLabel = 'اعذار'; isNotified = true; }

        else if (streakDays >= 11) { actionLabel = 'إشعار 2'; isNotified = true; }

        else if (streakDays >= 3) { actionLabel = 'إشعار 1'; isNotified = true; }

        if (isNotified) {

            notifiedStudentsData.push({

                ...student,

                streakDays,

                actionLabel

            });

        }

    });

    // 5. Notified Students HTML

    const notifiedStudentsHtml = `

        <div style="${sectionHeaderStyle}">6- التلاميذ المشعرون (إشعار 1، إشعار 2، إعذار، شطب) :</div>

        <table style="${tableStyle}">

            <thead>

                <tr>

                    <th style="${thStyle}" width="5%">#</th>

                    <th style="${thStyle}" width="30%">اللقب والاسم</th>

                    <th style="${thStyle}" width="15%">القسم</th>

                    <th style="${thStyle}" width="15%">أيام الغياب</th>

                    <th style="${thStyle}" width="20%">الإجراء</th>

                    <th style="${thStyle}">ملاحظات</th>

                </tr>

            </thead>

            <tbody>

                ${notifiedStudentsData.length > 0 ? notifiedStudentsData.map((s, i) => {
        let streamLabel = '';
        if (stage === 'secondary' && s.stream) {
            if (['tech_math_civil', 'tech_math_elec', 'tech_math_methods', 'tech_math_mech'].includes(s.stream) || s.stream.startsWith('tech_math')) {
                streamLabel = 'ت ر';
            } else {
                streamLabel = getShortStreamName(s.stream).replace(/\./g, ' ');
            }
            streamLabel += ' ';
        }

        return `
                    <tr>
                        <td style="${tdStyle}">${i + 1}</td>
                        <td style="${tdStyle}">${s.last_name} ${s.first_name}</td>
                        <td style="${tdStyle}">${s.level} ${streamLabel}${s.class}</td>
                        <td style="${tdStyle}">${s.streakDays}</td>
                        <td style="${tdStyle}">${s.actionLabel}</td>
                        <td style="${tdStyle}"></td>
                    </tr>
                    `;
    }).join('') : `<tr><td style="${tdStyle}" colspan="6" height="30">لا توجد إشعارات اليوم</td></tr>`}

            </tbody>

        </table>

        <div style="margin-bottom: 20px;"></div>

    `;

    // 6. Summary Totals

    // Filter supervisors by role

    const supervisorsList = allSupervisors.filter(s => !s.role || s.role === 'supervisor');

    const agentsList = allSupervisors.filter(s => s.role === 'agent');

    // Count absences for each group

    let supAbsents = 0;

    let agentAbsents = 0;

    selectedSupervisors.forEach((data, supId) => {

        const person = allSupervisors.find(s => (s.id || s.name) === supId);

        if (person) {

            if (person.role === 'agent') agentAbsents++;

            else if (!person.role || person.role === 'supervisor') supAbsents++;

            // If role is '/', do not count in either category

        }

    });

    // Calculate totals from statsByLevel to ensure consistency with the table
    let calculatedTotalStudents = 0;
    let calculatedTotalAbsent = 0;

    levels.forEach(lvl => {
        if (statsByLevel[lvl]) {
            calculatedTotalStudents += statsByLevel[lvl].total;
            calculatedTotalAbsent += statsByLevel[lvl].absent;
        }
    });

    const summary = {

        students: { total: calculatedTotalStudents, absent: calculatedTotalAbsent, present: calculatedTotalStudents - calculatedTotalAbsent },

        teachers: { total: allTeachers.length, absent: selectedTeachers.size, present: allTeachers.length - selectedTeachers.size },

        supervisors: { total: supervisorsList.length, absent: supAbsents, present: supervisorsList.length - supAbsents },

        agents: { total: agentsList.length, absent: agentAbsents, present: agentsList.length - agentAbsents }

    };

    // 7. Absent Students Detail

    const absentStudentsList = [];

    selectedStudents.forEach((data, studentId) => {

        // Handle ID stored as string in Map

        const student = allStudents.find(s => String(s.id || `${s.last_name}-${s.first_name}`) === String(studentId));

        if (student) {

            let reason = 'غير مبرر';

            // Extract info from data object (which has am, pm, reason)

            let am = data.am;

            let pm = data.pm;

            if (typeof data === 'string') {

                reason = data; // Legacy

            } else {

                reason = data.reason || 'غير مبرر';

            }

            // Push merged object so table generation has access to am/pm

            absentStudentsList.push({

                ...student,

                reason: reason,

                am: am,

                pm: pm

            });

        }

    });

    // Calculate Max Cols (Max classes in any level)

    let maxCols = 0;

    levels.forEach(lvl => {

        const count = Object.keys(statsByLevel[lvl].classes).length;

        if (count > maxCols) maxCols = count;

    });

    if (maxCols < 1) maxCols = 1; // Minimum 1 col

    // --- HTML Construction ---

    // Note: Inline CSS is used to strictly match the requested dense "Excel-like" layout

    let html = `

    <div style="font-family: Arial, sans-serif; direction: rtl; padding: 10px; color: #000; background: white;">

        <!-- Standard Header -->

        <div style="text-align: center; margin-bottom: 20px;">

            <h3 style="margin: 0 0 5px 0;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

            <h3 style="margin: 0;">وزارة التربية الوطنية</h3>

        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 15px;">

             <!-- Right: Institution Info -->

             <div style="text-align: right; width: 33%;">

                 <p style="margin: 2px 0; font-size:11px;">مديرية التربية لولاية ${settings.wilaya || '...'}</p>

                 <p style="margin: 2px 0; font-size:11px;">المؤسسة: ${settings.institutionName || '...'}</p>

            </div>

            <!-- Center: Report Title -->

            <div style="text-align: center; width: 33%;">

                <div style="border: 2px solid #000; padding: 8px 15px; font-weight: bold; font-size: 16px; display: inline-block;">

                    ${(() => {

            if (settings.title) return settings.title;

            const role = settings.supTitle || 'المشرف العام';

            // Handle Arabic "Al" prefix for "Li" (to/for)

            // If starts with "ال" (Al), remove "ا" and prepend "ل" -> "لل..."

            // else prepend "ل" -> "ل..."

            if (role.startsWith('ال')) {

                return `التقرير اليومي ل${role.substring(1)}`;

            }

            return `التقرير اليومي ل${role}`;

        })()}

                </div>

                 <div style="margin-top:5px; font-size:11px;">

                    رقم التقرير: <strong>${getCurrentReportNumber()}</strong>

                 </div>

            </div>

            <!-- Left: Date/Year -->

            <div style="text-align: left; width: 33%;">

                 <p style="margin: 2px 0; font-size:11px;">السنة الدراسية: ${settings.schoolYear || '2025/2026'}</p>

                 <p style="margin: 2px 0; font-size:11px;">${dayName}: ${formattedDate}</p>

            </div>

        </div>

    `;

    // --- HTML Components Generation ---

    // 1. Teachers HTML

    const teachersHtml = `

        <div style="${sectionHeaderStyle}">1- الدراسة :</div>

        <div style="${sectionHeaderStyle}">1.1- دروس لم تقدم :</div>

        <table style="${tableStyle}">

            <thead>

                <tr>

                    <th style="${thStyle}" rowspan="2" width="3%">الرقم</th>

                    <th style="${thStyle}" rowspan="2" width="20%">لقب واسم الأستاذ (ة)</th>

                    <th style="${thStyle}" rowspan="2" width="10%">المادة</th>

                    <th style="${thStyle}" rowspan="2" width="5%">ساعات<br>الغياب</th>

                    <th style="${thStyle}" colspan="4">صباحا</th>

                    <th style="${thStyle}" colspan="4">مساء</th>

                    <th style="${thStyle}" rowspan="2" width="15%">سبب الغياب</th>

                    <th style="${thStyle}" rowspan="2">ملاحظات</th>

                </tr>

                <tr>

                    <th style="${thStyle}">1</th><th style="${thStyle}">2</th><th style="${thStyle}">3</th><th style="${thStyle}">4</th>

                    <th style="${thStyle}">5</th><th style="${thStyle}">6</th><th style="${thStyle}">7</th><th style="${thStyle}">8</th>

                </tr>

            </thead>

            <tbody>

                ${teachersData.length > 0 ? teachersData.map((t, i) => {

        let hours = t.hours || ((t.periods && t.periods.length > 0) ? t.periods.length : (t.type === 'full' ? 6 : 0));

        if (!hours) hours = 0;

        let periodCells = '';

        const dIdx = new Date(date).getDay();

        const dMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        const engDay = dMap[dIdx];

        const schedule = (teacherAssignments[t.id] && teacherAssignments[t.id][engDay]) ? teacherAssignments[t.id][engDay] : {};

        for (let p = 1; p <= 8; p++) {

            const isAbsent = (t.periods && t.periods.includes(p)) || (t.type === 'full' && (!t.periods || t.periods.length === 0));

            let scheduleEntry = schedule[p] || '';

            let className = '';

            if (t.periodClasses && t.periodClasses[p]) {
                className = t.periodClasses[p];
            } else if (scheduleEntry) {

                if (typeof scheduleEntry === 'object') {

                    className = scheduleEntry.class || '';

                    if (scheduleEntry.type) className += ` (${scheduleEntry.type})`;

                } else {

                    className = scheduleEntry;

                }

            }

            if (className && typeof className === 'string') {
                className = className.replace(/متوسط/g, 'م').replace(/ثانوي/g, 'ث');
            }

            let content = isAbsent ? (className ? className : '') : '';

            periodCells += `<td style="${tdStyle}">${content}</td>`;

        }

        return `

                    <tr>

                        <td style="${tdStyle}">${i + 1}</td>

                        <td style="${tdStyle}">${t.last_name || ''} ${t.first_name || ''}</td>

                        <td style="${tdStyle}">${t.subject || ''}</td>

                        <td style="${tdStyle}">${hours}</td>

                        ${periodCells}

                        <td style="${tdStyle}">${t.reason || ''}</td>

                        <td style="${tdStyle}">${t.type === 'late' ? `تأخر (${t.lateDuration || 0} د)` : t.type === 'full' ? 'كامل' : t.type === 'partial' ? 'جزئي' : ''}</td>

                    </tr>

                    `;

    }).join('') : `

                <tr><td style="${tdStyle}" colspan="14" height="20"></td></tr>

                `}

            </tbody>

        </table>

        <div style="${sectionHeaderStyle}">2.1- الإجراءات المتخذة : (الاستعجالية والميدانية)</div>

        <div style="border-bottom: 1px dotted #000; margin-bottom: 5px; height: 15px;"></div>

    `;

    // 2. Stats Grid HTML (المشعرون / المؤشرات)
    const isSecondaryStage = (stage === 'secondary');

    let statsGridHtml = `

        <div style="${sectionHeaderStyle}">2- مواظبة التلاميذ :</div>

        <table style="${tableStyle}">

            <thead>

                ${isSecondaryStage ? `
                <tr>
                    <th style="${thStyle}" rowspan="${settings.showHalfBoard ? 2 : 1}">المستوى</th>
                    <th style="${thStyle}" rowspan="${settings.showHalfBoard ? 2 : 1}">البيان</th>
                    ${Array.from({ length: maxCols }, (_, i) => `<th style="${thStyle}" colspan="${settings.showHalfBoard ? 2 : 1}">${String(i + 1).padStart(2, '0')}</th>`).join('')}
                    <th style="${thStyle}" rowspan="${settings.showHalfBoard ? 2 : 1}">المجموع</th>
                    <th style="${thStyle}" rowspan="${settings.showHalfBoard ? 2 : 1}">نسبة %</th>
                </tr>
                ${settings.showHalfBoard ? `
                <tr>
                    ${Array.from({ length: maxCols }, () => `<th style="${thStyle} font-size:9px;">خ</th><th style="${thStyle} font-size:9px;">ن-د</th>`).join('')}
                </tr>` : ''}
                ` : `
                <tr>
                    <th style="${thStyle}" rowspan="${settings.showHalfBoard ? 3 : 2}" width="50px">الأفواج</th>
                    <th style="${thStyle}" rowspan="${settings.showHalfBoard ? 3 : 2}">البيان</th>
                    ${Array.from({ length: maxCols }, (_, i) => `<th style="${thStyle}" colspan="${settings.showHalfBoard ? 2 : 1}">${String(i + 1).padStart(2, '0')}</th>`).join('')}
                    <th style="${thStyle}" rowspan="${settings.showHalfBoard ? 3 : 2}">المجموع</th>
                    <th style="${thStyle}" rowspan="${settings.showHalfBoard ? 3 : 2}">نسبة %</th>
                </tr>
                ${settings.showHalfBoard ? `
                 <tr>
                    ${Array.from({ length: maxCols }, () => `<th style="${thStyle} font-size:9px;">خ</th><th style="${thStyle} font-size:9px;">ن-د</th>`).join('')}
                 </tr>` : '<tr></tr>'}
                `}

            </thead>

            <tbody>

    `;

    levels.forEach(lvl => {

        const levelClasses = Object.keys(statsByLevel[lvl].classes).sort();

        // For secondary: add a class-names row before the data rows
        if (isSecondaryStage) {
            const classNamesRowspan = 3; // class-names + عدد + غياب
            statsGridHtml += `<tr>`;
            statsGridHtml += `<td style="${thStyle}" rowspan="${classNamesRowspan}">${lvl} ثانوي</td>`;
            // Class names row - show abbreviated class codes
            statsGridHtml += `<td style="${thStyle} font-size:10px; background-color:#f0f0f0;">الأقسام</td>`;
            for (let i = 1; i <= maxCols; i++) {
                const clsKey = levelClasses[i - 1];
                if (clsKey) {
                    const classData = statsByLevel[lvl].classes[clsKey];
                    const label = classData.displayLabel || clsKey;
                    if (settings.showHalfBoard) {
                        statsGridHtml += `<td style="${tdStyle} font-size:9px; font-weight:bold; background-color:#f5f5f5;" colspan="2">${label}</td>`;
                    } else {
                        statsGridHtml += `<td style="${tdStyle} font-size:9px; font-weight:bold; background-color:#f5f5f5;">${label}</td>`;
                    }
                } else {
                    if (settings.showHalfBoard) {
                        statsGridHtml += `<td style="${tdStyle} background-color: #eee;" colspan="2"></td>`;
                    } else {
                        statsGridHtml += `<td style="${tdStyle} background-color: #eee;"></td>`;
                    }
                }
            }
            statsGridHtml += `<td style="${tdStyle}"></td>`; // المجموع - empty for class names row
            statsGridHtml += `<td style="${tdStyle}"></td>`; // نسبة % - empty for class names row
            statsGridHtml += `</tr>`;

            // عدد row (no level cell - covered by rowspan)
            statsGridHtml += `<tr><td style="${tdStyle}">عدد</td>`;
        } else {
            // Middle school: original behavior
            statsGridHtml += `

            <tr>

                <td style="${thStyle}" rowspan="2">${lvl} متوسط</td>

                <td style="${tdStyle}">عدد</td>

            `;
        }

        for (let i = 1; i <= maxCols; i++) {

            const clsKey = levelClasses[i - 1]; // Get class at this index if exists

            if (clsKey) {

                const s = statsByLevel[lvl].classes[clsKey];

                if (settings.showHalfBoard) {

                    statsGridHtml += `<td style="${tdStyle}">${s.extTotal}</td><td style="${tdStyle}">${s.hbTotal}</td>`;

                } else {

                    statsGridHtml += `<td style="${tdStyle}">${s.total}</td>`;

                }

            } else {

                if (settings.showHalfBoard) {

                    statsGridHtml += `<td style="${tdStyle} background-color: #eee;"></td><td style="${tdStyle} background-color: #eee;"></td>`;

                } else {

                    statsGridHtml += `<td style="${tdStyle} background-color: #eee;"></td>`;

                }

            }

        }

        const lvlTotal = statsByLevel[lvl].total;

        statsGridHtml += `<td style="${tdStyle} font-weight: bold;">${lvlTotal}</td>`;

        statsGridHtml += `<td style="${tdStyle}">/</td>`;

        statsGridHtml += `</tr>`;

        // Absence Row

        statsGridHtml += `<tr style="background-color: #e0e0e0;"><td style="${tdStyle}">غياب</td>`;

        for (let i = 1; i <= maxCols; i++) {

            const clsKey = levelClasses[i - 1];

            if (clsKey) {

                const s = statsByLevel[lvl].classes[clsKey];

                if (settings.showHalfBoard) {

                    statsGridHtml += `<td style="${tdStyle}">${s.extAbsent}</td><td style="${tdStyle}">${s.hbAbsent}</td>`;

                } else {

                    statsGridHtml += `<td style="${tdStyle}">${s.absent}</td>`;

                }

            } else {

                if (settings.showHalfBoard) {

                    statsGridHtml += `<td style="${tdStyle} background-color: #ccc;"></td><td style="${tdStyle} background-color: #ccc;"></td>`;

                } else {

                    statsGridHtml += `<td style="${tdStyle} background-color: #ccc;"></td>`;

                }

            }

        }

        const lvlAbsent = statsByLevel[lvl].absent;

        const lvlPct = lvlTotal ? ((lvlAbsent / lvlTotal) * 100).toFixed(2) : '0.00';

        statsGridHtml += `<td style="${tdStyle} font-weight: bold;">${lvlAbsent}</td>`;

        statsGridHtml += `<td style="${tdStyle}">${lvlPct}%</td>`;

        statsGridHtml += `</tr>`;

    });

    statsGridHtml += `</tbody></table>`;

    const totalAbsentPct = summary.students.total ? ((summary.students.absent / summary.students.total) * 100).toFixed(2) : 0;

    statsGridHtml += `

        <div style="display: flex; gap: 10px; font-size: 11px; font-weight: bold; justify-content: space-around; background: #e8f5e9; padding: 2px; border: 1px solid #ccc; margin-bottom: 5px;">

            <span>عدد التلاميذ الحاضرين: ${summary.students.present}</span>

            <span>عدد التلاميذ الغائبين: ${summary.students.absent}</span>

            <span>النسبة المئوية لغيابات اليوم: ${totalAbsentPct}%</span>

        </div>

    `;

    // 3. Supervisors & Facilities HTML

    const supervisorSectionHtml = `

        <div style="display: flex; gap: 10px; margin-bottom: 10px;">

            <div style="flex: 1;">

                 <div style="${sectionHeaderStyle}">3- غيابات المشرفين والأعوان :</div>

                 <table style="${tableStyle}">

                    <thead>

                        <tr><th style="${thStyle}">#</th><th style="${thStyle}">الاسم واللقب</th><th style="${thStyle}">الرتبة</th><th style="${thStyle}">ف.صباحية</th><th style="${thStyle}">ف.مسائية</th><th style="${thStyle}">السبب/ملاحظة</th></tr>

                    </thead>

                    <tbody>

                        ${staffData.length > 0 ? staffData.map((s, i) => {
        let isAM = s.period === 'AM' || s.period === 'FULL' || !s.period;
        let isPM = s.period === 'PM' || s.period === 'FULL' || !s.period;
        let reasonStr = s.reason || '';

        if (s.period === 'PARTIAL') {
            isAM = false;
            isPM = false;
            const from = s.from || '08:00';
            const to = s.to || '10:00';
            reasonStr = reasonStr ? `غياب جزئي (من ${from} إلى ${to}) - ${reasonStr}` : `غياب جزئي (من ${from} إلى ${to})`;
        } else if (s.period === 'LATE') {
            isAM = false;
            isPM = false;
            const duration = s.lateDuration || '?';
            reasonStr = reasonStr ? `تأخر (${duration} د) - ${reasonStr}` : `تأخر (${duration} د)`;
        }

        return `<tr>
                            <td style="${tdStyle} font-weight: bold;">${i + 1}</td>
                            <td style="${tdStyle}">${s.name}</td>
                            <td style="${tdStyle}">${s.rank || ''}</td>
                            <td style="${tdStyle}">${isAM ? 'X' : ''}</td>
                            <td style="${tdStyle}">${isPM ? 'X' : ''}</td>
                            <td style="${tdStyle}">${reasonStr}</td>
                        </tr>`;

    }).join('') : `<tr><td style="${tdStyle}" colspan="6" height="20"></td></tr>`}

                    </tbody>

                 </table>

                 <div style="${sectionHeaderStyle}">4- متابعة المرافق :</div>
                 <table style="${tableStyle}">
                    <thead>
                        <tr><th style="${thStyle}">#</th><th style="${thStyle}" width="35%">المرفق</th><th style="${thStyle}" width="30%">النقائص</th><th style="${thStyle}" width="25%">الملاحظات</th></tr>
                    </thead>
                    <tbody>
                        ${window.escortData && window.escortData.length > 0 ? window.escortData.map((item, index) => `
                        <tr>
                            <td style="${tdStyle} font-weight: bold;">${index + 1}</td>
                            <td style="${tdStyle}">${item.facility || ''}</td>
                            <td style="${tdStyle}">${item.deficiencies || ''}</td>
                            <td style="${tdStyle}">${item.notes || ''}</td>
                        </tr>
                        `).join('') : `
                        <tr><td style="${tdStyle}" colspan="4" height="20"></td></tr>
                        `}
                    </tbody>
                 </table>
            </div>
        </div>
    `;

    // 4. Summary HTML

    const summaryHtml = `

        <div style="${sectionHeaderStyle}">5- الحوصلة :</div>

        <table style="${tableStyle}">

            <thead>

                <tr>

                    <th style="${thStyle}">البيان</th>

                    <th style="${thStyle}">التلاميذ</th>

                    <th style="${thStyle}">الأساتذة</th>

                    <th style="${thStyle}">مشرفو التربية</th>

                    <th style="${thStyle}">أعوان المصلحة</th>

                </tr>

            </thead>

            <tbody>

                <tr><td style="${tdStyle}">المسجلون</td><td style="${tdStyle}">${summary.students.total}</td><td style="${tdStyle}">${summary.teachers.total}</td><td style="${tdStyle}">${summary.supervisors.total}</td><td style="${tdStyle}">${summary.agents.total}</td></tr>

                <tr><td style="${tdStyle}">الغائبون</td><td style="${tdStyle}">${summary.students.absent}</td><td style="${tdStyle}">${summary.teachers.absent}</td><td style="${tdStyle}">${summary.supervisors.absent}</td><td style="${tdStyle}">${summary.agents.absent}</td></tr>

                <tr><td style="${tdStyle} background:#8bc34a;">الحاضرون</td><td style="${tdStyle}">${summary.students.present}</td><td style="${tdStyle}">${summary.teachers.present}</td><td style="${tdStyle}">${summary.supervisors.present}</td><td style="${tdStyle}">${summary.agents.present}</td></tr>

            </tbody>

        </table>

    `;

    // 5. Absent Students HTML

    const absentStudentsHtml = `

        <div style="${sectionHeaderStyle}">8- التلاميذ الغائبون :</div>

        <table style="${tableStyle}">

            <thead>

                <tr>

                    <th rowspan="2" style="${thStyle}" width="3%">#</th>

                    <th rowspan="2" style="${thStyle}" width="20%">اللقب والاسم</th>

                    <th rowspan="2" style="${thStyle}" width="15%">القسم</th>

                    ${settings.showHalfBoard ? `<th rowspan="2" style="${thStyle}" width="8%">الصفة</th>` : ''}

                    <th colspan="2" style="${thStyle}" width="20%">الصباح</th>

                    <th colspan="2" style="${thStyle}" width="20%">المساء</th>

                    <th rowspan="2" style="${thStyle}" width="7%">عدد س</th>

                    <th rowspan="2" style="${thStyle}" width="20%">ملاحظات</th>

                </tr>

                <tr>

                    <th style="${thStyle}">من</th>

                    <th style="${thStyle}">إلى</th>

                    <th style="${thStyle}">من</th>

                    <th style="${thStyle}">إلى</th>

                </tr>

            </thead>

            <tbody>

                ${absentStudentsList.length > 0 ? absentStudentsList.map((s, i) => {

        const amFrom = (s.am && s.am.from) || '-';

        const amTo = (s.am && s.am.to) || '-';

        const pmFrom = (s.pm && s.pm.from) || '-';

        const pmTo = (s.pm && s.pm.to) || '-';

        const d1 = calculateTimeDifference(amFrom, amTo);

        const d2 = calculateTimeDifference(pmFrom, pmTo);

        const totalDuration = d1 + d2;

        const durationDisplay = totalDuration > 0 ? totalDuration : '-';

        return `<tr>

                        <td style="${tdStyle}">${i + 1}</td>

                        <td style="${tdStyle}">${s.last_name} ${s.first_name}</td>

                        <td style="${tdStyle}">
                            ${(() => {
                if (stage === 'secondary' && s.stream) {
                    let streamLabel = getShortStreamName(s.stream).replace(/\./g, ' ');
                    // Handle Tech Math grouping if needed, similar to stats table
                    if (['tech_math_civil', 'tech_math_elec', 'tech_math_methods', 'tech_math_mech'].includes(s.stream) || s.stream.startsWith('tech_math')) {
                        streamLabel = 'ت ر';
                    }
                    // Ensure class name is two digits
                    let className = s.class_name || s.class || '';
                    if (className && !isNaN(className) && className.length === 1) className = '0' + className;

                    return `${getLevelKey(s.level)} ${streamLabel} ${className}`;
                } else {
                    // Middle School or default fallback
                    return `${s.level} ${s.class}`;
                }
            })()}
                        </td>

                        ${settings.showHalfBoard ? `<td style="${tdStyle}">${s.status || ''}</td>` : ''}

                        <td style="${tdStyle}">${amFrom}</td>

                        <td style="${tdStyle}">${amTo}</td>

                        <td style="${tdStyle}">${pmFrom}</td>

                        <td style="${tdStyle}">${pmTo}</td>

                        <td style="${tdStyle}">${durationDisplay}</td>

                        <td style="${tdStyle}">${s.reason || '/'}</td>

                    </tr>`;

    }).join('') : `<tr><td style="${tdStyle}" colspan="${settings.showHalfBoard ? 10 : 9}">لا يوجد غيابات مسجلة</td></tr>`}

            </tbody>

        </table>

    `;

    // --- ASSEMBLY ---

    // Page 1
    html += teachersHtml;
    html += statsGridHtml;
    html += supervisorSectionHtml;
    html += summaryHtml;

    // Page Break
    html += `<div style="page-break-before: always; margin-top: 20px;"></div>`;

    // Notified Students (New)

    html += notifiedStudentsHtml;

    // --- Canteen Table (New Feature) ---

    if (settings.showCanteenTable) {

        // Calculate Canteen Stats (Half Board Only)

        // 1. Registered: All students with status 'half_board' (or check canteenBeneficiaries if strict)

        // User asked for "Registered" in Canteen Table context.

        // Logic: Use canteenBeneficiaries list as "Registered" for canteen.

        // Actually, let's filter allStudents by canteenBeneficiaries ID list for accuracy.

        let canteenRegistered = allStudents.filter(s => canteenBeneficiaries.some(id => String(id) === String(s.id)));

        // If canteenBeneficiaries is empty, maybe fallback to status 'half_board'?

        if (canteenRegistered.length === 0) {

            canteenRegistered = allStudents.filter(s => (s.status || '').includes('نصف') || (s.status || '').includes('demi'));

        }

        const stats = {

            registered: { total: 0, m: 0, f: 0 },

            present: { total: 0, m: 0, f: 0 },

            absent: { total: 0, m: 0, f: 0 }

        };

        const currentCanteenAbsences = canteenAbsences[date] || [];

        canteenRegistered.forEach(s => {

            const isMale = (s.gender === 'M' || s.gender === 'ذكر');

            const sId = String(s.id || `${s.last_name}-${s.first_name}`);

            // Check School Absence (if absent from school, absent from canteen)

            const schoolAbsent = selectedStudents.has(sId);

            // Check Canteen Specific Absence

            const canteenSpecificAbsent = currentCanteenAbsences.some(id => String(id) === sId);

            const isAbsent = schoolAbsent || canteenSpecificAbsent;

            // Increment Registered

            stats.registered.total++;

            if (isMale) stats.registered.m++; else stats.registered.f++;

            // Increment Absent/Present

            if (isAbsent) {

                stats.absent.total++;

                if (isMale) stats.absent.m++; else stats.absent.f++;

            } else {

                stats.present.total++;

                if (isMale) stats.present.m++; else stats.present.f++;

            }

        });

        // Get Daily Info

        const info = canteenDailyInfo[date] || {};

        const canteenAbsentCountReal = info.absentees || currentCanteenAbsences.length || stats.absent.total;

        // Used input value if exists, else match calculated total?

        // User requested "Absent from Canteen" column.

        // The image shows "Absents from Canteen" separate.

        // Let's use the Input Field Value "canteenAbsentTotalInput" for "غائبون عن المطعم" if provided, otherwise calculated.

        const canteenHtml = `

            <div style="${sectionHeaderStyle}">7- المطعم :</div>

            <div style="text-align: center; font-weight: bold; margin-bottom: 5px;">غيابات التلاميذ وظروف الاطعام (النصف داخلي)</div>

            <table style="${tableStyle}">

                <thead>

                    <tr>

                        <th style="${thStyle}">التلاميذ</th>

                        <th style="${thStyle}">ذكور</th>

                        <th style="${thStyle}">إناث</th>

                        <th style="${thStyle}">مجموع</th>

                        <th style="${thStyle}">الوجبة المقترحة</th>

                        <th style="${thStyle}">الوجبة المقدمة</th>

                        <th style="${thStyle}">ملاحظات</th>

                    </tr>

                </thead>

                <tbody>

                    <tr>

                         <td style="${tdStyle}">المسجلون</td>

                        <td style="${tdStyle}">${stats.registered.m}</td>

                         <td style="${tdStyle}">${stats.registered.f}</td>

                        <td style="${tdStyle} font-weight: bold;">${stats.registered.total}</td>

                        <td style="${tdStyle}" rowspan="3">${info.proposed || ''}</td>

                        <td style="${tdStyle}" rowspan="3">${info.offered || ''}</td>

                         <td style="${tdStyle}" rowspan="3">${info.notes || ''}</td>

                    </tr>

                    <tr>

                        <td style="${tdStyle}">الحاضرون</td>

                        <td style="${tdStyle}">${stats.present.m}</td>

                         <td style="${tdStyle}">${stats.present.f}</td>

                        <td style="${tdStyle} font-weight: bold;">${stats.present.total}</td>

                    </tr>

                    <tr>

                        <td style="${tdStyle}">الغائبون</td>

                        <td style="${tdStyle}">${stats.absent.m}</td>

                        <td style="${tdStyle}">${stats.absent.f}</td>

                        <td style="${tdStyle} font-weight: bold;">${stats.absent.total}</td>

                    </tr>

                </tbody>

            </table>

            <div style="margin-bottom: 20px;"></div>

        `;

        html += canteenHtml;

    }

    // Absent Students

    html += absentStudentsHtml;

    // Observations Table (New)

    // Observations Table (New Dynamic)
    if (settings.showObservations) {

        const observationsRows = window.notesData && window.notesData.length > 0 ? window.notesData.map((note, index) => `
            <tr>
                <td style="border: 1px solid #000; padding: 5px; text-align: center; width: 5%; font-weight: bold;">${index + 1}</td>
                <td style="border: 1px solid #000; padding: 5px; text-align: right; width: 95%;">${note.text || ''}</td>
            </tr>
        `).join('') : `<tr><td colspan="2" style="border: 1px solid #000; padding: 20px; text-align: center;"> / </td></tr>`;

        const observationsHtml = `
            <div style="margin-top: 20px;">
                <div style="${sectionHeaderStyle}">9- الملاحظات والتوجيهات :</div>
                <table style="width: 100%; border-collapse: collapse; direction: rtl;">
                    <thead>
                        <tr>
                            <th style="border: 1px solid #000; padding: 5px; text-align: center; width: 5%; font-weight: bold; background-color: #e0e0e0;">#</th>
                            <th style="border: 1px solid #000; padding: 5px; text-align: center; width: 95%; font-weight: bold; background-color: #e0e0e0;">الملاحظات / التوجيهات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${observationsRows}
                    </tbody>
                </table>
            </div>
        `;
        html += observationsHtml;
    }

    // Footer Signatures
    // Collect active signers
    const signers = [];

    // Counselor (Priority First)
    if (settings.showCounselor) {
        signers.push({ title: settings.counselorTitle || 'مستشار التربية', name: settings.counselorName });
    }

    // Supervisor (Default Show)
    if (settings.showSup !== false) {
        signers.push({ title: settings.supTitle || 'المشرف العام', name: settings.supName });
    }

    // Censor (Default Show)
    if (settings.showCensor !== false) {
        signers.push({ title: settings.censorTitle || 'الناظر', name: settings.censorName });
    }

    // Principal (Always Show unless explicitly hidden in future, but keeping current pattern)
    signers.push({ title: settings.dirTitle || 'المدير', name: settings.dirName });

    // Build Footer HTML
    const signerWidth = signers.length > 0 ? (100 / signers.length) : 100;

    html += `
        <div style="display: flex; justify-content: space-around; margin-top: 25px; font-weight: bold; font-size: 11px; text-align: center;">
            ${signers.map(s => `
                <div style="width: ${signerWidth}%;">
                    إمضاء ${s.title}
                    ${s.name ? `<br><span style="font-weight:normal;">${s.name}</span>` : ''}
                    <br><br><br>
                    ................................
                </div>
            `).join('')}
        </div>
    `;

    html += `</div>`; // End wrapper

    // Open in new window for printing

    const printWindow = window.open('', '_blank');

    if (printWindow) {

        printWindow.document.write(`

            <!DOCTYPE html>

            <html dir="rtl" lang="ar">

            <head>

                <meta charset="UTF-8">

                <title>التقرير اليومي للمشرف العام</title>

                <style>

                    body { margin: 0; padding: 0; background: #fff; }

                    @media print {

                        @page { size: A4; margin: 10mm; }

                        body { -webkit-print-color-adjust: exact; }

                        .no-print { display: none !important; }

                    }

                </style>

            \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

            <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

                ${html}

                <script>

                    window.onload = function() {

                        setTimeout(() => {

                            // window.print(); /* Replaced by global Toolbar */

                        }, 500);

                    }

                </script>

            \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

            </html>

        `);

        printWindow.document.close();

    } else {

        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'يرجى السماح بالنوافذ المنبثقة لطباعة التقرير',
            confirmButtonText: 'حسناً'
        });

    }

}

// --- Teacher Absence Modal Logic ---

let currentAbsenceTeacherId = null;

function openTeacherAbsenceModal(teacherId) {

    currentAbsenceTeacherId = teacherId;

    const teacher = allTeachers.find(t => (t.id || `${t.last_name}-${t.first_name}`) === teacherId);

    if (!teacher) {

        console.error('Teacher not found in allTeachers:', teacherId);

        return;

    }

    // Set Name

    document.getElementById('modalTeacherName').textContent = `${teacher.last_name} ${teacher.first_name}`;

    // Set Date & Day

    const dateInput = document.getElementById('absenceDate');

    const dateVal = dateInput.value;

    const dateObj = new Date(dateVal);

    const dayIndex = dateObj.getDay(); // 0 = Sunday

    const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    const dayName = daysMap[dayIndex];

    document.getElementById('modalAbsenceDate').textContent = `${dateVal} (${getDayArabicName(dayIndex)})`;

    // Load existing data if any

    const existingData = selectedTeachers.get(teacherId);

    // Set Reason
    const reasonSelect = document.getElementById('teacherAbsenceReason');
    const reasonOther = document.getElementById('teacherReasonOther');

    if (existingData && existingData.reason) {
        // Check if the reason exists in the predefined options
        const options = Array.from(reasonSelect.options).map(opt => opt.value);
        if (options.includes(existingData.reason)) {
            reasonSelect.value = existingData.reason;
            if (reasonOther) {
                reasonOther.style.display = 'none';
                reasonOther.value = '';
            }
        } else if (existingData.type !== 'late') {
            // It's a custom reason (and not a late reason which is handled separately)
            reasonSelect.value = 'other';
            if (reasonOther) {
                reasonOther.style.display = 'block';
                reasonOther.value = existingData.reason;
            }
        } else {
            reasonSelect.value = '';
            if (reasonOther) {
                reasonOther.style.display = 'none';
                reasonOther.value = '';
            }
        }
    } else {
        reasonSelect.value = '';
        if (reasonOther) {
            reasonOther.style.display = 'none';
            reasonOther.value = '';
        }
    }

    // Set Type (default full)

    const radioAbsence = document.querySelector('input[name="absenceType"][value="full"]');
    const radioLate = document.querySelector('input[name="absenceType"][value="late"]');
    const radioScopeFull = document.querySelector('input[name="teacherAbsenceScope"][value="full"]');
    const radioScopePartial = document.querySelector('input[name="teacherAbsenceScope"][value="partial"]');

    if (existingData && existingData.type === 'late') {
        radioLate.checked = true;
        if (document.getElementById('teacherLateDuration')) {
            document.getElementById('teacherLateDuration').value = existingData.lateDuration || '';
        }
        if (document.getElementById('teacherLateReason')) {
            document.getElementById('teacherLateReason').value = existingData.reason || '';
        }
    } else {
        radioAbsence.checked = true;
        if (document.getElementById('teacherLateDuration')) {
            document.getElementById('teacherLateDuration').value = '';
        }
        if (document.getElementById('teacherLateReason')) {
            document.getElementById('teacherLateReason').value = '';
        }
    }

    toggleAbsenceType();

    // Populate Periods based on Schedule

    const modal = document.getElementById('teacherAbsenceModal');
    const periodsListAM = document.getElementById('periodsListAM');
    const periodsListPM = document.getElementById('periodsListPM');
    const periodsTitleAM = document.getElementById('periodsTitleAM');
    const periodsTitlePM = document.getElementById('periodsTitlePM');
    const assignmentHint = document.getElementById('teacherAssignmentHint');
    const periodsHelper = document.getElementById('teacherPeriodsHelper');
    periodsListAM.innerHTML = '';
    periodsListPM.innerHTML = '';

    const allClasses = getInstitutionClasses();
    const schedule = (teacherAssignments[teacherId] && teacherAssignments[teacherId][dayName]) || {};
    const entries = [];
    const assignedPeriods = [];

    // Generate Checkboxes for 8 periods
    for (let i = 1; i <= 8; i++) {
        let entry = schedule[i];
        let className = ''; // Default empty for dropdown if no schedule
        let typeInfo = '';

        if (entry) {
            if (typeof entry === 'object') {
                className = entry.class || '';
                if (entry.type) typeInfo = entry.type;
            } else {
                className = entry;
            }
        }

        let normalizedClassName = className;
        if (typeof normalizeShortClassName === 'function' && className) {
            normalizedClassName = normalizeShortClassName(className) || className;
        }

        if (normalizedClassName) {
            assignedPeriods.push(i);
        }
        entries.push({
            period: i,
            className: normalizedClassName,
            typeInfo: typeInfo,
            hasAssignment: !!normalizedClassName
        });
    }

    const hasAssignments = assignedPeriods.length > 0;
    const displayEntries = hasAssignments ? entries.filter(item => item.hasAssignment) : entries;

    modal.dataset.teacherHasAssignments = hasAssignments ? 'true' : 'false';
    modal.dataset.teacherAssignedPeriods = JSON.stringify(assignedPeriods);
    modal.dataset.teacherVisiblePeriods = JSON.stringify(displayEntries.map(item => item.period));

    if (radioScopeFull && radioScopePartial) {
        if (existingData && existingData.type === 'partial') {
            radioScopePartial.checked = true;
        } else if (existingData && existingData.type === 'full') {
            radioScopeFull.checked = true;
        } else if (hasAssignments) {
            radioScopeFull.checked = true;
        } else {
            radioScopePartial.checked = true;
        }
    }

    if (assignmentHint) {
        assignmentHint.innerHTML = hasAssignments
            ? 'تم العثور على إسناد لهذا الأستاذ في هذا اليوم. الأقسام المعروضة مأخوذة من صفحة الإسناد، ويكفي تحديد الحصص التي غاب عنها.'
            : 'لا يوجد إسناد لهذا الأستاذ في هذا اليوم. اختر الحصص الغائب عنها ثم حدّد القسم يدويًا لكل حصة.';
    }

    if (periodsHelper) {
        periodsHelper.textContent = hasAssignments
            ? `الحصص الظاهرة هي الحصص المسندة فقط لهذا اليوم (${assignedPeriods.length} حصة). عند تحديدها جميعًا سيُسجل الغياب كغياب كامل لهذا اليوم.`
            : 'بما أنه لا يوجد إسناد لهذا الأستاذ، ستظهر جميع الحصص ويمكنك اختيار القسم يدويًا لكل حصة ثم تحديد الحصص التي تغيب فيها.';
    }

    displayEntries.forEach(item => {
        const i = item.period;
        const isChecked = !!(
            (existingData && existingData.periods && existingData.periods.includes(i)) ||
            (existingData && existingData.type === 'full' && (!existingData.periods || existingData.periods.length === 0))
        );
        const savedPeriodClass = (existingData && existingData.periodClasses) ? existingData.periodClasses[i] : null;
        const finalClass = savedPeriodClass || item.className;
        const selectDisabled = item.hasAssignment ? true : false;
        const selectOptions = item.hasAssignment
            ? `<option value="${finalClass}">${finalClass}${item.typeInfo ? ' - ' + item.typeInfo : ''}</option>`
            : `
                <option value="">-- اختر القسم --</option>
                ${allClasses.map(c => `<option value="${c}" ${c === finalClass ? 'selected' : ''}>${c}</option>`).join('')}
            `;

        const div = document.createElement('div');
        div.className = 'period-item-container';
        div.style.cssText = 'display: flex; flex-direction: column; gap: 5px; background: var(--card-bg); border: 1px solid var(--border-color); padding: 8px; border-radius: 8px;';

        div.innerHTML = `
            <label class="period-btn-label ${isChecked ? 'selected' : ''}" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border: 1px solid ${isChecked ? '#e74c3c' : 'var(--border-color)'}; border-radius: 8px; transition: all 0.2s; background: ${isChecked ? 'rgba(231, 76, 60, 0.1)' : 'transparent'};">
                <input type="checkbox" name="absencePeriod" value="${i}" ${isChecked ? 'checked' : ''} onchange="handlePeriodToggle(this)" style="width: 20px; height: 20px; accent-color: #e74c3c;">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: bold; color: var(--primary-color);">الحصة ${i}</span>
                    ${item.typeInfo ? `<span style="font-size:0.7rem; color:#e67e22;">${item.typeInfo}</span>` : ''}
                </div>
            </label>
            <select name="absencePeriodClass" data-period="${i}" class="modern-select" style="padding: 5px; font-size: 0.8rem; height: auto; width: 100%; margin-top: 5px;">
                <option value="">-- اختر القسم --</option>
                ${allClasses.map(c => `<option value="${c}" ${c === finalClass ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
        `;

        const selectEl = div.querySelector(`select[name="absencePeriodClass"][data-period="${i}"]`);
        if (selectEl) {
            selectEl.dataset.locked = item.hasAssignment ? 'true' : 'false';
            if (item.hasAssignment) {
                selectEl.innerHTML = `<option value="${finalClass}">${finalClass}${item.typeInfo ? ' - ' + item.typeInfo : ''}</option>`;
            }
            selectEl.disabled = selectDisabled;
            selectEl.style.opacity = item.hasAssignment ? '1' : (isChecked ? '1' : '0.85');
            if (!item.hasAssignment) {
                selectEl.style.borderStyle = isChecked ? 'solid' : 'dashed';
            }
        }

        if (i <= 4) periodsListAM.appendChild(div);
        else periodsListPM.appendChild(div);
    });

    if (periodsTitleAM) periodsTitleAM.style.display = periodsListAM.children.length > 0 ? 'block' : 'none';
    if (periodsListAM) periodsListAM.style.display = periodsListAM.children.length > 0 ? 'grid' : 'none';
    if (periodsTitlePM) periodsTitlePM.style.display = periodsListPM.children.length > 0 ? 'block' : 'none';
    if (periodsListPM) periodsListPM.style.display = periodsListPM.children.length > 0 ? 'grid' : 'none';

    toggleAbsenceType();
    updateTeacherAbsenceScope();

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    if (typeof updateTeacherAbsenceCount === 'function') updateTeacherAbsenceCount(); // Ensure flex for centering

}

function closeTeacherAbsenceModal() {
    const modal = document.getElementById('teacherAbsenceModal');
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    currentAbsenceTeacherId = null;
}

function toggleAbsenceType() {
    const radioAbsence = document.querySelector('input[name="absenceType"][value="full"]');
    const radioLate = document.querySelector('input[name="absenceType"][value="late"]');

    const isAbsence = radioAbsence ? radioAbsence.checked : false;
    const isLate = radioLate ? radioLate.checked : false;

    const periodsContainer = document.getElementById('periodsContainer');
    const lateContainer = document.getElementById('lateDurationContainer');
    const scopeContainer = document.getElementById('teacherAbsenceScopeContainer');

    if (periodsContainer) periodsContainer.style.display = isAbsence ? 'block' : 'none';
    if (lateContainer) lateContainer.style.display = isLate ? 'block' : 'none';
    if (scopeContainer) scopeContainer.style.display = isAbsence ? 'block' : 'none';
    if (isAbsence && typeof updateTeacherAbsenceScope === 'function') updateTeacherAbsenceScope();
    if (typeof updateTeacherAbsenceCount === 'function') updateTeacherAbsenceCount();
}

function updateTeacherAbsenceScope() {
    const modal = document.getElementById('teacherAbsenceModal');
    if (!modal) return;

    const scopeFull = document.querySelector('input[name="teacherAbsenceScope"][value="full"]');
    const isFullScope = scopeFull ? scopeFull.checked : false;
    const checkboxes = modal.querySelectorAll('input[name="absencePeriod"]');

    // When switching scope, uncheck all periods so user selects manually
    checkboxes.forEach(chk => {
        chk.disabled = false;
        if (typeof handlePeriodToggle === 'function') {
            handlePeriodToggle(chk);
        }
    });
}

async function saveTeacherAbsence() {

    if (!currentAbsenceTeacherId) return;

    const mode = document.querySelector('input[name="absenceType"]:checked').value;
    const isLate = (mode === 'late');
    const isAbsence = !isLate;
    const scope = document.querySelector('input[name="teacherAbsenceScope"]:checked') ? document.querySelector('input[name="teacherAbsenceScope"]:checked').value : 'full';
    let reason = '';
    if (isLate) {
        reason = (document.getElementById('teacherLateReason') ? document.getElementById('teacherLateReason').value : '');
    } else {
        const sel = document.getElementById('teacherAbsenceReason');
        reason = sel.value;
        if (reason === 'other') {
            reason = document.getElementById('teacherReasonOther').value.trim() || 'آخر';
        }
    }

    let lateDuration = 0;
    if (isLate) {
        lateDuration = parseInt(document.getElementById('teacherLateDuration').value) || 0;
        if (lateDuration <= 0) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى إدخال مدة التأخر بالدقائق' });
            return;
        }
    }

    let periods = [];
    let periodClasses = {};
    let hours = 0;

    if (isAbsence) {
        const modal = document.getElementById('teacherAbsenceModal');
        for (let i = 1; i <= 8; i++) {
            const chk = modal.querySelector(`input[name="absencePeriod"][value="${i}"]`);
            const selectEl = modal.querySelector(`select[name="absencePeriodClass"][data-period="${i}"]`);

            const isChecked = chk && chk.checked;

            if (isChecked) {
                if (!periods.includes(i)) periods.push(i);
                if (selectEl && selectEl.value !== '') {
                    periodClasses[i] = selectEl.value;
                }
            }
        }

        hours = periods.length;

        if (hours === 0) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى تحديد حصة تدريس واحدة على الأقل للغياب الجزئي.' });
            return;
        }
    } else if (isLate) {
        // Delay: no periods needed, hours = 0
        hours = 0;
    }

    let teacherType = 'late';
    if (isAbsence) {
        teacherType = scope === 'partial' ? 'partial' : 'full';
    }

    // Save to Map
    selectedTeachers.set(currentAbsenceTeacherId, {
        type: teacherType,
        reason: reason,
        periods: periods,
        periodClasses: periodClasses,
        hours: hours,
        lateDuration: lateDuration
    });

    // Save persistence

    await saveSavedAbsenceData();

    // Refresh Table

    renderTeachersTable();

    closeTeacherAbsenceModal();

}

async function removeTeacherAbsence(teacherId) {

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "هل أنت متأكد من حذف غياب هذا الأستاذ؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف',
        cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {

        selectedTeachers.delete(teacherId);

        renderTeachersTable();

    }

}

function getDayArabicName(dayIndex) {

    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    return days[dayIndex];

}

// Helper for robust ID

function getSafeStudentId(student) {

    if (student.id && student.id !== 'undefined' && student.id !== 'null') {

        return String(student.id);

    }

    // Fallback to Name combination if ID is missing

    return `${student.last_name}-${student.first_name}`;

}

// ==========================================

// Canteen Module Logic

// ==========================================

function switchCanteenMode(mode) {

    canteenMode = mode;

    // Update Buttons

    document.getElementById('btnCanteenBeneficiaries').classList.toggle('active', mode === 'beneficiaries');

    document.getElementById('btnCanteenTracking').classList.toggle('active', mode === 'tracking');

    const btnBen = document.getElementById('btnCanteenBeneficiaries');

    const btnTrack = document.getElementById('btnCanteenTracking');

    if (mode === 'beneficiaries') {

        btnBen.classList.remove('btn-outline');

        btnBen.classList.add('btn-primary');

        btnTrack.classList.remove('btn-primary');

        btnTrack.classList.add('btn-outline');

    } else {

        btnBen.classList.remove('btn-primary');

        btnBen.classList.add('btn-outline');

        btnTrack.classList.remove('btn-outline');

        btnTrack.classList.add('btn-primary');

    }

    // Toggle Views

    document.getElementById('canteenBeneficiariesView').style.display = mode === 'beneficiaries' ? 'block' : 'none';

    document.getElementById('canteenTrackingView').style.display = mode === 'tracking' ? 'block' : 'none';

    if (mode === 'beneficiaries') {

        renderCanteenBeneficiaries();

    } else {

        renderCanteenTracking();

    }

}

// 1. Beneficiaries Setup Mode

/**
 * Helper to sort students by Level, then Stream, then Class Number
 */
function sortStudentsByLevelStreamClass(a, b) {
    const levelOrder = {
        '1': 1, '1م': 1,
        '2': 2, '2م': 2,
        '3': 3, '3م': 3,
        '4': 4, '4م': 4,
        '1ث': 5, '2ث': 6, '3ث': 7
    };
    const valA = levelOrder[a.level] || 0;
    const valB = levelOrder[b.level] || 0;
    if (valA !== valB) return valA - valB;

    const streamA = a.stream || '';
    const streamB = b.stream || '';
    if (streamA !== streamB) return streamA.localeCompare(streamB, 'ar');

    const classA = parseInt(a.class_name || a.class || 0);
    const classB = parseInt(b.class_name || b.class || 0);
    if (classA !== classB) return classA - classB;

    return a.last_name.localeCompare(b.last_name, 'ar');
}

function renderCanteenBeneficiaries() {

    const tbody = document.getElementById('canteenBeneficiariesBody');

    const searchVal = document.getElementById('canteenSearchInput').value.trim().toLowerCase();

    // Filter students: Must be 'half_board' AND match search

    const filtered = allStudents.filter(s => {

        const sStatus = (s.status || '').toLowerCase();

        const isHalfBoard = sStatus === 'half_board' || sStatus.includes('نصف') || sStatus.includes('demi');

        const fullName = `${s.last_name} ${s.first_name}`.toLowerCase();

        return isHalfBoard && fullName.includes(searchVal);

    });

    // Sort: Beneficiaries first, then by level/stream/class
    filtered.sort((a, b) => {

        const idA = getSafeStudentId(a);

        const idB = getSafeStudentId(b);

        const isBenA = canteenBeneficiaries.some(id => String(id) === idA);

        const isBenB = canteenBeneficiaries.some(id => String(id) === idB);

        if (isBenA && !isBenB) return -1;

        if (!isBenA && isBenB) return 1;

        return sortStudentsByLevelStreamClass(a, b);

    });

    if (filtered.length === 0) {

        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">

            <div class="icon">ℹ️</div>

            <p>لا يوجد تلاميذ بصفة "نصف داخلي"</p>

        </td></tr>`;

        document.getElementById('totalBeneficiariesCount').textContent = canteenBeneficiaries.length;

        return;

    }

    tbody.innerHTML = filtered.map((s, idx) => {

        const sId = getSafeStudentId(s);

        const isChecked = canteenBeneficiaries.some(id => String(id) === sId);

        return `

            <tr class="${isChecked ? 'selected' : ''}">

                <td>${idx + 1}</td>

                <td style="font-weight:bold;">${s.last_name} ${s.first_name}</td>

                <td>${formatClass(s)}</td>

                <td>

                    <input type="checkbox" class="absence-checkbox"

                        ${isChecked ? 'checked' : ''}

                        onchange="toggleCanteenBeneficiary('${sId}', this)">

                </td>

            </tr>

        `;

    }).join('');

    document.getElementById('totalBeneficiariesCount').textContent = canteenBeneficiaries.length;

}

function filterCanteenBeneficiaries() {

    renderCanteenBeneficiaries();

}

async function toggleCanteenBeneficiary(studentId, checkbox) {

    if (checkbox.checked) {

        if (!canteenBeneficiaries.some(id => String(id) === String(studentId))) {

            canteenBeneficiaries.push(studentId);

        }

    } else {

        canteenBeneficiaries = canteenBeneficiaries.filter(id => String(id) !== String(studentId));

    }

    // Save

    await DB.set('canteenBeneficiaries', canteenBeneficiaries);

    // Re-render to update highlighting and counts

    renderCanteenBeneficiaries();

}

// 2. Daily Tracking Mode

function renderCanteenTracking() {

    const tbody = document.getElementById('canteenTrackingBody');

    // Get beneficiaries objects (Robust Match)

    let beneficiaries = allStudents.filter(s => {

        const sId = getSafeStudentId(s);

        return canteenBeneficiaries.some(id => String(id) === sId);

    });

    // Apply Filters (Search & Level)

    const searchText = (document.getElementById('canteenTrackingSearch').value || '').trim().toLowerCase();

    const levelFilter = document.getElementById('canteenTrackingLevelFilter').value || '';

    if (searchText || levelFilter) {

        beneficiaries = beneficiaries.filter(s => {

            // Level Filter

            if (levelFilter) {

                const mappedLevel = normalizeAcademicLevel(s.level);

                if (mappedLevel !== levelFilter) {

                    return false;

                }

            }

            // Search Filter

            if (searchText) {

                const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();

                const fullNameRev = `${s.last_name} ${s.first_name}`.toLowerCase();

                if (!fullName.includes(searchText) && !fullNameRev.includes(searchText)) {

                    return false;

                }

            }

            return true;

        });

    }

    // Sort by Level, Stream, then Class
    beneficiaries.sort(sortStudentsByLevelStreamClass);

    const currentDate = document.getElementById('absenceDate').value;

    const currentAbsences = canteenAbsences[currentDate] || [];

    if (beneficiaries.length === 0) {

        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">

            <div class="icon">🍴</div>

            <p>لم يتم تحديد أي مستفيدين من المطعم بعد.<br>انتقل إلى "تحديد المستفيدين" لإضافة تلاميذ.</p>

        </td></tr>`;

        document.getElementById('canteenAbsentCount').textContent = '0';

        return;

    }

    tbody.innerHTML = beneficiaries.map((s, idx) => {

        const sId = getSafeStudentId(s);

        const isAbsent = currentAbsences.some(id => String(id) === sId);

        return `

            <tr class="${isAbsent ? 'selected' : ''}">

                <td>${idx + 1}</td>

                <td style="font-weight:bold;">${s.last_name} ${s.first_name}</td>

                <td>${formatClass(s)}</td>

                <td>

                    <input type="checkbox" class="absence-checkbox"

                        ${isAbsent ? 'checked' : ''}

                        onchange="toggleCanteenAbsence('${sId}', this)">

                </td>

            </tr>

        `;

    }).join('');

    document.getElementById('canteenAbsentCount').textContent = currentAbsences.length;

}

async function toggleCanteenAbsence(studentId, checkbox) {

    const currentDate = document.getElementById('absenceDate').value;

    if (!canteenAbsences[currentDate]) {

        canteenAbsences[currentDate] = [];

    }

    if (checkbox.checked) {

        if (!canteenAbsences[currentDate].some(id => String(id) === String(studentId))) {

            canteenAbsences[currentDate].push(studentId);

        }

    } else {

        canteenAbsences[currentDate] = canteenAbsences[currentDate].filter(id => String(id) !== String(studentId));

    }

    // Clean up empty dates

    if (canteenAbsences[currentDate].length === 0) {

        delete canteenAbsences[currentDate];

    }

    // Save

    await DB.set('canteenAbsences', canteenAbsences);

    // Re-render stats and highlighting

    renderCanteenTracking();

}

function formatClass(student) {

    if (student.level) {

        const levelText = formatAcademicLevel(student.level, window.appSettings.educationStage || 'middle', false);

        // Ensure class name is two digits if it's a number

        let className = student.class_name || student.class || '';

        if (className && !isNaN(className) && className.length === 1) {

            className = '0' + className;

        }

        let result = `${levelText} ${className}`;

        // Secondary Format: [Level] [Stream] [ClassNum]
        if (window.appSettings && window.appSettings.educationStage === 'secondary') {
            const shortStream = typeof getShortStreamName === 'function' ? getShortStreamName(student.stream) : (student.stream || '');
            result = `${levelText} ${shortStream} ${className}`.replace(/\s+/g, ' ').trim();
        }

        return result;

    }

    // Fallback

    return `${student.class || ''} ${student.level || ''}`.trim() || '-';


}

/**
 * Get all unique classes in the institution
 * Used for Teacher Absence Modal dropdown
 */
function getInstitutionClasses() {
    const classSet = new Set();

    // 1. Collect from Students (Descriptive names)
    if (allStudents && allStudents.length > 0) {
        allStudents.forEach(s => {
            const classStr = formatClass(s);
            if (classStr && classStr !== '-') {
                classSet.add(classStr);
            }
        });
    }

    // 2. Collect from Teacher Assignments (Scheduled classes)
    if (teacherAssignments) {
        Object.values(teacherAssignments).forEach(teacherDays => {
            if (!teacherDays) return;
            Object.values(teacherDays).forEach(dayPeriods => {
                if (!dayPeriods) return;
                Object.values(dayPeriods).forEach(period => {
                    let cls = (typeof period === 'object') ? period.class : period;
                    if (cls && typeof cls === 'string' && cls.trim()) {
                        // Basic normalization if it looks like short-form "1م01"
                        const normCls = normalizeShortClassName(cls.trim());
                        classSet.add(normCls);
                    }
                });
            });
        });
    }

    // Sort classes numerically/alphabetically for the dropdown
    return Array.from(classSet).sort((a, b) => a.localeCompare(b, 'ar', { numeric: true }));
}

/**
 * Helper to convert short class names (e.g., 1م01) to descriptive names
 * to maintain consistency in the application.
 */
function normalizeShortClassName(cls) {
    if (!cls) return "";
    // Matches patterns like "1م01", "2ث03", "1 م 01"
    const match = cls.replace(/\s+/g, '').match(/^([1-4])([مث])(\d{1,2})$/);
    if (match) {
        const levelNum = match[1];
        const stage = match[2];
        const classNum = match[3].padStart(2, '0');

        let levelText = "";
        if (stage === 'م') {
            levelText = formatAcademicLevel(levelNum, 'middle', true);
        } else if (stage === 'ث') {
            levelText = formatAcademicLevel(levelNum, 'secondary', true);
        }

        if (levelText) return `${levelText} ${classNum}`;
    }
    return cls;
}

// 3. Canteen Daily Info Logic

let canteenDailyInfo = {}; // { "YYYY-MM-DD": { proposed: "", offered: "", notes: "" } }

window.saveCanteenDailyInfo = async function() {
    const date = document.getElementById('absenceDate').value;
    if (!date) return;
    canteenDailyInfo[date] = {
        proposed: document.getElementById('canteenProposedMeal').value,
        offered: document.getElementById('canteenOfferedMeal').value,
        notes: document.getElementById('canteenNotes').value
    };
    await DB.set('canteenDailyInfo', canteenDailyInfo);
    console.log('Saved canteen info for', date);
}
async function loadCanteenDailyInfo() {

    canteenDailyInfo = await DB.get('canteenDailyInfo') || {};

    const date = document.getElementById('absenceDate').value;

    // Clear first

    document.getElementById('canteenProposedMeal').value = '';

    document.getElementById('canteenOfferedMeal').value = '';

    document.getElementById('canteenNotes').value = '';

    if (canteenDailyInfo && canteenDailyInfo[date]) {

        const info = canteenDailyInfo[date];

        document.getElementById('canteenProposedMeal').value = info.proposed || '';

        document.getElementById('canteenOfferedMeal').value = info.offered || '';

        document.getElementById('canteenNotes').value = info.notes || '';

    }

}

// Hook into date change to reload info

const originalCheckAndLoad = window.checkAndLoadSavedAbsence;

// We can't easily hook into checkAndLoadSavedAbsence if it's not exposed or we want to overwrite.

// But we initialized listeners in initPage.

// We should add loadCanteenDailyInfo to the checkAndLoadSavedAbsence sequence or event listener.

// Actually, let's just add it to the 'change' listener in initPage or just re-bind here if possible.

// Better: checkAndLoadSavedAbsence is likely global if defined in top scope?

// No, it's defined inside? No, probably global.

// I will assume checkAndLoadSavedAbsence calls loadAllData? No.

// Let's just modify `checkAndLoadSavedAbsence` if I can find it, OR add a listener.

// Adding listener dynamically

document.addEventListener('DOMContentLoaded', () => {

    const dateEl = document.getElementById('absenceDate');

    if (dateEl) {

        dateEl.addEventListener('change', loadCanteenDailyInfo);

    }

});

// --- New Tab Logic: Notes & Escort ---

window.escortData = [];
window.notesData = [];

// Load data for specific date
window.loadFacilitiesData = async function (date) {
    if (!date) return;

    try {
        const savedEscort = await DB.get(`facilitiesData_${date}`);
        window.escortData = savedEscort || [];

        const savedNotes = await DB.get(`observationsData_${date}`);
        window.notesData = savedNotes || [];

        renderEscortTable();
        renderNotesTable();
    } catch (e) {
        console.error("Error loading facilities data:", e);
    }
};

// Save data for specific date
window.saveFacilitiesData = async function () {
    const date = document.getElementById('absenceDate').value;
    if (!date) return;

    try {
        await DB.set(`facilitiesData_${date}`, window.escortData);
        await DB.set(`observationsData_${date}`, window.notesData);
    } catch (e) {
        console.error("Error saving facilities data:", e);
    }
};

// Render Helper: Escort Table
function renderEscortTable() {
    const tableBody = document.getElementById('escortTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    window.escortData.forEach((item, index) => {
        const row = document.createElement('tr');
        row.dataset.id = item.id;

        row.innerHTML = `
            <td style="text-align:center;">${index + 1}</td>
            <td><input type="text" class="form-input" style="width:100%;" placeholder="المرفق (مثال: المخابر)" value="${item.facility || ''}" onchange="updateEscortData('${item.id}', 'facility', this.value)"></td>
            <td><input type="text" class="form-input" style="width:100%;" placeholder="النقائص" value="${item.deficiencies || ''}" onchange="updateEscortData('${item.id}', 'deficiencies', this.value)"></td>
            <td><input type="text" class="form-input" style="width:100%;" placeholder="ملاحظات" value="${item.notes || ''}" onchange="updateEscortData('${item.id}', 'notes', this.value)"></td>
            <td style="text-align:center;">
                <button class="btn btn-danger btn-sm" onclick="deleteEscortRow('${item.id}')" style="padding: 2px 5px;">❌</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Render Helper: Notes Table
function renderNotesTable() {
    const tableBody = document.getElementById('notesTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    window.notesData.forEach((item, index) => {
        const row = document.createElement('tr');
        row.dataset.id = item.id;

        row.innerHTML = `
            <td style="text-align:center;">${index + 1}</td>
            <td><input type="text" class="form-input" style="width:100%;" placeholder="الملاحظة / التوجيه" value="${item.text || ''}" onchange="updateNoteData('${item.id}', 'text', this.value)"></td>
            <td style="text-align:center;">
                <button class="btn btn-danger btn-sm" onclick="deleteNoteRow('${item.id}')" style="padding: 2px 5px;">❌</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

window.addEscortRow = function () {
    const rowId = Date.now();
    // Add empty object with new structure
    window.escortData.push({ id: rowId, facility: '', deficiencies: '', notes: '' });
    renderEscortTable();
    saveFacilitiesData();
};

window.updateEscortData = function (id, field, value) {
    const item = window.escortData.find(x => String(x.id) === String(id));
    if (item) {
        item[field] = value;
        saveFacilitiesData();
    }
};

window.deleteEscortRow = async function (id) {
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "هل أنت متأكد من حذف هذا السطر؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;
    window.escortData = window.escortData.filter(x => String(x.id) !== String(id));
    renderEscortTable();
    saveFacilitiesData();
};

window.addNoteRow = function () {
    const rowId = Date.now();
    window.notesData.push({ id: rowId, text: '' });
    renderNotesTable();
    saveFacilitiesData();
};

window.updateNoteData = function (id, field, value) {
    const item = window.notesData.find(x => String(x.id) === String(id));
    if (item) {
        item[field] = value;
        saveFacilitiesData();
    }
};

window.deleteNoteRow = async function (id) {
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "هل أنت متأكد من حذف هذا السطر؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;
    window.notesData = window.notesData.filter(x => String(x.id) !== String(id));
    renderNotesTable();
    saveFacilitiesData();
};

// ==========================================
// PREVIOUS ABSENCES MODAL LOGIC
// ==========================================

const PREVIOUS_ABSENCE_DAYS = 40;

function updatePreviousAbsenceRowState(row, isAbsent) {
    if (!row) return;

    row.classList.toggle('is-absent', isAbsent);

    const reasonSelect = row.querySelector('.prev-abs-reason');
    if (reasonSelect) {
        reasonSelect.disabled = !isAbsent;
    }
}

window.openPreviousAbsencesModal = async function (studentId, studentName) {
    document.getElementById('prevAbsStudentName').textContent = `سجل غيابات التلميذ: ${studentName}`;
    document.getElementById('prevAbsStudentId').value = studentId;
    document.getElementById('prevAbsDayCount').textContent = PREVIOUS_ABSENCE_DAYS;

    const tbody = document.getElementById('previousAbsencesBody');
    tbody.innerHTML = '<tr><td colspan="4">جاري التحميل...</td></tr>';

    document.getElementById('previousAbsencesModal').classList.add('active');
    document.getElementById('previousAbsencesModal').style.display = '';

    const rangeText = document.getElementById('prevAbsRangeText');

    // Get last 40 days
    const dates = [];
    const today = new Date();
    for (let i = 0; i < PREVIOUS_ABSENCE_DAYS; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }

    if (rangeText && dates.length > 0) {
        rangeText.textContent = `${dates[0]}  ←  ${dates[dates.length - 1]}`;
    }

    if (rangeText && dates.length > 0) {
        const latestDate = dates[0];
        const oldestDate = dates[dates.length - 1];
        rangeText.textContent = latestDate + ' - ' + oldestDate;
    }

    // Get all records
    const allAbsenceRecords = await getCachedAbsenceRecords();

    tbody.innerHTML = '';

    // Render Rows
    dates.forEach(dateStr => {
        const record = allAbsenceRecords.find(r => r.date === dateStr);
        let studentData = null;

        if (record && record.students) {
            studentData = record.students.find(s => String(s.id) === String(studentId));
        }

        const amChecked = studentData && studentData.am && studentData.am.from !== '-';
        const pmChecked = studentData && studentData.pm && studentData.pm.from !== '-';
        const isAbsent = amChecked || pmChecked;

        const reason = studentData ? (studentData.reason || '') : '';

        const tr = document.createElement('tr');
        tr.className = 'prev-abs-row';

        // Date formatting
        const dateObj = new Date(dateStr);
        const dayName = new Intl.DateTimeFormat('ar-DZ', { weekday: 'long' }).format(dateObj);

        tr.innerHTML = `
            <td class="previous-absences-date">${dateStr}</td>
            <td class="previous-absences-day">${dayName}</td>
            <td style="text-align:center;">
                <input type="checkbox" class="prev-abs-chk prev-abs-checkbox" data-date="${dateStr}" ${isAbsent ? 'checked' : ''}>
            </td>
            <td>
                <select class="prev-abs-reason reason-select" data-date="${dateStr}">
                    <option value="" ${reason === '' ? 'selected' : ''}>--</option>
                    <option value="برير" ${reason === 'برير' ? 'selected' : ''}>مُبرر</option>
                    <option value="غير مبرر" ${reason === 'غير مبرر' ? 'selected' : ''}>غير مُبرر</option>
                    <option value="مرض" ${reason === 'مرض' ? 'selected' : ''}>مرض</option>
                    <option value="تأخر" ${reason === 'تأخر' ? 'selected' : ''}>تأخر</option>
                </select>
            </td>
        `;
        const checkbox = tr.querySelector('.prev-abs-chk');
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                updatePreviousAbsenceRowState(tr, checkbox.checked);
            });
        }

        updatePreviousAbsenceRowState(tr, isAbsent);
        tbody.appendChild(tr);
    });
};

window.savePreviousAbsences = async function () {
    const studentId = document.getElementById('prevAbsStudentId').value;
    if (!studentId) return;

    const rows = document.getElementById('previousAbsencesBody').querySelectorAll('tr');

    // Get fresh records
    let allAbsenceRecords = cloneAbsenceRecords(await getCachedAbsenceRecords());

    const modifiedRecords = new Set();

    // Process each row
    rows.forEach(row => {
        const absChk = row.querySelector('.prev-abs-chk');
        const reasonSel = row.querySelector('.prev-abs-reason');

        if (!absChk) return; // Skip header or empty

        const dateStr = absChk.dataset.date;
        const isAbsent = absChk.checked;
        const reason = reasonSel.value;

        // Find record index specifically for 'ALL' or legacy missing period
        let recordIndex = allAbsenceRecords.findIndex(r => r.date === dateStr && (!r.period || r.period === 'ALL'));

        if (recordIndex === -1) {
            // Create new record for date if it doesn't exist AND we have an absence to save
            if (!isAbsent) return; // Nothing to save for this date

            allAbsenceRecords.push({
                date: dateStr,
                period: 'ALL',
                students: [],
                teachers: [],
                supervisors: [],
                canteen: [],
                stats: { total: 0, justified: 0, unjustified: 0 },
                notes: {}
            });
            recordIndex = allAbsenceRecords.length - 1;
        }

        const record = allAbsenceRecords[recordIndex];
        modifiedRecords.add(record); // Track modified record

        if (!record.students) record.students = [];

        // Remove existing student entry for this date
        record.students = record.students.filter(s => String(s.id) !== String(studentId));

        // Add back if absent
        if (isAbsent) {
            // We need basic student info. We can find it in global allStudents
            const studentInfo = allStudents.find(s => String(s.id) === String(studentId)) || {};

            // Get dynamic times based on Schedule Settings
            let amDefaultFrom = '08:00'; let amDefaultTo = '12:00';
            let pmDefaultFrom = '13:00'; let pmDefaultTo = '17:00';

            if (window.getScheduleForDate) {
                const dailySchedule = window.getScheduleForDate(dateStr);
                if (dailySchedule) {
                    amDefaultFrom = dailySchedule.am_from || amDefaultFrom;
                    amDefaultTo = dailySchedule.am_to || amDefaultTo;
                    pmDefaultFrom = dailySchedule.pm_from !== '' ? dailySchedule.pm_from : '-';
                    pmDefaultTo = dailySchedule.pm_to !== '' ? dailySchedule.pm_to : '-';
                    if (dailySchedule.am_from === '') amDefaultFrom = '-';
                    if (dailySchedule.am_to === '') amDefaultTo = '-';
                }
            }

            const newEntry = {
                id: studentId,
                last_name: studentInfo.last_name || '',
                first_name: studentInfo.first_name || '',
                class: studentInfo.class || '',
                level: studentInfo.level || '',
                stream: studentInfo.stream || '',
                reason: reason,
                am: { from: amDefaultFrom, to: amDefaultTo },
                pm: { from: pmDefaultFrom, to: pmDefaultTo }
            };
            record.students.push(newEntry);
        }
    });

    // Save modified records ONLY
    let successCount = 0;
    console.log(`[savePreviousAbsences] Saving ${modifiedRecords.size} modified records to DB`);
    for (const rec of modifiedRecords) {
        console.log(`[savePreviousAbsences] Saving record for date: ${rec.date}, students count: ${rec.students.length}`);
        try {
            const res = await DB.saveDayAbsences(rec);
            console.log(`[savePreviousAbsences] DB.saveDayAbsences result for ${rec.date}:`, res);
            if (res) successCount++;
        } catch (err) {
            console.error(`[savePreviousAbsences] Error saving record for ${rec.date}:`, err);
        }
    }
    console.log(`[savePreviousAbsences] Successfully saved ${successCount} out of ${modifiedRecords.size} records`);
    invalidateAbsenceRecordsCache();

    // Show toast if available or alert
    if (typeof showToast === 'function') {
        showToast('✅ تم حفظ تغييرات الغيابات بنجاح');
    } else {
        Swal.fire({
            icon: 'success',
            title: 'تم الحفظ',
            text: 'تم حفظ التغييرات بنجاح',
            timer: 2000,
            showConfirmButton: false
        });
    }
    closeModal('previousAbsencesModal');

    // IMPORTANT: Sync UI safely by using the modified array directly (avoids DB read-write race conditions)
    const currentDate = document.getElementById('absenceDate').value;
    const currentPeriod = document.getElementById('periodSelect') ? document.getElementById('periodSelect').value : 'ALL';

    // Update global context for calculations
    window.allAbsenceRecords = allAbsenceRecords;

    // Manually push to selectedStudents mapping to guarantee flawless UI reflection
    const currentRecord = allAbsenceRecords.find(r => r.date === currentDate && (!r.period || r.period === currentPeriod));
    selectedStudents.clear();

    if (currentRecord && currentRecord.students) {
        if (!window.studentReasons) window.studentReasons = new Map();
        window.studentReasons.clear();

        currentRecord.students.forEach(s => {
            selectedStudents.set(String(s.id), {
                am: s.am || { from: '08:00', to: '12:00' },
                pm: s.pm || { from: '13:00', to: '17:00' },
                reason: s.reason || '',
                confirmed: true
            });
            window.studentReasons.set(s.id, s.reason || '');
        });
    }

    // Refresh tables safely to show updates
    if (typeof loadStudentsTable === 'function') {
        loadStudentsTable();
    }
    if (typeof updateStudentStats === 'function') {
        updateStudentStats();
    }
};

/* --- Schedule Settings Logic --- */
let weeklyScheduleSettings = {};

window.loadScheduleSettings = async function () {
    weeklyScheduleSettings = await DB.get('weeklyScheduleSettings') || {};
    console.log('Loaded weekly schedule settings:', weeklyScheduleSettings);
};

window.openScheduleSettingsModal = function () {
    window.loadScheduleSettings().then(() => {
        const modal = document.getElementById('scheduleSettingsModal');
        const container = document.getElementById('scheduleSettingsBody');
        container.innerHTML = '';

        const days = [
            { id: 'sun', label: 'الأحد', dayIndex: 0 },
            { id: 'mon', label: 'الاثنين', dayIndex: 1 },
            { id: 'tue', label: 'الثلاثاء', dayIndex: 2 },
            { id: 'wed', label: 'الأربعاء', dayIndex: 3 },
            { id: 'thu', label: 'الخميس', dayIndex: 4 }
        ];

        days.forEach(day => {
            const settings = weeklyScheduleSettings[day.id] || {
                am_from: '08:00', am_to: '12:00',
                pm_from: '13:00', pm_to: '17:00'
            };

            const dayDiv = document.createElement('div');
            dayDiv.className = 'schedule-grid-row';

            dayDiv.innerHTML = `
                <div class="day-label">
                    <span class="day-icon">📅</span>
                    ${day.label}
                </div>

                <div class="time-group">
                    <span class="time-label">من:</span>
                    <input type="time" id="${day.id}_am_from" value="${settings.am_from}">
                    <span class="time-label" style="margin-right:10px;">إلى:</span>
                    <input type="time" id="${day.id}_am_to" value="${settings.am_to}">
                </div>

                <div class="time-group">
                    <span class="time-label">من:</span>
                    <input type="time" id="${day.id}_pm_from" value="${settings.pm_from}">
                    <span class="time-label" style="margin-right:10px;">إلى:</span>
                    <input type="time" id="${day.id}_pm_to" value="${settings.pm_to}">
                </div>
            `;
            container.appendChild(dayDiv);
        });

        modal.classList.add('active');

        // Load the count gap days setting (default true)
        const countGapDaysCheck = document.getElementById('countGapDaysCheck');
        if (countGapDaysCheck) {
            countGapDaysCheck.checked = weeklyScheduleSettings.countGapDays !== false;
        }
    });
};

window.closeScheduleSettingsModal = function () {
    document.getElementById('scheduleSettingsModal').classList.remove('active');
};

window.saveScheduleSettings = async function () {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu'];
    const newSettings = {};

    days.forEach(dayId => {
        newSettings[dayId] = {
            am_from: document.getElementById(`${dayId}_am_from`).value,
            am_to: document.getElementById(`${dayId}_am_to`).value,
            pm_from: document.getElementById(`${dayId}_pm_from`).value,
            pm_to: document.getElementById(`${dayId}_pm_to`).value
        };
    });

    weeklyScheduleSettings = newSettings;

    // Save count gap days setting
    const countGapDaysCheck = document.getElementById('countGapDaysCheck');
    if (countGapDaysCheck) {
        weeklyScheduleSettings.countGapDays = countGapDaysCheck.checked;
    }

    await DB.set('weeklyScheduleSettings', weeklyScheduleSettings);

    if (typeof showToast === 'function') {
        showToast('تم حفظ إعدادات التوقيت بنجاح', 'success');
    } else {
        Swal.fire({
            icon: 'success',
            title: 'تم الحفظ',
            text: 'تم حفظ إعدادات التوقيت بنجاح',
            timer: 2000,
            showConfirmButton: false
        });
    }

    closeScheduleSettingsModal();

    // Refresh table to apply new defaults
    if (typeof loadStudentsTable === 'function') {
        loadStudentsTable();
    }
};

window.getScheduleForDate = function (dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const day = date.getDay(); // 0 is Sunday

    const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayId = dayMap[day];

    if (weeklyScheduleSettings && weeklyScheduleSettings[dayId]) {
        return weeklyScheduleSettings[dayId];
    }
    // Return null to allow fallback to standard defaults
    return null;
};

window.calculateConsecutiveDays = function (studentId, currentDateStr, allAbsenceRecords, isSelectedToday) {
    // If we want the streak to represent an ACTUAL running streak as of today,
    // and the student is explicitly NOT absent today, the running streak is instantly broken.
    if (!isSelectedToday) return 0;

    let consecutiveCount = 1; // 1 for today

    const currDate = new Date(currentDateStr);
    const shouldCountGapDays = weeklyScheduleSettings && weeklyScheduleSettings.countGapDays !== false;

    // Helper to check absence status for a specific date
    const getAbsenceStatus = (dateStr) => {
        const record = allAbsenceRecords.find(r => r.date === dateStr);
        if (!record) return null; // No record exists
        if (!record.students || record.students.length === 0) return false; // Record exists but 0 absences = everyone present
        return record.students.some(s => String(s.id) === String(studentId));
    };

    let checkDate = new Date(currDate);
    checkDate.setDate(checkDate.getDate() - 1);

    let pendingGap = 0;

    while (true) {
        const checkDateStr = checkDate.toISOString().split('T')[0];
        const dayOfWeek = checkDate.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

        const absentStatus = getAbsenceStatus(checkDateStr);

        if (absentStatus === true) {
            // Student was absent.
            if (shouldCountGapDays) {
                // Add the pending gap (weekends/holidays) + 1 for this day
                consecutiveCount += pendingGap + 1;
            } else {
                // Strict counting: ignore gaps, just add 1
                consecutiveCount += 1;
            }
            pendingGap = 0; // reset for the next sequence
        } else if (absentStatus === false) {
            // Record exists, and student was NOT absent. Streak is legitimately broken.
            break;
        } else {
            // absentStatus === null (No record exists for this day)
            // لا يوجد سجل = المدرسة مغلقة (عطلة/عيد وطني/إجازة)
            // إذا تم فتح التطبيق وتسجيل الحضور (حتى لو 0 غائب) يُنشأ سجل بـ students:[]
            // وبالتالي absentStatus=false يقطع السلسلة. أما null = لم يُفتح التطبيق أصلاً
            pendingGap++;
        }

        // Step back one day
        checkDate.setDate(checkDate.getDate() - 1);

        // Failsafe: don't analyze more than 60 days into the past to prevent infinite loops
        if (Math.abs(currDate - checkDate) > 60 * 24 * 60 * 60 * 1000) {
            break;
        }
    }

    return consecutiveCount;
};

/* --- Modal Helpers --- */
window.openModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
};

window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
};

/* ========== Report Log System ========== */

let _reportLogShowAll = false;

/**
 * Get Arabic day name from date string
 */
function getArabicDayName(dateStr) {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const d = new Date(dateStr);
    return days[d.getDay()];
}

/**
 * Create a new absence report for the selected date
 */
window.createNewReport = async function () {
    const dateInput = document.getElementById('absenceDate');
    const date = dateInput ? dateInput.value : '';

    if (!date) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى تحديد التاريخ أولاً.' });
        return;
    }

    // Check if a report already exists for this date
    const period = document.getElementById('periodSelect') ? document.getElementById('periodSelect').value : 'ALL';
    const existing = await DB.getDayAbsences(date, period);

    if (existing && existing.students && existing.students.length > 0) {
        const result = await Swal.fire({
            icon: 'question',
            title: 'تقرير موجود',
            html: `يوجد تقرير بتاريخ <b>${date}</b> يحتوي على <b>${existing.students.length}</b> تلميذ غائب.<br>ماذا تريد أن تفعل؟`,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '✏️ تعديل التقرير الحالي',
            denyButtonText: '🆕 إنشاء تقرير جديد (مسح البيانات)',
            cancelButtonText: 'إلغاء',
            reverseButtons: true
        });

        if (result.isConfirmed) {
            // Load existing report for editing
            await editReport(date);
            return;
        } else if (result.isDenied) {
            // Create fresh — clear all selections
            selectedStudents.clear();
            selectedTeachers.clear();
            selectedSupervisors.clear();
            if (document.getElementById('reportNumber')) document.getElementById('reportNumber').value = '';
            // Silent save to clear DB entry for this date/period
            await saveSavedAbsenceData(false);
            setSaveStatus('idle', 'تقرير جديد جاهز للتعبئة');
            showToast('تم البدء بتقرير جديد (تم مسح البيانات السابقة لهذا اليوم)', 'info');
        } else {
            return; // Cancelled
        }
    } else {
        // No existing report — clear and start fresh
        selectedStudents.clear();
        selectedTeachers.clear();
        selectedSupervisors.clear();
        if (document.getElementById('reportNumber')) document.getElementById('reportNumber').value = '';
        await saveSavedAbsenceData(false);
        showToast('جاهز لإنشاء تقرير جديد', 'success');
        updateActionButtonUI(false);
        setSaveStatus('idle', 'لا يوجد تقرير محفوظ لهذا اليوم');
    }

    // Refresh UI
    if (typeof loadStudentsTable === 'function') loadStudentsTable();
    if (typeof updateStudentStats === 'function') updateStudentStats();
    if (typeof loadTeachersAbsenceTable === 'function') loadTeachersAbsenceTable();
    if (typeof loadSupervisorsAbsenceTable === 'function') loadSupervisorsAbsenceTable();

    await loadReportLog();

    Swal.fire({
        icon: 'success',
        title: 'تم إنشاء التقرير',
        text: `تم إنشاء تقرير جديد لتاريخ ${date} (${getArabicDayName(date)})`,
        timer: 2500,
        showConfirmButton: false
    });
};

/**
 * Load and render the report log
 */
window.loadReportLog = async function () {
    const container = document.getElementById('reportLogList');
    const countSpan = document.getElementById('reportLogCount');
    const showAllBtn = document.getElementById('btnShowAllReports');
    if (!container) return;

    try {
        // Ensure holidays are loaded
        if (appHolidays.length === 0) await loadHolidays();

        const allRecords = [...await getCachedAbsenceRecords()];

        // Filter out weekends and holidays from the log per user request
        const filteredRecords = allRecords.filter(record => {
            const isWeekendDay = isWeekend(record.date);
            const isHolidayDay = isHoliday(record.date);
            return !isWeekendDay && !isHolidayDay;
        });

        const totalCount = filteredRecords.length;

        if (totalCount === 0) {
            container.innerHTML = '<div class="report-log-empty">📭 لا توجد تقارير محفوظة بعد</div>';
            if (countSpan) countSpan.textContent = '';
            if (showAllBtn) showAllBtn.style.display = 'none';
            return;
        }

        if (countSpan) countSpan.textContent = `${totalCount} تقرير`;

        // Show 10 or all
        const displayRecords = _reportLogShowAll ? filteredRecords : filteredRecords.slice(0, 10);

        const currentDate = document.getElementById('absenceDate') ? document.getElementById('absenceDate').value : '';

        container.innerHTML = displayRecords.map(record => {
            const dayName = getArabicDayName(record.date);
            const studentCount = record.students ? record.students.length : 0;
            const teacherCount = record.teachers ? record.teachers.length : 0;
            const isActive = record.date === currentDate;
            const isWeekendDay = isWeekend(record.date);
            const isHolidayDay = isHoliday(record.date);
            const reportNumDisplay = (record.report_number !== undefined && record.report_number !== null && record.report_number !== '') ? record.report_number : '-';
            const hasReportNum = (record.report_number !== undefined && record.report_number !== null && record.report_number !== '');

            return `<div class="report-log-item ${isActive ? 'active-report' : ''}">
                <div class="report-log-badge ${hasReportNum ? 'has-num' : 'no-num'}">
                    <i class="fas fa-file-alt"></i>
                    <span>${reportNumDisplay}</span>
                </div>
                <div class="report-log-info">
                    <span class="report-log-date"><i class="far fa-calendar-alt"></i> ${record.date}</span>
                    <span class="report-log-day">${dayName} ${(isWeekendDay || isHolidayDay) ? ' (عطلة)' : ''}</span>
                </div>
                <div class="report-log-stats">
                    <span class="mini-badge-v2 student"><i class="fas fa-user-graduate"></i> ${studentCount}</span>
                    ${teacherCount > 0 ? `<span class="mini-badge-v2 teacher"><i class="fas fa-chalkboard-teacher"></i> ${teacherCount}</span>` : ''}
                </div>
                <div class="report-log-actions">
                    <button class="btn-icon-action edit" onclick="editReport('${record.date}')" title="تعديل">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="btn-icon-action delete" onclick="deleteReport('${record.date}')" title="حذف">
                        <i class="fas fa-trash-alt"></i> حذف
                    </button>
                </div>
            </div>`;
        }).join('');

        // Show/hide "show all" button
        if (showAllBtn) {
            if (totalCount > 10) {
                showAllBtn.style.display = 'block';
                showAllBtn.textContent = _reportLogShowAll
                    ? `📁 عرض آخر 10 تقارير فقط`
                    : `📂 عرض جميع التقارير (${totalCount})`;
            } else {
                showAllBtn.style.display = 'none';
            }
        }
    } catch (e) {
        console.error('Error loading report log:', e);
        container.innerHTML = '<div class="report-log-empty">❌ خطأ في تحميل سجل التقارير</div>';
    }
};

/**
 * Toggle visibility of the report log list
 */
window.toggleReportLog = function () {
    const list = document.getElementById('reportLogList');
    const btn = document.getElementById('btnToggleLog');
    const showAllBtn = document.getElementById('btnShowAllReports');

    if (!list || !btn) return;

    if (list.style.display === 'none') {
        list.style.display = 'block';
        // Only show "show all" if it was supposed to be shown (loadReportLog handles this, so we re-call loadReportLog)
        loadReportLog();
        btn.innerHTML = '👁️ إخفاء السجل';
    } else {
        list.style.display = 'none';
        if (showAllBtn) showAllBtn.style.display = 'none';
        btn.innerHTML = '👁️ عرض السجل';
    }
};

/**
 * Toggle showing all reports vs last 10
 */
window.toggleShowAllReports = function () {
    _reportLogShowAll = !_reportLogShowAll;
    loadReportLog();
};

/**
 * Edit an existing report (load it)
 */
window.editReport = async function (date) {
    const dateInput = document.getElementById('absenceDate');
    if (dateInput) {
        dateInput.value = date;
        if (typeof updateDayName === 'function') updateDayName();
    }

    // Load the saved data for this date
    if (typeof checkAndLoadSavedAbsence === 'function') {
        await checkAndLoadSavedAbsence();
    }

    await loadReportLog();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

/**
 * Delete a report after confirmation
 */
window.deleteReport = async function (date) {
    const dayName = getArabicDayName(date);

    const result = await Swal.fire({
        icon: 'warning',
        title: 'حذف التقرير',
        html: `هل أنت متأكد من حذف تقرير يوم <b>${dayName}</b> بتاريخ <b>${date}</b>؟<br><span style="color:#e74c3c; font-weight:bold;">⚠️ لا يمكن التراجع عن هذا الإجراء</span>`,
        showCancelButton: true,
        confirmButtonText: '🗑️ نعم، احذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#e74c3c'
    });

    if (!result.isConfirmed) return;

    try {
        // Delete from DB
        const period = document.getElementById('periodSelect') ? document.getElementById('periodSelect').value : 'ALL';
        await DB.deleteDayAbsences(date, period);
        invalidateAbsenceRecordsCache();
        setSaveStatus('saved', 'تم حذف التقرير');

        // If the deleted report is currently loaded, clear the UI
        const currentDate = document.getElementById('absenceDate') ? document.getElementById('absenceDate').value : '';
        if (currentDate === date) {
            selectedStudents.clear();
            selectedTeachers.clear();
            selectedSupervisors.clear();
            if (typeof loadStudentsTable === 'function') loadStudentsTable();
            if (typeof updateStudentStats === 'function') updateStudentStats();
            if (typeof loadTeachersAbsenceTable === 'function') loadTeachersAbsenceTable();
            if (typeof loadSupervisorsAbsenceTable === 'function') loadSupervisorsAbsenceTable();
        }

        await loadReportLog();

        Swal.fire({
            icon: 'success',
            title: 'تم الحذف',
            text: `تم حذف تقرير ${date} بنجاح`,
            timer: 2000,
            showConfirmButton: false
        });
    } catch (e) {
        console.error('Error deleting report:', e);
        setSaveStatus('error', 'تعذر حذف التقرير');
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء حذف التقرير.' });
    }
};

// ============================================================
// Holiday Management UI Functions
// ============================================================

window.openHolidaysModal = async function () {
    await loadHolidays();
    renderHolidaysList();
    const modal = document.getElementById('holidaysModal');
    if (modal) modal.style.display = 'flex';
};

window.closeHolidaysModal = function () {
    const modal = document.getElementById('holidaysModal');
    if (modal) modal.style.display = 'none';
};

window.addHoliday = async function () {
    const dateInput = document.getElementById('holidayDateInput');
    const dateEndInput = document.getElementById('holidayDateEndInput');
    const typeInput = document.getElementById('holidayTypeInput');
    if (!dateInput || !dateInput.value) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى تحديد تاريخ بداية العطلة.' });
        return;
    }

    const startDate = dateInput.value;
    const endDate = (dateEndInput && dateEndInput.value) ? dateEndInput.value : startDate;
    const type = typeInput ? typeInput.value : 'رسمية';

    // Validate range
    if (endDate < startDate) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.' });
        return;
    }

    // Generate all dates in the range
    const datesToAdd = [];
    let current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        if (!appHolidays.some(h => h.date === dateStr)) {
            datesToAdd.push({ date: dateStr, type: type });
        }
        current.setDate(current.getDate() + 1);
    }

    if (datesToAdd.length === 0) {
        Swal.fire({ icon: 'info', title: 'موجود', text: 'جميع أيام هذه الفترة مسجلة كعطل بالفعل.' });
        return;
    }

    appHolidays.push(...datesToAdd);
    appHolidays.sort((a, b) => a.date.localeCompare(b.date));
    await DB.set('app_holidays', appHolidays);

    dateInput.value = '';
    if (dateEndInput) dateEndInput.value = '';
    renderHolidaysList();
    await loadReportLog();

    const msg = datesToAdd.length === 1
        ? `تم إضافة عطلة ${datesToAdd[0].date} بنجاح.`
        : `تم إضافة ${datesToAdd.length} يوم عطلة (من ${startDate} إلى ${endDate}) بنجاح.`;
    Swal.fire({ icon: 'success', title: 'تمت الإضافة', text: msg, timer: 2000, showConfirmButton: false });
};

window.removeHoliday = async function (date) {
    const result = await Swal.fire({
        icon: 'question',
        title: 'حذف العطلة',
        text: `هل تريد حذف عطلة ${date}؟`,
        showCancelButton: true,
        confirmButtonText: 'نعم',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    appHolidays = appHolidays.filter(h => h.date !== date);
    await DB.set('app_holidays', appHolidays);
    renderHolidaysList();
    await loadReportLog();
};

function renderHolidaysList() {
    const tbody = document.getElementById('holidaysListBody');
    if (!tbody) return;

    if (appHolidays.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 15px; color: #999;">لا توجد عطل مسجلة</td></tr>';
        return;
    }

    tbody.innerHTML = appHolidays.map(h => {
        const dayName = getArabicDayName(h.date);
        return `<tr>
            <td style="padding: 6px; border: 1px solid #ddd;">${h.date}</td>
            <td style="padding: 6px; border: 1px solid #ddd;">${dayName}</td>
            <td style="padding: 6px; border: 1px solid #ddd;"><span style="background:#e8f8f5;color:#1abc9c;padding:2px 8px;border-radius:4px;font-size:0.85rem;">${h.type}</span></td>
            <td style="padding: 6px; border: 1px solid #ddd;"><button onclick="removeHoliday('${h.date}')" style="background:#e74c3c;color:white;border:none;padding:3px 10px;border-radius:4px;cursor:pointer;font-family:Cairo,sans-serif;">حذف</button></td>
        </tr>`;
    }).join('');
}

function updateTeacherAbsenceCount() {
    const modal = document.getElementById('teacherAbsenceModal');
    if (!modal) return;
    const checked = modal.querySelectorAll('input[name="absencePeriod"]:checked');
    const countEl = document.getElementById('teacherSelectedCount');
    if (countEl) {
        countEl.textContent = checked.length;
    }
}
function handlePeriodToggle(chk) {
    const label = chk.closest('.period-btn-label');
    const container = chk.closest('.period-item-container');
    if (label) {
        if (chk.checked) {
            label.classList.add('selected');
            label.style.background = 'rgba(231, 76, 60, 0.1)';
            label.style.borderColor = '#e74c3c';
        } else {
            label.classList.remove('selected');
            label.style.background = 'transparent';
            label.style.borderColor = 'var(--border-color)';
        }
    }
    if (container) {
        const selectEl = container.querySelector('select[name="absencePeriodClass"]');
        if (selectEl && selectEl.dataset.locked !== 'true') {
            selectEl.disabled = false;
            selectEl.style.opacity = chk.checked ? '1' : '0.85';
            selectEl.style.borderStyle = chk.checked ? 'solid' : 'dashed';
        }
    }
    if (typeof updateTeacherAbsenceCount === 'function') updateTeacherAbsenceCount();
}
