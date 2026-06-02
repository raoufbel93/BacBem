(function (window, document) {
    'use strict';

    var STORAGE_KEY = 'theme';
    var PRESET_STORAGE_KEY = 'themePreset';
    var TOGGLE_SELECTOR = '#navbar-theme-toggle';
    var META_ID = 'theme-manager-meta';
    var DEFAULT_PRESET = 'default';
    var initialized = false;
    var PRESET_META = {
        'default': {
            label: '\u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a',
            lightColor: '#f3f7fb',
            darkColor: '#020617'
        },
        azure: {
            label: '\u0633\u0645\u0627\u0648\u064a',
            lightColor: '#e8f4fb',
            darkColor: '#0d3757'
        },
        emerald: {
            label: '\u0632\u0645\u0631\u062f\u064a',
            lightColor: '#ecfdf5',
            darkColor: '#022c22'
        },
        sunset: {
            label: '\u063a\u0631\u0648\u0628',
            lightColor: '#fff7ed',
            darkColor: '#431407'
        },
        rose: {
            label: '\u0648\u0631\u062f\u064a',
            lightColor: '#fff1f2',
            darkColor: '#4c0519'
        },
        blue: {
            label: '\u0623\u0632\u0631\u0642',
            lightColor: '#dbeafe',
            darkColor: '#172554'
        }
    };

    function safeGetStorage(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function safeSetStorage(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {}
    }

    function normalizeTheme(theme) {
        return theme === 'dark' ? 'dark' : 'light';
    }

    function normalizePreset(preset) {
        return PRESET_META[preset] ? preset : DEFAULT_PRESET;
    }

    function getStoredTheme() {
        return normalizeTheme(safeGetStorage(STORAGE_KEY));
    }

    function getStoredPreset() {
        return normalizePreset(safeGetStorage(PRESET_STORAGE_KEY));
    }

    function getCurrentTheme() {
        var docTheme = document.documentElement.getAttribute('data-theme');
        var bodyTheme = document.body ? document.body.getAttribute('data-theme') : null;
        return normalizeTheme(docTheme || bodyTheme || getStoredTheme());
    }

    function getCurrentPreset() {
        var docPreset = document.documentElement.getAttribute('data-theme-preset');
        var bodyPreset = document.body ? document.body.getAttribute('data-theme-preset') : null;
        return normalizePreset(docPreset || bodyPreset || getStoredPreset());
    }

    function getCurrentState() {
        return {
            theme: getCurrentTheme(),
            preset: getCurrentPreset()
        };
    }

    function ensureMetaThemeColor() {
        var meta = document.getElementById(META_ID);
        if (meta) {
            return meta;
        }

        meta = document.createElement('meta');
        meta.id = META_ID;
        meta.name = 'theme-color';
        document.head.appendChild(meta);
        return meta;
    }

    function syncColorScheme(theme, preset) {
        var normalized = normalizeTheme(theme);
        var normalizedPreset = normalizePreset(preset);
        var presetMeta = PRESET_META[normalizedPreset] || PRESET_META[DEFAULT_PRESET];
        var meta = ensureMetaThemeColor();
        var themeColor = normalized === 'dark' ? presetMeta.darkColor : presetMeta.lightColor;

        document.documentElement.style.colorScheme = normalized;
        if (document.body) {
            document.body.style.colorScheme = normalized;
        }

        meta.setAttribute('content', themeColor);
    }

    function updateToggleUI(theme) {
        var toggle = document.querySelector(TOGGLE_SELECTOR);
        var label = document.getElementById('navbar-theme-toggle-label');
        var icon = document.getElementById('navbar-theme-toggle-icon');
        var nextModeTitle = theme === 'dark'
            ? '\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0641\u0627\u062a\u062d'
            : '\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u062f\u0627\u0643\u0646';

        if (!toggle) {
            return;
        }

        toggle.setAttribute('title', nextModeTitle);
        toggle.setAttribute('aria-label', nextModeTitle);
        toggle.setAttribute('data-current-theme', theme);

        if (label) {
            label.innerHTML = theme === 'dark'
                ? '\u0641\u0627\u062a\u062d'
                : '\u062f\u0627\u0643\u0646';
        }

        if (icon) {
            icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        }

        if (typeof window.lucide !== 'undefined' && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }

    function clonePresetMeta() {
        var clone = {};
        var key;
        for (key in PRESET_META) {
            if (!PRESET_META.hasOwnProperty(key)) continue;
            clone[key] = {
                label: PRESET_META[key].label,
                lightColor: PRESET_META[key].lightColor,
                darkColor: PRESET_META[key].darkColor
            };
        }
        return clone;
    }

    function dispatchThemeChanged(theme, preset) {
        var event = document.createEvent('CustomEvent');
        event.initCustomEvent('themeChanged', false, false, {
            theme: normalizeTheme(theme),
            preset: normalizePreset(preset)
        });
        window.dispatchEvent(event);
    }

    function syncShellFrameTheme(theme, preset) {
        var frame = document.getElementById('content-frame');
        var normalizedTheme = normalizeTheme(theme);
        var normalizedPreset = normalizePreset(preset || getCurrentPreset());
        if (!frame) {
            return;
        }

        try {
            if (frame.contentDocument && frame.contentDocument.documentElement) {
                frame.contentDocument.documentElement.setAttribute('data-theme', normalizedTheme);
                frame.contentDocument.documentElement.setAttribute('data-theme-preset', normalizedPreset);
                frame.contentDocument.documentElement.style.colorScheme = normalizedTheme;
            }

            if (frame.contentDocument && frame.contentDocument.body) {
                frame.contentDocument.body.setAttribute('data-theme', normalizedTheme);
                frame.contentDocument.body.setAttribute('data-theme-preset', normalizedPreset);
                frame.contentDocument.body.style.colorScheme = normalizedTheme;
            }

            if (frame.contentWindow &&
                frame.contentWindow.ThemeManager &&
                typeof frame.contentWindow.ThemeManager.applyThemeState === 'function') {
                frame.contentWindow.ThemeManager.applyThemeState(normalizedTheme, normalizedPreset, {
                    skipStorage: true,
                    silentEvent: true
                });
            } else if (frame.contentWindow &&
                frame.contentWindow.ThemeManager &&
                typeof frame.contentWindow.ThemeManager.applyTheme === 'function') {
                frame.contentWindow.ThemeManager.applyTheme(normalizedTheme, {
                    skipStorage: true,
                    silentEvent: true
                });
                if (typeof frame.contentWindow.ThemeManager.setPreset === 'function') {
                    frame.contentWindow.ThemeManager.setPreset(normalizedPreset, {
                        skipStorage: true,
                        silentEvent: true
                    });
                }
            }
        } catch (error) {}
    }

    function refreshNavbarState() {
        if (!window.NavbarManager || typeof window.NavbarManager.render !== 'function') {
            return;
        }

        try {
            window.NavbarManager.render();
            bindToggle();
        } catch (error) {}
    }

    function applyThemeState(theme, preset, options) {
        var normalized = normalizeTheme(theme);
        var normalizedPreset = normalizePreset(preset);
        var skipStorage = options && options.skipStorage;
        var silentEvent = options && options.silentEvent;

        document.documentElement.setAttribute('data-theme', normalized);
        document.documentElement.setAttribute('data-theme-preset', normalizedPreset);
        document.documentElement.classList.toggle('theme-dark', normalized === 'dark');
        document.documentElement.classList.toggle('theme-light', normalized !== 'dark');

        if (document.body) {
            document.body.setAttribute('data-theme', normalized);
            document.body.setAttribute('data-theme-preset', normalizedPreset);
            document.body.classList.toggle('theme-dark', normalized === 'dark');
            document.body.classList.toggle('theme-light', normalized !== 'dark');
        }

        syncColorScheme(normalized, normalizedPreset);

        if (!skipStorage) {
            safeSetStorage(STORAGE_KEY, normalized);
            safeSetStorage(PRESET_STORAGE_KEY, normalizedPreset);
        }

        updateToggleUI(normalized);
        syncShellFrameTheme(normalized, normalizedPreset);
        refreshNavbarState();

        if (!silentEvent) {
            dispatchThemeChanged(normalized, normalizedPreset);
        }

        return {
            theme: normalized,
            preset: normalizedPreset
        };
    }

    function applyTheme(theme, options) {
        return applyThemeState(theme, getCurrentPreset(), options);
    }

    function setPreset(preset, options) {
        return applyThemeState(getCurrentTheme(), preset, options);
    }

    function handleThemeChange(theme, preset) {
        applyThemeState(theme, preset, {
            skipStorage: true,
            silentEvent: true
        });
    }

    function onToggleClick(event) {
        if (event && event.preventDefault) {
            event.preventDefault();
        }

        applyTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
    }

    function bindToggle() {
        var toggle = document.querySelector(TOGGLE_SELECTOR);
        if (!toggle || toggle.getAttribute('data-theme-bound') === 'true') {
            updateToggleUI(getCurrentTheme());
            return;
        }

        toggle.setAttribute('data-theme-bound', 'true');
        toggle.addEventListener('click', onToggleClick);
        updateToggleUI(getCurrentTheme());
    }

    function bindShellFrameSync() {
        var frame = document.getElementById('content-frame');
        if (!frame || frame.getAttribute('data-theme-sync-bound') === 'true') {
            return;
        }

        frame.setAttribute('data-theme-sync-bound', 'true');
        frame.addEventListener('load', function () {
            syncShellFrameTheme(getCurrentTheme(), getCurrentPreset());
        });
    }

    function init() {
        if (initialized) {
            bindToggle();
            applyTheme(getCurrentTheme(), {
                skipStorage: true,
                silentEvent: true
            });
            return;
        }

        initialized = true;
        bindShellFrameSync();

        window.addEventListener('themeChanged', function (event) {
            var detail = event && event.detail ? event.detail : {};
            var theme = detail.theme || getCurrentTheme();
            var preset = detail.preset || getCurrentPreset();
            handleThemeChange(theme, preset);
        });

        window.addEventListener('storage', function (event) {
            if (event && (event.key === STORAGE_KEY || event.key === PRESET_STORAGE_KEY)) {
                handleThemeChange(getStoredTheme(), getStoredPreset());
            }
        });

        bindToggle();
        applyThemeState(getStoredTheme(), getStoredPreset(), {
            silentEvent: true
        });
    }

    window.ThemeManager = {
        init: init,
        applyTheme: applyTheme,
        applyThemeState: applyThemeState,
        setPreset: setPreset,
        getCurrentTheme: getCurrentTheme,
        getCurrentPreset: getCurrentPreset,
        getCurrentState: getCurrentState,
        getAvailablePresets: clonePresetMeta,
        updateToggleUI: updateToggleUI,
        loadDarkReader: function () {}
    };
})(window, document);
