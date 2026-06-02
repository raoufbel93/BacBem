module.exports = function (context) {
    var ipcMain = context.ipcMain;
    var queueDBTask = context.queueDBTask;
    var db = context.getDb();
    var DB_PATH = context.getDatabasePath();

    ipcMain.handle('db-clear', function () {
        return queueDBTask(function () {
            return new Promise(function (resolve) {
                if (!db) return resolve(false);

                db.serialize(function () {
                    db.run('DELETE FROM settings');
                    db.run('DELETE FROM students');
                    db.run('DELETE FROM results');
                    db.run('DELETE FROM annual_results');
                    db.run('DELETE FROM activity_evaluations');
                    db.run('DELETE FROM teachers', function (err) {
                        if (err) {
                            console.error('[SQLite] db-clear error:', err.message);
                            resolve(false);
                        } else {
                            resolve(true);
                        }
                    });
                });
            });
        });
    });

    ipcMain.handle('db-clear-students', function () {
        return queueDBTask(function () {
            return new Promise(function (resolve) {
                if (!db) return resolve(false);
                db.run('DELETE FROM students', function (err) {
                    if (err) console.error('[SQLite] db-clear-students error:', err.message);
                    resolve(!err);
                });
            });
        });
    });

    ipcMain.handle('db-clear-results', function () {
        return queueDBTask(function () {
            return new Promise(function (resolve) {
                if (!db) return resolve(false);
                db.run('DELETE FROM results', function (err) {
                    if (err) console.error('[SQLite] db-clear-results error:', err.message);
                    resolve(!err);
                });
            });
        });
    });

    ipcMain.handle('db-clear-teachers', function () {
        return queueDBTask(function () {
            return new Promise(function (resolve) {
                if (!db) return resolve(false);
                db.run('DELETE FROM teachers', function (err) {
                    if (err) console.error('[SQLite] db-clear-teachers error:', err.message);
                    resolve(!err);
                });
            });
        });
    });

    ipcMain.handle('db-migrate-from-legacy', function (event, data) {
        return queueDBTask(function () {
            return new Promise(function (resolve) {
                if (!db) return resolve(false);
                console.log('[SQLite] Starting migration from legacy data...');

                db.serialize(function () {
                    db.run('BEGIN TRANSACTION');

                    var stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))');

                    for (var key in data) {
                        if (data.hasOwnProperty(key)) {
                            stmt.run([key, JSON.stringify(data[key])]);
                        }
                    }

                    stmt.run(['_migrated_to_sqlite', JSON.stringify(true)]);
                    stmt.finalize();

                    db.run('COMMIT', function (err) {
                        if (err) {
                            console.error('[SQLite] Migration error:', err.message);
                            db.run('ROLLBACK');
                            resolve(false);
                        } else {
                            console.log('[SQLite] Migration completed successfully');
                            resolve(true);
                        }
                    });
                });
            });
        });
    });

    ipcMain.handle('db-is-migrated', function () {
        return queueDBTask(function () {
            return new Promise(function (resolve) {
                if (!db) return resolve(false);
                db.get('SELECT value FROM settings WHERE key = ?', ['_migrated_to_sqlite'], function (err, row) {
                    if (err || !row) return resolve(false);
                    try {
                        resolve(JSON.parse(row.value) === true);
                    } catch (e) {
                        resolve(false);
                    }
                });
            });
        });
    });

    ipcMain.handle('db-get-path', function () {
        return DB_PATH;
    });

    ipcMain.handle('db-save', function () {
        return true;
    });
};
