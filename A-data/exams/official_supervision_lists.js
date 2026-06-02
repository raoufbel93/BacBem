/**

 * Supervision Lists Management (قوائم الحراسة)

 * Manages room assignments for supervision

 */

// Storage keys (must match official_supervision_react.js)

const OFFICIAL_TRIMESTERS = ['1', '2', '3', 'custom', 'blanc', 'blanc_lycee'];

const LEGACY_STORAGE_KEYS = {
    DAYS: 'supervisionDays',
    SCHEDULE: 'supervisionSchedule',
    SETTINGS: 'supervisionSettings',
    TRIMESTER: 'supervisionTrimester',
    ROOM_ASSIGNMENTS: 'supervisionRoomAssignments',
    EXEMPTIONS: 'supervisionExemptions',
    PRINT_NOTES: 'supervisionPrintNotes_v2',
    PERIOD_ROOMS: 'supervisionPeriodRooms',
    PRINT_TEMPLATE_TYPE: 'printTemplateType',
    PRINT_ORIENTATION: 'supervisionPrintOrientation',
    LISTS_SELECTION: 'supervisionListsSelection'
};

const STORAGE_KEYS = {
    TEACHERS: 'officialSupervisionTeachers',
    DAYS: 'officialSupervisionDays',
    SCHEDULE: 'officialSupervisionSchedule',
    SETTINGS: 'officialSupervisionSettings',
    TRIMESTER: 'officialSupervisionTrimester',
    ROOM_ASSIGNMENTS: 'officialSupervisionRoomAssignments',
    EXEMPTIONS: 'officialSupervisionExemptions',
    PRINT_NOTES: 'officialSupervisionPrintNotes_v2',
    PERIOD_ROOMS: 'officialSupervisionPeriodRooms',
    PRINT_TEMPLATE_TYPE: 'officialSupervisionPrintTemplateType',
    PRINT_ORIENTATION: 'officialSupervisionPrintOrientation',
    PRINT_SHOW_SUBJECT_COLUMN: 'officialSupervisionPrintShowSubjectColumn',
    LISTS_SELECTION: 'officialSupervisionListsSelection',
    LISTS_MIGRATION_DONE: 'officialSupervisionListsNamespaceMigrationDone',
    NAMESPACE_MIGRATION_DONE: 'officialSupervisionNamespaceMigrationDone'
};

// Helper: get trimester-specific storage keys (must match official_supervision_react.js)
const getTrimesterKeys = (tri) => ({
    DAYS: `officialSupervisionDays_T${tri}`,
    SCHEDULE: `officialSupervisionSchedule_T${tri}`,
    RESERVE_SCHEDULE: `officialSupervisionReserveSchedule_T${tri}`,
    ROOM_ASSIGNMENTS: `officialSupervisionRoomAssignments_T${tri}`,
    EXEMPTIONS: `officialSupervisionExemptions_T${tri}`
});

const getLegacyTrimesterKeys = (tri) => ({
    DAYS: `supervisionDays_T${tri}`,
    SCHEDULE: `supervisionSchedule_T${tri}`,
    RESERVE_SCHEDULE: `supervisionReserveSchedule_T${tri}`,
    ROOM_ASSIGNMENTS: `supervisionRoomAssignments_T${tri}`,
    EXEMPTIONS: `supervisionExemptions_T${tri}`
});

const hasStoredValue = (value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== '';
};

const readStoredValue = async (key, options = {}) => {
    let value = await DB.get(key);
    if ((value === undefined || value === null) && options.includeLocalStorage) {
        try {
            const raw = localStorage.getItem(key);
            if (raw !== null) {
                value = options.parseJson ? JSON.parse(raw) : raw;
            }
        } catch (error) {
            console.warn('Storage read fallback failed for key:', key, error);
        }
    }
    return value;
};

const persistStoredJson = async (key, value) => {
    await DB.set(key, value);
    localStorage.setItem(key, JSON.stringify(value));
};

const persistStoredValue = async (key, value) => {
    await DB.set(key, value);
    localStorage.setItem(key, String(value));
};

function normalizeLegacyTeacherId(id) {
    return String(id == null ? '' : id);
}

function normalizeTeacherIdList(list) {
    const seen = new Set();
    const normalized = [];
    (Array.isArray(list) ? list : []).forEach((teacherId) => {
        const normalizedId = normalizeLegacyTeacherId(teacherId);
        if (!normalizedId || seen.has(normalizedId)) return;
        seen.add(normalizedId);
        normalized.push(normalizedId);
    });
    return normalized;
}

function normalizeAssignmentStores(scheduleData, reserveScheduleData) {
    const normalizedSchedule = {};
    const normalizedReserveSchedule = {};
    const allKeys = new Set([
        ...Object.keys(scheduleData || {}),
        ...Object.keys(reserveScheduleData || {})
    ]);

    allKeys.forEach((key) => {
        const scheduleIds = normalizeTeacherIdList(scheduleData && scheduleData[key]);
        const reserveIds = normalizeTeacherIdList(reserveScheduleData && reserveScheduleData[key])
            .filter((teacherId) => !scheduleIds.includes(teacherId));
        normalizedSchedule[key] = scheduleIds;
        normalizedReserveSchedule[key] = reserveIds;
    });

    return {
        schedule: normalizedSchedule,
        reserveSchedule: normalizedReserveSchedule
    };
}

function collectLegacyTeacherIdsFromSchedule(scheduleData, reserveScheduleData) {
    const ids = new Set();
    const visit = (source) => {
        Object.values(source || {}).forEach((assignedTeachers) => {
            if (!Array.isArray(assignedTeachers)) return;
            assignedTeachers.forEach((teacherId) => {
                if (teacherId != null && teacherId !== '') {
                    ids.add(normalizeLegacyTeacherId(teacherId));
                }
            });
        });
    };
    visit(scheduleData);
    visit(reserveScheduleData);
    return ids;
}

function collectLegacyTeacherIdsFromRooms(roomAssignmentsData) {
    const ids = new Set();
    Object.values(roomAssignmentsData || {}).forEach((teacherMap) => {
        if (!teacherMap || typeof teacherMap !== 'object') return;
        Object.keys(teacherMap).forEach((teacherId) => {
            if (teacherId != null && teacherId !== '') {
                ids.add(normalizeLegacyTeacherId(teacherId));
            }
        });
    });
    return ids;
}

function createLegacyTeacherPlaceholder(id) {
    return {
        id: normalizeLegacyTeacherId(id),
        surname: 'تعيين سابق',
        name: `#${String(id || '').slice(-5)}`,
        subjects: [],
        isLegacyPlaceholder: true
    };
}

function buildTeacherDirectoryForTrimester(baseTeachers, scheduleData, reserveScheduleData, roomAssignmentsData) {
    const merged = Array.isArray(baseTeachers)
        ? baseTeachers.map((teacher) => ({ ...teacher, id: normalizeLegacyTeacherId(teacher.id) }))
        : [];
    const knownIds = new Set(merged.map((teacher) => normalizeLegacyTeacherId(teacher.id)));
    const referencedIds = new Set([
        ...collectLegacyTeacherIdsFromSchedule(scheduleData, reserveScheduleData),
        ...collectLegacyTeacherIdsFromRooms(roomAssignmentsData)
    ]);

    referencedIds.forEach((teacherId) => {
        if (!knownIds.has(teacherId)) {
            merged.push(createLegacyTeacherPlaceholder(teacherId));
            knownIds.add(teacherId);
        }
    });

    return merged;
}

// State

let currentTrimester = '1';

let teachers = [];

let days = [];

let schedule = {};

let reserveSchedule = {};

let roomAssignments = {}; // { dayId_period: { teacherId: { room, note } } }

let currentTeachers = []; // Teachers for current selection
let teacherDirectory = [];

const BAC_STREAM_OPTIONS = [
    'آداب وفلسفة',
    'لغات أجنبية',
    'علوم تجريبية',
    'رياضيات',
    'تقني رياضي',
    'تسيير واقتصاد',
    'فنون'
];

const OFFICIAL_CENTER_DEFAULTS = {
    ministry: 'وزارة التربية الوطنية',
    office: 'الديوان الوطني للامتحانات و المسابقات',
    branch: '',
    bac_streams: [],
    center_code: '',
    center_name: '',
    municipality: '',
    province: '',
    president: '',
    job: '',
    institution: '',
    exam: '',
    session: '',
    rooms_count: 0,
    guards_per_room: 0,
    exam_days: 0
};

function getOfficialExamDisplayName(trimester, storedExam) {
    const normalizedTrimester = String(trimester || '').trim();
    const examName = String(storedExam || '').trim();
    if (normalizedTrimester === 'blanc') return 'شهادة التعليم المتوسط';
    if (normalizedTrimester === 'blanc_lycee') return 'شهادة البكالوريا';
    if (normalizedTrimester === 'custom') return examName || 'امتحان آخر';
    return examName || '';
}

async function migrateLegacyNamespaceIfNeeded() {
    const listsMigrationDone = await readStoredValue(STORAGE_KEYS.LISTS_MIGRATION_DONE, { includeLocalStorage: true });
    if (!listsMigrationDone) {
        const currentSelection = await readStoredValue(STORAGE_KEYS.LISTS_SELECTION, { includeLocalStorage: true, parseJson: true });
        if (!hasStoredValue(currentSelection)) {
            const legacySelection = await readStoredValue(LEGACY_STORAGE_KEYS.LISTS_SELECTION, { includeLocalStorage: true, parseJson: true });
            if (hasStoredValue(legacySelection)) {
                await persistStoredJson(STORAGE_KEYS.LISTS_SELECTION, legacySelection);
            }
        }
        await persistStoredValue(STORAGE_KEYS.LISTS_MIGRATION_DONE, 'true');
    }

    const migrationDone = await readStoredValue(STORAGE_KEYS.NAMESPACE_MIGRATION_DONE, { includeLocalStorage: true });
    if (migrationDone) return;

    const officialAuxKeys = [
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.PERIOD_ROOMS,
        STORAGE_KEYS.PRINT_NOTES,
        STORAGE_KEYS.LISTS_SELECTION
    ];
    const officialRawKeys = [
        STORAGE_KEYS.TRIMESTER,
        STORAGE_KEYS.PRINT_TEMPLATE_TYPE,
        STORAGE_KEYS.PRINT_ORIENTATION
    ];

    let officialHasData = false;
    for (const tri of OFFICIAL_TRIMESTERS) {
        const keys = getTrimesterKeys(tri);
        const values = await Promise.all([
            readStoredValue(keys.DAYS, { includeLocalStorage: true, parseJson: true }),
            readStoredValue(keys.SCHEDULE, { includeLocalStorage: true, parseJson: true }),
            readStoredValue(keys.RESERVE_SCHEDULE, { includeLocalStorage: true, parseJson: true }),
            readStoredValue(keys.ROOM_ASSIGNMENTS, { includeLocalStorage: true, parseJson: true }),
            readStoredValue(keys.EXEMPTIONS, { includeLocalStorage: true, parseJson: true })
        ]);
        if (values.some(hasStoredValue)) {
            officialHasData = true;
            break;
        }
    }

    if (!officialHasData) {
        for (const key of officialAuxKeys) {
            const value = await readStoredValue(key, { includeLocalStorage: true, parseJson: true });
            if (hasStoredValue(value)) {
                officialHasData = true;
                break;
            }
        }
    }

    if (!officialHasData) {
        for (const key of officialRawKeys) {
            const value = await readStoredValue(key, { includeLocalStorage: true });
            if (hasStoredValue(value)) {
                officialHasData = true;
                break;
            }
        }
    }

    if (officialHasData) {
        await persistStoredValue(STORAGE_KEYS.NAMESPACE_MIGRATION_DONE, 'true');
        return;
    }

    let copiedAny = false;
    const legacyTrimester = await readStoredValue(LEGACY_STORAGE_KEYS.TRIMESTER, { includeLocalStorage: true }) || '1';
    const targetTrimester = OFFICIAL_TRIMESTERS.includes(String(legacyTrimester)) ? String(legacyTrimester) : '1';
    const targetKeys = getTrimesterKeys(targetTrimester);

    for (const tri of OFFICIAL_TRIMESTERS) {
        const legacyKeys = getLegacyTrimesterKeys(tri);
        const officialKeys = getTrimesterKeys(tri);
        const mappings = [
            [legacyKeys.DAYS, officialKeys.DAYS],
            [legacyKeys.SCHEDULE, officialKeys.SCHEDULE],
            [legacyKeys.RESERVE_SCHEDULE, officialKeys.RESERVE_SCHEDULE],
            [legacyKeys.ROOM_ASSIGNMENTS, officialKeys.ROOM_ASSIGNMENTS],
            [legacyKeys.EXEMPTIONS, officialKeys.EXEMPTIONS]
        ];

        for (const [legacyKey, officialKey] of mappings) {
            const value = await readStoredValue(legacyKey, { includeLocalStorage: true, parseJson: true });
            if (hasStoredValue(value)) {
                await persistStoredJson(officialKey, value);
                copiedAny = true;
            }
        }
    }

    const legacyFlatMappings = [
        [LEGACY_STORAGE_KEYS.DAYS, targetKeys.DAYS],
        [LEGACY_STORAGE_KEYS.SCHEDULE, targetKeys.SCHEDULE],
        [LEGACY_STORAGE_KEYS.ROOM_ASSIGNMENTS, targetKeys.ROOM_ASSIGNMENTS],
        [LEGACY_STORAGE_KEYS.EXEMPTIONS, targetKeys.EXEMPTIONS]
    ];

    for (const [legacyKey, officialKey] of legacyFlatMappings) {
        const value = await readStoredValue(legacyKey, { includeLocalStorage: true, parseJson: true });
        if (hasStoredValue(value)) {
            const currentValue = await readStoredValue(officialKey, { includeLocalStorage: true, parseJson: true });
            if (!hasStoredValue(currentValue)) {
                await persistStoredJson(officialKey, value);
                copiedAny = true;
            }
        }
    }

    const legacyJsonMappings = [
        [LEGACY_STORAGE_KEYS.SETTINGS, STORAGE_KEYS.SETTINGS],
        [LEGACY_STORAGE_KEYS.PERIOD_ROOMS, STORAGE_KEYS.PERIOD_ROOMS],
        [LEGACY_STORAGE_KEYS.PRINT_NOTES, STORAGE_KEYS.PRINT_NOTES],
        [LEGACY_STORAGE_KEYS.LISTS_SELECTION, STORAGE_KEYS.LISTS_SELECTION]
    ];

    for (const [legacyKey, officialKey] of legacyJsonMappings) {
        const value = await readStoredValue(legacyKey, { includeLocalStorage: true, parseJson: true });
        if (hasStoredValue(value)) {
            await persistStoredJson(officialKey, value);
            copiedAny = true;
        }
    }

    const legacyRawMappings = [
        [LEGACY_STORAGE_KEYS.TRIMESTER, STORAGE_KEYS.TRIMESTER],
        [LEGACY_STORAGE_KEYS.PRINT_TEMPLATE_TYPE, STORAGE_KEYS.PRINT_TEMPLATE_TYPE],
        [LEGACY_STORAGE_KEYS.PRINT_ORIENTATION, STORAGE_KEYS.PRINT_ORIENTATION]
    ];

    for (const [legacyKey, officialKey] of legacyRawMappings) {
        const value = await readStoredValue(legacyKey, { includeLocalStorage: true });
        if (hasStoredValue(value)) {
            await persistStoredValue(officialKey, value);
            copiedAny = true;
        }
    }

    await persistStoredValue(STORAGE_KEYS.NAMESPACE_MIGRATION_DONE, 'true');

    if (copiedAny) {
        console.log('[Official Supervision Lists] Migrated shared supervision data into official namespace');
    }
}

// New Room System
const ROOM_TRIMESTERS = ['1', '2', '3', 'custom', 'blanc', 'blanc_lycee'];

function createEmptyPeriodRooms() {
    return { morning: [], midday: [], evening: [] };
}

function createEmptyTrimesterRoomStore() {
    return ROOM_TRIMESTERS.reduce((acc, trimester) => {
        acc[trimester] = createEmptyPeriodRooms();
        return acc;
    }, {});
}

function cloneRooms(rooms) {
    return (rooms || []).map((room) => ({ ...room }));
}

function normalizeRoomLabel(label) {
    return (label || '').toString().replace(/\s+/g, ' ').trim();
}

function roomLabelKey(label) {
    return normalizeRoomLabel(label).toLowerCase();
}

function generateRoomId(seed = 0) {
    return Date.now() * 1000 + seed + Math.floor(Math.random() * 1000);
}

function sanitizeRoomList(rooms) {
    const sanitized = [];
    const remap = {};
    const seenIds = new Set();
    const seenLabels = new Map();
    let changed = false;

    (rooms || []).forEach((room, index) => {
        const label = normalizeRoomLabel(room && room.label);
        if (!label) {
            changed = true;
            return;
        }

        const labelKey = roomLabelKey(label);
        const existingByLabel = seenLabels.get(labelKey);
        if (existingByLabel) {
            if (room && room.id !== undefined && room.id !== null && room.id !== existingByLabel.id) {
                remap[room.id] = existingByLabel.id;
            }
            changed = true;
            return;
        }

        let id = room && room.id;
        if (!id || seenIds.has(id)) {
            id = generateRoomId(index);
            while (seenIds.has(id)) {
                id = generateRoomId(index + sanitized.length + 1);
            }
            changed = true;
        }

        if (!room || room.label !== label) {
            changed = true;
        }

        const normalizedRoom = { id, label };
        sanitized.push(normalizedRoom);
        seenIds.add(id);
        seenLabels.set(labelKey, normalizedRoom);
    });

    return { rooms: sanitized, remap, changed };
}

function sanitizePeriodRoomsStore(store) {
    const normalized = createEmptyTrimesterRoomStore();
    const roomIdRemaps = {};
    let changed = false;

    ROOM_TRIMESTERS.forEach((trimester) => {
        roomIdRemaps[trimester] = {};
        const trimesterValue = store && store[trimester];
        const sourcePeriods = isLegacyPeriodRoomsShape(trimesterValue) ? trimesterValue : createEmptyPeriodRooms();

        Object.keys(createEmptyPeriodRooms()).forEach((period) => {
            const result = sanitizeRoomList(sourcePeriods[period]);
            normalized[trimester][period] = result.rooms;
            if (result.changed) {
                changed = true;
            }
            Object.assign(roomIdRemaps[trimester], result.remap);
        });
    });

    return { store: normalized, roomIdRemaps, changed };
}

async function remapStoredRoomAssignments(roomIdRemaps) {
    for (const trimester of Object.keys(roomIdRemaps || {})) {
        const trimesterRemap = roomIdRemaps[trimester];
        if (!trimesterRemap || Object.keys(trimesterRemap).length === 0) {
            continue;
        }

        const keys = getTrimesterKeys(trimester);
        let assignments = await DB.get(keys.ROOM_ASSIGNMENTS);

        if (!assignments) {
            try {
                assignments = JSON.parse(localStorage.getItem(keys.ROOM_ASSIGNMENTS));
            } catch (e) {
                assignments = null;
            }
        }

        if (!assignments || typeof assignments !== 'object') {
            continue;
        }

        let changed = false;
        Object.values(assignments).forEach((teacherMap) => {
            if (!teacherMap || typeof teacherMap !== 'object') return;
            Object.values(teacherMap).forEach((entry) => {
                if (!entry || !entry.room) return;
                const mappedRoomId = trimesterRemap[entry.room];
                if (mappedRoomId && mappedRoomId !== entry.room) {
                    entry.room = mappedRoomId;
                    changed = true;
                }
            });
        });

        if (changed) {
            await DB.set(keys.ROOM_ASSIGNMENTS, assignments);
            localStorage.setItem(keys.ROOM_ASSIGNMENTS, JSON.stringify(assignments));
            if (trimester === currentTrimester) {
                roomAssignments = assignments;
            }
        }
    }
}

function isLegacyPeriodRoomsShape(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.prototype.hasOwnProperty.call(value, 'morning')
        || Object.prototype.hasOwnProperty.call(value, 'midday')
        || Object.prototype.hasOwnProperty.call(value, 'evening');
}

function normalizePeriodRoomsStore(value) {
    const normalized = createEmptyTrimesterRoomStore();

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return normalized;
    }

    if (isLegacyPeriodRoomsShape(value)) {
        const legacyRooms = {
            morning: cloneRooms(value.morning),
            midday: cloneRooms(value.midday),
            evening: cloneRooms(value.evening)
        };

        Object.keys(normalized).forEach((trimester) => {
            normalized[trimester] = {
                morning: cloneRooms(legacyRooms.morning),
                midday: cloneRooms(legacyRooms.midday),
                evening: cloneRooms(legacyRooms.evening)
            };
        });
        return normalized;
    }

    Object.keys(normalized).forEach((trimester) => {
        const triValue = value[trimester];
        if (isLegacyPeriodRoomsShape(triValue)) {
            normalized[trimester] = {
                morning: cloneRooms(triValue.morning),
                midday: cloneRooms(triValue.midday),
                evening: cloneRooms(triValue.evening)
            };
        }
    });

    return normalized;
}

function getRoomsForTrimester(trimester) {
    if (!periodRooms[trimester]) {
        periodRooms[trimester] = createEmptyPeriodRooms();
    }
    return periodRooms[trimester];
}

let periodRooms = createEmptyTrimesterRoomStore();

// Initialize

document.addEventListener('DOMContentLoaded', async () => {

    await loadData();

    populateDaySelect();

    const printSubjectToggle = document.getElementById('printSubjectColumnToggle');
    const savedShowSubjectColumn = await readStoredValue(STORAGE_KEYS.PRINT_SHOW_SUBJECT_COLUMN, { includeLocalStorage: true });
    if (printSubjectToggle) {
        printSubjectToggle.checked = savedShowSubjectColumn !== false && savedShowSubjectColumn !== 'false';
        printSubjectToggle.addEventListener('change', async (ev) => {
            await DB.set(STORAGE_KEYS.PRINT_SHOW_SUBJECT_COLUMN, !!ev.target.checked);
            localStorage.setItem(STORAGE_KEYS.PRINT_SHOW_SUBJECT_COLUMN, JSON.stringify(!!ev.target.checked));
        });
    }

    // Restore saved selection (including trimester)

    restoreSelection();

    // Event listeners

    // Trimester change: reload data for the selected trimester
    document.getElementById('trimesterSelect').addEventListener('change', async (ev) => {
        currentTrimester = ev.target.value;
        await DB.set(STORAGE_KEYS.TRIMESTER, currentTrimester);
        localStorage.setItem(STORAGE_KEYS.TRIMESTER, currentTrimester);
        await loadTrimesterData();
        populateDaySelect();
        currentTeachers = [];
        renderTeachersTable();
        saveSelection();
    });

    document.getElementById('daySelect').addEventListener('change', () => {
        populatePeriodSelect();
        saveSelection();
        loadTeachersForPeriod();
    });

    document.getElementById('periodSelect').addEventListener('change', () => {

        saveSelection();

        loadTeachersForPeriod();

    });

    // Rooms logic moved to modal.

});

// Load periodRooms initially
async function loadPeriodRooms() {
    let loaded = await readStoredValue(STORAGE_KEYS.PERIOD_ROOMS, { includeLocalStorage: true, parseJson: true });
    const normalizedStore = normalizePeriodRoomsStore(loaded);
    const sanitized = sanitizePeriodRoomsStore(normalizedStore);
    periodRooms = sanitized.store;

    const needsSave = !loaded || isLegacyPeriodRoomsShape(loaded) || sanitized.changed;
    await remapStoredRoomAssignments(sanitized.roomIdRemaps);

    if (needsSave) {
        console.log('Normalized official supervision room settings by trimester');
        await persistStoredJson(STORAGE_KEYS.PERIOD_ROOMS, periodRooms);
    }
}

/**

 * Save current selection to IndexedDB

 */

async function saveSelection() {

    const selection = {

        trimester: currentTrimester,

        dayId: document.getElementById('daySelect').value,

        period: document.getElementById('periodSelect').value,

    };

    await persistStoredJson(STORAGE_KEYS.LISTS_SELECTION, selection);
}

function shouldShowSubjectColumnInSupervisionPrint() {
    const toggle = document.getElementById('printSubjectColumnToggle');
    return !toggle || toggle.checked !== false;
}

/**

 * Restore selection from IndexedDB

 */

async function restoreSelection() {

    // Restore trimester first
    const savedTrimester = await readStoredValue(STORAGE_KEYS.TRIMESTER, { includeLocalStorage: true });
    if (savedTrimester) {
        currentTrimester = savedTrimester;
        document.getElementById('trimesterSelect').value = currentTrimester;
        await loadTrimesterData();
        populateDaySelect();
    }

    const saved = await readStoredValue(STORAGE_KEYS.LISTS_SELECTION, { includeLocalStorage: true, parseJson: true });

    if (saved) {

        // If the saved selection has a trimester, use it to override
        if (saved.trimester) {
            currentTrimester = saved.trimester;
            document.getElementById('trimesterSelect').value = currentTrimester;
            await loadTrimesterData();
            populateDaySelect();
        }

        if (saved.dayId) {
            document.getElementById('daySelect').value = saved.dayId;
            populatePeriodSelect();
        }
        if (saved.period) document.getElementById('periodSelect').value = saved.period;

        // Old fields removed

        // Load teachers if both day and period are set

        if (saved.dayId && saved.period) {

            loadTeachersForPeriod();

        }

    }

}

// ... [rest of loadData and helpers unchanged until renderTeachersTable] ...

// Retrieves available locations for the currently selected period
function getLocations() {
    const p = document.getElementById('periodSelect').value;
    if (!p) return [];
    return getRoomsForTrimester(currentTrimester)[p] || [];
}

// Retrieves label for a given room ID globally across all periods
function getLocationLabel(id) {
    if (!id || id === 0) return '';
    const currentRooms = getRoomsForTrimester(currentTrimester);
    for (const key of Object.keys(currentRooms)) {
        const room = (currentRooms[key] || []).find(r => r.id == id);
        if (room) return room.label;
    }
    for (const trimester of Object.keys(periodRooms)) {
        const trimesterRooms = getRoomsForTrimester(trimester);
        for (const key of Object.keys(trimesterRooms)) {
            const room = (trimesterRooms[key] || []).find(r => r.id == id);
            if (room) return room.label;
        }
    }
    return `قاعة`;
}

function escapeHtml(value) {
    return (value === undefined || value === null ? '' : String(value))
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeOfficialCenterBacStreams(streams, fallbackBranch) {
    let list = Array.isArray(streams) ? streams.slice() : [];
    if (list.length === 0 && fallbackBranch) {
        const branchItems = String(fallbackBranch)
            .split(/\s*(?:\/|\\|\||،|؛|-)\s*/)
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .filter((item) => BAC_STREAM_OPTIONS.indexOf(item) !== -1);
        list = branchItems.length >= 2 ? branchItems : [];
    }
    const seen = new Set();
    return list.filter((item) => {
        const value = String(item || '').trim();
        if (!value || BAC_STREAM_OPTIONS.indexOf(value) === -1 || seen.has(value)) return false;
        seen.add(value);
        return true;
    });
}

function formatOfficialCenterBacStreams(branch, bacStreams) {
    const normalizedStreams = normalizeOfficialCenterBacStreams(bacStreams, '');
    if (normalizedStreams.length > 0) return normalizedStreams.join(' / ');
    return String(branch || '').trim();
}

function getOfficialCenterDisplay(center) {
    const merged = Object.assign({}, OFFICIAL_CENTER_DEFAULTS, center || {});
    const bacStreams = normalizeOfficialCenterBacStreams(merged.bac_streams, merged.branch);
    return {
        ministry: merged.ministry,
        office: merged.office,
        branch: String(merged.branch || '').trim(),
        bac_streams: bacStreams,
        centerCode: merged.center_code,
        centerName: merged.center_name || merged.institution || '',
        institution: merged.institution || merged.center_name || '',
        municipality: merged.municipality,
        province: merged.province,
        president: merged.president,
        job: merged.job,
        exam: merged.exam,
        displayExam: getOfficialExamDisplayName(currentTrimester, merged.exam),
        session: merged.session
    };
}

function getOfficialCenterBranchForPrint(center, options) {
    const trimester = String(options && options.trimester ? options.trimester : currentTrimester || '');
    const isBacPrint = trimester === 'blanc_lycee';
    const bacStreamsValue = formatOfficialCenterBacStreams('', center && center.bac_streams);
    if (isBacPrint) {
        return bacStreamsValue || String((options && options.subjects) || '').trim();
    }
    return String((center && center.branch) || '').trim();
}

async function getOfficialCenterData() {
    try {
        const center = await DB.getOfficialCenter();
        return getOfficialCenterDisplay(center);
    } catch (error) {
        console.warn('Failed to load official center data:', error);
        return getOfficialCenterDisplay({});
    }
}

function getPeriodLabel(period) {
    if (period === 'midday') return 'فترة المنتصف';
    if (period === 'evening') return 'الفترة المسائية';
    return 'الفترة الصباحية';
}

function shortenSubjectLabel(subject) {
    if (!subject) return '-';
    return String(subject)
        .replace('العلوم الفيزيائية والتكنولوجيا', 'ع فيزيائية')
        .replace('العلوم الطبيعية والحياة', 'علوم طبيعية')
        .replace('اللغة العربية', 'عربية')
        .replace('اللغة الفرنسية', 'فرنسية')
        .replace('اللغة الإنجليزية', 'إنجليزية')
        .replace('الرياضيات', 'رياضيات')
        .replace('التاريخ والجغرافيا', 'تاريخ')
        .replace('التربية الإسلامية', 'إسلامية')
        .replace('التربية المدنية', 'مدنية')
        .replace('التربية البدنية والرياضية', 'رياضة')
        .replace('التربية التشكيلية', 'تشكيلية')
        .replace('التربية الموسيقية', 'موسيقى')
        .replace('الإعلام الآلي', 'إعلام آلي');
}

function getTeacherFullName(teacher) {
    return `${teacher && teacher.surname ? teacher.surname : ''} ${teacher && teacher.name ? teacher.name : ''}`.replace(/\s+/g, ' ').trim();
}

function getTeacherPrimarySubject(teacher) {
    return teacher && teacher.subjects && teacher.subjects.length > 0 ? teacher.subjects[0] : '-';
}

function shortenTeacherRank(rank) {
    const normalizedRank = String(rank || '').replace(/\s+/g, ' ').trim();
    if (!normalizedRank) return '';
    const map = {
        'أستاذ التعليم المتوسط': 'أ.ت.م',
        'أستاذ التعليم المتوسط قسم أوَّل': 'أ.ت.م ق1',
        'أستاذ التعليم المتوسط قسم أول': 'أ.ت.م ق1',
        'أستاذ التعليم المتوسط قسم ثانٍ': 'أ.ت.م ق2',
        'أستاذ التعليم المتوسط قسم ثان': 'أ.ت.م ق2',
        'أستاذ التعليم الثانوي': 'أ.ت.ث',
        'أستاذ التعليم الثانوي قسم أوَّل': 'أ.ت.ث ق1',
        'أستاذ التعليم الثانوي قسم أول': 'أ.ت.ث ق1',
        'أستاذ التعليم الثانوي قسم ثانٍ': 'أ.ت.ث ق2',
        'أستاذ التعليم الثانوي قسم ثان': 'أ.ت.ث ق2',
        'أستاذ التعليم الابتدائي': 'أ.ت.إ',
        'أستاذ التعليم الابتدائي قسم أوَّل': 'أ.ت.إ ق1',
        'أستاذ التعليم الابتدائي قسم أول': 'أ.ت.إ ق1',
        'أستاذ التعليم الإبتدائي قسم أوَّل': 'أ.ت.إ ق1',
        'أستاذ التعليم الإبتدائي قسم أول': 'أ.ت.إ ق1',
        'أستاذ التعليم الابتدائي قسم ثانٍ': 'أ.ت.إ ق2',
        'أستاذ التعليم الابتدائي قسم ثان': 'أ.ت.إ ق2',
        'أستاذ التعليم الإبتدائي قسم ثانٍ': 'أ.ت.إ ق2',
        'أستاذ التعليم الإبتدائي قسم ثان': 'أ.ت.إ ق2',
        'أستاذ رئيسي للتعليم المتوسط': 'أ.ر.ت.م',
        'أستاذ مكون للتعليم المتوسط': 'أ.م.ت.م',
        'أستاذ رئيسي للتعليم الثانوي': 'أ.ر.ت.ث',
        'أستاذ مكون للتعليم الثانوي': 'أ.م.ت.ث',
        'أستاذ رئيسي للتعليم الابتدائي': 'أ.ر.ت.إ',
        'أستاذ رئيسي للتعليم الإبتدائي': 'أ.ر.ت.إ',
        'أستاذ مكون للتعليم الابتدائي': 'أ.م.ت.إ',
        'أستاذ مكون للتعليم الإبتدائي': 'أ.م.ت.إ'
    };
    return map[normalizedRank] || normalizedRank;
}

function getTeacherRankColor(rank) {
    const normalizedRank = String(rank || '');
    if (normalizedRank.includes('ابتدائي') || normalizedRank.includes('إبتدائي')) return '#10b981';
    if (normalizedRank.includes('متوسط')) return '#3b82f6';
    if (normalizedRank.includes('ثانوي')) return '#ef4444';
    return '#64748b';
}

function getTeacherEducationStage(rank) {
    const normalizedRank = String(rank || '');
    if (normalizedRank.includes('متوسط')) return 'middle';
    if (normalizedRank.includes('ابتدائي') || normalizedRank.includes('إبتدائي')) return 'primary';
    if (normalizedRank.includes('ثانوي')) return 'secondary';
    return 'unknown';
}

function getStageDisplayLabel(stage) {
    if (stage === 'secondary') return 'الثانوي';
    if (stage === 'middle') return 'المتوسط';
    if (stage === 'primary') return 'الابتدائي';
    return 'المعتمد';
}

async function getPreferredEducationStageForLists() {
    if (currentTrimester === 'blanc_lycee') return 'secondary';
    if (currentTrimester === 'blanc') return 'middle';
    if (currentTrimester === 'custom') {
        const savedSettings = await readStoredValue(STORAGE_KEYS.SETTINGS, { includeLocalStorage: true, parseJson: true });
        return savedSettings && savedSettings.customExamStage === 'secondary' ? 'secondary' : 'middle';
    }
    return 'middle';
}

function getTeacherRankLabel(teacher) {
    return shortenTeacherRank(teacher && teacher.rank);
}

function getTeacherLocationLabel(teacher) {
    if (teacher && teacher.isReserve) return 'احتياط';
    return getLocationLabel(teacher && teacher.room) || 'غير معين';
}

function buildTeacherSubjectCellHtml(teacher) {
    const subjectLabel = escapeHtml(shortenSubjectLabel(getTeacherPrimarySubject(teacher)));
    const rankLabel = escapeHtml(getTeacherRankLabel(teacher));
    const rankColor = getTeacherRankColor(teacher && teacher.rank);
    return `
        <div style="display:flex; flex-direction:column; align-items:center; gap:3px; line-height:1.15;">
            <span style="font-weight:700;">${subjectLabel}</span>
            ${rankLabel ? `<span style="font-size:0.72rem; color:${rankColor}; font-weight:800; background:${rankColor}15; border:1px solid ${rankColor}40; padding:2px 8px; border-radius:999px;">${rankLabel}</span>` : ''}
        </div>
    `;
}

function getResponsibleTeacherForGroup(groupTeachers) {
    if (!Array.isArray(groupTeachers) || groupTeachers.length === 0) return null;
    return groupTeachers.find((teacher) => teacher && teacher.isResponsible) || groupTeachers[0];
}

function buildPrintableRoomRows(teacherList) {
    const groups = new Map();

    (teacherList || []).forEach((teacher) => {
        if (!teacher) return;
        const key = teacher.isReserve ? '__reserve__' : String(teacher.room || '__unassigned__');
        if (!groups.has(key)) {
            groups.set(key, {
                sortKey: teacher.isReserve ? Number.MAX_SAFE_INTEGER : (teacher.room || 0),
                label: teacher.isReserve ? 'احتياط' : getTeacherLocationLabel(teacher),
                teachers: []
            });
        }
        groups.get(key).teachers.push(teacher);
    });

    return Array.from(groups.values())
        .sort((a, b) => {
            if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
            return a.label.localeCompare(b.label, 'ar');
        })
        .map((group) => {
            const teachersInGroup = [...group.teachers].sort((a, b) => getTeacherFullName(a).localeCompare(getTeacherFullName(b), 'ar'));
            const responsibleTeacher = getResponsibleTeacherForGroup(teachersInGroup);
            const remainingTeachers = teachersInGroup.filter((teacher) => teacher !== responsibleTeacher);
            return {
                roomLabel: group.label,
                responsibleTeacher,
                secondTeacher: remainingTeachers[0] || null,
                thirdTeachers: remainingTeachers.slice(1)
            };
        });
}

function getDisplayedSupervisionTeachers() {
    return currentTeachers.filter((teacher) => !teacher.isReserve);
}

function getCurrentSelectionState() {
    const dayIdRaw = document.getElementById('daySelect').value;
    const period = document.getElementById('periodSelect').value;
    const dayId = parseInt(dayIdRaw, 10);
    const day = days.find(d => d.id === dayId);

    return {
        dayId: dayIdRaw,
        period,
        day
    };
}

function getSelectedReserveCount() {
    const state = getCurrentSelectionState();
    if (!state.day || !state.period || !state.day[state.period]) return 0;
    const key = state.dayId && state.period ? `${state.dayId}_${state.period}` : '';
    if (!key) return 0;
    const assignedTeacherIds = normalizeTeacherIdList(schedule[key] || []);
    const actualReserveCount = normalizeTeacherIdList(reserveSchedule[key] || []).filter((teacherId) => !assignedTeacherIds.includes(teacherId)).length;
    if (actualReserveCount > 0) return actualReserveCount;
    const configured = Number(state.day[state.period].reserveTeachers);
    if (!Number.isNaN(configured) && configured > 0) return configured;
    return 0;
}

async function updateOfficialPrintHeaderPreview(guardCount, activeRooms, reservesCount) {
    const printHeader = document.getElementById('printHeaderSubtitle');
    const printDirection = document.getElementById('printDirection');
    const printSchool = document.getElementById('printSchool');
    const printYear = document.getElementById('printYear');
    const printStats = document.getElementById('printStats');
    const state = getCurrentSelectionState();
    const center = await getOfficialCenterData();

    if (printHeader && state.day && state.period) {
        const subjects = ((state.day[state.period] && state.day[state.period].subjects) || []).filter(Boolean).join(' + ') || 'غير محدد';
        const dayText = new Date(state.day.date).toLocaleDateString('ar-DZ', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        printHeader.textContent = `${dayText} - ${getPeriodLabel(state.period)} - ${subjects}`;
    }

    if (printDirection) {
        const directionParts = [center.office, center.branch].filter(Boolean);
        printDirection.textContent = directionParts.join(' - ') || center.ministry;
    }

    if (printSchool) {
        const schoolParts = [];
        if (center.centerName) schoolParts.push(`مركز الإجراء: ${center.centerName}`);
        if (center.centerCode) schoolParts.push(`رقم المركز: ${center.centerCode}`);
        printSchool.textContent = schoolParts.join(' | ') || 'مركز الإجراء: ...';
    }

    if (printYear) {
        const metaParts = [];
        const effectiveExam = getOfficialExamDisplayName(currentTrimester, center.exam);
        if (effectiveExam) metaParts.push(`الامتحان: ${effectiveExam}`);
        if (center.session) metaParts.push(`الدورة: ${center.session}`);
        if (center.province) metaParts.push(`الولاية: ${center.province}`);
        printYear.textContent = metaParts.join(' | ') || 'بيانات المركز: ...';
    }

    if (printStats) {
        printStats.textContent = `عدد الحراس: ${guardCount} | القاعات: ${activeRooms} | الاحتياط: ${reservesCount}`;
    }
}

function buildOfficialPrintHeader(center, options) {
    const logoUrl = new URL('../assets/diwan.jpg', window.location.href).href;
    const rightMeta = [];
    if (center.centerName) rightMeta.push(`مركز الإجراء: ${escapeHtml(center.centerName)}`);
    if (center.centerCode) rightMeta.push(`رقم المركز: ${escapeHtml(center.centerCode)}`);

    const leftMeta = [];
    if (center.province) leftMeta.push(`ولاية ${escapeHtml(center.province)}`);
    if (center.municipality) leftMeta.push(`بلدية ${escapeHtml(center.municipality)}`);

    const examMeta = [];
    const effectiveExamValue = getOfficialExamDisplayName(options.trimester || currentTrimester, options.exam || center.exam);
    if (effectiveExamValue) examMeta.push(`الامتحان: ${escapeHtml(effectiveExamValue)}`);
    if (options.session) examMeta.push(`الدورة: ${escapeHtml(options.session)}`);

    return `
        <div class="header-container">
            <div class="header-row" style="margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1.5pt solid #000; align-items: center; gap: 12px;">
                <div class="header-box" style="text-align: right; width: 30%;">
                    ${rightMeta.map(line => `<h3 style="line-height:1;">${line}</h3>`).join('')}
                </div>
                <div class="header-box center-text" style="width: 40%;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                        <img src="${logoUrl}" alt="شعار الديوان الوطني للامتحانات والمسابقات" style="width: 62px; height: 62px; object-fit: contain; flex: 0 0 auto;">
                        <div>
                            <h3 style="line-height:1;">${escapeHtml(center.ministry || 'وزارة التربية الوطنية')}</h3>
                            <h3 style="line-height:1;">${escapeHtml(center.office || 'الديوان الوطني للامتحانات و المسابقات')}</h3>
                            ${center.branch ? `<h3 style="line-height:1;">${escapeHtml(center.branch)}</h3>` : ''}
                        </div>
                    </div>
                </div>
                <div class="header-box" style="text-align: left; width: 30%;">
                    ${leftMeta.map(line => `<h3 style="line-height:1;">${line}</h3>`).join('')}
                </div>
            </div>
            <div class="center-text" style="margin-bottom: 6px;">
                <h2 style="text-decoration: underline; margin: 0; line-height:1.2;">${escapeHtml(options.title)}</h2>
                ${examMeta.length > 0 ? `<h3 style="margin-top: 4px; line-height:1.2;">${examMeta.join(' | ')}</h3>` : ''}
            </div>
            <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 0; background-color: #f9f9f9; align-items: stretch; gap: 0;">
                <div class="header-box" style="text-align: center; width: 33.33%; border-left: 0.5pt solid #000; padding: 5px 6px;">
                    <div style="font-size: 9pt; font-weight: 800; margin-bottom: 2px;">التاريخ</div>
                    <h3 style="margin:0; line-height:1.2;">${escapeHtml(options.dateLabel)}</h3>
                </div>
                <div class="header-box center-text" style="width: 33.33%; border-left: 0.5pt solid #000; padding: 5px 6px;">
                    <div style="font-size: 9pt; font-weight: 800; margin-bottom: 2px;">الفترة</div>
                    <h3 style="margin:0; font-size: 10pt; line-height:1.2;">${escapeHtml(options.periodLabel)}</h3>
                </div>
                <div class="header-box" style="text-align: center; width: 33.33%; padding: 5px 6px;">
                    <div style="font-size: 9pt; font-weight: 800; margin-bottom: 2px;">المواد</div>
                    <h3 style="margin:0; line-height:1.2;">${options.subjects ? escapeHtml(options.subjects) : '&nbsp;'}</h3>
                </div>
            </div>
        </div>
    `;
}

function buildSupervisionSheetPrintHeader(center, options) {
    const headerTitle = escapeHtml(options.headerTitle || 'جدول الحراسة');
    const centerName = escapeHtml(center.centerName || center.institution || '');
    const centerCode = escapeHtml(center.centerCode || '');
    const province = escapeHtml(center.province || '');
    const examValue = escapeHtml(getOfficialExamDisplayName(options.trimester || currentTrimester, options.exam || center.exam || ''));
    const isLyceePrint = options.trimester === 'blanc_lycee';
    const branchLabel = 'الشعبة (*)';
    const branchValue = isLyceePrint ? escapeHtml(getOfficialCenterBranchForPrint(center, options)) : '';
    const sessionValue = escapeHtml(options.session || center.session || '');
    const dayValue = escapeHtml(options.dateLabel || '');
    const periodValue = escapeHtml(options.periodLabel || '');
    const renderLineField = (label, value, flex = '1') => `
        <div style="display:flex; align-items:flex-end; gap:6px; flex:${flex}; min-width:0;">
            <span style="font-size:10.5pt; font-weight:700; white-space:nowrap;">${label}</span>
            <span style="display:inline-flex; align-items:flex-end; justify-content:center; flex:1; min-width:0; min-height:22px; border-bottom:1px dotted #7a7a7a; padding:0 4px 3px; font-size:10.5pt; line-height:1.2; font-weight:700; white-space:nowrap;">${value || '&nbsp;'}</span>
        </div>
    `;
    const renderBoxField = (label, value) => `
        <div style="display:flex; align-items:flex-end; gap:6px; flex:0 0 auto;">
            <span style="font-size:10.5pt; font-weight:700; white-space:nowrap;">${label}</span>
            <span style="display:inline-flex; align-items:center; justify-content:center; min-width:80px; min-height:26px; border:1pt solid #9ca3af; padding:2px 10px; font-size:11pt; font-weight:700; line-height:1.2;">${value || '&nbsp;'}</span>
        </div>
    `;

    return `
        <div class="header-container" style="margin-bottom: 12px;">
            <div class="center-text" style="margin-bottom: 2px;">
                <h3 style="font-size: 15pt; font-weight: 800; line-height: 1.3;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>
                <h3 style="font-size: 13pt; font-weight: 800; line-height: 1.2;">وزارة التربية الوطنية</h3>
            </div>
            <div style="width: 52%; margin: 0 0 12px auto; text-align: right;">
                <h3 style="font-size: 12.5pt; font-weight: 700; line-height: 1.2;">${escapeHtml(center.office || 'الديوان الوطني للامتحانات والمسابقات')}</h3>
            </div>
            <div class="center-text" style="margin-bottom: 16px;">
                <div style="display:inline-block; border: 1.5pt solid #9ca3af; padding: 4px 18px; min-width: 210px;">
                    <h2 style="margin: 0; font-size: 16pt; font-weight: 800; line-height: 1.2;">${headerTitle}</h2>
                </div>
            </div>
            <div style="display:flex; align-items:flex-end; gap:12px; margin-bottom: 10px; width: 100%;">
                ${renderLineField('مركز الإجراء :', centerName, '1.5')}
                ${renderBoxField('رمز المركز:', centerCode)}
                ${renderLineField('الولاية:', province, '1')}
            </div>
            <div style="display:flex; align-items:flex-end; gap:12px; margin-bottom: 10px; width: 100%;">
                ${renderLineField('الامتحان:', examValue, '1.4')}
                ${renderLineField(`${branchLabel} :`, branchValue, '1.2')}
                ${renderLineField('الدورة:', sessionValue, '1')}
            </div>
            <div style="display:flex; align-items:flex-end; gap:24px; margin-bottom: 2px; width: 100%;">
                ${renderLineField('اليوم :', dayValue, '1.5')}
                ${renderLineField('الفترة :', periodValue, '1')}
            </div>
        </div>
    `;
}

function buildOfficialPrintFooter(center, today, options) {
    const footerOptions = options || {};
    const justifyContent = footerOptions.justifyContent || 'space-between';
    const signer = [center.job, center.president].filter(Boolean).join(' - ') || 'رئيس المركز';
    return `
        <div class="footer" style="justify-content: ${justifyContent};">
            <div style="text-align: center;">
                <div style="margin-bottom: 5px;">حرر بـ: ${escapeHtml(center.municipality || center.province || '.......')} في: ${escapeHtml(today)}</div>
                <div>${escapeHtml(signer)}</div>
            </div>
        </div>
    `;
}

function buildOfficialPrintFooter(center, today, options) {
    const footerOptions = options || {};
    const justifyContent = footerOptions.justifyContent || 'space-between';
    const includeJob = footerOptions.includeJob !== false;
    const signerParts = [];
    if (includeJob && center.job) signerParts.push(center.job);
    if (center.president) signerParts.push(center.president);
    const signer = signerParts.join(' - ') || 'رئيس المركز';
    return `
        <div class="footer" style="justify-content: ${justifyContent};">
            <div style="text-align: center;">
                <div style="margin-bottom: 5px;">حرر بـ: ${escapeHtml(center.municipality || center.province || '.......')} في: ${escapeHtml(today)}</div>
                <div>${escapeHtml(signer)}</div>
            </div>
        </div>
    `;
}

/**

 * Render teachers table

 */

let gridInstance = null;

function renderTeachersTable() {

    const wrapper = document.getElementById('gridjs-wrapper');
    if (!wrapper) return;
    const visibleTeachers = getDisplayedSupervisionTeachers();

    if (visibleTeachers.length === 0) {
        document.getElementById('summaryText').textContent = 'اختر اليوم والفترة لعرض قائمة الحراسة';
        if (gridInstance) {
            try { gridInstance.destroy(); } catch (e) { }
            gridInstance = null;
        }
        wrapper.innerHTML = `<div style="padding: 20px; text-align: center; color: #999;">
             ${!document.getElementById('daySelect').value ? 'اختر اليوم والفترة لعرض قائمة الحراسة' : 'لا يوجد حراس معينون لهذه الفترة'}
         </div>`;
        return;
    }

    // Generate location options HTML string
    const locations = getLocations();
    const optionsHtml = `<option value="0">--</option>` + locations.map(l => `<option value="${l.id}">${l.label}</option>`).join('');

    // Map data for Grid.js
    const data = visibleTeachers.map((teacher, idx) => {
        const isReserve = teacher.isReserve === true;

        let rowData = [
            idx + 1,
            getTeacherFullName(teacher),
            gridjs.html(buildTeacherSubjectCellHtml(teacher)),
            teacher.institution || "-"
        ];

        const roomActionHtml = `
            <div style="display: flex; gap: 5px; align-items: center; justify-content: center;">
                <span class="print-only" style="display:none;">${isReserve ? 'احتياط' : getLocationLabel(teacher.room)}</span>
                ${isReserve
                    ? `<span style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; background:#fff7ed; color:#c2410c; border:1px solid #fdba74; font-weight:800; font-size:0.82rem;">احتياط</span>`
                    : `<select class="room-select" onchange="updateRoom('${teacher.id}', this.value)">
                        ${optionsHtml.replace(`value="${teacher.room}"`, `value="${teacher.room}" selected`)}
                    </select>`}
            </div>
        `;

        const noteActionHtml = `
            <span class="print-only" style="white-space: pre-wrap; display:none;">${teacher.note || ''}</span>
            <input type="text" class="note-input"
                   value="${teacher.note || ''}"
                   placeholder="ملاحظة..."
                   onchange="updateNote('${teacher.id}', this.value)">
        `;

        const responsibilityHtml = `
            <div style="display:flex; align-items:center; justify-content:center;">
                <span class="print-only" style="display:none;">${teacher.isResponsible ? 'مسؤول' : ''}</span>
                ${isReserve || !teacher.room
                    ? `<span style="color:#94a3b8; font-weight:700;">--</span>`
                    : `<label style="display:inline-flex; align-items:center; gap:6px; margin:0; cursor:pointer; font-weight:700; color:#334155;">
                        <input type="checkbox" class="responsible-checkbox" data-teacher-id="${teacher.id}" data-room="${teacher.room}" ${teacher.isResponsible ? 'checked' : ''} onchange="updateResponsible('${teacher.id}', this.checked)">
                        <span>مسؤول</span>
                    </label>`}
            </div>
        `;

        rowData.push(gridjs.html(roomActionHtml));
        rowData.push(gridjs.html(responsibilityHtml));
        rowData.push(gridjs.html(noteActionHtml));

        return rowData;
    });

    // Track which rows are reserves for post-render styling
    const reserveIndices = [];

    const columns = [
        { name: '#', width: '60px' },
        { name: 'الأستاذ', width: '250px' },
        { name: 'المادة', width: '150px' },
        { name: 'المؤسسة', width: '180px' },
        { name: 'القاعة / المهمة', width: '250px', sort: false },
        { name: 'المسؤول', width: '120px', sort: false },
        { name: 'ملاحظات', sort: false }
    ];

    // Always destroy and recreate to avoid Grid.js pipeline cache corruption
    if (gridInstance) {
        try { gridInstance.destroy(); } catch (e) { }
        gridInstance = null;
    }
    wrapper.innerHTML = '';

    gridInstance = new gridjs.Grid({
        columns: columns,
        data: data,
        search: true,
        sort: true,
        pagination: {
            limit: 50,
            summary: true
        },
        language: {
            search: { placeholder: 'بحث عن أستاذ...' },
            pagination: {
                previous: 'السابق',
                next: 'التالي',
                navigate: (page, pages) => `صفحة ${page} من ${pages}`,
                page: (page) => `صفحة ${page}`,
                showing: 'عرض',
                of: 'من',
                to: 'إلى',
                results: 'نتائج'
            }
        },
        className: {
            table: 'teachers-table',
            thead: 'thead-light'
        },
        style: {
            table: { width: '100%' },
            td: { textAlign: 'center', verticalAlign: 'middle' },
            th: { textAlign: 'center' }
        }
    }).render(wrapper);

    // Icon consistency for Windows 7
    gridInstance.on('render', () => {
        if (typeof IconManager !== 'undefined') IconManager.render();
    });

    // Apply reserve styling after render
    gridInstance.on('ready', () => {
        setTimeout(() => {
            const rows = wrapper.querySelectorAll('tbody tr');
            rows.forEach((row) => row.classList.remove('reserve-row'));
            reserveIndices.forEach(idx => {
                if (rows[idx]) {
                    rows[idx].classList.add('reserve-row');
                }
            });
        }, 100);
    });

    // Update summary stats
    const guardCount = visibleTeachers.length;
    const reservesCount = currentTeachers.filter(t => t.isReserve).length;
    const activeRooms = new Set(visibleTeachers.filter(t => t.room > 0).map(t => t.room)).size;

    const elTotal = document.getElementById('totalTeachersCount');
    const elRooms = document.getElementById('roomsUsedCount');
    const elReserves = document.getElementById('reservesCount');

    if (elTotal) elTotal.textContent = guardCount;
    if (elRooms) elRooms.textContent = activeRooms;
    if (elReserves) elReserves.textContent = reservesCount || getSelectedReserveCount();

    // Update Print Header
    const daySelect = document.getElementById('daySelect');
    const periodSelect = document.getElementById('periodSelect');
    const printHeader = document.getElementById('printHeaderSubtitle');

    if (printHeader && daySelect && periodSelect) {
        const dayText = daySelect.options[daySelect.selectedIndex]?.text || '';
        const periodText = periodSelect.options[periodSelect.selectedIndex]?.text || '';
        printHeader.textContent = `${dayText} - ${periodText}`;
    }
    updateOfficialPrintHeaderPreview(guardCount, activeRooms, reservesCount || getSelectedReserveCount());

    // Keep legacy summary for compatibility if needed (hidden)
    const summaryText = document.getElementById('summaryText');
    if (summaryText) {
        const roomCounts = {};
        visibleTeachers.forEach(t => {
            roomCounts[t.room] = (roomCounts[t.room] || 0) + 1;
        });
        const summaryParts = Object.entries(roomCounts)
            .sort((a, b) => a[0] - b[0])
            .map(([room, count]) => `${getLocationLabel(parseInt(room))}: ${count}`);
        summaryText.textContent = `عدد الحراس: ${guardCount} | الاحتياط: ${reservesCount} | ${summaryParts.join(' | ')}`;
    }
}

function getSupervisionPeriodLabel(period) {
    if (period === 'midday') return 'فترة المنتصف';
    if (period === 'evening') return 'الفترة المسائية';
    return 'الفترة الصباحية';
}

async function exportSupervisionListToExcel() {

    if (!window.ExcelExportHelper) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'ميزة تصدير Excel غير جاهزة حالياً' });
        return;
    }

    const dayId = document.getElementById('daySelect').value;
    const period = document.getElementById('periodSelect').value;

    const displayedTeachers = getDisplayedSupervisionTeachers();

    if (!dayId || !period || displayedTeachers.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار اليوم والفترة أولاً' });
        return;
    }

    const day = days.find(d => d.id === parseInt(dayId, 10));
    if (!day || !day[period]) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'تعذر تحديد بيانات الفترة المختارة' });
        return;
    }

    const center = await getOfficialCenterData();
    const subjects = (day[period].subjects || []).filter(Boolean).join(' + ') || 'غير محدد';
    const dateLabel = new Date(day.date).toLocaleDateString('ar-DZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const sortedTeachers = [...displayedTeachers].sort((a, b) => {
        const roomA = a.isReserve ? Number.MAX_SAFE_INTEGER : (a.room || 0);
        const roomB = b.isReserve ? Number.MAX_SAFE_INTEGER : (b.room || 0);
        if (roomA !== roomB) return roomA - roomB;
        return `${a.surname || ''} ${a.name || ''}`.localeCompare(`${b.surname || ''} ${b.name || ''}`, 'ar');
    });

    const rows = sortedTeachers.map((teacher, index) => [
        index + 1,
        `${teacher.surname || ''} ${teacher.name || ''}`.trim(),
        teacher.subjects && teacher.subjects.length > 0 ? teacher.subjects[0] : '-',
        teacher.institution || '-',
        teacher.isReserve ? 'احتياط' : (getLocationLabel(teacher.room) || ''),
        teacher.note || ''
    ]);

    const guardCount = displayedTeachers.length;
    const reservesCount = currentTeachers.filter(t => t.isReserve).length;
    const activeRooms = new Set(
        currentTeachers
            .filter(t => !t.isReserve && t.room > 0)
            .map(t => getLocationLabel(t.room))
            .filter(Boolean)
    ).size;

    try {
        await window.ExcelExportHelper.exportWorkbook({
            fileName: `قوائم_الحراسة_${window.ExcelExportHelper.dateStamp()}.xlsx`,
            sheets: [{
                sheetName: 'قائمة الحراسة',
                title: 'قائمة الحراسة',
                metaRows: [
                    `مركز الإجراء: ${center.centerName || ''} | رقم المركز: ${center.centerCode || ''}`,
                    `الامتحان: ${getOfficialExamDisplayName(currentTrimester, center.exam) || ''} | الدورة: ${center.session || ''}`,
                    `التاريخ: ${dateLabel}`,
                    `الفترة: ${getPeriodLabel(period)} | المواد: ${subjects}`,
                    `الإحصائيات: عدد الحراس ${guardCount} | القاعات المستعملة ${activeRooms} | الاحتياط ${reservesCount}`
                ],
                headers: ['#', 'الأستاذ', 'المادة', 'المؤسسة', 'القاعة / المهمة', 'ملاحظات'],
                rows: rows
            }]
        });
    } catch (error) {
        console.error('Export Supervision List Error:', error);
        Swal.fire({ icon: 'error', title: 'خطأ', text: `تعذر تصدير الملف: ${error.message}` });
    }

}

async function updateRoomSelects() {

    const validIds = getLocations().map(l => l.id);
    let invalidResetCount = 0;

    currentTeachers.forEach(t => {
        if (t.isReserve) {
            t.room = 0;
            t.isResponsible = false;
            return;
        }

        if (!validIds.includes(t.room) && t.room !== 0) {
            t.room = 0;
            t.isResponsible = false;
            invalidResetCount++;
        }

        if (!t.room) {
            t.isResponsible = false;
        }

    });

    ensureRoomResponsibles();

    await saveCurrentAssignments();

    renderTeachersTable();

    if (invalidResetCount > 0) {
        Swal.fire({
            icon: 'info',
            title: 'تم تحديث القاعات',
            text: `تم إلغاء إسناد ${invalidResetCount} حارس من قاعات غير صالحة. يرجى إعادة التوزيع أو التعيين اليدوي.`,
            timer: 2200,
            showConfirmButton: false
        });
    }

}

// Update room assignment for a teacher
window.updateRoom = async function (id, value) {
    const teacher = currentTeachers.find(t => t.id === id);
    if (teacher) {
        const previousRoom = teacher.room;
        if (teacher.isReserve) {
            teacher.room = 0;
            teacher.isResponsible = false;
            return;
        }
        const nextRoom = parseInt(value, 10) || 0;
        if (teacher.room !== nextRoom) {
            teacher.isResponsible = false;
        }
        teacher.room = nextRoom;
        if (previousRoom !== nextRoom) {
            ensureRoomResponsibles();
        }
        await saveCurrentAssignments();
        renderTeachersTable();
    }
};

window.updateResponsible = async function (id, checked) {
    const teacher = currentTeachers.find((item) => item.id === id);
    if (!teacher || teacher.isReserve || !teacher.room) return;
    const roomId = teacher.room;

    if (checked) {
        currentTeachers.forEach((item) => {
            if (!item.isReserve && item.room === roomId) {
                item.isResponsible = item.id === id;
            }
        });
    } else {
        teacher.isResponsible = false;
    }

    await saveCurrentAssignments();
    const roomCheckboxes = document.querySelectorAll(`.responsible-checkbox[data-room="${roomId}"]`);
    roomCheckboxes.forEach((checkbox) => {
        checkbox.checked = checkbox.getAttribute('data-teacher-id') === String(id) ? checked : false;
    });
};

// Update note for a teacher
window.updateNote = async function (id, value) {
    const teacher = currentTeachers.find(t => t.id === id);
    if (teacher) {
        teacher.note = value;
        await saveCurrentAssignments();
    }
};

/**

 * Distribute teachers to rooms randomly

 */

function getTeacherRoomUsageMap(excludedAssignmentKey) {

    const usageMap = {};

    Object.keys(roomAssignments || {}).forEach((assignmentKey) => {

        if (assignmentKey === excludedAssignmentKey) return;

        const teacherEntries = roomAssignments[assignmentKey];
        if (!teacherEntries || typeof teacherEntries !== 'object') return;

        Object.keys(teacherEntries).forEach((teacherId) => {

            const entry = teacherEntries[teacherId];
            const roomId = entry && entry.room ? parseInt(entry.room, 10) : 0;

            if (!roomId || (entry && entry.isReserve)) return;

            if (!usageMap[teacherId]) {
                usageMap[teacherId] = {};
            }

            usageMap[teacherId][roomId] = (usageMap[teacherId][roomId] || 0) + 1;

        });

    });

    return usageMap;

}

function compareCurrentTeacherNames(a, b) {
    const surnameDiff = String(a.surname || '').localeCompare(String(b.surname || ''), 'ar');
    if (surnameDiff !== 0) return surnameDiff;
    const nameDiff = String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    if (nameDiff !== 0) return nameDiff;
    return String(a.id || '').localeCompare(String(b.id || ''), 'ar');
}

function getCurrentResponsibleByRoom() {
    const roomMap = {};
    currentTeachers.forEach((teacher) => {
        if (!teacher || teacher.isReserve || !teacher.room || !teacher.isResponsible) return;
        roomMap[String(teacher.room)] = teacher.id;
    });
    return roomMap;
}

function ensureRoomResponsibles(preferredResponsibleByRoom = null) {
    const roomGroups = new Map();

    currentTeachers.forEach((teacher) => {
        if (!teacher || teacher.isReserve || !teacher.room) {
            if (teacher) teacher.isResponsible = false;
            return;
        }
        const roomKey = String(teacher.room);
        if (!roomGroups.has(roomKey)) roomGroups.set(roomKey, []);
        roomGroups.get(roomKey).push(teacher);
    });

    roomGroups.forEach((teachersInRoom, roomKey) => {
        const preferredId = preferredResponsibleByRoom ? preferredResponsibleByRoom[roomKey] : null;
        let chosen = preferredId
            ? teachersInRoom.find((teacher) => String(teacher.id) === String(preferredId))
            : null;

        if (!chosen) {
            const existingResponsibles = teachersInRoom.filter((teacher) => teacher.isResponsible);
            if (existingResponsibles.length === 1) {
                chosen = existingResponsibles[0];
            } else if (existingResponsibles.length > 1) {
                chosen = [...existingResponsibles].sort(compareCurrentTeacherNames)[0];
            }
        }

        if (!chosen) {
            chosen = [...teachersInRoom].sort(compareCurrentTeacherNames)[0] || null;
        }

        teachersInRoom.forEach((teacher) => {
            teacher.isResponsible = !!chosen && teacher.id === chosen.id;
        });
    });
}

function buildRoomCapacityMap(locations, guardCount) {
    const capacities = {};
    if (!Array.isArray(locations) || locations.length === 0) return capacities;

    const shuffledLocations = [...locations].sort(() => Math.random() - 0.5);
    const baseLoad = Math.floor(guardCount / shuffledLocations.length);
    let remainder = guardCount % shuffledLocations.length;

    shuffledLocations.forEach((location) => {
        capacities[location.id] = baseLoad + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
    });

    return capacities;
}

function pickBestLocationForTeacher(teacher, locations, roomLoadMap, teacherRoomUsageMap, roomCapacityMap) {

    const teacherId = String(teacher.id);
    const usedRooms = teacherRoomUsageMap[teacherId] || {};
    const rankedLocations = [...locations].sort(() => Math.random() - 0.5);
    const underCapacityLocations = rankedLocations.filter((location) => {
        const capacity = roomCapacityMap && roomCapacityMap[location.id];
        if (capacity === undefined) return true;
        return (roomLoadMap[location.id] || 0) < capacity;
    });
    const candidateLocations = underCapacityLocations.length > 0 ? underCapacityLocations : rankedLocations;

    candidateLocations.sort((a, b) => {

        const aUsage = usedRooms[a.id] || 0;
        const bUsage = usedRooms[b.id] || 0;
        const aSeenBefore = aUsage > 0 ? 1 : 0;
        const bSeenBefore = bUsage > 0 ? 1 : 0;

        if (aSeenBefore !== bSeenBefore) return aSeenBefore - bSeenBefore;

        const aCapacity = roomCapacityMap && roomCapacityMap[a.id] !== undefined ? roomCapacityMap[a.id] : Number.MAX_SAFE_INTEGER;
        const bCapacity = roomCapacityMap && roomCapacityMap[b.id] !== undefined ? roomCapacityMap[b.id] : Number.MAX_SAFE_INTEGER;
        const aRemaining = aCapacity - (roomLoadMap[a.id] || 0);
        const bRemaining = bCapacity - (roomLoadMap[b.id] || 0);
        if (aRemaining !== bRemaining) return bRemaining - aRemaining;

        const aLoad = roomLoadMap[a.id] || 0;
        const bLoad = roomLoadMap[b.id] || 0;
        if (aLoad !== bLoad) return aLoad - bLoad;

        if (aUsage !== bUsage) return aUsage - bUsage;

        return 0;

    });

    return candidateLocations[0] || null;

}

async function distributeRooms() {

    if (currentTeachers.length === 0) {

        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا يوجد حراس للتوزيع' });

        return;

    }

    const locations = getLocations();

    if (locations.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى إعداد القاعات لهذه الفترة من "إعدادات القاعات".' });
        return;
    }

    const dayId = document.getElementById('daySelect').value;
    const period = document.getElementById('periodSelect').value;
    const currentAssignmentKey = dayId && period ? `${dayId}_${period}` : '';
    const teacherRoomUsageMap = getTeacherRoomUsageMap(currentAssignmentKey);
    const previousResponsibleByRoom = getCurrentResponsibleByRoom();
    const roomLoadMap = {};
    const preferredStage = await getPreferredEducationStageForLists();
    const preferredStageLabel = getStageDisplayLabel(preferredStage);
    const guardTeachers = currentTeachers.filter((teacher) => !teacher.isReserve);
    const roomCapacityMap = buildRoomCapacityMap(locations, guardTeachers.length);
    const activeLocations = locations.filter((location) => (roomCapacityMap[location.id] || 0) > 0);
    const roomHasPreferredStageTeacherMap = {};
    locations.forEach((location) => {
        roomHasPreferredStageTeacherMap[location.id] = false;
    });
    const anchoredPreferredStageTeacherIds = new Set();

    locations.forEach((location) => {
        roomLoadMap[location.id] = 0;
    });

    const shuffledGuards = [...guardTeachers].sort(() => Math.random() - 0.5);
    const preferredStageGuards = shuffledGuards.filter((teacher) => getTeacherEducationStage(teacher.rank) === preferredStage);

    preferredStageGuards.forEach((teacher) => {
        const uncoveredLocations = activeLocations.filter((location) => {
            const capacity = roomCapacityMap[location.id] || 0;
            return !roomHasPreferredStageTeacherMap[location.id] && (roomLoadMap[location.id] || 0) < capacity;
        });
        if (uncoveredLocations.length === 0) return;

        const bestLocation = pickBestLocationForTeacher(teacher, uncoveredLocations, roomLoadMap, teacherRoomUsageMap, roomCapacityMap);
        if (!bestLocation) return;

        teacher.room = bestLocation.id;
        teacher.isResponsible = false;
        roomLoadMap[bestLocation.id] = (roomLoadMap[bestLocation.id] || 0) + 1;
        roomHasPreferredStageTeacherMap[bestLocation.id] = true;
        anchoredPreferredStageTeacherIds.add(String(teacher.id));
    });

    const shuffled = [
        ...shuffledGuards.filter((teacher) => !anchoredPreferredStageTeacherIds.has(String(teacher.id))),
        ...currentTeachers.filter((teacher) => teacher.isReserve).sort(() => Math.random() - 0.5)
    ];

    shuffled.forEach((teacher) => {

        if (teacher.isReserve) {
            teacher.room = 0; // No room for reserve
            teacher.isResponsible = false;
            return;
        }

        const bestLocation = pickBestLocationForTeacher(teacher, locations, roomLoadMap, teacherRoomUsageMap, roomCapacityMap);
        teacher.room = bestLocation ? bestLocation.id : 0;
        teacher.isResponsible = false;

        if (bestLocation) {
            roomLoadMap[bestLocation.id] = (roomLoadMap[bestLocation.id] || 0) + 1;
            if (getTeacherEducationStage(teacher.rank) === preferredStage) {
                roomHasPreferredStageTeacherMap[bestLocation.id] = true;
            }
        }

    });

    ensureRoomResponsibles(previousResponsibleByRoom);

    await saveCurrentAssignments();

    renderTeachersTable();

    const usedLocationsWithoutPreferredStage = activeLocations.filter((location) => (roomLoadMap[location.id] || 0) > 0 && !roomHasPreferredStageTeacherMap[location.id]);
    if (usedLocationsWithoutPreferredStage.length > 0) {
        Swal.fire({
            icon: 'info',
            title: 'تم التوزيع مع تنبيه',
            text: `تعذر ضمان أستاذ طور ${preferredStageLabel} في ${usedLocationsWithoutPreferredStage.length} قاعة من أصل ${activeLocations.length} بسبب نقص أساتذة هذا الطور أو قيود التوزيع الحالية.`
        });
    }

}

/**

 * Load data from localStorage

 */

async function loadData() {
    await migrateLegacyNamespaceIfNeeded();

    // Load teachers from central DB and map format
    let proctors = await DB.getExamProctors();
    proctors = proctors || [];
    const center = await DB.getOfficialCenter() || {};
    const defaultInst = center.center_name || "غير محدد";

    teachers = proctors.map(t => ({
        id: normalizeLegacyTeacherId(t.id),
        surname: t.last_name,
        name: t.first_name,
        subjects: t.subject ? [t.subject] : [],
        institution: t.institution || defaultInst,
        rank: t.rank || "",
        isExempt: t.isExempt || false
    }));
    teacherDirectory = teachers.slice();

    // Load periodRooms
    await loadPeriodRooms();

    // Load trimester
    const savedTrimester = await readStoredValue(STORAGE_KEYS.TRIMESTER, { includeLocalStorage: true });
    if (savedTrimester) currentTrimester = savedTrimester;

    // Load per-trimester data
    await loadTrimesterData();

}

/**
 * Load trimester-specific data (days, schedule, room assignments)
 */
async function loadTrimesterData() {
    const keys = getTrimesterKeys(currentTrimester);

    days = await readStoredValue(keys.DAYS, { includeLocalStorage: true, parseJson: true }) || [];
    schedule = await readStoredValue(keys.SCHEDULE, { includeLocalStorage: true, parseJson: true }) || {};
    reserveSchedule = await readStoredValue(keys.RESERVE_SCHEDULE, { includeLocalStorage: true, parseJson: true }) || {};
    roomAssignments = await readStoredValue(keys.ROOM_ASSIGNMENTS, { includeLocalStorage: true, parseJson: true }) || {};
    const normalizedAssignments = normalizeAssignmentStores(schedule, reserveSchedule);
    const assignmentsChanged = JSON.stringify(normalizedAssignments.schedule) !== JSON.stringify(schedule)
        || JSON.stringify(normalizedAssignments.reserveSchedule) !== JSON.stringify(reserveSchedule);
    schedule = normalizedAssignments.schedule;
    reserveSchedule = normalizedAssignments.reserveSchedule;
    if (assignmentsChanged) {
        await persistStoredJson(keys.SCHEDULE, schedule);
        await persistStoredJson(keys.RESERVE_SCHEDULE, reserveSchedule);
    }
    teachers = buildTeacherDirectoryForTrimester(teacherDirectory, schedule, reserveSchedule, roomAssignments);
}

/**

 * Save current assignments to storage

 */

async function saveCurrentAssignments() {

    const dayId = document.getElementById('daySelect').value;

    const period = document.getElementById('periodSelect').value;

    if (!dayId || !period) return;

    const key = `${dayId}_${period}`;

    roomAssignments[key] = {};

    currentTeachers.forEach(t => {

        roomAssignments[key][t.id] = {

            room: t.room,

            note: t.note,

            isResponsible: t.isReserve ? false : !!t.isResponsible

        };

    });

    await saveRoomAssignments();

}

/**
 *
 * Save room assignments
 *
 */

async function saveRoomAssignments() {

    const keys = getTrimesterKeys(currentTrimester);
    await persistStoredJson(keys.ROOM_ASSIGNMENTS, roomAssignments);

}

/**

 * Populate day select dropdown

 */

function populateDaySelect() {

    const select = document.getElementById('daySelect');

    select.innerHTML = '<option value="">-- اختر اليوم --</option>';

    if (days.length === 0) {

        select.innerHTML += '<option value="" disabled>لا توجد أيام مسجلة</option>';

        return;

    }

    days.forEach(day => {

        const date = new Date(day.date);

        const dateStr = date.toLocaleDateString('ar-DZ', {

            weekday: 'long',

            year: 'numeric',

            month: 'long',

            day: 'numeric'

        });

        select.innerHTML += `<option value="${day.id}">${dateStr}</option>`;

    });

}

/**

 * Load teachers assigned to selected day/period

 */

/**
 * Populate period select based on day
 */
function populatePeriodSelect() {
    const dayId = parseInt(document.getElementById('daySelect').value);
    const periodSelect = document.getElementById('periodSelect');
    const currentValue = periodSelect.value;

    let html = '<option value="morning">صباح</option>';

    const day = days.find(d => d.id === dayId);
    if (day && day.midday) {
        html += '<option value="midday">منتصف</option>';
    }

    html += '<option value="evening">مساء</option>';
    periodSelect.innerHTML = html;

    if (currentValue) periodSelect.value = currentValue;
}

function loadTeachersForPeriod() {
    const dayId = parseInt(document.getElementById('daySelect').value);
    const period = document.getElementById('periodSelect').value;

    if (!dayId || !period) {
        currentTeachers = [];
        renderTeachersTable();
        return;
    }

    const day = days.find(d => d.id === dayId);
    if (!day) return;

    const key = `${dayId}_${period}`;
    const assignedTeacherIds = normalizeTeacherIdList(schedule[key] || []);
    const reserveTeacherIds = normalizeTeacherIdList(reserveSchedule[key] || []).filter((tid) => !assignedTeacherIds.includes(tid));
    const mergedTeacherIds = assignedTeacherIds.concat(reserveTeacherIds);
    const reserveTeacherIdSet = new Set(reserveTeacherIds);

    currentTeachers = mergedTeacherIds.map((tid) => {
        const teacher = teachers.find((t) => normalizeLegacyTeacherId(t.id) === tid) || createLegacyTeacherPlaceholder(tid);
        const saved = roomAssignments[key]?.[tid] || roomAssignments[key]?.[teacher.id] || {};
        const isReserve = reserveTeacherIdSet.has(tid);
        return {
            id: normalizeLegacyTeacherId(teacher.id),
            surname: teacher.surname,
            name: teacher.name,
            subjects: Array.isArray(teacher.subjects) ? teacher.subjects : [],
            rank: teacher.rank || '',
            institution: teacher.institution,
            room: isReserve ? 0 : (parseInt(saved.room, 10) || 0),
            note: saved.note || '',
            isResponsible: !isReserve && saved.isResponsible === true,
            isReserve: isReserve,
            isLegacyPlaceholder: teacher.isLegacyPlaceholder === true
        };
    });

    currentTeachers.sort((a, b) => {
        if (a.isReserve !== b.isReserve) return a.isReserve ? 1 : -1;
        return a.surname.localeCompare(b.surname, 'ar');
    });

    let periodLabel = 'صباحية';
    if (period === 'midday') periodLabel = 'منتصف';
    if (period === 'evening') periodLabel = 'مسائية';

    const subjects = (day[period].subjects || []).join(' + ') || 'غير محدد';

    const dateStr = new Date(day.date).toLocaleDateString('ar-DZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    const printHeader = document.getElementById('printHeaderSubtitle');
    if (printHeader) {
        printHeader.textContent = `${dateStr} - ${periodLabel} (${subjects})`;
    }

    const topBarTitle = document.querySelector('.top-bar-controls h3');
    if (topBarTitle) {
        topBarTitle.textContent = `${dateStr} - ${periodLabel}`;
    }

    renderTeachersTable();
}

/**

 * Print supervision list

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

async function printSupervisionList() {
    if (blockTrialPrint()) return;

    const dayId = document.getElementById('daySelect').value;

    const period = document.getElementById('periodSelect').value;

    if (!dayId || !period || currentTeachers.length === 0) {

        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار اليوم والفترة أولا' });

        return;

    }

    const day = days.find(d => d.id === parseInt(dayId));

    if (!day) return;

    let periodLabel = 'الفترة الصباحية';
    if (period === 'midday') periodLabel = 'فترة المنتصف';
    if (period === 'evening') periodLabel = 'الفترة المسائية';

    const subjects = (day[period].subjects || []).join(' + ') || 'غير محدد';

    const dateStr = new Date(day.date).toLocaleDateString('ar-DZ', {

        weekday: 'long',

        year: 'numeric',

        month: 'long',

        day: 'numeric'

    });

    const settings = await getOfficialCenterData();

    const today = new Date().toLocaleDateString('ar-DZ');

    // Sort teachers by room then by name

    const sortedTeachers = [...currentTeachers].sort((a, b) => {

        if (a.room !== b.room) return a.room - b.room;

        return a.surname.localeCompare(b.surname, 'ar');

    });

    // Function to shorten subject names

    const shortenSubject = (subj) => {

        if (!subj) return '-';

        return subj

            .replace('العلوم الفيزيائية والتكنولوجيا', 'ع فيزيائية')

            .replace('العلوم الطبيعية والحياة', 'علوم طبيعية')

            .replace('اللغة العربية', 'عربية')

            .replace('اللغة الفرنسية', 'فرنسية')

            .replace('اللغة الإنجليزية', 'إنجليزية')

            .replace('الرياضيات', 'رياضيات')

            .replace('التاريخ والجغرافيا', 'تاريخ')

            .replace('التربية الإسلامية', 'إسلامية')

            .replace('التربية المدنية', 'مدنية')

            .replace('التربية البدنية والرياضية', 'رياضة')

            .replace('التربية التشكيلية', 'تشكيلية')

            .replace('التربية الموسيقية', 'موسيقى')

            .replace('الإعلام الآلي', 'إعلام آلي');

    };

    // Generate single table with room column

    const rowsHtml = sortedTeachers.map((t, idx) => `<tr class="animate-fade-in-up stagger-item stagger-${(typeof index !== "undefined" ? index % 10 : 0) + 1}">

            <td>${idx + 1}</td>

            <td style="text-align: right; padding-right: 10px;">${t.surname} ${t.name}</td>

            <td>${shortenSubject(t.subjects.length > 0 ? t.subjects[0] : '-')}</td>

            <td><strong>${t.isReserve ? 'احتياط' : getLocationLabel(t.room)}</strong></td>

            <td>${t.note || ''}</td>

        </tr>

    `).join('');

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>قائمة الحراسة</title>

            <style>

                * { box-sizing: border-box; }

                body {
                    font-family: 'Cairo', 'Tajawal', sans-serif;
                    margin: 0;
                    padding: 0.5cm;
                }

                .header-container { width: 100%; margin-bottom: 8px; }

                .center-text { text-align: center; }

                h1, h2, h3 { margin: 0; color: #000; padding: 0; line-height: 1.2; }

                h2 { font-size: 14pt; margin-bottom: 2px; }

                h3 { font-size: 11pt; margin-bottom: 2px; }

                .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; padding: 2px 0; }

                .header-box { width: 33%; }

                table { width: 100%; border-collapse: collapse; margin-top: 8px; }

                th, td { border: 0.5pt solid #000; padding: 4px 6px; text-align: center; font-size: 10pt; line-height: 1.3; }

                th { background-color: #e0e0e0; font-weight: bold; }

                .footer { margin-top: 25px; display: flex; justify-content: space-between; font-size: 10pt; }

                @media print {

                    @page { margin: 0.8cm; size: A4; }

                    body { -webkit-print-color-adjust: exact; }

                }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            <div class="header-container">

                <div class="center-text" style="margin-bottom: 2px;">

                    <h3 style="line-height:1;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>

                    <h3 style="line-height:1;">وزارة التربية الوطنية</h3>

                </div>

                <div class="header-row" style="margin-bottom: 2px;">

                    <div class="header-box" style="text-align: right;">

                        <h3 style="line-height:1;">المركز: ${settings.center_name || settings.institution || '.......'}</h3>

                    </div>

                    <div class="header-box" style="text-align: left;">

                         <h3 style="line-height:1;">ولاية ${settings.province || '.......'}</h3>

                    </div>

                </div>

                <div class="center-text" style="margin-bottom: 5px;">

                    <h2 style="text-decoration: underline; margin: 0; line-height:1.2;">قائمة الحراسة</h2>

                </div>

                <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 3px 0; background-color: #f9f9f9; align-items: center;">

                     <div class="header-box" style="text-align: right; width: 40%;">

                        <h3 style="margin:0; line-height:1; display:flex; align-items:center; justify-content:flex-end; gap:5px;">${IconManager.get('calendar')} ${dateStr}</h3>

                    </div>

                    <div class="header-box center-text" style="width: 20%;">

                        <h3 style="margin:0; font-size: 10pt; line-height:1;">${periodLabel}</h3>

                    </div>

                    <div class="header-box" style="text-align: left; width: 40%;">

                         <h3 style="margin:0; line-height:1;">المواد: ${subjects}</h3>

                    </div>

                </div>

            </div>

            <table>

                <thead>

                    <tr>
                        <th width="6%">#</th>
                        <th width="45%">اللقب والاسم</th>
                        <th width="22%">المادة</th>
                        <th width="10%">القاعة</th>
                        <th width="17%">ملاحظة</th>
                    </tr>

                </thead>

                <tbody>

                    ${rowsHtml}

                </tbody>

            </table>

            <div class="footer" style="justify-content: flex-end;">
                <div style="text-align: center;">
                    <div style="margin-bottom: 5px;">حرر بـ: ${settings.municipality || settings.province || '.......'} في: ${today}</div>
                    <div>المدير</div>
                </div>
            </div>

            <script>

                window.onload = function() {

                    // auto-print removed

                };

            </script>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}\n        </body>

        </html>

    `);

    printWindow.document.close();

}

/**
 * Print teacher attendance sign-in sheet (قائمة إمضاء حضور الأساتذة)
 */
async function printTeacherRoomList(teacherList, title) {
    const state = getCurrentSelectionState();
    if (!state.dayId || !state.period || !state.day || !teacherList || teacherList.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار اليوم والفترة أولاً' });
        return;
    }

    const center = await getOfficialCenterData();
    const today = new Date().toLocaleDateString('ar-DZ');
    const showSubjectColumn = shouldShowSubjectColumnInSupervisionPrint();
    const dateStr = new Date(state.day.date).toLocaleDateString('ar-DZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const periodLabel = getPeriodLabel(state.period);
    const subjects = ((state.day[state.period] && state.day[state.period].subjects) || []).filter(Boolean).join(' + ') || 'غير محدد';
    const printableRows = buildPrintableRoomRows(teacherList);
    const collectPrintableTeachers = (teacher, extraTeachers) => [teacher, ...(extraTeachers || [])].filter(Boolean);
    const buildPrintableTeacherCell = (teacher, extraTeachers, valueBuilder, align = 'right') => {
        const teachers = collectPrintableTeachers(teacher, extraTeachers);
        if (teachers.length === 0) return '&nbsp;';
        return teachers.map((currentTeacher) => `
            <div style="padding: 2px 0; text-align: ${align};">
                ${valueBuilder(currentTeacher)}
            </div>
        `).join('');
    };

    const rowsHtml = printableRows.map((row) => `
        <tr>
            <td><strong>${escapeHtml(row.roomLabel)}</strong></td>
            <td style="text-align: right; padding-right: 8px;">${buildPrintableTeacherCell(row.responsibleTeacher, [], currentTeacher => `<span style="font-weight: 700;">${escapeHtml(getTeacherFullName(currentTeacher))}</span>`)}</td>
            ${showSubjectColumn ? `<td>${buildPrintableTeacherCell(row.responsibleTeacher, [], currentTeacher => escapeHtml(shortenSubjectLabel(getTeacherPrimarySubject(currentTeacher))), 'center')}</td>` : ''}
            <td style="text-align: right; padding-right: 8px;">${buildPrintableTeacherCell(row.secondTeacher, [], currentTeacher => `<span style="font-weight: 700;">${escapeHtml(getTeacherFullName(currentTeacher))}</span>`)}</td>
            ${showSubjectColumn ? `<td>${buildPrintableTeacherCell(row.secondTeacher, [], currentTeacher => escapeHtml(shortenSubjectLabel(getTeacherPrimarySubject(currentTeacher))), 'center')}</td>` : ''}
            <td style="text-align: right; padding-right: 8px;">${buildPrintableTeacherCell(row.thirdTeachers[0] || null, row.thirdTeachers.slice(1), currentTeacher => `<span style="font-weight: 700;">${escapeHtml(getTeacherFullName(currentTeacher))}</span>`)}</td>
            ${showSubjectColumn ? `<td>${buildPrintableTeacherCell(row.thirdTeachers[0] || null, row.thirdTeachers.slice(1), currentTeacher => escapeHtml(shortenSubjectLabel(getTeacherPrimarySubject(currentTeacher))), 'center')}</td>` : ''}
        </tr>
    `).join('');

    const tableHeaderHtml = showSubjectColumn ? `
                    <tr>
                        <th rowspan="2" width="10%" class="room-head">رقم<br>القاعة</th>
                        <th colspan="2" width="30%" class="main-head">الحارس الرئيسي</th>
                        <th colspan="2" width="30%" class="main-head">الحارس الثاني</th>
                        <th colspan="2" width="30%" class="main-head">الحارس الثالث</th>
                    </tr>
                    <tr>
                        <th width="19%" class="sub-head">اللقب والاسم</th>
                        <th width="11%" class="sub-head">المادة</th>
                        <th width="19%" class="sub-head">اللقب والاسم</th>
                        <th width="11%" class="sub-head">المادة</th>
                        <th width="19%" class="sub-head">اللقب والاسم</th>
                        <th width="11%" class="sub-head">المادة</th>
                    </tr>
                ` : `
                    <tr>
                        <th width="10%" class="room-head">رقم<br>القاعة</th>
                        <th width="30%" class="main-head">الحارس الرئيسي</th>
                        <th width="30%" class="main-head">الحارس الثاني</th>
                        <th width="30%" class="main-head">الحارس الثالث</th>
                    </tr>
                `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${escapeHtml(title)}</title>
            <style>
                * { box-sizing: border-box; }
                body { font-family: 'Cairo', 'Tajawal', sans-serif; margin: 0; padding: 0.5cm; }
                .header-container { width: 100%; margin-bottom: 8px; }
                .center-text { text-align: center; }
                h1, h2, h3 { margin: 0; color: #000; padding: 0; line-height: 1.2; }
                h2 { font-size: 14pt; margin-bottom: 2px; }
                h3 { font-size: 11pt; margin-bottom: 2px; }
                .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; padding: 2px 0; }
                .header-box { width: 33%; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: fixed; }
                th, td { border: 0.5pt solid #000; padding: 4px 5px; text-align: center; font-size: 9.3pt; line-height: 1.25; vertical-align: top; }
                th { background-color: #fff; font-weight: bold; vertical-align: middle; }
                .main-head { font-size: 11pt; font-weight: 800; padding: 3px 4px; }
                .sub-head { font-size: 9.2pt; font-weight: 700; padding: 3px 4px; }
                .room-head { font-size: 10pt; font-weight: 800; line-height: 1.2; }
                .footer { margin-top: 25px; display: flex; justify-content: space-between; font-size: 10pt; }
                @media print {
                    @page { margin: 0.8cm; size: A4; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}
            ${buildSupervisionSheetPrintHeader(center, {
                title: title,
                headerTitle: 'جدول الحراسة',
                trimester: currentTrimester,
                dateLabel: dateStr,
                periodLabel: periodLabel,
                subjects: subjects,
                exam: getOfficialExamDisplayName(currentTrimester, center.exam),
                session: center.session
            })}
            <table>
                <thead>
                    ${tableHeaderHtml}
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
            ${buildOfficialPrintFooter(center, today, { justifyContent: 'flex-end' })}
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
        </body>
        </html>
    `);
    printWindow.document.close();
}

async function printSimpleReserveTeacherList(teacherList, title) {
    const state = getCurrentSelectionState();
    if (!state.dayId || !state.period || !state.day || !teacherList || teacherList.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار اليوم والفترة أولاً' });
        return;
    }

    const center = await getOfficialCenterData();
    const today = new Date().toLocaleDateString('ar-DZ');
    const dateStr = new Date(state.day.date).toLocaleDateString('ar-DZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const periodLabel = getPeriodLabel(state.period);
    const subjects = ((state.day[state.period] && state.day[state.period].subjects) || []).filter(Boolean).join(' + ') || 'غير محدد';
    const sortedTeachers = [...teacherList].sort((a, b) => getTeacherFullName(a).localeCompare(getTeacherFullName(b), 'ar'));

    const rowsHtml = sortedTeachers.map((teacher, index) => `
        <tr>
            <td>${index + 1}</td>
            <td style="text-align: right; padding-right: 10px;">${escapeHtml(getTeacherFullName(teacher))}</td>
            <td>${escapeHtml(shortenSubjectLabel(getTeacherPrimarySubject(teacher)))}</td>
        </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${escapeHtml(title)}</title>
            <style>
                * { box-sizing: border-box; }
                body { font-family: 'Cairo', 'Tajawal', sans-serif; margin: 0; padding: 0.5cm; }
                .header-container { width: 100%; margin-bottom: 8px; }
                .center-text { text-align: center; }
                h1, h2, h3 { margin: 0; color: #000; padding: 0; line-height: 1.2; }
                h2 { font-size: 14pt; margin-bottom: 2px; }
                h3 { font-size: 11pt; margin-bottom: 2px; }
                .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; padding: 2px 0; }
                .header-box { width: 33%; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th, td { border: 0.5pt solid #000; padding: 5px 6px; text-align: center; font-size: 10pt; line-height: 1.3; }
                th { background-color: #e0e0e0; font-weight: bold; }
                .footer { margin-top: 25px; display: flex; justify-content: space-between; font-size: 10pt; }
                @media print {
                    @page { margin: 0.8cm; size: A4; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}
            ${buildSupervisionSheetPrintHeader(center, {
                title: title,
                headerTitle: title,
                trimester: currentTrimester,
                dateLabel: dateStr,
                periodLabel: periodLabel,
                subjects: subjects,
                exam: getOfficialExamDisplayName(currentTrimester, center.exam),
                session: center.session
            })}
            <table>
                <thead>
                    <tr>
                        <th width="10%">الرقم</th>
                        <th width="55%">اللقب والاسم</th>
                        <th width="35%">المادة</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
            ${buildOfficialPrintFooter(center, today, { justifyContent: 'flex-end', includeJob: false })}
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
        </body>
        </html>
    `);
    printWindow.document.close();
}

printSupervisionList = async function () {
    if (blockTrialPrint()) return;
    await printTeacherRoomList(getDisplayedSupervisionTeachers(), 'قائمة الحراسة');
};

async function printReserveList() {
    if (blockTrialPrint()) return;
    const reserveTeachers = currentTeachers.filter((teacher) => teacher.isReserve);
    if (reserveTeachers.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا يوجد أساتذة احتياط في هذه الفترة' });
        return;
    }
    await printSimpleReserveTeacherList(reserveTeachers, 'قائمة الاحتياط');
}

async function printAttendanceList() {
    if (blockTrialPrint()) return;
    var dayId = document.getElementById('daySelect').value;
    var period = document.getElementById('periodSelect').value;

    if (!dayId || !period || currentTeachers.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار اليوم والفترة أولا' });
        return;
    }

    var day = days.find(function(d) { return d.id === parseInt(dayId); });
    if (!day) return;

    var periodLabel = 'الفترة الصباحية';
    if (period === 'midday') periodLabel = 'فترة المنتصف';
    if (period === 'evening') periodLabel = 'الفترة المسائية';

    var subjectsList = ((day[period] && day[period].subjects) || []).filter(function(subject) {
        return String(subject || '').trim() !== '';
    });
    var subjectsDisplay = subjectsList.join(' + ') || 'غير محدد';
    // Use shortenSubject for column headers
    var shortenSubject = function(subj) {
        if (!subj) return '-';
        return subj
            .replace('العلوم الفيزيائية والتكنولوجيا', 'ع فيزيائية')
            .replace('العلوم الطبيعية والحياة', 'علوم طبيعية')
            .replace('اللغة العربية', 'عربية')
            .replace('اللغة الفرنسية', 'فرنسية')
            .replace('اللغة الإنجليزية', 'إنجليزية')
            .replace('الرياضيات', 'رياضيات')
            .replace('التاريخ والجغرافيا', 'تاريخ')
            .replace('التربية الإسلامية', 'إسلامية')
            .replace('التربية المدنية', 'مدنية')
            .replace('التربية البدنية والرياضية', 'رياضة')
            .replace('التربية التشكيلية', 'تشكيلية')
            .replace('التربية الموسيقية', 'موسيقى')
            .replace('الإعلام الآلي', 'إعلام آلي');
    };

    // If no subjects defined, use a single generic signature column
    if (subjectsList.length === 0) subjectsList = ['الإمضاء'];

    var dateStr = new Date(day.date).toLocaleDateString('ar-DZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    var settings = await getOfficialCenterData();
    var today = new Date().toLocaleDateString('ar-DZ');

    // Group teachers by room (non-reserve), then reserves at the end
    var roomGroups = {};
    var reserveTeachers = [];

    currentTeachers.forEach(function(t) {
        if (t.isReserve) {
            reserveTeachers.push(t);
        } else {
            var roomId = t.room || 0;
            var label = getLocationLabel(roomId);
            if (!roomGroups[roomId]) {
                roomGroups[roomId] = { label: label, teachers: [] };
            }
            roomGroups[roomId].teachers.push(t);
        }
    });

    // Sort rooms by ID, sort teachers within each room alphabetically
    var sortedRoomIds = Object.keys(roomGroups).sort(function(a, b) { return parseInt(a) - parseInt(b); });
    sortedRoomIds.forEach(function(rid) {
        roomGroups[rid].teachers.sort(function(a, b) { return a.surname.localeCompare(b.surname, 'ar'); });
    });
    reserveTeachers.sort(function(a, b) { return a.surname.localeCompare(b.surname, 'ar'); });

    // Calculate room column width based on longest room label
    var allLabels = sortedRoomIds.map(function(rid) { return roomGroups[rid].label; });
    if (reserveTeachers.length > 0) allLabels.push('احتياط');
    var maxLabelLen = 0;
    allLabels.forEach(function(l) { if (l.length > maxLabelLen) maxLabelLen = l.length; });
    var roomColWidth = Math.max(6, Math.min(Math.ceil(maxLabelLen * 1.8), 20));

    // Calculate dynamic column widths
    var numSubjects = subjectsList.length;
    var sigTotalWidth = numSubjects <= 2 ? 28 : Math.min(numSubjects * 12, 46);
    var sigColWidth = Math.floor(sigTotalWidth / numSubjects);
    var nameColWidth = (100 - roomColWidth - 6 - sigTotalWidth - 18); // remaining after room, #(6), sigs, notes(18)

    // Build signature header columns
    var sigHeaderHtml = '';
    subjectsList.forEach(function(subj) {
        var label = (subj === 'الإمضاء') ? 'الإمضاء' : shortenSubject(subj);
        sigHeaderHtml += '<th width="' + sigColWidth + '%">' + label + '</th>';
    });

    // Empty signature cells for each row
    var emptySigCells = '';
    for (var s = 0; s < numSubjects; s++) {
        emptySigCells += '<td></td>';
    }

    // Build table rows
    var rowsHtml = '';
    var globalIdx = 1;

    sortedRoomIds.forEach(function(rid) {
        var group = roomGroups[rid];
        var teacherCount = group.teachers.length;
        group.teachers.forEach(function(t, i) {
            rowsHtml += '<tr>';
            if (i === 0) {
                rowsHtml += '<td rowspan="' + teacherCount + '" style="font-weight:bold; background-color:#f5f5f5; vertical-align:middle; font-size:11pt;">' + group.label + '</td>';
            }
            rowsHtml += '<td>' + globalIdx + '</td>';
            rowsHtml += '<td style="text-align: right; padding-right: 10px;">' + t.surname + ' ' + t.name + '</td>';
            rowsHtml += emptySigCells;
            rowsHtml += '<td>' + (t.note || '') + '</td>';
            rowsHtml += '</tr>';
            globalIdx++;
        });
    });

    // Add reserve teachers if any
    if (reserveTeachers.length > 0) {
        reserveTeachers.forEach(function(t, i) {
            rowsHtml += '<tr style="background-color: var(--card-bg)9e6;">';
            if (i === 0) {
                rowsHtml += '<td rowspan="' + reserveTeachers.length + '" style="font-weight:bold; background-color: var(--card-bg)3cd; vertical-align:middle; font-size:11pt;">احتياط</td>';
            }
            rowsHtml += '<td>' + globalIdx + '</td>';
            rowsHtml += '<td style="text-align: right; padding-right: 10px;">' + t.surname + ' ' + t.name + '</td>';
            rowsHtml += emptySigCells;
            rowsHtml += '<td>' + (t.note || '') + '</td>';
            rowsHtml += '</tr>';
            globalIdx++;
        });
    }

    var printWindow = window.open('', '_blank');
    printWindow.document.write('\
        <!DOCTYPE html>\
        <html lang="ar" dir="rtl">\
        <head>\
            <meta charset="UTF-8">\
            <title>قائمة إمضاء حضور الأساتذة</title>\
            <style>\
                * { box-sizing: border-box; }\
                body { \
                    font-family: "Cairo", "Tajawal", sans-serif; \
                    margin: 0; \
                    padding: 0.5cm;\
                }\
                .header-container { width: 100%; margin-bottom: 8px; }\
                .center-text { text-align: center; }\
                h1, h2, h3 { margin: 0; color: #000; padding: 0; line-height: 1.2; }\
                h2 { font-size: 14pt; margin-bottom: 2px; }\
                h3 { font-size: 11pt; margin-bottom: 2px; }\
                .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; padding: 2px 0; }\
                .header-box { width: 33%; }\
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }\
                th, td { border: 0.5pt solid #000; padding: 5px 6px; text-align: center; font-size: 10pt; line-height: 1.3; }\
                th { background-color: #e0e0e0; font-weight: bold; }\
                .footer { margin-top: 25px; display: flex; justify-content: flex-end; font-size: 10pt; }\
                @media print {\
                    @page { margin: 0.8cm; size: A4; }\
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\
                }\
            </style>\
        \n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : '') + '\n        </head>\
        <body>\n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : '') + '\
            <div class="header-container">\
                <div class="center-text" style="margin-bottom: 2px;">\
                    <h3 style="line-height:1;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>\
                    <h3 style="line-height:1;">وزارة التربية الوطنية</h3>\
                </div>\
                <div class="header-row" style="margin-bottom: 2px;">\
                    <div class="header-box" style="text-align: right;">\
                        <h3 style="line-height:1;">المركز: ' + (settings.center_name || settings.institution || '.......') + '</h3>\
                    </div>\
                    <div class="header-box" style="text-align: left;">\
                        <h3 style="line-height:1;">ولاية ' + (settings.province || '.......') + '</h3>\
                    </div>\
                </div>\
                <div class="center-text" style="margin-bottom: 5px;">\
                    <h2 style="text-decoration: underline; margin: 0; line-height:1.2;">قائمة إمضاء حضور الأساتذة</h2>\
                </div>\
                <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 3px 0; background-color: #f9f9f9; align-items: center;">\
                    <div class="header-box" style="text-align: right; width: 40%;">\
                        <h3 style="margin:0; line-height:1;">' + dateStr + '</h3>\
                    </div>\
                    <div class="header-box center-text" style="width: 20%;">\
                        <h3 style="margin:0; font-size: 10pt; line-height:1;">' + periodLabel + '</h3>\
                    </div>\
                    <div class="header-box" style="text-align: left; width: 40%;">\
                        <h3 style="margin:0; line-height:1;">المواد: ' + subjectsDisplay + '</h3>\
                    </div>\
                </div>\
            </div>\
            <table>\
                <thead>\
                    <tr>\
                        <th width="' + roomColWidth + '%">القاعة</th>\
                        <th width="6%">#</th>\
                        <th width="' + nameColWidth + '%">اللقب والاسم</th>\
                        ' + sigHeaderHtml + '\
                        <th width="18%">ملاحظات</th>\
                    </tr>\
                </thead>\
                <tbody>\
                    ' + rowsHtml + '\
                </tbody>\
            </table>\
            <div class="footer">\
                <div style="text-align: center;">\
                    <div style="margin-bottom: 5px;">حرر بـ: ' + (settings.municipality || settings.province || '.......') + ' في: ' + today + '</div>\
                    <div>المدير</div>\
                </div>\
            </div>\
            <script>\
                window.onload = function() {\
                    // auto-print removed\
                };\
            </script>\
        \n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : '') + '\n        </body>\
        </html>\
    ');
    printWindow.document.close();
}

/**
 * Update the main schedule with current list assignments
 */
printAttendanceList = async function () {
    if (blockTrialPrint()) return;
    const state = getCurrentSelectionState();
    if (!state.dayId || !state.period || !state.day || currentTeachers.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار اليوم والفترة أولاً' });
        return;
    }

    const center = await getOfficialCenterData();
    const today = new Date().toLocaleDateString('ar-DZ');
    let subjectsList = ((state.day[state.period] && state.day[state.period].subjects) || []).filter(function (subject) {
        return String(subject || '').trim() !== '';
    });
    const subjectsDisplay = subjectsList.join(' + ') || 'غير محدد';
    if (subjectsList.length === 0) subjectsList = ['الإمضاء'];

    const roomGroups = {};
    const reserveTeachers = [];
    currentTeachers.forEach(function (teacher) {
        if (teacher.isReserve) {
            reserveTeachers.push(teacher);
            return;
        }
        const roomId = teacher.room || 0;
        const label = getLocationLabel(roomId);
        if (!roomGroups[roomId]) roomGroups[roomId] = { label: label, teachers: [] };
        roomGroups[roomId].teachers.push(teacher);
    });

    const sortedRoomIds = Object.keys(roomGroups).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
    sortedRoomIds.forEach(function (rid) {
        roomGroups[rid].teachers.sort(function (a, b) { return a.surname.localeCompare(b.surname, 'ar'); });
    });
    reserveTeachers.sort(function (a, b) { return a.surname.localeCompare(b.surname, 'ar'); });

    const allLabels = sortedRoomIds.map(function (rid) { return roomGroups[rid].label; });
    if (reserveTeachers.length > 0) allLabels.push('احتياط');
    let maxLabelLen = 0;
    allLabels.forEach(function (label) { if (label.length > maxLabelLen) maxLabelLen = label.length; });
    const roomColWidth = Math.max(6, Math.min(Math.ceil(maxLabelLen * 1.8), 20));
    const numSubjects = subjectsList.length;
    const sigTotalWidth = numSubjects <= 2 ? 28 : Math.min(numSubjects * 12, 46);
    const sigColWidth = Math.floor(sigTotalWidth / numSubjects);
    const nameColWidth = 100 - roomColWidth - 6 - sigTotalWidth - 18;

    let sigHeaderHtml = '';
    subjectsList.forEach(function (subject) {
        const label = subject === 'الإمضاء' ? 'الإمضاء' : shortenSubjectLabel(subject);
        sigHeaderHtml += '<th width="' + sigColWidth + '%">' + escapeHtml(label) + '</th>';
    });

    let emptySigCells = '';
    for (let index = 0; index < numSubjects; index++) {
        emptySigCells += '<td></td>';
    }

    let rowsHtml = '';
    let globalIdx = 1;
    sortedRoomIds.forEach(function (rid) {
        const group = roomGroups[rid];
        group.teachers.forEach(function (teacher, index) {
            rowsHtml += '<tr>';
            if (index === 0) {
                rowsHtml += '<td rowspan="' + group.teachers.length + '" style="font-weight:bold; background-color:#f5f5f5; vertical-align:middle; font-size:11pt;">' + escapeHtml(group.label) + '</td>';
            }
            rowsHtml += '<td>' + globalIdx + '</td>';
            rowsHtml += '<td style="text-align: right; padding-right: 10px;">' + escapeHtml((teacher.surname || '') + ' ' + (teacher.name || '')) + '</td>';
            rowsHtml += emptySigCells;
            rowsHtml += '<td>' + escapeHtml(teacher.note || '') + '</td>';
            rowsHtml += '</tr>';
            globalIdx++;
        });
    });

    if (reserveTeachers.length > 0) {
        reserveTeachers.forEach(function (teacher, index) {
            rowsHtml += '<tr style="background-color:#fff7ed;">';
            if (index === 0) {
                rowsHtml += '<td rowspan="' + reserveTeachers.length + '" style="font-weight:bold; background-color:#ffedd5; color:#c2410c; vertical-align:middle; font-size:11pt;">احتياط</td>';
            }
            rowsHtml += '<td>' + globalIdx + '</td>';
            rowsHtml += '<td style="text-align: right; padding-right: 10px;">' + escapeHtml((teacher.surname || '') + ' ' + (teacher.name || '')) + '</td>';
            rowsHtml += emptySigCells;
            rowsHtml += '<td>' + escapeHtml(teacher.note || '') + '</td>';
            rowsHtml += '</tr>';
            globalIdx++;
        });
    }

    const dateStr = new Date(state.day.date).toLocaleDateString('ar-DZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>قائمة إمضاء حضور الأساتذة</title>
            <style>
                * { box-sizing: border-box; }
                body { font-family: "Cairo", "Tajawal", sans-serif; margin: 0; padding: 0.5cm; }
                .header-container { width: 100%; margin-bottom: 8px; }
                .center-text { text-align: center; }
                h1, h2, h3 { margin: 0; color: #000; padding: 0; line-height: 1.2; }
                h2 { font-size: 14pt; margin-bottom: 2px; }
                h3 { font-size: 11pt; margin-bottom: 2px; }
                .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; padding: 2px 0; }
                .header-box { width: 33%; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th, td { border: 0.5pt solid #000; padding: 5px 6px; text-align: center; font-size: 10pt; line-height: 1.3; }
                th { background-color: #e0e0e0; font-weight: bold; }
                .footer { margin-top: 25px; display: flex; justify-content: flex-end; font-size: 10pt; }
                @media print {
                    @page { margin: 0.8cm; size: A4; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}
            ${buildOfficialPrintHeader(center, {
                title: 'قائمة إمضاء حضور الأساتذة',
                dateLabel: dateStr,
                periodLabel: getPeriodLabel(state.period),
                subjects: subjectsDisplay,
                exam: getOfficialExamDisplayName(currentTrimester, center.exam),
                session: center.session
            })}
            <table>
                <thead>
                    <tr>
                        <th width="${roomColWidth}%">القاعة</th>
                        <th width="6%">#</th>
                        <th width="${nameColWidth}%">اللقب والاسم</th>
                        ${sigHeaderHtml}
                        <th width="18%">ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
            ${buildOfficialPrintFooter(center, today, { justifyContent: 'flex-end', includeJob: false })}
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
        </body>
        </html>
    `);
    printWindow.document.close();
};

async function updateScheduleFromList() {
    const dayId = document.getElementById('daySelect').value;
    const period = document.getElementById('periodSelect').value;

    if (!dayId) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'الرجاء اختيار اليوم والفترة' });
        return;
    }

    // Get IDs of teachers currently assigned to a room (room > 0)
    // Note: All teachers in currentTeachers are considered "on the list"
    // But we might want to filter only those with a valid room assignment if needed.
    // For now, if they are in the list, they are assigned to this slot.
    const unassignedGuards = currentTeachers.filter((teacher) => !teacher.isReserve && !teacher.room);
    if (unassignedGuards.length > 0) {
        Swal.fire({
            icon: 'warning',
            title: 'حراس بدون قاعة',
            text: `يوجد ${unassignedGuards.length} حارس دون قاعة. أكمل التوزيع أو التعيين اليدوي قبل مزامنة القائمة مع صفحة الحراسة.`,
        });
        return;
    }

    const assignedTeacherIds = currentTeachers.filter(t => !t.isReserve && t.room > 0).map(t => t.id);
    const reserveTeacherIds = currentTeachers.filter(t => t.isReserve).map(t => t.id);

    if (assignedTeacherIds.length === 0) {
        const result = await Swal.fire({
            title: 'هل أنت متأكد؟',
            text: "القائمة فارغة. هل تريد مسح الحراسة لهذا اليوم والفترة؟",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'نعم، مسح',
            cancelButtonText: 'إلغاء'
        });
        if (!result.isConfirmed) {
            return;
        }
    }

    try {
        // Load current schedule (per-trimester)
        const triKeys = getTrimesterKeys(currentTrimester);
        const currentSchedule = await readStoredValue(triKeys.SCHEDULE, { includeLocalStorage: true, parseJson: true }) || {};
        const currentReserveSchedule = await readStoredValue(triKeys.RESERVE_SCHEDULE, { includeLocalStorage: true, parseJson: true }) || {};

        // Update specific slot
        const slotKey = `${dayId}_${period}`;
        currentSchedule[slotKey] = assignedTeacherIds;
        currentReserveSchedule[slotKey] = reserveTeacherIds;
        const normalizedAssignments = normalizeAssignmentStores(currentSchedule, currentReserveSchedule);
        await persistStoredJson(triKeys.SCHEDULE, normalizedAssignments.schedule);
        await persistStoredJson(triKeys.RESERVE_SCHEDULE, normalizedAssignments.reserveSchedule);

        Swal.fire({ icon: 'success', title: 'تم', text: 'تم حفظ القائمة بنجاح', timer: 1500, showConfirmButton: false });

    } catch (error) {
        console.error('Error saving assignments:', error);
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء الحفظ' });
    }
}

/**
 * Print Supervision List in a separate window
 */

// Expose to window
window.updateScheduleFromList = updateScheduleFromList;

// ==========================================
// NEW ROOM MANAGEMENT MODAL LOGIC
// ==========================================

window.savePeriodRooms = async function() {
    const sanitized = sanitizePeriodRoomsStore(normalizePeriodRoomsStore(periodRooms));
    periodRooms = sanitized.store;
    await remapStoredRoomAssignments(sanitized.roomIdRemaps);
    await persistStoredJson(STORAGE_KEYS.PERIOD_ROOMS, periodRooms);
};

window.openRoomSettingsModal = function() {
    const currentPeriod = document.getElementById('periodSelect').value || 'morning';
    const modalSelect = document.getElementById('modalPeriodSelect');
    const modalTrimesterSelect = document.getElementById('modalTrimesterSelect');
    if (modalTrimesterSelect) modalTrimesterSelect.value = currentTrimester;
    if (modalSelect) modalSelect.value = currentPeriod;
    renderRoomSettingsList();
    const modal = new bootstrap.Modal(document.getElementById('roomSettingsModal'));
    modal.show();
};

window.renderRoomSettingsList = function() {
    const trimester = document.getElementById('modalTrimesterSelect')?.value || currentTrimester;
    const p = document.getElementById('modalPeriodSelect').value;
    const listDiv = document.getElementById('roomSettingsList');
    const rooms = getRoomsForTrimester(trimester)[p] || [];

    if (rooms.length === 0) {
        listDiv.innerHTML = '<div class="text-center text-muted py-3">لا توجد قاعات مضافة لهذه الفترة.</div>';
        return;
    }

    listDiv.innerHTML = rooms.map((r, index) => `
        <div class="d-flex justify-content-between align-items-center mb-2 p-2" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px;">
            <span style="font-weight: bold; font-size: 0.95rem;">${r.label}</span>
            <div>
                <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="editRoomName('${trimester}', '${p}', ${index})" title="تعديل"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteRoom('${trimester}', '${p}', ${index})" title="حذف"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
};

window.autoGenerateRooms = async function() {
    const from = parseInt(document.getElementById('genRoomFrom').value);
    const to = parseInt(document.getElementById('genRoomTo').value);
    if (isNaN(from) || isNaN(to) || from > to) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'أرقام غير صالحة.' });
        return;
    }

    const trimester = document.getElementById('modalTrimesterSelect')?.value || currentTrimester;
    const p = document.getElementById('modalPeriodSelect').value;
    const trimesterRooms = getRoomsForTrimester(trimester);
    let rooms = trimesterRooms[p] || [];
    const existingLabels = new Set(rooms.map((room) => roomLabelKey(room.label)));

    const baseId = Date.now() * 1000; // Multiply to create wide spacing between IDs
    for (let i = from; i <= to; i++) {
        const paddedNum = i.toString().padStart(2, '0');
        const label = `قاعة ${paddedNum}`;
        const labelKey = roomLabelKey(label);
        if (existingLabels.has(labelKey)) {
            continue;
        }
        const id = baseId + i; // Guaranteed unique sequential IDs
        rooms.push({ id: id, label });
        existingLabels.add(labelKey);
    }

    trimesterRooms[p] = rooms;
    await savePeriodRooms();
    renderRoomSettingsList();
    
    if (currentTrimester === trimester && document.getElementById('periodSelect').value === p) {
        updateRoomSelects();
    }
};

window.addManualRoom = async function() {
    const name = document.getElementById('manualRoomName').value.trim();
    if (!name) return;

    const trimester = document.getElementById('modalTrimesterSelect')?.value || currentTrimester;
    const p = document.getElementById('modalPeriodSelect').value;
    const trimesterRooms = getRoomsForTrimester(trimester);
    let rooms = trimesterRooms[p] || [];
    const normalizedName = normalizeRoomLabel(name);

    if (rooms.some((room) => roomLabelKey(room.label) === roomLabelKey(normalizedName))) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'هذه القاعة موجودة بالفعل في نفس الفصل والفترة.' });
        return;
    }
    rooms.push({ id: Date.now() * 1000 + rooms.length + 1, label: normalizedName });

    trimesterRooms[p] = rooms;
    document.getElementById('manualRoomName').value = '';
    await savePeriodRooms();
    renderRoomSettingsList();
    
    if (currentTrimester === trimester && document.getElementById('periodSelect').value === p) {
        updateRoomSelects();
    }
};

window.deleteRoom = async function(trimester, period, index) {
    const trimesterRooms = getRoomsForTrimester(trimester);
    if (trimesterRooms[period]) {
        trimesterRooms[period].splice(index, 1);
        await savePeriodRooms();
        renderRoomSettingsList();
        
        if (currentTrimester === trimester && document.getElementById('periodSelect').value === period) {
            updateRoomSelects();
        }
    }
};

window.editRoomName = async function(trimester, period, index) {
    const trimesterRooms = getRoomsForTrimester(trimester);
    const current = trimesterRooms[period][index].label;
    
    // Native prompt avoids Bootstrap Modal focus trap that prevents typing
    const newName = prompt('تعديل اسم القاعة:', current);

    if (newName !== null && newName.trim() !== '') {
        const trimmedName = normalizeRoomLabel(newName);
        const duplicateExists = trimesterRooms[period].some((room, roomIndex) => roomIndex !== index && roomLabelKey(room.label) === roomLabelKey(trimmedName));
        if (duplicateExists) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يوجد اسم قاعة مطابق بالفعل في هذه الفترة.' });
            return;
        }

        trimesterRooms[period][index].label = trimmedName;
        await savePeriodRooms();
        renderRoomSettingsList();
        
        if (currentTrimester === trimester && document.getElementById('periodSelect').value === period) {
            updateRoomSelects();
            renderTeachersTable(); // fully re-render if visible
        }
    }
};

window.clearCurrentPeriodRooms = async function() {
    const trimester = document.getElementById('modalTrimesterSelect')?.value || currentTrimester;
    const p = document.getElementById('modalPeriodSelect').value;
    const trimesterRooms = getRoomsForTrimester(trimester);
    if (trimesterRooms[p] && trimesterRooms[p].length > 0) {
        const res = await Swal.fire({
            title: 'تأكيد الإفراغ',
            text: 'هل أنت متأكد من مسح جميع قاعات هذه الفترة؟',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'نعم، امسح مسحاً عشوائياً', // text doesn't matter much
            cancelButtonText: 'إلغاء'
        });
        if (res.isConfirmed) {
            trimesterRooms[p] = [];
            await savePeriodRooms();
            renderRoomSettingsList();
            
            if (currentTrimester === trimester && document.getElementById('periodSelect').value === p) {
                updateRoomSelects();
            }
        }
    }
};
