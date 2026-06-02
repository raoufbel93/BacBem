/**
 * Notification Manager - ES5 Compatible (Windows 7 Safe)
 * Fetches notifications from server and displays them in the Navbar bell icon.
 * Works alongside the existing heartbeat system in auth.js.
 */

var NotificationManager = {
    notifications: [],
    unreadCount: 0,
    isOpen: false,
    pollInterval: null,
    CACHE_KEY: 'cachedNotifications',
    READ_KEY: 'readNotificationIds',
    expandedIds: {},

    /**
     * Initialize the notification system.
     * Called from navbar_manager.js after the navbar is rendered.
     */
    init: function () {
        if (window._notifManagerStarted) return;
        window._notifManagerStarted = true;

        var self = this;

        // Load cached notifications first (offline-first)
        this.loadFromCache();
        this.renderBell();

        // Fetch from server immediately, then every 60 seconds
        setTimeout(function () { self.fetchNotifications(); }, 2000);
        this.pollInterval = setInterval(function () { self.fetchNotifications(); }, 60000);

        // Close dropdown when clicking outside
        document.addEventListener('click', function (e) {
            var bell = document.getElementById('notifBellWrapper');
            var dropdown = document.getElementById('notifDropdown');
            if (self.isOpen && bell && !bell.contains(e.target) && dropdown && !dropdown.contains(e.target)) {
                self.closeDropdown();
            }
        });
    },

    /**
     * Fetch unread notifications from server.
     */
    fetchNotifications: function () {
        var self = this;
        var user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
        if (!user || !user.email) return;

        if (typeof Auth !== 'undefined' && Auth.loadStoredPassword) {
            Auth.loadStoredPassword().then(function (pass) {
                if (!pass) return;

                var query = 'action=get_notifications&email=' + encodeURIComponent(user.email) +
                            '&password=' + encodeURIComponent(pass) +
                            '&_t=' + new Date().getTime();

                var apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://idarati.amanidev.com/api/desktop-api';

                var doFetch = function (url, opts) {
                    if (typeof callServer === 'function') {
                        return callServer(url, opts);
                    }
                    return fetch(url, { cache: 'no-store' })
                        .then(function (r) { return r.json(); });
                };

                doFetch(apiUrl + '?' + query)
                    .then(function (json) {
                        if (typeof json === 'string') {
                            try { json = JSON.parse(json); } catch (e) { return; }
                        }
                        if (json.result === 'success' && Array.isArray(json.notifications)) {
                            self.notifications = json.notifications;
                            self.updateUnreadCount();
                            self.saveToCache(json.notifications);
                            self.renderBell();
                        }
                    })
                    .catch(function () {
                        // Silently fail — offline-first, use cached data
                    });
            });
            return;
        }

        var pass = localStorage.getItem('authHash');
        if (!pass) return;

        var query = 'action=get_notifications&email=' + encodeURIComponent(user.email) +
                    '&password=' + encodeURIComponent(pass) +
                    '&_t=' + new Date().getTime();

        var apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://idarati.amanidev.com/api/desktop-api';

        var doFetch = function (url, opts) {
            if (typeof callServer === 'function') {
                return callServer(url, opts);
            }
            return fetch(url, { cache: 'no-store' })
                .then(function (r) { return r.json(); });
        };

        doFetch(apiUrl + '?' + query)
            .then(function (json) {
                if (typeof json === 'string') {
                    try { json = JSON.parse(json); } catch (e) { return; }
                }
                if (json.result === 'success' && Array.isArray(json.notifications)) {
                    self.notifications = json.notifications;
                    self.updateUnreadCount();
                    self.saveToCache(json.notifications);
                    self.renderBell();
                }
            })
            .catch(function () {
                // Silently fail — offline-first, use cached data
            });
    },

    /**
     * Mark specific notifications as read.
     */
    markAsRead: function (ids) {
        var self = this;
        var user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
        if (!user || !user.email || !ids || ids.length === 0) return;

        if (typeof Auth !== 'undefined' && Auth.loadStoredPassword) {
            Auth.loadStoredPassword().then(function (pass) {
                if (!pass) return;

                var readSet = self.getLocalReadIds();
                for (var i = 0; i < ids.length; i++) {
                    readSet[ids[i]] = true;
                }
                localStorage.setItem(self.READ_KEY, JSON.stringify(readSet));

                self.updateUnreadCount();
                self.renderBell();

                var apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://idarati.amanidev.com/api/desktop-api';
                var query = 'action=mark_notifications_read&_t=' + new Date().getTime();

                var doFetch = function (url, opts) {
                    if (typeof callServer === 'function') {
                        return callServer(url, opts);
                    }
                    return fetch(url, opts).then(function (r) { return r.json(); });
                };

                doFetch(apiUrl + '?' + query, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        password: pass,
                        notification_ids: ids
                    })
                }).catch(function () { /* Silent */ });
            });
            return;
        }

        var pass = localStorage.getItem('authHash');
        if (!pass) return;

        // Update locally immediately
        var readSet = this.getLocalReadIds();
        for (var i = 0; i < ids.length; i++) {
            readSet[ids[i]] = true;
        }
        localStorage.setItem(this.READ_KEY, JSON.stringify(readSet));

        self.updateUnreadCount();
        self.renderBell();

        // Send to server
        var apiUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://idarati.amanidev.com/api/desktop-api';
        var query = 'action=mark_notifications_read&_t=' + new Date().getTime();

        var doFetch = function (url, opts) {
            if (typeof callServer === 'function') {
                return callServer(url, opts);
            }
            return fetch(url, opts).then(function (r) { return r.json(); });
        };

        doFetch(apiUrl + '?' + query, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                password: pass,
                notification_ids: ids
            })
        }).catch(function () { /* Silent */ });
    },

    /**
     * Mark all notifications as read.
     */
    markAllAsRead: function () {
        var ids = [];
        var readSet = this.getLocalReadIds();
        for (var i = 0; i < this.notifications.length; i++) {
            if (!readSet[this.notifications[i].id]) {
                ids.push(this.notifications[i].id);
            }
        }
        if (ids.length > 0) {
            this.markAsRead(ids);
        }
    },

    /**
     * Handle item click to toggle expansion and mark read
     */
    handleItemClick: function (id) {
        // Toggle expanded state
        this.expandedIds[id] = !this.expandedIds[id];
        
        // Mark as read if it isn't
        var readSet = this.getLocalReadIds();
        if (!readSet[id]) {
            this.markAsRead([id]);
        } else {
            // Re-render to show expanded state
            this.renderDropdownContent();
        }
    },

    /**
     * Update unread count
     */
    updateUnreadCount: function () {
        var readSet = this.getLocalReadIds();
        var count = 0;
        for (var i = 0; i < this.notifications.length; i++) {
            if (!readSet[this.notifications[i].id]) {
                count++;
            }
        }
        this.unreadCount = count;
    },

    // ============================================================
    // UI Rendering
    // ============================================================

    /**
     * Render (or update) the bell icon badge count.
     */
    renderBell: function () {
        var badge = document.getElementById('notifBadge');
        if (!badge) return;

        if (this.unreadCount > 0) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }

        // Update dropdown if currently open
        if (this.isOpen) {
            this.renderDropdownContent();
        }
    },

    /**
     * Toggle the dropdown.
     */
    toggleDropdown: function () {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    },

    /**
     * Open the notifications dropdown.
     */
    openDropdown: function () {
        this.isOpen = true;
        var dropdown = document.getElementById('notifDropdown');
        if (!dropdown) {
            this.createDropdownElement();
            dropdown = document.getElementById('notifDropdown');
        }
        this.renderDropdownContent();
        dropdown.style.display = 'block';

        // Position relative to bell icon (RTL-aware)
        var bell = document.getElementById('notifBellWrapper');
        if (bell) {
            var rect = bell.getBoundingClientRect();
            var dropdownWidth = 340;
            // Align right edge of dropdown with right edge of bell
            var leftPos = rect.right - dropdownWidth;
            // Ensure it doesn't go off-screen on the left
            if (leftPos < 10) leftPos = 10;
            // Ensure it doesn't go off-screen on the right
            if (leftPos + dropdownWidth > window.innerWidth - 10) {
                leftPos = window.innerWidth - dropdownWidth - 10;
            }
            dropdown.style.top = (rect.bottom + 8) + 'px';
            dropdown.style.left = leftPos + 'px';
        }

        // Animate in
        setTimeout(function () { dropdown.classList.add('notif-dropdown-visible'); }, 10);
    },

    /**
     * Close the dropdown.
     */
    closeDropdown: function () {
        this.isOpen = false;
        var dropdown = document.getElementById('notifDropdown');
        if (dropdown) {
            dropdown.classList.remove('notif-dropdown-visible');
            setTimeout(function () { dropdown.style.display = 'none'; }, 200);
        }
    },

    /**
     * Create the dropdown DOM element (once).
     * Appended to document.body to avoid navbar clipping.
     */
    createDropdownElement: function () {
        var dropdown = document.createElement('div');
        dropdown.id = 'notifDropdown';
        dropdown.className = 'notif-dropdown';
        dropdown.style.display = 'none';
        document.body.appendChild(dropdown);
    },

    /**
     * Render the dropdown content.
     */
    renderDropdownContent: function () {
        var dropdown = document.getElementById('notifDropdown');
        if (!dropdown) return;

        var html = '';

        // Header
        html += '<div class="notif-dropdown-header">';
        html += '<span class="notif-dropdown-title">الإشعارات</span>';
        if (this.unreadCount > 0) {
            html += '<button class="notif-mark-all" onclick="NotificationManager.markAllAsRead()">قراءة الكل</button>';
        }
        html += '</div>';

        // Body
        if (this.notifications.length === 0) {
            html += '<div class="notif-empty">';
            html += '<div class="notif-empty-icon">🔔</div>';
            html += '<div class="notif-empty-text">لا توجد إشعارات جديدة</div>';
            html += '</div>';
        } else {
            var readSet = this.getLocalReadIds();
            
            // Sort notifications: unread first, then by date desc
            var sortedNotifs = this.notifications.slice().sort(function(a, b) {
                var aRead = !!readSet[a.id];
                var bRead = !!readSet[b.id];
                if (aRead !== bRead) return aRead ? 1 : -1;
                return new Date(b.created_at) - new Date(a.created_at);
            });

            html += '<div class="notif-list">';
            for (var i = 0; i < sortedNotifs.length; i++) {
                var n = sortedNotifs[i];
                var typeIcon = this.getTypeIcon(n.type);
                var timeAgo = this.timeAgo(n.created_at);
                var isRead = !!readSet[n.id];
                var isExpanded = !!this.expandedIds[n.id];
                
                var itemClass = 'notif-item notif-type-' + (n.type || 'info');
                if (isRead) itemClass += ' is-read';
                if (isExpanded) itemClass += ' is-expanded';

                html += '<div class="' + itemClass + '" onclick="NotificationManager.handleItemClick(' + n.id + ')">';
                html += '<div class="notif-item-icon">' + typeIcon + '</div>';
                html += '<div class="notif-item-content">';
                html += '<div class="notif-item-title">' + this.escapeHtml(n.title);
                if (!isRead) html += '<span class="notif-item-dot"></span>';
                html += '</div>';
                html += '<div class="notif-item-body">' + this.escapeHtml(n.body) + '</div>';
                html += '<div class="notif-item-time">' + timeAgo + '</div>';
                html += '</div>';
                html += '</div>';
            }
            html += '</div>';
        }

        dropdown.innerHTML = html;
    },

    // ============================================================
    // Helpers
    // ============================================================

    getTypeIcon: function (type) {
        var icons = {
            'info': 'ℹ️',
            'warning': '⚠️',
            'update': '🚀',
            'promotion': '🎁'
        };
        return icons[type] || '🔔';
    },

    timeAgo: function (dateStr) {
        if (!dateStr) return '';
        var date = new Date(dateStr);
        var now = new Date();
        var diff = Math.floor((now - date) / 1000); // seconds

        if (diff < 60) return 'الآن';
        if (diff < 3600) return Math.floor(diff / 60) + ' دقيقة';
        if (diff < 86400) return Math.floor(diff / 3600) + ' ساعة';
        if (diff < 604800) return Math.floor(diff / 86400) + ' يوم';
        return date.toLocaleDateString('ar-DZ');
    },

    escapeHtml: function (str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    },

    // ============================================================
    // Local Cache (Offline-First)
    // ============================================================

    saveToCache: function (notifications) {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(notifications));
        } catch (e) { /* quota exceeded */ }
    },

    loadFromCache: function () {
        try {
            var cached = localStorage.getItem(this.CACHE_KEY);
            if (cached) {
                var parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    this.notifications = parsed;
                    this.updateUnreadCount();
                }
            }
        } catch (e) { /* corrupted cache */ }
    },

    getLocalReadIds: function () {
        try {
            var raw = localStorage.getItem(this.READ_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }
};

// Expose globally
window.NotificationManager = NotificationManager;
