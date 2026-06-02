/**
 * Database Schema + Data Migrations
 * Uses PRAGMA user_version to track sequential upgrades.
 */

function dbRunAsync(db, sql, params) {
    return new Promise(function (resolve, reject) {
        db.run(sql, params || [], function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbAllAsync(db, sql, params) {
    return new Promise(function (resolve, reject) {
        db.all(sql, params || [], function (err, rows) {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function dbGetAsync(db, sql, params) {
    return new Promise(function (resolve, reject) {
        db.get(sql, params || [], function (err, row) {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

function safeJsonParse(value, fallback) {
    if (!value || typeof value !== 'string') return fallback;
    try {
        return JSON.parse(value);
    } catch (e) {
        return fallback;
    }
}

function normalizeText(value) {
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

function normalizeCompact(value) {
    return normalizeText(value).replace(/\s+/g, '');
}

function normalizeDateToken(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';

    var parts = raw.split(/[^\d]+/).filter(Boolean);
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
        }
        if (parts[2].length === 4) {
            return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
        }
    }

    return raw;
}

function getLevelNumber(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';

    var normalized = normalizeText(raw);
    var digitMatch = raw.match(/[1-4]/);
    if (digitMatch) return digitMatch[0];

    if (normalized.indexOf('اول') !== -1) return '1';
    if (normalized.indexOf('ثان') !== -1) return '2';
    if (normalized.indexOf('ثالث') !== -1) return '3';
    if (normalized.indexOf('رابع') !== -1) return '4';
    return '';
}

function normalizeLevelValue(value) {
    switch (getLevelNumber(value)) {
        case '1': return 'أولى';
        case '2': return 'ثانية';
        case '3': return 'ثالثة';
        case '4': return 'رابعة';
        default: {
            var raw = String(value || '').trim();
            return raw || null;
        }
    }
}

function normalizeClassNumberValue(value) {
    if (value === null || value === undefined) return null;

    var raw = String(value).trim();
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

function buildStudentNameCandidatesFromStudent(row) {
    var lastName = String(row.last_name || '').trim();
    var firstName = String(row.first_name || '').trim();
    var fullName = [lastName, firstName].filter(Boolean).join(' ').trim();
    var reverseName = [firstName, lastName].filter(Boolean).join(' ').trim();
    var candidates = [fullName];
    if (reverseName && reverseName !== fullName) candidates.push(reverseName);
    return candidates.map(normalizeCompact).filter(Boolean);
}

function buildStudentNameCandidatesFromResult(row) {
    var fullName = String(row.student_name || row.name || '').trim();
    return [normalizeCompact(fullName)].filter(Boolean);
}

function buildLookupKeys(year, nameKey, dob, level, classNum) {
    return [
        [year, nameKey, dob, level, classNum].join('|'),
        [year, nameKey, dob, level].join('|'),
        [year, nameKey, dob].join('|'),
        [nameKey, dob, level, classNum].join('|'),
        [nameKey, dob].join('|')
    ];
}

function applyUpdates(db, updates) {
    if (!updates.length) return Promise.resolve(0);

    return dbRunAsync(db, 'BEGIN TRANSACTION').then(function () {
        var chain = Promise.resolve();

        updates.forEach(function (update) {
            chain = chain.then(function () {
                return dbRunAsync(db, update.sql, update.params);
            });
        });

        return chain.then(function () {
            return dbRunAsync(db, 'COMMIT');
        }).then(function () {
            return updates.length;
        }).catch(function (err) {
            return dbRunAsync(db, 'ROLLBACK').then(function () {
                throw err;
            }).catch(function () {
                throw err;
            });
        });
    });
}

function backfillResultsStudentIds(db, options) {
    var normalizedOptions = options || {};

    return Promise.all([
        dbAllAsync(db, 'SELECT id, last_name, first_name, birth_date, level, class_number, academic_year FROM students'),
        dbAllAsync(db, 'SELECT id, student_id, student_name, dob, level, class, academic_year FROM results')
    ]).then(function (values) {
        var students = values[0] || [];
        var results = values[1] || [];
        if (!students.length || !results.length) return 0;

        var lookup = {};
        var studentIds = {};

        students.forEach(function (student) {
            if (!student.id) return;
            studentIds[String(student.id)] = true;

            var year = String(student.academic_year || '').trim();
            var dob = normalizeDateToken(student.birth_date || '');
            var level = normalizeCompact(normalizeLevelValue(student.level || '') || '');
            var classNum = normalizeClassNumberValue(student.class_number || '');
            classNum = classNum == null ? '' : String(classNum);

            buildStudentNameCandidatesFromStudent(student).forEach(function (nameKey) {
                buildLookupKeys(year, nameKey, dob, level, classNum).forEach(function (key) {
                    if (key && !lookup[key]) lookup[key] = String(student.id);
                });
            });
        });

        var updates = [];

        results.forEach(function (result) {
            var currentStudentId = String(result.student_id || '').trim();
            var shouldSkip = currentStudentId && studentIds[currentStudentId] && !normalizedOptions.revalidateExisting;
            if (shouldSkip) return;

            var year = String(result.academic_year || '').trim();
            var dob = normalizeDateToken(result.dob || '');
            var level = normalizeCompact(normalizeLevelValue(result.level || '') || '');
            var classNum = normalizeClassNumberValue(result.class || '');
            classNum = classNum == null ? '' : String(classNum);
            var matchedId = null;

            buildStudentNameCandidatesFromResult(result).some(function (nameKey) {
                return buildLookupKeys(year, nameKey, dob, level, classNum).some(function (key) {
                    if (lookup[key]) {
                        matchedId = lookup[key];
                        return true;
                    }
                    return false;
                });
            });

            if (!matchedId || matchedId === currentStudentId) return;

            updates.push({
                sql: 'UPDATE results SET student_id = ? WHERE id = ?',
                params: [matchedId, result.id]
            });
        });

        if (!updates.length) return 0;

        console.log('[Migration] Backfilling ' + updates.length + ' result record(s) with student_id');
        return applyUpdates(db, updates);
    });
}

function markHistoricalResults(db) {
    return dbGetAsync(db, "SELECT value FROM settings WHERE key = 'institutionSettings'").then(function (settingsRow) {
        var settings = settingsRow ? safeJsonParse(settingsRow.value, {}) : {};
        var currentAcademicYear = String(
            (settings && (settings.currentAcademicYear || settings.schoolYear || settings.year || settings.school_year)) || ''
        ).trim();

        var currentYearPromise = currentAcademicYear
            ? Promise.resolve(currentAcademicYear)
            : dbGetAsync(
                db,
                "SELECT academic_year FROM students WHERE academic_year IS NOT NULL AND TRIM(COALESCE(academic_year, '')) <> '' GROUP BY academic_year ORDER BY COUNT(*) DESC, academic_year DESC LIMIT 1"
            ).then(function (row) {
                return row ? String(row.academic_year || '').trim() : '';
            });

        return currentYearPromise.then(function (resolvedCurrentAcademicYear) {
            currentAcademicYear = resolvedCurrentAcademicYear;
            if (!currentAcademicYear) return 0;

            return dbAllAsync(
                db,
                "SELECT id, student_id, academic_year, extra_data FROM results WHERE student_id IS NULL OR TRIM(COALESCE(student_id, '')) = ''"
            ).then(function (rows) {
                var updates = [];

                (rows || []).forEach(function (row) {
                    var resultYear = String(row.academic_year || '').trim();
                    if (!resultYear || resultYear === currentAcademicYear) return;

                    var extra = safeJsonParse(row.extra_data, {});
                    if (!extra || typeof extra !== 'object') extra = {};

                    if (
                        extra.is_historical === true &&
                        extra.historical_reason === 'student_not_in_current_roster' &&
                        extra.historical_academic_year === resultYear
                    ) {
                        return;
                    }

                    extra.is_historical = true;
                    extra.historical_reason = 'student_not_in_current_roster';
                    extra.historical_academic_year = resultYear;

                    updates.push({
                        sql: "UPDATE results SET extra_data = ?, updated_at = datetime('now') WHERE id = ?",
                        params: [JSON.stringify(extra), row.id]
                    });
                });

                if (!updates.length) return 0;

                console.log('[Migration] Marking ' + updates.length + ' result record(s) as historical');
                return applyUpdates(db, updates);
            });
        });
    });
}

var MIGRATIONS = [
    {
        version: 1,
        description: 'Add student_id column and index to results table',
        up: function (db) {
            return dbRunAsync(db, 'ALTER TABLE results ADD COLUMN student_id TEXT')
                .catch(function (err) {
                    if (err && err.message && err.message.indexOf('duplicate column') !== -1) return;
                    throw err;
                })
                .then(function () {
                    return dbRunAsync(db, 'CREATE INDEX IF NOT EXISTS idx_results_student_id ON results(student_id)');
                });
        }
    },
    {
        version: 2,
        description: 'Initial backfill of student_id in results from students table',
        up: function (db) {
            return backfillResultsStudentIds(db, { revalidateExisting: false });
        }
    },
    {
        version: 3,
        description: 'Backfill students.class_number and normalize student level labels',
        up: function (db) {
            return dbAllAsync(db, 'SELECT id, level, class_number, extra_data FROM students').then(function (rows) {
                var updates = [];

                (rows || []).forEach(function (row) {
                    var extra = safeJsonParse(row.extra_data, {});
                    var nextLevel = normalizeLevelValue(row.level || (extra && extra.level) || '');
                    var nextClass = normalizeClassNumberValue(
                        row.class_number ||
                        (extra && (extra.class_number || extra.class)) ||
                        ''
                    );
                    var setClauses = [];
                    var params = [];

                    if (nextLevel && nextLevel !== row.level) {
                        setClauses.push('level = ?');
                        params.push(nextLevel);
                    }
                    if (nextClass && nextClass !== row.class_number) {
                        setClauses.push('class_number = ?');
                        params.push(nextClass);
                    }

                    if (!setClauses.length) return;

                    setClauses.push("updated_at = datetime('now')");
                    params.push(row.id);
                    updates.push({
                        sql: 'UPDATE students SET ' + setClauses.join(', ') + ' WHERE id = ?',
                        params: params
                    });
                });

                if (!updates.length) return 0;

                console.log('[Migration v3] Updating ' + updates.length + ' student record(s)');
                return applyUpdates(db, updates);
            });
        }
    },
    {
        version: 4,
        description: 'Normalize level and class labels in results and activity evaluations',
        up: function (db) {
            return Promise.all([
                dbAllAsync(db, 'SELECT id, level, class FROM results'),
                dbAllAsync(db, 'SELECT id, level, class_number FROM activity_evaluations')
            ]).then(function (values) {
                var resultRows = values[0] || [];
                var evalRows = values[1] || [];
                var updates = [];

                resultRows.forEach(function (row) {
                    var nextLevel = normalizeLevelValue(row.level || '');
                    var nextClass = normalizeClassNumberValue(row.class || '');
                    var setClauses = [];
                    var params = [];

                    if (nextLevel && nextLevel !== row.level) {
                        setClauses.push('level = ?');
                        params.push(nextLevel);
                    }
                    if (nextClass && nextClass !== row.class) {
                        setClauses.push('class = ?');
                        params.push(nextClass);
                    }
                    if (!setClauses.length) return;

                    setClauses.push("updated_at = datetime('now')");
                    params.push(row.id);
                    updates.push({
                        sql: 'UPDATE results SET ' + setClauses.join(', ') + ' WHERE id = ?',
                        params: params
                    });
                });

                evalRows.forEach(function (row) {
                    var nextLevel = normalizeLevelValue(row.level || '');
                    var nextClass = normalizeClassNumberValue(row.class_number || '');
                    var setClauses = [];
                    var params = [];

                    if (nextLevel && nextLevel !== row.level) {
                        setClauses.push('level = ?');
                        params.push(nextLevel);
                    }
                    if (nextClass && nextClass !== row.class_number) {
                        setClauses.push('class_number = ?');
                        params.push(nextClass);
                    }
                    if (!setClauses.length) return;

                    setClauses.push("updated_at = datetime('now')");
                    params.push(row.id);
                    updates.push({
                        sql: 'UPDATE activity_evaluations SET ' + setClauses.join(', ') + ' WHERE id = ?',
                        params: params
                    });
                });

                if (!updates.length) return 0;

                console.log('[Migration v4] Updating ' + updates.length + ' academic record(s)');
                return applyUpdates(db, updates);
            });
        }
    },
    {
        version: 5,
        description: 'Re-run results to students linking after level and class normalization',
        up: function (db) {
            return backfillResultsStudentIds(db, { revalidateExisting: true });
        }
    },
    {
        version: 6,
        description: 'Mark unmatched results from past academic years as historical',
        up: function (db) {
            return markHistoricalResults(db);
        }
    },
    {
        version: 7,
        description: 'Add bac_streams column to official_exam_center',
        up: function (db) {
            return dbRunAsync(db, "ALTER TABLE official_exam_center ADD COLUMN bac_streams TEXT DEFAULT '[]'")
                .catch(function (err) {
                    if (err && err.message && err.message.indexOf('duplicate column') !== -1) return;
                    throw err;
                });
        }
    }
];

function runMigrations(db) {
    return dbGetAsync(db, 'PRAGMA user_version').then(function (row) {
        var currentVersion = (row && row.user_version) || 0;
        var pending = MIGRATIONS.filter(function (migration) {
            return migration.version > currentVersion;
        });

        if (!pending.length) return;

        console.log('[Migrations] Schema v' + currentVersion + ' -> running ' + pending.length + ' migration(s)...');

        var chain = Promise.resolve();
        pending.forEach(function (migration) {
            chain = chain.then(function () {
                console.log('[Migration v' + migration.version + '] ' + migration.description + '...');
                return migration.up(db).then(function () {
                    return dbRunAsync(db, 'PRAGMA user_version = ' + migration.version);
                }).then(function () {
                    console.log('[Migration v' + migration.version + '] Complete');
                });
            });
        });

        return chain.then(function () {
            console.log('[Migrations] All migrations complete.');
        }).catch(function (err) {
            console.error('[Migrations] FATAL ERROR:', err);
        });
    });
}

module.exports = {
    runMigrations: runMigrations
};
