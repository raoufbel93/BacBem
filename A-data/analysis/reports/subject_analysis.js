
function getStudentYear(s) {
    if (!s) return '';
    const y = s.academic_year || s.school_year || s.year || '';
    if (y) return y;
    for (const key in s) {
        if (typeof s[key] === 'string' && /\b20\d{2}\b/.test(s[key])) {
            const match = s[key].match(/\b20\d{2}([-/]20\d{2})?\b/);
            if (match) return match[0];
        }
    }
    return '';
}

function populateYears() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;
    const years = new Set();
    studentsData.forEach(s => {
        const y = getStudentYear(s);
        if (y) years.add(y);
    });
    const sortedYears = [...years].sort((a,b) => b.localeCompare(a));
    let html = '';
    sortedYears.forEach(y => html += '<option value="' + y + '">' + y + '</option>');
    yearSelect.innerHTML = html;
    if (sortedYears.length > 0) yearSelect.value = sortedYears[0];
}

let studentsData = [];
let currentFilteredData = [];
let distributionChart = null;
let institutionSettings = {};
let exemptSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    populateFilters();
    
    const ys = document.getElementById('yearSelect');
    if (ys) ys.addEventListener('change', () => {
        populateStreams();
        populateClassDropdown();
        populateSubjects();
    });
    const ls = document.getElementById('levelSelect');
    if (ls) ls.addEventListener('change', () => {
        populateStreams();
        populateClassDropdown();
        populateSubjects();
    });
    const ss = document.getElementById('streamSelect');
    if (ss) ss.addEventListener('change', () => {
        populateClassDropdown();
        populateSubjects();
    });
});

async function loadData() {
    let rawStudentsData = await DB.getResults(true) || [];
    const studentMap = new Map();
    for (const student of rawStudentsData) {
        const cleanStr = (s) => (s || '').toString().trim();
        const normSection = (s) => (s || '').toString().trim().replace(/^0+/, '') || "1";
        
        const stYear = getStudentYear(student);
        const normName = cleanStr(student.name);
        const normDob = cleanStr(student.dob);
        const normClass = normSection(student.class);
        const normLevel = cleanStr(student.level);
        const normStream = cleanStr(student.stream);
        
        const uniqueKey = `${stYear}|${normName}|${normDob}|${normClass}|${normLevel}|${normStream}`;

        const getTrimesterValue = (name) => {
            const n = (name || '').toString().toLowerCase();
            if (n.includes('2')) return '2';
            if (n.includes('3')) return '3';
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
                const finalKey = (sub.includes(' ف') || sub.includes(' فصل')) ? sub : `${sub}${suffix}`;
                targetStudent.marks[finalKey] = score;
            });
        }
        if (student.averages) {
            Object.entries(student.averages).forEach(([t, avg]) => {
                if (avg !== undefined && avg !== null) targetStudent.averages[t] = parseFloat(avg) || 0;
            });
        }
        if (student.average !== undefined) targetStudent.averages[tVal] = parseFloat(student.average) || 0;
    }
    studentsData = Array.from(studentMap.values());
    institutionSettings = await DB.getSettings() || {};
    exemptSettings = await DB.get('exemptSubjects') || {};
    window.signatureSettings = await DB.get('signatureSettings') || {};
}

const exemptionMap = {
    'art': ['ت.تشكيلية', 'فنون تشكيلية', 'التربية التشكيلية', 'رسم', 'فنون'],
    'music': ['موسيقى', 'التربية الموسيقية'],
    'info': ['معلوماتية', 'اعلام', 'إعلام آلي'],
    'ama': ['أمازيغية', 'اللغة الأمازيغية']
};

function populateFilters() {
    populateYears();
    const levelSelect = document.getElementById('levelSelect');
    const yearSelect = document.getElementById('yearSelect');
    if (!levelSelect || !yearSelect) return;

    const selectedYear = yearSelect.value;
    const levelsInYear = [...new Set(studentsData.filter(s => getStudentYear(s) === selectedYear).map(s => s.level))].filter(l => l).sort();

    const currentLevel = levelSelect.value;
    let html = '<option value="all">جميع المستويات</option>';
    levelsInYear.forEach(l => {
        const label = l.replace(' متوسط', '');
        html += `<option value="${l}">${label}</option>`;
    });

    levelSelect.innerHTML = html;
    if (levelsInYear.includes(currentLevel)) {
        levelSelect.value = currentLevel;
    }

    populateStreams();
    populateSubjects();
}

function populateStreams() {
    const levelSelect = document.getElementById('levelSelect')?.value;
    const streamSelect = document.getElementById('streamSelect');
    const streamGroup = document.getElementById('streamGroup');
    const stage = institutionSettings.educationStage || 'middle';
    const yr = document.getElementById('yearSelect')?.value;

    if (stage === 'secondary') {
        if (streamGroup) streamGroup.style.display = 'flex';
        if (streamSelect) {
            streamSelect.innerHTML = '<option value="">-- كل الشعب --</option>';
            let streams = [];
            if (levelSelect === 'all') {
                streams = [...new Set(studentsData.filter(s => !yr || getStudentYear(s) === yr).map(s => s.stream).filter(s => s))].sort();
            } else {
                streams = (typeof SubjectManager !== 'undefined') ? SubjectManager.getStreams(levelSelect) : [];
            }
            streams.forEach(code => {
                const opt = document.createElement('option');
                opt.value = code;
                opt.textContent = (typeof SubjectManager !== 'undefined') ? SubjectManager.getStreamName(code) : code;
                streamSelect.appendChild(opt);
            });
        }
    } else {
        if (streamGroup) streamGroup.style.display = 'none';
    }
}

function populateClassDropdown() {
    const selectedLevel = document.getElementById('levelSelect')?.value;
    const selectedStream = document.getElementById('streamSelect')?.value;
    const classSelect = document.getElementById('classSelect');
    const yr = document.getElementById('yearSelect')?.value;

    if (!classSelect) return;
    classSelect.innerHTML = '<option value="all">جميع الأقسام</option>';
    if (!selectedLevel || selectedLevel === 'all') {
        classSelect.disabled = true;
        return;
    }
    classSelect.disabled = false;

    const filtered = studentsData.filter(s => {
        if (yr && getStudentYear(s) !== yr) return false;
        let lvlMatch = s.level === selectedLevel;
        if (selectedLevel === '1') lvlMatch = s.level.includes('1') || s.level.includes('أولى');
        if (selectedLevel === '2') lvlMatch = s.level.includes('2') || s.level.includes('ثانية');
        if (selectedLevel === '3') lvlMatch = s.level.includes('3') || s.level.includes('ثالثة');
        if (selectedLevel === '4') lvlMatch = s.level.includes('4') || s.level.includes('رابعة');
        const streamMatch = selectedStream ? (s.stream === selectedStream) : true;
        return lvlMatch && streamMatch;
    });

    const classes = [...new Set(filtered.map(s => s.class).filter(c => c))].sort();
    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        classSelect.appendChild(opt);
    });
}

function populateSubjects() {
    const subjectSelect = document.getElementById('subjectSelect');
    if (!subjectSelect) return;
    const yr = document.getElementById('yearSelect')?.value;
    const level = document.getElementById('levelSelect')?.value || 'all';
    const stream = document.getElementById('streamSelect')?.value;
    const stage = institutionSettings.educationStage || 'middle';

    subjectSelect.innerHTML = '<option value="">-- اختر مادة --</option>';
    let subjects = [];

    const getFilteredStudents = () => {
        return studentsData.filter(s => {
            if (yr && getStudentYear(s) !== yr) return false;
            if (level !== 'all') {
                let matchLvl = (s.level === level);
                if (level === '1') matchLvl = s.level.includes('1') || s.level.includes('أولى');
                if (level === '2') matchLvl = s.level.includes('2') || s.level.includes('ثانية');
                if (level === '3') matchLvl = s.level.includes('3') || s.level.includes('ثالثة');
                if (level === '4') matchLvl = s.level.includes('4') || s.level.includes('رابعة');
                if (!matchLvl) return false;
            }
            if (stage === 'secondary' && stream && stream !== 'all' && stream !== '') {
                if (s.stream !== stream) return false;
            }
            return true;
        });
    };

    const filtered = getFilteredStudents();
    const subjectSet = new Set();
    filtered.forEach(s => {
        if (s.marks) {
            Object.keys(s.marks).forEach(sub => {
                const baseName = sub.replace(/ ف\s?[123]$/, '').replace(/ فصل\s?[123]$/, '').trim();
                subjectSet.add(baseName);
            });
        }
    });
    subjects = [...subjectSet].sort();

    if (window.ExemptSubjectsHelper && typeof window.ExemptSubjectsHelper.filterSubjects === 'function') {
        subjects = window.ExemptSubjectsHelper.filterSubjects(subjects, {
            level,
            students: filtered,
            exemptSubjects: exemptSettings,
            exemptionMap
        });
    } else {
        // Filter Out Exempted
        subjects = subjects.filter(sub => {
            const lvlKey = ['1','2','3','4'].find(k => level.includes(k));
            if (!lvlKey || !exemptSettings[lvlKey]) return true;
            const exemptions = exemptSettings[lvlKey];
            const normSub = normalizeArabic(sub);
            for (const [code, aliases] of Object.entries(exemptionMap)) {
                if (exemptions.includes(code)) {
                    if (aliases.some(alias => normalizeArabic(alias) === normSub || normSub.includes(normalizeArabic(alias)))) return false;
                }
            }
            return true;
        });
    }

    subjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        subjectSelect.appendChild(opt);
    });
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
        .replace(/\s+/g, ' ');
}

function getSubjectScore(student, targetSub, trimester) {
    if (!student.marks) return null;
    const normTarget = normalizeArabic(targetSub);
    const keys = Object.keys(student.marks);
    const tPattern1 = new RegExp(`ف\\s*${trimester}(\\s|$)`);
    const tPattern2 = new RegExp(`فصل\\s*${trimester}(\\s|$)`);

    let bestMatchKey = keys.find(k => {
        const normKey = normalizeArabic(k);
        const isSubjectMatch = (normKey.includes(normTarget) ||
            (subjectAliases[targetSub] && subjectAliases[targetSub].some(alias => normalizeArabic(alias) === normKey || normKey.includes(normalizeArabic(alias)))));
        return isSubjectMatch && (tPattern1.test(normKey) || tPattern2.test(normKey));
    });

    if (!bestMatchKey) {
        bestMatchKey = keys.find(k => {
            const normKey = normalizeArabic(k);
            return (normKey.includes(normTarget) || (subjectAliases[targetSub] && subjectAliases[targetSub].some(alias => normKey.includes(normalizeArabic(alias)))));
        });
    }
    return bestMatchKey ? student.marks[bestMatchKey] : null;
}

function applyAnalysis() {
    const yr = document.getElementById('yearSelect')?.value;
    const trimester = document.getElementById('trimesterSelect')?.value;
    const level = document.getElementById('levelSelect')?.value;
    const stream = document.getElementById('streamSelect')?.value;
    const cls = document.getElementById('classSelect')?.value;
    const subject = document.getElementById('subjectSelect')?.value;

    if (!subject) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'الرجاء اختيار مادة' });
        return;
    }

    let filtered = studentsData.filter(s => !yr || getStudentYear(s) === yr);
    if (level && level !== 'all') {
        filtered = filtered.filter(s => {
            if (level === '1') return s.level.includes('1') || s.level.includes('أولى');
            if (level === '2') return s.level.includes('2') || s.level.includes('ثانية');
            if (level === '3') return s.level.includes('3') || s.level.includes('ثالثة');
            if (level === '4') return s.level.includes('4') || s.level.includes('رابعة');
            return s.level === level;
        });
    }
    if (stream && stream !== 'all' && stream !== '') {
        filtered = filtered.filter(s => s.stream === stream);
    }
    if (cls && cls !== 'all') filtered = filtered.filter(s => s.class === cls);

    currentFilteredData = [];
    filtered.forEach(s => {
        const score = getSubjectScore(s, subject, trimester);
        if (score !== null) {
            currentFilteredData.push({
                name: s.name,
                level: s.level,
                stream: s.stream,
                class: s.class,
                score: parseFloat(score),
                status: parseFloat(score) >= 10 ? 'pass' : 'fail'
            });
        }
    });

    renderStats();
    renderChart();
    renderTable();
    renderClassComparison(subject, trimester);
    generateReport(subject);
}

// Aliases for matching official subject names (Ported from class_analysis.js)


const subjectAliases = {


    // -- Langes --


    'عربية': ['لغة عربية', 'أدب عربي', 'اللغة العربية', 'اللغة العربية وآدابها'],


    'لغة عربية': ['عربية', 'أدب عربي', 'اللغة العربية', 'اللغة العربية وآدابها'],


    'فرنسية': ['لغة فرنسية', 'فرنسية', 'اللغة الفرنسية'],


    'لغة فرنسية': ['فرنسية', 'لغة فرنسية', 'اللغة الفرنسية'],


    'انجليزية': ['لغة انجليزية', 'انجليزية', 'اللغة الإنجليزية', 'اللغة الانجليزية', 'اللغة الأنجليزية'],


    'لغة انجليزية': ['انجليزية', 'لغة انجليزية', 'اللغة الإنجليزية', 'اللغة الانجليزية', 'اللغة الأنجليزية'],


    'لغة ثالثة': ['اللغة اﻷجنبية الثالثة', 'اللغة الأجنبية الثالثة', 'لغة أجنبية ثالثة', 'لغة ثالثة', 'اللغة الثالثة', 'ألمانية', 'اسبانية', 'إسبانية', 'إيطالية', 'ايطالية', 'لغة 3', 'اللغة 3', 'اللغة الأجنبية 3', 'Allemand', 'Espagnol', 'Italien', 'Deutsch', 'Spanish', 'Italian'],


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


    'mdnia': ['مدنية', 'تربية مدنية'], // avoided Arabic key issue just in case


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





function _orig_getSubjectScore(student, targetSub, trimester) {


    if (!student.marks) return null;





    const normTarget = normalizeArabic(targetSub);


    const keys = Object.keys(student.marks);





    // 1. Priority: Look for explicit suffix match (e.g. "Subject F2")


    const tPattern1 = new RegExp(`ف\\s*${trimester}(\\s|$)`);


    const tPattern2 = new RegExp(`فصل\\s*${trimester}(\\s|$)`);





    let bestMatchKey = keys.find(k => {


        const normKey = normalizeArabic(k);


        const isSubjectMatch = (normKey.includes(normTarget) ||


            (subjectAliases[targetSub] && subjectAliases[targetSub].some(alias => normKey.includes(normalizeArabic(alias))))) &&


            !['فيزيائية', 'تكنولوجيا', 'اسلامية', 'إسلامية', 'شرعية', 'انسانية', 'اجتماعية'].some(ex => (targetSub.includes('طبيعية') || targetSub === 'علوم') && normKey.includes(normalizeArabic(ex))) &&


            !['فنية', 'تشكيلية', 'فنون', 'رسم'].some(ex => (targetSub === 'رياضة' || targetSub === 'تربية بدنية') && normKey.includes(normalizeArabic(ex))) &&


            !['رياضة', 'بدنية', 'رياضية'].some(ex => (targetSub === 'ت.تشكيلية' || targetSub.includes('فني')) && normKey.includes(normalizeArabic(ex)));





        return isSubjectMatch && (tPattern1.test(normKey) || tPattern2.test(normKey));


    });





    // 2. Fallback: Generic match if contexts align


    if (!bestMatchKey) {


        // Check if student file actually belongs to the requested trimester


        let contextMatch = false;


        if (student.trimester) {


            if (trimester === '1' && (student.trimester === 'الأول' || student.trimester === '1')) contextMatch = true;


            if (trimester === '2' && (student.trimester === 'الثاني' || student.trimester === '2')) contextMatch = true;


            if (trimester === '3' && (student.trimester === 'الثالث' || student.trimester === '3')) contextMatch = true;


        }





        if (contextMatch) {


            bestMatchKey = keys.find(k => {


                const normKey = normalizeArabic(k);


                const isSubjectMatch = (normKey.includes(normTarget) ||


                    (subjectAliases[targetSub] && subjectAliases[targetSub].some(alias => normKey.includes(normalizeArabic(alias))))) &&


                    !['فيزيائية', 'تكنولوجيا', 'اسلامية', 'إسلامية', 'شرعية', 'انسانية', 'اجتماعية'].some(ex => (targetSub.includes('طبيعية') || targetSub === 'علوم') && normKey.includes(normalizeArabic(ex)));





                if (!isSubjectMatch) return false;





                // Ensure no CONFICITING trimester suffix


                const otherTrimesters = ['1', '2', '3'].filter(t => t !== trimester);


                for (const t of otherTrimesters) {


                    if (new RegExp(`ف\\s*${t}(\\s|$)`).test(normKey) || new RegExp(`فصل\\s*${t}(\\s|$)`).test(normKey)) {


                        return false;


                    }


                }


                return true;


            });


        }


    }





    return bestMatchKey ? student.marks[bestMatchKey] : null;


}





function applyAnalysis() {


    const trimester = document.getElementById('trimesterSelect').value;


    const level = document.getElementById('levelSelect').value;


    const cls = document.getElementById('classSelect').value;


    const subject = document.getElementById('subjectSelect').value;





    if (!subject) {


        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'الرجاء اختيار مادة' });


        return;


    }





    // Filter students








    // Filter students


    // Filter students


    const yrSelect = document.getElementById('yearSelect');
    const yr = yrSelect ? yrSelect.value : null;
    let filtered = studentsData.filter(s => !yr || getStudentYear(s) === yr);


    const stage = institutionSettings.educationStage || 'middle';





    // Level Filter


    if (level !== 'all') {


        filtered = filtered.filter(s => {


            // Robust level matching


            if (level === '1') return s.level.includes('1') || s.level.includes('أولى');


            if (level === '2') return s.level.includes('2') || s.level.includes('ثانية');


            if (level === '3') return s.level.includes('3') || s.level.includes('ثالثة');


            if (level === '4') return s.level.includes('4') || s.level.includes('رابعة');


            return s.level === level;


        });


    }





    // Stream Filter


    const stream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : null;


    if (stage === 'secondary' && stream && stream !== 'all') {


        filtered = filtered.filter(s => s.stream === stream);


    }





    // Class Filter


    if (cls !== 'all') filtered = filtered.filter(s => s.class === cls);





    // Get scores for this subject


    currentFilteredData = [];


    filtered.forEach(s => {


        const score = getSubjectScore(s, subject, trimester);


        if (score !== null) {


            currentFilteredData.push({
                name: s.name,
                level: s.level,
                stream: s.stream,
                class: s.class,
                score: score,
                status: score >= 10 ? 'pass' : 'fail'
            });


        }


    });





    renderStats();


    renderChart();


    renderTable();


    renderClassComparison(subject, trimester);


    generateReport(subject);


}





function renderStats() {


    const total = currentFilteredData.length;


    const scores = currentFilteredData.map(s => s.score);


    const passCount = currentFilteredData.filter(s => s.status === 'pass').length;


    const failCount = total - passCount;





    const avg = total > 0 ? (scores.reduce((a, b) => a + b, 0) / total).toFixed(2) : 0;


    const max = total > 0 ? Math.max(...scores).toFixed(2) : 0;


    const min = total > 0 ? Math.min(...scores).toFixed(2) : 0;


    const passRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : 0;


    const failRate = total > 0 ? ((failCount / total) * 100).toFixed(1) : 0;





    document.getElementById('statTotal').textContent = total;


    document.getElementById('statAverage').textContent = avg;


    document.getElementById('statMinMax').textContent = `${max} / ${min}`;


    document.getElementById('statPassRate').textContent = passRate + '%';


    document.getElementById('statFailRate').textContent = failRate + '%';


}





function renderChart() {


    const ctx = document.getElementById('distributionChart').getContext('2d');





    if (distributionChart) {


        distributionChart.destroy();


    }





    // Distribution buckets


    const buckets = { '<5': 0, '5-10': 0, '10-15': 0, '15+': 0 };


    currentFilteredData.forEach(s => {


        if (s.score < 5) buckets['<5']++;


        else if (s.score < 10) buckets['5-10']++;


        else if (s.score < 15) buckets['10-15']++;


        else buckets['15+']++;


    });





    distributionChart = new Chart(ctx, {


        type: 'bar',


        data: {


            labels: ['أقل من 5', '5 - 10', '10 - 15', '15 فأكثر'],


            datasets: [{


                label: 'عدد التلاميذ',


                data: [buckets['<5'], buckets['5-10'], buckets['10-15'], buckets['15+']],


                backgroundColor: ['#e74c3c', '#f39c12', 'var(--secondary-color)', '#27ae60'],


                borderRadius: 8


            }]


        },


        options: {


            responsive: true,


            maintainAspectRatio: false,


            plugins: {


                legend: { display: false },


                title: {


                    display: true,


                    text: 'توزيع النقاط',


                    font: { family: 'Tajawal', size: 16 }


                }


            },


            scales: {


                y: {


                    beginAtZero: true,


                    ticks: { stepSize: 1 }


                }


            }


        }


    });


}





function renderTable() {
    const tbody = document.getElementById('studentTableBody');
    const stage = institutionSettings.educationStage || 'middle';
    const streamHeader = document.getElementById('streamHeader');

    // Toggle Header
    if (stage === 'secondary') {
        if (streamHeader) streamHeader.style.display = 'table-cell';
    } else {
        if (streamHeader) streamHeader.style.display = 'none';
    }

    tbody.innerHTML = '';

    if (currentFilteredData.length === 0) {
        const colSpan = stage === 'secondary' ? 6 : 5;
        tbody.innerHTML = `<tr><td colspan="${colSpan}">لا توجد بيانات (اختر مادة للتحليل)</td></tr>`;
        return;
    }

    currentFilteredData.forEach(item => {
        const tr = document.createElement('tr');
        const statusClass = item.status === 'pass' ? 'status-pass' : 'status-fail';
        const statusText = item.status === 'pass' ? 'ناجح' : 'راسب';

        let streamTd = '';
        if (stage === 'secondary') {
            const streamName = (typeof SubjectManager !== 'undefined') ? SubjectManager.getStreamName(item.stream) : item.stream;
            streamTd = `<td>${streamName || item.stream || '-'}</td>`;
        }

        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.level}</td>
            ${streamTd}
            <td>${item.class}</td>
            <td>${item.score.toFixed(2)}</td>
            <td class="${statusClass}">${statusText}</td>
        `;
        tbody.appendChild(tr);
    });
}





function renderClassComparison(subject, trimester) {


    const level = document.getElementById('levelSelect').value;


    const cls = document.getElementById('classSelect').value;


    const section = document.getElementById('comparisonSection');


    const tbody = document.querySelector('#comparisonTable tbody');





    // Only show if all classes within a level


    if (level === 'all' || cls !== 'all') {


        section.style.display = 'none';


        return;


    }





    // Get all classes for this level


    const classesInLevel = [...new Set(studentsData


        .filter(s => s.level === level)


        .map(s => s.class)


        .filter(c => c)


    )].sort();





    if (classesInLevel.length <= 1) {


        section.style.display = 'none';


        return;


    }





    tbody.innerHTML = '';


    section.style.display = 'block';





    classesInLevel.forEach(c => {


        const classStudents = studentsData.filter(s => s.level === level && s.class === c);


        const scores = [];


        classStudents.forEach(s => {


            const score = getSubjectScore(s, subject, trimester);


            if (score !== null) scores.push(score);


        });





        const count = scores.length;


        const avg = count > 0 ? (scores.reduce((a, b) => a + b, 0) / count).toFixed(2) : 'N/A';


        const passCount = scores.filter(sc => sc >= 10).length;


        const passRate = count > 0 ? ((passCount / count) * 100).toFixed(1) + '%' : 'N/A';





        const tr = document.createElement('tr');


        tr.innerHTML = `


            <td>${c}</td>


            <td>${count}</td>


            <td>${avg}</td>


            <td>${passRate}</td>


        `;


        tbody.appendChild(tr);


    });


}





function generateReport(subject) {
    const section = document.getElementById('reportSection');
    const total = currentFilteredData.length;

    if (total === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    const scores = currentFilteredData.map(s => s.score);
    const avg = (scores.reduce((a, b) => a + b, 0) / total).toFixed(2);
    const passCount = currentFilteredData.filter(s => s.status === 'pass').length;
    const failCount = total - passCount;
    const passRate = ((passCount / total) * 100).toFixed(1);

    // --- Enhanced Statistics Analysis ---

    // Distribution
    const excellent = currentFilteredData.filter(s => s.score >= 18).length;
    const veryGood = currentFilteredData.filter(s => s.score >= 15 && s.score < 18).length;
    const good = currentFilteredData.filter(s => s.score >= 12 && s.score < 15).length;
    const average = currentFilteredData.filter(s => s.score >= 10 && s.score < 12).length;
    const belowAvg = currentFilteredData.filter(s => s.score >= 8 && s.score < 10).length;
    const weak = currentFilteredData.filter(s => s.score < 8).length;

    // --- Report Text Generation ---

    // 1. Summary
    let summaryText = `تم إجراء تحليل دقيق لنتائج <strong>${total}</strong> تلميذ في مادة <strong>${subject}</strong>. `;
    summaryText += `سُجِّل معدل عام للمادة قدره <strong>${avg}/20</strong>، بنسبة نجاح بلغت <strong>${passRate}%</strong>. `;
    if (parseFloat(avg) >= 12) summaryText += `وهي نتائج إيجابية تعكس استيعاباً جيداً للمقرر.`;
    else if (parseFloat(avg) >= 10) summaryText += `وهي نتائج متوسطة تتطلب تعزيزاً لتحسين الأداء.`;
    else summaryText += `وهي نتائج دون المأمول تستدعي تدخلاً علاجياً عاجلاً.`;

    document.getElementById('reportSummary').innerHTML = summaryText;

    // 2. Strengths
    let strengths = [];
    if (parseFloat(passRate) >= 80) strengths.push('نسبة نجاح ممتازة تعكس كفاءة العملية التعليمية.');
    else if (parseFloat(passRate) >= 60) strengths.push('نسبة نجاح مقبولة لدى أغلبية التلاميذ.');

    if ((excellent + veryGood) > 0) strengths.push(`وجود نخبة من التلاميذ المتفوقين (${excellent + veryGood} تلميذ) بمعدلات تتجاوز 15/20.`);
    if (weak === 0) strengths.push('عدم وجود حالات ضعف شديد (أقل من 08/20)، مما يعد مؤشراً إيجابياً.');
    if (parseFloat(avg) >= 11) strengths.push('المعدل العام للمادة يفوق المعدل السنوي المطلوب.');

    if (strengths.length === 0) strengths.push('يجب العمل على خلق نقاط قوة من خلال تحفيز التلاميذ المجتهدين.');
    document.getElementById('reportStrengths').innerHTML = strengths.map(s => `• ${s}`).join('<br>');

    // 3. Weaknesses
    let weaknesses = [];
    if (parseFloat(passRate) < 50) weaknesses.push('نسبة النجاح متدنية (أقل من النصف)، مما يدق ناقوس الخطر.');
    if (weak > 0) weaknesses.push(`تسجيل عدد معتبر من التلاميذ (${weak}) في خانة الضعف (أقل من 08/20).`);
    if (belowAvg > (total * 0.3)) weaknesses.push('تركز نسبة كبيرة من النتائج في المنطقة القريبة من المعدل (بين 8 و 10)، مما يهدد بالرسوب.');
    if ((excellent + veryGood) === 0) weaknesses.push('غياب تام للعلامات المتميزة (فوق 15/20)، مما يشير إلى ضعف التنافسية.');

    if (weaknesses.length === 0) weaknesses.push('لا توجد ثغرات بيداغوجية بارزة، ويُنصح بالحفاظ على هذا النسق.');
    document.getElementById('reportWeaknesses').innerHTML = weaknesses.map(w => `• ${w}`).join('<br>');

    // 4. Recommendations
    let recommendations = [];
    if (failCount > 0) recommendations.push('تفعيل حصص الاستدراك والمعالجة البيداغوجية، مع التركيز على الكفاءات غير المحققة.');
    if (weak > 0) recommendations.push('دراسة حالات التلاميذ المتعثرين بشكل فردي (نفسياً واجتماعياً) لتحديد أسباب الضعف.');
    if ((excellent + veryGood) > 0) recommendations.push('تشجيع النخبة المتفوقة ومنحهم أنشطة إثرائية للحفاظ على تميزهم.');
    if (average > 0) recommendations.push('تكثيف التمارين التطبيقية للفئة المتوسطة لرفعهم إلى مستوى التمكن.');
    recommendations.push('التنسيق مع مستشاري التوجيه لمرافقة التلاميذ الذين يعانون من صعوبات تعلم حادة.');

    document.getElementById('reportRecommendations').innerHTML = recommendations.map(r => `• ${r}`).join('<br>');
}





// Sorting


let currentSort = { col: -1, asc: true };


function sortTable(colIndex) {


    if (currentSort.col === colIndex) currentSort.asc = !currentSort.asc;


    else { currentSort.col = colIndex; currentSort.asc = true; }





    currentFilteredData.sort((a, b) => {


        let valA, valB;


        switch (colIndex) {


            case 0: valA = a.name; valB = b.name; break;


            case 1: valA = a.level; valB = b.level; break;


            case 2: valA = a.class; valB = b.class; break;


            case 3: valA = a.score; valB = b.score; break;


            default: return 0;


        }





        if (typeof valA === 'string') {


            return currentSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);


        } else {


            return currentSort.asc ? valA - valB : valB - valA;


        }


    });





    renderTable();


}





// Expose functions to global scope


window.applyAnalysis = applyAnalysis;


window.sortTable = sortTable;


window.printReport = printReport;





async function printReport() {
    const subject = document.getElementById('subjectSelect').value;
    if (!subject) {


        alert('الرجاء اختيار مادة وإجراء التحليل أولاً');


        return;


    }





    const trimesterSelect = document.getElementById('trimesterSelect');
    const trimester = trimesterSelect.options[trimesterSelect.selectedIndex].text;
    const levelSelect = document.getElementById('levelSelect');
    const level = levelSelect.options[levelSelect.selectedIndex].text;
    const classSelect = document.getElementById('classSelect');
    const classVal = classSelect.options[classSelect.selectedIndex].text;

    const settings = await DB.getSettings() || {};
    const sigSettings = window.signatureSettings || {};
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });





    // Get stats
    const total = document.getElementById('statTotal').textContent;
    const avg = document.getElementById('statAverage').textContent;
    const minMax = document.getElementById('statMinMax').textContent;
    const passRate = document.getElementById('statPassRate').textContent;
    const failRate = document.getElementById('statFailRate').textContent;





    // Get report content
    const summary = document.getElementById('reportSummary').innerHTML || '.......';
    const strengths = document.getElementById('reportStrengths').innerHTML || '.......';
    const weaknesses = document.getElementById('reportWeaknesses').innerHTML || '.......';
    const recommendations = document.getElementById('reportRecommendations').innerHTML || '.......';





    // Get student table (cleaned for print)
    const studentTable = document.getElementById('studentTableBody').closest('table').cloneNode(true);
    // Remove sort arrows from headers
    studentTable.querySelectorAll('th').forEach(th => {
        th.textContent = th.textContent.replace(' ↕', '');
        th.style.cursor = 'default';
        th.removeAttribute('onclick');
    });





    // Stream Info
    let streamTitle = '';
    const stage = settings.educationStage || 'middle';
    if (stage === 'secondary') {
        const streamSelect = document.getElementById('streamSelect');
        const streamCode = streamSelect ? streamSelect.value : '';
        if (streamCode) {
            const streamName = (typeof SubjectManager !== 'undefined') ? SubjectManager.getStreamName(streamCode) : streamCode;
            streamTitle = ` | الشعبة: ${streamName}`;
        }
    }

    // Determine Signer
    const reportConfig = sigSettings.reportSettings?.['subject_analysis'] || { signer: 'director', showSignature: true };
    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };
    
    let signerTitle;
    if (reportConfig.signer === 'director') {
        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';
    } else {
        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';
    }
    const signerName = signerData.fullName || settings.managerName || '................';





    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>


        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير تحليل مادة ${subject}</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">


            <style>
                @page { margin: 0.8cm; size: A4; }
                body { 
                    font-family: 'Cairo', sans-serif; 
                    direction: rtl; 
                    padding: 0; 
                    font-size: 11pt; 
                    line-height: 1.4;
                    -webkit-print-color-adjust: exact;
                }
                
                .header-republic { text-align: center; margin-bottom: 5px; }
                .header-republic h3 { margin: 2px 0; font-size: 12pt; font-weight: bold; }
                
                .info-block { display: flex; justify-content: space-between; border-bottom: 1.5pt solid #000; padding-bottom: 5px; margin-bottom: 15px; }
                .info-item { font-size: 10.5pt; }

                .title-box { text-align: center; margin: 15px 0; }
                .title-box h2 { 
                    display: inline-block; 
                    border: 2pt solid #000; 
                    padding: 8px 30px; 
                    border-radius: 8px; 
                    background: #fdfdfd; 
                    font-size: 15pt; 
                    margin-bottom: 5px;
                }
                .title-sub { font-weight: bold; font-size: 12pt; }

                .stats-grid { 
                    display: grid; 
                    grid-template-columns: repeat(5, 1fr); 
                    gap: 10px; 
                    margin: 20px 0; 
                }
                .stat-box { 
                    border: 1pt solid #000; 
                    padding: 8px; 
                    text-align: center; 
                    background: #f9f9f9; 
                }
                .stat-box .label { font-size: 9pt; color: #555; margin-bottom: 3px; }
                .stat-box .value { font-size: 12pt; font-weight: bold; }

                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10pt; }
                th, td { border: 1pt solid #000; padding: 6px; text-align: center; }
                th { background-color: #f2f2f2 !important; font-weight: bold; }
                
                .section-title { 
                    margin: 20px 0 10px 0; 
                    border-right: 5px solid #000; 
                    padding-right: 10px; 
                    font-size: 12pt; 
                    font-weight: bold; 
                }

                .report-content { margin-top: 10px; }
                .report-item { 
                    margin-bottom: 12px; 
                    padding: 10px; 
                    border: 1pt solid #ccc; 
                    border-right: 5pt solid #333; 
                    background: #fafafa;
                    page-break-inside: avoid;
                }
                .report-item h4 { margin: 0 0 5px 0; font-size: 11pt; color: var(--primary-color); }
                .report-item p { margin: 0; white-space: pre-wrap; }
                
                .report-item.strength { border-right-color: #27ae60; }
                .report-item.weakness { border-right-color: #e74c3c; }
                .report-item.recommendation { border-right-color: #f39c12; }

                .footer { 
                    margin-top: 40px; 
                    display: flex; 
                    justify-content: flex-end; 
                    page-break-inside: avoid; 
                }
                .signature-block { text-align: center; min-width: 250px; }
                
                @media print {
                    .no-print { display: none; }
                }
            </style>


        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>
        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}
            <div class="header-republic">
                <h3>الجمهورية الجزائرية الديمقراطية الشعبية</h3>
                <h3>وزارة التربية الوطنية</h3>
            </div>

            <div class="info-block">
                <div class="info-col">
                    <div class="info-item"><strong>مديرية التربية لولاية:</strong> ${settings.wilaya || '.......'}</div>
                    <div class="info-item"><strong>المؤسسة:</strong> ${settings.institutionName || '.......'}</div>
                </div>
                <div class="info-col" style="text-align: left;">
                    <div class="info-item"><strong>السنة الدراسية:</strong> \</div>
                    <div class="info-item"><strong>المقاطعة/البلدية:</strong> ${settings.municipality || '.......'}</div>
                </div>
            </div>





            <div class="title-box">
                <h2>تقرير تحليل مادة: ${subject}</h2>
                <div class="title-sub">${trimester} | المستوى: ${level} | القسم: ${classVal}${streamTitle}</div>
            </div>

            <div class="stats-grid">
                <div class="stat-box"><div class="label">عدد التلاميذ</div><div class="value">${total}</div></div>
                <div class="stat-box"><div class="label">المعدل العام</div><div class="value">${avg}</div></div>
                <div class="stat-box"><div class="label">أعلى / أدنى</div><div class="value">${minMax}</div></div>
                <div class="stat-box"><div class="label">نسبة النجاح</div><div class="value" style="color: green;">${passRate}</div></div>
                <div class="stat-box"><div class="label">نسبة الرسوب</div><div class="value" style="color: red;">${failRate}</div></div>
            </div>





            <div class="section-title">📋 قائمة التلاميذ</div>
            ${studentTable.outerHTML}

            <div class="report-content">
                <div class="section-title">📝 التقرير التربوي</div>
                
                <div class="report-item">
                    <h4>📊 ملخّص الأداء</h4>
                    <p>${summary}</p>
                </div>

                <div class="report-item strength">
                    <h4>✅ نقاط القوة</h4>
                    <p>${strengths}</p>
                </div>

                <div class="report-item weakness">
                    <h4>⚠️ نقاط الضعف</h4>
                    <p>${weaknesses}</p>
                </div>

                <div class="report-item recommendation">
                    <h4>💡 التوصيات التربوية</h4>
                    <p>${recommendations}</p>
                </div>
            </div>





            <div class="footer">
                <div class="signature-block">
                    <div style="margin-bottom: 5px;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                    <div style="font-size: 13pt; font-weight: bold;">${signerTitle}</div>
                    <div style="margin-top: 5px; font-weight: bold;">${signerName}</div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(() => {
                        // window.print(); /* Replaced by global Toolbar */
                        window.onafterprint = function() { window.close(); };
                    }, 500);
                };
            </script>
        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}\n        </body>
        </html>
    `);
    printWindow.document.close();
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
    globalThis.getSubjectScoreByTrimester = function(...args) {
        let score = _orig_getSubjectScoreByTrimester(...args);
        let targetSub = args[1] ? args[1].toString().trim() : '';
        if (score !== null && score !== undefined && (targetSub === 'رياضة' || targetSub.includes('بدنية') || targetSub.includes('رياضية'))) {
            let num = typeof score === 'string' ? parseFloat(score.replace(',', '.')) : parseFloat(score);
            if (num === 0 || isNaN(num)) return null; 
        }
        return score;
    }
}
