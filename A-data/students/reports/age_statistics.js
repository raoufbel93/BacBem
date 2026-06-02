

document.addEventListener('DOMContentLoaded', async () => {

    await loadAndCalculateStats();

});

let generalStatsData = null; // Store for print

let chartInstance = null;

async function loadAndCalculateStats() {

    // Load Settings

    const settings = await DB.getSettings();

    // Load Students

    const allStudents = await DB.getStudents(false) || [];

    const isSecondary = settings.educationStage === 'secondary';

    if (allStudents.length === 0) {

        document.querySelector('.container').insertAdjacentHTML('beforeend', `<div style="text-align:center; color: red; margin-top: 20px;">${IconManager.get('warning')} لا توجد بيانات تلاميذ. يرجى استيراد القائمة أولا.</div>`);

        return;

    }

    // Determine academic year label shown in the report header.

    const getStudentAcademicYear = (student) => {

        if (!student) return '';

        const rawYear = student.academic_year || student.schoolYear || student.year || student.school_year;

        return rawYear ? rawYear.toString().trim() : '';

    };

    let displayYear = settings.schoolYear || settings.currentAcademicYear || DB.getCurrentAcademicYear() || '2025/2026';

    const sampleStudent = allStudents.find(s => getStudentAcademicYear(s));

    if (sampleStudent) {

        displayYear = getStudentAcademicYear(sampleStudent);

    }

    const today = new Date();

    // Helper: Safe Age Calculation based on full birth date.

    const getAge = (birthDateStr) => {

        if (!birthDateStr) return -1;

        let day = 0, month = 0, year = 0;

        if (birthDateStr.includes('/')) {

            const parts = birthDateStr.split('/');

            if (parts.length === 3) {

                if (parts[2].length === 4) { day = parseInt(parts[0]); month = parseInt(parts[1]); year = parseInt(parts[2]); }

                else if (parts[0].length === 4) { year = parseInt(parts[0]); month = parseInt(parts[1]); day = parseInt(parts[2]); }

            }

        } else if (birthDateStr.includes('-')) {

            const parts = birthDateStr.split('-');

            if (parts.length === 3) {

                if (parts[0].length === 4) { year = parseInt(parts[0]); month = parseInt(parts[1]); day = parseInt(parts[2]); }

                else if (parts[2].length === 4) { day = parseInt(parts[0]); month = parseInt(parts[1]); year = parseInt(parts[2]); }

            }

        }

        if (!year || isNaN(year)) return -1;

        let age = today.getFullYear() - year;

        if (month && day) {

            const hasHadBirthdayThisYear = (
                (today.getMonth() + 1) > month ||
                ((today.getMonth() + 1) === month && today.getDate() >= day)
            );

            if (!hasHadBirthdayThisYear) {

                age--;

            }

        }

        return age >= 0 ? age : -1;

    };

    // Helper: Level Normalizer

    const getLevelNum = (lvlStr) => {

        if (!lvlStr) return 0;

        let s = lvlStr.toString().trim();

        const normalize = (text) => text.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');

        const normS = normalize(s);

        if (s.includes('1')) return 1;

        if (s.includes('2')) return 2;

        if (s.includes('3')) return 3;

        if (s.includes('4')) return 4;

        // Secondary specific

        if (isSecondary) {

            if (normS.includes('اولي') || normS.includes('اولى')) return 1; // 1st AS

            if (normS.includes('ثاني')) return 2; // 2nd AS

            if (normS.includes('ثالث')) return 3; // 3rd AS

        }

        // Middle specific (or generic fallback)

        if (normS.includes('اولي') || normS.includes('اولى') || s.includes('أولى')) return 1;

        if (normS.includes('ثاني')) return 2;

        if (normS.includes('ثالث')) return 3;

        if (normS.includes('رابع')) return 4;

        return 0;

    };

    // Buckets & Stats Logic

    const bucketsDef = [

        { label: 'أقل من 10', check: (a) => a < 10 }, // Adjusted slightly for clarity

        { label: '10', check: (a) => a === 10 },

        { label: '11', check: (a) => a === 11 },

        { label: '12', check: (a) => a === 12 },

        { label: '13', check: (a) => a === 13 },

        { label: '14', check: (a) => a === 14 },

        { label: '15', check: (a) => a === 15 },

        { label: '16', check: (a) => a === 16 },

        { label: '17', check: (a) => a === 17 },

        { label: '18', check: (a) => a >= 18 } // Combined 18+ or stick to original? Original went up to 19.

    ];

    // Reverting to exact original buckets to match user expectation if they had specific needs

    // Original: 10 or less, 11...18, 19 or more.

    const bucketsDefOriginal = [

        { label: '10 أو أقل', check: (a) => a <= 10 },

        { label: '11', check: (a) => a === 11 },

        { label: '12', check: (a) => a === 12 },

        { label: '13', check: (a) => a === 13 },

        { label: '14', check: (a) => a === 14 },

        { label: '15', check: (a) => a === 15 },

        { label: '16', check: (a) => a === 16 },

        { label: '17', check: (a) => a === 17 },

        { label: '18', check: (a) => a === 18 },

        { label: '19 أو أكثر', check: (a) => a >= 19 }

    ];

    const createStatsObject = () => ({

        buckets: bucketsDefOriginal.map(b => ({ label: b.label, total: 0, m: 0, f: 0 })),

        totals: { total: 0, m: 0, f: 0 }

    });

    const generalStats = createStatsObject();

    const levelStats = {

        1: createStatsObject(),

        2: createStatsObject(),

        3: createStatsObject(),

        4: createStatsObject()

    };

    const unclassifiedCounts = {};

    allStudents.forEach(s => {

        const age = getAge(s.birth_date);

        if (age === -1) return;

        const levelNum = getLevelNum(s.level);

        const isMale = (s.gender === 'M' || s.gender === 'ذكر');

        const bIndex = bucketsDefOriginal.findIndex(b => b.check(age));

        if (bIndex === -1) return;

        // General

        generalStats.buckets[bIndex].total++;

        if (isMale) generalStats.buckets[bIndex].m++; else generalStats.buckets[bIndex].f++;

        generalStats.totals.total++;

        if (isMale) generalStats.totals.m++; else generalStats.totals.f++;

        // Per Level

        if (levelStats[levelNum]) {

            levelStats[levelNum].buckets[bIndex].total++;

            if (isMale) levelStats[levelNum].buckets[bIndex].m++; else levelStats[levelNum].buckets[bIndex].f++;

            levelStats[levelNum].totals.total++;

            if (isMale) levelStats[levelNum].totals.m++; else levelStats[levelNum].totals.f++;

        } else {

            const lName = s.level || '(فارغ)';

            if (!unclassifiedCounts[lName]) unclassifiedCounts[lName] = 0;

            unclassifiedCounts[lName]++;

        }

    });

    generalStatsData = generalStats; // Save for chart/print if needed

    // Warn about unclassified levels

    const unclassifiedKeys = Object.keys(unclassifiedCounts);

    if (unclassifiedKeys.length > 0) {

        let msg = `<div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ffeeba;"><strong>${IconManager.get('warning')} تنبيه: هناك مستويات لم يتم التعرف عليها:</strong><ul style="margin: 10px 0; padding-right: 20px;">`;

        unclassifiedKeys.forEach(k => {

            msg += `<li>"${k}": ${unclassifiedCounts[k]} تلميذ</li>`;

        });

        msg += '</ul></div>';

        const existingWarn = document.getElementById('unclassifiedWarn');

        if (existingWarn) existingWarn.remove();

        const warnDiv = document.createElement('div');

        warnDiv.id = 'unclassifiedWarn';

        warnDiv.innerHTML = msg;

        const pageHeader = document.querySelector('.page-header');

        if (pageHeader) {

            pageHeader.parentNode.insertBefore(warnDiv, pageHeader.nextSibling);

        }

    }

    // Render Function

    const renderTable = (tableId, data, showPercentage) => {

        const table = document.getElementById(tableId);

        if (!table) return;

        let thead = '<thead><tr><th style="width: 15%; background: #f0f0f0;">الأعمار</th>';

        data.buckets.forEach(b => thead += `<th>${b.label}</th>`);

        thead += '<th style="background: #e0e0e0;">المجموع</th></tr></thead>';

        let tbody = '<tbody>';

        // Row 1: Total

        tbody += '<tr><td class="row-label">عدد التلاميذ</td>';

        data.buckets.forEach(b => tbody += `<td><b>${b.total}</b></td>`);

        tbody += `<td style="background: var(--bg-color);"><b>${data.totals.total}</b></td></tr>`;

        // Row 2: Males

        tbody += '<tr><td class="row-label">ذكور</td>';

        data.buckets.forEach(b => tbody += `<td>${b.m}</td>`);

        tbody += `<td style="background: var(--bg-color);"><b>${data.totals.m}</b></td></tr>`;

        // Row 3: Females

        tbody += '<tr><td class="row-label">إناث</td>';

        data.buckets.forEach(b => tbody += `<td>${b.f}</td>`);

        tbody += `<td style="background: var(--bg-color);"><b>${data.totals.f}</b></td></tr>`;

        // Row 4: Percentages

        if (showPercentage && data.totals.total > 0) {

            tbody += '<tr><td class="row-label">النسبة</td>';

            data.buckets.forEach(b => {

                const pct = ((b.total / data.totals.total) * 100).toFixed(2) + '%';

                tbody += `<td>${pct}</td>`;

            });

            tbody += '<td style="background: var(--bg-color);">100%</td></tr>';

        }

        tbody += '</tbody>';

        table.innerHTML = thead + tbody;

    };

    // Render All

    renderTable('tableGeneral', generalStats, true);

    // Update Section Titles based on stage

    if (isSecondary) {

        document.querySelector('#secLvl1 .section-title').textContent = '2. السنة الأولى ثانوي';

        document.querySelector('#secLvl2 .section-title').textContent = '3. السنة الثانية ثانوي';

        document.querySelector('#secLvl3 .section-title').textContent = '4. السنة الثالثة ثانوي';

        // Hide Level 4

        if (document.getElementById('secLvl4')) {

            document.getElementById('secLvl4').style.display = 'none';

        }

    } else {

        // Reset to default if needed (Middle)

        document.querySelector('#secLvl1 .section-title').textContent = '2. السنة الأولى متوسط';

        document.querySelector('#secLvl2 .section-title').textContent = '3. السنة الثانية متوسط';

        document.querySelector('#secLvl3 .section-title').textContent = '4. السنة الثالثة متوسط';

        document.querySelector('#secLvl4 .section-title').textContent = '5. السنة الرابعة متوسط';

        if (document.getElementById('secLvl4')) {

            document.getElementById('secLvl4').style.display = 'block';

        }

    }

    renderTable('tableLevel1', levelStats[1], false);

    renderTable('tableLevel2', levelStats[2], false);

    renderTable('tableLevel3', levelStats[3], false);

    if (!isSecondary) {

        renderTable('tableLevel4', levelStats[4], false);

    }

    // Update Header Info

    const printHeader = document.getElementById('printHeader');

    if (printHeader) {

        printHeader.innerHTML = `

            <div style="text-align:center; margin-bottom: 10px;">

                <h3 style="margin:0; font-size: 14pt;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                <h3 style="margin:2px 0; font-size: 12pt;">وزارة التربية الوطنية</h3>

            </div>

            <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px; direction: rtl;">

                <div style="text-align:right; width: 33%;">

                    <h3 style="margin:0; font-size: 11pt;">مديرية التربية لولاية ${settings.wilaya || '.......'}</h3>

                    <h3 style="margin:2px 0 0 0; font-size: 11pt;">المؤسسة: ${settings.institutionName || '.......'}</h3>

                </div>

                <div style="text-align:center; width: 33%;">

                    <h2 style="margin:0; text-decoration: underline; font-size: 16pt;">إحصائيات الأعمار</h2>

                </div>

                <div style="text-align:left; width: 33%;">

                    <h3 style="margin:0; font-size: 12pt;">السنة الدراسية: ${displayYear}</h3>

                </div>

            </div>

        `;

    }

    // Render Chart

    renderAgeChart(generalStats);

}

function renderAgeChart(stats) {

    const ctx = document.getElementById('ageChart');

    if (!ctx) return;

    if (chartInstance) {

        chartInstance.destroy();

    }

    const labels = stats.buckets.map(b => b.label);

    const dataMale = stats.buckets.map(b => b.m);

    const dataFemale = stats.buckets.map(b => b.f);

    chartInstance = new Chart(ctx, {

        type: 'bar',

        data: {

            labels: labels,

            datasets: [

                {

                    label: 'ذكور',

                    data: dataMale,

                    backgroundColor: 'rgba(52, 152, 219, 0.7)', // Blue

                    borderColor: 'rgba(41, 128, 185, 1)',

                    borderWidth: 1

                },

                {

                    label: 'إناث',

                    data: dataFemale,

                    backgroundColor: 'rgba(231, 76, 60, 0.7)', // Red

                    borderColor: 'rgba(192, 57, 43, 1)',

                    borderWidth: 1

                }

            ]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            scales: {

                y: {

                    beginAtZero: true,

                    ticks: {

                        stepSize: 1

                    }

                }

            },

            plugins: {

                legend: {

                    position: 'top',

                    labels: {

                        font: {

                            family: 'Tajawal',

                            size: 12

                        }

                    }

                }

            }

        }

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

async function openPrintWindow() {
    if (blockTrialPrint()) return;

    // 0. Get Settings & Date

    const settings = await DB.getSettings();

    const city = settings.municipality || settings.wilaya || '.......';

    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // 1. Capture Chart Image

    const chartCanvas = document.getElementById('ageChart');

    let chartImgData = "";

    if (chartCanvas) {

        chartImgData = chartCanvas.toDataURL("image/png");

    }

    // 2. Get HTML Content

    const headerContent = document.getElementById('printHeader').innerHTML;

    const generalContent = document.getElementById('secGeneral').outerHTML;

    // We want to clone the levels container to manipulate it for print (hide lvl 4 if secondary)

    const levelsGrid = document.querySelector('.levels-grid-print');

    const levelsClone = levelsGrid.cloneNode(true);

    // Check if secondary based on stored stats or re-check settings (async here is tricky inside sync block logic flow if strictly following, but we can reuse isSecondary if global or derive)

    // Actually, openPrintWindow doesn't have access to isSecondary from the other scope easily unless global.

    // Let's re-check settings or rely on the DOM state (display:none is copied)

    // display:none IS copied by cloneNode, so if we hid it in UI, it should be hidden in print clone too.

    const levelsContent = levelsClone.outerHTML;

    // 3. Open New Window

    const printWin = window.open('', '_blank');

    if (!printWin) {

        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'يرجى السماح بالنوافذ المنبثقة للطباعة',
            confirmButtonText: 'حسناً'
        });

        return;

    }

    // 4. Construct Document

    printWin.document.write(`<!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <title>طباعة إحصائيات الأعمار</title>
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
            <style>
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

                body { font-family: 'Tajawal', sans-serif; -webkit-print-color-adjust: exact; margin: 0; padding: 0.5cm; }

                @media print {
                    @page { size: A4; margin: 0.5cm; }
                    body { margin: 0; }
                    .page-break { page-break-before: always; }
                }

                .print-container { width: 100%; }

                /* Replicating key styles for the print window */
                .section-title {
                    text-align: center; font-weight: bold; font-size: 11pt; margin: 5px 0 2px 0;
                    color: #000; border-bottom: 1px solid #000; padding-bottom: 2px;
                    display: block; width: 100%;
                    font-family: 'Tajawal', sans-serif;
                }
                table { width: 100%; border-collapse: collapse; text-align: center; font-size: 11pt; margin-bottom: 5px; }
                th, td {
                    border: 1pt solid #000 !important;
                    padding: 4px 6px;
                    border-radius: 0 !important;
                    color: #000 !important;
                    font-weight: bold !important;
                }
                th { background-color: #e0e0e0 !important; }

                * { border-radius: 0 !important; } /* Global override for print */

                /* Levels Grid - VERTICAL STACK ON SAME PAGE (Flow) */
                .levels-grid-print {
                    display: block;
                    width: 100%;
                    margin-top: 5px;
                    /* page-break-before: always; REMOVED */
                }

                .levels-grid-print .stats-section {
                    width: 100%;
                    box-sizing: border-box;
                    margin-bottom: 5px; /* Space between tables */
                    page-break-inside: avoid; /* Prevent table break */
                }

                .chart-wrapper { display: none; } /* HIDDEN */

                .print-footer {

                    margin-top: 20px;

                    display: flex;

                    justify-content: space-between;

                    direction: rtl;

                    page-break-inside: avoid;

                    font-size: 11pt;

                }

            </style>

        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
</head>

        <body>
${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            <div id="printHeader">

                ${headerContent}

            </div>

            ${generalContent}

            <!-- Chart Removed/Hidden -->

            ${levelsContent}

            <div class="print-footer" style="margin-top: 20px; display: flex; flex-direction: column; align-items: flex-end; padding-left: 20px;">
                <div style="font-size: 11pt;">حرر بـ ${city} في: ${today}</div>
                <div style="font-size: 11pt; margin-top: 5px; text-align: center; width: fit-content;">المدير</div>
            </div>

            <script>

                // window.onload auto-print removed

            </script>

        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
</body>

        </html>`);

    printWin.document.close();

}

async function exportAgeStatisticsToExcel() {
    if (!window.ExcelExportHelper) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'مكتبة التصدير غير متاحة حالياً.' });
        return;
    }

    const settings = await DB.getSettings();
    const sectionTables = Array.from(document.querySelectorAll('.stats-section'))
        .filter((section) => window.getComputedStyle(section).display !== 'none')
        .map((section) => {
            const table = section.querySelector('table.stats-table');
            const rows = ExcelExportHelper.tableToAoA(table);
            if (!table || !rows.length) return null;

            const sectionTitle = section.querySelector('.section-title')?.textContent?.replace(/\s+/g, ' ').trim();
            return { title: sectionTitle || '', rows };
        })
        .filter(Boolean);

    if (!sectionTables.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد جداول جاهزة للتصدير.' });
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
        fileName: `احصائيات_الاعمار_${ExcelExportHelper.dateStamp()}.xlsx`,
        sheets: [{
            sheetName: 'إحصائيات الأعمار',
            title: 'إحصائيات الأعمار',
            metaRows: [
                `المؤسسة: ${settings.institutionName || ''}`,
                `السنة الدراسية: ${settings.schoolYear || ''}`
            ],
            rows: combinedRows
        }]
    });
}
