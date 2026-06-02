
module.exports = function (context) {
    var ipcMain = context.ipcMain;
    var queueDBTask = context.queueDBTask;
    var db = context.getDb();
    var dialog = context.dialog;
    var hydrateStudentRow = context.hydrateStudentRow;
    var normalizeStudentColumnValue = context.normalizeStudentColumnValue;
    var normalizeAcademicYear = context.normalizeAcademicYear;
    var normalizeClassNumberValue = context.normalizeClassNumberValue;
var normalizeLevelStorageValue = context.normalizeLevelStorageValue;
var getAcademicYearFromDate = context.getAcademicYearFromDate;
var DB_PATH = context.getDatabasePath();

function hydrateAnnualResultRow(row) {
    if (!row) return row;

    var recordId = row.id;
    var extra = {};

    if (row.extra_data) {
        try {
            extra = JSON.parse(row.extra_data) || {};
            Object.assign(row, extra);
        } catch (e) { }
    }

    var lastName = row.last_name || row.lastName || '';
    var firstName = row.first_name || row.firstName || '';
    var fullName = (row.fullName || '').trim();

    if (!lastName && !firstName && fullName) {
        lastName = fullName;
    }

    row.record_id = recordId;
    row.id = row.student_id || row.id;
    row.student_id = row.student_id || null;
    row.lastName = lastName;
    row.firstName = firstName;
    row.fullName = fullName || (lastName + ' ' + firstName).trim();
    row.birthDate = row.birth_date || row.birthDate || '';
    row.birthYear = row.birth_year || row.birthYear || null;
    row.className = row.class_name || row.className || '';
    row.squad = row.className;
    row.t1 = parseFloat(row.t1_avg || row.t1 || 0) || 0;
    row.t2 = parseFloat(row.t2_avg || row.t2 || 0) || 0;
    row.t3 = parseFloat(row.t3_avg || row.t3 || 0) || 0;
    row.annualAvg = parseFloat(row.annual_avg || row.annualAvg || 0) || 0;
    row.level = row.level === null || row.level === undefined || row.level === '' ? null : parseInt(row.level, 10);
    if (isNaN(row.level)) row.level = null;

    delete row.extra_data;
    return row;
}


ipcMain.handle('db-get-results', function (event, options) {
    return new Promise((resolve) => {
        if (!db) return resolve([]);

        var academicYear = (options && typeof options === 'object') ? options.academicYear : null;

        var sql = 'SELECT * FROM results';
        var params = [];
        if (academicYear) {
            sql += ' WHERE academic_year = ?';
            params.push(academicYear);
        }
        sql += ' ORDER BY level, class, id';

        db.all(sql, params, (err, rows) => {
            if (err || !rows) {
                console.error('[SQLite] db-get-results error:', err ? err.message : 'No rows');
                resolve([]);
                return;
            }

            rows.forEach(row => {
                row.isRepeater = !!row.is_repeater;
                row.name = row.student_name; // Alias for backward compatibility
                // Parse JSON fields
                if (row.marks) {
                    try { row.marks = JSON.parse(row.marks); } catch (e) { row.marks = {}; }
                } else {
                    row.marks = {};
                }
                if (row.averages) {
                    try { row.averages = JSON.parse(row.averages); } catch (e) { row.averages = {}; }
                } else {
                    row.averages = {};
                }
                // Parse extra_data
                if (row.extra_data) {
                    try {
                        var extra = JSON.parse(row.extra_data);
                        Object.assign(row, extra);
                    } catch (e) { }
                }
                row.level = normalizeLevelStorageValue(row.level || null);
                row.class = normalizeClassNumberValue(row.class || row.class_number || null);
                row.class_number = normalizeClassNumberValue(row.class_number || row.class || null);
                delete row.extra_data;
                delete row.is_repeater;
            });

            resolve(rows);
        });
    });
});

ipcMain.handle('db-save-results', function (event, results) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);

            var rows = Array.isArray(results) ? results : [];
            var touchedYearsMap = {};
            rows.forEach(function (row) {
                var rowYear = normalizeAcademicYear(row.academic_year || row.schoolYear || row.year || row.school_year || null);
                if (rowYear) touchedYearsMap[rowYear] = true;
            });
            var touchedYears = Object.keys(touchedYearsMap);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                function continueWithInsert() {
                    var stmt = db.prepare(`INSERT OR REPLACE INTO results 
                        (student_name, student_id, dob, pob, gender, is_repeater, level, class, stream, trimester, marks, average, averages, activity_test_avg, decision, extra_data, academic_year, updated_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))`);

                    var knownCols = ['id', 'student_name', 'student_id', 'name', 'dob', 'pob', 'gender',
                        'is_repeater', 'isRepeater', 'level', 'class', 'stream',
                        'trimester', 'marks', 'average', 'averages', 'activity_test_avg', 'decision',
                        'academic_year', 'schoolYear', 'year', 'school_year',
                        'created_at', 'updated_at'];

                    var i = 0;
                    function next() {
                        if (i >= rows.length) {
                            stmt.finalize();
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('[SQLite] db-save-results commit error:', err.message);
                                    db.run('ROLLBACK');
                                    resolve(false);
                                } else {
                                    resolve(true);
                                }
                            });
                            return;
                        }
                        var r = rows[i++];
                        var extra = {};
                        var hasExtra = false;
                        for (var k in r) {
                            if (r.hasOwnProperty(k) && knownCols.indexOf(k) === -1 && k !== 'extra_data') {
                                extra[k] = r[k];
                                hasExtra = true;
                            }
                        }

                        stmt.run([
                            r.name || r.student_name || '',
                            r.student_id || null,
                            r.dob || null,
                            r.pob || null,
                            r.gender || null,
                            (r.isRepeater || r.is_repeater) ? 1 : 0,
                            normalizeLevelStorageValue(r.level || null),
                            normalizeClassNumberValue(r.class || r.class_number || null),
                            r.stream || null,
                            r.trimester || null,
                            typeof r.marks === 'object' ? JSON.stringify(r.marks) : (r.marks || '{}'),
                            r.average || 0,
                            typeof r.averages === 'object' ? JSON.stringify(r.averages) : (r.averages || '{}'),
                            r.activity_test_avg || null,
                            r.decision || '-',
                            hasExtra ? JSON.stringify(extra) : (r.extra_data || null),
                            normalizeAcademicYear(r.academic_year || r.schoolYear || r.year || r.school_year || null)
                        ], (err) => {
                            if (err) {
                                console.error('[SQLite] insert error at results:', err.message);
                                db.run('ROLLBACK');
                                resolve(false);
                            } else {
                                next();
                            }
                        });
                    }
                    next();
                }

                if (touchedYears.length === 0) {
                    continueWithInsert();
                    return;
                }

                var deleteIndex = 0;
                function deleteNextYear() {
                    if (deleteIndex >= touchedYears.length) {
                        continueWithInsert();
                        return;
                    }
                    db.run('DELETE FROM results WHERE academic_year = ?', [touchedYears[deleteIndex++]], function (err) {
                        if (err) {
                            console.error('[SQLite] delete-year error:', err.message);
                            db.run('ROLLBACK');
                            resolve(false);
                        } else {
                            deleteNextYear();
                        }
                    });
                }
                deleteNextYear();
            });
        });
    });
});

ipcMain.handle('db-get-annual-results', function (event, options) {
    return new Promise((resolve) => {
        if (!db) return resolve([]);

        var academicYear = (options && typeof options === 'object') ? options.academicYear : null;

        var sql = 'SELECT * FROM annual_results';
        var params = [];
        if (academicYear) {
            sql += ' WHERE academic_year = ?';
            params.push(academicYear);
        }
        sql += ' ORDER BY level, class_name, last_name, first_name, id';

        db.all(sql, params, (err, rows) => {
            if (err || !rows) {
                console.error('[SQLite] db-get-annual-results error:', err ? err.message : 'No rows');
                resolve([]);
                return;
            }

            rows.forEach(function (row) {
                hydrateAnnualResultRow(row);
            });

            resolve(rows);
        });
    });
});

ipcMain.handle('db-save-annual-results', function (event, payload) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);

            var rows = Array.isArray(payload) ? payload : ((payload && Array.isArray(payload.rows)) ? payload.rows : []);
            var providedYear = payload && typeof payload === 'object'
                ? normalizeAcademicYear(payload.academicYear || payload.year || payload.schoolYear || payload.school_year || null)
                : null;
            var replaceExisting = !(payload && typeof payload === 'object' && payload.replaceExisting === false);

            var touchedYearsMap = {};
            rows.forEach(function (row) {
                var rowYear = normalizeAcademicYear(
                    (row && (row.academic_year || row.schoolYear || row.year || row.school_year)) || providedYear || null
                );
                if (rowYear) touchedYearsMap[rowYear] = true;
            });
            if (providedYear) touchedYearsMap[providedYear] = true;
            var touchedYears = Object.keys(touchedYearsMap);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                function rollbackAndResolve() {
                    db.run('ROLLBACK');
                    resolve(false);
                }

                function continueWithInsert() {
                    var stmt = db.prepare(`INSERT OR REPLACE INTO annual_results
                        (student_id, academic_year, last_name, first_name, gender, birth_date, birth_year, level, class_name, stream, t1_avg, t2_avg, t3_avg, annual_avg, decision, source_file, extra_data, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))`);

                    var knownCols = [
                        'id', 'record_id', 'student_id',
                        'last_name', 'lastName', 'first_name', 'firstName',
                        'gender', 'birth_date', 'birthDate', 'birth_year', 'birthYear',
                        'level', 'class_name', 'className', 'squad', 'stream',
                        't1_avg', 't1', 't2_avg', 't2', 't3_avg', 't3', 'annual_avg', 'annualAvg',
                        'decision', 'source_file', 'sourceFile',
                        'academic_year', 'schoolYear', 'year', 'school_year',
                        'created_at', 'updated_at'
                    ];

                    var i = 0;
                    function next() {
                        if (i >= rows.length) {
                            stmt.finalize();
                            db.run('COMMIT', function (err) {
                                if (err) {
                                    console.error('[SQLite] db-save-annual-results commit error:', err.message);
                                    db.run('ROLLBACK');
                                    resolve(false);
                                } else {
                                    resolve(true);
                                }
                            });
                            return;
                        }

                        var row = rows[i++] || {};
                        var extra = {};
                        var hasExtra = false;
                        for (var k in row) {
                            if (row.hasOwnProperty(k) && knownCols.indexOf(k) === -1 && k !== 'extra_data') {
                                extra[k] = row[k];
                                hasExtra = true;
                            }
                        }

                        var lastName = row.last_name || row.lastName || '';
                        var firstName = row.first_name || row.firstName || '';
                        var fullName = (row.fullName || '').trim();
                        if (!lastName && !firstName && fullName) {
                            lastName = fullName;
                            firstName = '';
                        }

                        var rowYear = normalizeAcademicYear(
                            row.academic_year || row.schoolYear || row.year || row.school_year || providedYear || null
                        );
                        var levelNum = row.level === null || row.level === undefined || row.level === ''
                            ? null
                            : parseInt(row.level, 10);
                        if (isNaN(levelNum)) levelNum = null;

                        stmt.run([
                            row.student_id || row.id || null,
                            rowYear,
                            lastName,
                            firstName,
                            row.gender || null,
                            row.birth_date || row.birthDate || null,
                            row.birth_year || row.birthYear || null,
                            levelNum,
                            row.class_name || row.className || row.squad || null,
                            row.stream || null,
                            parseFloat(row.t1_avg !== undefined ? row.t1_avg : row.t1) || 0,
                            parseFloat(row.t2_avg !== undefined ? row.t2_avg : row.t2) || 0,
                            parseFloat(row.t3_avg !== undefined ? row.t3_avg : row.t3) || 0,
                            parseFloat(row.annual_avg !== undefined ? row.annual_avg : row.annualAvg) || 0,
                            row.decision || '-',
                            row.source_file || row.sourceFile || null,
                            hasExtra ? JSON.stringify(extra) : (row.extra_data || null)
                        ], function (err) {
                            if (err) {
                                console.error('[SQLite] db-save-annual-results insert error:', err.message);
                                rollbackAndResolve();
                            } else {
                                next();
                            }
                        });
                    }

                    next();
                }

                if (!replaceExisting) {
                    continueWithInsert();
                    return;
                }

                if (touchedYears.length === 0) {
                    db.run('DELETE FROM annual_results', function (deleteErr) {
                        if (deleteErr) {
                            console.error('[SQLite] db-save-annual-results delete error:', deleteErr.message);
                            rollbackAndResolve();
                        } else {
                            continueWithInsert();
                        }
                    });
                    return;
                }

                var deleteIndex = 0;
                function deleteNextYear() {
                    if (deleteIndex >= touchedYears.length) {
                        continueWithInsert();
                        return;
                    }

                    db.run('DELETE FROM annual_results WHERE academic_year = ?', [touchedYears[deleteIndex++]], function (deleteErr) {
                        if (deleteErr) {
                            console.error('[SQLite] db-save-annual-results delete-year error:', deleteErr.message);
                            rollbackAndResolve();
                        } else {
                            deleteNextYear();
                        }
                    });
                }

                deleteNextYear();
            });
        });
    });
});

ipcMain.handle('db-clear-annual-results', function (event, options) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);

            var academicYear = (options && typeof options === 'object') ? normalizeAcademicYear(options.academicYear || null) : null;
            var className = (options && typeof options === 'object') ? options.className : null;
            var level = (options && typeof options === 'object') ? options.level : null;

            var conditions = [];
            var params = [];

            if (academicYear) {
                conditions.push('academic_year = ?');
                params.push(academicYear);
            }
            if (className) {
                conditions.push('class_name = ?');
                params.push(className);
            }
            if (level !== null && level !== undefined && level !== '') {
                conditions.push('level = ?');
                params.push(parseInt(level, 10));
            }

            var sql = 'DELETE FROM annual_results';
            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            db.run(sql, params, function (err) {
                if (err) {
                    console.error('[SQLite] db-clear-annual-results error:', err.message);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    });
});

// ---- Teachers Table Operations ----

ipcMain.handle('db-get-teachers', function (event, options) {
    return new Promise((resolve) => {
        if (!db) return resolve([]);

        var academicYear = (options && typeof options === 'object') ? options.academicYear : null;

        var sql = 'SELECT * FROM teachers';
        var params = [];
        if (academicYear) {
            sql += ' WHERE academic_year = ?';
            params.push(academicYear);
        }
        sql += ' ORDER BY last_name, first_name';

        db.all(sql, params, (err, rows) => {
            if (err || !rows) {
                console.error('[SQLite] db-get-teachers error:', err ? err.message : 'No rows');
                resolve([]);
                return;
            }

            rows.forEach(row => {
                row.isExempt = !!row.is_exempt;
                row.isSubjectResponsible = !!row.is_subject_responsible;
                // Parse JSON fields
                if (row.responsible_classes) {
                    try { row.responsibleClasses = JSON.parse(row.responsible_classes); } catch (e) { row.responsibleClasses = []; }
                } else {
                    row.responsibleClasses = [];
                }
                if (row.reception_hours) {
                    try { row.receptionHours = JSON.parse(row.reception_hours); } catch (e) { row.receptionHours = []; }
                } else {
                    row.receptionHours = [];
                }
                // Parse extra_data
                if (row.extra_data) {
                    try {
                        var extra = JSON.parse(row.extra_data);
                        Object.assign(row, extra);
                    } catch (e) { }
                }
                delete row.extra_data;
                delete row.is_exempt;
                delete row.is_subject_responsible;
                delete row.responsible_classes;
                delete row.reception_hours;
            });

            resolve(rows);
        });
    });
});

ipcMain.handle('db-save-teachers', function (event, teachers) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // UPSERT approach: track incoming IDs, then delete orphans
                db.run('CREATE TEMP TABLE IF NOT EXISTS _teacher_ids (id TEXT PRIMARY KEY)');
                db.run('DELETE FROM _teacher_ids');

                var stmt = db.prepare('INSERT OR REPLACE INTO teachers (id, last_name, first_name, rank, subject, is_exempt, is_subject_responsible, responsible_classes, reception_hours, extra_data, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                var stmtTrack = db.prepare('INSERT OR IGNORE INTO _teacher_ids (id) VALUES (?)');

                var i = 0;
                function next() {
                    if (i >= teachers.length) {
                        stmt.finalize();
                        stmtTrack.finalize();

                        // Delete teachers not in the incoming set
                        db.run('DELETE FROM teachers WHERE id NOT IN (SELECT id FROM _teacher_ids)', function (err) {
                            if (err) console.warn('[SQLite] teacher orphan cleanup:', err.message);

                            db.run('DROP TABLE IF EXISTS _teacher_ids');
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('[SQLite] db-save-teachers commit error:', err.message);
                                    db.run('ROLLBACK');
                                    resolve(false);
                                } else {
                                    resolve(true);
                                }
                            });
                        });
                        return;
                    }
                    var t = teachers[i++];
                    var extra = {};
                    var hasExtra = false;
                    var knownCols = ['id', 'last_name', 'first_name', 'rank', 'subject', 'is_exempt', 'is_subject_responsible', 'responsible_classes', 'reception_hours', 'academic_year'];
                    for (var k in t) {
                        if (t.hasOwnProperty(k) && knownCols.indexOf(k) === -1 && k !== 'extra_data') {
                            extra[k] = t[k];
                            hasExtra = true;
                        }
                    }

                    var teacherId = t.id || ('t_' + Date.now() + '_' + i);
                    stmtTrack.run([teacherId]);
                    stmt.run([
                        teacherId,
                        t.last_name || '',
                        t.first_name || '',
                        t.rank || null,
                        t.subject || null,
                        (t.isExempt || t.is_exempt) ? 1 : 0,
                        (t.isSubjectResponsible || t.is_subject_responsible) ? 1 : 0,
                        typeof t.responsibleClasses === 'object' ? JSON.stringify(t.responsibleClasses) : (t.responsible_classes || '[]'),
                        typeof t.receptionHours === 'object' ? JSON.stringify(t.receptionHours) : (t.reception_hours || '[]'),
                        hasExtra ? JSON.stringify(extra) : (t.extra_data || null),
                        normalizeAcademicYear(t.academic_year || t.schoolYear || t.year || t.school_year || null)
                    ], (err) => {
                        if (err) {
                            console.error('[SQLite] insert error at teachers:', err.message);
                            db.run('ROLLBACK');
                            resolve(false);
                        } else {
                            next();
                        }
                    });
                }
                next();
            });
        });
    });
});

// ---- Exam Proctors Table Operations ----

ipcMain.handle('db-get-exam-proctors', function (event, options) {
    return new Promise((resolve) => {
        if (!db) return resolve([]);

        var academicYear = (options && typeof options === 'object') ? options.academicYear : null;

        var sql = 'SELECT * FROM exam_proctors';
        var params = [];
        if (academicYear) {
            sql += ' WHERE academic_year = ?';
            params.push(academicYear);
        }
        sql += ' ORDER BY last_name, first_name';

        db.all(sql, params, (err, rows) => {
            if (err || !rows) {
                console.error('[SQLite] db-get-exam-proctors error:', err ? err.message : 'No rows');
                resolve([]);
                return;
            }
            resolve(rows);
        });
    });
});

ipcMain.handle('db-save-exam-proctors', function (event, proctors) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run('DELETE FROM exam_proctors');

                var stmt = db.prepare('INSERT OR REPLACE INTO exam_proctors (id, last_name, first_name, birth_date, gender, subject, rank, institution, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

                var i = 0;
                function next() {
                    if (i >= proctors.length) {
                        stmt.finalize();
                        db.run('COMMIT', (err) => {
                            if (err) {
                                console.error('[SQLite] db-save-exam-proctors commit error:', err.message);
                                db.run('ROLLBACK');
                                resolve(false);
                            } else {
                                resolve(true);
                            }
                        });
                        return;
                    }
                    var p = proctors[i++];
                    
                    stmt.run([
                        p.id || ('p_' + Date.now() + '_' + i),
                        p.last_name || '',
                        p.first_name || '',
                        p.birth_date || null,
                        p.gender || null,
                        p.subject || null,
                        p.rank || null,
                        p.institution || null,
                        normalizeAcademicYear(p.academic_year || p.schoolYear || p.year || p.school_year || null)
                    ], (err) => {
                        if (err) {
                            console.error('[SQLite] insert error at exam_proctors:', err.message);
                            db.run('ROLLBACK');
                            resolve(false);
                        } else {
                            next();
                        }
                    });
                }
                next();
            });
        });
    });
});

// ---- Activity Evaluations Table Operations ----

ipcMain.handle('db-get-activity-evals', function (event, options) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve([]);

            var academicYear = (options && typeof options === 'object') ? options.academicYear : null;
            var trimester = (options && typeof options === 'object') ? options.trimester : null;

            var conditions = [];
            var params = [];

            if (academicYear) {
                conditions.push('academic_year = ?');
                params.push(academicYear);
            }
            if (trimester) {
                conditions.push('trimester = ?');
                params.push(trimester);
            }

            var sql = 'SELECT * FROM activity_evaluations';
            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            db.all(sql, params, (err, rows) => {
                if (err || !rows) {
                    console.error('[SQLite] db-get-activity-evals error:', err ? err.message : 'No rows');
                    resolve([]);
                    return;
                }
                rows.forEach(function (row) {
                    row.level = normalizeLevelStorageValue(row.level || null);
                    row.class_number = normalizeClassNumberValue(row.class_number || row.class || null);
                });
                resolve(rows);
            });
        });
    });
});

ipcMain.handle('db-save-activity-evals', function (event, records) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                var stmt = db.prepare(`INSERT OR REPLACE INTO activity_evaluations 
                    (student_id, student_name, academic_year, trimester, level, class_number, subject, eval_mark, assignment_mark, test_mark, extra_data, updated_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))`);

                var i = 0;
                function next() {
                    if (i >= records.length) {
                        stmt.finalize();
                        db.run('COMMIT', (err) => {
                            if (err) {
                                console.error('[SQLite] db-save-activity-evals commit error:', err.message);
                                db.run('ROLLBACK');
                                resolve(false);
                            } else {
                                resolve(true);
                            }
                        });
                        return;
                    }
                    var r = records[i++];

                    // Allow nulls for missing marks
                    var parseMark = (m) => (m === null || m === undefined || m === '') ? null : parseFloat(m);

                    var knownCols = ['student_id', 'student_name', 'academic_year', 'schoolYear', 'year', 'school_year',
                        'trimester', 'level', 'class_number', 'subject',
                        'eval_mark', 'assignment_mark', 'test_mark'];
                    var extra = {};
                    var hasExtra = false;
                    for (var k in r) {
                        if (r.hasOwnProperty(k) && knownCols.indexOf(k) === -1) {
                            extra[k] = r[k];
                            hasExtra = true;
                        }
                    }

                    stmt.run([
                        (r.student_id === null || r.student_id === undefined || r.student_id === '') ? null : String(r.student_id),
                        r.student_name,
                        normalizeAcademicYear(r.academic_year || r.schoolYear || r.year || r.school_year || null),
                        r.trimester,
                        normalizeLevelStorageValue(r.level || null),
                        normalizeClassNumberValue(r.class_number || r.class || null),
                        r.subject,
                        parseMark(r.eval_mark),
                        parseMark(r.assignment_mark),
                        parseMark(r.test_mark),
                        hasExtra ? JSON.stringify(extra) : null
                    ], (err) => {
                        if (err) {
                            console.error('[SQLite] insert error at activity_evaluations:', err.message);
                            db.run('ROLLBACK');
                            resolve(false);
                        } else {
                            next();
                        }
                    });
                }
                next();
            });
        });
    });
});

ipcMain.handle('db-clear-activity-evals', function (event, options) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);

            var academicYear = (options && typeof options === 'object') ? options.academicYear : null;
            var trimester = (options && typeof options === 'object') ? options.trimester : null;
            var subject = (options && typeof options === 'object') ? options.subject : null;

            var conditions = [];
            var params = [];

            if (academicYear) { conditions.push('academic_year = ?'); params.push(academicYear); }
            if (trimester) { conditions.push('trimester = ?'); params.push(trimester); }
            if (subject) { conditions.push('subject = ?'); params.push(subject); }

            var sql = 'DELETE FROM activity_evaluations';
            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            db.run(sql, params, (err) => {
                if (err) {
                    console.error('[SQLite] db-clear-activity-evals error:', err.message);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    });
});

// ---- Clear All Data ----
};
