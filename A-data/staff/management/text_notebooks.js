/**
 * Text Notebooks Monitoring - متابعة دفاتر النصوص
 * Handles observation records for teacher text notebooks
 */

// ==================== GLOBAL VARIABLES ====================
var notebooksList = [];
var selectedNotebooks = new Set();
var teachersList = [];
var teacherAssignments = {};
var institutionSettings = {};
var allSchoolClasses = [];
var classStreamMap = {};

// Stream abbreviations
var STREAM_ABBR = {
    'common_science': 'ج م ع',
    'common_arts': 'ج م أ',
    'science': 'ع ت',
    'math': 'رياضي',
    'tech_math': 'تق',
    'tech_math_civil': 'تق.م',
    'tech_math_elec': 'تق.ك',
    'tech_math_methods': 'تق.ط',
    'tech_math_mech': 'تق.مي',
    'management': 'تسيير',
    'languages': 'لغ',
    'arts': 'آداب'
};

var LEVEL_NAMES = {
    '1': 'أولى ثانوي',
    '2': 'ثانية ثانوي',
    '3': 'ثالثة ثانوي'
};

var STREAM_FULL_NAMES = {
    'common_science': 'جذع مشترك علوم وتكنولوجيا',
    'common_arts': 'جذع مشترك آداب',
    'science': 'علوم تجريبية',
    'math': 'رياضيات',
    'tech_math': 'تقني رياضي',
    'management': 'تسيير واقتصاد',
    'languages': 'لغات أجنبية',
    'arts': 'آداب وفلسفة'
};

var STREAMS_BY_LEVEL = {
    '1': ['common_science', 'common_arts'],
    '2': ['science', 'math', 'tech_math', 'management', 'languages', 'arts'],
    '3': ['science', 'math', 'tech_math', 'management', 'languages', 'arts']
};

var TECH_MATH_STREAMS = ['tech_math', 'tech_math_civil', 'tech_math_elec', 'tech_math_methods', 'tech_math_mech'];

var STREAM_ALIASES = {
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
    'letters': 'آداب وفلسفة',
    'maths': 'رياضيات',
    'foreign_languages': 'لغات أجنبية',
    'common_letters': 'جذع مشترك آداب',
    'tech_elm': 'تقني رياضي (هندسة كهربائية)',
    'tech_civ': 'تقني رياضي (هندسة مدنية)',
    'tech_mec': 'تقني رياضي (هندسة ميكانيكية)',
    'tech_pro': 'تقني رياضي (هندسة الطرائق)',
    'tm': 'tech_math',
    'ge': 'tech_math_elec',
    'gc': 'tech_math_civil',
    'gm': 'tech_math_mech',
    'gp': 'tech_math_methods',
    'تقني رياضي هندسة مدنية': 'tech_math_civil',
    'تقني رياضي هندسة ميكانيكية': 'tech_math_mech',
    'تقني رياضي هندسة كهربائية': 'tech_math_elec',
    'تقني رياضي هندسة الطرائق': 'tech_math_methods'
};

var STREAM_NAME_TO_CODE = {};
Object.keys(STREAM_FULL_NAMES).forEach(function(code) {
    STREAM_NAME_TO_CODE[STREAM_FULL_NAMES[code]] = code;
});
Object.keys(STREAM_ABBR).forEach(function(code) {
     STREAM_NAME_TO_CODE[STREAM_ABBR[code]] = code;
});
Object.keys(STREAM_ALIASES).forEach(function(code) {
    var val = STREAM_ALIASES[code];
    if (/[\u0600-\u06FF]/.test(val)) {
        STREAM_NAME_TO_CODE[val] = code;
    }
});

function normalizeStream(input) {
    if (!input) return '';
    var s = input.trim();
    if (STREAM_FULL_NAMES[s] || STREAM_ABBR[s] || TECH_MATH_STREAMS.indexOf(s) !== -1) return s;
    if (STREAM_ALIASES[s]) {
        var val = STREAM_ALIASES[s];
        if (!/[\u0600-\u06FF]/.test(val)) return val;
        s = val;
    }
    return STREAM_NAME_TO_CODE[s] || s;
}

var DEFAULT_OBSERVATION_TYPES = [
    { key: 'noLessons', label: 'عدم تسجيل الدروس إطلاقًا', hasDate: false },
    { key: 'noHomework', label: 'عدم إعطاء واجبات منزلية أو قلتها', hasDate: false },
    { key: 'noCorrections', label: 'عدم تصحيح الفروض والواجبات', hasDate: false },
    { key: 'lessonsCutoff', label: 'انقطاع تسجيل الدروس ابتداءً من تاريخ', hasDate: true },
    { key: 'noLessonDates', label: 'عدم كتابة تاريخ تقديم الدروس', hasDate: false },
    { key: 'noYearlyPlan', label: 'عدم احترام التوزيع السنوي المقرر', hasDate: false }
];

var observationTypes = [];

function getObservationLabels() {
    var labels = {};
    observationTypes.forEach(function(t) { labels[t.key] = t.label; });
    return labels;
}

var STATUS_CONFIG = {
    violation: { label: '❌ مخالفة', cssClass: 'badge-violation' },
    warning: { label: '⚠️ ملاحظة', cssClass: 'badge-warning' },
    resolved: { label: '✅ تمت المعالجة', cssClass: 'badge-resolved' }
};

var FOLLOWUP_LABELS = {
    corrective: '📝 إجراء تصحيحي',
    warning: '⚠️ تنبيه',
    resolved: '✅ تسوية الوضع'
};

var REPORT_TEXT_KEY = 'report_text_notebooks';
var DEFAULT_REPORT_TEXT = 'من خلال مراقبتنا لدفتر النصوص الخاص بكم للقسم: {CLASS} بتاريخ: {DATE}، سجلنا الملاحظات التالية:';

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function () {
    loadData().then(function() {
        var isSecondary = (institutionSettings.educationStage === 'secondary');
        if (isSecondary) {
            document.getElementById('inputLevelGroup').style.display = 'block';
            document.getElementById('inputStreamGroup').style.display = 'block';
            var emptyStateTd = document.querySelector('.empty-state');
            if (emptyStateTd) emptyStateTd.setAttribute('colspan', '9');
        }
        populateTeacherDropdown();
        populateFilterDropdowns();
        if (isSecondary) populateStreamDropdown();
        updateStats();
        renderNotebooksTable();
    });
});

async function loadData() {
    try {
        institutionSettings = await DB.getSettings() || {};
        teachersList = await DB.getTeachers() || [];
        teacherAssignments = await DB.get('teacherAssignments') || {};
        notebooksList = await DB.get('notebooksList') || [];
        var savedObs = await DB.get('observationTypes');
        observationTypes = (savedObs && savedObs.length > 0) ? savedObs : JSON.parse(JSON.stringify(DEFAULT_OBSERVATION_TYPES));
        var students = await DB.getStudents() || [];
        extractAllClasses(students);
    } catch (error) { console.error('Error loading data:', error); }
}

function extractLevelFromClass(className) {
    if (!className) return null;
    var match = String(className).match(/(\d)/);
    return match ? match[1] : null;
}

function extractAllClasses(students) {
    var classSet = {};
    var isSecondary = institutionSettings.educationStage === 'secondary';
    students.forEach(function(student) {
        if (student.level && student.class) {
            var levelNum = extractLevelFromClass(student.level) || extractLevelFromClass(student.class);
            if (levelNum) {
                var className = student.class;
                classSet[className] = true;
                if (isSecondary && student.stream) {
                    if (!classStreamMap[className]) classStreamMap[className] = new Set();
                    var norm = normalizeStream(student.stream);
                    if (norm) classStreamMap[className].add(norm);
                }
            }
        }
    });

    Object.keys(teacherAssignments).forEach(function(tid) {
        var days = teacherAssignments[tid];
        Object.keys(days).forEach(function(did) {
            var periods = days[did];
            Object.keys(periods).forEach(function(pid) {
                var a = periods[pid];
                if (a && a.class && a.class !== 'استدراك' && a.class !== 'استقبال') {
                    classSet[a.class] = true;
                    if (isSecondary && a.stream) {
                        var norm = normalizeStream(a.stream);
                        if (norm) {
                            if (!classStreamMap[a.class]) classStreamMap[a.class] = new Set();
                            classStreamMap[a.class].add(norm);
                        }
                    }
                }
            });
        });
    });

    allSchoolClasses = Object.keys(classSet).sort(function(a, b) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

function getCurrentUser() {
    if (typeof Auth !== 'undefined' && Auth.getUser) {
        var user = Auth.getUser();
        if (user) return user.managerName || user.email || 'مستخدم';
    }
    return 'مستخدم';
}

function formatDate(isoString) {
    if (!isoString) return '';
    var date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('fr-FR');
}

function formatDateTime(isoString) {
    if (!isoString) return '';
    var date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString('fr-FR');
}

// ==================== DROPDOWNS ====================
function populateTeacherDropdown() {
    var inputSelect = document.getElementById('inputTeacher');
    var filterSelect = document.getElementById('filterTeacher');
    var sorted = teachersList.slice().sort(function(a, b) {
        var na = (a.last_name || '') + ' ' + (a.first_name || '');
        var nb = (b.last_name || '') + ' ' + (b.first_name || '');
        return na.localeCompare(nb, 'ar');
    });

    if (inputSelect) {
        inputSelect.innerHTML = '<option value="">-- اختر الأستاذ --</option>';
        sorted.forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = (t.last_name || '') + ' ' + (t.first_name || '') + (t.subject ? ' - ' + t.subject : '');
            inputSelect.appendChild(opt);
        });
    }

    if (filterSelect) {
        var currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">-- كل الأساتذة --</option>';
        sorted.forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = (t.last_name || '') + ' ' + (t.first_name || '');
            filterSelect.appendChild(opt);
        });
        filterSelect.value = currentVal;
    }
}

function populateFilterDropdowns() {}

function populateStreamDropdown() {
    var streamSelect = document.getElementById('inputStream');
    if (!streamSelect) return;
    var streams = Object.keys(STREAM_ABBR);
    streamSelect.innerHTML = '<option value="">-- كل الشعب --</option>';
    streams.sort().forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = STREAM_ABBR[s] || s;
        streamSelect.appendChild(opt);
    });
}

function formatClassWithStream(className, stream) {
    if (!className) return '';
    var isSecondary = (institutionSettings.educationStage === 'secondary');
    if (isSecondary) {
        var level = extractLevelFromClass(className);
        if (level) {
            var levelName = LEVEL_NAMES[level] || (level + ' ثانوي');
            var streamDisplay = STREAM_FULL_NAMES[stream] || STREAM_ABBR[stream] || stream || '';
            return levelName + (streamDisplay ? ' - ' + streamDisplay : '') + ' - ' + className;
        }
    }
    return className + (stream ? ' (' + (STREAM_ABBR[stream] || stream) + ')' : '');
}

// ==================== MODALS ====================
function openModal(id) {
    const modalEl = document.getElementById(id);
    if (!modalEl) return;

    // Use custom styled modal logic
    modalEl.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Animation restart
    const content = modalEl.querySelector('.modal-content');
    if (content) {
        content.style.animation = 'none';
        content.offsetHeight; // trigger reflow
        content.style.animation = '';
    }
}

function closeModal(id) {
    const modalEl = document.getElementById(id);
    if (!modalEl) return;

    modalEl.style.display = 'none';
    document.body.style.overflow = '';
}

function onTeacherChange() {
    var teacherId = document.getElementById('inputTeacher').value;
    var container = document.getElementById('classSelectionContainer');
    var subjectInput = document.getElementById('inputSubject');
    var isEdit = document.getElementById('editNotebookId').value !== '';

    container.innerHTML = '';
    subjectInput.value = '';

    if (!teacherId) {
        container.innerHTML = '<div style="color:#999; text-align:center; padding:10px;">الرجاء اختيار الأستاذ أولاً</div>';
        return;
    }

    var teacher = teachersList.filter(function(t) { return String(t.id) === String(teacherId); })[0];
    if (teacher) subjectInput.value = teacher.subject || '';

    if (institutionSettings.educationStage === 'secondary') {
        populateLevelDropdown(teacherId);
        container.innerHTML = '<div style="color:#999; text-align:center; padding:10px;">الرجاء اختيار المستوى والشعبة أولاً</div>';
    } else {
        renderMiddleSchoolClasses(teacherId, isEdit);
    }
}

function populateLevelDropdown(teacherId) {
    var levelSelect = document.getElementById('inputLevel');
    if (!levelSelect) return;
    levelSelect.innerHTML = '<option value="">-- اختر المستوى --</option>';
    ['1', '2', '3'].forEach(function(l) {
        var opt = document.createElement('option');
        opt.value = l;
        opt.textContent = LEVEL_NAMES[l];
        levelSelect.appendChild(opt);
    });
}

function onLevelChange() {
    var level = document.getElementById('inputLevel').value;
    var streamSelect = document.getElementById('inputStreamModal');
    streamSelect.innerHTML = '<option value="">-- اختر الشعبة --</option>';
    if (!level) return;
    var streams = STREAMS_BY_LEVEL[level] || [];
    streams.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = STREAM_FULL_NAMES[s] || s;
        streamSelect.appendChild(opt);
    });
}

function onModalStreamChange() {
    var teacherId = document.getElementById('inputTeacher').value;
    var level = document.getElementById('inputLevel').value;
    var stream = document.getElementById('inputStreamModal').value;
    var container = document.getElementById('classSelectionContainer');
    var isEdit = document.getElementById('editNotebookId').value !== '';

    container.innerHTML = '';
    if (!level || !stream) return;

    var classes = allSchoolClasses.filter(function(cls) {
        if (extractLevelFromClass(cls) !== level) return false;
        if (!classStreamMap[cls]) return true; // Show if no stream data
        var streams = classStreamMap[cls];
        if (streams.has(stream)) return true;
        if (stream === 'tech_math') {
            var hasTM = false;
            streams.forEach(function(s) { if (TECH_MATH_STREAMS.indexOf(s) !== -1) hasTM = true; });
            return hasTM;
        }
        return false;
    });

    if (classes.length === 0) {
        container.innerHTML = '<div style="color:#e74c3c; text-align:center; padding:10px;">لا توجد أقسام لهذه الشعبة</div>';
        return;
    }

    classes.forEach(function(cls) {
        var div = document.createElement('div');
        div.className = 'class-option';
        var type = isEdit ? 'radio' : 'checkbox';
        div.innerHTML = '<label style="display:block; cursor:pointer; padding:8px;">' +
            '<input type="' + type + '" name="classSelection" value="' + cls + '" onchange="updateClassOptionStyle(this)"> ' + cls +
            '</label>';
        container.appendChild(div);
    });
}

function updateClassOptionStyle(input) {
    var p = input.closest('.class-option');
    if (input.checked) p.style.backgroundColor = '#e3f2fd';
    else p.style.backgroundColor = 'transparent';
}

function renderObservationCheckboxes(initialValues) {
    if (!initialValues) initialValues = {};
    var container = document.getElementById('observationsContainer');
    container.innerHTML = '';
    observationTypes.forEach(function(obs) {
        var isChecked = initialValues[obs.key] ? 'checked' : '';
        var dateVal = initialValues[obs.key + 'Date'] || '';
        var div = document.createElement('div');
        div.className = 'mb-2';
        div.innerHTML = '<label class="d-flex align-items-center">' +
            '<input type="checkbox" name="observation" value="' + obs.key + '" ' + isChecked + ' onchange="toggleObsDate(\'' + obs.key + '\', this)"> ' +
            '<span class="ms-2">' + obs.label + '</span>' +
            '</label>' +
            (obs.hasDate ? '<div id="dateContainer_' + obs.key + '" style="display:' + (isChecked ? 'block' : 'none') + '; margin-top:5px; margin-right:25px;">' +
                '<input type="date" id="obsDate_' + obs.key + '" value="' + dateVal + '" class="form-control form-control-sm" style="width:auto;">' +
            '</div>' : '');
        container.appendChild(div);
    });
}

function toggleObsDate(key, cb) {
    var el = document.getElementById('dateContainer_' + key);
    if (el) el.style.display = cb.checked ? 'block' : 'none';
}

// ==================== CORE ACTIONS ====================
async function saveNotebook(e) {
    if (e) e.preventDefault();
    var editId = document.getElementById('editNotebookId').value;
    var teacherId = document.getElementById('inputTeacher').value;
    var subject = document.getElementById('inputSubject').value;
    var status = document.getElementById('inputStatus').value;
    var notes = document.getElementById('inputAdditionalNotes').value;

    var selectedClasses = [];
    document.getElementsByName('classSelection').forEach(function(input) {
        if (input.checked) selectedClasses.push(input.value);
    });

    if (!teacherId || selectedClasses.length === 0) {
        alert('الرجاء اختيار الأستاذ والقسم.');
        return;
    }

    var observations = {};
    document.getElementsByName('observation').forEach(function(input) {
        if (input.checked) {
            observations[input.value] = true;
            var dateInput = document.getElementById('obsDate_' + input.value);
            if (dateInput) observations[input.value + 'Date'] = dateInput.value;
        }
    });

    var teacher = teachersList.filter(function(t) { return String(t.id) === String(teacherId); })[0];
    var teacherName = teacher ? (teacher.last_name || '') + ' ' + (teacher.first_name || '') : 'أستاذ';
    var stream = document.getElementById('inputStreamModal') ? document.getElementById('inputStreamModal').value : '';

    if (editId) {
        var idx = notebooksList.findIndex(function(n) { return n.id === editId; });
        if (idx !== -1) {
            Object.assign(notebooksList[idx], {
                teacherId: teacherId, teacherName: teacherName,
                className: selectedClasses[0], stream: stream, subject: subject,
                observations: observations, status: status, additionalNotes: notes,
                updatedAt: new Date().toISOString()
            });
        }
    } else {
        selectedClasses.forEach(function(cls) {
            notebooksList.unshift({
                id: generateId(), teacherId: teacherId, teacherName: teacherName,
                className: cls, stream: stream, subject: subject,
                observations: JSON.parse(JSON.stringify(observations)),
                status: status, additionalNotes: notes,
                createdAt: new Date().toISOString(), followUps: [], auditTrail: []
            });
        });
    }

    await DB.set('notebooksList', notebooksList);
    closeModal('notebookModal');
    renderNotebooksTable();
    updateStats();
}

function renderNotebooksTable() {
    var tbody = document.getElementById('notebooksTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    var filtered = notebooksList.filter(function(n) {
        var ft = document.getElementById('filterTeacher').value;
        var fs = document.getElementById('filterStatus').value;
        if (ft && n.teacherId !== ft) return false;
        if (fs && n.status !== fs) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center p-4 text-muted">لا توجد سجلات مطابقة</td></tr>';
        return;
    }

    filtered.forEach(function(n) {
        var tr = document.createElement('tr');
        var s = STATUS_CONFIG[n.status] || STATUS_CONFIG.violation;
        tr.innerHTML = '<td><input type="checkbox" onchange="toggleSelection(\'' + n.id + '\')" ' + (selectedNotebooks.has(n.id) ? 'checked' : '') + '></td>' +
            '<td>' + formatDate(n.createdAt) + '</td>' +
            '<td>' + n.teacherName + '</td>' +
            '<td>' + formatClassWithStream(n.className, n.stream) + '</td>' +
            '<td>' + (n.subject || '-') + '</td>' +
            '<td><span class="badge ' + s.cssClass + '">' + s.label + '</span>' + (n.followUps && n.followUps.length > 0 ? ' <small class="text-primary">(متابعة)</small>' : '') + '</td>' +
            '<td class="text-center">' +
                '<button class="btn btn-sm btn-outline-info me-1" onclick="openDetailModal(\'' + n.id + '\')" title="تفاصيل"><i class="fas fa-eye"></i></button>' +
                '<button class="btn btn-sm btn-outline-primary me-1" onclick="openEditModal(\'' + n.id + '\')" title="تعديل"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-success me-1" onclick="openFollowUpModal(\'' + n.id + '\')" title="متابعة"><i class="fas fa-tasks"></i></button>' +
                '<button class="btn btn-sm btn-primary me-1" onclick="printTeacherReport(\'' + n.id + '\')" title="طباعة"><i class="fas fa-print"></i></button>' +
                '<button class="btn btn-sm btn-outline-danger" onclick="deleteNotebook(\'' + n.id + '\')" title="حذف"><i class="fas fa-trash"></i></button>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

function updateStats() {
    var counts = { violation: 0, warning: 0, resolved: 0 };
    notebooksList.forEach(function(n) { if (counts[n.status] !== undefined) counts[n.status]++; });

    var totalEl = document.getElementById('statTotal');
    if (totalEl) totalEl.textContent = notebooksList.length;

    var violationEl = document.getElementById('statViolations');
    if (violationEl) violationEl.textContent = counts.violation;

    var warningEl = document.getElementById('statWarnings');
    if (warningEl) warningEl.textContent = counts.warning;

    var resolvedEl = document.getElementById('statResolved');
    if (resolvedEl) resolvedEl.textContent = counts.resolved;
}

// ==================== PRINTING FUNCTIONS ====================
async function printTeacherReport(id, opts) {
    if (!opts) opts = {};
    var n = notebooksList.filter(function(x) { return x.id === id; })[0];
    if (!n) return;
    var settings = await DB.getSettings() || {};
    var reportTextTemplate = await DB.get(REPORT_TEXT_KEY) || DEFAULT_REPORT_TEXT;
    var reportText = reportTextTemplate.replace(/{CLASS}/g, '<strong>' + formatClassWithStream(n.className, n.stream) + '</strong>')
        .replace(/{DATE}/g, '<strong>' + formatDate(n.createdAt) + '</strong>')
        .replace(/\\n/g, '<br>');

    var htmlContent = '<div style="direction:rtl; font-family:Cairo,sans-serif; padding:1.5cm; color:#000;">' +
        '<div style="text-align:center; margin-bottom:20px;">' +
            '<div>الجمهورية الجزائرية الديمقراطية الشعبية</div>' +
            '<div>وزارة التربية الوطنية</div>' +
            '<div style="display:flex; justify-content:space-between; margin-top:10px; font-weight:bold;">' +
                '<div>ولاية: ' + (settings.wilaya || '..........') + '<br>المؤسسة: ' + (settings.institutionName || '..........') + '</div>' +
                '<div>السنة الدراسية: ' + (settings.schoolYear || '..........') + '</div>' +
            '</div>' +
        '</div>' +
        '<div style="text-align:center; margin:30px 0;">' +
            '<span style="border:2px solid #000; padding:10px 40px; font-size:1.4rem; font-weight:bold; border-radius:8px;">مراقبة دفاتر النصوص</span>' +
        '</div>' +
        '<div style="margin-bottom:20px; font-size:1.1rem; line-height:1.8;">' +
            '<div>إلى السيد(ة): <strong>' + n.teacherName + '</strong> أستاذ(ة) مادة: <strong>' + (n.subject || '..........') + '</strong></div>' +
            '<div style="margin-top:15px; text-align:justify;">' + reportText + '</div>' +
        '</div>' +
        '<table style="width:100%; border-collapse:collapse; margin-top:20px;">' +
            '<thead><tr><th style="border:1px solid #000; padding:8px; background:#f5f5f5; width:50px;">#</th><th style="border:1px solid #000; padding:8px; background:#f5f5f5;">الملاحظات المسجلة</th></tr></thead>' +
            '<tbody>' +
                (function() {
                    var labels = getObservationLabels();
                    var obs = n.observations || {};
                    var rows = '';
                    var i = 1;
                    observationTypes.forEach(function(t) {
                        if (obs[t.key]) {
                            var d = (t.hasDate && obs[t.key + 'Date']) ? ' (بتاريخ: ' + formatDate(obs[t.key + 'Date']) + ')' : '';
                            rows += '<tr><td style="border:1px solid #000; padding:8px; text-align:center;">' + (i++) + '</td><td style="border:1px solid #000; padding:8px;">' + (labels[t.key] || t.key) + d + '</td></tr>';
                        }
                    });
                    if (n.additionalNotes) {
                        rows += '<tr><td style="border:1px solid #000; padding:8px; text-align:center;">' + (i++) + '</td><td style="border:1px solid #000; padding:8px;">ملاحظات إضافية: ' + n.additionalNotes + '</td></tr>';
                    }
                    return rows;
                })() +
            '</tbody>' +
        '</table>' +
        '<div style="margin-top:40px; display:flex; justify-content:space-between;">' +
            '<div>نسخة للمعني</div>' +
            '<div style="text-align:center;">' +
                '<div>' + (settings.wilaya || '..........') + ' في: ' + new Date().toLocaleDateString('fr-FR') + '</div><br>' +
                '<strong>المدير</strong>' +
            '</div>' +
        '</div>' +
    '</div>';

    var w = window.open('', '_blank');
    w.document.write('<!DOCTYPE html><html dir="rtl" lang="ar"><head><title>تقرير طباعة</title>' +
        '<style>@import url(\'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap\'); body{margin:0; padding:0;}</style>' +
        (window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : '') + '</head><body>' +
        (window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml() : '') +
        htmlContent +
        (window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml() : '') +
        '</body></html>');
    w.document.close();
}

function openAddModal() {
    document.getElementById('modalTitle').textContent = 'إضافة ملاحظة جديدة';
    document.getElementById('notebookForm').reset();
    document.getElementById('editNotebookId').value = '';
    renderObservationCheckboxes({});
    openModal('notebookModal');
}

function openEditModal(id) {
    var n = notebooksList.filter(function(x) { return x.id === id; })[0];
    if (!n) return;
    document.getElementById('modalTitle').textContent = 'تعديل السجل';
    document.getElementById('editNotebookId').value = n.id;
    document.getElementById('inputTeacher').value = n.teacherId;
    onTeacherChange();
    setTimeout(function() {
         document.getElementsByName('classSelection').forEach(function(i) { if (i.value === n.className) { i.checked = true; updateClassOptionStyle(i); } });
         document.getElementById('inputStatus').value = n.status;
         document.getElementById('inputAdditionalNotes').value = n.additionalNotes || '';
         renderObservationCheckboxes(n.observations);
         openModal('notebookModal');
    }, 200);
}

function toggleSelection(id) {
    if (selectedNotebooks.has(id)) selectedNotebooks.delete(id);
    else selectedNotebooks.add(id);
    updatePrintButtonState();
}

function updatePrintButtonState() {
    var btn = document.getElementById('btn-print-selected');
    if (btn) btn.style.display = selectedNotebooks.size > 0 ? 'inline-flex' : 'none';
     var count = document.getElementById('selectedCount');
    if (count) count.textContent = selectedNotebooks.size;
}

function deleteNotebook(id) {
    if (confirm('هل أنت متأكد من الحذف؟')) {
        notebooksList = notebooksList.filter(function(x) { return x.id !== id; });
        DB.set('notebooksList', notebooksList).then(function() {
            renderNotebooksTable();
            updateStats();
        });
    }
}

function openDetailModal(id) {
    var n = notebooksList.filter(function(x) { return x.id === id; })[0];
    if (!n) return;

    var body = document.getElementById('detailModalBody');
    var s = STATUS_CONFIG[n.status] || STATUS_CONFIG.violation;
    var labels = getObservationLabels();

    var obsListHtml = '';
    observationTypes.forEach(function(t) {
        if (n.observations[t.key]) {
            var d = (t.hasDate && n.observations[t.key + 'Date']) ? ' (بتاريخ: ' + formatDate(n.observations[t.key + 'Date']) + ')' : '';
            obsListHtml += '<div class="obs-tag">' + (labels[t.key] || t.key) + d + '</div>';
        }
    });

    var followUpsHtml = '';
    if (n.followUps && n.followUps.length > 0) {
        n.followUps.forEach(function(f) {
            var typeLabel = FOLLOWUP_LABELS[f.type] || f.type;
            followUpsHtml += '<div class="followup-item ' + f.type + '">' +
                '<div style="font-weight:700; color:#334155; margin-bottom:4px;">' + typeLabel + ' - ' + formatDate(f.date) + '</div>' +
                '<div>' + f.note + '</div>' +
            '</div>';
        });
    } else {
        followUpsHtml = '<div class="text-muted" style="font-style:italic;">لا توجد متابعات مسجلة لهذا السجل.</div>';
    }

    body.innerHTML = '<div class="detail-section">' +
        '<h4><span data-icon="info"></span> المعلومات الأساسية</h4>' +
        '<div class="detail-row"><span class="detail-label">التاريخ:</span><span class="detail-value">' + formatDate(n.createdAt) + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">الأستاذ:</span><span class="detail-value">' + n.teacherName + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">القسم:</span><span class="detail-value">' + formatClassWithStream(n.className, n.stream) + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">المادة:</span><span class="detail-value">' + (n.subject || '-') + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">الحالة:</span><span class="badge ' + s.cssClass + '">' + s.label + '</span></div>' +
    '</div>' +
    '<div class="detail-section">' +
        '<h4><span data-icon="list"></span> الملاحظات المسجلة</h4>' +
        '<div class="obs-tags">' + (obsListHtml || '<div class="text-muted">لم يتم تحديد ملاحظات</div>') + '</div>' +
        (n.additionalNotes ? '<div style="margin-top:10px; padding:10px; background:#f8fafc; border-radius:8px; border-right:3px solid #64748b;"><strong>ملاحظات إضافية:</strong><br>' + n.additionalNotes + '</div>' : '') +
    '</div>' +
    '<div class="detail-section">' +
        '<h4><span data-icon="refresh-cw"></span> سجل المتابعة</h4>' +
        '<div>' + followUpsHtml + '</div>' +
    '</div>';

    openModal('detailModal');
    if (typeof IconManager !== 'undefined') IconManager.render();
}

function openFollowUpModal(id) {
    document.getElementById('followUpNotebookId').value = id;
    document.getElementById('followUpNote').value = '';
    openModal('followUpModal');
}

async function saveFollowUp() {
    var id = document.getElementById('followUpNotebookId').value;
    var type = document.getElementById('followUpType').value;
    var note = document.getElementById('followUpNote').value;

    if (!note) { alert('الرجاء إدخال ملاحظة المتابعة.'); return; }

    var idx = notebooksList.findIndex(function(x) { return x.id === id; });
    if (idx !== -1) {
        if (!notebooksList[idx].followUps) notebooksList[idx].followUps = [];
        notebooksList[idx].followUps.push({
            id: generateId(),
            type: type,
            note: note,
            date: new Date().toISOString(),
            user: getCurrentUser()
        });

        // If corrective action or resolution, maybe update status?
        if (type === 'resolved') notebooksList[idx].status = 'resolved';

        await DB.set('notebooksList', notebooksList);
        closeModal('followUpModal');
        renderNotebooksTable();
        updateStats();
    }
}

function renderMiddleSchoolClasses(teacherId, isEdit) {
    var container = document.getElementById('classSelectionContainer');
    container.innerHTML = '';

    // Get classes assigned to this teacher
    var assignedClassesHtml = '';
    var classesCount = 0;

    // In middle school, we just list all classes or assigned ones
    allSchoolClasses.forEach(function(cls) {
        var div = document.createElement('div');
        div.className = 'class-option';
        var type = isEdit ? 'radio' : 'checkbox';
        div.innerHTML = '<label style="display:block; cursor:pointer; padding:8px;">' +
            '<input type="' + type + '" name="classSelection" value="' + cls + '" onchange="updateClassOptionStyle(this)"> ' + cls +
            '</label>';
        container.appendChild(div);
        classesCount++;
    });

    if (classesCount === 0) {
        container.innerHTML = '<div style="color:#e74c3c; text-align:center; padding:10px;">لا توجد أقسام مسجلة</div>';
    }
}

function filterNotebooks() {
    renderNotebooksTable();
}

function toggleSelectAll() {
    var selectAll = document.getElementById('selectAll');
    var checkboxes = document.querySelectorAll('#notebooksTableBody input[type="checkbox"]');
    checkboxes.forEach(function(cb) {
        cb.checked = selectAll.checked;
        var row = notebooksList.filter(function(n) {
           // Best effort to find the ID, logic depends on how toggleSelection is called
        });
        // We'll reset selectedNotebooks and rebuild it
    });

    selectedNotebooks.clear();
    if (selectAll.checked) {
        notebooksList.forEach(function(n) {
             var ft = document.getElementById('filterTeacher').value;
             var fs = document.getElementById('filterStatus').value;
             if ((!ft || n.teacherId === ft) && (!fs || n.status === fs)) {
                 selectedNotebooks.add(n.id);
             }
        });
    }
    updatePrintButtonState();
}

function openObsSettingsModal() {
    renderObsSettingsList();
    document.getElementById('reportTextTemplate').value = institutionSettings[REPORT_TEXT_KEY] || DEFAULT_REPORT_TEXT;
    openModal('obsSettingsModal');
}

function renderObsSettingsList() {
    var list = document.getElementById('obsSettingsList');
    list.innerHTML = '';
    observationTypes.forEach(function(t, index) {
        var div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; background:#f8fafc; border-radius:10px; margin-bottom:8px; border:1px solid #eee;';
        div.innerHTML = '<span>' + t.label + '</span>' +
            '<div>' +
                '<button class="btn btn-sm btn-outline-danger" onclick="deleteObservationType(' + index + ')"><i class="fas fa-trash"></i></button>' +
            '</div>';
        list.appendChild(div);
    });
}

function addNewObservationType() {
    var input = document.getElementById('newObsInput');
    var label = input.value.trim();
    if (!label) return;

    observationTypes.push({
        key: 'custom_' + Date.now().toString(36),
        label: label,
        hasDate: label.includes('تاريخ')
    });
    input.value = '';
    DB.set('observationTypes', observationTypes).then(renderObsSettingsList);
}

function deleteObservationType(index) {
    if (confirm('هل أنت متأكد من حذف هذا النوع من الملاحظات؟')) {
        observationTypes.splice(index, 1);
        DB.set('observationTypes', observationTypes).then(renderObsSettingsList);
    }
}

async function saveReportTextSettings() {
    var text = document.getElementById('reportTextTemplate').value;
    await DB.set(REPORT_TEXT_KEY, text);
    alert('تم حفظ إعدادات النص بنجاح.');
}

async function resetReportTextDefault() {
    if (confirm('هل تريد استعادة النص الافتراضي؟')) {
        document.getElementById('reportTextTemplate').value = DEFAULT_REPORT_TEXT;
        await DB.set(REPORT_TEXT_KEY, DEFAULT_REPORT_TEXT);
    }
}

function openPrintSettingsModal() {
    if (selectedNotebooks.size === 0) return;
    document.getElementById('printActions').value = '';
    openModal('printSettingsModal');
}

function closePrintSettingsModal() {
    closeModal('printSettingsModal');
}

async function confirmPrintReport() {
    var ids = Array.from(selectedNotebooks);
    if (ids.length === 0) return;

    var selectedItems = notebooksList.filter(function(n) { return selectedNotebooks.has(n.id); });

    // Group by teacher to check if same teacher
    var teacherId = selectedItems[0].teacherId;
    var allSameTeacher = selectedItems.every(function(n) { return n.teacherId === teacherId; });

    if (!allSameTeacher) {
        alert('يجب تحديد سجلات لنفس الأستاذ للطباعة المجمعة.');
        return;
    }

    var settings = await DB.getSettings() || {};
    var actions = document.getElementById('printActions').value;
    var signatory = document.querySelector('input[name="printSignatory"]:checked').value;

    var htmlContent = '<div style="direction:rtl; font-family:Cairo,sans-serif; padding:1.5cm; color:#000;">' +
        '<div style="text-align:center; margin-bottom:20px;">' +
            '<div>الجمهورية الجزائرية الديمقراطية الشعبية</div>' +
            '<div>وزارة التربية الوطنية</div>' +
            '<div style="display:flex; justify-content:space-between; margin-top:10px; font-weight:bold;">' +
                '<div>ولاية: ' + (settings.wilaya || '..........') + '<br>المؤسسة: ' + (settings.institutionName || '..........') + '</div>' +
                '<div>السنة الدراسية: ' + (settings.schoolYear || '..........') + '</div>' +
            '</div>' +
        '</div>' +
        '<div style="text-align:center; margin:30px 0;">' +
            '<span style="border:2px solid #000; padding:10px 40px; font-size:1.4rem; font-weight:bold; border-radius:8px;">تقرير مجمع لمراقبة دفاتر النصوص</span>' +
        '</div>' +
        '<div style="margin-bottom:20px; font-size:1.1rem;">' +
            '<div>إلى السيد(ة): <strong>' + selectedItems[0].teacherName + '</strong> أستاذ(ة) مادة: <strong>' + (selectedItems[0].subject || '..........') + '</strong></div>' +
        '</div>' +
        '<table style="width:100%; border-collapse:collapse; margin-top:20px;">' +
            '<thead><tr>' +
                '<th style="border:1px solid #000; padding:8px; background:#f5f5f5;">التاريخ</th>' +
                '<th style="border:1px solid #000; padding:8px; background:#f5f5f5;">القسم</th>' +
                '<th style="border:1px solid #000; padding:8px; background:#f5f5f5;">الملاحظات المسجلة</th>' +
            '</tr></thead>' +
            '<tbody>' +
                (function() {
                    var labels = getObservationLabels();
                    var rows = '';
                    selectedItems.forEach(function(n) {
                        var obsList = [];
                        observationTypes.forEach(function(t) {
                            if (n.observations[t.key]) {
                                var d = (t.hasDate && n.observations[t.key + 'Date']) ? ' (بتاريخ: ' + formatDate(n.observations[t.key + 'Date']) + ')' : '';
                                obsList.push((labels[t.key] || t.key) + d);
                            }
                        });
                        if (n.additionalNotes) obsList.push(n.additionalNotes);

                        rows += '<tr>' +
                            '<td style="border:1px solid #000; padding:8px; text-align:center;">' + formatDate(n.createdAt) + '</td>' +
                            '<td style="border:1px solid #000; padding:8px; text-align:center;">' + formatClassWithStream(n.className, n.stream) + '</td>' +
                            '<td style="border:1px solid #000; padding:8px;">' + obsList.join(' - ') + '</td>' +
                        '</tr>';
                    });
                    return rows;
                })() +
            '</tbody>' +
        '</table>' +
        (actions ? '<div style="margin-top:20px;"><strong>الإجراءات المتخذة:</strong><br>' + actions.replace(/\n/g, '<br>') + '</div>' : '') +
        '<div style="margin-top:40px; display:flex; justify-content:space-between;">' +
            '<div>نسخة للمعني</div>' +
            '<div style="text-align:center;">' +
                '<div>' + (settings.wilaya || '..........') + ' في: ' + new Date().toLocaleDateString('fr-FR') + '</div><br>' +
                '<strong>' + (signatory === 'director' ? 'المدير' : (signatory === 'both' ? 'الناظر والمدير' : 'الناظر')) + '</strong>' +
            '</div>' +
        '</div>' +
    '</div>';

    var w = window.open('', '_blank');
    w.document.write('<!DOCTYPE html><html dir="rtl" lang="ar"><head><title>تقرير مجمع</title>' +
        '<style>@import url(\'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap\'); body{margin:0; padding:0;}</style>' +
        (window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : '') + '</head><body>' +
        (window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml() : '') +
        htmlContent +
        (window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml() : '') +
        '</body></html>');
    w.document.close();
    closePrintSettingsModal();
}

function printReport() {
    // General print functionality for the current view
    window.print();
}
