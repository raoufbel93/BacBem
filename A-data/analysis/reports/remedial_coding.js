const REMEDIAL_CODES_STORAGE_KEY = 'remedial-anonymization-codes-v1';
let remedialCodeRegistry = {};
let renderedCodedStudents = [];

function getTrialPrintBlockedMessage() {
    return (typeof Auth !== 'undefined' && typeof Auth.getFeatureBlockedMessage === 'function')
        ? Auth.getFeatureBlockedMessage('print')
        : 'الطباعة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.';
}

function isPrintRestrictedForCurrentUser() {
    return typeof Auth !== 'undefined' && typeof Auth.isFeatureRestricted === 'function' && Auth.isFeatureRestricted('print');
}

function blockTrialPrint() {
    if (!isPrintRestrictedForCurrentUser()) return false;

    if (typeof Auth !== 'undefined' && typeof Auth.blockRestrictedFeature === 'function') {
        return Auth.blockRestrictedFeature('print');
    }

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

    document.querySelectorAll('[data-print-premium="true"]').forEach(button => {
        const baseDisabled = button.dataset.baseDisabled === 'true';
        button.disabled = isRestricted || baseDisabled;
        button.style.opacity = button.disabled ? '0.6' : '';
        button.style.cursor = button.disabled ? 'not-allowed' : '';
        button.title = isRestricted ? message : '';
        button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
    });
}

document.addEventListener('DOMContentLoaded', initRemedialCodingPage);

async function initRemedialCodingPage() {
    const waitArea = document.getElementById('codingWaitArea');
    const resultsArea = document.getElementById('codingResults');

    try {
        if (typeof ensureRemedialDataReady !== 'function') {
            throw new Error('Remedial data helper is not available.');
        }

        await ensureRemedialDataReady();
        remedialCodeRegistry = loadRemedialCodeRegistry();

        if (!remedialStudents || remedialStudents.length === 0) {
            renderCodingEmptyState('لا توجد بيانات استدراك متاحة', 'يرجى التأكد من وجود تلاميذ مستدركين ضمن النتائج المستوردة.');
            return;
        }

        populateCodingFilters();
        bindRemedialCodingEvents();
        refreshRemedialCodingView();
        applyPrintAccessState();

        if (waitArea) waitArea.classList.add('hidden');
        if (resultsArea) resultsArea.classList.remove('hidden');
    } catch (error) {
        console.error('Failed to initialize remedial coding page:', error);
        renderCodingEmptyState('تعذر تحميل الصفحة', 'حدث خطأ أثناء تجهيز صفحة ترميز المستدركين.');
    }
}

function bindRemedialCodingEvents() {
    document.getElementById('codingYearSelect')?.addEventListener('change', () => {
        populateCodingLevelOptions();
        populateCodingStreamOptions();
        populateCodingClassOptions();
        refreshRemedialCodingView();
    });

    document.getElementById('codingLevelSelect')?.addEventListener('change', () => {
        populateCodingStreamOptions();
        populateCodingClassOptions();
        refreshRemedialCodingView();
    });

    document.getElementById('codingStreamSelect')?.addEventListener('change', () => {
        populateCodingClassOptions();
        refreshRemedialCodingView();
    });

    document.getElementById('codingClassSelect')?.addEventListener('change', refreshRemedialCodingView);
    document.getElementById('codingDigitsInput')?.addEventListener('input', refreshRemedialCodingView);
    document.getElementById('codingPrefixModeSelect')?.addEventListener('change', () => {
        updateCustomPrefixVisibility();
        refreshRemedialCodingView();
    });
    document.getElementById('customPrefixInput')?.addEventListener('input', refreshRemedialCodingView);

    document.getElementById('generateCodesBtn')?.addEventListener('click', generateCodesForCurrentSelection);
    document.getElementById('regenerateCodesBtn')?.addEventListener('click', regenerateCodesForCurrentYear);
    document.getElementById('printSecretListBtn')?.addEventListener('click', printSecretCodingList);
    document.getElementById('printAnonymousCardsBtn')?.addEventListener('click', printAnonymousCodingCards);
    document.getElementById('printScoreListsBtn')?.addEventListener('click', printRemedialScoreReservationLists);
    document.getElementById('printAdminScoreListsBtn')?.addEventListener('click', printAdministrativeScoreReservationLists);
}

function populateCodingFilters() {
    populateCodingYearOptions();
    populateCodingLevelOptions();
    populateCodingStreamOptions();
    populateCodingClassOptions();
    updateCustomPrefixVisibility();
}

function populateCodingYearOptions() {
    const yearSelect = document.getElementById('codingYearSelect');
    if (!yearSelect) return;

    const years = Array.from(new Set(remedialStudents.map(getStudentYear).filter(Boolean))).sort((a, b) => b.localeCompare(a));
    const currentValue = yearSelect.value;

    yearSelect.innerHTML = '';
    years.forEach(year => {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    });

    if (currentValue && years.includes(currentValue)) {
        yearSelect.value = currentValue;
    } else if (years.length > 0) {
        yearSelect.value = years[0];
    }
}

function populateCodingLevelOptions() {
    const levelSelect = document.getElementById('codingLevelSelect');
    const selectedYear = document.getElementById('codingYearSelect')?.value || '';
    if (!levelSelect) return;

    const stage = getRemedialStage();
    const allowedLevelCodes = getAllowedRemedialLevels(stage);
    const currentValue = levelSelect.value;

    const levels = Array.from(new Set(
        remedialStudents
            .filter(student => !selectedYear || getStudentYear(student) === selectedYear)
            .map(student => student.level)
            .filter(level => level && isAllowedRemedialLevel(level, stage))
    )).sort((a, b) => {
        const codeA = allowedLevelCodes.find(code => matchLevel(a, code)) || '99';
        const codeB = allowedLevelCodes.find(code => matchLevel(b, code)) || '99';
        return Number(codeA) - Number(codeB);
    });

    levelSelect.innerHTML = '<option value="all">جميع المستويات</option>';
    levels.forEach(level => {
        levelSelect.innerHTML += `<option value="${level}">${level}</option>`;
    });

    if (currentValue && (currentValue === 'all' || levels.includes(currentValue))) {
        levelSelect.value = currentValue;
    } else {
        levelSelect.value = 'all';
    }
}

function populateCodingStreamOptions() {
    const streamGroup = document.getElementById('codingStreamGroup');
    const streamSelect = document.getElementById('codingStreamSelect');
    if (!streamGroup || !streamSelect) return;

    const stage = getRemedialStage();
    if (stage !== 'secondary') {
        streamGroup.style.display = 'none';
        streamSelect.innerHTML = '<option value="">جميع الشعب</option>';
        return;
    }

    streamGroup.style.display = 'flex';

    const selectedYear = document.getElementById('codingYearSelect')?.value || '';
    const selectedLevel = document.getElementById('codingLevelSelect')?.value || 'all';
    const currentValue = streamSelect.value;

    const streams = Array.from(new Set(
        remedialStudents
            .filter(student => !selectedYear || getStudentYear(student) === selectedYear)
            .filter(student => levelMatchesSelection(student.level, selectedLevel))
            .map(student => student.stream)
            .filter(Boolean)
    )).sort();

    streamSelect.innerHTML = '<option value="">جميع الشعب</option>';
    streams.forEach(stream => {
        streamSelect.innerHTML += `<option value="${stream}">${escapeHtml(getShortStreamName(stream))}</option>`;
    });

    if (currentValue && streams.includes(currentValue)) {
        streamSelect.value = currentValue;
    } else {
        streamSelect.value = '';
    }
}

function populateCodingClassOptions() {
    const classSelect = document.getElementById('codingClassSelect');
    if (!classSelect) return;

    const filters = getRemedialCodingFilterState();
    const currentValue = classSelect.value;
    const classes = Array.from(new Set(
        remedialStudents
            .filter(student => !filters.year || getStudentYear(student) === filters.year)
            .filter(student => levelMatchesSelection(student.level, filters.level))
            .filter(student => !filters.stream || student.stream === filters.stream)
            .map(student => String(student.class || '').trim())
            .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'ar'));

    classSelect.innerHTML = '<option value="all">جميع الأقسام</option>';
    classes.forEach(className => {
        classSelect.innerHTML += `<option value="${className}">${className}</option>`;
    });

    if (currentValue && (currentValue === 'all' || classes.includes(currentValue))) {
        classSelect.value = currentValue;
    } else {
        classSelect.value = 'all';
    }
}

function updateCustomPrefixVisibility() {
    const prefixMode = document.getElementById('codingPrefixModeSelect')?.value || 'auto';
    const customGroup = document.getElementById('customPrefixGroup');
    if (!customGroup) return;
    customGroup.classList.toggle('hidden', prefixMode !== 'custom');
}

function getRemedialCodingFilterState() {
    return {
        year: document.getElementById('codingYearSelect')?.value || '',
        level: document.getElementById('codingLevelSelect')?.value || 'all',
        stream: document.getElementById('codingStreamSelect')?.value || '',
        className: document.getElementById('codingClassSelect')?.value || 'all',
        digits: sanitizeCodingInteger(document.getElementById('codingDigitsInput')?.value, 4, 3, 6),
        prefixMode: document.getElementById('codingPrefixModeSelect')?.value || 'auto',
        customPrefix: sanitizePrefix(document.getElementById('customPrefixInput')?.value || 'R')
    };
}

function sanitizeCodingInteger(value, fallback, minValue, maxValue) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(minValue, Math.min(maxValue, parsed));
}

function sanitizePrefix(value) {
    return String(value || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8);
}

function getFilteredStudentsForCoding() {
    const filters = getRemedialCodingFilterState();
    return remedialStudents
        .filter(student => !filters.year || getStudentYear(student) === filters.year)
        .filter(student => levelMatchesSelection(student.level, filters.level))
        .filter(student => !filters.stream || student.stream === filters.stream)
        .filter(student => filters.className === 'all' || String(student.class || '').trim() === filters.className)
        .sort(compareStudentsForCoding);
}

function compareStudentsForCoding(a, b) {
    const levelOrderA = getCodingLevelOrder(a.level);
    const levelOrderB = getCodingLevelOrder(b.level);
    if (levelOrderA !== levelOrderB) return levelOrderA - levelOrderB;

    const streamA = getShortStreamName(a.stream || '').toString();
    const streamB = getShortStreamName(b.stream || '').toString();
    const streamCompare = streamA.localeCompare(streamB, 'ar');
    if (streamCompare !== 0) return streamCompare;

    const classA = String(a.class || '').padStart(4, '0');
    const classB = String(b.class || '').padStart(4, '0');
    const classCompare = classA.localeCompare(classB, 'ar');
    if (classCompare !== 0) return classCompare;

    return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
}

function getCodingLevelOrder(levelValue) {
    if (matchLevel(levelValue, '1')) return 1;
    if (matchLevel(levelValue, '2')) return 2;
    if (matchLevel(levelValue, '3')) return 3;
    if (matchLevel(levelValue, '4')) return 4;
    return 99;
}

function loadRemedialCodeRegistry() {
    try {
        return DBSync.get(REMEDIAL_CODES_STORAGE_KEY) || {};
    } catch (error) {
        console.warn('Failed to load remedial code registry:', error);
        return {};
    }
}

function saveRemedialCodeRegistry() {
    DBSync.set(REMEDIAL_CODES_STORAGE_KEY, remedialCodeRegistry);
}

function getStudentFingerprint(student) {
    const normalizer = typeof normalizeArabic === 'function'
        ? normalizeArabic
        : (value) => String(value || '').trim().toLowerCase();
    const birthDate = student.birth_date || student.birthDate || student.dob || '';
    return [
        getStudentYear(student),
        normalizer(student.name || ''),
        normalizer(student.level || ''),
        normalizer(student.stream || ''),
        String(student.class || '').trim(),
        String(birthDate || '').trim()
    ].join('|');
}

function getAutomaticPrefixForStudent(student) {
    const levelCode = matchLevel(student.level, '1')
        ? '1'
        : matchLevel(student.level, '2')
            ? '2'
            : matchLevel(student.level, '3')
                ? '3'
                : 'X';

    if (getRemedialStage() !== 'secondary') {
        return `RM${levelCode}`;
    }

    const streamCode = normalizeSecondaryStreamCode(student.stream || '');
    const streamMap = {
        common_arts: 'CA',
        common_science: 'CS',
        arts: 'AF',
        languages: 'LE',
        science: 'ST',
        tech_math: 'TM',
        math: 'MA',
        management: 'MG'
    };

    return `RS${levelCode}${streamMap[streamCode] || 'GN'}`;
}

function buildStudentCode(student, sequence, options, usedCodes) {
    const prefix = options.prefixMode === 'custom' && options.customPrefix
        ? options.customPrefix
        : getAutomaticPrefixForStudent(student);
    const baseCode = `${prefix}-${String(sequence).padStart(options.digits, '0')}`;
    let resolvedCode = baseCode;
    let suffixCounter = 1;

    while (usedCodes.has(resolvedCode)) {
        resolvedCode = `${baseCode}-${suffixCounter}`;
        suffixCounter += 1;
    }

    return {
        code: resolvedCode,
        prefix: prefix,
        sequence: sequence
    };
}

function ensureCodesForYear(year, options, forceRegenerate) {
    if (!year) return false;

    const yearStudents = remedialStudents
        .filter(student => getStudentYear(student) === year)
        .sort(compareStudentsForCoding);

    if (!remedialCodeRegistry[year] || forceRegenerate) {
        remedialCodeRegistry[year] = {};
    }

    const yearStore = remedialCodeRegistry[year];
    const usedCodes = new Set();
    let maxSequence = 0;

    Object.keys(yearStore).forEach(fingerprint => {
        const entry = yearStore[fingerprint];
        if (!entry || !entry.code) return;
        usedCodes.add(entry.code);
        if (Number.isFinite(entry.sequence)) {
            maxSequence = Math.max(maxSequence, entry.sequence);
        }
    });

    yearStudents.forEach(student => {
        const fingerprint = getStudentFingerprint(student);
        if (yearStore[fingerprint] && yearStore[fingerprint].code && !forceRegenerate) return;

        maxSequence += 1;
        const builtCode = buildStudentCode(student, maxSequence, options, usedCodes);
        usedCodes.add(builtCode.code);
        yearStore[fingerprint] = {
            code: builtCode.code,
            prefix: builtCode.prefix,
            sequence: builtCode.sequence,
            createdAt: new Date().toISOString()
        };
    });

    saveRemedialCodeRegistry();
    return true;
}

function generateCodesForCurrentSelection() {
    const filters = getRemedialCodingFilterState();
    if (!filters.year) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار السنة الدراسية أولًا.' });
        return;
    }

    ensureCodesForYear(filters.year, filters, false);
    refreshRemedialCodingView();

    Swal.fire({
        icon: 'success',
        title: 'تم تثبيت الأكواد',
        text: 'تم إنشاء الأكواد الناقصة وحفظها لهذه السنة الدراسية دون المساس بالأكواد الموجودة.'
    });
}

function regenerateCodesForCurrentYear() {
    const filters = getRemedialCodingFilterState();
    if (!filters.year) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار السنة الدراسية أولًا.' });
        return;
    }

    Swal.fire({
        icon: 'warning',
        title: 'إعادة توليد الأكواد',
        text: 'سيتم حذف الأكواد الحالية لهذه السنة وإعادة إنشائها من جديد. هل تريد المتابعة؟',
        showCancelButton: true,
        confirmButtonText: 'نعم، أعد التوليد',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#d97706'
    }).then((result) => {
        if (!result.isConfirmed) return;

        ensureCodesForYear(filters.year, filters, true);
        refreshRemedialCodingView();

        Swal.fire({
            icon: 'success',
            title: 'تمت إعادة التوليد',
            text: 'تم حذف الأكواد القديمة لهذه السنة وإنشاء أكواد جديدة بالخيارات الحالية.'
        });
    });
}

function getCodeEntryForStudent(student) {
    const year = getStudentYear(student);
    const fingerprint = getStudentFingerprint(student);
    return remedialCodeRegistry[year]?.[fingerprint] || null;
}

function refreshRemedialCodingView() {
    const filters = getRemedialCodingFilterState();
    const students = getFilteredStudentsForCoding();
    renderedCodedStudents = students.map(student => {
        const codeEntry = getCodeEntryForStudent(student);
        return {
            ...student,
            codeEntry
        };
    });

    updateCodingSummary(renderedCodedStudents);
    renderPrefixPreview(renderedCodedStudents);
    renderCodingTable(renderedCodedStudents);
    updateCodingActionButtons(renderedCodedStudents, filters.year);
}

function updateCodingSummary(students) {
    const codedCount = students.filter(student => !!(student.codeEntry && student.codeEntry.code)).length;
    const prefixes = new Set();
    let subjectCount = 0;

    students.forEach(student => {
        if (student.codeEntry && student.codeEntry.prefix) prefixes.add(student.codeEntry.prefix);
        subjectCount += Array.isArray(student.remedialSubjects) ? student.remedialSubjects.length : 0;
    });

    setText('codingStudentsCount', students.length);
    setText('codingGeneratedCount', codedCount);
    setText('codingPrefixesCount', prefixes.size);
    setText('codingSubjectsCount', subjectCount);
}

function setText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = value;
}

function renderPrefixPreview(students) {
    const wrap = document.getElementById('prefixPreviewWrap');
    if (!wrap) return;

    const counts = new Map();
    students.forEach(student => {
        const prefix = student.codeEntry?.prefix || getAutomaticPrefixForStudent(student);
        counts.set(prefix, (counts.get(prefix) || 0) + 1);
    });

    if (counts.size === 0) {
        wrap.innerHTML = '<span class="prefix-chip">لا توجد بادئات متاحة بعد</span>';
        return;
    }

    wrap.innerHTML = Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0], 'en'))
        .map(([prefix, count]) => `<span class="prefix-chip">${escapeHtml(prefix)} <strong>${count}</strong></span>`)
        .join('');
}

function renderCodingTable(students) {
    const tableBody = document.getElementById('codingTableBody');
    if (!tableBody) return;

    if (!students.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="padding:18px; color:#64748b; font-weight:700;">
                    لا توجد بيانات ضمن التحديد الحالي.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = students.map((student, index) => {
        const code = student.codeEntry?.code || '-';
        const streamName = student.stream ? getShortStreamName(student.stream) : '-';
        const subjectNames = (student.remedialSubjects || []).map(subject => subject.name).filter(Boolean);

        return `
            <tr>
                <td>${index + 1}</td>
                <td><span class="secret-code">${escapeHtml(code)}</span></td>
                <td class="name-cell">${escapeHtml(student.name || '')}</td>
                <td>${escapeHtml(student.level || '-')}</td>
                <td>${escapeHtml(streamName || '-')}</td>
                <td>${escapeHtml(student.class || '-')}</td>
                <td>${formatRoundedTwoDecimals(student.annualAverage || 0)}</td>
                <td title="${escapeHtml(subjectNames.join(' - '))}">
                    <span class="subject-count">
                        <span data-icon="book-open"></span>
                        ${subjectNames.length} مادة
                    </span>
                </td>
                <td>
                    <button class="copy-btn" onclick="copyRemedialCode('${escapeJsString(code)}')">نسخ</button>
                </td>
            </tr>
        `;
    }).join('');

    if (window.IconManager && typeof window.IconManager.render === 'function') {
        window.IconManager.render();
    }
}

function updateCodingActionButtons(students, selectedYear) {
    const hasStudents = students.length > 0;
    const hasCodes = hasStudents && students.every(student => !!(student.codeEntry && student.codeEntry.code));

    const printSecretButton = document.getElementById('printSecretListBtn');
    const printCardsButton = document.getElementById('printAnonymousCardsBtn');
    const printScoreListsButton = document.getElementById('printScoreListsBtn');
    const printAdminScoreListsButton = document.getElementById('printAdminScoreListsBtn');
    const regenerateButton = document.getElementById('regenerateCodesBtn');

    if (printSecretButton) printSecretButton.dataset.baseDisabled = (!hasCodes).toString();
    if (printCardsButton) printCardsButton.dataset.baseDisabled = (!hasCodes).toString();
    if (printScoreListsButton) printScoreListsButton.dataset.baseDisabled = (!hasCodes).toString();
    if (printAdminScoreListsButton) printAdminScoreListsButton.dataset.baseDisabled = (!hasCodes).toString();
    if (regenerateButton) regenerateButton.disabled = !selectedYear;
    applyPrintAccessState();
}

function copyRemedialCode(code) {
    if (!code || code === '-') return;

    const onSuccess = () => {
        Swal.fire({
            toast: true,
            position: 'top',
            icon: 'success',
            title: 'تم نسخ الرمز',
            showConfirmButton: false,
            timer: 1400
        });
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(onSuccess);
        return;
    }

    const tempInput = document.createElement('input');
    tempInput.value = code;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    onSuccess();
}

function renderCodingEmptyState(title, subtitle) {
    const waitArea = document.getElementById('codingWaitArea');
    const resultsArea = document.getElementById('codingResults');
    if (waitArea) {
        waitArea.className = 'empty-state';
        waitArea.innerHTML = `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(subtitle)}</p>`;
    }
    if (resultsArea) resultsArea.classList.add('hidden');
}

function escapeJsString(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getPrintedCodingStudents() {
    return renderedCodedStudents.filter(student => student.codeEntry && student.codeEntry.code);
}

async function printSecretCodingList() {
    if (blockTrialPrint()) {
        return;
    }

    const students = getPrintedCodingStudents();
    if (!students.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد أكواد جاهزة للطباعة ضمن التحديد الحالي.' });
        return;
    }

    const settings = (window.DB && typeof DB.getSettings === 'function') ? (await DB.getSettings() || {}) : {};
    const filters = getRemedialCodingFilterState();
    const yearLabel = filters.year || settings.schoolYear || '.......';
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
    const fontRegularUrl = new URL('../../assets/fonts/Tajawal-Regular.ttf', window.location.href).href;
    const fontBoldUrl = new URL('../../assets/fonts/Tajawal-Bold.ttf', window.location.href).href;
    const printWindow = window.open('', '_blank');

    const rowsMarkup = students.map((student, index) => `
        <tr>
            <td>${index + 1}</td>
            <td class="code-cell">${escapeHtml(student.codeEntry.code)}</td>
            <td class="name-cell">${escapeHtml(student.name || '')}</td>
            <td>${escapeHtml(student.level || '-')}</td>
            <td>${escapeHtml(student.stream ? getShortStreamName(student.stream) : '-')}</td>
            <td>${escapeHtml(student.class || '-')}</td>
            <td>${formatRoundedTwoDecimals(student.annualAverage || 0)}</td>
            <td>${escapeHtml((student.remedialSubjects || []).map(subject => subject.name).join(' - ') || '-')}</td>
        </tr>
    `).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>الكشف السري لترميز المستدركين</title>
            <style>
                @font-face { font-family: 'Tajawal'; font-style: normal; font-weight: 400; src: url('${fontRegularUrl}') format('truetype'); }
                @font-face { font-family: 'Tajawal'; font-style: normal; font-weight: 700; src: url('${fontBoldUrl}') format('truetype'); }
                * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 18px; color: #0f172a; background: white; }
                .report-header { border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 16px; }
                .meta-row { display: flex; justify-content: space-between; gap: 12px; font-size: 10pt; font-weight: 700; margin-bottom: 6px; }
                .report-title { margin: 8px 0; text-align: center; font-size: 18pt; color: #1d4ed8; font-weight: 700; }
                .report-subtitle { margin: 0; text-align: center; color: #475569; font-size: 9.5pt; }
                .info-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
                .info-box { border: 1px solid #000; border-radius: 12px; padding: 10px; text-align: center; background: #f8fbff; }
                .info-box strong { display: block; font-size: 15pt; color: #1d4ed8; margin-bottom: 3px; }
                .info-box span { font-size: 8.5pt; color: #475569; font-weight: 700; }
                table { width: 100%; border-collapse: collapse; font-size: 8.8pt; }
                th, td { border: 1px solid #000; padding: 7px 8px; text-align: center; vertical-align: middle; }
                th { background: #f1f5f9; font-weight: 700; }
                .name-cell { text-align: right; font-weight: 700; }
                .code-cell { font-family: 'Segoe UI', Tahoma, sans-serif; direction: ltr; font-weight: 900; letter-spacing: 0.06em; }
                @page { size: portrait; margin: 1cm; }
            </style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
            <div class="report-header">
                <div class="meta-row">
                    <div>الولاية: ${escapeHtml(settings.wilaya || '.......')}</div>
                    <div>البلدية: ${escapeHtml(settings.municipality || '.......')}</div>
                </div>
                <h1 class="report-title">الكشف السري لترميز المستدركين</h1>
                <p class="report-subtitle">وثيقة داخلية تربط بين التلميذ ورمزه السري الخاص بالامتحان الاستدراكي</p>
                <div class="meta-row" style="margin-top:8px;">
                    <div>السنة الدراسية: ${escapeHtml(yearLabel)}</div>
                    <div>المؤسسة: ${escapeHtml(settings.institutionName || '.......')}</div>
                    <div>تاريخ الطباعة: ${escapeHtml(today)}</div>
                </div>
            </div>

            <div class="info-strip">
                <div class="info-box"><strong>${students.length}</strong><span>تلميذ مرمز</span></div>
                <div class="info-box"><strong>${new Set(students.map(student => student.codeEntry.prefix)).size}</strong><span>بادئات مستخدمة</span></div>
                <div class="info-box"><strong>${students.reduce((sum, student) => sum + (student.remedialSubjects || []).length, 0)}</strong><span>مواد الاستدراك</span></div>
                <div class="info-box"><strong>سري</strong><span>نوع الوثيقة</span></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>الرمز السري</th>
                        <th>الاسم واللقب</th>
                        <th>المستوى</th>
                        <th>الشعبة</th>
                        <th>القسم</th>
                        <th>المعدل</th>
                        <th>مواد الاستدراك</th>
                    </tr>
                </thead>
                <tbody>${rowsMarkup}</tbody>
            </table>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
}

async function printAnonymousCodingCards() {
    if (blockTrialPrint()) {
        return;
    }

    const students = getPrintedCodingStudents();
    if (!students.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد أكواد جاهزة للطباعة ضمن التحديد الحالي.' });
        return;
    }

    const settings = (window.DB && typeof DB.getSettings === 'function') ? (await DB.getSettings() || {}) : {};
    const filters = getRemedialCodingFilterState();
    const yearLabel = filters.year || settings.schoolYear || '.......';
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
    const fontRegularUrl = new URL('../../assets/fonts/Tajawal-Regular.ttf', window.location.href).href;
    const fontBoldUrl = new URL('../../assets/fonts/Tajawal-Bold.ttf', window.location.href).href;
    const printWindow = window.open('', '_blank');

    const cardsMarkup = students.map(student => `
        <article class="code-card">
            <div class="card-header">
                <span>الامتحان الاستدراكي</span>
                <span>${escapeHtml(yearLabel)}</span>
            </div>
            <div class="code-main">${escapeHtml(student.codeEntry.code)}</div>
            <div class="card-meta">
                <div><strong>المستوى:</strong> ${escapeHtml(student.level || '-')}</div>
                <div><strong>الشعبة:</strong> ${escapeHtml(student.stream ? getShortStreamName(student.stream) : '-')}</div>
                <div><strong>المواد:</strong> ${escapeHtml((student.remedialSubjects || []).map(subject => subject.name).join(' - ') || '-')}</div>
            </div>
            <div class="card-footer">
                <span>يوضع هذا الرمز على ورقة الإجابة</span>
            </div>
        </article>
    `).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>بطاقات ترميز المستدركين</title>
            <style>
                @font-face { font-family: 'Tajawal'; font-style: normal; font-weight: 400; src: url('${fontRegularUrl}') format('truetype'); }
                @font-face { font-family: 'Tajawal'; font-style: normal; font-weight: 700; src: url('${fontBoldUrl}') format('truetype'); }
                * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 18px; color: #0f172a; background: white; }
                .report-header { border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 16px; }
                .meta-row { display: flex; justify-content: space-between; gap: 12px; font-size: 10pt; font-weight: 700; margin-bottom: 6px; }
                .report-title { margin: 8px 0; text-align: center; font-size: 18pt; color: #1d4ed8; font-weight: 700; }
                .report-subtitle { margin: 0; text-align: center; color: #475569; font-size: 9.5pt; }
                .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .code-card { border: 1.2px solid #000; border-radius: 14px; padding: 10px 11px; break-inside: avoid; page-break-inside: avoid; min-height: 138px; display: flex; flex-direction: column; justify-content: space-between; }
                .card-header { display: flex; justify-content: space-between; gap: 10px; color: #475569; font-size: 9pt; font-weight: 700; }
                .code-main { text-align: center; margin: 10px 0 8px; font-size: 18pt; font-weight: 900; letter-spacing: 0.08em; direction: ltr; color: #1d4ed8; font-family: 'Segoe UI', Tahoma, sans-serif; }
                .card-meta { display: grid; gap: 4px; font-size: 8.1pt; font-weight: 700; line-height: 1.45; }
                .card-footer { margin-top: 8px; text-align: center; color: #64748b; font-size: 7.6pt; font-weight: 700; }
                @page { size: A4 portrait; margin: 1cm; }
            </style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
            <div class="report-header">
                <div class="meta-row">
                    <div>الولاية: ${escapeHtml(settings.wilaya || '.......')}</div>
                    <div>البلدية: ${escapeHtml(settings.municipality || '.......')}</div>
                </div>
                <h1 class="report-title">بطاقات ترميز المستدركين</h1>
                <p class="report-subtitle">بطاقات مجهولة مخصصة للاستعمال أثناء تنظيم أوراق الامتحان الاستدراكي</p>
                <div class="meta-row" style="margin-top:8px;">
                    <div>السنة الدراسية: ${escapeHtml(yearLabel)}</div>
                    <div>المؤسسة: ${escapeHtml(settings.institutionName || '.......')}</div>
                    <div>تاريخ الطباعة: ${escapeHtml(today)}</div>
                </div>
            </div>
            <section class="cards-grid">${cardsMarkup}</section>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
}

function getStudentRemedialSubjectMap(student) {
    const subjectMap = new Map();
    (student.remedialSubjects || []).forEach(subject => {
        if (!subject || !subject.name) return;
        subjectMap.set(subject.name, subject);
    });
    return subjectMap;
}

function getCodingPrintGroupDescriptor(student) {
    const stage = getRemedialStage();
    if (stage === 'secondary') {
        const streamName = student.stream ? getShortStreamName(student.stream) : '-';
        return {
            key: [student.level || '', streamName || '', student.class || ''].join('|'),
            title: `${student.level || '-'} / ${streamName || '-'} / القسم ${student.class || '-'}`,
            level: student.level || '-',
            stream: streamName || '-',
            className: student.class || '-'
        };
    }

    return {
        key: [student.level || '', student.class || ''].join('|'),
        title: `${student.level || '-'} / القسم ${student.class || '-'}`,
        level: student.level || '-',
        stream: '',
        className: student.class || '-'
    };
}

function compareSubjectNamesArabic(a, b) {
    return String(a || '').localeCompare(String(b || ''), 'ar');
}

function buildScoreReservationPages(students) {
    const grouped = new Map();

    students.forEach(student => {
        const descriptor = getCodingPrintGroupDescriptor(student);
        if (!grouped.has(descriptor.key)) {
            grouped.set(descriptor.key, {
                descriptor,
                students: []
            });
        }
        grouped.get(descriptor.key).students.push(student);
    });

    const pages = [];
    Array.from(grouped.values())
        .sort((a, b) => a.descriptor.title.localeCompare(b.descriptor.title, 'ar'))
        .forEach(group => {
            const allSubjects = Array.from(new Set(
                group.students.flatMap(student => (student.remedialSubjects || []).map(subject => subject.name).filter(Boolean))
            )).sort(compareSubjectNamesArabic);

            allSubjects.forEach(targetSubject => {
                const subjectStudents = group.students.filter(student =>
                    (student.remedialSubjects || []).some(subject => subject.name === targetSubject)
                );

                if (!subjectStudents.length) return;

                const subjectColumns = [targetSubject].concat(allSubjects.filter(subject => subject !== targetSubject));
                pages.push({
                    group: group.descriptor,
                    subject: targetSubject,
                    subjectColumns,
                    students: subjectStudents
                });
            });
        });

    return pages;
}

async function printRemedialScoreReservationLists() {
    if (blockTrialPrint()) {
        return;
    }

    const students = getPrintedCodingStudents();
    if (!students.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد أكواد جاهزة للطباعة ضمن التحديد الحالي.' });
        return;
    }

    const pages = buildScoreReservationPages(students);
    if (!pages.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'تعذر إنشاء قوائم حجز النقاط من التحديد الحالي.' });
        return;
    }

    const settings = (window.DB && typeof DB.getSettings === 'function') ? (await DB.getSettings() || {}) : {};
    const filters = getRemedialCodingFilterState();
    const yearLabel = filters.year || settings.schoolYear || '.......';
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
    const fontRegularUrl = new URL('../../assets/fonts/Tajawal-Regular.ttf', window.location.href).href;
    const fontBoldUrl = new URL('../../assets/fonts/Tajawal-Bold.ttf', window.location.href).href;
    const printWindow = window.open('', '_blank');

    const pagesMarkup = pages.map((page, pageIndex) => {
        const rowsMarkup = page.students.map((student, index) => {
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td class="code-cell">${escapeHtml(student.codeEntry.code)}</td>
                    <td class="blank-score-cell"></td>
                    <td class="notes-cell"></td>
                    <td class="signature-cell"></td>
                </tr>
            `;
        }).join('');

        return `
            <section class="score-page ${pageIndex === pages.length - 1 ? 'last-page' : ''}">
                <div class="page-head">
                    <div class="meta-row">
                        <div>الولاية: ${escapeHtml(settings.wilaya || '.......')}</div>
                        <div>البلدية: ${escapeHtml(settings.municipality || '.......')}</div>
                    </div>
                    <h1 class="report-title">قائمة حجز نقاط الاستدراك - للمصحح</h1>
                    <p class="report-subtitle">نسخة المصحح (أغفال) - تملأ من طرف أستاذ المادة</p>
                    <div class="meta-row" style="margin-top:8px;">
                        <div>السنة الدراسية: ${escapeHtml(yearLabel)}</div>
                        <div>المؤسسة: ${escapeHtml(settings.institutionName || '.......')}</div>
                        <div>تاريخ الطباعة: ${escapeHtml(today)}</div>
                    </div>
                </div>

                <div class="subject-banner">
                    <span><strong>القسم:</strong> ${escapeHtml(page.group.title)}</span>
                    <span><strong>المادة:</strong> ${escapeHtml(page.subject)}</span>
                    <span><strong>عدد التلاميذ:</strong> ${page.students.length}</span>
                </div>

                <table class="score-table">
                    <thead>
                        <tr>
                            <th width="5%">#</th>
                            <th width="25%">الرمز السري</th>
                            <th width="25%">نقطة ${escapeHtml(page.subject)} بعد الاستدراك</th>
                            <th width="25%">ملاحظات</th>
                            <th width="20%">التوقيع</th>
                        </tr>
                    </thead>
                    <tbody>${rowsMarkup}</tbody>
                </table>

                <div class="admin-signature-row">
                    <div class="admin-signature-box">إمضاء الأستاذ المصحح</div>
                </div>
            </section>
        `;
    }).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>قوائم حجز نقاط الاستدراك للمصحح</title>
            <style>
                @font-face { font-family: 'Tajawal'; font-style: normal; font-weight: 400; src: url('${fontRegularUrl}') format('truetype'); }
                @font-face { font-family: 'Tajawal'; font-style: normal; font-weight: 700; src: url('${fontBoldUrl}') format('truetype'); }
                * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 18px; color: #0f172a; background: white; }
                .score-page { break-after: page; page-break-after: always; }
                .score-page.last-page { break-after: auto; page-break-after: auto; }
                .page-head { border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 14px; }
                .meta-row { display: flex; justify-content: space-between; gap: 12px; font-size: 10pt; font-weight: 700; margin-bottom: 6px; }
                .report-title { margin: 8px 0; text-align: center; font-size: 18pt; color: #1d4ed8; font-weight: 700; }
                .report-subtitle { margin: 0; text-align: center; color: #475569; font-size: 9.5pt; }
                .subject-banner { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; border: 1px solid #000; border-radius: 12px; padding: 10px 12px; background: #f8fbff; margin-bottom: 12px; font-size: 9.3pt; font-weight: 700; }
                .score-table { width: 100%; border-collapse: collapse; font-size: 10pt; table-layout: fixed; }
                .score-table th, .score-table td { border: 1px solid #000; padding: 8px 6px; text-align: center; vertical-align: middle; }
                .score-table th { background: #f1f5f9; font-weight: 700; }
                .code-cell { font-family: 'Segoe UI', Tahoma, sans-serif; direction: ltr; font-weight: 900; letter-spacing: 0.06em; font-size: 11pt; }
                .blank-score-cell { min-height: 35px; background: #fff; }
                .notes-cell { min-height: 35px; background: #fff; }
                .signature-cell { min-height: 35px; background: #fff; }
                .admin-signature-row { margin-top: 18px; display: flex; justify-content: flex-end; }
                .admin-signature-box { min-width: 190px; text-align: center; font-size: 10pt; font-weight: 700; padding-top: 12px; }
                @page { size: portrait; margin: 1cm; }
            </style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
            ${pagesMarkup}
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
}
function buildAdminScoreReservationPages(students) {
    const grouped = new Map();

    students.forEach(student => {
        const descriptor = getCodingPrintGroupDescriptor(student);
        if (!grouped.has(descriptor.key)) {
            grouped.set(descriptor.key, {
                descriptor,
                students: []
            });
        }
        grouped.get(descriptor.key).students.push(student);
    });

    const pages = [];
    Array.from(grouped.values())
        .sort((a, b) => a.descriptor.title.localeCompare(b.descriptor.title, 'ar'))
        .forEach(group => {
            const allSubjects = Array.from(new Set(
                group.students.flatMap(student => (student.remedialSubjects || []).map(subject => subject.name).filter(Boolean))
            )).sort(compareSubjectNamesArabic);

            pages.push({
                group: group.descriptor,
                subjectColumns: allSubjects,
                students: group.students
            });
        });

    return pages;
}

async function printAdministrativeScoreReservationLists() {
    if (blockTrialPrint()) {
        return;
    }

    const students = getPrintedCodingStudents();
    if (!students.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد أكواد جاهزة للطباعة ضمن التحديد الحالي.' });
        return;
    }

    const pages = buildAdminScoreReservationPages(students);
    if (!pages.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'تعذر إنشاء القوائم الإدارية من التحديد الحالي.' });
        return;
    }

    const settings = (window.DB && typeof DB.getSettings === 'function') ? (await DB.getSettings() || {}) : {};
    const filters = getRemedialCodingFilterState();
    const yearLabel = filters.year || settings.schoolYear || '.......';
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
    const fontRegularUrl = new URL('../../assets/fonts/Tajawal-Regular.ttf', window.location.href).href;
    const fontBoldUrl = new URL('../../assets/fonts/Tajawal-Bold.ttf', window.location.href).href;
    const printWindow = window.open('', '_blank');

    const pagesMarkup = pages.map((page, pageIndex) => {
        const rowsMarkup = page.students.map((student, index) => {
            const subjectMap = getStudentRemedialSubjectMap(student);
            
            let subjectsListHTML = '';
            page.subjectColumns.forEach(subject => {
                const subjectEntry = subjectMap.get(subject);
                if (subjectEntry) {
                    subjectsListHTML += `
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding: 3px 0;">
                            <span style="font-weight:bold; font-size: 8pt; width: 45%; text-align:right;">${escapeHtml(subject)}</span>
                            <span style="font-size: 8pt; width: 20%; text-align:center;" dir="ltr">${formatRoundedTwoDecimals(subjectEntry.avg || 0)}</span>
                            <span style="width: 35%; text-align:left; color: #94a3b8; font-weight: bold;">➔ ...........</span>
                        </div>
                    `;
                }
            });

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td class="code-cell">${escapeHtml(student.codeEntry.code)}</td>
                    <td class="name-cell">${escapeHtml(student.name || '')}</td>
                    <td style="padding: 2px 6px;">${subjectsListHTML}</td>
                    <td class="notes-cell"></td>
                    <td class="signature-cell"></td>
                </tr>
            `;
        }).join('');

        return `
            <section class="score-page ${pageIndex === pages.length - 1 ? 'last-page' : ''}">
                <div class="page-head">
                    <div class="meta-row">
                        <div>الولاية: ${escapeHtml(settings.wilaya || '.......')}</div>
                        <div>البلدية: ${escapeHtml(settings.municipality || '.......')}</div>
                    </div>
                    <h1 class="report-title">قائمة حجز نقاط الاستدراك - إدارية</h1>
                    <p class="report-subtitle">نسخة داخلية بالأسماء الحقيقية لمتابعة حجز نقاط الاستدراك</p>
                    <div class="meta-row" style="margin-top:8px;">
                        <div>السنة الدراسية: ${escapeHtml(yearLabel)}</div>
                        <div>المؤسسة: ${escapeHtml(settings.institutionName || '.......')}</div>
                        <div>تاريخ الطباعة: ${escapeHtml(today)}</div>
                    </div>
                </div>

                <div class="subject-banner">
                    <span><strong>القسم:</strong> ${escapeHtml(page.group.title)}</span>
                    <span><strong>عدد التلاميذ:</strong> ${page.students.length}</span>
                </div>

                <table class="score-table">
                    <thead>
                        <tr>
                            <th width="4%">#</th>
                            <th width="15%">الرمز السري</th>
                            <th width="23%">الاسم واللقب</th>
                            <th width="38%">المواد المعنية وحجز النقاط</th>
                            <th width="10%">ملاحظات</th>
                            <th width="10%">التوقيع</th>
                        </tr>
                    </thead>
                    <tbody>${rowsMarkup}</tbody>
                </table>

                <div class="admin-signature-row">
                    <div class="admin-signature-box">إمضاء الإدارة</div>
                </div>
            </section>
        `;
    }).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>القوائم الإدارية لحجز نقاط الاستدراك</title>
            <style>
                @font-face { font-family: 'Tajawal'; font-style: normal; font-weight: 400; src: url('${fontRegularUrl}') format('truetype'); }
                @font-face { font-family: 'Tajawal'; font-style: normal; font-weight: 700; src: url('${fontBoldUrl}') format('truetype'); }
                * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 18px; color: #0f172a; background: white; }
                .score-page { break-after: page; page-break-after: always; }
                .score-page.last-page { break-after: auto; page-break-after: auto; }
                .page-head { border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 14px; }
                .meta-row { display: flex; justify-content: space-between; gap: 12px; font-size: 10pt; font-weight: 700; margin-bottom: 6px; }
                .report-title { margin: 8px 0; text-align: center; font-size: 18pt; color: #1d4ed8; font-weight: 700; }
                .report-subtitle { margin: 0; text-align: center; color: #475569; font-size: 9.5pt; }
                .subject-banner { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; border: 1px solid #000; border-radius: 12px; padding: 10px 12px; background: #f8fbff; margin-bottom: 12px; font-size: 9.3pt; font-weight: 700; }
                .score-table { width: 100%; border-collapse: collapse; font-size: 8.2pt; table-layout: fixed; }
                .score-table th, .score-table td { border: 1px solid #000; padding: 7px 6px; text-align: center; vertical-align: middle; }
                .score-table th { background: #f1f5f9; font-weight: 700; }
                .code-cell { font-family: 'Segoe UI', Tahoma, sans-serif; direction: ltr; font-weight: 900; letter-spacing: 0.06em; }
                .name-cell { text-align: right; font-weight: 700; }
                .prev-score-cell { font-weight: 700; }
                .muted-cell { background: #e5e7eb; color: #6b7280; }
                .current-subject-cell { background: #dbeafe; color: #1d4ed8; }
                .blank-score-cell { min-height: 30px; background: #fff; }
                .notes-cell { min-height: 30px; background: #fff; }
                .signature-cell { min-height: 30px; background: #fff; }
                .admin-signature-row { margin-top: 18px; display: flex; justify-content: flex-end; }
                .admin-signature-box { min-width: 190px; text-align: center; font-size: 10pt; font-weight: 700; padding-top: 12px; }
                @page { size: portrait; margin: 1cm; }
            </style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
            ${pagesMarkup}
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
}
