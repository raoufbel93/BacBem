let selectedFiles = [];
let fileInfos = [];
let processedData = [];
let commonType = "";

function normalizeArabicForSubjectMatch(value) {
    if (!value) return "";
    return value.toString()
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ﻷ|ﻹ|ﻵ|ﻻ/g, 'لا')
        .replace(/لأ|لإ|لآ/g, 'لا')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function stripImportedSubjectTrimesterSuffix(subjectName) {
    if (!subjectName) return "";
    return subjectName.toString()
        .normalize('NFKC')
        .replace(/\s*(?:الفصل|ف)\s*[123]\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function detectImportedTrimesterSuffix(value) {
    if (!value) return '';

    const raw = value.toString()
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (/(?:^|\s)ف\s*1(?:\s|$)/i.test(raw) || /(?:^|\s)الفصل\s*1(?:\s|$)/i.test(raw) || /(?:^|\s)(?:اول|أول|الاول|الأول)(?:\s|$)/i.test(raw)) {
        return ' ف1';
    }
    if (/(?:^|\s)ف\s*2(?:\s|$)/i.test(raw) || /(?:^|\s)الفصل\s*2(?:\s|$)/i.test(raw) || /(?:^|\s)(?:ثان|الثاني|الثانى)(?:\s|$)/i.test(raw)) {
        return ' ف2';
    }
    if (/(?:^|\s)ف\s*3(?:\s|$)/i.test(raw) || /(?:^|\s)الفصل\s*3(?:\s|$)/i.test(raw) || /(?:^|\s)(?:ثالث|الثالث)(?:\s|$)/i.test(raw)) {
        return ' ف3';
    }

    return '';
}

function canonicalizeImportedSubjectName(subjectName, context = {}) {
    if (!subjectName) return "";

    const raw = subjectName.toString()
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const norm = normalizeArabicForSubjectMatch(raw);
    const trimesterSuffix = detectImportedTrimesterSuffix(raw);
    const withSuffix = (baseName) => `${stripImportedSubjectTrimesterSuffix(baseName)}${trimesterSuffix}`;
    const isSecondary = !!(context && (context.stream || context.stage === 'secondary'));

    if (isSecondary) {
        if ((norm.includes('اللغه العربيه') || norm.includes('ادابها')) && !norm.includes('الامازيغ')) return withSuffix('لغة عربية');
        if (norm.includes('اللغه الفرنسيه')) return withSuffix('لغة فرنسية');
        if (norm.includes('اللغه الانجليزيه')) return withSuffix('لغة انجليزية');
        if (norm.includes('الاجنبيه الثالثه') || norm.includes('لغه ثالثه') || norm.includes('المان') || norm.includes('اسبان') || norm.includes('ايطال')) return withSuffix('لغة ثالثة');
        if (norm.includes('الامازيغيه') || norm.includes('لغه امازيغيه')) return withSuffix('أمازيغية');
        if (norm.includes('الرياضيات')) return withSuffix('رياضيات');
        if (norm.includes('الفيزيائيه')) return withSuffix('علوم فيزيائية');
        if ((norm.includes('الطبيعه') || norm.includes('الطبيعيه')) && (norm.includes('الحياه') || norm.includes('علوم'))) return withSuffix('علوم طبيعية');
        if (norm.includes('التكنولوجيا')) return withSuffix('تكنولوجيا');
        if (norm.includes('الاسلاميه') || norm.includes('الاسلاميه') || norm.includes('العلوم الاسلاميه') || norm.includes('التربيه الاسلاميه')) return withSuffix('علوم اسلامية');
        if (norm.includes('التاريخ') || norm.includes('الجغرافيا')) return withSuffix('تاريخ وجغرافيا');
        if (norm.includes('المعلوماتيه') || norm.includes('اعلام')) return withSuffix('اعلام آلي');
        if (norm.includes('التشكيليه') || norm.includes('التربيه الفنيه') || norm.includes('فنون') || norm.includes('رسم')) return withSuffix('ت.تشكيلية');
        if (norm.includes('البدنيه') || norm.includes('الرياضيه') || norm.includes('رياضه') || norm.includes('eps') || norm.includes('sport')) return withSuffix('تربية بدنية');
        if (norm.includes('الفلسف')) return withSuffix('فلسفة');
        if (norm.includes('تسيير') || norm.includes('محاسب')) return withSuffix('تسيير محاسبي');
        if (norm.includes('اقتصاد') || norm.includes('مناجمنت')) return withSuffix('اقتصاد ومناجمنت');
        if (norm.includes('قانون')) return withSuffix('قانون');
        if (norm.includes('هندسه مدنيه')) return withSuffix('هندسة مدنية');
        if (norm.includes('هندسه ميكانيكي')) return withSuffix('هندسة ميكانيكية');
        if (norm.includes('هندسه كهربائي')) return withSuffix('هندسة كهربائية');
        if (norm.includes('هندسه طرائق')) return withSuffix('هندسة طرائق');
        if (norm.includes('الموسيقيه') || norm.includes('موسيقي')) return withSuffix('موسيقى');
    }

    if (norm.includes('اللغه العربيه')) return withSuffix('اللغة العربية');
    if (norm.includes('الامازيغيه') || norm.includes('لغه امازيغيه')) return withSuffix('اللغة الأمازيغية');
    if (norm.includes('اللغه الفرنسيه')) return withSuffix('اللغة الفرنسية');
    if (norm.includes('اللغه الانجليزيه')) return withSuffix('اللغة الإنجليزية');
    if (norm.includes('التربيه الاسلاميه')) return withSuffix('التربية الإسلامية');
    if (norm.includes('التربيه المدنيه')) return withSuffix('التربية المدنية');
    if (norm.includes('التاريخ') || norm.includes('الجغرافيا')) return withSuffix('التاريخ والجغرافيا');
    if (norm.includes('الرياضيات')) return withSuffix('الرياضيات');
    if (norm.includes('الطبيعه') && norm.includes('الحياه')) return withSuffix('ع الطبيعة و الحياة');
    if (norm.includes('الفيزيائيه') || norm.includes('التكنولوجيا')) return withSuffix('ع الفيزيائية والتكنولوجيا');
    if (norm.includes('المعلوماتيه') || norm.includes('اعلام')) return withSuffix('المعلوماتية');
    if (norm.includes('التشكيليه') || norm.includes('فنون') || norm.includes('رسم')) return withSuffix('التربية التشكيلية');
    if (norm.includes('الموسيقيه') || norm.includes('موسيقي')) return withSuffix('التربية الموسيقية');
    if (norm.includes('البدنيه') || norm.includes('الرياضيه') || norm.includes('رياضه')) return withSuffix('ت البدنية و الرياضية');

    return trimesterSuffix
        ? `${stripImportedSubjectTrimesterSuffix(raw)}${trimesterSuffix}`
        : raw;
}

function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    // Append new files, checking for duplicates
    for (const file of files) {
        const isDuplicate = selectedFiles.some(f => f.name === file.name && f.size === file.size);
        if (!isDuplicate) {
            selectedFiles.push(file);
        }
    }

    // Reset file input so same file can be selected again if removed
    event.target.value = '';

    renderSelectedFiles();

    // Reset state
    document.getElementById('statusBox').style.display = 'none';
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressBar').style.display = 'none';
}

function renderSelectedFiles() {
    const container = document.getElementById('fileListContainer');
    const actions = document.getElementById('importActions');

    if (!container) return;

    if (selectedFiles.length === 0) {
        container.style.display = 'none';
        if (actions) actions.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    if (actions) actions.style.display = 'flex';

    container.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #ddd; display: flex; align-items: center; justify-content: space-between;">
            <div>
                <span data-icon="file-excel"></span> الملفات المختار:
                <span class="file-count-badge">${selectedFiles.length}</span>
            </div>
            <div style="font-size: 0.85rem; color: #27ae60; background: #e8f6ef; padding: 2px 10px; border-radius: 12px;">
                 يمكنك تحديد ملف آخر <span data-icon="plus-circle"></span>
            </div>
        </div>
    `;

    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item animate-fade-in';
        item.innerHTML = `
            <div class="file-info">
                <span data-icon="file-excel" style="color: #27ae60;"></span>
                <span>${file.name}</span>
                <small style="color: #95a5a6;">(${(file.size / 1024).toFixed(1)} KB)</small>
            </div>
            <div class="file-remove-btn" onclick="removeFile(${index})" title="إزالة">
                <span data-icon="times"></span>
            </div>
        `;
        container.appendChild(item);
    });

    // Re-render icons
    if (window.IconManager) IconManager.render();
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderSelectedFiles();
    log(`تم إزالة الملف. عدد الملفات الحالية: ${selectedFiles.length}`);
}

async function processFiles(mode = 'update') {
    let confirmTitle = "تحديث البيانات";
    let confirmMsg = "هل أنت متأكد من رغبتك في تحديث قاعدة البيانات بالملفات المختارة؟";
    let confirmSmall = "سيتم إضافة أو تحديث بيانات الأقسام المحددة فقط. لن يتم حذف الأقسام الأخرى.";
    let confirmIcon = "sync-alt";

    if (mode === 'replace') {
        confirmTitle = "حذف واستبدال الكل";
        confirmMsg = "هل أنت متأكد من رغبتك في حذف جميع النتائج السابقة واستبدالها بهذه الملفات؟";
        confirmSmall = "تحذير: هذا الإجراء سيقوم بمسح كلي لكافة النتائج المخزنة مسبقاً في قاعدة البيانات.";
        confirmIcon = "trash-alt";
    }

    const confirmed = await showConfirmModal(confirmTitle, confirmMsg, confirmSmall, confirmIcon);
    if (!confirmed) return;

    const btnReplace = document.getElementById('btnReplace');
    const btnUpdate = document.getElementById('btnUpdate');

    if (btnReplace) btnReplace.disabled = true;
    if (btnUpdate) btnUpdate.disabled = true;

    document.getElementById('progressBar').style.display = 'block';
    log("بدء المعالجة...");

    const settings = await DB.getSettings() || {};
    const fallbackYear = settings.currentAcademicYear || DB.getCurrentAcademicYear();

    fileInfos = [];
    processedData = [];

    let validCount = 0;
    const totalFiles = selectedFiles.length;

    // 1. Validation Phase
    for (let i = 0; i < totalFiles; i++) {
        updateProgress((i + 1) / totalFiles * 30); // First 30% for validation
        const file = selectedFiles[i];

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]]; // First sheet

            // Dynamic Header Detection
            let headerRowIndex = -1;
            let titleText = "";
            let fullHeaderText = ""; // Combine all header lines for robust scanning

            // Scan first 10 rows for Title and Header
            for (let r = 0; r < 10; r++) {
                const row = XLSX.utils.sheet_to_json(sheet, { header: 1, range: r, limit: 1 })[0];
                if (!row) continue;
                const rowStr = row.join(" ").trim();

                // Catch Header Row FIRST before appending to fullHeaderText
                if (row.some(c => c && (c.toString().includes("اللقب") || c.toString().includes("الاسم") || c.toString().includes("اسم")))) {
                    headerRowIndex = r;
                    break;
                }

                fullHeaderText += rowStr + " ";

                // Catch Title (usually contains year/level)
                if (rowStr.includes("الجمهورية") || rowStr.includes("تحليل") || rowStr.includes("قائمة") || rowStr.includes("السنة")) {
                    if (rowStr.length > titleText.length) titleText = rowStr;
                }
            }

            if (headerRowIndex === -1) {
                log(`خطأ: لم يتم العثور على سطر العناوين في الملف ${file.name}`, 'error');
                continue;
            }

            // Extract Stream from entire Header Context
            let stream = normalizeStream(fullHeaderText);

            // Extract Level/Section from entire Header Context if possible
            // Improved Regex Logic for Level
            let level = "";
            let section = "";

            if (fullHeaderText) {
                const text = fullHeaderText; // Use full text for regex
                // Regex for Levels 1, 2, 3, 4 (Middle/High)
                const levelPatterns = [

                    // Explicit "Common Trunk" -> Level 1
                    { r: /جذع\s*مشترك/i, v: '1' },

                    // Explicit "Year X"
                    { r: /(?:السنة|سنة|مستوى|Level)\s*[:\-]?\s*(?:ال)?(أولى|اولى|1)/i, v: '1' },
                    { r: /(?:السنة|سنة|مستوى|Level)\s*[:\-]?\s*(?:ال)?(ثانية|ثانيه|2)/i, v: '2' },
                    { r: /(?:السنة|سنة|مستوى|Level)\s*[:\-]?\s*(?:ال)?(ثالثة|ثالثه|3)/i, v: '3' },
                    { r: /(?:السنة|سنة|مستوى|Level)\s*[:\-]?\s*(?:ال)?(رابعة|رابعه|4)/i, v: '4' },

                    // Explicit "X Secondary/Middle" (Word)
                    { r: /(?:ال)?(أولى|اولى)\s*(?:ثانوي|ث|متوسط|م|AS|AM)/i, v: '1' },
                    { r: /(?:ال)?(ثانية|ثانيه)\s*(?:ثانوي|ث|متوسط|م|AS|AM)/i, v: '2' },
                    { r: /(?:ال)?(ثالثة|ثالثه)\s*(?:ثانوي|ث|متوسط|م|AS|AM)/i, v: '3' },
                    { r: /(?:ال)?(رابعة|رابعه)\s*(?:ثانوي|ث|متوسط|م|AS|AM)/i, v: '4' },

                    // Explicit "X Secondary/Middle" (Digit)
                    { r: /\b1\s*(?:AS|متوسط|م|ثانوي|ث)\b/i, v: '1' },
                    { r: /\b2\s*(?:AS|متوسط|م|ثانوي|ث)\b/i, v: '2' },
                    { r: /\b3\s*(?:AS|متوسط|م|ثانوي|ث)\b/i, v: '3' },
                    { r: /\b4\s*(?:AM|متوسط|م)\b/i, v: '4' }
                ];

                for (const p of levelPatterns) {
                    if (p.r.test(titleText)) {
                        level = p.v;
                        break;
                    }
                }

                // Try to split section? often "01" or "02" at end
                // Look for "فوج" or "قسم" or just last number
                const sectionMatch = fullHeaderText.match(/(?:فوج|قسم|Group|Section)\s*[:\-]?\s*(\d+)/i);
                if (sectionMatch) {
                    section = normalizeSection(sectionMatch[1]);
                } else {
                    const parts = titleText.split(/[\s\-]+/); // Use titleText for the "last word" fallback to avoid picking up a random number from full header
                    const last = parts[parts.length - 1];
                    if (isNumeric(last) && last.length <= 2) section = normalizeSection(last);
                    else {
                        // Special fallback: Look for "م ع" or "ع ت" followed by number in full text (e.g. "2 ع ت 1")
                        const shortMatch = fullHeaderText.match(/(?:ع|آ|ت|م|ر)\s*[ا-ي]?\s*(?:ت|ف|ل|ق|م|ط)?\s*(\d{1,2})\b/);
                        if (shortMatch) section = normalizeSection(shortMatch[1]);
                        else section = "1"; // default
                    }
                }
            }

            // Fallback to A5 logic if still empty (legacy support)
            if (!level) {
                const cellA5 = sheet['A5'] ? sheet['A5'].v : "";
                const words = cellA5.toString().trim().split(/\s+/);
                // Try regex on A5 too
                const a5Text = cellA5.toString();
                if (/(?:ال)?(?:أولى|اولى)/.test(a5Text) || /\b1\b/.test(a5Text)) level = "1";
                else if (/(?:ال)?(?:ثانية|ثانيه)/.test(a5Text) || /\b2\b/.test(a5Text)) level = "2";
                else if (/(?:ال)?(?:ثالثة|ثالثه)/.test(a5Text) || /\b3\b/.test(a5Text)) level = "3";
                else if (/(?:ال)?(?:رابعة|رابعه)/.test(a5Text) || /\b4\b/.test(a5Text)) level = "4";

                // Fallback Section Logic - Validate Numeric
                if (words.length > 7) {
                    const candidate = words[7];
                    // Only accept if short and numeric (e.g., "1", "01", "2")
                    if (isNumeric(candidate) && candidate.length <= 3) {
                        section = normalizeSection(candidate);
                    }
                }
            }

            // Enhanced Trimester Detection
            let type = "";
            const textCheck = fullHeaderText || (sheet['A5'] ? sheet['A5'].v : "");

            if (textCheck.includes("الفصل الثاني") || textCheck.includes("الفصل الثانى")) type = "الثاني";
            else if (textCheck.includes("الفصل الثالث")) type = "الثالث";
            else if (textCheck.includes("الفصل الأول") || textCheck.includes("الفصل الاول")) type = "الأول";
            // French Trimesters
            else if (textCheck.match(/(?:Trimester|Trimestre)\s*2/i) || textCheck.match(/2(?:eme|ème|nd)\s*(?:Trimester|Trimestre)/i)) type = "الثاني";
            else if (textCheck.match(/(?:Trimester|Trimestre)\s*3/i) || textCheck.match(/3(?:eme|ème|rd)\s*(?:Trimester|Trimestre)/i)) type = "الثالث";
            else if (textCheck.match(/(?:Trimester|Trimestre)\s*1/i) || textCheck.match(/1(?:er|ere)\s*(?:Trimester|Trimestre)/i)) type = "الأول";

            // Extract academic year from title text (e.g. "2023-2024" or "2023/2024")
            const fileAcademicYear = extractAcademicYear(fullHeaderText) || fallbackYear;
            log(`الملف ${file.name}: السنة الدراسية المستخرجة: ${fileAcademicYear}`);

            fileInfos.push({
                file: file,
                fileName: file.name,
                type: type,
                level: level,
                section: section,
                stream: stream, // Add Stream
                sheet: sheet,
                headerIdx: headerRowIndex, // Store detected header index
                academicYear: fileAcademicYear // Academic year from file
            });

            validCount++;

        } catch (error) {
            log(`خطأ في قراءة الملف ${file.name}: ${error.message}`, 'error');
        }
    }

    if (validCount === 0 && (btnReplace || btnUpdate)) {
        showStatus("لم يتم العثور على ملفات صالحة.", 'error');
        if (btnReplace) btnReplace.disabled = false;
        if (btnUpdate) btnUpdate.disabled = false;
        return;
    }

    // 2. Sorting Phase
    fileInfos.sort((a, b) => {
        if (a.level > b.level) return 1;
        if (a.level < b.level) return -1;
        if (a.section > b.section) return 1;
        if (a.section < b.section) return -1;
        return 0;
    });

    log(`تم التحقق من ${validCount} ملف صالح.`);

    // 1. Identification Phase: Get Unique Classes to be updated
    const affectedClasses = new Set();
    fileInfos.forEach(info => {
        const classKey = `${info.level}_${info.stream || ''}_${info.section}_${info.academicYear}`;
        affectedClasses.add(classKey);
    });

    let resultsToKeep = [];
    let existingResults = [];
    let affectedExistingResults = [];
    if (mode === 'replace') {
        log("وضع الحماية: سيتم حذف كافة البيانات السابقة قبل الاستيراد الجديد.", 'warning');
    } else {
        log(`جاري تجهيز دمج آمن لبيانات ${affectedClasses.size} قسم/سنة دراسية من قاعدة البيانات...`, 'warning');
        existingResults = await DB.getResults(true) || [];

        resultsToKeep = existingResults.filter(student => {
            const studentClassKey = `${student.level}_${student.stream || ''}_${normalizeSection(student.class)}_${student.academic_year || fallbackYear}`;
            return !affectedClasses.has(studentClassKey);
        });

        affectedExistingResults = existingResults.filter(student => {
            const studentClassKey = `${student.level}_${student.stream || ''}_${normalizeSection(student.class)}_${student.academic_year || fallbackYear}`;
            return affectedClasses.has(studentClassKey);
        });

        affectedClasses.forEach(key => {
            const parts = key.split('_');
            const levelStr = parts[0];
            const streamStr = parts[1] ? ` (${parts[1]}) ` : ' ';
            const sectionStr = parts[2];
            log(`- سيتم دمج النتائج الجديدة مع السجلات السابقة للقسم: ${levelStr}${streamStr}${sectionStr}`, 'info');
        });
        log(`اكتمل تجهيز الدمج الآمن للأقسام المعنية. جاري البدء في الاستيراد...`);
    }

    // 2. Import Phase
    let totalImportedRows = 0;
    const currentImportMap = new Map(); // Key: studentId_level_section -> student object (for merging multi-file data)

    for (let i = 0; i < fileInfos.length; i++) {
        updateProgress(30 + ((i + 1) / fileInfos.length * 60));

        const info = fileInfos[i];
        const sheet = info.sheet;
        const hIdx = info.headerIdx;

        const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1, range: hIdx, limit: 1 })[0];
        const subHeaderRow = XLSX.utils.sheet_to_json(sheet, { header: 1, range: hIdx + 1, limit: 1 })[0];

        const subjectIndices = [];
        if (headerRow) {
            let currentSubject = "";
            headerRow.forEach((val, idx) => {
                const cellVal = val ? val.toString().trim() : "";
                // Refined Logic: Exclude only Global/Trimester Averages, but ALLOW Subject Averages (e.g., "Math Average")
                const isGeneralAverage = cellVal.includes("معدل فصلي") || cellVal.includes("معدل الفصل") || cellVal.includes("معدل الثلاثي") ||
                    cellVal.includes("معدل عام") || cellVal.includes("معدل سنوي") ||
                    cellVal.includes("معدل شهادة") || cellVal.includes("معدل ت.") || cellVal === "معدل" || cellVal === "المعدل" ||
                    cellVal === "Moyenne" || cellVal === "Moyenne Gen" || cellVal === "Moyenne Trim" || cellVal === "Moyenne Trimestre" ||
                    cellVal === "Moyenne Annuelle" || cellVal === "Resultat";

                if (idx >= 5 && cellVal.length > 0 && !isGeneralAverage && !cellVal.includes("قرار") && !cellVal.includes("رقم")) {
                    currentSubject = canonicalizeImportedSubjectName(cellVal, info);
                    let finalSubjectName = currentSubject;
                    if (info.type === "الأول" && !finalSubjectName.match(/ف\s*[123]/)) {
                        finalSubjectName = finalSubjectName + " ف1";
                    }
                    
                    const baseCurrentSubject = stripImportedSubjectTrimesterSuffix(currentSubject);
                    let foundAny = false;

                    if (subHeaderRow) {
                        for (let j = idx; j < idx + 5; j++) {
                            const subH = subHeaderRow[j] ? subHeaderRow[j].toString().trim() : "";
                            // Check if it's an average column
                            if ((subH.includes("معدل") || subH.includes("م.") || subH.includes("نتائج") || subH.includes("نقاط") || subH.includes("فصل")) && !subH.includes("سنوي")) {

                                let suffix = "";
                                if (subH.includes("1") || subH.includes("أول") || subH.includes("اول")) suffix = " ف1";
                                else if (subH.includes("2") || subH.includes("ثان")) suffix = " ف2";
                                else if (subH.includes("3") || subH.includes("ثالث")) suffix = " ف3";

                                // If it has a specific suffix, add it.
                                if (suffix) {
                                    subjectIndices.push({ index: j, name: `${baseCurrentSubject}${suffix}` });
                                    foundAny = true;
                                }
                            }
                        }
                    }

                    if (!foundAny && subHeaderRow) {
                        for (let j = idx; j < idx + 5; j++) {
                            const subH = subHeaderRow[j] ? subHeaderRow[j].toString().trim() : "";
                            if ((subH.includes("معدل") || subH.includes("م.") || subH.includes("نتائج") || subH.includes("نقاط") || subH.includes("فصل")) && !subH.includes("سنوي")) {
                                subjectIndices.push({ index: j, name: finalSubjectName });
                                foundAny = true;
                                break; // Take the first generic Moy we find
                            }
                        }
                    }

                    // Absolute fallback: Just point to the header index itself
                    if (!foundAny) {
                        subjectIndices.push({ index: idx, name: finalSubjectName });
                    }
                }
            });
        }

        // Read Rows starting after header
        const rowsRaw = XLSX.utils.sheet_to_json(sheet, { header: 1, range: hIdx + 1 });
        const rows = rowsRaw.filter(r => r[0] && (typeof r[0] === 'number' || !isNaN(r[0])));
        const hasNaNRows = rowsRaw.some(r => Array.isArray(r) && r.some(cell => typeof cell === 'string' && cell.trim().toUpperCase() === 'NAN'));

        if (rows.length === 0 && !hasNaNRows) {
            log(`لم يتم العثور على بيانات تلاميذ في ${info.fileName}`, 'error');
            continue;
        }

        if (rows.length === 0 && hasNaNRows) {
            log(`خطأ: الملف ${info.fileName} يحتوي على قيم NaN بدل بيانات التلاميذ. يبدو أن الملف نفسه غير صالح أو لم تُحسب صِيَغه بشكل صحيح. يرجى إعادة تصديره من المصدر ثم محاولة الاستيراد من جديد.`, 'error');
            continue;
        }

        let genderIndex = 3;
        let repeatIndex = -1;
        let genderFound = false;

        // Scan for Gender and Repeater columns
        const validRowsForScan = rows.slice(0, 5);
        for (const r of validRowsForScan) {
            for (let c = 0; c < r.length; c++) {
                const val = r[c];
                if (typeof val === 'string') {
                    const txt = val.trim();
                    if (!genderFound && (txt === "ذكر" || txt === "أنثى" || txt === "ذ" || txt === "ث")) {
                        genderIndex = c;
                        genderFound = true;
                    }
                    if (repeatIndex === -1 && (txt === "نعم" || txt === "لا") && headerRow[c] && (headerRow[c].toString().includes("إعادة") || headerRow[c].toString().includes("معيد"))) {
                        repeatIndex = c;
                    }
                }
            }
        }

        // Fallback for Repeat Index if not found in first rows data but scan header again
        if (repeatIndex === -1 && headerRow) {
            repeatIndex = headerRow.findIndex(h => h && (h.toString().includes("إعادة") || h.toString().includes("معيد")));
        }

        // Parse mark helper - handles 'غ م' (absent) as 0
        const parseMark = (v) => {
            if (typeof v === 'number') return v;
            if (!v) return null;
            const strVal = v.toString().trim();
            if (strVal === 'غ م' || strVal === 'غم' || strVal === 'غ' || strVal.includes('غ')) return 0;
            const p = parseFloat(strVal.replace(',', '.'));
            return isNaN(p) ? null : p;
        };

        rows.forEach(row => {
            const learnedMarks = {};
            subjectIndices.forEach(sub => {
                let val = row[sub.index];
                val = parseMark(val);
                if (val !== undefined && val !== null && !isNaN(val)) learnedMarks[sub.name] = val;
            });

            let gender = row[genderIndex];
            if (gender) {
                gender = String(gender).trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
                if (gender.startsWith('ذ') || gender.toLowerCase().startsWith('m') || gender == '1') gender = 'ذكر';
                else if (gender.startsWith('ث') || gender.startsWith('أ') || gender.startsWith('ا') || gender.toLowerCase().startsWith('f') || gender == '2' || gender == '0') gender = 'أنثى';
                else gender = 'غير محدد';
            } else {
                gender = 'غير محدد';
            }

            const isRepeater = repeatIndex !== -1 ? (row[repeatIndex] === "نعم") : false;

            const student = {
                id: row[0],
                name: row[1],
                dob: formatDate(row[2]),
                pob: row[4],
                gender: gender,
                isRepeater: isRepeater, // Added
                marks: learnedMarks,
                level: info.level,
                class: info.section,
                trimester: info.type,
                stream: info.stream, // Save Stream
                academic_year: info.academicYear, // Save Academic Year (extracted from file)
                decision: "-",
                average: 0,
                averages: {}
            };

            const colMap = { 1: -1, 2: -1, 3: -1 };
            if (headerRow) {
                headerRow.forEach((h, idx) => {
                    const txt = h.toString().trim().toLowerCase();
                    const isAve = txt.includes('معدل') || txt.includes('م.') || txt.includes('moy') || txt.includes('average') || txt.includes('نتائج');

                    if (isAve) {
                        if (txt.includes('1') || txt.includes('ف1') || txt.includes('أول') || txt.includes('اول')) colMap[1] = idx;
                        else if (txt.includes('2') || txt.includes('ف2') || txt.includes('ثاني') || txt.includes('ثان')) colMap[2] = idx;
                        else if (txt.includes('3') || txt.includes('ف3') || txt.includes('ثالث')) colMap[3] = idx;
                    }
                });
            }

            // Track if the original average was 'غ م' (absent marker) - don't recalculate in that case
            let avgWasAbsent = false;
            const avgCol = info.type === "الأول" ? colMap[1] : (info.type === "الثاني" ? colMap[2] : colMap[3]);
            if (avgCol !== -1) {
                const rawAvg = row[avgCol];
                if (rawAvg && typeof rawAvg === 'string' && rawAvg.toString().includes('غ')) {
                    avgWasAbsent = true;
                }
            }

            if (colMap[1] !== -1) student.averages['1'] = parseMark(row[colMap[1]]) || 0;
            if (colMap[2] !== -1) student.averages['2'] = parseMark(row[colMap[2]]) || 0;
            if (colMap[3] !== -1) student.averages['3'] = parseMark(row[colMap[3]]) || 0;

            if (info.type === "الأول") student.average = student.averages['1'] || 0;
            else if (info.type === "الثاني") student.average = student.averages['2'] || 0;
            else if (info.type === "الثالث") student.average = student.averages['3'] || 0;

            // Only recalculate average from subject marks if it wasn't explicitly marked as absent
            if (!avgWasAbsent && (student.average === 0 || student.average === null) && Object.keys(student.marks).length > 0) {
                const markValues = Object.values(student.marks).filter(v => v !== null);
                if (markValues.length > 0) {
                    const sSum = markValues.reduce((a, b) => a + b, 0);
                    student.average = parseFloat((sSum / markValues.length).toFixed(2));
                }
            }

            if (info.type === "الثالث") {
                const decIdx = headerRow.findIndex(h => h && h.toString().includes("قرارات"));
                if (decIdx !== -1) student.decision = row[decIdx] || "-";
            }

            normalizeStoredStudentMarks(student);

            // 4. Merge Logic within this session (Handle Multi-File same Class)
            const studentKey = getStudentKey(student);
            const existingInSession = currentImportMap.get(studentKey);

            if (existingInSession) {
                // Merge student data
                Object.assign(existingInSession.marks, student.marks);
                normalizeStoredStudentMarks(existingInSession);
                Object.assign(existingInSession.averages, student.averages);
                // Update specific trimester average/decision if this file has more info
                if (student.average > 0) existingInSession.average = student.average;
                if (student.decision !== "-") existingInSession.decision = student.decision;
                
                // Promote the trimester if the new one is higher
                const trimesters = ["الأول", "الثاني", "الثالث"];
                if (trimesters.indexOf(student.trimester) > trimesters.indexOf(existingInSession.trimester)) {
                    existingInSession.trimester = student.trimester;
                }
            } else {
                currentImportMap.set(studentKey, student);
            }

            totalImportedRows++;
        });
    }

    // Convert map to array of unique students for THIS session
    const sessionStudents = Array.from(currentImportMap.values());

    let finalResults = [];
    if (mode === 'replace') {
        log(`جاري حفظ البيانات الجديدة (تم استبدال الكل)...`);
        finalResults = sessionStudents;
    } else {
        // Safe selective update: preserve previous trimesters for the same class/year
        log(`جاري دمج البيانات الجديدة مع قاعدة البيانات دون حذف الفصول السابقة...`);
        finalResults = resultsToKeep.concat(affectedExistingResults, sessionStudents);
    }

    // CRITICAL: Global Deduplication to fix any existing database inconsistencies
    log("جاري إجراء التدقيق النهائي لمنع التكرار...");
    const globalDedupeMap = new Map();
    for (const s of finalResults) {
        normalizeStoredStudentMarks(s);
        const key = getStudentKey(s);
        if (globalDedupeMap.has(key)) {
            const existing = globalDedupeMap.get(key);
            Object.assign(existing.marks, s.marks);
            normalizeStoredStudentMarks(existing);
            Object.assign(existing.averages, s.averages);
            if (s.average > 0) existing.average = s.average;
            if (s.decision !== "-") existing.decision = s.decision;
            // Merge repeat status if either record is marked
            if (s.isRepeater) existing.isRepeater = true;
            // Promote the trimester if the new one is higher
            const trimesters = ["الأول", "الثاني", "الثالث"];
            if (trimesters.indexOf(s.trimester) > trimesters.indexOf(existing.trimester)) {
                existing.trimester = s.trimester;
            }
        } else {
            globalDedupeMap.set(key, s);
        }
    }

    const cleanedFinalResults = Array.from(globalDedupeMap.values());

    if (mode === 'replace') {
        // In replace mode, bypass saveResults (which merges by year) and directly overwrite ALL results
        await DB.set('schoolResults', cleanedFinalResults);
        await DB.set('lastUpdate', new Date().toLocaleString());
    } else {
        try {
            await window.ipcRenderer.invoke('db-set', 'temp_debug_log_lengths', JSON.stringify({ existingLength: existingResults.length, cleanedLength: cleanedFinalResults.length }));

            const grouped = {};
            for (const s of cleanedFinalResults) {
                const k = `${s.level}_${s.stream}`;
                grouped[k] = (grouped[k] || 0) + 1;
            }
            await window.ipcRenderer.invoke('db-set', 'temp_debug_log_streams', JSON.stringify(grouped));
        } catch(e) {}

        // CleanedFinalResults now has all years. DB.set avoids duplicates caused by saveResults
        await DB.set('schoolResults', cleanedFinalResults);
        await DB.set('lastUpdate', new Date().toLocaleString());
    }

    updateProgress(100);

    // Clear selection after success
    selectedFiles = [];
    renderSelectedFiles();

    await showSuccessModal(`تم بنجاح تحديث البيانات.\nاستيراد ${totalImportedRows} ملفات (أقسام).\nالطلاب الجدد/المحدثون: ${sessionStudents.length}\nإجمالي السجلات الفريدة المخزنة: ${cleanedFinalResults.length}`);

    if (btnReplace) { btnReplace.disabled = false; }
    if (btnUpdate) { btnUpdate.disabled = false; }
}

function formatDate(excelDate) {
    if (!excelDate) return "";
    if (typeof excelDate === 'number') {
        const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }
    return excelDate;
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
    log(msg);
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

// Custom Confirmation Modal Logic
function showConfirmModal(title, message, smallText, icon = "recycle") {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const btnConfirm = document.getElementById('modalConfirm');
        const btnCancel = document.getElementById('modalCancel');

        // Update modal content
        if (title) modal.querySelector('.modal-title').innerText = title;
        if (message) {
            modal.querySelector('.modal-message').innerHTML = `${message}<br><small style="color:${title.includes('حذف') ? '#e74c3c' : '#27ae60'};">${smallText}</small>`;
        }
        if (icon) modal.querySelector('.modal-icon span').setAttribute('data-icon', icon);

        // Re-run icon manager if available to render new icons
        if (window.IconManager) IconManager.render();

        modal.classList.add('active');

        const cleanup = () => {
            modal.classList.remove('active');
            btnConfirm.onclick = null;
            btnCancel.onclick = null;
        };

        btnConfirm.onclick = () => {
            cleanup();
            resolve(true);
        };

        btnCancel.onclick = () => {
            cleanup();
            resolve(false);
        };

        // Close on clicking overlay
        modal.onclick = (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(false);
            }
        };
    });
}

function showSuccessModal(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('successModal');
        const msgEl = document.getElementById('successMessage');
        const btnOk = document.getElementById('modalSuccessOk');

        if (message) msgEl.innerText = message;

        modal.classList.add('active');

        const cleanup = () => {
            modal.classList.remove('active');
            btnOk.onclick = null;
        };

        btnOk.onclick = () => {
            cleanup();
            resolve(true);
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(true);
            }
        };
    });
}

/**
 * Extract academic year from title text (e.g. "2023-2024" or "2023/2024")
 * Returns in the app's format: "YEAR+1/YEAR" (e.g. "2024/2023")
 */
function extractAcademicYear(text) {
    if (!text) return null;
    // Match patterns like 2023-2024, 2023/2024, 2024-2025
    const match = text.match(/(\d{4})[\-\/](\d{4})/);
    if (match) {
        const y1 = parseInt(match[1]);
        const y2 = parseInt(match[2]);
        // Return in app format: bigger/smaller (e.g. 2024/2023)
        const bigger = Math.max(y1, y2);
        const smaller = Math.min(y1, y2);
        return bigger + "/" + smaller;
    }
    return null;
}

function normalizeStream(val) {
    if (!val) return "";
    const s = val.toString().trim();

    // Exact Matches First (Codes)
    if (['science', 'math', 'tech_math', 'management', 'languages', 'arts', 'common_science', 'common_arts'].includes(s)) return s;

    // Common Trunk (Jada3 Moshtarak)
    if (s.includes("مشترك") || s.includes("جذع")) {
        if (s.includes("علوم") || s.includes("تكنولوجيا")) return "common_science";
        if (s.includes("آداب")) return "common_arts";
    }

    // Specific Streams (2nd & 3rd Year) - Use exact compound phrases to prioritize over partials
    if (s.includes("علوم تجريبية") || s.includes("علوم طبيعية") || s.includes("ع ت") || s.includes("ع.ت")) return "science";
    if (s.includes("آداب وفلسفة") || s.includes("آداب و فلسفة") || s.includes("اداب وفلسفة") || s.includes("ا ف") || s.includes("أ ف")) return "arts";
    if (s.includes("لغات أجنبية") || s.includes("لغات اجنبية") || s.includes("ل أ") || s.includes("ل.أ")) return "languages";
    if (s.includes("تسيير واقتصاد") || s.includes("تسيير و اقتصاد") || s.includes("ت ا") || s.includes("ت.ا")) return "management";
    if (s.includes("تقني رياضي") || s.includes("ت ر") || s.includes("ت.ر") || s.includes("هندسة")) return "tech_math";
    if (s.includes("رياضيات") || s.includes("ر م") || s.includes("ر.م")) return "math";

    // Loose matching fallback for short forms
    if (s.includes("علمي") || s.includes("علوم") || s.includes("علمية")) return "science";
    if (s.includes("أدبي") || s.includes("آداب") || s.includes("اداب") || s.includes("فلسفة")) return "arts";
    if (s.includes("لغات")) return "languages";
    if (s.includes("تقني")) return "tech_math";

    return "";
}

function isNumeric(str) {
    if (typeof str != "string") return false;
    return !isNaN(str) && !isNaN(parseFloat(str));
}

function normalizeSection(val) {
    if (!val) return "1";
    let s = val.toString().trim();
    // Remove leading zeros (e.g., "01" -> "1", "02" -> "2")
    return s.replace(/^0+/, '') || "1";
}

function normalizeStoredStudentMarks(student) {
    if (!student || !student.marks || typeof student.marks !== 'object') return student;

    const normalizedMarks = {};
    const canonicalContext = {
        stream: student.stream || '',
        stage: student.stream ? 'secondary' : ''
    };

    Object.keys(student.marks).forEach(rawKey => {
        const value = student.marks[rawKey];
        if (value === undefined || value === null || value === '') return;

        const canonicalKey = canonicalizeImportedSubjectName(rawKey, canonicalContext) || rawKey;
        normalizedMarks[canonicalKey] = value;
    });

    student.marks = normalizedMarks;
    return student;
}

/**
 * Robust identity key to match students across files and database
 */
function getStudentKey(student) {
    const cleanStr = (s) => normalizeArabicForSubjectMatch(s || '').replace(/\s+/g, '');
    const normName = cleanStr(student.name);
    const normDob = (student.dob || '').toString().trim().split('T')[0];
    const normClass = normalizeSection(student.class);
    const normLevel = cleanStr(student.level);
    const normStream = cleanStr(student.stream);
    const academicYear = student.academic_year || '';

    return `${normName}|${normDob}|${normClass}|${normLevel}|${normStream}|${academicYear}`;
}

/**
 * Delete all results from the database (without importing new files)
 */
async function deleteAllResults() {
    const confirmed = await showDeleteAllModal();
    if (!confirmed) return;

    const btn = document.getElementById('btnDeleteAll');
    if (btn) btn.disabled = true;

    log("جاري حذف جميع النتائج من قاعدة البيانات...", 'warning');

    try {
        const keysToClear = [
            'schoolResults',
            'secondaryRemedialSubjectOverrides',
            'annualResults',
            'certificateResults',
            'finalResultsData',
            'finalResults',
            'lastUpdate'
        ];

        const failedKeys = [];
        for (const key of keysToClear) {
            const result = await DB.remove(key);
            if (result === false) {
                failedKeys.push(key);
            }
        }

        const [remainingResults, remainingAnnualResults, remainingCertificateResults, remainingFinalResultsData] = await Promise.all([
            DB.getResults(true),
            DB.getAnnualResults(true),
            DB.get('certificateResults'),
            DB.get('finalResultsData')
        ]);

        const hasRemainingResults = Array.isArray(remainingResults) && remainingResults.length > 0;
        const hasRemainingAnnualResults = Array.isArray(remainingAnnualResults) && remainingAnnualResults.length > 0;
        const hasRemainingCertificateResults = Array.isArray(remainingCertificateResults) && remainingCertificateResults.length > 0;
        const hasRemainingFinalResultsData =
            Array.isArray(remainingFinalResultsData) ? remainingFinalResultsData.length > 0 :
                !!(remainingFinalResultsData && Array.isArray(remainingFinalResultsData.students) && remainingFinalResultsData.students.length > 0);

        if (failedKeys.length > 0 || hasRemainingResults || hasRemainingAnnualResults || hasRemainingCertificateResults || hasRemainingFinalResultsData) {
            throw new Error('تعذر حذف جميع بيانات النتائج بشكل كامل.');
        }

        log("✅ تم حذف جميع النتائج والبيانات المرتبطة بها بنجاح.", 'info');
        await showSuccessModal("تم حذف جميع النتائج المخزنة في قاعدة البيانات والبيانات المرتبطة بها بنجاح.");
    } catch (error) {
        log("❌ خطأ أثناء حذف النتائج: " + error.message, 'error');
        showStatus("حدث خطأ أثناء محاولة حذف النتائج. يرجى إعادة المحاولة.", 'error');
    }

    if (btn) btn.disabled = false;
}

/**
 * Show delete all confirmation modal
 */
function showDeleteAllModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('deleteAllModal');
        const btnConfirm = document.getElementById('deleteAllConfirm');
        const btnCancel = document.getElementById('deleteAllCancel');

        if (window.IconManager) IconManager.render();

        modal.classList.add('active');

        const cleanup = () => {
            modal.classList.remove('active');
            btnConfirm.onclick = null;
            btnCancel.onclick = null;
            modal.onclick = null;
        };

        btnConfirm.onclick = () => {
            cleanup();
            resolve(true);
        };

        btnCancel.onclick = () => {
            cleanup();
            resolve(false);
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(false);
            }
        };
    });
}
