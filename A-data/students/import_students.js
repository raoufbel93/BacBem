let selectedFile = null;
let latestStudentImportReport = null;
const STUDENT_IMPORT_REPORTS_KEY = 'studentImportReports';

document.addEventListener('DOMContentLoaded', async () => {

    // Load settings to set default stage

    const settings = await DB.getSettings() || {};

    const stageSelect = document.getElementById('stageSelect');

    if (stageSelect && settings.educationStage) {

        stageSelect.value = settings.educationStage;

    }

    const importModeSelect = document.getElementById('studentImportModeSelect');

    if (importModeSelect && !importModeSelect.value) {

        importModeSelect.value = 'standard';

    }

    await loadLatestStudentImportReport();

});

function handleStudentFileSelect(event) {

    const files = event.target.files;

    if (files.length === 0) return;

    selectedFile = files[0];

    log(`تم اختيار الملف: ${selectedFile.name}`);

    // Show process button

    const btn = document.getElementById('btnProcess');

    if (btn) btn.style.display = 'inline-block';

    // Reset UI

    document.getElementById('statusBox').style.display = 'none';

    const pBar = document.getElementById('progressBar');

    if (pBar) pBar.style.display = 'none';

    const pFill = document.getElementById('progressFill');

    if (pFill) pFill.style.width = '0%';

}

async function processStudentFile() {
    if (!selectedFile) return;

    const settings = await DB.getSettings() || {};
    const importMode = getSelectedStudentImportMode();

    const btn = document.getElementById('btnProcess');

    btn.disabled = true;

    btn.textContent = "جاري المعالجة...";

    document.getElementById('progressBar').style.display = 'block';

    log("بدء قراءة الملف...");

    try {

        const buffer = await selectedFile.arrayBuffer();

        let rows = [];

        let usedMethod = "standard";

        // Pre-check for MHTML/HTML by reading as text first
        let textDecoder = new TextDecoder("utf-8");
        let rawText = textDecoder.decode(buffer);

        // Encoding Detection Fix for Windows 7 / Legacy Files
        // If the file is actually Windows-1256 (Arabic), UTF-8 decoding might produce garbage or fail to show Arabic keywords.
        // We check for common Arabic keywords. If missing, we try windows-1256.
        const arabicKeywords = ["الجمهورية", "قائمة", "تلاميذ", "اللقب", "الإسم", "مؤسسة"];
        const hasArabic = arabicKeywords.some(w => rawText.includes(w));

        if (!hasArabic && !rawText.includes("<html") && !rawText.includes("MIME-Version")) {
            // Try Windows-1256
            try {
                const legacyDecoder = new TextDecoder("windows-1256");
                const legacyText = legacyDecoder.decode(buffer);

                if (arabicKeywords.some(w => legacyText.includes(w))) {
                    log("تم اكتشاف تشفير Windows-1256 (عربي). جاري التصحيح...", 'info');
                    rawText = legacyText;
                }
            } catch (e) {
                console.warn("Failed to decode as windows-1256", e);
            }
        }

        if (rawText.includes("Snapshot-Content-Location") || rawText.includes("MIME-Version") || rawText.includes("Saved by Blink")) {

            log("تم اكتشاف ملف MHTML (صفحة ويب محفوٍة). جاري استخراج البيانات...", 'info');

            usedMethod = "mhtml";

            try {

                // 1. Extract HTML Content

                let htmlContent = "";

                // Simple parser to find the HTML part

                // Look for Content-Type: text/html

                const typeRegex = /Content-Type:\s*text\/html/i;

                const typeMatch = rawText.match(typeRegex);

                if (typeMatch) {

                    // Start searching from there

                    const startIndex = typeMatch.index;

                    // Find double newline which marks start of body

                    const bodyStart = rawText.indexOf("\r\n\r\n", startIndex);

                    if (bodyStart !== -1) {

                        // Find next boundary or end of file

                        // Try to find boundary from Content-Type header if possible, or just standard MHTML boundary format

                        // Often boundaries are defined in the main header: boundary="----..."

                        const boundaryMatch = rawText.match(/boundary="([^"]+)"/);

                        const boundary = boundaryMatch ? boundaryMatch[1] : null;

                        let bodyEnd = -1;

                        if (boundary) {

                            bodyEnd = rawText.indexOf(boundary, bodyStart + 4);

                        }

                        if (bodyEnd === -1) bodyEnd = rawText.length;

                        let rawBody = rawText.substring(bodyStart + 4, bodyEnd);

                        // Check transfer encoding

                        // Look for Content-Transfer-Encoding: quoted-printable BEFORE the body start but AFTER content-type

                        const headersPart = rawText.substring(startIndex, bodyStart);

                        if (headersPart.toLowerCase().includes("quoted-printable")) {

                            log("فك تشفير Quoted-Printable using Uint8Array strategy...", 'info');

                            // Robust QP Decoding:

                            // 1. Remove soft breaks (=\r\n or =\n)

                            let cleanBody = rawBody.replace(/=\r\n/g, "").replace(/=\n/g, "");

                            // 2. Convert to Uint8Array to handle UTF-8 multibyte sequences correctly

                            // We iterate and parse =XX as hex bytes, and keep other chars as char codes (assuming they are ASCII safe in QP)

                            const bytes = [];

                            for (let i = 0; i < cleanBody.length; i++) {

                                if (cleanBody[i] === '=' && i + 2 < cleanBody.length) {

                                    const hex = cleanBody.substring(i + 1, i + 3);

                                    if (/^[0-9A-F]{2}$/i.test(hex)) {

                                        bytes.push(parseInt(hex, 16));

                                        i += 2;

                                        continue;

                                    }

                                }

                                bytes.push(cleanBody.charCodeAt(i));

                            }

                            const uint8Arr = new Uint8Array(bytes);

                            const finalDecoder = new TextDecoder("utf-8");

                            htmlContent = finalDecoder.decode(uint8Arr);

                        } else {

                            htmlContent = rawBody;

                        }

                    }

                }

                if (!htmlContent) {

                    // Fallback: try to just parse the whole text if <html tag exists

                    if (rawText.includes("<html")) htmlContent = rawText;

                }

                if (htmlContent) {

                    const parser = new DOMParser();

                    const doc = parser.parseFromString(htmlContent, "text/html");

                    const trs = doc.querySelectorAll("tr");

                    if (trs.length > 0) {

                        rows = Array.from(trs).map(tr => {

                            return Array.from(tr.querySelectorAll("td, th"))

                                .map(cell => cell.textContent.trim());

                        });

                        log(`تم استخراج ${rows.length} سطر من MHTML.`, 'info');

                    }

                }

            } catch (e) {

                log(`فشل معالجة MHTML: ${e.message}`, 'error');

            }

        }

        // If MHTML extraction worked, we have rows. If not, try standard XLSX.

        if (rows.length === 0) {

            try {

                // 1. Try Standard Excel Parsing (Binary)

                const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

                if (workbook.SheetNames.length > 0) {

                    const sheet = workbook.Sheets[workbook.SheetNames[0]];

                    rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    if (rows.length < 5) throw new Error("Too few rows or empty");

                }

            } catch (e) {

                // Fallback to HTML parse if not already tried (case where it wasn't MHTML but just HTML file)

                if (usedMethod !== "mhtml") {

                    // ... existing HTML fallback logic ...

                    // We can assume if rawText has <html or table tags it might be plain HTML
                    const htmlIndicators = ["<html", "saved from url", "<table", "<tr", "<td", "xmlns:x="];
                    if (htmlIndicators.some(tag => rawText.includes(tag))) {

                        log("محاولة معالجة الملف كـ HTML...", 'info');
                        const parser = new DOMParser();

                        const doc = parser.parseFromString(rawText, "text/html");

                        const trs = doc.querySelectorAll("tr");

                        if (trs.length > 0) {
                            rows = Array.from(trs).map(tr => Array.from(tr.querySelectorAll("td, th")).map(c => c.textContent.trim()));
                            log(`تم استخراج ${rows.length} سطر عبر HTML Parser.`, 'info');
                        }

                        // Fallback: Regex Matcher if DOMParser failed (e.g. malformed table)
                        if (rows.length === 0) {
                            log("DOMParser لم يجد أي صفوف. جاري المحاولة باستخدام Regex...", 'warning');
                            const trMatches = rawText.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
                            if (trMatches && trMatches.length > 0) {
                                rows = trMatches.map(trHtml => {
                                    // Extract cell content
                                    const cells = [];
                                    const cellMatches = trHtml.match(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi);
                                    if (cellMatches) {
                                        cellMatches.forEach(cellHtml => {
                                            // Strip tags
                                            let content = cellHtml.replace(/<(?:.|\n)*?>/gm, '');
                                            // Decode entities
                                            const txt = document.createElement("textarea");
                                            txt.innerHTML = content;
                                            cells.push(txt.value.trim());
                                        });
                                    }
                                    return cells;
                                });
                                log(`تم استخراج ${rows.length} سطر عبر Regex Matcher.`, 'info');
                            }
                        }

                    }

                }

            }

        }

        // 2. Secondary HTML fallback - runs if XLSX succeeded but returned 0 rows
        if (rows.length === 0 && usedMethod !== "mhtml") {
            log("XLSX لم يعثر على بيانات كافية. جاري محاولة HTML parsing...", 'info');

            const htmlIndicators2 = ["<html", "saved from url", "<table", "<tr", "<td", "xmlns:x=", "<TABLE", "<TR", "<TD"];
            if (htmlIndicators2.some(tag => rawText.toLowerCase().includes(tag.toLowerCase()))) {

                try {
                    const parser2 = new DOMParser();
                    const doc2 = parser2.parseFromString(rawText, "text/html");
                    const trs2 = doc2.querySelectorAll("tr");

                    if (trs2.length > 0) {
                        rows = Array.from(trs2).map(tr => Array.from(tr.querySelectorAll("td, th")).map(c => c.textContent.trim()));
                        log(`تم استخراج ${rows.length} سطر عبر HTML Parser (secondary).`, 'info');
                    }
                } catch (parseErr) {
                    log(`DOMParser error: ${parseErr.message}`, 'warning');
                }

                if (rows.length === 0) {
                    log("جاري المحاولة باستخدام Regex...", 'warning');
                    const trMatches2 = rawText.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
                    if (trMatches2 && trMatches2.length > 0) {
                        rows = trMatches2.map(trHtml => {
                            const cells = [];
                            const cellMatches2 = trHtml.match(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi);
                            if (cellMatches2) {
                                cellMatches2.forEach(cellHtml => {
                                    let content = cellHtml.replace(/<(?:.|\n)*?>/gm, '');
                                    const txt = document.createElement("textarea");
                                    txt.innerHTML = content;
                                    cells.push(txt.value.trim());
                                });
                            }
                            return cells;
                        });
                        log(`تم استخراج ${rows.length} سطر عبر Regex Matcher.`, 'info');
                    }
                }
            } else {
                log(`DEBUG: لا توجد مؤشرات HTML. أول 200 حرف: ${rawText.substring(0, 200)}`, 'warning');
            }
        }

        if (rows.length === 0) {

            showStatus("الملف فارغ أو لم يتم استخراج أي بيانات.", 'error');

            btn.disabled = false;

            return;

        }

        // log(`تم العثور على ${rows.length} سطر.`, 'info');

        const students = [];

        const errors = [];

        let currentLevel = "";

        let currentClass = "";

        let currentYear = (settings && settings.currentAcademicYear) || DB.getCurrentAcademicYear(); // Fallback to current settings or calculated year

        let currentStream = ""; // New global for file

        // Column Mapping Indices

        let colMap = {

            order: -1,

            reg_number: -1,

            national_id: -1,

            last_name: -1,

            first_name: -1,

            gender: -1,

            birth_date: -1,

            pob: -1, // Place of birth if available

            repeat: -1,

            subgroup: -1,

            status: -1,

            notes: -1,

            stream: -1, // New

            age: -1

        };

        // Regex for Section Header

        // Example: "قائمة التلاميذ للسنة :رامسة متوسط 1 للسنة الدراسية :2025 - 2026"

        // Also handling: "للسنة : الأولى متوسط" etc

        const sectionRegex = /قائمة التلاميذ للسنة\s*[:\uff1a](.*?)\s+للسنة/i;

        updateProgress(10);

        let headerFoundCount = 0;

        for (let i = 0; i < rows.length; i++) {

            // Yield to UI every 50 rows to prevent freezing

            if (i % 50 === 0) {

                await new Promise(resolve => setTimeout(resolve, 0));

                updateProgress(10 + (i / rows.length * 80));

            }

            const row = rows[i];

            if (!row || row.length === 0) continue;

            const rowText = row.join(" ").trim();

            // DEBUG: Log first 10 rows to see what is being read

            if (i < 10) {

                log(`DEBUG Row ${i}: ${rowText.substring(0, 100)}...`);

            }

            // 1. Check for Section Header (Looser Match)

            // Supports: "قائمة التلاميذ...", "تحليل النتائج...", "الجمهورية..." (if contains level info)

            // 1. Check for Section Header (Looser Match)

            // Supports: "قائمة التلاميذ...", "تحليل النتائج..."

            // We EXCLUDE "الجمهورية" alone to avoid false positives on the top banner unless it contains "السنة"

            const isRepublic = rowText.includes("الجمهورية");

            const hasYearKeyword = rowText.includes("السنة") || rowText.includes("لسنة");

            if (rowText.includes("قائمة التلاميذ") || rowText.includes("تحليل") || rowText.includes("النتائج") || (isRepublic && hasYearKeyword)) {

                let text = rowText.replace(/[:\uff1a]/g, ":").replace(/[\u2013\u2014-]/g, "-");

                // Extract Year
                const yearMatch = text.match(/(\d{4})[\s\-\/]+(\d{4})/);
                if (yearMatch) {
                    const y1 = parseInt(yearMatch[1]);
                    const y2 = parseInt(yearMatch[2]);
                    const bigger = Math.max(y1, y2);
                    const smaller = Math.min(y1, y2);
                    currentYear = bigger + "/" + smaller;
                }

                // Extract Stream (if any)

                const streamFound = normalizeStream(text);

                if (streamFound && streamFound !== text) {

                    currentStream = streamFound;

                    log(`DEBUG: Stream set to '${currentStream}' based on header text.`, 'info');

                }

                // Extract Level

                // Priority 1: Arabic Words (Ambiguity free)

                let levelNum = "";

                if (text.includes("أولى")) levelNum = "1";

                else if (text.includes("ثانية")) levelNum = "2";

                else if (text.includes("ثالثة")) levelNum = "3";

                else if (text.includes("رابعة")) levelNum = "4";

                // Priority 2: Standard Digits with word boundaries or specific context

                // We must avoid matching "01" (Class) as "1" (Level)

                if (!levelNum) {

                    // Match "1" only if whole word OR followed/preceded by "السنة" or "متوسط" or "ثانوي"

                    // Regex: Look for digit 1-4.

                    const lvlMatch = text.match(/\b([1-4])\b/);

                    if (lvlMatch) {

                        // Check context: is it likely the class?

                        // If we have "1" and "01", regex \b1\b matches "1" but not "01".

                        // But if class is "1" (not 01), it's ambiguous.

                        // Usually Level comes before "ثانوي"/"متوسط". Class comes at end.

                        // Let's assume if we see a standalone digit 1-4, it's the level if we haven't found valid arabic level yet.

                        levelNum = lvlMatch[1];

                    }

                }

                // Get Selected Stage from UI

                const selectedStage = document.getElementById('stageSelect')?.value || 'middle';

                if (levelNum) {

                    currentLevel = levelNum;

                    if (text.includes("ثانوي")) {

                        currentLevel += " ثانوي";

                    } else if (text.includes("متوسط")) {

                        currentLevel += " متوسط";

                    } else {

                        // Ambiguous in file -> Use User Selection

                        if (selectedStage === 'secondary') {

                            currentLevel += " ثانوي";

                        } else {

                            currentLevel += " متوسط";

                        }

                    }

                }

                log(`DEBUG Section Header Found: Level=${currentLevel}, Stream=${currentStream}`);

                // Extract Class/Section

                // Strategy:

                // 1. Look for explicit "ف" or "فوج" or "ق" followed by number? Rare in these headers.

                // 2. Look for the last number in the string that is <= 2 digits (assuming classes 01-99).

                // 3. Ignore the Year (2025, 2026, etc)

                // Clean the text of the year first if we found one

                let textForClass = text;

                if (currentYear) {

                    textForClass = textForClass.replace(currentYear, "").replace(/\d{4}/g, "");

                }

                const parts = textForClass.split(/[\s\-\/]+/);

                // Reset class to ensure we don't carry over old one if not found

                currentClass = "";

                for (let k = parts.length - 1; k >= 0; k--) {

                    const p = parts[k].trim();

                    // Check if it is a number

                    if (isNumeric(p)) {

                        const val = parseInt(p);

                        // Assumption: Class number is usually between 1 and 99.

                        // It is NOT 2025, 2026.

                        if (val > 0 && val < 50) {

                            currentClass = (val < 10 && p.length < 2) ? "0" + val : p; // Pad? Or keep as is. File usually has "01".

                            // Let's keep it as string from file to match 01 vs 1.

                            if (val < 10 && !p.startsWith('0')) currentClass = "0" + val;

                            else currentClass = p;

                            break;

                        }

                    }

                }

                // Fallback: Default to "1" if nothing found, but log warning

                if (!currentClass && currentLevel) {

                    log(`تحذير: لم يتم العثور على رقم القسم في الرأس: "${text}". تم تعيين القسم افتراضياً إلى 01.`, 'warning');

                    currentClass = "01";

                }

                log(`DEBUG Extracted: Level='${currentLevel}', Class='${currentClass}', Stream='${currentStream}' from "${text}"`, 'info');

                continue;

            }

            // 2. Check for Table Header (More Robust Match)
            const firstCellIsNumber = row.length > 0 && isNumeric(row[0]);
            let isHeader = false;
            
            if (!firstCellIsNumber) {
                const hasOrderCol = row.some(cell => {
                    const txt = (cell || "").toString().trim().replace(/[:\uff1a]/g, "");
                    return txt.includes("الترتيب") || txt === "الرقم" || txt === "رقم";
                });
                const hasNameCol = row.some(cell => {
                    const txt = (cell || "").toString().trim().replace(/[:\uff1a]/g, "");
                    return txt.includes("اللقب") || txt.includes("الاسم") || txt.includes("الإسم") || txt === "اسم" || txt.toLowerCase().includes("prenom") || txt.toLowerCase().includes("nom");
                });
                
                const hasLastName = row.some(cell => (cell || "").toString().includes("اللقب"));
                const hasFirstName = row.some(cell => {
                    const txt = (cell || "").toString();
                    return txt.includes("الاسم") || txt.includes("الإسم");
                });
                
                isHeader = (hasOrderCol && hasNameCol) || (hasLastName && hasFirstName);
            }

            if (isHeader) {

                colMap = {

                    order: -1, reg_number: -1, national_id: -1,

                    last_name: -1, first_name: -1, gender: -1,

                    birth_date: -1, pob: -1, repeat: -1,

                    subgroup: -1, status: -1, notes: -1, age: -1, stream: -1

                };

                row.forEach((cell, idx) => {
                    const txt = (cell || "").toString().trim().replace(/[:\uff1a]/g, "");
                    // Use includes for better matching
                    if (txt.includes("الترتيب") || txt === "الرقم" || txt === "رقم") colMap.order = idx;
                    else if (txt.includes("التسجيل")) colMap.reg_number = idx;
                    else if (txt.includes("التعريف")) colMap.national_id = idx;
                    else if (txt.includes("اللقب") || txt.toLowerCase().includes("nom")) colMap.last_name = idx;
                    else if (txt.includes("الاسم") || txt.includes("الإسم") || txt.toLowerCase().includes("prenom")) colMap.first_name = idx;
                    else if (txt.includes("الجنس")) colMap.gender = idx;
                    else if (txt.includes("تاريخ") && txt.includes("ميلاد")) colMap.birth_date = idx;
                    else if (txt.includes("مكان") && txt.includes("ميلاد")) colMap.pob = idx;
                    else if (txt.includes("الإعادة") || txt.includes("معيد")) colMap.repeat = idx;
                    else if (txt.includes("الفوج الفرعي")) colMap.subgroup = idx;
                    else if (txt.includes("السن") || txt.includes("العمر")) colMap.age = idx;
                    else if (txt.includes("الصفة")) colMap.status = idx;
                    else if (txt.includes("الملاح") || txt.includes("الملاحظات")) colMap.notes = idx;
                    else if (txt.includes("الشعبة") || txt.includes("التخصص") || txt.toLowerCase().includes("stream")) colMap.stream = idx;
                });

                headerFoundCount++;

                if (headerFoundCount <= 5) {

                    // Filter out -1s for cleaner log

                    const foundCols = Object.entries(colMap).filter(([k, v]) => v !== -1).map(([k, v]) => k);

                    log(`تم العثور على رأس الجدول. الأعمدة المعرفة: ${foundCols.join(', ')}`, 'info');

                } else if (headerFoundCount === 6) {

                    log("... تم العثور على المزيد من رؤوس الجداول ...", 'info');

                }

                continue;

            }

            // 3. Process Data Row

            // A valid data row must have a number in the "Order" column (if mapped) or first column

            // And must have currentLevel and currentClass set.

            // Check if it's a student row.

            let orderVal = null;

            if (colMap.order !== -1) orderVal = row[colMap.order];

            else orderVal = row[0]; // Fallback to col 0

            // Relaxed check: allow string numbers like "1"

            let isOrderValid = false;

            if (orderVal !== undefined && orderVal !== null && orderVal !== "") {

                if (typeof orderVal === 'number' || !isNaN(parseInt(orderVal))) {

                    isOrderValid = true;

                }

            }

            if (isOrderValid && i < 10) log(`DEBUG Row ${i} identified as student row. Order=${orderVal}`);

            // Prevent importing summary/statistics tables as students
            if (isOrderValid) {
                const _lastName = colMap.last_name !== -1 ? String(row[colMap.last_name] || "").trim() : "";
                const _firstName = colMap.first_name !== -1 ? String(row[colMap.first_name] || "").trim() : "";
                
                // If names are purely digits, this is likely a statistics cell misidentified as a student
                if ((_lastName && /^[\d\.\-]+$/.test(_lastName)) || (_firstName && /^[\d\.\-]+$/.test(_firstName))) {
                    isOrderValid = false;
                    if (i < 50) log(`تجاهل الصف ${i}: تم التعرف عليه كصف إحصائيات (الأسماء عبارة عن أرقام).`, 'warning');
                } else {
                    // Check if the entire row consists only of numbers and empty strings
                    const isAllNumbers = row.every(cell => {
                        const text = String(cell).trim();
                        return text === "" || /^[\d\.\-]+$/.test(text);
                    });
                    
                    if (isAllNumbers) {
                        isOrderValid = false;
                        if (i < 50) log(`تجاهل الصف ${i}: صف يحتوي على أرقام فقط (إحصائيات)`, 'warning');
                    }
                }
            }

            if (!isOrderValid) {

                // Debug: why skipped?

                // if (i < 20) log(`تجاهل الصف ${i}: ليس صف تلميذ (الترتيب=${orderVal})`, 'warning');

                continue;

            }

            if (!currentLevel || !currentClass) {

                if (i < 20) log(`تجاهل الصف ${i}: لم يتم تحديد المستوى/القسم بعد. (تأكد من قراءة رأس القسم)`, 'error');

                continue;

            }

            if (isOrderValid && currentLevel && currentClass) {

                // Extract data

                try {

                    const student = {

                        level: currentLevel,
                        class_number: normalizeClassNumber(currentClass),
                        academic_year: currentYear,

                        order: parseInt(orderVal),

                        national_id: getCellStr(row, colMap.national_id),

                        reg_number: getCellStr(row, colMap.reg_number),

                        last_name: getCellStr(row, colMap.last_name),

                        first_name: getCellStr(row, colMap.first_name),

                        gender: parseGender(getCellStr(row, colMap.gender)),

                        birth_date: parseDate(row[colMap.birth_date]),

                        pob: getCellStr(row, colMap.pob),

                        is_repeater: parseBool(getCellStr(row, colMap.repeat)),

                        subgroup: getCellStr(row, colMap.subgroup),

                        status: getCellStr(row, colMap.status),

                        observation: getCellStr(row, colMap.notes),

                        stream: (colMap.stream !== -1) ? normalizeStream(getCellStr(row, colMap.stream)) : currentStream, // Use column or section header

                        age: row[colMap.age] || null, // Keep raw or calc? Keep raw for now.

                        source_row: i + 1

                    };

                    // Basic Validation

                    if (!student.last_name || !student.first_name) {

                        throw new Error("الاسم أو اللقب مفقود");

                    }

                    // If date failed parsing, store original text in observation

                    if (!student.birth_date && row[colMap.birth_date]) {

                        const rawDate = row[colMap.birth_date];

                        student.observation = (student.observation ? student.observation + " | " : "") + "تاريخ ميلاد غير صالح: " + rawDate;

                    }

                    students.push(student);

                } catch (err) {

                    errors.push({ row: i + 1, error: err.message, data: row });

                    log(`خطأ في السطر ${i + 1}: ${err.message}`, 'error');

                }

            }

        }

        updateProgress(90);

        if (students.length === 0) {

            showStatus("لم يتم العثور على أي بيانات تلاميذ. تأكد من تنسيق الملف.", 'error');

            btn.disabled = false;

            btn.textContent = "معالجة واستيراد";

            return;

        }

        // Save Results

        log(`تم استخراج ${students.length} تلميذ بنجاح.`);

        if (errors.length > 0) log(`تم تخطي ${errors.length} صفوف بسبب أخطاء.`, 'warning');

        const importSummary = await saveStudentsToStorage(students, { importMode: importMode });

        if (importSummary && Array.isArray(importSummary.pendingReview) && importSummary.pendingReview.length > 0) {
            const reviewSummary = await showMissingStudentsReviewModal(importSummary.pendingReview);
            importSummary.reviewSummary = reviewSummary;
        }

        const finalReport = buildStudentImportReport({
            fileName: selectedFile ? selectedFile.name : '',
            importMode: importMode,
            summary: importSummary
        });

        await saveStudentImportReport(finalReport);
        latestStudentImportReport = finalReport;
        renderLatestStudentImportReport(finalReport);

        updateProgress(100);

        await showSuccessModal(buildImportSuccessMessage(importSummary));

        btn.disabled = false;

        btn.textContent = "تم بنجاح";

    } catch (e) {

        log(`حدث خطأ غير متوقع: ${e.message}`, 'error');

        btn.disabled = false;

        btn.textContent = "معالجة واستيراد";

    }

}

// Helpers

function getCellStr(row, idx) {

    if (idx === -1 || row[idx] === undefined || row[idx] === null) return "";

    return row[idx].toString().trim();

}

function parseGender(val) {

    if (!val) return "M"; // Default? Or leave null? Let's default M or handle as unknown.

    // User rules: "ذكر"→"M", "أنثى"→"F"

    if (val === "ذكر" || val === "ذكور" || val === "M") return "M";

    if (val === "أنثى" || val === "إناث" || val === "F") return "F";

    return "M"; // Fallback

}

function parseBool(val) {

    if (!val) return false;

    const s = String(val).trim().toLowerCase();

    // "نعم"→true, "لا"→false

    if (s === "نعم" || s === "true" || s === "1" || s.includes("معيد") || s.includes("يعيد")) return true;

    return false;

}

function parseDate(val) {

    if (!val) return null;

    // If Excel serial number

    if (typeof val === 'number') {

        // Approximate check: if < 1000 it might be age, not date.

        // Excel base date is 1900. 1000 days is ~1902.

        if (val < 10000) return null; // Ignore small numbers

        const date = new Date(Math.round((val - 25569) * 86400 * 1000));

        const y = date.getFullYear();

        if (isNaN(y) || y < 1900 || y > 2100) return null;

        return date.toISOString().split('T')[0];

    }

    // If String

    let str = val.toString().trim();

    // Replace dots and standard dashes with slashes for uniform parsing

    str = str.replace(/[\.\-]/g, '/');

    let parts = str.split('/');

    if (parts.length === 3) {

        let y = parseInt(parts[2]);

        let m = parseInt(parts[1]);

        let d = parseInt(parts[0]);

        // Handle YYYY/MM/DD case (if first part is year)

        if (parts[0].length === 4) {

            y = parseInt(parts[0]);

            m = parseInt(parts[1]);

            d = parseInt(parts[2]);

        }

        // Handle 2 digit year: 10 -> 2010

        if (y < 100) y += 2000;

        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {

            // Validate ranges

            if (m < 1 || m > 12) return null;

            if (d < 1 || d > 31) return null;

            return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

        }

    }

    return null; // Fail

}

async function saveStudentsToStorage(students, options) {

    const importedStudents = Array.isArray(students) ? students.map(normalizeImportedStudentRecord) : [];
    const importOptions = options || {};
    const importMode = importOptions.importMode || 'standard';
    const studentsByYear = {};
    const summary = {
        imported: importedStudents.length,
        matched: 0,
        created: 0,
        reactivated: 0,
        promotedFromPrevious: 0,
        pendingReview: [],
        years: []
    };

    importedStudents.forEach(student => {
        const year = student.academic_year || DB.getCurrentAcademicYear();
        if (!studentsByYear[year]) studentsByYear[year] = [];
        studentsByYear[year].push(student);
    });

    const years = Object.keys(studentsByYear);

    for (let i = 0; i < years.length; i++) {
        const year = years[i];
        const existingStudents = await DB.getStudents(true, year) || [];
        let previousYearStudents = [];

        if (importMode === 'promote_from_previous') {
            const previousYear = getPreviousAcademicYear(year);
            if (previousYear && previousYear !== year) {
                previousYearStudents = await DB.getStudents(true, previousYear) || [];
            }
        }

        const mergeResult = mergeImportedStudents(studentsByYear[year], existingStudents, year, {
            importMode: importMode,
            previousYearStudents: previousYearStudents
        });

        await DB.saveStudents(mergeResult.students, year);

        summary.matched += mergeResult.matched;
        summary.created += mergeResult.created;
        summary.reactivated += mergeResult.reactivated;
        summary.promotedFromPrevious += mergeResult.promotedFromPrevious;
        summary.pendingReview = summary.pendingReview.concat(mergeResult.pendingReview || []);
        summary.years.push({
            year: year,
            imported: studentsByYear[year].length,
            matched: mergeResult.matched,
            created: mergeResult.created,
            reactivated: mergeResult.reactivated,
            promotedFromPrevious: mergeResult.promotedFromPrevious,
            pendingReviewCount: (mergeResult.pendingReview || []).length
        });
    }

    return summary;

}

function buildImportSuccessMessage(summary) {

    if (!summary) return "تم استيراد التلاميذ بنجاح.";

    const parts = [
        `تم استيراد ${summary.imported || 0} تلميذ بنجاح.`,
        `تمت مطابقة ${summary.matched || 0} مع السجلات الموجودة.`,
        `تمت إضافة ${summary.created || 0} تلميذ جديد.`
    ];

    if (summary.reactivated) {
        parts.push(`تمت إعادة تنشيط ${summary.reactivated} تلميذ كان مشطوبًا من قبل.`);
    }

    if (summary.promotedFromPrevious) {
        parts.push(`تم نقل البيانات الإدارية من السنة السابقة لـ ${summary.promotedFromPrevious} تلميذ.`);
    }

    if (summary.pendingReview && summary.pendingReview.length > 0) {
        parts.push(`تم العثور على ${summary.pendingReview.length} تلميذ غير موجودين في ملف الاستيراد وتم عرضهم للمراجعة.`);
    }

    if (summary.reviewSummary) {
        if (summary.reviewSummary.struckOff) {
            parts.push(`تم شطب ${summary.reviewSummary.struckOff} تلميذ.`);
        }
        if (summary.reviewSummary.transferred) {
            parts.push(`تم اعتبار ${summary.reviewSummary.transferred} تلميذ محولين.`);
        }
        if (summary.reviewSummary.deleted) {
            parts.push(`تم حذف ${summary.reviewSummary.deleted} تلميذ نهائيًا.`);
        }
    }

    return parts.join(' ');

}

function buildStudentImportReport(payload) {

    const reportSummary = payload && payload.summary ? payload.summary : {};
    const importMode = payload && payload.importMode ? payload.importMode : 'standard';
    const reviewSummary = reportSummary.reviewSummary || {};

    return {
        id: 'student_import_' + Date.now(),
        created_at: new Date().toISOString(),
        file_name: payload && payload.fileName ? payload.fileName : '',
        import_mode: importMode,
        import_mode_label: importMode === 'promote_from_previous'
            ? 'استيراد سنة جديدة انطلاقًا من السنة السابقة'
            : 'استيراد عادي لنفس السنة',
        imported: reportSummary.imported || 0,
        matched: reportSummary.matched || 0,
        created: reportSummary.created || 0,
        reactivated: reportSummary.reactivated || 0,
        promoted_from_previous: reportSummary.promotedFromPrevious || 0,
        pending_review_count: Array.isArray(reportSummary.pendingReview) ? reportSummary.pendingReview.length : 0,
        review_summary: {
            kept: reviewSummary.kept || 0,
            struck_off: reviewSummary.struckOff || 0,
            transferred: reviewSummary.transferred || 0,
            deleted: reviewSummary.deleted || 0
        },
        years: Array.isArray(reportSummary.years) ? reportSummary.years : []
    };

}

async function saveStudentImportReport(report) {

    if (!report) return;

    let existingReports = await DB.get(STUDENT_IMPORT_REPORTS_KEY);
    if (!Array.isArray(existingReports)) existingReports = [];

    existingReports.unshift(report);
    if (existingReports.length > 20) {
        existingReports = existingReports.slice(0, 20);
    }

    await DB.set(STUDENT_IMPORT_REPORTS_KEY, existingReports);

}

async function loadLatestStudentImportReport() {

    let reports = await DB.get(STUDENT_IMPORT_REPORTS_KEY);
    if (!Array.isArray(reports) || reports.length === 0) {
        latestStudentImportReport = null;
        renderLatestStudentImportReport(null);
        return null;
    }

    latestStudentImportReport = reports[0];
    renderLatestStudentImportReport(latestStudentImportReport);
    return latestStudentImportReport;

}

function renderLatestStudentImportReport(report) {

    const box = document.getElementById('studentImportReportBox');
    const summary = document.getElementById('studentImportReportSummary');
    const successViewBtn = document.getElementById('modalSuccessViewReport');

    if (!box || !summary) return;

    if (!report) {
        box.style.display = 'none';
        if (successViewBtn) successViewBtn.style.display = 'none';
        return;
    }

    const dateLabel = formatReportDateTime(report.created_at);
    const fileName = report.file_name || 'ملف غير محدد';
    const reviewCounts = report.review_summary || {};

    summary.innerHTML = `
        <div><strong>الملف:</strong> ${escapeHtml(fileName)}</div>
        <div><strong>الوقت:</strong> ${escapeHtml(dateLabel)}</div>
        <div><strong>النوع:</strong> ${escapeHtml(report.import_mode_label || '')}</div>
        <div><strong>النتيجة:</strong> استيراد ${report.imported || 0} | مطابقة ${report.matched || 0} | جدد ${report.created || 0} | مراجعة ${report.pending_review_count || 0}</div>
        <div><strong>بعد المراجعة:</strong> إبقاء ${reviewCounts.kept || 0} | شطب ${reviewCounts.struck_off || 0} | تحويل ${reviewCounts.transferred || 0} | حذف ${reviewCounts.deleted || 0}</div>
    `;

    box.style.display = 'block';
    if (successViewBtn) successViewBtn.style.display = 'inline-flex';

}

function openLatestStudentImportReportModal() {

    if (!latestStudentImportReport) return;

    const modal = document.getElementById('studentImportReportModal');
    const body = document.getElementById('studentImportReportModalBody');
    const closeBtn = document.getElementById('studentImportReportCloseBtn');

    if (!modal || !body || !closeBtn) return;

    const report = latestStudentImportReport;
    const review = report.review_summary || {};
    const yearsRows = (report.years || []).map((yearInfo, index) => `
        <tr>
            <td style="padding:8px; border-bottom:1px solid var(--border-color);">${index + 1}</td>
            <td style="padding:8px; border-bottom:1px solid var(--border-color);">${escapeHtml(yearInfo.year || '-')}</td>
            <td style="padding:8px; border-bottom:1px solid var(--border-color);">${yearInfo.imported || 0}</td>
            <td style="padding:8px; border-bottom:1px solid var(--border-color);">${yearInfo.matched || 0}</td>
            <td style="padding:8px; border-bottom:1px solid var(--border-color);">${yearInfo.created || 0}</td>
            <td style="padding:8px; border-bottom:1px solid var(--border-color);">${yearInfo.reactivated || 0}</td>
            <td style="padding:8px; border-bottom:1px solid var(--border-color);">${yearInfo.promotedFromPrevious || 0}</td>
            <td style="padding:8px; border-bottom:1px solid var(--border-color);">${yearInfo.pendingReviewCount || 0}</td>
        </tr>
    `).join('');

    body.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px;">
            <div><strong>الملف:</strong> ${escapeHtml(report.file_name || '-')}</div>
            <div><strong>التاريخ:</strong> ${escapeHtml(formatReportDateTime(report.created_at))}</div>
            <div><strong>نوع الاستيراد:</strong> ${escapeHtml(report.import_mode_label || '-')}</div>
            <div><strong>إجمالي المستورد:</strong> ${report.imported || 0}</div>
            <div><strong>مطابقات:</strong> ${report.matched || 0}</div>
            <div><strong>تلاميذ جدد:</strong> ${report.created || 0}</div>
            <div><strong>إعادة تنشيط:</strong> ${report.reactivated || 0}</div>
            <div><strong>من السنة السابقة:</strong> ${report.promoted_from_previous || 0}</div>
            <div><strong>بحاجة مراجعة:</strong> ${report.pending_review_count || 0}</div>
            <div><strong>إبقاء بعد المراجعة:</strong> ${review.kept || 0}</div>
            <div><strong>شطب بعد المراجعة:</strong> ${review.struck_off || 0}</div>
            <div><strong>تحويل بعد المراجعة:</strong> ${review.transferred || 0}</div>
            <div><strong>حذف نهائي:</strong> ${review.deleted || 0}</div>
        </div>
        <div style="margin-top: 14px;">
            <div style="font-weight:700; margin-bottom:10px;">تفصيل حسب السنة</div>
            <div style="overflow:auto; border:1px solid var(--border-color); border-radius: 10px;">
                <table style="width:100%; border-collapse:collapse; font-size:0.95rem;">
                    <thead style="background: var(--card-bg, #fff);">
                        <tr>
                            <th style="padding:8px; border-bottom:1px solid var(--border-color);">#</th>
                            <th style="padding:8px; border-bottom:1px solid var(--border-color);">السنة</th>
                            <th style="padding:8px; border-bottom:1px solid var(--border-color);">المستورد</th>
                            <th style="padding:8px; border-bottom:1px solid var(--border-color);">مطابقة</th>
                            <th style="padding:8px; border-bottom:1px solid var(--border-color);">جدد</th>
                            <th style="padding:8px; border-bottom:1px solid var(--border-color);">إعادة تنشيط</th>
                            <th style="padding:8px; border-bottom:1px solid var(--border-color);">من السنة السابقة</th>
                            <th style="padding:8px; border-bottom:1px solid var(--border-color);">بحاجة مراجعة</th>
                        </tr>
                    </thead>
                    <tbody>${yearsRows || '<tr><td colspan="8" style="padding:12px; text-align:center;">لا توجد تفاصيل إضافية</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    `;

    modal.classList.add('active');

    const cleanup = () => {
        modal.classList.remove('active');
        closeBtn.onclick = null;
        modal.onclick = null;
    };

    closeBtn.onclick = cleanup;
    modal.onclick = (event) => {
        if (event.target === modal) cleanup();
    };

}

function formatReportDateTime(value) {

    if (!value) return '';

    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    return date.toLocaleString('ar-DZ');

}

function normalizeImportedStudentRecord(student) {

    const normalized = Object.assign({}, student || {});

    normalized.last_name = cleanCellText(normalized.last_name);
    normalized.first_name = cleanCellText(normalized.first_name);
    normalized.national_id = cleanCellText(normalized.national_id);
    normalized.reg_number = cleanCellText(normalized.reg_number);
    normalized.gender = parseGender(normalized.gender);
    normalized.birth_date = normalized.birth_date || null;
    normalized.pob = cleanCellText(normalized.pob || normalized.birth_place);
    normalized.level = getCanonicalLevelWord(normalized.level);
    normalized.class_number = normalizeClassNumber(normalized.class_number || normalized.class);
    normalized.stream = cleanCellText(normalized.stream);
    normalized.subgroup = cleanCellText(normalized.subgroup);
    normalized.status = cleanCellText(normalized.status) || 'external';
    normalized.is_repeater = !!(normalized.is_repeater || normalized.repeat);
    normalized.observation = cleanCellText(normalized.observation || normalized.notes);
    normalized.academic_year = normalized.academic_year || DB.getCurrentAcademicYear();
    normalized.struck_off = !!normalized.struck_off;

    delete normalized.birth_place;
    delete normalized.repeat;
    delete normalized.notes;
    delete normalized.class;

    return normalized;

}

function mergeImportedStudents(importedStudents, existingStudents, academicYear, options) {

    const importedList = Array.isArray(importedStudents) ? importedStudents.map(normalizeImportedStudentRecord) : [];
    const existingList = Array.isArray(existingStudents) ? existingStudents.map(student => Object.assign({}, student)) : [];
    const mergeOptions = options || {};
    const previousYearList = Array.isArray(mergeOptions.previousYearStudents) ? mergeOptions.previousYearStudents.map(student => Object.assign({}, student)) : [];
    const maps = buildStudentLookupMaps(existingList);
    const previousMaps = buildStudentLookupMaps(previousYearList);
    const matchedIds = {};
    const previousMatchedIds = {};
    const mergedStudents = [];
    let matched = 0;
    let created = 0;
    let reactivated = 0;
    let promotedFromPrevious = 0;
    const pendingReview = [];

    importedList.forEach(imported => {
        const existing = findExistingStudentMatch(imported, maps, matchedIds);
        let merged = null;
        let previousYearMatch = null;

        if (existing) {
            merged = mergeStudentRecord(existing, imported, academicYear, { preserveExistingId: true });
        } else if (mergeOptions.importMode === 'promote_from_previous') {
            previousYearMatch = findExistingStudentMatch(imported, previousMaps, previousMatchedIds);
            if (previousYearMatch) {
                if (previousYearMatch.id) {
                    previousMatchedIds[String(previousYearMatch.id)] = true;
                }
                merged = mergeStudentRecord(previousYearMatch, imported, academicYear, {
                    preserveExistingId: false,
                    promotedFromPrevious: true
                });
            }
        }

        if (!merged) {
            merged = mergeStudentRecord(null, imported, academicYear, { preserveExistingId: false });
        }

        if (existing && existing.id) {
            matchedIds[String(existing.id)] = true;
            matched += 1;
            if (existing.struck_off) reactivated += 1;
        } else {
            created += 1;
            if (previousYearMatch) promotedFromPrevious += 1;
        }

        mergedStudents.push(merged);
    });

    existingList.forEach(existing => {
        if (!existing || !existing.id) return;
        if (matchedIds[String(existing.id)]) return;

        const preserved = normalizeImportedStudentRecord(existing);
        if (!preserved.struck_off) {
            pendingReview.push(createMissingStudentReviewEntry(preserved, academicYear));
        }
        mergedStudents.push(preserved);
    });

    return {
        students: mergedStudents,
        matched: matched,
        created: created,
        reactivated: reactivated,
        promotedFromPrevious: promotedFromPrevious,
        pendingReview: pendingReview
    };

}

function mergeStudentRecord(existing, imported, academicYear, options) {

    const base = existing ? Object.assign({}, existing) : {};
    const merged = Object.assign({}, base);
    const source = normalizeImportedStudentRecord(imported);
    const mergeOptions = options || {};

    if (mergeOptions.preserveExistingId !== false && existing && existing.id) {
        merged.id = existing.id;
    } else {
        delete merged.id;
    }

    merged.reg_number = preferImportedValue(source.reg_number, base.reg_number);
    merged.national_id = preferImportedValue(source.national_id, base.national_id);
    merged.last_name = preferImportedValue(source.last_name, base.last_name) || '';
    merged.first_name = preferImportedValue(source.first_name, base.first_name) || '';
    merged.gender = preferImportedValue(source.gender, base.gender);
    merged.birth_date = preferImportedValue(source.birth_date, base.birth_date);
    merged.pob = preferImportedValue(source.pob, base.pob);
    merged.level = getCanonicalLevelWord(source.level || base.level);
    merged.class_number = normalizeClassNumber(source.class_number || base.class_number || base.class);
    merged.stream = preferImportedValue(source.stream, base.stream);
    merged.subgroup = preferImportedValue(source.subgroup, base.subgroup);
    merged.status = preferImportedValue(source.status, base.status) || 'external';
    merged.is_repeater = !!(source.is_repeater || base.is_repeater);
    merged.father_name = base.father_name || null;
    merged.mother_name = base.mother_name || null;
    merged.scholarship_confirmed = !!base.scholarship_confirmed;
    merged.struck_off = false;
    merged.observation = chooseObservationValue(base.observation, source.observation);
    merged.academic_year = academicYear || source.academic_year || base.academic_year || DB.getCurrentAcademicYear();

    if (mergeOptions.promotedFromPrevious && existing && existing.id) {
        merged.promoted_from_student_id = existing.id;
        merged.promoted_from_academic_year = existing.academic_year || null;
    }

    if (base.photo && !merged.photo) merged.photo = base.photo;
    if (base.guardian_phone && !merged.guardian_phone) merged.guardian_phone = base.guardian_phone;
    if (base.guardian_address && !merged.guardian_address) merged.guardian_address = base.guardian_address;
    if (base.parent_phone && !merged.parent_phone) merged.parent_phone = base.parent_phone;
    if (base.address && !merged.address) merged.address = base.address;

    return normalizeImportedStudentRecord(merged);

}

function buildStudentLookupMaps(students) {

    const maps = {
        byNationalId: {},
        byRegNumber: {},
        byIdentity: {},
        byNameLevelClass: {}
    };

    (students || []).forEach(student => {
        addUniqueLookup(maps.byNationalId, normalizeDocumentId(student.national_id), student);
        addUniqueLookup(maps.byRegNumber, normalizeDocumentId(student.reg_number), student);
        addUniqueLookup(maps.byIdentity, buildStudentIdentityKey(student, true), student);
        addUniqueLookup(maps.byNameLevelClass, buildStudentIdentityKey(student, false), student);
    });

    return maps;

}

function findExistingStudentMatch(student, maps, matchedIds) {

    const candidateKeys = [
        { map: maps.byNationalId, key: normalizeDocumentId(student.national_id) },
        { map: maps.byRegNumber, key: normalizeDocumentId(student.reg_number) },
        { map: maps.byIdentity, key: buildStudentIdentityKey(student, true) },
        { map: maps.byNameLevelClass, key: buildStudentIdentityKey(student, false) }
    ];

    for (let i = 0; i < candidateKeys.length; i++) {
        const entry = candidateKeys[i];
        const matched = getUnmatchedStudentFromMap(entry.map, entry.key, matchedIds);
        if (matched) return matched;
    }

    return null;

}

function getUnmatchedStudentFromMap(map, key, matchedIds) {

    if (!key || !map || !map[key]) return null;
    const candidate = map[key];
    if (!candidate || !candidate.id) return candidate || null;
    if (matchedIds[String(candidate.id)]) return null;
    return candidate;

}

function addUniqueLookup(map, key, student) {

    if (!key || !student) return;

    if (!Object.prototype.hasOwnProperty.call(map, key)) {
        map[key] = student;
        return;
    }

    if (map[key] && map[key].id !== student.id) {
        map[key] = null;
    }

}

function buildStudentIdentityKey(student, includeBirthDate) {

    if (!student) return '';

    const lastName = normalizeLookupText(student.last_name);
    const firstName = normalizeLookupText(student.first_name);
    const level = getLevelLookupValue(student.level);
    const classNumber = normalizeClassNumber(student.class_number || student.class);
    const birthDate = includeBirthDate ? normalizeBirthDateLookup(student.birth_date) : '';

    if (!lastName || !firstName || !level || !classNumber) return '';
    if (includeBirthDate && !birthDate) return '';

    return [lastName, firstName, level, classNumber, birthDate].join('|');

}

function normalizeLookupText(value) {

    return String(value || '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/\u0640/g, '')
        .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

}

function normalizeDocumentId(value) {

    return String(value || '').replace(/\s+/g, '').trim();

}

function normalizeBirthDateLookup(value) {

    return String(value || '').trim();

}

function getSelectedStudentImportMode() {

    const select = document.getElementById('studentImportModeSelect');
    return select && select.value ? select.value : 'standard';

}

function createMissingStudentReviewEntry(student, academicYear) {

    const normalized = normalizeImportedStudentRecord(student);

    return {
        id: normalized.id || '',
        academic_year: academicYear || normalized.academic_year || '',
        last_name: normalized.last_name || '',
        first_name: normalized.first_name || '',
        birth_date: normalized.birth_date || '',
        level: normalized.level || '',
        class_number: normalized.class_number || '',
        status: normalized.status || '',
        action: 'keep'
    };

}

async function showMissingStudentsReviewModal(missingStudents) {

    const modal = document.getElementById('missingStudentsModal');
    const tableBody = document.getElementById('missingStudentsTableBody');
    const countEl = document.getElementById('missingStudentsCount');
    const btnApply = document.getElementById('missingStudentsApplyBtn');
    const btnSkip = document.getElementById('missingStudentsSkipBtn');
    const btnStrikeAll = document.getElementById('missingStudentsStrikeAllBtn');
    const btnTransferAll = document.getElementById('missingStudentsTransferAllBtn');
    const btnKeepAll = document.getElementById('missingStudentsKeepAllBtn');
    const btnDeleteAll = document.getElementById('missingStudentsDeleteAllBtn');

    if (!modal || !tableBody || !btnApply || !btnSkip) {
        return { struckOff: 0, transferred: 0, deleted: 0, kept: missingStudents.length || 0 };
    }

    const reviewItems = (missingStudents || []).map(item => Object.assign({}, item));
    countEl.textContent = String(reviewItems.length);

    renderMissingStudentsReviewRows(reviewItems, tableBody);
    modal.classList.add('active');

    return new Promise((resolve) => {
        const cleanup = () => {
            modal.classList.remove('active');
            btnApply.onclick = null;
            btnSkip.onclick = null;
            btnStrikeAll.onclick = null;
            btnTransferAll.onclick = null;
            btnKeepAll.onclick = null;
            btnDeleteAll.onclick = null;
            modal.onclick = null;
        };

        btnStrikeAll.onclick = () => setMissingStudentsActionForAll(reviewItems, tableBody, 'strike');
        btnTransferAll.onclick = () => setMissingStudentsActionForAll(reviewItems, tableBody, 'transfer');
        btnKeepAll.onclick = () => setMissingStudentsActionForAll(reviewItems, tableBody, 'keep');
        btnDeleteAll.onclick = () => setMissingStudentsActionForAll(reviewItems, tableBody, 'delete');

        btnSkip.onclick = () => {
            cleanup();
            resolve({ struckOff: 0, transferred: 0, deleted: 0, kept: reviewItems.length });
        };

        btnApply.onclick = async () => {
            btnApply.disabled = true;
            const result = await applyMissingStudentsReview(reviewItems);
            btnApply.disabled = false;
            cleanup();
            resolve(result);
        };

        modal.onclick = (event) => {
            if (event.target === modal) {
                cleanup();
                resolve({ struckOff: 0, transferred: 0, deleted: 0, kept: reviewItems.length });
            }
        };
    });

}

function renderMissingStudentsReviewRows(reviewItems, tableBody) {

    tableBody.innerHTML = reviewItems.map((item, index) => {
        const fullName = `${escapeHtml(item.last_name || '')} ${escapeHtml(item.first_name || '')}`.trim();
        const levelClass = `${escapeHtml(item.level || '')} / ${escapeHtml(item.class_number || '-')}`;
        const status = escapeHtml(item.status || '-');
        const birthDate = escapeHtml(formatReviewDate(item.birth_date));

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${fullName || '-'}</td>
                <td>${birthDate || '-'}</td>
                <td>${levelClass}</td>
                <td>${escapeHtml(item.academic_year || '')}</td>
                <td>${status}</td>
                <td>
                    <select data-review-index="${index}" class="missing-student-action-select" style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); min-width:160px;">
                        <option value="keep"${item.action === 'keep' ? ' selected' : ''}>إبقاء بدون تغيير</option>
                        <option value="strike"${item.action === 'strike' ? ' selected' : ''}>شطب</option>
                        <option value="transfer"${item.action === 'transfer' ? ' selected' : ''}>اعتباره محولًا</option>
                        <option value="delete"${item.action === 'delete' ? ' selected' : ''}>حذف نهائي</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');

    const selects = tableBody.querySelectorAll('.missing-student-action-select');
    selects.forEach(select => {
        select.addEventListener('change', (event) => {
            const idx = parseInt(event.target.getAttribute('data-review-index'), 10);
            if (!isNaN(idx) && reviewItems[idx]) {
                reviewItems[idx].action = event.target.value;
            }
        });
    });

}

function setMissingStudentsActionForAll(reviewItems, tableBody, action) {

    reviewItems.forEach(item => { item.action = action; });
    renderMissingStudentsReviewRows(reviewItems, tableBody);

}

async function applyMissingStudentsReview(reviewItems) {

    const grouped = {};
    const summary = { struckOff: 0, transferred: 0, deleted: 0, kept: 0 };

    (reviewItems || []).forEach(item => {
        const action = item.action || 'keep';
        if (action === 'keep') {
            summary.kept += 1;
            return;
        }
        const year = item.academic_year || '';
        if (!grouped[year]) grouped[year] = [];
        grouped[year].push(item);
    });

    const years = Object.keys(grouped);
    for (let i = 0; i < years.length; i++) {
        const year = years[i];
        const students = await DB.getStudents(true, year) || [];
        const actionsById = {};

        grouped[year].forEach(item => {
            if (item && item.id) actionsById[String(item.id)] = item.action;
        });

        const updatedStudents = [];

        students.forEach(student => {
            const action = actionsById[String(student.id)];
            if (!action) {
                updatedStudents.push(student);
                return;
            }

            if (action === 'delete') {
                summary.deleted += 1;
                return;
            }

            const updated = Object.assign({}, student);
            updated.struck_off = true;
            updated.strike_date = new Date().toISOString().split('T')[0];

            if (action === 'transfer') {
                updated.status = 'محول';
                updated.strike_type = 'transfer';
                updated.strike_reason = 'غير موجود في ملف الاستيراد الجديد';
                summary.transferred += 1;
            } else {
                updated.status = 'مشطوب';
                updated.strike_type = 'strike';
                updated.strike_reason = 'غير موجود في ملف الاستيراد الجديد';
                summary.struckOff += 1;
            }

            updatedStudents.push(updated);
        });

        await DB.saveStudents(updatedStudents, year);
    }

    return summary;

}

function formatReviewDate(value) {

    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const parts = raw.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return raw;

}

function escapeHtml(value) {

    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

}

function cleanCellText(value) {

    return String(value || '').trim();

}

function preferImportedValue(importedValue, existingValue) {

    if (importedValue === undefined || importedValue === null) return existingValue || null;
    if (typeof importedValue === 'string' && importedValue.trim() === '') return existingValue || null;
    return importedValue;

}

function chooseObservationValue(existingValue, importedValue) {

    const existingText = cleanCellText(existingValue);
    const importedText = cleanCellText(importedValue);

    if (existingText) return existingText;
    return importedText || null;

}

function getLevelLookupValue(levelValue) {

    const raw = String(levelValue || '').trim();
    if (!raw) return '';

    const digitMatch = raw.match(/[1-4]/);
    if (digitMatch) return digitMatch[0];

    if (raw.indexOf('أولى') !== -1 || raw.indexOf('اولى') !== -1 || raw.indexOf('الأولى') !== -1) return '1';
    if (raw.indexOf('ثانية') !== -1 || raw.indexOf('الثانية') !== -1) return '2';
    if (raw.indexOf('ثالثة') !== -1 || raw.indexOf('الثالثة') !== -1) return '3';
    if (raw.indexOf('رابعة') !== -1 || raw.indexOf('الرابعة') !== -1) return '4';

    return raw;

}

function getCanonicalLevelWord(levelValue) {

    switch (getLevelLookupValue(levelValue)) {
        case '1': return 'أولى';
        case '2': return 'ثانية';
        case '3': return 'ثالثة';
        case '4': return 'رابعة';
        default: return cleanCellText(levelValue);
    }

}

function getPreviousAcademicYear(yearValue) {

    const raw = String(yearValue || '').trim();
    const matches = raw.match(/20\d{2}/g);

    if (!matches || matches.length < 2) return '';

    const newerYear = parseInt(matches[0], 10);
    const olderYear = parseInt(matches[1], 10);

    if (isNaN(newerYear) || isNaN(olderYear)) return '';

    return olderYear + '/' + (olderYear - 1);

}

function normalizeClassNumber(value) {

    const raw = String(value || '').trim();
    if (!raw) return '';
    const numeric = parseInt(raw, 10);
    if (!isNaN(numeric)) return String(numeric);
    return raw;

}

// UI Helpers

function log(msg, type = 'info') {

    const area = document.getElementById('logArea');

    if (!area) return;

    const p = document.createElement('div');

    p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;

    if (type === 'error') p.style.color = 'red';

    else if (type === 'warning') p.style.color = 'orange';

    area.appendChild(p);

    area.scrollTop = area.scrollHeight;

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

}

function showSuccessModal(message) {

    return new Promise((resolve) => {

        const modal = document.getElementById('successModal');

        const msgEl = document.getElementById('successMessage');

        const btnOk = document.getElementById('modalSuccessOk');
        const btnViewReport = document.getElementById('modalSuccessViewReport');

        if (message) msgEl.innerText = message;

        modal.classList.add('active');

        if (btnViewReport) {
            btnViewReport.style.display = latestStudentImportReport ? 'inline-flex' : 'none';
        }

        const cleanup = () => {

            modal.classList.remove('active');

            btnOk.onclick = null;
            if (btnViewReport) btnViewReport.onclick = null;

        };

        btnOk.onclick = () => {

            cleanup();

            resolve(true);

        };

        if (btnViewReport) {
            btnViewReport.onclick = () => {
                cleanup();
                openLatestStudentImportReportModal();
                resolve(true);
            };
        }

        modal.onclick = (e) => {

            if (e.target === modal) { cleanup(); resolve(true); }

        }

    });

}

function openImportTutorialVideo(url) {

    const target = String(url || '').trim();
    if (!target) return;

    try {
        if (window.shell && typeof window.shell.openExternal === 'function') {
            window.shell.openExternal(target);
            return;
        }
    } catch (e) {
        console.warn('Failed to open tutorial video via shell:', e);
    }

    window.open(target, '_blank');

}

function isNumeric(str) {

    if (typeof str != "string") return false;

    return !isNaN(str) && !isNaN(parseFloat(str));

}

function characterIsDigit(char) {

    return /^\d$/.test(char);

}

// Helper to normalize arabic stream names to codes

function normalizeStream(val) {

    if (!val) return "";

    const s = val.toString().trim();

    // 1. Common Core (1st Year)

    if (s.includes("مشترك") && s.includes("علوم")) return "common_science"; // جذع مشترك علوم وتكنولوجيا

    if (s.includes("مشترك") && s.includes("آداب")) return "common_arts";   // جذع مشترك آداب

    // 2. Science

    if (s.includes("علوم") && s.includes("تجريبية")) return "science";

    // Check for "علوم" without "مشترك" or "اسلامية" or "انسانية" -> likely 'science' if 2nd/3rd year context via other means, but safer to be specific.

    if (s.includes("علوم") && s.includes("طبيعية")) return "science";

    // 3. Math

    if (s.includes("رياضيات") && !s.includes("تقني")) return "math";

    // 4. Tech Math (Branches)

    // 4. Tech Math (Branches)

    if (s.includes("هندسة") && s.includes("مدنية")) return "tech_math_civil";

    if (s.includes("هندسة") && s.includes("ميكانيكية")) return "tech_math_mech";

    if (s.includes("هندسة") && s.includes("كهربائية")) return "tech_math_elec";

    if (s.includes("هندسة") && s.includes("طرائق")) return "tech_math_methods";

    if (s.includes("تقني") && s.includes("رياض")) return "tech_math"; // General bucket fallback

    // 5. Management

    if (s.includes("تسيير") && s.includes("اقتصاد")) return "management";

    // 6. Languages

    if (s.includes("لغات") && s.includes("أجنبية")) return "languages";

    if (s.includes("لغات") && !s.includes("عربية")) return "languages"; // Helper

    // 7. Arts (Philosophy)

    if (s.includes("آداب") && s.includes("فلسفة")) return "arts";

    if (s.includes("فلسفة") && !s.includes("آداب")) return "arts"; // Just Philosophy

    // Fallback: If it's already a code

    if (['science', 'math', 'tech_math', 'management', 'languages', 'arts', 'common_science', 'common_arts',

        'tech_math_civil', 'tech_math_mech', 'tech_math_elec', 'tech_math_methods'].includes(s)) return s;

    return s;

}
