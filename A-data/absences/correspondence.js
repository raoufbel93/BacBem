/**
 * Correspondence and Strike-off System
 */
console.log('Correspondence System Loaded');

// Global variables
let allStudents = [];
let classes = [];
let correspondenceRecords = [];

// NEW: Correspondence Logs
let correspondenceLogs = [];

window.currentResults = [];

// Stream Names Map (Arabic)
const streamLabels = {
    'common_science': 'جذع مشترك علوم وتكنولوجيا',
    'common_arts': 'جذع مشترك آداب',
    'science': 'علوم تجريبية',
    'math': 'رياضيات',
    'tech_math': 'تقني رياضي',
    'tech_math_civil': 'هندسة مدنية',
    'tech_math_mech': 'هندسة ميكانيكية',
    'tech_math_elec': 'هندسة كهربائية',
    'tech_math_methods': 'هندسة الطرائق',
    'management': 'تسيير واقتصاد',
    'languages': 'لغات أجنبية',
    'arts': 'آداب وفلسفة'
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await Auth.checkAuth();

    // Load Logs
    correspondenceLogs = await DB.get('correspondenceLogs') || [];

    await initPage();
});

async function initPage() {
    console.log('initPage called');

    // Load Settings
    window.appSettings = await DB.get('institutionSettings') || {};

    // Load Students
    allStudents = await DB.getStudents(false) || [];

    // Load Correspondence History
    correspondenceRecords = await DB.get('correspondenceRecords') || [];

    // Initial Render
    populateLevels();
    populateStreams();
    filterTable();
}

function populateLevels() {
    const levels = [...new Set(allStudents.map(s => s.level))].filter(Boolean).sort();
    const select = document.getElementById('levelSelect');
    select.innerHTML = '<option value="">كل المستويات</option>' +
        levels.map(l => `<option value="${l}">${l}</option>`).join('');
}

function populateStreams() {
    const levelSelect = document.getElementById('levelSelect');
    const streamSelect = document.getElementById('streamSelect');
    if (!streamSelect) return;

    // Determine Stage (Secondary if streams exist or setting says so)
    let isSecondary = (window.appSettings && window.appSettings.educationStage === 'secondary');

    // Auto-detect from data if not set
    if (!isSecondary && allStudents.length > 0) {
        if (allStudents.some(s => s.stream)) isSecondary = true;
    }

    if (!isSecondary) {
        streamSelect.style.display = 'none';
        streamSelect.innerHTML = '<option value="">كل الشعب</option>';
        return;
    }

    // Get selected level
    const selectedLevel = levelSelect.value;

    // Filter streams based on level
    const streams = new Set();
    allStudents.forEach(s => {
        if (s.stream) {
            if (!selectedLevel || s.level === selectedLevel) {
                streams.add(s.stream);
            }
        }
    });

    if (streams.size === 0) {
        streamSelect.style.display = 'none';
    } else {
        streamSelect.style.display = 'inline-block';
        const sortedStreams = Array.from(streams).sort();

        streamSelect.innerHTML = '<option value="">كل الشعب</option>' +
            sortedStreams.map(st => `<option value="${st}">${streamLabels[st] || st}</option>`).join('');
    }
}

function loadClasses() {
    const level = document.getElementById('levelSelect').value;
    const stream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : '';
    const classSelect = document.getElementById('classSelect');

    if (!level) {
        classSelect.innerHTML = '<option value="">كل الأقسام</option>';
        return;
    }

    const levelClasses = [...new Set(allStudents
        .filter(s => {
            if (level && s.level !== level) return false;
            if (stream && s.stream !== stream) return false;
            return true;
        })
        .map(s => s.class))
    ].sort((a, b) => a - b);

    classSelect.innerHTML = '<option value="">كل الأقسام</option>' +
        levelClasses.map(c => `<option value="${c}">${c}</option>`).join('');

    filterTable();
}

async function filterTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">جاري التحليل...</td></tr>';

    // Defer to allow UI update
    setTimeout(async () => {
        await processAndRenderStudents();
    }, 10);
}

async function processAndRenderStudents() {
    const level = document.getElementById('levelSelect').value;
    const stream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : '';
    const classNum = document.getElementById('classSelect').value;
    const search = document.getElementById('studentSearch').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    const tbody = document.getElementById('tableBody');

    // 1. Filter students
    let students = allStudents.filter(s => {
        if (level && s.level !== level) return false;
        if (stream && s.stream !== stream) return false;
        if (classNum && String(s.class) !== String(classNum)) return false;
        if (search && !(`${s.last_name} ${s.first_name}`.toLowerCase().includes(search))) return false;
        return true;
    });

    // 2. Fetch Absences & Calculate Streaks for filtered students
    const absenceRecords = await DB.getAllAbsencesExport() || [];
    absenceRecords.sort((a, b) => b.date.localeCompare(a.date)); // Newest first

    let results = [];
    const currentDate = new Date().toISOString().split('T')[0];

    for (const student of students) {
        const studentId = String(student.id || `${student.last_name}-${student.first_name}`);

        // Calculate Streak
        let streakStartDate = null;
        let streakDays = 0;
        let lastRecordStatus = 'unknown';
        let lastRecordDate = null;

        for (const record of absenceRecords) {
            if (record.date > currentDate) continue;
            const isAbsent = record.students && record.students.some(s => {
                if (String(s.id) !== studentId) return false;
                const r = s.reason || '';
                return !r || r.includes('غير مبرر') || r === 'غير مُبرر';
            });
            lastRecordStatus = isAbsent ? 'absent' : 'present';
            lastRecordDate = record.date;
            break; // Found most recent
        }

        if (lastRecordStatus === 'absent') {
            // Active streak! Calculate start date.
            streakStartDate = lastRecordDate;

            for (const record of absenceRecords) {
                if (record.date > currentDate) continue;
                const isAbsent = record.students && record.students.some(s => {
                    if (String(s.id) !== studentId) return false;
                    const r = s.reason || '';
                    return !r || r.includes('غير مبرر') || r === 'غير مُبرر';
                });
                if (isAbsent) {
                    streakStartDate = record.date;
                } else {
                    break;
                }
            }

            // Calc days
            const curr = new Date(currentDate);
            const start = new Date(streakStartDate);
            const diffTime = Math.abs(curr - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            streakDays = diffDays + 1;
        }

        // Determine Action
        let actionStatus = 'ok';
        let actionLabel = 'طبيعي';
        // Thresholds
        if (streakDays >= 33) { actionStatus = 'strikeoff'; actionLabel = 'شطب'; }
        else if (streakDays >= 18) { actionStatus = 'warning'; actionLabel = 'اعذار'; }
        else if (streakDays >= 11) { actionStatus = 'notice2'; actionLabel = 'إشعار 2'; }
        else if (streakDays >= 3) { actionStatus = 'notice1'; actionLabel = 'إشعار 1'; }

        // Filter by status if requested
        if (statusFilter && statusFilter !== actionStatus) continue;
        if (!statusFilter && actionStatus === 'ok') continue; // Hide 'ok' by default per user request

        // Push result
        results.push({
            student,
            streakDays,
            streakStartDate,
            actionStatus,
            actionLabel
        });
    }

    // Store results globally for print access
    window.currentResults = results;

    // Render
    if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">لا توجد حالات مطابقة</td></tr>';
        return;
    }

    tbody.innerHTML = results.map((item, index) => {
        const s = item.student;
        const cls = `status-${item.actionStatus}`;

        // Filter Logs for this student
        const studentId = String(s.id || `${s.last_name}-${s.first_name}`);
        const studentLogs = correspondenceLogs.filter(log => log.studentId === studentId);
        // Sort by date desc
        studentLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${s.last_name} ${s.first_name}</td>
                <td>
                    ${(() => {
                const streamMap = {
                    'common_science': 'ج.م.ع.ت',
                    'common_arts': 'ج.م.آ',
                    'science': 'ع.تج',
                    'math': 'ر',
                    'tech_math': 'ت.ر',
                    'tech_math_civil': 'ت.ر (هـ.م)',
                    'tech_math_mech': 'ت.ر (هـ.ميك)',
                    'tech_math_elec': 'ت.ر (هـ.ك)',
                    'tech_math_methods': 'ت.ر (هـ.ط)',
                    'management': 'ت.اق',
                    'languages': 'ل.أ',
                    'arts': 'آ.ف'
                };

                let streamAbbr = '';
                if (s.stream) {
                    streamAbbr = streamMap[s.stream] ||
                        (typeof SubjectManager !== 'undefined' && SubjectManager.getStreamAbbreviation ? SubjectManager.getStreamAbbreviation(s.stream) : s.stream);
                }

                return streamAbbr ? `${s.level} / ${streamAbbr} / ${s.class}` : `${s.level} / ${s.class}`;
            })()}
                </td>
                <td style="font-weight:bold; color:red;">${item.streakDays} يوم</td>
                <td>${item.streakStartDate || '-'}</td>
                <td><span class="status-badge ${cls}">${item.actionLabel}</span></td>
                <td>
                    ${getActionButtons(item, index)}
                </td>
                <td class="history-log">
                    ${getHistoryLogHtml(studentLogs)}
                </td>
            </tr>
        `;
    }).join('');
}

function getActionButtons(item, index) {
    let buttonsHtml = '';

    // Notice 1 (>= 3 days)
    if (item.streakDays >= 3) {
        buttonsHtml += `<button class="action-btn btn-print" onclick="printDoc(${index}, 'notice1')">${IconManager.get('print')} إشعار 1</button>`;
    }

    // Notice 2 (>= 11 days)
    if (item.streakDays >= 11) {
        buttonsHtml += `<button class="action-btn btn-print" onclick="printDoc(${index}, 'notice2')">${IconManager.get('print')} إشعار 2</button>`;
    }

    // Warning (>= 18 days)
    if (item.streakDays >= 18) {
        buttonsHtml += `<button class="action-btn btn-print" style="background:#e67e22;" onclick="printDoc(${index}, 'warning')">${IconManager.get('warning')} إعذار</button>`;
    }

    // Strike-off (>= 33 days)
    if (item.streakDays >= 33) {
        buttonsHtml += `<button class="action-btn btn-print" style="background:#c0392b;" onclick="printDoc(${index}, 'strikeoff')">${IconManager.get('strikeoff')} شطب</button>`;
    }

    return buttonsHtml || '-';
}

// Print Document
async function printDoc(resultIndex, type) {
    const item = window.currentResults[resultIndex];

    if (!item) {
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'لم يتم العثور على بيانات التلميذ'
        });
        return;
    }

    const student = item.student;

    // Prompt for date
    const defaultDate = new Date().toLocaleDateString('ar-DZ');

    // Electron doesn't support native prompt(), use custom modal
    const userDate = await showDatePrompt(defaultDate);

    if (userDate === null) return; // Cancelled

    const finalDate = userDate || defaultDate;

    const content = getTemplate(type, student, item, finalDate);

    // Open in new window/tab
    const printWindow = window.open('', '_blank', 'width=1050,height=850');

    if (printWindow) {
        printWindow.document.write(content);
        printWindow.document.close();

        // Save Log
        const studentId = String(student.id || `${student.last_name}-${student.first_name}`);
        await saveCorrespondenceLog(studentId, type, finalDate);
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'يرجى السماح بالنوافذ المنبثقة (Popups) لعرض التقرير.'
        });
    }
}

/**
 * Save Correspondence Log
 */
async function saveCorrespondenceLog(studentId, type, date) {
    const timestamp = new Date().toISOString();
    const newEntry = {
        studentId: String(studentId),
        type,
        date,
        timestamp
    };

    correspondenceLogs.push(newEntry);
    await DB.set('correspondenceLogs', correspondenceLogs);

    const activeRows = document.querySelectorAll('#tableBody tr');
    if (activeRows.length > 0 && !activeRows[0].classList.contains('empty-state')) {
        filterTable();
    }
}

window.deleteCorrespondenceLog = async function(studentId, timestamp) {
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: 'سيتم حذف هذا السجل نهائياً.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#95a5a6',
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء',
        customClass: {
            confirmButton: 'action-btn',
            cancelButton: 'action-btn'
        }
    });

    if (result.isConfirmed) {
        correspondenceLogs = correspondenceLogs.filter(log => !(log.studentId === studentId && log.timestamp === timestamp));
        await DB.set('correspondenceLogs', correspondenceLogs);
        
        filterTable(); // re-render
        
        Swal.fire({
            icon: 'success',
            title: 'تم الحذف',
            showConfirmButton: false,
            timer: 1500
        });
    }
};

/**
 * Format History Log
 */
function getHistoryLogHtml(logs) {
    if (!logs || logs.length === 0) return '<span style="color:#bdc3c7; font-size:0.85em;">-</span>';

    const typeLabels = {
        'notice1': 'إشعار 1',
        'notice2': 'إشعار 2',
        'warning': 'إعذار',
        'strikeoff': 'شطب'
    };

    const logsHtml = logs.map(log => {
        const label = typeLabels[log.type] || log.type;
        return `<div style="margin-top:6px; margin-bottom:4px; border-bottom:1px solid #eee; padding-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <span style="font-weight:bold; font-size:0.85em; display:block; color:var(--primary-color);">${label}</span>
                <span style="color:#7f8c8d; font-size:0.75em;">${log.date}</span>
            </div>
            <button onclick="deleteCorrespondenceLog('${log.studentId}', '${log.timestamp}')" style="background:none; border:none; color:#e74c3c; cursor:pointer; padding:4px 8px; border-radius:4px; transition:background 0.2s;" onmouseover="this.style.background='rgba(231,76,60,0.1)'" onmouseout="this.style.background='none'" title="حذف السجل">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>`;
    }).join('');

    return `
        <details style="cursor:pointer; position:relative;">
            <summary style="list-style:none; display:inline-flex; align-items:center; gap:5px; background:var(--bg-color); border:1px solid #ddd; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:600; color:var(--primary-color); transition:all 0.2s;" onmouseover="this.style.borderColor='var(--secondary-color)'; this.style.color='var(--secondary-color)';" onmouseout="this.style.borderColor='#ddd'; this.style.color='var(--primary-color)';">
                <i class="fas fa-history"></i> السجل (${logs.length}) <i class="fas fa-chevron-down" style="font-size:0.7em;"></i>
            </summary>
            <div style="margin-top:8px; padding:8px; background:white; border:1px solid #eee; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.05); text-align:right;">
                ${logsHtml}
            </div>
        </details>
    `;
}

// Custom Prompt using SweetAlert2
function showDatePrompt(defaultValue) {
    return new Promise((resolve) => {
        Swal.fire({
            title: 'تاريخ المراسلة',
            input: 'text',
            inputValue: defaultValue,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-print"></i> طباعة',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: 'var(--secondary-color)',
            cancelButtonColor: '#e74c3c',
            customClass: {
                confirmButton: 'action-btn',
                cancelButton: 'action-btn'
            },
            inputValidator: (value) => {
                if (!value) {
                    return 'الرجاء إدخال التاريخ';
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                resolve(result.value);
            } else {
                resolve(null);
            }
        });
    });
}

function getTemplate(type, student, item, customDate) {
    const settings = window.appSettings || {};
    const date = customDate || new Date().toLocaleDateString('ar-DZ');

    const formatDob = (d) => {
        if (!d) return '................';
        return d;
    };

    let title = '';
    let subject = '';
    let body = '';

    const headerContent = `
        <div class="header-section">
            <div class="top-header">
                <h3 style="font-weight:normal; margin-bottom:5px;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>
                <h3 style="font-weight:normal; margin-top:0;">وزارة التربية الوطنية</h3>
            </div>
            <div class="sub-header">
                <div class="right-info">
                    <p>مديرية التربية لولاية: ${settings.wilaya || '........'}</p>
                    <p>المؤسسة: ${settings.institutionName || '........'}</p>
                </div>
                <div class="left-info">
                     <p>السنة الدراسية: ${settings.schoolYear || '2025/2026'}</p>
                </div>
            </div>
            <div class="ref-row">
                <div class="ref-info">
                    <p>الرقم .......... / ${new Date().getFullYear()}</p>
                </div>
                <div class="barcode">
                    <p class="barcode-label">رقم التعريف</p>
                    <span class="barcode-placeholder">100144404531200</span>
                </div>
            </div>
        </div>
    `;

    const parentName = student.father_name 
        ? `${student.father_name} ${student.last_name}` 
        : '................................................................';
        
    const addressStr = student.address 
        ? student.address 
        : '................................................................';

    const recipientSection = `
        <div class="recipient-section">
            <p><strong>إلى السيد(ة):</strong> ${parentName}</p>
            <p><strong>العنوان:</strong> ${addressStr}</p>
        </div>
    `;

    const dobDisplay = formatDob(student.birth_date);

    const formatLevel = (lvl) => {
        if (!lvl) return '';
        let s = String(lvl).trim();
        let year = '';
        if (s.match(/(أولى|الأولى|1)/)) year = '1';
        else if (s.match(/(ثانية|الثانية|2)/)) year = '2';
        else if (s.match(/(ثالثة|الثالثة|3)/)) year = '3';
        else if (s.match(/(رابعة|الرابعة|4)/)) year = '4';
        if (!year) return s;
        const stage = (window.appSettings && window.appSettings.educationStage === 'secondary') ? 'ثانوي' : 'متوسط';
        return `${year} ${stage}`;
    };
    const formatClassNum = (cls) => {
        if (cls === null || cls === undefined) return '';
        return String(cls).padStart(2, '0');
    };

    const formattedLevel = formatLevel(student.level);
    const formattedClass = formatClassNum(student.class);
    const streamName = student.stream ? SubjectManager.getStreamName(student.stream) : '';
    const isSecondary = (window.appSettings && window.appSettings.educationStage === 'secondary') || !!streamName;

    const classDisplay = isSecondary && streamName
        ? `${formattedLevel} <span style="font-size:0.9em">${streamName}</span> ${formattedClass}`
        : `${formattedLevel} ${formattedClass}`;

    const studentId = String(student.id || `${student.last_name}-${student.first_name}`);
    const studentLogs = correspondenceLogs.filter(log => log.studentId === studentId);
    
    const getLogDate = (logType) => {
        const logs = studentLogs.filter(l => l.type === logType).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        return logs.length > 0 ? logs[0].date : '..................';
    };

    const notice1Date = getLogDate('notice1');
    const notice2Date = getLogDate('notice2');
    const warningDate = getLogDate('warning');

    if (type === 'notice1') {
        title = 'الإشعار الأول بالغياب';
        subject = '<strong>الموضوع: الاشعار الأول بالغياب</strong>';
        body = `
            <div class="content-body">
                <p>بناءً على القرار الوزاري رقم: 833 والمؤرخ في: 1991/11/13 والمتعلق بمواٍبة التلاميذ في المؤسسات التعليمية ولاسيما المادة: 21 منه</p>
                <p>يؤسفني أن أنهي إلى علمكم بأن ابنكم: <strong>${student.last_name} ${student.first_name}</strong></p>
                <p>المولود بتاريخ: <strong>${dobDisplay}</strong> من القسم: <strong>${classDisplay}</strong></p>
                <p>قد تغيب<span style="font-weight:bold;"> عن الدراسة منذ: ${item.streakStartDate}</span> إلى غاية يومنا هذا.</p>
                <p>لذا نطلب منكم الحضور إلى المؤسسة لتبرير الغياب فور استلامكم هذا الإشعار.</p>
            </div>
        `;
    } else if (type === 'notice2') {
        title = 'الإشعار الثاني بالغياب';
        subject = '<strong>الموضوع: الإشعار الثاني بالغياب</strong>';
        body = `
            <div class="content-body">
                <p>المرجع: الإشعار الأول بالغياب بتاريخ: <strong>${notice1Date}</strong></p>
                <p>بناءً على القرار الوزاري رقم: 833 والمؤرخ في: 1991/11/13 والمتعلق بمواٍبة التلاميذ في المؤسسات التعليمية ولاسيما المادة: 21 منه ، و بناء على الاشعار الأول المشار إليه في المرجع أعلاه</p>
                <p>يؤسفني أن أنهي إلى علمكم بأن ابنكم: <strong>${student.last_name} ${student.first_name}</strong></p>
                <p>المولود بتاريخ: <strong>${dobDisplay}</strong> من القسم: <strong>${classDisplay}</strong></p>
                <p>قد تغيب<span style="font-weight:bold;"> عن الدراسة منذ: ${item.streakStartDate}</span> إلى غاية يومنا هذا.</p>
                <p>لذا نطلب منكم الحضور إلى المؤسسة لتبرير الغياب فور استلامكم هذا الإشعار.</p>
            </div>
        `;
    } else if (type === 'warning') {
        title = 'إعذار';
        subject = '<strong>الموضوع: إعذار</strong>';
        body = `
            <div class="content-body">
                <p>المرجع: الإشعار الأول بالغياب بتاريخ: <strong>${notice1Date}</strong></p>
                <p style="margin-right: 45px;">- الإشعار الثاني بالغياب بتاريخ: <strong>${notice2Date}</strong></p>
                <p>بناء على الاشعار الأول و الثاني المشار إليهما في المرجع أعلاه ، الرجاء منكم الحضور إلى المؤسسة لتبرير غياب ابنكم: <strong>${student.last_name} ${student.first_name}</strong></p>
                <p>المولود بتاريخ: <strong>${dobDisplay}</strong> من القسم: <strong>${classDisplay}</strong></p>
                <p>والذي تغيب<span style="font-weight:bold;"> عن الدراسة منذ: ${item.streakStartDate}</span> إلى غاية يومنا هذا.</p>
                <p>نحيطكم علما أن عدم الرد سيعرض ابنكم إلى الشطب نهائيا من قوائم التلاميذ بعد خمسة عشر (15) يوما إبتداء من تاريخ إرسال هذا الإعذار.</p>
            </div>
        `;
    } else if (type === 'strikeoff') {
        title = 'قرار الشطب';
        subject = '<strong>الموضوع: الشطب من القائمة الإسمية</strong>';
        body = `
            <div class="content-body">
                <p>بناءً على القرار الوزاري رقم: 833 والمؤرخ في: 1991/11/13 والمتعلق بمواٍبة التلاميذ في المؤسسات التعليمية ولاسيما المادة: 21 منه ، وبعد المراسلات التالية:</p>
                <p>1- الإشعار الأول بتاريخ: <strong>${notice1Date}</strong></p>
                <p>2- الإشعار الثاني بتاريخ: <strong>${notice2Date}</strong></p>
                <p>3- الإعذار بتاريخ: <strong>${warningDate}</strong></p>
                <p>ونٍرا لانقطاع ابنكم: <strong>${student.last_name} ${student.first_name}</strong> المولود بتاريخ: <strong>${dobDisplay}</strong></p>
                <p>من القسم: <strong>${classDisplay}</strong> عن الدراسة ولعدم استجابتكم لكل هذه المراسلات</p>
                <p>فإنه تم شطب ابنكم من قوائم المؤسسة ابتداء من تاريخ هذه المراسلة.</p>
            </div>
        `;
    }

    const signature = `
        <div class="signature-section" style="display: flex; flex-direction: column; align-items: flex-end; padding-left: 20px;">
             <div>حرر في: ${settings.municipality || '........'} بتاريخ: ${date}</div>
             <div class="manager-title" style="margin-top: 5px;">مدير(ة) المؤسسة</div>
        </div>
    `;

    return `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                @font-face {
                    font-family: 'Tajawal';
                    src: url('assets/fonts/Tajawal-Regular.ttf') format('truetype');
                }
                body {
                    font-family: 'Tajawal', 'Scheherazade New', 'Amiri', 'Traditional Arabic', serif;
                    padding: 15px;
                    margin: 0;
                    direction: rtl;
                    font-size: 16pt;
                    line-height: 1.8;
                }
                @page { margin: 1cm; size: A4 portrait; }
                .header-section { text-align: center; margin-bottom: 15px; }
                .top-header { text-align: center; }
                .top-header h3 { margin: 3px 0; font-size: 14pt; }
                .sub-header { display: flex; justify-content: space-between; margin-top: 10px; padding: 0; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
                .sub-header p { margin: 2px 0; font-size: 12pt; }
                .right-info { text-align: right; }
                .left-info { text-align: left; }
                .ref-row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding: 5px 0; }
                .barcode { text-align: left; }
                .barcode-label { font-size: 9pt; margin: 0 0 2px 0; color: #666; }
                .barcode-placeholder { font-size: 10pt; letter-spacing: 1px; }
                .ref-info { text-align: right; }
                .ref-info p { margin: 0; font-size: 12pt; }
                .recipient-section { margin: 15px 0; font-size: 15pt; padding-right: 20px; }
                .recipient-section p { margin: 5px 0; }
                h2 { text-decoration: underline; margin-bottom: 15px; font-size: 15pt; margin-top: 10px; text-align: center; }
                .content-body { padding: 0 20px; }
                .content-body p { line-height: 1.8; margin-bottom: 10px; text-align: justify; font-size: 16pt; }
                .underline { text-decoration: underline; }
                .blue-text { color: #0066cc; }
                .signature-section { margin-top: 30px; width: 100%; }
                .sig-row { display: flex; justify-content: space-between; align-items: baseline; padding: 0 20px; }
                .sig-name { text-align: left; margin-top: 10px; padding-left: 20px; }
                .manager-title { text-decoration: underline; }
                @media print {
                    button { display: none; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}
            ${headerContent}
            ${recipientSection}
            <h2 style="text-align:center;">${subject}</h2>
            ${body}
            ${signature}
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
        </body>
        </html>
    `;
}
