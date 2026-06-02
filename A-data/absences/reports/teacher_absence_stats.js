/**
 * Teacher and Supervisor Absence Statistics
 */

let allTeachers = [];
let allSupervisors = [];
let currentViewMode = 'summary';
let lastSortedStats = [];

function setDefaultDateRange() {
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    if (!startDate || !endDate) return;

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const toISODate = (date) => date.toISOString().split('T')[0];

    if (!startDate.value) startDate.value = toISODate(startOfMonth);
    if (!endDate.value) endDate.value = toISODate(today);
}

function formatHoursValue(value) {
    const num = Number(value) || 0;
    if (Number.isInteger(num)) return String(num);
    return num.toFixed(2).replace(/\.?0+$/, '');
}

function calculateTimeRangeHours(from, to) {
    if (!from || !to || from === '-' || to === '-') return 0;

    const [startHour, startMinute] = String(from).split(':').map(Number);
    const [endHour, endMinute] = String(to).split(':').map(Number);
    if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return 0;

    const startTotal = (startHour * 60) + startMinute;
    const endTotal = (endHour * 60) + endMinute;
    if (endTotal <= startTotal) return 0;

    return Math.round((((endTotal - startTotal) / 60) * 100)) / 100;
}

function getDayName(dateValue) {
    const date = new Date(dateValue);
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[date.getDay()] || '';
}

function matchesStaffTypeFilter(filterValue, staffType) {
    if (filterValue === 'all') return true;
    if (filterValue === 'teachers') return staffType === 'teacher';
    if (filterValue === 'supervisors') return staffType === 'supervisor';
    return true;
}

function updateSummaryCards(summary = {}) {
    const values = {
        staffCountCard: summary.staffCount ?? '-',
        absenceDaysCard: summary.absenceDays ?? '-',
        delayCountCard: summary.delayCount ?? '-',
        hoursTotalCard: summary.hoursTotal ?? '-'
    };

    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

function getEmptyIcon() {
    return typeof IconManager !== 'undefined' ? IconManager.get('empty_box') : '📭';
}

function getSuccessIcon() {
    return typeof IconManager !== 'undefined' ? IconManager.get('success') : '✅';
}

function buildStaffIndexes() {
    const teacherIndex = new Map();
    const supervisorIndex = new Map();

    allTeachers.forEach((teacher) => {
        const idKey = String(teacher.id || '').trim();
        const nameKey = `${teacher.last_name || teacher.name || ''}-${teacher.first_name || ''}`.trim();
        if (idKey) teacherIndex.set(idKey, teacher);
        if (nameKey) teacherIndex.set(nameKey, teacher);
    });

    allSupervisors.forEach((supervisor) => {
        const idKey = String(supervisor.id || '').trim();
        const nameKey = String(supervisor.name || '').trim();
        if (idKey) supervisorIndex.set(idKey, supervisor);
        if (nameKey) supervisorIndex.set(nameKey, supervisor);
    });

    return { teacherIndex, supervisorIndex };
}

function resolveTeacherIdentity(rawTeacher, teacherIndex) {
    const rawId = String(rawTeacher.id || '').trim();
    const teacher = teacherIndex.get(rawId)
        || teacherIndex.get(`${rawTeacher.last_name || rawTeacher.name || ''}-${rawTeacher.first_name || ''}`.trim());

    if (teacher) {
        return {
            id: rawId,
            name: teacher.name || `${teacher.last_name || ''} ${teacher.first_name || ''}`.trim(),
            subject: teacher.subject || '-',
            staffType: 'teacher',
            staffTypeLabel: 'أستاذ'
        };
    }

    return {
        id: rawId,
        name: rawTeacher.name || rawId,
        subject: rawTeacher.subject || '-',
        staffType: 'teacher',
        staffTypeLabel: 'أستاذ'
    };
}

function resolveSupervisorIdentity(rawSupervisor, supervisorIndex) {
    const rawId = String(rawSupervisor.id || '').trim();
    const supervisor = supervisorIndex.get(rawId) || supervisorIndex.get(String(rawSupervisor.name || '').trim());

    if (supervisor) {
        return {
            id: rawId,
            name: supervisor.name || rawId,
            subject: supervisor.rank || supervisor.role || '-',
            staffType: 'supervisor',
            staffTypeLabel: 'مشرف/إداري'
        };
    }

    return {
        id: rawId,
        name: rawSupervisor.name || rawId,
        subject: rawSupervisor.rank || '-',
        staffType: 'supervisor',
        staffTypeLabel: 'مشرف/إداري'
    };
}

function normalizeTeacherEvent(record, teacherRecord, teacherIndex) {
    const identity = resolveTeacherIdentity(teacherRecord, teacherIndex);
    const eventType = teacherRecord.type === 'late'
        ? 'late'
        : (teacherRecord.type === 'partial' ? 'partial' : 'full');

    let notes = '';
    if (eventType === 'late' && teacherRecord.lateDuration) {
        notes = `${teacherRecord.lateDuration} دقيقة`;
    } else if (eventType === 'partial' && Array.isArray(teacherRecord.periods) && teacherRecord.periods.length) {
        notes = `${teacherRecord.periods.length} حصص`;
    }

    return {
        ...identity,
        date: record.date,
        type: eventType,
        typeLabel: eventType === 'late' ? 'تأخر' : (eventType === 'partial' ? 'غياب جزئي' : 'غياب كامل'),
        absenceDays: eventType === 'late' ? 0 : 1,
        delayCount: eventType === 'late' ? 1 : 0,
        hours: Number(teacherRecord.hours) || 0,
        reason: teacherRecord.reason || '',
        notes
    };
}

function normalizeSupervisorEvent(record, supervisorRecord, supervisorIndex) {
    const identity = resolveSupervisorIdentity(supervisorRecord, supervisorIndex);
    const period = String(supervisorRecord.period || 'FULL').toUpperCase();

    let type = 'full';
    let typeLabel = 'غياب كامل';
    let absenceDays = 1;
    let delayCount = 0;
    let hours = 0;
    let notes = '';

    if (period === 'LATE') {
        type = 'late';
        typeLabel = 'تأخر';
        absenceDays = 0;
        delayCount = 1;
        notes = supervisorRecord.lateDuration ? `${supervisorRecord.lateDuration} دقيقة` : '';
    } else if (period === 'PARTIAL') {
        type = 'partial';
        typeLabel = 'غياب جزئي';
        notes = (supervisorRecord.from && supervisorRecord.to) ? `${supervisorRecord.from} - ${supervisorRecord.to}` : '';
        hours = calculateTimeRangeHours(supervisorRecord.from, supervisorRecord.to);
    } else if (period === 'AM') {
        type = 'am';
        typeLabel = 'غياب صباحي';
    } else if (period === 'PM') {
        type = 'pm';
        typeLabel = 'غياب مسائي';
    }

    return {
        ...identity,
        date: record.date,
        type,
        typeLabel,
        absenceDays,
        delayCount,
        hours,
        reason: supervisorRecord.reason || '',
        notes
    };
}

function buildNormalizedEvents(records, staffTypeFilter) {
    const { teacherIndex, supervisorIndex } = buildStaffIndexes();
    const events = [];

    records.forEach((record) => {
        (record.teachers || []).forEach((teacherRecord) => {
            const event = normalizeTeacherEvent(record, teacherRecord, teacherIndex);
            if (matchesStaffTypeFilter(staffTypeFilter, event.staffType)) {
                events.push(event);
            }
        });

        (record.supervisors || []).forEach((supervisorRecord) => {
            const event = normalizeSupervisorEvent(record, supervisorRecord, supervisorIndex);
            if (matchesStaffTypeFilter(staffTypeFilter, event.staffType)) {
                events.push(event);
            }
        });
    });

    return events;
}

function aggregateStats(events) {
    const statsMap = new Map();

    events.forEach((event) => {
        if (!statsMap.has(event.id)) {
            statsMap.set(event.id, {
                id: event.id,
                name: event.name,
                subject: event.subject,
                staffType: event.staffType,
                staffTypeLabel: event.staffTypeLabel,
                days: 0,
                delays: 0,
                hours: 0,
                details: []
            });
        }

        const stat = statsMap.get(event.id);
        stat.days += event.absenceDays;
        stat.delays += event.delayCount;
        stat.hours = Math.round((stat.hours + (event.hours || 0)) * 100) / 100;
        stat.details.push({
            date: event.date,
            type: event.type,
            typeLabel: event.typeLabel,
            reason: event.reason,
            notes: event.notes
        });
    });

    return Array.from(statsMap.values()).sort((a, b) => {
        if (b.days !== a.days) return b.days - a.days;
        if (b.delays !== a.delays) return b.delays - a.delays;
        return a.name.localeCompare(b.name, 'ar');
    });
}

function renderSummaryView(sortedStats, staffTypeFilter) {
    const resultsArea = document.getElementById('resultsArea');
    const headingLabel = staffTypeFilter === 'teachers'
        ? 'أستاذ'
        : (staffTypeFilter === 'supervisors' ? 'مشرف/إداري' : 'موظف');

    let html = `
        <h3 style="margin-bottom: 20px;">نتائج البحث: ${sortedStats.length} ${headingLabel}</h3>
        <div class="table-wrapper">
            <table class="stats-table">
                <thead>
                    <tr>
                        <th width="5%">#</th>
                        <th width="24%">الاسم</th>
                        <th width="14%">النوع</th>
                        <th width="18%">المادة / الصفة</th>
                        <th width="12%">أيام الغياب</th>
                        <th width="12%">التأخرات</th>
                        <th width="12%">مجموع الساعات</th>
                        <th width="13%">المعدل</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sortedStats.forEach((stat, index) => {
        const avg = stat.days > 0 ? formatHoursValue(stat.hours / stat.days) : '0';
        html += `
            <tr>
                <td>${index + 1}</td>
                <td style="font-weight:bold;">${stat.name}</td>
                <td>${stat.staffTypeLabel}</td>
                <td>${stat.subject || '-'}</td>
                <td><span class="badge" style="background:#e74c3c; color:white; padding: 4px 8px; border-radius:4px;">${stat.days}</span></td>
                <td><span class="badge" style="background:#f39c12; color:white; padding: 4px 8px; border-radius:4px;">${stat.delays}</span></td>
                <td>${formatHoursValue(stat.hours)} سا</td>
                <td>${avg}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    resultsArea.innerHTML = html;
}

function renderDetailedView(sortedStats) {
    const resultsArea = document.getElementById('resultsArea');
    let html = `
        <h3 style="margin-bottom: 20px;">العرض التفصيلي: ${sortedStats.length} موظف</h3>
    `;

    sortedStats.forEach((stat, index) => {
        const details = [...stat.details].sort((a, b) => a.date.localeCompare(b.date));
        html += `
            <div style="background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); margin-bottom: 20px; overflow: hidden; border: 1px solid #eef2f7;">
                <div style="background: var(--bg-color); padding: 12px 20px; border-bottom: 1px solid #eef2f7; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <div style="font-weight: bold; font-size: 1.05rem; color: var(--primary-color);">
                        ${index + 1}. ${stat.name}
                        <span style="color: #7f8c8d; font-weight: normal; font-size: 0.9rem;">(${stat.staffTypeLabel} - ${stat.subject || '-'})</span>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <span class="badge" style="background:#e74c3c; color:white; padding: 5px 10px; border-radius:6px;">غياب: ${stat.days}</span>
                        <span class="badge" style="background:#f39c12; color:white; padding: 5px 10px; border-radius:6px;">تأخر: ${stat.delays}</span>
                    </div>
                </div>
                <table class="stats-table" style="margin-top: 0; box-shadow: none; border-radius: 0;">
                    <thead>
                        <tr>
                            <th width="5%">#</th>
                            <th width="18%">التاريخ</th>
                            <th width="14%">اليوم</th>
                            <th width="18%">النوع</th>
                            <th width="20%">السبب</th>
                            <th width="25%">ملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        details.forEach((detail, detailIndex) => {
            const dateObj = new Date(detail.date);
            const formattedDate = dateObj.toLocaleDateString('ar-DZ');
            const dayName = getDayName(detail.date);
            const color = detail.type === 'late'
                ? '#f39c12'
                : (detail.type === 'partial' ? '#e67e22' : '#e74c3c');

            html += `
                        <tr>
                            <td>${detailIndex + 1}</td>
                            <td>${formattedDate}</td>
                            <td>${dayName}</td>
                            <td><span class="badge" style="background:${color}; color:white; padding: 4px 8px; border-radius:4px;">${detail.typeLabel}</span></td>
                            <td>${detail.reason || '-'}</td>
                            <td>${detail.notes || '-'}</td>
                        </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    });

    resultsArea.innerHTML = html;
}

function renderNoDataState(staffTypeFilter) {
    const resultsArea = document.getElementById('resultsArea');
    updateSummaryCards({ staffCount: 0, absenceDays: 0, delayCount: 0, hoursTotal: 0 });

    const noDataLabel = staffTypeFilter === 'teachers'
        ? 'لا توجد غيابات أو تأخرات للأساتذة'
        : (staffTypeFilter === 'supervisors'
            ? 'لا توجد غيابات أو تأخرات للمشرفين والإداريين'
            : 'لا توجد غيابات أو تأخرات للموظفين');

    resultsArea.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #7f8c8d;">
            <h3>${getSuccessIcon()} ${noDataLabel}</h3>
            <p>الفترة المحددة لا تحتوي على سجلات مطابقة للفلتر الحالي.</p>
        </div>
    `;
}

async function loadStats() {
    const startDateVal = document.getElementById('startDate').value;
    const endDateVal = document.getElementById('endDate').value;
    const resultsArea = document.getElementById('resultsArea');
    const staffTypeFilter = document.getElementById('staffTypeFilter') ? document.getElementById('staffTypeFilter').value : 'all';

    if (!startDateVal || !endDateVal) {
        showToast('الرجاء تحديد التاريخ من وإلى', 'warning');
        return;
    }

    if (startDateVal > endDateVal) {
        showToast('تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية', 'warning');
        return;
    }

    resultsArea.innerHTML = '<div style="text-align:center; padding:20px;">جاري التحميل...</div>';

    if (allTeachers.length === 0) {
        allTeachers = await DB.getTeachers() || [];
    }
    allSupervisors = await DB.get('supervisorsList') || [];

    const records = await DB.getAbsencesRange(startDateVal, endDateVal) || [];
    if (records.length === 0) {
        updateSummaryCards({ staffCount: 0, absenceDays: 0, delayCount: 0, hoursTotal: 0 });
        resultsArea.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                <h3>${getEmptyIcon()} لا توجد بيانات</h3>
                <p>لم يتم تسجيل أي غيابات أو تأخرات في الفترة المحددة</p>
            </div>
        `;
        return;
    }

    const normalizedEvents = buildNormalizedEvents(records, staffTypeFilter);
    if (normalizedEvents.length === 0) {
        renderNoDataState(staffTypeFilter);
        lastSortedStats = [];
        return;
    }

    const sortedStats = aggregateStats(normalizedEvents);
    const totals = sortedStats.reduce((acc, stat) => {
        acc.staffCount += 1;
        acc.absenceDays += stat.days;
        acc.delayCount += stat.delays;
        acc.hoursTotal += stat.hours;
        return acc;
    }, { staffCount: 0, absenceDays: 0, delayCount: 0, hoursTotal: 0 });

    updateSummaryCards({
        staffCount: totals.staffCount,
        absenceDays: totals.absenceDays,
        delayCount: totals.delayCount,
        hoursTotal: formatHoursValue(totals.hoursTotal)
    });

    lastSortedStats = sortedStats;

    if (currentViewMode === 'detailed') {
        renderDetailedView(sortedStats);
    } else {
        renderSummaryView(sortedStats, staffTypeFilter);
    }
}

function switchView(mode) {
    currentViewMode = mode;
    const btnSummary = document.getElementById('btnSummaryView');
    const btnDetailed = document.getElementById('btnDetailedView');

    if (btnSummary && btnDetailed) {
        if (mode === 'summary') {
            btnSummary.className = 'btn active-view';
            btnDetailed.className = 'btn btn-secondary';
        } else {
            btnSummary.className = 'btn btn-secondary';
            btnDetailed.className = 'btn active-view';
        }
    }

    if (!lastSortedStats.length) {
        loadStats();
        return;
    }

    if (mode === 'summary') {
        renderSummaryView(lastSortedStats, document.getElementById('staffTypeFilter') ? document.getElementById('staffTypeFilter').value : 'all');
    } else {
        renderDetailedView(lastSortedStats);
    }
}

function buildSummaryPrintHtml(resultsArea) {
    const table = resultsArea.querySelector('table');
    return table ? table.outerHTML : '';
}

function buildDetailedPrintHtml() {
    let html = '';

    lastSortedStats.forEach((stat, index) => {
        const details = [...stat.details].sort((a, b) => a.date.localeCompare(b.date));
        html += `
            <div class="teacher-card">
                <div class="teacher-header">
                    ${index + 1}. ${stat.name} (${stat.staffTypeLabel} - ${stat.subject || '-'})
                    <span style="margin-right: 20px; font-weight: normal;">غياب: ${stat.days} | تأخر: ${stat.delays}</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th width="5%">#</th>
                            <th width="18%">التاريخ</th>
                            <th width="14%">اليوم</th>
                            <th width="18%">النوع</th>
                            <th width="20%">السبب</th>
                            <th width="25%">ملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        details.forEach((detail, detailIndex) => {
            const formattedDate = new Date(detail.date).toLocaleDateString('ar-DZ');
            html += `
                        <tr>
                            <td>${detailIndex + 1}</td>
                            <td>${formattedDate}</td>
                            <td>${getDayName(detail.date)}</td>
                            <td>${detail.typeLabel}</td>
                            <td>${detail.reason || '-'}</td>
                            <td>${detail.notes || '-'}</td>
                        </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    });

    return html;
}

async function generatePrintReport() {
    const startDateVal = document.getElementById('startDate').value;
    const endDateVal = document.getElementById('endDate').value;
    const resultsArea = document.getElementById('resultsArea');

    if (!resultsArea.querySelector('table') && !lastSortedStats.length) {
        showToast('الرجاء عرض النتائج أولاً قبل الطباعة', 'warning');
        return;
    }

    const settings = await DB.get('institutionSettings') || {};
    const formattedStart = new Date(startDateVal).toLocaleDateString('ar-DZ');
    const formattedEnd = new Date(endDateVal).toLocaleDateString('ar-DZ');

    const printWindow = window.open('', '', 'height=800,width=1000');
    if (!printWindow) {
        showToast('تم حظر النافذة المنبثقة. الرجاء السماح بها.', 'error');
        return;
    }

    const reportTitle = currentViewMode === 'detailed'
        ? 'التقرير التفصيلي لغيابات وتأخرات الأساتذة والمشرفين'
        : 'تقرير إحصائي لغيابات الأساتذة والمشرفين';

    const bodyContent = currentViewMode === 'detailed'
        ? buildDetailedPrintHtml()
        : buildSummaryPrintHtml(resultsArea);

    const summaryRow = `
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0;">
            <div style="border:1px solid #ccc; padding:12px; text-align:center;">
                <div style="font-size:12px; color:#666;">عدد الموظفين المتأثرين</div>
                <div style="font-size:20px; font-weight:bold;">${document.getElementById('staffCountCard')?.textContent || '-'}</div>
            </div>
            <div style="border:1px solid #ccc; padding:12px; text-align:center;">
                <div style="font-size:12px; color:#666;">أيام الغياب</div>
                <div style="font-size:20px; font-weight:bold;">${document.getElementById('absenceDaysCard')?.textContent || '-'}</div>
            </div>
            <div style="border:1px solid #ccc; padding:12px; text-align:center;">
                <div style="font-size:12px; color:#666;">عدد التأخرات</div>
                <div style="font-size:20px; font-weight:bold;">${document.getElementById('delayCountCard')?.textContent || '-'}</div>
            </div>
            <div style="border:1px solid #ccc; padding:12px; text-align:center;">
                <div style="font-size:12px; color:#666;">مجموع الساعات</div>
                <div style="font-size:20px; font-weight:bold;">${document.getElementById('hoursTotalCard')?.textContent || '-'}</div>
            </div>
        </div>
    `;

    const reportHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>${reportTitle}</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
                body {
                    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
                    padding: 25px 30px;
                    color: #222;
                    font-size: 14px;
                    line-height: 1.6;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                    font-size: 13px;
                }
                th, td {
                    border: 1px solid #555;
                    padding: 7px 10px;
                    text-align: center;
                }
                th {
                    background-color: #e8e8e8;
                    font-weight: 700;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                .report-header {
                    text-align: center;
                    margin-bottom: 25px;
                    padding-bottom: 15px;
                    border-bottom: 3px double #333;
                }
                .teacher-card {
                    margin-bottom: 20px;
                    page-break-inside: avoid;
                }
                .teacher-header {
                    background: #e8e8e8;
                    padding: 8px 15px;
                    font-weight: 700;
                    border: 1px solid #555;
                    border-bottom: none;
                }
                @media print {
                    body { padding: 10px; }
                    .teacher-card { page-break-inside: avoid; }
                }
            </style>
        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
            <div class="report-header">
                <p style="font-weight:700; font-size: 15px; margin: 3px 0;">الجمهورية الجزائرية الديمقراطية الشعبية</p>
                <p style="margin: 3px 0;">وزارة التربية الوطنية</p>
                <div style="display:flex; justify-content:space-between; margin-top:15px; font-size:13px;">
                    <div>مديرية التربية لولاية ${settings.wilaya || '...'}</div>
                    <div>السنة الدراسية: ${settings.schoolYear || '2025/2026'}</div>
                </div>
                <div style="margin-top:8px;">${settings.institutionName || '...'}</div>
                <div style="font-size:20px; font-weight:700; margin-top:15px; text-decoration:underline;">${reportTitle}</div>
                <p style="margin: 8px 0 0;">الفترة الممتدة من: ${formattedStart} إلى: ${formattedEnd}</p>
            </div>
            ${summaryRow}
            ${bodyContent}
            <div style="margin-top: 40px; text-align: left; font-size: 12px;">
                حرر بتاريخ: ${new Date().toLocaleDateString('ar-DZ')}
            </div>
        ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}
        </body>
        </html>
    `;

    printWindow.document.write(reportHtml);
    printWindow.document.close();
}

document.addEventListener('DOMContentLoaded', async () => {
    setDefaultDateRange();
    allTeachers = await DB.getTeachers() || [];
    allSupervisors = await DB.get('supervisorsList') || [];
    await loadStats();
});
