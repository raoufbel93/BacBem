/**
 * Navbar Manager - Shell Compatible (Windows 7 Safe)
 * Centralizes the navigation bar using React components.
 * Optimized for persistent shell navigation via Iframe.
 */

// Detect if running in shell (top level) or sub-page (iframe)
var isInIframe = (function () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
})();

// Helper to check for Shell mode
var isShellMode = (function () {
    var inShell = (window.self !== window.top) || window.IS_SHELL === true;
    if (inShell) {
        // Add class to body for CSS overrides - IMMEDIATELY if possible, or on DOMContentLoaded
        if (document.body) {
            document.body.className += ' shell-mode';
        } else {
            document.addEventListener('DOMContentLoaded', function () {
                document.body.className += ' shell-mode';
            });
        }
    }
    return inShell;
})();

var NAVBAR_MANAGER_SCRIPT_BASE = (function () {
    var src = '';
    var currentScript = document.currentScript;

    if (currentScript && currentScript.src) {
        src = currentScript.src;
    }

    if (!src) {
        var scripts = document.getElementsByTagName('script');
        for (var i = scripts.length - 1; i >= 0; i--) {
            var candidate = scripts[i].getAttribute('src') || '';
            if (candidate.indexOf('navbar_manager.js') !== -1) {
                src = scripts[i].src || candidate;
                break;
            }
        }
    }

    return src ? src.substring(0, src.lastIndexOf('/') + 1) : '';
})();

function resolveNavbarAssetPath(fileName, fallbackPrefix) {
    if (NAVBAR_MANAGER_SCRIPT_BASE) {
        return NAVBAR_MANAGER_SCRIPT_BASE + fileName;
    }

    return (fallbackPrefix || '') + 'assets/js/' + fileName;
}

// Menu items data
var NAVBAR_MENU_ITEMS = [
    {
        text: 'الرئيسية',
        icon: 'home',
        color: '#34495e',
        href: 'index.html',
        isRootLink: true
    },
    {
        text: 'التلاميذ',
        icon: 'users',
        color: 'var(--secondary-color)',
        dropdown: [
            { text: 'استيراد التلاميذ', icon: 'import', color: '#2ecc71', href: 'students/import_students.html' },
            { text: 'قائمة التلاميذ', icon: 'list', color: 'var(--secondary-color)', href: 'students/student_list.html' },
            { text: 'المعيدون', icon: 'refresh', color: '#e67e22', href: 'students/reports/repeaters.html' },
            { text: 'قوائم التقويم', icon: 'schedule', color: '#9b59b6', href: 'students/reports/assessment_lists.html' },
            { text: 'الأفواج', icon: 'school', color: '#f1c40f', href: 'students/classes.html' },
            { text: 'التعداد', icon: 'chart', color: '#34495e', href: 'students/reports/census.html' },
            { text: 'تحضير الدخول', icon: 'calendar', color: '#1abc9c', href: 'students/school_entry.html' },
            { text: 'إحصائيات الأعمار', icon: 'chart', color: '#e74c3c', href: 'students/reports/age_statistics.html' },
            { text: 'الكشف الشهري', icon: 'chart', color: '#95a5a6', href: 'students/reports/monthly_report.html' },
            { text: 'الشهادات التقديرية', icon: 'certificate', color: '#f39c12', href: 'students/reports/certificates.html' },
            { text: 'بطاقات التلاميذ', icon: 'credit-card', color: '#8b5cf6', href: 'students/student_cards.html' }
        ]
    },
    {
        text: 'الغيابات',
        icon: 'notice1',
        color: '#e74c3c',
        dropdown: [
            { text: 'متابعة الغيابات', icon: 'notice2', color: '#e67e22', href: 'absences/absence_tracking.html' },
            { text: 'إحصائيات الغياب', icon: 'chart', color: 'var(--secondary-color)', href: 'absences/reports/absence_stats.html' },
            { text: 'إحصائيات غياب الاساتذة والمشرفين', icon: 'chart', color: '#8e44ad', href: 'absences/reports/teacher_absence_stats.html' },
            { text: 'المراسلات والشطب', icon: 'excuse', color: '#c0392b', href: 'absences/correspondence.html' }
        ]
    },
    {
        text: 'المستخدمين',
        icon: 'teacher',
        color: '#27ae60',
        dropdown: [
            { text: 'استيراد البيانات', icon: 'import', color: '#2ecc71', href: 'staff/import_teachers.html' },
            { text: 'قائمة الأساتذة', icon: 'teacher', color: 'var(--secondary-color)', href: 'staff/teachers.html' },
            { text: 'المشرفين/الإداريين', icon: 'user', color: '#e74c3c', href: 'staff/supervisors.html' },
            { text: 'العمال', icon: 'settings', color: '#16a085', href: 'staff/workers.html' },
            { text: 'الوثائق الإدارية', icon: 'edit', color: '#8b5cf6', href: 'staff/management/documents.html' },
            { text: 'الإسناد', icon: 'settings', color: '#f39c12', href: 'staff/management/assignment.html' },
            { text: 'متابعة دفاتر النصوص', icon: 'book', color: '#e74c3c', href: 'staff/management/text_notebooks.html' },
            { text: 'استيراد FET', icon: 'import', color: '#2ecc71', href: 'staff/import_fet.html' }
        ]
    },
    {
        text: 'الاختبارات',
        icon: 'schedule',
        color: '#9b59b6',
        dropdown: [
            { text: 'جدول الحراسة', icon: 'schedule', color: '#e67e22', href: 'exams/supervision.html' },
            { text: 'قوائم الحراسة', icon: 'list', color: '#9b59b6', href: 'exams/supervision_lists.html' },
            { text: 'قوائم الاختبار', icon: 'list', color: 'var(--secondary-color)', href: 'exams/exam_lists.html' },
            { 
                text: 'الامتحانات الرسمية', 
                icon: 'certificate', 
                color: '#c0392b',
                isSubmenu: true,
                dropdown: [
                    { text: 'بيانات المركز', icon: 'building', color: '#2980b9', href: 'exams/official_center_data.html' },
                    { text: 'أعضاء المركز', icon: 'users-round', color: '#16a34a', href: 'exams/official_center_members.html' },
                    { text: 'الحراسة', icon: 'schedule', color: '#e67e22', href: 'exams/official_supervision.html' },
                    { text: 'قوائم الحراسة', icon: 'list', color: '#9b59b6', href: 'exams/official_supervision_lists.html' },
                    { text: 'بطاقات الحراس', icon: 'id-card', color: '#0ea5e9', href: 'exams/official_staff_cards.html' },
                    { text: 'شهادات التقدير', icon: 'award', color: '#f59e0b', href: 'exams/official_appreciation_certificates.html' }
                ]
            }
        ]
    },
    {
        text: 'تحليل النتائج',
        icon: 'chart',
        color: '#e67e22',
        dropdown: [
            { text: 'استيراد النتائج الفصلية', icon: 'import', color: '#2ecc71', href: 'analysis/import_data.html' },
            { text: 'التقويم/الفرض/الاختبار', icon: 'list', color: '#8e44ad', href: 'analysis/activity_evaluation.html' },
            { text: 'نتائج الأقسام', icon: 'chart', color: 'var(--secondary-color)', href: 'analysis/class_analysis.html' },
            { text: 'مجالس الأقسام', icon: 'users', color: '#8e44ad', href: 'analysis/reports/class_councils.html' },
            { text: 'نتائج المستويات', icon: 'level', color: '#9b59b6', href: 'analysis/level_analysis.html' },
            { text: 'نتائج المؤسسة', icon: 'school', color: '#34495e', href: 'analysis/institution_analysis.html' },
            { text: 'نتائج المعيدين', icon: 'refresh', color: '#e67e22', href: 'analysis/reports/repeaters_analysis.html' },
            { text: 'تطور المستوى', icon: 'chart', color: '#1abc9c', href: 'analysis/reports/evolution_analysis.html' },
            { text: 'التحليل حسب المادة', icon: 'list', color: '#f1c40f', href: 'analysis/reports/subject_analysis.html' },
            { text: 'الفئة المستهدفة', icon: 'target', color: '#e74c3c', href: 'analysis/reports/target_group.html' },
            {
                text: 'الاستدراك',
                icon: 'list',
                color: '#95a5a6',
                isSubmenu: true,
                dropdown: [
                    { text: 'قوائم الاستدراك', icon: 'list', color: '#95a5a6', href: 'analysis/reports/remedial_analysis.html' },
                    { text: 'قاعات الاستدراك', icon: 'table', color: '#2563eb', href: 'analysis/reports/remedial_room_lists.html' },
                    { text: 'ترميز الاستدراك', icon: 'shield', color: '#7c3aed', href: 'analysis/reports/remedial_coding.html' }
                ]
            },
            { text: 'نتائج الشهادة', icon: 'level', color: '#f39c12', href: 'analysis/reports/bem_analysis.html' },
            { text: 'النتائج النهائية', icon: 'list', color: 'var(--primary-color)', href: 'analysis/reports/final_results.html' }
        ]
    },
    {
        text: 'الإعدادات',
        icon: 'settings',
        color: '#7f8c8d',
        dropdown: [
            { text: 'إعدادات عامة', icon: 'settings', color: '#7f8c8d', href: 'settings/settings.html' },
            { text: 'إدارة البيانات', icon: 'save', color: '#2ecc71', href: 'settings/data_management.html' },
            { text: 'إعدادات التوقيع', icon: 'edit', color: '#e67e22', href: 'settings/signature_settings.html' },
            { text: 'اقتراحات وتبليغ', icon: 'message-circle', color: 'var(--secondary-color)', href: 'settings/feedback.html' },
            { text: 'حول التطبيق', icon: 'info', color: '#34495e', action: 'openAboutModal', href: '#' }
        ]
    },
    {
        text: 'حسابي',
        icon: 'user',
        color: 'var(--primary-color)',
        dropdown: [
            { text: 'بيانات الاشتراك', icon: 'info', color: '#f1c40f', href: 'settings/subscription.html' },
            { text: 'تسجيل الخروج', icon: 'logout', color: '#c0392b', action: 'logout' }
        ]
    }
];

(function injectThemePresetMenu() {
    var settingsMenu = null;
    var i;

    for (i = 0; i < NAVBAR_MENU_ITEMS.length; i++) {
        if (NAVBAR_MENU_ITEMS[i] && NAVBAR_MENU_ITEMS[i].icon === 'settings' && NAVBAR_MENU_ITEMS[i].dropdown) {
            settingsMenu = NAVBAR_MENU_ITEMS[i];
            break;
        }
    }

    if (!settingsMenu || !settingsMenu.dropdown) return;

    for (i = 0; i < settingsMenu.dropdown.length; i++) {
        if (settingsMenu.dropdown[i] && settingsMenu.dropdown[i].isSubmenu && settingsMenu.dropdown[i].themeMenu === true) {
            return;
        }
    }

    settingsMenu.dropdown.splice(1, 0, {
        text: 'الثيمات',
        icon: 'palette',
        color: '#8b5cf6',
        isSubmenu: true,
        themeMenu: true,
        dropdown: [
            { text: 'الافتراضي', icon: 'check', color: '#2563eb', href: '#', themePreset: 'default' },
            { text: 'أزرق', icon: 'palette', color: '#2563eb', href: '#', themePreset: 'blue' },
            { text: 'سماوي (رقمنة)', icon: 'droplets', color: '#3188c7', href: '#', themePreset: 'azure' },
            { text: 'زمردي', icon: 'leaf', color: '#059669', href: '#', themePreset: 'emerald' },
            { text: 'غروب', icon: 'sunrise', color: '#ea580c', href: '#', themePreset: 'sunset' },
            { text: 'وردي', icon: 'sparkles', color: '#e11d48', href: '#', themePreset: 'rose' }
        ]
    });
})();

// Helper functions for pathing
function checkIsRootPage() {
    var path = window.location.pathname;
    return (path.endsWith('index.html') && path.indexOf('A-data') === -1) ||
        path.endsWith('/') ||
        path.endsWith('analyse/index.html') ||
        window.IS_ROOT_PAGE === true;
}

function normalizeNavPath(path) {
    if (!path) return '';
    var normalized = String(path).replace(/\\/g, '/');

    if (normalized.indexOf('#') !== -1) {
        normalized = normalized.split('#')[0];
    }

    if (normalized.indexOf('?') !== -1) {
        normalized = normalized.split('?')[0];
    }

    if (normalized.indexOf('file:///') === 0) {
        normalized = normalized.substring(8);
    }

    var aDataIndex = normalized.lastIndexOf('/A-data/');
    if (aDataIndex !== -1) {
        normalized = normalized.substring(aDataIndex + 8);
    } else {
        var relativeADataIndex = normalized.indexOf('A-data/');
        if (relativeADataIndex !== -1) {
            normalized = normalized.substring(relativeADataIndex + 7);
        }
    }

    while (normalized.indexOf('../') === 0) {
        normalized = normalized.substring(3);
    }

    while (normalized.indexOf('./') === 0) {
        normalized = normalized.substring(2);
    }

    if (normalized.charAt(0) === '/') {
        normalized = normalized.substring(1);
    }

    if (!normalized || normalized === 'index.html') return 'dashboard.html';
    return normalized;
}

function getCurrentPage() {
    try {
        var shellPath = '';

        if (window.IS_ROOT_PAGE === true && window.__SHELL_ACTIVE_PATH) {
            shellPath = window.__SHELL_ACTIVE_PATH;
        } else if (window.top && window.top !== window && window.top.__SHELL_ACTIVE_PATH) {
            shellPath = window.top.__SHELL_ACTIVE_PATH;
        }

        if (!shellPath) {
            try {
                shellPath = localStorage.getItem('shellActivePath') || '';
            } catch (storageError) { }
        }

        if (shellPath) {
            return normalizeNavPath(shellPath);
        }
    } catch (e) { }

    return normalizeNavPath(window.location.pathname);
}

function isActiveLink(href) {
    if (!href || href === '#' || href === 'javascript:void(0)') return false;
    var current = getCurrentPage();
    var target = normalizeNavPath(href);

    if (target === 'index.html') target = 'dashboard.html';
    if (target === 'dashboard.html') {
        return current === 'dashboard.html' || current === 'index.html';
    }

    return current === target;
}

function getCurrentThemePreset() {
    try {
        if (window.ThemeManager && typeof window.ThemeManager.getCurrentPreset === 'function') {
            return window.ThemeManager.getCurrentPreset();
        }
    } catch (e) { }

    try {
        return localStorage.getItem('themePreset') || 'default';
    } catch (storageError) { }

    return 'default';
}

function isActiveThemePreset(preset) {
    return getCurrentThemePreset() === preset;
}

// Global actions for navbar
window.logout = function () {
    if (typeof Auth !== 'undefined' && Auth.logout) {
        Auth.logout();
    } else {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authTime');
        window.location.href = checkIsRootPage() ? 'A-data/login.html' : 'login.html';
    }
};

// Intercept click for shell navigation
function navigateTo(e, path) {
    if (isShellMode) {
        e.preventDefault();
        // If the path is index.html, we actually want to go to dashboard.html inside the shell
        var finalPath = path;
        if (path.indexOf('index.html') !== -1 && path.indexOf('A-data') === -1) {
            finalPath = (path.indexOf('A-data') !== -1) ? 'dashboard.html' : 'A-data/dashboard.html';
        }

        if (window.shellNavigate) {
            window.shellNavigate(finalPath);
        } else if (window.top && window.top.shellNavigate) {
            window.top.shellNavigate(finalPath);
        } else {
            window.location.href = path;
        }
    }
}

// React Components

function renderIcon(iconName, color) {
    if (!iconName) return null;
    var lucideMap = {
        'home': 'home', 'users': 'users', 'import': 'import', 'list': 'list', 'refresh': 'refresh-cw',
        'schedule': 'calendar-days', 'school': 'school', 'chart': 'bar-chart-2', 'calendar': 'calendar',
        'certificate': 'award', 'notice1': 'bell', 'notice2': 'file-text', 'excuse': 'mail-warning',
        'teacher': 'briefcase', 'user': 'user', 'settings': 'settings', 'edit': 'edit', 'book': 'book',
        'level': 'layers', 'target': 'target', 'save': 'save', 'message-circle': 'message-circle',
        'info': 'info', 'logout': 'log-out', 'clock': 'clock', 'credit-card': 'credit-card',
        'palette': 'palette', 'check': 'check', 'leaf': 'leaf', 'sunrise': 'sunrise', 'sparkles': 'sparkles'
    };
    var targetIcon = lucideMap[iconName] || iconName;
    return React.createElement('i', {
        className: 'nav-item-icon me-2',
        'data-lucide': targetIcon,
        style: { display: 'inline-flex', verticalAlign: 'middle', width: '20px', justifyContent: 'center', color: color || 'inherit' }
    });
}

function DropdownItem(props) {
    var href = props.href;
    var text = props.text;
    var icon = props.icon;
    var color = props.color;
    var action = props.action;
    var themePreset = props.themePreset;
    var isActive = props.isActive || (themePreset ? isActiveThemePreset(themePreset) : false);
    var basePath = props.basePath;
    var fullHref = (action || themePreset) ? '#' : (basePath + href);
    var className = isActive ? 'active' : '';

    var clickHandler = function (e) {
        if (themePreset) {
            e.preventDefault();
            if (window.ThemeManager && typeof window.ThemeManager.setPreset === 'function') {
                window.ThemeManager.setPreset(themePreset);
            } else {
                try {
                    localStorage.setItem('themePreset', themePreset);
                } catch (storageError) { }
            }
        } else if (action) {
            e.preventDefault();
            if (typeof window[action] === 'function') window[action]();
        } else {
            navigateTo(e, fullHref);
        }
    };

    return React.createElement('a', { href: fullHref, className: className, onClick: clickHandler },
        renderIcon(icon, color), text);
}

function SingleMenuItem(props) {
    var item = props.item;
    var basePath = props.basePath;
    var rootPath = props.rootPath;
    var href = item.isRootLink ? (rootPath + item.href) : (item.action ? '#' : (basePath + item.href));
    var isActive = isActiveLink(item.href);
    var className = isActive ? 'active' : '';

    var clickHandler = function (e) {
        if (item.action) {
            e.preventDefault();
            if (typeof window[item.action] === 'function') window[item.action]();
        } else {
            navigateTo(e, href);
        }
    };

    return React.createElement('li', { key: item.text },
        React.createElement('a', { href: href, className: className, onClick: clickHandler },
            renderIcon(item.icon, item.color), item.text)
    );
}

function NestedDropdownMenuItem(props) {
    var item = props.item;
    var basePath = props.basePath;
    var isChildActive = false;
    for (var i = 0; i < item.dropdown.length; i++) {
        if ((item.dropdown[i].themePreset && isActiveThemePreset(item.dropdown[i].themePreset)) || isActiveLink(item.dropdown[i].href)) {
            isChildActive = true;
            break;
        }
    }
    
    var parentClass = 'dropdown-submenu-toggle' + (isChildActive ? ' active' : '');
    var dropdownItems = [];
    for (var j = 0; j < item.dropdown.length; j++) {
        var subItem = item.dropdown[j];
        dropdownItems.push(React.createElement(DropdownItem, {
            key: subItem.text, href: subItem.href, text: subItem.text, icon: subItem.icon,
            color: subItem.color, action: subItem.action, themePreset: subItem.themePreset,
            isActive: subItem.themePreset ? isActiveThemePreset(subItem.themePreset) : isActiveLink(subItem.href), basePath: basePath
        }));
    }
    
    var chevronIcon = React.createElement('i', { 
        'data-lucide': 'chevron-left', 
        style: { width: '16px', height: '16px', marginRight: 'auto', marginLeft: '0', opacity: 0.7 } 
    });

    return React.createElement('div', { className: 'dropdown-submenu', key: item.text },
        React.createElement('a', { href: 'javascript:void(0)', className: parentClass, style: { display: 'flex', alignItems: 'center', width: '100%' } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, 
                renderIcon(item.icon, item.color), 
                React.createElement('span', null, item.text)
            ),
            chevronIcon
        ),
        React.createElement('div', { className: 'dropdown-submenu-content' }, dropdownItems)
    );
}

function DropdownMenuItem(props) {
    var item = props.item;
    var basePath = props.basePath;
    var isChildActive = false;
    
    function checkActive(menuItem) {
        if (menuItem.themeMenu === true) {
            return false;
        }
        if (menuItem.themePreset) {
            return false;
        }
        if (menuItem.dropdown) {
            for (var k = 0; k < menuItem.dropdown.length; k++) {
                if (checkActive(menuItem.dropdown[k])) return true;
            }
            return false;
        }
        return isActiveLink(menuItem.href);
    }
    
    isChildActive = checkActive(item);

    var parentClass = 'dropbtn' + (isChildActive ? ' active' : '');
    var dropdownItems = [];
    for (var j = 0; j < item.dropdown.length; j++) {
        var subItem = item.dropdown[j];
        if (subItem.isSubmenu) {
            dropdownItems.push(React.createElement(NestedDropdownMenuItem, {
                key: subItem.text, item: subItem, basePath: basePath
            }));
        } else {
            dropdownItems.push(React.createElement(DropdownItem, {
                key: subItem.text, href: subItem.href, text: subItem.text, icon: subItem.icon,
                color: subItem.color, action: subItem.action, themePreset: subItem.themePreset,
                isActive: subItem.themePreset ? isActiveThemePreset(subItem.themePreset) : isActiveLink(subItem.href), basePath: basePath
            }));
        }
    }
    return React.createElement('li', { className: 'dropdown', key: item.text },
        React.createElement('a', { href: 'javascript:void(0)', className: parentClass },
            renderIcon(item.icon, item.color), item.text),
        React.createElement('div', { className: 'dropdown-content' }, dropdownItems)
    );
}

function NavbarComponent(props) {
    var isRoot = props.isRoot;
    var basePath = isRoot ? 'A-data/' : '';
    var rootPath = isRoot ? '' : '../';
    
    // Notification Bell Element
    var bellElement = React.createElement('div', {
        id: 'notifBellWrapper',
        className: 'notif-bell-wrapper',
        style: { position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', marginLeft: '8px' },
        onClick: function () {
            if (window.NotificationManager) window.NotificationManager.toggleDropdown();
        }
    },
        React.createElement('i', {
            'data-lucide': 'bell',
            className: 'notif-bell-icon',
            style: { width: '24px', height: '24px', color: '#ffffff', opacity: '0.8', transition: 'all 0.2s' }
        }),
        React.createElement('span', {
            id: 'notifBadge',
            className: 'notif-badge',
            style: { display: 'none' }
        }, '0')
    );

    var themeToggleElement = React.createElement('button', {
        id: 'navbar-theme-toggle',
        type: 'button',
        className: 'theme-toggle-nav',
        title: '\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u062f\u0627\u0643\u0646'
    },
        React.createElement('span', { className: 'theme-toggle-icon-wrap' },
            React.createElement('i', {
                id: 'navbar-theme-toggle-icon',
                className: 'theme-toggle-icon',
                'data-lucide': 'moon'
            })
        ),
        React.createElement('span', {
            id: 'navbar-theme-toggle-label',
            className: 'theme-toggle-label'
        }, '\u062f\u0627\u0643\u0646')
    );

    var mainLinks = [];
    var accountElement = null;

    for (var i = 0; i < NAVBAR_MENU_ITEMS.length; i++) {
        var item = NAVBAR_MENU_ITEMS[i];
        var el = item.dropdown ?
            React.createElement(DropdownMenuItem, { key: item.text, item: item, basePath: basePath }) :
            React.createElement(SingleMenuItem, { key: item.text, item: item, basePath: basePath, rootPath: rootPath });

        if (item.text === 'حسابي') {
            accountElement = el;
        } else {
            mainLinks.push(el);
            // Move Theme Toggle after "Settings" (الإعدادات)
            if (item.text === 'الإعدادات') {
                mainLinks.push(React.createElement('li', { key: 'theme-toggle-li', className: 'navbar-theme-toggle-li' }, themeToggleElement));
            }
        }
    }

    return React.createElement('nav', { className: 'navbar no-print' },
        React.createElement('div', { className: 'navbar-container-inner' },
            React.createElement('div', { className: 'navbar-brand', style: { display: 'flex', alignItems: 'center', gap: '4px' } },
                React.createElement('i', {
                    'data-lucide': 'graduation-cap',
                    style: { color: '#ffffff', filter: 'drop-shadow(0 0 5px rgba(59, 130, 246, 0.5))' }
                }),
                React.createElement('span', { className: 'ms-2', style: { color: '#ffffff', fontWeight: 'bold' } }, 'إدارتي'),
                React.createElement('div', { className: 'navbar-brand-actions' },
                    bellElement
                )
            ),
            React.createElement('ul', { className: 'nav-links' }, mainLinks),
            React.createElement('div', { className: 'navbar-account' },
                accountElement ? React.createElement('ul', { className: 'nav-links account-links' }, accountElement) : null
            )
        )
    );
}

var NavbarManager = {
    isRoot: false,
    basePath: '',
    rootPath: '',
    init: function () {
        this.isRoot = checkIsRootPage();
        if (window.IS_ROOT_PAGE === true) this.isRoot = true;
        if (window.IS_SUB_PAGE === true) this.isRoot = false;
        this.basePath = this.isRoot ? 'A-data/' : '';
        this.rootPath = this.isRoot ? '' : '../';

        // Load Lucide immediately as it's often needed by sub-pages (via IconManager)
        this.ensureLucide();

        if (isInIframe && isShellMode) {
            var container = document.getElementById('navbar-container');
            if (container) container.style.display = 'none';
            document.body.style.paddingTop = '0px';
            return;
        }
    },
    render: function () {
        if (isInIframe && isShellMode) return;
        var container = document.getElementById('navbar-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'navbar-container';
            document.body.insertBefore(container, document.body.firstChild);
        }
        if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
            var self = this;
            ReactDOM.render(React.createElement(NavbarComponent, { isRoot: this.isRoot }), container, function () {
                self.ensureLucide(function () { if (typeof lucide !== 'undefined') lucide.createIcons(); });
            });
        }
    },
    ensureLucide: function (callback) {
        if (typeof lucide !== 'undefined') { if (callback) callback(); return; }
        var scriptPath = resolveNavbarAssetPath('lucide.min.js', this.basePath);
        var script = document.createElement('script');
        script.src = scriptPath;
        script.onload = function () {
            document.dispatchEvent(new CustomEvent('lucide-loaded'));
            if (callback) callback();
        };
        document.head.appendChild(script);
    },
    loadUpdateManager: function () {
        if (isInIframe && isShellMode) return;
        var scriptPath = resolveNavbarAssetPath('update_manager.js', this.basePath);
        if (!document.querySelector('script[src*="update_manager.js"]')) {
            var script = document.createElement('script');
            script.src = scriptPath;
            script.onload = function () { /* UpdateManager now auto-initializes upon script load */ };
            document.body.appendChild(script);
        }
    },
    loadNotificationManager: function () {
        var scriptPath = resolveNavbarAssetPath('notification_manager.js', this.basePath);
        if (!document.querySelector('script[src*="notification_manager.js"]')) {
            var script = document.createElement('script');
            script.src = scriptPath;
            script.onload = function () {
                if (window.NotificationManager) window.NotificationManager.init();
            };
            document.body.appendChild(script);
        }
    },
    loadNavbarFix: function () {
        var scriptPath = resolveNavbarAssetPath('navbar_fix.js', this.basePath);
        if (!document.querySelector('script[src*="navbar_fix.js"]')) {
            var script = document.createElement('script');
            script.src = scriptPath;
            document.body.appendChild(script);
        }
    },
    loadThemeManager: function () {
        var self = this;

        function initThemeManager() {
            if (window.ThemeManager && typeof window.ThemeManager.init === 'function') {
                window.ThemeManager.init();
            }
        }

        var themeScriptPath = resolveNavbarAssetPath('theme_manager.js', self.basePath);
        if (!document.querySelector('script[src*="theme_manager.js"]')) {
            var themeScript = document.createElement('script');
            themeScript.src = themeScriptPath;
            themeScript.onload = initThemeManager;
            document.body.appendChild(themeScript);
            return;
        }

        initThemeManager();
    }
};

document.addEventListener('DOMContentLoaded', function () {
    NavbarManager.init();
    NavbarManager.render();
    NavbarManager.loadNavbarFix();
    NavbarManager.loadThemeManager();
    NavbarManager.loadUpdateManager();
    NavbarManager.loadNotificationManager();
});
