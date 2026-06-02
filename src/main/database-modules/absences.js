module.exports = function (context) {
    var ipcMain = context.ipcMain;
    var queueDBTask = context.queueDBTask;
    var db = context.getDb();
    var dialog = context.dialog;
    var getAcademicYearFromDate = context.getAcademicYearFromDate;

function getReportPeriod() {
    return 'ALL';
}

function getStoredAcademicYear(date, providedYear) {
    return providedYear || getAcademicYearFromDate(date) || null;
}

function getSupervisorModeFromRow(row) {
    if (row && row.supervisor_mode) return row.supervisor_mode;
    if (row && row.period && row.period !== 'ALL') return row.period;
    return 'FULL';
}

// Absence Tracking IPC Handlers (Relational)
// ============================================================

/**
 * Save a full day's absences (students + teachers + supervisors)
 * The absence report is daily and always covers the full school day.
 */
ipcMain.handle('db-save-day-absences', function (event, data) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);
            var date = data.date;
            var period = getReportPeriod();
            var students = data.students || [];
            var teachers = data.teachers || [];
            var supervisors = data.supervisors || [];
            var academicYear = getStoredAcademicYear(date, data.academicYear);

            var reportNumber = data.report_number || null;

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Replace the entire daily report for this date, including any legacy split periods.
                db.run('DELETE FROM student_absences WHERE absence_date = ?', [date]);
                db.run('DELETE FROM teacher_absences WHERE absence_date = ?', [date]);
                db.run('DELETE FROM supervisor_absences WHERE absence_date = ?', [date]);
                db.run('DELETE FROM daily_reports WHERE absence_date = ?', [date]);

                // Insert into daily_reports (source of truth)
                db.run('INSERT INTO daily_reports (absence_date, period, report_number, academic_year) VALUES (?, ?, ?, ?)', [date, period, reportNumber, academicYear]);

                // Insert students
                if (students.length > 0) {
                    var stmtS = db.prepare('INSERT INTO student_absences (student_id, absence_date, period, am_from, am_to, pm_from, pm_to, reason, is_justified, academic_year, report_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                    students.forEach(function (s) {
                        var am = s.am || {};
                        var pm = s.pm || {};
                        stmtS.run([
                            String(s.id),
                            date,
                            period,
                            (am.from && am.from !== 'Present') ? am.from : null,
                            (am.to && am.to !== 'Present') ? am.to : null,
                            (pm.from && pm.from !== 'Present') ? pm.from : null,
                            (pm.to && pm.to !== 'Present') ? pm.to : null,
                            s.reason || '',
                            s.is_justified ? 1 : 0,
                            academicYear,
                            reportNumber
                        ]);
                    });
                    stmtS.finalize();
                }

                // Insert teachers
                if (teachers.length > 0) {
                    var stmtT = db.prepare('INSERT INTO teacher_absences (teacher_id, absence_date, period, type, reason, hours, late_duration, periods_json, academic_year, report_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                    teachers.forEach(function (t) {
                        stmtT.run([
                            t.id,
                            date,
                            period,
                            t.type || 'absence',
                            t.reason || '',
                            t.hours || 0,
                            t.lateDuration || 0,
                            t.periods ? JSON.stringify(t.periods) : null,
                            academicYear,
                            reportNumber
                        ]);
                    });
                    stmtT.finalize();
                }

                // Insert supervisors
                if (supervisors.length > 0) {
                    var stmtV = db.prepare('INSERT INTO supervisor_absences (supervisor_id, absence_date, period, supervisor_mode, reason, time_from, time_to, late_duration, academic_year, report_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                    supervisors.forEach(function (sv) {
                        stmtV.run([
                            sv.id,
                            date,
                            period,
                            sv.period || 'FULL',
                            sv.reason || '',
                            sv.from || null,
                            sv.to || null,
                            sv.lateDuration || '',
                            academicYear,
                            reportNumber
                        ]);
                    });
                    stmtV.finalize();
                }

                db.run('COMMIT', (err) => {
                    if (err) {
                        console.error('[SQLite] db-save-day-absences error:', err.message);
                        db.run('ROLLBACK');
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                });
            });
        });
    });
});

/**
 * Get absences for a specific date
 * Returns { date, period, students: [...], teachers: [...], supervisors: [...] }
 */
ipcMain.handle('db-get-day-absences', function (event, options) {
    return new Promise((resolve) => {
        if (!db) return resolve(null);
        var date = options.date;
        var period = getReportPeriod();

        Promise.all([
            new Promise((res) => {
                db.get("SELECT report_number, academic_year, created_at FROM daily_reports WHERE absence_date = ? ORDER BY CASE WHEN period = 'ALL' THEN 0 ELSE 1 END, created_at DESC LIMIT 1", [date], (err, row) => {
                    res(row || null);
                });
            }),
            new Promise((res) => {
                db.all('SELECT * FROM student_absences WHERE absence_date = ?', [date], (err, rows) => {
                    res(err ? [] : (rows || []));
                });
            }),
            new Promise((res) => {
                db.all('SELECT * FROM teacher_absences WHERE absence_date = ?', [date], (err, rows) => {
                    res(err ? [] : (rows || []));
                });
            }),
            new Promise((res) => {
                db.all('SELECT * FROM supervisor_absences WHERE absence_date = ?', [date], (err, rows) => {
                    res(err ? [] : (rows || []));
                });
            })
        ]).then(function (results) {
            var dailyReport = results[0];
            var reportNumber = dailyReport ? dailyReport.report_number : null;
            var students = results[1].map(function (r) {
                return {
                    id: r.student_id,
                    am: { from: r.am_from || 'Present', to: r.am_to || 'Present' },
                    pm: { from: r.pm_from || 'Present', to: r.pm_to || 'Present' },
                    reason: r.reason || '',
                    is_justified: !!r.is_justified
                };
            });
            var teachers = results[2].map(function (r) {
                var periods = null;
                if (r.periods_json) { try { periods = JSON.parse(r.periods_json); } catch (e) { periods = []; } }
                return {
                    id: r.teacher_id,
                    type: r.type,
                    reason: r.reason || '',
                    hours: r.hours || 0,
                    lateDuration: r.late_duration || 0,
                    periods: periods || []
                };
            });
            var supervisors = results[3].map(function (r) {
                return {
                    id: r.supervisor_id,
                    reason: r.reason || '',
                    period: getSupervisorModeFromRow(r),
                    from: r.time_from || '',
                    to: r.time_to || '',
                    lateDuration: r.late_duration || ''
                };
            });

            if (reportNumber === null && students.length === 0 && teachers.length === 0 && supervisors.length === 0) {
                resolve(null); // No record found
            } else {
                resolve({ date: date, period: period, students: students, teachers: teachers, supervisors: supervisors, report_number: reportNumber });
            }
        });
    });
});

/**
 * Get absences within a date range (for stats/reports)
 * Returns array of day records
 */
ipcMain.handle('db-get-absences-range', function (event, options) {
    return new Promise((resolve) => {
        if (!db) return resolve([]);
        var startDate = options.startDate;
        var endDate = options.endDate;

        // Get all unique dates in range. Reports are daily, not split by period.
        var sql = `SELECT DISTINCT absence_date FROM student_absences WHERE absence_date >= ? AND absence_date <= ?
                   UNION SELECT DISTINCT absence_date FROM teacher_absences WHERE absence_date >= ? AND absence_date <= ?
                   UNION SELECT DISTINCT absence_date FROM supervisor_absences WHERE absence_date >= ? AND absence_date <= ?
                   ORDER BY absence_date DESC`;

        db.all(sql, [startDate, endDate, startDate, endDate, startDate, endDate], (err, dates) => {
            if (err || !dates || dates.length === 0) return resolve([]);

            // For each date, gather the full daily report.
            var promises = dates.map(function (dp) {
                return new Promise((res2) => {
                    Promise.all([
                        new Promise((r) => { db.all('SELECT * FROM student_absences WHERE absence_date = ?', [dp.absence_date], (e, rows) => r(e ? [] : (rows || []))); }),
                        new Promise((r) => { db.all('SELECT * FROM teacher_absences WHERE absence_date = ?', [dp.absence_date], (e, rows) => r(e ? [] : (rows || []))); }),
                        new Promise((r) => { db.all('SELECT * FROM supervisor_absences WHERE absence_date = ?', [dp.absence_date], (e, rows) => r(e ? [] : (rows || []))); })
                    ]).then(function (results) {
                        res2({
                            date: dp.absence_date,
                            period: getReportPeriod(),
                            students: results[0].map(function (r) {
                                return { id: r.student_id, am: { from: r.am_from || 'Present', to: r.am_to || 'Present' }, pm: { from: r.pm_from || 'Present', to: r.pm_to || 'Present' }, reason: r.reason || '' };
                            }),
                            teachers: results[1].map(function (r) {
                                var p = null; if (r.periods_json) { try { p = JSON.parse(r.periods_json); } catch (e) { } }
                                return { id: r.teacher_id, type: r.type, reason: r.reason || '', hours: r.hours || 0, lateDuration: r.late_duration || 0, periods: p || [] };
                            }),
                            supervisors: results[2].map(function (r) {
                                return { id: r.supervisor_id, reason: r.reason || '', period: getSupervisorModeFromRow(r), from: r.time_from || '', to: r.time_to || '', lateDuration: r.late_duration || '' };
                            })
                        });
                    });
                });
            });

            Promise.all(promises).then(resolve);
        });
    });
});

/**
 * Get absences for a specific student (for consecutive days, correspondence)
 */
ipcMain.handle('db-get-student-absences', function (event, options) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve([]);
            var studentId = options.studentId;
            var conditions = ['student_id = ?'];
            var params = [String(studentId)];

            if (options.startDate) { conditions.push('absence_date >= ?'); params.push(options.startDate); }
            if (options.endDate) { conditions.push('absence_date <= ?'); params.push(options.endDate); }

            var sql = 'SELECT * FROM student_absences WHERE ' + conditions.join(' AND ') + ' ORDER BY absence_date DESC';
            db.all(sql, params, (err, rows) => {
                if (err || !rows) return resolve([]);
                resolve(rows.map(function (r) {
                    return {
                        date: r.absence_date,
                        period: r.period,
                        am: { from: r.am_from || 'Present', to: r.am_to || 'Present' },
                        pm: { from: r.pm_from || 'Present', to: r.pm_to || 'Present' },
                        reason: r.reason || '',
                        is_justified: !!r.is_justified
                    };
                }));
            });
        });
    });
});

/**
 * Delete absences for a specific date
 */
ipcMain.handle('db-delete-day-absences', function (event, options) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);
            var date = options.date;

            db.serialize(() => {
                db.run('DELETE FROM student_absences WHERE absence_date = ?', [date]);
                db.run('DELETE FROM teacher_absences WHERE absence_date = ?', [date]);
                db.run('DELETE FROM supervisor_absences WHERE absence_date = ?', [date]);
                db.run('DELETE FROM daily_reports WHERE absence_date = ?', [date], (err) => {
                    resolve(!err);
                });
            });
        });
    });
});

/**
 * Get list of saved absence dates (for history display)
 */
ipcMain.handle('db-get-absence-history', function (event) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve([]);
            var sql = `SELECT absence_date as date, COUNT(DISTINCT student_id) as studentCount
                   FROM student_absences GROUP BY absence_date ORDER BY absence_date DESC LIMIT 100`;
            db.all(sql, [], (err, rows) => {
                resolve(err ? [] : (rows || []));
            });
        });
    });
});

/**
 * Canteen absences: save for a specific date
 */
ipcMain.handle('db-save-canteen-absences', function (event, options) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);
            var date = options.date;
            var studentIds = options.studentIds || [];
            var academicYear = options.academicYear || getAcademicYearFromDate(date);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run('DELETE FROM canteen_absences WHERE absence_date = ?', [date]);

                if (studentIds.length > 0) {
                    var stmt = db.prepare('INSERT INTO canteen_absences (student_id, absence_date, academic_year) VALUES (?, ?, ?)');
                    studentIds.forEach(function (id) {
                        stmt.run([String(id), date, academicYear]);
                    });
                    stmt.finalize();
                }

                db.run('COMMIT', (err) => {
                    if (err) { db.run('ROLLBACK'); resolve(false); }
                    else resolve(true);
                });
            });
        });
    });
});

/**
 * Canteen absences: get for a date range
 */
ipcMain.handle('db-get-canteen-absences', function (event, options) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve({});
            var startDate = options.startDate;
            var endDate = options.endDate;

            var sql = 'SELECT student_id, absence_date FROM canteen_absences WHERE absence_date >= ? AND absence_date <= ? ORDER BY absence_date';
            db.all(sql, [startDate, endDate], (err, rows) => {
                if (err || !rows) return resolve({});
                // Group by date
                var result = {};
                rows.forEach(function (r) {
                    if (!result[r.absence_date]) result[r.absence_date] = [];
                    result[r.absence_date].push(r.student_id);
                });
                resolve(result);
            });
        });
    });
});

/**
 * Clear all absence data (for data management page)
 */
ipcMain.handle('db-clear-all-absences', function (event) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);
            db.serialize(() => {
                db.run('DELETE FROM student_absences');
                db.run('DELETE FROM teacher_absences');
                db.run('DELETE FROM supervisor_absences');
                db.run('DELETE FROM canteen_absences');
                db.run('DELETE FROM daily_reports', (err) => {
                    resolve(!err);
                });
            });
        });
    });
});

/**
 * Export all absences for backup (returns legacy-compatible format)
 */
ipcMain.handle('db-get-all-absences-export', function (event) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve([]);
            // Get all unique dates from daily_reports (primary source)
            // Also fallback to other tables for legacy compatibility
            var sql = `SELECT DISTINCT absence_date FROM daily_reports
                       UNION SELECT DISTINCT absence_date FROM student_absences
                       UNION SELECT DISTINCT absence_date FROM teacher_absences
                       UNION SELECT DISTINCT absence_date FROM supervisor_absences
                       UNION SELECT DISTINCT absence_date FROM canteen_absences
                       ORDER BY absence_date DESC`;
            db.all(sql, [], (err, dates) => {
                if (err || !dates || dates.length === 0) return resolve([]);

                var promises = dates.map(function (d) {
                    return new Promise((res2) => {
                        Promise.all([
                            new Promise((r) => { db.all('SELECT * FROM student_absences WHERE absence_date = ?', [d.absence_date], (e, rows) => r(e ? [] : (rows || []))); }),
                            new Promise((r) => { db.all('SELECT * FROM teacher_absences WHERE absence_date = ?', [d.absence_date], (e, rows) => r(e ? [] : (rows || []))); }),
                            new Promise((r) => { db.all('SELECT * FROM supervisor_absences WHERE absence_date = ?', [d.absence_date], (e, rows) => r(e ? [] : (rows || []))); }),
                            new Promise((r) => { db.all('SELECT student_id FROM canteen_absences WHERE absence_date = ?', [d.absence_date], (e, rows) => r(e ? [] : (rows.map(row => row.student_id)))); }),
                            new Promise((r) => { db.get("SELECT * FROM daily_reports WHERE absence_date = ? ORDER BY CASE WHEN period = 'ALL' THEN 0 ELSE 1 END, created_at DESC LIMIT 1", [d.absence_date], (e, row) => r(row || null)); })
                        ]).then(function (results) {
                            // Get the period and report number from daily_reports primarily
                            var drRec = results[4] || {};
                            var firstAbsenceRec = results[0][0] || results[1][0] || results[2][0] || {};
                            
                            var period = getReportPeriod();
                            var reportNumber = drRec.report_number || firstAbsenceRec.report_number || null;

                            res2({
                                date: d.absence_date,
                                period: period,
                                report_number: reportNumber,
                                students: results[0].map(function (r) {
                                    return { id: r.student_id, am: { from: r.am_from || 'Present', to: r.am_to || 'Present' }, pm: { from: r.pm_from || 'Present', to: r.pm_to || 'Present' }, reason: r.reason || '' };
                                }),
                                teachers: results[1].map(function (r) {
                                    var p = null; if (r.periods_json) { try { p = JSON.parse(r.periods_json); } catch (e) { } }
                                    return { id: r.teacher_id, type: r.type, reason: r.reason || '', hours: r.hours || 0, lateDuration: r.late_duration || 0, periods: p || [] };
                                }),
                                supervisors: results[2].map(function (r) {
                                    return { id: r.supervisor_id, reason: r.reason || '', period: getSupervisorModeFromRow(r), from: r.time_from || '', to: r.time_to || '', lateDuration: r.late_duration || '' };
                                }),
                                canteenStudents: results[3], // List of student IDs
                                timestamp: drRec.created_at || firstAbsenceRec.created_at || new Date().toISOString()
                            });
                        });
                    });
                });

                Promise.all(promises).then(resolve);
            });
        });
    });
});

/**
 * Get all unique academic years present in both students and results tables
 */
ipcMain.handle('db-get-unique-years', function (event) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve([]);
            var sql = `
                SELECT academic_year as year FROM students WHERE academic_year IS NOT NULL
                UNION
                SELECT academic_year as year FROM results WHERE academic_year IS NOT NULL
                ORDER BY year DESC
            `;
            db.all(sql, [], (err, rows) => {
                if (err || !rows) return resolve([]);
                var years = rows.map(r => r.year).filter(Boolean);
                // Deduplicate (UNION already does this, but for safety)
                resolve([...new Set(years)]);
            });
        });
    });
});

/**
 * Import absences from backup (legacy array format)
 */
ipcMain.handle('db-import-absences', function (event, records) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db || !Array.isArray(records)) return resolve(false);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION', (err) => {
                    if (err) return resolve(false);
                });

                var stmtD = db.prepare('INSERT OR REPLACE INTO daily_reports (absence_date, period, report_number, academic_year) VALUES (?, ?, ?, ?)');
                var stmtS = db.prepare('INSERT OR REPLACE INTO student_absences (student_id, absence_date, period, am_from, am_to, pm_from, pm_to, reason, is_justified, academic_year, report_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                var stmtT = db.prepare('INSERT OR REPLACE INTO teacher_absences (teacher_id, absence_date, period, type, reason, hours, late_duration, periods_json, academic_year, report_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                var stmtV = db.prepare('INSERT OR REPLACE INTO supervisor_absences (supervisor_id, absence_date, period, supervisor_mode, reason, time_from, time_to, late_duration, academic_year, report_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                var stmtC = db.prepare('INSERT OR REPLACE INTO canteen_absences (student_id, absence_date, academic_year) VALUES (?, ?, ?)');

                var i = 0;
                function next() {
                    if (i >= records.length) {
                        stmtD.finalize();
                        stmtS.finalize();
                        stmtT.finalize();
                        stmtV.finalize();
                        stmtC.finalize();

                        db.run('COMMIT', (err) => {
                            if (err) {
                                console.error('[SQLite] db-import-absences error:', err.message);
                                db.run('ROLLBACK');
                                resolve(false);
                            } else {
                                resolve(true);
                            }
                        });
                        return;
                    }

                    var rec = records[i++];
                    var date = rec.date;
                    var period = getReportPeriod();
                    var derivedYear = getStoredAcademicYear(date, rec.academicYear);
                    var reportNumber = rec.report_number || null;

                    stmtD.run([date, period, reportNumber, derivedYear]);

                    if (rec.students && Array.isArray(rec.students)) {
                        rec.students.forEach(function (s) {
                            var am = s.am || {};
                            var pm = s.pm || {};
                            stmtS.run([String(s.id), date, period,
                            (am.from && am.from !== 'Present') ? am.from : null,
                            (am.to && am.to !== 'Present') ? am.to : null,
                            (pm.from && pm.from !== 'Present') ? pm.from : null,
                            (pm.to && pm.to !== 'Present') ? pm.to : null,
                            s.reason || '', 0, derivedYear, reportNumber]);
                        });
                    }
                    if (rec.teachers && Array.isArray(rec.teachers)) {
                        rec.teachers.forEach(function (t) {
                            stmtT.run([t.id, date, period, t.type || 'absence', t.reason || '', t.hours || 0, t.lateDuration || 0,
                            t.periods ? JSON.stringify(t.periods) : null, derivedYear, reportNumber]);
                        });
                    }
                    if (rec.supervisors && Array.isArray(rec.supervisors)) {
                        rec.supervisors.forEach(function (sv) {
                            stmtV.run([sv.id, date, period, sv.period || 'FULL', sv.reason || '', sv.from || null, sv.to || null, sv.lateDuration || '', derivedYear, reportNumber]);
                        });
                    }
                    if (rec.canteenStudents && Array.isArray(rec.canteenStudents)) {
                        rec.canteenStudents.forEach(function (sid) {
                            stmtC.run([String(sid), date, derivedYear]);
                        });
                    }

                    // Use setImmediate to avoid stack overflow for very large record lists
                    if (i % 50 === 0) {
                        setImmediate(next);
                    } else {
                        next();
                    }
                }

                next();
            });
        });
    });
});

// ============================================================
// Teacher Messaging Logs Handlers
// ============================================================

ipcMain.handle('db-save-msg-log', function (event, log) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);
            var stmt = db.prepare('INSERT INTO teacher_message_logs (teacher_id, teacher_name, subject, body, status, error_details) VALUES (?, ?, ?, ?, ?, ?)');
            stmt.run([log.teacher_id, log.teacher_name, log.subject, log.body, log.status, log.error_details || ''], function (err) {
                if (err) console.error('[SQLite] db-save-msg-log error:', err.message);
                resolve(!err);
            });
            stmt.finalize();
        });
    });
});

ipcMain.handle('db-get-msg-logs', function (event) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve([]);
            db.all('SELECT * FROM teacher_message_logs ORDER BY sent_at DESC', [], (err, rows) => {
                resolve(err ? [] : (rows || []));
            });
        });
    });
});

ipcMain.handle('db-delete-msg-log', function (event, id) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);
            db.run('DELETE FROM teacher_message_logs WHERE id = ?', [id], (err) => {
                resolve(!err);
            });
        });
    });
});

ipcMain.handle('db-clear-msg-logs', function (event) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);
            db.run('DELETE FROM teacher_message_logs', (err) => {
                resolve(!err);
            });
        });
    });
});
};

