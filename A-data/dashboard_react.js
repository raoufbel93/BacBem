/**
 * Dashboard React Components
 * Uses React.createElement for no-build offline support
 * Compatible with Windows 7 32-bit (Electron 22)
 */

const e = React.createElement;
const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ==================== HELPERS ====================

function getDashboardTheme() {
    // Check data-theme attribute on document
    var docAttr = document.documentElement.getAttribute('data-theme');
    if (docAttr === 'dark') return 'dark';
    // Check body attribute
    var bodyAttr = document.body ? document.body.getAttribute('data-theme') : null;
    if (bodyAttr === 'dark') return 'dark';
    // Check CSS class
    if (document.documentElement.classList.contains('theme-dark')) return 'dark';
    if (document.body && document.body.classList.contains('theme-dark')) return 'dark';
    // Check localStorage
    try { if (localStorage.getItem('theme') === 'dark') return 'dark'; } catch(e) {}
    // Check parent window (iframe case)
    try {
        if (window.parent && window.parent !== window && window.parent.ThemeManager) {
            if (window.parent.ThemeManager.getCurrentTheme() === 'dark') return 'dark';
        }
    } catch(e) {}
    return 'light';
}

function getDashboardThemePreset() {
    var docPreset = document.documentElement.getAttribute('data-theme-preset');
    if (docPreset) return docPreset;

    var bodyPreset = document.body ? document.body.getAttribute('data-theme-preset') : null;
    if (bodyPreset) return bodyPreset;

    try {
        if (localStorage.getItem('themePreset')) return localStorage.getItem('themePreset');
    } catch (e) {}

    try {
        if (window.parent && window.parent !== window && window.parent.ThemeManager &&
            typeof window.parent.ThemeManager.getCurrentPreset === 'function') {
            return window.parent.ThemeManager.getCurrentPreset();
        }
    } catch (e2) {}

    return 'default';
}

function getDashboardThemeKey() {
    return getDashboardTheme() + ':' + getDashboardThemePreset();
}

function getDashboardPalette() {
    var isDark = getDashboardTheme() === 'dark';
    var styles = null;
    try {
        styles = window.getComputedStyle(document.documentElement);
    } catch (e) {}

    function readVar(name, fallback) {
        if (!styles) return fallback;
        var value = styles.getPropertyValue(name);
        return value ? value.trim() : fallback;
    }

    return {
        text: readVar('--text-color', isDark ? '#e5e7eb' : '#1e293b'),
        muted: readVar('--text-muted', isDark ? '#94a3b8' : '#64748b'),
        grid: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(200, 200, 200, 0.1)',
        chartBorder: readVar('--border-color', isDark ? '#0f172a' : '#dbe5f0'),
        cardBg: readVar('--card-bg', isDark ? '#111827' : '#ffffff'),
        surface: readVar('--surface-3', isDark ? '#0f172a' : '#f8fafc'),
        primary: readVar('--primary-color', isDark ? '#93c5fd' : '#243b53'),
        secondary: readVar('--secondary-color', isDark ? '#60a5fa' : '#2563eb'),
        brandStrong: readVar('--color-brand-strong', isDark ? '#3b82f6' : '#1d4ed8'),
        accent: readVar('--accent-color', isDark ? '#f87171' : '#dc2626'),
        emptyBg: readVar('--card-bg', isDark ? '#111827' : '#ffffff'),
        emptyText: readVar('--primary-color', isDark ? '#f8fafc' : '#243b53')
    };
}

function matchLevel(lvl, target) {
    if (window.AppAcademic && typeof window.AppAcademic.matchLevel === 'function') {
        return window.AppAcademic.matchLevel(lvl, target);
    }
    if (!lvl) return false;
    var s = lvl.toString();
    if (target === '1') return s.indexOf('1') !== -1 || s.indexOf('أولى') !== -1;
    if (target === '2') return s.indexOf('2') !== -1 || s.indexOf('ثانية') !== -1;
    if (target === '3') return s.indexOf('3') !== -1 || s.indexOf('ثالثة') !== -1;
    if (target === '4') return s.indexOf('4') !== -1 || s.indexOf('رابعة') !== -1;
    return false;
}

function countGender(students, gender) {
    return students.filter(function(s) {
        var g = s.gender;
        if (gender === 'M') return g === 'ذكر' || g === 'M' || g === 'ذ';
        return g !== 'ذكر' && g !== 'M' && g !== 'ذ';
    }).length;
}

function countClasses(students) {
    var map = {};
    students.forEach(function(s) {
        var key = '';
        if (s.stream) {
            var stream = s.stream;
            if (stream.indexOf('tech_math') === 0) stream = 'tech_math';
            key = s.level + '_' + stream + '_' + s.class;
        } else {
            key = s.level + '_' + s.class;
        }
        if (key && key !== '_' && key !== '__') map[key] = true;
    });
    return Object.keys(map).length;
}

// Animated counter hook
function useAnimatedCounter(targetValue, duration) {
    duration = duration || 800;
    var ref = useRef(null);
    var startRef = useRef(null);
    var currentRef = useRef(0);
    var _s = useState(0);
    var displayValue = _s[0], setDisplayValue = _s[1];

    useEffect(function() {
        if (typeof targetValue !== 'number' || isNaN(targetValue)) {
            setDisplayValue(0);
            return;
        }
        var startVal = currentRef.current;
        var diff = targetValue - startVal;
        if (diff === 0) return;

        startRef.current = performance.now();
        function animate(now) {
            var elapsed = now - startRef.current;
            var progress = Math.min(elapsed / duration, 1);
            // easeOutQuart
            var eased = 1 - Math.pow(1 - progress, 4);
            var current = Math.round(startVal + diff * eased);
            setDisplayValue(current);
            currentRef.current = current;
            if (progress < 1) {
                ref.current = requestAnimationFrame(animate);
            }
        }
        ref.current = requestAnimationFrame(animate);
        return function() { if (ref.current) cancelAnimationFrame(ref.current); };
    }, [targetValue, duration]);

    return displayValue;
}

// ==================== HEADER COMPONENT ====================

function DashboardHeader(props) {
    var settings = props.settings || {};
    var palette = getDashboardPalette();
    var institutionName = settings.institutionName || 'المؤسسة التعليمية';
    var wilaya = settings.wilaya || '...';

    // Sync from Auth
    if (typeof Auth !== 'undefined' && Auth.getUser) {
        var user = Auth.getUser();
        if (user) {
            if (user.institution) institutionName = user.institution;
            if (user.wilaya) wilaya = user.wilaya;
        }
    }

    var currentYear = settings.currentAcademicYear || settings.schoolYear || '';
    var actualYear = typeof DB !== 'undefined' ? DB.getCurrentAcademicYear() : '';
    var displayYear = typeof window.formatAcademicYear === 'function' ? window.formatAcademicYear(currentYear) : currentYear;

    var isCurrent = currentYear === actualYear;
    var yearIndicator = null;
    if (currentYear === actualYear) {
        yearIndicator = e('span', { style: { background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', marginRight: '8px', fontWeight: '800', border: '1px solid rgba(16, 185, 129, 0.3)' } }, '(الحالية)');
    } else if (currentYear < actualYear) {
        yearIndicator = e('span', { style: { background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', marginRight: '8px', fontWeight: '800', border: '1px solid rgba(239, 68, 68, 0.3)' } }, '(السابقة)');
    }

    var _uv = useState(false);
    var updateHover = _uv[0], setUpdateHover = _uv[1];

    var handleUpdate = function(ev) {
        var badge = ev.currentTarget;
        var icon = badge.querySelector('.update-icon');
        if (icon) icon.classList.add('lucide-spin');
        setTimeout(function() { if (icon) icon.classList.remove('lucide-spin'); }, 3000);
        if (typeof UpdateManager !== 'undefined') UpdateManager.checkForUpdates(true, badge);
    };

    var headerStyle = {
        background: 'linear-gradient(135deg, ' + palette.primary + ' 0%, ' + palette.secondary + ' 100%)',
        padding: '28px 32px',
        borderRadius: '24px',
        marginBottom: '40px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid ' + palette.chartBorder,
        color: '#f8fafc'
    };

    var glowBackground = {
        content: '""',
        position: 'absolute',
        top: 0,
        right: 0,
        width: '30%',
        height: '100%',
        background: 'radial-gradient(ellipse at right top, rgba(255, 255, 255, 0.16) 0%, transparent 70%)',
        pointerEvents: 'none'
    };

    return e('header', { className: 'animate-fade-in-up stagger-1', style: headerStyle },
        e('div', { style: glowBackground }),
        
        // Right Side (Title & Subtitle) RTL
        e('div', { style: { display: 'flex', gap: '24px', alignItems: 'center', zIndex: 1 } },
            e('div', { style: { width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.8rem', boxShadow: '0 10px 25px rgba(245, 158, 11, 0.4)' } },
                e('i', { 'data-lucide': 'school' })
            ),
            e('div', null,
                e('h1', { style: { color: '#f8fafc', margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.5px', textShadow: '0 2px 4px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center' } }, institutionName),
                e('h2', { style: { margin: 0, fontSize: '1.1rem', color: 'rgba(255,255,255,0.84)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' } },
                    e('i', { 'data-lucide': 'landmark', style: { width: '18px', height: '18px', color: '#ffffff' } }),
                    'مديرية التربية لولاية ' + wilaya
                )
            )
        ),

        // Left Side (Badges) RTL
        e('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', zIndex: 1 } },
            e('div', { style: { background: 'rgba(255, 255, 255, 0.10)', backdropFilter: 'blur(10px)', padding: '10px 20px', borderRadius: '100px', border: '1px solid rgba(255, 255, 255, 0.14)', display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontWeight: '700', fontSize: '0.95rem' } },
                e('i', { 'data-lucide': 'calendar', style: { width: '18px', height: '18px', color: '#cbd5e1' } }),
                'السنة الدراسية: ' + displayYear,
                yearIndicator
            ),
            e('div', { 
                onClick: handleUpdate,
                onMouseEnter: function() { setUpdateHover(true); },
                onMouseLeave: function() { setUpdateHover(false); },
                style: { background: updateHover ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.15)', cursor: 'pointer', padding: '8px 18px', borderRadius: '100px', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', gap: '8px', color: '#fcd34d', fontWeight: '800', fontSize: '0.85rem', transition: 'all 0.3s ease', transform: updateHover ? 'translateY(-2px)' : 'none', boxShadow: updateHover ? '0 8px 16px rgba(245, 158, 11, 0.2)' : 'none' } 
            },
                e('i', { 'data-lucide': 'sparkles', style: { width: '16px', height: '16px', color: '#fbbf24' } }),
                'V2.2.10',
                e('i', { 'data-lucide': 'refresh-cw', className: 'update-icon', style: { width: '14px', height: '14px', opacity: 0.8 } })
            )
        )
    );
}

// ==================== QUICK LINKS ====================

var QUICK_LINKS_DATA = [
    { id: 'btn_absence', href: 'absences/absence_tracking.html', icon: 'calendar-check', title: 'متابعة الغيابات' },
    { id: 'btn_students', href: 'students/student_list.html', icon: 'clipboard-list', title: 'قائمة التلاميذ' },
    { id: 'btn_teachers', href: 'staff/teachers.html', icon: 'users-round', title: 'المستخدمين' },
    { id: 'btn_analysis', href: 'analysis/class_analysis.html', icon: 'trending-up', title: 'تحليل النتائج' },
    { id: 'btn_supervision', href: 'exams/supervision.html', icon: 'clock', title: 'جدول الحراسة' },
    { id: 'btn_settings', href: 'settings/settings.html', icon: 'settings', title: 'الإعدادات' }
];

var QUICK_LINKS_PRESENTATION = {
    btn_absence: { subtitle: 'الحضور والتنبيهات', bgGlow: 'rgba(37, 99, 235, 0.15)', iconGrad: 'linear-gradient(135deg, #60a5fa, #2563eb)' },
    btn_students: { subtitle: 'الملفات والبيانات', bgGlow: 'rgba(14, 165, 233, 0.15)', iconGrad: 'linear-gradient(135deg, #38bdf8, #0284c7)' },
    btn_teachers: { subtitle: 'الأساتذة والإداريون', bgGlow: 'rgba(16, 185, 129, 0.15)', iconGrad: 'linear-gradient(135deg, #34d399, #059669)' },
    btn_analysis: { subtitle: 'قراءة سريعة للأداء', bgGlow: 'rgba(139, 92, 246, 0.15)', iconGrad: 'linear-gradient(135deg, #a78bfa, #7c3aed)' },
    btn_supervision: { subtitle: 'تنظيم الفترات والقاعات', bgGlow: 'rgba(245, 158, 11, 0.15)', iconGrad: 'linear-gradient(135deg, #fcd34d, #d97706)' },
    btn_settings: { subtitle: 'تخصيص النظام', bgGlow: 'rgba(239, 68, 68, 0.15)', iconGrad: 'linear-gradient(135deg, #f87171, #dc2626)' }
};

function PremiumQuickLinkCard(props) {
    var link = props.link;
    var meta = props.meta;
    var idx = props.idx;
    var isDark = getDashboardTheme() === 'dark';
    var _hv = useState(false);
    var hovered = _hv[0], setHovered = _hv[1];

    var cardStyle = {
        background: isDark ? 'linear-gradient(145deg, #1e293b, #0f172a)' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
        padding: '20px',
        borderRadius: '20px',
        textDecoration: 'none',
        color: isDark ? '#f8fafc' : '#0f172a',
        boxShadow: hovered 
            ? (isDark ? '0 20px 40px rgba(0,0,0,0.6)' : '0 20px 40px rgba(0,0,0,0.1)') 
            : (isDark ? '0 4px 10px rgba(0,0,0,0.3)' : '0 4px 10px rgba(0,0,0,0.05)'),
        border: '1px solid',
        borderColor: hovered ? 'transparent' : (isDark ? '#334155' : '#e2e8f0'),
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        minHeight: '150px',
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: hovered ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
        outline: 'none'
    };

    var glowStyle = {
        position: 'absolute',
        top: '-50%',
        right: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, ' + meta.bgGlow + ' 0%, transparent 70%)',
        opacity: hovered ? 1 : 0.4,
        transition: 'opacity 0.5s ease',
        pointerEvents: 'none'
    };

    var iconWrapperStyle = {
        width: '56px',
        height: '56px',
        borderRadius: '16px',
        background: meta.iconGrad,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.4rem',
        boxShadow: hovered ? '0 10px 20px ' + meta.bgGlow : '0 4px 10px rgba(0,0,0,0.1)',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: hovered ? 'scale(1.1) rotate(-5deg)' : 'scale(1) rotate(0deg)'
    };

    var arrowStyle = {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isDark ? '#cbd5e1' : '#64748b',
        transition: 'all 0.4s ease',
        transform: hovered ? 'translate(-4px, 4px)' : 'translate(0, 0)',
        opacity: hovered ? 1 : 0.6
    };

    return e('a', {
        href: link.href,
        id: link.id,
        className: 'animate-fade-in-up stagger-' + (idx + 1),
        style: cardStyle,
        onMouseEnter: function() { setHovered(true); },
        onMouseLeave: function() { setHovered(false); },
        onClick: function(ev) {
            if (typeof Auth !== 'undefined' && Auth.requireActivation) Auth.requireActivation(ev);
        }
    },
        e('div', { style: glowStyle }),
        e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'auto', zIndex: 1 } },
            e('div', { style: iconWrapperStyle }, e('i', { 'data-lucide': link.icon })),
            e('div', { style: arrowStyle }, e('i', { 'data-lucide': 'arrow-up-left', style: { width: '16px', height: '16px' } }))
        ),
        e('div', { style: { zIndex: 1, marginTop: '20px' } },
            e('h3', { style: { margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '800' } }, link.title),
            e('p', { style: { margin: 0, fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' } }, meta.subtitle)
        )
    );
}

function QuickLinks(props) {
    var visibility = props.visibility || {};
    return e('section', { style: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '40px' } },
        QUICK_LINKS_DATA.map(function(link, idx) {
            if (visibility[link.id] === false) return null;
            var meta = QUICK_LINKS_PRESENTATION[link.id] || QUICK_LINKS_PRESENTATION.btn_settings;
            return e(PremiumQuickLinkCard, { key: link.id, link: link, meta: meta, idx: idx });
        })
    );
}

// ==================== STAT CARD ====================

function StatCard(props) {
    var animatedValue = useAnimatedCounter(props.value || 0);
    var isDark = getDashboardTheme() === 'dark';
    var _hv = useState(false);
    var hovered = _hv[0], setHovered = _hv[1];

    var shadowColor = props.glowColor || (isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)');

    var cardStyle = {
        position: 'relative',
        overflow: 'hidden',
        background: isDark ? 'linear-gradient(145deg, #1e293b, #0f172a)' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
        padding: '24px',
        borderRadius: '20px',
        boxShadow: hovered ? '0 15px 35px ' + shadowColor : (isDark ? '0 4px 15px rgba(0,0,0,0.2)' : '0 4px 15px rgba(0,0,0,0.05)'),
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        border: '1px solid',
        borderColor: hovered ? (props.borderColor || 'transparent') : (isDark ? '#334155' : '#e2e8f0'),
        cursor: 'pointer'
    };

    var iconWrapperStyle = {
        width: '64px',
        height: '64px',
        borderRadius: '18px',
        background: props.iconBg,
        color: props.iconColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.8rem',
        flexShrink: 0,
        boxShadow: hovered ? '0 10px 20px ' + (props.glowColor || 'rgba(0,0,0,0.1)') : 'none',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: hovered ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)'
    };

    var titleStyle = {
        fontSize: '0.9rem',
        color: isDark ? '#94a3b8' : '#64748b',
        marginBottom: '6px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    };

    var valueStyle = {
        fontSize: '2.2rem',
        fontWeight: '900',
        color: isDark ? '#f8fafc' : '#0f172a',
        margin: 0,
        lineHeight: 1,
        letterSpacing: '-1px'
    };

    var bgGlowStyle = {
        position: 'absolute',
        top: '-50%',
        right: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, ' + (props.glowColor || 'transparent') + ' 0%, transparent 60%)',
        opacity: hovered ? 0.8 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: 'none'
    };

    return e('div', { 
        className: 'animate-fade-in-up stagger-' + (props.stagger || 1) + ' ' + (props.className || ''),
        style: Object.assign({}, cardStyle, props.style || {}),
        onMouseEnter: function() { setHovered(true); },
        onMouseLeave: function() { setHovered(false); }
    },
        e('div', { style: bgGlowStyle }),
        e('div', { style: iconWrapperStyle }, e('i', { 'data-lucide': props.icon })),
        e('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 1 } },
            e('h3', { style: titleStyle }, props.label),
            e('p', { style: valueStyle }, animatedValue)
        )
    );
}

function StatsGrid(props) {
    var students = props.students || [];
    var teachers = props.teachers || [];
    var total = students.length;
    var boys = countGender(students, 'M');
    var girls = total - boys;
    var teacherCount = teachers.length;
    var classCount = countClasses(students);

    return e('div', null,
        e('h3', { className: 'section-title animate-fade-in-up stagger-1', style: { fontSize: '1.4rem', fontWeight: '800', marginBottom: '24px' } },
            e('i', { 'data-lucide': 'bar-chart-2', className: 'text-primary me-2' }), ' إحصائيات عامة'),
        e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '40px' } },
            e(StatCard, { label: 'إجمالي التلاميذ', value: total, icon: 'users', iconBg: 'linear-gradient(135deg, #0ea5e9, #0284c7)', iconColor: '#fff', glowColor: 'rgba(14, 165, 233, 0.2)', borderColor: '#0ea5e9', stagger: 2 }),
            e(StatCard, { label: 'الذكور', value: boys, icon: 'user', iconBg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', iconColor: '#fff', glowColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3b82f6', stagger: 3 }),
            e(StatCard, { label: 'الإناث', value: girls, icon: 'user', iconBg: 'linear-gradient(135deg, #f43f5e, #be123c)', iconColor: '#fff', glowColor: 'rgba(244, 63, 94, 0.2)', borderColor: '#f43f5e', stagger: 4 }),
            e(StatCard, { label: 'الأساتذة', value: teacherCount, icon: 'briefcase', iconBg: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', iconColor: '#fff', glowColor: 'rgba(139, 92, 246, 0.2)', borderColor: '#8b5cf6', stagger: 5 }),
            e(StatCard, { label: 'الأفواج', value: classCount, icon: 'door-open', iconBg: 'linear-gradient(135deg, #f59e0b, #b45309)', iconColor: '#fff', glowColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#f59e0b', stagger: 6 })
        )
    );
}

// ==================== DISCIPLINARY SECTION ====================

function DisciplinarySection(props) {
    var stats = props.stats || { notice1: 0, notice2: 0, warning: 0, strikeoff: 0 };
    var isDark = getDashboardTheme() === 'dark';
    
    var items = [
        { label: 'إشعار 1 (3 أيام)', value: stats.notice1, icon: 'mail-open', bg: 'linear-gradient(135deg, #fcd34d, #d97706)', color: '#fff', glowColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#f59e0b' },
        { label: 'إشعار 2 (11 يوم)', value: stats.notice2, icon: 'file-signature', bg: 'linear-gradient(135deg, #fb923c, #c2410c)', color: '#fff', glowColor: 'rgba(249, 115, 22, 0.2)', borderColor: '#f97316' },
        { label: 'إعذار (18 يوم)', value: stats.warning, icon: 'alert-triangle', bg: 'linear-gradient(135deg, #f87171, #b91c1c)', color: '#fff', glowColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444' },
        { label: 'شطب (33 يوم)', value: stats.strikeoff, icon: 'user-minus', bg: 'linear-gradient(135deg, #ef4444, #991b1b)', color: '#fff', glowColor: 'rgba(220, 38, 38, 0.2)', borderColor: '#dc2626' }
    ];

    var boxStyle = {
        background: isDark ? 'linear-gradient(145deg, #1e293b, #0f172a)' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
        padding: '30px',
        borderRadius: '24px',
        boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.05)',
        border: '1px solid',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderTop: '4px solid #ef4444',
        marginBottom: '40px'
    };

    return e('div', { className: 'animate-fade-in-up stagger-7', style: boxStyle },
        e('h3', { className: 'section-title', style: { color: '#ef4444', marginBottom: '24px', fontSize: '1.4rem', fontWeight: '800' } },
            e('i', { 'data-lucide': 'alert-circle', className: 'me-2' }), ' وضعية المواظبة (الغيابات المتواصلة)'),
        e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' } },
            items.map(function(item, idx) {
                return e(StatCard, { 
                    key: idx,
                    label: item.label,
                    value: item.value,
                    icon: item.icon,
                    iconBg: item.bg,
                    iconColor: item.color,
                    glowColor: item.glowColor,
                    borderColor: item.borderColor,
                    style: { background: isDark ? '#0f172a' : '#f8fafc', boxShadow: 'none' }
                });
            })
        )
    );
}

// ==================== CHART SECTION ====================

function ChartBox(props) {
    var canvasRef = useRef(null);
    var chartRef = useRef(null);

    useEffect(function() {
        if (!canvasRef.current || typeof Chart === 'undefined') return;
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

        var ctx = canvasRef.current.getContext('2d');
        chartRef.current = new Chart(ctx, props.config);

        return function() {
            if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
        };
    }, [props.config, props.themeKey]);

    return e('div', { className: 'chart-box animate-fade-in-up stagger-' + (props.stagger || 1), style: props.style || {} },
        e('h3', { className: 'section-title', style: { marginBottom: '16px' } },
            e('i', { 'data-lucide': props.icon, className: props.iconClass || 'text-primary me-2' }), ' ', props.title),
        e('div', { className: 'chart-wrapper' },
            e('canvas', { ref: canvasRef })
        )
    );
}

// ==================== REACT DONUT CHART ====================

function ReactDonutChart(props) {
    var students = props.students || [];
    var boys = countGender(students, 'M');
    var girls = students.length - boys;
    var total = boys + girls;
    
    var _ah = useState(null);
    var activeArc = _ah[0], setActiveArc = _ah[1];

    var _an = useState(false);
    var animated = _an[0], setAnimated = _an[1];

    useEffect(function() {
        var timer = setTimeout(function() { setAnimated(true); }, 150);
        return function() { clearTimeout(timer); };
    }, []);

    var radius = 42;
    var cx = 50;
    var cy = 50;
    var circumference = 2 * Math.PI * radius;
    
    if (total === 0) {
        return e('div', { className: 'chart-box animate-fade-in-up stagger-1', style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: '380px' } },
            e('h3', { className: 'section-title', style: { marginBottom: '16px' } },
                e('i', { 'data-lucide': 'pie-chart', className: 'text-rose-500 me-2' }), ' توزيع الجنس'),
            e('div', { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, 'لا توجد بيانات')
        );
    }
    
    var boysPercent = boys / total;
    var girlsPercent = girls / total;
    
    var boysDash = boysPercent * circumference;
    var girlsDash = girlsPercent * circumference;
    
    var gap = 2.5; 
    
    var currentBoysDash = animated ? Math.max(0, boysDash - gap) : 0;
    var currentGirlsDash = animated ? Math.max(0, girlsDash - gap) : 0;

    var boysDashArray = currentBoysDash + ' ' + circumference;
    var boysOffset = 0;
    
    var girlsDashArray = currentGirlsDash + ' ' + circumference;
    var girlsOffset = -boysDash;

    var chartPalette = getDashboardPalette();
    var themeText = chartPalette.text;
    var themeMuted = chartPalette.muted;

    var isBoysHovered = activeArc === 'boys';
    var isGirlsHovered = activeArc === 'girls';

    return e('div', { className: 'chart-box animate-fade-in-up stagger-1', style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: '380px', position: 'relative' } },
        e('h3', { className: 'section-title', style: { marginBottom: '0' } },
            e('i', { 'data-lucide': 'pie-chart', className: 'text-rose-500 me-2' }), ' توزيع الجنس'),
            
        e('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', marginTop: '10px' } },
            e('svg', { viewBox: '0 0 100 100', style: { width: '100%', maxHeight: '250px', overflow: 'visible', transform: 'rotate(-90deg)' } },
                // Background track
                e('circle', {
                    cx: cx, cy: cy, r: radius,
                    fill: 'none', stroke: getDashboardPalette().grid, strokeWidth: '10'
                }),
                
                // Boys Arc
                e('circle', {
                    cx: cx, cy: cy, r: radius,
                    fill: 'none', stroke: 'url(#gradientBoys)', strokeWidth: isBoysHovered ? '14' : '12',
                    strokeDasharray: boysDashArray,
                    strokeDashoffset: boysOffset,
                    strokeLinecap: 'round',
                    style: { transition: 'stroke-dasharray 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), stroke-width 0.3s, filter 0.3s', cursor: 'pointer', filter: isBoysHovered ? 'drop-shadow(0px 0px 8px ' + chartPalette.secondary + ')' : 'none' },
                    onMouseEnter: function() { setActiveArc('boys'); },
                    onMouseLeave: function() { setActiveArc(null); },
                    onClick: function() { setActiveArc(isBoysHovered ? null : 'boys'); }
                }),
                
                // Girls Arc
                e('circle', {
                    cx: cx, cy: cy, r: radius,
                    fill: 'none', stroke: 'url(#gradientGirls)', strokeWidth: isGirlsHovered ? '14' : '12',
                    strokeDasharray: girlsDashArray,
                    strokeDashoffset: girlsOffset,
                    strokeLinecap: 'round',
                    style: { transition: 'stroke-dasharray 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), stroke-width 0.3s, filter 0.3s', cursor: 'pointer', filter: isGirlsHovered ? 'drop-shadow(0px 0px 8px rgba(244,63,94,0.5))' : 'none' },
                    onMouseEnter: function() { setActiveArc('girls'); },
                    onMouseLeave: function() { setActiveArc(null); },
                    onClick: function() { setActiveArc(isGirlsHovered ? null : 'girls'); }
                }),
                
                // Gradients definition
                e('defs', null,
                    e('linearGradient', { id: 'gradientBoys', x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
                        e('stop', { offset: '0%', stopColor: chartPalette.secondary }),
                        e('stop', { offset: '100%', stopColor: chartPalette.brandStrong })
                    ),
                    e('linearGradient', { id: 'gradientGirls', x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
                        e('stop', { offset: '0%', stopColor: '#fb7185' }),
                        e('stop', { offset: '100%', stopColor: '#e11d48' })
                    )
                )
            ),
            
            // Center Text
            e('div', { style: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
                e('span', { style: { fontSize: '2.5rem', fontWeight: '900', color: themeText, lineHeight: '1', marginBottom: '2px', fontFamily: '"Cairo", sans-serif', transition: 'all 0.3s' } }, 
                    isBoysHovered ? boys : isGirlsHovered ? girls : total
                ),
                e('span', { style: { fontSize: '1rem', fontWeight: '700', color: themeMuted, fontFamily: '"Cairo", sans-serif', transition: 'all 0.3s' } }, 
                    isBoysHovered ? 'ذكور' : isGirlsHovered ? 'إناث' : 'المجموع'
                )
            )
        ),
        
        // Custom Legend
        e('div', { style: { display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '20px', paddingBottom: '10px' } },
            e('div', { 
                style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: activeArc && !isBoysHovered ? 0.4 : 1, transition: 'all 0.3s ease', transform: isBoysHovered ? 'translateY(-2px)' : 'none' },
                onMouseEnter: function() { setActiveArc('boys'); },
                onMouseLeave: function() { setActiveArc(null); }
            },
                e('div', { style: { width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, ' + chartPalette.secondary + ', ' + chartPalette.brandStrong + ')' } }),
                e('span', { style: { fontWeight: '700', color: themeText, fontSize: '0.95rem' } }, 'ذكور'),
                e('span', { style: { fontWeight: '800', color: chartPalette.secondary, fontSize: '1rem', marginLeft: '4px' } }, Math.round(boysPercent * 100) + '%')
            ),
            e('div', { 
                style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: activeArc && !isGirlsHovered ? 0.4 : 1, transition: 'all 0.3s ease', transform: isGirlsHovered ? 'translateY(-2px)' : 'none' },
                onMouseEnter: function() { setActiveArc('girls'); },
                onMouseLeave: function() { setActiveArc(null); }
            },
                e('div', { style: { width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #fb7185, #e11d48)', boxShadow: '0 4px 8px rgba(244,63,94,0.3)' } }),
                e('span', { style: { fontWeight: '700', color: themeText, fontSize: '0.95rem' } }, 'إناث'),
                e('span', { style: { fontWeight: '800', color: '#f43f5e', fontSize: '1rem', marginLeft: '4px' } }, Math.round(girlsPercent * 100) + '%')
            )
        )
    );
}

// ==================== REACT BAR CHART ====================

function ReactBarChart(props) {
    var students = props.students || [];
    var settings = props.settings || {};
    var isSecondary = settings.educationStage === 'secondary';

    var levels = isSecondary ? ['1', '2', '3'] : ['1', '2', '3', '4'];
    var levelLabels = isSecondary
        ? ['الأولى', 'الثانية', 'الثالثة']
        : ['الأولى', 'الثانية', 'الثالثة', 'الرابعة'];

    var counts = levels.map(function(lvl) {
        return students.filter(function(s) { return matchLevel(s.level, lvl); }).length;
    });

    var maxCount = Math.max.apply(null, counts);
    if (maxCount === 0) maxCount = 1; 
    var yMax = Math.ceil(maxCount * 1.2); // Add 20% padding at the top

    var _an = useState(false);
    var animated = _an[0], setAnimated = _an[1];
    var _hv = useState(null);
    var hoveredIndex = _hv[0], setHoveredIndex = _hv[1];

    useEffect(function() {
        var timer = setTimeout(function() { setAnimated(true); }, 200);
        return function() { clearTimeout(timer); };
    }, []);

    var themeText = getDashboardPalette().text;
    var themeMuted = getDashboardPalette().muted;
    var gridColor = getDashboardPalette().grid;

    var gradients = [
        'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)', // Blue
        'linear-gradient(180deg, #34d399 0%, #059669 100%)', // Emerald
        'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)', // Violet
        'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)'  // Amber
    ];

    var shadowColors = [
        'rgba(59, 130, 246, 0.4)',
        'rgba(16, 185, 129, 0.4)',
        'rgba(139, 92, 246, 0.4)',
        'rgba(245, 158, 11, 0.4)'
    ];

    if (students.length === 0) {
        return e('div', { className: 'chart-box animate-fade-in-up stagger-2', style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: '380px' } },
            e('h3', { className: 'section-title', style: { marginBottom: '16px' } },
                e('i', { 'data-lucide': 'bar-chart-2', className: 'text-primary me-2' }), ' التوزيع حسب المستوى'),
            e('div', { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, 'لا توجد بيانات')
        );
    }

    // Grid lines (4 lines)
    var gridLines = [0, 0.25, 0.5, 0.75, 1].map(function(ratio) {
        return Math.round(yMax * ratio);
    });

    return e('div', { className: 'chart-box animate-fade-in-up stagger-2', style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: '380px' } },
        e('h3', { className: 'section-title', style: { marginBottom: '24px' } },
            e('i', { 'data-lucide': 'bar-chart-2', className: 'text-primary me-2' }), ' التوزيع حسب المستوى'),

        e('div', { style: { flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-end', paddingTop: '20px', paddingBottom: '30px', paddingLeft: '50px', marginTop: '10px' } },
            
            // Y-Axis Grid & Labels
            gridLines.map(function(val, idx) {
                var bottomPercent = (idx / 4) * 100;
                return e('div', { key: 'grid-' + idx, style: { position: 'absolute', bottom: 'calc(' + bottomPercent + '% + 30px)', left: 0, right: 0, height: '1px', backgroundColor: idx === 0 ? 'transparent' : gridColor, zIndex: 1 } },
                    e('span', { style: { position: 'absolute', left: 0, top: '-8px', fontSize: '0.8rem', color: themeMuted, fontWeight: '700', fontFamily: '"Cairo", sans-serif' } }, val)
                );
            }),

            // Bars Container
            e('div', { style: { flex: 1, display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-around', alignItems: 'flex-end', height: '100%', position: 'relative', zIndex: 2, marginRight: '10px', marginLeft: '10px' } },
                counts.map(function(count, idx) {
                    var heightPercent = (count / yMax) * 100;
                    var isHovered = hoveredIndex === idx;
                    var barHeight = animated ? heightPercent : 0;
                    var isTall = heightPercent > 15;
                    
                    return e('div', { 
                        key: 'bar-' + idx,
                        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: isSecondary ? '25%' : '20%', height: '100%', justifyContent: 'flex-end', cursor: 'pointer' },
                        onMouseEnter: function() { setHoveredIndex(idx); },
                        onMouseLeave: function() { setHoveredIndex(null); }
                    },
                        // The Bar
                        e('div', { 
                            style: { 
                                width: '100%', 
                                maxWidth: '56px',
                                height: barHeight + '%', 
                                background: gradients[idx], 
                                borderRadius: '12px 12px 0 0',
                                transition: 'height 1s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.3s, transform 0.3s',
                                filter: isHovered ? 'brightness(1.1) drop-shadow(0 0 12px ' + shadowColors[idx] + ')' : 'none',
                                transform: isHovered ? 'translateY(-4px)' : 'none',
                                position: 'relative',
                                display: 'flex',
                                justifyContent: 'center'
                            } 
                        },
                            // Floating Value inside or above bar
                            e('div', { 
                                style: { 
                                    position: 'absolute', 
                                    top: isTall ? '12px' : '-28px',
                                    color: isTall ? '#ffffff' : themeText,
                                    fontWeight: '800',
                                    fontSize: '1.1rem',
                                    fontFamily: '"Cairo", sans-serif',
                                    textShadow: isTall ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                                    opacity: animated ? 1 : 0,
                                    transition: 'opacity 0.5s ease 0.8s'
                                } 
                            }, count)
                        ),
                        // X-Axis Label
                        e('div', { 
                            style: { 
                                marginTop: '12px', 
                                color: isHovered ? themeText : themeMuted, 
                                fontWeight: isHovered ? '800' : '700', 
                                fontSize: '0.9rem',
                                transition: 'all 0.3s',
                                position: 'absolute',
                                bottom: '-30px',
                                fontFamily: '"Cairo", sans-serif'
                            } 
                        }, levelLabels[idx])
                    );
                })
            )
        )
    );
}

// ==================== ABSENCES LINE CHART ====================

function AbsencesLineChart(props) {
    var history = props.history || [];
    var isDark = getDashboardTheme() === 'dark';
    var _hv = useState(null);
    var hoveredIndex = _hv[0], setHoveredIndex = _hv[1];
    
    if (history.length < 2) return null;

    var counts = history.map(function(h) { return h.studentCount; });
    var dates = history.map(function(h) { 
        var d = new Date(h.date);
        var day = d.getDate();
        var month = d.getMonth() + 1;
        return day + '/' + month;
    });

    var maxCount = Math.max.apply(null, counts);
    if (maxCount === 0) maxCount = 1;
    var yMax = Math.ceil(maxCount * 1.4);

    var width = 1000;
    var height = 280;
    var paddingX = 60;
    var paddingY = 50;
    
    var points = counts.map(function(count, i) {
        var x = paddingX + (i * (width - 2 * paddingX) / (counts.length - 1));
        var y = height - paddingY - (count * (height - 2 * paddingY) / yMax);
        return { x: x, y: y, count: count, date: dates[i] };
    });

    // Function to generate smooth Bezier path
    function getCurvePath(pts) {
        if (pts.length < 2) return '';
        var d = 'M' + pts[0].x + ',' + pts[0].y;
        for (var i = 0; i < pts.length - 1; i++) {
            var cp1x = pts[i].x + (pts[i+1].x - pts[i].x) / 2;
            var cp1y = pts[i].y;
            var cp2x = pts[i].x + (pts[i+1].x - pts[i].x) / 2;
            var cp2y = pts[i+1].y;
            d += ' C' + cp1x + ',' + cp1y + ' ' + cp2x + ',' + cp2y + ' ' + pts[i+1].x + ',' + pts[i+1].y;
        }
        return d;
    }

    var pathData = getCurvePath(points);
    var areaData = pathData + ' L' + points[points.length - 1].x + ',' + (height - paddingY) + ' L' + points[0].x + ',' + (height - paddingY) + ' Z';

    var themePalette = getDashboardPalette();

    return e('div', { 
        className: 'animate-fade-in-up stagger-8', 
        style: { 
            background: isDark ? 'linear-gradient(145deg, #1e293b, #0f172a)' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
            padding: '35px',
            borderRadius: '30px',
            boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.4)' : '0 20px 50px rgba(0,0,0,0.08)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            marginBottom: '40px',
            position: 'relative',
            overflow: 'hidden'
        } 
    },
        // Background Decorative Glow
        e('div', { style: { position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(var(--secondary-rgb), 0.15) 0%, transparent 70%)', pointerEvents: 'none' } }),

        e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' } },
            e('h3', { style: { margin: 0, color: isDark ? '#f8fafc' : '#1e293b', fontSize: '1.5rem', fontWeight: '850', display: 'flex', alignItems: 'center', gap: '12px' } },
                e('div', { style: { width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(var(--secondary-rgb), 0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
                    e('i', { 'data-lucide': 'trending-up', style: { color: themePalette.secondary, width: '24px', height: '24px' } })
                ),
                'نشاط الغيابات (آخر 15 تقرير)'
            ),
            e('div', { style: { padding: '8px 16px', borderRadius: '100px', background: 'rgba(var(--secondary-rgb), 0.10)', color: themePalette.secondary, fontSize: '0.9rem', fontWeight: '700' } },
                'متوسط الغيابات: ' + (counts.reduce(function(a,b){return a+b},0)/counts.length).toFixed(1)
            )
        ),
        
        e('div', { style: { position: 'relative', width: '100%', height: height + 'px' } },
            e('svg', { 
                viewBox: '0 0 ' + width + ' ' + height, 
                style: { width: '100%', height: '100%', overflow: 'visible' } 
            },
                e('defs', null,
                    e('linearGradient', { id: 'lineGrad', x1: '0%', y1: '0%', x2: '100%', y2: '0%' },
                        e('stop', { offset: '0%', stopColor: themePalette.secondary }),
                        e('stop', { offset: '50%', stopColor: themePalette.brandStrong }),
                        e('stop', { offset: '100%', stopColor: '#ec4899' })
                    ),
                    e('linearGradient', { id: 'areaGrad', x1: '0%', y1: '0%', x2: '0%', y2: '100%' },
                        e('stop', { offset: '0%', stopColor: themePalette.secondary, stopOpacity: 0.2 }),
                        e('stop', { offset: '100%', stopColor: themePalette.secondary, stopOpacity: 0 })
                    ),
                    e('filter', { id: 'glow' },
                        e('feGaussianBlur', { stdDeviation: '3', result: 'coloredBlur' }),
                        e('feMerge', null,
                            e('feMergeNode', { in: 'coloredBlur' }),
                            e('feMergeNode', { in: 'SourceGraphic' })
                        )
                    )
                ),
                
                // X and Y Main Axis Lines
                e('line', { x1: paddingX, y1: paddingY, x2: paddingX, y2: height - paddingY, stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 2 }), // Y Axis
                e('line', { x1: paddingX, y1: height - paddingY, x2: width - paddingX, y2: height - paddingY, stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 2 }), // X Axis

                // Horizontal Grid Lines and Y Labels
                [0, 0.25, 0.5, 0.75, 1].map(function(r, i) {
                    var y = height - paddingY - (r * (height - 2 * paddingY));
                    return e('g', { key: 'grid-' + i },
                        r > 0 && e('line', { x1: paddingX, y1: y, x2: width - paddingX, y2: y, stroke: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', strokeWidth: 1 }),
                        e('text', { 
                            x: paddingX - 15, y: y + 5, 
                            textAnchor: 'end', 
                            fill: isDark ? '#94a3b8' : '#64748b', 
                            fontSize: '12', 
                            fontWeight: '800', 
                            fontFamily: 'Inter' 
                        }, Math.round(yMax * r))
                    );
                }),

                // Y Axis Label (Vertical)
                e('text', {
                    transform: 'rotate(-90)',
                    x: -(height / 2),
                    y: 20,
                    textAnchor: 'middle',
                    fill: isDark ? '#64748b' : '#94a3b8',
                    fontSize: '11',
                    fontWeight: '850',
                    letterSpacing: '1px'
                }, 'عدد الغيابات'),

                // Vertical Guide Line on Hover
                hoveredIndex !== null && e('line', { 
                    x1: points[hoveredIndex].x, y1: paddingY, x2: points[hoveredIndex].x, y2: height - paddingY, 
                    stroke: themePalette.secondary, strokeWidth: 2, strokeDasharray: '4,4', opacity: 0.5 
                }),

                // The Area Fill
                e('path', { d: areaData, fill: 'url(#areaGrad)', transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }),
                
                // The Main Line
                e('path', { 
                    d: pathData, 
                    fill: 'none', 
                    stroke: 'url(#lineGrad)', 
                    strokeWidth: 5, 
                    strokeLinecap: 'round', 
                    strokeLinejoin: 'round',
                    filter: 'url(#glow)',
                    style: { transition: 'all 0.5s ease' }
                }),
                
                // Interaction Area / Points
                points.map(function(p, i) {
                    var isHovered = hoveredIndex === i;
                    return e('g', { 
                        key: 'pt-' + i,
                        onMouseEnter: function() { setHoveredIndex(i); },
                        onMouseLeave: function() { setHoveredIndex(null); },
                        style: { cursor: 'pointer' }
                    },
                        // X Axis Ticks
                        e('line', { x1: p.x, y1: height - paddingY, x2: p.x, y2: height - paddingY + 5, stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 2 }),

                        // Larger invisible hit area
                        e('circle', { cx: p.x, cy: p.y, r: 20, fill: 'transparent' }),
                        
                        // Visible Point
                        e('circle', { 
                            cx: p.x, cy: p.y, 
                            r: isHovered ? 8 : 4, 
                            fill: isHovered ? '#fff' : themePalette.secondary, 
                            stroke: themePalette.secondary, 
                            strokeWidth: isHovered ? 4 : 2,
                            style: { transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }
                        }),

                        // Date Labels (X-Axis)
                        e('text', { 
                            x: p.x, y: height - 15, 
                            textAnchor: 'middle', 
                            fill: isHovered ? themePalette.secondary : (isDark ? '#94a3b8' : '#64748b'), 
                            fontSize: '12', 
                            fontWeight: isHovered ? '850' : '700',
                            style: { transition: 'all 0.2s', fontFamily: 'Inter' }
                        }, p.date)
                    );
                }),
                
                // X Axis Label
                e('text', {
                    x: width - paddingX + 10,
                    y: height - paddingY + 5,
                    textAnchor: 'start',
                    fill: isDark ? '#64748b' : '#94a3b8',
                    fontSize: '11',
                    fontWeight: '850',
                    letterSpacing: '1px'
                }, 'التاريخ')
            ),

            // Enhanced Glassmorphic Tooltip
            hoveredIndex !== null && e('div', {
                style: {
                    position: 'absolute',
                    left: (points[hoveredIndex].x / width * 100) + '%',
                    top: (points[hoveredIndex].y - 60) + 'px',
                    transform: 'translateX(-50%)',
                    background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)',
                    padding: '10px 15px',
                    borderRadius: '15px',
                    border: '1px solid rgba(var(--secondary-rgb), 0.30)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    pointerEvents: 'none',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '80px',
                    animation: 'tooltipIn 0.2s ease-out'
                }
            },
                e('span', { style: { fontSize: '0.75rem', color: themePalette.muted, fontWeight: '600', marginBottom: '2px' } }, points[hoveredIndex].date),
                e('span', { style: { fontSize: '1.2rem', color: themePalette.secondary, fontWeight: '900' } }, points[hoveredIndex].count),
                e('span', { style: { fontSize: '0.7rem', color: themePalette.muted, fontWeight: '700' } }, 'تلميذ غائب')
            )
        )
    );
}

function ChartsSection(props) {
    return e('div', { className: 'charts-row' },
        e(ReactBarChart, { students: props.students, settings: props.settings, themeKey: props.themeKey }),
        e(ReactDonutChart, { students: props.students, themeKey: props.themeKey })
    );
}

// ==================== LEVELS DETAIL GRID ====================

function LevelsDetailGrid(props) {
    var students = props.students || [];
    var settings = props.settings || {};
    var isSecondary = settings.educationStage === 'secondary';
    
    var levels = isSecondary ? ['1', '2', '3'] : ['1', '2', '3', '4'];
    var levelLabels = isSecondary
        ? ['الأولى ثانوي', 'الثانية ثانوي', 'الثالثة ثانوي']
        : ['الأولى متوسط', 'الثانية متوسط', 'الثالثة متوسط', 'الرابعة متوسط'];

    return e('div', { className: 'animate-fade-in-up stagger-4', style: { marginBottom: '40px' } },
        e('h3', { className: 'section-title', style: { marginBottom: '24px', fontSize: '1.4rem', fontWeight: '800' } },
            e('i', { 'data-lucide': 'layers', className: 'text-info me-2' }), ' تفاصيل المستويات'),
        e('div', { style: { display: 'grid', gridTemplateColumns: isSecondary ? 'repeat(auto-fit, minmax(250px, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' } },
            levels.map(function(lvl, idx) {
                var lvlStudents = students.filter(function(s) { return matchLevel(s.level, lvl); });
                var count = lvlStudents.length;
                var b = countGender(lvlStudents, 'M');
                var g = count - b;
                var classMap = {};
                lvlStudents.forEach(function(s) { if (s.class) classMap[s.class] = true; });
                var cCount = Object.keys(classMap).length;

                return e(LevelCardPremium, {
                    key: lvl,
                    title: levelLabels[idx],
                    count: count,
                    boys: b,
                    girls: g,
                    classes: cCount,
                    idx: idx
                });
            })
        )
    );
}

function LevelCardPremium(props) {
    var isDark = getDashboardTheme() === 'dark';
    var _hv = useState(false);
    var hovered = _hv[0], setHovered = _hv[1];
    var animatedCount = useAnimatedCounter(props.count);

    var cardStyle = {
        background: isDark ? 'linear-gradient(145deg, #1e293b, #0f172a)' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
        padding: '24px',
        borderRadius: '20px',
        textAlign: 'center',
        border: '1px solid',
        borderColor: hovered ? '#38bdf8' : (isDark ? '#334155' : '#e2e8f0'),
        boxShadow: hovered 
            ? (isDark ? '0 15px 30px rgba(0,0,0,0.5)' : '0 15px 30px rgba(0,0,0,0.1)') 
            : (isDark ? '0 4px 10px rgba(0,0,0,0.2)' : '0 4px 10px rgba(0,0,0,0.05)'),
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
    };

    var iconBgStyle = {
        width: '48px',
        height: '48px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.4rem',
        marginBottom: '16px',
        boxShadow: hovered ? '0 8px 16px rgba(56, 189, 248, 0.3)' : 'none',
        transition: 'all 0.4s ease',
        transform: hovered ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)'
    };

    return e('div', {
        style: cardStyle,
        onMouseEnter: function() { setHovered(true); },
        onMouseLeave: function() { setHovered(false); }
    },
        e('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #38bdf8, #818cf8)' } }),
        e('div', { style: iconBgStyle }, e('i', { 'data-lucide': 'users' })),
        e('h4', { style: { fontSize: '1rem', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px', fontWeight: '700' } }, props.title),
        e('div', { style: { fontSize: '2.5rem', fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a', margin: '4px 0', lineHeight: 1 } }, animatedCount),
        
        e('div', { style: { display: 'flex', gap: '16px', marginTop: '16px', padding: '12px 16px', background: isDark ? 'rgba(0,0,0,0.2)' : '#f1f5f9', borderRadius: '12px', width: '100%', justifyContent: 'center' } },
            e('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6', fontWeight: '700', fontSize: '0.9rem' } },
                e('i', { className: 'fas fa-male' }), props.boys
            ),
            e('div', { style: { width: '1px', background: isDark ? '#334155' : '#cbd5e1' } }),
            e('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e', fontWeight: '700', fontSize: '0.9rem' } },
                e('i', { className: 'fas fa-female' }), props.girls
            )
        ),
        e('div', { style: { marginTop: '16px', fontSize: '0.85rem', color: '#8b5cf6', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' } },
            e('i', { 'data-lucide': 'door-open', style: { width: '14px', height: '14px' } }), props.classes + ' أفواج'
        )
    );
}

// ==================== EMPTY STATE ====================

function EmptyState() {
    return e('div', { style: { textAlign: 'center', padding: '40px 20px', background: getDashboardPalette().emptyBg, borderRadius: '15px', marginBottom: '25px' } },
        e('div', { style: { fontSize: '4rem', marginBottom: '15px' } }, '📂'),
        e('h3', { style: { marginBottom: '10px', color: getDashboardPalette().emptyText } }, 'لا توجد بيانات تلاميذ'),
        e('p', { style: { color: getDashboardPalette().muted, marginBottom: '20px' } }, 'قم باستيراد بيانات التلاميذ لعرض الإحصائيات هنا.'),
        e('a', { href: 'students/import_students.html', style: { display: 'inline-block', background: 'var(--secondary-color)', color: 'white', padding: '12px 30px', borderRadius: '25px', textDecoration: 'none', fontWeight: 'bold' } }, '📥 استيراد التلاميذ')
    );
}

// ==================== LOADING SKELETON ====================

function LoadingSkeleton() {
    var pulseStyle = {
        background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        borderRadius: '10px'
    };
    return e('div', { style: { padding: '20px 0' } },
        e('div', { style: Object.assign({}, pulseStyle, { height: '100px', marginBottom: '24px' }) }),
        e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px' } },
            [1,2,3,4,5,6].map(function(i) { return e('div', { key: i, style: Object.assign({}, pulseStyle, { height: '80px' }) }); })
        ),
        e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' } },
            [1,2,3,4,5].map(function(i) { return e('div', { key: i, style: Object.assign({}, pulseStyle, { height: '90px' }) }); })
        ),
        e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' } },
            e('div', { style: Object.assign({}, pulseStyle, { height: '320px' }) }),
            e('div', { style: Object.assign({}, pulseStyle, { height: '320px' }) })
        )
    );
}

// ==================== TRIAL NOTICE ====================

function TrialNotice() {
    var _s = useState(false);
    var show = _s[0], setShow = _s[1];

    useEffect(function() {
        if (typeof Auth !== 'undefined' && Auth.getUser) {
            var user = Auth.getUser();
            if (user && user.status !== '1') setShow(true);
        }
    }, []);

    if (!show) return null;
    return e('div', { id: 'trialNotice', style: { display: 'flex' } },
        e('i', { 'data-lucide': 'alert-triangle' }),
        e('span', null, 'تنبيه: أنت حالياً تستخدم النسخة التجريبية. الميزات الأساسية مفعلة، يمكنك ترقية حسابك للحصول على النسخة الكاملة.'),
        e('a', { href: 'subscription.html' }, 'تفعيل الآن')
    );
}

// ==================== DISCIPLINARY STATS CALCULATION ====================

function calculateDisciplinaryStats(students) {
    return DB.getAllAbsencesExport().then(function(records) {
        var absenceRecords = (records || []).sort(function(a, b) { return b.date.localeCompare(a.date); });
        var currentDate = new Date().toISOString().split('T')[0];
        var stats = { notice1: 0, notice2: 0, warning: 0, strikeoff: 0 };

        if (absenceRecords.length === 0) return stats;

        students.forEach(function(student) {
            var studentId = String(student.id || (student.last_name + '-' + student.first_name));
            var streakDays = 0;

            for (var i = 0; i < absenceRecords.length; i++) {
                var record = absenceRecords[i];
                if (record.date > currentDate) continue;

                var isAbsent = false;
                if (record.students) {
                    for (var j = 0; j < record.students.length; j++) {
                        if (String(record.students[j].id) === studentId) { isAbsent = true; break; }
                    }
                }

                if (isAbsent) {
                    var streakStartDate = record.date;
                    for (var k = i + 1; k < absenceRecords.length; k++) {
                        var r2 = absenceRecords[k];
                        var ia2 = false;
                        if (r2.students) {
                            for (var m = 0; m < r2.students.length; m++) {
                                if (String(r2.students[m].id) === studentId) { ia2 = true; break; }
                            }
                        }
                        if (ia2) streakStartDate = r2.date;
                        else break;
                    }
                    var curr = new Date(currentDate);
                    var start = new Date(streakStartDate);
                    streakDays = Math.ceil(Math.abs(curr - start) / (1000 * 60 * 60 * 24)) + 1;
                    break;
                } else { break; }
            }

            if (streakDays >= 33) stats.strikeoff++;
            else if (streakDays >= 18) stats.warning++;
            else if (streakDays >= 11) stats.notice2++;
            else if (streakDays >= 3) stats.notice1++;
        });

        return stats;
    });
}

// ==================== MAIN DASHBOARD APP ====================

function DashboardApp() {
    var _l = useState(true);
    var loading = _l[0], setLoading = _l[1];
    var _st = useState([]);
    var students = _st[0], setStudents = _st[1];
    var _te = useState([]);
    var teachers = _te[0], setTeachers = _te[1];
    var _se = useState({});
    var settings = _se[0], setSettings = _se[1];
    var _ds = useState({ notice1: 0, notice2: 0, warning: 0, strikeoff: 0 });
    var discStats = _ds[0], setDiscStats = _ds[1];
    var _ah = useState([]);
    var absenceHistory = _ah[0], setAbsenceHistory = _ah[1];
    var _bv = useState({});
    var btnVisibility = _bv[0], setBtnVisibility = _bv[1];
    var _th = useState(getDashboardThemeKey());
    var themeKey = _th[0], setThemeKey = _th[1];

    // Load data
    useEffect(function() {
        var cancelled = false;

        async function loadData() {
            try {
                await DB.init();
                var s = await DB.getSettings() || {};

                // Self-healing from Auth
                if (typeof Auth !== 'undefined' && Auth.getUser) {
                    var user = Auth.getUser();
                    if (user) {
                        s.wilaya = user.wilaya || s.wilaya || '';
                        s.municipality = user.municipality || s.municipality || '';
                        s.institutionName = user.institution || s.institutionName || '';
                        s.managerName = user.manager || s.managerName || '';
                    }
                }

                var studentsList = await DB.getStudents() || [];
                var teachersList = await DB.getTeachers() || [];
                var resultsData = await DB.getResults() || [];

                // Use results as fallback if no students
                var finalStudents = studentsList.length > 0 ? studentsList : resultsData;

                var config = await DB.get('home_buttons_config');

                if (cancelled) return;
                setSettings(s);
                setStudents(finalStudents);
                setTeachers(teachersList);
                if (config) setBtnVisibility(config);
                setLoading(false);

                // Calculate disciplinary stats async
                if (finalStudents.length > 0) {
                    calculateDisciplinaryStats(finalStudents).then(function(stats) {
                        if (!cancelled) setDiscStats(stats);
                    });
                }

                // Startup checks
                if (typeof Auth !== 'undefined' && Auth.performStartupChecks) {
                    await Auth.performStartupChecks();
                }
                if (typeof Auth !== 'undefined' && Auth.checkProfileCompletion) {
                    Auth.checkProfileCompletion();
                }
                if (typeof UpdateManager !== 'undefined') {
                    UpdateManager.checkForUpdates();
                }

                // Fetch absence history
                if (typeof ipcRenderer !== 'undefined') {
                    var history = await ipcRenderer.invoke('db-get-absence-history');
                    if (cancelled) return;
                    // Last 15 reports, reverse for chronological order
                    var last15 = (history || []).slice(0, 15).reverse();
                    setAbsenceHistory(last15);
                }

            } catch (err) {
                console.error('Dashboard initialization failed:', err);
                if (!cancelled) setLoading(false);
            }
        }

        loadData();
        return function() { cancelled = true; };
    }, []);

    // Theme listener - multiple detection methods
    useEffect(function() {
        function onThemeChanged() { setThemeKey(getDashboardThemeKey()); }
        function onStorageChanged(ev) {
            if (ev.key === 'theme' || ev.key === 'themePreset') {
                onThemeChanged();
            }
        }
        
        // Listen for custom event
        window.addEventListener('themeChanged', onThemeChanged);
        
        // Listen for storage changes
        window.addEventListener('storage', onStorageChanged);
        
        // MutationObserver to watch theme attribute changes on html/body
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                if (m.attributeName === 'data-theme' || m.attributeName === 'data-theme-preset' || m.attributeName === 'class') {
                    onThemeChanged();
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-theme-preset', 'class'] });
        if (document.body) {
            observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'data-theme-preset', 'class'] });
        }

        // Also poll once after a short delay (for iframe sync timing)
        var timer = setTimeout(onThemeChanged, 500);
        
        return function() {
            window.removeEventListener('themeChanged', onThemeChanged);
            window.removeEventListener('storage', onStorageChanged);
            observer.disconnect();
            clearTimeout(timer);
        };
    }, []);

    // Re-render lucide icons after React renders
    useEffect(function() {
        if (!loading) {
            setTimeout(function() {
                if (typeof lucide !== 'undefined') lucide.createIcons();
                if (typeof IconManager !== 'undefined') IconManager.render();
            }, 100);
        }
    }, [loading, themeKey, students]);

    var hasData = students.length > 0;

    return e('div', { className: 'container dashboard-container' },
        e(DashboardHeader, { settings: settings }),
        e(QuickLinks, { visibility: btnVisibility }),
        loading
            ? e(LoadingSkeleton)
            : (!hasData
                ? e(EmptyState)
                : e('div', null,
                    e(StatsGrid, { students: students, teachers: teachers }),
                    e(DisciplinarySection, { stats: discStats }),
                    e(AbsencesLineChart, { history: absenceHistory }),
                    e(ChartsSection, { students: students, settings: settings, themeKey: themeKey }),
                    e(LevelsDetailGrid, { students: students, settings: settings })
                )
            ),
        e(TrialNotice)
    );
}

// ==================== INITIALIZATION ====================

// Export loadInstitutionInfo for shell sync
window.loadInstitutionInfo = function() {
    // React handles this internally now
    return Promise.resolve();
};

// Shimmer and Tooltip animations
(function() {
    var style = document.createElement('style');
    style.textContent = `
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes tooltipIn { 
            from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.95); } 
            to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } 
        }
    `;
    document.head.appendChild(style);
})();

// Mount React app
document.addEventListener('DOMContentLoaded', function() {
    var root = document.getElementById('dashboard-root');
    if (root) {
        ReactDOM.render(e(DashboardApp), root);
    }
});
