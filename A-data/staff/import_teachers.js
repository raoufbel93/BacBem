/**
 * Teacher & Supervisor Import Logic - منطق استيراد الأساتذة والمشرفين
 */

var selectedFile = null;
var importMode = 'update'; // 'update' or 'replace'

/**
 * Normalize Arabic text for better matching
 */
function normalizeArabic(text) {
    if (!text) return '';
    return String(text).trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ');
}

/**
 * Convert Excel serial date number to yyyy-mm-dd string
 * Excel serial dates count days since 1899-12-30
 */
function excelDateToString(value) {
    if (!value) return '';
    var str = String(value).trim();

    // Check for DD/MM/YYYY format
    var slashParts = str.split('/');
    if (slashParts.length === 3) {
        var d = slashParts[0].padStart(2, '0');
        var m = slashParts[1].padStart(2, '0');
        var y = slashParts[2];
        // Ensure y is 4 digits or logic might fail for older dates
        if (y.length === 2) y = (parseInt(y) < 50 ? '20' : '19') + y;
        return y + '-' + m + '-' + d;
    }

    // Check for DD-MM-YYYY format
    var dashParts = str.split('-');
    if (dashParts.length === 3 && dashParts[2].length === 4) {
        // Only if it's not already YYYY-MM-DD
        if (dashParts[0].length <= 2) {
            var d = dashParts[0].padStart(2, '0');
            var m = dashParts[1].padStart(2, '0');
            var y = dashParts[2];
            return y + '-' + m + '-' + d;
        }
    }

    // If it's already a date string (yyyy-mm-dd), return as-is
    if (str.indexOf('-') !== -1 && str.split('-')[0].length === 4) return str;

    // If it's a number (Excel serial date)
    var num = parseFloat(str);
    if (isNaN(num) || num < 1) return str;
    // Excel epoch: 1899-12-30
    var epoch = new Date(1899, 11, 30);
    var date = new Date(epoch.getTime() + Math.floor(num) * 86400000);
    var y = date.getFullYear();
    var m = ('0' + (date.getMonth() + 1)).slice(-2);
    var d = ('0' + date.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
}

/**
 * Log message to the UI
 */
function log(message, type = 'info') {
    const logArea = document.getElementById('logArea');
    if (!logArea) return;

    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    const now = new Date().toLocaleTimeString();
    entry.textContent = `[${now}] ${message}`;
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
}

/**
 * Set import mode
 */
function setImportMode(mode) {
    importMode = mode;
    document.querySelectorAll('.mode-option').forEach(opt => opt.classList.remove('active'));
    if (mode === 'update') document.getElementById('modeUpdate').classList.add('active');
    else document.getElementById('modeReplace').classList.add('active');

    log(`تم تغيير وضع الاستيراد إلى: ${mode === 'update' ? 'دمج وتحديث' : 'حذف واستبدال'}`, 'info');
}

/**
 * Handle file selection
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    selectedFile = file;
    document.getElementById('processContainer').classList.remove('no-file-selected');
    log(`تم اختيار الملف: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'success');
}

/**
 * Drag and Drop Handlers
 */
const dropArea = document.getElementById('dropArea');
if (dropArea) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
    });

    dropArea.addEventListener('drop', e => {
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.xls') || file.name.endsWith('.xlsx'))) {
            selectedFile = file;
            document.getElementById('processContainer').classList.remove('no-file-selected');
            log(`تم إفلات الملف: ${file.name}`, 'success');
        } else {
            log('نوع الملف غير مدعوم. يرجى اختيار ملف Excel.', 'error');
        }
    });
}

/**
 * Process the selected file
 */
async function processFile() {
    if (!selectedFile) return;

    const btn = document.getElementById('btnProcess');
    const progContainer = document.getElementById('progressContainer');
    const progBar = document.getElementById('progressBar');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> جاري المعالجة...';
    progContainer.style.display = 'block';
    progBar.style.width = '10%';

    log("بدء قراءة الملف...", 'info');

    try {
        const settings = await window.DB.getSettings() || {};
        const academicYear = settings.currentAcademicYear || DB.getCurrentAcademicYear();

        const buffer = await selectedFile.arrayBuffer();
        let rawText = "";
        
        // --- Encoding Detection (Legacy Windows-1256 support) ---
        const uint8 = new Uint8Array(buffer);
        const decoderUtf8 = new TextDecoder("utf-8");
        const textUtf8 = decoderUtf8.decode(uint8);
        
        // Simple check for Arabic garbled text or keywords
        const isHtml = textUtf8.includes('<table') || textUtf8.includes('<html');
        const hasArabicKeywords = textUtf8.includes('اللقب') || textUtf8.includes('الاسم') || textUtf8.includes('الرتبة');
        
        if (isHtml && !hasArabicKeywords) {
             try {
                 const decoder1256 = new TextDecoder("windows-1256");
                 const text1256 = decoder1256.decode(uint8);
                 if (text1256.includes('اللقب') || text1256.includes('الاسم')) {
                     log("تم اكتشاف ترميز Windows-1256 (قديم). جاري التحويل...", 'info');
                     // Convert back to buffer for XLSX to read correctly as string
                     const workbook = XLSX.read(text1256, { type: 'string' });
                     processWorkbook(workbook);
                     return;
                 }
             } catch(e) { console.error("Encoding error:", e); }
        }

        const workbook = XLSX.read(uint8, { type: 'array' });

        function processWorkbook(workbook) {
            if (workbook.SheetNames.length === 0) throw new Error("الملف لا يحتوي على أوراق (Sheets).");

            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            log(`تم تحميل الملف، جاري البحث عن البيانات (تم العثور على ${rows.length} سطر)...`, 'info');
            continueProcess(rows);
        }

        processWorkbook(workbook);
        return; // Exit main processFile, logic continues in continueProcess

    } catch (error) {
        log(`خطأ: ${error.message}`, 'error');
        Swal.fire({ icon: 'error', title: 'فشل الاستيراد', text: error.message });
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play-circle me-2"></i> إعادة المحاولة';
    }
}

async function continueProcess(rows) {
    const btn = document.getElementById('btnProcess');
    const progBar = document.getElementById('progressBar');
    
    try {
        const settings = await window.DB.getSettings() || {};
        const academicYear = settings.currentAcademicYear || DB.getCurrentAcademicYear();
        
        progBar.style.width = '30%';

        const teachersToImport = [];
        const supervisorsToImport = [];
        const workersToImport = [];
        let skippedCount = 0;

        // Robust Column Search
        let colMap = { lastName: -1, firstName: -1, rank: -1, subject: -1, birthDate: -1, grade: -1, effectiveDate: -1, jobCode: -1 };

        for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i];
            if (!row) continue;

            row.forEach((cell, idx) => {
                const txt = String(cell || '').trim();
                if (txt.includes('اللقب')) colMap.lastName = idx;
                if (txt.includes('الاسم') || txt.includes('الإسم')) colMap.firstName = idx;
                if (txt.includes('الرتبة')) colMap.rank = idx;
                if (txt.includes('المادة')) colMap.subject = idx;
                if (txt.includes('تاريخ الميلاد') || txt.includes('تاريخ الازدياد') || txt.includes('الميلاد') || txt.includes('الازدياد')) colMap.birthDate = idx;
                if (txt === 'الدرجة' || txt.includes('الدرجة')) colMap.grade = idx;
                if (txt.includes('تاريخ السريان') || txt.includes('السريان') || txt.includes('تاريخ التنصيب')) colMap.effectiveDate = idx;
                if (txt.includes('الرمز') || txt.includes('الرمز الوظيفي') || txt.includes('رمز')) colMap.jobCode = idx;
            });

            if (colMap.lastName !== -1 && colMap.firstName !== -1) {
                log(`تم اكتشاف رؤوس الأعمدة في السطر ${i + 1}.`, 'success');
                break;
            }
        }

        if (colMap.lastName === -1) {
            log("لم يتم العثور على رؤوس الأعمدة تلقائياً، جاري استخدام التنسيق الافتراضي...", 'warning');
            colMap = { lastName: 2, firstName: 3, rank: 5, subject: 6, birthDate: 4, grade: 7, effectiveDate: 8, jobCode: 1 };
        }

        progBar.style.width = '50%';

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 3) continue;

            const lastName = String(row[colMap.lastName] || '').trim();
            const firstName = String(row[colMap.firstName] || '').trim();
            const rank = String(row[colMap.rank] || '').trim();
            const subject = String(row[colMap.subject] || '').trim();
            const fullName = `${lastName} ${firstName}`.trim();

            // Extract additional fields (convert Excel serial dates)
            const birthDate = colMap.birthDate !== -1 ? excelDateToString(row[colMap.birthDate]) : '';
            const grade = colMap.grade !== -1 ? String(row[colMap.grade] || '').trim() : '';
            const effectiveDate = colMap.effectiveDate !== -1 ? excelDateToString(row[colMap.effectiveDate]) : '';
            const jobCode = colMap.jobCode !== -1 ? String(row[colMap.jobCode] || '').trim() : '';

            if (lastName.includes('اللقب') || (!lastName && !firstName)) continue;

            // Classification Logic
            let isWorker = rank.includes("عامل مهني") || rank.includes("عامل مهنى") || rank.includes("عون خدمة") || rank.includes("عون الخدمة") || rank.includes("حارس") || rank.includes("عون وقاية") || rank.includes("عون الوقاية") || rank.includes("سائق");

            if (rank.startsWith('أستاذ') || rank.includes('متعاقد')) {
                // It's a Teacher
                teachersToImport.push({
                    id: 'teacher_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    last_name: lastName,
                    first_name: firstName,
                    dob: birthDate,
                    rank: rank,
                    subject: subject,
                    grade: grade,
                    effectiveDate: effectiveDate,
                    receptionHours: [],
                    isSubjectResponsible: false,
                    responsibleClasses: [],
                    isExempt: false,
                    academic_year: academicYear
                });
            } else if (isWorker) {
                // It's a Worker
                workersToImport.push({
                    id: 'worker_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    name: fullName,
                    rank: rank,
                    dob: birthDate,
                    grade: grade,
                    effectiveDate: effectiveDate,
                    jobCode: jobCode
                });
            } else if (rank) {
                // It's a Supervisor or Administrator (anything else with a rank)
                supervisorsToImport.push({
                    id: 'sup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    name: fullName,
                    rank: rank,
                    dob: birthDate,
                    grade: grade,
                    effectiveDate: effectiveDate,
                    jobCode: jobCode
                });
            } else {
                skippedCount++;
            }

            if (i % 50 === 0) {
                progBar.style.width = (50 + (i / rows.length * 40)) + '%';
                await new Promise(r => setTimeout(r, 0));
            }
        }

        log(`مكتشف: ${teachersToImport.length} أستاذ، ${supervisorsToImport.length} مشرف/إداري، ${workersToImport.length} عامل.`, 'info');

        if (teachersToImport.length === 0 && supervisorsToImport.length === 0 && workersToImport.length === 0) {
            throw new Error("لم يتم العثور على أية بيانات صالحة في الملف.");
        }

        progBar.style.width = '95%';
        log("جاري حفظ البيانات...", 'info');

        // 1. Save Teachers
        let finalTeachers = [];
        if (importMode === 'update') {
            const existing = await DB.getTeachers();
            
            // Map 1: Full key (Name + Subject)
            const existingMapFull = new Map();
            // Map 2: Name only (if unique)
            const existingMapName = new Map();
            const nameFrequency = new Map();

            existing.forEach(t => {
                const fullKey = `${normalizeArabic(t.last_name)}|${normalizeArabic(t.first_name)}|${normalizeArabic(t.subject)}`;
                existingMapFull.set(fullKey, t);

                const nameKey = `${normalizeArabic(t.last_name)}|${normalizeArabic(t.first_name)}`;
                nameFrequency.set(nameKey, (nameFrequency.get(nameKey) || 0) + 1);
                existingMapName.set(nameKey, t);
            });

            const mergedCount = { teachers: 0, fields: 0 };

            teachersToImport.forEach(newT => {
                const normLast = normalizeArabic(newT.last_name);
                const normFirst = normalizeArabic(newT.first_name);
                const normSub = normalizeArabic(newT.subject);
                
                const fullKey = `${normLast}|${normFirst}|${normSub}`;
                const nameKey = `${normLast}|${normFirst}`;
                
                let oldT = existingMapFull.get(fullKey);
                
                // If not found by full key, try name key IF it's unique in DB
                if (!oldT && existingMapName.has(nameKey) && nameFrequency.get(nameKey) === 1) {
                    oldT = existingMapName.get(nameKey);
                }

                if (oldT) {
                    let changed = false;
                    // Merge fields if they are missing or different
                    if (newT.dob && (!oldT.dob || oldT.dob === '—' || oldT.dob === '-')) {
                        oldT.dob = newT.dob;
                        changed = true;
                    }
                    if (newT.grade && (!oldT.grade || oldT.grade === '—' || oldT.grade === '-')) {
                        oldT.grade = newT.grade;
                        changed = true;
                    }
                    if (newT.effectiveDate && (!oldT.effectiveDate || oldT.effectiveDate === '—' || oldT.effectiveDate === '-')) {
                        oldT.effectiveDate = newT.effectiveDate;
                        changed = true;
                    }
                    if (newT.rank && (!oldT.rank || oldT.rank === '—' || oldT.rank === '-')) {
                        oldT.rank = newT.rank;
                        changed = true;
                    }
                    // Update subject if it was empty in DB but present in file
                    if (newT.subject && (!oldT.subject || oldT.subject === '—' || oldT.subject === '-')) {
                        oldT.subject = newT.subject;
                        changed = true;
                    }
                    
                    if (changed) mergedCount.teachers++;
                } else {
                    existing.push(newT);
                }
            });
            finalTeachers = existing;
            if (mergedCount.teachers > 0) {
                log(`تم تحديث البيانات التكميلية (تاريخ الميلاد، الدرجة، إلخ) لـ ${mergedCount.teachers} أستاذ.`, 'success');
            }
        } else {
            finalTeachers = teachersToImport;
        }
        await DB.saveTeachers(finalTeachers);

        // 2. Save Supervisors
        let finalSupervisors = [];
        if (importMode === 'update') {
            const existing = await DB.get('supervisorsList') || [];
            const existingMap = new Map(existing.map(s => [s.name, s]));

            supervisorsToImport.forEach(newS => {
                if (existingMap.has(newS.name)) {
                    const oldS = existingMap.get(newS.name);
                    if (!oldS.dob && newS.dob) oldS.dob = newS.dob;
                    if (newS.rank) oldS.rank = newS.rank;
                } else {
                    existing.push(newS);
                }
            });
            finalSupervisors = existing;
        } else {
            finalSupervisors = supervisorsToImport;
        }
        await DB.set('supervisorsList', finalSupervisors);

        // 3. Save Workers
        let finalWorkers = [];
        if (importMode === 'update') {
            const existing = await DB.get('workersList') || [];
            const existingMap = new Map(existing.map(w => [w.name, w]));

            workersToImport.forEach(newW => {
                if (existingMap.has(newW.name)) {
                    const oldW = existingMap.get(newW.name);
                    if (!oldW.dob && newW.dob) oldW.dob = newW.dob;
                    if (newW.rank) oldW.rank = newW.rank;
                } else {
                    existing.push(newW);
                }
            });
            finalWorkers = existing;
        } else {
            finalWorkers = workersToImport;
        }
        await DB.set('workersList', finalWorkers);

        progBar.style.width = '100%';
        log("اكتملت العملية بنجاح!", 'success');

        const successMsg = `تم استيراد ${teachersToImport.length} أستاذ، ${supervisorsToImport.length} مشرف/إداري، و ${workersToImport.length} عامل.`;
        document.getElementById('successMsg').textContent = successMsg;
        const modal = new bootstrap.Modal(document.getElementById('successModal'));
        modal.show();

    } catch (error) {
        log(`خطأ: ${error.message}`, 'error');
        Swal.fire({ icon: 'error', title: 'فشل الاستيراد', text: error.message });
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play-circle me-2"></i> إعادة المحاولة';
    }
}
