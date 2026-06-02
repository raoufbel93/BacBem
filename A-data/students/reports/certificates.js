/**
 * Certificates Management - الشهادات التقديرية
 * Recognition certificates for middle school students
 */
// Global variables
let allStudents = [];
let filteredStudents = [];
let qualifiedStudents = [];
let currentFilter = 'all';
let selectedStudentKeys = new Set();

let institutionSettings = {};

let signatureSettings = {};

let savedThresholds = null;


// =============================================
// Font Settings for Certificates
// =============================================

const AVAILABLE_FONTS = [
    { name: 'Tajawal', file: 'Tajawal-Regular.ttf', label: 'Tajawal (الافتراضي)' },
    { name: 'Tajawal-Bold', file: 'Tajawal-Bold.ttf', label: 'Tajawal عريض' },
    { name: 'Cairo', file: 'Cairo-Regular.ttf', label: 'Cairo' },
    { name: 'Cairo-Bold', file: 'Cairo-Bold.ttf', label: 'Cairo عريض' },
    { name: 'Cairo-SemiBold', file: 'Cairo-SemiBold.ttf', label: 'Cairo شبه عريض' },
    { name: 'Almaalim', file: 'mcs-almaalim-high-brok.ttf', label: 'المعالم (مزخرف)' },
    { name: 'Thuluth', file: 'decotype-thuluth-iii.ttf', label: 'ثلث' },
    { name: 'Diwani', file: 'ukij-diwani-tom-arabic.ttf', label: 'ديواني' },
    { name: 'KhalaadArabeh', file: 'khalaad-al-arabeh.ttf', label: 'خلاد العربية' },
    { name: 'AlwCoolHijon', file: 'alw-cool-hijon.ttf', label: 'الواحة' },
    { name: 'Sultan', file: 'Sultan-Medium.ttf', label: 'سلطان' },
    { name: 'Amatti', file: 'ManaraDocs Amatti Font.ttf', label: 'أماتي' }
];

const DEFAULT_FONT_SETTINGS = {
    header: 'Tajawal',
    title: 'Almaalim',
    body: 'Tajawal'
};

let currentFontSettings = { ...DEFAULT_FONT_SETTINGS };

// Load font previews into the settings page
function loadFontPreviews() {
    const fontsDir = '../../assets/fonts/';
    AVAILABLE_FONTS.forEach(f => {
        const style = document.createElement('style');
        style.textContent = `@font-face { font-family: '${f.name}'; src: url('${fontsDir}${f.file}') format('truetype'); }`;
        document.head.appendChild(style);
    });
}

// Populate font select dropdowns
function populateFontSelects() {
    ['fontHeader', 'fontTitle', 'fontBody'].forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = AVAILABLE_FONTS.map(f =>
            `<option value="${f.name}" style="font-family: '${f.name}'">${f.label}</option>`
        ).join('');
    });
}

function previewFont(type) {
    const map = { header: 'fontHeader', title: 'fontTitle', body: 'fontBody' };
    const previewMap = { header: 'previewHeader', title: 'previewTitle', body: 'previewBody' };
    const select = document.getElementById(map[type]);
    const preview = document.getElementById(previewMap[type]);
    if (select && preview) {
        preview.style.fontFamily = "'" + select.value + "', sans-serif";
    }
}

function openFontSettings() {
    loadFontPreviews();
    populateFontSelects();
    // Set current values
    document.getElementById('fontHeader').value = currentFontSettings.header;
    document.getElementById('fontTitle').value = currentFontSettings.title;
    document.getElementById('fontBody').value = currentFontSettings.body;
    // Apply previews
    previewFont('header');
    previewFont('title');
    previewFont('body');
    document.getElementById('fontSettingsOverlay').classList.add('active');
}

function closeFontSettings() {
    document.getElementById('fontSettingsOverlay').classList.remove('active');
}

async function saveFontSettings() {
    currentFontSettings = {
        header: document.getElementById('fontHeader').value,
        title: document.getElementById('fontTitle').value,
        body: document.getElementById('fontBody').value
    };
    await DB.set('certificateFontSettings', currentFontSettings);
    closeFontSettings();
    Swal.fire({
        icon: 'success',
        title: 'تم الحفظ',
        text: 'تم حفظ إعدادات الخطوط بنجاح',
        timer: 1500,
        showConfirmButton: false
    });
}

async function loadFontSettings() {
    const saved = await DB.get('certificateFontSettings');
    if (saved) {
        currentFontSettings = { ...DEFAULT_FONT_SETTINGS, ...saved };
    }
}

// Helper: generate base64 data URI for a font file
function getFontDataURI(fontName) {
    const font = AVAILABLE_FONTS.find(f => f.name === fontName);
    if (!font) return null;
    // We'll use a relative path; for print windows we embed base64
    return font;
}


// Default thresholds

const DEFAULT_THRESHOLDS = {

    excellence: { min: 18, max: 20 },

    congratulation: { min: 16, max: 17.99 },

    encouragement: { min: 14, max: 15.99 },

    honor: { min: 12, max: 13.99 }

};

// Certificate templates

const CERTIFICATE_TEMPLATES = {

    excellence: {

        title: 'امتياز',

        icon: '🏅',

        text: `يسرّ إدارة {institutionName} أن تمنح هذه الشهادة التقديرية للتلميذ(ة):

{studentName}

تقديرًا لتفوقه(ها) الدراسي وتحصّله(ها) على معدل {average}

خلال {period} من السنة الدراسية {schoolYear}،

متمنّين له(ها) مزيدًا من النجاح والتألق.`

    },

    congratulation: {

        title: 'تهنئة',

        icon: '🌟',

        text: `تهنئ إدارة {institutionName} التلميذ(ة):

{studentName}

نظير النتائج المشرفة التي حققها(ها) وتحصلّه(ها) على معدل {average}

خلال {period} من السنة الدراسية {schoolYear}،

وتشجعه(ها) على مواصلة الجهد والمثابرة.`

    },

    encouragement: {

        title: 'تشجيع',

        icon: '🌱',

        text: `تشجع إدارة {institutionName} التلميذ(ة):

{studentName}

عرفانًا بالمجهودات المبذولة والنتائج المحققة بمعدل {average}

خلال {period} من السنة الدراسية {schoolYear}،

راجين له(ها) المزيد من التقدم والنجاح.`

    },

    honor: {

        title: 'لوحة شرف',

        icon: '🏆',

        text: `تتشرف إدارة {institutionName} بمنح شهادة لوحة الشرف للتلميذ(ة):

{studentName}

بعد تحصله(ها) على معدل {average}

خلال {period} من السنة الدراسية {schoolYear}،

وذلك تقديرًا لمثابرته(ها) وانضباطه(ها) الدراسي.`

    }

};

// Initialize on page load

document.addEventListener('DOMContentLoaded', async function () {

    try {

        await loadThresholds();
        await loadFontSettings();
        await loadSettings();
        await populateYears(); // Initialize years first
        setupEventListeners();
        await loadResults();
        initTrimester();

    } catch (e) {

        console.error("Error during initialization:", e);

    }

});

// Load settings

async function loadSettings() {

    institutionSettings = await DB.getSettings() || {};

}

// Setup event listeners

function setupEventListeners() {

    document.getElementById('yearSelect')?.addEventListener('change', loadResults);

    document.getElementById('trimesterSelect').addEventListener('change', classifyStudents);

    document.getElementById('levelSelect').addEventListener('change', onLevelChange);

    document.getElementById('streamSelect')?.addEventListener('change', onStreamChange);

    document.getElementById('classSelect').addEventListener('change', onClassChange);

    // Threshold inputs

    const thresholdInputs = document.querySelectorAll('.threshold-inputs input');

    thresholdInputs.forEach(input => {

        input.addEventListener('change', () => {

            saveThresholds();

            classifyStudents();

        });

    });

}

// Load saved thresholds

async function loadThresholds() {

    const thresholds = (await DB.get('certificateThresholds')) || DEFAULT_THRESHOLDS;

    savedThresholds = thresholds;

    if (thresholds) {

        if (document.getElementById('excellenceMin'))

            document.getElementById('excellenceMin').value = thresholds.excellence?.min || DEFAULT_THRESHOLDS.excellence.min;

        if (document.getElementById('congratulationMin')) {

            document.getElementById('congratulationMin').value = thresholds.congratulation?.min || DEFAULT_THRESHOLDS.congratulation.min;

            document.getElementById('congratulationMax').value = thresholds.congratulation?.max || DEFAULT_THRESHOLDS.congratulation.max;

        }

        if (document.getElementById('encouragementMin')) {

            document.getElementById('encouragementMin').value = thresholds.encouragement?.min || DEFAULT_THRESHOLDS.encouragement.min;

            document.getElementById('encouragementMax').value = thresholds.encouragement?.max || DEFAULT_THRESHOLDS.encouragement.max;

        }

        if (document.getElementById('honorMin')) {

            document.getElementById('honorMin').value = thresholds.honor?.min || DEFAULT_THRESHOLDS.honor.min;

            document.getElementById('honorMax').value = thresholds.honor?.max || DEFAULT_THRESHOLDS.honor.max;

        }

    }

}

// Save thresholds

async function saveThresholds() {

    const thresholds = {

        excellence: {

            min: parseFloat(document.getElementById('excellenceMin').value),

            max: 20

        },

        congratulation: {

            min: parseFloat(document.getElementById('congratulationMin').value),

            max: parseFloat(document.getElementById('congratulationMax').value)

        },

        encouragement: {

            min: parseFloat(document.getElementById('encouragementMin').value),

            max: parseFloat(document.getElementById('encouragementMax').value)

        },

        honor: {

            min: parseFloat(document.getElementById('honorMin').value),

            max: parseFloat(document.getElementById('honorMax').value)

        }

    };

    savedThresholds = thresholds; // Update in memory

    await DB.set('certificateThresholds', thresholds);

}

// Get current thresholds

function getThresholds() {

    return {

        excellence: {

            min: parseFloat(document.getElementById('excellenceMin').value) || DEFAULT_THRESHOLDS.excellence.min,

            max: 20

        },

        congratulation: {

            min: parseFloat(document.getElementById('congratulationMin').value) || DEFAULT_THRESHOLDS.congratulation.min,

            max: parseFloat(document.getElementById('congratulationMax').value) || DEFAULT_THRESHOLDS.congratulation.max

        },

        encouragement: {

            min: parseFloat(document.getElementById('encouragementMin').value) || DEFAULT_THRESHOLDS.encouragement.min,

            max: parseFloat(document.getElementById('encouragementMax').value) || DEFAULT_THRESHOLDS.encouragement.max

        },

        honor: {

            min: parseFloat(document.getElementById('honorMin').value) || DEFAULT_THRESHOLDS.honor.min,

            max: parseFloat(document.getElementById('honorMax').value) || DEFAULT_THRESHOLDS.honor.max

        }

    };

}

// populateYears function
async function populateYears() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;

    const years = await DB.getUniqueAcademicYears();
    const currentYear = institutionSettings.schoolYear || DB.getCurrentAcademicYear();

    if (years.length > 0) {
        yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
        if (years.includes(currentYear)) {
            yearSelect.value = currentYear;
        } else {
            yearSelect.value = years[0];
        }
    } else {
        yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option>`;
        yearSelect.value = currentYear;
    }
}

// Load results from storage

async function loadResults() {
    const yearSelect = document.getElementById('yearSelect');
    const selectedYear = yearSelect ? yearSelect.value : institutionSettings.schoolYear;

    console.log('Loading results... Selected Year:', selectedYear);
    const data = await DB.getResults(true);

    if (!data || data.length === 0) {

        console.warn('DB.getResults() returned no data.');

        showNoData('لا توجد بيانات. يرجى استيراد النتائج أولا.');

        return;

    }

    console.log('Total records in schoolResults:', data.length);

    if (data.length > 0) {

        console.log('First record sample:', data[0]);

    }

    // Filter by year if available
    let studentsInYear = [];
    if (selectedYear) {
        studentsInYear = data.filter(s => {
            const yr = typeof getStudentYear === 'function' ? getStudentYear(s) : (s.academic_year || s.school_year || s.year || s.schoolYear);
            return yr === selectedYear;
        });
    }

    if (studentsInYear.length === 0 && selectedYear) {
        console.warn('No students found for selected year:', selectedYear);
    }

    // Assign the correctly filtered year
    allStudents = studentsInYear.length > 0 ? studentsInYear : (selectedYear ? [] : data);

    console.log('Students after year filter:', allStudents.length);

    // Populate level dropdown (based on filtered data)

    populateLevels();

    // Check stage and populate streams if secondary

    checkStageAndPopulateStreams();

    // Classify students (will apply Trimester filter)

    classifyStudents();

}

// Auto-detect and set initial trimester

function initTrimester() {

    if (allStudents.length > 0) {

        // Find the most common trimester

        const counts = {};

        allStudents.forEach(s => {

            const t = s.trimester;

            if (t) counts[t] = (counts[t] || 0) + 1;

        });

        const trimesters = Object.keys(counts);

        if (trimesters.length > 0) {

            // Sort by count descending

            trimesters.sort((a, b) => counts[b] - counts[a]);

            const bestTrim = trimesters[0]; // Most frequent

            console.log('Detected Trimesters:', counts, 'Best:', bestTrim);

            let targetValue = '1';

            // Map Arabic to select Value

            if (bestTrim.includes('الأول') || bestTrim.includes('1')) targetValue = '1';

            else if (bestTrim.includes('الثاني') || bestTrim.includes('2')) targetValue = '2';

            else if (bestTrim.includes('الثالث') || bestTrim.includes('3')) targetValue = '3';

            // Set the dropdown

            const trimSelect = document.getElementById('trimesterSelect');

            // Only set if not already set by user (though on init it's default)

            console.log('Auto-initializing trimester to:', targetValue);

            trimSelect.value = targetValue;

            // Refresh data with new trimester

            console.log('Refreshing data after auto-init...');

            populateLevels();

            classifyStudents();

        }

    }

}

// Populate levels dropdown

function populateLevels() {

    const levelSelect = document.getElementById('levelSelect');

    levelSelect.innerHTML = '<option value="">-- كل المستويات --</option>';

    const levels = [...new Set(allStudents.map(s => s.level))].filter(Boolean);

    // Filter levels based on Education Stage

    const isSecondary = institutionSettings.educationStage === 'secondary';

    const filteredLevels = levels.filter(l => {

        if (isSecondary) {

            return l.includes('ثانوي') || l.includes('AS');

        } else {

            return l.includes('متوسط') || l.includes('AM');

        }

    });

    // If filtering leaves nothing (e.g. data mismatch), fall back to all levels

    const finalLevels = filteredLevels.length > 0 ? filteredLevels : levels;

    finalLevels.sort();

    finalLevels.forEach(level => {

        const option = document.createElement('option');

        option.value = level;

        option.textContent = level;

        levelSelect.appendChild(option);

    });

    // Clear and reset class dropdown

    document.getElementById('classSelect').innerHTML = '<option value="">-- كل الأقسام --</option>';

}

// Populate classes dropdown based on selected level

function populateClasses() {

    const level = document.getElementById('levelSelect').value;

    const stream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : '';

    const classSelect = document.getElementById('classSelect');

    const currentClass = classSelect.value;

    classSelect.innerHTML = '<option value="">-- كل الأقسام --</option>';

    if (!level) return;

    const classes = [...new Set(allStudents.filter(s => {
        if (s.level !== level) return false;
        if (institutionSettings.educationStage === 'secondary' && stream && s.stream !== stream) return false;
        return true;
    }).map(s => s.class))].filter(Boolean);

    classes.sort();

    classes.forEach(cls => {

        const option = document.createElement('option');

        option.value = cls;

        option.textContent = cls;

        classSelect.appendChild(option);

    });

    if (currentClass && classes.includes(currentClass)) {
        classSelect.value = currentClass;
    }

}

// Handle level change

function onLevelChange() {

    const level = document.getElementById('levelSelect').value;

    // Update class dropdown when level changes

    populateClasses();

    // Update streams if secondary

    if (institutionSettings.educationStage === 'secondary') {

        populateStreams();

    }

    // Classify students with new filter

    classifyStudents();

}

// Handle class change

function onClassChange() {

    // Just classify students with current filters (don't reset class dropdown)

    classifyStudents();

}

// Handle stream change

function onStreamChange() {

    populateClasses(); // Classes depend on stream

    classifyStudents();

}

// Trimester mapping

const TRIMESTER_MAP = {

    '1': ['1', 'الأول', 'الفصل الأول'],

    '2': ['2', 'الثاني', 'الفصل الثاني'],

    '3': ['3', 'الثالث', 'الفصل الثالث']

};

function getStudentKey(student) {

    return student.id
        || student.student_id
        || student.national_id
        || student.name
        || `${student.last_name || ''} ${student.first_name || ''}|${student.level || ''}|${student.class || ''}`;

}

// Classify students based on thresholds

function classifyStudents() {

    const level = document.getElementById('levelSelect').value;

    const stream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : '';

    const cls = document.getElementById('classSelect').value;

    const trimester = document.getElementById('trimesterSelect').value;

    const thresholds = getThresholds();

    // 1. Filter and Calculate Average


    qualifiedStudents = [];

    const processedIds = new Set();

    // --- Optimization: Pre-index student records for faster lookup ---
    const studentRecordsMap = new Map();
    if (trimester === '1+2') {
        allStudents.forEach(r => {
            const key = getStudentKey(r);
            if (!studentRecordsMap.has(key)) {
                studentRecordsMap.set(key, []);
            }
            studentRecordsMap.get(key).push(r);
        });
    }
    // ----------------------------------------------------------------

    allStudents.forEach(s => {

        // Filter by Level

        if (level && s.level !== level) return;

        // Filter by Stream

        if (stream && s.stream !== stream) return;

        // Filter by Class

        if (cls && s.class !== cls) return;

        // Filter by Trimester/Type & Calculate Average

        let average = 0;

        let isValid = false;

        if (trimester === 'annual') {

            // Check for explicit annual average

            if (s.annual_average && !isNaN(parseFloat(s.annual_average))) {

                average = parseFloat(s.annual_average);

                isValid = true;

            }

            // Fallback: Calculate from trimester averages

            else if (s.averages && s.averages['1'] && s.averages['2'] && s.averages['3']) {

                const a1 = parseFloat(s.averages['1']);

                const a2 = parseFloat(s.averages['2']);

                const a3 = parseFloat(s.averages['3']);

                if (!isNaN(a1) && !isNaN(a2) && !isNaN(a3)) {

                    average = (a1 + a2 + a3) / 3;

                    isValid = true;

                }

            }

        } else if (trimester === '1+2') {

            // Prevent processing flat records of the same student twice
            const studentKey = getStudentKey(s);
            if (processedIds.has(studentKey)) return;

            let a1 = NaN, a2 = NaN;

            if (s.averages && typeof s.averages['1'] !== 'undefined' && typeof s.averages['2'] !== 'undefined') {
                a1 = parseFloat(s.averages['1']);
                a2 = parseFloat(s.averages['2']);
            } else {
                // Use pre-indexed map for O(1) lookup instead of O(N) array filter
                const studentRecords = studentRecordsMap.get(studentKey) || [];

                const t1Record = studentRecords.find(r => ['1', 'الأول', 'الفصل الأول'].includes(String(r.trimester)));
                const t2Record = studentRecords.find(r => ['2', 'الثاني', 'الفصل الثاني'].includes(String(r.trimester)));

                if (t1Record) a1 = parseFloat(t1Record.average);
                if (t2Record) a2 = parseFloat(t2Record.average);
            }

            if (!isNaN(a1) && !isNaN(a2)) {
                average = (a1 + a2) / 2;
                isValid = true;
                processedIds.add(studentKey); // mark structured processed
            }

        } else if (trimester && TRIMESTER_MAP[trimester]) {

            const studentKey = getStudentKey(s);
            if (processedIds.has(studentKey)) return;

            const trimesterAverage = s.averages && typeof s.averages[trimester] !== 'undefined'
                ? parseFloat(s.averages[trimester])
                : NaN;

            if (!isNaN(trimesterAverage)) {

                average = trimesterAverage;
                isValid = true;
                processedIds.add(studentKey);

            } else {

                // Check matches trimester for flat legacy records
                const possibleValues = TRIMESTER_MAP[trimester];
                const normalizedTrimester = String(s.trimester || '').trim();

                if (possibleValues.some(val => normalizedTrimester === val)) {

                    average = parseFloat(s.average);

                    if (!isNaN(average)) {
                        isValid = true;
                        processedIds.add(studentKey);
                    }

                }

            }

        }

        if (!isValid) return;

        let certificateType = null;

        // Check thresholds (highest first)

        if (average >= thresholds.excellence.min && average <= thresholds.excellence.max) {

            certificateType = 'excellence';

        } else if (average >= thresholds.congratulation.min && average <= thresholds.congratulation.max) {

            certificateType = 'congratulation';

        } else if (average >= thresholds.encouragement.min && average <= thresholds.encouragement.max) {

            certificateType = 'encouragement';

        } else if (average >= thresholds.honor.min && average <= thresholds.honor.max) {

            certificateType = 'honor';

        }

        if (certificateType) {

            const studentKey = getStudentKey(s);

            qualifiedStudents.push({

                ...s,

                studentKey: studentKey,

                average: average,

                certificateType: certificateType,

                selected: selectedStudentKeys.has(studentKey)

            });

        }

    });

    // Sort by average descending

    qualifiedStudents.sort((a, b) => b.average - a.average);

    // Update display

    updateTable();

    updateCounts();

}

// Update students table

function updateTable() {

    const tbody = document.getElementById('studentsTableBody');

    const isSecondary = institutionSettings.educationStage === 'secondary';

    // Toggle header

    const streamHeader = document.getElementById('streamHeader');

    if (streamHeader) streamHeader.style.display = isSecondary ? '' : 'none';

    // Filter by current type if not 'all'

    let displayStudents = qualifiedStudents;

    if (currentFilter !== 'all') {

        displayStudents = qualifiedStudents.filter(s => s.certificateType === currentFilter);

    }

    if (displayStudents.length === 0) {

        tbody.innerHTML = '<tr><td colspan="7" class="no-data">لا يوجد تلاميذ مؤهلون في هذه الفئة</td></tr>';

        updateSelectAllState();

        return;

    }

    const typeLabels = {

        excellence: { label: 'امتياز', class: 'badge-excellence' },

        congratulation: { label: 'تهنئة', class: 'badge-congratulation' },

        encouragement: { label: 'تشجيع', class: 'badge-encouragement' },

        honor: { label: 'لوحة شرف', class: 'badge-honor' }

    };

    tbody.innerHTML = displayStudents.map((s, idx) => {

        // Handle different name fields

        const studentName = s.name || `${s.last_name || ''} ${s.first_name || ''}`.trim() || 'بدون اسم';

        return `

        <tr>

            <td class="checkbox-cell">

                <input type="checkbox" class="student-checkbox" data-index="${qualifiedStudents.indexOf(s)}"

                    ${s.selected ? 'checked' : ''} onchange="toggleStudent(${qualifiedStudents.indexOf(s)})">

            </td>

            <td>${idx + 1}</td>

            <td>${studentName}</td>

            ${isSecondary ? `<td>${getStreamName(s.stream)}</td>` : ''}

            <td>${s.level || ''} - ${s.class || ''}</td>

            <td><strong>${s.average.toFixed(2)}</strong></td>

            <td><span class="badge ${typeLabels[s.certificateType].class}">${typeLabels[s.certificateType].label}</span></td>

            <td><button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="previewCertificate(${qualifiedStudents.indexOf(s)})"><span data-icon="search" style="color: white;"></span></button></td>

        </tr>

    `;

    }).join('');

    updateSelectAllState();

}

// Update counts

function updateCounts() {

    const counts = {

        excellence: qualifiedStudents.filter(s => s.certificateType === 'excellence').length,

        congratulation: qualifiedStudents.filter(s => s.certificateType === 'congratulation').length,

        encouragement: qualifiedStudents.filter(s => s.certificateType === 'encouragement').length,

        honor: qualifiedStudents.filter(s => s.certificateType === 'honor').length

    };

    document.getElementById('countExcellence').textContent = `امتياز: ${counts.excellence} `;

    document.getElementById('countCongratulation').textContent = `تهنئة: ${counts.congratulation} `;

    document.getElementById('countEncouragement').textContent = `تشجيع: ${counts.encouragement} `;

    document.getElementById('countHonor').textContent = `لوحة شرف: ${counts.honor} `;

}

// Filter by type

function filterByType(type) {

    currentFilter = type;

    // Update tabs

    document.querySelectorAll('.tab-btn').forEach(btn => {

        btn.classList.toggle('active', btn.dataset.type === type);

    });

    updateTable();

}

// Toggle student selection

function toggleStudent(index) {

    qualifiedStudents[index].selected = !qualifiedStudents[index].selected;

    const studentKey = qualifiedStudents[index].studentKey || getStudentKey(qualifiedStudents[index]);

    if (qualifiedStudents[index].selected) {
        selectedStudentKeys.add(studentKey);
    } else {
        selectedStudentKeys.delete(studentKey);
    }

    updateSelectAllState();

}

// Toggle select all

function toggleSelectAll() {

    const selectAll = document.getElementById('selectAll').checked;

    getDisplayedQualifiedStudents().forEach(s => {
        s.selected = selectAll;
        const studentKey = s.studentKey || getStudentKey(s);
        if (selectAll) {
            selectedStudentKeys.add(studentKey);
        } else {
            selectedStudentKeys.delete(studentKey);
        }
    });

    updateTable();

}

function updateSelectAllState() {

    const selectAll = document.getElementById('selectAll');

    if (!selectAll) return;

    const displayedStudents = getDisplayedQualifiedStudents();

    if (displayedStudents.length === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        return;
    }

    const selectedCount = displayedStudents.filter(student => student.selected).length;

    selectAll.checked = selectedCount === displayedStudents.length;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < displayedStudents.length;

}

// Toggle thresholds visibility

function toggleThresholds() {

    const content = document.getElementById('thresholdsContent');

    const toggle = document.getElementById('thresholdsToggle');

    if (content.style.display === 'none') {

        content.style.display = 'grid';

        toggle.textContent = '▼';

    } else {

        content.style.display = 'none';

        toggle.textContent = '▶';

    }

}

// Preview certificate
function previewCertificate(index) {
    const student = qualifiedStudents[index];
    const html = generateCertificateHTML([student]);
    const preview = window.open('', '_blank', 'width=1000,height=700');
    preview.document.write(html);
    preview.document.close();
}

// Generate certificate HTML


// Generate @font-face declarations for all used fonts in print (using embedded base64)
function generateFontFaces() {
    const usedFonts = new Set([
        currentFontSettings.header,
        currentFontSettings.title,
        currentFontSettings.body,
        'Tajawal' // always include fallback
    ]);

    return Array.from(usedFonts).map(fontName => {
        const font = AVAILABLE_FONTS.find(f => f.name === fontName);
        if (!font) return '';
        // Use base64 embedded data for reliable print rendering
        const b64 = (typeof FONT_BASE64_DATA !== 'undefined') ? FONT_BASE64_DATA[fontName] : null;
        if (b64) {
            return `@font-face {
            font-family: '${font.name}';
            src: url('data:font/ttf;base64,${b64}') format('truetype');
        }`;
        }
        // Fallback to relative path
        return `@font-face {
            font-family: '${font.name}';
            src: url('../../assets/fonts/${font.file}') format('truetype');
        }`;
    }).join('\n        ');
}

function generateCertificateHTML(students) {

    const settings = institutionSettings;

    const trimester = document.getElementById('trimesterSelect').value;

    const year = document.getElementById('yearSelect')?.value || settings.schoolYear || '';

    const today = new Date().toLocaleDateString('ar-DZ');

    const templateId = document.getElementById('templateSelect').value;

    const useBackground = templateId !== 'default' && templateId !== 'ornate';

    const isSecondary = settings.educationStage === 'secondary';

    const periodMap = {
        '1': 'الفصل الأول',
        '2': 'الفصل الثاني',
        '1+2': 'الفصلين الأول والثاني',
        '3': 'الفصل الثالث',
        'annual': 'السنة الدراسية'
    };

    const period = periodMap[trimester] || 'الفصل الأول';

    // ... existing code ...

    const certificatesHTML = students.map((student, idx) => {

        // ... (existing mapping code)

        const template = CERTIFICATE_TEMPLATES[student.certificateType];

        const studentName = student.name || `${student.last_name || ''} ${student.first_name || ''}`.trim() || 'بدون اسم';

        const studentNameMarker = '__CERTIFICATE_STUDENT_NAME__';

        // Prepare text with stream replacement

        let templateText = template.text;

        let text = templateText

            .replace('{institutionName}', settings.institutionName || '................')

            .replace('{studentName}', studentNameMarker)

            .replace('{average}', student.average.toFixed(2))

            .replace('{period}', period)

            .replace('{schoolYear}', year);

        const contentLines = text.split('\n').map((line) => {
            if (line.includes(studentNameMarker)) {
                return '<p class="student-name">' + line.replace(studentNameMarker, studentName) + '</p>';
            }

            if (!line.trim()) {
                return '<p class="certificate-spacer"></p>';
            }

            return '<p>' + line + '</p>';
        }).join('');

        const pageBreak = idx > 0 ? 'page-break-before: always;' : '';

        // Use absolute path for background image

        const backgroundStyle = useBackground ? `background-image: url('../../assets/chahada/${templateId}.png'); background-size: 100% 100%; background-repeat: no-repeat;` : '';

        const innerClass = useBackground ? 'with-background' : '';

        const frameClass = templateId === 'ornate' ? 'ornate' : '';

        // Check if colored background is enabled for default/ornate template

        const useColoredBackground = document.getElementById('coloredBackground')?.checked ?? true;

        const noColoredBg = !useBackground && !useColoredBackground;

        return `

            <div class="certificate-page template-${templateId} ${noColoredBg ? 'no-color-bg' : ''}" style="${pageBreak} ${backgroundStyle}">

                ${!useBackground ? `

                <!-- Decorative Frame -->

                <div class="certificate-frame ${frameClass} ${noColoredBg ? 'no-bg-color' : ''}">

                    <div class="corner-decoration corner-tl"></div>

                    <div class="corner-decoration corner-tr"></div>

                    <div class="corner-decoration corner-bl"></div>

                    <div class="corner-decoration corner-br"></div>

                    ${templateId === 'ornate' ? `

                    <div class="side-decoration side-left"></div>

                    <div class="side-decoration side-right"></div>

                    <div class="side-decoration side-top"></div>

                    <div class="side-decoration side-bottom"></div>

                    ` : ''}

                </div>

                ` : ''}

                <!-- Certificate Content -->

                <div class="certificate-inner ${innerClass}">

                    ${!useBackground ? `

                    <div class="certificate-header">

                        <div class="header-center">

                            <div class="republic">الجمهورية الجزائرية الديمقراطية الشعبية</div>

                            <div class="ministry">وزارة التربية الوطنية</div>

                        </div>

                        <div class="header-row">

                            <div class="header-right">

                                <div>المؤسسة: ${settings.institutionName || '................'}</div>

                            </div>

                            <div class="header-left">

                                <div>مديرية التربية لولاية ${settings.wilaya || '................'}</div>

                            </div>

                        </div>

                    </div>

                    ` : ''}

                    <div class="certificate-title">

                        <div class="ornament-container">

                            <span class="ornament-icon icon-diamond"></span>

                            <span class="ornament-icon icon-diamond" style="transform: scale(1.2);"></span>

                            <span class="ornament-icon icon-diamond"></span>

                        </div>

                        <div class="title-text">شهادة ${template.title}</div>

                        <div class="title-underline"></div>

                        <div class="ornament-container" style="margin-top: 5px;">

                            <span class="ornament-icon icon-diamond"></span>

                            <span class="ornament-icon icon-diamond" style="transform: scale(1.2);"></span>

                            <span class="ornament-icon icon-diamond"></span>

                        </div>

                    </div>

                    <div class="certificate-content">

                        ${contentLines}

                    </div>

                    <div class="student-info">

                        <div>المستوى: ${formatLevel(student.level)}</div>

                        ${isSecondary && student.stream ? `<div>الشعبة: ${getStreamName(student.stream)}</div>` : ''}

                        <div>القسم: ${student.class || ''}</div>

                    </div>

                    <div class="certificate-footer" style="justify-content: flex-end; text-align: center;">
                        <div class="footer-signature">
                            <div style="margin-bottom: 10px;">حرر بـ: ${settings.municipality || '................'} في: ${today}</div>
                            المدير
                        </div>
                    </div>

                </div>

            </div>

        `;

    }).join('');

    return `<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

    <meta charset="UTF-8">

    <title>الشهادات التقديرية</title>

    <style>

        ${generateFontFaces()}

        .title-text {
            font-family: '${currentFontSettings.title}', 'Tajawal', sans-serif;
            font-size: 42pt;
            font-weight: bold;
            color: #8B4513;
            margin: 5px 0;
            text-shadow: 2px 2px 4px rgba(139, 69, 19, 0.2);
        }

        .certificate-header {
            font-family: '${currentFontSettings.header}', 'Tajawal', sans-serif;
            text-align: center;
            font-weight: bold;
            color: #333;
            margin-bottom: 15px;
        }

        .header-center {
            margin-bottom: 10px;
        }

        .republic {
            font-size: 16pt;
            margin-bottom: 3px;
        }

        .ministry {
            font-size: 14pt;
        }

        .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 20px;
            font-size: 13pt;
        }


        /* Ornament Styles */

        .ornament-container {

            display: flex;

            align-items: center;

            justify-content: center;

            gap: 15px;

            margin: 5px 0;

        }

        .ornament-icon {

            width: 20px;

            height: 20px;

            background-size: contain;

            background-repeat: no-repeat;

            background-position: center;

            display: inline-block;

        }

        .icon-diamond {

            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d4af37'%3E%3Cpath d='M12 2L22 12L12 22L2 12Z'/%3E%3C/svg%3E");

            width: 12px;

            height: 12px;

        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {

            font-family: '${currentFontSettings.body}', 'Tajawal', sans-serif;

            background: #f5f5f5;

        }

        .certificate-page {

            width: 297mm;

            height: 209mm;

            padding: 8mm;

            background: white;

            margin: 0 auto 20px;

            box-shadow: 0 4px 20px rgba(0,0,0,0.1);

            position: relative;

            overflow: hidden;

            page-break-inside: avoid;

        }

        .certificate-page.template-ornate {
            background:
                radial-gradient(circle at center, rgba(212, 175, 55, 0.12) 0%, rgba(212, 175, 55, 0.03) 24%, transparent 52%),
                linear-gradient(135deg, #fffdf8 0%, #fff8ec 48%, #fffefb 100%);
        }

        .certificate-page.template-ornate::before {
            content: '';
            position: absolute;
            inset: 34mm 88mm 44mm;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cg fill='none' stroke='%23d4af37' stroke-width='3' opacity='0.9'%3E%3Ccircle cx='120' cy='120' r='72'/%3E%3Ccircle cx='120' cy='120' r='48'/%3E%3Cpath d='M120 36l14 28 31 4-22 21 5 31-28-15-28 15 5-31-22-21 31-4z'/%3E%3Cpath d='M120 204l14-28 31-4-22-21 5-31-28 15-28-15 5 31-22 21 31 4z'/%3E%3Cpath d='M36 120l28-14 4-31 21 22 31-5-15 28 15 28-31-5-21 22-4-31z'/%3E%3Cpath d='M204 120l-28-14-4-31-21 22-31-5 15 28-15 28 31-5 21 22 4-31z'/%3E%3C/g%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: center;
            background-size: contain;
            opacity: 0.08;
            pointer-events: none;
        }

        .certificate-page.template-ornate::after {
            content: '';
            position: absolute;
            top: 16mm;
            left: 18mm;
            right: 18mm;
            bottom: 16mm;
            border-radius: 20px;
            border: 1px solid rgba(123, 68, 43, 0.12);
            pointer-events: none;
        }

        /* Default Frame */

        .certificate-frame {

            position: absolute;

            top: 8mm;

            left: 8mm;

            right: 8mm;

            bottom: 8mm;

            border: 3px solid #8B4513;

            background: linear-gradient(to bottom, #FFFEF7 0%, #FFF8E7 100%);

        }

        /* Ornate Frame Styles - Premium Royal Design */
        .certificate-frame.ornate {
            border: 10px solid #7b442b;
            border-radius: 22px;
            background:
                linear-gradient(180deg, rgba(255, 252, 245, 0.97) 0%, rgba(255, 248, 232, 0.96) 55%, rgba(255, 253, 247, 0.98) 100%);
            box-shadow:
                inset 0 0 0 2px rgba(255, 255, 255, 0.95),
                inset 0 0 0 7px rgba(212, 175, 55, 0.88),
                inset 0 0 0 15px rgba(123, 68, 43, 0.14),
                inset 0 0 42px rgba(212, 175, 55, 0.16),
                0 18px 38px rgba(123, 68, 43, 0.12);
        }
        /* Inner patterned border */
        .certificate-frame.ornate::before {
            content: '';
            position: absolute;
            top: 13px; left: 13px; right: 13px; bottom: 13px;
            border: 1.5px solid rgba(212, 175, 55, 0.78);
            border-radius: 16px;
            background:
                radial-gradient(circle at center, rgba(212, 175, 55, 0.18), transparent 58%),
                repeating-linear-gradient(45deg, transparent 0 12px, rgba(212, 175, 55, 0.16) 12px 13px),
                repeating-linear-gradient(-45deg, transparent 0 12px, rgba(123, 68, 43, 0.1) 12px 13px);
            opacity: 0.28;
            z-index: 0;
            pointer-events: none;
        }
        /* Middle decorative border */
        .certificate-frame.ornate::after {
            content: '';
            position: absolute;
            top: 24px; left: 24px; right: 24px; bottom: 24px;
            border: 2px solid rgba(123, 68, 43, 0.52);
            border-radius: 12px;
            box-shadow: inset 0 0 0 1px rgba(212, 175, 55, 0.42);
            z-index: 1;
        }
        /* Corner Ornaments */
        .certificate-frame.ornate .corner-decoration {
            width: 92px;
            height: 92px;
            background: linear-gradient(135deg, #6f3923 0%, #9b5a30 50%, #d4af37 100%);
            position: absolute;
            z-index: 2;
            clip-path: polygon(0 0, 100% 0, 0 100%);
            filter: drop-shadow(0 6px 12px rgba(111, 57, 35, 0.22));
        }
        .certificate-frame.ornate .corner-decoration::before {
            content: '';
            position: absolute;
            inset: 10px;
            border-top: 2px solid rgba(255, 248, 228, 0.82);
            border-left: 2px solid rgba(255, 248, 228, 0.82);
            opacity: 0.9;
        }
        .certificate-frame.ornate .corner-decoration::after {
            content: '';
            position: absolute;
            top: 14px; left: 14px;
            width: 44px; height: 44px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d4af37'%3E%3Cpath d='M12 2C9 7 4 9 4 14C4 18.4 7.6 22 12 22C16.4 22 20 18.4 20 14C20 9 15 7 12 2ZM12 20C9.8 20 8 17.3 8 14C8 11.5 10.5 10 12 6C13.5 10 16 11.5 16 14C16 17.3 14.2 20 12 20Z'/%3E%3C/svg%3E");
            background-size: contain;
            background-repeat: no-repeat;
        }
        .certificate-frame.ornate .corner-tl {
            top: 0; left: 0;
        }
        .certificate-frame.ornate .corner-tr {
            top: 0; right: 0;
            transform: rotate(90deg);
        }
        .certificate-frame.ornate .corner-br {
            bottom: 0; right: 0;
            transform: rotate(180deg);
        }
        .certificate-frame.ornate .corner-bl {
            bottom: 0; left: 0;
            transform: rotate(270deg);
        }
        /* Side Ornaments */
        .certificate-frame.ornate .side-decoration {
            position: absolute;
            background: linear-gradient(180deg, #f0d58a 0%, #d4af37 50%, #9b5a30 100%);
            z-index: 2;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .certificate-frame.ornate .side-decoration::before {
            content: '\\2726';
            color: #7b442b;
            font-size: 14px;
            width: 24px;
            height: 24px;
            line-height: 24px;
            text-align: center;
            background: linear-gradient(135deg, #fff7dc, #efcb66);
            border: 1px solid rgba(123, 68, 43, 0.22);
            border-radius: 50%;
            box-shadow:
                0 3px 8px rgba(123, 68, 43, 0.12),
                inset 0 0 0 1px rgba(255, 255, 255, 0.65);
        }
        .certificate-frame.ornate .side-top {
            top: -6px; left: 50%; transform: translateX(-50%);
            width: 180px; height: 10px;
            border-radius: 0 0 14px 14px;
            border: 2px solid #7b442b;
            border-top: none;
        }
        .certificate-frame.ornate .side-bottom {
            bottom: -6px; left: 50%; transform: translateX(-50%);
            width: 180px; height: 10px;
            border-radius: 14px 14px 0 0;
            border: 2px solid #7b442b;
            border-bottom: none;
        }
        .certificate-frame.ornate .side-left,
        .certificate-frame.ornate .side-right {
            top: 50%;
            transform: translateY(-50%);
            width: 10px;
            height: 92px;
            border-radius: 999px;
            border: 2px solid rgba(123, 68, 43, 0.78);
        }
        .certificate-frame.ornate .side-left {
            left: -6px;
        }
        .certificate-frame.ornate .side-right {
            right: -6px;
        }
        /* No colored background */

        .certificate-frame.no-bg-color {

            background: white !important;

        }

        .certificate-frame:not(.ornate)::before {

            content: '';

            position: absolute;

            top: 5px;

            left: 5px;

            right: 5px;

            bottom: 5px;

            border: 2px solid #D4AF37;

            border-radius: 3px;

        }

        .certificate-frame:not(.ornate)::after {

            content: '';

            position: absolute;

            top: 12px;

            left: 12px;

            right: 12px;

            bottom: 12px;

            border: 1px dashed #C4A052;

        }

        /* Corner Decorations (Default) */

        .certificate-frame:not(.ornate) .corner-decoration {

            position: absolute;

            width: 60px;

            height: 60px;

            border: 4px solid #D4AF37;

            background: transparent;

        }

        .certificate-frame:not(.ornate) .corner-tl {

            top: 18px; left: 18px;

            border-right: none; border-bottom: none;

            border-top-left-radius: 8px;

        }

        .certificate-frame:not(.ornate) .corner-tr {

            top: 18px; right: 18px;

            border-left: none; border-bottom: none;

            border-top-right-radius: 8px;

        }

        .certificate-frame:not(.ornate) .corner-bl {

            bottom: 18px; left: 18px;

            border-right: none; border-top: none;

            border-bottom-left-radius: 8px;

        }

        .certificate-frame:not(.ornate) .corner-br {

            bottom: 18px; right: 18px;

            border-left: none; border-top: none;

            border-bottom-right-radius: 8px;

        }

        /* Corner Inner Decorations (Default) */

        .certificate-frame:not(.ornate) .corner-decoration::before {

            content: '✦';

            position: absolute;

            font-size: 14pt;

            color: #D4AF37;

        }

        .certificate-frame:not(.ornate) .corner-tl::before { top: -5px; left: -5px; }

        .certificate-frame:not(.ornate) .corner-tr::before { top: -5px; right: -5px; }

        .certificate-frame:not(.ornate) .corner-bl::before { bottom: -5px; left: -5px; }

        .certificate-frame:not(.ornate) .corner-br::before { bottom: -5px; right: -5px; }

        /* Inner Content */

        .certificate-inner {

            position: relative;

            z-index: 1;

            padding: 6mm 12mm 5mm 12mm;

            height: 100%;

            display: flex;

            flex-direction: column;

        }

        /* With Background Template - move content up */

        .certificate-inner.with-background {

            padding-top: 15mm;

            justify-content: flex-start;

        }

        .certificate-title {

            text-align: center;

            margin: 5px 0;

        }

        .certificate-inner.with-background .certificate-title {

            margin-top: 5mm;

        }

        .certificate-inner.with-background .student-info {

            background: transparent;

            border: none;

        }

        .certificate-content {

            flex: 1;

            display: flex;

            flex-direction: column;

            justify-content: center;

            align-items: center;

            text-align: center;

            padding: 5px 50px;

        }

        .certificate-inner.with-background .certificate-content {

            flex: 1;

            display: flex;

            flex-direction: column;

            justify-content: center;

            align-items: center;

            text-align: center;

            padding: 5px 50px;

        }

        .certificate-content p {

            font-family: '${currentFontSettings.body}', 'Tajawal', sans-serif;

            font-size: 16pt;

            line-height: 1.3;

            margin: 1px 0;

        }

        .certificate-content p.certificate-spacer {
            min-height: 0.85em;
        }

        .certificate-content p.student-name {
            font-family: 'Almaalim', 'Tajawal', sans-serif;
            font-size: 28pt;
            font-weight: bold;
            color: #8B4513;
            text-shadow: 1px 1px 3px rgba(139, 69, 19, 0.3);
            margin: 10px 0;
            padding: 5px 60px;
            display: inline-block;
            position: relative;
            background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.15) 20%, rgba(212, 175, 55, 0.15) 80%, transparent);
            border-radius: 15px;
            border-bottom: 2px solid #D4AF37;
        }

        .certificate-content p.student-name::before,
        .certificate-content p.student-name::after {
            content: '';
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 50px;
            height: 20px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 20'%3E%3Cpath d='M0,10 Q12,2 25,10 Q12,18 0,10 Z' fill='%23D4AF37'/%3E%3Cpath d='M5,10 Q12,6 19,10 Q12,14 5,10 Z' fill='%23FFFEF7'/%3E%3Ccircle cx='34' cy='10' r='2.5' fill='%238B4513'/%3E%3Ccircle cx='42' cy='10' r='1.5' fill='%23D4AF37'/%3E%3Ccircle cx='48' cy='10' r='1' fill='%238B4513'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: center;
        }

        .certificate-content p.student-name::before {
            right: 5px;
        }

        .certificate-content p.student-name::after {
            left: 5px;
            transform: translateY(-50%) rotate(180deg);
        }

        .student-info {

            display: flex;

            justify-content: center;

            gap: 50px;

            padding: 5px;

            background: transparent;

            margin: -5px 50px 10px 50px;

            font-size: 13pt;

            font-weight: bold;

        }

        .certificate-footer {

            display: flex;

            justify-content: flex-end;

            align-items: flex-end;

            padding: 2px 30px;

            margin-top: auto;
            
            margin-bottom: 25px;

        }

        .footer-date {

            font-size: 11pt;

        }

        .footer-signature {

            text-align: center;

            font-size: 12pt;

            min-width: 150px;

        }

        .certificate-page.template-ornate .certificate-inner {
            padding: 8.5mm 14mm 26mm 14mm;
        }
        .certificate-page.template-ornate .certificate-header {
            margin-bottom: 12px;
            color: #5f3622;
        }
        .certificate-page.template-ornate .header-center {
            margin-bottom: 10px;
            position: relative;
            padding-top: 8px;
        }
        .certificate-page.template-ornate .header-center::before {
            content: '\\2726';
            position: absolute;
            top: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 28px;
            height: 28px;
            line-height: 28px;
            border-radius: 50%;
            background: linear-gradient(135deg, #f0d58a, #d4af37);
            color: #6f3923;
            font-size: 13px;
            box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.16);
        }
        .certificate-page.template-ornate .republic {
            font-size: 17pt;
            letter-spacing: 0.2px;
        }
        .certificate-page.template-ornate .ministry {
            font-size: 13pt;
            color: #7b533f;
        }
        .certificate-page.template-ornate .header-row {
            gap: 12px;
            padding: 0;
        }
        .certificate-page.template-ornate .header-row > div {
            flex: 1;
            min-width: 0;
            padding: 8px 14px;
            border-radius: 14px;
            background: linear-gradient(180deg, rgba(255, 251, 242, 0.96), rgba(252, 241, 214, 0.96));
            border: 1px solid rgba(212, 175, 55, 0.62);
            box-shadow: inset 0 0 0 1px rgba(123, 68, 43, 0.08);
        }
        .certificate-page.template-ornate .certificate-title {
            margin: 0 0 5px;
            position: relative;
        }
        .certificate-page.template-ornate .certificate-title::before,
        .certificate-page.template-ornate .certificate-title::after {
            content: '';
            position: absolute;
            top: 50%;
            width: 58px;
            height: 2px;
            background: linear-gradient(90deg, transparent, #d4af37, #7b442b);
        }
        .certificate-page.template-ornate .certificate-title::before {
            right: calc(50% + 120px);
        }
        .certificate-page.template-ornate .certificate-title::after {
            left: calc(50% + 120px);
            transform: scaleX(-1);
        }
        .certificate-page.template-ornate .ornament-container {
            gap: 12px;
        }
        .certificate-page.template-ornate .title-text {
            display: inline-block;
            min-width: 230px;
            padding: 8px 28px 11px;
            border-radius: 999px;
            background: linear-gradient(180deg, rgba(255, 252, 245, 0.96), rgba(248, 233, 194, 0.96));
            border: 1px solid rgba(212, 175, 55, 0.76);
            box-shadow:
                0 10px 22px rgba(123, 68, 43, 0.12),
                inset 0 0 0 1px rgba(255, 255, 255, 0.8);
            font-size: 40pt;
            color: #7b442b;
            text-shadow: 0 2px 0 rgba(255, 255, 255, 0.72);
        }
        .title-underline {
            width: 176px;
            height: 8px;
            margin: 4px auto 0;
            border-radius: 999px;
            background:
                linear-gradient(90deg, transparent 0%, rgba(123, 68, 43, 0.12) 16%, rgba(212, 175, 55, 0.95) 50%, rgba(123, 68, 43, 0.12) 84%, transparent 100%);
        }
        .certificate-page.template-ornate .certificate-content {
            padding: 0 36px;
        }
        .certificate-page.template-ornate .certificate-content p {
            max-width: 88%;
            font-size: 15.6pt;
            line-height: 1.26;
            color: #5c3926;
        }
        .certificate-page.template-ornate .certificate-content p.student-name {
            font-size: 28pt;
            color: #6d311c;
            padding: 6px 68px;
            margin: 6px 0;
            background: linear-gradient(90deg, rgba(255, 248, 228, 0.25), rgba(212, 175, 55, 0.28) 18%, rgba(255, 248, 228, 0.92) 50%, rgba(212, 175, 55, 0.28) 82%, rgba(255, 248, 228, 0.25));
            border: 1px solid rgba(212, 175, 55, 0.72);
            box-shadow:
                0 10px 26px rgba(123, 68, 43, 0.1),
                inset 0 0 0 1px rgba(255, 255, 255, 0.76);
        }
        .certificate-page.template-ornate .student-info {
            gap: 10px;
            flex-wrap: wrap;
            margin: 0 26px 2px;
        }
        .certificate-page.template-ornate .student-info > div {
            min-width: 140px;
            padding: 8px 14px;
            border-radius: 999px;
            background: linear-gradient(180deg, rgba(255, 250, 240, 0.98), rgba(247, 233, 196, 0.96));
            border: 1px solid rgba(212, 175, 55, 0.72);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.7);
            color: #6a3b23;
        }
        .certificate-page.template-ornate .certificate-footer {
            position: absolute;
            left: calc(28px + 10mm);
            right: calc(28px + 20mm);
            bottom: calc(12px + 14mm);
            margin: 0;
            padding: 0;
        }
        .certificate-page.template-ornate .footer-signature {
            min-width: 240px;
            padding: 14px 22px 10px;
            border-radius: 18px 18px 8px 8px;
            background: linear-gradient(180deg, rgba(255, 252, 245, 0.96), rgba(247, 234, 200, 0.98));
            border: 1px solid rgba(212, 175, 55, 0.82);
            color: #603824;
            box-shadow:
                0 12px 24px rgba(123, 68, 43, 0.1),
                inset 0 0 0 1px rgba(255, 255, 255, 0.72);
            position: relative;
        }
        .certificate-page.template-ornate .footer-signature::before {
            content: '';
            position: absolute;
            top: 10px;
            left: 22px;
            right: 22px;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.9), transparent);
        }

        @media print {

            @page {

                size: A4 landscape;

                margin: 0;

            }

            body {

                background: white;

                margin: 0;

                padding: 0;

            }

            .certificate-page {

                box-shadow: none;

                margin: 0;

                width: 297mm;

                height: 209mm;

                page-break-after: always;

                page-break-inside: avoid;

                overflow: hidden;

                -webkit-print-color-adjust: exact !important;

                print-color-adjust: exact !important;

                color-adjust: exact !important;

            }

            .certificate-page:last-child {

                page-break-after: avoid;

            }

        }

    </style>

\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

<body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

    ${certificatesHTML}

    <script>

        window.onload = function() {

            // auto-print removed

        };

    </script>

\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

</html>`;

}

// Print selected certificates
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

function printSelectedCertificates() {
    if (blockTrialPrint()) return;
    const selected = qualifiedStudents.filter(s => s.selected);
    if (selected.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'يرجى تحديد تلميذ واحد على الأقل'
        });
        return;
    }
    const html = generateCertificateHTML(selected);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
}

// Print all certificates
function printAllCertificates() {
    if (blockTrialPrint()) return;
    if (qualifiedStudents.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'تنبيه',
            text: 'لا يوجد تلاميذ مؤهلون للطباعة'
        });
        return;
    }
    const html = generateCertificateHTML(qualifiedStudents);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
}

// Show no data message

// Show no data message

function showNoData(message) {

    document.getElementById('studentsTableBody').innerHTML =

        `<tr><td colspan="7" class="no-data">${message}</td></tr>`;

}

// Helper: Check stage and populate streams

function checkStageAndPopulateStreams() {

    const streamGroup = document.getElementById('streamFilterGroup');

    if (institutionSettings.educationStage === 'secondary') {

        if (streamGroup) streamGroup.style.display = 'block';

        populateStreams();

    } else {

        if (streamGroup) streamGroup.style.display = 'none';

    }

}

// Helper: Populate streams

function populateStreams() {

    const streamSelect = document.getElementById('streamSelect');

    if (!streamSelect) return;

    const level = document.getElementById('levelSelect').value;

    let streams = [];

    // Filter students by level first if selected

    let relevantStudents = allStudents;

    if (level) {

        relevantStudents = allStudents.filter(s => s.level === level);

    }

    const uniqueStreams = new Set(relevantStudents.map(s => s.stream).filter(Boolean));

    // Sort by Display Name (Arabic)
    streams = Array.from(uniqueStreams).sort((a, b) => {
        return getStreamName(a).localeCompare(getStreamName(b), 'ar');
    });

    streamSelect.innerHTML = '<option value="">-- كل الشعب --</option>';

    streams.forEach(stream => {
        const option = document.createElement('option');
        option.value = stream;
        option.textContent = getStreamName(stream); // Use helper for translation
        streamSelect.appendChild(option);
    });

}

// Helper: Get Stream Name


function formatLevel(level) {
    if (!level) return '';
    return level
        .replace(/1/g, 'أولى')
        .replace(/2/g, 'ثانية')
        .replace(/3/g, 'ثالثة')
        .replace(/4/g, 'رابعة');
}

function getStreamName(code) {

    if (!code) return '';

    const map = {

        'common_arts': 'جذع مشترك آداب',

        'common_science': 'جذع مشترك علوم',

        'science': 'علوم تجريبية',

        'math': 'رياضيات',

        'math_tech': 'تقني رياضي',

        'tech_math': 'تقني رياضي',

        'tech_math_civil': 'تقني رياضي (هندسة مدنية)',

        'tech_math_elec': 'تقني رياضي (هندسة كهربائية)',

        'tech_math_mech': 'تقني رياضي (هندسة ميكانيكية)',

        'tech_math_methods': 'تقني رياضي (هندسة الطرائق)',

        'languages': 'لغات أجنبية',

        'literature': 'آداب وفلسفة',

        'arts': 'آداب وفلسفة',

        'management': 'تسيير واقتصاد',

        'sport': 'رياضة'

    };

    return map[code.toLowerCase()] || map[code] || code;

}

function getDisplayedQualifiedStudents() {
    if (currentFilter === 'all') {
        return qualifiedStudents;
    }

    return qualifiedStudents.filter((student) => student.certificateType === currentFilter);
}

async function exportCertificatesToExcel() {
    if (!window.ExcelExportHelper) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'مكتبة التصدير غير متاحة حالياً.' });
        return;
    }

    const displayStudents = getDisplayedQualifiedStudents();
    if (!displayStudents.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد شهادات جاهزة للتصدير.' });
        return;
    }

    const isSecondaryStage = institutionSettings.educationStage === 'secondary';
    const typeLabels = {
        excellence: 'امتياز',
        congratulation: 'تهنئة',
        encouragement: 'تشجيع',
        honor: 'لوحة شرف'
    };

    const headers = ['#', 'اسم التلميذ'];
    if (isSecondaryStage) {
        headers.push('الشعبة');
    }
    headers.push('القسم', 'المعدل', 'نوع الشهادة');

    const rows = displayStudents.map((student, index) => {
        const row = [
            index + 1,
            student.name || `${student.last_name || ''} ${student.first_name || ''}`.trim()
        ];

        if (isSecondaryStage) {
            row.push(getStreamName(student.stream));
        }

        row.push(
            `${student.level || ''} - ${student.class || ''}`,
            typeof student.average === 'number' ? student.average.toFixed(2) : '',
            typeLabels[student.certificateType] || student.certificateType || ''
        );

        return row;
    });

    const currentTypeLabel = document.querySelector('.tab-btn.active')?.textContent?.trim() || 'الكل';
    const trimesterText = document.getElementById('trimesterSelect')?.selectedOptions?.[0]?.textContent || '';
    const levelText = document.getElementById('levelSelect')?.selectedOptions?.[0]?.textContent || '';
    const classText = document.getElementById('classSelect')?.selectedOptions?.[0]?.textContent || '';

    await ExcelExportHelper.exportWorkbook({
        fileName: `الشهادات_التقديرية_${ExcelExportHelper.dateStamp()}.xlsx`,
        sheets: [{
            sheetName: 'الشهادات',
            title: 'الشهادات التقديرية',
            metaRows: [
                `المؤسسة: ${institutionSettings.institutionName || ''}`,
                `السنة الدراسية: ${document.getElementById('yearSelect')?.value || institutionSettings.schoolYear || ''}`,
                `الفصل: ${trimesterText}`,
                `النوع المعروض: ${currentTypeLabel}`,
                `المستوى: ${levelText}${classText && !classText.includes('--') ? ` | القسم: ${classText}` : ''}`,
                `عدد التلاميذ: ${displayStudents.length}`
            ],
            headers,
            rows
        }]
    });
}

