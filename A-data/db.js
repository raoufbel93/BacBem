/**
 * SQLite-backed Database Utility
 * Provides the same unified interface as the original db.js
 * Routes all operations through Electron IPC to SQLite in the main process
 * ES5 compatible for Windows 7 / IE11 support
 */

window.AppDbModules = window.AppDbModules || {};

(function loadDbSupportModules() {
    try {
        var req = typeof window !== 'undefined'
            ? (window.require || (typeof require !== 'undefined' ? require : null))
            : null;

        if (!req || typeof document === 'undefined') return;

        var fs = req('fs');
        var path = req('path');
        var url = req('url');
        var currentScript = document.currentScript;
        var scriptPath = '';
        var loadedMap = window.AppDbModules.__loaded || {};

        if (currentScript && currentScript.src && url && typeof url.fileURLToPath === 'function') {
            try {
                scriptPath = url.fileURLToPath(currentScript.src);
            } catch (e) { }
        }

        if (!scriptPath) return;

        [
            'db/bridge.js',
            'db/year-utils.js',
            'db/storage-fallback.js',
            'db/sync.js',
            'db/settings-service.js',
            'db/students-service.js',
            'db/results-service.js',
            'db/teachers-service.js',
            'db/absences-service.js'
        ].forEach(function (relativePath) {
            var fullPath = path.join(path.dirname(scriptPath), relativePath);
            if (!fs.existsSync(fullPath) || loadedMap[fullPath]) return;

            var code = fs.readFileSync(fullPath, 'utf8');
            (0, eval)(code + '\n//# sourceURL=' + fullPath.replace(/\\/g, '/'));
            loadedMap[fullPath] = true;
        });

        window.AppDbModules.__loaded = loadedMap;
    } catch (e) {
        console.warn('[DB] Helper module load failed:', e);
    }
})();

// Initialize Electron IPC and Shell if in Electron environment
(function() {
    if (window.AppDbModules && typeof window.AppDbModules.detectElectronBridge === 'function') {
        try {
            if (window.AppDbModules.detectElectronBridge(window)) {
                return;
            }
        } catch (bridgeErr) {
            console.warn('DB bridge bootstrap failed:', bridgeErr);
        }
    }

    try {
        var electronObj = null;

        // 1. Try to find require (check window.require first, common in Electron)
        var req = typeof window !== 'undefined' ? (window.require || (typeof require !== 'undefined' ? require : null)) : null;

        // 2. If in an iframe, require may only exist on the parent/top window
        if (!req && typeof window !== 'undefined') {
            try {
                if (window.parent && window.parent !== window && window.parent.require) {
                    req = window.parent.require;
                }
            } catch (e) { /* cross-origin or security error */ }
            if (!req) {
                try {
                    if (window.top && window.top !== window && window.top.require) {
                        req = window.top.require;
                    }
                } catch (e) { /* cross-origin or security error */ }
            }
        }

        if (req) {
            try {
                electronObj = req('electron');
            } catch (e) {
                // Ignore if require('electron') fails
            }
        }

        if (electronObj) {
            window.ipcRenderer = electronObj.ipcRenderer;
            window.shell = electronObj.shell;
            console.log('[DB] Electron IPC detected successfully via require');
        } else if (window.ipcRenderer) {
            console.log('[DB] Electron IPC already exposed (e.g. via preload)');
        } else {
            // 3. Try to inherit ipcRenderer from parent/top window (iframe scenario)
            var inherited = false;
            try {
                if (window.parent && window.parent !== window && window.parent.ipcRenderer) {
                    window.ipcRenderer = window.parent.ipcRenderer;
                    window.shell = window.parent.shell;
                    inherited = true;
                    console.log('[DB] Electron IPC inherited from parent window');
                }
            } catch (e) {}
            if (!inherited) {
                try {
                    if (window.top && window.top !== window && window.top.ipcRenderer) {
                        window.ipcRenderer = window.top.ipcRenderer;
                        window.shell = window.top.shell;
                        inherited = true;
                        console.log('[DB] Electron IPC inherited from top window');
                    }
                } catch (e) {}
            }
        }

        // Expose a helper to check if we are in Electron
        window.isElectron = !!(window.ipcRenderer || (typeof process !== 'undefined' && process.versions && process.versions.electron));
    } catch (e) {
        console.warn('DB: Error detecting Electron environment:', e);
    }
})();

window.formatAcademicYear = function (y) { return y; };
var DB = (function () {
    var isReady = false;
    var readyPromise = null;
    var useSQLite = true; // Forced

    function getLevelNumber(levelValue) {
        var raw = String(levelValue || '').trim();
        if (!raw) return '1';

        var digitMatch = raw.match(/[1-4]/);
        if (digitMatch) return digitMatch[0];

        if (raw.indexOf('أولى') !== -1 || raw.indexOf('اولى') !== -1 || raw.indexOf('الأولى') !== -1) return '1';
        if (raw.indexOf('ثانية') !== -1 || raw.indexOf('الثانية') !== -1) return '2';
        if (raw.indexOf('ثالثة') !== -1 || raw.indexOf('الثالثة') !== -1) return '3';
        if (raw.indexOf('رابعة') !== -1 || raw.indexOf('الرابعة') !== -1) return '4';

        return '1';
    }

    function getCanonicalLevelWord(levelValue) {
        switch (getLevelNumber(levelValue)) {
            case '1': return 'أولى';
            case '2': return 'ثانية';
            case '3': return 'ثالثة';
            case '4': return 'رابعة';
            default: return String(levelValue || '').trim();
        }
    }

    /**
     * Get the current academic year in Algeria based on the system date
     * September (9) to December (12) -> Year/Year+1
     * January (1) to August (8) -> Year-1/Year
     */
    function getCurrentAcademicYear() {
        if (window.AppDbModules && window.AppDbModules.yearUtils && typeof window.AppDbModules.yearUtils.getCurrentAcademicYear === 'function') {
            return window.AppDbModules.yearUtils.getCurrentAcademicYear();
        }

        var now = new Date();
        var year = now.getFullYear();
        var month = now.getMonth() + 1; // 1-12

        if (month >= 9) {
            return (year + 1) + "/" + year;
        } else {
            return year + "/" + (year - 1);
        }
    }

    /**
     * Initialize the database
     * Checks if SQLite is available via IPC, migrates data if needed
     */
    function init() {
        if (readyPromise) return readyPromise;

        readyPromise = new Promise(function (resolve, reject) {
            var retryCount = 0;
            var maxRetries = 50; // Increased to 5s for slower systems or nested iframes

            function checkIPC() {
                if (window.ipcRenderer) {
                    window.ipcRenderer.invoke('db-is-migrated').then(function (migrated) {
                        useSQLite = true;
                        isReady = true;
                        console.log('[DB] SQLite mode active. Migrated:', migrated);
                        // No automatic migration - user can trigger it manually from Data Management page
                        resolve(true);
                    }).catch(function (err) {
                        console.warn('[DB] SQLite not available, falling back to localStorage:', err);
                        useSQLite = false;
                        isReady = true;
                        resolve(false);
                    });
                } else if (retryCount < maxRetries) {
                    retryCount++;
                    console.log('[DB] IPC not yet available, retrying... (' + retryCount + '/' + maxRetries + ')');
                    setTimeout(checkIPC, 100);
                } else {
                    console.warn('[DB] No IPC available after retries, falling back to localStorage');
                    useSQLite = false;
                    isReady = true;
                    resolve(false);
                }
            }

            checkIPC();
        });

        // Run health check and stamping logic asynchronously after initialization
        readyPromise.then(function (success) {
            if (success) {
                
                
            }
        });

        return readyPromise;
    }

    

    

    

    

    

    // ============================================================
    // Core API
    // ============================================================

    /**
     * Get a value from the database
     */
    function get(key) {
        return init().then(function () {
            // Route relational data to proper tables
                if (key === 'studentsList') {
                    return window.ipcRenderer.invoke('db-get-students', true).catch(function (e) {
                        console.error('[DB] Error getting students from relational table:', e);
                        return [];
                    });
                }
                if (key === 'schoolResults') {
                    return window.ipcRenderer.invoke('db-get-results').catch(function (e) {
                        console.error('[DB] Error getting results from relational table:', e);
                        return [];
                    });
                }
                if (key === 'annualResults') {
                    return window.ipcRenderer.invoke('db-get-annual-results').catch(function (e) {
                        console.error('[DB] Error getting annual results from relational table:', e);
                        return [];
                    });
                }
                if (key === 'teachersList') {
                    return window.ipcRenderer.invoke('db-get-teachers').catch(function (e) {
                        console.error('[DB] Error getting teachers from relational table:', e);
                        return [];
                    });
                }
                if (key === 'activityEvaluations') {
                    return window.ipcRenderer.invoke('db-get-activity-evals').catch(function (e) {
                        console.error('[DB] Error getting activity evals from relational table:', e);
                        return [];
                    });
                }
                if (key === 'certificateResults') {
                    return window.ipcRenderer.invoke('db-get', 'certificateResults').catch(function (e) {
                        return [];
                    });
                }
                return window.ipcRenderer.invoke('db-get', key).catch(function (e) {
                    console.error('[DB] SQLite get error:', e);
                    return Promise.resolve(null);
                });
        });
    }

    /**
     * Set a value in the database
     */
    function set(key, value) {
        return init().then(function () {
            // Route relational data to proper tables
                if (key === 'studentsList' && Array.isArray(value)) {
                    return window.ipcRenderer.invoke('db-save-students', value).catch(function (e) {
                        console.error('[DB] Error saving students to relational table:', e);
                        return false;
                    });
                }
                if (key === 'schoolResults' && Array.isArray(value)) {
                    return window.ipcRenderer.invoke('db-save-results', value).catch(function (e) {
                        console.error('[DB] Error saving results to relational table:', e);
                        return false;
                    });
                }
                if (key === 'annualResults' && Array.isArray(value)) {
                    return window.ipcRenderer.invoke('db-save-annual-results', { rows: value }).catch(function (e) {
                        console.error('[DB] Error saving annual results to relational table:', e);
                        return false;
                    });
                }
                if (key === 'teachersList' && Array.isArray(value)) {
                    return window.ipcRenderer.invoke('db-save-teachers', value).catch(function (e) {
                        console.error('[DB] Error saving teachers to relational table:', e);
                        return false;
                    });
                }
                if (key === 'activityEvaluations' && Array.isArray(value)) {
                    return window.ipcRenderer.invoke('db-save-activity-evals', value).catch(function (e) {
                        console.error('[DB] Error saving activity evals to relational table:', e);
                        return false;
                    });
                }
                return window.ipcRenderer.invoke('db-set', key, value).catch(function (e) {
                    console.error('[DB] SQLite set error:', e);
                    return true;
                });
        });
    }

    /**
     * Delete a value from the database
     */
    function remove(key) {
        return init().then(function () {
            function clearLocalShadow(targetKey) {
                var shadowKey = targetKey || key;
                try { localStorage.removeItem(shadowKey); } catch (e) { }
                try {
                    if (typeof DBSync !== 'undefined' && DBSync && DBSync._cache) {
                        delete DBSync._cache[shadowKey];
                    }
                } catch (e) { }
            }

            if (useSQLite) {
                // Route relational data to proper table clear
                if (key === 'studentsList') {
                    return window.ipcRenderer.invoke('db-clear-students').catch(function (e) {
                        console.error('[DB] Error clearing students:', e);
                        return false;
                    }).then(function (result) {
                        clearLocalShadow();
                        return result;
                    });
                }
                if (key === 'schoolResults') {
                    return window.ipcRenderer.invoke('db-clear-results').catch(function (e) {
                        console.error('[DB] Error clearing results:', e);
                        return false;
                    }).then(function (result) {
                        clearLocalShadow();
                        return window.ipcRenderer.invoke('db-remove', 'secondaryRemedialSubjectOverrides').catch(function (e) {
                            console.error('[DB] Error clearing secondary remedial overrides:', e);
                            return false;
                        }).then(function () {
                            clearLocalShadow('secondaryRemedialSubjectOverrides');
                            return result;
                        });
                    });
                }
                if (key === 'annualResults') {
                    return window.ipcRenderer.invoke('db-clear-annual-results', {}).catch(function (e) {
                        console.error('[DB] Error clearing annual results:', e);
                        return false;
                    }).then(function (result) {
                        clearLocalShadow();
                        return result;
                    });
                }
                if (key === 'teachersList') {
                    return window.ipcRenderer.invoke('db-clear-teachers').catch(function (e) {
                        console.error('[DB] Error clearing teachers:', e);
                        return false;
                    }).then(function (result) {
                        clearLocalShadow();
                        return result;
                    });
                }
                if (key === 'activityEvaluations') {
                    return window.ipcRenderer.invoke('db-clear-activity-evals').catch(function (e) {
                        console.error('[DB] Error clearing activity evals:', e);
                        return false;
                    }).then(function (result) {
                        clearLocalShadow();
                        return result;
                    });
                }
                return window.ipcRenderer.invoke('db-remove', key).catch(function (e) {
                    console.error('[DB] SQLite remove error:', e);
                    clearLocalShadow();
                    return false;
                }).then(function (result) {
                    clearLocalShadow();
                    return result;
                });
            }
            clearLocalShadow();
            return true;
        });
    }

    /**
     * Get all data from the database (for backup)
     * Merges settings with fresh relational table data
     */
    function getAllData() {
        return init().then(function () {
            if (useSQLite) {
                return Promise.all([
                    window.ipcRenderer.invoke('db-get-all'),
                    window.ipcRenderer.invoke('db-get-students', true),
                    window.ipcRenderer.invoke('db-get-results'),
                    window.ipcRenderer.invoke('db-get-annual-results'),
                    window.ipcRenderer.invoke('db-get-teachers')
                ]).then(function (values) {
                    var settingsData = values[0] || {};
                    // Remove stale KV entries, replace with fresh relational data
                    delete settingsData['studentsList'];
                    delete settingsData['schoolResults'];
                    delete settingsData['annualResults'];
                    delete settingsData['finalResultsData'];
                    delete settingsData['finalResults'];
                    delete settingsData['teachersList'];
                    settingsData['studentsList'] = values[1] || [];
                    settingsData['schoolResults'] = values[2] || [];
                    settingsData['annualResults'] = values[3] || [];
                    settingsData['teachersList'] = values[4] || [];
                    return settingsData;
                }).catch(function (e) {
                    console.error('[DB] SQLite getAll error:', e);
                    return Promise.resolve({});
                });
            }
            return Promise.resolve({});
        });
    }

    // ============================================================
    // localStorage fallback helpers
    // ============================================================

    

    

    

    var serviceCache = {};

    function resolveAuthUser() {
        var localToken = null;
        var user = null;

        try {
            localToken = localStorage.getItem('currentUser');
        } catch (e) { }

        if (!localToken) return null;

        if (typeof Auth !== 'undefined' && Auth.getUser) {
            try {
                user = Auth.getUser();
            } catch (e2) { }
        }

        if (!user) {
            try {
                user = JSON.parse(localToken);
            } catch (e3) { }
        }

        return user;
    }

    function getSharedServiceOptions() {
        return {
            get: get,
            set: set,
            init: init,
            localStorage: localStorage,
            getAuthUser: resolveAuthUser,
            getCurrentAcademicYear: getCurrentAcademicYear,
            getUseSQLite: function () { return useSQLite; },
            getIpcRenderer: function () { return window.ipcRenderer; }
        };
    }

    function getService(serviceName, factoryName) {
        if (!(window.AppDbModules && typeof window.AppDbModules[factoryName] === 'function')) {
            return null;
        }

        if (!serviceCache[serviceName]) {
            serviceCache[serviceName] = window.AppDbModules[factoryName](getSharedServiceOptions());
        }

        return serviceCache[serviceName];
    }

    // ============================================================
    // Public API (same interface as original db.js)
    // ============================================================
    return {
        init: init,
        get: get,
        set: set,
        remove: remove,
        getAllData: getAllData,
        getCurrentAcademicYear: getCurrentAcademicYear,

        getOfficialCenter: function() {
            return init().then(function() {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-get-official-center');
                }
                return get('officialExamCenterData');
            });
        },

        saveOfficialCenter: function(data) {
            return init().then(function() {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-save-official-center', data);
                }
                return set('officialExamCenterData', data);
            });
        },

        getOfficialCenterMembers: function () {
            return init().then(function () {
                return get('officialExamCenterMembers').then(function (members) {
                    return Array.isArray(members) ? members : [];
                });
            });
        },

        saveOfficialCenterMembers: function (members) {
            return init().then(function () {
                return set('officialExamCenterMembers', Array.isArray(members) ? members : []);
            });
        },

        getStudents: function (includeStruckOff, yearParam) {
            var studentsApi = getService('students', 'createStudentsService');
            if (studentsApi) {
                return studentsApi.getStudents(includeStruckOff, yearParam);
            }

            return get('institutionSettings').then(function (settings) {
                var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();
                var targetYear = currentYear;

                if (yearParam === true) {
                    targetYear = null; // Get all years
                } else if (typeof yearParam === 'string' && yearParam.length > 0) {
                    targetYear = yearParam; // Specific year
                }

                if (useSQLite) {
                    var opts = {
                        includeStruckOff: includeStruckOff,
                        academicYear: targetYear
                    };
                    return window.ipcRenderer.invoke('db-get-students', opts);
                } else {
                    // Legacy memory filtering fallback
                    return get('studentsList').then(function (students) {
                        students = students || [];
                        if (targetYear !== null) {
                            students = students.filter(function (s) {
                                return !s.academic_year || s.academic_year === targetYear;
                            });
                        }
                        if (includeStruckOff) return students;
                        return students.filter(function (s) { return !s.struck_off; });
                    });
                }
            });
        },

        saveStudents: function (filteredStudents, providedYear) {
            var studentsApi = getService('students', 'createStudentsService');
            if (studentsApi) {
                return studentsApi.saveStudents(filteredStudents, providedYear);
            }

            return get('studentsList').then(function (allStudents) {
                return get('institutionSettings').then(function (settings) {
                    var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();
                    var targetYear = providedYear || currentYear;

                    var otherYears = (allStudents || []).filter(function (s) {
                        return s.academic_year && s.academic_year !== targetYear;
                    });

                    var studentsToSave = (filteredStudents || []).map(function (s) {
                        if (!s.academic_year) s.academic_year = targetYear;
                        return s;
                    });

                    var combined = otherYears.concat(studentsToSave);
                    return set('studentsList', combined).then(function () {
                        return set('studentsLastUpdate', new Date().toLocaleString());
                    });
                });
            });
        },

        getResults: function (allYears) {
            var resultsApi = getService('results', 'createResultsService');
            if (resultsApi) {
                return resultsApi.getResults(allYears);
            }

            return get('institutionSettings').then(function (settings) {
                var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();

                if (useSQLite) {
                    var opts = { academicYear: allYears ? null : currentYear };
                    return window.ipcRenderer.invoke('db-get-results', opts);
                } else {
                    // Legacy memory filtering fallback
                    return get('schoolResults').then(function (results) {
                        results = results || [];
                        if (!allYears) {
                            return results.filter(function (r) {
                                return !r.academic_year || r.academic_year === currentYear;
                            });
                        }
                        return results;
                    });
                }
            });
        },

        saveResults: function (filteredResults) {
            var resultsApi = getService('results', 'createResultsService');
            if (resultsApi) {
                return resultsApi.saveResults(filteredResults);
            }

            return get('schoolResults').then(function (allResults) {
                return get('institutionSettings').then(function (settings) {
                    var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();
                    var otherYears = (allResults || []).filter(function (r) {
                        return r.academic_year && r.academic_year !== currentYear;
                    });

                    var resultsToSave = (filteredResults || []).map(function (r) {
                        if (!r.academic_year) r.academic_year = currentYear;
                        return r;
                    });

                    var combined = otherYears.concat(resultsToSave);
                    return set('schoolResults', combined).then(function () {
                        return set('lastUpdate', new Date().toLocaleString());
                    });
                });
            });
        },

        getAnnualResults: function (allYears) {
            return get('institutionSettings').then(function (settings) {
                var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();

                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-get-annual-results', {
                        academicYear: allYears ? null : currentYear
                    });
                }

                return get('annualResults').then(function (results) {
                    results = results || [];
                    if (!allYears) {
                        return results.filter(function (result) {
                            return !result.academic_year || result.academic_year === currentYear;
                        });
                    }
                    return results;
                });
            });
        },

        saveAnnualResults: function (rows, options) {
            options = options || {};
            var providedYear = typeof options === 'string'
                ? options
                : (options.academicYear || options.year || options.schoolYear || options.school_year || null);
            var replaceExisting = !(options && typeof options === 'object' && options.replaceExisting === false);

            return get('institutionSettings').then(function (settings) {
                var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();
                var targetYear = providedYear || currentYear;

                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-save-annual-results', {
                        rows: rows || [],
                        academicYear: targetYear,
                        replaceExisting: replaceExisting
                    });
                }

                return set('annualResults', (rows || []).map(function (row) {
                    if (!row.academic_year) row.academic_year = targetYear;
                    return row;
                }));
            });
        },

        clearAnnualResults: function (options) {
            options = options || {};

            return get('institutionSettings').then(function (settings) {
                var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();
                var payload = {};

                if (options.allYears !== true) {
                    payload.academicYear = options.academicYear || currentYear;
                }
                if (options.className) payload.className = options.className;
                if (options.level !== undefined) payload.level = options.level;

                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-clear-annual-results', payload);
                }

                if (options.allYears === true) {
                    return set('annualResults', []);
                }

                return get('annualResults').then(function (rows) {
                    rows = rows || [];
                    var filtered = rows.filter(function (row) {
                        var sameYear = !payload.academicYear || row.academic_year === payload.academicYear;
                        var sameClass = !payload.className || row.className === payload.className || row.class_name === payload.className;
                        var sameLevel = payload.level === undefined || payload.level === row.level;
                        return !(sameYear && sameClass && sameLevel);
                    });
                    return set('annualResults', filtered);
                });
            });
        },

        getSettings: function () {
            var settingsApi = getService('settings', 'createSettingsService');
            if (settingsApi) {
                return settingsApi.getSettings();
            }

            return get('institutionSettings').then(function (settings) {
                settings = settings || {};

                // --- Centralized Sync Fix ---
                // currentAcademicYear is our new standard, but most files use .schoolYear
                if (settings.currentAcademicYear) {
                    settings.schoolYear = settings.currentAcademicYear;
                }

                var localToken = localStorage.getItem('currentUser');
                var user = null;
                if (localToken) {
                    if (typeof Auth !== 'undefined' && Auth.getUser) {
                        user = Auth.getUser();
                    } else {
                        try { user = JSON.parse(localToken); } catch (e) { }
                    }
                }
                if (user) {
                    settings.wilaya = settings.wilaya || user.wilaya || '';
                    settings.municipality = settings.municipality || user.municipality || '';
                    settings.district = settings.district || user.district || user.daira || '';
                    settings.phone = settings.phone || user.phone || '';
                    settings.institutionName = settings.institutionName || user.institution || '';
                    settings.managerName = settings.managerName || user.manager || '';
                    // Allow cloud schoolYear as fallback if local is missing
                    if (!settings.schoolYear) {
                        settings.schoolYear = user.schoolYear || '';
                    }
                }
                return settings;
            });
        },

        saveSettings: function (settings) {
            var settingsApi = getService('settings', 'createSettingsService');
            if (settingsApi) {
                return settingsApi.saveSettings(settings);
            }

            // Keep localStorage copy for quick sync access (e.g., getLevelDisplaySync)
            localStorage.setItem('institutionSettings', JSON.stringify(settings));
            return set('institutionSettings', settings);
        },

        getExamGroupings: function () {
            return get('examGroupings').then(function (res) { return res || {}; });
        },

        saveExamGroupings: function (groupings) {
            return set('examGroupings', groupings);
        },

        getActivityEvaluations: function (options) {
            if (useSQLite) {
                return window.ipcRenderer.invoke('db-get-activity-evals', options || {});
            } else {
                return get('activityEvaluations').then(function (evals) {
                    var arr = evals || [];
                    if (options && options.academicYear) {
                        arr = arr.filter(function(d) { return d.academic_year === options.academicYear; });
                    }
                    if (options && options.trimester) {
                        arr = arr.filter(function(d) { return d.trimester === options.trimester; });
                    }
                    return arr;
                });
            }
        },

        saveActivityEvaluations: function (records) {
            if (useSQLite) {
                return window.ipcRenderer.invoke('db-save-activity-evals', records);
            } else {
                return get('activityEvaluations').then(function(existing) {
                    var arr = existing || [];
                    Array.prototype.push.apply(arr, records);
                    return set('activityEvaluations', arr);
                });
            }
        },

        clearActivityEvaluations: function (options) {
            if (useSQLite) {
                return window.ipcRenderer.invoke('db-clear-activity-evals', options || {});
            } else {
                return get('activityEvaluations').then(function(existing) {
                    if (!options) return set('activityEvaluations', []);
                    var arr = (existing || []).filter(function(d) {
                        var match = true;
                        if (options.academicYear && d.academic_year !== options.academicYear) match = false;
                        if (options.trimester && d.trimester !== options.trimester) match = false;
                        if (options.subject && d.subject !== options.subject) match = false;
                        // Keep items that DO NOT match the clear criteria
                        return !match;
                    });
                    return set('activityEvaluations', arr);
                });
            }
        },

        /**
         * Get a preview of what would happen during migration to a new year
         * @param {string} targetYear - The year to migrate to (e.g. "2026/2027")
         * @param {number} threshold - Average required to pass (default 10)
         */
        getMigrationPreview: function (targetYear, threshold) {
            threshold = threshold || 10;
            return Promise.all([
                this.getStudents(false, true), // All years
                this.getAnnualResults(true)    // All years
            ]).then(function (values) {
                var allStudents = values[0];
                var allAnnualResults = values[1];

                // Get settings to find current year
                return DB.get('institutionSettings').then(function (settings) {
                    var currentYear = (settings && settings.currentAcademicYear) || DB.getCurrentAcademicYear();

                    // Students currently in the "source" year
                    var sourceStudents = allStudents.filter(function (s) {
                        return s.academic_year === currentYear;
                    });

                    // Filter out students who are ALREADY in the target year (to avoid double migration)
                    var existingInTarget = allStudents.filter(function (s) {
                        return s.academic_year === targetYear;
                    }).map(function (s) { return (s.last_name + ' ' + s.first_name).trim(); });

                    var promoted = 0;
                    var repeated = 0;
                    var graduated = 0;
                    var alreadyExists = 0;

                    sourceStudents.forEach(function (s) {
                        var fullName = (s.last_name + ' ' + s.first_name).trim();
                        if (existingInTarget.indexOf(fullName) !== -1) {
                            alreadyExists++;
                            return;
                        }

                        // Find annual average in results
                        var res = allAnnualResults.find(function (r) {
                            var annualName = r.fullName || (String(r.lastName || r.last_name || '') + ' ' + String(r.firstName || r.first_name || '')).trim();
                            return r.academic_year === currentYear && (
                                (s.id && (r.student_id === s.id || r.id === s.id)) ||
                                annualName === fullName
                            );
                        });

                        var avg = (res && res.annualAvg) ? parseFloat(res.annualAvg) : 0;
                        var level = parseInt(getLevelNumber(s.level), 10) || 1;

                        if (avg >= threshold) {
                            if (level >= 4) graduated++; // Assuming 4 is final year
                            else promoted++;
                        } else {
                            repeated++;
                        }
                    });

                    return {
                        sourceYear: currentYear,
                        targetYear: targetYear,
                        totalSource: sourceStudents.length,
                        promoted: promoted,
                        repeated: repeated,
                        graduated: graduated,
                        alreadyExists: alreadyExists,
                        netNew: promoted + repeated
                    };
                });
            });
        },

        /**
         * Execute the migration for students and teachers
         */
        migrateToNewYear: function (targetYear, migrateTeachers) {
            var self = this;
            var threshold = 10; // Standard Algerian threshold

            return Promise.all([
                this.getStudents(false, true), // All years
                this.getAnnualResults(true),   // All years
                this.getTeachers(true)         // All years
            ]).then(function (values) {
                var allStudents = values[0];
                var allAnnualResults = values[1];
                var allTeachers = values[2];

                return self.get('institutionSettings').then(function (settings) {
                    var currentYear = (settings && settings.currentAcademicYear) || self.getCurrentAcademicYear();

                    // 1. Process Students
                    var sourceStudents = allStudents.filter(function (s) { return s.academic_year === currentYear; });
                    var existingInTarget = allStudents.filter(function (s) { return s.academic_year === targetYear; })
                        .map(function (s) { return (s.last_name + ' ' + s.first_name).trim(); });

                    var newRecords = [];
                    sourceStudents.forEach(function (s) {
                        var fullName = (s.last_name + ' ' + s.first_name).trim();
                        if (existingInTarget.indexOf(fullName) !== -1) return; // Skip logic

                        var res = allAnnualResults.find(function (r) {
                            var annualName = r.fullName || (String(r.lastName || r.last_name || '') + ' ' + String(r.firstName || r.first_name || '')).trim();
                            return r.academic_year === currentYear && (
                                (s.id && (r.student_id === s.id || r.id === s.id)) ||
                                annualName === fullName
                            );
                        });

                        var avg = (res && res.annualAvg) ? parseFloat(res.annualAvg) : 0;
                        var levelNum = parseInt(getLevelNumber(s.level), 10) || 1;

                        // Create clone
                        var newS = JSON.parse(JSON.stringify(s));
                        newS.academic_year = targetYear;
                        newS.class = ""; // Reset class assignment
                        newS.class_number = "";

                        if (avg >= threshold) {
                            // Promoted
                            if (levelNum < 4) {
                                newS.level = getCanonicalLevelWord(String(levelNum + 1));
                                newS.is_repeater = false;
                                newRecords.push(newS);
                            }
                            // else: Graduated, don't add to new year active records
                        } else {
                            // Repeated
                            newS.level = getCanonicalLevelWord(String(levelNum));
                            newS.is_repeater = true;
                            newRecords.push(newS);
                        }
                    });

                    // 2. Process Teachers (if requested)
                    var teacherRecords = [];
                    if (migrateTeachers) {
                        var sourceTeachers = allTeachers.filter(function (t) { return t.academic_year === currentYear; });
                        var existingTeachersInTarget = allTeachers.filter(function (t) { return t.academic_year === targetYear; })
                            .map(function (t) { return (t.last_name + ' ' + t.first_name).trim(); });

                        sourceTeachers.forEach(function (t) {
                            var fullName = (t.last_name + ' ' + t.first_name).trim();
                            if (existingTeachersInTarget.indexOf(fullName) !== -1) return;

                            var newT = JSON.parse(JSON.stringify(t));
                            newT.academic_year = targetYear;
                            newT.responsibleClasses = []; // Reset assignments
                            newT.receptionHours = [];
                            teacherRecords.push(newT);
                        });
                    }

                    // 3. Save Data
                    var pStudents = newRecords.length > 0 ? self.set('studentsList', allStudents.concat(newRecords)) : Promise.resolve();
                    var pTeachers = teacherRecords.length > 0 ? self.set('teachersList', allTeachers.concat(teacherRecords)) : Promise.resolve();

                    // 4. Update Settings to the new year
                    if (!settings) settings = {};
                    settings.currentAcademicYear = targetYear;
                    var pSettings = self.saveSettings(settings);

                    return Promise.all([pStudents, pTeachers, pSettings]).then(function () {
                        return {
                            success: true,
                            studentsAdded: newRecords.length,
                            teachersAdded: teacherRecords.length
                        };
                    });
                });
            });
        },

        getExamProctors: function (allYears) {
            return get('institutionSettings').then(function (settings) {
                var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();
                if (useSQLite) {
                    var opts = { academicYear: allYears ? null : currentYear };
                    return window.ipcRenderer.invoke('db-get-exam-proctors', opts);
                } else {
                    return get('examProctorsList').then(function (proctors) {
                        proctors = proctors || [];
                        if (!allYears) {
                            return proctors.filter(function (p) {
                                return !p.academic_year || p.academic_year === currentYear;
                            });
                        }
                        return proctors;
                    });
                }
            });
        },

        saveExamProctors: function (filteredProctors) {
            return get('examProctorsList').then(function (allProctors) {
                return get('institutionSettings').then(function (settings) {
                    var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();
                    
                    if (useSQLite) {
                        var proctorsToSave = (filteredProctors || []).map(function (p) {
                            if (!p.academic_year) p.academic_year = currentYear;
                            return p;
                        });
                        return window.ipcRenderer.invoke('db-save-exam-proctors', proctorsToSave);
                    } else {
                        var otherYears = (allProctors || []).filter(function (p) {
                            return p.academic_year && p.academic_year !== currentYear;
                        });

                        var proctorsToSave = (filteredProctors || []).map(function (p) {
                            if (!p.academic_year) p.academic_year = currentYear;
                            return p;
                        });

                        var combined = otherYears.concat(proctorsToSave);
                        return set('examProctorsList', combined);
                    }
                });
            });
        },

        getTeachers: function (allYears) {
            var teachersApi = getService('teachers', 'createTeachersService');
            if (teachersApi) {
                return teachersApi.getTeachers(allYears);
            }

            return get('institutionSettings').then(function (settings) {
                var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();

                if (useSQLite) {
                    var opts = { academicYear: allYears ? null : currentYear };
                    return window.ipcRenderer.invoke('db-get-teachers', opts);
                } else {
                    // Legacy memory filtering fallback
                    return get('teachersList').then(function (teachers) {
                        teachers = teachers || [];
                        if (!allYears) {
                            return teachers.filter(function (t) {
                                return !t.academic_year || t.academic_year === currentYear;
                            });
                        }
                        return teachers;
                    });
                }
            });
        },

        saveTeachers: function (filteredTeachers) {
            var teachersApi = getService('teachers', 'createTeachersService');
            if (teachersApi) {
                return teachersApi.saveTeachers(filteredTeachers);
            }

            return get('teachersList').then(function (allTeachers) {
                return get('institutionSettings').then(function (settings) {
                    var currentYear = (settings && settings.currentAcademicYear) || getCurrentAcademicYear();
                    var otherYears = (allTeachers || []).filter(function (t) {
                        return t.academic_year && t.academic_year !== currentYear;
                    });

                    var teachersToSave = (filteredTeachers || []).map(function (t) {
                        if (!t.academic_year) t.academic_year = currentYear;
                        return t;
                    });

                    var combined = otherYears.concat(teachersToSave);
                    return set('teachersList', combined);
                });
            });
        },

        clear: function () {
            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-clear-all');
                } else {
                    var keys = [
                        'studentsList', 'schoolResults', 'teachersList', 'subjectResponsibles',
                        'classResponsibles', 'institutionSettings', 'examGroupings',
                        'supervisionTrimester', 'supervision_teachers', 'supervision_days',
                        'supervision_schedule', 'supervision_settings', 'exemptSubjects',
                        'finalResults', 'lastUpdate', 'studentsLastUpdate', 'absenceRecords',
                        'resumeRecords', 'signatureSettings', '_migrated'
                    ];
                    keys.forEach(function (key) { localStorage.removeItem(key); });
                    return true;
                }
            });
        },

        getLevelDisplay: function (level) {
            if (!level) return Promise.resolve('');
            return this.getSettings().then(function (settings) {
                var isSecondary = settings.educationStage === 'secondary';
                var stageName = isSecondary ? 'ثانوي' : 'متوسط';
                var lvlNum = String(level).replace(/\D/g, '');
                if (!lvlNum) {
                    if (String(level).indexOf('أولى') !== -1 || String(level).indexOf('1') !== -1) lvlNum = '1';
                    else if (String(level).indexOf('ثانية') !== -1 || String(level).indexOf('2') !== -1) lvlNum = '2';
                    else if (String(level).indexOf('ثالثة') !== -1 || String(level).indexOf('3') !== -1) lvlNum = '3';
                    else if (String(level).indexOf('رابعة') !== -1 || String(level).indexOf('4') !== -1) lvlNum = '4';
                }
                switch (lvlNum) {
                    case '1': return 'أولى ' + stageName;
                    case '2': return 'ثانية ' + stageName;
                    case '3': return 'ثالثة ' + stageName;
                    case '4': return 'رابعة ' + stageName;
                    default: return level + ' ' + stageName;
                }
            });
        },

        getLevelDisplaySync: function (level, settings) {
            if (!level) return '';
            if (!settings && window.appSettings) settings = window.appSettings;
            if (!settings) {
                try { settings = JSON.parse(localStorage.getItem('institutionSettings')); } catch (e) { }
            }
            if (!settings) settings = {};
            var isSecondary = settings.educationStage === 'secondary';
            var stageName = isSecondary ? 'ثانوي' : 'متوسط';
            var lvlNum = String(level).replace(/\D/g, '');
            if (!lvlNum) {
                if (String(level).indexOf('أولى') !== -1 || String(level).indexOf('1') !== -1) lvlNum = '1';
                else if (String(level).indexOf('ثانية') !== -1 || String(level).indexOf('2') !== -1) lvlNum = '2';
                else if (String(level).indexOf('ثالثة') !== -1 || String(level).indexOf('3') !== -1) lvlNum = '3';
                else if (String(level).indexOf('رابعة') !== -1 || String(level).indexOf('4') !== -1) lvlNum = '4';
            }
            switch (lvlNum) {
                case '1': return 'أولى ' + stageName;
                case '2': return 'ثانية ' + stageName;
                case '3': return 'ثالثة ' + stageName;
                case '4': return 'رابعة ' + stageName;
                default: return level;
            }
        },

        // ============================================================
        // Absence Tracking API (Relational)
        // ============================================================

        saveDayAbsences: function (data) {
            var absencesApi = getService('absences', 'createAbsencesService');
            if (absencesApi) {
                return absencesApi.saveDayAbsences(data);
            }

            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-save-day-absences', data);
                }
                // Fallback: Legacy KV storage
                return get('absenceRecords').then(function (records) {
                    records = records || [];
                    records = records.filter(function (r) { return !(r.date === data.date && r.period === data.period); });
                    records.push({ date: data.date, period: data.period, students: data.students, teachers: data.teachers, supervisors: data.supervisors, timestamp: new Date().toISOString() });
                    return set('absenceRecords', records);
                });
            });
        },

        getDayAbsences: function (date, period) {
            var absencesApi = getService('absences', 'createAbsencesService');
            if (absencesApi) {
                return absencesApi.getDayAbsences(date, period);
            }

            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-get-day-absences', { date: date, period: period || 'ALL' });
                }
                // Fallback
                return get('absenceRecords').then(function (records) {
                    records = records || [];
                    return records.find(function (r) { return r.date === date && r.period === (period || 'ALL'); }) || null;
                });
            });
        },

        getAbsencesRange: function (startDate, endDate) {
            var absencesApi = getService('absences', 'createAbsencesService');
            if (absencesApi) {
                return absencesApi.getAbsencesRange(startDate, endDate);
            }

            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-get-absences-range', { startDate: startDate, endDate: endDate });
                }
                // Fallback
                return get('absenceRecords').then(function (records) {
                    records = records || [];
                    return records.filter(function (r) { return r.date >= startDate && r.date <= endDate; });
                });
            });
        },

        getStudentAbsences: function (studentId, startDate, endDate) {
            var absencesApi = getService('absences', 'createAbsencesService');
            if (absencesApi) {
                return absencesApi.getStudentAbsences(studentId, startDate, endDate);
            }

            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-get-student-absences', { studentId: studentId, startDate: startDate, endDate: endDate });
                }
                // Fallback: filter from full records
                return get('absenceRecords').then(function (records) {
                    records = records || [];
                    var result = [];
                    records.forEach(function (r) {
                        if (startDate && r.date < startDate) return;
                        if (endDate && r.date > endDate) return;
                        if (r.students) {
                            r.students.forEach(function (s) {
                                if (String(s.id) === String(studentId)) {
                                    result.push({ date: r.date, period: r.period, am: s.am, pm: s.pm, reason: s.reason });
                                }
                            });
                        }
                    });
                    return result;
                });
            });
        },

        deleteDayAbsences: function (date, period) {
            var absencesApi = getService('absences', 'createAbsencesService');
            if (absencesApi) {
                return absencesApi.deleteDayAbsences(date, period);
            }

            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-delete-day-absences', { date: date, period: period || 'ALL' });
                }
                // Fallback
                return get('absenceRecords').then(function (records) {
                    records = records || [];
                    records = records.filter(function (r) { return !(r.date === date && r.period === (period || 'ALL')); });
                    return set('absenceRecords', records);
                });
            });
        },

        getAbsenceHistory: function () {
            var absencesApi = getService('absences', 'createAbsencesService');
            if (absencesApi) {
                return absencesApi.getAbsenceHistory();
            }

            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-get-absence-history');
                }
                // Fallback
                return get('absenceRecords').then(function (records) {
                    records = records || [];
                    return records.map(function (r) {
                        return { date: r.date, studentCount: r.students ? r.students.length : 0 };
                    }).sort(function (a, b) { return b.date.localeCompare(a.date); });
                });
            });
        },

        saveCanteenAbsences: function (date, studentIds, academicYear) {
            var absencesApi = getService('absences', 'createAbsencesService');
            if (absencesApi) {
                return absencesApi.saveCanteenAbsences(date, studentIds, academicYear);
            }

            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-save-canteen-absences', { date: date, studentIds: studentIds, academicYear: academicYear });
                }
                // Fallback
                return get('canteenAbsences').then(function (data) {
                    data = data || {};
                    data[date] = studentIds;
                    return set('canteenAbsences', data);
                });
            });
        },

        getCanteenAbsences: function (startDate, endDate) {
            var absencesApi = getService('absences', 'createAbsencesService');
            if (absencesApi) {
                return absencesApi.getCanteenAbsences(startDate, endDate);
            }

            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-get-canteen-absences', { startDate: startDate, endDate: endDate });
                }
                // Fallback
                return get('canteenAbsences').then(function (data) {
                    data = data || {};
                    if (!startDate && !endDate) return data;
                    var filtered = {};
                    Object.keys(data).forEach(function (d) {
                        if ((!startDate || d >= startDate) && (!endDate || d <= endDate)) filtered[d] = data[d];
                    });
                    return filtered;
                });
            });
        },

        clearAllAbsences: function () {
            var absencesApi = getService('absences', 'createAbsencesService');
            if (absencesApi) {
                return absencesApi.clearAllAbsences();
            }

            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-clear-all-absences');
                }
                return Promise.all([
                    set('absenceRecords', []),
                    set('canteenAbsences', {})
                ]);
            });
        },

        getAllAbsencesExport: function () {
            var absencesApi = getService('absences', 'createAbsencesService');
            if (absencesApi) {
                return absencesApi.getAllAbsencesExport();
            }

            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-get-all-absences-export');
                }
                return get('absenceRecords').then(function (records) { return records || []; });
            });
        },

        importAbsences: function (records) {
            var absencesApi = getService('absences', 'createAbsencesService');
            if (absencesApi) {
                return absencesApi.importAbsences(records);
            }

            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-import-absences', records);
                }
                return set('absenceRecords', records);
            });
        },

        importActivityEvals: function (records) {
            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-save-activity-evals', records);
                }
                return set('activityEvaluations', records);
            });
        },

        // ============================================================
        // Teacher Messaging Logs
        // ============================================================
        saveMessageLog: function (log) {
            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-save-msg-log', log);
                }
                return Promise.resolve(false);
            });
        },
        getMessageLogs: function () {
            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-get-msg-logs');
                }
                return Promise.resolve([]);
            });
        },
        deleteMessageLog: function (id) {
            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-delete-msg-log', id);
                }
                return Promise.resolve(false);
            });
        },
        clearMessageLogs: function () {
            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-clear-msg-logs');
                }
                return Promise.resolve(false);
            });
        },

        getUniqueAcademicYears: function () {
            return init().then(function () {
                if (useSQLite) {
                    return window.ipcRenderer.invoke('db-get-unique-years').catch(function (e) {
                        console.error('[DB] SQLite getUniqueYears error:', e);
                        return [];
                    });
                } else {
                    return get('studentsList').then(function (students) {
                        students = students || [];
                        var years = {};
                        students.forEach(function (s) {
                            if (s.academic_year) years[s.academic_year] = true;
                        });
                        return Object.keys(years).sort().reverse();
                    });
                }
            });
        },

        /**
         * Manual migration trigger - called from Data Management page
         * Runs the full IndexedDB → SQLite → Relational migration on demand
         * Then deduplicates all tables to ensure clean data
         */
        runManualMigration: function () {
            return init().then(function () {
                if (!useSQLite) {
                    return Promise.reject(new Error('SQLite غير متاح'));
                }
                return migrateToSQLite().then(function () {
                    console.log('[DB] Manual: migrateToSQLite completed');
                    return migrateKVToRelational();
                }).then(function () {
                    console.log('[DB] Manual: KV→relational completed. Running deduplication...');
                    return window.ipcRenderer.invoke('db-deduplicate');
                }).then(function (report) {
                    console.log('[DB] Manual: Deduplication report:', JSON.stringify(report));
                    return report;
                });
            });
        },

        /**
         * Standalone deduplication - can be called independently
         * Removes duplicate records from all tables
         */
        deduplicate: function () {
            return init().then(function () {
                if (!useSQLite) {
                    return Promise.reject(new Error('SQLite غير متاح'));
                }
                return window.ipcRenderer.invoke('db-deduplicate');
            });
        },

        /**
         * Calculates and stores the 'Exam-Only Average' for all students in a section
         * Triggered after importing activity evaluations.
         * Only runs for Middle School.
         */
        computeAndSaveActivityAverages: function (academicYear, trimester, level, classNumber) {
            var self = this;
            return init().then(function () {
                if (!useSQLite) return false;

                // Load exemptions first
                return self.get('activityEvaluationExemptions').then(function(exemptionsObj) {
                    var storedExemptions = exemptionsObj || {};

                    // 1. Check if Middle School
                    return self.get('institutionSettings').then(function (settings) {
                        var stage = (settings && settings.educationStage) || 'middle';
                        if (stage !== 'middle') return false;

                        // 2. Get expected subjects for this level
                        if (typeof window.SubjectManager === 'undefined') return false;
                        var allExpectedSubjects = window.SubjectManager.getSubjects('middle', level) || [];
                        if (allExpectedSubjects.length === 0) return false;

                        // Filter out exemptions
                        var levelExemptions = storedExemptions[level] || [];
                        var expectedSubjects = allExpectedSubjects.filter(function(sub) {
                             var shortSub = sub.replace('التربية ', '').replace('اللغة ', '');
                             var isExempt = levelExemptions.some(function(s) { 
                                 return s === sub || s === shortSub || 
                                        (sub === 'المعلوماتية' && s === 'معلوماتية') ||
                                        (sub.indexOf('تشكيلية') !== -1 && s.indexOf('تشكيلية') !== -1) ||
                                        (sub.indexOf('البدنية') !== -1 && s.indexOf('رياضة') !== -1) ||
                                        (sub.indexOf('موسيقى') !== -1 && s.indexOf('موسيقى') !== -1) ||
                                        (sub.indexOf('أمازيغية') !== -1 && s.indexOf('أمازيغية') !== -1);
                             });
                             return !isExempt;
                        });

                        // Helper to normalize arabic strings for matching
                        var normalize = function(s) {
                            if (!s) return "";
                            return s.toString().trim()
                                .replace(/[إأآا]/g, 'ا')
                                .replace(/ة/g, 'ه')
                                .replace(/ى/g, 'ي')
                                .replace(/\s+/g, ' ');
                        };

                        var normExpected = expectedSubjects.map(normalize);

                        // 3. Get imported evaluations for this group
                        return window.ipcRenderer.invoke('db-get-activity-evals', {
                            academicYear: academicYear,
                            trimester: trimester
                        }).then(function (allEvals) {
                            // Filter for level and class
                            var relevantEvals = (allEvals || []).filter(function (r) {
                                var rClass = r.class_number ? r.class_number.toString().replace(/^0+/, '') : '';
                                var targetClass = classNumber ? classNumber.toString().replace(/^0+/, '') : '';
                                return r.level == level && rClass == targetClass;
                            });

                            // Count unique imported subjects
                            var importedSubs = new Set();
                            relevantEvals.forEach(function (r) {
                                if (r.subject) importedSubs.add(normalize(r.subject));
                            });

                            // 100% Rule: Check if all expected subjects are present
                            var foundCount = 0;
                            normExpected.forEach(function(exp) {
                                if (importedSubs.has(exp)) foundCount++;
                            });

                            if (foundCount < normExpected.length && expectedSubjects.length > 0) {
                                console.log('[DB] Group import incomplete (' + foundCount + '/' + expectedSubjects.length + '). Skipping average calculation.');
                                return false; 
                            }

                            // 4. Calculate for each student
                            // Get students in this group (level + class)
                            return self.getStudents(true, academicYear).then(function (students) {
                                var targetClass = classNumber ? classNumber.toString().replace(/^0+/, '') : '';
                                var groupStudents = students.filter(function (s) {
                                    var sClass = s.class_number ? s.class_number.toString().replace(/^0+/, '') : '';
                                    return s.level == level && sClass == targetClass;
                                });

                                if (groupStudents.length === 0) return false;

                                // Get existing results to check for exemptions
                                return self.getResults(true).then(function (results) {
                                    var groupResults = results.filter(function (r) {
                                        var rClass = r.class ? r.class.toString().replace(/^0+/, '') : '';
                                        return r.academic_year === academicYear &&
                                               r.trimester === trimester &&
                                               r.level == level &&
                                               rClass == targetClass;
                                    });

                                    // Perform calculation per student
                                    var resultsToSave = [];

                                    groupStudents.forEach(function (student) {
                                        var totalWeighted = 0;
                                        var totalCoeff = 0;
                                        var studentHasMarks = false;

                                        // Find student's result record for marks/exemptions
                                        var officialResult = groupResults.find(function(res) {
                                            return res.student_name === student.name || 
                                                   (res.student_name === (student.last_name + ' ' + student.first_name)) ||
                                                   (res.student_name === (student.first_name + ' ' + student.last_name));
                                        });

                                        relevantEvals.forEach(function (record) {
                                            if (record.student_id != student.id) return;
                                            if (record.test_mark === null || record.test_mark === undefined || record.test_mark === '') return;

                                            var mark = parseFloat(record.test_mark);
                                            if (isNaN(mark)) return;

                                            // Exemption check
                                            if (officialResult && officialResult.marks) {
                                                var subjMarks = officialResult.marks[record.subject];
                                                // If mark is 0 and not present in official results, assume exempt
                                                if (mark === 0 && (!subjMarks || subjMarks === '-' || subjMarks === '')) return;
                                            }

                                            var coeff = window.SubjectManager.getSubjectCoefficient('middle', level, 'common', record.subject);
                                            totalWeighted += mark * coeff;
                                            totalCoeff += coeff;
                                            studentHasMarks = true;
                                        });

                                        if (studentHasMarks && totalCoeff > 0) {
                                            var avg = parseFloat((totalWeighted / totalCoeff).toFixed(2));
                                            
                                            // Update or create result record
                                            var resultObj = officialResult || {
                                                student_name: student.last_name + ' ' + student.first_name,
                                                level: level,
                                                class: classNumber,
                                                trimester: trimester,
                                                academic_year: academicYear,
                                                marks: {},
                                                averages: {}
                                            };
                                            
                                            resultObj.activity_test_avg = avg;
                                            resultsToSave.push(resultObj);
                                        }
                                    });

                                    if (resultsToSave.length > 0) {
                                        console.log('[DB] Saving ' + resultsToSave.length + ' calculated averages for group ' + level + classNumber);
                                        return self.saveResults(resultsToSave, academicYear);
                                    }
                                    return true;
                                });
                            });
                        });
                    });
                });
            });
        }
    };
})();

/**
 * DBSync - Synchronous database access with in-memory cache
 * Falls back to localStorage for sync reads, writes to SQLite via DB
 */
var DBSync = {
    _cache: {},
    get: function (key) {
        if (this._cache[key] !== undefined) return this._cache[key];
        var value = localStorage.getItem(key);
        try { return JSON.parse(value); } catch (e) { return value; }
    },
    set: function (key, value) {
        this._cache[key] = value;
        DB.set(key, value); // Async save to SQLite
        localStorage.setItem(key, JSON.stringify(value)); // Sync save for immediate reads
    },
    remove: function (key) {
        delete this._cache[key];
        DB.remove(key); // Async delete from SQLite
        localStorage.removeItem(key);
    }
};

if (window.AppDbModules && typeof window.AppDbModules.createDBSync === 'function') {
    DBSync = window.AppDbModules.createDBSync({
        DB: DB,
        storage: localStorage
    });
}
