/**

 * School Entry Preparation Page - تحضير الدخول المدرسي

 * Shows current situation and projected organization for next year

 */

let allStudents = [];

let resultsData = [];

let finalResultsData = [];

// Store user input for first year

let firstYearInput = { promoted: 0, promotedFemale: 0 };

// Store max class sizes

let maxClassSizes = { 1: 30, 2: 30, 3: 30, 4: 30 };

let institutionSettings = {};

let isSecondary = false;

// Level mapping

// Level mapping

let LEVELS = {

    1: 'أولى متوسط',

    2: 'ثانية متوسط',

    3: 'ثالثة متوسط',

    4: 'رابعة متوسط'

};

const trimesterNames = {

    '1': 'الفصل الأول',

    '2': 'الفصل الثاني',

    '3': 'الفصل الثالث',

    '1+2': 'معدل الفصلين (1 + 2)',

    'annual': 'المعدل السنوي'

};

// Initialize

document.addEventListener('DOMContentLoaded', async () => {

    await loadData();

    await loadSavedSettings();

    await loadProjectionInputs();

    // Load settings

    institutionSettings = await DB.getSettings() || {};

    isSecondary = institutionSettings.educationStage === 'secondary';

    // Update Constants and UI based on Stage

    if (isSecondary) {

        LEVELS = {

            1: 'أولى ثانوي',

            2: 'ثانية ثانوي',

            3: 'ثالثة ثانوي'

        };

        // Hide Max Class 4

        if (document.getElementById('maxClass4')) {

            document.getElementById('maxClass4').previousElementSibling.style.display = 'none'; // Label

            document.getElementById('maxClass4').style.display = 'none'; // Input

        }

        updateTableHeaders();

    }

    // Add event listener for trimester change

    document.getElementById('trimesterSelect').addEventListener('change', () => {

        checkTrimesterData();

        updateTables();

    });

    checkTrimesterData();

    updateTables();

});

/**

 * Load saved settings from storage

 */

async function loadSavedSettings() {

    // Load first year input

    const savedFirstYear = await DB.get('schoolEntryFirstYear');

    if (savedFirstYear) {

        firstYearInput = savedFirstYear;

    }

    // Load max class sizes

    const savedMaxClass = await DB.get('schoolEntryMaxClass');

    if (savedMaxClass) {

        maxClassSizes = savedMaxClass;

        // Update input fields

        document.getElementById('maxClass1').value = maxClassSizes[1] || 30;

        document.getElementById('maxClass2').value = maxClassSizes[2] || 30;

        document.getElementById('maxClass3').value = maxClassSizes[3] || 30;

        document.getElementById('maxClass4').value = maxClassSizes[4] || 30;

    }

}

/**

 * Save settings to storage

 */

async function saveSettings() {

    await DB.set('schoolEntryFirstYear', firstYearInput);

    await DB.set('schoolEntryMaxClass', maxClassSizes);

}

/**

 * Load students and results data

 */

async function loadData() {
    // Load student list
    allStudents = await DB.getStudents() || [];

    // Load results from schoolResults (same as class_analysis.js)
    let rawResults = await DB.getResults(true) || [];

    // Deduplicate and Merge Data (Handles multiple trimesters/files)
    const studentMap = new Map();
    for (const student of rawResults) {
        const cleanStr = (s) => (s || '').toString().trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, '');
        const normSection = (s) => (s || '').toString().trim().replace(/^0+/, '') || "1";

        const normName = cleanStr(student.name);
        const normDob = (student.dob || '').toString().trim().split('T')[0];
        const normClass = normSection(student.class);
        const normLevel = cleanStr(student.level);
        const normStream = cleanStr(student.stream);

        const uniqueKey = `${normName}|${normDob}|${normClass}|${normLevel}|${normStream}`;

        const getTrimesterValue = (name) => {
            const n = (name || '').toString().trim();
            if (n.includes('ثاني') || n.includes('2')) return '2';
            if (n.includes('ثالث') || n.includes('3')) return '3';
            return '1'; // Default
        };

        const tVal = getTrimesterValue(student.trimester);

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

        // Merge Averages
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
    resultsData = Array.from(studentMap.values());

    // Load annual results from the annual results table
    finalResultsData = await DB.getAnnualResults(false) || [];

    // Show alert if no results
    if (resultsData.length === 0) {
        document.getElementById('dataAlert').style.display = 'block';
        document.getElementById('dataAlert').innerHTML = '<span data-icon="warning"></span> <strong>تنبيه:</strong> لا توجد بيانات نتائج محفوظة. يرجى استيراد النتائج من صفحة <a href="../analysis/import_data.html" style="color: var(--secondary-color);">استيراد النتائج</a> أولا.';
    } else {
        document.getElementById('dataAlert').style.display = 'none';
    }
}

/**

 * Check if data exists for selected trimester

 */

function checkTrimesterData() {

    const selectedTrimester = document.getElementById('trimesterSelect').value;

    const alertDiv = document.getElementById('dataAlert');

    if (resultsData.length === 0) {

        if (selectedTrimester === 'annual' && finalResultsData && finalResultsData.length > 0) {

            alertDiv.style.display = 'none';

            return true;

        }

        alertDiv.style.display = 'block';

        alertDiv.innerHTML = '<span data-icon="warning"></span> <strong>تنبيه:</strong> لا توجد بيانات نتائج محفوظة. يرجى استيراد النتائج من صفحة <a href="../analysis/import_data.html" style="color: var(--secondary-color);">استيراد النتائج</a> أولا.';

        return false;

    }

    // Check if any results exist for this trimester

    if (selectedTrimester === '1+2') {

        // Must have BOTH T1 and T2 data

        // We check if at least ONE student has T1 avg AND T2 avg

        // Or if we have students with T1 column and students with T2 column (even if mixed, but ideally same student)

        let hasT1 = false;

        let hasT2 = false;

        // Check first few students (optimization) or all

        resultsData.some(s => {

            const t1 = studentHasTrimesterData(s, '1');

            const t2 = studentHasTrimesterData(s, '2');

            if (t1) hasT1 = true;

            if (t2) hasT2 = true;

            return t1 && t2;

        });

        // Ideally we want to find at least one student with BOTH, or at least coverage for both trimesters

        if (!hasT1 || !hasT2) {

            alertDiv.style.display = 'block';

            let missing = [];

            if (!hasT1) missing.push('الفصل الأول');

            if (!hasT2) missing.push('الفصل الثاني');

            alertDiv.innerHTML = `<span data-icon="warning"></span> <strong>تنبيه:</strong> لحساب معدل الفصلين، يجب توفر نتائج <strong>${missing.join(' و ')}</strong> في البيانات المستوردة. يرجى التأكد من استيراد ملف يحتوي على معدلات الفصلين.`;

            alertDiv.style.background = 'rgba(239, 68, 68, 0.15)';
            alertDiv.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            alertDiv.style.color = '#ef4444';

            return false;

        }

    } else if (selectedTrimester === 'annual') {

        if (!finalResultsData || finalResultsData.length === 0) {

            alertDiv.style.display = 'block';

            alertDiv.innerHTML = `<span data-icon="warning"></span> <strong>تنبيه:</strong> لا توجد بيانات نتائج نهائية (للمعدل السنوي) محفوظة. يرجى الذهاب إلى صفحة <strong><a href="../analysis/reports/final_results.html" style="color: var(--secondary-color);">النتائج النهائية</a></strong> واستيراد ملفات النتائج هناك أولا. هذه الميزة تعتمد على البيانات المخزنة من تلك الصفحة.`;

            alertDiv.style.background = 'rgba(239, 68, 68, 0.15)';
            alertDiv.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            alertDiv.style.color = '#ef4444';

            return false;

        }

    } else {

        // Normal single trimester check

        const filteredResults = resultsData.filter(s => studentHasTrimesterData(s, selectedTrimester));

        if (filteredResults.length === 0) {

            alertDiv.style.display = 'block';

            alertDiv.innerHTML = `<span data-icon="warning"></span> <strong>تنبيه:</strong> لا توجد بيانات نتائج ل<strong>${trimesterNames[selectedTrimester]}</strong>. يرجى استيراد نتائج هذا الفصل أولا، أو اختيار فصل آخر.`;

            alertDiv.style.background = 'rgba(239, 68, 68, 0.15)';
            alertDiv.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            alertDiv.style.color = '#ef4444';

            return false;

        }

    }

    alertDiv.style.display = 'none';

    return true;

}

/**

 * Get level number from level string

 */

function getLevelNum(levelStr) {

    if (!levelStr) return 0;

    if (typeof levelStr === 'number') return levelStr; // Direct return for integers

    const normalized = levelStr.toString().replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 0x0660);

    // Check specific strings first to avoid false positives

    if (normalized.includes('أولى') || normalized.includes('1')) return 1;

    if (normalized.includes('ثانية') || normalized.includes('2')) return 2;

    if (normalized.includes('ثالثة') || normalized.includes('3')) return 3;

    if (normalized.includes('رابعة') || normalized.includes('4')) return 4;

    return 0;

}

/**

 * Check if student is male

 */

function isMale(student) {

    const g = (student.gender || '').toString().toUpperCase();

    return g === 'M' || g === 'ذ' || g === 'ذكر';

}

/**

 * Check if student is repeater

 */

function isRepeater(student) {

    if (typeof student.repeat === 'boolean') return student.repeat;

    const val = (student.repeat || '').toString().toLowerCase();

    return val === 'true' || val === 'نعم' || val === '1' || val === 'yes';

}

/**

 * Get student status (خارجي/نصف داخلي/داخلي)

 */

function getStatus(student) {

    const status = (student.status || 'خارجي').toString();

    if (status.includes('نصف') || status.includes('ن.')) return 'نصف داخلي';

    if (status.includes('داخلي') && !status.includes('نصف')) return 'داخلي';

    return 'خارجي';

}

/**

 * Get student average from results data

 */

function getStudentAverage(student) {

    // If student has average property, use it

    if (student.average !== undefined && student.average !== null) {

        return parseFloat(student.average) || 0;

    }

    if (!student.marks) return 0;

    // Calculate from marks

    const marks = Object.values(student.marks).filter(m => m !== null && m !== undefined && !isNaN(parseFloat(m)));

    if (marks.length === 0) return 0;

    return marks.reduce((sum, m) => sum + parseFloat(m), 0) / marks.length;

}

/**

 * Get trimester name from student data

 */

function getStudentTrimester(student) {

    const t = (student.trimester || '').toString();

    if (t.includes('الأول') || t === '1') return '1';

    if (t.includes('الثاني') || t === '2') return '2';

    if (t.includes('الثالث') || t === '3') return '3';

    return '';

}

function hasTrimesterAverage(student, trimester) {

    if (!student || !student.averages) return false;

    return Object.prototype.hasOwnProperty.call(student.averages, trimester)

        && student.averages[trimester] !== undefined

        && student.averages[trimester] !== null

        && student.averages[trimester] !== '';

}

function getStudentTrimesterAverage(student, trimester) {

    if (!student || !trimester) return null;

    if (trimester === '1+2') {

        const t1 = getStudentTrimesterAverage(student, '1');

        const t2 = getStudentTrimesterAverage(student, '2');

        if (t1 === null || t2 === null) return null;

        return (t1 + t2) / 2;

    }

    if (hasTrimesterAverage(student, trimester)) {

        return parseFloat(student.averages[trimester]) || 0;

    }

    if (getStudentTrimester(student) === trimester && student.average !== undefined && student.average !== null) {

        return parseFloat(student.average) || 0;

    }

    return null;

}

function studentHasTrimesterData(student, trimester) {

    return getStudentTrimesterAverage(student, trimester) !== null;

}

function getStudentBirthYear(student) {

    if (!student) return 0;

    if (student.birthYear) return parseInt(student.birthYear, 10) || 0;

    const rawDob = student.dob || student.birthDate || '';

    if (!rawDob) return 0;

    const dStr = rawDob.toString();

    if (dStr.includes('-')) {

        const year = new Date(dStr).getFullYear();

        return isNaN(year) ? 0 : year;

    }

    if (dStr.includes('/')) {

        const parts = dStr.split('/');

        if (parts.length === 3) return parseInt(parts[2], 10) || 0;

    }

    if (!isNaN(dStr) && dStr > 1900 && dStr < 2100) {

        return parseInt(dStr, 10) || 0;

    }

    const yearMatch = dStr.match(/(19|20)\d{2}/);

    return yearMatch ? (parseInt(yearMatch[0], 10) || 0) : 0;

}

function shouldDirectStudent(student, fallbackAgeThreshold) {

    const birthYear = getStudentBirthYear(student);

    if (!birthYear) return false;

    const configuredThreshold = parseInt(institutionSettings.directedBirthYear, 10);

    if (!isNaN(configuredThreshold) && configuredThreshold > 0) {

        return birthYear <= configuredThreshold;

    }

    const studentAge = new Date().getFullYear() - birthYear;

    return studentAge >= fallbackAgeThreshold;

}

/**

 * Calculate current situation statistics

 */

function calculateCurrentStats() {

    const stats = {

        1: { total: 0, female: 0, classes: new Set(), repeaters: 0, repeatersFemale: 0, internal: 0, internalFemale: 0, semiInternal: 0, semiInternalFemale: 0, external: 0, externalFemale: 0 },

        2: { total: 0, female: 0, classes: new Set(), repeaters: 0, repeatersFemale: 0, internal: 0, internalFemale: 0, semiInternal: 0, semiInternalFemale: 0, external: 0, externalFemale: 0 },

        3: { total: 0, female: 0, classes: new Set(), repeaters: 0, repeatersFemale: 0, internal: 0, internalFemale: 0, semiInternal: 0, semiInternalFemale: 0, external: 0, externalFemale: 0 },

        4: { total: 0, female: 0, classes: new Set(), repeaters: 0, repeatersFemale: 0, internal: 0, internalFemale: 0, semiInternal: 0, semiInternalFemale: 0, external: 0, externalFemale: 0 }

    };

    const maxLevel = isSecondary ? 3 : 4;

    allStudents.forEach(s => {

        const lvl = getLevelNum(s.level);

        if (lvl < 1 || lvl > maxLevel) return;

        const female = !isMale(s);

        const repeater = isRepeater(s);

        const status = getStatus(s);

        stats[lvl].total++;

        if (female) stats[lvl].female++;

        if (s.class) {

            // In Secondary, class names might be repeated across streams (e.g. "G1" in Science and "G1" in Arts)

            // So we use Stream + Class as the unique key

            const classKey = (isSecondary && s.stream) ? `${s.stream}_${s.class}` : s.class;

            stats[lvl].classes.add(classKey);

        }

        if (repeater) {

            stats[lvl].repeaters++;

            if (female) stats[lvl].repeatersFemale++;

        }

        if (status === 'داخلي') {

            stats[lvl].internal++;

            if (female) stats[lvl].internalFemale++;

        } else if (status === 'نصف داخلي') {

            stats[lvl].semiInternal++;

            if (female) stats[lvl].semiInternalFemale++;

        } else {

            stats[lvl].external++;

            if (female) stats[lvl].externalFemale++;

        }

    });

    return stats;

}

/**

 * Calculate projected statistics for next year based on selected trimester

 */

function calculateProjectedStats(selectedTrimester) {

    const stats = {

        1: { promoted: 0, promotedFemale: 0, repeaters: 0, repeatersFemale: 0, directed: 0, directedFemale: 0, total: 0, totalFemale: 0 },

        2: { promoted: 0, promotedFemale: 0, repeaters: 0, repeatersFemale: 0, directed: 0, directedFemale: 0, total: 0, totalFemale: 0 },

        3: { promoted: 0, promotedFemale: 0, repeaters: 0, repeatersFemale: 0, directed: 0, directedFemale: 0, total: 0, totalFemale: 0 },

        4: { promoted: 0, promotedFemale: 0, repeaters: 0, repeatersFemale: 0, directed: 0, directedFemale: 0, total: 0, totalFemale: 0 }

    };

    const maxLevel = isSecondary ? 3 : 4;

    // Age threshold for direction: 16 for Middle (mandatory schooling ends), 18/19 for Secondary

    const ageThreshold = isSecondary ? 19 : 16;

    // Filter and Process results

    let processedStudents = [];

    if (selectedTrimester === 'annual') {

        console.log("Annual Mode: finalResultsData length:", finalResultsData.length);

        if (finalResultsData.length > 0) {

            console.log("First student sample:", finalResultsData[0]);

        }

        // Use finalResultsData directly

        processedStudents = finalResultsData.map(s => ({

            id: s.id,

            level: s.level, // finalResultsData has int 1-4

            gender: s.gender,

            dob: s.birthDate,

            birthYear: s.birthYear,

            className: s.className,

            squad: s.squad,

            average: s.annualAvg,

            // We map other props if needed, but these are enough for stats

        }));

        console.log("Mapped students count:", processedStudents.length);

        if (processedStudents.length > 0) console.log("Mapped sample:", processedStudents[0]);

    } else if (selectedTrimester === '1+2') {

        processedStudents = resultsData

            .filter(s => studentHasTrimesterData(s, '1+2'))

            .map(s => ({ ...s, average: getStudentTrimesterAverage(s, '1+2') }));

    } else {

        // Normal single trimester filtering

        processedStudents = resultsData

            .filter(s => studentHasTrimesterData(s, selectedTrimester))

            .map(s => ({ ...s, average: getStudentTrimesterAverage(s, selectedTrimester) }));

    }

    // Process each student

    processedStudents.forEach(s => {

        const lvl = getLevelNum(s.level);

        if (lvl < 1 || lvl > maxLevel) return;

        const female = (s.gender === 'أنثى' || s.gender === 'F' || isMale(s) === false);

        const avg = s.average !== undefined ? parseFloat(s.average) : getStudentAverage(s);

        const passed = avg >= 10;

        // Calculate for NEXT year

        if (lvl < maxLevel) {

            // Students who passed go to next level

            if (passed) {

                stats[lvl + 1].promoted++;

                if (female) stats[lvl + 1].promotedFemale++;

            } else {

                // Failed students: check if directed (age >= 16) or repeater

                if (shouldDirectStudent(s, ageThreshold)) {

                    stats[lvl].directed++;

                    if (female) stats[lvl].directedFemale++;

                } else {

                    stats[lvl].repeaters++;

                    if (female) stats[lvl].repeatersFemale++;

                }

            }

        } else {

            // Final year students (4th MS or 3rd AS)

            if (!passed) {

                if (shouldDirectStudent(s, ageThreshold)) {

                    stats[maxLevel].directed++;

                    if (female) stats[maxLevel].directedFemale++;

                } else {

                    stats[maxLevel].repeaters++;

                    if (female) stats[maxLevel].repeatersFemale++;

                }

            }

        }

    });

    // Add user input for first year (from primary schools)

    stats[1].promoted = firstYearInput.promoted;

    stats[1].promotedFemale = firstYearInput.promotedFemale;

    // Calculate totals (repeaters + directed stay, promoted move out)

    for (let i = 1; i <= maxLevel; i++) {

        stats[i].total = stats[i].promoted + stats[i].repeaters;

        stats[i].totalFemale = stats[i].promotedFemale + stats[i].repeatersFemale;

    }

    return stats;

}

/**

 * Update first year input values - only update totals, don't rebuild table

 */

async function updateFirstYearInput(field, value) {

    firstYearInput[field] = parseInt(value) || 0;

    await saveSettings(); // Save to storage

    // Only update the total cells, not the entire table

    const selectedTrimester = document.getElementById('trimesterSelect').value;

    const stats = calculateProjectedStats(selectedTrimester);

    // Update total cells for promoted row

    const promotedTotal = stats[1].promoted + stats[2].promoted + stats[3].promoted + stats[4].promoted;

    const promotedFemaleTotal = stats[1].promotedFemale + stats[2].promotedFemale + stats[3].promotedFemale + stats[4].promotedFemale;

    // Update المجموع row totals

    document.getElementById('totalPromoted').innerHTML = `<strong>${promotedTotal}</strong>`;

    document.getElementById('totalPromotedFemale').innerHTML = `<strong>${promotedFemaleTotal}</strong>`;

    // Update level 1 totals in المجموع section

    document.getElementById('level1Total').innerHTML = `<strong>${stats[1].total}</strong>`;

    document.getElementById('level1TotalFemale').innerHTML = `<strong>${stats[1].totalFemale}</strong>`;

    // Update grand totals

    const grandTotal = stats[1].total + stats[2].total + stats[3].total + stats[4].total;

    const grandTotalFemale = stats[1].totalFemale + stats[2].totalFemale + stats[3].totalFemale + stats[4].totalFemale;

    document.getElementById('grandTotal').innerHTML = `<strong>${grandTotal}</strong>`;

    document.getElementById('grandTotalFemale').innerHTML = `<strong>${grandTotalFemale}</strong>`;

    // Update الأفواج using max class sizes

    const maxLevels = isSecondary ? 3 : 4;

    let totalGroups = 0;

    for (let i = 1; i <= maxLevels; i++) {

        const maxClass = parseInt(document.getElementById(`maxClass${i}`)?.value) || 30;

        const groups = Math.ceil(stats[i].total / maxClass) || 0;

        totalGroups += groups;

        if (i === 1) document.getElementById('groups1').textContent = groups;

        // Optionally update other group cells if they had IDs, but currently only group1 has ID in the partial update logic

        // Ideally we should re-render the whole row or table, but this optimization targets level 1 input mainly.

    }

    document.getElementById('totalGroups').innerHTML = `<strong>${totalGroups}</strong>`;

}

/**

 * Update max class size and save

 */

async function updateMaxClassSize() {

    maxClassSizes[1] = parseInt(document.getElementById('maxClass1')?.value) || 30;

    maxClassSizes[2] = parseInt(document.getElementById('maxClass2')?.value) || 30;

    maxClassSizes[3] = parseInt(document.getElementById('maxClass3')?.value) || 30;

    maxClassSizes[4] = parseInt(document.getElementById('maxClass4')?.value) || 30;

    await saveSettings();

    updateTables();

}

/**

 * Update table headers dynamically

 */

function updateTableHeaders() {

    const theadCurrent = document.querySelector('#currentTable thead');

    const theadProjected = document.querySelector('#projectedTable thead');

    if (isSecondary) {

        const headerHtml = `

            <tr>

                <th width="30%">المستوى / الشعبة</th>

                <th>التلاميذ (الحالي)</th>

                <th>الإناث</th>

                <th>المعيدون</th>

                <th>المعيدون إناث</th>

                <th>الأفواج</th>

            </tr>

        `;

        theadCurrent.innerHTML = headerHtml;

        const projHeaderHtml = `

            <tr>

                <th width="30%">المستوى / الشعبة (المستقبلية)</th>

                <th>الناجحون الوافدون (تلقائي/يدوي)</th>

                <th>منهم الإناث</th>

                <th>المعيدون (الباقون)</th>

                <th>منهم الإناث</th>

                <th>المجموع الكلي</th>

                <th>الأفواج المقترحة</th>

            </tr>

        `;

        theadProjected.innerHTML = projHeaderHtml;

    } else {

        const headerRowHtml = `

            <tr>

                <th width="5%">#</th>

                <th width="20%">البند</th>

                <th>أولى متوسط</th>

                <th>ثانية متوسط</th>

                <th>ثالثة متوسط</th>

                <th>رابعة متوسط</th>

                <th>المجموع</th>

            </tr>

        `;

        theadCurrent.innerHTML = headerRowHtml;

        theadProjected.innerHTML = headerRowHtml;

    }

}

/**

 * Update both tables

 */

function updateTables() {

    const currentYear = document.getElementById('currentYear').value;

    const nextYear = document.getElementById('nextYear').value;

    const selectedTrimester = document.getElementById('trimesterSelect').value;

    document.getElementById('currentYearDisplay').textContent = currentYear;

    document.getElementById('nextYearDisplay').textContent = nextYear;

    document.getElementById('trimesterDisplay').textContent = trimesterNames[selectedTrimester];

    if (isSecondary) {

        updateSecondaryTables();

    } else {

        updateCurrentTable();

        updateProjectedTableOnly();

    }

}

// Store manual inputs for projections

let projectionInputs = {};

async function loadProjectionInputs() {

    projectionInputs = await DB.get('schoolEntryProjections') || {};

}

async function saveProjectionInput(key, value) {

    projectionInputs[key] = parseInt(value) || 0;

    await DB.set('schoolEntryProjections', projectionInputs);

    updateSecondaryTables(true); // Redraw to update totals

}

/**

 * Helper: Get Stream Label standardizer

 */

function getStandardStream(code) {

    if (!code) return 'بدون شعبة';

    const c = code.toLowerCase().trim();

    // Exact Mapping

    const map = {

        'common_arts': 'جذع مشترك آداب',

        'common_science': 'جذع مشترك علوم وتكنولوجيا',

        'science': 'علوم تجريبية',

        'math': 'رياضيات',

        'math_tech': 'تقني رياضي',

        'tech_math': 'تقني رياضي',

        'tech_math_civil': 'تقني رياضي',

        'tech_math_elec': 'تقني رياضي',

        'tech_math_mech': 'تقني رياضي',

        'tech_math_methods': 'تقني رياضي',

        'languages': 'لغات أجنبية',

        'literature': 'آداب وفلسفة',

        'arts': 'آداب وفلسفة', // Sometimes used for Literature

        'management': 'تسيير واقتصاد',

        'sport': 'رياضة'

    };

    if (map[c]) return map[c];

    // Fuzzy Matching (Fallbacks)

    if (c.includes('common') && (c.includes('art') || c.includes('lit'))) return 'جذع مشترك آداب';

    if (c.includes('common') && c.includes('sci')) return 'جذع مشترك علوم وتكنولوجيا';

    if (c.includes('tech') || c.includes('تقني')) return 'تقني رياضي';

    if (c.includes('science') || c.includes('علوم')) return 'علوم تجريبية';

    if (c.includes('math') && !c.includes('tech')) return 'رياضيات';

    if (c.includes('lang') || c.includes('لغات')) return 'لغات أجنبية';

    if (c.includes('lit') || c.includes('آداب') || c.includes('falsafa') || c.includes('arts')) return 'آداب وفلسفة';

    if (c.includes('manag') || c.includes('تسيير')) return 'تسيير واقتصاد';

    return code; // Fallback to original

}

function inferStudentStream(student, levelNum) {

    const candidates = [

        student && student.stream,

        student && student.className,

        student && student.squad,

        student && student.class,

        student && student.levelName,

        student && student.level

    ].filter(Boolean);

    for (const candidate of candidates) {

        const normalized = getStandardStream(candidate);

        if (normalized && normalized !== candidate) return normalized;

        if (normalized && /مشترك|علوم|رياض|تقني|تسيير|لغات|آداب|science|math|tech|management|lang|arts|common/i.test(candidate.toString())) {

            return normalized;

        }

    }

    if (levelNum === 1) {

        const joined = candidates.join(' ');

        if (/آداب|arts|literature/i.test(joined)) return 'ط¬ط°ط¹ ظ…ط´طھط±ظƒ ط¢ط¯ط§ط¨';

        return 'ط¬ط°ط¹ ظ…ط´طھط±ظƒ ط¹ظ„ظˆظ… ظˆطھظƒظ†ظˆظ„ظˆط¬ظٹط§';

    }

    return 'ط¨ط¯ظˆظ† ط´ط¹ط¨ط©';

}

/**

 * Calculate Secondary Current Stats

 */

function calculateSecondaryCurrentStats() {

    // Group by Level -> Stream

    const hierarchy = {

        '1': {}, // 1AS usually Common Core

        '2': {},

        '3': {}

    };

    allStudents.forEach(s => {

        const lvl = getLevelNum(s.level);

        if (lvl < 1 || lvl > 3) return;

        // Determine Stream Key

        let stream = 'جذع مشترك';

        if (s.stream) {

            stream = getStandardStream(s.stream);

        } else {

            // Try to infer from level name if 1AS

            if (lvl === 1) {

                if (s.level.includes('آداب') || s.class.includes('آداب')) stream = 'جذع مشترك آداب';

                else stream = 'جذع مشترك علوم وتكنولوجيا';

            }

        }

        if (!hierarchy[lvl][stream]) {

            hierarchy[lvl][stream] = { total: 0, female: 0, repeaters: 0, repeatersFemale: 0, classes: new Set() };

        }

        const entry = hierarchy[lvl][stream];

        entry.total++;

        if (!isMale(s)) entry.female++;

        if (isRepeater(s)) {

            entry.repeaters++;

            if (!isMale(s)) entry.repeatersFemale++;

        }

        if (s.class) entry.classes.add(s.class);

    });

    return hierarchy;

}

/**

 * Update Secondary Tables

 */

function updateSecondaryTables(skipCalc = false) {

    // 1. Current Situation

    const currentStats = calculateSecondaryCurrentStats();

    const tbodyCurrent = document.getElementById('currentTableBody');

    let htmlCurrent = '';

    // Order: 1AS, 2AS, 3AS

    [1, 2, 3].forEach(lvl => {

        const streams = Object.keys(currentStats[lvl]).sort();

        if (streams.length === 0) return;

        htmlCurrent += `<tr class="category-row"><td colspan="6">السنة ${lvl} ثانوي</td></tr>`;

        streams.forEach(stream => {

            const d = currentStats[lvl][stream];

            htmlCurrent += `

                <tr>

                    <td>${stream}</td>

                    <td>${d.total}</td>

                    <td>${d.female}</td>

                    <td>${d.repeaters}</td>

                    <td>${d.repeatersFemale}</td>

                    <td>${d.classes.size}</td>

                </tr>

            `;

        });

    });

    tbodyCurrent.innerHTML = htmlCurrent;

    // 2. Projected Situation

    const tbodyProjected = document.getElementById('projectedTableBody');

    let htmlProj = '';

    // Logic:

    // Target 2AS comes from Promoted 1AS (Manual Input usually due to orientation) + Repeating 2AS (Auto)

    // Target 3AS comes from Promoted 2AS (Auto map) + Repeating 3AS (Auto)

    // We need Auto-calculated Repeaters for Next Year (Current Failures)

    // And Auto-calculated Promotions (Current Passers)

    const trimester = document.getElementById('trimesterSelect').value;

    const nextStats = calculateProjectedStats(trimester); // Re-use existing logic but we need to split by stream?

    // calculateProjectedStats aggregates by level only. We need by Stream.

    // Let's build a simpler projected stats by stream here.

    const projStats = calculateSecondaryProjectedStats(trimester);

    // Render 1AS (Target) - Input only (from Middle School)

    htmlProj += `<tr class="category-row"><td colspan="7">السنة 1 ثانوي (وافدون من المتوسط)</td></tr>`;

    // Common Streams for 1AS

    const streams1AS = ['جذع مشترك علوم وتكنولوجيا', 'جذع مشترك آداب'];

    streams1AS.forEach(stream => {

        const key = `1_${stream}`;

        const inputPromoted = projectionInputs[`${key}_prom`] || 0;

        const inputPromotedF = projectionInputs[`${key}_prom_f`] || 0;

        const repeaters = projStats['1'][stream]?.repeaters || 0; // Current 1AS repeaters staying in 1AS

        const repeatersF = projStats['1'][stream]?.repeatersFemale || 0;

        const total = inputPromoted + repeaters;

        const groups = Math.ceil(total / (maxClassSizes[1] || 30));

        htmlProj += renderProjectedRow(1, stream, inputPromoted, inputPromotedF, repeaters, repeatersF, total, groups, true);

    });

    // Render 2AS

    htmlProj += `<tr class="category-row"><td colspan="7">السنة 2 ثانوي</td></tr>`;

    // Define standard streams for 2AS

    const streams2AS = ['علوم تجريبية', 'رياضيات', 'تقني رياضي', 'تسيير واقتصاد', 'لغات أجنبية', 'آداب وفلسفة'];

    streams2AS.forEach(stream => {

        // Incoming to 2AS comes from 1AS orientation. This is HARD to auto-calculate without orientation data.

        // So we allow Manual Input for "Promoted into this stream".

        // BUT we can default it to 0.

        const key = `2_${stream}`;

        const inputPromoted = projectionInputs[`${key}_prom`] || 0;

        const inputPromotedF = projectionInputs[`${key}_prom_f`] || 0;

        // Repeaters: Current 2AS students in this stream who failed

        const repeaters = projStats['2'][stream]?.repeaters || 0;

        const repeatersF = projStats['2'][stream]?.repeatersFemale || 0;

        const total = inputPromoted + repeaters;

        const groups = Math.ceil(total / (maxClassSizes[2] || 30));

        htmlProj += renderProjectedRow(2, stream, inputPromoted, inputPromotedF, repeaters, repeatersF, total, groups, true);

    });

    // Render 3AS

    htmlProj += `<tr class="category-row"><td colspan="7">السنة 3 ثانوي</td></tr>`;

    streams2AS.forEach(stream => {

        // Incoming to 3AS comes from 2AS Promoted in SAME stream (Auto-calc possible!)

        const promotedFrom2 = projStats['2'][stream]?.promoted || 0;

        const promotedFrom2F = projStats['2'][stream]?.promotedFemale || 0;

        // Repeaters: Current 3AS students in this stream who failed

        const repeaters = projStats['3'][stream]?.repeaters || 0;

        const repeatersF = projStats['3'][stream]?.repeatersFemale || 0;

        const total = promotedFrom2 + repeaters;

        const groups = Math.ceil(total / (maxClassSizes[3] || 30));

        htmlProj += renderProjectedRow(3, stream, promotedFrom2, promotedFrom2F, repeaters, repeatersF, total, groups, false);

    });

    // Check for "Unknown" or Unrendered Streams

    const renderedStreams1 = new Set(streams1AS);

    const renderedStreams2 = new Set(streams2AS);

    const renderedStreams3 = new Set(streams2AS);

    // Helper to render extras

    const renderExtras = (lvl, renderedSet) => {

        if (!projStats[lvl]) return '';

        let extraHtml = '';

        Object.keys(projStats[lvl]).forEach(s => {

            if (!renderedSet.has(s) && s !== 'بدون شعبة') { // If it's something else

                // We generally expect standard streams. If we find something else, show it.

                // Treat as 2AS type (Input for incoming) or 3AS type (Auto)?

                // For safety, make it Input based for now as we don't know the source.

                const isInput = (lvl !== 3);

                const key = `${lvl}_${s}`;

                const prom = isInput ? (projectionInputs[`${key}_prom`] || 0) : (projStats[lvl - 1]?.[s]?.promoted || 0); // No source for 3AS extra if not standard

                const promF = isInput ? (projectionInputs[`${key}_prom_f`] || 0) : (projStats[lvl - 1]?.[s]?.promotedFemale || 0);

                const rep = projStats[lvl][s].repeaters;

                const repF = projStats[lvl][s].repeatersFemale;

                const total = prom + rep;

                const groups = Math.ceil(total / (maxClassSizes[lvl] || 30));

                extraHtml += renderProjectedRow(lvl, `${s} (غير مصنف)`, prom, promF, rep, repF, total, groups, isInput);

            }

        });

        return extraHtml;

    };

    const extras1 = renderExtras('1', renderedStreams1);

    const extras2 = renderExtras('2', renderedStreams2);

    const extras3 = renderExtras('3', renderedStreams3);

    if (extras1 || extras2 || extras3) {

        htmlProj += `<tr class="category-row" style="background:#ffe6e6"><td colspan="8">شعب أخرى / غير مطابقة</td></tr>`;

        htmlProj += extras1 + extras2 + extras3;

    }

    tbodyProjected.innerHTML = htmlProj;

}

function updateTableHeaders() {

    const theadCurrent = document.getElementById('currentTableHeader');

    const theadProjected = document.getElementById('projectedTableHeader');

    if (isSecondary) {

        const currentHeaderHtml = `

            <tr>

                <th width="25%">الشعبة</th>

                <th>المجموع</th>

                <th>منهم الإناث</th>

                <th>المعيدون</th>

                <th>منهم الإناث</th>

                <th>عدد الأفواج</th>

            </tr>

        `;

        theadCurrent.innerHTML = currentHeaderHtml;

        const projHeaderHtml = `

            <tr>

                <th width="25%">المستوى / الشعبة (المستقبلية)</th>

                <th>الناجحون الوافدون (تلقائي/يدوي)</th>

                <th>منهم الإناث</th>

                <th>المعيدون (الباقون)</th>

                <th>منهم الإناث</th>

                <th>المجموع الكلي</th>

                <th>معدل الفوج</th>

                <th>الأفواج المقترحة</th>

            </tr>

        `;

        theadProjected.innerHTML = projHeaderHtml;

    } else {

        // Middle School headers

        const currentHeaderHtml = `

            <tr>

                <th width="25%">البيان</th>

                <th>السنة 1 متوسط</th>

                <th>السنة 2 متوسط</th>

                <th>السنة 3 متوسط</th>

                <th>السنة 4 متوسط</th>

                <th>المجموع</th>

            </tr>

        `;

        theadCurrent.innerHTML = currentHeaderHtml;

        const projHeaderHtml = `

            <tr>

                <th width="25%">البيان</th>

                <th>السنة 1 متوسط</th>

                <th>السنة 2 متوسط</th>

                <th>السنة 3 متوسط</th>

                <th>السنة 4 متوسط</th>

                <th>المجموع</th>

            </tr>

        `;

        theadProjected.innerHTML = projHeaderHtml;

    }

}

function renderProjectedRow(level, stream, prom, promF, rep, repF, total, groups, editable, isInput = true) {

    const key = `${level}_${stream}`;

    // Get saved max class size for this specific stream or fall back to level default

    const savedMax = projectionInputs[`${key}_max`] || (maxClassSizes[level] || 30);

    // Recalculate groups based on this specific max

    const newGroups = Math.ceil(total / savedMax) || 0;

    const inputHtml = editable ?

        `<input type="number" class="input-cell" value="${prom}" onchange="saveProjectionInput('${key}_prom', this.value)" style="width:60px">` :

        `<span style="font-weight:bold; color:green;">${prom}</span>`;

    const inputFHtml = editable ?

        `<input type="number" class="input-cell" value="${promF}" onchange="saveProjectionInput('${key}_prom_f', this.value)" style="width:60px">` :

        `<span>${promF}</span>`;

    return `

        <tr>

            <td>${stream}</td>

            <td>${inputHtml}</td>

            <td>${inputFHtml}</td>

            <td>${rep}</td>

            <td>${repF}</td>

            <td class="bg-yellow"><strong>${total}</strong></td>

            <td>

                <input type="number" class="input-cell" value="${savedMax}"

                       onchange="saveProjectionInput('${key}_max', this.value)"

                       style="width:50px; background:#f0f8ff;">

            </td>

            <td><strong>${newGroups}</strong></td>

        </tr>

    `;

}

function calculateSecondaryProjectedStats(trimester) {

    // We need to iterate students, check pass/fail, and group by (Level, Stream)

    // Returns: { '1': { 'StreamX': { promoted, repeaters... } }, '2': ... }

    // Reuse filter logic from main function

    const stats = { '1': {}, '2': {}, '3': {} };

    const ensureStream = (l, s) => {

        if (!stats[l]) stats[l] = {};

        if (!stats[l][s]) stats[l][s] = { promoted: 0, promotedFemale: 0, repeaters: 0, repeatersFemale: 0 };

        return stats[l][s];

    };

    // Filter students same as calculateProjectedStats

    let studentsToProcess = [];

    if (trimester === 'annual') studentsToProcess = finalResultsData.map(s => ({ ...s, average: s.annualAvg }));

    else studentsToProcess = resultsData

        .filter(s => studentHasTrimesterData(s, trimester))

        .map(s => ({ ...s, average: getStudentTrimesterAverage(s, trimester) }));

    studentsToProcess.forEach(s => {

        const lvl = getLevelNum(s.level);

        if (lvl < 1 || lvl > 3) return;

        let stream = s.stream ? getStandardStream(s.stream) : 'بدون شعبة';

        // Fallback for 1AS if stream undefined -> Map to common streams based on keywords in Class Name?

        // Or default to 'جذع مشترك علوم وتكنولوجيا' as it's most common

        if (lvl === 1 && (stream === 'بدون شعبة')) {

            if (s.class && s.class.includes('آداب')) stream = 'جذع مشترك آداب';

            else stream = 'جذع مشترك علوم وتكنولوجيا';

        }

        // For 2AS/3AS, we really need the stream. If missing, we can't guess easily.

        // We will store them under 'بدون شعبة' so at least they are counted somewhere if we decide to render it.

        stream = inferStudentStream(s, lvl);

        const entry = ensureStream(lvl, stream);

        const avg = parseFloat(s.average !== undefined ? s.average : (s.annualAvg || getStudentAverage(s))) || 0;

        const passed = avg >= 10;

        const female = !isMale(s);

        if (passed) {

            entry.promoted++;

            if (female) entry.promotedFemale++;

        } else if (!shouldDirectStudent(s, 19)) {

            entry.repeaters++;

            if (female) entry.repeatersFemale++;

        }

    });

    return stats;

}

/**

 * Update current situation table

 */

function updateCurrentTable() {

    const stats = calculateCurrentStats();

    const tbody = document.getElementById('currentTableBody');

    const maxLevel = isSecondary ? 3 : 4;

    const sumField = (field) => {

        let sum = 0;

        for (let i = 1; i <= maxLevel; i++) sum += stats[i][field];

        return sum;

    }

    const sumClasses = () => {

        let sum = 0;

        for (let i = 1; i <= maxLevel; i++) sum += stats[i].classes.size;

        return sum;

    }

    const rows = [

        {

            num: '1', label: 'التلاميذ', items: [

                { label: 'المجموع', field: 'total' },

                { label: 'منهم الإناث', field: 'female' }

            ]

        },

        { num: '2', label: 'الأفواج', single: true, field: 'classes', isSet: true },

        {

            num: '3', label: 'المعيدون', items: [

                { label: 'المجموع', field: 'repeaters' },

                { label: 'منهم الإناث', field: 'repeatersFemale' }

            ]

        },

        {

            num: '4', label: 'داخليون', items: [

                { label: 'المجموع', field: 'internal' },

                { label: 'منهم الإناث', field: 'internalFemale' }

            ]

        },

        {

            num: '5', label: 'نصف داخلي', items: [

                { label: 'المجموع', field: 'semiInternal' },

                { label: 'منهم الإناث', field: 'semiInternalFemale' }

            ]

        },

        {

            num: '6', label: 'خارجيون', items: [

                { label: 'المجموع', field: 'external' },

                { label: 'منهم الإناث', field: 'externalFemale' }

            ]

        }

    ];

    let html = '';

    rows.forEach(row => {

        if (row.single) {

            const total = row.isSet ? sumClasses() : sumField(row.field);

            let cells = '';

            for (let i = 1; i <= maxLevel; i++) {

                const val = row.isSet ? stats[i].classes.size : stats[i][row.field];

                cells += `<td>${val}</td>`;

            }

            html += `

                <tr class="category-row">

                    <td>${row.num}</td>

                    <td>${row.label}</td>

                    ${cells}

                    <td><strong>${total}</strong></td>

                </tr>

            `;

        } else {

            // Category header

            html += `

                <tr class="category-row">

                    <td rowspan="${row.items.length + 1}">${row.num}</td>

                    <td colspan="${maxLevel + 2}" style="text-align: right; font-weight: bold;">${row.label}</td>

                </tr>

            `;

            row.items.forEach(item => {

                let cells = '';

                for (let i = 1; i <= maxLevel; i++) {

                    cells += `<td>${stats[i][item.field]}</td>`;

                }

                html += `

                    <tr class="sub-row">

                        <td>${item.label}</td>

                        ${cells}

                        <td><strong>${sumField(item.field)}</strong></td>

                    </tr>

                `;

            });

        }

    });

    tbody.innerHTML = html;

}

/**

 * Update projected table for Middle School

 */

function updateProjectedTableOnly() {

    const selectedTrimester = document.getElementById('trimesterSelect').value;

    const stats = calculateProjectedStats(selectedTrimester);

    const tbody = document.getElementById('projectedTableBody');

    const maxLevel = 4;

    const sumField = (field) => {

        let sum = 0;

        for (let i = 1; i <= maxLevel; i++) sum += stats[i][field];

        return sum;

    };

    let totalGroups = 0;

    const groupsArray = [];

    for (let i = 1; i <= maxLevel; i++) {

        const grp = Math.ceil(stats[i].total / maxClassSizes[i]) || 0;

        groupsArray.push(grp);

        totalGroups += grp;

    }

    const rows = [

        {

            num: '1', label: 'الناجحون والوافدون', items: [

                { label: 'المجموع', field: 'promoted', idPrefix: 'totalPromoted' },

                { label: 'منهم الإناث', field: 'promotedFemale', idPrefix: 'totalPromotedFemale' }

            ]

        },

        {

            num: '2', label: 'المعيدون (الباقون)', items: [

                { label: 'المجموع', field: 'repeaters' },

                { label: 'منهم الإناث', field: 'repeatersFemale' }

            ]

        },

        {

            num: '3', label: 'الموجهون', items: [

                { label: 'المجموع', field: 'directed' },

                { label: 'منهم الإناث', field: 'directedFemale' }

            ]

        },

        {

            num: '4', label: 'المجموع', items: [

                { label: 'المجموع', field: 'total', idPrefix: 'grandTotal', level1Id: 'level1Total' },

                { label: 'منهم الإناث', field: 'totalFemale', idPrefix: 'grandTotalFemale', level1Id: 'level1TotalFemale' }

            ]

        },

        { num: '5', label: 'الأفواج المقترحة', single: true }

    ];

    let html = '';

    rows.forEach(row => {

        if (row.single) {

            let cells = '';

            for (let i = 1; i <= maxLevel; i++) {

                const grpId = (i === 1) ? ` id="groups1"` : '';

                cells += `<td${grpId}>${groupsArray[i - 1]}</td>`;

            }

            html += `

                <tr class="category-row">

                    <td>${row.num}</td>

                    <td>${row.label}</td>

                    ${cells}

                    <td id="totalGroups"><strong>${totalGroups}</strong></td>

                </tr>

            `;

        } else {

            html += `

                <tr class="category-row">

                    <td rowspan="${row.items.length + 1}">${row.num}</td>

                    <td colspan="${maxLevel + 2}" style="text-align: right; font-weight: bold;">${row.label}</td>

                </tr>

            `;

            row.items.forEach(item => {

                let cells = '';

                for (let i = 1; i <= maxLevel; i++) {

                    if (i === 1 && row.num === '1') {

                        // Input fields for 1st year promoted

                        const isFemale = item.field === 'promotedFemale';

                        const inputField = isFemale ? 'promotedFemale' : 'promoted';

                        const val = firstYearInput[inputField] || 0;

                        cells += `<td><input type="number" class="input-cell" value="${val}" onchange="updateFirstYearInput('${inputField}', this.value)" style="width:60px; background:#f0f8ff;"></td>`;

                    } else {

                        const cellId = (i === 1 && item.level1Id) ? ` id="${item.level1Id}"` : '';

                        cells += `<td${cellId}>${stats[i][item.field]}</td>`;

                    }

                }

                const totalId = item.idPrefix ? ` id="${item.idPrefix}"` : '';

                html += `

                    <tr class="sub-row">

                        <td>${item.label}</td>

                        ${cells}

                        <td${totalId}><strong>${sumField(item.field)}</strong></td>

                    </tr>

                `;

            });

        }

    });

    tbody.innerHTML = html;

}

/**

 * Print report

 */

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

function printReport() {
    if (blockTrialPrint()) return;

    const settings = institutionSettings;

    const today = new Date().toLocaleDateString('ar-DZ');

    const city = settings.municipality || settings.wilaya || '.......';

    const currentYear = document.getElementById('currentYear').value;

    const nextYear = document.getElementById('nextYear').value;

    const selectedTrimester = document.getElementById('trimesterSelect').value;

    const currentTableContent = document.getElementById('currentSituationSection').innerHTML;

    const projectedTableContent = document.getElementById('projectedSection').innerHTML;

    const printWin = window.open('', '_blank');

    printWin.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>تحضير الدخول المدرسي - طباعة</title>

            <style>

                @font-face {
                    font-family: 'Cairo';
                    src: url('assets/fonts/Cairo-Regular.ttf') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'Cairo';
                    src: url('assets/fonts/Cairo-Bold.ttf') format('truetype');
                    font-weight: bold;
                    font-style: normal;
                }

                @page { size: auto; margin: 0mm; }
                * { box-sizing: border-box; }
                body { font-family: 'Cairo', sans-serif; margin: 0; padding: 8mm; direction: rtl; }

                .header-container { margin-bottom: 5px; }
                .header-row { display: flex; justify-content: space-between; align-items: center; }
                .center-text { text-align: center; }
                h2, h3 { margin: 0; line-height: 1.2; }

                .section-title {
                    text-align: center;
                    font-weight: bold;
                    font-size: 11pt;
                    margin: 5px 0 5px 0;
                    border-bottom: 1px solid #000;
                    padding-bottom: 2px;
                }

                .stats-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: center;
                    font-size: 10pt;
                    margin-bottom: 10px;
                }

                .stats-table th, .stats-table td {
                    border: 1px solid #000;
                    padding: 2px 4px;
                }

                .stats-table th {

                    background-color: #eee !important;

                    -webkit-print-color-adjust: exact;

                    print-color-adjust: exact;

                }

                .category-row {

                    background-color: #f5f5f5 !important;

                    -webkit-print-color-adjust: exact;

                    print-color-adjust: exact;

                }

                .total-row {

                    background-color: #d5f5e3 !important;

                    -webkit-print-color-adjust: exact;

                    print-color-adjust: exact;

                }

                .input-cell {

                    border: 1px solid #999;

                    padding: 2px 4px;

                    width: 50px;

                    text-align: center;

                }

                .print-footer {

                    margin-top: 30px;

                    display: flex;

                    justify-content: space-between;

                    font-size: 11pt;

                }

                @media print {

                    @page { size: A4 landscape; margin: 0.8cm; }

                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

                }

            </style>

        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
</head>

        <body>
${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            <div class="header-container">

                <div class="center-text">

                    <h3>الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                    <h3>وزارة التربية الوطنية</h3>

                </div>

                <div class="header-row" style="margin-top: 10px;">

                    <div style="text-align: right;">

                        <h3>المؤسسة: ${settings.institutionName || '.......'}</h3>

                    </div>

                    <div class="center-text">

                        <h2 style="text-decoration: underline;">تحضير الدخول المدرسي</h2>

                    </div>

                    <div style="text-align: left;">

                        <h3>مديرية التربية لولاية ${settings.wilaya || '.......'}</h3>

                    </div>

                </div>

            </div>

            <div>${currentTableContent}</div>

            <div style="page-break-before: always;">${projectedTableContent}</div>

            <div class="print-footer">

                <div>حرر بـ ${city} في: ${today}</div>

                <div style="text-align: center;">

                    المدير

                    <br><br><br>

                    <strong>${settings.directorName || ''}</strong>

                </div>

            </div>

            <script>

                setTimeout(() => { // window.print(); /* Replaced by global Toolbar */ }, 500);

            </script>

        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
</body>

        </html>

    `);

    printWin.document.close();

}

async function exportSchoolEntryToExcel() {
    if (!window.ExcelExportHelper) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'مكتبة التصدير غير متاحة حالياً.' });
        return;
    }

    const currentTable = document.getElementById('currentTable');
    const projectedTable = document.getElementById('projectedTable');
    const currentRows = ExcelExportHelper.tableToAoA(currentTable);
    const projectedRows = ExcelExportHelper.tableToAoA(projectedTable);

    if (!currentRows.length && !projectedRows.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد بيانات جاهزة للتصدير.' });
        return;
    }

    const settings = institutionSettings || await DB.getSettings();
    const trimesterText = document.getElementById('trimesterSelect')?.selectedOptions?.[0]?.textContent || '';
    const currentYear = document.getElementById('currentYear')?.value || '';
    const nextYear = document.getElementById('nextYear')?.value || '';
    const metaRows = [
        `المؤسسة: ${settings.institutionName || ''}`,
        `السنة الحالية: ${currentYear} | السنة القادمة: ${nextYear}`,
        `الفصل المعتمد: ${trimesterText}`
    ];

    const sheets = [];
    if (currentRows.length) {
        sheets.push({
            sheetName: 'الوضعية الحالية',
            title: 'تحضير الدخول المدرسي - الوضعية الحالية',
            metaRows,
            table: currentTable
        });
    }
    if (projectedRows.length) {
        sheets.push({
            sheetName: 'الوضعية المتوقعة',
            title: 'تحضير الدخول المدرسي - الوضعية المتوقعة',
            metaRows,
            table: projectedTable
        });
    }

    await ExcelExportHelper.exportWorkbook({
        fileName: `تحضير_الدخول_${ExcelExportHelper.dateStamp()}.xlsx`,
        sheets
    });
}
window.addEventListener('load', () => {
    exportSchoolEntryToExcel = async function () {
        if (!window.ExcelExportHelper) {
            Swal.fire({ icon: 'error', title: 'ط®ط·ط£', text: 'ظ…ظƒطھط¨ط© ط§ظ„طھطµط¯ظٹط± ط؛ظٹط± ظ…طھط§ط­ط© ط­ط§ظ„ظٹط§ظ‹.' });
            return;
        }

        const settings = institutionSettings || await DB.getSettings();
        const trimesterText = document.getElementById('trimesterSelect')?.selectedOptions?.[0]?.textContent || '';
        const currentYear = document.getElementById('currentYear')?.value || '';
        const nextYear = document.getElementById('nextYear')?.value || '';
        const metaRows = [
            `ط§ظ„ظ…ط¤ط³ط³ط©: ${settings.institutionName || ''}`,
            `ط§ظ„ط³ظ†ط© ط§ظ„ط­ط§ظ„ظٹط©: ${currentYear} | ط§ظ„ط³ظ†ط© ط§ظ„ظ‚ط§ط¯ظ…ط©: ${nextYear}`,
            `ط§ظ„ظپطµظ„ ط§ظ„ظ…ط¹طھظ…ط¯: ${trimesterText}`
        ];

        const sheets = Array.from(document.querySelectorAll('.stats-section table.stats-table'))
            .filter((table) => ExcelExportHelper.tableToAoA(table).length)
            .map((table, index) => {
                const section = table.closest('.stats-section');
                const sectionTitle = section?.querySelector('.section-title')?.textContent?.replace(/\s+/g, ' ').trim();
                const title = sectionTitle || `School Entry Table ${index + 1}`;

                return {
                    sheetName: title,
                    title,
                    metaRows,
                    table
                };
            });

        if (!sheets.length) {
            Swal.fire({ icon: 'warning', title: 'طھظ†ط¨ظٹظ‡', text: 'ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ط¬ط§ظ‡ط²ط© ظ„ظ„طھطµط¯ظٹط±.' });
            return;
        }

        await ExcelExportHelper.exportWorkbook({
            fileName: `طھط­ط¶ظٹط±_ط§ظ„ط¯ط®ظˆظ„_${ExcelExportHelper.dateStamp()}.xlsx`,
            sheets
        });
    };
});
window.addEventListener('load', () => {
    exportSchoolEntryToExcel = async function () {
        if (!window.ExcelExportHelper) {
            Swal.fire({
                icon: 'error',
                title: '\u062E\u0637\u0623',
                text: '\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u062A\u0635\u062F\u064A\u0631 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u0627\u064B.'
            });
            return;
        }

        const settings = institutionSettings || await DB.getSettings();
        const trimesterText = document.getElementById('trimesterSelect')?.selectedOptions?.[0]?.textContent || '';
        const currentYear = document.getElementById('currentYear')?.value || '';
        const nextYear = document.getElementById('nextYear')?.value || '';
        const metaRows = [
            `\u0627\u0644\u0645\u0624\u0633\u0633\u0629: ${settings.institutionName || ''}`,
            `\u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629: ${currentYear} | \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629: ${nextYear}`,
            `\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u0645\u0639\u062A\u0645\u062F: ${trimesterText}`
        ];

        const sectionTables = Array.from(document.querySelectorAll('.stats-section'))
            .filter((section) => window.getComputedStyle(section).display !== 'none')
            .map((section) => {
                const table = section.querySelector('table.stats-table');
                const rows = ExcelExportHelper.tableToAoA(table);
                if (!table || !rows.length) return null;

                const sectionTitle = section?.querySelector('.section-title')?.textContent?.replace(/\s+/g, ' ').trim();
                return {
                    title: sectionTitle || '',
                    rows
                };
            })
            .filter(Boolean);

        if (!sectionTables.length) {
            Swal.fire({
                icon: 'warning',
                title: '\u062A\u0646\u0628\u064A\u0647',
                text: '\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u062A\u0635\u062F\u064A\u0631.'
            });
            return;
        }

        const combinedRows = [];
        sectionTables.forEach((section, index) => {
            if (section.title) {
                combinedRows.push([section.title]);
            }

            section.rows.forEach((row) => combinedRows.push(row));

            if (index < sectionTables.length - 1) {
                combinedRows.push([]);
            }
        });

        await ExcelExportHelper.exportWorkbook({
            fileName: `\u062A\u062D\u0636\u064A\u0631_\u0627\u0644\u062F\u062E\u0648\u0644_${ExcelExportHelper.dateStamp()}.xlsx`,
            sheets: [{
                sheetName: '\u062A\u062D\u0636\u064A\u0631 \u0627\u0644\u062F\u062E\u0648\u0644',
                title: '\u062A\u062D\u0636\u064A\u0631 \u0627\u0644\u062F\u062E\u0648\u0644',
                metaRows,
                rows: combinedRows
            }]
        });
    };
});
