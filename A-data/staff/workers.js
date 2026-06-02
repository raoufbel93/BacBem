/**
 * Workers / Administrators Management
 * إدارة المشرفين والإداريين
 * ES5-compatible version
 */

var workersList = [];
var deleteTargetId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    Auth.checkAuth();
    loadWorkers();
});

/**
 * Load workers from the database
 */
function loadWorkers() {
    DB.get('workersList').then(function (data) {
        workersList = data || [];
        updateStats();
        renderTable();
    });
}

/**
 * Save workers to the database
 */
function saveWorkersData() {
    return DB.set('workersList', workersList);
}

/**
 * Update statistics display
 */
function updateStats(filtered) {
    var totalEl = document.getElementById('totalWorkers');
    if (totalEl) totalEl.textContent = workersList.length;

    var targetList = filtered || workersList;
    var counts = {
        1: 0, // Category 1
        2: 0, // Category 2
        3: 0, // Category 3
        4: 0  // Category 4
    };

    for (var i = 0; i < targetList.length; i++) {
        var cat = categorizeWorker(targetList[i].rank);
        if (counts[cat.id] !== undefined) {
            counts[cat.id]++;
        }
    }

    var cat1El = document.getElementById('countCategory1');
    if (cat1El) cat1El.textContent = counts[1];

    var cat2El = document.getElementById('countCategory2');
    if (cat2El) cat2El.textContent = counts[2];

    var cat3El = document.getElementById('countCategory3');
    if (cat3El) cat3El.textContent = counts[3];

    var cat4El = document.getElementById('countCategory4');
    if (cat4El) cat4El.textContent = counts[4];
}

// ==================== CATEGORIZATION LOGIC ====================

var CATEGORIES = {
    PROFESSIONAL: { id: 1, name: "العمال المهنيين" },
    SERVICE: { id: 2, name: "أعوان الخدمة" },
    SECURITY: { id: 3, name: "أعوان الوقاية والحراس" },
    DRIVERS: { id: 4, name: "سائقي السيارات" },
    OTHER: { id: 5, name: "أخرى" }
};

/**
 * Categorize worker based on rank
 * @param {string} rank
 * @returns {object} Category object
 */
function categorizeWorker(rank) {
    if (!rank) return CATEGORIES.OTHER;

    var r = rank.trim();

    // 1. العمال المهنيين
    if (r.indexOf("عامل مهني") !== -1 || r.indexOf("عامل مهنى") !== -1) {
        return CATEGORIES.PROFESSIONAL;
    }

    // 2. أعوان الخدمة
    if (r.indexOf("عون الخدمة") !== -1 || r.indexOf("عون خدمة") !== -1) {
        return CATEGORIES.SERVICE;
    }

    // 3. أعوان الوقاية والحراس
    if (r.indexOf("عون الوقاية") !== -1 || r.indexOf("عون وقاية") !== -1 || r.indexOf("حارس") !== -1 || r.indexOf("وقاية") !== -1) {
        return CATEGORIES.SECURITY;
    }

    // 4. سائقي السيارات
    if (r.indexOf("سائق") !== -1) {
        return CATEGORIES.DRIVERS;
    }

    return CATEGORIES.OTHER;
}

/**
 * Group an array of workers by category
 * @param {Array} list
 * @returns {Array} Array of objects { category: {...}, members: [...] } sorted by category ID
 */
function groupWorkersByCategory(list) {
    var groups = {};

    for (var i = 0; i < list.length; i++) {
        var sup = list[i];
        var cat = categorizeWorker(sup.rank);

        if (!groups[cat.id]) {
            groups[cat.id] = {
                category: cat,
                members: []
            };
        }
        groups[cat.id].members.push(sup);
    }

    // Convert to array and sort by category ID
    var result = [];
    for (var key in groups) {
        if (groups.hasOwnProperty(key)) {
            result.push(groups[key]);
        }
    }

    result.sort(function (a, b) {
        return a.category.id - b.category.id;
    });

    return result;
}

/**
 * Render the workers table
 */
function renderTable() {
    var container = document.getElementById('tableContainer');
    if (!container) return;

    var searchTerm = (document.getElementById('searchInput') || {}).value || '';
    searchTerm = searchTerm.trim().toLowerCase();

    var filtered = workersList;
    if (searchTerm) {
        filtered = workersList.filter(function (s) {
            var name = (s.name || '').toLowerCase();
            var rank = (s.rank || '').toLowerCase();
            return name.indexOf(searchTerm) !== -1 || rank.indexOf(searchTerm) !== -1;
        });
    }

    if (filtered.length === 0) {
        container.innerHTML =
            '<div class="empty-state">' +
            '<i class="fas fa-user-shield"></i>' +
            '<h4>لا توجد بيانات</h4>' +
            '<p>لم يتم العثور على عمال. يمكنك إضافتهم يدوياً أو استيرادهم من صفحة استيراد البيانات.</p>' +
            '</div>';
        return;
    }

    var html = '<table class="workers-table">';
    html += '<thead><tr>';
    html += '<th style="width: 40px;">#</th>';
    html += '<th>الرمز الوظيفي</th>';
    html += '<th>الاسم الكامل</th>';
    html += '<th>تاريخ الميلاد</th>';
    html += '<th>الدرجة</th>';
    html += '<th>تاريخ السريان</th>';
    html += '<th>الرتبة</th>';
    html += '<th class="no-print" style="width: 120px;">الإجراءات</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    var groupedData = groupWorkersByCategory(filtered);
    var globalIndex = 1;

    for (var g = 0; g < groupedData.length; g++) {
        var group = groupedData[g];

        // Category Header Row
        html += '<tr class="category-header">';
        html += '<td colspan="8" style="background-color: var(--border-color); font-weight: bold; text-align: center; color: #1e293b;">';
        html += escapeHtml(group.category.name);
        html += '</td>';
        html += '</tr>';

        for (var i = 0; i < group.members.length; i++) {
            var sup = group.members[i];
            html += '<tr>';
            html += '<td>' + (globalIndex++) + '</td>';
            html += '<td>' + escapeHtml(sup.jobCode || '') + '</td>';
            html += '<td>' + escapeHtml(sup.name || '') + '</td>';
            html += '<td>' + escapeHtml(sup.dob || '') + '</td>';
            html += '<td>' + escapeHtml(sup.grade || '') + '</td>';
            html += '<td>' + escapeHtml(sup.effectiveDate || '') + '</td>';
            html += '<td>' + escapeHtml(sup.rank || '') + '</td>';
            html += '<td class="no-print">';
            html += '<div class="action-btns">';
            html += '<button class="btn btn-warning btn-sm" onclick="openEditModal(\'' + sup.id + '\')" title="تعديل">';
            html += '<i class="fas fa-edit"></i>';
            html += '</button>';
            html += '<button class="btn btn-danger btn-sm" onclick="openDeleteModal(\'' + sup.id + '\')" title="حذف">';
            html += '<i class="fas fa-trash-alt"></i>';
            html += '</button>';
            html += '</div>';
            html += '</td>';
            html += '</tr>';
        }
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

/**
 * Generate a unique ID
 */
function generateId() {
    return 'sup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

// ==================== MODAL FUNCTIONS ====================

/**
 * Open add modal
 */
function openAddModal() {
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-plus"></i> إضافة عامل';
    document.getElementById('editWorkerId').value = '';
    document.getElementById('inputLastName').value = '';
    document.getElementById('inputFirstName').value = '';
    document.getElementById('inputDob').value = '';
    document.getElementById('inputJobCode').value = '';
    document.getElementById('inputGrade').value = '';
    document.getElementById('inputEffectiveDate').value = '';

    var rankSelect = document.getElementById('inputRank');
    rankSelect.value = '';

    var customGroup = document.getElementById('customRankGroup');
    var customInput = document.getElementById('inputCustomRank');
    customGroup.style.display = 'none';
    customInput.value = '';
    customInput.removeAttribute('required');

    document.getElementById('workerModal').classList.add('active');
}

/**
 * Handle Rank Selection Change
 */
function handleRankSelection() {
    var rankSelect = document.getElementById('inputRank');
    var customGroup = document.getElementById('customRankGroup');
    var customInput = document.getElementById('inputCustomRank');

    if (rankSelect.value === 'other') {
        customGroup.style.display = 'block';
        customInput.setAttribute('required', 'required');
        customInput.focus();
    } else {
        customGroup.style.display = 'none';
        customInput.removeAttribute('required');
        customInput.value = '';
    }
}

/**
 * Open edit modal
 */
function openEditModal(id) {
    var worker = null;
    for (var i = 0; i < workersList.length; i++) {
        if (workersList[i].id === id) {
            worker = workersList[i];
            break;
        }
    }
    if (!worker) return;

    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-edit"></i> تعديل عامل';
    document.getElementById('editWorkerId').value = id;

    // Parse the name into parts (name is stored as "lastName firstName")
    var nameParts = (worker.name || '').split(' ');
    var lastName = nameParts[0] || '';
    var firstName = nameParts.slice(1).join(' ') || '';

    document.getElementById('inputLastName').value = lastName;
    document.getElementById('inputFirstName').value = firstName;
    document.getElementById('inputDob').value = worker.dob || '';
    document.getElementById('inputJobCode').value = worker.jobCode || '';
    document.getElementById('inputGrade').value = worker.grade || '';
    document.getElementById('inputEffectiveDate').value = worker.effectiveDate || '';

    var rankSelect = document.getElementById('inputRank');
    var customGroup = document.getElementById('customRankGroup');
    var customInput = document.getElementById('inputCustomRank');

    // Check if the worker's rank exists in the dropdown options
    var optionExists = false;
    for (var i = 0; i < rankSelect.options.length; i++) {
        if (rankSelect.options[i].value === worker.rank) {
            optionExists = true;
            break;
        }
    }

    if (optionExists && worker.rank) {
        rankSelect.value = worker.rank;
        customGroup.style.display = 'none';
        customInput.removeAttribute('required');
    } else {
        rankSelect.value = 'other';
        customGroup.style.display = 'block';
        customInput.setAttribute('required', 'required');
        customInput.value = worker.rank || '';
    }

    document.getElementById('workerModal').classList.add('active');
}

/**
 * Close add/edit modal
 */
function closeModal() {
    document.getElementById('workerModal').classList.remove('active');
}

/**
 * Save worker (add or update)
 */
function saveWorker(event) {
    event.preventDefault();

    var id = document.getElementById('editWorkerId').value;
    var lastName = document.getElementById('inputLastName').value.trim();
    var firstName = document.getElementById('inputFirstName').value.trim();
    var dob = document.getElementById('inputDob').value.trim();
    var jobCode = document.getElementById('inputJobCode').value.trim();
    var grade = document.getElementById('inputGrade').value.trim();
    var effectiveDate = document.getElementById('inputEffectiveDate').value.trim();

    var rankSelect = document.getElementById('inputRank');
    var rank = rankSelect.value;
    if (rank === 'other') {
        rank = document.getElementById('inputCustomRank').value.trim();
    }

    if (!lastName || !firstName) {
        alert('يرجى ملء جميع الحقول المطلوبة.');
        return;
    }

    var fullName = lastName + ' ' + firstName;

    if (id) {
        // Update existing
        for (var i = 0; i < workersList.length; i++) {
            if (workersList[i].id === id) {
                workersList[i].name = fullName;
                workersList[i].dob = dob;
                workersList[i].jobCode = jobCode;
                workersList[i].grade = grade;
                workersList[i].effectiveDate = effectiveDate;
                workersList[i].rank = rank;
                break;
            }
        }
    } else {
        // Add new
        workersList.push({
            id: generateId(),
            name: fullName,
            dob: dob,
            jobCode: jobCode,
            grade: grade,
            effectiveDate: effectiveDate,
            rank: rank
        });
    }

    saveWorkersData().then(function () {
        closeModal();
        updateStats();
        renderTable();
    });
}

// ==================== DELETE FUNCTIONS ====================

/**
 * Open delete confirmation modal
 */
function openDeleteModal(id) {
    deleteTargetId = id;
    var worker = null;
    for (var i = 0; i < workersList.length; i++) {
        if (workersList[i].id === id) {
            worker = workersList[i];
            break;
        }
    }
    if (!worker) return;

    document.getElementById('deleteTargetName').textContent = worker.name || '';
    document.getElementById('deleteModal').classList.add('active');
}

/**
 * Close delete modal
 */
function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    deleteTargetId = null;
}

/**
 * Confirm delete
 */
function confirmDelete() {
    if (!deleteTargetId) return;

    workersList = workersList.filter(function (s) {
        return s.id !== deleteTargetId;
    });

    saveWorkersData().then(function () {
        closeDeleteModal();
        updateStats();
        renderTable();
    });
}

// ==================== PRINT HELPERS (matching teachers.js format) ====================

/**
 * Get common print styles (same as teachers.js)
 */
function getWorkerPrintStyles() {
    return '\n' +
        '* { box-sizing: border-box; margin: 0; padding: 0; }\n' +
        "body { font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0.5cm; }\n" +
        '.print-page { margin-bottom: 2cm; }\n' +
        '.header-container { width: 100%; margin-bottom: 10px; }\n' +
        '.center-text { text-align: center; }\n' +
        'h1, h2, h3 { margin: 0; color: #000; padding: 0; }\n' +
        'h2 { font-size: 14pt; margin-bottom: 2px; }\n' +
        'h3 { font-size: 11pt; margin-bottom: 2px; }\n' +
        '.header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; }\n' +
        '.header-box { width: 33%; }\n' +
        'table { width: 100%; border-collapse: collapse; margin-top: 5px; }\n' +
        'th, td { border: 0.5pt solid #000; padding: 4px 6px; text-align: center; font-size: 11pt; line-height: 1.3; }\n' +
        'th { background-color: #f0f0f0; font-weight: bold; padding: 6px; }\n' +
        '.footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 12pt; }\n' +
        '@media print {\n' +
        '    @page { margin: 0.8cm; size: A4; }\n' +
        '    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n' +
        '    .page-break { page-break-before: always; break-before: page; }\n' +
        '    thead { display: table-header-group; }\n' +
        '    tr { page-break-inside: avoid; }\n' +
        '}\n';
}

/**
 * Get common header HTML (same as teachers.js)
 */
function getWorkerHeaderHTML(settings, pageTitle, subtitle) {
    return '<div class="header-container" style="margin-bottom: 5px;">' +
        '<div class="center-text" style="margin-bottom: 2px;">' +
        '<h3 style="line-height:1;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>' +
        '<h3 style="line-height:1;">وزارة التربية الوطنية</h3>' +
        '</div>' +
        '<div class="header-row" style="margin-bottom: 2px;">' +
        '<div class="header-box" style="text-align: right;">' +
        '<h3 style="line-height:1;">المؤسسة: ' + escapeHtml(settings.institutionName || '..................') + '</h3>' +
        '</div>' +
        '<div class="header-box" style="text-align: left;">' +
        '<h3 style="line-height:1;">مديرية التربية لولاية ' + escapeHtml(settings.wilaya || '..................') + '</h3>' +
        '</div>' +
        '</div>' +
        '<div class="center-text" style="margin-bottom: 5px;">' +
        '<h2 style="text-decoration: underline; margin: 0; line-height:1;">' + pageTitle + '</h2>' +
        (subtitle ? '<h3 style="margin-top: 5px; line-height:1;">' + subtitle + '</h3>' : '') +
        '</div>' +
        '<div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 2px 0; background-color: #f9f9f9; align-items: center;">' +
        '<div class="header-box" style="text-align: right; width: 50%;">' +
        '<h3 style="margin:0; line-height:1;">السنة الدراسية: ' + escapeHtml(settings.schoolYear || '2025/2026') + '</h3>' +
        '</div>' +
        '<div class="header-box" style="text-align: left; width: 50%;"></div>' +
        '</div>' +
        '</div>';
}

/**
 * Get common footer HTML (same as teachers.js)
 */
function getWorkerFooterHTML(settings, sigSettings) {
    var today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    var reportConfig = {};
    if (sigSettings && sigSettings.reportSettings && sigSettings.reportSettings.workers_list) {
        reportConfig = sigSettings.reportSettings.workers_list;
    } else if (sigSettings && sigSettings.reportSettings && sigSettings.reportSettings.teachers_list) {
        reportConfig = sigSettings.reportSettings.teachers_list;
    }
    if (!reportConfig.signer) reportConfig.signer = 'director';

    var signerData = {};
    if (sigSettings && sigSettings.signers && sigSettings.signers[reportConfig.signer]) {
        signerData = sigSettings.signers[reportConfig.signer];
    }

    var signerTitle;
    if (reportConfig.signer === 'director') {
        signerTitle = (signerData.gender === 'female') ? 'المديرة' : 'المدير';
    } else {
        signerTitle = (signerData.gender === 'female') ? 'الناظرة' : 'الناظر';
    }

    return '<div class="footer" style="justify-content: flex-end;">' +
        '<div style="text-align: center;">' +
        '<div style="margin-bottom: 5px;">حرر بـ: ' + escapeHtml(settings.municipality || '.......') + ' في: ' + today + '</div>' +
        '<div>' + signerTitle + '</div>' +
        '</div>' +
        '</div>';
}

// ==================== PRINT FUNCTION ====================

/**
 * Print workers list (matching teachers print format)
 */
function printWorkers() {
    if (workersList.length === 0) {
        alert('لا توجد بيانات للطباعة.');
        return;
    }

    Promise.all([
        DB.getSettings(),
        DB.get('signatureSettings')
    ]).then(function (results) {
        var settings = results[0] || {};
        var sigSettings = results[1] || {};

        var groupedData = groupWorkersByCategory(workersList);
        var globalIndex = 1;
        var rowsHtml = '';

        for (var g = 0; g < groupedData.length; g++) {
            var group = groupedData[g];

            // Category Header Row for Print
            rowsHtml += '<tr style="background-color: #d1d5db; -webkit-print-color-adjust: exact; print-color-adjust: exact;">';
            rowsHtml += '<td colspan="7" style="font-weight: bold; text-align: center; padding: 8px;">';
            rowsHtml += escapeHtml(group.category.name);
            rowsHtml += '</td>';
            rowsHtml += '</tr>';

            for (var i = 0; i < group.members.length; i++) {
                var s = group.members[i];
                rowsHtml += '<tr>' +
                    '<td>' + (globalIndex++) + '</td>' +
                    '<td>' + escapeHtml(s.jobCode || '') + '</td>' +
                    '<td style="text-align: right;">' + escapeHtml(s.name || '') + '</td>' +
                    '<td>' + escapeHtml(s.dob || '') + '</td>' +
                    '<td>' + escapeHtml(s.grade || '') + '</td>' +
                    '<td>' + escapeHtml(s.effectiveDate || '') + '</td>' +
                    '<td>' + escapeHtml(s.rank || '') + '</td>' +
                    '</tr>';
            }
        }

        var printContent = '<!DOCTYPE html>' +
            '<html lang="ar" dir="rtl">' +
            '<head>' +
            '<meta charset="UTF-8">' +
            '<title>قائمة العمال</title>' +
            '<style>' + getWorkerPrintStyles() + '</style>' +
            '\n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : '') + '\n        </head>' +
            '<body>\n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : '') + '' +
            '<div class="print-page">' +
            getWorkerHeaderHTML(settings, 'قائمة العمال', 'العدد الإجمالي: ' + workersList.length + ' عامل') +
            '<table>' +
            '<thead><tr>' +
            '<th width="5%">#</th>' +
            '<th width="10%">الرمز الوظيفي</th>' +
            '<th width="20%">الاسم الكامل</th>' +
            '<th width="15%">تاريخ الميلاد</th>' +
            '<th width="8%">الدرجة</th>' +
            '<th width="15%">تاريخ السريان</th>' +
            '<th width="22%">الرتبة</th>' +
            '</tr></thead>' +
            '</tbody>' + rowsHtml + '</tbody>' +
            '</table>' +
            getWorkerFooterHTML(settings, sigSettings) +
            '</div>' +
            '' +
            '\n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : '') + '\n        </body></html>';

        var printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
    });
}
