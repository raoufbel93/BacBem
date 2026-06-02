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


ipcMain.handle('db-get-students', function (event, options) {
    return new Promise((resolve) => {
        if (!db) return resolve([]);

        // Backward compatibility: if options is boolean, treat as includeStruckOff
        var includeStruckOff = (typeof options === 'boolean') ? options : (options && options.includeStruckOff);
        var academicYear = (options && typeof options === 'object') ? options.academicYear : null;

        var conditions = [];
        var params = [];

        if (!includeStruckOff) {
            conditions.push('struck_off = 0');
        }
        if (academicYear) {
            conditions.push('academic_year = ?');
            params.push(academicYear);
        }

        var whereClause = conditions.length > 0 ? (' WHERE ' + conditions.join(' AND ')) : '';
        var sql = 'SELECT * FROM students' + whereClause + ' ORDER BY level, class_number, last_name';

        db.all(sql, params, (err, rows) => {
            if (err || !rows) {
                console.error('[SQLite] db-get-students error:', err ? err.message : 'No rows');
                resolve([]);
                return;
            }

            rows.forEach(row => {
                hydrateStudentRow(row);
            });
            resolve(rows);
        });
    });
});

ipcMain.handle('db-save-students', function (event, students) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // UPSERT approach: track incoming IDs, then delete orphans
                db.run('CREATE TEMP TABLE IF NOT EXISTS _student_ids (id TEXT PRIMARY KEY)');
                db.run('DELETE FROM _student_ids');

                var stmt = db.prepare('INSERT OR REPLACE INTO students (id, reg_number, national_id, last_name, first_name, gender, birth_date, pob, level, class_number, stream, subgroup, status, is_repeater, father_name, mother_name, scholarship_confirmed, struck_off, observation, extra_data, academic_year, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))');
                var stmtTrack = db.prepare('INSERT OR IGNORE INTO _student_ids (id) VALUES (?)');

                var knownCols = ['id', 'reg_number', 'national_id', 'last_name', 'first_name',
                    'gender', 'birth_date', 'pob', 'level', 'class_number', 'stream',
                    'subgroup', 'status', 'is_repeater', 'father_name', 'mother_name',
                    'scholarship_confirmed', 'struck_off', 'observation', 'academic_year'];

                var i = 0;
                function next() {
                    if (i >= students.length) {
                        stmt.finalize();
                        stmtTrack.finalize();

                        // Delete students not in the incoming set
                        db.run('DELETE FROM students WHERE id NOT IN (SELECT id FROM _student_ids)', function (err) {
                            if (err) console.warn('[SQLite] student orphan cleanup:', err.message);

                            db.run('DROP TABLE IF EXISTS _student_ids');
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('[SQLite] db-save-students commit error:', err.message);
                                    db.run('ROLLBACK');
                                    resolve(false);
                                } else {
                                    resolve(true);
                                }
                            });
                        });
                        return;
                    }
                    var s = students[i++];
                    var extra = {};
                    var hasExtra = false;
                    for (var k in s) {
                        if (s.hasOwnProperty(k) && knownCols.indexOf(k) === -1 && k !== 'extra_data' && k !== 'created_at' && k !== 'updated_at') {
                            extra[k] = s[k];
                            hasExtra = true;
                        }
                    }

                    var studentId = s.id || ('s_' + Date.now() + '_' + i);
                    stmtTrack.run([studentId]);
                    stmt.run([
                        studentId,
                        s.reg_number || null,
                        s.national_id || null,
                        s.last_name || '',
                        s.first_name || '',
                        s.gender || null,
                        s.birth_date || null,
                        s.pob || null,
                        normalizeLevelStorageValue(s.level || null),
                        normalizeClassNumberValue(s.class_number || s.class || null),
                        s.stream || null,
                        s.subgroup || null,
                        s.status || 'external',
                        s.is_repeater ? 1 : 0,
                        s.father_name || null,
                        s.mother_name || null,
                        s.scholarship_confirmed ? 1 : 0,
                        s.struck_off ? 1 : 0,
                        s.observation || null,
                        hasExtra ? JSON.stringify(extra) : (s.extra_data || null),
                        normalizeAcademicYear(s.academic_year || s.schoolYear || s.year || s.school_year || null)
                    ], (err) => {
                        if (err) {
                            console.error('[SQLite] insert error at students:', err.message);
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

ipcMain.handle('db-update-student', function (event, payload) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve({ success: false, error: 'database_unavailable' });

            var studentId = payload && payload.id ? String(payload.id) : '';
            var updates = (payload && payload.updates && typeof payload.updates === 'object') ? payload.updates : {};

            if (!studentId) {
                resolve({ success: false, error: 'missing_student_id' });
                return;
            }

            db.get('SELECT * FROM students WHERE id = ?', [studentId], (err, existing) => {
                if (err) {
                    console.error('[SQLite] db-update-student select error:', err.message);
                    resolve({ success: false, error: err.message });
                    return;
                }

                if (!existing) {
                    resolve({ success: false, error: 'student_not_found' });
                    return;
                }

                var mainColumns = [
                    'reg_number', 'national_id', 'last_name', 'first_name', 'gender', 'birth_date',
                    'pob', 'level', 'class_number', 'stream', 'subgroup', 'status', 'is_repeater',
                    'father_name', 'mother_name', 'scholarship_confirmed', 'struck_off', 'observation',
                    'academic_year'
                ];
                var aliasMap = {
                    'class': 'class_number',
                    'repeat': 'is_repeater',
                    'year': 'academic_year',
                    'schoolYear': 'academic_year',
                    'school_year': 'academic_year'
                };

                var mainUpdates = {};
                var extraUpdates = {};
                var existingExtra = {};

                if (existing.extra_data) {
                    try {
                        existingExtra = JSON.parse(existing.extra_data) || {};
                    } catch (e) { }
                }

                Object.keys(updates).forEach((key) => {
                    if (key === 'id' || key === 'created_at' || key === 'updated_at' || key === 'extra_data') {
                        return;
                    }

                    var mappedKey = aliasMap[key] || key;
                    var value = updates[key];

                    if (mainColumns.indexOf(mappedKey) !== -1) {
                        mainUpdates[mappedKey] = normalizeStudentColumnValue(mappedKey, value);
                    } else {
                        extraUpdates[key] = value;
                    }
                });

                var setClauses = [];
                var params = [];

                Object.keys(mainUpdates).forEach((key) => {
                    setClauses.push(key + ' = ?');
                    params.push(mainUpdates[key]);
                });

                if (Object.keys(extraUpdates).length > 0) {
                    var mergedExtra = Object.assign({}, existingExtra, extraUpdates);
                    setClauses.push('extra_data = ?');
                    params.push(JSON.stringify(mergedExtra));
                }

                if (setClauses.length === 0) {
                    var unchangedRow = hydrateStudentRow(Object.assign({}, existing));
                    resolve({ success: true, student: unchangedRow });
                    return;
                }

                setClauses.push("updated_at = datetime('now')");
                params.push(studentId);

                var sql = 'UPDATE students SET ' + setClauses.join(', ') + ' WHERE id = ?';
                db.run(sql, params, function (updateErr) {
                    if (updateErr) {
                        console.error('[SQLite] db-update-student update error:', updateErr.message);
                        resolve({ success: false, error: updateErr.message });
                        return;
                    }

                    db.get('SELECT * FROM students WHERE id = ?', [studentId], (fetchErr, updatedRow) => {
                        if (fetchErr) {
                            console.error('[SQLite] db-update-student fetch error:', fetchErr.message);
                            resolve({ success: false, error: fetchErr.message });
                            return;
                        }

                        resolve({ success: true, student: hydrateStudentRow(updatedRow) });
                    });
                });
            });
        });
    });
});

// ---- Results Table Operations ----
};

