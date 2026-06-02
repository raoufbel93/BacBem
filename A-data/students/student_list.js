// SweetAlert2 Toast Definition
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

function showToast(message, icon = 'success') {
    Toast.fire({
        icon: icon,
        title: message
    });
}

const studentListState = window.StudentListState || {};

let allStudents = Array.isArray(studentListState.allStudents) ? studentListState.allStudents : [];

let filteredStudents = Array.isArray(studentListState.filteredStudents) ? studentListState.filteredStudents : [];

// Guard flag: prevents filterStudents() from firing during page initialization
// Avoids the flash/disappear bug caused by cascading change events from populateFilters()
let _isInitializing = typeof studentListState.isInitializing === 'boolean' ? studentListState.isInitializing : true;

let studentToDeleteIndex = Number.isInteger(studentListState.studentToDeleteIndex) ? studentListState.studentToDeleteIndex : -1;

let studentToStrikeIndex = Number.isInteger(studentListState.studentToStrikeIndex) ? studentListState.studentToStrikeIndex : -1;

let educationStage = studentListState.educationStage || 'middle'; // Default
const studentListStorage = studentListState.storage || window.AppStorage || {
    getItem: function (key, fallbackValue) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallbackValue : value;
        } catch (e) {
            return fallbackValue;
        }
    },
    setItem: function (key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            return false;
        }
    },
    getJSON: function (key, fallbackValue) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallbackValue;
        } catch (e) {
            return fallbackValue;
        }
    },
    setJSON: function (key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    }
};

// React Definitions
const e = React.createElement;
let reactRoot = studentListState.reactRoot || null;
const studentListUi = window.StudentListUI || {};
const createActionDropdownInstance = studentListUi.createActionDropdownInstance;
const closeOpenActionDropdowns = studentListUi.closeOpenActionDropdowns;
const studentListService = window.StudentListService || null;

function getAcademicHelper() {
    return window.AppAcademic || {};
}

function getLevelRank(level) {
    const helper = getAcademicHelper();
    if (helper && typeof helper.getLevelRank === 'function') {
        return helper.getLevelRank(level);
    }

    const match = String(level || '').match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}

function isValidLevelForCurrentStage(level) {
    const helper = getAcademicHelper();
    if (helper && typeof helper.isValidLevelForStage === 'function') {
        return helper.isValidLevelForStage(level, educationStage);
    }

    return !!normalizeLevel(level);
}

function syncStudentListState(partial) {
    if (window.StudentListState && typeof window.StudentListState.sync === 'function') {
        window.StudentListState.sync(partial);
    }
}

syncStudentListState({
    allStudents: allStudents,
    filteredStudents: filteredStudents,
    isInitializing: _isInitializing,
    studentToDeleteIndex: studentToDeleteIndex,
    studentToStrikeIndex: studentToStrikeIndex,
    educationStage: educationStage,
    reactRoot: reactRoot
});

function executeStudentAction(action, index) {
    const realIndex = Number(index);
    if (!Number.isInteger(realIndex) || realIndex < 0) return;

    switch (action) {
        case 'edit':
            openEditModal(realIndex);
            break;
        case 'transfer':
            openTransferModal(realIndex);
            break;
        case 'info':
            openStudentInfoModal(realIndex);
            break;
        case 'summons':
            printSummons(realIndex);
            break;
        case 'status':
            openStatusModal(realIndex);
            break;
        case 'email':
            emailParent(realIndex);
            break;
        case 'strike':
            openStrikeModal(realIndex);
            break;
        default:
            console.warn('Unknown student action:', action, index);
    }
}

function closeStudentActionMenuFromItem(actionButton) {
    const menu = actionButton?.closest('.dropdown-menu');
    const toggle = menu?.__portalToggleRef;

    if (toggle) {
        const instance = bootstrap.Dropdown.getInstance(toggle);
        if (instance) {
            instance.hide();
            return;
        }
    }

    if (menu) {
        menu.classList.remove('show');
    }
}

// Social/Educational Statuses Configuration
const SOCIAL_STATUSES = [
    { id: 'amazigh', label: 'معني بالأمازيغية', icon: 'fa-language', color: '#e67e22' },
    { id: 'separated_parents', label: 'انفصال الأولياء', icon: 'fa-heart-broken', color: '#c0392b' },
    { id: 'orphan', label: 'يتيم', icon: 'fa-user-slash', color: '#7f8c8d' },
    { id: 'needy', label: 'معوز', icon: 'fa-hand-holding-heart', color: '#27ae60' },
    { id: 'scholarship_5000', label: 'منحة 5000دج', icon: 'fa-money-bill-wave', color: '#f1c40f' },
    { id: 'terrorism_victim', label: 'ضحية الإرهاب', icon: 'fa-dove', color: '#34495e' },
    { id: 'chronic_disease', label: 'يعاني من أمراض مزمنة', icon: 'fa-notes-medical', color: '#e84393' },
    { id: 'sport_exemption', label: 'إعفاء من الرياضة', icon: 'fa-walking-slash', color: '#d35400' },
    { id: 'special_needs', label: 'ذوو احتياجات/إعاقة خاصة', icon: 'fa-wheelchair', color: '#8e44ad' },
    { id: 'foreigner', label: 'تلميذ أجنبي', icon: 'fa-globe-africa', color: '#2980b9' }
];

// --- Sorting Configuration ---
const SORT_CONFIG = {
    // Sort priority order (default multi-column sort)
    defaultPriority: ['level', 'stream', 'class', 'last_name', 'first_name'],

    // Sort directions
    ASC: 'asc',
    DESC: 'desc',

    // Current sort state
    currentSort: [],

    // Arabic numerals to Latin for proper sorting
    arabicToLatinNum: {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    },

    // Level sort order
    levelOrder: {
        'أولى': 1, 'ثانية': 2, 'ثالثة': 3, 'رابعة': 4,
        '1 متوسط': 1, '2 متوسط': 2, '3 متوسط': 3, '4 متوسط': 4,
        '1 ثانوي': 1, '2 ثانوي': 2, '3 ثانوي': 3
    },

    // Status sort order
    statusOrder: {
        'external': 1, 'خارجي': 1,
        'half_board': 2, 'نصف داخلي': 2,
        'boarding': 3, 'داخلي': 3
    },

    // Gender sort order
    genderOrder: {
        'M': 1, 'ذكر': 1,
        'F': 2, 'أنثى': 2
    }
};

// Convert Arabic numerals to Latin for sorting
function normalizeArabicNumbers(str) {
    if (!str) return '';
    return str.toString().replace(/[٠-٩]/g, d => SORT_CONFIG.arabicToLatinNum[d] || d);
}

// Custom comparator for sorting
function createComparator(field, direction = SORT_CONFIG.ASC) {
    return (a, b) => {
        let valA = a[field] || '';
        let valB = b[field] || '';

        // Normalize values
        valA = normalizeArabicNumbers(valA).toString().trim();
        valB = normalizeArabicNumbers(valB).toString().trim();

        // Special handling for specific fields
        if (field === 'level') {
            const orderA = SORT_CONFIG.levelOrder[valA] || 999;
            const orderB = SORT_CONFIG.levelOrder[valB] || 999;
            return direction === SORT_CONFIG.ASC ? orderA - orderB : orderB - orderA;
        }

        if (field === 'status') {
            const orderA = SORT_CONFIG.statusOrder[valA] || 999;
            const orderB = SORT_CONFIG.statusOrder[valB] || 999;
            return direction === SORT_CONFIG.ASC ? orderA - orderB : orderB - orderA;
        }

        if (field === 'gender') {
            const orderA = SORT_CONFIG.genderOrder[valA] || 999;
            const orderB = SORT_CONFIG.genderOrder[valB] || 999;
            return direction === SORT_CONFIG.ASC ? orderA - orderB : orderB - orderA;
        }

        if (field === 'repeat') {
            const boolA = valA ? 1 : 0;
            const boolB = valB ? 1 : 0;
            return direction === SORT_CONFIG.ASC ? boolA - boolB : boolB - boolA;
        }

        // Numeric comparison
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
            return direction === SORT_CONFIG.ASC ? numA - numB : numB - numA;
        }

        // String comparison with Arabic locale
        const comparison = valA.localeCompare(valB, 'ar', { sensitivity: 'base', numeric: true });
        return direction === SORT_CONFIG.ASC ? comparison : -comparison;
    };
}

// Multi-column sort function
function multiColumnSort(students, sortConfig) {
    if (!sortConfig || sortConfig.length === 0) return students;

    return [...students].sort((a, b) => {
        for (const { field, direction } of sortConfig) {
            const comparator = createComparator(field, direction);
            const result = comparator(a, b);
            if (result !== 0) return result;
        }
        return 0;
    });
}

// Load sort preferences from localStorage
function loadSortPreferences() {
    try {
        const saved = studentListStorage.getItem('studentListSortConfig', null);
        if (saved) {
            SORT_CONFIG.currentSort = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load sort preferences:', e);
    }
}

// Save sort preferences to localStorage
function saveSortPreferences() {
    try {
        studentListStorage.setJSON('studentListSortConfig', SORT_CONFIG.currentSort);
    } catch (e) {
        console.warn('Failed to save sort preferences:', e);
    }
}

// Apply sorting to filtered students
function applySorting() {
    if (SORT_CONFIG.currentSort.length > 0) {
        filteredStudents = multiColumnSort(filteredStudents, SORT_CONFIG.currentSort);
        syncStudentListState({ filteredStudents: filteredStudents });
    }
}

// Toggle sort direction for a column
function toggleColumnSort(field) {
    const existingIndex = SORT_CONFIG.currentSort.findIndex(s => s.field === field);

    if (existingIndex >= 0) {
        // Toggle direction
        const current = SORT_CONFIG.currentSort[existingIndex];
        if (current.direction === SORT_CONFIG.ASC) {
            current.direction = SORT_CONFIG.DESC;
        } else {
            // Remove from sort if clicked again
            SORT_CONFIG.currentSort.splice(existingIndex, 1);
        }
    } else {
        // Add to sort (default ASC)
        SORT_CONFIG.currentSort.push({ field, direction: SORT_CONFIG.ASC });
    }

    saveSortPreferences();
    filterStudents();
    // updateSortIndicators();
}

// Clear all sorting
function clearAllSorting() {
    SORT_CONFIG.currentSort = [];
    saveSortPreferences();
    filterStudents();
    // updateSortIndicators();
}

// Update visual sort indicators on column headers
function updateSortIndicators() {
    setTimeout(() => {
        const headers = document.querySelectorAll('.gridjs-th');
        headers.forEach(header => {
            const text = header.textContent.trim();
            const sortInfo = SORT_CONFIG.currentSort.find((s, idx) => {
                const fieldMap = {
                    'اللقب': 'last_name',
                    'الاسم': 'first_name',
                    'المستوى': 'level',
                    'الفوج': 'class',
                    'الشعبة': 'stream',
                    'الجنس': 'gender',
                    'الصفة': 'status',
                    'معيد': 'repeat'
                };
                return fieldMap[text] === s.field;
            });

            // Remove existing indicators
            const existingIndicator = header.querySelector('.sort-indicator');
            if (existingIndicator) existingIndicator.remove();

            if (sortInfo) {
                const priority = SORT_CONFIG.currentSort.indexOf(sortInfo) + 1;
                const indicator = document.createElement('span');
                indicator.className = 'sort-indicator';
                indicator.innerHTML = sortInfo.direction === SORT_CONFIG.ASC ? ' ⬆️' : ' ⬇️';
                if (SORT_CONFIG.currentSort.length > 1) {
                    indicator.innerHTML += ` <small style="font-size:0.7em;opacity:0.7">(${priority})</small>`;
                }
                header.appendChild(indicator);
                header.classList.add('sorted-column');
            } else {
                header.classList.remove('sorted-column');
            }
        });
    }, 100);
}

// Setup click handlers for column headers to enable sorting
function setupColumnSortHandlers() {
    const wrapper = document.getElementById('gridjs-wrapper');
    if (!wrapper) return;

    // Map of column names to sort fields
    const columnFieldMap = {
        'اللقب': 'last_name',
        'الاسم': 'first_name',
        'المستوى': 'level',
        'الفوج': 'class',
        'الشعبة': 'stream',
        'الجنس': 'gender',
        'الصفة': 'status',
        'معيد': 'repeat'
    };

    // Remove existing handlers to avoid duplicates
    const existingHeaders = wrapper.querySelectorAll('.gridjs-th');
    existingHeaders.forEach(header => {
        header.removeEventListener('click', handleHeaderClick);
    });

    // Add click handlers to headers
    setTimeout(() => {
        const headers = wrapper.querySelectorAll('.gridjs-th');
        headers.forEach(header => {
            const text = header.textContent.trim();
            if (columnFieldMap[text]) {
                header.style.cursor = 'pointer';
                header.title = 'انقر للترتيب';
                header.addEventListener('click', (e) => {
                    // Don't trigger if clicking on sort indicator or dropdown
                    if (e.target.closest('.sort-indicator') || e.target.closest('.dropdown')) {
                        return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    toggleColumnSort(columnFieldMap[text]);
                });
            }
        });
    }, 200);
}

// Handle header click for sorting
function handleHeaderClick(e) {
    // This will be set dynamically based on the column
}

document.addEventListener('DOMContentLoaded', async () => {
    // 0. Ensure DB is fully ready (high priority for Electron)
    await DB.init();

    // Load Settings
    const settings = studentListService && typeof studentListService.loadSettings === 'function'
        ? await studentListService.loadSettings(DB)
        : (await DB.getSettings() || {});
    educationStage = settings.educationStage || 'middle';
    syncStudentListState({ educationStage: educationStage });

    // Load saved sort preferences
    loadSortPreferences();

    // Toggle Stream Column Header
    const thStream = document.getElementById('thStream');
    if (thStream) {
        thStream.style.display = educationStage === 'secondary' ? 'table-cell' : 'none';
    }

    // Populate level dropdown in modal
    populateLevelDropdown();

    // 1. Populate the Year Filter dropdown
    const currentYear = settings.schoolYear || settings.currentAcademicYear || DB.getCurrentAcademicYear();
    await populateYearDropdown(currentYear);

    // 2. Load students for the current selected year
    const selectedYear = document.getElementById('yearSelect').value;
    await loadStudents(selectedYear);

    // 3. Populate other filters (Level, Class, Status) based on loaded students
    populateFilters();

    // 4. NOTE: yearSelect already has onchange="handleYearChange()" in the HTML.
    // Do NOT add addEventListener here to avoid double-firing handleYearChange.

    // 5. Mark init as complete, then do one definitive render
    // NOTE: The setTimeout(100ms) was removed because it caused a race condition:
    // populateFilters() could trigger cascading change events → early render → then the
    // timeout destroyed and re-rendered the grid, causing a visible flash/disappear.
    _isInitializing = false;
    syncStudentListState({ isInitializing: _isInitializing });
    filterStudents();
});

// Populate level dropdown based on education stage

function populateLevelDropdown() {

    const levelSelect = document.getElementById('inputLevel');

    if (!levelSelect) return;

    const helper = getAcademicHelper();
    const levels = helper && typeof helper.getLevelOptionsByStage === 'function'
        ? helper.getLevelOptionsByStage(educationStage)
        : [];

    levelSelect.innerHTML = levels.map(l =>

        `<option value="${l.value}">${l.label}</option>`

    ).join('');

}

async function loadStudents(year) {
    allStudents = studentListService && typeof studentListService.loadStudents === 'function'
        ? await studentListService.loadStudents(DB, year)
        : await DB.getStudents(true, year);
    syncStudentListState({ allStudents: allStudents });
}

async function handleYearChange() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;

    // Show loading state if gridjs exists
    const wrapper = document.getElementById('gridjs-wrapper');
    if (wrapper) wrapper.style.opacity = '0.5';

    await loadStudents(yearSelect.value);

    // Update dependent filters based on new data
    populateFilters();
    filterStudents();

    if (wrapper) wrapper.style.opacity = '1';
}

async function populateYearDropdown(defaultYear) {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;

    // Get unique years from DB
    let years = await DB.getUniqueAcademicYears();

    // Ensure the default year is in the list
    if (defaultYear && !years.includes(defaultYear)) {
        years.push(defaultYear);
        years.sort().reverse();
    }

    // Fallback if no years found at all
    if (years.length === 0) {
        years = [defaultYear || DB.getCurrentAcademicYear()];
    }

    yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    yearSelect.value = years[0]; // Always select the newest year by default
}

async function saveData() {
    const yearSelect = document.getElementById('yearSelect');
    const activeYear = yearSelect ? yearSelect.value : null;
    if (studentListService && typeof studentListService.saveStudents === 'function') {
        await studentListService.saveStudents(DB, allStudents, activeYear);
    } else {
        await DB.saveStudents(allStudents, activeYear);
    }
    syncStudentListState({ allStudents: allStudents });
}

// --- Filter Logic ---

function populateFilters() {
    // Populate Status Filter Dropdown
    const statusSelect = document.getElementById('statusSelect');
    if (statusSelect) {
        let statusHtml = '<option value="">-- كل الحالات --</option>';
        statusHtml += '<option value="external">خارجي</option>';
        statusHtml += '<option value="half_board">نصف داخلي</option>';
        statusHtml += '<option value="boarding">داخلي</option>';
        statusHtml += '<option disabled>──────────</option>';
        statusHtml += SOCIAL_STATUSES.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
        statusSelect.innerHTML = statusHtml;
    }

    // Extract unique canonical levels and keep only valid values for the active stage
    let levels = [...new Set(allStudents.map(s => normalizeLevel(s.level)).filter(l => l && isValidLevelForCurrentStage(l)))];
    levels.sort((a, b) => getLevelRank(a) - getLevelRank(b));

    const levelSelect = document.getElementById('levelSelect');

    levelSelect.innerHTML = '<option value="">-- كل المستويات --</option>';

    levels.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l;
        opt.textContent = displayLevel(l);
        levelSelect.appendChild(opt);
    });

    updateClassFilter();
    updateStreamFilter();
}

function updateClassFilter() {
    const selectedLevel = document.getElementById('levelSelect').value;
    const classSelect = document.getElementById('classSelect');

    let classes = [];

    if (selectedLevel) {
        // Filter students where level matches exactly (normalized)
        classes = [...new Set(allStudents.filter(s => normalizeLevel(s.level) === selectedLevel).map(s => s.class))].sort();
    } else {
        classes = [...new Set(allStudents.map(s => s.class))].sort();
    }

    // Clean up and normalize classes for display (remove duplicates like "1" and "1 ")
    // We treat numeric classes as numbers for uniqueness check if possible, but keep string for display
    const uniqueClasses = new Set();
    const cleanClasses = [];

    classes.forEach(c => {
        if (!c) return;
        let cleanC = String(c).trim();

        // Normalize numeric classes (e.g. "01" -> "1") for deduplication
        if (!isNaN(cleanC) && cleanC !== '') {
            cleanC = String(parseInt(cleanC, 10));
        }

        if (!uniqueClasses.has(cleanC)) {
            uniqueClasses.add(cleanC);
            cleanClasses.push(cleanC);
        }
    });

    cleanClasses.sort((a, b) => {
        const na = parseInt(a);
        const nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
    });

    classSelect.innerHTML = '<option value="">-- كل الأقسام --</option>';
    cleanClasses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        classSelect.appendChild(opt);
    });
}

document.getElementById('levelSelect').addEventListener('change', updateClassFilter);

function updateStreamFilter() {

    const streamSelect = document.getElementById('streamSelect');

    const streamGroup = document.getElementById('filterStreamGroup');

    const selectedLevel = document.getElementById('levelSelect').value;

    // The user requested to ONLY rely on the global setting for stream visibility
    const showStreams = (educationStage === 'secondary');

    if (streamSelect && streamGroup && showStreams) {
        streamGroup.style.display = 'block';

        let streams = [];

        if (selectedLevel) {

            // Filter streams based on level (normalized)
            streams = [...new Set(allStudents.filter(s => normalizeLevel(s.level) === selectedLevel).map(s => s.stream))].filter(s => s).sort();

        } else {

            streams = [...new Set(allStudents.map(s => s.stream))].filter(s => s).sort();

        }

        // Check for Technical Math streams to add aggregate option

        const hasTechMath = streams.some(s => s && s.startsWith('tech_math'));

        let optionsHtml = '<option value="">-- كل الشعب --</option>';

        let techAllAdded = false;

        streams.forEach(s => {

            // Option logic: If we haven't added tech_all yet, and we encounter a tech_math stream,

            // add it before the specific tech streams (fallback if 'science' is missing)

            if (hasTechMath && !techAllAdded && s.startsWith('tech_math')) {

                optionsHtml += '<option value="tech_all">تقني رياضي (كل التخصصات)</option>';

                techAllAdded = true;

            }

            // Add the current stream option

            optionsHtml += `<option value="${s}">${SubjectManager.getStreamName(s)}</option>`;

            // If we hit 'science' (Experimental Sciences) and haven't added tech_all yet, add it after

            if (s === 'science' && hasTechMath && !techAllAdded) {

                optionsHtml += '<option value="tech_all">تقني رياضي (كل التخصصات)</option>';

                techAllAdded = true;

            }

        });

        streamSelect.innerHTML = optionsHtml;

        // Adjust grid columns

    } else if (streamGroup) {

        streamGroup.style.display = 'none';

    }

}

document.getElementById('levelSelect').addEventListener('change', updateStreamFilter);

function filterStudents() {

    // Block spurious calls during page initialization (e.g. from cascading change events in populateFilters)
    if (_isInitializing) return;

    const level = document.getElementById('levelSelect').value;

    const cls = document.getElementById('classSelect').value;

    // Status Filter Single Select
    const statusSelect = document.getElementById('statusSelect');
    const selectedStatus = statusSelect ? statusSelect.value : '';

    const streamSelect = document.getElementById('streamSelect');

    const stream = streamSelect ? streamSelect.value : '';

    const searchInputEl = document.getElementById('searchInput');
    const search = searchInputEl ? searchInputEl.value.toLowerCase() : '';

    // Toggle Print Forms Button
    const btnPrintForms = document.getElementById('btnPrintScholarshipForms');
    if (btnPrintForms) {
        btnPrintForms.style.display = (selectedStatus === 'scholarship_5000') ? 'flex' : 'none';
    }

    if (studentListService && typeof studentListService.filterStudents === 'function') {
        filteredStudents = studentListService.filterStudents(allStudents, {
            level: level,
            classValue: cls,
            selectedStatus: selectedStatus,
            stream: stream,
            normalizeLevel: normalizeLevel
        });
    } else {
        filteredStudents = allStudents.filter(s => {

            // Level Match: Normalized match
            const matchLevel = level ? normalizeLevel(s.level) === level : true;

            // Class Match: Compare trimmed strings or numeric values
            let matchClass = true;
            if (cls) {
                const sClass = String(s.class || '').trim();
                const filterClass = String(cls).trim();
                matchClass = sClass === filterClass;
                // Fallback for numeric mismatch "01" vs "1"
                if (!matchClass && !isNaN(sClass) && !isNaN(filterClass)) {
                    matchClass = parseInt(sClass) === parseInt(filterClass);
                }
            }

            // Handle Stream Filter (including Technical Math Aggregate)
            let matchStream = true;

            if (stream === 'tech_all') {

                matchStream = s.stream && s.stream.startsWith('tech_math');

            } else if (stream) {

                matchStream = s.stream === stream;

                // Allow loose matching for streams if needed in future
            }

            // Custom search is now handled by Grid.js built-in search via search: true

            // Exclude struck-off students
            const isStruckOff = s.struck_off === true;

            // Status Filter Logic (Boarding vs Social)
            let matchStatus = true;
            if (selectedStatus) {
                if (['external', 'half_board', 'boarding'].includes(selectedStatus)) {
                    // Boarding Status Check
                    let sStatus = s.status;
                    // Normalize status if stored as Arabic text (legacy support)
                    if (sStatus === 'نصف داخلي') sStatus = 'half_board';
                    if (sStatus === 'داخلي') sStatus = 'boarding';
                    if (sStatus === 'خارجي') sStatus = 'external';

                    // For 'external', match exact 'external' OR missing status (default)
                    if (selectedStatus === 'external') {
                        matchStatus = (!sStatus || sStatus === 'external');
                    } else {
                        matchStatus = (sStatus === selectedStatus);
                    }
                } else {
                    // Social Status Check
                    if (!s.social_status || !Array.isArray(s.social_status)) {
                        matchStatus = false;
                    } else {
                        matchStatus = s.social_status.includes(selectedStatus);
                    }
                }
            }

            // Handle Scholarship Search by First/Last Name if needed, though Grid.js does this automatically
            return matchLevel && matchClass && matchStream && matchStatus && !isStruckOff;

        });
    }

    // Apply custom sorting
    applySorting();
    syncStudentListState({ filteredStudents: filteredStudents });

    currentPage = 1; // Reset to first page when filtering

    renderTable();

    updateSummary();

}

// Pagination settings

let currentPage = 1;

const pageSize = 50;

// Helper to standardize level display (e.g., "أولى متوسط" -> "1 متوسط")
function normalizeLevel(level) {
    if (!level) return '';
    const helper = getAcademicHelper();
    if (helper && typeof helper.getCanonicalLevel === 'function') {
        const canonical = helper.getCanonicalLevel(level);
        if (canonical) return canonical;
    }
    return String(level).trim();
}

// Display-only mapping: converts stored level (e.g. "1 متوسط") to user-friendly Arabic (e.g. "أولى متوسط")
// Does NOT modify data - used only for rendering
function displayLevel(level) {
    if (!level) return '';
    const helper = getAcademicHelper();
    if (helper && typeof helper.formatLevel === 'function') {
        return helper.formatLevel(level, educationStage);
    }
    return normalizeLevel(level);
}

let gridInstance = null;
let renderFrameId = null;
let renderTimeoutId = null;

async function toggleScholarshipConfirmation(index) {
    if (index === -1 || !allStudents[index]) return;
    allStudents[index].scholarship_confirmed = !allStudents[index].scholarship_confirmed;
    await saveData();
    filterStudents(); // Re-render the table to reflect changes
}

async function triggerPrintScholarshipForm(index) {
    if (index === -1 || !allStudents[index]) return;
    await printScholarshipForms(allStudents[index]);
}

async function updateStudentField(index, field, value) {
    if (index === -1 || !allStudents[index]) return;
    allStudents[index][field] = value;
    await saveData();
    // Silent save to avoid spamming toasts
}

function renderTable() {
    const wrapper = document.getElementById('gridjs-wrapper');
    if (!wrapper) return;

    // Filter students has already populated `filteredStudents` array

    const statusSelect = document.getElementById('statusSelect');
    const selectedStatus = statusSelect ? statusSelect.value : '';
    const isScholarship = selectedStatus === 'scholarship_5000';

    // Map data for Grid.js
    const data = filteredStudents.map((s, idx) => {
        const realIndex = allStudents.indexOf(s);
        const statusStr = (s.status === 'half_board' || s.status === 'نصف داخلي') ? 'نصف داخلي' : (s.status === 'boarding' || s.status === 'داخلي' ? 'داخلي' : 'خارجي');

        let actionsHtml = `
            <div class="d-flex align-items-center justify-content-center">
                ${isScholarship ? `
                    <div class="d-flex flex-column align-items-center" style="gap: 4px;">
                        <button class="btn" onclick="triggerPrintScholarshipForm(${realIndex})" title="طباعة الاستمارة" style="background-color: var(--secondary-color); color: white; padding: 2px 4px; font-size: 0.8em; border-radius: 4px; border: none; box-shadow: 0 1px 2px rgba(0,0,0,0.1); width: 85px;">
                            ${IconManager.get('notice2')}  طباعة
                        </button>
                        <button class="btn ${s.scholarship_confirmed ? 'btn-success' : 'btn-light'}" onclick="toggleScholarshipConfirmation(${realIndex})" title="${s.scholarship_confirmed ? 'إلغاء التأكيد' : 'تأكيد'}" style="padding: 2px 4px; font-size: 0.8em; border-radius: 4px; border: 1px solid #ccc; font-weight: bold; box-shadow: 0 1px 2px rgba(0,0,0,0.1); width: 85px;">
                            ${s.scholarship_confirmed ? '✓ مؤكد' : 'تأكيد'}
                        </button>
                    </div>
                ` : ''}
                ${!isScholarship ? `
                <div class="dropdown ${filteredStudents.length <= 5 || (idx >= filteredStudents.length - 3 && filteredStudents.length > 3) ? 'dropup' : ''}">
                    <button class="btn btn-sm btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'>
                        ${IconManager.get('settings')}
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow">
                        <li><button class="dropdown-item" onclick="openEditModal(${realIndex})">${IconManager.get('edit')} تعديل</button></li>
                        <li><button class="dropdown-item text-success" onclick="openTransferModal(${realIndex})"><i class="fas fa-exchange-alt me-2"></i>تغيير الفوج/الصفة</button></li>

                        <li><button class="dropdown-item" onclick="openStudentInfoModal(${realIndex})" style="color: #6f42c1;"><i class="fas fa-id-card me-2"></i>معلومات</button></li>
                        <li><button class="dropdown-item text-primary" onclick="printSummons(${realIndex})">${IconManager.get('notice2')} استدعاء</button></li>
                        <li><button class="dropdown-item text-success" onclick="openStatusModal(${realIndex})">${IconManager.get('tag')} الحالة</button></li>
                        <li><button class="dropdown-item text-info" onclick="emailParent(${realIndex})"><i class="fas fa-envelope me-2"></i>مراسلة الولي</button></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><button class="dropdown-item text-danger" onclick="openStrikeModal(${realIndex})">${IconManager.get('strikeoff')} شطب</button></li>
                    </ul>
                </div>
                ` : ''}
            </div>
        `;

        // We wrap HTML in gridjs.html(...) utility so Grid.js renders it as raw HTML
        let rowData;
        if (isScholarship) {
            rowData = [
                idx + 1,
                s.national_id || '-',
                s.last_name || '',
                s.first_name || '',
                formatDateDisplay(s.birth_date),
                gridjs.html(`<input type="text" class="form-control form-control-sm editable-cell m-0" style="text-align: right; width: 100%; box-sizing: border-box; padding: 2px 5px; border: 1px solid transparent; background: transparent; transition: all 0.2s;" value="${s.pob || ''}" onfocus="this.style.background='#fff'; this.style.borderColor='var(--secondary-color)'" onblur="this.style.background='transparent'; this.style.borderColor='transparent'" onchange="updateStudentField(${realIndex}, 'pob', this.value)" title="انقر للتعديل">`),
                gridjs.html(`<input type="text" class="form-control form-control-sm editable-cell m-0" style="text-align: right; width: 100%; box-sizing: border-box; padding: 2px 5px; border: 1px solid transparent; background: transparent; transition: all 0.2s;" value="${s.father_name || ''}" onfocus="this.style.background='#fff'; this.style.borderColor='var(--secondary-color)'" onblur="this.style.background='transparent'; this.style.borderColor='transparent'" onchange="updateStudentField(${realIndex}, 'father_name', this.value)" title="انقر للتعديل">`),
                gridjs.html(`<input type="text" class="form-control form-control-sm editable-cell m-0" style="text-align: right; width: 100%; box-sizing: border-box; padding: 2px 5px; border: 1px solid transparent; background: transparent; transition: all 0.2s;" value="${s.mother_name || ''}" onfocus="this.style.background='#fff'; this.style.borderColor='var(--secondary-color)'" onblur="this.style.background='transparent'; this.style.borderColor='transparent'" onchange="updateStudentField(${realIndex}, 'mother_name', this.value)" title="انقر للتعديل">`),
                displayLevel(s.level),
                s.class || '',
                statusStr,
                gridjs.html(actionsHtml)
            ];
        } else {
            rowData = [
                idx + 1,
                s.national_id || '-',
                s.last_name || '',
                s.first_name || '',
                formatDateDisplay(s.birth_date),
                s.gender === 'M' ? 'ذكر' : 'أنثى',
                s.repeat ? 'نعم' : 'لا',
                displayLevel(s.level)
            ];


            // Conditional column for stream if secondary
            if (educationStage === 'secondary') {
                rowData.push(SubjectManager.getStreamName(s.stream) || '-');
            }

            rowData.push(s.class || '');
            rowData.push(statusStr);
            rowData.push(gridjs.html(actionsHtml));
        }

        return rowData;
    });

    let columns;
    if (isScholarship) {
        columns = [
            { name: '#', width: '60px' },
            { name: 'رقم التعريف', width: '150px' },
            'اللقب',
            'الاسم',
            { name: 'تاريخ الميلاد', width: '110px' },
            { name: 'مكان الميلاد', width: '130px' },
            { name: 'اسم الأب', width: '140px' },
            { name: 'اسم الأم', width: '140px' },
            { name: 'المستوى', width: '90px' },
            { name: 'الفوج', width: '70px' },
            { name: 'الصفة', width: '90px' },
            { name: 'إجراءات', width: '130px', sort: false }
        ];
    } else {
        columns = [
            { name: '#', width: '60px' },
            { name: 'رقم التعريف', width: '160px' },
            'اللقب',
            'الاسم',
            { name: 'تاريخ الميلاد', width: '110px' },
            { name: 'الجنس', width: '80px' },
            { name: 'معيد', width: '70px' },
            { name: 'المستوى', width: '100px' }
        ];

        if (educationStage === 'secondary') {
            columns.push({ name: 'الشعبة', width: '140px' });
        }

        columns.push({ name: 'الفوج', width: '80px' });
        columns.push({ name: 'الصفة', width: '100px' });
        columns.push({ name: 'إجراءات', width: '120px', sort: false });
    }

    // Cancel any pending render frame to avoid stale renders
    if (renderFrameId) {
        cancelAnimationFrame(renderFrameId);
        renderFrameId = null;
    }
    if (renderTimeoutId) {
        clearTimeout(renderTimeoutId);
        renderTimeoutId = null;
    }

    // Always destroy and recreate to avoid Grid.js pipeline cache corruption
    if (gridInstance) {
        try { gridInstance.destroy(); } catch (e) { }
        gridInstance = null;
    }
    wrapper.innerHTML = '';

    // Use requestAnimationFrame to ensure the container is fully cleared
    // before Grid.js renders. This prevents the "container not empty" check
    // from silently failing on the initial page load.
    const createGrid = () => {
        // Double-check wrapper is truly empty for Grid.js
        if (wrapper.childNodes.length > 0) {
            wrapper.innerHTML = '';
        }

        // Use setTimeout to ensure plugins (like search) register correctly before data is evaluated
        renderTimeoutId = setTimeout(() => {
            renderTimeoutId = null;

            // Re-check wrapper to ensure no overlapping renders filled it
            if (wrapper.childNodes.length > 0) {
                wrapper.innerHTML = '';
            }

            gridInstance = new gridjs.Grid({
                columns: columns,
                data: data,
                search: true,
                sort: false, // Disabled - using custom sorting
                pagination: {
                    limit: 50,
                    summary: true
                },
                language: {
                    search: {
                        placeholder: 'بحث سريع...'
                    },
                    pagination: {
                        previous: 'السابق',
                        next: 'التالي',
                        navigate: (page, pages) => `صفحة ${page} من ${pages}`,
                        page: (page) => `صفحة ${page}`,
                        showing: 'عرض',
                        of: 'من',
                        to: 'إلى',
                        results: 'نتائج'
                    },
                    noRecordsFound: 'لا توجد نتائج مطابقة',
                    loading: 'جارِ التحميل...'
                },
                className: {
                    table: 'table table-hover table-bordered mb-0',
                    thead: 'thead-light'
                },
                style: {
                    table: { width: '100%' },
                    td: { textAlign: 'center', verticalAlign: 'middle' },
                    th: { textAlign: 'center' }
                }
            }).render(wrapper);

            // Add IconManager render after grid is rendered to ensure icons are active
            gridInstance.on('render', () => {
                if (typeof IconManager !== 'undefined') {
                    IconManager.render();
                }

                // Setup column sort handlers after each render
                // setupColumnSortHandlers();
                // updateSortIndicators();

                // Re-initialize Bootstrap dropdowns with fixed positioning to prevent clipping
                const dropdownToggles = wrapper.querySelectorAll('[data-bs-toggle="dropdown"]');
                dropdownToggles.forEach(toggle => {
                    createActionDropdownInstance(toggle);
                });
            });
        }, 50);
    };

    renderFrameId = requestAnimationFrame(createGrid);

    // Pagination handles rendering now, custom count moved back to summary above table.
}

function renderPagination() {

    let paginationDiv = document.getElementById('paginationControls');

    if (!paginationDiv) {

        paginationDiv = document.createElement('div');

        paginationDiv.id = 'paginationControls';

        paginationDiv.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 10px; padding: 15px; direction: ltr;';

        document.querySelector('.data-table-container').appendChild(paginationDiv);

    }

    const totalPages = Math.ceil(filteredStudents.length / pageSize);

    if (totalPages <= 1) {

        paginationDiv.innerHTML = '';

        return;

    }

    let html = `

        <button onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''} style="padding: 5px 10px; cursor: pointer;">${IconManager.get('first_page')}</button>

        <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} style="padding: 5px 10px; cursor: pointer;">${IconManager.get('prev_page')}</button>

        <span style="padding: 0 10px; font-weight: bold;">الصفحة ${currentPage} من ${totalPages}</span>

        <button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} style="padding: 5px 10px; cursor: pointer;">${IconManager.get('next_page')}</button>

        <button onclick="goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''} style="padding: 5px 10px; cursor: pointer;">${IconManager.get('last_page')}</button>

        <span style="margin-right: 15px; color: #666;">(${filteredStudents.length} تلميذ)</span>

    `;

    paginationDiv.innerHTML = html;

}

function goToPage(page) {

    const totalPages = Math.ceil(filteredStudents.length / pageSize);

    if (page >= 1 && page <= totalPages) {

        currentPage = page;

        renderTable();

        // Scroll to top of table

        document.querySelector('.data-table-container').scrollIntoView({ behavior: 'smooth' });

    }

}

function togglePrintDropdown(event) {
    event.stopPropagation();
    const menu = document.getElementById('printDropdownMenu');
    // Bootstrap dropdowns handle themselves. Print menu might be custom.

    if (menu) {
        const isVisible = menu.style.display === 'block';
        menu.style.display = isVisible ? 'none' : 'block';
    }
}

// Close action menus when clicking outside & handle row clicks
document.addEventListener('click', function (e) {
    const actionButton = e.target.closest('[data-student-action][data-student-index]');
    if (!actionButton) return;

    e.preventDefault();
    e.stopPropagation();

    executeStudentAction(
        actionButton.getAttribute('data-student-action'),
        actionButton.getAttribute('data-student-index')
    );
    closeStudentActionMenuFromItem(actionButton);
});

document.addEventListener('click', function (e) {
    // Action menus are handled by Bootstrap now.

    // Close print dropdown
    if (!e.target.closest('.print-dropdown')) {
        const printMenu = document.getElementById('printDropdownMenu');
        if (printMenu) printMenu.style.display = 'none';
    }

    // Handle student row click to open status modal
    const tr = e.target.closest('.gridjs-tr');
    // Ensure we clicked inside the tbody, not the header
    if (tr && tr.closest('tbody')) {
        // Ignore clicks on action buttons, dropdowns, inputs, or the last "actions" column
        if (!e.target.closest('.dropdown') && !e.target.closest('button') && !e.target.closest('a') && !e.target.closest('input') && !e.target.closest('.gridjs-td:last-child')) {
            const statusBtn = tr.querySelector('button[onclick^="openStatusModal"]');
            if (statusBtn) {
                statusBtn.click();
            }
        }
    }
});

function updateSummary() {
    const summary = document.getElementById('listSummary');
    if (!summary) return;

    const total = filteredStudents.length;
    const males = filteredStudents.filter(s => s.gender === 'M').length;
    const females = total - males;

    // Premium styling for the widget
    summary.className = 'premium-stats-widget no-print';
    summary.style.marginLeft = 'auto'; // Push to the left in RTL to align with search bar on the right

    summary.innerHTML = `
        <div class="stat-segment" title="العدد الإجمالي">
            <div class="stat-label">
                <i class="fas fa-users text-total"></i>
                <span>العدد:</span>
            </div>
            <div class="stat-badge bg-total">${total}</div>
        </div>
        <div class="stat-segment" title="الذكور">
            <div class="stat-label">
                <i class="fas fa-male text-male"></i>
                <span>ذكور:</span>
            </div>
            <div class="stat-badge bg-male">${males}</div>
        </div>
        <div class="stat-segment" title="الإناث">
            <div class="stat-label">
                <i class="fas fa-female text-female"></i>
                <span>إناث:</span>
            </div>
            <div class="stat-badge bg-female">${females}</div>
        </div>
    `;

    // Ensure it's in the grid head if available
    const gridHead = document.querySelector('.gridjs-head');
    if (gridHead && !gridHead.contains(summary)) {
        gridHead.prepend(summary);
    }
}

// Auto-align MutationObserver to keep the counter next to the search bar
(function initializeCounterObserver() {
    const observer = new MutationObserver((mutations) => {
        const gridHead = document.querySelector('.gridjs-head');
        const summary = document.getElementById('listSummary');
        if (gridHead && summary && !gridHead.contains(summary)) {
            gridHead.prepend(summary);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();

// --- CRUD Operations ---

function updateModalContext(selectedClass = "", selectedStream = "") {

    const level = document.getElementById('inputLevel').value;

    const classSelect = document.getElementById('inputClass');

    const streamSelect = document.getElementById('inputStream');

    const streamGroup = document.getElementById('streamGroup');

    // 1. Check Stage
    DB.getSettings().then(settings => {
        const stage = settings.educationStage || 'middle';

        // Show streams if it's the secondary stage according to settings
        if (stage === 'secondary') {
            streamGroup.style.display = 'block';
            streamSelect.innerHTML = '<option value="">-- اختر الشعبة --</option>';

            // Get Streams for this Level from SubjectManager

            let streams = SubjectManager.getStreams(level);

            // Add all tech_math specialties (they share the same subjects as base tech_math)

            const techMathSpecialties = ['tech_math_civil', 'tech_math_mech', 'tech_math_elec', 'tech_math_methods'];

            // Insert tech_math variants after tech_math in the list

            const techMathIndex = streams.indexOf('tech_math');

            if (techMathIndex !== -1) {

                // Remove base tech_math and add all specialties instead

                streams.splice(techMathIndex, 1, ...techMathSpecialties);

            }

            streams.forEach(code => {

                const opt = document.createElement('option');

                opt.value = code;

                opt.textContent = SubjectManager.getStreamName(code);

                if (code === selectedStream) opt.selected = true;

                streamSelect.appendChild(opt);

            });

            // If selected stream is not in list, add it

            if (selectedStream && !streams.includes(selectedStream)) {

                const opt = document.createElement('option');

                opt.value = selectedStream;

                opt.textContent = SubjectManager.getStreamName(selectedStream);

                opt.selected = true;

                streamSelect.appendChild(opt);

            }

        } else {

            streamGroup.style.display = 'none';

        }

    });

    // 2. Populate Classes
    // Fetch distinct existing classes directly from the database for this level
    let classes = [...new Set(allStudents
        .filter(s => s.level === level && s.class)
        .map(s => String(s.class).trim())
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    // If no classes exist yet, provide a friendly default sequence
    if (classes.length === 0) {
        classes = ["01", "02", "03", "04"];
    }

    // Ensure the currently selected class is always in the dropdown when editing
    if (selectedClass && !classes.includes(String(selectedClass).trim())) {
        const selStr = String(selectedClass).trim();
        // Check if there's a numeric match (e.g. "1" and "01")
        const hasNumericMatch = classes.some(c => !isNaN(parseInt(c)) && !isNaN(parseInt(selStr)) && parseInt(c) === parseInt(selStr));
        if (!hasNumericMatch) {
            classes.push(selStr);
            classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        }
    }

    classSelect.innerHTML = '<option value="">-- اختر الفوج --</option>';
    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;

        // Robust matching (handles "5" vs "05")
        const selInt = parseInt(selectedClass);
        const cwInt = parseInt(c);
        if (selectedClass === c || (!isNaN(selInt) && !isNaN(cwInt) && selInt === cwInt)) {
            opt.selected = true;
        }

        classSelect.appendChild(opt);
    });
}

// --- Bootstrap Modal Helpers ---
let studentModal = null;
let strikeModal = null;
let deleteModal = null;
let statusModal = null;
let printSettingsModal = null;

function getModal(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return bootstrap.Modal.getOrCreateInstance(el);
}

function openAddModal() {
    document.getElementById('modalTitle').textContent = "إضافة تلميذ جديد";
    document.getElementById('editStudentId').value = "";

    // Clear inputs using form reset
    const form = document.getElementById('studentForm');
    if (form) form.reset();

    // Default Academic Year based on current filter
    const yearSelect = document.getElementById('yearSelect');
    document.getElementById('inputAcademicYear').value = (yearSelect && yearSelect.value) ? yearSelect.value : "2025/2026";

    document.getElementById('inputGender').value = "M";
    const defaultLevel = normalizeLevel(document.getElementById('levelSelect').value) || 'أولى';
    const levelInput = document.getElementById('inputLevel');
    levelInput.value = defaultLevel;
    levelInput.disabled = false;

    updateModalContext();

    document.getElementById('inputStatus').value = "external";
    document.getElementById('inputRepeat').checked = false;

    getModal('studentModal').show();
}

function openEditModal(index) {
    const s = allStudents[index];
    if (!s) return;

    document.getElementById('modalTitle').textContent = "تعديل بيانات تلميذ";
    document.getElementById('editStudentId').value = index;

    document.getElementById('inputLastName').value = s.last_name || "";
    document.getElementById('inputFirstName').value = s.first_name || "";
    document.getElementById('inputDob').value = s.birth_date || "";
    document.getElementById('inputPob').value = s.pob || "";
    document.getElementById('inputFatherName').value = s.father_name || "";
    document.getElementById('inputMotherName').value = s.mother_name || "";
    document.getElementById('inputParentEmail').value = s.parent_email || "";
    document.getElementById('inputFatherJob').value = s.father_job || "";
    document.getElementById('inputMotherJob').value = s.mother_job || "";
    document.getElementById('inputAddress').value = s.address || "";
    document.getElementById('inputParentPhone').value = s.parent_phone || "";
    document.getElementById('inputGender').value = s.gender || "M";

    const levelInput = document.getElementById('inputLevel');
    const studentLevel = normalizeLevel(s.level || "");

    // Add level if missing
    let levelExists = false;
    for (let i = 0; i < levelInput.options.length; i++) {
        if (levelInput.options[i].value === studentLevel) {
            levelExists = true;
            break;
        }
    }
    if (!levelExists && studentLevel) {
        const opt = document.createElement('option');
        opt.value = studentLevel;
        opt.textContent = displayLevel(studentLevel);
        levelInput.appendChild(opt);
    }

    levelInput.value = studentLevel;
    levelInput.disabled = true;

    updateModalContext(s.class, s.stream);

    document.getElementById('inputStatus').value = s.status || "external";
    document.getElementById('inputNationalId').value = s.national_id || "";
    document.getElementById('inputEntryDate').value = s.entry_date || "";
    document.getElementById('inputRepeat').checked = s.repeat === true;
    document.getElementById('inputObservation').value = s.observation || "";
    document.getElementById('inputAcademicYear').value = s.academic_year || s.schoolYear || s.year || "";

    getModal('studentModal').show();
}

async function saveStudent() {
    const id = document.getElementById('editStudentId').value;

    const btn = document.getElementById('btnSaveStudent');
    const spinner = document.getElementById('saveStudentSpinner');
    const btnText = document.getElementById('saveStudentBtnText');

    if (btn) btn.disabled = true;
    if (spinner) spinner.classList.remove('d-none');
    if (btnText) btnText.textContent = "جارِ الحفظ...";

    const academicYearFromInput = document.getElementById('inputAcademicYear').value.trim();

    const student = {
        last_name: document.getElementById('inputLastName').value.trim(),
        first_name: document.getElementById('inputFirstName').value.trim(),
        birth_date: document.getElementById('inputDob').value,
        pob: document.getElementById('inputPob').value.trim(),
        father_name: document.getElementById('inputFatherName').value.trim(),
        mother_name: document.getElementById('inputMotherName').value.trim(),
        parent_email: document.getElementById('inputParentEmail').value.trim(),
        father_job: document.getElementById('inputFatherJob').value.trim(),
        mother_job: document.getElementById('inputMotherJob').value.trim(),
        address: document.getElementById('inputAddress').value.trim(),
        parent_phone: document.getElementById('inputParentPhone').value.trim(),
        gender: document.getElementById('inputGender').value,
        level: normalizeLevel(document.getElementById('inputLevel').value),
        class: document.getElementById('inputClass').value,
        stream: document.getElementById('inputStream').value,
        status: document.getElementById('inputStatus').value,
        national_id: document.getElementById('inputNationalId').value.trim(),
        entry_date: document.getElementById('inputEntryDate').value,
        repeat: document.getElementById('inputRepeat').checked,
        observation: document.getElementById('inputObservation').value.trim(),
        year: academicYearFromInput || (allStudents.length > 0 ? allStudents[0].year : "2025/2026"),
        academic_year: academicYearFromInput || (allStudents.length > 0 ? allStudents[0].academic_year : "2024/2025")
    };

    if (!student.last_name || !student.first_name || !student.level || !student.class) {
        if (btn) btn.disabled = false;
        if (spinner) spinner.classList.add('d-none');
        if (btnText) btnText.textContent = "حفظ التفاصيل";

        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'يرجى ملء الحقول الإلزامية (اللقب، الاسم، المستوى، الفوج)',
            confirmButtonText: 'حسناً'
        });
        if (!student.class) document.getElementById('inputClass').focus();
        return;
    }

    if (id === "") {
        // New student
        student.status_history = [{
            date: new Date().toISOString(),
            status: student.status
        }];
        allStudents.push(student);
    } else {
        const original = allStudents[id];
        // Check for status change
        if (original.status !== student.status) {
            const history = original.status_history || [];
            history.push({
                date: new Date().toISOString(),
                status: student.status,
                previous_status: original.status
            });
            student.status_history = history;
        } else {
            // Keep existing history if no change
            student.status_history = original.status_history || [];
        }
        allStudents[id] = { ...original, ...student };
    }

    await saveData();
    getModal('studentModal').hide();

    if (btn) btn.disabled = false;
    if (spinner) spinner.classList.add('d-none');
    if (btnText) btnText.textContent = "حفظ التفاصيل";

    populateFilters();
    filterStudents();
}

function openDeleteModal(index) {
    studentToDeleteIndex = index;
    const s = allStudents[index];
    document.getElementById('deleteStudentName').textContent = `${s.last_name} ${s.first_name}`;
    getModal('deleteModal').show();
}

function confirmDelete() {
    if (studentToDeleteIndex > -1) {
        getModal('deleteModal').hide();

        const s = allStudents[studentToDeleteIndex];
        Swal.fire({
            title: 'هل أنت متأكد؟',
            text: `هل تريد حقاً حذف التلميذ ${s.last_name} ${s.first_name}؟`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'نعم، احذف!',
            cancelButtonText: 'إلغاء'
        }).then(async (result) => {
            if (result.isConfirmed) {
                allStudents.splice(studentToDeleteIndex, 1);
                await saveData();
                filterStudents();
                Swal.fire(
                    'تم الحذف!',
                    'تم حذف التلميذ بنجاح.',
                    'success'
                );
            }
        });
    } else {
        getModal('deleteModal').hide();
    }
}

function openStrikeModal(index) {
    studentToStrikeIndex = index;
    const s = allStudents[index];
    document.getElementById('strikeStudentName').textContent = `${s.last_name} ${s.first_name}`;
    document.getElementById('inputStrikeDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('inputStrikeReason').value = "";

    const radios = document.getElementsByName('strikeType');
    if (radios.length > 0) radios[0].checked = true;
    updateStrikeModalType();

    getModal('strikeModal').show();
}

function updateStrikeModalType() {

    const type = document.querySelector('input[name="strikeType"]:checked').value;

    const titleEl = document.querySelector('#strikeModal .modal-title');

    const msgEl = document.querySelector('#strikeModal .modal-message');

    const confirmBtn = document.querySelector('#strikeModal .btn-confirm');

    const reasonInput = document.getElementById('inputStrikeReason');

    if (type === 'transfer') {

        titleEl.textContent = "تحويل تلميذ";

        msgEl.innerHTML = `

            سيتم تحويل التلميذ: <strong id="strikeStudentName">${document.getElementById('strikeStudentName').textContent}</strong><br>

            لن يٍهر هذا التلميذ في القوائم الرسمية بعد الآن.

        `;

        confirmBtn.textContent = "تأكيد التحويل";

        confirmBtn.style.backgroundColor = "var(--secondary-color)";

        reasonInput.placeholder = "اسم المؤسسة المحول إليها...";

    } else {

        titleEl.textContent = "شطب تلميذ";

        msgEl.innerHTML = `

            سيتم شطب التلميذ: <strong id="strikeStudentName">${document.getElementById('strikeStudentName').textContent}</strong><br>

            لن يٍهر هذا التلميذ في القوائم الرسمية بعد الآن.

        `;

        confirmBtn.textContent = "تأكيد الشطب";

        confirmBtn.style.backgroundColor = "#e67e22";

        reasonInput.placeholder = "سبب الشطب (اختياري)...";

    }

}

async function confirmStrike() {
    // Close the Bootstrap modal first
    getModal('strikeModal').hide();

    if (studentToStrikeIndex > -1) {
        const date = document.getElementById('inputStrikeDate').value;
        const reason = document.getElementById('inputStrikeReason').value;
        const type = document.querySelector('input[name="strikeType"]:checked').value;

        if (!date) {
            Swal.fire('خطأ', 'يرجى إدخال تاريخ الإجراء', 'error');
            return;
        }

        const actionText = type === 'transfer' ? 'تحويل' : 'شطب';
        const color = type === 'transfer' ? 'var(--secondary-color)' : '#e67e22';

        Swal.fire({
            title: `تأكيد ${actionText}`,
            text: `هل أنت متأكد من ${actionText} هذا التلميذ؟`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: color,
            cancelButtonColor: '#d33',
            confirmButtonText: `نعم، قم بـ ${actionText}`,
            cancelButtonText: 'إلغاء'
        }).then(async (result) => {
            if (result.isConfirmed) {
                allStudents[studentToStrikeIndex].struck_off = true;
                allStudents[studentToStrikeIndex].strike_date = date;
                allStudents[studentToStrikeIndex].strike_reason = reason;
                allStudents[studentToStrikeIndex].strike_type = type;
                allStudents[studentToStrikeIndex].status = type === 'transfer' ? 'محول' : 'مشطوب';

                await saveData();
                filterStudents();

                Swal.fire(
                    'تمت العملية!',
                    `تم ${actionText} التلميذ بنجاح.`,
                    'success'
                );
            }
        });
    }
}

function closeModal(id) {
    getModal(id).hide();
}

function openStatusModal(index) {
    const s = allStudents[index];
    if (!s) return;

    document.getElementById('statusStudentName').textContent = `${s.last_name || ''} ${s.first_name || ''}`;
    document.getElementById('statusStudentIndex').value = index;

    const container = document.getElementById('statusCheckboxes');
    container.innerHTML = '';

    // Ensure container styling for cleaner layout
    container.className = 'row g-2'; // Add gutter spacing

    const currentStatuses = s.social_status || [];

    SOCIAL_STATUSES.forEach(status => {
        const isChecked = currentStatuses.includes(status.id);
        const col = document.createElement('div');
        col.className = 'col-md-6';

        // Modern Switch Card Design
        col.innerHTML = `
            <div class="status-card p-2 border rounded h-100 d-flex align-items-center justify-content-between shadow-sm transition-hover"
                 style="background-color: ${isChecked ? '#f0f9ff' : '#fff'}; border-color: ${isChecked ? '#b3e5fc' : '#dee2e6'}; transition: all 0.2s;">
                <div class="d-flex align-items-center">
                    <div class="icon-box rounded-circle d-flex align-items-center justify-content-center me-2 shadow-sm"
                         style="width: 35px; height: 35px; background: ${status.color || '#95a5a6'}; color: white; font-size: 0.9rem;">
                        <i class="fas ${status.icon || 'fa-info-circle'}"></i>
                    </div>
                    <div>
                        <span class="d-block fw-bold text-dark" style="font-size: 0.85rem;">${status.label}</span>
                    </div>
                </div>
                <div class="form-check form-switch ms-2">
                    <input class="form-check-input" type="checkbox" role="switch"
                           style="width: 2.5em; height: 1.25em; cursor: pointer;"
                           value="${status.id}" id="status_${status.id}" ${isChecked ? 'checked' : ''}
                           onchange="toggleStatusCard(this)">
                </div>
            </div>
        `;
        container.appendChild(col);
    });

    getModal('statusModal').show();
}

// Helper to toggle card styling dynamically
window.toggleStatusCard = function (checkbox) {
    const card = checkbox.closest('.status-card');
    if (checkbox.checked) {
        card.style.backgroundColor = '#f0f9ff';
        card.style.borderColor = '#b3e5fc';
    } else {
        card.style.backgroundColor = '#fff';
        card.style.borderColor = '#dee2e6';
    }
};

async function saveStudentStatus() {
    const index = document.getElementById('statusStudentIndex').value;
    const s = allStudents[index];
    if (!s) return;

    const checkboxes = document.querySelectorAll('#statusCheckboxes input[type="checkbox"]');
    const selectedStatuses = [];
    checkboxes.forEach(cb => {
        if (cb.checked) selectedStatuses.push(cb.value);
    });

    s.social_status = selectedStatuses;
    await saveData();
    getModal('statusModal').hide();
    showToast('تم تحديث الحالة بنجاح');
    filterStudents();
}

// --- Transfer Modal (Change Class / Status) ---

function openTransferModal(index) {
    const s = allStudents[index];
    if (!s) return;

    // Store index
    document.getElementById('transferStudentIndex').value = index;

    // Fill readonly info
    document.getElementById('transferStudentName').textContent = `${s.last_name || ''} ${s.first_name || ''}`;
    document.getElementById('transferStudentDob').textContent = formatDateDisplay(s.birth_date);
    document.getElementById('transferStudentYear').textContent = s.academic_year || s.year || '';
    document.getElementById('transferStudentLevel').textContent = displayLevel(s.level);

    // Stream info (secondary only)
    const streamBox = document.getElementById('transferStreamInfoBox');
    if (educationStage === 'secondary' && s.stream) {
        streamBox.style.display = '';
        document.getElementById('transferStudentStream').textContent = SubjectManager.getStreamName(s.stream) || s.stream;
    } else {
        streamBox.style.display = 'none';
    }

    // Populate class dropdown using same logic as updateModalContext
    const classSelect = document.getElementById('transferClass');
    const studentLevel = s.level || '';

    let classes = [...new Set(allStudents
        .filter(st => st.level === studentLevel && st.class)
        .map(st => String(st.class).trim())
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (classes.length === 0) {
        classes = ["01", "02", "03", "04"];
    }

    // Ensure current class is in the list
    const currentClass = String(s.class || '').trim();
    if (currentClass && !classes.includes(currentClass)) {
        const hasNumericMatch = classes.some(c => !isNaN(parseInt(c)) && !isNaN(parseInt(currentClass)) && parseInt(c) === parseInt(currentClass));
        if (!hasNumericMatch) {
            classes.push(currentClass);
            classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        }
    }

    classSelect.innerHTML = '<option value="">-- اختر الفوج --</option>';
    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        // Robust matching
        const selInt = parseInt(currentClass);
        const cwInt = parseInt(c);
        if (currentClass === c || (!isNaN(selInt) && !isNaN(cwInt) && selInt === cwInt)) {
            opt.selected = true;
        }
        classSelect.appendChild(opt);
    });

    // Set current status
    const statusSelect = document.getElementById('transferStatus');
    let currentStatus = s.status || 'external';
    // Normalize Arabic legacy values
    if (currentStatus === 'نصف داخلي') currentStatus = 'half_board';
    if (currentStatus === 'داخلي') currentStatus = 'boarding';
    if (currentStatus === 'خارجي') currentStatus = 'external';
    statusSelect.value = currentStatus;

    getModal('transferModal').show();
}

async function saveTransfer() {
    const index = document.getElementById('transferStudentIndex').value;
    const s = allStudents[index];
    if (!s) return;

    const newClass = document.getElementById('transferClass').value;
    const newStatus = document.getElementById('transferStatus').value;

    if (!newClass) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'يرجى اختيار الفوج', confirmButtonText: 'حسناً' });
        return;
    }

    // Track status change in history
    if (s.status !== newStatus) {
        const history = s.status_history || [];
        history.push({
            date: new Date().toISOString(),
            status: newStatus,
            previous_status: s.status
        });
        s.status_history = history;
    }

    // Apply changes
    s.class = newClass;
    s.status = newStatus;

    await saveData();
    getModal('transferModal').hide();
    showToast('تم تغيير الفوج/الصفة بنجاح');
    populateFilters();
    filterStudents();
}

function formatDateDisplay(isoDate) {

    if (!isoDate) return '-';

    // isoDate is YYYY-MM-DD

    const parts = isoDate.split('-');

    if (parts.length === 3) {

        return `${parts[2]}/${parts[1]}/${parts[0]}`;

    }

    return isoDate;

}

// --- Print Report Logic ---

function blockTrialPrint() {
    if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {
        const message = (typeof Auth.getBlockedMessage === 'function')
            ? Auth.getBlockedMessage('print')
            : 'Printing is unavailable in trial mode.';
        Swal.fire({ icon: 'warning', title: '\u062a\u0646\u0628\u064a\u0647', text: message });
        return true;
    }
    return false;
}

async function printStudentList() {

    if (blockTrialPrint()) return;

    const level = document.getElementById('levelSelect').value;

    const cls = document.getElementById('classSelect').value;

    // Read custom print columns if they exist (from modal)
    let selectedColumns = null;
    const isCustomPrint = arguments[0] === true; // we pass true from printCustomStudentList
    if (isCustomPrint) {
        selectedColumns = Array.from(document.querySelectorAll('.print-col-checkbox:checked')).map(cb => cb.value);
        if (selectedColumns.length === 0) {
            Swal.fire('خطأ', 'الرجاء تحديد عمود واحد على الأقل للطباعة.', 'warning');
            return;
        }

        // Hide modal
        const modalEl = document.getElementById('printColumnsModal');
        if (modalEl) {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }
    }

    const settings = await DB.getSettings();

    // Get signer info from signature settings

    const sigSettings = await DB.get('signatureSettings') || {};

    const reportConfig = sigSettings.reportSettings?.['student_list'] || { signer: 'director', showSignature: true };

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    // Determine title based on signer type and gender

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }
    const signerName = signerData.fullName || settings.managerName || '';
    // Check for Scholarship View
    const scholarshipSelect = document.getElementById('statusSelect');
    if (scholarshipSelect && scholarshipSelect.value === 'scholarship_5000') {
        printScholarshipList(filteredStudents, settings, signerTitle, signerName);
        return;
    }

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // Check if Status Filter is Active
    const statusSelect = document.getElementById('statusSelect');
    const isStatusFilterActive = statusSelect && statusSelect.value;
    const statusLabel = isStatusFilterActive ? SOCIAL_STATUSES.find(s => s.id === statusSelect.value)?.label : '';

    let pageTitle = "قائمة التلاميذ";
    if (isStatusFilterActive && statusLabel) {
        pageTitle = `قائمة التلاميذ ( ${statusLabel} )`;
    }

    // --- Custom Print Function for 5000DA Scholarship ---
    function printScholarshipList(students, settings, signerTitle, signerName) {
        // Filter for confirmed students only
        students = students.filter(s => s.scholarship_confirmed === true);

        if (students.length === 0) {
            if (students.length === 0) {
                Swal.fire('تنبيه', "لا يوجد تلاميذ مؤكدين في القائمة. يرجى تأكيد استلام المنحة أولاً باستخدام زر 'تأكيد' في الجدول.", 'info');
                return;
            }
        }

        const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
        const city = settings.municipality || settings.wilaya || 'وادي العلندة';

        // Sort: Level -> Class -> Name
        students.sort((a, b) => {
            if (a.level !== b.level) return a.level.localeCompare(b.level);
            if (a.class != b.class) return parseInt(a.class) - parseInt(b.class);
            return a.last_name.localeCompare(b.last_name);
        });

        const rowsHtml = students.map((s, idx) => {
            let classDisplay = '';
            const levelNum = (s.level || '').replace(/[^0-9]/g, '') || '1'; // Extract number or default
            const cleanClass = (s.class || '').replace(/^\D+/g, ''); // Extract number from class if needed, or just use s.class

            if (settings.educationStage === 'secondary') {
                const streamAbbr = SubjectManager.getStreamAbbreviation(s.stream) || '';
                classDisplay = `${levelNum} ${streamAbbr} ${s.class}`;
            } else {
                // Middle school default - use normalizeLevel to extract a reliable number
                const normalized = normalizeLevel(s.level);
                const lNum = normalized.replace(/[^0-9]/g, '') || levelNum;
                classDisplay = `${lNum} متوسط ${s.class}`;
            }

            return `<tr class="animate-fade-in-up stagger-item stagger-${(typeof index !== "undefined" ? index % 10 : 0) + 1}">
            <td style="text-align: center;">${idx + 1}</td>
            <td style="text-align: center;">${s.national_id || ''}</td>
            <td style="text-align: right; padding-right: 5px;">${s.last_name || ''} ${s.first_name || ''}</td>
            <td style="text-align: center;">${formatDateDisplay(s.birth_date)}</td>
            <td style="text-align: center;">${s.pob || ''}</td>
            <td style="text-align: center;">${s.gender === 'M' ? 'ذكر' : 'أنثى'}</td>
            <td style="text-align: center;">${s.father_name || ''}</td>
            <td style="text-align: center;">${s.mother_name || ''}</td>
            <td style="text-align: center;">${classDisplay}</td>
            <td style="text-align: center;">${s.observation || ''}</td>
        </tr>
    `;
        }).join('');

        const printContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <title>قائمة 5000 دج</title>
        <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Tajawal', 'Amiri', 'Times New Roman', serif; margin: 0; padding: 0; }
            .header-container { width: 100%; margin-bottom: 20px; }
            .center-text { text-align: center; font-weight: bold; font-size: 14pt; }
            .side-row { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px; font-weight: bold; font-size: 12pt; }
            .list-title { text-align: center; font-size: 18pt; font-weight: 900; margin: 20px 0; text-decoration: underline; }

            table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11pt; }
            th, td { border: 1.5px solid #000; padding: 4px; }
            th { background-color: #f0f0f0; font-weight: bold; text-align: center; }

            /* Specific Column Widths based on image */
            th:nth-child(1) { width: 4%; } /* Number */
            th:nth-child(2) { width: 15%; } /* NID */
            th:nth-child(3) { width: 20%; } /* Name */
            th:nth-child(4) { width: 10%; } /* DOB */
            th:nth-child(5) { width: 10%; } /* POB */
            th:nth-child(6) { width: 5%; } /* Gender */
            th:nth-child(7) { width: 8%; } /* Father */
            th:nth-child(8) { width: 8%; } /* Mother */
            th:nth-child(9) { width: 10%; } /* Class */
            th:nth-child(10) { width: 10%; } /* Notes */

            .footer { margin-top: 20px; text-align: left; font-size: 12pt; font-weight: bold; margin-left: 50px; }
            .signature { margin-top: 10px; text-decoration: underline; }
            .signer-name { margin-top: 50px; }
        </style>
    \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>
    <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
        <div class="header-container">
            <div class="center-text">
                الجمهورية الجزائرية الديمقراطية الشعبية<br>
                وزارة التربية الوطنية
            </div>
            <div class="side-row">
                <div style="text-align: right;">
                    مديرية التربية لولاية ${settings.wilaya || '...'}<br>
                    المؤسسة: ${settings.institutionName || '...'} - ${city}
                </div>
                <div style="text-align: left;">
                     الموسم الدراسي : 2025/2026
                </div>
            </div>
        </div>

        <div class="list-title">قائمة التلاميذ الخاصة بمنحة 5000 دج</div>

        <table>
            <thead>
                <tr>
                    <th>الرقم</th>
                    <th>الرقم الوطني</th>
                    <th>لقب و اسم التلميذ</th>
                    <th>تاريخ الميلاد</th>
                    <th>مكان الميلاد</th>
                    <th>الجنس</th>
                    <th>الأب</th>
                    <th>الأم</th>
                    <th>القسم</th>
                    <th>ملاحظات</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>

        <div class="footer">
            ${city} في: ${today}<br>
            <div class="signature">
                إمضاء ${signerTitle}:
            </div>
        </div>
        <script>
            // window.onload auto-print removed
        </script>
    \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>
    </html>
    `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
    }

    // Check settings
    // Fit to page is now handled by our toggle state
    const fitToPage = window._fitToPageEnabled || false;
    const showStatus = document.getElementById('showStatusPrint') && document.getElementById('showStatusPrint').checked;
    const showNationalId = document.getElementById('showNationalIdPrint') && document.getElementById('showNationalIdPrint').checked;

    // 1. Group Data OR Unified List
    let allContent = '';
    const groups = {};

    if (filteredStudents.length === 0) {
        Swal.fire('تنبيه', "لا توجد بيانات للطباعة", 'info');
        return;
    }

    if (isStatusFilterActive) {
        // --- UNIFIED TABLE MODE ---
        // Sort all students by Level -> Class -> Name
        filteredStudents.sort((a, b) => {
            if (a.level !== b.level) return a.level.localeCompare(b.level);
            if (a.class != b.class) return parseInt(a.class) - parseInt(b.class);
            return a.last_name.localeCompare(b.last_name);
        });

        const total = filteredStudents.length;
        const males = filteredStudents.filter(s => s.gender === 'M').length;
        const females = total - males;

        const rowsHtml = filteredStudents.map((s, idx) => `<tr class="animate-fade-in-up stagger-item stagger-${(typeof index !== "undefined" ? index % 10 : 0) + 1}">
                ${(!selectedColumns || selectedColumns.includes('number')) ? `<td>${idx + 1}</td>` : ''}
                ${(!selectedColumns || selectedColumns.includes('last_name')) ? `<td>${s.last_name || ''}</td>` : ''}
                ${(!selectedColumns || selectedColumns.includes('first_name')) ? `<td>${s.first_name || ''}</td>` : ''}
                ${(!selectedColumns || selectedColumns.includes('birth_date')) ? `<td>${formatDateDisplay(s.birth_date)}</td>` : ''}
                ${(!selectedColumns || selectedColumns.includes('gender')) ? `<td>${s.gender === 'M' ? 'ذكر' : 'أنثى'}</td>` : ''}
                ${(!selectedColumns || selectedColumns.includes('repeat')) ? `<td>${s.repeat ? 'نعم' : 'لا'}</td>` : ''}
                ${(!selectedColumns || selectedColumns.includes('level')) ? `<td>${displayLevel(s.level)}</td>` : ''}
                ${(!selectedColumns || selectedColumns.includes('class')) ? `<td>${s.class || ''}</td>` : ''}
                ${settings.educationStage === 'secondary' && (!selectedColumns || selectedColumns.includes('stream')) ? `<td>${SubjectManager.getStreamAbbreviation(s.stream) || '-'}</td>` : ''}
                ${(!selectedColumns || selectedColumns.includes('status')) && showStatus ? `<td>${(s.status === 'half_board' || s.status === 'نصف داخلي') ? 'ن-داخلي' : (s.status === 'boarding' ? 'داخلي' : (s.status === 'external' ? 'خارجي' : s.status))}</td>` : ''}
                ${(!selectedColumns || selectedColumns.includes('observation')) ? `<td>${s.observation || ''}</td>` : ''}
            </tr>
        `).join('');

        const sectionHtml = `
            <div class="print-page">
                <div class="header-container" style="margin-bottom: 5px;">
                    <!-- Row 1: Republic & Ministry -->
                    <div class="center-text" style="margin-bottom: 2px;">
                        <h3 style="line-height:1;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>
                        <h3 style="line-height:1;">وزارة التربية الوطنية</h3>
                    </div>

                    <!-- Row 2: School (Right) - Directorate (Left) -->
                    <div class="header-row" style="margin-bottom: 2px;">
                        <div class="header-box" style="text-align: right;">
                            <h3 style="line-height:1;">المؤسسة: ${settings.institutionName || 'بوشيرب محمد'}</h3>
                        </div>
                        <div class="header-box" style="text-align: left;">
                            <h3 style="line-height:1;">مديرية التربية لولاية ${settings.wilaya || 'عين الدفلى'}</h3>
                        </div>
                    </div>

                    <!-- Row 3: Title (Center) -->
                    <div class="center-text" style="margin-bottom: 5px;">
                        <h2 style="text-decoration: underline; margin: 0; line-height:1;">${pageTitle}</h2>
                    </div>

                    <!-- Row 4: Info Bar (Stats - Year) -->
                    <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 2px 0; background-color: #f9f9f9; align-items: center;">
                        <div class="header-box center-text" style="width: 50%;">
                             <h3 style="margin:0; font-size: 10pt; line-height:1;">العدد الإجمالي: ${total} &nbsp;|&nbsp; ذكور: ${males} &nbsp;|&nbsp; إناث: ${females}</h3>
                        </div>
                        <div class="header-box" style="text-align: left; width: 50%;">
                                <h3 style="margin:0; line-height:1;">السنة الدراسية: ${settings.schoolYear || '2025/2026'}</h3>
                        </div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                             ${(!selectedColumns || selectedColumns.includes('number')) ? '<th width="3%">#</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('last_name')) ? '<th width="12%">اللقب</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('first_name')) ? '<th width="12%">الاسم</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('birth_date')) ? '<th width="8%">تاريخ الميلاد</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('gender')) ? '<th width="5%">الجنس</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('repeat')) ? '<th width="4%">معيد</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('level')) ? '<th width="8%">المستوى</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('class')) ? '<th width="4%">الفوج</th>' : ''}
                            ${settings.educationStage === 'secondary' && (!selectedColumns || selectedColumns.includes('stream')) ? '<th width="6%">الشعبة</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('status')) && showStatus ? '<th width="5%">الصفة</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('observation')) ? '<th width="10%">ملاحظات</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="footer" style="display: flex; justify-content: flex-end;">
                    <div style="text-align: center; min-width: 200px;">
                        <div style="margin-bottom: 8px;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                        <div style="font-weight: bold; font-size: 14pt;">المدير</div>
                    </div>
                </div>
            </div>
        `;
        allContent = sectionHtml;

    } else {
        // --- STANDARD GROUPED MODE ---
        filteredStudents.forEach(s => {
            // Include stream in the key for secondary education
            const streamKey = s.stream || '';
            const key = `${s.level}|${streamKey}|${s.class}`;
            if (!groups[key]) {
                groups[key] = {

                    level: s.level,
                    cls: s.class,
                    stream: s.stream || '',
                    students: []
                };
            }
            groups[key].students.push(s);
        });

        // Sort groups by level, then stream, then class
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            const ga = groups[a];
            const gb = groups[b];
            // 1. Compare levels
            if (ga.level !== gb.level) return ga.level.localeCompare(gb.level);
            // 2. Compare streams
            const streamNameA = SubjectManager.getStreamName(ga.stream) || '';
            const streamNameB = SubjectManager.getStreamName(gb.stream) || '';
            if (streamNameA !== streamNameB) return streamNameA.localeCompare(streamNameB);
            // 3. Compare classes
            const ca = parseInt(ga.cls) || 0;
            const cb = parseInt(gb.cls) || 0;
            return ca - cb;
        });

        sortedKeys.forEach((key, index) => {
            const group = groups[key];
            const rowsHtml = group.students.map((s, idx) => `<tr class="animate-fade-in-up stagger-item stagger-${(typeof index !== "undefined" ? index % 10 : 0) + 1}">
                        ${(!selectedColumns || selectedColumns.includes('number')) ? `<td>${idx + 1}</td>` : ''}
                        ${showNationalId && (!selectedColumns || selectedColumns.includes('national_id')) ? `<td>${s.national_id || ''}</td>` : ''}
                        ${(!selectedColumns || selectedColumns.includes('last_name')) ? `<td>${s.last_name || ''}</td>` : ''}
                        ${(!selectedColumns || selectedColumns.includes('first_name')) ? `<td>${s.first_name || ''}</td>` : ''}
                        ${(!selectedColumns || selectedColumns.includes('birth_date')) ? `<td>${formatDateDisplay(s.birth_date)}</td>` : ''}
                        ${(!selectedColumns || selectedColumns.includes('gender')) ? `<td>${s.gender === 'M' ? 'ذكر' : 'أنثى'}</td>` : ''}
                        ${(!selectedColumns || selectedColumns.includes('repeat')) ? `<td>${s.repeat ? 'نعم' : 'لا'}</td>` : ''}
                        ${(!selectedColumns || selectedColumns.includes('status')) && showStatus ? `<td>${(s.status === 'half_board' || s.status === 'نصف داخلي') ? 'ن-داخلي' : (s.status === 'boarding' ? 'داخلي' : (s.status === 'external' ? 'خارجي' : s.status))}</td>` : ''}
                        ${(!selectedColumns || selectedColumns.includes('observation')) ? `<td>${s.observation || ''}</td>` : ''}
                </tr>
            `).join('');

            // ... (construct sectionHtml - reusing existing structure structure would be ideal but for simplicity I will reconstruct or just let the flow continue)
            // Wait, I need to output sectionHtml to allContent.
            // Stream Info for Secondary
            let streamInfo = '';
            if (settings.educationStage === 'secondary' && group.students.length > 0 && group.students[0].stream) {
                const sName = (typeof SubjectManager !== 'undefined') ? SubjectManager.getStreamName(group.students[0].stream) : group.students[0].stream;
                streamInfo = ` &nbsp;|&nbsp; الشعبة: ${sName}`;
            }

            const pageBreakClass = index > 0 ? 'page-break' : '';
            const total = group.students.length;
            const males = group.students.filter(s => s.gender === 'M').length;
            const females = total - males;

            const sectionHtml = `
            <div class="print-page ${pageBreakClass}">
                <div class="header-container" style="margin-bottom: 5px;">
                    <!-- Header Rows -->
                     <div class="center-text" style="margin-bottom: 2px;">
                        <h3 style="line-height:1;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>
                        <h3 style="line-height:1;">وزارة التربية الوطنية</h3>
                    </div>
                    <div class="header-row" style="margin-bottom: 2px;">
                        <div class="header-box" style="text-align: right;">
                            <h3 style="line-height:1;">المؤسسة: ${settings.institutionName || 'بوشيرب محمد'}</h3>
                        </div>
                        <div class="header-box" style="text-align: left;">
                            <h3 style="line-height:1;">مديرية التربية لولاية ${settings.wilaya || 'عين الدفلى'}</h3>
                        </div>
                    </div>
                    <div class="center-text" style="margin-bottom: 5px;">
                        <h2 style="text-decoration: underline; margin: 0; line-height:1;">${pageTitle}</h2>
                    </div>
                    <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 2px 0; background-color: #f9f9f9; align-items: center;">
                            <div class="header-box" style="text-align: right; width: 40%;">
                            <h3 style="margin:0; line-height:1.3;">المستوى: ${displayLevel(group.level)} &nbsp;-&nbsp; القسم: ${group.cls}${streamInfo ? '<br>' + streamInfo.replace(' &nbsp;|&nbsp; ', '') : ''}</h3>
                        </div>
                        <div class="header-box center-text" style="width: 25%;">
                            <h3 style="margin:0; font-size: 10pt; line-height:1;">العدد: ${total} &nbsp;|&nbsp; ذ: ${males} &nbsp;|&nbsp; إ: ${females}</h3>
                        </div>
                        <div class="header-box" style="text-align: left; width: 35%;">
                                <h3 style="margin:0; line-height:1;">السنة الدراسية: ${settings.schoolYear || '2025/2026'}</h3>
                        </div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            ${(!selectedColumns || selectedColumns.includes('number')) ? '<th width="5%">#</th>' : ''}
                            ${showNationalId && (!selectedColumns || selectedColumns.includes('national_id')) ? '<th width="15%">رقم التعريف</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('last_name')) ? '<th width="20%">اللقب</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('first_name')) ? '<th width="20%">الاسم</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('birth_date')) ? '<th width="15%">تاريخ الميلاد</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('gender')) ? '<th width="5%">الجنس</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('repeat')) ? '<th width="5%">معيد</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('status')) && showStatus ? '<th width="10%">الصفة</th>' : ''}
                            ${(!selectedColumns || selectedColumns.includes('observation')) ? `<th width="${(showNationalId && (!selectedColumns || selectedColumns.includes('national_id'))) ? (showStatus ? '10%' : '15%') : (showStatus ? '15%' : '20%')}">ملاحظات</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="footer" style="display: flex; justify-content: flex-end;">
                    <div style="text-align: center; min-width: 200px;">
                        <div style="margin-bottom: 8px;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                        <div style="font-weight: normal; font-size: 14pt;">المدير</div>
                    </div>
                </div>
            </div>
            `;
            allContent += sectionHtml;
        });
    }

    // Additional CSS for compact mode

    let compactStyles = '';

    if (fitToPage) {

        compactStyles = `

            .header-container { margin-bottom: 2px !important; }

            h1, h2, h3 { line-height: 1.1 !important; margin: 0 !important; }

            h2 { font-size: 13pt !important; }

            h3 { font-size: 10pt !important; }

            .header-row { padding: 2px 0 !important; margin-top: 2px !important; margin-bottom: 2px !important; }

            table { margin-top: 5px !important; }

            th, td { font-size: 10pt !important; padding: 1px 3px !important; height: auto !important; }

            .footer { margin-top: 15px !important; font-size: 11pt !important; }

            .print-page { margin-bottom: 0 !important; page-break-after: always; }

        `;

    }

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>طباعة قائمة التلاميذ</title>
            <style>
                @font-face {
                    font-family: 'Tajawal';
                    font-style: normal;
                    font-weight: 400;
                    src: url('assets/fonts/Tajawal-Regular.ttf') format('truetype');
                }
                @font-face {
                    font-family: 'Tajawal';
                    font-style: normal;
                    font-weight: 700;
                    src: url('assets/fonts/Tajawal-Bold.ttf') format('truetype');
                }

                body { font-family: 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0.5cm; }

                .print-page { margin-bottom: 2cm; }

                .header-container { width: 100%; margin-bottom: 10px; }

                .center-text { text-align: center; }

                h1, h2, h3 { margin: 0; color: #000; padding: 0; }

                h2 { font-size: 14pt; margin-bottom: 2px; }

                h3 { font-size: 11pt; margin-bottom: 2px; }

                .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; }

                .header-box { width: 33%; }

                table { width: 100%; border-collapse: collapse; margin-top: 5px; }

                th, td { border: 0.5pt solid #000; padding: 2px 4px; text-align: center; font-size: 11pt; line-height: 1.2; }

                th { background-color: #f0f0f0; font-weight: bold; padding: 4px; }

                .footer { margin-top: 10px; display: flex; justify-content: space-between; font-size: 12pt; }

                @media print {

                    @page { margin: 0.5cm; margin-top: 0.5cm; size: A4; }

                    body { -webkit-print-color-adjust: exact; padding-top: 0 !important; }

                    /* Page Break */

                    .page-break {

                        page-break-before: always;

                        break-before: page;

                        display: block;

                    }

                    .print-page {

                        margin-bottom: 0;

                        display: block;

                        page-break-inside: avoid;

                    }

                    /* Ensure table header repeats if a single class spans multiple pages */

                    thead { display: table-header-group; }

                    tr { page-break-inside: avoid; }

                }

                /* Compact Mode Styles */

                ${compactStyles}

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

            ${allContent}

            <script>

                // Auto print

                // window.onload auto-print removed

            </script>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

}

async function printStruckOffList() {

    if (blockTrialPrint()) return;

    const settings = await DB.getSettings();

    const sigSettings = await DB.get('signatureSettings') || {};

    const reportConfig = sigSettings.reportSettings?.['student_list'] || { signer: 'director', showSignature: true };

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    // Determine title

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }
    const signerName = signerData.fullName || settings.managerName || '';
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // Fetch struck-off students
    const allStudentsIncluding = await DB.getStudents(true) || [];
    const leftStudents = allStudentsIncluding.filter(s => s.struck_off === true || s.struck_off === 1 || s.struck_off === '1');

    // Sort by strike date or name

    leftStudents.sort((a, b) => {

        if (a.strike_date !== b.strike_date) return (a.strike_date || '').localeCompare(b.strike_date || '');

        return a.last_name.localeCompare(b.last_name);

    });

    const rowsHtml = leftStudents.map((s, idx) => {

        const shortLevel = displayLevel(s.level);

        const type = s.strike_type === 'transfer' ? 'تحويل' : 'شطب';

        const typeColor = s.strike_type === 'transfer' ? 'var(--secondary-color)' : '#e74c3c';

        return `<tr class="animate-fade-in-up stagger-item stagger-${(typeof index !== "undefined" ? index % 10 : 0) + 1}">

            <td>${idx + 1}</td>

            <td>${s.national_id || ''}</td>

            <td>${s.last_name || ''}</td>

            <td>${s.first_name || ''}</td>

            <td>${formatDateDisplay(s.birth_date)}</td>

            <td>${shortLevel}</td>

            <td>${s.class || ''}</td>
            ${educationStage === 'secondary' ? `<td>${SubjectManager.getStreamName(s.stream) || '-'}</td>` : ''}
            <td>${formatDateDisplay(s.strike_date)}</td>

            <td style="color:${typeColor}; font-weight:bold;">${type}</td>

            <td>${s.strike_reason || ''}</td>

        </tr>

    `;

    }).join('');

    // Totals

    const total = leftStudents.length;

    const males = leftStudents.filter(s => s.gender === 'M').length;

    const females = total - males;

    // Sub-stats

    const transferred = leftStudents.filter(s => s.strike_type === 'transfer').length;

    const struck = leftStudents.filter(s => s.strike_type !== 'transfer').length;

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>قائمة التلاميذ المغادرون</title>
            <style>
                @font-face {
                    font-family: 'Tajawal';
                    font-style: normal;
                    font-weight: 400;
                    src: url('assets/fonts/Tajawal-Regular.ttf') format('truetype');
                }
                @font-face {
                    font-family: 'Tajawal';
                    font-style: normal;
                    font-weight: 700;
                    src: url('assets/fonts/Tajawal-Bold.ttf') format('truetype');
                }

                body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 0.5cm; }

                .header-container { width: 100%; margin-bottom: 10px; }

                .center-text { text-align: center; }

                h1, h2, h3 { margin: 0; color: #000; padding: 0; }

                h2 { font-size: 14pt; margin-bottom: 2px; }

                h3 { font-size: 11pt; margin-bottom: 2px; }

                .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; }

                .header-box { width: 33%; }

                table { width: 100%; border-collapse: collapse; margin-top: 10px; }

                th, td { border: 0.5pt solid #000; padding: 4px; text-align: center; font-size: 11pt; }

                th { background-color: #f0f0f0; font-weight: bold; }

                .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 12pt; }

                @media print {

                    @page { size: A4; margin: 0.5cm; }

                    body { -webkit-print-color-adjust: exact; }

                }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ""}

            <div class="header-container" style="margin-bottom: 5px;">
                <div class="center-text" style="margin-bottom: 2px;">
                    <h3 style="line-height:1;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>
                    <h3 style="line-height:1;">وزارة التربية الوطنية</h3>
                </div>
                <div class="header-row" style="margin-bottom: 2px;">
                    <div class="header-box" style="text-align: right;">
                        <h3 style="line-height:1;">المؤسسة: ${settings.institutionName || "......." }</h3>
                    </div>
                    <div class="header-box" style="text-align: left;">
                        <h3 style="line-height:1;">مديرية التربية لولاية ${settings.wilaya || "......." }</h3>
                    </div>
                </div>
                <div class="center-text" style="margin-bottom: 5px;">
                    <h2 style="text-decoration: underline; margin: 0; line-height:1;">قائمة التلاميذ المغادرون (شطب / تحويل)</h2>
                </div>
                <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 2px 0; background-color: #f9f9f9; align-items: center;">
                    <div class="header-box" style="text-align: right; width: 30%;">
                        <h3 style="margin:0; line-height:1;">السنة الدراسية: ${settings.schoolYear || "2025/2026" }</h3>
                    </div>
                    <div class="header-box center-text" style="width: 40%;">
                        <h3 style="margin:0; font-size: 10pt; line-height:1;">العدد: ${total} (شطب: ${struck} | تحويل: ${transferred})</h3>
                    </div>
                     <div class="header-box" style="text-align: left; width: 30%;">
                        <h3 style="margin:0; font-size: 10pt; line-height:1;">ذكور: ${males} | إناث: ${females}</h3>
                     </div>
                </div>
            </div>

            <table>

                <thead>

                    <tr>

                        <th width="5%">#</th>

                        <th width="15%">رقم التعريف</th>

                        <th width="15%">اللقب</th>

                        <th width="15%">الاسم</th>

                        <th width="10%">تاريخ الميلاد</th>

                        <th width="8%">المستوى</th>

                        <th width="5%">الفوج</th>
                        ${educationStage === 'secondary' ? '<th width="15%">الشعبة</th>' : ''}
                        <th width="10%">تاريخ الإجراء</th>

                        <th width="7%">نوع</th>

                        <th width="10%">ملاحظات</th>

                    </tr>

                </thead>

                <tbody>

                    ${rowsHtml}

                </tbody>

            </table>

            <div class="footer" style="justify-content: flex-end;">
                <div style="text-align: center; min-width: 200px;">
                    <div style="margin-bottom: 5px;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                    <div>${signerTitle}</div>
                </div>
            </div>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

}

// --- Print Summons (استدعاء) ---

async function printSummons(index) {

    const student = allStudents[index];
    if (!student) return;

    // Optional Date and Time Input
    const { value: formValues } = await Swal.fire({
        title: 'تحديد موعد الحضور',
        html: `
            <div style="text-align: right; font-family: 'Tajawal', sans-serif;">
                <div class="mb-3">
                    <label class="form-label fw-bold">تاريخ الحضور (اختياري):</label>
                    <input id="swal-summons-date" class="form-control" type="date" style="text-align: right;">
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">توقيت الحضور (اختياري):</label>
                    <input id="swal-summons-time" class="form-control" type="time" style="text-align: right;">
                </div>
                <div class="alert alert-info py-2" style="font-size: 0.85rem;">
                    <i class="fas fa-info-circle me-1"></i> اتركه فارغاً إذا كنت تريد ملأه يدوياً بالقلم.
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'توليد الاستدعاء',
        cancelButtonText: 'إلغاء',
        preConfirm: () => {
            return {
                date: document.getElementById('swal-summons-date').value,
                time: document.getElementById('swal-summons-time').value
            }
        }
    });

    if (!formValues) return;

    if (blockTrialPrint()) return;

    const settings = await DB.getSettings();
    const today = new Date().toLocaleDateString('ar-DZ');
    const studentName = `${student.last_name} ${student.first_name}`;

    const isSecondary = settings.educationStage === 'secondary';
    const streamName = isSecondary && student.stream ? SubjectManager.getStreamName(student.stream) : '';
    const studentClass = isSecondary && streamName
        ? `${displayLevel(student.level)} ${student.class} - ${streamName}`
        : `${displayLevel(student.level)} ${student.class}`;

    const dobDisplay = formatDateDisplay(student.birth_date);
    
    // Process custom date/time
    const displayDate = formValues.date ? formatDateDisplay(formValues.date) : '...........................';
    const displayTime = formValues.time ? formValues.time : '...........................';

    // Generate two summons per page (compact layout)
    const singleCard = `
            <div class="summons-card-half">
                <div class="card-top">
                    <div style="text-align: center; margin-bottom: 5px;">
                        <h3 style="margin: 2px 0; font-size: 10.5pt;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>
                        <h3 style="margin: 2px 0; font-size: 10.5pt;">وزارة التربية الوطنية</h3>
                        <div style="display: flex; justify-content: space-between; margin-top: 5px; padding: 3px 0; border-bottom: 1px solid #ccc; font-size: 9.5pt;">
                            <div style="text-align: left;"><p style="margin: 1px 0;">مديرية التربية لولاية ${settings.wilaya || 'عين الدفلى'}</p></div>
                            <div style="text-align: right;"><p style="margin: 1px 0;">المؤسسة: ${settings.institutionName || '........'}</p><p style="margin: 1px 0;">السنة: ${settings.schoolYear || '.......'}</p></div>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 12px 0;"><h2 style="font-size: 14pt; text-decoration: underline; margin: 0; letter-spacing: 2px;">استدعاء</h2></div>
                    
                    <div style="font-size: 9.5pt; margin: 5px 0;"><p style="margin: 0;">رقم: ................................</p></div>
                    
                    <div style="font-size: 11.5pt; padding: 0 5px;">
                        <p style="margin: 8px 0; line-height: 1.5;">إلى السيد(ة): ...........................................</p>
                        <p style="margin: 8px 0; line-height: 1.5;">ولي التلميذ(ة): <strong>${studentName}</strong> المولود(ة) بتاريخ: <strong>${dobDisplay}</strong></p>
                        <p style="margin: 8px 0; line-height: 1.5;">من القسم: <strong>${studentClass}</strong></p>
                        <p style="margin: 10px 0; line-height: 1.6;">الرجاء الحضور إلى المؤسسة يوم: <strong>${displayDate}</strong> الساعة: <strong>${displayTime}</strong> لأمر يهم ابنكم</p>
                    </div>
                </div>

                <div class="card-bottom">
                    <div style="margin-top: 5px; text-align: center; font-size: 10.5pt; font-style: italic;"><p style="margin: 0;">تقبلوا فائق عبارات التقدير والاحترام</p></div>
                    <div style="margin-top: 15px; display: flex; justify-content: space-between; font-size: 11pt; padding: 0 10px;">
                        <div style="text-align: center;">
                            <p style="margin: 0;">حرر بـ: ${settings.municipality || '........'}</p>
                            <p style="margin: 0;">في: ${today}</p>
                        </div>
                        <div style="text-align: center; min-width: 150px;">
                            <p style="margin: 0; font-weight: bold; text-decoration: underline;">المدير(ة) / المستشار</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

    const bodyContent = singleCard + '<div class="divider"></div>' + singleCard;

    const printContent = `

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>استدعاء - ${studentName}</title>

            <style>
                @font-face {
                    font-family: 'Tajawal';
                    src: url('assets/fonts/Tajawal-Regular.ttf') format('truetype');
                }
                body { font-family: 'Tajawal', serif; padding: 10px; margin: 0; direction: rtl; }
                @page { margin: 0.5cm; size: A4 portrait; }

                /* Single summons styles */

                .summons-card { padding: 20px; }

                .header-section { text-align: center; margin-bottom: 15px; }

                .header-section h3 { margin: 5px 0; font-weight: normal; font-size: 14pt; }

                .sub-header { display: flex; justify-content: space-between; margin-top: 10px; padding: 8px 0; border-bottom: 1px solid #ccc; }

                .sub-header p { margin: 3px 0; font-size: 12pt; }

                .title-section { text-align: center; margin: 20px 0; }

                .title-section h2 { font-size: 18pt; text-decoration: underline; margin: 0; }

                .ref-line { margin: 10px 0; font-size: 12pt; }

                .ref-line p { margin: 0; }

                .content-body { padding: 0 15px; }

                .content-body p { margin: 8px 0; line-height: 1.8; font-size: 14pt; }

                .closing { margin-top: 15px; text-align: center; font-size: 13pt; }

                .closing p { margin: 0; }

                .signature-section { margin-top: 30px; display: flex; justify-content: space-between; padding: 0 15px; }

                .sig-block { text-align: center; }

                .sig-block p { margin: 0; }

                /* Two per page styles */

                .summons-card-half { padding: 20px 30px; height: 13.8cm; box-sizing: border-box; border: 2.5px solid #000; margin: 0 auto 0.5cm auto; overflow: hidden; position: relative; display: flex; flex-direction: column; justify-content: space-between; width: 100%; max-width: 19cm; }

                .divider { height: 10px; }

                @media print { body { -webkit-print-color-adjust: exact; } }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body >\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

            ${bodyContent}

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

        </html>

    `;

    const printWindow = window.open('', '_blank');

    printWindow.document.write(printContent);

    printWindow.document.close();

}

// Duplicates removed. functions are defined earlier.

// --- Excel Import Logic ---
async function handlePobImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Get first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to array of arrays
            // Convert to array of arrays - Use raw:false for formatted strings
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
            if (rows.length === 0) throw new Error('الملف فارغ');

            let updatedCount = 0;
            let notFoundCount = 0;

            // --- Robust Column Detection ---
            // Defaults based on Ministry export (0-indexed):
            // ID=0, Name=1, Surname=2, DOB=6, POB=9
            let cols = { id: 0, first: 1, last: 2, dob: 6, pob: 9 };
            let detected = { id: false, first: false, last: false, dob: false, pob: false };

            // Scan first 10 rows for headers
            for (let i = 0; i < Math.min(10, rows.length); i++) {
                const row = rows[i];
                if (!row) continue;
                row.forEach((cell, idx) => {
                    const val = String(cell || '').trim();
                    // ID
                    // ID - Exclude "Date" columns
                    if ((val.includes('التعريف') || val.includes('التسجيل') || val.includes('رقم')) && !val.includes('تاريخ')) { cols.id = idx; detected.id = true; }
                    // Place of Birth (Makan Al-Milad / Al-Izdiad)
                    if (val.includes('مكان') && (val.includes('الميلاد') || val.includes('الازدياد'))) { cols.pob = idx; detected.pob = true; }
                    // Date of Birth (Tarikh Al-Milad / Al-Izdiad)
                    if (val.includes('تاريخ') && (val.includes('الميلاد') || val.includes('الازدياد'))) { cols.dob = idx; detected.dob = true; }
                    // Surname (Al-Laqab)
                    if (val.includes('اللقب')) { cols.last = idx; detected.last = true; }
                    // First Name (Al-Ism)
                    if (val === 'الاسم' || val.includes('الإسم')) { cols.first = idx; detected.first = true; }
                });
            }

            // Normalize functions
            const normalizeId = (id) => String(id || '').replace(/\D/g, '').trim();
            const normalizeStr = (str) => String(str || '').replace(/\s+/g, ' ').trim();

            // Create lookup maps
            const idMap = {};
            const keyMap = {};

            allStudents.forEach(s => {
                const nId = normalizeId(s.national_id);
                const rId = normalizeId(s.reg_number);
                if (nId) idMap[nId] = s;
                if (rId) idMap[rId] = s;

                const key = `${normalizeStr(s.last_name)}|${normalizeStr(s.first_name)}|${s.birth_date}`;
                keyMap[key] = s;
            });

            // Process Rows
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                // Ensure row has enough columns for at least ID and POB
                if (!row || row.length <= Math.max(cols.id, cols.pob)) continue;

                const rawId = row[cols.id];
                const pob = row[cols.pob];

                // Check if this row looks like a header (contains "التعريف" etc)
                // Use a known header keyword to skip
                const firstCell = String(row[0] || '');
                if (firstCell.includes('التعريف') || firstCell.includes('اللقب') || String(rawId).includes('التعريف')) continue;

                if (pob) {
                    let student = null;

                    // 1. Try ID Match
                    const normIdExcel = normalizeId(rawId);
                    if (normIdExcel) {
                        student = idMap[normIdExcel];
                    }

                    // 2. Fallback: Name + DOB
                    if (!student) {
                        const fName = String(row[cols.first] || '');
                        const lName = String(row[cols.last] || '');
                        const rawDob = String(row[cols.dob] || '');

                        let normDob = rawDob;
                        if (rawDob.includes('/')) {
                            const p = rawDob.split('/');
                            if (p.length === 3) {
                                if (p[2].length === 4) normDob = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                                else if (p[0].length === 4) normDob = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
                            }
                        }

                        const nameKey = `${normalizeStr(lName)}|${normalizeStr(fName)}|${normDob}`;
                        student = keyMap[nameKey];
                    }

                    if (student) {
                        student.pob = String(pob).trim();
                        updatedCount++;
                    } else {
                        // Only count as not found if there was a valid ID or Name to begin with
                        // Avoid counting empty trailing rows
                        if (rawId || (row[cols.first] && row[cols.last])) {
                            notFoundCount++;
                        }
                    }
                }
            }

            if (updatedCount > 0) {
                await DB.saveStudents(allStudents);
                showToast(`تم تحديث مكان الميلاد لـ ${updatedCount} تلميذ.`);
                const resultEl = document.getElementById('pobImportResult');
                if (resultEl) {
                    resultEl.style.display = 'block';
                    resultEl.style.background = '#d4edda';
                    resultEl.style.color = '#155724';
                    resultEl.style.border = '1px solid #c3e6cb';
                    resultEl.innerHTML = `<i class="fas fa-check-circle me-2"></i> تم تحديث <strong>${updatedCount}</strong> تلميذ بنجاح` + (notFoundCount > 0 ? ` (لم يتم العثور على ${notFoundCount})` : '');
                }
                filterStudents();
            } else {
                const resultEl = document.getElementById('pobImportResult');
                if (resultEl) {
                    resultEl.style.display = 'block';
                    resultEl.style.background = '#fff3cd';
                    resultEl.style.color = '#856404';
                    resultEl.style.border = '1px solid #ffeaa7';

                    // Show debug info: columns + first non-header row sample
                    let debugSample = '';
                    if (rows.length > 5) {
                        const sampleRow = rows.find((r, i) => i > 0 && r && r[cols.id]);
                        if (sampleRow) {
                            debugSample = `<br><small style="direction:ltr; text-align:left; display:block; margin-top:5px;">
                                <strong>Debug Sample (Row X):</strong><br>
                                ID (Col ${cols.id + 1}): "${sampleRow[cols.id]}"<br>
                                POB (Col ${cols.pob + 1}): "${sampleRow[cols.pob]}"<br>
                                Name (Col ${cols.first + 1}): "${sampleRow[cols.first]}"<br>
                                Surname (Col ${cols.last + 1}): "${sampleRow[cols.last]}"<br>
                                DOB (Col ${cols.dob + 1}): "${sampleRow[cols.dob]}"
                            </small>`;
                        }
                    }

                    resultEl.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> لم يتم العثور على أي تطابق.<br>
                        <small>الأعمدة المكتشفة: معرف=${detected.id ? cols.id + 1 : 'لم يكتشف'}, مكان=${detected.pob ? cols.pob + 1 : 'لم يكتشف'}</small>
                        ${debugSample}`;
                }
            }

            console.log(`Import Report: Updated=${updatedCount}, NotFound=${notFoundCount}`);

        } catch (error) {
            console.error(error);
            showToast('حدث خطأ أثناء قراءة الملف. يرجى التأكد من صيغة الملف', 'error');
            const resultEl = document.getElementById('pobImportResult');
            if (resultEl) {
                resultEl.style.display = 'block';
                resultEl.style.background = '#f8d7da';
                resultEl.style.color = '#721c24';
                resultEl.style.border = '1px solid #f5c6cb';
                resultEl.innerHTML = '<i class="fas fa-times-circle me-2"></i> حدث خطأ أثناء قراءة الملف';
            }
        } finally {
            // Reset input to allow re-importing same file
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}

// Print Settings Modal
function openPrintSettingsModal() {
    getModal('printSettingsModal').show();
}

// --- Student Info Modal Editing Functions ---

// Enable editing on a field when clicked
function enableFieldEdit(displaySpan) {
    const container = displaySpan.closest('.info-field-editable');
    const field = container.dataset.field;
    const input = container.querySelector('.info-edit-input');
    const select = container.querySelector('.info-edit-select');
    const currentValue = window._studentInfoOriginal[field];

    // Check if this is a select field (gender, status, repeat, level, stream)
    const isSelectField = ['gender', 'status', 'repeat', 'level', 'stream'].includes(field);

    if (isSelectField) {
        // Setup select element
        select.style.display = 'block';
        displaySpan.style.display = 'none';

        // Populate options based on field type
        let options = [];
        if (field === 'gender') {
            options = [{ value: 'M', label: 'ذكر' }, { value: 'F', label: 'أنثى' }];
        } else if (field === 'status') {
            options = [
                { value: 'external', label: 'خارجي' },
                { value: 'half_board', label: 'نصف داخلي' },
                { value: 'boarding', label: 'داخلي' }
            ];
        } else if (field === 'repeat') {
            options = [{ value: '1', label: 'نعم' }, { value: '0', label: 'لا' }];
        } else if (field === 'level') {
            const helper = getAcademicHelper();
            options = helper && typeof helper.getLevelOptionsByStage === 'function'
                ? helper.getLevelOptionsByStage(educationStage)
                : [];
        } else if (field === 'stream' && educationStage === 'secondary') {
            // Get streams from SubjectManager if available
            if (typeof SubjectManager !== 'undefined' && SubjectManager.getStreams) {
                const levelValue = window._studentInfoOriginal.level;
                const streams = SubjectManager.getStreams(levelValue) || [];
                options = streams.map(s => ({ value: s.id || s, label: s.name || s }));
            }
        }

        select.innerHTML = '<option value="">-- اختر --</option>' +
            options.map(opt => `<option value="${opt.value}" ${opt.value === currentValue ? 'selected' : ''}>${opt.label}</option>`).join('');
        select.focus();
    } else {
        // Text/date input
        input.style.display = 'block';
        displaySpan.style.display = 'none';

        // Set input type for dates
        if (field.includes('date') || field === 'birth_date' || field === 'entry_date') {
            input.type = 'date';
            // Convert to YYYY-MM-DD for HTML date input
            input.value = convertISODateToInputValue(currentValue);
        } else {
            input.type = 'text';
            input.value = currentValue || '';
        }
        input.focus();
        input.select();
    }
}

// Convert Arabic date format to ISO format (YYYY-MM-DD)
function convertArabicDateToISO(dateStr) {
    if (!dateStr) return '';
    // Try to parse DD/MM/YYYY or similar formats
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
        let day, month, year;
        // Determine format based on values
        if (parseInt(parts[0]) > 12) {
            // DD/MM/YYYY
            day = parts[0].padStart(2, '0');
            month = parts[1].padStart(2, '0');
            year = parts[2];
        } else if (parseInt(parts[2]) > 31) {
            // DD/MM/YYYY
            day = parts[0].padStart(2, '0');
            month = parts[1].padStart(2, '0');
            year = parts[2];
        } else {
            // Assume DD/MM/YYYY
            day = parts[0].padStart(2, '0');
            month = parts[1].padStart(2, '0');
            year = parts[2];
        }
        return `${year}-${month}-${day}`;
    }
    return dateStr; // Return as-is if can't parse
}

// Convert ISO date format to input value (YYYY-MM-DD)
function convertISODateToInputValue(isoDate) {
    if (!isoDate) return '';
    // If already in YYYY-MM-DD format, return as-is
    if (isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return isoDate;
    }
    // Convert from DD/MM/YYYY to YYYY-MM-DD
    const parts = isoDate.split(/[\/\-\.]/);
    if (parts.length === 3) {
        let day, month, year;
        if (parseInt(parts[2]) > 31) {
            // DD/MM/YYYY
            day = parts[0].padStart(2, '0');
            month = parts[1].padStart(2, '0');
            year = parts[2];
        } else {
            // Try to figure out format
            day = parts[0].padStart(2, '0');
            month = parts[1].padStart(2, '0');
            year = parts[2];
        }
        return `${year}-${month}-${day}`;
    }
    return '';
}

// Mark a field as changed
function markFieldChanged(input) {
    const container = input.closest('.info-field-editable');
    const field = container.dataset.field;
    const newValue = input.value || input.options[input.selectedIndex]?.value || '';

    window._studentInfoChanged[field] = newValue;
    updateSaveButtons();
}

// Save field on blur (with small delay to allow onchange to fire)
function saveFieldOnBlur(input) {
    setTimeout(() => {
        const container = input.closest('.info-field-editable');
        const field = container.dataset.field;
        const displaySpan = container.querySelector('.info-display-value');
        const newValue = window._studentInfoChanged[field];

        // Update display value
        if (newValue !== undefined && newValue !== '') {
            displaySpan.textContent = newValue;
        } else {
            displaySpan.innerHTML = '<span style="color:#cbd5e1;">—</span>';
        }

        // Hide input, show display
        input.style.display = 'none';
        container.querySelector('.info-edit-select').style.display = 'none';
        displaySpan.style.display = 'inline';
    }, 200);
}

// Update save/cancel buttons visibility
function updateSaveButtons() {
    const hasChanges = Object.keys(window._studentInfoChanged || {}).length > 0;
    const saveBtn = document.getElementById('btnSaveStudentInfo');
    const cancelBtn = document.getElementById('btnCancelStudentEdit');

    if (saveBtn) saveBtn.style.display = hasChanges ? 'inline-block' : 'none';
    if (cancelBtn) cancelBtn.style.display = hasChanges ? 'inline-block' : 'none';
}

// Cancel all changes and restore original values
function cancelStudentEdit() {
    const original = window._studentInfoOriginal;
    if (!original) return;

    // Clear changes
    window._studentInfoChanged = {};
    updateSaveButtons();

    // Re-render all fields with original values
    const index = document.getElementById('infoStudentIndex').value;
    openStudentInfoModal(index);

    showToast('تم إلغاء جميع التغييرات', 'info');
}

// Save all changes to the student
async function saveStudentInfo() {
    const index = document.getElementById('infoStudentIndex').value;
    const s = allStudents[index];
    if (!s || Object.keys(window._studentInfoChanged).length === 0) return;

    // Show loading
    const saveBtn = document.getElementById('btnSaveStudentInfo');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> جاري الحفظ...';
    saveBtn.disabled = true;

    try {
        // Apply changes to student object
        for (const [field, value] of Object.entries(window._studentInfoChanged)) {
            // Handle special cases
            if (field === 'repeat') {
                s[field] = value === '1' || value === true || value === 'نعم';
            } else if (field === 'birth_date' || field === 'entry_date') {
                // Convert ISO date back to storage format if needed
                s[field] = value;
            } else if (field === 'status') {
                // Normalize status value
                s[field] = value;
            } else if (field === 'siblings_total' || field === 'siblings_female' || field === 'school_siblings_total') {
                s[field] = parseInt(value) || 0;
            } else {
                s[field] = value;
            }
        }

        // Save to database
        await saveData();

        // Clear changes
        window._studentInfoOriginal = JSON.parse(JSON.stringify(s));
        window._studentInfoChanged = {};
        updateSaveButtons();

        // Refresh the modal with updated data
        openStudentInfoModal(index);

        // Refresh the table
        filterStudents();

        showToast('تم حفظ التغييرات بنجاح', 'success');
    } catch (error) {
        console.error('Error saving student:', error);
        showToast('حدث خطأ أثناء الحفظ: ' + error.message, 'error');
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// --- Student Info Modal ---

function _buildInfoField(label, value, fullWidth = false, editable = false, fieldName = null) {
    const displayValue = value || '<span style="color:#cbd5e1;">—</span>';
    const fullWidthClass = fullWidth ? 'info-field-full-width' : '';

    if (editable && fieldName) {
        return `
            <div class="info-field-editable ${fullWidthClass}" data-field="${fieldName}">
                <div class="info-field-item">
                    <div class="info-field-label">${label}</div>
                    <div class="info-field-value">
                        <span class="info-display-value" onclick="enableFieldEdit(this)">${displayValue}</span>
                        <input type="text" class="info-edit-input form-control form-control-sm" style="display:none;" 
                               onchange="markFieldChanged(this)" onblur="saveFieldOnBlur(this)">
                        <select class="info-edit-select form-select form-select-sm" style="display:none;" 
                                onchange="markFieldChanged(this); saveFieldOnBlur(this)">
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="${fullWidthClass}">
            <div class="info-field-item">
                <div class="info-field-label">${label}</div>
                <div class="info-field-value">${displayValue}</div>
            </div>
        </div>
    `;
}

function openStudentInfoModal(index) {
    const s = allStudents[index];
    if (!s) return;

    document.getElementById('infoStudentIndex').value = index;

    // Store original data for cancel functionality
    window._studentInfoOriginal = JSON.parse(JSON.stringify(s));
    window._studentInfoChanged = {};

    // Name Banner
    const fullName = `${s.last_name || ''} ${s.first_name || ''}`.trim();
    document.getElementById('infoStudentFullName').textContent = fullName;

    // Avatar initials
    const initials = ((s.last_name || '').charAt(0) + (s.first_name || '').charAt(0)).trim() || '?';
    document.getElementById('infoStudentAvatar').textContent = initials;

    // Load student photo
    _loadStudentPhoto(s.id);

    // Subtitle: Level + Class
    const levelDisplay = displayLevel(s.level);
    const streamName = (educationStage === 'secondary' && s.stream) ? SubjectManager.getStreamName(s.stream) : '';
    let subtitle = `${levelDisplay} - الفوج ${s.class || ''}`;
    if (streamName) subtitle += ` - ${streamName}`;
    document.getElementById('infoStudentSubtitle').textContent = subtitle;

    // Gender Badge
    const genderBadge = document.getElementById('infoStudentGenderBadge');
    if (s.gender === 'F') {
        genderBadge.textContent = 'أنثى';
        genderBadge.style.background = 'linear-gradient(135deg, #f43f5e, #e11d48)';
        genderBadge.style.color = 'white';
    } else {
        genderBadge.textContent = 'ذكر';
        genderBadge.style.background = 'linear-gradient(135deg, #06b6d4, #0891b2)';
        genderBadge.style.color = 'white';
    }

    // Status Badge
    const statusBadge = document.getElementById('infoStudentStatusBadge');
    const statusMap = { 'half_board': 'نصف داخلي', 'نصف داخلي': 'نصف داخلي', 'boarding': 'داخلي', 'داخلي': 'داخلي' };
    statusBadge.textContent = statusMap[s.status] || 'خارجي';

    // --- Personal Info Tab ---
    const personalHtml = [
        _buildInfoField('اللقب', s.last_name, false, true, 'last_name'),
        _buildInfoField('الاسم', s.first_name, false, true, 'first_name'),
        _buildInfoField('تاريخ الميلاد', formatDateDisplay(s.birth_date), false, true, 'birth_date'),
        _buildInfoField('مكان الميلاد', s.pob, false, true, 'pob'),
        _buildInfoField('الجنس', s.gender === 'M' ? 'ذكر' : 'أنثى', false, true, 'gender'),
        _buildInfoField('رقم التعريف', s.national_id, false, true, 'national_id'),
    ].join('');
    document.getElementById('infoPersonalGrid').innerHTML = personalHtml;

    // --- Academic Info Tab ---
    let academicCards = [
        _buildInfoField('المستوى', levelDisplay, false, true, 'level'),
        _buildInfoField('الفوج (القسم)', s.class, false, true, 'class'),
    ];
    if (educationStage === 'secondary' && s.stream) {
        academicCards.push(_buildInfoField('الشعبة', streamName, false, true, 'stream'));
    }
    academicCards.push(
        _buildInfoField('الصفة', statusMap[s.status] || 'خارجي', false, true, 'status'),
        _buildInfoField('معيد', s.repeat ? 'نعم' : 'لا', false, true, 'repeat'),
        _buildInfoField('تاريخ الدخول', formatDateDisplay(s.entry_date), false, true, 'entry_date'),
        _buildInfoField('السنة الدراسية', s.academic_year || s.year || '', false, true, 'academic_year'),
    );
    document.getElementById('infoAcademicGrid').innerHTML = academicCards.join('');

    // --- Parent Info Tab ---
    const parentHtml = [
        _buildInfoField('اسم الأب', s.father_name, false, true, 'father_name'),
        _buildInfoField('اسم الأم', s.mother_name, false, true, 'mother_name'),
        _buildInfoField('مهنة الأب', s.father_job, false, true, 'father_job'),
        _buildInfoField('مهنة الأم', s.mother_job, false, true, 'mother_job'),
        _buildInfoField('رقم هاتف الولي', s.parent_phone || '', false, true, 'parent_phone'),
        _buildInfoField('بريد الولي الإلكتروني', s.parent_email || '', false, true, 'parent_email'),
        _buildInfoField('عدد الإخوة', s.siblings_total, false, true, 'siblings_total'),
        _buildInfoField('منهم إناث', s.siblings_female, false, true, 'siblings_female'),
        _buildInfoField('عدد المتمدرسين', s.school_siblings_total, false, true, 'school_siblings_total'),
    ].join('');
    document.getElementById('infoParentGrid').innerHTML = parentHtml;

    // --- Extra Info Tab ---
    // Social statuses
    const socialLabels = (s.social_status || []).map(sid => {
        const found = SOCIAL_STATUSES.find(ss => ss.id === sid);
        return found ? found.label : sid;
    }).join('، ');

    const extraHtml = [
        _buildInfoField('العنوان', s.address, true, true, 'address'),
        _buildInfoField('ملاحظات', s.observation, true, true, 'observation'),
        _buildInfoField('الحالة الاجتماعية / التربوية', socialLabels || 'لا توجد', true),
    ].join('');
    document.getElementById('infoExtraGrid').innerHTML = extraHtml;

    // Reset to first tab
    const firstTab = document.getElementById('tab-personal');
    if (firstTab) {
        const tabInstance = new bootstrap.Tab(firstTab);
        tabInstance.show();
    }

    // Show modal
    getModal('studentInfoModal').show();
}

async function printStudentInfoCard() {
    const index = document.getElementById('infoStudentIndex').value;
    const s = allStudents[index];
    if (!s) return;

    if (blockTrialPrint()) return;

    const settings = await DB.getSettings() || {};
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
    const schoolYear = settings.schoolYear || '2025/2026';
    const levelDisplay = displayLevel(s.level);
    const statusMap = { 'half_board': 'نصف داخلي', 'نصف داخلي': 'نصف داخلي', 'boarding': 'داخلي', 'داخلي': 'داخلي' };
    const statusStr = statusMap[s.status] || 'خارجي';
    const streamName = (educationStage === 'secondary' && s.stream) ? (typeof SubjectManager !== 'undefined' ? SubjectManager.getStreamName(s.stream) : s.stream) : '';

    // Social statuses
    const socialLabels = (s.social_status || []).map(sid => {
        const found = SOCIAL_STATUSES.find(ss => ss.id === sid);
        return found ? found.label : sid;
    }).join('، ') || 'لا توجد';

    // Build info row helper
    const infoRow = (label, value) => `
        <tr>
            <td style="padding: 4px 8px; font-weight: bold; color: #4a5568; background: #f8fafc; width: 35%; border: 1px solid var(--border-color); font-size: 10pt;">${label}</td>
            <td style="padding: 4px 8px; color: #1a202c; border: 1px solid var(--border-color); font-size: 10pt;">${value || '—'}</td>
        </tr>
    `;

    const printContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>بطاقة معلومات - ${s.last_name} ${s.first_name}</title>
        <style>
            @font-face {
                font-family: 'Tajawal';
                src: url('assets/fonts/Tajawal-Regular.ttf') format('truetype');
                font-weight: 400;
            }
            @font-face {
                font-family: 'Tajawal';
                src: url('assets/fonts/Tajawal-Bold.ttf') format('truetype');
                font-weight: 700;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: 'Tajawal', 'Segoe UI', sans-serif;
                padding: 5mm 8mm;
                direction: rtl;
                background: #fff;
                color: #1a202c;
            }
            @page { size: A4; margin: 5mm; }
            @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .no-print { display: none !important; }
            }

            .header-container {
                text-align: center;
                margin-bottom: 4px;
                padding-bottom: 4px;
            }
            .header-container h3 {
                margin: 1px 0;
                font-size: 11pt;
                font-weight: 700;
            }
            .header-row {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-top: 3px;
                padding: 3px 0;
                border-top: 1.5pt solid #2d3748;
                border-bottom: 1.5pt solid #2d3748;
                min-height: 25px;
                font-size: 10pt;
                font-weight: 700;
            }
            .page-title {
                text-align: center;
                margin: 8px 0;
                font-size: 14pt;
                font-weight: 800;
                color: #2d3748;
                padding: 5px 0;
                border-bottom: 2px double #4a5568;
            }
            .section-title {
                font-size: 10pt;
                font-weight: 700;
                color: #4a5568;
                margin: 8px 0 4px 0;
                padding: 3px 8px;
                background: #f1f5f9;
                border-right: 3px solid #667eea;
                border-radius: 0 4px 4px 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .info-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 3px;
            }
            .info-table td {
                padding: 3px 8px;
                border: 1px solid var(--border-color);
                font-size: 10pt;
                vertical-align: middle;
            }
            .two-col-layout {
                display: flex;
                gap: 10px;
            }
            .two-col-layout > div {
                flex: 1;
            }
            .footer-section {
                margin-top: 12px;
                display: flex;
                justify-content: flex-end;
                font-size: 10pt;
            }
            .footer-section .sig-block {
                text-align: center;
                min-width: 150px;
            }
        </style>
        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
    </head>
    <body>
        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

        <!-- Official Header -->
        <div class="header-container">
            <h3>الجمهورية الجزائرية الديمقراطية الشعبية</h3>
            <h3>وزارة التربية الوطنية</h3>
        </div>
        <div class="header-row">
            <div style="text-align: right; line-height: 1.6;">
                <div style="font-size: 11pt;">مديرية التربية لولاية ${settings.wilaya || '.......'}</div>
                <div style="font-size: 11pt;">المؤسسة: ${settings.institutionName || '.......'}</div>
            </div>
            <div style="text-align: left; align-self: center;">
                <div style="font-size: 11pt;">السنة الدراسية: ${schoolYear}</div>
            </div>
        </div>

        <!-- Title -->
        <div class="page-title">بطاقة معلومات تلميذ</div>

        <!-- Student Photo (if available) -->
        ${window._currentStudentPhotoData ? `
        <div style="text-align: center; margin-bottom: 8px;">
            <img src="${window._currentStudentPhotoData}" style="width: 90px; height: 110px; object-fit: cover; border: 2px solid #4a5568; border-radius: 6px;" />
        </div>
        ` : ''}

        <!-- Two Column Layout -->
        <div class="two-col-layout">
            <!-- Right Column: Personal + Parent -->
            <div>
                <div class="section-title"><i class="fas fa-user" style="margin-left: 6px;"></i> المعلومات الشخصية</div>
                <table class="info-table">
                    ${infoRow('اللقب', s.last_name)}
                    ${infoRow('الاسم', s.first_name)}
                    ${infoRow('تاريخ الميلاد', formatDateDisplay(s.birth_date))}
                    ${infoRow('مكان الميلاد', s.pob)}
                    ${infoRow('الجنس', s.gender === 'M' ? 'ذكر' : 'أنثى')}
                    ${infoRow('رقم التعريف', s.national_id)}
                </table>

                <div class="section-title"><i class="fas fa-users" style="margin-left: 6px;"></i> معلومات الولي</div>
                <table class="info-table">
                    ${infoRow('اسم الأب', s.father_name)}
                    ${infoRow('اسم الأم', s.mother_name)}
                    ${infoRow('مهنة الأب', s.father_job)}
                    ${infoRow('مهنة الأم', s.mother_job)}
                    ${infoRow('هاتف الولي', s.parent_phone)}
                    ${infoRow('البريد الإلكتروني', s.parent_email)}
                    ${infoRow('عدد الإخوة', s.siblings_total)}
                    ${infoRow('منهم إناث', s.siblings_female)}
                    ${infoRow('عدد المتمدرسين', s.school_siblings_total)}
                </table>
            </div>

            <!-- Left Column: Academic + Extra -->
            <div>
                <div class="section-title"><i class="fas fa-school" style="margin-left: 6px;"></i> المعلومات الدراسية</div>
                <table class="info-table">
                    ${infoRow('المستوى', levelDisplay)}
                    ${infoRow('الفوج (القسم)', s.class)}
                    ${streamName ? infoRow('الشعبة', streamName) : ''}
                    ${infoRow('الصفة', statusStr)}
                    ${infoRow('معيد', s.repeat ? 'نعم' : 'لا')}
                    ${infoRow('تاريخ الدخول', formatDateDisplay(s.entry_date))}
                    ${infoRow('السنة الدراسية', s.academic_year || s.year || '')}
                </table>

                <div class="section-title"><i class="fas fa-clipboard-list" style="margin-left: 6px;"></i> معلومات إضافية</div>
                <table class="info-table">
                    ${infoRow('العنوان', s.address)}
                    ${infoRow('ملاحظات', s.observation)}
                    ${infoRow('الحالة الاجتماعية / التربوية', socialLabels)}
                </table>
            </div>
        </div>

        <!-- Footer / Signature -->
        <div class="footer-section">
            <div class="sig-block">
                <div style="margin-bottom: 5px;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                <div style="font-weight: 700; font-size: 12pt;">المدير(ة)</div>
            </div>
        </div>

        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}
    </body>
    </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
}

// --- Student Photo Functions ---

/**
 * Load and display student photo in the info modal
 */
function _loadStudentPhoto(studentId) {
    const photoImg = document.getElementById('infoStudentPhoto');
    const initialsDiv = document.getElementById('infoStudentAvatar');
    const deleteBtn = document.getElementById('btnDeleteStudentPhoto');

    // Reset to initials state
    photoImg.style.display = 'none';
    initialsDiv.style.display = 'flex';
    deleteBtn.style.display = 'none';
    window._currentStudentPhotoData = null;

    if (!studentId || !window.ipcRenderer) return;

    window.ipcRenderer.invoke('db-get-student-photo', studentId).then(function (result) {
        if (result && result.success && result.data) {
            photoImg.src = result.data;
            photoImg.style.display = 'block';
            initialsDiv.style.display = 'none';
            deleteBtn.style.display = 'flex';
            window._currentStudentPhotoData = result.data;
        }
    }).catch(function (err) {
        console.warn('[Photo] Error loading photo:', err);
    });
}

/**
 * Open file picker for student photo
 */
function pickStudentPhoto() {
    const input = document.getElementById('studentPhotoInput');
    if (input) {
        input.value = ''; // Reset to allow re-selecting same file
        input.click();
    }
}

/**
 * Handle file selection and compress the photo
 */
function handleStudentPhotoSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('يرجى اختيار ملف صورة صالح', 'error');
        return;
    }

    // Validate file size (max 10MB raw input)
    if (file.size > 10 * 1024 * 1024) {
        showToast('حجم الصورة كبير جداً (الحد الأقصى 10 ميغابايت)', 'error');
        return;
    }

    const index = document.getElementById('infoStudentIndex').value;
    const s = allStudents[index];
    if (!s || !s.id) {
        showToast('خطأ: لم يتم تحديد التلميذ', 'error');
        return;
    }

    // Show loading state
    const container = document.getElementById('infoStudentPhotoContainer');
    const loadingEl = document.createElement('div');
    loadingEl.className = 'student-photo-loading';
    loadingEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="color: #6f42c1; font-size: 1.2rem;"></i>';
    container.appendChild(loadingEl);

    compressAndSavePhoto(file, s.id).then(function () {
        // Remove loading
        if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
    }).catch(function (err) {
        console.error('[Photo] Error:', err);
        if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
        showToast('حدث خطأ أثناء حفظ الصورة', 'error');
    });
}

/**
 * Compress image using Canvas API and save via IPC
 * Target: 300x400 WebP at 80% quality (~20-40KB)
 */
function compressAndSavePhoto(file, studentId) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                try {
                    // Calculate dimensions (max 300x400, maintaining aspect ratio)
                    var maxWidth = 300;
                    var maxHeight = 400;
                    var width = img.width;
                    var height = img.height;

                    // Scale down if needed
                    if (width > maxWidth || height > maxHeight) {
                        var ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    // Draw to canvas
                    var canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Export as WebP with 80% quality
                    var webpData = canvas.toDataURL('image/webp', 0.80);

                    // Fallback to JPEG if WebP not supported
                    if (!webpData.startsWith('data:image/webp')) {
                        webpData = canvas.toDataURL('image/jpeg', 0.80);
                    }

                    // Save via IPC
                    window.ipcRenderer.invoke('db-save-student-photo', {
                        studentId: studentId,
                        photoData: webpData
                    }).then(function (result) {
                        if (result && result.success) {
                            // Update display
                            var photoImg = document.getElementById('infoStudentPhoto');
                            var initialsDiv = document.getElementById('infoStudentAvatar');
                            var deleteBtn = document.getElementById('btnDeleteStudentPhoto');

                            photoImg.src = webpData;
                            photoImg.style.display = 'block';
                            initialsDiv.style.display = 'none';
                            deleteBtn.style.display = 'flex';
                            window._currentStudentPhotoData = webpData;

                            showToast('تم حفظ الصورة بنجاح (' + (result.sizeKB || '?') + ' كيلوبايت)', 'success');
                            resolve();
                        } else {
                            showToast('فشل حفظ الصورة: ' + ((result && result.error) || 'خطأ غير معروف'), 'error');
                            reject(new Error(result && result.error));
                        }
                    }).catch(reject);

                } catch (canvasErr) {
                    reject(canvasErr);
                }
            };
            img.onerror = function () {
                showToast('تعذر قراءة الصورة. يرجى اختيار صورة أخرى.', 'error');
                reject(new Error('image_load_failed'));
            };
            img.src = e.target.result;
        };
        reader.onerror = function () {
            reject(new Error('file_read_failed'));
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Delete the current student's photo
 */
function deleteStudentPhoto() {
    const index = document.getElementById('infoStudentIndex').value;
    const s = allStudents[index];
    if (!s || !s.id) return;

    // Confirm deletion
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'حذف الصورة',
            text: 'هل تريد حذف صورة هذا التلميذ؟',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'نعم، احذف',
            cancelButtonText: 'إلغاء'
        }).then(function (result) {
            if (result.isConfirmed) {
                _performDeletePhoto(s.id);
            }
        });
    } else {
        if (confirm('هل تريد حذف صورة هذا التلميذ؟')) {
            _performDeletePhoto(s.id);
        }
    }
}

function _performDeletePhoto(studentId) {
    window.ipcRenderer.invoke('db-delete-student-photo', studentId).then(function (result) {
        if (result && result.success) {
            // Reset to initials
            var photoImg = document.getElementById('infoStudentPhoto');
            var initialsDiv = document.getElementById('infoStudentAvatar');
            var deleteBtn = document.getElementById('btnDeleteStudentPhoto');

            photoImg.style.display = 'none';
            photoImg.src = '';
            initialsDiv.style.display = 'flex';
            deleteBtn.style.display = 'none';
            window._currentStudentPhotoData = null;

            showToast('تم حذف الصورة', 'success');
        } else {
            showToast('فشل حذف الصورة', 'error');
        }
    }).catch(function (err) {
        console.error('[Photo] Delete error:', err);
        showToast('حدث خطأ أثناء حذف الصورة', 'error');
    });
}


// --- Camera Capture Functions ---

let cameraStream = null;
let cameraDevices = [];

async function getCameraDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        // Filter out DroidCam to avoid green screen issues
        cameraDevices = devices.filter(device => 
            device.kind === 'videoinput' && 
            !device.label.toLowerCase().includes('droidcam')
        );
        
        const select = document.getElementById('cameraSelect');
        if (select) {
            select.innerHTML = '';
            if (cameraDevices.length === 0) {
                const option = document.createElement('option');
                option.text = 'لا توجد كاميرا متصلة';
                select.appendChild(option);
            } else {
                cameraDevices.forEach((device, index) => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.text = device.label || 'كاميرا ' + (index + 1);
                    select.appendChild(option);
                });
            }
        }
    } catch (err) {
        console.error('Error enumerating devices:', err);
    }
}

async function openCameraModal() {
    const s = allStudents[document.getElementById('infoStudentIndex').value];
    if (!s || !s.id) {
        showToast('خطأ: لم يتم تحديد التلميذ', 'error');
        return;
    }

    // Reset UI
    document.getElementById('cameraVideo').style.display = 'block';
    document.getElementById('cameraCanvas').style.display = 'none';
    document.getElementById('btnCapturePhoto').style.display = 'block';
    document.getElementById('btnRetakePhoto').style.display = 'none';
    document.getElementById('btnSaveCapturedPhoto').style.display = 'none';
    document.getElementById('cameraGuideline').style.display = 'block';

    // Get devices and start camera
    await getCameraDevices();
    
    const select = document.getElementById('cameraSelect');
    if (cameraDevices.length > 0 && select) {
        await startCamera(select.value);
    }

    const modal = new bootstrap.Modal(document.getElementById('cameraModal'));
    modal.show();
}

function closeCameraModal() {
    stopCamera();
    const modalEl = document.getElementById('cameraModal');
    if (modalEl) {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
    }
}

async function startCamera(deviceId) {
    stopCamera();
    try {
        const video = document.getElementById('cameraVideo');
        video.srcObject = null;
        
        const constraints = {
            video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = cameraStream;
        video.onloadedmetadata = () => {
            video.play().catch(e => {
                console.warn('Play error:', e);
                showToast('تعذر تشغيل الفيديو، تأكد من إعدادات المتصفح.', 'error');
            });
        };
    } catch (err) {
        console.error('Error starting camera:', err);
        showToast('خطأ في الكاميرا: ' + err.message, 'error');
    }
}

function changeCamera() {
    const select = document.getElementById('cameraSelect');
    if (select && select.value) {
        startCamera(select.value);
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    
    // Set canvas dimensions to exactly 300x400 for consistency
    canvas.width = 300;
    canvas.height = 400;
    
    const ctx = canvas.getContext('2d');
    
    // Calculate aspect ratio to center crop
    const videoRatio = video.videoWidth / video.videoHeight;
    const canvasRatio = canvas.width / canvas.height;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (videoRatio > canvasRatio) {
        // Video is wider
        drawHeight = video.videoHeight;
        drawWidth = drawHeight * canvasRatio;
        offsetX = (video.videoWidth - drawWidth) / 2;
        offsetY = 0;
    } else {
        // Video is taller
        drawWidth = video.videoWidth;
        drawHeight = drawWidth / canvasRatio;
        offsetX = 0;
        offsetY = (video.videoHeight - drawHeight) / 2;
    }
    
    // Draw cropped image
    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight, 0, 0, canvas.width, canvas.height);
    
    // Update UI
    video.style.display = 'none';
    canvas.style.display = 'block';
    document.getElementById('cameraGuideline').style.display = 'none';
    
    document.getElementById('btnCapturePhoto').style.display = 'none';
    document.getElementById('btnRetakePhoto').style.display = 'block';
    document.getElementById('btnSaveCapturedPhoto').style.display = 'block';
}

function retakePhoto() {
    document.getElementById('cameraVideo').style.display = 'block';
    document.getElementById('cameraCanvas').style.display = 'none';
    document.getElementById('cameraGuideline').style.display = 'block';
    
    document.getElementById('btnCapturePhoto').style.display = 'block';
    document.getElementById('btnRetakePhoto').style.display = 'none';
    document.getElementById('btnSaveCapturedPhoto').style.display = 'none';
}

function saveCapturedPhoto() {
    const canvas = document.getElementById('cameraCanvas');
    const index = document.getElementById('infoStudentIndex').value;
    const s = allStudents[index];
    if (!s || !s.id) return;
    
    const btn = document.getElementById('btnSaveCapturedPhoto');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> جاري الحفظ...';
    btn.disabled = true;
    
    try {
        // Export as WebP with 80% quality
        let webpData = canvas.toDataURL('image/webp', 0.80);
        
        // Fallback to JPEG if WebP not supported
        if (!webpData.startsWith('data:image/webp')) {
            webpData = canvas.toDataURL('image/jpeg', 0.80);
        }
        
        window.ipcRenderer.invoke('db-save-student-photo', {
            studentId: s.id,
            photoData: webpData
        }).then(function (result) {
            if (result && result.success) {
                // Update display
                const photoImg = document.getElementById('infoStudentPhoto');
                const initialsDiv = document.getElementById('infoStudentAvatar');
                const deleteBtn = document.getElementById('btnDeleteStudentPhoto');

                photoImg.src = webpData;
                photoImg.style.display = 'block';
                initialsDiv.style.display = 'none';
                deleteBtn.style.display = 'flex';
                window._currentStudentPhotoData = webpData;

                showToast('تم حفظ الصورة بنجاح (' + (result.sizeKB || '?') + ' كيلوبايت)', 'success');
                closeCameraModal();
            } else {
                showToast('فشل حفظ الصورة: ' + ((result && result.error) || 'خطأ غير معروف'), 'error');
            }
        }).catch(function(err) {
            console.error('IPC error saving photo:', err);
            showToast('حدث خطأ أثناء حفظ الصورة', 'error');
        }).finally(function() {
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
    } catch (err) {
        console.error('Error getting data URL:', err);
        showToast('تعذر استخراج الصورة، يرجى المحاولة مرة أخرى.', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
window.openStrikeModal = openStrikeModal;
window.confirmStrike = confirmStrike;
window.updateStrikeModalType = updateStrikeModalType;
window.openStatusModal = openStatusModal;
window.saveStudentStatus = saveStudentStatus;
window.openPrintSettingsModal = openPrintSettingsModal;
window.filterStudents = filterStudents;
window.exportStudentList = exportStudentList;
window.printScholarshipForms = printScholarshipForms;
window.handlePobImport = handlePobImport;
window.printStudentList = printStudentList;
window.openStudentInfoModal = openStudentInfoModal;
window.printStudentInfoCard = printStudentInfoCard;
window.enableFieldEdit = enableFieldEdit;
window.markFieldChanged = markFieldChanged;
window.saveFieldOnBlur = saveFieldOnBlur;
window.cancelStudentEdit = cancelStudentEdit;
window.saveStudentInfo = saveStudentInfo;
window.toggleColumnSort = toggleColumnSort;
window.clearAllSorting = clearAllSorting;
window.pickStudentPhoto = pickStudentPhoto;
window.handleStudentPhotoSelect = handleStudentPhotoSelect;
window.deleteStudentPhoto = deleteStudentPhoto;
window.openCameraModal = openCameraModal;
window.closeCameraModal = closeCameraModal;
window.changeCamera = changeCamera;
window.capturePhoto = capturePhoto;
window.retakePhoto = retakePhoto;
window.saveCapturedPhoto = saveCapturedPhoto;


// Email Parent feature (SMTP Composer)
window.emailParent = function (index) {
    const s = allStudents[index];
    if (!s) return;
    const parentEmail = s.parent_email;
    if (!parentEmail || parentEmail.trim() === '') {
        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'لم يتم تسجيل بريد إلكتروني لولي هذا التلميذ.',
            confirmButtonText: 'حسنا'
        });
        return;
    }

    document.getElementById('emailStudentIndex').value = index;
    document.getElementById('emailTo').value = parentEmail;
    document.getElementById('emailTemplate').value = 'general';

    applyEmailTemplate(); // Apply default "general" template logic

    const modal = new bootstrap.Modal(document.getElementById('emailComposerModal'));
    modal.show();
};

window.applyEmailTemplate = function () {
    const index = document.getElementById('emailStudentIndex').value;
    const s = allStudents[index];
    if (!s) return;

    const type = document.getElementById('emailTemplate').value;
    const studentName = `${s.last_name || ''} ${s.first_name || ''}`;

    const { subject, body } = generateEmailTemplate(studentName, type);

    document.getElementById('emailSubject').value = subject;
    document.getElementById('emailBody').value = body;
};

// Helper to generate template content based on type and student name
function generateEmailTemplate(studentName, type) {
    const settings = studentListStorage.getJSON('institutionSettings', {}) || {};
    const schoolName = settings.institutionName || 'مؤسسة التربية';

    let subject = "";
    let body = "";

    switch (type) {
        case 'summons':
            subject = `استدعاء ولي التلميذ(ة) ${studentName}`;
            body = `السيد(ة) ولي التلميذ(ة) ${studentName}،\n\nنرجو منكم الحضور لمقر مؤسسة "${schoolName}" في أقرب وقت ممكن لمناقشة أمر هام يخص ابنكم/ابنتكم.\n\nتقبلوا منا فائق الاحترام والتقدير.`;
            break;
        case 'invitation':
            subject = `دعوة لحضور اجتماع بخصوص التلميذ(ة) ${studentName}`;
            body = `السيد(ة) ولي التلميذ(ة) ${studentName}،\n\nتتشرف مؤسسة "${schoolName}" بدعوتكم لحضور اجتماع تنسيقي بمقر المؤسسة يوم ............ على الساعة ............ \n\nحضوركم يهمنا.`;
            break;
        case 'absence':
            subject = `إشعار بخصوص غياب التلميذ(ة) ${studentName}`;
            body = `السيد(ة) ولي التلميذ(ة) ${studentName}،\n\nنحيطكم علماً بأن ابنكم/ابنتكم قد تغيب عن دروسه يوم ............ \nيرجى منكم تبرير هذا الغياب في أقرب وقت ممكن لضمان سيرورته الدراسية.\n\nشكراً لتفهمكم.`;
            break;
        default: // general
            subject = `تواصل من المؤسسة بخصوص التلميذ(ة) ${studentName}`;
            body = `السيد(ة) ولي التلميذ(ة) ${studentName}،\n\nنراسلك من مؤسسة "${schoolName}" بخصوص ابنكم / ابنتكم...\n\nمع التحيات.`;
    }

    return { subject, body };
}

window.sendParentEmail = async function () {
    const to = document.getElementById('emailTo').value;
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;
    const btn = document.getElementById('sendEmailBtn');

    if (!subject.trim() || !body.trim()) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى إدخال موضوع ونص الرسالة.', confirmButtonText: 'حسنا' });
        return;
    }

    // Show loading state
    const originalBtnHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> جاري الإرسال...';
    btn.disabled = true;

    try {
        const result = await window.ipcRenderer.invoke('send-email', { to, subject, body });

        if (result.success) {
            const modalEl = document.getElementById('emailComposerModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            Swal.fire({ icon: 'success', title: 'تم الإرسال', text: 'تم إرسال البريد الإلكتروني بنجاح.', confirmButtonText: 'حسنا' });
        } else {
            Swal.fire({ icon: 'error', title: 'خطأ في الإرسال', text: result.error || 'حدث خطأ غير معروف.', confirmButtonText: 'حسنا' });
        }
    } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر الاتصال بخادم البريد.', confirmButtonText: 'حسنا' });
    } finally {
        // Restore button state
        btn.innerHTML = originalBtnHtml;
        btn.disabled = false;
    }
};

// --- Fit to Page Customization ---
window._fitToPageEnabled = false;

window.openFitToPageModal = function () {
    const modal = new bootstrap.Modal(document.getElementById('fitToPageModal'));
    modal.show();
};

window.toggleFitToPage = function (enable) {
    window._fitToPageEnabled = enable;

    // Update button text/color visually
    const btn = document.getElementById('btnFitToPageStatus');
    if (btn) {
        if (enable) {
            btn.classList.remove('btn-outline-warning');
            btn.classList.add('btn-warning');
            btn.innerHTML = '<i class="fas fa-compress-arrows-alt me-1"></i> احتواء في صفحة (مفعل)';
        } else {
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-outline-warning');
            btn.innerHTML = '<i class="fas fa-compress-arrows-alt me-1"></i> احتواء في صفحة (معطل)';
        }
    }

    // Hide modal
    const modalEl = document.getElementById('fitToPageModal');
    if (modalEl) {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
    }
};

// --- Print Customization Logic ---
const availablePrintColumns = [
    { id: 'number', label: 'الرقم التسلسلي #', default: true },
    { id: 'national_id', label: 'رقم التعريف (إذا كان مفعلاً)', default: true },
    { id: 'last_name', label: 'اللقب', default: true },
    { id: 'first_name', label: 'الاسم', default: true },
    { id: 'birth_date', label: 'تاريخ الميلاد', default: true },
    { id: 'gender', label: 'الجنس', default: true },
    { id: 'repeat', label: 'معيد', default: true },
    { id: 'level', label: 'المستوى', default: true },
    { id: 'class', label: 'القسم (الفوج)', default: true },
    { id: 'stream', label: 'الشعبة (لثانوي فقط)', default: true },
    { id: 'status', label: 'الصفة (إذا كانت مفعلة)', default: true },
    { id: 'observation', label: 'ملاحظات', default: true }
];

window.openPrintColumnsModal = function () {
    const container = document.getElementById('printColumnsContainer');
    if (!container) return;

    // Load preferences from localStorage if available
    let savedPreferences = studentListStorage.getJSON('printColumnsPrefs', {}) || {};

    container.innerHTML = availablePrintColumns.map(col => {
        const isChecked = savedPreferences.hasOwnProperty(col.id) ? savedPreferences[col.id] : col.default;
        return `
        <div class="col-md-6 mb-3">
            <div class="form-check form-switch d-flex align-items-center p-2 border rounded shadow-sm bg-white" style="cursor:pointer;" onclick="const cb=this.querySelector('input');cb.checked=!cb.checked;window.savePrintColumnPref(cb.value, cb.checked);event.stopPropagation();">
                <input class="form-check-input flex-shrink-0 m-0 print-col-checkbox" type="checkbox" role="switch" id="printCol_${col.id}" value="${col.id}" ${isChecked ? 'checked' : ''} onchange="window.savePrintColumnPref(this.value, this.checked)" onclick="event.stopPropagation();" style="width: 2.5em; height: 1.25em;">
                <label class="form-check-label flex-grow-1 text-start ms-3 mb-0" style="font-size: 0.9em; cursor:pointer;" for="printCol_${col.id}">${col.label}</label>
            </div>
        </div>
        `;
    }).join('');

    // Reset "Select All" state if needed
    window._allPrintColumnsSelected = true;

    const modal = new bootstrap.Modal(document.getElementById('printColumnsModal'));
    modal.show();
};

// --- Advanced Sort Modal Functions ---

// Available sort fields configuration
const SORT_FIELDS = [
    { value: 'level', label: 'المستوى', icon: 'fa-layer-group' },
    { value: 'stream', label: 'الشعبة', icon: 'fa-stream' },
    { value: 'class', label: 'القسم', icon: 'fa-chalkboard' },
    { value: 'last_name', label: 'اللقب', icon: 'fa-user' },
    { value: 'first_name', label: 'الاسم', icon: 'fa-id-card' },
    { value: 'gender', label: 'الجنس', icon: 'fa-venus-mars' },
    { value: 'status', label: 'الصفة', icon: 'fa-tag' },
    { value: 'repeat', label: 'معيد', icon: 'fa-redo' }
];

// Open sort modal
function openSortModal() {
    renderSortCriteria();
    const modal = new bootstrap.Modal(document.getElementById('sortModal'));
    modal.show();
}

// Render sort criteria list
function renderSortCriteria() {
    const container = document.getElementById('sortCriteriaList');
    if (!container) return;

    const currentSort = SORT_CONFIG.currentSort.length > 0 ? SORT_CONFIG.currentSort : [];

    if (currentSort.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-3">لا توجد معايير ترتيب. أضف معياراً جديداً.</p>';
        return;
    }

    container.innerHTML = currentSort.map((sort, index) => `
        <div class="d-flex align-items-center gap-2 mb-2 p-2 border rounded bg-light">
            <div class="flex-grow-1">
                <select class="form-select form-select-sm" id="sortField_${index}" onchange="updateSortDirection(${index})">
                    <option value="">-- اختر المعيار --</option>
                    ${SORT_FIELDS.filter(f => educationStage === 'middle' ? f.value !== 'stream' : true)
            .map(f => `<option value="${f.value}" ${f.value === sort.field ? 'selected' : ''}>
                            <i class="fas ${f.icon}"></i> ${f.label}
                        </option>`).join('')}
                </select>
            </div>
            <div style="width: 100px;">
                <select class="form-select form-select-sm" id="sortDir_${index}">
                    <option value="asc" ${sort.direction === 'asc' ? 'selected' : ''}>تصاعدي ⬆️</option>
                    <option value="desc" ${sort.direction === 'desc' ? 'selected' : ''}>تنازلي ⬇️</option>
                </select>
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="removeSortCriterion(${index})" title="حذف">
                <i class="fas fa-trash"></i>
            </button>
            ${index > 0 ? `<button class="btn btn-sm btn-outline-secondary" onclick="moveSortCriterion(${index}, -1)" title="نقل للأعلى">
                <i class="fas fa-arrow-up"></i>
            </button>` : ''}
            ${index < currentSort.length - 1 ? `<button class="btn btn-sm btn-outline-secondary" onclick="moveSortCriterion(${index}, 1)" title="نقل للأسفل">
                <i class="fas fa-arrow-down"></i>
            </button>` : ''}
        </div>
    `).join('');
}

// Add new sort criterion
function addSortCriterion() {
    // Get available fields (not already selected)
    const selectedFields = SORT_CONFIG.currentSort.map(s => s.field);
    const availableFields = SORT_FIELDS.filter(f => !selectedFields.includes(f.value));

    if (availableFields.length === 0) {
        showToast('تم إضافة جميع المعايير المتاحة', 'info');
        return;
    }

    SORT_CONFIG.currentSort.push({
        field: availableFields[0].value,
        direction: SORT_CONFIG.ASC
    });

    renderSortCriteria();
}

// Remove sort criterion
function removeSortCriterion(index) {
    SORT_CONFIG.currentSort.splice(index, 1);
    renderSortCriteria();
}

// Move sort criterion up or down
function moveSortCriterion(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= SORT_CONFIG.currentSort.length) return;

    const temp = SORT_CONFIG.currentSort[index];
    SORT_CONFIG.currentSort[index] = SORT_CONFIG.currentSort[newIndex];
    SORT_CONFIG.currentSort[newIndex] = temp;

    renderSortCriteria();
}

// Update sort direction
function updateSortDirection(index) {
    const fieldSelect = document.getElementById(`sortField_${index}`);
    const dirSelect = document.getElementById(`sortDir_${index}`);

    if (fieldSelect && fieldSelect.value) {
        SORT_CONFIG.currentSort[index] = {
            field: fieldSelect.value,
            direction: dirSelect ? dirSelect.value : SORT_CONFIG.ASC
        };
    }
}

// Apply custom sort
function applyCustomSort() {
    // Read current values from form
    SORT_CONFIG.currentSort = [];
    const selects = document.querySelectorAll('#sortCriteriaList select[id^="sortField_"]');

    selects.forEach((select, index) => {
        const field = select.value;
        const dirSelect = document.getElementById(`sortDir_${index}`);
        const direction = dirSelect ? dirSelect.value : SORT_CONFIG.ASC;

        if (field) {
            SORT_CONFIG.currentSort.push({ field, direction });
        }
    });

    saveSortPreferences();
    filterStudents();

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('sortModal'));
    if (modal) modal.hide();

    showToast('تم تطبيق الترتيب بنجاح', 'success');
}

// Apply default sort
function applyDefaultSort() {
    SORT_CONFIG.currentSort = SORT_CONFIG.defaultPriority
        .filter(field => educationStage === 'secondary' || field !== 'stream')
        .map(field => ({ field, direction: SORT_CONFIG.ASC }));

    saveSortPreferences();
    renderSortCriteria();
    filterStudents();

    showToast('تم تطبيق الترتيب الافتراضي', 'success');
}

// Export sort functions to window
window.openSortModal = openSortModal;
window.addSortCriterion = addSortCriterion;
window.removeSortCriterion = removeSortCriterion;
window.moveSortCriterion = moveSortCriterion;
window.updateSortDirection = updateSortDirection;
window.applyCustomSort = applyCustomSort;
window.applyDefaultSort = applyDefaultSort;

window.selectAllPrintColumns = function () {
    const checkboxes = document.querySelectorAll('.print-col-checkbox');
    window._allPrintColumnsSelected = !window._allPrintColumnsSelected;

    const prefs = {};
    Object.assign(prefs, studentListStorage.getJSON('printColumnsPrefs', {}) || {});

    checkboxes.forEach(cb => {
        cb.checked = window._allPrintColumnsSelected;
        prefs[cb.value] = cb.checked;
    });

    studentListStorage.setJSON('printColumnsPrefs', prefs);
};

window.savePrintColumnPref = function (colId, isChecked) {
    let savedPreferences = studentListStorage.getJSON('printColumnsPrefs', {}) || {};
    savedPreferences[colId] = isChecked;
    studentListStorage.setJSON('printColumnsPrefs', savedPreferences);
};

window.printCustomStudentList = function () {
    // Call printStudentList and indicate it's a custom print
    printStudentList(true);
};
window.printStruckOffList = printStruckOffList;
window.printSummons = printSummons;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // React is initialized in renderTable
});

function showToast(message, type = 'success') {
    const toast = document.getElementById("toast-notification");
    if (!toast) return;

    toast.textContent = message;
    // Reset class
    toast.className = "toast";
    if (type === 'error') toast.classList.add('error');

    toast.classList.add("show");

    setTimeout(function () {
        toast.classList.remove("show");
    }, 3000);
}

// --- React Components for Editable Table ---

// e and reactRoot are defined at the top

function EditableCell({ value, onChange, placeholder }) {
    const [localValue, setLocalValue] = React.useState(value);

    // Sync state if props change (though usually one-way flow is better, this handles external updates)
    React.useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleBlur = () => {
        if (localValue !== value) {
            onChange(localValue);
        }
    };

    return e('input', {
        type: 'text',
        className: 'form-input',
        style: {
            width: '100%',
            border: '1px solid transparent',
            background: 'transparent',
            padding: '4px',
            fontSize: '1em'
        },
        value: localValue || '',
        placeholder: placeholder || '',
        onChange: (e) => setLocalValue(e.target.value),
        onBlur: handleBlur,
        onFocus: (e) => {
            e.target.style.background = '#fff';
            e.target.style.borderColor = 'var(--secondary-color)';
        },
        onMouseOver: (e) => {
            if (document.activeElement !== e.target) {
                e.target.style.background = 'var(--bg-color)';
                e.target.style.borderColor = '#eee';
            }
        },
        onMouseOut: (e) => {
            if (document.activeElement !== e.target) {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'transparent';
            }
        }
    });
}

// Helper to get short level number
function formatLevelShort(level) {
    const helper = getAcademicHelper();
    if (helper && typeof helper.getLevelNumber === 'function') {
        return helper.getLevelNumber(level);
    }
    if (!level) return '';
    const match = String(level).match(/\d+/);
    return match ? match[0] : '';
}

function ScholarshipRow({ student, index, onUpdate }) {
    // Helper to wrap update for a specific field
    const updateField = (field) => (newValue) => {
        onUpdate(index, field, newValue);
    };

    const handleRowClick = (e) => {
        // Find real index
        const realIndex = allStudents.indexOf(student);
        if (realIndex === -1) return;

        // Ignore clicks on inputs or buttons
        if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;

        openStatusModal(realIndex);
    };

    return e('tr', {
        key: student.id || index,
        onClick: handleRowClick,
        style: { cursor: 'pointer' }
    }, [
        e('td', { key: 'idx' }, index + 1),
        e('td', { key: 'nid' }, student.national_id || '-'),
        e('td', { key: 'ln' }, student.last_name || ''),
        e('td', { key: 'fn' }, student.first_name || ''),
        e('td', { key: 'dob' }, formatDateDisplay(student.birth_date)),
        e('td', { key: 'pob' }, e(EditableCell, { value: student.pob, onChange: updateField('pob'), placeholder: '...' })),
        e('td', { key: 'gender' }, student.gender === 'M' ? 'ذكر' : 'أنثى'),
        e('td', { key: 'father' }, e(EditableCell, { value: student.father_name, onChange: updateField('father_name'), placeholder: '...' })),
        e('td', { key: 'mother' }, e(EditableCell, { value: student.mother_name, onChange: updateField('mother_name'), placeholder: '...' })),
        e('td', { key: 'cls' }, (educationStage !== 'secondary' ? `${formatLevelShort(student.level)} ` : '') + (student.class || '')),
        e('td', { key: 'obs' }, e(EditableCell, { value: student.observation, onChange: updateField('observation'), placeholder: '...' })),
        // Actions: Edit button (opens modal) + Print + Confirm
        e('td', { key: 'actions', className: 'no-print actions-cell', style: { whiteSpace: 'nowrap' } }, [
            // Print Button
            e('button', {
                key: 'btn-print',
                className: 'btn-icon me-1',
                title: 'طباعة الاستمارة',
                style: { background: 'var(--secondary-color)', color: 'white', padding: '4px 8px', borderRadius: '4px', border: 'none', marginLeft: '5px' },
                onClick: (ev) => {
                    ev.stopPropagation();
                    printScholarshipForms(student);
                }
            }, '🖨️'),

            // Confirm Button
            e('button', {
                key: 'btn-confirm',
                className: 'btn-icon',
                title: student.scholarship_confirmed ? 'إلغاء التأكيد' : 'تأكيد',
                style: {
                    background: student.scholarship_confirmed ? '#2ecc71' : '#e0e0e0',
                    color: student.scholarship_confirmed ? 'white' : '#333',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                },
                onClick: async (ev) => {
                    ev.stopPropagation();
                    // Toggle status
                    const realIndex = allStudents.indexOf(student);
                    if (realIndex !== -1) {
                        allStudents[realIndex].scholarship_confirmed = !allStudents[realIndex].scholarship_confirmed;
                        await saveData();
                        // Force re-render (parent should handle this due to students prop update or we can trigger a refresh)
                        // Ideally, onUpdate should be used or filterStudents() to refresh the view
                        if (typeof filterStudents === 'function') filterStudents();
                    }
                }
            }, student.scholarship_confirmed ? '✓' : 'تأكيد')
        ])
    ]);
}

function ScholarshipTableBody({ students }) {
    const handleUpdate = async (idx, field, value) => {
        const student = students[idx];
        if (!student) return;

        // update object in memory
        student[field] = value;

        // Save to DB
        await saveData();

        showToast("...تم الحفظ");
    };

    return e(React.Fragment, null,
        students.map((s, i) => e(ScholarshipRow, { student: s, index: i, onUpdate: handleUpdate }))
    );
}

// e and reactRoot are defined at the top

// --- Export to Excel ---
async function exportStudentList() {
    if (filteredStudents.length === 0) {
        showToast('لا توجد بيانات للتصدير', 'error');
        return;
    }

    const settings = await DB.getSettings();

    // Sort: Level -> Class -> Name (Same as Print)
    const studentsToExport = [...filteredStudents]; // Clone to avoid mutating original
    studentsToExport.sort((a, b) => {
        if (a.level !== b.level) return a.level.localeCompare(b.level);
        if (a.class != b.class) return parseInt(a.class) - parseInt(b.class);
        return a.last_name.localeCompare(b.last_name);
    });

    // --- Build Array of Arrays for explicit control ---
    const aoa = [];

    // Title Row
    aoa.push(["قائمة التلاميذ", "", "", "", "", "", "", "", "", "", ""]);

    // Subtitle Row (Year / Institution)
    const schoolYear = settings.schoolYear || '';
    const instName = settings.institutionName || '';
    aoa.push([`السنة الدراسية: ${schoolYear}`, "", "", "", "", `المؤسسة: ${instName}`, "", "", "", "", ""]);

    // Filter Info Row (Level / Class)
    const levelFilter = document.getElementById('levelSelect').value;
    const classFilter = document.getElementById('classSelect').value;
    let filterText = "تصفية حسب: ";
    if (levelFilter) filterText += `[ المستوى: ${displayLevel(levelFilter)} ] `;
    if (classFilter) filterText += `[ القسم: ${classFilter} ]`;
    if (!levelFilter && !classFilter) filterText += "جميع المستويات والأقسام";

    aoa.push([filterText, "", "", "", "", "", "", "", "", "", ""]);

    // Statistics Row
    const total = filteredStudents.length;
    const males = filteredStudents.filter(s => s.gender === 'M').length;
    const females = total - males;
    aoa.push([`إحصائيات التعداد: العدد الإجمالي ${total}  |  الذكور ${males}  |  الإناث ${females}`, "", "", "", "", "", "", "", "", "", ""]);

    // Empty spacing row
    aoa.push(["", "", "", "", "", "", "", "", "", ""]);

    // Table Headers
    const headers = [
        'الرقم',
        'الرقم الوطني',
        'لقب و اسم التلميذ',
        'تاريخ الميلاد',
        'مكان الميلاد',
        'الجنس',
        'معيد',
        'المستوى',
        'القسم',
        'الصفة',
        'ملاحظات'
    ];
    aoa.push(headers);

    // Data Rows
    studentsToExport.forEach((s, idx) => {
        // Custom Level and Class Formatting using shared display mapping
        let levelDisplay = displayLevel(s.level);
        if (settings.educationStage === 'secondary') {
            let streamAbbr = s.stream || '';
            if (typeof SubjectManager !== 'undefined' && SubjectManager.getStreamAbbreviation) {
                streamAbbr = SubjectManager.getStreamAbbreviation(s.stream) || s.stream;
            }
            levelDisplay = `${levelDisplay} ${streamAbbr}`.trim();
        }

        const classDisplay = s.class || '';

        let repeatStr = s.repeat ? "نعم" : "لا";

        // Map 'status' to Arabic
        let statusStr = s.status;
        if (statusStr === 'half_board' || statusStr === 'نصف داخلي') statusStr = 'نصف داخلي';
        else if (statusStr === 'boarding' || statusStr === 'داخلي') statusStr = 'داخلي';
        else statusStr = 'خارجي';

        aoa.push([
            idx + 1,
            s.national_id || '',
            `${s.last_name || ''} ${s.first_name || ''}`.trim(),
            formatDateDisplay(s.birth_date),
            s.pob || '',
            s.gender === 'M' ? 'ذكر' : 'أنثى',
            repeatStr,
            levelDisplay,
            classDisplay,
            statusStr,
            s.observation || ''
        ]);
    });

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Auto-width columns logic
    const wscols = [
        { wch: 6 },  // Number
        { wch: 18 }, // NID
        { wch: 30 }, // Name
        { wch: 12 }, // DOB
        { wch: 15 }, // POB
        { wch: 8 },  // Gender
        { wch: 6 },  // Repeat
        { wch: 12 }, // Level
        { wch: 8 },  // Class
        { wch: 10 }, // Status
        { wch: 20 }  // Notes
    ];
    ws['!cols'] = wscols;

    // Merges for Header Titles
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push(
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // Title
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Academic Year
        { s: { r: 1, c: 6 }, e: { r: 1, c: 10 } }, // Institution
        { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } }, // Level/Class Filters
        { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } }  // Statistics Row
    );

    // Apply Styling (Requires xlsx-style or pro version, but standard API pattern)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cellAddr]) continue;

            // Base style
            let font = { name: "Arial", sz: 11, bold: false };
            let alignment = { vertical: "center", horizontal: "center", wrapText: true };
            let border = {};
            let fill = undefined;

            if (R === 0) {
                // Main Title
                font.sz = 14;
                font.bold = true;
            } else if (R >= 1 && R <= 3) {
                // Subtitles & Stats
                font.sz = 12;
                font.bold = true;
                if (C < 5 && R === 1) alignment.horizontal = "right"; // Right align year
                if (C >= 5 && R === 1) alignment.horizontal = "center"; // Center align inst
                if (R === 2 || R === 3) alignment.horizontal = "right";
            } else if (R === 5) {
                // Table Headers
                font.bold = true;
                fill = { patternType: "solid", fgColor: { rgb: "E2EFDA" } }; // Light green background
                border = {
                    top: { style: "thin", color: { auto: 1 } },
                    bottom: { style: "thin", color: { auto: 1 } },
                    left: { style: "thin", color: { auto: 1 } },
                    right: { style: "thin", color: { auto: 1 } }
                };
            } else if (R > 5) {
                // Table Data
                border = {
                    top: { style: "thin", color: { auto: 1 } },
                    bottom: { style: "thin", color: { auto: 1 } },
                    left: { style: "thin", color: { auto: 1 } },
                    right: { style: "thin", color: { auto: 1 } }
                };
                if (C === 2) {
                    alignment.horizontal = "right"; // Names right-aligned
                } else {
                    alignment.horizontal = "center"; // Others centered
                }
            }

            ws[cellAddr].s = { font, alignment, border, fill };
        }
    }

    // Set RTL direction
    if (!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ rightToLeft: true });

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Set Workbook RTL
    wb.Workbook = { Views: [{ RTL: true }] };

    XLSX.utils.book_append_sheet(wb, ws, "قائمة التلاميذ");

    // Generate filename with date
    const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const fileName = `قائمة_التلاميذ_${dateStr}.xlsx`;

    // Write file using IPC
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    if (window.ipcRenderer) {
        window.ipcRenderer.invoke('save-excel', { buffer: wbout, fileName: fileName }).then(result => {
            if (result.success) {
                showToast(`تم تصدير القائمة بنجاح: ${result.filePath}`, 'success');
            } else if (result.error) {
                showToast(`خطأ في التصدير: ${result.error}`, 'error');
            }
        }).catch(err => {
            console.error(err);
            showToast('حدث خطأ أثناء التصدير', 'error');
        });
    } else {
        XLSX.writeFile(wb, fileName);
        showToast('تم تصدير القائمة بنجاح', 'success');
    }
}

// --- Print Scholarship Forms ---
let tempStudentToPrint = null; // Store student for modal callback

function openScholarshipPrintModal(student) {
    tempStudentToPrint = student;
    const modal = new bootstrap.Modal(document.getElementById('scholarshipPrintModal'));

    // Set default date to today
    document.getElementById('scholarshipDateInput').valueAsDate = new Date();

    // Setup confirm button
    const confirmBtn = document.getElementById('confirmScholarshipPrintBtn');
    confirmBtn.onclick = () => {
        const dateVal = document.getElementById('scholarshipDateInput').value; // YYYY-MM-DD
        printScholarshipForms(tempStudentToPrint, dateVal);
        modal.hide();
    };

    modal.show();
}

async function printScholarshipForms(singleStudent = null, dateString = null) {
    if (blockTrialPrint()) return;
    const studentsToPrint = singleStudent ? [singleStudent] : filteredStudents;

    if (studentsToPrint.length === 0) {
        showToast('لا توجد بيانات للطباعة', 'error');
        return;
    }

    // Format Date: YYYY-MM-DD -> DD/MM/YYYY
    let formattedDate = '';
    if (dateString) {
        const parts = dateString.split('-');
        if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    } else {
        formattedDate = new Date().toLocaleDateString('fr-FR');
    }

    const settings = await DB.getSettings();
    const city = settings.municipality || '.......';
    const wilaya = settings.wilaya || '.......';
    const district = settings.district || '';

    if (!district || district.trim() === '') {
        await Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'اسم الدائرة غير محدد في الإعدادات. يرجى إضافته لضمان طباعة صحيحة.',
            confirmButtonText: 'حسنا'
        });
        // Optionally return here if we want to block printing, but user said "warn", so we might just warn or let them proceed with default dots.
        // Let's assume just a warning is enough, but maybe better to block or default to dots.
        // The user said "alert user", usually implies a blocking or semi-blocking notice.
        // Let's use the '.......' default but show the alert.
    }
    const districtDisplay = district || '.......';
    const displayYear = document.getElementById('yearSelect')?.value || settings.schoolYear || '';

    const formsHtml = studentsToPrint.map((s, idx) => {
        // Class Display Logic
        let classDisplay = '';
        const levelNum = (s.level || '').replace(/[^0-9]/g, '') || '1';
        if (settings.educationStage === 'secondary') {
            // Safety check for SubjectManager
            let streamAbbr = s.stream || '';
            if (typeof SubjectManager !== 'undefined' && SubjectManager.getStreamAbbreviation) {
                streamAbbr = SubjectManager.getStreamAbbreviation(s.stream) || s.stream;
            }
            classDisplay = `${levelNum} ${streamAbbr} ${s.class}`;
        } else {
            const normalized = normalizeLevel(s.level);
            const lNum = normalized.replace(/[^0-9]/g, '') || levelNum;
            classDisplay = `${lNum} متوسط ${s.class}`;
        }

        const pageBreakClass = idx < studentsToPrint.length - 1 ? 'page-break' : '';

        // Helper for absolute positioning
        const pos = (top, left, width = 'auto') => `position: absolute; top: ${top}mm; left: ${left}mm; width: ${width}; text-align: center; z-index: 10; font-weight: bold;`;

        return `
        <div class="form-page ${pageBreakClass}">
            <!-- Header Data -->
            <!-- Wilaya: Line 1 (Top) -->
            <!-- Raised 3mm (19 -> 16) and moved 5mm Left (155 -> 150) -->
            <div style="${pos(16, 150, '50mm')} font-size: 11pt;">${wilaya}</div>

            <!-- District: Line 2 (Middle) -->
            <!-- Raised 3mm (24.5 -> 21.5) and moved 3mm Left (152 -> 149) -->
            <div style="${pos(21.5, 149, '50mm')} font-size: 11pt;">${districtDisplay}</div>

            <!-- City: Line 3 (Bottom) -->
            <!-- Lowered 2mm (25 -> 27) -->
            <div style="${pos(27, 152, '50mm')} font-size: 11pt;">${city}</div>

            <!-- Student Info Section -->

            <!-- Institution Name: Line 1 -->
            <!-- Raised 2mm (63 -> 61) -->
            <div style="${pos(61, 0, '120mm')} font-size: 11pt;">${settings.institutionName || ''}</div>

            <!-- Line 2: School Year (Left) & Level (Right) -->
            <!-- School Year - Raised 2mm (70 -> 68) and fixed content -->
            <div style="${pos(68, 140, '35mm')} font-size: 11pt;">${displayYear}</div>

            <!-- Level - Raised 2mm (70 -> 68) -->
            <div style="${pos(68, 80, '50mm')} font-size: 11pt;">${classDisplay}</div>

            <!-- Line 3: Student Name - Raised 2mm (77 -> 75) -->
            <div style="${pos(75, 80, '100mm')} font-size: 13pt;">${s.last_name || ''} ${s.first_name || ''}</div>

            <!-- Line 4: Parents - Raised 2mm (85 -> 83) -->
            <!-- Father (Right Blank) -->
            <div style="${pos(83, 110, '60mm')} font-size: 11pt; text-align: right;">${s.father_name || ''}</div>
            <!-- Mother (Left Blank) -->
            <div style="${pos(83, 40, '60mm')} font-size: 11pt; text-align: right;">${s.mother_name || ''}</div>

            <!-- Line 5: DOB & POB - Combined, Kept at 91mm vertical -->
            <div style="${pos(91, 10, '160mm')} font-size: 11pt; direction: rtl; text-align: right; padding-right: 10px;">
                <span style="display:inline-block; min-width: 40mm; text-align: center;">${formatDateDisplay(s.birth_date)}</span>
                <span style="margin: 0 5px;"> بـ </span>
                <span style="display:inline-block; min-width: 50mm; text-align: center;">${s.pob || ''}</span>
            </div>

            <!-- Line 6: ID - Shifted Right to 70mm (from 60mm) -->
            <div style="${pos(98, 70, '100mm')} font-size: 14pt; letter-spacing: 4px; font-family: monospace; white-space: nowrap;">${s.national_id || ''}</div>

            <!-- Date and Signature -->


        </div>
        `;
    }).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <title>طباعة الاستمارات</title>
        <base href="${window.location.href}">
        <style>
            @page { size: A4; margin: 0; }
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .form-page {
                width: 210mm;
                height: 297mm;
                position: relative;
                background-image: url('assets/Formulaire_page-0001.jpg');
                background-size: 100% 100%;
                background-repeat: no-repeat;
                /* No padding, using absolute positioning */
            }
            .page-break { page-break-after: always; }
        </style>
    \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>
    <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
        ${formsHtml}
    \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>
    </html>
    `);
    printWindow.document.close();
}

// --- Certificate Printing Logic ---

// Open the modal to ask for French name
function openCertificateModal(index) {
    document.getElementById('certStudentIndex').value = index;

    // Attempt to pre-fill if field exists
    const student = allStudents[index];
    const frenchName = student.french_name || student.name_fr || '';
    document.getElementById('certFrenchName').value = frenchName;

    const modal = new bootstrap.Modal(document.getElementById('certificateModal'));
    modal.show();
}

// Confirm and generate print
async function confirmPrintCertificate() {
    const index = document.getElementById('certStudentIndex').value;
    const frenchName = document.getElementById('certFrenchName').value;
    const student = allStudents[index];

    // Check if place of birth is missing
    if (!student.pob || student.pob.trim() === '') {
        const msg = "مكان الميلاد مفقود لهذا التلميذ. يجب استيراد مكان الميلاد أولاً من ملف الرقمنة ليظهر في الشهادة.\n\nهل تريد فتح نافذة الإعدادات الآن للقيام بالاستيراد؟";
        if (confirm(msg)) {
            // Close certificate modal
            const certModalEl = document.getElementById('certificateModal');
            bootstrap.Modal.getInstance(certModalEl).hide();

            // Open settings modal after a short delay
            setTimeout(() => {
                openPrintSettingsModal();
            }, 400);
            return;
        }
    }

    // Close modal and proceed with printing
    const modalEl = document.getElementById('certificateModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    await printCertificate(index, frenchName);
}

// Generate HTML and Print
async function printCertificate(index, frenchName) {
    if (blockTrialPrint()) return;
    const student = allStudents[index];
    const settings = await DB.getSettings() || {};
    const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
    const currentYear = new Date().getFullYear();

    const activeYearSelect = document.getElementById('yearSelect');
    const selectedYearFromDropdown = activeYearSelect ? activeYearSelect.value : null;
    const globalSysYear = typeof DB !== 'undefined' && typeof DB.getCurrentAcademicYear === 'function' ? DB.getCurrentAcademicYear() : currentYear + '/' + (currentYear - 1);
    const globalCurrentYear = settings.schoolYear || settings.currentAcademicYear || globalSysYear;

    const schoolYear = selectedYearFromDropdown || student.academic_year || globalCurrentYear || '2025/2026';
    const isPreviousYear = schoolYear && schoolYear !== globalCurrentYear;

    let departureDate = '';
    let followsText = '';

    if (isPreviousYear) {
        const yearParts = schoolYear.split('/').map(y => parseInt(y.trim(), 10)).filter(y => !isNaN(y));
        const endYear = yearParts.length > 0 ? Math.max(...yearParts) : currentYear;
        departureDate = `30-06-${endYear}`;
        followsText = student.gender === 'F' ? 'تابعـــت دراسـتهـــا' : 'تابـــع دراسـتـــه';
    } else {
        followsText = student.gender === 'F' ? 'تتابـــع دراسـتهـــا' : 'يتـــابـع دراسـتـــه';
    }

    // Institution Info
    const institutionName = settings.institutionName || 'متوسطة بوشيرب محمد';
    const wilaya = settings.wilaya || 'عين الدفلى';
    const municipality = settings.municipality || 'خميس مليانة';

    const fullname = `${student.last_name} ${student.first_name}`;
    const dob = formatDateDisplay(student.birth_date);
    const pob = student.pob || '';

    // Build absolute file:// URL for ManaraDocs font
    const currentDir = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    const fontUrl = currentDir + '/assets/fonts/ManaraDocs%20Amatti%20Font.ttf';

    // --- Generate Barcode as base64 image in parent window ---
    let barcodeDataUrl = '';
    try {
        const barcodeCanvas = document.createElement('canvas');
        JsBarcode(barcodeCanvas, student.national_id || '0000000000', {
            format: "CODE128", lineColor: "#000", width: 1.5, height: 40, displayValue: false, margin: 0
        });
        barcodeDataUrl = barcodeCanvas.toDataURL('image/png');
    } catch (e) { console.error('Barcode error:', e); }

    // --- Generate QR Code as base64 image using qrcode-generator ---
    let qrDataUrl = '';
    try {
        const pobPart = pob ? `  بـ: ${pob}` : '';
        // Map level number to Arabic word for QR (matching Ministry format)
        const levelNumMap = { '1': 'أولى', '2': 'ثانية', '3': 'ثالثة', '4': 'رابعة' };
        const levelNum = (student.level || '').replace(/[^0-9]/g, '') || '1';
        const levelWord = levelNumMap[levelNum] || student.level || '';
        // Format DOB with dashes instead of slashes
        const qrDob = dob.replace(/\//g, '-');
        // Format today's date with dots instead of slashes
        const qrToday = today.replace(/\//g, '.');
        const qrText = `${student.national_id || ''}  ${student.first_name || ''}  ${student.last_name || ''}  تاريخ ومكان الميلاد: ${qrDob}${pobPart}  ${institutionName}  الفوج التربوي: ${levelWord} متوسط ${student.class || ''}  صدرت بـ: ${municipality} ${qrToday}`;
        // Encode as UTF-8 bytes so Arabic text is correctly readable when scanned
        const utf8Bytes = new TextEncoder().encode(qrText);
        const byteStr = Array.from(utf8Bytes).map(b => String.fromCharCode(b)).join('');
        const qr = qrcode(0, 'L');
        qr.addData(byteStr, 'Byte');
        qr.make();
        // Create image from QR
        const moduleCount = qr.getModuleCount();
        const cellSize = 4;
        const size = moduleCount * cellSize;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'var(--card-bg)';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#000000';
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
                }
            }
        }
        qrDataUrl = canvas.toDataURL('image/png');
        console.log('QR generated successfully, text length:', qrText.length);
    } catch (e) { console.error('QR error:', e); }

    // Detect school type (secondary vs middle)
    const isSecondary = (student.level || '').includes('ثانوي');
    const schoolType = isSecondary ? 'الثانوية' : 'المتوسطة';

    // Build class/section display
    const levelDisplay = displayLevel(student.level);
    const streamName = student.stream ? SubjectManager.getStreamName(student.stream) : '';
    let classDisplay;
    if (isSecondary) {
        // Secondary: level + stream + class
        classDisplay = `${levelDisplay} ${streamName} ${student.class || ''}`.trim();
    } else {
        // Middle: level + class
        classDisplay = `${levelDisplay} ${student.class || ''} ${streamName ? '- ' + streamName : ''}`.trim();
    }

    // HTML Content
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>شهادة مدرسية - ${fullname}</title>
        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        <style>
            @font-face {
                font-family: 'ManaraDocs';
                src: url('${fontUrl}') format('truetype');
                font-weight: normal;
                font-style: normal;
            }
            @font-face {
                font-family: 'KhalaadArabeh';
                src: url('${currentDir}/assets/fonts/khalaad-al-arabeh.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
            }
            * { box-sizing: border-box; font-weight: normal !important; }
            body {
                font-family: 'ManaraDocs', 'Tajawal', sans-serif !important;
                margin: 0;
                padding: 10mm;
                direction: rtl;
                background: white;
                font-size: 16px;
                font-weight: normal;
            }
            .certificate-container {
                width: 100%;
                max-width: 190mm;
                margin: 0 auto;
                position: relative;
            }
            /* --- Header --- */
            .header-top {
                text-align: center;
                margin-bottom: 15px;
            }
            .republic {
                font-size: 20px;
                margin-bottom: 3px;
            }
            .ministry {
                font-size: 18px;
                margin-bottom: 15px;
            }
            /* --- Top Info: Barcode LEFT, Institution RIGHT --- */
            .top-info {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 10px;
            }
            /* LEFT side (barcode + school year) - appears on the left in RTL */
            .left-side {
                order: 2; /* In RTL flex, order:2 pushes to the left */
                text-align: center;
                min-width: 200px;
            }
            .barcode-label {
                font-size: 11px;
                margin-bottom: 2px;
            }
            .barcode-number {
                font-size: 11px;
                margin-top: 2px;
            }
            .school-year-box {
                margin-top: 10px;
                font-size: 16px;
            }
            /* RIGHT side (institution info) - appears on the right in RTL */
            .right-side {
                order: 1;
                text-align: right;
                font-size: 16px;
                line-height: 1.8;
            }
            /* --- Title --- */
            .cert-title-box {
                background: linear-gradient(to bottom, #B8B9BB, #F6F6F6);
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                width: 280px;
                margin: 15px auto;
                padding: 12px 30px;
                text-align: center;
                font-size: 32px;
                font-weight: bold;
                border: none;
                color: #000;
            }
            /* --- Body --- */
            .content-body {
                margin-top: 20px;
                font-size: 18px;
                line-height: 2.2;
                padding: 0 10px;
            }
            .director-text {
                text-align: center;
                margin-bottom: 15px;
                font-size: 18px;
                padding-left: 35mm;
            }
            .info-row {
                display: flex;
                gap: 8px;
                align-items: baseline;
                margin-bottom: 8px;
            }
            .label {
                white-space: nowrap;
            }
            .value {
                padding: 0 5px;
            }
            .value-special {
                font-family: 'KhalaadArabeh', 'ManaraDocs', sans-serif !important;
            }
            .follows-text {
                text-align: center;
                margin: 25px 0;
                font-size: 22px;
            }
            /* --- Footer --- */
            .footer-section {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-top: 40px;
                padding: 0 10px;
            }
            .footer-date {
                text-align: right;
                font-size: 14px;
                line-height: 2;
            }
            .footer-signature {
                text-align: center;
                font-size: 16px;
            }
            .footer-right-block {
                text-align: right;
                font-size: 16px;
            }
            .footer-left-block {
                text-align: left;
                font-size: 14px;
                line-height: 2;
            }
            .french-name-section {
                font-family: 'Arial', sans-serif;
                font-size: 14px;
                margin-top: 15mm;
                text-align: center;
            }
            .qr-section {
                margin-top: 15px;
                display: flex;
                justify-content: flex-start;
            }
            @media print {
                body { margin: 0; padding: 10mm; }
                @page { size: A4; margin: 0; }
            }
        </style>
        </head>
    <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false, hideBrowserBtn: true }) : ''}
        <div class="certificate-container">
            <!-- Header: Republic & Ministry -->
            <div class="header-top">
                <div class="republic">الجمهورية الجزائرية الديمقراطية الشعبية</div>
                <div class="ministry">وزارة التربية الوطنية</div>
            </div>

            <!-- Top Info Row -->
            <div class="top-info">
                <!-- RIGHT side: Institution Info (order:1 in RTL = right) -->
                <div class="right-side">
                    <div>مديرية التربية لولاية ${wilaya}</div>
                    <div>${institutionName} -${municipality}-</div>
                    <div>الرقم : ................ / ${currentYear}</div>
                </div>
                <!-- LEFT side: Barcode + School Year (order:2 in RTL = left) -->
                <div class="left-side">
                    <div class="barcode-label">رقم التعريف المدرسي</div>
                    ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" style="width:30mm;height:10mm;" />` : ''}
                    <div class="barcode-number" style="font-family: Arial, sans-serif; width: 30mm; text-align: center; margin: 0 auto;">${student.national_id || ''}</div>
                    <div class="school-year-box">السنة الدراسية: ${settings.schoolYear || '2025/2026'}</div>
                </div>
            </div>

            <!-- Certificate Title -->
            <div class="cert-title-box">
                شهـــــادة مـدرسيـــة
            </div>

            <!-- Certificate Body -->
            <div class="content-body">
                <div class="director-text" style="padding-left: 35mm;">
                    يشهـــــــــــد السيــــــد(ة) مديــــــــــــر(ة) ${schoolType} أن التلميذ:
                </div>

                <div class="info-row">
                    <span class="label">اللقب :</span>
                    <span class="value value-special">${student.last_name || ''}</span>
                    <span class="label" style="margin-right: 10mm;">الاســـم :</span>
                    <span class="value value-special" style="flex-grow: 1;">${student.first_name || ''}</span>
                </div>

                <div class="info-row">
                    <span class="label">تاريخ ومكان الإزدياد :</span>
                    <span class="value" style="font-family: Arial, sans-serif;">${dob.replace(/\//g, '-')}</span>
                    <span class="label" style="margin-right: 10mm;">بـ :</span>
                    <span class="value value-special" style="flex-grow: 1;">${pob}</span>
                </div>

                <div class="follows-text">${followsText}</div>

                <div class="info-row">
                    <span class="label">السنــة الدراسيـــة :</span>
                    <span class="value" style="${isPreviousYear ? '' : 'flex-grow: 1;'}">${window.formatAcademicYear(schoolYear)}</span>
                    ${isPreviousYear ? `
                    <span class="label" style="margin-right: 15px; margin-left: 15px; font-weight: bold;">—</span>
                    <span class="label">تاريــخ الخــروج :</span>
                    <span class="value" style="font-family: Arial, sans-serif; flex-grow: 1; margin-right: 10px;">${departureDate}</span>
                    ` : ''}
                </div>

                <div class="info-row">
                    <span class="label">القســــــــــــم :</span>
                    <span class="value" style="flex-grow: 1;">${classDisplay}</span>
                </div>

                <div class="info-row">
                    <span class="label">رقـــم التسجيـــل :</span>
                    <span class="value">${student.reg_number || ''}</span>
                    <span class="label" style="margin-right: 20mm;">إلـــى يومنـــا هـــذا</span>
                </div>
            </div>

            <!-- Footer -->
            <!-- Date line -->
            <div style="text-align: left; font-size: 14px; margin-top: 40px; padding: 0 10px;">
                حرر بـ${municipality} في : ${today}
            </div>

            <!-- Director + French Name Title row -->
            <div class="footer-section" style="margin-top: 20px;">
                <!-- RIGHT block (RTL): French Name Title -->
                <div class="footer-right-block">
                    <div>الكتابـــة السابقـة للإسم واللقب</div>
                    <div class="french-name-section">
                        ${frenchName || ''}
                    </div>
                </div>

                <!-- CENTER-LEFT: Director title -->
                <div class="footer-left-block" style="text-align: center; padding-left: 20mm;">
                    <div>مدير(ة) ${schoolType}</div>
                </div>
            </div>

            <!-- QR Code - bottom right -->
            <div style="margin-top: 20px; text-align: right;">
                ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:100px;height:100px;" />` : '<div id="qr-fallback"></div>'}
            </div>
        </div>

        <script>
            setTimeout(() => { // window.print(); /* Replaced by global Toolbar */ }, 1000);
        <\/script>
    \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>
    </html>
    `;

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

// --- Bulk Email Feature ---

// Minimize/Restore state
window._bulkEmailMinimized = false;
window._bulkEmailSending = false;

window.minimizeBulkEmail = function () {
    window._bulkEmailMinimized = true;

    // Hide modal without triggering close events that cancel sending
    const modalEl = document.getElementById('bulkEmailModal');
    const modalDialog = modalEl.querySelector('.modal-dialog');
    const backdrop = document.querySelector('.modal-backdrop');

    // Slide the modal out of view
    if (modalDialog) modalDialog.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
    modalEl.style.pointerEvents = 'none';

    // Show floating widget
    const widget = document.getElementById('bulkEmailFloatingWidget');
    widget.style.display = 'block';

    // Sync current progress to widget
    const progressBar = document.getElementById('bulkEmailProgressBar');
    const progressLabel = document.getElementById('bulkEmailProgressLabel');

    document.getElementById('widgetProgressBarInner').style.width = progressBar.style.width;
    document.getElementById('widgetStatusText').textContent = progressLabel.textContent;
};

window.restoreBulkEmail = function () {
    window._bulkEmailMinimized = false;

    // Show modal again
    const modalEl = document.getElementById('bulkEmailModal');
    const modalDialog = modalEl.querySelector('.modal-dialog');
    const backdrop = document.querySelector('.modal-backdrop');

    if (modalDialog) modalDialog.style.display = '';
    if (backdrop) backdrop.style.display = '';
    modalEl.style.pointerEvents = '';

    // Hide floating widget
    document.getElementById('bulkEmailFloatingWidget').style.display = 'none';
};

// Helper to update widget progress during sending
window._updateBulkEmailWidget = function (percent, statusText) {
    if (window._bulkEmailMinimized) {
        document.getElementById('widgetProgressBarInner').style.width = percent + '%';
        document.getElementById('widgetStatusText').textContent = statusText;
    }
};

window.openBulkEmailModal = function () {
    updateBulkRecipientCount();
    document.getElementById('bulkEmailTemplate').value = 'general';
    applyBulkEmailTemplate();

    // Hide progress section
    document.getElementById('bulkEmailProgressSection').style.display = 'none';
    document.getElementById('bulkEmailResultSummary').style.display = 'none';
    document.getElementById('btnSendBulkEmail').disabled = false;
    document.getElementById('btnCancelBulkEmail').disabled = false;
    document.getElementById('btnCancelBulkEmail').textContent = 'إلغاء';
    document.getElementById('btnMinimizeBulkEmail').style.display = 'none';

    // Reset minimize state
    window._bulkEmailMinimized = false;
    window._bulkEmailSending = false;
    document.getElementById('bulkEmailFloatingWidget').style.display = 'none';

    const modal = new bootstrap.Modal(document.getElementById('bulkEmailModal'));
    modal.show();
};

window.updateBulkRecipientCount = function () {
    const target = document.getElementById('bulkEmailTarget').value;
    const selectedLevel = document.getElementById('levelSelect').value;
    const selectedClass = document.getElementById('classSelect').value;

    let allTarget = [];
    let recipients = [];

    if (target === 'all') {
        allTarget = allStudents;
    } else if (target === 'level') {
        allTarget = !selectedLevel ? [] : allStudents.filter(s => normalizeLevel(s.level) === selectedLevel);
    } else if (target === 'class') {
        allTarget = !selectedClass ? [] : allStudents.filter(s => s.class === selectedClass);
    } else { // filtered
        allTarget = filteredStudents;
    }

    recipients = allTarget.filter(s => s.parent_email && s.parent_email.trim() !== '');
    const excluded = allTarget.length - recipients.length;

    document.getElementById('bulkRecipientCount').textContent = recipients.length;

    // Show excluded count
    const infoEl = document.getElementById('bulkRecipientInfo');
    if (excluded > 0) {
        infoEl.innerHTML = `<i class="fas fa-users text-primary me-1" id="bulkRecipientIcon"></i> سيتم الإرسال لـ <span class="fw-bold text-primary">${recipients.length}</span> ولي  <span class="text-danger ms-2"><i class="fas fa-exclamation-circle me-1"></i>${excluded} تلميذ بدون بريد إلكتروني (لن يتم مراسلتهم)</span>`;
    } else {
        infoEl.innerHTML = `<i class="fas fa-users text-primary me-1" id="bulkRecipientIcon"></i> سيتم الإرسال لـ <span id="bulkRecipientCount" class="fw-bold text-primary">${recipients.length}</span> ولي  <span class="text-success ms-2"><i class="fas fa-check-circle me-1"></i>كل التلاميذ لديهم بريد إلكتروني</span>`;
    }

    // UI Feedback for invalid selections
    const icon = document.getElementById('bulkRecipientIcon');
    if (icon) {
        if (recipients.length === 0) {
            icon.className = "fas fa-exclamation-triangle text-danger me-1";
        } else {
            icon.className = "fas fa-users text-primary me-1";
        }
    }
};

window.applyBulkEmailTemplate = function () {
    const type = document.getElementById('bulkEmailTemplate').value;

    // Use [الاسم] as placeholder for bulk templates
    const { subject, body } = generateEmailTemplate("[الاسم]", type);

    document.getElementById('bulkEmailSubject').value = subject;
    document.getElementById('bulkEmailBody').value = body;
};

window.sendBulkEmails = async function () {
    const target = document.getElementById('bulkEmailTarget').value;
    const selectedLevel = document.getElementById('levelSelect').value;
    const selectedClass = document.getElementById('classSelect').value;

    let recipients = [];
    if (target === 'all') {
        recipients = allStudents.filter(s => s.parent_email && s.parent_email.trim() !== '');
    } else if (target === 'level') {
        if (!selectedLevel) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولاً من الفلاتر.', confirmButtonText: 'حسنا' });
            return;
        }
        recipients = allStudents.filter(s => normalizeLevel(s.level) === selectedLevel && s.parent_email && s.parent_email.trim() !== '');
    } else if (target === 'class') {
        if (!selectedClass) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار القسم أولاً من الفلاتر.', confirmButtonText: 'حسنا' });
            return;
        }
        recipients = allStudents.filter(s => s.class === selectedClass && s.parent_email && s.parent_email.trim() !== '');
    } else {
        recipients = filteredStudents.filter(s => s.parent_email && s.parent_email.trim() !== '');
    }

    if (recipients.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا يوجد تلاميذ لديهم بريد إلكتروني مسجل في التحديد الحالي.', confirmButtonText: 'حسنا' });
        return;
    }

    const baseSubject = document.getElementById('bulkEmailSubject').value;
    const baseBody = document.getElementById('bulkEmailBody').value;

    if (!baseSubject.trim() || !baseBody.trim()) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى إدخال موضوع ونص الرسالة.', confirmButtonText: 'حسنا' });
        return;
    }

    // Confirmation
    const result = await Swal.fire({
        title: 'تأكيد الإرسال الجماعي',
        text: `هل أنت متأكد من رغبتك في إرسال ${recipients.length} رسالة؟ سيتم الإرسال تباعاً.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'نعم، ابدأ الإرسال',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#4f46e5'
    });

    if (!result.isConfirmed) return;

    // --- Batch Configuration ---
    const BATCH_SIZE = 10;           // Number of emails per batch
    const DELAY_BETWEEN_EMAILS = 1500; // 1.5 seconds between each email
    const DELAY_BETWEEN_BATCHES = 5000; // 5 seconds pause between batches

    // Cancel mechanism
    window._bulkEmailCancelled = false;

    // UI State
    document.getElementById('bulkEmailProgressSection').style.display = 'block';
    document.getElementById('bulkEmailResultSummary').style.display = 'none';
    document.getElementById('btnSendBulkEmail').disabled = true;

    // Show minimize button
    document.getElementById('btnMinimizeBulkEmail').style.display = '';
    window._bulkEmailSending = true;

    // Enable cancel button
    const btnCancel = document.getElementById('btnCancelBulkEmail');
    btnCancel.disabled = false;
    btnCancel.textContent = '⏹ إيقاف الإرسال';
    btnCancel.onclick = function () {
        window._bulkEmailCancelled = true;
        btnCancel.disabled = true;
        btnCancel.textContent = 'جاري الإيقاف...';
    };

    const progressBar = document.getElementById('bulkEmailProgressBar');
    const progressLabel = document.getElementById('bulkEmailProgressLabel');
    const progressPercent = document.getElementById('bulkEmailProgressPercent');

    let successCount = 0;
    let failCount = 0;
    const total = recipients.length;
    const totalBatches = Math.ceil(total / BATCH_SIZE);
    const startTime = Date.now();

    // Helper to format ETA
    const formatETA = (i) => {
        if (i === 0) return '';
        const elapsed = (Date.now() - startTime) / 1000;
        const avgPerItem = elapsed / (i + 1);
        const remaining = Math.round(avgPerItem * (total - i - 1));
        if (remaining <= 0) return '';
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        if (mins > 0) return ` | ⏱ متبقي: ${mins} د ${secs} ث`;
        return ` | ⏱ متبقي: ${secs} ث`;
    };

    for (let i = 0; i < total; i++) {
        // Check for cancellation
        if (window._bulkEmailCancelled) {
            progressLabel.textContent = `تم إيقاف الإرسال عند الرسالة ${i} من ${total}.`;
            break;
        }

        const s = recipients[i];
        const studentName = `${s.last_name || ''} ${s.first_name || ''}`;

        // Dynamic Placeholders Replacement
        const finalSubject = baseSubject.split('[الاسم]').join(studentName);
        const finalBody = baseBody.split('[الاسم]').join(studentName);

        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
        const eta = formatETA(i);
        progressLabel.textContent = `الدفعة ${currentBatch}/${totalBatches} — جاري إرسال (${i + 1}/${total}): ${studentName}...${eta}`;

        try {
            const res = await window.ipcRenderer.invoke('send-email', {
                to: s.parent_email,
                subject: finalSubject,
                body: finalBody
            });

            if (res.success) successCount++;
            else {
                console.error(`Failed to send to ${s.parent_email}:`, res.error);
                failCount++;
            }
        } catch (err) {
            console.error(`IPC Error sending to ${s.parent_email}:`, err);
            failCount++;
        }

        // Update progress UI
        const percent = Math.round(((i + 1) / total) * 100);
        progressBar.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;

        // Sync floating widget
        window._updateBulkEmailWidget(percent, progressLabel.textContent);

        // Check if we've finished a batch (and not the last email)
        if ((i + 1) % BATCH_SIZE === 0 && (i + 1) < total && !window._bulkEmailCancelled) {
            // Batch cooldown pause
            const pauseMsg = `⏸ استراحة ${DELAY_BETWEEN_BATCHES / 1000} ثوانٍ لتجنب الحظر... (الدفعة ${currentBatch}/${totalBatches} اكتملت)`;
            progressLabel.textContent = pauseMsg;
            window._updateBulkEmailWidget(percent, pauseMsg);
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
        } else {
            // Normal delay between emails within a batch
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_EMAILS));
        }
    }

    // Final UI Update
    const wasCancelled = window._bulkEmailCancelled;
    window._bulkEmailCancelled = false;
    window._bulkEmailSending = false;

    // If minimized, restore modal for results
    if (window._bulkEmailMinimized) {
        restoreBulkEmail();
    }
    document.getElementById('btnMinimizeBulkEmail').style.display = 'none';
    document.getElementById('bulkEmailFloatingWidget').style.display = 'none';

    if (!wasCancelled) {
        progressLabel.textContent = 'اكتملت عملية الإرسال الجماعي.';
    }
    progressBar.classList.remove('progress-bar-animated');
    document.getElementById('bulkEmailResultSummary').style.display = 'block';
    document.getElementById('bulkSuccessCountBadge').textContent = `نجح: ${successCount}`;
    document.getElementById('bulkFailCountBadge').textContent = `فشل: ${failCount}`;
    btnCancel.disabled = false;
    btnCancel.textContent = 'إغلاق';
    btnCancel.onclick = function () {
        const modalEl = document.getElementById('bulkEmailModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    };

    Swal.fire({
        icon: failCount === 0 && !wasCancelled ? 'success' : 'info',
        title: wasCancelled ? 'تم إيقاف الإرسال' : 'اكتمل الإرسال الجماعي',
        html: `تم إرسال <b>${successCount}</b> رسالة بنجاح.<br>فشل إرسال <b>${failCount}</b> رسالة.${wasCancelled ? '<br><small>تم إيقاف الإرسال قبل اكتماله.</small>' : ''}`,
        confirmButtonText: 'حسنا',
        confirmButtonColor: '#4f46e5'
    });
};

// --- React + TanStack Table renderer ---

let tanStackReactContainer = null;

function getStudentStatusLabel(student) {
    const status = student.status;

    if (
        status === 'half_board' ||
        status === '\u0646\u0635\u0641 \u062f\u0627\u062e\u0644\u064a' ||
        status === 'ظ†طµظپ ط¯ط§ط®ظ„ظٹ' ||
        status === 'ط¸â€ ط·آµط¸ظ¾ ط·آ¯ط·آ§ط·آ®ط¸â€‍ط¸ظ¹'
    ) {
        return '\u0646\u0635\u0641 \u062f\u0627\u062e\u0644\u064a';
    }

    if (
        status === 'boarding' ||
        status === '\u062f\u0627\u062e\u0644\u064a' ||
        status === 'ط¯ط§ط®ظ„ظٹ' ||
        status === 'ط·آ¯ط·آ§ط·آ®ط¸â€‍ط¸ظ¹'
    ) {
        return '\u062f\u0627\u062e\u0644\u064a';
    }

    return '\u062e\u0627\u0631\u062c\u064a';
}

function getStudentStatusTone(statusLabel) {
    if (statusLabel === '\u0646\u0635\u0641 \u062f\u0627\u062e\u0644\u064a') {
        return 'status-half-board';
    }

    if (statusLabel === '\u062f\u0627\u062e\u0644\u064a') {
        return 'status-boarding';
    }

    return 'status-external';
}

function buildTanStackStudentRows(isScholarship) {
    return filteredStudents.map((student, index) => {
        const row = {
            id: student.id || `student-${index}`,
            realIndex: allStudents.indexOf(student),
            student: student,
            nationalId: student.national_id || '-',
            lastName: student.last_name || '',
            firstName: student.first_name || '',
            birthDate: formatDateDisplay(student.birth_date),
            gender: student.gender === 'M' ? 'ذكر' : 'أنثى',
            repeat: student.repeat ? 'نعم' : 'لا',
            level: displayLevel(student.level),
            className: student.class || '',
            stream: educationStage === 'secondary' ? (SubjectManager.getStreamName(student.stream) || '-') : '',
            status: getStudentStatusLabel(student)
        };

        row.searchText = [
            row.nationalId,
            row.lastName,
            row.firstName,
            row.birthDate,
            row.gender,
            row.repeat,
            row.level,
            row.className,
            row.stream,
            row.status,
            student.reg_number || '',
            student.pob || '',
            student.father_name || '',
            student.mother_name || '',
            student.observation || ''
        ].join(' ').toLowerCase();

        if (isScholarship) {
            row.searchText += ` ${(student.pob || '').toLowerCase()} ${(student.father_name || '').toLowerCase()} ${(student.mother_name || '').toLowerCase()}`;
        }

        return row;
    });
}

function renderTanStackNode(template, context) {
    if (template == null) return null;
    return typeof template === 'function' ? template(context) : template;
}

function renderTanStackIcon(iconHtml, fallbackClass) {
    if (iconHtml) {
        return e('span', { dangerouslySetInnerHTML: { __html: iconHtml } });
    }

    if (fallbackClass) {
        return e('i', { className: fallbackClass });
    }

    return null;
}

function TanStackStudentActionsCell({ row, isScholarship, dropup }) {
    if (row.realIndex === -1) {
        return e('span', { className: 'text-muted' }, '-');
    }

    const actionAttrs = (actionKey) => ({
        'data-student-action': actionKey,
        'data-student-index': String(row.realIndex)
    });

    if (isScholarship) {
        return e('div', {
            className: 'd-flex align-items-center justify-content-center'
        }, e('div', {
            className: 'd-flex flex-column align-items-center',
            style: { gap: '4px' }
        }, [
            e('button', {
                key: 'print',
                type: 'button',
                className: 'btn',
                title: 'طباعة الاستمارة',
                style: {
                    backgroundColor: 'var(--secondary-color)',
                    color: 'white',
                    padding: '2px 4px',
                    fontSize: '0.8em',
                    borderRadius: '4px',
                    border: 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    width: '85px'
                },
                onClick: (event) => {
                    event.stopPropagation();
                    triggerPrintScholarshipForm(row.realIndex);
                }
            }, [renderTanStackIcon(IconManager.get('notice2')), ' ', 'طباعة']),
            e('button', {
                key: 'confirm',
                type: 'button',
                className: `btn ${row.student.scholarship_confirmed ? 'btn-success' : 'btn-light'}`,
                title: row.student.scholarship_confirmed ? 'إلغاء التأكيد' : 'تأكيد',
                style: {
                    padding: '2px 4px',
                    fontSize: '0.8em',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontWeight: 'bold',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    width: '85px'
                },
                onClick: (event) => {
                    event.stopPropagation();
                    toggleScholarshipConfirmation(row.realIndex);
                }
            }, row.student.scholarship_confirmed ? '✓ مؤكد' : 'تأكيد')
        ]));
    }

    const menuItem = (key, className, onClick, content, style) => e('li', { key: key }, e('button', {
        type: 'button',
        className: `dropdown-item ${className || ''}`.trim(),
        style: style || undefined,
        ...actionAttrs(key),
        onClick: (event) => {
            event.stopPropagation();
            onClick();
        }
    }, content));

    return e('div', {
        className: `dropdown ${dropup ? 'dropup' : ''}`.trim()
    }, [
        e('button', {
            key: 'toggle',
            type: 'button',
            className: 'btn btn-sm btn-primary dropdown-toggle',
            'data-bs-toggle': 'dropdown',
            'data-bs-boundary': 'viewport',
            'data-bs-popper-config': '{"strategy":"fixed"}',
            'aria-expanded': 'false',
            onClick: (event) => event.stopPropagation()
        }, renderTanStackIcon(IconManager.get('settings'))),
        e('ul', {
            key: 'menu',
            className: 'dropdown-menu dropdown-menu-end shadow',
            onClick: (event) => event.stopPropagation()
        }, [
            menuItem('edit', '', () => openEditModal(row.realIndex), [renderTanStackIcon(IconManager.get('edit')), ' تعديل']),
            menuItem('transfer', 'text-success', () => openTransferModal(row.realIndex), [e('i', { className: 'fas fa-exchange-alt me-2' }), 'تغيير الفوج/الصفة']),
            menuItem('info', '', () => openStudentInfoModal(row.realIndex), [e('i', { className: 'fas fa-id-card me-2' }), 'معلومات'], { color: '#6f42c1' }),
            menuItem('summons', 'text-primary', () => printSummons(row.realIndex), [renderTanStackIcon(IconManager.get('notice2')), ' استدعاء']),
            menuItem('status', 'text-success', () => openStatusModal(row.realIndex), [renderTanStackIcon(IconManager.get('tag')), ' الحالة']),
            menuItem('email', 'text-info', () => emailParent(row.realIndex), [e('i', { className: 'fas fa-envelope me-2' }), 'مراسلة الولي']),
            e('li', { key: 'divider' }, e('hr', { className: 'dropdown-divider' })),
            menuItem('strike', 'text-danger', () => openStrikeModal(row.realIndex), [renderTanStackIcon(IconManager.get('strikeoff')), ' شطب'])
        ])
    ]);
}

function buildTanStackColumns(isScholarship) {
    const columns = [
        {
            id: '__index',
            header: '#',
            cell: () => null,
            meta: { width: '60px', kind: 'index' }
        },
        {
            id: 'nationalId',
            accessorKey: 'nationalId',
            header: 'رقم التعريف',
            meta: { width: isScholarship ? '150px' : '160px' }
        },
        {
            id: 'lastName',
            accessorKey: 'lastName',
            header: 'اللقب',
            meta: { sortField: 'last_name' }
        },
        {
            id: 'firstName',
            accessorKey: 'firstName',
            header: 'الاسم',
            meta: { sortField: 'first_name' }
        },
        {
            id: 'birthDate',
            accessorKey: 'birthDate',
            header: 'تاريخ الميلاد',
            meta: { width: '110px' }
        }
    ];

    if (isScholarship) {
        columns.push(
            {
                id: 'pob',
                header: 'مكان الميلاد',
                cell: (info) => e(EditableCell, {
                    value: info.row.original.student.pob,
                    onChange: (value) => updateStudentField(info.row.original.realIndex, 'pob', value),
                    placeholder: '...'
                }),
                meta: { width: '130px' }
            },
            {
                id: 'father_name',
                header: 'اسم الأب',
                cell: (info) => e(EditableCell, {
                    value: info.row.original.student.father_name,
                    onChange: (value) => updateStudentField(info.row.original.realIndex, 'father_name', value),
                    placeholder: '...'
                }),
                meta: { width: '140px' }
            },
            {
                id: 'mother_name',
                header: 'اسم الأم',
                cell: (info) => e(EditableCell, {
                    value: info.row.original.student.mother_name,
                    onChange: (value) => updateStudentField(info.row.original.realIndex, 'mother_name', value),
                    placeholder: '...'
                }),
                meta: { width: '140px' }
            },
            {
                id: 'level',
                accessorKey: 'level',
                header: 'المستوى',
                meta: { width: '90px', sortField: 'level' }
            },
            {
                id: 'className',
                accessorKey: 'className',
                header: 'الفوج',
                meta: { width: '70px', sortField: 'class' }
            },
            {
                id: 'status',
                accessorKey: 'status',
                header: 'الصفة',
                meta: { width: '90px', sortField: 'status' }
            }
        );
    } else {
        columns.push(
            {
                id: 'gender',
                accessorKey: 'gender',
                header: 'الجنس',
                meta: { width: '80px', sortField: 'gender' }
            },
            {
                id: 'repeat',
                accessorKey: 'repeat',
                header: 'معيد',
                meta: { width: '70px', sortField: 'repeat' }
            },
            {
                id: 'level',
                accessorKey: 'level',
                header: 'المستوى',
                meta: { width: '100px', sortField: 'level' }
            }
        );

        if (educationStage === 'secondary') {
            columns.push({
                id: 'stream',
                accessorKey: 'stream',
                header: 'الشعبة',
                meta: { width: '140px', sortField: 'stream' }
            });
        }

        columns.push({
            id: 'className',
            accessorKey: 'className',
            header: 'الفوج',
            meta: { width: '80px', sortField: 'class' }
        });

        columns.push({
            id: 'status',
            accessorKey: 'status',
            header: 'الصفة',
            meta: { width: '100px', sortField: 'status' }
        });
    }

    columns.push({
        id: 'actions',
        header: 'إجراءات',
        cell: () => null,
        meta: { width: isScholarship ? '130px' : '120px', kind: 'actions', noPrint: true }
    });

    return columns;
}

function TanStackStudentTable({ rows, isScholarship }) {
    const tableWrapperRef = React.useRef(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [pagination, setPagination] = React.useState({
        pageIndex: 0,
        pageSize: pageSize
    });

    const visibleRows = React.useMemo(() => {
        const normalizedSearch = (searchTerm || '').trim().toLowerCase();
        if (!normalizedSearch) return rows;
        return rows.filter(row => row.searchText.includes(normalizedSearch));
    }, [rows, searchTerm]);

    React.useEffect(() => {
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
    }, [rows, isScholarship, searchTerm]);

    const tableState = React.useMemo(() => ({
        pagination: pagination,
        columnPinning: {
            left: [],
            right: []
        }
    }), [pagination]);

    const table = React.useMemo(() => {
        if (!window.TableCore || typeof window.TableCore.createTable !== 'function') {
            return null;
        }

        return window.TableCore.createTable({
            data: visibleRows,
            columns: buildTanStackColumns(isScholarship),
            state: tableState,
            onStateChange: (updater) => {
                const nextState = window.TableCore.functionalUpdate(updater, tableState);
                if (nextState && nextState.pagination) {
                    setPagination(nextState.pagination);
                }
            },
            getRowId: (row) => `${row.id}-${row.realIndex}`,
            getCoreRowModel: window.TableCore.getCoreRowModel(),
            getPaginationRowModel: window.TableCore.getPaginationRowModel()
        });
    }, [visibleRows, isScholarship, tableState]);

    React.useEffect(() => {
        if (!tableWrapperRef.current) return undefined;

        if (typeof IconManager !== 'undefined') {
            IconManager.render();
        }

        // setupColumnSortHandlers();
        // updateSortIndicators();

        const dropdownToggles = Array.from(tableWrapperRef.current.querySelectorAll('[data-bs-toggle="dropdown"]'));
        const dropdownInstances = dropdownToggles.map(toggle => createActionDropdownInstance(toggle));
        const closeDropdownsOnViewportChange = () => closeOpenActionDropdowns(tableWrapperRef.current);

        document.addEventListener('scroll', closeDropdownsOnViewportChange, true);
        window.addEventListener('resize', closeDropdownsOnViewportChange);

        return () => {
            document.removeEventListener('scroll', closeDropdownsOnViewportChange, true);
            window.removeEventListener('resize', closeDropdownsOnViewportChange);
            closeOpenActionDropdowns(tableWrapperRef.current);

            dropdownInstances.forEach(instance => {
                try {
                    instance.dispose();
                } catch (error) {
                    console.warn('Dropdown dispose failed:', error);
                }
            });
        };
    }, [visibleRows.length, isScholarship, searchTerm, pagination.pageIndex]);

    if (!table) {
        return e('div', { className: 'alert alert-danger m-3' }, 'تعذر تحميل مكتبة TanStack Table.');
    }

    const pagedRows = table.getRowModel().rows;
    const pageIndex = table.getState().pagination.pageIndex;
    const pageSizeValue = table.getState().pagination.pageSize;
    const pageCount = Math.max(table.getPageCount(), 1);
    const totalResults = visibleRows.length;
    const startRow = totalResults === 0 ? 0 : (pageIndex * pageSizeValue) + 1;
    const endRow = totalResults === 0 ? 0 : Math.min((pageIndex * pageSizeValue) + pagedRows.length, totalResults);
    const headerRows = table.getHeaderGroups().map(headerGroup => e('tr', {
        key: headerGroup.id
    }, headerGroup.headers.map(header => {
        const meta = header.column.columnDef.meta || {};
        return e('th', {
            key: header.id,
            className: 'gridjs-th',
            colSpan: header.colSpan,
            style: meta.width ? { width: meta.width } : undefined,
            'data-sort-field': meta.sortField || undefined,
            'data-column-id': header.column.id
        }, e('span', {
            className: 'header-label'
        }, renderTanStackNode(header.column.columnDef.header, header.getContext())));
    })));
    const bodyRows = pagedRows.map((row, rowIndexOnPage) => e('tr', {
        key: row.id,
        className: 'gridjs-tr',
        style: { cursor: 'pointer' },
        onClick: (event) => {
            if (event.target.closest('.dropdown') || event.target.closest('button') || event.target.closest('a') || event.target.closest('input') || event.target.closest('textarea') || event.target.closest('select')) {
                return;
            }
            if (row.original.realIndex !== -1) {
                openStatusModal(row.original.realIndex);
            }
        }
    }, row.getVisibleCells().map(cell => {
        const meta = cell.column.columnDef.meta || {};
        let content;

        if (meta.kind === 'index') {
            content = (pageIndex * pageSizeValue) + rowIndexOnPage + 1;
        } else if (meta.kind === 'actions') {
            const dropup = pagedRows.length <= 5 || (rowIndexOnPage >= pagedRows.length - 3 && pagedRows.length > 3);
            content = e(TanStackStudentActionsCell, {
                row: row.original,
                isScholarship: isScholarship,
                dropup: dropup
            });
        } else {
            content = renderTanStackNode(cell.column.columnDef.cell, cell.getContext());
            if (content == null) {
                content = cell.getValue();
            }
        }

        if (cell.column.id === 'status' && typeof content === 'string') {
            content = e('span', {
                className: `student-status-chip ${getStudentStatusTone(content)}`
            }, content);
        } else if (cell.column.id === 'level' && typeof content === 'string' && content) {
            content = e('span', {
                className: 'student-level-chip'
            }, content);
        } else if (cell.column.id === 'className' && typeof content === 'string' && content) {
            content = e('span', {
                className: 'student-class-chip'
            }, content);
        }

        return e('td', {
            key: cell.id,
            className: `gridjs-td ${meta.noPrint ? 'no-print' : ''}`.trim(),
            style: meta.width ? { width: meta.width } : undefined,
            'data-column-id': cell.column.id
        }, content);
    })));

    return e('div', {
        className: 'gridjs-container student-table-shell',
        ref: tableWrapperRef
    }, [
        e('div', {
            key: 'head',
            className: 'gridjs-head student-table-toolbar d-flex justify-content-between align-items-center no-print',
            style: { gap: '10px' }
        }, e('div', {
            className: 'gridjs-search student-table-search'
        }, e('input', {
            type: 'search',
            className: 'form-control student-table-search-input',
            placeholder: 'بحث سريع...',
            value: searchTerm,
            onChange: (event) => setSearchTerm(event.target.value),
            style: { minWidth: '260px' }
        }))),
        e('div', {
            key: 'wrapper',
            className: 'gridjs-wrapper student-table-wrapper'
        }, totalResults === 0
            ? e('div', {
                className: 'text-center text-muted p-4 student-table-empty'
            }, 'لا توجد نتائج مطابقة')
            : e('table', {
                className: 'gridjs-table student-table table table-hover table-bordered mb-0'
            }, [
                e('thead', {
                    key: 'thead',
                    className: 'thead-light'
                }, headerRows),
                e('tbody', {
                    key: 'tbody'
                }, bodyRows)
            ])
        ),
        e('div', {
            key: 'footer',
            className: 'gridjs-footer student-table-footer'
        }, e('div', {
            className: 'gridjs-pagination d-flex flex-wrap justify-content-between align-items-center',
            style: { gap: '10px' }
        }, [
            e('div', {
                key: 'summary',
                className: 'text-muted student-table-summary',
                style: { fontSize: '0.9rem' }
            }, `عرض ${startRow} إلى ${endRow} من ${totalResults} نتائج`),
            e('div', {
                key: 'pages',
                className: 'gridjs-pages student-table-pages d-flex align-items-center'
            }, [
                e('button', {
                    key: 'prev',
                    type: 'button',
                    disabled: !table.getCanPreviousPage(),
                    onClick: () => table.previousPage()
                }, 'السابق'),
                e('button', {
                    key: 'current',
                    type: 'button',
                    className: 'gridjs-currentPage',
                    disabled: true
                }, `صفحة ${Math.min(pageIndex + 1, pageCount)} من ${pageCount}`),
                e('button', {
                    key: 'next',
                    type: 'button',
                    disabled: !table.getCanNextPage(),
                    onClick: () => table.nextPage()
                }, 'التالي')
            ])
        ]))
    ]);
}

function setupColumnSortHandlers() {
    const headers = document.querySelectorAll('#gridjs-wrapper .gridjs-th[data-sort-field]');
    headers.forEach(header => {
        if (header.__sortHandler) {
            header.removeEventListener('click', header.__sortHandler);
        }

        const field = header.getAttribute('data-sort-field');
        if (!field) return;

        const handler = (event) => {
            if (event.target.closest('.sort-indicator') || event.target.closest('.dropdown')) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            toggleColumnSort(field);
        };

        header.__sortHandler = handler;
        header.style.cursor = 'pointer';
        header.title = 'انقر للترتيب';
        header.addEventListener('click', handler);
    });
}

function updateSortIndicators() {
    setTimeout(() => {
        const headers = document.querySelectorAll('#gridjs-wrapper .gridjs-th[data-sort-field]');
        headers.forEach(header => {
            const field = header.getAttribute('data-sort-field');
            const label = header.querySelector('.header-label');
            if (!field || !label) return;

            const current = SORT_CONFIG.currentSort.find(entry => entry.field === field);
            const existingIndicator = header.querySelector('.sort-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }

            header.classList.remove('sorted-column');

            if (!current) return;

            const indicator = document.createElement('span');
            indicator.className = 'sort-indicator';

            const priority = SORT_CONFIG.currentSort.findIndex(entry => entry.field === field) + 1;
            indicator.textContent = current.direction === SORT_CONFIG.ASC ? ' ↑' : ' ↓';
            if (SORT_CONFIG.currentSort.length > 1) {
                indicator.textContent += ` (${priority})`;
            }

            header.classList.add('sorted-column');
            header.appendChild(indicator);
        });
    }, 0);
}

function renderTable() {
    const wrapper = document.getElementById('gridjs-wrapper');
    if (!wrapper) return;

    const statusSelect = document.getElementById('statusSelect');
    const selectedStatus = statusSelect ? statusSelect.value : '';
    const isScholarship = selectedStatus === 'scholarship_5000';
    const rows = buildTanStackStudentRows(isScholarship);

    if (!reactRoot || tanStackReactContainer !== wrapper) {
        wrapper.innerHTML = '';
        tanStackReactContainer = wrapper;

        if (ReactDOM.createRoot) {
            reactRoot = ReactDOM.createRoot(wrapper);
        } else {
            reactRoot = {
                render: (element) => ReactDOM.render(element, wrapper)
            };
        }
    }

    reactRoot.render(e(TanStackStudentTable, {
        rows: rows,
        isScholarship: isScholarship
    }));
}
