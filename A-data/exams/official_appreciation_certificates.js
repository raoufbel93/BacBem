(function () {
    'use strict';

    var CONFIG_KEY = 'officialAppreciationCertificateConfig';
    var DEFAULT_CONFIG = {
        title: 'شهادة شكر وتقدير',
        bodyText: [
            'تتقدم إدارة {center} بـ {title}',
            'إلى السيد(ة):',
            '{name}',
            'وذلك عرفانًا بمشاركته(ها) الفعالة في عملية تأطير الامتحان {exam}',
            'خلال {session}، مع خالص الشكر والتقدير.'
        ].join('\n'),
        templateId: 'ornate',
        coloredBackground: true
    };
    var CATEGORY_META = {
        all: { label: 'الكل', icon: 'fa-layer-group' },
        proctors: { label: 'الأساتذة الحراس', badgeClass: 'badge-proctors', icon: 'fa-user-shield' },
        members: { label: 'أعضاء الأمانة', badgeClass: 'badge-members', icon: 'fa-users-gear' }
    };
    var FONT_DEFINITIONS = [
        { name: 'Tajawal', file: 'Tajawal-Regular.ttf' },
        { name: 'Tajawal-Bold', file: 'Tajawal-Bold.ttf' },
        { name: 'Almaalim', file: 'mcs-almaalim-high-brok.ttf' }
    ];

    var appState = {
        config: cloneConfig(DEFAULT_CONFIG),
        categoryFilter: 'all',
        center: null,
        institutionSettings: null,
        participants: [],
        selectedIds: {}
    };

    function cloneConfig(config) {
        return {
            title: String((config && config.title) || DEFAULT_CONFIG.title),
            bodyText: String((config && config.bodyText) || DEFAULT_CONFIG.bodyText),
            templateId: String((config && config.templateId) || DEFAULT_CONFIG.templateId),
            coloredBackground: config && config.coloredBackground !== undefined ? !!config.coloredBackground : !!DEFAULT_CONFIG.coloredBackground
        };
    }

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getOfficialExamDisplayName(trimester, storedExam) {
        var normalizedTrimester = String(trimester || '').trim();
        var examName = String(storedExam || '').trim();
        if (normalizedTrimester === 'blanc') return 'شهادة التعليم المتوسط';
        if (normalizedTrimester === 'blanc_lycee') return 'شهادة البكالوريا';
        if (normalizedTrimester === 'custom') return examName || 'امتحان آخر';
        return examName || 'الامتحان الرسمي';
    }

    function normalizeCenter(center, trimester) {
        var safe = Object.assign({
            center_name: '',
            institution: '',
            province: '',
            municipality: '',
            exam: '',
            session: '',
            president: '',
            job: ''
        }, center || {});

        return Object.assign({}, safe, {
            displayCenter: safe.center_name || safe.institution || 'المركز الرسمي',
            displayProvince: safe.province || '........',
            displayMunicipality: safe.municipality || safe.province || '........',
            displayExam: getOfficialExamDisplayName(trimester, safe.exam),
            displaySession: safe.session || 'الدورة الحالية',
            displayPresident: safe.president || '................',
            displayJob: safe.job || 'رئيس المركز'
        });
    }

    function getCurrentSchoolYear() {
        var settings = appState.institutionSettings || {};
        return settings.currentAcademicYear || settings.schoolYear || '';
    }

    function buildParticipantId(prefix, rawId, index) {
        return prefix + '-' + (rawId || index);
    }

    function buildProctorParticipant(proctor, index) {
        var lastName = String((proctor && proctor.last_name) || '').trim();
        var firstName = String((proctor && proctor.first_name) || '').trim();
        return {
            id: buildParticipantId('proctor', proctor && proctor.id, index),
            categoryKey: 'proctors',
            categoryLabel: CATEGORY_META.proctors.label,
            fullName: (lastName + ' ' + firstName).trim() || 'بدون اسم',
            role: (proctor && proctor.rank) || 'أستاذ حارس',
            institution: (proctor && proctor.institution) || appState.center.displayCenter,
            note: (proctor && proctor.subject) || '',
            subject: (proctor && proctor.subject) || '',
            raw: proctor || {}
        };
    }

    function buildMemberParticipant(member, index) {
        return {
            id: buildParticipantId('member', member && member.id, index),
            categoryKey: 'members',
            categoryLabel: CATEGORY_META.members.label,
            fullName: String((member && member.full_name) || '').trim() || 'بدون اسم',
            role: String((member && (member.note || member.role)) || '').trim() || 'عضو أمانة',
            institution: (member && member.institution) || appState.center.displayCenter,
            note: String((member && member.role) || '').trim(),
            subject: '',
            raw: member || {}
        };
    }

    function sortParticipants(items) {
        return (items || []).slice().sort(function (a, b) {
            var categoryDiff = String(a.categoryLabel || '').localeCompare(String(b.categoryLabel || ''), 'ar');
            if (categoryDiff !== 0) return categoryDiff;
            return String(a.fullName || '').localeCompare(String(b.fullName || ''), 'ar');
        });
    }

    function getFilteredParticipants(categoryKey) {
        var key = categoryKey || appState.categoryFilter;
        if (key === 'all') return appState.participants.slice();
        return appState.participants.filter(function (participant) {
            return participant.categoryKey === key;
        });
    }

    function getCategoryParticipants(categoryKey) {
        return appState.participants.filter(function (participant) {
            return participant.categoryKey === categoryKey;
        });
    }

    function countSelected(items) {
        return (items || []).filter(function (item) {
            return !!appState.selectedIds[item.id];
        }).length;
    }

    function getSelectedParticipants() {
        return appState.participants.filter(function (participant) {
            return !!appState.selectedIds[participant.id];
        });
    }

    function applyTemplateText(record, customTitle) {
        var center = appState.center;
        var roleLine = record.role || record.note || record.categoryLabel;
        var schoolYear = getCurrentSchoolYear() || '........';
        var variables = {
            title: customTitle || appState.config.title,
            name: record.fullName || '',
            role: roleLine || '',
            institution: record.institution || center.displayCenter,
            category: record.categoryLabel || '',
            exam: center.displayExam,
            session: center.displaySession,
            center: center.displayCenter,
            province: center.displayProvince,
            municipality: center.displayMunicipality,
            schoolYear: schoolYear
        };

        return appState.config.bodyText.replace(/\{(\w+)\}/g, function (match, key) {
            return variables[key] !== undefined ? variables[key] : match;
        });
    }

    function updateConfigField(field, value) {
        appState.config[field] = value;
        persistConfig();
        renderPreviewSummary();
    }

    function persistConfig() {
        DB.set(CONFIG_KEY, cloneConfig(appState.config)).catch(function (error) {
            console.warn('Official appreciation config save failed:', error);
        });
    }

    function getUsedFontsCss() {
        return FONT_DEFINITIONS.map(function (font) {
            return "@font-face{font-family:'" + font.name + "';src:url('../assets/fonts/" + font.file + "') format('truetype');font-display:swap;}";
        }).join('');
    }

    function buildPrintHtml(records) {
        var center = appState.center;
        var titleText = appState.config.title || DEFAULT_CONFIG.title;
        var templateId = appState.config.templateId || 'default';
        var useBackground = templateId !== 'default' && templateId !== 'ornate';
        var backgroundStyle = useBackground
            ? "background-image:url('../assets/chahada/" + templateId + ".png');background-size:100% 100%;background-repeat:no-repeat;"
            : '';
        var noColoredBackground = !useBackground && !appState.config.coloredBackground;
        var today = new Date().toLocaleDateString('ar-DZ');

        var certificatesHtml = records.map(function (record, index) {
            var hiddenRoleLine = String(record.role || record.note || '').trim();
            var lines = applyTemplateText(record, titleText).split('\n').map(function (line) {
                var safeLine = String(line || '').trim();
                if (!safeLine) return '<p class="certificate-spacer"></p>';
                if (hiddenRoleLine && safeLine === hiddenRoleLine) return '';
                if (safeLine === (record.fullName || '').trim()) {
                    return '<p class="participant-name">' + escapeHtml(safeLine) + '</p>';
                }
                return '<p>' + escapeHtml(safeLine) + '</p>';
            }).join('');

            return '' +
                '<div class="certificate-page template-' + templateId + ' ' + (noColoredBackground ? 'no-color-bg' : '') + '" style="' + (index > 0 ? 'page-break-before:always;' : '') + backgroundStyle + '">' +
                (!useBackground
                    ? '<div class="certificate-frame ' + (templateId === 'ornate' ? 'ornate' : '') + ' ' + (noColoredBackground ? 'no-bg-color' : '') + '">' +
                      '<div class="corner-decoration corner-tl"></div>' +
                      '<div class="corner-decoration corner-tr"></div>' +
                      '<div class="corner-decoration corner-bl"></div>' +
                      '<div class="corner-decoration corner-br"></div>' +
                      (templateId === 'ornate'
                        ? '<div class="side-decoration side-left"></div><div class="side-decoration side-right"></div><div class="side-decoration side-top"></div><div class="side-decoration side-bottom"></div>'
                        : '') +
                      '</div>'
                    : '') +
                '<div class="certificate-inner ' + (useBackground ? 'with-background' : '') + '">' +
                (!useBackground
                    ? '<div class="certificate-header">' +
                        '<div class="header-center">' +
                            '<div class="republic">الجمهورية الجزائرية الديمقراطية الشعبية</div>' +
                            '<div class="ministry">وزارة التربية الوطنية</div>' +
                        '</div>' +
                        '<div class="header-row">' +
                            '<div class="header-right">المركز: ' + escapeHtml(center.displayCenter) + '</div>' +
                            '<div class="header-left">' + escapeHtml(center.displayExam) + ' - ' + escapeHtml(center.displaySession) + '</div>' +
                        '</div>' +
                      '</div>'
                    : '') +
                '<div class="certificate-title">' +
                    '<div class="ornament-container"><span class="ornament-icon icon-diamond"></span><span class="ornament-icon icon-diamond large"></span><span class="ornament-icon icon-diamond"></span></div>' +
                    '<div class="title-text">' + escapeHtml(titleText) + '</div>' +
                    '<div class="title-underline"></div>' +
                '</div>' +
                '<div class="certificate-content">' + lines + '</div>' +
                '<div class="certificate-footer">' +
                    '<div class="footer-signature">' +
                        '<div style="margin-bottom:10px;">حرر بـ: ' + escapeHtml(center.displayMunicipality) + ' في: ' + escapeHtml(today) + '</div>' +
                        escapeHtml(center.displayJob) + '<br>' + escapeHtml(center.displayPresident) +
                    '</div>' +
                '</div>' +
                '</div>' +
                '</div>';
        }).join('');

        return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>شهادات الشكر والتقدير</title><base href="' + escapeHtml(window.location.href) + '">' +
            '<style>' + getUsedFontsCss() +
            '.title-text{font-family:"Almaalim","Tajawal",sans-serif;font-size:41pt;font-weight:bold;color:#8B4513;margin:5px 0;text-shadow:2px 2px 4px rgba(139,69,19,.18);}' +
            '.certificate-header{font-family:"Tajawal-Bold","Tajawal",sans-serif;text-align:center;font-weight:bold;color:#333;margin-bottom:15px;}' +
            '.header-center{margin-bottom:10px;}.republic{font-size:16pt;margin-bottom:3px;}.ministry{font-size:14pt;}' +
            '.header-row{display:flex;justify-content:space-between;align-items:center;padding:0 20px;font-size:13pt;gap:14px;}' +
            '.header-row>div{flex:1;}.header-right{text-align:right;}.header-left{text-align:left;}' +
            '.ornament-container{display:flex;align-items:center;justify-content:center;gap:15px;margin:5px 0;}' +
            '.ornament-icon{width:20px;height:20px;background-size:contain;background-repeat:no-repeat;background-position:center;display:inline-block;}' +
            '.icon-diamond{background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23d4af37\'%3E%3Cpath d=\'M12 2L22 12L12 22L2 12Z\'/%3E%3C/svg%3E");width:12px;height:12px;}.icon-diamond.large{transform:scale(1.18);}' +
            '*{box-sizing:border-box;margin:0;padding:0;}body{font-family:"Tajawal","Arial",sans-serif;background:#f5f5f5;}' +
            '.certificate-page{width:297mm;height:209mm;padding:8mm;background:white;margin:0 auto 20px;box-shadow:0 4px 20px rgba(0,0,0,.1);position:relative;overflow:hidden;page-break-inside:avoid;}' +
            '.certificate-page.template-ornate{background:radial-gradient(circle at center,rgba(212,175,55,.12) 0%,rgba(212,175,55,.03) 24%,transparent 52%),linear-gradient(135deg,#fffdf8 0%,#fff8ec 48%,#fffefb 100%);}' +
            '.certificate-page.template-ornate::before{content:"";position:absolute;inset:34mm 88mm 44mm;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 240 240\'%3E%3Cg fill=\'none\' stroke=\'%23d4af37\' stroke-width=\'3\' opacity=\'0.9\'%3E%3Ccircle cx=\'120\' cy=\'120\' r=\'72\'/%3E%3Ccircle cx=\'120\' cy=\'120\' r=\'48\'/%3E%3Cpath d=\'M120 36l14 28 31 4-22 21 5 31-28-15-28 15 5-31-22-21 31-4z\'/%3E%3C/g%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;background-size:contain;opacity:.08;pointer-events:none;}' +
            '.certificate-page.template-ornate::after{content:"";position:absolute;top:16mm;left:18mm;right:18mm;bottom:16mm;border-radius:20px;border:1px solid rgba(123,68,43,.12);pointer-events:none;}' +
            '.certificate-frame{position:absolute;top:8mm;left:8mm;right:8mm;bottom:8mm;border:3px solid #8B4513;background:linear-gradient(to bottom,#FFFEF7 0%,#FFF8E7 100%);}' +
            '.certificate-frame.ornate{border:10px solid #7b442b;border-radius:22px;background:linear-gradient(180deg,rgba(255,252,245,.97) 0%,rgba(255,248,232,.96) 55%,rgba(255,253,247,.98) 100%);box-shadow:inset 0 0 0 2px rgba(255,255,255,.95),inset 0 0 0 7px rgba(212,175,55,.88),inset 0 0 0 15px rgba(123,68,43,.14),inset 0 0 42px rgba(212,175,55,.16),0 18px 38px rgba(123,68,43,.12);}' +
            '.certificate-frame.ornate::before{content:"";position:absolute;top:13px;left:13px;right:13px;bottom:13px;border:1.5px solid rgba(212,175,55,.78);border-radius:16px;background:radial-gradient(circle at center,rgba(212,175,55,.18),transparent 58%),repeating-linear-gradient(45deg,transparent 0 12px,rgba(212,175,55,.16) 12px 13px),repeating-linear-gradient(-45deg,transparent 0 12px,rgba(123,68,43,.1) 12px 13px);opacity:.28;z-index:0;pointer-events:none;}' +
            '.certificate-frame.ornate::after{content:"";position:absolute;top:24px;left:24px;right:24px;bottom:24px;border:2px solid rgba(123,68,43,.52);border-radius:12px;box-shadow:inset 0 0 0 1px rgba(212,175,55,.42);z-index:1;}' +
            '.certificate-frame.ornate .corner-decoration{width:92px;height:92px;background:linear-gradient(135deg,#6f3923 0%,#9b5a30 50%,#d4af37 100%);position:absolute;z-index:2;clip-path:polygon(0 0,100% 0,0 100%);filter:drop-shadow(0 6px 12px rgba(111,57,35,.22));}' +
            '.certificate-frame.ornate .corner-decoration::before{content:"";position:absolute;inset:10px;border-top:2px solid rgba(255,248,228,.82);border-left:2px solid rgba(255,248,228,.82);opacity:.9;}' +
            '.certificate-frame.ornate .corner-tl{top:0;left:0;}.certificate-frame.ornate .corner-tr{top:0;right:0;transform:rotate(90deg);}.certificate-frame.ornate .corner-br{bottom:0;right:0;transform:rotate(180deg);}.certificate-frame.ornate .corner-bl{bottom:0;left:0;transform:rotate(270deg);}' +
            '.certificate-frame.ornate .side-decoration{position:absolute;background:linear-gradient(180deg,#f0d58a 0%,#d4af37 50%,#9b5a30 100%);z-index:2;display:flex;align-items:center;justify-content:center;}' +
            '.certificate-frame.ornate .side-decoration::before{content:"\\2726";color:#7b442b;font-size:14px;width:24px;height:24px;line-height:24px;text-align:center;background:linear-gradient(135deg,#fff7dc,#efcb66);border:1px solid rgba(123,68,43,.22);border-radius:50%;box-shadow:0 3px 8px rgba(123,68,43,.12),inset 0 0 0 1px rgba(255,255,255,.65);}' +
            '.certificate-frame.ornate .side-top{top:-6px;left:50%;transform:translateX(-50%);width:180px;height:10px;border-radius:0 0 14px 14px;border:2px solid #7b442b;border-top:none;}.certificate-frame.ornate .side-bottom{bottom:-6px;left:50%;transform:translateX(-50%);width:180px;height:10px;border-radius:14px 14px 0 0;border:2px solid #7b442b;border-bottom:none;}.certificate-frame.ornate .side-left,.certificate-frame.ornate .side-right{top:50%;transform:translateY(-50%);width:10px;height:92px;border-radius:999px;border:2px solid rgba(123,68,43,.78);}.certificate-frame.ornate .side-left{left:-6px;}.certificate-frame.ornate .side-right{right:-6px;}' +
            '.certificate-frame.no-bg-color{background:white !important;}.certificate-frame:not(.ornate)::before{content:"";position:absolute;top:5px;left:5px;right:5px;bottom:5px;border:2px solid #D4AF37;border-radius:3px;}.certificate-frame:not(.ornate)::after{content:"";position:absolute;top:12px;left:12px;right:12px;bottom:12px;border:1px dashed #C4A052;}' +
            '.certificate-frame:not(.ornate) .corner-decoration{position:absolute;width:60px;height:60px;border:4px solid #D4AF37;background:transparent;}.corner-tl{top:18px;left:18px;border-right:none;border-bottom:none;border-top-left-radius:8px;}.corner-tr{top:18px;right:18px;border-left:none;border-bottom:none;border-top-right-radius:8px;}.corner-bl{bottom:18px;left:18px;border-right:none;border-top:none;border-bottom-left-radius:8px;}.corner-br{bottom:18px;right:18px;border-left:none;border-top:none;border-bottom-right-radius:8px;}' +
            '.certificate-inner{position:relative;z-index:1;padding:6mm 12mm 5mm;height:100%;display:flex;flex-direction:column;}.certificate-inner.with-background{padding-top:15mm;justify-content:flex-start;}.certificate-title{text-align:center;margin:5px 0;}.certificate-inner.with-background .certificate-title{margin-top:5mm;}' +
            '.certificate-content{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:5px 50px;transform:translateY(-5mm);}.certificate-content p{font-family:"Tajawal","Arial",sans-serif;font-size:16pt;line-height:1.3;margin:1px 0;color:#5c3926;}.certificate-spacer{min-height:.85em;}' +
            '.participant-name{font-family:"Almaalim","Tajawal",sans-serif !important;font-size:28pt !important;font-weight:bold;color:#8B4513;text-shadow:1px 1px 3px rgba(139,69,19,.3);margin:10px 0;padding:5px 60px;display:inline-block;position:relative;background:linear-gradient(90deg,transparent,rgba(212,175,55,.15) 20%,rgba(212,175,55,.15) 80%,transparent);border-radius:15px;border-bottom:2px solid #D4AF37;}' +
            '.certificate-footer{display:flex;justify-content:flex-end;align-items:flex-end;padding:2px 30px;margin-top:auto;margin-bottom:25px;}.footer-signature{text-align:center;font-size:12pt;min-width:230px;}' +
            '.certificate-page.template-ornate .certificate-inner{padding:8.5mm 14mm 26mm 14mm;}.certificate-page.template-ornate .certificate-header{margin-bottom:12px;color:#5f3622;}.certificate-page.template-ornate .header-center{margin-bottom:10px;position:relative;padding-top:8px;}.certificate-page.template-ornate .header-center::before{content:"\\2726";position:absolute;top:-4px;left:50%;transform:translateX(-50%);width:28px;height:28px;line-height:28px;border-radius:50%;background:linear-gradient(135deg,#f0d58a,#d4af37);color:#6f3923;font-size:13px;box-shadow:0 0 0 3px rgba(212,175,55,.16);}' +
            '.certificate-page.template-ornate .republic{font-size:17pt;letter-spacing:.2px;}.certificate-page.template-ornate .ministry{font-size:13pt;color:#7b533f;}.certificate-page.template-ornate .header-row{gap:12px;padding:0;}.certificate-page.template-ornate .header-row>div{flex:1;min-width:0;padding:8px 14px;border-radius:14px;background:linear-gradient(180deg,rgba(255,251,242,.96),rgba(252,241,214,.96));border:1px solid rgba(212,175,55,.62);box-shadow:inset 0 0 0 1px rgba(123,68,43,.08);}' +
            '.certificate-page.template-ornate .certificate-title{margin:0 0 5px;position:relative;}.certificate-page.template-ornate .certificate-title::before,.certificate-page.template-ornate .certificate-title::after{content:"";position:absolute;top:50%;width:58px;height:2px;background:linear-gradient(90deg,transparent,#d4af37,#7b442b);}.certificate-page.template-ornate .certificate-title::before{right:calc(50% + 120px);}.certificate-page.template-ornate .certificate-title::after{left:calc(50% + 120px);transform:scaleX(-1);}' +
            '.certificate-page.template-ornate .title-text{display:inline-block;min-width:230px;padding:8px 28px 11px;border-radius:999px;background:linear-gradient(180deg,rgba(255,252,245,.96),rgba(248,233,194,.96));border:1px solid rgba(212,175,55,.76);box-shadow:0 10px 22px rgba(123,68,43,.12),inset 0 0 0 1px rgba(255,255,255,.8);font-size:40pt;color:#7b442b;text-shadow:0 2px 0 rgba(255,255,255,.72);}.title-underline{width:176px;height:8px;margin:4px auto 0;border-radius:999px;background:linear-gradient(90deg,transparent 0%,rgba(123,68,43,.12) 16%,rgba(212,175,55,.95) 50%,rgba(123,68,43,.12) 84%,transparent 100%);}' +
            '.certificate-page.template-ornate .certificate-content{padding:0 36px;transform:translateY(-6mm);}.certificate-page.template-ornate .certificate-content p{max-width:88%;font-size:15.6pt;line-height:1.26;}.certificate-page.template-ornate .participant-name{font-size:28pt !important;color:#6d311c;padding:6px 68px;margin:6px 0;background:linear-gradient(90deg,rgba(255,248,228,.25),rgba(212,175,55,.28) 18%,rgba(255,248,228,.92) 50%,rgba(212,175,55,.28) 82%,rgba(255,248,228,.25));border:1px solid rgba(212,175,55,.72);box-shadow:0 10px 26px rgba(123,68,43,.1),inset 0 0 0 1px rgba(255,255,255,.76);}' +
            '.certificate-page.template-ornate .certificate-footer{position:absolute;left:calc(28px + 10mm);right:calc(28px + 20mm);bottom:calc(12px + 14mm);margin:0;padding:0;}.certificate-page.template-ornate .footer-signature{min-width:240px;padding:14px 22px 10px;border-radius:18px 18px 8px 8px;background:linear-gradient(180deg,rgba(255,252,245,.96),rgba(247,234,200,.98));border:1px solid rgba(212,175,55,.82);color:#603824;box-shadow:0 12px 24px rgba(123,68,43,.1),inset 0 0 0 1px rgba(255,255,255,.72);position:relative;}.certificate-page.template-ornate .footer-signature::before{content:"";position:absolute;top:10px;left:22px;right:22px;height:1px;background:linear-gradient(90deg,transparent,rgba(212,175,55,.9),transparent);}' +
            '@media print{@page{size:A4 landscape;margin:0;}body{background:white;margin:0;padding:0;}.certificate-page{box-shadow:none;margin:0;width:297mm;height:209mm;page-break-after:always;page-break-inside:avoid;overflow:hidden;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important;}.certificate-page:last-child{page-break-after:avoid;}}' +
            '</style>' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : '') + '</head><body>' +
            (window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : '') +
            certificatesHtml +
            (window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : '') +
            '</body></html>';
    }

    function openPrintWindow(records) {
        var html = buildPrintHtml(records);
        var printWindow = window.open('', '_blank');
        if (!printWindow) {
            Swal.fire('تنبيه', 'تعذر فتح نافذة الطباعة', 'warning');
            return;
        }
        printWindow.document.write(html);
        printWindow.document.close();
        if (printWindow.document.fonts && printWindow.document.fonts.ready) {
            printWindow.document.fonts.ready.catch(function () {});
        }
    }

    function previewParticipant(id) {
        var record = appState.participants.find(function (participant) {
            return participant.id === id;
        });
        if (!record) return;
        openPrintWindow([record]);
    }

    function toggleParticipant(id) {
        appState.selectedIds[id] = !appState.selectedIds[id];
        renderAll();
    }

    function toggleCategory(categoryKey, checked) {
        getCategoryParticipants(categoryKey).forEach(function (participant) {
            appState.selectedIds[participant.id] = !!checked;
        });
        renderAll();
    }

    function toggleVisible(checked) {
        getFilteredParticipants().forEach(function (participant) {
            appState.selectedIds[participant.id] = !!checked;
        });
        renderAll();
    }

    function renderStats() {
        var allItems = appState.participants;
        var proctors = getCategoryParticipants('proctors');
        var members = getCategoryParticipants('members');

        $('statsGrid').innerHTML = [
            { title: 'إجمالي السجلات', value: allItems.length, note: 'المحدد: ' + countSelected(allItems) },
            { title: CATEGORY_META.proctors.label, value: proctors.length, note: 'المحدد: ' + countSelected(proctors) },
            { title: CATEGORY_META.members.label, value: members.length, note: 'المحدد: ' + countSelected(members) }
        ].map(function (item) {
            return '<div class="stat-card"><h3>' + escapeHtml(item.title) + '</h3><div class="stat-value">' + escapeHtml(item.value) + '</div><div class="stat-note">' + escapeHtml(item.note) + '</div></div>';
        }).join('');
    }

    function renderCategoryTabs() {
        var tabItems = ['all', 'proctors', 'members'];
        $('categoryTabs').innerHTML = tabItems.map(function (key) {
            var meta = CATEGORY_META[key];
            return '<button class="tab-btn ' + (appState.categoryFilter === key ? 'active' : '') + '" data-tab="' + key + '">' +
                '<i class="fa-solid ' + meta.icon + '"></i> ' + escapeHtml(meta.label) + '</button>';
        }).join('');

        Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (button) {
            button.addEventListener('click', function () {
                appState.categoryFilter = this.getAttribute('data-tab');
                renderCategorySections();
                renderPreviewSummary();
                renderCategoryTabs();
            });
        });
    }

    function renderCategorySections() {
        var container = $('categorySections');
        var categoryKeys = appState.categoryFilter === 'all' ? ['proctors', 'members'] : [appState.categoryFilter];

        container.innerHTML = categoryKeys.map(function (categoryKey) {
            var records = getCategoryParticipants(categoryKey);
            var selected = countSelected(records);
            var meta = CATEGORY_META[categoryKey];
            var allChecked = records.length > 0 && selected === records.length;
            var rows = records.length === 0
                ? '<tr><td colspan="7" class="empty-state">لا توجد بيانات ضمن هذه الفئة.</td></tr>'
                : records.map(function (record) {
                    return '<tr>' +
                        '<td class="select-cell"><input type="checkbox" data-toggle="' + escapeHtml(record.id) + '" ' + (appState.selectedIds[record.id] ? 'checked' : '') + '></td>' +
                        '<td class="name-cell">' + escapeHtml(record.fullName) + '</td>' +
                        '<td><span class="badge ' + escapeHtml(meta.badgeClass) + '">' + escapeHtml(record.categoryLabel) + '</span></td>' +
                        '<td>' + escapeHtml(record.role || '-') + '</td>' +
                        '<td>' + escapeHtml(record.institution || '-') + '</td>' +
                        '<td>' + escapeHtml(record.subject || record.note || '-') + '</td>' +
                        '<td><button class="btn btn-info" style="padding:7px 11px;font-size:0.8rem;" data-preview="' + escapeHtml(record.id) + '"><i class="fa-solid fa-eye"></i></button></td>' +
                    '</tr>';
                }).join('');

            return '<div class="category-section">' +
                '<div class="category-header">' +
                    '<div class="category-title-wrap">' +
                        '<h3 class="category-title">' + escapeHtml(meta.label) + '</h3>' +
                        '<div class="category-meta">الإجمالي: ' + escapeHtml(records.length) + ' | المحدد: ' + escapeHtml(selected) + '</div>' +
                    '</div>' +
                    '<div class="category-actions">' +
                        '<label class="category-check"><input type="checkbox" data-category-all="' + categoryKey + '" ' + (allChecked ? 'checked' : '') + '> تحديد الكل</label>' +
                        '<button class="btn btn-soft" style="padding:8px 12px;font-size:0.82rem;" data-category-clear="' + categoryKey + '"><i class="fa-solid fa-eraser"></i> مسح</button>' +
                    '</div>' +
                '</div>' +
                '<div style="overflow:auto;">' +
                    '<table class="people-table">' +
                        '<thead><tr><th style="width:44px;">تحديد</th><th>الاسم</th><th>الفئة</th><th>الصفة</th><th>المؤسسة</th><th>ملاحظة</th><th style="width:88px;">معاينة</th></tr></thead>' +
                        '<tbody>' + rows + '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>';
        }).join('');

        Array.prototype.forEach.call(container.querySelectorAll('[data-toggle]'), function (checkbox) {
            checkbox.addEventListener('change', function () {
                toggleParticipant(this.getAttribute('data-toggle'));
            });
        });

        Array.prototype.forEach.call(container.querySelectorAll('[data-category-all]'), function (checkbox) {
            checkbox.addEventListener('change', function () {
                toggleCategory(this.getAttribute('data-category-all'), this.checked);
            });
        });

        Array.prototype.forEach.call(container.querySelectorAll('[data-category-clear]'), function (button) {
            button.addEventListener('click', function () {
                toggleCategory(this.getAttribute('data-category-clear'), false);
            });
        });

        Array.prototype.forEach.call(container.querySelectorAll('[data-preview]'), function (button) {
            button.addEventListener('click', function () {
                previewParticipant(this.getAttribute('data-preview'));
            });
        });
    }

    function renderPreviewSummary() {
        var filtered = getFilteredParticipants();
        var selected = getSelectedParticipants();
        var preview = selected[0] || filtered[0] || null;
        var previewBox = $('previewBox');

        if (!preview) {
            previewBox.innerHTML = '<strong>لا توجد بيانات للمعاينة</strong><div>قم بإضافة الحراس أو أعضاء الأمانة أولًا.</div>';
            return;
        }

        previewBox.innerHTML = '<div class="preview-summary">' +
            '<div class="preview-summary-card"><div class="label">المحدد للطباعة</div><div class="value">' + escapeHtml(selected.length || 0) + ' شهادة</div></div>' +
            '<div class="preview-summary-card"><div class="label">نموذج المعاينة</div><div class="value">' + escapeHtml(preview.fullName) + '<br>' + escapeHtml(preview.role || '-') + '</div></div>' +
            '<div class="preview-summary-card"><div class="label">العنوان الحالي</div><div class="value">' + escapeHtml(appState.config.title) + '</div></div>' +
            '<div class="preview-summary-card"><div class="label">مقتطف من النص</div><div class="value">' + escapeHtml(applyTemplateText(preview, appState.config.title).slice(0, 180)) + (applyTemplateText(preview, appState.config.title).length > 180 ? '...' : '') + '</div></div>' +
            '<div class="toolbar">' +
                '<button class="btn btn-info" id="previewCurrentBtn"><i class="fa-solid fa-eye"></i> معاينة الشهادة</button>' +
                '<button class="btn btn-warning" id="selectVisibleBtn"><i class="fa-solid fa-check-double"></i> تحديد المعروض</button>' +
                '<button class="btn btn-soft" id="clearVisibleBtn"><i class="fa-solid fa-eraser"></i> إلغاء تحديد المعروض</button>' +
            '</div>' +
        '</div>';

        $('previewCurrentBtn').addEventListener('click', function () {
            previewParticipant(preview.id);
        });
        $('selectVisibleBtn').addEventListener('click', function () {
            toggleVisible(true);
        });
        $('clearVisibleBtn').addEventListener('click', function () {
            toggleVisible(false);
        });
    }

    function renderAll() {
        renderStats();
        renderCategoryTabs();
        renderCategorySections();
        renderPreviewSummary();

        if (window.IconManager && typeof window.IconManager.render === 'function') {
            window.IconManager.render();
        }
    }

    function bindControls() {
        $('titleInput').addEventListener('input', function () {
            updateConfigField('title', this.value);
        });
        $('bodyText').addEventListener('input', function () {
            updateConfigField('bodyText', this.value);
        });
        $('templateSelect').addEventListener('change', function () {
            updateConfigField('templateId', this.value);
        });
        $('coloredBackground').addEventListener('change', function () {
            updateConfigField('coloredBackground', !!this.checked);
        });
        $('resetTextBtn').addEventListener('click', function () {
            appState.config.title = DEFAULT_CONFIG.title;
            appState.config.bodyText = DEFAULT_CONFIG.bodyText;
            persistConfig();
            syncConfigInputs();
            renderPreviewSummary();
        });
        $('printSelectedBtn').addEventListener('click', function () {
            var selected = getSelectedParticipants();
            if (selected.length === 0) {
                Swal.fire('تنبيه', 'يرجى تحديد عنصر واحد على الأقل', 'warning');
                return;
            }
            openPrintWindow(selected);
        });
        $('printAllBtn').addEventListener('click', function () {
            if (appState.participants.length === 0) {
                Swal.fire('تنبيه', 'لا توجد بيانات متاحة للطباعة', 'info');
                return;
            }
            openPrintWindow(appState.participants);
        });
    }

    function syncConfigInputs() {
        $('titleInput').value = appState.config.title;
        $('bodyText').value = appState.config.bodyText;
        $('templateSelect').value = appState.config.templateId;
        $('coloredBackground').checked = !!appState.config.coloredBackground;
    }

    function loadSavedConfig() {
        return DB.get(CONFIG_KEY).then(function (saved) {
            appState.config = cloneConfig(saved || DEFAULT_CONFIG);
        }).catch(function () {
            appState.config = cloneConfig(DEFAULT_CONFIG);
        });
    }

    function loadData() {
        return Promise.all([
            DB.getOfficialCenter(),
            DB.get('officialSupervisionTrimester').catch(function () { return ''; }),
            DB.getSettings ? DB.getSettings() : Promise.resolve({}),
            DB.getOfficialCenterMembers(),
            DB.getExamProctors()
        ]).then(function (results) {
            var rawTrimester = String(results[1] || localStorage.getItem('officialSupervisionTrimester') || '').trim();
            var center = normalizeCenter(results[0] || {}, rawTrimester);
            var institutionSettings = results[2] || {};
            var members = Array.isArray(results[3]) ? results[3] : [];
            var proctors = Array.isArray(results[4]) ? results[4] : [];

            appState.center = center;
            appState.institutionSettings = institutionSettings;
            appState.participants = sortParticipants(
                proctors.map(buildProctorParticipant).concat(
                    members.map(buildMemberParticipant)
                )
            );
            appState.selectedIds = {};
        });
    }

    function bootstrap() {
        if (window.Auth && typeof window.Auth.checkAuth === 'function') {
            window.Auth.checkAuth();
        }

        Promise.all([loadSavedConfig(), loadData()]).then(function () {
            syncConfigInputs();
            bindControls();
            renderAll();
        }).catch(function (error) {
            console.error('Official appreciation certificates bootstrap error:', error);
            Swal.fire('خطأ', 'تعذر تحميل صفحة الشهادات التقديرية', 'error');
        });
    }

    document.addEventListener('DOMContentLoaded', bootstrap);
})();
