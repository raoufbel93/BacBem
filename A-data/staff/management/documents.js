/**
 * Administrative Documents Page
 * الوثائق الإدارية
 * ES5-compatible version
 */

var allTeachers = [];
var allSupervisors = [];
var allWorkers = [];
var selectedEmployee = null;
var selectedCategory = '';
var selectedDocument = '';
var inquiryRecords = [];
var resumeRecords = [];
var deductionRecords = [];

// Default settings
var docSettings = {
    inquiryTitle: 'استفسار',
    inquiryRef: 'طبقا للقرار الوزاري رقم : 65 مؤرخ في 28 شوال 1439هجري الموافق 12 جويلية 2018 الذي يحدد كيفيات تنظيم الجماعة التربوية و سيرها',
    directorSign: 'المدير'
};

/**
 * Get display name for an employee
 * Teachers use last_name/first_name, supervisors/workers use name
 */
function getEmployeeName(emp) {
    if (!emp) return '';
    if (emp.name) return emp.name;
    var lastName = emp.last_name || '';
    var firstName = emp.first_name || '';
    if (lastName || firstName) return (lastName + ' ' + firstName).trim();
    return '';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    Auth.checkAuth();
    loadDocSettings();
    loadInquiryRecords();
    loadResumeRecords();
    loadDeductionRecords();
    loadAllData();
});

/**
 * Load inquiry records from DB
 */
function loadInquiryRecords() {
    DB.get('inquiryRecords').then(function (records) {
        inquiryRecords = records || [];
    });
}

/**
 * Load resume work records from DB
 */
function loadResumeRecords() {
    DB.get('resumeRecords').then(function (records) {
        resumeRecords = records || [];
    });
}

/**
 * Load deduction records from DB
 */
function loadDeductionRecords() {
    DB.get('deductionRecords').then(function (records) {
        deductionRecords = records || [];
    });
}

/**
 * Load document settings from localStorage
 */
function loadDocSettings() {
    var stored = localStorage.getItem('doc_settings');
    if (stored) {
        try {
            var parsed = JSON.parse(stored);
            if (parsed) {
                if (parsed.inquiryTitle) docSettings.inquiryTitle = parsed.inquiryTitle;
                if (parsed.inquiryRef) docSettings.inquiryRef = parsed.inquiryRef;
                if (parsed.directorSign) docSettings.directorSign = parsed.directorSign;
            }
        } catch (e) {
            console.error('Error parsing settings', e);
        }
    }
}

/**
 * Show settings modal
 */
function showDocSettings() {
    document.getElementById('settingInquiryTitle').value = docSettings.inquiryTitle;
    document.getElementById('settingInquiryRef').value = docSettings.inquiryRef;
    document.getElementById('settingDirectorSign').value = docSettings.directorSign;

    var modalEl = document.getElementById('settingsModal');
    var modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Save settings to localStorage
 */
function saveDocSettings() {
    var title = document.getElementById('settingInquiryTitle').value.trim();
    var ref = document.getElementById('settingInquiryRef').value.trim();
    var sign = document.getElementById('settingDirectorSign').value.trim();

    if (title) docSettings.inquiryTitle = title;
    if (ref) docSettings.inquiryRef = ref;
    if (sign) docSettings.directorSign = sign;

    localStorage.setItem('doc_settings', JSON.stringify(docSettings));

    // Close modal
    var modalEl = document.getElementById('settingsModal');
    var modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // Show success message (simple alert for now as per codebase style)
    alert('تم حفظ الإعدادات بنجاح.');
}

/**
 * Load all employee data from databases
 */
function loadAllData() {
    Promise.all([
        DB.getTeachers(),
        DB.get('supervisorsList'),
        DB.get('workersList')
    ]).then(function (results) {
        allTeachers = results[0] || [];
        allSupervisors = results[1] || [];
        allWorkers = results[2] || [];
    });
}

/**
 * Handle category selection change
 */
function onCategoryChange() {
    var category = document.getElementById('categorySelect').value;
    selectedCategory = category;
    selectedEmployee = null;
    selectedDocument = '';

    // Hide employee info and inquiry form sections
    document.getElementById('employeeInfoCard').className = 'employee-info-card';
    document.getElementById('inquiryFormSection').className = 'inquiry-form-section';
    var resumeSection = document.getElementById('resumeFormSection');
    if (resumeSection) resumeSection.className = 'inquiry-form-section';
    var deductionSection = document.getElementById('deductionFormSection');
    if (deductionSection) deductionSection.className = 'inquiry-form-section';

    // Remove active from doc cards
    var cards = document.querySelectorAll('.doc-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].className = cards[i].className.replace(' active', '');
    }

    var employeeSelect = document.getElementById('employeeSelect');
    employeeSelect.disabled = false;
    employeeSelect.innerHTML = '<option value="" disabled selected>-- اختر الموظف --</option>';

    var employees = [];
    if (category === 'teachers') {
        employees = allTeachers;
    } else if (category === 'supervisors') {
        employees = allSupervisors;
    } else if (category === 'workers') {
        employees = allWorkers;
    }

    // Sort alphabetically
    employees.sort(function (a, b) {
        var nameA = (a.name || '').toLowerCase();
        var nameB = (b.name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });

    for (var i = 0; i < employees.length; i++) {
        var emp = employees[i];
        var option = document.createElement('option');
        option.value = emp.id || i;
        var name = getEmployeeName(emp);
        var rank = emp.rank || emp.subject || '';
        option.textContent = name + (rank ? ' - ' + rank : '');
        option.setAttribute('data-index', i);
        employeeSelect.appendChild(option);
    }
}

/**
 * Handle employee selection change
 */
function onEmployeeChange() {
    var employeeSelect = document.getElementById('employeeSelect');
    var selectedOption = employeeSelect.options[employeeSelect.selectedIndex];
    var idx = parseInt(selectedOption.getAttribute('data-index'));

    var employees = [];
    if (selectedCategory === 'teachers') {
        employees = allTeachers;
    } else if (selectedCategory === 'supervisors') {
        employees = allSupervisors;
    } else if (selectedCategory === 'workers') {
        employees = allWorkers;
    }

    selectedEmployee = employees[idx] || null;

    if (selectedEmployee) {
        // Show employee info card
        document.getElementById('employeeName').textContent = getEmployeeName(selectedEmployee);

        var rankText = selectedEmployee.rank || selectedEmployee.subject || '';
        document.getElementById('employeeRank').textContent = rankText;

        // Update avatar icon based on category
        var avatarEl = document.getElementById('employeeAvatar');
        if (selectedCategory === 'teachers') {
            avatarEl.innerHTML = '<i class="fas fa-chalkboard-teacher"></i>';
            avatarEl.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
        } else if (selectedCategory === 'supervisors') {
            avatarEl.innerHTML = '<i class="fas fa-user-tie"></i>';
            avatarEl.style.background = 'linear-gradient(135deg, #8b5cf6, #6366f1)';
        } else if (selectedCategory === 'workers') {
            avatarEl.innerHTML = '<i class="fas fa-hard-hat"></i>';
            avatarEl.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
        }

        document.getElementById('employeeInfoCard').className = 'employee-info-card visible';
    }
}

/**
 * Select a document type
 */
function selectDocument(docType) {
    if (!selectedEmployee) {
        showDialog({
            title: 'تنبيه',
            message: 'يرجى اختيار الموظف أولاً.',
            type: 'warning',
            confirmOnly: true
        });
        return;
    }

    selectedDocument = docType;

    // Update active states on doc cards
    var cards = document.querySelectorAll('.doc-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].className = cards[i].className.replace(' active', '');
    }

    if (docType === 'inquiry') {
        document.getElementById('docInquiry').className += ' active';
        document.getElementById('inquiryFormSection').className = 'inquiry-form-section visible';

        var resumeSection = document.getElementById('resumeFormSection');
        if (resumeSection) resumeSection.className = 'inquiry-form-section';

        var deductionSection = document.getElementById('deductionFormSection');
        if (deductionSection) deductionSection.className = 'inquiry-form-section';

        // Auto-fill inquiry number
        document.getElementById('inquiryNumber').value = getNextInquiryNumber();
    } else if (docType === 'resume') {
        document.getElementById('docResume').className += ' active';
        var resumeSection = document.getElementById('resumeFormSection');
        if (resumeSection) resumeSection.className = 'inquiry-form-section visible';

        document.getElementById('inquiryFormSection').className = 'inquiry-form-section';

        var deductionSection = document.getElementById('deductionFormSection');
        if (deductionSection) deductionSection.className = 'inquiry-form-section';

        // Setup today's date if empty
        if (!document.getElementById('resumeDate').value) {
            var today = new Date();
            var y = today.getFullYear();
            var m = String(today.getMonth() + 1).padStart(2, '0');
            var d = String(today.getDate()).padStart(2, '0');
            document.getElementById('resumeDate').value = y + '-' + m + '-' + d;
        }
    } else if (docType === 'deduction') {
        document.getElementById('docDeduction').className += ' active';
        var deductionSection = document.getElementById('deductionFormSection');
        if (deductionSection) deductionSection.className = 'inquiry-form-section visible';
        document.getElementById('inquiryFormSection').className = 'inquiry-form-section';
        var resumeSection = document.getElementById('resumeFormSection');
        if (resumeSection) resumeSection.className = 'inquiry-form-section';

        // Setup today's date if empty
        if (!document.getElementById('deductionAbsenceDate').value) {
            var today = new Date();
            var d = String(today.getDate()).padStart(2, '0');
            var m = String(today.getMonth() + 1).padStart(2, '0');
            var y = today.getFullYear();
            document.getElementById('deductionAbsenceDate').value = d + '/' + m + '/' + y;
        }

        // Pre-fill year if empty
        var yearInput = document.getElementById('deductionYear');
        if (yearInput && !yearInput.value) {
            yearInput.value = window.appSettings ? window.appSettings.schoolYear : '2021/23';
        }
    }
}

/**
 * Calculate the next inquiry number based on existing records
 */
function getNextInquiryNumber() {
    if (!inquiryRecords || inquiryRecords.length === 0) return '1';

    var maxNum = 0;
    for (var i = 0; i < inquiryRecords.length; i++) {
        var num = parseInt(inquiryRecords[i].number);
        if (!isNaN(num) && num > maxNum) {
            maxNum = num;
        }
    }
    return (maxNum + 1).toString();
}

/**
 * Get the employee's job title for the inquiry form
 */
function getEmployeeJobTitle(employee, category) {
    if (!employee) return '';

    if (category === 'teachers') {
        var rank = employee.rank || 'أستاذ التعليم المتوسط';
        var subject = employee.subject || '';
        if (subject) {
            return rank + ' مادة ' + subject;
        }
        return rank;
    }

    return employee.rank || '';
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text || ''));
    return div.innerHTML;
}

/**
 * Print the inquiry document (استفسار)
 */
function printInquiry() {
    if (!selectedEmployee) {
        showDialog({
            title: 'تنبيه',
            message: 'يرجى اختيار الموظف أولاً.',
            type: 'warning',
            confirmOnly: true
        });
        return;
    }

    var reason = document.getElementById('inquiryReason').value.trim();
    if (!reason) {
        showDialog({
            title: 'حقل مطلوب',
            message: 'يرجى إدخال نص التبرير المطلوب.',
            type: 'warning',
            confirmOnly: true
        }).then(function() {
            document.getElementById('inquiryReason').focus();
        });
        return;
    }

    var inquiryNumber = document.getElementById('inquiryNumber').value.trim();

    Promise.all([
        DB.getSettings(),
        DB.get('signatureSettings')
    ]).then(function (results) {
        var settings = results[0] || {};
        var sigSettings = results[1] || {};

        var employeeName = escapeHtml(getEmployeeName(selectedEmployee));
        var jobTitle = escapeHtml(getEmployeeJobTitle(selectedEmployee, selectedCategory));
        var institution = escapeHtml(settings.institutionName || '..................');
        var wilaya = escapeHtml(settings.wilaya || '..................');
        var municipality = escapeHtml(settings.municipality || '..................');

        // Get today's date in Arabic format
        var today = new Date();
        var day = today.getDate();
        var month = today.getMonth() + 1;
        var year = today.getFullYear();
        var formattedDate = year + '/' + month + '/' + day;

        // Determine director gender from signature settings
        var directorTitle = docSettings.directorSign || 'المدير(ة)';
        if (sigSettings && sigSettings.signers && sigSettings.signers.director) {
            var dirGender = sigSettings.signers.director.gender;
            if (dirGender === 'female') {
                directorTitle = 'المديرة';
            } else if (dirGender === 'male') {
                directorTitle = 'المدير';
            }
        }

        var printContent = '<!DOCTYPE html>' +
            '<html lang="ar" dir="rtl">' +
            '<head>' +
            '<meta charset="UTF-8">' +
            '<title>' + escapeHtml(docSettings.inquiryTitle) + ' - ' + employeeName + '</title>' +
            '<style>' +
            '* { box-sizing: border-box; margin: 0; padding: 0; }' +
            "body { font-family: 'Traditional Arabic', 'Sakkal Majalla', 'Cairo', serif; margin: 0; padding: 1cm; color: #000; font-size: 16pt; line-height: 1.4; }" +
            '.header-section { text-align: center; margin-bottom: 2px; }' +
            '.header-section h2 { font-size: 18pt; font-weight: bold; margin: 0; line-height: 1.2; }' +
            '.header-section h3 { font-size: 15pt; font-weight: bold; margin: 0; line-height: 1.2; }' +
            '.info-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0; }' +
            '.info-right { text-align: right; }' +
            '.info-right h3 { font-size: 14pt; font-weight: bold; margin: 0; line-height: 1.2; }' +
            '.info-left { text-align: left; }' +
            '.info-left h3 { font-size: 16pt; font-weight: bold; margin: 0; line-height: 1.2; }' +
            '.doc-number { text-align: right; margin-bottom: 5px; font-size: 14pt; }' +
            '.doc-title { text-align: center; font-size: 24pt; font-weight: bold; margin: 10px 0; text-decoration: underline; }' +
            '.legal-text { font-size: 13pt; text-align: center; margin-bottom: 15px; line-height: 1.3; color: #333; }' +
            '.employee-info { margin-bottom: 5px; font-size: 16pt; line-height: 1.4; text-align: right; }' +
            '.request-text { font-size: 16pt; margin-bottom: 5px; text-align: right; line-height: 1.4; font-weight: bold; }' +
            '.date-line { margin: 10px 0 2px; font-size: 15pt; text-align: left; }' +
            '.director-sign { text-align: left; font-size: 15pt; font-weight: bold; }' +
            '.response-section { margin-top: 25px; }' +
            '.response-section h4 { font-size: 16pt; font-weight: bold; margin-bottom: 10px; text-align: right; }' +
            '.response-box { border: 1.5px solid #000; min-height: 120px; border-radius: 4px; padding: 10px; margin-bottom: 10px; }' +
            '.response-date { font-size: 14pt; margin-bottom: 5px; text-align: left; }' +
            '.response-sign { font-size: 15pt; font-weight: bold; text-align: left; }' +
            '.decision-section { margin-top: 20px; }' +
            '.decision-section h4 { font-size: 16pt; font-weight: bold; margin-bottom: 10px; text-align: right; }' +
            '.decision-box { border: 1.5px solid #000; min-height: 120px; border-radius: 4px; padding: 10px; margin-bottom: 10px; }' +
            '.decision-date { font-size: 14pt; margin-bottom: 5px; text-align: left; }' +
            '.decision-sign { text-align: left; font-size: 15pt; font-weight: bold; }' +
            '@media print {' +
            '    @page { margin: 1cm; size: A4; }' +
            '    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }' +
            '}' +
            '</style>' +
            '\n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : '') + '\n        </head>' +
            '<body>\n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : '') +

            // Header - Republic and Ministry centered
            '<div class="header-section">' +
            '<h2>الجمهورية الجزائرية الديمقراطية الشعبية</h2>' +
            '<h2>وزارة التربية الوطنية</h2>' +
            '</div>' +

            // Info row: Directorate+Municipality on far right, Institution on far left
            '<div class="info-row">' +
            '<div class="info-right">' +
            '<h3>مديرية التربية لولاية ' + wilaya + '</h3>' +
            '<h3>بلدية ' + municipality + '</h3>' +
            '</div>' +
            '<div class="info-left">' +
            '<h3>المؤسسة: ' + institution + '</h3>' +
            '</div>' +
            '</div>' +

            // Document number
            '<div class="doc-number">' +
            'رقم: ' + escapeHtml(inquiryNumber || '') +
            '</div>' +

            // Title
            '<div class="doc-title">' + escapeHtml(docSettings.inquiryTitle) + '</div>' +

            // Legal reference text
            '<div class="legal-text">' +
            escapeHtml(docSettings.inquiryRef) +
            '</div>' +

            // Employee info
            '<div class="employee-info">' +
            'السيد(ة): <strong>' + employeeName + '</strong>' +
            '</div>' +
            '<div class="employee-info">' +
            'الوظيفة :' + '<strong>' + jobTitle + '</strong>' +
            '</div>' +

            // Request text
            '<div class="request-text">' +
            'استنادا الى المرجع المذكور اعلاه يطلب منكم تبرير مايلي :' +
            '</div>' +
            '<div class="request-text" style="padding-right: 20px;">' +
            escapeHtml(reason) +
            '</div>' +

            // Date and director signature
            '<div class="date-line">' +
            'في : ' + formattedDate +
            '</div>' +
            '<div class="director-sign" style="margin-top: 5px;">' +
            directorTitle +
            '</div>' +

            // Response section - left side
            '<div class="response-section">' +
            '<h4>جواب المعني :</h4>' +
            '<div class="response-box"></div>' +
            '<div class="response-date">في :..................</div>' +
            '<div class="response-sign">امضاء المعني</div>' +
            '</div>' +

            // Decision section - right side
            '<div class="decision-section">' +
            '<h4>قرار ' + directorTitle + ' :</h4>' +
            '<div class="decision-box"></div>' +
            '<div class="decision-date">في :..................</div>' +
            '<div class="decision-sign">' + directorTitle + '</div>' +
            '</div>' +

            '' +
            '\n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : '') + '\n        </body></html>';

        var printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
    });
}

/**
 * Save inquiry to DB
 */
function saveInquiry() {
    if (!selectedEmployee) {
        showDialog({
            title: 'تنبيه',
            message: 'يرجى اختيار الموظف أولاً.',
            type: 'warning',
            confirmOnly: true
        });
        return;
    }

    var reason = document.getElementById('inquiryReason').value.trim();
    if (!reason) {
        showDialog({
            title: 'حقل مطلوب',
            message: 'يرجى إدخال نص التبرير المطلوب.',
            type: 'warning',
            confirmOnly: true
        }).then(function() {
            document.getElementById('inquiryReason').focus();
        });
        return;
    }

    var inquiryNumber = document.getElementById('inquiryNumber').value.trim();

    // Create record
    var record = {
        id: Date.now(),
        date: new Date().toISOString(),
        number: inquiryNumber,
        employeeId: selectedEmployee.id,
        employeeName: getEmployeeName(selectedEmployee),
        category: selectedCategory,
        categoryName: selectedCategory === 'teachers' ? 'أساتذة' : (selectedCategory === 'supervisors' ? 'مشرفين' : 'عمال'),
        reason: reason
    };

    inquiryRecords.push(record);

    DB.set('inquiryRecords', inquiryRecords).then(function() {
        showDialog({
            title: 'تم الحفظ',
            message: 'تم حفظ الاستفسار في السجل بنجاح.',
            type: 'success',
            confirmOnly: true
        });
    });
}

/**
 * Print the resume work document (بيان استئناف عمل)
 */
function printResume() {
    if (!selectedEmployee) {
        showDialog({
            title: 'تنبيه',
            message: 'يرجى اختيار الموظف أولاً.',
            type: 'warning',
            confirmOnly: true
        });
        return;
    }

    var resumeDate = document.getElementById('resumeDate').value;
    var resumeTime = document.getElementById('resumeTime').value;
    var resumeReason = document.getElementById('resumeReason').value.trim();

    if (!resumeDate || !resumeTime || !resumeReason) {
        showDialog({
            title: 'حقول مطلوبة',
            message: 'يرجى تعبئة تاريخ ووقت الاستئناف وسبب الغياب.',
            type: 'warning',
            confirmOnly: true
        });
        return;
    }

    var dateParts = resumeDate.split('-');
    var formattedResumeDate = dateParts[2] + '/' + dateParts[1] + '/' + dateParts[0];

    Promise.all([
        DB.getSettings(),
        DB.get('signatureSettings')
    ]).then(function (results) {
        var settings = results[0] || {};
        var sigSettings = results[1] || {};

        var employeeName = escapeHtml(getEmployeeName(selectedEmployee));

        var employeeRank = escapeHtml(selectedEmployee.rank || selectedEmployee.subject || '');
        if (selectedCategory === 'teachers' && selectedEmployee.subject) {
             if (!employeeRank) employeeRank = 'أستاذ(ة)';
        }

        var schoolYear = escapeHtml(settings.schoolYear || (dateParts[0] + '-' + (parseInt(dateParts[0])+1)));

        var institution = escapeHtml(settings.institutionName || '..................');
        var wilaya = escapeHtml(settings.wilaya || '..................');
        var municipality = escapeHtml(settings.municipality || '..................');

        var dob = escapeHtml(selectedEmployee.dob || selectedEmployee.birthDate || '..................');

        var today = new Date();
        var formattedTodayDate = today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate();

        var directorTitle = 'المدير(ة)';

        var printContent = '<!DOCTYPE html>' +
            '<html lang="ar" dir="rtl">' +
            '<head>' +
            '<meta charset="UTF-8">' +
            '<title>بيان استئناف العمل - ' + employeeName + '</title>' +
            '<style>' +
            '* { box-sizing: border-box; margin: 0; padding: 0; }' +
            "body { font-family: 'Traditional Arabic', 'Sakkal Majalla', 'Cairo', serif; margin: 0; padding: 1.5cm; color: #000; font-size: 18pt; line-height: 1.4; }" +
            '.header-section { text-align: center; margin-bottom: 20px; }' +
            '.header-section h2 { font-size: 20pt; font-weight: bold; margin: 0; line-height: 1.3; }' +
            '.info-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }' +
            '.info-right { text-align: right; }' +
            '.info-right h3 { font-size: 16pt; font-weight: bold; margin: 0; line-height: 1.4; }' +
            '.info-left { text-align: left; }' +
            '.info-left h3 { font-size: 16pt; font-weight: bold; margin: 0; line-height: 1.4; }' +
            '.doc-title { text-align: center; font-size: 32pt; font-weight: bold; margin: 25px 0; }' +
            '.content-section { margin-right: 20px; font-weight: bold; font-size: 18pt; }' +
            '.content-row { margin-bottom: 15px; }' +
            '.datetime-row { display: flex; align-items: center; justify-content: flex-start; gap: 40px; margin-bottom: 20px; margin-right: 20px; font-weight: bold; }' +
            '.datetime-group { display: flex; align-items: center; gap: 10px; }' +
            '.input-box { display: inline-block; padding: 2px 10px; font-weight: normal; font-family: monospace; }' +
            '.reason-section { margin-bottom: 20px; font-weight: bold; }' +
            '.reason-box { min-height: 150px; width: 100%; padding: 15px; font-weight: bold; font-size: 18pt; white-space: pre-wrap; line-height: 1.5; margin-top: 10px; }' +
            '.signatures { display: flex; justify-content: space-between; margin-top: 25px; font-weight: bold; }' +
            '.sig-right { text-align: right; margin-right: 20px; }' +
            '.sig-left { text-align: center; margin-left: 20px; }' +
            '@media print {' +
            '    @page { margin: 1cm; size: A4; }' +
            '    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0.5cm; }' +
            '}' +
            '</style>' +
            '\n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : '') + '\n        </head>' +
            '<body>\n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : '') +
            '<div class="header-section">' +
            '<h2>الجمهورية الجزائرية الديمقراطية الشعبية</h2>' +
            '<h2>وزارة التربية الوطنية</h2>' +
            '</div>' +
            '<div class="info-row">' +
            '<div class="info-right">' +
            '<h3>مديرية التربية لولاية ' + wilaya + '</h3>' +
            '<h3>المؤسسة: ' + institution + '</h3>' +
            '</div>' +
            '<div class="info-left">' +
            '<h3>السنة الدراسية: ' + window.formatAcademicYear(schoolYear) + '</h3>' +
            '<h3>بلدية: ' + municipality + '</h3>' +
            '</div>' +
            '</div>' +
            '<div class="doc-title">بيان استئناف العمل</div>' +
            '<div class="content-section">' +
            '<div class="content-row">يشهد مدير(ة) المؤسسة ان السيد(ة)</div>' +
            '<div class="content-row">الاسم و اللقب :  <span style="font-weight: normal;">' + employeeName + '</span></div>' +
            '<div class="content-row">تاريخ الميلاد:  <span style="font-weight: normal;">' + dob + '</span></div>' +
            '<div class="content-row">الاطار :  <span style="font-weight: normal;">' + employeeRank + '</span></div>' +
            '<div class="content-row" style="margin-bottom: 30px;">استأنف (ت) عمله (ها)</div>' +
            '</div>' +
            '<div class="datetime-row">' +
            '<div class="datetime-group">' +
            '<span>بتاريخ :</span>' +
            '<span class="input-box">' + formattedResumeDate + '</span>' +
            '</div>' +
            '<div class="datetime-group">' +
            '<span>على الساعة :</span>' +
            '<span class="input-box">' + resumeTime + '</span>' +
            '</div>' +
            '</div>' +
            '<div class="reason-section">' +
            '<div>و ذلك بعد :</div>' +
            '<div class="reason-box">' + escapeHtml(resumeReason) + '</div>' +
            '</div>' +
            '<div class="signatures">' +
            '<div class="sig-right">' +
            '<div>توقيع المعني</div>' +
            '</div>' +
            '<div class="sig-left">' +
            '<div style="margin-bottom: 20px;">التاريخ: ' + formattedTodayDate + '</div>' +
            '<div>' + directorTitle + '</div>' +
            '</div>' +
            '</div>' +
            '' +
            '\n            '+(window.PrintToolbarHelper?window.PrintToolbarHelper.getScriptHtml({advanced:false}):'')+'\n        </body></html>';

        var printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
    });
}

/**
 * Show statistics modal and render data
 */
function showStatistics() {
    var totalCountEl = document.getElementById('totalInquiriesCount');
    var tableBody = document.getElementById('statsTableBody');

    totalCountEl.textContent = inquiryRecords.length;
    tableBody.innerHTML = '';

    if (inquiryRecords.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted p-4">لا توجد سجلات محفوظة حالياً.</td></tr>';
    } else {
        // Sort by date descending
        var sorted = inquiryRecords.slice().sort(function(a, b) {
            return new Date(b.date) - new Date(a.date);
        });

        for (var i = 0; i < sorted.length; i++) {
            var rec = sorted[i];
            var dateObj = new Date(rec.date);
            var dateStr = dateObj.toLocaleDateString('ar-DZ');

            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' + dateStr + '</td>' +
                '<td>' + escapeHtml(rec.number || '-') + '</td>' +
                '<td><strong>' + escapeHtml(rec.employeeName) + '</strong></td>' +
                '<td><span class="badge bg-light text-dark">' + rec.categoryName + '</span></td>' +
                '<td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="' + escapeHtml(rec.reason) + '">' + escapeHtml(rec.reason) + '</td>' +
                '<td class="text-center">' +
                    '<button class="btn btn-sm btn-outline-danger" onclick="deleteInquiry(' + rec.id + ')"><i class="fas fa-trash"></i></button>' +
                '</td>';
            tableBody.appendChild(tr);
        }
    }

    var modalEl = document.getElementById('statsModal');
    var modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Delete a single inquiry record
 */
function deleteInquiry(id) {
    showDialog({
        title: 'تأكيد الحذف',
        message: 'هل أنت متأكد من حذف هذا السجل؟',
        type: 'warning',
        confirmText: 'حذف'
    }).then(function(confirmed) {
        if (!confirmed) return;

        inquiryRecords = inquiryRecords.filter(function(r) { return r.id !== id; });

        DB.set('inquiryRecords', inquiryRecords).then(function() {
            showStatistics(); // Refresh table
        });
    });
}

/**
 * Clear all inquiry records
 */
function clearAllInquiries() {
    showDialog({
        title: 'تأكيد المسح الشامل',
        message: 'هل أنت متأكد من مسح جميع السجلات؟ لا يمكن التراجع عن هذه الخطوة.',
        type: 'error',
        confirmText: 'مسح الكل'
    }).then(function(confirmed) {
        if (!confirmed) return;

        inquiryRecords = [];
        DB.set('inquiryRecords', inquiryRecords).then(function() {
            showStatistics(); // Refresh table
        });
    });
}

/**
 * Show a premium dialog instead of standard alert/confirm
 * options: { title, message, type: 'info'|'success'|'warning'|'error', confirmOnly, confirmText }
 */
function showDialog(options) {
    return new Promise(function(resolve) {
        var modalEl = document.getElementById('dialogModal');
        var iconEl = document.getElementById('dialogIcon');
        var titleEl = document.getElementById('dialogTitle');
        var msgEl = document.getElementById('dialogMessage');
        var confirmBtn = document.getElementById('dialogConfirmBtn');
        var cancelBtn = document.getElementById('dialogCancelBtn');

        titleEl.textContent = options.title || 'تنبيه';
        msgEl.textContent = options.message || '';

        // Icon
        iconEl.className = 'dialog-icon ' + (options.type || 'info');
        var iconHtml = '<i class="fas fa-info-circle"></i>';
        if (options.type === 'success') iconHtml = '<i class="fas fa-check-circle"></i>';
        else if (options.type === 'warning') iconHtml = '<i class="fas fa-exclamation-triangle"></i>';
        else if (options.type === 'error') iconHtml = '<i class="fas fa-times-circle"></i>';
        iconEl.innerHTML = iconHtml;

        // Buttons
        cancelBtn.style.display = options.confirmOnly ? 'none' : 'inline-flex';
        confirmBtn.textContent = options.confirmText || 'موافق';

        if (options.type === 'error') {
            confirmBtn.className = 'btn btn-danger';
        } else if (options.type === 'success') {
            confirmBtn.className = 'btn btn-success';
        } else {
            confirmBtn.className = 'btn btn-purple';
        }

        var modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

        var resolved = false;

        confirmBtn.onclick = function() {
            resolved = true;
            modal.hide();
            resolve(true);
        };

        modalEl.addEventListener('hidden.bs.modal', function handler() {
            modalEl.removeEventListener('hidden.bs.modal', handler);
            if (!resolved) resolve(false);
        }, { once: true });

        modal.show();
    });
}
/**
 * Save resume work record
 */
function saveResumeWork() {
    if (!selectedEmployee) {
        showDialog({
            title: 'خطأ',
            message: 'يرجى اختيار موظف أولاً.',
            type: 'error',
            confirmOnly: true
        });
        return;
    }

    var resumeDate = document.getElementById('resumeDate').value;
    var resumeTime = document.getElementById('resumeTime').value;
    var resumeReason = document.getElementById('resumeReason').value.trim();

    if (!resumeDate || !resumeTime || !resumeReason) {
        showDialog({
            title: 'حقول مطلوبة',
            message: 'يرجى تعبئة تاريخ ووقت الاستئناف وسبب الغياب.',
            type: 'warning',
            confirmOnly: true
        });
        return;
    }

    var record = {
        id: 'resume_' + Date.now(),
        timestamp: new Date().toLocaleString(),
        employeeId: selectedEmployee.id,
        employeeName: getEmployeeName(selectedEmployee),
        employeeCategory: selectedCategory,
        resumeDate: resumeDate,
        resumeTime: resumeTime,
        resumeReason: resumeReason
    };

    resumeRecords.unshift(record);
    DB.set('resumeRecords', resumeRecords).then(function () {
        showDialog({
            title: 'تم الحفظ',
            message: 'تم حفظ سجل استئناف العمل بنجاح.',
            type: 'success',
            confirmOnly: true
        });
    });
}

/**
 * Show resume work history statistis
 */
function showResumeStatistics() {
    document.getElementById('totalResumesCount').textContent = resumeRecords.length;
    renderResumeTable();
    var modalEl = document.getElementById('resumeStatsModal');
    var modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Render the resume history table
 */
function renderResumeTable() {
    var tbody = document.getElementById('resumeStatsTableBody');
    tbody.innerHTML = '';

    if (resumeRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">لا توجد سجلات محفوظة حالياً.</td></tr>';
        return;
    }

    resumeRecords.forEach(function (rec) {
        var tr = document.createElement('tr');

        var dateParts = rec.resumeDate.split('-');
        var fmtDate = dateParts[2] + '/' + dateParts[1] + '/' + dateParts[0];

        tr.innerHTML =
            '<td>' + rec.timestamp + '</td>' +
            '<td class="fw-bold">' + rec.employeeName + '</td>' +
            '<td>' + fmtDate + ' ' + rec.resumeTime + '</td>' +
            '<td class="text-truncate" style="max-width: 250px;">' + rec.resumeReason + '</td>' +
            '<td class="text-center">' +
                '<div class="btn-group">' +
                    '<button class="btn btn-sm btn-purple" onclick="printSavedResume(\'' + rec.id + '\')" title="طباعة">' +
                        '<i class="fas fa-print"></i>' +
                    '</button>' +
                    '<button class="btn btn-sm btn-light text-danger" onclick="deleteResumeRecord(\'' + rec.id + '\')" title="حذف">' +
                        '<i class="fas fa-trash-alt"></i>' +
                    '</button>' +
                '</div>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

/**
 * Delete a specific resume record
 */
function deleteResumeRecord(id) {
    showDialog({
        title: 'تأكيد الحذف',
        message: 'هل أنت متأكد من رغبتك في حذف هذا السجل؟',
        type: 'warning',
        confirmText: 'حذف'
    }).then(function(confirmed) {
        if (!confirmed) return;
        resumeRecords = resumeRecords.filter(function (r) { return r.id !== id; });
        DB.set('resumeRecords', resumeRecords).then(function () {
            document.getElementById('totalResumesCount').textContent = resumeRecords.length;
            renderResumeTable();
        });
    });
}

/**
 * Clear all resume records
 */
function clearAllResumes() {
    showDialog({
        title: 'تنبيه مسح السجل',
        message: 'هل أنت متأكد من مسح كافة سجلات استئناف العمل؟ لا يمكن التراجع عن هذا الإجراء.',
        type: 'error',
        confirmText: 'مسح الكل'
    }).then(function(confirmed) {
        if (!confirmed) return;
        resumeRecords = [];
        DB.set('resumeRecords', []).then(function () {
            document.getElementById('totalResumesCount').textContent = '0';
            renderResumeTable();
        });
    });
}

/**
 * Print a saved resume work document
 */
function printSavedResume(id) {
    var record = null;
    for (var i = 0; i < resumeRecords.length; i++) {
        if (resumeRecords[i].id === id) {
            record = resumeRecords[i];
            break;
        }
    }
    if (!record) return;

    // We need the full employee object to get all fields like dob
    var emp = null;
    if (record.employeeCategory === 'teachers') {
        for (var i = 0; i < allTeachers.length; i++) {
            if (allTeachers[i].id === record.employeeId) {
                emp = allTeachers[i];
                break;
            }
        }
    }
    else if (record.employeeCategory === 'supervisors') {
        for (var i = 0; i < allSupervisors.length; i++) {
            if (allSupervisors[i].id === record.employeeId) {
                emp = allSupervisors[i];
                break;
            }
        }
    }
    else if (record.employeeCategory === 'workers') {
        for (var i = 0; i < allWorkers.length; i++) {
            if (allWorkers[i].id === record.employeeId) {
                emp = allWorkers[i];
                break;
            }
        }
    }

    // If employee object is missing, build a minimal one from the record
    if (!emp) {
        emp = {
            id: record.employeeId,
            name: record.employeeName,
            rank: '',
            dob: ''
        };
    }

    // Set temporary values to the form inputs for printResume to pick them up
    // Then call printResume but we need to pass the employee directly or set selectedEmployee
    var oldEmp = selectedEmployee;
    var oldCat = selectedCategory;

    selectedEmployee = emp;
    selectedCategory = record.employeeCategory;

    // Set form fields
    document.getElementById('resumeDate').value = record.resumeDate;
    document.getElementById('resumeTime').value = record.resumeTime;
    document.getElementById('resumeReason').value = record.resumeReason;

    printResume();

    // Restore state
    selectedEmployee = oldEmp;
    selectedCategory = oldCat;
}

/**
 * Save deduction record
 */
function saveDeduction() {
    if (!selectedEmployee) {
        showDialog({ title: 'خطأ', message: 'يرجى اختيار موظف أولاً.', type: 'error', confirmOnly: true });
        return;
    }

    var absenceDate = document.getElementById('deductionAbsenceDate').value;

    if (!absenceDate) {
        showDialog({ title: 'حقول مطلوبة', message: 'يرجى تعبئة تاريخ أو فترة الغياب.', type: 'warning', confirmOnly: true });
        return;
    }

    var record = {
        id: 'deduct_' + Date.now(),
        timestamp: new Date().toLocaleString(),
        employeeId: selectedEmployee.id,
        employeeName: getEmployeeName(selectedEmployee),
        employeeCategory: selectedCategory,
        absenceDate: absenceDate
    };

    deductionRecords.unshift(record);
    DB.set('deductionRecords', deductionRecords).then(function () {
        showDialog({ title: 'تم الحفظ', message: 'تم حفظ إشعار الخصم بنجاح.', type: 'success', confirmOnly: true });
    });
}

/**
 * Show deduction history
 */
function showDeductionStatistics() {
    document.getElementById('totalDeductionsCount').textContent = deductionRecords.length;
    renderDeductionTable();
    var modalEl = document.getElementById('deductionStatsModal');
    var modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Render deduction table
 */
function renderDeductionTable() {
    var tbody = document.getElementById('deductionTableBody');
    tbody.innerHTML = '';

    if (deductionRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">لا توجد سجلات محفوظة حالياً.</td></tr>';
        return;
    }

    deductionRecords.forEach(function (rec) {
        var tr = document.createElement('tr');
        var fmtDate = rec.absenceDate || '-';

        tr.innerHTML =
            '<td>' + rec.timestamp + '</td>' +
            '<td class="fw-bold">' + rec.employeeName + '</td>' +
            '<td>' + fmtDate + '</td>' +
            '<td class="text-center">' +
                '<div class="btn-group">' +
                    '<button class="btn btn-sm btn-purple" onclick="printSavedDeduction(\'' + rec.id + '\')" title="طباعة">' +
                        '<i class="fas fa-print"></i>' +
                    '</button>' +
                    '<button class="btn btn-sm btn-light text-danger" onclick="deleteDeductionRecord(\'' + rec.id + '\')" title="حذف">' +
                        '<i class="fas fa-trash-alt"></i>' +
                    '</button>' +
                '</div>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

/**
 * Delete deduction record
 */
function deleteDeductionRecord(id) {
    showDialog({
        title: 'تأكيد الحذف',
        message: 'هل أنت متأكد من حذف هذا الإشعار؟',
        type: 'warning',
        confirmText: 'حذف'
    }).then(function(confirmed) {
        if (!confirmed) return;
        deductionRecords = deductionRecords.filter(function (r) { return r.id !== id; });
        DB.set('deductionRecords', deductionRecords).then(function () {
            document.getElementById('totalDeductionsCount').textContent = deductionRecords.length;
            renderDeductionTable();
        });
    });
}

/**
 * Clear all deductions
 */
function clearAllDeductions() {
    showDialog({
        title: 'تنبيه مسح السجل',
        message: 'هل أنت متأكد من مسح كافة الإشعارات بالخصم؟ لا يمكن التراجع عن هذا الإجراء.',
        type: 'error',
        confirmText: 'مسح الكل'
    }).then(function(confirmed) {
        if (!confirmed) return;
        deductionRecords = [];
        DB.set('deductionRecords', []).then(function () {
            document.getElementById('totalDeductionsCount').textContent = '0';
            renderDeductionTable();
        });
    });
}

/**
 * Print saved deduction
 */
function printSavedDeduction(id) {
    var rec = null;
    for (var i = 0; i < deductionRecords.length; i++) {
        if (deductionRecords[i].id === id) {
            rec = deductionRecords[i];
            break;
        }
    }
    if (!rec) return;

    var emp = null;
    if (rec.employeeCategory === 'teachers') {
        for (var i = 0; i < allTeachers.length; i++) {
            if (allTeachers[i].id === rec.employeeId) {
                emp = allTeachers[i];
                break;
            }
        }
    }
    else if (rec.employeeCategory === 'supervisors') {
        for (var i = 0; i < allSupervisors.length; i++) {
            if (allSupervisors[i].id === rec.employeeId) {
                emp = allSupervisors[i];
                break;
            }
        }
    }
    else if (rec.employeeCategory === 'workers') {
        for (var i = 0; i < allWorkers.length; i++) {
            if (allWorkers[i].id === rec.employeeId) {
                emp = allWorkers[i];
                break;
            }
        }
    }

    if (!emp) {
        emp = { id: rec.employeeId, name: rec.employeeName, rank: '' };
    }

    var oldEmp = selectedEmployee;
    var oldCat = selectedCategory;
    selectedEmployee = emp;
    selectedCategory = rec.employeeCategory;

    document.getElementById('deductionAbsenceDate').value = rec.absenceDate;

    printDeduction();

    selectedEmployee = oldEmp;
    selectedCategory = oldCat;
}

/**
 * Print Deduction Notice
 */
function printDeduction() {
    if (!selectedEmployee) {
        showDialog({ title: 'خطأ', message: 'يرجى اختيار موظف أولاً.', type: 'error', confirmOnly: true });
        return;
    }

    var absenceDate = document.getElementById('deductionAbsenceDate').value.trim();

    if (!absenceDate) {
        showDialog({ title: 'تنبيه', message: 'يرجى ملء تاريخ أو فترة الغياب للطباعة.', type: 'warning', confirmOnly: true });
        return;
    }

    var formattedAbsenceDate = absenceDate;
    var today = new Date();
    var formattedToday = today.getDate().toString().padStart(2, '0') + '/' + (today.getMonth() + 1).toString().padStart(2, '0') + '/' + today.getFullYear();

    DB.getSettings().then(function(settings) {
        var wilaya = settings.wilaya || 'خنشلة';
        var institution = settings.institutionName || '....................';
        var schoolYear = settings.schoolYear || '2021/2022';
        var municipality = settings.municipality || 'الحامة';
        var directorTitle = docSettings.directorSign || 'المدير';

        // Get rank from selectedEmployee
        var rank = selectedEmployee.rank || '';
        if (!rank) {
            for (var i = 0; i < allSupervisors.length; i++) {
                if (allSupervisors[i].id === selectedEmployee.id) {
                    rank = allSupervisors[i].rank || '';
                    break;
                }
            }
        }
        var lastName = selectedEmployee.last_name || (selectedEmployee.name ? selectedEmployee.name.split(' ')[0] : '') || '';
        var firstName = selectedEmployee.first_name || (selectedEmployee.name ? selectedEmployee.name.split(' ').slice(1).join(' ') : '') || '';

        var singleCopy =
            '<div class="report-copy">' +
            '<div class="header-section">' +
            '<h2>الجمهورية الجزائرية الديمقراطية الشعبية</h2>' +
            '<h2>وزارة التربية الوطنية</h2>' +
            '</div>' +
            '<div class="info-row">' +
            '<div class="info-right">' +
            '<h3>مديرية التربية لولاية ' + wilaya + '</h3>' +
            '<h3>المؤسسة: ' + institution + '</h3>' +
            '</div>' +
            '<div class="info-left">' +
            '<h3>السنة الدراسية: ' + window.formatAcademicYear(schoolYear) + '</h3>' +
            '<h3>بلدية: ' + municipality + '</h3>' +
            '</div>' +
            '</div>' +
            '<div class="doc-title">اشعار بالخصم</div>' +
            '<div class="employee-info">' +
            '<div>اللقب : <span>' + lastName + '</span></div>' +
            '<div>الأسم : <span>' + firstName + '</span></div>' +
            '<div>الوظيفة : <span>' + rank + '</span></div>' +
            '</div>' +
            '<div class="legal-section">' +
            '<div class="legal-title">المراجع القانونية :</div>' +
            '<div class="legal-ref">القرار الوزاري رقم 65 المؤرخ في 18 جويلية 2018 المحدد لكيفيات تنظيم الجماعة التربوية :</div>' +
            '<div class="legal-ref">الفصل الرابع : أحكام خاصة بالموظفين</div>' +
            '<div class="legal-article"><span>المادة 82 :</span> لا يمكن لموظف أن يتقاضى أجرا عن فترة عمل غير مؤداة بإستثناء حالات</div>' +
            '<div style="font-weight: bold; font-size: 12pt;">الغياب المنصوص عليها في التشريع والتنظيم المعمول بهما .</div>' +
            '<div class="deduction-text">بناءا على القرار السابق ذكره تم خصم غيابكم ليوم / فترة :</div>' +
            '<div class="absence-date">' + formattedAbsenceDate + '</div>' +
            '</div>' +
            '<div class="footer-section">' +
            '<div class="footer-right">' +
            '<div class="distribution">' +
            '<div>التوزيع :</div>' +
            '<ul><li>نسخة للمعني.</li><li>نسخة للملف.</li></ul>' +
            '</div>' +
            '</div>' +
            '<div class="footer-left">' +
            '<div style="margin-bottom: 10px;">' + municipality + ' في : ' + formattedToday + '</div>' +
            '<div style="margin-right: 20px;">' + directorTitle + '</div>' +
            '</div>' +
            '</div>' +
            '</div>';

        var printContent =
            '<!DOCTYPE html><html lang="ar" dir="rtl"><head><title>إشعار بالخصم</title>' +
            '<style>' +
            '* { box-sizing: border-box; margin: 0; padding: 0; }' +
            "body { font-family: 'Traditional Arabic', 'Sakkal Majalla', 'Cairo', serif; margin: 0; padding: 0; color: #000; }" +
            '.print-page { display: flex; width: 297mm; height: 210mm; padding: 10mm; gap: 15mm; }' +
            '.report-copy { flex: 1; border: 1px dashed #eee; padding: 5mm; height: 100%; position: relative; overflow: hidden; }' +
            '.header-section { text-align: center; margin-bottom: 15px; }' +
            '.header-section h2 { font-size: 13pt; font-weight: bold; margin: 0; line-height: 1.2; }' +
            '.info-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }' +
            '.info-right { text-align: right; }' +
            '.info-right h3 { font-size: 11pt; font-weight: bold; margin: 0; line-height: 1.3; }' +
            '.info-left { text-align: left; }' +
            '.info-left h3 { font-size: 11pt; font-weight: bold; margin: 0; line-height: 1.3; }' +
            '.doc-title { text-align: center; font-size: 20pt; font-weight: bold; margin: 15px 0; border-bottom: 2px solid #000; padding-bottom: 5px; }' +
            '.employee-info { margin-right: 10px; font-size: 13pt; font-weight: bold; margin-bottom: 15px; }' +
            '.employee-info div { margin-bottom: 5px; }' +
            '.employee-info span { font-weight: normal; margin-right: 10px; }' +
            '.legal-section { margin: 15px 10px; }' +
            '.legal-title { font-weight: bold; text-decoration: underline; font-size: 12pt; margin-bottom: 8px; }' +
            '.legal-ref { font-weight: bold; font-size: 10pt; margin-bottom: 3px; border-bottom: 1px solid #000; display: inline-block; }' +
            '.legal-article { font-weight: bold; font-size: 11pt; margin: 8px 0; }' +
            '.legal-article span { text-decoration: underline; }' +
            '.deduction-text { margin-top: 15px; font-weight: bold; font-size: 12pt; }' +
            '.absence-date { display: block; text-align: center; font-size: 13pt; margin-top: 10px; font-family: monospace; font-weight: bold; }' +
            '.footer-section { margin-top: 25px; display: flex; justify-content: space-between; align-items: flex-start; }' +
            '.footer-right { flex: 1; text-align: right; }' +
            '.footer-left { flex: 1; text-align: right; margin-left: 10px; font-weight: bold; }' +
            '.distribution { text-align: right; font-weight: bold; font-size: 12pt; margin-bottom: 10px; }' +
            '.distribution div { text-decoration: underline; margin-bottom: 3px; }' +
            '.distribution ul { list-style: none; padding: 0; margin: 0; }' +
            '@media print { ' +
            '    @page { margin: 0; size: A4 landscape; } ' +
            '    body { width: 297mm; height: 210mm; }' +
            '}' +
            '</style>' +
            '\n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : '') + '\n        </head><body>\n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : '') +
            '<div class="print-page">' +
            singleCopy +
            singleCopy +
            '</div>' +
            '' +
            '\n            '+(window.PrintToolbarHelper?window.PrintToolbarHelper.getScriptHtml({advanced:false}):'')+'\n        </body></html>';

        var printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
    });
}
