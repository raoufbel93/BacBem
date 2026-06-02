const trimesterMap = { '1': 'الأول', '2': 'الثاني', '3': 'الثالث', 'annual': 'السنوي' };
function getStudentYear(s) {
    if (!s) return '';
    const y = s.academic_year || s.schoolYear || s.year || s.school_year || '';
    if (y) return y;
    // Fallback search in all properties for a year pattern (e.g. 2024 or 2023/2024)
    for (const key in s) {
        if (typeof s[key] === 'string' && /\b20\d{2}\b/.test(s[key])) {
            const v = s[key];
            const match = v.match(/\b20\d{2}([/-]20\d{2})?\b/);
            if (match) return match[0];
        }
    }
    return '';
}

// 1. Load Data

let studentsData = [];

let institutionSettings = {}; // Global settings

let orderedSubjects = []; // Will be populated dynamically or from hardcoded defaults based on stage

// Map for subject matching

const subjectAliases = {

    // -- Langes --

    'عربية': ['لغة عربية', 'أدب عربي', 'اللغة العربية', 'اللغة العربية وآدابها'],

    'لغة عربية': ['عربية', 'أدب عربي', 'اللغة العربية', 'اللغة العربية وآدابها'],

    'فرنسية': ['لغة فرنسية', 'فرنسية', 'اللغة الفرنسية'],

    'لغة فرنسية': ['فرنسية', 'لغة فرنسية', 'اللغة الفرنسية'],

    'انجليزية': ['لغة انجليزية', 'انجليزية', 'اللغة الإنجليزية', 'اللغة الانجليزية', 'اللغة الأنجليزية'],

    'لغة انجليزية': ['انجليزية', 'لغة انجليزية', 'اللغة الإنجليزية', 'اللغة الانجليزية', 'اللغة الأنجليزية'],

    'لغة ثالثة': ['اللغة اﻷجنبية الثالثة', 'لغة أجنبية ثالثة', 'لغة ثالثة', 'اللغة الثالثة', 'ألمانية', 'اسبانية', 'إسبانية', 'إيطالية', 'ايطالية', 'لغة 3', 'اللغة 3', 'اللغة الأجنبية 3', 'Allemand', 'Espagnol', 'Italien', 'Deutsch', 'Spanish', 'Italian'],

    'أمازيغية': ['اللغة الأمازيغية', 'امازيغية', 'الأمازيغية', 'تاريخ و جغرافيا الأمازيغية', 'لغة أمازيغية'],

    // -- Sciences --

    'رياضيات': ['رياضيات', 'الرياضيات'],

    'علوم': ['علوم طبيعية', 'ع.طبيعية', 'ع الطبيعة و الحياة', 'طبيعة و حياة', 'العلوم الطبيعية', 'علوم', 'ع الطبيعة والحياة', 'العلوم الطبيعية والحياة', 'علوم الطبيعة والحياة', 'العلوم الطبيعة والحياة'],

    'علوم طبيعية': ['علوم', 'ع.طبيعية', 'ع الطبيعة و الحياة', 'طبيعة و حياة', 'العلوم الطبيعية', 'ع الطبيعة والحياة', 'علوم الطبيعة والحياة', 'العلوم الطبيعة والحياة'],

    'فيزياء': ['علوم فيزيائية', 'ع.فيزيائية', 'تكنولوجيا', 'فيزياء', 'العلوم الفيزيائية', 'ع الفيزيائية والتكنولوجيا', 'ع الفيزيائية و التكنولوجيا'],

    'علوم فيزيائية': ['فيزياء', 'ع.فيزيائية', 'تكنولوجيا', 'العلوم الفيزيائية', 'ع الفيزيائية والتكنولوجيا', 'ع الفيزيائية و التكنولوجيا'],

    'تكنولوجيا': ['هندسة', 'هندسة مدنية', 'هندسة ميكانيكية', 'هندسة طرائق', 'هندسة كهربائية', 'تكنولوجيا'],

    // -- Humanities --

    'اسلامية': ['علوم اسلامية', 'إسلامية', 'التربية الاسلامية', 'شريعة', 'العلوم الإسلامية', 'العلوم الاسلامية', 'التربية الإسلامية', 'تربية إسلامية', 'تربية اسلامية'],

    'علوم اسلامية': ['اسلامية', 'إسلامية', 'التربية الاسلامية', 'شريعة', 'العلوم الإسلامية', 'العلوم الاسلامية'],

    'تاريخ': ['تاريخ', 'اجتماعيات', 'تاريخ و جغرافيا', 'التاريخ والجغرافيا', 'التاريخ و الجغرافيا'],

    'تاريخ وجغرافيا': ['تاريخ', 'جغرافيا', 'اجتماعيات', 'تاريخ و جغرافيا', 'التاريخ والجغرافيا', 'التاريخ و الجغرافيا'],

    'مدنية': ['مدنية', 'تربية مدنية', 'التربية المدنية', 'تربية مدنية'],

    'فلسفة': ['فلسفة', 'الفلسفة'],

    // -- Tech / Management --

    'معلوماتية': ['معلوماتية', 'اعلام', 'إعلام آلي', 'اعلام آلي', 'الإعلام الآلي', 'الاعلام الالي', 'إعلام آلي'],

    'اعلام آلي': ['معلوماتية', 'اعلام', 'إعلام', 'اعلام الي'],

    'تسيير محاسبي': ['تسيير', 'محاسبة', 'تسيير مالي', 'التسيير المحاسبي والمالي', 'ت. المحاسبي و المالي'],

    'اقتصاد ومناجمنت': ['اقتصاد', 'مناجمنت', 'الإقتصاد والمناجمنت'],

    'قانون': ['قانون'],

    // -- Arts / Sport --

    'ت.تشكيلية': ['ت.تشكيلية', 'فنون تشكيلية', 'التربية التشكيلية', 'رسم', 'فنون', 'التربية الفنية'],

    'موسيقى': ['موسيقى', 'التربية الموسيقية'],

    'رياضة': ['رياضة', 'تربية بدنية', 'التربية البدنية', 'Sport', 'EPS', 'E.P.S', 'ت.بدنية', 'إ.بدنية', 'Education Physique', 'Ed.Physique', 'Physique', 'ت البدنية و الرياضية', 'ت البدنية والرياضية', 'ت البدنية و الرياضية'],
    'تربية بدنية': ['رياضة', 'بدنية', 'التربية البدنية', 'Sport', 'EPS', 'E.P.S', 'ت.بدنية', 'إ.بدنية', 'Education Physique', 'Ed.Physique', 'Physique', 'ت البدنية و الرياضية', 'ت البدنية والرياضية', 'ت البدنية و الرياضية']

};

let subjects = [];

let exemptSubjects = {};



// Helper to get filtered subjects based on level exemption

function getFilteredSubjects(level, baseSubjects) {
    if (window.ExemptSubjectsHelper && typeof window.ExemptSubjectsHelper.filterSubjects === 'function') {
        return window.ExemptSubjectsHelper.filterSubjects(baseSubjects, {
            level,
            students: studentsData,
            exemptSubjects
        });
    }

    const exempt = exemptSubjects;

    let lvlKey = null;

    if (level.includes('1') || level.includes('أولى')) lvlKey = '1';

    if (level.includes('2') || level.includes('ثانية')) lvlKey = '2';

    if (level.includes('3') || level.includes('ثالثة')) lvlKey = '3';

    if (level.includes('4') || level.includes('رابعة')) lvlKey = '4';

    if (!lvlKey || !exempt[lvlKey]) return baseSubjects;

    const levelExemptions = exempt[lvlKey];

    const mapping = {

        'art': ['ت.تشكيلية', 'التربية التشكيلية', 'فنون تشكيلية', 'رسم'],

        'music': ['موسيقى', 'التربية الموسيقية'],

        'info': ['معلوماتية', 'اعلام الي', 'إعلام آلي'],

        'ama': ['أمازيغية', 'اللغة الأمازيغية', 'الأمازيغية', 'اللغة اﻷمازيغية', 'اﻷمازيغية']

    };

    return baseSubjects.filter(sub => {

        const normSub = normalizeArabic(sub);

        for (const [key, aliases] of Object.entries(mapping)) {

            if (levelExemptions.includes(key)) {

                if (aliases.some(alias => normSub.includes(normalizeArabic(alias)))) {

                    return false;

                }

            }

        }

        return true;

    });

}

document.addEventListener('DOMContentLoaded', async () => {
    // Show Loading Overlay to prevent UI freezing feedback
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = '<div style="background: var(--card-bg); padding: 20px 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 15px;">' +
        '<i class="fas fa-spinner fa-spin" style="font-size: 26px; color: #3b82f6;"></i>' +
        '<span style="font-weight: bold; font-family: Cairo, Tahoma, sans-serif; font-size: 16px; color: #1e293b;">جاري معالجة البيانات وتحليل النتائج...</span></div>';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(241, 245, 249, 0.85); backdrop-filter: blur(5px); z-index: 9999; display: flex; justify-content: center; align-items: center; transition: opacity 0.3s;';
    document.body.appendChild(overlay);

    // Yield to let the browser paint the overlay
    await new Promise(resolve => setTimeout(resolve, 50));

    await loadData();
    populateYears();

    document.getElementById('trimesterSelect').addEventListener('change', applyFilters);

    const yearSelect = document.getElementById('yearSelect');
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            populateYears(); // Refresh year list if needed, but usually just filter
            applyFilters();
        });
    }
    applyFilters();

    // Hide Overlay smoothly
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
});

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

function normalizeLevelCode(level) {
    const text = normalizeArabic(level || '').replace(/\s+/g, '');
    if (!text) return '';

    const digitMatch = text.match(/[1-4]/);
    if (digitMatch) return digitMatch[0];

    if (text.includes('اولي') || text.includes('اول')) return '1';
    if (text.includes('ثاني')) return '2';
    if (text.includes('ثالث')) return '3';
    if (text.includes('رابع')) return '4';

    return '';
}

function getLevelDisplayName(levelCode, stage, stream) {
    const middleNames = {
        '1': 'أولى',
        '2': 'ثانية',
        '3': 'ثالثة',
        '4': 'رابعة'
    };
    const secondaryNames = {
        '1': 'السنة الأولى',
        '2': 'السنة الثانية',
        '3': 'السنة الثالثة'
    };

    const baseName = stage === 'secondary'
        ? (secondaryNames[levelCode] || levelCode)
        : (middleNames[levelCode] || levelCode);

    if (stage !== 'secondary') return baseName;

    const streamName = (typeof SubjectManager !== 'undefined' && stream && stream !== 'بدون شعبة')
        ? SubjectManager.getStreamName(stream)
        : '';

    return streamName ? `${baseName} - ${streamName}` : baseName;
}

function getInstitutionLevelGroups(data, stage) {
    if (stage !== 'secondary') {
        return [
            { level: '1', name: getLevelDisplayName('1', stage) },
            { level: '2', name: getLevelDisplayName('2', stage) },
            { level: '3', name: getLevelDisplayName('3', stage) },
            { level: '4', name: getLevelDisplayName('4', stage) }
        ];
    }

    const uniqueGroups = new Map();
    data.forEach(student => {
        const level = normalizeLevelCode(student.level);
        if (!level) return;
        const stream = student.stream || 'بدون شعبة';
        const key = `${level}|${stream}`;
        if (!uniqueGroups.has(key)) {
            uniqueGroups.set(key, {
                level,
                stream,
                name: getLevelDisplayName(level, stage, stream)
            });
        }
    });

    return Array.from(uniqueGroups.values()).sort((a, b) => {
        const levelOrder = Number(a.level) - Number(b.level);
        if (levelOrder !== 0) return levelOrder;
        return (a.stream || '').localeCompare(b.stream || '');
    });
}

function getInstitutionGroupStudents(data, group, stage) {
    return data.filter(student => {
        if (normalizeLevelCode(student.level) !== group.level) return false;
        if (stage === 'secondary') {
            return (student.stream || 'بدون شعبة') === (group.stream || 'بدون شعبة');
        }
        return true;
    });
}

async function optimizeStudentData(data) {
    if (!data) return;
    const trimesters = ['1', '2', '3'];
    const patterns = {};

    // Support numeric '1' and textual 'اول', 'ثاني', 'ثالث'
    patterns['1'] = [
        new RegExp(`ف\\s*1(\\s|$)`), new RegExp(`فصل\\s*1(\\s|$)`),
        new RegExp(`اول(\\s|$)`), new RegExp(`أول(\\s|$)`), new RegExp(`1(\\s|$)`)
    ];
    patterns['2'] = [
        new RegExp(`ف\\s*2(\\s|$)`), new RegExp(`فصل\\s*2(\\s|$)`),
        new RegExp(`ثاني(\\s|$)`), new RegExp(`2(\\s|$)`)
    ];
    patterns['3'] = [
        new RegExp(`ف\\s*3(\\s|$)`), new RegExp(`فصل\\s*3(\\s|$)`),
        new RegExp(`ثالث(\\s|$)`), new RegExp(`3(\\s|$)`)
    ];

    for (let i = 0; i < data.length; i++) {
        // Yield to main thread every 200 items to keep UI responsive
        if (i > 0 && i % 200 === 0) await new Promise(r => setTimeout(r, 0));

        const student = data[i];
        if (!student.marks) continue;

        student._opt = { '1': {}, '2': {}, '3': {} };
        const fileTrimesterName = student.trimester;
        let fileTrimesterVal = '1';
        if (fileTrimesterName === 'الثاني') fileTrimesterVal = '2';
        else if (fileTrimesterName === 'الثالث') fileTrimesterVal = '3';

        const ObjectKeys = Object.keys(student.marks);
        for (let j = 0; j < ObjectKeys.length; j++) {
            const key = ObjectKeys[j];
            const normKey = normalizeArabic(key);
            let keyTrimester = fileTrimesterVal;
            for (const t of trimesters) {
                if (patterns[t].some(p => p.test(normKey))) {
                    keyTrimester = t;
                    break;
                }
            }
            if (!student._opt[keyTrimester]) student._opt[keyTrimester] = {};
            student._opt[keyTrimester][key] = student.marks[key];
        }
    }
}

function _orig_getSubjectScore(student, shortSubjectName) {
    if (student.marks && student._opt) {
        const trimesterSelect = document.getElementById('trimesterSelect');
        const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';
        const trimesterCache = student._opt[selectedTrimesterVal];

        if (trimesterCache) {
            const shortNorm = normalizeArabic(shortSubjectName);
            const aliasList = subjectAliases[shortSubjectName] || [];

            const exclusions = ['فيزيائية', 'تكنولوجيا', 'اسلامية', 'إسلامية', 'شرعية', 'انسانية', 'اجتماعية'];
            const isScience = (shortSubjectName === 'علوم' || shortSubjectName === 'علوم طبيعية');
            const isSport = (shortSubjectName === 'رياضة' || shortSubjectName === 'تربية بدنية');
            const isArt = (shortSubjectName === 'ت.تشكيلية' || shortSubjectName.includes('فني'));

            for (const key in trimesterCache) {
                const normKey = normalizeArabic(key);
                if (isScience && exclusions.some(ex => normKey.includes(normalizeArabic(ex)))) continue;
                if (isSport && ['فنية', 'تشكيلية', 'فنون', 'رسم'].some(ex => normKey.includes(normalizeArabic(ex)))) continue;
                if (isArt && ['رياضة', 'بدنية', 'رياضية'].some(ex => normKey.includes(normalizeArabic(ex)))) continue;

                if (normKey.includes(shortNorm) || shortNorm.includes(normKey)) return trimesterCache[key];
                if (aliasList.some(alias => {
                    const normAlias = normalizeArabic(alias);
                    return normKey.includes(normAlias) || normAlias.includes(normKey);
                })) return trimesterCache[key];
            }
            return null;
        }
    }

    if (!student.marks) return null;

    // Get currently selected trimester for context

    const trimesterSelect = document.getElementById('trimesterSelect');

    const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';

    // Get the file's native trimester

    const fileTrimesterName = student.trimester;

    let fileTrimesterVal = '1';

    if (fileTrimesterName === 'الثاني') fileTrimesterVal = '2';

    else if (fileTrimesterName === 'الثالث') fileTrimesterVal = '3';

    const aliasList = subjectAliases[shortSubjectName] || [];

    const keys = Object.keys(student.marks);

    const shortNorm = normalizeArabic(shortSubjectName);

    // Helper to check if a key matches the subject (direct or alias)

    const isMatch = (key) => {

        const normKey = normalizeArabic(key);

        // Direct fuzzy match

        if (normKey.includes(shortNorm) || shortNorm.includes(normKey)) return true;

        // Alias match

        return aliasList.some(alias => {

            const normAlias = normalizeArabic(alias);

            return normKey.includes(normAlias) || normAlias.includes(normKey);

        });

    };

    // 1. Priority: Explicit suffix match for SELECTED trimester

    const tPattern1 = new RegExp(`ف\\s*${selectedTrimesterVal}(\\s|$)`);

    const tPattern2 = new RegExp(`فصل\\s*${selectedTrimesterVal}(\\s|$)`);

    let bestMatchKey = keys.find(k => {

        const normKey = normalizeArabic(k);

        return isMatch(k) && (tPattern1.test(normKey) || tPattern2.test(normKey));

    });

    // 2. Fallback: Generic match (No suffix), ONLY if file context matches selected context

    if (!bestMatchKey && fileTrimesterVal === selectedTrimesterVal) {

        bestMatchKey = keys.find(k => {

            const normKey = normalizeArabic(k);

            if (!isMatch(k)) return false;

            // Ensure no OTHER trimester suffix

            const otherTrimesters = ['1', '2', '3'].filter(t => t !== selectedTrimesterVal);

            for (const t of otherTrimesters) {

                if (new RegExp(`ف\\s*${t}(\\s|$)`).test(normKey) || new RegExp(`فصل\\s*${t}(\\s|$)`).test(normKey)) {

                    return false;

                }

            }

            return true;

        });

    }

    // 3. Last Resort: Simple Direct Match (Safety)

    if (!bestMatchKey && fileTrimesterVal === selectedTrimesterVal) {

        if (student.marks[shortSubjectName] !== undefined) return student.marks[shortSubjectName];

        bestMatchKey = keys.find(k => isMatch(k));

    }

    return bestMatchKey ? student.marks[bestMatchKey] : null;

}

// Helper to get annual average for a specific subject

function getAnnualSubjectScore(student, shortSubjectName) {

    const scores = ['1', '2', '3'].map(t => {

        // Temporarily override trimester selection logic for getSubjectScore

        const originalVal = document.getElementById('trimesterSelect').value;

        const mockSelect = { value: t };

        // We'll use a modified logic inside or just call it if it's robust

        // Actually, let's make a version that takes the trimester as an argument

        return getSubjectScoreByTrimester(student, shortSubjectName, t);

    }).filter(s => s !== null);

    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

}

function _orig_getSubjectScoreByTrimester(student, shortSubjectName, trimesterVal) {

    if (!student.marks) return null;

    const fileTrimesterName = student.trimester;

    let fileTrimesterVal = '1';

    if (fileTrimesterName === 'الثاني') fileTrimesterVal = '2';

    else if (fileTrimesterName === 'الثالث') fileTrimesterVal = '3';

    const aliasList = subjectAliases[shortSubjectName] || [];

    const keys = Object.keys(student.marks);

    const shortNorm = normalizeArabic(shortSubjectName);

    const isMatch = (key) => {

        const normKey = normalizeArabic(key);

        if (normKey.includes(shortNorm) || shortNorm.includes(normKey)) return true;

        return aliasList.some(alias => {

            const normAlias = normalizeArabic(alias);

            return normKey.includes(normAlias) || normAlias.includes(normKey);

        });

    };

    const tPattern1 = new RegExp(`ف\\s*${trimesterVal}(\\s|$)`);

    const tPattern2 = new RegExp(`فصل\\s*${trimesterVal}(\\s|$)`);

    let bestMatchKey = keys.find(k => {

        const normKey = normalizeArabic(k);

        return isMatch(k) && (tPattern1.test(normKey) || tPattern2.test(normKey));

    });

    if (!bestMatchKey && fileTrimesterVal === trimesterVal) {

        bestMatchKey = keys.find(k => {

            const normKey = normalizeArabic(k);

            if (!isMatch(k)) return false;

            const otherTrimesters = ['1', '2', '3'].filter(t => t !== trimesterVal);

            for (const t of otherTrimesters) {

                if (new RegExp(`ف\\s*${t}(\\s|$)`).test(normKey) || new RegExp(`فصل\\s*${t}(\\s|$)`).test(normKey)) {

                    return false;

                }

            }

            return true;

        });

    }

    if (!bestMatchKey && fileTrimesterVal === trimesterVal) {

        if (student.marks[shortSubjectName] !== undefined) return student.marks[shortSubjectName];

        bestMatchKey = keys.find(k => isMatch(k));

    }

    return bestMatchKey ? student.marks[bestMatchKey] : null;

}

async function loadData() {
    const [rawResults, rawStudents] = await Promise.all([
        DB.getResults(true),
        DB.getStudents(true)
    ]);
    let rawStudentsData = rawResults || [];

    // --- Performance Caches ---
    const cleanStrCache = new Map();
    const cleanStr = (s) => {
        if (!s) return '';
        if (cleanStrCache.has(s)) return cleanStrCache.get(s);
        const res = normalizeArabic(s).replace(/\s+/g, '');
        cleanStrCache.set(s, res);
        return res;
    };

    const normSectionCache = new Map();
    const normSection = (s) => {
        if (!s) return "1";
        if (normSectionCache.has(s)) return normSectionCache.get(s);
        const res = s.toString().trim().replace(/^0+/, '') || "1";
        normSectionCache.set(s, res);
        return res;
    };

    // Create a lookup map for the student list (SGRS data)
    const studentInfoMap = new Map();
    if (rawStudents && rawStudents.length > 0) {
        rawStudents.forEach(s => {
            const key = `${cleanStr(getStudentYear(s))}|${cleanStr(s.name)}|${cleanStr(s.dob)}|${normSection(s.class)}|${cleanStr(s.level)}|${cleanStr(s.stream)}`;
            studentInfoMap.set(key, s);
        });
    }

    // Deduplicate and Merge Data (Handles multiple trimesters/files)
    const suffixCache = new Map();
    const checkSuffix = (sub) => {
        if (suffixCache.has(sub)) return suffixCache.get(sub);
        const normSub = normalizeArabic(sub);
        const hasSuffix = ['1', 'ف1', 'فصل 1', 'اول', 'أول', '2', 'ف2', 'فصل 2', 'ثاني', '3', 'ف3', 'فصل 3', 'ثالث'].some(str => normSub.includes(normalizeArabic(str)));
        suffixCache.set(sub, hasSuffix);
        return hasSuffix;
    };

    const studentMap = new Map();
    console.time('DataProcessing');
    for (let i = 0; i < rawStudentsData.length; i++) {
        if (i > 0 && i % 500 === 0) await new Promise(r => setTimeout(r, 0));
        const student = rawStudentsData[i];
        const normName = cleanStr(student.name);
        const normDob = cleanStr(student.dob);
        const normClass = normSection(student.class);
        const normLevel = cleanStr(student.level);
        const normStream = cleanStr(student.stream);
        const normAcademicYear = cleanStr(getStudentYear(student));
        const uniqueKey = `${normAcademicYear}|${normName}|${normDob}|${normClass}|${normLevel}|${normStream}`;

        const getTrimesterValue = (name) => {
            const n = normalizeArabic(name || '');
            if (n.includes('ثاني') || n.includes('2')) return '2';
            if (n.includes('ثالث') || n.includes('3')) return '3';
            return '1';
        };
        const tVal = getTrimesterValue(student.trimester);
        const suffix = ` ف${tVal}`;

        let targetStudent;
        if (studentMap.has(uniqueKey)) {
            targetStudent = studentMap.get(uniqueKey);
        } else {
            const sgrsInfo = studentInfoMap.get(uniqueKey);
            targetStudent = {
                ...student,
                ...(sgrsInfo || {}),
                marks: {},
                averages: {},
                class: normSection(student.class),
                name: (student.name || '').trim(),
                dob: (student.dob || '').trim(),
                level: (student.level || '').trim(),
                stream: (student.stream || '').trim()
            };
            if (sgrsInfo && !targetStudent.status) {
                targetStudent.status = sgrsInfo.status || sgrsInfo.boarding || sgrsInfo.regime;
            }
            studentMap.set(uniqueKey, targetStudent);
        }

        if (student.marks) {
            Object.entries(student.marks).forEach(([sub, score]) => {
                const hasSuffix = checkSuffix(sub);
                const finalKey = hasSuffix ? sub : `${sub}${suffix}`;
                targetStudent.marks[finalKey] = score;
            });
        }
        if (student.averages) {
            Object.entries(student.averages).forEach(([t, avg]) => {
                if (avg !== undefined && avg !== null) {
                    targetStudent.averages[t] = parseFloat(avg) || 0;
                }
            });
        }
        if (student.average !== undefined) {
            targetStudent.averages[tVal] = parseFloat(student.average) || 0;
        }
    }
    studentsData = Array.from(studentMap.values());
    console.timeEnd('DataProcessing');

    await optimizeStudentData(studentsData);
    institutionSettings = await DB.getSettings();
    exemptSubjects = await DB.get('exemptSubjects') || {};

    const allSubjects = new Set();
    const canonicalCache = new Map();
    const getCanonicalName = (rawName) => {
        if (canonicalCache.has(rawName)) return canonicalCache.get(rawName);
        const normRaw = normalizeArabic(rawName);
        for (const [canonical, aliases] of Object.entries(subjectAliases)) {
            if (normalizeArabic(canonical) === normRaw) {
                canonicalCache.set(rawName, canonical);
                return canonical;
            }
            if (aliases.some(alias => normRaw.includes(normalizeArabic(alias)) || normalizeArabic(alias).includes(normRaw))) {
                canonicalCache.set(rawName, canonical);
                return canonical;
            }
        }
        canonicalCache.set(rawName, rawName);
        return rawName;
    };

    for (let i = 0; i < studentsData.length; i++) {
        if (i > 0 && i % 200 === 0) await new Promise(r => setTimeout(r, 0));
        const s = studentsData[i];
        if (s.marks) {
            Object.keys(s.marks).forEach(k => {
                const cleanName = k.replace(/ ف\s?[123]$/, '').replace(/ فصل\s?[123]$/, '').trim();
                const canonical = getCanonicalName(cleanName);
                if (canonical) allSubjects.add(canonical);
            });
        }
    }

    const priority = [
        'عربية', 'أمازيغية', 'فرنسية', 'انجليزية',
        'اسلامية', 'مدنية', 'تاريخ', 'جغرافيا',
        'رياضيات', 'علوم', 'فيزياء', 'تكنولوجيا',
        'هندسة مدنية', 'هندسة ميكانيكية', 'هندسة طرائق', 'هندسة كهربائية',
        'تسيير واقتصاد', 'قانون',
        'فلسفة', 'اسبانية', 'المانية',
        'معلوماتية', 'ت.تشكيلية', 'موسيقى', 'رياضة'
    ];
    const normalizedPriority = priority.map(function (p) { return normalizeArabic(p); });

    subjects = [...allSubjects].sort((a, b) => {
        const normA = normalizeArabic(a);
        const normB = normalizeArabic(b);
        const isAvgA = normA.includes('معدل');
        const isAvgB = normB.includes('معدل');
        if (isAvgA && !isAvgB) return 1;
        if (!isAvgA && isAvgB) return -1;
        const idxA = normalizedPriority.indexOf(normA);
        const idxB = normalizedPriority.indexOf(normB);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    populateYears();
} 

function applyFilters() {
    const yearSelect = document.getElementById('yearSelect');
    const selectedYear = yearSelect ? yearSelect.value : '';
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('active');

    setTimeout(() => {
        const selectedTrimesterVal = document.getElementById('trimesterSelect').value;

        // Handle empty trimester selection
        if (!selectedTrimesterVal) {
            document.getElementById('generalStatsBody').innerHTML = '';
            document.getElementById('levelStatsBody').innerHTML = '';
            document.getElementById('appreciationStatsBody').innerHTML = '';
            document.getElementById('topStudentsBody1').innerHTML = '';
            document.getElementById('topStudentsBody2').innerHTML = '';
            document.getElementById('levelsBreakdown').innerHTML = '<div style="text-align:center; padding: 20px; font-size: 1.1em; color: #7f8c8d; grid-column: 1/-1;">الرجاء اختيار الفصل الدراسي لعرض النتائج</div>';

            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }
            if (overlay) overlay.classList.remove('active');
            return;
        }

        const selectedTrimesterName = trimesterMap[selectedTrimesterVal];

        // Filter subjects by trimester suffix if they have one
        const filteredSubjects = selectedTrimesterVal === 'annual' ? subjects : subjects.filter(sub => {
            const normSub = normalizeArabic(sub);
            const otherTrimesters = ['1', '2', '3'].filter(t => t !== selectedTrimesterVal);

            for (const t of otherTrimesters) {
                const pattern1 = new RegExp(`ف\\s*${t}(\\s|$)`);
                const pattern2 = new RegExp(`فصل\\s*${t}(\\s|$)`);

                if (pattern1.test(normSub) || pattern2.test(normSub)) {
                    return false;
                }
            }
            return true;
        });

        const filteredData = studentsData.filter(s => !selectedYear || getStudentYear(s) === selectedYear);
        renderInstitutionDashboard(filteredData, filteredSubjects);
        window.currentFilteredData = filteredData.filter(s => getStudentAverage(s) > 0);
        if (overlay) overlay.classList.remove('active');
    }, 50);
}

function showNotification(msg, type) {

    showToast(msg, type);

}

function showToast(message, type = 'success') {

    const container = document.getElementById('toastContainer');

    if (!container) return;

    const toast = document.createElement('div');

    toast.className = `toast ${type}`;

    const icon = type === 'error' ? '⚠️' : '✨';

    toast.innerHTML = `

        <span class="toast-icon">${icon}</span>

        <span class="toast-text">${message}</span>

    `;

    container.appendChild(toast);

    toast.offsetHeight;

    toast.classList.add('show');

    setTimeout(() => {

        toast.classList.remove('show');

        setTimeout(() => {

            toast.remove();

        }, 500);

    }, 4000);

}

function renderInstitutionDashboard(data, activeSubjects = subjects) {

    if (!data || data.length === 0) {

        document.getElementById('generalStatsBody').innerHTML = '<tr><td colspan="5">لا توجد بيانات</td></tr>';

        return;

    }

    renderGeneralStats(data);

    renderChart(data);

    renderLevelStats(data);

    renderAppreciationStats(data);

    renderTopStudents(data);

    renderSubjectMatrix(data, activeSubjects);

}

// 1. General Stats (Whole School)

function renderGeneralStats(data) {

    const tbody = document.getElementById('generalStatsBody');

    const males = data.filter(s => s.gender === 'ذكر');

    const females = data.filter(s => s.gender === 'أنثى');

    const stats = [

        { label: 'الكل', data: data },

        { label: 'ذكور', data: males },

        { label: 'إناث', data: females }

    ];

    let html = '';

    stats.forEach(row => {

        const count = row.data.length;

        const avg = (s) => getStudentAverage(s);

        const passed = row.data.filter(s => avg(s) >= 10).length;

        const failed = count - passed;

        const rate = count > 0 ? ((passed / count) * 100).toFixed(2) : 0;

        let colorClass = '';

        if (row.label === 'ذكور') colorClass = 'style="color: #2980b9"'; // Blue

        if (row.label === 'إناث') colorClass = 'style="color: #c0392b"'; // Red/Pink

        html += `

            <tr style="font-weight:bold;">

                <td ${colorClass}>${row.label}</td>

                <td>${count}</td>

                <td>${passed}</td>

                <td>${failed}</td>

                <td dir="ltr" style="font-family: sans-serif;">${rate}%</td>

            </tr>

        `;

    });

    tbody.innerHTML = html;

}

// 2. Chart (Whole School: Pass vs Fail)

let chartInstance = null;

function renderChart(data) {

    const ctx = document.getElementById('institutionChart').getContext('2d');

    const males = data.filter(s => s.gender === 'ذكر');

    const females = data.filter(s => s.gender === 'أنثى');

    const avg = (s) => getStudentAverage(s);

    const passedChange = (arr) => arr.filter(s => avg(s) >= 10).length;

    const failedChange = (arr) => arr.length - passedChange(arr);

    const labels = ['الكل', 'ذكور', 'إناث'];

    const passedData = [passedChange(data), passedChange(males), passedChange(females)];

    const failedData = [failedChange(data), failedChange(males), failedChange(females)];

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {

        type: 'bar',

        data: {

            labels: labels,

            datasets: [

                {

                    label: 'ناجحون',

                    data: passedData,

                    backgroundColor: '#f1c40f' // Yellow

                },

                {

                    label: 'راسبون',

                    data: failedData,

                    backgroundColor: 'var(--primary-color)' // Blue/Dark

                }

            ]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            scales: {

                y: { beginAtZero: true },

                x: {

                    ticks: {

                        color: 'black',

                        font: { family: 'Tajawal', weight: 'bold', size: 12 }

                    }

                }

            },

            plugins: {

                legend: { position: 'top' },

                title: { display: true, text: 'نتائج المؤسسة حسب الجنس', font: { family: 'Tajawal', size: 16 } }

            }

        }

    });

}

// 3. Level Stats (New Request)

function renderLevelStats(data) {
    const tbody = document.getElementById('levelStatsBody');
    const stage = institutionSettings.educationStage || 'middle';

    let groups = [];
    if (stage === 'secondary') {
        const uniqueGroups = new Set();
        data.forEach(s => {
            if (s.level) {
                const stream = s.stream || 'بدون شعبة';
                uniqueGroups.add(JSON.stringify({ level: s.level.toString(), stream: stream }));
            }
        });
        groups = Array.from(uniqueGroups).map(g => JSON.parse(g)).sort((a, b) => {
            return a.level.localeCompare(b.level) || a.stream.localeCompare(b.stream);
        });
    } else {
        groups = [
            { level: '1', name: 'أولى' },
            { level: '2', name: 'ثانية' },
            { level: '3', name: 'ثالثة' },
            { level: '4', name: 'رابعة' }
        ];
    }

    let html = '';

    groups.forEach((group) => {
        let groupName = '';
        let levelData = [];

        if (stage === 'secondary') {
            const streamName = (typeof SubjectManager !== 'undefined' && group.stream !== 'بدون شعبة') ? SubjectManager.getStreamName(group.stream) : '';
            const paddedStream = streamName ? ` - ${streamName}` : '';
            if (group.level.includes('1') || group.level.includes('أولى')) groupName = `السنة الأولى${paddedStream}`;
            else if (group.level.includes('2') || group.level.includes('ثانية')) groupName = `السنة الثانية${paddedStream}`;
            else if (group.level.includes('3') || group.level.includes('ثالثة')) groupName = `السنة الثالثة${paddedStream}`;
            else groupName = `${group.level}${paddedStream}`;

            levelData = data.filter(s => {
                if (!s.level) return false;
                const l = s.level.toString();
                const st = s.stream || 'بدون شعبة';
                return l === group.level && st === group.stream;
            });
                } else {
            groupName = group.name;
            levelData = data.filter(s => {
                if (!s.level) return false;
                return normalizeLevelCode(s.level) === group.level;
            });
        }

        if (levelData.length === 0) return;

        const count = levelData.length;
        const passed = levelData.filter(s => getStudentAverage(s) >= 10).length;
        const failed = count - passed;
        const successRate = count > 0 ? ((passed / count) * 100).toFixed(2) : '0.00';
        const failRate = count > 0 ? ((failed / count) * 100).toFixed(2) : '0.00';

        html += `
            <tr>
                <td style="font-weight:bold;">${groupName}</td>
                <td>${count}</td>
                <td>${passed}</td>
                <td>${failed}</td>
                <td style="color: #27ae60; direction:ltr;">${successRate}%</td>
                <td style="color: #c0392b; direction:ltr;">${failRate}%</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// 4. Appreciation Stats (New Request)

function renderAppreciationStats(data) {
    const tbody = document.getElementById('appreciationStatsBody');
    const stage = institutionSettings.educationStage || 'middle';

    let groups = [];
    if (stage === 'secondary') {
        const uniqueGroups = new Set();
        data.forEach(s => {
            if (s.level) {
                const stream = s.stream || 'بدون شعبة';
                uniqueGroups.add(JSON.stringify({ level: s.level.toString(), stream: stream }));
            }
        });
        groups = Array.from(uniqueGroups).map(g => JSON.parse(g)).sort((a, b) => {
            return a.level.localeCompare(b.level) || a.stream.localeCompare(b.stream);
        });
    } else {
        groups = [
            { level: '1', name: 'أولى' },
            { level: '2', name: 'ثانية' },
            { level: '3', name: 'ثالثة' },
            { level: '4', name: 'رابعة' }
        ];
    }

    let html = '';

    groups.forEach((group) => {
        let groupName = '';
        let levelData = [];

        if (stage === 'secondary') {
            const streamName = (typeof SubjectManager !== 'undefined' && group.stream !== 'بدون شعبة') ? SubjectManager.getStreamName(group.stream) : '';
            const paddedStream = streamName ? ` - ${streamName}` : '';
            if (group.level.includes('1') || group.level.includes('أولى')) groupName = `السنة الأولى${paddedStream}`;
            else if (group.level.includes('2') || group.level.includes('ثانية')) groupName = `السنة الثانية${paddedStream}`;
            else if (group.level.includes('3') || group.level.includes('ثالثة')) groupName = `السنة الثالثة${paddedStream}`;
            else groupName = `${group.level}${paddedStream}`;

            levelData = data.filter(s => {
                const l = s.level ? s.level.toString() : '';
                const st = s.stream || 'بدون شعبة';
                return l === group.level && st === group.stream;
            });
                } else {
            groupName = group.name;
            levelData = data.filter(s => {
                if (!s.level) return false;
                return normalizeLevelCode(s.level) === group.level;
            });
        }

        if (levelData.length === 0) return;

        const excellenceThreshold = parseFloat(institutionSettings.evalExcellence) || 18;
        const congratulationThreshold = parseFloat(institutionSettings.evalCongratulation) || 16;
        const encouragementThreshold = parseFloat(institutionSettings.evalEncouragement) || 14;
        const honorThreshold = parseFloat(institutionSettings.evalHonor) || 12;

        let excellence = 0;
        let congrats = 0;
        let encouragement = 0;
        let honor = 0;

        levelData.forEach(s => {
            const avg = getStudentAverage(s);
            if (avg >= excellenceThreshold) excellence++;
            else if (avg >= congratulationThreshold) congrats++;
            else if (avg >= encouragementThreshold) encouragement++;
            else if (avg >= honorThreshold) honor++;
        });

        html += `
            <tr>
                <td style="font-weight:bold;">${groupName}</td>
                <td style="font-weight:bold;">${excellence}</td>
                <td style="font-weight:bold;">${congrats}</td>
                <td style="font-weight:bold;">${encouragement}</td>
                <td style="font-weight:bold;">${honor}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function renderTopStudents(data) {
    const tbody1 = document.getElementById('topStudentsBody1');
    const tbody2 = document.getElementById('topStudentsBody2');

    const top = [...data].sort((a, b) => getStudentAverage(b) - getStudentAverage(a)).slice(0, 20);

    const stage = institutionSettings.educationStage || 'middle';
    const tableHeadRows = document.querySelectorAll('.top-students-container thead tr');

    tableHeadRows.forEach(tableHeadRow => {
        if (!tableHeadRow) return;
        if (stage === 'secondary') {
            const headers = Array.from(tableHeadRow.children);
            const hasStream = headers.some(th => th.textContent.includes('الشعبة'));

            if (!hasStream) {
                const streamTh = document.createElement('th');
                streamTh.textContent = 'الشعبة';
                streamTh.style.width = '1%';
                streamTh.style.whiteSpace = 'nowrap';
                streamTh.style.fontSize = '0.8rem';
                const classTh = headers[3];
                if (classTh) tableHeadRow.insertBefore(streamTh, classTh);
                else tableHeadRow.appendChild(streamTh);
            }
        } else {
            const headers = Array.from(tableHeadRow.children);
            const streamTh = headers.find(th => th.textContent.includes('الشعبة'));
            if (streamTh) streamTh.remove();
        }
    });

    let html1 = '';
    let html2 = '';

    top.forEach((s, index) => {
        let streamHtml = '';
        if (stage === 'secondary') {
            const streamName = (typeof SubjectManager !== 'undefined' && s.stream) ? SubjectManager.getStreamName(s.stream) : (s.stream || '-');
            streamHtml = `<td style="font-size: 0.8rem; white-space: nowrap;">${streamName}</td>`;
        }

        const rowHtml = `
            <tr>
                <td>${index + 1}</td>
                <td style="white-space: nowrap;">${s.name}</td>
                <td>${s.level}</td>
                ${streamHtml}
                <td>${s.class || '-'}</td>
                <td style="font-weight:bold;">${getStudentAverage(s).toFixed(2)}</td>
            </tr>
        `;
        if (index < 10) {
            html1 += rowHtml;
        } else {
            html2 += rowHtml;
        }
    });

    if (tbody1) tbody1.innerHTML = html1;
    if (tbody2) tbody2.innerHTML = html2;
}

function renderSubjectMatrix(data, activeSubjects) {
    const container = document.getElementById('levelsBreakdown');
    if (!container) return;

    container.innerHTML = '';

    const stage = institutionSettings.educationStage || 'middle';

    let groups = [];
    if (stage === 'secondary') {
        const uniqueGroups = new Set();
        data.forEach(s => {
            if (s.level) {
                const stream = s.stream || 'بدون شعبة';
                uniqueGroups.add(JSON.stringify({ level: s.level.toString(), stream: stream }));
            }
        });
        groups = Array.from(uniqueGroups).map(g => JSON.parse(g)).sort((a, b) => {
            return a.level.localeCompare(b.level) || a.stream.localeCompare(b.stream);
        });
    } else {
        groups = [
            { level: '1', name: 'الأولى متوسط' },
            { level: '2', name: 'الثانية متوسط' },
            { level: '3', name: 'الثالثة متوسط' },
            { level: '4', name: 'الرابعة متوسط' }
        ];
    }

    groups.forEach((group) => {
        let groupName = '';
        let levelData = [];
        let levelNameForSubjects = '';

        if (stage === 'secondary') {
            const streamName = (typeof SubjectManager !== 'undefined' && group.stream !== 'بدون شعبة') ? SubjectManager.getStreamName(group.stream) : '';
            const paddedStream = streamName ? ` - ${streamName}` : '';
            if (group.level.includes('1') || group.level.includes('أولى')) groupName = `السنة الأولى${paddedStream}`;
            else if (group.level.includes('2') || group.level.includes('ثانية')) groupName = `السنة الثانية${paddedStream}`;
            else if (group.level.includes('3') || group.level.includes('ثالثة')) groupName = `السنة الثالثة${paddedStream}`;
            else groupName = `${group.level}${paddedStream}`;

            levelNameForSubjects = group.level;

            levelData = data.filter(s => {
                const l = s.level ? s.level.toString() : '';
                const st = s.stream || 'بدون شعبة';
                return l === group.level && st === group.stream;
            });
        } else {
            groupName = group.name;
            levelNameForSubjects = group.name;
            levelData = data.filter(s => {
                if (!s.level) return false;
                return normalizeLevelCode(s.level) === group.level;
            });
        }

        if (levelData.length === 0) return;

        const count = levelData.length;
        const passed = levelData.filter(s => getStudentAverage(s) >= 10).length;
        const failed = count - passed;
        const rate = count > 0 ? ((passed / count) * 100).toFixed(2) : 0;

        // Subjects Table for this level
        const levelSubjects = getFilteredSubjects(levelNameForSubjects, activeSubjects);
        const subjectsWithData = levelSubjects.filter(sub => levelData.some(s => getSubjectScore(s, sub) !== null));

        if (subjectsWithData.length === 0) return;

        let subjectHeaders = '';
        let subjectAvgs = '';
        let subjectRates = '';

        subjectsWithData.forEach(sub => {
            subjectHeaders += `<th style="font-size:11px; padding:5px 2px;">${sub}</th>`;
            const scores = levelData.map(s => getSubjectScore(s, sub)).filter(m => m !== null);
            const subAvg = scores.length > 0 ? (scores.reduce((a, b) => a + Number(b), 0) / scores.length).toFixed(2) : '-';
            const subPassCount = scores.filter(s => s >= 10).length;
            const subRate = scores.length > 0 ? ((subPassCount / scores.length) * 100).toFixed(0) : 0;

            subjectAvgs += `<td style="background:#eaf2f8;">${subAvg}</td>`;
            subjectRates += `<td style="font-weight:bold; color:${subRate >= 50 ? '#27ae60' : '#e74c3c'};">${subRate}%</td>`;
        });

        const card = document.createElement('div');
        card.className = 'card level-card';
        card.style.marginBottom = '25px';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:12px;">
                <h4 style="margin:0; color:var(--primary-color);"><span data-icon="layer-group"></span> المستوى: ${groupName}</h4>
                <div style="font-size: 0.9rem; color:#7f8c8d;">
                    التعداد: <span style="color:var(--primary-color); font-weight:bold;">${count}</span> |
                    ناجح: <span style="color:#27ae60; font-weight:bold;">${passed}</span> |
                    راسب: <span style="color:#e74c3c; font-weight:bold;">${failed}</span> |
                    النسبة: <span style="color:var(--secondary-color); font-weight:bold;">${rate}%</span>
                </div>
            </div>
            <div style="overflow-x:auto;">
                <table class="data-table" style="font-size: 0.85rem;">
                    <thead>
                        <tr style="background:var(--bg-color);">
                            <th style="width:60px;">البيان</th>
                            ${subjectHeaders}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="font-weight:bold; background:#f2f4f4;">المعدل</td>
                            ${subjectAvgs}
                        </tr>
                        <tr>
                            <td style="font-weight:bold; background:#f2f4f4;">النسبة</td>
                            ${subjectRates}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        container.appendChild(card);
    });
}

function blockTrialPrint() {
    if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {
        const message = (typeof Auth.getBlockedMessage === 'function')
            ? Auth.getBlockedMessage('print')
            : 'الطباعة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.';
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: message });
        return true;
    }
    return false;
}

async function printInstitutionReport() {
    if (blockTrialPrint()) return;

    const printWindow = window.open('', '_blank');

    // Chart

    const chartCanvas = document.getElementById('institutionChart');

    let chartImgHtml = '';

    if (chartCanvas) {

        // Keeping generation logic just in case, but won't use it in page1Html

        const tempCanvas = document.createElement('canvas');

        tempCanvas.width = chartCanvas.width;

        tempCanvas.height = chartCanvas.height;

        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.fillStyle = 'var(--card-bg)';

        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        tempCtx.drawImage(chartCanvas, 0, 0);

        const chartImage = tempCanvas.toDataURL('image/png');

        chartImgHtml = `<div class="chart-container" style="width: 80%; margin: 20px auto; text-align: center;">

                            <img src="${chartImage}" style="max-width: 100%; height: auto;">

                        </div>`;

    }

    // Sections

    const generalStatsTable = (document.querySelector('#generalStatsBody') && document.querySelector('#generalStatsBody').closest('table')) ? document.querySelector('#generalStatsBody').closest('table').outerHTML : '';

    const levelStatsTable = document.querySelector('#levelStatsCard table') ? document.querySelector('#levelStatsCard table').outerHTML : '';

    const appreciationStatsTable = document.querySelector('#appreciationStatsCard table') ? document.querySelector('#appreciationStatsCard table').outerHTML : '';

    let topStudentsTable = '';
    const tsContainer = document.querySelector('.top-students-container');
    if (tsContainer) {
        topStudentsTable = tsContainer.innerHTML;
    }

    // Matrix Table

    const matrixTable = document.getElementById('levelsBreakdown') ? document.getElementById('levelsBreakdown').innerHTML : '';

    // ... (Settings remain the same) ...

    const settings = await DB.getSettings() || {};

    const selectedTrimesterVal = document.getElementById('trimesterSelect').value;

    

    const selectedTrimesterName = trimesterMap[selectedTrimesterVal] || selectedTrimesterVal;

    const schoolYear = settings.schoolYear || '2025/2024';

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    const headerHtml = `

        <div class="report-header" style="flex-direction: column; align-items: center; margin-bottom: 10px;">

            <div style="text-align: center; margin-bottom: 5px;">

                <h3 style="margin: 1px 0; font-size: 10pt;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                <h3 style="margin: 1px 0; font-size: 10pt;">وزارة التربية الوطنية</h3>

            </div>

            <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px; font-size: 9pt;">

                <div style="text-align: right;">

                    <div>مديرية التربية لولاية ${settings.wilaya || '.......'}</div>

                    <div>المؤسسة: ${settings.institutionName || '.......'}</div>

                </div>

                <div style="text-align: left;">

                    <div>البلدية: ${settings.municipality || '.......'}</div>

                    <div>السنة الدراسية: ${settings.schoolYear || '2025/2026'}</div>

                </div>

            </div>

            <div style="text-align: center; margin-top: 5px; width: 100%;">

                <h2 style="margin: 3px 0; border: 2px solid #000; padding: 3px 10px; display: inline-block; border-radius: 5px; font-size: 12pt;">

                    تحليل نتائج الفصل ${selectedTrimesterName} (المؤسسة)

                </h2>

            </div>

        </div>

        <div style="border-bottom: 1px solid #000; margin-bottom: 10px;"></div>

    `;

    // Get signer info from signature settings

    const sigSettings = await DB.get('signatureSettings') || {};

    const reportConfig = sigSettings.reportSettings?.['institution_analysis'] || { signer: 'director', showSignature: true };

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    // Determine title based on signer type and gender

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }

    const signerName = signerData.fullName || settings.managerName || '................';

    const footerHtml = `
        <div class="report-footer" style="justify-content: flex-end;">
            <div class="footer-left">
                <div style="margin-bottom: 8px; font-weight: normal;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                <div style="font-weight: normal; font-size: 14pt;">${signerTitle}</div>
            </div>
        </div>
    `;

    // Page 1: General Stats + Level Stats + Appreciation Stats + Top Students

    const page1Html = `

        <div class="print-page">

            ${headerHtml}

            <div class="section-title">التعداد العام للمؤسسة</div>

            ${generalStatsTable}

            <div style="display:flex; gap:10px; margin-top:5px;">

                <div style="flex:1;">

                     <div class="section-title" style="font-size:11pt; margin-top:5px; margin-bottom:5px;">التعداد حسب المستويات</div>

                     ${levelStatsTable}

                </div>

                <div style="flex:1;">

                     <div class="section-title" style="font-size:11pt; margin-top:5px; margin-bottom:5px;">تعداد التلاميذ حسب الايجازات</div>

                     ${appreciationStatsTable}

                </div>

            </div>

            ${chartImgHtml}
            <div class="section-title" style="font-size:11pt; margin-top:10px; margin-bottom:5px;">قائمة النجباء</div>

            <div class="top-students-compact">

                ${topStudentsTable}

            </div>

             <!-- Chart Removed as per request -->

        </div>

    `;

    // Page 2: Matrix

    const page2Html = `

        <div class="print-page page-break">

            <div class="section-title" style="margin-top:20px;">نتائج المواد حسب المستوى</div>

            <div class="matrix-container" style="font-size: 8.5pt;">

                ${matrixTable}

            </div>

            ${footerHtml}

        </div>

    `;

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>تحليل المؤسسة - طباعة</title>

            <!-- No external stylesheet to avoid conflicts -->

            <style>

                @page { size: A4; margin: 0.8cm; }

                * { margin: 0; padding: 0; box-sizing: border-box; }

                body { font-family: 'Tajawal', sans-serif; background: 'var(--card-bg)'; -webkit-print-color-adjust: exact; margin: 0; }

                .print-page { width: 100%; display: block; }

                .page-break { page-break-before: always; }

                .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; font-size: 11pt; font-weight: bold; }

                .report-footer { margin-top: 30px; display: flex; justify-content: space-between; font-weight: bold; page-break-inside: avoid; }

                table { width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 9pt; }

                th, td { border: 1pt solid black; padding: 4px; text-align: center; }

                th { background-color: #f0f0f0 !important; color: #000 !important; font-weight: bold; }

                .section-title { font-size: 12pt; font-weight: bold; margin-bottom: 5px; border-right: 5px solid #000; padding-right: 10px; }

                /* Compact Top Students */

                .top-students-compact table { font-size: 8.5pt; }

                .top-students-compact td, .top-students-compact th { padding: 2px 4px !important; height: auto !important; }

                /* Matrix Specific */

                .matrix-container table { font-size: 8.5pt; }

                .matrix-container th, .matrix-container td { padding: 2px; }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

            ${page1Html}

            ${page2Html}

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

    printWindow.onload = function () {

        printWindow.focus();

        // printWindow.print(); /* Replaced by global Toolbar */ /* Replaced by global Toolbar */

    };

}

// Helper for dynamic average based on selected trimester

function getStudentAverage(student) {

    const trimesterSelect = document.getElementById('trimesterSelect');

    const val = trimesterSelect ? trimesterSelect.value : '1';

    // Try to get explicit average for the trimester

    if (val === 'annual') {

        const t1 = student.averages && student.averages['1'] ? parseFloat(student.averages['1']) : (student.trimester === 'الأول' ? parseFloat(student.average) : null);

        const t2 = student.averages && student.averages['2'] ? parseFloat(student.averages['2']) : (student.trimester === 'الثاني' ? parseFloat(student.average) : null);

        const t3 = student.averages && student.averages['3'] ? parseFloat(student.averages['3']) : (student.trimester === 'الثالث' ? parseFloat(student.average) : null);

        const available = [t1, t2, t3].filter(a => a !== null);

        return available.length > 0 ? available.reduce((a, b) => a + b, 0) / available.length : 0;

    }

    if (student.averages && student.averages[val]) {

        return parseFloat(student.averages[val]);

    }

    // Fallback: if we are in the "native" trimester of the file, use s.average

    

    if (student.trimester === trimesterMap[val]) {

        return parseFloat(student.average) || 0;

    }

    return 0; // No data for this trimester

}

function toggleBoardingLabel() {
    const cb = document.getElementById('printSortByBoarding');
    const opt = document.getElementById('printShowBoardingLabelOption');
    if (opt) opt.style.display = (cb && cb.checked) ? 'block' : 'none';
}

function openPrintAllModal() {
    if (blockTrialPrint()) return;
    const data = window.currentFilteredData;
    if (!data || data.length === 0) {
        if (typeof showToast === 'function') showToast('لا توجد بيانات للطباعة. يرجى اختيار فصل دراسي أولاً.', 'error');
        return;
    }
    const selectedTrimester = document.getElementById('trimesterSelect').value;
    const dualAvgOption = document.getElementById('dualAvgOption');
    const appreciationModeContainer = document.getElementById('appreciationModeContainer');
    const showDualAvgCheckbox = document.getElementById('showDualAvgCheckbox');

    if (dualAvgOption) dualAvgOption.style.display = selectedTrimester === '2' ? 'block' : 'none';
    if (appreciationModeContainer) appreciationModeContainer.style.display = 'none';
    if (showDualAvgCheckbox) showDualAvgCheckbox.checked = false;

    const modal = document.getElementById('printAllModal');
    if (modal) modal.style.display = 'flex';
}

function closePrintAllModal() {
    const modal = document.getElementById('printAllModal');
    if (modal) modal.style.display = 'none';
}

async function executePrintAll() {
    if (blockTrialPrint()) return;
    closePrintAllModal();
    const data = window.currentFilteredData || [];
    const stage = institutionSettings.educationStage || 'middle';
    const settings = await DB.getSettings() || {};

    // Read print options
    const groupMode       = document.querySelector('input[name="printGroupMode"]:checked')?.value || 'level_class';
    const avgOrder        = document.querySelector('input[name="printAvgOrder"]:checked')?.value || 'desc';
    const sortByGender    = document.getElementById('printSortByGender')?.checked || false;
    const printPassedOnly = document.getElementById('printPassedOnly')?.checked || false;
    const passedThreshold = parseFloat(document.getElementById('printPassedThreshold')?.value) || 10;
    const selectedTrimesterVal = document.getElementById('trimesterSelect').value;

    const showDualAvg = selectedTrimesterVal === '2' && document.getElementById('showDualAvgCheckbox')?.checked;
    const appraisalMode = document.querySelector('input[name="appraisalCalcMode"]:checked')?.value || 's2';

    const selectedTrimesterName = trimesterMap[selectedTrimesterVal] || selectedTrimesterVal;
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // Helpers
    const genderRank = (s) => {
        const g = (s.gender || '').toString();
        return (g === 'أنثى' || g === 'female' || g === 'إناث') ? 1 : 0;
    };
    const getTrimAvgValue = (s, trimester) => {
        if (!s) return NaN;
        if (s.averages && s.averages[trimester] !== undefined) {
            return parseFloat(s.averages[trimester]);
        }
        if (s.trimester === trimesterMap[trimester]) {
            return parseFloat(s.average || 0);
        }
        return NaN;
    };
    const getDualAverageValue = (s) => {
        const t1 = getTrimAvgValue(s, '1');
        const t2 = getTrimAvgValue(s, '2');
        if (!isNaN(t1) && !isNaN(t2)) return (t1 + t2) / 2;
        if (!isNaN(t1)) return t1;
        if (!isNaN(t2)) return t2;
        return 0;
    };
    const hasDualAverageData = (s) => !isNaN(getTrimAvgValue(s, '1')) || !isNaN(getTrimAvgValue(s, '2'));
    const getAvg = (s) => {
        if (!s) return 0;
        if (showDualAvg && selectedTrimesterVal === '2') {
            return getDualAverageValue(s);
        }
        if (s.averages) {
            if (selectedTrimesterVal === 'annual') {
                const vals = ['1','2','3'].map(t => parseFloat(s.averages[t])).filter(v => !isNaN(v));
                return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
            }
            const v = s.averages[selectedTrimesterVal];
            if (v !== undefined) return parseFloat(v) || 0;
        }
        return parseFloat(s.average || 0);
    };

    const getAppreciation = (avg) => {
        if (!avg || avg < 12) return "";
        const excellenceThreshold = parseFloat(institutionSettings.evalExcellence) || 18;
        const congratulationThreshold = parseFloat(institutionSettings.evalCongratulation) || 16;
        const encouragementThreshold = parseFloat(institutionSettings.evalEncouragement) || 14;
        const honorThreshold = parseFloat(institutionSettings.evalHonor) || 12;

        if (avg >= excellenceThreshold) return "امتياز";
        if (avg >= congratulationThreshold) return "تهنئة";
        if (avg >= encouragementThreshold) return "تشجيع";
        if (avg >= honorThreshold) return "لوحة شرف";
        return "";
    };

    const groupKey = (s) => {
        if (groupMode === 'school') return 'school';
        const lvl = String(s.level || '').trim();
        const cls = String(s.class || '').trim();
        const str = String(s.stream || '').trim();
        if (groupMode === 'level') return lvl;
        if (groupMode === 'level_stream_class') return `${lvl}||${str}||${cls}`;
        return `${lvl}||${cls}`;
    };

    // Sort data
    const sortedData = [...data].filter(s => !printPassedOnly || getAvg(s) >= passedThreshold).sort((a, b) => {
        const ka = groupKey(a), kb = groupKey(b);
        if (ka !== kb && groupMode !== 'school') return ka.localeCompare(kb, 'ar');
        if (sortByGender)   { const r = genderRank(a)   - genderRank(b);   if (r !== 0) return r; }

        const diff = getAvg(a) - getAvg(b);
        return avgOrder === 'desc' ? -diff : diff;
    });

    // Extra table headers
    let extraHeaders = '';
    if (selectedTrimesterVal === '1') {
        extraHeaders = `<th>م. الفصل 1</th>`;
    } else if (selectedTrimesterVal === '2') {
        extraHeaders = `<th>م. الفصل 1</th><th>م. الفصل 2</th>`;
        if (showDualAvg) extraHeaders += `<th style="background-color: #d5f5e3 !important;">معدل الفصلين</th>`;
    } else if (selectedTrimesterVal === '3') {
        extraHeaders = `<th>م. الفصل 1</th><th>م. الفصل 2</th><th>م. الفصل 3</th>`;
    } else if (selectedTrimesterVal === 'annual') {
        extraHeaders = `<th>م. الفصل 1</th><th>م. الفصل 2</th><th>م. الفصل 3</th><th>المعدل السنوي</th>`;
    }
    const boardingHeader = '';

    const getTrimAvg = (s, t) => {
        const value = getTrimAvgValue(s, t);
        if (!isNaN(value)) return value.toFixed(2);
        return '-';
    };
    const colorStyle = (v) => {
        const n = parseFloat(v);
        if (isNaN(n)) return 'color:#7f8c8d;';
        return n >= 10 ? 'color:#27ae60; font-weight:bold;' : 'color:#c0392b; font-weight:bold;';
    };

    // Group label
    const lvlNames = {'1':'أولى','2':'ثانية','3':'ثالثة','4':'رابعة'};
    const getGroupLabel = (s) => {
        if (groupMode === 'school') return 'نتائج المؤسسة (عام)';
        const lvl = lvlNames[String(s.level).trim()] || s.level || '-';
        if (groupMode === 'level') return `المستوى: ${lvl}`;
        if (groupMode === 'level_stream_class') {
            const str = (typeof SubjectManager !== 'undefined') ? (SubjectManager.getStreamName(s.stream) || s.stream || '-') : (s.stream || '-');
            return `المستوى: ${lvl} &nbsp;|&nbsp; الشعبة: ${str} &nbsp;|&nbsp; القسم: ${s.class || '-'}`;
        }
        return `المستوى: ${lvl} &nbsp;|&nbsp; القسم: ${s.class || '-'}`;
    };

    // Row generation with group separators
    const avgColCount = selectedTrimesterVal === '1' ? 1 : selectedTrimesterVal === '2' ? (showDualAvg ? 3 : 2) : selectedTrimesterVal === 'annual' ? 4 : 3;
    const totalCols = 3 + 2 + (stage === 'secondary' ? 2 : 1) + avgColCount + 1; // +1 for Estimates

    let lastKey = null;
    let pageChunksHtml = '';
    let currentTbody = '';
    let pageRowCount = 0;
    let pageNum = 1;
    const ROWS_PER_PAGE = 31; // Reduced slightly for header space

    const flushPage = () => {
        if (currentTbody) {
            pageChunksHtml += `<tbody class="page-chunk" data-page="${pageNum}">${currentTbody}</tbody>`;
            currentTbody = ''; pageNum++; pageRowCount = 0;
        }
    };

    sortedData.forEach((s, index) => {
        const key = groupKey(s);
        if (key !== lastKey) {
            if (pageRowCount > 0 && pageRowCount + 2 > ROWS_PER_PAGE) flushPage();
            currentTbody += `<tr class="group-header"><td colspan="${totalCols}" style="text-align:right; font-weight:bold; font-size:10pt; padding:6px 10px; background:#e8eaf6;">${getGroupLabel(s)}</td></tr>`;
            lastKey = key; pageRowCount++;
        }

        let groupCol = stage === 'secondary'
            ? `<td style="font-size:8pt;">${(typeof SubjectManager!=='undefined' ? SubjectManager.getStreamName(s.stream) : '') || s.stream || '-'}</td><td>${s.class||'-'}</td>`
            : `<td>${s.class||'-'}</td>`;

        const curAvg = getAvg(s);
        const a1 = getTrimAvg(s,'1'), a2 = getTrimAvg(s,'2'), a3 = getTrimAvg(s,'3');
        const annual = parseFloat(curAvg).toFixed(2);

        // Calculate appreciation based on mode
        let avgForAppraisal = curAvg;
        if (showDualAvg && appraisalMode === 'dual') {
            avgForAppraisal = getDualAverageValue(s);
        }
        const appreciation = getAppreciation(avgForAppraisal);

        let avgCells = '';
        if (selectedTrimesterVal === '1') {
            avgCells = `<td style="${colorStyle(a1)} direction:ltr;">${a1}</td>`;
        } else if (selectedTrimesterVal === '2') {
            avgCells = `<td style="${colorStyle(a1)} direction:ltr;">${a1}</td><td style="${colorStyle(a2)} direction:ltr;">${a2}</td>`;
            if (showDualAvg) {
                const dualValue = getDualAverageValue(s);
                const dual = hasDualAverageData(s) ? dualValue.toFixed(2) : '-';
                avgCells += `<td style="${colorStyle(dual)} direction:ltr; background:#d5f5e3;">${dual}</td>`;
            }
        } else if (selectedTrimesterVal === '3') {
            avgCells = `<td style="${colorStyle(a1)} direction:ltr;">${a1}</td><td style="${colorStyle(a2)} direction:ltr;">${a2}</td><td style="${colorStyle(a3)} direction:ltr;">${a3}</td>`;
        } else if (selectedTrimesterVal === 'annual') {
            avgCells = `<td style="${colorStyle(a1)} direction:ltr;">${a1}</td><td style="${colorStyle(a2)} direction:ltr;">${a2}</td><td style="${colorStyle(a3)} direction:ltr;">${a3}</td><td style="${colorStyle(annual)} direction:ltr; background:#ecf0f1;">${annual}</td>`;
        }

        const genderCell = `<td style="font-size:9pt;">${s.gender||'-'}</td>`;
        const dobCell = `<td style="font-size:9pt; direction:ltr; text-align:center;">${s.dob||'-'}</td>`;
        currentTbody += `<tr><td>${index+1}</td><td style="white-space:nowrap; text-align:right; font-weight:bold;">${s.name}</td>${dobCell}${genderCell}<td>${s.level||'-'}</td>${groupCol}${avgCells}<td style="font-weight:bold; color:#1e40af;">${appreciation}</td></tr>`;

        pageRowCount++;
        if (pageRowCount >= ROWS_PER_PAGE) flushPage();
    });
    flushPage();
    const totalPages = pageNum - 1 || 1;

    // Header HTML
    const headerHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:10px;">
            <h3 style="margin:1px 0; font-size:10pt;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>
            <h3 style="margin:1px 0; font-size:10pt;">وزارة التربية الوطنية</h3>
            <div style="width:100%; display:flex; justify-content:space-between; margin:4px 0; font-size:9pt;">
                <div><div>مديرية التربية لولاية ${settings.wilaya||'.......'}</div><div>المؤسسة: ${settings.institutionName||'.......'}</div></div>
                <div style="text-align:left;"><div>البلدية: ${settings.municipality||'.......'}</div><div>السنة الدراسية: ${settings.schoolYear||'2025/2026'}</div></div>
            </div>
            <h2 style="margin:3px 0; border:2px solid #000; padding:3px 10px; border-radius:5px; font-size:12pt;">النتائج الشاملة لتلاميذ المؤسسة - الفصل ${selectedTrimesterName}</h2>
        </div>
        <div style="border-bottom:1px solid #000; margin-bottom:8px;"></div>
    `;

    // Footer
    const sigSettings = await DB.get('signatureSettings') || {};
    const reportConfig = sigSettings.reportSettings?.['institution_analysis'] || { signer: 'director' };
    const signerData = sigSettings.signers?.[reportConfig.signer] || { gender: 'male' };
    const signerTitle = reportConfig.signer === 'director' ? (signerData.gender === 'female' ? 'المديرة' : 'المدير') : (signerData.gender === 'female' ? 'الناظرة' : 'الناظر');
    const footerHtml = `<div style="margin-top:20px; display:flex; justify-content:flex-end;"><div style="text-align:center;"><div style="margin-bottom:8px;">حرر بـ: ${settings.municipality||'.......'} في: ${today}</div><div>${signerTitle}</div></div></div>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
        <html lang="ar" dir="rtl"><head>
        <meta charset="UTF-8"><title>طباعة كل النتائج</title>
        <style>
            @font-face{font-family:'Cairo';font-weight:400;src:url('assets/fonts/Cairo-Regular.ttf')format('truetype');}
            @font-face{font-family:'Cairo';font-weight:700;src:url('assets/fonts/Cairo-Bold.ttf')format('truetype');}
            @page{size:A4;margin:0.8cm;}
            *{margin:0;padding:0;box-sizing:border-box;}
            body{font-family:'Cairo','Tajawal',sans-serif;background: 'var(--card-bg)';-webkit-print-color-adjust:exact;}
            table{width:100%;border-collapse:collapse;margin-top:10px;font-size:9.5pt;}
            th,td{border:1px solid #000;padding:5px 4px;text-align:center;}
            th{background-color:#f1f5f9!important;font-weight:bold;}
            .group-header td{background:#e8eaf6!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
            @media print{.no-print{display:none!important;}th{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
        </style>
        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body style="background:#f1f5f9;">
        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
        <div style="background: 'var(--card-bg)';max-width:21cm;margin:0 auto;padding:20px;min-height:29.7cm;box-shadow:0 0 10px rgba(0,0,0,0.1);">
            ${headerHtml}
            <table>
                <thead><tr>
                    <th width="5%"> الرقم </th>
                    <th style="width:1%;white-space:nowrap;text-align:right;padding-right:10px;">اللقب والاسم</th>
                    <th>تاريخ الميلاد</th>
                    <th>الجنس</th>
                    ${boardingHeader}
                    <th>المستوى</th>
                    <th>${stage === 'secondary' ? 'الشعبة' : 'الفوج'}</th>
                    ${stage === 'secondary' ? '<th>القسم</th>' : ''}
                    ${extraHeaders}
                    <th>التقدير</th>
                </tr></thead>
                ${pageChunksHtml}
            </table>
            ${footerHtml}
        </div>
        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}
        </body></html>`);
    printWindow.document.close();
    printWindow.onload = function() { printWindow.focus(); };
}

// --- Student Search Feature ---
function handleStudentSearch(query) {
    const resultsDiv = document.getElementById('searchResults');
    if (!query || query.trim().length === 0) {
        resultsDiv.style.display = 'none';
        return;
    }

    const normQuery = normalizeArabic(query);
    const results = studentsData.filter(s => {
        const normName = normalizeArabic(s.name);
        return normName.includes(normQuery) || normQuery.includes(normName);
    }).slice(0, 8);

    if (results.length === 0) {
        resultsDiv.innerHTML = '<div style="padding: 12px; color: #64748b; text-align: center; font-size: 14px;">لا يوجد تلميذ بهذا الاسم</div>';
        resultsDiv.style.display = 'block';
        return;
    }

    let html = '';
    results.forEach(student => {
        const idx = studentsData.indexOf(student);
        html += `<div style="padding: 12px 15px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; flex-direction: column; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'" onclick="showStudentResults(${idx})">
            <span style="font-weight: bold; color: #1e293b; font-size: 15px;">${student.name}</span>
            <span style="font-size: 12px; color: #64748b; margin-top: 3px;">
                <i class="fas fa-graduation-cap"></i> ${student.level} ${student.stream ? '- ' + student.stream : ''} | <i class="fas fa-users"></i> الفوج ${student.class}
            </span>
        </div>`;
    });

    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
}

function showStudentResults(studentIndex) {
    const resultsDiv = document.getElementById('searchResults');
    const searchInput = document.getElementById('studentSearchInput');
    resultsDiv.style.display = 'none';
    searchInput.value = '';

    const student = studentsData[studentIndex];
    if (!student) return;

    const trimesterSelect = document.getElementById('trimesterSelect');
    const selectedT = trimesterSelect ? trimesterSelect.value : '1';

    let trimesterTitle = 'الفصل الأول';
    if (selectedT === '2') trimesterTitle = 'الفصل الثاني';
    if (selectedT === '3') trimesterTitle = 'الفصل الثالث';
    if (selectedT === 'annual') trimesterTitle = 'المعدل السنوي';

    const avg = student.averages ? student.averages[selectedT] : null;
    let avgHtml = avg ? `<div style="font-size: 28px; font-weight: 900; color: ${avg >= 10 ? '#27ae60' : '#e74c3c'}; margin: 15px 0;">المعدل: ${avg.toFixed(2)}</div>` : '<div style="color: #e74c3c; margin: 15px 0; font-weight: bold;">لا يوجد معدل مسجل</div>';

    let marksHtml = '<table style="width: 100%; border-collapse: collapse; margin-top: 15px; text-align: right; font-size: 14px;">';
    marksHtml += '<thead><tr style="background: #f8fafc; color: #475569; border-bottom: 2px solid var(--border-color);">';
    marksHtml += '<th style="padding: 10px;">المادة</th><th style="padding: 10px; text-align: left;">العلامة</th></tr></thead><tbody>';

    let hasMarks = false;
    if (student._opt && student._opt[selectedT] && selectedT !== 'annual') {
        const sortedMarks = Object.entries(student._opt[selectedT]).sort((a, b) => {
            if (a[0].includes('معدل') || a[0].includes('المعدل')) return 1;
            if (b[0].includes('معدل') || b[0].includes('المعدل')) return -1;
            return 0;
        });

        for (const [rawSub, score] of sortedMarks) {
            // Clean up suffixes like 'ف1', 'فصل 1', 'الأول', 'الثاني', 'الثالث', '1', '2', '3' from the end
            let cleanSub = rawSub.replace(/ ف\s?[123]$/, '')
                .replace(/ فصل\s?[123]$/, '')
                .replace(/ (فصل|الفصل)?\s?(الأول|الاول|الثاني|الثانى|الثالث|التالت)$/, '')
                .replace(/ (1|2|3)$/, '')
                .replace(/ \((1|2|3)\)$/, '')
                .trim();

            const scoreNum = parseFloat(score);
            let scoreColor = '#334155';
            if (!isNaN(scoreNum)) {
                scoreColor = (scoreNum >= 10) ? '#27ae60' : '#e74c3c';
            }
            const displayScore = isNaN(scoreNum) ? score : scoreNum.toFixed(2);

            marksHtml += `<tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; font-weight: bold; color: #334155;">${cleanSub}</td>
                <td style="padding: 10px; font-weight: bold; color: ${scoreColor}; text-align: left;" dir="ltr">${displayScore}</td>
            </tr>`;
            hasMarks = true;
        }
    }

    marksHtml += '</tbody></table>';

    if (!hasMarks) {
        marksHtml = '<div style="padding: 20px; color: #94a3b8; font-style: italic;">لا توجد تفاصيل مواد لهذا الفصل.</div>';
    }

    let decisionHtml = '';
    if (avg !== null && avg !== undefined) {
        if (avg >= 10) {
            decisionHtml = '<div style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 10px; border-radius: 8px; font-weight: bold; margin-top: 15px;"><i class="fas fa-check-circle"></i> نتيـجة إيجابيـة</div>';
        } else {
            decisionHtml = '<div style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 10px; border-radius: 8px; font-weight: bold; margin-top: 15px;"><i class="fas fa-exclamation-circle"></i> بحاجة للدعم</div>';
        }
    }

    Swal.fire({
        title: `<div style="color: #1e293b; font-size: 22px; margin-bottom: 5px;">${student.name}</div>`,
        html: `
            <div style="font-size: 14px; color: #64748b; margin-bottom: 15px;">
                <i class="fas fa-graduation-cap"></i> ${student.level} ${student.stream ? '- ' + student.stream : ''} | <i class="fas fa-users"></i> الفوج ${student.class}
                <br><span style="color: #3b82f6; font-weight: bold; display: inline-block; margin-top: 5px;">[ ${trimesterTitle} ]</span>
            </div>
            ${avgHtml}
            ${decisionHtml}
            <div style="max-height: 280px; overflow-y: auto; overflow-x: hidden; border: 1px solid var(--border-color); border-radius: 12px; margin-top: 20px; text-align: right;">
                ${marksHtml}
            </div>
        `,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: 'var(--secondary-color)',
        width: '450px'
    });
}

// Close search results when clicking outside
document.addEventListener('click', function (e) {
    const resultsDiv = document.getElementById('searchResults');
    const searchInput = document.getElementById('studentSearchInput');
    if (resultsDiv && searchInput && !resultsDiv.contains(e.target) && e.target !== searchInput) {
        resultsDiv.style.display = 'none';
    }
});

// ---- INJECTED PE EXEMPTION WRAPPER ----
function getSubjectScore(...args) {
    let score = _orig_getSubjectScore(...args);
    let targetSub = args[1] ? args[1].toString().trim() : '';
    if (score !== null && score !== undefined && (targetSub === 'رياضة' || targetSub.includes('بدنية') || targetSub.includes('رياضية'))) {
        let num = typeof score === 'string' ? parseFloat(score.replace(',', '.')) : parseFloat(score);
        if (num === 0 || isNaN(num)) return null;
    }
    return score;
}

if (typeof _orig_getSubjectScoreByTrimester === 'function') {
    globalThis.getSubjectScoreByTrimester = function (...args) {
        let score = _orig_getSubjectScoreByTrimester(...args);
        let targetSub = args[1] ? args[1].toString().trim() : '';
        if (score !== null && score !== undefined && (targetSub === 'رياضة' || targetSub.includes('بدنية') || targetSub.includes('رياضية'))) {
            let num = typeof score === 'string' ? parseFloat(score.replace(',', '.')) : parseFloat(score);
            if (num === 0 || isNaN(num)) return null;
        }
        return score;
    }
}

function populateYears() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;

    const years = new Set();
    studentsData.forEach(s => {
        const y = getStudentYear(s);
        if (y) years.add(y);
    });

    if (yearSelect && yearSelect.options.length === 0) {
        yearSelect.innerHTML = '';
        [...years].sort((a, b) => b.localeCompare(a)).forEach(y => {
            yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
        });

        if (years.size > 0) {
            yearSelect.value = [...years].sort((a, b) => b.localeCompare(a))[0];
        }
    }
}

