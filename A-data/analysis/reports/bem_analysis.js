// 1. Load Data

let studentsData = [];

function getStudentYear(s) {
    return (s && (s.academic_year || s.schoolYear || s.year || s.school_year || '')) || '';
}

// Order of subjects for display - Short names

const orderedSubjects = [

    'عربية', 'أمازيغية', 'فرنسية', 'انجليزية',

    'اسلامية', 'مدنية', 'تاريخ',

    'رياضيات', 'علوم', 'فيزياء',

    'معلوماتية', 'ت.تشكيلية', 'موسيقى', 'رياضة'

];

// Map for subject matching

const subjectAliases = {

    'عربية': ['اللغة العربية', 'ادب عربي', 'لغة عربية', 'العربية', 'اللغة العربية وآدابها'],

    'أمازيغية': ['اللغة الأمازيغية', 'امازيغية', 'الأمازيغية'],

    'فرنسية': ['اللغة الفرنسية', 'لغة فرنسية', 'الفرنسية'],

    'انجليزية': ['اللغة الإنجليزية', 'لغة انجليزية', 'إنجليزي', 'الانجليزية'],

    'اسلامية': ['التربية الإسلامية', 'علوم اسلامية', 'شريعة', 'الاسلامية', 'العلوم الإسلامية', 'العلوم الاسلامية'],

    'مدنية': ['التربية المدنية', 'المدنية'],

    'تاريخ': ['تاريخ وجغرافيا', 'اجتماعيات', 'التاريخ', 'الجغرافيا', 'التاريخ والجغرافيا', 'التاريخ و الجغرافيا'],

    'رياضيات': ['الرياضيات'],

    'علوم': ['العلوم الطبيعية', 'علوم طبيعية', 'الطبيعة', 'الحياة', 'العلوم', 'علوم الطبيعة والحياة', 'العلوم الطبيعة والحياة'],

    'فيزياء': ['الفيزياء', 'علوم فيزيائية', 'الفيزيائية', 'تكنولوجيا'],

    'معلوماتية': ['اعلام الي', 'المعلوماتية', 'الإعلام الآلي', 'الاعلام الالي', 'إعلام آلي'],

    'ت.تشكيلية': ['التربية التشكيلية', 'فنون تشكيلية', 'التشكيلية', 'فنية', 'رسم', 'التربية الفنية'],

    'موسيقى': ['التربية الموسيقية', 'الموسيقية'],

    'رياضة': ['التربية البدنية', 'رياضة بدنية', 'بدنية', 'الرياضية', 'ت البدنية', 'تربية بدنية', 'الرياضة', 'ت البدنية والرياضية', 'ت البدنية و الرياضية']

};

let subjects = [];

let exemptSubjects = {};

let institutionSettings = {};

let signatureSettings = {};

function getTrialPrintBlockedMessage() {
    return (typeof Auth !== 'undefined' && typeof Auth.getBlockedMessage === 'function')
        ? Auth.getBlockedMessage('print')
        : 'الطباعة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.';
}

function isPrintRestrictedForCurrentUser() {
    return typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted();
}

function blockTrialPrint() {
    if (!isPrintRestrictedForCurrentUser()) return false;

    Swal.fire({
        icon: 'warning',
        title: 'تنبيه',
        text: getTrialPrintBlockedMessage()
    });
    return true;
}

function applyPrintAccessState() {
    const isRestricted = isPrintRestrictedForCurrentUser();
    const message = getTrialPrintBlockedMessage();

    document.querySelectorAll('[data-print-premium="true"]').forEach(btn => {
        btn.disabled = isRestricted;
        btn.style.opacity = isRestricted ? '0.6' : '';
        btn.style.cursor = isRestricted ? 'not-allowed' : '';
        btn.title = isRestricted ? message : '';
        btn.setAttribute('aria-disabled', isRestricted ? 'true' : 'false');
    });
}

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

        'ama': ['أمازيغية', 'اللغة الأمازيغية', 'الأمازيغية', 'اللغة اï»·مازيغية', 'اï»·مازيغية']

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

    // populateFilters(); // Removed

    // Filters removed from UI

    // document.getElementById('trimesterSelect').addEventListener('change', applyFilters);

    // document.getElementById('levelSelect').addEventListener('change', applyFilters);

    applyFilters();
    applyPrintAccessState();

});

function normalizeArabic(text) {

    if (!text) return "";

    return text.toString()
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()

        .replace(/^ال/g, '') // Remove Al- prefix

        .replace(/[أإآ]/g, 'ا')

        .replace(/ة/g, 'ه')

        .replace(/ى/g, 'ي')
        .replace(/ﻷ|ﻹ|ﻵ|ﻻ/g, 'لا')
        .replace(/لأ|لإ|لآ/g, 'لا')
        .replace(/\s+/g, ' ');

}

function cleanText(text) {

    if (!text) return "";

    // Only remove Al- at start of words to avoid damaging names like "Kamal"

    return normalizeArabic(text).replace(/[\s\._\-]/g, '').replace(/^ال| ال/g, '');

}

// ... existing code ...

async function saveManualMatches() {

    // Ensure we have the latest storage state

    manualStudentMatches = await DB.get('manualStudentMatches') || {};

    unmatchedStudents.forEach((student, index) => {

        const genderSelect = document.getElementById(`fix_gender_${index}`);

        const classSelect = document.getElementById(`fix_class_${index}`);

        // Safety check if elements exist

        if (!genderSelect || !classSelect) return;

        const gender = genderSelect.value;

        const cls = classSelect.value;

        const uniqueId = student.id;

        if (gender && cls && uniqueId) {

            manualStudentMatches[uniqueId] = {

                gender: gender,

                level: 'رابعة',

                class: cls

            };

        }

    });

    await DB.set('manualStudentMatches', manualStudentMatches);

    showNotification('تم حفٍ التصحيحات بنجاح! جاري تحديث الصفحة...', 'success');

    closeFixModal();

    // FORCE RELOAD to ensure clean state

    setTimeout(() => {

        location.reload();

    }, 1000);

}

function _orig_getSubjectScore(student, shortSubjectName) {

    if (!student.marks) return null;

    const aliasList = subjectAliases[shortSubjectName] || [];

    const keys = Object.keys(student.marks);

    const targetClean = cleanText(shortSubjectName);

    // Helper to check if a key matches the subject (direct or alias)

    const isMatch = (key) => {

        const normKey = cleanText(key);

        // FORCE EXACT MATCHING to prevent "علوم فيزيائية" matching "علوم"

        if (normKey === targetClean) return true;

        // Alias match

        return aliasList.some(alias => cleanText(alias) === normKey);

    };

    // 1. Priority: Explicit suffix match for SELECTED trimester (Defaulting to Annual/General context if no trimester selected)

    // Since filters are removed, we prioritize "Annual" or the main "Average"

    // However, subject scores might still have trimester prefixes in the keys.

    // We will try to find the best match.

    // IF we are in "Certificate" mode, we usually want the key without a trimester suffix if possible,

    // or we assume the data loaded IS the certificate data.

    // Let's look for keys that DO NOT match trimesters 1, 2, 3 first (General/Annual)

    // or just the simple match.

    let bestMatchKey = keys.find(k => {

        const normKey = normalizeArabic(k);

        return isMatch(k) && !/ف\s*[1-3]/.test(normKey) && !/فصل\s*[1-3]/.test(normKey);

    });

    if (!bestMatchKey) {

        // Fallback: Check if there's ANY match

        bestMatchKey = keys.find(k => isMatch(k));

    }

    return bestMatchKey ? student.marks[bestMatchKey] : null;

}

async function loadData() {
    // 1. Load Certificate Results
    studentsData = await DB.get('certificateResults') || [];

    // 2. Load School Results for Gender Matching
    let rawResults = await DB.getResults(true) || [];

    // Deduplicate and Merge School Data (Handles multiple trimesters/files)
    const studentMap = new Map();
    for (const student of rawResults) {
        const cleanStr = (s) => normalizeArabic(s || '').replace(/\s+/g, '');
        const normSection = (s) => (s || '').toString().trim().replace(/^0+/, '') || "1";

        const normName = cleanStr(student.name);
        const normDob = (student.dob || '').toString().trim().split('T')[0];
        const normClass = normSection(student.class);
        const normLevel = cleanStr(student.level);
        const normStream = cleanStr(student.stream);
        const normAcademicYear = cleanStr(getStudentYear(student));

        const uniqueKey = `${normAcademicYear}|${normName}|${normDob}|${normClass}|${normLevel}|${normStream}`;

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
                dob: (student.dob || '').trim()
            };
            studentMap.set(uniqueKey, targetStudent);
        }

        // Merge Marks
        if (student.marks) {
            Object.assign(targetStudent.marks, student.marks);
        }
    }
    const mergedSchoolResults = Array.from(studentMap.values());

    // 2.1 Load Exempt Subjects
    exemptSubjects = await DB.get('exemptSubjects') || {};

    // 2.2 Load Global Settings
    institutionSettings = await DB.getSettings() || {};
    signatureSettings = await DB.get('signatureSettings') || {};

    // 3. Resolve Genders from Merged School Results
    if (studentsData.length > 0) {
        if (mergedSchoolResults.length > 0) {
            resolveStudentGenders(studentsData, mergedSchoolResults);
        } else {
            // Warn if no school data found for matching
            setTimeout(() => {
                showNotification("تنبيه: لا توجد نتائج فصلية للقسم 4 متوسط لمطابقة الجنس والأقسام. يرجى استيراد نتائج الفصل الثالث لإكمال الإحصائيات.", 'warning', 15000);
            }, 1000);
        }
    }

    // RE-RENDER UI
    applyFilters();

    // Disable import button if secondary
    if (institutionSettings.educationStage === 'secondary' || institutionSettings.educationStage === 'lycee') {
        const btn = document.getElementById('importBtn');
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
            btn.title = "غير متاح للطور الثانوي حالياً";
            btn.innerHTML = "📥 استيراد النتائج (قريباً)";
        }
    }
}

// AUTO-MATCHING LOGIC: 2-Step Process (Name+DOB -> DOB Only)

function resolveStudentGenders(certData, schoolData) {

    // Helper to safe get date string

    const getDobStr = (dob) => {

        if (!dob) return "";

        if (typeof dob === 'string') return dob.split('T')[0].trim();

        return String(dob).trim();

    };

    // 1. Prepare Pool of Available School Students (Level 4)

    // We add an 'id' or 'used' flag to track consumption

    const schoolPool = [];

    schoolData.forEach((s, idx) => {

        if (s.level && (s.level.includes('4') || s.level.includes('رابعة'))) {

            if (s.gender && s.gender !== "غير محدد") {

                schoolPool.push({

                    original: s,

                    cleanName: cleanText(s.name),

                    cleanDob: getDobStr(s.dob), // Using same helper for consistency

                    used: false

                });

            }

        }

    });

    // 2. PASS 1: Strict Match (Name + DOB)

    certData.forEach(s => {

        // Initialize default level 'رابعة' immediately

        if (!s.level || (!s.level.includes('4') && !s.level.includes('رابعة'))) {

            s.level = 'رابعة';

        }

        try {

            const certName = cleanText(s.name);

            const certDob = getDobStr(s.dob);

            // Find match in pool that is NOT used

            const matchIndex = schoolPool.findIndex(p =>

                !p.used &&

                p.cleanName === certName &&

                p.cleanDob === certDob

            );

            if (matchIndex !== -1) {

                // strict match found

                const match = schoolPool[matchIndex];

                s.gender = match.original.gender;

                s.level = match.original.level;

                s.class = match.original.class;

                // Mark as used

                schoolPool[matchIndex].used = true;

                s.matched = true; // Flag for internal tracking

            } else {

                s.matched = false;

            }

        } catch (e) {

            console.error("Error in Pass 1", e);

            s.matched = false;

        }

    });

    // 3. PASS 2: Loose Match (DOB Only) for remaining unmatched

    certData.forEach(s => {

        if (s.matched) return; // Skip already matched

        try {

            const certDob = getDobStr(s.dob);

            // If DOB is empty, we can't match safely

            if (!certDob) {

                s.gender = "غير محدد";

                return;

            }

            // Find match in remaining pool

            const matchIndex = schoolPool.findIndex(p =>

                !p.used &&

                p.cleanDob === certDob

            );

            if (matchIndex !== -1) {

                // DOB match found

                const match = schoolPool[matchIndex];

                s.gender = match.original.gender;

                s.level = match.original.level;

                s.class = match.original.class;

                // Mark as used

                schoolPool[matchIndex].used = true;

                s.matched = true;

            } else {

                // Final Fallback: No match found

                s.gender = "غير محدد";

            }

        } catch (e) {

            console.error("Error in Pass 2", e);

            s.gender = "غير محدد";

        }

    });

}

/* OLD LOGIC DISABLED

    // Helper to safe get date string

    const getDobStr = (dob) => {

        if (!dob) return "";

        if (typeof dob === 'string') return dob.split('T')[0].trim();

        return String(dob).trim();

    };

    // 1. Build Lookup Maps

    const primaryMap = {}; // key: cleanFullName_cleanDOB -> { gender, level, class }

    const fallbackMap = {}; // key: cleanFirstWord_cleanDOB -> { gender, level, class, conflict: bool }

    schoolData.forEach(s => {

        // Only consider level 4 students

        if (s.level && (s.level.includes('4') || s.level.includes('رابعة'))) {

            const fullNameClean = cleanText(s.name);

            const firstWordClean = fullNameClean.split(' ')[0];

            const dobKey = getDobStr(s.dob);

            if (s.gender && s.gender !== "غير محدد") {

                // Primary Map

                primaryMap[`${fullNameClean}_${dobKey}`] = {

                    gender: s.gender,

                    level: s.level,

                    class: s.class

                };

                // Fallback Map: Track if first word + dob is unique to ONE gender/class combo

                const fKey = `${firstWordClean}_${dobKey}`;

                if (!fallbackMap[fKey]) {

                    fallbackMap[fKey] = {

                        gender: s.gender,

                        level: s.level,

                        class: s.class,

                        conflict: false

                    };

                } else {

                    if (fallbackMap[fKey].gender !== s.gender || fallbackMap[fKey].class !== s.class) {

                        fallbackMap[fKey].conflict = true;

                    }

                }

            }

        }

    });

    // 2. Match Cert Data

    certData.forEach(s => {

        try {

            // Default Level for BEM is always 4th year if not present

            if (!s.level) s.level = '4 متوسط';

            const fullNameClean = cleanText(s.name);

            const firstWordClean = fullNameClean.split(' ')[0];

            const dobKey = getDobStr(s.dob);

            const uniqueId = `${fullNameClean}_${dobKey}`;

            // 2.1 First Check Manual Matches

            if (manualStudentMatches[uniqueId]) {

                const match = manualStudentMatches[uniqueId];

                s.gender = match.gender;

                s.level = match.level || s.level;

                s.class = match.class || s.class;

            }

            // 2.2 Check Primary Map

            else if (primaryMap[uniqueId]) {

                const match = primaryMap[uniqueId];

                s.gender = match.gender;

                s.level = match.level || s.level;

                s.class = match.class || s.class;

            }

            // 2.3 Check Fallback Map

            else if (fallbackMap[fKey] && !fallbackMap[fKey].conflict) {

                const match = fallbackMap[fKey];

                s.gender = match.gender;

                s.level = match.level || s.level;

                s.class = match.class || s.class;

            } else {

                // Mismatch

                s.gender = "غير محدد";

                unmatchedStudents.push({ ...s, id: uniqueId });

            }

            // FINAL SAFETY CHECK: Ensure Level is valid for display

            // If level is missing OR doesn't contain '4' or 'رابعة', Force it.

            if (!s.level || (!s.level.includes('4') && !s.level.includes('رابعة'))) {

                s.level = 'رابعة';

            }

        } catch (err) {

            console.error("Error matching student:", s.name, err);

            // Fallback for safety

            s.gender = "غير محدد";

            if (!s.level) s.level = 'رابعة';

            unmatchedStudents.push({ ...s, id: s.name || 'unknown' });

        }

    });

*/

function populateFilters() {

    // No UI filters to populate

}

// Trimester Mapping

const trimesterMap = {

    '1': 'الأول',

    '2': 'الثاني',

    '3': 'الثالث'

};

function applyFilters() {

    // FIXED: Always Year 4 for Certificate Analysis - Be inclusive of variations

    const levelData = studentsData.filter(s => s.level && (s.level.includes('4') || s.level.includes('رابعة')));

    const certLevel = "الرابعة متوسط"; // Label for display

    let activeSubjects = [...subjects];

    activeSubjects = activeSubjects.filter(sub => sub !== 'معلوماتية');

    renderLevelDashboard(levelData, activeSubjects, certLevel);

}

function showNotification(msg, type) {

    showToast(msg, type);

}

function showToast(message, type = 'success') {

    const container = document.getElementById('toastContainer');

    if (!container) return;

    const toast = document.createElement('div');

    toast.className = `toast ${type}`;

    const icon = type === 'error' ? 'âڑ ï¸ڈ' : 'âœ¨';

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

        }, 5000);

    }, 4000);

}

function renderLevelDashboard(data, activeSubjects, levelName) {

    // Update Header

    const headerH3 = document.querySelector('header h3');

    // We can interpret the page title or reuse existing elements.

    // Since we removed filters, we might want to display the detected level somewhere.

    // For now we pass it to the print function or similar.

    if (!data || data.length === 0) {

        document.getElementById('generalStatsBody').innerHTML = '<tr><td colspan="5">لا توجد بيانات</td></tr>';

        return;

    }

    renderGeneralStats(data);

    renderTransitionStats(data); // Added call to populate transition stats

    renderChart(data);

    renderSubjectTable(data, activeSubjects);

    renderTopStudents(data);

    renderClassesBreakdown(data, activeSubjects);

    // Update global var/attr for print to know the level

    document.body.setAttribute('data-current-level', levelName);

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

        // FIXED: Use BEM Average for Certificate Stats

        const getBemAvg = (s) => (s.averages && s.averages.bem !== undefined) ? Number(s.averages.bem) : (getStudentAverage(s) || 0);

        const passed = row.data.filter(s => getBemAvg(s) >= 10).length;

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

// 2.5 General Stats - Transition

function renderTransitionStats(data) {

    const tbody = document.getElementById('transitionStatsBody');

    if (!tbody) return;

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

        // USE TRANSITION AVERAGE

        const getTransAvg = (s) => (s.averages && s.averages.transition !== undefined) ? Number(s.averages.transition) : 0;

        const passed = row.data.filter(s => getTransAvg(s) >= 10).length;

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

// 3. Subject Stats

function renderSubjectTable(data, activeSubjects) {

    const tbody = document.getElementById('subjectStatsBody');

    let html = '';

    // Filter subjects that have data (ignore empty columns)

    const subjectsWithData = activeSubjects.filter(sub => {

        // Check if AT LEAST ONE student has a valid mark for this subject

        return data.some(s => {

            const val = getSubjectScore(s, sub);

            return val !== null && val !== undefined && val !== "";

        });

    });

    subjectsWithData.forEach((sub, index) => {

        const scores = data.map(s => getSubjectScore(s, sub)).filter(m => m !== null && m !== undefined && m !== "");

        // Double check not empty

        if (scores.length === 0) return;

        const passed = scores.filter(s => s >= 10).length;

        const failed = scores.length - passed;

        const subAvg = (scores.reduce((a, b) => a + Number(b), 0) / scores.length).toFixed(2);

        const rate = scores.length > 0 ? ((passed / scores.length) * 100).toFixed(2) : 0;

        const rateStyle = rate < 50 ? 'background-color: #fadbd8; color: #c0392b;' : '';

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

    // FIXED: Use BEM Average

    const getBemAvg = (s) => (s.averages && s.averages.bem !== undefined) ? Number(s.averages.bem) : (getStudentAverage(s) || 0);

    const top = [...data].sort((a, b) => getBemAvg(b) - getBemAvg(a)).slice(0, 30);

    let html = '';

    top.forEach((s, index) => {

        html += `

            <tr>

                <td>${index + 1}</td>

                <td>${s.name}</td>

                <td>${s.dob ? s.dob.split('T')[0] : '-'}</td>

                <td>${s.level}</td>

                <td style="font-weight:bold;">${getBemAvg(s).toFixed(2)}</td>

            </tr>

        `;

    });

    tbody.innerHTML = html;

}

// 5. Classes Breakdown

function renderClassesBreakdown(data, activeSubjects) {

    const container = document.getElementById('classesBreakdown');

    container.innerHTML = '<h3 style="grid-column: 1/-1; margin-top: 20px; border-right: 5px solid var(--secondary-color); padding-right: 15px;">ًں“‹ التحليل التفصيلي حسب الأقسام</h3>';

    const classes = [...new Set(data.map(s => s.class))].filter(c => c && c !== "نتائج الشهادة" && c !== "غير محدد").sort();

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

            const subRate = scores.length > 0 ? ((subPassCount / scores.length) * 100).toFixed(2) : 0;

            subjectAvgs += `<td style="background:#eaf2f8;">${subAvg}</td>`;

            subjectRates += `<td style="font-weight:bold; color:${subRate >= 50 ? '#27ae60' : '#e74c3c'}; background:var(--bg-color);">${subRate}%</td>`;

        });

        const card = document.createElement('div');

        card.className = 'card class-card';

        card.style.marginBottom = '25px';

        card.style.borderTop = '4px solid var(--secondary-color)';

        card.innerHTML = `

            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:12px;">

                <h4 style="margin:0; color:var(--primary-color);">🏫 القسم: ${cls}</h4>

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

                            ${subjectHeaders}

                            <th style="min-width:60px; padding:8px;">م.القسم</th>

                        </tr>

                    </thead>

                    <tbody>

                        <tr style="border-bottom: 2px solid #bdc3c7;">

                            <td style="font-weight:bold; background:#d6eaf8; color:#2471a3;">المعدل</td>

                            ${subjectAvgs}

                            <td style="font-weight:bold; background:#aed6f1; color:#1a5276;">${classAvg}</td>

                        </tr>

                        <tr>

                            <td style="font-weight:bold; background:#d5f5e3; color:#1e8449;">النسبة</td>

                            ${subjectRates}

                            <td style="font-weight:bold; background:#a9dfbf; color:#145a32;">${rate}%</td>

                        </tr>

                    </tbody>

                </table>

            </div>

        `;

        container.appendChild(card);

    });

}

// Print Level Report to New Tab

function printLevelReport() {

    printLevelReportToNewTab();

}

function printLevelReportToNewTab() {
    if (blockTrialPrint()) return;

    const printWindow = window.open('', '_blank');

    // 1. (Chart removed from print as per request)

    let chartImgHtml = '';

    // 2. Get Layout Elements

    // General Stats (BEM)

    // Selector for the first card in the stats-row

    const generalStatsCard = document.querySelector('.stats-row .card:first-child');

    const generalStatsTable = generalStatsCard.querySelector('table').outerHTML;

    const generalStatsTitle = generalStatsCard.querySelector('h3').innerText;

    // Transition Stats

    const transitionStatsCard = document.querySelector('.stats-row .card:nth-child(2)');

    const transitionStatsTable = transitionStatsCard.querySelector('table').outerHTML;

    const transitionStatsTitle = transitionStatsCard.querySelector('h3').innerText;

    // Subject Stats (now in a card AFTER the chart container card)

    // Structure: .stats-row, then .chart-container, then Subject Stats card, then Top Students

    // Best to select by content content or unique ID if available, or just index carefully

    // The subject stats table is in the card following the chart container

    const subjectStatsCard = document.querySelector('.level-dashboard > .card:nth-of-type(2)');

    // Wait, let's look at HTML structure:

    // .stats-row (child 1)

    // .chart-container (child 2)

    // .card (Subject Stats - child 3)

    // .card (Top Students - child 4)

    // Actually, simpler to select by unique content features or just use a more robust selector

    const subjectStatsElement = Array.from(document.querySelectorAll('.card h3')).find(h => h.innerText.includes('المواد'));

    const subjectStatsTableHTML = subjectStatsElement ? subjectStatsElement.parentElement.querySelector('table').outerHTML : '';

    const subjectStatsTitleHTML = subjectStatsElement ? subjectStatsElement.innerText : 'إحصائيات المواد';

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

    // Remove titles if duplicated

    classesClone.querySelectorAll('h3').forEach(h => h.remove());

    const classesHtml = classesClone.innerHTML;

    // 3. Header & Footer Data

    const settings = institutionSettings;

    // const selectedLevel = document.getElementById('levelSelect').value; // Removed

    const selectedLevel = document.body.getAttribute('data-current-level') || 'الرابعة متوسط'; // Fallback

    // const selectedTrimesterVal = document.getElementById('trimesterSelect').value; // Removed

    const schoolYear = settings.schoolYear || '2025/2024';

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // 4. Construct HTML

    const headerHtml = `

        <div class="report-header" style="flex-direction: column; align-items: center; margin-bottom: 20px;">

            <div style="text-align: center; margin-bottom: 10px;">

                <h3 style="margin: 2px 0; font-size: 12pt;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                <h3 style="margin: 2px 0; font-size: 12pt;">وزارة التربية الوطنية</h3>

            </div>

            <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">

                <div style="text-align: right;">

                    <div>مديرية التربية لولاية ${settings.wilaya || '.......'}</div>

                    <div>المؤسسة: ${settings.institutionName || '.......'}</div>

                </div>

                <div style="text-align: left;">

                    <div>البلدية: ${settings.municipality || '.......'}</div>

                    <div>السنة الدراسية: ${settings.schoolYear || '2025/2026'}</div>

                </div>

            </div>

            <div style="text-align: center; margin-top: 10px; width: 100%;">

                <h2 style="margin: 5px 0; border: 2px solid #000; padding: 5px 15px; display: inline-block; border-radius: 5px;">

                    تحليل نتائج شهادة التعليم المتوسط

                </h2>

                <h3 style="margin: 5px 0;">المستوى: ${selectedLevel}</h3>

            </div>

        </div>

    `;

    // Get signer info from signature settings

    const sigSettings = signatureSettings;

    const reportConfig = sigSettings.reportSettings?.['bem_analysis'] || { signer: 'director', showSignature: true };

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
            <div class="footer-left" style="text-align: center;">
                <div style="margin-bottom: 5px;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
                <div>${signerTitle}</div>
            </div>
        </div>
    `;

    // Page 1 Content: General Stats, Transition, Subjects

    const page1Html = `

        <div class="print-page">

            ${headerHtml}

            <div style="display: flex; gap: 20px; justify-content: space-between; margin-bottom: 20px;">

                <div style="flex: 1;">

                    <div class="section-title">${generalStatsTitle}</div>

                    <div class="table-container">

                        ${generalStatsTable}

                    </div>

                </div>

                <div style="flex: 1;">

                    <div class="section-title">${transitionStatsTitle}</div>

                    <div class="table-container">

                        ${transitionStatsTable}

                    </div>

                </div>

            </div>

            <div class="section-title" style="margin-top: 20px;">${subjectStatsTitleHTML}</div>

            <div class="table-container">

                ${subjectStatsTableHTML}

            </div>

            ${footerHtml}

        </div>

    `;

    // Page 2 Content: Top Students

    const page2Html = `

        <div class="print-page top-students-page">

            <!-- No Header for this page as requested -->

            <div class="section-title" style="margin-top: 20px;">${topStudentsTitle}</div>

            <div class="table-container">

                ${topStudentsTable}

            </div>

            ${footerHtml}

        </div>

    `;

    // Page 3 Content: Classes Breakdown (NO HEADER)

    const page3Html = `

        <div class="print-page">

            <!-- No Header for this page as requested -->

            <div class="section-title">النتائج التفصيلية حسب الأقسام</div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 15px;">

                ${classesHtml}

            </div>

            ${footerHtml}

        </div>

    `;

    // Write to New Window

    printWindow.document.write(`

        <!DOCTYPE html>

        <html dir="rtl" lang="ar">

        <head>

            <title>تحليل نتائج الشهادة - ${selectedLevel}</title>

            <style>

                body {

                    font-family: 'Tajawal', sans-serif;

                    padding: 20px;

                    direction: rtl;

                }

                /* Page Break Settings */

                .print-page {

                    page-break-after: always;

                    border: 1px solid #eee; /* Light border for preview */

                    padding: 20px;

                    margin-bottom: 20px;

                    position: relative;

                }

                .print-page:last-child {

                    page-break-after: auto;

                }

                .section-title {

                    font-size: 14pt;

                    font-weight: bold;

                    margin-bottom: 5px;

                    border-bottom: 2px solid var(--secondary-color);

                    padding-bottom: 5px;

                    color: var(--primary-color);

                }

                .table-container {

                    margin-bottom: 15px;

                }

                table {

                    width: 100%;

                    border-collapse: collapse;

                    font-size: 10pt;

                }

                th, td {

                    border: 1px solid #000;

                    padding: 5px;

                    text-align: center;

                }

                .top-students-page th, .top-students-page td {

                    padding: 2px;

                }

                th {

                    background-color: #f2f2f2;

                }

                /* Layout Grid for Print */

                .stats-grid {

                    display: grid;

                    grid-template-columns: 1fr 1fr;

                    gap: 15px;

                }

                /* Class Cards */

                .class-card {

                    break-inside: avoid;

                    page-break-inside: avoid;

                    border: 1px solid #ccc;

                    padding: 10px;

                    margin-bottom: 15px;

                }

                .class-card h4 {

                    margin-top: 0;

                    border-bottom: 1px solid #eee;

                    padding-bottom: 5px;

                }

                /* Header/Footer */

                .report-header, .report-footer {

                    display: flex;

                    justify-content: space-between;

                    width: 100%;

                }

                .report-footer {

                    margin-top: 30px;

                    border-top: 1px solid #000;

                    padding-top: 10px;

                }

                @page {

                    size: A4;

                    margin: 1cm;

                }

                @media print {

                    body { padding: 0; }

                    .print-page { border: none; margin: 0; padding: 0; }

                    /* Ensure backgrounds print */

                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

                }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}

            ${page1Html}

            ${page2Html}

            ${page3Html}

            <script>

                // window.onload auto-print removed

            </script>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

}

// Helper for dynamic average based on selected trimester

function getStudentAverage(student) {

    // For Certificate Analysis, we look for "Moyenne BEM" or "Annual Average" or just "Average"

    // Since we don't have a selector, we just grab the main average field.

    // 1. Try "BEM" (Certificate) first for this page.

    if (student.averages && student.averages['bem'] !== undefined) return parseFloat(student.averages['bem']);

    if (student.averages && student.averages['annual'] !== undefined) return parseFloat(student.averages['annual']);

    // 2. Use the main average field

    return parseFloat(student.average) || 0;

}

// ==========================================

// Certificate Import Logic

// ==========================================

function triggerImport() {
    // Check if stage is secondary
    if (institutionSettings.educationStage === 'secondary' || institutionSettings.educationStage === 'lycee') {
        showNotification("استيراد نتائج الشهادة غير متاح للطور الثانوي حالياً (سيتم تفعيله لاحقاً).", 'warning');
        return;
    }

    const input = document.getElementById('certFileInput');

    if (input) input.click();

}

async function handleCertificateImport(event) {

    const file = event.target.files[0];

    if (!file) return;

    try {

        const buffer = await file.arrayBuffer();

        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        if (!sheet['!ref']) {

            showNotification("الملف فارغ أو غير صالح.", 'error');

            return;

        }

        // 1. Locate Header Row (Scan first 20 rows)

        let headerRowIndex = -1;

        // Updated target based on user input

        const targetHeader = "اللقب و الإسم";

        const range = XLSX.utils.decode_range(sheet['!ref']);

        // Scan rows for the key column

        for (let R = range.s.r; R <= Math.min(range.e.r, 20); ++R) {

            for (let C = range.s.c; C <= range.e.c; ++C) {

                const cell = sheet[XLSX.utils.encode_cell({ c: C, r: R })];

                if (cell && cell.v) {

                    const val = cell.v.toString().trim();

                    // Normalize spaces too just in case

                    if (normalizeArabic(val).replace(/\s+/g, '') === normalizeArabic(targetHeader).replace(/\s+/g, '')) {

                        headerRowIndex = R;

                        break;

                    }

                }

            }

            if (headerRowIndex !== -1) break;

        }

        if (headerRowIndex === -1) {

            showNotification("لم يتم العثور على سطر العناوين (يجب أن يحتوي على 'اللقب و الإسم').", 'error');

            return;

        }

        // 2. Read Headers from identified row

        const headers = [];

        for (let C = range.s.c; C <= range.e.c; ++C) {

            const cell = sheet[XLSX.utils.encode_cell({ c: C, r: headerRowIndex })];

            headers.push(cell ? cell.v.toString().trim() : "");

        }

        // Required headers mapping - UPDATED based on user input

        const requiredMap = {

            "اللقب و الإسم": "name",

            "تاريخ الميلاد": "dob",

            "المعدل السنوي": "annual_avg",

            "معدل ش ت م": "bem_avg",

            "معدل الإنتقال": "trans_avg",

            "رياضيات": "math", "رياضيات ش ت م": "math_bem",

            "العربية": "arab", "العربية ش ت م": "arab_bem",

            "الفرنسية": "fr", "الفرنسية ش ت م": "fr_bem",

            "الإنجليزية": "eng", "الإنجليزية ش ت م": "eng_bem",

            "الأمازيغية": "ama", "الأمازيغية ش ت م": "ama_bem",

            "ت إسلامية": "isl", "ت إسلامية ش ت م": "isl_bem",

            "ت مدنية": "civ", "ت مدنية ش ت م": "civ_bem",

            "تاريخ جغرافيا": "his", "تاريخ جغرافيا ش ت م": "his_bem",

            "علوم ط": "sci", "العلوم": "sci", "علوم": "sci", "علوم ط ش ت م": "sci_bem", "العلوم ش ت م": "sci_bem",

            "فيزياء": "phy", "الفيزياء": "phy", "فيزياء ش ت م": "phy_bem", "الفيزياء ش ت م": "phy_bem", "علوم فيزيائية ش ت م": "phy_bem", "فيزياء تكنولوجيا ش ت م": "phy_bem", "ف ت م": "phy_bem", "الفيزياء و التكنولوجيا": "phy",

            "معلوماتية": "info", "معلوماتية ش ت م": "info_bem",

            "ت تشكيلية": "art", "التربية التشكيلية": "art", "ت تشكيلية ش ت م": "art_bem", "التربية التشكيلية ش ت م": "art_bem",

            "ت موسيقية": "mus", "التربية الموسيقية": "mus", "ت موسيقية ش ت م": "mus_bem",

            "ت بدنية": "sport", "التربية البدنية": "sport", "ت بدنية ش ت م": "sport_bem", "التربية البدنية ش ت م": "sport_bem", "رياضة ش ت م": "sport_bem"

        };

        // Helper: Find index using global cleanText (handles spaces/dots/AL- prefix)

        const findColumnIndex = (reqName) => {

            const target = cleanText(reqName);

            return headers.findIndex(h => cleanText(h) === target);

        };

        // Verify existence

        const missing = [];

        const colIndexMap = {};

        Object.keys(requiredMap).forEach(reqTitle => {

            const index = findColumnIndex(reqTitle);

            // Relaxed check: Only "name" is strictly required to start, others we can warn or skip?

            // User requested robust import. If critical columns are missing, we stop.

            // Let's keep strict check but with fuzzy matching.

            if (index === -1) {

                missing.push(reqTitle);

            } else {

                colIndexMap[requiredMap[reqTitle]] = index;

            }

        });

        if (missing.length > 0) {

            // Some columns might be truly optional? For BEM, usually subjects are fixed.

            // But sometimes 'الأمازيغية' is missing if not taught.

            // Let's make subjects optional if missing, but Name/Avg mandatory.

            const mandatory = ["اللقب و الإسم", "المعدل السنوي", "معدل ش ت م"];

            const missingMandatory = missing.filter(m => mandatory.some(mand => cleanText(mand) === cleanText(m)));

            if (missingMandatory.length > 0) {

                showNotification(`فشل: أعمدة إجبارية مفقودة(${missingMandatory.join(', ')})`, 'error');

                Swal.fire({
                    icon: 'error',
                    title: 'فشل الاستيراد',
                    html: `الأعمدة الإجبارية التالية مفقودة:<br>${missingMandatory.join('<br>')}<br><br>الأعمدة المعثور عليها:<br>${headers.filter(h => h).join(', ')}`
                });

                return;

            } else {

                // Warning only

                console.warn("Missing optional columns:", missing);

            }

        }

        // Extract Data (Start from row after header)

        const parsedStudents = [];

        const processedIds = new Set();

        for (let R = headerRowIndex + 1; R <= range.e.r; ++R) {

            const getVal = (key) => {

                const colIdx = colIndexMap[key];

                if (colIdx === undefined) return null;

                const cell = sheet[XLSX.utils.encode_cell({ c: colIdx, r: R })];

                return cell ? cell.v : null;

            };

            const name = getVal('name');

            if (!name) continue;

            // Marks

            const marks = {};

            const setMark = (shortName, val) => {

                if (val !== null && val !== undefined) {

                    // Clean marks if string

                    if (typeof val === 'string') {

                        val = val.toString().trim().replace(',', '.');

                        if (val === "" || isNaN(parseFloat(val))) return; // Skip empty/text

                        val = parseFloat(val);

                    }

                    if (typeof val === 'number' && !isNaN(val)) {

                        marks[shortName] = val;

                    }

                }

            };

            // Mapping BEM marks to the displayed subject keys with fallback

            setMark('رياضيات', getVal('math_bem') ?? getVal('math'));

            setMark('عربية', getVal('arab_bem') ?? getVal('arab'));

            setMark('فرنسية', getVal('fr_bem') ?? getVal('fr'));

            setMark('انجليزية', getVal('eng_bem') ?? getVal('eng'));

            setMark('أمازيغية', getVal('ama_bem') ?? getVal('ama'));

            setMark('اسلامية', getVal('isl_bem') ?? getVal('isl'));

            setMark('مدنية', getVal('civ_bem') ?? getVal('civ'));

            setMark('تاريخ', getVal('his_bem') ?? getVal('his'));

            setMark('علوم', getVal('sci_bem') ?? getVal('sci'));

            setMark('فيزياء', getVal('phy_bem') ?? getVal('phy'));

            setMark('معلوماتية', getVal('info_bem') ?? getVal('info'));

            setMark('ت.تشكيلية', getVal('art_bem') ?? getVal('art'));

            setMark('موسيقى', getVal('mus_bem') ?? getVal('mus'));

            setMark('رياضة', getVal('sport_bem') ?? getVal('sport'));

            // Format averages

            const parseAvg = (v) => {

                if (typeof v === 'string') return parseFloat(v.replace(',', '.')) || 0;

                return v || 0;

            };

            const annualAvg = parseAvg(getVal('annual_avg'));

            const bemAvg = parseAvg(getVal('bem_avg'));

            const transAvg = parseAvg(getVal('trans_avg'));

            // Date formatting

            let dob = getVal('dob');

            if (typeof dob === 'number') {

                const date = new Date(Math.round((dob - 25569) * 86400 * 1000));

                dob = date.toISOString().split('T')[0];

            }

            const student = {

                id: R,

                name: name,

                dob: dob || "",

                gender: "غير محدد",

                level: "الرابعة متوسط",

                class: "نتائج الشهادة",

                marks: marks,

                averages: {

                    annual: annualAvg,

                    bem: bemAvg,

                    transition: transAvg

                },

                average: bemAvg, // Main display average

                trimester: "BEM"

            };

            parsedStudents.push(student);

        }

        if (parsedStudents.length === 0) {

            showNotification("لم يتم العثور على بيانات في الملف.", 'error');

            return;

        }

        // Save to Independent Storage

        await DB.set('certificateResults', parsedStudents);

        showNotification(`تم استيراد ${parsedStudents.length} تلميذ بنجاح!`, 'success');

        // Reload page to reflect changes

        setTimeout(() => location.reload(), 1000);

    } catch (e) {

        console.error(e);

        showNotification("حدث خطأ غير متوقع أثناء المعالجة.", 'error');

        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: "حدث خطأ أثناء قراءة الملف: " + e.message
        });

    }

}

function renderMismatchReport() {

    const container = document.getElementById('mismatchReportContainer');

    const tbody = document.getElementById('mismatchReportBody');

    const viewBtn = document.getElementById('viewMismatchesBtn');

    if (!container || !tbody) return;

    if (!mismatchReport || mismatchReport.length === 0) {

        container.style.display = 'none';

        if (viewBtn) viewBtn.style.display = 'none';

        return;

    }

    container.style.display = 'block';

    if (viewBtn) viewBtn.style.display = 'inline-block';

    let html = '';

    mismatchReport.forEach(s => {

        html += `

        < tr >

                <td>${s.name}</td>

                <td>${s.dob ? s.dob.split('T')[0] : '-'}</td>

                <td style="font-weight:bold;">${getStudentAverage(s).toFixed(2)}</td>

            </tr >

        `;

    });

    tbody.innerHTML = html;

}

function scrollToMismatches() {

    const container = document.getElementById('mismatchReportContainer');

    if (container) {

        container.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Optional: briefly highlight the container

        container.style.boxShadow = '0 0 20px rgba(231, 76, 60, 0.5)';

        setTimeout(() => {

            container.style.boxShadow = 'none';

        }, 2000);

    }

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
