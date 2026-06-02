/**

 * Teachers Management - إدارة الأساتذة

 * Handles teacher data, reception hours, and responsibilities

 */

// ==================== IPC INITIALIZATION ====================
(function() {
    try {
        var electronObj = null;
        var req = typeof window !== 'undefined' ? (window.require || (typeof require !== 'undefined' ? require : null)) : null;

        if (!req && typeof window !== 'undefined') {
            try {
                if (window.parent && window.parent !== window && window.parent.require) {
                    req = window.parent.require;
                }
            } catch (e) { }
            if (!req) {
                try {
                    if (window.top && window.top !== window && window.top.require) {
                        req = window.top.require;
                    }
                } catch (e) { }
            }
        }

        if (req) {
            try {
                electronObj = req('electron');
            } catch (e) { }
        }

        if (electronObj) {
            window.ipcRenderer = electronObj.ipcRenderer;
            window.shell = electronObj.shell;
        } else if (!window.ipcRenderer && typeof window !== 'undefined') {
            // Inheritance check for iframes
            try {
                if (window.parent && window.parent !== window && window.parent.ipcRenderer) {
                    window.ipcRenderer = window.parent.ipcRenderer;
                }
            } catch (e) { }
        }
    } catch (e) {
        console.error('[Teachers] IPC Init Error:', e);
    }
})();

// ==================== GLOBAL VARIABLES ====================

let teachersList = [];

let subjectResponsibles = {};

let classResponsibles = {};

let currentTeacherId = null;

// Import Temp Data
let tempImportData = null;

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async function () {

    await loadTeachersData();

    updateStats();

    renderTeachersTable();

    populateFilters();
    populateReceptionTeacherSelect();
    loadSubjectResponsibilities();

    // Initial population for modal
    populateRankDropdown();
    populateSubjectDropdown();
    populateLevelDropdown();
});

// ==================== DYNAMIC DROPDOWNS ====================

/**
 * Populate Level Dropdown based on Education Stage
 */
async function populateLevelDropdown() {
    const settings = await DB.getSettings();
    const isSecondary = settings.educationStage === 'secondary';
    const select = document.getElementById('levelSelectResp');

    if (!select) return;

    select.innerHTML = '<option value="">-- اختر المستوى --</option>';

    if (isSecondary) {
        const levels = ['أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي'];
        levels.forEach(l => {
            const option = document.createElement('option');
            option.value = l;
            option.textContent = l;
            select.appendChild(option);
        });
    } else {
        const levels = ['أولى', 'ثانية', 'ثالثة', 'رابعة'];
        levels.forEach(l => {
            const option = document.createElement('option');
            option.value = l + ' متوسط'; // Keep value for technical mapping
            option.textContent = l;
            select.appendChild(option);
        });
    }
}

/**
 * Populate Rank Dropdown based on Education Stage
 */
async function populateRankDropdown() {
    const settings = await DB.getSettings();
    const isSecondary = settings.educationStage === 'secondary';
    const select = document.getElementById('inputRank');

    if (!select) return;

    // Save current selection if exists
    const currentVal = select.value;

    select.innerHTML = '<option value="">-- اختر الرتبة --</option>';

    let ranks = [];
    if (isSecondary) {
        ranks = [
            'أستاذ التعليم الثانوي',
            'أستاذ التعليم الثانوي قسم أوَّل',
            'أستاذ التعليم الثانوي قسم ثانٍ',
            'أستاذ مميز في التعليم الثانوي'
        ];
    } else {
        ranks = [
            'متعاقد',
            'أستاذ التعليم المتوسط',
            'أستاذ التعليم المتوسط قسم أوَّل', // Section 1 (Senior?)
            'أستاذ التعليم المتوسط قسم ثانٍ', // Section 2
            'أستاذ مميز في التعليم المتوسط'   // Distinguished
        ];
    }

    ranks.forEach(r => {
        const option = document.createElement('option');
        option.value = r;
        option.textContent = r;
        select.appendChild(option);
    });

    // Restore selection if valid
    if (currentVal && ranks.includes(currentVal)) {
        select.value = currentVal;
    }
}

/**
 * Populate Subject Dropdown based on Education Stage
 */
async function populateSubjectDropdown() {
    const settings = await DB.getSettings();
    const isSecondary = settings.educationStage === 'secondary';
    const select = document.getElementById('inputSubject');

    if (!select) return;

    // Save current selection if exists
    const currentVal = select.value;

    select.innerHTML = '<option value="">-- اختر المادة --</option>';

    let subjects = [];
    if (isSecondary) {
        subjects = [
            'الأدب العربي',
            'اللغة الفرنسية',
            'اللغة الإنجليزية',
            'الرياضيات',
            'علوم الطبيعة والحياة',
            'العلوم الفيزيائية',
            'الفلسفة',
            'التاريخ والجغرافيا',
            'العلوم الإسلامية',
            'الإعلام الآلي',
            'التربية البدنية والرياضية',
            'الهندسة المدنية',
            'الهندسة الميكانكية',
            'الهندسة الكهربائية',
            'هندسة الطرائق',
            'التسيير والمحاسبة',
            'اللغة الأمازيغية',
            'لغة إسبانية',
            'لغة ألمانية',
            'لغة إيطالية'
        ];
    } else {
        subjects = [
            'اللغة العربية',
            'اللغة الفرنسية',
            'اللغة الإنجليزية',
            'الرياضيات',
            'العلوم الطبيعية',
            'العلوم الفيزيائية والتكنولوجيا',
            'التاريخ والجغرافيا',
            'التربية الإسلامية',
            'التربية البدنية والرياضية',
            'التربية الموسيقية',
            'التربية التشكيلية',
            'الإعلام الآلي',
            'اللغة الأمازيغية'
        ];
    }

    subjects.forEach(s => {
        const option = document.createElement('option');
        option.value = s;
        option.textContent = s;
        select.appendChild(option);
    });

    // Restore selection if valid
    if (currentVal && subjects.includes(currentVal)) {
        select.value = currentVal;
    }
}

// ==================== DATA MANAGEMENT ====================

/**

 * Load teachers data from Storage

 */

async function loadTeachersData() {

    teachersList = await DB.getTeachers();

    subjectResponsibles = await DB.get('subjectResponsibles') || {};

    classResponsibles = await DB.get('classResponsibles') || {};

}

/**

 * Save teachers data to Storage

 */

async function saveTeachersData() {

    await DB.saveTeachers(teachersList);

    await DB.set('subjectResponsibles', subjectResponsibles);

    await DB.set('classResponsibles', classResponsibles);

}

/**

 * Generate unique ID

 */

function generateId() {

    return 'teacher_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

}

// ==================== EXCEL IMPORT ====================

/**

 * Handle Excel file selection for teachers

 */

function _deprecated_handleTeacherFileSelect(event) {

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

            // Convert to JSON - starting from row 4 (index 3)

            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            let importedCount = 0;

            let skippedCount = 0;

            // Start from row 4 (index 3)

            for (let i = 3; i < jsonData.length; i++) {

                const row = jsonData[i];

                if (!row || row.length < 7) continue;

                const lastName = row[2] ? String(row[2]).trim() : '';    // Column C (index 2)

                const firstName = row[3] ? String(row[3]).trim() : '';   // Column D (index 3)

                const rank = row[5] ? String(row[5]).trim() : '';        // Column F (index 5)

                const subject = row[6] ? String(row[6]).trim() : '';     // Column G (index 6)

                // Skip if rank doesn't start with "أستاذ"

                if (!rank.startsWith('أستاذ')) {

                    skippedCount++;

                    continue;

                }

                // Skip empty names

                if (!lastName && !firstName) {

                    skippedCount++;

                    continue;

                }

                // Check for duplicates

                const exists = teachersList.some(t =>

                    t.last_name === lastName &&

                    t.first_name === firstName &&

                    t.subject === subject

                );

                if (exists) {

                    skippedCount++;

                    continue;

                }

                // Add new teacher

                teachersList.push({

                    id: generateId(),

                    last_name: lastName,

                    first_name: firstName,

                    rank: rank,

                    subject: subject,

                    receptionHours: [],

                    isSubjectResponsible: false,

                    responsibleClasses: []

                });

                importedCount++;

            }

            // Save and refresh

            await saveTeachersData();

            updateStats();

            renderTeachersTable();

            populateFilters();

            loadSubjectResponsibilities();

            // Show result
            Swal.fire({
                icon: 'success',
                title: 'تم الاستيراد',
                text: `تم استيراد ${importedCount} أستاذ بنجاح.\nتم تجاوز ${skippedCount} سجل (مكرر أو غير صالح).`
            });

        } catch (error) {

            console.error('Error importing file:', error);

            Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء قراءة الملف. تأكد من صحة التنسيق.' });

        }

    };

    reader.readAsArrayBuffer(file);

    event.target.value = ''; // Reset file input

}

// ==================== TABLE RENDERING ====================

/**

 * Render teachers table

 */

let teachersGridInstance = null;

function renderTeachersTable() {
    const wrapper = document.getElementById('teachers-grid-wrapper');
    if (!wrapper) return;

    const filteredTeachers = getFilteredTeachers();

    if (filteredTeachers.length === 0) {
        if (teachersGridInstance) {
            try { teachersGridInstance.destroy(); } catch (e) { }
            teachersGridInstance = null;
        }
        wrapper.innerHTML = '<div class="empty-state"><div class="icon">' + (typeof IconManager !== "undefined" ? IconManager.get("teacher") : "👨‍🏫") + '</div><p>لا يوجد أساتذة. قم باستيراد البيانات أو إضافة أستاذ جديد.</p></div>';
        return;
    }

    const data = filteredTeachers.map((teacher, index) => {
        const isSubjectResp = Object.values(subjectResponsibles).includes(teacher.id);
        const responsibleClassesDisplay = formatResponsibleClasses(teacher.responsibleClasses);

        const subjectCell = teacher.subject + (teacher.isExempt ? ' <span title="معفى من الحراسة">' + (typeof IconManager !== "undefined" ? IconManager.get("shield") : "🛡️") + '</span>' : '');
        const subjectRespCell = isSubjectResp ? '<span style="color: #000000; font-weight: bold;">' + (typeof IconManager !== "undefined" ? IconManager.get("check") : "✓") + ' مسؤول</span>' : '-';
        const classRespCell = responsibleClassesDisplay !== '-' ? '<span style="color: #000000; font-weight: bold;">' + responsibleClassesDisplay + '</span>' : '-';

        const actionsHtml = `
            <div class="dropdown">
                <button class="btn btn-light btn-sm border-0 bg-transparent p-1" type="button" data-bs-toggle="dropdown" aria-expanded="false" data-bs-boundary="window">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow-sm" style="font-size: 0.9rem; text-align: right;">
                    <li>
                        <a class="dropdown-item" href="#" onclick="event.preventDefault(); printTeacherInfoCard('${teacher.id}')">
                            <i class="fas fa-id-card text-primary ms-2" style="width: 20px; text-align: center;"></i> طباعة بطاقة معلومات
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item" href="#" onclick="event.preventDefault(); openEditTeacherModal('${teacher.id}')">
                            <i class="fas fa-edit text-success ms-2" style="width: 20px; text-align: center;"></i> تعديل
                        </a>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                        <a class="dropdown-item text-danger" href="#" onclick="event.preventDefault(); openDeleteModal('${teacher.id}')">
                            <i class="fas fa-trash-alt ms-2" style="width: 20px; text-align: center;"></i> حذف
                        </a>
                    </li>
                </ul>
            </div>
        `;

        const hasEmail = teacher.email && teacher.email.includes('@');
        const emailCell = hasEmail ?
            '<i class="fas fa-check-circle" style="color: #28a745; font-size: 1.1rem;" title="' + teacher.email + '"></i>' :
            '<i class="fas fa-times-circle" style="color: #dc3545; font-size: 1.1rem;"></i>';

        return [
            index + 1,
            teacher.last_name,
            teacher.first_name,
            (teacher.dob || teacher.birthDate || '-'),
            teacher.rank,
            gridjs.html(subjectCell),
            teacher.grade || '-',
            teacher.effectiveDate || '-',
            gridjs.html(emailCell),
            gridjs.html('<div class="actions-cell">' + actionsHtml + '</div>')
        ];
    });

    const columns = [
        { id: 'col_idx', name: '#', width: '60px' },
        { id: 'col_lname', name: 'اللقب', width: '120px' },
        { id: 'col_fname', name: 'الاسم', width: '120px' },
        { id: 'col_dob', name: 'تاريخ الميلاد', width: '130px' },
        { id: 'col_rank', name: 'الرتبة', width: '140px' },
        { id: 'col_subj', name: 'المادة', width: '150px' },
        { id: 'col_grade', name: 'الدرجة', width: '80px' },
        { id: 'col_eff_date', name: 'تاريخ السريان', width: '130px' },
        { id: 'col_email', name: 'e-mail', width: '100px' },
        { id: 'col_actions', name: 'إجراءات', width: '160px', sort: false }
    ];

    // Destroy old instance for clean re-render
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
            limit: 50,
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
            table: 'teachers-table',
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
}

/**

 * Get filtered teachers based on search and filters

 */

function getFilteredTeachers() {

    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    const subjectFilter = document.getElementById('subjectFilter').value;

    const rankFilter = document.getElementById('rankFilter').value;

    return teachersList.filter(teacher => {

        const matchesSearch = !searchTerm ||

            teacher.last_name.toLowerCase().includes(searchTerm) ||

            teacher.first_name.toLowerCase().includes(searchTerm);

        const matchesSubject = !subjectFilter || teacher.subject === subjectFilter;

        const matchesRank = !rankFilter || teacher.rank === rankFilter;

        return matchesSearch && matchesSubject && matchesRank;

    });

}

/**

 * Filter teachers (called on input change)

 */

function filterTeachers() {

    renderTeachersTable();

}

/**

 * Populate filter dropdowns

 */

function populateFilters() {

    const subjects = [...new Set(teachersList.map(t => t.subject))].filter(Boolean).sort();

    const ranks = [...new Set(teachersList.map(t => t.rank))].filter(Boolean).sort();

    const subjectFilter = document.getElementById('subjectFilter');

    subjectFilter.innerHTML = '<option value="">-- كل المواد --</option>' +

        subjects.map(s => `<option value="${s}">${s}</option>`).join('');

    const rankFilter = document.getElementById('rankFilter');

    rankFilter.innerHTML = '<option value="">-- كل الرتب --</option>' +

        ranks.map(r => `<option value="${r}">${r}</option>`).join('');

}

// ==================== STATS ====================

/**

 * Update statistics display

 */

function updateStats() {

    document.getElementById('totalTeachers').textContent = teachersList.length;

    const uniqueSubjects = [...new Set(teachersList.map(t => t.subject))].filter(Boolean);

    document.getElementById('totalSubjects').textContent = uniqueSubjects.length;

    const subjectResponsiblesCount = new Set(Object.values(subjectResponsibles).filter(id => id)).size;

    document.getElementById('totalResponsibles').textContent = subjectResponsiblesCount;

    const classResponsiblesCount = teachersList.filter(t =>

        t.responsibleClasses && t.responsibleClasses.length > 0

    ).length;

    const classRespEl = document.getElementById('totalClassResponsibles');
    if (classRespEl) {
        classRespEl.textContent = classResponsiblesCount;
    }

}

// ==================== TABS ====================

/**

 * Switch between tabs

 */

function switchTab(tabId) {
    // Load specific tab data
    if (tabId === 'reception') {
        renderReceptionList();
    } else if (tabId === 'responsibilities') {
        loadSubjectResponsibilities();
        populateLevelDropdown(); // Populate levels from student data
    }
}

// ==================== TEACHER CRUD ====================

/**

 * Open add teacher modal

 */

function openAddTeacherModal() {

    populateRankDropdown(); // Ensure ranks are populated
    populateSubjectDropdown(); // Ensure subjects are populated

    document.getElementById('modalTitle').textContent = 'إضافة أستاذ جديد';

    document.getElementById('editTeacherId').value = '';

    document.getElementById('teacherForm').reset();

    openModal('teacherModal');

}

/**
 * Print Teacher Info Card
 */
async function printTeacherInfoCard(teacherId) {
    const teacher = teachersList.find(t => t.id === teacherId);
    if (!teacher) return;

    if (typeof blockTrialPrint === 'function' && blockTrialPrint()) return;

    const settings = await DB.getSettings() || {};
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
    const schoolYear = settings.schoolYear || '2025/2026';

    const infoRow = (label, value) => `
        <tr>
            <td style="padding: 6px 12px; font-weight: bold; color: #4a5568; background: #f8fafc; width: 35%; border: 1px solid #e2e8f0; font-size: 11pt;">${label}</td>
            <td style="padding: 6px 12px; color: #1a202c; border: 1px solid #e2e8f0; font-size: 11pt;">${value || '—'}</td>
        </tr>
    `;

    const printContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>بطاقة معلومات - ${teacher.last_name} ${teacher.first_name}</title>
        <style>
            @font-face {
                font-family: 'Tajawal';
                src: url('../assets/fonts/Tajawal-Regular.ttf') format('truetype');
                font-weight: 400;
            }
            @font-face {
                font-family: 'Tajawal';
                src: url('../assets/fonts/Tajawal-Bold.ttf') format('truetype');
                font-weight: 700;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: 'Tajawal', 'Segoe UI', sans-serif;
                padding: 10mm;
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
                margin-bottom: 10px;
            }
            .header-container h3 {
                margin: 3px 0;
                font-size: 13pt;
                font-weight: 700;
            }
            .header-row {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-top: 10px;
                padding: 5px 0;
                border-top: 2px solid #2d3748;
                border-bottom: 2px solid #2d3748;
                font-size: 12pt;
                font-weight: 700;
            }
            .page-title {
                text-align: center;
                margin: 20px 0;
                font-size: 18pt;
                font-weight: 800;
                color: #2d3748;
                padding: 10px 0;
                border-bottom: 2px double #4a5568;
                background-color: #f8fafc;
            }
            .section-title {
                font-size: 14pt;
                font-weight: 700;
                color: #4a5568;
                margin: 15px 0 10px 0;
                padding: 5px 10px;
                background: #f1f5f9;
                border-right: 4px solid #667eea;
                border-radius: 0 4px 4px 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .info-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 15px;
            }
            .info-table td {
                padding: 8px 12px;
                border: 1px solid #e2e8f0;
                font-size: 12pt;
                vertical-align: middle;
            }
            .footer-section {
                margin-top: 40px;
                display: flex;
                justify-content: flex-end;
                font-size: 12pt;
            }
            .footer-section .sig-block {
                text-align: center;
                min-width: 200px;
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
                <div>مديرية التربية لولاية ${settings.wilaya || '.......'}</div>
                <div>المؤسسة: ${settings.institutionName || '.......'}</div>
            </div>
            <div style="text-align: left; align-self: center;">
                <div>السنة الدراسية: ${schoolYear}</div>
            </div>
        </div>

        <!-- Title -->
        <div class="page-title">بطاقة معلومات الأستاذ(ة)</div>

        <!-- Information Sections -->
        <div class="section-title"><i class="fas fa-user" style="margin-left: 6px;"></i> المعلومات الشخصية والمهنية</div>
        <table class="info-table">
            ${infoRow('اللقب', teacher.last_name)}
            ${infoRow('الاسم', teacher.first_name)}
            ${infoRow('تاريخ الميلاد', teacher.dob || teacher.birthDate)}
            ${infoRow('الرتبة', teacher.rank)}
            ${infoRow('المادة', teacher.subject)}
            ${infoRow('الدرجة', teacher.grade)}
            ${infoRow('تاريخ السريان', teacher.effectiveDate)}
            ${infoRow('البريد الإلكتروني', teacher.email)}
        </table>

        <div class="section-title"><i class="fas fa-tasks" style="margin-left: 6px;"></i> المهام والمسؤوليات</div>
        <table class="info-table">
            ${infoRow('أستاذ مسؤول عن المادة', Object.values(subjectResponsibles || {}).includes(teacher.id) ? 'نعم' : 'لا')}
            ${infoRow('أستاذ رئيسي للأقسام', formatResponsibleClasses(teacher.responsibleClasses) !== '-' ? formatResponsibleClasses(teacher.responsibleClasses) : 'لا يوجد')}
            ${infoRow('معفى من الحراسة', teacher.isExempt ? 'نعم' : 'لا')}
        </table>

        <!-- Footer / Signature -->
        <div class="footer-section">
            <div class="sig-block">
                <div style="margin-bottom: 10px;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                <div style="font-weight: 700; font-size: 14pt;">المدير(ة)</div>
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

/**
 * Open edit teacher modal
 */

async function openEditTeacherModal(teacherId) {

    const teacher = teachersList.find(t => t.id === teacherId);

    if (!teacher) return;

    await populateRankDropdown(); // Ensure ranks are populated
    await populateSubjectDropdown(); // Ensure subjects are populated

    document.getElementById('modalTitle').textContent = 'تعديل بيانات الأستاذ';

    document.getElementById('editTeacherId').value = teacherId;

    document.getElementById('inputLastName').value = teacher.last_name;
    document.getElementById('inputFirstName').value = teacher.first_name;
    document.getElementById('inputRank').value = teacher.rank;
    document.getElementById('inputSubject').value = teacher.subject;

    // Normalize date for input[type=date]
    let rawDob = teacher.dob || teacher.birthDate || '';
    if (rawDob && (rawDob.includes('/') || (rawDob.includes('-') && rawDob.split('-')[0].length < 4))) {
        // Looks like DD/MM/YYYY or DD-MM-YYYY
        let parts = rawDob.includes('/') ? rawDob.split('/') : rawDob.split('-');
        if (parts.length === 3) {
            let d = parts[0].padStart(2, '0');
            let m = parts[1].padStart(2, '0');
            let y = parts[2];
            if (y.length === 2) y = (parseInt(y) < 50 ? '20' : '19') + y;
            rawDob = `${y}-${m}-${d}`;
        }
    }
    document.getElementById('inputDob').value = rawDob;
    document.getElementById('inputGrade').value = teacher.grade || '';

    // Normalize effectiveDate for input[type=date]
    let rawEffDate = teacher.effectiveDate || '';
    if (rawEffDate && (rawEffDate.includes('/') || (rawEffDate.includes('-') && rawEffDate.split('-')[0].length < 4))) {
        let parts = rawEffDate.includes('/') ? rawEffDate.split('/') : rawEffDate.split('-');
        if (parts.length === 3) {
            let d = parts[0].padStart(2, '0');
            let m = parts[1].padStart(2, '0');
            let y = parts[2];
            if (y.length === 2) y = (parseInt(y) < 50 ? '20' : '19') + y;
            rawEffDate = `${y}-${m}-${d}`;
        }
    }
    document.getElementById('inputEffectiveDate').value = rawEffDate;
    document.getElementById('inputEmail').value = teacher.email || '';

    openModal('teacherModal');
}

/**

 * Save teacher (add or update)

 */

async function saveTeacher(event) {

    event.preventDefault();

    const teacherId = document.getElementById('editTeacherId').value;

    const lastName = document.getElementById('inputLastName').value.trim();

    const firstName = document.getElementById('inputFirstName').value.trim();

    const rank = document.getElementById('inputRank').value.trim();

    const subject = document.getElementById('inputSubject').value.trim();
    const dob = document.getElementById('inputDob').value;
    const grade = document.getElementById('inputGrade').value.trim();
    const effectiveDate = document.getElementById('inputEffectiveDate').value;
    const email = document.getElementById('inputEmail').value.trim();

    // Validation

    if (!lastName || !firstName || !rank || !subject) {

        if (!lastName || !firstName || !rank || !subject) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى ملء جميع الحقول المطلوبة' });
            return;
        }

    }

    // Check for duplicates (excluding current teacher if editing)

    const exists = teachersList.some(t =>

        t.id !== teacherId &&

        t.last_name === lastName &&

        t.first_name === firstName &&

        t.subject === subject

    );

    if (exists) {

        if (exists) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'هذا الأستاذ موجود مسبقاً' });
            return;
        }

    }

    if (teacherId) {

        // Update existing

        const index = teachersList.findIndex(t => t.id === teacherId);

        if (index !== -1) {

            teachersList[index].last_name = lastName;

            teachersList[index].first_name = firstName;

            teachersList[index].rank = rank;
            teachersList[index].subject = subject;
            teachersList[index].dob = dob;
            teachersList[index].grade = grade;
            teachersList[index].effectiveDate = effectiveDate;
            teachersList[index].email = email;

        }

    } else {

        // Add new

        const settings = await window.DB.getSettings() || {};
        const academicYear = settings.currentAcademicYear || DB.getCurrentAcademicYear();

        teachersList.push({

            id: generateId(),

            last_name: lastName,

            first_name: firstName,

            rank: rank,

            subject: subject,
            dob: dob,
            grade: grade,
            effectiveDate: effectiveDate,
            email: email,
            receptionHours: [],

            isSubjectResponsible: false,

            responsibleClasses: [],
            academic_year: academicYear

        });

    }

    await saveTeachersData();

    updateStats();

    renderTeachersTable();

    populateFilters();

    loadSubjectResponsibilities();

    closeModal('teacherModal');
    setTimeout(() => {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: teacherId ? 'تم تحديث البيانات بنجاح' : 'تمت إضافة الأستاذ بنجاح',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
    }, 100);

}

/**

 * Open delete confirmation modal

 */

function openDeleteModal(teacherId) {

    const teacher = teachersList.find(t => t.id === teacherId);

    if (!teacher) return;

    document.getElementById('deleteTeacherId').value = teacherId;

    document.getElementById('deleteTeacherName').textContent = `${teacher.last_name} ${teacher.first_name}`;

    openModal('deleteModal');

}

/**

 * Confirm delete teacher

 */

async function confirmDeleteTeacher() {

    const teacherId = document.getElementById('deleteTeacherId').value;

    // Remove from list

    teachersList = teachersList.filter(t => t.id !== teacherId);

    // Remove from responsibilities

    Object.keys(subjectResponsibles).forEach(subject => {

        if (subjectResponsibles[subject] === teacherId) {

            delete subjectResponsibles[subject];

        }

    });

    Object.keys(classResponsibles).forEach(classKey => {

        if (classResponsibles[classKey] === teacherId) {

            delete classResponsibles[classKey];

        }

    });

    await saveTeachersData();

    updateStats();

    renderTeachersTable();

    populateFilters();

    loadSubjectResponsibilities();

    closeModal('deleteModal');

}

// ==================== RECEPTION HOURS ====================

/**

 * Open reception hours modal

 */

function openReceptionModal(teacherId) {

    const teacher = teachersList.find(t => t.id === teacherId);

    if (!teacher) return;

    currentTeacherId = teacherId;

    document.getElementById('receptionTeacherId').value = teacherId;

    document.getElementById('receptionTeacherName').textContent = `${teacher.last_name} ${teacher.first_name}`;

    renderCurrentReceptionHours(teacher);

    openModal('receptionModal');

}

/**

 * Render current reception hours in modal

 */

function renderCurrentReceptionHours(teacher) {

    const container = document.getElementById('currentReceptionHours');

    const hours = teacher.receptionHours || [];

    if (hours.length === 0) {

        container.innerHTML = '<p style="color: #999; text-align: center;">لا توجد ساعات استقبال محددة</p>';

        return;

    }

    container.innerHTML = `

        <div style="display: flex; flex-wrap: wrap; gap: 10px;">

            ${hours.map((h, index) => `

                <div class="reception-badge" style="display: flex; align-items: center; gap: 10px;">

                    <span class="day">${h.day}</span>

                    <span>${h.period}</span>

                    <span>${h.from} - ${h.to}</span>

                    <button class="btn btn-danger btn-sm" style="padding: 3px 8px;" onclick="removeReceptionHour(${index})">أ—</button>

                </div>

            `).join('')}

        </div>

    `;

}

/**

 * Add reception hour

 */

async function addReceptionHour() {
    const teacherId = document.getElementById('receptionTeacherSelect').value;
    if (!teacherId) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'يرجى اختيار الأستاذ أولاً' });
        return;
    }

    const teacher = teachersList.find(t => t.id === teacherId);
    if (!teacher) return;

    const day = document.getElementById('inputDay').value;
    const from = document.getElementById('inputFromTime').value;
    const to = document.getElementById('inputToTime').value;

    if (!teacher.receptionHours) {
        teacher.receptionHours = [];
    }

    // Check for duplicate
    const exists = teacher.receptionHours.some(h =>
        h.day === day && h.from === from && h.to === to
    );

    if (exists) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'هذه الفترة موجودة مسبقاً لهذا الأستاذ' });
        return;
    }

    teacher.receptionHours.push({ day, from, to });

    await saveTeachersData();

    // Clear form
    document.getElementById('inputFromTime').value = '';
    document.getElementById('inputToTime').value = '';

    renderReceptionList();

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'تمت إضافة الساعة بنجاح',
        showConfirmButton: false,
        timer: 2000
    });
}

/**
 * Remove reception hour from tab list
 */
async function removeReceptionHour(teacherId, index) {
    const teacher = teachersList.find(t => t.id === teacherId);
    if (!teacher || !teacher.receptionHours) return;

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "سيتم حذف هذه الساعة بشكل نهائي",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، احذفها',
        cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
        teacher.receptionHours.splice(index, 1);
        await saveTeachersData();
        renderReceptionList();
    }
}

/**

 * Render reception list in tab

 */

function renderReceptionList() {
    const container = document.getElementById('receptionList');
    const searchTerm = document.getElementById('receptionSearchInput')?.value?.toLowerCase() || '';
    const sortValue = document.getElementById('receptionSortSelect')?.value || 'name';

    let teachersWithHours = teachersList.filter(t =>
        t.receptionHours && t.receptionHours.length > 0 &&
        (!searchTerm ||
            t.last_name.toLowerCase().includes(searchTerm) ||
            t.first_name.toLowerCase().includes(searchTerm))
    );

    // Day ordering map
    const dayOrder = {
        'السبت': 0,
        'الأحد': 1,
        'الاثنين': 2,
        'الإثنين': 2,
        'الثلاثاء': 3,
        'الأربعاء': 4,
        'الخميس': 5
    };

    // Apply Sorting
    teachersWithHours.sort((a, b) => {
        if (sortValue === 'subject') {
            return a.subject.localeCompare(b.subject, 'ar');
        } else if (sortValue === 'day') {
            const dayA = a.receptionHours[0]?.day || '';
            const dayB = b.receptionHours[0]?.day || '';
            const orderA = dayOrder[dayA] ?? 99;
            const orderB = dayOrder[dayB] ?? 99;
            if (orderA !== orderB) return orderA - orderB;
            // If same day, sort by name
            return (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name, 'ar');
        } else {
            // Default: sort by Name
            return (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name, 'ar');
        }
    });

    if (teachersWithHours.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">${IconManager.get('clock')}</div>
                <p>لا توجد نتائج بحث تطابق استفسارك.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = teachersWithHours.map(teacher => `
        <div class="reception-card-premium">
            <!-- Header: Teacher Name & Subject -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 45px; height: 45px; border-radius: 12px; background: rgba(59, 130, 246, 0.1); color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                        <i class="fas fa-user-tie"></i>
                    </div>
                    <div>
                        <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #1e293b;">${teacher.last_name} ${teacher.first_name}</h4>
                        <span style="font-size: 0.8rem; font-weight: 700; color: #64748b;">${teacher.subject}</span>
                    </div>
                </div>
            </div>

            <!-- Reception Slots List -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${teacher.receptionHours.map((h, idx) => {
        const dayClass = getDayClass(h.day);
        return `
                        <div class="time-slot-box">
                            <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                                <span class="day-pill ${dayClass}">${h.day}</span>
                                <div style="display: flex; flex-direction: column;">
                                    <span style="font-size: 0.9rem; font-family: monospace; font-weight: 700; color: #1e293b;">
                                        <i class="far fa-clock"></i> ${h.from} - ${h.to}
                                    </span>
                                </div>
                            </div>
                            <button onclick="removeReceptionHour('${teacher.id}', ${idx})"
                                    class="no-print"
                                    style="background: rgba(239, 68, 68, 0.1); border: none; color: #ef4444; cursor: pointer; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                                <i class="fas fa-trash-alt" style="font-size: 0.85rem;"></i>
                            </button>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `).join('');
}

/**
 * Helper to get CSS class for a day
 */
function getDayClass(day) {
    const map = {
        'الأحد': 'day-sunday',
        'الاثنين': 'day-monday',
        'الثلاثاء': 'day-tuesday',
        'الأربعاء': 'day-wednesday',
        'الخميس': 'day-thursday'
    };
    return map[day] || '';
}

/**
 * Populate teacher dropdown for reception management
 */
function populateReceptionTeacherSelect() {
    const select = document.getElementById('receptionTeacherSelect');
    if (!select) return;

    // Keep the first option
    const firstOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(firstOption);

    // Sort teachers by name
    const sortedTeachers = [...teachersList].sort((a, b) =>
        (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name, 'ar')
    );

    sortedTeachers.forEach(t => {
        const option = document.createElement('option');
        option.value = t.id;
        option.textContent = `${t.last_name} ${t.first_name} (${t.subject})`;
        select.appendChild(option);
    });
}

/**
 * Auto fill 'To' time based on 'From' time (+1 hour)
 */
function autoFillToTime() {
    const fromTime = document.getElementById('inputFromTime').value;
    if (!fromTime) return;

    const [hours, minutes] = fromTime.split(':');
    let h = parseInt(hours);
    h = (h + 1) % 24;
    const toTime = `${String(h).padStart(2, '0')}:${minutes}`;
    document.getElementById('inputToTime').value = toTime;
}

/**

 * Filter reception list

 */

function filterReceptionList() {

    renderReceptionList();

}

/**

 * Get common print styles

 */

function getPrintStyles() {

    return `

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0.5cm; }

        .print-page { margin-bottom: 2cm; }

        .header-container { width: 100%; margin-bottom: 10px; }

        .center-text { text-align: center; }

        h1, h2, h3 { margin: 0; color: #000; padding: 0; }

        h2 { font-size: 14pt; margin-bottom: 2px; }

        h3 { font-size: 11pt; margin-bottom: 2px; }

        .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; }

        .header-box { width: 33%; }

        table { width: 100%; border-collapse: collapse; margin-top: 5px; }

        th, td { border: 0.5pt solid #000; padding: 4px 6px; text-align: center; font-size: 11pt; line-height: 1.3; }

        th { background-color: #f0f0f0; font-weight: bold; padding: 6px; }

        .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 12pt; }

        @media print {

            @page { margin: 0.8cm; size: A4; }

            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

            .page-break { page-break-before: always; break-before: page; }

            thead { display: table-header-group; }

            tr { page-break-inside: avoid; }

        }

    `;

}

/**

 * Get common header HTML

 */

function getHeaderHTML(settings, pageTitle, subtitle) {

    return `

        <div class="header-container" style="margin-bottom: 5px;">

            <!-- Row 1: Republic & Ministry -->

            <div class="center-text" style="margin-bottom: 2px;">

                <h3 style="line-height:1;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                <h3 style="line-height:1;">وزارة التربية الوطنية</h3>

            </div>

            <!-- Row 2: Directorate (Right) - School (Left) -->

            <div class="header-row" style="margin-bottom: 2px;">

                <div class="header-box" style="text-align: right;">

                    <h3 style="line-height:1;">مديرية التربية لولاية ${settings.wilaya || '..................'}</h3>

                </div>

                <div class="header-box" style="text-align: left;">

                     <h3 style="line-height:1;">المؤسسة: ${settings.institutionName || '..................'}</h3>

                </div>

            </div>

            <!-- Row 3: Title (Center) -->

            <div class="center-text" style="margin-bottom: 5px;">

                <h2 style="text-decoration: underline; margin: 0; line-height:1;">${pageTitle}</h2>

                ${subtitle ? `<h3 style="margin-top: 5px; line-height:1;">${subtitle}</h3>` : ''}

            </div>

            <!-- Row 4: Year -->

            <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 2px 0; background-color: #f9f9f9; align-items: center;">

                 <div class="header-box" style="text-align: right; width: 50%;">

                </div>

                <div class="header-box" style="text-align: left; width: 50%;">

                    <h3 style="margin:0; line-height:1;">السنة الدراسية: ${settings.schoolYear || '2025/2026'}</h3>

                </div>

            </div>

        </div>

    `;

}

/**

 * Get common footer HTML

 */

function getFooterHTML(settings, reportType = 'teachers_list', sigSettings = {}) {

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // Use passed signature settings

    const reportConfig = sigSettings.reportSettings?.[reportType] || { signer: 'director', showSignature: true };

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    // Determine title based on signer type and gender

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }

    const signerName = signerData.fullName || settings.managerName || '';

    return `

        <div class="footer" style="justify-content: flex-end;">

            <div style="text-align: center;">

                <div style="margin-bottom: 5px;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>

                <div>${signerTitle}</div>

            </div>

        </div>

    `;

}

/**

 * Abbreviate teacher rank for print

 * Examples:

 * - "أستاذ التعليم المتوسط" -> "أ.ت.م"

 * - "أستاذ التعليم المتوسط قسم أوٍژٍ‘ل" -> "أ.ت.م قسم أوٍژٍ‘ل"

 * - "أستاذ مميز في التعليم المتوسط" -> "أ.م.ت.م"

 */

function abbreviateRank(rank, isSecondary = false) {
    if (!rank) return '';

    let abbreviated = rank;

    // Secondary School Abbreviations
    abbreviated = abbreviated.replace(/أستاذ مميز في التعليم الثانوي/g, 'أ.مم.ت.ث');
    abbreviated = abbreviated.replace(/أستاذ رئيسي في التعليم الثانوي/g, 'أ.ر.ت.ث');
    abbreviated = abbreviated.replace(/أستاذ مكون في التعليم الثانوي/g, 'أ.م.ت.ث');
    abbreviated = abbreviated.replace(/أستاذ التعليم الثانوي/g, 'أ.ت.ث');

    // Middle School Abbreviations - convert to Secondary if isSecondary is true
    abbreviated = abbreviated.replace(/أستاذ مميز في التعليم المتوسط/g, isSecondary ? 'أ.مم.ت.ث' : 'أ.مم.ت.م');
    abbreviated = abbreviated.replace(/أستاذ رئيسي في التعليم المتوسط/g, isSecondary ? 'أ.ر.ت.ث' : 'أ.ر.ت.م');
    abbreviated = abbreviated.replace(/أستاذ مكون في التعليم المتوسط/g, isSecondary ? 'أ.م.ت.ث' : 'أ.م.ت.م');
    abbreviated = abbreviated.replace(/أستاذ التعليم المتوسط/g, isSecondary ? 'أ.ت.ث' : 'أ.ت.م');

    return abbreviated;
}

/**
 * Translate stream names to Arabic abbreviations
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

 * Format class key to short form

 * Examples:

 * - "أولى متوسط_1" -> "1م1"

 * - "ثانية متوسط_2" -> "2م2"

 * - "ثالثة متوسط_3" -> "3م3"

 * - "رابعة متوسط_1" -> "4م1"

 */

function formatClassKey(classKey) {
    if (!classKey) return '';

    const parts = classKey.split('_');
    if (parts.length < 2) return classKey;

    let level = parts[0];
    let stream = '';
    let cls = '';

    if (parts.length >= 3) {
        // Secondary: [Level]_[Stream]_[Class]
        cls = parts[parts.length - 1];
        const streamRaw = parts.slice(1, parts.length - 1).join('_');
        stream = getShortStreamName(streamRaw);
    } else {
        // Middle: [Level]_[Class]
        cls = parts[1];
    }

    // Level Abbreviation
    let levelNum = '';
    if (level.includes('أولى') || level.includes('1')) levelNum = '1';
    else if (level.includes('ثانية') || level.includes('2')) levelNum = '2';
    else if (level.includes('ثالثة') || level.includes('3')) levelNum = '3';
    else if (level.includes('رابعة') || level.includes('4')) levelNum = '4';
    else levelNum = level;

    // Determine Stage
    const isSecondary = level.includes('ثانوي');

    if (isSecondary) {
        return `${levelNum}${stream ? ' ' + stream : ''} ${cls}`;
    } else {
        return `${levelNum}م${cls}`;
    }
}

/**

 * Format all responsible classes for a teacher

 */

function formatResponsibleClasses(classes) {

    if (!classes || classes.length === 0) return '-';

    return classes.map(c => formatClassKey(c)).join(', ');

}

async function printAllTeachers() {

    if (teachersList.length === 0) {

        if (teachersList.length === 0) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا يوجد أساتذة للطباعة' });
            return;
        }

    }

    const settings = await DB.getSettings();

    const sigSettings = await DB.get('signatureSettings') || {};

    const rowsHtml = teachersList.map((t, i) => {

        const isSubjectResp = Object.values(subjectResponsibles).includes(t.id);

        return `

            <tr>

                <td>${i + 1}</td>

                <td>${t.last_name}</td>

                <td>${t.first_name}</td>

                <td>${abbreviateRank(t.rank)}</td>

                <td>${t.subject}</td>

                <td>${isSubjectResp ? '&#10004;' : '-'}</td>

                <td>${formatResponsibleClasses(t.responsibleClasses)}</td>

            </tr>

        `;

    }).join('');

    const printContent = `

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>قائمة الأساتذة</title>

            <style>${getPrintStyles()}</style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

            <div class="print-page">

                ${getHeaderHTML(settings, 'قائمة أساتذة المؤسسة', `العدد الإجمالي: ${teachersList.length} أستاذ`)}

                <table>

                    <thead>

                        <tr>

                            <th width="5%">#</th>

                            <th width="18%">اللقب</th>

                            <th width="18%">الاسم</th>

                            <th width="18%">الرتبة</th>

                            <th width="25%">المادة</th>

                            <th width="8%">مسؤول مادة</th>

                            <th width="8%">أقسام</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${rowsHtml}

                    </tbody>

                </table>

                ${getFooterHTML(settings, 'teachers_list', sigSettings)}

            </div>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

        </html>

    `;

    const printWindow = window.open('', '_blank');

    printWindow.document.write(printContent);

    printWindow.document.close();

}

/**

 * Print reception hours

 */

async function printReceptionHours() {
    const searchTerm = document.getElementById('receptionSearchInput')?.value?.toLowerCase() || '';
    const sortValue = document.getElementById('receptionSortSelect')?.value || 'name';

    let teachersWithHours = teachersList.filter(t =>
        t.receptionHours && t.receptionHours.length > 0 &&
        (!searchTerm ||
            t.last_name.toLowerCase().includes(searchTerm) ||
            t.first_name.toLowerCase().includes(searchTerm))
    );

    // Day ordering map
    const dayOrder = {
        'السبت': 0, 'الأحد': 1, 'الاثنين': 2, 'الإثنين': 2, 'الثلاثاء': 3, 'الأربعاء': 4, 'الخميس': 5
    };

    // Apply Sorting
    teachersWithHours.sort((a, b) => {
        if (sortValue === 'subject') {
            return a.subject.localeCompare(b.subject, 'ar');
        } else if (sortValue === 'day') {
            const dayA = a.receptionHours[0]?.day || '';
            const dayB = b.receptionHours[0]?.day || '';
            const orderA = dayOrder[dayA] ?? 99;
            const orderB = dayOrder[dayB] ?? 99;
            if (orderA !== orderB) return orderA - orderB;
            return (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name, 'ar');
        } else {
            return (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name, 'ar');
        }
    });

    if (teachersWithHours.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'لا توجد ساعات استقبال للطباعة'
        });
        return;
    }

    const settings = await DB.getSettings();
    const sigSettings = await DB.get('signatureSettings') || {};

    const rowsHtml = teachersWithHours.map((t, i) => `
        <tr>
            <td>${i + 1}</td>
            <td style="text-align: right; padding-right: 15px;">${t.last_name} ${t.first_name}</td>
            <td>${t.subject}</td>
            <td style="text-align: right; padding: 10px 15px;">
                ${t.receptionHours.map(h => `<div style="margin-bottom: 4px;"><strong>${h.day}:</strong> من ${h.from} إلى ${h.to}</div>`).join('')}
            </td>
        </tr>
    `).join('');

    const printContent = `

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>ساعات الاستقبال</title>

            <style>${getPrintStyles()}</style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

            <div class="print-page">

                ${getHeaderHTML(settings, 'ساعات استقبال الأساتذة', `عدد الأساتذة: ${teachersWithHours.length}`)}

                <table>

                    <thead>

                        <tr>

                            <th width="5%">#</th>

                            <th width="25%">اللقب والاسم</th>

                            <th width="20%">المادة</th>

                            <th width="50%">ساعات الاستقبال</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${rowsHtml}

                    </tbody>

                </table>

                ${getFooterHTML(settings, 'reception_hours', sigSettings)}

            </div>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

        </html>

    `;

    const printWindow = window.open('', '_blank');

    printWindow.document.write(printContent);

    printWindow.document.close();

}

/**

 * Print subject responsibles

 */

async function printSubjectResponsibles() {

    const subjects = Object.keys(subjectResponsibles);

    if (subjects.length === 0) {

        alert('لا يوجد مسؤولي مواد للطباعة');

        return;

    }

    const settings = await DB.getSettings();

    const sigSettings = await DB.get('signatureSettings') || {};

    const rowsHtml = subjects.sort().map((subject, i) => {

        const teacherId = subjectResponsibles[subject];

        const teacher = teachersList.find(t => t.id === teacherId);

        return `

            <tr>

                <td>${i + 1}</td>

                <td>${subject}</td>

                <td>${teacher ? teacher.last_name : '-'}</td>

                <td>${teacher ? teacher.first_name : '-'}</td>

                <td>${teacher ? abbreviateRank(teacher.rank) : '-'}</td>

                <td></td>

            </tr>

        `;

    }).join('');

    const printContent = `

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>مسؤولي المواد</title>

            <style>${getPrintStyles()}</style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

            <div class="print-page">

                ${getHeaderHTML(settings, 'قائمة مسؤولي المواد', `عدد المواد: ${subjects.length}`)}

                <table>

                    <thead>

                        <tr>

                            <th width="5%">#</th>

                            <th width="20%">المادة</th>

                            <th width="20%">اللقب</th>

                            <th width="20%">الاسم</th>

                            <th width="20%">الرتبة</th>

                            <th width="15%">الإمضاء</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${rowsHtml}

                    </tbody>

                </table>

                ${getFooterHTML(settings, 'subject_responsibles', sigSettings)}

            </div>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

        </html>

    `;

    const printWindow = window.open('', '_blank');

    printWindow.document.write(printContent);

    printWindow.document.close();

}

/**

 * Print class responsibles

 */

async function printClassResponsibles() {

    const classKeys = Object.keys(classResponsibles);

    if (classKeys.length === 0) {

        alert('لا يوجد مسؤولي أقسام للطباعة');

        return;

    }

    const settings = await DB.getSettings();

    const sigSettings = await DB.get('signatureSettings') || {};

    // Sort by level then class

    const sortedKeys = classKeys.sort((a, b) => {

        const [levelA, clsA] = a.split('_');

        const [levelB, clsB] = b.split('_');

        if (levelA !== levelB) return levelA.localeCompare(levelB);

        return parseInt(clsA) - parseInt(clsB);

    });

    const rowsHtml = sortedKeys.map((classKey, i) => {
        // Robust splitting: [Level]_[Stream]_[Class]
        // Level and Stream might contain underscores, but usually it's [Level]_[Stream]_[Class]
        // Level is parts[0], Class is the last part. Everything in between is Stream.
        const parts = classKey.split('_');
        let level = '';
        let stream = '';
        let cls = '';

        if (parts.length >= 3) {
            level = parts[0];
            cls = parts[parts.length - 1];
            // Join middle parts as the stream
            const streamRaw = parts.slice(1, parts.length - 1).join('_');
            stream = getShortStreamName(streamRaw);
        } else {
            level = parts[0];
            cls = parts[1] || '';
        }

        const teacherId = classResponsibles[classKey];
        const teacher = teachersList.find(t => t.id === teacherId);

        const displayLevel = stream ? `${level} ${stream}` : level;

        return `
            <tr>
                <td>${i + 1}</td>
                <td>${displayLevel}</td>
                <td>${cls}</td>
                <td>${teacher ? teacher.last_name : '-'}</td>
                <td>${teacher ? teacher.first_name : '-'}</td>
                <td>${teacher ? teacher.subject : '-'}</td>
                <td></td>
            </tr>
        `;

    }).join('');

    const printContent = `

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>مسؤولي الأقسام</title>

            <style>${getPrintStyles()}</style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

            <div class="print-page">

                ${getHeaderHTML(settings, 'قائمة الأساتذة الرئيسيين (مسؤولي الأقسام)', `عدد الأقسام: ${classKeys.length}`)}

                <table>

                    <thead>

                        <tr>

                            <th width="5%">#</th>

                            <th width="18%">المستوى</th>

                            <th width="8%">القسم</th>

                            <th width="18%">اللقب</th>

                            <th width="18%">الاسم</th>

                            <th width="18%">المادة</th>

                            <th width="15%">الإمضاء</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${rowsHtml}

                    </tbody>

                </table>

                ${getFooterHTML(settings, 'class_responsibles', sigSettings)}

            </div>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

        </html>

    `;

    const printWindow = window.open('', '_blank');

    printWindow.document.write(printContent);

    printWindow.document.close();

}

/**

 * Print subject statistics table (Subjects vs Ranks)

 * Columns: Subjects

 * Rows: Ranks

 * Cells: Count of teachers per subject per rank

 */

async function printSubjectStatistics() {

    if (teachersList.length === 0) {

        alert('لا يوجد أساتذة لإنشاء الإحصائيات');

        return;

    }

    const settings = await DB.getSettings();

    const sigSettings = await DB.get('signatureSettings') || {};

    // Get unique subjects and ranks

    const subjects = [...new Set(teachersList.map(t => t.subject).filter(Boolean))].sort();

    const ranks = [...new Set(teachersList.map(t => t.rank).filter(Boolean))].sort();

    // Build statistics matrix

    const stats = {};

    ranks.forEach(rank => {

        stats[rank] = {};

        subjects.forEach(subject => {

            stats[rank][subject] = 0;

        });

    });

    // Count teachers

    teachersList.forEach(teacher => {

        if (teacher.rank && teacher.subject) {

            stats[teacher.rank][teacher.subject]++;

        }

    });

    // Calculate totals per rank

    const rankTotals = {};

    ranks.forEach(rank => {

        rankTotals[rank] = subjects.reduce((sum, sub) => sum + stats[rank][sub], 0);

    });

    // Calculate totals per subject

    const subjectTotals = {};

    subjects.forEach(sub => {

        subjectTotals[sub] = ranks.reduce((sum, rank) => sum + stats[rank][sub], 0);

    });

    // Build table headers

    const headerCells = subjects.map(sub => `<th style="writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; padding: 10px 5px; font-size: 10pt;">${sub}</th>`).join('');

    // Build table rows

    const rowsHtml = ranks.map(rank => {

        const cells = subjects.map(sub => {

            const count = stats[rank][sub];

            return `<td style="text-align: center; font-weight: ${count > 0 ? 'bold' : 'normal'}; color: ${count > 0 ? '#27ae60' : '#999'};">${count || '-'}</td>`;

        }).join('');

        return `

            <tr>

                <td style="text-align: right; font-weight: bold;">${abbreviateRank(rank, settings.educationStage === 'secondary')}</td>

                ${cells}

                <td style="background: #e8f5e9; font-weight: bold; text-align: center;">${rankTotals[rank]}</td>

            </tr>

        `;

    }).join('');

    // Build totals row

    const totalsCells = subjects.map(sub => `<td style="background: #e3f2fd; font-weight: bold; text-align: center;">${subjectTotals[sub]}</td>`).join('');

    const grandTotal = teachersList.length;

    const printContent = `

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>إحصائيات المواد حسب الرتب</title>

            <style>

                ${getPrintStyles()}

                @page { size: A4 landscape; margin: 0.8cm; }

                body { font-size: 9pt; }

                table { width: 100%; border-collapse: collapse; margin-top: 15px; }

                th, td { border: 1px solid #333; padding: 6px; }

                th { background: var(--primary-color); color: white; }

                .vertical-header th { height: 120px; }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

            <div class="print-page">

                ${getHeaderHTML(settings, 'جدول إحصائيات الأساتذة حسب المواد والرتب', `إجمالي الأساتذة: ${grandTotal} | المواد: ${subjects.length} | الرتب: ${ranks.length}`)}

                <table>

                    <thead>

                        <tr class="vertical-header">

                            <th style="width: 150px; text-align: center;">الرتبة / المادة</th>

                            ${headerCells}

                            <th style="background: #27ae60; width: 60px;">المجموع</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${rowsHtml}

                        <tr style="background: #f5f5f5; border-top: 2px solid #333;">

                            <td style="font-weight: bold; text-align: center;">المجموع</td>

                            ${totalsCells}

                            <td style="background: #ff9800; color: white; font-weight: bold; text-align: center; font-size: 12pt;">${grandTotal}</td>

                        </tr>

                    </tbody>

                </table>

                ${getFooterHTML(settings, 'subject_statistics', sigSettings)}

            </div>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

        </html>

    `;

    const printWindow = window.open('', '_blank');

    printWindow.document.write(printContent);

    printWindow.document.close();

}

// ==================== RESPONSIBILITIES ====================

/**

 * Load subject responsibilities

 */

function loadSubjectResponsibilities() {

    const container = document.getElementById('subjectResponsibilitiesGrid');

    const uniqueSubjects = [...new Set(teachersList.map(t => t.subject))].filter(Boolean).sort();

    if (uniqueSubjects.length === 0) {

        container.innerHTML = '<p style="color: #999;">لا توجد مواد متاحة. قم باستيراد الأساتذة أولا.</p>';

        return;

    }

    container.innerHTML = uniqueSubjects.map(subject => {

        const subjectTeachers = teachersList.filter(t => t.subject === subject);

        const currentResponsible = subjectResponsibles[subject] || '';

        return `

            <div class="responsibility-item">

                <span class="subject-name">${IconManager.get('book')} ${subject}</span>

                <select onchange="setSubjectResponsible('${subject}', this.value)">

                    <option value="">-- غير محدد --</option>

                    ${subjectTeachers.map(t => `

                        <option value="${t.id}" ${t.id === currentResponsible ? 'selected' : ''}>

                            ${t.last_name} ${t.first_name}

                        </option>

                    `).join('')}

                </select>

            </div>

        `;

    }).join('');

}

/**

 * Set subject responsible

 */

function setSubjectResponsible(subject, teacherId) {

    if (teacherId) {

        subjectResponsibles[subject] = teacherId;

    } else {

        delete subjectResponsibles[subject];

    }

    saveTeachersData();

    renderTeachersTable();

}

/**
 * Populate level dropdown from student data
 */
async function populateLevelDropdown() {
    const select = document.getElementById('levelSelectResp');
    if (!select) return;

    // Create stream dropdown if it doesn't exist
    let streamSelect = document.getElementById('streamSelectResp');
    if (!streamSelect) {
        streamSelect = document.createElement('select');
        streamSelect.id = 'streamSelectResp';
        streamSelect.className = 'filter-select';
        streamSelect.style.display = 'none';
        streamSelect.onchange = loadClassesForResponsibility;
        select.parentNode.insertBefore(streamSelect, select.nextSibling);
    }

    // Update onchange to use onLevelChange
    select.onchange = onLevelChange;

    // Get all students and extract unique levels
    const studentsList = await DB.getStudents();
    const levels = [...new Set(studentsList.map(s => s.level))].filter(Boolean).sort();

    // Clear and populate dropdown
    select.innerHTML = '<option value="">-- اختر المستوى --</option>';

    if (levels.length === 0) {
        // Fallback: Show default levels for both middle and secondary school
        const defaultLevels = {
            'التعليم المتوسط': ['أولى متوسط', 'ثانية متوسط', 'ثالثة متوسط', 'رابعة متوسط'],
            'التعليم الثانوي': ['أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي']
        };

        Object.entries(defaultLevels).forEach(([groupName, groupLevels]) => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = groupName;
            groupLevels.forEach(level => {
                const option = document.createElement('option');
                option.value = level;
                option.textContent = level;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        });
        return;
    }

    levels.forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level;
        select.appendChild(option);
    });
}

/**
 * Helper to get Arabic display name for stream codes
 */
function getArabicStreamName(streamCode) {
    const streamMap = {
        'science': 'علوم تجريبية',
        'math': 'رياضيات',
        'tech_math': 'تقني رياضي',
        'tech_math_civil': 'هندسة مدنية',
        'tech_math_mech': 'هندسة ميكانيكية',
        'tech_math_elec': 'هندسة كهربائية',
        'tech_math_methods': 'هندسة الطرائق',
        'management': 'تسيير واقتصاد',
        'languages': 'لغات أجنبية',
        'arts': 'آداب وفلسفة',
        'common_science': 'جذع مشترك علوم وتكنولوجيا',
        'common_arts': 'جذع مشترك آداب'
    };
    return streamMap[streamCode] || streamCode;
}

/**
 * Handle level change - show stream dropdown for secondary school
 */
async function onLevelChange() {
    const levelSelect = document.getElementById('levelSelectResp');
    const streamSelect = document.getElementById('streamSelectResp');
    const level = levelSelect.value;

    // Check if it's secondary school level
    const isSecondary = level.includes('ثانوي');

    if (isSecondary && streamSelect) {
        // Show stream dropdown and populate it
        streamSelect.style.display = 'block';
        streamSelect.innerHTML = '<option value="">-- اختر الشعبة --</option>';

        // Get unique streams from student data for this level
        const studentsList = await DB.getStudents();
        const levelStudents = studentsList.filter(s => s.level === level);
        const streams = [...new Set(levelStudents.map(s => s.stream))].filter(Boolean).sort();

        if (streams.length === 0) {
            // Fallback: Default secondary school streams
            const defaultStreams = ['علوم تجريبية', 'رياضيات', 'تقني رياضي', 'تسيير واقتصاد', 'آداب وفلسفة', 'لغات أجنبية'];
            defaultStreams.forEach(stream => {
                const option = document.createElement('option');
                option.value = stream;
                option.textContent = stream;
                streamSelect.appendChild(option);
            });
        } else {
            streams.forEach(stream => {
                const option = document.createElement('option');
                option.value = stream;
                option.textContent = getArabicStreamName(stream);
                streamSelect.appendChild(option);
            });
        }
    } else if (streamSelect) {
        // Hide stream dropdown for middle school
        streamSelect.style.display = 'none';
        streamSelect.value = '';
    }

    // Load classes
    loadClassesForResponsibility();
}

/**

 * Load classes for responsibility assignment

 */

async function loadClassesForResponsibility() {

    const container = document.getElementById('classResponsibilitiesGrid');

    const level = document.getElementById('levelSelectResp').value;

    if (!level) {

        container.innerHTML = '<p style="color: #999;">اختر المستوى لعرض الأقسام.</p>';

        return;

    }

    // Get classes from students data

    // Check if secondary school and get stream
    const isSecondary = level.includes('ثانوي');
    const streamSelect = document.getElementById('streamSelectResp');
    const stream = streamSelect ? streamSelect.value : '';

    // For secondary school, require stream selection
    if (isSecondary && !stream) {
        container.innerHTML = '<p style="color: #999;">اختر الشعبة لعرض الأقسام.</p>';
        return;
    }

    const studentsList = await DB.getStudents();

    let levelStudents = studentsList.filter(s => s.level === level);

    // Filter by stream for secondary school
    if (isSecondary && stream) {
        levelStudents = levelStudents.filter(s => s.stream === stream);
    }

    const classes = [...new Set(levelStudents.map(s => s.class))].filter(Boolean).sort();

    if (classes.length === 0) {

        container.innerHTML = '<p style="color: #999;">لا توجد أقسام لهذا المستوى. تأكد من استيراد بيانات التلاميذ.</p>';

        return;

    }

    container.innerHTML = classes.map(cls => {

        const classKey = isSecondary && stream ? `${level}_${stream}_${cls}` : `${level}_${cls}`;

        const currentResponsible = classResponsibles[classKey] || '';

        return `

            <div class="responsibility-item">

                <span class="subject-name">${IconManager.get('school')} ${level} - ${cls}</span>

                <select onchange="setClassResponsible('${classKey}', this.value)">

                    <option value="">-- غير محدد --</option>

                    ${teachersList.map(t => `

                        <option value="${t.id}" ${t.id === currentResponsible ? 'selected' : ''}>

                            ${t.last_name} ${t.first_name} (${t.subject})

                        </option>

                    `).join('')}

                </select>

            </div>

        `;

    }).join('');

}

/**

 * Set class responsible

 */

function setClassResponsible(classKey, teacherId) {

    // Remove old assignment from teacher's list

    teachersList.forEach(t => {

        if (t.responsibleClasses) {

            t.responsibleClasses = t.responsibleClasses.filter(c => c !== classKey);

        }

    });

    if (teacherId) {

        classResponsibles[classKey] = teacherId;

        // Add to teacher's list

        const teacher = teachersList.find(t => t.id === teacherId);

        if (teacher) {

            if (!teacher.responsibleClasses) {

                teacher.responsibleClasses = [];

            }

            if (!teacher.responsibleClasses.includes(classKey)) {

                teacher.responsibleClasses.push(classKey);

            }

        }

    } else {

        delete classResponsibles[classKey];

    }

    saveTeachersData();

    updateStats();

    renderTeachersTable();

}

// ==================== MODAL FUNCTIONS ====================

/**

 * Open modal

 */

function openModal(modalId) {

    document.getElementById(modalId).classList.add('active');

}

/**

 * Close modal

 */

function closeModal(modalId) {

    document.getElementById(modalId).classList.remove('active');

}

// Close modal on outside click

document.addEventListener('click', function (e) {

    if (e.target.classList.contains('modal-overlay')) {

        e.target.classList.remove('active');

    }

});

/**
 * Resolve Import Choice (Replace or Update)
 */
async function resolveImportChoice(action) {
    closeModal('importOptionsModal');

    if (!tempImportData) return;

    if (action === 'replace') {
        teachersList = [];
        subjectResponsibles = {};
        // Keep classResponsibles? Usually new teachers = new responsibilities.
        classResponsibles = {};
    }

    let importedCount = 0;
    let skippedCount = 0;

    // Start from row 4 (index 3)
    for (let i = 3; i < tempImportData.length; i++) {
        const row = tempImportData[i];
        if (!row || row.length < 7) continue;

        const lastName = row[2] ? String(row[2]).trim() : '';
        const firstName = row[3] ? String(row[3]).trim() : '';
        const rank = row[5] ? String(row[5]).trim() : '';
        const subject = row[6] ? String(row[6]).trim() : '';

        // Skip invalid rows
        if (!rank.startsWith('أستاذ')) { skippedCount++; continue; }
        if (!lastName && !firstName) { skippedCount++; continue; }

        // Check duplicates if updating
        if (action === 'update') {
            const exists = teachersList.some(t =>
                t.last_name === lastName &&
                t.first_name === firstName &&
                t.subject === subject
            );
            if (exists) { skippedCount++; continue; }
        }

        // Add new teacher
        teachersList.push({
            id: generateId(),
            last_name: lastName,
            first_name: firstName,
            rank: rank,
            subject: subject,
            receptionHours: [],
            isSubjectResponsible: false,
            responsibleClasses: []
        });

        importedCount++;
    }

    tempImportData = null;

    // Save and Refresh
    await saveTeachersData();
    updateStats();
    renderTeachersTable();
    populateFilters();
    populateReceptionTeacherSelect();
    loadSubjectResponsibilities();

    alert(`تمت العملية بنجاح.\nتم استيراد: ${importedCount}\nتم تجاوز/تخطي: ${skippedCount}`);
}

/**
 * Handle Excel file selection for teachers (New Logic with Modal)
 */
function handleTeacherFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            if (!jsonData || jsonData.length < 4) {
                alert('الملف فارغ أو لا يحتوي على بيانات كافية (يبدأ من السطر 4).');
                return;
            }

            tempImportData = jsonData;

            // Show Options Modal
            openModal('importOptionsModal');

        } catch (error) {
            console.error('Error importing file:', error);
            alert('حدث خطأ أثناء قراءة الملف. تأكد من صحة التنسيق.');
        }
    };

    event.target.value = ''; // Reset file input
}

// ==================== MESSAGING LOGIC ====================

let msgSelectedTeachers = new Set();
let msgAttachments = [];
let msgCurrentMode = 'bySubject'; // 'bySubject' or 'allTeachers'

function initMessagingTab() {
    // Populate messaging subject filter
    const subjects = [...new Set(teachersList.map(t => t.subject))].filter(Boolean).sort();
    const msgSubFilter = document.getElementById('msgSubjectFilter');
    if (msgSubFilter) {
        msgSubFilter.innerHTML = '<option value="">-- اختر المادة --</option>' +
            subjects.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    updateMsgSelectedCount();
}

window.switchMsgSubTab = function (mode) {
    msgCurrentMode = mode;

    // UI update
    const tabs = document.querySelectorAll('#msgSubTabs .msg-sub-tab');
    tabs.forEach(t => {
        t.classList.remove('active');
        t.style.background = 'transparent';
        t.style.color = '#64748b';
        t.style.boxShadow = 'none';
    });

    const filterWrap = document.getElementById('msgSubjectFilterWrap');
    const activeBtn = document.querySelector(`[onclick="switchMsgSubTab('${mode}')"]`);
    
    if (activeBtn) {
        activeBtn.classList.add('active');
        // Apply active styles dynamically (matching the premium pill design)
        activeBtn.style.background = 'linear-gradient(135deg, #1e293b, #334155)';
        activeBtn.style.color = 'var(--card-bg)';
        activeBtn.style.boxShadow = '0 10px 20px -5px rgba(15, 23, 42, 0.3)';
        
        // Quick scale animation
        activeBtn.style.transform = 'scale(0.95)';
        setTimeout(() => activeBtn.style.transform = 'scale(1.02)', 100);
    }

    if (mode === 'bySubject') {
        filterWrap.style.display = 'block';
        loadMsgTeachersBySubject();
    } else {
        filterWrap.style.display = 'none';
        renderMsgTeachersList(teachersList);
    }
};


window.loadMsgTeachersBySubject = function () {
    const subject = document.getElementById('msgSubjectFilter').value;
    if (!subject) {
        document.getElementById('msgRecipientsList').innerHTML = `
            <div style="text-align: center; padding: 30px; color: #94a3b8;">
                <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p style="font-weight: 600;">اختر مادة لعرض قائمة الأساتذة</p>
            </div>
        `;
        return;
    }

    const filtered = teachersList.filter(t => t.subject === subject);
    renderMsgTeachersList(filtered);
};

window.renderMsgTeachersList = function (list) {
    const container = document.getElementById('msgRecipientsList');
    if (!list || list.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #64748b; font-weight: 600;">لا يوجد نتائج</div>';
        return;
    }

    container.innerHTML = list.map(t => `
        <div class="msg-recipient-row" onclick="toggleMsgTeacherSelection('${t.id}')">
            <input type="checkbox" id="chkMsg_${t.id}" ${msgSelectedTeachers.has(t.id) ? 'checked' : ''} onclick="event.stopPropagation(); toggleMsgTeacherSelection('${t.id}')">
            <div class="msg-recipient-info">
                <div class="msg-recipient-name">${t.last_name} ${t.first_name}</div>
                <div class="msg-recipient-subject">${t.subject} - ${t.rank}</div>
            </div>
            <div class="msg-recipient-email">${t.email || '<span style="color: #ef4444; font-size: 0.75rem;">إيميل غير مسجل</span>'}</div>
        </div>
    `).join('');

    updateMsgSelectedCount();
};

window.toggleMsgTeacherSelection = function (id) {
    const chk = document.getElementById('chkMsg_' + id);
    if (msgSelectedTeachers.has(id)) {
        msgSelectedTeachers.delete(id);
        if (chk) chk.checked = false;
    } else {
        msgSelectedTeachers.add(id);
        if (chk) chk.checked = true;
    }
    updateMsgSelectedCount();
    updateMsgPreview();
};

window.selectAllMsgTeachers = function () {
    let listToSelect = [];
    if (msgCurrentMode === 'allTeachers') {
        listToSelect = teachersList;
    } else {
        const subject = document.getElementById('msgSubjectFilter').value;
        listToSelect = teachersList.filter(t => t.subject === subject);
    }

    listToSelect.forEach(t => msgSelectedTeachers.add(t.id));

    // Update UI checkboxes
    listToSelect.forEach(t => {
        const chk = document.getElementById('chkMsg_' + t.id);
        if (chk) chk.checked = true;
    });

    updateMsgSelectedCount();
    updateMsgPreview();
};

window.deselectAllMsgTeachers = function () {
    let listToDeselect = [];
    if (msgCurrentMode === 'allTeachers') {
        listToDeselect = teachersList;
    } else {
        const subject = document.getElementById('msgSubjectFilter').value;
        listToDeselect = teachersList.filter(t => t.subject === subject);
    }

    listToDeselect.forEach(t => msgSelectedTeachers.delete(t.id));

    // Update UI checkboxes
    listToDeselect.forEach(t => {
        const chk = document.getElementById('chkMsg_' + t.id);
        if (chk) chk.checked = false;
    });

    updateMsgSelectedCount();
    updateMsgPreview();
};

window.filterMsgTeachers = function () {
    const term = document.getElementById('msgSearchInput').value.toLowerCase();
    let baseList = [];

    if (msgCurrentMode === 'allTeachers') {
        baseList = teachersList;
    } else {
        const subject = document.getElementById('msgSubjectFilter').value;
        baseList = teachersList.filter(t => t.subject === subject);
    }

    const filtered = baseList.filter(t =>
        (t.last_name + ' ' + t.first_name).toLowerCase().includes(term) ||
        (t.subject || '').toLowerCase().includes(term)
    );

    renderMsgTeachersList(filtered);
};

function updateMsgSelectedCount() {
    const count = msgSelectedTeachers.size;
    document.getElementById('msgCountNum').textContent = count;
}

window.insertMsgVariable = function (v) {
    const body = document.getElementById('msgBody');
    const start = body.selectionStart;
    const end = body.selectionEnd;
    const text = body.value;
    body.value = text.substring(0, start) + v + text.substring(end);
    body.focus();
    body.selectionStart = body.selectionEnd = start + v.length;
    updateMsgPreview();
};

window.updateMsgPreview = function () {
    const box = document.getElementById('msgPreviewBox');
    const content = document.getElementById('msgPreviewContent');

    if (msgSelectedTeachers.size === 0) {
        box.classList.remove('show');
        return;
    }

    const firstId = Array.from(msgSelectedTeachers)[0];
    const teacher = teachersList.find(t => t.id === firstId);

    if (!teacher) {
        box.classList.remove('show');
        return;
    }

    let body = document.getElementById('msgBody').value;
    body = body.replace(/{{nom}}/g, teacher.last_name || '')
        .replace(/{{prenom}}/g, teacher.first_name || '')
        .replace(/{{matiere}}/g, teacher.subject || '')
        ;

    if (body.trim() === '') {
        box.classList.remove('show');
    } else {
        box.classList.add('show');
        content.textContent = body;
    }
};

window.addMsgAttachments = async function () {
    if (!window.ipcRenderer) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'لا يمكن الوصول إلى مُدير الملفات (IPC). يرجى فتح التطبيق كملف تنفيذي (EXE).' });
        return;
    }
    try {
        const result = await window.ipcRenderer.invoke('select-files');
        if (result.success && result.files.length > 0) {
            result.files.forEach(file => {
                // Avoid duplicates
                if (!msgAttachments.some(a => a.path === file.path)) {
                    msgAttachments.push(file);
                }
            });
            renderMsgAttachments();
        }
    } catch (err) {
        console.error('File selection error:', err);
    }
};

window.removeMsgAttachment = function (index) {
    msgAttachments.splice(index, 1);
    renderMsgAttachments();
};

function renderMsgAttachments() {
    const container = document.getElementById('msgAttachmentsList');
    container.innerHTML = msgAttachments.map((f, i) => `
        <div class="msg-attachment-item">
            <i class="fas fa-file-alt" style="color: var(--accent-indigo);"></i>
            <span class="file-name">${f.filename}</span>
            <span class="file-size">${(f.size / 1024).toFixed(1)} KB</span>
            <button class="remove-file" onclick="removeMsgAttachment(${i})">&times;</button>
        </div>
    `).join('');
}

window.sendTeacherEmails = async function () {
    if (msgSelectedTeachers.size === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار أستاذ واحد على الأقل.' });
        return;
    }

    const baseSubject = document.getElementById('msgSubject').value.trim();
    const baseBody = document.getElementById('msgBody').value.trim();

    if (!baseSubject || !baseBody) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى كتابة عنوان الرسالة ونصها.' });
        return;
    }

    const recipients = teachersList.filter(t => msgSelectedTeachers.has(t.id));
    const validRecipients = recipients.filter(t => t.email && t.email.includes('@'));

    if (validRecipients.length === 0) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'الأساتذة المختارون ليس لديهم بريد إلكتروني صالح.' });
        return;
    }

    if (validRecipients.length < recipients.length) {
        const missing = recipients.length - validRecipients.length;
        const confirmResult = await Swal.fire({
            title: 'تنبيه',
            text: `سيتم استثناء ${missing} أستاذ لعدم توفر بريد إلكتروني. هل تريد الاستمرار في إرسال ${validRecipients.length} رسالة؟`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'نعم، أرسل',
            cancelButtonText: 'إلغاء'
        });
        if (!confirmResult.isConfirmed) return;
    } else {
        const confirmResult = await Swal.fire({
            title: 'تأكيد الإرسال',
            text: `هل أنت متأكد من إرسال ${validRecipients.length} رسالة؟`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'نعم، أرسل الآن',
            cancelButtonText: 'إلغاء'
        });
        if (!confirmResult.isConfirmed) return;
    }

    // --- Batch Configuration ---
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_EMAILS = 1500;
    const DELAY_BETWEEN_BATCHES = 5000;

    // UI state for progress
    document.getElementById('msgProgressSection').classList.add('show');
    document.getElementById('msgResultBadges').style.display = 'none';
    const btnSend = document.getElementById('btnSendTeacherEmails');
    btnSend.disabled = true;

    const progressBar = document.getElementById('msgProgressBar');
    const progressLabel = document.getElementById('msgProgressLabel');
    const progressPercent = document.getElementById('msgProgressPercent');

    let successCount = 0;
    let failCount = 0;
    const total = validRecipients.length;
    const totalBatches = Math.ceil(total / BATCH_SIZE);

    for (let i = 0; i < total; i++) {
        const t = validRecipients[i];
        const teacherName = `${t.last_name} ${t.first_name}`;

        // Replacement
        const finalSubject = baseSubject.replace(/{{nom}}/g, t.last_name || '')
            .replace(/{{prenom}}/g, t.first_name || '')
            .replace(/{{matiere}}/g, t.subject || '');
        let finalBody = baseBody.replace(/{{nom}}/g, t.last_name || '')
            .replace(/{{prenom}}/g, t.first_name || '')
            .replace(/{{matiere}}/g, t.subject || '');

        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
        progressLabel.textContent = `الدفعة ${currentBatch}/${totalBatches} — جاري إرسال (${i + 1}/${total}): ${teacherName}...`;

        if (typeof window.ipcRenderer === 'undefined' || !window.ipcRenderer) {
             console.error('Electron IPC (ipcRenderer) is not available.');
             failCount++;
             continue;
        }

        try {
            const res = await window.ipcRenderer.invoke('send-email', {
                to: t.email,
                subject: finalSubject,
                body: finalBody,
                
                attachments: msgAttachments
            });

            if (res.success) {
                successCount++;
                await DB.saveMessageLog({
                    teacher_id: t.id,
                    teacher_name: teacherName,
                    subject: finalSubject,
                    body: finalBody,
                    status: 'success',
                    error_details: ''
                });
            } else {
                console.error(`Email fail (${t.email}):`, res.error);
                failCount++;
                await DB.saveMessageLog({
                    teacher_id: t.id,
                    teacher_name: teacherName,
                    subject: finalSubject,
                    body: finalBody,
                    status: 'fail',
                    error_details: res.error || 'Unknown error'
                });
            }
        } catch (err) {
            console.error(`IPC error (${t.email}):`, err);
            failCount++;
            await DB.saveMessageLog({
                teacher_id: t.id,
                teacher_name: teacherName,
                subject: finalSubject,
                body: finalBody,
                status: 'fail',
                error_details: err.message || 'IPC error'
            });
        }

        // Update progress UI
        const percent = Math.round(((i + 1) / total) * 100);
        progressBar.style.width = percent + '%';
        progressPercent.textContent = percent + '%';

        // Batch cooldown or normal delay
        if ((i + 1) % BATCH_SIZE === 0 && (i + 1) < total) {
            progressLabel.textContent = `⏸ استراحة ${DELAY_BETWEEN_BATCHES / 1000} ثوانٍ لتجنب الحظر... (الدفعة ${currentBatch}/${totalBatches} اكتملت)`;
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
        } else {
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_EMAILS));
        }
    }

    // Final result
    btnSend.disabled = false;
    progressLabel.textContent = 'اكتملت عملية المراسلة.';
    document.getElementById('msgResultBadges').style.display = 'flex';
    document.getElementById('msgSuccessCount').textContent = 'نجح: ' + successCount;
    document.getElementById('msgFailCount').textContent = 'فشل: ' + failCount;

    Swal.fire({
        icon: failCount === 0 ? 'success' : 'info',
        title: 'اكتمل الإرسال',
        html: `تم إرسال <b>${successCount}</b> رسالة بنجاح.<br>فشل إرسال <b>${failCount}</b> رسالة.`
    });
};

// Update existing switchTab to include messaging
const originalSwitchTab = window.switchTab;
window.switchTab = function (tabId) {
    if (tabId === 'messaging') {
        initMessagingTab();
        switchMsgSubTab('bySubject');
    } else {
        if (originalSwitchTab) originalSwitchTab(tabId);
    }
};

// ==================== TEACHER EMAIL IMPORT ====================

/**
 * Normalize Arabic text for better matching
 */
function normalizeArabic(text) {
    if (!text) return '';
    return String(text).trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ');
}

window.importTeacherEmails = async function (event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset input so it can be triggered again for the same file
    const fileInput = event.target;

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (jsonData.length < 2) {
            Swal.fire({ icon: 'error', title: 'خطأ', text: 'الملف فارغ أو لا يحتوي على بيانات كافية.' });
            fileInput.value = '';
            return;
        }

        let matchedCount = 0;
        let totalProcessed = 0;
        let missingEmails = 0;

        // Matching strategy based on 00001.xlsx structure:
        // Index 1: Surname (Last Name)
        // Index 2: First Name
        // Index 3: Email

        // Skip header row(s) - usually data starts from row 2 or 3
        // We look for rows where index 3 looks like an email
        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length < 4) continue;

            const excelLastName = normalizeArabic(row[1]);
            const excelFirstName = normalizeArabic(row[2]);
            const excelEmail = row[3] ? String(row[3]).trim() : '';

            if (!excelEmail || !excelEmail.includes('@')) continue;

            totalProcessed++;

            // Find matching teacher in teachersList
            const teacher = teachersList.find(t => {
                const dbLastName = normalizeArabic(t.last_name);
                const dbFirstName = normalizeArabic(t.first_name);
                return dbLastName === excelLastName && dbFirstName === excelFirstName;
            });

            if (teacher) {
                teacher.email = excelEmail;
                matchedCount++;
            }
        }

        if (matchedCount > 0) {
            await saveTeachersData();
            renderTeachersTable();

            Swal.fire({
                icon: 'success',
                title: 'اكتمل الاستيراد',
                html: `تم العثور على <b>${matchedCount}</b> أستاذ وتحديث عناوين بريدهم الإلكتروني بنجاح.`
            });
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'تنبيه',
                text: 'لم يتم العثور على أي أساتذة مطابقين في قاعدة البيانات. تأكد من أن الأسماء في ملف الإكسل تطابق الأسماء المسجلة.'
            });
        }

    } catch (err) {
        console.error('Error importing teacher emails:', err);
        Swal.fire({ icon: 'error', title: 'خطأ في الاستيراد', text: 'حدث خطأ أثناء قراءة ملف الإكسل.' });
    } finally {
        fileInput.value = '';
    }
};

// ==================== MESSAGE HISTORY ====================

window.switchMsgMainTab = function (tabName) {
    const composeTab = document.getElementById('msgTabCompose');
    const historyTab = document.getElementById('msgTabHistory');
    const btnCompose = document.getElementById('btnTabCompose');
    const btnHistory = document.getElementById('btnTabHistory');

    const activeStyle = "flex: 1; border: none; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 1.1rem; transition: all 0.3s; background: var(--accent-indigo, #4f46e5); color: white; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);";
    const inactiveStyle = "flex: 1; border: none; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 1.1rem; transition: all 0.3s; background: transparent; color: #64748b;";

    if (tabName === 'history') {
        if (composeTab) composeTab.style.display = 'none';
        if (historyTab) historyTab.style.display = 'block';
        if (btnCompose) btnCompose.setAttribute('style', inactiveStyle);
        if (btnHistory) btnHistory.setAttribute('style', activeStyle);
        loadMessageHistory();
    } else {
        if (composeTab) composeTab.style.display = 'block';
        if (historyTab) historyTab.style.display = 'none';
        if (btnCompose) btnCompose.setAttribute('style', activeStyle);
        if (btnHistory) btnHistory.setAttribute('style', inactiveStyle);
    }
};

window.loadMessageHistory = async function () {
    const container = document.getElementById('msgHistoryTableBody');
    if (!container) return;

    container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">جاري تحميل السجل...</td></tr>';

    try {
        const logs = await DB.getMessageLogs();
        if (!logs || logs.length === 0) {
            container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b; font-weight:600;">لا توجد مراسلات سابقة.</td></tr>';
            return;
        }

        container.innerHTML = logs.map(log => `
            <tr>
                <td><div class="msg-time" dir="ltr" style="font-size:0.85rem; color:#475569;">${new Date(log.sent_at).toLocaleString('ar-DZ')}</div></td>
                <td style="font-weight:700; color:#1e293b;">${log.teacher_name}</td>
                <td><span class="msg-subj-preview" title="${log.subject}" style="color:#334155; font-size:0.95rem;">${log.subject}</span></td>
                <td>
                    ${log.status === 'success'
                ? '<span class="badge bg-success" style="padding:6px 10px; font-size:0.85rem;"><i class="fas fa-check-circle"></i> نجاح</span>'
                : '<span class="badge bg-danger" style="padding:6px 10px; font-size:0.85rem;"><i class="fas fa-times-circle"></i> فشل</span>'}
                </td>
                <td>
                    <button class="btn btn-sm btn-light" onclick="showMsgDetails(${log.id})" title="عرض التفاصيل" style="border-radius:8px;">
                        <i class="fas fa-eye" style="color:var(--accent-indigo);"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteMsgLog(${log.id})" title="حذف السجل" style="border-radius:8px; margin-right:5px;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Save logs globally for details modal
        window._msgLogsCache = logs;
    } catch (err) {
        console.error('Error loading message history:', err);
        container.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">حدث خطأ أثناء تحميل السجل.</td></tr>';
    }
};

window.deleteMsgLog = async function (id) {
    const confirmResult = await Swal.fire({
        title: 'تأكيد الحذف',
        text: 'هل أنت متأكد من حذف هذا السجل؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء'
    });

    if (confirmResult.isConfirmed) {
        const success = await DB.deleteMessageLog(id);
        if (success) {
            loadMessageHistory();
        } else {
            Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء الحذف.' });
        }
    }
};

window.clearAllMsgLogs = async function () {
    const confirmResult = await Swal.fire({
        title: 'تفريغ السجل بالكامل',
        text: 'هل أنت متأكد من مسح جميع السجلات؟ لا يمكن التراجع عن هذه الخطوة.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، أفرغ السجل',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#dc2626'
    });

    if (confirmResult.isConfirmed) {
        const success = await DB.clearMessageLogs();
        if (success) {
            loadMessageHistory();
            Swal.fire({ icon: 'success', title: 'تم', text: 'تم تفريغ السجل بنجاح.', timer: 1500, showConfirmButton: false });
        } else {
            Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء التفريغ.' });
        }
    }
};

window.showMsgDetails = function (id) {
    const logs = window._msgLogsCache || [];
    const log = logs.find(l => l.id === id);
    if (!log) return;

    // Convert newlines in the body to <br> to preserve formatting in HTML.
    // Also parse links to clickable (optional).
    const bodyContent = log.body.replace(/\n/g, '<br>');
    const errorHtml = log.error_details ? `<div class="alert alert-danger" style="margin-top:15px; font-size:0.9rem; text-align:right;"><strong>تفاصيل الخطأ:</strong><br>${log.error_details}</div>` : '';

    Swal.fire({
        title: 'تفاصيل الرسالة',
        html: `
            <div style="text-align:right; font-size:0.95rem; line-height:1.6; color:#1e293b;">
                <p><strong><i class="fas fa-user text-primary"></i> إلى:</strong> ${log.teacher_name}</p>
                <p><strong><i class="fas fa-heading text-primary"></i> الموضوع:</strong> ${log.subject}</p>
                <div style="background:#f8fafc; padding:15px; border-radius:10px; border:1px solid var(--border-color); margin-top:15px; text-align:right;">
                    ${bodyContent}
                </div>
                ${errorHtml}
            </div>
        `,
        width: '600px',
        confirmButtonText: 'إغلاق',
        customClass: {
            confirmButton: 'btn btn-primary'
        },
        buttonsStyling: false
    });
};
