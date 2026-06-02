// Global Print Toolbar Helper
window.PrintToolbarHelper = {
    getHeadContent: function () {
        return '<style>' +
            '/* Toolbar Styles */' +
            '.print-toolbar {' +
            '    background: #f8fafc;' +
            '    padding: 8px 15px;' +
            '    border-bottom: 2px solid var(--border-color);' +
            '    display: flex;' +
            '    flex-wrap: wrap;' +
            '    gap: 12px;' +
            '    justify-content: space-between;' +
            '    align-items: center;' +
            '    position: sticky;' +
            '    top: 0;' +
            '    z-index: 1000;' +
            '    box-shadow: 0 4px 15px rgba(0,0,0,0.05);' +
            '    margin-bottom: 10px;' +
            '    direction: rtl;' +
            '    font-family: \'Cairo\', sans-serif;' +
            '}' +
            '.print-toolbar input {' +
            '    width: 60px;' +
            '    padding: 4px;' +
            '    text-align: center;' +
            '    border: 1px solid #cbd5e1;' +
            '    border-radius: 6px;' +
            '    font-family: inherit;' +
            '    font-size: 13px;' +
            '}' +
            '.print-toolbar button {' +
            '    padding: 6px 12px;' +
            '    border: none;' +
            '    border-radius: 8px;' +
            '    cursor: pointer;' +
            '    font-weight: bold;' +
            '    font-family: inherit;' +
            '    font-size: 13px;' +
            '    transition: all 0.2s;' +
            '}' +
            '.btn-print { background: #2563eb; color: white; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2); }' +
            '.btn-print:hover { background: #1d4ed8; transform: translateY(-2px); }' +
            '.btn-cancel { background: var(--border-color); color: #475569; margin-left: 10px; }' +
            '.btn-cancel:hover { background: #cbd5e1; }' +
            '.toolbar-right { display: flex; align-items: center; gap: 12px; font-weight: bold; color: #334155; }' +
            '.total-pages { color: #64748b; font-size: 0.9em; margin-right: 15px; }' +
            '.info-msg { color: #3b82f6; font-size: 0.95em; font-weight: bold; }' +
            '@media print, screen {' +
            '    body:not(.print-toolbar) {' +
            '        font-family: \'Cairo\', \'Tajawal\', sans-serif;' +
            '    }' +
            '}' +
            '@media print {' +
            '    .no-print { display: none !important; }' +
            '}' +
            '</style>';
    },
    getToolbarHtml: function (options) {
        if (!options) options = { advanced: false, totalPages: 1 };
        var rightSide = '';
        if (options.advanced) {
            rightSide = '<div class="toolbar-right">' +
                '    <span>عرض الصفحات من:</span>' +
                '    <input type="number" id="pageFrom" value="1" min="1" max="' + options.totalPages + '" onchange="updatePages()">' +
                '    <span>إلى:</span>' +
                '    <input type="number" id="pageTo" value="' + options.totalPages + '" min="1" max="' + options.totalPages + '" onchange="updatePages()">' +
                '    <span class="total-pages">(الإجمالي: ' + options.totalPages + ' صفحة)</span>' +
                '</div>';
        } else {
            rightSide = '<div class="toolbar-right"></div>';
        }
        var openInBrowserBtn = options.hideBrowserBtn ? '' : '<button onclick="openInBrowser()" class="btn-browser" style="background: #0f172a; color: white; border: none; border-radius: 8px; padding: 6px 12px; cursor: pointer; font-weight: bold; font-family: inherit; font-size: 13px; transition: all 0.2s;">🌐 فتح في المتصفح</button>';

        return '<!-- Print Toolbar -->' +
            '<div class="print-toolbar no-print" dir="rtl">' +
            '    <div class="toolbar-left" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">' +
            '        <button onclick="window.print()" class="btn-print">🖨️ طباعة التقرير</button>' +
            openInBrowserBtn +
            '        <button onclick="window.close()" class="btn-cancel">إلغاء</button>' +
            '        <button onclick="toggleBlackText()" class="btn-black-text" style="background: #334155; color: white; border: none; border-radius: 8px; padding: 6px 12px; cursor: pointer; font-weight: bold; font-family: inherit; font-size: 13px; transition: all 0.2s; margin-right: 5px;">⚫ نص أسود</button>' +
            '        <div style="height: 20px; width: 1px; background: #cbd5e1; margin: 0 5px;"></div>' +
            '        <div style="display: flex; align-items: center; gap: 5px; font-weight: bold; color: #334155; font-size: 14px;">' +
            '            <span title="مقياس الطباعة وتكبير/تصغير المحتوى">🔍 الحجم (%):</span>' +
            '            <input type="number" id="printScale" value="100" min="30" max="200" step="5" onchange="updatePrintScale(this.value)" style="width: 60px;">' +
            '        </div>' +
            '        <div style="height: 20px; width: 1px; background: #cbd5e1; margin: 0 5px;"></div>' +
            '        <div style="display: flex; align-items: center; gap: 5px; font-weight: bold; color: #334155; font-size: 14px;">' +
            '            <span title="تغيير نوع الخط">الخط:</span>' +
            '            <select id="printFont" onchange="updatePrintFont(this.value)" style="padding: 5px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: inherit; font-size: 14px; background: white;">' +
            '                <option value="\'Cairo\', \'Tajawal\', sans-serif">Cairo (افتراضي)</option>' +
            '                <option value="\'ManaraDocs\', sans-serif">ManaraDocs</option>' +
            '                <option value="\'Tajawal\', sans-serif">Tajawal</option>' +
            '                <option value="\'Amiri\', serif">Amiri</option>' +
            '                <option value="Arial, sans-serif">Arial</option>' +
            '                <option value="\'Segoe UI\', Tahoma, Verdana, sans-serif">Segoe UI</option>' +
            '            </select>' +
            '        </div>' +
            '    </div>' +
            rightSide +
            '</div>';
    },
    getScriptHtml: function (options) {
        if (!options) options = { advanced: false };
        var advancedScript = '';
        if (options.advanced) {
            advancedScript =
                'function updatePages() {\n' +
                '    var total = ' + (options.totalPages || 1) + ';\n' +
                '    var from = parseInt(document.getElementById("pageFrom").value) || 1;\n' +
                '    var to = parseInt(document.getElementById("pageTo").value) || 1;\n' +
                '    if(isNaN(from) || from < 1) { from = 1; document.getElementById("pageFrom").value = 1; }\n' +
                '    if(isNaN(to) || to > total) { to = total; document.getElementById("pageTo").value = total; }\n' +
                '    if(from > to) { document.getElementById("pageFrom").value = to; from = to; }\n' +
                '    var chunks = document.querySelectorAll(".page-chunk");\n' +
                '    for (var i = 0; i < chunks.length; i++) {\n' +
                '        var chunk = chunks[i];\n' +
                '        var page = parseInt(chunk.getAttribute("data-page"));\n' +
                '        if(page >= from && page <= to) { chunk.style.display = ""; } \n' +
                '        else { chunk.style.display = "none"; }\n' +
                '    }\n' +
                '}\n';
        }

        return '<script>\n' +
            advancedScript + '\n' +
            'function openInBrowser() {\n' +
            '    try {\n' +
            '        var clone = document.documentElement.cloneNode(true);\n' +
            '        var toolbar = clone.querySelector(".print-toolbar");\n' +
            '        if (toolbar) toolbar.remove();\n' +
            '        var scripts = clone.querySelectorAll("script");\n' +
            '        for (var k = 0; k < scripts.length; k++) { scripts[k].remove(); }\n' +
            '        try {\n' +
            '            var sheets = document.styleSheets;\n' +
            '            for (var i = 0; i < sheets.length; i++) {\n' +
            '                try {\n' +
            '                    var sheet = sheets[i];\n' +
            '                    var cssText = "";\n' +
            '                    var rules = sheet.cssRules || sheet.rules;\n' +
            '                    if (rules) {\n' +
            '                        for (var j = 0; j < rules.length; j++) { cssText += rules[j].cssText + "\\n"; }\n' +
            '                        var styleTag = document.createElement("style");\n' +
            '                        styleTag.textContent = cssText;\n' +
            '                        var head = clone.querySelector("head");\n' +
            '                        if (head) head.appendChild(styleTag); else clone.appendChild(styleTag);\n' +
            '                    }\n' +
            '                } catch (sheetError) { console.warn("Style error:", sheetError); }\n' +
            '            }\n' +
            '        } catch (styleErr) { console.error("Inline error:", styleErr); }\n' +
            '        if (!clone.querySelector("meta[charset]")) {\n' +
            '            var meta = document.createElement("meta");\n' +
            '            meta.setAttribute("charset", "utf-8");\n' +
            '            var h = clone.querySelector("head");\n' +
            '            if (h) h.insertBefore(meta, h.firstChild);\n' +
            '        }\n' +
            '        var htmlContent = "\\uFEFF<!DOCTYPE html>\\n" + clone.outerHTML;\n' +
            '        var ipc = window.ipcRenderer || (window.require ? window.require("electron").ipcRenderer : null) || (window.opener ? window.opener.ipcRenderer : null);\n' +
            '        if (ipc && typeof ipc.invoke === "function") {\n' +
            '            ipc.invoke("print-to-browser", htmlContent).then(function(result) {\n' +
            '                if (result && result.success === false) alert("خطأ في الطباعة: " + result.error);\n' +
            '            });\n' +
            '        } else {\n' +
            '            var isElectron = !!(window.process && window.process.versions && window.process.versions.electron);\n' +
            '            if (!isElectron) {\n' +
            '                var blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });\n' +
            '                var url = URL.createObjectURL(blob);\n' +
            '                window.open(url, "_blank");\n' +
            '            } else { alert("Please restart the app to enable this feature."); }\n' +
            '        }\n' +
            '    } catch (e) { console.error("UI Error:", e); }\n' +
            '}\n' +
            '\n' +
            'function updatePrintScale(val) {\n' +
            '    var scaleVal = parseInt(val) || 100;\n' +
            '    var styleEl = document.getElementById("dynamic-scale-style");\n' +
            '    if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "dynamic-scale-style"; document.head.appendChild(styleEl); }\n' +
            '    styleEl.textContent = "@media print, screen { body > *:not(.print-toolbar) { zoom: " + (scaleVal / 100) + "; } }";\n' +
            '}\n' +
            '\n' +
            'function updatePrintFont(fontFamily) {\n' +
            '    var styleEl = document.getElementById("dynamic-font-style");\n' +
            '    if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "dynamic-font-style"; document.head.appendChild(styleEl); }\n' +
            '    var fontFaceCss = "";\n' +
            '    if (fontFamily.indexOf("ManaraDocs") !== -1 || fontFamily.indexOf("Tajawal") !== -1 || fontFamily.indexOf("Cairo") !== -1) {\n' +
            '        var path = window.location.pathname;\n' +
            '        if (path === "blank" || path === "") path = window.opener && window.opener.location ? window.opener.location.pathname : "";\n' +
            '        var baseUrl = path.substring(0, path.lastIndexOf("/"));\n' +
            '        if (baseUrl.endsWith("/exams") || baseUrl.endsWith("/staff") || baseUrl.endsWith("/students") || baseUrl.endsWith("/analysis") || baseUrl.endsWith("/core") || baseUrl.endsWith("/db")) { baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf("/")); }\n' +
            '        if (baseUrl && baseUrl.indexOf("file://") !== 0) baseUrl = "file://" + (baseUrl.charAt(0) === "/" ? "" : "/") + baseUrl;\n' +
            '        if (fontFamily.indexOf("ManaraDocs") !== -1) {\n' +
            '            fontFaceCss = "@font-face { font-family: \'ManaraDocs\'; src: url(\'" + encodeURI(baseUrl + "/assets/fonts/ManaraDocs Amatti Font.ttf") + "\') format(\'truetype\'); }";\n' +
            '        } else if (fontFamily.indexOf("Tajawal") !== -1) {\n' +
            '            fontFaceCss = "@font-face { font-family: \'Tajawal\'; src: url(\'" + encodeURI(baseUrl + "/assets/fonts/Tajawal-Regular.ttf") + "\') format(\'truetype\'); }";\n' +
            '        } else if (fontFamily.indexOf("Cairo") !== -1) {\n' +
            '            fontFaceCss = "@font-face { font-family: \'Cairo\'; src: url(\'" + encodeURI(baseUrl + "/assets/fonts/Cairo-Regular.ttf") + "\') format(\'truetype\'); }";\n' +
            '        }\n' +
            '    }\n' +
            '    styleEl.textContent = fontFaceCss + "@media print, screen { body:not(.print-toolbar), body *:not(.print-toolbar):not(.print-toolbar *) { font-family: " + fontFamily + " !important; } }";\n' +
            '}\n' +
            '\n' +
            'function toggleBlackText() {\n' +
            '    var styleEl = document.getElementById("dynamic-black-text-style");\n' +
            '    var btn = document.querySelector(".btn-black-text");\n' +
            '    if (!styleEl) {\n' +
            '        styleEl = document.createElement("style");\n' +
            '        styleEl.id = "dynamic-black-text-style";\n' +
            '        document.head.appendChild(styleEl);\n' +
            '        styleEl.textContent = "@media print, screen { body:not(.print-toolbar), body *:not(.print-toolbar):not(.print-toolbar *), body *:not(.print-toolbar) th, body *:not(.print-toolbar) td { color: #000000 !important; } }";\n' +
            '        if (btn) btn.innerHTML = "🎨 ألوان النص";\n' +
            '        if (btn) btn.style.background = "#10b981";\n' +
            '    } else {\n' +
            '        styleEl.remove();\n' +
            '        if (btn) btn.innerHTML = "⚫ نص أسود";\n' +
            '        if (btn) btn.style.background = "#334155";\n' +
            '    }\n' +
            '}\n' +
            '</script>';
    }
};

(function () {
    // 1. Inject Premium About Modal CSS
    var style = document.createElement('style');
    style.textContent = '.about-modal {' +
        '    display: none;' +
        '    position: fixed;' +
        '    z-index: 99999;' +
        '    left: 0;' +
        '    top: 0;' +
        '    width: 100%;' +
        '    height: 100%;' +
        '    overflow: auto;' +
        '    background-color: rgba(15, 23, 42, 0.5);' +
        '    backdrop-filter: blur(12px);' +
        '    -webkit-backdrop-filter: blur(12px);' +
        '    justify-content: center;' +
        '    align-items: center;' +
        '    animation: aboutFadeIn 0.3s ease-out;' +
        '}' +
        '@keyframes aboutFadeIn {' +
        '    from { opacity: 0; }' +
        '    to { opacity: 1; }' +
        '}' +
        '.about-modal-content {' +
        '    background: var(--card-bg);' +
        '    margin: auto;' +
        '    padding: 0;' +
        '    border-radius: 24px;' +
        '    width: 92%;' +
        '    max-width: 480px;' +
        '    box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);' +
        '    animation: aboutPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);' +
        '    position: relative;' +
        '    overflow: hidden;' +
        '    font-family: \'Cairo\', sans-serif;' +
        '}' +
        '@keyframes aboutPopIn {' +
        '    0% { transform: scale(0.9) translateY(20px); opacity: 0; }' +
        '    100% { transform: scale(1) translateY(0); opacity: 1; }' +
        '}' +
        '.about-hero {' +
        '    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);' +
        '    padding: 24px 20px 18px;' +
        '    text-align: center;' +
        '    position: relative;' +
        '    overflow: hidden;' +
        '}' +
        '.about-hero::before {' +
        '    content: \'\';' +
        '    position: absolute;' +
        '    top: -50%;' +
        '    left: -50%;' +
        '    width: 200%;' +
        '    height: 200%;' +
        '    background: radial-gradient(circle at 30% 70%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),' +
        '                radial-gradient(circle at 70% 30%, rgba(168, 85, 247, 0.1) 0%, transparent 50%);' +
        '    animation: aboutShimmer 8s ease-in-out infinite;' +
        '}' +
        '@keyframes aboutShimmer {' +
        '    0%, 100% { transform: translate(0, 0); }' +
        '    50% { transform: translate(-5%, 5%); }' +
        '}' +
        '.about-close-btn {' +
        '    position: absolute;' +
        '    top: 14px;' +
        '    left: 14px;' +
        '    background: rgba(255, 255, 255, 0.1);' +
        '    width: 34px;' +
        '    height: 34px;' +
        '    display: flex;' +
        '    align-items: center;' +
        '    justify-content: center;' +
        '    border-radius: 50%;' +
        '    cursor: pointer;' +
        '    transition: all 0.25s ease;' +
        '    font-size: 18px;' +
        '    color: rgba(255, 255, 255, 0.7);' +
        '    z-index: 2;' +
        '    border: 1px solid rgba(255, 255, 255, 0.1);' +
        '}' +
        '.about-close-btn:hover {' +
        '    background: rgba(255, 255, 255, 0.2);' +
        '    color: #fff;' +
        '    transform: rotate(90deg) scale(1.1);' +
        '}' +
        '.about-logo-container {' +
        '    position: relative;' +
        '    z-index: 1;' +
        '    margin-bottom: 16px;' +
        '}' +
        '.about-logo-ring {' +
        '    width: 60px;' +
        '    height: 60px;' +
        '    border-radius: 18px;' +
        '    background: linear-gradient(135deg, #3b82f6, #8b5cf6);' +
        '    display: flex;' +
        '    align-items: center;' +
        '    justify-content: center;' +
        '    margin: 0 auto;' +
        '    font-size: 1.6rem;' +
        '    color: #fff;' +
        '}' +
        '.about-app-name {' +
        '    color: #fff;' +
        '    font-size: 1.8rem;' +
        '    font-weight: 800;' +
        '    margin: 0 0 8px;' +
        '    position: relative;' +
        '    z-index: 1;' +
        '    letter-spacing: -0.5px;' +
        '}' +
        '.about-version-badge {' +
        '    display: inline-flex;' +
        '    align-items: center;' +
        '    gap: 6px;' +
        '    background: rgba(255, 255, 255, 0.1);' +
        '    padding: 4px 12px;' +
        '    border-radius: 100px;' +
        '    color: rgba(255, 255, 255, 0.9);' +
        '    font-size: 0.85rem;' +
        '    font-weight: 600;' +
        '    position: relative;' +
        '    z-index: 1;' +
        '    border: 1px solid rgba(255, 255, 255, 0.05);' +
        '}' +
        '.about-version-badge .dot {' +
        '    width: 6px;' +
        '    height: 6px;' +
        '    background: #10b981;' +
        '    border-radius: 50%;' +
        '    box-shadow: 0 0 8px #10b981;' +
        '}' +
        '.about-body {' +
        '    padding: 24px 28px;' +
        '}' +
        '.about-desc {' +
        '    color: #475569;' +
        '    line-height: 1.7;' +
        '    margin: 0 0 24px;' +
        '    text-align: center;' +
        '    font-size: 1rem;' +
        '}' +
        '.about-info-cards {' +
        '    display: flex;' +
        '    flex-direction: column;' +
        '    gap: 12px;' +
        '    margin-bottom: 24px;' +
        '}' +
        '.about-info-card {' +
        '    display: flex;' +
        '    align-items: center;' +
        '    gap: 14px;' +
        '    padding: 12px 16px;' +
        '    background: #f8fafc;' +
        '    border-radius: 16px;' +
        '    border: 1px solid #f1f5f9;' +
        '    transition: all 0.2s ease;' +
        '}' +
        '.about-info-card:hover {' +
        '    background: #f1f5f9;' +
        '    transform: translateX(-4px);' +
        '}' +
        '.about-info-icon {' +
        '    width: 38px;' +
        '    height: 38px;' +
        '    border-radius: 10px;' +
        '    display: flex;' +
        '    align-items: center;' +
        '    justify-content: center;' +
        '    font-size: 18px;' +
        '    flex-shrink: 0;' +
        '}' +
        '.info-text {' +
        '    font-size: 0.9rem;' +
        '    color: #334155;' +
        '}' +
        '.about-social-btn {' +
        '    display: flex;' +
        '    align-items: center;' +
        '    justify-content: center;' +
        '    gap: 10px;' +
        '    background: #1877f2;' +
        '    color: white;' +
        '    padding: 12px;' +
        '    border-radius: 14px;' +
        '    text-decoration: none;' +
        '    font-weight: bold;' +
        '    font-size: 0.95rem;' +
        '    transition: all 0.25s ease;' +
        '    box-shadow: 0 4px 12px rgba(24, 119, 242, 0.2);' +
        '}' +
        '.about-social-btn:hover {' +
        '    background: #166fe5;' +
        '    transform: translateY(-2px);' +
        '    box-shadow: 0 6px 16px rgba(24, 119, 242, 0.3);' +
        '}' +
        '.about-copyright {' +
        '    margin-top: 24px;' +
        '    text-align: center;' +
        '    font-size: 0.8rem;' +
        '    color: #94a3b8;' +
        '    border-top: 1px solid #f1f5f9;' +
        '    padding-top: 18px;' +
        '}' +
        '.about-copyright .heart {' +
        '    color: #ef4444;' +
        '    display: inline-block;' +
        '    animation: aboutHeartBeat 1.5s infinite;' +
        '}' +
        '@keyframes aboutHeartBeat {' +
        '    0%, 100% { transform: scale(1); }' +
        '    45% { transform: scale(1.1); }' +
        '}';
    document.head.appendChild(style);

    // 2. Inject Premium About Modal HTML & Setup
    function initNavbarFix() {
        if (!document.body) {
            // Body not ready yet, wait for DOMContentLoaded
            document.addEventListener('DOMContentLoaded', initNavbarFix);
            return;
        }

        if (document.getElementById('aboutModal')) return; // Already injected

        var iconHtml = (typeof IconManager !== 'undefined' && IconManager.get) ? IconManager.get('school') : '🏫';
        var modalHTML = '<div id="aboutModal" class="about-modal">' +
            '    <div class="about-modal-content">' +
            '        <!-- Hero Section -->' +
            '        <div class="about-hero">' +
            '            <span class="about-close-btn" onclick="closeAboutModal()">&times;</span>' +
            '            <div class="about-logo-container">' +
            '                <div class="about-logo-ring">' + iconHtml + '</div>' +
            '            </div>' +
            '            <h3 class="about-app-name">إدارتي+</h3>' +
            '            <div class="about-version-badge">' +
            '                <span class="dot"></span> الإصدار 2.2.10 Premium' +
            '            </div>' +
            '        </div>' +
            '        <!-- Body -->' +
            '        <div class="about-body">' +
            '            <p class="about-desc">' +
            '                نظام جزائري متكامل لإدارة المؤسسات التعليمية (المتوسط والثانوي)، صُمّم لتبسيط المهام الإدارية والبيداغوجية، مع ضمان أعلى مستويات حماية وخصوصية البيانات.' +
            '            </p>' +
            '            <div class="about-info-cards">' +
            '                <div class="about-info-card">' +
            '                    <div class="about-info-icon" style="background: linear-gradient(135deg, #eff6ff, #dbeafe); color: #3b82f6;">ℹ️</div>' +
            '                    <span class="info-text"><strong>المطور:</strong> Benkredda Maamar</span>' +
            '                </div>' +
            '                <div class="about-info-card">' +
            '                    <div class="about-info-icon" style="background: linear-gradient(135deg, #f0fdf4, #dcfce7); color: #22c55e;">📧</div>' +
            '                    <span class="info-text"><strong>الدعم:</strong> benkreddamaamar@gmail.com</span>' +
            '                </div>' +
            '                <div class="about-info-card">' +
            '                    <div class="about-info-icon" style="background: linear-gradient(135deg, #fef3c7, #fde68a); color: #d97706;">🛡️</div>' +
            '                    <span class="info-text"><strong>الترخيص:</strong> نسخة متميزة - جميع الميزات مفعلة</span>' +
            '                </div>' +
            '            </div>' +
            '            <a href="https://www.facebook.com/people/%D8%A5%D8%AF%D8%A7%D8%B1%D8%A9-%D9%84%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85-%D8%A7%D9%84%D9%85%D8%AA%D9%88%D8%B3%D8%B7/61580202407300/" target="_blank" class="about-social-btn">' +
            '                صفحة إدارتي للتعليم المتوسط والثانوي' +
            '            </a>' +
            '            <div class="about-copyright">' +
            '                صُنع بـ <span class="heart">❤</span> في الجزائر &bull; جميع الحقوق محفوظة &copy; 2024-2025' +
            '            </div>' +
            '        </div>' +
            '    </div>' +
            '</div>';

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Re-render icons if managers are available
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        } else if (typeof IconManager !== 'undefined') {
            IconManager.render();
        }

        // Define Global Functions
        window.openAboutModal = function () {
            var m = document.getElementById('aboutModal');
            if (m) m.style.display = 'flex';
        };

        window.closeAboutModal = function () {
            var m = document.getElementById('aboutModal');
            if (m) m.style.display = 'none';
        };

        // Close on outside click
        window.addEventListener('click', function (event) {
            var m = document.getElementById('aboutModal');
            if (m && event.target == m) {
                closeAboutModal();
            }
        });
    }

    // Attempt initialization
    initNavbarFix();

})();
