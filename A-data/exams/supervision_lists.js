/**

 * Supervision Lists Management (قوائم الحراسة)

 * Manages room assignments for supervision

 */

// Storage keys (same as supervision_react.js)

const STORAGE_KEYS = {

    TEACHERS: 'supervisionTeachers',

    DAYS: 'supervisionDays',

    SCHEDULE: 'supervisionSchedule',

    ROOM_ASSIGNMENTS: 'supervisionRoomAssignments',
    TRIMESTER: 'supervisionTrimester'

};

// Helper: get trimester-specific storage keys (must match supervision_react.js)
const getTrimesterKeys = (tri) => ({
    DAYS: `supervisionDays_T${tri}`,
    SCHEDULE: `supervisionSchedule_T${tri}`,
    ROOM_ASSIGNMENTS: `supervisionRoomAssignments_T${tri}`
});

// State

let currentTrimester = '1';

let teachers = [];

let days = [];

let schedule = {};

let roomAssignments = {}; // { dayId_period: { teacherId: { room, note } } }

let currentTeachers = []; // Teachers for current selection

// New Room System
const ROOM_TRIMESTERS = ['1', '2', '3', 'blanc', 'blanc_lycee'];

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
    let loaded = await DB.get('supervisionPeriodRooms');
    if (!loaded) {
        try { loaded = JSON.parse(localStorage.getItem('supervisionPeriodRooms')); } catch(e){}
    }
    const normalizedStore = normalizePeriodRoomsStore(loaded);
    const sanitized = sanitizePeriodRoomsStore(normalizedStore);
    periodRooms = sanitized.store;

    const needsSave = !loaded || isLegacyPeriodRoomsShape(loaded) || sanitized.changed;
    await remapStoredRoomAssignments(sanitized.roomIdRemaps);

    if (needsSave) {
        console.log('Normalized supervision room settings by trimester');
        await DB.set('supervisionPeriodRooms', periodRooms);
        localStorage.setItem('supervisionPeriodRooms', JSON.stringify(periodRooms));
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

    await DB.set('supervisionListsSelection', selection);
}

/**

 * Restore selection from IndexedDB

 */

async function restoreSelection() {

    // Restore trimester first
    const savedTrimester = await DB.get(STORAGE_KEYS.TRIMESTER);
    if (savedTrimester) {
        currentTrimester = savedTrimester;
        document.getElementById('trimesterSelect').value = currentTrimester;
        await loadTrimesterData();
        populateDaySelect();
    }

    const saved = await DB.get('supervisionListsSelection');

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

/**

 * Render teachers table

 */

let gridInstance = null;

function renderTeachersTable() {

    const wrapper = document.getElementById('gridjs-wrapper');
    if (!wrapper) return;

    if (currentTeachers.length === 0) {
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
    const data = currentTeachers.map((teacher, idx) => {
        const subjectDisplay = teacher.subjects && teacher.subjects.length > 0 ? teacher.subjects[0] : '-';
        const isReserve = teacher.isReserve === true;

        let rowData = [
            idx + 1,
            `${teacher.surname} ${teacher.name}`,
            subjectDisplay
        ];

        const roomActionHtml = `
            <div style="display: flex; gap: 5px; align-items: center; justify-content: center;">
                <span class="print-only" style="display:none;">${isReserve ? 'احتياط' : getLocationLabel(teacher.room)}</span>
                <select class="room-select" onchange="updateRoom('${teacher.id}', this.value)" ${isReserve ? 'disabled' : ''} style="${isReserve ? 'opacity: 0.5' : ''}">
                    ${optionsHtml.replace(`value="${teacher.room}"`, `value="${teacher.room}" selected`)}
                </select>
                <button class="btn-action ${isReserve ? 'btn-danger' : 'btn-secondary'}"
                        onclick="toggleReserve('${teacher.id}')"
                        style="padding: 5px 10px; font-size: 0.8rem;"
                        title="${isReserve ? 'إلغاء الاحتياط' : 'تعيين كإحتياط'}">
                    ${isReserve ? 'إلغاءاحتياط' : 'احتياط'}
                </button>
            </div>
        `;

        const noteActionHtml = `
            <span class="print-only" style="white-space: pre-wrap; display:none;">${teacher.note || ''}</span>
            <input type="text" class="note-input"
                   value="${teacher.note || ''}"
                   placeholder="ملاحظة..."
                   onchange="updateNote('${teacher.id}', this.value)">
        `;

        rowData.push(gridjs.html(roomActionHtml));
        rowData.push(gridjs.html(noteActionHtml));

        return rowData;
    });

    // Track which rows are reserves for post-render styling
    const reserveIndices = currentTeachers.map((t, i) => t.isReserve === true ? i : -1).filter(i => i >= 0);

    const columns = [
        { name: '#', width: '60px' },
        { name: 'الأستاذ', width: '250px' },
        { name: 'المادة', width: '150px' },
        { name: 'القاعة / المهمة', width: '250px', sort: false },
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
    const totalTeachers = currentTeachers.length;
    const reservesCount = currentTeachers.filter(t => t.isReserve).length;
    const activeRooms = new Set(currentTeachers.filter(t => !t.isReserve && t.room > 0).map(t => t.room)).size;

    const elTotal = document.getElementById('totalTeachersCount');
    const elRooms = document.getElementById('roomsUsedCount');
    const elReserves = document.getElementById('reservesCount');

    if (elTotal) elTotal.textContent = totalTeachers;
    if (elRooms) elRooms.textContent = activeRooms;
    if (elReserves) elReserves.textContent = reservesCount;

    // Update Print Header
    const daySelect = document.getElementById('daySelect');
    const periodSelect = document.getElementById('periodSelect');
    const printHeader = document.getElementById('printHeaderSubtitle');

    if (printHeader && daySelect && periodSelect) {
        const dayText = daySelect.options[daySelect.selectedIndex]?.text || '';
        const periodText = periodSelect.options[periodSelect.selectedIndex]?.text || '';
        printHeader.textContent = `${dayText} - ${periodText}`;

        // Populate specific print header fields if they exist
        const settings = JSON.parse(localStorage.getItem('settings')) || {};
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : {};

        const elWilaya = document.getElementById('printDirection');
        const elSchool = document.getElementById('printSchool');
        const elYear = document.getElementById('printYear');

        if (elWilaya) elWilaya.textContent = `مديرية التربية لولاية ${settings.wilaya || user.wilaya || '...'}`;
        if (elSchool) elSchool.textContent = `${settings.schoolName || user.schoolName || '...'}`;
        if (elYear) elYear.textContent = `السنة الدراسية: ${settings.schoolYear || '2025/2026'}`;

        // Update stats in header
        const elStats = document.getElementById('printStats');
        if (elStats) elStats.textContent = `عدد الأساتذة: ${totalTeachers} | الحجرات: ${activeRooms} | الاحتياط: ${reservesCount}`;
    }

    // Keep legacy summary for compatibility if needed (hidden)
    const summaryText = document.getElementById('summaryText');
    if (summaryText) {
        const roomCounts = {};
        currentTeachers.forEach(t => {
            roomCounts[t.room] = (roomCounts[t.room] || 0) + 1;
        });
        const summaryParts = Object.entries(roomCounts)
            .sort((a, b) => a[0] - b[0])
            .map(([room, count]) => `${getLocationLabel(parseInt(room))}: ${count}`);
        summaryText.textContent = `المجموع: ${currentTeachers.length} أستاذ | ${summaryParts.join(' | ')}`;
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

    if (!dayId || !period || currentTeachers.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار اليوم والفترة أولاً' });
        return;
    }

    const day = days.find(d => d.id === parseInt(dayId, 10));
    if (!day || !day[period]) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'تعذر تحديد بيانات الفترة المختارة' });
        return;
    }

    const settings = await DB.getSettings() || {};
    const subjects = (day[period].subjects || []).filter(Boolean).join(' + ') || 'غير محدد';
    const dateLabel = new Date(day.date).toLocaleDateString('ar-DZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const sortedTeachers = [...currentTeachers].sort((a, b) => {
        const roomA = a.isReserve ? Number.MAX_SAFE_INTEGER : (a.room || 0);
        const roomB = b.isReserve ? Number.MAX_SAFE_INTEGER : (b.room || 0);
        if (roomA !== roomB) return roomA - roomB;
        return `${a.surname || ''} ${a.name || ''}`.localeCompare(`${b.surname || ''} ${b.name || ''}`, 'ar');
    });

    const rows = sortedTeachers.map((teacher, index) => [
        index + 1,
        `${teacher.surname || ''} ${teacher.name || ''}`.trim(),
        teacher.subjects && teacher.subjects.length > 0 ? teacher.subjects[0] : '-',
        teacher.isReserve ? 'احتياط' : (getLocationLabel(teacher.room) || ''),
        teacher.note || ''
    ]);

    const totalTeachers = currentTeachers.length;
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
                    `السنة الدراسية: ${settings.schoolYear || ''} | المؤسسة: ${settings.institutionName || ''}`,
                    `التاريخ: ${dateLabel}`,
                    `الفترة: ${getSupervisionPeriodLabel(period)} | المواد: ${subjects}`,
                    `الإحصائيات: العدد ${totalTeachers} | القاعات المستعملة ${activeRooms} | الاحتياط ${reservesCount}`
                ],
                headers: ['#', 'الأستاذ', 'المادة', 'القاعة / المهمة', 'ملاحظات'],
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

    // Reset invalid assignments to first valid room or 0

    const firstValidId = validIds.length > 0 ? validIds[0] : 0;

    currentTeachers.forEach(t => {

        if (!validIds.includes(t.room) && t.room !== 0) {

            t.room = firstValidId;

        }

    });

    await saveCurrentAssignments();

    renderTeachersTable();

}

// Update room assignment for a teacher
window.updateRoom = async function (id, value) {
    const teacher = currentTeachers.find(t => t.id === id);
    if (teacher) {
        teacher.room = parseInt(value) || 0;
        await saveCurrentAssignments();
    }
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

function pickBestLocationForTeacher(teacher, locations, roomLoadMap, teacherRoomUsageMap) {

    const teacherId = String(teacher.id);
    const usedRooms = teacherRoomUsageMap[teacherId] || {};
    const rankedLocations = [...locations].sort(() => Math.random() - 0.5);

    rankedLocations.sort((a, b) => {

        const aUsage = usedRooms[a.id] || 0;
        const bUsage = usedRooms[b.id] || 0;
        const aSeenBefore = aUsage > 0 ? 1 : 0;
        const bSeenBefore = bUsage > 0 ? 1 : 0;

        if (aSeenBefore !== bSeenBefore) return aSeenBefore - bSeenBefore;

        const aLoad = roomLoadMap[a.id] || 0;
        const bLoad = roomLoadMap[b.id] || 0;
        if (aLoad !== bLoad) return aLoad - bLoad;

        if (aUsage !== bUsage) return aUsage - bUsage;

        return 0;

    });

    return rankedLocations[0] || null;

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
    const roomLoadMap = {};

    locations.forEach((location) => {
        roomLoadMap[location.id] = 0;
    });

    const shuffled = [...currentTeachers].sort(() => Math.random() - 0.5);

    shuffled.forEach((teacher) => {

        if (teacher.isReserve) {
            teacher.room = 0; // No room for reserve
            return;
        }

        const bestLocation = pickBestLocationForTeacher(teacher, locations, roomLoadMap, teacherRoomUsageMap);
        teacher.room = bestLocation ? bestLocation.id : 0;

        if (bestLocation) {
            roomLoadMap[bestLocation.id] = (roomLoadMap[bestLocation.id] || 0) + 1;
        }

    });

    await saveCurrentAssignments();

    renderTeachersTable();

}

/**

 * Load data from localStorage

 */

async function loadData() {

    // Load teachers from central DB and map format

    const centralTeachers = await DB.getTeachers();

    teachers = centralTeachers.map(t => ({

        id: t.id,

        surname: t.last_name,

        name: t.first_name,

        subjects: t.subject ? [t.subject] : [],

        isExempt: t.isExempt || false

    }));

    // Load periodRooms
    await loadPeriodRooms();

    // Load trimester
    const savedTrimester = await DB.get(STORAGE_KEYS.TRIMESTER);
    if (savedTrimester) currentTrimester = savedTrimester;

    // Load per-trimester data
    await loadTrimesterData();

}

/**
 * Load trimester-specific data (days, schedule, room assignments)
 */
async function loadTrimesterData() {
    const keys = getTrimesterKeys(currentTrimester);

    days = await DB.get(keys.DAYS) || [];
    schedule = await DB.get(keys.SCHEDULE) || {};
    roomAssignments = await DB.get(keys.ROOM_ASSIGNMENTS) || {};
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

            isReserve: t.isReserve // Save reserve status

        };

    });

    await saveRoomAssignments();

}

/**
 * Toggle reserve status for a teacher
 */
window.toggleReserve = async function (id) {
    const teacher = currentTeachers.find(t => t.id === id);
    if (teacher) {
        teacher.isReserve = !teacher.isReserve;
        if (teacher.isReserve) {
            teacher.room = 0; // Clear room if reserve
        } else {
            // Assign first valid room or leave as 0 until manual assignment
            const locations = getLocations();
            teacher.room = locations.length > 0 ? locations[0].id : 0;
        }
        await saveCurrentAssignments();
        renderTeachersTable();
    }
};

/**

 * Save room assignments

 */

async function saveRoomAssignments() {

    const keys = getTrimesterKeys(currentTrimester);
    await DB.set(keys.ROOM_ASSIGNMENTS, roomAssignments);
    localStorage.setItem(keys.ROOM_ASSIGNMENTS, JSON.stringify(roomAssignments));

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

    const assignedTeacherIds = schedule[key] || [];

    // Get teacher details

    currentTeachers = assignedTeacherIds.map(tid => {

        const teacher = teachers.find(t => t.id === tid);

        if (!teacher) return null;

        // Get saved room/note or defaults

        const saved = roomAssignments[key]?.[tid] || {};

        return {

            id: teacher.id,

            surname: teacher.surname,

            name: teacher.name,

            subjects: teacher.subjects,

            room: saved.room || 0,

            note: saved.note || '',

            isReserve: saved.isReserve || false // Load reserve status

        };

    }).filter(Boolean);

    // Sort by surname

    currentTeachers.sort((a, b) => a.surname.localeCompare(b.surname, 'ar'));

    // Update info card

    let periodLabel = 'صباحية';
    if (period === 'midday') periodLabel = 'منتصف';
    if (period === 'evening') periodLabel = 'مسائية';

    const subjects = (day[period].subjects || []).join(' + ') || 'غير محدد';

    // Display Context Info (Date/Subjects)
    const dateStr = new Date(day.date).toLocaleDateString('ar-DZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    // Update Print Header with rich info
    const printHeader = document.getElementById('printHeaderSubtitle');
    if (printHeader) {
        printHeader.textContent = `${dateStr} - ${periodLabel} (${subjects})`;
    }

    // Also update the top bar subtitle if it exists (optional enhancement)
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

    const settings = await DB.getSettings() || {};

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

                        <h3 style="line-height:1;">المؤسسة: ${settings.institutionName || '.......'}</h3>

                    </div>

                    <div class="header-box" style="text-align: left;">

                         <h3 style="line-height:1;">مديرية التربية لولاية ${settings.wilaya || '.......'}</h3>

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
                    <div style="margin-bottom: 5px;">حرر بـ: ${settings.municipality || '.......'} في: ${today}</div>
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

    var subjectsList = day[period].subjects || [];
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

    var settings = await DB.getSettings() || {};
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
                        <h3 style="line-height:1;">المؤسسة: ' + (settings.institutionName || '.......') + '</h3>\
                    </div>\
                    <div class="header-box" style="text-align: left;">\
                        <h3 style="line-height:1;">مديرية التربية لولاية ' + (settings.wilaya || '.......') + '</h3>\
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
                    <div style="margin-bottom: 5px;">حرر بـ: ' + (settings.municipality || '.......') + ' في: ' + today + '</div>\
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
    const assignedTeacherIds = currentTeachers.map(t => t.id);

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
        const currentSchedule = await DB.get(triKeys.SCHEDULE) || {};

        // Update specific slot
        const slotKey = `${dayId}_${period}`;
        currentSchedule[slotKey] = assignedTeacherIds;
        await DB.set(triKeys.SCHEDULE, currentSchedule);

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
    await DB.set('supervisionPeriodRooms', periodRooms);
    localStorage.setItem('supervisionPeriodRooms', JSON.stringify(periodRooms));
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
