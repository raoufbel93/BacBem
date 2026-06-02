/**

 * Absence Statistics Manager

 */

const streamAliases = {
    'common_science': 'ط¬ط°ط¹ ظ…ط´طھط±ظƒ ط¹ظ„ظˆظ… ظˆطھظƒظ†ظˆظ„ظˆط¬ظٹط§',
    'common_arts': 'ط¬ط°ط¹ ظ…ط´طھط±ظƒ ط¢ط¯ط§ط¨',
    'science': 'ط¹ظ„ظˆظ… طھط¬ط±ظٹط¨ظٹط©',
    'math': 'ط±ظٹط§ط¶ظٹط§طھ',
    'tech_math': 'تقني رياضي',
    'tech_math_civil': 'تقني رياضي (ظ‡ظ†ط¯ط³ط© ظ…ط¯ظ†ظٹط©)',
    'tech_math_mech': 'تقني رياضي (ظ‡ظ†ط¯ط³ط© ظ…ظٹظƒط§ظ†ظٹظƒظٹط©)',
    'tech_math_elec': 'تقني رياضي (ظ‡ظ†ط¯ط³ط© ظƒظ‡ط±ط¨ط§ط¦ظٹط©)',
    'tech_math_methods': 'تقني رياضي (ظ‡ظ†ط¯ط³ط© ط§ظ„ط·ط±ط§ط¦ظ‚)',
    'management': 'طھط³ظٹظٹط± ظˆط§ظ‚طھطµط§ط¯',
    'languages': 'ظ„ط؛ط§طھ ط£ط¬ظ†ط¨ظٹط©',
    'arts': 'ط¢ط¯ط§ط¨ ظˆظپظ„ط³ظپط©',
    'letters': 'ط¢ط¯ط§ط¨ ظˆظپظ„ط³ظپط©',
    'foreign_languages': 'ظ„ط؛ط§طھ ط£ط¬ظ†ط¨ظٹط©',
    'maths': 'ط±ظٹط§ط¶ظٹط§طھ'
};

function getStreamName(code) {
    if (!code) return '';
    return streamAliases[code] || code;
}

function formatLevelName(level, isSecondary) {
    if (!level) return '';
    // Extract numeric part to handle "1", "01", "1 ثانوي", "سنة 1"
    const match = String(level).match(/\d+/);
    const num = match ? parseInt(match[0], 10).toString() : level;

    if (!isSecondary) return `سنة ${num}`;
    const secondaryLevels = { '1': 'أولى ثانوي', '2': 'ثانية ثانوي', '3': 'ثالثة ثانوي' };
    return secondaryLevels[num] || `سنة ${level}`;
}

function setDefaultDateRange() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    if (!startDateInput || !endDateInput) return;

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const toISODate = (date) => date.toISOString().split('T')[0];

    if (!startDateInput.value) startDateInput.value = toISODate(startOfMonth);
    if (!endDateInput.value) endDateInput.value = toISODate(today);
}

function formatHoursValue(value) {
    const num = Number(value) || 0;
    if (Number.isInteger(num)) return String(num);
    return num.toFixed(2).replace(/\.?0+$/, '');
}

function calculateTimeRangeHours(from, to) {
    if (!from || !to) return 0;
    if (from === 'Present' || to === 'Present' || from === '-' || to === '-') return 0;

    const [startHour, startMinute] = String(from).split(':').map(Number);
    const [endHour, endMinute] = String(to).split(':').map(Number);

    if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return 0;

    const startTotalMinutes = (startHour * 60) + startMinute;
    const endTotalMinutes = (endHour * 60) + endMinute;
    if (endTotalMinutes <= startTotalMinutes) return 0;

    return (endTotalMinutes - startTotalMinutes) / 60;
}

function calculateStudentAbsenceHours(studentRecord) {
    const getSessionDuration = (session, fallbackHours) => {
        if (!session) return 0;

        const duration = calculateTimeRangeHours(session.from, session.to);
        if (duration > 0) return duration;

        const hasExplicitAbsence = [session.from, session.to].some(value =>
            value && value !== 'Present' && value !== '-'
        );

        return hasExplicitAbsence ? fallbackHours : 0;
    };

    const amHours = getSessionDuration(studentRecord.am, 4);
    const pmHours = getSessionDuration(studentRecord.pm, 4);
    return Math.round((amHours + pmHours) * 100) / 100;
}

document.addEventListener('DOMContentLoaded', async () => {

    // Check auth? (Shared nav handles this usually, but good practice)
    setDefaultDateRange();

    // Dynamic Level Population
    const settings = await DB.getSettings();
    const isSecondary = settings.educationStage === 'secondary';
    const levelSelect = document.getElementById('statsLevelSelect');

    if (levelSelect) {
        levelSelect.innerHTML = '<option value="">-- المستوى --</option>';
        if (isSecondary) {
            ['أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي'].forEach((lvl, idx) => {
                const opt = document.createElement('option');
                opt.value = (idx + 1).toString(); // Using 1, 2, 3 as values
                opt.text = lvl;
                levelSelect.appendChild(opt);
            });
        } else {
            ['أولى متوسط', 'ثانية متوسط', 'ثالثة متوسط', 'رابعة متوسط'].forEach(lvl => {
                const opt = document.createElement('option');
                opt.value = lvl; // Middle school uses full names often, or 1,2,3,4 depending on data consistency.
                // Let's stick to existing values in HTML for now or map them?
                // Existing HTML used full text values: value="أولى متوسط".
                // Let's keep that for Middle School to avoid breaking if data uses it.
                opt.value = lvl;
                opt.text = lvl;
                levelSelect.appendChild(opt);
            });
        }
    }

    // Setup Search

    document.getElementById('studentSearch').addEventListener('input', (e) => {

        filterStudentTable(e.target.value);

    });

    await loadStatistics();

});

let allStudentStats = []; // Store for filtering

// Update load stats to run on date change if needed, but we used a button.

async function loadStatistics() {
    try {
        const settings = await DB.getSettings();
        const isSecondary = settings.educationStage === 'secondary';

        const absenceRecords = await DB.getAllAbsencesExport() || [];
        const studentsList = await DB.getStudents(true) || [];

        if (absenceRecords.length === 0) {
            document.getElementById('studentStatsBody').innerHTML = '<tr><td colspan="6">لا توجد سجلات غيابات</td></tr>';
            return;
        }

        // --- FILTERING LOGIC ---
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        let filteredRecords = absenceRecords;
        if (startDate || endDate) {
            filteredRecords = absenceRecords.filter(r => {
                if (startDate && r.date < startDate) return false;
                if (endDate && r.date > endDate) return false;
                return true;
            });
        }

        const recordsToProcess = filteredRecords;

        // --- STATUS FILTER ---
        const statusSelect = document.getElementById('statsStatusSelect');
        const statusFilter = statusSelect ? statusSelect.value : 'active';

        // 1. Initialize Student Map
        const studentMap = new Map();

        studentsList.forEach(s => {
            const id = String(s.id || `${s.last_name}-${s.first_name}`);
            studentMap.set(id, {
                id: id,
                name: `${s.last_name} ${s.first_name}`,
                class: s.class,
                level: s.level,
                stream: s.stream,
                struck_off: s.struck_off,
                days: 0,
                hours: 0,
                totalSchoolDays: recordsToProcess.length
            });
        });

        // 2. Process Records
        recordsToProcess.forEach(record => {
            const students = record.students || [];
            if (!Array.isArray(students)) return;

            students.forEach(sRec => {
                const id = String(sRec.id);
                let stats = studentMap.get(id);

                if (!stats) {
                    stats = {
                        id: id,
                        name: `تلميذ أرشيف (${id})`,
                        class: '?',
                        level: '?',
                        stream: '?',
                        struck_off: true,
                        days: 0,
                        hours: 0
                    };
                    studentMap.set(id, stats);
                }

                stats.days++;
                const h = calculateStudentAbsenceHours(sRec);
                stats.hours = Math.round((stats.hours + h) * 100) / 100;
            });
        });

        // 2.5 Apply Status Filter
        for (const [id, stats] of studentMap.entries()) {
            const isStruckOff = stats.struck_off === true || (stats.name && stats.name.includes('تلميذ أرشيف'));
            if (statusFilter === 'active' && isStruckOff) {
                studentMap.delete(id);
            } else if (statusFilter === 'struck_off' && !isStruckOff) {
                studentMap.delete(id);
            }
        }

        // 3. Aggregate Class Stats
        const classStats = {};

        studentsList.forEach(s => {
            const isStruckOff = s.struck_off === true;
            if (statusFilter === 'active' && isStruckOff) return;
            if (statusFilter === 'struck_off' && !isStruckOff) return;

            const clsName = s.class;
            const lvl = s.level;
            const streamKey = s.stream || 'common';
            const uniqueKey = `${lvl}_${streamKey}_${clsName}`;

            if (!classStats[uniqueKey]) classStats[uniqueKey] = {
                level: lvl,
                cls: clsName,
                stream: s.stream || '',
                studentCount: 0,
                absences: 0
            };
            classStats[uniqueKey].studentCount++;
        });

        // Add Absences to Class Stats
        for (const stats of studentMap.values()) {
            if (stats.days > 0) {
                const clsName = stats.class;
                const lvl = stats.level;
                const streamKey = stats.stream || 'common';
                const uniqueKey = `${lvl}_${streamKey}_${clsName}`;
                if (classStats[uniqueKey]) {
                    classStats[uniqueKey].absences += stats.days;
                }
            }
        }

        // 4. Render Summary Cards
        let totalAbs = 0;
        let totalHrs = 0;
        let uniqueAbsentStudents = 0;
        let maxAbsClass = { name: '-', count: -1 };
        let maxAbsLevel = { name: '-', count: -1 };
        const levelCounts = {};

        for (const stats of studentMap.values()) {
            totalAbs += stats.days;
            totalHrs += stats.hours;
            if (stats.days > 0) uniqueAbsentStudents++;
        }

        Object.values(classStats).forEach(c => {
            if (c.absences > maxAbsClass.count) {
                const streamName = getStreamName(c.stream);
                maxAbsClass = { name: `${formatLevelName(c.level, isSecondary)} ${streamName ? streamName + ' ' : ''}${c.cls}`, count: c.absences };
            }
            if (!levelCounts[c.level]) levelCounts[c.level] = 0;
            levelCounts[c.level] += c.absences;
        });

        let maxLvlVal = -1;
        for (const [lvl, count] of Object.entries(levelCounts)) {
            if (count > maxLvlVal) {
                maxLvlVal = count;
                maxAbsLevel = { name: formatLevelName(lvl, isSecondary), count: count };
            }
        }

        document.getElementById('totalAbsences').innerText = totalAbs;
        document.getElementById('totalHours').innerText = formatHoursValue(totalHrs);

        const uniqueAbsentStudentsEl = document.getElementById('uniqueAbsentStudents');
        if (uniqueAbsentStudentsEl) uniqueAbsentStudentsEl.innerText = uniqueAbsentStudents;

        const avgAbsencesPerStudentEl = document.getElementById('avgAbsencesPerAbsentStudent');
        if (avgAbsencesPerStudentEl) {
            const avgPerAbsentStudent = uniqueAbsentStudents > 0 ? (totalAbs / uniqueAbsentStudents) : 0;
            avgAbsencesPerStudentEl.innerText = formatHoursValue(avgPerAbsentStudent);
        }

        document.getElementById('mostAbsentClass').innerText = maxAbsClass.count > 0 ? maxAbsClass.name : '-';
        document.getElementById('mostAbsentLevel').innerText = maxAbsLevel.count > 0 ? maxAbsLevel.name : '-';

        // 5. Render Class Stats Table
        const tbodyClass = document.querySelector('#classStatsTable tbody');
        tbodyClass.innerHTML = '';

        const streamHeader = document.getElementById('classStreamHeader');
        if (streamHeader) streamHeader.style.display = isSecondary ? 'table-cell' : 'none';

        const sortedClasses = Object.values(classStats).sort((a, b) => {
            if (a.level !== b.level) return a.level.localeCompare(b.level);
            return a.cls.localeCompare(b.cls);
        });

        sortedClasses.forEach(c => {
            const avg = c.studentCount ? (c.absences / c.studentCount).toFixed(1) : 0;
            const tr = document.createElement('tr');

            let streamCell = '';
            if (isSecondary) {
                streamCell = `<td>${getStreamName(c.stream)}</td>`;
            }

            tr.innerHTML = `
                <td>${formatLevelName(c.level, isSecondary)}</td>
                ${streamCell}
                <td>${c.cls}</td>
                <td>${c.studentCount}</td>
                <td>${c.absences}</td>
                <td><span style="color:${avg > 5 ? 'red' : 'green'}">${avg}</span></td>
            `;
            tbodyClass.appendChild(tr);
        });

        // 6. Render Student Table
        allStudentStats = Array.from(studentMap.values()).filter(s => s.days > 0);

        if (isSecondary) {
            const card = document.getElementById('streamStatsCard');
            if (card) card.style.display = 'block';

            // Show Stream Filter in Student Details
            const streamSelect = document.getElementById('statsStreamSelect');
            if (streamSelect) streamSelect.style.display = 'inline-block';

            // Show Stream Header in Student Table
            const studentStreamHeader = document.getElementById('studentStreamHeader');
            if (studentStreamHeader) studentStreamHeader.style.display = 'table-cell';

            const streamStats = {};

            // Initialize from student list
            studentsList.forEach(s => {
                if (!s.stream) return;
                const isStruckOff = s.struck_off === true;
                if (statusFilter === 'active' && isStruckOff) return;
                if (statusFilter === 'struck_off' && !isStruckOff) return;

                let streamKey = s.stream;
                if (streamKey.startsWith('tech_math') || streamKey.includes('تقني رياضي')) streamKey = 'tech_math';

                const key = `${s.level}_${streamKey}`;
                if (!streamStats[key]) {
                    streamStats[key] = {
                        level: s.level,
                        stream: streamKey,
                        studentCount: 0,
                        absences: 0
                    };
                }
                streamStats[key].studentCount++;
            });

            // Add Absences to Stream Stats
            for (const stats of studentMap.values()) {
                if (stats.days > 0 && stats.stream && stats.stream !== '?') {
                    let streamKey = stats.stream;
                    if (streamKey.startsWith('tech_math') || streamKey.includes('تقني رياضي')) streamKey = 'tech_math';

                    const key = `${stats.level}_${streamKey}`;
                    if (streamStats[key]) {
                        streamStats[key].absences += stats.days;
                    }
                }
            }

            // Render Stream Stats Table
            const tbodyStream = document.querySelector('#streamStatsTable tbody');
            if (tbodyStream) {
                tbodyStream.innerHTML = '';
                const sortedStreams = Object.values(streamStats).sort((a, b) => {
                    if (a.level !== b.level) return a.level.localeCompare(b.level);
                    return getStreamName(a.stream).localeCompare(getStreamName(b.stream), 'ar');
                });

                sortedStreams.forEach(s => {
                    const avg = s.studentCount ? (s.absences / s.studentCount).toFixed(1) : 0;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="level-row">${formatLevelName(s.level, true)}</td>
                        <td style="font-weight:bold;">${getStreamName(s.stream)}</td>
                        <td>${s.studentCount}</td>
                        <td>${s.absences}</td>
                        <td><span style="color:${avg > 5 ? 'red' : 'green'}">${avg}</span></td>
                    `;
                    tbodyStream.appendChild(tr);
                });
            }

        } else {
            // Not Secondary - Hide Stream related elements
            const card = document.getElementById('streamStatsCard');
            if (card) card.style.display = 'none';

            const streamSelect = document.getElementById('statsStreamSelect');
            if (streamSelect) streamSelect.style.display = 'none';

            const studentStreamHeader = document.getElementById('studentStreamHeader');
            if (studentStreamHeader) studentStreamHeader.style.display = 'none';

            const navStreamBtn = document.getElementById('navStreamStats');
            if (navStreamBtn) navStreamBtn.style.display = 'none';
        }

        // Show nav stream button if secondary
        if (isSecondary) {
            const navStreamBtn = document.getElementById('navStreamStats');
            if (navStreamBtn) navStreamBtn.style.display = 'flex';
        }

        // 7. Sort and Render Student Table
        allStudentStats = Array.from(studentMap.values()).filter(s => s.days > 0 || s.hours > 0);
        allStudentStats.sort((a, b) => b.days - a.days);
        renderStudentTable(allStudentStats);

    } catch (e) {
        console.error('Stats Loading Error:', e);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'حدث خطأ في معالجة الإحصائيات'
        });
    }
}

function renderStudentTable(list) {

    const tbody = document.getElementById('studentStatsBody');

    tbody.innerHTML = '';

    // Limit to top 500 for performance if list is huge, or pagination.

    // For local app, 1000 rows is fine.

    list.forEach((s, index) => {
        const tr = document.createElement('tr');
        const rank = index + 1;

        // Check if secondary to add stream cell
        const streamHeader = document.getElementById('studentStreamHeader');
        let streamCell = '';
        const isSecondary = streamHeader && streamHeader.style.display !== 'none';

        if (isSecondary) {
            streamCell = `<td>${getStreamName(s.stream)}</td>`;
        }

        // Format Level Name
        let levelName = formatLevelName(s.level, isSecondary);

        tr.innerHTML = `
                <td>${rank}</td>
                <td style="font-weight:bold;">${s.name}</td>
                <td>${levelName}</td>
                ${streamCell}
                <td>${s.class || '-'}</td>
                <td><span class="badge ${s.days > 10 ? 'danger' : 'info'}">${s.days}</span></td>
                <td>${formatHoursValue(s.hours)} سا</td>
            `;
        tbody.appendChild(tr);
    });

}

function filterStudentTable(query) {

    if (!query) {

        renderStudentTable(allStudentStats);

        return;

    }

    const lower = query.toLowerCase();

    const filtered = allStudentStats.filter(s =>

        s.name.toLowerCase().includes(lower) ||

        String(s.class || '').toLowerCase().includes(lower)

    );

    renderStudentTable(filtered);

}

/**

 * Apply Date Filter

 */

function applyDateFilter() {

    loadStatistics();

}

/**

 * Print Statistics Report

 */

async function printStatsReport() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    let periodStr = '';
    if (startDate || endDate) periodStr = `الفترة: من ${startDate || '...'} إلى ${endDate || '...'}`;

    // Get Data from DOM
    const totalAbs = document.getElementById('totalAbsences').innerText;
    const totalHrs = document.getElementById('totalHours').innerText;
    const mostLvl = document.getElementById('mostAbsentLevel').innerText;
    const mostCls = document.getElementById('mostAbsentClass').innerText;
    const classStatsHTML = document.getElementById('classStatsTable').outerHTML;

    // Load Settings
    const settings = await DB.getSettings() || {};

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'يرجى السماح بالنوافذ المنبثقة للطباعة'
        });
        return;
    }

    const headerHTML = getPrintHeader(settings, 'تقرير إحصائيات الغياب', periodStr);

    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير إحصائيات الغياب</title>
            <style>
                body { font-family: 'Cairo', 'Tajawal', 'Traditional Arabic', sans-serif; padding: 20px; color: #333; }
                h1, h2, h3, h4, h5, h6 { text-align: center; color: var(--primary-color); }

                .summary-grid { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 30px; }
                .summary-item { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; flex: 1; background: #f9f9f9; }
                .summary-value { display: block; font-size: 1.5em; font-weight: bold; color: var(--secondary-color); margin-top: 5px; }
                .summary-label { font-size: 0.9em; color: #555; }

                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9em; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                th { background-color: #f2f2f2; font-weight: bold; }
                tr:nth-child(even) { background-color: #fafdff; }

                @media print {
                    .no-print { display: none; }
                    body { padding: 0; }
                    @page { margin: 1cm; size: A4 portrait; }
                    body { -webkit-print-color-adjust: exact; }
                    .summary-item { border: 1px solid #ccc; }
                }
            </style>
        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>
        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
            ${headerHTML}

            <div class="summary-grid">
                <div class="summary-item"><span class="summary-label">ط¥ط¬ظ…ط§ظ„ظٹ الغيابط§طھ</span><span class="summary-value">${totalAbs}</span></div>
                <div class="summary-item"><span class="summary-label">ط§ظ„ساط¹ط§طھ ط§ظ„ط¶ط§ط¦ط¹ط©</span><span class="summary-value">${totalHrs}</span></div>
                <div class="summary-item"><span class="summary-label">أكثر مستوى</span><span class="summary-value">${mostLvl}</span></div>
                <div class="summary-item"><span class="summary-label">أكثر قسم</span><span class="summary-value">${mostCls}</span></div>
            </div>

            <h2>إحصائيات ط§ظ„ط£ظ‚ساظ…</h2>
            ${classStatsHTML}

            <div style="text-align: left; font-size: 0.8em; margin-top: 30px;">
                حرر بتاريخ: ${new Date().toLocaleDateString('ar-DZ')}
            </div>

            <script>
                // window.onload auto-print removed
            </script>
        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>
        </html>
    `);

    printWindow.document.close();
}

/**
 * Helper to get numeric level from string (e.g. "أولى متوسط" -> "1")
 */
function getLevelNumber(lvl) {
    const s = String(lvl);
    if (s.match(/\d+/)) return s.match(/\d+/)[0];
    if (s.includes('أولى') || s.includes('ط§ظˆظ„ظ‰')) return '1';
    if (s.includes('ثانية') || s.includes('ثانية')) return '2';
    if (s.includes('ثالثة')) return '3';
    if (s.includes('رابعة')) return '4';
    return s;
}

/**

 * Load Classes for Stats Dropdown
 */
function loadClassesForStats(source) {
    const level = document.getElementById('statsLevelSelect').value;
    const streamSelect = document.getElementById('statsStreamSelect');
    const classSelect = document.getElementById('statsClassSelect');

    // Clear current
    classSelect.innerHTML = '<option value="">-- القسم --</option>';

    if (!level) {
        if (streamSelect) streamSelect.innerHTML = '<option value="">-- الشعبة --</option>';
        filterStudentStatsByClass(); // Reset filter
        return;
    }

    // Populate Streams if element exists (Secondary)
    let selectedStream = '';
    if (streamSelect && streamSelect.style.display !== 'none') {
        selectedStream = streamSelect.value;

        // Repopulate if triggered by Level change OR if empty
        const isLevelChange = (source === 'level');
        const isEmpty = (streamSelect.options.length <= 1);

        if (isLevelChange || isEmpty) {
            streamSelect.innerHTML = '<option value="">-- الشعبة --</option>';
            const streams = [...new Set(
                allStudentStats
                    .filter(s => {
                        const sLevel = String(s.level).match(/\d+/);
                        const sNum = sLevel ? sLevel[0] : s.level;
                        const filterLevel = String(level).match(/\d+/);
                        const filterNum = filterLevel ? filterLevel[0] : level;
                        return String(sNum) === String(filterNum) && s.stream;
                    })
                    .map(s => {
                        let st = s.stream;
                        if (st.startsWith('tech_math') || st.includes('تقني رياضي')) return 'tech_math';
                        return st;
                    })
            )].sort();

            streams.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.text = getStreamName(s);
                streamSelect.appendChild(opt);
            });
            selectedStream = ''; // Reset selection
        }
    }

    // Get unique classes for this level (and stream)
    let filteredForClasses = allStudentStats.filter(s => {
        const sNum = getLevelNumber(s.level);
        const filterNum = getLevelNumber(level);
        return String(sNum) === String(filterNum);
    });

    if (selectedStream) {
        if (selectedStream === 'tech_math') {
            filteredForClasses = filteredForClasses.filter(s => s.stream && (s.stream.startsWith('tech_math') || s.stream.includes('تقني رياضي')));
        } else {
            filteredForClasses = filteredForClasses.filter(s => s.stream === selectedStream);
        }
    }

    const classes = [...new Set(filteredForClasses.map(s => s.class))].sort();

    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.text = c;
        classSelect.appendChild(opt);
    });

    filterStudentStatsByClass();
}

/**

 * Filter Student Stats by Class/Level

 */

function filterStudentStatsByClass() {

    const level = document.getElementById('statsLevelSelect').value;

    const cls = document.getElementById('statsClassSelect').value;
    const streamSelect = document.getElementById('statsStreamSelect');
    const stream = (streamSelect && streamSelect.style.display !== 'none') ? streamSelect.value : '';
    const query = document.getElementById('studentSearch').value.toLowerCase();

    let filtered = allStudentStats;

    if (level) {
        // Normalize level comparison (handle "1" vs "1 ثانوي" vs "أولى متوسط")
        filtered = filtered.filter(s => {
            const sNum = getLevelNumber(s.level);
            const filterNum = getLevelNumber(level);
            return String(sNum) === String(filterNum);
        });
    }

    if (stream) {
        if (stream === 'tech_math') {
            filtered = filtered.filter(s => s.stream && (s.stream.startsWith('tech_math') || s.stream.includes('تقني رياضي')));
        } else {
            filtered = filtered.filter(s => s.stream === stream);
        }
    }

    if (cls) {
        filtered = filtered.filter(s => s.class === cls);
    }

    if (query) {
        filtered = filtered.filter(s =>
            s.name.toLowerCase().includes(query) ||
            String(s.class || '').toLowerCase().includes(query)
        );
    }

    // Apply Sorting
    if (currentSort.column) {
        filtered.sort((a, b) => {
            let valA, valB;

            if (currentSort.column === 'absenceCount') {
                valA = a.days || 0;
                valB = b.days || 0;
            } else {
                // Fallback for other columns if added later
                valA = a[currentSort.column];
                valB = b[currentSort.column];
            }

            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    renderStudentTable(filtered);

}

// Update existing filter to use new logic
function filterStudentTable(query) {
    filterStudentStatsByClass();
}

/**
 * Sort Student Stats
 */
let currentSort = {
    column: null,
    direction: 'asc'
};

function sortStudentStats(column) {
    // Toggle direction if same column
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'desc'; // Default to desc for numbers usually
    }

    // Update Icon
    const icon = document.getElementById(`sortIcon_${column}`);
    if (icon) {
        // Reset others if we had multiple sortable columns (currently only one)
        // icon.innerText = currentSort.direction === 'asc' ? 'â†‘' : 'â†“';
        icon.innerHTML = currentSort.direction === 'asc' ? '&#8593;' : '&#8595;';
        icon.style.opacity = '1';
    }

    // Sort Data
    // We need to sort 'filteredStudentStats' if it exists, roughly.
    // Actually filterStudentStatsByClass populates 'filtered' variable but doesn't store it globally effectively for re-sorting without re-filtering.
    // Let's modify filterStudentStatsByClass to store result in a global let or simply re-run render with sorted data.

    // Better approach: modifying renderStudentTable to accept data,
    // OR: Simply sort the global 'allStudentStats' if no filter, or re-apply filter then sort?
    // Let's assume we sort the CURRENTLY displayed data.

    // But wait, 'filteredStudentStats' is not global in the previous code I saw (it was inside filterStudentStatsByClass).
    // I should check if I can make it global or just sort 'allStudentStats' and re-apply filters?
    // Typically: Apply Filter -> Sort -> Render.

    // Let's trigger filterStudentStatsByClass() but inside that function, we need to apply Sort.
    // So I will modify filterStudentStatsByClass to Apply Sort before rendering.

    filterStudentStatsByClass();
}

/**

 * Print Student Details Report

 */

/**
 * Helper to generate standard print header
 */
function getPrintHeader(settings, title, subtitle = '') {
    return `
    <div style="margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
        <!-- Top Center: Republic and Ministry -->
        <div style="text-align: center; margin-bottom: 15px;">
            <h4 style="margin:0; font-size: 16px; font-weight: bold;">الجمهورية الجزائرية الديمقراطية الشعبية</h4>
            <h5 style="margin:5px 0; font-size: 14px;">وزارة التربية الوطنية</h5>
        </div>

        <!-- Info Row -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
            <!-- Right: Directorate & School -->
            <div style="text-align: right; width: 35%;">
                <h5 style="margin:0; font-size: 12px;">مديرية التربية لولاية ${settings.wilaya || 'عين الدفلى'}</h5>
                <h5 style="margin:5px 0; font-size: 12px;">${settings.institutionName || 'ط§ظ„ظ…ط¤ط³ط³ط© ط§ظ„طھط±ط¨ظˆظٹط©'}</h5>
            </div>

            <!-- Center: Title -->
            <div style="text-align: center; width: 30%;">
                <h3 style="margin:0; text-decoration: underline; font-size: 16px;">${title}</h3>
                ${subtitle ? `<h4 style="margin:5px 0; font-size: 12px; font-weight: normal;">${subtitle}</h4>` : ''}
            </div>

            <!-- Left: Year -->
            <div style="text-align: left; width: 35%;">
                <h6 style="margin:0; font-size: 12px;">ط§ظ„سنة ط§ظ„ط¯ط±ط§ط³ظٹط©: ${settings.schoolYear || '2025/2026'}</h6>
            </div>
        </div>
    </div>
    `;
}

async function printStudentDetailsReport() {
    const level = document.getElementById('statsLevelSelect').value;
    const cls = document.getElementById('statsClassSelect').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    let periodStr = '';
    if (startDate || endDate) periodStr = `الفترة: من ${startDate || '...'} إلى ${endDate || '...'}`;

    let titleStr = 'ظ‚ط§ط¦ظ…ط© الغيابط§طھ ط§ظ„طھظپطµظٹظ„ظٹط©';
    if (level && cls) titleStr += ` - ظ‚ط³ظ… ${level} ${cls}`;
    else if (level) titleStr += ` - ظ…ط³طھظˆظ‰ ${level}`;

    // Get visible rows data
    const tbody = document.getElementById('studentStatsBody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    if (rows.length === 0 || rows[0].innerText.includes('ظ„ط§ طھظˆط¬ط¯ ط³ط¬ظ„ط§طھ')) {
        alert('ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ للطباعة');
        return;
    }

    // Load Settings
    const settings = await DB.getSettings() || {};

    // Styles
    const tableStyle = "width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px;"; // Increased font size slightly
    const thStyle = "border: 1px solid #000; background-color: #f0f0f0; padding: 6px; text-align: center; font-weight: bold;";
    const tdStyle = "border: 1px solid #000; padding: 5px; text-align: center;";

    const printWindow = window.open('', '_blank', 'width=1000,height=800');

    // Construct HTML content
    const headerHTML = getPrintHeader(settings, titleStr, periodStr);

    // table content
    let tableHTML = `<table style="${tableStyle}"><thead><tr>`;
    // Headers (Manual to ensure consistent look)
    const headers = ['الرتبة', 'اللقب والاسم', 'المستوى', 'ط§ظ„ط´ط¹ط¨ط©', 'ط§ظ„ظ‚ط³ظ…', 'ط¹ط¯ط¯ الغيابط§طھ', 'ظ…ط¬ظ…ظˆط¹ ط§ظ„ساط¹ط§طھ'];
    headers.forEach(h => {
        // Skip Stream if hidden in current view?
        // Logic: if stream header is hidden in DOM, skip it here?
        // Let's iterate DOM headers instead for accuracy
        // But styling is manual.
    });

    // Let's copy from DOM headers but apply styles
    const domHeaders = document.querySelectorAll('#studentStatsBody').length > 0 ?
        document.querySelectorAll('.modern-table thead th') : [];
    // Wait, there are multiple tables. We need the specific one.

    // The student table is the last one in DOM or inside studentStatsSection
    const studentTable = document.querySelector('#studentStatsSection table');
    if (!studentTable) return;

    const domThs = studentTable.querySelectorAll('thead th');
    let validIndices = [];

    domThs.forEach((th, idx) => {
        if (th.style.display !== 'none') {
            tableHTML += `<th style="${thStyle}">${th.innerText}</th>`;
            validIndices.push(idx);
        }
    });
    tableHTML += '</tr></thead><tbody>';

    rows.forEach(row => {
        if (row.style.display !== 'none') {
            tableHTML += '<tr>';
            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
                tableHTML += `<td style="${tdStyle}">${cell.innerText}</td>`;
            });
            tableHTML += '</tr>';
        }
    });
    tableHTML += '</tbody></table>';

    // Footer with date
    const footerHTML = `
        <div style="margin-top: 20px; text-align: left; font-size: 11px;">
            حرر بتاريخ: ${new Date().toLocaleDateString('ar-DZ')}
        </div>
    `;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <title>${titleStr}</title>
            <style>
                body { font-family: 'Cairo', 'Tajawal', 'Traditional Arabic', sans-serif; padding: 20px; }
                @media print {
                   @page { margin: 1cm; size: A4 portrait; }
                   body { -webkit-print-color-adjust: exact; }
                }
            </style>
        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>
        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
            ${headerHTML}
            ${tableHTML}
            ${footerHTML}
        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}\n        </body>
        </html>
    `);

    printWindow.document.close();
    // printWindow.print(); /* Replaced by global Toolbar */ /* Replaced by global Toolbar */
}

