/**

 * Assignment Page JavaScript

 * Manages teacher schedule assignments with Modal UI

 */

// Global variables

let allTeachers = [];

let allClasses = [];

let allStreams = {}; // Store streams by level: { '1': ['science', 'math'], '2': [...] }

let allStudentsData = []; // Store students data for stream filtering

let teacherAssignments = {};

let currentTeacherId = null;

let institutionSettings = {};

let isSecondary = false; // Track education stage

// Modal State

let currentSelection = {

    day: null,

    periodId: null,

    selectedClass: null,

    selectedType: ''

};

let currentModalLevel = '1'; // Default tab

let currentModalStream = ''; // Current selected stream for secondary

// Days and periods configuration

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

const PERIODS = [

    { id: 1, name: 'الحصة 1', session: 'morning' },

    { id: 2, name: 'الحصة 2', session: 'morning' },

    { id: 3, name: 'الحصة 3', session: 'morning' },

    { id: 4, name: 'الحصة 4', session: 'morning' },

    { id: 5, name: 'الحصة 5', session: 'evening' },

    { id: 6, name: 'الحصة 6', session: 'evening' },

    { id: 7, name: 'الحصة 7', session: 'evening' },

    { id: 8, name: 'الحصة 8', session: 'evening' }

];

// Stream names translation (English to Arabic)

const STREAM_NAMES_AR = {

    'common_science': 'جذع مشترك علوم وتكنولوجيا',

    'common_arts': 'جذع مشترك آداب',

    'science': 'علوم تجريبية',

    'math': 'رياضيات',

    'tech_math': 'تقني رياضي',

    'tech_math_civil': 'تقني رياضي هندسة مدنية',

    'tech_math_elec': 'تقني رياضي هندسة كهربائية',

    'tech_math_methods': 'تقني رياضي هندسة الطرائق',

    'tech_math_mech': 'تقني رياضي هندسة ميكانيكية',

    'management': 'تسيير واقتصاد',

    'languages': 'لغات أجنبية',

    'arts': 'آداب وفلسفة'

};

// Stream abbreviations for display in schedule table

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

// ==================== MULTI-SUBJECT MAP ====================
// Maps a teacher's primary subject to alternative subjects they can also teach
// Keys are matched with includes() for flexibility

const MULTI_SUBJECT_MAP = {
    middle: [
        {
            match: ['التاريخ والجغرافيا', 'تاريخ', 'جغرافيا'],
            subjects: ['تاريخ', 'جغرافيا', 'تربية مدنية']
        },
        {
            match: ['اللغة العربية', 'عربية'],
            subjects: ['اللغة العربية', 'التربية الإسلامية']
        },
        {
            match: ['العلوم الطبيعية', 'علوم الطبيعة والحياة', 'علوم طبيعية'],
            subjects: ['العلوم الطبيعية', 'المعلوماتية']
        },
        {
            match: ['العلوم الفيزيائية والتكنولوجيا', 'العلوم الفيزيائية', 'فيزياء', 'فيزيائية'],
            subjects: ['العلوم الفيزيائية والتكنولوجيا', 'المعلوماتية']
        }
    ],
    secondary: [
        {
            match: ['التاريخ والجغرافيا', 'تاريخ وجغرافيا', 'تاريخ', 'جغرافيا'],
            subjects: ['تاريخ', 'جغرافيا']
        },
        {
            match: ['الأدب العربي', 'اللغة العربية', 'لغة عربية', 'عربية'],
            subjects: ['الأدب العربي', 'العلوم الإسلامية']
        }
    ]
};

/**
 * Get available subjects for a teacher based on their primary subject
 * @param {string} teacherId - Teacher's unique ID
 * @returns {string[]|null} Array of subject options, or null if single-subject
 */
function getTeacherSubjectOptions(teacherId) {
    const teacher = allTeachers.find(t => t.id === teacherId);
    if (!teacher || !teacher.subject) return null;

    const stage = isSecondary ? 'secondary' : 'middle';
    const rules = MULTI_SUBJECT_MAP[stage] || [];
    const teacherSubject = teacher.subject.trim();

    for (const rule of rules) {
        const matched = rule.match.some(keyword => {
            // Exact match or the teacher's subject contains the keyword
            return teacherSubject === keyword || teacherSubject.includes(keyword);
        });
        if (matched) {
            return rule.subjects;
        }
    }

    return null; // Single-subject teacher
}

/**

 * Initialize page

 */

document.addEventListener('DOMContentLoaded', async function () {

    await loadData();

    populateTeacherSelect();

    // Close modal when clicking outside

    const modal = document.getElementById('assignmentModal');

    modal.addEventListener('click', function (e) {

        if (e.target === modal) {

            closeAssignmentModal();

        }

    });

});

/**

 * Load data from storage

 */

async function loadData() {

    // Load teachers

    allTeachers = await DB.getTeachers() || [];

    // Load students to extract classes

    const students = await DB.getStudents() || [];

    allStudentsData = students; // Store for stream filtering

    // Load settings first to determine education stage

    institutionSettings = await DB.getSettings() || {};

    isSecondary = institutionSettings.educationStage === 'secondary';

    if (students.length > 0) {

        extractClasses(students);

        if (isSecondary) {

            extractStreams(students);

        }

    }

    // Load existing assignments

    teacherAssignments = await DB.get('teacherAssignments') || {};

    // Populate level tabs based on education stage

    populateLevelTabs();

}

/**

 * Extract unique classes from students

 */

function extractClasses(students) {

    const classSet = new Set();

    const separator = isSecondary ? 'ث' : 'م';

    students.forEach(student => {

        if (student.level && student.class) {

            const levelAbbr = getLevelAbbreviation(student.level);

            // Format: 1م01 or 1ث01 (level number + separator + class number padded)

            const levelNum = levelAbbr.replace('م', '').replace('ث', '');

            const classNum = String(student.class).padStart(2, '0');

            const className = `${levelNum}${separator}${classNum}`;

            classSet.add(className);

        }

    });

    allClasses = Array.from(classSet).sort((a, b) => {

        // Sort by level then by class number

        const levelA = a.charAt(0);

        const levelB = b.charAt(0);

        const numA = parseInt(a.slice(2));

        const numB = parseInt(b.slice(2));

        if (levelA !== levelB) return levelA.localeCompare(levelB);

        return numA - numB;

    });

}

/**

 * Extract unique streams from students for secondary education

 */

function extractStreams(students) {

    allStreams = {};

    students.forEach(student => {

        if (student.level && student.stream) {

            const levelAbbr = getLevelAbbreviation(student.level);

            const levelNum = levelAbbr.replace('ث', '').replace('م', '');

            if (levelNum) {

                if (!allStreams[levelNum]) {

                    allStreams[levelNum] = new Set();

                }

                allStreams[levelNum].add(student.stream);

            }

        }

    });

    // Convert Sets to Arrays

    Object.keys(allStreams).forEach(level => {

        allStreams[level] = Array.from(allStreams[level]).sort();

    });

}

function getLevelAbbreviation(level) {

    if (isSecondary) {

        const abbrSec = {

            'أولى ثانوي': 'ث1',

            'ثانية ثانوي': 'ث2',

            'ثالثة ثانوي': 'ث3',

            '1 ثانوي': 'ث1',

            '2 ثانوي': 'ث2',

            '3 ثانوي': 'ث3',

            'السنة الأولى ثانوي': 'ث1',

            'السنة الثانية ثانوي': 'ث2',

            'السنة الثالثة ثانوي': 'ث3'

        };

        // Try direct match first

        if (abbrSec[level]) return abbrSec[level];

        // Fallback: extract number

        if (level.includes('1') || level.includes('أولى')) return 'ث1';

        if (level.includes('2') || level.includes('ثانية')) return 'ث2';

        if (level.includes('3') || level.includes('ثالثة')) return 'ث3';

        return '';

    } else {

        const abbr = {

            'أولى متوسط': 'م1',

            'ثانية متوسط': 'م2',

            'ثالثة متوسط': 'م3',

            'رابعة متوسط': 'م4',

            '1 متوسط': 'م1',

            '2 متوسط': 'م2',

            '3 متوسط': 'م3',

            '4 متوسط': 'م4'

        };

        // Try direct match first

        if (abbr[level]) return abbr[level];

        // Fallback: extract number

        if (level.includes('1') || level.includes('أولى') || level.includes('ولى')) return 'م1';

        if (level.includes('2') || level.includes('ثاني')) return 'م2';

        if (level.includes('3') || level.includes('ثالث')) return 'م3';

        if (level.includes('4') || level.includes('رابع')) return 'م4';

        return '';

    }

}

/**

 * Populate teacher select dropdown

 */

function populateTeacherSelect() {

    const select = document.getElementById('teacherSelect');

    if (!select) return;

    // Sort teachers alphabetically

    const sortedTeachers = [...allTeachers].sort((a, b) => {

        const nameA = `${a.last_name || ''} ${a.first_name || ''}`;

        const nameB = `${b.last_name || ''} ${b.first_name || ''}`;

        return nameA.localeCompare(nameB, 'ar');

    });

    select.innerHTML = '<option value="">-- اختر الأستاذ --</option>';

    sortedTeachers.forEach(teacher => {

        const teacherId = teacher.id || `${teacher.last_name}-${teacher.first_name}`;

        const option = document.createElement('option');

        option.value = teacherId;

        option.textContent = `${teacher.last_name || ''} ${teacher.first_name || ''}`;

        if (teacher.subject) {

            option.textContent += ` - ${teacher.subject}`;

        }

        select.appendChild(option);

    });

}

/**

 * Load teacher schedule

 */

function loadTeacherSchedule() {

    const select = document.getElementById('teacherSelect');

    const teacherId = select.value;

    if (!teacherId) {

        document.getElementById('emptyState').style.display = 'block';

        document.getElementById('scheduleTable').style.display = 'none';

        document.getElementById('legend').style.display = 'none';

        currentTeacherId = null;

        return;

    }

    currentTeacherId = teacherId;

    document.getElementById('emptyState').style.display = 'none';

    document.getElementById('scheduleTable').style.display = 'table';

    document.getElementById('legend').style.display = 'flex';

    renderScheduleTable();

}

/**

 * Render schedule table

 */

function renderScheduleTable() {

    const tbody = document.getElementById('scheduleBody');

    if (!tbody) return;

    tbody.innerHTML = '';

    const assignments = teacherAssignments[currentTeacherId] || {};

    PERIODS.forEach(period => {

        const row = document.createElement('tr');

        // Period cell

        const periodCell = document.createElement('td');

        periodCell.className = 'period-cell';

        periodCell.innerHTML = `<strong>${period.name}</strong><br><small>${period.session === 'morning' ? 'صباحية' : 'مسائية'}</small>`;

        row.appendChild(periodCell);

        // Day cells

        DAYS.forEach(day => {

            const cell = document.createElement('td');

            cell.className = `class-cell ${period.session}`;

            // Get current assignment

            const dayAssignments = assignments[day] || {};

            const assignment = dayAssignments[period.id];

            let contentHtml = '';

            let hasClass = false;

            if (assignment) {

                const className = typeof assignment === 'object' ? assignment.class : assignment;

                const type = typeof assignment === 'object' ? assignment.type : '';
                const subject = typeof assignment === 'object' ? assignment.subject : ''; // NEW
                const stream = typeof assignment === 'object' ? assignment.stream : '';
                const group = typeof assignment === 'object' ? assignment.group : 0;
                const room = typeof assignment === 'object' ? assignment.room : '';

                if (type === 'Remedial') {
                    // Special case for Remedial
                    contentHtml += `<div class="cell-meta"><span class="type-badge type-remedial" style="font-size: 1rem; padding: 6px 12px;">استدراك</span></div>`;
                    if (room) {
                        contentHtml += `<div class="cell-footer"><i class="fas fa-map-marker-alt"></i> ${room}</div>`;
                    }
                } else if (type === 'Reception') {
                    // Special case for Reception
                    contentHtml += `<div class="cell-meta"><span class="type-badge type-reception" style="font-size: 1rem; padding: 6px 12px;">استقبال</span></div>`;
                    if (room) {
                        contentHtml += `<div class="cell-footer"><i class="fas fa-map-marker-alt"></i> ${room}</div>`;
                    }
                } else if (className) {
                    hasClass = true;

                    // Apply Stream Class to Cell
                    if (isSecondary && stream) {
                        cell.classList.add(`stream-${stream}`);
                    }

                    // --- Header: Level - Stream - Class ---
                    let headerHtml = '';
                    const levelSeparator = isSecondary ? 'ث' : 'م';
                    // More flexible regex: Allow optional spaces/separators
                    const nameRegex = new RegExp(`^(\\d+)[\\s\\-_]?${levelSeparator}[\\s\\-_]?(\\d+)$`);
                    const nameMatch = className.match(nameRegex);

                    if (nameMatch) {
                        const levelPart = nameMatch[1];
                        const classPart = parseInt(nameMatch[2]);

                        // Swap colors: Level is Bold/Black (#000), Class is Grey (#555)
                        headerHtml += `<span class="level-badge" style="font-weight:bold; color:#000; font-size:1.1em;">${levelPart}</span>`;
                        headerHtml += `<span class="stage-badge" style="margin:0 2px; color:#888; font-size:0.9em;">${levelSeparator}</span>`;

                        if (isSecondary && stream) {
                            const streamDisplay = (typeof STREAM_ABBR !== 'undefined' && STREAM_ABBR[stream]) || stream;
                            headerHtml += `<span class="stream-badge" style="margin:0 4px; font-size:0.85em;">${streamDisplay}</span>`;
                        }

                        headerHtml += `<span class="class-num-badge" style="font-weight:bold; color:#555; font-size:1.1em;">${classPart}</span>`;
                    } else {
                        // Fallback
                        headerHtml += `<span class="class-badge">${className}</span>`;
                        if (isSecondary && stream) {
                            const streamDisplay = STREAM_ABBR[stream] || stream;
                            headerHtml += `<span class="stream-badge">${streamDisplay}</span>`;
                        }
                    }

                    // --- Meta: Group | Type ---
                    let metaHtml = '';

                    // NEW: Subject Display
                    if (subject) {
                        // Localize subject if needed, or use as is
                        // We might need a helper function or map if subjects are in French/Symbolic in FET
                        // For now, assume raw string is okay, or styling it
                        metaHtml += `<div class="params-badge" style="width:100%; text-align:center; margin-bottom:2px; font-weight:600; color:var(--primary-color); font-size:0.9em;">${subject}</div>`;
                    }

                    if (group) {
                        metaHtml += `<span class="group-badge">ف${group}</span>`;
                    }

                    if (type) {
                        let typeClass = '';
                        if (type === 'TD' || type === 'أ.م') typeClass = 'type-td';
                        else if (type === 'TP' || type === 'أ.تط') typeClass = 'type-tp';
                        else if (type === 'Reception' || type === 'استقبال') typeClass = 'type-reception';

                        const typeName = (type === 'TD' || type === 'أ.م') ? 'أ.م'
                            : ((type === 'TP' || type === 'أ.تط') ? 'أ.تط'
                                : ((type === 'Reception' || type === 'استقبال') ? 'استقبال' : type));

                        if (typeClass) {
                            metaHtml += `<span class="type-badge ${typeClass}">${typeName}</span>`;
                        } else {
                            metaHtml += `<span class="type-badge" style="background:#ddd; color:#333;">${typeName}</span>`;
                        }
                    }

                    // --- Footer: Room ---
                    let footerHtml = '';
                    if (room) {
                        footerHtml += `<i class="fas fa-map-marker-alt"></i> ${room}`;
                    }

                    // Assemble
                    contentHtml = `
                        <div class="cell-header">${headerHtml}</div>
                        ${metaHtml ? `<div class="cell-meta">${metaHtml}</div>` : ''}
                        ${footerHtml ? `<div class="cell-footer">${footerHtml}</div>` : ''}
                    `;
                }
            }

            if (!contentHtml) {
                contentHtml = `<span style="opacity: 0.3; font-size: 1.5rem;">+</span>`;
            }

            cell.innerHTML = `<div class="class-cell-content">${contentHtml}</div>`;
            cell.onclick = () => openAssignmentModal(day, period.id);

            if (hasClass) {
                cell.classList.add('has-class');
            }

            row.appendChild(cell);
        });

        tbody.appendChild(row);

    });

}

/**

 * MODAL FUNCTIONS

 */

function openAssignmentModal(day, periodId) {

    if (!currentTeacherId) return;

    // Set state

    currentSelection.day = day;

    currentSelection.periodId = periodId;

    // Get existing assignment

    const assigned = teacherAssignments[currentTeacherId]?.[day]?.[periodId];

    if (assigned) {

        if (typeof assigned === 'object') {

            currentSelection.selectedClass = assigned.class;

            currentSelection.selectedType = assigned.type || '';

        } else {

            currentSelection.selectedClass = assigned; // Legacy support

            currentSelection.selectedType = '';

        }

    } else {

        currentSelection.selectedClass = null;

        currentSelection.selectedType = '';

    }

    // Determine initial tab level from selected class, or default to 1

    if (currentSelection.selectedClass) {

        currentModalLevel = currentSelection.selectedClass.charAt(0);

    } else if (assigned && assigned.type === 'Remedial') {

        // If it's a remedial session, don't pre-select any level tab specific logic if not needed,

        // but maybe keep the default '1' or whatever was last valid.

        // Actually, for remedial, we might not care about the class grid.

    } else {

        currentModalLevel = '1';

    }

    // Update UI

    const dayName = {

        'sunday': 'الأحد', 'monday': 'الإثنين', 'tuesday': 'الثلاثاء',

        'wednesday': 'الأربعاء', 'thursday': 'الخميس'

    }[day];

    const periodName = PERIODS.find(p => p.id === periodId)?.name;

    document.getElementById('modalTitle').textContent = `إسناد حصة: ${dayName} - ${periodName}`;

    updateLevelTabs();

    // Show/hide stream selector based on education stage

    const streamSection = document.getElementById('streamSelectorSection');

    if (isSecondary && streamSection) {

        streamSection.style.display = 'flex';

        currentModalStream = ''; // Reset stream selection

        populateStreamSelect();

    } else if (streamSection) {

        streamSection.style.display = 'none';

    }

    renderModalClassGrid();

    updateTypeSelection();

    // Show/hide subject selector based on teacher's subject
    const subjectSection = document.getElementById('subjectSelectorSection');
    const subjectSelect = document.getElementById('subjectSelect');
    const subjectOptions = getTeacherSubjectOptions(currentTeacherId);

    if (subjectOptions && subjectSection && subjectSelect) {
        subjectSection.style.display = 'flex';
        subjectSelect.innerHTML = '';
        subjectOptions.forEach(subj => {
            const option = document.createElement('option');
            option.value = subj;
            option.textContent = subj;
            subjectSelect.appendChild(option);
        });
        // Pre-select if editing an existing assignment with a subject
        if (assigned && typeof assigned === 'object' && assigned.subject) {
            subjectSelect.value = assigned.subject;
        }
    } else if (subjectSection) {
        subjectSection.style.display = 'none';
    }

    // Show modal

    document.getElementById('assignmentModal').classList.add('show'); // CSS: display: flex via class

    document.getElementById('assignmentModal').style.display = 'flex';

    setTimeout(() => document.getElementById('assignmentModal').classList.add('show'), 10);

}

function closeAssignmentModal() {

    document.getElementById('assignmentModal').classList.remove('show');

    setTimeout(() => {

        document.getElementById('assignmentModal').style.display = 'none';

    }, 300);

}

function switchLevelTab(level) {

    currentModalLevel = level;

    updateLevelTabs();

    // Update stream select for secondary

    if (isSecondary) {

        currentModalStream = ''; // Reset stream when level changes

        populateStreamSelect();

    }

    renderModalClassGrid();

}

function updateLevelTabs() {

    document.querySelectorAll('.level-tab').forEach(tab => {

        const tabLevel = tab.getAttribute('data-level');

        if (tabLevel === currentModalLevel) {

            tab.classList.add('active');

        } else {

            tab.classList.remove('active');

        }

    });

}

/**

 * Populate level tabs based on education stage (middle/secondary)

 */

function populateLevelTabs() {

    const container = document.getElementById('modalLevelTabs');

    if (!container) return;

    container.innerHTML = '';

    if (isSecondary) {

        // Secondary: 3 levels

        const levels = [

            { num: '1', label: '1 ثانوي' },

            { num: '2', label: '2 ثانوي' },

            { num: '3', label: '3 ثانوي' }

        ];

        levels.forEach((lvl, idx) => {

            const div = document.createElement('div');

            div.className = 'level-tab' + (idx === 0 ? ' active' : '');

            div.setAttribute('data-level', lvl.num);

            div.textContent = lvl.label;

            div.onclick = () => switchLevelTab(lvl.num);

            container.appendChild(div);

        });

    } else {

        // Middle: 4 levels

        const levels = [

            { num: '1', label: '1 متوسط' },

            { num: '2', label: '2 متوسط' },

            { num: '3', label: '3 متوسط' },

            { num: '4', label: '4 متوسط' }

        ];

        levels.forEach((lvl, idx) => {

            const div = document.createElement('div');

            div.className = 'level-tab' + (idx === 0 ? ' active' : '');

            div.setAttribute('data-level', lvl.num);

            div.textContent = lvl.label;

            div.onclick = () => switchLevelTab(lvl.num);

            container.appendChild(div);

        });

    }

}

/**

 * Populate stream select dropdown based on current level (for secondary)

 */

function populateStreamSelect() {
    const select = document.getElementById('streamSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- جميع الشعب --</option>';

    const levelStreams = allStreams[currentModalLevel] || [];

    // Group tech_math variants into a single option
    const techMathVariants = ['tech_math_civil', 'tech_math_elec', 'tech_math_methods', 'tech_math_mech'];
    let hasTechMath = false;
    const filteredStreams = [];

    levelStreams.forEach(stream => {
        if (techMathVariants.includes(stream)) {
            if (!hasTechMath) {
                hasTechMath = true;
                filteredStreams.push('tech_math');
            }
        } else if (stream !== 'tech_math') {
            filteredStreams.push(stream);
        } else {
            if (!hasTechMath) {
                hasTechMath = true;
                filteredStreams.push('tech_math');
            }
        }
    });

    filteredStreams.forEach(stream => {
        const option = document.createElement('option');
        option.value = stream;
        option.textContent = STREAM_NAMES_AR[stream] || stream;
        select.appendChild(option);
    });

    // Reset selection
    select.value = currentModalStream;
}

/**

 * Handle stream selection change

 */

function onStreamChange() {

    const select = document.getElementById('streamSelect');

    currentModalStream = select ? select.value : '';

    renderModalClassGrid();

}

function renderModalClassGrid() {

    const grid = document.getElementById('modalClassGrid');

    grid.innerHTML = '';

    // Filter classes by current level - use appropriate separator

    const separator = isSecondary ? 'ث' : 'م';

    let levelClasses = allClasses.filter(c => c.startsWith(`${currentModalLevel}${separator}`));

    // For secondary, further filter by stream if selected

    if (isSecondary && currentModalStream) {
        // For tech_math, match all tech_math variants
        const techMathVariants = ['tech_math', 'tech_math_civil', 'tech_math_elec', 'tech_math_methods', 'tech_math_mech'];
        const isTechMathGroup = currentModalStream === 'tech_math';

        const classNumbersForStream = new Set();
        allStudentsData.forEach(student => {
            const streamMatch = isTechMathGroup
                ? techMathVariants.includes(student.stream)
                : student.stream === currentModalStream;

            if (streamMatch && student.level && student.class) {
                const levelAbbr = getLevelAbbreviation(student.level);
                const levelNum = levelAbbr.replace('ث', '').replace('م', '');
                if (levelNum === currentModalLevel) {
                    const classNum = String(student.class).padStart(2, '0');
                    const className = `${levelNum}${separator}${classNum}`;
                    classNumbersForStream.add(className);
                }
            }
        });
        levelClasses = levelClasses.filter(c => classNumbersForStream.has(c));
    }

    if (levelClasses.length === 0) {

        const message = isSecondary && currentModalStream

            ? 'لا توجد أفواج لهذه الشعبة في هذا المستوى'

            : 'لا توجد أفواج لهذا المستوى';

        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #999;">${message}</p>`;

        return;

    }

    levelClasses.forEach(cls => {

        const div = document.createElement('div');

        div.className = `class-option ${currentSelection.selectedClass === cls ? 'selected' : ''}`;

        div.textContent = cls;

        div.onclick = () => selectClass(cls);

        grid.appendChild(div);

    });

}

function selectClass(className) {

    // If clicking the same class, do we toggle off? Let's say yes, deselect.

    if (currentSelection.selectedClass === className) {

        currentSelection.selectedClass = null;

        // If deselected, effectively deleting assignments for this period?

        // Or just clearing validation?

        // Let's assume it clears the class.

        // If they want to clear, they should check "Delete".

        // But clicking again to toggle is intuitive.

        // Let's delete assignment if toggled off.

        deleteAssignment();

        return;

    } else {

        currentSelection.selectedClass = className;

    }

    // Auto-save immediately

    const { day, periodId, selectedClass, selectedType } = currentSelection;

    if (!teacherAssignments[currentTeacherId]) teacherAssignments[currentTeacherId] = {};

    if (!teacherAssignments[currentTeacherId][day]) teacherAssignments[currentTeacherId][day] = {};

    // For secondary, use the selected stream from the dropdown

    // If no stream is selected (showing all), try to find from student data

    let classStream = '';

    if (isSecondary) {

        if (currentModalStream) {

            // User selected a specific stream - use it

            classStream = currentModalStream;

        } else {

            // No stream filter selected - try to find from student data

            const classStudents = allStudentsData.filter(s => {

                if (!s.level || !s.class) return false;

                const levelAbbr = getLevelAbbreviation(s.level);

                const levelNum = levelAbbr.replace('ث', '').replace('م', '');

                const classNum = String(s.class).padStart(2, '0');

                const fullClassName = `${levelNum}ث${classNum}`;

                return fullClassName === selectedClass;

            });

            if (classStudents.length > 0 && classStudents[0].stream) {

                classStream = classStudents[0].stream;

            }

        }

    }

    teacherAssignments[currentTeacherId][day][periodId] = {

        class: selectedClass,

        type: selectedType,

        stream: classStream, // Store stream for display

        subject: getSelectedSubject() // Store selected subject

    };

    renderScheduleTable();

    saveAssignments(); // Save to LocalStorage

    closeAssignmentModal();

}

function updateTypeSelection() {

    // Reset all

    ['typeNone', 'typeTD', 'typeTP', 'typeRemedial', 'typeReception'].forEach(id => {

        document.getElementById(id).classList.remove('active');

    });

    // Set active

    if (currentSelection.selectedType === 'TD') {

        document.getElementById('typeTD').classList.add('active');

    } else if (currentSelection.selectedType === 'TP') {

        document.getElementById('typeTP').classList.add('active');

    } else if (currentSelection.selectedType === 'TP') {

        document.getElementById('typeTP').classList.add('active');

    } else if (currentSelection.selectedType === 'Remedial') {

        document.getElementById('typeRemedial').classList.add('active');

    } else if (currentSelection.selectedType === 'Reception') {
        document.getElementById('typeReception').classList.add('active');
    } else {

        document.getElementById('typeNone').classList.add('active');

    }

}

/**
 * Helper to safely get the selected subject from the dynamic dropdown
 */
function getSelectedSubject() {
    const section = document.getElementById('subjectSelectorSection');
    const select = document.getElementById('subjectSelect');

    if (section && section.style.display !== 'none' && select && select.value) {
        return select.value;
    }
    return '';
}

function selectType(type) {

    currentSelection.selectedType = type;

    updateTypeSelection();

    if (type === 'Remedial' || type === 'Reception') {

        // Standalone Assignment
        const { day, periodId } = currentSelection;

        if (!teacherAssignments[currentTeacherId]) teacherAssignments[currentTeacherId] = {};

        if (!teacherAssignments[currentTeacherId][day]) teacherAssignments[currentTeacherId][day] = {};

        teacherAssignments[currentTeacherId][day][periodId] = {

            class: (type === 'Reception' ? 'استقبال' : 'استدراك'),

            type: type,

            stream: '',

            subject: getSelectedSubject() // Store selected subject

        };

        renderScheduleTable();

        saveAssignments();

        closeAssignmentModal();

        return;

    }

    // If we are editing an existing assignment (class is selected), auto-save the type change

    // If it's a new assignment (no class yet), just keep it in state waiting for class selection

    if (currentSelection.selectedClass) {

        const { day, periodId, selectedClass } = currentSelection;

        if (!teacherAssignments[currentTeacherId]) teacherAssignments[currentTeacherId] = {};

        if (!teacherAssignments[currentTeacherId][day]) teacherAssignments[currentTeacherId][day] = {};

        // To maintain the stream, we should copy the existing assignment if it exists
        const existingAssignment = teacherAssignments[currentTeacherId][day][periodId];
        const stream = (existingAssignment && typeof existingAssignment === 'object') ? existingAssignment.stream : '';

        teacherAssignments[currentTeacherId][day][periodId] = {

            class: selectedClass,

            type: type,

            stream: stream,
            
            subject: getSelectedSubject() // Store selected subject

        };

        renderScheduleTable();

        saveAssignments(); // Save to LocalStorage

        // Do NOT close modal, allowing user to see the change or change class

    }

}

function deleteAssignment() {

    const { day, periodId } = currentSelection;

    if (teacherAssignments[currentTeacherId]?.[day]?.[periodId]) {

        delete teacherAssignments[currentTeacherId][day][periodId];

    }

    renderScheduleTable();

    saveAssignments(); // Save to LocalStorage

    closeAssignmentModal();

}

/**

 * Save assignments to storage

 */

async function saveAssignments() {

    try {

        await DB.set('teacherAssignments', teacherAssignments);

        showToast('تم حفظ الإسناد بنجاح', 'success');

    } catch (e) {

        console.error('Error saving assignments:', e);

        showToast('حدث خطأ أثناء الحفظ', 'error');

    }

}

/**

 * Clear all assignments

 */

async function clearAllAssignments() {

    if (!currentTeacherId) {

        showToast('الرجاء اختيار أستاذ أولا', 'error');

        return;

    }

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "هل أنت متأكد من مسح جميع الحصص المسندة لهذا الأستاذ؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'نعم، احذفها!',
        cancelButtonText: 'إلغاء'
    });

    if (!result.isConfirmed) {

        return;

    }

    delete teacherAssignments[currentTeacherId];

    renderScheduleTable();

    await saveAssignments();

    showToast('تم مسح جميع الحصص', 'success');

}

/**

 * Print Schedule

 * (Reusing existing print logic, just ensuring it handles objects correctly)

 */

/**

 * Print Schedule - Enhanced Version

 */

function printSchedule() {

    if (!currentTeacherId) {

        showToast('الرجاء اختيار أستاذ أولا', 'error');

        return;

    }

    const teacher = allTeachers.find(t => (t.id || `${t.last_name}-${t.first_name}`) === currentTeacherId);

    if (!teacher) return;

    const teacherName = `${teacher.last_name || ''} ${teacher.first_name || ''}`;

    const settings = institutionSettings;

    const assignments = teacherAssignments[currentTeacherId] || {};

    const schoolYear = settings.schoolYear || '2025/2026'; // Default or from settings

    // Generate Rows

    let rowsHtml = '';

    PERIODS.forEach(period => {
        rowsHtml += '<tr>';
        rowsHtml += `<td class="period-col">
            <div class="period-name">${period.name}</div>
            <div class="period-time">${period.session === 'morning' ? 'ص' : 'م'}</div>
        </td>`;

        DAYS.forEach(day => {
            const dayAssignments = assignments[day] || {};
            const assignment = dayAssignments[period.id];
            let cellContent = '';

            if (assignment) {
                if (typeof assignment === 'object') {
                    const typeCode = assignment.type;
                    if (typeCode === 'Remedial') {
                        cellContent = `<div class="cell-data"><span class="type-tag" style="background:#1abc9c; color:white; padding:2px 6px; border-radius:3px;">استدراك</span></div>`;
                    } else {
                        const rawCls = assignment.class || '-';
                        const stream = assignment.stream || '';
                        const levelSeparator = isSecondary ? 'ث' : 'م';
                        const nameRegex = new RegExp(`^(\\d+)[\\s\\-_]?${levelSeparator}[\\s\\-_]?(\\d+)$`);
                        const nameMatch = rawCls.match(nameRegex);
                        let formattedCls = `<strong>${rawCls}</strong>`;

                        if (nameMatch) {
                            const levelPart = nameMatch[1];
                            const classPart = parseInt(nameMatch[2]);
                            let streamHtml = '';
                            if (isSecondary && stream) {
                                const streamDisplay = (typeof STREAM_ABBR !== 'undefined' && STREAM_ABBR[stream]) || stream;
                                streamHtml = ` <span style="font-size:9pt; color:#555;">${streamDisplay}</span> `;
                            }
                            formattedCls = `<strong>${levelPart}${levelSeparator}${streamHtml}${classPart}</strong>`;
                        } else if (isSecondary && stream) {
                            const streamDisplay = (typeof STREAM_ABBR !== 'undefined' && STREAM_ABBR[stream]) || stream;
                            formattedCls += ` <span style="font-size:9pt; color:#555;">${streamDisplay}</span>`;
                        }

                        const typeName = typeCode === 'TD' ? 'أ.م' : (typeCode === 'TP' ? 'أ.تط' : typeCode);
                        const typeHtml = typeCode ? ` <span class="type-tag">${typeName}</span>` : '';
                        const roomHtml = assignment.room ? `<div class="room-info" style="font-size:8pt; color:#666; margin-top:2px;">${assignment.room}</div>` : '';
                        cellContent = `<div class="cell-data">${formattedCls}${typeHtml}${roomHtml}</div>`;
                    }
                } else {
                    const levelSeparator = isSecondary ? 'ث' : 'م';
                    const nameRegex = new RegExp(`^(\\d+)[\\s\\-_]?${levelSeparator}[\\s\\-_]?(\\d+)$`);
                    const nameMatch = String(assignment).match(nameRegex);
                    let formattedCls = `<strong>${assignment}</strong>`;
                    if (nameMatch) {
                        formattedCls = `<strong>${nameMatch[1]}${levelSeparator}${parseInt(nameMatch[2])}</strong>`;
                    }
                    cellContent = `<div class="cell-data">${formattedCls}</div>`;
                }

                rowsHtml += `<td>${cellContent}</td>`;
            } else {
                rowsHtml += `<td>&nbsp;</td>`;
            }
        });
        rowsHtml += '</tr>';

        // Add Separator after morning periods (4th period)
        if (period.id === 4) {
            rowsHtml += `
                <tr class="separator-row">
                    <td colspan="6" style="background:#eee; height:20px; font-weight:bold; font-size:10pt; color:#444;">الفترة المسائية</td>
                </tr>
            `;
        }
    });

    // Calculate Summary Data
    let totalPeriodsCount = 0;
    const assignedGroupsSet = new Set();
    DAYS.forEach(day => {
        const dayAssignments = assignments[day] || {};
        Object.values(dayAssignments).forEach(assignment => {
            if (assignment) {
                totalPeriodsCount++;
                let groupName = typeof assignment === 'object' ? assignment.class : assignment;
                if (groupName && typeof assignment === 'object' && isSecondary && assignment.stream) {
                    const streamDisplay = (typeof STREAM_ABBR !== 'undefined' && STREAM_ABBR[assignment.stream]) || assignment.stream;
                    const levelSeparator = 'ث';
                    const nameRegex = new RegExp(`^(\\d+)[\\s\\-_]?${levelSeparator}[\\s\\-_]?(\\d+)$`);
                    const nameMatch = groupName.match(nameRegex);
                    if (nameMatch) {
                        groupName = `${nameMatch[1]}${levelSeparator} ${streamDisplay} ${parseInt(nameMatch[2])}`;
                    } else {
                        groupName = `${groupName} ${streamDisplay}`;
                    }
                }
                if (groupName) assignedGroupsSet.add(groupName);
            }
        });
    });
    const groupsListStr = Array.from(assignedGroupsSet).sort().join(' / ');
    const totalGroupsCount = assignedGroupsSet.size;

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>جدول التوقيت - ${teacherName}</title>

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

                :root {
                    --print-border: 1px solid #000;
                    --print-font: 'Cairo', sans-serif;
                }

                * { box-sizing: border-box; margin: 0; padding: 0; }

                body {

                    font-family: var(--print-font);

                    padding: 0;

                    margin: 0;

                    background: white;

                }

                .page-container {
                    width: 210mm; /* A4 Portrait */
                    height: auto;
                    margin: 0 auto;
                    padding: 8mm;
                    position: relative;
                }

                /* Header */
                .header-container { width: 100%; margin-bottom: 10px; line-height: 1.2; }
                .center-text { text-align: center; font-weight: bold; }
                .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 5px; font-weight: bold; font-size: 11pt; line-height: 1.1; }
                .header-box { width: 45%; }

                .list-title { text-align: center; font-size: 17pt; font-weight: 900; margin: 15px 0; text-decoration: underline; line-height: 1; }

                /* Teacher Info Bar */

                .info-bar {

                    display: flex;

                    justify-content: space-between;

                    background: #f9f9f9;

                    border: 1px solid #000;

                    padding: 8px 15px;

                    margin-bottom: 15px;

                    border-radius: 4px;

                }

                .info-item { font-size: 12pt; font-weight: bold; }

                /* Table */

                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }

                table { border-collapse: collapse; width: 100%; border-spacing: 0; }
                th, td { border: 1px solid #000; padding: 4px; text-align: center; }

                th {

                    background-color: #e6e6e6;

                    font-weight: 800;

                    font-size: 11pt;

                    height: 35px;

                }

                td { height: 32px; vertical-align: middle; padding: 2px; }

                .period-col { background: #f4f4f4; width: 55px; }
                .period-name { font-weight: 800; font-size: 8.5pt; }
                .period-time { font-size: 6.5pt; color: #555; }

                .separator-row td { background-color: #f1f1f1 !important; border: 1px solid #000; text-align: center; }

                .cell-data strong { font-size: 13pt; }
                .type-tag { font-size: 8pt; border: 1px solid #000; padding: 0 4px; border-radius: 3px; display: inline-block; }

                /* Summary Table */
                .summary-container { margin-top: 15px; }
                .summary-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                .summary-table th, .summary-table td { border: 1px solid #000; padding: 6px; text-align: center; font-family: 'Cairo', sans-serif; }
                .summary-table th { background-color: #f8f8f8; font-size: 10pt; font-weight: 800; }
                .summary-table td { font-size: 11pt; font-weight: 700; height: auto; }
                .groups-list { text-align: right !important; direction: rtl; white-space: normal; word-wrap: break-word; }

                /* Footer */

                .footer { display: flex; justify-content: space-between; margin-top: 20px; padding: 0 30px; }

                .signature-box { text-align: center; width: 250px; }

                .signature-box h4 { margin-bottom: 40px; font-size: 12pt; text-decoration: underline; }

                .signature-box p { font-size: 11pt; font-weight: bold; }

                @media print {

                    @page { size: portrait; margin: 0; }

                    body { -webkit-print-color-adjust: exact; }

                }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            <div class="page-container">

                <div class="header-container">
                    <div class="center-text" style="font-size: 14pt;">
                        الجمهورية الجزائرية الديمقراطية الشعبية<br>
                        وزارة التربية الوطنية
                    </div>
                    <div class="header-row">
                        <div class="header-box" style="text-align: right;">
                            مديرية التربية لولاية: ${settings.wilaya || '........'}<br>
                            المؤسسة: ${settings.institutionName || '........'}
                        </div>
                        <div class="header-box" style="text-align: left;">
                             الموسم الدراسي : ${window.formatAcademicYear(schoolYear)}
                        </div>
                    </div>
                </div>

                <div class="list-title">
                    جدول التوقيت الأسبوعي للأستاذ(ة)
                </div>

                <div class="info-bar">

                    <span class="info-item">الأستاذ(ة): ${teacherName}</span>

                    <span class="info-item">المادة: ${teacher.subject || '-'}</span>

                </div>

                <table>

                    <thead>

                        <tr>

                            <th width="10%">التوقيت</th>

                            <th width="18%">الأحد</th>

                            <th width="18%">الإثنين</th>

                            <th width="18%">الثلاثاء</th>

                            <th width="18%">الأربعاء</th>

                            <th width="18%">الخميس</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${rowsHtml}

                    </tbody>

                </table>

                <div class="summary-container">
                    <table class="summary-table">
                        <thead>
                            <tr>
                                <th width="65%">الأفواج التربوية المسندة</th>
                                <th width="15%">عدد الأفواج</th>
                                <th width="20%">إجمالي الحصص</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="groups-list">${groupsListStr || '-'}</td>
                                <td>${totalGroupsCount}</td>
                                <td>${totalPeriodsCount}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="footer">

                    <div class="signature-box">

                        <h4>توقيع الأستاذ(ة)</h4>

                    </div>

                    <div class="signature-box">
                        <h4>توقيع السيد(ة) المدير(ة)</h4>
                    </div>

                </div>

            </div>

            <script>

                window.onload = function() {

                    // window.print(); /* Replaced by global Toolbar */

                    // window.close(); // Optional: close after print

                };

            </script>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

}

function showToast(message, type = 'success') {

    const existingToast = document.querySelector('.toast');

    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');

    toast.className = `toast ${type}`;

    toast.style.cssText = `

        position: fixed;

        bottom: 20px;

        left: 50%;

        transform: translateX(-50%);

        background: ${type === 'success' ? '#27ae60' : '#e74c3c'};

        color: white;

        padding: 15px 30px;

        border-radius: 10px;

        font-weight: 600;

        z-index: 9999;

        box-shadow: 0 4px 15px rgba(0,0,0,0.2);

        animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;

    `;

    // Add animation keyframes if not exists (quick hack)

    if (!document.getElementById('toast-style')) {

        const style = document.createElement('style');

        style.id = 'toast-style';

        style.innerHTML = `

            @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }

            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }

        `;

        document.head.appendChild(style);

    }

    toast.innerHTML = `

        <span>${type === 'success' ? 'âœ…' : 'â‌Œ'}</span>

        <span style="margin-right: 10px;">${message}</span>

    `;

    document.body.appendChild(toast);

    setTimeout(() => {

        toast.remove();

    }, 3000);

}
