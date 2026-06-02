/**
 * Student Photo IPC Handlers
 * Manages student photos as individual files in the userData directory.
 * Photos are stored as compressed WebP files named by student ID.
 */
module.exports = function (context) {
    var ipcMain = context.ipcMain;
    var app = context.app;
    var getDb = context.getDb;
    var fs = require('fs');
    var path = require('path');

    var PHOTOS_DIR = path.join(app.getPath('userData'), 'student_photos');

    // Ensure photos directory exists
    function ensurePhotosDir() {
        if (!fs.existsSync(PHOTOS_DIR)) {
            fs.mkdirSync(PHOTOS_DIR, { recursive: true });
        }
    }

    /**
     * Get the file path for a student's photo
     */
    function getPhotoPath(studentId) {
        return path.join(PHOTOS_DIR, studentId + '.webp');
    }

    function readPhotoByStudentId(studentId, resolve) {
        if (!studentId) {
            resolve(null);
            return;
        }

        ensurePhotosDir();

        var photoPath = getPhotoPath(String(studentId));
        if (!fs.existsSync(photoPath)) {
            resolve(null);
            return;
        }

        fs.readFile(photoPath, function (err, data) {
            if (err) {
                console.error('[Photos] Error reading photo for', studentId, ':', err.message);
                resolve(null);
                return;
            }

            resolve({
                success: true,
                studentId: String(studentId),
                data: 'data:image/webp;base64,' + data.toString('base64')
            });
        });
    }

    function normalizeDigits(value) {
        return String(value || '').replace(/[٠-٩]/g, function (digit) {
            return String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit));
        });
    }

    function normalizeText(value) {
        return normalizeDigits(value)
            .trim()
            .replace(/[إأآ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/ؤ/g, 'و')
            .replace(/ئ/g, 'ي')
            .replace(/[\u064B-\u065F\u0670]/g, '')
            .replace(/\s+/g, ' ');
    }

    function compactText(value) {
        return normalizeText(value).replace(/\s+/g, '');
    }

    function normalizeLevelValue(value) {
        var raw = normalizeText(value || '');
        if (!raw) return '';
        if (raw.indexOf('1') !== -1 || raw.indexOf('اول') !== -1) return '1';
        if (raw.indexOf('2') !== -1 || raw.indexOf('ثان') !== -1) return '2';
        if (raw.indexOf('3') !== -1 || raw.indexOf('ثالث') !== -1) return '3';
        if (raw.indexOf('4') !== -1 || raw.indexOf('رابع') !== -1) return '4';
        return raw;
    }

    function normalizeClassValue(value) {
        var normalized = compactText(value).replace(/[^\dA-Za-z\u0600-\u06FF]/g, '');
        if (/^\d+$/.test(normalized)) {
            return String(parseInt(normalized, 10));
        }
        return normalized;
    }

    function normalizeAcademicYear(value) {
        return normalizeText(value).replace(/\//g, '-');
    }

    function normalizeDateValue(value) {
        var normalized = normalizeDigits(value).trim();
        if (!normalized) return '';

        var parts = normalized.split(/[^\d]+/).filter(Boolean);
        if (parts.length !== 3) {
            return normalized.replace(/[^\d]/g, '');
        }

        var year;
        var month;
        var day;

        if (parts[0].length === 4) {
            year = parts[0];
            month = parts[1];
            day = parts[2];
        } else if (parts[2].length === 4) {
            year = parts[2];
            month = parts[1];
            day = parts[0];
        } else {
            return parts.join('');
        }

        month = month.padStart(2, '0');
        day = day.padStart(2, '0');
        return year + month + day;
    }

    function buildPayloadNameCandidates(payload) {
        var candidates = [];
        var fullName = payload.fullName || payload.studentName || payload.name || '';
        var firstName = payload.firstName || '';
        var lastName = payload.lastName || '';

        if (fullName) {
            candidates.push(compactText(fullName));
        }

        if (firstName || lastName) {
            candidates.push(compactText(lastName + ' ' + firstName));
            candidates.push(compactText(firstName + ' ' + lastName));
        }

        return candidates.filter(Boolean);
    }

    function buildRowNameCandidates(row) {
        var candidates = [];
        var lastName = row.last_name || '';
        var firstName = row.first_name || '';

        candidates.push(compactText(lastName + ' ' + firstName));
        candidates.push(compactText(firstName + ' ' + lastName));

        if (row.name) {
            candidates.push(compactText(row.name));
        }

        return candidates.filter(Boolean);
    }

    function hasSharedCandidate(a, b) {
        var i;
        for (i = 0; i < a.length; i += 1) {
            if (b.indexOf(a[i]) !== -1) {
                return true;
            }
        }
        return false;
    }

    /**
     * Save a student photo
     * Expects: { studentId: string, photoData: string (base64 data without prefix) }
     * Returns: { success: boolean, path?: string, error?: string }
     */
    ipcMain.handle('db-save-student-photo', function (event, payload) {
        return new Promise(function (resolve) {
            try {
                if (!payload || !payload.studentId || !payload.photoData) {
                    resolve({ success: false, error: 'missing_data' });
                    return;
                }

                ensurePhotosDir();

                var studentId = String(payload.studentId);
                var photoPath = getPhotoPath(studentId);

                // Remove the data URL prefix if present (e.g., "data:image/webp;base64,")
                var base64Data = payload.photoData;
                var prefixMatch = base64Data.match(/^data:[^;]+;base64,/);
                if (prefixMatch) {
                    base64Data = base64Data.substring(prefixMatch[0].length);
                }

                var buffer = Buffer.from(base64Data, 'base64');

                fs.writeFile(photoPath, buffer, function (err) {
                    if (err) {
                        console.error('[Photos] Error saving photo for', studentId, ':', err.message);
                        resolve({ success: false, error: err.message });
                    } else {
                        var stats = fs.statSync(photoPath);
                        console.log('[Photos] Saved photo for', studentId, '- Size:', Math.round(stats.size / 1024), 'KB');
                        resolve({ success: true, path: photoPath, sizeKB: Math.round(stats.size / 1024) });
                    }
                });
            } catch (e) {
                console.error('[Photos] Unexpected error saving photo:', e);
                resolve({ success: false, error: e.message });
            }
        });
    });

    /**
     * Get a student photo
     * Expects: studentId (string)
     * Returns: { success: boolean, data?: string (base64 data URL), error?: string } or null
     */
    ipcMain.handle('db-get-student-photo', function (event, studentId) {
        return new Promise(function (resolve) {
            try {
                if (!studentId) {
                    resolve(null);
                    return;
                }

                ensurePhotosDir();
                readPhotoByStudentId(String(studentId), resolve);
            } catch (e) {
                console.error('[Photos] Unexpected error reading photo:', e);
                resolve(null);
            }
        });
    });

    ipcMain.handle('db-get-student-photo-by-identity', function (event, payload) {
        return new Promise(function (resolve) {
            try {
                if (!payload || typeof payload !== 'object') {
                    resolve(null);
                    return;
                }

                var db = typeof getDb === 'function' ? getDb() : null;
                if (!db) {
                    resolve(null);
                    return;
                }

                var payloadNameCandidates = buildPayloadNameCandidates(payload);
                var payloadLevel = normalizeLevelValue(payload.level || '');
                var payloadClass = normalizeClassValue(payload.classValue || payload.class || payload.class_number || '');
                var payloadDob = normalizeDateValue(payload.dob || payload.birth_date || '');
                var payloadAcademicYear = normalizeAcademicYear(payload.academicYear || payload.schoolYear || payload.year || '');

                db.all('SELECT id, last_name, first_name, birth_date, level, class_number, academic_year FROM students', function (err, rows) {
                    if (err || !rows || !rows.length) {
                        if (err) {
                            console.error('[Photos] Identity photo lookup query failed:', err.message);
                        }
                        resolve(null);
                        return;
                    }

                    var strictMatches = [];
                    var relaxedMatches = [];

                    rows.forEach(function (row) {
                        var rowLevel = normalizeLevelValue(row.level || '');
                        var rowClass = normalizeClassValue(row.class_number || row.class || '');
                        var rowDob = normalizeDateValue(row.birth_date || row.dob || '');
                        var rowYear = normalizeAcademicYear(row.academic_year || '');
                        var rowNameCandidates = buildRowNameCandidates(row);

                        if (payloadLevel && rowLevel !== payloadLevel) return;
                        if (payloadClass && rowClass !== payloadClass) return;
                        if (payloadDob && rowDob !== payloadDob) return;
                        if (payloadNameCandidates.length && !hasSharedCandidate(payloadNameCandidates, rowNameCandidates)) return;

                        if (payloadAcademicYear && rowYear === payloadAcademicYear) {
                            strictMatches.push(row);
                        } else {
                            relaxedMatches.push(row);
                        }
                    });

                    var rankedMatches = strictMatches.concat(relaxedMatches).filter(function (row) {
                        return fs.existsSync(getPhotoPath(String(row.id)));
                    });

                    if (!rankedMatches.length) {
                        resolve(null);
                        return;
                    }

                    readPhotoByStudentId(String(rankedMatches[0].id), resolve);
                });
            } catch (e) {
                console.error('[Photos] Identity photo lookup failed:', e);
                resolve(null);
            }
        });
    });

    /**
     * Delete a student photo
     * Expects: studentId (string)
     * Returns: { success: boolean }
     */
    ipcMain.handle('db-delete-student-photo', function (event, studentId) {
        return new Promise(function (resolve) {
            try {
                if (!studentId) {
                    resolve({ success: false, error: 'missing_id' });
                    return;
                }

                var photoPath = getPhotoPath(String(studentId));

                if (!fs.existsSync(photoPath)) {
                    resolve({ success: true }); // Already gone
                    return;
                }

                fs.unlink(photoPath, function (err) {
                    if (err) {
                        console.error('[Photos] Error deleting photo for', studentId, ':', err.message);
                        resolve({ success: false, error: err.message });
                    } else {
                        console.log('[Photos] Deleted photo for', studentId);
                        resolve({ success: true });
                    }
                });
            } catch (e) {
                console.error('[Photos] Unexpected error deleting photo:', e);
                resolve({ success: false, error: e.message });
            }
        });
    });

    /**
     * Check if a student has a photo
     * Expects: studentId (string)
     * Returns: boolean
     */
    ipcMain.handle('db-has-student-photo', function (event, studentId) {
        try {
            if (!studentId) return false;
            var photoPath = getPhotoPath(String(studentId));
            return fs.existsSync(photoPath);
        } catch (e) {
            return false;
        }
    });
};
