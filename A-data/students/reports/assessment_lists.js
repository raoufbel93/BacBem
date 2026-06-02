let allStudents = [];
let filteredStudents = [];
let isSecondary = false;

const DEFAULT_COLUMN_CONFIG = {
    single: [
        { id: "col_index", label: "#", visible: true, isCustom: false, widthClass: "col-narrow", isIndex: true },
        { id: "col_lastName", label: "اللقب", visible: true, isCustom: false, widthClass: "col-name" },
        { id: "col_firstName", label: "الاسم", visible: true, isCustom: false, widthClass: "col-name" },
        { id: "col_gender", label: "الجنس", visible: true, isCustom: false, widthClass: "col-narrow" },
        { id: "col_dob", label: "تاريخ الميلاد", visible: true, isCustom: false, widthClass: "col-date" },
        { id: "col_eval", label: "التقييم المستمر", visible: true, isCustom: false, widthClass: "col-grade" },
        { id: "col_exam", label: "الفرض", visible: true, isCustom: false, widthClass: "col-grade" },
        { id: "col_test", label: "الاختبار", visible: true, isCustom: false, widthClass: "col-grade" },
        { id: "col_note", label: "ملاحظة", visible: true, isCustom: false, widthClass: "col-note" }
    ],
    all: [
        { id: "col_index", label: "#", visible: true, isCustom: false, widthClass: "col-narrow", isIndex: true },
        { id: "col_lastName", label: "اللقب", visible: true, isCustom: false, widthClass: "col-name-wide" },
        { id: "col_firstName", label: "الاسم", visible: true, isCustom: false, widthClass: "col-name-wide" },
        { id: "col_eval1", label: "ت.م (ف1)", visible: true, isCustom: false, widthClass: "col-grade" },
        { id: "col_exam1", label: "الفرض (ف1)", visible: true, isCustom: false, widthClass: "col-grade" },
        { id: "col_test1", label: "الاختبار (ف1)", visible: true, isCustom: false, widthClass: "col-grade trim-end" },
        { id: "col_eval2", label: "ت.م (ف2)", visible: true, isCustom: false, widthClass: "col-grade" },
        { id: "col_exam2", label: "الفرض (ف2)", visible: true, isCustom: false, widthClass: "col-grade" },
        { id: "col_test2", label: "الاختبار (ف2)", visible: true, isCustom: false, widthClass: "col-grade trim-end" },
        { id: "col_eval3", label: "ت.م (ف3)", visible: true, isCustom: false, widthClass: "col-grade" },
        { id: "col_exam3", label: "الفرض (ف3)", visible: true, isCustom: false, widthClass: "col-grade" },
        { id: "col_test3", label: "الاختبار (ف3)", visible: true, isCustom: false, widthClass: "col-grade" }
    ]
};

let currentColumnConfig = JSON.parse(JSON.stringify(DEFAULT_COLUMN_CONFIG));
let pendingColumnConfig = null;

const streamAliases = {

    'common_science': 'جذع مشترك علوم وتكنولوجيا',

    'common_arts': 'جذع مشترك آداب',

    'science': 'علوم تجريبية',

    'math': 'رياضيات',

    'tech_math': 'تقني رياضي',

    'tech_math_civil': 'تقني رياضي (هندسة مدنية)',

    'tech_math_mech': 'تقني رياضي (هندسة ميكانيكية)',

    'tech_math_elec': 'تقني رياضي (هندسة كهربائية)',

    'tech_math_methods': 'تقني رياضي (هندسة الطرائق)',

    'management': 'تسيير واقتصاد',

    'languages': 'لغات أجنبية',

    'arts': 'آداب وفلسفة',

    // Aliases for compatibility

    'letters': 'آداب وفلسفة',

    'maths': 'رياضيات',

    'foreign_languages': 'لغات أجنبية',

    'common_letters': 'جذع مشترك آداب',

    'tech_elm': 'تقني رياضي (هندسة كهربائية)',

    'tech_civ': 'تقني رياضي (هندسة مدنية)',

    'tech_mec': 'تقني رياضي (هندسة ميكانيكية)',

    'tech_pro': 'تقني رياضي (هندسة الطرائق)'

};

function getStreamName(code) {

    if (!code) return '';

    return streamAliases[code] || code;

}

document.addEventListener('DOMContentLoaded', async () => {
    const settings = await DB.getSettings();

    // Inject School Year Badge
    const yearBadge = document.getElementById('currentYearBadge');
    if (yearBadge) {
        yearBadge.innerHTML = '<i class="fas fa-graduation-cap"></i> ' + (settings.schoolYear || 'العام الحالي');
    }

    await loadStudents();
    await populateYearDropdown(settings.schoolYear || settings.currentAcademicYear);
    populateFilters();
    updateTable();

    document.getElementById('yearSelect')?.addEventListener('change', handleYearChange);
});

async function populateYearDropdown(defaultYear) {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;

    // Get unique years from database
    const studentsForAllYears = await DB.getStudents(false, true) || [];
    const years = new Set();
    studentsForAllYears.forEach(s => {
        const y = s.academic_year || s.schoolYear || s.year;
        if (y) years.add(y);
    });

    if (years.size === 0 && defaultYear) years.add(defaultYear);

    const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
    yearSelect.innerHTML = '';
    sortedYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    });

    if (defaultYear && years.has(defaultYear)) {
        yearSelect.value = defaultYear;
    } else if (sortedYears.length > 0) {
        yearSelect.value = sortedYears[0];
    }
}

async function handleYearChange() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;

    await loadStudents(yearSelect.value);
    populateFilters();
    updateTable();
}

async function loadStudents(year = null) {
    const settings = await DB.getSettings();
    const targetYear = year || settings.schoolYear || settings.currentAcademicYear;
    
    allStudents = await DB.getStudents(false, targetYear);
    
    // Fallback if no students for specific year
    if (allStudents.length === 0 && !year) {
        allStudents = await DB.getStudents() || [];
    }

    isSecondary = settings.educationStage === 'secondary';

    const savedConfig = await DB.get('assessmentColumnConfig');
    if (savedConfig) {
        currentColumnConfig = savedConfig;
    }
}

function populateFilters() {

    const levels = [...new Set(allStudents.map(s => s.level))].sort();

    const levelSelect = document.getElementById('levelSelect');

    levelSelect.innerHTML = '<option value="">-- اختر المستوى --</option>';

    levels.forEach(l => {

        if (l) {

            const opt = document.createElement('option');

            opt.value = l;

            opt.textContent = l;

            levelSelect.appendChild(opt);

        }

    });

    if (isSecondary) {

        document.getElementById('streamFilterContainer').style.display = 'block';

        levelSelect.onchange = () => {

            updateStreamFilter();

            updateClassFilter();

            updateTable();

        };

        updateStreamFilter();

    } else {

        document.getElementById('streamFilterContainer').style.display = 'none';

    }

}

function updateStreamFilter() {

    if (!isSecondary) return;

    const selectedLevel = document.getElementById('levelSelect').value;

    const streamSelect = document.getElementById('streamSelect');

    let streams = [];

    if (selectedLevel) {

        streams = [...new Set(allStudents.filter(s => s.level === selectedLevel && s.stream).map(s => s.stream))].sort();

    } else {

        streams = [...new Set(allStudents.filter(s => s.stream).map(s => s.stream))].sort();

    }

    const currentStream = streamSelect.value;

    streamSelect.innerHTML = '<option value="">-- اختر الشعبة --</option>';

    streams.forEach(s => {

        const opt = document.createElement('option');

        opt.value = s;

        opt.textContent = getStreamName(s);

        streamSelect.appendChild(opt);

    });

    // Try to preserve selection if possible, otherwise reset

    if (streams.includes(currentStream)) {

        streamSelect.value = currentStream;

    }

}

function updateClassFilter() {

    const selectedLevel = document.getElementById('levelSelect').value;

    const selectedStream = isSecondary ? document.getElementById('streamSelect').value : null;

    const classSelect = document.getElementById('classSelect');

    let classes = [];

    // Filter by level

    let tempStudents = selectedLevel ? allStudents.filter(s => s.level === selectedLevel) : allStudents;

    // Filter by stream if secondary and stream selected

    if (isSecondary && selectedStream) {

        tempStudents = tempStudents.filter(s => s.stream === selectedStream);

    }

    classes = [...new Set(tempStudents.map(s => s.class))].sort();

    classes.sort((a, b) => {

        const na = parseInt(a);

        const nb = parseInt(b);

        if (!isNaN(na) && !isNaN(nb)) return na - nb;

        return String(a).localeCompare(String(b));

    });

    classSelect.innerHTML = '<option value="">-- اختر القسم --</option>';

    classes.forEach(c => {

        if (c) {

            const opt = document.createElement('option');

            opt.value = c;

            opt.textContent = c;

            classSelect.appendChild(opt);

        }

    });

}

function updateTable() {

    const level = document.getElementById('levelSelect').value;

    const stream = isSecondary ? document.getElementById('streamSelect').value : null;

    const cls = document.getElementById('classSelect').value;

    const trimester = document.getElementById('trimesterSelect').value;

    // Filter students

    filteredStudents = allStudents.filter(s => {

        const matchLevel = level ? s.level === level : true;

        const matchStream = (isSecondary && stream) ? s.stream === stream : true;

        const matchClass = cls ? s.class == cls : true;

        return matchLevel && matchStream && matchClass;

    });

    filteredStudents.sort((a, b) => {

        if (a.last_name !== b.last_name) return a.last_name.localeCompare(b.last_name);

        return a.first_name.localeCompare(b.first_name);

    });

    renderTableHeaders(trimester);

    renderTableBody(trimester);

    updateStats();

}

let gridInstance = null;

function renderTableHeaders(trimester) {
    // We do nothing here for DOM. Grid.js handles headers.
}

function getColumnValue(s, colId, index) {
    switch (colId) {
        case 'col_index': return index + 1;
        case 'col_lastName': return s.last_name || '';
        case 'col_firstName': return s.first_name || '';
        case 'col_gender': return s.gender === 'M' ? 'ذ' : 'أ';
        case 'col_dob': return formatDateDisplay(s.birth_date);
        default: return ''; // Empty cells for teachers to write on
    }
}

function renderTableBody(trimester) {
    const wrapper = document.getElementById('gridjs-wrapper');
    if (!wrapper) return;

    const cols = currentColumnConfig[trimester === 'all' ? 'all' : 'single'];
    const visibleCols = cols.filter(c => c.visible);

    // Build Grid.js columns based on config
    const gridColumns = visibleCols.map(c => {
        return {
            id: c.id,
            name: gridjs.html(`<div class="${c.widthClass}">${c.label}</div>`),
            width: c.widthClass.includes('w-') ? 'auto' : '100px', // Fallback, though CSS classes handle it mostly
            attributes: {
                'className': c.widthClass.includes('trim-end') ? 'trim-end' : ''
            }
        };
    });

    const data = filteredStudents.map((s, index) => {
        let rowData = [];
        visibleCols.forEach(c => {
            rowData.push(getColumnValue(s, c.id, index));
        });
        return rowData;
    });

    // Always destroy and recreate to avoid Grid.js pipeline cache corruption
    if (gridInstance) {
        try { gridInstance.destroy(); } catch (e) { }
        gridInstance = null;
    }
    wrapper.innerHTML = '';

    gridInstance = new gridjs.Grid({
        columns: gridColumns,
        data: data,
        search: false,
        sort: false, // Sorting empty cells doesn't make sense for print lists
        pagination: false, // Print lists usually need all students on one page
        language: {
            search: {
                placeholder: 'بحث سريع عن تلميذ...'
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
            }
        },
        className: {
            table: 'data-table assessment-table',
            thead: 'thead-light'
        },
        style: {
            table: { width: '100%' },
            td: { textAlign: 'center', verticalAlign: 'middle', padding: '5px' },
            th: { textAlign: 'center', padding: '8px 5px' }
        }
    }).render(wrapper);

    // Icon consistency for Windows 7
    gridInstance.on('render', () => {
        if (typeof IconManager !== 'undefined') IconManager.render();
    });
}

function updateStats() {
    const statsCard = document.getElementById('statsCard');
    if (!statsCard) return;

    const level = document.getElementById('levelSelect').value;
    const cls = document.getElementById('classSelect').value;

    if (level && cls) {
        const total = filteredStudents.length;
        const males = filteredStudents.filter(s => s.gender === 'M').length;
        const females = total - males;

        document.getElementById('stat-level-class').textContent = level + ' - ' + cls;
        document.getElementById('stat-m').textContent = males;
        document.getElementById('stat-f').textContent = females;
        document.getElementById('stat-total').textContent = total;

        statsCard.style.display = 'flex';
    } else {
        statsCard.style.display = 'none';
    }
}

// Update table to call updateStats instead of updateSummary

function formatDateDisplay(isoDate) {

    if (!isoDate) return '-';

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
            : 'الطباعة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.';
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: message });
        return true;
    }
    return false;
}

async function printAssessmentList() {
    if (blockTrialPrint()) return;

    const level = document.getElementById('levelSelect').value;

    const stream = isSecondary ? document.getElementById('streamSelect').value : null;

    const cls = document.getElementById('classSelect').value;

    const trimester = document.getElementById('trimesterSelect').value;

    if (!level || !cls || (isSecondary && !stream)) {

        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'يرجى اختيار المستوى، الشعبة (للثانوي) والقسم'
        });

        return;

    }

    if (filteredStudents.length === 0) {

        Swal.fire({
            icon: 'info',
            title: 'تنبيه',
            text: 'لا توجد بيانات للطباعة'
        });

        return;

    }

    const settings = await DB.getSettings();

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    const trimesterText = trimester === 'all' ? 'كل الفصول' : `الفصل ${trimester === '1' ? 'الأول' : (trimester === '2' ? 'الثاني' : 'الثالث')}`;

    // Get signer info from signature settings

    const sigSettings = await DB.get('signatureSettings') || {};

    const reportConfig = sigSettings.reportSettings?.['assessment_lists'] || { signer: 'director', showSignature: true };

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }

    const signerName = signerData.fullName || settings.managerName || '';

    // Build table headers

    // Use wider name columns for all trimesters

    const nameStyle = trimester === 'all' ? ' style="min-width: 100px;"' : '';

    const cols = currentColumnConfig[trimester === 'all' ? 'all' : 'single'];
    const visibleCols = cols.filter(c => c.visible);

    let headersHtml = '<tr>';
    visibleCols.forEach(c => {
        headersHtml += `<th style="${c.widthClass.includes('col-name') ? 'width: 18%;' : ''}">${c.label}</th>`;
    });
    headersHtml += '</tr>';

    // Build table rows

    const rowsHtml = filteredStudents.map((s, idx) => {
        let row = `<tr class="animate-fade-in-up stagger-item stagger-${(idx % 10) + 1}">`;
        visibleCols.forEach(c => {
            const classAttr = c.widthClass.includes('trim-end') ? ' class="trim-end"' : '';
            row += `<td${classAttr}>${getColumnValue(s, c.id, idx)}</td>`;
        });
        row += '</tr>';
        return row;
    }).join('');

    const total = filteredStudents.length;

    const males = filteredStudents.filter(s => s.gender === 'M').length;

    const females = total - males;

    const fitToPage = document.getElementById('fitToPage') && document.getElementById('fitToPage').checked;

    // Compact styles for many students (44+) or when fitToPage is checked

    const manyStudents = total >= 44;

    let compactStyles = '';
    const toolbarHead = window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : '';
    const toolbarHtml = window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : '';
    const toolbarScript = window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : '';
    const fontBaseUrl = new URL('../../assets/fonts/', window.location.href).href;

    if (fitToPage || manyStudents) {

        compactStyles = `

                .header-container { margin-bottom: 2px !important; }

            h1, h2, h3 { line-height: 1.1 !important; margin: 0 !important; }

            h2 { font-size: 12pt !important; }

            h3 { font-size: 9pt !important; }

            table { margin-top: 3px !important; }

            th, td { font-size: 8pt!important; padding: ${manyStudents ? '1.75px 2.25px' : '2px 3px'} !important; }

            .footer { margin-top: 10px !important; font-size: 10pt !important; }

        `;

    }

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">

                    <head>

                        <meta charset="UTF-8">

                            <title>طباعة قائمة التقويم</title>

                            <style>
                                @font-face {
                                    font-family: 'Cairo';
                                src: url('${fontBaseUrl}Cairo-Regular.ttf') format('truetype');
                                font-weight: 400;
                                font-style: normal;
                }
                                @font-face {
                                    font-family: 'Cairo';
                                src: url('${fontBaseUrl}Cairo-SemiBold.ttf') format('truetype');
                                font-weight: 600;
                                font-style: normal;
                }
                                @font-face {
                                    font-family: 'Cairo';
                                src: url('${fontBaseUrl}Cairo-Bold.ttf') format('truetype');
                                font-weight: 700;
                                font-style: normal;
                }
                                body {font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0.5cm; }

                                .header-container {width: 100%; margin-bottom: 10px; }

                                .center-text {text-align: center; }

                                h1, h2, h3 {margin: 0; color: #000; padding: 0; }

                                h2 {font-size: 13pt; margin-bottom: 2px; }

                                h3 {font-size: 10pt; margin-bottom: 2px; }

                                .header-row { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; width: 100%; }

                                .header-box {width: 33%; }

                                table {width: 100%; border-collapse: collapse; margin-top: 5px; }

                                th, td {border: 0.5pt solid #000; padding: 2px 3px; text-align: center; font-size: 9pt; line-height: 1.2; }

                                th {background-color: #f0f0f0; font-weight: bold; }

                                .trim-end {border-left: 2.5pt solid #000 !important; }

                                .footer {margin-top: 15px; display: flex; justify-content: space-between; font-size: 11pt; }

                                @media print {

                                    @page {margin: 0.8cm; size: A4 portrait; }

                                body {-webkit-print-color-adjust: exact; }

                                thead {display: table-header-group; }

                                tr { page-break-inside: avoid; }

                }

                                ${compactStyles}

                            </style>

                    ${toolbarHead}
        </head>

                    <body>
            ${toolbarHtml}

                        <div class="header-container">

                            <div class="center-text" style="margin-bottom: 2px;">

                                <h3 style="line-height:1;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                                <h3 style="line-height:1;">وزارة التربية الوطنية</h3>

                            </div>

                            <div class="header-row" style="margin-bottom: 2px;">

                                <div class="header-box" style="text-align: right;">

                                    <h3 style="line-height:1;">المؤسسة: ${settings.institutionName || '...'}</h3>

                                </div>
                                <div class="header-box" style="text-align: left; direction: ltr;">

                                    <h3 style="line-height:1;">مديرية التربية لولاية ${settings.wilaya || '...'}</h3>

                                </div>

                            </div>

                            <div class="center-text" style="margin-bottom: 5px;">

                                <h2 style="text-decoration: underline; margin: 0; line-height:1;">قائمة التقويم</h2>

                            </div>

                            <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 2px 0; background-color: #f9f9f9; align-items: center;">

                                <div class="header-box" style="text-align: right; width: 35%;">

                                    <h3 style="margin:0; line-height:1;">${level} ${stream ? ' - ' + getStreamName(stream) : ''} &nbsp;-&nbsp; القسم: ${cls}</h3>

                                </div>

                                <div class="header-box center-text" style="width: 30%;">

                                    <h3 style="margin:0; font-size: 9pt; line-height:1;">${trimesterText} | العدد: ${total} (ذ: ${males} | أ: ${females})</h3>

                                </div>

                                <div class="header-box" style="text-align: left; width: 35%;" dir="rtl">

                                    <h3 style="margin:0; line-height:1;">السنة الدراسية: ${settings.schoolYear || '2025/2026'}</h3>

                                </div>

                            </div>

                        </div>

                        <table>

                            <thead>

                                ${headersHtml}

                            </thead>

                            <tbody>

                                ${rowsHtml}

                            </tbody>

                        </table>

                        <div class="footer">
                            <div style="text-align: center; min-width: 150px;">
                                الأستاذ(ة)
                            </div>
                            <div style="text-align: center; min-width: 150px; display: flex; flex-direction: column; align-items: center;">
                                <div style="margin-bottom: 5px; align-self: flex-end;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                                <div>${signerTitle}</div>
                            </div>
                        </div>

                        <script>

                            // window.onload auto-print removed

                        </script>

                    ${toolbarScript}
        </body>

                </html>

        `);

    printWindow.document.close();
}

// --- Column Customization Modal Logic ---

function openColumnCustomizationModal() {
    const trimester = document.getElementById('trimesterSelect').value;
    const profile = trimester === 'all' ? 'all' : 'single';
    // Clone config to pending for editing
    pendingColumnConfig = JSON.parse(JSON.stringify(currentColumnConfig[profile]));
    renderCustomizationList();
    document.getElementById('columnCustomizationModal').style.display = 'flex';
}

function closeColumnCustomizationModal() {
    document.getElementById('columnCustomizationModal').style.display = 'none';
    pendingColumnConfig = null;
}

function renderCustomizationList() {
    const container = document.getElementById('columnListContainer');
    container.innerHTML = pendingColumnConfig.map((col, idx) => `
        <div style="display: flex; align-items: center; justify-content: space-between; background: #fff; padding: 10px; border: 1px solid #eee; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" id="col_vis_${idx}" ${col.visible ? 'checked' : ''} ${col.isIndex ? 'disabled checked' : ''} onchange="toggleColVisibility(${idx})" style="transform: scale(1.2);">
                <label for="col_vis_${idx}" style="cursor: pointer; margin: 0; font-weight: ${col.isCustom ? 'bold' : 'normal'}; color: ${col.isCustom ? '#2980b9' : '#333'}">${col.label}</label>
            </div>
            <div style="display: flex; gap: 5px;">
                <button class="btn btn-sm btn-outline" onclick="moveColUp(${idx})" ${idx === 0 ? 'disabled' : ''} style="padding: 2px 8px;">⬆️</button>
                <button class="btn btn-sm btn-outline" onclick="moveColDown(${idx})" ${idx === pendingColumnConfig.length - 1 ? 'disabled' : ''} style="padding: 2px 8px;">⬇️</button>
                ${col.isCustom ? `<button class="btn btn-sm btn-danger" onclick="deleteCustomCol(${idx})" style="padding: 2px 8px;" title="حذف">🗑️</button>` : `<div style="width: 32px"></div>`}
            </div>
        </div>
    `).join('');
}

function toggleColVisibility(idx) {
    if (pendingColumnConfig[idx].isIndex) return; // Cannot hide index column
    pendingColumnConfig[idx].visible = !pendingColumnConfig[idx].visible;
}

function moveColUp(idx) {
    if (idx > 0) {
        const temp = pendingColumnConfig[idx];
        pendingColumnConfig[idx] = pendingColumnConfig[idx - 1];
        pendingColumnConfig[idx - 1] = temp;
        renderCustomizationList();
    }
}

function moveColDown(idx) {
    if (idx < pendingColumnConfig.length - 1) {
        const temp = pendingColumnConfig[idx];
        pendingColumnConfig[idx] = pendingColumnConfig[idx + 1];
        pendingColumnConfig[idx + 1] = temp;
        renderCustomizationList();
    }
}

function addCustomColumn() {
    const input = document.getElementById('newCustomColName');
    const label = input.value.trim();
    if (!label) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى إدخال اسم العمود' });
        return;
    }

    const newCol = {
        id: 'custom_' + Date.now(),
        label: label,
        visible: true,
        isCustom: true,
        widthClass: 'col-note'
    };

    pendingColumnConfig.push(newCol);
    input.value = '';
    renderCustomizationList();
}

function deleteCustomCol(idx) {
    pendingColumnConfig.splice(idx, 1);
    renderCustomizationList();
}

async function saveColumnConfig() {
    const trimester = document.getElementById('trimesterSelect').value;
    const profile = trimester === 'all' ? 'all' : 'single';
    currentColumnConfig[profile] = pendingColumnConfig;

    await DB.set('assessmentColumnConfig', currentColumnConfig);

    closeColumnCustomizationModal();
    updateTable(); // Re-render the table with new columns
    Swal.fire({ icon: 'success', title: 'تم الحفظ', text: 'تم حفظ إعدادات الأعمدة بنجاح', timer: 1500, showConfirmButton: false });
}

async function resetColumnConfig() {
    const trimester = document.getElementById('trimesterSelect').value;
    const profile = trimester === 'all' ? 'all' : 'single';

    currentColumnConfig[profile] = JSON.parse(JSON.stringify(DEFAULT_COLUMN_CONFIG[profile]));
    await DB.set('assessmentColumnConfig', currentColumnConfig);

    closeColumnCustomizationModal();
    updateTable();
    Swal.fire({ icon: 'success', title: 'تم الاستعادة', text: 'تم استعادة الأعمدة الافتراضية', timer: 1500, showConfirmButton: false });
}

// Bind modal functions to window for global access from inline HTML event handlers
window.openColumnCustomizationModal = openColumnCustomizationModal;
window.closeColumnCustomizationModal = closeColumnCustomizationModal;
window.renderCustomizationList = renderCustomizationList;
window.toggleColVisibility = toggleColVisibility;
window.moveColUp = moveColUp;
window.moveColDown = moveColDown;
window.addCustomColumn = addCustomColumn;
window.deleteCustomCol = deleteCustomCol;
window.saveColumnConfig = saveColumnConfig;
window.resetColumnConfig = resetColumnConfig;

async function exportAssessmentListToExcel() {
    if (!window.ExcelExportHelper) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'مكتبة التصدير غير متاحة حالياً.' });
        return;
    }

    if (!filteredStudents.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد بيانات لتصديرها.' });
        return;
    }

    const settings = await DB.getSettings();
    const trimester = document.getElementById('trimesterSelect').value;
    const profile = trimester === 'all' ? 'all' : 'single';
    const visibleCols = currentColumnConfig[profile].filter((column) => column.visible);
    const headers = visibleCols.map((column) => column.label);
    const rows = filteredStudents.map((student, index) => visibleCols.map((column) => getColumnValue(student, column.id, index)));

    const yearText = document.getElementById('yearSelect')?.value || settings.schoolYear || '';
    const trimesterText = document.getElementById('trimesterSelect')?.selectedOptions?.[0]?.textContent || '';
    const levelText = document.getElementById('levelSelect')?.selectedOptions?.[0]?.textContent || '';
    const streamText = document.getElementById('streamSelect')?.selectedOptions?.[0]?.textContent || '';
    const classText = document.getElementById('classSelect')?.selectedOptions?.[0]?.textContent || '';

    await ExcelExportHelper.exportWorkbook({
        fileName: `قائمة_التقويم_${ExcelExportHelper.dateStamp()}.xlsx`,
        sheets: [{
            sheetName: 'قائمة التقويم',
            title: 'قائمة التقويم',
            metaRows: [
                `المؤسسة: ${settings.institutionName || ''}`,
                `السنة الدراسية: ${yearText}`,
                `الفصل: ${trimesterText}`,
                `المستوى: ${levelText}${streamText && !streamText.includes('--') ? ` | الشعبة: ${streamText}` : ''} | القسم: ${classText}`,
                `عدد التلاميذ: ${filteredStudents.length}`
            ],
            headers,
            rows
        }]
    });
}
