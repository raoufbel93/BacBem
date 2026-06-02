/**

 * Supervision Schedule Management (React Version)

 * Replaces supervision.js

 * Uses React.createElement for no-build offline support

 */

const e = React.createElement;

const { useState, useEffect, useMemo, useCallback } = React;

// ======================

// CONSTANTS & HELPERS

// ======================

const STORAGE_KEYS = {

    TEACHERS: 'supervisionTeachers',

    DAYS: 'supervisionDays',

    SCHEDULE: 'supervisionSchedule',

    SETTINGS: 'supervisionSettings',
    TRIMESTER: 'supervisionTrimester',
    ROOM_ASSIGNMENTS: 'supervisionRoomAssignments',
    EXEMPTIONS: 'supervisionExemptions',
    PRINT_NOTES: 'supervisionPrintNotes_v2'

};

// Helper: get trimester-specific storage keys
const getTrimesterKeys = (tri) => ({
    DAYS: `supervisionDays_T${tri}`,
    SCHEDULE: `supervisionSchedule_T${tri}`,
    ROOM_ASSIGNMENTS: `supervisionRoomAssignments_T${tri}`,
    EXEMPTIONS: `supervisionExemptions_T${tri}`
});

const normalizeTeacherId = (id) => String(id);

const applyTrimesterExemptions = (teacherList, exemptTeacherIds) => {
    const exemptSet = new Set((exemptTeacherIds || []).map(normalizeTeacherId));
    return (teacherList || []).map((teacher) => ({
        ...teacher,
        isExempt: exemptSet.has(normalizeTeacherId(teacher.id))
    }));
};

const hydrateGlobalRoomCache = (periodRoomsData) => {
    GlobalRoomCache = {};

    const visit = (value) => {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach((room) => {
                if (room && room.id && room.label) {
                    GlobalRoomCache[room.id] = room.label;
                }
            });
            return;
        }

        if (typeof value === 'object') {
            Object.keys(value).forEach((key) => visit(value[key]));
        }
    };

    visit(periodRoomsData);
};

// Local Print Toolbar Helper for guaranteed visibility on Windows 7 / IE11
const PrintToolbarHelper = {
    getHeadContent: function () {
        return '<style>' +
            '/* Toolbar Styles */' +
            '.print-toolbar {' +
            '    background: #f8fafc;' +
            '    padding: 15px 25px;' +
            '    border-bottom: 2px solid var(--border-color);' +
            '    display: flex;' +
            '    justify-content: space-between;' +
            '    align-items: center;' +
            '    position: sticky;' +
            '    top: 0;' +
            '    z-index: 1000;' +
            '    box-shadow: 0 4px 15px rgba(0,0,0,0.05);' +
            '    margin-bottom: 20px;' +
            '    direction: rtl;' +
            '    font-family: \'Cairo\', sans-serif;' +
            '}' +
            '.print-toolbar input {' +
            '    width: 70px;' +
            '    padding: 6px;' +
            '    text-align: center;' +
            '    border: 1px solid #cbd5e1;' +
            '    border-radius: 6px;' +
            '    font-family: inherit;' +
            '    font-size: 14px;' +
            '}' +
            '.print-toolbar button {' +
            '    padding: 10px 20px;' +
            '    border: none;' +
            '    border-radius: 8px;' +
            '    cursor: pointer;' +
            '    font-weight: bold;' +
            '    font-family: inherit;' +
            '    font-size: 15px;' +
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
                '    <input type="number" id="pageFrom" value="1" min="1" max="\' + options.totalPages + \'" onchange="updatePages()">' +
                '    <span>إلى:</span>' +
                '    <input type="number" id="pageTo" value="\' + options.totalPages + \'" min="1" max="\' + options.totalPages + \'" onchange="updatePages()">' +
                '    <span class="total-pages">(الإجمالي: \' + options.totalPages + \' صفحة)</span>' +
                '</div>';
        } else {
            rightSide = '<div class="toolbar-right"></div>';
        }

        return '<!-- Print Toolbar -->' +
            '<div class="print-toolbar no-print" dir="rtl">' +
            '    <div class="toolbar-left" style="display: flex; gap: 10px; align-items: center;">' +
            '        <button onclick="window.print()" class="btn-print">🖨️ طباعة التقرير</button>' +
            '        <button onclick="openInBrowser()" class="btn-browser" style="background: #0f172a; color: white; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; font-weight: bold; font-family: inherit; font-size: 15px; transition: all 0.2s;">🌐 الفتح في المتصفح</button>' +
            '        <button onclick="window.close()" class="btn-cancel">إلغاء</button>' +
            '        <div style="height: 30px; width: 1px; background: #cbd5e1; margin: 0 5px;"></div>' +
            '        <div style="display: flex; align-items: center; gap: 5px; font-weight: bold; color: #334155; font-size: 14px;">' +
            '            <span title="مقياس الطباعة وتكبير/تصغير المحتوى">🔍 الحجم (%):</span>' +
            '            <input type="number" id="printScale" value="100" min="30" max="200" step="5" onchange="updatePrintScale(this.value)" style="width: 60px;">' +
            '        </div>' +
            '        <div style="height: 30px; width: 1px; background: #cbd5e1; margin: 0 5px;"></div>' +
            '        <div style="display: flex; align-items: center; gap: 5px; font-weight: bold; color: #334155; font-size: 14px;">' +
            '            <span title="تغيير نوع الخط">الخط:</span>' +
            '            <select id="printFont" onchange="updatePrintFont(this.value)" style="padding: 5px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: inherit; font-size: 14px; background: white;">' +
            '                <option value="\'Cairo\', \'Tajawal\', sans-serif">Cairo (افتراضي)</option>' +
            '                <option value="\'ManaraDocs\', sans-serif">ManaraDocs</option>' +
            '                <option value="\'Tajawal\', sans-serif">Tajawal</option>' +

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
            '        baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf("/"));\n' +
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
            '<\/script>';
    }
};

const SUBJECTS_CEM = [

    'الرياضيات', 'العلوم الطبيعية', 'الإعلام الآلي', 'العلوم الفيزيائية والتكنولوجيا',

    'التربية البدنية والرياضية', 'اللغة الفرنسية', 'اللغة العربية', 'اللغة الإنجليزية',

    'التربية التشكيلية', 'التربية الموسيقية', 'اللغة الأمازيغية', 'التربية الإسلامية',

    'التربية المدنية', 'التاريخ والجغرافيا'

];

const SUBJECTS_LYCEE = [

    'الرياضيات', 'العلوم الفيزيائية', 'العلوم الطبيعية', 'فيزياء/علوم', 'علوم/فيزياء', 'اللغة العربية وآدابها', 'اللغة الفرنسية',

    'اللغة الإنجليزية', 'التاريخ والجغرافيا', 'العلوم الإسلامية', 'الفلسفة',

    'ت. المحاسبي و المالي', 'اقتصاد ومناجمنت', 'القانون', 'الهندسة المدنية',

    'الهندسة الميكانيكية', 'الهندسة الكهربائية', 'هندسة الطرائق', 'الإعلام الآلي',

    'التربية البدنية', 'اللغة الأمازيغية', 'التربية الفنية', 'التربية الموسيقية',

    'لغة إيطالية', 'لغة إسبانية', 'لغة ألمانية', 'لغة أجنبية 3', 'التكنولوجيا'

];

const getSubjectLabel = (key) => {

    const labels = {

        'رياضيات': 'رياضيات', 'فيزياء': 'فيزياء', 'علوم': 'علوم', 'عربية': 'عربية',

        'فرنسية': 'فرنسية', 'انجليزية': 'انجليزية', 'تاريخ': 'تاريخ',

        'تربية_اسلامية': 'ت.إسلامية', 'تربية_مدنية': 'ت.مدنية', 'تربية_فنية': 'ت.فنية',

        'تربية_بدنية': 'ت.بدنية', 'موسيقى': 'موسيقى', 'إعلام_آلي': 'إعلام آلي'

    };

    return labels[key] || key;

};

const formatDate = (dateStr) => {
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
    return date.toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const formatDateShort = (dateStr) => {
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
    const dayName = date.toLocaleDateString('ar-DZ', { weekday: 'long' });
    const dateFormatted = date.toLocaleDateString('ar-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return { dayName, dateFormatted, full: `${dayName} ${dateFormatted}` };
};

// Global Room Cache for label lookup
let GlobalRoomCache = {};

// Helper for short location labels
const getLocationLabelShort = (id) => {
    if (!id || id === 0) return '';

    // 1. Try Lookup in Global Cache (covers new structured rooms)
    if (GlobalRoomCache[id]) return GlobalRoomCache[id];

    // 2. Legacy / Hardcoded Patterns
    const numericId = parseInt(id);
    if (isNaN(numericId)) return id; // Return as-is if string

    if (numericId >= 300) {
        // Handle potentially large IDs from old generator or timestamps
        if (numericId > 1000000) return `قاعة`; // Fallback for timestamps if not in cache
        return `خ${numericId - 300 + 1}`;
    }
    if (numericId > 200) return `و${numericId - 200}`;
    if (numericId > 100) return `م${numericId - 100}`;
    return `ق${numericId}`;
};

const getSupervisionTrimesterLabel = (value) => {
    const labels = {
        '1': 'الفصل الأول',
        '2': 'الفصل الثاني',
        '3': 'الفصل الثالث',
        'blanc': 'الامتحان التجريبي (متوسط)',
        'blanc_lycee': 'الامتحان التجريبي (ثانوي)'
    };

    return labels[value] || value || '';
};

const getSupervisionPeriodShortLabel = (period) => {
    if (period === 'midday') return 'منتصف';
    if (period === 'evening') return 'مساء';
    return 'صباح';
};

// ======================

// COMPONENTS

// ======================

// --- UI Components ---

const Icon = ({ name, style = {} }) =>
    e('span', {
        'data-icon': name,
        className: 'icon-wrapper',
        dangerouslySetInnerHTML: { __html: IconManager.get(name) },
        style: { verticalAlign: 'middle', display: 'inline-flex', alignItems: 'center', ...style }
    });

const Button = ({ onClick, children, className = 'btn-primary', style = {} }) =>
    e('button', { className: `btn ${className}`, onClick, style }, children);

const Card = ({ title, children, headerAction }) =>

    e('section', { className: 'teachers-section' }, // Reuse existing CSS class for card style

        e('div', { className: 'section-header' },

            e('h3', {}, title),

            headerAction

        ),

        children

    );

const Select = ({ value, onChange, options, style = {} }) =>

    e('select', { value, onChange: (ev) => onChange(ev.target.value), style: { padding: '8px', borderRadius: '4px', border: '1px solid #ddd', ...style } },

        options.map(opt => e('option', { key: opt.value, value: opt.value }, opt.label))

    );

// --- Feature Components ---

const TrimesterSelector = ({ value, onChange }) =>

    e('div', { style: { marginTop: '15px', display: 'flex', alignItems: 'center', gap: '15px', justifyContent: 'center' } },

        e('label', { style: { fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' } }, e(Icon, { name: 'calendar' }), 'الفصل:'),

        e('select', {

            value,

            onChange: (ev) => onChange(ev.target.value),

            style: { padding: '8px 15px', borderRadius: '6px', border: '2px solid var(--secondary-color)', fontSize: '1rem' }

        },

            e('option', { value: '1' }, 'الفصل الأول'),

            e('option', { value: '2' }, 'الفصل الثاني'),

            e('option', { value: '3' }, 'الفصل الثالث'),

            e('option', { value: 'blanc' }, 'الامتحان التجريبي (متوسط)'),

            e('option', { value: 'blanc_lycee' }, 'الامتحان التجريبي (ثانوي)')

        )

    );

const HighlightTrimesterSelector = ({ value, onChange, showReset = false, onReset = null }) =>

    e('div', {
        style: {
            marginTop: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            justifyContent: 'center',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #eff6ff, #f8fafc)',
            border: '1px solid #bfdbfe',
            borderRadius: '14px',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.08)'
        }
    },

        e('label', {
            style: {
                fontWeight: '900',
                color: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                fontSize: '1rem'
            }
        }, e(Icon, { name: 'calendar' }), 'الفصل:'),

        e('div', {
            style: {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                justifyContent: 'center'
            }
        },
            e('select', {

                value,

                onChange: (ev) => onChange(ev.target.value),

                style: {
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: '2px solid #3b82f6',
                    fontSize: '1rem',
                    fontWeight: '800',
                    color: '#0f172a',
                    background: 'var(--card-bg)',
                    minWidth: '240px',
                    boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.08)'
                }

            },

                e('option', { value: '1' }, 'الفصل الأول'),

                e('option', { value: '2' }, 'الفصل الثاني'),

                e('option', { value: '3' }, 'الفصل الثالث'),

                e('option', { value: 'blanc' }, 'الامتحان التجريبي (متوسط)'),

                e('option', { value: 'blanc_lycee' }, 'الامتحان التجريبي (ثانوي)')

            ),
            showReset && e(Button, {
                className: 'btn-warning btn-sm',
                onClick: onReset,
                style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontWeight: '800'
                }
            },
                e(Icon, { name: 'refresh-cw' }),
                'إعادة التعيين'
            )
        )

    );

const TeachersList = ({ teachers, onToggleExemption }) => {

    if (teachers.length === 0) {

        return e('div', { style: { textAlign: 'center', color: '#888', padding: '30px' } },

            'لم يتم إضافة أساتذة بعد. يرجى إضافتهم من صفحة "إدارة الأساتذة".');

    }

    return e('div', { style: { overflowX: 'auto', maxHeight: '300px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' } },

        e('table', { className: 'teachers-table' },

            e('thead', { style: { position: 'sticky', top: 0, zIndex: 5 } },

                e('tr', {},

                    e('th', { width: '5%' }, '#'),

                    e('th', { width: '25%' }, 'اللقب والاسم'),

                    e('th', { width: '30%' }, 'المواد'),

                    e('th', { width: '15%' }, 'إعفاء')

                )

            ),

            e('tbody', {},

                teachers.map((t, i) =>

                    e('tr', { key: t.id },

                        e('td', {}, i + 1),

                        e('td', {}, `${t.surname} ${t.name}`),

                        e('td', {}, t.subjects.map(s => e('span', { key: s, className: 'subject-tag' }, getSubjectLabel(s)))),

                        e('td', { style: { textAlign: 'center' } },

                            e('input', {

                                type: 'checkbox',

                                checked: !!t.isExempt,

                                onChange: (ev) => onToggleExemption(t.id, ev.target.checked),

                                style: { transform: 'scale(1.2)', cursor: 'pointer' }

                            })

                        )

                    )

                )

            )

        )

    );

};

const DayCard = ({ day, onDelete, onUpdate, globalStage }) => {

    const [subjectSlotCounts, setSubjectSlotCounts] = useState(() => ({
        morning: Math.max(3, Array.isArray(day.morning?.subjects) ? day.morning.subjects.length : 0),
        midday: Math.max(3, Array.isArray(day.midday?.subjects) ? day.midday.subjects.length : 0),
        evening: Math.max(3, Array.isArray(day.evening?.subjects) ? day.evening.subjects.length : 0)
    }));

    const updatePeriod = (period, field, val) => {

        const newDay = { ...day, [period]: { ...day[period] } };

        if (field === 'count') newDay[period].requiredTeachers = parseInt(val) || 0;

        else if (field === 'time') newDay[period].time = val;

        else if (field.startsWith('subject')) {

            const idx = parseInt(field.replace('subject', ''));

            const visibleCount = Math.max(3, subjectSlotCounts[period] || 3);
            const subs = [...(newDay[period].subjects || [])];

            while (subs.length < visibleCount) {
                subs.push('');
            }

            subs[idx] = val;

            while (subs.length > 3 && subs[subs.length - 1] === '') {
                subs.pop();
            }

            newDay[period].subjects = subs;

        }

        onUpdate(newDay);

    };

    const addSubjectSlot = (period) => {
        setSubjectSlotCounts(prev => ({
            ...prev,
            [period]: Math.max(3, prev[period] || 3) + 1
        }));
    };

    const removeSubjectSlot = (period) => {
        const nextCount = Math.max(3, (subjectSlotCounts[period] || 3) - 1);
        const newDay = { ...day, [period]: { ...day[period] } };
        newDay[period].subjects = [...(newDay[period].subjects || [])].slice(0, nextCount);
        setSubjectSlotCounts(prev => ({ ...prev, [period]: nextCount }));
        onUpdate(newDay);
    };

    const periodRow = (period, label, labelClass) => {

        const pData = day[period] || {};

        const subjects = pData.subjects || [];

        const visibleSubjectCount = globalStage === 'secondary'
            ? Math.max(3, subjectSlotCounts[period] || subjects.length || 3)
            : 3;

        const currentSubjectsList = globalStage === 'secondary' ? SUBJECTS_LYCEE : SUBJECTS_CEM;

        const count = pData.requiredTeachers !== undefined ? pData.requiredTeachers : 0;

        let defaultTime = '12:00 - 08:00';
        if (period === 'evening') defaultTime = '17:00 - 13:00';
        if (period === 'midday') defaultTime = '13:00 - 11:00';
        const time = pData.time || defaultTime;

        return e('div', { className: 'period-row', style: { flexWrap: 'wrap', gap: '5px', marginTop: period === 'evening' ? '10px' : 0, paddingTop: period === 'evening' ? '10px' : 0, borderTop: period === 'evening' ? '1px dashed #eee' : 'none' } },

            e('div', { style: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },

                e('span', { className: `period-label ${labelClass}` }, label),

                e('div', { style: { display: 'flex', gap: '5px' } },

                    e('input', {

                        type: 'text', value: time,

                        onChange: (ev) => updatePeriod(period, 'time', ev.target.value),

                        style: { width: '110px', padding: '5px', borderRadius: '4px', textAlign: 'center', border: '1px solid #ddd', fontSize: '0.85em', direction: 'ltr' },

                        placeholder: 'التوقيت'

                    }),

                    e('span', { style: { fontSize: '0.75rem', color: '#7f8c8d' } }, 'عدد الحراس'),

                    e('input', {

                        type: 'number', min: 1, max: 200, value: count,

                        onChange: (ev) => updatePeriod(period, 'count', ev.target.value),

                        style: { width: '50px', padding: '5px', borderRadius: '4px', textAlign: 'center', border: '1px solid #ddd' },

                        title: 'عدد الحراس'

                    })

                )

            ),

            e('div', {
                style: {
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: visibleSubjectCount <= 3 ? 'repeat(3, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
                    gap: '6px'
                }
            },
                Array.from({ length: visibleSubjectCount }, (_, idx) =>

                    e('div', {
                        key: idx,
                        style: {
                            borderRadius: '6px',
                            border: `2px solid ${subjects[idx] ? '#16a34a' : '#dc2626'}`,
                            background: subjects[idx] ? '#f0fdf4' : '#fef2f2',
                            boxShadow: `0 0 0 1px ${subjects[idx] ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)'}`,
                            overflow: 'hidden'
                        }
                    },
                        e('select', {

                            value: subjects[idx] || '',

                            onChange: (ev) => updatePeriod(period, `subject${idx}`, ev.target.value),

                            style: {
                                padding: '5px',
                                borderRadius: 0,
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                color: subjects[idx] ? '#166534' : '#991b1b',
                                width: '100%',
                                fontSize: '0.85em',
                                margin: 0,
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                MozAppearance: 'none'
                            }

                        },

                            e('option', { value: '' }, `-- مادة ${idx + 1} --`),

                            currentSubjectsList.map(s => e('option', { key: s, value: s }, s))

                        )
                    )

                )
            ),

            globalStage === 'secondary' && e('div', {
                style: {
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px'
                }
            },
                e('button', {
                    type: 'button',
                    onClick: () => addSubjectSlot(period),
                    style: {
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        color: '#0f172a',
                        borderRadius: '999px',
                        padding: '4px 10px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                    }
                }, '+ إضافة مادة'),
                visibleSubjectCount > 3 && e('button', {
                    type: 'button',
                    onClick: () => removeSubjectSlot(period),
                    style: {
                        border: '1px solid #fecaca',
                        background: '#fff1f2',
                        color: '#b91c1c',
                        borderRadius: '999px',
                        padding: '4px 10px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                    }
                }, 'حذف آخر مادة')
            )

        );

    };

    return e('div', { className: 'day-card', style: { minWidth: '380px' } },

        e('div', { className: 'day-header' },

            e('span', { className: 'day-date', style: { display: 'flex', alignItems: 'center', gap: '5px' } },
                e(Icon, { name: 'calendar' }),
                formatDate(day.date)
            ),

            e(Button, { className: 'btn-danger btn-sm', onClick: () => onDelete(day.id) },
                e(Icon, { name: 'delete' })
            )

        ),

        day.morning && periodRow('morning', e('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, e(Icon, { name: 'sun' }), ' صباح:'), 'morning'),

        day.midday && periodRow('midday', e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('sun') + ' منتصف:' }, style: { color: '#e67e22' } }), 'midday'),

        day.evening && periodRow('evening', e('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, e(Icon, { name: 'moon' }), ' مساء:'), 'evening')

    );

};

const AddDayModal = ({ isOpen, onClose, onAdd }) => {
    if (!isOpen) return null;

    const [date, setDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    });

    const [useThreePeriods, setUseThreePeriods] = useState(false);
    const [hasMorning, setHasMorning] = useState(true);
    const [hasEvening, setHasEvening] = useState(true);
    const [mTime, setMTime] = useState('12:00 - 08:00');
    const [midTime, setMidTime] = useState('13:00 - 11:00');
    const [eTime, setETime] = useState('17:00 - 13:00');

    // Reset times when toggling mode
    useEffect(() => {
        if (useThreePeriods) {
            setMTime('11:00 - 08:00');
            setETime('17:00 - 14:00');
        } else {
            setMTime('12:00 - 08:00');
            setETime('17:00 - 13:00');
        }
    }, [useThreePeriods]);

    const inputGroupStyle = (color) => ({
        position: 'relative',
        marginBottom: '0'
    });

    const labelStyle = (color) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '6px',
        fontWeight: '600',
        fontSize: '0.9rem',
        color: color || '#444'
    });

    const inputStyle = (borderColor) => ({
        width: '100%',
        padding: '11px 14px',
        border: `2px solid ${borderColor || '#e0e0e0'}`,
        borderRadius: '10px',
        fontSize: '0.95rem',
        fontFamily: 'inherit',
        direction: 'ltr',
        transition: 'all 0.3s ease',
        outline: 'none',
        background: '#fafbfc',
        boxSizing: 'border-box'
    });

    const periodCardStyle = (bgColor, borderColor) => ({
        background: bgColor,
        borderRadius: '12px',
        padding: '14px',
        border: `1px solid ${borderColor}`,
        marginBottom: '10px'
    });

    return e('div', { className: 'modal', style: { display: 'block' } },
        e('div', {
            className: 'modal-content', style: {
                maxWidth: '480px',
                borderRadius: '16px',
                padding: '0',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column'
            }
        },
            // Header with gradient
            e('div', {
                style: {
                    background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0
                }
            },
                e('h3', {
                    style: {
                        margin: 0,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '1.15rem',
                        fontWeight: '700'
                    }
                },
                    e('span', {
                        style: {
                            background: 'rgba(255,255,255,0.2)',
                            borderRadius: '10px',
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }, dangerouslySetInnerHTML: { __html: IconManager.get('calendar') }
                    }),
                    'إضافة يوم حراسة'
                ),
                e('span', {
                    onClick: onClose,
                    style: {
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '24px',
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                        lineHeight: '1',
                        fontWeight: '300'
                    },
                    onMouseEnter: (ev) => ev.target.style.color = 'white',
                    onMouseLeave: (ev) => ev.target.style.color = 'rgba(255,255,255,0.7)'
                }, '×')
            ),

            // Body (scrollable)
            e('div', { style: { padding: '24px', overflowY: 'auto', flex: 1 } },
                // Date field
                e('div', { style: { marginBottom: '18px' } },
                    e('label', { style: labelStyle('var(--primary-color)') },
                        e(Icon, { name: 'calendar' }),
                        'تاريخ الامتحان'
                    ),
                    e('input', {
                        type: 'date',
                        value: date,
                        onChange: (ev) => setDate(ev.target.value),
                        style: { ...inputStyle('var(--secondary-color)'), fontWeight: '600' }
                    })
                ),

                // Periods System Selector
                e('div', { style: { marginBottom: '18px' } },
                    e('label', { style: labelStyle('var(--primary-color)') },
                        e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('clock') || '<i class="fas fa-clock"></i>' } }),
                        'نظام الفترات في اليوم'
                    ),
                    e('select', {
                        value: useThreePeriods ? '3' : '2',
                        onChange: (ev) => setUseThreePeriods(ev.target.value === '3'),
                        style: { ...inputStyle('var(--secondary-color)'), fontWeight: '600', cursor: 'pointer' }
                    },
                        e('option', { value: '2' }, 'نظام فترتين (صباح ومساء)'),
                        e('option', { value: '3' }, 'نظام 3 فترات (صباح، منتصف، مساء)')
                    )
                ),

                // Period cards
                // Morning
                hasMorning ? e('div', { style: { ...periodCardStyle('#fffbf0', '#ffe0a6'), position: 'relative' } },
                    e('span', {
                        onClick: () => setHasMorning(false),
                        style: { position: 'absolute', left: '14px', top: '14px', cursor: 'pointer', color: '#e74c3c', fontSize: '1.2rem', lineHeight: '1' },
                        title: 'حذف الفترة'
                    }, '×'),
                    e('label', { style: labelStyle('#e67e22') },
                        e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('sun') } }),
                        'توقيت الصباح'
                    ),
                    e('input', {
                        type: 'text', value: mTime, onChange: (ev) => setMTime(ev.target.value),
                        style: inputStyle('#f0c36d'),
                        placeholder: '12:00 - 08:00'
                    })
                ) : e('div', {
                    onClick: () => setHasMorning(true),
                    style: { ...periodCardStyle('var(--bg-color)', '#ddd'), cursor: 'pointer', textAlign: 'center', color: 'var(--primary-color)', fontWeight: 'bold' }
                }, '+ إضافة فترة الصباح'),

                // Midday (conditional)
                useThreePeriods && e('div', { style: periodCardStyle('#ebf5ff', '#a8d4f5') },
                    e('label', { style: labelStyle('#2980b9') },
                        e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('sun') } }),
                        'توقيت المنتصف'
                    ),
                    e('input', {
                        type: 'text', value: midTime, onChange: (ev) => setMidTime(ev.target.value),
                        style: inputStyle('#7fb3d8'),
                        placeholder: '13:00 - 11:00'
                    })
                ),

                // Evening
                hasEvening ? e('div', { style: { ...periodCardStyle('#f5f0ff', '#d5c4f5'), position: 'relative' } },
                    e('span', {
                        onClick: () => setHasEvening(false),
                        style: { position: 'absolute', left: '14px', top: '14px', cursor: 'pointer', color: '#e74c3c', fontSize: '1.2rem', lineHeight: '1' },
                        title: 'حذف الفترة'
                    }, '×'),
                    e('label', { style: labelStyle('#8e44ad') },
                        e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('moon') } }),
                        'توقيت المساء'
                    ),
                    e('input', {
                        type: 'text', value: eTime, onChange: (ev) => setETime(ev.target.value),
                        style: inputStyle('#b39ddb'),
                        placeholder: '17:00 - 13:00'
                    })
                ) : e('div', {
                    onClick: () => setHasEvening(true),
                    style: { ...periodCardStyle('var(--bg-color)', '#ddd'), cursor: 'pointer', textAlign: 'center', color: 'var(--primary-color)', fontWeight: 'bold' }
                }, '+ إضافة فترة المساء'),

                // Submit button
                e('button', {
                    onClick: () => onAdd(date, mTime, eTime, midTime, useThreePeriods, hasMorning, hasEvening),
                    style: {
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 15px rgba(39, 174, 96, 0.3)',
                        fontFamily: 'inherit',
                        marginTop: '8px'
                    },
                    onMouseEnter: (ev) => {
                        ev.target.style.transform = 'translateY(-2px)';
                        ev.target.style.boxShadow = '0 6px 20px rgba(39, 174, 96, 0.4)';
                    },
                    onMouseLeave: (ev) => {
                        ev.target.style.transform = 'translateY(0)';
                        ev.target.style.boxShadow = '0 4px 15px rgba(39, 174, 96, 0.3)';
                    }
                },
                    e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('check') } }),
                    'إضافة اليوم'
                )
            )
        )
    );
};

const PrintNoteModal = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    const DEFAULT_NOTES = [
        'يُمنع تغيير قاعة أو مكان التأطير إلا بإذن مسبق من الإدارة.',
        'يُمنع السماح بخروج التلاميذ قبل انقضاء ثلاثة أرباع المدة الزمنية للاختبار.',
        'يُمنع على الأستاذ مغادرة قاعة الحراسة بغرض قراءة موضوع الاختبار .'
    ];

    const [notes, setNotes] = useState(DEFAULT_NOTES);
    const [templateType, setTemplateType] = useState(() => localStorage.getItem('printTemplateType') || '1');
    const [loaded, setLoaded] = useState(false);

    // Load saved notes from DB on first open
    useEffect(() => {
        if (isOpen && !loaded) {
            const loadNotes = async () => {
                try {
                    const savedNotes = await DB.get(STORAGE_KEYS.PRINT_NOTES);
                    if (savedNotes && Array.isArray(savedNotes) && savedNotes.length > 0) {
                        setNotes(savedNotes);
                    }
                } catch (err) {
                    console.warn('Could not load saved notes:', err);
                }
                setLoaded(true);
            };
            loadNotes();
        }
    }, [isOpen]);

    const addNote = () => {
        setNotes([...notes, '']);
    };

    const removeNote = (index) => {
        setNotes(notes.filter((_, i) => i !== index));
    };

    const updateNote = (index, value) => {
        const updated = [...notes];
        updated[index] = value;
        setNotes(updated);
    };

    const handleConfirm = async () => {
        const filteredNotes = notes.filter(n => n.trim() !== '');
        // Save notes to DB
        try {
            await DB.set(STORAGE_KEYS.PRINT_NOTES, filteredNotes);
            localStorage.setItem(STORAGE_KEYS.PRINT_NOTES, JSON.stringify(filteredNotes));
        } catch (err) {
            console.warn('Could not save notes:', err);
        }
        localStorage.setItem('printTemplateType', templateType);
        onConfirm(filteredNotes, templateType);
    };

    // Styles
    const modalOverlay = {
        display: 'flex', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        zIndex: 10000, justifyContent: 'center', alignItems: 'center'
    };
    const modalBox = {
        background: '#fff', borderRadius: '16px', width: '95%', maxWidth: '520px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
        animation: 'slideUp 0.3s ease-out'
    };
    const headerStyle = {
        background: 'linear-gradient(135deg, #2c3e50, #34495e)', color: '#fff',
        padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    };
    const bodyStyle = { padding: '25px', maxHeight: '50vh', overflowY: 'auto' };
    const noteRowStyle = {
        display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px',
        background: 'var(--bg-color)', borderRadius: '10px', padding: '10px 12px',
        border: '1px solid #e9ecef', transition: 'all 0.2s'
    };
    const noteInputStyle = {
        flex: 1, border: '1px solid #dee2e6', borderRadius: '8px', padding: '10px 12px',
        fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none',
        transition: 'border-color 0.2s'
    };
    const deleteBtnStyle = {
        background: '#fee2e2', border: 'none', color: '#dc2626', borderRadius: '8px',
        width: '36px', height: '36px', cursor: 'pointer', fontSize: '1.1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s', flexShrink: 0
    };
    const addBtnStyle = {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        width: '100%', padding: '10px', background: '#f0fdf4', border: '2px dashed #86efac',
        borderRadius: '10px', color: '#16a34a', fontWeight: '600', cursor: 'pointer',
        fontSize: '0.95rem', transition: 'all 0.2s', fontFamily: 'inherit'
    };
    const footerStyle = {
        display: 'flex', gap: '10px', justifyContent: 'flex-end',
        padding: '15px 25px', borderTop: '1px solid #f1f5f9', background: '#fafbfc'
    };
    const cancelBtnStyle = {
        padding: '10px 24px', borderRadius: '10px', border: '1px solid var(--border-color)',
        background: '#fff', color: '#64748b', fontWeight: '600', cursor: 'pointer',
        fontSize: '0.95rem', transition: 'all 0.2s', fontFamily: 'inherit'
    };
    const printBtnStyle = {
        padding: '10px 28px', borderRadius: '10px', border: 'none',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
        fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem',
        display: 'flex', alignItems: 'center', gap: '8px',
        transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
        fontFamily: 'inherit'
    };

    return e('div', { style: modalOverlay, onClick: (ev) => { if (ev.target === ev.currentTarget) onClose(); } },
        e('div', { style: modalBox },
            // Header
            e('div', { style: headerStyle },
                e('h3', { style: { margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' } },
                    e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('print') } }),
                    'ملاحظات القصاصات'
                ),
                e('span', {
                    onClick: onClose,
                    style: { cursor: 'pointer', fontSize: '1.5rem', opacity: 0.7, lineHeight: 1 }
                }, 'أ—')
            ),

            // Body
            e('div', { style: bodyStyle },
                // Template Selector
                e('div', { style: { marginBottom: '20px', padding: '15px', background: 'var(--bg-color)', borderRadius: '10px', border: '1px solid #e9ecef' } },
                    e('label', { style: { display: 'block', marginBottom: '10px', fontWeight: '700', color: '#334155', fontSize: '0.95rem' } }, 'تنسيق قسيمة التأطير:'),
                    e('div', { style: { display: 'flex', gap: '20px', flexWrap: 'wrap' } },
                        e('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' } },
                            e('input', {
                                type: 'radio',
                                name: 'printTemplate',
                                value: '1',
                                checked: templateType === '1',
                                onChange: (ev) => setTemplateType(ev.target.value)
                            }),
                            'النموذج 1 (الفترات في أعمدة - افتراضي)'
                        ),
                        e('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' } },
                            e('input', {
                                type: 'radio',
                                name: 'printTemplate',
                                value: '2',
                                checked: templateType === '2',
                                onChange: (ev) => setTemplateType(ev.target.value)
                            }),
                            'النموذج 2 (الأيام في أعمدة)'
                        ),
                        e('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' } },
                            e('input', {
                                type: 'radio',
                                name: 'printTemplate',
                                value: '3',
                                checked: templateType === '3',
                                onChange: (ev) => setTemplateType(ev.target.value)
                            }),
                            'النموذج 3 (رسمي - 3 قصاصات في الصفحة)'
                        )
                    )
                ),

                // Notes section
                e('label', { style: { display: 'block', marginBottom: '10px', fontWeight: '700', color: '#334155', fontSize: '0.95rem' } }, 'الملاحظات أسفل القصاصة:'),

                // Notes list
                notes.map((note, idx) =>
                    e('div', { key: idx, style: noteRowStyle },
                        e('span', { style: { color: '#94a3b8', fontWeight: 'bold', fontSize: '0.85rem', flexShrink: 0 } }, (idx + 1) + '.'),
                        e('input', {
                            type: 'text', value: note,
                            onChange: (ev) => updateNote(idx, ev.target.value),
                            placeholder: 'اكتب ملاحظة...',
                            style: noteInputStyle,
                            onFocus: (ev) => { ev.target.style.borderColor = '#3b82f6'; },
                            onBlur: (ev) => { ev.target.style.borderColor = '#dee2e6'; }
                        }),
                        e('button', {
                            onClick: () => removeNote(idx),
                            style: deleteBtnStyle,
                            title: 'حذف الملاحظة',
                            onMouseEnter: (ev) => { ev.target.style.background = '#fca5a5'; },
                            onMouseLeave: (ev) => { ev.target.style.background = '#fee2e2'; }
                        }, 'أ—')
                    )
                ),

                // Add note button
                e('button', {
                    onClick: addNote,
                    style: addBtnStyle,
                    onMouseEnter: (ev) => { ev.target.style.background = '#dcfce7'; ev.target.style.borderColor = '#4ade80'; },
                    onMouseLeave: (ev) => { ev.target.style.background = '#f0fdf4'; ev.target.style.borderColor = '#86efac'; }
                }, '+ إضافة ملاحظة')
            ),

            // Footer
            e('div', { style: footerStyle },
                e('button', {
                    onClick: onClose, style: cancelBtnStyle,
                    onMouseEnter: (ev) => { ev.target.style.background = '#f1f5f9'; },
                    onMouseLeave: (ev) => { ev.target.style.background = '#fff'; }
                }, 'إلغاء'),
                e('button', {
                    onClick: handleConfirm, style: printBtnStyle,
                    onMouseEnter: (ev) => { ev.target.style.transform = 'translateY(-1px)'; ev.target.style.boxShadow = '0 6px 16px rgba(37,99,235,0.4)'; },
                    onMouseLeave: (ev) => { ev.target.style.transform = 'translateY(0)'; ev.target.style.boxShadow = '0 4px 12px rgba(37,99,235,0.3)'; }
                },
                    e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('print') } }),
                    'طباعة القصاصات'
                )
            )
        )
    );
};

const ScheduleTable = ({ teachers, days, schedule, roomAssignments, showRooms, onToggleAssignment, settings }) => {
    if (!teachers.length || !days.length) {
        return e('div', { id: 'scheduleTableContainer' },
            e('p', { style: { textAlign: 'center', color: '#888', padding: '40px' } },
                'أضف الأساتذة وأيام الحراسة أولاً، ثم اضغط "توليد الجدول تلقائياً"')
        );
    }

    const activeTeachers = teachers.filter(t => !t.isExempt).sort((a, b) => {
        const sA = a.subjects[0] || 'ط²ط²ط²';
        const sB = b.subjects[0] || 'ط²ط²ط²';
        return sA.localeCompare(sB, 'ar');
    });

    return e('div', { className: 'schedule-section', style: { overflowX: 'auto' } },
        e('table', { className: 'schedule-table', id: 'mainScheduleTable' },
            e('thead', {},
                e('tr', {},
                    e('th', { rowSpan: 2 }, '#'),
                    e('th', { rowSpan: 2 }, 'الأستاذ'),
                    days.map(d => {
                        const periods = [];
                        if (d.morning) periods.push('morning');
                        if (d.midday) periods.push('midday');
                        if (d.evening) periods.push('evening');
                        const visiblePeriods = periods.filter(p => {
                            const pData = d[p] || {};
                            const subjectList = (pData.subjects || []).filter(s => s && s.trim() !== '');
                            const hasSub = subjectList.length > 0;
                            const req = pData.requiredTeachers !== undefined ? pData.requiredTeachers : 2;
                            return hasSub || req > 0;
                        });
                        return e('th', { key: d.id, colSpan: visiblePeriods.length, className: 'day-header-cell', style: { display: visiblePeriods.length === 0 ? 'none' : 'table-cell', borderLeft: '3px solid #333' } }, formatDateShort(d.date).full);
                    }),
                    e('th', { rowSpan: 2, className: 'total-col' }, 'المجموع')
                ),
                e('tr', {},
                    days.flatMap(d => {
                        const periods = [];
                        if (d.morning) periods.push('morning');
                        if (d.midday) periods.push('midday');
                        if (d.evening) periods.push('evening');

                        return periods.filter(p => {
                            const pData = d[p] || {};
                            const subjectList = (pData.subjects || []).filter(s => s && s.trim() !== '');
                            const hasSub = subjectList.length > 0;
                            const req = pData.requiredTeachers !== undefined ? pData.requiredTeachers : 2;
                            return hasSub || req > 0;
                        }).map((p, pIndex, filteredPeriods) => {
                            const pData = d[p] || {};
                            const subjectList = (pData.subjects || []).filter(s => s && s.trim() !== '');
                            const subs = subjectList.join(' - ');
                            const count = (schedule[`${d.id}_${p}`] || []).length;
                            const req = pData.requiredTeachers !== undefined ? pData.requiredTeachers : 2;

                            let label = 'ف.صباحية';
                            if (p === 'midday') label = 'ف.منتصف';
                            if (p === 'evening') label = 'ف.مسائية';

                            const isDayEnd = pIndex === filteredPeriods.length - 1;

                            let headerStyle = isDayEnd ? { borderLeft: '3px solid #333' } : {};
                            if (p === 'morning') { headerStyle.backgroundColor = '#fef5e7'; headerStyle.color = '#d35400'; }
                            else if (p === 'midday') { headerStyle.backgroundColor = '#ebf5fb'; headerStyle.color = '#2980b9'; }
                            else { headerStyle.backgroundColor = '#f4ecf7'; headerStyle.color = '#8e44ad'; }

                            return e('th', { key: `${d.id}_${p}`, className: 'period-header', title: subs, style: headerStyle },
                                e('div', {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '1px',
                                        paddingBottom: '3px',
                                        marginBottom: '3px',
                                        borderBottom: '1px solid rgba(0,0,0,0.2)'
                                    }
                                },
                                    e('span', { style: { fontWeight: '800', whiteSpace: 'nowrap' } }, label),
                                    e('span', { style: { fontSize: '0.74em', lineHeight: '1.05' } }, `(${count}/${req})`)
                                ),
                                e('div', { style: { fontSize: '0.7em', fontWeight: 'normal', lineHeight: '1.2' } }, subs || '-')
                            );
                        });
                    })
                )
            ),
            e('tbody', {},
                activeTeachers.map((t, idx) => {
                    let total = 0;
                    return e('tr', { key: t.id },
                        e('td', { style: { textAlign: 'center', fontWeight: 'bold' } }, idx + 1),
                        e('td', { className: 'teacher-name' },
                            t.surname + ' ' + t.name,
                            e('br'),
                            e('small', { style: { color: '#888' } }, t.subjects[0] || '-')
                        ),
                        days.flatMap(d => {
                            const periods = [];
                            if (d.morning) periods.push('morning');
                            if (d.midday) periods.push('midday');
                            if (d.evening) periods.push('evening');

                            return periods.filter(p => {
                                const pData = d[p] || {};
                                const subjectList = (pData.subjects || []).filter(s => s && s.trim() !== '');
                                const hasSub = subjectList.length > 0;
                                const req = pData.requiredTeachers !== undefined ? pData.requiredTeachers : 2;
                                return hasSub || req > 0;
                            }).map((p, pIndex, filteredPeriods) => {
                                const key = `${d.id}_${p}`;
                                const isAssigned = (schedule[key] || []).includes(t.id);
                                if (isAssigned) total++;

                                const pData = d[p] || {};
                                const subjectList = (pData.subjects || []).filter(s => s && s.trim() !== '');
                                const hasSub = subjectList.length > 0;
                                const isActive = hasSub || (pData.requiredTeachers > 0);

                                // Room display logic
                                let cellContent = isAssigned ? (settings.checkMark || '✓') : '';
                                let cellStyle = { textAlign: 'center', cursor: 'pointer' };

                                if (p === 'morning') {
                                    cellStyle.backgroundColor = '#fef5e7';
                                } else if (p === 'midday') {
                                    cellStyle.backgroundColor = '#ebf5fb';
                                } else {
                                    cellStyle.backgroundColor = '#f4ecf7';
                                }

                                // Check for room assignment
                                const roomData = (showRooms && roomAssignments && roomAssignments[key] && roomAssignments[key][t.id]);

                                if (isAssigned) {
                                    if (p === 'morning') {
                                        cellStyle.backgroundColor = '#e67e22';
                                        cellStyle.color = 'var(--card-bg)';
                                    } else if (p === 'midday') {
                                        cellStyle.backgroundColor = 'var(--secondary-color)';
                                        cellStyle.color = 'var(--card-bg)';
                                    } else {
                                        cellStyle.backgroundColor = '#9b59b6';
                                        cellStyle.color = 'var(--card-bg)';
                                    }
                                }

                                if (isAssigned && roomData) {
                                    if (roomData.isReserve) {
                                        cellContent = 'احتياط';
                                        cellStyle.fontWeight = 'bold';
                                        cellStyle.fontSize = '0.8em';
                                        cellStyle.color = '#c0392b';
                                        cellStyle.backgroundColor = '#fadbd8';
                                    } else if (roomData.room) {
                                        cellContent = getLocationLabelShort(roomData.room);
                                        cellStyle.fontWeight = 'bold';
                                        cellStyle.fontSize = '0.9em';
                                        cellStyle.color = '#000000';
                                    }
                                }

                                const isDayEnd = pIndex === filteredPeriods.length - 1;

                                return e('td', {
                                    key: key,
                                    className: `check-cell ${isAssigned ? 'checked' : ''} ${!isActive ? 'disabled' : ''} ${roomData && roomData.room ? 'room-assigned' : ''}`,
                                    style: isDayEnd ? { ...cellStyle, borderLeft: '3px solid #333' } : cellStyle,
                                    onClick: isActive ? () => onToggleAssignment(d.id, p, t.id) : undefined,
                                    title: hasSub ? (d[p]?.subjects || []).join('+') : (isActive ? 'فترة بدون مواد' : 'لا يوجد امتحان')
                                }, cellContent);
                            });
                        }),
                        e('td', { className: 'total-col' }, total)
                    );
                }),
                e('tr', { key: 'total-row', className: 'total-row' },
                    e('td', { colSpan: 2, style: { textAlign: 'right', paddingRight: '15px' } }, 'إجمالي الحراس'),
                    days.flatMap(d => {
                        const periods = [];
                        if (d.morning) periods.push('morning');
                        if (d.midday) periods.push('midday');
                        if (d.evening) periods.push('evening');

                        return periods.filter(p => {
                            const pData = d[p] || {};
                            const subjectList = (pData.subjects || []).filter(s => s && s.trim() !== '');
                            const hasSub = subjectList.length > 0;
                            const req = pData.requiredTeachers !== undefined ? pData.requiredTeachers : 2;
                            return hasSub || req > 0;
                        }).map((p, pIndex, filteredPeriods) => {
                            const isDayEnd = pIndex === filteredPeriods.length - 1;
                            const count = (schedule[`${d.id}_${p}`] || []).length;

                            let totalStyle = isDayEnd ? { borderLeft: '3px solid #333', textAlign: 'center', fontWeight: 'bold' } : { textAlign: 'center', fontWeight: 'bold' };
                            if (p === 'morning') { totalStyle.backgroundColor = '#fef5e7'; totalStyle.color = '#d35400'; }
                            else if (p === 'midday') { totalStyle.backgroundColor = '#ebf5fb'; totalStyle.color = '#2980b9'; }
                            else { totalStyle.backgroundColor = '#f4ecf7'; totalStyle.color = '#8e44ad'; }

                            return e('td', {
                                key: `total_${d.id}_${p}`,
                                style: totalStyle
                            }, count);
                        });
                    }),
                    e('td', { className: 'total-col' }, '')
                )
            )
        )
    );
};

// Floating Totals Component

// Floating Totals Component

// Floating Totals Component

const FloatingTotals = ({ days, schedule }) => {
    if (!days.length) return null;

    const getStatusColor = (assigned, required) => {
        if (required === 0) return '#7f8c8d';
        if (assigned === required) return '#27ae60';
        if (assigned > required) return '#e67e22';
        return '#c0392b';
    };

    return e('div', {
        className: 'floating-totals-bar no-print',
        style: {
            position: 'sticky',
            bottom: '0',
            zIndex: 100,
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            alignItems: 'center',
            background: '#fef9e7',
            borderTop: '3px solid #f39c12',
            padding: '4px 15px',
            boxShadow: '0 -4px 15px rgba(0, 0, 0, 0.15)',
            margin: '0 -20px -20px -20px',
            borderRadius: '0 0 12px 12px',
            fontSize: '0.75rem'
        }
    },
        days.map(d => {
            let mContent = null;
            if (d.morning) {
                const mReq = d.morning.requiredTeachers !== undefined ? Number(d.morning.requiredTeachers) : 2;
                const mAssigned = (schedule[`${d.id}_morning`] || []).length;
                mContent = e('span', { style: { color: '#f39c12', display: 'flex', alignItems: 'center', gap: '3px' } },
                    e(Icon, { name: 'sun' }), e('strong', { style: { color: getStatusColor(mAssigned, mReq) } }, `${mAssigned}/${mReq}`)
                );
            }

            let eContent = null;
            if (d.evening) {
                const eReq = d.evening.requiredTeachers !== undefined ? Number(d.evening.requiredTeachers) : 2;
                const eAssigned = (schedule[`${d.id}_evening`] || []).length;
                eContent = e(React.Fragment, {},
                    (d.morning || d.midday) && e('span', { style: { color: '#ddd' } }, '|'),
                    e('span', { style: { color: '#8e44ad', display: 'flex', alignItems: 'center', gap: '3px' } },
                        e(Icon, { name: 'moon' }), e('strong', { style: { color: getStatusColor(eAssigned, eReq) } }, `${eAssigned}/${eReq}`)
                    )
                );
            }

            let midContent = null;
            if (d.midday) {
                const midReq = d.midday.requiredTeachers !== undefined ? Number(d.midday.requiredTeachers) : 2;
                const midAssigned = (schedule[`${d.id}_midday`] || []).length;
                midContent = e(React.Fragment, {},
                    d.morning && e('span', { style: { color: '#ddd' } }, '|'),
                    e('span', { style: { color: '#e67e22', display: 'flex', alignItems: 'center', gap: '3px' } },
                        e(Icon, { name: 'sun' }), e('strong', { style: { color: getStatusColor(midAssigned, midReq) } }, `${midAssigned}/${midReq}`)
                    )
                );
            }

            return e('div', { key: d.id, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', padding: '2px 5px', background: 'white', borderRadius: '5px', border: '1px solid #ddd', minWidth: '85px' } },
                e('div', { style: { fontWeight: 'bold', color: 'var(--primary-color)', borderBottom: '1px solid #eee', paddingBottom: '1px', width: '100%', textAlign: 'center', fontSize: '0.75rem' } }, formatDateShort(d.date).full),
                e('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' } },

                    mContent,
                    midContent,
                    eContent
                )
            );
        })
    );
};

// ======================

// MAIN APP COMPONENT

// ======================

const App = () => {

    const [teacherDirectory, setTeacherDirectory] = useState([]);

    const [teachers, setTeachers] = useState([]);

    const [days, setDays] = useState([]);

    const [schedule, setSchedule] = useState({});

    const [roomAssignments, setRoomAssignments] = useState({});

    const [trimester, setTrimester] = useState('1');

    const [settings, setSettings] = useState({

        equalDistribution: false,

        maxOnePerDay: false,

        subjectTeachersFirst: false,

        giveRestDay: false,

        teachersPerPeriod: 2,

        numLabs: 0,

        numWorkshops: 0,

        checkMark: '✓'

    });

    const [globalStage, setGlobalStage] = useState('middle'); // Global Education Stage from Settings

    const [isAddDayModalOpen, setIsAddDayModalOpen] = useState(false);
    const [showTeachersTable, setShowTeachersTable] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    const [pendingPrintData, setPendingPrintData] = useState(null);

    const [toast, setToast] = useState(null);
    const [showRooms, setShowRooms] = useState(false);
    const [printOrientation, setPrintOrientation] = useState(() => localStorage.getItem('supervisionPrintOrientation') || 'landscape');

    // Initial Load

    useEffect(() => { if (window.IconManager) { IconManager.render(); IconManager.observe(); } }, []);

    useEffect(() => {
        localStorage.setItem('supervisionPrintOrientation', printOrientation);
    }, [printOrientation]);

    // Helper to load data for a specific trimester
    const loadTrimesterData = async (tri) => {
        const keys = getTrimesterKeys(tri);

        let triDays = await DB.get(keys.DAYS);
        if (!triDays) {
            try { triDays = JSON.parse(localStorage.getItem(keys.DAYS)); } catch (e) { }
        }
        triDays = triDays || [];

        let triSchedule = await DB.get(keys.SCHEDULE);
        if (!triSchedule) {
            try { triSchedule = JSON.parse(localStorage.getItem(keys.SCHEDULE)); } catch (e) { }
        }
        triSchedule = triSchedule || {};

        let triRooms = await DB.get(keys.ROOM_ASSIGNMENTS);
        if (!triRooms) {
            try { triRooms = JSON.parse(localStorage.getItem(keys.ROOM_ASSIGNMENTS)); } catch (e) { }
        }
        triRooms = triRooms || {};

        let triExemptions = await DB.get(keys.EXEMPTIONS);
        if (!triExemptions) {
            try { triExemptions = JSON.parse(localStorage.getItem(keys.EXEMPTIONS)); } catch (e) { }
        }
        triExemptions = Array.isArray(triExemptions) ? triExemptions : [];

        return { days: triDays, schedule: triSchedule, roomAssignments: triRooms, exemptTeacherIds: triExemptions };
    };

    useEffect(() => {

        const load = async () => {

            try {

                // Auth Check
                if (window.Auth) {
                    await window.Auth.checkAuth();
                }

                // Load Data

                if (typeof DB === 'undefined') {

                    showToast('خطأ: قاعدة البيانات غير جاهزة (DB undefined)', 'error');

                    return;

                }

                // Pre-load Room Labels into Global Cache
                try {
                    let periodRoomsData = await DB.get('supervisionPeriodRooms');
                    if (!periodRoomsData) {
                        const saved = localStorage.getItem('supervisionPeriodRooms');
                        if (saved) periodRoomsData = JSON.parse(saved);
                    }
                    if (periodRoomsData) hydrateGlobalRoomCache(periodRoomsData);
                } catch (cacheErr) { console.warn("Failed to load room cache:", cacheErr); }

                // Try to get teachers from DB, fallback to LocalStorage

                let centralTeachers = await DB.getTeachers();

                if (!centralTeachers || centralTeachers.length === 0) {

                    try {

                        const lsTeachers = localStorage.getItem('teachersList');

                        if (lsTeachers) centralTeachers = JSON.parse(lsTeachers);

                    } catch (e) { console.error('LS Load Error', e); }

                }

                centralTeachers = centralTeachers || [];

                let localSettings = await DB.get(STORAGE_KEYS.SETTINGS);

                if (!localSettings) {

                    try {

                        localSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS));

                    } catch (e) { }

                }

                // Load Global Institution Settings for Stage

                let institutionSettings = await DB.get('institutionSettings') || {};

                setGlobalStage(institutionSettings.educationStage || 'middle');

                let localTrimester = await DB.get(STORAGE_KEYS.TRIMESTER) || '1';

                const baseMappedTeachers = centralTeachers.map(t => ({

                    id: t.id,

                    surname: t.last_name || '',

                    name: t.first_name || '',

                    subjects: t.subject ? [t.subject] : []

                }));

                // === Migration: check if per-trimester data exists ===
                const migrationDone = await DB.get('supervisionMigrationDone');
                if (!migrationDone) {
                    // Check for old flat data
                    let oldDays = await DB.get(STORAGE_KEYS.DAYS);
                    if (!oldDays) { try { oldDays = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAYS)); } catch (e) { } }
                    let oldSchedule = await DB.get(STORAGE_KEYS.SCHEDULE);
                    if (!oldSchedule) { try { oldSchedule = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULE)); } catch (e) { } }
                    let oldRooms = await DB.get(STORAGE_KEYS.ROOM_ASSIGNMENTS);
                    if (!oldRooms) { try { oldRooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOM_ASSIGNMENTS)); } catch (e) { } }

                    const hasOldData = (oldDays && oldDays.length > 0) || (oldSchedule && Object.keys(oldSchedule).length > 0);

                    if (hasOldData) {
                        // Ask user which trimester to associate data with
                        const result = await Swal.fire({
                            title: 'ترحيل جدول الحراسة',
                            html: '<p style="font-size:1rem;margin-bottom:10px;">تم تحديث النظام ليدعم <strong>جدول حراسة مستقل لكل فصل</strong>.</p>' +
                                '<p style="font-size:0.95rem;color:#555;">يوجد جدول حراسة سابق. إلى أي فصل تريد ربطه؟</p>',
                            icon: 'question',
                            input: 'select',
                            inputOptions: {
                                '1': 'الفصل الأول',
                                '2': 'الفصل الثاني',
                                '3': 'الفصل الثالث'
                            },
                            inputValue: localTrimester,
                            inputPlaceholder: 'اختر الفصل',
                            showCancelButton: false,
                            confirmButtonText: 'تأكيد',
                            allowOutsideClick: false,
                            allowEscapeKey: false
                        });

                        const chosenTri = result.value || '1';
                        const targetKeys = getTrimesterKeys(chosenTri);

                        if (oldDays && oldDays.length > 0) {
                            await DB.set(targetKeys.DAYS, oldDays);
                            localStorage.setItem(targetKeys.DAYS, JSON.stringify(oldDays));
                        }
                        if (oldSchedule && Object.keys(oldSchedule).length > 0) {
                            await DB.set(targetKeys.SCHEDULE, oldSchedule);
                            localStorage.setItem(targetKeys.SCHEDULE, JSON.stringify(oldSchedule));
                        }
                        if (oldRooms && Object.keys(oldRooms).length > 0) {
                            await DB.set(targetKeys.ROOM_ASSIGNMENTS, oldRooms);
                            localStorage.setItem(targetKeys.ROOM_ASSIGNMENTS, JSON.stringify(oldRooms));
                        }

                        // Update trimester to the chosen one
                        localTrimester = chosenTri;
                        await DB.set(STORAGE_KEYS.TRIMESTER, chosenTri);
                        localStorage.setItem(STORAGE_KEYS.TRIMESTER, chosenTri);

                        const triNames = { '1': 'الفصل الأول', '2': 'الفصل الثاني', '3': 'الفصل الثالث', 'blanc': 'الامتحان التجريبي (متوسط)', 'blanc_lycee': 'الامتحان التجريبي (ثانوي)' };
                        showToast(`تم ربط الجدول بـ ${triNames[chosenTri]} بنجاح`, 'success');
                        console.log(`[Supervision] Migrated flat data to Trimester ${chosenTri}`);
                    }

                    // Mark migration as done (even if no data existed)
                    await DB.set('supervisionMigrationDone', true);
                }

                const exemptionsMigrationDone = await DB.get('supervisionExemptionsMigrationDone');
                if (!exemptionsMigrationDone) {
                    const globallyExemptIds = centralTeachers
                        .filter(t => !!t.isExempt)
                        .map(t => t.id);

                    if (globallyExemptIds.length > 0) {
                        for (const tri of ['1', '2', '3', 'blanc', 'blanc_lycee']) {
                            const exemptionKey = getTrimesterKeys(tri).EXEMPTIONS;
                            await DB.set(exemptionKey, globallyExemptIds);
                            localStorage.setItem(exemptionKey, JSON.stringify(globallyExemptIds));
                        }
                    }

                    await DB.set('supervisionExemptionsMigrationDone', true);
                }

                // Load per-trimester data
                const triData = await loadTrimesterData(localTrimester);

                setTeacherDirectory(baseMappedTeachers);

                setTeachers(applyTrimesterExemptions(baseMappedTeachers, triData.exemptTeacherIds));

                setDays(triData.days);

                setSchedule(triData.schedule);

                if (localSettings) setSettings(prev => ({ ...prev, ...localSettings }));

                setTrimester(localTrimester);
                setRoomAssignments(triData.roomAssignments);

            } catch (err) {

                console.error("Load Error", err);

                showToast('خطأ في تحميل البيانات', 'error');

            }

        };

        load();

    }, []);

    // Persist Helpers - Double Write Strategy (DB + LocalStorage)
    // Days, Schedule, and RoomAssignments are saved per-trimester

    const saveDays = async (newDays) => {

        setDays(newDays);

        const keys = getTrimesterKeys(trimester);
        await DB.set(keys.DAYS, newDays);
        localStorage.setItem(keys.DAYS, JSON.stringify(newDays));

    };

    const saveSchedule = async (newSchedule) => {

        setSchedule(newSchedule);

        const keys = getTrimesterKeys(trimester);
        await DB.set(keys.SCHEDULE, newSchedule);
        localStorage.setItem(keys.SCHEDULE, JSON.stringify(newSchedule));

    };

    const saveRoomAssignments = async (newRooms) => {

        setRoomAssignments(newRooms);

        const keys = getTrimesterKeys(trimester);
        await DB.set(keys.ROOM_ASSIGNMENTS, newRooms);
        localStorage.setItem(keys.ROOM_ASSIGNMENTS, JSON.stringify(newRooms));

    };

    const saveExemptions = async (exemptTeacherIds, targetTrimester = trimester) => {

        const keys = getTrimesterKeys(targetTrimester);
        await DB.set(keys.EXEMPTIONS, exemptTeacherIds);
        localStorage.setItem(keys.EXEMPTIONS, JSON.stringify(exemptTeacherIds));

    };

    const saveSettings = async (newSettings) => {

        setSettings(newSettings);

        await DB.set(STORAGE_KEYS.SETTINGS, newSettings);

        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));

    };

    const showToast = (msg, type = 'success') => {

        const div = document.createElement('div');

        div.className = `toast toast-${type}`;

        div.textContent = msg;

        document.body.appendChild(div);

        setTimeout(() => {

            div.classList.add('show');

            setTimeout(() => {

                div.classList.remove('show');

                setTimeout(() => div.remove(), 300);

            }, 3000);

        }, 10);

    };

    const getDefaultBlancDays = () => ([
        {
            id: new Date('2026-05-03T00:00:00').getTime(),
            date: '2026-05-03',
            morning: { subjects: ['اللغة العربية', 'العلوم الفيزيائية والتكنولوجيا'], requiredTeachers: 0, time: '12:00 - 08:00' },
            evening: { subjects: ['التربية الإسلامية', 'التربية المدنية'], requiredTeachers: 0, time: '16:30 - 14:00' }
        },
        {
            id: new Date('2026-05-04T00:00:00').getTime(),
            date: '2026-05-04',
            morning: { subjects: ['الرياضيات', 'اللغة الإنجليزية'], requiredTeachers: 0, time: '12:00 - 08:00' },
            evening: { subjects: ['التاريخ والجغرافيا'], requiredTeachers: 0, time: '15:30 - 14:00' }
        },
        {
            id: new Date('2026-05-05T00:00:00').getTime(),
            date: '2026-05-05',
            morning: { subjects: ['اللغة الفرنسية', 'العلوم الطبيعية'], requiredTeachers: 0, time: '12:00 - 08:00' },
            evening: { subjects: ['اللغة الأمازيغية'], requiredTeachers: 0, time: '15:30 - 14:00' }
        }
    ]);

    const getDefaultBlancLyceeDays = () => {
        const reqT = 0;
        return [
            { id: new Date('2026-06-07T00:00:00').getTime(), date: '2026-06-07', morning: { subjects: ['اللغة العربية وآدابها'], requiredTeachers: reqT, time: '12:30 - 08:00' }, evening: { subjects: ['العلوم الإسلامية', 'القانون'], requiredTeachers: reqT, time: '15:30 - 13:00' } },
            { id: new Date('2026-06-08T00:00:00').getTime(), date: '2026-06-08', morning: { subjects: ['الرياضيات'], requiredTeachers: reqT, time: '12:30 - 08:00' }, evening: { subjects: ['اللغة الإنجليزية'], requiredTeachers: reqT, time: '16:30 - 13:00' } },
            { id: new Date('2026-06-09T00:00:00').getTime(), date: '2026-06-09', morning: { subjects: ['الفلسفة', 'العلوم الطبيعية', 'التكنولوجيا', 'ت. المحاسبي و المالي'], requiredTeachers: reqT, time: '12:30 - 08:00' }, evening: { subjects: ['اللغة الفرنسية'], requiredTeachers: reqT, time: '16:30 - 13:00' } },
            { id: new Date('2026-06-10T00:00:00').getTime(), date: '2026-06-10', morning: { subjects: ['التاريخ والجغرافيا'], requiredTeachers: reqT, time: '12:30 - 08:00' } },
            { id: new Date('2026-06-11T00:00:00').getTime(), date: '2026-06-11', morning: { subjects: ['العلوم الفيزيائية', 'لغة أجنبية 3'], requiredTeachers: reqT, time: '11:30 - 08:00' }, evening: { subjects: ['الفلسفة'], requiredTeachers: reqT, time: '16:30 - 13:00' } }
        ];
    };

    const createDefaultMockDays = (tri) => {
        if (tri === 'blanc') return getDefaultBlancDays();
        if (tri === 'blanc_lycee') return getDefaultBlancLyceeDays();
        return null;
    };

    const resetMockExamSchedule = async () => {
        if (!['blanc', 'blanc_lycee'].includes(trimester)) return;

        const examLabel = trimester === 'blanc'
            ? 'الامتحان التجريبي (متوسط)'
            : 'الامتحان التجريبي (ثانوي)';

        const result = await Swal.fire({
            icon: 'warning',
            title: 'إعادة تعيين الرزنامة',
            text: `سيتم استرجاع الرزنامة الافتراضية لـ ${examLabel} ومسح التوزيع والقاعات المرتبطة بها. هل تريد المتابعة؟`,
            showCancelButton: true,
            confirmButtonText: 'نعم، إعادة التعيين',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#d97706'
        });

        if (!result.isConfirmed) return;

        const defaultDays = createDefaultMockDays(trimester);
        if (!defaultDays) return;

        const keys = getTrimesterKeys(trimester);
        const emptySchedule = {};
        const emptyRooms = {};

        await DB.set(keys.DAYS, defaultDays);
        await DB.set(keys.SCHEDULE, emptySchedule);
        await DB.set(keys.ROOM_ASSIGNMENTS, emptyRooms);

        localStorage.setItem(keys.DAYS, JSON.stringify(defaultDays));
        localStorage.setItem(keys.SCHEDULE, JSON.stringify(emptySchedule));
        localStorage.setItem(keys.ROOM_ASSIGNMENTS, JSON.stringify(emptyRooms));

        setDays(defaultDays);
        setSchedule(emptySchedule);
        setRoomAssignments(emptyRooms);
        setShowRooms(false);

        showToast(`تمت إعادة تعيين ${examLabel} إلى الرزنامة الافتراضية`, 'success');
    };

    // Actions

    const handleTrimesterChange = async (val) => {

        // Save current trimester indicator
        setTrimester(val);
        await DB.set(STORAGE_KEYS.TRIMESTER, val);
        localStorage.setItem(STORAGE_KEYS.TRIMESTER, val);

        // Load the data for the new trimester
        const triData = await loadTrimesterData(val);

        if (val === 'blanc' && (!triData.days || triData.days.length === 0)) {
            const blancDays = getDefaultBlancDays();
            triData.days = blancDays;
            const keys = getTrimesterKeys('blanc');
            await DB.set(keys.DAYS, blancDays);
            localStorage.setItem(keys.DAYS, JSON.stringify(blancDays));
            setTimeout(() => showToast('تم إنشاء رزنامة الامتحان التجريبي تلقائياً', 'success'), 500);
        }

        if (val === 'blanc_lycee' && (!triData.days || triData.days.length === 0)) {
            const lyceeDays = getDefaultBlancLyceeDays();

            triData.days = lyceeDays;
            const keys = getTrimesterKeys('blanc_lycee');
            await DB.set(keys.DAYS, lyceeDays);
            localStorage.setItem(keys.DAYS, JSON.stringify(lyceeDays));
            setTimeout(() => showToast('تم إنشاء الرزنامة الشاملة لجميع الشعب تلقائياً', 'success'), 500);
        }

        setDays(triData.days);
        setSchedule(triData.schedule);
        setRoomAssignments(triData.roomAssignments);
        const teachersSource = teacherDirectory.length ? teacherDirectory : teachers.map(t => ({
            id: t.id,
            surname: t.surname,
            name: t.name,
            subjects: t.subjects || []
        }));
        setTeachers(applyTrimesterExemptions(teachersSource, triData.exemptTeacherIds));
        setShowRooms(false);

        const trimesterMap = { '1': 'الفصل الأول', '2': 'الفصل الثاني', '3': 'الفصل الثالث', 'blanc': 'الامتحان التجريبي (متوسط)', 'blanc_lycee': 'الامتحان التجريبي (ثانوي)' };
        showToast(`تم التبديل إلى ${trimesterMap[val]}`, 'success');

    };

    const handleToggleExemption = async (tid, isExempt) => {

        const updatedTeachers = teachers.map(t => t.id === tid ? { ...t, isExempt } : t);

        setTeachers(updatedTeachers);

        await saveExemptions(updatedTeachers.filter(t => t.isExempt).map(t => t.id));

        // Remove from schedule if exempt

        if (isExempt) {

            let newSchedule = { ...schedule };

            let changed = false;

            Object.keys(newSchedule).forEach(k => {

                if (newSchedule[k].includes(tid)) {

                    newSchedule[k] = newSchedule[k].filter(id => id !== tid);

                    changed = true;

                }

            });

            if (changed) {

                await saveSchedule(newSchedule);

                showToast('تم إعفاء الأستاذ لهذا الفصل وتحديث الجدول', 'success');

            }

        } else {

            showToast('تم تحديث إعفاء الأستاذ لهذا الفصل', 'success');

        }

    };

    const handleAddDay = async (date, mTime, eTime, midTime, useThreePeriods, hasMorning = true, hasEvening = true) => {

        if (!date) return showToast('اختر التاريخ', 'error');

        if (days.some(d => d.date === date)) return showToast('التاريخ موجود مسبقاً', 'error');

        const newDay = {
            id: Date.now(),
            date
        };
        if (hasMorning) newDay.morning = { subjects: [], requiredTeachers: settings.teachersPerPeriod || 2, time: mTime };
        if (hasEvening) newDay.evening = { subjects: [], requiredTeachers: settings.teachersPerPeriod || 2, time: eTime };

        if (useThreePeriods) {
            newDay.midday = { subjects: [], requiredTeachers: settings.teachersPerPeriod || 2, time: midTime };
        }

        const newDays = [...days, newDay].sort((a, b) => new Date(a.date) - new Date(b.date));

        await saveDays(newDays);

        setIsAddDayModalOpen(false);

        showToast('تم إضافة اليوم');

    };

    const handleDeleteDay = async (id) => {

        const result = await Swal.fire({
            title: 'هل أنت متأكد؟',
            text: "هل تريد حذف هذا اليوم؟",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'نعم، حذف',
            cancelButtonText: 'إلغاء'
        });

        if (!result.isConfirmed) return;

        const newDays = days.filter(d => d.id !== id);

        await saveDays(newDays);

        // Clean schedule

        const newSchedule = { ...schedule };

        Object.keys(newSchedule).forEach(k => {

            if (k.startsWith(`${id}_`)) delete newSchedule[k];

        });

        await saveSchedule(newSchedule);

        showToast('تم الحذف');

    };

    const handleUpdateDay = async (updatedDay) => {

        const newDays = days.map(d => d.id === updatedDay.id ? updatedDay : d);

        await saveDays(newDays);

    };

    // GENERATION ALGORITHM

    const generateSchedule = async () => {

        if (!teachers.length || !days.length) return showToast('البيانات ناقصة', 'error');

        // Validation: Check for periods with subjects but 0 required teachers
        let hasZeroRequiredWithSubjects = false;
        days.forEach(day => {
            ['morning', 'midday', 'evening'].forEach(period => {
                if (day[period]) {
                    const subjects = (day[period].subjects || []).filter(s => s && s.trim() !== '');
                    const required = day[period].requiredTeachers !== undefined ? day[period].requiredTeachers : 0;
                    if (subjects.length > 0 && required <= 0) {
                        hasZeroRequiredWithSubjects = true;
                    }
                }
            });
        });

        if (hasZeroRequiredWithSubjects) {
            Swal.fire({
                icon: 'warning',
                title: 'تنبيه',
                text: 'توجد فترات تحتوي على مواد امتحان ولكن عدد الحراس محدد بـ 0. يرجى تعديل عدد الحراس لكل فترة قبل التوليد.',
                confirmButtonText: 'حسناً',
                confirmButtonColor: '#f39c12'
            });
            return;
        }

        const newSchedule = {};

        const teacherCounts = {};
        const lastAssignedIndex = {};

        // Helper function for unbiased random shuffling
        const shuffleArray = (array) => {
            const arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        };

        teachers.forEach(t => {
            teacherCounts[t.id] = 0;
            lastAssignedIndex[t.id] = -1; // -1 means never assigned
        });

        const dailyAssignments = {};

        const teacherRestDays = {};

        if (settings.giveRestDay && days.length > 1) {

            teachers.forEach((t, i) => {

                teacherRestDays[t.id] = days[i % days.length].id;

            });

        }

        days.forEach((day, currentDayIndex) => {

            dailyAssignments[day.id] = new Set();

            const periods = [];
            if (day.morning) periods.push('morning');
            if (day.midday) periods.push('midday');
            if (day.evening) periods.push('evening');

            periods.forEach((period, periodIndex) => {

                // Calculate a global index for this period representing time distance
                const globalPeriodIndex = currentDayIndex * 3 + periodIndex;

                const key = `${day.id}_${period}`;

                const periodData = day[period];

                const subjects = periodData.subjects || [];

                const required = periodData.requiredTeachers !== undefined ? periodData.requiredTeachers : 2;

                newSchedule[key] = [];

                if (required <= 0) return;

                let candidates = teachers.filter(t => !t.isExempt);

                // Filter Rest Days

                if (settings.giveRestDay) {

                    candidates = candidates.filter(t => teacherRestDays[t.id] !== day.id);

                }

                // Filter One Per Day

                if (settings.maxOnePerDay) {

                    candidates = candidates.filter(t => !dailyAssignments[day.id].has(t.id));

                }

                // Helper for Subject Matching

                const isSubjectMatch = (t) => {

                    // Simplified subject matching logic

                    const tSubs = t.subjects;

                    return subjects.some(s => tSubs.some(ts => ts === s || s.includes(ts) || ts.includes(s)));

                };

                // Use Fisher-Yates for fair unbiased initial shuffling
                candidates = shuffleArray(candidates);

                // Sort: Subject First then Equal Distribution

                // Sort Priorities: Equity > Subject > Spacing
                candidates.sort((a, b) => {
                    // 1. Equal Distribution (Highest Priority)
                    if (settings.equalDistribution) {
                        const countDiff = teacherCounts[a.id] - teacherCounts[b.id];
                        if (countDiff !== 0) {
                            return countDiff; // The one with fewer assignments wins immediately
                        }

                        // Counts are tied. Use Subject Priority as the first tiebreaker if enabled
                        if (settings.subjectTeachersFirst) {
                            const aMatch = isSubjectMatch(a);
                            const bMatch = isSubjectMatch(b);
                            if (aMatch && !bMatch) return -1;
                            if (!aMatch && bMatch) return 1;
                        }

                        // Still tied (or subject priority is disabled). Use long-term spacing
                        return lastAssignedIndex[a.id] - lastAssignedIndex[b.id];
                    }

                    // 2. Subject Priority Only (Equal Distribution Disabled)
                    if (settings.subjectTeachersFirst) {
                        const aMatch = isSubjectMatch(a);
                        const bMatch = isSubjectMatch(b);
                        if (aMatch && !bMatch) return -1;
                        if (!aMatch && bMatch) return 1;
                    }

                    // Fallback to the initial array shuffle order
                    return 0;
                });

                // Pick top N

                const picked = candidates.slice(0, required);

                picked.forEach(t => {

                    newSchedule[key].push(t.id);

                    teacherCounts[t.id]++;
                    lastAssignedIndex[t.id] = globalPeriodIndex;
                    dailyAssignments[day.id].add(t.id);

                });

            });

        });

        await saveSchedule(newSchedule);

        showToast('تم التوليد بنجاح');

    };

    const manuallyToggle = async (dayId, period, tid) => {

        const key = `${dayId}_${period}`;

        const current = schedule[key] || [];

        const isAssigned = current.includes(tid);

        let newIds = [];

        if (isAssigned) {

            newIds = current.filter(id => id !== tid);

        } else {

            // Check constraints if adding

            if (settings.maxOnePerDay) {

                const otherP = period === 'morning' ? 'evening' : 'morning';

                const otherKey = `${dayId}_${otherP}`;

                if ((schedule[otherKey] || []).includes(tid)) {

                    showToast('تنبيه: الأستاذ مكلف بفترة أخرى في نفس اليوم', 'warning');

                    // We allow it but warn, or block? Logic in old code allowed it but warned.

                    // Wait, old code said "return" after warning? "showToast... return;" yes it blocked.

                    return;

                }

            }

            newIds = [...current, tid];

        }

        const newSchedule = { ...schedule, [key]: newIds };

        await saveSchedule(newSchedule);

    };

    const clearSchedule = async () => {

        const result = await Swal.fire({
            title: 'هل أنت متأكد؟',
            text: "هل تريد مسح الجدول والقاعات؟",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'نعم، مسح',
            cancelButtonText: 'إلغاء'
        });

        if (result.isConfirmed) {

            // Clear Schedule (per-trimester)
            await saveSchedule({});

            // Clear Room Assignments (per-trimester)
            await saveRoomAssignments({});

            showToast('تم مسح الجدول والقاعات بنجاح');

        }

    };

    const choosePrintOrientation = async () => {
        const savedOrientation = localStorage.getItem('supervisionPrintOrientation') || 'landscape';

        const result = await Swal.fire({
            title: 'اختيار اتجاه الجدول',
            input: 'radio',
            inputOptions: {
                landscape: 'أفقي',
                portrait: 'عمودي'
            },
            inputValue: savedOrientation,
            confirmButtonText: 'متابعة الطباعة',
            cancelButtonText: 'إلغاء',
            showCancelButton: true,
            inputValidator: (value) => !value ? 'يرجى اختيار اتجاه الجدول' : undefined
        });

        if (!result.isConfirmed || !result.value) {
            return null;
        }

        localStorage.setItem('supervisionPrintOrientation', result.value);
        setPrintOrientation(result.value);
        return result.value;
    };

    const printSchedule = async () => {

        // Trial Mode Check

        const authObj = window.Auth || (typeof Auth !== 'undefined' ? Auth : null);

        const user = authObj && authObj.getUser ? authObj.getUser() : null;

        if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {

            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'طباعة جدول الحراسة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.' });

            return;

        }

        if (!Object.keys(schedule).length) return showToast('الجدول فارغ', 'error');

        const selectedOrientation = await choosePrintOrientation();
        if (!selectedOrientation) return;

        const settingsData = await DB.getSettings() || {};
        const isPortrait = selectedOrientation === 'portrait';
        const pageOrientation = isPortrait ? 'portrait' : 'landscape';

        // Refresh room cache for accurate labels
        try {
            let prd = await DB.get('supervisionPeriodRooms');
            if (!prd) { const s = localStorage.getItem('supervisionPeriodRooms'); if (s) prd = JSON.parse(s); }
            if (prd) hydrateGlobalRoomCache(prd);
        } catch (cacheE) { /* ignore */ }

        const trimesterMap = {
            '1': 'الفصل الأول',
            '2': 'الفصل الثاني',
            '3': 'الفصل الثالث',
            'blanc': 'الامتحان التجريبي (متوسط)',
            'blanc_lycee': 'الامتحان التجريبي (ثانوي)'
        };

        // Generate clean HTML for print based on current DOM state is tricky from React without ref.

        // Better to re-generate strings or reuse the logic.

        // We'll construct the HTML string manually again mirroring the table structure.

        // Quick fix: Use the existing logic from supervision.js ported here.

        const sigSettings = await DB.get('signatureSettings') || {};

        const signatureBlock = window.getSignatureHTML ? window.getSignatureHTML('supervision', sigSettings) : '';

        // Helper to get matching teacher for row
        const activeTeachers = teachers.filter(t => !t.isExempt).sort((a, b) => {
            const sA = a.subjects[0] || 'ط²ط²ط²';
            const sB = b.subjects[0] || 'ط²ط²ط²';
            return sA.localeCompare(sB, 'ar');
        });

        // Helper to check if period is active (matches ScheduleTable logic)
        const isPeriodActive = (day, period) => {
            if (!day[period]) return false;
            const pData = day[period];
            const subjectList = (pData.subjects || []).filter(s => s && s.trim() !== '');
            const hasSub = subjectList.length > 0;
            const req = pData.requiredTeachers !== undefined ? Number(pData.requiredTeachers) : 2;
            return hasSub || req > 0;
        };

        // Pre-calculate active periods for each day
        const dayActivePeriods = {};
        days.forEach(d => {
            const active = [];
            if (d.morning && isPeriodActive(d, 'morning')) active.push('morning');
            if (d.midday && isPeriodActive(d, 'midday')) active.push('midday');
            if (d.evening && isPeriodActive(d, 'evening')) active.push('evening');
            dayActivePeriods[d.id] = active;
        });

        // Filter days that have at least one active period? Or show all days but empty periods?
        // User asked to hide "periods not concerned". So if a day has 0 periods, it might check if we should hide the day too.
        // For now, let's just filter periods. If a day has NO active periods, it will have colspan 0 (which might be an issue).
        // Let's assume if a day is in the list, it's relevant, or we filter days too.

        const activeDays = days.filter(d => dayActivePeriods[d.id].length > 0);

        // Keep subjects on a single line block under the period title in print
        const subjectSeparator = ' - ';

        // Construct Table HTML Manually
        let tableHTML = `
            <table dir="rtl">
                <thead>
                    <tr>
                        <th rowspan="2" width="4%">#</th>
                        <th rowspan="2" width="16%">الأستاذ</th>
                        ${activeDays.map(d => {
            let fd = formatDateShort(d.date);
            return `<th colspan="${dayActivePeriods[d.id].length}" class="day-header-cell">${fd.dayName}<br/><span style="font-size:0.9em;font-weight:normal">${fd.dateFormatted}</span></th>`;
        }).join('')}
                        <th rowspan="2" width="5%" class="total-col">م</th>
                    </tr>
                    <tr>
                        ${activeDays.map(d => {
            return dayActivePeriods[d.id].map(p => {
                const label = p === 'morning' ? 'ف.صباحية' : (p === 'midday' ? 'ف.منتصف' : 'ف.مسائية');
                return `<th class="period-header"><div class="period-header-top">${label}</div><div class="period-header-subjects">${(d[p].subjects || []).join(subjectSeparator)}</div></th>`;
            }).join('');
        }).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        activeTeachers.forEach((t, idx) => {
            let total = 0;
            let cellsHTML = '';

            activeDays.forEach(d => {
                const active = dayActivePeriods[d.id];
                active.forEach(p => {
                    const key = `${d.id}_${p}`;
                    const isAssigned = (schedule[key] || []).includes(t.id);
                    if (isAssigned) total++;

                    let content = '';
                    let style = '';

                    const roomData = (showRooms && roomAssignments && roomAssignments[key] && roomAssignments[key][t.id]);

                    if (isAssigned) {
                        content = settings.checkMark || '✓';
                        style = ''; // Removed background-color: #f0f0f0;

                        // Room Override
                        if (roomData) {
                            if (roomData.isReserve) {
                                content = 'احتياط';
                                style = ' font-weight: bold; font-size: 13px; color: #000 !important;'; // Removed background-color and red color
                            } else if (roomData.room) {
                                content = getLocationLabelShort(roomData.room);
                                style = ' font-weight: bold; font-size: 14px; color: #000000 !important;';
                            }
                        }
                    }

                    cellsHTML += `<td style="${style} text-align: center;">${content}</td>`;
                });
            });

            tableHTML += `
                <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td class="teacher-name">${t.surname} ${t.name}</td>
                    ${cellsHTML}
                    <td style="text-align: center; font-weight: bold;">${total}</td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table>`;
        // const signatureBlock = window.getSignatureHTML ? window.getSignatureHTML('supervision', sigSettings) : ''; // No longer needed as it's directly embedded

        const printContent = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head><title>طباعة</title>
            <style>
                @page { size: A4 ${pageOrientation}; margin: ${isPortrait ? '0.4cm' : '0.5cm'}; }
                body { font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif; direction: rtl; }
                .header { text-align: center; margin-bottom: 20px; }
                .header h3 { font-size: ${isPortrait ? '17px' : '20px'}; font-weight: 800; margin: 0 0 5px; text-decoration: underline; }
                .header p { font-size: ${isPortrait ? '14px' : '16px'}; margin: 0; font-weight: bold; }
                table { width: 100%; border-collapse: collapse; font-size: ${isPortrait ? '10px' : '12px'}; margin-top: 10px; table-layout: fixed; word-wrap: break-word; }
                th, td { border: 1px solid black; padding: ${isPortrait ? '3px 1px' : '4px 2px'}; text-align: center; vertical-align: middle; min-height: 30px; white-space: normal; }
                th { background: var(--card-bg) !important; -webkit-print-color-adjust: exact; font-weight: bold; font-size: ${isPortrait ? '9px' : '11px'}; }
                .period-header { line-height: 1.2; padding: 2px; }
                .period-header-top {
                    display: block;
                    white-space: nowrap;
                    font-weight: 800;
                    padding-bottom: 2px;
                    margin-bottom: 2px;
                    border-bottom: 1px solid #000;
                }
                .period-header-subjects {
                    display: block;
                    font-size: ${isPortrait ? '8px' : '9px'};
                    font-weight: normal;
                    line-height: 1.15;
                }
                .teacher-name { text-align: right; padding-right: 5px; font-weight: bold; font-size: ${isPortrait ? '11px' : '13px'}; white-space: normal; overflow-wrap: anywhere; word-break: break-word; line-height: 1.35; width: ${isPortrait ? '20%' : '18%'}; }
                .footer-container { margin-top: 25px; display: flex; justify-content: space-between; page-break-inside: avoid; font-weight: bold; font-size: ${isPortrait ? '12px' : '14px'}; }
            </style>
            ${PrintToolbarHelper.getHeadContent()}
            </head>
            <body>
            ${PrintToolbarHelper.getToolbarHtml({ advanced: false })}
                <div class="header">
                    <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">الجمهورية الجزائرية الديمقراطية الشعبية</div>
                    <div style="font-weight: bold; font-size: 14px; margin-bottom: 12px;">وزارة التربية الوطنية</div>
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin-bottom: 15px; border-bottom: 1px solid #000; padding-bottom: 10px;">
                        <div style="text-align: right;">
                            <div>ولاية: ${settingsData.wilaya || '..........'}</div>
                            <div>المؤسسة: ${settingsData.institutionName || '..........'}</div>
                        </div>
                        <div style="text-align: left;">
                            السنة الدراسية: ${settingsData.schoolYear || '..........'}
                        </div>
                    </div>
                    <h3>جدول الحراسة - ${trimesterMap[trimester]}</h3>
                </div>
                ${tableHTML}
                <div class="footer-container">
                    <div style="flex: 1;"></div>
                    <div style="text-align: center; width: 300px; font-weight: bold;">
                        <div style="margin-bottom: 5px;">
                            حرر بـ ${settingsData.municipality || '.......'} في <span dir="ltr" style="display: inline-block;">${new Date().toLocaleDateString('fr-FR')}</span>
                        </div>
                        <div style="margin-bottom: ${sigSettings?.enableImage ? '5px' : '40px'}; font-weight: 800; font-size: 16px;">المدير</div>
                        ${sigSettings?.enableImage && sigSettings?.signatureData ? `<img src="${sigSettings.signatureData}" style="max-width: 150px; max-height: 80px;" alt="Signature" />` : ''}
                    </div>
                </div>
            ${PrintToolbarHelper.getScriptHtml({ advanced: false })}
</body>
            </html>
         `;

        const win = window.open('', '_blank');

        win.document.write(printContent);

        win.document.close();

        win.focus();

        // auto-print removed

    };

    const printStrips = async () => {

        try {

            // Trial Mode Check

            const authObj = window.Auth || (typeof Auth !== 'undefined' ? Auth : null);

            const user = authObj && authObj.getUser ? authObj.getUser() : null;

            if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {

                Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'طباعة القصاصات غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.' });

                return;

            }

            if (!Object.keys(schedule).length) return showToast('الجدول فارغ', 'error');

            const settingsData = await DB.getSettings() || {};

            // Find assigned teachers with robust checks
            // Refresh room cache for accurate labels
            try {
                let prd = await DB.get('supervisionPeriodRooms');
                if (!prd) { const s = localStorage.getItem('supervisionPeriodRooms'); if (s) prd = JSON.parse(s); }
                if (prd) hydrateGlobalRoomCache(prd);
            } catch (cacheE) { /* ignore */ }

            const assignedTeachers = teachers.filter(t => {

                return Object.values(schedule).some(assignments =>

                    Array.isArray(assignments) && assignments.includes(t.id)

                );

            }).map(t => {

                // Get duties

                const duties = days.flatMap(d => {
                    const dayDuties = [];
                    const mTime = d.morning?.time || '08:00 - 12:00';
                    const midTime = d.midday?.time || '11:00 - 13:00';
                    const eTime = d.evening?.time || '13:00 - 17:00';

                    const getRoom = (key) => {
                        if (!showRooms) return null;
                        const ra = roomAssignments && roomAssignments[key] && roomAssignments[key][t.id];
                        if (!ra) return null;
                        if (ra.isReserve) return { label: 'احتياط', isReserve: true };
                        if (ra.room) return { label: getLocationLabelShort(ra.room), isReserve: false };
                        return null;
                    };

                    if (Array.isArray(schedule[`${d.id}_morning`]) && schedule[`${d.id}_morning`].includes(t.id)) {
                        dayDuties.push({ date: d.date, period: 'صباح', time: mTime, room: getRoom(`${d.id}_morning`) });
                    }
                    if (Array.isArray(schedule[`${d.id}_midday`]) && schedule[`${d.id}_midday`].includes(t.id)) {
                        dayDuties.push({ date: d.date, period: 'منتصف', time: midTime, room: getRoom(`${d.id}_midday`) });
                    }
                    if (Array.isArray(schedule[`${d.id}_evening`]) && schedule[`${d.id}_evening`].includes(t.id)) {
                        dayDuties.push({ date: d.date, period: 'مساء', time: eTime, room: getRoom(`${d.id}_evening`) });
                    }
                    return dayDuties;
                });

                return { ...t, duties };

            });

            if (assignedTeachers.length === 0) return showToast('لا يوجد أساتذة معينين', 'error');

            setPendingPrintData({ assignedTeachers, settingsData });

            setIsPrintModalOpen(true);

        } catch (error) {

            console.error('Print Prep Error:', error);

            showToast('حدث خطأ أثناء التجهيز للطباعة: ' + error.message, 'error');

        }

    };

    const exportScheduleToExcel = async () => {

        try {

            if (!window.ExcelExportHelper) return showToast('ميزة تصدير Excel غير جاهزة حالياً', 'error');

            if (!Object.keys(schedule).length) return showToast('الجدول فارغ', 'error');

            const settingsData = await DB.getSettings() || {};

            try {
                let prd = await DB.get('supervisionPeriodRooms');
                if (!prd) {
                    const savedRooms = localStorage.getItem('supervisionPeriodRooms');
                    if (savedRooms) prd = JSON.parse(savedRooms);
                }
                if (prd) hydrateGlobalRoomCache(prd);
            } catch (cacheError) {
                console.warn('Room cache refresh error:', cacheError);
            }

            const isPeriodActive = (day, period) => {
                if (!day || !day[period]) return false;
                const periodData = day[period];
                const subjects = (periodData.subjects || []).filter(subject => subject && subject.trim() !== '');
                const requiredTeachers = periodData.requiredTeachers !== undefined ? Number(periodData.requiredTeachers) : 2;
                return subjects.length > 0 || requiredTeachers > 0;
            };

            const activeDays = days.filter((day) => {
                return ['morning', 'midday', 'evening'].some((period) => isPeriodActive(day, period));
            });

            const activeTeachers = teachers
                .filter((teacher) => !teacher.isExempt)
                .sort((a, b) => {
                    const subjectA = (a.subjects && a.subjects[0]) ? a.subjects[0] : 'ززز';
                    const subjectB = (b.subjects && b.subjects[0]) ? b.subjects[0] : 'ززز';
                    return subjectA.localeCompare(subjectB, 'ar');
                });

            if (!activeDays.length || !activeTeachers.length) {
                return showToast('لا توجد بيانات صالحة للتصدير', 'error');
            }

            const headers = ['#', 'الأستاذ', 'المادة'];
            activeDays.forEach((day) => {
                ['morning', 'midday', 'evening'].forEach((period) => {
                    if (!isPeriodActive(day, period)) return;
                    const formattedDate = formatDateShort(day.date);
                    headers.push(`${formattedDate.dayName} ${formattedDate.dateFormatted} - ${getSupervisionPeriodShortLabel(period)}`);
                });
            });
            headers.push('المجموع');

            const rows = activeTeachers.map((teacher, index) => {
                const row = [
                    index + 1,
                    `${teacher.surname || ''} ${teacher.name || ''}`.trim(),
                    (teacher.subjects && teacher.subjects[0]) || '-'
                ];

                let totalAssignments = 0;

                activeDays.forEach((day) => {
                    ['morning', 'midday', 'evening'].forEach((period) => {
                        if (!isPeriodActive(day, period)) return;

                        const key = `${day.id}_${period}`;
                        const isAssigned = Array.isArray(schedule[key]) && schedule[key].includes(teacher.id);
                        let value = '';

                        if (isAssigned) {
                            totalAssignments += 1;
                            const roomData = roomAssignments && roomAssignments[key] && roomAssignments[key][teacher.id];
                            if (roomData && roomData.isReserve) {
                                value = 'احتياط';
                            } else if (roomData && roomData.room) {
                                value = getLocationLabelShort(roomData.room) || '';
                            } else {
                                value = settings.checkMark || '✓';
                            }
                        }

                        row.push(value);
                    });
                });

                row.push(totalAssignments);
                return row;
            });

            await window.ExcelExportHelper.exportWorkbook({
                fileName: `جدول_الحراسة_${window.ExcelExportHelper.dateStamp()}.xlsx`,
                sheets: [{
                    sheetName: 'جدول الحراسة',
                    title: 'جدول الحراسة',
                    metaRows: [
                        `السنة الدراسية: ${settingsData.schoolYear || ''} | المؤسسة: ${settingsData.institutionName || ''}`,
                        `الفصل: ${getSupervisionTrimesterLabel(trimester)}`,
                        `الإحصائيات: عدد الأساتذة ${activeTeachers.length} | عدد الأيام ${activeDays.length} | الخانات النشطة ${headers.length - 4}`
                    ],
                    headers: headers,
                    rows: rows
                }]
            });

        } catch (error) {

            console.error('Export Schedule Error:', error);
            showToast('حدث خطأ أثناء تصدير الجدول: ' + error.message, 'error');

        }

    };

    const executePrint = (customNotes, templateType = '1') => {

        setIsPrintModalOpen(false);

        if (!pendingPrintData) return;

        // Normalize notes
        if (!Array.isArray(customNotes)) customNotes = [customNotes || ''];

        const { assignedTeachers, settingsData } = pendingPrintData;

        const trimesterMap = {
            '1': 'الفصل الأول',
            '2': 'الفصل الثاني',
            '3': 'الفصل الثالث',
            'blanc': 'الامتحان التجريبي (متوسط)',
            'blanc_lycee': 'الامتحان التجريبي (ثانوي)'
        };
        const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

        const notesHtml = customNotes.filter(n => n && n.trim()).length > 0
            ? customNotes.filter(n => n && n.trim()).map(n => '<div style="margin-bottom: 1px;">* ' + n + '</div>').join('')
            : '';
        const cleanNotes = customNotes.filter(n => n && n.trim());
        const escapeHtml = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        if (templateType === '3') {
            try {
                const mark = settings.checkMark || '✓';
                const issueDate = new Date().toLocaleDateString('ar-DZ');

                const buildTeacherDutyData = (teacher) => {
                    const dutyMap = {};
                    const allDates = [];

                    teacher.duties.forEach((duty) => {
                        if (!dutyMap[duty.date]) {
                            dutyMap[duty.date] = {};
                            allDates.push(duty.date);
                        }
                        dutyMap[duty.date][duty.period] = { time: duty.time, room: duty.room };
                    });

                    const periodDefs = [
                        {
                            key: 'صباح',
                            label: 'ف.صباحية',
                            time: ''
                        },
                        {
                            key: 'منتصف',
                            label: 'ف.منتصف',
                            time: ''
                        },
                        {
                            key: 'مساء',
                            label: 'ف.مسائية',
                            time: ''
                        }
                    ].filter((period) => teacher.duties.some((d) => d.period === period.key));

                    const getCellContent = (date, period) => {
                        const entry = dutyMap[date] && dutyMap[date][period];
                        if (!entry) return '';
                        if (entry.room) return escapeHtml(entry.room.label);
                        return escapeHtml(mark);
                    };

                    return { allDates, periodDefs, getCellContent };
                };

                const buildFormalTable = (teacherData) => {
                    const { allDates, periodDefs, getCellContent } = teacherData;
                    let headerCols = '<th class="formal-corner">الفترة / اليوم</th>';

                    allDates.forEach((date) => {
                        const formatted = formatDateShort(date);
                        headerCols += '<th><div class="formal-day-name">' + escapeHtml(formatted.dayName) + '</div><div class="formal-day-date">' + escapeHtml(formatted.dateFormatted) + '</div></th>';
                    });

                    const rows = periodDefs.map((period) => {
                        let cells = '<td class="formal-period-cell"><div>' + escapeHtml(period.label) + '</div>';
                        cells += '</td>';

                        allDates.forEach((date) => {
                            cells += '<td class="formal-check-cell">' + getCellContent(date, period.key) + '</td>';
                        });

                        return '<tr>' + cells + '</tr>';
                    }).join('');

                    return '<table class="formal-table"><thead><tr>' + headerCols + '</tr></thead><tbody>' + rows + '</tbody></table>';
                };

                const buildFormalStrip = (teacher) => {
                    const teacherData = buildTeacherDutyData(teacher);
                    const tableHtml = buildFormalTable(teacherData);
                    const subjectText = teacher.subjects && teacher.subjects.length > 0
                        ? teacher.subjects.join(' - ')
                        : 'غير محددة';
                    const noteListHtml = cleanNotes.length > 0
                        ? '<ul class="formal-notes-list">' + cleanNotes.map((note) => '<li>' + escapeHtml(note) + '</li>').join('') + '</ul>'
                        : '<div class="formal-empty-note">لا توجد ملاحظات إضافية.</div>';

                    return `
                    <section class="strip formal-strip">
                        <div class="formal-header">
                            <div class="formal-country">الجمهورية الجزائرية الديمقراطية الشعبية</div>
                            <div class="formal-ministry">وزارة التربية الوطنية</div>
                        </div>

                        <div class="formal-meta-row">
                            <div class="formal-meta-item formal-meta-school">المؤسسة: ${escapeHtml(settingsData.institutionName || '........................')}</div>
                            <div class="formal-meta-item formal-meta-year">السنة الدراسية: ${escapeHtml(settingsData.schoolYear || '........................')}</div>
                        </div>

                        <div class="formal-title-block">
                            <div class="formal-title">استدعاء الأستاذ للحراسة</div>
                            <div class="formal-title-sub">${escapeHtml(trimesterMap[trimester] || '')}</div>
                        </div>

                        <div class="formal-teacher-row">
                            <div class="formal-teacher-name">الأستاذ(ة): ${escapeHtml((teacher.surname || '') + ' ' + (teacher.name || ''))}</div>
                            <div class="formal-teacher-subject">المادة: ${escapeHtml(subjectText)}</div>
                        </div>

                        ${tableHtml}

                        <div class="formal-footer">
                            <div class="formal-notes-box">
                                <div class="formal-footer-title">ملاحظات</div>
                                ${noteListHtml}
                            </div>
                            <div class="formal-signature-box">
                                <div class="formal-issue-line">حرر بـ: ${escapeHtml(settingsData.municipality || '................')}</div>
                                <div class="formal-issue-line">في: ${escapeHtml(issueDate)}</div>
                                <div class="formal-signature-line">الإمضاء: ........................</div>
                            </div>
                        </div>
                    </section>
                    `;
                };

                const stripsHtml = Array.from({ length: Math.ceil(assignedTeachers.length / 3) }, (_, pageIndex) => {
                    const pageTeachers = assignedTeachers.slice(pageIndex * 3, pageIndex * 3 + 3);
                    return '<div class="formal-page">' + pageTeachers.map(buildFormalStrip).join('') + '</div>';
                }).join('');

                const printContent = `
                <!DOCTYPE html>
                <html dir="rtl">
                <head><title>طباعة القصاصات</title>
                <style>
                    @page { size: A4 portrait; margin: 0.8cm; }
                    body { font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif; direction: rtl; margin: 0; padding: 0; color: #000; background: #fff; }
                    .formal-page {
                        min-height: calc(29.7cm - 1.6cm);
                        display: flex;
                        flex-direction: column;
                        gap: 0.28cm;
                        page-break-after: always;
                    }
                    .formal-page:last-child { page-break-after: auto; }
                    .formal-strip {
                        flex: 1 1 0;
                        border: 1.4px solid #000;
                        padding: 0.22cm 0.28cm;
                        display: flex;
                        flex-direction: column;
                        page-break-inside: avoid;
                        box-sizing: border-box;
                    }
                    .formal-header {
                        text-align: center;
                        border-bottom: 1px solid #000;
                        padding-bottom: 0.08cm;
                        margin-bottom: 0.12cm;
                    }
                    .formal-country,
                    .formal-ministry {
                        font-weight: 700;
                        font-size: 10.5px;
                        line-height: 1.25;
                    }
                    .formal-meta-row {
                        display: flex;
                        justify-content: space-between;
                        gap: 0.25cm;
                        margin-bottom: 0.12cm;
                        font-size: 9.6px;
                        font-weight: 700;
                    }
                    .formal-meta-item { width: 50%; }
                    .formal-meta-school { text-align: right; }
                    .formal-meta-year { text-align: left; }
                    .formal-title-block {
                        text-align: center;
                        margin-bottom: 0.12cm;
                    }
                    .formal-title {
                        font-size: 11px;
                        font-weight: 800;
                        text-decoration: underline;
                        margin-bottom: 0.02cm;
                    }
                    .formal-title-sub {
                        font-size: 9px;
                        font-weight: 700;
                    }
                    .formal-teacher-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 0.2cm;
                        border: 1px solid #000;
                        padding: 0.08cm 0.12cm;
                        margin-bottom: 0.12cm;
                        font-size: 9.6px;
                        font-weight: 700;
                    }
                    .formal-teacher-name,
                    .formal-teacher-subject { width: 50%; }
                    .formal-teacher-name { text-align: right; }
                    .formal-teacher-subject { text-align: left; }
                    .formal-table {
                        width: 100%;
                        border-collapse: collapse;
                        table-layout: fixed;
                        font-size: 9.1px;
                        margin-bottom: 0.12cm;
                    }
                    .formal-table th,
                    .formal-table td {
                        border: 1px solid #000;
                        padding: 0.05cm 0.06cm;
                        text-align: center;
                        vertical-align: middle;
                        color: #000;
                    }
                    .formal-table th {
                        font-weight: 800;
                        background: #f5f5f5 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .formal-corner { width: 22%; }
                    .formal-day-name {
                        font-weight: 800;
                        line-height: 1.1;
                    }
                    .formal-day-date {
                        font-size: 8px;
                        font-weight: 600;
                        margin-top: 1px;
                    }
                    .formal-period-cell {
                        font-weight: 800;
                        font-size: 8.8px;
                    }
                    .formal-period-time {
                        font-size: 7.6px;
                        font-weight: 600;
                        margin-top: 1px;
                    }
                    .formal-check-cell {
                        font-weight: 800;
                        font-size: 10px;
                    }
                    .formal-footer {
                        margin-top: auto;
                        display: flex;
                        gap: 0.22cm;
                        align-items: stretch;
                    }
                    .formal-notes-box,
                    .formal-signature-box {
                        border: 1px solid #000;
                        padding: 0.1cm 0.14cm;
                        min-height: 1.65cm;
                        box-sizing: border-box;
                    }
                    .formal-notes-box { flex: 1.45; }
                    .formal-signature-box {
                        width: 34%;
                        text-align: center;
                    }
                    .formal-footer-title {
                        font-weight: 800;
                        font-size: 9px;
                        margin-bottom: 0.08cm;
                        border-bottom: 1px solid #000;
                        padding-bottom: 0.03cm;
                    }
                    .formal-notes-list {
                        margin: 0;
                        padding: 0 0.35cm 0 0;
                        font-size: 7.9px;
                        line-height: 1.35;
                    }
                    .formal-notes-list li { margin-bottom: 0.03cm; }
                    .formal-empty-note {
                        font-size: 8px;
                        color: #444;
                        text-align: right;
                        padding-top: 0.12cm;
                    }
                    .formal-issue-line {
                        font-size: 8.3px;
                        font-weight: 700;
                        margin-bottom: 0.09cm;
                        text-align: center;
                    }
                    .formal-signature-line {
                        margin-top: 0.22cm;
                        font-size: 8.5px;
                        font-weight: 800;
                    }
                </style>
                ${PrintToolbarHelper.getHeadContent()}
                </head>
                <body>
                ${PrintToolbarHelper.getToolbarHtml({ advanced: false })}
                    ${stripsHtml}
                ${PrintToolbarHelper.getScriptHtml({ advanced: false })}
                </body>
                </html>
                `;

                const win = window.open('', '_blank');

                if (!win) {
                    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.' });
                    return;
                }

                win.document.write(printContent);
                win.document.close();
                win.focus();
                return;
            } catch (error) {
                console.error('Formal Print Execute Error:', error);
                showToast('حدث خطأ أثناء الطباعة: ' + error.message, 'error');
                return;
            }
        }

        try {

            const stripsHtml = assignedTeachers.map(t => {
                // Group duties by date
                const dutyMap = {};
                const allDates = [];
                // Store room info per date+period for this teacher
                t.duties.forEach(d => {
                    if (!dutyMap[d.date]) {
                        dutyMap[d.date] = {};
                        allDates.push(d.date);
                    }
                    dutyMap[d.date][d.period] = { time: d.time, room: d.room };
                });

                // Determine which periods exist
                const hasMorning = t.duties.some(d => d.period === 'صباح');
                const hasMidday = t.duties.some(d => d.period === 'منتصف');
                const hasEvening = t.duties.some(d => d.period === 'مساء');

                const mark = settings.checkMark || '✓';
                // Helper to get cell content
                const getCellContent = (date, period) => {
                    const entry = dutyMap[date] && dutyMap[date][period];
                    if (!entry) return '';
                    if (entry.room) return entry.room.label;
                    return mark;
                };

                let headerCols = '';
                let rows = '';

                if (templateType === '2') {
                    // Template 2: Days in columns, Periods in rows
                    headerCols = '<th class="col-date">الفترة / اليوم</th>';
                    allDates.forEach(date => {
                        let fd = formatDateShort(date);
                        headerCols += '<th style="min-width: 65px;">' + fd.dayName + '<br>' + fd.dateFormatted + '</th>';
                    });

                    const buildPeriodRow = (periodLabel) => {
                        let rowStr = '<td class="date-cell" style="text-align: center;">' + periodLabel + '</td>';
                        allDates.forEach(date => {
                            const lookupPeriod = periodLabel === 'ف.صباحية' ? 'صباح' : (periodLabel === 'ف.منتصف' ? 'منتصف' : 'مساء');
                            rowStr += '<td class="check-cell">' + getCellContent(date, lookupPeriod) + '</td>';
                        });
                        return '<tr>' + rowStr + '</tr>';
                    };

                    const mappedRows = [];
                    if (hasMorning) mappedRows.push(buildPeriodRow('ف.صباحية'));
                    if (hasMidday) mappedRows.push(buildPeriodRow('ف.منتصف'));
                    if (hasEvening) mappedRows.push(buildPeriodRow('ف.مسائية'));
                    rows = mappedRows.join('');
                } else {
                    // Build header columns
                    headerCols = '<th class="col-date">اليوم والتاريخ</th>';
                    if (hasMorning) headerCols += '<th>ف.صباحية</th>';
                    if (hasMidday) headerCols += '<th>ف.منتصف</th>';
                    if (hasEvening) headerCols += '<th>ف.مسائية</th>';

                    rows = allDates.map(date => {
                        let fd = formatDateShort(date);
                        let cols = '<td class="date-cell">' + fd.dayName + ' ' + fd.dateFormatted + '</td>';
                        if (hasMorning) cols += '<td class="check-cell">' + getCellContent(date, 'صباح') + '</td>';
                        if (hasMidday) cols += '<td class="check-cell">' + getCellContent(date, 'منتصف') + '</td>';
                        if (hasEvening) cols += '<td class="check-cell">' + getCellContent(date, 'مساء') + '</td>';
                        return '<tr>' + cols + '</tr>';
                    }).join('');
                }

                return `
                <div class="strip">
                    <div class="strip-header">
                        <span class="inst-name">${settingsData.institutionName || 'المؤسسة التربوية'}</span>
                        <span class="sep">|</span>
                        <span class="trim-info">استدعاء حراسة - ${trimesterMap[trimester]}</span>
                        <span class="sep">|</span>
                        <span class="teacher-name">الأستاذ(ة): <strong>${t.surname} ${t.name}</strong></span>
                    </div>
                    <table>
                        <thead><tr>${headerCols}</tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    ${notesHtml ? '<div class="strip-footer">' + notesHtml + '</div>' : ''}
                    <div class="signature">الإمضاء:</div>
                </div>
                `;
            }).join('');

            const printContent = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head><title>طباعة القصاصات</title>
            <style>
                @page { size: A4 portrait; margin: 0.7cm; }
                body { font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif; direction: rtl; margin: 0; padding: 0; color: #000; }
                .strip {
                    border: 1.5px dashed #444;
                    padding: 6px 10px;
                    margin-bottom: 10px;
                    page-break-inside: avoid;
                }
                .strip-header {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                    padding-bottom: 4px;
                    margin-bottom: 5px;
                    border-bottom: 1px solid #ccc;
                    font-size: 11px;
                    color: #000;
                }
                .strip-header .inst-name { font-weight: bold; }
                .strip-header .sep { color: #999; }
                .strip-header .trim-info { color: #000; }
                .strip-header .teacher-name { color: #000; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px; }
                th, td { border: 1px solid #999; padding: 3px 5px; text-align: center; color: #000; }
                th { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; font-size: 11px; }
                .time-hint { font-size: 8px; font-weight: normal; color: #000; }
                .col-date { width: 40%; }
                .date-cell { font-weight: bold; text-align: right; padding: 2px 8px; font-size: 11px; }
                .check-cell { font-weight: bold; font-size: 14px; color: #000; }
                .strip-footer {
                    font-size: 8px;
                    color: #000;
                    font-style: italic;
                    text-align: right;
                    border-top: 1px dotted #ccc;
                    padding-top: 2px;
                }
                .signature {
                    text-align: left;
                    font-size: 10px;
                    margin-top: 4px;
                    color: #000;
                }
            </style>
            ${PrintToolbarHelper.getHeadContent()}
            </head>
            <body>
            ${PrintToolbarHelper.getToolbarHtml({ advanced: false })}
                ${stripsHtml}
            ${PrintToolbarHelper.getScriptHtml({ advanced: false })}
            </body>
            </html>
            `;

            const win = window.open('', '_blank');

            if (!win) {

                Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.' });

                return;

            }

            win.document.write(printContent);

            win.document.close();

            win.focus();

            // auto-print removed

        } catch (error) {

            console.error('Print Execute Error:', error);

            showToast('حدث خطأ أثناء الطباعة: ' + error.message, 'error');

        }

    };

    return e('div', { className: 'container supervision-container', style: { paddingBottom: '70px' } },

        e('div', {
            className: 'no-print',
            style: {
                marginBottom: '20px',
                padding: '16px 18px',
                background: 'linear-gradient(135deg, #eff6ff, #f8fafc)',
                border: '1px solid #bfdbfe',
                borderRadius: '16px',
                boxShadow: '0 8px 20px rgba(37, 99, 235, 0.08)'
            }
        },
            e('div', {
                style: {
                    fontWeight: '900',
                    color: '#1d4ed8',
                    marginBottom: '8px',
                    textAlign: 'center',
                    fontSize: '1rem'
                }
            }, 'اختيار الفصل'),
            e('div', {
                style: {
                    textAlign: 'center',
                    color: '#475569',
                    marginBottom: '6px',
                    fontSize: '0.9rem'
                }
            }, 'الإعفاءات، الأيام، وجدول الحراسة تخص الفصل المحدد هنا'),
            e(HighlightTrimesterSelector, {
                value: trimester,
                onChange: handleTrimesterChange,
                showReset: ['blanc', 'blanc_lycee'].includes(trimester),
                onReset: resetMockExamSchedule
            })
        ),

        e(Card, {
            title: e('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('teacher') } }),
                'إدارة الأساتذة (الإعفاءات)'
            ),
            headerAction: e(Button, {
                className: showTeachersTable ? 'btn-secondary btn-sm' : 'btn-primary btn-sm',
                onClick: () => setShowTeachersTable(!showTeachersTable),
                style: { display: 'flex', alignItems: 'center', gap: '5px' }
            },
                e('span', { dangerouslySetInnerHTML: { __html: IconManager.get(showTeachersTable ? 'eye-off' : 'eye') || (showTeachersTable ? 'Hide' : 'Show') } }),
                showTeachersTable ? 'إخفاء الجدول' : 'إظهار جدول الأساتذة'
            )
        },
            showTeachersTable && e(TeachersList, { teachers, onToggleExemption: handleToggleExemption }),
            e('div', {
                className: 'no-print',
                style: {
                    marginTop: '14px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color)',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                }
            }, `الإعفاءات الظاهرة تخص ${(() => {
                const trimesterMap = {
                    '1': 'الفصل الأول',
                    '2': 'الفصل الثاني',
                    '3': 'الفصل الثالث',
                    'blanc': 'الامتحان التجريبي (متوسط)',
                    'blanc_lycee': 'الامتحان التجريبي (ثانوي)'
                };
                return trimesterMap[trimester] || 'الفصل المحدد';
            })()}`)
        ),

        e(Card, {

            title: e('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, e(Icon, { name: 'calendar' }), 'أيام الحراسة'),

            headerAction: e(Button, { className: 'btn-primary btn-sm', onClick: () => setIsAddDayModalOpen(true), style: { display: 'flex', alignItems: 'center', gap: '5px' } }, e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('plus') } }), 'إضافة يوم')

        },

            e('div', { className: 'days-grid', id: 'daysGrid' },

                days.length === 0 ? e('div', { style: { gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: '#888' } }, 'لا توجد أيام') :

                    days.map(d => e(DayCard, { key: d.id, day: d, onDelete: handleDeleteDay, onUpdate: handleUpdateDay, globalStage: globalStage }))

            )

        ),

        e(Card, { title: e('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('settings') } }), 'إعدادات التوزيع') },

            e('div', { className: 'settings-panel no-print', style: { background: 'var(--bg-color)', padding: '15px', borderRadius: '8px', marginBottom: '20px' } },

                e('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', marginBottom: '15px' } },
                    // Settings Checkboxes
                    Object.entries({
                        equalDistribution: '⚖️ توزيع متساوٍ',
                        maxOnePerDay: '🚫 فترة واحدة/يوم',
                        subjectTeachersFirst: '📚 تخصص المادة أولاً',
                        giveRestDay: '🏖️ يوم راحة'
                    }).map(([key, label]) =>
                        e('div', { key, className: 'setting-item', style: { display: 'flex', alignItems: 'center', background: 'white', padding: '5px 10px', borderRadius: '20px', border: '1px solid #ddd' } },
                            e('input', {
                                type: 'checkbox',
                                id: key,
                                checked: settings[key],
                                onChange: (ev) => {
                                    const newS = { ...settings, [key]: ev.target.checked };
                                    saveSettings(newS);
                                },
                                style: { marginLeft: '8px', width: '16px', height: '16px' }
                            }),
                            e('label', { htmlFor: key, style: { cursor: 'pointer', margin: 0 } }, label)
                        )
                    ),

                    // Generate Button moved here
                    e(Button, {
                        className: 'btn-success',
                        onClick: generateSchedule,
                        style: { padding: '8px 20px', fontWeight: 'bold' }
                    }, '🔄 توليد التوزيع (آلي)'),

                    // Custom check mark input
                    e('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '5px 10px', borderRadius: '20px', border: '1px solid #ddd' } },
                        e('label', { style: { margin: 0, whiteSpace: 'nowrap', fontSize: '0.9rem' } }, '✏️ علامة الحراسة:'),
                        e('input', {
                            type: 'text',
                            value: settings.checkMark || '✓',
                            onChange: (ev) => {
                                const newS = { ...settings, checkMark: ev.target.value };
                                saveSettings(newS);
                            },
                            style: { width: '80px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '6px', textAlign: 'center', fontSize: '1rem', fontWeight: 'bold' },
                            maxLength: 5,
                            placeholder: '✓'
                        })
                    )
                ),

                // Manual Distribution Note
                e('div', { style: { color: '#666', fontSize: '0.9rem', borderTop: '1px solid #ddd', paddingTop: '10px', marginTop: '10px' } },
                    e('strong', null, 'ملاحظة: '),
                    'في حالة التوزيع اليدوي، اضغط فقط في خانات الجدول أدناه لتحديد أو إلغاء تحديد الحراسة.'
                )
            ),

            e('div', { className: 'action-buttons no-print', style: { marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' } },
                e(Button, { className: 'btn-info', onClick: printStrips }, '✂️ طباعة القصاصات'),
                e('div', {
                    style: {
                        display: 'none',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'white',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid #ddd'
                    }
                },
                    e('label', { style: { margin: 0, fontWeight: 'bold', whiteSpace: 'nowrap' } }, 'اتجاه الجدول:'),
                    e(Select, {
                        value: printOrientation,
                        onChange: setPrintOrientation,
                        options: [
                            { value: 'landscape', label: 'أفقي' },
                            { value: 'portrait', label: 'عمودي' }
                        ],
                        style: { minWidth: '110px', fontFamily: 'inherit' }
                    })
                ),
                e(Button, { className: 'btn-primary', onClick: printSchedule }, '🖨️ طباعة الجدول'),
                e(Button, { className: 'btn-success', onClick: exportScheduleToExcel }, '📊 تصدير Excel'),
                e(Button, {
                    className: showRooms ? 'btn-warning' : 'btn-secondary',
                    style: { display: 'flex', alignItems: 'center', gap: '5px' },
                    onClick: async () => {
                        if (showRooms) {
                            setShowRooms(false);
                            return;
                        }
                        // Load fresh room assignments from DB (per-trimester)
                        const triKeys = getTrimesterKeys(trimester);
                        const freshRooms = await DB.get(triKeys.ROOM_ASSIGNMENTS) || {};
                        if (Object.keys(freshRooms).length === 0) {
                            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا يوجد توزيع قاعات. يرجى إعداد التوزيع من صفحة قوائم الحراسة أولاً.' });
                            return;
                        }
                        setRoomAssignments(freshRooms);
                        // Refresh GlobalRoomCache with latest room labels
                        try {
                            let prd = await DB.get('supervisionPeriodRooms');
                            if (!prd) { const s = localStorage.getItem('supervisionPeriodRooms'); if (s) prd = JSON.parse(s); }
                            if (prd) hydrateGlobalRoomCache(prd);
                        } catch (e) { console.warn("Room cache refresh error:", e); }
                        setShowRooms(true);
                    }
                }, showRooms ? '🏫 إخفاء القاعات' : '🏫 إظهار القاعات'),
                e(Button, { className: 'btn-danger', onClick: clearSchedule }, '🗑️ مسح الكل')
            ),

            e(ScheduleTable, { teachers, days, schedule, roomAssignments, showRooms, onToggleAssignment: manuallyToggle, settings }),

            e(FloatingTotals, { days, schedule })

        ),

        e(AddDayModal, { isOpen: isAddDayModalOpen, onClose: () => setIsAddDayModalOpen(false), onAdd: handleAddDay }),

        e(PrintNoteModal, { isOpen: isPrintModalOpen, onClose: () => setIsPrintModalOpen(false), onConfirm: executePrint })

    );

};

// ======================

// RENDER

// ======================

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(e(App));

