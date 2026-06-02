

// monthly_report.js

// Global Data

let allStudents = [];

let settings = {};

const MONTHLY_REPORT_TABLE_EDITS_KEY = 'monthlyReportTableEdits';
const EDITABLE_MONTHLY_REPORT_TABLE_IDS = ['classesTable', 'summaryTable', 'movementTable'];
let activeRenderedReportMonth = '';
let monthlyReportTableEditsStore = { months: {}, updatedAt: 0 };
let monthlyReportEditsSaveTimer = null;

let reportSettings = {
    showSupervisor: true, titleSupervisor: 'المشرف العام',
    showAdvisor: true, titleAdvisor: 'مستشار التربية',
    showCensor: true, titleCensor: 'الناظر',
    showBursar: true, titleBursar: 'المقتصد',
    showDirector: true, titleDirector: 'المدير'
};

function normalizeMonthlyReportTableEditsStore(value) {
    if (!value || typeof value !== 'object') {
        return { months: {}, updatedAt: 0 };
    }

    if (value.months && typeof value.months === 'object') {
        return {
            months: value.months,
            updatedAt: Number(value.updatedAt) || 0
        };
    }

    const legacyMonths = { ...value };
    delete legacyMonths.updatedAt;

    return {
        months: legacyMonths,
        updatedAt: Number(value.updatedAt) || 0
    };
}

function readMonthlyReportTableEditsCache() {
    try {
        const raw = localStorage.getItem(MONTHLY_REPORT_TABLE_EDITS_KEY);
        return normalizeMonthlyReportTableEditsStore(raw ? JSON.parse(raw) : null);
    } catch (error) {
        console.warn('Unable to read monthly report edits cache:', error);
        return { months: {}, updatedAt: 0 };
    }
}

function writeMonthlyReportTableEditsCache() {
    try {
        localStorage.setItem(MONTHLY_REPORT_TABLE_EDITS_KEY, JSON.stringify(monthlyReportTableEditsStore));
    } catch (error) {
        console.warn('Unable to write monthly report edits cache:', error);
    }
}

function getCurrentReportMonthValue() {
    const monthInput = document.getElementById('reportMonth');
    return monthInput ? monthInput.value : '';
}

function getRenderedReportMonthValue() {
    return activeRenderedReportMonth || getCurrentReportMonthValue();
}

function getMonthlyReportTableEditsForMonth(monthKey) {
    if (!monthKey) return null;
    return (monthlyReportTableEditsStore.months && monthlyReportTableEditsStore.months[monthKey]) || null;
}

function collectCurrentMonthlyReportTableEdits() {
    const edits = {};

    EDITABLE_MONTHLY_REPORT_TABLE_IDS.forEach(tableId => {
        const table = document.getElementById(tableId);
        if (!table) return;

        const rows = Array.from(table.querySelectorAll('tbody tr')).map(row => {
            return Array.from(row.querySelectorAll('td:not(:first-child)')).map(cell => cell.textContent.trim());
        });

        if (rows.length > 0) {
            edits[tableId] = rows;
        }
    });

    return edits;
}

function captureMonthlyReportTableEdits(monthKey) {
    if (!monthKey) return false;

    monthlyReportTableEditsStore.months[monthKey] = collectCurrentMonthlyReportTableEdits();
    monthlyReportTableEditsStore.updatedAt = Date.now();
    writeMonthlyReportTableEditsCache();
    return true;
}

async function persistMonthlyReportTableEdits(monthKey) {
    const targetMonth = monthKey || getRenderedReportMonthValue();
    if (!captureMonthlyReportTableEdits(targetMonth)) return false;

    try {
        await DB.set(MONTHLY_REPORT_TABLE_EDITS_KEY, monthlyReportTableEditsStore);
    } catch (error) {
        console.warn('Unable to persist monthly report table edits:', error);
    }

    return true;
}

function scheduleMonthlyReportTableEditsSave() {
    const targetMonth = getRenderedReportMonthValue();
    if (!targetMonth) return;

    if (monthlyReportEditsSaveTimer) {
        clearTimeout(monthlyReportEditsSaveTimer);
    }

    monthlyReportEditsSaveTimer = setTimeout(() => {
        monthlyReportEditsSaveTimer = null;
        persistMonthlyReportTableEdits(targetMonth);
    }, 250);
}

function flushMonthlyReportTableEdits() {
    if (monthlyReportEditsSaveTimer) {
        clearTimeout(monthlyReportEditsSaveTimer);
        monthlyReportEditsSaveTimer = null;
    }

    if (!isTableEditing) return;

    const targetMonth = getRenderedReportMonthValue();
    if (!captureMonthlyReportTableEdits(targetMonth)) return;

    DB.set(MONTHLY_REPORT_TABLE_EDITS_KEY, monthlyReportTableEditsStore).catch(error => {
        console.warn('Unable to flush monthly report table edits:', error);
    });
}

function applyMonthlyReportTableEdits(monthKey) {
    const monthEdits = getMonthlyReportTableEditsForMonth(monthKey);
    if (!monthEdits) return;

    EDITABLE_MONTHLY_REPORT_TABLE_IDS.forEach(tableId => {
        const rows = monthEdits[tableId];
        const table = document.getElementById(tableId);
        if (!Array.isArray(rows) || !table) return;

        const tableRows = Array.from(table.querySelectorAll('tbody tr'));
        rows.forEach((savedRow, rowIndex) => {
            if (!Array.isArray(savedRow)) return;

            const row = tableRows[rowIndex];
            const cells = row ? Array.from(row.querySelectorAll('td:not(:first-child)')) : [];
            savedRow.forEach((value, cellIndex) => {
                if (cells[cellIndex]) {
                    cells[cellIndex].textContent = value != null ? value : '';
                }
            });
        });
    });
}

function handleMonthlyReportEditableCellInput() {
    scheduleMonthlyReportTableEditsSave();
}

document.addEventListener('DOMContentLoaded', async () => {

    await loadInitialData();

    // Set default month to current month

    const today = new Date();

    const monthStr = today.toISOString().slice(0, 7); // YYYY-MM

    document.getElementById('reportMonth').value = monthStr;

    // Initial Generate

    generateReport();

});

async function loadInitialData() {

    try {

        allStudents = await DB.getStudents(true) || [];

        settings = await DB.getSettings() || {};

        // Update Print Headers

        if (document.getElementById('printWilaya')) document.getElementById('printWilaya').textContent = settings.wilaya || '......';

        if (document.getElementById('printSchool')) document.getElementById('printSchool').textContent = settings.institutionName || '......';

        if (document.getElementById('printYear')) document.getElementById('printYear').textContent = settings.currentYear || '2025/2026';

        // Load Report Settings

        const savedReportSettings = await DB.get('monthlyReportSettings');

        if (savedReportSettings) {

            reportSettings = { ...reportSettings, ...savedReportSettings };

        }

        const dbTableEdits = normalizeMonthlyReportTableEditsStore(await DB.get(MONTHLY_REPORT_TABLE_EDITS_KEY));
        const cachedTableEdits = readMonthlyReportTableEditsCache();
        monthlyReportTableEditsStore = cachedTableEdits.updatedAt > dbTableEdits.updatedAt ? cachedTableEdits : dbTableEdits;

        if (cachedTableEdits.updatedAt > dbTableEdits.updatedAt) {
            DB.set(MONTHLY_REPORT_TABLE_EDITS_KEY, monthlyReportTableEditsStore).catch(error => {
                console.warn('Unable to sync monthly report table edits cache:', error);
            });
        }

    } catch (error) {

        console.error('Error loading data:', error);

    }

}

/**

 * Main Report Generation Function

 */

function generateReport() {

    if (typeof isTableEditing !== 'undefined' && isTableEditing) {
        toggleTableEditing();
    }

    const monthInput = document.getElementById('reportMonth').value;

    if (!monthInput) return;

    const [year, month] = monthInput.split('-').map(Number);

    const reportDate = new Date(year, month, 0); // Last day of selected month

    const startDate = new Date(year, month - 1, 1); // First day of selected month

    // Arabic Month Name

    const monthNames = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

    if (document.getElementById('printMonthName')) document.getElementById('printMonthName').textContent = monthNames[month - 1];

    if (document.getElementById('printDate')) document.getElementById('printDate').textContent = reportDate.toLocaleDateString('fr-FR'); // DD/MM/YYYY

    // 1. Process Data

    // We need to calculate state at END of selected month.

    // Groups: Level -> Class -> [Gender, Boarding]

    const hierarchy = {};

    const isSecondary = settings.educationStage === 'secondary';

    const levels = isSecondary ?

        ['1 ثانوي', '2 ثانوي', '3 ثانوي'] :

        ['1 متوسط', '2 متوسط', '3 متوسط', '4 متوسط'];

    // Initialize Hierarchy

    levels.forEach(lvl => {

        hierarchy[lvl] = {};

    });

    // Tracking for Movement Table

    const movementStats = {

        prevEnd: { ext: { m: 0, f: 0 }, half: { m: 0, f: 0 } },

        entries: { ext: { m: 0, f: 0 }, half: { m: 0, f: 0 } },

        exits: { ext: { m: 0, f: 0 }, half: { m: 0, f: 0 } },

        currEnd: { ext: { m: 0, f: 0 }, half: { m: 0, f: 0 } }

    };

    console.log(`Generating report for ${allStudents.length} students. Month: ${monthInput}`);

    allStudents.forEach((student, index) => {

        if (index < 5) console.log(`Sample Student ${index}:`, student.level, student.status, student.strike_date);

        // Normalize Level

        let level = student.level || '';

        // Handle Arabic Ordinals (Relaxed matching)

        if (isSecondary) {

            if (level.includes('1') || level.includes('أولى')) level = '1 ثانوي';

            else if (level.includes('2') || level.includes('ثانية')) level = '2 ثانوي';

            else if (level.includes('3') || level.includes('ثالثة')) level = '3 ثانوي';

        } else {

            if (level.includes('ولى') || level.includes('1')) level = '1 متوسط';

            else if (level.includes('ثاني') || level.includes('2')) level = '2 متوسط';

            else if (level.includes('ثالث') || level.includes('3')) level = '3 متوسط';

            else if (level.includes('رابع') || level.includes('4')) level = '4 متوسط';

        }

        // Final check if valid level

        if (!levels.includes(level)) {

            // console.warn('Unknown level:', level); // Optional debug

            return;

        }

        // --- Status Determination w/ History ---
        let currentStatus = (student.status || 'external').toLowerCase();
        let history = student.status_history || [];

        // Sort history by date descending
        history.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Helper to get status at a specific date
        const getStatusAtDate = (date) => {
            // Find first history entry BEFORE or ON date
            for (const h of history) {
                if (new Date(h.date) <= date) {
                    return (h.status || 'external').toLowerCase();
                }
            }
            return 'external';
        };

        // Determine Status at Start and End of Month
        let statusStart = 'external';
        let statusEnd = 'external';

        if (history.length === 0) {
            statusStart = currentStatus;
            statusEnd = currentStatus;
        } else {
            statusStart = getStatusAtDate(startDate);
            statusEnd = getStatusAtDate(reportDate);
        }

        const isHalfBoardStart = statusStart.includes('نصف') || statusStart.includes('demi') || statusStart === 'half_board' || statusStart === 'boarding';
        const boardKeyStart = isHalfBoardStart ? 'half' : 'ext';

        const isHalfBoardEnd = statusEnd.includes('نصف') || statusEnd.includes('demi') || statusEnd === 'half_board' || statusEnd === 'boarding';
        const boardKeyEnd = isHalfBoardEnd ? 'half' : 'ext';
        const genderKey = (student.gender === 'M' || student.gender === 'ذكر') ? 'm' : 'f';

        // --- Movement Logic ---

        // Strike Date Analysis
        let strikeDate = null;
        if (student.struck_off || student.strike_date) {
            const d = new Date(student.strike_date);
            if (!isNaN(d.getTime())) strikeDate = d;
        }

        // Entry Date Analysis
        let entryDate = null;
        if (student.entry_date) {
            const d = new Date(student.entry_date);
            if (!isNaN(d.getTime())) entryDate = d;
        }

        // Logic:
        // Student is "Present at Month End" IF:
        // - NOT struck off OR (struck off AFTER month end)
        // - AND (Entry BEFORE or ON month end)

        const isPresentEnd = (!strikeDate || strikeDate > reportDate) && (!entryDate || entryDate <= reportDate);

        // Student was "Present at Start" (End of Prev) IF:
        // - NOT struck off OR (struck off AFTER start date)
        // - AND (Entry BEFORE start date, meaning they entered before this month began)

        const isPresentStart = (!strikeDate || strikeDate >= startDate) && (!entryDate || entryDate < startDate);

        // Is Exit during month?
        const isExit = strikeDate && strikeDate >= startDate && strikeDate <= reportDate;

        // Is Entry during month?
        const isEntry = entryDate && entryDate >= startDate && entryDate <= reportDate;

        // Update Movement Stats

        if (isPresentStart) {
            movementStats.prevEnd[boardKeyStart][genderKey]++;
        }

        if (isExit) {
            // They exited from the status they held at moment of exit
            let statusAtExit = statusEnd; // Default to end status
            if (history.length > 0) statusAtExit = getStatusAtDate(strikeDate);

            const isHalfAtExit = statusAtExit.includes('نصف') || statusAtExit.includes('demi') || statusAtExit === 'half_board' || statusAtExit === 'boarding';
            movementStats.exits[isHalfAtExit ? 'half' : 'ext'][genderKey]++;
        }

        // 3. Status Changes (Internal Movement)
        // Check for changes WITHIN the month
        if (history.length > 0) {
            history.forEach(h => {
                const hDate = new Date(h.date);
                if (hDate > startDate && hDate <= reportDate) {
                    // A change occurred!
                    const newStat = (h.status || 'external').toLowerCase();
                    const oldStat = (h.previous_status || 'external').toLowerCase();

                    const isNewHalf = newStat.includes('نصف') || newStat.includes('demi') || newStat === 'half_board' || newStat === 'boarding';
                    const isOldHalf = oldStat.includes('نصف') || oldStat.includes('demi') || oldStat === 'half_board' || oldStat === 'boarding';

                    if (isNewHalf !== isOldHalf) {
                        // Status Type Changed
                        if (isNewHalf) {
                            // External -> Half (Entry to Half, Exit from Ext)
                            movementStats.exits['ext'][genderKey]++;
                            movementStats.entries['half'][genderKey]++;
                        } else {
                            // Half -> External (Entry to Ext, Exit from Half)
                            movementStats.exits['half'][genderKey]++;
                            movementStats.entries['ext'][genderKey]++;
                        }
                    }
                }
            });
        }

        if (isPresentEnd) {
            movementStats.currEnd[boardKeyEnd][genderKey]++;

            // Add to Detailed Class Tables (Only show CURRENTLY present at end match)
            let className = student.class || 'بدون فوج';

            // Distinguish streams in Secondary if needed to prevent merging same-named classes
            if (isSecondary && student.stream) {
                // Try to get short stream name or just use raw for key, but translate for display?
                // We will use a local translation helper
                const streamLabel = getStreamLabel(student.stream);
                className = `${className} (${streamLabel})`;
            }

            if (!hierarchy[level][className]) {
                hierarchy[level][className] = {
                    name: className,
                    ext: { m: 0, f: 0 },
                    half: { m: 0, f: 0 },
                    repeaters: { ext: { m: 0, f: 0 }, half: { m: 0, f: 0 } }
                };
            }
            hierarchy[level][className][boardKeyEnd][genderKey]++;
            
            // Track repeaters
            if (student.repeat === true || student.is_repeater === true || student.repeater === true || student.repeat === 'نعم' || student.isRepeater === true || student.معيد === true) {
                hierarchy[level][className].repeaters[boardKeyEnd][genderKey]++;
            }
        }

        if (isEntry) {
            // New entry: Count as an entry with their status at the end of the month
            movementStats.entries[boardKeyEnd][genderKey]++;
        }

    });

    // 2. Render Tables

    renderLevelTables(hierarchy, levels);

    renderSummaryTable(hierarchy, levels);

    renderMovementTable(movementStats);

    activeRenderedReportMonth = monthInput;
    applyMonthlyReportTableEdits(monthInput);

}

function renderLevelTables(hierarchy, levels) {

    const tbody = document.getElementById('classesTableBody');

    if (!tbody) return;

    tbody.innerHTML = '';

    // Calculate Grand Totals for the Unified Table

    const grandStats = { ext: { m: 0, f: 0 }, half: { m: 0, f: 0 } };

    let tbodyContent = '';

    levels.forEach((lvl) => {

        const classes = Object.values(hierarchy[lvl]).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));

        // Level Totals

        const totalLvl = { ext: { m: 0, f: 0 }, half: { m: 0, f: 0 } };

        // Rows for this level

        const rowsHtml = classes.map(c => {

            totalLvl.ext.m += c.ext.m;

            totalLvl.ext.f += c.ext.f;

            totalLvl.half.m += c.half.m;

            totalLvl.half.f += c.half.f;

            const rowTotalM = c.ext.m + c.half.m;

            const rowTotalF = c.ext.f + c.half.f;

            const rowGrand = rowTotalM + rowTotalF;

            return `

                <tr>

                    <td style="font-weight:bold;">${formatClassName(lvl, c.name)}</td>

                    <td>${c.half.m}</td>

                    <td>${c.half.f}</td>

                    <td>${c.ext.m}</td>

                    <td>${c.ext.f}</td>

                    <td class="text-blue">${rowTotalM}</td>

                    <td class="text-blue">${rowTotalF}</td>

                    <td class="bg-yellow text-red">${rowGrand}</td>

                </tr>

            `;

        }).join('');

        // Level Total Row

        const lvlGrandM = totalLvl.ext.m + totalLvl.half.m;

        const lvlGrandF = totalLvl.ext.f + totalLvl.half.f;

        const lvlGrand = lvlGrandM + lvlGrandF;

        // Add to Grand Stats

        grandStats.ext.m += totalLvl.ext.m;

        grandStats.ext.f += totalLvl.ext.f;

        grandStats.half.m += totalLvl.half.m;

        grandStats.half.f += totalLvl.half.f;

        tbodyContent += rowsHtml;

        tbodyContent += `

             <tr style="background: #e6f7ff; border-top: 2px solid #aaa;"> <!-- Distinctive Level Total -->

                <td style="font-weight:bold;">مجموع ${lvl}</td>

                <td class="bg-yellow text-red">${totalLvl.half.m}</td>

                <td class="bg-yellow text-red">${totalLvl.half.f}</td>

                <td class="bg-yellow text-red">${totalLvl.ext.m}</td>

                <td class="bg-yellow text-red">${totalLvl.ext.f}</td>

                <td class="bg-yellow text-red">${lvlGrandM}</td>

                <td class="bg-yellow text-red">${lvlGrandF}</td>

                <td class="bg-yellow text-red">${lvlGrand}</td>

            </tr>

            <tr><td colspan="8" style="background:#fff; height:5px; border:none; border-bottom: 3px solid #64748b;"></td></tr> <!-- Spacer with thick line -->

        `;

    });

    // Grand Total Row (Unified)

    const allGrandM = grandStats.ext.m + grandStats.half.m;

    const allGrandF = grandStats.ext.f + grandStats.half.f;

    const allGrand = allGrandM + allGrandF;

    tbodyContent += `

        <tr style="background: #ffffcc; border-top: 3px solid #000;">

            <td style="font-weight:bold; font-size:1.1em;">المجموع العام</td>

            <td class="bg-yellow text-red" style="font-size:1.1em;">${grandStats.half.m}</td>

            <td class="bg-yellow text-red" style="font-size:1.1em;">${grandStats.half.f}</td>

            <td class="bg-yellow text-red" style="font-size:1.1em;">${grandStats.ext.m}</td>

            <td class="bg-yellow text-red" style="font-size:1.1em;">${grandStats.ext.f}</td>

            <td class="bg-yellow text-red" style="font-size:1.1em;">${allGrandM}</td>

            <td class="bg-yellow text-red" style="font-size:1.1em;">${allGrandF}</td>

            <td class="bg-yellow text-red" style="font-size:1.1em;">${allGrand}</td>

        </tr>

    `;

    // Update Stats Cards

    document.getElementById('totalCount').textContent = allGrand;

    document.getElementById('maleCount').textContent = allGrandM;

    document.getElementById('femaleCount').textContent = allGrandF;

    document.getElementById('halfBoardCount').textContent = grandStats.half.m + grandStats.half.f;

    // Render to tbody directly (table header is in HTML)

    tbody.innerHTML = tbodyContent;

}

function renderSummaryTable(hierarchy, levels) {

    const tbody = document.getElementById('summaryTableBody');

    let html = '';

    // Totals for Summary

    const grandTotal = { ext: { m: 0, f: 0 }, half: { m: 0, f: 0 }, repeaters: { ext: { m: 0, f: 0 }, half: { m: 0, f: 0 } } };

    // Keep levels in order: 1M, 2M, 3M, 4M (smallest to largest)

    levels.forEach(lvl => {

        const classes = Object.values(hierarchy[lvl]);

        const lvlStats = { ext: { m: 0, f: 0 }, half: { m: 0, f: 0 }, repeaters: { ext: { m: 0, f: 0 }, half: { m: 0, f: 0 } } };

        classes.forEach(c => {

            lvlStats.ext.m += c.ext.m;

            lvlStats.ext.f += c.ext.f;

            lvlStats.half.m += c.half.m;

            lvlStats.half.f += c.half.f;

            if (c.repeaters) {
                lvlStats.repeaters.ext.m += c.repeaters.ext.m;
                lvlStats.repeaters.ext.f += c.repeaters.ext.f;
                lvlStats.repeaters.half.m += c.repeaters.half.m;
                lvlStats.repeaters.half.f += c.repeaters.half.f;
            }

        });

        // Add to grand

        grandTotal.ext.m += lvlStats.ext.m;

        grandTotal.ext.f += lvlStats.ext.f;

        grandTotal.half.m += lvlStats.half.m;

        grandTotal.half.f += lvlStats.half.f;
        
        grandTotal.repeaters.ext.m += lvlStats.repeaters.ext.m;
        grandTotal.repeaters.ext.f += lvlStats.repeaters.ext.f;
        grandTotal.repeaters.half.m += lvlStats.repeaters.half.m;
        grandTotal.repeaters.half.f += lvlStats.repeaters.half.f;

        const lvlTotalM = lvlStats.ext.m + lvlStats.half.m;

        const lvlTotalF = lvlStats.ext.f + lvlStats.half.f;

        const lvlGrand = lvlTotalM + lvlTotalF;

        const repTotalM = lvlStats.repeaters.ext.m + lvlStats.repeaters.half.m;
        const repTotalF = lvlStats.repeaters.ext.f + lvlStats.repeaters.half.f;
        const repGrand = repTotalM + repTotalF;

        html += `

            <tr style="border-top: 3px solid #64748b;">

                <td style="font-weight:bold;">${lvl}</td>

                <td class="text-blue">${lvlStats.half.m}</td>

                <td class="text-blue">${lvlStats.half.f}</td>

                <td class="text-blue">${lvlStats.ext.m}</td>

                <td class="text-blue">${lvlStats.ext.f}</td>

                <td class="text-blue">${lvlTotalM}</td>

                <td class="text-blue">${lvlTotalF}</td>

                <td class="bg-yellow text-red">${lvlGrand}</td>

            </tr>
            <tr style="background-color: #fdf2e9; border-bottom: 2px solid #ddd; font-size: 0.9em;">
                <td style="font-weight: bold; color: #d35400;">المعيدين</td>
                <td style="color: #d35400;">${lvlStats.repeaters.half.m}</td>
                <td style="color: #d35400;">${lvlStats.repeaters.half.f}</td>
                <td style="color: #d35400;">${lvlStats.repeaters.ext.m}</td>
                <td style="color: #d35400;">${lvlStats.repeaters.ext.f}</td>
                <td style="color: #d35400;">${repTotalM}</td>
                <td style="color: #d35400;">${repTotalF}</td>
                <td style="color: #d35400; font-weight: bold; background-color: #fdebd0;">${repGrand}</td>
            </tr>

        `;

    });

    const allM = grandTotal.ext.m + grandTotal.half.m;

    const allF = grandTotal.ext.f + grandTotal.half.f;

    const allAll = allM + allF;

    const repAllM = grandTotal.repeaters.ext.m + grandTotal.repeaters.half.m;
    const repAllF = grandTotal.repeaters.ext.f + grandTotal.repeaters.half.f;
    const repAllAll = repAllM + repAllF;

    html += `

        <tr style="background: #ffffcc; border-top: 3px solid #1e293b;">

            <td style="font-weight:bold;">المجموع</td>

            <td class="bg-yellow text-red">${grandTotal.half.m}</td>

            <td class="bg-yellow text-red">${grandTotal.half.f}</td>

            <td class="bg-yellow text-red">${grandTotal.ext.m}</td>

            <td class="bg-yellow text-red">${grandTotal.ext.f}</td>

            <td class="bg-yellow text-red">${allM}</td>

            <td class="bg-yellow text-red">${allF}</td>

            <td class="bg-yellow text-red">${allAll}</td>

        </tr>
        
        <tr style="background-color: #fdf2e9; border-top: 2px solid #d35400;">
            <td style="font-weight: bold; color: #d35400; font-size: 1.05em;"><i class="fa-solid fa-calculator me-1"></i> مجموع المعيدين</td>
            <td style="color: #d35400; font-weight: bold; font-size: 1.1em; background-color: #fdebd0;">${grandTotal.repeaters.half.m}</td>
            <td style="color: #d35400; font-weight: bold; font-size: 1.1em; background-color: #fdebd0;">${grandTotal.repeaters.half.f}</td>
            <td style="color: #d35400; font-weight: bold; font-size: 1.1em; background-color: #fdebd0;">${grandTotal.repeaters.ext.m}</td>
            <td style="color: #d35400; font-weight: bold; font-size: 1.1em; background-color: #fdebd0;">${grandTotal.repeaters.ext.f}</td>
            <td style="color: #d35400; font-weight: bold; font-size: 1.1em; background-color: #fdebd0;">${repAllM}</td>
            <td style="color: #d35400; font-weight: bold; font-size: 1.1em; background-color: #fdebd0;">${repAllF}</td>
            <td style="color: #d35400; font-weight: bold; font-size: 1.1em; background-color: #fdebd0;">${repAllAll}</td>
        </tr>

    `;

    tbody.innerHTML = html;

}

function renderMovementTable(stats) {

    const tbody = document.getElementById('movementTableBody');

    const rows = [

        { label: 'التلاميذ الحاضرين في نهاية الشهر السابق', data: stats.prevEnd },

        { label: 'الدخول خلال الشهر', data: stats.entries },

        { label: 'المجموع', data: null, isSum: true },

        { label: 'الخروج خلال الشهر', data: stats.exits },

        { label: 'التلاميذ الحاضرين في اخر الشهر', data: stats.currEnd, isFinal: true }

    ];

    let html = '';

    let sumRow = { ext: { m: 0, f: 0 }, half: { m: 0, f: 0 } };

    rows.forEach(row => {

        let d = row.data;

        if (row.isSum) {

            // Calculate Sum = Prev + Entries

            d = sumRow;

            d.ext.m = stats.prevEnd.ext.m + stats.entries.ext.m;

            d.ext.f = stats.prevEnd.ext.f + stats.entries.ext.f;

            d.half.m = stats.prevEnd.half.m + stats.entries.half.m;

            d.half.f = stats.prevEnd.half.f + stats.entries.half.f;

        }

        const totalM = d.ext.m + d.half.m;

        const totalF = d.ext.f + d.half.f;

        const grand = totalM + totalF;

        const style = row.isFinal || row.isSum ? 'background: #ffffcc; font-weight: bold;' : '';

        const numColor = row.isFinal ? 'color: red;' : 'color: blue;';

        html += `

            <tr style="${style}">

                <td style="text-align: right; padding-right: 15px;">${row.label}</td>

                <td style="${numColor}">${d.half.m}</td>

                <td style="${numColor}">${d.half.f}</td>

                <td style="${numColor}">${d.ext.m}</td>

                <td style="${numColor}">${d.ext.f}</td>

                <td style="${numColor}">${totalM}</td>

                <td style="${numColor}">${totalF}</td>

                <td class="bg-yellow text-red">${grand}</td>

            </tr>

        `;

    });

    tbody.innerHTML = html;

}

function formatClassName(level, classNum) {

    // Return something like 1m1 or 1s1

    // classNum might already have the stream appended: "1م1 (Sci)"

    // If classNum is just "M1", and level is "1 متوسط", we want "1م1"

    // If it's already full class name "1م1", we might just return it.

    // Check if it already has Arabic prefix

    const lvlNumMatches = level.match(/\d/);

    const lvlNum = lvlNumMatches ? lvlNumMatches[0] : '';

    const isSec = settings.educationStage === 'secondary';

    const separator = isSec ? 'ث' : 'م';

    const prefix = `${lvlNum}${separator}`;

    // Strict check: if it starts with the prefix (e.g. "1ث")

    if (classNum.startsWith(prefix)) return classNum;

    return `${prefix}${classNum}`;

}

function getStreamLabel(code) {

    if (!code) return '';

    const map = {

        'common_arts': 'جذع مشترك آداب',

        'common_science': 'جذع مشترك علوم',

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

        'arts': 'آداب وفلسفة',

        'management': 'تسيير واقتصاد',

        'sport': 'رياضة'

    };

    return map[code.toLowerCase()] || code;

}

function exportToExcel() {

    if (!window.ExcelExportHelper) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'مكتبة التصدير غير متاحة حالياً.' });
        return;
    }

    const classesTable = document.getElementById('classesTable');
    const summaryTable = document.getElementById('summaryTable');
    const movementTable = document.getElementById('movementTable');
    const classesRows = ExcelExportHelper.tableToAoA(classesTable);
    const summaryRows = ExcelExportHelper.tableToAoA(summaryTable);
    const movementRows = ExcelExportHelper.tableToAoA(movementTable);

    if (!classesRows.length && !summaryRows.length && !movementRows.length) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد بيانات جاهزة للتصدير.' });
        return;
    }

    const reportMonth = document.getElementById('reportMonth')?.value || '';
    const metaRows = [
        `المؤسسة: ${settings.institutionName || ''}`,
        `السنة الدراسية: ${settings.schoolYear || ''}`,
        `الشهر: ${reportMonth || '-'}`
    ];

    const sheets = [];
    if (classesRows.length) {
        sheets.push({
            sheetName: 'الأقسام',
            title: 'الكشف الشهري للتعداد - الأقسام',
            metaRows,
            table: classesTable
        });
    }
    if (summaryRows.length) {
        sheets.push({
            sheetName: 'الملخص',
            title: 'الكشف الشهري للتعداد - الملخص',
            metaRows,
            table: summaryTable
        });
    }
    if (movementRows.length) {
        sheets.push({
            sheetName: 'الحركة',
            title: 'الكشف الشهري للتعداد - الحركة',
            metaRows,
            table: movementTable
        });
    }

    ExcelExportHelper.exportWorkbook({
        fileName: `الكشف_الشهري_${ExcelExportHelper.dateStamp()}.xlsx`,
        sheets
    }).catch((error) => {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر إتمام التصدير إلى Excel.' });
    });

}

/**

 * Print Report - opens a new window with the report formatted for printing

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

    const monthInput = document.getElementById('reportMonth').value;

    if (!monthInput) {

        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'الرجاء اختيار الشهر أولا' });

        return;

    }

    const [year, month] = monthInput.split('-').map(Number);

    const monthNames = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

    const monthName = monthNames[month - 1];

    const today = new Date().toLocaleDateString('fr-FR');

    // Get settings

    const wilaya = settings.wilaya || '.......';

    const schoolName = settings.institutionName || '.......';

    const schoolYear = settings.currentYear || '2025/2026';

    const city = settings.municipality || wilaya;

    // Get table contents

    let classesTableHtml = document.getElementById('classesTableSection').innerHTML;

    let summaryTableHtml = document.getElementById('summaryTableSection').innerHTML;

    let movementTableHtml = document.getElementById('movementTableSection').innerHTML;

    // Strip contenteditable and numerical validation attributes for clean printing
    classesTableHtml = classesTableHtml.replace(/contenteditable="true"/g, '').replace(/data-numeric="true"/g, '');
    summaryTableHtml = summaryTableHtml.replace(/contenteditable="true"/g, '').replace(/data-numeric="true"/g, '');
    movementTableHtml = movementTableHtml.replace(/contenteditable="true"/g, '').replace(/data-numeric="true"/g, '');

    // Dynamic Signatures
    let activeSignatures = [];
    if (reportSettings.showSupervisor) activeSignatures.push(reportSettings.titleSupervisor);
    if (reportSettings.showAdvisor) activeSignatures.push(reportSettings.titleAdvisor);
    if (reportSettings.showCensor) activeSignatures.push(reportSettings.titleCensor);
    if (reportSettings.showBursar) activeSignatures.push(reportSettings.titleBursar);
    if (reportSettings.showDirector) activeSignatures.push(reportSettings.titleDirector);

    let signaturesHtml = '';
    if (activeSignatures.length > 0) {
        const widthPct = (100 / activeSignatures.length).toFixed(2);
        activeSignatures.forEach((sig, index) => {
            if (index === activeSignatures.length - 1) { // The last one gets the date
                signaturesHtml += `
                    <div style="text-align: center; width: ${widthPct}%;">
                        <div style="font-size: 11pt; margin-bottom: 5px;">حرر بـ ${city} في: ${today}</div>
                        <div>${sig}</div>
                    </div>
                `;
            } else {
                signaturesHtml += `<div style="text-align: center; width: ${widthPct}%;">${sig}</div>`;
            }
        });
    }

    const printfooterStr = `
    <div class="print-footer" style="margin-top: 30px;">
        ${signaturesHtml}
    </div>`;

    const printWin = window.open('', '_blank');

    printWin.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>
            <meta charset="UTF-8">
            <title>الكشف الشهري - ${monthName} - طباعة</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet">
            <style>
                @font-face {
                    font-family: 'Cairo';
                    font-style: normal;
                    font-weight: 400;
                    src: url('assets/fonts/Cairo-Regular.ttf') format('truetype');
                }
                @font-face {
                    font-family: 'Cairo';
                    font-style: normal;
                    font-weight: 700;
                    src: url('assets/fonts/Cairo-Bold.ttf') format('truetype');
                }

                * { box-sizing: border-box; }
                body { font-family: 'Cairo', sans-serif; margin: 0; padding: 0.5cm; padding-top: 0; direction: rtl; }

                /* Table */
                .section-title {
                    text-align: center;
                    font-weight: bold;
                    font-size: 13pt;
                    margin: 10px 0 5px 0;
                    border-bottom: 1px solid #000;
                    padding-bottom: 5px;
                }
                .stats-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: center;
                    font-size: 12.5pt;
                    font-weight: bold;
                    color: #000;
                }
                .stats-table th, .stats-table td {
                    border: 1px solid #000;
                    padding: 3px 5px;
                    line-height: 1.1;
                }
                .stats-table th {
                    background-color: #eee !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    font-weight: bold;
                }
                .total-row, .level-total-row {
                    background-color: #e8f8f5 !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .grand-total-row {
                    background-color: #fff3cd !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    font-weight: bold;
                }
                .text-blue { color: #000 !important; }
                .text-red { color: #000 !important; font-weight: bold; }
                .bg-yellow { background-color: #fff3cd !important; -webkit-print-color-adjust: exact; }

                /* Footer */
                .print-footer {
                    margin-top: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    font-size: 12pt;
                }

                @media print {
                    @page { size: portrait; margin: 1cm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>

        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
</head>

        <body>
${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            <!-- Header -->

            <div style="text-align:center; margin-bottom: 5px;">

                <h3 style="margin:0; font-size: 14pt;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                <h3 style="margin:2px 0; font-size: 12pt;">وزارة التربية الوطنية</h3>

            </div>

            <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px;">

                <div style="text-align:right; width: 33%;">

                    <h3 style="margin:0; font-size: 11pt;">مديرية التربية لولاية ${wilaya}</h3>

                    <h3 style="margin:2px 0 0 0; font-size: 11pt;">المؤسسة: ${schoolName}</h3>

                </div>

                <div style="text-align:center; width: 33%;">

                    <h2 style="margin:0; text-decoration: underline; font-size: 14pt;">الكشف الشهري</h2>

                    <p style="margin: 5px 0 0 0; font-size: 10pt;">شهر ${monthName}</p>

                </div>

                <div style="text-align:left; width: 33%;">

                    <h3 style="margin:0; font-size: 12pt;">السنة الدراسية: ${settings.schoolYear || '2025/2026'}</h3>

                </div>

            </div>

            <!-- Classes Table -->

            <div>${classesTableHtml}</div>

            <!-- Summary Table (Page 2) -->

            <div style="page-break-before: always;">${summaryTableHtml}</div>

            <!-- Movement Table -->

            <div>${movementTableHtml}</div>

            <!-- Footer -->

            ${printfooterStr}

            <script>

                setTimeout(() => { // window.print(); /* Replaced by global Toolbar */ }, 500);

            </script>

        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
</body>

        </html>

    `);

    printWin.document.close();

}

// Settings Modal Functions

function openSettings() {

    document.getElementById('titleSupervisor').value = reportSettings.titleSupervisor || 'المشرف العام';
    document.getElementById('showSupervisor').checked = reportSettings.showSupervisor !== false;
    document.getElementById('titleAdvisor').value = reportSettings.titleAdvisor || 'مستشار التربية';
    document.getElementById('showAdvisor').checked = reportSettings.showAdvisor !== false;

    document.getElementById('titleCensor').value = reportSettings.titleCensor || 'الناظر';
    document.getElementById('showCensor').checked = reportSettings.showCensor !== false;

    document.getElementById('titleBursar').value = reportSettings.titleBursar || 'المقتصد';
    document.getElementById('showBursar').checked = reportSettings.showBursar !== false;

    document.getElementById('titleDirector').value = reportSettings.titleDirector || 'المدير';
    document.getElementById('showDirector').checked = reportSettings.showDirector !== false;

    document.getElementById('settingsModal').style.display = 'flex';

}

function closeSettings() {

    document.getElementById('settingsModal').style.display = 'none';

}

async function saveSettings() {

    reportSettings.titleSupervisor = document.getElementById('titleSupervisor').value || 'المشرف العام';
    reportSettings.showSupervisor = document.getElementById('showSupervisor').checked;
    reportSettings.titleAdvisor = document.getElementById('titleAdvisor').value || 'مستشار التربية';
    reportSettings.showAdvisor = document.getElementById('showAdvisor').checked;

    reportSettings.titleCensor = document.getElementById('titleCensor').value || 'الناظر';
    reportSettings.showCensor = document.getElementById('showCensor').checked;

    reportSettings.titleBursar = document.getElementById('titleBursar').value || 'المقتصد';
    reportSettings.showBursar = document.getElementById('showBursar').checked;

    reportSettings.titleDirector = document.getElementById('titleDirector').value || 'المدير';
    reportSettings.showDirector = document.getElementById('showDirector').checked;

    await DB.set('monthlyReportSettings', reportSettings);

    closeSettings();

    Swal.fire({ icon: 'success', title: 'تم الحفظ', text: 'تم حفظ الإعدادات بنجاح', timer: 2000, showConfirmButton: false });

}

// --- Inline Table Editing Feature ---

let isTableEditing = false;

function toggleTableEditing() {
    isTableEditing = !isTableEditing;
    const btn = document.getElementById('toggleEditBtn');
    const btnText = document.getElementById('editBtnText');
    const tds = document.querySelectorAll('.stats-table tbody td:not(:first-child)');
    
    if (isTableEditing) {
        if(btn) btn.style.backgroundColor = '#e74c3c';
        // Add a class that signals active editing to trigger the hover/focus css we added
        document.body.classList.add('editing-active');
        if(btnText) btnText.innerHTML = 'إنهاء التعديل';
        tds.forEach(td => {
            td.setAttribute('contenteditable', 'true');
            if (/^\\d+$/.test(td.textContent.trim())) {
                td.setAttribute('data-numeric', 'true');
            }
            td.addEventListener('keypress', validateNumericInput);
            td.addEventListener('paste', validateNumericPaste);
            td.addEventListener('input', handleMonthlyReportEditableCellInput);
            td.addEventListener('blur', handleMonthlyReportEditableCellInput);
        });
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'info',
                title: 'التعديل مفعل',
                text: 'يمكنك الآن النقر على الأرقام وتعديلها مباشرة في الجداول.',
                timer: 3000,
                showConfirmButton: false
            });
        }
    } else {
        if(btn) btn.style.backgroundColor = '#f39c12';
        document.body.classList.remove('editing-active');
        if(btnText) btnText.innerHTML = 'تفعيل التعديل';
        tds.forEach(td => {
            td.removeAttribute('contenteditable');
            td.removeAttribute('data-numeric');
            td.removeEventListener('keypress', validateNumericInput);
            td.removeEventListener('paste', validateNumericPaste);
            td.removeEventListener('input', handleMonthlyReportEditableCellInput);
            td.removeEventListener('blur', handleMonthlyReportEditableCellInput);
        });
        persistMonthlyReportTableEdits();
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'تغييرات جاهزة',
                text: 'تم تثبيت التعديلات. يمكنك الآن طباعة التقرير.',
                timer: 3000,
                showConfirmButton: false
            });
        }
    }
}

function validateNumericInput(e) {
    if (this.getAttribute('data-numeric') === 'true') {
        const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
        if (!/[0-9]/.test(e.key) && !allowedKeys.includes(e.key)) {
            e.preventDefault();
        }
    }
}

function validateNumericPaste(e) {
    if (this.getAttribute('data-numeric') === 'true') {
        let paste = (e.clipboardData || window.clipboardData).getData('text');
        if (!/^\\d+$/.test(paste.trim())) {
            e.preventDefault();
        }
    }
}

window.addEventListener('beforeunload', flushMonthlyReportTableEdits);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        flushMonthlyReportTableEdits();
    }
});
