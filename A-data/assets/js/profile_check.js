/**
 * Profile Completion Checker (Unified)
 * Single system that checks for missing institution data from BOTH
 * local DB settings AND the Auth session, then prompts the user.
 * Syncs completed data to: Local DB + localStorage session + Server API
 * 
 * Replaces the old dual-system (profile_check.js + profile_completer.js)
 */
(function() {
    'use strict';

    var API_URL = window.API_URL || "https://idarati.amanidev.com/api/desktop-api";

    var ProfileCheck = {
        /**
         * All mandatory fields the user must fill.
         * `id` = key in DB settings (local)
         * `serverKey` = key expected by the server API
         */
        mandatoryFields: [
            { id: 'institutionName', serverKey: 'institution', label: 'اسم المؤسسة', icon: 'building-2', placeholder: 'مثال: متوسطة الشهيد...' },
            { id: 'managerName', serverKey: 'manager', label: 'اسم المدير', icon: 'user', placeholder: 'الاسم واللقب...' },
            { id: 'wilaya', serverKey: 'wilaya', label: 'الولاية', icon: 'map-pin', placeholder: 'مثال: الجزائر' },
            { id: 'district', serverKey: 'daira', label: 'الدائرة', icon: 'navigation', placeholder: 'مثال: سيدي امحمد' },
            { id: 'municipality', serverKey: 'municipality', label: 'البلدية', icon: 'home', placeholder: 'مثال: الجزائر الوسطى' },
            { id: 'phone', serverKey: 'phone', label: 'رقم الهاتف', icon: 'phone', placeholder: '05/06/07...' }
        ],

        /**
         * Main entry point: check if profile is complete
         * Merges data from DB settings + Auth session to find truly missing fields
         */
        check: function() {
            if (typeof DB === 'undefined') return;

            // Don't show again in the same session if user clicked "later"
            if (sessionStorage.getItem('profileCheckDismissed') === 'true') return;

            // Don't show if another profile modal is already open
            if (document.getElementById('profileCompletionModal')) return;

            DB.getSettings().then(function(settings) {
                settings = settings || {};

                // Also check Auth session for extra data
                var user = null;
                if (typeof Auth !== 'undefined' && Auth.getUser) {
                    user = Auth.getUser();
                }

                // Merge: prefer DB settings, fallback to Auth user session
                var merged = {};
                ProfileCheck.mandatoryFields.forEach(function(field) {
                    var localVal = settings[field.id] || '';
                    var userVal = '';
                    if (user) {
                        // Map local field id to user session key
                        if (field.id === 'institutionName') userVal = user.institution || '';
                        else if (field.id === 'managerName') userVal = user.manager || '';
                        else if (field.id === 'district') userVal = user.daira || user.district || '';
                        else userVal = user[field.id] || '';
                    }
                    merged[field.id] = (localVal.toString().trim() !== '') ? localVal : userVal;
                });

                // Find what's still missing
                var missing = [];
                ProfileCheck.mandatoryFields.forEach(function(field) {
                    if (!merged[field.id] || merged[field.id].toString().trim() === '') {
                        missing.push(field);
                    }
                });

                if (missing.length > 0) {
                    ProfileCheck.showModal(merged, missing);
                }
            });
        },

        /**
         * Show the profile completion modal
         * @param {Object} mergedValues - Current values (merged from DB + Auth)
         * @param {Array} missingFields - Fields that are still empty
         */
        showModal: function(mergedValues, missingFields) {
            // Prevent duplicate
            if (document.getElementById('profileCompletionModal')) return;

            // Count missing
            var missingCount = missingFields.length;
            var missingIds = missingFields.map(function(f) { return f.id; });

            // Create styles
            var style = document.createElement('style');
            style.id = 'profileCheckStyles';
            style.innerHTML = '\
                .profile-modal-overlay {\
                    position: fixed;\
                    top: 0; left: 0; width: 100%; height: 100%;\
                    background: rgba(15, 23, 42, 0.7);\
                    backdrop-filter: blur(8px);\
                    z-index: 999999;\
                    display: flex;\
                    justify-content: center;\
                    align-items: center;\
                    font-family: "Cairo", sans-serif;\
                    animation: pcFadeIn 0.3s ease;\
                }\
                .profile-modal-content {\
                    background: white;\
                    width: 90%;\
                    max-width: 600px;\
                    border-radius: 24px;\
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);\
                    overflow: hidden;\
                    animation: pcSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);\
                }\
                .profile-modal-header {\
                    background: linear-gradient(135deg, #1e293b, #0f172a);\
                    color: white;\
                    padding: 30px;\
                    text-align: center;\
                }\
                .profile-modal-header h2 {\
                    margin: 0; font-size: 1.5rem; font-weight: 800; color: #fff;\
                }\
                .profile-modal-header p {\
                    margin: 8px 0 0 0; opacity: 0.8; font-size: 0.95rem; color: #cbd5e1;\
                }\
                .profile-missing-badge {\
                    display: inline-block;\
                    background: rgba(239, 68, 68, 0.2);\
                    color: #fca5a5;\
                    padding: 4px 14px;\
                    border-radius: 20px;\
                    font-size: 0.85rem;\
                    margin-top: 10px;\
                    font-weight: 700;\
                }\
                .profile-modal-body {\
                    padding: 30px;\
                    max-height: 60vh;\
                    overflow-y: auto;\
                }\
                .profile-form-grid {\
                    display: grid;\
                    grid-template-columns: 1fr 1fr;\
                    gap: 15px;\
                }\
                .profile-field-full { grid-column: span 2; }\
                .profile-input-group {\
                    margin-bottom: 5px;\
                }\
                .profile-input-group label {\
                    display: flex;\
                    align-items: center;\
                    gap: 6px;\
                    font-weight: 700;\
                    margin-bottom: 8px;\
                    color: #475569;\
                    font-size: 0.9rem;\
                }\
                .profile-input-group label .field-status {\
                    font-size: 0.7rem;\
                    font-weight: 700;\
                    padding: 1px 8px;\
                    border-radius: 10px;\
                    white-space: nowrap;\
                    flex-shrink: 0;\
                }\
                .profile-input-group label .field-ok {\
                    color: #16a34a;\
                    background: rgba(34, 197, 94, 0.1);\
                }\
                .profile-input-group label .field-missing {\
                    color: #dc2626;\
                    background: rgba(239, 68, 68, 0.1);\
                }\
                .profile-input-group input {\
                    width: 100%;\
                    padding: 12px 15px;\
                    border: 2px solid var(--border-color);\
                    border-radius: 12px;\
                    font-family: inherit;\
                    font-size: 1rem;\
                    transition: all 0.2s;\
                    box-sizing: border-box;\
                }\
                .profile-input-group input:focus {\
                    border-color: #3b82f6;\
                    outline: none;\
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);\
                }\
                .profile-input-group input.field-error {\
                    border-color: #ef4444;\
                    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);\
                }\
                .profile-modal-footer {\
                    padding: 20px 30px;\
                    background: #f8fafc;\
                    border-top: 1px solid var(--border-color);\
                    display: flex;\
                    justify-content: space-between;\
                    align-items: center;\
                    gap: 10px;\
                }\
                .btn-profile-save {\
                    background: linear-gradient(135deg, #3b82f6, #2563eb);\
                    color: white;\
                    border: none;\
                    padding: 12px 30px;\
                    border-radius: 12px;\
                    font-weight: 800;\
                    cursor: pointer;\
                    transition: all 0.2s;\
                    display: flex;\
                    align-items: center;\
                    gap: 8px;\
                    font-family: inherit;\
                    font-size: 1rem;\
                }\
                .btn-profile-save:hover {\
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);\
                    transform: translateY(-2px);\
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);\
                }\
                .btn-profile-save:disabled {\
                    opacity: 0.6;\
                    cursor: not-allowed;\
                    transform: none;\
                }\
                .btn-profile-later {\
                    background: transparent;\
                    color: #94a3b8;\
                    border: 1px solid var(--border-color);\
                    padding: 10px 20px;\
                    border-radius: 12px;\
                    font-weight: 600;\
                    cursor: pointer;\
                    transition: all 0.2s;\
                    font-family: inherit;\
                    font-size: 0.9rem;\
                }\
                .btn-profile-later:hover {\
                    background: #f1f5f9;\
                    color: #64748b;\
                }\
                .profile-sync-status {\
                    font-size: 0.8rem;\
                    color: #94a3b8;\
                    text-align: center;\
                    padding: 0 30px 15px;\
                }\
                @keyframes pcFadeIn { from { opacity: 0; } to { opacity: 1; } }\
                @keyframes pcSlideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }\
                @media (max-width: 600px) {\
                    .profile-form-grid { grid-template-columns: 1fr; }\
                    .profile-field-full { grid-column: span 1; }\
                    .profile-modal-footer { flex-direction: column; }\
                }\
            ';
            document.head.appendChild(style);

            // Create modal
            var modal = document.createElement('div');
            modal.id = 'profileCompletionModal';
            modal.className = 'profile-modal-overlay';
            
            // Build form fields  
            var formHtml = ProfileCheck.mandatoryFields.map(function(f) {
                var val = mergedValues[f.id] || '';
                var isFull = (f.id === 'institutionName');
                var isMissing = missingIds.indexOf(f.id) !== -1;
                var statusHtml = isMissing 
                    ? '<span class="field-status field-missing">● ناقص</span>'
                    : '<span class="field-status field-ok">✓</span>';

                return '\
                    <div class="profile-input-group ' + (isFull ? 'profile-field-full' : '') + '">\
                        <label>' + statusHtml + f.label + '</label>\
                        <input type="text" id="pc-' + f.id + '" value="' + ProfileCheck.escapeHtml(val) + '" placeholder="' + f.placeholder + '">\
                    </div>\
                ';
            }).join('');

            modal.innerHTML = '\
                <div class="profile-modal-content">\
                    <div class="profile-modal-header">\
                        <h2>إكمال البيانات الأساسية</h2>\
                        <p>يرجى تزويدنا بمعلومات المؤسسة لضمان صحة التقارير والمزامنة</p>\
                        <div class="profile-missing-badge">' + missingCount + ' حقول ناقصة من أصل ' + ProfileCheck.mandatoryFields.length + '</div>\
                    </div>\
                    <div class="profile-modal-body">\
                        <div class="profile-form-grid">\
                            ' + formHtml + '\
                        </div>\
                    </div>\
                    <div class="profile-modal-footer">\
                        <button class="btn-profile-later" id="btnProfileLater">\
                            تذكيري لاحقاً\
                        </button>\
                        <button class="btn-profile-save" id="btnSaveProfile">\
                            <span>حفظ ومزامنة</span>\
                            <i class="fas fa-cloud-upload-alt"></i>\
                        </button>\
                    </div>\
                    <div class="profile-sync-status" id="profileSyncStatus"></div>\
                </div>\
            ';
            document.body.appendChild(modal);

            // === Handle "Later" button ===
            document.getElementById('btnProfileLater').onclick = function() {
                sessionStorage.setItem('profileCheckDismissed', 'true');
                ProfileCheck.closeModal();
            };

            // === Handle Save ===
            document.getElementById('btnSaveProfile').onclick = function() {
                var btn = this;
                var isValid = true;
                var newValues = {};
                
                // Validate all fields
                ProfileCheck.mandatoryFields.forEach(function(f) {
                    var el = document.getElementById('pc-' + f.id);
                    var val = el.value.trim();
                    if (val === '') {
                        isValid = false;
                        el.classList.add('field-error');
                    } else {
                        el.classList.remove('field-error');
                        newValues[f.id] = val;
                    }
                });

                if (!isValid) return;

                btn.disabled = true;
                btn.innerHTML = '<span>جاري الحفظ...</span> <i class="fas fa-spinner fa-spin"></i>';

                // Step 1: Save to local DB
                ProfileCheck.saveLocally(newValues).then(function() {
                    ProfileCheck.updateStatus('✓ تم الحفظ محلياً');

                    // Step 2: Sync with server (if online)
                    if (navigator.onLine) {
                        ProfileCheck.updateStatus('⟳ جاري المزامنة مع الخادم...');
                        return ProfileCheck.syncToServer(newValues);
                    } else {
                        ProfileCheck.updateStatus('⚠ لا يوجد إنترنت — سيتم المزامنة عند الاتصال');
                        return Promise.resolve({ result: 'offline' });
                    }
                }).then(function(serverResult) {
                    if (serverResult && serverResult.result === 'success') {
                        ProfileCheck.updateStatus('✓ تم المزامنة مع الخادم بنجاح');
                        
                        // Update local session with server response if available
                        if (serverResult.user && typeof Auth !== 'undefined' && Auth.setSession) {
                            Auth.setSession(serverResult.user, null, { trusted: true });
                        }
                    }

                    // Close modal after a brief delay
                    setTimeout(function() {
                        ProfileCheck.closeModal();
                        
                        // Refresh dashboard info if available
                        if (window.loadInstitutionInfo) {
                            window.loadInstitutionInfo();
                        }
                    }, 800);
                }).catch(function(err) {
                    console.error('Profile save error:', err);
                    ProfileCheck.updateStatus('⚠ تم الحفظ محلياً، لكن فشلت المزامنة مع الخادم');
                    btn.disabled = false;
                    btn.innerHTML = '<span>حفظ ومزامنة</span> <i class="fas fa-cloud-upload-alt"></i>';
                    
                    // Close after delay even on sync failure (local save succeeded)
                    setTimeout(function() {
                        ProfileCheck.closeModal();
                        if (window.loadInstitutionInfo) {
                            window.loadInstitutionInfo();
                        }
                    }, 2000);
                });
            };
        },

        /**
         * Save profile data to local DB + localStorage session
         */
        saveLocally: function(newValues) {
            return DB.getSettings().then(function(settings) {
                settings = settings || {};
                
                // Update settings with new values
                ProfileCheck.mandatoryFields.forEach(function(f) {
                    if (newValues[f.id]) {
                        settings[f.id] = newValues[f.id];
                    }
                });

                // Save to DB
                return DB.saveSettings(settings).then(function() {
                    // Also update the Auth session in localStorage
                    if (typeof Auth !== 'undefined' && Auth.getUser) {
                        var user = Auth.getUser();
                        if (user) {
                            user.institution = newValues.institutionName || user.institution;
                            user.manager = newValues.managerName || user.manager;
                            user.wilaya = newValues.wilaya || user.wilaya;
                            user.daira = newValues.district || user.daira;
                            user.municipality = newValues.municipality || user.municipality;
                            user.phone = newValues.phone || user.phone;
                            
                            if (Auth.setSession) {
                                return Auth.setSession(user);
                            }
                        }
                    }
                });
            });
        },

        /**
         * Sync profile data to the server via POST
         * Uses action=update_profile which accepts JSON body
         */
        syncToServer: function(newValues) {
            var user = null;
            if (typeof Auth !== 'undefined' && Auth.getUser) {
                user = Auth.getUser();
            }
            if (!user || !user.email) {
                return Promise.resolve({ result: 'error', message: 'No user session' });
            }

            return Auth.loadStoredPassword().then(function (password) {
                if (!password) {
                    return Promise.resolve({ result: 'error', message: 'No auth hash' });
                }

                var payload = {
                    email: user.email,
                    password: password,
                    institution: newValues.institutionName || '',
                    manager: newValues.managerName || '',
                    wilaya: newValues.wilaya || '',
                    daira: newValues.district || '',
                    municipality: newValues.municipality || '',
                    phone: newValues.phone || ''
                };

                var query = 'action=update_profile&_t=' + new Date().getTime();

                return fetch(API_URL + '?' + query, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                .then(function(res) { return res.json(); })
                .then(function(json) {
                    console.log('[ProfileCheck] Server sync result:', json.result);
                    return json;
                })
                .catch(function(err) {
                    console.warn('[ProfileCheck] Server sync failed:', err.message);
                    return { result: 'error', message: err.message };
                });
            });
        },

        /**
         * Update the status text at the bottom of the modal
         */
        updateStatus: function(text) {
            var el = document.getElementById('profileSyncStatus');
            if (el) el.textContent = text;
        },

        /**
         * Close and remove the modal
         */
        closeModal: function() {
            var modal = document.getElementById('profileCompletionModal');
            if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
            var style = document.getElementById('profileCheckStyles');
            if (style && style.parentNode) {
                style.parentNode.removeChild(style);
            }
        },

        /**
         * Escape HTML to prevent XSS in input values
         */
        escapeHtml: function(str) {
            if (!str) return '';
            return str.toString()
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
    };

    // Expose to Auth module
    if (typeof Auth !== 'undefined') {
        Auth.checkProfileCompletion = ProfileCheck.check;
    } else {
        window.checkProfileCompletion = ProfileCheck.check;
    }

    // Also expose globally for direct access
    window.ProfileCheck = ProfileCheck;

})();
