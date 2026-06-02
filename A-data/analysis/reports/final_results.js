/**

 * Final Results Page - JavaScript Logic

 * Handles Excel import, data storage, classification, and statistics

 */

// Global data store

// Global data store

let studentsData = [];

let classesImported = [];

let institutionSettings = {}; // Global settings

let signatureSettings = {}; // Global signature settings

let annualLinkCache = null;
let activeAcademicYear = null;

function normalizeAcademicYearId(value) {
    if (!value) return null;
    const raw = String(value).trim();
    const matches = raw.match(/20\d{2}/g);
    if (!matches || matches.length < 2) return null;
    const y1 = parseInt(matches[0], 10);
    const y2 = parseInt(matches[1], 10);
    return Math.max(y1, y2) + '/' + Math.min(y1, y2);
}

function getCurrentAnnualAcademicYear() {
    return normalizeAcademicYearId(institutionSettings.currentAcademicYear || institutionSettings.schoolYear || DB.getCurrentAcademicYear());
}

function getActiveAnnualAcademicYear() {
    return normalizeAcademicYearId(activeAcademicYear || getCurrentAnnualAcademicYear());
}

function getAcademicYearOptions() {
    const current = getCurrentAnnualAcademicYear();
    const match = current && current.match(/(20\d{2})\/(20\d{2})/);
    if (!match) return [current || DB.getCurrentAcademicYear()];

    const latestYear = parseInt(match[1], 10);
    const options = [];
    for (let offset = -2; offset <= 2; offset++) {
        const upper = latestYear + offset;
        options.push(upper + '/' + (upper - 1));
    }
    return options;
}

function populateImportAcademicYearSelect() {
    const select = document.getElementById('importAcademicYear');
    if (!select) return;

    const selectedValue = normalizeAcademicYearId(select.value) || getCurrentAnnualAcademicYear();
    const options = getAcademicYearOptions();
    select.innerHTML = options.map(function (year) {
        return `<option value="${year}">${year.replace('/', ' - ')}</option>`;
    }).join('');
    select.value = options.indexOf(selectedValue) !== -1 ? selectedValue : getCurrentAnnualAcademicYear();
}

function getSelectedImportAcademicYear() {
    const select = document.getElementById('importAcademicYear');
    return normalizeAcademicYearId(select && select.value) || getCurrentAnnualAcademicYear();
}

function syncToolbarControls() {

    populateImportAcademicYearSelect();

    const directedInput = document.getElementById('directedBirthYearInput');

    if (directedInput) {

        directedInput.value = getDirectedThreshold();

    }



    const stage = institutionSettings.educationStage || 'middle';
    const ageField = document.getElementById('ageDirectionField');
    const manualField = document.getElementById('manualDirectionField');
    if (ageField && manualField) {
        if (stage === 'secondary') {
            ageField.style.display = 'none';
            manualField.style.display = 'flex';
        } else {
            ageField.style.display = 'flex';
            manualField.style.display = 'none';
        }
    }

}

function openImportModal() {
    syncToolbarControls();
    const modal = document.getElementById('importModal');
    if (modal) modal.classList.add('active');
    if (window.IconManager) IconManager.render();
}

function closeImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) modal.classList.remove('active');
}

function handleImportModalOverlay(event) {
    if (event && event.target && event.target.id === 'importModal') {
        closeImportModal();
    }
}

async function handleDirectedYearChange(value) {
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue) || parsedValue < 1990 || parsedValue > 2035) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى إدخال سنة ميلاد صحيحة.' });
        syncToolbarControls();
        return;
    }

    institutionSettings.directedBirthYear = parsedValue;
    await DB.saveSettings(institutionSettings);
    renderAll();
}

function refreshImportedClasses() {
    classesImported = [...new Set(
        (studentsData || [])
            .map(s => String(s.className || '').trim())
            .filter(Boolean)
    )];
}

function normalizeAnnualIdentifier(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value).toString();
    }

    const raw = String(value).trim().replace(/\s+/g, '');
    if (!raw) return '';
    if (/^\d+(?:\.0+)?$/.test(raw)) {
        return raw.replace(/\.0+$/, '');
    }

    const parsedScientific = parseFloat(raw.replace(',', '.'));
    if (Number.isFinite(parsedScientific) && (/e[+-]?\d+/i.test(raw) || /^\d+\.\d+$/.test(raw))) {
        return Math.trunc(parsedScientific).toString();
    }

    return raw;
}

function parseAnnualNumeric(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = parseFloat(String(value).trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
}

function isAnnualNumericLike(value) {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'number') return Number.isFinite(value);
    return Number.isFinite(parseFloat(String(value).trim().replace(',', '.')));
}

function detectFinalResultsImportLayout(jsonData) {
    const headerRow = jsonData[3] || [];
    const dataRow = (jsonData || []).slice(4).find(row => row && (row[0] || row[1])) || [];
    const headerText = idx => String(headerRow[idx] || '').trim();
    const dataText = idx => String(dataRow[idx] || '').trim();

    const hasShiftedSecondaryHeaders =
        headerText(6).includes('رقم الفوج') &&
        headerText(7).includes('معدل الفصل الأول') &&
        headerText(8).includes('معدل الفصل الثاني') &&
        headerText(9).includes('معدل الفصل الثالث') &&
        headerText(10).includes('المعدل السنوي') &&
        !headerText(11) &&
        dataText(6) &&
        !isAnnualNumericLike(dataRow[6]) &&
        isAnnualNumericLike(dataRow[7]) &&
        isAnnualNumericLike(dataRow[8]) &&
        isAnnualNumericLike(dataRow[9]) &&
        isAnnualNumericLike(dataRow[10]) &&
        isAnnualNumericLike(dataRow[11]);

    const hasAlignedSecondaryHeaders =
        (headerText(6).includes('الشعبة') || headerText(6).includes('الجذع')) &&
        headerText(7).includes('رقم الفوج') &&
        headerText(8).includes('معدل الفصل الأول');

    if (hasShiftedSecondaryHeaders) {
        return {
            kind: 'secondary_shifted',
            id: 0,
            lastName: 1,
            firstName: 2,
            gender: 3,
            birthDate: 4,
            level: 5,
            stream: 6,
            group: 7,
            t1: 8,
            t2: 9,
            t3: 10,
            annual: 11
        };
    }

    if (hasAlignedSecondaryHeaders) {
        return {
            kind: 'secondary_aligned',
            id: 0,
            lastName: 1,
            firstName: 2,
            gender: 3,
            birthDate: 4,
            level: 5,
            stream: 6,
            group: 7,
            t1: 8,
            t2: 9,
            t3: 10,
            annual: 11
        };
    }

    return {
        kind: 'standard',
        id: 0,
        lastName: 1,
        firstName: 2,
        gender: 3,
        birthDate: 4,
        level: 5,
        className: 6,
        t1: 7,
        t2: 8,
        t3: 9,
        annual: 10
    };
}

function normalizeAnnualClassValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim().replace(/^0+(\d)/, '$1');
}

function normalizeAnnualDateValue(value) {
    if (!value || value === '-') return '';
    return String(value).trim().split('T')[0];
}

function cleanAnnualMatchText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F]/g, '')
        .replace(/\s+/g, ' ');
}

function getAnnualStudentFullName(student) {
    return (student.fullName || `${student.lastName || ''} ${student.firstName || ''}`.trim()).trim();
}

function buildAnnualIdentityKey(student) {
    const fullName = cleanAnnualMatchText(
        student.fullName || `${student.lastName || student.last_name || ''} ${student.firstName || student.first_name || ''}`.trim()
    );
    const birthDate = normalizeAnnualDateValue(student.birthDate || student.birth_date || student.dob || '');
    const level = normalizeLevel(student.level || '');
    const className = normalizeAnnualClassValue(student.className || student.class_name || student.class || student.class_number || student.squad || '');
    return `${fullName}|${birthDate}|${level}|${className}`;
}

function buildAnnualNameDobKey(student) {
    const fullName = cleanAnnualMatchText(
        student.fullName || `${student.lastName || student.last_name || ''} ${student.firstName || student.first_name || ''}`.trim()
    );
    const birthDate = normalizeAnnualDateValue(student.birthDate || student.birth_date || student.dob || '');
    return `${fullName}|${birthDate}`;
}

function registerAnnualCacheEntry(targetMap, key, entry) {
    if (!key || targetMap.has(key)) return;
    targetMap.set(key, entry);
}

function buildAnnualLinkCache(resultsRows, studentRows) {
    const byIdentifier = new Map();
    const byIdentity = new Map();
    const byNameDob = new Map();

    function registerEntry(rawEntry) {
        if (!rawEntry) return;

        const entry = {
            student_id: normalizeAnnualIdentifier(rawEntry.student_id || rawEntry.id || rawEntry.reg_number || rawEntry.national_id || ''),
            lastName: rawEntry.last_name || rawEntry.lastName || '',
            firstName: rawEntry.first_name || rawEntry.firstName || '',
            fullName: (rawEntry.fullName || rawEntry.name || `${rawEntry.last_name || rawEntry.lastName || ''} ${rawEntry.first_name || rawEntry.firstName || ''}`.trim()).trim(),
            gender: rawEntry.gender || '',
            birthDate: normalizeAnnualDateValue(rawEntry.birth_date || rawEntry.birthDate || rawEntry.dob || ''),
            birthYear: rawEntry.birthYear || rawEntry.birth_year || extractBirthYear(rawEntry.birth_date || rawEntry.birthDate || rawEntry.dob || ''),
            level: normalizeLevel(rawEntry.level || ''),
            className: normalizeAnnualClassValue(rawEntry.className || rawEntry.class_name || rawEntry.class || rawEntry.class_number || ''),
            stream: rawEntry.stream || '',
            decision: rawEntry.decision || '-'
        };

        registerAnnualCacheEntry(byIdentifier, entry.student_id, entry);
        registerAnnualCacheEntry(byIdentity, buildAnnualIdentityKey(entry), entry);
        registerAnnualCacheEntry(byNameDob, buildAnnualNameDobKey(entry), entry);
    }

    (resultsRows || []).forEach(registerEntry);
    (studentRows || []).forEach(registerEntry);

    return {
        byIdentifier,
        byIdentity,
        byNameDob
    };
}

async function loadAnnualLinkCache(forceReload) {
    if (annualLinkCache && !forceReload) return annualLinkCache;

    const [resultsRows, studentRows] = await Promise.all([
        DB.getResults(true),
        DB.getStudents(false, true)
    ]);

    annualLinkCache = buildAnnualLinkCache(resultsRows || [], studentRows || []);
    return annualLinkCache;
}

function enrichAnnualStudentWithCurrentData(student, linkCache) {
    if (!student) return student;

    const identifier = normalizeAnnualIdentifier(student.student_id || student.id);
    const matched =
        (identifier && linkCache.byIdentifier.get(identifier)) ||
        linkCache.byIdentity.get(buildAnnualIdentityKey(student)) ||
        linkCache.byNameDob.get(buildAnnualNameDobKey(student)) ||
        null;

    if (matched) {
        if (!student.student_id && matched.student_id) student.student_id = matched.student_id;
        if (!student.id && matched.student_id) student.id = matched.student_id;
        if ((!student.lastName || !student.firstName) && (matched.lastName || matched.firstName)) {
            if (!student.lastName) student.lastName = matched.lastName;
            if (!student.firstName) student.firstName = matched.firstName;
        }
        if ((!student.gender || student.gender === 'غير محدد') && matched.gender) student.gender = matched.gender;
        if ((!student.birthDate || student.birthDate === '-') && matched.birthDate) student.birthDate = matched.birthDate;
        if (!student.birthYear && matched.birthYear) student.birthYear = matched.birthYear;
        if (!student.level && matched.level) student.level = matched.level;

        if (!student.className && matched.className) student.className = matched.className;

        if (!student.stream && matched.stream) student.stream = matched.stream;
        
        if ((!student.decision || student.decision === '-') && matched.decision && matched.decision !== '-') student.decision = matched.decision;

    }

    if (!student.id && student.student_id) student.id = student.student_id;
    if (!student.student_id && student.id) student.student_id = student.id;
    if (!student.className && student.squad) student.className = student.squad;
    if (!student.squad && student.className) student.squad = student.className;
    if (!student.birthYear) student.birthYear = extractBirthYear(student.birthDate);
    student.fullName = getAnnualStudentFullName(student);
    student.academic_year = normalizeAcademicYearId(student.academic_year || getCurrentAnnualAcademicYear());

    return student;
}

function mapAnnualResultRowToStudent(row) {
    const student = {
        id: row.student_id || row.id || '',
        student_id: row.student_id || row.id || '',
        lastName: row.lastName || row.last_name || '',
        firstName: row.firstName || row.first_name || '',
        fullName: row.fullName || `${row.lastName || row.last_name || ''} ${row.firstName || row.first_name || ''}`.trim(),
        gender: row.gender || '',
        birthDate: row.birthDate || row.birth_date || '-',
        birthYear: row.birthYear || row.birth_year || extractBirthYear(row.birthDate || row.birth_date || ''),
        level: row.level ? parseInt(row.level, 10) : normalizeLevel(row.level),
        squad: row.className || row.class_name || '',
        className: row.className || row.class_name || '',
        stream: row.stream || '',
        t1: parseFloat(row.t1 !== undefined ? row.t1 : row.t1_avg) || 0,
        t2: parseFloat(row.t2 !== undefined ? row.t2 : row.t2_avg) || 0,
        t3: parseFloat(row.t3 !== undefined ? row.t3 : row.t3_avg) || 0,
        annualAvg: parseFloat(row.annualAvg !== undefined ? row.annualAvg : row.annual_avg) || 0,
        decision: row.decision || '-',
        sourceFile: row.sourceFile || row.source_file || '',
        academic_year: normalizeAcademicYearId(row.academic_year || getCurrentAnnualAcademicYear())
    };

    student.fullName = getAnnualStudentFullName(student);
    return student;
}

function toAnnualResultRecord(student) {
    const lastName = student.lastName || '';
    const firstName = student.firstName || '';
    return {
        student_id: student.student_id || student.id || null,
        academic_year: normalizeAcademicYearId(student.academic_year || getCurrentAnnualAcademicYear()),
        lastName: lastName,
        firstName: firstName,
        fullName: getAnnualStudentFullName(student),
        gender: student.gender || '',
        birthDate: student.birthDate || '',
        birthYear: student.birthYear || extractBirthYear(student.birthDate),
        level: student.level ? parseInt(student.level, 10) : null,
        className: student.className || student.squad || '',
        stream: student.stream || '',
        t1: parseFloat(student.t1) || 0,
        t2: parseFloat(student.t2) || 0,
        t3: parseFloat(student.t3) || 0,
        annualAvg: parseFloat(student.annualAvg) || 0,
        decision: student.decision || '-',
        sourceFile: student.sourceFile || ''
    };
}

function extractAcademicYearFromSheet(jsonData, fileName) {
    const textParts = [];
    for (let i = 0; i < Math.min(jsonData.length, 6); i++) {
        const row = jsonData[i];
        if (row && row.length) {
            textParts.push(row.join(' '));
        }
    }
    textParts.push(fileName || '');
    const joinedText = textParts.join(' ');
    const match = joinedText.match(/(20\d{2})\s*[-/]\s*(20\d{2})/);
    if (match) {
        return normalizeAcademicYearId(match[0]) || getCurrentAnnualAcademicYear();
    }
    return getCurrentAnnualAcademicYear();
}

function getTrialPrintBlockedMessage() {
    return (typeof Auth !== 'undefined' && typeof Auth.getBlockedMessage === 'function')
        ? Auth.getBlockedMessage('print')
        : 'الطباعة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.';
}

function isPrintRestrictedForCurrentUser() {
    return typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted();
}

function blockTrialPrint() {
    if (!isPrintRestrictedForCurrentUser()) return false;

    Swal.fire({
        icon: 'warning',
        title: 'تنبيه',
        text: getTrialPrintBlockedMessage()
    });
    return true;
}

function applyPrintAccessState() {
    const isRestricted = isPrintRestrictedForCurrentUser();
    const message = getTrialPrintBlockedMessage();

    document.querySelectorAll('[data-print-premium="true"]').forEach(btn => {
        btn.disabled = isRestricted;
        btn.style.opacity = isRestricted ? '0.6' : '';
        btn.style.cursor = isRestricted ? 'not-allowed' : '';
        btn.title = isRestricted ? message : '';
        btn.setAttribute('aria-disabled', isRestricted ? 'true' : 'false');
    });
}

// ============================================

// INITIALIZATION

// ============================================

document.addEventListener('DOMContentLoaded', async function () {

    await loadDataFromStorage();

    setupDragAndDrop();
    syncToolbarControls();

    renderAll();
    applyPrintAccessState();

});

async function loadDataFromStorage(targetAcademicYear) {

    try {
        institutionSettings = await DB.getSettings();
        signatureSettings = await DB.get('signatureSettings') || {};
        const annualRows = await DB.getAnnualResults(true) || [];

        let importedYears = [...new Set(annualRows.map(row => normalizeAcademicYearId(row.academic_year || getCurrentAnnualAcademicYear())))].filter(Boolean);
        if (importedYears.length === 0) importedYears = [getCurrentAnnualAcademicYear()];
        importedYears.sort().reverse();

        activeAcademicYear = normalizeAcademicYearId(targetAcademicYear || activeAcademicYear || getCurrentAnnualAcademicYear());
        
        if (!importedYears.includes(activeAcademicYear)) {
            importedYears.unshift(activeAcademicYear);
        }

        const yearSelectNode = document.getElementById('activeAcademicYearSelect');
        if (yearSelectNode) {
            yearSelectNode.innerHTML = importedYears.map(year => 
                `<option value="${year}" ${year === activeAcademicYear ? 'selected' : ''}>${year.replace('/', ' - ')}</option>`
            ).join('');
        }

        studentsData = annualRows
            .filter(row => normalizeAcademicYearId(row.academic_year || getCurrentAnnualAcademicYear()) === activeAcademicYear)
            .map(mapAnnualResultRowToStudent);
        refreshImportedClasses();
        annualLinkCache = null;
        syncToolbarControls();

    } catch (e) {

        console.error('Error loading stored data:', e);

        studentsData = [];

        classesImported = [];

        institutionSettings = {};
        activeAcademicYear = normalizeAcademicYearId(targetAcademicYear || DB.getCurrentAcademicYear());
        syncToolbarControls();

    }

}

async function changeActiveAcademicYear(year) {
    await loadDataFromStorage(year);
    renderAll();
}

async function saveDataToStorage() {
    refreshImportedClasses();
    const records = studentsData.map(toAnnualResultRecord);
    const uniqueYears = [...new Set(records.map(r => r.academic_year).filter(Boolean))];
    const saveOptions = {
        replaceExisting: true
    };

    if (uniqueYears.length === 0) {
        saveOptions.academicYear = getActiveAnnualAcademicYear();
    } else if (uniqueYears.length === 1) {
        saveOptions.academicYear = uniqueYears[0];
    }

    await DB.saveAnnualResults(records, saveOptions);
    annualLinkCache = null;

}

// ============================================

// DRAG & DROP SETUP

// ============================================

function setupDragAndDrop() {

    const dropZone = document.getElementById('dropZone');

    dropZone.addEventListener('dragover', (e) => {

        e.preventDefault();

        dropZone.classList.add('dragover');

    });

    dropZone.addEventListener('dragleave', () => {

        dropZone.classList.remove('dragover');

    });

    dropZone.addEventListener('drop', (e) => {

        e.preventDefault();

        dropZone.classList.remove('dragover');

        const files = e.dataTransfer.files;

        processFiles(files);

    });

}

// ============================================

// FILE HANDLING

// ============================================

function handleFileSelect(event) {

    const files = event.target.files;

    if (files && files.length > 0) {

        processFiles(files);

    }

    event.target.value = ''; // Reset input

}

async function processFiles(files) {

    if (typeof XLSX === 'undefined') {

        Swal.fire({ icon: 'error', title: 'خطأ', text: 'خطأ: مكتبة معالجة Excel غير محملة (XLSX missing).' });

        return;

    }

    const selectedAcademicYear = getSelectedImportAcademicYear();
    if (!selectedAcademicYear) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى تحديد السنة الدراسية قبل بدء الاستيراد.' });
        return;
    }
    const previousAcademicYear = getActiveAnnualAcademicYear();

    const dropZone = document.getElementById('dropZone');

    const originalText = dropZone.innerHTML;

    // Filter valid files

    const validFiles = Array.from(files).filter(f => f.name.endsWith('.xls') || f.name.endsWith('.xlsx'));

    if (validFiles.length === 0) {

        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لم يتم العثور على ملفات Excel صالحة.' });

        return;

    }

    // CLEAR existing data before importing new files

    studentsData = [];

    classesImported = [];

    // UI Feedback for batch processing

    dropZone.innerHTML = `

        <div class="icon"><span data-icon="rocket"></span></div>

        <p style="font-size: 1.2rem; font-weight: bold;">جارٍ معالجة ${validFiles.length} ملف...</p>

        <div class="progress-bar" style="width: 80%; height: 10px; background: #eee; margin: 10px auto; border-radius: 5px; overflow: hidden;">

            <div id="progressBarFill" style="width: 0%; height: 100%; background: var(--secondary-color); transition: width 0.3s;"></div>

        </div>

        <p id="importProgress">0 / ${validFiles.length}</p>

    `;

    // Process files SEQUENTIALLY to avoid race conditions

    let completed = 0;

    let successCount = 0;

    const errors = [];

    for (const file of validFiles) {

        try {

            await processExcelFile(file, selectedAcademicYear);

            successCount++;

        } catch (e) {

            errors.push(`${file.name}: ${e.message}`);

        } finally {

            completed++;

            // Update progress bar

            const percent = Math.round((completed / validFiles.length) * 100);

            const fill = document.getElementById('progressBarFill');

            const text = document.getElementById('importProgress');

            if (fill) fill.style.width = `${percent}%`;

            if (text) text.textContent = `${completed} / ${validFiles.length}`;

        }

    }

    // Restore UI

    dropZone.innerHTML = originalText;

    if (successCount === 0) {
        await loadDataFromStorage(previousAcademicYear);
        renderAll();
    } else {
        // Save after ALL files processed

        await saveDataToStorage();

        await loadDataFromStorage(selectedAcademicYear);

        renderAll();
        closeImportModal();
    }

    // Show warnings for files without annual averages

    if (window.importWarnings && window.importWarnings.length > 0) {

        const warningMessages = window.importWarnings.map(w => w.message).join('\n\n');

        setTimeout(() => {

            Swal.fire({ icon: 'warning', title: 'تنبيه', text: '⚠️ تنبيه:\n\n' + warningMessages });

        }, 200);

        window.importWarnings = []; // Reset warnings

    }

    // Final Report

    if (errors.length > 0) {

        let msg = `✅ تم بنجاح: ${successCount}\n❌ فشل: ${errors.length}\n\nالأخطاء:\n` + errors.slice(0, 10).join('\n');

        if (errors.length > 10) msg += `\n...و ${errors.length - 10} أخطاء أخرى.`;

        Swal.fire({ icon: 'info', title: 'تقرير المعالجة', text: msg });

    } else {

        setTimeout(() => Swal.fire({
            icon: 'success',
            title: 'تمت العملية',
            text: `✅ تمت معالجة جميع الملفات (${successCount}) بنجاح!`,
            timer: 2000,
            showConfirmButton: false
        }), 100);

    }

}

function processExcelFile(file, selectedAcademicYear) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = async function (e) {

            try {

                const data = new Uint8Array(e.target.result);

                const workbook = XLSX.read(data, { type: 'array' });

                if (!workbook.SheetNames.length) {

                    throw new Error("الملف فارغ أو لا يحتوي على أوراق عمل");

                }

                const sheetName = workbook.SheetNames[0];

                const worksheet = workbook.Sheets[sheetName];

                // Convert to JSON, starting from row 4 (index 3)

                const jsonData = XLSX.utils.sheet_to_json(worksheet, {

                    header: 1,

                    defval: ''

                });

                if (jsonData.length < 4) {

                    // Maybe it's a file without headers? allow it but warn

                }

                // Extract class identifier

                const className = extractClassName(jsonData, file.name);
                const academicYear = normalizeAcademicYearId(selectedAcademicYear) || extractAcademicYearFromSheet(jsonData, file.name);
                const linkCache = await loadAnnualLinkCache();
                const columnLayout = detectFinalResultsImportLayout(jsonData);

                if (!className) throw new Error("تعذر تحديد اسم القسم");

                const newStudents = [];

                // Parse students starting from row 4 (index 3)

                for (let i = 3; i < jsonData.length; i++) {

                    const row = jsonData[i];

                    if (!row || (!row[0] && !row[1])) continue; // Skip empty rows

                    const student = parseStudentRow(row, {
                        fileClassName: className,
                        academicYear: academicYear,
                        sourceFile: file.name,
                        linkCache: linkCache,
                        columnLayout: columnLayout
                    });

                    if (student) {

                        newStudents.push(student);

                    }

                }

                if (newStudents.length === 0) {

                    throw new Error("لم يتم العثور على بيانات تلاميذ صالحة (تأكد من التنسيق)");

                }

                // Check if annual averages are all empty or zero

                const studentsWithAverage = newStudents.filter(s => s.annualAvg > 0);

                const missingAverageRatio = 1 - (studentsWithAverage.length / newStudents.length);

                // If more than 80% of students have no average, warn the user

                if (missingAverageRatio > 0.8) {

                    const uniqueClasses = [...new Set(newStudents.map(s => s.className).filter(c => c))];

                    const classNames = uniqueClasses.join('، ') || file.name;

                    // Store warning for later display

                    if (!window.importWarnings) window.importWarnings = [];

                    window.importWarnings.push({

                        file: file.name,

                        classes: classNames,

                        message: `⚠️ الملف "${file.name}" لا يحتوي على معدلات سنوية. يرجى تأكيد القرار النهائي للقسم: ${classNames}`

                    });

                }

                updateGlobalData(className, newStudents);

                resolve();

            } catch (err) {

                reject(err);

            }

        };

        reader.onerror = () => reject(new Error("فشل قراءة الملف (File Read Error)"));

        reader.readAsArrayBuffer(file);

    });

}

function extractClassName(jsonData, fileName) {

    // PRIORITY 1: Use filename as primary identifier (most reliable for unique class names)

    const fileBaseName = fileName.replace(/\.(xlsx?)/i, '').trim();

    if (fileBaseName) {

        return fileBaseName;

    }

    // FALLBACK: Try to extract from row 2 or 1 if filename is not useful

    if (jsonData[1] && jsonData[1][0]) {

        return String(jsonData[1][0]).trim();

    }

    if (jsonData[0] && jsonData[0][0]) {

        return String(jsonData[0][0]).trim();

    }

    return 'قسم غير معروف';

}

function parseStudentRow(row, importMeta) {

    const meta = importMeta || {};
    const fileClassName = meta.fileClassName || '';
    const layout = meta.columnLayout || detectFinalResultsImportLayout([[], [], [], [], row]);

    const id = row[layout.id];

    const lastName = row[layout.lastName];

    const firstName = row[layout.firstName];

    const gender = normalizeGender(row[layout.gender]);

    const birthDate = row[layout.birthDate];

    const level = normalizeLevel(row[layout.level]);

    const rawStream = layout.stream !== undefined ? String(row[layout.stream] || '').trim() : '';
    const rawGroup = layout.group !== undefined ? String(row[layout.group] || '').trim() : '';
    let squad = layout.className !== undefined ? String(row[layout.className] || '').trim() : '';

    const t1 = parseAnnualNumeric(row[layout.t1]);

    const t2 = parseAnnualNumeric(row[layout.t2]);

    const t3 = parseAnnualNumeric(row[layout.t3]);

    const annual = parseAnnualNumeric(row[layout.annual]);

    // Skip if no name

    if (!lastName && !firstName) return null;

    // Skip header rows - check if row contains header keywords

    const headerKeywords = ['اللقب', 'الاسم', 'الجنس', 'تاريخ الميلاد', 'المستوى', 'المعدل', 'الفوج', 'رقم'];

    const fullName = `${lastName} ${firstName}`.trim().toLowerCase();

    const isHeaderRow = headerKeywords.some(keyword => fullName.includes(keyword));

    if (isHeaderRow || fullName === 'اللقب الاسم' || lastName === 'اللقب' || firstName === 'الاسم') {

        return null; // Skip header rows

    }

    // Filter out header row values from squad/class name / stream

    const headerValues = ['رقم الفوج', 'الفوج', 'القسم', 'الشعبة', 'class', 'squad', 'section'];

    if (headerValues.some(h => squad.toLowerCase().includes(h.toLowerCase()))) {

        squad = ''; // Clear if it's a header value

    }

    const stream = headerValues.some(h => rawStream.toLowerCase().includes(h.toLowerCase()))
        ? ''
        : rawStream;

    // Extract birth year

    const birthYear = extractBirthYear(birthDate);

    // Format birth date for display

    const formattedBirthDate = formatBirthDate(birthDate);

    const className = layout.kind && layout.kind.startsWith('secondary')
        ? [stream, rawGroup].filter(Boolean).join(' - ') || rawGroup || fileClassName || ''
        : (squad || fileClassName || '');

    const student = {

        id: normalizeAnnualIdentifier(id),

        student_id: normalizeAnnualIdentifier(id),

        lastName: String(lastName || '').trim(),

        firstName: String(firstName || '').trim(),

        fullName: `${lastName || ''} ${firstName || ''}`.trim(),

        gender: gender, // 'ذكر' or 'أنثى'

        birthDate: formattedBirthDate,

        birthYear: birthYear,

        level: level,

        squad: className,

        className: className,

        stream: stream,

        t1: t1,

        t2: t2,

        t3: t3,

        annualAvg: annual,

        decision: '-',

        sourceFile: meta.sourceFile || '',

        academic_year: normalizeAcademicYearId(meta.academicYear || getCurrentAnnualAcademicYear())

    };

    return enrichAnnualStudentWithCurrentData(
        student,
        meta.linkCache || { byIdentifier: new Map(), byIdentity: new Map(), byNameDob: new Map() }
    );

}

// Format birth date from Excel serial or string to readable date

function formatBirthDate(birthDate) {

    if (!birthDate) return '-';

    // Check if it's an Excel serial date number

    if (typeof birthDate === 'number' || (!isNaN(birthDate) && !String(birthDate).includes('/'))) {

        const serial = parseFloat(birthDate);

        if (serial > 1000 && serial < 100000) {

            // Convert Excel serial to JavaScript Date

            const excelEpoch = new Date(1899, 11, 30);

            const jsDate = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);

            // Format as DD/MM/YYYY

            const day = String(jsDate.getDate()).padStart(2, '0');

            const month = String(jsDate.getMonth() + 1).padStart(2, '0');

            const year = jsDate.getFullYear();

            if (year >= 1990 && year <= 2050) {

                return `${day}/${month}/${year}`;

            }

        }

    }

    // If it's already a string, return it as is

    return String(birthDate);

}

function normalizeGender(value) {

    const v = String(value).trim().toLowerCase();

    if (v === 'ذ' || v === 'ذكر' || v === 'male' || v === 'm') return 'ذكر';

    if (v === 'أ' || v === 'ا' || v === 'أنثى' || v === 'انثى' || v === 'female' || v === 'f') return 'أنثى';

    return value;

}

function normalizeLevel(value) {

    const v = String(value).trim();

    // Extract number if present

    const match = v.match(/(\d)/);

    if (match) return parseInt(match[1]);

    // Arabic level names

    if (v.includes('أولى') || v.includes('الأولى')) return 1;

    if (v.includes('ثانية') || v.includes('الثانية')) return 2;

    if (v.includes('ثالثة') || v.includes('الثالثة')) return 3;

    if (v.includes('رابعة') || v.includes('الرابعة')) return 4;

    return parseInt(v) || 0;

}

function extractBirthYear(birthDate) {

    if (!birthDate) return null;

    // Check if it's an Excel serial date number (typically 4-5 digits representing days since 1900)

    if (typeof birthDate === 'number' || (!isNaN(birthDate) && !String(birthDate).includes('/'))) {

        const serial = parseFloat(birthDate);

        // Excel serial dates: days since Dec 30, 1899

        // Typical student birth years would be serial numbers like 30000-45000 for years 1980-2023

        if (serial > 1000 && serial < 100000) {

            // Convert Excel serial to JavaScript Date

            // Excel epoch: Dec 30, 1899

            const excelEpoch = new Date(1899, 11, 30);

            const jsDate = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);

            const year = jsDate.getFullYear();

            // Validate it's a reasonable birth year

            if (year >= 1990 && year <= 2050) {

                return year;

            }

        }

    }

    const str = String(birthDate);

    // Try to find 4-digit year in the string

    const match = str.match(/(19\d{2}|20[0-2]\d)/); // Match years 1900-2029

    if (match) return parseInt(match[1]);

    // Try parsing as date string

    const date = new Date(birthDate);

    if (!isNaN(date.getTime())) {

        const year = date.getFullYear();

        if (year >= 1990 && year <= 2050) {

            return year;

        }

    }

    return null;

}

// ============================================

// CLASSIFICATION

// ============================================

function getDirectedThreshold() {

    // Use globally loaded settings

    return institutionSettings.directedBirthYear || 2010;

}

function classifyStudent(student) {

    const stage = institutionSettings.educationStage || 'middle';

    if (student.annualAvg >= 10) {
        return 'passed'; // منتقل
    }

    if (stage === 'secondary') {
        if (student.decision === 'directed') return 'directed';
        if (student.decision === 'failed') return 'failed';
        return 'failed'; // Default for secondary < 10
    }

    const threshold = getDirectedThreshold();

    if (student.birthYear && student.birthYear <= threshold) {

        return 'directed'; // موجه

    } else {

        return 'failed'; // معيد

    }

}

function getClassification(student) {

    return classifyStudent(student);

}

// ============================================

// STATISTICS CALCULATIONS

// ============================================

function calculateStats() {

    const stats = {

        total: 0,

        males: 0,

        females: 0,

        passed: 0,

        failed: 0,

        directed: 0,

        byLevel: {},

        byGenderAndLevel: {},

        bySquad: {}

    };

    // Initialize levels 1-4

    for (let level = 1; level <= 4; level++) {

        stats.byLevel[level] = {

            total: 0, males: 0, females: 0,

            passed: 0, failed: 0, directed: 0,

            passedMales: 0, passedFemales: 0,

            failedMales: 0, failedFemales: 0,

            directedMales: 0, directedFemales: 0

        };

    }

    studentsData.forEach(student => {

        const classification = classifyStudent(student);

        const level = student.level;

        const isMale = student.gender === 'ذكر';

        // Global counts

        stats.total++;

        if (isMale) stats.males++; else stats.females++;

        if (classification === 'passed') stats.passed++;

        else if (classification === 'failed') stats.failed++;

        else if (classification === 'directed') stats.directed++;

        // By level

        if (stats.byLevel[level]) {

            const levelStats = stats.byLevel[level];

            levelStats.total++;

            if (isMale) levelStats.males++; else levelStats.females++;

            if (classification === 'passed') {

                levelStats.passed++;

                if (isMale) levelStats.passedMales++; else levelStats.passedFemales++;

            } else if (classification === 'failed') {

                levelStats.failed++;

                if (isMale) levelStats.failedMales++; else levelStats.failedFemales++;

            } else if (classification === 'directed') {

                levelStats.directed++;

                if (isMale) levelStats.directedMales++; else levelStats.directedFemales++;

            }

        }

        // By squad

        const squadKey = `${level}_${student.className}`;

        if (!stats.bySquad[squadKey]) {

            stats.bySquad[squadKey] = {

                name: student.className,

                level: level,

                total: 0, males: 0, females: 0,

                passed: 0, failed: 0, directed: 0

            };

        }

        const squadStats = stats.bySquad[squadKey];

        squadStats.total++;

        if (isMale) squadStats.males++; else squadStats.females++;

        if (classification === 'passed') squadStats.passed++;

        else if (classification === 'failed') squadStats.failed++;

        else if (classification === 'directed') squadStats.directed++;

    });

    return stats;

}

// ============================================

// RENDERING

// ============================================

function renderAll() {

    renderImportedFiles();

    if (studentsData.length === 0) {

        document.getElementById('mainContent').style.display = 'none';

        document.getElementById('noDataMessage').style.display = 'block';

        return;

    }

    document.getElementById('mainContent').style.display = 'block';

    document.getElementById('noDataMessage').style.display = 'none';

    const stats = calculateStats();

    renderGeneralStats(stats);

    renderLevelStats(stats);

    renderGenderDistribution(stats);

    renderSquadTable();

    updateClassFilter();

    renderStudentsList();

}

function renderImportedFiles() {

    const container = document.getElementById('importedFilesList');

    const countSpan = document.getElementById('importedStudentsCount');

    if (studentsData.length === 0) {

        container.style.display = 'none';

        return;

    }

    container.style.display = 'block';

    countSpan.textContent = studentsData.length;

}

function renderGeneralStats(stats) {

    document.getElementById('totalStudents').textContent = stats.total;

    document.getElementById('totalMales').textContent = stats.males;

    document.getElementById('totalFemales').textContent = stats.females;

    document.getElementById('totalPassed').textContent = stats.passed;

    document.getElementById('totalFailed').textContent = stats.failed;

    document.getElementById('totalDirected').textContent = stats.directed;

}

function renderLevelStats(stats) {

    const tbody = document.getElementById('levelStatsBody');

    const stage = institutionSettings.educationStage || 'middle';

    let levelNames = [];

    let maxLevel = 4;

    if (stage === 'secondary') {

        levelNames = ['', 'السنة الأولى', 'السنة الثانية', 'السنة الثالثة'];

        maxLevel = 3;

        // Hide/Remove existing Year 4 options if necessary in HTML?

        // Not strictly necessary as loop control handles display

    } else {

        levelNames = ['', 'السنة الأولى', 'السنة الثانية', 'السنة الثالثة', 'السنة الرابعة'];

        maxLevel = 4;

    }

    let html = '';

    let totals = { total: 0, males: 0, females: 0, passed: 0, failed: 0, directed: 0 };

    for (let level = 1; level <= maxLevel; level++) {

        const s = stats.byLevel[level];

        if (s.total === 0) continue;

        // Calculate pass rate (excluding directed)

        const eligibleCount = s.passed + s.failed;

        const passRate = eligibleCount > 0 ? ((s.passed / eligibleCount) * 100).toFixed(1) : '0.0';

        html += `

            <tr>

                <td>${levelNames[level]}</td>

                <td>${s.total}</td>

                <td>${s.males}</td>

                <td>${s.females}</td>

                <td><span class="badge pass">${s.passed}</span></td>

                <td><span class="badge fail">${s.failed}</span></td>

                <td><span class="badge directed">${s.directed}</span></td>

                <td>${passRate}%</td>

            </tr>

        `;

        totals.total += s.total;

        totals.males += s.males;

        totals.females += s.females;

        totals.passed += s.passed;

        totals.failed += s.failed;

        totals.directed += s.directed;

    }

    // Total row

    const totalEligible = totals.passed + totals.failed;

    const totalPassRate = totalEligible > 0 ? ((totals.passed / totalEligible) * 100).toFixed(1) : '0.0';

    html += `

        <tr style="font-weight: bold; background: #f0f0f0;">

            <td>المجموع</td>

            <td>${totals.total}</td>

            <td>${totals.males}</td>

            <td>${totals.females}</td>

            <td><span class="badge pass">${totals.passed}</span></td>

            <td><span class="badge fail">${totals.failed}</span></td>

            <td><span class="badge directed">${totals.directed}</span></td>

            <td>${totalPassRate}%</td>

        </tr>

    `;

    tbody.innerHTML = html;

}

function renderGenderDistribution(stats) {

    const tbody = document.getElementById('genderDistributionBody');

    const stage = institutionSettings.educationStage || 'middle';

    let levelNames = [];

    let maxLevel = 4;

    if (stage === 'secondary') {

        levelNames = ['', 'السنة الأولى', 'السنة الثانية', 'السنة الثالثة'];

        maxLevel = 3;

    } else {

        levelNames = ['', 'السنة الأولى', 'السنة الثانية', 'السنة الثالثة', 'السنة الرابعة'];

        maxLevel = 4;

    }

    let html = '';

    let totals = {

        passedMales: 0, passedFemales: 0,

        failedMales: 0, failedFemales: 0,

        directedMales: 0, directedFemales: 0

    };

    for (let level = 1; level <= maxLevel; level++) {

        const s = stats.byLevel[level];

        if (s.total === 0) continue;

        html += `

            <tr>

                <td>${levelNames[level]}</td>

                <td>${s.passedMales}</td>

                <td>${s.passedFemales}</td>

                <td>${s.failedMales}</td>

                <td>${s.failedFemales}</td>

                <td>${s.directedMales}</td>

                <td>${s.directedFemales}</td>

            </tr>

        `;

        totals.passedMales += s.passedMales;

        totals.passedFemales += s.passedFemales;

        totals.failedMales += s.failedMales;

        totals.failedFemales += s.failedFemales;

        totals.directedMales += s.directedMales;

        totals.directedFemales += s.directedFemales;

    }

    // Total row

    html += `

        <tr style="font-weight: bold; background: #f0f0f0;">

            <td>المجموع</td>

            <td>${totals.passedMales}</td>

            <td>${totals.passedFemales}</td>

            <td>${totals.failedMales}</td>

            <td>${totals.failedFemales}</td>

            <td>${totals.directedMales}</td>

            <td>${totals.directedFemales}</td>

        </tr>

    `;

    tbody.innerHTML = html;

}

function renderSquadTable() {

    const tbody = document.getElementById('squadTableBody');

    const levelFilter = document.getElementById('squadLevelFilter').value;

    const stats = calculateStats();

    const levelNames = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة'];

    let squads = Object.values(stats.bySquad);

    // Filter out invalid squads (level 0 or empty name)

    squads = squads.filter(s => s.level > 0 && s.name);

    // Filter by level if selected

    if (levelFilter !== 'all') {

        squads = squads.filter(s => s.level === parseInt(levelFilter));

    }

    // Sort by level, then name

    squads.sort((a, b) => {

        if (a.level !== b.level) return a.level - b.level;

        return a.name.localeCompare(b.name);

    });

    if (squads.length === 0) {

        tbody.innerHTML = '<tr><td colspan="8">لا توجد بيانات</td></tr>';

        return;

    }

    let html = '';

    squads.forEach(s => {

        html += `

            <tr>

                <td>${levelNames[s.level] || s.level}</td>

                <td>${s.name}</td>

                <td>${s.total}</td>

                <td>${s.males}</td>

                <td>${s.females}</td>

                <td><span class="badge pass">${s.passed}</span></td>

                <td><span class="badge fail">${s.failed}</span></td>

                <td><span class="badge directed">${s.directed}</span></td>

            </tr>

        `;

    });

    tbody.innerHTML = html;

}

function updateClassFilter() {

    const levelFilter = document.getElementById('studentsLevelFilter').value;

    const classSelect = document.getElementById('studentsClassFilter');

    // Get unique classes based on selected level

    let classes = [];

    if (levelFilter === 'all') {

        classes = [...new Set(studentsData.map(s => s.className).filter(c => c))];

    } else {

        classes = [...new Set(studentsData

            .filter(s => s.level === parseInt(levelFilter))

            .map(s => s.className)

            .filter(c => c))];

    }

    // Sort classes

    classes.sort();

    // Update dropdown

    classSelect.innerHTML = '<option value="all">جميع الأقسام</option>' +

        classes.map(c => `<option value="${c}">${c}</option>`).join('');

}

function renderStudentsList() {

    const tbody = document.getElementById('studentsListBody');

    const countSpan = document.getElementById('studentsListCount');

    const decisionFilter = document.getElementById('decisionFilter').value;

    const levelFilter = document.getElementById('studentsLevelFilter').value;

    const classFilter = document.getElementById('studentsClassFilter').value;

    const genderFilter = document.getElementById('studentsGenderFilter').value;

    // Start with all students

    let filtered = studentsData.slice();

    // Filter by decision

    if (decisionFilter !== 'all') {

        filtered = filtered.filter(s => classifyStudent(s) === decisionFilter);

    }

    // Filter by level

    if (levelFilter !== 'all') {

        filtered = filtered.filter(s => s.level === parseInt(levelFilter));

    }

    // Filter by class

    if (classFilter !== 'all') {

        filtered = filtered.filter(s => s.className === classFilter);

    }

    // Filter by gender

    if (genderFilter !== 'all') {

        filtered = filtered.filter(s => s.gender === genderFilter);

    }

    // Sort by level, then class, then name

    filtered.sort((a, b) => {

        if (a.level !== b.level) return a.level - b.level;

        if (a.className !== b.className) return (a.className || '').localeCompare(b.className || '');

        return a.fullName.localeCompare(b.fullName);

    });

    // Update count

    countSpan.textContent = filtered.length;

    if (filtered.length === 0) {

        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">لا توجد نتائج</td></tr>';

        return;

    }

    const levelNames = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة'];

    const decisionLabels = {

        'passed': '<span class="badge pass">ينتقل</span>',

        'failed': '<span class="badge fail">يعيد</span>',

        'directed': '<span class="badge directed">يوجّه</span>'

    };

    const stage = institutionSettings.educationStage || 'middle';

    let html = '';

    filtered.forEach((s, index) => {

        const genderBadge = s.gender === 'ذكر' ? 'male' : 'female';

        const decision = classifyStudent(s);
        
        let decisionHtml = decisionLabels[decision];
        if (stage === 'secondary' && s.annualAvg < 10) {
            decisionHtml = `
                <select class="decision-select" onchange="updateStudentDecision('${s.id}', this.value)">
                    <option value="failed" ${decision === 'failed' ? 'selected' : ''}>يعيد</option>
                    <option value="directed" ${decision === 'directed' ? 'selected' : ''}>يوجّه</option>
                </select>
            `;
        }

        html += `

            <tr>

                <td>${index + 1}</td>

                <td>${s.fullName}</td>

                <td><span class="badge ${genderBadge}">${s.gender}</span></td>

                <td>${s.birthDate || '-'}</td>

                <td>${levelNames[s.level] || s.level}</td>

                <td>${s.className || '-'}</td>

                <td>${s.annualAvg.toFixed(2)}</td>

                <td>${decisionHtml}</td>

            </tr>

        `;

    });

    tbody.innerHTML = html;

}

async function updateStudentDecision(studentId, newDecision) {
    const student = studentsData.find(s => s.id === studentId || s.student_id === studentId);
    if (student) {
        student.decision = newDecision;
        await saveDataToStorage();
        renderAll();
        
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'تم تحديث التوجيه بنجاح',
            showConfirmButton: false,
            timer: 2000
        });
    }
}

// Legacy function for backward compatibility

function renderDirectedList() {

    renderStudentsList();

}

// ============================================

// DATA MANAGEMENT

// ============================================

async function deleteClass(className) {

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: `هل تريد حذف بيانات القسم "${className}"؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    studentsData = studentsData.filter(s => s.className !== className);

    classesImported = classesImported.filter(c => c !== className);

    await saveDataToStorage();
    await loadDataFromStorage();
    renderAll();

}

async function clearAllData() {

    const result1 = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "هل تريد حذف جميع بيانات النتائج النهائية؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف',
        cancelButtonText: 'إلغاء'
    });
    if (!result1.isConfirmed) return;

    const result2 = await Swal.fire({
        title: 'تأكيد نهائي',
        text: "تأكيد: سيتم حذف جميع البيانات المستوردة!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، احذف كل شيء',
        cancelButtonText: 'إلغاء'
    });
    if (!result2.isConfirmed) return;

    studentsData = [];

    classesImported = [];

    await DB.clearAnnualResults({ allYears: true });
    annualLinkCache = null;
    activeAcademicYear = getCurrentAnnualAcademicYear();

    renderAll();
    syncToolbarControls();

}

function updateGlobalData(fileClassName, newStudents) {

    studentsData.push(...newStudents);

    refreshImportedClasses();

    const uniqueClasses = [...new Set(newStudents.map(s => s.className).filter(c => c))];

    console.log(`Imported from "${fileClassName}": ${newStudents.length} students, Classes: ${uniqueClasses.join(', ')}`);

}

// ============================================

// IMPORT 4TH YEAR FROM BEM RESULTS

// ============================================

async function import4thYearFromBEM() {

    try {
        const selectedAcademicYear = getSelectedImportAcademicYear();
        if (!selectedAcademicYear) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى تحديد السنة الدراسية قبل بدء الاستيراد.' });
            return;
        }

        // Get certificate data from IndexedDB

        const certData = await DB.get('certificateResults') || [];

        if (!certData || certData.length === 0) {

            Swal.fire({
                icon: 'warning',
                title: 'تنبيه',
                text: '⚠️ لا توجد بيانات شهادة مستوردة (أو البيانات فارغة)!\n\nيرجى أولاً استيراد بيانات الشهادة من صفحة "نتائج الشهادة".'
            });

            return;

        }

        // Confirm import

        const result = await Swal.fire({
            title: 'تأكيد الاستيراد',
            text: `سيتم استيراد ${certData.length} تلميذ من السنة الرابعة.\n\nسيتم استخدام "معدل الانتقال" لتحديد النتيجة النهائية.\n\nمتابعة؟`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'نعم، استيراد',
            cancelButtonText: 'إلغاء'
        });

        if (!result.isConfirmed) {

            return;

        }

        // Remove existing 4th year students to avoid duplicates

        studentsData = studentsData.filter(s => s.level !== 4);

        classesImported = classesImported.filter(c => !c.includes('رابعة') && !c.includes('4'));

        // Try to get school data for gender/class matching

        let schoolData = await DB.getResults(true) || []; // Using DB.getResults wrapper or DB.getResults()

        if (schoolData && schoolData.length > 0) {

            try {

                // Filter to 4th year students only with valid gender

                schoolData = schoolData.filter(s =>

                    s.level && (s.level.includes('4') || s.level.includes('رابعة')) &&

                    s.gender && s.gender !== 'غير محدد'

                );

            } catch (e) {

                console.warn('Could not parse schoolResults for matching');

            }

        }

        // Helper to clean text for matching

        function cleanTextForMatch(text) {

            if (!text) return '';

            return text.toString().trim().toLowerCase()

                .replace(/[\u064B-\u065F]/g, '') // Remove Arabic diacritics

                .replace(/[أإآا]/g, 'ا')

                .replace(/ة/g, 'ه')

                .replace(/ى/g, 'ي')

                .replace(/\s+/g, ' ');

        }

        // Helper to get date string

        function getDobStr(dob) {

            if (!dob) return '';

            if (typeof dob === 'string') return dob.split('T')[0].trim();

            return String(dob).trim();

        }

        // Create a pool of available school students

        const schoolPool = schoolData.map((s, idx) => ({

            original: s,

            cleanName: cleanTextForMatch(s.name),

            cleanDob: getDobStr(s.dob),

            used: false

        }));

        // PASS 1: Strict Match (Name + DOB)

        certData.forEach(s => {

            try {

                const certName = cleanTextForMatch(s.name);

                const certDob = getDobStr(s.dob);

                const matchIndex = schoolPool.findIndex(p =>

                    !p.used &&

                    p.cleanName === certName &&

                    p.cleanDob === certDob

                );

                if (matchIndex !== -1) {

                    const match = schoolPool[matchIndex];

                    s._matchedGender = match.original.gender;

                    s._matchedClass = match.original.class;

                    schoolPool[matchIndex].used = true;

                    s._matched = true;

                } else {

                    s._matched = false;

                }

            } catch (e) {

                console.error('Error in Pass 1', e);

                s._matched = false;

            }

        });

        // PASS 2: Loose Match (DOB Only) for remaining unmatched

        certData.forEach(s => {

            if (s._matched) return;

            try {

                const certDob = getDobStr(s.dob);

                if (!certDob) return;

                const matchIndex = schoolPool.findIndex(p =>

                    !p.used &&

                    p.cleanDob === certDob

                );

                if (matchIndex !== -1) {

                    const match = schoolPool[matchIndex];

                    s._matchedGender = match.original.gender;

                    s._matchedClass = match.original.class;

                    schoolPool[matchIndex].used = true;

                    s._matched = true;

                }

            } catch (e) {

                console.error('Error in Pass 2', e);

            }

        });

        // Convert BEM data to our format using matched data

        const newStudents = certData.map((s, index) => {

            // Get transition average (معدل الانتقال)

            const transitionAvg = (s.averages && s.averages.transition) ? parseFloat(s.averages.transition) : 0;

            // Use matched class, or from cert data, or default

            let className = s._matchedClass || null;

            if (!className && s.class && s.class !== 'نتائج الشهادة' && s.class !== 'غير محدد') {

                className = s.class;

            }

            if (!className) {

                className = 'رابعة متوسط';

            }

            // Use matched gender or default

            const gender = s._matchedGender || s.gender || 'غير محدد';

            // Format date

            let birthDate = s.dob || '';

            if (birthDate && birthDate.includes('T')) {

                birthDate = birthDate.split('T')[0];

            }

            // Extract birth year

            let birthYear = null;

            if (birthDate) {

                const yearMatch = birthDate.match(/(\d{4})/);

                if (yearMatch) birthYear = parseInt(yearMatch[1]);

            }

            return {

                id: normalizeAnnualIdentifier(s.id || ''),

                student_id: normalizeAnnualIdentifier(s.id || ''),

                lastName: '',

                firstName: '',

                fullName: s.name || 'غير معروف',

                gender: gender,

                birthDate: birthDate,

                birthYear: birthYear,

                level: 4,

                squad: className,

                className: className,

                stream: '',

                t1: 0,

                t2: 0,

                t3: 0,

                annualAvg: transitionAvg,

                sourceFile: 'certificateResults',

                academic_year: selectedAcademicYear

            };

        });

        // Extract and add unique class names

        const uniqueClasses = [...new Set(newStudents.map(s => s.className).filter(c => c))];

        // Remove old data for these classes to prevent duplicates
        studentsData = studentsData.filter(s => !uniqueClasses.includes(s.className));

        // Add students

        studentsData.push(...newStudents);

        uniqueClasses.forEach(cls => {

            if (!classesImported.includes(cls)) {

                classesImported.push(cls);

            }

        });

        // Save and render

        await saveDataToStorage();
        await loadDataFromStorage(selectedAcademicYear);
        renderAll();
        closeImportModal();

        // Success message

        Swal.fire({
            icon: 'success',
            title: 'تم الاستيراد',
            text: `✅ تم استيراد ${newStudents.length} تلميذ من السنة الرابعة بنجاح!\n\nتم استخدام "معدل الانتقال" لتحديد النتيجة النهائية.`
        });

        console.log(`Imported ${newStudents.length} 4th year students from BEM results, Classes: ${uniqueClasses.join(', ')}`);

    } catch (e) {

        console.error('Error importing BEM data:', e);
        await loadDataFromStorage(getActiveAnnualAcademicYear());
        renderAll();

        Swal.fire({ icon: 'error', title: 'خطأ', text: '❌ حدث خطأ أثناء استيراد بيانات الشهادة:\n' + e.message });

    }

}

// ============================================

// PRINT FUNCTIONS

// ============================================

function getReportHeader() {

    const settings = institutionSettings;

    const schoolYear = settings.schoolYear || '2025/2024';

    return `

        <div class="report-header">

            <div style="text-align: center; margin-bottom: 10px;">

                <h3 style="margin: 2px 0; font-size: 12pt;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                <h3 style="margin: 2px 0; font-size: 12pt;">وزارة التربية الوطنية</h3>

            </div>

            <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">

                <div style="text-align: right;">

                    <div>مديرية التربية لولاية ${settings.wilaya || '.......'}</div>

                    <div>المؤسسة: ${settings.institutionName || '.......'}</div>

                </div>

                <div style="text-align: left;">

                    <div>البلدية: ${settings.municipality || '.......'}</div>

                    <div>السنة الدراسية: ${settings.schoolYear || '2025/2026'}</div>

                </div>

            </div>

        </div>

    `;

}

function getReportFooter() {

    const settings = institutionSettings;

    const sigSettings = signatureSettings;

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    const reportConfig = sigSettings.reportSettings?.['final_results'] || { signer: 'director' };

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }

    const signerName = signerData.fullName || settings.managerName || '................';

    return `

        <div class="report-footer">

            <div class="footer-right">

                حرر بـ: ${settings.municipality || '.......'} في: ${today}

            </div>

            <div class="footer-left">

                <div>${signerTitle}</div>

                <div style="margin-top: 5px;">${signerName}</div>

            </div>

        </div>

    `;

}

function getPrintStyles() {

    return `

        @page { size: A4; margin: 0.8cm; }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {

            font-family: 'Tajawal', 'Traditional Arabic', sans-serif;

            background: var(--card-bg);

            -webkit-print-color-adjust: exact;

            font-size: 11pt;

            direction: rtl;

        }

        .report-header {

            margin-bottom: 20px;

            font-size: 11pt;

            font-weight: bold;

        }

        .report-title {

            text-align: center;

            margin: 15px 0;

            padding: 10px;

            border: 2px solid #000;

            border-radius: 5px;

            display: inline-block;

            width: 100%;

        }

        .report-footer {

            margin-top: 30px;

            display: flex;

            justify-content: space-between;

            font-weight: bold;

            page-break-inside: avoid;

        }

        .footer-left { text-align: center; min-width: 200px; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10pt; }

        th, td { border: 1px solid #333; padding: 6px; text-align: center; }

        th { background-color: #ecf0f1 !important; color: #000 !important; font-weight: bold; }

        .section-title {

            font-size: 13pt;

            font-weight: bold;

            margin: 15px 0 10px 0;

            padding-bottom: 5px;

            border-bottom: 2px solid var(--primary-color);

        }

        .stats-summary {

            display: flex;

            justify-content: space-around;

            margin: 15px 0;

            padding: 10px;

            background: var(--bg-color);

            border-radius: 8px;

        }

        .stats-summary div { text-align: center; }

        .stats-summary span { display: block; font-size: 1.2em; font-weight: bold; color: var(--primary-color); }

        .badge { padding: 0; font-size: 10pt; background: transparent !important; color: #000 !important; font-weight: normal !important; border: none !important; }
        .decision-select { border: none !important; background: transparent !important; color: #000 !important; font-size: 10pt; font-weight: normal !important; outline: none !important; appearance: none; -webkit-appearance: none; -moz-appearance: none; padding: 0; }
    `;

}

function printStatisticsReport() {
    if (blockTrialPrint()) return;

    const stats = calculateStats();

    const stage = institutionSettings.educationStage || 'middle';

    let levelNames = [];

    let maxLevel = 4;

    if (stage === 'secondary') {

        levelNames = ['', 'السنة الأولى', 'السنة الثانية', 'السنة الثالثة'];

        maxLevel = 3;

    } else {

        levelNames = ['', 'السنة الأولى', 'السنة الثانية', 'السنة الثالثة', 'السنة الرابعة'];

        maxLevel = 4;

    }

    // Level Stats Table

    let levelTableHtml = `

        <table>

            <thead>

                <tr>

                    <th>المستوى</th>

                    <th>التعداد</th>

                    <th>ذكور</th>

                    <th>إناث</th>

                    <th>منتقلون</th>

                    <th>معيدون</th>

                    <th>موجهون</th>

                    <th>نسبة النجاح</th>

                </tr>

            </thead>

            <tbody>

    `;

    for (let level = 1; level <= maxLevel; level++) {

        const l = stats.byLevel[level] || { total: 0, males: 0, females: 0, passed: 0, failed: 0, directed: 0 };

        const eligibleCount = l.passed + l.failed;
        const rate = eligibleCount > 0 ? ((l.passed / eligibleCount) * 100).toFixed(2) : '0.00';

        levelTableHtml += `

            <tr>

                <td><strong>${levelNames[level]}</strong></td>

                <td>${l.total}</td>

                <td>${l.males}</td>

                <td>${l.females}</td>

                <td style="color: #27ae60;">${l.passed}</td>

                <td style="color: #e74c3c;">${l.failed}</td>

                <td style="color: #f39c12;">${l.directed}</td>

                <td><strong>${rate}%</strong></td>

            </tr>

        `;

    }

    // Totals row

    const totalEligible = stats.passed + stats.failed;
    const totalRate = totalEligible > 0 ? ((stats.passed / totalEligible) * 100).toFixed(2) : '0.00';

    levelTableHtml += `

        <tr style="background: #ecf0f1; font-weight: bold;">

            <td>المجموع</td>

            <td>${stats.total}</td>

            <td>${stats.males}</td>

            <td>${stats.females}</td>

            <td style="color: #27ae60;">${stats.passed}</td>

            <td style="color: #e74c3c;">${stats.failed}</td>

            <td style="color: #f39c12;">${stats.directed}</td>

            <td>${totalRate}%</td>

        </tr>

    `;

    levelTableHtml += '</tbody></table>';

    // Squad Table

    let squadTableHtml = `

        <table>

            <thead>

                <tr>

                    <th>المستوى</th>

                    <th>القسم</th>

                    <th>التعداد</th>

                    <th>ذكور</th>

                    <th>إناث</th>

                    <th>منتقلون</th>

                    <th>معيدون</th>

                    <th>موجهون</th>

                </tr>

            </thead>

            <tbody>

    `;

    const squads = Object.values(stats.bySquad).filter(s => s.level > 0 && s.name).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

    squads.forEach(s => {

        squadTableHtml += `

            <tr>

                <td>${levelNames[s.level] || s.level}</td>

                <td>${s.name}</td>

                <td>${s.total}</td>

                <td>${s.males}</td>

                <td>${s.females}</td>

                <td style="color: #27ae60;">${s.passed}</td>

                <td style="color: #e74c3c;">${s.failed}</td>

                <td style="color: #f39c12;">${s.directed}</td>

            </tr>

        `;

    });

    squadTableHtml += '</tbody></table>';

    // Build print content

    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'يرجى السماح بالنوافذ المنبثقة (Pop-ups) للطباعة.' });
        return;
    }

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>تقرير النتائج النهائية</title>

            <style>${getPrintStyles()}</style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            ${getReportHeader()}

            <div class="report-title">

                <h2 style="margin: 0;">تقرير النتائج النهائية</h2>

            </div>

            <div class="section-title">📊 الإحصائيات العامة حسب المستوى</div>

            ${levelTableHtml}

            <div class="section-title">🏫 توزيع الأفواج</div>

            ${squadTableHtml}

            ${getReportFooter()}

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

    printWindow.onload = function () {

        printWindow.focus();

        // printWindow.print(); /* Replaced by global Toolbar */ /* Replaced by global Toolbar */

    };

}

function printStudentsList() {
    if (blockTrialPrint()) return;

    const decisionFilter = document.getElementById('decisionFilter').value;
    const levelFilter = document.getElementById('studentsLevelFilter').value;
    const classFilter = document.getElementById('studentsClassFilter').value;
    const genderFilter = document.getElementById('studentsGenderFilter').value;

    let filtered = studentsData.slice();

    if (decisionFilter !== 'all') filtered = filtered.filter(s => classifyStudent(s) === decisionFilter);
    if (levelFilter !== 'all') filtered = filtered.filter(s => s.level === parseInt(levelFilter));
    if (classFilter !== 'all') filtered = filtered.filter(s => s.className === classFilter);
    if (genderFilter !== 'all') filtered = filtered.filter(s => s.gender === genderFilter);

    filtered.sort((a, b) => {
        if (a.level !== b.level) return a.level - b.level;
        if (a.className !== b.className) return (a.className || '').localeCompare(b.className || '');
        return a.fullName.localeCompare(b.fullName);
    });

    const levelNames = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة'];
    const decisionLabels = { 'passed': 'ينتقل', 'failed': 'يعيد', 'directed': 'يوجّه' };

    let title = 'قائمة التلاميذ';
    if (classFilter !== 'all') title += ` - قسم ${classFilter}`;
    else if (levelFilter !== 'all') title += ` - السنة ${levelNames[levelFilter]}`;

    let tableHtml = `<table class="report-table"><thead><tr><th>الرقم</th><th>اللقب والاسم</th><th>الجنس</th><th>تاريخ الميلاد</th><th>القسم</th><th>المعدل السنوي</th><th>القرار</th></tr></thead><tbody>`;
    filtered.forEach((s, i) => {
        const decision = classifyStudent(s);
        tableHtml += `<tr><td>${i + 1}</td><td>${s.fullName}</td><td>${s.gender}</td><td>${s.birthDate || '-'}</td><td>${s.className || '-'}</td><td>${s.annualAvg.toFixed(2)}</td><td>${decisionLabels[decision] || decisionLabels['failed']}</td></tr>`;
    });
    tableHtml += `</tbody></table>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) { Swal.fire({ icon: 'error', title: 'خطأ', text: 'يرجى السماح بالنوافذ المنبثقة (Pop-ups) للطباعة.' }); return; }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>${getPrintStyles()}</style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}
            ${getReportHeader()}
            <div class="report-title">
                <h2 style="margin: 0;">${title}</h2>
                <div style="font-size: 11pt; margin-top: 5px;">عدد التلاميذ: ${filtered.length}</div>
            </div>
            ${tableHtml}
            ${getReportFooter()}
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.onload = function () { printWindow.focus(); };
}

function printFullPageReport() {
    if (blockTrialPrint()) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'يرجى السماح بالنوافذ المنبثقة (Pop-ups) للطباعة.' });
        return;
    }

    const title = 'التقرير الكامل - النتائج النهائية';
    const mainContent = document.getElementById('mainContent').innerHTML;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                ${getPrintStyles()}
                .print-actions-panel { display: none !important; }
                .filters-row { display: none !important; }
                .stats-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-around; margin-bottom: 20px; }
                .stat-card { border: 1px solid #333; padding: 10px; text-align: center; border-radius: 5px; flex: 1; min-width: 120px; }
                .stat-value { font-size: 1.5em; font-weight: bold; margin: 5px 0; }
                .stat-label { font-size: 0.9em; font-weight: bold; }
                .card { margin-bottom: 25px; page-break-inside: avoid; }
            </style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}
            ${getReportHeader()}
            <div class="report-title">
                <h2 style="margin: 0;">${title}</h2>
            </div>
            
            ${mainContent}
            
            ${getReportFooter()}
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.onload = function () {
        printWindow.focus();
    };
}
