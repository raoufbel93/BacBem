function getStudentYear(s) {
    return s.academic_year || s.schoolYear || s.year || '';
}
/**

 * Census Page - Student Statistics (التعداد)

 * Shows comprehensive student counts by level, gender, and repeater status

 */

// Global variables

let allStudents = [];

let institutionSettings = {};

let signatureSettings = {};

let levelChart = null;

let genderChart = null;

let repeaterChart = null;

let isSecondary = false;

// Initialize

document.addEventListener('DOMContentLoaded', async () => {

    await loadGlobalData();

    populateFilters();

    updateStats();

});

/**

 * Load data from storage

 */

async function loadGlobalData() {

    // Load settings

    institutionSettings = await DB.getSettings() || {};

    isSecondary = institutionSettings.educationStage === 'secondary';

    signatureSettings = await DB.get('signatureSettings') || {};

    // Load students

    allStudents = await DB.getStudents(false, true) || []; // Fetch all years

    if (allStudents.length === 0) {

        showNoDataMessage();

    }

}

/**

 * Show no data message

 */

function showNoDataMessage() {

    const container = document.querySelector('.container');

    const msg = document.createElement('div');

    msg.innerHTML = `

        <div style="text-align: center; background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(245, 158, 11, 0.3);">

            <h3>&#9888;&#65039; لا توجد بيانات تلاميذ</h3>

            <p>يرجى استيراد قائمة التلاميذ أولا من صفحة "استيراد التلاميذ"</p>

            <a href="import_students.html" style="display: inline-block; margin-top: 10px; padding: 10px 20px; background: #e67e22; color: white; text-decoration: none; border-radius: 8px;">&#128229; استيراد التلاميذ</a>

        </div>

    `;

    container.insertBefore(msg, container.querySelector('.filters-section'));

}

/**

 * Normalize level string to number

 */

function getLevelNum(lvlStr) {

    if (!lvlStr) return 0;

    let s = lvlStr.toString().trim();

    const normalize = (text) => text.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');

    const normS = normalize(s);

    if (s.includes('1')) return 1;

    if (s.includes('2')) return 2;

    if (s.includes('3')) return 3;

    if (s.includes('4')) return 4;

    if (normS.includes('اولي') || normS.includes('اولى') || s.includes('أولى')) return 1;

    if (normS.includes('ثاني')) return 2;

    if (normS.includes('ثالث')) return 3;

    if (normS.includes('رابع')) return 4;

    return 0;

}

/**

 * Get level label

 */

function getLevelLabel(num) {

    if (isSecondary) {

        const labels = {

            1: 'السنة الأولى ثانوي',

            2: 'السنة الثانية ثانوي',

            3: 'السنة الثالثة ثانوي'

        };

        return labels[num] || 'غير محدد';

    }

    const labels = {

        1: 'السنة الأولى متوسط',

        2: 'السنة الثانية متوسط',

        3: 'السنة الثالثة متوسط',

        4: 'السنة الرابعة متوسط'

    };

    return labels[num] || 'غير محدد';

}

/**

 * Check if student is male

 */

function isMale(student) {

    const g = student.gender;

    return g === 'M' || g === 'ذكر' || g === 'ذ';

}

/**

 * Check if student is repeater

 */

function isRepeater(student) {

    // First check the 'repeat' field (from import_students.js - boolean)

    if (typeof student.repeat === 'boolean') {

        return student.repeat;

    }

    // Check other possible field names

    const r = student.repeat || student.is_repeater || student.repeater || student.معيد;

    if (!r) return false;

    if (typeof r === 'boolean') return r;

    const s = r.toString().toLowerCase().trim();

    return s === 'نعم' || s === 'yes' || s === '1' || s === 'true' || s === 'معيد';

}

/**

 * Populate filter dropdowns

 */

function normalizeStudentStatus(student) {

    const rawStatus = student && student.status != null ? String(student.status).trim() : '';

    if (!rawStatus) return 'ط®ط§ط±ط¬ظٹ';

    const normalized = rawStatus.toLowerCase();

    if (
        normalized === 'half_board' ||
        normalized.includes('ظ†طµظپ') ||
        normalized.includes('demi') ||
        normalized.includes('half') ||
        normalized.includes('ظ†.ط¯') ||
        normalized.includes('ظ†-ط¯')
    ) {
        return 'ظ†طµظپ ط¯ط§ط®ظ„ظٹ';
    }

    if (
        normalized === 'boarding' ||
        normalized.includes('ط¯ط§ط®ظ„ظٹ') ||
        normalized.includes('intern') ||
        normalized.includes('pension')
    ) {
        return 'ط¯ط§ط®ظ„ظٹ';
    }

    if (
        normalized === 'external' ||
        normalized.includes('ط®ط§ط±ط¬ظٹ') ||
        normalized.includes('extern')
    ) {
        return 'ط®ط§ط±ط¬ظٹ';
    }

    return 'ط®ط§ط±ط¬ظٹ';

}

function normalizeStudentStatusKey(student) {

    const rawStatus = student && student.status != null ? String(student.status).toLowerCase().trim() : '';

    if (!rawStatus || rawStatus === 'external') return 'external';

    if (
        rawStatus === 'half_board' ||
        rawStatus.indexOf('half') !== -1 ||
        rawStatus.indexOf('demi') !== -1
    ) {
        return 'half_board';
    }

    if (
        rawStatus === 'boarding' ||
        rawStatus.indexOf('intern') !== -1 ||
        rawStatus.indexOf('pension') !== -1 ||
        (rawStatus.indexOf('board') !== -1 && rawStatus.indexOf('half') === -1)
    ) {
        return 'boarding';
    }

    return 'external';

}

function populateFilters() {
    const years = new Set();
    const levels = new Set();
    const classes = new Set();

    allStudents.forEach(s => {
        const y = getStudentYear(s);
        if (y) years.add(y);
        if (s.level) levels.add(s.level);
        if (s.class) classes.add(s.class);
    });

    // Fallback: If no years found in students, add current year from settings
    if (years.size === 0 && institutionSettings && (institutionSettings.schoolYear || institutionSettings.currentAcademicYear)) {
        years.add(institutionSettings.schoolYear || institutionSettings.currentAcademicYear);
    }

    // Final Fallback: System calculated year
    if (years.size === 0) {
        years.add(DB.getCurrentAcademicYear());
    }

    // Year filter
    const yearSelect = document.getElementById('yearFilter');
    if (yearSelect) {
        const currentSelection = yearSelect.value;
        yearSelect.innerHTML = '';
        [...years].sort((a, b) => b.localeCompare(a)).forEach(y => {
            yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
        });

        if (currentSelection && years.has(currentSelection)) {
            yearSelect.value = currentSelection;
        } else if (years.size > 0) {
            // Select latest year by default
            yearSelect.value = [...years].sort((a, b) => b.localeCompare(a))[0];
        }
    }

    // Level filter
    const levelSelect = document.getElementById('levelFilter');
    levelSelect.innerHTML = '<option value="">جميع المستويات</option>';
    [...levels].sort().forEach(lvl => {
        levelSelect.innerHTML += `<option value="${lvl}">${lvl}</option>`;
    });

    // Class filter
    const classSelect = document.getElementById('classFilter');
    classSelect.innerHTML = '<option value="">جميع الأقسام</option>';
    [...classes].sort().forEach(cls => {
        classSelect.innerHTML += `<option value="${cls}">${cls}</option>`;
    });
}

/**

 * Update class filter based on level selection

 */

function updateClassFilter() {
    const yearFilter = document.getElementById('yearFilter')?.value;
    const selectedLevel = document.getElementById('levelFilter').value;
    const classSelect = document.getElementById('classFilter');

    const classes = new Set();
    allStudents.forEach(s => {
        if ((!yearFilter || getStudentYear(s) === yearFilter) && (!selectedLevel || s.level === selectedLevel)) {
            if (s.class) classes.add(s.class);
        }
    });

    const currentClass = classSelect.value;
    classSelect.innerHTML = '<option value="">جميع الأقسام</option>';
    [...classes].sort().forEach(cls => {
        classSelect.innerHTML += `<option value="${cls}">${cls}</option>`;
    });
    if (currentClass && classes.has(currentClass)) {
        classSelect.value = currentClass;
    }
}

/**

 * Get filtered students

 */

function getFilteredStudents() {
    const yearFilter = document.getElementById('yearFilter')?.value;
    const levelFilter = document.getElementById('levelFilter').value;
    const classFilter = document.getElementById('classFilter').value;

    return allStudents.filter(s => {
        if (yearFilter && getStudentYear(s) !== yearFilter) return false;
        if (levelFilter && s.level !== levelFilter) return false;
        if (classFilter && s.class !== classFilter) return false;
        return true;
    });
}

/**

 * Calculate statistics

 */

function calculateStats(students) {

    const stats = {

        total: students.length,

        male: 0,

        female: 0,

        repeaters: 0,

        byLevel: {}

    };

    // Initialize levels

    const maxLevel = isSecondary ? 3 : 4;

    for (let i = 1; i <= maxLevel; i++) {

        stats.byLevel[i] = { total: 0, male: 0, female: 0, repeaters: 0, streams: {} };

    }

    students.forEach(s => {

        const male = isMale(s);

        const repeater = isRepeater(s);

        const levelNum = getLevelNum(s.level);

        if (male) stats.male++; else stats.female++;

        if (repeater) stats.repeaters++;

        if (stats.byLevel[levelNum]) {

            const lvlStats = stats.byLevel[levelNum];

            lvlStats.total++;

            if (male) lvlStats.male++; else lvlStats.female++;

            if (repeater) lvlStats.repeaters++;

            // Stream Aggregation for Secondary

            if (isSecondary && s.stream) {

                const streamKey = s.stream;

                if (!lvlStats.streams[streamKey]) {

                    lvlStats.streams[streamKey] = { total: 0, male: 0, female: 0, repeaters: 0 };

                }

                const stStats = lvlStats.streams[streamKey];

                stStats.total++;

                if (male) stStats.male++; else stStats.female++;

                if (repeater) stStats.repeaters++;

            }

        }

    });

    return stats;

}

/**

 * Update all statistics and charts

 */

function updateStats() {

    updateClassFilter();

    const students = getFilteredStudents();

    const stats = calculateStats(students);

    // Update cards

    document.getElementById('totalCount').textContent = stats.total;

    document.getElementById('maleCount').textContent = stats.male;

    document.getElementById('femaleCount').textContent = stats.female;

    document.getElementById('repeaterCount').textContent = stats.repeaters;

    // Update table

    updateLevelTable(stats);

    // Update status (regime) table

    updateStatusTable(students);

    // Update charts

    updateCharts(stats);

    // Update print header

    updatePrintHeader(stats);

}

/**

 * Update level table

 */

function updateLevelTable(stats) {

    const tbody = document.getElementById('levelTableBody');

    const tableHeader = document.querySelector('#levelTable thead tr');

    // Adjust Header for Secondary

    if (isSecondary) {

        tableHeader.innerHTML = `

            <th>المستوى / الشعبة</th>

            <th>إجمالي التلاميذ</th>

            <th>الذكور</th>

            <th>الإناث</th>

            <th>المعيدون</th>

        `;

    } else {

        tableHeader.innerHTML = `

            <th>المستوى</th>

            <th>إجمالي التلاميذ</th>

            <th>الذكور</th>

            <th>الإناث</th>

            <th>المعيدون</th>

        `;

    }

    let html = '';

    let totals = { total: 0, male: 0, female: 0, repeaters: 0 };

    const maxLevel = isSecondary ? 3 : 4;

    for (let i = 1; i <= maxLevel; i++) {

        const lvl = stats.byLevel[i];

        if (!lvl) continue; // Safety check

        // Level Row (Main)

        html += `

            <tr style="background-color: var(--secondary-color)15;">

                <td><strong>${getLevelLabel(i)}</strong></td>

                <td><strong>${lvl.total}</strong></td>

                <td><strong>${lvl.male}</strong></td>

                <td><strong>${lvl.female}</strong></td>

                <td><strong>${lvl.repeaters}</strong></td>

            </tr>

        `;

        if (isSecondary && lvl.streams) {

            const streamKeys = Object.keys(lvl.streams).sort();

            streamKeys.forEach(key => {

                const s = lvl.streams[key];

                const streamName = (typeof SubjectManager !== 'undefined') ? SubjectManager.getStreamName(key) : key;

                html += `

                    <tr>

                        <td style="padding-right: 30px; color: var(--primary-color); opacity: 0.8;">${streamName}</td>

                        <td>${s.total}</td>

                        <td>${s.male}</td>

                        <td>${s.female}</td>

                        <td>${s.repeaters}</td>

                    </tr>

                `;

            });

        }

        totals.total += lvl.total;

        totals.male += lvl.male;

        totals.female += lvl.female;

        totals.repeaters += lvl.repeaters;

    }

    // Add total row

    html += `

        <tr class="total-row">

            <td><strong>المجموع الكلي</strong></td>

            <td><strong>${totals.total}</strong></td>

            <td><strong>${totals.male}</strong></td>

            <td><strong>${totals.female}</strong></td>

            <td><strong>${totals.repeaters}</strong></td>

        </tr>

    `;

    tbody.innerHTML = html;

}

/**

 * Update status (regime) table

 */

function updateStatusTable(students) {

    const tbody = document.getElementById('statusTableBody');

    if (!tbody) return;

    // Initialize status counts by level

    const statusByLevel = {};

    const maxLevel = isSecondary ? 3 : 4;

    for (let i = 1; i <= maxLevel; i++) {

        statusByLevel[i] = {

            'خارجي': { male: 0, female: 0 },

            'نصف داخلي': { male: 0, female: 0 },

            'داخلي': { male: 0, female: 0 }

        };

    }

    // Count students

    students.forEach(s => {

        const lvlNum = getLevelNum(s.level);

        const maxLvl = isSecondary ? 3 : 4;

        if (lvlNum < 1 || lvlNum > maxLvl) return;

        const normalizedStatusKey = normalizeStudentStatusKey(s);
        const genderKey = isMale(s) ? 'male' : 'female';
        const levelBuckets = statusByLevel[lvlNum];
        const bucketKeys = Object.keys(levelBuckets);
        const bucketMap = {
            external: levelBuckets[bucketKeys[0]],
            half_board: levelBuckets[bucketKeys[1]],
            boarding: levelBuckets[bucketKeys[2]]
        };

        bucketMap[normalizedStatusKey][genderKey]++;
        return;

        const status = s.status || 'خارجي';

        const isMaleStudent = isMale(s);

        // Normalize status

        let normalizedStatus = 'خارجي';

        if (status.includes('نصف') || status.includes('ن.')) {

            normalizedStatus = 'نصف داخلي';

        } else if (status.includes('داخلي') && !status.includes('نصف')) {

            normalizedStatus = 'داخلي';

        }

        if (isMaleStudent) {

            statusByLevel[lvlNum][normalizedStatus].male++;

        } else {

            statusByLevel[lvlNum][normalizedStatus].female++;

        }

    });

    // Build HTML

    let html = '';

    let totals = {

        'خارجي': { male: 0, female: 0 },

        'نصف داخلي': { male: 0, female: 0 },

        'داخلي': { male: 0, female: 0 }

    };

    let grandTotal = 0;

    const maxLevelPrint = isSecondary ? 3 : 4;

    for (let i = 1; i <= maxLevelPrint; i++) {

        const lvl = statusByLevel[i];

        if (!lvl) continue; // Safety check

        const rowTotal = lvl['خارجي'].male + lvl['خارجي'].female +

            lvl['نصف داخلي'].male + lvl['نصف داخلي'].female +

            lvl['داخلي'].male + lvl['داخلي'].female;

        html += `

            <tr>

                <td>${getLevelLabel(i)}</td>

                <td>${lvl['خارجي'].male}</td>

                <td>${lvl['خارجي'].female}</td>

                <td>${lvl['نصف داخلي'].male}</td>

                <td>${lvl['نصف داخلي'].female}</td>

                <td>${lvl['داخلي'].male}</td>

                <td>${lvl['داخلي'].female}</td>

                <td><strong>${rowTotal}</strong></td>

            </tr>

        `;

        // Update totals

        totals['خارجي'].male += lvl['خارجي'].male;

        totals['خارجي'].female += lvl['خارجي'].female;

        totals['نصف داخلي'].male += lvl['نصف داخلي'].male;

        totals['نصف داخلي'].female += lvl['نصف داخلي'].female;

        totals['داخلي'].male += lvl['داخلي'].male;

        totals['داخلي'].female += lvl['داخلي'].female;

        grandTotal += rowTotal;

    }

    // Add total row

    html += `

        <tr class="total-row">

            <td><strong>المجموع</strong></td>

            <td><strong>${totals['خارجي'].male}</strong></td>

            <td><strong>${totals['خارجي'].female}</strong></td>

            <td><strong>${totals['نصف داخلي'].male}</strong></td>

            <td><strong>${totals['نصف داخلي'].female}</strong></td>

            <td><strong>${totals['داخلي'].male}</strong></td>

            <td><strong>${totals['داخلي'].female}</strong></td>

            <td><strong>${grandTotal}</strong></td>

        </tr>

    `;

    tbody.innerHTML = html;

}

/**

 * Update all charts

 */

function updateCharts(stats) {

    const levels = isSecondary ? ['أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي'] : ['أولى متوسط', 'ثانية متوسط', 'ثالثة متوسط', 'رابعة متوسط'];

    const maxLevel = isSecondary ? 3 : 4;

    const totalData = [];

    const maleData = [];

    const femaleData = [];

    const repeaterData = [];

    for (let i = 1; i <= maxLevel; i++) {

        totalData.push(stats.byLevel[i].total);

        maleData.push(stats.byLevel[i].male);

        femaleData.push(stats.byLevel[i].female);

        repeaterData.push(stats.byLevel[i].repeaters);

    }

    // Level Chart

    if (levelChart) levelChart.destroy();

    const ctx1 = document.getElementById('levelChart').getContext('2d');

    levelChart = new Chart(ctx1, {

        type: 'bar',

        data: {

            labels: levels,

            datasets: [{

                label: 'إجمالي التلاميذ',

                data: totalData,

                backgroundColor: 'rgba(52, 152, 219, 0.7)',

                borderColor: 'rgba(52, 152, 219, 1)',

                borderWidth: 1

            }]

        },

        
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true, 
                    position: 'top',
                    labels: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#64748b' }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#334155' : 'var(--border-color)' },
                    ticks: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b' }
                }
            }
        }

    });

    // Gender Chart

    if (genderChart) genderChart.destroy();

    const ctx2 = document.getElementById('genderChart').getContext('2d');

    genderChart = new Chart(ctx2, {

        type: 'bar',

        data: {

            labels: levels,

            datasets: [

                {

                    label: 'ذكور',

                    data: maleData,

                    backgroundColor: 'rgba(54, 162, 235, 0.7)',

                    borderColor: 'rgba(54, 162, 235, 1)',

                    borderWidth: 1

                },

                {

                    label: 'إناث',

                    data: femaleData,

                    backgroundColor: 'rgba(255, 99, 132, 0.7)',

                    borderColor: 'rgba(255, 99, 132, 1)',

                    borderWidth: 1

                }

            ]

        },

        
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true, 
                    position: 'top',
                    labels: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#64748b' }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#334155' : 'var(--border-color)' },
                    ticks: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b' }
                }
            }
        }

    });

    // Repeater Chart

    if (repeaterChart) repeaterChart.destroy();

    const ctx3 = document.getElementById('repeaterChart').getContext('2d');

    repeaterChart = new Chart(ctx3, {

        type: 'bar',

        data: {

            labels: levels,

            datasets: [{

                label: 'المعيدون',

                data: repeaterData,

                backgroundColor: 'rgba(243, 156, 18, 0.7)',

                borderColor: 'rgba(243, 156, 18, 1)',

                borderWidth: 1

            }]

        },

        
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true, 
                    position: 'top',
                    labels: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#64748b' }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#334155' : 'var(--border-color)' },
                    ticks: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b' }
                }
            }
        }

    });

}

/**

 * Update print header

 */

function updatePrintHeader(stats) {

    const settings = institutionSettings;

    const levelFilter = document.getElementById('levelFilter').value;

    const classFilter = document.getElementById('classFilter').value;

    let filterText = 'جميع التلاميذ';

    if (levelFilter) filterText = `المستوى: ${levelFilter}`;

    if (classFilter) filterText += ` - القسم: ${classFilter}`;

    const header = document.getElementById('printHeader');

    header.innerHTML = `

        <div style="text-align:center; margin-bottom: 10px;">

            <h3 style="margin:0; font-size: 14pt;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

            <h3 style="margin:2px 0; font-size: 12pt;">وزارة التربية الوطنية</h3>

        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px;">

            <div style="text-align:right; width: 33%;">

                <h3 style="margin:0; font-size: 11pt;">مديرية التربية لولاية ${settings.wilaya || '.......'}</h3>

                <h3 style="margin:2px 0 0 0; font-size: 11pt;">المؤسسة: ${settings.institutionName || '.......'}</h3>

            </div>

            <div style="text-align:center; width: 33%;">

                <h2 style="margin:0; text-decoration: underline; font-size: 16pt;">التعداد</h2>

                <p style="margin: 5px 0 0 0; font-size: 10pt;">${filterText}</p>

            </div>

            <div style="text-align:left; width: 33%;">

                <h3 style="margin:0; font-size: 12pt;">السنة الدراسية: ${getStudentYear(allStudents[0] || {}) || '2025/2026'}</h3>

            </div>

        </div>

    `;

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

    // Get signer info from signature settings

    const sigSettings = signatureSettings;

    const reportConfig = sigSettings.reportSettings?.['census'] || { signer: 'director', showSignature: true };

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    // Determine title based on signer type and gender

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }

    const signerName = signerData.fullName || settings.managerName || '';

    // Get chart images

    const levelChartImg = document.getElementById('levelChart').toDataURL('image/png');

    const genderChartImg = document.getElementById('genderChart').toDataURL('image/png');

    const repeaterChartImg = document.getElementById('repeaterChart').toDataURL('image/png');

    // Get content

    const headerContent = document.getElementById('printHeader').innerHTML;

    const tableContent = document.getElementById('levelTableSection').innerHTML;

    const statusTableContent = document.getElementById('statusTableSection').innerHTML;

    const cardsContent = document.getElementById('statsCards').innerHTML;

    const printWin = window.open('', '_blank');

    printWin.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>التعداد - طباعة</title>
            <link rel="stylesheet" href="assets/fontawesome/css/all.min.css">

            <style>

                * { box-sizing: border-box; }

                body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 10mm; direction: rtl; }

                /* Stats Cards */

                .stats-cards {

                    display: flex;

                    gap: 10px;

                    margin-bottom: 15px;

                    justify-content: center;

                }

                .stat-card {

                    background: var(--bg-color);

                    padding: 10px 20px;

                    border-radius: 8px;

                    text-align: center;

                    border: 1px solid #ddd;

                }

                .stat-value { font-size: 1.5rem; font-weight: bold; }

                .stat-label { font-size: 0.85rem; color: #666; }

                /* Table */

                .section-title {

                    text-align: center;

                    font-weight: bold;

                    font-size: 12pt;

                    margin: 15px 0 10px 0;

                    border-bottom: 1px solid #000;

                    padding-bottom: 5px;

                }

                .stats-table {

                    width: 100%;

                    border-collapse: collapse;

                    text-align: center;

                    font-size: 10pt;

                }

                .stats-table th, .stats-table td {

                    border: 1px solid #000;

                    padding: 6px 8px;

                }

                .stats-table th {

                    background-color: #eee !important;

                    -webkit-print-color-adjust: exact;

                }

                .total-row {

                    background-color: #e8f8f5 !important;

                    -webkit-print-color-adjust: exact;

                }

                /* Charts */

                .charts-container {

                    display: flex;

                    flex-wrap: wrap;

                    gap: 15px;

                    margin-top: 20px;

                    justify-content: center;

                }

                .chart-box {

                    width: 48%;

                    text-align: center;

                }

                .chart-box img {

                    max-width: 100%;

                    height: auto;

                }

                .chart-title {

                    font-weight: bold;

                    font-size: 11pt;

                    margin-bottom: 5px;

                }

                /* Footer */

                .print-footer {

                    margin-top: 30px;

                    display: flex;

                    justify-content: space-between;

                    font-size: 11pt;

                }

                @media print {

                    @page { size: A4; margin: 0.8cm; }

                    body { -webkit-print-color-adjust: exact; }

                }

            </style>

        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
</head>

        <body>
${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            <div id="printHeader">${headerContent}</div>

            <div class="stats-cards">${cardsContent}</div>

            <div>${tableContent}</div>

            <div>${statusTableContent}</div>

            <!-- Page 2: Charts -->

            <div style="page-break-before: always;"></div>

            <div style="text-align: center; margin-bottom: 15px;">

                <div class="chart-title">التعداد حسب المستوى</div>

                <img src="${levelChartImg}" alt="Level Chart" style="width: 100%; max-height: 220px; margin-bottom: 15px;">

            </div>

            <div style="text-align: center; margin-bottom: 15px;">

                <div class="chart-title">مقارنة الذكور والإناث</div>

                <img src="${genderChartImg}" alt="Gender Chart" style="width: 100%; max-height: 220px; margin-bottom: 15px;">

            </div>

            <div style="text-align: center;">

                <div class="chart-title">المعيدون حسب المستوى</div>

                <img src="${repeaterChartImg}" alt="Repeater Chart" style="width: 100%; max-height: 180px;">

            </div>

            <div class="print-footer" style="margin-top: 50px; display: flex; flex-direction: column; align-items: flex-end; padding-left: 20px;">
                <div style="font-size: 12pt;">حرر بـ ${city} في: ${today}</div>
                <div style="font-size: 12pt; margin-top: 5px; text-align: center; width: fit-content;">${signerTitle}</div>
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

async function exportCensusToExcel() {
    if (!window.ExcelExportHelper) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'مكتبة التصدير غير متاحة حالياً.' });
        return;
    }

    const levelTable = document.getElementById('levelTable');
    const statusTable = document.getElementById('statusTable');
    const levelRows = ExcelExportHelper.tableToAoA(levelTable);
    const statusRows = ExcelExportHelper.tableToAoA(statusTable);

    if (!levelRows.length && !statusRows.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد بيانات جاهزة للتصدير.' });
        return;
    }

    const metaRows = [
        `المؤسسة: ${institutionSettings.institutionName || ''}`,
        `السنة الدراسية: ${document.getElementById('yearFilter')?.value || institutionSettings.schoolYear || ''}`,
        `المستوى: ${document.getElementById('levelFilter')?.selectedOptions?.[0]?.textContent || 'جميع المستويات'} | القسم: ${document.getElementById('classFilter')?.selectedOptions?.[0]?.textContent || 'جميع الأقسام'}`
    ];

    const sheets = [];
    if (levelRows.length) {
        sheets.push({
            sheetName: 'حسب المستوى',
            title: 'التعداد حسب المستوى',
            metaRows,
            table: levelTable
        });
    }
    if (statusRows.length) {
        sheets.push({
            sheetName: 'حسب الصفة',
            title: 'التعداد حسب الصفة',
            metaRows,
            table: statusTable
        });
    }

    await ExcelExportHelper.exportWorkbook({
        fileName: `التعداد_الاحصائي_${ExcelExportHelper.dateStamp()}.xlsx`,
        sheets
    });
}
async function exportCensusToExcel() {
    if (!window.ExcelExportHelper) {
        Swal.fire({ icon: 'error', title: 'ط®ط·ط£', text: 'ظ…ظƒطھط¨ط© ط§ظ„طھطµط¯ظٹط± ط؛ظٹط± ظ…طھط§ط­ط© ط­ط§ظ„ظٹط§ظ‹.' });
        return;
    }

    const availableTables = Array.from(document.querySelectorAll('.stats-section table.stats-table'))
        .filter((table) => ExcelExportHelper.tableToAoA(table).length);

    if (!availableTables.length) {
        Swal.fire({ icon: 'warning', title: 'طھظ†ط¨ظٹظ‡', text: 'ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ط¬ط§ظ‡ط²ط© ظ„ظ„طھطµط¯ظٹط±.' });
        return;
    }

    const metaRows = [
        `ط§ظ„ظ…ط¤ط³ط³ط©: ${institutionSettings.institutionName || ''}`,
        `ط§ظ„ط³ظ†ط© ط§ظ„ط¯ط±ط§ط³ظٹط©: ${document.getElementById('yearFilter')?.value || institutionSettings.schoolYear || ''}`,
        `ط§ظ„ظ…ط³طھظˆظ‰: ${document.getElementById('levelFilter')?.selectedOptions?.[0]?.textContent || 'ط¬ظ…ظٹط¹ ط§ظ„ظ…ط³طھظˆظٹط§طھ'} | ط§ظ„ظ‚ط³ظ…: ${document.getElementById('classFilter')?.selectedOptions?.[0]?.textContent || 'ط¬ظ…ظٹط¹ ط§ظ„ط£ظ‚ط³ط§ظ…'}`
    ];

    const sheets = availableTables.map((table, index) => {
        const section = table.closest('.stats-section');
        const sectionTitle = section?.querySelector('.section-title, .chart-title')?.textContent?.replace(/\s+/g, ' ').trim();
        const title = sectionTitle || `Census Table ${index + 1}`;

        return {
            sheetName: title,
            title,
            metaRows,
            table
        };
    });

    await ExcelExportHelper.exportWorkbook({
        fileName: `ط§ظ„طھط¹ط¯ط§ط¯_ط§ظ„ط§ط­طµط§ط¦ظٹ_${ExcelExportHelper.dateStamp()}.xlsx`,
        sheets
    });
}
window.addEventListener('load', () => {
    exportCensusToExcel = async function () {
        if (!window.ExcelExportHelper) {
            Swal.fire({ icon: 'error', title: 'ط®ط·ط£', text: 'ظ…ظƒطھط¨ط© ط§ظ„طھطµط¯ظٹط± ط؛ظٹط± ظ…طھط§ط­ط© ط­ط§ظ„ظٹط§ظ‹.' });
            return;
        }

        const availableTables = Array.from(document.querySelectorAll('.stats-section table.stats-table'))
            .filter((table) => ExcelExportHelper.tableToAoA(table).length);

        if (!availableTables.length) {
            Swal.fire({ icon: 'warning', title: 'طھظ†ط¨ظٹظ‡', text: 'ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ط¬ط§ظ‡ط²ط© ظ„ظ„طھطµط¯ظٹط±.' });
            return;
        }

        const metaRows = [
            `ط§ظ„ظ…ط¤ط³ط³ط©: ${institutionSettings.institutionName || ''}`,
            `ط§ظ„ط³ظ†ط© ط§ظ„ط¯ط±ط§ط³ظٹط©: ${document.getElementById('yearFilter')?.value || institutionSettings.schoolYear || ''}`,
            `ط§ظ„ظ…ط³طھظˆظ‰: ${document.getElementById('levelFilter')?.selectedOptions?.[0]?.textContent || 'ط¬ظ…ظٹط¹ ط§ظ„ظ…ط³طھظˆظٹط§طھ'} | ط§ظ„ظ‚ط³ظ…: ${document.getElementById('classFilter')?.selectedOptions?.[0]?.textContent || 'ط¬ظ…ظٹط¹ ط§ظ„ط£ظ‚ط³ط§ظ…'}`
        ];

        const sheets = availableTables.map((table, index) => {
            const section = table.closest('.stats-section');
            const sectionTitle = section?.querySelector('.section-title, .chart-title')?.textContent?.replace(/\s+/g, ' ').trim();
            const title = sectionTitle || `Census Table ${index + 1}`;

            return {
                sheetName: title,
                title,
                metaRows,
                table
            };
        });

        await ExcelExportHelper.exportWorkbook({
            fileName: `ط§ظ„طھط¹ط¯ط§ط¯_ط§ظ„ط§ط­طµط§ط¦ظٹ_${ExcelExportHelper.dateStamp()}.xlsx`,
            sheets
        });
    };
});
window.addEventListener('load', () => {
    exportCensusToExcel = async function () {
        if (!window.ExcelExportHelper) {
            Swal.fire({
                icon: 'error',
                title: '\u062E\u0637\u0623',
                text: '\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u062A\u0635\u062F\u064A\u0631 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u0627\u064B.'
            });
            return;
        }

        const sectionTables = Array.from(document.querySelectorAll('.stats-section'))
            .filter((section) => window.getComputedStyle(section).display !== 'none')
            .map((section) => {
                const table = section.querySelector('table.stats-table');
                const rows = ExcelExportHelper.tableToAoA(table);
                if (!table || !rows.length) return null;

                const sectionTitle = section.querySelector('.section-title, .chart-title')?.textContent?.replace(/\s+/g, ' ').trim();
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

        const metaRows = [
            `\u0627\u0644\u0645\u0624\u0633\u0633\u0629: ${institutionSettings.institutionName || ''}`,
            `\u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629: ${document.getElementById('yearFilter')?.value || institutionSettings.schoolYear || ''}`,
            `\u0627\u0644\u0645\u0633\u062A\u0648\u0649: ${document.getElementById('levelFilter')?.selectedOptions?.[0]?.textContent || '\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0633\u062A\u0648\u064A\u0627\u062A'} | \u0627\u0644\u0642\u0633\u0645: ${document.getElementById('classFilter')?.selectedOptions?.[0]?.textContent || '\u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0642\u0633\u0627\u0645'}`
        ];

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
            fileName: `\u0627\u0644\u062A\u0639\u062F\u0627\u062F_\u0627\u0644\u0627\u062D\u0635\u0627\u0626\u064A_${ExcelExportHelper.dateStamp()}.xlsx`,
            sheets: [{
                sheetName: '\u0627\u0644\u062A\u0639\u062F\u0627\u062F',
                title: '\u0627\u0644\u062A\u0639\u062F\u0627\u062F',
                metaRows,
                rows: combinedRows
            }]
        });
    };
});
