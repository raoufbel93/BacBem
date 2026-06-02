/**
 * FET Import Logic
 * Handles XML parsing, data mapping, and importing schedules.
 */

let xmlDoc = null;
let fetTeachers = [];
let fetClasses = []; // Subgroups from FET
let fetActivities = [];

let appTeachers = [];
let appClasses = [];
let isSecondary = false; // Education stage
let mappings = {
    teachers: {},
    classes: {}
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadAppData();
    setupFileUpload();
    restoreAnalysisState(); // Restore if exists

    // Expose functions globally to ensure HTML access
    window.analyzeFile = analyzeFile;
    window.executeImport = executeImport;

    // Direct Event Binding
    const btnExecute = document.getElementById('btnExecuteImport');
    if (btnExecute) {
        console.log("Found Execute Button, attaching listener");
        btnExecute.addEventListener('click', () => {
            console.log("Execute Button Clicked via Listener");
            executeImport();
        });
    } else {
        console.warn("Execute Button NOT found during init");
    }
});

async function loadAppData() {
    // Load Teachers
    appTeachers = await DB.getTeachers() || [];

    // Load Students to get Classes
    const students = await DB.getStudents() || [];
    const classSet = new Set();
    const settings = await DB.getSettings() || {};
    isSecondary = settings.educationStage === 'secondary';
    const separator = isSecondary ? 'ث' : 'م';

    // NEW: Map class names to their dominant stream
    // mappings.classDetails = { '3ث01': { level: 3, stream: 'math' } }
    mappings.classDetails = {};

    students.forEach(s => {
        if (s.level && s.class) {
            const levelAbbr = getLevelAbbreviation(s.level, isSecondary);
            const levelNum = levelAbbr.replace(/[^\d]/g, '');
            const classNum = String(s.class).padStart(2, '0');
            const className = `${levelNum}${separator}${classNum}`;
            classSet.add(className);

            // Capture stream
            if (isSecondary && s.stream) {
                if (!mappings.classDetails[className]) {
                    mappings.classDetails[className] = { counts: {} };
                }
                // Count references to streams in this class to find dominant one
                mappings.classDetails[className].counts[s.stream] = (mappings.classDetails[className].counts[s.stream] || 0) + 1;
            }
        }
    });

    // Resolve dominant stream for each class
    Object.keys(mappings.classDetails).forEach(cls => {
        const counts = mappings.classDetails[cls].counts;
        const dominant = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        mappings.classDetails[cls] = dominant; // Just store the stream code
    });

    // Sort classes
    appClasses = Array.from(classSet).sort();
}

/**
 * File Upload Handling
 */
function setupFileUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    };

    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    };

    dropZone.ondragleave = () => {
        dropZone.classList.remove('dragover');
    };

    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    };
}

function handleFile(file) {
    if (file.type !== 'text/xml' && !file.name.endsWith('.xml')) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'الرجاء اختيار ملف XML صالح.' });
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(e.target.result, "text/xml");

        // Basic Validation
        if (xmlDoc.getElementsByTagName('fet').length === 0) {
            // Some FET exports (custom ones) might not have <fet> root, check for <Activities_Timetable> or <Activities>
            if (xmlDoc.getElementsByTagName('Activities_Timetable').length === 0 &&
                xmlDoc.getElementsByTagName('Activities').length === 0 &&
                xmlDoc.getElementsByTagName('Teachers_Timetable').length === 0) {
                Swal.fire({ icon: 'error', title: 'خطأ', text: 'الملف لا يبدو أنه ملف FET صالح.' });
                return;
            }
        }

        document.getElementById('fileInfo').style.display = 'block';
        document.getElementById('fileInfo').textContent = `تم تحميل الملف: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        document.getElementById('analyzeAction').style.display = 'block';
    };
    reader.readAsText(file);
}

/**
 * Analysis & Parsing
 */
const analyzeFile = window.analyzeFile = function () {
    console.log('[Import] analyzeFile() Called');
    if (!xmlDoc) {
        console.error('[Import] No XML Document loaded');
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'Please select a file first.' });
        return;
    }

    try {
        console.log('[Import] XML loaded, detecting format...');
        // Detect Format
        const isTeachersTimetable = xmlDoc.getElementsByTagName('Teachers_Timetable').length > 0;

        if (isTeachersTimetable) {
            console.log('[Import] Format: Teachers_Timetable');
            parseTeachersTimetableFormat();
        } else {
            console.warn('[Import] unsupported format');
            Swal.fire({ icon: 'error', title: 'تنسيق غير مدعوم', text: "تنسيق الملف غير مدعوم حالياً. يرجى استخدام ملف 'Teachers Timetable'." });
            return;
        }

        console.log(`[Import] Parsed: ${fetTeachers.length} Teachers, ${fetClasses.length} Classes, ${fetActivities.length} Activities`);

        // Update stats
        document.getElementById('countTeachers').textContent = fetTeachers.length;
        document.getElementById('countClasses').textContent = fetClasses.length;
        document.getElementById('countActivities').textContent = fetActivities.length;

        // Run Auto Mapping
        console.log('[Import] Running Auto Mapping...');
        runAutoMapping();

        // NEW: Extract Streams & Render Mapping
        console.log('[Import] Extracting Streams...');
        extractFetStreams();
        console.log('[Import] Rendering Stream Table...');
        renderStreamMappingTable();

        // Update stats with distinct mapped count
        const uniqueMapped = new Set(Object.values(mappings.classes).filter(c => c)).size;
        document.getElementById('countClasses').textContent = uniqueMapped;

        // Populate Preview
        populatePreviewTeachers();

        // Render UI
        document.getElementById('analysisResults').style.display = 'block';
        console.log('[Import] UI Updated (Results Visible)');

        // Show Reset Button
        const resetBtn = document.getElementById('resetImportBtn');
        if (resetBtn) resetBtn.style.display = 'inline-block';

        renderMappingTables();

        // Save State
        saveAnalysisState();
        console.log('[Import] Analysis Complete & Saved');

    } catch (error) {
        console.error('[Import] Critical Error during Analysis:', error);
        Swal.fire({ icon: 'error', title: 'خطأ', text: `An error occurred during analysis: ${error.message}` });
    }
}

/**
 * Parsing for <Teachers_Timetable> format
 */
function parseTeachersTimetableFormat() {
    fetTeachers = [];
    fetClasses = [];
    fetActivities = [];
    const classSet = new Set();

    const teacherNodes = xmlDoc.getElementsByTagName('Teacher');

    for (let i = 0; i < teacherNodes.length; i++) {
        const teacherNode = teacherNodes[i];
        const teacherName = teacherNode.getAttribute('name');

        if (!teacherName) continue;
        fetTeachers.push(teacherName);

        const dayNodes = teacherNode.getElementsByTagName('Day');

        for (let d = 0; d < dayNodes.length; d++) {
            const dayNode = dayNodes[d];
            const dayNameRaw = dayNode.getAttribute('name'); // e.g. "الأحد ص"

            const hourNodes = dayNode.getElementsByTagName('Hour');

            for (let h = 0; h < hourNodes.length; h++) {
                const hourNode = hourNodes[h];
                const hourName = hourNode.getAttribute('name'); // e.g. "حصة1"

                // Check if activity exists
                const studentsNode = hourNode.getElementsByTagName('Students')[0];
                const subjectNode = hourNode.getElementsByTagName('Subject')[0];

                if (studentsNode) {
                    const rawName = studentsNode.getAttribute('name') || '';
                    // Normalize: Trim and collapse multiple spaces
                    const studentName = rawName.trim().replace(/\s+/g, ' ');
                    const subjectName = subjectNode ? subjectNode.getAttribute('name') : '';

                    // Extract Tags to detect TD/TP
                    const tagNodes = hourNode.getElementsByTagName('Activity_Tag');
                    const tags = [];
                    for (let t = 0; t < tagNodes.length; t++) {
                        tags.push(tagNodes[t].getAttribute('name'));
                    }

                    if (studentName) {
                        classSet.add(studentName);

                        fetActivities.push({
                            teacher: teacherName,
                            group: studentName, // Used for class mapping
                            students: studentName, // NEW: Used for stream extraction
                            dayRaw: dayNameRaw,
                            hourRaw: hourName,
                            subject: subjectName.trim(),
                            room: hourNode.getElementsByTagName('Room')[0]?.getAttribute('name') || '',
                            tags: tags
                        });
                    }
                }
            }
        }
    }

    fetClasses = Array.from(classSet).sort();
}

const SYSTEM_STREAMS = [
    { code: 'common_science', name: 'جذع مشترك علوم وتكنولوجيا' },
    { code: 'common_arts', name: 'جذع مشترك آداب' },
    { code: 'science', name: 'علوم تجريبية' },
    { code: 'math', name: 'رياضيات' },
    { code: 'tech_math', name: 'تقني رياضي' },
    { code: 'tech_math_civil', name: 'تقني رياضي هندسة مدنية' },
    { code: 'tech_math_elec', name: 'تقني رياضي هندسة كهربائية' },
    { code: 'tech_math_methods', name: 'تقني رياضي هندسة الطرائق' },
    { code: 'tech_math_mech', name: 'تقني رياضي هندسة ميكانيكية' },
    { code: 'management', name: 'تسيير واقتصاد' },
    { code: 'languages', name: 'لغات أجنبية' },
    { code: 'arts', name: 'آداب وفلسفة' }
];

const STREAM_ABBR = {
    'common_science': 'ج م ع',
    'common_arts': 'ج م أ',
    'science': 'ع ت',
    'math': 'رياضي',
    'tech_math': 'تق',
    'tech_math_civil': 'تق.م',
    'tech_math_elec': 'تق.ك',
    'tech_math_methods': 'تق.ط',
    'tech_math_mech': 'تق.مي',
    'management': 'تسيير',
    'languages': 'لغ',
    'arts': 'آداب'
};

let fetStreams = [];

/**
 * Extract unique stream names from FET Data
 */
function extractFetStreams() {
    const rawStreams = new Set();

    // Iterate over all activities to find unique student group names
    // We assume the stream name matches the pattern in parseSecondaryStream
    // BUT here we just extract the RAW name (normalized) to let user map it.

    // Improve: We can try to deduplicate slightly (e.g. "3 Math 1" and "3 Math 2" -> "Math"?)
    // Or just list ALL unique groups? No, that's too many (3M1, 3M2...).
    // We need to extract the "Stream Part".

    // Heuristic: Remove digits?

    fetClasses.forEach(clsName => {
        // e.g. "3 رياضي 1", "1 ج م ع 2"
        // Remove numbers
        let base = clsName.replace(/[0-9]/g, '').trim();
        // Remove common separators
        base = base.replace(/[\-_]/g, ' ').trim();
        // Collapse spaces
        base = base.replace(/\s+/g, ' ');

        if (base.length > 1) { // Filter out single chars or empty
            rawStreams.add(base);
        }
    });

    fetStreams = Array.from(rawStreams).sort();

    // Initialize mappings
    if (!mappings.streams) mappings.streams = {};

    // Auto-pre-fill if we recognize it (optional helper)
    fetStreams.forEach(fs => {
        if (!mappings.streams[fs]) {
            // Try our parser just for suggestion
            const suggestion = parseSecondaryStream(fs);
            if (suggestion) mappings.streams[fs] = suggestion;
            else mappings.streams[fs] = '';
        }
    });
}

function renderStreamMappingTable() {
    const container = document.getElementById('streamsMappingSection');

    if (!isSecondary) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    const tbody = document.getElementById('streamsMappingBody');
    tbody.innerHTML = fetStreams.map(fs => {
        const match = mappings.streams[fs];
        const status = match ? 'status-match' : 'status-missing';
        const statusText = match ? 'تم الربط' : 'غير مربوط';

        const options = SYSTEM_STREAMS.map(ss =>
            `<option value="${ss.code}" ${match === ss.code ? 'selected' : ''}>${ss.name}</option>`
        ).join('');

        return `
            <tr>
                <td style="text-align: right; font-weight:bold;">${fs}</td>
                <td><span class="status-badge ${status}">${statusText}</span></td>
                <td>
                    <select class="mapping-select" onchange="updateStreamMapping('${fs}', this.value)">
                        <option value="">-- اختر الشعبة --</option>
                        ${options}
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}

function updateStreamMapping(fetStream, sysStream) {
    if (!mappings.streams) mappings.streams = {};
    mappings.streams[fetStream] = sysStream;
    renderStreamMappingTable();
    saveAnalysisState();
}

/**
 * Mapping Logic
 */
function runAutoMapping() {
    // RESET
    mappings.teachers = {};
    mappings.classes = {};

    // Map Teachers: Fuzzy Match
    fetTeachers.forEach(fetName => {
        const normFet = fetName.trim().toLowerCase();

        let match = appTeachers.find(t => {
            const tName = `${t.last_name} ${t.first_name}`.toLowerCase();
            const tNameRev = `${t.first_name} ${t.last_name}`.toLowerCase();
            return tName === normFet || tNameRev === normFet;
        });

        if (!match) {
            match = appTeachers.find(t => {
                const tName = `${t.last_name} ${t.first_name}`.toLowerCase();
                return normFet.includes(t.last_name.toLowerCase()) && normFet.includes(t.first_name.toLowerCase());
            });
        }

        mappings.teachers[fetName] = match ? match.id : null;
    });

    // Map Classes
    fetClasses.forEach(fetName => {
        // Parsing logic for "3AM1" -> "3م01" or "1AS" -> "1ث"
        let target = null;

        // NEW: Group Detection
        // Handle "4m4 f1", "4m4 g1", "4م4 ف1", "4م4-1"
        // Regex: (space/dash/underscore/empty) + (f/g/ف) + optional space + digit at end
        // OR simply "space + digit" if we are careful (unsafe)
        // Let's make it robust for given examples:
        // " f1", "-f1", "f1" (no space if previous char is digit?), " g1", " ف1"

        let distinctGroup = null;
        let baseFetName = fetName;

        // Regex Explanation:
        // (?:[\s\-_]*) -> Match optional separator (space, dash, underscore)
        // (?:f|g|ف) -> Match Group indicator (F, G, Fouj)
        // \s* -> Optional space
        // (\d+) -> Group Number
        // $ -> End of string
        const groupMatch = fetName.match(/(?:[\s\-_]*)(?:f|g|ف|g|f)\s*(\d+)$/i);

        if (groupMatch) {
            distinctGroup = parseInt(groupMatch[1]);
            // Remove the match from the name, also removing any preceding separator caught by the groupMatch logic if handled
            // But straightforward replace might be safer:
            baseFetName = fetName.replace(groupMatch[0], '').trim();

            // Clean up any trailing separators left
            baseFetName = baseFetName.replace(/[\-_]$/, '');
        }

        // Normalize: 3AM1 -> Level 3, Type AM, Class 1
        // Patterns:
        // 1AM1, 1M1, 1م1 -> Middle School
        // 1AS1, 1S1, 1ث1 -> Secondary School

        // Normalize: 3AM1 -> Level 3, Type AM, Class 1
        // Patterns:
        // 1AM1, 1M1, 1م1 -> Middle School
        // 1AS1, 1S1, 1ث1 -> Secondary School

        const norm = baseFetName.toUpperCase().replace(/\s+/g, '');

        const nums = norm.match(/\d+/g);
        if (nums && nums.length >= 1) {
            const level = nums[0];
            const clsNum = nums.length > 1 ? String(nums[1]).padStart(2, '0') : '01'; // Default to 01 if no number?

            // Guess type based on text
            let isSec = norm.includes('AS') || norm.includes('S') || norm.includes('ث');
            let isMid = norm.includes('AM') || norm.includes('M') || norm.includes('م');

            // Secondary School Smart Mapping
            if (!isMid && (isSec || parseSecondaryStream(baseFetName))) {
                const streamCode = parseSecondaryStream(baseFetName);
                if (streamCode) {
                    // Get all app classes for this level
                    const levelPrefix = `${level}ث`;
                    const levelClasses = appClasses.filter(c => c.startsWith(levelPrefix));

                    // Filter by stream
                    const candidates = levelClasses.filter(c => {
                        const cStream = mappings.classDetails[c];
                        if (!cStream) return false;
                        if (cStream === streamCode) return true;
                        // Loose match for Tech Math (if App uses specific but FET uses general)
                        if (streamCode === 'tech_math' && cStream.startsWith('tech_math')) return true;
                        return false;
                    });

                    if (candidates.length > 0) {
                        // Strategy: Relative Index Match preferred for mixed systems
                        // e.g. "3Sc1" (1st Science Class) might be "3ث01"
                        // e.g. "3L1" (1st Lang Class) might be "3ث04"

                        // Check if we have a class number from FET
                        const hasFetNum = nums.length > 1;
                        const fetNumVal = hasFetNum ? parseInt(nums[1]) : 1; // Default to 1st if no number

                        // Relative Match
                        const relativeIdx = fetNumVal - 1;
                        if (relativeIdx >= 0 && relativeIdx < candidates.length) {
                            target = candidates[relativeIdx];
                        } else {
                            // Fallback: Explicit Global Match?
                            // e.g. "3Sc5" -> "3ث05" (if it is Science)
                            const suffix = String(fetNumVal).padStart(2, '0');
                            const explicit = `${levelPrefix}${suffix}`;
                            if (candidates.includes(explicit)) {
                                target = explicit;
                            } else {
                                // Last resort: First candidate
                                target = candidates[0];
                            }
                        }
                    }
                }
            }

            // Fallback: Check app settings or available classes
            // For now, try both
            if (!target) {
                const tryM = `${level}م${clsNum}`;
                const tryS = `${level}ث${clsNum}`;

                if (appClasses.includes(tryM)) target = tryM;
                else if (appClasses.includes(tryS)) target = tryS;
                // Fuzzy: just one match
                else {
                    // Should we be looser? "3AM1" -> "3م01"
                    // If the user's XML has "3AM1", it matches "3م01"
                    if (isMid) target = tryM; // Even if not currently in list? No, must map to existing.
                    if (isSec) target = tryS;
                }
            }
        }

        mappings.classes[fetName] = target;
    });
}

function parseSecondaryStream(name) {
    const n = name.toLowerCase().replace(/[\s\._\-]+/g, ''); // Remove spaces, dots, underscores, dashes

    /**
     * Common Core (Jodho3 Moshtaraka)
     */
    // Common Science (Joda3 Moshtarak 3olom)
    if (
        n.includes('جذعمشتركتكنولوجيا') || n.includes('جذعمشتركهندسة') || // Old/Var
        n.includes('جذعمشتركعلوم') ||
        n.includes('جمع') || n.includes('ج.م.ع') ||
        n.includes('tcs') || n.includes('sct') || n.includes('jst') ||
        n.includes('1as') || // Often 1AS matches Common Science if not specified otherwise
        n.includes('common_science')
    ) return 'common_science';

    // Common Arts (Joda3 Moshtarak Adab)
    if (
        n.includes('جذعمشتركآداب') ||
        n.includes('جمآ') || n.includes('ج.م.أ') || n.includes('جمأ') ||
        n.includes('tcl') || n.includes('let') ||
        n.includes('common_arts')
    ) return 'common_arts';

    /**
     * Streams (Sho3ab)
     */

    // Mathematics (Riyadiyat)
    if (
        n.includes('رياضيات') || n.includes('رياضي') ||
        n.includes('math') || n.includes('mr') || n.includes('m') || // 'm' is risky? usually accompanied by level e.g. 2M
        (n.includes('ر') && !n.includes('ت')) // 'r' but not 'tr' (tech)
    ) return 'math';

    // Experimental Sciences (3olom Tajribiya)
    if (
        n.includes('علومطبيعية') || n.includes('علومتجريبية') || n.includes('علوم') ||
        n.includes('عت') || n.includes('ع.ت') ||
        n.includes('sc') || n.includes('exp') ||
        n.includes('science')
    ) return 'science';

    // Technical Mathematical (Teqni Riyadi) - Sub-specialties
    // Civil Engineering
    if (n.includes('هندسةمدنية') || n.includes('مدنية') || n.includes('gc') || n.includes('civ') || n.includes('ترم')) return 'tech_math_civil';
    // Electrical Engineering
    if (n.includes('هندسةكهربائية') || n.includes('كهربائية') || n.includes('ge') || n.includes('elec') || n.includes('ترك')) return 'tech_math_elec';
    // Process Engineering (Methods)
    if (n.includes('هندسةالطرائق') || n.includes('طرائق') || n.includes('gp') || n.includes('meth') || n.includes('ترط')) return 'tech_math_methods';
    // Mechanical Engineering
    if (n.includes('هندسةميكانيكية') || n.includes('ميكانيكية') || n.includes('gm') || n.includes('mec') || n.includes('ترمي')) return 'tech_math_mech';

    // Technical Mathematical - General
    if (
        n.includes('تقنيرياضي') || n.includes('تقني') ||
        n.includes('تر') || n.includes('ت.ر') || n.includes('تق') ||
        n.includes('tm') || n.includes('mt') || n.includes('tech')
    ) return 'tech_math';

    // Foreign Languages (Loghat Ajnabiya)
    if (
        n.includes('لغاتأجنبية') || n.includes('لغات') ||
        n.includes('لغ') || n.includes('ل.أ') || n.includes('لأ') ||
        n.includes('le') || n.includes('fl') || n.includes('lang')
    ) return 'languages';

    // Management & Economy (Tasyir wa Iqtisad)
    if (
        n.includes('تسييرواقتصاد') || n.includes('تسيير') || n.includes('اقتصاد') ||
        n.includes('تإ') || n.includes('ت.إ') || n.includes('تس') ||
        n.includes('ge') || n.includes('mng') || n.includes('gest') ||
        n.includes('management')
    ) return 'management';

    // Literature & Philosophy (Adab wa Falsafa)
    if (
        n.includes('آدابوفلسفة') || n.includes('فلسفة') || n.includes('آداب') ||
        n.includes('أف') || n.includes('أ.ف') ||
        n.includes('lp') || n.includes('lit') || n.includes('ph') ||
        n.includes('arts')
    ) return 'arts';

    // Ambiguous 'A' (Adab)
    if (n.includes('أ') && !n.includes('1')) return 'arts'; // Usually 2A, 3A = Arts. 1A = Common Arts (check Level elsewhere if needed)

    return null;
}

function renderMappingTables() {
    // Teachers
    const tBody = document.getElementById('teachersMappingBody');
    tBody.innerHTML = fetTeachers.map(fetName => {
        const matchId = mappings.teachers[fetName];
        const status = matchId ? 'status-match' : 'status-missing';
        const statusText = matchId ? 'مطابق' : 'غير موجود';

        return `
            <tr>
                <td style="direction: ltr; text-align: right;">${fetName}</td>
                <td><span class="status-badge ${status}">${statusText}</span></td>
                <td>
                    <select class="mapping-select" onchange="updateTeacherMapping('${fetName}', this.value)">
                        <option value="">-- تجاهل --</option>
                        ${appTeachers.map(t => `<option value="${t.id}" ${t.id === matchId ? 'selected' : ''}>${t.last_name} ${t.first_name}</option>`).join('')}
                    </select>
                </td>
            </tr>
        `;
    }).join('');

    // Classes
    const cBody = document.getElementById('classesMappingBody');
    cBody.innerHTML = fetClasses.map(fetName => {
        const match = mappings.classes[fetName];
        const status = match ? 'status-match' : 'status-missing';
        const statusText = match ? 'مطابق' : 'غير موجود';

        return `
            <tr>
                <td style="direction: ltr; text-align: right;">${fetName}</td>
                <td><span class="status-badge ${status}">${statusText}</span></td>
                <td>
                    <select class="mapping-select" onchange="updateClassMapping('${fetName}', this.value)">
                        <option value="">-- تجاهل --</option>
                        ${appClasses.map(c => `<option value="${c}" ${c === match ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}

function updateTeacherMapping(fetName, appId) {
    mappings.teachers[fetName] = appId || null;
}

function updateClassMapping(fetName, appClass) {
    mappings.classes[fetName] = appClass || null;
}

function getTeacherName(id) {
    const t = appTeachers.find(x => x.id === id);
    return t ? `${t.last_name} ${t.first_name}` : '';
}

/**
 * Helpers
 */
function getLevelAbbreviation(level, isSecondary) {
    if (isSecondary) {
        if (level.includes('1') || level.includes('أولى')) return 'ث1';
        if (level.includes('2') || level.includes('ثانية')) return 'ث2';
        if (level.includes('3') || level.includes('ثالثة')) return 'ث3';
    } else {
        if (level.includes('1') || level.includes('أولى')) return 'م1';
        if (level.includes('2') || level.includes('ثانية')) return 'م2';
        if (level.includes('3') || level.includes('ثالثة')) return 'م3';
        if (level.includes('4') || level.includes('رابعة')) return 'م4';
    }
    return '';
}

/**
 * Execution
 */
const executeImport = window.executeImport = async function (silent = false, redirect = true) {
    // if (!silent && !confirm("هل أنت متأكد من بدء الاستيراد؟\nسيتم حذف الجداول الحالية.")) return;
    console.log('[Import] Execute Import Called');

    // console.log('[Import] Execute Import Called');
    console.log('[Import] executeImport() Called via ' + (redirect ? 'UI' : 'Code'));

    try {
        // VALIDATION: Ensure Manual Stream Mapping is Complete
        // alert("Starting Import Debug...");
        console.log('[Import] Validating Mappings...');
        console.log('[Import] Current Stream Mappings:', mappings.streams);

        if (isSecondary && fetStreams.length > 0) {
            const unmappedStreams = fetStreams.filter(fs => !mappings.streams[fs]);
            if (unmappedStreams.length > 0) {
                console.warn(`[Import] Unmapped Streams: ${unmappedStreams.join(', ')}`);
                Swal.fire({ icon: 'warning', title: 'تنبيه', text: `تنبيه: يوجد ${unmappedStreams.length} شعب غير مربوطة.\nيرجى ربط جميع الشعب قبل الاستيراد.` });
                return;
            }
        } else {
            console.log('[Import] Skipping stream validation (not secondary or no streams)');
        }

        // Day Mapping
        const dayKeywords = {
            'الأحد': 'sunday', 'الاحد': 'sunday',
            'الاثنين': 'monday', 'الإثنين': 'monday', 'ألاثنين': 'monday',
            'الثلاثاء': 'tuesday',
            'الأربعاء': 'wednesday', 'الاربعاء': 'wednesday',
            'الخميس': 'thursday',
            'Sunday': 'sunday', 'Monday': 'monday', 'Tuesday': 'tuesday',
            'Wednesday': 'wednesday', 'Thursday': 'thursday',
            'Dimanche': 'sunday', 'Lundi': 'monday', 'Mardi': 'tuesday',
            'Mercredi': 'wednesday', 'Jeudi': 'thursday'
        };

        // Period Mapping
        // Logic:
        // "ص" (Morning) -> periods 1, 2, 3, 4
        // "م" (Evening) -> periods 5, 6, 7, 8
        // "حصة1" -> index 0 (+1 or +5)

        let importCount = 0;
        const newAssignments = {};

        // Save
        // MODIFIED: Grouping logic to handle G1+G2 -> Whole Class

        // 1. collect all potential assignments first
        const rawAssignments = {}; // key: teacherId -> day -> period -> [list of acts]

        fetActivities.forEach(act => {
            const appTeacherId = mappings.teachers[act.teacher];
            const appClass = mappings.classes[act.group]; // Base class name

            if (!appTeacherId || !appClass) return;

            // Determine Day
            let appDay = null;
            for (const [key, val] of Object.entries(dayKeywords)) {
                if (act.dayRaw.includes(key)) {
                    appDay = val;
                    break;
                }
            }
            if (!appDay) return;

            // Determine Period
            // Check for Morning/Evening flags
            const isMorning = /(?:^|[\s\-_])(?:ص|صباح)(?:$|[\s\-_])/.test(act.dayRaw) || act.dayRaw.includes('صبا');
            const isEvening = /(?:^|[\s\-_])(?:م|ع|مساء|عشية)(?:$|[\s\-_])/.test(act.dayRaw) || act.dayRaw.includes('مسا');

            // Parse Hour Number
            const hourMatch = act.hourRaw.match(/\d+/);
            if (!hourMatch) return;

            let periodNum = parseInt(hourMatch[0]);

            // Heuristic: If value >= 8, treat as Hour (8:00 etc)
            if (periodNum >= 8) {
                if (periodNum === 8) periodNum = 1;
                else if (periodNum === 9) periodNum = 2;
                else if (periodNum === 10) periodNum = 3;
                else if (periodNum === 11 || periodNum === 12) periodNum = 4;
                else if (periodNum === 13) periodNum = 5;
                else if (periodNum === 14) periodNum = 6;
                else if (periodNum === 15) periodNum = 7;
                else if (periodNum >= 16) periodNum = 8;
            } else {
                // Treat as Period Index (1-8)
                // Apply evening offset if detected
                if (isEvening && periodNum <= 4) {
                    periodNum += 4;
                }
            }

            // Validity check (1-8)
            if (periodNum < 1 || periodNum > 8) return;

            // Detect Type (TD/TP)
            let type = detectActivityType(act.subject, act.tags);

            // NEW: Detect Group
            let groupNum = 0; // 0 = Whole class
            const groupMatch = act.group.match(/(?:[\s\-_]*)(?:f|g|ف|g|f)\s*(\d+)$/i);
            if (groupMatch) {
                groupNum = parseInt(groupMatch[1]);
            }

            // Add to temp collection
            if (!rawAssignments[appTeacherId]) rawAssignments[appTeacherId] = {};
            if (!rawAssignments[appTeacherId][appDay]) rawAssignments[appTeacherId][appDay] = {};
            if (!rawAssignments[appTeacherId][appDay][periodNum]) rawAssignments[appTeacherId][appDay][periodNum] = [];

            rawAssignments[appTeacherId][appDay][periodNum].push({
                class: appClass,
                type: type,
                subject: act.subject, // NEW
                group: groupNum,
                room: act.room || '',
                originalGroup: act.group, // debug info
                originalStudents: act.students // NEW: Captured for stream detection fallback
            });
        });

        // 2. Process and Merge
        Object.keys(rawAssignments).forEach(tid => {
            if (!newAssignments[tid]) newAssignments[tid] = {};

            Object.keys(rawAssignments[tid]).forEach(day => {
                if (!newAssignments[tid][day]) newAssignments[tid][day] = {};

                Object.keys(rawAssignments[tid][day]).forEach(pStr => {
                    const pNum = parseInt(pStr);
                    const acts = rawAssignments[tid][day][pNum];

                    if (acts.length === 0) return;

                    // Merge Logic
                    // If multiple acts share the same class, merge them into group 0
                    // If diff classes, we can't really support it in UI yet (except maybe overwrite or ignore)
                    // We'll take the first class, but check if we should merge groups.

                    // Group by ClassName
                    const byClass = {};
                    acts.forEach(a => {
                        if (!byClass[a.class]) byClass[a.class] = [];
                        byClass[a.class].push(a);
                    });

                    // For valid assignment, we pick the dominant one (or the only one)
                    // If collision (two different classes), we pick first (limitation)
                    const targetClass = Object.keys(byClass)[0];
                    const classActs = byClass[targetClass];

                    let finalGroup = 0;
                    let finalType = classActs[0].type;
                    let finalRoom = classActs[0].room;

                    // Check groups
                    const groups = classActs.map(a => a.group).filter(g => g > 0);
                    // If we have distinct groups (e.g. 1 and 2), we merge -> 0
                    const distinctGroups = [...new Set(groups)];

                    if (distinctGroups.length > 1) {
                        finalGroup = 0; // Merge!
                    } else if (distinctGroups.length === 1) {
                        finalGroup = distinctGroups[0];
                    } else {
                        finalGroup = 0;
                    }

                    // Optimization: If only 1 act, use its group (already done by logic above?)
                    // If 1 act has group 1, distinct=1 => final=1. Correct.
                    // If 2 acts, group 1 and 2, distinct=2 => final=0. Correct.

                    // NEW: Use Manual Mapping
                    let finalStream = '';
                    if (isSecondary && (classActs[0].originalStudents || classActs[0].originalGroup)) {
                        // Re-derive base name to match the key in mappings.streams
                        const originalName = classActs[0].originalStudents || classActs[0].originalGroup;
                        let base = originalName.replace(/[0-9]/g, '').trim();
                        base = base.replace(/[\-_]/g, ' ').trim();
                        base = base.replace(/\s+/g, ' ');

                        if (mappings.streams && mappings.streams[base]) {
                            finalStream = mappings.streams[base];
                            console.log(`[Import] Mapped '${base}' -> '${finalStream}'`);
                        }
                    } else {
                        console.warn('[Import] No originalStudents or originalGroup found for act', classActs[0]);
                    }

                    // Fallback: If App mapping didn't provide a stream, try to parse it from the attributes
                    // We stored 'originalGroup' but maybe not the original 'Students' name attached here?
                    // The 'class' in rawAssignments IS the App class, but we don't have the original FET name here easily...
                    // Wait, rawAssignments uses 'appClass' which comes from mappings.classes[act.students].
                    // We need the original FET name to parse.

                    // Let's check if we can get it.
                    // In step 1 loop: rawAssignments... .push({ ..., originalStudents: act.students })
                    // We need to pass it through.

                    // Correction: I need to update Step 1 first to save 'originalStudents'.
                    // But wait, I can't update Step 1 in this block.

                    // Actually, I can use the 'targetClass' to find which FET name mapped to it? No, one-to-many reverse is hard.

                    // Let's ASSUME I added 'originalStudents' to the object in Step 1.
                    // I will add it to the replacement content below, but I must also update Step 1 in a separate edit or this one if contiguous?
                    // They are far apart (Lines 654 vs 710).
                    // I will update Step 1 in a separate call.
                    // BUT for now, let's implement the logic assuming 'originalStudents' is available.

                    if (!newAssignments[tid][day]) newAssignments[tid][day] = {}; // safety

                    newAssignments[tid][day][pNum] = {
                        class: targetClass,
                        type: localizeFetTerm(finalType, 'activity_type'),
                        group: finalGroup,
                        stream: finalStream,
                        room: localizeFetTerm(finalRoom)
                    };
                    importCount++;
                });
            });
        });

        // Save
        await DB.set('teacherAssignments', newAssignments);

        // Save
        await DB.set('teacherAssignments', newAssignments);

        if (redirect) {
            console.log('[Import] Redirecting to assignment.html...');
            window.location.href = 'assignment.html';
        }
    } catch (e) {
        console.error('[Import] Error in executeImport:', e);
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'An error occurred during import: ' + e.message });
    }
}

/**
 * Preview Logic
 */
function populatePreviewTeachers() {
    const select = document.getElementById('previewTeacherSelect');
    select.innerHTML = '<option value="">-- اختر الأستاذ (FET) --</option>';

    fetTeachers.sort().forEach(tName => {
        select.innerHTML += `<option value="${tName}">${tName}</option>`;
    });

    // Populate App Teachers Dropdown
    const appSelect = document.getElementById('previewAppTeacherSelect');
    if (appSelect) {
        appSelect.innerHTML = '<option value="">-- اختر الأستاذ (في التطبيق) --</option>';
        appTeachers.forEach(t => {
            appSelect.innerHTML += `<option value="${t.id}">${t.last_name} ${t.first_name}</option>`;
        });
    }
}

function updatePreviewAppTeacherSelect(fetName) {
    const appSelect = document.getElementById('previewAppTeacherSelect');
    if (!appSelect) return;

    const mappedId = mappings.teachers[fetName];
    if (mappedId) {
        appSelect.value = mappedId;
    } else {
        appSelect.value = "";
    }
}

async function transferAssignmentFromPreview() {
    const fetName = document.getElementById('previewTeacherSelect').value;
    const appId = document.getElementById('previewAppTeacherSelect').value;

    if (!fetName) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'الرجاء اختيار أستاذ من FET أولاً.' });
        return;
    }

    // Update Mapping
    updateTeacherMapping(fetName, appId);

    // Auto-Run Import (Silent, No Redirect)
    await executeImport(true, false);

    // Update UI in Mapping Table
    renderMappingTables();

    // Visual Feedback
    Swal.fire({
        icon: 'success',
        title: 'تم الربط',
        text: `تم ربط "${fetName}" بـ "${getTeacherName(appId) || 'لا أحد'}" وحفظ التغييرات.`,
        timer: 2000,
        showConfirmButton: false
    });
}

function renderPreviewSchedule(teacherName) {
    const tbody = document.getElementById('previewScheduleBody');
    const container = document.getElementById('previewContainer');

    if (!teacherName) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    tbody.innerHTML = '';

    // Filter activities for this teacher
    const activities = fetActivities.filter(a => a.teacher === teacherName);

    // Structure: Day -> Period -> Content
    const schedule = {};
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    // Map Arabic/English days from FET to our English keys if needed
    // The parser stores 'dayRaw' which is e.g. "الأحد ص"

    activities.forEach(act => {
        // Parse Day
        let dayKey = '';
        if (act.dayRaw.includes('الأحد') || act.dayRaw.includes('الاحد')) dayKey = 'Sunday';
        else if (act.dayRaw.includes('الاثنين') || act.dayRaw.includes('الإثنين') || act.dayRaw.includes('ألاثنين')) dayKey = 'Monday';
        else if (act.dayRaw.includes('الثلاثاء')) dayKey = 'Tuesday';
        else if (act.dayRaw.includes('الأربعاء') || act.dayRaw.includes('الاربعاء')) dayKey = 'Wednesday';
        else if (act.dayRaw.includes('الخميس')) dayKey = 'Thursday';

        if (!dayKey) return;

        // Parse Period (Rows)
        // Check Morning vs Evening
        const isMorning = /(?:^|[\s\-_])(?:ص|صباح)(?:$|[\s\-_])/.test(act.dayRaw) || act.dayRaw.includes('صبا');
        const isEvening = /(?:^|[\s\-_])(?:م|ع|مساء|عشية)(?:$|[\s\-_])/.test(act.dayRaw) || act.dayRaw.includes('مسا');

        // Parse Hour Number "حصة1" -> 1
        const hourMatch = act.hourRaw.match(/\d+/);
        if (!hourMatch) return;

        let periodNum = parseInt(hourMatch[0]);

        // Offset for evening
        // In preview, we want rows 1-8? Or 1-4 Morning / 1-4 Evening?
        // Let's use 1-8 convention
        if (isEvening) periodNum += 4;

        if (!schedule[periodNum]) schedule[periodNum] = {};
        if (!schedule[periodNum][dayKey]) schedule[periodNum][dayKey] = [];

        schedule[periodNum][dayKey].push(act);
    });

    // Render Rows 1-8
    for (let p = 1; p <= 8; p++) {
        const row = document.createElement('tr');

        // Header Cell
        const isM = p <= 4;
        const pLabel = `حصة ${isM ? p : p - 4} <br> <small>${isM ? 'صباح' : 'مساء'}</small>`;
        row.innerHTML = `<td class="period-cell" style="font-weight:bold; background:var(--bg-color);">${pLabel}</td>`;

        DAYS.forEach(day => {
            const cell = document.createElement('td');
            const acts = schedule[p]?.[day];

            if (acts && acts.length > 0) {
                // Combine multiple activities (e.g. half-groups)
                cell.innerHTML = acts.map(a => {
                    // Try to show mapped class if possible, or raw group
                    const mapped = mappings.classes[a.group];
                    // Group Num
                    let groupBadge = '';
                    const groupMatch = a.group.match(/(?:[\s\-_]*)(?:f|g|ف|g|f)\s*(\d+)$/i);
                    if (groupMatch) {
                        groupBadge = `<span class="group-badge" style="background:#9b59b6; color:white; padding:2px 5px; border-radius:4px; font-size:0.7em;">ف${groupMatch[1]}</span>`;
                    }

                    const clsDisplay = mapped ? mapped : a.group; // Show mapped class name preferably

                    // Stream Badge (NEW)
                    // Try to resolve stream from manual mapping
                    let streamBadge = '';
                    let base = ''; // Lifted scope
                    let streamClass = '';
                    const originalName = a.students || a.group;
                    if (isSecondary && originalName) {
                        base = originalName.replace(/[0-9]/g, '').trim();
                        base = base.replace(/[\-_]/g, ' ').trim();
                        base = base.replace(/\s+/g, ' ');

                        if (mappings.streams && mappings.streams[base]) {
                            const streamCode = mappings.streams[base];
                            // Use Abbreviation if available, or just code
                            const streamText = STREAM_ABBR[streamCode] || streamCode;
                            streamBadge = `<span class="stream-badge" style="background:#e67e22; color:white; padding:2px 5px; border-radius:4px; font-size:0.75em; margin-right:3px;">${streamText}</span>`;
                            streamClass = `stream-${streamCode}`;
                        }
                    }

                    // Format Display: Level - Stream - Class
                    let displayHtml = '';
                    const levelSeparator = isSecondary ? 'ث' : 'م';
                    const clsName = mapped ? mapped : a.group;
                    const nameRegex = new RegExp(`^(\\d+)${levelSeparator}(\\d+)$`);
                    const nameMatch = clsName.match(nameRegex);

                    if (nameMatch) {
                        const levelPart = nameMatch[1];
                        const classPart = parseInt(nameMatch[2]);

                        displayHtml += `<span style="font-weight:bold; color:#555;">${levelPart}</span> `;
                        displayHtml += `<span style="color:#888; font-size:0.9em; margin:0 1px;">${levelSeparator}</span> `;

                        if (streamBadge) {
                            displayHtml += `${streamBadge} `;
                        }

                        displayHtml += `<span style="font-weight:bold; color:#000;">${classPart}</span>`;
                    } else {
                        displayHtml += `${clsName} `;
                        if (streamBadge) displayHtml += `${streamBadge} `;
                    }

                    if (groupBadge) displayHtml += ` ${groupBadge}`;

                    // Determine Type for Preview
                    const type = detectActivityType(a.subject, a.tags);
                    const typeDisplay = type ? `(${type})` : '';

                    // Room display
                    const roomDisplay = a.room ? localizeFetTerm(a.room) : '<span style="color:#ccc; font-style:italic;">--</span>';

                    return `
                        <div class="preview-activity ${streamClass}" style="padding:6px; margin-bottom:4px; border-radius:6px; border:1px solid #ccc; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                            <div style="font-weight:bold; color:#1565c0; margin-bottom:2px;">
                                <i class="fas fa-users" style="color:#7fb3d5; margin-left:3px;"></i> ${displayHtml}
                            </div>
                            <div style="font-size:0.85em; color:#444; margin-bottom:1px;">
                                <i class="fas fa-book" style="color:#aaa; margin-left:3px;"></i> ${localizeFetTerm(a.subject, 'activity_type')} <span style="color:#e67e22; font-weight:bold;">${typeDisplay}</span>
                            </div>
                            <div style="font-size:0.8em; color:#666;">
                                <i class="fas fa-map-marker-alt" style="color:#aaa; margin-left:4px;"></i> ${roomDisplay}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                cell.innerHTML = '<span style="color:#eee;">-</span>';
            }
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    }
}

/**
 * Persistence Logic
 */
function saveAnalysisState() {
    const state = {
        fetTeachers,
        fetClasses,
        fetActivities,
        fetStreams, // NEW
        mappings,
        stats: {
            teachers: document.getElementById('countTeachers').textContent,
            classes: document.getElementById('countClasses').textContent,
            activities: document.getElementById('countActivities').textContent
        }
    };
    localStorage.setItem('fet_import_state', JSON.stringify(state));
}

function restoreAnalysisState() {
    const saved = localStorage.getItem('fet_import_state');
    if (!saved) return;

    try {
        const state = JSON.parse(saved);
        fetTeachers = state.fetTeachers || [];
        fetClasses = state.fetClasses || [];
        fetActivities = state.fetActivities || [];
        fetStreams = state.fetStreams || []; // NEW
        mappings = state.mappings || { teachers: {}, classes: {}, streams: {} };

        // Restore UI
        if (state.stats) {
            document.getElementById('countTeachers').textContent = state.stats.teachers;
            document.getElementById('countClasses').textContent = state.stats.classes;
            document.getElementById('countActivities').textContent = state.stats.activities;
        }

        document.getElementById('analysisResults').style.display = 'block';
        const resetBtn = document.getElementById('resetImportBtn');
        if (resetBtn) resetBtn.style.display = 'inline-block';

        populatePreviewTeachers();
        renderMappingTables();
        if (fetStreams.length > 0) renderStreamMappingTable(); // NEW

    } catch (e) {
        console.error('Failed to restore state', e);
        localStorage.removeItem('fet_import_state');
    }
}

async function clearAnalysisState() {
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "هل أنت متأكد من مسح النتائج وإعادة البدء؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، مسح',
        cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
        localStorage.removeItem('fet_import_state');
        location.reload();
    }
}

/**
 * Localization Helper
 */
function localizeFetTerm(term, type) {
    if (!term) return '';
    let localized = term.trim();

    // Activity Types
    if (type === 'activity_type') {
        const up = localized.toUpperCase();
        if (up.includes('TD')) return 'أ.م';
        if (up.includes('TP')) return 'أ.تط';
        if (up.includes('COURS') || up === 'C') return 'محاضرة';
        return localized;
    }

    // Room Names
    // S -> القاعة
    // Atelier -> ورشة
    // Labo -> مخبر
    // Dessin -> رسم
    // Info -> إ.آلي
    // Labo Info -> م.إ.آلي

    // Replace whole words or patterns
    localized = localized.replace(/\bLabo Info\b/gi, 'م.إ.آلي');
    localized = localized.replace(/\bInfo\b/gi, 'إ.آلي');
    localized = localized.replace(/\bLabo\b/gi, 'مخبر');
    localized = localized.replace(/\bAtelier\b/gi, 'ورشة');
    localized = localized.replace(/\bDessin\b/gi, 'رسم');

    // S followed by digits -> القاعة
    localized = localized.replace(/\bS\s*(\d+)/gi, 'القاعة $1');
    localized = localized.replace(/\bS(\d+)/gi, 'القاعة $1');

    return localized;
}

/**
 * Activity Type Detection Helper
 * @param {string} subject
 * @param {string[]} tags
 * @returns {string} TD, TP, Remedial, or ''
 */
function detectActivityType(subject, tags) {
    const combinedInfo = (subject + ' ' + (tags || []).join(' ')).toUpperCase();
    if (combinedInfo.includes('TD')) return 'TD';
    if (combinedInfo.includes('TP')) return 'TP';
    if (combinedInfo.includes('استدراك') || combinedInfo.includes('REMEDIAL')) return 'Remedial';
    return '';
}

console.log("✅ import_fet.js Loaded Successfully (v2.2)"); // DEBUG: Load Confirmation
