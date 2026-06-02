/**

 * Supervision Schedule Management (React Version)

 * Replaces supervision.js

 * Uses React.createElement for no-build offline support

 */

const e = React.createElement;

const { useState, useEffect, useMemo, useCallback } = React;

// ======================

// CONSTANTS & HELPERS

// ======================

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
    PRINT_ORIENTATION: 'supervisionPrintOrientation'
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
    NAMESPACE_MIGRATION_DONE: 'officialSupervisionNamespaceMigrationDone',
    MIGRATION_DONE: 'officialSupervisionMigrationDone',
    ABSENCE_MIGRATION_DONE: 'officialSupervisionAbsenceNamespaceMigrationDone',
    EXEMPTIONS_MIGRATION_DONE: 'officialSupervisionExemptionsMigrationDone'
};

// Helper: get trimester-specific storage keys
const getTrimesterKeys = (tri) => ({
    DAYS: `officialSupervisionDays_T${tri}`,
    SCHEDULE: `officialSupervisionSchedule_T${tri}`,
    RESERVE_SCHEDULE: `officialSupervisionReserveSchedule_T${tri}`,
    ABSENCE_SCHEDULE: `officialSupervisionAbsenceSchedule_T${tri}`,
    ROOM_ASSIGNMENTS: `officialSupervisionRoomAssignments_T${tri}`,
    EXEMPTIONS: `officialSupervisionExemptions_T${tri}`,
    ABSENCES: `officialSupervisionAbsences_T${tri}`
});

const getLegacyTrimesterKeys = (tri) => ({
    DAYS: `supervisionDays_T${tri}`,
    SCHEDULE: `supervisionSchedule_T${tri}`,
    RESERVE_SCHEDULE: `supervisionReserveSchedule_T${tri}`,
    ABSENCE_SCHEDULE: `supervisionAbsenceSchedule_T${tri}`,
    ROOM_ASSIGNMENTS: `supervisionRoomAssignments_T${tri}`,
    EXEMPTIONS: `supervisionExemptions_T${tri}`,
    ABSENCES: `supervisionAbsences_T${tri}`
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

const hashStableString = (value) => {
    const input = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const OFFICIAL_CENTER_DEFAULTS = {
    ministry: 'وزارة التربية الوطنية',
    office: 'الديوان الوطني للامتحانات و المسابقات',
    branch: '',
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

const getOfficialExamDisplayName = (trimester, storedExam) => {
    const normalizedTrimester = String(trimester || '').trim();
    const examName = String(storedExam || '').trim();
    if (normalizedTrimester === 'blanc') return 'شهادة التعليم المتوسط';
    if (normalizedTrimester === 'blanc_lycee') return 'شهادة البكالوريا';
    if (normalizedTrimester === 'custom') return examName || 'امتحان آخر';
    return examName || '........';
};

const getOfficialCenterDisplay = (center, trimester = 'custom') => {
    const merged = Object.assign({}, OFFICIAL_CENTER_DEFAULTS, center || {});
    return Object.assign({}, merged, {
        displayCenter: merged.center_name || merged.institution || '........',
        displayProvince: merged.province || '........',
        displayMunicipality: merged.municipality || merged.province || '........',
        displayExam: getOfficialExamDisplayName(trimester, merged.exam),
        displaySession: merged.session || '........',
        displayPresident: merged.president || '........',
        displayJob: merged.job || 'رئيس المركز'
    });
};

const getOfficialReportExamLabel = (trimester, displayExam, customStage = 'middle') => {
    const normalizedTrimester = String(trimester || '').trim();
    if (normalizedTrimester === 'custom') {
        return String(displayExam || '').trim() || 'ط§ظ…طھط­ط§ظ† ط¢ط®ط±';
    }
    return getSupervisionTrimesterLabel(normalizedTrimester, customStage);
};

const getOfficialCenterData = async (trimester) => {
    try {
        const effectiveTrimester = String(
            trimester
            || await DB.get(STORAGE_KEYS.TRIMESTER)
            || localStorage.getItem(STORAGE_KEYS.TRIMESTER)
            || 'custom'
        ).trim() || 'custom';
        const center = await DB.getOfficialCenter();
        return getOfficialCenterDisplay(center || {}, effectiveTrimester);
    } catch (error) {
        console.error('Official center data load failed:', error);
        return getOfficialCenterDisplay({}, String(trimester || 'custom').trim() || 'custom');
    }
};

const normalizeTeacherId = (id) => String(id);

const normalizeAssignmentList = (items, excludedIds = []) => {
    const excluded = new Set((excludedIds || []).map(normalizeTeacherId));
    const seen = new Set();
    return (Array.isArray(items) ? items : [])
        .map((teacherId) => normalizeTeacherId(teacherId))
        .filter((teacherId) => {
            if (!teacherId || excluded.has(teacherId) || seen.has(teacherId)) return false;
            seen.add(teacherId);
            return true;
        });
};

const normalizeAssignmentStores = (scheduleData, reserveScheduleData, absenceScheduleData) => {
    const normalizedSchedule = {};
    const normalizedReserveSchedule = {};
    const normalizedAbsenceSchedule = {};
    const allKeys = new Set([
        ...Object.keys(scheduleData || {}),
        ...Object.keys(reserveScheduleData || {}),
        ...Object.keys(absenceScheduleData || {})
    ]);

    allKeys.forEach((key) => {
        const scheduleIds = normalizeAssignmentList(scheduleData && scheduleData[key]);
        const reserveIds = normalizeAssignmentList(reserveScheduleData && reserveScheduleData[key], scheduleIds);
        const absenceIds = normalizeAssignmentList(absenceScheduleData && absenceScheduleData[key], scheduleIds.concat(reserveIds));

        normalizedSchedule[key] = scheduleIds;
        normalizedReserveSchedule[key] = reserveIds;
        normalizedAbsenceSchedule[key] = absenceIds;
    });

    return {
        schedule: normalizedSchedule,
        reserveSchedule: normalizedReserveSchedule,
        absenceSchedule: normalizedAbsenceSchedule
    };
};

const normalizeRoomAssignmentsAgainstAssignments = (roomAssignmentsData, scheduleData, reserveScheduleData, absenceScheduleData) => {
    const normalizedRooms = {};

    Object.keys(roomAssignmentsData || {}).forEach((key) => {
        const roomMap = roomAssignmentsData && roomAssignmentsData[key];
        if (!roomMap || typeof roomMap !== 'object') return;

        const guardIds = normalizeAssignmentList(scheduleData && scheduleData[key]);
        const reserveIds = normalizeAssignmentList(reserveScheduleData && reserveScheduleData[key], guardIds);
        const absenceIds = normalizeAssignmentList(absenceScheduleData && absenceScheduleData[key], guardIds.concat(reserveIds));
        const guardSet = new Set(guardIds);
        const reserveSet = new Set(reserveIds);
        const absenceSet = new Set(absenceIds);
        const nextRoomMap = {};

        Object.keys(roomMap).forEach((rawTeacherId) => {
            const teacherId = normalizeTeacherId(rawTeacherId);
            const roomEntry = roomMap[rawTeacherId];
            if (absenceSet.has(teacherId)) return;

            if (guardSet.has(teacherId)) {
                if (roomEntry && typeof roomEntry === 'object' && roomEntry.room) {
                    nextRoomMap[teacherId] = { ...roomEntry, isReserve: false };
                }
                return;
            }

            if (reserveSet.has(teacherId)) {
                nextRoomMap[teacherId] = { isReserve: true };
            }
        });

        if (Object.keys(nextRoomMap).length > 0) {
            normalizedRooms[key] = nextRoomMap;
        }
    });

    return normalizedRooms;
};

const getEffectiveRoomAssignmentData = (roomAssignmentsData, key, teacherId, isGuardAssigned = false, isReserveAssigned = false) => {
    const normalizedTeacherId = normalizeTeacherId(teacherId);
    const teacherRoomMap = roomAssignmentsData && roomAssignmentsData[key];
    const roomEntry = teacherRoomMap && (teacherRoomMap[normalizedTeacherId] ?? teacherRoomMap[teacherId]);

    if (isGuardAssigned) {
        return roomEntry && typeof roomEntry === 'object' && roomEntry.room
            ? { ...roomEntry, isReserve: false }
            : null;
    }

    if (isReserveAssigned) {
        return { isReserve: true };
    }

    return null;
};

const applyTrimesterTeacherStatuses = (teacherList, exemptTeacherIds) => {
    const exemptSet = new Set((exemptTeacherIds || []).map(normalizeTeacherId));
    return (teacherList || []).map((teacher) => ({
        ...teacher,
        isExempt: exemptSet.has(normalizeTeacherId(teacher.id))
    }));
};

const sortTeachersForScheduleOrder = (teacherList) => {
    return [...(teacherList || [])].sort((a, b) => {
        const subjectA = (a.subjects && a.subjects[0]) ? a.subjects[0] : 'zzzz';
        const subjectB = (b.subjects && b.subjects[0]) ? b.subjects[0] : 'zzzz';
        const subjectDiff = subjectA.localeCompare(subjectB, 'ar');
        if (subjectDiff !== 0) return subjectDiff;

        const surnameDiff = String(a.surname || '').localeCompare(String(b.surname || ''), 'ar');
        if (surnameDiff !== 0) return surnameDiff;

        const nameDiff = String(a.name || '').localeCompare(String(b.name || ''), 'ar');
        if (nameDiff !== 0) return nameDiff;

        return String(a.id || '').localeCompare(String(b.id || ''), 'ar');
    });
};

const collectLegacyTeacherIdsFromSchedule = (scheduleData, reserveScheduleData) => {
    const ids = new Set();
    const visitSchedule = (source) => {
        Object.values(source || {}).forEach((assignedTeachers) => {
            if (!Array.isArray(assignedTeachers)) return;
            assignedTeachers.forEach((teacherId) => {
                if (teacherId != null && teacherId !== '') {
                    ids.add(normalizeTeacherId(teacherId));
                }
            });
        });
    };

    visitSchedule(scheduleData);
    visitSchedule(reserveScheduleData);
    return ids;
};

const collectLegacyTeacherIdsFromRooms = (roomAssignmentsData) => {
    const ids = new Set();
    Object.values(roomAssignmentsData || {}).forEach((teacherMap) => {
        if (!teacherMap || typeof teacherMap !== 'object') return;
        Object.keys(teacherMap).forEach((teacherId) => {
            if (teacherId != null && teacherId !== '') {
                ids.add(normalizeTeacherId(teacherId));
            }
        });
    });
    return ids;
};

const createLegacyTeacherPlaceholder = (teacherId) => ({
    id: normalizeTeacherId(teacherId),
    surname: 'تعيين سابق',
    name: `#${String(teacherId || '').slice(-5)}`,
    subjects: [],
    isLegacyPlaceholder: true
});

const looksLikeLegacyTeacherRecord = (teacher) => {
    if (!teacher || typeof teacher !== 'object') return false;
    if (teacher.isLegacyPlaceholder) return true;

    const surname = String(teacher.surname != null ? teacher.surname : teacher.last_name != null ? teacher.last_name : '').trim();
    const name = String(teacher.name != null ? teacher.name : teacher.first_name != null ? teacher.first_name : '').trim();
    const hasSubjects = Array.isArray(teacher.subjects)
        ? teacher.subjects.some((subject) => String(subject || '').trim() !== '')
        : String(teacher.subject || '').trim() !== '';
    const institution = String(teacher.institution || '').trim();
    const rank = String(teacher.rank || '').trim();

    return surname === 'تعيين سابق'
        && /^#?[\d_]+$/.test(name)
        && !hasSubjects
        && !institution
        && !rank;
};

const sanitizeTrimesterData = (teacherList, triData) => {
    const validTeacherIds = new Set((teacherList || []).map((teacher) => normalizeTeacherId(teacher.id)));
    const sanitized = Object.assign({
        days: [],
        schedule: {},
        reserveSchedule: {},
        absenceSchedule: {},
        roomAssignments: {},
        exemptTeacherIds: [],
        absentTeacherIds: []
    }, triData || {});
    let changed = false;

    const sanitizeAssignmentMap = (source) => {
        const result = {};
        Object.keys(source || {}).forEach((key) => {
            const original = Array.isArray(source[key]) ? source[key] : [];
            const filtered = normalizeAssignmentList(
                original.filter((teacherId) => validTeacherIds.has(normalizeTeacherId(teacherId)))
            );
            if (filtered.length !== original.length) changed = true;
            result[key] = filtered;
        });
        return result;
    };

    const sanitizeRoomAssignments = (source) => {
        const result = {};
        Object.keys(source || {}).forEach((key) => {
            const teacherMap = source[key];
            if (!teacherMap || typeof teacherMap !== 'object') {
                result[key] = teacherMap;
                return;
            }

            const filteredMap = {};
            Object.keys(teacherMap).forEach((teacherId) => {
                if (validTeacherIds.has(normalizeTeacherId(teacherId))) {
                    filteredMap[teacherId] = teacherMap[teacherId];
                } else {
                    changed = true;
                }
            });
            result[key] = filteredMap;
        });
        return result;
    };

    const sanitizeIdList = (source) => {
        const original = Array.isArray(source) ? source : [];
        const filtered = original.filter((teacherId) => validTeacherIds.has(normalizeTeacherId(teacherId)));
        if (filtered.length !== original.length) changed = true;
        return filtered;
    };

    sanitized.schedule = sanitizeAssignmentMap(sanitized.schedule);
    sanitized.reserveSchedule = sanitizeAssignmentMap(sanitized.reserveSchedule);
    sanitized.absenceSchedule = sanitizeAssignmentMap(sanitized.absenceSchedule);
    const normalizedAssignments = normalizeAssignmentStores(
        sanitized.schedule,
        sanitized.reserveSchedule,
        sanitized.absenceSchedule
    );
    if (JSON.stringify(normalizedAssignments.schedule) !== JSON.stringify(sanitized.schedule)
        || JSON.stringify(normalizedAssignments.reserveSchedule) !== JSON.stringify(sanitized.reserveSchedule)
        || JSON.stringify(normalizedAssignments.absenceSchedule) !== JSON.stringify(sanitized.absenceSchedule)) {
        changed = true;
    }
    sanitized.schedule = normalizedAssignments.schedule;
    sanitized.reserveSchedule = normalizedAssignments.reserveSchedule;
    sanitized.absenceSchedule = normalizedAssignments.absenceSchedule;
    const filteredRoomAssignments = sanitizeRoomAssignments(sanitized.roomAssignments);
    const normalizedRoomAssignments = normalizeRoomAssignmentsAgainstAssignments(
        filteredRoomAssignments,
        sanitized.schedule,
        sanitized.reserveSchedule,
        sanitized.absenceSchedule
    );
    if (JSON.stringify(normalizedRoomAssignments) !== JSON.stringify(sanitized.roomAssignments)) changed = true;
    sanitized.roomAssignments = normalizedRoomAssignments;
    sanitized.exemptTeacherIds = sanitizeIdList(sanitized.exemptTeacherIds);
    const legacyAbsentTeacherIds = sanitizeIdList(sanitized.absentTeacherIds);
    if (legacyAbsentTeacherIds.length > 0) changed = true;
    sanitized.absentTeacherIds = [];

    return { data: sanitized, changed };
};

const buildTeacherDirectoryForTrimester = (baseTeacherList, triData) => {
    const normalizedBase = Array.isArray(baseTeacherList) ? baseTeacherList.map((teacher) => ({
        ...teacher,
        id: normalizeTeacherId(teacher.id)
    })) : [];

    const knownIds = new Set(normalizedBase.map((teacher) => normalizeTeacherId(teacher.id)));
    const legacyIds = new Set([
        ...collectLegacyTeacherIdsFromSchedule(triData && triData.schedule, triData && triData.reserveSchedule),
        ...collectLegacyTeacherIdsFromRooms(triData && triData.roomAssignments),
        ...((triData && triData.exemptTeacherIds) || []).map(normalizeTeacherId)
    ]);

    legacyIds.forEach((teacherId) => {
        if (!knownIds.has(teacherId)) {
            normalizedBase.push(createLegacyTeacherPlaceholder(teacherId));
            knownIds.add(teacherId);
        }
    });

    return normalizedBase;
};

const migrateLegacyNamespaceIfNeeded = async () => {
    const absenceMigrationDone = await readStoredValue(STORAGE_KEYS.ABSENCE_MIGRATION_DONE, { includeLocalStorage: true });
    if (!absenceMigrationDone) {
        for (const tri of OFFICIAL_TRIMESTERS) {
            const legacyKeys = getLegacyTrimesterKeys(tri);
            const officialKeys = getTrimesterKeys(tri);
            const absenceMappings = [
                [legacyKeys.ABSENCE_SCHEDULE, officialKeys.ABSENCE_SCHEDULE],
                [legacyKeys.ABSENCES, officialKeys.ABSENCES]
            ];

            for (const [legacyKey, officialKey] of absenceMappings) {
                const currentValue = await readStoredValue(officialKey, { includeLocalStorage: true, parseJson: true });
                if (hasStoredValue(currentValue)) continue;
                const legacyValue = await readStoredValue(legacyKey, { includeLocalStorage: true, parseJson: true });
                if (hasStoredValue(legacyValue)) {
                    await persistStoredJson(officialKey, legacyValue);
                }
            }
        }
        await persistStoredValue(STORAGE_KEYS.ABSENCE_MIGRATION_DONE, 'true');
    }

    const migrationDone = await readStoredValue(STORAGE_KEYS.NAMESPACE_MIGRATION_DONE, { includeLocalStorage: true });
    if (migrationDone) return;

    const officialAuxKeys = [
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.PERIOD_ROOMS,
        STORAGE_KEYS.PRINT_NOTES
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
            readStoredValue(keys.ABSENCE_SCHEDULE, { includeLocalStorage: true, parseJson: true }),
            readStoredValue(keys.ROOM_ASSIGNMENTS, { includeLocalStorage: true, parseJson: true }),
            readStoredValue(keys.EXEMPTIONS, { includeLocalStorage: true, parseJson: true }),
            readStoredValue(keys.ABSENCES, { includeLocalStorage: true, parseJson: true })
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
            [legacyKeys.ABSENCE_SCHEDULE, officialKeys.ABSENCE_SCHEDULE],
            [legacyKeys.ROOM_ASSIGNMENTS, officialKeys.ROOM_ASSIGNMENTS],
            [legacyKeys.EXEMPTIONS, officialKeys.EXEMPTIONS],
            [legacyKeys.ABSENCES, officialKeys.ABSENCES]
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
        [LEGACY_STORAGE_KEYS.PRINT_NOTES, STORAGE_KEYS.PRINT_NOTES]
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
        console.log('[Official Supervision] Migrated shared supervision data into official namespace');
    }
};

const hydrateGlobalRoomCache = (periodRoomsData) => {
    GlobalRoomCache = {};

    const visit = (value) => {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach((room) => {
                if (room && room.id && room.label) {
                    GlobalRoomCache[room.id] = room.label;
                }
            });
            return;
        }

        if (typeof value === 'object') {
            Object.keys(value).forEach((key) => visit(value[key]));
        }
    };

    visit(periodRoomsData);
};

// Local Print Toolbar Helper for guaranteed visibility on Windows 7 / IE11
const PrintToolbarHelper = {
    getHeadContent: function () {
        return '<style>' +
            '/* Toolbar Styles */' +
            '.print-toolbar {' +
            '    background: #f8fafc;' +
            '    padding: 15px 25px;' +
            '    border-bottom: 2px solid var(--border-color);' +
            '    display: flex;' +
            '    justify-content: space-between;' +
            '    align-items: center;' +
            '    position: sticky;' +
            '    top: 0;' +
            '    z-index: 1000;' +
            '    box-shadow: 0 4px 15px rgba(0,0,0,0.05);' +
            '    margin-bottom: 20px;' +
            '    direction: rtl;' +
            '    font-family: \'Cairo\', sans-serif;' +
            '}' +
            '.print-toolbar input {' +
            '    width: 70px;' +
            '    padding: 6px;' +
            '    text-align: center;' +
            '    border: 1px solid #cbd5e1;' +
            '    border-radius: 6px;' +
            '    font-family: inherit;' +
            '    font-size: 14px;' +
            '}' +
            '.print-toolbar button {' +
            '    padding: 10px 20px;' +
            '    border: none;' +
            '    border-radius: 8px;' +
            '    cursor: pointer;' +
            '    font-weight: bold;' +
            '    font-family: inherit;' +
            '    font-size: 15px;' +
            '    transition: all 0.2s;' +
            '}' +
            '.btn-print { background: #2563eb; color: white; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2); }' +
            '.btn-print:hover { background: #1d4ed8; transform: translateY(-2px); }' +
            '.btn-cancel { background: var(--border-color); color: #475569; margin-left: 10px; }' +
            '.btn-cancel:hover { background: #cbd5e1; }' +
            '.toolbar-right { display: flex; align-items: center; gap: 12px; font-weight: bold; color: #334155; }' +
            '.total-pages { color: #64748b; font-size: 0.9em; margin-right: 15px; }' +
            '.info-msg { color: #3b82f6; font-size: 0.95em; font-weight: bold; }' +
            '@media print, screen {' +
            '    body:not(.print-toolbar) {' +
            '        font-family: \'Cairo\', \'Tajawal\', sans-serif;' +
            '    }' +
            '}' +
            '@media print {' +
            '    .no-print { display: none !important; }' +
            '}' +
            '</style>';
    },
    getToolbarHtml: function (options) {
        if (!options) options = { advanced: false, totalPages: 1 };
        var rightSide = '';
        if (options.advanced) {
            rightSide = '<div class="toolbar-right">' +
                '    <span>عرض الصفحات من:</span>' +
                '    <input type="number" id="pageFrom" value="1" min="1" max="\' + options.totalPages + \'" onchange="updatePages()">' +
                '    <span>إلى:</span>' +
                '    <input type="number" id="pageTo" value="\' + options.totalPages + \'" min="1" max="\' + options.totalPages + \'" onchange="updatePages()">' +
                '    <span class="total-pages">(الإجمالي: \' + options.totalPages + \' صفحة)</span>' +
                '</div>';
        } else {
            rightSide = '<div class="toolbar-right"></div>';
        }

        return '<!-- Print Toolbar -->' +
            '<div class="print-toolbar no-print" dir="rtl">' +
            '    <div class="toolbar-left" style="display: flex; gap: 10px; align-items: center;">' +
            '        <button onclick="window.print()" class="btn-print">🖨️ طباعة التقرير</button>' +
            '        <button onclick="openInBrowser()" class="btn-browser" style="background: #0f172a; color: white; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; font-weight: bold; font-family: inherit; font-size: 15px; transition: all 0.2s;">🌐 الفتح في المتصفح</button>' +
            '        <button onclick="window.close()" class="btn-cancel">إلغاء</button>' +
            '        <div style="height: 30px; width: 1px; background: #cbd5e1; margin: 0 5px;"></div>' +
            '        <div style="display: flex; align-items: center; gap: 5px; font-weight: bold; color: #334155; font-size: 14px;">' +
            '            <span title="مقياس الطباعة وتكبير/تصغير المحتوى">🔍 الحجم (%):</span>' +
            '            <input type="number" id="printScale" value="100" min="30" max="200" step="5" onchange="updatePrintScale(this.value)" style="width: 60px;">' +
            '        </div>' +
            '        <div style="height: 30px; width: 1px; background: #cbd5e1; margin: 0 5px;"></div>' +
            '        <div style="display: flex; align-items: center; gap: 5px; font-weight: bold; color: #334155; font-size: 14px;">' +
            '            <span title="تغيير نوع الخط">الخط:</span>' +
            '            <select id="printFont" onchange="updatePrintFont(this.value)" style="padding: 5px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: inherit; font-size: 14px; background: white;">' +
            '                <option value="\'Cairo\', \'Tajawal\', sans-serif">Cairo (افتراضي)</option>' +
            '                <option value="\'ManaraDocs\', sans-serif">ManaraDocs</option>' +
            '                <option value="\'Tajawal\', sans-serif">Tajawal</option>' +

            '                <option value="Arial, sans-serif">Arial</option>' +
            '                <option value="\'Segoe UI\', Tahoma, Verdana, sans-serif">Segoe UI</option>' +
            '            </select>' +
            '        </div>' +
            '    </div>' +
            rightSide +
            '</div>';
    },
    getScriptHtml: function (options) {
        if (!options) options = { advanced: false };
        var advancedScript = '';
        if (options.advanced) {
            advancedScript =
                'function updatePages() {\n' +
                '    var total = ' + (options.totalPages || 1) + ';\n' +
                '    var from = parseInt(document.getElementById("pageFrom").value) || 1;\n' +
                '    var to = parseInt(document.getElementById("pageTo").value) || 1;\n' +
                '    if(isNaN(from) || from < 1) { from = 1; document.getElementById("pageFrom").value = 1; }\n' +
                '    if(isNaN(to) || to > total) { to = total; document.getElementById("pageTo").value = total; }\n' +
                '    if(from > to) { document.getElementById("pageFrom").value = to; from = to; }\n' +
                '    var chunks = document.querySelectorAll(".page-chunk");\n' +
                '    for (var i = 0; i < chunks.length; i++) {\n' +
                '        var chunk = chunks[i];\n' +
                '        var page = parseInt(chunk.getAttribute("data-page"));\n' +
                '        if(page >= from && page <= to) { chunk.style.display = ""; } \n' +
                '        else { chunk.style.display = "none"; }\n' +
                '    }\n' +
                '}\n';
        }

        return '<script>\n' +
            advancedScript + '\n' +
            'function openInBrowser() {\n' +
            '    try {\n' +
            '        var clone = document.documentElement.cloneNode(true);\n' +
            '        var toolbar = clone.querySelector(".print-toolbar");\n' +
            '        if (toolbar) toolbar.remove();\n' +
            '        var scripts = clone.querySelectorAll("script");\n' +
            '        for (var k = 0; k < scripts.length; k++) { scripts[k].remove(); }\n' +
            '        try {\n' +
            '            var sheets = document.styleSheets;\n' +
            '            for (var i = 0; i < sheets.length; i++) {\n' +
            '                try {\n' +
            '                    var sheet = sheets[i];\n' +
            '                    var cssText = "";\n' +
            '                    var rules = sheet.cssRules || sheet.rules;\n' +
            '                    if (rules) {\n' +
            '                        for (var j = 0; j < rules.length; j++) { cssText += rules[j].cssText + "\\n"; }\n' +
            '                        var styleTag = document.createElement("style");\n' +
            '                        styleTag.textContent = cssText;\n' +
            '                        var head = clone.querySelector("head");\n' +
            '                        if (head) head.appendChild(styleTag); else clone.appendChild(styleTag);\n' +
            '                    }\n' +
            '                } catch (sheetError) { console.warn("Style error:", sheetError); }\n' +
            '            }\n' +
            '        } catch (styleErr) { console.error("Inline error:", styleErr); }\n' +
            '        if (!clone.querySelector("meta[charset]")) {\n' +
            '            var meta = document.createElement("meta");\n' +
            '            meta.setAttribute("charset", "utf-8");\n' +
            '            var h = clone.querySelector("head");\n' +
            '            if (h) h.insertBefore(meta, h.firstChild);\n' +
            '        }\n' +
            '        var htmlContent = "\\uFEFF<!DOCTYPE html>\\n" + clone.outerHTML;\n' +
            '        var ipc = window.ipcRenderer || (window.require ? window.require("electron").ipcRenderer : null) || (window.opener ? window.opener.ipcRenderer : null);\n' +
            '        if (ipc && typeof ipc.invoke === "function") {\n' +
            '            ipc.invoke("print-to-browser", htmlContent).then(function(result) {\n' +
            '                if (result && result.success === false) alert("خطأ في الطباعة: " + result.error);\n' +
            '            });\n' +
            '        } else {\n' +
            '            var isElectron = !!(window.process && window.process.versions && window.process.versions.electron);\n' +
            '            if (!isElectron) {\n' +
            '                var blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });\n' +
            '                var url = URL.createObjectURL(blob);\n' +
            '                window.open(url, "_blank");\n' +
            '            } else { alert("Please restart the app to enable this feature."); }\n' +
            '        }\n' +
            '    } catch (e) { console.error("UI Error:", e); }\n' +
            '}\n' +
            '\n' +
            'function updatePrintScale(val) {\n' +
            '    var scaleVal = parseInt(val) || 100;\n' +
            '    var styleEl = document.getElementById("dynamic-scale-style");\n' +
            '    if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "dynamic-scale-style"; document.head.appendChild(styleEl); }\n' +
            '    styleEl.textContent = "@media print, screen { body > *:not(.print-toolbar) { zoom: " + (scaleVal / 100) + "; } }";\n' +
            '}\n' +
            '\n' +
            'function updatePrintFont(fontFamily) {\n' +
            '    var styleEl = document.getElementById("dynamic-font-style");\n' +
            '    if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "dynamic-font-style"; document.head.appendChild(styleEl); }\n' +
            '    var fontFaceCss = "";\n' +
            '    if (fontFamily.indexOf("ManaraDocs") !== -1 || fontFamily.indexOf("Tajawal") !== -1 || fontFamily.indexOf("Cairo") !== -1) {\n' +
            '        var path = window.location.pathname;\n' +
            '        if (path === "blank" || path === "") path = window.opener && window.opener.location ? window.opener.location.pathname : "";\n' +
            '        var baseUrl = path.substring(0, path.lastIndexOf("/"));\n' +
            '        baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf("/"));\n' +
            '        if (baseUrl && baseUrl.indexOf("file://") !== 0) baseUrl = "file://" + (baseUrl.charAt(0) === "/" ? "" : "/") + baseUrl;\n' +

            '        if (fontFamily.indexOf("ManaraDocs") !== -1) {\n' +
            '            fontFaceCss = "@font-face { font-family: \'ManaraDocs\'; src: url(\'" + encodeURI(baseUrl + "/assets/fonts/ManaraDocs Amatti Font.ttf") + "\') format(\'truetype\'); }";\n' +
            '        } else if (fontFamily.indexOf("Tajawal") !== -1) {\n' +
            '            fontFaceCss = "@font-face { font-family: \'Tajawal\'; src: url(\'" + encodeURI(baseUrl + "/assets/fonts/Tajawal-Regular.ttf") + "\') format(\'truetype\'); }";\n' +
            '        } else if (fontFamily.indexOf("Cairo") !== -1) {\n' +
            '            fontFaceCss = "@font-face { font-family: \'Cairo\'; src: url(\'" + encodeURI(baseUrl + "/assets/fonts/Cairo-Regular.ttf") + "\') format(\'truetype\'); }";\n' +
            '        }\n' +
            '    }\n' +
            '    styleEl.textContent = fontFaceCss + "@media print, screen { body:not(.print-toolbar), body *:not(.print-toolbar):not(.print-toolbar *) { font-family: " + fontFamily + " !important; } }";\n' +
            '}\n' +
            '<\/script>';
    }
};

const SUBJECTS_CEM = [

    'الرياضيات', 'العلوم الطبيعية', 'الإعلام الآلي', 'العلوم الفيزيائية والتكنولوجيا',

    'التربية البدنية والرياضية', 'اللغة الفرنسية', 'اللغة العربية', 'اللغة الإنجليزية',

    'التربية التشكيلية', 'التربية الموسيقية', 'اللغة الأمازيغية', 'التربية الإسلامية',

    'التربية المدنية', 'التاريخ والجغرافيا'

];

const SUBJECTS_LYCEE = [

    'الرياضيات', 'العلوم الفيزيائية', 'العلوم الطبيعية', 'فيزياء/علوم', 'علوم/فيزياء', 'اللغة العربية وآدابها', 'اللغة الفرنسية',

    'اللغة الإنجليزية', 'التاريخ والجغرافيا', 'العلوم الإسلامية', 'الفلسفة',

    'ت. المحاسبي و المالي', 'اقتصاد ومناجمنت', 'القانون', 'الهندسة المدنية',

    'الهندسة الميكانيكية', 'الهندسة الكهربائية', 'هندسة الطرائق', 'الإعلام الآلي',

    'التربية البدنية', 'اللغة الأمازيغية', 'التربية الفنية', 'التربية الموسيقية',

    'لغة إيطالية', 'لغة إسبانية', 'لغة ألمانية', 'لغة أجنبية 3', 'التكنولوجيا'

];

const shortenRank = (rank) => {
    if (!rank) return '';
    const map = {
        'أستاذ التعليم المتوسط': 'أ.ت.م',
        'أستاذ التعليم المتوسط قسم أوَّل': 'أ.ت.م ق1',
        'أستاذ التعليم المتوسط قسم أول': 'أ.ت.م ق1',
        'أستاذ التعليم المتوسط قسم ثانٍ': 'أ.ت.م ق2',
        'أستاذ التعليم المتوسط قسم ثان': 'أ.ت.م ق2',
        'أستاذ مميز في التعليم المتوسط': 'أ.م',
        
        'أستاذ التعليم الثانوي': 'أ.ت.ث',
        'أستاذ التعليم الثانوي قسم أوَّل': 'أ.ت.ث.ق1',
        'أستاذ التعليم الثانوي قسم ثانٍ': 'أ.ت.ث.ق2',
        'أستاذ مميز في التعليم الثانوي': 'أ.م.ث',
        
        'أستاذ التعليم الابتدائي': 'أ.ت.إ',
        'أستاذ التعليم الابتدائي قسم أوَّل': 'أ.ت.إ ق1',
        'أستاذ التعليم الابتدائي قسم أول': 'أ.ت.إ ق1',
        'أستاذ التعليم الإبتدائي قسم أوَّل': 'أ.ت.إ ق1',
        'أستاذ التعليم الإبتدائي قسم أول': 'أ.ت.إ ق1',
        'أستاذ التعليم الابتدائي قسم ثانٍ': 'أ.ت.إ ق2',
        'أستاذ التعليم الابتدائي قسم ثان': 'أ.ت.إ ق2',
        'أستاذ التعليم الإبتدائي قسم ثانٍ': 'أ.ت.إ ق2',
        'أستاذ التعليم الإبتدائي قسم ثان': 'أ.ت.إ ق2',
        'أستاذ مميز في التعليم الابتدائي': 'أ.م.إ',

        'أستاذ رئيسي للتعليم المتوسط': 'أ.ر.ت.م',
        'أستاذ مكون للتعليم المتوسط': 'أ.م.ت.م',
        'أستاذ رئيسي للتعليم الثانوي': 'أ.ر.ت.ث',
        'أستاذ مكون للتعليم الثانوي': 'أ.م.ت.ث',
        'أستاذ رئيسي للتعليم الابتدائي': 'أ.ر.ت.إ',
        'أستاذ مكون للتعليم الابتدائي': 'أ.م.ت.إ'
    };
    return map[rank] || rank;
};
const getRankColor = (rank) => {
    if (!rank) return '#64748b';
    if (rank.includes('ثانوي')) return '#ef4444'; // Red
    if (rank.includes('متوسط')) return '#3b82f6'; // Blue
    if (rank.includes('ابتدائي')) return '#10b981'; // Green (Emerald)
    return '#64748b';
};

// Subject groups - teachers shouldn't proctor their own specialty or linked subjects
const LINKED_SUBJECTS = {
    'اللغة العربية': ['التربية الإسلامية'],
    'التربية الإسلامية': ['اللغة العربية'],
    'التاريخ والجغرافيا': ['التربية المدنية'],
    'التربية المدنية': ['التاريخ والجغرافيا'],
    'اللغة العربية وآدابها': ['العلوم الإسلامية'],
    'العلوم الإسلامية': ['اللغة العربية وآدابها'],
    'العلوم الفيزيائية': ['العلوم الطبيعية'],
    'العلوم الطبيعية': ['العلوم الفيزيائية'],
};

const normalizeSubjectConflictText = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[\/\\|،؛;,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const SUBJECT_CONFLICT_ALIAS_GROUPS = {
    'الرياضيات': ['الرياضيات', 'رياضيات'],
    'اللغة العربية': ['اللغة العربية', 'عربية'],
    'اللغة العربية وآدابها': ['اللغة العربية وآدابها', 'اللغه العربيه وادابها', 'عربية وآدابها', 'عربيه وادابها'],
    'اللغة الفرنسية': ['اللغة الفرنسية', 'اللغه الفرنسيه', 'فرنسية', 'فرنسيه'],
    'اللغة الإنجليزية': ['اللغة الإنجليزية', 'اللغة الانجليزية', 'اللغه الانجليزيه', 'إنجليزية', 'انجليزية', 'انجليزيه'],
    'اللغة الأمازيغية': ['اللغة الأمازيغية', 'اللغة الامازيغية', 'اللغه الامازيغيه', 'أمازيغية', 'امازيغية', 'امازيغي'],
    'التربية الإسلامية': ['التربية الإسلامية', 'التربية الاسلامية', 'التربيه الاسلاميه', 'إسلامية', 'اسلامية', 'اسلاميه'],
    'العلوم الإسلامية': ['العلوم الإسلامية', 'العلوم الاسلامية', 'العلوم الاسلاميه', 'علوم إسلامية', 'علوم اسلامية'],
    'التاريخ والجغرافيا': ['التاريخ والجغرافيا', 'تاريخ وجغرافيا', 'تاريخ', 'جغرافيا'],
    'التربية المدنية': ['التربية المدنية', 'التربيه المدنيه', 'مدنية', 'مدنيه'],
    'العلوم الطبيعية': ['العلوم الطبيعية', 'العلوم الطبيعية والحياة', 'العلوم الطبيعيه', 'العلوم الطبيعيه والحياه', 'علوم طبيعية', 'علوم طبيعيه', 'طبيعية', 'طبيعيه', 'فيزياء/علوم', 'علوم/فيزياء'],
    'العلوم الفيزيائية': ['العلوم الفيزيائية', 'العلوم الفيزيائية والتكنولوجيا', 'العلوم الفيزيائية و التكنولوجيا', 'العلوم الفيزيائيه', 'العلوم الفيزيائيه والتكنولوجيا', 'العلوم الفيزيائيه و التكنولوجيا', 'فيزياء', 'فيزيائية', 'فيزيائيه', 'ع فيزيائية', 'ع فيزيائيه', 'فيزياء/علوم', 'علوم/فيزياء'],
    'الإعلام الآلي': ['الإعلام الآلي', 'الاعلام الالي', 'إعلام آلي', 'اعلام آلي', 'اعلام الي'],
    'التربية البدنية والرياضية': ['التربية البدنية والرياضية', 'التربية البدنية', 'التربيه البدنيه والرياضيه', 'التربيه البدنيه', 'رياضة', 'رياضه', 'بدنية', 'بدنيه'],
    'التربية التشكيلية': ['التربية التشكيلية', 'التربيه التشكيليه', 'تشكيلية', 'تشكيليه', 'التربية الفنية', 'التربيه الفنيه', 'فنية', 'فنيه'],
    'التربية الموسيقية': ['التربية الموسيقية', 'التربيه الموسيقيه', 'موسيقى', 'موسيقي', 'موسيقية', 'موسيقيه'],
    'الفلسفة': ['الفلسفة', 'الفلسفه', 'فلسفة', 'فلسفه'],
    'القانون': ['القانون'],
    'التكنولوجيا': ['التكنولوجيا', 'تكنولوجيا'],
    'ت. المحاسبي و المالي': ['ت. المحاسبي و المالي', 'ت المحاسبي و المالي', 'المحاسبي و المالي', 'المحاسبي والمالي', 'محاسبي مالي'],
    'اقتصاد ومناجمنت': ['اقتصاد ومناجمنت', 'اقتصاد و مناجمنت', 'اقتصاد', 'مناجمنت', 'تسيير واقتصاد'],
    'الهندسة المدنية': ['الهندسة المدنية', 'هندسة مدنية'],
    'الهندسة الميكانيكية': ['الهندسة الميكانيكية', 'هندسة ميكانيكية'],
    'الهندسة الكهربائية': ['الهندسة الكهربائية', 'هندسة كهربائية'],
    'هندسة الطرائق': ['هندسة الطرائق', 'هندسة الطرايق', 'هندسه الطرائق'],
    'التربية الفنية': ['التربية الفنية', 'التربيه الفنيه', 'فنية', 'فنيه'],
    'لغة أجنبية 3': ['لغة أجنبية 3', 'لغة اجنبية 3', 'لغة ثالثة', 'لغة ثالثه'],
    'لغة إيطالية': ['لغة إيطالية', 'لغة ايطالية', 'إيطالية', 'ايطالية'],
    'لغة إسبانية': ['لغة إسبانية', 'لغة اسبانية', 'إسبانية', 'اسبانية'],
    'لغة ألمانية': ['لغة ألمانية', 'لغة المانية', 'ألمانية', 'المانية']
};

const SUBJECT_CONFLICT_ALIAS_LOOKUP = Object.entries(SUBJECT_CONFLICT_ALIAS_GROUPS).reduce((lookup, [canonical, aliases]) => {
    [canonical, ...(aliases || [])].forEach((alias) => {
        const normalizedAlias = normalizeSubjectConflictText(alias);
        if (!normalizedAlias) return;
        if (!lookup.has(normalizedAlias)) {
            lookup.set(normalizedAlias, new Set());
        }
        lookup.get(normalizedAlias).add(canonical);
    });
    return lookup;
}, new Map());

const getSubjectConflictKeys = (subject) => {
    const normalized = normalizeSubjectConflictText(subject);
    if (!normalized) return [];

    const matchedCanonicals = SUBJECT_CONFLICT_ALIAS_LOOKUP.get(normalized);
    if (matchedCanonicals && matchedCanonicals.size > 0) {
        return [...matchedCanonicals];
    }

    return [normalized];
};

const subjectsAreLinkedForConflict = (subjectA, subjectB) => {
    const linkedA = LINKED_SUBJECTS[subjectA] || [];
    const linkedB = LINKED_SUBJECTS[subjectB] || [];
    return linkedA.includes(subjectB) || linkedB.includes(subjectA);
};

const normalizeRankMatchingText = (value) => normalizeSubjectConflictText(value).replace(/\./g, '').trim();

const getTeacherStage = (rank) => {
    const normalizedRank = normalizeRankMatchingText(rank);
    if (!normalizedRank) return 'unknown';
    if (normalizedRank.includes('ابتدا')) return 'primary';
    if (normalizedRank.includes('ثانو')) return 'secondary';
    if (normalizedRank.includes('متوسط')) return 'middle';
    return 'unknown';
};

const isExperienced = (rank) => {
    const normalizedRank = normalizeRankMatchingText(rank);
    if (!normalizedRank) return false;
    return normalizedRank.includes('مميز')
        || normalizedRank.includes('رئيسي')
        || normalizedRank.includes('مكون')
        || normalizedRank.includes('قسم اول')
        || normalizedRank.includes('قسم 1')
        || normalizedRank.includes('ق1')
        || normalizedRank.includes('قسم ثان')
        || normalizedRank.includes('قسم ثاني')
        || normalizedRank.includes('قسم 2')
        || normalizedRank.includes('ق2');
};

const getPreferredStageForTrimester = (trimester, fallbackStage, customStage = 'middle') => {
    if (trimester === 'blanc_lycee') return 'secondary';
    if (trimester === 'blanc') return 'middle';
    if (trimester === 'custom' && (customStage === 'middle' || customStage === 'secondary')) return customStage;
    if (fallbackStage === 'primary' || fallbackStage === 'secondary' || fallbackStage === 'middle') {
        return fallbackStage;
    }
    return 'middle';
};

const getStageDisplayLabel = (stage) => {
    if (stage === 'secondary') return 'الثانوي';
    if (stage === 'middle') return 'المتوسط';
    if (stage === 'primary') return 'الابتدائي';
    return 'المعتمد';
};

const getTeacherStagePenalty = (teacher, preferredStage) => {
    if (!preferredStage) return 0;
    const stage = getTeacherStage(teacher.rank);
    if (stage === preferredStage) return 0;
    if (stage === 'unknown') return 1;
    return 2;
};

const compareTeacherNames = (a, b) => {
    const aName = `${a.surname || ''} ${a.name || ''}`.trim();
    const bName = `${b.surname || ''} ${b.name || ''}`.trim();
    const nameDiff = aName.localeCompare(bName, 'ar');
    if (nameDiff !== 0) return nameDiff;
    return String(a.id).localeCompare(String(b.id), 'en');
};

const getTeacherAssignmentsOnDay = (loadEntry, dayDate) => {
    const dayAssignments = loadEntry && loadEntry.dayPeriods ? loadEntry.dayPeriods[dayDate] : null;
    return Array.isArray(dayAssignments) ? dayAssignments.length : 0;
};

const compareAssignmentCandidates = (a, b, load, slot, preferredStage, mode = 'guard', tieBreakerSeed = 0) => {
    const totalDiff = load[a.id].total - load[b.id].total;
    if (totalDiff !== 0) return totalDiff;

    const aOnDay = load[a.id].days.has(slot.dayDate) ? 0 : 1;
    const bOnDay = load[b.id].days.has(slot.dayDate) ? 0 : 1;
    if (aOnDay !== bOnDay) return aOnDay - bOnDay;

    const aAssignmentsOnDay = getTeacherAssignmentsOnDay(load[a.id], slot.dayDate);
    const bAssignmentsOnDay = getTeacherAssignmentsOnDay(load[b.id], slot.dayDate);
    const compactDayDiff = bAssignmentsOnDay - aAssignmentsOnDay;
    if (compactDayDiff !== 0) return compactDayDiff;

    const dayDiff = load[a.id].days.size - load[b.id].days.size;
    if (dayDiff !== 0) return dayDiff;

    const stagePenaltyDiff = getTeacherStagePenalty(a, preferredStage) - getTeacherStagePenalty(b, preferredStage);
    if (stagePenaltyDiff !== 0) return stagePenaltyDiff;

    if ((slot.subjects || []).length > 1) {
        const expDiff = (isExperienced(b.rank) ? 1 : 0) - (isExperienced(a.rank) ? 1 : 0);
        if (expDiff !== 0) return expDiff;
    }

    if (mode === 'guard') {
        const guardDiff = load[a.id].guardCount - load[b.id].guardCount;
        if (guardDiff !== 0) return guardDiff;
    } else {
        const reserveDiff = load[a.id].reserveCount - load[b.id].reserveCount;
        if (reserveDiff !== 0) return reserveDiff;
    }

    const slotKey = `${slot.dayId}_${slot.period}`;
    const aTieBreaker = hashStableString(`${tieBreakerSeed}|${slotKey}|${mode}|${normalizeTeacherId(a.id)}`);
    const bTieBreaker = hashStableString(`${tieBreakerSeed}|${slotKey}|${mode}|${normalizeTeacherId(b.id)}`);
    if (aTieBreaker !== bTieBreaker) return aTieBreaker - bTieBreaker;

    return compareTeacherNames(a, b);
};

const teachesSubjectInPeriod = (teacher, periodSubjects) => {
    if (!teacher.subjects || !teacher.subjects.length || !periodSubjects || !periodSubjects.length) return false;
    const periodKeys = [...new Set(
        periodSubjects
            .filter(subject => subject && String(subject).trim() !== '')
            .flatMap(getSubjectConflictKeys)
    )];
    if (periodKeys.length === 0) return false;

    for (const teacherSubject of teacher.subjects) {
        const teacherKeys = getSubjectConflictKeys(teacherSubject);
        if (teacherKeys.length === 0) continue;

        if (teacherKeys.some((teacherKey) => periodKeys.includes(teacherKey))) {
            return true;
        }

        if (teacherKeys.some((teacherKey) => periodKeys.some((periodKey) => subjectsAreLinkedForConflict(teacherKey, periodKey)))) {
            return true;
        }
    }

    return false;
};

const getSubjectLabel = (key) => {

    const labels = {

        'رياضيات': 'رياضيات', 'فيزياء': 'فيزياء', 'علوم': 'علوم', 'عربية': 'عربية',

        'فرنسية': 'فرنسية', 'انجليزية': 'انجليزية', 'تاريخ': 'تاريخ',

        'تربية_اسلامية': 'ت.إسلامية', 'تربية_مدنية': 'ت.مدنية', 'تربية_فنية': 'ت.فنية',

        'تربية_بدنية': 'ت.بدنية', 'موسيقى': 'موسيقى', 'إعلام_آلي': 'إعلام آلي'

    };

    return labels[key] || key;

};

const formatDate = (dateStr) => {
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
    return date.toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const formatDateShort = (dateStr) => {
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
    const dayName = date.toLocaleDateString('ar-DZ', { weekday: 'long' });
    const dateFormatted = date.toLocaleDateString('ar-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return { dayName, dateFormatted, full: `${dayName} ${dateFormatted}` };
};

// Global Room Cache for label lookup
let GlobalRoomCache = {};

// Helper for short location labels
const getLocationLabelShort = (id) => {
    if (!id || id === 0) return '';

    // 1. Try Lookup in Global Cache (covers new structured rooms)
    if (GlobalRoomCache[id]) return GlobalRoomCache[id];

    // 2. Legacy / Hardcoded Patterns
    const numericId = parseInt(id);
    if (isNaN(numericId)) return id; // Return as-is if string

    if (numericId >= 300) {
        // Handle potentially large IDs from old generator or timestamps
        if (numericId > 1000000) return `قاعة`; // Fallback for timestamps if not in cache
        return `خ${numericId - 300 + 1}`;
    }
    if (numericId > 200) return `و${numericId - 200}`;
    if (numericId > 100) return `م${numericId - 100}`;
    return `ق${numericId}`;
};

const getCustomScheduleStageLabel = (stage) => {
    return stage === 'secondary' ? 'ثانوي' : 'متوسط';
};

const getSupervisionTrimesterLabel = (value, customStage = 'middle') => {
    const labels = {
        'custom': `امتحان آخر - رزنامة ${getCustomScheduleStageLabel(customStage)}`,
        '1': 'الفصل الأول',
        '2': 'الفصل الثاني',
        '3': 'الفصل الثالث',
        'blanc': 'شهادة التعليم المتوسط',
        'blanc_lycee': 'شهادة البكالوريا'
    };

    return labels[value] || value || '';
};

const getOfficialExamSelectorOptions = (currentValue, customStage = 'middle') => {
    const normalizedValue = String(currentValue || '');
    const options = [
        { value: 'blanc', label: 'شهادة التعليم المتوسط' },
        { value: 'blanc_lycee', label: 'شهادة البكالوريا' }
    ];

    if (normalizedValue === 'custom') {
        options.push({
            value: 'custom',
            label: getSupervisionTrimesterLabel('custom', customStage)
        });
    }

    if (['1', '2', '3'].includes(normalizedValue)) {
        options.unshift({
            value: normalizedValue,
            label: `${getSupervisionTrimesterLabel(normalizedValue, customStage)} - بيانات قديمة`
        });
    }

    return options;
};

const getSupervisionPeriodShortLabel = (period) => {
    if (period === 'midday') return 'منتصف';
    if (period === 'evening') return 'مساء';
    return 'صباح';
};

// ======================

// EXCEL IMPORT/EXPORT FOR EXAM PROCTORS

// ======================

const EXAM_PROCTORS_TEMPLATE_VARIANTS = {
    split: {
        fileName: 'نموذج_حراس_الامتحانات.xlsx',
        title: 'نموذج إدخال أساتذة الحراسة للامتحانات الرسمية',
        metaRows: ['النموذج 1: اللقب والاسم في عمودين منفصلين'],
        headers: ['اللقب', 'الاسم', 'تاريخ الميلاد', 'الجنس', 'المادة', 'الرتبة', 'المؤسسة']
    },
    combined: {
        fileName: 'نموذج_حراس_الامتحانات_عمود_موحد.xlsx',
        title: 'نموذج إدخال أساتذة الحراسة للامتحانات الرسمية',
        metaRows: ['النموذج 2: اكتب اللقب والاسم في خلية واحدة داخل العمود الأول'],
        headers: ['اللقب والاسم', 'تاريخ الميلاد', 'الجنس', 'المادة', 'الرتبة', 'المؤسسة']
    }
};

const normalizeImportedCell = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();

const detectExamProctorsTemplateMode = (row) => {
    const firstCell = normalizeImportedCell(row && row[0]);
    const secondCell = normalizeImportedCell(row && row[1]);

    if (!firstCell) return null;
    if (firstCell.includes('اللقب والاسم')) return 'combined';
    if (firstCell.includes('اللقب') && secondCell.includes('الاسم')) return 'split';
    return null;
};

const parseCombinedProctorName = (value) => {
    const fullName = normalizeImportedCell(value);
    if (!fullName) {
        return { last_name: '', first_name: '' };
    }

    const directSeparatorParts = fullName.split(/\s*(?:\/|\\|\||،|؛|;)\s*/).filter(Boolean);
    if (directSeparatorParts.length >= 2) {
        return {
            last_name: directSeparatorParts[0],
            first_name: directSeparatorParts.slice(1).join(' ')
        };
    }

    const dashedParts = fullName.split(/\s+[—–-]\s+/).filter(Boolean);
    if (dashedParts.length >= 2) {
        return {
            last_name: dashedParts[0],
            first_name: dashedParts.slice(1).join(' ')
        };
    }

    // Keep the full name intact when no clear separator exists to avoid corrupting compound names.
    return { last_name: fullName, first_name: '' };
};

const buildImportedProctor = (row, index, templateMode) => {
    const base = {
        id: 'p_' + Date.now() + '_' + index,
        birth_date: '',
        gender: '',
        subject: '',
        rank: '',
        institution: ''
    };

    if (templateMode === 'combined') {
        const parsedName = parseCombinedProctorName(row[0]);
        return {
            ...base,
            ...parsedName,
            birth_date: normalizeImportedCell(row[1]),
            gender: normalizeImportedCell(row[2]),
            subject: normalizeImportedCell(row[3]),
            rank: normalizeImportedCell(row[4]),
            institution: normalizeImportedCell(row[5])
        };
    }

    return {
        ...base,
        last_name: normalizeImportedCell(row[0]),
        first_name: normalizeImportedCell(row[1]),
        birth_date: normalizeImportedCell(row[2]),
        gender: normalizeImportedCell(row[3]),
        subject: normalizeImportedCell(row[4]),
        rank: normalizeImportedCell(row[5]),
        institution: normalizeImportedCell(row[6])
    };
};

window.exportExamProctorsTemplate = function(templateMode) {
    if (!window.ExcelExportHelper) {
        alert('مساعد التصدير غير متوفر');
        return;
    }

    var variant = EXAM_PROCTORS_TEMPLATE_VARIANTS[templateMode] || EXAM_PROCTORS_TEMPLATE_VARIANTS.split;

    window.ExcelExportHelper.exportWorkbook({
        fileName: variant.fileName,
        sheets: [{
            sheetName: 'الأساتذة الحراس',
            title: variant.title,
            metaRows: variant.metaRows,
            headers: variant.headers,
            rows: []
        }]
    }).catch(function(err) {
        console.error('Export error:', err);
        alert('حدث خطأ أثناء تصدير النموذج');
    });
};

window.exportExamProctorsCombinedTemplate = function() {
    return window.exportExamProctorsTemplate('combined');
};

window.importExamProctors = function(event) {
    if (!window.XLSX) {
        alert('مكتبة XLSX غير متوفرة');
        return;
    }
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = async function(ev) {
        try {
            var data = new Uint8Array(ev.target.result);
            var workbook = XLSX.read(data, { type: 'array' });
            var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            var rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            if (rows.length < 2) {
                alert('الملف فارغ أو لا يحتوي على بيانات كافية');
                return;
            }

            var proctors = [];
            var templateMode = null;
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                if (!r || !r.length) continue;

                var normalizedRow = r.map(normalizeImportedCell);
                if (!normalizedRow.some(Boolean)) continue;

                var detectedMode = detectExamProctorsTemplateMode(normalizedRow);
                if (detectedMode) {
                    templateMode = detectedMode;
                    continue;
                }

                if (normalizedRow[0].includes('نموذج')) continue;

                var effectiveMode = templateMode || (normalizedRow.length >= 7 ? 'split' : 'combined');
                var proctor = buildImportedProctor(normalizedRow, i, effectiveMode);
                if (!normalizeImportedCell(proctor.last_name) && !normalizeImportedCell(proctor.first_name)) continue;
                proctors.push(proctor);
            }

            if (proctors.length > 0) {
                var success = await DB.saveExamProctors(proctors);
                if (success) {
                    await Swal.fire({
                        icon: 'success',
                        title: 'تم الاستيراد',
                        text: 'تم استيراد ' + proctors.length + ' أستاذ حارس بنجاح.',
                        confirmButtonText: 'حسناً'
                    });
                    window.location.reload();
                } else {
                    alert('فشل في الحفظ');
                }
            } else {
                alert('لم يتم العثور على بيانات صالحة');
            }
        } catch (err) {
            console.error('Import error:', err);
            alert('حدث خطأ أثناء استيراد الملف: ' + err.message);
        }
        // Reset file input
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
};

// ======================

// COMPONENTS

// ======================

// --- UI Components ---

const Icon = ({ name, style = {} }) =>
    e('span', {
        'data-icon': name,
        className: 'icon-wrapper',
        dangerouslySetInnerHTML: { __html: IconManager.get(name) },
        style: { verticalAlign: 'middle', display: 'inline-flex', alignItems: 'center', ...style }
    });

const Button = ({ onClick, children, className = 'btn-primary', style = {} }) =>
    e('button', { className: `btn ${className}`, onClick, style }, children);

const Card = ({ title, children, headerAction }) =>

    e('section', { className: 'teachers-section' }, // Reuse existing CSS class for card style

        e('div', { className: 'section-header' },

            e('h3', {}, title),

            headerAction

        ),

        children

    );

const Select = ({ value, onChange, options, style = {} }) =>

    e('select', { value, onChange: (ev) => onChange(ev.target.value), style: { padding: '8px', borderRadius: '4px', border: '1px solid #ddd', ...style } },

        options.map(opt => e('option', { key: opt.value, value: opt.value }, opt.label))

    );

// --- Feature Components ---

const TrimesterSelector = ({ value, onChange, customStage = 'middle' }) =>

    e('div', { style: { marginTop: '15px', display: 'flex', alignItems: 'center', gap: '15px', justifyContent: 'center' } },

        e('label', { style: { fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' } }, e(Icon, { name: 'calendar' }), 'الامتحان:'),

        e('select', {

            value,

            onChange: (ev) => onChange(ev.target.value),

            style: { padding: '8px 15px', borderRadius: '6px', border: '2px solid var(--secondary-color)', fontSize: '1rem' }

        },

            getOfficialExamSelectorOptions(value, customStage).map((option) =>
                e('option', { key: option.value, value: option.value }, option.label)
            )

        )

    );

const HighlightTrimesterSelector = ({ value, onChange, showReset = false, onReset = null, customStage = 'middle' }) =>

    e('div', {
        style: {
            marginTop: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            justifyContent: 'center',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #eff6ff, #f8fafc)',
            border: '1px solid #bfdbfe',
            borderRadius: '14px',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.08)'
        }
    },

        e('label', {
            style: {
                fontWeight: '900',
                color: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                fontSize: '1rem'
            }
        }, e(Icon, { name: 'calendar' }), 'الامتحان:'),

        e('div', {
            style: {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                justifyContent: 'center'
            }
        },
            e('select', {

                value,

                onChange: (ev) => onChange(ev.target.value),

                style: {
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: '2px solid #3b82f6',
                    fontSize: '1rem',
                    fontWeight: '800',
                    color: '#0f172a',
                    background: 'var(--card-bg)',
                    minWidth: '240px',
                    boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.08)'
                }

            },

                getOfficialExamSelectorOptions(value, customStage).map((option) =>
                    e('option', { key: option.value, value: option.value }, option.label)
                )

            ),
            showReset && e(Button, {
                className: 'btn-warning btn-sm',
                onClick: onReset,
                style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontWeight: '800'
                }
            },
                e(Icon, { name: 'refresh-cw' }),
                'إعادة التعيين'
            )
        )

    );

const TeachersList = ({ teachers, onToggleExemption }) => {
    const visibleTeachers = (teachers || []).filter((teacher) => !teacher.isLegacyPlaceholder);

    if (visibleTeachers.length === 0) {

        return e('div', { style: { textAlign: 'center', color: '#888', padding: '30px' } },

            'ظ„ظ… ظٹطھظ… ط¥ط¶ط§ظپط© ط£ط³ط§طھط°ط© ط¨ط¹ط¯. ظٹط±ط¬ظ‰ ط¥ط¶ط§ظپطھظ‡ظ… ظ…ظ† طµظپط­ط© "إدارة الأساتذة".');

    }

    return e('div', { style: { overflowX: 'auto', maxHeight: '300px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' } },

        e('table', { className: 'teachers-table' },

            e('thead', { style: { position: 'sticky', top: 0, zIndex: 5 } },

                e('tr', {},

                    e('th', { width: '5%' }, '#'),

                    e('th', { width: '25%' }, 'اللقب والاسم'),

                    e('th', { width: '30%' }, 'المواد'),
                    e('th', { width: '15%' }, 'المؤسسة'),
                    e('th', { width: '15%' }, 'الإعفاء')

                )

            ),

            e('tbody', {},

                visibleTeachers.map((t, i) =>

                    e('tr', {
                        key: t.id,
                        style: t.isExempt ? { background: '#f8fafc' } : undefined
                    },

                        e('td', {}, i + 1),

                        e('td', {}, `${t.surname} ${t.name}`),

                        e('td', {}, 
                            t.subjects.map(s => e('span', { key: s, className: 'subject-tag' }, getSubjectLabel(s))),
                            t.rank && e('span', { 
                                style: { 
                                    marginRight: '6px', 
                                    fontSize: '0.8rem', 
                                    color: getRankColor(t.rank),
                                    fontWeight: 'bold',
                                    background: getRankColor(t.rank) + '10',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0'
                                } 
                            }, shortenRank(t.rank))
                        ),

                        e('td', {}, t.institution || '-'),

                        e('td', { style: { textAlign: 'center' } },
                            e('div', { style: { display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' } },
                                e('label', {
                                    style: {
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '5px 8px',
                                        borderRadius: '8px',
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        cursor: 'pointer',
                                        fontSize: '0.82rem',
                                        fontWeight: '700'
                                    }
                                },
                                    e('input', {
                                        type: 'checkbox',
                                        checked: !!t.isExempt,
                                        onChange: (ev) => onToggleExemption && onToggleExemption(t.id, ev.target.checked)
                                    }),
                                    'إعفاء'
                                )
                            )
                        )

                    )

                )

            )

        )

    );

};

const DayCard = ({ day, onDelete, onUpdate, globalStage }) => {

    const [subjectSlotCounts, setSubjectSlotCounts] = useState(() => ({
        morning: Math.max(3, Array.isArray(day.morning?.subjects) ? day.morning.subjects.length : 0),
        midday: Math.max(3, Array.isArray(day.midday?.subjects) ? day.midday.subjects.length : 0),
        evening: Math.max(3, Array.isArray(day.evening?.subjects) ? day.evening.subjects.length : 0)
    }));

    const updatePeriod = (period, field, val) => {

        const newDay = { ...day, [period]: { ...day[period] } };

        if (field === 'count') newDay[period].requiredTeachers = parseInt(val) || 0;
        else if (field === 'reserve') newDay[period].reserveTeachers = parseInt(val) || 0;

        else if (field === 'time') newDay[period].time = val;

        else if (field.startsWith('subject')) {

            const idx = parseInt(field.replace('subject', ''));

            const visibleCount = Math.max(3, subjectSlotCounts[period] || 3);
            const subs = [...(newDay[period].subjects || [])];

            while (subs.length < visibleCount) {
                subs.push('');
            }

            subs[idx] = val;

            while (subs.length > 3 && subs[subs.length - 1] === '') {
                subs.pop();
            }

            newDay[period].subjects = subs;

        }

        onUpdate(newDay);

    };

    const addSubjectSlot = (period) => {
        setSubjectSlotCounts(prev => ({
            ...prev,
            [period]: Math.max(3, prev[period] || 3) + 1
        }));
    };

    const removeSubjectSlot = (period) => {
        const nextCount = Math.max(3, (subjectSlotCounts[period] || 3) - 1);
        const newDay = { ...day, [period]: { ...day[period] } };
        newDay[period].subjects = [...(newDay[period].subjects || [])].slice(0, nextCount);
        setSubjectSlotCounts(prev => ({ ...prev, [period]: nextCount }));
        onUpdate(newDay);
    };

    const periodRow = (period, label, labelClass) => {

        const pData = day[period] || {};

        const subjects = pData.subjects || [];

        const visibleSubjectCount = globalStage === 'secondary'
            ? Math.max(3, subjectSlotCounts[period] || subjects.length || 3)
            : Math.max(2, subjects.length || 2);

        const currentSubjectsList = globalStage === 'secondary' ? SUBJECTS_LYCEE : SUBJECTS_CEM;

        const count = pData.requiredTeachers !== undefined ? pData.requiredTeachers : 0;
        const reserveCount = pData.reserveTeachers !== undefined ? pData.reserveTeachers : 0;

        let defaultTime = '12:00 - 08:00';
        if (period === 'evening') defaultTime = '17:00 - 13:00';
        if (period === 'midday') defaultTime = '13:00 - 11:00';
        const time = pData.time || defaultTime;

        return e('div', { className: 'period-row', style: { flexWrap: 'wrap', gap: '5px', marginTop: period === 'evening' ? '10px' : 0, paddingTop: period === 'evening' ? '10px' : 0, borderTop: period === 'evening' ? '1px dashed #eee' : 'none' } },

            e('div', { style: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '5px' } },

                e('span', { className: `period-label ${labelClass}` }, label),

                e('div', { style: { display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' } },

                    e('input', {
                        type: 'text', value: time,
                        onChange: (ev) => updatePeriod(period, 'time', ev.target.value),
                        style: { width: '110px', padding: '5px', borderRadius: '4px', textAlign: 'center', border: '1px solid #ddd', fontSize: '0.85em', direction: 'ltr' },
                        placeholder: 'التوقيت'
                    }),

                    e('span', { style: { fontSize: '0.75rem', color: '#7f8c8d' } }, 'حراس'),

                    e('input', {
                        type: 'number', min: 0, max: 200, value: count,
                        onChange: (ev) => updatePeriod(period, 'count', ev.target.value),
                        style: { width: '50px', padding: '5px', borderRadius: '4px', textAlign: 'center', border: '1px solid #3b82f6', background: '#eff6ff' },
                        title: 'عدد الحراس'
                    }),

                    e('span', { style: { fontSize: '0.75rem', color: '#d97706' } }, 'احتياط'),

                    e('input', {
                        type: 'number', min: 0, max: 50, value: reserveCount,
                        onChange: (ev) => updatePeriod(period, 'reserve', ev.target.value),
                        style: { width: '50px', padding: '5px', borderRadius: '4px', textAlign: 'center', border: '1px solid #f59e0b', background: '#fffbeb' },
                        title: 'عدد الحراس الاحتياط'
                    })

                )

            ),

            e('div', {
                style: {
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: visibleSubjectCount <= 2 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
                    gap: '6px'
                }
            },
                Array.from({ length: visibleSubjectCount }, (_, idx) =>

                    e('div', {
                        key: idx,
                        style: {
                            borderRadius: '6px',
                            border: `2px solid ${subjects[idx] ? '#16a34a' : '#dc2626'}`,
                            background: subjects[idx] ? '#f0fdf4' : '#fef2f2',
                            boxShadow: `0 0 0 1px ${subjects[idx] ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)'}`,
                            overflow: 'hidden'
                        }
                    },
                        e('select', {

                            value: subjects[idx] || '',

                            onChange: (ev) => updatePeriod(period, `subject${idx}`, ev.target.value),

                            style: {
                                padding: '5px',
                                borderRadius: 0,
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                color: subjects[idx] ? '#166534' : '#991b1b',
                                width: '100%',
                                fontSize: '0.85em',
                                margin: 0,
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                MozAppearance: 'none'
                            }

                        },

                            e('option', { value: '' }, `-- مادة ${idx + 1} --`),

                            currentSubjectsList.map(s => e('option', { key: s, value: s }, s))

                        )
                    )

                )
            ),

            globalStage === 'secondary' && e('div', {
                style: {
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px'
                }
            },
                e('button', {
                    type: 'button',
                    onClick: () => addSubjectSlot(period),
                    style: {
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        color: '#0f172a',
                        borderRadius: '999px',
                        padding: '4px 10px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                    }
                }, '+ إضافة مادة'),
                visibleSubjectCount > 3 && e('button', {
                    type: 'button',
                    onClick: () => removeSubjectSlot(period),
                    style: {
                        border: '1px solid #fecaca',
                        background: '#fff1f2',
                        color: '#b91c1c',
                        borderRadius: '999px',
                        padding: '4px 10px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                    }
                }, 'حذف آخر مادة')
            )

        );

    };

    return e('div', { className: 'day-card', style: { minWidth: '380px' } },

        e('div', { className: 'day-header' },

            e('span', { className: 'day-date', style: { display: 'flex', alignItems: 'center', gap: '5px' } },
                e(Icon, { name: 'calendar' }),
                formatDate(day.date)
            ),

            e(Button, { className: 'btn-danger btn-sm', onClick: () => onDelete(day.id) },
                e(Icon, { name: 'delete' })
            )

        ),

        day.morning && periodRow('morning', e('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, e(Icon, { name: 'sun' }), ' صباح:'), 'morning'),

        day.midday && periodRow('midday', e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('sun') + ' منتصف:' }, style: { color: '#e67e22' } }), 'midday'),

        day.evening && periodRow('evening', e('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, e(Icon, { name: 'moon' }), ' مساء:'), 'evening')

    );

};

const AddDayModal = ({ isOpen, onClose, onAdd }) => {
    if (!isOpen) return null;

    const [date, setDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    });

    const [useThreePeriods, setUseThreePeriods] = useState(false);
    const [hasMorning, setHasMorning] = useState(true);
    const [hasEvening, setHasEvening] = useState(true);
    const [mTime, setMTime] = useState('12:00 - 08:00');
    const [midTime, setMidTime] = useState('13:00 - 11:00');
    const [eTime, setETime] = useState('17:00 - 13:00');

    // Reset times when toggling mode
    useEffect(() => {
        if (useThreePeriods) {
            setMTime('11:00 - 08:00');
            setETime('17:00 - 14:00');
        } else {
            setMTime('12:00 - 08:00');
            setETime('17:00 - 13:00');
        }
    }, [useThreePeriods]);

    const inputGroupStyle = (color) => ({
        position: 'relative',
        marginBottom: '0'
    });

    const labelStyle = (color) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '6px',
        fontWeight: '600',
        fontSize: '0.9rem',
        color: color || '#444'
    });

    const inputStyle = (borderColor) => ({
        width: '100%',
        padding: '11px 14px',
        border: `2px solid ${borderColor || '#e0e0e0'}`,
        borderRadius: '10px',
        fontSize: '0.95rem',
        fontFamily: 'inherit',
        direction: 'ltr',
        transition: 'all 0.3s ease',
        outline: 'none',
        background: '#fafbfc',
        boxSizing: 'border-box'
    });

    const periodCardStyle = (bgColor, borderColor) => ({
        background: bgColor,
        borderRadius: '12px',
        padding: '14px',
        border: `1px solid ${borderColor}`,
        marginBottom: '10px'
    });

    return e('div', { className: 'modal', style: { display: 'block' } },
        e('div', {
            className: 'modal-content', style: {
                maxWidth: '480px',
                borderRadius: '16px',
                padding: '0',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column'
            }
        },
            // Header with gradient
            e('div', {
                style: {
                    background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0
                }
            },
                e('h3', {
                    style: {
                        margin: 0,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '1.15rem',
                        fontWeight: '700'
                    }
                },
                    e('span', {
                        style: {
                            background: 'rgba(255,255,255,0.2)',
                            borderRadius: '10px',
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }, dangerouslySetInnerHTML: { __html: IconManager.get('calendar') }
                    }),
                    'إضافة يوم حراسة'
                ),
                e('span', {
                    onClick: onClose,
                    style: {
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '24px',
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                        lineHeight: '1',
                        fontWeight: '300'
                    },
                    onMouseEnter: (ev) => ev.target.style.color = 'white',
                    onMouseLeave: (ev) => ev.target.style.color = 'rgba(255,255,255,0.7)'
                }, 'أ—')
            ),

            // Body (scrollable)
            e('div', { style: { padding: '24px', overflowY: 'auto', flex: 1 } },
                // Date field
                e('div', { style: { marginBottom: '18px' } },
                    e('label', { style: labelStyle('var(--primary-color)') },
                        e(Icon, { name: 'calendar' }),
                        'تاريخ الامتحان'
                    ),
                    e('input', {
                        type: 'date',
                        value: date,
                        onChange: (ev) => setDate(ev.target.value),
                        style: { ...inputStyle('var(--secondary-color)'), fontWeight: '600' }
                    })
                ),

                // Periods System Selector
                e('div', { style: { marginBottom: '18px' } },
                    e('label', { style: labelStyle('var(--primary-color)') },
                        e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('clock') || '<i class="fas fa-clock"></i>' } }),
                        'نظام الفترات في اليوم'
                    ),
                    e('select', {
                        value: useThreePeriods ? '3' : '2',
                        onChange: (ev) => setUseThreePeriods(ev.target.value === '3'),
                        style: { ...inputStyle('var(--secondary-color)'), fontWeight: '600', cursor: 'pointer' }
                    },
                        e('option', { value: '2' }, 'نظام فترتين (صباح ومساء)'),
                        e('option', { value: '3' }, 'نظام 3 فترات (صباح، منتصف، مساء)')
                    )
                ),

                // Period cards
                // Morning
                hasMorning ? e('div', { style: { ...periodCardStyle('#fffbf0', '#ffe0a6'), position: 'relative' } },
                    e('span', {
                        onClick: () => setHasMorning(false),
                        style: { position: 'absolute', left: '14px', top: '14px', cursor: 'pointer', color: '#e74c3c', fontSize: '1.2rem', lineHeight: '1' },
                        title: 'حذف الفترة'
                    }, 'أ—'),
                    e('label', { style: labelStyle('#e67e22') },
                        e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('sun') } }),
                        'توقيت الصباح'
                    ),
                    e('input', {
                        type: 'text', value: mTime, onChange: (ev) => setMTime(ev.target.value),
                        style: inputStyle('#f0c36d'),
                        placeholder: '12:00 - 08:00'
                    })
                ) : e('div', {
                    onClick: () => setHasMorning(true),
                    style: { ...periodCardStyle('var(--bg-color)', '#ddd'), cursor: 'pointer', textAlign: 'center', color: 'var(--primary-color)', fontWeight: 'bold' }
                }, '+ إضافة فترة الصباح'),

                // Midday (conditional)
                useThreePeriods && e('div', { style: periodCardStyle('#ebf5ff', '#a8d4f5') },
                    e('label', { style: labelStyle('#2980b9') },
                        e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('sun') } }),
                        'توقيت المنتصف'
                    ),
                    e('input', {
                        type: 'text', value: midTime, onChange: (ev) => setMidTime(ev.target.value),
                        style: inputStyle('#7fb3d8'),
                        placeholder: '13:00 - 11:00'
                    })
                ),

                // Evening
                hasEvening ? e('div', { style: { ...periodCardStyle('#f5f0ff', '#d5c4f5'), position: 'relative' } },
                    e('span', {
                        onClick: () => setHasEvening(false),
                        style: { position: 'absolute', left: '14px', top: '14px', cursor: 'pointer', color: '#e74c3c', fontSize: '1.2rem', lineHeight: '1' },
                        title: 'حذف الفترة'
                    }, 'أ—'),
                    e('label', { style: labelStyle('#8e44ad') },
                        e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('moon') } }),
                        'توقيت المساء'
                    ),
                    e('input', {
                        type: 'text', value: eTime, onChange: (ev) => setETime(ev.target.value),
                        style: inputStyle('#b39ddb'),
                        placeholder: '17:00 - 13:00'
                    })
                ) : e('div', {
                    onClick: () => setHasEvening(true),
                    style: { ...periodCardStyle('var(--bg-color)', '#ddd'), cursor: 'pointer', textAlign: 'center', color: 'var(--primary-color)', fontWeight: 'bold' }
                }, '+ إضافة فترة المساء'),

                // Submit button
                e('button', {
                    onClick: () => onAdd(date, mTime, eTime, midTime, useThreePeriods, hasMorning, hasEvening),
                    style: {
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 15px rgba(39, 174, 96, 0.3)',
                        fontFamily: 'inherit',
                        marginTop: '8px'
                    },
                    onMouseEnter: (ev) => {
                        ev.target.style.transform = 'translateY(-2px)';
                        ev.target.style.boxShadow = '0 6px 20px rgba(39, 174, 96, 0.4)';
                    },
                    onMouseLeave: (ev) => {
                        ev.target.style.transform = 'translateY(0)';
                        ev.target.style.boxShadow = '0 4px 15px rgba(39, 174, 96, 0.3)';
                    }
                },
                    e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('check') } }),
                    'إضافة اليوم'
                )
            )
        )
    );
};

const ImportToolsModal = ({ isOpen, onClose, onExportSplit, onExportCombined, onImportExcel, onDeleteAll }) => {
    if (!isOpen) return null;

    const actionButtonStyle = (background, borderColor) => ({
        width: '100%',
        padding: '12px 14px',
        borderRadius: '12px',
        border: `1px solid ${borderColor}`,
        background,
        color: 'white',
        fontWeight: '800',
        fontFamily: 'inherit',
        fontSize: '0.95rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    });

    return e('div', { className: 'modal', style: { display: 'block' } },
        e('div', {
            className: 'modal-content', style: {
                maxWidth: '560px',
                borderRadius: '16px',
                padding: '0',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)'
            }
        },
            e('div', {
                style: {
                    background: 'linear-gradient(135deg, #1e293b 0%, #2563eb 100%)',
                    padding: '18px 22px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }
            },
                e('h3', {
                    style: {
                        margin: 0,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '1.08rem',
                        fontWeight: '800'
                    }
                },
                    e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('file-excel') } }),
                    'الاستيراد والتصدير'
                ),
                e('button', {
                    onClick: onClose,
                    style: {
                        background: 'rgba(255,255,255,0.18)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        width: '38px',
                        height: '38px',
                        fontSize: '1.3rem',
                        cursor: 'pointer'
                    }
                }, '×')
            ),
            e('div', {
                style: {
                    padding: '20px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }
            },
                e('div', {
                    style: {
                        background: '#f8fafc',
                        border: '1px solid #dbeafe',
                        borderRadius: '14px',
                        padding: '14px 16px',
                        color: '#334155',
                        lineHeight: '1.8',
                        fontWeight: '600'
                    }
                },
                    e('div', { style: { color: '#1d4ed8', fontWeight: '800', marginBottom: '6px' } }, 'طريقة الاستيراد'),
                    e('div', null, '1. حمّل نموذج Excel المناسب.'),
                    e('div', null, '2. املأ بيانات الأساتذة داخل الملف دون تغيير عناوين الأعمدة.'),
                    e('div', null, '3. احفظ الملف ثم اضغط على استيراد ملف Excel لإدراجه في الصفحة.')
                ),
                e('div', {
                    style: {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '10px'
                    }
                },
                    e('button', { type: 'button', onClick: onExportSplit, style: actionButtonStyle('linear-gradient(135deg, #e11d48, #be123c)', '#be123c') },
                        e(Icon, { name: 'file-excel' }),
                        'تصدير نموذج Excel 1'
                    ),
                    e('button', { type: 'button', onClick: onExportCombined, style: actionButtonStyle('linear-gradient(135deg, #64748b, #475569)', '#475569') },
                        e(Icon, { name: 'file-excel' }),
                        'تصدير نموذج Excel 2'
                    ),
                    e('button', { type: 'button', onClick: onImportExcel, style: actionButtonStyle('linear-gradient(135deg, #16a34a, #15803d)', '#15803d') },
                        e(Icon, { name: 'upload' }),
                        'استيراد ملف Excel'
                    ),
                    e('button', { type: 'button', onClick: onDeleteAll, style: actionButtonStyle('linear-gradient(135deg, #dc2626, #b91c1c)', '#b91c1c') },
                        e(Icon, { name: 'trash' }),
                        'حذف جميع الأساتذة'
                    )
                )
            )
        )
    );
};

const PrintNoteModal = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    const DEFAULT_NOTES = [
        'يُمنع تغيير قاعة أو مكان التأطير إلا بإذن مسبق من الإدارة.',
        'يُمنع السماح بخروج التلاميذ قبل انقضاء ثلاثة أرباع المدة الزمنية للاختبار.',
        'يُمنع على الأستاذ مغادرة قاعة الحراسة بغرض قراءة موضوع الاختبار .'
    ];

    const [notes, setNotes] = useState(DEFAULT_NOTES);
    const [templateType, setTemplateType] = useState(() => localStorage.getItem(STORAGE_KEYS.PRINT_TEMPLATE_TYPE) || '1');
    const [loaded, setLoaded] = useState(false);

    // Load saved notes from DB on first open
    useEffect(() => {
        if (isOpen && !loaded) {
            const loadNotes = async () => {
                try {
                    const savedNotes = await DB.get(STORAGE_KEYS.PRINT_NOTES);
                    if (savedNotes && Array.isArray(savedNotes) && savedNotes.length > 0) {
                        setNotes(savedNotes);
                    }
                } catch (err) {
                    console.warn('Could not load saved notes:', err);
                }
                setLoaded(true);
            };
            loadNotes();
        }
    }, [isOpen]);

    const addNote = () => {
        setNotes([...notes, '']);
    };

    const removeNote = (index) => {
        setNotes(notes.filter((_, i) => i !== index));
    };

    const updateNote = (index, value) => {
        const updated = [...notes];
        updated[index] = value;
        setNotes(updated);
    };

    const handleConfirm = async () => {
        const filteredNotes = notes.filter(n => n.trim() !== '');
        // Save notes to DB
        try {
            await DB.set(STORAGE_KEYS.PRINT_NOTES, filteredNotes);
            localStorage.setItem(STORAGE_KEYS.PRINT_NOTES, JSON.stringify(filteredNotes));
        } catch (err) {
            console.warn('Could not save notes:', err);
        }
        localStorage.setItem(STORAGE_KEYS.PRINT_TEMPLATE_TYPE, templateType);
        onConfirm(filteredNotes, templateType);
    };

    // Styles
    const modalOverlay = {
        display: 'flex', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        zIndex: 10000, justifyContent: 'center', alignItems: 'center'
    };
    const modalBox = {
        background: '#fff', borderRadius: '16px', width: '95%', maxWidth: '520px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
        animation: 'slideUp 0.3s ease-out'
    };
    const headerStyle = {
        background: 'linear-gradient(135deg, #2c3e50, #34495e)', color: '#fff',
        padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    };
    const bodyStyle = { padding: '25px', maxHeight: '50vh', overflowY: 'auto' };
    const noteRowStyle = {
        display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px',
        background: 'var(--bg-color)', borderRadius: '10px', padding: '10px 12px',
        border: '1px solid #e9ecef', transition: 'all 0.2s'
    };
    const noteInputStyle = {
        flex: 1, border: '1px solid #dee2e6', borderRadius: '8px', padding: '10px 12px',
        fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none',
        transition: 'border-color 0.2s'
    };
    const deleteBtnStyle = {
        background: '#fee2e2', border: 'none', color: '#dc2626', borderRadius: '8px',
        width: '36px', height: '36px', cursor: 'pointer', fontSize: '1.1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s', flexShrink: 0
    };
    const addBtnStyle = {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        width: '100%', padding: '10px', background: '#f0fdf4', border: '2px dashed #86efac',
        borderRadius: '10px', color: '#16a34a', fontWeight: '600', cursor: 'pointer',
        fontSize: '0.95rem', transition: 'all 0.2s', fontFamily: 'inherit'
    };
    const footerStyle = {
        display: 'flex', gap: '10px', justifyContent: 'flex-end',
        padding: '15px 25px', borderTop: '1px solid #f1f5f9', background: '#fafbfc'
    };
    const cancelBtnStyle = {
        padding: '10px 24px', borderRadius: '10px', border: '1px solid var(--border-color)',
        background: '#fff', color: '#64748b', fontWeight: '600', cursor: 'pointer',
        fontSize: '0.95rem', transition: 'all 0.2s', fontFamily: 'inherit'
    };
    const printBtnStyle = {
        padding: '10px 28px', borderRadius: '10px', border: 'none',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
        fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem',
        display: 'flex', alignItems: 'center', gap: '8px',
        transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
        fontFamily: 'inherit'
    };

    return e('div', { style: modalOverlay, onClick: (ev) => { if (ev.target === ev.currentTarget) onClose(); } },
        e('div', { style: modalBox },
            // Header
            e('div', { style: headerStyle },
                e('h3', { style: { margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' } },
                    e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('print') } }),
                    'ملاحظات القصاصات'
                ),
                e('span', {
                    onClick: onClose,
                    style: { cursor: 'pointer', fontSize: '1.5rem', opacity: 0.7, lineHeight: 1 }
                }, '×')
            ),

            // Body
            e('div', { style: bodyStyle },
                                // Template Selector
                e('div', { style: { marginBottom: '20px', padding: '15px', background: 'var(--bg-color)', borderRadius: '10px', border: '1px solid #e9ecef' } },
                    e('label', { style: { display: 'block', marginBottom: '10px', fontWeight: '700', color: '#334155', fontSize: '0.95rem' } }, 'تنسيق قسيمة التأطير:'),
                    e('div', { style: { display: 'flex', gap: '20px', flexWrap: 'wrap' } },
                        e('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' } },
                            e('input', {
                                type: 'radio',
                                name: 'printTemplate',
                                value: '1',
                                checked: templateType === '1',
                                onChange: (ev) => setTemplateType(ev.target.value)
                            }),
                            'النموذج 1 (الفترات في أعمدة - افتراضي)'
                        ),
                        e('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' } },
                            e('input', {
                                type: 'radio',
                                name: 'printTemplate',
                                value: '2',
                                checked: templateType === '2',
                                onChange: (ev) => setTemplateType(ev.target.value)
                            }),
                            'النموذج 2 (الأيام في أعمدة)'
                        ),
                        e('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' } },
                            e('input', {
                                type: 'radio',
                                name: 'printTemplate',
                                value: '3',
                                checked: templateType === '3',
                                onChange: (ev) => setTemplateType(ev.target.value)
                            }),
                            'النموذج 3 (رسمي - 3 قصاصات في الصفحة)'
                        ),
                        e('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' } },
                            e('input', {
                                type: 'radio',
                                name: 'printTemplate',
                                value: '4',
                                checked: templateType === '4',
                                onChange: (ev) => setTemplateType(ev.target.value)
                            }),
                            'النموذج 4 (حديث وجذاب)'
                        ),
                    )
                ),

                // Notes section
                e('label', { style: { display: 'block', marginBottom: '10px', fontWeight: '700', color: '#334155', fontSize: '0.95rem' } }, 'الملاحظات أسفل القصاصة:'),

                // Notes list
                notes.map((note, idx) =>
                    e('div', { key: idx, style: noteRowStyle },
                        e('span', { style: { color: '#94a3b8', fontWeight: 'bold', fontSize: '0.85rem', flexShrink: 0 } }, (idx + 1) + '.'),
                        e('input', {
                            type: 'text', value: note,
                            onChange: (ev) => updateNote(idx, ev.target.value),
                            placeholder: 'اكتب ملاحظة...',
                            style: noteInputStyle,
                            onFocus: (ev) => { ev.target.style.borderColor = '#3b82f6'; },
                            onBlur: (ev) => { ev.target.style.borderColor = '#dee2e6'; }
                        }),
                        e('button', {
                            onClick: () => removeNote(idx),
                            style: deleteBtnStyle,
                            title: 'حذف الملاحظة',
                            onMouseEnter: (ev) => { ev.target.style.background = '#fca5a5'; },
                            onMouseLeave: (ev) => { ev.target.style.background = '#fee2e2'; }
                        }, '×')
                    )
                ),

                // Add note button
                e('button', {
                    onClick: addNote,
                    style: addBtnStyle,
                    onMouseEnter: (ev) => { ev.target.style.background = '#dcfce7'; ev.target.style.borderColor = '#4ade80'; },
                    onMouseLeave: (ev) => { ev.target.style.background = '#f0fdf4'; ev.target.style.borderColor = '#86efac'; }
                }, '+ إضافة ملاحظة')
            ),

            // Footer
            e('div', { style: footerStyle },
                e('button', {
                    onClick: onClose, style: cancelBtnStyle,
                    onMouseEnter: (ev) => { ev.target.style.background = '#f1f5f9'; },
                    onMouseLeave: (ev) => { ev.target.style.background = '#fff'; }
                }, 'إلغاء'),
                e('button', {
                    onClick: handleConfirm, style: printBtnStyle,
                    onMouseEnter: (ev) => { ev.target.style.transform = 'translateY(-1px)'; ev.target.style.boxShadow = '0 6px 16px rgba(37,99,235,0.4)'; },
                    onMouseLeave: (ev) => { ev.target.style.transform = 'translateY(0)'; ev.target.style.boxShadow = '0 4px 12px rgba(37,99,235,0.3)'; }
                },
                    e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('print') } }),
                    'طباعة القصاصات'
                )
            )
        )
    );
};

const ScheduleTable = ({ teachers, days, schedule, reserveSchedule, absenceSchedule, roomAssignments, showRooms, onToggleAssignment, onToggleAbsenceAssignment, settings }) => {
    if (!teachers.length || !days.length) {
        return e('div', { id: 'scheduleTableContainer' },
            e('p', { style: { textAlign: 'center', color: '#888', padding: '40px' } },
                'أضف الأساتذة وأيام الحراسة أولاً، ثم اضغط "توليد الجدول تلقائياً"')
        );
    }

    const activeTeachers = sortTeachersForScheduleOrder(teachers.filter(t => !t.isExempt));

    const getVisiblePeriodsForDay = (day) => {
        const periods = [];
        if (day.morning) periods.push('morning');
        if (day.midday) periods.push('midday');
        if (day.evening) periods.push('evening');

        return periods.filter(p => {
            const pData = day[p] || {};
            const subjectList = (pData.subjects || []).filter(s => s && s.trim() !== '');
            const hasSub = subjectList.length > 0;
            return hasSub || periodSupportsDuty(pData);
        });
    };

    const getAssignmentIds = (source, dayId, period, excludedIds = []) =>
        normalizeAssignmentList(source && source[`${dayId}_${period}`], excludedIds);
    const getAssignmentCount = (source, dayId, period, excludedIds = []) =>
        getAssignmentIds(source, dayId, period, excludedIds).length;
    const periodSupportsDuty = (periodData) => {
        const requiredTeachers = periodData && periodData.requiredTeachers !== undefined ? Number(periodData.requiredTeachers) : 0;
        const reserveTeachers = periodData && periodData.reserveTeachers !== undefined ? Number(periodData.reserveTeachers) : 0;
        return requiredTeachers > 0 || reserveTeachers > 0;
    };

    const totalGuardAssignments = days.reduce((sum, day) => {
        return sum + getVisiblePeriodsForDay(day).reduce((daySum, period) => daySum + getAssignmentCount(schedule, day.id, period), 0);
    }, 0);

    const totalReserveAssignments = days.reduce((sum, day) => {
        return sum + getVisiblePeriodsForDay(day).reduce((daySum, period) => {
            const guardIds = getAssignmentIds(schedule, day.id, period);
            return daySum + getAssignmentCount(reserveSchedule, day.id, period, guardIds);
        }, 0);
    }, 0);

    const totalAbsenceAssignments = days.reduce((sum, day) => {
        return sum + getVisiblePeriodsForDay(day).reduce((daySum, period) => {
            const guardIds = getAssignmentIds(schedule, day.id, period);
            const reserveIds = getAssignmentIds(reserveSchedule, day.id, period, guardIds);
            return daySum + getAssignmentCount(absenceSchedule, day.id, period, guardIds.concat(reserveIds));
        }, 0);
    }, 0);

    return e('div', { className: 'schedule-section', style: { overflowX: 'auto' } },
        e('table', { className: 'schedule-table', id: 'mainScheduleTable' },
            e('thead', {},
                e('tr', {},
                    e('th', { rowSpan: 2 }, '#'),
                    e('th', { rowSpan: 2 }, 'الأستاذ'),
                    days.map(d => {
                        const visiblePeriods = getVisiblePeriodsForDay(d);
                        return e('th', { key: d.id, colSpan: visiblePeriods.length, className: 'day-header-cell', style: { display: visiblePeriods.length === 0 ? 'none' : 'table-cell', borderLeft: '3px solid #333' } }, formatDateShort(d.date).full);
                    }),
                    e('th', { rowSpan: 2, className: 'total-col' }, 'المجموع')
                ),
                                e('tr', {},
                    days.flatMap(d => {
                        return getVisiblePeriodsForDay(d).map((p, pIndex, filteredPeriods) => {
                            const pData = d[p] || {};
                            const subjectList = (pData.subjects || []).filter(s => s && s.trim() !== '');
                            const subs = subjectList.join(' - ');
                            const guardIds = getAssignmentIds(schedule, d.id, p);
                            const reserveIds = getAssignmentIds(reserveSchedule, d.id, p, guardIds);
                            const count = guardIds.length;
                            const reserveCount = reserveIds.length;
                            const absenceCount = getAssignmentCount(absenceSchedule, d.id, p, guardIds.concat(reserveIds));
                            const req = pData.requiredTeachers !== undefined ? pData.requiredTeachers : 2;

                            let label = 'ف.صباحية';
                            if (p === 'midday') label = 'ف.منتصف';
                            if (p === 'evening') label = 'ف.مسائية';

                            const isDayEnd = pIndex === filteredPeriods.length - 1;

                            let headerStyle = isDayEnd ? { borderLeft: '3px solid #333' } : {};
                            if (p === 'morning') { headerStyle.backgroundColor = '#fef5e7'; headerStyle.color = '#d35400'; }
                            else if (p === 'midday') { headerStyle.backgroundColor = '#ebf5fb'; headerStyle.color = '#2980b9'; }
                            else { headerStyle.backgroundColor = '#f4ecf7'; headerStyle.color = '#8e44ad'; }

                            return e('th', { key: `${d.id}_${p}`, className: 'period-header', title: subs, style: headerStyle },
                                e('div', {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '1px',
                                        paddingBottom: '3px',
                                        marginBottom: '3px',
                                        borderBottom: '1px solid rgba(0,0,0,0.2)'
                                    }
                                },
                                    e('span', { style: { fontWeight: '800', whiteSpace: 'nowrap' } }, label),
                                    e('span', { style: { fontSize: '0.74em', lineHeight: '1.05' } },
                                        `${count}/${req}`
                                        + (reserveCount > 0 ? ` + ${reserveCount}احتياط` : '')
                                        + (absenceCount > 0 ? ` + ${absenceCount}غياب` : '')
                                    )
                                ),
                                e('div', { style: { fontSize: '0.7em', fontWeight: 'normal', lineHeight: '1.2' } }, subs || '-')
                            );
                        });
                    })
                )
            ),
            e('tbody', {},
                activeTeachers.map((t, idx) => {
                    let total = 0;
                    return e('tr', { key: t.id },
                        e('td', { style: { textAlign: 'center', fontWeight: 'bold' } }, idx + 1),
                        e('td', { className: 'teacher-name' },
                            t.surname + ' ' + t.name,
                            e('br'),
                            e('small', { style: { color: '#888' } }, 
                                (t.subjects[0] || '-'),
                                t.rank ? e('span', { style: { color: getRankColor(t.rank), fontWeight: '700' } }, ` (${shortenRank(t.rank)})`) : ''
                            )
                        ),
                        days.flatMap(d => {
                            return getVisiblePeriodsForDay(d).map((p, pIndex, filteredPeriods) => {
                                const key = `${d.id}_${p}`;
                                const guardIds = getAssignmentIds(schedule, d.id, p);
                                const reserveIds = getAssignmentIds(reserveSchedule, d.id, p, guardIds);
                                const absenceIds = getAssignmentIds(absenceSchedule, d.id, p, guardIds.concat(reserveIds));
                                const teacherId = normalizeTeacherId(t.id);
                                const isAssigned = guardIds.includes(teacherId);
                                const isReserve = reserveIds.includes(teacherId);
                                const isAbsentCell = absenceIds.includes(teacherId);
                                if (isAssigned || isReserve) total++;

                                const pData = d[p] || {};
                                const subjectList = (pData.subjects || []).filter(s => s && s.trim() !== '');
                                const hasSub = subjectList.length > 0;
                                const isActive = hasSub || periodSupportsDuty(pData);
                                const canMarkAbsence = periodSupportsDuty(pData) || isAbsentCell;

                                // Room display logic
                                let cellContent = '';
                                let cellStyle = { textAlign: 'center', cursor: 'pointer' };

                                if (p === 'morning') {
                                    cellStyle.backgroundColor = '#fef5e7';
                                } else if (p === 'midday') {
                                    cellStyle.backgroundColor = '#ebf5fb';
                                } else {
                                    cellStyle.backgroundColor = '#f4ecf7';
                                }

                                // Check for room assignment
                                const roomData = showRooms
                                    ? getEffectiveRoomAssignmentData(roomAssignments, key, t.id, isAssigned, isReserve)
                                    : null;

                                if (isAssigned) {
                                    cellContent = (settings && settings.checkMark) || '✓';
                                    if (p === 'morning') {
                                        cellStyle.backgroundColor = '#e67e22';
                                        cellStyle.color = 'var(--card-bg)';
                                    } else if (p === 'midday') {
                                        cellStyle.backgroundColor = 'var(--secondary-color)';
                                        cellStyle.color = 'var(--card-bg)';
                                    } else {
                                        cellStyle.backgroundColor = '#9b59b6';
                                        cellStyle.color = 'var(--card-bg)';
                                    }
                                } else if (isReserve) {
                                    cellContent = 'احتياط';
                                    cellStyle.fontWeight = 'bold';
                                    cellStyle.fontSize = '0.8em';
                                    cellStyle.color = '#c0392b';
                                    cellStyle.backgroundColor = '#fadbd8';
                                } else if (isAbsentCell) {
                                    cellContent = 'غ';
                                    cellStyle.fontWeight = 'bold';
                                    cellStyle.fontSize = '0.95em';
                                    cellStyle.color = '#ffffff';
                                    cellStyle.backgroundColor = '#dc2626';
                                }

                                if ((isAssigned || isReserve) && roomData) {
                                    if (roomData.isReserve) {
                                        cellContent = 'احتياط';
                                        cellStyle.fontWeight = 'bold';
                                        cellStyle.fontSize = '0.8em';
                                        cellStyle.color = '#c0392b';
                                        cellStyle.backgroundColor = '#fadbd8';
                                    } else if (roomData.room) {
                                        cellContent = getLocationLabelShort(roomData.room);
                                        cellStyle.fontWeight = 'bold';
                                        cellStyle.fontSize = '0.9em';
                                        cellStyle.color = '#000000';
                                        if (isReserve) {
                                            cellStyle.color = '#c0392b';
                                        }
                                    }
                                }

                                const isDayEnd = pIndex === filteredPeriods.length - 1;

                                return e('td', {
                                    key: key,
                                    className: `check-cell ${(isAssigned || isReserve || isAbsentCell) ? 'checked' : ''} ${isAbsentCell ? 'absent-cell' : ''} ${!isActive ? 'disabled' : ''} ${roomData && roomData.room ? 'room-assigned' : ''}`,
                                    style: isDayEnd ? { ...cellStyle, borderLeft: '3px solid #333' } : cellStyle,
                                    onClick: isActive ? () => onToggleAssignment(d.id, p, t.id) : undefined,
                                    onContextMenu: isActive ? (ev) => {
                                        ev.preventDefault();
                                        if (onToggleAbsenceAssignment) onToggleAbsenceAssignment(d.id, p, t.id, canMarkAbsence);
                                    } : undefined,
                                    title: hasSub
                                        ? ((d[p]?.subjects || []).join('+') + (isAbsentCell ? ' - غياب' : (isReserve ? ' - احتياط' : (isAssigned ? ' - حراسة' : ''))) + ' - زر أيمن: غياب')
                                        : (isActive ? 'فترة بدون مواد' : 'لا يوجد امتحان')
                                }, cellContent);
                            });
                        }),
                        e('td', { className: 'total-col' }, total)
                    );
                }),
                e('tr', { key: 'total-row', className: 'total-row guard-total-row' },
                    e('td', { colSpan: 2, style: { textAlign: 'right', paddingRight: '15px' } }, 'إجمالي الحراس'),
                    days.flatMap(d => {
                        return getVisiblePeriodsForDay(d).map((p, pIndex, filteredPeriods) => {
                            const isDayEnd = pIndex === filteredPeriods.length - 1;
                            const count = getAssignmentCount(schedule, d.id, p);

                            let totalStyle = isDayEnd
                                ? { borderLeft: '3px solid #333', textAlign: 'center', fontWeight: 'bold' }
                                : { textAlign: 'center', fontWeight: 'bold' };

                            return e('td', {
                                key: `total_${d.id}_${p}`,
                                style: totalStyle
                            }, count);
                        });
                    }),
                    e('td', { className: 'total-col', style: { fontWeight: 'bold' } }, totalGuardAssignments)
                ),
                e('tr', { key: 'reserve-total-row', className: 'total-row reserve-total-row' },
                    e('td', { colSpan: 2, style: { textAlign: 'right', paddingRight: '15px' } }, 'إجمالي الاحتياط'),
                    days.flatMap(d => {
                        return getVisiblePeriodsForDay(d).map((p, pIndex, filteredPeriods) => {
                            const isDayEnd = pIndex === filteredPeriods.length - 1;
                            const guardIds = getAssignmentIds(schedule, d.id, p);
                            const reserveCount = getAssignmentCount(reserveSchedule, d.id, p, guardIds);
                            const reserveStyle = isDayEnd
                                ? { borderLeft: '3px solid #333', textAlign: 'center', fontWeight: 'bold' }
                                : { textAlign: 'center', fontWeight: 'bold' };

                            return e('td', {
                                key: `reserve_total_${d.id}_${p}`,
                                style: reserveStyle
                            }, reserveCount);
                        });
                    }),
                    e('td', { className: 'total-col', style: { fontWeight: 'bold' } }, totalReserveAssignments)
                ),
                e('tr', { key: 'absence-total-row', className: 'total-row absence-total-row' },
                    e('td', { colSpan: 2, style: { textAlign: 'right', paddingRight: '15px' } }, 'إجمالي الغياب'),
                    days.flatMap(d => {
                        return getVisiblePeriodsForDay(d).map((p, pIndex, filteredPeriods) => {
                            const isDayEnd = pIndex === filteredPeriods.length - 1;
                            const guardIds = getAssignmentIds(schedule, d.id, p);
                            const reserveIds = getAssignmentIds(reserveSchedule, d.id, p, guardIds);
                            const absenceCount = getAssignmentCount(absenceSchedule, d.id, p, guardIds.concat(reserveIds));
                            const absenceStyle = isDayEnd
                                ? { borderLeft: '3px solid #333', textAlign: 'center', fontWeight: 'bold', color: '#9a3412', backgroundColor: '#fff7ed' }
                                : { textAlign: 'center', fontWeight: 'bold', color: '#9a3412', backgroundColor: '#fff7ed' };

                            return e('td', {
                                key: `absence_total_${d.id}_${p}`,
                                style: absenceStyle
                            }, absenceCount);
                        });
                    }),
                    e('td', { className: 'total-col', style: { fontWeight: 'bold', color: '#9a3412' } }, totalAbsenceAssignments)
                )
            )
        )
    );
};

const FloatingTotals = ({ days, schedule, reserveSchedule }) => {
    if (!days.length) return null;

    const getStatusColor = (assigned, required) => {
        if (required === 0) return '#7f8c8d';
        if (assigned === required) return '#27ae60';
        if (assigned > required) return '#e67e22';
        return '#c0392b';
    };

    const getAssignmentIds = (source, key, excludedIds = []) =>
        normalizeAssignmentList(source && source[key], excludedIds);

    return e('div', {
        className: 'floating-totals-bar no-print',
        style: {
            position: 'sticky',
            bottom: '0',
            zIndex: 100,
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            alignItems: 'center',
            background: '#fef9e7',
            borderTop: '3px solid #f39c12',
            padding: '4px 15px',
            boxShadow: '0 -4px 15px rgba(0, 0, 0, 0.15)',
            margin: '0 -20px -20px -20px',
            borderRadius: '0 0 12px 12px',
            fontSize: '0.75rem'
        }
    },
        days.map(d => {
            let mContent = null;
            if (d.morning) {
                const mReq = d.morning.requiredTeachers !== undefined ? Number(d.morning.requiredTeachers) : 2;
                const mResReq = d.morning.reserveTeachers !== undefined ? Number(d.morning.reserveTeachers) : 0;
                const mKey = `${d.id}_morning`;
                const mGuardIds = getAssignmentIds(schedule, mKey);
                const mReserveIds = getAssignmentIds(reserveSchedule, mKey, mGuardIds);
                const mAssigned = mGuardIds.length;
                const mResAssigned = mReserveIds.length;
                
                mContent = e('span', { style: { color: '#f39c12', display: 'flex', alignItems: 'center', gap: '3px' } },
                    e(Icon, { name: 'sun' }), 
                    e('strong', { style: { color: getStatusColor(mAssigned, mReq) } }, `${mAssigned}/${mReq}`),
                    mResReq > 0 ? e('small', { style: { color: getStatusColor(mResAssigned, mResReq), fontSize: '0.85em', marginLeft: '3px' } }, `+${mResAssigned}/${mResReq}ح`) : null
                );
            }

            let eContent = null;
            if (d.evening) {
                const eReq = d.evening.requiredTeachers !== undefined ? Number(d.evening.requiredTeachers) : 2;
                const eResReq = d.evening.reserveTeachers !== undefined ? Number(d.evening.reserveTeachers) : 0;
                const eKey = `${d.id}_evening`;
                const eGuardIds = getAssignmentIds(schedule, eKey);
                const eReserveIds = getAssignmentIds(reserveSchedule, eKey, eGuardIds);
                const eAssigned = eGuardIds.length;
                const eResAssigned = eReserveIds.length;
                
                eContent = e(React.Fragment, {},
                    (d.morning || d.midday) && e('span', { style: { color: '#ddd' } }, '|'),
                    e('span', { style: { color: '#8e44ad', display: 'flex', alignItems: 'center', gap: '3px' } },
                        e(Icon, { name: 'moon' }), 
                        e('strong', { style: { color: getStatusColor(eAssigned, eReq) } }, `${eAssigned}/${eReq}`),
                        eResReq > 0 ? e('small', { style: { color: getStatusColor(eResAssigned, eResReq), fontSize: '0.85em', marginLeft: '3px' } }, `+${eResAssigned}/${eResReq}ح`) : null
                    )
                );
            }

            let midContent = null;
            if (d.midday) {
                const midReq = d.midday.requiredTeachers !== undefined ? Number(d.midday.requiredTeachers) : 2;
                const midResReq = d.midday.reserveTeachers !== undefined ? Number(d.midday.reserveTeachers) : 0;
                const midKey = `${d.id}_midday`;
                const midGuardIds = getAssignmentIds(schedule, midKey);
                const midReserveIds = getAssignmentIds(reserveSchedule, midKey, midGuardIds);
                const midAssigned = midGuardIds.length;
                const midResAssigned = midReserveIds.length;
                
                midContent = e(React.Fragment, {},
                    d.morning && e('span', { style: { color: '#ddd' } }, '|'),
                    e('span', { style: { color: '#e67e22', display: 'flex', alignItems: 'center', gap: '3px' } },
                        e(Icon, { name: 'sun' }), 
                        e('strong', { style: { color: getStatusColor(midAssigned, midReq) } }, `${midAssigned}/${midReq}`),
                        midResReq > 0 ? e('small', { style: { color: getStatusColor(midResAssigned, midResReq), fontSize: '0.85em', marginLeft: '3px' } }, `+${midResAssigned}/${midResReq}ح`) : null
                    )
                );
            }

            return e('div', { key: d.id, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', padding: '2px 5px', background: 'white', borderRadius: '5px', border: '1px solid #ddd', minWidth: '85px' } },
                e('div', { style: { fontWeight: 'bold', color: 'var(--primary-color)', borderBottom: '1px solid #eee', paddingBottom: '1px', width: '100%', textAlign: 'center', fontSize: '0.75rem' } }, formatDateShort(d.date).full),
                e('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' } },

                    mContent,
                    midContent,
                    eContent
                )
            );
        })
    );
};

// MAIN APP COMPONENT

// ======================

const App = () => {

    const [teacherDirectory, setTeacherDirectory] = useState([]);

    const [teachers, setTeachers] = useState([]);

    const [days, setDays] = useState([]);

    const [schedule, setSchedule] = useState({});

    const [reserveSchedule, setReserveSchedule] = useState({});

    const [absenceSchedule, setAbsenceSchedule] = useState({});

    const [roomAssignments, setRoomAssignments] = useState({});

    const [trimester, setTrimester] = useState('1');

    const [settings, setSettings] = useState({
        teachersPerPeriod: 2,
        numLabs: 0,
        numWorkshops: 0,
        checkMark: '✓',
        customExamStage: 'middle'
    });

    const [globalStage, setGlobalStage] = useState('middle'); // Global Education Stage from Settings
    const [officialCenterData, setOfficialCenterData] = useState(() => getOfficialCenterDisplay({}, 'custom'));
    const [officialExamTypeDraft, setOfficialExamTypeDraft] = useState('custom');
    const [customExamStageDraft, setCustomExamStageDraft] = useState('middle');

    const [isAddDayModalOpen, setIsAddDayModalOpen] = useState(false);
    const [showTeachersTable, setShowTeachersTable] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [isImportToolsModalOpen, setIsImportToolsModalOpen] = useState(false);

    const [pendingPrintData, setPendingPrintData] = useState(null);

    const [toast, setToast] = useState(null);
    const [showRooms, setShowRooms] = useState(false);
    const [printOrientation, setPrintOrientation] = useState(() => localStorage.getItem(STORAGE_KEYS.PRINT_ORIENTATION) || 'landscape');
    const effectiveStage = getPreferredStageForTrimester(trimester, globalStage, settings.customExamStage || customExamStageDraft || 'middle');

    // Initial Load

    useEffect(() => { if (window.IconManager) { IconManager.render(); IconManager.observe(); } }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.PRINT_ORIENTATION, printOrientation);
    }, [printOrientation]);

    useEffect(() => {
        if (['custom', 'blanc', 'blanc_lycee'].includes(String(trimester))) {
            setOfficialExamTypeDraft(String(trimester));
        } else if (['1', '2', '3'].includes(String(trimester))) {
            setOfficialExamTypeDraft('custom');
        }
    }, [trimester]);

    useEffect(() => {
        const nextStage = settings.customExamStage === 'secondary' ? 'secondary' : 'middle';
        setCustomExamStageDraft(nextStage);
    }, [settings.customExamStage]);

    // Helper to load data for a specific trimester
    const loadTrimesterData = async (tri) => {
        const keys = getTrimesterKeys(tri);

        let triDays = await DB.get(keys.DAYS);
        if (!triDays) {
            try { triDays = JSON.parse(localStorage.getItem(keys.DAYS)); } catch (e) { }
        }
        triDays = triDays || [];

        let triSchedule = await DB.get(keys.SCHEDULE);
        if (!triSchedule) {
            try { triSchedule = JSON.parse(localStorage.getItem(keys.SCHEDULE)); } catch (e) { }
        }
        triSchedule = triSchedule || {};

        let triAbsenceSchedule = await DB.get(keys.ABSENCE_SCHEDULE);
        if (!triAbsenceSchedule) {
            try { triAbsenceSchedule = JSON.parse(localStorage.getItem(keys.ABSENCE_SCHEDULE)); } catch (e) { }
        }
        triAbsenceSchedule = triAbsenceSchedule || {};

        let triRooms = await DB.get(keys.ROOM_ASSIGNMENTS);
        if (!triRooms) {
            try { triRooms = JSON.parse(localStorage.getItem(keys.ROOM_ASSIGNMENTS)); } catch (e) { }
        }
        triRooms = triRooms || {};

        let triExemptions = await DB.get(keys.EXEMPTIONS);
        if (!triExemptions) {
            try { triExemptions = JSON.parse(localStorage.getItem(keys.EXEMPTIONS)); } catch (e) { }
        }
        triExemptions = Array.isArray(triExemptions) ? triExemptions : [];

        let triAbsences = await DB.get(keys.ABSENCES);
        if (!triAbsences) {
            try { triAbsences = JSON.parse(localStorage.getItem(keys.ABSENCES)); } catch (e) { }
        }
        triAbsences = Array.isArray(triAbsences) ? triAbsences : [];

        let triReserveSchedule = await DB.get(keys.RESERVE_SCHEDULE);
        if (!triReserveSchedule) {
            try { triReserveSchedule = JSON.parse(localStorage.getItem(keys.RESERVE_SCHEDULE)); } catch (e) { }
        }
        triReserveSchedule = triReserveSchedule || {};

        return {
            days: triDays,
            schedule: triSchedule,
            reserveSchedule: triReserveSchedule,
            absenceSchedule: triAbsenceSchedule,
            roomAssignments: triRooms,
            exemptTeacherIds: triExemptions,
            absentTeacherIds: triAbsences
        };
    };

    useEffect(() => {

        const load = async () => {

            try {

                // Auth Check
                if (window.Auth) {
                    await window.Auth.checkAuth();
                }

                // Load Data

                if (typeof DB === 'undefined') {

                    showToast('خطأ: قاعدة البيانات غير جاهزة (DB undefined)', 'error');

                    return;

                }

                // Pre-load Room Labels into Global Cache
                try {
                    await migrateLegacyNamespaceIfNeeded();

                    let periodRoomsData = await DB.get(STORAGE_KEYS.PERIOD_ROOMS);
                    if (!periodRoomsData) {
                        const saved = localStorage.getItem(STORAGE_KEYS.PERIOD_ROOMS);
                        if (saved) periodRoomsData = JSON.parse(saved);
                    }
                    if (periodRoomsData) hydrateGlobalRoomCache(periodRoomsData);
                } catch (cacheErr) { console.warn("Failed to load room cache:", cacheErr); }

                // Try to get teachers from DB, fallback to LocalStorage

                let centralTeachers = await DB.getExamProctors();
                centralTeachers = Array.isArray(centralTeachers)
                    ? centralTeachers.filter((teacher) => !looksLikeLegacyTeacherRecord(teacher))
                    : [];

                let localSettings = await DB.get(STORAGE_KEYS.SETTINGS);

                if (!localSettings) {

                    try {

                        localSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS));

                    } catch (e) { }

                }

                // Load Global Institution Settings for Stage

                let institutionSettings = await DB.get('institutionSettings') || {};
                let localTrimester = await DB.get(STORAGE_KEYS.TRIMESTER) || '1';
                const currentOfficialCenterData = await getOfficialCenterData(localTrimester);

                setGlobalStage(institutionSettings.educationStage || 'middle');
                setOfficialCenterData(currentOfficialCenterData);

                setOfficialExamTypeDraft(['custom', 'blanc', 'blanc_lycee'].includes(String(localTrimester)) ? String(localTrimester) : 'custom');

                const baseMappedTeachers = centralTeachers.map(t => ({

                    id: t.id,

                    surname: t.last_name || '',

                    name: t.first_name || '',

                    subjects: t.subject ? [t.subject] : [],

                    institution: t.institution || '',

                    rank: t.rank || ''

                }));

                // === Migration: check if per-trimester data exists ===
                const migrationDone = await DB.get(STORAGE_KEYS.MIGRATION_DONE);
                if (!migrationDone) {
                    // Check for old flat data
                    let oldDays = await DB.get(STORAGE_KEYS.DAYS);
                    if (!oldDays) { try { oldDays = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAYS)); } catch (e) { } }
                    let oldSchedule = await DB.get(STORAGE_KEYS.SCHEDULE);
                    if (!oldSchedule) { try { oldSchedule = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULE)); } catch (e) { } }
                    let oldRooms = await DB.get(STORAGE_KEYS.ROOM_ASSIGNMENTS);
                    if (!oldRooms) { try { oldRooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOM_ASSIGNMENTS)); } catch (e) { } }

                    const hasOldData = (oldDays && oldDays.length > 0) || (oldSchedule && Object.keys(oldSchedule).length > 0);

                    if (hasOldData) {
                        // Ask user which trimester to associate data with
                        const result = await Swal.fire({
                            title: 'ترحيل جدول الحراسة',
                            html: '<p style="font-size:1rem;margin-bottom:10px;">تم تحديث النظام ليدعم <strong>جدول حراسة مستقل لكل فصل</strong>.</p>' +
                                '<p style="font-size:0.95rem;color:#555;">يوجد جدول حراسة سابق. إلى أي فصل تريد ربطه؟</p>',
                            icon: 'question',
                            input: 'select',
                            inputOptions: {
                                '1': 'الفصل الأول',
                                '2': 'الفصل الثاني',
                                '3': 'الفصل الثالث'
                            },
                            inputValue: localTrimester,
                            inputPlaceholder: 'اختر الفصل',
                            showCancelButton: false,
                            confirmButtonText: 'تأكيد',
                            allowOutsideClick: false,
                            allowEscapeKey: false
                        });

                        const chosenTri = result.value || '1';
                        const targetKeys = getTrimesterKeys(chosenTri);

                        if (oldDays && oldDays.length > 0) {
                            await DB.set(targetKeys.DAYS, oldDays);
                            localStorage.setItem(targetKeys.DAYS, JSON.stringify(oldDays));
                        }
                        if (oldSchedule && Object.keys(oldSchedule).length > 0) {
                            await DB.set(targetKeys.SCHEDULE, oldSchedule);
                            localStorage.setItem(targetKeys.SCHEDULE, JSON.stringify(oldSchedule));
                        }
                        if (oldRooms && Object.keys(oldRooms).length > 0) {
                            await DB.set(targetKeys.ROOM_ASSIGNMENTS, oldRooms);
                            localStorage.setItem(targetKeys.ROOM_ASSIGNMENTS, JSON.stringify(oldRooms));
                        }

                        // Update trimester to the chosen one
                        localTrimester = chosenTri;
                        await DB.set(STORAGE_KEYS.TRIMESTER, chosenTri);
                        localStorage.setItem(STORAGE_KEYS.TRIMESTER, chosenTri);

                        const triNames = { '1': 'الفصل الأول', '2': 'الفصل الثاني', '3': 'الفصل الثالث', 'custom': 'امتحان آخر', 'blanc': 'شهادة التعليم المتوسط', 'blanc_lycee': 'شهادة البكالوريا' };
                        showToast(`تم ربط الجدول بـ ${triNames[chosenTri]} بنجاح`, 'success');
                        console.log(`[Supervision] Migrated flat data to Trimester ${chosenTri}`);
                    }

                    // Mark migration as done (even if no data existed)
                    await DB.set(STORAGE_KEYS.MIGRATION_DONE, true);
                    localStorage.setItem(STORAGE_KEYS.MIGRATION_DONE, 'true');
                }

                const exemptionsMigrationDone = await DB.get(STORAGE_KEYS.EXEMPTIONS_MIGRATION_DONE);
                if (!exemptionsMigrationDone) {
                    const globallyExemptIds = centralTeachers
                        .filter(t => !!t.isExempt)
                        .map(t => t.id);

                    if (globallyExemptIds.length > 0) {
                        for (const tri of OFFICIAL_TRIMESTERS) {
                            const exemptionKey = getTrimesterKeys(tri).EXEMPTIONS;
                            await DB.set(exemptionKey, globallyExemptIds);
                            localStorage.setItem(exemptionKey, JSON.stringify(globallyExemptIds));
                        }
                    }

                    await DB.set(STORAGE_KEYS.EXEMPTIONS_MIGRATION_DONE, true);
                    localStorage.setItem(STORAGE_KEYS.EXEMPTIONS_MIGRATION_DONE, 'true');
                }

                // Load per-trimester data
                let triData = await loadTrimesterData(localTrimester);
                const sanitizedLoad = sanitizeTrimesterData(baseMappedTeachers, triData);
                triData = sanitizedLoad.data;
                if (sanitizedLoad.changed) {
                    const keys = getTrimesterKeys(localTrimester);
                    await DB.set(keys.SCHEDULE, triData.schedule);
                    await DB.set(keys.RESERVE_SCHEDULE, triData.reserveSchedule);
                    await DB.set(keys.ABSENCE_SCHEDULE, triData.absenceSchedule);
                    await DB.set(keys.ROOM_ASSIGNMENTS, triData.roomAssignments);
                    await DB.set(keys.EXEMPTIONS, triData.exemptTeacherIds);
                    await DB.set(keys.ABSENCES, triData.absentTeacherIds);
                    localStorage.setItem(keys.SCHEDULE, JSON.stringify(triData.schedule));
                    localStorage.setItem(keys.RESERVE_SCHEDULE, JSON.stringify(triData.reserveSchedule));
                    localStorage.setItem(keys.ABSENCE_SCHEDULE, JSON.stringify(triData.absenceSchedule));
                    localStorage.setItem(keys.ROOM_ASSIGNMENTS, JSON.stringify(triData.roomAssignments));
                    localStorage.setItem(keys.EXEMPTIONS, JSON.stringify(triData.exemptTeacherIds));
                    localStorage.setItem(keys.ABSENCES, JSON.stringify(triData.absentTeacherIds));
                }

                const hydratedTeacherDirectory = buildTeacherDirectoryForTrimester(baseMappedTeachers, triData);

                setTeacherDirectory(hydratedTeacherDirectory);

                setTeachers(applyTrimesterTeacherStatuses(hydratedTeacherDirectory, triData.exemptTeacherIds));

                setDays(triData.days);

                setSchedule(triData.schedule);

                setReserveSchedule(triData.reserveSchedule || {});

                setAbsenceSchedule(triData.absenceSchedule || {});

                if (localSettings) setSettings(prev => ({ ...prev, ...localSettings }));

                setTrimester(localTrimester);
                setRoomAssignments(triData.roomAssignments);

            } catch (err) {

                console.error("Load Error", err);

                showToast('خطأ في تحميل البيانات', 'error');

            }

        };

        load();

    }, []);
    // Days, Schedule, and RoomAssignments are saved per-trimester

    const saveDays = async (newDays) => {

        setDays(newDays);

        const keys = getTrimesterKeys(trimester);
        await DB.set(keys.DAYS, newDays);
        localStorage.setItem(keys.DAYS, JSON.stringify(newDays));

    };

    const saveAssignmentState = async (
        nextSchedule = schedule,
        nextReserveSchedule = reserveSchedule,
        nextAbsenceSchedule = absenceSchedule
    ) => {
        const normalizedAssignments = normalizeAssignmentStores(
            nextSchedule,
            nextReserveSchedule,
            nextAbsenceSchedule
        );
        const normalizedRoomAssignments = normalizeRoomAssignmentsAgainstAssignments(
            roomAssignments,
            normalizedAssignments.schedule,
            normalizedAssignments.reserveSchedule,
            normalizedAssignments.absenceSchedule
        );
        const keys = getTrimesterKeys(trimester);

        setSchedule(normalizedAssignments.schedule);
        setReserveSchedule(normalizedAssignments.reserveSchedule);
        setAbsenceSchedule(normalizedAssignments.absenceSchedule);
        setRoomAssignments(normalizedRoomAssignments);

        await DB.set(keys.SCHEDULE, normalizedAssignments.schedule);
        await DB.set(keys.RESERVE_SCHEDULE, normalizedAssignments.reserveSchedule);
        await DB.set(keys.ABSENCE_SCHEDULE, normalizedAssignments.absenceSchedule);
        await DB.set(keys.ROOM_ASSIGNMENTS, normalizedRoomAssignments);

        localStorage.setItem(keys.SCHEDULE, JSON.stringify(normalizedAssignments.schedule));
        localStorage.setItem(keys.RESERVE_SCHEDULE, JSON.stringify(normalizedAssignments.reserveSchedule));
        localStorage.setItem(keys.ABSENCE_SCHEDULE, JSON.stringify(normalizedAssignments.absenceSchedule));
        localStorage.setItem(keys.ROOM_ASSIGNMENTS, JSON.stringify(normalizedRoomAssignments));

        return normalizedAssignments;
    };

    const saveSchedule = async (newSchedule) => {
        await saveAssignmentState(newSchedule, reserveSchedule, absenceSchedule);

    };

    const saveReserveSchedule = async (newReserveSchedule) => {
        await saveAssignmentState(schedule, newReserveSchedule, absenceSchedule);

    };

    const saveAbsenceSchedule = async (newAbsenceSchedule) => {
        await saveAssignmentState(schedule, reserveSchedule, newAbsenceSchedule);

    };

    const saveRoomAssignments = async (newRooms) => {

        setRoomAssignments(newRooms);

        const keys = getTrimesterKeys(trimester);
        await DB.set(keys.ROOM_ASSIGNMENTS, newRooms);
        localStorage.setItem(keys.ROOM_ASSIGNMENTS, JSON.stringify(newRooms));

    };

    const saveExemptions = async (exemptTeacherIds, targetTrimester = trimester) => {

        const keys = getTrimesterKeys(targetTrimester);
        await DB.set(keys.EXEMPTIONS, exemptTeacherIds);
        localStorage.setItem(keys.EXEMPTIONS, JSON.stringify(exemptTeacherIds));

    };

    const saveSettings = async (newSettings) => {

        setSettings(newSettings);

        await DB.set(STORAGE_KEYS.SETTINGS, newSettings);

        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));

    };

    const showToast = (msg, type = 'success') => {

        const div = document.createElement('div');

        div.className = `toast toast-${type}`;

        div.textContent = msg;

        document.body.appendChild(div);

        setTimeout(() => {

            div.classList.add('show');

            setTimeout(() => {

                div.classList.remove('show');

                setTimeout(() => div.remove(), 300);

            }, 3000);

        }, 10);

    };

    const getDefaultBlancDays = () => ([
        {
            id: new Date('2026-05-03T00:00:00').getTime(),
            date: '2026-05-03',
            morning: { subjects: ['اللغة العربية', 'العلوم الفيزيائية والتكنولوجيا'], requiredTeachers: 0, time: '12:00 - 08:00' },
            evening: { subjects: ['التربية الإسلامية', 'التربية المدنية'], requiredTeachers: 0, time: '16:30 - 14:00' }
        },
        {
            id: new Date('2026-05-04T00:00:00').getTime(),
            date: '2026-05-04',
            morning: { subjects: ['الرياضيات', 'اللغة الإنجليزية'], requiredTeachers: 0, time: '12:00 - 08:00' },
            evening: { subjects: ['التاريخ والجغرافيا'], requiredTeachers: 0, time: '15:30 - 14:00' }
        },
        {
            id: new Date('2026-05-05T00:00:00').getTime(),
            date: '2026-05-05',
            morning: { subjects: ['اللغة الفرنسية', 'العلوم الطبيعية'], requiredTeachers: 0, time: '12:00 - 08:00' },
            evening: { subjects: ['اللغة الأمازيغية'], requiredTeachers: 0, time: '15:30 - 14:00' }
        }
    ]);

    const getDefaultBlancLyceeDays = () => {
        const reqT = 0;
        return [
            { id: new Date('2026-06-07T00:00:00').getTime(), date: '2026-06-07', morning: { subjects: ['اللغة العربية وآدابها'], requiredTeachers: reqT, time: '12:30 - 08:00' }, evening: { subjects: ['العلوم الإسلامية', 'القانون'], requiredTeachers: reqT, time: '15:30 - 13:00' } },
            { id: new Date('2026-06-08T00:00:00').getTime(), date: '2026-06-08', morning: { subjects: ['الرياضيات'], requiredTeachers: reqT, time: '12:30 - 08:00' }, evening: { subjects: ['اللغة الإنجليزية'], requiredTeachers: reqT, time: '16:30 - 13:00' } },
            { id: new Date('2026-06-09T00:00:00').getTime(), date: '2026-06-09', morning: { subjects: ['الفلسفة', 'العلوم الطبيعية', 'التكنولوجيا', 'ت. المحاسبي و المالي'], requiredTeachers: reqT, time: '12:30 - 08:00' }, evening: { subjects: ['اللغة الفرنسية'], requiredTeachers: reqT, time: '16:30 - 13:00' } },
            { id: new Date('2026-06-10T00:00:00').getTime(), date: '2026-06-10', morning: { subjects: ['التاريخ والجغرافيا'], requiredTeachers: reqT, time: '12:30 - 08:00' } },
            { id: new Date('2026-06-11T00:00:00').getTime(), date: '2026-06-11', morning: { subjects: ['العلوم الفيزيائية', 'لغة أجنبية 3'], requiredTeachers: reqT, time: '11:30 - 08:00' }, evening: { subjects: ['الفلسفة'], requiredTeachers: reqT, time: '16:30 - 13:00' } }
        ];
    };

    const createDefaultMockDays = (tri) => {
        if (tri === 'blanc') return getDefaultBlancDays();
        if (tri === 'blanc_lycee') return getDefaultBlancLyceeDays();
        return null;
    };

    const initializeEmptyExamData = async (tri) => {
        const keys = getTrimesterKeys(tri);
        const emptyDays = [];
        const emptySchedule = {};
        const emptyReserve = {};
        const emptyAbsence = {};
        const emptyRooms = {};
        const emptyIds = [];

        await DB.set(keys.DAYS, emptyDays);
        await DB.set(keys.SCHEDULE, emptySchedule);
        await DB.set(keys.RESERVE_SCHEDULE, emptyReserve);
        await DB.set(keys.ABSENCE_SCHEDULE, emptyAbsence);
        await DB.set(keys.ROOM_ASSIGNMENTS, emptyRooms);
        await DB.set(keys.EXEMPTIONS, emptyIds);
        await DB.set(keys.ABSENCES, emptyIds);

        localStorage.setItem(keys.DAYS, JSON.stringify(emptyDays));
        localStorage.setItem(keys.SCHEDULE, JSON.stringify(emptySchedule));
        localStorage.setItem(keys.RESERVE_SCHEDULE, JSON.stringify(emptyReserve));
        localStorage.setItem(keys.ABSENCE_SCHEDULE, JSON.stringify(emptyAbsence));
        localStorage.setItem(keys.ROOM_ASSIGNMENTS, JSON.stringify(emptyRooms));
        localStorage.setItem(keys.EXEMPTIONS, JSON.stringify(emptyIds));
        localStorage.setItem(keys.ABSENCES, JSON.stringify(emptyIds));
    };

    const resetMockExamSchedule = async () => {
        if (!['blanc', 'blanc_lycee'].includes(trimester)) return;

        const examLabel = trimester === 'blanc'
            ? 'شهادة التعليم المتوسط'
            : 'شهادة البكالوريا';

        const result = await Swal.fire({
            icon: 'warning',
            title: 'إعادة تعيين الرزنامة',
            text: `سيتم استرجاع الرزنامة الافتراضية لـ ${examLabel} ومسح التوزيع والقاعات المرتبطة بها. هل تريد المتابعة؟`,
            showCancelButton: true,
            confirmButtonText: 'نعم، إعادة التعيين',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#d97706'
        });

        if (!result.isConfirmed) return;

        const defaultDays = createDefaultMockDays(trimester);
        if (!defaultDays) return;

        const keys = getTrimesterKeys(trimester);
        const emptySchedule = {};
        const emptyRooms = {};

        await DB.set(keys.DAYS, defaultDays);
        await DB.set(keys.SCHEDULE, emptySchedule);
        await DB.set(keys.ROOM_ASSIGNMENTS, emptyRooms);

        localStorage.setItem(keys.DAYS, JSON.stringify(defaultDays));
        localStorage.setItem(keys.SCHEDULE, JSON.stringify(emptySchedule));
        localStorage.setItem(keys.ROOM_ASSIGNMENTS, JSON.stringify(emptyRooms));

        setDays(defaultDays);
        setSchedule(emptySchedule);
        setRoomAssignments(emptyRooms);
        setShowRooms(false);

        showToast(`تمت إعادة تعيين ${examLabel} إلى الرزنامة الافتراضية`, 'success');
    };

    // Actions

    const handleTrimesterChange = async (val) => {

        // Save current trimester indicator
        setTrimester(val);
        await DB.set(STORAGE_KEYS.TRIMESTER, val);
        localStorage.setItem(STORAGE_KEYS.TRIMESTER, val);

        // Load the data for the new trimester
        let triData = await loadTrimesterData(val);

        if (val === 'blanc' && (!triData.days || triData.days.length === 0)) {
            const blancDays = getDefaultBlancDays();
            triData.days = blancDays;
            const keys = getTrimesterKeys('blanc');
            await DB.set(keys.DAYS, blancDays);
            localStorage.setItem(keys.DAYS, JSON.stringify(blancDays));
            setTimeout(() => showToast('تم إنشاء رزنامة الامتحان التجريبي تلقائياً', 'success'), 500);
        }

        if (val === 'blanc_lycee' && (!triData.days || triData.days.length === 0)) {
            const lyceeDays = getDefaultBlancLyceeDays();

            triData.days = lyceeDays;
            const keys = getTrimesterKeys('blanc_lycee');
            await DB.set(keys.DAYS, lyceeDays);
            localStorage.setItem(keys.DAYS, JSON.stringify(lyceeDays));
            setTimeout(() => showToast('تم إنشاء الرزنامة الشاملة لجميع الشعب تلقائياً', 'success'), 500);
        }

        const baseTeachersSource = teacherDirectory.length
            ? teacherDirectory.filter(t => !t.isLegacyPlaceholder && !looksLikeLegacyTeacherRecord(t))
            : teachers.filter(t => !t.isLegacyPlaceholder && !looksLikeLegacyTeacherRecord(t)).map(t => ({
                id: t.id,
                surname: t.surname,
                name: t.name,
                subjects: t.subjects || []
            }));
        const sanitizedTriData = sanitizeTrimesterData(baseTeachersSource, triData);
        triData = sanitizedTriData.data;
        if (sanitizedTriData.changed) {
            const keys = getTrimesterKeys(val);
            await DB.set(keys.SCHEDULE, triData.schedule);
            await DB.set(keys.RESERVE_SCHEDULE, triData.reserveSchedule);
            await DB.set(keys.ABSENCE_SCHEDULE, triData.absenceSchedule);
            await DB.set(keys.ROOM_ASSIGNMENTS, triData.roomAssignments);
            await DB.set(keys.EXEMPTIONS, triData.exemptTeacherIds);
            await DB.set(keys.ABSENCES, triData.absentTeacherIds);
            localStorage.setItem(keys.SCHEDULE, JSON.stringify(triData.schedule));
            localStorage.setItem(keys.RESERVE_SCHEDULE, JSON.stringify(triData.reserveSchedule));
            localStorage.setItem(keys.ABSENCE_SCHEDULE, JSON.stringify(triData.absenceSchedule));
            localStorage.setItem(keys.ROOM_ASSIGNMENTS, JSON.stringify(triData.roomAssignments));
            localStorage.setItem(keys.EXEMPTIONS, JSON.stringify(triData.exemptTeacherIds));
            localStorage.setItem(keys.ABSENCES, JSON.stringify(triData.absentTeacherIds));
        }
        setDays(triData.days);
        setSchedule(triData.schedule);
        setReserveSchedule(triData.reserveSchedule || {});
        setAbsenceSchedule(triData.absenceSchedule || {});
        setRoomAssignments(triData.roomAssignments);
        const teachersSource = buildTeacherDirectoryForTrimester(baseTeachersSource, triData);
        setTeacherDirectory(teachersSource);
        setTeachers(applyTrimesterTeacherStatuses(teachersSource, triData.exemptTeacherIds));
        setShowRooms(false);

        const trimesterMap = { '1': 'الفصل الأول', '2': 'الفصل الثاني', '3': 'الفصل الثالث', 'custom': 'امتحان آخر', 'blanc': 'شهادة التعليم المتوسط', 'blanc_lycee': 'شهادة البكالوريا' };
        showToast(`تم التبديل إلى ${trimesterMap[val]}`, 'success');

    };

    const removeTeacherFromAssignments = async (tid) => {

        let newSchedule = { ...schedule };
        let newReserve = { ...reserveSchedule };
        let newAbsence = { ...absenceSchedule };
        let newRooms = { ...roomAssignments };
        let changed = false;

        Object.keys(newSchedule).forEach(k => {
            if (Array.isArray(newSchedule[k]) && newSchedule[k].includes(tid)) {
                newSchedule[k] = newSchedule[k].filter(id => id !== tid);
                changed = true;
            }
        });

        Object.keys(newReserve).forEach(k => {
            if (Array.isArray(newReserve[k]) && newReserve[k].includes(tid)) {
                newReserve[k] = newReserve[k].filter(id => id !== tid);
                changed = true;
            }
        });

        Object.keys(newAbsence).forEach(k => {
            if (Array.isArray(newAbsence[k]) && newAbsence[k].includes(tid)) {
                newAbsence[k] = newAbsence[k].filter(id => id !== tid);
                changed = true;
            }
        });

        Object.keys(newRooms).forEach(k => {
            const teacherRooms = newRooms[k];
            if (!teacherRooms || typeof teacherRooms !== 'object' || !Object.prototype.hasOwnProperty.call(teacherRooms, tid)) return;
            const nextRooms = { ...teacherRooms };
            delete nextRooms[tid];
            if (Object.keys(nextRooms).length > 0) newRooms[k] = nextRooms;
            else delete newRooms[k];
            changed = true;
        });

        if (changed) {
            await saveAssignmentState(newSchedule, newReserve, newAbsence);
            await saveRoomAssignments(newRooms);
        }

        return changed;
    };

    const handleToggleExemption = async (tid, isExempt) => {

        const updatedTeachers = teachers.map(t => t.id === tid ? { ...t, isExempt } : t);

        setTeachers(updatedTeachers);

        await saveExemptions(updatedTeachers.filter(t => t.isExempt).map(t => t.id));

        // Remove from schedule and reserve if exempt

        if (isExempt) {
            const changed = await removeTeacherFromAssignments(tid);
            if (changed) {
                showToast('تم إعفاء الأستاذ لهذا الفصل وتحديث الجدول', 'success');
            }

        } else {

            showToast('تم تحديث إعفاء الأستاذ لهذا الفصل', 'success');

        }

    };

    const handleDeleteAllTeachers = async () => {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'حذف جميع الأساتذة',
            text: 'سيتم حذف جميع الأساتذة المستوردين ومسح الحراسة والاحتياط والغياب والقاعات المرتبطة بهم في كل الفصول. هل تريد المتابعة؟',
            showCancelButton: true,
            confirmButtonText: 'نعم، احذف الجميع',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#d33'
        });

        if (!result.isConfirmed) return;

        try {
            const saveResult = await DB.saveExamProctors([]);
            if (saveResult === false) throw new Error('تعذر حفظ قائمة الأساتذة الفارغة');

            for (const tri of OFFICIAL_TRIMESTERS) {
                const keys = getTrimesterKeys(tri);
                await DB.set(keys.SCHEDULE, {});
                await DB.set(keys.RESERVE_SCHEDULE, {});
                await DB.set(keys.ABSENCE_SCHEDULE, {});
                await DB.set(keys.ROOM_ASSIGNMENTS, {});
                await DB.set(keys.EXEMPTIONS, []);
                await DB.set(keys.ABSENCES, []);
                localStorage.setItem(keys.SCHEDULE, JSON.stringify({}));
                localStorage.setItem(keys.RESERVE_SCHEDULE, JSON.stringify({}));
                localStorage.setItem(keys.ABSENCE_SCHEDULE, JSON.stringify({}));
                localStorage.setItem(keys.ROOM_ASSIGNMENTS, JSON.stringify({}));
                localStorage.setItem(keys.EXEMPTIONS, JSON.stringify([]));
                localStorage.setItem(keys.ABSENCES, JSON.stringify([]));
            }

            setTeacherDirectory([]);
            setTeachers([]);
            setSchedule({});
            setReserveSchedule({});
            setAbsenceSchedule({});
            setRoomAssignments({});
            setShowRooms(false);

            showToast('تم حذف جميع الأساتذة ومسح التوزيعات المرتبطة بهم', 'success');
        } catch (error) {
            console.error('Delete all teachers error:', error);
            showToast('حدث خطأ أثناء حذف جميع الأساتذة', 'error');
        }
    };

    const handleAddDay = async (date, mTime, eTime, midTime, useThreePeriods, hasMorning = true, hasEvening = true) => {

        if (!date) return showToast('اختر التاريخ', 'error');

        if (days.some(d => d.date === date)) return showToast('التاريخ موجود مسبقاً', 'error');

        const newDay = {
            id: Date.now(),
            date
        };
        if (hasMorning) newDay.morning = { subjects: [], requiredTeachers: settings.teachersPerPeriod || 2, time: mTime };
        if (hasEvening) newDay.evening = { subjects: [], requiredTeachers: settings.teachersPerPeriod || 2, time: eTime };

        if (useThreePeriods) {
            newDay.midday = { subjects: [], requiredTeachers: settings.teachersPerPeriod || 2, time: midTime };
        }

        const newDays = [...days, newDay].sort((a, b) => new Date(a.date) - new Date(b.date));

        await saveDays(newDays);

        setIsAddDayModalOpen(false);

        showToast('تم إضافة اليوم');

    };

    const handleOfficialExamNameChange = (value) => {
        setOfficialCenterData((prev) => getOfficialCenterDisplay({ ...prev, exam: value }, officialExamTypeDraft));
    };

    const handleOfficialExamTypeSelect = async (value) => {
        const nextValue = ['custom', 'blanc', 'blanc_lycee'].includes(String(value)) ? String(value) : 'custom';
        setOfficialExamTypeDraft(nextValue);
        setOfficialCenterData((prev) => getOfficialCenterDisplay(prev, nextValue));
        if (nextValue !== 'custom' && nextValue !== trimester) {
            await handleTrimesterChange(nextValue);
        }
    };

    const applyOfficialExamSelection = async () => {
        try {
            const examName = String(officialCenterData.exam || '').trim();
            const examType = ['custom', 'blanc', 'blanc_lycee'].includes(String(officialExamTypeDraft)) ? String(officialExamTypeDraft) : 'custom';
            const selectedCustomStage = customExamStageDraft === 'secondary' ? 'secondary' : 'middle';

            if (!examName) {
                showToast('يرجى كتابة اسم الامتحان', 'error');
                return;
            }

            const currentCenter = await DB.getOfficialCenter() || {};
            const updatedCenter = {
                ...currentCenter,
                exam: examName
            };
            const success = await DB.saveOfficialCenter(updatedCenter);
            if (!success) throw new Error('save failed');
            setOfficialCenterData(getOfficialCenterDisplay(updatedCenter, examType));

            if (examType === 'custom') {
                const nextSettings = { ...settings, customExamStage: selectedCustomStage };
                await saveSettings(nextSettings);
                await initializeEmptyExamData('custom');
            }

            await handleTrimesterChange(examType);
        } catch (error) {
            console.error('Official exam apply failed:', error);
            showToast('تعذر اعتماد الامتحان', 'error');
        }
    };

    const handleOpenImportProctorsPicker = () => {
        setIsImportToolsModalOpen(false);
        const input = document.getElementById('import-proctors-input');
        if (input) input.click();
    };

    const handleExportSplitTemplate = () => {
        setIsImportToolsModalOpen(false);
        if (window.exportExamProctorsTemplate) window.exportExamProctorsTemplate('split');
    };

    const handleExportCombinedTemplate = () => {
        setIsImportToolsModalOpen(false);
        if (window.exportExamProctorsCombinedTemplate) window.exportExamProctorsCombinedTemplate();
    };

    const handleDeleteAllTeachersFromModal = async () => {
        setIsImportToolsModalOpen(false);
        await handleDeleteAllTeachers();
    };

    const handleDeleteDay = async (id) => {

        const result = await Swal.fire({
            title: 'هل أنت متأكد؟',
            text: "هل تريد حذف هذا اليوم؟",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'نعم، حذف',
            cancelButtonText: 'إلغاء'
        });

        if (!result.isConfirmed) return;

        const newDays = days.filter(d => d.id !== id);

        await saveDays(newDays);

        // Clean schedule

        const newSchedule = { ...schedule };

        Object.keys(newSchedule).forEach(k => {

            if (k.startsWith(`${id}_`)) delete newSchedule[k];

        });

        const newReserve = { ...reserveSchedule };
        const newAbsence = { ...absenceSchedule };
        const newRooms = { ...roomAssignments };

        Object.keys(newReserve).forEach(k => {
            if (k.startsWith(`${id}_`)) delete newReserve[k];
        });

        Object.keys(newAbsence).forEach(k => {
            if (k.startsWith(`${id}_`)) delete newAbsence[k];
        });

        Object.keys(newRooms).forEach(k => {
            if (k.startsWith(`${id}_`)) delete newRooms[k];
        });

        await saveAssignmentState(newSchedule, newReserve, newAbsence);
        await saveRoomAssignments(newRooms);

        showToast('تم الحذف');

    };

    const handleUpdateDay = async (updatedDay) => {

        const newDays = days.map(d => d.id === updatedDay.id ? updatedDay : d);

        await saveDays(newDays);

    };

    // GENERATION ALGORITHM

    const generateSchedule = async () => {
        if (!teachers.length || !days.length) return showToast('البيانات ناقصة', 'error');

        const activeTeachers = teachers.filter(t =>
            !t.isExempt
            && !t.isLegacyPlaceholder
            && !looksLikeLegacyTeacherRecord(t)
        );
        if (activeTeachers.length === 0) return showToast('لا يوجد أساتذة متاحون', 'error');

        // Phase 1: Collect all period slots
        const slots = [];
        const dayDates = [];
        days.forEach((day, dayIndex) => {
            if (!dayDates.includes(day.date)) dayDates.push(day.date);
            ['morning', 'midday', 'evening'].forEach(period => {
                if (!day[period]) return;
                const pData = day[period];
                const required = pData.requiredTeachers !== undefined ? pData.requiredTeachers : 0;
                const reserve = pData.reserveTeachers !== undefined ? pData.reserveTeachers : 0;
                if (required <= 0 && reserve <= 0) return;
                slots.push({
                    dayId: day.id, dayIndex, period,
                    subjects: (pData.subjects || []).filter(s => s && s.trim() !== ''),
                    required, reserve, dayDate: day.date
                });
            });
        });

        if (slots.length === 0) return showToast('لا توجد فترات تحتاج حراسة', 'error');

        // Phase 2: Calculate ideal distribution
        const totalGuardSlots = slots.reduce((sum, p) => sum + p.required, 0);
        const totalReserveSlots = slots.reduce((sum, p) => sum + p.reserve, 0);
        const totalSlots = totalGuardSlots + totalReserveSlots;
        const preferredStage = getPreferredStageForTrimester(trimester, globalStage, settings.customExamStage || customExamStageDraft || 'middle');
        const assignmentTieBreakerSeed = Date.now();

        // Phase 3: Build tracking
        const load = {};
        activeTeachers.forEach(t => {
            load[t.id] = { total: 0, guardCount: 0, reserveCount: 0, days: new Set(), dayPeriods: {} };
        });
        const teacherById = new Map(activeTeachers.map((teacher) => [teacher.id, teacher]));
        const prioritizedStageTeachers = (preferredStage === 'middle' || preferredStage === 'secondary')
            ? activeTeachers.filter((teacher) => getTeacherStage(teacher.rank) === preferredStage)
            : [];
        const prioritizedStageTeacherIds = new Set(prioritizedStageTeachers.map((teacher) => teacher.id));

        let newSchedule = {};
        let newReserveSchedule = {};

        // Phase 4: Round-Robin Balanced Distribution
        // Initialize empty schedules for all slots
        const slotKeys = [];
        slots.forEach(slot => {
            const key = `${slot.dayId}_${slot.period}`;
            newSchedule[key] = [];
            newReserveSchedule[key] = [];
            slotKeys.push(key);
        });

        // Build eligibility map: for each slot, which teachers can serve (no subject conflict)
        const slotEligible = {};
        slots.forEach(slot => {
            const key = `${slot.dayId}_${slot.period}`;
            slotEligible[key] = new Set(
                activeTeachers.filter(t =>
                    !teachesSubjectInPeriod(t, slot.subjects)
                    && !((absenceSchedule[key] || []).includes(t.id))
                ).map(t => t.id)
            );
        });

        // Track remaining needs per slot
        const slotGuardNeed = {};
        const slotReserveNeed = {};
        slots.forEach(slot => {
            const key = `${slot.dayId}_${slot.period}`;
            slotGuardNeed[key] = slot.required;
            slotReserveNeed[key] = slot.reserve;
        });
        const slotByKey = Object.fromEntries(slots.map((slot) => [`${slot.dayId}_${slot.period}`, slot]));
        const prioritizedStageGuardMinimumByKey = Object.fromEntries(slots.map((slot) => {
            const key = `${slot.dayId}_${slot.period}`;
            const minPreferredStageGuardCount = (preferredStage === 'middle' || preferredStage === 'secondary')
                ? Math.min(slot.required, Math.ceil(slot.required / 3))
                : 0;
            return [key, minPreferredStageGuardCount];
        }));
        const prioritizedStageReserveMinimumByKey = Object.fromEntries(slots.map((slot) => {
            const key = `${slot.dayId}_${slot.period}`;
            const minPreferredStageReserveCount = (preferredStage === 'middle' || preferredStage === 'secondary')
                ? Math.min(slot.reserve, Math.ceil(slot.reserve / 3))
                : 0;
            return [key, minPreferredStageReserveCount];
        }));
        const getPrioritizedStageGuardCount = (key) =>
            (newSchedule[key] || []).reduce((count, teacherId) => count + (prioritizedStageTeacherIds.has(teacherId) ? 1 : 0), 0);
        const getPrioritizedStageReserveCount = (key) =>
            (newReserveSchedule[key] || []).reduce((count, teacherId) => count + (prioritizedStageTeacherIds.has(teacherId) ? 1 : 0), 0);
        const getPrioritizedStageGuardDeficit = (key) =>
            Math.max(0, (prioritizedStageGuardMinimumByKey[key] || 0) - getPrioritizedStageGuardCount(key));
        const getPrioritizedStageReserveDeficit = (key) =>
            Math.max(0, (prioritizedStageReserveMinimumByKey[key] || 0) - getPrioritizedStageReserveCount(key));
        const wouldReducePrioritizedStageGuardCoverage = (key, outgoingTeacherId, incomingTeacherId) => {
            if ((preferredStage !== 'middle' && preferredStage !== 'secondary') || prioritizedStageTeacherIds.size === 0) return false;
            if (!prioritizedStageTeacherIds.has(outgoingTeacherId) || prioritizedStageTeacherIds.has(incomingTeacherId)) return false;
            return getPrioritizedStageGuardCount(key) <= (prioritizedStageGuardMinimumByKey[key] || 0);
        };
        const wouldReducePrioritizedStageReserveCoverage = (key, outgoingTeacherId, incomingTeacherId) => {
            if ((preferredStage !== 'middle' && preferredStage !== 'secondary') || prioritizedStageTeacherIds.size === 0) return false;
            if (!prioritizedStageTeacherIds.has(outgoingTeacherId) || prioritizedStageTeacherIds.has(incomingTeacherId)) return false;
            return getPrioritizedStageReserveCount(key) <= (prioritizedStageReserveMinimumByKey[key] || 0);
        };
        const assignTeacherToSlot = (teacherId, slot, mode = 'guard') => {
            const key = `${slot.dayId}_${slot.period}`;
            const teacherLoad = load[teacherId];
            if (!teacherLoad) return false;

            if (mode === 'guard') {
                if (!Array.isArray(newSchedule[key])) newSchedule[key] = [];
                if (newSchedule[key].includes(teacherId)) return false;
                newSchedule[key].push(teacherId);
                if (slotGuardNeed[key] > 0) slotGuardNeed[key]--;
                teacherLoad.guardCount++;
            } else {
                if (!Array.isArray(newReserveSchedule[key])) newReserveSchedule[key] = [];
                if (newReserveSchedule[key].includes(teacherId)) return false;
                newReserveSchedule[key].push(teacherId);
                if (slotReserveNeed[key] > 0) slotReserveNeed[key]--;
                teacherLoad.reserveCount++;
            }

            teacherLoad.total++;
            teacherLoad.days.add(slot.dayDate);
            if (!teacherLoad.dayPeriods[slot.dayDate]) teacherLoad.dayPeriods[slot.dayDate] = [];
            teacherLoad.dayPeriods[slot.dayDate].push(slot.period);
            return true;
        };
        const sortAssignmentCandidatesForSlot = (candidates, slot, mode = 'guard') => {
            const key = `${slot.dayId}_${slot.period}`;
            const prioritizePreferredStageGuards = mode === 'guard'
                && (preferredStage === 'middle' || preferredStage === 'secondary')
                && getPrioritizedStageGuardDeficit(key) > 0;
            const prioritizePreferredStageReserve = mode === 'reserve'
                && (preferredStage === 'middle' || preferredStage === 'secondary')
                && getPrioritizedStageReserveDeficit(key) > 0;

            candidates.sort((a, b) => {
                if (prioritizePreferredStageGuards || prioritizePreferredStageReserve) {
                    const preferredStageDiff = (prioritizedStageTeacherIds.has(b.id) ? 1 : 0) - (prioritizedStageTeacherIds.has(a.id) ? 1 : 0);
                    if (preferredStageDiff !== 0) return preferredStageDiff;
                }
                return compareAssignmentCandidates(a, b, load, slot, preferredStage, mode, assignmentTieBreakerSeed);
            });
        };
        const purgeSubjectConflictAssignments = () => {
            let removedCount = 0;

            const cleanSource = (source) => {
                Object.keys(source || {}).forEach((key) => {
                    const slot = slotByKey[key];
                    if (!slot) return;

                    const currentAssignments = Array.isArray(source[key]) ? source[key] : [];
                    const filteredAssignments = currentAssignments.filter((teacherId) => {
                        const teacher = teacherById.get(teacherId);
                        const isEligible = !!teacher && slotEligible[key] && slotEligible[key].has(teacherId);
                        if (!isEligible) {
                            removedCount++;
                            return false;
                        }
                        return true;
                    });

                    source[key] = filteredAssignments;
                });
            };

            cleanSource(newSchedule);
            cleanSource(newReserveSchedule);

            if (removedCount > 0) {
                rebuildLoadTracking();
            }

            return removedCount;
        };

        const rebuildLoadTracking = () => {
            activeTeachers.forEach(t => {
                load[t.id] = { total: 0, guardCount: 0, reserveCount: 0, days: new Set(), dayPeriods: {} };
            });

            slots.forEach(slot => {
                const key = `${slot.dayId}_${slot.period}`;
                (newSchedule[key] || []).forEach((teacherId) => {
                    const teacherLoad = load[teacherId];
                    if (!teacherLoad) return;
                    teacherLoad.total++;
                    teacherLoad.guardCount++;
                    teacherLoad.days.add(slot.dayDate);
                    if (!teacherLoad.dayPeriods[slot.dayDate]) teacherLoad.dayPeriods[slot.dayDate] = [];
                    teacherLoad.dayPeriods[slot.dayDate].push(slot.period);
                });
                (newReserveSchedule[key] || []).forEach((teacherId) => {
                    const teacherLoad = load[teacherId];
                    if (!teacherLoad) return;
                    teacherLoad.total++;
                    teacherLoad.reserveCount++;
                    teacherLoad.days.add(slot.dayDate);
                    if (!teacherLoad.dayPeriods[slot.dayDate]) teacherLoad.dayPeriods[slot.dayDate] = [];
                    teacherLoad.dayPeriods[slot.dayDate].push(slot.period);
                });
            });
        };

        const getProjectedDayDelta = (teacherId, fromKey, toKey) => {
            const teacherLoad = load[teacherId];
            if (!teacherLoad) return 0;
            const counts = new Map();
            Object.entries(teacherLoad.dayPeriods || {}).forEach(([dayDate, periods]) => {
                counts.set(dayDate, Array.isArray(periods) ? periods.length : 0);
            });
            const oldSize = counts.size;
            const fromDay = slotByKey[fromKey] && slotByKey[fromKey].dayDate;
            const toDay = slotByKey[toKey] && slotByKey[toKey].dayDate;
            if (!fromDay || !toDay) return 0;
            if (fromDay === toDay) return 0;

            const fromCount = counts.get(fromDay) || 0;
            if (fromCount <= 1) counts.delete(fromDay);
            else counts.set(fromDay, fromCount - 1);

            counts.set(toDay, (counts.get(toDay) || 0) + 1);
            return counts.size - oldSize;
        };

        const compactAssignmentsByDay = () => {
            for (let pass = 0; pass < 250; pass++) {
                let changed = false;

                const compactTeachers = activeTeachers
                    .filter((teacher) => load[teacher.id].days.size > 1)
                    .sort((a, b) => {
                        const daySpreadDiff = load[b.id].days.size - load[a.id].days.size;
                        if (daySpreadDiff !== 0) return daySpreadDiff;
                        return load[b.id].total - load[a.id].total;
                    });

                const swapWithinSource = (source, otherSource) => {
                    const keys = Object.keys(source || {});
                    for (const aTeacher of compactTeachers) {
                        for (const keyA of keys) {
                            if (!(source[keyA] || []).includes(aTeacher.id)) continue;
                            for (const bTeacher of activeTeachers) {
                                if (bTeacher.id === aTeacher.id) continue;
                                for (const keyB of keys) {
                                    if (keyA === keyB) continue;
                                    if (!(source[keyB] || []).includes(bTeacher.id)) continue;
                                    if ((source[keyA] || []).includes(bTeacher.id) || (source[keyB] || []).includes(aTeacher.id)) continue;
                                    if ((otherSource[keyA] || []).includes(bTeacher.id) || (otherSource[keyB] || []).includes(aTeacher.id)) continue;
                                    if (!slotEligible[keyA].has(bTeacher.id) || !slotEligible[keyB].has(aTeacher.id)) continue;
                                    if (source === newSchedule && (
                                        wouldReducePrioritizedStageGuardCoverage(keyA, aTeacher.id, bTeacher.id)
                                        || wouldReducePrioritizedStageGuardCoverage(keyB, bTeacher.id, aTeacher.id)
                                    )) continue;
                                    if (source === newReserveSchedule && (
                                        wouldReducePrioritizedStageReserveCoverage(keyA, aTeacher.id, bTeacher.id)
                                        || wouldReducePrioritizedStageReserveCoverage(keyB, bTeacher.id, aTeacher.id)
                                    )) continue;

                                    const deltaA = getProjectedDayDelta(aTeacher.id, keyA, keyB);
                                    const deltaB = getProjectedDayDelta(bTeacher.id, keyB, keyA);
                                    if ((deltaA + deltaB) >= 0 || deltaA > 0 || deltaB > 0) continue;

                                    source[keyA] = source[keyA].map((id) => id === aTeacher.id ? bTeacher.id : id);
                                    source[keyB] = source[keyB].map((id) => id === bTeacher.id ? aTeacher.id : id);
                                    rebuildLoadTracking();
                                    changed = true;
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                };

                if (!swapWithinSource(newSchedule, newReserveSchedule)) {
                    swapWithinSource(newReserveSchedule, newSchedule);
                }

                if (!changed) break;
            }
        };

        const rebalanceAssignments = () => {
            const allKeys = Array.from(new Set([
                ...Object.keys(newSchedule || {}),
                ...Object.keys(newReserveSchedule || {})
            ]));

            for (let pass = 0; pass < 500; pass++) {
                const loads = activeTeachers.map(t => load[t.id].total);
                const minL = Math.min(...loads);
                const maxL = Math.max(...loads);
                if (maxL - minL <= 1) break;

                const overloaded = activeTeachers.filter(t => load[t.id].total === maxL);
                const underloaded = activeTeachers.filter(t => load[t.id].total === minL);
                let transferred = false;

                for (const high of overloaded) {
                    if (transferred) break;
                    for (const low of underloaded) {
                        if (transferred) break;
                        for (const key of allKeys) {
                            const slot = slotByKey[key];
                            if (!slot) continue;

                            if (newSchedule[key].includes(high.id) && !newSchedule[key].includes(low.id) && !(newReserveSchedule[key] || []).includes(low.id)) {
                                if (slotEligible[key].has(low.id) && !wouldReducePrioritizedStageGuardCoverage(key, high.id, low.id)) {
                                    newSchedule[key] = newSchedule[key].filter(id => id !== high.id);
                                    newSchedule[key].push(low.id);
                                    load[high.id].total--; load[high.id].guardCount--;
                                    load[low.id].total++; load[low.id].guardCount++;
                                    transferred = true;
                                    break;
                                }
                            }

                            if ((newReserveSchedule[key] || []).includes(high.id) && !newSchedule[key].includes(low.id) && !(newReserveSchedule[key] || []).includes(low.id)) {
                                if (slotEligible[key].has(low.id) && !wouldReducePrioritizedStageReserveCoverage(key, high.id, low.id)) {
                                    newReserveSchedule[key] = newReserveSchedule[key].filter(id => id !== high.id);
                                    newReserveSchedule[key].push(low.id);
                                    load[high.id].total--; load[high.id].reserveCount--;
                                    load[low.id].total++; load[low.id].reserveCount++;
                                    transferred = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!transferred) {
                    let chainDone = false;
                    for (const high of overloaded) {
                        if (chainDone) break;
                        for (const low of underloaded) {
                            if (chainDone) break;
                            for (const keyA of allKeys) {
                                if (chainDone) break;
                                if (!newSchedule[keyA].includes(high.id) && !(newReserveSchedule[keyA] || []).includes(high.id)) continue;
                                const isGuardA = newSchedule[keyA].includes(high.id);

                                for (const keyB of allKeys) {
                                    if (keyA === keyB) continue;
                                    const slotB = slotByKey[keyB];
                                    if (!slotB || !slotEligible[keyB].has(low.id)) continue;
                                    if (newSchedule[keyB].includes(low.id) || (newReserveSchedule[keyB] || []).includes(low.id)) continue;

                                    const mediatorIds = [...newSchedule[keyB], ...(newReserveSchedule[keyB] || [])];
                                    for (const mId of mediatorIds) {
                                        if (mId === high.id || mId === low.id) continue;
                                        if (!slotEligible[keyA] || !slotEligible[keyA].has(mId)) continue;
                                        if (newSchedule[keyA].includes(mId) || (newReserveSchedule[keyA] || []).includes(mId)) continue;

                                        const isGuardB = newSchedule[keyB].includes(mId);
                                        if ((isGuardA && wouldReducePrioritizedStageGuardCoverage(keyA, high.id, mId))
                                            || (!isGuardA && wouldReducePrioritizedStageReserveCoverage(keyA, high.id, mId))
                                            || (isGuardB && wouldReducePrioritizedStageGuardCoverage(keyB, mId, low.id))
                                            || (!isGuardB && wouldReducePrioritizedStageReserveCoverage(keyB, mId, low.id))) continue;

                                        if (isGuardA) {
                                            newSchedule[keyA] = newSchedule[keyA].filter(id => id !== high.id);
                                            newSchedule[keyA].push(mId);
                                        } else {
                                            newReserveSchedule[keyA] = (newReserveSchedule[keyA] || []).filter(id => id !== high.id);
                                            newReserveSchedule[keyA].push(mId);
                                        }

                                        if (isGuardB) {
                                            newSchedule[keyB] = newSchedule[keyB].filter(id => id !== mId);
                                            newSchedule[keyB].push(low.id);
                                        } else {
                                            newReserveSchedule[keyB] = (newReserveSchedule[keyB] || []).filter(id => id !== mId);
                                            newReserveSchedule[keyB].push(low.id);
                                        }

                                        load[high.id].total--;
                                        load[low.id].total++;
                                        if (isGuardA) load[high.id].guardCount--;
                                        else load[high.id].reserveCount--;
                                        if (isGuardB) load[low.id].guardCount++;
                                        else load[low.id].reserveCount++;

                                        chainDone = true;
                                        break;
                                    }
                                    if (chainDone) break;
                                }
                            }
                        }
                    }
                    if (!chainDone) break;
                }
            }
        };

        const optimizeAssignmentsAfterChanges = () => {
            rebalanceAssignments();
            rebuildLoadTracking();
            compactAssignmentsByDay();
            rebuildLoadTracking();
        };

        // 4.1: Assign GUARD slots using strict round-robin
        // Round R: only teachers with current load <= R can receive assignments
        // This guarantees: no teacher gets period N+1 before ALL eligible teachers get period N
        const maxPossibleRounds = Math.max(totalSlots, 1);
        const seedPreferredStageCoverage = () => {
            if ((preferredStage !== 'middle' && preferredStage !== 'secondary') || prioritizedStageTeachers.length === 0) return 0;

            let seededCount = 0;
            for (let round = 0; round < maxPossibleRounds; round++) {
                const slotsThisRound = slots.filter((slot) => {
                    const key = `${slot.dayId}_${slot.period}`;
                    return slotGuardNeed[key] > 0 && getPrioritizedStageGuardDeficit(key) > 0;
                });
                if (slotsThisRound.length === 0) break;

                slotsThisRound.sort((a, b) => {
                    const kA = `${a.dayId}_${a.period}`;
                    const kB = `${b.dayId}_${b.period}`;
                    const deficitDiff = getPrioritizedStageGuardDeficit(kB) - getPrioritizedStageGuardDeficit(kA);
                    if (deficitDiff !== 0) return deficitDiff;
                    const eligA = prioritizedStageTeachers.filter((teacher) =>
                        slotEligible[kA].has(teacher.id)
                        && !newSchedule[kA].includes(teacher.id)
                        && !(newReserveSchedule[kA] || []).includes(teacher.id)
                        && load[teacher.id].total <= round
                    ).length;
                    const eligB = prioritizedStageTeachers.filter((teacher) =>
                        slotEligible[kB].has(teacher.id)
                        && !newSchedule[kB].includes(teacher.id)
                        && !(newReserveSchedule[kB] || []).includes(teacher.id)
                        && load[teacher.id].total <= round
                    ).length;
                    if (eligA !== eligB) return eligA - eligB;
                    return a.dayIndex - b.dayIndex;
                });

                let roundAssigned = 0;
                for (const slot of slotsThisRound) {
                    const key = `${slot.dayId}_${slot.period}`;
                    const candidates = prioritizedStageTeachers.filter((teacher) =>
                        slotEligible[key].has(teacher.id)
                        && !newSchedule[key].includes(teacher.id)
                        && !(newReserveSchedule[key] || []).includes(teacher.id)
                        && load[teacher.id].total <= round
                    );
                    if (candidates.length === 0) continue;

                    sortAssignmentCandidatesForSlot(candidates, slot, 'guard');
                    if (assignTeacherToSlot(candidates[0].id, slot, 'guard')) {
                        seededCount++;
                        roundAssigned++;
                    }
                }

                if (roundAssigned === 0) {
                    const hasAnyPreferredStageCandidate = slotsThisRound.some((slot) => {
                        const key = `${slot.dayId}_${slot.period}`;
                        return prioritizedStageTeachers.some((teacher) =>
                            slotEligible[key].has(teacher.id)
                            && !newSchedule[key].includes(teacher.id)
                            && !(newReserveSchedule[key] || []).includes(teacher.id)
                        );
                    });
                    if (!hasAnyPreferredStageCandidate) break;
                }
            }

            return seededCount;
        };
        seedPreferredStageCoverage();
        for (let round = 0; round < maxPossibleRounds; round++) {
            // Check if all guard slots are filled
            const anyGuardNeed = slots.some(s => slotGuardNeed[`${s.dayId}_${s.period}`] > 0);
            if (!anyGuardNeed) break;

            // Sort slots: hardest to fill first (fewest eligible teachers with load <= round)
            const slotsThisRound = slots.filter(s => slotGuardNeed[`${s.dayId}_${s.period}`] > 0);
            slotsThisRound.sort((a, b) => {
                const kA = `${a.dayId}_${a.period}`;
                const kB = `${b.dayId}_${b.period}`;
                const eligA = activeTeachers.filter(t =>
                    slotEligible[kA].has(t.id) &&
                    !newSchedule[kA].includes(t.id) &&
                    load[t.id].total <= round
                ).length;
                const eligB = activeTeachers.filter(t =>
                    slotEligible[kB].has(t.id) &&
                    !newSchedule[kB].includes(t.id) &&
                    load[t.id].total <= round
                ).length;
                if (eligA !== eligB) return eligA - eligB;
                const totalEligA = slotEligible[kA].size;
                const totalEligB = slotEligible[kB].size;
                if (totalEligA !== totalEligB) return totalEligA - totalEligB;
                if (slotGuardNeed[kA] !== slotGuardNeed[kB]) return slotGuardNeed[kB] - slotGuardNeed[kA];
                return a.dayIndex - b.dayIndex;
            });

            for (const slot of slotsThisRound) {
                const key = `${slot.dayId}_${slot.period}`;
                const needed = slotGuardNeed[key];
                if (needed <= 0) continue;

                // Find eligible teachers with load exactly at this round level
                const candidates = activeTeachers.filter(t =>
                    slotEligible[key].has(t.id) &&
                    !newSchedule[key].includes(t.id) &&
                    load[t.id].total <= round
                );

                // Sort: lowest load first, then prefer teachers already on this day (rest day preservation)
                sortAssignmentCandidatesForSlot(candidates, slot, 'guard');

                const toAssign = Math.min(needed, candidates.length);
                for (let i = 0; i < toAssign; i++) {
                    const t = candidates[i];
                    assignTeacherToSlot(t.id, slot, 'guard');
                }
            }
        }

        const seedPreferredStageReserveCoverage = () => {
            if ((preferredStage !== 'middle' && preferredStage !== 'secondary') || prioritizedStageTeachers.length === 0) return 0;

            let seededCount = 0;
            for (let round = 0; round < maxPossibleRounds; round++) {
                const slotsThisRound = slots.filter((slot) => {
                    const key = `${slot.dayId}_${slot.period}`;
                    return slotReserveNeed[key] > 0 && getPrioritizedStageReserveDeficit(key) > 0;
                });
                if (slotsThisRound.length === 0) break;

                slotsThisRound.sort((a, b) => {
                    const kA = `${a.dayId}_${a.period}`;
                    const kB = `${b.dayId}_${b.period}`;
                    const deficitDiff = getPrioritizedStageReserveDeficit(kB) - getPrioritizedStageReserveDeficit(kA);
                    if (deficitDiff !== 0) return deficitDiff;
                    const eligA = prioritizedStageTeachers.filter((teacher) =>
                        slotEligible[kA].has(teacher.id)
                        && !newSchedule[kA].includes(teacher.id)
                        && !(newReserveSchedule[kA] || []).includes(teacher.id)
                        && load[teacher.id].total <= round
                    ).length;
                    const eligB = prioritizedStageTeachers.filter((teacher) =>
                        slotEligible[kB].has(teacher.id)
                        && !newSchedule[kB].includes(teacher.id)
                        && !(newReserveSchedule[kB] || []).includes(teacher.id)
                        && load[teacher.id].total <= round
                    ).length;
                    if (eligA !== eligB) return eligA - eligB;
                    return a.dayIndex - b.dayIndex;
                });

                let roundAssigned = 0;
                for (const slot of slotsThisRound) {
                    const key = `${slot.dayId}_${slot.period}`;
                    const candidates = prioritizedStageTeachers.filter((teacher) =>
                        slotEligible[key].has(teacher.id)
                        && !newSchedule[key].includes(teacher.id)
                        && !(newReserveSchedule[key] || []).includes(teacher.id)
                        && load[teacher.id].total <= round
                    );
                    if (candidates.length === 0) continue;

                    sortAssignmentCandidatesForSlot(candidates, slot, 'reserve');
                    if (assignTeacherToSlot(candidates[0].id, slot, 'reserve')) {
                        seededCount++;
                        roundAssigned++;
                    }
                }

                if (roundAssigned === 0) {
                    const hasAnyPreferredStageCandidate = slotsThisRound.some((slot) => {
                        const key = `${slot.dayId}_${slot.period}`;
                        return prioritizedStageTeachers.some((teacher) =>
                            slotEligible[key].has(teacher.id)
                            && !newSchedule[key].includes(teacher.id)
                            && !(newReserveSchedule[key] || []).includes(teacher.id)
                        );
                    });
                    if (!hasAnyPreferredStageCandidate) break;
                }
            }

            return seededCount;
        };
        seedPreferredStageReserveCoverage();

        // 4.2: Assign RESERVE slots using same round-robin
        for (let round = 0; round < maxPossibleRounds; round++) {
            const anyReserveNeed = slots.some(s => slotReserveNeed[`${s.dayId}_${s.period}`] > 0);
            if (!anyReserveNeed) break;

            const slotsThisRound = slots.filter(s => slotReserveNeed[`${s.dayId}_${s.period}`] > 0);
            slotsThisRound.sort((a, b) => {
                const kA = `${a.dayId}_${a.period}`;
                const kB = `${b.dayId}_${b.period}`;
                const eligA = activeTeachers.filter(t =>
                    slotEligible[kA].has(t.id) &&
                    !newSchedule[kA].includes(t.id) &&
                    !(newReserveSchedule[kA] || []).includes(t.id) &&
                    load[t.id].total <= round
                ).length;
                const eligB = activeTeachers.filter(t =>
                    slotEligible[kB].has(t.id) &&
                    !newSchedule[kB].includes(t.id) &&
                    !(newReserveSchedule[kB] || []).includes(t.id) &&
                    load[t.id].total <= round
                ).length;
                if (eligA !== eligB) return eligA - eligB;
                const totalEligA = slotEligible[kA].size;
                const totalEligB = slotEligible[kB].size;
                if (totalEligA !== totalEligB) return totalEligA - totalEligB;
                if (slotReserveNeed[kA] !== slotReserveNeed[kB]) return slotReserveNeed[kB] - slotReserveNeed[kA];
                return a.dayIndex - b.dayIndex;
            });

            for (const slot of slotsThisRound) {
                const key = `${slot.dayId}_${slot.period}`;
                const needed = slotReserveNeed[key];
                if (needed <= 0) continue;

                const candidates = activeTeachers.filter(t =>
                    slotEligible[key].has(t.id) &&
                    !newSchedule[key].includes(t.id) &&
                    !(newReserveSchedule[key] || []).includes(t.id) &&
                    load[t.id].total <= round
                );

                sortAssignmentCandidatesForSlot(candidates, slot, 'reserve');

                const toAssign = Math.min(needed, candidates.length);
                for (let i = 0; i < toAssign; i++) {
                    const t = candidates[i];
                    assignTeacherToSlot(t.id, slot, 'reserve');
                }
            }
        }

        // Phase 5: load balancing then compacting assignments onto fewer days
        optimizeAssignmentsAfterChanges();
        const removedAfterCompaction = purgeSubjectConflictAssignments();
        if (removedAfterCompaction > 0) {
            rebuildLoadTracking();
        }

        // 5.4: Final greedy fill for any remaining gaps after balancing/cleanup
        const fillRemainingAssignments = (targetSource, requiredCount, mode) => {
            let addedCount = 0;
            const getSortedUnfilledSlots = () => [...slots].sort((a, b) => {
                const keyA = `${a.dayId}_${a.period}`;
                const keyB = `${b.dayId}_${b.period}`;
                const needA = requiredCount(a) - (targetSource[keyA] || []).length;
                const needB = requiredCount(b) - (targetSource[keyB] || []).length;
                if (needA !== needB) return needB - needA;
                return a.dayIndex - b.dayIndex;
            });

            const maxLateFillRounds = Math.max(maxPossibleRounds, activeTeachers.length + slots.length);
            for (let roundOffset = 0; roundOffset <= maxLateFillRounds; roundOffset++) {
                let assignedThisRound = 0;
                const currentMinLoad = Math.min(...activeTeachers.map((teacher) => load[teacher.id].total));
                const allowedLoad = currentMinLoad + roundOffset;

                getSortedUnfilledSlots().forEach((slot) => {
                    const key = `${slot.dayId}_${slot.period}`;
                    while ((targetSource[key] || []).length < requiredCount(slot)) {
                        const candidates = activeTeachers.filter((teacher) =>
                            slotEligible[key].has(teacher.id)
                            && !(newSchedule[key] || []).includes(teacher.id)
                            && !(newReserveSchedule[key] || []).includes(teacher.id)
                            && load[teacher.id].total <= allowedLoad
                        );

                        if (candidates.length === 0) break;

                        sortAssignmentCandidatesForSlot(candidates, slot, mode);
                        const teacher = candidates[0];
                        if (!assignTeacherToSlot(teacher.id, slot, mode)) break;
                        addedCount++;
                        assignedThisRound++;
                    }
                });

                const hasRemainingNeed = slots.some((slot) => {
                    const key = `${slot.dayId}_${slot.period}`;
                    return (targetSource[key] || []).length < requiredCount(slot);
                });
                if (!hasRemainingNeed) break;
                if (assignedThisRound === 0 && roundOffset >= activeTeachers.length) break;
            }
            return addedCount;
        };

        const fillAllRemainingAssignments = () => {
            const guardAdded = fillRemainingAssignments(newSchedule, (slot) => slot.required, 'guard');
            const reserveAdded = fillRemainingAssignments(newReserveSchedule, (slot) => slot.reserve, 'reserve');
            rebuildLoadTracking();
            return guardAdded + reserveAdded;
        };

        const initialLateFillCount = fillAllRemainingAssignments();
        const removedAfterFinalFill = purgeSubjectConflictAssignments();
        if (removedAfterFinalFill > 0) {
            fillAllRemainingAssignments();
        }
        let removedAfterReoptimization = 0;
        if (initialLateFillCount > 0 || (removedAfterCompaction + removedAfterFinalFill) > 0) {
            optimizeAssignmentsAfterChanges();
            removedAfterReoptimization = purgeSubjectConflictAssignments();
            if (removedAfterReoptimization > 0) {
                fillAllRemainingAssignments();
                optimizeAssignmentsAfterChanges();
            }
        }
        const normalizedAssignments = normalizeAssignmentStores(newSchedule, newReserveSchedule, absenceSchedule);
        newSchedule = normalizedAssignments.schedule;
        newReserveSchedule = normalizedAssignments.reserveSchedule;
        rebuildLoadTracking();

        // Phase 6: Generate warnings
        const warnings = [];
        // Rest day check
        activeTeachers.forEach(t => {
            const tl = load[t.id];
            if (tl.days.size >= dayDates.length && dayDates.length > 1) {
                warnings.push(`${t.surname} ${t.name}: لا يوجد يوم راحة (${tl.days.size}/${dayDates.length} أيام)`);
            }
        });
        // Balance check
        const allLoads = activeTeachers.map(t => load[t.id].total);
        const minLoad = Math.min(...allLoads);
        const maxLoadVal = Math.max(...allLoads);
        if (maxLoadVal - minLoad > 1) {
            warnings.push(`فرق في الحصص: أدنى ${minLoad} / أقصى ${maxLoadVal}`);
        }
        // Unfilled periods
        slots.forEach(slot => {
            const key = `${slot.dayId}_${slot.period}`;
            const gCount = (newSchedule[key] || []).length;
            const rCount = (newReserveSchedule[key] || []).length;
            const pLabel = slot.period === 'morning' ? 'صباح' : (slot.period === 'midday' ? 'منتصف' : 'مساء');
            if (gCount < slot.required) {
                warnings.push(`${formatDateShort(slot.dayDate).full} - ${pLabel}: ${gCount}/${slot.required} حارس`);
            }
            if (rCount < slot.reserve && slot.reserve > 0) {
                warnings.push(`${formatDateShort(slot.dayDate).full} - ${pLabel}: ${rCount}/${slot.reserve} احتياط`);
            }
        });
        if (preferredStage === 'middle' || preferredStage === 'secondary') {
            const stageLabel = getStageDisplayLabel(preferredStage);
            slots.forEach((slot) => {
                const key = `${slot.dayId}_${slot.period}`;
                const preferredStageGuardMinimum = prioritizedStageGuardMinimumByKey[key] || 0;
                if (preferredStageGuardMinimum <= 0) return;
                const preferredStageGuardCount = getPrioritizedStageGuardCount(key);
                if (preferredStageGuardCount < preferredStageGuardMinimum) {
                    const pLabel = slot.period === 'morning' ? 'صباح' : (slot.period === 'midday' ? 'منتصف' : 'مساء');
                    warnings.push(`${formatDateShort(slot.dayDate).full} - ${pLabel}: أساتذة الطور ${stageLabel} في الحراسة ${preferredStageGuardCount}/${preferredStageGuardMinimum}`);
                }
                const preferredStageReserveMinimum = prioritizedStageReserveMinimumByKey[key] || 0;
                if (preferredStageReserveMinimum <= 0) return;
                const preferredStageReserveCount = getPrioritizedStageReserveCount(key);
                if (preferredStageReserveCount < preferredStageReserveMinimum) {
                    const pLabel = slot.period === 'morning' ? 'صباح' : (slot.period === 'midday' ? 'منتصف' : 'مساء');
                    warnings.push(`${formatDateShort(slot.dayDate).full} - ${pLabel}: أساتذة الطور ${stageLabel} في الاحتياط ${preferredStageReserveCount}/${preferredStageReserveMinimum}`);
                }
            });
        }
        const totalRemovedSubjectConflicts = removedAfterCompaction + removedAfterFinalFill + removedAfterReoptimization;
        if (totalRemovedSubjectConflicts > 0) {
            warnings.push(`تم استبعاد ${totalRemovedSubjectConflicts} تكليفات تلقائيًا بسبب تعارض مادة التخصص`);
        }

        // Save
        await saveAssignmentState(newSchedule, newReserveSchedule, absenceSchedule);

        // Show results
        const statsHtml = `<p style="color: #27ae60; font-weight: bold; margin-bottom: 10px;">✅ تم توزيع ${totalGuardSlots} حصة حراسة + ${totalReserveSlots} حصة احتياط على ${activeTeachers.length} أستاذ</p>`;

        if (warnings.length > 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'تم التوليد مع تنبيهات',
                html: `<div dir="rtl" style="text-align: right; max-height: 300px; overflow-y: auto;">
                    ${statsHtml}<hr>
                    ${warnings.map(w => `<p style="margin: 5px 0;">⚠️ ${w}</p>`).join('')}
                </div>`,
                confirmButtonText: 'حسناً'
            });
        } else {
            await Swal.fire({
                icon: 'success',
                title: 'تم التوليد بنجاح',
                html: `<div dir="rtl">${statsHtml}</div>`,
                confirmButtonText: 'حسناً',
                timer: 3000
            });
        }
    };

    // Manual toggle with left click: nothing -> حراسة -> احتياط -> nothing
    const manuallyToggle = async (dayId, period, tid) => {
        const key = `${dayId}_${period}`;
        const inSchedule = (schedule[key] || []).includes(tid);
        const inReserve = (reserveSchedule[key] || []).includes(tid);
        const inAbsence = (absenceSchedule[key] || []).includes(tid);

        let newSched = { ...schedule };
        let newRes = { ...reserveSchedule };
        let newAbsence = { ...absenceSchedule };
        let newRooms = { ...roomAssignments };

        if (newRooms[key] && Object.prototype.hasOwnProperty.call(newRooms[key], tid)) {
            const nextRooms = { ...newRooms[key] };
            delete nextRooms[tid];
            if (Object.keys(nextRooms).length > 0) newRooms[key] = nextRooms;
            else delete newRooms[key];
        }

        if (!inSchedule && !inReserve && !inAbsence) {
            newSched[key] = [...(newSched[key] || []), tid];
        } else if (inSchedule) {
            newSched[key] = (newSched[key] || []).filter(id => id !== tid);
            newRes[key] = [...(newRes[key] || []), tid];
        } else if (inReserve) {
            newRes[key] = (newRes[key] || []).filter(id => id !== tid);
        } else {
            newAbsence[key] = (newAbsence[key] || []).filter(id => id !== tid);
            newSched[key] = [...(newSched[key] || []), tid];
        }

        await saveAssignmentState(newSched, newRes, newAbsence);
        await saveRoomAssignments(newRooms);
    };

    const manuallyToggleAbsence = async (dayId, period, tid, canMarkAbsence = true) => {
        const key = `${dayId}_${period}`;
        const inSchedule = (schedule[key] || []).includes(tid);
        const inReserve = (reserveSchedule[key] || []).includes(tid);
        const inAbsence = (absenceSchedule[key] || []).includes(tid);

        if (!canMarkAbsence && !inAbsence) {
            showToast('لا يمكن تسجيل الغياب في فترة لا تحتوي على حراسة أو احتياط', 'error');
            return;
        }

        let newSched = { ...schedule };
        let newRes = { ...reserveSchedule };
        let newAbsence = { ...absenceSchedule };
        let newRooms = { ...roomAssignments };

        if (newRooms[key] && Object.prototype.hasOwnProperty.call(newRooms[key], tid)) {
            const nextRooms = { ...newRooms[key] };
            delete nextRooms[tid];
            if (Object.keys(nextRooms).length > 0) newRooms[key] = nextRooms;
            else delete newRooms[key];
        }

        newSched[key] = (newSched[key] || []).filter(id => id !== tid);
        newRes[key] = (newRes[key] || []).filter(id => id !== tid);

        if (inAbsence) {
            newAbsence[key] = (newAbsence[key] || []).filter(id => id !== tid);
        } else {
            newAbsence[key] = [...(newAbsence[key] || []), tid];
        }

        await saveAssignmentState(newSched, newRes, newAbsence);
        await saveRoomAssignments(newRooms);
    };
    const clearSchedule = async () => {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'مسح التوزيع',
            text: 'هل أنت متأكد من مسح جميع الأساتذة من التوزيع (حراسة واحتياط وغياب)؟ هذه العملية لا رجعة فيها.',
            showCancelButton: true,
            confirmButtonText: 'نعم، امسح',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6'
        });
        if (result.isConfirmed) {
            await saveAssignmentState({}, {}, {});
            await saveRoomAssignments({});
            setShowRooms(false);
            showToast('تم مسح التوزيع بنجاح');
        }
    };

    const choosePrintOrientation = async () => {
        const savedOrientation = localStorage.getItem(STORAGE_KEYS.PRINT_ORIENTATION) || printOrientation || 'landscape';

        const result = await Swal.fire({
            title: 'اختيار اتجاه الجدول',
            input: 'radio',
            inputOptions: {
                landscape: 'أفقي',
                portrait: 'عمودي'
            },
            inputValue: savedOrientation,
            confirmButtonText: 'متابعة الطباعة',
            cancelButtonText: 'إلغاء',
            showCancelButton: true,
            inputValidator: (value) => !value ? 'يرجى اختيار اتجاه الجدول' : undefined
        });

        if (!result.isConfirmed || !result.value) {
            return null;
        }

        localStorage.setItem(STORAGE_KEYS.PRINT_ORIENTATION, result.value);
        setPrintOrientation(result.value);
        return result.value;
    };

    const printSchedule = async () => {

        // Trial Mode Check

        const authObj = window.Auth || (typeof Auth !== 'undefined' ? Auth : null);

        const user = authObj && authObj.getUser ? authObj.getUser() : null;

        if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {

            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'طباعة جدول الحراسة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.' });

            return;

        }

        const hasGuardAssignments = Object.values(schedule || {}).some(assignments =>
            Array.isArray(assignments) && assignments.length > 0
        );
        const hasReserveAssignments = Object.values(reserveSchedule || {}).some(assignments =>
            Array.isArray(assignments) && assignments.length > 0
        );
        if (!hasGuardAssignments && !hasReserveAssignments) return showToast('الجدول فارغ', 'error');

        const selectedOrientation = await choosePrintOrientation();
        if (!selectedOrientation) return;

        const settingsData = await getOfficialCenterData();
        const reportExamLabel = getOfficialReportExamLabel(trimester, settingsData.displayExam, settings.customExamStage || customExamStageDraft || 'middle');
        const isPortrait = selectedOrientation === 'portrait';
        const pageOrientation = isPortrait ? 'portrait' : 'landscape';
        const escapeHtml = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const printBaseHref = window.location.href;
        const getFirstPeriodTime = (duties, periodKey) => {
            const match = (duties || []).find((duty) => duty.period === periodKey && duty.time && String(duty.time).trim());
            return match ? String(match.time).trim() : '';
        };
        const buildInlinePeriodLabelHtml = (label, time, wrapperClass, timeClass) => {
            const timeHtml = time
                ? '<span class="' + escapeHtml(timeClass) + '">' + escapeHtml(time) + '</span>'
                : '';
            return '<div class="' + escapeHtml(wrapperClass) + '">' + escapeHtml(label) + timeHtml + '</div>';
        };

        // Refresh room cache for accurate labels
        try {
            let prd = await DB.get(STORAGE_KEYS.PERIOD_ROOMS);
            if (!prd) { const s = localStorage.getItem(STORAGE_KEYS.PERIOD_ROOMS); if (s) prd = JSON.parse(s); }
            if (prd) hydrateGlobalRoomCache(prd);
        } catch (cacheE) { /* ignore */ }

        const trimesterMap = {
            '1': 'الفصل الأول',
            '2': 'الفصل الثاني',
            '3': 'الفصل الثالث',
            'custom': 'امتحان آخر',
            'blanc': 'شهادة التعليم المتوسط',
            'blanc_lycee': 'شهادة البكالوريا'
        };

        // Generate clean HTML for print based on current DOM state is tricky from React without ref.

        // Better to re-generate strings or reuse the logic.

        // We'll construct the HTML string manually again mirroring the table structure.

        // Quick fix: Use the existing logic from supervision.js ported here.

        const sigSettings = await DB.get('signatureSettings') || {};

        const signatureBlock = window.getSignatureHTML ? window.getSignatureHTML('supervision', sigSettings) : '';

        // Helper to get matching teacher for row
        const activeTeachers = sortTeachersForScheduleOrder(teachers.filter(t => !t.isExempt));

        // Helper to check if period is active (matches ScheduleTable logic)
        const isPeriodActive = (day, period) => {
            if (!day[period]) return false;
            const pData = day[period];
            const subjectList = (pData.subjects || []).filter(s => s && s.trim() !== '');
            const hasSub = subjectList.length > 0;
            const req = pData.requiredTeachers !== undefined ? Number(pData.requiredTeachers) : 2;
            return hasSub || req > 0;
        };

        // Pre-calculate active periods for each day
        const dayActivePeriods = {};
        days.forEach(d => {
            const active = [];
            if (d.morning && isPeriodActive(d, 'morning')) active.push('morning');
            if (d.midday && isPeriodActive(d, 'midday')) active.push('midday');
            if (d.evening && isPeriodActive(d, 'evening')) active.push('evening');
            dayActivePeriods[d.id] = active;
        });

        // Filter days that have at least one active period? Or show all days but empty periods?
        // User asked to hide "periods not concerned". So if a day has 0 periods, it might check if we should hide the day too.
        // For now, let's just filter periods. If a day has NO active periods, it will have colspan 0 (which might be an issue).
        // Let's assume if a day is in the list, it's relevant, or we filter days too.

        const activeDays = days.filter(d => dayActivePeriods[d.id].length > 0);

        // Keep subjects on a single line block under the period title in print
        const subjectSeparator = ' - ';

        // Construct Table HTML Manually
        let tableHTML = `
            <table dir="rtl">
                <thead>
                    <tr>
                        <th rowspan="2" width="4%">#</th>
                        <th rowspan="2" width="16%">الأستاذ</th>
                        ${activeDays.map(d => {
            let fd = formatDateShort(d.date);
            return `<th colspan="${dayActivePeriods[d.id].length}" class="day-header-cell">${fd.dayName}<br/><span style="font-size:0.9em;font-weight:normal">${fd.dateFormatted}</span></th>`;
        }).join('')}
                        <th rowspan="2" width="5%" class="total-col">ظ…</th>
                    </tr>
                    <tr>
                        ${activeDays.map(d => {
            return dayActivePeriods[d.id].map(p => {
                const label = p === 'morning' ? 'ف.صباحية' : (p === 'midday' ? 'ف.منتصف' : 'ف.مسائية');
                return `<th class="period-header"><div class="period-header-top">${label}</div><div class="period-header-subjects">${(d[p].subjects || []).join(subjectSeparator)}</div></th>`;
            }).join('');
        }).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        activeTeachers.forEach((t, idx) => {
            let total = 0;
            let cellsHTML = '';

            activeDays.forEach(d => {
                const active = dayActivePeriods[d.id];
                active.forEach(p => {
                    const key = `${d.id}_${p}`;
                    const isAssigned = (schedule[key] || []).includes(t.id);
                    const isReserveAssigned = (reserveSchedule[key] || []).includes(t.id);
                    const isAbsentAssigned = (absenceSchedule[key] || []).includes(t.id);
                    if (isAssigned || isReserveAssigned || isAbsentAssigned) total++;

                    let content = '';
                    let style = '';

                    const roomData = showRooms
                        ? getEffectiveRoomAssignmentData(roomAssignments, key, t.id, isAssigned, isReserveAssigned)
                        : null;

                    if (isAssigned) {
                        content = settings.checkMark || '✓';
                        style = ''; // Removed background-color: #f0f0f0;

                        // Room Override
                        if (roomData) {
                            if (roomData.isReserve) {
                                content = 'احتياط';
                                style = ' font-weight: bold; font-size: 13px; color: #000 !important;'; // Removed background-color and red color
                            } else if (roomData.room) {
                                content = getLocationLabelShort(roomData.room);
                                style = ' font-weight: bold; font-size: 14px; color: #000000 !important;';
                            }
                        }
                    } else if (isReserveAssigned) {
                        content = 'احتياط';
                        style = ' font-weight: bold; font-size: 13px; color: #000 !important;';
                    } else if (isAbsentAssigned) {
                        content = 'غياب';
                        style = ' font-weight: bold; font-size: 13px; color: #9a3412 !important;';
                    }

                    cellsHTML += `<td style="${style} text-align: center;">${content}</td>`;
                });
            });

            tableHTML += `
                <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td class="teacher-name">${t.surname} ${t.name}</td>
                    ${cellsHTML}
                    <td style="text-align: center; font-weight: bold;">${total}</td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table>`;
        // const signatureBlock = window.getSignatureHTML ? window.getSignatureHTML('supervision', sigSettings) : ''; // No longer needed as it's directly embedded

        const printContent = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head><title>طباعة</title>
            <base href="${escapeHtml(printBaseHref)}">
            <style>
                @page { size: A4 ${pageOrientation}; margin: ${isPortrait ? '0.4cm' : '0.5cm'}; }
                body { font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif; direction: rtl; }
                .header { text-align: center; margin-bottom: 20px; }
                .header h3 { font-size: ${isPortrait ? '17px' : '20px'}; font-weight: 800; margin: 0 0 5px; text-decoration: underline; }
                .header p { font-size: ${isPortrait ? '14px' : '16px'}; margin: 0; font-weight: bold; }
                table { width: 100%; border-collapse: collapse; font-size: ${isPortrait ? '10px' : '12px'}; margin-top: 10px; table-layout: fixed; word-wrap: break-word; }
                th, td { border: 1px solid black; padding: ${isPortrait ? '3px 1px' : '4px 2px'}; text-align: center; vertical-align: middle; min-height: 30px; white-space: normal; }
                th { background: var(--card-bg) !important; -webkit-print-color-adjust: exact; font-weight: bold; font-size: ${isPortrait ? '9px' : '11px'}; }
                .period-header { line-height: 1.2; padding: 2px; }
                .period-header-top {
                    display: block;
                    white-space: nowrap;
                    font-weight: 800;
                    padding-bottom: 2px;
                    margin-bottom: 2px;
                    border-bottom: 1px solid #000;
                }
                .period-header-subjects {
                    display: block;
                    font-size: ${isPortrait ? '8px' : '9px'};
                    font-weight: normal;
                    line-height: 1.15;
                }
                .teacher-name { text-align: right; padding-right: 5px; font-weight: bold; font-size: ${isPortrait ? '11px' : '13px'}; white-space: normal; overflow-wrap: anywhere; word-break: break-word; line-height: 1.35; width: ${isPortrait ? '20%' : '18%'}; }
                .footer-container { margin-top: 25px; display: flex; justify-content: space-between; page-break-inside: avoid; font-weight: bold; font-size: ${isPortrait ? '12px' : '14px'}; }
            </style>
            ${PrintToolbarHelper.getHeadContent()}
            </head>
            <body>
            ${PrintToolbarHelper.getToolbarHtml({ advanced: false })}
                <div class="header">
                    <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">الجمهورية الجزائرية الديمقراطية الشعبية</div>
                    <div style="font-weight: bold; font-size: 14px; margin-bottom: 12px;">وزارة التربية الوطنية</div>
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin-bottom: 15px; border-bottom: 1px solid #000; padding-bottom: 10px;">
                        <div style="text-align: right;">
                            <div>الولاية: ${settingsData.displayProvince}</div>
                            <div>المركز: ${settingsData.displayCenter}</div>
                        </div>
                        <div style="text-align: left;">
                            ${settingsData.displayExam} - ${settingsData.displaySession}
                        </div>
                    </div>
                    <h3>جدول الحراسة - ${reportExamLabel}</h3>
                </div>
                ${tableHTML}
                <div class="footer-container">
                    <div style="flex: 1;"></div>
                    <div style="text-align: center; width: 300px; font-weight: bold;">
                        <div style="margin-bottom: 5px;">
                            حرر بـ ${settingsData.displayMunicipality} في <span dir="ltr" style="display: inline-block;">${new Date().toLocaleDateString('fr-FR')}</span>
                        </div>
                        <div style="margin-bottom: ${sigSettings?.enableImage ? '5px' : '10px'}; font-weight: 800; font-size: 16px;">${settingsData.displayJob}</div>
                        <div style="margin-bottom: ${sigSettings?.enableImage ? '5px' : '40px'}; font-size: 13px;">${settingsData.displayPresident}</div>
                        ${sigSettings?.enableImage && sigSettings?.signatureData ? `<img src="${sigSettings.signatureData}" style="max-width: 150px; max-height: 80px;" alt="Signature" />` : ''}
                    </div>
                </div>
            ${PrintToolbarHelper.getScriptHtml({ advanced: false })}
</body>
            </html>
         `;

        const win = window.open('', '_blank');

        win.document.write(printContent);

        win.document.close();

        win.focus();

        // auto-print removed

    };

    const printAbsentTeachers = async () => {
        const periodLabels = {
            morning: 'ف.صباحية',
            midday: 'ف.منتصف',
            evening: 'ف.مسائية'
        };
        const teacherMap = new Map((teachers || []).map((teacher) => [normalizeTeacherId(teacher.id), teacher]));
        const absenceRows = [];

        days.forEach((day) => {
            ['morning', 'midday', 'evening'].forEach((period) => {
                const key = `${day.id}_${period}`;
                const teacherIds = Array.isArray(absenceSchedule[key]) ? absenceSchedule[key] : [];
                teacherIds.forEach((teacherId) => {
                    const teacher = teacherMap.get(normalizeTeacherId(teacherId));
                    if (!teacher || teacher.isLegacyPlaceholder || teacher.isExempt) return;
                    absenceRows.push({
                        teacher,
                        date: day.date,
                        period,
                        periodLabel: periodLabels[period] || period,
                        time: day[period]?.time || ''
                    });
                });
            });
        });

        absenceRows.sort((a, b) => {
            const dateDiff = String(a.date || '').localeCompare(String(b.date || ''));
            if (dateDiff !== 0) return dateDiff;
            const periodOrder = { morning: 1, midday: 2, evening: 3 };
            const periodDiff = (periodOrder[a.period] || 99) - (periodOrder[b.period] || 99);
            if (periodDiff !== 0) return periodDiff;
            return compareTeacherNames(a.teacher, b.teacher);
        });

        if (!absenceRows.length) return showToast('لا توجد حالات غياب مسجلة في الجدول', 'error');

        const settingsData = await getOfficialCenterData();
        const reportExamLabel = getOfficialReportExamLabel(trimester, settingsData.displayExam, settings.customExamStage || customExamStageDraft || 'middle');
        const escapeHtml = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const printBaseHref = window.location.href;
        const rowsHtml = absenceRows.map((entry, index) => `
            <tr>
                <td>${index + 1}</td>
                <td class="name-cell">${escapeHtml(`${entry.teacher.surname || ''} ${entry.teacher.name || ''}`.trim())}</td>
                <td>${escapeHtml((entry.teacher.subjects || []).join(' - ') || '-')}</td>
                <td>${escapeHtml(entry.teacher.institution || '-')}</td>
                <td>${escapeHtml(shortenRank(entry.teacher.rank) || '-')}</td>
                <td>${escapeHtml(formatDateShort(entry.date).full)}</td>
                <td>${escapeHtml(entry.periodLabel)}${entry.time ? ` - ${escapeHtml(entry.time)}` : ''}</td>
                <td>غائب</td>
            </tr>
        `).join('');

        const printContent = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <title>ط·ط¨ط§ط¹ط© ظ‚ط§ط¦ظ…ط© ط§ظ„ط؛ظٹط§ط¨</title>
                <base href="${escapeHtml(printBaseHref)}">
                <style>
                    @page { size: A4 portrait; margin: 1cm; }
                    body { font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif; direction: rtl; color: #000; }
                    .header { text-align: center; margin-bottom: 18px; }
                    .header h2 { margin: 0 0 8px; font-size: 22px; }
                    .header p { margin: 4px 0; font-size: 14px; font-weight: 700; }
                    .meta-row {
                        display: flex;
                        justify-content: space-between;
                        gap: 16px;
                        border: 1px solid #000;
                        padding: 10px 14px;
                        margin-bottom: 16px;
                        font-size: 13px;
                        font-weight: 700;
                    }
                    table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    th, td { border: 1px solid #000; padding: 7px 6px; text-align: center; vertical-align: middle; }
                    th { background: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
                    .name-cell { text-align: right; font-weight: 700; }
                    .summary { margin-top: 12px; font-size: 13px; font-weight: 700; }
                </style>
                ${PrintToolbarHelper.getHeadContent()}
            </head>
            <body>
                ${PrintToolbarHelper.getToolbarHtml({ advanced: false })}
                <div class="header">
                    <h2>قائمة الأساتذة الغائبين</h2>
                    <p>${escapeHtml(reportExamLabel)}</p>
                </div>
                <div class="meta-row">
                    <div>المركز: ${escapeHtml(settingsData.displayCenter)}</div>
                    <div>الولاية: ${escapeHtml(settingsData.displayProvince)}</div>
                    <div>${escapeHtml(settingsData.displayExam)} - ${escapeHtml(settingsData.displaySession)}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th width="6%">#</th>
                            <th width="22%">الأستاذ</th>
                            <th width="18%">المادة</th>
                            <th width="18%">المؤسسة</th>
                            <th width="10%">الرتبة</th>
                            <th width="14%">اليوم</th>
                            <th width="12%">الفترة</th>
                            <th width="8%">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <div class="summary">عدد حالات الغياب المسجلة: ${absenceRows.length}</div>
                ${PrintToolbarHelper.getScriptHtml({ advanced: false })}
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        if (!win) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.' });
            return;
        }

        win.document.write(printContent);
        win.document.close();
        win.focus();
    };

    const printTeachersSignatureSheet = async () => {
        if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'طباعة ورقة الإمضاء غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.' });
            return;
        }

        const assignedTeacherIds = new Set();
        const collectAssignedIds = (source) => {
            Object.values(source || {}).forEach((teacherIds) => {
                if (!Array.isArray(teacherIds)) return;
                teacherIds.forEach((teacherId) => {
                    if (teacherId !== undefined && teacherId !== null && teacherId !== '') {
                        assignedTeacherIds.add(normalizeTeacherId(teacherId));
                    }
                });
            });
        };

        collectAssignedIds(schedule);
        collectAssignedIds(reserveSchedule);

        const printableTeachers = (teachers || [])
            .filter((teacher) => teacher && !teacher.isExempt && !teacher.isLegacyPlaceholder && assignedTeacherIds.has(normalizeTeacherId(teacher.id)))
            .sort((a, b) => {
                const institutionDiff = String(a.institution || '').localeCompare(String(b.institution || ''), 'ar');
                if (institutionDiff !== 0) return institutionDiff;

                const subjectA = (a.subjects || []).map((subject) => getSubjectLabel(subject)).join(' - ');
                const subjectB = (b.subjects || []).map((subject) => getSubjectLabel(subject)).join(' - ');
                const subjectDiff = subjectA.localeCompare(subjectB, 'ar');
                if (subjectDiff !== 0) return subjectDiff;

                const surnameDiff = String(a.surname || '').localeCompare(String(b.surname || ''), 'ar');
                if (surnameDiff !== 0) return surnameDiff;

                const nameDiff = String(a.name || '').localeCompare(String(b.name || ''), 'ar');
                if (nameDiff !== 0) return nameDiff;

                return String(a.id || '').localeCompare(String(b.id || ''), 'ar');
            });

        if (!printableTeachers.length) {
            return showToast('لا يوجد أساتذة معيّنون لطباعة ورقة الإمضاء', 'error');
        }

        const settingsData = await getOfficialCenterData();
        const escapeHtml = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const printBaseHref = window.location.href;
        const today = new Date().toLocaleDateString('ar-DZ');
        const officeTitle = escapeHtml(settingsData.office || 'الديوان الوطني للامتحانات و المسابقات');
        const renderLineField = (label, value, width = '100%') => `
            <div style="display:flex; align-items:flex-end; gap:8px; width:${width}; min-width:0;">
                <span style="font-size:11pt; font-weight:700; white-space:nowrap;">${label}</span>
                <span style="display:inline-flex; align-items:flex-end; justify-content:center; flex:1; min-width:0; min-height:22px; border-bottom:1px dotted #7a7a7a; padding:0 6px 3px; font-size:11pt; line-height:1.2; font-weight:600;">${value || '&nbsp;'}</span>
            </div>
        `;
        const renderBoxField = (label, value) => `
            <div style="display:flex; align-items:flex-end; gap:8px; flex:0 0 auto;">
                <span style="font-size:11pt; font-weight:700; white-space:nowrap;">${label}</span>
                <span style="display:inline-flex; align-items:center; justify-content:center; min-width:112px; min-height:30px; border:1pt solid #9ca3af; padding:2px 10px; font-size:11pt; font-weight:700; line-height:1.2;">${value || '&nbsp;'}</span>
            </div>
        `;
        const headerHtml = `
            <div class="header-container" style="margin-bottom: 14px;">
                <div class="center-text" style="margin-bottom: 2px;">
                    <h3 style="font-size: 15pt; font-weight: 800; line-height: 1.3;">الجمهورية الجزائرية الديمقراطية الشعبية</h3>
                    <h3 style="font-size: 13pt; font-weight: 800; line-height: 1.2;">وزارة التربية الوطنية</h3>
                </div>
                <div style="width: 52%; margin: 0 0 12px auto; text-align: right;">
                    <h3 style="font-size: 12.5pt; font-weight: 700; line-height: 1.2;">${officeTitle}</h3>
                </div>
                <div class="center-text" style="margin-bottom: 16px;">
                    <div style="display:inline-block; border: 1.5pt solid #9ca3af; padding: 4px 18px; min-width: 210px;">
                        <h2 style="margin: 0; font-size: 16pt; font-weight: 800; line-height: 1.2;">ورقة إمضاء الأساتذة</h2>
                    </div>
                </div>
                <div style="display:flex; align-items:flex-end; gap:18px; margin-bottom: 10px;">
                    ${renderLineField('مركز الإجراء :', escapeHtml(settingsData.displayCenter || ''), '38%')}
                    ${renderBoxField('رمز المركز:', escapeHtml(settingsData.center_code || ''))}
                    ${renderLineField('الولاية:', escapeHtml(settingsData.displayProvince || ''), '30%')}
                </div>
                <div style="display:flex; align-items:flex-end; gap:18px; margin-bottom: 2px;">
                    ${renderLineField('الامتحان:', escapeHtml(settingsData.displayExam || ''), '32%')}
                    ${renderLineField('الدورة:', escapeHtml(settingsData.displaySession || ''), '68%')}
                </div>
            </div>
        `;

        const rowsHtml = printableTeachers.map((teacher, index) => {
            const subjectText = (teacher.subjects || []).map((subject) => getSubjectLabel(subject)).join(' - ') || '-';
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td class="name-cell">${escapeHtml(`${teacher.surname || ''} ${teacher.name || ''}`.trim())}</td>
                    <td>${escapeHtml(subjectText)}</td>
                    <td>${escapeHtml(teacher.institution || '-')}</td>
                    <td class="sign-cell"></td>
                </tr>
            `;
        }).join('');

        const printContent = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>ورقة إمضاء الأساتذة</title>
                <base href="${escapeHtml(printBaseHref)}">
                <style>
                    @page { size: A4 portrait; margin: 0.8cm; }
                    * { box-sizing: border-box; }
                    body { font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif; direction: rtl; color: #000; margin: 0; }
                    .center-text { text-align: center; }
                    h1, h2, h3, p { margin: 0; color: #000; }
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                    th, td {
                        border: 0.75pt solid #000;
                        padding: 7px 6px;
                        text-align: center;
                        vertical-align: middle;
                        font-size: 10.5pt;
                        line-height: 1.25;
                    }
                    th {
                        background: #fff !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        font-weight: 800;
                    }
                    .name-cell {
                        text-align: right;
                        padding-right: 8px;
                        font-weight: 700;
                    }
                    .sign-cell { height: 34px; }
                    .footer {
                        margin-top: 24px;
                        display: flex;
                        justify-content: flex-end;
                        font-size: 10.5pt;
                        font-weight: 700;
                    }
                    .footer-box {
                        min-width: 250px;
                        text-align: center;
                    }
                    .footer-line { margin-bottom: 6px; }
                </style>
                ${PrintToolbarHelper.getHeadContent()}
            </head>
            <body>
                ${PrintToolbarHelper.getToolbarHtml({ advanced: false })}
                ${headerHtml}
                <table>
                    <thead>
                        <tr>
                            <th width="7%">#</th>
                            <th width="39%">اللقب والاسم</th>
                            <th width="22%">المادة</th>
                            <th width="20%">المؤسسة</th>
                            <th width="12%">الإمضاء</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <div class="footer">
                    <div class="footer-box">
                        <div class="footer-line">حرر بـ: ${escapeHtml(settingsData.displayMunicipality || '........')} في: ${escapeHtml(today)}</div>
                        <div class="footer-line">${escapeHtml(settingsData.displayJob || 'رئيس المركز')}</div>
                        <div>${escapeHtml(settingsData.displayPresident || '........')}</div>
                    </div>
                </div>
                ${PrintToolbarHelper.getScriptHtml({ advanced: false })}
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        if (!win) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.' });
            return;
        }

        win.document.write(printContent);
        win.document.close();
        win.focus();
    };

    const printStrips = async () => {

        try {

            // Trial Mode Check

            const authObj = window.Auth || (typeof Auth !== 'undefined' ? Auth : null);

            const user = authObj && authObj.getUser ? authObj.getUser() : null;

            if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {

                Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'طباعة القصاصات غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.' });

                return;

            }

            const hasGuardAssignments = Object.values(schedule || {}).some(assignments =>
                Array.isArray(assignments) && assignments.length > 0
            );
            const hasReserveAssignments = Object.values(reserveSchedule || {}).some(assignments =>
                Array.isArray(assignments) && assignments.length > 0
            );

            if (!hasGuardAssignments && !hasReserveAssignments) return showToast('الجدول فارغ', 'error');

            const settingsData = await getOfficialCenterData();

            // Find assigned teachers with robust checks
            // Refresh room cache for accurate labels
            try {
                let prd = await DB.get(STORAGE_KEYS.PERIOD_ROOMS);
                if (!prd) { const s = localStorage.getItem(STORAGE_KEYS.PERIOD_ROOMS); if (s) prd = JSON.parse(s); }
                if (prd) hydrateGlobalRoomCache(prd);
            } catch (cacheE) { /* ignore */ }

            const assignedTeachers = sortTeachersForScheduleOrder(teachers.filter(t => {
                if (t.isExempt) return false;
                const isGuardAssigned = Object.values(schedule || {}).some(assignments =>
                    Array.isArray(assignments) && assignments.includes(t.id)
                );
                const isReserveAssigned = Object.values(reserveSchedule || {}).some(assignments =>
                    Array.isArray(assignments) && assignments.includes(t.id)
                );

                return isGuardAssigned || isReserveAssigned;
            })).map(t => {

                // Get duties

                const duties = days.flatMap(d => {
                    const dayDuties = [];
                    const mTime = d.morning?.time || '08:00 - 12:00';
                    const midTime = d.midday?.time || '11:00 - 13:00';
                    const eTime = d.evening?.time || '13:00 - 17:00';

                    const getRoom = (key) => {
                        if (!showRooms) return null;
                        const ra = getEffectiveRoomAssignmentData(
                            roomAssignments,
                            key,
                            t.id,
                            Array.isArray(schedule[key]) && schedule[key].includes(t.id),
                            Array.isArray(reserveSchedule[key]) && reserveSchedule[key].includes(t.id)
                        );
                        if (!ra) return null;
                        if (ra.isReserve) return { label: 'احتياط', isReserve: true };
                        if (ra.room) return { label: getLocationLabelShort(ra.room), isReserve: false };
                        return null;
                    };

                    const morningKey = `${d.id}_morning`;
                    const middayKey = `${d.id}_midday`;
                    const eveningKey = `${d.id}_evening`;

                    const isMorningGuard = Array.isArray(schedule[morningKey]) && schedule[morningKey].includes(t.id);
                    const isMorningReserve = Array.isArray(reserveSchedule[morningKey]) && reserveSchedule[morningKey].includes(t.id);
                    const isMiddayGuard = Array.isArray(schedule[middayKey]) && schedule[middayKey].includes(t.id);
                    const isMiddayReserve = Array.isArray(reserveSchedule[middayKey]) && reserveSchedule[middayKey].includes(t.id);
                    const isEveningGuard = Array.isArray(schedule[eveningKey]) && schedule[eveningKey].includes(t.id);
                    const isEveningReserve = Array.isArray(reserveSchedule[eveningKey]) && reserveSchedule[eveningKey].includes(t.id);

                    if (isMorningGuard || isMorningReserve) {
                        dayDuties.push({
                            date: d.date,
                            period: 'صباح',
                            time: mTime,
                            room: getRoom(morningKey) || (isMorningReserve ? { label: 'احتياط', isReserve: true } : null)
                        });
                    }
                    if (isMiddayGuard || isMiddayReserve) {
                        dayDuties.push({
                            date: d.date,
                            period: 'منتصف',
                            time: midTime,
                            room: getRoom(middayKey) || (isMiddayReserve ? { label: 'احتياط', isReserve: true } : null)
                        });
                    }
                    if (isEveningGuard || isEveningReserve) {
                        dayDuties.push({
                            date: d.date,
                            period: 'مساء',
                            time: eTime,
                            room: getRoom(eveningKey) || (isEveningReserve ? { label: 'احتياط', isReserve: true } : null)
                        });
                    }
                    return dayDuties;
                });

                return { ...t, duties };

            });

            if (assignedTeachers.length === 0) return showToast('لا يوجد أساتذة معينين', 'error');

            setPendingPrintData({ assignedTeachers, settingsData });

            setIsPrintModalOpen(true);

        } catch (error) {

            console.error('Print Prep Error:', error);

            showToast('حدث خطأ أثناء التجهيز للطباعة: ' + error.message, 'error');

        }

    };

    const exportScheduleToExcel = async () => {

        try {

            if (!window.ExcelExportHelper) return showToast('ميزة تصدير Excel غير جاهزة حالياً', 'error');

            const hasGuardAssignments = Object.values(schedule || {}).some(assignments =>
                Array.isArray(assignments) && assignments.length > 0
            );
            const hasReserveAssignments = Object.values(reserveSchedule || {}).some(assignments =>
                Array.isArray(assignments) && assignments.length > 0
            );

            if (!hasGuardAssignments && !hasReserveAssignments) return showToast('الجدول فارغ', 'error');

            const settingsData = await getOfficialCenterData();
            const reportExamLabel = getOfficialReportExamLabel(trimester, settingsData.displayExam, settings.customExamStage || customExamStageDraft || 'middle');

            try {
                let prd = await DB.get(STORAGE_KEYS.PERIOD_ROOMS);
                if (!prd) {
                    const savedRooms = localStorage.getItem(STORAGE_KEYS.PERIOD_ROOMS);
                    if (savedRooms) prd = JSON.parse(savedRooms);
                }
                if (prd) hydrateGlobalRoomCache(prd);
            } catch (cacheError) {
                console.warn('Room cache refresh error:', cacheError);
            }

            const isPeriodActive = (day, period) => {
                if (!day || !day[period]) return false;
                const periodData = day[period];
                const subjects = (periodData.subjects || []).filter(subject => subject && subject.trim() !== '');
                const requiredTeachers = periodData.requiredTeachers !== undefined ? Number(periodData.requiredTeachers) : 2;
                return subjects.length > 0 || requiredTeachers > 0;
            };

            const activeDays = days.filter((day) => {
                return ['morning', 'midday', 'evening'].some((period) => isPeriodActive(day, period));
            });

            const activeTeachers = teachers
                .filter((teacher) => !teacher.isExempt)
                .sort((a, b) => {
                    const subjectA = (a.subjects && a.subjects[0]) ? a.subjects[0] : 'ززز';
                    const subjectB = (b.subjects && b.subjects[0]) ? b.subjects[0] : 'ززز';
                    return subjectA.localeCompare(subjectB, 'ar');
                });

            if (!activeDays.length || !activeTeachers.length) {
                return showToast('لا توجد بيانات صالحة للتصدير', 'error');
            }

            const headers = ['#', 'الأستاذ', 'المادة', 'الرتبة'];
            activeDays.forEach((day) => {
                ['morning', 'midday', 'evening'].forEach((period) => {
                    if (!isPeriodActive(day, period)) return;
                    const formattedDate = formatDateShort(day.date);
                    headers.push(`${formattedDate.dayName} ${formattedDate.dateFormatted} - ${getSupervisionPeriodShortLabel(period)}`);
                });
            });
            headers.push('المجموع');

            const rows = activeTeachers.map((teacher, index) => {
                const row = [
                    index + 1,
                    `${teacher.surname || ''} ${teacher.name || ''}`.trim(),
                    (teacher.subjects && teacher.subjects[0]) || '-',
                    shortenRank(teacher.rank) || '-'
                ];

                let totalAssignments = 0;

                activeDays.forEach((day) => {
                    ['morning', 'midday', 'evening'].forEach((period) => {
                        if (!isPeriodActive(day, period)) return;

                        const key = `${day.id}_${period}`;
                        const isAssigned = Array.isArray(schedule[key]) && schedule[key].includes(teacher.id);
                        const isReserve = Array.isArray(reserveSchedule[key]) && reserveSchedule[key].includes(teacher.id);
                        const isAbsentCell = Array.isArray(absenceSchedule[key]) && absenceSchedule[key].includes(teacher.id);
                        let value = '';

                        if (isAssigned || isReserve || isAbsentCell) {
                            totalAssignments += 1;
                            const roomData = getEffectiveRoomAssignmentData(roomAssignments, key, teacher.id, isAssigned, isReserve);
                            if (isAbsentCell) {
                                value = 'غياب';
                            } else if (roomData && roomData.isReserve) {
                                value = 'احتياط';
                            } else if (roomData && roomData.room) {
                                value = getLocationLabelShort(roomData.room) || '';
                            } else if (isReserve) {
                                value = 'احتياط';
                            } else {
                                value = settings.checkMark || '✓';
                            }
                        }

                        row.push(value);
                    });
                });

                row.push(totalAssignments);
                return row;
            });

            await window.ExcelExportHelper.exportWorkbook({
                fileName: `ط¬ط¯ظˆظ„_ط§ظ„ط­ط±ط§ط³ط©_${window.ExcelExportHelper.dateStamp()}.xlsx`,
                sheets: [{
                    sheetName: 'جدول الحراسة',
                    title: 'جدول الحراسة',
                    metaRows: [
                        `ط§ظ„ظ…ط±ظƒط²: ${settingsData.displayCenter} | ط§ظ„ظˆظ„ط§ظٹط©: ${settingsData.displayProvince}`,
                        `ط§ظ„ط§ظ…طھط­ط§ظ†: ${settingsData.displayExam} | ط§ظ„ط¯ظˆط±ط©: ${settingsData.displaySession}`,
                        `ط§ظ„ظپطµظ„: ${reportExamLabel}`,
                        `ط§ظ„ط¥ط­طµط§ط¦ظٹط§طھ: ط¹ط¯ط¯ ط§ظ„ط£ط³ط§طھط°ط© ${activeTeachers.length} | ط¹ط¯ط¯ ط§ظ„ط£ظٹط§ظ… ${activeDays.length} | ط§ظ„ط®ط§ظ†ط§طھ ط§ظ„ظ†ط´ط·ط© ${headers.length - 4}`
                    ],
                    headers: headers,
                    rows: rows
                }]
            });

        } catch (error) {

            console.error('Export Schedule Error:', error);
            showToast('حدث خطأ أثناء تصدير الجدول: ' + error.message, 'error');

        }

    };

    const executePrint = (customNotes, templateType = '1') => {

        setIsPrintModalOpen(false);

        if (!pendingPrintData) return;

        // Normalize notes
        if (!Array.isArray(customNotes)) customNotes = [customNotes || ''];

        const { assignedTeachers, settingsData } = pendingPrintData;
        const reportExamLabel = getOfficialReportExamLabel(trimester, settingsData.displayExam, settings.customExamStage || customExamStageDraft || 'middle');

        const trimesterMap = {
            '1': 'الفصل الأول',
            '2': 'الفصل الثاني',
            '3': 'الفصل الثالث',
            'custom': 'امتحان آخر',
            'blanc': 'شهادة التعليم المتوسط',
            'blanc_lycee': 'شهادة البكالوريا'
        };
        const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

        const notesHtml = customNotes.filter(n => n && n.trim()).length > 0
            ? customNotes.filter(n => n && n.trim()).map(n => '<div style="margin-bottom: 1px;">* ' + n + '</div>').join('')
            : '';
        const cleanNotes = customNotes.filter(n => n && n.trim());
        const escapeHtml = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const fixOfficialStripPrintEncoding = (html) => {
            let output = String(html || '');
            [
                ['\u0638\u2026\u0637\xb1\u0638\u0192\u0637\xb2 \u0637\xa7\u0638\u201e\u0637\xa5\u0637\xac\u0637\xb1\u0637\xa7\u0637\u060c', '\u0645\u0631\u0643\u0632 \u0627\u0644\u0625\u062c\u0631\u0627\u0621'],
                ['\u0637\xa7\u0638\u201e\u0637\xb4\u0638\u2021\u0637\xa7\u0637\xaf\u0637\xa9', '\u0627\u0644\u0634\u0647\u0627\u062f\u0629'],
                ['\u0637\xa7\u0638\u201e\u0637\xaf\u0638\u02c6\u0637\xb1\u0637\xa9', '\u0627\u0644\u062f\u0648\u0631\u0629'],
                ['\u00c7\u00e1\u00dd\u00ca\u00d1\u00c9 / \u00c7\u00e1\u00ed\u00e6\u00e3', '\u0627\u0644\u0641\u062a\u0631\u0629 / \u0627\u0644\u064a\u0648\u0645'],
                ['\u00c7\u00e1\u00e3\u00d1\u00df\u00d2 \u00c7\u00e1\u00d1\u00d3\u00e3\u00ed', '\u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0631\u0633\u0645\u064a'],
                ['\u00c7\u00d3\u00ca\u00cf\u00da\u00c7\u00c1 \u00cd\u00d1\u00c7\u00d3\u00c9', '\u0627\u0633\u062a\u062f\u0639\u0627\u0621 \u062d\u0631\u0627\u0633\u0629'],
                ['\u00c7\u00e1\u00c3\u00d3\u00ca\u00c7\u00d0(\u00c9)', '\u0627\u0644\u0623\u0633\u062a\u0627\u0630(\u0629)'],
                ['\u00c7\u00e1\u00c5\u00e3\u00d6\u00c7\u00c1', '\u0627\u0644\u0625\u0645\u0636\u0627\u0621'],
                ['\u00d8\u00c8\u00c7\u00da\u00c9 \u00c7\u00e1\u00de\u00d5\u00c7\u00d5\u00c7\u00ca', '\u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u0642\u0635\u0627\u0635\u0627\u062a']
            ].forEach(([from, to]) => {
                output = output.split(from).join(to);
            });
            if (!/<meta\s+charset/i.test(output)) {
                output = output.replace('<head><title>', '<head><meta charset="UTF-8"><title>');
            }
            return output;
        };
        const printLogoSrc = '../assets/diwan.png';
        const printBaseHref = window.location.href;
        const buildPrintLogoHtml = (className) => '<img src="' + escapeHtml(printLogoSrc) + '" alt="شعار" class="' + escapeHtml(className || '') + '" onerror="this.style.display=\'none\'">';

        const getFirstPeriodTime = (duties, periodKey) => {
            const match = (duties || []).find((duty) => duty.period === periodKey && duty.time && String(duty.time).trim());
            return match ? String(match.time).trim() : '';
        };

        const buildInlinePeriodLabelHtml = (label, time, wrapperClass, timeClass) => {
            const timeHtml = time
                ? '<span class="' + escapeHtml(timeClass) + '">' + escapeHtml(time) + '</span>'
                : '';
            return '<div class="' + escapeHtml(wrapperClass) + '">' + escapeHtml(label) + timeHtml + '</div>';
        };

        const stripsPerPage = 3;

        if (templateType === '3') {
            try {
                const mark = settings.checkMark || '✓';
                const issueDate = new Date().toLocaleDateString('ar-DZ');

                const buildTeacherDutyData = (teacher) => {
                    const dutyMap = {};
                    const allDates = [];

                    teacher.duties.forEach((duty) => {
                        if (!dutyMap[duty.date]) {
                            dutyMap[duty.date] = {};
                            allDates.push(duty.date);
                        }
                        dutyMap[duty.date][duty.period] = { time: duty.time, room: duty.room };
                    });

                    const periodDefs = [
                        {
                            key: 'صباح',
                            label: 'ف.صباحية',
                            time: getFirstPeriodTime(teacher.duties, 'صباح')
                        },
                        {
                            key: 'منتصف',
                            label: 'ف.منتصف',
                            time: getFirstPeriodTime(teacher.duties, 'منتصف')
                        },
                        {
                            key: 'مساء',
                            label: 'ف.مسائية',
                            time: getFirstPeriodTime(teacher.duties, 'مساء')
                        }
                    ].filter((period) => teacher.duties.some((d) => d.period === period.key));
                    periodDefs.forEach((period) => {
                        period.time = getFirstPeriodTime(teacher.duties, period.key);
                    });

                    const getCellContent = (date, period) => {
                        const entry = dutyMap[date] && dutyMap[date][period];
                        if (!entry) return '';
                        if (entry.room && !entry.room.isReserve) return escapeHtml(entry.room.label);
                        return escapeHtml(mark);
                    };

                    return { allDates, periodDefs, getCellContent };
                };

                const buildFormalTable = (teacherData) => {
                    const { allDates, periodDefs, getCellContent } = teacherData;
                    let headerCols = '<th class="formal-corner">الفترة / اليوم</th>';

                    allDates.forEach((date) => {
                        const formatted = formatDateShort(date);
                        headerCols += '<th><div class="formal-day-name">' + escapeHtml(formatted.dayName) + '</div><div class="formal-day-date">' + escapeHtml(formatted.dateFormatted) + '</div></th>';
                    });

                    const rows = periodDefs.map((period) => {
                        let cells = '<td class="formal-period-cell">' + buildInlinePeriodLabelHtml(period.label, period.time, 'formal-period-inline', 'formal-period-time');
                        cells += '</td>';

                        allDates.forEach((date) => {
                            cells += '<td class="formal-check-cell">' + getCellContent(date, period.key) + '</td>';
                        });

                        return '<tr>' + cells + '</tr>';
                    }).join('');

                    return '<table class="formal-table"><thead><tr>' + headerCols + '</tr></thead><tbody>' + rows + '</tbody></table>';
                };

                const buildFormalStrip = (teacher, stripNumber) => {
                    const teacherData = buildTeacherDutyData(teacher);
                    const tableHtml = buildFormalTable(teacherData);
                    const subjectText = teacher.subjects && teacher.subjects.length > 0
                        ? teacher.subjects.join(' - ')
                        : 'غير محددة';
                    const noteListHtml = cleanNotes.length > 0
                        ? '<ul class="formal-notes-list">' + cleanNotes.map((note) => '<li>' + escapeHtml(note) + '</li>').join('') + '</ul>'
                        : '<div class="formal-empty-note">لا توجد ملاحظات إضافية.</div>';

                    return `
                    <section class="strip formal-strip">
                        <div class="formal-strip-number">#${stripNumber}</div>
                        <div class="formal-header">
                            <div class="formal-country">الجمهورية الجزائرية الديمقراطية الشعبية</div>
                            <div class="formal-ministry">وزارة التربية الوطنية</div>
                        </div>

                        <div class="formal-meta-row">
                            <div class="formal-meta-item formal-meta-school">المركز: ${escapeHtml(settingsData.displayCenter || '........................')}</div>
                            <div class="formal-meta-item formal-meta-year">${escapeHtml(settingsData.displayExam || '........................')} - ${escapeHtml(settingsData.displaySession || '........................')}</div>
                        </div>

                        <div class="formal-title-block">
                            <div class="formal-title">استدعاء الأستاذ للحراسة</div>
                            <div class="formal-title-sub">${escapeHtml(reportExamLabel)}</div>
                        </div>

                        <div class="formal-teacher-row">
                            <div class="formal-teacher-name">الأستاذ(ة): ${escapeHtml((teacher.surname || '') + ' ' + (teacher.name || ''))} <span style="font-size: 0.8em; color: #555;">(${escapeHtml(shortenRank(teacher.rank))})</span></div>
                            <div class="formal-teacher-subject">المادة: ${escapeHtml(subjectText)}</div>
                        </div>

                        ${tableHtml}

                        <div class="formal-footer">
                            <div class="formal-notes-box">
                                <div class="formal-footer-title">ملاحظات</div>
                                ${noteListHtml}
                            </div>
                            <div class="formal-signature-box">
                                <div class="formal-issue-line">حرر بـ: ${escapeHtml(settingsData.displayMunicipality || '................')}</div>
                                <div class="formal-issue-line">في: ${escapeHtml(issueDate)}</div>
                                <div class="formal-issue-line">${escapeHtml(settingsData.displayJob || 'رئيس المركز')}</div>
                                <div class="formal-signature-line">${escapeHtml(settingsData.displayPresident || '........................')}</div>
                            </div>
                        </div>
                    </section>
                    `;
                };

                const buildFormalStripV2 = (teacher, stripNumber) => {
                    const dutyMap = {};
                    const allDates = [];
                    (teacher.duties || []).forEach((duty) => {
                        if (!dutyMap[duty.date]) {
                            dutyMap[duty.date] = {};
                            allDates.push(duty.date);
                        }
                        dutyMap[duty.date][duty.period] = { time: duty.time, room: duty.room };
                    });

                    const periodDefs = [
                        { key: 'صباح', label: 'ف.صباحية' },
                        { key: 'منتصف', label: 'ف.منتصف' },
                        { key: 'مساء', label: 'ف.مسائية' }
                    ].filter((period) => (teacher.duties || []).some((d) => d.period === period.key));
                    periodDefs.forEach((period) => {
                        period.time = getFirstPeriodTime(teacher.duties, period.key);
                    });

                    const tableHeader = '<th class="formal-corner">الفترة / اليوم</th>' + allDates.map((date) => {
                        const formatted = formatDateShort(date);
                        return '<th><div class="formal-day-name">' + escapeHtml(formatted.dayName) + '</div><div class="formal-day-date">' + escapeHtml(formatted.dateFormatted) + '</div></th>';
                    }).join('');

                    const tableRows = periodDefs.map((period) => {
                        let rowHtml = '<td class="formal-period-cell">' + buildInlinePeriodLabelHtml(period.label, period.time, 'formal-period-inline', 'formal-period-time') + '</td>';
                        allDates.forEach((date) => {
                            const entry = dutyMap[date] && dutyMap[date][period.key];
                            if (!entry) {
                                rowHtml += '<td class="formal-check-cell"></td>';
                                return;
                            }
                            const mainValue = (entry.room && !entry.room.isReserve) ? escapeHtml(entry.room.label) : escapeHtml(mark);
                            rowHtml += '<td class="formal-check-cell"><div class="formal-cell-main">' + mainValue + '</div></td>';
                        });
                        return '<tr>' + rowHtml + '</tr>';
                    }).join('');

                    const subjectText = teacher.subjects && teacher.subjects.length > 0
                        ? teacher.subjects.join(' - ')
                        : 'غير محددة';
                    const noteListHtml = cleanNotes.length > 0
                        ? '<ul class="formal-notes-list">' + cleanNotes.map((note) => '<li>' + escapeHtml(note) + '</li>').join('') + '</ul>'
                        : '<div class="formal-empty-note">لا توجد ملاحظات إضافية.</div>';

                    return `
                    <section class="strip formal-strip">
                        <div class="formal-strip-number">#${stripNumber}</div>
                        <div class="formal-header">
                            <div class="formal-header-grid">
                                <div class="formal-logo-box">${buildPrintLogoHtml('formal-logo')}</div>
                                <div class="formal-header-text">
                                    <div class="formal-country">الجمهورية الجزائرية الديمقراطية الشعبية</div>
                                    <div class="formal-ministry">وزارة التربية الوطنية</div>
                                </div>
                                <div class="formal-logo-box">${buildPrintLogoHtml('formal-logo')}</div>
                            </div>
                        </div>
                        <div class="formal-meta-row">
                            <div class="formal-meta-item formal-meta-school">مركز الإجراء: ${escapeHtml(settingsData.displayCenter || '........................')}</div>
                            <div class="formal-meta-item formal-meta-year">الشهادة: ${escapeHtml(settingsData.displayExam || '........................')}</div>
                        </div>
                        <div class="formal-meta-row">
                            <div class="formal-meta-item formal-meta-full">الدورة: ${escapeHtml(settingsData.displaySession || '........................')}</div>
                        </div>
                        <div class="formal-title-block">
                            <div class="formal-title">استدعاء الأستاذ للحراسة</div>
                            <div class="formal-title-sub">${escapeHtml(reportExamLabel)}</div>
                        </div>
                        <div class="formal-teacher-row">
                            <div class="formal-teacher-name">الأستاذ(ة): ${escapeHtml((teacher.surname || '') + ' ' + (teacher.name || ''))} <span style="font-size: 0.8em; color: #555;">(${escapeHtml(shortenRank(teacher.rank))})</span></div>
                            <div class="formal-teacher-subject">المادة: ${escapeHtml(subjectText)}</div>
                        </div>
                        <table class="formal-table"><thead><tr>${tableHeader}</tr></thead><tbody>${tableRows}</tbody></table>
                        <div class="formal-footer">
                            <div class="formal-notes-box">
                                <div class="formal-footer-title">ملاحظات</div>
                                ${noteListHtml}
                            </div>
                            <div class="formal-signature-box">
                                <div class="formal-issue-line">حرر بـ: ${escapeHtml(settingsData.displayMunicipality || '................')}</div>
                                <div class="formal-issue-line">في: ${escapeHtml(issueDate)}</div>
                                <div class="formal-issue-line">${escapeHtml(settingsData.displayJob || 'رئيس المركز')}</div>
                                <div class="formal-signature-line">${escapeHtml(settingsData.displayPresident || '........................')}</div>
                            </div>
                        </div>
                    </section>
                    `;
                };

                const stripsHtml = Array.from({ length: Math.ceil(assignedTeachers.length / stripsPerPage) }, (_, pageIndex) => {
                    const pageTeachers = assignedTeachers.slice(pageIndex * stripsPerPage, pageIndex * stripsPerPage + stripsPerPage);
                    return '<div class="formal-page">' + pageTeachers.map((teacher, teacherIndex) => buildFormalStripV2(teacher, pageIndex * stripsPerPage + teacherIndex + 1)).join('') + '</div>';
                }).join('');
                const escapedIssueDate = escapeHtml(issueDate);
                const escapedIssueDatePattern = escapedIssueDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const normalizedFormalStripsHtml = stripsHtml.replace(
                    new RegExp(`<div class="formal-issue-line">[^<]*${escapedIssueDatePattern}<\\/div>`, 'g'),
                    `<div class="formal-issue-line">في: ${escapedIssueDate}</div>`
                );

                const printContent = `
                <!DOCTYPE html>
                <html dir="rtl">
                <head><title>طباعة القصاصات</title>
                <base href="${escapeHtml(printBaseHref)}">
                <style>
                    @page { size: A4 portrait; margin: 0.8cm; }
                    :root {
                        --formal-page-safe-height: 27.2cm;
                        --formal-page-gap: 0.28cm;
                    }
                    body { font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif; direction: rtl; margin: 0; padding: 0; color: #000; background: #fff; }
                    .formal-page {
                        height: var(--formal-page-safe-height);
                        display: flex;
                        flex-direction: column;
                        gap: var(--formal-page-gap);
                        box-sizing: border-box;
                        page-break-after: always;
                    }
                    .formal-page:last-child { page-break-after: auto; }
                    .formal-strip {
                        flex: 0 0 calc((var(--formal-page-safe-height) - (var(--formal-page-gap) * 2)) / 3);
                        height: calc((var(--formal-page-safe-height) - (var(--formal-page-gap) * 2)) / 3);
                        border: 1.4px solid #000;
                        padding: 0.22cm 0.28cm;
                        display: flex;
                        flex-direction: column;
                        page-break-inside: avoid;
                        box-sizing: border-box;
                        position: relative;
                        overflow: hidden;
                    }
                    .formal-strip-number {
                        position: absolute;
                        top: 0.14cm;
                        left: 0.18cm;
                        border: 1px solid #9ca3af;
                        border-radius: 999px;
                        padding: 0.01cm 0.16cm;
                        font-size: 7.4px;
                        font-weight: 800;
                        line-height: 1.2;
                        color: #4b5563;
                        background: #fff;
                    }
                    .formal-header {
                        border-bottom: 1px solid #000;
                        padding-bottom: 0.08cm;
                        margin-bottom: 0.12cm;
                    }
                    .formal-header-grid {
                        display: grid;
                        grid-template-columns: 48px 1fr 48px;
                        align-items: center;
                        gap: 0.15cm;
                    }
                    .formal-header-text { text-align: center; }
                    .formal-logo-box {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .formal-logo {
                        width: 38px;
                        height: 38px;
                        object-fit: contain;
                    }
                    .formal-country,
                    .formal-ministry {
                        font-weight: 700;
                        font-size: 10.5px;
                        line-height: 1.25;
                    }
                    .formal-meta-row {
                        display: flex;
                        justify-content: space-between;
                        gap: 0.25cm;
                        margin-bottom: 0.12cm;
                        font-size: 9.6px;
                        font-weight: 700;
                    }
                    .formal-meta-item { width: 50%; }
                    .formal-meta-school { text-align: right; }
                    .formal-meta-year { text-align: left; }
                    .formal-meta-full {
                        width: 100%;
                        text-align: right;
                    }
                    .formal-title-block {
                        text-align: center;
                        margin-bottom: 0.12cm;
                    }
                    .formal-title {
                        font-size: 11px;
                        font-weight: 800;
                        text-decoration: underline;
                        margin-bottom: 0.02cm;
                    }
                    .formal-title-sub {
                        font-size: 9px;
                        font-weight: 700;
                    }
                    .formal-teacher-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 0.2cm;
                        border: 1px solid #000;
                        padding: 0.08cm 0.12cm;
                        margin-bottom: 0.12cm;
                        font-size: 9.6px;
                        font-weight: 700;
                    }
                    .formal-teacher-name,
                    .formal-teacher-subject { width: 50%; }
                    .formal-teacher-name { text-align: right; }
                    .formal-teacher-subject { text-align: left; }
                    .formal-table {
                        width: 100%;
                        border-collapse: collapse;
                        table-layout: fixed;
                        font-size: 9.1px;
                        margin-bottom: 0.12cm;
                    }
                    .formal-table th,
                    .formal-table td {
                        border: 1px solid #000;
                        padding: 0.05cm 0.06cm;
                        text-align: center;
                        vertical-align: middle;
                        color: #000;
                    }
                    .formal-table th {
                        font-weight: 800;
                        background: #f5f5f5 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .formal-corner { width: 22%; }
                    .formal-day-name {
                        font-weight: 800;
                        line-height: 1.1;
                    }
                    .formal-day-date {
                        font-size: 8px;
                        font-weight: 600;
                        margin-top: 1px;
                    }
                    .formal-period-cell {
                        font-weight: 800;
                        font-size: 8.8px;
                    }
                    .formal-period-inline {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 4px;
                        flex-wrap: wrap;
                        line-height: 1.1;
                    }
                    .formal-period-time {
                        font-size: 7.6px;
                        font-weight: 600;
                    }
                    .formal-check-cell {
                        font-weight: 800;
                        font-size: 10px;
                    }
                    .formal-cell-main { font-weight: 800; }
                    .formal-footer {
                        margin-top: auto;
                        display: flex;
                        gap: 0.22cm;
                        align-items: stretch;
                    }
                    .formal-notes-box,
                    .formal-signature-box {
                        border: 1px solid #000;
                        padding: 0.1cm 0.14cm;
                        min-height: 1.65cm;
                        box-sizing: border-box;
                    }
                    .formal-notes-box { flex: 1.45; }
                    .formal-signature-box {
                        width: 34%;
                        text-align: center;
                    }
                    .formal-footer-title {
                        font-weight: 800;
                        font-size: 9px;
                        margin-bottom: 0.08cm;
                        border-bottom: 1px solid #000;
                        padding-bottom: 0.03cm;
                    }
                    .formal-notes-list {
                        margin: 0;
                        padding: 0 0.35cm 0 0;
                        font-size: 7.9px;
                        line-height: 1.35;
                    }
                    .formal-notes-list li { margin-bottom: 0.03cm; }
                    .formal-empty-note {
                        font-size: 8px;
                        color: #444;
                        text-align: right;
                        padding-top: 0.12cm;
                    }
                    .formal-issue-line {
                        font-size: 8.3px;
                        font-weight: 700;
                        margin-bottom: 0.09cm;
                        text-align: center;
                    }
                    .formal-signature-line {
                        margin-top: 0.22cm;
                        font-size: 8.5px;
                        font-weight: 800;
                    }
                </style>
                ${PrintToolbarHelper.getHeadContent()}
                </head>
                <body>
                ${PrintToolbarHelper.getToolbarHtml({ advanced: false })}
                    ${normalizedFormalStripsHtml}
                ${PrintToolbarHelper.getScriptHtml({ advanced: false })}
                </body>
                </html>
                `;

                const win = window.open('', '_blank');

                if (!win) {
                    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.' });
                    return;
                }

                win.document.write(fixOfficialStripPrintEncoding(printContent));
                win.document.close();
                win.focus();
                return;
            } catch (error) {
                console.error('Formal Print Execute Error:', error);
                showToast('حدث خطأ أثناء الطباعة: ' + error.message, 'error');
                return;
            }
        }

        if (templateType === '4') {
            try {
                const mark = settings.checkMark || '✓';
                const issueDate = new Date().toLocaleDateString('ar-DZ');
                const safeNoteList = cleanNotes.slice(0, 4);
                const buildModernStrip = (teacher, stripNumber) => {
                    const dutyMap = {};
                    const allDates = [];
                    (teacher.duties || []).forEach((duty) => {
                        if (!dutyMap[duty.date]) {
                            dutyMap[duty.date] = {};
                            allDates.push(duty.date);
                        }
                        dutyMap[duty.date][duty.period] = { time: duty.time, room: duty.room };
                    });

                    const periodDefs = [
                        { key: 'صباح', label: 'صباحية' },
                        { key: 'منتصف', label: 'منتصف' },
                        { key: 'مساء', label: 'مسائية' }
                    ].filter((period) => (teacher.duties || []).some((duty) => duty.period === period.key));

                    const summaryChips = [
                        `عدد التكليفات: ${(teacher.duties || []).length}`,
                        `الرتبة: ${shortenRank(teacher.rank) || '-'}`,
                        `المادة: ${teacher.subjects && teacher.subjects.length ? teacher.subjects.join(' - ') : 'غير محددة'}`,
                        `المؤسسة: ${teacher.institution || '-'}`
                    ];

                    const tableHeader = allDates.map((date) => {
                        const formatted = formatDateShort(date);
                        return `
                            <th>
                                <div class="modern-day-name">${escapeHtml(formatted.dayName)}</div>
                                <div class="modern-day-date">${escapeHtml(formatted.dateFormatted)}</div>
                            </th>
                        `;
                    }).join('');

                    const tableRows = periodDefs.map((period) => {
                        const periodTime = getFirstPeriodTime(teacher.duties, period.key);
                        const cells = allDates.map((date) => {
                            const entry = dutyMap[date] && dutyMap[date][period.key];
                            if (!entry) return '<td class="modern-empty-cell"></td>';
                            const mainValue = (entry.room && !entry.room.isReserve)
                                ? escapeHtml(entry.room.label)
                                : escapeHtml(mark);
                            const isReserve = !entry.room || entry.room.isReserve;
                            return `<td class="modern-check-cell${isReserve ? ' modern-reserve-cell' : ''}">${mainValue}</td>`;
                        }).join('');
                        return `
                            <tr>
                                <td class="modern-period-cell">
                                    <div class="modern-period-label">${escapeHtml(period.label)}</div>
                                    ${periodTime ? `<div class="modern-period-time">${escapeHtml(periodTime)}</div>` : ''}
                                </td>
                                ${cells}
                            </tr>
                        `;
                    }).join('');

                    const noteHtml = safeNoteList.length
                        ? `<div class="modern-notes">${safeNoteList.map((note) => `<span class="modern-note-chip">${escapeHtml(note)}</span>`).join('')}</div>`
                        : '<div class="modern-notes modern-notes-empty">بدون ملاحظات إضافية</div>';

                    return `
                        <section class="modern-strip">
                            <div class="modern-strip-accent"></div>
                            <div class="modern-strip-number">#${stripNumber}</div>
                            <div class="modern-header">
                                <div class="modern-header-side">${buildPrintLogoHtml('modern-logo')}</div>
                                <div class="modern-header-main">
                                    <div class="modern-kicker">بطاقة استدعاء للحراسة</div>
                                    <div class="modern-title">${escapeHtml(reportExamLabel)}</div>
                                    <div class="modern-center-line">${escapeHtml(settingsData.displayCenter || 'المركز الرسمي')}</div>
                                </div>
                                <div class="modern-header-side">${buildPrintLogoHtml('modern-logo')}</div>
                            </div>
                            <div class="modern-teacher-card">
                                <div class="modern-teacher-name">${escapeHtml(`${teacher.surname || ''} ${teacher.name || ''}`.trim())}</div>
                                <div class="modern-chip-row">
                                    ${summaryChips.map((chip) => `<span class="modern-chip">${escapeHtml(chip)}</span>`).join('')}
                                </div>
                            </div>
                            <table class="modern-table">
                                <thead>
                                    <tr>
                                        <th class="modern-corner">الفترة / اليوم</th>
                                        ${tableHeader}
                                    </tr>
                                </thead>
                                <tbody>${tableRows}</tbody>
                            </table>
                            ${noteHtml}
                            <div class="modern-footer">
                                <div class="modern-footer-line">حرر بـ: ${escapeHtml(settingsData.displayMunicipality || '........')} | في: ${escapeHtml(issueDate)}</div>
                                <div class="modern-footer-line">${escapeHtml(settingsData.displayJob || 'رئيس المركز')} - ${escapeHtml(settingsData.displayPresident || '........')}</div>
                            </div>
                        </section>
                    `;
                };

                const stripsHtml = Array.from({ length: Math.ceil(assignedTeachers.length / stripsPerPage) }, (_, pageIndex) => {
                    const pageTeachers = assignedTeachers.slice(pageIndex * stripsPerPage, pageIndex * stripsPerPage + stripsPerPage);
                    return '<div class="modern-page">' + pageTeachers.map((teacher, teacherIndex) => buildModernStrip(teacher, pageIndex * stripsPerPage + teacherIndex + 1)).join('') + '</div>';
                }).join('');

                const printContent = `
                <!DOCTYPE html>
                <html dir="rtl">
                <head><title>طباعة القصاصات</title>
                <base href="${escapeHtml(printBaseHref)}">
                <style>
                    @page { size: A4 portrait; margin: 0.75cm; }
                    :root {
                        --modern-page-safe-height: 27.5cm;
                        --modern-page-gap: 0.24cm;
                        --modern-primary: #0f766e;
                        --modern-secondary: #f97316;
                        --modern-ink: #0f172a;
                        --modern-soft: #fff7ed;
                        --modern-soft-2: #f0fdfa;
                    }
                    body {
                        font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif;
                        direction: rtl;
                        margin: 0;
                        padding: 0;
                        color: var(--modern-ink);
                        background: #fff;
                    }
                    .modern-page {
                        height: var(--modern-page-safe-height);
                        display: flex;
                        flex-direction: column;
                        gap: var(--modern-page-gap);
                        box-sizing: border-box;
                        page-break-after: always;
                    }
                    .modern-page:last-child { page-break-after: auto; }
                    .modern-strip {
                        position: relative;
                        flex: 0 0 calc((var(--modern-page-safe-height) - (var(--modern-page-gap) * 2)) / 3);
                        height: calc((var(--modern-page-safe-height) - (var(--modern-page-gap) * 2)) / 3);
                        border: 1px solid #cbd5e1;
                        border-radius: 16px;
                        padding: 0.28cm 0.32cm 0.22cm;
                        box-sizing: border-box;
                        background:
                            radial-gradient(circle at top right, rgba(249, 115, 22, 0.10), transparent 26%),
                            radial-gradient(circle at top left, rgba(15, 118, 110, 0.10), transparent 28%),
                            linear-gradient(135deg, #ffffff, #f8fafc);
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }
                    .modern-strip-accent {
                        position: absolute;
                        inset: 0 auto auto 0;
                        width: 100%;
                        height: 8px;
                        background: linear-gradient(90deg, var(--modern-secondary), var(--modern-primary));
                    }
                    .modern-strip-number {
                        position: absolute;
                        top: 0.26cm;
                        left: 0.26cm;
                        min-width: 22px;
                        padding: 2px 8px;
                        border-radius: 999px;
                        background: #fff;
                        border: 1px solid #cbd5e1;
                        font-size: 8px;
                        font-weight: 800;
                        line-height: 1.2;
                        color: #475569;
                        text-align: center;
                    }
                    .modern-header {
                        display: grid;
                        grid-template-columns: 34px 1fr 34px;
                        align-items: center;
                        gap: 0.18cm;
                        margin-bottom: 0.14cm;
                        padding-top: 0.08cm;
                    }
                    .modern-header-side {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .modern-logo {
                        width: 30px;
                        height: 30px;
                        object-fit: contain;
                    }
                    .modern-header-main {
                        text-align: center;
                    }
                    .modern-kicker {
                        font-size: 8.8px;
                        font-weight: 800;
                        letter-spacing: 0.2px;
                        color: var(--modern-primary);
                    }
                    .modern-title {
                        font-size: 12.4px;
                        font-weight: 900;
                        line-height: 1.2;
                        color: var(--modern-ink);
                    }
                    .modern-center-line {
                        font-size: 9px;
                        font-weight: 700;
                        color: #475569;
                    }
                    .modern-teacher-card {
                        background: linear-gradient(135deg, var(--modern-soft), var(--modern-soft-2));
                        border: 1px solid #dbeafe;
                        border-radius: 12px;
                        padding: 0.12cm 0.16cm;
                        margin-bottom: 0.14cm;
                    }
                    .modern-teacher-name {
                        font-size: 12px;
                        font-weight: 900;
                        text-align: center;
                        margin-bottom: 0.08cm;
                    }
                    .modern-chip-row,
                    .modern-notes {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 4px;
                        justify-content: center;
                    }
                    .modern-chip,
                    .modern-note-chip {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 999px;
                        padding: 2px 8px;
                        font-size: 8.1px;
                        font-weight: 800;
                        line-height: 1.25;
                    }
                    .modern-chip {
                        background: rgba(255,255,255,0.85);
                        border: 1px solid #bfdbfe;
                        color: #0f172a;
                    }
                    .modern-note-chip {
                        background: #fff;
                        border: 1px dashed #fdba74;
                        color: #9a3412;
                    }
                    .modern-notes {
                        margin-top: 0.12cm;
                        margin-bottom: 0.12cm;
                        min-height: 0.42cm;
                    }
                    .modern-notes-empty {
                        justify-content: center;
                        color: #64748b;
                        font-size: 7.9px;
                        font-weight: 700;
                    }
                    .modern-table {
                        width: 100%;
                        border-collapse: separate;
                        border-spacing: 0;
                        table-layout: fixed;
                        font-size: 8.8px;
                        overflow: hidden;
                        border-radius: 12px;
                        border: 1px solid #cbd5e1;
                        background: #fff;
                    }
                    .modern-table th,
                    .modern-table td {
                        border-left: 1px solid #e2e8f0;
                        border-bottom: 1px solid #e2e8f0;
                        padding: 0.05cm 0.06cm;
                        text-align: center;
                        vertical-align: middle;
                        color: var(--modern-ink);
                    }
                    .modern-table th:last-child,
                    .modern-table td:last-child { border-left: none; }
                    .modern-table tbody tr:last-child td { border-bottom: none; }
                    .modern-table thead th {
                        background: linear-gradient(135deg, rgba(15, 118, 110, 0.14), rgba(249, 115, 22, 0.14)) !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        font-weight: 900;
                    }
                    .modern-corner {
                        width: 22%;
                    }
                    .modern-day-name {
                        font-size: 8.5px;
                        font-weight: 900;
                        line-height: 1.1;
                    }
                    .modern-day-date {
                        font-size: 7.4px;
                        font-weight: 700;
                        color: #475569;
                        margin-top: 1px;
                    }
                    .modern-period-cell {
                        background: #f8fafc;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .modern-period-label {
                        font-size: 8.4px;
                        font-weight: 900;
                    }
                    .modern-period-time {
                        font-size: 7.2px;
                        font-weight: 700;
                        color: #475569;
                        margin-top: 1px;
                    }
                    .modern-check-cell {
                        font-size: 9.5px;
                        font-weight: 900;
                    }
                    .modern-reserve-cell {
                        color: #9a3412;
                    }
                    .modern-empty-cell {
                        background: #fff;
                    }
                    .modern-footer {
                        margin-top: auto;
                        border-top: 1px dashed #cbd5e1;
                        padding-top: 0.08cm;
                        text-align: center;
                    }
                    .modern-footer-line {
                        font-size: 8.1px;
                        font-weight: 800;
                        color: #334155;
                        line-height: 1.35;
                    }
                </style>
                ${PrintToolbarHelper.getHeadContent()}
                </head>
                <body>
                ${PrintToolbarHelper.getToolbarHtml({ advanced: false })}
                    ${stripsHtml}
                ${PrintToolbarHelper.getScriptHtml({ advanced: false })}
                </body>
                </html>
                `;

                const win = window.open('', '_blank');

                if (!win) {
                    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.' });
                    return;
                }

                win.document.write(fixOfficialStripPrintEncoding(printContent));
                win.document.close();
                win.focus();
                return;
            } catch (error) {
                console.error('Modern Print Execute Error:', error);
                showToast('حدث خطأ أثناء الطباعة: ' + error.message, 'error');
                return;
            }
        }

        try {

            const stripCardsHtml = assignedTeachers.map((t, stripIndex) => {
                // Group duties by date
                const dutyMap = {};
                const allDates = [];
                // Store room info per date+period for this teacher
                t.duties.forEach(d => {
                    if (!dutyMap[d.date]) {
                        dutyMap[d.date] = {};
                        allDates.push(d.date);
                    }
                    dutyMap[d.date][d.period] = { time: d.time, room: d.room };
                });

                // Determine which periods exist
                const hasMorning = t.duties.some(d => d.period === 'صباح');
                const hasMidday = t.duties.some(d => d.period === 'منتصف');
                const hasEvening = t.duties.some(d => d.period === 'مساء');

                const mark = settings.checkMark || '✓';
                // Helper to get cell content
                const getCellContent = (date, period) => {
                    const entry = dutyMap[date] && dutyMap[date][period];
                    if (!entry) return '';
                    const mainValue = (entry.room && !entry.room.isReserve) ? escapeHtml(entry.room.label) : escapeHtml(mark);
                    return '<div class="strip-cell-main">' + mainValue + '</div>';
                };

                let headerCols = '';
                let rows = '';

                if (templateType === '2') {
                    // Template 2: Days in columns, Periods in rows
                    headerCols = '<th class="col-date">الفترة / اليوم</th>';
                    allDates.forEach(date => {
                        let fd = formatDateShort(date);
                        headerCols += '<th style="min-width: 65px;">' + fd.dayName + '<br>' + fd.dateFormatted + '</th>';
                    });

                    const buildPeriodRow = (periodKey, periodLabel) => {
                        const periodTime = getFirstPeriodTime(t.duties, periodKey);
                        let rowStr = '<td class="date-cell" style="text-align: center;">' + buildInlinePeriodLabelHtml(periodLabel, periodTime, 'strip-period-inline', 'strip-period-time') + '</td>';
                        allDates.forEach(date => {
                            rowStr += '<td class="check-cell">' + getCellContent(date, periodKey) + '</td>';
                        });
                        return '<tr>' + rowStr + '</tr>';
                    };

                    const mappedRows = [];
                    if (hasMorning) mappedRows.push(buildPeriodRow('\u0635\u0628\u0627\u062d', '\u0641.\u0635\u0628\u0627\u062d\u064a\u0629'));
                    if (hasMidday) mappedRows.push(buildPeriodRow('\u0645\u0646\u062a\u0635\u0641', '\u0641.\u0645\u0646\u062a\u0635\u0641'));
                    if (hasEvening) mappedRows.push(buildPeriodRow('\u0645\u0633\u0627\u0621', '\u0641.\u0645\u0633\u0627\u0626\u064a\u0629'));
                    rows = mappedRows.join('');
                } else {
                    // Build header columns
                    headerCols = '<th class="col-date">\u0627\u0644\u064a\u0648\u0645 \u0648\u0627\u0644\u062a\u0627\u0631\u064a\u062e</th>';
                    if (hasMorning) headerCols += '<th>' + buildInlinePeriodLabelHtml('\u0641.\u0635\u0628\u0627\u062d\u064a\u0629', getFirstPeriodTime(t.duties, '\u0635\u0628\u0627\u062d'), 'strip-period-inline', 'strip-period-time') + '</th>';
                    if (hasMidday) headerCols += '<th>' + buildInlinePeriodLabelHtml('\u0641.\u0645\u0646\u062a\u0635\u0641', getFirstPeriodTime(t.duties, '\u0645\u0646\u062a\u0635\u0641'), 'strip-period-inline', 'strip-period-time') + '</th>';
                    if (hasEvening) headerCols += '<th>' + buildInlinePeriodLabelHtml('\u0641.\u0645\u0633\u0627\u0626\u064a\u0629', getFirstPeriodTime(t.duties, '\u0645\u0633\u0627\u0621'), 'strip-period-inline', 'strip-period-time') + '</th>';

                    rows = allDates.map(date => {
                        let fd = formatDateShort(date);
                        let cols = '<td class="date-cell">' + fd.dayName + ' ' + fd.dateFormatted + '</td>';
                        if (hasMorning) cols += '<td class="check-cell">' + getCellContent(date, '\u0635\u0628\u0627\u062d') + '</td>';
                        if (hasMidday) cols += '<td class="check-cell">' + getCellContent(date, '\u0645\u0646\u062a\u0635\u0641') + '</td>';
                        if (hasEvening) cols += '<td class="check-cell">' + getCellContent(date, '\u0645\u0633\u0627\u0621') + '</td>';
                        return '<tr>' + cols + '</tr>';
                    }).join('');
                }

                const stripHeaderExtras = `
                    <div class="strip-official-meta">
                        <div class="strip-official-main">
                            <div class="strip-logo-wrap">${buildPrintLogoHtml('strip-logo')}</div>
                            <div class="strip-official-text">
                                <div>ظ…ط±ظƒط² ط§ظ„ط¥ط¬ط±ط§ط،: ${escapeHtml(settingsData.displayCenter || 'المركز الرسمي')}</div>
                                <div>ط§ظ„ط´ظ‡ط§ط¯ط©: ${escapeHtml(settingsData.displayExam || '................')} | ط§ظ„ط¯ظˆط±ط©: ${escapeHtml(settingsData.displaySession || '................')}</div>
                            </div>
                        </div>
                    </div>
                `;

                return `
                <div class="strip">
                    <div class="strip-number-badge">#${stripIndex + 1}</div>
                    <div class="strip-header">
                        <span class="inst-name">${settingsData.displayCenter || 'المركز الرسمي'}</span>
                        <span class="sep">|</span>
                        <span class="trim-info">استدعاء حراسة - ${reportExamLabel}</span>
                        <span class="sep">|</span>
                        <span class="teacher-name">الأستاذ(ة): <strong>${t.surname} ${t.name}</strong></span>
                    </div>
                    ${stripHeaderExtras}
                    <table>
                        <thead><tr>${headerCols}</tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    ${notesHtml ? '<div class="strip-footer">' + notesHtml + '</div>' : ''}
                    <div class="signature">الإمضاء:</div>
                </div>
                `;
            });
            const stripsHtml = Array.from({ length: Math.ceil(stripCardsHtml.length / stripsPerPage) }, (_, pageIndex) => {
                const pageCards = stripCardsHtml.slice(pageIndex * stripsPerPage, pageIndex * stripsPerPage + stripsPerPage).join('');
                return '<div class="strip-page">' + pageCards + '</div>';
            }).join('');

            const printContent = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head><title>طباعة القصاصات</title>
            <style>
                @page { size: A4 portrait; margin: 0.7cm; }
                :root {
                    --strip-page-safe-height: 27.4cm;
                    --strip-page-gap: 0.22cm;
                }
                body { font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif; direction: rtl; margin: 0; padding: 0; color: #000; }
                .strip-page {
                    height: var(--strip-page-safe-height);
                    display: flex;
                    flex-direction: column;
                    gap: var(--strip-page-gap);
                    box-sizing: border-box;
                    page-break-after: always;
                }
                .strip-page:last-child { page-break-after: auto; }
                .strip {
                    border: 1.5px dashed #444;
                    padding: 6px 10px;
                    flex: 0 0 calc((var(--strip-page-safe-height) - (var(--strip-page-gap) * 2)) / 3);
                    height: calc((var(--strip-page-safe-height) - (var(--strip-page-gap) * 2)) / 3);
                    page-break-inside: avoid;
                    position: relative;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .strip-number-badge {
                    position: absolute;
                    top: 5px;
                    left: 8px;
                    border: 1px solid #b6bcc6;
                    border-radius: 999px;
                    padding: 1px 6px;
                    font-size: 8px;
                    font-weight: 800;
                    line-height: 1.2;
                    color: #4b5563;
                    background: #fff;
                }
                .strip-header {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                    padding-bottom: 4px;
                    margin-bottom: 5px;
                    border-bottom: 1px solid #ccc;
                    font-size: 11px;
                    color: #000;
                }
                .strip-header .inst-name { font-weight: bold; }
                .strip-header .sep { color: #999; }
                .strip-header .trim-info { color: #000; }
                .strip-header .teacher-name { color: #000; }
                .strip-official-meta {
                    border: 1px solid #bbb;
                    padding: 4px 6px;
                    margin-bottom: 5px;
                    background: #fafafa;
                }
                .strip-official-main {
                    display: grid;
                    grid-template-columns: 30px 1fr;
                    gap: 8px;
                    align-items: center;
                }
                .strip-logo-wrap {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .strip-logo {
                    width: 26px;
                    height: 26px;
                    object-fit: contain;
                }
                .strip-official-text {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    text-align: right;
                    font-size: 9px;
                    font-weight: 700;
                    color: #000;
                }
                table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px; }
                th, td { border: 1px solid #999; padding: 3px 5px; text-align: center; color: #000; }
                th { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; font-size: 11px; }
                .strip-cell-main { font-weight: 800; }
                .strip-period-inline {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    flex-wrap: wrap;
                    line-height: 1.1;
                }
                .strip-period-time { font-size: 8px; font-weight: 700; color: #000; }
                .col-date { width: 40%; }
                .date-cell { font-weight: bold; text-align: right; padding: 2px 8px; font-size: 11px; }
                .check-cell { font-weight: bold; font-size: 14px; color: #000; }
                .strip-footer {
                    font-size: 8px;
                    color: #000;
                    font-style: italic;
                    text-align: right;
                    border-top: 1px dotted #ccc;
                    padding-top: 2px;
                }
                .signature {
                    text-align: left;
                    font-size: 10px;
                    margin-top: auto;
                    color: #000;
                }
            </style>
            <base href="${escapeHtml(printBaseHref)}">
            ${PrintToolbarHelper.getHeadContent()}
            </head>
            <body>
            ${PrintToolbarHelper.getToolbarHtml({ advanced: false })}
                ${stripsHtml}
            ${PrintToolbarHelper.getScriptHtml({ advanced: false })}
            </body>
            </html>
            `;

            const win = window.open('', '_blank');

            if (!win) {

                Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.' });

                return;

            }

            win.document.write(fixOfficialStripPrintEncoding(printContent));

            win.document.close();

            win.focus();

            // auto-print removed

        } catch (error) {

            console.error('Print Execute Error:', error);

            showToast('حدث خطأ أثناء الطباعة: ' + error.message, 'error');

        }

    };

    return e('div', { className: 'container supervision-container', style: { paddingBottom: '70px' } },

        e('div', {
            className: 'no-print',
            style: {
                marginBottom: '20px',
                padding: '16px 18px',
                background: 'linear-gradient(135deg, #eff6ff, #f8fafc)',
                border: '1px solid #bfdbfe',
                borderRadius: '16px',
                boxShadow: '0 8px 20px rgba(37, 99, 235, 0.08)'
            }
        },
            e('div', {
                style: {
                    fontWeight: '900',
                    color: '#1d4ed8',
                    marginBottom: '8px',
                    textAlign: 'center',
                    fontSize: '1rem'
                }
            }, 'اختيار الامتحان'),
            e('div', {
                style: {
                    textAlign: 'center',
                    color: '#475569',
                    marginBottom: '6px',
                    fontSize: '0.9rem'
                }
            }, 'بيانات الحراس، الأيام، وجدول الحراسة تخص الامتحان المحدد هنا'),
            e(HighlightTrimesterSelector, {
                value: trimester,
                onChange: handleTrimesterChange,
                showReset: ['blanc', 'blanc_lycee'].includes(trimester),
                onReset: resetMockExamSchedule,
                customStage: settings.customExamStage || customExamStageDraft || 'middle'
            }),
            e('div', {
                style: {
                    marginTop: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    alignItems: 'center'
                }
            },
                e('div', {
                    style: {
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexWrap: 'wrap'
                    }
                },
                    [
                        { value: 'blanc', label: 'شهادة التعليم المتوسط' },
                        { value: 'blanc_lycee', label: 'شهادة البكالوريا' },
                        { value: 'custom', label: 'امتحان آخر' }
                    ].map((option) =>
                        e('button', {
                            key: option.value,
                            type: 'button',
                            onClick: () => { handleOfficialExamTypeSelect(option.value); },
                            style: {
                                padding: '10px 16px',
                                minWidth: option.value === 'custom' ? '130px' : '210px',
                                borderRadius: '12px',
                                border: officialExamTypeDraft === option.value ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                background: officialExamTypeDraft === option.value ? 'linear-gradient(135deg, #dbeafe, #eff6ff)' : 'white',
                                color: officialExamTypeDraft === option.value ? '#1d4ed8' : '#0f172a',
                                fontWeight: '800',
                                fontFamily: 'inherit',
                                cursor: 'pointer',
                                boxShadow: officialExamTypeDraft === option.value ? '0 0 0 4px rgba(37, 99, 235, 0.08)' : 'none'
                            }
                        }, option.label)
                    )
                ),
                officialExamTypeDraft === 'custom' && e('div', {
                    style: {
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexWrap: 'wrap'
                    }
                },
                    e('label', {
                        style: {
                            fontWeight: '800',
                            color: '#1e3a8a',
                            whiteSpace: 'nowrap'
                        }
                    }, 'نوع الرزنامة:'),
                    e('select', {
                        value: customExamStageDraft,
                        onChange: (ev) => setCustomExamStageDraft(ev.target.value === 'secondary' ? 'secondary' : 'middle'),
                        style: {
                            minWidth: '220px',
                            padding: '9px 12px',
                            borderRadius: '10px',
                            border: '1px solid #93c5fd',
                            background: 'white',
                            fontFamily: 'inherit',
                            fontSize: '0.95rem',
                            fontWeight: '700',
                            textAlign: 'center'
                        }
                    },
                        e('option', { value: 'middle' }, 'رزنامة الطور المتوسط'),
                        e('option', { value: 'secondary' }, 'رزنامة الطور الثانوي')
                    )
                ),
                officialExamTypeDraft === 'custom' && e('div', {
                    style: {
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        width: '100%'
                    }
                },
                    e('label', {
                        style: {
                            fontWeight: '800',
                            color: '#1e3a8a',
                            whiteSpace: 'nowrap'
                        }
                    }, 'اسم الامتحان:'),
                    e('input', {
                        type: 'text',
                        value: officialCenterData.exam || '',
                        onChange: (ev) => handleOfficialExamNameChange(ev.target.value),
                        onKeyDown: (ev) => {
                            if (ev.key === 'Enter') {
                                ev.preventDefault();
                                applyOfficialExamSelection();
                            }
                        },
                        placeholder: 'اكتب اسم الامتحان المخصص',
                        style: {
                            minWidth: '280px',
                            maxWidth: '420px',
                            flex: '1 1 320px',
                            padding: '9px 12px',
                            borderRadius: '10px',
                            border: '1px solid #93c5fd',
                            background: 'white',
                            fontFamily: 'inherit',
                            fontSize: '0.95rem',
                            fontWeight: '700',
                            textAlign: 'center'
                        }
                    }),
                    e(Button, {
                        className: 'btn-primary btn-sm',
                        onClick: applyOfficialExamSelection,
                        style: { whiteSpace: 'nowrap' }
                    }, 'اعتماد الامتحان')
                )
            ),
            officialExamTypeDraft === 'custom' && e('div', {
                style: {
                    marginTop: '8px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '0.85rem',
                    fontWeight: '700'
                }
            }, `عند اختيار امتحان آخر سيتم إنشاء رزنامة فارغة حسب الطور المحدد: ${getCustomScheduleStageLabel(customExamStageDraft)}.`)
        ),

        e(Card, {
            title: e('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('teacher') } }),
                'إدارة الأساتذة (الإعفاءات)'
            ),
                        headerAction: e('div', { style: { display: 'flex', gap: '10px' } },
                e(Button, {
                    className: showTeachersTable ? 'btn-secondary btn-sm' : 'btn-primary btn-sm',
                    onClick: () => setShowTeachersTable(!showTeachersTable),
                    style: { display: 'flex', alignItems: 'center', gap: '5px' }
                },
                    e('span', { dangerouslySetInnerHTML: { __html: IconManager.get(showTeachersTable ? 'eye-off' : 'eye') || (showTeachersTable ? 'Hide' : 'Show') } }),
                    showTeachersTable ? 'إخفاء الجدول' : 'إظهار جدول الأساتذة'
                ),
                e('button', {
                    className: 'btn btn-primary btn-sm',
                    onClick: () => setIsImportToolsModalOpen(true),
                    style: { display: 'inline-flex', alignItems: 'center', gap: '6px' }
                },
                    e(Icon, { name: 'folder-open' }),
                    ' حجز الحراس'
                ),
                e('input', { type: 'file', id: 'import-proctors-input', accept: '.xlsx, .xls', style: { display: 'none' }, onChange: (e) => window.importExamProctors && window.importExamProctors(e) })
            )
        },
            showTeachersTable && e(TeachersList, {
                teachers,
                onToggleExemption: handleToggleExemption
            }),
            e('div', {
                className: 'no-print',
                style: {
                    marginTop: '14px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color)',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                }
            }, `الإعفاءات هنا تخص ${(() => {
                const trimesterMap = {
                    '1': 'الفصل الأول',
                    '2': 'الفصل الثاني',
                    '3': 'الفصل الثالث',
                    'custom': 'امتحان آخر',
                    'blanc': 'شهادة التعليم المتوسط',
                    'blanc_lycee': 'شهادة البكالوريا'
                };
                return trimesterMap[trimester] || 'الفصل المحدد';
            })()} - عدد المعفيين: ${teachers.filter(t => !t.isLegacyPlaceholder && t.isExempt).length} | الغياب يُسجل مباشرة من جدول الحراسة`)
        ),

        e(Card, {

            title: e('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, e(Icon, { name: 'calendar' }), 'أيام الحراسة'),

            headerAction: e(Button, { className: 'btn-primary btn-sm', onClick: () => setIsAddDayModalOpen(true), style: { display: 'flex', alignItems: 'center', gap: '5px' } }, e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('plus') } }), 'إضافة يوم')

        },

            e('div', { className: 'days-grid', id: 'daysGrid' },

                days.length === 0 ? e('div', { style: { gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: '#888' } }, 'لا توجد أيام') :

                    days.map(d => e(DayCard, { key: d.id, day: d, onDelete: handleDeleteDay, onUpdate: handleUpdateDay, globalStage: effectiveStage }))

            )

        ),

        e(Card, { title: e('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, e('span', { dangerouslySetInnerHTML: { __html: IconManager.get('settings') } }), 'إعدادات التوزيع') },

            e('div', { className: 'settings-panel no-print', style: { background: 'var(--bg-color)', padding: '15px', borderRadius: '8px', marginBottom: '20px' } },

                e('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', marginBottom: '15px' } },
                    // Settings Checkboxes (Removed Constraints)

                    // Generate Button moved here
                    e(Button, {
                        className: 'btn-success',
                        onClick: generateSchedule,
                        style: { padding: '8px 20px', fontWeight: 'bold' }
                    }, '🔄 توليد التوزيع (آلي)'),

                    // Custom check mark input
                    e('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '5px 10px', borderRadius: '20px', border: '1px solid #ddd' } },
                        e('label', { style: { margin: 0, whiteSpace: 'nowrap', fontSize: '0.9rem' } }, '✏️ علامة الحراسة:'),
                        e('input', {
                            type: 'text',
                            value: settings.checkMark || '✓',
                            onChange: (ev) => {
                                const newS = { ...settings, checkMark: ev.target.value };
                                saveSettings(newS);
                            },
                            style: { width: '80px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '6px', textAlign: 'center', fontSize: '1rem', fontWeight: 'bold' },
                            maxLength: 5,
                            placeholder: '✓'
                        })
                    )
                ),

                // Manual Distribution Note
                e('div', { style: { color: '#666', fontSize: '0.9rem', borderTop: '1px solid #ddd', paddingTop: '10px', marginTop: '10px' } },
                    e('strong', null, 'ملاحظة: '),
                    'الزر الأيسر يبدّل بين حراسة ثم احتياط ثم فارغ، والزر الأيمن يحدد الغياب مباشرة باللون الأحمر.'
                )
            ),

            e('div', { className: 'action-buttons no-print', style: { marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' } },
                e(Button, { className: 'btn-info', onClick: printStrips }, '✂️ طباعة القصاصات'),
                e(Button, { className: 'btn-warning', onClick: printAbsentTeachers }, '📝 طباعة الغياب'),
                e(Button, { className: 'btn-secondary', onClick: printTeachersSignatureSheet }, '✍️ طباعة ورقة الإمضاء'),
                e('div', {
                    style: {
                        display: 'none',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'white',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid #ddd'
                    }
                },
                    e('label', { style: { margin: 0, fontWeight: 'bold', whiteSpace: 'nowrap' } }, 'اتجاه الجدول:'),
                    e(Select, {
                        value: printOrientation,
                        onChange: setPrintOrientation,
                        options: [
                            { value: 'landscape', label: 'أفقي' },
                            { value: 'portrait', label: 'عمودي' }
                        ],
                        style: { minWidth: '110px', fontFamily: 'inherit' }
                    })
                ),
                e(Button, { className: 'btn-primary', onClick: printSchedule }, '🖨️ طباعة الجدول'),
                e(Button, { className: 'btn-success', onClick: exportScheduleToExcel }, '📊 تصدير Excel'),
                e(Button, {
                    className: showRooms ? 'btn-warning' : 'btn-secondary',
                    style: { display: 'flex', alignItems: 'center', gap: '5px' },
                    onClick: async () => {
                        if (showRooms) {
                            setShowRooms(false);
                            return;
                        }
                        // Load fresh room assignments from DB (per-trimester)
                        const triKeys = getTrimesterKeys(trimester);
                        const freshRooms = await DB.get(triKeys.ROOM_ASSIGNMENTS) || {};
                        if (Object.keys(freshRooms).length === 0) {
                            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا يوجد توزيع قاعات. يرجى إعداد التوزيع من صفحة قوائم الحراسة أولاً.' });
                            return;
                        }
                        setRoomAssignments(normalizeRoomAssignmentsAgainstAssignments(
                            freshRooms,
                            schedule,
                            reserveSchedule,
                            absenceSchedule
                        ));
                        // Refresh GlobalRoomCache with latest room labels
                        try {
                            let prd = await DB.get(STORAGE_KEYS.PERIOD_ROOMS);
                            if (!prd) { const s = localStorage.getItem(STORAGE_KEYS.PERIOD_ROOMS); if (s) prd = JSON.parse(s); }
                            if (prd) hydrateGlobalRoomCache(prd);
                        } catch (e) { console.warn("Room cache refresh error:", e); }
                        setShowRooms(true);
                    }
                }, showRooms ? '🏫 إخفاء القاعات' : '🏫 إظهار القاعات'),
                e(Button, { className: 'btn-danger', onClick: clearSchedule }, '🗑️ مسح الكل')
            ),

            e(ScheduleTable, { teachers, days, schedule, reserveSchedule, absenceSchedule, roomAssignments, showRooms, onToggleAssignment: manuallyToggle, onToggleAbsenceAssignment: manuallyToggleAbsence, settings }),

            e(FloatingTotals, { days, schedule, reserveSchedule })

        ),

        e(AddDayModal, { isOpen: isAddDayModalOpen, onClose: () => setIsAddDayModalOpen(false), onAdd: handleAddDay }),
        e(ImportToolsModal, {
            isOpen: isImportToolsModalOpen,
            onClose: () => setIsImportToolsModalOpen(false),
            onExportSplit: handleExportSplitTemplate,
            onExportCombined: handleExportCombinedTemplate,
            onImportExcel: handleOpenImportProctorsPicker,
            onDeleteAll: handleDeleteAllTeachersFromModal
        }),

        e(PrintNoteModal, { isOpen: isPrintModalOpen, onClose: () => setIsPrintModalOpen(false), onConfirm: executePrint })

    );

};

// ======================

// RENDER

// ======================

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(e(App));

