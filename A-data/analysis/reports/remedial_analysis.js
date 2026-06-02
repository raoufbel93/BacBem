function getStudentYear(s) { return s.academic_year || s.schoolYear || s.year || ""; }

function normalizeAcademicYearForRemedial(value) {
    const text = String(value || '').trim().replace(/-/g, '/');
    const years = text.match(/\d{4}/g);
    if (years && years.length >= 2) {
        return years.slice(0, 2).sort().join('/');
    }
    return text.replace(/\s+/g, '');
}

function getCurrentRemedialAcademicYear() {
    return institutionSettings.currentAcademicYear ||
        institutionSettings.schoolYear ||
        (window.DB && typeof DB.getCurrentAcademicYear === 'function' ? DB.getCurrentAcademicYear() : '');
}

function isCurrentRemedialAcademicYear(student, currentAcademicYear) {
    if (!currentAcademicYear) return true;
    const studentYear = getStudentYear(student);
    if (!studentYear) return false;
    return normalizeAcademicYearForRemedial(studentYear) === normalizeAcademicYearForRemedial(currentAcademicYear);
}

// -----------------------------------------------------------------------------

// Global Variables

// -----------------------------------------------------------------------------

let allStudents = [];

let remedialStudents = [];

let institutionSettings = {};

let exemptSubjects = {};

let remedialDataReadyPromise = null;

let secondaryRemedialSubjectOverrides = {};

const SECONDARY_REMEDIAL_SUBJECT_OVERRIDES_KEY = 'secondaryRemedialSubjectOverrides';

function getTrimesterCodeFromLabel(value) {
    const normalized = normalizeArabic(value || '');

    if (normalized === 'annual' || normalized.includes('سنوي')) return '4';
    if (normalized.includes('ثالث') || /\b3\b/.test(normalized)) return '3';
    if (normalized.includes('ثاني') || /\b2\b/.test(normalized)) return '2';
    if (normalized.includes('اول') || /\b1\b/.test(normalized)) return '1';

    return '';
}

function getTrimesterRankFromLabel(value) {
    const code = getTrimesterCodeFromLabel(value);
    return code ? parseInt(code, 10) : 0;
}

function truncateToTwoDecimals(value) {
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return 0;
    return Math.floor((num + Number.EPSILON) * 100) / 100;
}

function roundToTwoDecimals(value) {
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return 0;
    return parseFloat(num.toFixed(2));
}

function formatRoundedTwoDecimals(value) {
    return roundToTwoDecimals(value).toFixed(2);
}

function formatTruncatedTwoDecimals(value) {
    return truncateToTwoDecimals(value).toFixed(2);
}

function escapeRemedialHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function mergeRemedialStudentRecords(target, source) {
    const mergedMarks = Object.assign({}, target.marks || {});
    const sourceTrimesterCode = getTrimesterCodeFromLabel(source.trimester);

    Object.keys(source.marks || {}).forEach(key => {
        const value = source.marks[key];
        if (value !== undefined && value !== null && value !== '') {
            const hasExplicitSuffix = /ف\s*[123]|أول|ثاني|ثالث|الأول|الثاني|الثالث/.test(key);
            if (hasExplicitSuffix || !sourceTrimesterCode || sourceTrimesterCode === '0' || sourceTrimesterCode === '4') {
                mergedMarks[key] = value;
            } else {
                mergedMarks[`${key} ف${sourceTrimesterCode}`] = value;
                mergedMarks[key] = value; // Keep as fallback/latest
            }
        }
    });
    target.marks = mergedMarks;

    const mergedAverages = Object.assign({}, target.averages || {});
    Object.keys(source.averages || {}).forEach(key => {
        const value = source.averages[key];
        if (value !== undefined && value !== null && value !== '') {
            mergedAverages[key] = parseFloat(value) || 0;
        }
    });
    target.averages = mergedAverages;

    if (sourceTrimesterCode && source.average !== undefined && source.average !== null && source.average !== '') {
        target.averages[sourceTrimesterCode] = parseFloat(source.average) || 0;
    }

    const targetTrimesterRank = getTrimesterRankFromLabel(target.trimester);
    const sourceTrimesterRank = getTrimesterRankFromLabel(source.trimester);

    if (sourceTrimesterRank >= targetTrimesterRank) {
        if (source.trimester) target.trimester = source.trimester;
        if (source.average !== undefined && source.average !== null && source.average !== '') {
            target.average = source.average;
        }
        if (source.decision && source.decision !== '-') {
            target.decision = source.decision;
        }
    }

    if (!target.dob && source.dob) target.dob = source.dob;
    if (!target.pob && source.pob) target.pob = source.pob;
    if (!target.gender && source.gender) target.gender = source.gender;
    if (!target.level && source.level) target.level = source.level;
    if (!target.class && source.class) target.class = source.class;
    if (!target.stream && source.stream) target.stream = source.stream;
    if (!target.academic_year && source.academic_year) target.academic_year = source.academic_year;
    if (!target.id && source.id) target.id = source.id;
    if (!target.student_id && source.student_id) target.student_id = source.student_id;

    return target;
}

function getTrialPrintBlockedMessage() {
    return (typeof Auth !== 'undefined' && typeof Auth.getFeatureBlockedMessage === 'function')
        ? Auth.getFeatureBlockedMessage('print')
        : 'الطباعة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.';
}

function isPrintRestrictedForCurrentUser() {
    return typeof Auth !== 'undefined' && typeof Auth.isFeatureRestricted === 'function' && Auth.isFeatureRestricted('print');
}

function blockTrialPrint() {
    if (!isPrintRestrictedForCurrentUser()) return false;

    if (typeof Auth !== 'undefined' && typeof Auth.blockRestrictedFeature === 'function') {
        return Auth.blockRestrictedFeature('print');
    }

    Swal.fire({
        icon: 'warning',
        title: 'تنبيه',
        text: getTrialPrintBlockedMessage()
    });
    return true;
}

function applyPrintAccessState() {
    const button = document.getElementById('printOptionsBtn');
    if (!button) return;

    const isRestricted = isPrintRestrictedForCurrentUser();
    button.disabled = isRestricted;
    button.style.opacity = isRestricted ? '0.6' : '';
    button.style.cursor = isRestricted ? 'not-allowed' : '';
    button.title = isRestricted ? getTrialPrintBlockedMessage() : '';
    button.setAttribute('aria-disabled', isRestricted ? 'true' : 'false');
}

// Map for subject matching

const subjectAliases = {

    // -- Langes --
    'لغة عربية': ['عربية', 'أدب عربي', 'اللغة العربية', 'اللغة العربية وآدابها', 'اللغة العربية و آدابها', 'لغة عربية'],
    'لغة فرنسية': ['فرنسية', 'لغة فرنسية', 'اللغة الفرنسية'],
    'لغة انجليزية': ['انجليزية', 'لغة انجليزية', 'اللغة الإنجليزية', 'اللغة الانجليزية', 'اللغة الأنجليزية'],
    'لغة ثالثة': ['اللغة اﻷجنبية الثالثة', 'اللغة الأجنبية الثالثة', 'لغة أجنبية ثالثة', 'لغة ثالثة', 'اللغة الثالثة', 'ألمانية', 'اسبانية', 'إسبانية', 'إيطالية', 'ايطالية', 'لغة 3', 'اللغة 3', 'اللغة الأجنبية 3', 'Allemand', 'Espagnol', 'Italien', 'Deutsch', 'Spanish', 'Italian'],
    'أمازيغية': ['اللغة الأمازيغية', 'اللغة اﻷمازيغية', 'امازيغية', 'الأمازيغية', 'تاريخ و جغرافيا الأمازيغية', 'لغة أمازيغية'],

    // -- Sciences --
    'رياضيات': ['رياضيات', 'الرياضيات'],
    'علوم طبيعية': ['علوم', 'ع.طبيعية', 'ع الطبيعة و الحياة', 'طبيعة و حياة', 'العلوم الطبيعية', 'علوم طبيعية', 'ع الطبيعة والحياة', 'علوم الطبيعة والحياة', 'العلوم الطبيعة والحياة'],
    'علوم فيزيائية': ['فيزياء', 'علوم فيزيائية', 'ع.فيزيائية', 'العلوم الفيزيائية', 'ع الفيزيائية والتكنولوجيا', 'ع الفيزيائية و التكنولوجيا'],

    'تكنولوجيا': ['هندسة', 'هندسة مدنية', 'هندسة ميكانيكية', 'هندسة طرائق', 'هندسة كهربائية', 'تكنولوجيا', 'التكنولوجيا', 'الهندسة', 'الهندسة المدنية', 'الهندسة الميكانيكية', 'هندسة الطرائق', 'الهندسة الكهربائية', 'Génie Civil', 'Génie Mécanique', 'Génie des Procédés', 'Génie Électrique', 'Technologie'],

    // -- Humanities --

    'اسلامية': ['علوم اسلامية', 'إسلامية', 'التربية الاسلامية', 'شريعة', 'العلوم الإسلامية', 'العلوم الاسلامية', 'التربية الإسلامية', 'تربية إسلامية', 'تربية اسلامية'],

    'علوم اسلامية': ['اسلامية', 'إسلامية', 'التربية الاسلامية', 'شريعة', 'العلوم الإسلامية', 'العلوم الاسلامية'],

    'تاريخ': ['تاريخ', 'اجتماعيات', 'تاريخ و جغرافيا', 'التاريخ والجغرافيا', 'التاريخ و الجغرافيا'],

    'تاريخ وجغرافيا': ['تاريخ', 'جغرافيا', 'اجتماعيات', 'تاريخ و جغرافيا', 'التاريخ والجغرافيا', 'التاريخ و الجغرافيا'],

    'مدنية': ['مدنية', 'تربية مدنية', 'التربية المدنية', 'تربية مدنية'],

    'فلسفة': ['فلسفة', 'الفلسفة'],

    // -- Tech / Management --

    'معلوماتية': ['معلوماتية', 'اعلام', 'إعلام آلي', 'اعلام آلي', 'الإعلام الآلي', 'الاعلام الالي', 'إعلام', 'اعلام الي'],

    'تسيير محاسبي': ['تسيير', 'محاسبة', 'تسيير مالي', 'التسيير المحاسبي والمالي', 'ت. المحاسبي و المالي'],

    'اقتصاد ومناجمنت': ['اقتصاد', 'مناجمنت', 'الإقتصاد والمناجمنت'],

    'قانون': ['قانون'],

    // -- Arts / Sport --

    'ت.تشكيلية': ['ت.تشكيلية', 'فنون تشكيلية', 'التربية التشكيلية', 'رسم', 'فنون', 'التربية الفنية'],

    'موسيقى': ['موسيقى', 'التربية الموسيقية'],

    'رياضة': ['رياضة', 'تربية بدنية', 'التربية البدنية', 'Sport', 'EPS', 'E.P.S', 'ت.بدنية', 'إ.بدنية', 'Education Physique', 'Ed.Physique', 'Physique', 'ت البدنية و الرياضية', 'ت البدنية والرياضية', 'ت. البدنية و الرياضية', 'بدنية']

};

const streamShortLabels = {

    'common_science': 'ج.م علوم',

    'common_arts': 'ج.م آداب',

    'science': 'ع.تجريبية',

    'math': 'رياضيات',

    'tech_math': 'ت.رياضي',

    'tech_math_civil': 'ه.مدنية',

    'tech_math_mech': 'ه.ميكانيك',

    'tech_math_elec': 'ه.كهرباء',

    'tech_math_methods': 'ه.طرائق',

    'management': 'ت.اقتصاد',

    'languages': 'لغات',

    'arts': 'أ.فلسفة',

    'common_literature': 'ج.م آداب',

    'literature_philosophy': 'أ.فلسفة',

    'foreign_languages': 'لغات',

    'experimental_sciences': 'ع.تجريبية',

    'mathematics': 'رياضيات',

    'technical_math': 'ت.رياضي',

    'management_economics': 'ت.اقتصاد'

};

const SECONDARY_REMEDIAL_RULES = {
    '1': {
        common_arts: [
            { canonical: 'لغة عربية', display: 'اللغة العربية وآدابها', coefficient: 5 },
            { canonical: 'تاريخ وجغرافيا', display: 'التاريخ والجغرافيا', coefficient: 3 },
            { canonical: 'لغة فرنسية', display: 'اللغة الفرنسية', coefficient: 3 },
            { canonical: 'لغة انجليزية', display: 'اللغة الإنجليزية', coefficient: 3 }
        ],
        common_science: [
            { canonical: 'رياضيات', display: 'الرياضيات', coefficient: 5 },
            { canonical: 'علوم فيزيائية', display: 'العلوم الفيزيائية', coefficient: 4 },
            { canonical: 'علوم طبيعية', display: 'علوم الطبيعة والحياة', coefficient: 4 },
            { canonical: 'لغة عربية', display: 'اللغة العربية وآدابها', coefficient: 3 }
        ]
    },
    '2': {
        arts: [
            { canonical: 'لغة عربية', display: 'لغة عربية', coefficient: 6 },
            { canonical: 'فلسفة', display: 'فلسفة', coefficient: 6 },
            { canonical: 'تاريخ وجغرافيا', display: 'تاريخ وجغرافيا', coefficient: 4 }
        ],
        languages: [
            { canonical: 'لغة عربية', display: 'لغة عربية', coefficient: 5 },
            { canonical: 'لغة فرنسية', display: 'فرنسية', coefficient: 5 },
            { canonical: 'لغة انجليزية', display: 'إنجليزية', coefficient: 4 }
        ],
        science: [
            { canonical: 'رياضيات', display: 'رياضيات', coefficient: 5 },
            { canonical: 'علوم فيزيائية', display: 'فيزياء', coefficient: 5 },
            { canonical: 'علوم طبيعية', display: 'علوم طبيعية', coefficient: 6 }
        ],
        tech_math: [
            { canonical: 'رياضيات', display: 'رياضيات', coefficient: 6 },
            { canonical: 'علوم فيزيائية', display: 'فيزياء', coefficient: 6 },
            { canonical: 'تكنولوجيا', display: 'تكنولوجيا', coefficient: 7 }
        ],
        math: [
            { canonical: 'رياضيات', display: 'رياضيات', coefficient: 7 },
            { canonical: 'علوم فيزيائية', display: 'فيزياء', coefficient: 6 }
        ],
        management: [
            { canonical: 'رياضيات', display: 'رياضيات', coefficient: 4 },
            { canonical: 'تسيير محاسبي', display: 'محاسبة', coefficient: 6 },
            { canonical: 'اقتصاد ومناجمنت', display: 'اقتصاد', coefficient: 5 }
        ]
    }
};

const SECONDARY_FALLBACK_COEFFICIENTS = {
    '1': {
        common_arts: {
            'لغة عربية': 5,
            'عربية': 5,
            'تاريخ وجغرافيا': 3,
            'لغة فرنسية': 3,
            'فرنسية': 3,
            'لغة انجليزية': 3,
            'انجليزية': 3,
            'اسلامية': 2,
            'علوم اسلامية': 2,
            'رياضيات': 2,
            'علوم طبيعية': 2,
            'فيزياء': 2,
            'علوم فيزيائية': 2,
            'معلوماتية': 2,
            'أمازيغية': 2
        },
        common_science: {
            'لغة عربية': 3,
            'تاريخ وجغرافيا': 2,
            'لغة فرنسية': 2,
            'لغة انجليزية': 2,
            'اسلامية': 2,
            'علوم اسلامية': 2,
            'رياضيات': 5,
            'علوم طبيعية': 4,
            'فيزياء': 4,
            'علوم فيزيائية': 4,
            'تكنولوجيا': 2,
            'معلوماتية': 2,
            'أمازيغية': 2
        }
    },
    '2': {
        arts: {
            'لغة عربية': 6,
            'عربية': 6,
            'فلسفة': 6,
            'تاريخ وجغرافيا': 4,
            'لغة فرنسية': 3,
            'فرنسية': 3,
            'لغة انجليزية': 3,
            'انجليزية': 3,
            'اسلامية': 2,
            'علوم اسلامية': 2,
            'رياضيات': 2,
            'علوم طبيعية': 2,
            'فيزياء': 2,
            'علوم فيزيائية': 2,
            'أمازيغية': 2
        },
        languages: {
            'لغة عربية': 5,
            'لغة فرنسية': 5,
            'لغة انجليزية': 4,
            'لغة ثالثة': 4,
            'تاريخ وجغرافيا': 2,
            'اسلامية': 2,
            'علوم اسلامية': 2,
            'رياضيات': 2,
            'أمازيغية': 2
        },
        science: {
            'لغة عربية': 2,
            'لغة فرنسية': 2,
            'لغة انجليزية': 2,
            'رياضيات': 5,
            'فيزياء': 5,
            'علوم فيزيائية': 5,
            'علوم طبيعية': 6,
            'تاريخ وجغرافيا': 2,
            'اسلامية': 2,
            'علوم اسلامية': 2,
            'أمازيغية': 2
        },
        tech_math: {
            'لغة عربية': 2,
            'لغة فرنسية': 2,
            'لغة انجليزية': 2,
            'رياضيات': 6,
            'فيزياء': 6,
            'علوم فيزيائية': 6,
            'تكنولوجيا': 7,
            'تاريخ وجغرافيا': 2,
            'اسلامية': 2,
            'علوم اسلامية': 2,
            'أمازيغية': 2
        },
        math: {
            'لغة عربية': 2,
            'لغة فرنسية': 2,
            'لغة انجليزية': 2,
            'رياضيات': 7,
            'فيزياء': 6,
            'علوم فيزيائية': 6,
            'علوم طبيعية': 2,
            'تاريخ وجغرافيا': 2,
            'اسلامية': 2,
            'علوم اسلامية': 2,
            'أمازيغية': 2
        },
        management: {
            'لغة عربية': 2,
            'لغة فرنسية': 2,
            'لغة انجليزية': 2,
            'رياضيات': 4,
            'تسيير محاسبي': 6,
            'اقتصاد ومناجمنت': 5,
            'قانون': 2,
            'تاريخ وجغرافيا': 2,
            'اسلامية': 2,
            'علوم اسلامية': 2,
            'أمازيغية': 2
        }
    }
};

const SECONDARY_SUBJECT_DISPLAY_NAMES = {
    'لغة عربية': 'اللغة العربية وآدابها',
    'تاريخ وجغرافيا': 'التاريخ والجغرافيا',
    'لغة فرنسية': 'اللغة الفرنسية',
    'لغة انجليزية': 'اللغة الإنجليزية',
    'رياضيات': 'الرياضيات',
    'فيزياء': 'الفيزياء',
    'علوم فيزيائية': 'العلوم الفيزيائية',
    'علوم طبيعية': 'العلوم الطبيعية',
    'اسلامية': 'العلوم الإسلامية',
    'علوم اسلامية': 'العلوم الإسلامية',
    'فلسفة': 'الفلسفة',
    'لغة ثالثة': 'لغة أجنبية 3',
    'تسيير محاسبي': 'محاسبة',
    'اقتصاد ومناجمنت': 'اقتصاد',
    'قانون': 'القانون',
    'تكنولوجيا': 'التكنولوجيا',
    'معلوماتية': 'الإعلام الآلي',
    'أمازيغية': 'اللغة الأمازيغية',
    'رياضة': 'التربية البدنية والرياضية',
    'تربية بدنية': 'التربية البدنية والرياضية',
    'ت.تشكيلية': 'التربية التشكيلية',
    'موسيقى': 'التربية الموسيقية'
};

// -----------------------------------------------------------------------------

// Initialization

// -----------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const pageMode = document.body?.dataset?.remedialPageMode || 'analysis';
    if (pageMode === 'analysis') {
        applyPrintAccessState();
        initRemedialAnalysis();
    }
});

async function ensureRemedialDataReady() {
    if (remedialDataReadyPromise) {
        return remedialDataReadyPromise;
    }

    remedialDataReadyPromise = (async () => {
        let rawResults = await DB.getResults(true) || [];
        institutionSettings = await DB.getSettings() || {};
        exemptSubjects = await DB.get('exemptSubjects') || {};
        const currentAcademicYear = getCurrentRemedialAcademicYear();
        rawResults = rawResults.filter(student => isCurrentRemedialAcademicYear(student, currentAcademicYear));
        if (currentAcademicYear) {
            rawResults = rawResults.map(student => ({
                ...student,
                academic_year: currentAcademicYear,
                schoolYear: currentAcademicYear,
                year: currentAcademicYear
            }));
        }
        rawResults = rawResults.map(student => ({
            ...student,
            level: student.level || student.class || ''
        }));
        const storedOverrides = await DB.get(SECONDARY_REMEDIAL_SUBJECT_OVERRIDES_KEY);
        secondaryRemedialSubjectOverrides = storedOverrides && typeof storedOverrides === 'object' && !Array.isArray(storedOverrides)
            ? storedOverrides
            : {};

        const deduplicatedResults = new Map();
        for (const student of rawResults) {
            const cleanStr = (s) => normalizeArabic(s || '').replace(/\s+/g, '');
            const normSection = (s) => (s || '').toString().trim().replace(/^0+/, '') || "1";

            const normName = cleanStr(student.name);
            const normDob = (student.dob || '').toString().trim().split('T')[0];
            const normClass = normSection(student.class);
            const normLevel = cleanStr(student.level);
            const normStream = cleanStr(student.stream);

            const stYear = getStudentYear(student);
            const uniqueKey = `${stYear}|${normName}|${normDob}|${normClass}|${normLevel}|${normStream}`;
            
            const trimCode = getTrimesterCodeFromLabel(student.trimester) || '0';
            const dedupKey = `${uniqueKey}|${trimCode}`;
            
            if (!deduplicatedResults.has(dedupKey)) {
                student.__remedialUniqueKey = uniqueKey;
                deduplicatedResults.set(dedupKey, student);
            } else {
                const existing = deduplicatedResults.get(dedupKey);
                const existingDate = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
                const newDate = student.updated_at ? new Date(student.updated_at).getTime() : 0;
                
                if (newDate > existingDate || (newDate === existingDate && student.id > existing.id)) {
                    student.__remedialUniqueKey = uniqueKey;
                    deduplicatedResults.set(dedupKey, student);
                }
            }
        }

        const studentMap = new Map();
        for (const student of deduplicatedResults.values()) {
            const uniqueKey = student.__remedialUniqueKey;
            let targetStudent;
            if (studentMap.has(uniqueKey)) {
                targetStudent = studentMap.get(uniqueKey);
            } else {
                targetStudent = {
                    ...student,
                    marks: {},
                    averages: {},
                    class: (student.class || '').toString().trim().replace(/^0+/, '') || "1",
                    name: (student.name || '').trim(),
                    dob: (student.dob || '').trim(),
                    __remedialUniqueKey: uniqueKey
                };
                studentMap.set(uniqueKey, targetStudent);
            }

            mergeRemedialStudentRecords(targetStudent, student);
        }

        allStudents = Array.from(studentMap.values());
        processRemedialData();

        return { allStudents, remedialStudents, institutionSettings, exemptSubjects };
    })();

    return remedialDataReadyPromise;
}

async function initRemedialAnalysis() {
    await ensureRemedialDataReady();

    if (!allStudents || allStudents.length === 0) {
        showWaitMessage('لا توجد بيانات.', 'يرجى استيراد البيانات أولاً.');
        return;
    }

    // No need to try-catch JSON parse since DB returns object

    // ... rest is same logic

    const dummy = null; // spacer

    // 2. Check Trimester 3 Availability

    // We expect T3 data to be present (since that's where the decision is usually made)

    const hasT3 = allStudents.some(s => getStoredRemedialTrimesterAverage(s, '3') !== null);
    /*


        return t.includes('الثالث') || t.includes('3') || (s.averages && s.averages['3']);

    });

    */
    if (!hasT3) {

        showWaitMessage('⏳ البيانات غير مكتملة', 'لم يتم العثور على نتائج الفصل الثالث. يرجى التأكد من استيراد الملفات.');

        return;

    }

    // 3. Process Data

    // Already processed inside ensureRemedialDataReady().

    // 4. Setup UI Options

    populateFilters();

    populateStreams();

    updateClassOptions();

    const content = document.getElementById('remedialContent');

    if (content) content.style.display = 'block';
    applyPrintAccessState();

    // 5. Render Initial View

    renderView();

    // 6. Setup Event Listeners

    document.getElementById('yearSelect')?.addEventListener('change', () => {
        populateFilters();
        populateStreams();
        updateClassOptions();
        renderView();
    });
    document.getElementById('levelSelect')?.addEventListener('change', () => {
        populateStreams();
        updateClassOptions();
        renderView();
    });
    document.getElementById('streamSelect')?.addEventListener('change', () => {
        updateClassOptions();
        renderView();
    });
    document.getElementById('classSelect')?.addEventListener('change', renderView);
    document.getElementById('subjectFilter')?.addEventListener('change', renderView);
}

// -----------------------------------------------------------------------------

// Data Processing

// -----------------------------------------------------------------------------

function processRemedialData() {

    remedialStudents = [];

    const stage = getRemedialStage();

    allStudents.forEach(s => {
        const effectiveLevel = s.level || s.class || '';
        if (!s || !isAllowedRemedialLevel(effectiveLevel, stage)) return;

        if (stage === 'secondary') {
            if (effectiveLevel && matchLevel(effectiveLevel, '3')) return;
        } else if (effectiveLevel && matchLevel(effectiveLevel, '4')) {
            return;
        }

        const annualSnapshot = getRemedialAnnualSnapshot(s);
        if (!annualSnapshot.isComplete) return;

        const isEligible = stage === 'secondary'
            ? isSecondaryRemedialEligible(s, annualSnapshot.annualAverageNum)
            : isMiddleRemedialEligible(s, annualSnapshot.annualAverageNum);

        if (!isEligible) return;

        let subjects = [];
        let manualRemedialOverrideApplied = false;
        let secondaryRemedialOverrideKey = '';

        if (stage === 'secondary') {
            const secondarySelection = resolveSecondaryRemedialSubjects(s);
            subjects = secondarySelection.subjects;
            manualRemedialOverrideApplied = secondarySelection.manualOverrideApplied;
            secondaryRemedialOverrideKey = secondarySelection.storageKey;
            // DEBUG: Log student data for troubleshooting
            if ((s.name || '').includes('حكومي')) {
                console.log('=== DEBUG حكومي ===');
                console.log('name:', s.name);
                console.log('level:', s.level);
                console.log('stream:', s.stream);
                console.log('class:', s.class);
                console.log('trimester:', s.trimester);
                console.log('average:', s.average);
                console.log('marks keys:', Object.keys(s.marks || {}));
                console.log('marks:', JSON.stringify(s.marks, null, 2));
                console.log('averages:', JSON.stringify(s.averages, null, 2));
                console.log('ruleSet:', JSON.stringify(getSecondaryRemedialRuleSet(s)));
                console.log('streamCode:', normalizeSecondaryStreamCode(s.stream));
                console.log('subjects found:', JSON.stringify(subjects));
                console.log('=== END DEBUG ===');
            }
        } else {
            subjects = calculateSubjectAveragesForStudent(s, stage);
        }

        if (!subjects || subjects.length === 0) return;

        remedialStudents.push({
            ...s,
            level: s.level || effectiveLevel,
            annualAverage: annualSnapshot.annualAverageNum,
            remedialSubjects: subjects,
            manualRemedialOverrideApplied,
            secondaryRemedialOverrideKey
        });
    });

    populateSubjectFilter(remedialStudents);
    return;

    /* Legacy remedial processing

    const t3Students = allStudents.filter(s => {

        const tri = s.trimester ? s.trimester.toString() : '';

        return tri.includes('ثالث') || tri.includes('3') || (s.averages && s.averages['3']);

    });

    const stage = getRemedialStage();

    t3Students.forEach(s => {

        // Exclude Final Years: Year 4 (Middle) OR Year 3 (Secondary)

        if (stage === 'secondary') {

            if (s.level && matchLevel(s.level, '3')) return;

        } else {

            if (s.level && matchLevel(s.level, '4')) return;

        }

        // Get Averages

        let avg1 = 0, avg2 = 0, avg3 = 0;

        if (s.averages) {

            avg1 = parseFloat(s.averages['1']) || 0;

            avg2 = parseFloat(s.averages['2']) || 0;

            avg3 = parseFloat(s.averages['3']) || parseFloat(s.average) || 0;

        } else {

            avg3 = parseFloat(s.average) || 0;

        }

        // Must have some data

        if (avg1 === 0 && avg2 === 0 && avg3 === 0) return;

        // Calculate Annual Average

        const annualAvg = (avg1 + avg2 + avg3) / 3;

        const avgFixed = roundToTwoDecimals(annualAvg);

        const isEligible = stage === 'secondary'
            ? isSecondaryRemedialEligible(s, avgFixed)
            : (avgFixed >= 9 && avgFixed < 10);

        if (!isEligible) return;

        const subjects = calculateSubjectAveragesForStudent(s, stage);

        if (subjects.length > 0) {

            remedialStudents.push({

                ...s,

                annualAverage: avgFixed,

                remedialSubjects: subjects

            });

        }

    */

    populateSubjectFilter(remedialStudents);

}

function getCanonicalSubjectName(rawName) {
    const normRaw = normalizeArabic(rawName);

    if (normRaw.includes('معلومات') || normRaw.includes('اعلام')) {
        return 'معلوماتية';
    }

    for (const [canonical, aliases] of Object.entries(subjectAliases)) {
        if (normalizeArabic(canonical) === normRaw) return canonical;

        if (aliases.some(alias => normRaw.includes(normalizeArabic(alias)) || normalizeArabic(alias).includes(normRaw))) {
            return canonical;
        }
    }

    return rawName;
}

function isAggregateSubjectKey(key) {
    const k = (key || '').toString();
    const kLower = k.toLowerCase();

    return k === 'معدل' || k === 'المعدل' ||
        k.includes('معدل فصلي') || k.includes('معدل عام') || k.includes('معدل سنوي') || k.includes('معدل شهادة') ||
        kLower.includes('moyenne trim') || kLower.includes('moyenne gen') || kLower.includes('resultat') ||
        k.includes('قرار') || k.includes('رقم') || k.includes('نتيجة');
}

function getSecondaryLevelCode(student) {
    if (!student) return '';
    if (matchLevel(student.level, '1')) return '1';
    if (matchLevel(student.level, '2')) return '2';
    return '';
}

function getSecondarySubjectDisplayName(canonicalName, fallbackName) {
    return SECONDARY_SUBJECT_DISPLAY_NAMES[canonicalName] || fallbackName || canonicalName;
}

function isRemedialSubjectExempt(student, subjectName) {
    if (!student || !subjectName || !window.ExemptSubjectsHelper || typeof window.ExemptSubjectsHelper.isSubjectExempt !== 'function') {
        return false;
    }

    return window.ExemptSubjectsHelper.isSubjectExempt(subjectName, {
        level: student.level,
        exemptSubjects,
        exemptionMap: window.ExemptSubjectsHelper.DEFAULT_EXEMPTION_MAP
    });
}

function shouldKeepSubjectInRemedialDespiteExemption(student, subjectName) {
    if (!student || !subjectName || getRemedialStage() === 'secondary') {
        return false;
    }

    const exemptionCode = window.ExemptSubjectsHelper && typeof window.ExemptSubjectsHelper.matchExemptionCode === 'function'
        ? window.ExemptSubjectsHelper.matchExemptionCode(subjectName, window.ExemptSubjectsHelper.DEFAULT_EXEMPTION_MAP)
        : null;

    return exemptionCode === 'info';
}

function filterRemedialSubjectsByExemption(student, subjects) {
    return (subjects || []).filter(subject => {
        const candidateNames = [
            subject && subject.name,
            subject && subject.displayName,
            subject && subject.canonicalName
        ].filter(Boolean);

        if (candidateNames.some(subjectName => shouldKeepSubjectInRemedialDespiteExemption(student, subjectName))) {
            return true;
        }

        return !candidateNames.some(subjectName => isRemedialSubjectExempt(student, subjectName));
    });
}

function collectStudentCanonicalSubjects(student) {
    const subjects = [];
    const seen = new Set();
    const marks = (student && student.marks) || {};

    Object.keys(marks).forEach(key => {
        if (isAggregateSubjectKey(key)) return;

        const canonicalName = getCanonicalSubjectName(cleanSubjectName(key));
        const normalizedCanonical = normalizeArabic(canonicalName);
        if (!normalizedCanonical || seen.has(normalizedCanonical)) return;

        seen.add(normalizedCanonical);
        subjects.push(canonicalName);
    });

    return subjects;
}

function getSecondaryRemedialOverrideStorageKey(student) {
    if (!student) return '';

    const academicYear = normalizeArabic(getStudentYear(student) || '').replace(/\s+/g, '');
    const rawId = String(student.id || student.student_id || '').trim();
    if (rawId) {
        return ['secondary-remedial', academicYear, rawId].join('|');
    }

    const fallbackKey = String(student.__remedialUniqueKey || '').trim();
    if (fallbackKey) {
        return ['secondary-remedial', fallbackKey].join('|');
    }

    const fallbackParts = [
        student.name,
        student.dob,
        student.level,
        student.class,
        student.stream,
        getStudentYear(student)
    ].map(value => normalizeArabic(String(value || '')).replace(/\s+/g, ''));

    return ['secondary-remedial'].concat(fallbackParts).join('|');
}

function getSavedSecondaryRemedialSubjectOverride(student) {
    const storageKey = getSecondaryRemedialOverrideStorageKey(student);
    const storedEntry = storageKey ? secondaryRemedialSubjectOverrides[storageKey] : null;
    const rawSubjects = Array.isArray(storedEntry)
        ? storedEntry
        : (storedEntry && Array.isArray(storedEntry.subjects) ? storedEntry.subjects : []);

    const canonicalSubjects = Array.from(new Set(
        rawSubjects
            .map(subjectName => getCanonicalSubjectName(subjectName))
            .filter(Boolean)
    ));

    return {
        storageKey,
        canonicalSubjects
    };
}

function getSecondaryEditableRemedialCandidates(student) {
    if (!student || !student.marks) return [];

    const rules = getSecondaryRemedialRuleSet(student);
    const officialSubjects = new Set(rules.map(rule => normalizeArabic(rule.canonical)));

    return collectStudentCanonicalSubjects(student)
        .map(canonicalName => {
            const m1 = getTrimesterMarkCanonical(student, canonicalName, '1');
            const m2 = getTrimesterMarkCanonical(student, canonicalName, '2');
            const m3 = getTrimesterMarkCanonical(student, canonicalName, '3');

            let avg = 0;
            let sum = 0;
            let count = 0;
            
            if (m1 !== null) { sum += m1; count++; }
            if (m2 !== null) { sum += m2; count++; }
            if (m3 !== null) { sum += m3; count++; }

            if (count > 0) {
                avg = truncateToTwoDecimals(sum / count);
            } else {
                return null;
            }

            return {
                name: getSecondarySubjectDisplayName(canonicalName, canonicalName),
                canonicalName,
                avg,
                details: { m1, m2, m3 },
                isOfficialRule: officialSubjects.has(normalizeArabic(canonicalName))
            };
        })
        .filter(Boolean)
        .filter(candidate => !isRemedialSubjectExempt(student, candidate.canonicalName) && !isRemedialSubjectExempt(student, candidate.name))
        .sort((a, b) => {
            if (a.isOfficialRule !== b.isOfficialRule) return a.isOfficialRule ? -1 : 1;
            if (a.avg !== b.avg) return a.avg - b.avg;
            return a.name.localeCompare(b.name, 'ar');
        });
}

function getManualSecondaryRemedialSubjects(student, canonicalSubjects) {
    if (!student || !Array.isArray(canonicalSubjects) || canonicalSubjects.length === 0 || canonicalSubjects.length > 2) {
        return [];
    }

    const candidates = getSecondaryEditableRemedialCandidates(student);
    const candidateByCanonical = new Map(
        candidates.map(candidate => [normalizeArabic(candidate.canonicalName), candidate])
    );

    const selected = [];
    const seen = new Set();

    canonicalSubjects.forEach(subjectName => {
        const normalized = normalizeArabic(getCanonicalSubjectName(subjectName));
        if (!normalized || seen.has(normalized)) return;

        const candidate = candidateByCanonical.get(normalized);
        if (!candidate) return;

        seen.add(normalized);
        selected.push({
            name: candidate.name,
            avg: candidate.avg,
            details: candidate.details
        });
    });

    return selected.length === canonicalSubjects.length ? selected : [];
}

function buildSecondarySubjectCandidate(student, subjectInfo) {
    const m1 = getTrimesterMarkCanonical(student, subjectInfo.canonicalName, '1');
    const m2 = getTrimesterMarkCanonical(student, subjectInfo.canonicalName, '2');
    const m3 = getTrimesterMarkCanonical(student, subjectInfo.canonicalName, '3');

    let avg = 0;
    let sum = 0;
    let count = 0;
    
    if (m1 !== null) { sum += m1; count++; }
    if (m2 !== null) { sum += m2; count++; }
    if (m3 !== null) { sum += m3; count++; }

    if (count > 0) {
        avg = truncateToTwoDecimals(sum / count);
    } else {
        return null;
    }

    return {
        name: subjectInfo.displayName,
        canonicalName: subjectInfo.canonicalName,
        avg,
        coefficient: subjectInfo.coefficient,
        order: subjectInfo.order,
        details: { m1, m2, m3 }
    };
}


function getSecondaryFallbackCoefficient(student, canonicalName) {
    const levelCode = getSecondaryLevelCode(student);
    const streamCode = normalizeSecondaryStreamCode(student && student.stream);

    if (!levelCode || !streamCode) return 1;

    const streamMap = SECONDARY_FALLBACK_COEFFICIENTS[levelCode] && SECONDARY_FALLBACK_COEFFICIENTS[levelCode][streamCode];
    if (!streamMap) return 1;

    return streamMap[canonicalName] || 1;
}

function calculateAutomaticSecondaryRemedialSubjects(student) {
    const remedialRules = getSecondaryRemedialRuleSet(student);
    if (!student || !student.marks || remedialRules.length === 0) return [];

    const featuredEvaluations = remedialRules.map((rule, index) => buildSecondarySubjectCandidate(student, {
        canonicalName: rule.canonical,
        displayName: rule.display,
        coefficient: rule.coefficient,
        order: index
    })).filter(Boolean);

    const eligibleFeaturedEvaluations = filterRemedialSubjectsByExemption(student, featuredEvaluations);
    
    // Find failed essential subjects (avg < 10)
    const featuredFailures = eligibleFeaturedEvaluations.filter(subject => subject.avg < 10 && subject.avg > 0);
    
    let picked = [];
    
    // Official Raqmana behavior: Pick the failed subjects with the highest coefficients.
    // In case of a tie in coefficients, pick the one with the highest average (best chance to pass).
    featuredFailures.sort((a, b) => {
        if (b.coefficient !== a.coefficient) return b.coefficient - a.coefficient;
        return b.avg - a.avg;
    });
    
    picked = featuredFailures.slice(0, 2);
    
    // If we still haven't reached 2 subjects, fill remaining slots from non-essential subjects (coef >= 2)
    if (picked.length < 2) {
        const pickedNames = picked.map(p => p.canonicalName);
        const allSubjects = new Set();
        
        Object.keys(student.marks).forEach(k => {
            const kLower = k.toLowerCase();
            const isGlobalAvg = k === 'معدل' || k === 'المعدل' ||
                k.includes('معدل فصلي') || k.includes('معدل عام') || k.includes('معدل سنوي') || k.includes('معدل شهادة') ||
                kLower.includes('moyenne trim') || kLower.includes('moyenne gen') || kLower.includes('resultat');
            if (isGlobalAvg || k.includes('قرار') || k.includes('رقم') || k.includes('نتيجة')) return;
            
            const cleanName = cleanSubjectName(k);
            const canonical = getCanonicalSubjectName(cleanName);
            if (canonical && !pickedNames.includes(canonical)) {
                allSubjects.add(canonical);
            }
        });

        const otherFailures = [];
        allSubjects.forEach(canonicalName => {
            if (isRemedialSubjectExempt(student, canonicalName)) return;
            
            // Skip essential subjects because we already established they have avg >= 10 in them
            if (remedialRules.some(r => normalizeArabic(r.canonical) === normalizeArabic(canonicalName))) return;
            
            const m1 = getTrimesterMarkCanonical(student, canonicalName, '1');
            const m2 = getTrimesterMarkCanonical(student, canonicalName, '2');
            const m3 = getTrimesterMarkCanonical(student, canonicalName, '3');
            
            let subAvg = 0;
            let sum = 0;
            let count = 0;
            
            if (m1 !== null) { sum += m1; count++; }
            if (m2 !== null) { sum += m2; count++; }
            if (m3 !== null) { sum += m3; count++; }

            if (count > 0) {
                subAvg = truncateToTwoDecimals(sum / count);
            } else {
                return;
            }

            if (subAvg < 10 && subAvg > 0) {
                const coef = getSecondaryFallbackCoefficient(student, canonicalName);
                if (coef >= 2) {
                    otherFailures.push({
                        name: SECONDARY_SUBJECT_DISPLAY_NAMES[canonicalName] || canonicalName,
                        canonicalName: canonicalName,
                        avg: subAvg,
                        coefficient: coef,
                        details: { m1, m2, m3 }
                    });
                }
            }
        });

        // Sort by coefficient (descending), then highest average (best chance to pass)
        otherFailures.sort((a, b) => {
            if (b.coefficient !== a.coefficient) return b.coefficient - a.coefficient;
            return b.avg - a.avg;
        });

        // Fill remaining slots
        for (const failure of otherFailures) {
            if (picked.length >= 2) break;
            picked.push(failure);
        }
    }

    return picked.map(({ canonicalName, coefficient, order, ...subject }) => subject);
}

function resolveSecondaryRemedialSubjects(student) {
    const overrideSnapshot = getSavedSecondaryRemedialSubjectOverride(student);
    const manualSubjects = getManualSecondaryRemedialSubjects(student, overrideSnapshot.canonicalSubjects);

    if (manualSubjects.length > 0) {
        return {
            subjects: manualSubjects,
            manualOverrideApplied: true,
            storageKey: overrideSnapshot.storageKey
        };
    }

    return {
        subjects: calculateAutomaticSecondaryRemedialSubjects(student),
        manualOverrideApplied: false,
        storageKey: overrideSnapshot.storageKey
    };
}

function calculateSecondaryRemedialSubjects(student) {
    return resolveSecondaryRemedialSubjects(student).subjects;
}

function calculateSubjectAveragesForStudent(student, stageOverride = null) {
 
    if (!student || !student.marks) return [];
    const stage = stageOverride || getRemedialStage();
    if (stage === 'secondary') {
        return calculateSecondaryRemedialSubjects(student);
    }

    // 1. Identify Unique Subject Names (Cleaned & Canonicalized)

    const uniqueSubjects = new Set();

    // Map to keep track of raw names for a canonical name (optimized)

    const canonicalMap = {}; // canonical -> raw (representative)

    Object.keys(student.marks).forEach(k => {

        // Exclude Aggregates

        // Exclude Aggregates (Specific Global Averages)

        // We only exclude keys that are CLEARLY global averages.

        // If it is just "معدل" or "Moyenne" equal to something generic, we skip.

        // But "معدل الرياضيات" should pass.

        const kLower = k.toLowerCase();

        const isGlobalAvg = k === 'معدل' || k === 'المعدل' ||

            k.includes('معدل فصلي') || k.includes('معدل عام') || k.includes('معدل سنوي') || k.includes('معدل شهادة') ||

            k.includes('moyenne trim') || k.includes('moyenne gen') || k.includes('resultat');

        if (isGlobalAvg || k.includes('قرار') || k.includes('رقم') || k.includes('نتيجة')) return;

        const cleanName = cleanSubjectName(k);

        const canonical = getCanonicalSubjectName(cleanName);

        uniqueSubjects.add(canonical);

        if (!canonicalMap[canonical]) canonicalMap[canonical] = cleanName;

    });

    const results = [];

    uniqueSubjects.forEach(canonicalName => {

        // We need to pass the "raw" name or logic to find marks.

        // getTrimesterMark currently expects a cleanSubName.

        // We'll iterate all keys in student.marks, normalize them, match with canonicalName.

        const m1 = getTrimesterMarkCanonical(student, canonicalName, '1');
        const m2 = getTrimesterMarkCanonical(student, canonicalName, '2');
        const m3 = getTrimesterMarkCanonical(student, canonicalName, '3');

        // Annual subject averages should only be derived from complete trimester data.
        let subAvg = 0;
        if (m1 !== null && m2 !== null && m3 !== null) {
            subAvg = (m1 + m2 + m3) / 3;
        } else if (m1 === null && m2 === null && m3 !== null) {
            subAvg = m3;
        } else {
            return;
        }

        // Remedial Condition: Subject Avg < 10 and > 0 (exclude exempt)
        if (subAvg < 10 && subAvg > 0) {

            results.push({

                name: canonicalName,

                avg: truncateToTwoDecimals(subAvg),

                details: { m1, m2, m3 }

            });

        }

    });

    return filterRemedialSubjectsByExemption(student, results);

}

function getTrimesterMarkCanonical(student, canonicalTarget, trimesterCode) {

    const suffixes = [];

    if (trimesterCode === '1') suffixes.push('ف1', 'ف 1', 'أول', 'الأول');

    else if (trimesterCode === '2') suffixes.push('ف2', 'ف 2', 'ثاني', 'الثاني');

    else if (trimesterCode === '3') suffixes.push('ف3', 'ف 3', 'ثالث', 'الثالث');

    // Helper to check match

    const isMatch = (rawKey) => {

        const clean = cleanSubjectName(rawKey);

        // Normalize check

        const normClean = normalizeArabic(clean);

        const normTarget = normalizeArabic(canonicalTarget);

        // Direct match

        if (normClean === normTarget) return true;

        // Alias match

        if (subjectAliases[canonicalTarget]) {

            if (subjectAliases[canonicalTarget].some(alias => normClean.includes(normalizeArabic(alias)) || normalizeArabic(alias).includes(normClean))) {

                // Exclusion Check

                const exclusions = {

                    'علوم': ['فيزيائية', 'تكنولوجيا', 'اسلامية', 'إسلامية', 'شرعية', 'انسانية'],

                    'علوم طبيعية': ['فيزيائية', 'تكنولوجيا', 'اسلامية', 'إسلامية', 'شرعية', 'انسانية', 'معلوماتية', 'معلومات', 'اعلام', 'إعلام'],

                    'رياضة': ['فنية', 'تشكيلية', 'فنون', 'رسم'],

                    'تربية بدنية': ['فنية', 'تشكيلية', 'فنون', 'رسم'],

                    'ت.تشكيلية': ['رياضة', 'بدنية', 'رياضية', 'sport', 'eps']

                };

                if (exclusions[canonicalTarget]) {

                    if (exclusions[canonicalTarget].some(ex => normClean.includes(normalizeArabic(ex)))) return false;

                }

                return true;

            }

        }

        return false;

    };

    const marks = student.marks;

    // Find key

    // Find key

    const directKeyCandidates = Object.keys(marks).filter(k => {

        // Must have suffix match

        const hasSuffix = suffixes.some(suf => k.includes(suf));

        // Context Check: If student file is from this trimester, allow generic keys (no suffix)
        const studentTrimCode = getTrimesterCodeFromLabel(student.trimester);
        const contextMatch = studentTrimCode === trimesterCode || studentTrimCode === '4' || studentTrimCode === '';

        if (!hasSuffix && !contextMatch && trimesterCode !== '3') return false; // Strict suffix for T1/T2 unless context matches

        // AND subject match

        if (isMatch(k)) {

            // Safety: If using context match (generic name), ensure it doesn't have a CONFLICTING suffix

            if (!hasSuffix) {

                const otherSuffixes = ['ف1', 'ف 1', 'أول', 'الأول', 'ف2', 'ف 2', 'ثاني', 'الثاني', 'ف3', 'ف 3', 'ثالث', 'الثالث'];

                // Exclude current suffixes from "other" check? No, basically if we found a generic name,

                // we must ensure it doesn't contain Explicit Suffix of ANOTHER trimester.

                // But simplified: Just ensure it matches the subject.

                // If it had a conflicting suffix, `hasSuffix` would be false (correct),

                // but we need to ensure we don't pick "Math T2" when looking for T1 just because context match says "we are in T1 file"?

                // Actually, if we are in T1 file, "Math T2" shouldn't exist ideally.

                // But checking for conflicting suffix is safer.

                // If we are looking for T1, and find "Math T2", hasSuffix is false. contextMatch is true. isMatch is true.

                // We would pick it. ERROR.

                // So we must verify it does NOT have conflicting suffix.

                const isConflicting = otherSuffixes.some(os => k.includes(os) && !suffixes.includes(os));

                if (isConflicting) return false;

            }

            return true;

        }

        return false;

    });

    const normTarget = normalizeArabic(canonicalTarget);
    const directKey = directKeyCandidates
        .map(key => {
            const cleanKey = cleanSubjectName(key);
            const normCleanKey = normalizeArabic(cleanKey);
            const hasSuffix = suffixes.some(suf => key.includes(suf));
            const exactCanonicalMatch = normCleanKey === normTarget;
            const canonicalAliasMatch = normalizeArabic(getCanonicalSubjectName(cleanKey)) === normTarget;

            let score = 0;
            if (hasSuffix) score += 4;
            if (exactCanonicalMatch) score += 3;
            else if (canonicalAliasMatch) score += 2;
            if (key === canonicalTarget) score += 1;

            return { key, score };
        })
        .sort((a, b) => b.score - a.score)[0]?.key;

    if (directKey) {
        const parsedValue = parseFloat(marks[directKey]);
        return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    // Fallback for T3 if generic (no suffix) OR if Context Match Logic above didn't catch it for some reason

    // actually the logic above handles T3 generic too if context matches.

    // But T3 often comes from Annual files where T1/T2 have suffixes and T3 is generic.

    // So we keep T3 fallback for "Implicit T3".

    if (trimesterCode === '3') {

        const genericKey = Object.keys(marks)
            .filter(k => isMatch(k) && !k.match(/ف\s*[12]/))
            .map(key => {
                const cleanKey = cleanSubjectName(key);
                const normCleanKey = normalizeArabic(cleanKey);
                const exactCanonicalMatch = normCleanKey === normTarget;
                const canonicalAliasMatch = normalizeArabic(getCanonicalSubjectName(cleanKey)) === normTarget;
                let score = 0;
                if (exactCanonicalMatch) score += 3;
                else if (canonicalAliasMatch) score += 2;
                if (key === canonicalTarget) score += 1;
                return { key, score };
            })
            .sort((a, b) => b.score - a.score)[0]?.key;

        if (genericKey) {
            const parsedValue = parseFloat(marks[genericKey]);
            return Number.isFinite(parsedValue) ? parsedValue : null;
        }

    }

    return null;

}

function cleanSubjectName(key) {

    return key

        .replace(/^(معدل|moyenne)\s*/i, '') // Remove "Average" prefix

        .replace(/\s+(فصل|ف)(\s*[123])?$/u, '')

        .replace(/\s+[123]$/, '')

        .replace(/\s+(الأول|الثاني|الثالث|أول|ثاني|ثالث)$/, '')

        .trim();

}

function normalizeArabic(text) {
    if (!text) return "";
    return text.toString()
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ﻷ|ﻹ|ﻵ|ﻻ/g, 'لا')
        .replace(/لأ|لإ|لآ/g, 'لا')
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .replace(/\s+/g, ' ');
}

function levelMatchesSelection(levelValue, selectedLevel) {
    if (!selectedLevel || selectedLevel === 'all') return true;
    if (!levelValue) return false;

    if (matchLevel(levelValue, selectedLevel)) return true;

    return normalizeArabic(levelValue) === normalizeArabic(selectedLevel);
}

function normalizeRemedialStage(stageValue) {
    const normalized = normalizeArabic(stageValue || '');
    return normalized === 'secondary' || normalized.includes('ثانوي') ? 'secondary' : 'middle';
}

function hasSecondaryLevelData(students) {
    return (students || []).some(student => {
        const levelText = (student && student.level ? student.level : '').toString();
        const normalizedLevel = normalizeArabic(levelText);
        const upperLevel = levelText.toUpperCase();

        return normalizedLevel.includes('ثانوي') || upperLevel.includes('AS') || upperLevel.includes('YEAR');
    });
}

function getRemedialStage() {
    const configuredStage = (typeof institutionSettings !== 'undefined' && institutionSettings.educationStage)
        ? institutionSettings.educationStage
        : 'middle';
    let stage = normalizeRemedialStage(configuredStage);

    if (stage !== 'secondary' && hasSecondaryLevelData(allStudents)) {
        stage = 'secondary';
    }

    return stage;
}

function getAllowedRemedialLevels(stage) {
    return stage === 'secondary' ? ['1', '2'] : ['1', '2', '3'];
}

function isAllowedRemedialLevel(levelValue, stage) {
    return getAllowedRemedialLevels(stage).some(code => matchLevel(levelValue, code));
}

function normalizeSecondaryStreamCode(streamValue) {
    if (!streamValue) return '';
    const raw = streamValue.toString().trim();
    if (SECONDARY_REMEDIAL_RULES['1'][raw] || SECONDARY_REMEDIAL_RULES['2'][raw]) return raw;

    const norm = normalizeArabic(raw).replace(/\s+/g, '');
    if (norm.includes('جذعمشترك') || norm.includes('مشترك')) {
        if (norm.includes('علوم') || norm.includes('تكنولوجيا')) return 'common_science';
        if (norm.includes('اداب')) return 'common_arts';
    }
    if (norm.includes('علومتجريب') || norm === 'science') return 'science';
    if (norm.includes('رياضيات') || norm === 'math') return 'math';
    if (norm.includes('تقنيرياضي') || norm.includes('هندسه') || norm === 'tech_math') return 'tech_math';
    if (norm.includes('تسيير') || norm.includes('اقتصاد') || norm === 'management') return 'management';
    if (norm.includes('لغات') || norm.includes('اجنبيه') || norm.includes('المان') || norm.includes('اسبان') || norm.includes('ايطال') || norm === 'languages') return 'languages';
    if (norm.includes('اداب') || norm.includes('فلسف') || norm === 'arts') return 'arts';
    return raw;
}

function normalizeDecisionLabel(decisionValue) {
    return normalizeArabic(decisionValue || '').replace(/\s+/g, ' ').trim();
}

function getStoredRemedialTrimesterAverage(student, trimesterCode) {
    if (!student || !trimesterCode) return null;

    const rawAverage = student.averages && student.averages[trimesterCode];
    if (rawAverage !== undefined && rawAverage !== null && rawAverage !== '') {
        const parsedAverage = parseFloat(rawAverage);
        return Number.isFinite(parsedAverage) ? parsedAverage : null;
    }

    if (getTrimesterCodeFromLabel(student.trimester) === trimesterCode) {
        const parsedAverage = parseFloat(student.average);
        return Number.isFinite(parsedAverage) ? parsedAverage : null;
    }

    return null;
}

function getRemedialAnnualSnapshot(student) {
    const avg1 = getStoredRemedialTrimesterAverage(student, '1');
    const avg2 = getStoredRemedialTrimesterAverage(student, '2');
    const avg3 = getStoredRemedialTrimesterAverage(student, '3');
    const isComplete = [avg1, avg2, avg3].every(value => Number.isFinite(value));
    const annualAverageNum = isComplete ? roundToTwoDecimals((avg1 + avg2 + avg3) / 3) : 0;

    return {
        avg1,
        avg2,
        avg3,
        isComplete,
        annualAverageNum
    };
}

function hasExplicitNonRemedialDecision(student) {
    const decisionNorm = normalizeDecisionLabel(student && student.decision);
    if (!decisionNorm || decisionNorm === '-') return false;

    return decisionNorm.includes('ينتقل') ||
        decisionNorm.includes('ناجح') ||
        decisionNorm.includes('يعيد') ||
        decisionNorm.includes('راسب') ||
        decisionNorm.includes('يوجه');
}

function isMiddleRemedialEligible(student, annualAverage) {
    if (!student || !isAllowedRemedialLevel(student.level || student.class, 'middle')) return false;
    if (!(annualAverage >= 9 && annualAverage < 10)) return false;
    if (hasExplicitNonRemedialDecision(student)) return false;
    return true;
}

function isSecondaryRemedialEligible(student, annualAverage) {
    if (!student || !isAllowedRemedialLevel(student.level || student.class, 'secondary')) return false;
    if (!(annualAverage >= 9 && annualAverage < 10)) return false;
    if (hasExplicitNonRemedialDecision(student)) return false;
    return true;
}

function getSecondaryRemedialRuleSet(student) {
    if (!student) return [];
    
    let levelCode = '';
    const effLevel = student.level || student.class || '';
    if (matchLevel(effLevel, '1')) levelCode = '1';
    else if (matchLevel(effLevel, '2')) levelCode = '2';
    
    if (!levelCode) return [];
    
    let streamCode = normalizeSecondaryStreamCode(student.stream);
    if (!SECONDARY_REMEDIAL_RULES[levelCode]?.[streamCode]) {
        streamCode = normalizeSecondaryStreamCode(student.class);
    }
    if (!SECONDARY_REMEDIAL_RULES[levelCode]?.[streamCode]) {
        streamCode = normalizeSecondaryStreamCode(student.level);
    }
    
    return SECONDARY_REMEDIAL_RULES[levelCode]?.[streamCode] || [];
}

function findSecondaryRemedialStudentByStorageKey(storageKey) {
    if (!storageKey) return null;

    return remedialStudents.find(student => {
        const candidateKey = student.secondaryRemedialOverrideKey || getSecondaryRemedialOverrideStorageKey(student);
        return candidateKey === storageKey;
    }) || null;
}

async function persistSecondaryRemedialSubjectOverrides(nextOverrides) {
    if (!window.DB || typeof DB.set !== 'function') {
        Swal.fire({ icon: 'error', title: 'تعذر الحفظ', text: 'تعذر الوصول إلى التخزين المحلي لحفظ تعديل مواد الاستدراك.' });
        return false;
    }

    try {
        secondaryRemedialSubjectOverrides = nextOverrides;
        await DB.set(SECONDARY_REMEDIAL_SUBJECT_OVERRIDES_KEY, secondaryRemedialSubjectOverrides);
        processRemedialData();
        renderView();
        return true;
    } catch (error) {
        console.error('Failed to persist secondary remedial subject overrides:', error);
        Swal.fire({ icon: 'error', title: 'تعذر الحفظ', text: 'حدث خطأ أثناء حفظ تعديل مواد الاستدراك.' });
        return false;
    }
}

async function saveSecondaryRemedialSubjectOverride(storageKey, canonicalSubjects) {
    if (!storageKey) return false;

    const normalizedSubjects = Array.from(new Set(
        (canonicalSubjects || [])
            .map(subjectName => getCanonicalSubjectName(subjectName))
            .filter(Boolean)
    ));

    if (normalizedSubjects.length === 0 || normalizedSubjects.length > 2) {
        return false;
    }

    return persistSecondaryRemedialSubjectOverrides(Object.assign({}, secondaryRemedialSubjectOverrides, {
        [storageKey]: {
            subjects: normalizedSubjects,
            updatedAt: new Date().toISOString()
        }
    }));
}

async function clearSecondaryRemedialSubjectOverride(storageKey) {
    if (!storageKey) return false;

    const nextOverrides = Object.assign({}, secondaryRemedialSubjectOverrides);
    delete nextOverrides[storageKey];

    return persistSecondaryRemedialSubjectOverrides(nextOverrides);
}

async function openSecondaryRemedialOverrideEditor(storageKey) {
    const student = findSecondaryRemedialStudentByStorageKey(storageKey);
    if (!student) {
        Swal.fire({ icon: 'warning', title: 'تعذر فتح التعديل', text: 'لم يتم العثور على بيانات هذا التلميذ داخل قائمة الاستدراك الحالية.' });
        return;
    }

    const candidates = getSecondaryEditableRemedialCandidates(student);
    if (candidates.length === 0) {
        Swal.fire({ icon: 'warning', title: 'لا توجد مواد قابلة للتعديل', text: 'تعذر استخراج مواد سنوية كاملة لهذا التلميذ حتى يتم تعديلها يدويًا.' });
        return;
    }

    const savedOverride = getSavedSecondaryRemedialSubjectOverride(student);
    const selectedSubjects = savedOverride.canonicalSubjects.length > 0
        ? savedOverride.canonicalSubjects
        : (student.remedialSubjects || []).map(subject => subject.canonicalName || getCanonicalSubjectName(subject.name)).filter(Boolean).slice(0, 2);
    const selectedSet = new Set(selectedSubjects.map(subjectName => normalizeArabic(subjectName)));

    const optionsHtml = candidates.map(candidate => {
        const checked = selectedSet.has(normalizeArabic(candidate.canonicalName)) ? 'checked' : '';
        const avgColor = candidate.avg < 10 ? '#b45309' : '#166534';
        const ruleBadge = candidate.isOfficialRule
            ? '<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:999px; background:#dbeafe; color:#1d4ed8; font-size:0.74rem; font-weight:700;">من مواد الشعبة</span>'
            : '<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:999px; background:#f1f5f9; color:#475569; font-size:0.74rem; font-weight:700;">اختيار يدوي</span>';

        return `
            <label style="display:flex; align-items:flex-start; gap:10px; padding:10px 12px; border:1px solid #dbeafe; border-radius:12px; background:#f8fbff; cursor:pointer; text-align:right;">
                <input class="secondary-remedial-checkbox" type="checkbox" value="${escapeRemedialHtml(candidate.canonicalName)}" ${checked} style="margin-top:4px; width:18px; height:18px; accent-color:#2563eb;">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                        <strong style="color:#0f172a;">${escapeRemedialHtml(candidate.name)}</strong>
                        <span style="display:inline-flex; align-items:center; gap:4px; padding:2px 9px; border-radius:999px; background:#fff; color:${avgColor}; border:1px solid rgba(148, 163, 184, 0.45); font-size:0.78rem; font-weight:800;">
                            المعدل: ${formatTruncatedTwoDecimals(candidate.avg)}
                        </span>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-top:6px;">
                        ${ruleBadge}
                        <span style="font-size:0.74rem; color:#64748b;">
                            ف1: ${formatTruncatedTwoDecimals(candidate.details.m1)} | ف2: ${formatTruncatedTwoDecimals(candidate.details.m2)} | ف3: ${formatTruncatedTwoDecimals(candidate.details.m3)}
                        </span>
                    </div>
                </div>
            </label>
        `;
    }).join('');

    const result = await Swal.fire({
        title: 'تعديل مواد الاستدراك',
        html: `
            <div style="text-align:right; display:grid; gap:12px;">
                <div style="padding:12px 14px; border-radius:12px; border:1px solid #e2e8f0; background:#f8fafc;">
                    <div style="font-weight:800; color:#0f172a;">${escapeRemedialHtml(student.name || '')}</div>
                    <div style="margin-top:6px; color:#475569; font-size:0.84rem;">
                        ${escapeRemedialHtml(student.level || '-')} | ${escapeRemedialHtml(getShortStreamName(student) || '-')} | القسم ${escapeRemedialHtml(student.class || '-')}
                    </div>
                </div>
                <div style="padding:10px 12px; border-radius:12px; background:#fff7ed; color:#9a3412; border:1px solid #fdba74; font-size:0.85rem; line-height:1.8;">
                    اختر مادة واحدة أو مادتين كحد أقصى. هذا التعديل اليدوي خاص بالطور الثانوي فقط، وسيُعتمد لاحقًا في بقية صفحات الاستدراك.
                </div>
                <div style="display:grid; gap:8px; max-height:360px; overflow-y:auto; padding-left:2px;">
                    ${optionsHtml}
                </div>
            </div>
        `,
        width: 760,
        focusConfirm: false,
        confirmButtonText: 'حفظ التعديل',
        confirmButtonColor: '#2563eb',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        showDenyButton: true,
        denyButtonText: 'الرجوع إلى الآلي',
        denyButtonColor: '#64748b',
        preConfirm: () => {
            const selected = Array.from(document.querySelectorAll('.secondary-remedial-checkbox:checked'))
                .map(input => input.value)
                .filter(Boolean);

            if (selected.length === 0 || selected.length > 2) {
                Swal.showValidationMessage('يرجى اختيار مادة واحدة أو مادتين على الأكثر.');
                return false;
            }

            return selected;
        }
    });

    if (result.isConfirmed) {
        const saved = await saveSecondaryRemedialSubjectOverride(storageKey, result.value || []);
        if (saved) {
            Swal.fire({ icon: 'success', title: 'تم الحفظ', text: 'تم حفظ تعديل مواد الاستدراك لهذا التلميذ.', timer: 1600, showConfirmButton: false });
        }
        return;
    }

    if (result.isDenied) {
        const cleared = await clearSecondaryRemedialSubjectOverride(storageKey);
        if (cleared) {
            Swal.fire({ icon: 'success', title: 'تمت الاستعادة', text: 'تمت إعادة مواد الاستدراك إلى التحديد الآلي.', timer: 1600, showConfirmButton: false });
        }
    }
}

// -----------------------------------------------------------------------------

// UI Rendering & Helpers

// -----------------------------------------------------------------------------

// About Modal Functions

function openAboutModal() {

    const modal = document.getElementById('aboutModal');

    if (modal) {

        modal.style.display = 'flex';

        // Close on outside click

        window.onclick = function (event) {

            if (event.target == modal) {

                closeAboutModal();

            }

        }

    }

}

function closeAboutModal() {

    const modal = document.getElementById('aboutModal');

    if (modal) {

        modal.style.display = 'none';

    }

}

function populateFilters() {
    const yearSelect = document.getElementById('yearSelect');
    const levelSelect = document.getElementById('levelSelect');
    if (!yearSelect || !levelSelect) return;

    // Populate Years
    const years = new Set();
    allStudents.forEach(s => {
        const y = getStudentYear(s);
        if (y) years.add(y);
    });
    const sortedYears = [...years].sort((a, b) => b.localeCompare(a));

    if (yearSelect.options.length === 0) {
        yearSelect.innerHTML = '';
        sortedYears.forEach(y => {
            yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
        });
        if (sortedYears.length > 0) yearSelect.value = sortedYears[0];
    }

    const selectedYear = yearSelect.value;
    const stage = getRemedialStage();
    const allowedLevelCodes = getAllowedRemedialLevels(stage);
    const levelsInYear = [...new Set(
        allStudents
            .filter(s => getStudentYear(s) === selectedYear)
            .map(s => s.level)
    )]
        .filter(l => l && isAllowedRemedialLevel(l, stage))
        .sort((a, b) => {
            const codeA = allowedLevelCodes.find(code => matchLevel(a, code)) || '99';
            const codeB = allowedLevelCodes.find(code => matchLevel(b, code)) || '99';
            return Number(codeA) - Number(codeB);
        });

    const currentLevel = levelSelect.value;
    levelSelect.innerHTML = '<option value="all">جميع المستويات</option>';
    levelsInYear.forEach(l => {
        levelSelect.innerHTML += `<option value="${l}">${l}</option>`;
    });

    if (levelsInYear.includes(currentLevel)) {
        levelSelect.value = currentLevel;
    } else {
        levelSelect.value = 'all';
    }
}

function updateClassOptions() {

    const levelSelect = document.getElementById('levelSelect');

    if (!levelSelect) return;

    const selectedLevel = levelSelect.value;

    const classSelect = document.getElementById('classSelect');

    if (!classSelect) return;

    classSelect.innerHTML = '<option value="all">الكل</option>';

    const streamSelect = document.getElementById('streamSelect');

    const selectedStream = streamSelect ? streamSelect.value : '';

    const selectedYear = document.getElementById('yearSelect')?.value || '';

    const classes = new Set();

    allStudents.forEach(s => {
        if (selectedYear && getStudentYear(s) !== selectedYear) return;

        // Filter by Level

        if (!levelMatchesSelection(s.level, selectedLevel)) return;

        // Filter by Stream (if visible/applicable)

        if (selectedStream && s.stream !== selectedStream) return;

        classes.add(s.class);

    });

    Array.from(classes).sort().forEach(c => {

        const opt = document.createElement('option');

        opt.value = c;

        opt.textContent = c;

        classSelect.appendChild(opt);

    });

}



function populateStreams() {

    const levelSelect = document.getElementById('levelSelect');

    const streamSelect = document.getElementById('streamSelect');

    const streamGroup = document.getElementById('streamGroup');

    if (!streamSelect || !streamGroup) return;

    const stage = getRemedialStage();

    if (stage === 'secondary') {

        streamGroup.style.display = 'flex';

        let streams = [];

        const selectedYear = document.getElementById('yearSelect')?.value || '';
        const selectedLevel = levelSelect ? levelSelect.value : 'all';
        const currentStream = streamSelect.value || '';

        const streamSet = new Set();
        allStudents.forEach(s => {
            if (!s.stream) return;
            if (selectedYear && getStudentYear(s) !== selectedYear) return;
            if (!levelMatchesSelection(s.level, selectedLevel)) return;
            streamSet.add(s.stream);
        });

        // Prefer streams actually present in the filtered data.
        streams = Array.from(streamSet).sort();

        // Fallback to SubjectManager only when a specific level is selected and data did not provide streams.
        if (streams.length === 0 && selectedLevel !== 'all' && typeof SubjectManager !== 'undefined' && SubjectManager.getStreams) {

            streams = SubjectManager.getStreams(selectedLevel);

        }

        // Reset and fill with new options

        // Don't just append, clear first and add "All" option

        streamSelect.innerHTML = '<option value="">جميع الشعب</option>';

        streams.forEach(stream => {

            const opt = document.createElement('option');

            opt.value = stream;

            opt.textContent = streamLabels[stream] || stream; // Translate

            streamSelect.appendChild(opt);

        });

        if (currentStream && streams.includes(currentStream)) {
            streamSelect.value = currentStream;
        }

    } else {

        streamGroup.style.display = 'none';

        streamSelect.innerHTML = '<option value="">جميع الشعب</option>';

    }

}

function populateSubjectFilter(students) {

    const subjects = new Set();

    students.forEach(s => {

        s.remedialSubjects.forEach(sub => subjects.add(sub.name));

    });

    const filter = document.getElementById('subjectFilter');

    if (!filter) return;

    const currentValue = filter.value || 'all';

    filter.innerHTML = '<option value="all">جميع المواد</option>';

    Array.from(subjects).sort().forEach(s => {

        const opt = document.createElement('option');

        opt.value = s;

        opt.textContent = s;

        filter.appendChild(opt);

    });

    filter.value = subjects.has(currentValue) ? currentValue : 'all';

}

function renderGeneralTables(filteredStudents) {
    // 1. General Stats (Level x Gender)

    const stats = {

        '1': { m: 0, f: 0 },

        '2': { m: 0, f: 0 },

        '3': { m: 0, f: 0 }

    };

    filteredStudents.forEach(s => {

        if (matchLevel(s.level, '4')) return;

        let lvl = '?';

        if (matchLevel(s.level, '1')) lvl = '1';

        else if (matchLevel(s.level, '2')) lvl = '2';

        else if (matchLevel(s.level, '3')) lvl = '3';

        else if (matchLevel(s.level, '4')) lvl = '4'; // Support level 4

        if (stats[lvl]) {

            if (s.gender === 'ذكر') stats[lvl].m++;

            else stats[lvl].f++;

        }

    });

    const genBody = document.getElementById('generalStatsBody');

    const stage = getRemedialStage();

    // Determine active levels based on data presence and stage

    let activeLevels = [];

    if (stage === 'secondary') {

        activeLevels = ['1', '2'];

    } else {

        activeLevels = ['1', '2', '3'];

        // If any student is level 4, add it (though usually filtered out)

        if (filteredStudents.some(s => matchLevel(s.level, '4'))) activeLevels.push('4');

    }

    // Filter active levels based on current selection
    const selectedLvl = document.getElementById('levelSelect')?.value || 'all';
    if (selectedLvl !== 'all') {
        activeLevels = activeLevels.filter(lvl => matchLevel(selectedLvl, lvl) || lvl.toString() === selectedLvl.toString());
    }

    if (genBody) {

        genBody.innerHTML = '';

        activeLevels.forEach(lvl => {

            const row = stats[lvl] || { m: 0, f: 0 };

            const total = row.m + row.f;

            genBody.innerHTML += `

                <tr>

                    <td>السنة ${lvl}</td>

                    <td>${row.m}</td>

                    <td>${row.f}</td>

                    <td><strong>${total}</strong></td>

                </tr>

            `;

        });

    }

    // 2. Subject Stats (Level x Subject)

    const allSubjects = new Set();
    const selectedSub = document.getElementById('subjectFilter')?.value || 'all';

    filteredStudents.forEach(s => {
        s.remedialSubjects.forEach(rs => {
            if (selectedSub === 'all' || rs.name === selectedSub) {
                allSubjects.add(rs.name);
            }
        });
    });

        const subjectFreq = {};
    filteredStudents.forEach(student => {
        student.remedialSubjects.forEach(sub => {
            subjectFreq[sub.name] = (subjectFreq[sub.name] || 0) + 1;
        });
    });
    const sortedSubs = Array.from(allSubjects).sort((a, b) => {
        const diff = (subjectFreq[b] || 0) - (subjectFreq[a] || 0);
        return diff !== 0 ? diff : a.localeCompare(b, 'ar');
    });

    const subHead = document.getElementById('subjectStatsHead');

    if (subHead) {

        let headHtml = '<tr><th>المستوى</th>';

        sortedSubs.forEach(sub => headHtml += `<th>${sub}</th>`);

        headHtml += '</tr>';

        subHead.innerHTML = headHtml;

    }

    const subStats = { '1': {}, '2': {}, '3': {}, '4': {} };

    activeLevels.forEach(l => {

        sortedSubs.forEach(sub => subStats[l][sub] = 0);

    });

    filteredStudents.forEach(s => {

        let lvl = '?';

        if (matchLevel(s.level, '1')) lvl = '1';

        else if (matchLevel(s.level, '2')) lvl = '2';

        else if (matchLevel(s.level, '3')) lvl = '3';

        else if (matchLevel(s.level, '4')) lvl = '4';

        if (subStats[lvl]) {

            s.remedialSubjects.forEach(rs => {

                if (selectedSub === 'all' || rs.name === selectedSub) {
                    if (subStats[lvl][rs.name] !== undefined) {
                        subStats[lvl][rs.name]++;
                    }
                }

            });

        }

    });

    const subBody = document.getElementById('subjectStatsBody');

    if (subBody) {

        subBody.innerHTML = '';

        activeLevels.forEach(lvl => {

            let rowHtml = `<tr><td>السنة ${lvl}</td>`;

            sortedSubs.forEach(sub => {

                const count = subStats[lvl][sub] || 0;

                const style = count > 0 ? 'font-weight:bold; color:var(--primary-color);' : 'color:#ccc;';

                rowHtml += `<td style="${style}">${count}</td>`;

            });

            rowHtml += '</tr>';

            subBody.innerHTML += rowHtml;

        });

        if (sortedSubs.length > 0) {

            let totalRowHtml = '<tr style="background-color: #f5f5f5; font-weight: bold;"><td>المجموع</td>';

            sortedSubs.forEach(sub => {

                const total = (subStats['1'][sub] || 0) + (subStats['2'][sub] || 0) + (subStats['3'][sub] || 0) + (subStats['4'][sub] || 0);

                totalRowHtml += `<td>${total}</td>`;

            });

            totalRowHtml += '</tr>';

            subBody.innerHTML += totalRowHtml;
        }

    }

}

function renderView() {

    const lvl = document.getElementById('levelSelect')?.value || 'all';

    const cls = document.getElementById('classSelect')?.value || 'all';

    const sub = document.getElementById('subjectFilter')?.value || 'all';

    const stream = document.getElementById('streamSelect')?.value || '';

    const yearFilter = document.getElementById('yearSelect')?.value || '';

    let filtered = remedialStudents.filter(s => {

        if (yearFilter && getStudentYear(s) !== yearFilter) return false;

        if (!levelMatchesSelection(s.level, lvl)) return false;

        if (cls !== 'all' && s.class !== cls) return false;

        // Match Stream (check visibility usually, or just if value exists)

        if (stream && s.stream !== stream) return false;

        if (sub !== 'all' && !s.remedialSubjects.some(rs => rs.name === sub)) return false;

        return true;

    });

    // Keep summary tables aligned with the currently displayed list.
    renderGeneralTables(filtered);

    // Render Detailed Table

    const tbody = document.getElementById('remedialTableBody');

    const thead = document.querySelector('#studentsListTable thead tr');

    const stage = getRemedialStage();

    const secondaryManualOverrideHint = document.getElementById('secondaryManualOverrideHint');
    if (secondaryManualOverrideHint) {
        secondaryManualOverrideHint.style.display = stage === 'secondary' ? 'block' : 'none';
    }

    if (thead) {

        if (stage === 'secondary') {

            thead.innerHTML = `

                <th width="3%">#</th>

                <th width="20%">الاسم واللقب</th>

                <th width="5%">المستوى</th>

                <th width="12%">الشعبة</th>

                <th width="5%">القسم</th>

                <th width="7%">المعدل السنوي</th>

                <th width="48%">المواد المعنية (المعدل السنوي للمادة)</th>

                <th width="8%">التعديل</th>

            `;

        } else {

            thead.innerHTML = `

                <th width="5%">#</th>

                <th width="20%">الاسم واللقب</th>

                <th width="6%">المستوى</th>

                <th width="6%">القسم</th>

                <th width="8%">المعدل السنوي</th>

                <th width="55%">المواد المعنية (المعدل السنوي للمادة)</th>

            `;

        }

    }

    if (tbody) {

        tbody.innerHTML = '';

        if (filtered.length === 0) {

            if (stage === 'secondary') {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">لا توجد بيانات</td></tr>';
                return;
            }

            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">لا توجد بيانات</td></tr>';

            return;

        }

        const rowsHtml = filtered.map((s, idx) => {

            const subTags = s.remedialSubjects

                .filter(rs => sub === 'all' || rs.name === sub)

                .map(rs => `<span class="subject-tag">${rs.name} (${formatTruncatedTwoDecimals(rs.avg)})</span>`)

                .join(' ');

            let row = '';

            if (stage === 'secondary') {

                const storageKeyJson = JSON.stringify(s.secondaryRemedialOverrideKey || getSecondaryRemedialOverrideStorageKey(s));
                const isManual = !!s.manualRemedialOverrideApplied;
                const manualFlagHtml = isManual
                    ? '<div style="margin-bottom:6px;"><span style="display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:999px; background:#fef3c7; color:#92400e; border:1px solid #fcd34d; font-size:0.76rem; font-weight:800;">تم تعديلها يدويًا</span></div>'
                    : '';
                const actionButtonLabel = isManual ? 'تعديل يدوي' : 'تعديل';
                const actionButtonStyle = isManual
                    ? 'background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow:0 6px 14px rgba(217, 119, 6, 0.18);'
                    : 'background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); box-shadow:0 6px 14px rgba(37, 99, 235, 0.18);';

                row = `

                <tr>

                    <td>${idx + 1}</td>

                    <td style="font-weight:bold;">${s.name}</td>

                    <td>${s.level}</td>

                    <td>${getShortStreamName(s)}</td>

                    <td>${s.class}</td>

                    <td><span class="avg-badge">${formatRoundedTwoDecimals(s.annualAverage)}</span></td>

                    <td style="text-align:right;">${manualFlagHtml}${subTags || '<span style="color:#94a3b8;">-</span>'}</td>

                    <td>
                        <button
                            type="button"
                            onclick='openSecondaryRemedialOverrideEditor(${storageKeyJson})'
                            style="width:100%; border:none; border-radius:10px; color:#fff; font-weight:800; padding:8px 10px; cursor:pointer; ${actionButtonStyle}"
                        >
                            ${actionButtonLabel}
                        </button>
                    </td>

                </tr>

                `;

            } else {

                row = `

                <tr>

                    <td>${idx + 1}</td>

                    <td style="font-weight:bold;">${s.name}</td>

                    <td>${s.level}</td>

                    <td>${s.class}</td>

                    <td><span class="avg-badge">${formatRoundedTwoDecimals(s.annualAverage)}</span></td>

                    <td style="text-align:right;">${subTags}</td>

                </tr>

                `;

            }

            return row;

        }).join('');

        tbody.innerHTML = rowsHtml;

    }

}

function matchLevel(lvlStr, target) {
    if (!lvlStr) return false;
    const s = lvlStr.toString();
    
    const hasLvl1Word = s.includes('الأولى') || s.includes('الاولى') || s.includes('أولى') || s.includes('اولى');
    const hasLvl2Word = s.includes('الثانية') || s.includes('الثانيه') || s.includes('ثانية') || s.includes('ثانيه');
    const hasLvl3Word = s.includes('الثالثة') || s.includes('الثالته') || s.includes('ثالثة') || s.includes('ثالته');
    const hasLvl4Word = s.includes('الرابعة') || s.includes('الرابعه') || s.includes('رابعة') || s.includes('رابعه');

    if (target === '1') return hasLvl1Word || (!hasLvl2Word && !hasLvl3Word && !hasLvl4Word && s.includes('1'));
    if (target === '2') return hasLvl2Word || (!hasLvl1Word && !hasLvl3Word && !hasLvl4Word && s.includes('2'));
    if (target === '3') return hasLvl3Word || (!hasLvl1Word && !hasLvl2Word && !hasLvl4Word && s.includes('3'));
    if (target === '4') return hasLvl4Word || (!hasLvl1Word && !hasLvl2Word && !hasLvl3Word && s.includes('4'));

    return false;
}

// Stream translations

const streamLabels = {

    'common_science': 'ج.م علوم وتكنولوجيا',

    'common_arts': 'ج.م آداب',

    'science': 'علوم تجريبية',

    'math': 'رياضيات',

    'tech_math': 'تقني رياضي',

    'tech_math_civil': 'هندسة مدنية',

    'tech_math_mech': 'هندسة ميكانيكية',

    'tech_math_elec': 'هندسة كهربائية',

    'tech_math_methods': 'هندسة الطرائق',

    'management': 'تسيير واقتصاد',

    'languages': 'لغات أجنبية',

    'arts': 'آداب وفلسفة'

};

function getStreamName(studentOrCode) {

    let code = '';

    if (typeof studentOrCode === 'string') {

        code = studentOrCode;

    } else if (studentOrCode && studentOrCode.stream) {

        code = studentOrCode.stream;

    }

    if (!code) return '';

    return streamLabels[code] || code;

}

function getShortStreamName(studentOrCode) {

    let code = '';

    if (typeof studentOrCode === 'string') {

        code = studentOrCode;

    } else if (studentOrCode && studentOrCode.stream) {

        code = studentOrCode.stream;

    }

    if (!code) return '';

    return streamShortLabels[code] || getStreamName(code);

}

function showWaitMessage(title, subtitle) {

    const area = document.getElementById('waitMessageArea');

    if (area) {

        area.innerHTML = `

            <div class="wait-message" style="display:block;">

                <div style="font-size: 3rem; margin-bottom: 20px;">⏳</div>

                <h2 style="color: var(--primary-color);">${title}</h2>

                <p style="color: #666;">${subtitle}</p>

            </div>

        `;

        area.style.display = 'block';

    }

    const content = document.getElementById('remedialContent');

    if (content) content.style.display = 'none';

}

// -----------------------------------------------------------------------------

// Print Functionality (Global Scope)

// -----------------------------------------------------------------------------

function buildRemedialPrintModelTwoTable(filteredStudents, stage, selectedSubject) {
        const subjectFreq = {};
    filteredStudents.forEach(student => {
        student.remedialSubjects.forEach(subject => {
            subjectFreq[subject.name] = (subjectFreq[subject.name] || 0) + 1;
        });
    });

    const subjectColumns = Array.from(new Set(
        filteredStudents.flatMap(student => student.remedialSubjects.map(subject => subject.name))
    ))
        .filter(subjectName => selectedSubject === 'all' || subjectName === selectedSubject)
        .sort((a, b) => {
            const diff = (subjectFreq[b] || 0) - (subjectFreq[a] || 0);
            return diff !== 0 ? diff : a.localeCompare(b, 'ar');
        });
    const fixedColumnsWidth = stage === 'secondary' ? 35 : 31;
    const availableSubjectWidth = Math.max(36, 100 - fixedColumnsWidth);
    const subjectColumnWidth = Math.max(3.8, availableSubjectWidth / Math.max(subjectColumns.length, 1));

    const formatSubjectHeaderForModelTwo = (subjectName) => {
        const cleanedName = String(subjectName || '').replace(/\s+/g, ' ').trim();
        if (!cleanedName || cleanedName.length <= 12) {
            return cleanedName;
        }

        const words = cleanedName.split(' ').filter(Boolean);
        if (words.length < 2) {
            return cleanedName;
        }

        let splitIndex = -1;
        const preferredBreaks = ['والجغرافيا', 'وآدابها', 'والحياة', 'والرياضية'];

        for (let i = 1; i < words.length; i++) {
            if (preferredBreaks.includes(words[i])) {
                splitIndex = i;
                break;
            }
        }

        if (splitIndex === -1) {
            const midpoint = cleanedName.length / 2;
            let bestDistance = Number.POSITIVE_INFINITY;

            for (let i = 1; i < words.length; i++) {
                const firstLine = words.slice(0, i).join(' ');
                const distance = Math.abs(firstLine.length - midpoint);

                if (distance < bestDistance) {
                    bestDistance = distance;
                    splitIndex = i;
                }
            }
        }

        const firstLine = words.slice(0, splitIndex).join(' ');
        const secondLine = words.slice(splitIndex).join(' ');

        return `${firstLine}<br>${secondLine}`;
    };

    const getShortStreamNameForModelTwo = (streamKey) => {
        const shortNames = {
            common_literature: 'ج.م آداب',
            common_science: 'ج.م علوم',
            literature_philosophy: 'أ.فلسفة',
            foreign_languages: 'لغات',
            experimental_sciences: 'ع.تجريبية',
            technical_math: 'ت.رياضي',
            mathematics: 'رياضيات',
            management_economics: 'ت.اقتصاد'
        };

        if (shortNames[streamKey]) {
            return shortNames[streamKey];
        }

        return getShortStreamName(streamKey) || '-';
    };

    let html = `

        <div class="card">

            <h3>🧾 القائمة الاسمية للمستدركين - نموذج 2</h3>

            <table class="model-two-table">

                <thead>

                    <tr>

                        <th width="3%">#</th>

                        <th width="18%">الاسم واللقب</th>

                        <th width="${stage === 'secondary' ? '7%' : '9%'}">المستوى</th>`;

    if (stage === 'secondary') {
        html += `<th width="12%">الشعبة</th>`;
    }

    html += `

                        <th width="${stage === 'secondary' ? '6%' : '8%'}">القسم</th>

                        <th width="${stage === 'secondary' ? '8%' : '10%'}">المعدل السنوي</th>`;

    subjectColumns.forEach(subjectName => {
        const officialNameV1 = typeof getOfficialSubjectNameForPrint === 'function'
            ? getOfficialSubjectNameForPrint(subjectName, stage)
            : subjectName;
        html += `<th class="subject-column">${formatSubjectHeaderForModelTwo(officialNameV1)}</th>`;
    });

    html += `

                    </tr>

                </thead>

                <tbody>`;

    if (filteredStudents.length === 0) {
        html += `<tr><td colspan="${subjectColumns.length + (stage === 'secondary' ? 6 : 5)}">لا توجد بيانات</td></tr>`;
    } else {
        filteredStudents.forEach((student, index) => {
            const concernedSubjects = new Set(
                student.remedialSubjects
                    .filter(subject => selectedSubject === 'all' || subject.name === selectedSubject)
                    .map(subject => subject.name)
            );

            html += `

                <tr>

                    <td>${index + 1}</td>

                    <td style="font-weight:bold;">${student.name}</td>

                    <td>${student.level}</td>`;

            if (stage === 'secondary') {
                const streamName = getShortStreamName(student.stream);
                html += `<td>${streamName}</td>`;
            }

            html += `

                    <td>${student.class}</td>

                    <td><strong>${formatRoundedTwoDecimals(student.annualAverage)}</strong></td>`;

            subjectColumns.forEach(subjectName => {
                html += `<td>${concernedSubjects.has(subjectName) ? 'معني' : ''}</td>`;
            });

            html += `

                </tr>`;
        });
    }

    html += `

                </tbody>

            </table>

        </div>`;

    return html;
}

function buildRemedialPrintModelTwoTableV2(filteredStudents, stage, selectedSubject) {
        const subjectFreq = {};
    filteredStudents.forEach(student => {
        student.remedialSubjects.forEach(subject => {
            subjectFreq[subject.name] = (subjectFreq[subject.name] || 0) + 1;
        });
    });

    const subjectColumns = Array.from(new Set(
        filteredStudents.flatMap(student => student.remedialSubjects.map(subject => subject.name))
    ))
        .filter(subjectName => selectedSubject === 'all' || subjectName === selectedSubject)
        .sort((a, b) => {
            const diff = (subjectFreq[b] || 0) - (subjectFreq[a] || 0);
            return diff !== 0 ? diff : a.localeCompare(b, 'ar');
        });

    const fixedColumnsWidth = stage === 'secondary' ? 40 : 34;
    const availableSubjectWidth = Math.max(36, 100 - fixedColumnsWidth);
    const subjectColumnWidth = Math.max(4.2, availableSubjectWidth / Math.max(subjectColumns.length, 1));

    const formatSubjectHeaderForModelTwo = (subjectName) => {
        const cleanedName = String(subjectName || '').replace(/\s+/g, ' ').trim();
        if (!cleanedName || cleanedName.length <= 12) {
            return cleanedName;
        }

        const words = cleanedName.split(' ').filter(Boolean);
        if (words.length < 2) {
            return cleanedName;
        }

        let splitIndex = -1;
        const preferredBreaks = ['والجغرافيا', 'وآدابها', 'والحياة', 'والرياضية'];

        for (let i = 1; i < words.length; i++) {
            if (preferredBreaks.includes(words[i])) {
                splitIndex = i;
                break;
            }
        }

        if (splitIndex === -1) {
            const midpoint = cleanedName.length / 2;
            let bestDistance = Number.POSITIVE_INFINITY;

            for (let i = 1; i < words.length; i++) {
                const firstLine = words.slice(0, i).join(' ');
                const distance = Math.abs(firstLine.length - midpoint);

                if (distance < bestDistance) {
                    bestDistance = distance;
                    splitIndex = i;
                }
            }
        }

        const firstLine = words.slice(0, splitIndex).join(' ');
        const secondLine = words.slice(splitIndex).join(' ');
        return `${firstLine}<br>${secondLine}`;
    };

    const getShortStreamNameForModelTwo = (streamKey) => {
        const shortNames = {
            common_literature: 'ج.م آداب',
            common_science: 'ج.م علوم',
            literature_philosophy: 'أ.فلسفة',
            foreign_languages: 'لغات',
            experimental_sciences: 'ع.تجريبية',
            technical_math: 'ت.رياضي',
            mathematics: 'رياضيات',
            management_economics: 'ت.اقتصاد'
        };

        if (shortNames[streamKey]) {
            return shortNames[streamKey];
        }

        return getShortStreamName(streamKey) || '-';
    };

    const subjectLabel = stage === 'secondary' ? 'الشعبة' : 'الفوج';
    const emptyColspan = subjectColumns.length + (stage === 'secondary' ? 6 : 5);

    let html = `
        <div class="card">
            <h3>📄 القائمة الاسمية للمستدركين - نموذج 2</h3>
            <table class="model-two-table">
                <thead>
                    <tr>
                        <th width="3%">#</th>
                        <th width="15%">الاسم واللقب</th>
                        <th width="${stage === 'secondary' ? '5%' : '6%'}">المستوى</th>`;

    if (stage === 'secondary') {
        html += `<th width="8%">${subjectLabel}</th>`;
    }

    html += `
                        <th width="${stage === 'secondary' ? '4%' : '6%'}">القسم</th>
                        <th width="${stage === 'secondary' ? '5%' : '7%'}">المعدل السنوي</th>`;

    subjectColumns.forEach(subjectName => {
        const officialName = typeof getOfficialSubjectNameForPrint === 'function'
            ? getOfficialSubjectNameForPrint(subjectName, stage)
            : subjectName;
        const verticalHeader = String(officialName || '').replace(/\s+/g, ' ').trim();
        html += `<th class="subject-column" style="width:${subjectColumnWidth.toFixed(2)}%"><span class="vertical-subject-label">${verticalHeader}</span></th>`;
    });

    html += `
                    </tr>
                </thead>
                <tbody>`;

    if (filteredStudents.length === 0) {
        html += `<tr><td colspan="${emptyColspan}">لا توجد بيانات</td></tr>`;
    } else {
        filteredStudents.forEach((student, index) => {
            const concernedSubjects = new Set(
                student.remedialSubjects
                    .filter(subject => selectedSubject === 'all' || subject.name === selectedSubject)
                    .map(subject => subject.name)
            );

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td class="model-two-name-cell"><strong>${student.name}</strong></td>
                    <td class="model-two-meta-cell">${student.level}</td>`;

            if (stage === 'secondary') {
                html += `<td class="model-two-meta-cell">${getShortStreamNameForModelTwo(student.stream)}</td>`;
            }

            html += `
                    <td class="model-two-meta-cell">${student.class}</td>
                    <td><strong>${formatRoundedTwoDecimals(student.annualAverage)}</strong></td>`;

            subjectColumns.forEach(subjectName => {
                const isConcerned = concernedSubjects.has(subjectName);
                const bgColor = isConcerned ? '' : 'background-color: #94a3b8;';
                html += `<td class="model-two-subject-cell" style="${bgColor}">${isConcerned ? 'معني' : ''}</td>`;
            });

            html += `
                </tr>`;
        });
    }

    html += `
                </tbody>
            </table>
        </div>`;

    return html;
}

function showRemedialPrintOptions() {
    if (blockTrialPrint()) return;

    Swal.fire({
        title: 'خيارات الطباعة',
        html: `
            <div style="display:grid; gap:10px; margin-top:10px;">
                <button id="printStatsOnlyBtn" class="swal2-confirm swal2-styled" style="margin:0; background:#2563eb;">
                    طباعة الإحصائيات
                </button>
                <button id="printListModelOneBtn" class="swal2-confirm swal2-styled" style="margin:0; background:#16a34a;">
                    طباعة القوائم - نموذج 1
                </button>
                <button id="printListModelTwoBtn" class="swal2-confirm swal2-styled" style="margin:0; background:#0ea5e9;">
                    طباعة القوائم - نموذج 2
                </button>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: 420,
        didOpen: () => {
            const bindPrintOption = (buttonId, printMode) => {
                const button = document.getElementById(buttonId);
                if (!button) return;
                button.addEventListener('click', () => {
                    Swal.close();
                    printRemedialReport(printMode);
                });
            };

            bindPrintOption('printStatsOnlyBtn', 'stats');
            bindPrintOption('printListModelOneBtn', 'list1');
            bindPrintOption('printListModelTwoBtn', 'list2');
        }
    });
}

async function printRemedialReport(printMode = 'list1') {
    if (blockTrialPrint()) return;

    var printModel = printMode === 'list2' ? 2 : 1;
    // Check if there's data

    if (remedialStudents.length === 0) {

        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد بيانات للطباعة. يرجى التأكد من وجود تلاميذ مؤهلين للاستدراك.' });

        return;

    }

    // Get filter values

    const selectedLevel = document.getElementById('levelSelect')?.value || 'all';

    const selectedClass = document.getElementById('classSelect')?.value || 'all';

    const selectedStream = document.getElementById('streamSelect')?.value || '';

    const selectedSubject = document.getElementById('subjectFilter')?.value || 'all';

    const selectedYear = document.getElementById('yearSelect')?.value || '';

    // Filter students based on current selection

    let filteredStudents = remedialStudents.filter(s => {

        if (selectedYear && getStudentYear(s) !== selectedYear) return false;

        if (!levelMatchesSelection(s.level, selectedLevel)) return false;

        if (selectedClass !== 'all' && s.class !== selectedClass) return false;

        if (selectedStream && s.stream !== selectedStream) return false;

        if (selectedSubject !== 'all' && !s.remedialSubjects.some(rs => rs.name === selectedSubject)) return false;

        return true;

    });

    // Detect Stage

    const stage = getRemedialStage();

    // Build title

    let filterText = '';

    if (selectedLevel !== 'all') filterText += ` - السنة ${selectedLevel}`;

    if (selectedStream) filterText += ` - ${streamLabels[selectedStream] || selectedStream}`;

    if (selectedClass !== 'all') filterText += ` - القسم ${selectedClass}`;

    if (selectedYear) filterText += ` - ${selectedYear}`;

    const pageTitle = `قائمة التلاميذ المعنيين بالامتحان الاستدراكي${filterText}`;

    const reportTitle = printModel === 2 ? `${pageTitle} - نموذج 2` : pageTitle;

    const statsTitle = `إحصائيات الاستدراك${filterText}`;
    const resolvedReportTitle = printMode === 'stats'
        ? statsTitle
        : (printMode === 'list2' ? `${pageTitle} - نموذج 2` : `${pageTitle} - نموذج 1`);

    const settings = await DB.getSettings() || {};

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // Determine Levels for Stats

    let statsLevels = [];

    if (stage === 'secondary') {

        statsLevels = ['1', '2'];

    } else {

        statsLevels = ['1', '2', '3'];

        if (filteredStudents.some(s => matchLevel(s.level, '4'))) statsLevels.push('4');
    }

    // 1. General Stats Calculation
    const stats = {};
    statsLevels.forEach(l => stats[l] = { m: 0, f: 0 });

    filteredStudents.forEach(s => {
        let lvl = '?';
        statsLevels.forEach(l => { if (matchLevel(s.level, l)) lvl = l; });
        if (stats[lvl]) {
            if (s.gender === 'ذكر') stats[lvl].m++;
            else stats[lvl].f++;
        }
    });

    // General Stats HTML
    let generalStatsHTML = `
        <div class="card">
            <h3>📊 التعداد العام (حسب الجنس)</h3>
            <table>
                <thead>
                    <tr>
                        <th>المستوى</th>
                        <th>ذكور</th>
                        <th>إناث</th>
                        <th>المجموع</th>
                    </tr>
                </thead>
                <tbody>`;

    statsLevels.forEach(lvl => {
        const row = stats[lvl];
        const total = row.m + row.f;
        generalStatsHTML += `
            <tr>
                <td>السنة ${lvl}</td>
                <td>${row.m}</td>
                <td>${row.f}</td>
                <td><strong>${total}</strong></td>
            </tr>`;
    });
    generalStatsHTML += `
                </tbody>
            </table>
        </div>`;

    // 2. Subject Stats Calculation
    const allSubjects = new Set();
    filteredStudents.forEach(s => s.remedialSubjects.forEach(rs => allSubjects.add(rs.name)));
        const subjectFreq = {};
    filteredStudents.forEach(student => {
        student.remedialSubjects.forEach(sub => {
            subjectFreq[sub.name] = (subjectFreq[sub.name] || 0) + 1;
        });
    });
    const sortedSubs = Array.from(allSubjects).sort((a, b) => {
        const diff = (subjectFreq[b] || 0) - (subjectFreq[a] || 0);
        return diff !== 0 ? diff : a.localeCompare(b, 'ar');
    });
    
    const subStats = {};
    statsLevels.forEach(l => {
        subStats[l] = {};
        sortedSubs.forEach(sub => subStats[l][sub] = 0);
    });

    filteredStudents.forEach(s => {

        let lvl = '?';

        statsLevels.forEach(l => { if (matchLevel(s.level, l)) lvl = l; });

        if (subStats[lvl]) {

            s.remedialSubjects.forEach(rs => {

                if (subStats[lvl][rs.name] !== undefined) subStats[lvl][rs.name]++;

            });

        }

    });

    // Subject Stats HTML

    let subjectStatsHTML = `

        <div class="card">

            <h3>📚 توزيع المواد (حسب المستوى)</h3>

            <table>

                <thead>

                    <tr>

                        <th>المستوى</th>`;

    sortedSubs.forEach(sub => subjectStatsHTML += `<th>${sub}</th>`);

    subjectStatsHTML += `

                    </tr>

                </thead>

                <tbody>`;

    statsLevels.forEach(lvl => {

        subjectStatsHTML += `<tr><td>السنة ${lvl}</td>`;

        sortedSubs.forEach(sub => {

            const count = subStats[lvl][sub];

            const style = count > 0 ? 'font-weight:bold;' : 'color:#999;';

            subjectStatsHTML += `<td style="${style}">${count}</td>`;

        });

        subjectStatsHTML += `</tr>`;

    });

    subjectStatsHTML += `<tr style="background-color: #f5f5f5; font-weight: bold;"><td>المجموع</td>`;

    sortedSubs.forEach(sub => {

        let total = 0;

        statsLevels.forEach(l => total += subStats[l][sub]);

        subjectStatsHTML += `<td>${total}</td>`;

    });

    subjectStatsHTML += `

                </tbody>

            </table>

        </div>`;

    // 3. Detailed List HTML

    let detailedTableHTML = `

        <div class="card">

            <h3>📝 القائمة الاسمية للمستدركين</h3>

            <table>

                <thead>

                    <tr>

                        <th width="${stage === 'secondary' ? '3%' : '5%'}">#</th>

                        <th width="20%">الاسم واللقب</th>

                        <th width="${stage === 'secondary' ? '5%' : '6%'}">المستوى</th>`;

    if (stage === 'secondary') {

        detailedTableHTML += `<th width="12%">الشعبة</th>`;

    }

    detailedTableHTML += `

                        <th width="${stage === 'secondary' ? '5%' : '6%'}">القسم</th>

                        <th width="${stage === 'secondary' ? '7%' : '8%'}">المعدل السنوي</th>

                        <th width="${stage === 'secondary' ? '48%' : '55%'}">المواد المعنية (المعدل السنوي للمادة)</th>

                    </tr>

                </thead>

                <tbody>`;

    if (filteredStudents.length === 0) {

        detailedTableHTML += `<tr><td colspan="${stage === 'secondary' ? 7 : 6}">لا توجد بيانات</td></tr>`;

    } else {

        filteredStudents.forEach((s, idx) => {

            const subTags = s.remedialSubjects

                .filter(rs => selectedSubject === 'all' || rs.name === selectedSubject)

                .map(rs => `${(typeof getOfficialSubjectNameForPrint === 'function' ? getOfficialSubjectNameForPrint(rs.name, stage) : rs.name)} (${formatTruncatedTwoDecimals(rs.avg)})`)

                .join('، ');

            detailedTableHTML += `

                <tr>

                    <td>${idx + 1}</td>

                    <td style="font-weight:bold;">${s.name}</td>

                    <td>${s.level}</td>`;

            if (stage === 'secondary') {

                const streamName = getShortStreamName(s.stream);

                detailedTableHTML += `<td>${streamName}</td>`;

            }

            detailedTableHTML += `

                    <td>${s.class}</td>

                    <td><strong>${formatRoundedTwoDecimals(s.annualAverage)}</strong></td>

                    <td style="text-align:right;">${subTags}</td>

                </tr>`;

        });

    }

    detailedTableHTML += `

                </tbody>

            </table>

        </div>`;

    if (printMode === 'list2') {
        detailedTableHTML = buildRemedialPrintModelTwoTableV2(filteredStudents, stage, selectedSubject);
    }

    const printSectionsHTML = printMode === 'stats'
        ? `${generalStatsHTML}${subjectStatsHTML}`
        : detailedTableHTML;

    // Open print window

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>تقرير الاستدراك</title>

            <style>

* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }

                @font-face {

                    font-family: 'Tajawal';

                    font-style: normal;

                    font-weight: 400;

                    src: url('assets/fonts/Tajawal-Regular.ttf') format('truetype');

                }

                @font-face {

                    font-family: 'Tajawal';

                    font-style: normal;

                    font-weight: 700;

                    src: url('assets/fonts/Tajawal-Bold.ttf') format('truetype');

                }

                body {

                    font-family: 'Tajawal', sans-serif;

                    padding: 20px;

                    background: 'var(--card-bg)';

                }

                table {

                    width: 100%;

                    border-collapse: collapse;

                    margin-bottom: 15px;

                    font-size: 10pt;

                }

                th, td {

                    border: 0.5pt solid #000;

                    padding: 4px 6px;

                    text-align: center;

                }

                th {

                    background-color: #f0f0f0 !important;

                    font-weight: bold;

                    -webkit-print-color-adjust: exact;

                }

                h3 {

                    font-size: 12pt;

                    margin: 10px 0 5px 0;

                    color: #000;

                    border-bottom: 1px solid #ccc;

                    padding-bottom: 5px;

                }

                .card {

                    margin-bottom: 15px;

                }

                .model-two-table th,
                .model-two-table td {

                    font-size: 8pt;

                    white-space: normal;

                    overflow-wrap: anywhere;

                    word-break: break-word;

                    padding: 2px 3px;

                    vertical-align: middle;

                }

                .model-two-table {

                    width: 100%;

                    table-layout: fixed;

                }

                .model-two-table th.subject-column {

                    height: 128px;

                    padding: 4px 0;

                    vertical-align: top;

                    text-align: center;

                    overflow: visible;

                }

                .model-two-table th.subject-column .vertical-subject-label {

                    display: inline-flex;

                    align-items: flex-start;

                    justify-content: center;

                    height: 100%;

                    writing-mode: vertical-rl;

                    text-orientation: mixed;

                    white-space: normal;

                    line-height: 1;

                    font-size: 7.25pt;

                    transform: rotate(180deg);

                }

                .model-two-name-cell,
                .model-two-meta-cell {

                    font-size: 7.5pt;

                }

                .model-two-subject-cell {

                    font-size: 7.75pt;

                    font-weight: 600;

                }

                .stats-section {

                    margin-bottom: 20px;

                }

                @page {

                    size: landscape;

                    margin: 1cm;

                }

                @media print {

                    .card { break-inside: auto; }

                    tr { break-inside: avoid; }

                }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

            <div style="text-align: center; border-bottom: 2px solid var(--primary-color); margin-bottom: 15px; padding-bottom: 10px;">

                <div style="display: flex; justify-content: space-between; font-size: 10pt; margin-bottom: 5px;">

                    <div>الولاية: ${settings.wilaya || '.......'}</div>

                    <div>البلدية: ${settings.municipality || '.......'}</div>

                </div>

                <h2 style="margin: 5px 0; font-size: 16pt; color: var(--primary-color);">${resolvedReportTitle}</h2>

                <div style="display: flex; justify-content: space-between; font-size: 10pt; margin-top: 5px;">

                    <div>السنة الدراسية: ${settings.schoolYear || '2025/2026'}</div>

                    <div>المؤسسة: ${settings.institutionName || '.......'}</div>

                </div>

            </div>

            ${printMode === 'stats' ? `<div class="stats-section">${printSectionsHTML}</div>` : printSectionsHTML}

            <div style="margin-top: 30px; display: flex; justify-content: space-between; direction: rtl; font-size: 11pt;">

                <div style="text-align: right;">

                    حرر بـ: ${settings.municipality || '.......'} في: ${today}

                </div>

                <div style="text-align: center; min-width: 150px;">

                    المدير(ة)<br>

                    <strong>${settings.managerName || '................'}</strong>

                </div>

            </div>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

    printWindow.focus();

    // auto-print removed

}

async function openExemptSubjectsSettings() {
    const stage = getRemedialStage();
    const levels = stage === 'secondary' ? [1, 2, 3] : [1, 2, 3, 4];
    
    let html = `
        <style>
            .exempt-table-swal { width: 100%; text-align: center; border-collapse: collapse; margin-top: 15px; direction: rtl; }
            .exempt-table-swal th, .exempt-table-swal td { border: 1px solid #e2e8f0; padding: 10px; font-size: 0.9rem; }
            .exempt-table-swal th { background: #f8fafc; font-weight: bold; color: #1e293b; }
            .toggle-switch-swal { position: relative; display: inline-block; width: 40px; height: 20px; }
            .toggle-switch-swal input { opacity: 0; width: 0; height: 0; }
            .toggle-slider-swal { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .4s; border-radius: 20px; }
            .toggle-slider-swal:before { position: absolute; content: ''; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
            .toggle-switch-swal input:checked + .toggle-slider-swal { background-color: #10b981; }
            .toggle-switch-swal input:checked + .toggle-slider-swal:before { transform: translateX(20px); }
        </style>
        <div style="font-size: 0.95rem; color: #475569; margin-bottom: 15px; text-align: right; line-height: 1.6;">
            حدد المواد المعفاة لكل مستوى. التغييرات ستُحفظ وتُطبق تلقائياً على القوائم الحالية وفي جميع أنحاء التطبيق.
        </div>
        <table class="exempt-table-swal">
            <thead>
                <tr>
                    <th>المستوى</th>
                    <th>ت.تشكيلية</th>
                    <th>ت.موسيقية</th>
                    <th>إعلام آلي</th>
                    <th>أمازيغية</th>
                </tr>
            </thead>
            <tbody>
    `;

    const subjects = ['art', 'music', 'info', 'ama'];
    
    levels.forEach(level => {
        html += `<tr><td style="font-weight:bold;">السنة ${level}</td>`;
        subjects.forEach(sub => {
            const isChecked = (exemptSubjects[level] || []).includes(sub) ? 'checked' : '';
            html += `
                <td>
                    <label class="toggle-switch-swal">
                        <input type="checkbox" id="exempt_${level}_${sub}" ${isChecked}>
                        <span class="toggle-slider-swal"></span>
                    </label>
                </td>
            `;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;

    const result = await Swal.fire({
        title: '<span data-icon="ban"></span> إعدادات إعفاء المواد',
        html: html,
        showCancelButton: true,
        confirmButtonText: 'حفظ الإعدادات',
        cancelButtonText: 'إلغاء',
        width: '600px',
        didOpen: () => {
            if (window.IconManager) window.IconManager.render();
        },
        preConfirm: () => {
            const newExempts = {};
            levels.forEach(level => {
                const exempted = [];
                subjects.forEach(sub => {
                    const cb = document.getElementById(`exempt_${level}_${sub}`);
                    if (cb && cb.checked) {
                        exempted.push(sub);
                    }
                });
                newExempts[level] = exempted;
            });
            return newExempts;
        }
    });

    if (result.isConfirmed) {
        const newExempts = result.value;
        try {
            await DB.set('exemptSubjects', newExempts);
            exemptSubjects = newExempts;
            
            processRemedialData();
            renderView();
            
            Swal.fire({
                icon: 'success',
                title: 'تم الحفظ',
                text: 'تم حفظ إعدادات الإعفاء بنجاح وتحديث النتائج فوراً.',
                timer: 1500,
                showConfirmButton: false
            });
            
        } catch (err) {
            console.error('Failed to save exemptSubjects:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء حفظ الإعدادات', 'error');
        }
    }
}


function getOfficialSubjectNameForPrint(canonicalName, stage) {
    if (!canonicalName) return '';

        const normalizeAr = (s) => {
            if (!s) return '';
            let n = typeof normalizeArabic === 'function' ? normalizeArabic(s).trim() : s.trim();
            // Fallback normalization if normalizeArabic isn't doing it
            n = n.replace(/[أإآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
            return n;
        };
        const norm = normalizeAr(canonicalName);

        if (stage === 'secondary') {
            const secMap = {
                'لغه عربيه': 'اللغة العربية وآدابها',
                'لغه العربيه': 'اللغة العربية وآدابها',
                'العربيه': 'اللغة العربية وآدابها',
                'لغة عربية': 'اللغة العربية وآدابها',
                'لغة العربية': 'اللغة العربية وآدابها',
                'العربية': 'اللغة العربية وآدابها',
                'لغه فرنسيه': 'اللغة الفرنسية',
                'فرنسيه': 'اللغة الفرنسية',
                'لغة فرنسية': 'اللغة الفرنسية',
                'فرنسية': 'اللغة الفرنسية',
                'لغه انجليزيه': 'اللغة الإنجليزية',
                'لغه انكليزيه': 'اللغة الإنجليزية',
                'انجليزيه': 'اللغة الإنجليزية',
                'لغة انجليزية': 'اللغة الإنجليزية',
                'لغة انكليزية': 'اللغة الإنجليزية',
                'انجليزية': 'اللغة الإنجليزية',
                'رياضيات': 'الرياضيات',
                'فيزياء': 'العلوم الفيزيائية',
                'علوم فيزيائيه': 'العلوم الفيزيائية',
                'علوم فيزيائية': 'العلوم الفيزيائية',
                'علوم طبيعيه': 'علوم الطبيعة والحياة',
                'علوم الطبيعه': 'علوم الطبيعة والحياة',
                'علوم طبيعية': 'علوم الطبيعة والحياة',
                'علوم الطبيعة': 'علوم الطبيعة والحياة',
                'علوم': 'علوم الطبيعة والحياة',
                'تاريخ وجغرافيا': 'التاريخ والجغرافيا',
                'تاريخ و جغرافيا': 'التاريخ والجغرافيا',
                'تاريخ': 'التاريخ والجغرافيا',
                'جغرافيا': 'التاريخ والجغرافيا',
                'علوم اسلاميه': 'العلوم الإسلامية',
                'تربيه اسلاميه': 'العلوم الإسلامية',
                'اسلاميه': 'العلوم الإسلامية',
                'الاسلاميه': 'العلوم الإسلامية',
                'علوم إسلامية': 'العلوم الإسلامية',
                'تربية إسلامية': 'العلوم الإسلامية',
                'إسلامية': 'العلوم الإسلامية',
                'الإسلامية': 'العلوم الإسلامية',
                'علوم اسلامية': 'العلوم الإسلامية',
                'تربية اسلامية': 'العلوم الإسلامية',
                'اسلامية': 'العلوم الإسلامية',
                'الاسلامية': 'العلوم الإسلامية',
                'فلسفه': 'الفلسفة',
                'فلسفة': 'الفلسفة',
                'قانون': 'القانون',
                'اقتصاد و مناجمنت': 'الاقتصاد والمناجمنت',
                'اقتصاد': 'الاقتصاد والمناجمنت',
                'تسيير مالي و محاسبي': 'التسيير المالي والمحاسبي',
                'تسيير مالي': 'التسيير المالي والمحاسبي',
                'هندسه مدنيه': 'الهندسة المدنية',
                'هندسة مدنية': 'الهندسة المدنية',
                'هندسه ميكانيكيه': 'الهندسة الميكانيكية',
                'هندسة ميكانيكية': 'الهندسة الميكانيكية',
                'هندسه كهربائيه': 'الهندسة الكهربائية',
                'هندسة كهربائية': 'الهندسة الكهربائية',
                'هندسه الطرائق': 'هندسة الطرائق',
                'هندسة الطرائق': 'هندسة الطرائق',
                'تربيه بدنيه': 'التربية البدنية والرياضية',
                'بدنيه': 'التربية البدنية والرياضية',
                'تربية بدنية': 'التربية البدنية والرياضية',
                'بدنية': 'التربية البدنية والرياضية',
                'رياضه': 'التربية البدنية والرياضية',
                'رياضة': 'التربية البدنية والرياضية',
                'تربيه تشكيليه': 'التربية التشكيلية',
                'ت.تشكيليه': 'التربية التشكيلية',
                'تشكيليه': 'التربية التشكيلية',
                'تربية تشكيلية': 'التربية التشكيلية',
                'ت.تشكيلية': 'التربية التشكيلية',
                'تشكيلية': 'التربية التشكيلية',
                'تربيه موسيقيه': 'التربية الموسيقية',
                'موسيقي': 'التربية الموسيقية',
                'تربية موسيقية': 'التربية الموسيقية',
                'موسيقى': 'التربية الموسيقية',
                'تربيه فنيه': 'التربية الفنية',
                'فنيه': 'التربية الفنية',
                'تربية فنية': 'التربية الفنية',
                'فنية': 'التربية الفنية',
                'لغه امازيغيه': 'اللغة الأمازيغية',
                'امازيغيه': 'اللغة الأمازيغية',
                'لغة امازيغية': 'اللغة الأمازيغية',
                'امازيغية': 'اللغة الأمازيغية',
                'اعلام الي': 'المعلوماتية',
                'معلوماتيه': 'المعلوماتية',
                'معلوماتية': 'المعلوماتية',
            };
            if (secMap[norm]) return secMap[norm];
            if (norm.includes('اسبانيه') || norm.includes('اسبانية')) return 'اللغة الإسبانية';
            if (norm.includes('المانيه') || norm.includes('الماني') || norm.includes('المانية')) return 'اللغة الألمانية';
            if (norm.includes('ايطاليه') || norm.includes('ايطالية')) return 'اللغة الإيطالية';
        } else {
            const midMap = {
                'لغه عربيه': 'اللغة العربية',
                'لغه العربيه': 'اللغة العربية',
                'العربيه': 'اللغة العربية',
                'لغة عربية': 'اللغة العربية',
                'لغة العربية': 'اللغة العربية',
                'العربية': 'اللغة العربية',
                'لغه فرنسيه': 'اللغة الفرنسية',
                'فرنسيه': 'اللغة الفرنسية',
                'لغة فرنسية': 'اللغة الفرنسية',
                'فرنسية': 'اللغة الفرنسية',
                'لغه انجليزيه': 'اللغة الإنجليزية',
                'لغه انكليزيه': 'اللغة الإنجليزية',
                'انجليزيه': 'اللغة الإنجليزية',
                'لغة انجليزية': 'اللغة الإنجليزية',
                'لغة انكليزية': 'اللغة الإنجليزية',
                'انجليزية': 'اللغة الإنجليزية',
                'رياضيات': 'الرياضيات',
                'فيزياء': 'العلوم الفيزيائية والتكنولوجيا',
                'علوم فيزيائيه': 'العلوم الفيزيائية والتكنولوجيا',
                'علوم فيزيائية': 'العلوم الفيزيائية والتكنولوجيا',
                'علوم طبيعيه': 'علوم الطبيعة والحياة',
                'علوم الطبيعه': 'علوم الطبيعة والحياة',
                'علوم طبيعية': 'علوم الطبيعة والحياة',
                'علوم الطبيعة': 'علوم الطبيعة والحياة',
                'علوم': 'علوم الطبيعة والحياة',
                'تربيه اسلاميه': 'التربية الإسلامية',
                'اسلاميه': 'التربية الإسلامية',
                'تربية إسلامية': 'التربية الإسلامية',
                'إسلامية': 'التربية الإسلامية',
                'تربية اسلامية': 'التربية الإسلامية',
                'اسلامية': 'التربية الإسلامية',
                'تربيه مدنيه': 'التربية المدنية',
                'مدنيه': 'التربية المدنية',
                'تربية مدنية': 'التربية المدنية',
                'مدنية': 'التربية المدنية',
                'تاريخ وجغرافيا': 'التاريخ والجغرافيا',
                'تاريخ و جغرافيا': 'التاريخ والجغرافيا',
                'تاريخ': 'التاريخ والجغرافيا',
                'جغرافيا': 'التاريخ والجغرافيا',
                'تربيه بدنيه': 'التربية البدنية والرياضية',
                'بدنيه': 'التربية البدنية والرياضية',
                'رياضه': 'التربية البدنية والرياضية',
                'تربية بدنية': 'التربية البدنية والرياضية',
                'بدنية': 'التربية البدنية والرياضية',
                'رياضة': 'التربية البدنية والرياضية',
                'تربيه تشكيليه': 'التربية التشكيلية',
                'ت.تشكيليه': 'التربية التشكيلية',
                'تشكيليه': 'التربية التشكيلية',
                'تربية تشكيلية': 'التربية التشكيلية',
                'ت.تشكيلية': 'التربية التشكيلية',
                'تشكيلية': 'التربية التشكيلية',
                'تربيه موسيقيه': 'التربية الموسيقية',
                'موسيقي': 'التربية الموسيقية',
                'تربية موسيقية': 'التربية الموسيقية',
                'موسيقى': 'التربية الموسيقية',
                'تربيه فنيه': 'التربية الفنية',
                'فنيه': 'التربية الفنية',
                'تربية فنية': 'التربية الفنية',
                'فنية': 'التربية الفنية',
                'لغه امازيغيه': 'اللغة الأمازيغية',
                'امازيغيه': 'اللغة الأمازيغية',
                'لغة امازيغية': 'اللغة الأمازيغية',
                'امازيغية': 'اللغة الأمازيغية',
                'اعلام الي': 'المعلوماتية',
                'معلوماتيه': 'المعلوماتية',
                'معلوماتية': 'المعلوماتية',
                'تكنولوجيا': 'التكنولوجيا',
            };
            if (midMap[norm]) return midMap[norm];
        }
        return (typeof subjectName !== 'undefined' ? subjectName : canonicalName);

}
