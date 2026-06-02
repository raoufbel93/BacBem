function getStudentYear(s) {
    if (window.AppAcademic && typeof window.AppAcademic.getStudentYear === 'function') {
        return window.AppAcademic.getStudentYear(s);
    }
    return s && (s.academic_year || s.schoolYear || s.year || s.school_year || '') || '';
}

// 1. Load Data

let studentsData = [];

// Order of subjects for display - Short names

// Order of subjects for display - Initialized dynamically

let orderedSubjects = [];

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

    'علوم': ['علوم طبيعية', 'ع.طبيعية', 'ع الطبيعة والحياة', 'ع الطبيعة و الحياة', 'طبيعة و حياة', 'العلوم الطبيعية', 'علوم', 'علوم الطبيعة والحياة', 'العلوم الطبيعة والحياة'],

    'علوم طبيعية': ['علوم', 'ع.طبيعية', 'ع الطبيعة والحياة', 'ع الطبيعة و الحياة', 'طبيعة و حياة', 'العلوم الطبيعية', 'علوم الطبيعة والحياة', 'العلوم الطبيعة والحياة'],

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

let institutionSettings = {}; // Store settings

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

    // Extract level number (1, 2, 3, 4) from level string (e.g., "السنة الأولى")

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

    await loadData();

    populateFilters();

    document.getElementById('trimesterSelect').addEventListener('change', () => applyFilters());

    const yearSelect = document.getElementById('yearSelect');
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            populateFilters();
            applyFilters();
        });
    }

    document.getElementById('levelSelect').addEventListener('change', () => {

        populateStreams();

        applyFilters();

    });

    document.getElementById('streamSelect').addEventListener('change', () => applyFilters());

    // Fix navigation bar

    NavbarManager.render();

    applyFilters();

});







const normCache = new Map();
const canonicalMap = new Map();

function initCanonicalMap() {
    canonicalMap.clear();
    for (const canonical in subjectAliases) {
        const normCanonical = normalizeArabic(canonical);
        canonicalMap.set(normCanonical, normCanonical);
        const aliases = subjectAliases[canonical] || [];
        for (const alias of aliases) {
            canonicalMap.set(normalizeArabic(alias), normCanonical);
        }
    }
}

function getCanonicalName(name) {
    if (!name) return "";
    const norm = normalizeArabic(name);
    return canonicalMap.get(norm) || norm;
}

function normalizeArabic(text) {
    if (!text) return "";
    if (normCache.has(text)) return normCache.get(text);
    
    const result = text.toString()
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ﻷ|ﻹ|ﻵ|ﻻ/g, 'لا')
        .replace(/لأ|لإ|لآ/g, 'لا')
        .replace(/[.,/#!$%^&*;:{}=\\-_`~()]/g, "")
        .replace(/\s+/g, ' ');
    
    normCache.set(text, result);
    return result;
}

async function optimizeStudentData(data) {
    if (!data) return;
    const trimesters = ['1', '2', '3'];
    const patterns = {};
    trimesters.forEach(t => {
        patterns[t] = [
            new RegExp(`ف\\s*${t}(\\s|$)`),
            new RegExp(`فصل\\s*${t}(\\s|$)`)
        ];
    });

    const CHUNK_SIZE = 100;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        for (const student of chunk) {
            if (!student.marks) continue;
            student._opt = { '1': {}, '2': {}, '3': {}, 'annual': {} };
            
            Object.keys(student.marks).forEach(key => {
                const normKey = normalizeArabic(key);
                let keyTrimester = '1';
                for (const t of trimesters) {
                    if (patterns[t].some(p => p.test(normKey))) {
                        keyTrimester = t;
                        break;
                    }
                }
                const baseKey = getCanonicalName(normKey.replace(/\s*ف[123]$|\s*فصل\s*[123]$/, '').trim());
                student._opt[keyTrimester][baseKey] = student.marks[key];
            });

            const allBaseKeys = new Set([
                ...Object.keys(student._opt['1']),
                ...Object.keys(student._opt['2']),
                ...Object.keys(student._opt['3'])
            ]);

            allBaseKeys.forEach(baseKey => {
                let sum = 0;
                let count = 0;
                trimesters.forEach(t => {
                    if (student._opt[t][baseKey] !== undefined) {
                        const score = student._opt[t][baseKey];
                        const val = typeof score === 'string' ? parseFloat(score.replace(',', '.')) : parseFloat(score);
                        if (!isNaN(val)) {
                            sum += val;
                            count++;
                        }
                    }
                });
                if (count === 3) {
                    student._opt['annual'][baseKey] = (sum / count).toFixed(2);
                }
            });

            let avgSum = 0;
            let avgCount = 0;
            trimesters.forEach(t => {
                if (student.averages && student.averages[t]) {
                    avgSum += parseFloat(student.averages[t]);
                    avgCount++;
                }
            });
            student._annualAverage = avgCount === 3 ? parseFloat((avgSum / avgCount).toFixed(2)) : null;
        }
        await new Promise(r => setTimeout(r, 0));
    }
}

function _orig_getSubjectScore(student, shortSubjectName) {
    const trimesterSelect = document.getElementById('trimesterSelect');
    const selectedTrimesterVal = trimesterSelect ? trimesterSelect.value : '1';

    if (!student._opt) return null;
    const cache = student._opt[selectedTrimesterVal];
    if (!cache) return null;

    const canonical = getCanonicalName(shortSubjectName);
    
    // 1. Direct match on canonical name
    if (cache[canonical] !== undefined) return cache[canonical];

    // 2. Fallback: check all aliases of the requested subject
    const aliases = [shortSubjectName, ...(subjectAliases[shortSubjectName] || [])];
    for (const alias of aliases) {
        const normAlias = normalizeArabic(alias);
        if (cache[normAlias] !== undefined) return cache[normAlias];
    }

    // 3. Last resort: fuzzy match against any key in cache
    const shortNorm = normalizeArabic(shortSubjectName);
    for (const key in cache) {
        if (key.includes(shortNorm) || shortNorm.includes(key)) return cache[key];
    }

    return null;
}

async function loadData() {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = overlay ? overlay.querySelector('.loading-text') : null;
    if (overlay) {
        overlay.classList.add('active');
        if (loadingText) loadingText.textContent = 'جاري تحميل البيانات...';
    }

    let rawStudentsData = await DB.getResults(true) || [];
    
    initCanonicalMap();

    const studentMap = new Map();
    const CHUNK_SIZE = 200;
    
    for (let i = 0; i < rawStudentsData.length; i += CHUNK_SIZE) {
        const chunk = rawStudentsData.slice(i, i + CHUNK_SIZE);
        
        if (loadingText) {
            loadingText.textContent = `جاري معالجة البيانات (${Math.round((i / rawStudentsData.length) * 100)}%)`;
        }

        for (const student of chunk) {
            const cleanStr = (s) => normalizeArabic(s || '').replace(/\\s+/g, '');
            const normSection = (s) => (s || '').toString().trim().replace(/^0+/, '') || "1";

            const normName = cleanStr(student.name);
            const normDob = cleanStr(student.dob);
            const normClass = normSection(student.class);
            const normLevel = cleanStr(student.level);
            const normStream = cleanStr(student.stream);

            const stYear = getStudentYear(student);
            const uniqueKey = `${stYear}|${normName}|${normDob}|${normClass}|${normLevel}|${normStream}`;

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
                targetStudent = {
                    ...student,
                    marks: {},
                    averages: {},
                    class: normSection(student.class),
                    name: (student.name || '').trim(),
                    dob: (student.dob || '').trim(),
                    level: (student.level || '').trim(),
                    stream: (student.stream || '').trim()
                };
                studentMap.set(uniqueKey, targetStudent);
            }

            if (student.marks) {
                Object.entries(student.marks).forEach(([sub, score]) => {
                    const hasSuffix = ['1', '2', '3'].some(t => sub.includes(`ف${t}`) || sub.includes(`فصل ${t}`));
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
        await new Promise(r => setTimeout(r, 0));
    }

    studentsData = Array.from(studentMap.values());
    
    if (loadingText) loadingText.textContent = 'جاري تحسين الأداء...';
    await optimizeStudentData(studentsData);

    institutionSettings = await DB.getSettings();
    exemptSubjects = await DB.get('exemptSubjects') || {};
    orderedSubjects = SubjectManager.getSubjects('middle', '1');
    subjects = orderedSubjects;

    if (overlay) overlay.classList.remove('active');
}

function populateFilters() {
    const levelSelect = document.getElementById('levelSelect');
    const yearSelect = document.getElementById('yearSelect');
    if (!levelSelect || !yearSelect) return;

    // Get Unique Academic Years
    const years = new Set();
    studentsData.forEach(s => {
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
    const stage = institutionSettings.educationStage || 'middle';

    // Get Levels for this year
    const levelsInYear = [...new Set(studentsData.filter(s => getStudentYear(s) === selectedYear).map(s => s.level))].filter(l => l).sort();

    levelSelect.innerHTML = '';
    levelsInYear.forEach(l => {
        levelSelect.innerHTML += `<option value="${l}">${l}</option>`;
    });

    if (levelsInYear.length > 0) levelSelect.value = levelsInYear[0];

    populateStreams();
}

function populateStreams() {

    const levelSelect = document.getElementById('levelSelect').value;

    const streamSelect = document.getElementById('streamSelect');

    const streamGroup = document.getElementById('streamGroup');

    const stage = institutionSettings.educationStage || 'middle';

    if (stage === 'secondary') {

        streamGroup.style.display = 'block';

        // Data-driven approach: Get streams from studentsData for the selected level

        const yrSelect = document.getElementById('yearSelect');
        const yr = yrSelect ? yrSelect.value : null;
        let filtered = studentsData.filter(s => !yr || getStudentYear(s) === yr);

        if (levelSelect !== 'all') {

            filtered = filtered.filter(s => levelMatchesSelection(s.level, levelSelect));

        }

        const streams = [...new Set(filtered.map(s => s.stream).filter(s => s))].sort();

        let html = '<option value="">-- كل الشعب --</option>';

        streams.forEach(stream => {

            html += `<option value="${stream}">${getStreamLabel(stream)}</option>`;

        });

        streamSelect.innerHTML = html;

    } else {

        streamGroup.style.display = 'none';

        streamSelect.innerHTML = '<option value="">-- كل الشعب --</option>';

    }

}

// Add matchLevel helper here if it doesn't exist in scope, or reuse if global

function matchLevel(studentLevel, targetLevelNum) {
    if (window.AppAcademic && typeof window.AppAcademic.matchLevel === 'function') {
        return window.AppAcademic.matchLevel(studentLevel, targetLevelNum);
    }

    if (!studentLevel) return false;

    const l = studentLevel.toString().trim();

    if (targetLevelNum === '1') return l.includes('1') || l.includes('أولى') || l.includes('اولى');

    if (targetLevelNum === '2') return l.includes('2') || l.includes('ثانية') || l.includes('ثانيه');

    if (targetLevelNum === '3') return l.includes('3') || l.includes('ثالثة') || l.includes('ثالثه');

    if (targetLevelNum === '4') return l.includes('4') || l.includes('رابعة') || l.includes('رابعه');

    return false;

}

function levelMatchesSelection(levelValue, selectedLevel) {
    if (!selectedLevel || selectedLevel === 'all') return true;
    if (!levelValue) return false;

    if (matchLevel(levelValue, selectedLevel)) return true;

    return normalizeArabic(levelValue) === normalizeArabic(selectedLevel);
}

// Helper to translate stream codes (duplicated from repeaters but needed here if not global)

function getStreamLabel(streamCode) {

    if (!streamCode) return '-';

    const code = streamCode.toLowerCase().trim();

    const map = {

        'science': 'علوم تجريبية',

        'math': 'رياضيات',

        'math_tech': 'تقني رياضي',

        'tech_math': 'تقني رياضي',

        'tech_math_civil': 'تقني رياضي (هندسة مدنية)',

        'tech_math_elec': 'تقني رياضي (هندسة كهربائية)',

        'tech_math_mech': 'تقني رياضي (هندسة ميكانيكية)',

        'tech_math_methods': 'تقني رياضي (هندسة الطرائق)',

        'languages': 'لغات أجنبية',

        'literature': 'آداب وفلسفة',

        'arts': 'آداب وفلسفة',

        'management': 'تسيير واقتصاد',

        'sport': 'رياضة',

        'common_science': 'جذع مشترك علوم وتكنولوجيا',

        'common_arts': 'جذع مشترك آداب'

    };

    return map[code] || streamCode;

}

// Trimester Mapping

const trimesterMap = {
    '1': 'الأول',
    '2': 'الثاني',
    '3': 'الثالث',
    'annual': 'السنوي'
};

function applyFilters() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('active');

    setTimeout(() => {
        const selectedLevel = document.getElementById('levelSelect').value;
        const selectedStream = document.getElementById('streamSelect').value;
        const selectedTrimesterVal = document.getElementById('trimesterSelect').value;

        // Handle empty trimester selection
        if (!selectedTrimesterVal) {
            document.getElementById('generalStatsBody').innerHTML = '';
            document.getElementById('subjectStatsBody').innerHTML = '';
            document.getElementById('topStudentsBody').innerHTML = '';
            document.getElementById('classesBreakdown').innerHTML = '<div style="text-align:center; padding: 20px; font-size: 1.1em; color: #7f8c8d; grid-column: 1/-1;">الرجاء اختيار الفصل الدراسي لعرض النتائج</div>';

            if (window.levelChartInstance) {
                window.levelChartInstance.destroy();
                window.levelChartInstance = null;
            }
            if (overlay) overlay.classList.remove('active');
            return;
        }

        const selectedTrimesterName = trimesterMap[selectedTrimesterVal];

        // Check trimester mismatch

        // Relaxed Validation

        if (studentsData && studentsData.length > 0) {

            // Validation removed to support cross-trimester analysis

        }

        const yearSelect = document.getElementById('yearSelect');
        const selectedYear = yearSelect ? yearSelect.value : '';

        const levelData = studentsData.filter(s => {
            const isYearMatch = selectedYear ? (getStudentYear(s) === selectedYear) : true;
            const isLevelMatch = levelMatchesSelection(s.level, selectedLevel);
            const isStreamMatch = (!selectedStream || selectedStream === '') ? true : (s.stream === selectedStream);
            
            // Strict 3 trimesters for annual mode
            if (selectedTrimesterVal === 'annual') {
                return isYearMatch && isLevelMatch && isStreamMatch && (s._annualAverage !== null);
            }
            
            return isYearMatch && isLevelMatch && isStreamMatch;
        });

        // Filter the subjects globally for this analysis run

        const stage = institutionSettings.educationStage || 'middle';

        let activeSubjects = [];

        if (stage === 'secondary') {

            if (selectedStream) {

                activeSubjects = SubjectManager.getSubjects(stage, selectedLevel, selectedStream);

            } else {

                // Mixed stream fallback: use first student's stream or just Year 1 Common Science

                if (levelData.length > 0 && levelData[0].stream) {

                    activeSubjects = SubjectManager.getSubjects(stage, selectedLevel, levelData[0].stream);

                } else {

                    // Fallback list of subjects if no specific stream

                    activeSubjects = ['عربية', 'فرنسية', 'انجليزية', 'تاريخ', 'رياضيات', 'علوم', 'فيزياء'];

                }

            }

        } else {

            // Middle school logic

            // Use generic middle school list for filtering

            const base = SubjectManager.getSubjects('middle', selectedLevel);

            activeSubjects = getFilteredSubjects(selectedLevel, base);

        }

        // Filter subjects by trimester suffix if they have one

        const filteredByTrimester = activeSubjects.filter(sub => {
            if (selectedTrimesterVal === 'annual') return true;

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

        
        // Deduplicate subjects in annual mode
        let finalSubjects = filteredByTrimester;
        if (selectedTrimesterVal === 'annual') {
            const seen = new Set();
            finalSubjects = [];
            filteredByTrimester.forEach(sub => {
                const clean = getCanonicalName(sub.replace(/\s*ف[123]$|\s*فصل\s*[123]$/, '').trim());
                if (!seen.has(clean)) {
                    seen.add(clean);
                    finalSubjects.push(clean);
                }
            });
        }

        renderLevelDashboard(levelData, finalSubjects);
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

function renderLevelDashboard(data, activeSubjects) {
    const overlay = document.getElementById('loadingOverlay');

    if (!data || data.length === 0) {

        document.getElementById('generalStatsBody').innerHTML = '<tr><td colspan="5">لا توجد بيانات</td></tr>';

        document.getElementById('subjectStatsBody').innerHTML = '';
        document.getElementById('topStudentsBody').innerHTML = '';
        document.getElementById('classesBreakdown').innerHTML = '<div style="text-align:center; padding: 20px; font-size: 1.1em; color: #7f8c8d; grid-column: 1/-1;">لا توجد نتائج مطابقة للفلاتر الحالية</div>';
        if (window.levelChartInstance) {
            window.levelChartInstance.destroy();
            window.levelChartInstance = null;
        }
        if (overlay) overlay.classList.remove('active');
        return;

    }

    renderGeneralStats(data);

    renderChart(data);

    renderSubjectTable(data, activeSubjects);
    if (!data || data.length === 0) {

        document.getElementById('generalStatsBody').innerHTML = '<tr><td colspan="5">لا توجد بيانات</td></tr>';

        return;

    }

    renderGeneralStats(data);

    renderChart(data);

    renderSubjectTable(data, activeSubjects);

    renderTopStudents(data);

    renderClassesBreakdown(data, activeSubjects);

    if (overlay) overlay.classList.remove('active');

}

// 1. General Stats

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

        if (row.label === 'ذكور') colorClass = 'style="color: #2980b9"';

        if (row.label === 'إناث') colorClass = 'style="color: #e74c3c"';

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

// 2. Chart
let chartInstance = null;

function renderChart(data) {
    const ctx = document.getElementById('levelChart').getContext('2d');

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

                    backgroundColor: '#f1c40f'

                },

                {

                    label: 'راسبون',

                    data: failedData,

                    backgroundColor: 'var(--primary-color)'

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

                title: { display: true, text: 'تحليل النتائج حسب الجنس', font: { family: 'Tajawal', size: 16 } }

            }

        }

    });

}

// 3. Subject Stats

function renderSubjectTable(data, activeSubjects) {

    const tbody = document.getElementById('subjectStatsBody');

    let html = '';

    // Filter subjects that have data

    const subjectsWithData = activeSubjects.filter(sub => {

        return data.some(s => getSubjectScore(s, sub) !== null);

    });

    subjectsWithData.forEach((sub, index) => {

        const scores = data.map(s => getSubjectScore(s, sub)).filter(m => m !== null);

        if (scores.length === 0) return;

        const passed = scores.filter(s => s >= 10).length;

        const failed = scores.length - passed;

        const subAvg = (scores.reduce((a, b) => a + Number(b), 0) / scores.length).toFixed(2);

        const rate = scores.length > 0 ? ((passed / scores.length) * 100).toFixed(2) : 0;

        const rateStyle = rate < 50 ? 'background-color: #fadbd8; color: #c0392b;' : '';

        // For this table, maybe show better name if available? for now short name

        html += `

            <tr>

                <td>${index + 1}</td>

                <td>${sub}</td>

                <td>${passed}</td>

                <td>${failed}</td>

                <td style="font-weight:bold;">${subAvg}</td>

                <td style="${rateStyle} font-weight:bold;">${rate}%</td>

            </tr>

        `;

    });

    tbody.innerHTML = html;

}

// 4. Top Students

function renderTopStudents(data) {

    const tbody = document.getElementById('topStudentsBody');

    const top = [...data].sort((a, b) => getStudentAverage(b) - getStudentAverage(a)).slice(0, 30);

    const isSecondary = (institutionSettings.educationStage === 'secondary');

    // Toggle Header

    const headerEl = document.getElementById('topStudentsStreamHeader');

    if (headerEl) {

        headerEl.style.display = isSecondary ? '' : 'none';

    }

    let html = '';

    top.forEach((s, index) => {

        const streamCell = isSecondary ? `<td>${getStreamLabel(s.stream)}</td>` : '';

        html += `

            <tr>

                <td>${index + 1}</td>

                <td>${s.name}</td>

                <td>${s.dob ? s.dob.split('T')[0] : '-'}</td>

                <td>${s.level}</td>

                ${streamCell}

                <td style="font-weight:bold;">${getStudentAverage(s)}</td>

            </tr>

        `;

    });

    tbody.innerHTML = html;

}

// 5. Classes Breakdown

function renderClassesBreakdown(data, activeSubjects) {

    const container = document.getElementById('classesBreakdown');

    container.innerHTML = '<h3 style="grid-column: 1/-1; margin-top: 20px; border-right: 5px solid var(--secondary-color); padding-right: 15px;"><span data-icon="clipboard-list"></span> التحليل التفصيلي حسب الأقسام</h3>';

    const classes = [...new Set(data.map(s => s.class))].sort();

    if (classes.length === 0) return;

    classes.forEach(cls => {

        const classData = data.filter(s => s.class == cls);

        const count = classData.length;

        const avg = (s) => getStudentAverage(s);

        const passed = classData.filter(s => avg(s) >= 10).length;

        const failed = count - passed;

        const rate = count > 0 ? ((passed / count) * 100).toFixed(2) : 0;

        const classAvg = (classData.reduce((a, b) => a + (avg(b) || 0), 0) / count).toFixed(2);

        // Identify active subjects for this specific class from the already filtered level subjects

        const classActiveSubjects = activeSubjects.filter(sub => {

            return classData.some(s => getSubjectScore(s, sub) !== null);

        });

        // Use simple horizontal headers (no rotation)

        let subjectHeaders = '';

        let subjectAvgs = '';

        let subjectRates = '';

        classActiveSubjects.forEach(sub => {

            // Simple horizontal header with small font

            subjectHeaders += `<th style="font-size:11px; padding:5px 3px; min-width:45px;">${sub}</th>`;

            const scores = classData.map(s => getSubjectScore(s, sub)).filter(m => m !== null);

            const subAvg = scores.length > 0 ? (scores.reduce((a, b) => a + Number(b), 0) / scores.length).toFixed(2) : '-';

            const subPassCount = scores.filter(s => s >= 10).length;

            const subRate = scores.length > 0 ? ((subPassCount / scores.length) * 100).toFixed(0) : 0;

            subjectAvgs += `<td style="background:#eaf2f8;">${subAvg}</td>`;

            subjectRates += `<td style="font-weight:bold; color:${subRate >= 50 ? '#27ae60' : '#e74c3c'}; background:var(--bg-color);">${subRate}%</td>`;

        });

        const card = document.createElement('div');

        card.className = 'card class-card';

        card.style.marginBottom = '25px';

        card.style.borderTop = '4px solid var(--secondary-color)';

        card.innerHTML = `

            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:12px;">

                <h4 style="margin:0; color:var(--primary-color);"><span data-icon="school"></span> القسم: ${cls}</h4>

                <div style="font-size: 0.9rem; color:#7f8c8d;">

                    تعداد: <span style="color:var(--primary-color); font-weight:bold;">${count}</span> |

                    ناجح: <span style="color:#27ae60; font-weight:bold;">${passed}</span> |

                    راسب: <span style="color:#e74c3c; font-weight:bold;">${failed}</span>

                </div>

            </div>

            <div style="overflow-x:auto;">

                <table class="data-table" style="font-size: 0.85rem; border:1px solid #ddd;">

                    <thead>

                        <tr style="background:var(--primary-color); color:white;">

                            <th style="width:70px; padding:8px;">النوع</th>

                            <th style="min-width:60px; padding:8px;">م.القسم</th>

                            ${subjectHeaders}

                        </tr>

                    </thead>

                    <tbody>

                        <tr style="border-bottom: 2px solid #bdc3c7;">

                            <td style="font-weight:bold; background:#d6eaf8; color:#2471a3;">المعدل</td>

                            <td style="font-weight:bold; background:#aed6f1; color:#1a5276;">${classAvg}</td>

                            ${subjectAvgs}

                        </tr>

                        <tr>

                            <td style="font-weight:bold; background:#d5f5e3; color:#1e8449;">النسبة</td>

                            <td style="font-weight:bold; background:#a9dfbf; color:#145a32;">${rate}%</td>

                            ${subjectRates}

                        </tr>

                    </tbody>

                </table>

            </div>

        `;

        container.appendChild(card);

    });

}

// Print Level Report to New Tab

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

function printLevelReport() {

    printLevelReportToNewTab();

}

async function printLevelReportToNewTab() {
    if (blockTrialPrint()) return;

    const printWindow = window.open('', '_blank');

    // 1. Capture Chart as Image

    const chartCanvas = document.getElementById('levelChart');

    let chartImgHtml = '';

    if (chartCanvas) {

        // Create a temporary canvas with white background to ensure chart visibility

        const tempCanvas = document.createElement('canvas');

        tempCanvas.width = chartCanvas.width;

        tempCanvas.height = chartCanvas.height;

        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.fillStyle = '#ffffff';

        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        tempCtx.drawImage(chartCanvas, 0, 0);

        const chartImage = tempCanvas.toDataURL('image/png');

        chartImgHtml = `<div class="chart-container" style="width: 80%; margin: 20px auto; text-align: center;">

                            <img src="${chartImage}" style="max-width: 100%; height: auto;">

                        </div>`;

    }

    // 2. Get Layout Elements

    // General Stats

    const generalStatsTable = document.querySelector('#generalStatsBody').closest('table').outerHTML;

    const generalStatsTitle = document.querySelector('.card h3').innerText;

    // Subject Stats (Assuming it's the second card in dashboard-grid or separate)

    const subjectStatsCard = document.querySelectorAll('.level-dashboard > .card')[0];

    const subjectStatsTable = subjectStatsCard.querySelector('table').outerHTML;

    const subjectStatsTitle = subjectStatsCard.querySelector('h3').innerText;

    // Top Students

    const topStudentsCard = document.querySelector('.top-students-container');

    const topStudentsTable = topStudentsCard.querySelector('table').outerHTML;

    const topStudentsTitle = topStudentsCard.querySelector('h3').innerText;

    // Classes Breakdown

    const classesBreakdown = document.getElementById('classesBreakdown');

    const classesClone = classesBreakdown.cloneNode(true);

    // Optimize spacing in the clone

    classesClone.querySelectorAll('.class-card').forEach(card => {

        card.style.marginBottom = '10px';

        card.style.borderTop = '2px solid var(--secondary-color)';

        const header = card.querySelector('div[style*="display:flex"]');

        if (header) header.style.paddingBottom = '4px';

        const h4 = card.querySelector('h4');

        if (h4) h4.style.fontSize = '12px';

        // Ensure data-table inside class card is compact

        const table = card.querySelector('table');

        if (table) {

            table.style.fontSize = '8pt';

            table.style.marginBottom = '0';

        }

    });

    // Remove the h3 ("التحليل التفصيلي...") from the clone if it exists as a child,

    // we want to place it manually to ensure it heads the section

    const breakdownTitle = classesClone.querySelector('h3');

    if (breakdownTitle) breakdownTitle.remove();

    const classesHtml = classesClone.innerHTML;

    // 3. Header & Footer Data

    const settings = await DB.getSettings() || {};

    const selectedLevel = document.getElementById('levelSelect').value;

    const selectedTrimesterVal = document.getElementById('trimesterSelect').value;

    const tMapLocal = { '1': 'الأول', '2': 'الثاني', '3': 'الثالث', 'annual': 'السنوي' };
    const selectedTrimesterName = tMapLocal[selectedTrimesterVal] || selectedTrimesterVal;
    
    let reportTitleLabel = `نتائج الفصل ${selectedTrimesterName}`;
    if (selectedTrimesterVal === 'annual') {
        reportTitleLabel = 'النتائج السنوية';
    }


    const schoolYear = settings.schoolYear || '2025/2024';

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // Stream Info

    let streamTitle = '';

    const stage = settings.educationStage || 'middle';

    if (stage === 'secondary') {

        const streamSelect = document.getElementById('streamSelect');

        const streamCode = streamSelect ? streamSelect.value : '';

        if (streamCode) {

            const streamName = (typeof SubjectManager !== 'undefined') ? SubjectManager.getStreamName(streamCode) : streamCode;

            streamTitle = ` - الشعبة: ${streamName}`;

        }

    }

    // 4. Construct HTML

    const headerHtml = `

        <div style="font-family: 'Tajawal', sans-serif; direction: rtl; margin-bottom: 10px;">

            <div style="text-align: center; margin-bottom: 5px;">

                <h3 style="margin: 0; font-size: 12pt; font-weight: bold;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                <h3 style="margin: 2px 0; font-size: 11pt;">وزارة التربية الوطنية</h3>

            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px;">

                <div style="text-align: right; font-size: 10pt;">

                    <div style="margin-bottom:2px"><strong>مديرية التربية لولاية:</strong> ${settings.wilaya || '.......'}</div>

                    <div style="margin-bottom:2px"><strong>المؤسسة:</strong> ${settings.institutionName || '.......'}</div>

                </div>

                <div style="text-align: left; font-size: 10pt;">

                     <div style="margin-bottom:2px"><strong>السنة الدراسية:</strong> ${window.formatAcademicYear(schoolYear)}</div>

                     <div style="margin-bottom:2px"><strong>المقاطعة/البلدية:</strong> ${settings.municipality || '.......'}</div>

                </div>

            </div>

            <div style="text-align: center; margin-top: 5px; width: 100%;">

                <h2 style="margin: 2px 0; border: 1px solid #000; padding: 2px 10px; display: inline-block; border-radius: 5px; font-size: 12pt;">

                    تحليل ${reportTitleLabel}

                </h2>

                <h3 style="margin: 5px 0; font-size: 12pt;">المستوى: ${selectedLevel}${streamTitle}</h3>

            </div>

        </div>

    `;

    // Get signer info from signature settings

    const sigSettings = await DB.get('signatureSettings') || {};

    const reportConfig = sigSettings.reportSettings?.['level_analysis'] || { signer: 'director', showSignature: true };

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

    // Page 1 Content

    const page1Html = `

        <div class="print-page">

            ${headerHtml}

            <div class="section-title">${generalStatsTitle}</div>

            <div class="table-container">

                ${generalStatsTable}

            </div>

            <div class="section-title" style="margin-top: 20px;">${subjectStatsTitle}</div>

            <div class="table-container">

                ${subjectStatsTable}

            </div>

            <div style="margin-top: 30px;">

                ${chartImgHtml}

            </div>

        </div>

    `;

    // Page 2 Content (Top Students Only)

    const page2Html = `

        <div class="print-page page-break">

            <div class="section-title" style="margin-top: 40px;">${topStudentsTitle}</div>

            <div class="table-container">

                ${topStudentsTable}

            </div>

        </div>

    `;

    // Page 3+ Content (Classes)

    // Add Footer at the end

    const page3Html = `

        <div class="print-page page-break">

            <div class="section-title" style="margin-top: 20px;">التحليل التفصيلي حسب الأقسام</div>

            <div class="classes-container">

                ${classesHtml}

            </div>

            ${footerHtml}

        </div>

    `;

    // Write to window

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>تحليل المستويات - طباعة</title>

            <!-- No external stylesheet to avoid conflicts -->

            <style>

                @page { size: A4; margin: 0.8cm; }

                * { margin: 0; padding: 0; box-sizing: border-box; }

                body {

                    font-family: 'Tajawal', sans-serif;

                    background: 'var(--card-bg)';

                    -webkit-print-color-adjust: exact;

                    margin: 0;

                }

                .print-page {

                    width: 100%;

                    display: block;

                }

                .page-break {

                    page-break-before: always;

                }

                .report-header {

                    display: flex;

                    justify-content: space-between;

                    align-items: flex-start;

                    margin-bottom: 10px;

                    font-size: 11pt;

                    font-weight: bold;

                }

                .header-center { text-align: center; }

                .header-center h2, .header-center h3 { margin: 5px 0; }

                .header-right, .header-left { font-size: 10pt; }

                .report-footer {

                    margin-top: 30px;

                    display: flex;

                    justify-content: space-between;

                    font-weight: bold;

                    page-break-inside: avoid;

                }

                .footer-left { text-align: center; min-width: 200px; }

                table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10pt; border: 1pt solid black; }

                th, td { border: 1pt solid black; padding: 4px; text-align: center; }

                th { background-color: #f0f0f0 !important; color: #000 !important; font-weight: bold; }

                .section-title {

                    font-size: 14pt;

                    font-weight: bold;

                    margin-bottom: 10px;

                    border-right: 5px solid #000;

                    padding-right: 10px;

                }

                .classes-container {

                    display: block;

                }

                .classes-container .class-card {

                    break-inside: avoid;

                    page-break-inside: avoid;

                    border: 1px solid #ccc;

                    padding: 5px;

                    margin-bottom: 10px;

                }

                .classes-container h4 { margin: 5px 0; font-size: 11pt; }

                /* Compact spacing for classes */

                .classes-container .data-table th,

                .classes-container .data-table td {

                     padding: 2px;

                }

                .no-print { display: none; }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

            ${page1Html}

            ${page2Html}

            ${page3Html}

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

    if (val === 'annual') return student._annualAverage !== null ? student._annualAverage : 0;

    if (student.averages && student.averages[val]) {
        return parseFloat(student.averages[val]);
    }

    const tMap = { '1': 'الأول', '2': 'الثاني', '3': 'الثالث' };
    if (student.trimester === tMap[val]) {
        return parseFloat(student.average) || 0;
    }

    return 0;
}

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
