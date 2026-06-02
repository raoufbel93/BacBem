// Initializing logic
let selectedFiles = [];
let selectedHtmFiles = [];
let fileInfos = [];
let processedData = [];

// Defaults to exempt
const DEFAULT_EXEMPTABLE_SUBJECTS = [
    'التربية التشكيلية', 'المعلوماتية', 'التربية الموسيقية', 'اللغة الأمازيغية',
    'ت البدنية و الرياضية',
    // Short name variants that may appear in Excel files
    'ت.تشكيلية', 'اعلام آلي', 'موسيقى', 'أمازيغية', 'رياضة', 'معلوماتية'
];
let storedExemptions = {}; // { level: ['sub1', 'sub2'] }

// Hardcoded 14 middle school subjects (as confirmed)
const MIDDLE_SCHOOL_SUBJECTS = [
    'اللغة العربية', 'اللغة الأمازيغية', 'اللغة الفرنسية', 'اللغة الإنجليزية',
    'التربية الإسلامية', 'التربية المدنية', 'التاريخ والجغرافيا',
    'الرياضيات', 'ع الطبيعة و الحياة', 'ع الفيزيائية والتكنولوجيا',
    'المعلوماتية', 'التربية التشكيلية', 'التربية الموسيقية', 'ت البدنية و الرياضية'
];

// Exam coefficients per level (1=أولى, 2=ثانية, 3=ثالثة, 4=رابعة)

function normalizeArabicValue(str) {
    if (!str) return '';
    return str.toString()
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ﻷ|ﻹ|ﻵ|ﻻ/g, 'لا')
        .replace(/لأ|لإ|لآ/g, 'لا')
        .replace(/\s+/g, ' ');
}

function normalizeActivityAcademicYear(value) {
    const text = String(value || '').trim().replace(/-/g, '/');
    const years = text.match(/\d{4}/g);
    if (years && years.length >= 2) {
        return years.slice(0, 2).sort().join('/');
    }
    return text.replace(/\s+/g, '');
}

function activityAcademicYearMatches(value, selectedYear) {
    if (!selectedYear) return true;
    return normalizeActivityAcademicYear(value) === normalizeActivityAcademicYear(selectedYear);
}

function getActivityTrimesterCode(value) {
    const text = normalizeArabicValue(value || '').replace(/\s+/g, ' ');
    if (!text) return '';
    if (text.includes('الثالث') || /\b3\b/.test(text)) return '3';
    if (text.includes('الثاني') || /\b2\b/.test(text)) return '2';
    if (text.includes('الاول') || text.includes('الأول') || /\b1\b/.test(text)) return '1';
    return text;
}

function activityTrimesterMatches(value, selectedTrimester) {
    if (!selectedTrimester) return true;
    return getActivityTrimesterCode(value) === getActivityTrimesterCode(selectedTrimester);
}

function getActivityLevelCode(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    if (/^[1-4]$/.test(raw)) return raw;

    const text = raw
        .normalize('NFKC')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي');

    if (text.includes('اولي') || text.includes('الاولى') || text.includes('الاولي') || text.includes('ط£ظˆظ„') || text.includes('ط§ظ„ط£ظˆظ„')) return '1';
    if (text.includes('ثانيه') || text.includes('الثانيه') || text.includes('ثانية') || text.includes('الثانية') || text.includes('ط«ط§ظ†ظٹ')) return '2';
    if (text.includes('ثالثه') || text.includes('الثالثه') || text.includes('ثالثة') || text.includes('الثالثة') || text.includes('ط«ط§ظ„ط«')) return '3';
    if (text.includes('رابعه') || text.includes('الرابعه') || text.includes('رابعة') || text.includes('الرابعة') || text.includes('ط±ط§ط¨ط¹')) return '4';

    const digit = text.match(/[1-4]/);
    return digit ? digit[0] : '';
}

function activityLevelMatches(value, selectedLevel) {
    if (!selectedLevel || selectedLevel === 'all') return true;
    return getActivityLevelCode(value) === getActivityLevelCode(selectedLevel);
}

function getActivityLevelName(value) {
    const code = getActivityLevelCode(value);
    if (code === '1') return 'الأولى';
    if (code === '2') return 'الثانية';
    if (code === '3') return 'الثالثة';
    if (code === '4') return 'الرابعة';
    return value || '';
}

function sortActivityLevelCodes(a, b) {
    return (parseInt(getActivityLevelCode(a), 10) || 0) - (parseInt(getActivityLevelCode(b), 10) || 0);
}

function setSelectValueEnsuringOption(selectId, value) {
    const selector = document.getElementById(selectId);
    if (!selector || !value) return;
    if (!Array.from(selector.options).some(option => option.value === value)) {
        selector.add(new Option(value, value));
    }
    selector.value = value;
}

async function clearActivityEvaluationsForPeriod(academicYear, trimester) {
    const existing = await DB.getActivityEvaluations({}) || [];
    const periods = new Map();

    existing.forEach(record => {
        if (
            activityAcademicYearMatches(record.academic_year, academicYear) &&
            activityTrimesterMatches(record.trimester, trimester)
        ) {
            periods.set(`${record.academic_year}|${record.trimester}`, {
                academicYear: record.academic_year,
                trimester: record.trimester
            });
        }
    });

    if (periods.size === 0) {
        await DB.clearActivityEvaluations({ academicYear, trimester });
        return;
    }

    for (const period of periods.values()) {
        await DB.clearActivityEvaluations(period);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Check education stage
    const settings = await DB.getSettings();
    if (settings.educationStage === 'secondary') {
        Swal.fire({
            title: 'تنبيه',
            text: 'ميزة تحليل تقويم النشاطات متوفرة حالياً للطور المتوسط فقط، وسيتم إضافتها للطور الثانوي قريباً إن شاء الله.',
            icon: 'info',
            confirmButtonText: 'حسناً',
            confirmButtonColor: 'var(--secondary-color)'
        });

        // Disable import buttons
        const btnExcel = document.getElementById('btnImportExcel');
        const btnHtml = document.getElementById('btnImportHtml');
        if (btnExcel) {
            btnExcel.disabled = true;
            btnExcel.style.opacity = '0.5';
            btnExcel.style.cursor = 'not-allowed';
            btnExcel.title = 'غير متوفر في الطور الثانوي حالياً';
        }
        if (btnHtml) {
            btnHtml.disabled = true;
            btnHtml.style.opacity = '0.5';
            btnHtml.style.cursor = 'not-allowed';
            btnHtml.title = 'غير متوفر في الطور الثانوي حالياً';
        }
    }

    // Load exemptions
    storedExemptions = await DB.get('activityEvaluationExemptions') || {};
    renderExemptionsUI();

    // Populate Year Dropdowns
    const currentYear = settings.currentAcademicYear || DB.getCurrentAcademicYear();
    
    // Get all unique years from DB
    const allData = await DB.getActivityEvaluations({}) || [];
    let allYears = Array.from(new Set(allData.map(d => d.academic_year)));
    if (!allYears.includes(currentYear)) allYears.push(currentYear);
    allYears.sort((a, b) => b.localeCompare(a)); // Newest first

    // User requested "Select Year" as default
    populateYearDropdowns(allYears, "");

    // Initial load
    await loadAndDisplayOverview();

    // Year selection listeners to sync and re-render everything
    const refreshAll = async (val) => {
        document.getElementById('importYearSelect').value = val;
        document.getElementById('analysisYearSelect').value = val;
        document.getElementById('examavgYearSelect').value = val;
        
        await loadAndDisplayOverview();
        if (typeof renderAnalysis === 'function') renderAnalysis();
        if (typeof renderExamAverage === 'function') renderExamAverage();
    };

    document.getElementById('importYearSelect').addEventListener('change', (e) => refreshAll(e.target.value));
    document.getElementById('analysisYearSelect').addEventListener('change', (e) => refreshAll(e.target.value));
    document.getElementById('examavgYearSelect').addEventListener('change', (e) => refreshAll(e.target.value));

    // Also sync and refresh on trimester change for the other tabs
    document.getElementById('analysisTrimesterSelect').addEventListener('change', renderAnalysis);
    document.getElementById('examavgTrimesterSelect').addEventListener('change', renderExamAverage);
});

function populateYearDropdowns(years, selected) {
    const selects = ['importYearSelect', 'analysisYearSelect', 'examavgYearSelect'];
    selects.forEach(id => {
        const selector = document.getElementById(id);
        if (!selector) return;
        
        let html = '<option value="">اختر السنة</option>';
        years.forEach(y => {
            let display = y;
            let parts = y.split(/[\/\-]/);
            if (parts.length === 2) {
                let y1 = parseInt(parts[0]);
                let y2 = parseInt(parts[1]);
                let small = Math.min(y1, y2);
                let large = Math.max(y1, y2);
                // In RTL context, we want small on right, large on left.
                // Using \u200F (Right-to-Left Mark) ensures the spaces and hyphen take RTL direction.
                display = `\u200F${small} - ${large}\u200F`;
            }
            html += `<option value="${y}" ${y === selected ? 'selected' : ''}>${display}</option>`;
        });
        selector.innerHTML = html;
    });
}

function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    selectedFiles = Array.from(files);
    log(`تم اختيار ${selectedFiles.length} ملف Excel.`);

    const actions = document.getElementById('importActions');
    if (actions) actions.style.display = 'flex';

    document.getElementById('statusBox').style.display = 'none';
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressBar').style.display = 'none';
}

function handleHtmFileSelect(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    selectedHtmFiles = Array.from(files);
    log(`تم اختيار ${selectedHtmFiles.length} ملف HTM.`);

    const actions = document.getElementById('importActions');
    if (actions) actions.style.display = 'flex';

    document.getElementById('statusBox').style.display = 'none';
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressBar').style.display = 'none';
}

async function processFiles(mode = 'update') {
    let confirmTitle = "تحديث البيانات";
    let confirmMsg = "هل أنت متأكد من رغبتك في تحديث قاعدة البيانات بالملفات المختارة؟";
    if (mode === 'replace') {
        confirmTitle = "حذف واستبدال الكل";
        confirmMsg = "تحذير: هذا الإجراء سيقوم بمسح كلي لكافة تقويمات النشاطات المحفوظة مسبقاً (للفصل المحدد) واستبدالها بهذه الملفات.";
    }

    const modalConfirmBtn = document.getElementById('modalConfirm');
    document.getElementById('confirmTitle').innerText = confirmTitle;
    document.getElementById('confirmMsg').innerHTML = confirmMsg;
    document.getElementById('confirmModal').classList.add('active');

    return new Promise((resolve) => {
        modalConfirmBtn.onclick = async () => {
            closeModal('confirmModal');
            await doImport(mode);
            resolve();
        };
    });
}

function normalizeLevelNumber(levelStr) {
    if (!levelStr) return '1';
    const s = levelStr.toString();
    // Check Arabic words FIRST - these are more reliable than digits
    // because the digit in the text is the section number, not the level
    if (s.includes('أولى') || s.includes('الأولى')) return '1';
    if (s.includes('ثانية') || s.includes('الثانية')) return '2';
    if (s.includes('ثالثة') || s.includes('الثالثة')) return '3';
    if (s.includes('رابعة') || s.includes('الرابعة')) return '4';
    // Only fall back to digits if no Arabic word found
    if (s.includes('4')) return '4';
    if (s.includes('3')) return '3';
    if (s.includes('2')) return '2';
    if (s.includes('1')) return '1';
    return '1';
}

function normalizeStage(stageStr) {
    if (!stageStr) return 'middle';
    if (stageStr.includes('ثانوي')) return 'secondary';
    return 'middle';
}

async function doImport(mode) {
    const btnReplace = document.getElementById('btnReplace');
    const btnUpdate = document.getElementById('btnUpdate');

    // We will auto-detect trimester and academic year from files
    let detectedTrimester = null;
    let detectedAcademicYear = null;

    if (btnReplace) btnReplace.disabled = true;
    if (btnUpdate) btnUpdate.disabled = true;

    document.getElementById('progressBar').style.display = 'block';
    log("بدء قراءة الملفات...");

    fileInfos = [];
    processedData = [];

    let validCount = 0;
    const totalFiles = selectedFiles.length + selectedHtmFiles.length;

    // ====== PROCESS EXCEL FILES ======
    for (let i = 0; i < selectedFiles.length; i++) {
        updateProgress((i + 1) / totalFiles * 30);
        const file = selectedFiles[i];

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

            // Loop over all sheets as one file might have multiple classes (sheets)
            workbook.SheetNames.forEach(sheetName => {
                if (sheetName.toLowerCase() === 'worksheet') return;
                const sheet = workbook.Sheets[sheetName];

                // Read context from Row 5 (index 4)
                let contextText = "";
                for(let c = 0; c < 15; c++) {
                    const cellAddr = XLSX.utils.encode_cell({r: 4, c: c});
                    if (sheet[cellAddr] && sheet[cellAddr].v) {
                        contextText += sheet[cellAddr].v + " ";
                    }
                }

                if (!contextText.includes("الفوج")) {
                    // Fallback to searching first 8 rows
                    for (let r = 0; r < 8; r++) {
                        const row = XLSX.utils.sheet_to_json(sheet, { header: 1, range: r, limit: 1 })[0] || [];
                        const rowText = row.join(" ");
                        if (rowText.includes("الفوج") || rowText.includes("مادة")) {
                            contextText += " " + rowText;
                        }
                    }
                }

                if (!contextText.includes("مادة") && !contextText.includes("الفوج")) {
                    log(`تخطي ورقة لا تحتوي على ترويسة صحيحة: ${sheetName}`, 'error');
                    return;
                }

                // Extract Trimester
                const trimMatch = contextText.match(/الفصل\s*[:\-]?\s*(الأول|الاول|الثاني|الثالث)/);
                if (trimMatch) {
                    let foundTrimester = trimMatch[1].trim();
                    if (foundTrimester === 'الاول') foundTrimester = 'الأول';
                    if (!detectedTrimester) {
                        detectedTrimester = foundTrimester;
                    } else if (detectedTrimester !== foundTrimester) {
                        throw new Error(`TRIMESTER_MISMATCH|وجدنا ملفات من الفصل '${detectedTrimester}' وملفات من الفصل '${foundTrimester}'. يرجى استيراد ملفات فصل واحد فقط في كل مرة.`);
                    }
                } else {
                    log(`لم يتم العثور على الفصل في الورقة ${sheetName}، سيتم استخدام الفصل الحالي المكتشف إن وجد.`, 'warn');
                }

                // Extract Academic Year
                const yearMatch = contextText.match(/السنة الدراسية\s*[:\-]?\s*(\d{4}[\-\/]\d{4})/);
                if (yearMatch) {
                    let foundYear = yearMatch[1].trim().replace('/', '-');
                    if (!detectedAcademicYear) {
                        detectedAcademicYear = foundYear;
                    } else if (detectedAcademicYear !== foundYear) {
                        throw new Error(`YEAR_MISMATCH|وجدنا ملفات من السنة الدراسية '${detectedAcademicYear}' وملفات من السنة الدراسية '${foundYear}'. يرجى استيراد ملفات سنة واحدة فقط.`);
                    }
                }

                // Extract Subject
                let subject = "";
                const subjMatch = contextText.match(/مادة\s*:\s*(.+)$/i);
                if (subjMatch) {
                    subject = subjMatch[1].replace(/  +|\t/g, ' ').trim();
                } else {
                    // Fallback splitting
                    const parts = contextText.split("مادة");
                    if (parts.length > 1) {
                        subject = parts[1].replace(':', '').trim().split(/\s{2,}/)[0];
                    }
                }

                // Extract Level and Class
                let levelStr = "";
                let section = "";
                // e.g. "الفوج التربوي : رابعة متوسط 2"
                const classMatch = contextText.match(/الفوج التربوي\s*:\s*(.+?)(?=\s*مادة|$)/i);

                let classText = "";
                if (classMatch) {
                    classText = classMatch[1].trim();
                } else {
                    const parts2 = contextText.split("الفوج التربوي");
                    if (parts2.length > 1) {
                        classText = parts2[1].split("مادة")[0].replace(':', '').trim();
                    }
                }

                // Parse classText like "رابعة متوسط 2"
                levelStr = normalizeLevelNumber(classText);
                const stage = normalizeStage(classText);

                // For class text "رابعة متوسط 2", we extract "2"
                const sectionMatch = classText.match(/\d+/);
                if (sectionMatch) {
                    section = sectionMatch[0];
                } else {
                    section = "1";
                }

                // Find Headers (Row 8 Usually)
                let headerRowIndex = -1;
                for (let r = 5; r < 12; r++) {
                    const row = XLSX.utils.sheet_to_json(sheet, { header: 1, range: r, limit: 1 })[0];
                    if (row && row.some(c => c && (c.toString().includes("اللقب") || c.toString().includes("رقم التعريف")))) {
                        headerRowIndex = r;
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    log(`لم يتم العثور على جدول النقاط في الورقة ${sheetName}`, 'error');
                    return;
                }

                const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1, range: headerRowIndex, limit: 1 })[0];

                // Find column index for target marks
                let evalIndex = -1;
                let testIndex = -1;
                let assignmentIndex = -1;

                headerRow.forEach((h, idx) => {
                    if (!h) return;
                    const txt = h.toString().trim();
                    if (txt.includes("معدل تقويم") || txt.includes("تقويم النشاطات")) evalIndex = idx;
                    if (txt.includes("الفرض")) assignmentIndex = idx;
                    if (txt.includes("الإختبار") || txt.includes("الاختبار")) testIndex = idx;
                });

                if (evalIndex === -1 && testIndex === -1 && assignmentIndex === -1) {
                    log(`لم يتم العثور على أعمدة النقاط (تقويم، فرض، اختبار) في الورقة ${sheetName}`, 'error');
                    return;
                }

                // Read students
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: headerRowIndex + 1 });
                const studentRows = rows.filter(r => r[0] && (typeof r[0] === 'number' || !isNaN(r[0]) || r[0].toString().length > 5));

                log(`[تصحيح] ورقة: ${sheetName} | النص: ${contextText.trim()}`);
                log(`[تصحيح] الفوج: "${classText}" → المستوى: ${levelStr}, القسم: ${section}, المادة: ${subject}`);

                if (studentRows.length > 0) {
                    fileInfos.push({
                        fileName: file.name,
                        sheetName: sheetName,
                         academicYear: detectedAcademicYear || '',
                        trimester: detectedTrimester || '', // Let the selected trimester apply when the file has no trimester.
                        stage: stage,
                        level: levelStr,
                        section: section,
                        subject: subject,
                        evalIndex: evalIndex,
                        testIndex: testIndex,
                        assignmentIndex: assignmentIndex,
                        students: studentRows.map(r => ({
                            id: r[0],
                            lastName: r[1],
                            firstName: r[2],
                            evalMark: evalIndex !== -1 ? parseMark(r[evalIndex]) : null,
                            assignmentMark: assignmentIndex !== -1 ? parseMark(r[assignmentIndex]) : null,
                            testMark: testIndex !== -1 ? parseMark(r[testIndex]) : null
                        }))
                    });
                    validCount++;
                }
            });

        } catch (error) {
            if (error.message.startsWith('TRIMESTER_MISMATCH|') || error.message.startsWith('YEAR_MISMATCH|')) {
                const msg = error.message.split('|')[1];
                log(msg, 'error');
                showStatus(msg, 'error');
                validCount = 0; // Abort saving completely
                break; // Stop processing other files
            } else {
                log(`خطأ في قراءة الملف ${file.name}: ${error.message}`, 'error');
            }
        }
    }

    // ====== PROCESS HTM FILES ======
    for (let i = 0; i < selectedHtmFiles.length; i++) {
        updateProgress(((selectedFiles.length + i + 1) / totalFiles) * 30);
        const file = selectedHtmFiles[i];

        try {
            const text = await file.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            // Each class section is separated by page-break divs
            // Strategy: find all tables with border="1" (data tables) and their preceding header tables
            const allTables = doc.querySelectorAll('table[border="1"]');

            if (allTables.length === 0) {
                log(`لم يتم العثور على جداول بيانات في ملف HTM: ${file.name}`, 'error');
                continue;
            }

            log(`[HTM] وجدنا ${allTables.length} جدول بيانات في ${file.name}`);

            allTables.forEach((dataTable, tableIdx) => {
                try {
                    // Find the header text - look for the preceding non-bordered table
                    let headerText = '';
                    let prevSibling = dataTable.previousElementSibling;
                    while (prevSibling) {
                        if (prevSibling.tagName === 'TABLE' && !prevSibling.getAttribute('border')) {
                            headerText = prevSibling.textContent;
                            break;
                        }
                        prevSibling = prevSibling.previousElementSibling;
                    }

                    if (!headerText.includes('وثيقة المراقبة') && !headerText.includes('لمادة')) {
                        log(`[HTM] تخطي جدول ${tableIdx + 1}: لا يحتوي على ترويسة وثيقة المراقبة`, 'warn');
                        return;
                    }

                    // Extract: "وثيقة المراقبة لقسم : ثانية متوسط 4 ، لمادة : المعلوماتية ، الفصل الأول"
                    // Trimester
                    const trimMatch = headerText.match(/الفصل\s*(الأول|الاول|الثاني|الثالث)/);
                    if (trimMatch) {
                        let foundTrimester = trimMatch[1].trim();
                        if (foundTrimester === 'الاول') foundTrimester = 'الأول';
                        if (!detectedTrimester) {
                            detectedTrimester = foundTrimester;
                        } else if (detectedTrimester !== foundTrimester) {
                            throw new Error(`TRIMESTER_MISMATCH|وجدنا ملفات من الفصل '${detectedTrimester}' وملفات من الفصل '${foundTrimester}'. يرجى استيراد ملفات فصل واحد فقط في كل مرة.`);
                        }
                    }

                    // Academic Year
                    const yearMatch = headerText.match(/السنة الدراسية\s*[:\-]?\s*(\d{4}[\-\/]\d{4})/);
                    if (yearMatch) {
                        let foundYear = yearMatch[1].trim().replace('/', '-');
                        if (!detectedAcademicYear) {
                            detectedAcademicYear = foundYear;
                        } else if (detectedAcademicYear !== foundYear) {
                            throw new Error(`YEAR_MISMATCH|وجدنا ملفات من السنة الدراسية '${detectedAcademicYear}' وملفات من السنة الدراسية '${foundYear}'. يرجى استيراد ملفات سنة واحدة فقط.`);
                        }
                    }

                    // Subject: "لمادة : المعلوماتية"
                    let subject = '';
                    const subjMatch = headerText.match(/لمادة\s*:\s*([^،,]+)/);
                    if (subjMatch) {
                        subject = subjMatch[1].trim();
                    }

                    // Class: "لقسم : ثانية متوسط 4"
                    let classText = '';
                    const classMatch = headerText.match(/لقسم\s*:\s*([^،,]+)/);
                    if (classMatch) {
                        classText = classMatch[1].trim();
                    }

                    const levelStr = normalizeLevelNumber(classText);
                    const stage = normalizeStage(classText);

                    // Extract section number - last number in classText
                    let section = '1';
                    const sectionNumbers = classText.match(/\d+/g);
                    if (sectionNumbers && sectionNumbers.length > 0) {
                        section = sectionNumbers[sectionNumbers.length - 1];
                    }

                    // Parse table headers
                    const headerRow = dataTable.querySelector('tr');
                    if (!headerRow) return;

                    const headers = Array.from(headerRow.querySelectorAll('th, td')).map(th => th.textContent.trim());

                    let evalIndex = -1;
                    let assignmentIndex = -1;
                    let testIndex = -1;

                    headers.forEach((h, idx) => {
                        if (h.includes('معدل تقويم') || h.includes('تقويم النشاطات')) evalIndex = idx;
                        if (h.includes('الفرض')) assignmentIndex = idx;
                        if (h.includes('الإختبار') || h.includes('الاختبار')) testIndex = idx;
                    });

                    if (evalIndex === -1 && testIndex === -1 && assignmentIndex === -1) {
                        log(`[HTM] لم يتم العثور على أعمدة النقاط في الجدول ${tableIdx + 1}`, 'error');
                        return;
                    }

                    // Parse student rows (skip header)
                    const rows = Array.from(dataTable.querySelectorAll('tr')).slice(1);
                    const students = [];

                    rows.forEach(row => {
                        const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
                        if (cells.length < 3) return;

                        const id = cells[0];
                        // Filter: must look like a student ID (long number)
                        if (!id || id.length < 5 || !/\d{5,}/.test(id)) return;

                        students.push({
                            id: id,
                            lastName: cells[1] || '',
                            firstName: cells[2] || '',
                            evalMark: evalIndex !== -1 ? parseMark(cells[evalIndex]) : null,
                            assignmentMark: assignmentIndex !== -1 ? parseMark(cells[assignmentIndex]) : null,
                            testMark: testIndex !== -1 ? parseMark(cells[testIndex]) : null
                        });
                    });

                    log(`[HTM] جدول ${tableIdx + 1}: المستوى ${levelStr}, القسم ${section}, المادة: ${subject}, ${students.length} تلميذ`);

                    if (students.length > 0) {
                        fileInfos.push({
                            fileName: file.name,
                            sheetName: `HTM-قسم${section}`,
                            academicYear: detectedAcademicYear || '',
                            trimester: detectedTrimester || '',
                            stage: stage,
                            level: levelStr,
                            section: section,
                            subject: subject,
                            evalIndex: evalIndex,
                            testIndex: testIndex,
                            assignmentIndex: assignmentIndex,
                            students: students
                        });
                        validCount++;
                    }
                } catch (innerErr) {
                    if (innerErr.message.startsWith('TRIMESTER_MISMATCH|')) throw innerErr;
                    log(`[HTM] خطأ في معالجة الجدول ${tableIdx + 1}: ${innerErr.message}`, 'error');
                }
            });

        } catch (error) {
            if (error.message.startsWith('TRIMESTER_MISMATCH|') || error.message.startsWith('YEAR_MISMATCH|')) {
                const msg = error.message.split('|')[1];
                log(msg, 'error');
                showStatus(msg, 'error');
                validCount = 0;
                break;
            } else {
                log(`[HTM] خطأ في قراءة الملف ${file.name}: ${error.message}`, 'error');
            }
        }
    }

    if (validCount === 0) {
        showStatus("لم يتم العثور على بيانات صالحة.", 'error');
        if (btnReplace) btnReplace.disabled = false;
        if (btnUpdate) btnUpdate.disabled = false;
        document.getElementById('progressBar').style.display = 'none';
        return;
    }

    // Save to Relational DB
    const importYearSelect = document.getElementById('importYearSelect');
    const selectedYear = importYearSelect ? importYearSelect.value : null;

    const settings = await DB.getSettings();
    const targetAcademicYear = selectedYear || settings.currentAcademicYear || DB.getCurrentAcademicYear();
    const effectiveTrimester = detectedTrimester || document.getElementById('importTrimesterSelect')?.value || 'الثاني';
    if (detectedAcademicYear && targetAcademicYear && !activityAcademicYearMatches(detectedAcademicYear, targetAcademicYear)) {
        const message = `سنة الملف (${detectedAcademicYear}) لا توافق السنة الحالية المحددة (${targetAcademicYear}). يرجى اختيار ملفات السنة الحالية فقط.`;
        showStatus(message, 'error');
        log(message, 'error');
        if (btnReplace) btnReplace.disabled = false;
        if (btnUpdate) btnUpdate.disabled = false;
        document.getElementById('progressBar').style.display = 'none';
        return;
    }
    const finalYear = targetAcademicYear;

    // Flatten the data for sqlite insertion
    let flatRecords = [];
    fileInfos.forEach(info => {
        if (info.students && Array.isArray(info.students)) {
            info.students.forEach(st => {
                flatRecords.push({
                    student_id: st.id,
                    student_name: ((st.lastName || '') + ' ' + (st.firstName || '')).trim(),
                    academic_year: finalYear,
                    trimester: info.trimester || effectiveTrimester,
                    level: info.level,
                    class_number: info.section,
                    subject: info.subject,
                    eval_mark: st.evalMark,
                    assignment_mark: st.assignmentMark,
                    test_mark: st.testMark
                });
            });
        }
    });

    let finalRecordsToSave = flatRecords;
    if (mode === 'update') {
        const existingData = await DB.getActivityEvaluations({}) || [];
        const map = new Map();
        
        // Add existing records first
        existingData.forEach(d => {
            if (!activityAcademicYearMatches(d.academic_year, finalYear) || !activityTrimesterMatches(d.trimester, effectiveTrimester)) return;
            const key = d.student_id + '_' + d.subject;
            map.set(key, { ...d, academic_year: finalYear, trimester: effectiveTrimester });
        });
        
        // Override with new imported records
        flatRecords.forEach(r => {
            const key = r.student_id + '_' + r.subject;
            map.set(key, r);
        });

        finalRecordsToSave = Array.from(map.values());
    }

    // Always clear target explicitly (fixes duplicate insertions and replace logic cross-db)
    await clearActivityEvaluationsForPeriod(finalYear, effectiveTrimester);
    
    // Save the uniquely merged data 
    await DB.saveActivityEvaluations(finalRecordsToSave);

    // [New] Trigger automatic average calculation for all impacted groups
    try {
        const impactedGroups = new Set();
        finalRecordsToSave.forEach(r => {
            if (r.academic_year && r.trimester && r.level && r.class_number) {
                impactedGroups.add(`${r.academic_year}|${r.trimester}|${r.level}|${r.class_number}`);
            }
        });

        for (const groupKey of impactedGroups) {
            const parts = groupKey.split('|');
            console.log(`[Auto-Avg] Requesting calculation for: ${groupKey}`);
            await DB.computeAndSaveActivityAverages(parts[0], parts[1], parts[2], parts[3]);
        }
    } catch (e) {
        console.error('[Auto-Avg] Error during automatic calculation:', e);
    }

    // Update UI Trimester and Year Selects to match what was imported
    setSelectValueEnsuringOption('importTrimesterSelect', effectiveTrimester);
    setSelectValueEnsuringOption('analysisTrimesterSelect', effectiveTrimester);
    setSelectValueEnsuringOption('examavgTrimesterSelect', effectiveTrimester);
    if (finalYear) {
        const y1 = document.getElementById('importYearSelect');
        const options = y1 ? Array.from(y1.options).map(o => o.value) : [];
        if (!options.includes(finalYear)) {
            // If the imported year isn't in the dropdown yet, refresh the dropdowns from DB
            const allEvals = await DB.getActivityEvaluations({}) || [];
            let allYears = Array.from(new Set(allEvals.map(d => d.academic_year)));
            if (!allYears.includes(finalYear)) allYears.push(finalYear);
            allYears.sort((a, b) => b.localeCompare(a));
            populateYearDropdowns(allYears, finalYear);
        } else {
            setSelectValueEnsuringOption('importYearSelect', finalYear);
            setSelectValueEnsuringOption('analysisYearSelect', finalYear);
            setSelectValueEnsuringOption('examavgYearSelect', finalYear);
        }
    }

    updateProgress(100);
    document.getElementById('successMessage').innerText = `الأقسام التي تم استيرادها: ${validCount} قسم بنجاح في الفصل ${effectiveTrimester}.`;
    document.getElementById('successModal').classList.add('active');

    if (btnReplace) btnReplace.disabled = false;
    if (btnUpdate) btnUpdate.disabled = false;

    // Reset file selections
    selectedFiles = [];
    selectedHtmFiles = [];
    const fileInput = document.getElementById('fileInput');
    const htmFileInput = document.getElementById('htmFileInput');
    if (fileInput) fileInput.value = '';
    if (htmFileInput) htmFileInput.value = '';

    await loadAndDisplayOverview();
}

function parseMark(v) {
    if (typeof v === 'number') return v;
    if (!v) return null;
    const strVal = v.toString().trim();
    if (strVal === 'غ م' || strVal === 'غم' || strVal === 'غ' || strVal.includes('غ')) return 0;
    const p = parseFloat(strVal.replace(',', '.'));
    return isNaN(p) ? null : p;
}

function updateProgress(percent) {
    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = percent + '%';
}

function showStatus(msg, type) {
    const box = document.getElementById('statusBox');
    if (box) {
        box.textContent = msg;
        box.className = `status-box ${type}`;
        box.style.display = 'block';
    }
    log(msg, type);
}

function log(msg, type = 'info') {
    const area = document.getElementById('logArea');
    if (!area) return;
    const p = document.createElement('div');
    p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    if (type === 'error') p.style.color = 'red';
    area.appendChild(p);
    area.scrollTop = area.scrollHeight;
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

async function closeExemptionsAndRecalculate() {
    closeModal('exemptionsModal');
    
    // We need to re-run calculation for all classes in the current trimester/year.
    const settings = await DB.getSettings();
    const importYearSelect = document.getElementById('importYearSelect');
    const finalYear = (importYearSelect && importYearSelect.value) ? importYearSelect.value : (settings.currentAcademicYear || DB.getCurrentAcademicYear());
    const importTrimesterSelect = document.getElementById('importTrimesterSelect');
    const detectedTrimester = (importTrimesterSelect && importTrimesterSelect.value) ? importTrimesterSelect.value : 'الثاني';

    let allEvals = await DB.getActivityEvaluations({}) || [];
    allEvals = allEvals.filter(r =>
        activityAcademicYearMatches(r.academic_year, finalYear) &&
        activityTrimesterMatches(r.trimester, detectedTrimester)
    );
    const impactedGroups = new Set();
    allEvals.forEach(r => {
        if (r.academic_year && r.trimester && r.level && r.class_number) {
            impactedGroups.add(`${r.academic_year}|${r.trimester}|${r.level}|${r.class_number}`);
        }
    });

    if (impactedGroups.size > 0) {
        log('جاري إعادة حساب المعدلات بناءً على التحديثات في الإعفاءات...');
        for (const groupKey of impactedGroups) {
            const parts = groupKey.split('|');
            await DB.computeAndSaveActivityAverages(parts[0], parts[1], parts[2], parts[3]);
        }
        log('تم الانتهاء من فحص وحساب المعدلات.', 'success');
        
        // Refresh whatever view is currently active (Overview or Averages)
        if (typeof renderExamAverage === 'function' && document.getElementById('tab-examavg').classList.contains('active')) {
            renderExamAverage();
        } else {
            await loadAndDisplayOverview();
        }
    }
}

// UI Rendering Logic for Exemptions
function renderExemptionsUI() {
    const container = document.getElementById('exemptionsList');
    if (!container) return;
    container.innerHTML = '';

    // Create a row for each level (1-4)
    for (let level = 1; level <= 4; level++) {
        const levelGroup = document.createElement('div');
        levelGroup.className = 'exemption-level-group';

        const title = document.createElement('div');
        title.className = 'exemption-level-title';
        title.innerText = `السنة ${level} متوسط:`;
        levelGroup.appendChild(title);

        const checkboxesDiv = document.createElement('div');
        checkboxesDiv.className = 'exemption-checkboxes';

        DEFAULT_EXEMPTABLE_SUBJECTS.forEach(subject => {
        // Unify names for display to avoid duplicates - show only full names
            if (['ت.تشكيلية', 'اعلام آلي', 'موسيقى', 'أمازيغية', 'رياضة', 'معلوماتية'].includes(subject)) return; // Skip short names in UI

            const lbl = document.createElement('label');
            lbl.className = 'exemption-chip';
            
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = subject;

            // Check if it's stored
            const isExempt = storedExemptions[level] && storedExemptions[level].some(s => s.includes(subject.replace('التربية ', '').replace('اللغة ', '')));
            chk.checked = isExempt;
            
            if (isExempt) {
                lbl.classList.add('active');
            }

            chk.onchange = (e) => {
                const checked = e.target.checked;
                if (checked) {
                    lbl.classList.add('active');
                } else {
                    lbl.classList.remove('active');
                }
                saveExemption(level, subject, checked);
            };

            lbl.appendChild(chk);
            
            const span = document.createElement('span');
            span.innerText = subject;
            lbl.appendChild(span);
            
            checkboxesDiv.appendChild(lbl);
        });

        levelGroup.appendChild(checkboxesDiv);
        container.appendChild(levelGroup);
    }
}

async function saveExemption(level, subject, isExempt) {
    if (!storedExemptions[level]) storedExemptions[level] = [];

    // Normalize subject to short form
    let shortSubj = subject.replace('التربية ', '').replace('اللغة ', '');
    // Mapping for generic matches
    let matchKeys = [shortSubj, subject];
    if (subject === 'الإعلام الآلي' || subject === 'المعلوماتية') matchKeys.push('معلوماتية', 'اعلام آلي');
    if (subject.includes('تشكيلية')) matchKeys.push('ت.تشكيلية');

    if (isExempt) {
        matchKeys.forEach(k => {
            if (!storedExemptions[level].includes(k)) storedExemptions[level].push(k);
        });
    } else {
        storedExemptions[level] = storedExemptions[level].filter(s => !matchKeys.includes(s));
    }

    await DB.set('activityEvaluationExemptions', storedExemptions);
    await loadAndDisplayOverview(); // Refresh overview UI
}

// Render Results Overview
async function loadAndDisplayOverview() {
    const container = document.getElementById('resultsOverview');
    const cardsContainer = document.getElementById('overviewCards');
    if (!container || !cardsContainer) return;

    const importYearSelect = document.getElementById('importYearSelect');
    let selectedYear = importYearSelect ? importYearSelect.value : null;

    if (!selectedYear) {
        container.style.display = 'none';
        return;
    }

    const currentAcademicYear = selectedYear;

    let trimester = document.getElementById('importTrimesterSelect').value || 'الثاني';

    // Fetch relational data
    let allData = await DB.getActivityEvaluations({}) || [];
    if (currentAcademicYear) {
        allData = allData.filter(d => activityAcademicYearMatches(d.academic_year, currentAcademicYear));
    }

    let currentData = allData.filter(d => activityTrimesterMatches(d.trimester, trimester));

    if (currentData.length === 0 && allData.length > 0) {
        // Find most recent trimester with records
        const trimestersWithData = Array.from(new Set(allData.map(d => d.trimester)));
        if (trimestersWithData.length > 0) {
            trimester = trimestersWithData[0]; // Just pick the first available one
            const t1 = document.getElementById('importTrimesterSelect');
            const t2 = document.getElementById('analysisTrimesterSelect');
            const t3 = document.getElementById('examavgTrimesterSelect');
            setSelectValueEnsuringOption('importTrimesterSelect', trimester);
            setSelectValueEnsuringOption('analysisTrimesterSelect', trimester);
            setSelectValueEnsuringOption('examavgTrimesterSelect', trimester);
            currentData = allData.filter(d => activityTrimesterMatches(d.trimester, trimester));
        }
    }

    if (currentData.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    cardsContainer.innerHTML = '';

    // Group by Level -> Class -> Subjects
    const structure = {};
    currentData.forEach(d => {
        const levelCode = getActivityLevelCode(d.level);
        if (!levelCode) return;
        const cls = d.class_number || d.class;
        if (!structure[levelCode]) structure[levelCode] = {};
        if (!structure[levelCode][cls]) structure[levelCode][cls] = [];
        if (!structure[levelCode][cls].includes(d.subject)) {
            structure[levelCode][cls].push(d.subject);
        }
    });

    // Sort levels
    const sortedLevels = Object.keys(structure).sort(sortActivityLevelCodes);

    sortedLevels.forEach(level => {
        // Get expected subjects formula
        let expectedCount = MIDDLE_SCHOOL_SUBJECTS.length; // 14

        // Apply exemptions
        if (storedExemptions[level]) {
            let exempted = 0;
            MIDDLE_SCHOOL_SUBJECTS.forEach(s => {
                if (storedExemptions[level].some(ex => s.includes(ex) || ex.includes(s))) {
                    exempted++;
                }
            });
            expectedCount -= exempted;
        }

        const levelCard = document.createElement('div');
        levelCard.className = 'level-card';

        const lHead = document.createElement('div');
        lHead.className = 'level-header';

        // Level wide stats
        let totalClasses = Object.keys(structure[level]).length;
        let totalProgressSum = 0;

        const lContent = document.createElement('div');
        lContent.className = 'level-content';

        const sortedClasses = Object.keys(structure[level]).sort((a, b) => parseInt(a) - parseInt(b));
        sortedClasses.forEach(cls => {
            const classItem = document.createElement('div');
            classItem.className = 'class-item';

            const importedSubjects = structure[level][cls];
            let actualCount = 0;
            importedSubjects.forEach(s => {
                const isExempt = storedExemptions[level] && storedExemptions[level].some(ex => s.includes(ex) || ex.includes(s));
                if (!isExempt) actualCount++;
            });

            let pct = expectedCount > 0 ? Math.min(100, Math.round((actualCount / expectedCount) * 100)) : 100;
            totalProgressSum += pct;

            const isComplete = pct >= 100;
            let progressClass = '';
            if (!isComplete) {
                progressClass = pct < 40 ? 'very-incomplete' : 'incomplete';
            }

            classItem.innerHTML = `
                <div class="class-header">
                    <div><span data-icon="users"></span> القسم ${cls}</div>
                    <div class="badge-status ${isComplete ? 'complete' : 'incomplete'}">
                        ${isComplete ? 'مكتمل' : 'ناقص'}
                    </div>
                </div>
                <div class="class-progress-container">
                    <div class="class-progress-bar">
                        <div class="class-progress-fill ${progressClass}" style="width: ${pct}%"></div>
                    </div>
                    <span style="font-weight: bold; color: #4a5568;">%${pct}</span>
                </div>
                <div style="font-size: 0.85rem; color: #718096; margin-bottom: 5px;">
                    <span data-icon="book"></span> المواد المستوردة: ${actualCount} / ${expectedCount}
                </div>
                <div class="subject-tags">
                    ${importedSubjects.map(s => `<span class="subject-tag">${s}</span>`).join('')}
                </div>
            `;
            lContent.appendChild(classItem);
        });

        const levelPct = Math.round(totalProgressSum / totalClasses);
        lHead.innerHTML = `
            <div>
                <span data-icon="layer-group" style="margin-left: 8px;"></span>
                <span>السنة ${getActivityLevelName(level)} متوسط</span>
            </div>
            <span>
                <span data-icon="chart-line" style="margin-left: 5px;"></span>
                نسبة الاستيراد الكلية: %${levelPct}
            </span>
        `;

        lHead.onclick = () => {
            const isHidden = lContent.style.display === 'none';
            lContent.style.display = isHidden ? 'grid' : 'none';
        };

        levelCard.appendChild(lHead);
        levelCard.appendChild(lContent);
        cardsContainer.appendChild(levelCard);
    });
}

// Rebuild overview when trimester changes
document.getElementById('importTrimesterSelect').addEventListener('change', loadAndDisplayOverview);

// ==========================================
// TAB SWITCHING
// ==========================================
function switchTab(tabName) {
    // 1. Reset all tabs and buttons
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    // 2. Activate the target tab content
    const targetTab = document.getElementById('tab-' + tabName);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // 3. Activate the corresponding button
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(b => {
        // Match by onclick attribute content to be more reliable than text
        const onClickAttr = b.getAttribute('onclick') || '';
        if (onClickAttr.includes(`'${tabName}'`) || onClickAttr.includes(`"${tabName}"`)) {
            b.classList.add('active');
        }
    });

    // 4. Trigger specific rendering for the tab
    if (tabName === 'analysis') {
        renderAnalysis();
    }
    if (tabName === 'examavg') {
        renderExamAverage();
    }
}

// ==========================================
// ANALYSIS TAB LOGIC
// ==========================================

async function renderAnalysis() {
    const container = document.getElementById('analysisContent');
    if (!container) return;

    const trimester = document.getElementById('analysisTrimesterSelect').value;
    const yearFilter = document.getElementById('analysisYearSelect').value;
    const levelFilter = document.getElementById('analysisLevelSelect').value;
    const classFilter = document.getElementById('analysisClassSelect').value;

    if (!yearFilter) {
        container.innerHTML = '<div class="no-data-msg"><span data-icon="info-circle"></span> يرجى اختيار السنة الدراسية أولاً.</div>';
        return;
    }

    const currentAcademicYear = yearFilter;

    let allData = await DB.getActivityEvaluations({}) || [];
    if (currentAcademicYear) {
        allData = allData.filter(d => activityAcademicYearMatches(d.academic_year, currentAcademicYear));
    }

    // Normalize properties for legacy access logic
    allData.forEach(d => { d.class = d.class_number; });

    const allStudentsData = await DB.getStudents(false, false, { academicYear: currentAcademicYear }) || []; // Proper API for full relational students array

    // Update class dropdown options dynamically FIRST, before returning
    updateClassDropdown(allData, trimester, levelFilter);

    let filtered = allData.filter(d => activityTrimesterMatches(d.trimester, trimester));

    if (levelFilter !== 'all') {
        filtered = filtered.filter(d => activityLevelMatches(d.level, levelFilter));
    }
    if (classFilter !== 'all') {
        filtered = filtered.filter(d => d.class === classFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="no-data-msg"><span data-icon="info-circle"></span> لا توجد بيانات مستوردة لهذا الفصل والمستوى أو القسم.</div>';
        return;
    }

    // Un-flatten the flat rows into group objects the original UI expects
    // We group back into { subject: 'Arabic', students: [{ evalMark, assignmentMark... }] }
    const structure = {};
    filtered.forEach(d => {
        const levelCode = getActivityLevelCode(d.level);
        const key = levelCode + '_' + d.class;
        if (!structure[key]) {
            structure[key] = { level: levelCode, class: d.class, subjectMap: {} };
        }

        if (!structure[key].subjectMap[d.subject]) {
            structure[key].subjectMap[d.subject] = { subject: d.subject, students: [] };
        }

        structure[key].subjectMap[d.subject].students.push({
            id: d.student_id,
            name: d.student_name,
            lastName: (d.student_name || '').split(' ')[0] || d.student_name || '',
            firstName: (d.student_name || '').substring((d.student_name || '').indexOf(' ') + 1) || '',
            evalMark: d.eval_mark,
            assignmentMark: d.assignment_mark,
            testMark: d.test_mark
        });
    });

    // Convert subjectMap into an array of subjects
    Object.keys(structure).forEach(key => {
        structure[key].subjects = Object.values(structure[key].subjectMap);
    });

    let html = '';
    const sortedKeys = Object.keys(structure).sort((a, b) => {
        const [la, ca] = a.split('_');
        const [lb, cb] = b.split('_');
        return (parseInt(la) - parseInt(lb)) || (parseInt(ca) - parseInt(cb));
    });

    sortedKeys.forEach(key => {
        const group = structure[key];
        const levelName = getActivityLevelName(group.level);

        html += `<div class="analysis-class-card">`;
        html += `<div class="analysis-class-header">
            <span>السنة ${levelName} متوسط - القسم ${group.class}</span>
            <span>${group.subjects.length} مادة</span>
        </div>`;
        html += `<div class="analysis-table-wrapper">`;
        html += `<table class="analysis-table">`;
        html += `<thead>
            <tr>
                <th rowspan="2">المادة</th>
                <th rowspan="2">عدد التلاميذ</th>
                <th colspan="3" class="group-header">تقويم النشاطات</th>
                <th colspan="3" class="group-header">الفرض</th>
                <th colspan="3" class="group-header">الاختبار</th>
            </tr>
            <tr>
                <th>المعدل</th>
                <th>≥ 10</th>
                <th>نسبة النجاح</th>
                <th>المعدل</th>
                <th>≥ 10</th>
                <th>نسبة النجاح</th>
                <th>المعدل</th>
                <th>≥ 10</th>
                <th>نسبة النجاح</th>
            </tr>
        </thead><tbody>`;

        group.subjects.forEach(subj => {
            const students = subj.students || [];
            const total = students.length;

            // Calculate stats for each category
            const evalStats = calcStats(students, 'evalMark', total, subj.subject, trimester, allStudentsData);
            const assignStats = calcStats(students, 'assignmentMark', total, subj.subject, trimester, allStudentsData);
            const testStats = calcStats(students, 'testMark', total, subj.subject, trimester, allStudentsData);

            html += `<tr>`;
            html += `<td style="font-weight:bold; text-align:right; padding-right:10px;">${subj.subject}</td>`;
            html += `<td>${total}</td>`;
            html += renderStatsCells(evalStats);
            html += renderStatsCells(assignStats);
            html += renderStatsCells(testStats);
            html += `</tr>`;
        });

        html += `</tbody></table></div></div>`;
    });

    container.innerHTML = html;
}

function calcStats(students, markField, total, subjectName = '', trimester = '', allStudentsData = []) {
    if (total === 0) return { avg: '-', above10: '-', rate: '-', rateClass: '' };

    let sum = 0;
    let count = 0;
    let above10 = 0;

    let trimesterNum = '1';
    if (trimester === 'الثاني') trimesterNum = '2';
    else if (trimester === 'الثالث') trimesterNum = '3';

const normLocal = (str) => normalizeArabicValue(str);

    students.forEach(s => {
        const mark = s[markField];
        if (mark !== null && mark !== undefined && mark !== '') {
            const numMark = parseFloat(mark);
            if (isNaN(numMark)) return; // Skip non-numeric values like "معفى"

            // Check exemption from regular marks
            if (subjectName && allStudentsData.length > 0) {
                const fullStudentInfo = allStudentsData.find(st => st.id == s.id || (normLocal(st.lastName) === normLocal(s.lastName) && normLocal(st.firstName) === normLocal(s.firstName)));

                if (fullStudentInfo && fullStudentInfo.marks) {
                    let foundAnyMark = false;
                    let hasValidMark = false;
                    const cleanSubj = normLocal(subjectName);
                    const isPE = cleanSubj.includes('بدنيه') || cleanSubj.includes('رياضه');

                    for (const mKey of Object.keys(fullStudentInfo.marks)) {
                        const cleanMKey = normLocal(mKey);
                        if (cleanMKey.includes(`ف${trimesterNum}`) || cleanMKey.includes(`فصل ${trimesterNum}`) || (!cleanMKey.includes('ف1') && !cleanMKey.includes('ف2') && !cleanMKey.includes('ف3') && !cleanMKey.includes('فصل'))) {
                            let matches = false;
                            if (isPE && (cleanMKey.includes('بدنيه') || cleanMKey.includes('رياضه'))) {
                                matches = true;
                            } else if (cleanSubj.split(' ').filter(w => w.length > 2).some(w => cleanMKey.includes(w))) {
                                matches = true;
                            }

                            if (matches) {
                                foundAnyMark = true;
                                const val = fullStudentInfo.marks[mKey];
                                if (val !== null && val !== undefined && val !== '-' && val !== '') {
                                    hasValidMark = true;
                                }
                            }
                        }
                    }

                    // If we found the subject in their file but the value is empty, and the imported mark is 0, they are exempt
                    if (foundAnyMark && !hasValidMark && numMark === 0) {
                        return; // Skip
                    }
                }
            }

            sum += numMark;
            count++;
            if (numMark >= 10) above10++;
        }
    });

    if (count === 0) return { avg: '-', above10: '-', rate: '-', rateClass: '' };

    const avg = (sum / count).toFixed(2);
    const rate = ((above10 / count) * 100).toFixed(1);
    const rateNum = parseFloat(rate);
    const rateClass = rateNum >= 60 ? 'success-high' : rateNum >= 40 ? 'success-mid' : 'success-low';

    return { avg, above10, rate: rate + '%', rateClass };
}

function renderStatsCells(stats) {
    if (stats.avg === '-') {
        return `<td>-</td><td>-</td><td>-</td>`;
    }
    return `<td>${stats.avg}</td><td>${stats.above10}</td><td class="${stats.rateClass}">${stats.rate}</td>`;
}

function updateClassDropdown(allData, trimester, levelFilter) {
    const select = document.getElementById('analysisClassSelect');
    const currentVal = select.value;

    let relevantData = allData.filter(d => activityTrimesterMatches(d.trimester, trimester));
    if (levelFilter !== 'all') {
        relevantData = relevantData.filter(d => activityLevelMatches(d.level, levelFilter));
    }

    const classes = new Set();
    relevantData.forEach(d => classes.add(d.class));
    const sorted = Array.from(classes).sort((a, b) => parseInt(a) - parseInt(b));

    select.innerHTML = '<option value="all">جميع الأقسام</option>';
    sorted.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = 'القسم ' + c;
        select.appendChild(opt);
    });

    // Restore selection if still valid
    if (sorted.includes(currentVal)) {
        select.value = currentVal;
    }
}

// Analysis filter event listeners
document.getElementById('analysisTrimesterSelect').addEventListener('change', renderAnalysis);
document.getElementById('analysisLevelSelect').addEventListener('change', renderAnalysis);
document.getElementById('analysisClassSelect').addEventListener('change', renderAnalysis);


async function clearTrimesterData() {
    const trimester = document.getElementById('importTrimesterSelect').value;
    const importYearSelect = document.getElementById('importYearSelect');
    const selectedYear = importYearSelect ? importYearSelect.value : null;

    if (!selectedYear) {
        Swal.fire('تنبيه', 'يرجى اختيار السنة الدراسية أولاً.', 'warning');
        return;
    }

    const targetAcademicYear = selectedYear;

    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMsg = document.getElementById('confirmMsg');
    const modalConfirm = document.getElementById('modalConfirm');

    confirmTitle.innerText = `حذف نتائج ${trimester}`;
    confirmMsg.innerHTML = `هل أنت متأكد من أنك تريد حذف نتائج <strong>${trimester}</strong> للسنة الدراسية <strong>${targetAcademicYear}</strong> فقط؟<br><span style='color:#e74c3c;'>هذا الإجراء سيقوم بحذف كافة النقاط المستوردة المرتبطة بهذا الفصل حصراً.</span>`;

    modalConfirm.onclick = async () => {
        closeModal('confirmModal');
        try {
            await clearActivityEvaluationsForPeriod(targetAcademicYear, trimester);
            document.getElementById('successMessage').innerText = `تم حذف نتائج ${trimester} بنجاح.`;
            document.getElementById('successModal').classList.add('active');
            loadAndDisplayOverview();
            log(`تم حذف نتائج ${trimester} للسنة ${targetAcademicYear}`, 'warning');
        } catch (error) {
            log(`خطأ أثناء الحذف الجزئي: ${error.message}`, 'error');
        }
    };

    document.getElementById('confirmModal').classList.add('active');
}

async function clearAllData() {
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMsg = document.getElementById('confirmMsg');
    const modalConfirm = document.getElementById('modalConfirm');

    confirmTitle.innerText = "حذف جميع النتائج";
    confirmMsg.innerHTML = "هل أنت متأكد من أنك تريد <strong>حذف جميع نتائج التقويم المستمر والفرض والاختبار</strong> لجميع الأقسام والفصول من قاعدة البيانات؟<br><span style='color:#e74c3c;'>هذا الإجراء لا يمكن التراجع عنه.</span>";

    modalConfirm.onclick = async () => {
        closeModal('confirmModal');
        try {
            await DB.clearActivityEvaluations();
            document.getElementById('successMessage').innerText = "تم حذف جميع النتائج المستوردة بنجاح.";
            document.getElementById('successModal').classList.add('active');
            loadAndDisplayOverview();
            document.getElementById('logArea').innerHTML = '<div style="color:#e74c3c;">تم حذف جميع البيانات.</div>';
        } catch (error) {
            log(`خطأ أثناء الحذف: ${error.message}`, 'error');
        }
    };

    document.getElementById('confirmModal').classList.add('active');
}

async function printAnalysis() {
    const analysisContent = document.getElementById('analysisContent');
    if (!analysisContent || analysisContent.querySelector('.no-data-msg')) {
        alert('الرجاء اختيار المعايير وعرض التحليل أولاً');
        return;
    }

    const trimester = document.getElementById('analysisTrimesterSelect').value;
    const levelSelect = document.getElementById('analysisLevelSelect');
    const level = levelSelect.options[levelSelect.selectedIndex].text;
    const classSelect = document.getElementById('analysisClassSelect');
    const classVal = classSelect.options[classSelect.selectedIndex].text;

    // Load settings
    const settings = await DB.getSettings() || {};
    const sigSettings = await DB.get('signatureSettings') || {};
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // Determine Signer
    const reportKey = 'activity_evaluation';
    const reportConfig = (sigSettings.reportSettings && sigSettings.reportSettings[reportKey]) || { signer: 'director', showSignature: true };
    const signerData = (sigSettings.signers && sigSettings.signers[reportConfig.signer]) || { fullName: settings.managerName || '', gender: 'male' };

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

    // Clone the analysis content for printing
    const contentClone = analysisContent.cloneNode(true);

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير تحليل تقويم النشاطات - ${trimester}</title>
            <style>
                @font-face {
                    font-family: 'Cairo';
                    src: url('../assets/fonts/Cairo-Regular.ttf') format('truetype');
                    font-weight: 400;
                }
                @font-face {
                    font-family: 'Cairo';
                    src: url('../assets/fonts/Cairo-Bold.ttf') format('truetype');
                    font-weight: 700;
                }
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
                .header-republic h3 { margin: 2px 0; font-size: 11pt; font-weight: bold; }

                .info-block { display: flex; justify-content: space-between; border-bottom: 1.5pt solid #000; padding-bottom: 5px; margin-bottom: 15px; }
                .info-item { font-size: 10pt; }

                .title-box { text-align: center; margin: 15px 0; }
                .title-box h2 {
                    display: inline-block;
                    border: 2pt solid #000;
                    padding: 8px 30px;
                    border-radius: 8px;
                    background: #fdfdfd;
                    font-size: 14pt;
                    margin-bottom: 5px;
                }
                .title-sub { font-weight: bold; font-size: 11.5pt; }

                .analysis-class-card {
                    margin-bottom: 30px;
                    page-break-inside: avoid;
                    border: 1px solid #000;
                    border-radius: 5px;
                    overflow: hidden;
                }
                .analysis-class-header {
                    background: #eee !important;
                    color: #000 !important;
                    padding: 8px 15px;
                    font-weight: bold;
                    border-bottom: 1pt solid #000;
                    display: flex;
                    justify-content: space-between;
                }

                table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
                th, td { border: 1pt solid #000; padding: 5px; text-align: center; }
                th { background-color: #f2f2f2 !important; font-weight: bold; }
                th.group-header { background-color: #e9ecef !important; }

                .success-high { color: #27ae60 !important; font-weight: bold; }
                .success-mid { color: #f39c12 !important; font-weight: bold; }
                .success-low { color: #e74c3c !important; font-weight: bold; }

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
                <h2>تقرير تحليل نتائج تقويم النشاطات والفرض والاختبار</h2>
                <div class="title-sub">الفصل: ${trimester} | المستوى: ${level} | القسم: ${classVal}</div>
            </div>

            <div class="report-body">
                ${contentClone.innerHTML}
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

async function printExamAverage() {
    const examavgContent = document.getElementById('examavgContent');
    if (!examavgContent || examavgContent.querySelector('.no-data-msg')) {
        alert('\u0627\u0644\u0631\u062c\u0627\u0621 \u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0645\u0639\u0627\u064a\u064a\u0631 \u0648\u0639\u0631\u0636 \u0645\u0639\u062f\u0644\u0627\u062a \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0623\u0648\u0644\u0627\u064b');
        return;
    }

    const trimester = document.getElementById('examavgTrimesterSelect').value;
    const levelSelect = document.getElementById('examavgLevelSelect');
    const level = levelSelect.options[levelSelect.selectedIndex].text;
    const classSelect = document.getElementById('examavgClassSelect');
    const classVal = classSelect.options[classSelect.selectedIndex].text;

    // Load settings
    const settings = await DB.getSettings() || {};
    const sigSettings = await DB.get('signatureSettings') || {};
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

    // Determine Signer
    const reportKey = 'activity_evaluation';
    const reportConfig = (sigSettings.reportSettings && sigSettings.reportSettings[reportKey]) || { signer: 'director', showSignature: true };
    const signerData = (sigSettings.signers && sigSettings.signers[reportConfig.signer]) || { fullName: settings.managerName || '', gender: 'male' };

    let signerTitle;
    if (reportConfig.signer === 'director') {
        signerTitle = signerData.gender === 'female' ? '\u0627\u0644\u0645\u062f\u064a\u0631\u0629' : '\u0627\u0644\u0645\u062f\u064a\u0631';
    } else {
        signerTitle = signerData.gender === 'female' ? '\u0627\u0644\u0646\u0627\u0638\u0631\u0629' : '\u0627\u0644\u0646\u0627\u0638\u0631';
    }
    const signerName = signerData.fullName || settings.managerName || '................';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('\u064a\u0631\u062c\u0649 \u0627\u0644\u0633\u0645\u0627\u062d \u0628\u0627\u0644\u0646\u0648\u0627\u0641\u0630 \u0627\u0644\u0645\u0646\u0628\u062b\u0642\u0629 \u0644\u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u062a\u0642\u0631\u064a\u0631');
        return;
    }

    const contentClone = examavgContent.cloneNode(true);

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>\u062a\u0642\u0631\u064a\u0631 \u0645\u0639\u062f\u0644\u0627\u062a \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 - ${trimester}</title>
            <style>
                @font-face {
                    font-family: 'Cairo';
                    src: url('../assets/fonts/Cairo-Regular.ttf') format('truetype');
                    font-weight: 400;
                }
                @font-face {
                    font-family: 'Cairo';
                    src: url('../assets/fonts/Cairo-Bold.ttf') format('truetype');
                    font-weight: 700;
                }
                @page { margin: 0.8cm; size: A4; }
                body {
                    font-family: 'Cairo', sans-serif;
                    direction: rtl;
                    padding: 0;
                    font-size: 11pt;
                    line-height: 1.4;
                    -webkit-print-color-adjust: exact;
                }

                .header-republic { text-align: center; margin-bottom: 2px; }
                .header-republic h3 { margin: 0; font-size: 10pt; font-weight: bold; }

                .info-block { display: flex; justify-content: space-between; border-bottom: 1pt solid #000; padding-bottom: 3px; margin-bottom: 5px; }
                .info-item { font-size: 9pt; }

                .title-box { text-align: center; margin: 5px 0; }
                .title-box h2 {
                    display: inline-block;
                    border: 1.5pt solid #000;
                    padding: 4px 20px;
                    border-radius: 6px;
                    background: #fdfdfd;
                    font-size: 12pt;
                    margin-bottom: 3px;
                }
                .title-sub { font-weight: bold; font-size: 10pt; }

                .analysis-class-card {
                    margin-bottom: 10px;
                    border: none;
                    overflow: visible;
                }
                .analysis-class-header { display: none; }
                .analysis-table-wrapper { padding: 0; }

                .examavg-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
                .examavg-table thead { display: table-header-group; }
                .examavg-table th, .examavg-table td { border: 1pt solid #000; padding: 3px 2px; text-align: center; }
                .examavg-table th { background-color: #f2f2f2 !important; font-weight: bold; font-size: 7.5pt; }
                .examavg-table th.subject-col {
                    writing-mode: vertical-rl;
                    text-orientation: mixed;
                    min-width: 22px;
                    max-width: 30px;
                    padding: 6px 2px;
                    font-size: 7pt;
                    background-color: #e0e8f0 !important;
                }
                .examavg-table .avg-cell { font-weight: bold; }
                .avg-pass { color: #27ae60 !important; }
                .avg-fail { color: #e74c3c !important; }

                .missing-subjects-warning {
                    background: #fff3cd !important;
                    border: 1px solid #ffc107;
                    padding: 10px;
                    border-radius: 5px;
                    margin-bottom: 10px;
                    font-size: 9pt;
                }
                .missing-list span {
                    background: #fde8e8 !important;
                    padding: 2px 6px;
                    border-radius: 3px;
                    margin: 0 3px;
                    font-size: 8pt;
                }

                .class-avg-summary {
                    display: flex;
                    gap: 15px;
                    padding: 8px 10px;
                    background: #f5f5f5 !important;
                    border-top: 1pt solid #000;
                    font-size: 9pt;
                    flex-wrap: wrap;
                }
                .class-avg-summary .stat-item { font-weight: bold; }
                .class-avg-summary .stat-item span { color: #000 !important; }

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
                <h3>\u0627\u0644\u062c\u0645\u0647\u0648\u0631\u064a\u0629 \u0627\u0644\u062c\u0632\u0627\u0626\u0631\u064a\u0629 \u0627\u0644\u062f\u064a\u0645\u0642\u0631\u0627\u0637\u064a\u0629 \u0627\u0644\u0634\u0639\u0628\u064a\u0629</h3>
                <h3>\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062a\u0631\u0628\u064a\u0629 \u0627\u0644\u0648\u0637\u0646\u064a\u0629</h3>
            </div>

            <div class="info-block">
                <div class="info-col">
                    <div class="info-item"><strong>\u0645\u062f\u064a\u0631\u064a\u0629 \u0627\u0644\u062a\u0631\u0628\u064a\u0629 \u0644\u0648\u0644\u0627\u064a\u0629:</strong> ${settings.wilaya || '.......'}</div>
                    <div class="info-item"><strong>\u0627\u0644\u0645\u0624\u0633\u0633\u0629:</strong> ${settings.institutionName || '.......'}</div>
                </div>
                <div class="info-col" style="text-align: left;">
                    <div class="info-item"><strong>\u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u062f\u0631\u0627\u0633\u064a\u0629:</strong> \</div>
                    <div class="info-item"><strong>\u0627\u0644\u0645\u0642\u0627\u0637\u0639\u0629/\u0627\u0644\u0628\u0644\u062f\u064a\u0629:</strong> ${settings.municipality || '.......'}</div>
                </div>
            </div>

            <div class="title-box">
                <h2>\u062a\u0642\u0631\u064a\u0631 \u0645\u0639\u062f\u0644\u0627\u062a \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631</h2>
                <div class="title-sub">\u0627\u0644\u0641\u0635\u0644: ${trimester} | \u0627\u0644\u0645\u0633\u062a\u0648\u0649: ${level} | \u0627\u0644\u0642\u0633\u0645: ${classVal}</div>
            </div>

            <div class="report-body">
                ${contentClone.innerHTML}
            </div>

            <div class="footer">
                <div class="signature-block">
                    <div style="margin-bottom: 5px;">\u062d\u0631\u0631 \u0628\u0640: ${settings.municipality || '.......'} \u0641\u064a: ${today}</div>
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

// ==========================================
// EXAM AVERAGE TAB LOGIC
// ==========================================

// Required subject slots - التشكيلية and الموسيقية are alternatives (one OR the other)
const REQUIRED_SUBJECT_SLOTS = [
    ['\u0627\u0644\u0644\u063a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629'],
    ['\u0627\u0644\u0644\u063a\u0629 \u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629'],
    ['\u0627\u0644\u0644\u063a\u0629 \u0627\u0644\u0641\u0631\u0646\u0633\u064a\u0629'],
    ['\u0627\u0644\u0644\u063a\u0629 \u0627\u0644\u0623\u0645\u0627\u0632\u064a\u063a\u064a\u0629'],
    ['\u0627\u0644\u0631\u064a\u0627\u0636\u064a\u0627\u062a'],
    ['\u0639 \u0627\u0644\u0637\u0628\u064a\u0639\u0629 \u0648 \u0627\u0644\u062d\u064a\u0627\u0629'],
    ['\u0639 \u0627\u0644\u0641\u064a\u0632\u064a\u0627\u0626\u064a\u0629 \u0648\u0627\u0644\u062a\u0643\u0646\u0648\u0644\u0648\u062c\u064a\u0627'],
    ['\u0627\u0644\u062a\u0631\u0628\u064a\u0629 \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064a\u0629'],
    ['\u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0648\u0627\u0644\u062c\u063a\u0631\u0627\u0641\u064a\u0627'],
    ['\u0627\u0644\u062a\u0631\u0628\u064a\u0629 \u0627\u0644\u0645\u062f\u0646\u064a\u0629'],
    ['\u0627\u0644\u062a\u0631\u0628\u064a\u0629 \u0627\u0644\u062a\u0634\u0643\u064a\u0644\u064a\u0629', '\u0627\u0644\u062a\u0631\u0628\u064a\u0629 \u0627\u0644\u0645\u0648\u0633\u064a\u0642\u064a\u0629'],
    ['\u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a\u064a\u0629'],
    ['\u062a \u0627\u0644\u0628\u062f\u0646\u064a\u0629 \u0648 \u0627\u0644\u0631\u064a\u0627\u0636\u064a\u0629']
];

async function renderExamAverage() {
    const container = document.getElementById('examavgContent');
    if (!container) return;

    const trimester = document.getElementById('examavgTrimesterSelect').value;
    const yearFilter = document.getElementById('examavgYearSelect').value;
    const levelFilter = document.getElementById('examavgLevelSelect').value;
    const classFilter = document.getElementById('examavgClassSelect').value;
    const levelCode = getActivityLevelCode(levelFilter);
    const level = parseInt(levelCode, 10);

    if (!yearFilter) {
        container.innerHTML = '<div class="no-data-msg"><span data-icon="info-circle"></span> يرجى اختيار السنة الدراسية أولاً.</div>';
        return;
    }

    const currentAcademicYear = yearFilter;

    let allData = await DB.getActivityEvaluations({}) || [];
    if (currentAcademicYear) {
        allData = allData.filter(d => activityAcademicYearMatches(d.academic_year, currentAcademicYear));
    }
    allData.forEach(d => { d.class = d.class_number; });

    const allStudentsData = await DB.getStudents(false, false, { academicYear: currentAcademicYear }) || [];
    let filtered = allData.filter(d => activityTrimesterMatches(d.trimester, trimester) && activityLevelMatches(d.level, levelFilter));

    // Update class dropdown
    updateExamAvgClassDropdown(allData, trimester, levelFilter);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="no-data-msg"><span data-icon="info-circle"></span> \u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0645\u0633\u062a\u0648\u0631\u062f\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0635\u0644 \u0648\u0627\u0644\u0645\u0633\u062a\u0648\u0649.</div>';
        return;
    }

    // Group by class
    const classesSections = new Set();
    filtered.forEach(d => classesSections.add(d.class));
    const sortedClasses = Array.from(classesSections).sort((a, b) => parseInt(a) - parseInt(b));

    // If a specific class is selected
    const classesToRender = classFilter !== 'all' ? [classFilter] : sortedClasses;

    let html = '';

    classesToRender.forEach(cls => {
        const classRecords = filtered.filter(d => d.class === cls);

        // Map imported subjects to coefficient keys
        const importedSubjectKeys = new Set();
        const subjectRecordMap = {}; // coeffKey -> { subject, students: [] }
        classRecords.forEach(flatRec => {
            const coeffKey = SubjectManager.matchSubjectForCoefficient(flatRec.subject);
            if (coeffKey) {
                importedSubjectKeys.add(coeffKey);
                if (!subjectRecordMap[coeffKey]) {
                    subjectRecordMap[coeffKey] = { subject: flatRec.subject, students: [] };
                }
                subjectRecordMap[coeffKey].students.push({
                    id: flatRec.student_id,
                    lastName: (flatRec.student_name || '').split(' ')[0] || flatRec.student_name || '',
                    firstName: (flatRec.student_name || '').substring((flatRec.student_name || '').indexOf(' ') + 1) || '',
                    testMark: flatRec.test_mark
                });
            }
        });

        // Check completeness: which required slots are missing?
        const missingSlots = [];
        const requiredSlots = REQUIRED_SUBJECT_SLOTS.filter(slot => {
            // Check if any subject in this slot is exempted
            const isExempted = slot.every(s =>
                storedExemptions[level] &&
                storedExemptions[level].some(ex => s.includes(ex) || ex.includes(s))
            );
            return !isExempted;
        });

        requiredSlots.forEach(slot => {
            const slotFilled = slot.some(s => importedSubjectKeys.has(s));
            if (!slotFilled) {
                missingSlots.push(slot[0]); // show first name as representative
            }
        });

        const isComplete = missingSlots.length === 0;

        // Build header
        const levelName = getActivityLevelName(levelCode);
        html += `<div class="analysis-class-card">`;
        html += `<div class="analysis-class-header">
            <span>\u0627\u0644\u0633\u0646\u0629 ${levelName} \u0645\u062a\u0648\u0633\u0637 - \u0627\u0644\u0642\u0633\u0645 ${cls}</span>
            <span>${importedSubjectKeys.size} \u0645\u0627\u062f\u0629 \u0645\u0633\u062a\u0648\u0631\u062f\u0629 / ${requiredSlots.length} \u0645\u0637\u0644\u0648\u0628\u0629</span>
        </div>`;
        html += `<div class="analysis-table-wrapper">`;

        // Warning for missing subjects
        if (!isComplete) {
            html += `<div class="missing-subjects-warning">
                <strong><span data-icon="exclamation-triangle"></span> \u0644\u0645 \u064a\u062a\u0645 \u0627\u0633\u062a\u064a\u0631\u0627\u062f \u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u0648\u0627\u062f \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645. \u0627\u0644\u0645\u0639\u062f\u0644 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d.</strong>
                <span>\u0627\u0644\u0645\u0648\u0627\u062f \u0627\u0644\u0646\u0627\u0642\u0635\u0629:</span>
                <div class="missing-list">${missingSlots.map(s => `<span>${s}</span>`).join('')}</div>
            </div>`;
            html += `</div></div>`;
            return;
        }

        // Build ordered subject list for columns (subjects that are imported and not exempted)
        const orderedSubjects = [];
        requiredSlots.forEach(slot => {
            const found = slot.find(s => importedSubjectKeys.has(s));
            if (found) orderedSubjects.push(found);
        });

        // Build student map by ID
        const studentMap = {};
        orderedSubjects.forEach(subjectKey => {
            const record = subjectRecordMap[subjectKey];
            if (!record) return;
            record.students.forEach(s => {
                const sid = s.id ? s.id.toString().trim() : null;
                if (!sid) return;
                if (!studentMap[sid]) {
                    studentMap[sid] = {
                        id: sid,
                        lastName: (s.lastName || '').trim(),
                        firstName: (s.firstName || '').trim(),
                        subjects: {}
                    };
                }
                studentMap[sid].subjects[subjectKey] = s.testMark;
            });
        });

        // Calculate weighted average for each student
        const students = Object.values(studentMap);

        let trimesterNum = '1';
        if (trimester === 'الثاني') trimesterNum = '2';
        else if (trimester === 'الثالث') trimesterNum = '3';

        // Helper to normalize arabic for comparison
        const normLocal = (str) => normalizeArabicValue(str);

        students.forEach(student => {
            let totalWeighted = 0;
            let totalCoeff = 0;

            // Find full student matching this ID or Name to check regular marks
            const fullStudentInfo = allStudentsData.find(st => st.id == student.id || (normLocal(st.lastName) === normLocal(student.lastName) && normLocal(st.firstName) === normLocal(student.firstName)));

            orderedSubjects.forEach(subj => {
                const mark = student.subjects[subj];

                if (mark === null || mark === undefined || mark === '') return; // skip empty

                const numMark = parseFloat(mark);
                if (isNaN(numMark)) return; // Skip non-numeric values like "معفى"

                // Check exemption from regular marks (e.g. PE)
                if (fullStudentInfo && fullStudentInfo.marks) {
                    let foundAnyMark = false;
                    let hasValidMark = false;
                    const cleanSubj = normLocal(subj);
                    // Match short name for PE
                    const isPE = cleanSubj.includes('بدنيه') || cleanSubj.includes('رياضه');

                    for (const mKey of Object.keys(fullStudentInfo.marks)) {
                        const cleanMKey = normLocal(mKey);
                        if (cleanMKey.includes(`ف${trimesterNum}`) || cleanMKey.includes(`فصل ${trimesterNum}`) || (!cleanMKey.includes('ف1') && !cleanMKey.includes('ف2') && !cleanMKey.includes('ف3') && !cleanMKey.includes('فصل'))) {
                            let matches = false;
                            if (isPE && (cleanMKey.includes('بدنيه') || cleanMKey.includes('رياضه'))) {
                                matches = true;
                            } else if (cleanSubj.split(' ').filter(w => w.length > 2).some(w => cleanMKey.includes(w))) {
                                matches = true;
                            }

                            if (matches) {
                                foundAnyMark = true;
                                const val = fullStudentInfo.marks[mKey];
                                if (val !== null && val !== undefined && val !== '-' && val !== '') {
                                    hasValidMark = true; // They actually have a mark
                                }
                            }
                        }
                    }

                    // If we found the subject in their file but the value is empty, and the imported testMark is 0, they are exempt
                    if (foundAnyMark && !hasValidMark && numMark === 0) {
                        return; // Skip
                    }
                }

                const coeff = SubjectManager.getSubjectCoefficient('middle', level, 'common', subj);
                if (coeff > 0) {
                    totalWeighted += numMark * coeff;
                    totalCoeff += coeff;
                }
            });
            student.average = totalCoeff > 0 ? (totalWeighted / totalCoeff) : null;
        });

        // Sort by average descending
        students.sort((a, b) => (b.average || 0) - (a.average || 0));

        // Short subject names for column headers
        const shortNames = {
            '\u0627\u0644\u0644\u063a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629': '\u0639\u0631\u0628\u064a\u0629',
            '\u0627\u0644\u0644\u063a\u0629 \u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629': '\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629',
            '\u0627\u0644\u0644\u063a\u0629 \u0627\u0644\u0641\u0631\u0646\u0633\u064a\u0629': '\u0641\u0631\u0646\u0633\u064a\u0629',
            '\u0627\u0644\u0644\u063a\u0629 \u0627\u0644\u0623\u0645\u0627\u0632\u064a\u063a\u064a\u0629': '\u0623\u0645\u0627\u0632\u064a\u063a\u064a\u0629',
            '\u0627\u0644\u0631\u064a\u0627\u0636\u064a\u0627\u062a': '\u0631\u064a\u0627\u0636\u064a\u0627\u062a',
            '\u0639 \u0627\u0644\u0637\u0628\u064a\u0639\u0629 \u0648 \u0627\u0644\u062d\u064a\u0627\u0629': '\u0637\u0628\u064a\u0639\u0629',
            '\u0639 \u0627\u0644\u0641\u064a\u0632\u064a\u0627\u0626\u064a\u0629 \u0648\u0627\u0644\u062a\u0643\u0646\u0648\u0644\u0648\u062c\u064a\u0627': '\u0641\u064a\u0632\u064a\u0627\u0621',
            '\u0627\u0644\u062a\u0631\u0628\u064a\u0629 \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064a\u0629': '\u0625\u0633\u0644\u0627\u0645\u064a\u0629',
            '\u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0648\u0627\u0644\u062c\u063a\u0631\u0627\u0641\u064a\u0627': '\u062a\u0627\u0631\u064a\u062e/\u062c\u063a\u0631\u0627\u0641\u064a\u0627',
            '\u0627\u0644\u062a\u0631\u0628\u064a\u0629 \u0627\u0644\u0645\u062f\u0646\u064a\u0629': '\u0645\u062f\u0646\u064a\u0629',
            '\u0627\u0644\u062a\u0631\u0628\u064a\u0629 \u0627\u0644\u062a\u0634\u0643\u064a\u0644\u064a\u0629': '\u062a\u0634\u0643\u064a\u0644\u064a\u0629',
            '\u0627\u0644\u062a\u0631\u0628\u064a\u0629 \u0627\u0644\u0645\u0648\u0633\u064a\u0642\u064a\u0629': '\u0645\u0648\u0633\u064a\u0642\u064a\u0629',
            '\u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a\u064a\u0629': '\u0645\u0639\u0644\u0648\u0645\u0627\u062a\u064a\u0629',
            '\u062a \u0627\u0644\u0628\u062f\u0646\u064a\u0629 \u0648 \u0627\u0644\u0631\u064a\u0627\u0636\u064a\u0629': '\u0631\u064a\u0627\u0636\u0629'
        };

        // Build table
        html += `<table class="examavg-table">`;
        html += `<thead><tr>`;
        html += `<th class="rank-col">\u0627\u0644\u0631\u062a\u0628\u0629</th><th class="name-col">\u0627\u0644\u0644\u0642\u0628 \u0648\u0627\u0644\u0627\u0633\u0645</th>`;
        orderedSubjects.forEach(subj => {
            const coeff = SubjectManager.getSubjectCoefficient('middle', level, 'common', subj);
            const shortName = shortNames[subj] || subj;
            html += `<th class="subject-col" title="${subj} (\u0645\u0639\u0627\u0645\u0644 ${coeff})">${shortName}<br><small>\u00d7${coeff}</small></th>`;
        });
        html += `<th class="avg-col">\u0645\u0639\u062f\u0644 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631</th>`;
        html += `</tr></thead><tbody>`;

        students.forEach((student, idx) => {
            html += `<tr>`;
            html += `<td class="rank-col">${idx + 1}</td>`;
            html += `<td class="name-col">${student.lastName} ${student.firstName}</td>`;
            orderedSubjects.forEach(subj => {
                const mark = student.subjects[subj];
                const display = (mark !== null && mark !== undefined) ? parseFloat(mark).toFixed(2) : '-';
                html += `<td class="subject-col">${display}</td>`;
            });
            if (student.average !== null) {
                const avgClass = student.average >= 10 ? 'avg-pass' : 'avg-fail';
                html += `<td class="avg-cell avg-col ${avgClass}">${student.average.toFixed(2)}</td>`;
            } else {
                html += `<td class="avg-cell avg-col">-</td>`;
            }
            html += `</tr>`;
        });

        html += `</tbody></table>`;

        // Class summary stats
        const validStudents = students.filter(s => s.average !== null);
        if (validStudents.length > 0) {
            const classAvg = validStudents.reduce((sum, s) => sum + s.average, 0) / validStudents.length;
            const passCount = validStudents.filter(s => s.average >= 10).length;
            const passRate = ((passCount / validStudents.length) * 100).toFixed(1);
            const topStudent = validStudents[0];

            html += `<div class="class-avg-summary">
                <div class="stat-item">\u0645\u0639\u062f\u0644 \u0627\u0644\u0642\u0633\u0645: <span>${classAvg.toFixed(2)}</span></div>
                <div class="stat-item">\u0639\u062f\u062f \u0627\u0644\u0646\u0627\u062c\u062d\u064a\u0646: <span>${passCount}/${validStudents.length}</span></div>
                <div class="stat-item">\u0646\u0633\u0628\u0629 \u0627\u0644\u0646\u062c\u0627\u062d: <span>${passRate}%</span></div>
                <div class="stat-item">\u0627\u0644\u0623\u0648\u0644: <span>${topStudent.lastName} ${topStudent.firstName} (${topStudent.average.toFixed(2)})</span></div>
            </div>`;
        }

        html += `</div></div>`;
    });

    container.innerHTML = html || '<div class="no-data-msg">\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0644\u0644\u0639\u0631\u0636.</div>';
}

function updateExamAvgClassDropdown(allData, trimester, levelFilter) {
    const select = document.getElementById('examavgClassSelect');
    const currentVal = select.value;

    let relevantData = allData.filter(d => activityTrimesterMatches(d.trimester, trimester) && activityLevelMatches(d.level, levelFilter));

    const classes = new Set();
    relevantData.forEach(d => classes.add(d.class));
    const sorted = Array.from(classes).sort((a, b) => parseInt(a) - parseInt(b));

    select.innerHTML = '<option value="all">\u062c\u0645\u064a\u0639 \u0627\u0644\u0623\u0642\u0633\u0627\u0645</option>';
    sorted.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = '\u0627\u0644\u0642\u0633\u0645 ' + c;
        select.appendChild(opt);
    });

    if (sorted.includes(currentVal)) {
        select.value = currentVal;
    }
}

// Exam average filter event listeners
document.getElementById('examavgTrimesterSelect').addEventListener('change', renderExamAverage);
document.getElementById('examavgLevelSelect').addEventListener('change', renderExamAverage);
document.getElementById('examavgClassSelect').addEventListener('change', renderExamAverage);
document.getElementById('examavgYearSelect').addEventListener('change', async (e) => {
    document.getElementById('importYearSelect').value = e.target.value;
    document.getElementById('analysisYearSelect').value = e.target.value;
    renderExamAverage();
});
