let allStudents = [];

let filteredStudents = [];

let isSecondary = false;

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

function normalizeSection(val) {
    if (!val) return "1";
    let s = val.toString().trim();
    return s.replace(/^0+/, '') || "1";
}

function formatDateDisplay(value) {
    if (!value) return '';

    const raw = value.toString().trim();
    if (!raw) return '';

    const normalized = raw.split('T')[0];
    const parts = normalized.split(/[-/]/).map((part) => part.trim()).filter(Boolean);

    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    return raw;
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();

    // Inject School Year Badge
    const yearBadge = document.getElementById('currentYearBadge');
    if (yearBadge) {
        DB.getSettings().then(settings => {
            yearBadge.innerHTML = '<i class="fas fa-graduation-cap"></i> ' + (settings.schoolYear || 'العام الحالي');
        });
    }

    populateFilters();

    document.getElementById('levelSelect').addEventListener('change', () => {

        if (isSecondary) updateStreamFilter();

        populateClasses();

        renderTable();

    });

    document.getElementById('streamSelect').addEventListener('change', () => {

        populateClasses();

        renderTable();

    });

    document.getElementById('classSelect').addEventListener('change', renderTable);

});

async function loadData() {

    allStudents = await DB.getStudents();

    const settings = await DB.getSettings();

    isSecondary = settings.educationStage === 'secondary';

}

async function saveData() {

    await DB.saveStudents(allStudents);

}

function populateFilters() {
    const levels = [...new Set(allStudents.map(s => (s.level || '').trim()))].sort();
    const levelSelect = document.getElementById('levelSelect');

    levels.forEach(level => {
        if (level) {
            const option = document.createElement('option');
            option.value = level;
            option.textContent = level;
            levelSelect.appendChild(option);
        }
    });

    if (isSecondary) {

        document.getElementById('streamFilterContainer').style.display = 'flex';

    } else {

        document.getElementById('streamFilterContainer').style.display = 'none';

    }

}

function updateStreamFilter() {

    const selectedLevel = document.getElementById('levelSelect').value;

    const streamSelect = document.getElementById('streamSelect');

    const currentStream = streamSelect.value;

    let streams = [];

    if (selectedLevel) {

        streams = [...new Set(allStudents.filter(s => s.level === selectedLevel && s.stream).map(s => s.stream))].sort();

    } else {

        streams = [...new Set(allStudents.filter(s => s.stream).map(s => s.stream))].sort();

    }

    streamSelect.innerHTML = '<option value="">-- اختر الشعبة --</option>';

    streams.forEach(s => {

        const opt = document.createElement('option');

        opt.value = s;

        opt.textContent = getStreamName(s);

        streamSelect.appendChild(opt);

    });

    if (streams.includes(currentStream)) {

        streamSelect.value = currentStream;

    }

}

function populateClasses() {

    const selectedLevel = document.getElementById('levelSelect').value;

    const selectedStream = document.getElementById('streamSelect').value;

    const classSelect = document.getElementById('classSelect');

    classSelect.innerHTML = '<option value="">-- اختر القسم --</option>';

    if (!selectedLevel) return;

    let tempStudents = allStudents.filter(s => s.level === selectedLevel);

    if (isSecondary && selectedStream) {

        tempStudents = tempStudents.filter(s => s.stream === selectedStream);

    }

    const classes = [...new Set(tempStudents.map(s => normalizeSection(s.class)))].sort();

    classes.forEach(cls => {

        const option = document.createElement('option');

        option.value = cls;

        option.textContent = cls;

        classSelect.appendChild(option);

    });

}

function renderTable() {

    const level = document.getElementById('levelSelect').value;

    const cls = document.getElementById('classSelect').value;

    const tbody = document.getElementById('studentsTableBody');

    const statsCard = document.getElementById('statsCard');

    tbody.innerHTML = '';

    if (!level || !cls) {

        statsCard.style.display = 'none';

        return;

    }

    // Filter students

    filteredStudents = allStudents.filter(s => {

        const matchLevel = s.level === level;

        const matchClass = normalizeSection(s.class) === cls;

        const matchStream = (isSecondary && document.getElementById('streamSelect').value) ? s.stream === document.getElementById('streamSelect').value : true;

        return matchLevel && matchClass && matchStream;

    });

    // Sort by Last Name then First Name

    filteredStudents.sort((a, b) => (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name, 'ar'));

    // Check if any student has a subgroup assigned, if so show stats

    // Default sub_group to '0' or undefined if not set.

    // Render

    filteredStudents.forEach((s, idx) => {

        const subGroup = s.sub_group || '-';

        const tr = document.createElement('tr');

        // Find index in main array for updating

        const mainIndex = allStudents.indexOf(s);

        tr.innerHTML = `

            <td>${idx + 1}</td>

            <td>${s.last_name}</td>

            <td>${s.first_name}</td>

            <td>${s.gender === 'M' ? 'ذكر' : 'أنثى'}</td>

            <td>${s.birth_date}</td>

            <td>${s.repeat ? 'نعم' : 'لا'}</td>

            <td class="group-cell ${subGroup == 1 ? 'group-1' : (subGroup == 2 ? 'group-2' : '')}"

                onclick="toggleGroup(${mainIndex})">

                ${subGroup === '-' ? 'اضغط للتحديد' : 'فوج ' + subGroup}

            </td>

        `;

        tbody.appendChild(tr);

    });

    updateStats();

    statsCard.style.display = 'flex';

}

async function toggleGroup(mainIndex) {

    const s = allStudents[mainIndex];

    if (!s) return;

    // Toggle logic: undefined/null -> 1 -> 2 -> 1 ...

    // Or maybe just cycle 1 -> 2 -> 1

    let current = s.sub_group;

    if (current == 1) s.sub_group = 2;

    else s.sub_group = 1; // Default to 1 if empty or was 2

    await saveData();

    renderTable(); // Re-render to update UI and Stats

}

async function autoGroup() {
    const level = document.getElementById('levelSelect').value;
    const stream = isSecondary ? document.getElementById('streamSelect').value : null;
    const cls = document.getElementById('classSelect').value;

    if (!level || !cls) {
        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'يرجى اختيار المستوى والقسم أولا.'
        });
        return;
    }

    // Modal with grouping options
    const { value: groupType } = await Swal.fire({
        title: 'خيارات التفويج',
        html: `
            <div style="text-align: right; margin-bottom: 15px; font-weight: bold; color: #1e293b;">اختر طريقة تفويج التلاميذ للقسم المحدد:</div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;">
                    <input type="radio" name="groupType" value="half" style="transform: scale(1.2);">
                    <div style="text-align: right;">
                        <div style="font-weight: bold;">تفويج نصفين 1 / 2</div>
                        <div style="font-size: 0.85rem; color: #64748b;">النصف الأول في ترتيب القائمة للفوج 1، والباقي للفوج 2.</div>
                    </div>
                </label>
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;">
                    <input type="radio" name="groupType" value="gender" style="transform: scale(1.2);">
                    <div style="text-align: right;">
                        <div style="font-weight: bold;">تفويج حسب الجنس</div>
                        <div style="font-size: 0.85rem; color: #64748b;">الذكور في الفوج 1، والإناث في الفوج 2.</div>
                    </div>
                </label>
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;">
                    <input type="radio" name="groupType" value="smart" checked style="transform: scale(1.2);">
                    <div style="text-align: right;">
                        <div style="font-weight: bold;">تفويج ذكي (متوازن)</div>
                        <div style="font-size: 0.85rem; color: #64748b;">موازنة الأفواج من حيث العدد، الجنس، والمعيدين.</div>
                    </div>
                </label>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: 'var(--secondary-color)',
        cancelButtonColor: '#d33',
        confirmButtonText: '<i class="fas fa-magic me-1"></i> تطبيق التفويج',
        cancelButtonText: 'إلغاء',
        preConfirm: () => {
            const checked = document.querySelector('input[name="groupType"]:checked');
            if (!checked) {
                Swal.showValidationMessage('الرجاء اختيار طريقة التفويج أولاً');
                return false;
            }
            return checked.value;
        }
    });

    if (!groupType) {
        return;
    }

    const studentsToGroup = filteredStudents; // Currently displayed list

    // Reset current sub_groups
    studentsToGroup.forEach(s => s.sub_group = 0);

    if (groupType === 'half') {
        // Division into two consecutive halves, odd extra goes to group 1
        const total = studentsToGroup.length;
        const half = Math.ceil(total / 2);
        studentsToGroup.forEach((s, index) => {
            s.sub_group = (index < half) ? 1 : 2;
        });

    } else if (groupType === 'gender') {
        // Divide by Gender: M -> Group 1, F -> Group 2
        studentsToGroup.forEach(s => {
            const genderVal = s.gender || s.sexe; // Support both fields
            if (genderVal === 'M' || genderVal === 'm' || genderVal === 'ذكر') {
                s.sub_group = 1;
            } else {
                s.sub_group = 2; // Female
            }
        });

    } else if (groupType === 'smart') {
        // Existing Smart logic
        const maleRepeat = studentsToGroup.filter(s => s.gender === 'M' && s.repeat);
        const femaleRepeat = studentsToGroup.filter(s => s.gender === 'F' && s.repeat);
        const maleNew = studentsToGroup.filter(s => s.gender === 'M' && !s.repeat);
        const femaleNew = studentsToGroup.filter(s => s.gender === 'F' && !s.repeat);

        let g1 = { m: 0, f: 0, r: 0, total: 0 };
        let g2 = { m: 0, f: 0, r: 0, total: 0 };

        const W_TOTAL = 10;
        const W_GENDER = 5;
        const W_REPEAT = 8;

        const assignSmart = (student) => {
            const isMale = student.gender === 'M';
            const isRepeater = student.repeat;

            let score1 = -(g1.total * W_TOTAL);
            let score2 = -(g2.total * W_TOTAL);

            if (isMale) {
                score1 -= g1.m * W_GENDER;
                score2 -= g2.m * W_GENDER;
            } else {
                score1 -= g1.f * W_GENDER;
                score2 -= g2.f * W_GENDER;
            }

            if (isRepeater) {
                score1 -= g1.r * W_REPEAT;
                score2 -= g2.r * W_REPEAT;
            }

            if (score1 >= score2) {
                student.sub_group = 1; g1.total++;
                if (isMale) g1.m++; else g1.f++;
                if (isRepeater) g1.r++;
            } else {
                student.sub_group = 2; g2.total++;
                if (isMale) g2.m++; else g2.f++;
                if (isRepeater) g2.r++;
            }
        };

        const balanceList = (list) => {
            list.forEach(s => assignSmart(s));
        };

        balanceList(maleRepeat);
        balanceList(femaleRepeat);
        balanceList(maleNew);
        balanceList(femaleNew);
    }

    await saveData();
    renderTable();
    Swal.fire({
        icon: 'success',
        title: 'تمت العملية',
        text: 'تم تفويج القسم بنجاح!',
        timer: 2000,
        showConfirmButton: false
    });
}

function updateStats() {

    // Calculate stats based on filteredStudents

    const g1 = filteredStudents.filter(s => s.sub_group == 1);

    const g2 = filteredStudents.filter(s => s.sub_group == 2);

    // G1 Stats

    document.getElementById('g1-class-total').textContent = filteredStudents.length;
    document.getElementById('g1-total').textContent = g1.length;

    document.getElementById('g1-m').textContent = g1.filter(s => s.gender === 'M').length;

    document.getElementById('g1-f').textContent = g1.filter(s => s.gender === 'F').length;

    document.getElementById('g1-r').textContent = g1.filter(s => s.repeat).length;

    // G2 Stats

    document.getElementById('g2-class-total').textContent = filteredStudents.length;
    document.getElementById('g2-total').textContent = g2.length;

    document.getElementById('g2-m').textContent = g2.filter(s => s.gender === 'M').length;

    document.getElementById('g2-f').textContent = g2.filter(s => s.gender === 'F').length;

    document.getElementById('g2-r').textContent = g2.filter(s => s.repeat).length;

    // Total Stats

    document.getElementById('all-total').textContent = filteredStudents.length;

    document.getElementById('all-m').textContent = filteredStudents.filter(s => s.gender === 'M').length;
    document.getElementById('all-f').textContent = filteredStudents.filter(s => s.gender === 'F').length;
    document.getElementById('all-mf').textContent = filteredStudents.filter(s => s.gender === 'M').length + ' / ' + filteredStudents.filter(s => s.gender === 'F').length;

    document.getElementById('all-r').textContent = filteredStudents.filter(s => s.repeat).length;

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

async function printClasses(mode) {
    if (blockTrialPrint()) return;

    if (!filteredStudents || filteredStudents.length === 0) {

        Swal.fire({
            icon: 'info',
            title: 'تنبيه',
            text: 'لا توجد بيانات للطباعة.'
        });

        return;

    }

    const settings = await DB.getSettings();

    const today = new Date().toLocaleDateString('ar-DZ');

    const level = document.getElementById('levelSelect').value;

    const stream = isSecondary ? document.getElementById('streamSelect').value : null;

    const cls = document.getElementById('classSelect').value;

    // Get signer info from signature settings

    const sigSettings = await DB.get('signatureSettings') || {};

    const reportConfig = sigSettings.reportSettings?.['student_list'] || { signer: 'director', showSignature: true };

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }

    const signerName = signerData.fullName || settings.managerName || '';

    let groupsToPrint = [];

    if (mode === 'combined') {

        groupsToPrint.push({

            title: "قائمة شاملة",

            students: filteredStudents,

            showSubGroup: true

        });

    } else if (mode === 'groups') {

        const g1 = filteredStudents.filter(s => s.sub_group == 1);

        const g2 = filteredStudents.filter(s => s.sub_group == 2);

        if (g1.length > 0) groupsToPrint.push({ title: "الفوج الفرعي 1", students: g1 });

        if (g2.length > 0) groupsToPrint.push({ title: "الفوج الفرعي 2", students: g2 });

    }

    let allContent = '';

    groupsToPrint.forEach((group, index) => {

        const pageBreakClass = index > 0 ? 'page-break' : '';

        // Calculate Stats

        const total = group.students.length;

        const males = group.students.filter(s => s.gender === 'M').length;

        const females = total - males;

        // Rows

        const rowsHtml = group.students.map((s, idx) => `

            <tr>

                <td>${idx + 1}</td>

                <td>${s.last_name || ''}</td>

                <td>${s.first_name || ''}</td>

                <td>${s.gender === 'M' ? 'ذكر' : 'أنثى'}</td>

                <td>${s.birth_date || ''}</td>

                <td>${s.repeat ? 'نعم' : 'لا'}</td>

                ${mode === 'combined' ? `<td>${s.sub_group || '-'}</td>` : ''}

                <td>${s.observation || ''}</td>

            </tr>

        `).join('');

        const headers = `

            <th width="5%">#</th>

            <th width="25%">اللقب</th>

            <th width="25%">الاسم</th>

            <th width="10%">الجنس</th>

            <th width="15%">تاريخ الميلاد</th>

            <th width="5%">معيد</th>

            ${mode === 'combined' ? '<th width="10%">الفوج</th>' : ''}

            <th width="15%">ملاحظات</th>

        `;

        allContent += `

            <div class="print-page ${pageBreakClass}">

                <div class="header-container" style="margin-bottom: 5px;">

                    <div class="center-text" style="margin-bottom: 2px;">

                        <h3 style="line-height:1;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                        <h3 style="line-height:1;">وزارة التربية الوطنية</h3>

                    </div>

                    <div class="header-row" style="margin-bottom: 2px;">

                        <div class="header-box" style="text-align: right;">

                            <h3 style="line-height:1;">المؤسسة: ${settings.institutionName || '.......'}</h3>

                        </div>

                        <div class="header-box" style="text-align: left;">

                             <h3 style="line-height:1;">مديرية التربية لولاية ${settings.wilaya || '.......'}</h3>

                        </div>

                    </div>

                    <div class="center-text" style="margin-bottom: 5px;">

                        <h2 style="text-decoration: underline; margin: 0; line-height:1;">قائمة التلاميذ - ${group.title}</h2>

                    </div>

                    <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 2px 0; background-color: #f9f9f9; align-items: center;">

                         <div class="header-box" style="text-align: right; width: 35%;">

                            <h3 style="margin:0; line-height:1;">${level} ${stream ? ' - ' + getStreamName(stream) : ''} &nbsp;-&nbsp; القسم: ${cls}</h3>

                        </div>

                        <div class="header-box center-text" style="width: 30%;">

                            <h3 style="margin:0; font-size: 10pt; line-height:1;">القسم: ${filteredStudents.length} &nbsp;|&nbsp; الفوج: ${total} &nbsp;|&nbsp; ذكور: ${males} &nbsp;|&nbsp; إناث: ${females}</h3>

                        </div>

                        <div class="header-box" style="text-align: left; width: 35%;">

                             <h3 style="margin:0; line-height:1;">السنة الدراسية: ${settings.schoolYear || '2025/2026'}</h3>

                        </div>

                    </div>

                </div>

                <table>

                    <thead>

                        <tr>${headers}</tr>

                    </thead>

                    <tbody>

                        ${rowsHtml}

                    </tbody>

                </table>

                <div class="footer" style="justify-content: flex-end;">
                    <div style="text-align: center; min-width: 200px;">
                        <div style="margin-bottom: 5px;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                        ${signerTitle}
                    </div>
                </div>

            </div>

        `;

    });

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>طباعة الأفواج</title>

            <style>

                body { font-family: 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0.5cm; }

                .print-page { margin-bottom: 0; page-break-after: always; }

                .header-container { width: 100%; margin-bottom: 5px; } /* Reduced margin */

                .center-text { text-align: center; }

                h1, h2, h3 { margin: 0; color: #000; padding: 0; line-height: 1.2; }

                h2 { font-size: 14pt; margin-bottom: 2px; }

                h3 { font-size: 11pt; margin-bottom: 2px; }

                .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; padding: 2px 0; }

                .header-box { width: 33%; }

                table { width: 100%; border-collapse: collapse; margin-top: 5px; }

                th, td { border: 0.5pt solid #000; padding: 2px 4px; text-align: center; font-size: 10pt; line-height: 1.2; } /* Smaller font */

                th { background-color: #f0f0f0; font-weight: bold; padding: 4px; }

                .footer { margin-top: 15px; display: flex; justify-content: space-between; font-size: 11pt; }

                @media print {

                    @page { margin: 0.8cm; size: A4; }

                    body { -webkit-print-color-adjust: exact; }

                    .page-break { page-break-before: always; }

                }

                /* Compact styles directly applied */

                .header-container { margin-bottom: 2px !important; }

                h1, h2, h3 { line-height: 1.1 !important; margin: 0 !important; }

                h2 { font-size: 13pt !important; }

                h3 { font-size: 10pt !important; }

                .header-row { padding: 2px 0 !important; margin-top: 2px !important; margin-bottom: 2px !important; }

                table { margin-top: 5px !important; }

                /* Dynamic padding based on mode */

                th, td {

                    font-size: 10pt !important;

                    padding: ${mode === 'groups' ? '8px 4px' : '1px 3px'} !important;

                    height: auto !important;

                }

                .footer { margin-top: 15px !important; font-size: 11pt !important; }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            ${allContent}

            <script>

                window.onload = function() {

                    // auto-print removed

                };

            </script>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

}

async function exportClassesToExcel() {
    if (!window.ExcelExportHelper) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'مكتبة التصدير غير متاحة حالياً.' });
        return;
    }

    if (!filteredStudents.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد بيانات لتصديرها.' });
        return;
    }

    const settings = await DB.getSettings();
    const level = document.getElementById('levelSelect').value;
    const stream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : '';
    const cls = document.getElementById('classSelect').value;

    const headers = ['#', 'اللقب', 'الاسم', 'الجنس', 'تاريخ الميلاد', 'معيد', 'الفوج', 'ملاحظات'];
    const rows = filteredStudents.map((student, index) => ([
        index + 1,
        student.last_name || '',
        student.first_name || '',
        student.gender === 'M' ? 'ذكر' : 'أنثى',
        formatDateDisplay(student.birth_date),
        student.repeat ? 'نعم' : 'لا',
        student.sub_group ? `فوج ${student.sub_group}` : '',
        student.observation || ''
    ]));

    const metaRows = [
        `السنة الدراسية: ${settings.schoolYear || ''}`,
        `المؤسسة: ${settings.institutionName || ''}`,
        `المستوى: ${level || '-'}${stream ? ` | الشعبة: ${getStreamName(stream)}` : ''} | القسم: ${cls || '-'}`,
        `عدد التلاميذ: ${filteredStudents.length}`
    ];

    await ExcelExportHelper.exportWorkbook({
        fileName: `تفويج_التلاميذ_${ExcelExportHelper.dateStamp()}.xlsx`,
        sheets: [{
            sheetName: 'الأفواج',
            title: 'قائمة الأفواج',
            metaRows,
            headers,
            rows
        }]
    });
}
window.addEventListener('load', () => {
    exportClassesToExcel = async function () {
        if (!window.ExcelExportHelper) {
            Swal.fire({
                icon: 'error',
                title: '\u062E\u0637\u0623',
                text: '\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u062A\u0635\u062F\u064A\u0631 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u0627\u064B.'
            });
            return;
        }

        if (!filteredStudents.length) {
            Swal.fire({
                icon: 'warning',
                title: '\u062A\u0646\u0628\u064A\u0647',
                text: '\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0644\u062A\u0635\u062F\u064A\u0631\u0647\u0627.'
            });
            return;
        }

        const settings = await DB.getSettings();
        const level = document.getElementById('levelSelect').value;
        const stream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : '';
        const cls = document.getElementById('classSelect').value;

        const headers = [
            '#',
            '\u0627\u0644\u0644\u0642\u0628',
            '\u0627\u0644\u0627\u0633\u0645',
            '\u0627\u0644\u062C\u0646\u0633',
            '\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u064A\u0644\u0627\u062F',
            '\u0645\u0639\u064A\u062F',
            '\u0627\u0644\u0641\u0648\u062C',
            '\u0645\u0644\u0627\u062D\u0638\u0627\u062A'
        ];

        const rows = filteredStudents.map((student, index) => ([
            index + 1,
            student.last_name || '',
            student.first_name || '',
            student.gender === 'M' ? '\u0630\u0643\u0631' : '\u0623\u0646\u062B\u0649',
            formatDateDisplay(student.birth_date),
            student.repeat ? '\u0646\u0639\u0645' : '\u0644\u0627',
            student.sub_group ? `\u0641\u0648\u062C ${student.sub_group}` : '',
            student.observation || ''
        ]));

        const metaRows = [
            `\u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629: ${settings.schoolYear || ''}`,
            `\u0627\u0644\u0645\u0624\u0633\u0633\u0629: ${settings.institutionName || ''}`,
            `\u0627\u0644\u0645\u0633\u062A\u0648\u0649: ${level || '-'}${stream ? ` | \u0627\u0644\u0634\u0639\u0628\u0629: ${getStreamName(stream)}` : ''} | \u0627\u0644\u0642\u0633\u0645: ${cls || '-'}`,
            `\u0639\u062F\u062F \u0627\u0644\u062A\u0644\u0627\u0645\u064A\u0630: ${filteredStudents.length}`
        ];

        await ExcelExportHelper.exportWorkbook({
            fileName: `\u062A\u0641\u0648\u064A\u062C_\u0627\u0644\u062A\u0644\u0627\u0645\u064A\u0630_${ExcelExportHelper.dateStamp()}.xlsx`,
            sheets: [{
                sheetName: '\u0627\u0644\u0623\u0641\u0648\u0627\u062C',
                title: '\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0641\u0648\u0627\u062C',
                metaRows,
                headers,
                rows
            }]
        });
    };
});
