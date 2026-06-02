/**
 * IconManager
 * Handles icon display based on Operating System capabilities.
 * Detects Windows 7 and serves colorful SVG icons instead of modern Emojis.
 * ES5 Version for Windows 7 / IE11 Compatibility
 */

var IconManager = (function () {

    // Check if OS is Windows 7
    function isWindows7() {
        // ALWAYS return true to enforce the standardized SVG design across ALL platforms (Windows 7/10/11)
        return true;
    }

    var LUCIDE_ICONS = {
        'teacher': 'briefcase',
        'chart': 'bar-chart-2',
        'print': 'printer',
        'calendar': 'calendar',
        'level': 'layers',
        'users': 'users',
        'warning': 'alert-triangle',
        'success': 'check-circle',
        'sparkles': 'sparkles',
        'list': 'list',
        'schedule': 'clipboard-list',
        'settings': 'settings',
        'male': 'user',
        'female': 'user',
        'school': 'school',
        'notice1': 'bell',
        'notice2': 'file-text',
        'excuse': 'mail-warning',
        'strikeoff': 'ban',
        'pie': 'pie-chart',
        'cake': 'cake',
        'edit': 'edit',
        'delete': 'trash-2',
        'check': 'check',
        'shield': 'shield',
        'pin': 'pin',
        'plus': 'plus',
        'clock': 'clock',
        'tag': 'tag',
        'sun': 'sun',
        'moon': 'moon',
        'book': 'book',
        'search': 'search',
        'home': 'home',
        'import': 'import',
        'folder': 'folder',
        'refresh': 'refresh-cw',
        'save': 'save',
        'first_page': 'chevrons-right',
        'last_page': 'chevrons-left',
        'prev_page': 'chevron-right',
        'next_page': 'chevron-left',
        'info': 'info',
        'message-circle': 'message-circle',
        'target': 'target',
        'certificate': 'award',
        'user': 'user',
        'books': 'library',
        'excel': 'file-spreadsheet',
        'scale': 'scale',
        'cut': 'scissors',
        'rocket': 'rocket',
        'empty_box': 'package-open',
        'logout': 'log-out',
        'building': 'landmark',
        'trophy': 'trophy',
        'star': 'star',
        'award': 'award',
        'medal': 'medal',
        'x': 'x',
        'times': 'x',
        'chart-bar': 'bar-chart-2',
        'branch': 'network',
        'chartLine': 'trending-up',
        'chart-line': 'trending-up',
        'chart-pie': 'pie-chart',
        'calculator': 'calculator',
        'bulb': 'lightbulb',
        'class': 'users',
        'clipboard-list': 'clipboard-list',
        'close': 'x',
        'cog': 'settings',
        'cogs': 'settings',
        'door': 'log-out',
        'download': 'download',
        'email': 'mail',
        'exchange-alt': 'arrow-left-right',
        'exclamation-triangle': 'alert-triangle',
        'file-import': 'file-input',
        'file-signature': 'file-check',
        'file-text': 'file-text',
        'folder-open': 'folder-open',
        'folder-plus': 'folder-plus',
        'globe': 'globe',
        'graduation-cap': 'graduation-cap',
        'info-circle': 'info',
        'key': 'key',
        'layer-group': 'layers',
        'list-ol': 'list-ordered',
        'list-ul': 'list',
        'lock': 'lock',
        'random': 'shuffle',
        'recycle': 'recycle',
        'subject': 'book-open',
        'sync-alt': 'refresh-cw',
        'times-circle': 'x-circle',
        'trash': 'trash-2',
        'trash-alt': 'trash-2',
        'upload': 'upload',
        'user-times': 'user-x',
        'youtube': 'youtube',
        'chevron-left': 'chevron-left',
        'check-circle': 'check-circle',
        'eye': 'eye',
        'eye-off': 'eye-off'
    };

    function get(name) {
        if (LUCIDE_ICONS[name]) {
            return '<i data-lucide="' + LUCIDE_ICONS[name] + '"></i>';
        }
        return '';
    }

    // Mapping from emoji to icon name for auto-replacement
    var EMOJI_TO_NAME = {
        '👨‍🏫': 'teacher', '📈': 'chart', '🖨️': 'print', '🖨': 'print', '📅': 'calendar',
        '🎓': 'level', '👥': 'users', '⚠️': 'warning', '⚠': 'warning', '✅': 'success',
        '✨': 'sparkles', '📋': 'list', '📝': 'schedule', '⚙️': 'settings', '⚙': 'settings',
        '👨': 'male', '👧': 'female', '🏫': 'school', '📨': 'excuse', '⛔': 'strikeoff',
        '🍰': 'pie', '🏠': 'home', '📥': 'import', '📂': 'folder', '🔄': 'refresh',
        '💾': 'save', 'ℹ️': 'info', 'ℹ': 'info', '🎯': 'target', '🏆': 'certificate',
        '👤': 'user', '📌': 'pin', '➕': 'plus', '🕒': 'clock', '🏷️': 'tag', '🏷': 'tag',
        '🌅': 'sun', '🌙': 'moon', '🚫': 'strikeoff', '📘': 'book', '🔍': 'search',
        '📚': 'books', '📊': 'excel', '⏮️': 'first_page', '⏮': 'first_page', '⏭️': 'last_page',
        '⏭': 'last_page', '◀️': 'prev_page', '◀': 'prev_page', '▶️': 'next_page', '▶': 'next_page',
        '👨‍💼': 'user', '💡': 'info', '⚖️': 'scale', '⚖': 'scale', '✂️': 'cut', '✂': 'cut', '🚀': 'rocket', '🏖️': 'sun',
        '📭': 'empty_box', '🏅': 'medal', '⭐': 'star', '🎖️': 'award', '🎖': 'award',
        '☀️': 'sun', '☀': 'sun', '🗑️': 'delete', '🗑': 'delete', '✏️': 'edit', '✏': 'edit', '🛡️': 'shield', '🛡': 'shield',
        '🌿': 'branch'
    };

    // Auto-replace elements with data-icon attribute
    var isRendering = false;

    function render() {
        // Prevent infinite loop: disconnect observer during render
        if (isRendering) return;
        isRendering = true;
        if (observer) observer.disconnect();

        var elements = document.querySelectorAll('[data-icon]');
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var iconName = el.getAttribute('data-icon');
            // Only update if not already rendered
            if (!el.getAttribute('data-icon-rendered')) {
                el.innerHTML = get(iconName);
                el.setAttribute('data-icon-rendered', 'true');
            }
        }

        // Initialize Lucide if library is available, or load it
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        } else {
            // Self-load lucide for sub-pages if navbar_manager didn't do it yet
            var scripts = document.getElementsByTagName('script');
            var isLoaded = false;
            for(var j=0; j<scripts.length; j++) {
                if(scripts[j].src.indexOf('lucide.min.js') !== -1) { isLoaded = true; break; }
            }
            
            if (!isLoaded) {
                var script = document.createElement('script');
                // Detect path depth relative to A-data/assets/js/
                var path = window.location.pathname;
                var base = '';
                if (path.indexOf('A-data') !== -1) {
                    // Count how deep we are inside A-data
                    var afterAdata = path.substring(path.indexOf('A-data') + 'A-data/'.length);
                    var depth = afterAdata.split('/').length - 1; // -1 for the filename itself
                    for (var d = 0; d < depth; d++) base += '../';
                } else {
                    base = 'A-data/';
                }
                script.src = base + 'assets/js/lucide.min.js';
                script.onload = function() {
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                };
                document.head.appendChild(script);
            }

            // Also listen for event from NavbarManager as fallback
            document.addEventListener('lucide-loaded', function() {
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, { once: true });
        }

        // On Windows 7, also replace loose emojis in text
        if (isWindows7()) {
            replaceAllEmojis();
        }

        // Re-enable observer after DOM settles
        setTimeout(function() {
            isRendering = false;
            if (observer) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            }
        }, 50);
    }

    // Replace all emojis in the page with SVG icons (for Windows 7)
    function replaceAllEmojis() {
        // Create a regex pattern from all emoji keys
        var emojiKeys = [];
        for (var key in EMOJI_TO_NAME) {
            emojiKeys.push(key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        }
        var emojiPattern = emojiKeys.join('|');

        if (!emojiPattern) return;

        var regex = new RegExp('(' + emojiPattern + ')', 'g');

        // Walk through all text nodes
        var walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        var nodesToReplace = [];
        var node;
        while (node = walker.nextNode()) {
            if (regex.test(node.textContent)) {
                nodesToReplace.push(node);
            }
            regex.lastIndex = 0; // Reset regex
        }

        for (var i = 0; i < nodesToReplace.length; i++) {
            var textNode = nodesToReplace[i];
            var parent = textNode.parentNode;
            if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') continue;

            var html = textNode.textContent.replace(regex, function (match) {
                var iconName = EMOJI_TO_NAME[match];
                if (iconName && LUCIDE_ICONS[iconName]) {
                    return '<i data-lucide="' + LUCIDE_ICONS[iconName] + '" style="margin:0 4px;"></i>';
                }
                return match;
            });

            if (html !== textNode.textContent) {
                var span = document.createElement('span');
                span.innerHTML = html;
                parent.replaceChild(span, textNode);
            }
        }
    }

    // MutationObserver to handle dynamic content (React, Grid.js, etc.)
    var observer = null;
    var renderTimeout = null;

    function observe() {
        if (!isWindows7() || typeof MutationObserver === 'undefined') return;
        
        if (observer) return; // Already observing

        observer = new MutationObserver(function(mutations) {
            var shouldRender = false;
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].addedNodes.length > 0 || mutations[i].type === 'characterData') {
                    shouldRender = true;
                    break;
                }
            }

            if (shouldRender) {
                // Debounce render calls to prevent performance lag
                if (renderTimeout) clearTimeout(renderTimeout);
                renderTimeout = setTimeout(function() {
                    render();
                }, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    return {
        get: get,
        render: render,
        isWindows7: isWindows7,
        replaceAllEmojis: replaceAllEmojis,
        observe: observe
    };
})();

// Auto-run on DOMContentLoaded
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
        if (typeof IconManager !== 'undefined') {
            IconManager.render();
            // Start observing for dynamic content on Windows 7
            if (IconManager.isWindows7()) {
                IconManager.observe();
            }
        }
    });
}
