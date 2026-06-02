/**
 * Update Manager Module
 * Handles version checking against Google Sheets backend
 */

let fs, path, exec, spawn, os, https, shell;

// Safely attempt to load Node.js modules
try {
    if (typeof require !== 'undefined') {
        fs = require('fs');
        path = require('path');
        const cp = require('child_process');
        exec = cp.exec;
        spawn = cp.spawn;
        os = require('os');
        https = require('https');
        // Handle Electron require
        const electron = require('electron');
        shell = electron.shell || electron.remote.shell;
    }
} catch (e) {
    console.warn('UpdateManager: Node.js environment not detected. improved logic enabled.');
}

const UpdateManager = {
    // Current Application Version
    // Increment this when releasing new updates
    CURRENT_VERSION: '2.2.10',

    // Laravel API endpoint (replaces Google Sheets)
    API_URL: "https://idarati.amanidev.com/api/check-update",

    /**
     * Show a toast notification at bottom of screen
     */
    showToast(message, type = 'info', duration = 3000) {
        // Remove existing toast if any
        const existingToast = document.getElementById('update-toast');
        if (existingToast) existingToast.remove();

        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            info: 'var(--secondary-color)'
        };

        // Stop animation when notification appears
        this.stopAnimation(this._activeBtn);

        const toast = document.createElement('div');
        toast.id = 'update-toast';
        toast.innerHTML = `<span style="margin-left: 10px;">✓</span> ${message}`;
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: ${colors[type] || colors.info};
            color: white;
            padding: 15px 25px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            font-family: 'Tajawal', sans-serif;
            font-weight: bold;
            font-size: 1rem;
            z-index: 99999;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        `;
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);

        // Animate out and remove
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(100px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, duration);
    },

    /**
     * Entry point: Check for updates silently
     */
    async checkForUpdates(manualCheck = false, btnElement = null) {
        // Prevent duplicate automatic checks
        if (!manualCheck && this._updateCheckInProgress) {
            return;
        }
        this._updateCheckInProgress = true;
        this._activeBtn = btnElement;

        // Start spin animation
        if (btnElement) {
            const icon = btnElement.querySelector('.update-icon') || btnElement.querySelector('[data-lucide*="refresh"]') || btnElement.querySelector('i');
            if (icon) {
                icon.classList.add('lucide-spin');
            }
        }

        try {
            // For automatic checks, use cached data if available (avoids API call on every page navigation)
            if (!manualCheck) {
                const cachedInfo = sessionStorage.getItem('update_info');
                if (cachedInfo) {
                    try {
                        const cachedData = JSON.parse(cachedInfo);
                        if (cachedData && cachedData.version) {
                            if (this.compareVersions(cachedData.version, this.CURRENT_VERSION) > 0) {
                                const isDismissed = sessionStorage.getItem('update_dismissed');
                                if (!isDismissed) {
                                    this.showUpdateModal(cachedData);
                                }
                                this.updateNavbarBadge(true);
                                this.injectUpdateCard(cachedData);
                            }
                            return; // Use cached data, no need for API call
                        }
                    } catch (parseErr) {
                        // Invalid cache, continue with API call
                    }
                }
            }

            // 2. Fetch latest version info — no action param needed, endpoint is dedicated
            const response = await fetch(`${this.API_URL}?_t=${new Date().getTime()}`);
            const data = await response.json();

            // 3. Validate response
            if (!data || !data.version) {
                if (manualCheck) {
                    this.stopAnimation(this._activeBtn);
                    alert('تلقيت بيانات غير صالحة من الخادم:\n' + JSON.stringify(data));
                }
                return;
            }

            // Cache the result
            sessionStorage.setItem('update_info', JSON.stringify(data));

            // 4. Compare versions
            if (this.compareVersions(data.version, this.CURRENT_VERSION) > 0) {
                // Show modal if: manual check OR not dismissed in this session
                const isDismissed = sessionStorage.getItem('update_dismissed');

                if (manualCheck || !isDismissed) {
                    this.showUpdateModal(data);
                }

                this.updateNavbarBadge(true);
                this.injectUpdateCard(data);
            } else {
                this.updateNavbarBadge(false);
                sessionStorage.removeItem('update_info'); // Clear cache if up to date
                sessionStorage.removeItem('update_dismissed'); // Clear dismiss flag if up to date

                if (manualCheck) {
                    this.showToast('أنت تستخدم أحدث إصدار (' + this.CURRENT_VERSION + ')', 'success', 3000);
                }
            }

        } catch (e) {
            if (manualCheck) {
                this.stopAnimation(this._activeBtn);
                alert('حدث خطأ أثناء التحقق من التحديثات: ' + e.message);
            }
        } finally {
            // Animation is now primarily handled by the 3s timer in index.html
            // but we stop it early if a notification appears.
            this._updateCheckInProgress = false;
        }
    },

    /**
     * Stop the spin animation on the provided button element
     */
    stopAnimation(btnElement) {
        if (!btnElement) return;
        const icons = btnElement.querySelectorAll('.lucide-spin, .fa-spin, .update-icon, [data-lucide*="refresh"]');
        for (let i = 0; i < icons.length; i++) {
            icons[i].classList.remove('lucide-spin');
            icons[i].classList.remove('fa-spin');
        }
        // Clear the manual timeout from index.html if it exists
        if (btnElement.spinTimeout) {
            clearTimeout(btnElement.spinTimeout);
            btnElement.spinTimeout = null;
        }
    },

    /**
     * Download and Install the update directly
     */
    async downloadAndInstall(url) {
        if (!url) return;

        // Check if we are in an environment that supports file system operations
        if (!fs || !path || !shell) {
            console.warn('UpdateManager: File system access not available. Redirecting to browser.');
            if (confirm('التحديث التلقائي غير مدعوم في المتصفح. هل تريد تحميل التحديث يدوياً؟')) {
                window.open(url, '_blank');
            }
            return;
        }

        // Change UI to Downloading state
        const btn = document.getElementById('btn-update-action');
        const statusText = document.getElementById('update-status-text');
        const progressBar = document.getElementById('update-progress-bar');
        const progressContainer = document.getElementById('update-progress-container');

        if (btn) btn.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'block';
        if (statusText) statusText.textContent = 'جاري تحضير التحميل...';

        try {
            const destPath = path.join(os.tmpdir(), `idara_plus_update_${Date.now()}.exe`);
            const file = fs.createWriteStream(destPath);

            if (statusText) statusText.textContent = 'جاري تنزيل التحديث...';

            // Handle Google Drive or basic direct links
            // If it's a google drive link, we might need to handle the "confirm" warning
            // For now, assume it's a direct link or simple redirect.

            // Use User-Agent to avoid blocking by some sites
            const request = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124' } }, (response) => {
                // Handle Redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    this.downloadAndInstall(response.headers.location);
                    return;
                }

                // Check Content-Type
                const contentType = response.headers['content-type'] || '';

                if (contentType.includes('text/html')) {
                    // It's a web page. Scrape it for direct link.
                    let htmlData = '';
                    response.setEncoding('utf8');
                    response.on('data', chunk => htmlData += chunk);
                    response.on('end', () => {
                        // Close the unused file stream
                        file.close(() => {
                            fs.unlink(destPath, () => { });
                        });

                        // Try specific patterns for Mediafire and generic buttons
                        let match = htmlData.match(/id="downloadButton"[^>]*href="([^"]+)"/); // Mediafire common
                        if (!match) match = htmlData.match(/href="([^"]+)"[^>]*id="downloadButton"/); // Mediafire alt
                        if (!match) match = htmlData.match(/aria-label="Download file"[^>]*href="([^"]+)"/); // Mediafire alt 2
                        if (!match) match = htmlData.match(/href="([^"]+)"[^>]*aria-label="Download file"/); // Mediafire alt 3
                        if (!match) match = htmlData.match(/id="uc-download-link".*?href="([^"]+)"/); // Google Drive warning page

                        if (match && match[1]) {
                            let nextUrl = match[1];
                            if (nextUrl.startsWith('/')) {
                                try {
                                    nextUrl = new URL(nextUrl, url).href;
                                } catch (e) { }
                            }

                            if (statusText) statusText.textContent = 'تم العثور على رابط مباشر، جاري التحميل...';

                            if (nextUrl !== url) {
                                this.downloadAndInstall(nextUrl);
                                return;
                            }
                        }

                        // Fallback
                        if (confirm('لم يتمكن التطبيق من العثور على رابط التحميل المباشر تلقائياً. هل تريد فتح صفحة التحميل في المتصفح؟')) {
                            shell.openExternal(url);
                        }
                        if (btn) btn.style.display = 'block';
                        if (progressContainer) progressContainer.style.display = 'none';
                        if (statusText) statusText.textContent = 'يرجى التحميل من المتصفح...';
                    });
                    return;
                }

                const totalLength = parseInt(response.headers['content-length'], 10);
                let downloaded = 0;

                response.on('data', (chunk) => {
                    downloaded += chunk.length;
                    if (totalLength) {
                        const percent = (downloaded / totalLength) * 100;
                        if (progressBar) progressBar.style.width = `${percent}%`;
                        if (statusText) statusText.textContent = `جاري التنزيل: ${Math.round(percent)}%`;

                        // Update Mini Widget
                        const miniBar = document.getElementById('mini-progress-bar');
                        const miniText = document.getElementById('mini-status-text');
                        if (miniBar) miniBar.style.width = `${percent}%`;
                        if (miniText) miniText.textContent = `${Math.round(percent)}%`;
                    } else {
                        if (statusText) statusText.textContent = `جاري التنزيل... (${(downloaded / 1024 / 1024).toFixed(1)} MB)`;
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close(() => {
                        if (statusText) statusText.textContent = 'جاري تحضير التثبيت...';
                        if (progressBar) progressBar.style.width = '100%';

                        // Remove "Mark of the Web" (Zone.Identifier) to prevent
                        // Windows SmartScreen from blocking the installer
                        try {
                            fs.unlinkSync(destPath + ':Zone.Identifier');
                            console.log('UpdateManager: Zone.Identifier removed successfully.');
                        } catch (zoneErr) {
                            // Not critical - file may not have Zone.Identifier
                            console.log('UpdateManager: Zone.Identifier not found or already removed.');
                        }

                        if (statusText) statusText.textContent = 'جاري بدء التثبيت...';

                        setTimeout(() => {
                            // Try shell.openPath first (better OS integration, avoids SmartScreen issues)
                            // Falls back to spawn if shell is not available
                            if (shell && shell.openPath) {
                                shell.openPath(destPath).then(() => {
                                    // Quit app after launching installer
                                    setTimeout(() => {
                                        try {
                                            const electron = require('electron');
                                            const app = electron.app || (electron.remote && electron.remote.app);
                                            if (app) app.quit();
                                            else window.close();
                                        } catch (e) {
                                            window.close();
                                        }
                                    }, 1500);
                                }).catch(() => {
                                    // Fallback to spawn
                                    this._launchInstallerWithSpawn(destPath);
                                });
                            } else {
                                // Fallback to spawn for older Electron versions
                                this._launchInstallerWithSpawn(destPath);
                            }
                        }, 1000);
                    });
                });
            });

            request.on('error', (err) => {
                fs.unlink(destPath, () => { }); // Delete partial file
                alert('فشل التحميل: ' + err.message);
                if (btn) btn.style.display = 'block';
                if (progressContainer) progressContainer.style.display = 'none';
            });

        } catch (error) {
            console.error(error);
            alert('حدث خطأ غير متوقع: ' + error.message);
            if (btn) btn.style.display = 'block';
            if (progressContainer) progressContainer.style.display = 'none';
        }
    },

    /**
     * Fallback: Launch installer using spawn (for older Electron versions)
     */
    _launchInstallerWithSpawn(destPath) {
        const subprocess = spawn(destPath, [], {
            detached: true,
            stdio: 'ignore'
        });
        subprocess.unref();

        setTimeout(() => {
            try {
                const electron = require('electron');
                const app = electron.app || (electron.remote && electron.remote.app);
                if (app) app.quit();
                else window.close();
            } catch (e) {
                window.close();
            }
        }, 1500);
    },

    toggleMinimize() {
        const modal = document.getElementById('update-modal');
        const miniWidget = document.getElementById('update-mini-widget');

        if (modal && miniWidget) {
            if (modal.style.display !== 'none') {
                modal.style.display = 'none';
                miniWidget.style.display = 'flex';
            } else {
                modal.style.display = 'flex';
                miniWidget.style.display = 'none';
            }
        }
    },

    /**
     * Update Navbar Badge (Red Dot)
     */
    updateNavbarBadge(show) {
        const attempt = (n) => {
            const links = document.querySelectorAll('a[href*="my_account.html"]');
            let found = false;

            links.forEach(link => {
                if (link) {
                    found = true;
                    let badge = link.querySelector('.update-badge');

                    if (show) {
                        if (!badge) {
                            badge = document.createElement('span');
                            badge.className = 'update-badge';
                            badge.textContent = '1';
                            badge.style.cssText = `
                                background: #e74c3c;
                                color: white;
                                font-size: 0.7rem;
                                padding: 2px 6px;
                                border-radius: 50%;
                                margin-right: 5px;
                                vertical-align: middle;
                                animation: pulse 2s infinite;
                            `;
                            if (!document.getElementById('badge-anim-style')) {
                                const s = document.createElement('style');
                                s.id = 'badge-anim-style';
                                s.innerHTML = `@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); } 70% { box-shadow: 0 0 0 5px rgba(231, 76, 60, 0); } 100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); } }`;
                                document.head.appendChild(s);
                            }
                            link.appendChild(badge);
                        }
                    } else {
                        if (badge) badge.remove();
                    }
                }
            });

            if (!found && n > 0) {
                setTimeout(() => attempt(n - 1), 500);
            }
        };

        attempt(5);
    },

    /**
     * Inject Update Card in My Account Page
     */
    injectUpdateCard(data) {
        if (!window.location.pathname.includes('my_account.html')) return;
        const container = document.querySelector('.account-container');
        if (!container) return;
        if (document.getElementById('update-card-inline')) return;

        const cardHtml = `
            <div id="update-card-inline" class="account-card" style="border: 2px solid var(--secondary-color); background: linear-gradient(to left, #fff, #f0f8ff);">
                <div class="card-icon" style="background-color: rgba(52, 152, 219, 0.2); color: #2980b9;">
                    🚀
                </div>
                <div class="card-content">
                    <div class="card-title" style="color: #2980b9;">تحديث جديد متوفر (${data.version})</div>
                    <div class="card-desc">
                        يوجد إصدار جديد يحتوي على تحسينات ومميزات جديدة.
                        <ul style="margin: 5px 0; padding-right: 20px; font-size: 0.85rem;">
                            ${data.changelog ? data.changelog.split(/\r?\n/).slice(0, 2).map(l => `<li>${l}</li>`).join('') : '<li>تحسينات عامة</li>'}
                        </ul>
                    </div>
                </div>
                <div class="card-action">
                    <button onclick="UpdateManager.showUpdateModal(${JSON.stringify(data).replace(/"/g, '&quot;')})" class="btn-action" style="background-color: #27ae60; color: white; border:none; cursor:pointer;">تحديث الآن</button>
                </div>
            </div>
        `;

        const header = container.querySelector('.account-header');
        if (header) {
            header.insertAdjacentHTML('afterend', cardHtml);
        } else {
            container.insertAdjacentHTML('afterbegin', cardHtml);
        }
    },

    /**
     * Compare semantic versions
     */
    compareVersions(v1, v2) {
        v1 = v1.replace(/,/g, '.');
        v2 = v2.replace(/,/g, '.');
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        const len = Math.max(parts1.length, parts2.length);
        for (let i = 0; i < len; i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    },

    /**
     * UI: Display the update modal
     */
    showUpdateModal(data) {
        const existingModal = document.getElementById('update-modal');
        if (existingModal) {
            existingModal.style.display = 'flex';
            const miniWidget = document.getElementById('update-mini-widget');
            if (miniWidget) miniWidget.style.display = 'none';
            // Stop animation even if already displayed
            this.stopAnimation(this._activeBtn);
            return;
        }

        // Stop animation when modal appears
        this.stopAnimation(this._activeBtn);

        // Format changelog items as styled list
        const changelogItems = data.changelog
            ? data.changelog.split(/\r?\n/).filter(l => l.trim()).map(line =>
                `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.04);">
                    <span style="color:#3b82f6;font-size:0.75rem;margin-top:4px;flex-shrink:0;">●</span>
                    <span style="color:#374151;font-size:0.9rem;line-height:1.6;">${line}</span>
                </div>`
            ).join('')
            : '<div style="text-align:center;color:#6b7280;padding:15px 0;">تحسينات عامة وإصلاحات للأخطاء</div>';

        const modalHtml = `
            <div id="update-modal" style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(2, 6, 23, 0.8);
                z-index: 999999; display: flex; justify-content: center; align-items: center;
                backdrop-filter: blur(12px) saturate(180%);
                -webkit-backdrop-filter: blur(12px) saturate(180%);
                animation: um-fadeIn 0.4s ease-out;
            ">
                <div class="um-modal-card" style="
                    background: var(--card-bg);
                    width: 92%; max-width: 460px;
                    border-radius: 24px;
                    box-shadow: 0 25px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
                    overflow: hidden;
                    animation: um-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                ">
                    <!-- Header -->
                    <div style="
                        background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
                        padding: 30px 25px 25px;
                        text-align: center;
                        color: white;
                        position: relative;
                        overflow: hidden;
                    ">
                        <!-- Decorative circles -->
                        <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;border-radius:50%;background:rgba(59,130,246,0.15);"></div>
                        <div style="position:absolute;bottom:-30px;left:-15px;width:80px;height:80px;border-radius:50%;background:rgba(99,102,241,0.1);"></div>
                        <div style="position:absolute;top:50%;left:10px;width:40px;height:40px;border-radius:50%;background:rgba(56,189,248,0.08);"></div>

                        <!-- Minimize button -->
                        <button onclick="UpdateManager.toggleMinimize()" style="
                            position:absolute; top:12px; right:12px;
                            background: rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15);
                            color: rgba(255,255,255,0.7); width:30px; height:30px; border-radius:50%;
                            cursor:pointer; font-size:1rem; font-weight:bold;
                            display:flex; align-items:center; justify-content:center;
                            transition: all 0.2s; backdrop-filter: blur(10px);
                        " onmouseover="this.style.background='rgba(255,255,255,0.2)';this.style.color='#fff'" 
                           onmouseout="this.style.background='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.7)'" 
                           title="تصغير النافذة">−</button>

                        <!-- Icon with glow -->
                        <div style="
                            width:64px; height:64px; margin:0 auto 12px;
                            background: linear-gradient(135deg, #3b82f6, #6366f1);
                            border-radius:18px; display:flex; align-items:center; justify-content:center;
                            font-size:1.8rem; color: white;
                            box-shadow: 0 8px 30px rgba(59,130,246,0.4);
                            animation: um-float 3s ease-in-out infinite;
                        "><i class="fas fa-rocket"></i></div>

                        <h2 style="margin:0 0 6px; font-size:1.4rem; font-weight:800; letter-spacing:-0.3px;">تحديث جديـد متـوفر</h2>
                        
                        <!-- Version badges -->
                        <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:8px; direction:ltr;">
                            <span style="
                                background: rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
                                padding:4px 12px; border-radius:20px; font-size:0.78rem; color:rgba(255,255,255,0.6);
                            ">${this.CURRENT_VERSION}</span>
                            <span style="color:rgba(255,255,255,0.3); font-size:0.9rem;">
                                <i class="fas fa-arrow-right"></i>
                            </span>
                            <span style="
                                background: linear-gradient(135deg, rgba(59,130,246,0.3), rgba(99,102,241,0.3));
                                border:1px solid rgba(59,130,246,0.3);
                                padding:4px 12px; border-radius:20px; font-size:0.78rem; color:#93c5fd; font-weight:700;
                            ">${data.version}</span>
                        </div>
                    </div>

                    <!-- Body -->
                    <div style="padding: 22px 25px 25px;">
                        <!-- Changelog header -->
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                            <span style="font-size:1rem;">✨</span>
                            <span style="font-size:0.95rem; font-weight:700; color:#1e293b;">ما الجديد في هذا التحديث</span>
                        </div>

                        <!-- Changelog content -->
                        <div style="
                            background: #f8fafc;
                            padding: 5px 15px;
                            border-radius: 14px;
                            max-height: 160px;
                            overflow-y: auto;
                            margin-bottom: 20px;
                            border: 1px solid var(--border-color);
                        ">${changelogItems}</div>

                        <!-- Progress Section (Hidden by default) -->
                        <div id="update-progress-container" style="display:none; margin-bottom:18px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                                <span id="update-status-text" style="font-size:0.85rem; color:#475569; font-weight:600;">جاري بدء التحميل...</span>
                            </div>
                            <div style="height:8px; background:var(--border-color); border-radius:10px; overflow:hidden; position:relative;">
                                <div id="update-progress-bar" style="
                                    height:100%; width:0%;
                                    background: linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6);
                                    background-size: 200% 100%;
                                    animation: um-progressShimmer 2s linear infinite;
                                    transition: width 0.3s ease;
                                    border-radius:10px;
                                    box-shadow: 0 0 12px rgba(59,130,246,0.4);
                                "></div>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <button id="btn-update-action" onclick="UpdateManager.downloadAndInstall('${data.downloadUrl}')" style="
                                display:flex; align-items:center; justify-content:center; gap:10px;
                                width:100%; padding:14px 20px;
                                background: linear-gradient(135deg, #3b82f6, #6366f1);
                                color:white; border:none; border-radius:14px;
                                cursor:pointer; font-weight:700; font-size:1.05rem;
                                font-family:inherit;
                                transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
                                box-shadow: 0 4px 20px rgba(59,130,246,0.35);
                                position:relative; overflow:hidden;
                            " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 30px rgba(59,130,246,0.5)'"
                               onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 20px rgba(59,130,246,0.35)'">
                                <span style="font-size:1.1rem;"><i class="fas fa-download"></i></span>
                                تحميل وتثبيت التحديث
                            </button>
                            
                            <button onclick="UpdateManager.closeModal()" style="
                                background:transparent; border:none;
                                color:#94a3b8; padding:10px;
                                cursor:pointer; font-size:0.85rem;
                                font-family:inherit;
                                transition: color 0.2s;
                            " onmouseover="this.style.color='#64748b'" onmouseout="this.style.color='#94a3b8'">
                                ذكرني لاحقاً
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes um-fadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes um-slideUp { from { transform:translateY(40px) scale(0.97); opacity:0; } to { transform:translateY(0) scale(1); opacity:1; } }
                @keyframes um-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
                @keyframes um-progressShimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
                @keyframes um-slideIn { from { transform:translateY(80px) scale(0.95); opacity:0; } to { transform:translateY(0) scale(1); opacity:1; } }
                .um-modal-card { font-family: 'Cairo', 'Tajawal', 'Segoe UI', sans-serif; }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add Mini Widget (floating pill during download)
        const miniWidgetHtml = `
            <div id="update-mini-widget" style="
                display:none; position:fixed; bottom:20px; right:20px;
                background: rgba(15,23,42,0.95);
                backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                border-radius:16px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.08);
                padding:14px 18px;
                z-index:999998;
                align-items:center; gap:14px;
                animation: um-slideIn 0.4s cubic-bezier(0.16,1,0.3,1);
                cursor: pointer;
            " onclick="UpdateManager.toggleMinimize()">
                <div style="
                    width:36px; height:36px;
                    background: linear-gradient(135deg, #3b82f6, #6366f1);
                    border-radius:10px; display:flex; align-items:center; justify-content:center;
                    font-size:1rem; color: white;
                    box-shadow: 0 4px 12px rgba(59,130,246,0.3);
                    flex-shrink:0;
                "><i class="fas fa-rocket"></i></div>
                <div style="min-width:140px;">
                    <div style="font-size:0.8rem; color:var(--border-color); font-weight:700; margin-bottom:6px;">جاري تحديث التطبيق...</div>
                    <div style="height:5px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden;">
                        <div id="mini-progress-bar" style="
                            height:100%; width:0%;
                            background: linear-gradient(90deg, #3b82f6, #6366f1);
                            transition: width 0.3s;
                            border-radius:10px;
                        "></div>
                    </div>
                </div>
                <div id="mini-status-text" style="font-size:0.8rem; color:#93c5fd; font-weight:700; min-width:32px; text-align:center;">0%</div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', miniWidgetHtml);
    },


    closeModal() {
        const el = document.getElementById('update-modal');
        if (el) el.remove();
        // Mark as dismissed for this session so it won't auto-show again
        // Will reset when the app is restarted (new session)
        sessionStorage.setItem('update_dismissed', 'true');
    }
};

// Auto-initialize if desired, or let main script call it
UpdateManager.checkForUpdates();

if (typeof module !== 'undefined') module.exports = UpdateManager;
if (typeof window !== 'undefined') window.UpdateManager = UpdateManager;
