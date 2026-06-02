/**
 * Clean Auth Module
 * ES5 Version for Windows 7 / IE11 Compatibility
 */

(function () {
    var theme = 'light';
    var themePreset = 'default';

    try {
        if (window.top && window.top.document && window.top.document.documentElement) {
            theme = window.top.document.documentElement.getAttribute('data-theme') || theme;
            themePreset = window.top.document.documentElement.getAttribute('data-theme-preset') || themePreset;
        }
    } catch (e) { }

    try {
        theme = localStorage.getItem('theme') || theme;
        themePreset = localStorage.getItem('themePreset') || themePreset;
    } catch (e2) { }

    if (document && document.documentElement) {
        document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme-preset', themePreset || 'default');
    }
})();

var API_URL = "https://idarati.amanidev.com/api/desktop-api";
var AUTH_DAYS_UNKNOWN = -999;
var AUTH_DAYS_TAMPERED = -998;
var AUTH_TRUSTED_STATE_KEY = 'authTrustedState';

function normalizeAuthStatus(status) {
    if (status === 'active' || status === 1 || status === '1') return '1';
    if (status === 'pending' || status === 0 || status === '0') return '0';
    if (status === 'trial') return 'trial';
    return status === undefined || status === null ? '' : String(status);
}

function cloneAuthObject(obj) {
    var out = {};
    if (!obj) return out;
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) out[key] = obj[key];
    }
    return out;
}

function getStatusRank(status) {
    status = normalizeAuthStatus(status);
    if (status === '0') return 0;
    if (status === 'trial') return 1;
    if (status === '1') return 2;
    return 99;
}

/**
 * Helper: Route requests through Electron IPC proxy to bypass SSL certificate issues.
 * Falls back to fetch() if ipcRenderer is not available (e.g. in a browser context).
 */
function callServer(url, options) {
    options = options || {};
    var method = options.method || 'GET';
    var body = options.body || null;
    var headers = options.headers || {};

    // Try IPC proxy first (bypasses SSL errors in Electron)
    if (typeof require !== 'undefined') {
        try {
            var ipcRenderer = require('electron').ipcRenderer;
            if (ipcRenderer) {
                return ipcRenderer.invoke('proxy-http-request', {
                    url: url,
                    method: method,
                    headers: headers,
                    body: body
                }).then(function (result) {
                    if (result && result.success) {
                        return result.data;
                    }
                    throw new Error(result ? result.error : 'Proxy request failed');
                });
            }
        } catch (e) {
            // ipcRenderer not available, fall through to fetch
        }
    }

    // Fallback to fetch
    var fetchOptions = { cache: 'no-store', method: method };
    if (body) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        fetchOptions.headers = headers;
    }
    return fetch(url, fetchOptions)
        .then(function (res) { return res.text(); })
        .then(function (text) {
            try { return JSON.parse(text); } catch (e) { return text; }
        });
}

var Auth = {
    DAYS_UNKNOWN: AUTH_DAYS_UNKNOWN,
    DAYS_TAMPERED: AUTH_DAYS_TAMPERED,
    _passwordCache: null,
    _passwordLoaded: false,

    getIpcRenderer: function () {
        if (typeof require === 'undefined') return null;
        try {
            return require('electron').ipcRenderer || null;
        } catch (e) {
            return null;
        }
    },

    storePassword: function (password) {
        var self = this;
        var safePassword = password ? String(password) : '';
        this._passwordCache = safePassword || null;
        this._passwordLoaded = true;

        try { localStorage.removeItem('authHash'); } catch (e) { }

        var ipcRenderer = this.getIpcRenderer();
        if (!ipcRenderer) {
            if (safePassword) localStorage.setItem('authHash', safePassword);
            return Promise.resolve(this._passwordCache);
        }

        return ipcRenderer.invoke('auth-store-password', { password: safePassword })
            .then(function () { return self._passwordCache; })
            .catch(function () {
                if (safePassword) localStorage.setItem('authHash', safePassword);
                return self._passwordCache;
            });
    },

    loadStoredPassword: function () {
        var self = this;
        if (this._passwordLoaded) return Promise.resolve(this._passwordCache);

        var legacyPassword = null;
        try { legacyPassword = localStorage.getItem('authHash'); } catch (e) { }

        var ipcRenderer = this.getIpcRenderer();
        if (!ipcRenderer) {
            this._passwordCache = legacyPassword || null;
            this._passwordLoaded = true;
            return Promise.resolve(this._passwordCache);
        }

        return ipcRenderer.invoke('auth-load-password')
            .then(function (result) {
                var storedPassword = (result && result.password) ? String(result.password) : '';

                if (!storedPassword && legacyPassword) {
                    return self.storePassword(legacyPassword).then(function () {
                        return legacyPassword;
                    });
                }

                if (legacyPassword) {
                    try { localStorage.removeItem('authHash'); } catch (e) { }
                }

                self._passwordCache = storedPassword || null;
                self._passwordLoaded = true;
                return self._passwordCache;
            })
            .catch(function () {
                self._passwordCache = legacyPassword || null;
                self._passwordLoaded = true;
                return self._passwordCache;
            });
    },

    clearStoredPassword: function () {
        this._passwordCache = null;
        this._passwordLoaded = true;

        try { localStorage.removeItem('authHash'); } catch (e) { }

        var ipcRenderer = this.getIpcRenderer();
        if (!ipcRenderer) return Promise.resolve(true);

        return ipcRenderer.invoke('auth-clear-password')
            .then(function () { return true; })
            .catch(function () { return false; });
    },

    normalizeStatus: function (status) {
        return normalizeAuthStatus(status);
    },

    saveTrustedSubscriptionState: function (user) {
        if (!user || !user.email) return;

        var snapshot = {
            email: user.email,
            status: normalizeAuthStatus(user.status),
            expiresDate: user.expiresDate || '',
            subscriptionDate: user.subscriptionDate || user.startDate || user.date || user['\u062a\u0627\u0631\u064a\u062e'] || user['\u062a\u0627\u0631\u064a\u062e_\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643'] || '',
            verifiedAt: new Date().getTime()
        };

        try {
            localStorage.setItem(AUTH_TRUSTED_STATE_KEY, JSON.stringify(snapshot));
        } catch (e) { }
    },

    getTrustedSubscriptionState: function (email) {
        var raw = null;
        try { raw = localStorage.getItem(AUTH_TRUSTED_STATE_KEY); } catch (e) { }
        if (!raw) return null;

        try {
            var snapshot = JSON.parse(raw);
            if (!snapshot || !snapshot.email) return null;
            if (email && snapshot.email !== email) return null;
            snapshot.status = normalizeAuthStatus(snapshot.status);
            return snapshot;
        } catch (e2) {
            return null;
        }
    },

    clearTrustedSubscriptionState: function () {
        try { localStorage.removeItem(AUTH_TRUSTED_STATE_KEY); } catch (e) { }
    },

    getMostRestrictiveStatus: function (statuses) {
        var best = '';
        var bestRank = 999;
        for (var i = 0; i < statuses.length; i++) {
            var current = normalizeAuthStatus(statuses[i]);
            if (!current) continue;
            var rank = getStatusRank(current);
            if (rank < bestRank) {
                best = current;
                bestRank = rank;
            }
        }
        return best;
    },

    buildAccessUser: function (user) {
        if (!user) return null;

        var mergedUser = cloneAuthObject(user);
        var trusted = this.getTrustedSubscriptionState(user.email);

        if (trusted) {
            if (trusted.expiresDate && !mergedUser.expiresDate) mergedUser.expiresDate = trusted.expiresDate;
            if (trusted.subscriptionDate && !mergedUser.subscriptionDate && !mergedUser.startDate && !mergedUser.date) {
                mergedUser.subscriptionDate = trusted.subscriptionDate;
            }
            mergedUser.status = this.getMostRestrictiveStatus([mergedUser.status, trusted.status]) || normalizeAuthStatus(mergedUser.status);
        } else {
            mergedUser.status = normalizeAuthStatus(mergedUser.status);
        }

        return mergedUser;
    },

    getAccessState: function () {
        var rawUser = this.getUser();
        if (!rawUser) {
            return {
                rawUser: null,
                user: null,
                status: '',
                daysRemaining: 0,
                isTrial: false,
                isActiveStatus: false,
                isExpired: true,
                isUnknown: false,
                isTampered: false,
                hasAccess: false
            };
        }

        var user = this.buildAccessUser(rawUser);
        var days = this.calculateDaysRemaining(user);
        var isUnknown = days === AUTH_DAYS_UNKNOWN;
        var isTampered = days === AUTH_DAYS_TAMPERED;
        var isActiveStatus = user.status === '1' || user.status === 'trial';
        var isExpired = !isUnknown && !isTampered && days <= 0;

        return {
            rawUser: rawUser,
            user: user,
            status: user.status,
            daysRemaining: days,
            isTrial: user.status === 'trial',
            isActiveStatus: isActiveStatus,
            isExpired: isExpired,
            isUnknown: isUnknown,
            isTampered: isTampered,
            hasAccess: isActiveStatus && !isExpired && !isTampered
        };
    },

    getBlockedMessage: function (accessState) {
        if (accessState && accessState.isTampered) {
            return '\u0639\u0630\u0631\u0627\u064b\u060c \u062a\u0645 \u0627\u0643\u062a\u0634\u0627\u0641 \u062a\u063a\u064a\u064a\u0631 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d \u0641\u064a \u0633\u0627\u0639\u0629 \u0627\u0644\u0646\u0638\u0627\u0645. \u064a\u0631\u062c\u0649 \u062a\u0635\u062d\u064a\u062d \u0627\u0644\u0648\u0642\u062a \u062b\u0645 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629.';
        }
        return '\u0639\u0630\u0631\u0627\u064b\u060c \u0644\u0627 \u064a\u0645\u0643\u0646 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062d\u0629 \u0644\u0623\u0646 \u0627\u0644\u062d\u0633\u0627\u0628 \u063a\u064a\u0631 \u0645\u0641\u0639\u0644 \u0623\u0648 \u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643 \u0645\u0646\u062a\u0647\u064a.';
    },

    getFeatureBlockedMessage: function (feature) {
        var accessState = this.getAccessState();
        if (accessState && accessState.isTampered) {
            return this.getBlockedMessage(accessState);
        }
        if (feature === 'print') {
            return '\u0627\u0644\u0637\u0628\u0627\u0639\u0629 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629 \u0641\u064a \u0627\u0644\u0646\u0633\u062e\u0629 \u0627\u0644\u062a\u062c\u0631\u064a\u0628\u064a\u0629. \u064a\u0631\u062c\u0649 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643.';
        }
        if (feature === 'excel-export') {
            return '\u062a\u0635\u062f\u064a\u0631 Excel \u063a\u064a\u0631 \u0645\u062a\u0627\u062d \u0641\u064a \u0627\u0644\u0646\u0633\u062e\u0629 \u0627\u0644\u062a\u062c\u0631\u064a\u0628\u064a\u0629. \u064a\u0631\u062c\u0649 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643.';
        }
        return this.getBlockedMessage(accessState);
    },

    isFeatureRestricted: function (feature) {
        var accessState = this.getAccessState();
        if (accessState.isTampered) return true;
        if (feature === 'print' || feature === 'excel-export') {
            return accessState.isTrial && !accessState.isExpired && !accessState.isTampered;
        }
        return !accessState.hasAccess;
    },

    isTrialRestricted: function () {
        var accessState = this.getAccessState();
        return accessState.isTrial && !accessState.isExpired && !accessState.isTampered;
    },

    blockRestrictedFeature: function (feature) {
        if (!this.isFeatureRestricted(feature)) return false;

        var message = this.getFeatureBlockedMessage(feature);
        if (window.Swal && typeof window.Swal.fire === 'function') {
            window.Swal.fire({
                icon: 'warning',
                title: '\u062a\u0646\u0628\u064a\u0647',
                text: message
            });
        } else if (window.showToast && typeof window.showToast === 'function') {
            window.showToast(message, 'warning');
        } else {
            window.alert(message);
        }
        return true;
    },

    register: function (data) {
        var self = this;
        var password = data.password;
        var version = (window.UpdateManager && window.UpdateManager.CURRENT_VERSION) ? window.UpdateManager.CURRENT_VERSION : '2.2.10';
        var queryParts = [
            'action=register',
            'version=' + encodeURIComponent(version),
            '_t=' + new Date().getTime()
        ];
        for (var key in data) {
            queryParts.push(key + '=' + encodeURIComponent(data[key]));
        }

        return callServer(API_URL + '?' + queryParts.join('&'))
            .then(function (json) {
                if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { throw new Error('Srv Err'); } }
                return json;
            })
            .catch(function (err) {
                return { result: 'error', message: 'Connection Failed (' + err.message + ')' };
            });
    },

    login: function (email, password) {
        var self = this;
        var version = (window.UpdateManager && window.UpdateManager.CURRENT_VERSION) ? window.UpdateManager.CURRENT_VERSION : '2.2.10';
        var query = 'action=login&email=' + encodeURIComponent(email) + '&password=' + encodeURIComponent(password) + '&version=' + encodeURIComponent(version) + '&_t=' + new Date().getTime();

        return callServer(API_URL + '?' + query)
            .then(function (json) {
                if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { throw new Error('Srv Err'); } }
                if (json.result === 'success') {
                    if (json.user) {
                        var s = json.user.status;
                        if (s === 'active' || s === 1) json.user.status = '1';
                        if (s === 'pending' || s === 0) json.user.status = '0';
                    }
                    return self.setSession(json.user, password, { trusted: true }).then(function () { return json; });
                }
                return json;
            })
            .catch(function (err) {
                return { result: 'error', message: 'Connection Failed (' + err.message + ')' };
            });
    },

    encode: function (text) {
        var utf8 = unescape(encodeURIComponent(text));
        var key = 'AnalyseAppSecretKey';
        var result = '';
        for (var i = 0; i < utf8.length; i++) {
            result += String.fromCharCode(utf8.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return btoa(result);
    },

    decode: function (encoded) {
        try {
            var text = atob(encoded);
            var key = 'AnalyseAppSecretKey';
            var result = '';
            for (var i = 0; i < text.length; i++) {
                result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return decodeURIComponent(escape(result));
        } catch (e) {
            return null;
        }
    },

    setSession: function (user, password, options) {
        options = options || {};
        if (user) {
            user = cloneAuthObject(user);
            user.status = normalizeAuthStatus(user.status);
        }

        var jsonStr = JSON.stringify(user);
        var encrypted = this.encode(jsonStr);
        var passwordPromise = Promise.resolve();

        localStorage.setItem('currentUser', encrypted);
        localStorage.setItem('authTime', new Date().getTime());

        if (typeof password === 'string' && password) {
            passwordPromise = this.storePassword(password);
        }

        if (user && options.trusted) {
            this.saveTrustedSubscriptionState(user);
        }

        return passwordPromise.then(function () {
            if (user && window.DB) {
                return window.DB.get('institutionSettings').then(function (localSettings) {
                    localSettings = localSettings || {};
                    var finalSettings = {};
                    for (var k in localSettings) finalSettings[k] = localSettings[k];

                    finalSettings.wilaya = user.wilaya || localSettings.wilaya || '';
                    finalSettings.municipality = user.municipality || localSettings.municipality || '';
                    finalSettings.institutionName = user.institution || localSettings.institutionName || '';
                    finalSettings.managerName = user.manager || localSettings.managerName || '';
                    finalSettings.schoolYear = user.schoolYear || localSettings.schoolYear || '';

                    return window.DB.saveSettings ? window.DB.saveSettings(finalSettings) : window.DB.set('institutionSettings', finalSettings);
                }).catch(function (err) {
                    console.error("Auth Session Sync Failed:", err);
                });
            }
            return Promise.resolve();
        });
    },

    getUser: function () {
        var token = localStorage.getItem('currentUser');
        if (!token) return null;

        var user = null;
        try {
            var decrypted = this.decode(token);
            if (decrypted) {
                user = JSON.parse(decrypted);
            } else {
                user = JSON.parse(token);
                if (!user || !user.email || !this.getTrustedSubscriptionState(user.email)) return null;
                this.setSession(user);
            }
        } catch (e) {
            try {
                user = JSON.parse(token);
                if (!user || !user.email || !this.getTrustedSubscriptionState(user.email)) return null;
            } catch (e2) { return null; }
        }

        if (!user) return null;

        if (user && user.status) {
            var needsUpdate = false;
            if (user.status === 'active') {
                user.status = '1';
                needsUpdate = true;
            } else if (user.status === 'pending') {
                user.status = '0';
                needsUpdate = true;
            }
            if (needsUpdate) {
                this.setSession(user);
            }
        }
        return user;
    },

    performStartupChecks: function () {
        var self = this;
        var user = this.getUser();
        if (!user) return Promise.resolve({ result: 'error' });
        return this.loadStoredPassword()
            .then(function (pass) {
                if (!pass) return { result: 'error' };
                var query = 'action=login&email=' + encodeURIComponent(user.email) + '&password=' + encodeURIComponent(pass);
                return callServer(API_URL + '?' + query)
                    .then(function (json) {
                        if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { throw new Error('Invalid JSON'); } }
                        return json;
                    })
                    .then(function (json) {
                        if (json.result === 'success') {
                            if (json.user) {
                                var s = json.user.status;
                                if (s === 'active' || s === 1) json.user.status = '1';
                                if (s === 'pending' || s === 0) json.user.status = '0';
                            }
                            return self.setSession(json.user, null, { trusted: true }).then(function () {
                                return { result: 'success', updated: true };
                            });
                        }
                        return { result: 'error' };
                    })
                    .catch(function () {
                        return { result: 'error' };
                    });
            })
            .then(function (res) {
                var accessState = self.getAccessState();
                if (!accessState.hasAccess) {
                    self.redirectToSubscription(self.getBlockedMessage(accessState));
                    return { result: 'blocked' };
                }
                return res;
            });
    },

    checkAuth: function (redirect) {
        var user = this.getUser();
        var path = window.location.pathname;
        var isInAData = path.indexOf('A-data') !== -1;
        var isLoginPage = path.indexOf('login.html') !== -1;
        var isSubscriptionPage = path.indexOf('subscription.html') !== -1;
        var isRegisterPage = path.indexOf('register.html') !== -1;
        var isForgotPasswordPage = path.indexOf('forgot_password.html') !== -1;
        if (!user) {
            if (!isLoginPage && !isRegisterPage && !isForgotPasswordPage) {
                window.location.href = isInAData ? 'login.html' : 'A-data/login.html';
            }
            return false;
        }
        var accessState = this.getAccessState();
        if (!accessState.hasAccess) {
            if (!isSubscriptionPage && !isLoginPage) {
                this.redirectToSubscription(this.getBlockedMessage(accessState));
            }
            return false;
        }
        this.syncStatusWithServer();
        this.startHeartbeat();
        return true;
    },

    /**
     * Start the 1-minute heartbeat to track online status.
     * Only starts once per page session.
     */
    startHeartbeat: function () {
        if (window._heartbeatStarted) return;
        window._heartbeatStarted = true;
        var self = this;
        var sendPing = function () {
            var user = self.getUser();
            if (!user) return;
            self.loadStoredPassword().then(function (pass) {
                if (!pass) return;
                var query = 'action=heartbeat&email=' + encodeURIComponent(user.email) + '&password=' + encodeURIComponent(pass);
                return callServer(API_URL + '?' + query)
                    .then(function (json) {
                        if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { return; } }
                        if (json.result === 'success') {
                            var needsRedirect = false;
                            if (json.is_active === false) {
                                needsRedirect = true;
                            }
                            if (json.status || json.expires_at) {
                                var currentUser = self.getUser();
                                if (currentUser) {
                                    currentUser.status = json.status;
                                    if (json.expires_at) currentUser.expiresDate = json.expires_at;
                                    self.setSession(currentUser, null, { trusted: true });
                                }
                            }
                            if (needsRedirect) {
                                self.redirectToSubscription('?????? ?? ????? ?????? ?? ????? ??????? ????? ??????? ???????.');
                            }
                        }
                    })
                    .catch(function () { /* Silent fail if offline */ });
            }).catch(function () { /* Silent fail if secure storage is unavailable */ });
        };
        sendPing();
        setInterval(sendPing, 60000);
    },

    /**
     * Silently check the server for fresh subscription status.
     * Updates local storage if the user renewed or got blocked.
     * Fails silently if offline (offline-first).
     */
    syncStatusWithServer: function () {
        var user = this.getUser();
        if (!user) return;
        var hasSynced = sessionStorage.getItem('hasAuthServerSynced');
        if (hasSynced === 'true') return;
        sessionStorage.setItem('hasAuthServerSynced', 'true');
        var version = (window.UpdateManager && window.UpdateManager.CURRENT_VERSION) ? window.UpdateManager.CURRENT_VERSION : '2.2.10';
        var self = this;
        this.loadStoredPassword().then(function (pass) {
            if (!pass) return;
            var query = 'action=login&email=' + encodeURIComponent(user.email) + '&password=' + encodeURIComponent(pass) + '&version=' + encodeURIComponent(version);
            return callServer(API_URL + '?' + query)
                .then(function (json) {
                    if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { throw new Error('Invalid JSON'); } }
                    if (json.result === 'success' && json.user) {
                        var s = json.user.status;
                        if (s === 'active' || s === 1) json.user.status = '1';
                        if (s === 'pending' || s === 0) json.user.status = '0';
                        self.setSession(json.user, null, { trusted: true });
                    } else if (json.result === 'error') {
                        if (json.message && (json.message.indexOf('?????') !== -1 || json.message.indexOf('?????') !== -1)) {
                            self.redirectToSubscription(json.message);
                        }
                    }
                })
                .catch(function () {
                    // Ignore. User is offline or server is unreachable.
                    // The app will continue using local data.
                });
        }).catch(function () {
            // Ignore secure storage errors to preserve offline-first behaviour.
        });
    },

    parseDate: function (user) {
        if (!user) return null;
        var dateStr = user.subscriptionDate || user.startDate || user.date || user['\u062a\u0627\u0631\u064a\u062e'] || user['\u062a\u0627\u0631\u064a\u062e_\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643'];
        if (!dateStr) return null;

        var timestamp = Date.parse(dateStr);
        if (!isNaN(timestamp)) return new Date(timestamp);

        dateStr = dateStr.replace(/[\u0660-\u0669]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 1632); })
            .replace(/[\u06F0-\u06F9]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 1776); });
        dateStr = dateStr.replace('T', ' ').replace('Z', '').replace(/[^\d/\- :]/g, '').trim();

        if (!dateStr) {
            var datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}/;
            for (var key in user) {
                if (typeof user[key] === 'string' && datePattern.test(user[key])) {
                    dateStr = user[key];
                    break;
                }
            }
        }
        if (!dateStr) return null;

        try {
            var parts = dateStr.split(' ')[0].split(/[\/-]/);
            if (parts.length === 3) {
                var p0 = parseInt(parts[0]);
                var p1 = parseInt(parts[1]);
                var p2 = parseInt(parts[2]);
                if (p0 > 1000) return new Date(p0, p1 - 1, p2);
                else if (p2 > 1000) return new Date(p2, p1 - 1, p0);
            }
            return new Date(dateStr);
        } catch (e) { return null; }
    },

    calculateDaysRemaining: function (sourceUser) {
        var user = sourceUser || this.getUser();
        if (!user) return 0;

        var endDate;
        if (user.expiresDate) {
            endDate = new Date(user.expiresDate);
        } else {
            var startDate = this.parseDate(user);
            if (!startDate) return AUTH_DAYS_UNKNOWN; // No date info, allow access (offline-first)

            endDate = new Date(startDate);
            if (user.status === 'trial') {
                endDate.setDate(endDate.getDate() + 15);
            } else {
                endDate.setFullYear(endDate.getFullYear() + 1);
            }
        }

        // --- Anti-Time-Tampering Logic ---
        var now = new Date();
        var isTampered = this.verifyTimeline(now.getTime());

        if (isTampered) {
            console.error("Time tampering detected! Clock moved backwards.");
            return AUTH_DAYS_TAMPERED;
        }

        var diffMs = endDate.getTime() - now.getTime();
        var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return diffDays;
    },

    /**
     * Verifies that the local clock hasn't been set backwards.
     * Keeps track of the latest known time in localStorage.
     * Returns true if tampering is detected.
     */
    verifyTimeline: function (currentTimeMs) {
        var lastKnownStr = localStorage.getItem('lastTimelineCheck');
        var lastKnown = lastKnownStr ? parseInt(lastKnownStr, 10) : 0;

        // If current time is older than the last known time by more than 1 day
        // it means the user significantly turned back their computer's clock.
        if (lastKnown > 0 && currentTimeMs < (lastKnown - (1000 * 60 * 60 * 24))) {
            this.syncWorldTime(true); // Force sync to self-correct future dates
            return true; // Tampered!
        }

        // Update with the latest known valid time
        if (currentTimeMs > lastKnown) {
            localStorage.setItem('lastTimelineCheck', currentTimeMs.toString());
        }

        // Optional: async fetch world time to fix local clock
        this.syncWorldTime(false);

        return false;
    },

    /**
     * Async fetch real world time to update the timeline without blocking the UI.
     * Only runs once every 12 hours to avoid spamming the API.
     */
    syncWorldTime: function (forceSync) {
        var lastSyncStr = localStorage.getItem('lastWorldTimeSync');
        var lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
        var nowMs = new Date().getTime();

        // Sync every 12 hours minimum, unless forced
        if (!forceSync && (nowMs - lastSync < (1000 * 60 * 60 * 12))) return;

        var self = this;
        var updateTimeline = function (utcStr) {
            if (!utcStr) return false;
            var realTime = new Date(utcStr).getTime();
            if (isNaN(realTime)) return false;

            // Always trust the API server as the absolute source of truth.
            // This corrects any accidental future-dated timelines automatically.
            localStorage.setItem('lastTimelineCheck', realTime.toString());
            localStorage.setItem('lastWorldTimeSync', nowMs.toString());

            // If we forced a sync (due to tamper flag) and we successfully fetched the real time,
            // reload the page to clear the subscription block screen.
            if (forceSync && window.location.pathname.indexOf('subscription.html') !== -1) {
                window.location.reload();
            }
            return true;
        };

        // Primary: timeapi.io
        callServer('https://timeapi.io/api/time/current/zone?timezone=UTC')
            .then(function (data) {
                if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { throw new Error('Retry'); } }
                if (data && data.dateTime) {
                    updateTimeline(data.dateTime);
                } else {
                    throw new Error('Retry');
                }
            })
            .catch(function () {
                // Secondary fallback: worldtimeapi.org
                return callServer('https://worldtimeapi.org/api/timezone/Etc/UTC')
                    .then(function (data) {
                        if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { return; } }
                        if (data && data.utc_datetime) {
                            updateTimeline(data.utc_datetime);
                        }
                    });
            })
            .catch(function (err) {
                // All failed (offline or blocked), ignore silently.
            });
    },

    redirectToSubscription: function (msg) {
        sessionStorage.setItem('subscriptionMessage', msg);
        var path = window.location.pathname;
        var isInAData = path.indexOf('A-data') !== -1;
        window.location.href = isInAData ? 'subscription.html' : 'A-data/subscription.html';
    },

    isActive: function () {
        return this.getAccessState().isActiveStatus;
    },

    updateStatus: function (email, status) {
        var query = 'action=updateStatus&email=' + encodeURIComponent(email) + '&status=' + encodeURIComponent(status);
        try {
            callServer(API_URL + '?' + query).catch(function (e) { });
        } catch (e) { }
    },

    updateProfile: function (settings) {
        var user = this.getUser();
        if (!user || !user.email) return Promise.resolve();
        return this.loadStoredPassword().then(function (password) {
            if (!password) return Promise.resolve();
            var payload = {
                email: user.email,
                password: password,
                institution: settings.institutionName || '',
                manager: settings.managerName || '',
                wilaya: settings.wilaya || '',
                daira: settings.district || settings.daira || '',
                municipality: settings.municipality || '',
                phone: settings.phone || ''
            };
            var query = 'action=update_profile&_t=' + new Date().getTime();
            return callServer(API_URL + '?' + query, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(function (json) {
                    if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { return json; } }
                    if (json.result === 'success') {
                        console.log('[Auth] Profile synced to server successfully');
                    }
                    return json;
                })
                .catch(function (e) { console.warn('[Auth] Profile sync failed:', e); });
        });
    },

    // ================================================================
    // Password Reset Methods
    // ================================================================

    requestPasswordReset: function (email) {
        var query = 'action=request_password_reset&_t=' + new Date().getTime();
        return callServer(API_URL + '?' + query, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        }).then(function (json) {
            if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { throw new Error('Srv Err'); } }
            return json;
        }).catch(function (err) {
            return { result: 'error', message: '\u0641\u0634\u0644 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0627\u0644\u062e\u0627\u062f\u0645 (' + err.message + ')' };
        });
    },

    verifyResetCode: function (email, code) {
        var query = 'action=verify_reset_code&_t=' + new Date().getTime();
        return callServer(API_URL + '?' + query, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, code: code })
        }).then(function (json) {
            if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { throw new Error('Srv Err'); } }
            return json;
        }).catch(function (err) {
            return { result: 'error', message: '\u0641\u0634\u0644 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0627\u0644\u062e\u0627\u062f\u0645 (' + err.message + ')' };
        });
    },

    resetPassword: function (email, code, newPassword) {
        var query = 'action=reset_password&_t=' + new Date().getTime();
        return callServer(API_URL + '?' + query, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, code: code, password: newPassword })
        }).then(function (json) {
            if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { throw new Error('Srv Err'); } }
            return json;
        }).catch(function (err) {
            return { result: 'error', message: '\u0641\u0634\u0644 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0627\u0644\u062e\u0627\u062f\u0645 (' + err.message + ')' };
        });
    },

    logout: function () {
        this.clearTrustedSubscriptionState();
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authTime');
        var isInAData = window.location.pathname.indexOf('A-data') !== -1;
        this.clearStoredPassword().then(function () {
            window.location.href = isInAData ? 'login.html' : 'A-data/login.html';
        });
    }
};

window.Auth = Auth;

(function installExcelExportGuards() {
    var EXCEL_EXPORT_FEATURE = 'excel-export';
    var PATCH_RETRY_LIMIT = 40;
    var patchRetryCount = 0;
    var mutationScheduled = false;

    function isButtonLike(element) {
        if (!element || !element.tagName) return false;
        var tag = element.tagName.toUpperCase();
        return tag === 'BUTTON' || tag === 'A' || tag === 'INPUT';
    }

    function containsAny(text, needles) {
        if (!text) return false;
        for (var i = 0; i < needles.length; i++) {
            if (text.indexOf(needles[i]) !== -1) return true;
        }
        return false;
    }

    function normalizeFeatureText(text) {
        return (text || '').toString().replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function looksLikeExcelExportControl(element) {
        if (!isButtonLike(element)) return false;

        var onclickText = normalizeFeatureText(element.getAttribute ? (element.getAttribute('onclick') || '') : '');
        var idText = normalizeFeatureText(element.id || '');
        var classText = normalizeFeatureText(typeof element.className === 'string' ? element.className : '');
        var titleText = normalizeFeatureText(element.title || '');
        var text = normalizeFeatureText((element.textContent || element.innerText || element.value || '') + ' ' + titleText);

        var hasExcelWord = containsAny(text, ['excel', 'xlsx', 'اكسل', 'إكسل']);
        var hasExportWord = containsAny(text, ['تصدير', 'export']);
        var onclickLooksExport = containsAny(onclickText, ['export']) && containsAny(onclickText, ['excel', 'xlsx']);
        var idLooksExport = containsAny(idText + ' ' + classText, ['exportexcel', 'excelexport', 'btnexportexcel']);
        var iconLooksExport = false;

        try {
            iconLooksExport = !!element.querySelector('.fa-file-excel, [data-icon="file-excel"]');
        } catch (e) { }

        if (onclickText.indexOf('save-excel') !== -1) return true;
        if (onclickLooksExport || idLooksExport) return true;
        if (hasExcelWord && hasExportWord) return true;
        if (iconLooksExport && hasExportWord) return true;

        return false;
    }

    function closestExcelExportControl(node) {
        while (node && node !== document && node !== document.documentElement) {
            if (node.nodeType === 1 && looksLikeExcelExportControl(node)) {
                return node;
            }
            node = node.parentNode;
        }
        return null;
    }

    function applyExcelExportDisabledState(element, disabled) {
        if (!element || !looksLikeExcelExportControl(element)) return;

        var message = Auth.getFeatureBlockedMessage(EXCEL_EXPORT_FEATURE);
        var tag = element.tagName ? element.tagName.toUpperCase() : '';

        if (disabled) {
            element.setAttribute('data-auth-excel-disabled', '1');
            element.setAttribute('aria-disabled', 'true');
            element.title = message;
            element.style.opacity = '0.6';
            element.style.cursor = 'not-allowed';

            if (tag === 'BUTTON' || tag === 'INPUT') {
                element.disabled = true;
            } else {
                element.style.pointerEvents = 'none';
            }
        } else if (element.getAttribute('data-auth-excel-disabled') === '1') {
            element.removeAttribute('data-auth-excel-disabled');
            element.setAttribute('aria-disabled', 'false');
            element.style.opacity = '';
            element.style.cursor = '';
            if (tag === 'BUTTON' || tag === 'INPUT') {
                element.disabled = false;
            } else {
                element.style.pointerEvents = '';
            }
        }
    }

    function refreshExcelExportControls(root) {
        var disabled = Auth.isFeatureRestricted(EXCEL_EXPORT_FEATURE);
        var scope = root && root.querySelectorAll ? root : document;
        var controls = [];

        if (root && root.nodeType === 1 && looksLikeExcelExportControl(root)) {
            controls.push(root);
        }

        if (scope && scope.querySelectorAll) {
            var found = scope.querySelectorAll('button, a, input[type="button"], input[type="submit"]');
            for (var i = 0; i < found.length; i++) {
                if (looksLikeExcelExportControl(found[i])) controls.push(found[i]);
            }
        }

        for (var j = 0; j < controls.length; j++) {
            applyExcelExportDisabledState(controls[j], disabled);
        }
    }

    function patchIpcSaveExcelInvoke() {
        var ipcRenderer = Auth.getIpcRenderer ? Auth.getIpcRenderer() : null;
        if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function' || ipcRenderer.__authExcelInvokePatched) {
            return;
        }

        var originalInvoke = ipcRenderer.invoke;
        ipcRenderer.invoke = function (channel) {
            if (channel === 'save-excel' && Auth.blockRestrictedFeature(EXCEL_EXPORT_FEATURE)) {
                return Promise.resolve({ success: false, canceled: true, blocked: true });
            }
            return originalInvoke.apply(ipcRenderer, arguments);
        };

        ipcRenderer.__authExcelInvokePatched = true;
        try { window.ipcRenderer = ipcRenderer; } catch (e) { }
    }

    function patchXlsxWriteFile() {
        if (!window.XLSX || typeof window.XLSX.writeFile !== 'function' || window.XLSX.__authExcelWriteFilePatched) {
            return false;
        }

        var originalWriteFile = window.XLSX.writeFile;
        window.XLSX.writeFile = function () {
            if (Auth.blockRestrictedFeature(EXCEL_EXPORT_FEATURE)) {
                return false;
            }
            return originalWriteFile.apply(window.XLSX, arguments);
        };

        window.XLSX.__authExcelWriteFilePatched = true;
        return true;
    }

    function ensureExcelRuntimePatches() {
        patchIpcSaveExcelInvoke();
        if (patchXlsxWriteFile()) return;

        patchRetryCount += 1;
        if (patchRetryCount < PATCH_RETRY_LIMIT) {
            setTimeout(ensureExcelRuntimePatches, 500);
        }
    }

    document.addEventListener('click', function (event) {
        if (!Auth.isFeatureRestricted(EXCEL_EXPORT_FEATURE)) return;

        var control = closestExcelExportControl(event.target);
        if (!control) return;

        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }
        event.preventDefault();
        event.stopPropagation();
        Auth.blockRestrictedFeature(EXCEL_EXPORT_FEATURE);
    }, true);

    document.addEventListener('DOMContentLoaded', function () {
        refreshExcelExportControls(document);
        ensureExcelRuntimePatches();

        if (window.MutationObserver) {
            var observer = new MutationObserver(function (mutations) {
                if (mutationScheduled) return;
                mutationScheduled = true;
                setTimeout(function () {
                    mutationScheduled = false;
                    for (var i = 0; i < mutations.length; i++) {
                        var mutation = mutations[i];
                        for (var j = 0; j < mutation.addedNodes.length; j++) {
                            var node = mutation.addedNodes[j];
                            if (node && node.nodeType === 1) {
                                refreshExcelExportControls(node);
                            }
                        }
                    }
                }, 0);
            });

            observer.observe(document.documentElement || document.body, {
                childList: true,
                subtree: true
            });
        }
    });

    ensureExcelRuntimePatches();
}());
