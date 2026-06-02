module.exports = function (context) {
    var ipcMain = context.ipcMain;
    var queueDBTask = context.queueDBTask;
    var db = context.getDb();
    var dialog = context.dialog;
    var hydrateStudentRow = context.hydrateStudentRow;
    var normalizeStudentColumnValue = context.normalizeStudentColumnValue;
    var normalizeAcademicYear = context.normalizeAcademicYear;
    var getAcademicYearFromDate = context.getAcademicYearFromDate;
    var DB_PATH = context.getDatabasePath();

// ---- Global Database Lock Queue is now defined globally ----

ipcMain.handle('db-get', function (event, key) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(null);
            db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
                if (err || !row) {
                    resolve(null);
                    return;
                }
                try {
                    resolve(JSON.parse(row.value));
                } catch (e) {
                    resolve(row.value);
                }
            });
        });
    });
});

ipcMain.handle('db-set', function (event, key, value) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);
            var jsonValue = JSON.stringify(value);
            db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))', [key, jsonValue], (err) => {
                if (err) {
                    console.error('[SQLite] db-set error:', key, err.message);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    });
});

ipcMain.handle('db-remove', function (event, key) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);
            db.run('DELETE FROM settings WHERE key = ?', [key], (err) => {
                if (err) {
                    console.error('[SQLite] db-remove error:', key, err.message);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    });
});

ipcMain.handle('db-get-all', function (event) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve({});
            db.all('SELECT key, value FROM settings', [], (err, rows) => {
                if (err || !rows) {
                    console.error('[SQLite] db-get-all error:', err ? err.message : 'No rows');
                    resolve({});
                    return;
                }
                var result = {};
                rows.forEach(row => {
                    try {
                        result[row.key] = JSON.parse(row.value);
                    } catch (e) {
                        result[row.key] = row.value;
                    }
                });
                resolve(result);
            });
        });
    });
});

ipcMain.handle('db-get-official-center', function (event) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(null);
            db.get('SELECT * FROM official_exam_center WHERE id = 1', [], (err, row) => {
                if (err) {
                    console.error('[SQLite] db-get-official-center error:', err.message);
                    resolve(null);
                    return;
                }
                if (!row) {
                    resolve({
                        ministry: 'وزارة التربية الوطنية',
                        office: 'الديوان الوطني للامتحانات و المسابقات',
                        branch: '',
                        bac_streams: [],
                        center_code: '',
                        center_name: '',
                        municipality: '',
                        province: '',
                        president: '',
                        job: '',
                        institution: '',
                        exam: '',
                        session: '',
                        rooms_count: 0,
                        guards_per_room: 0,
                        exam_days: 0
                    });
                } else {
                    var parsedRow = Object.assign({}, row, {
                        bac_streams: []
                    });
                    try {
                        parsedRow.bac_streams = row.bac_streams ? JSON.parse(row.bac_streams) : [];
                    } catch (e) {
                        parsedRow.bac_streams = [];
                    }
                    if (!Array.isArray(parsedRow.bac_streams)) parsedRow.bac_streams = [];
                    resolve(parsedRow);
                }
            });
        });
    });
});

ipcMain.handle('db-save-official-center', function (event, data) {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve(false);
            
            const query = `
                INSERT OR REPLACE INTO official_exam_center (
                    id, ministry, office, branch, bac_streams, center_code, center_name, 
                    municipality, province, president, job, institution, 
                    exam, session, rooms_count, guards_per_room, exam_days, updated_at
                ) VALUES (
                    1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
                )
            `;
            
            const params = [
                data.ministry || 'وزارة التربية الوطنية',
                data.office || 'الديوان الوطني للامتحانات و المسابقات',
                data.branch || '',
                JSON.stringify(Array.isArray(data.bac_streams) ? data.bac_streams : []),
                data.center_code || '',
                data.center_name || '',
                data.municipality || '',
                data.province || '',
                data.president || '',
                data.job || '',
                data.institution || '',
                data.exam || '',
                data.session || '',
                data.rooms_count || 0,
                data.guards_per_room || 0,
                data.exam_days || 0
            ];

            db.run(query, params, function (err) {
                if (err) {
                    console.error('[SQLite] db-save-official-center error:', err.message);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    });
});

// ---- Students Table Operations ----
};

