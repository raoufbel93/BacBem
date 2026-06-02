function getStudentYear(s) {
    return s.academic_year || s.schoolYear || s.year || '';
}

let allStudents = [];

let filteredRepeaters = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadStudents();
    await populateFilters();
    filterRepeaters();

    document.getElementById('yearSelect')?.addEventListener('change', () => {
        populateFilters();
        filterRepeaters();
    });
});

async function loadStudents() {

    allStudents = await DB.getStudents(false, true);

}

async function populateFilters() {
    const years = new Set();
    const isRepeaterCheck = (s) => {
        if (s.repeat === true || s.repeat === 'true') return true;
        const checkStr = (val) => val && (String(val).includes("معيد") || String(val).includes("يعيد"));
        if (checkStr(s.repeat) || checkStr(s.status) || checkStr(s.notes)) return true;
        return false;
    };

    allStudents.forEach(s => {
        const y = getStudentYear(s);
        if (y) years.add(y);
    });

    // Fallback if no years found
    if (years.size === 0) {
        const settings = await DB.getSettings();
        years.add(settings.currentAcademicYear || settings.schoolYear || DB.getCurrentAcademicYear());
    }

    const yearSelect = document.getElementById('yearSelect');
    const selectedYear = yearSelect?.value;

    if (yearSelect && yearSelect.options.length === 0) {
        yearSelect.innerHTML = '';
        [...years].sort((a,b) => b.localeCompare(a)).forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSelect.appendChild(opt);
        });
        if (years.size > 0) {
            yearSelect.value = [...years].sort((a,b) => b.localeCompare(a))[0];
        }
    }

    const currentYearStudents = allStudents.filter(s => !selectedYear || getStudentYear(s) === selectedYear);
    const repeaters = currentYearStudents.filter(isRepeaterCheck);
    const levels = [...new Set(repeaters.map(s => s.level))].sort();
    const levelSelect = document.getElementById('levelSelect');
    levelSelect.innerHTML = '<option value="">-- كل المستويات --</option>';
    levels.forEach(l => {
        if (l) {
            const opt = document.createElement('option');
            opt.value = l;
            const __fmtLvl = (n) => ({ "1":"الأولى", "2":"الثانية", "3":"الثالثة", "4":"الرابعة" }[String(n).trim()] || n);
            opt.textContent = __fmtLvl(l);
            levelSelect.appendChild(opt);
        }
    });

    const settings = await DB.getSettings();
    const isSecondary = settings.educationStage === 'secondary';
    const streamGroup = document.getElementById('streamFilterGroup');
    const streamHeader = document.getElementById('streamHeader');
    if (streamGroup) streamGroup.style.display = isSecondary ? 'flex' : 'none';
    if (streamHeader) streamHeader.style.display = isSecondary ? '' : 'none';
    if (isSecondary) {
        const streams = [...new Set(repeaters.map(s => s.stream).filter(s => s))].sort();
        const streamSelect = document.getElementById('streamSelect');
        if (streamSelect) {
            streamSelect.innerHTML = '<option value="">-- كل الشعب --</option>' +
                streams.map(s => `<option value="${s}">${s}</option>`).join('');
        }
    }
}

function updateClassFilter() {
    const yearFilter = document.getElementById('yearSelect')?.value;
    const selectedLevel = document.getElementById('levelSelect').value;
    const selectedStream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : null;
    const classSelect = document.getElementById('classSelect');

    const isRepeaterCheck = (s) => {
        if (s.repeat === true || s.repeat === 'true') return true;
        const checkStr = (val) => val && (String(val).includes("معيد") || String(val).includes("يعيد"));
        if (checkStr(s.repeat) || checkStr(s.status) || checkStr(s.notes)) return true;
        return false;
    };

    const repeaters = allStudents.filter(isRepeaterCheck);
    let classes = [];
    if (selectedLevel) {
        let filtered = repeaters.filter(s => s.level === selectedLevel);
        if (yearFilter) filtered = filtered.filter(s => getStudentYear(s) === yearFilter);
        if (selectedStream) filtered = filtered.filter(s => s.stream === selectedStream);
        classes = [...new Set(filtered.map(s => s.class))].sort();
    } else {
        let filtered = repeaters;
        if (yearFilter) filtered = filtered.filter(s => getStudentYear(s) === yearFilter);
        classes = [...new Set(filtered.map(s => s.class))].sort();
    }

    classes.sort((a, b) => {
        const na = parseInt(a);
        const nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });

    const currentClass = classSelect.value;
    classSelect.innerHTML = '<option value="">-- كل الأقسام --</option>';
    classes.forEach(c => {
        if (c) {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            classSelect.appendChild(opt);
        }
    });
    if (currentClass && classes.includes(currentClass)) {
        classSelect.value = currentClass;
    }
}

function filterRepeaters() {
    const year = document.getElementById('yearSelect')?.value;
    const level = document.getElementById('levelSelect').value;
    const cls = document.getElementById('classSelect').value;
    const stream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : null;

    const isRepeaterCheck = (s) => {
        if (s.repeat === true || s.repeat === 'true') return true;
        const checkStr = (val) => val && (String(val).includes("معيد") || String(val).includes("يعيد"));
        if (checkStr(s.repeat) || checkStr(s.status) || checkStr(s.notes)) return true;
        return false;
    };

    filteredRepeaters = allStudents.filter(s => {
        const isRepeater = isRepeaterCheck(s);
        const matchYear = year ? getStudentYear(s) === year : true;
        const matchLevel = level ? s.level === level : true;
        const matchStream = stream ? s.stream === stream : true;
        const matchClass = cls ? s.class == cls : true;
        return isRepeater && matchYear && matchLevel && matchStream && matchClass;
    });

    filteredRepeaters.sort((a, b) => {
        if (a.level !== b.level) return a.level.localeCompare(b.level);
        if (a.class != b.class) return a.class - b.class;
        if (a.last_name !== b.last_name) return a.last_name.localeCompare(b.last_name);
        return 0;
    });

    renderTable();
    updateSummary();
}

function renderTable() {

    const tbody = document.getElementById('tableBody');

    tbody.innerHTML = '';

    if (filteredRepeaters.length === 0) {

        tbody.innerHTML = '<tr><td colspan="8" style="padding:20px;">لا يوجد تلاميذ معيدين</td></tr>';

        return;

    }

    const streamHeader = document.getElementById('streamHeader');

    const isStreamVisible = streamHeader && streamHeader.style.display !== 'none';

    filteredRepeaters.forEach((s, index) => {

        const tr = document.createElement('tr');

        const streamCell = isStreamVisible ? `<td>${getStreamLabel(s.stream)}</td>` : '';

        tr.innerHTML = `

            <td>${index + 1}</td>

            <td>${s.last_name || ''}</td>

            <td>${s.first_name || ''}</td>

            <td>${s.gender === 'M' ? 'ذكر' : 'أنثى'}</td>

            <td>${formatDateDisplay(s.birth_date)}</td>

            <td class="no-print">${s.level || ''}</td>

            ${streamCell}

            <td class="no-print">${s.class || ''}</td>

            <td class="print-only"></td>

        `;

        tbody.appendChild(tr);

    });

}

function updateSummary() {
    const summary = document.getElementById('listSummary');
    if (!summary) return;

    const total = filteredRepeaters.length;
    const males = filteredRepeaters.filter(s => s.gender === 'M').length;
    const females = total - males;

    // Use the premium stats widget styling
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
}

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

async function printRepeatersList() {
    if (blockTrialPrint()) return;

    const level = document.getElementById('levelSelect').value;

    const cls = document.getElementById('classSelect').value;

    const settings = await DB.getSettings();

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // Get signer info from signature settings

    const sigSettings = await DB.get('signatureSettings') || {};

    const reportConfig = sigSettings.reportSettings?.['repeaters'] || { signer: 'director', showSignature: true };

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }

    const signerName = signerData.fullName || settings.managerName || '';

    if (filteredRepeaters.length === 0) {

        Swal.fire({ icon: 'warning', title: 'تنبيه', text: "لا توجد بيانات للطباعة" });

        return;

    }

    // Group by Level & Class & Stream

    const groups = {};

    filteredRepeaters.forEach(s => {

        const streamKey = s.stream || '';

        const key = `${s.level}|${s.class}|${streamKey}`;

        if (!groups[key]) {

            groups[key] = {

                level: s.level,

                cls: s.class,

                stream: s.stream,

                students: []

            };

        }

        groups[key].students.push(s);

    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {

        const ga = groups[a];

        const gb = groups[b];

        if (ga.level !== gb.level) return ga.level.localeCompare(gb.level);

        const ca = parseInt(ga.cls) || 0;

        const cb = parseInt(gb.cls) || 0;

        return ca - cb;

    });

    let allContent = "";

    sortedKeys.forEach((key, index) => {

        const group = groups[key];

        const rowsHtml = group.students.map((s, idx) => `

            <tr>

                <td>${idx + 1}</td>

                <td>${s.last_name || ''}</td>

                <td>${s.first_name || ''}</td>

                <td>${s.gender === 'M' ? 'ذكر' : 'أنثى'}</td>

                <td>${formatDateDisplay(s.birth_date)}</td>

                <td>${s.observation || ''}</td>

            </tr>

        `).join('');

        const pageTitle = "قائمة المعيدين";

        const pageBreakClass = index > 0 ? 'page-break' : '';

        const total = group.students.length;

        const males = group.students.filter(s => s.gender === 'M').length;

        const females = total - males;

        const sectionHtml = `

            <div class="print-page ${pageBreakClass}">

                <div class="header-container" style="margin-bottom: 5px;">

                    <div class="center-text" style="margin-bottom: 2px;">

                        <h3 style="line-height:1;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                        <h3 style="line-height:1;">وزارة التربية الوطنية</h3>

                    </div>

                    <div class="header-row" style="margin-bottom: 2px;">

                        <div class="header-box" style="text-align: right;">

                            <h3 style="line-height:1;">المؤسسة: ${settings.institutionName || '...'}</h3>

                        </div>

                        <div class="header-box" style="text-align: left;">

                            <h3 style="line-height:1;">مديرية التربية لولاية ${settings.wilaya || '...'}</h3>

                        </div>

                    </div>

                    <div class="center-text" style="margin-bottom: 5px;">

                        <h2 style="text-decoration: underline; margin: 0; line-height:1;">${pageTitle}</h2>

                    </div>

                    <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 2px 0; background-color: #f9f9f9; align-items: center;">

                         <div class="header-box" style="text-align: right; width: 35%;">

                            <h3 style="margin:0; line-height:1;">المستوى: ${group.level} ${group.stream ? '- ' + getStreamLabel(group.stream) : ''} &nbsp;-&nbsp; القسم: ${group.cls}</h3>

                        </div>

                        <div class="header-box center-text" style="width: 30%;">

                            <h3 style="margin:0; font-size: 10pt; line-height:1;">العدد: ${total} &nbsp;|&nbsp; ذكور: ${males} &nbsp;|&nbsp; إناث: ${females}</h3>

                        </div>

                        <div class="header-box" style="text-align: left; width: 35%;">

                             <h3 style="margin:0; line-height:1;">السنة الدراسية: ${settings.schoolYear || '2025/2026'}</h3>

                        </div>

                    </div>

                </div>

                <table>

                    <thead>

                        <tr>

                            <th width="5%">#</th>

                            <th width="25%">اللقب</th>

                            <th width="25%">الاسم</th>

                            <th width="10%">الجنس</th>

                            <th width="15%">تاريخ الميلاد</th>

                            <th width="20%">ملاحظات</th>

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

            </div>

        `;

        allContent += sectionHtml;

    });

    const fitToPage = document.getElementById('fitToPage') && document.getElementById('fitToPage').checked;

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

            <title>طباعة قائمة المعيدين</title>

            <style>

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

                    @page { margin: 0.8cm; size: A4; }

                    body { -webkit-print-color-adjust: exact; }

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

                    thead { display: table-header-group; }

                    tr { page-break-inside: avoid; }

                }

                ${compactStyles}

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            ${allContent}

            <script>

                // window.onload auto-print removed

            </script>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

    printWindow.document.close();

}

async function exportRepeatersToExcel() {
    if (!window.ExcelExportHelper) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'مكتبة التصدير غير متاحة حالياً.' });
        return;
    }

    if (!filteredRepeaters.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد بيانات لتصديرها.' });
        return;
    }

    const settings = await DB.getSettings();
    const isSecondaryStage = settings.educationStage === 'secondary';
    const headers = ['#', 'اللقب', 'الاسم', 'الجنس', 'تاريخ الميلاد', 'المستوى'];
    if (isSecondaryStage) {
        headers.push('الشعبة');
    }
    headers.push('القسم');

    const rows = filteredRepeaters.map((student, index) => {
        const row = [
            index + 1,
            student.last_name || '',
            student.first_name || '',
            student.gender === 'M' ? 'ذكر' : 'أنثى',
            formatDateDisplay(student.birth_date),
            student.level || ''
        ];

        if (isSecondaryStage) {
            row.push(getStreamLabel(student.stream));
        }

        row.push(student.class || '');
        return row;
    });

    const metaRows = [
        `المؤسسة: ${settings.institutionName || ''}`,
        `السنة الدراسية: ${document.getElementById('yearSelect')?.value || settings.schoolYear || ''}`,
        `المستوى: ${document.getElementById('levelSelect')?.selectedOptions?.[0]?.textContent || 'كل المستويات'}`,
        `${isSecondaryStage ? `الشعبة: ${document.getElementById('streamSelect')?.selectedOptions?.[0]?.textContent || 'كل الشعب'} | ` : ''}القسم: ${document.getElementById('classSelect')?.selectedOptions?.[0]?.textContent || 'كل الأقسام'}`,
        `عدد المعيدين: ${filteredRepeaters.length}`
    ];

    await ExcelExportHelper.exportWorkbook({
        fileName: `نتائج_المعيدين_${ExcelExportHelper.dateStamp()}.xlsx`,
        sheets: [{
            sheetName: 'المعيدون',
            title: 'قائمة التلاميذ المعيدين',
            metaRows,
            headers,
            rows
        }]
    });
}

async function printMergedRepeatersList() {
    if (blockTrialPrint()) return;

    const settings = await DB.getSettings();

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // Get signer info

    const sigSettings = await DB.get('signatureSettings') || {};

    const reportConfig = sigSettings.reportSettings?.['repeaters'] || { signer: 'director', showSignature: true };

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }

    const signerName = signerData.fullName || settings.managerName || '';

    if (filteredRepeaters.length === 0) {

        Swal.fire({ icon: 'warning', title: 'تنبيه', text: "لا توجد بيانات للطباعة" });

        return;

    }

    // Use filteredRepeaters directly, just sort them nicely

    const studentsToPrint = [...filteredRepeaters].sort((a, b) => {

        if (a.level !== b.level) return a.level.localeCompare(b.level);

        if (a.class != b.class) return parseInt(a.class) - parseInt(b.class);

        return a.last_name.localeCompare(b.last_name);

    });

    const rowsHtml = studentsToPrint.map((s, idx) => `

        <tr>

            <td>${idx + 1}</td>

            <td>${s.last_name || ''}</td>

            <td>${s.first_name || ''}</td>

            <td>${s.gender === 'M' ? 'ذكر' : 'أنثى'}</td>

            <td>${formatDateDisplay(s.birth_date)}</td>

            <td>${(s.level || '').replace(' متوسط', '')}</td>

            <td>${getStreamLabel(s.stream)}</td>

            <td>${s.class || ''}</td>

            <td>${s.observation || ''}</td>

        </tr>

    `).join('');

    // Stats

    const total = studentsToPrint.length;

    const males = studentsToPrint.filter(s => s.gender === 'M').length;

    const females = total - males;

    const fitToPage = document.getElementById('fitToPage') && document.getElementById('fitToPage').checked;

    // Page margins CSS

    let marginStyles = '@page { margin: 0.5cm; margin-top: 0.5cm; size: A4; }';

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

        `;

    }

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>طباعة قائمة المعيدين المدمجة</title>

            <style>

                body { font-family: 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0.5cm; }

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

                    ${marginStyles}

                    body { -webkit-print-color-adjust: exact; padding-top: 0 !important; }

                    thead { display: table-header-group; }

                    tr { page-break-inside: avoid; }

                }

                ${compactStyles}

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            <div class="header-container" style="margin-bottom: 5px;">

                <div class="center-text" style="margin-bottom: 2px;">

                    <h3 style="line-height:1;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                    <h3 style="line-height:1;">وزارة التربية الوطنية</h3>

                </div>

                <div class="header-row" style="margin-bottom: 2px;">

                    <div class="header-box" style="text-align: right;">

                        <h3 style="line-height:1;">المؤسسة: ${settings.institutionName || '...'}</h3>

                    </div>

                    <div class="header-box" style="text-align: left;">

                        <h3 style="line-height:1;">مديرية التربية لولاية ${settings.wilaya || '...'}</h3>

                    </div>

                </div>

                <div class="center-text" style="margin-bottom: 5px;">

                    <h2 style="text-decoration: underline; margin: 0; line-height:1;">قائمة المعيدين (مدمجة)</h2>

                </div>

                <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 2px 0; background-color: #f9f9f9; align-items: center;">

                    <div class="header-box" style="text-align: right; width: 35%;">

                        <h3 style="margin:0; line-height:1;">السنة الدراسية: ${settings.schoolYear || '2025/2026'}</h3>

                    </div>

                    <div class="header-box center-text" style="width: 30%;">

                        <h3 style="margin:0; font-size: 10pt; line-height:1;">العدد: ${total} &nbsp;|&nbsp; ذكور: ${males} &nbsp;|&nbsp; إناث: ${females}</h3>

                    </div>

                    <div class="header-box" style="text-align: left; width: 35%;">

                         <!-- Spacer -->

                    </div>

                </div>

            </div>

            <table>

                <thead>

                    <tr>

                        <th width="5%">#</th>

                        <th width="20%">اللقب</th>

                        <th width="20%">الاسم</th>

                        <th width="5%">الجنس</th>

                        <th width="12%">تاريخ الميلاد</th>

                        <th width="10%">المستوى</th>

                        <th width="10%">الشعبة</th>

                        <th width="8%">الفوج</th>

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

            <script>

                // window.onload auto-print removed

            </script>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

    printWindow.document.close();

}

// Helper to translate stream codes

function getStreamLabel(streamCode) {

    if (!streamCode) return '-';

    // Clean up code first

    const code = streamCode.toLowerCase().trim();

    const map = {

        'science': 'ع.ت',

        'math': 'ر',

        'math_tech': 'ت.ر',

        'tech_math': 'ت.ر',

        'tech_math_civil': 'ت.ر (م)',

        'tech_math_mech': 'ت.ر (ك)',

        'tech_math_elec': 'ت.ر (ك.ه)',

        'tech_math_methods': 'ت.ر (ط)',

        'languages': 'ل.أ',

        'literature': 'آ.ف',

        'arts': 'آ.ف',

        'management': 'ت.إ',

        'sport': 'ر.ب',

        'common_science': 'ج.م.ع',

        'common_arts': 'ج.م.آ'

    };

    return map[code] || streamCode; // Fallback to original if not found

}
