// ============================================================
// Data Management - Export, Import & Delete
// ============================================================

// --- Export category mapping ---
var EXPORT_CATEGORIES = {
    students: {
        label: 'التلاميذ',
        dbKeys: ['studentsList', 'remedialStudentsLastYear'],
        localKeys: []
    },
    grades: {
        label: 'النقاط والنتائج',
        dbKeys: ['schoolResults', 'certificateResults', 'activityEvaluations', 'annualResults'],
        localKeys: []
    },
    teachers: {
        label: 'الأساتذة والموظفون',
        dbKeys: ['teachersList', 'teacherAssignments', 'supervisorsList', 'workersList', 'subjectResponsibles', 'classResponsibles'],
        localKeys: []
    },
    absences: {
        label: 'الغيابات',
        dbKeys: ['absenceRecords', 'absenceViewState', 'canteenAbsences'],
        localKeys: ['absenceTrackingState']
    },
    supervision: {
        label: 'الحراسة',
        dbKeys: [
            'supervisionSettings', 'supervisionTrimester', 'supervisionPeriodRooms', 'supervisionMigrationDone', 'supervisionPrintNotes_v2',
            'supervisionDays', 'supervisionSchedule', 'supervisionRoomAssignments',
            'supervisionDays_T1', 'supervisionSchedule_T1', 'supervisionRoomAssignments_T1',
            'supervisionDays_T2', 'supervisionSchedule_T2', 'supervisionRoomAssignments_T2',
            'supervisionDays_T3', 'supervisionSchedule_T3', 'supervisionRoomAssignments_T3',
            'supervisionDays_Tblanc', 'supervisionSchedule_Tblanc', 'supervisionRoomAssignments_Tblanc',
            'supervisionDays_Tblanc_lycee', 'supervisionSchedule_Tblanc_lycee', 'supervisionRoomAssignments_Tblanc_lycee'
        ],
        localKeys: ['supervisionListsSelection', 'supervisionListsSelection_customRooms']
    },
    notebooks: {
        label: 'دفاتر النصوص',
        dbKeys: ['notebooksList', 'observationTypes', 'notebookReportText'],
        localKeys: []
    },
    settings: {
        label: 'الإعدادات',
        dbKeys: ['institutionSettings', 'signatureSettings', 'exemptSubjects', 'reportOverviewSettings',
            'savedThresholds', 'app_settings', 'home_buttons_config', 'examGroupings', 'lastUpdate',
            'schoolEntryFirstYear', 'schoolEntryMaxClass', 'schoolEntryProjections', 'monthlyReportSettings'],
        localKeys: ['theme', 'councilSettings', 'printColumnsPrefs']
    },
    official_exams: {
        label: 'الامتحانات الرسمية',
        dbKeys: ['officialExamCenterData', 'officialExamCenterMembers', 'examProctorsList'],
        localKeys: []
    }
};

// --- Stored import data ---
var _pendingImportData = null;

// ============================================================
// UI Helpers
// ============================================================

function toggleExportOption(label) {
    var cb = label.querySelector('input[type="checkbox"]');
    cb.checked = !cb.checked;
    if (cb.checked) {
        label.classList.add('checked');
    } else {
        label.classList.remove('checked');
    }
    updateExportButton();
}

function toggleAllExport() {
    var options = document.querySelectorAll('#exportGrid .export-option');
    var allChecked = true;
    options.forEach(function (opt) {
        if (!opt.querySelector('input').checked) allChecked = false;
    });

    var newState = !allChecked;
    options.forEach(function (opt) {
        var cb = opt.querySelector('input');
        cb.checked = newState;
        if (newState) {
            opt.classList.add('checked');
        } else {
            opt.classList.remove('checked');
        }
    });

    var btn = document.getElementById('toggleAllBtn');
    btn.textContent = newState ? 'إلغاء الكل' : 'تحديد الكل';
    updateExportButton();
}

function updateExportButton() {
    var checked = document.querySelectorAll('#exportGrid input:checked');
    var btn = document.getElementById('btnExport');
    btn.disabled = checked.length === 0;
}

function selectImportMode(mode, el) {
    document.querySelectorAll('.mode-option').forEach(function (opt) {
        opt.classList.remove('active');
    });
    el.classList.add('active');
    el.querySelector('input').checked = true;
}

// Initialize checkboxes on load
document.addEventListener('DOMContentLoaded', function () {
    var options = document.querySelectorAll('#exportGrid .export-option');
    options.forEach(function (opt) {
        if (opt.querySelector('input').checked) {
            opt.classList.add('checked');
        }
    });

    // Drag and drop
    var dropzone = document.getElementById('importDropzone');
    if (dropzone) {
        dropzone.addEventListener('dragover', function (e) {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', function () {
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', function (e) {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                var file = e.dataTransfer.files[0];
                if (file.name.endsWith('.json')) {
                    processImportFile(file);
                } else {
                    showToast('❌ يرجى اختيار ملف JSON فقط');
                }
            }
        });
    }
});

// ============================================================
// SELECTIVE EXPORT
// ============================================================

async function exportSelectedData() {
    var checked = document.querySelectorAll('#exportGrid input:checked');
    if (checked.length === 0) {
        showToast('❌ يرجى اختيار بيانات للتصدير');
        return;
    }

    var selectedCategories = [];
    checked.forEach(function (cb) { selectedCategories.push(cb.value); });

    try {
        var backup = {
            _db: {},
            _local: {},
            _metadata: {
                exportDate: new Date().toISOString(),
                version: '3.0-sqlite',
                categories: selectedCategories
            }
        };

        for (var i = 0; i < selectedCategories.length; i++) {
            var cat = EXPORT_CATEGORIES[selectedCategories[i]];
            if (!cat) continue;

            // DB keys
            for (var j = 0; j < cat.dbKeys.length; j++) {
                var key = cat.dbKeys[j];
                var val = key === 'absenceRecords' ? await DB.getAllAbsencesExport() : await DB.get(key);
                if (val !== null && val !== undefined) {
                    backup._db[key] = val;
                }
            }

            // localStorage keys
            for (var k = 0; k < cat.localKeys.length; k++) {
                var lKey = cat.localKeys[k];
                var lVal = localStorage.getItem(lKey);
                if (lVal) {
                    try { backup._local[lKey] = JSON.parse(lVal); } catch (e) { backup._local[lKey] = lVal; }
                }
            }
        }

        if (Object.keys(backup._db).length === 0 && Object.keys(backup._local).length === 0) {
            showToast('❌ لا توجد بيانات لتصديرها في الفئات المحددة!');
            return;
        }

        var catLabels = selectedCategories.map(function (c) { return EXPORT_CATEGORIES[c] ? EXPORT_CATEGORIES[c].label : c; });
        var suffix = selectedCategories.length === Object.keys(EXPORT_CATEGORIES).length ? 'full' : selectedCategories.join('_');
        var fileName = 'backup_' + suffix + '_' + new Date().toISOString().slice(0, 10) + '.json';

        var dataStr = JSON.stringify(backup);
        var blob = new Blob([dataStr], { type: 'application/json' });
        var dataUri = URL.createObjectURL(blob);

        var link = document.createElement('a');
        link.setAttribute('href', dataUri);
        link.setAttribute('download', fileName);
        link.click();
        setTimeout(function () { URL.revokeObjectURL(dataUri); }, 100);

        showToast('✅ تم تصدير: ' + catLabels.join('، '));
    } catch (err) {
        console.error('Export failed:', err);
        showToast('❌ حدث خطأ أثناء التصدير!');
    }
}

// ============================================================
// IMPORT
// ============================================================

function handleImportFile(event) {
    var file = event.target.files[0];
    if (!file) return;
    processImportFile(file);
}

function processImportFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
        try {
            var data = JSON.parse(e.target.result);

            // Validate
            var isNewFormat = !!data._db && !!data._local;
            var hasLegacy = !!data.schoolResults || !!data.institutionSettings || !!data.studentsList;

            if (!isNewFormat && !hasLegacy) {
                showToast('❌ ملف غير صالح! يرجى اختيار ملف نسخة احتياطية صحيح.');
                return;
            }

            _pendingImportData = data;

            // Show file name
            var fnEl = document.getElementById('selectedFileName');
            fnEl.textContent = '📄 ' + file.name;
            fnEl.style.display = 'block';

            // Show preview
            showImportPreview(data);

            // Show mode section
            document.getElementById('importModeSection').classList.add('visible');

            // Re-render icons
            if (typeof lucide !== 'undefined') lucide.createIcons();

        } catch (err) {
            console.error('Parse error:', err);
            showToast('❌ ملف تالف أو غير صالح!');
        }
    };
    reader.onerror = function () {
        showToast('❌ خطأ أثناء قراءة الملف!');
    };
    reader.readAsText(file);
}

function showImportPreview(data) {
    var preview = document.getElementById('importPreview');
    var grid = document.getElementById('previewGrid');
    grid.innerHTML = '';

    var isNew = !!data._db;
    var source = isNew ? data._db : data;

    var items = [];

    // Students
    var students = source.studentsList;
    if (students) {
        if (typeof students === 'string') try { students = JSON.parse(students); } catch (e) { students = []; }
        if (Array.isArray(students) && students.length > 0) {
            items.push({ label: 'تلميذ', count: students.length, icon: '👨‍🎓' });
        }
    }

    // Results
    var results = source.schoolResults;
    if (results) {
        if (typeof results === 'string') try { results = JSON.parse(results); } catch (e) { results = []; }
        if (Array.isArray(results) && results.length > 0) {
            items.push({ label: 'نتيجة', count: results.length, icon: '📊' });
        }
    }

    // Teachers
    var teachers = source.teachersList;
    if (teachers) {
        if (typeof teachers === 'string') try { teachers = JSON.parse(teachers); } catch (e) { teachers = []; }
        if (Array.isArray(teachers) && teachers.length > 0) {
            items.push({ label: 'أستاذ', count: teachers.length, icon: '👨‍🏫' });
        }
    }

    // Workers
    var workers = source.workersList;
    if (workers) {
        if (typeof workers === 'string') try { workers = JSON.parse(workers); } catch (e) { workers = []; }
        if (Array.isArray(workers) && workers.length > 0) {
            items.push({ label: 'عامل', count: workers.length, icon: '👨‍🔧' });
        }
    }

    // Notebooks
    var notebooks = source.notebooksList;
    if (notebooks) {
        if (typeof notebooks === 'string') try { notebooks = JSON.parse(notebooks); } catch (e) { notebooks = []; }
        if (Array.isArray(notebooks) && notebooks.length > 0) {
            items.push({ label: 'دفتر', count: notebooks.length, icon: '📓' });
        }
    }

    // Supervision
    if (source.supervisionDays || source.supervisionDays_T1 || source.supervisionDays_T2 || source.supervisionDays_T3 || source.supervisionDays_Tblanc || source.supervisionDays_Tblanc_lycee) {
        items.push({ label: 'جداول حراسة', count: '✓', icon: '🛡️' });
    }

    // Absences
    var absences = source.absenceRecords;
    if (absences) {
        if (typeof absences === 'string') try { absences = JSON.parse(absences); } catch (e) { absences = []; }
        if (Array.isArray(absences) && absences.length > 0) {
            items.push({ label: 'سجل غياب', count: absences.length, icon: '📋' });
        }
    }

    // Activity Evaluations
    var avEvals = source.activityEvaluations;
    if (avEvals) {
        if (typeof avEvals === 'string') try { avEvals = JSON.parse(avEvals); } catch (e) { avEvals = []; }
        if (Array.isArray(avEvals) && avEvals.length > 0) {
            items.push({ label: 'تقييم نشاط', count: avEvals.length, icon: '📝' });
        }
    }

    // Settings
    if (source.institutionSettings) {
        items.push({ label: 'الإعدادات', count: '✓', icon: '⚙️' });
    }

    // Metadata
    if (isNew && data._metadata) {
        var metaInfo = '';
        if (data._metadata.exportDate) {
            metaInfo = new Date(data._metadata.exportDate).toLocaleDateString('ar-DZ');
        }
        if (data._metadata.categories) {
            var catLabels = data._metadata.categories.map(function (c) {
                return EXPORT_CATEGORIES[c] ? EXPORT_CATEGORIES[c].label : c;
            });
            metaInfo += (metaInfo ? ' — ' : '') + catLabels.join('، ');
        }
        if (metaInfo) {
            items.push({ label: metaInfo, count: '📅', icon: '' });
        }
    }

    // LocalStorage items
    if (isNew && data._local && Object.keys(data._local).length > 0) {
        items.push({ label: 'إعدادات محلية', count: Object.keys(data._local).length, icon: '💾' });
    }

    if (items.length === 0) {
        grid.innerHTML = '<div class="preview-item">لا توجد بيانات في هذا الملف</div>';
    } else {
        items.forEach(function (item) {
            var div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = (item.icon ? '<span>' + item.icon + '</span> ' : '') +
                '<span>' + item.label + '</span> ' +
                '<span class="count">' + item.count + '</span>';
            grid.appendChild(div);
        });
    }

    preview.classList.add('visible');
}

async function executeImport() {
    if (!_pendingImportData) {
        showToast('❌ يرجى اختيار ملف أولاً');
        return;
    }

    var mode = document.querySelector('input[name="importMode"]:checked').value;
    var modeLabel = mode === 'merge' ? 'دمج البيانات' : 'استبدال البيانات';

    var confirmResult = await Swal.fire({
        title: mode === 'replace' ? 'تنبيه خطير' : 'تأكيد الدمج',
        html: mode === 'replace'
            ? 'سيتم <b>حذف جميع البيانات الحالية</b> واستبدالها ببيانات الملف.<br>هل تريد الاستمرار؟'
            : 'سيتم <b>دمج</b> بيانات الملف مع البيانات الحالية.<br>البيانات المكررة لن تتأثر.',
        icon: mode === 'replace' ? 'warning' : 'question',
        showCancelButton: true,
        confirmButtonColor: mode === 'replace' ? '#d33' : '#3085d6',
        cancelButtonColor: mode === 'replace' ? '#3085d6' : '#6c757d',
        confirmButtonText: 'نعم، ' + modeLabel,
        cancelButtonText: 'إلغاء'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        var data = _pendingImportData;
        var isNewFormat = !!data._db && !!data._local;

        if (mode === 'replace') {
            await importReplace(data, isNewFormat);
        } else {
            await importMerge(data, isNewFormat);
        }

        showToast('✅ تم ' + modeLabel + ' بنجاح! سيتم إعادة تحميل الصفحة...');
        setTimeout(function () { window.location.reload(); }, 2000);
    } catch (err) {
        console.error('Import failed:', err);
        showToast('❌ خطأ أثناء الاسترجاع: ' + err.message);
    }
}

// --- Replace Mode (original behavior) ---
async function importReplace(data, isNewFormat) {
    if (isNewFormat) {
        // Restore DB
        for (var key in data._db) {
            if (key === 'absenceRecords') {
                await DB.clearAllAbsences();
                await DB.importAbsences(data._db[key]);
            } else if (key === 'activityEvaluations') {
                await DB.importActivityEvals(data._db[key]);
            } else {
                await DB.set(key, data._db[key]);
            }
        }
        // Restore localStorage
        for (var key in data._local) {
            var val = data._local[key];
            localStorage.setItem(key, typeof val === 'object' ? JSON.stringify(val) : val);
        }
    } else {
        // Legacy format
        var localStorageKeys = [
            'currentUser', 'authTime',
            'supervisionDays', 'supervisionSchedule', 'supervisionSettings',
            'supervisionTrimester', 'supervisionRoomAssignments', 'supervisionListsSelection',
            'supervisionListsSelection_customRooms', 'absenceTrackingState',
            'councilSettings', 'printColumnsPrefs', 'theme'
        ];

        for (var key of Object.keys(data)) {
            if (localStorageKeys.includes(key)) {
                var val = data[key];
                localStorage.setItem(key, typeof val === 'object' ? JSON.stringify(val) : val);
            } else {
                if (key === 'absenceRecords') {
                    await DB.clearAllAbsences();
                    await DB.importAbsences(data[key]);
                } else {
                    await DB.set(key, data[key]);
                }
            }
        }
    }
}

// --- Merge Mode ---
async function importMerge(data, isNewFormat) {
    var source = isNewFormat ? data._db : data;
    var localSource = isNewFormat ? data._local : {};

    // Legacy format local keys
    if (!isNewFormat) {
        var localStorageKeys = [
            'currentUser', 'authTime',
            'supervisionDays', 'supervisionSchedule', 'supervisionSettings',
            'supervisionTrimester', 'supervisionRoomAssignments', 'supervisionListsSelection',
            'supervisionListsSelection_customRooms', 'absenceTrackingState',
            'councilSettings', 'printColumnsPrefs', 'theme'
        ];
        localSource = {};
        for (var k in data) {
            if (localStorageKeys.includes(k)) {
                localSource[k] = data[k];
            }
        }
        // Remove local keys from source to avoid double processing
        source = {};
        for (var k in data) {
            if (!localStorageKeys.includes(k)) {
                source[k] = data[k];
            }
        }
    }

    // --- Merge Students (by full name) ---
    if (source.studentsList) {
        var incoming = source.studentsList;
        if (typeof incoming === 'string') try { incoming = JSON.parse(incoming); } catch (e) { incoming = []; }
        if (Array.isArray(incoming) && incoming.length > 0) {
            var existing = (await DB.get('studentsList')) || [];
            var existingNames = {};
            existing.forEach(function (s) {
                var name = ((s.last_name || '') + ' ' + (s.first_name || '')).trim();
                var key = name + '|' + (s.academic_year || '');
                existingNames[key] = true;
            });

            var added = 0;
            incoming.forEach(function (s) {
                var name = ((s.last_name || '') + ' ' + (s.first_name || '')).trim();
                var key = name + '|' + (s.academic_year || '');
                if (!existingNames[key]) {
                    existing.push(s);
                    existingNames[key] = true;
                    added++;
                }
            });

            if (added > 0) {
                await DB.set('studentsList', existing);
            }
        }
    }

    // --- Merge Activity Evaluations ---
    if (source.activityEvaluations) {
        var incoming = source.activityEvaluations;
        if (typeof incoming === 'string') try { incoming = JSON.parse(incoming); } catch (e) { incoming = []; }
        if (Array.isArray(incoming) && incoming.length > 0) {
            var existing = (await DB.get('activityEvaluations')) || [];
            var existingKeys = {};
            existing.forEach(function (r) {
                var key = [r.student_id, r.subject, r.trimester, r.academic_year].join('|');
                existingKeys[key] = true;
            });

            var added = 0;
            incoming.forEach(function (r) {
                var key = [r.student_id, r.subject, r.trimester, r.academic_year].join('|');
                if (!existingKeys[key]) {
                    existing.push(r);
                    existingKeys[key] = true;
                    added++;
                }
            });

            if (added > 0) {
                await DB.set('activityEvaluations', existing);
            }
        }
    }

    // --- Merge Results (by student name + trimester) ---
    if (source.schoolResults) {
        var incoming = source.schoolResults;
        if (typeof incoming === 'string') try { incoming = JSON.parse(incoming); } catch (e) { incoming = []; }
        if (Array.isArray(incoming) && incoming.length > 0) {
            var existing = (await DB.get('schoolResults')) || [];
            var existingKeys = {};
            existing.forEach(function (r) {
                var name = (r.fullName || ((r.last_name || '') + ' ' + (r.first_name || '')).trim());
                var key = name + '|' + (r.trimester || '') + '|' + (r.academic_year || '');
                existingKeys[key] = true;
            });

            var added = 0;
            incoming.forEach(function (r) {
                var name = (r.fullName || ((r.last_name || '') + ' ' + (r.first_name || '')).trim());
                var key = name + '|' + (r.trimester || '') + '|' + (r.academic_year || '');
                if (!existingKeys[key]) {
                    existing.push(r);
                    existingKeys[key] = true;
                    added++;
                }
            });

            if (added > 0) {
                await DB.set('schoolResults', existing);
            }
        }
    }

    // --- Merge Teachers (by full name) ---
    if (source.teachersList) {
        var incoming = source.teachersList;
        if (typeof incoming === 'string') try { incoming = JSON.parse(incoming); } catch (e) { incoming = []; }
        if (Array.isArray(incoming) && incoming.length > 0) {
            var existing = (await DB.get('teachersList')) || [];
            var existingNames = {};
            existing.forEach(function (t) {
                var name = ((t.last_name || '') + ' ' + (t.first_name || '')).trim();
                var key = name + '|' + (t.academic_year || '');
                existingNames[key] = true;
            });

            var added = 0;
            incoming.forEach(function (t) {
                var name = ((t.last_name || '') + ' ' + (t.first_name || '')).trim();
                var key = name + '|' + (t.academic_year || '');
                if (!existingNames[key]) {
                    existing.push(t);
                    existingNames[key] = true;
                    added++;
                }
            });

            if (added > 0) {
                await DB.set('teachersList', existing);
            }
        }
    }

    // --- Merge Workers (by full name) ---
    if (source.workersList) {
        var incoming = source.workersList;
        if (typeof incoming === 'string') try { incoming = JSON.parse(incoming); } catch (e) { incoming = []; }
        if (Array.isArray(incoming) && incoming.length > 0) {
            var existing = (await DB.get('workersList')) || [];
            var existingNames = {};
            existing.forEach(function (w) {
                var name = ((w.last_name || '') + ' ' + (w.first_name || '')).trim();
                var key = name + '|' + (w.academic_year || '');
                existingNames[key] = true;
            });

            var added = 0;
            incoming.forEach(function (w) {
                var name = ((w.last_name || '') + ' ' + (w.first_name || '')).trim();
                var key = name + '|' + (w.academic_year || '');
                if (!existingNames[key]) {
                    existing.push(w);
                    existingNames[key] = true;
                    added++;
                }
            });

            if (added > 0) {
                await DB.set('workersList', existing);
            }
        }
    }

    // --- Merge Absences (append all) ---
    if (source.absenceRecords) {
        var incoming = source.absenceRecords;
        if (typeof incoming === 'string') try { incoming = JSON.parse(incoming); } catch (e) { incoming = []; }
        if (Array.isArray(incoming) && incoming.length > 0) {
            var existing = (await DB.getAllAbsencesExport()) || [];
            // Simple append — absence records are unique by date+student
            var existingKeys = {};
            existing.forEach(function (a) {
                var key = (a.studentName || '') + '|' + (a.date || '') + '|' + (a.session || '');
                existingKeys[key] = true;
            });

            incoming.forEach(function (a) {
                var key = (a.studentName || '') + '|' + (a.date || '') + '|' + (a.session || '');
                if (!existingKeys[key]) {
                    existing.push(a);
                    existingKeys[key] = true;
                }
            });

            await DB.clearAllAbsences();
            await DB.importAbsences(existing);
        }
    }

    // --- Merge other DB keys (settings: backup fills gaps) ---
    var arrayMergedKeys = ['studentsList', 'schoolResults', 'teachersList', 'workersList', 'absenceRecords'];
    for (var key in source) {
        if (arrayMergedKeys.indexOf(key) !== -1) continue;
        if (key.startsWith('_')) continue;

        var existingVal = await DB.get(key);
        if (existingVal === null || existingVal === undefined) {
            // Only set if not existing
            await DB.set(key, source[key]);
        }
    }

    // --- Merge localStorage (fill gaps) ---
    for (var key in localSource) {
        if (!localStorage.getItem(key)) {
            var val = localSource[key];
            localStorage.setItem(key, typeof val === 'object' ? JSON.stringify(val) : val);
        }
    }
}

// ============================================================
// DELETE FUNCTIONS (kept from original)
// ============================================================

async function deleteStudentsData() {
    var result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: 'هل أنت متأكد من حذف قائمة التلاميذ؟ (لن يتم حذف النقاط والغيابات)',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف القائمة',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    try {
        await DB.remove('studentsList');
        showToast('✅ تم حذف قائمة التلاميذ.');
    } catch (e) {
        console.error(e);
        showToast('❌ حدث خطأ أثناء الحذف.');
    }
}

async function deleteGradesData() {
    var result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: 'هل أنت متأكد من حذف جميع النقاط والنتائج (بما في ذلك تقييمات الأنشطة)؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف النتائج',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    try {
        showToast('⏳ جاري حذف النتائج...');
        await DB.remove('schoolResults');
        await DB.remove('certificateResults');
        await DB.remove('activityEvaluations');
        showToast('✅ تم حذف جميع النقاط والنتائج بنجاح.');
    } catch (e) {
        console.error(e);
        showToast('❌ حدث خطأ أثناء الحذف.');
    }
}

async function deleteTeachersData() {
    var result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: 'هل أنت متأكد من حذف قائمة الأساتذة، المشرفين، وجداول التوقيت؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    try {
        await DB.remove('teachersList');
        await DB.remove('teacherAssignments');
        await DB.remove('supervisorsList');
        await DB.remove('workersList');
        await DB.remove('subjectResponsibles');
        await DB.remove('classResponsibles');
        showToast('✅ تم حذف بيانات الأساتذة والموظفين.');
    } catch (e) {
        console.error(e);
        showToast('❌ حدث خطأ أثناء الحذف.');
    }
}

async function deleteAbsenceData() {
    var result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: 'هل أنت متأكد من حذف سجل أرشيف الغيابات؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    try {
        await DB.clearAllAbsences();
        await DB.remove('absenceViewState');
        showToast('✅ تم حذف سجلات الغيابات.');
    } catch (e) {
        console.error(e);
        showToast('❌ حدث خطأ أثناء الحذف.');
    }
}

async function deleteSupervisionData() {
    var result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: 'هل أنت متأكد من حذف جداول وإعدادات الحراسة؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    try {
        const keysToRemove = EXPORT_CATEGORIES.supervision.dbKeys;
        for (let i = 0; i < keysToRemove.length; i++) {
            await DB.remove(keysToRemove[i]);
        }
        EXPORT_CATEGORIES.supervision.localKeys.forEach(function (lk) {
            localStorage.removeItem(lk);
        });
        showToast('✅ تم حذف بيانات وإعدادات الحراسة.');
    } catch (e) {
        console.error(e);
        showToast('❌ حدث خطأ أثناء الحذف.');
    }
}

async function deleteNotebooksData() {
    var result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: 'هل أنت متأكد من حذف بيانات دفاتر النصوص؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    try {
        await DB.remove('notebooksList');
        await DB.remove('observationTypes');
        await DB.remove('notebookReportText');
        showToast('✅ تم حذف بيانات دفاتر النصوص.');
    } catch (e) {
        console.error(e);
        showToast('❌ حدث خطأ أثناء الحذف.');
    }
}

async function deleteConfiguration() {
    var result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: 'هل أنت متأكد من حذف الإعدادات (المؤسسة، الإمضاءات، المواد المعفاة)؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;

    try {
        await DB.remove('institutionSettings');
        await DB.remove('signatureSettings');
        await DB.remove('exemptSubjects');
        await DB.remove('reportOverviewSettings');
        await DB.remove('savedThresholds');
        await DB.remove('app_settings');
        await DB.remove('home_buttons_config');
        await DB.remove('lastUpdate');
        showToast('✅ تم إعادة تعيين الإعدادات.');
        setTimeout(function () { window.location.reload(); }, 1500);
    } catch (e) {
        console.error(e);
        showToast('❌ حدث خطأ أثناء الحذف.');
    }
}

async function clearData() {
    var result1 = await Swal.fire({
        title: 'تحذير خطير جداً',
        text: 'هل أنت متأكد من ضبط المصنع؟ سيتم حذف جميع البيانات والعودة للتطبيق الخالي تماماً.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، متابعة',
        cancelButtonText: 'إلغاء'
    });

    if (result1.isConfirmed) {
        var result2 = await Swal.fire({
            title: 'تأكيد نهائي',
            text: 'هل أنت متأكد تماماً؟ لا يمكن التراجع عن هذه العملية!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'نعم، احذف كل شيء',
            cancelButtonText: 'إلغاء'
        });

        if (result2.isConfirmed) {
            try {
                await DB.clear();
                try { indexedDB.deleteDatabase('AnalyseDB'); } catch (e) { }
                localStorage.clear();
                showToast('🗑️ تم ضبط المصنع بنجاح.');
                setTimeout(function () { window.location.reload(); }, 1500);
            } catch (e) {
                console.error(e);
                localStorage.clear();
                window.location.reload();
            }
        }
    }
}

async function repairMigration() {
    var result = await Swal.fire({
        title: 'ترحيل / إصلاح البيانات',
        html: 'سيقوم النظام بفحص البيانات القديمة (من المتصفح) ونقلها إلى قاعدة البيانات الجديدة.<br><br><b>هل تريد الاستمرار؟</b>',
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#0ea5e9',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، ابدأ الترحيل',
        cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
        try {
            // Reset all migration flags so it re-processes everything
            await DB.set('_migrated_to_sqlite', false);
            await DB.set('_migrated_to_relational', false);
            await DB.set('_migrated_activity_evals', false);
            await DB.set('_migrated_absences', false);

            // Run the migration directly
            await DB.runManualMigration();

            await Swal.fire({
                title: 'تم الترحيل بنجاح! 🎉',
                text: 'تم نقل بياناتك للقاعدة الجديدة بنجاح.',
                icon: 'success',
                confirmButtonText: 'ممتاز'
            });
        } catch (e) {
            console.error('Repair failed:', e);
            Swal.fire('خطأ ❌', 'فشل الترحيل: ' + e.message, 'error');
        }
    }
}

async function runDeduplication() {
    var result = await Swal.fire({
        title: 'تنظيف البيانات المكررة',
        html: 'سيقوم النظام بالبحث عن البيانات المكررة في كل الجداول (مثل التلاميذ والنتائج المكررة بنفس الاسم ونفس السنة) وحذفها مع الاحتفاظ بالنسخة الأحدث فقط.<br><br><b>هل تريد الاستمرار؟</b>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#8b5cf6',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، نظّف البيانات',
        cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
        try {
            showToast('⏳ جاري تنظيف البيانات المكررة...');

            var report = await DB.deduplicate();

            if (report.error) {
                throw new Error(report.error);
            }

            var tableNamesAr = {
                'students': 'التلاميذ',
                'results': 'النتائج',
                'activity_evaluations': 'التقييمات',
                'student_absences': 'غيابات التلاميذ',
                'teacher_absences': 'غيابات الأساتذة',
                'supervisor_absences': 'غيابات الإداريين',
                'canteen_absences': 'غيابات المطعم'
            };

            var totalRemoved = 0;
            var reportHtml = '<ul style="text-align: right; margin-top: 15px;">';

            for (var table in report) {
                var count = report[table];
                if (typeof count === 'number' && count > 0) {
                    totalRemoved += count;
                    var arName = tableNamesAr[table] || table;
                    reportHtml += `<li><b>${arName}:</b> تم حذف ${count} سجل مكرر</li>`;
                }
            }
            reportHtml += '</ul>';

            if (totalRemoved === 0) {
                await Swal.fire({
                    title: 'البيانات نظيفة ✨',
                    text: 'لم يتم العثور على أي سجلات مكررة في النظام.',
                    icon: 'success',
                    confirmButtonText: 'ممتاز'
                });
            } else {
                await Swal.fire({
                    title: 'تم التنظيف بنجاح! 🧹',
                    html: `تم العثور على <b>${totalRemoved}</b> سجل مكرر وحذفه.<br>${reportHtml}`,
                    icon: 'success',
                    confirmButtonText: 'حسناً'
                });
            }
        } catch (e) {
            console.error('Deduplication failed:', e);
            Swal.fire('خطأ ❌', 'فشل أثناء تنظيف البيانات: ' + e.message, 'error');
        }
    }
}

// ============================================================
// TOAST
// ============================================================

function showToast(message) {
    var container = document.getElementById('toastContainer');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = '<span>' + message + '</span>';
    container.appendChild(toast);

    // Force reflow
    toast.offsetHeight;
    toast.classList.add('show');

    setTimeout(function () {
        toast.classList.remove('show');
        setTimeout(function () { toast.remove(); }, 500);
    }, 3000);
}



