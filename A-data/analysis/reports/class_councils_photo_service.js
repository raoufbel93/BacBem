(function (global) {
    var studentsCatalogPromise = null;

    function buildIdentityPayload(student) {
        if (!student) return null;

        return {
            studentId: student.id || '',
            studentName: student.student_name || student.name || '',
            firstName: student.first_name || '',
            lastName: student.last_name || '',
            level: student.level || '',
            classValue: student.class || student.class_number || '',
            dob: student.dob || student.birth_date || '',
            academicYear: student.academic_year || student.schoolYear || student.year || ''
        };
    }

    function getIpc() {
        return global.ipcRenderer || (global.electronAPI && global.electronAPI.ipcRenderer) || null;
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

        return year + month.padStart(2, '0') + day.padStart(2, '0');
    }

    function normalizeLevelValue(value) {
        var normalized = normalizeText(value);
        var digitMatch = normalizeDigits(value).match(/\d+/);
        return {
            raw: normalized,
            digit: digitMatch ? digitMatch[0] : ''
        };
    }

    function buildNameCandidates(payload) {
        var candidates = [];
        var studentName = payload.studentName || payload.fullName || payload.name || '';
        var firstName = payload.firstName || '';
        var lastName = payload.lastName || '';

        if (studentName) {
            candidates.push(compactText(studentName));
        }

        if (firstName || lastName) {
            candidates.push(compactText(lastName + ' ' + firstName));
            candidates.push(compactText(firstName + ' ' + lastName));
        }

        return candidates.filter(Boolean);
    }

    function buildRowNameCandidates(row) {
        var lastName = row.last_name || '';
        var firstName = row.first_name || '';
        var fullName = row.name || row.student_name || '';

        return [
            compactText(lastName + ' ' + firstName),
            compactText(firstName + ' ' + lastName),
            compactText(fullName)
        ].filter(Boolean);
    }

    function hasSharedCandidate(source, target) {
        return source.some(function (candidate) {
            return target.indexOf(candidate) !== -1;
        });
    }

    function getStudentsCatalog() {
        if (studentsCatalogPromise) {
            return studentsCatalogPromise;
        }

        if (!global.DB || typeof global.DB.getStudents !== 'function') {
            return Promise.resolve([]);
        }

        studentsCatalogPromise = global.DB.getStudents(true, true).then(function (rows) {
            return Array.isArray(rows) ? rows : [];
        }).catch(function () {
            return [];
        });

        return studentsCatalogPromise;
    }

    function findMatchingStudent(payload, rows) {
        var payloadNames = buildNameCandidates(payload);
        var payloadLevel = normalizeLevelValue(payload.level || '');
        var payloadClass = normalizeClassValue(payload.classValue || payload.class || payload.class_number || '');
        var payloadDob = normalizeDateValue(payload.dob || payload.birth_date || '');
        var payloadYear = normalizeAcademicYear(payload.academicYear || payload.schoolYear || payload.year || '');

        var strictMatches = [];
        var relaxedMatches = [];

        rows.forEach(function (row) {
            var rowNames = buildRowNameCandidates(row);
            var rowLevel = normalizeLevelValue(row.level || '');
            var rowClass = normalizeClassValue(row.class_number || row.class || '');
            var rowDob = normalizeDateValue(row.birth_date || row.dob || '');
            var rowYear = normalizeAcademicYear(row.academic_year || row.schoolYear || row.year || '');

            if (payloadNames.length && !hasSharedCandidate(payloadNames, rowNames)) return;
            if (payloadClass && rowClass !== payloadClass) return;
            if (payloadDob && rowDob !== payloadDob) return;

            if (payloadLevel.raw || payloadLevel.digit) {
                var levelMatches = false;
                if (payloadLevel.raw && rowLevel.raw && payloadLevel.raw === rowLevel.raw) {
                    levelMatches = true;
                }
                if (!levelMatches && payloadLevel.digit && rowLevel.digit && payloadLevel.digit === rowLevel.digit) {
                    levelMatches = true;
                }
                if (!levelMatches) return;
            }

            if (payloadYear && rowYear === payloadYear) {
                strictMatches.push(row);
            } else {
                relaxedMatches.push(row);
            }
        });

        return strictMatches[0] || relaxedMatches[0] || null;
    }

    function loadPhotoForStudent(student) {
        var ipc = getIpc();
        if (!ipc || !student) {
            return Promise.resolve(null);
        }

        var payload = buildIdentityPayload(student);
        if (!payload) {
            return Promise.resolve(null);
        }

        var directLookup = payload.studentId
            ? ipc.invoke('db-get-student-photo', payload.studentId).catch(function () { return null; })
            : Promise.resolve(null);

        return directLookup.then(function (directResult) {
            if (directResult && directResult.success && directResult.data) {
                return directResult;
            }

            return getStudentsCatalog().then(function (rows) {
                var matchedStudent = findMatchingStudent(payload, rows);
                if (matchedStudent && matchedStudent.id) {
                    return ipc.invoke('db-get-student-photo', matchedStudent.id).catch(function () { return null; });
                }

                return ipc.invoke('db-get-student-photo-by-identity', payload).catch(function () {
                    return null;
                });
            });
        });
    }

    global.ClassCouncilsPhotoService = {
        buildIdentityPayload: buildIdentityPayload,
        loadPhotoForStudent: loadPhotoForStudent
    };
})(window);
