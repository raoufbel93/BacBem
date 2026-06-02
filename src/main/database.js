const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const registerAcademicHandlers = require('./database-modules/academics');
const registerAbsenceHandlers = require('./database-modules/absences');
const registerMaintenanceHandlers = require('./database-modules/maintenance');
const registerMigrations = require('./database-modules/migrations');
const registerPhotoHandlers = require('./database-modules/photos');
const registerSettingsHandlers = require('./database-modules/settings');
const registerStudentHandlers = require('./database-modules/students');
const registerUtilityHandlers = require('./database-modules/utilities');

let db = null;
let DB_PATH = null;
// ---- Global Database Lock Queue ----
// This ensures only one transaction runs at a time on the SQLite handle
var dbLock = Promise.resolve();

// Helper to queue an action
function queueDBTask(taskFn) {
    var resolveOuter;
    var p = new Promise((res) => { resolveOuter = res; });
    var nextLock = dbLock.then(async () => {
        try {
            var result = await taskFn();
            resolveOuter(result);
        } catch (e) {
            console.error('[SQLite Queue Error]:', e);
            resolveOuter(false);
        }
    });
    dbLock = nextLock;
    return p;
}

function dbRunAsync(sql, params) {
    return new Promise(function (resolve, reject) {
        if (!db) return reject(new Error('database_unavailable'));
        db.run(sql, params || [], function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbGetAsync(sql, params) {
    return new Promise(function (resolve, reject) {
        if (!db) return reject(new Error('database_unavailable'));
        db.get(sql, params || [], function (err, row) {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

function dbAllAsync(sql, params) {
    return new Promise(function (resolve, reject) {
        if (!db) return reject(new Error('database_unavailable'));
        db.all(sql, params || [], function (err, rows) {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function normalizeArabicLookupText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/\s+/g, ' ');
}

function getLevelNumberFromValue(levelValue) {
    var raw = String(levelValue || '').trim();
    if (!raw) return '';

    var normalized = normalizeArabicLookupText(raw);
    var digitMatch = raw.match(/[1-4]/);
    if (digitMatch) return digitMatch[0];

    if (normalized.indexOf('اول') !== -1) return '1';
    if (normalized.indexOf('ثان') !== -1) return '2';
    if (normalized.indexOf('ثالث') !== -1) return '3';
    if (normalized.indexOf('رابع') !== -1) return '4';

    return '';
}

function normalizeLevelStorageValue(levelValue) {
    var levelNumber = getLevelNumberFromValue(levelValue);
    switch (levelNumber) {
        case '1': return 'أولى';
        case '2': return 'ثانية';
        case '3': return 'ثالثة';
        case '4': return 'رابعة';
        default: {
            var raw = String(levelValue || '').trim();
            return raw || null;
        }
    }
}

function normalizeClassNumberValue(classValue) {
    if (classValue === null || classValue === undefined) return null;

    var raw = String(classValue).trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
        return String(parseInt(raw, 10));
    }

    var trailingDigits = raw.match(/(\d{1,2})$/);
    if (trailingDigits) {
        return String(parseInt(trailingDigits[1], 10));
    }

    return raw;
}

function initDatabase() {
    if (!DB_PATH) {
        DB_PATH = path.join(app.getPath('userData'), 'idara_plus.db');
    }
    return new Promise((resolve, reject) => {
        // Ensure directory exists
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('[SQLite] Error opening database:', err.message);
                reject(err);
                return;
            }

            console.log('[SQLite] Connected to the database at:', DB_PATH);

            // Start the async initialization outside the constructor callback
            (async () => {
                try {
                    console.log('[SQLite] Initializing tables...');
                    await createTables();

                    console.log('[SQLite] Running schema migrations...');
                    await registerMigrations.runMigrations(db);

                    console.log('[SQLite] Tables ready. Checking for data repairs...');
                    await runDatabaseRecoveryAlgorithms();

                    console.log('[SQLite] Running database health check...');
                    await runDatabaseHealthCheck();

                    console.log('[SQLite] Database fully initialized.');
                    resolve(true);
                } catch (initErr) {
                    console.error('[SQLite Init Error]:', initErr);
                    resolve(true); // Continue anyway so the app can show an error page
                }
            })();
        });
    });
}

function createTables() {
    return new Promise((resolve) => {
        if (!db) return resolve();
        db.serialize(() => {
            db.run('PRAGMA foreign_keys = ON');

            // General key-value settings store (replaces IndexedDB 'data' store)
            db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

            // Students table
            db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            reg_number TEXT,
            national_id TEXT,
            last_name TEXT NOT NULL DEFAULT '',
            first_name TEXT NOT NULL DEFAULT '',
            gender TEXT,
            birth_date TEXT,
            pob TEXT,
            level TEXT,
            class_number TEXT,
            stream TEXT,
            subgroup TEXT,
            status TEXT DEFAULT 'external',
            is_repeater INTEGER DEFAULT 0,
            father_name TEXT,
            mother_name TEXT,
            scholarship_confirmed INTEGER DEFAULT 0,
            struck_off INTEGER DEFAULT 0,
            observation TEXT,
            extra_data TEXT,
            academic_year TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

            // Results/grades table
            db.run(`
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name TEXT NOT NULL DEFAULT '',
            student_id TEXT,
            dob TEXT,
            pob TEXT,
            gender TEXT,
            is_repeater INTEGER DEFAULT 0,
            level TEXT,
            class TEXT,
            stream TEXT,
            trimester TEXT,
            marks TEXT,
            average REAL DEFAULT 0,
            averages TEXT,
            decision TEXT DEFAULT '-',
            extra_data TEXT,
            academic_year TEXT,
            activity_test_avg REAL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

            // Annual/final results table
            db.run(`
        CREATE TABLE IF NOT EXISTS annual_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT,
            academic_year TEXT,
            last_name TEXT NOT NULL DEFAULT '',
            first_name TEXT NOT NULL DEFAULT '',
            gender TEXT,
            birth_date TEXT,
            birth_year INTEGER,
            level INTEGER,
            class_name TEXT,
            stream TEXT,
            t1_avg REAL DEFAULT 0,
            t2_avg REAL DEFAULT 0,
            t3_avg REAL DEFAULT 0,
            annual_avg REAL DEFAULT 0,
            decision TEXT DEFAULT '-',
            source_file TEXT,
            extra_data TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);


            // Teachers table
            db.run(`
        CREATE TABLE IF NOT EXISTS teachers (
            id TEXT PRIMARY KEY,
            last_name TEXT NOT NULL DEFAULT '',
            first_name TEXT NOT NULL DEFAULT '',
            rank TEXT,
            subject TEXT,
            is_exempt INTEGER DEFAULT 0,
            is_subject_responsible INTEGER DEFAULT 0,
            responsible_classes TEXT,
            reception_hours TEXT,
            extra_data TEXT,
            academic_year TEXT
        )
    `);

            // Exam Proctors table
            db.run(`
        CREATE TABLE IF NOT EXISTS exam_proctors (
            id TEXT PRIMARY KEY,
            last_name TEXT NOT NULL DEFAULT '',
            first_name TEXT NOT NULL DEFAULT '',
            birth_date TEXT,
            gender TEXT,
            subject TEXT,
            rank TEXT,
            institution TEXT,
            academic_year TEXT
        )
    `);

            // Official Exam Center table
            db.run(`
        CREATE TABLE IF NOT EXISTS official_exam_center (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            ministry TEXT DEFAULT 'وزارة التربية الوطنية',
            office TEXT DEFAULT 'الديوان الوطني للامتحانات و المسابقات',
            branch TEXT DEFAULT '',
            bac_streams TEXT DEFAULT '[]',
            center_code TEXT DEFAULT '',
            center_name TEXT DEFAULT '',
            municipality TEXT DEFAULT '',
            province TEXT DEFAULT '',
            president TEXT DEFAULT '',
            job TEXT DEFAULT '',
            institution TEXT DEFAULT '',
            exam TEXT DEFAULT '',
            session TEXT DEFAULT '',
            rooms_count INTEGER DEFAULT 0,
            guards_per_room INTEGER DEFAULT 0,
            exam_days INTEGER DEFAULT 0,
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

            // Activity Evaluations table
            db.run(`
        CREATE TABLE IF NOT EXISTS activity_evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT,
            student_name TEXT,
            academic_year TEXT,
            trimester TEXT,
            level TEXT,
            class_number TEXT,
            subject TEXT,
            eval_mark REAL,
            assignment_mark REAL,
            test_mark REAL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

            db.run("ALTER TABLE activity_evaluations ADD COLUMN assignment_mark REAL", (err) => { });
            db.run("ALTER TABLE activity_evaluations ADD COLUMN test_mark REAL", (err) => { });
            db.run("ALTER TABLE activity_evaluations ADD COLUMN extra_data TEXT", (err) => { });

            db.run('CREATE INDEX IF NOT EXISTS idx_act_evals_student ON activity_evaluations(student_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_act_evals_subject ON activity_evaluations(subject)');
            db.run('CREATE INDEX IF NOT EXISTS idx_act_evals_trimester ON activity_evaluations(trimester)');
            db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_act_evals_unique ON activity_evaluations(student_id, subject, trimester, academic_year)', (err) => {
                if (err) console.warn('[SQLite] Could not create unique index for activity_evaluations:', err.message);
            });

            // Add academic_year column if it doesn't exist
            db.all("PRAGMA table_info(teachers)", (err, columns) => {
                if (!err && columns) {
                    const has_academic_year = columns.some(col => col.name === 'academic_year');
                    if (!has_academic_year) {
                        db.run("ALTER TABLE teachers ADD COLUMN academic_year TEXT", (err) => {
                            if (err) console.error("Error adding academic_year to teachers:", err);
                            else console.log("Added academic_year column to teachers table.");
                        });
                    }
                }
            });

            db.run("ALTER TABLE students ADD COLUMN academic_year TEXT", () => { });
            db.run("ALTER TABLE results ADD COLUMN student_id TEXT", () => { });
            db.run("ALTER TABLE results ADD COLUMN academic_year TEXT", () => { });
            db.run("ALTER TABLE results ADD COLUMN created_at TEXT", (err) => { if (err && !err.message.includes('duplicate column')) console.warn('Add created_at:', err.message); });
            db.run("ALTER TABLE results ADD COLUMN updated_at TEXT", (err) => { if (err && !err.message.includes('duplicate column')) console.warn('Add updated_at:', err.message); });
            db.run("ALTER TABLE annual_results ADD COLUMN student_id TEXT", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN academic_year TEXT", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN last_name TEXT NOT NULL DEFAULT ''", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN first_name TEXT NOT NULL DEFAULT ''", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN gender TEXT", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN birth_date TEXT", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN birth_year INTEGER", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN level INTEGER", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN class_name TEXT", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN stream TEXT", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN t1_avg REAL DEFAULT 0", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN t2_avg REAL DEFAULT 0", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN t3_avg REAL DEFAULT 0", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN annual_avg REAL DEFAULT 0", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN decision TEXT DEFAULT '-'", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN source_file TEXT", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN extra_data TEXT", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN created_at TEXT", () => { });
            db.run("ALTER TABLE annual_results ADD COLUMN updated_at TEXT", () => { });

            // Create indexes for common queries
            db.run('CREATE INDEX IF NOT EXISTS idx_students_level ON students(level)');
            db.run('CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_number)');
            db.run('CREATE INDEX IF NOT EXISTS idx_students_struck_off ON students(struck_off)');
            db.run('CREATE INDEX IF NOT EXISTS idx_results_level ON results(level)');
            db.run('CREATE INDEX IF NOT EXISTS idx_results_trimester ON results(trimester)');
            db.run('CREATE INDEX IF NOT EXISTS idx_results_class ON results(class)');
            db.run('CREATE INDEX IF NOT EXISTS idx_results_academic_year ON results(academic_year)');
            db.run('CREATE INDEX IF NOT EXISTS idx_annual_results_year ON annual_results(academic_year)');
            db.run('CREATE INDEX IF NOT EXISTS idx_annual_results_student ON annual_results(student_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_annual_results_class ON annual_results(class_name)');
            db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_annual_results_student_year ON annual_results(student_id, academic_year)', (err) => {
                if (err) console.warn('[SQLite] Could not create annual results unique index:', err.message);
            });

            // Drop old fragile unique index and create strict one based on ID
            db.run('DROP INDEX IF EXISTS idx_results_unique_student', () => {
                db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_results_unique_student_strict ON results(student_id, trimester, academic_year) WHERE student_id IS NOT NULL', (err) => {
                    if (err) console.warn('[SQLite] Could not create strict unique index for results:', err.message);
                });
            });

            // ============================================================
            // Absence Tracking Tables (Relational)
            // ============================================================

            // Student absences
            db.run(`
        CREATE TABLE IF NOT EXISTS student_absences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            absence_date TEXT NOT NULL,
            period TEXT DEFAULT 'ALL',
            am_from TEXT,
            am_to TEXT,
            pm_from TEXT,
            pm_to TEXT,
            reason TEXT DEFAULT '',
            is_justified INTEGER DEFAULT 0,
            academic_year TEXT,
            report_number INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        )
    `);
            db.run('CREATE INDEX IF NOT EXISTS idx_student_abs_date ON student_absences(absence_date)');
            db.run('CREATE INDEX IF NOT EXISTS idx_student_abs_student ON student_absences(student_id)');
            db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_student_abs_unique ON student_absences(student_id, absence_date, period)', (err) => {
                if (err) console.warn('[SQLite] student_absences unique index:', err.message);
            });

            // Teacher absences
            db.run(`
        CREATE TABLE IF NOT EXISTS teacher_absences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id TEXT NOT NULL,
            absence_date TEXT NOT NULL,
            period TEXT DEFAULT 'ALL',
            type TEXT DEFAULT 'absence',
            reason TEXT DEFAULT '',
            hours REAL DEFAULT 0,
            late_duration INTEGER DEFAULT 0,
            periods_json TEXT,
            academic_year TEXT,
            report_number INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        )
    `);
            db.run('CREATE INDEX IF NOT EXISTS idx_teacher_abs_date ON teacher_absences(absence_date)');
            db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_abs_unique ON teacher_absences(teacher_id, absence_date, period)', (err) => {
                if (err) console.warn('[SQLite] teacher_absences unique index:', err.message);
            });

            // Supervisor absences
            db.run(`
        CREATE TABLE IF NOT EXISTS supervisor_absences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supervisor_id TEXT NOT NULL,
            absence_date TEXT NOT NULL,
            period TEXT DEFAULT 'ALL',
            supervisor_mode TEXT DEFAULT 'FULL',
            reason TEXT DEFAULT '',
            time_from TEXT,
            time_to TEXT,
            late_duration TEXT DEFAULT '',
            academic_year TEXT,
            report_number INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        )
    `);
            db.run('CREATE INDEX IF NOT EXISTS idx_supervisor_abs_date ON supervisor_absences(absence_date)');
            db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_supervisor_abs_unique ON supervisor_absences(supervisor_id, absence_date, period)', (err) => {
                if (err) console.warn('[SQLite] supervisor_absences unique index:', err.message);
            });

            // Canteen absences
            db.run(`
        CREATE TABLE IF NOT EXISTS canteen_absences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            absence_date TEXT NOT NULL,
            academic_year TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    `);
            db.run('CREATE INDEX IF NOT EXISTS idx_canteen_abs_date ON canteen_absences(absence_date)');
            db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_canteen_abs_unique ON canteen_absences(student_id, absence_date)', (err) => {
                if (err) console.warn('[SQLite] canteen_absences unique index:', err.message);
            });

            // Daily Reports summary (source of truth for report existence even with 0 absences)
            db.run(`
                CREATE TABLE IF NOT EXISTS daily_reports (
                    absence_date TEXT NOT NULL,
                    period TEXT DEFAULT 'ALL',
                    report_number INTEGER,
                    academic_year TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    PRIMARY KEY (absence_date, period)
                )
            `);

            // Teacher Message Logs
            db.run(`
        CREATE TABLE IF NOT EXISTS teacher_message_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id TEXT NOT NULL,
            teacher_name TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            status TEXT NOT NULL,
            error_details TEXT DEFAULT '',
            sent_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    `);
            db.run('CREATE INDEX IF NOT EXISTS idx_teacher_msg_date ON teacher_message_logs(sent_at)');
            db.run('CREATE INDEX IF NOT EXISTS idx_teacher_msg_id ON teacher_message_logs(teacher_id)');

    // Add report_number column to existing tables
    db.run("ALTER TABLE student_absences ADD COLUMN report_number INTEGER", (err) => { });
    db.run("ALTER TABLE teacher_absences ADD COLUMN report_number INTEGER", (err) => { });
    db.run("ALTER TABLE supervisor_absences ADD COLUMN report_number INTEGER", (err) => { });
    db.run("ALTER TABLE supervisor_absences ADD COLUMN supervisor_mode TEXT DEFAULT 'FULL'", (err) => { });

    // Final sentinel to ensure serialize is done
            db.run('PRAGMA user_version', (err) => {
                resolve();
            });
        });
    });
}

function hydrateStudentRow(row) {
    if (!row) return null;

    row.is_repeater = !!row.is_repeater;
    row.scholarship_confirmed = !!row.scholarship_confirmed;
    row.struck_off = !!row.struck_off;

    var extra = null;

    if (row.extra_data) {
        try {
            extra = JSON.parse(row.extra_data);
            Object.assign(row, extra);
        } catch (e) { }
    }
    delete row.extra_data;

    row.level = normalizeLevelStorageValue(row.level || (extra && extra.level) || null);

    if (!row.class_number && extra) {
        row.class_number = extra.class_number || extra.class || null;
    }
    row.class_number = normalizeClassNumberValue(row.class_number);

    // Backward-compatible aliases used across older pages.
    if ((row.class === undefined || row.class === null || row.class === '') && row.class_number != null) {
        row.class = row.class_number;
    }
    row.class = normalizeClassNumberValue(row.class);
    if (row.repeat === undefined) {
        row.repeat = row.is_repeater;
    }
    if (!row.address && row.guardian_address) {
        row.address = row.guardian_address;
    }
    if (!row.parent_phone && row.guardian_phone) {
        row.parent_phone = row.guardian_phone;
    }
    if (!row.parent_email && row.guardian_email) {
        row.parent_email = row.guardian_email;
    }

    return row;
}

function normalizeStudentColumnValue(column, value) {
    if (column === 'is_repeater' || column === 'scholarship_confirmed' || column === 'struck_off') {
        return value ? 1 : 0;
    }
    if (column === 'academic_year') {
        return normalizeAcademicYear(value || null);
    }
    if (column === 'level') {
        return normalizeLevelStorageValue(value);
    }
    if (column === 'class_number' || column === 'class') {
        return normalizeClassNumberValue(value);
    }
    if (column === 'last_name' || column === 'first_name') {
        return value || '';
    }
    if (column === 'status') {
        return value || 'external';
    }
    return value === '' ? null : value;
}

/**
 * Derives academic year from date (YYYY-MM-DD)
 * Sep-Dec: Year+1/Year (e.g. 2025/2024 for Sep 2024)
 * Jan-Aug: Year/Year-1 (e.g. 2025/2024 for May 2025)
 */
function getAcademicYearFromDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('-');
    if (parts.length < 2) return null;

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);

    if (isNaN(year) || isNaN(month)) return null;

    if (month >= 9) {
        return (year + 1) + "/" + year;
    } else {
        return year + "/" + (year - 1);
    }
}

/**
 * Normalizes any year string (e.g. "2025-2026" or "2025/2026") into the universal "2026/2025" IDARA format
 */
function normalizeAcademicYear(yearStr) {
    if (!yearStr || typeof yearStr !== 'string') return null;
    var numMatches = yearStr.match(/20\d{2}/g);
    if (!numMatches || numMatches.length !== 2) return yearStr;
    var y1 = parseInt(numMatches[0], 10);
    var y2 = parseInt(numMatches[1], 10);
    return Math.max(y1, y2) + "/" + Math.min(y1, y2);
}

/**
 * Silent background algorithms to repair any malformed data 
 * caused by previous bugs or failed migrations without bothering the user.
 */
function runDatabaseRecoveryAlgorithms() {
    return queueDBTask(() => {
        return new Promise((resolve) => {
            if (!db) return resolve();

            const tables = ['students', 'student_absences', 'teacher_absences', 'supervisor_absences', 'canteen_absences', 'results', 'annual_results', 'activity_evaluations', 'teachers'];

            // 1. Add missing columns if they don't exist
            db.run("ALTER TABLE results ADD COLUMN activity_test_avg REAL", (err) => { });

            // 2. Fetch global current year as ultimate fallback
            db.get("SELECT value FROM settings WHERE key = 'institutionSettings'", (err, settingsRow) => {
                let globalFallbackYear = null;
                if (!err && settingsRow) {
                    try {
                        const s = JSON.parse(settingsRow.value);
                        globalFallbackYear = s.currentAcademicYear || s.schoolYear;
                    } catch (e) { }
                }
                if (!globalFallbackYear) globalFallbackYear = getAcademicYearFromDate(new Date().toISOString().split('T')[0]);

                let fixQueries = [];

                // 3. Gather all records needing year fixes
                var tablePromises = tables.map(table => {
                    return new Promise(resTable => {
                        db.all(`SELECT * FROM ${table}`, (err, rows) => {
                            if (!err && rows && rows.length > 0) {
                                rows.forEach(row => {
                                    let derivedYear = row.academic_year;

                                    if (!derivedYear && row.absence_date) derivedYear = getAcademicYearFromDate(row.absence_date);
                                    if (!derivedYear && row.extra_data) {
                                        try {
                                            let extra = JSON.parse(row.extra_data);
                                            derivedYear = extra.academic_year || extra.schoolYear || extra.year || extra.school_year;
                                        } catch (e) { }
                                    }

                                    if (!derivedYear) derivedYear = globalFallbackYear;

                                    let normalizedYear = normalizeAcademicYear(derivedYear);
                                    if (normalizedYear && normalizedYear !== row.academic_year) {
                                        fixQueries.push({ sql: `UPDATE OR REPLACE ${table} SET academic_year = ? WHERE id = ?`, params: [normalizedYear, row.id] });
                                    }
                                });
                            }
                            resTable();
                        });
                    });
                });

                Promise.all(tablePromises).then(() => {
                    if (fixQueries.length === 0) return resolve();

                    console.log(`[Auto-Recovery] Repairing ${fixQueries.length} records...`);
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');
                        fixQueries.forEach(q => db.run(q.sql, q.params));
                        db.run('COMMIT', (err) => {
                            if (err) db.run('ROLLBACK');
                            else console.log(`[Auto-Recovery] Successfully repaired ${fixQueries.length} records.`);
                            resolve();
                        });
                    });
                }).catch(() => resolve());
            });
        });
    });
}

function runDatabaseHealthCheck() {
    return queueDBTask(async function () {
        if (!db) return null;

        try {
            var report = {
                checked_at: new Date().toISOString(),
                students_total: 0,
                results_total: 0,
                teachers_total: 0,
                students_missing_class_number: 0,
                students_noncanonical_level: 0,
                results_missing_student_id: 0,
                results_historical: 0,
                results_noncanonical_level: 0,
                activity_evals_noncanonical_level: 0,
                orphan_results_by_student_id: 0
            };

            var totals = await Promise.all([
                dbGetAsync('SELECT COUNT(*) AS c FROM students'),
                dbGetAsync('SELECT COUNT(*) AS c FROM results'),
                dbGetAsync('SELECT COUNT(*) AS c FROM teachers'),
                dbGetAsync("SELECT COUNT(*) AS c FROM students WHERE class_number IS NULL OR TRIM(COALESCE(class_number, '')) = ''"),
                dbGetAsync("SELECT COUNT(*) AS c FROM students WHERE level NOT IN ('أولى', 'ثانية', 'ثالثة', 'رابعة')"),
                dbGetAsync("SELECT COUNT(*) AS c FROM results WHERE student_id IS NULL OR TRIM(COALESCE(student_id, '')) = ''"),
                dbGetAsync("SELECT COUNT(*) AS c FROM results WHERE extra_data LIKE '%\"is_historical\":true%'"),
                dbGetAsync("SELECT COUNT(*) AS c FROM results WHERE level NOT IN ('أولى', 'ثانية', 'ثالثة', 'رابعة')"),
                dbGetAsync("SELECT COUNT(*) AS c FROM activity_evaluations WHERE level NOT IN ('أولى', 'ثانية', 'ثالثة', 'رابعة')"),
                dbGetAsync("SELECT COUNT(*) AS c FROM results r LEFT JOIN students s ON s.id = r.student_id WHERE r.student_id IS NOT NULL AND TRIM(COALESCE(r.student_id, '')) <> '' AND s.id IS NULL")
            ]);

            report.students_total = (totals[0] && totals[0].c) || 0;
            report.results_total = (totals[1] && totals[1].c) || 0;
            report.teachers_total = (totals[2] && totals[2].c) || 0;
            report.students_missing_class_number = (totals[3] && totals[3].c) || 0;
            report.students_noncanonical_level = (totals[4] && totals[4].c) || 0;
            report.results_missing_student_id = (totals[5] && totals[5].c) || 0;
            report.results_historical = (totals[6] && totals[6].c) || 0;
            report.results_noncanonical_level = (totals[7] && totals[7].c) || 0;
            report.activity_evals_noncanonical_level = (totals[8] && totals[8].c) || 0;
            report.orphan_results_by_student_id = (totals[9] && totals[9].c) || 0;

            await dbRunAsync(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))',
                ['databaseHealthReport', JSON.stringify(report)]
            );

            console.log('[DB Health]', JSON.stringify(report));
            return report;
        } catch (err) {
            console.warn('[DB Health] Failed:', err && err.message ? err.message : err);
            return null;
        }
    });
}

// ============================================================
// IPC Handlers for SQLite Operations (Promisified)
// ============================================================
function registerDatabaseIpcHandlers(ipcMain) {
    var context = {
        app: app,
        dialog: dialog,
        getAcademicYearFromDate: getAcademicYearFromDate,
        getDatabasePath: getDatabasePath,
        getDb: getDb,
        hydrateStudentRow: hydrateStudentRow,
        ipcMain: ipcMain,
        normalizeAcademicYear: normalizeAcademicYear,
        normalizeClassNumberValue: normalizeClassNumberValue,
        normalizeLevelStorageValue: normalizeLevelStorageValue,
        normalizeStudentColumnValue: normalizeStudentColumnValue,
        queueDBTask: queueDBTask
    };

    registerSettingsHandlers(context);
    registerStudentHandlers(context);
    registerAcademicHandlers(context);
    registerMaintenanceHandlers(context);
    registerAbsenceHandlers(context);
    registerUtilityHandlers(context);
    registerPhotoHandlers(context);
}

function getDatabasePath() {
    return DB_PATH;
}

function getDb() {
    return db;
}

function closeDatabase() {
    if (!db) {
        return;
    }

    try {
        db.close();
    } catch (err) {
        console.error('[SQLite] Error closing database:', err);
    }

    db = null;
}

module.exports = {
    closeDatabase,
    getDb,
    initDatabase,
    queueDBTask,
    registerDatabaseIpcHandlers
};


