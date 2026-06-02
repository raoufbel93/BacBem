const fs = require('fs');
const path = require('path');

module.exports = function (context) {
    var app = context.app;
    var ipcMain = context.ipcMain;
    var queueDBTask = context.queueDBTask;
    var db = context.getDb();
    var dialog = context.dialog;

/**
 * Clear ALL data (Factory Reset)
 */
ipcMain.handle('db-clear-all', function (event) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run('DELETE FROM students');
                db.run('DELETE FROM results');
                db.run('DELETE FROM teachers');
                db.run('DELETE FROM activity_evaluations');
                db.run('DELETE FROM student_absences');
                db.run('DELETE FROM teacher_absences');
                db.run('DELETE FROM supervisor_absences');
                db.run('DELETE FROM canteen_absences');
                db.run('DELETE FROM teacher_message_logs');
                db.run('DELETE FROM daily_reports');
                db.run('DELETE FROM exam_proctors');
                db.run('DELETE FROM official_exam_center');
                db.run('DELETE FROM settings'); // KV table
                db.run('COMMIT', (err) => {
                    resolve(!err);
                });
            });
        });
    });
});

/**
 * Deduplicate all tables after migration
 * Removes duplicate rows keeping only the most recent one (highest id)
 * Returns a report: { table: removedCount, ... }
 */
ipcMain.handle('db-deduplicate', function (event) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve({ error: 'No database' });

            var report = {};
            var deduplicationQueries = [
                {
                    table: 'students',
                    sql: `DELETE FROM students WHERE id NOT IN (
                        SELECT MAX(id) FROM students
                        GROUP BY last_name, first_name, birth_date, level, class_number, academic_year
                    )`
                },
                {
                    table: 'results',
                    sql: `DELETE FROM results WHERE id NOT IN (
                        SELECT MAX(id) FROM results
                        GROUP BY student_name, dob, level, class, stream, trimester, academic_year
                    )`
                },
                {
                    table: 'activity_evaluations',
                    sql: `DELETE FROM activity_evaluations WHERE id NOT IN (
                        SELECT MAX(id) FROM activity_evaluations
                        GROUP BY student_id, subject, trimester, academic_year
                    )`
                },
                {
                    table: 'student_absences',
                    sql: `DELETE FROM student_absences WHERE id NOT IN (
                        SELECT MAX(id) FROM student_absences
                        GROUP BY student_id, absence_date, period
                    )`
                },
                {
                    table: 'teacher_absences',
                    sql: `DELETE FROM teacher_absences WHERE id NOT IN (
                        SELECT MAX(id) FROM teacher_absences
                        GROUP BY teacher_id, absence_date, period
                    )`
                },
                {
                    table: 'supervisor_absences',
                    sql: `DELETE FROM supervisor_absences WHERE id NOT IN (
                        SELECT MAX(id) FROM supervisor_absences
                        GROUP BY supervisor_id, absence_date, period
                    )`
                },
                {
                    table: 'canteen_absences',
                    sql: `DELETE FROM canteen_absences WHERE id NOT IN (
                        SELECT MAX(id) FROM canteen_absences
                        GROUP BY student_id, absence_date
                    )`
                }
            ];

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                var idx = 0;
                function runNext() {
                    if (idx >= deduplicationQueries.length) {
                        db.run('COMMIT', (err) => {
                            if (err) {
                                console.error('[Dedup] Commit error:', err.message);
                                db.run('ROLLBACK');
                                resolve({ error: err.message });
                            } else {
                                console.log('[Dedup] Completed. Report:', JSON.stringify(report));
                                resolve(report);
                            }
                        });
                        return;
                    }

                    var q = deduplicationQueries[idx++];
                    db.run(q.sql, function (err) {
                        if (err) {
                            console.warn('[Dedup] Error on ' + q.table + ':', err.message);
                            report[q.table] = { error: err.message };
                        } else {
                            var removed = this.changes || 0;
                            report[q.table] = removed;
                            if (removed > 0) {
                                console.log('[Dedup] Removed ' + removed + ' duplicates from ' + q.table);
                            }
                        }
                        runNext();
                    });
                }

                runNext();
            });
        });
    });
});

// ============================================================
// PDF Form Parsing & Student Data Merge
// ============================================================

ipcMain.handle('parse-pdf-forms', function (event, folderPath) {
    return new Promise(async (resolve) => {
        try {
            var parserCandidates = [
                path.join(app.getAppPath(), 'A-data', 'pdf_parser.js'),
                path.join(app.getAppPath(), 'A-data', '_dev_archive', 'pdf_parser.js')
            ];
            var parserPath = parserCandidates.find(function (candidate) {
                return fs.existsSync(candidate);
            });

            if (!parserPath) {
                throw new Error('pdf_parser.js not found');
            }

            const pdfParser = require(parserPath);
            const result = await pdfParser.parsePdfFolder(folderPath, (current, total, fileName) => {
                // Send progress to renderer
                if (event.sender && !event.sender.isDestroyed()) {
                    event.sender.send('pdf-parse-progress', { current, total, fileName });
                }
            });
            resolve(result);
        } catch (err) {
            console.error('[PDF Parse] Error:', err.message);
            resolve({ students: [], total: 0, parsed: 0, failed: 0, error: err.message });
        }
    });
});

ipcMain.handle('merge-students-from-pdf', function (event, pdfStudents) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db || !Array.isArray(pdfStudents) || pdfStudents.length === 0) {
                return resolve({ updated: 0, notFound: 0, errors: 0, details: [] });
            }

            var updated = 0;
            var notFound = 0;
            var errors = 0;
            var details = [];

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                var idx = 0;
                function processNext() {
                    if (idx >= pdfStudents.length) {
                        db.run('COMMIT', (err) => {
                            if (err) {
                                console.error('[Merge] Commit error:', err.message);
                                db.run('ROLLBACK');
                                resolve({ updated, notFound, errors, details, error: err.message });
                            } else {
                                resolve({ updated, notFound, errors, details });
                            }
                        });
                        return;
                    }

                    // Periodic yield to maintain responsiveness
                    if (idx > 0 && idx % 20 === 0) {
                        setTimeout(doStep, 1);
                    } else {
                        doStep();
                    }

                    function doStep() {
                        var pdfStudent = pdfStudents[idx++];
                        var regNumber = (pdfStudent.reg_number && typeof pdfStudent.reg_number === 'string') ? pdfStudent.reg_number.trim() : pdfStudent.reg_number;

                        if (!regNumber) {
                            notFound++;
                            details.push({ name: pdfStudent.last_name || '?', status: 'no_id' });
                            processNext();
                            return;
                        }

                        // Find matching student by national_id OR reg_number
                        db.get('SELECT * FROM students WHERE national_id = ? OR reg_number = ?', [regNumber, regNumber], (err, existing) => {
                            if (err) {
                                errors++;
                                details.push({ name: pdfStudent.last_name || regNumber, status: 'error', message: err.message });
                                processNext();
                                return;
                            }

                            if (!existing) {
                                notFound++;
                                details.push({ name: (pdfStudent.last_name || '') + ' ' + (pdfStudent.first_name || ''), reg: regNumber, status: 'not_found' });
                                processNext();
                                return;
                            }

                            // Build the merge: only update non-null PDF values into empty/null existing fields
                            var existingExtra = {};
                            if (existing.extra_data) {
                                try { existingExtra = JSON.parse(existing.extra_data); } catch (e) { }
                            }

                            // Fields to merge into main columns (only if existing is empty)
                            var mainUpdates = {};
                            if (pdfStudent.father_name && !existing.father_name) mainUpdates.father_name = pdfStudent.father_name;
                            if (pdfStudent.mother_name && !existing.mother_name) mainUpdates.mother_name = pdfStudent.mother_name;
                            if (pdfStudent.pob && !existing.pob) mainUpdates.pob = pdfStudent.pob;
                            if (pdfStudent.gender && !existing.gender) mainUpdates.gender = pdfStudent.gender;
                            
                            // Also ensure reg_number is filled if it's currently null
                            if (regNumber && !existing.reg_number) mainUpdates.reg_number = regNumber;
                            if (regNumber && !existing.national_id) mainUpdates.national_id = regNumber;

                            // Fields to merge into extra_data JSON
                            var extraUpdates = {};
                            // Family info
                            if (pdfStudent.siblings_total != null && !existingExtra.siblings_total) extraUpdates.siblings_total = pdfStudent.siblings_total;
                            if (pdfStudent.siblings_female != null && !existingExtra.siblings_female) extraUpdates.siblings_female = pdfStudent.siblings_female;
                            if (pdfStudent.school_siblings_total != null && !existingExtra.school_siblings_total) extraUpdates.school_siblings_total = pdfStudent.school_siblings_total;
                            if (pdfStudent.school_siblings_female != null && !existingExtra.school_siblings_female) extraUpdates.school_siblings_female = pdfStudent.school_siblings_female;
                            if (pdfStudent.is_orphan != null && existingExtra.is_orphan == null) extraUpdates.is_orphan = pdfStudent.is_orphan;

                            // Guardian info - with validation
                            if (pdfStudent.guardian_address && !existingExtra.guardian_address) extraUpdates.guardian_address = pdfStudent.guardian_address;
                            if (pdfStudent.guardian_phone && !existingExtra.guardian_phone) {
                                if (/^0[5-7]\d{8}$/.test(pdfStudent.guardian_phone)) {
                                    extraUpdates.guardian_phone = pdfStudent.guardian_phone;
                                }
                            }
                            if (pdfStudent.guardian_email && !existingExtra.guardian_email) {
                                if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(pdfStudent.guardian_email)) {
                                    extraUpdates.guardian_email = pdfStudent.guardian_email;
                                }
                            }

                            // Health info
                            if (pdfStudent.has_disability != null && existingExtra.has_disability == null) extraUpdates.has_disability = pdfStudent.has_disability;
                            if (pdfStudent.disability_type && !existingExtra.disability_type) extraUpdates.disability_type = pdfStudent.disability_type;

                            // French names
                            if (pdfStudent.last_name_fr && !existingExtra.last_name_fr) extraUpdates.last_name_fr = pdfStudent.last_name_fr;
                            if (pdfStudent.first_name_fr && !existingExtra.first_name_fr) extraUpdates.first_name_fr = pdfStudent.first_name_fr;

                            // Check if anything to update
                            var hasMainUpdates = Object.keys(mainUpdates).length > 0;
                            var hasExtraUpdates = Object.keys(extraUpdates).length > 0;

                            if (!hasMainUpdates && !hasExtraUpdates) {
                                details.push({ name: existing.last_name + ' ' + existing.first_name, reg: regNumber, status: 'no_change' });
                                processNext();
                                return;
                            }

                            // Build SQL UPDATE
                            var setClauses = [];
                            var params = [];
                            for (var key in mainUpdates) {
                                setClauses.push(key + ' = ?');
                                params.push(mainUpdates[key]);
                            }
                            if (hasExtraUpdates) {
                                var mergedExtra = Object.assign({}, existingExtra, extraUpdates);
                                setClauses.push('extra_data = ?');
                                params.push(JSON.stringify(mergedExtra));
                            }
                            setClauses.push("updated_at = datetime('now')");
                            var sql = 'UPDATE students SET ' + setClauses.join(', ') + ' WHERE id = ?';
                            params.push(existing.id);

                            db.run(sql, params, function (err) {
                                if (err) {
                                    errors++;
                                    details.push({ name: existing.last_name + ' ' + existing.first_name, reg: regNumber, status: 'error', message: err.message });
                                } else {
                                    updated++;
                                    var fieldsUpdated = Object.keys(mainUpdates).concat(Object.keys(extraUpdates));
                                    details.push({ name: existing.last_name + ' ' + existing.first_name, reg: regNumber, status: 'updated', fields: fieldsUpdated });
                                }
                                processNext();
                            });
                        });
                    }
                }

                processNext();
            });
        });
    });
});
ipcMain.handle('select-pdf-folder', function (event) {
    return dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'ط§ط®طھط± ظ…ط¬ظ„ط¯ ط§ظ„ط§ط³طھظ…ط§ط±ط§طھ'
    }).then(function (result) {
        if (result.canceled || !result.filePaths.length) return null;
        return result.filePaths[0];
    });
});
};


