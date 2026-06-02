const streamTranslations = {

    'common_science': 'جذع مشترك علوم وتكنولوجيا',

    'common_arts': 'جذع مشترك آداب',

    'science': 'علوم تجريبية',

    'math': 'رياضيات',

    'tech_math': 'تقني رياضي',

    'tech_math_civil': 'تقني رياضي (هندسة مدنية)',

    'tech_math_mech': 'تقني رياضي (هندسة ميكانيكية)',

    'tech_math_elec': 'تقني رياضي (هندسة كهربائية)',

    'tech_math_methods': 'تقني رياضي (هندسة الطرائق)',

    'management': 'تسيير واقتصاد',

    'languages': 'لغات أجنبية',

    'arts': 'آداب وفلسفة'

};

function getStreamLabel(streamCode) {

    if (!streamCode) return '';

    return streamTranslations[streamCode] || streamCode;

}

const SIGNATURE_SUBJECTS_CONFIG_KEY = 'examSignatureSubjectsByStream';
const DEFAULT_SIGNATURE_STREAM_KEY = '__default__';

function escapeSignatureHtml(value) {

    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

}

function normalizeSignatureSubjectName(value) {

    return String(value || '').replace(/\s+/g, ' ').trim();

}

function dedupeSignatureSubjects(subjects, fallbackSubjects) {

    const seen = new Set();
    const result = [];

    (Array.isArray(subjects) ? subjects : []).forEach(subject => {
        const normalized = normalizeSignatureSubjectName(subject);
        if (!normalized) return;

        const key = normalized.toLowerCase();
        if (seen.has(key)) return;

        seen.add(key);
        result.push(normalized);
    });

    if (result.length > 0) {
        return result;
    }

    if (Array.isArray(fallbackSubjects) && fallbackSubjects.length > 0) {
        return dedupeSignatureSubjects(fallbackSubjects);
    }

    return [];

}

function extractSignatureSubjectsFromDays(days) {

    const subjects = [];

    (Array.isArray(days) ? days : []).forEach(day => {
        ['morning', 'midday', 'evening'].forEach(period => {
            const periodData = day && day[period];
            if (!periodData) return;

            const periodSubjects = Array.isArray(periodData.subjects)
                ? [...periodData.subjects]
                : (periodData.subject ? [periodData.subject] : []);

            if (periodData.subject2 && !periodSubjects.includes(periodData.subject2)) {
                periodSubjects.push(periodData.subject2);
            }

            periodSubjects.forEach(subject => {
                const normalized = normalizeSignatureSubjectName(subject);
                if (normalized && !subjects.includes(normalized)) {
                    subjects.push(normalized);
                }
            });
        });
    });

    return dedupeSignatureSubjects(subjects);

}

function getSignatureStreamKeys(students) {

    return [...new Set(
        (Array.isArray(students) ? students : [])
            .map(student => normalizeSignatureSubjectName(student && student.stream))
            .filter(Boolean)
    )].sort((a, b) => getStreamLabel(a).localeCompare(getStreamLabel(b), 'ar'));

}

function cloneSignatureSubjectState(state) {

    const copy = {};

    Object.keys(state || {}).forEach(key => {
        copy[key] = Array.isArray(state[key]) ? state[key].slice() : [];
    });

    return copy;

}

function createSignatureSubjectState(baseSubjects, streamKeys, savedConfig) {

    const fallbackSubjects = dedupeSignatureSubjects(baseSubjects, ['المادة']);
    const safeConfig = savedConfig && typeof savedConfig === 'object' ? savedConfig : {};
    const state = {
        [DEFAULT_SIGNATURE_STREAM_KEY]: dedupeSignatureSubjects(safeConfig[DEFAULT_SIGNATURE_STREAM_KEY], fallbackSubjects)
    };

    (Array.isArray(streamKeys) ? streamKeys : []).forEach(streamKey => {
        state[streamKey] = dedupeSignatureSubjects(safeConfig[streamKey], state[DEFAULT_SIGNATURE_STREAM_KEY]);
    });

    return cloneSignatureSubjectState(state);

}

function getConfiguredSignatureSubjects(config, streamKey, baseSubjects) {

    const safeConfig = config && typeof config === 'object' ? config : {};
    const defaultSubjects = dedupeSignatureSubjects(safeConfig[DEFAULT_SIGNATURE_STREAM_KEY], baseSubjects);

    if (streamKey && streamKey !== DEFAULT_SIGNATURE_STREAM_KEY) {
        return dedupeSignatureSubjects(safeConfig[streamKey], defaultSubjects);
    }

    return defaultSubjects;

}

function getSignaturePageStreamInfo(students, selectedStream, isSecondary) {

    if (!isSecondary) {
        return { key: '', label: '' };
    }

    if (selectedStream) {
        return { key: selectedStream, label: getStreamLabel(selectedStream) };
    }

    const uniqueStreams = getSignatureStreamKeys(students);

    if (uniqueStreams.length === 1) {
        return { key: uniqueStreams[0], label: getStreamLabel(uniqueStreams[0]) };
    }

    if (uniqueStreams.length > 1) {
        return { key: DEFAULT_SIGNATURE_STREAM_KEY, label: 'شعب متعددة' };
    }

    return { key: DEFAULT_SIGNATURE_STREAM_KEY, label: '' };

}

function buildSignatureSubjectColumns(subjects, shortenSubject) {

    const safeSubjects = dedupeSignatureSubjects(subjects, ['المادة']);
    const subjectWidth = Math.max(5, Math.floor(50 / safeSubjects.length));

    return {
        emptyCellsHtml: safeSubjects.map(() => '<td></td>').join(''),
        headersHtml: safeSubjects.map(subject =>
            `<th style="width: ${subjectWidth}%; font-size: 8pt; padding: 3px;">${shortenSubject(subject)}</th>`
        ).join('')
    };

}

async function openSecondarySignatureSubjectsEditor(baseSubjects, streamKeys, preferredStreamKey) {

    const fallbackSubjects = dedupeSignatureSubjects(baseSubjects, ['المادة']);
    const savedConfig = await DB.get(SIGNATURE_SUBJECTS_CONFIG_KEY) || {};
    const editorKeys = [DEFAULT_SIGNATURE_STREAM_KEY, ...(Array.isArray(streamKeys) ? streamKeys : [])];
    const state = createSignatureSubjectState(fallbackSubjects, streamKeys, savedConfig);
    let activeKey = editorKeys.includes(preferredStreamKey) ? preferredStreamKey : (editorKeys[1] || DEFAULT_SIGNATURE_STREAM_KEY);

    const getScopeLabel = (key) => {
        if (key === DEFAULT_SIGNATURE_STREAM_KEY) {
            return 'افتراضي / شعب متعددة';
        }
        return getStreamLabel(key);
    };

    const result = await Swal.fire({
        title: 'مواد أوراق الإمضاء',
        width: 920,
        showCancelButton: true,
        confirmButtonText: 'حفظ ومتابعة الطباعة',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#16a34a',
        focusConfirm: false,
        html: `
            <div style="text-align:right; direction:rtl;">
                <div style="background:#f8fafc; border:1px solid #dbeafe; color:#1e3a8a; border-radius:12px; padding:12px 14px; margin-bottom:14px; font-size:0.95rem; line-height:1.7;">
                    في الطور الثانوي يمكنك تخصيص ترتيب المواد لكل شعبة قبل طباعة أوراق الإمضاء، مع إمكانية الحذف أو الإضافة.
                </div>
                <div style="display:grid; grid-template-columns:minmax(220px, 260px) 1fr; gap:14px; align-items:start;">
                    <div>
                        <label for="signatureSubjectScope" style="display:block; margin-bottom:6px; font-weight:700; color:#334155;">الشعبة</label>
                        <select id="signatureSubjectScope" style="width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:10px; font-family:inherit;"></select>
                        <div id="signatureSubjectHelp" style="margin-top:8px; color:#64748b; font-size:0.82rem; line-height:1.6;"></div>
                        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
                            <button type="button" id="signatureSubjectResetBtn" style="border:none; background:#f59e0b; color:#fff; border-radius:10px; padding:8px 12px; font-family:inherit; font-weight:700; cursor:pointer;">إعادة الافتراضي</button>
                            <button type="button" id="signatureSubjectResetAllBtn" style="border:none; background:#64748b; color:#fff; border-radius:10px; padding:8px 12px; font-family:inherit; font-weight:700; cursor:pointer;">إعادة الكل</button>
                        </div>
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                            <div style="font-weight:700; color:#0f172a;">ترتيب المواد</div>
                            <div id="signatureSubjectCount" style="font-size:0.85rem; color:#475569;"></div>
                        </div>
                        <div id="signatureSubjectList" style="display:flex; flex-direction:column; gap:8px; max-height:320px; overflow:auto; border:1px solid var(--border-color); border-radius:12px; padding:10px; background: var(--card-bg);"></div>
                        <div style="display:flex; gap:8px; margin-top:12px;">
                            <input id="signatureSubjectInput" type="text" placeholder="أضف مادة جديدة" style="flex:1; padding:10px 12px; border:1px solid #cbd5e1; border-radius:10px; font-family:inherit;">
                            <button type="button" id="signatureSubjectAddBtn" style="border:none; background:#2563eb; color:#fff; border-radius:10px; padding:10px 16px; font-family:inherit; font-weight:700; cursor:pointer;">إضافة</button>
                        </div>
                    </div>
                </div>
            </div>
        `,
        didOpen: () => {
            const popup = Swal.getPopup();
            const scopeSelect = popup.querySelector('#signatureSubjectScope');
            const helpBox = popup.querySelector('#signatureSubjectHelp');
            const countBox = popup.querySelector('#signatureSubjectCount');
            const listBox = popup.querySelector('#signatureSubjectList');
            const addInput = popup.querySelector('#signatureSubjectInput');
            const addBtn = popup.querySelector('#signatureSubjectAddBtn');
            const resetBtn = popup.querySelector('#signatureSubjectResetBtn');
            const resetAllBtn = popup.querySelector('#signatureSubjectResetAllBtn');

            const showEditorMessage = (message) => {
                Swal.showValidationMessage(message);
                window.clearTimeout(showEditorMessage._timer);
                showEditorMessage._timer = window.setTimeout(() => Swal.resetValidationMessage(), 1800);
            };

            const renderEditor = () => {
                scopeSelect.innerHTML = editorKeys.map(key =>
                    `<option value="${escapeSignatureHtml(key)}">${escapeSignatureHtml(getScopeLabel(key))}</option>`
                ).join('');
                scopeSelect.value = activeKey;

                const currentSubjects = state[activeKey] || [];
                countBox.textContent = `${currentSubjects.length} مادة`;
                helpBox.textContent = activeKey === DEFAULT_SIGNATURE_STREAM_KEY
                    ? 'تُستعمل هذه القائمة عند وجود أكثر من شعبة في نفس الصفحة أو عند عدم وجود تخصيص خاص.'
                    : `هذه القائمة تخص شعبة ${getScopeLabel(activeKey)} فقط.`;

                listBox.innerHTML = currentSubjects.map((subject, index) => `
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid var(--border-color); border-radius:10px; background:#f8fafc;">
                        <div style="font-weight:700; color:#0f172a; min-width:0; word-break:break-word;">${escapeSignatureHtml(subject)}</div>
                        <div style="display:flex; gap:6px; flex-shrink:0;">
                            <button type="button" data-action="up" data-index="${index}" style="border:none; background:#cbd5e1; color:#0f172a; border-radius:8px; padding:6px 10px; cursor:pointer; font-weight:700;">↑</button>
                            <button type="button" data-action="down" data-index="${index}" style="border:none; background:#cbd5e1; color:#0f172a; border-radius:8px; padding:6px 10px; cursor:pointer; font-weight:700;">↓</button>
                            <button type="button" data-action="delete" data-index="${index}" style="border:none; background:#ef4444; color:#fff; border-radius:8px; padding:6px 10px; cursor:pointer; font-weight:700;">حذف</button>
                        </div>
                    </div>
                `).join('');
            };

            scopeSelect.addEventListener('change', () => {
                activeKey = scopeSelect.value;
                addInput.value = '';
                renderEditor();
            });

            addBtn.addEventListener('click', () => {
                const newSubject = normalizeSignatureSubjectName(addInput.value);
                if (!newSubject) {
                    showEditorMessage('يرجى إدخال اسم مادة صالح.');
                    return;
                }

                const currentSubjects = state[activeKey] || [];
                if (currentSubjects.some(subject => subject.toLowerCase() === newSubject.toLowerCase())) {
                    showEditorMessage('هذه المادة موجودة بالفعل في القائمة.');
                    return;
                }

                currentSubjects.push(newSubject);
                state[activeKey] = currentSubjects;
                addInput.value = '';
                renderEditor();
            });

            addInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    addBtn.click();
                }
            });

            listBox.addEventListener('click', (event) => {
                const actionBtn = event.target.closest('button[data-action]');
                if (!actionBtn) return;

                const action = actionBtn.getAttribute('data-action');
                const index = parseInt(actionBtn.getAttribute('data-index'), 10);
                const currentSubjects = state[activeKey] || [];

                if (!Number.isInteger(index) || index < 0 || index >= currentSubjects.length) return;

                if (action === 'delete') {
                    if (currentSubjects.length <= 1) {
                        showEditorMessage('يجب الإبقاء على مادة واحدة على الأقل.');
                        return;
                    }
                    currentSubjects.splice(index, 1);
                } else if (action === 'up' && index > 0) {
                    [currentSubjects[index - 1], currentSubjects[index]] = [currentSubjects[index], currentSubjects[index - 1]];
                } else if (action === 'down' && index < currentSubjects.length - 1) {
                    [currentSubjects[index + 1], currentSubjects[index]] = [currentSubjects[index], currentSubjects[index + 1]];
                }

                renderEditor();
            });

            resetBtn.addEventListener('click', () => {
                if (activeKey === DEFAULT_SIGNATURE_STREAM_KEY) {
                    state[DEFAULT_SIGNATURE_STREAM_KEY] = fallbackSubjects.slice();
                } else {
                    state[activeKey] = getConfiguredSignatureSubjects(state, DEFAULT_SIGNATURE_STREAM_KEY, fallbackSubjects).slice();
                }
                renderEditor();
            });

            resetAllBtn.addEventListener('click', () => {
                state[DEFAULT_SIGNATURE_STREAM_KEY] = fallbackSubjects.slice();
                streamKeys.forEach(streamKey => {
                    state[streamKey] = fallbackSubjects.slice();
                });
                renderEditor();
            });

            renderEditor();
        },
        preConfirm: async () => {
            const sanitizedState = createSignatureSubjectState(fallbackSubjects, streamKeys, state);
            const mergedState = cloneSignatureSubjectState(savedConfig);

            mergedState[DEFAULT_SIGNATURE_STREAM_KEY] = sanitizedState[DEFAULT_SIGNATURE_STREAM_KEY].slice();
            (Array.isArray(streamKeys) ? streamKeys : []).forEach(streamKey => {
                mergedState[streamKey] = sanitizedState[streamKey].slice();
            });

            await DB.set(SIGNATURE_SUBJECTS_CONFIG_KEY, mergedState);
            return mergedState;
        }
    });

    return result.isConfirmed ? result.value : null;

}

let allStudents = [];

let filteredStudents = [];

let examGroupings = {}; // Stored separately from original data

let numGroups = 2;

let institutionSettings = {};

let roomSettings = {}; // Persisted room numbers

document.addEventListener('DOMContentLoaded', async () => {
    const settings = await DB.getSettings();

    await loadStudents();
    await loadExamGroupings();
    await loadRoomSettings();

    // Load settings
    institutionSettings = settings || await DB.getSettings() || {};

    await populateYearDropdown(institutionSettings.schoolYear || institutionSettings.currentAcademicYear);
    if (await ensureResultsYearSelection()) {
        await loadStudents(document.getElementById('yearSelect')?.value || null);
    }
    populateFilters();
    checkStreamVisibility();

    document.getElementById('yearSelect')?.addEventListener('change', handleYearChange);

    document.getElementById('levelSelect').addEventListener('change', () => {
        updateStreamFilter();
        updateClassFilter();
        updateNumGroupsFromData();
        updateGroupFilterOptions();
        renderTable();
    });

    document.getElementById('streamSelect').addEventListener('change', () => {
        updateClassFilter();
        updateGroupFilterOptions();
        renderTable();
    });

    document.getElementById('classSelect').addEventListener('change', () => {
        updateGroupFilterOptions();
        renderTable();
    });

    document.getElementById('trimesterSelect')?.addEventListener('change', async () => {
        await ensureResultsYearSelection({ showFeedback: true });
        await loadStudents(document.getElementById('yearSelect').value);
        populateFilters();
        checkStreamVisibility();
        updateStreamFilter();
        updateClassFilter();
        updateNumGroupsFromData();
        updateGroupFilterOptions();
        renderTable();
    });

    document.getElementById('numGroups').addEventListener('change', (e) => {
        numGroups = parseInt(e.target.value) || 2;
        updateRoomInputs();
        updateGroupFilterOptions();
        renderTable();
    });

    document.getElementById('groupFilter')?.addEventListener('change', renderTable);
    document.getElementById('tableSearchInput')?.addEventListener('input', renderTable);
});

function getContextStudents() {
    const level = document.getElementById('levelSelect')?.value || '';
    const stream = document.getElementById('streamSelect')?.value || '';
    const cls = document.getElementById('classSelect')?.value || '';

    if (!level) return [];

    let contextStudents = allStudents.filter(s => s.level === level);

    if (stream) {
        contextStudents = contextStudents.filter(s => s.stream === stream);
    }

    if (cls) {
        contextStudents = contextStudents.filter(s => s.class === cls);
    }

    return contextStudents;
}

function getAvailableGroupNumbers(students = []) {
    const configuredGroups = parseInt(document.getElementById('numGroups')?.value) || numGroups || 0;
    const assignedGroups = students
        .map(student => parseInt(examGroupings[getStudentKey(student)]) || 0)
        .filter(group => group > 0);

    const maxAssignedGroup = assignedGroups.length ? Math.max(...assignedGroups) : 0;
    const maxGroup = Math.max(configuredGroups, maxAssignedGroup);

    return Array.from({ length: maxGroup }, (_, index) => index + 1);
}

function updateGroupFilterOptions() {
    const groupFilter = document.getElementById('groupFilter');
    if (!groupFilter) return;

    const currentVal = groupFilter.value;
    const availableGroups = getAvailableGroupNumbers(getContextStudents());

    groupFilter.innerHTML = '<option value="">-- تصفية بالفوج --</option>';

    availableGroups.forEach(group => {
        const opt = document.createElement('option');
        opt.value = group;
        opt.textContent = `فوج ${group}`;
        groupFilter.appendChild(opt);
    });

    if (availableGroups.includes(parseInt(currentVal, 10))) {
        groupFilter.value = currentVal;
    } else {
        groupFilter.value = '';
    }
}

function buildStudentSearchText(student) {
    const studentKey = getStudentKey(student);
    const examGroup = examGroupings[studentKey] || '';
    const isRepeater = (student.isRepeater === true || student.repeat === true || student.repeat === 'نعم') ? 'نعم' : 'لا';
    const genderLabel = student.gender === 'M' ? 'ذكر' : 'أنثى';
    const fullName = `${student.last_name || ''} ${student.first_name || ''}`.trim();

    return [
        student.last_name || '',
        student.first_name || '',
        fullName,
        student.level || '',
        student.class || '',
        student.stream || '',
        getStreamLabel(student.stream) || '',
        genderLabel,
        isRepeater,
        examGroup ? `فوج ${examGroup}` : '',
        student.tempAverage != null ? String(student.tempAverage) : ''
    ].join(' ').toLowerCase();
}

function isAverageOrderingActive() {
    return Boolean(document.getElementById('trimesterSelect')?.value);
}

function getGroupOrderEntries(students = [], options = {}) {
    const includeConfigured = options.includeConfigured === true;
    const useAverageOrder = options.useAverageOrder !== undefined ? options.useAverageOrder : isAverageOrderingActive();
    const grouped = new Map();

    students.forEach(student => {
        const groupNum = parseInt(examGroupings[getStudentKey(student)], 10) || 0;
        if (groupNum <= 0) return;
        if (!grouped.has(groupNum)) grouped.set(groupNum, []);
        grouped.get(groupNum).push(student);
    });

    if (includeConfigured) {
        const configuredGroups = parseInt(document.getElementById('numGroups')?.value, 10) || numGroups || 0;
        for (let i = 1; i <= configuredGroups; i++) {
            if (!grouped.has(i)) grouped.set(i, []);
        }
    }

    return Array.from(grouped.entries())
        .map(([groupNum, groupStudents]) => {
            const scoredStudents = groupStudents
                .map(student => parseFloat(student.tempAverage))
                .filter(avg => !Number.isNaN(avg));
            const average = scoredStudents.length
                ? scoredStudents.reduce((sum, avg) => sum + avg, 0) / scoredStudents.length
                : Number.NEGATIVE_INFINITY;

            return {
                groupNum: Number(groupNum),
                students: groupStudents,
                average
            };
        })
        .sort((a, b) => {
            if (useAverageOrder) {
                const aHasAverage = Number.isFinite(a.average);
                const bHasAverage = Number.isFinite(b.average);
                if (aHasAverage && bHasAverage && b.average !== a.average) {
                    return b.average - a.average;
                }
                if (aHasAverage !== bHasAverage) {
                    return aHasAverage ? -1 : 1;
                }
            }

            return a.groupNum - b.groupNum;
        });
}

async function populateYearDropdown(defaultYear) {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;

    // Get unique years from students and results databases
    const [studentsForAllYears, resultsForAllYears] = await Promise.all([
        DB.getStudents(true, true),
        DB.getResults(true)
    ]);
    const years = new Set();
    (studentsForAllYears || []).forEach(s => {
        const y = s.academic_year || s.schoolYear || s.year;
        if (y) years.add(y);
    });
    (resultsForAllYears || []).forEach(r => {
        const y = r.academic_year || r.schoolYear || r.school_year || r.year;
        if (y) years.add(y);
    });

    if (years.size === 0 && defaultYear) years.add(defaultYear);

    const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
    yearSelect.innerHTML = '';
    sortedYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    });

    if (defaultYear && years.has(defaultYear)) {
        yearSelect.value = defaultYear;
    } else if (sortedYears.length > 0) {
        yearSelect.value = sortedYears[0];
    }
}

async function handleYearChange() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;

    await ensureResultsYearSelection({ showFeedback: true });
    await loadStudents(yearSelect.value);
    populateFilters();
    updateStreamFilter();
    updateClassFilter();
    updateNumGroupsFromData();
    updateGroupFilterOptions();
    renderTable();
}

function checkStreamVisibility() {
    const streamSelect = document.getElementById('streamSelect');
    const streamFilter = streamSelect ? streamSelect.closest('.config-group') : null;
    const streamHeader = document.getElementById('streamHeader');

    if (institutionSettings.educationStage === 'secondary') {
        if (streamFilter) streamFilter.style.setProperty('display', 'flex', 'important');
        if (streamHeader) streamHeader.style.setProperty('display', 'table-cell', 'important');
    } else {
        if (streamFilter) streamFilter.style.setProperty('display', 'none', 'important');
        if (streamHeader) streamHeader.style.setProperty('display', 'none', 'important');
    }
}

async function loadStudents(year = null) {
    // If settings are not yet loaded, get them
    if (!institutionSettings.currentAcademicYear) {
        const settings = await DB.getSettings() || {};
        institutionSettings = settings;
    }

    const targetYear = year || institutionSettings.schoolYear || institutionSettings.currentAcademicYear;
    
    const trimesterSelect = document.getElementById('trimesterSelect');
    const trimester = trimesterSelect ? trimesterSelect.value : '';

    if (trimester !== '') {
        // Fetch from results
        const resultsData = await DB.getResults(true) || [];
        console.log('[groupByAvg] Total results fetched:', resultsData.length);
        if (resultsData.length > 0) {
            console.log('[groupByAvg] Sample result:', JSON.stringify({
                name: resultsData[0].name || resultsData[0].student_name,
                level: resultsData[0].level,
                class: resultsData[0].class,
                academic_year: resultsData[0].academic_year,
                averages: resultsData[0].averages,
                gender: resultsData[0].gender
            }));
        }
        
        // Filter by targetYear (with normalization)
        let targetData = resultsData;
        if (targetYear) {
            const normalizedTarget = String(targetYear).trim();
            const yearFiltered = resultsData.filter(r => {
                const ry = String(r.academic_year || r.schoolYear || r.school_year || r.year || '').trim();
                return ry === normalizedTarget;
            });
            console.log('[groupByAvg] After year filter (' + normalizedTarget + '):', yearFiltered.length);
            
            targetData = yearFiltered;
            if (yearFiltered.length === 0) {
                console.warn('[groupByAvg] No results matched academic year:', normalizedTarget);
            }
        }

        const normalizeValue = (value) => String(value == null ? '' : value).trim();
        const getFirstFilled = (...values) => {
            for (const value of values) {
                const normalized = normalizeValue(value);
                if (normalized) return normalized;
            }
            return '';
        };
        const deriveSecondaryLevel = (rawLevel, rawClassValue) => {
            const normalizedLevel = normalizeValue(rawLevel);
            if (normalizedLevel) return normalizedLevel;

            const classValue = normalizeValue(rawClassValue);
            if (!classValue) return '';

            const match = classValue.match(/^[\s\-_/]*(\d+)/);
            if (match) {
                return match[1];
            }

            return '';
        };

        // Deduplicate: keep unique students per normalized level+class+stream+name+dob
        const seen = new Set();
        const deduped = [];
        for (const r of targetData) {
            const normalizedClass = getFirstFilled(
                r.class,
                r.section,
                r.class_number,
                r.classNumber,
                r.group_class,
                r['القسم'],
                r['الفوج'],
                r.class_name
            );
            const normalizedLevel = institutionSettings.educationStage === 'secondary'
                ? deriveSecondaryLevel(
                    getFirstFilled(r.level, r.level_name, r.levelName, r.school_level, r['المستوى']),
                    normalizedClass
                )
                : getFirstFilled(r.level, r.level_name, r.levelName, r.school_level, r['المستوى']);
            const normalizedStream = getFirstFilled(
                r.stream,
                r.stream_name,
                r.streamName,
                r.specialty,
                r.branch,
                r.section_stream,
                r['الشعبة']
            );
            const normalizedName = getFirstFilled(
                r.student_name,
                r.studentName,
                r.name,
                r.full_name,
                r.fullName,
                r['اللقب و الاسم '],
                r['اللقب و الاسم'],
                r['الاسم و اللقب'],
                r['الاسم']
            );
            const normalizedDob = getFirstFilled(r.dob, r.birth_date, r.date_of_birth, r['تاريخ الميلاد']);
            const key = `${normalizedLevel}|${normalizedStream}|${normalizedClass}|${normalizedName}|${normalizedDob}`;

            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(r);
            }
        }
        targetData = deduped;

        console.log('[groupByAvg] Final targetData count:', targetData.length);

        allStudents = targetData.map(r => {
            // Results store full name in student_name/name field
            let lastName = '';
            let firstName = '';
            const fullName = getFirstFilled(
                r.student_name,
                r.studentName,
                r.name,
                r.full_name,
                r.fullName,
                r['اللقب و الاسم '],
                r['اللقب و الاسم'],
                r['الاسم و اللقب'],
                r['الاسم']
            );
            const parts = fullName.trim().split(/\s+/);
            if (parts.length >= 2) {
                lastName = parts[0];
                firstName = parts.slice(1).join(' ');
            } else {
                lastName = fullName;
            }

            // Normalize gender
            let gender = getFirstFilled(r.gender, r.sex, r['الجنس']);
            if (gender === '\u0630\u0643\u0631') gender = 'M';
            else if (gender === '\u0623\u0646\u062b\u0649') gender = 'F';

            const normalizedStream = getFirstFilled(
                r.stream,
                r.stream_name,
                r.streamName,
                r.specialty,
                r.branch,
                r.section_stream,
                r['الشعبة']
            );
            const normalizedClass = getFirstFilled(
                r.class,
                r.section,
                r.class_number,
                r.classNumber,
                r.group_class,
                r['القسم'],
                r['الفوج'],
                r.class_name
            );
            const normalizedLevel = institutionSettings.educationStage === 'secondary'
                ? deriveSecondaryLevel(
                    getFirstFilled(r.level, r.level_name, r.levelName, r.school_level, r['المستوى']),
                    normalizedClass
                )
                : getFirstFilled(r.level, r.level_name, r.levelName, r.school_level, r['المستوى']);

            // Try to get average from averages object
            let avg = 0;
            if (r.averages) {
                // Try key as string number first ('1', '2', '3')
                if (r.averages[trimester] !== undefined) {
                    avg = parseFloat(r.averages[trimester]) || 0;
                } else if (r.averages['\u0627\u0644\u0623\u0648\u0644'] !== undefined && trimester === '1') {
                    avg = parseFloat(r.averages['\u0627\u0644\u0623\u0648\u0644']) || 0;
                } else if (r.averages['\u0627\u0644\u062b\u0627\u0646\u064a'] !== undefined && trimester === '2') {
                    avg = parseFloat(r.averages['\u0627\u0644\u062b\u0627\u0646\u064a']) || 0;
                } else if (r.averages['\u0627\u0644\u062b\u0627\u0644\u062b'] !== undefined && trimester === '3') {
                    avg = parseFloat(r.averages['\u0627\u0644\u062b\u0627\u0644\u062b']) || 0;
                }
            }
            // Fallback: use the general average field
            if (avg === 0 && r.average) {
                avg = parseFloat(r.average) || 0;
            }

            return {
                national_id: getFirstFilled(r.national_id, r.student_id, r.id_number, r['رقم التعريف']),
                last_name: lastName,
                first_name: firstName,
                birth_date: getFirstFilled(r.dob, r.birth_date, r.date_of_birth, r['تاريخ الميلاد']),
                gender: gender,
                level: normalizedLevel,
                stream: normalizedStream,
                class: normalizedClass,
                academic_year: getFirstFilled(r.academic_year, r.schoolYear, r.school_year, r.year),
                isRepeater: r.isRepeater || r.is_repeater || false,
                repeat: r.isRepeater || r.is_repeater || false,
                tempAverage: avg
            };
        });

        console.log('[groupByAvg] allStudents mapped:', allStudents.length);
        if (allStudents.length > 0) {
            console.log('[groupByAvg] Sample student:', JSON.stringify(allStudents[0]));
        }
    } else {
        // Fetch normal students list
        allStudents = await DB.getStudents(true, targetYear) || [];
    }

    if (allStudents.length === 0 && !year && trimester === '') {
        console.warn('No students found for current academic year. Trying to fetch all students as fallback.');
        allStudents = await DB.getStudents(true, true) || [];
    }

    allStudents = allStudents.filter(s => s.status !== 'struck_off' && s.struck_off !== 1 && s.struck_off !== '1' && s.struck_off !== true);
}

async function loadExamGroupings() {

    examGroupings = await DB.get('examGroupings') || {};

}

async function saveExamGroupings() {

    await DB.set('examGroupings', examGroupings);

}

async function loadRoomSettings() {

    roomSettings = await DB.get('roomSettings') || {};

}

async function saveRoomSettings() {

    await DB.set('roomSettings', roomSettings);

}

function populateFilters() {

    const levels = [...new Set(allStudents.map(s => s.level))].sort();

    const levelSelect = document.getElementById('levelSelect');

    levelSelect.innerHTML = '<option value="">-- اختر المستوى --</option>';

    levels.forEach(level => {

        if (level) {

            const option = document.createElement('option');

            option.value = level;

            const __fmtLvl = (n) => ({ "1":"\u0627\u0644\u0623\u0648\u0644\u0649", "2":"\u0627\u0644\u062b\u0627\u0646\u064a\u0629", "3":"\u0627\u0644\u062b\u0627\u0644\u062b\u0629", "4":"\u0627\u0644\u0631\u0627\u0628\u0639\u0629" }[String(n).trim()] || n); option.textContent = __fmtLvl(level);

            levelSelect.appendChild(option);

        }

    });

}

function updateStreamFilter() {

    const selectedLevel = document.getElementById('levelSelect').value;

    const streamSelect = document.getElementById('streamSelect');

    streamSelect.innerHTML = '<option value="">-- كل الشعب --</option>';

    if (!selectedLevel) return;

    // Get unique streams for this level

    const streams = [...new Set(allStudents

        .filter(s => s.level === selectedLevel && s.stream)

        .map(s => s.stream))].sort();

    streams.forEach(st => {

        const option = document.createElement('option');

        option.value = st;

        option.textContent = getStreamLabel(st);

        streamSelect.appendChild(option);

    });

}

function updateClassFilter() {

    const selectedLevel = document.getElementById('levelSelect').value;

    const selectedStream = document.getElementById('streamSelect').value;

    const classSelect = document.getElementById('classSelect');

    classSelect.innerHTML = '<option value="">-- كل الأقسام --</option>';

    if (!selectedLevel) return;

    let filtered = allStudents.filter(s => s.level === selectedLevel);

    if (selectedStream) {

        filtered = filtered.filter(s => s.stream === selectedStream);

    }

    const classes = [...new Set(filtered.map(s => s.class))];

    // Sort classes numerically

    classes.sort((a, b) => {

        const na = parseInt(a);

        const nb = parseInt(b);

        if (!isNaN(na) && !isNaN(nb)) return na - nb;

        return String(a).localeCompare(String(b));

    });

    classes.forEach(cls => {

        if (cls) {

            const option = document.createElement('option');

            option.value = cls;

            option.textContent = cls;

            classSelect.appendChild(option);

        }

    });

}

function updateNumGroupsFromData() {

    const level = document.getElementById('levelSelect').value;

    if (!level) return;

    // filter students by level

    const levelStudents = allStudents.filter(s => s.level === level);

    // find max group number

    let maxGroup = 0;

    levelStudents.forEach(s => {

        const key = getStudentKey(s);

        const group = parseInt(examGroupings[key]) || 0;

        if (group > maxGroup) maxGroup = group;

    });

    if (maxGroup >= 2) {

        document.getElementById('numGroups').value = maxGroup;

        numGroups = maxGroup;

        updateRoomInputs();

    }

}

let gridInstance = null;

function renderTable() {
    const level = document.getElementById('levelSelect').value;
    const groupFilt = document.getElementById('groupFilter')?.value || '';
    const searchQuery = (document.getElementById('tableSearchInput')?.value || '').trim().toLowerCase();
    const wrapper = document.getElementById('gridjs-wrapper');
    const statsCard = document.getElementById('statsCard');
    const useAverageOrder = isAverageOrderingActive();

    if (!wrapper) return;

    if (!level) {
        statsCard.style.display = 'none';
        document.getElementById('listSummary').textContent = 'اختر المستوى لعرض القائمة';
        if (gridInstance) {
            try { gridInstance.destroy(); } catch (e) { }
            gridInstance = null;
        }
        wrapper.innerHTML = '';
        return;
    }

    // Filter students by level, stream, and class
    filteredStudents = getContextStudents();

    if (groupFilt !== '') {
        filteredStudents = filteredStudents.filter(s => {
            const key = getStudentKey(s);
            return examGroupings[key] == groupFilt;
        });
    }

    if (searchQuery) {
        filteredStudents = filteredStudents.filter(student => buildStudentSearchText(student).includes(searchQuery));
    }

    const groupOrderMap = new Map(
        getGroupOrderEntries(filteredStudents, { includeConfigured: false, useAverageOrder })
            .map((entry, index) => [entry.groupNum, index])
    );

    // Sort for display
    filteredStudents.sort((a, b) => {
        if (useAverageOrder) {
            const groupA = parseInt(examGroupings[getStudentKey(a)], 10) || 0;
            const groupB = parseInt(examGroupings[getStudentKey(b)], 10) || 0;
            const rankA = groupOrderMap.has(groupA) ? groupOrderMap.get(groupA) : Number.MAX_SAFE_INTEGER;
            const rankB = groupOrderMap.has(groupB) ? groupOrderMap.get(groupB) : Number.MAX_SAFE_INTEGER;

            if (rankA !== rankB) return rankA - rankB;

            const avgDiff = (parseFloat(b.tempAverage) || 0) - (parseFloat(a.tempAverage) || 0);
            if (avgDiff !== 0) return avgDiff;
        }

        if (a.class !== b.class) {
            const na = parseInt(a.class);
            const nb = parseInt(b.class);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return String(a.class).localeCompare(String(b.class));
        }

        return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
    });

    const trimesterSelect = document.getElementById('trimesterSelect');
    const trimester = trimesterSelect ? trimesterSelect.value : '';

    // Map data for Grid.js
    const data = filteredStudents.map((s, idx) => {
        const studentKey = getStudentKey(s);
        const examGroup = examGroupings[studentKey] || '-';
        const groupClass = getGroupClass(examGroup);

        let rowData;
        if (trimester !== '') {
            // Merged view for Trimester
            rowData = [
                idx + 1,
                ((s.last_name || '') + ' ' + (s.first_name || '')).trim(),
                s.gender === 'M' ? 'ذكر' : 'أنثى',
                s.class || '',
                (s.isRepeater === true || s.repeat === true || s.repeat === 'نعم') ? 'نعم' : 'لا',
                s.tempAverage ? s.tempAverage.toFixed(2) : '0.00'
            ];
        } else {
            // Normal view
            rowData = [
                idx + 1,
                s.last_name || '',
                s.first_name || '',
                s.gender === 'M' ? 'ذكر' : 'أنثى',
                s.class || '',
                (s.isRepeater === true || s.repeat === true || s.repeat === 'نعم') ? 'نعم' : 'لا'
            ];
        }

        // Group cell has a click action
        const groupCellHtml = `<div class="group-cell ${groupClass}" onclick="toggleExamGroup(event, '${studentKey}')">${examGroup === '-' ? 'اضغط للتحديد' : 'فوج ' + examGroup}</div>`;

        // If secondary, inject stream
        if (institutionSettings.educationStage === 'secondary') {
            const streamIdx = (trimester !== '') ? 3 : 4;
            rowData.splice(streamIdx, 0, gridjs.html(`<span class="badge badge-stream">${getStreamLabel(s.stream) || '-'}</span>`));
        }

        rowData.push(gridjs.html(groupCellHtml));

        return rowData;
    });

    let columns;
    if (trimester !== '') {
        columns = [
            { name: '#', width: '60px' },
            'الاسم واللقب',
            { name: 'الجنس', width: '80px' },
            { name: 'القسم', width: '60px' },
            { name: 'الإعادة', width: '70px' },
            { 
                name: 'المعدل', 
                width: '100px',
                sort: {
                    compare: (a, b) => {
                        const floatA = parseFloat(a) || 0;
                        const floatB = parseFloat(b) || 0;
                        if (floatA > floatB) return 1;
                        if (floatA < floatB) return -1;
                        return 0;
                    }
                }
            }
        ];
    } else {
        columns = [
            { name: '#', width: '60px' },
            'اللقب',
            'الاسم',
            { name: 'الجنس', width: '80px' },
            { name: 'القسم', width: '60px' },
            { name: 'الإعادة', width: '70px' }
        ];
    }

    if (institutionSettings.educationStage === 'secondary') {
        const streamColIdx = (trimester !== '') ? 3 : 4;
        columns.splice(streamColIdx, 0, { name: 'الشعبة', width: '180px' });
    }

    columns.push({ name: 'فوج الامتحان', width: '110px', sort: false }); // Sort disabled to prevent messing with manual groupings

    // Always destroy and recreate to avoid Grid.js pipeline cache corruption
    if (gridInstance) {
        try { gridInstance.destroy(); } catch (e) { }
        gridInstance = null;
    }
    wrapper.innerHTML = '';

    gridInstance = new gridjs.Grid({
        columns: columns,
        data: data,
        search: false,
        sort: true,
        pagination: false,
        language: {
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
            td: { textAlign: 'center', verticalAlign: 'middle', padding: '10px 15px' },
            th: { textAlign: 'center', padding: '10px 15px' }
        }
    }).render(wrapper);

    // Icon consistency for Windows 7
    gridInstance.on('render', () => {
        if (typeof IconManager !== 'undefined') IconManager.render();
    });

    updateStats();
    updateSummary();
    updateRoomInputs();
    statsCard.style.display = 'flex';
}

function getStudentKey(student) {

    // Create unique key for student

    return `${student.level}_${student.class}_${student.last_name}_${student.first_name}_${student.birth_date}`;

}

function getGroupClass(group) {

    if (group === '-' || !group) return '';

    const groupNum = parseInt(group);

    if (groupNum >= 1 && groupNum <= 6) return `group-${groupNum}`;

    if (groupNum > 6) return 'group-generic';

    return 'group-1'; // Default

}

function toggleExamGroup(event, studentKey) {
    const currentGroup = examGroupings[studentKey] || 0;
    const currentNum = parseInt(currentGroup) || 0;

    // Cycle through groups: 0 -> 1 -> 2 -> ... -> numGroups -> 0 (Clear)
    let nextGroup = currentNum + 1;
    if (nextGroup > numGroups) {
        nextGroup = 0; // Clear state
    }

    examGroupings[studentKey] = nextGroup;
    saveExamGroupings();

    // Instant UI Update
    const cell = event.currentTarget;
    if (cell) {
        // Remove old group classes
        for (let i = 1; i <= 20; i++) {
            cell.classList.remove(`group-${i}`);
        }
        cell.classList.remove('group-generic');

        // Add new state
        if (nextGroup === 0) {
            cell.textContent = 'اضغط للتحديد';
            cell.className = 'group-cell';
        } else {
            cell.textContent = 'فوج ' + nextGroup;
            cell.classList.add(getGroupClass(nextGroup));
        }
    }

    // Refresh non-intrusive UI elements
    updateGroupFilterOptions();
    updateStats();
    updateSummary();
    updateRoomInputs();
}

async function importDefaultGroups() {
    const level = document.getElementById('levelSelect').value;
    const cls = document.getElementById('classSelect').value;

    if (!level) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولا' });
        return;
    }

    const confirm = await Swal.fire({
        title: 'استيراد التفويج الافتراضي',
        html: '<div style="text-align:right; direction:rtl; font-size:0.95rem; line-height:1.6;">سوف يتم استيراد توزيع التلاميذ بناءً على <b>الأفواج الفرعية</b> المحددة مسبقاً في "قائمة التلاميذ".<br><br>هل تريد الاستمرار في جلب هذه البيانات؟</div>',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'نعم، استيراد',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b'
    });

    if (!confirm.isConfirmed) return;

    let studentsToImport;
    if (cls) {
        studentsToImport = allStudents.filter(s => s.level === level && s.class === cls);
    } else {
        studentsToImport = allStudents.filter(s => s.level === level);
    }

    if (studentsToImport.length === 0) {
        Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا يوجد تلاميذ للاستيراد' });
        return;
    }

    let imported = 0;
    studentsToImport.forEach(s => {
        if (s.sub_group) {
            const key = getStudentKey(s);
            examGroupings[key] = s.sub_group;
            imported++;
        }
    });

    saveExamGroupings();
    renderTable();

    Swal.fire({
        icon: 'success',
        title: 'تم الاستيراد',
        text: `تم جلب التفويج الافتراضي لـ ${imported} تلميذ بنجاح`,
        timer: 2000,
        showConfirmButton: false
    });
}

async function randomGroupByLevel() {

    const level = document.getElementById('levelSelect').value;

    const cls = document.getElementById('classSelect').value;

    const stream = document.getElementById('streamSelect').value;

    numGroups = parseInt(document.getElementById('numGroups').value) || 2;

    if (!level) {

        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولا' });

        return;

    }

    // Determine scope based on selection

    let studentsToGroup;

    let scopeText;

    // Trim values to avoid whitespace issues

    const cleanCls = cls ? cls.trim() : "";

    const cleanStream = stream ? stream.trim() : "";

    if (cleanCls !== "") {

        // 1. Specific Class (High Priority)

        // Also filter by stream if selected to avoid mixing students from different streams with same class number

        if (cleanStream !== "") {

            studentsToGroup = allStudents.filter(s => s.level == level && s.stream === stream && s.class == cleanCls);

            scopeText = `شعبة "${getStreamLabel(stream)}" - قسم "${cleanCls}"`;

        } else {

            studentsToGroup = allStudents.filter(s => s.level == level && s.class == cleanCls);

            scopeText = `قسم "${cleanCls}"`;

        }

    } else if (cleanStream !== "") {

        // 2. Specific Stream

        studentsToGroup = allStudents.filter(s => s.level === level && s.stream === stream);

        scopeText = `شعبة "${getStreamLabel(stream)}"`;

    } else {

        // 3. Entire Level

        studentsToGroup = allStudents.filter(s => s.level === level);

        scopeText = `كل تلاميذ المستوى "${level}"`;

    }

    if (studentsToGroup.length === 0) {

        Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا يوجد تلاميذ للتفويج في هذا النطاق' });

        return;

    }

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: `هل أنت متأكد من التفويج العشوائي ل: ${scopeText}\nسيتم توزيعهم على ${numGroups} أفواج.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'نعم، تابع',
        cancelButtonText: 'إلغاء'
    });

    if (!result.isConfirmed) {

        return;

    }

    // Initialize groups
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
        groups[i] = [];
    }

    // Greedy Distribution Logic to balance size, repeaters, class, and gender
    // 1. Shuffle thoroughly
    const shuffled = [...studentsToGroup];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 2. Stable sort to process Repeaters first (critical for sparse trait balancing)
    shuffled.sort((a, b) => {
        const aR = (a.isRepeater === true || a.repeat === true || a.repeat === 'نعم') ? 1 : 0;
        const bR = (b.isRepeater === true || b.repeat === true || b.repeat === 'نعم') ? 1 : 0;
        return bR - aR;
    });

    const groupStats = Array.from({ length: numGroups }, () => ({
        total: 0,
        males: 0,
        females: 0,
        repeaters: 0,
        classes: {}
    }));

    // 3. Deal students into the best group to minimize variance
    shuffled.forEach(s => {
        const isM = s.gender === 'M';
        let bestGroup = -1;
        let minScore = Infinity;

        for (let i = 0; i < numGroups; i++) {
            const c = groupStats[i];
            const classCount = c.classes[s.class] || 0;

            // Score components:
            // Total size absolute priority
            // Repeaters next priority (only evaluated if student is repeater)
            // Class distribution
            // Gender distribution
            const score = c.total * 10000
                + (s.isRepeater ? c.repeaters * 1000 : 0)
                + classCount * 100
                + (isM ? c.males : c.females) * 10;

            if (score < minScore) {
                minScore = score;
                bestGroup = i;
            } else if (score === minScore) {
                // Random tie breaker
                if (Math.random() > 0.5) bestGroup = i;
            }
        }

        if (bestGroup === -1) bestGroup = 0;

        // Assign to best group
        groups[bestGroup].push(s);

        // Update stats
        const c = groupStats[bestGroup];
        c.total++;
        if (isM) c.males++;
        else c.females++;
        if (s.isRepeater === true || s.repeat === true || s.repeat === 'نعم') c.repeaters++;
        c.classes[s.class] = (c.classes[s.class] || 0) + 1;
    });

    // Save results

    groups.forEach((groupStudents, idx) => {

        const groupNum = idx + 1;

        groupStudents.forEach(s => {

            const key = getStudentKey(s);

            examGroupings[key] = groupNum;

        });

    });

    saveExamGroupings();

    renderTable();

    Swal.fire({
        icon: 'success',
        title: 'تم التفويج',
        text: `تم التفويج بنجاح!\nتم توزيع ${studentsToGroup.length} تلميذ.`,
        timer: 2000,
        showConfirmButton: false
    });

}

async function groupByName() {
    const level = document.getElementById('levelSelect').value;
    const cls = document.getElementById('classSelect').value;
    const stream = document.getElementById('streamSelect').value;
    numGroups = parseInt(document.getElementById('numGroups').value) || 2;

    if (!level) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولا' });
        return;
    }

    let studentsToGroup;
    let scopeText;
    const cleanCls = cls ? cls.trim() : "";
    const cleanStream = stream ? stream.trim() : "";

    if (cleanCls !== "") {
        if (cleanStream !== "") {
            studentsToGroup = allStudents.filter(s => s.level == level && s.stream === stream && s.class == cleanCls);
            scopeText = `شعبة "${getStreamLabel(stream)}" - قسم "${cleanCls}"`;
        } else {
            studentsToGroup = allStudents.filter(s => s.level == level && s.class == cleanCls);
            scopeText = `قسم "${cleanCls}"`;
        }
    } else if (cleanStream !== "") {
        studentsToGroup = allStudents.filter(s => s.level === level && s.stream === stream);
        scopeText = `شعبة "${getStreamLabel(stream)}"`;
    } else {
        studentsToGroup = allStudents.filter(s => s.level === level);
        scopeText = `كل تلاميذ المستوى "${level}"`;
    }

    if (studentsToGroup.length === 0) {
        Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا يوجد تلاميذ للتفويج في هذا النطاق' });
        return;
    }

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: `هل أنت متأكد من التفويج حسب الاسم أبجدياً (متتالي) ل: ${scopeText}\nسيتم توزيعهم على ${numGroups} أفواج.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'نعم، تفويج بالاسم',
        cancelButtonText: 'إلغاء'
    });

    if (!result.isConfirmed) {
        return;
    }

    // Initialize groups
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
        groups[i] = [];
    }

    // 1. Sort all strictly by Name alphabetically (First Name then Last Name)
    const sortedStudents = [...studentsToGroup].sort((a, b) => {
        return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
    });

    // 2. Sequential Chunking
    const totalStudents = sortedStudents.length;
    let currentStudentIdx = 0;

    for (let i = 0; i < numGroups; i++) {
        const studentsRemaining = totalStudents - currentStudentIdx;
        const groupsRemaining = numGroups - i;
        const groupSize = Math.ceil(studentsRemaining / groupsRemaining);
        
        for (let j = 0; j < groupSize && currentStudentIdx < totalStudents; j++) {
            groups[i].push(sortedStudents[currentStudentIdx]);
            currentStudentIdx++;
        }
    }

    // Save results
    groups.forEach((groupStudents, idx) => {
        const groupNum = idx + 1;
        groupStudents.forEach(s => {
            const key = getStudentKey(s);
            examGroupings[key] = groupNum;
        });
    });

    saveExamGroupings();
    renderTable();

    Swal.fire({
        icon: 'success',
        title: 'تم التفويج',
        text: `تم التفويج حسب الاسم بنجاح!\nتم توزيع ${studentsToGroup.length} تلميذ.`,
        timer: 2000,
        showConfirmButton: false
    });
}

async function genderGroupByLevel() {
    const level = document.getElementById('levelSelect').value;
    const cls = document.getElementById('classSelect').value;
    const stream = document.getElementById('streamSelect').value;
    numGroups = parseInt(document.getElementById('numGroups').value) || 2;

    if (!level) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولا' });
        return;
    }

    // Determine scope based on selection
    let studentsToGroup;
    let scopeText;

    const cleanCls = cls ? cls.trim() : "";
    const cleanStream = stream ? stream.trim() : "";

    if (cleanCls !== "") {
        if (cleanStream !== "") {
            studentsToGroup = allStudents.filter(s => s.level == level && s.stream === stream && s.class == cleanCls);
            scopeText = `شعبة "${getStreamLabel(stream)}" - قسم "${cleanCls}"`;
        } else {
            studentsToGroup = allStudents.filter(s => s.level == level && s.class == cleanCls);
            scopeText = `قسم "${cleanCls}"`;
        }
    } else if (cleanStream !== "") {
        studentsToGroup = allStudents.filter(s => s.level === level && s.stream === stream);
        scopeText = `شعبة "${getStreamLabel(stream)}"`;
    } else {
        studentsToGroup = allStudents.filter(s => s.level === level);
        scopeText = `كل تلاميذ المستوى "${level}"`;
    }

    if (studentsToGroup.length === 0) {
        Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا يوجد تلاميذ للتفويج في هذا النطاق' });
        return;
    }

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: `هل أنت متأكد من التفويج حسب الجنس (متوازن) ل: ${scopeText}\nسيتم توزيعهم على ${numGroups} أفواج.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'نعم، تابع',
        cancelButtonText: 'إلغاء'
    });

    if (!result.isConfirmed) {
        return;
    }

    // Initialize groups
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
        groups[i] = [];
    }

    // 1. Sort all by Gender (M then F) then Name
    const sortedStudents = [...studentsToGroup].sort((a, b) => {
        if (a.gender !== b.gender) {
            return a.gender === 'M' ? -1 : 1;
        }
        return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
    });

    // 2. Stable sort to process Repeaters first
    sortedStudents.sort((a, b) => {
        const aR = (a.isRepeater === true || a.repeat === true || a.repeat === 'نعم') ? 1 : 0;
        const bR = (b.isRepeater === true || b.repeat === true || b.repeat === 'نعم') ? 1 : 0;
        return bR - aR;
    });

    const groupStats = Array.from({ length: numGroups }, () => ({
        total: 0,
        males: 0,
        females: 0,
        repeaters: 0
    }));

    let groupIndex = 0;

    // 3. Deal round-robin to ensure strict numerical splits for Gender/Repeaters
    // Because the array is ordered Repeaters(M,F) -> Non-Repeaters(M,F), dealing round robin
    // guarantees nearly perfect balance for repeaters and genders.
    sortedStudents.forEach(s => {
        // Find the group that needs this student most (Greedy Assigner logic adapted for Gender focus)
        const isM = s.gender === 'M';
        let bestGroup = -1;
        let minScore = Infinity;

        for (let i = 0; i < numGroups; i++) {
            const c = groupStats[i];

            // Score components: Total size > Repeaters > Gender
            const score = c.total * 10000
                + (s.isRepeater ? c.repeaters * 1000 : 0)
                + (isM ? c.males : c.females) * 100;

            if (score < minScore) {
                minScore = score;
                bestGroup = i;
            } else if (score === minScore) {
                // To maintain the Name sorting order aesthetics within the group,
                // we break ties by just picking the next sequential group under the tie.
                if (bestGroup === -1 || (i > bestGroup && Math.random() > 0.5)) {
                    bestGroup = i;
                }
            }
        }

        if (bestGroup === -1) bestGroup = 0;

        groups[bestGroup].push(s);

        const c = groupStats[bestGroup];
        c.total++;
        if (isM) c.males++;
        else c.females++;
        if (s.isRepeater === true || s.repeat === true || s.repeat === 'نعم') c.repeaters++;
    });

    // Save results
    groups.forEach((groupStudents, idx) => {
        const groupNum = idx + 1;
        groupStudents.forEach(s => {
            const key = getStudentKey(s);
            examGroupings[key] = groupNum;
        });
    });

    saveExamGroupings();
    renderTable();
    Swal.fire({
        icon: 'success',
        title: 'تم التفويج',
        text: `تم التفويج حسب الجنس بنجاح!\nتم توزيع ${studentsToGroup.length} تلميذ.`,
        timer: 2000,
        showConfirmButton: false
    });
}

function updateStatsLegacy() {
    const statsCard = document.getElementById('statsCard');
    if (!statsCard) return;

    statsCard.innerHTML = '';
    const groupEntries = getGroupOrderEntries(filteredStudents, { includeConfigured: true });

    groupEntries.forEach(({ groupNum, students: groupStudents }) => {
        const total = groupStudents.length;
        const males = groupStudents.filter(s => s.gender === 'M').length;
        const females = total - males;
        const repeaters = groupStudents.filter(s => s.isRepeater === true || s.repeat === true || s.repeat === 'نعم').length;

        statsCard.innerHTML += `
            <div style="min-width: 250px; flex: 1;">
                <div class="card border-0 shadow-sm h-100" style="border-right: 4px solid ${getGroupColor(groupNum)} !important;">
                    <div class="card-body p-2 d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center">
                            <div class="rounded-circle bg-light p-2 me-2 d-flex align-items-center justify-content-center" style="width:32px; height:32px; background: rgba(0,0,0,0.05) !important;">
                                <i class="fas fa-users" style="color: ${getGroupColor(groupNum)}; font-size: 0.8rem;"></i>
                            </div>
                            <div style="line-height: 1.1;">
                                <span class="d-block text-muted fw-bold" style="font-size: 0.7rem;">الفوج ${groupNum}</span>
                                <span class="fw-bold text-dark" style="font-size: 0.9rem;">${total}</span>
                            </div>
                        </div>
                        <div class="d-flex gap-1">
                            <span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 py-1 px-2" style="font-size: 0.7rem;"><i class="fas fa-male me-1"></i>${males}</span>
                            <span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 py-1 px-2" style="font-size: 0.7rem;"><i class="fas fa-female me-1"></i>${females}</span>
                            <span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-10 py-1 px-2" style="font-size: 0.7rem;"><i class="fas fa-redo me-1"></i>${repeaters}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    statsCard.style.display = 'flex';
}

function updateStats() {
    const statsCard = document.getElementById('statsCard');
    if (!statsCard) return;

    statsCard.innerHTML = '';
    statsCard.style.display = 'flex';
    statsCard.style.flexWrap = 'wrap';
    statsCard.style.overflow = 'visible';
    statsCard.style.gap = '8px';

    const groupEntries = getGroupOrderEntries(filteredStudents, { includeConfigured: true });
    if (groupEntries.length === 0) {
        statsCard.innerHTML = `
            <div style="padding:8px 10px; border:1px dashed #cbd5e1; border-radius:12px; color:#64748b; font-size:0.8rem; font-weight:700;">
                لا توجد إحصائيات أفواج لعرضها.
            </div>
        `;
        return;
    }

    groupEntries.forEach(({ groupNum, students: groupStudents }) => {
        const total = groupStudents.length;
        const males = groupStudents.filter(s => s.gender === 'M').length;
        const females = total - males;
        const repeaters = groupStudents.filter(s => s.isRepeater === true || s.repeat === true || s.repeat === 'نعم').length;
        const repeaterChip = repeaters > 0
            ? `<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border-radius:999px; background: var(--card-bg)7ed; color:#b45309; border:1px solid #fdba74; font-size:0.66rem; font-weight:800;">إ ${repeaters}</span>`
            : '';

        statsCard.innerHTML += `
            <div style="flex:0 1 auto; min-width:148px; max-width:186px;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:50px; padding:8px 10px; border-radius:12px; border:1px solid var(--border-color); background: var(--card-bg)fff; border-inline-start:4px solid ${getGroupColor(groupNum)}; box-shadow:0 1px 2px rgba(15,23,42,0.04);">
                    <div style="display:flex; flex-direction:column; gap:2px; min-width:48px;">
                        <span style="font-size:0.68rem; color:#64748b; font-weight:800; line-height:1;">الفوج ${groupNum}</span>
                        <span style="font-size:0.98rem; color:#0f172a; font-weight:900; line-height:1;">${total}</span>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; justify-content:flex-end; gap:4px;">
                        <span style="display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border-radius:999px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:0.66rem; font-weight:800;">ذ ${males}</span>
                        <span style="display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border-radius:999px; background: var(--card-bg)1f2; color:#be123c; border:1px solid #fecdd3; font-size:0.66rem; font-weight:800;">أ ${females}</span>
                        ${repeaterChip}
                    </div>
                </div>
            </div>
        `;
    });
}

function getGroupColor(groupNum) {

    const colors = ['var(--secondary-color)', '#c0392b', '#27ae60', '#e67e22', '#8e44ad', '#34495e'];

    return colors[(groupNum - 1) % colors.length];

}

function updateSummary() {

    const summary = document.getElementById('listSummary');

    const level = document.getElementById('levelSelect').value;

    const cls = document.getElementById('classSelect').value;

    const total = filteredStudents.length;

    const males = filteredStudents.filter(s => s.gender === 'M').length;

    const females = total - males;

    const assigned = filteredStudents.filter(s => examGroupings[getStudentKey(s)]).length;

    let text = `${level}`;

    if (cls) text += ` - القسم ${cls}`;

    text += ` | العدد: ${total} (ذكور: ${males} | إناث: ${females}) | تم تفويج: ${assigned}`;

    summary.textContent = text;

}

function getTrimesterDisplayLabel(value) {

    const labels = {
        '1': 'الفصل الأول',
        '2': 'الفصل الثاني',
        '3': 'الفصل الثالث',
        'blanc': 'الامتحان التجريبي (متوسط)',
        'blanc_lycee': 'الامتحان التجريبي (ثانوي)'
    };

    return labels[value] || 'بدون اعتماد النتائج';

}

async function exportExamListToExcel() {

    if (!window.ExcelExportHelper) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'ميزة تصدير Excel غير جاهزة حالياً' });
        return;
    }

    const level = document.getElementById('levelSelect').value;
    if (!level) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولاً' });
        return;
    }

    if (filteredStudents.length === 0) {
        Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا توجد بيانات لتصديرها' });
        return;
    }

    const settings = institutionSettings && Object.keys(institutionSettings).length
        ? institutionSettings
        : (await DB.getSettings() || {});
    institutionSettings = settings;

    const trimester = document.getElementById('trimesterSelect')?.value || '';
    const cls = document.getElementById('classSelect')?.value || '';
    const stream = document.getElementById('streamSelect')?.value || '';
    const groupFilter = document.getElementById('groupFilter')?.value || '';
    const yearValue = document.getElementById('yearSelect')?.value || settings.schoolYear || settings.currentAcademicYear || '';
    const searchQuery = (document.getElementById('tableSearchInput')?.value || '').trim();
    const isSecondary = settings.educationStage === 'secondary';

    const headers = ['#'];
    if (trimester !== '') {
        headers.push('الاسم واللقب');
    } else {
        headers.push('اللقب', 'الاسم');
    }
    headers.push('الجنس');
    if (isSecondary) headers.push('الشعبة');
    headers.push('القسم', 'الإعادة');
    if (trimester !== '') headers.push('المعدل');
    headers.push('فوج الاختبار');

    const rows = filteredStudents.map((student, index) => {
        const row = [index + 1];

        if (trimester !== '') {
            row.push(`${student.last_name || ''} ${student.first_name || ''}`.trim());
        } else {
            row.push(student.last_name || '', student.first_name || '');
        }

        row.push(student.gender === 'M' ? 'ذكر' : 'أنثى');

        if (isSecondary) {
            row.push(getStreamLabel(student.stream) || '');
        }

        row.push(
            student.class || '',
            (student.isRepeater === true || student.repeat === true || student.repeat === 'نعم') ? 'نعم' : 'لا'
        );

        if (trimester !== '') {
            row.push(student.tempAverage ? Number(student.tempAverage).toFixed(2) : '0.00');
        }

        const examGroup = examGroupings[getStudentKey(student)] || '';
        row.push(examGroup ? `فوج ${examGroup}` : 'غير محدد');

        return row;
    });

    const total = filteredStudents.length;
    const males = filteredStudents.filter(s => s.gender === 'M').length;
    const females = total - males;
    const assigned = filteredStudents.filter(s => examGroupings[getStudentKey(s)]).length;

    const filterParts = [`المستوى: ${level}`];
    if (cls) filterParts.push(`القسم: ${cls}`);
    if (isSecondary && stream) filterParts.push(`الشعبة: ${getStreamLabel(stream) || stream}`);
    if (groupFilter) filterParts.push(`الفوج: ${groupFilter}`);

    const metaRows = [
        `السنة الدراسية: ${yearValue} | المؤسسة: ${settings.institutionName || ''}`,
        `الفصل/الاختبار: ${getTrimesterDisplayLabel(trimester)}`,
        `التصفية الحالية: ${filterParts.join(' | ')}`,
        `الإحصائيات: العدد ${total} | ذكور ${males} | إناث ${females} | تم تفويج ${assigned}`
    ];

    if (searchQuery) {
        metaRows.push(`البحث الحالي: ${searchQuery}`);
    }

    try {
        await window.ExcelExportHelper.exportWorkbook({
            fileName: `قوائم_الاختبار_${window.ExcelExportHelper.dateStamp()}.xlsx`,
            sheets: [{
                sheetName: 'قوائم الاختبار',
                title: 'قوائم الاختبار',
                metaRows: metaRows,
                headers: headers,
                rows: rows
            }]
        });
    } catch (error) {
        console.error('Export Exam List Error:', error);
        Swal.fire({ icon: 'error', title: 'خطأ', text: `تعذر تصدير الملف: ${error.message}` });
    }

}

function updateRoomInputs() {

    const container = document.getElementById('roomInputs');

    const level = document.getElementById('levelSelect').value;

    if (!level) {

        container.style.display = 'none';

        return;

    }

    numGroups = parseInt(document.getElementById('numGroups').value) || 2;

    container.innerHTML = '<strong style="width: 100%; margin-bottom: 10px;">أرقام القاعات (للطباعة):</strong>';

    for (let i = 1; i <= numGroups; i++) {

        const div = document.createElement('div');

        div.className = 'room-input-group';

        const roomVal = roomSettings[`${level}_${i}`] || '';

        div.innerHTML = `
            <label>فوج ${i}:</label>
            <input type="text" id="room${i}" placeholder="القاعة" value="${roomVal}" oninput="updateRoomSetting('${level}', ${i}, this.value)">
        `;

        container.appendChild(div);

    }

    container.style.display = 'flex';

}

function updateRoomSetting(level, group, value) {

    roomSettings[`${level}_${group}`] = value;

    saveRoomSettings();

}

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

async function printExamLists(sortOrder) {
    if (blockTrialPrint()) return;

    const level = document.getElementById('levelSelect').value;
    const trimester = document.getElementById('trimesterSelect')?.value || '';

    if (!level) {

        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولا' });

        return;

    }

    const settings = await DB.getSettings() || {};
    institutionSettings = settings;
    const sigSettings = await DB.get('signatureSettings') || {};
    const today = new Date().toLocaleDateString('ar-DZ');
    let showAverageColumn = true;

    if (trimester !== '') {
        const printOptions = await Swal.fire({
            title: 'خيارات الطباعة',
            html: `
                <div style="text-align: right; font-size: 15px;">
                    <label style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; cursor: pointer;">
                        <span>إظهار عمود المعدل في التقرير</span>
                        <input id="showAverageColumn" type="checkbox" checked style="width: 18px; height: 18px;">
                    </label>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'متابعة الطباعة',
            cancelButtonText: 'إلغاء',
            focusConfirm: false,
            preConfirm: () => ({
                showAverageColumn: document.getElementById('showAverageColumn')?.checked !== false
            })
        });

        if (!printOptions.isConfirmed) {
            return;
        }

        showAverageColumn = printOptions.value?.showAverageColumn !== false;
    }

    let allContent = '';
    const groupFilterVal = document.getElementById('groupFilter')?.value;
    const cls = document.getElementById('classSelect')?.value || '';
    const stream = document.getElementById('streamSelect')?.value || '';
    
    let studentsToProcess = allStudents.filter(s => 
        s.level === level &&
        (!cls || s.class === cls) &&
        (!stream || s.stream === stream)
    );

    if (groupFilterVal) {
        studentsToProcess = studentsToProcess.filter(s => String(examGroupings[getStudentKey(s)]) === String(groupFilterVal));
    }

    const orderedGroups = getGroupOrderEntries(studentsToProcess, { includeConfigured: false });

    const useAverageOrder = isAverageOrderingActive();
    orderedGroups.forEach(({ groupNum, students }) => {
        // Apply sort based on the chosen sortOrder parameter
        if (sortOrder === 'last_name') {
            students.sort((a, b) => {
                const cmp = (a.last_name || '').localeCompare(b.last_name || '', 'ar');
                if (cmp !== 0) return cmp;
                return (a.first_name || '').localeCompare(b.first_name || '', 'ar');
            });
        } else if (sortOrder === 'first_name') {
            students.sort((a, b) => {
                const cmp = (a.first_name || '').localeCompare(b.first_name || '', 'ar');
                if (cmp !== 0) return cmp;
                return (a.last_name || '').localeCompare(b.last_name || '', 'ar');
            });
        } else if (sortOrder === 'average') {
            students.sort((a, b) => {
                const avgDiff = (parseFloat(b.tempAverage) || 0) - (parseFloat(a.tempAverage) || 0);
                if (avgDiff !== 0) return avgDiff;
                return (a.last_name || '').localeCompare(b.last_name || '', 'ar');
            });
        } else if (sortOrder === 'alternating_gender') {
            // Separate males and females, sort each alphabetically, then interleave
            const isMale = (s) => {
                const g = String(s.gender || '').trim().toLowerCase();
                return g === 'm' || g === 'male' || g === 'ذكر';
            };
            const nameCmp = (a, b) => {
                const cmp = (a.last_name || '').localeCompare(b.last_name || '', 'ar');
                if (cmp !== 0) return cmp;
                return (a.first_name || '').localeCompare(b.first_name || '', 'ar');
            };
            const males = students.filter(s => isMale(s)).sort(nameCmp);
            const females = students.filter(s => !isMale(s)).sort(nameCmp);
            const interleaved = [];
            let mi = 0, fi = 0;
            while (mi < males.length || fi < females.length) {
                if (mi < males.length) interleaved.push(males[mi++]);
                if (fi < females.length) interleaved.push(females[fi++]);
            }
            students.length = 0;
            interleaved.forEach(s => students.push(s));
        } else {
            // Default sort: by average if active, otherwise alphabetical
            students.sort((a, b) => {
                if (useAverageOrder) {
                    const avgDiff = (parseFloat(b.tempAverage) || 0) - (parseFloat(a.tempAverage) || 0);
                    if (avgDiff !== 0) return avgDiff;
                }
                return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
            });
        }
        if (students.length === 0) return;
        
        const displayClass = cls ? cls : "مختلط";
        allContent += generateExamListPage(level, displayClass, groupNum, students, settings, sigSettings, today, allContent ? 'page-break' : '', 0, {
            showAverageColumn
        });
    });

    if (!allContent) {

        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد أفواج للطباعة. يرجى تفويج التلاميذ أولا.' });

        return;

    }

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>طباعة قوائم الاختبار</title>

            <style>

                body { font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0.5cm; }

                .print-page { margin-bottom: 0; }

                .header-container { width: 100%; margin-bottom: 5px; }

                .center-text { text-align: center; }

                h1, h2, h3 { margin: 0; color: #000; padding: 0; line-height: 1.2; }

                h2 { font-size: 14pt; margin-bottom: 2px; }

                h3 { font-size: 11pt; margin-bottom: 2px; }

                .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; padding: 2px 0; }

                .header-box { width: 33%; }

                table { width: 100%; border-collapse: collapse; margin-top: 5px; }

                th, td { border: 0.5pt solid #000; padding: 4px 6px; text-align: center; font-size: 10pt; line-height: 1.3; }

                th { background-color: #f0f0f0; font-weight: bold; }

                .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 11pt; }

                @media print {

                    @page { margin: 0.8cm; size: A4; }

                    body { -webkit-print-color-adjust: exact; }

                    .page-break { page-break-before: always; }

                }

            </style>

            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>

        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            ${allContent}

            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
        </body>

        </html>

    `);

    printWindow.document.close();

}

async function printFullList() {
    if (blockTrialPrint()) return;

    const level = document.getElementById('levelSelect').value;

    const cls = document.getElementById('classSelect').value;

    if (!level) {

        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولا' });

        return;

    }

    if (filteredStudents.length === 0) {

        Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا توجد بيانات للطباعة' });

        return;

    }

    const settings = institutionSettings;

    const sigSettings = await DB.get('signatureSettings') || {};

    const today = new Date().toLocaleDateString('ar-DZ');

    const useAverageOrder = isAverageOrderingActive();

    // Build print content

    let allContent = '';

    // If no specific class is selected, process each class separately

    if (!cls) {

        // Get all classes for this level

        const classes = [...new Set(allStudents.filter(s => s.level === level).map(s => s.class))];

        classes.sort((a, b) => {

            const na = parseInt(a);

            const nb = parseInt(b);

            if (!isNaN(na) && !isNaN(nb)) return na - nb;

            return String(a).localeCompare(String(b));

        });

        // For each class

        classes.forEach(currentClass => {

            // Get students in this class

            const classStudents = allStudents.filter(s => s.level === level && s.class === currentClass);

            const classGroupOrder = new Map(
                getGroupOrderEntries(classStudents, { includeConfigured: false, useAverageOrder })
                    .map((entry, index) => [entry.groupNum, index])
            );

            // Sort students by group order in average mode, otherwise by room then name
            classStudents.sort((a, b) => {
                const keyA = getStudentKey(a);
                const keyB = getStudentKey(b);
                const groupA = parseInt(examGroupings[keyA], 10) || 0;
                const groupB = parseInt(examGroupings[keyB], 10) || 0;

                if (useAverageOrder) {
                    const rankA = classGroupOrder.has(groupA) ? classGroupOrder.get(groupA) : Number.MAX_SAFE_INTEGER;
                    const rankB = classGroupOrder.has(groupB) ? classGroupOrder.get(groupB) : Number.MAX_SAFE_INTEGER;
                    if (rankA !== rankB) return rankA - rankB;

                    const avgDiff = (parseFloat(b.tempAverage) || 0) - (parseFloat(a.tempAverage) || 0);
                    if (avgDiff !== 0) return avgDiff;
                }

                const roomA = examGroupings[keyA] ? (roomSettings[`${level}_${examGroupings[keyA]}`] || '') : '';
                const roomB = examGroupings[keyB] ? (roomSettings[`${level}_${examGroupings[keyB]}`] || '') : '';

                const roomCompare = roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
                if (roomCompare !== 0) return roomCompare;

                return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
            });

            if (classStudents.length > 0) {

                allContent += generateFullListPage(level, currentClass, classStudents, settings, sigSettings, today, allContent ? 'page-break' : '');

            }

        });

    } else {

        // Specific class selected - original behavior

        const groupOrder = new Map(
            getGroupOrderEntries(filteredStudents, { includeConfigured: false, useAverageOrder })
                .map((entry, index) => [entry.groupNum, index])
        );

        const sortedStudents = [...filteredStudents].sort((a, b) => {
            const keyA = getStudentKey(a);
            const keyB = getStudentKey(b);
            const groupA = parseInt(examGroupings[keyA], 10) || 0;
            const groupB = parseInt(examGroupings[keyB], 10) || 0;

            if (useAverageOrder) {
                const rankA = groupOrder.has(groupA) ? groupOrder.get(groupA) : Number.MAX_SAFE_INTEGER;
                const rankB = groupOrder.has(groupB) ? groupOrder.get(groupB) : Number.MAX_SAFE_INTEGER;
                if (rankA !== rankB) return rankA - rankB;

                const avgDiff = (parseFloat(b.tempAverage) || 0) - (parseFloat(a.tempAverage) || 0);
                if (avgDiff !== 0) return avgDiff;
            }

            const roomA = examGroupings[keyA] ? (roomSettings[`${level}_${examGroupings[keyA]}`] || '') : '';
            const roomB = examGroupings[keyB] ? (roomSettings[`${level}_${examGroupings[keyB]}`] || '') : '';

            const roomCompare = roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
            if (roomCompare !== 0) return roomCompare;

            return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
        });

        allContent = generateFullListPage(level, cls, sortedStudents, settings, sigSettings, today, '', false);

    }

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>طباعة القائمة الكاملة</title>

            <style>

                body { font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0.5cm; }

                .header-container { width: 100%; margin-bottom: 5px; }

                .center-text { text-align: center; }

                h1, h2, h3 { margin: 0; color: #000; padding: 0; line-height: 1.2; }

                h2 { font-size: 14pt; margin-bottom: 2px; }

                h3 { font-size: 11pt; margin-bottom: 2px; }

                .header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; padding: 2px 0; }

                .header-box { width: 33%; }

                table { width: 100%; border-collapse: collapse; margin-top: 5px; }

                th, td { border: 0.5pt solid #000; padding: 2px 4px; text-align: center; font-size: 9pt; line-height: 1.2; }

                th { background-color: #f0f0f0; font-weight: bold; }

                .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 11pt; }

                .page-break { page-break-before: always; }

                @media print {

                    @page { margin: 0.5cm; size: A4; }

                    body { -webkit-print-color-adjust: exact; }

                    .page-break { page-break-before: always; }

                }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            ${allContent}

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

 * Print Signature List - قائمة الإمضاء

 * Landscape format with subjects from supervision schedule

 */

/**

 * Print Signature List - قائمة الإمضاء

 * Landscape format with subjects from supervision schedule

 */

async function printSignatureList() {
    if (blockTrialPrint()) return;

    const level = document.getElementById('levelSelect').value;

    const cls = document.getElementById('classSelect').value;

    const selectedStream = document.getElementById('streamSelect').value;

    numGroups = parseInt(document.getElementById('numGroups').value) || 2;

    if (!level) {

        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولا' });

        return;

    }

    if (filteredStudents.length === 0) {

        Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا يوجد تلاميذ لإنشاء القائمة' });

        return;

    }

    const trimesterOptions = {
        '1': 'الفصل الأول',
        '2': 'الفصل الثاني',
        '3': 'الفصل الثالث',
        'blanc': 'الامتحان التجريبي (متوسط)',
        'blanc_lycee': 'الامتحان التجريبي (ثانوي)'
    };

    const savedTrimester = await DB.get('supervisionTrimester') || '1';
    const trimesterPrompt = await Swal.fire({
        title: 'اختيار الرزنامة',
        text: 'يجب تحديد الرزنامة قبل طباعة أوراق الإمضاء.',
        input: 'select',
        inputOptions: trimesterOptions,
        inputValue: savedTrimester,
        inputPlaceholder: 'اختر الرزنامة',
        showCancelButton: true,
        confirmButtonText: 'متابعة',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#2563eb',
        inputValidator: (value) => {
            if (!value) return 'يرجى اختيار الرزنامة أولاً.';
            return null;
        }
    });

    if (!trimesterPrompt.isConfirmed || !trimesterPrompt.value) {
        return;
    }

    const selectedTrimester = trimesterPrompt.value;
    await DB.set('supervisionTrimester', selectedTrimester);

    // Get supervision data for the selected timetable only
    const days = await DB.get(`supervisionDays_T${selectedTrimester}`) || [];

    const baseSubjects = extractSignatureSubjectsFromDays(days);

    if (baseSubjects.length === 0) {

        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: `لا توجد مواد مسجلة في رزنامة "${trimesterOptions[selectedTrimester] || selectedTrimester}". يرجى إعداد جدول الحراسة لهذه الرزنامة أولاً.`
        });

        return;

    }

    // Shorten subject names for display

    const shortenSubject = (subj) => {

        if (!subj) return '';

        return subj

            .replace('العلوم الفيزيائية والتكنولوجيا', 'ع فيزيائية')

            .replace('العلوم الطبيعية والحياة', 'علوم طبيعية')

            .replace('اللغة العربية', 'عربية')

            .replace('اللغة الفرنسية', 'فرنسية')

            .replace('اللغة الإنجليزية', 'إنجليزية')

            .replace('الرياضيات', 'رياضيات')

            .replace('التاريخ والجغرافيا', 'تاريخ وجغرافيا')

            .replace('التربية الإسلامية', 'إسلامية')

            .replace('التربية المدنية', 'مدنية')

            .replace('التربية البدنية والرياضية', 'رياضة')

            .replace('التربية التشكيلية', 'تشكيلية')

            .replace('التربية الموسيقية', 'موسيقى')

            .replace('الإعلام الآلي', 'إعلام آلي')

            .replace('اللغة الأمازيغية', 'أمازيغية')

            .replace('فلسفة', 'فلسفة')

            .replace('تسيير محاسبي', 'تسيير')

            .replace('تسيير محاسبي و مالي', 'تسيير')

            .replace('قانون', 'قانون')

            .replace('اقتصاد ومناجمنت', 'اقتصاد')

            .replace('التكنولوجيا', 'تكنولوجيا')

            .replace('هندسة ميكانيكية', 'ه.ميكانيكية')

            .replace('هندسة كهربائية', 'ه.كهربائية')

            .replace('هندسة مدنية', 'ه.مدنية')

            .replace('هندسة الطرائق', 'ه.طرائق')

            .replace('اللغة الأجنبية الثالثة', 'لغة 3')

            .replace('لغة أجنبية ثالثة', 'لغة 3')

            .replace('ألمانية', 'ألمانية')

            .replace('اسبانية', 'إسبانية')

            .replace('ايطالية', 'إيطالية');

    };

    const settings = institutionSettings;
    const sigSettings = await DB.get('signatureSettings') || {};
    const today = new Date().toLocaleDateString('ar-DZ');
    const isSecondaryStage = settings.educationStage === 'secondary';
    const printScopeStudents = allStudents.filter(student =>
        student.level === level &&
        (!selectedStream || student.stream === selectedStream) &&
        (!cls || student.class === cls)
    );
    const signatureStreamKeys = isSecondaryStage ? getSignatureStreamKeys(printScopeStudents) : [];
    let signatureSubjectConfig = { [DEFAULT_SIGNATURE_STREAM_KEY]: baseSubjects.slice() };

    if (isSecondaryStage) {
        const preferredStreamKey = selectedStream || signatureStreamKeys[0] || DEFAULT_SIGNATURE_STREAM_KEY;
        const editedConfig = await openSecondarySignatureSubjectsEditor(baseSubjects, signatureStreamKeys, preferredStreamKey);
        if (!editedConfig) {
            return;
        }
        signatureSubjectConfig = editedConfig;
    }

    // Group students by their exam group

    const groupedStudents = {};

    for (let i = 1; i <= numGroups; i++) {

        groupedStudents[i] = [];

    }

    filteredStudents.forEach(s => {

        const key = getStudentKey(s);

        const group = examGroupings[key];

        if (group && groupedStudents[group]) {

            groupedStudents[group].push(s);

        }

    });

    // Sort students in each group

    const useAvgOrder = isAverageOrderingActive();
    Object.values(groupedStudents).forEach(students => {

        students.sort((a, b) => {
            if (useAvgOrder) {
                const avgDiff = (parseFloat(b.tempAverage) || 0) - (parseFloat(a.tempAverage) || 0);
                if (avgDiff !== 0) return avgDiff;
            }
            return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
        });

    });

    // Build print content

    let allContent = '';

    // If no specific class is selected, group ALL students in the level by their exam group

    if (!cls) {

        // Get all students for this level

        const levelStudents = allStudents.filter(s =>
            s.level === level && (!selectedStream || s.stream === selectedStream)
        );

        const orderedGroups = getGroupOrderEntries(levelStudents, { includeConfigured: false });

        orderedGroups.forEach(({ groupNum, students }) => {
            students.sort((a, b) => {
                if (useAvgOrder) {
                    const avgDiff = (parseFloat(b.tempAverage) || 0) - (parseFloat(a.tempAverage) || 0);
                    if (avgDiff !== 0) return avgDiff;
                }
                return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
            });

            if (students.length === 0) return;

            const pageBreakClass = allContent ? 'page-break' : '';

            const total = students.length;

            const males = students.filter(s => s.gender === 'M').length;

            const females = total - males;

            const pageStreamInfo = getSignaturePageStreamInfo(students, selectedStream, isSecondaryStage);
            const pageSubjects = isSecondaryStage
                ? getConfiguredSignatureSubjects(signatureSubjectConfig, pageStreamInfo.key, baseSubjects)
                : baseSubjects;
            const pageColumns = buildSignatureSubjectColumns(pageSubjects, shortenSubject);
            const emptyCells = pageColumns.emptyCellsHtml;

            const rowsHtml = students.map((s, idx) => `<tr class="animate-fade-in-up stagger-item stagger-${(typeof index !== "undefined" ? index % 10 : 0) + 1}">

                    <td style="font-size: 9pt;">${idx + 1}</td>

                    <td style="text-align: right; padding-right: 5px; font-size: 9pt;">${s.last_name || ''} ${s.first_name || ''}</td>

                    <td style="font-size: 8pt;">${formatDate(s.birth_date) || ''}</td>

                    <td style="font-size: 8pt;">${s.class || ''}</td>

                    ${emptyCells}

                </tr>

            `).join('');

            // Pass "مختلط" for class name

            allContent += generateSignaturePage(level, "مختلط", groupNum, students, total, males, females, rowsHtml, pageColumns.headersHtml, settings, sigSettings, today, pageBreakClass, pageStreamInfo.label);
        });

    } else {

        // Specific class selected - original behavior
        const orderedGroups = getGroupOrderEntries(filteredStudents, { includeConfigured: false });

        orderedGroups.forEach(({ groupNum, students }) => {
            students.sort((a, b) => {
                if (useAvgOrder) {
                    const avgDiff = (parseFloat(b.tempAverage) || 0) - (parseFloat(a.tempAverage) || 0);
                    if (avgDiff !== 0) return avgDiff;
                }
                return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
            });

            if (students.length === 0) return;

            const pageBreakClass = allContent ? 'page-break' : '';

            const total = students.length;

            const males = students.filter(s => s.gender === 'M').length;

            const females = total - males;

            const pageStreamInfo = getSignaturePageStreamInfo(students, selectedStream, isSecondaryStage);
            const pageSubjects = isSecondaryStage
                ? getConfiguredSignatureSubjects(signatureSubjectConfig, pageStreamInfo.key, baseSubjects)
                : baseSubjects;
            const pageColumns = buildSignatureSubjectColumns(pageSubjects, shortenSubject);
            const emptyCells = pageColumns.emptyCellsHtml;

            const rowsHtml = students.map((s, idx) => `<tr class="animate-fade-in-up stagger-item stagger-${(typeof index !== "undefined" ? index % 10 : 0) + 1}">

                    <td style="font-size: 9pt;">${idx + 1}</td>

                    <td style="text-align: right; padding-right: 5px; font-size: 9pt;">${s.last_name || ''} ${s.first_name || ''}</td>

                    <td style="font-size: 8pt;">${formatDate(s.birth_date) || ''}</td>

                    ${emptyCells}

                </tr>

            `).join('');

            allContent += generateSignaturePage(level, cls, groupNum, students, total, males, females, rowsHtml, pageColumns.headersHtml, settings, sigSettings, today, pageBreakClass, pageStreamInfo.label);
        });

    }

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="ar" dir="rtl">

        <head>

            <meta charset="UTF-8">

            <title>قائمة الإمضاء</title>

            <style>

                * { box-sizing: border-box; }

                body {

                    font-family: 'Cairo', 'Tajawal', sans-serif;

                    margin: 0;

                    padding: 0.3cm;

                    font-size: 10pt;

                }

                .header-table {

                    width: 100%;

                    border-collapse: collapse;

                    margin-bottom: 2px;

                }

                .header-table td {

                    padding: 0;

                    vertical-align: top;

                }

                .center-text { text-align: center; }

                h2 { margin: 0; color: #000; padding: 0; }

                table { width: 100%; border-collapse: collapse; }

                th, td {

                    border: 0.5pt solid #000;

                    padding: 2px 4px;

                    text-align: center;

                    font-size: 9pt;

                    line-height: 1.2;

                }

                th {

                    background-color: #e0e0e0;

                    font-weight: bold;

                }

                tbody tr { height: 22px; }

                .footer {

                    margin-top: 10px;

                    display: flex;

                    justify-content: space-between;

                    align-items: flex-start;

                }

                .page-break { page-break-before: always; }

                @media print {

                    @page {

                        margin: 0.3cm;

                        size: A4 landscape;

                    }

                    body { -webkit-print-color-adjust: exact; }

                    .page-break { page-break-before: always; }

                }

            </style>

        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>

        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}

            ${allContent}

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

// Helper function to format date

function formatDate(dateStr) {

    if (!dateStr) return '';

    try {

        const date = new Date(dateStr);

        if (isNaN(date.getTime())) return dateStr;

        return date.toLocaleDateString('ar-DZ', { year: 'numeric', month: '2-digit', day: '2-digit' });

    } catch (e) {

        return dateStr;

    }

}

// Helper function to generate a signature page

function generateSignaturePage(level, currentClass, groupNumber, students, total, males, females, rowsHtml, subjectHeaders, settings, sigSettings, today, pageBreakClass, streamLabel = '') {

    const roomNumber = document.getElementById(`room${groupNumber}`)?.value || '';

    const roomText = roomNumber ? ` - القاعة: ${roomNumber}` : '';

    const titleText = `قائمة الإمضاء للقسم: ${level} - ${currentClass}`;

    // Get signer info from signature settings

    // const sigSettings passed as argument

    const reportConfig = sigSettings.reportSettings?.['exam_lists'] || { signer: 'director', showSignature: true };

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }

    const signerName = signerData.fullName || settings.managerName || '';
    const schoolYear = settings.schoolYear || settings.currentAcademicYear || settings.currentYear || '.......';
    const resolvedStreamLabel = streamLabel || (
        students[0] && students[0].stream && settings.educationStage === 'secondary'
            ? getStreamLabel(students[0].stream)
            : ''
    );

    // Adjust columns if mixed class

    const isMixed = currentClass === 'مختلط';

    const nameWidth = isMixed ? '20%' : '28%'; // Reduce name width to make room for class

    return `

        <div class="print-page ${pageBreakClass}">

            <div class="header-container">

                <table class="header-table">

                    <tr>

                        <td style="text-align: right; width: 33%;">

                            <div style="font-size: 9pt; font-weight: bold;">المؤسسة: ${settings.institutionName || '.......'}</div>

                        </td>

                        <td style="text-align: center; width: 34%;">

                            <div style="font-size: 8pt;">الجمهورية الجزائرية الديمقراطية الشعبية</div>

                            <div style="font-size: 8pt;">وزارة التربية الوطنية</div>

                        </td>

                        <td style="text-align: left; width: 33%;">

                            <div style="font-size: 9pt; font-weight: bold;">مديرية التربية لولاية ${settings.wilaya || '.......'}</div>

                        </td>

                    </tr>

                </table>

                <div class="center-text" style="margin: 3px 0;">

                    <h2 style="text-decoration: underline; margin: 0; font-size: 12pt;">${titleText} - الفوج ${groupNumber}${roomText}</h2>

                </div>

                <div style="display: flex; justify-content: space-between; background: #f0f0f0; padding: 2px 10px; border: 1px solid #000; margin-bottom: 3px; font-size: 9pt;">

                    <span><strong>المستوى:</strong> ${level}</span>

                    ${settings.educationStage === 'secondary' && resolvedStreamLabel ? `<span><strong>الشعبة:</strong> ${resolvedStreamLabel}</span>` : ''}

                    <span><strong>القسم:</strong> ${currentClass}</span>

                    <span><strong>الفوج:</strong> ${groupNumber}</span>

                    <span><strong>العدد:</strong> ${total} (ذ: ${males} | أ: ${females})</span>

                    <span><strong>السنة:</strong> ${schoolYear}</span>

                </div>

            </div>

            <table>

                <thead>

                    <tr>

                        <th style="width: 4%; font-size: 8pt;">#</th>

                        <th style="width: ${nameWidth}; font-size: 9pt;">اللقب والاسم</th>

                        <th style="width: 10%; font-size: 8pt;">ت.الميلاد</th>

                        ${isMixed ? '<th style="width: 8%; font-size: 8pt;">القسم</th>' : ''}

                        ${subjectHeaders}

                    </tr>

                </thead>

                <tbody>

                    ${rowsHtml}

                </tbody>

            </table>

            <div class="footer">

                <div style="text-align: right; font-size: 9pt;">

                    حرر بـ: ${settings.municipality || '.......'} في: ${today}

                </div>

                <div style="text-align: center; min-width: 150px; font-size: 9pt;">

                    ${signerTitle}

                    <br><br>

                    <strong>${signerName}</strong>

                </div>

            </div>

        </div>

    `;

}

// Helper function to generate an exam list page

function generateExamListPage(level, currentClass, groupNumber, students, settings, sigSettings, today, pageBreakClass, startIndex = 0, options = {}) {
    const roomNumber = document.getElementById(`room${groupNumber}`)?.value || '';
    const roomText = roomNumber ? ` - القاعة: ${roomNumber}` : '';

    // Get signer info from signature settings
    const reportConfig = sigSettings.reportSettings?.['exam_lists'] || { signer: 'director', showSignature: true };
    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };
    let signerTitle;
    if (reportConfig.signer === 'director') {
        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';
    } else {
        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';
    }
    const signerName = signerData.fullName || settings.managerName || '';

    const total = students.length;
    const males = students.filter(s => s.gender === 'M').length;
    const females = total - males;

    const trimester = document.getElementById('trimesterSelect')?.value || '';
    const showAverageColumn = options.showAverageColumn !== false;

    let tableHead;
    let rowsHtml;

    if (trimester !== '') {
        tableHead = `
            <tr>
                <th width="5%">#</th>
                <th width="40%">الاسم واللقب</th>
                <th width="8%">الجنس</th>
                <th width="10%">القسم</th>
                ${showAverageColumn ? '<th width="12%">المعدل</th>' : ''}
                <th width="${showAverageColumn ? '25%' : '37%'}">ملاحظات</th>
            </tr>
        `;
        rowsHtml = students.map((s, idx) => `<tr class="animate-fade-in-up stagger-item">
                <td>${startIndex + idx + 1}</td>
                <td>${((s.last_name || '') + ' ' + (s.first_name || '')).trim()}</td>
                <td>${s.gender === 'M' ? 'ذ' : 'أ'}</td>
                <td>${s.class || ''}</td>
                ${showAverageColumn ? `<td>${s.tempAverage ? s.tempAverage.toFixed(2) : '0.00'}</td>` : ''}
                <td></td>
            </tr>
        `).join('');
    } else {
        tableHead = `
            <tr>
                <th width="5%">#</th>
                <th width="25%">اللقب</th>
                <th width="25%">الاسم</th>
                <th width="8%">الجنس</th>
                <th width="12%">القسم</th>
                <th width="25%">ملاحظات</th>
            </tr>
        `;
        rowsHtml = students.map((s, idx) => `<tr class="animate-fade-in-up stagger-item">
                <td>${startIndex + idx + 1}</td>
                <td>${s.last_name || ''}</td>
                <td>${s.first_name || ''}</td>
                <td>${s.gender === 'M' ? 'ذ' : 'أ'}</td>
                <td>${s.class || ''}</td>
                <td></td>
            </tr>
        `).join('');
    }

    return `
        <div class="print-page ${pageBreakClass}">
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
                    <h2 style="text-decoration: underline; margin: 0; line-height:1;">قائمة الاختبار - القسم ${currentClass} - الفوج ${groupNumber}${roomText}</h2>
                </div>

                <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 2px 0; background-color: #f9f9f9; align-items: center;">
                     <div class="header-box" style="text-align: right; width: 45%;">
                        <h3 style="margin:0; line-height:1;">المستوى: ${level} ${students[0] && students[0].stream && settings.educationStage === 'secondary' ? '- ' + getStreamLabel(students[0].stream) : ''} - القسم: ${currentClass}</h3>
                    </div>
                    <div class="header-box center-text" style="width: 20%;">
                        <h3 style="margin:0; font-size: 10pt; line-height:1;">العدد: ${total} | ذ: ${males} | أ: ${females}</h3>
                    </div>
                    <div class="header-box" style="text-align: left; width: 35%;">
                         <h3 style="margin:0; line-height:1;">السنة الدراسية: ${settings.schoolYear || '2025/2026'}</h3>
                    </div>
                </div>
            </div>

            <table>
                <thead>
                    ${tableHead}
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="footer">
                <div style="text-align: right;">
                    حرر بـ: ${settings.municipality || '.......'} في: ${today}
                </div>
                <div style="text-align: center; min-width: 200px;">
                    ${signerTitle}
                    <br><br>
                    <strong>${signerName}</strong>
                </div>
            </div>
        </div>
    `;
}
// Helper function to generate a full list page

function generateFullListPage(level, currentClass, students, settings, sigSettings, today, pageBreakClass, isMixed = true) {

    // Get signer info from signature settings

    // const sigSettings passed as argument

    const reportConfig = sigSettings.reportSettings?.['exam_lists'] || { signer: 'director', showSignature: true };
    const trimester = document.getElementById('trimesterSelect')?.value || '';

    const signerData = sigSettings.signers?.[reportConfig.signer] || { fullName: settings.managerName || '', gender: 'male' };

    let signerTitle;

    if (reportConfig.signer === 'director') {

        signerTitle = signerData.gender === 'female' ? 'المديرة' : 'المدير';

    } else {

        signerTitle = signerData.gender === 'female' ? 'الناظرة' : 'الناظر';

    }

    const signerName = signerData.fullName || settings.managerName || '';

    const total = students.length;

    const males = students.filter(s => s.gender === 'M').length;

    const females = total - males;

    let tableHead;
    let rowsHtml;

    if (trimester !== '') {
        tableHead = `
            <tr>
                <th width="5%">#</th>
                <th width="35%">الاسم واللقب</th>
                <th width="8%">الجنس</th>
                <th width="10%">القسم</th>
                <th width="10%">المعدل</th>
                ${isMixed ? '<th width="10%">القاعة</th>' : ''}
                <th width="${isMixed ? '22%' : '32%'}">ملاحظات</th>
            </tr>
        `;
        rowsHtml = students.map((s, idx) => {
            const studentKey = getStudentKey(s);
            const groupNum = examGroupings[studentKey];
            const roomNum = groupNum ? (roomSettings[`${level}_${groupNum}`] || '') : '';
            const roomCell = isMixed ? `<td>${roomNum}</td>` : '';

            return `<tr class="animate-fade-in-up stagger-item">
                <td>${idx + 1}</td>
                <td>${((s.last_name || '') + ' ' + (s.first_name || '')).trim()}</td>
                <td>${s.gender === 'M' ? 'ذ' : 'أ'}</td>
                <td>${s.class || ''}</td>
                <td>${s.tempAverage ? s.tempAverage.toFixed(2) : '0.00'}</td>
                ${roomCell}
                <td></td>
            </tr>`;
        }).join('');
    } else {
        tableHead = `
            <tr>
                <th width="5%">#</th>
                <th width="25%">اللقب</th>
                <th width="25%">الاسم</th>
                <th width="8%">الجنس</th>
                <th width="12%">القسم</th>
                ${isMixed ? '<th width="10%">القاعة</th>' : ''}
                <th width="${isMixed ? '15%' : '25%'}">ملاحظات</th>
            </tr>
        `;
        rowsHtml = students.map((s, idx) => {
            const studentKey = getStudentKey(s);
            const groupNum = examGroupings[studentKey];
            const roomNum = groupNum ? (roomSettings[`${level}_${groupNum}`] || '') : '';
            const roomCell = isMixed ? `<td>${roomNum}</td>` : '';

            return `<tr class="animate-fade-in-up stagger-item">
                <td>${idx + 1}</td>
                <td>${s.last_name || ''}</td>
                <td>${s.first_name || ''}</td>
                <td>${s.gender === 'M' ? 'ذ' : 'أ'}</td>
                <td>${s.class || ''}</td>
                ${roomCell}
                <td></td>
            </tr>`;
        }).join('');
    }

    return `

        <div class="print-page ${pageBreakClass}">

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
                    <h2 style="text-decoration: underline; margin: 0; line-height:1;">قائمة تلاميذ القسم ${currentClass}</h2>
                </div>

                <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 2px 0; background-color: #f9f9f9; align-items: center;">
                    <div class="header-box" style="text-align: right; width: 45%;">
                        <h3 style="margin:0; line-height:1;">المستوى: ${level} ${students[0] && students[0].stream && settings.educationStage === 'secondary' ? '- ' + getStreamLabel(students[0].stream) : ''}</h3>
                    </div>
                    <div class="header-box center-text" style="width: 20%;">
                        <h3 style="margin:0; font-size: 10pt; line-height:1;">العدد: ${total} | ذ: ${males} | أ: ${females}</h3>
                    </div>
                    <div class="header-box" style="text-align: left; width: 35%;">
                         <h3 style="margin:0; line-height:1;">السنة الدراسية: ${settings.schoolYear || '2025/2026'}</h3>
                    </div>
                </div>

                <table>
                <thead>
                    ${tableHead}
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="footer">

                <div style="text-align: right;">

                    حرر بـ: ${settings.municipality || '.......'} في: ${today}

                </div>

                <div style="text-align: center; min-width: 200px;">

                    ${signerTitle}

                    <br><br>

                    <strong>${signerName}</strong>

                </div>

            </div>

        </div>

    `;

}

async function genderGroupByLevelStrict() {
    const level = document.getElementById('levelSelect').value;
    const cls = document.getElementById('classSelect').value;
    const stream = document.getElementById('streamSelect').value;
    numGroups = parseInt(document.getElementById('numGroups').value) || 2;

    if (!level) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولا' });
        return;
    }

    // Determine scope based on selection
    let studentsToGroup;
    let scopeText;

    const cleanCls = cls ? cls.trim() : "";
    const cleanStream = stream ? stream.trim() : "";

    if (cleanCls !== "") {
        if (cleanStream !== "") {
            studentsToGroup = allStudents.filter(s => s.level == level && s.stream === stream && s.class == cleanCls);
            scopeText = `شعبة "${getStreamLabel(stream)}" - قسم "${cleanCls}"`;
        } else {
            studentsToGroup = allStudents.filter(s => s.level == level && s.class == cleanCls);
            scopeText = `قسم "${cleanCls}"`;
        }
    } else if (cleanStream !== "") {
        studentsToGroup = allStudents.filter(s => s.level === level && s.stream === stream);
        scopeText = `شعبة "${getStreamLabel(stream)}"`;
    } else {
        studentsToGroup = allStudents.filter(s => s.level === level);
        scopeText = `كل تلاميذ المستوى "${level}"`;
    }

    if (studentsToGroup.length === 0) {
        Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا يوجد تلاميذ للتفويج في هذا النطاق' });
        return;
    }

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: `هل أنت متأكد من التفويج حسب الجنس (إناث وحدهم / ذكور وحدهم) ل: ${scopeText}\nسيتم توزيعهم على ${numGroups} أفواج.\nملاحظة: سيتم تخصيص أفواج كاملة للذكور وأخرى للإناث.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'نعم، تابع',
        cancelButtonText: 'إلغاء'
    });

    if (!result.isConfirmed) {
        return;
    }

    const isMale = (student) => {
        const normalizedGender = String(student.gender || '').trim().toLowerCase();
        return normalizedGender === 'm' || normalizedGender === 'male' || normalizedGender === 'ذكر';
    };

    // Sort by name after normalizing gender values.
    const males = studentsToGroup
        .filter(isMale)
        .sort((a, b) => ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar'));
    const females = studentsToGroup
        .filter(student => !isMale(student))
        .sort((a, b) => ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar'));

    // Initialize groups
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
        groups[i] = [];
    }

    // Determine how many groups for males
    const total = studentsToGroup.length;
    let numMaleGroups = Math.round((males.length / total) * numGroups);

    // Apply constraints
    if (males.length > 0 && numMaleGroups === 0) numMaleGroups = 1;
    if (females.length > 0 && numMaleGroups === numGroups) numMaleGroups = numGroups - 1;
    if (numGroups === 1) numMaleGroups = 1;

    // Distribute Males into first 'numMaleGroups'
    let groupIndex = 0;
    males.forEach(s => {
        groups[groupIndex].push(s);
        groupIndex = (groupIndex + 1) % numMaleGroups;
    });

    // Distribute Females into remaining groups
    if (numGroups > 1) {
        groupIndex = numMaleGroups;
        const numFemaleGroups = numGroups - numMaleGroups;
        females.forEach(s => {
            groups[groupIndex].push(s);
            const relativeIndex = (groupIndex - numMaleGroups + 1) % numFemaleGroups;
            groupIndex = numMaleGroups + relativeIndex;
        });
    } else {
        females.forEach(s => groups[0].push(s));
    }

    // Save results
    groups.forEach((groupStudents, idx) => {
        const groupNum = idx + 1;
        groupStudents.forEach(s => {
            const key = getStudentKey(s);
            examGroupings[key] = groupNum;
        });
    });

    await saveExamGroupings();
    renderTable();
    Swal.fire({
        icon: 'success',
        title: 'تم التفويج',
        text: `تم التفويج حسب الجنس بنجاح!\nتم تخصيص ${numMaleGroups} فوج للذكور و ${numGroups - numMaleGroups} للأناث.`,
        timer: 2000,
        showConfirmButton: false
    });
}

function genderGroupByLevelStrictLegacy() {
    const level = document.getElementById('levelSelect').value;
    const cls = document.getElementById('classSelect').value;
    const stream = document.getElementById('streamSelect').value;
    numGroups = parseInt(document.getElementById('numGroups').value) || 2;

    if (!level) {
        alert("يرجى اختيار المستوى أولا");
        return;
    }

    // Determine scope based on selection
    let studentsToGroup;
    let scopeText;

    const cleanCls = cls ? cls.trim() : "";
    const cleanStream = stream ? stream.trim() : "";

    if (cleanCls !== "") {
        if (cleanStream !== "") {
            studentsToGroup = allStudents.filter(s => s.level == level && s.stream === stream && s.class == cleanCls);
            scopeText = `شعبة "${getStreamLabel(stream)}" - قسم "${cleanCls}"`;
        } else {
            studentsToGroup = allStudents.filter(s => s.level == level && s.class == cleanCls);
            scopeText = `قسم "${cleanCls}"`;
        }
    } else if (cleanStream !== "") {
        studentsToGroup = allStudents.filter(s => s.level === level && s.stream === stream);
        scopeText = `شعبة "${getStreamLabel(stream)}"`;
    } else {
        studentsToGroup = allStudents.filter(s => s.level === level);
        scopeText = `كل تلاميذ المستوى "${level}"`;
    }

    if (studentsToGroup.length === 0) {
        alert("لا يوجد تلاميذ للتفويج في هذا النطاق");
        return;
    }

    if (!confirm(`هل أنت متأكد من التفويج حسب الجنس (إناث وحدهم / ذكور وحدهم) ل: ${scopeText}\nسيتم توزيعهم على ${numGroups} أفواج.\nملاحظة: سيتم تخصيص أفواج كاملة للذكور وأخرى للإناث.`)) {
        return;
    }

    // Sort by Name and Filter Robustly
    const isMale = (s) => s.gender === 'M' || s.gender === 'Male' || s.gender === 'ذكر' || s.gender === 'm';
    const males = studentsToGroup.filter(s => isMale(s)).sort((a, b) => ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar'));
    const females = studentsToGroup.filter(s => !isMale(s)).sort((a, b) => ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar'));

    // Initialize groups
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
        groups[i] = [];
    }

    // Determine how many groups for males
    const total = studentsToGroup.length;
    let numMaleGroups = Math.round((males.length / total) * numGroups);

    // Apply constraints
    if (males.length > 0 && numMaleGroups === 0) numMaleGroups = 1;
    if (females.length > 0 && numMaleGroups === numGroups) numMaleGroups = numGroups - 1;
    if (numGroups === 1) numMaleGroups = 1;

    // Distribute Males into first 'numMaleGroups'
    let groupIndex = 0;
    males.forEach(s => {
        groups[groupIndex].push(s);
        groupIndex = (groupIndex + 1) % numMaleGroups;
    });

    // Distribute Females into remaining groups
    if (numGroups > 1) {
        groupIndex = numMaleGroups;
        const numFemaleGroups = numGroups - numMaleGroups;
        females.forEach(s => {
            groups[groupIndex].push(s);
            const relativeIndex = (groupIndex - numMaleGroups + 1) % numFemaleGroups;
            groupIndex = numMaleGroups + relativeIndex;
        });
    } else {
        females.forEach(s => groups[0].push(s));
    }

    // Save results
    groups.forEach((groupStudents, idx) => {
        const groupNum = idx + 1;
        groupStudents.forEach(s => {
            const key = getStudentKey(s);
            examGroupings[key] = groupNum;
        });
    });

    saveExamGroupings();
    renderTable();
    alert(`تم التفويج حسب الجنس بنجاح!\nتم تخصيص ${numMaleGroups} فوج للذكور و ${numGroups - numMaleGroups} للأناث.`);
}

/**
 * Print student absence list (قائمة غياب التلاميذ)
 */
async function printAbsenceList() {
    if (blockTrialPrint()) return;
    var todayDefault = new Date().toLocaleDateString('ar-DZ');

    // Ask user for date and subject
    var todayISO = new Date().toISOString().split('T')[0];
    var result = await Swal.fire({
        title: '<span style="font-size:1.3rem;">📋 معلومات قائمة الغياب</span>',
        html:
            '<div style="text-align:right; direction:rtl; padding: 10px 0;">' +
            '<div style="background:var(--bg-color); border:1px solid #e9ecef; border-radius:10px; padding:15px; margin-bottom:12px;">' +
            '<label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-weight:600; color:var(--primary-color); font-size:0.95rem;">📅 التاريخ</label>' +
            '<input id="swal-date" type="date" class="swal2-input" style="width:100%; margin:0; border-radius:8px; border:1px solid #ddd; padding:10px; font-size:1rem; font-family:inherit;" value="' + todayISO + '">' +
            '</div>' +
            '<div style="background:var(--bg-color); border:1px solid #e9ecef; border-radius:10px; padding:15px;">' +
            '<label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-weight:600; color:var(--primary-color); font-size:0.95rem;">📝 المادة</label>' +
            '<input id="swal-subject" type="text" class="swal2-input" style="width:100%; margin:0; border-radius:8px; border:1px solid #ddd; padding:10px; font-size:1rem; font-family:inherit;" placeholder="مثال: الرياضيات">' +
            '</div>' +
            '</div>',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '🖨️ طباعة',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#95a5a6',
        width: 420,
        preConfirm: function() {
            var dateVal = document.getElementById('swal-date').value;
            var formattedDate = todayDefault;
            if (dateVal) {
                var d = new Date(dateVal);
                formattedDate = d.toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            }
            return {
                date: formattedDate,
                subject: document.getElementById('swal-subject').value || ''
            };
        }
    });

    if (!result.isConfirmed) return;

    var inputDate = result.value.date;
    var inputSubject = result.value.subject || '....................';

    var level = document.getElementById('levelSelect').value;
    var stream = document.getElementById('streamSelect').value;
    var cls = document.getElementById('classSelect').value;

    var settings = institutionSettings || {};
    var today = inputDate;

    // Get students - all or filtered
    var students;
    if (level) {
        students = allStudents.filter(function(s) { return s.level === level; });
        if (stream) students = students.filter(function(s) { return s.stream === stream; });
        if (cls) students = students.filter(function(s) { return s.class === cls; });
    } else {
        students = allStudents.slice(); // All students
    }

    // Group students by their exam group, tracking level for room lookup
    var groupData = {};
    students.forEach(function(s) {
        var key = getStudentKey(s);
        var groupNum = parseInt(examGroupings[key]) || 0;
        if (groupNum > 0) {
            var groupKey = s.level + '_' + groupNum;
            if (!groupData[groupKey]) {
                groupData[groupKey] = { count: 0, level: s.level, groupNum: groupNum };
            }
            groupData[groupKey].count++;
        }
    });

    var useAverageOrder = isAverageOrderingActive();
    var levelGroupOrders = {};

    Object.keys(groupData).forEach(function(groupKey) {
        var levelKey = groupData[groupKey].level;
        if (!levelGroupOrders[levelKey]) {
            var levelStudents = students.filter(function(s) { return s.level === levelKey; });
            levelGroupOrders[levelKey] = new Map(
                getGroupOrderEntries(levelStudents, { includeConfigured: false, useAverageOrder: useAverageOrder })
                    .map(function(entry, index) { return [entry.groupNum, index]; })
            );
        }
    });

    var sortedGroupKeys = Object.keys(groupData).sort(function(a, b) {
        var ga = groupData[a];
        var gb = groupData[b];
        if (ga.level !== gb.level) return ga.level.localeCompare(gb.level, 'ar');

        var orderMap = levelGroupOrders[ga.level] || new Map();
        var rankA = orderMap.has(ga.groupNum) ? orderMap.get(ga.groupNum) : Number.MAX_SAFE_INTEGER;
        var rankB = orderMap.has(gb.groupNum) ? orderMap.get(gb.groupNum) : Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;

        return ga.groupNum - gb.groupNum;
    });

    if (sortedGroupKeys.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا يوجد تلاميذ مقسمين إلى أفواج' });
        return;
    }

    // Build scope text for subtitle
    var scopeText = level || 'جميع المستويات';
    if (stream) scopeText += ' - ' + getStreamLabel(stream);
    if (cls) scopeText += ' - قسم ' + cls;

    // Build table rows - heights will be adjusted dynamically by JS in print window
    var rowsHtml = '';
    var currentLevel = '';
    sortedGroupKeys.forEach(function(gKey) {
        var g = groupData[gKey];
        var roomLabel = roomSettings[g.level + '_' + g.groupNum] || '';

        // Add level separator if printing all levels
        if (!level && g.level !== currentLevel) {
            currentLevel = g.level;
            rowsHtml += '<tr class="level-sep"><td colspan="5" style="font-weight:bold; background-color:#e0e0e0; font-size:11pt; padding:8px;">المستوى: ' + g.level + '</td></tr>';
        }

        rowsHtml += '<tr class="data-row" style="vertical-align: top;">';
        rowsHtml += '<td style="font-weight:bold;">فوج ' + g.groupNum + '</td>';
        rowsHtml += '<td>' + roomLabel + '</td>';
        rowsHtml += '<td>' + g.count + '</td>';
        rowsHtml += '<td></td>';
        rowsHtml += '<td style="text-align: right; padding-right: 8px;"></td>';
        rowsHtml += '</tr>';
    });

    var printWindow = window.open('', '_blank');
    printWindow.document.write('\
        <!DOCTYPE html>\
        <html lang="ar" dir="rtl">\
        <head>\
            <meta charset="UTF-8">\
            <title>قائمة غياب التلاميذ</title>\
            <style>\
                * { box-sizing: border-box; }\
                body { \
                    font-family: "Cairo", "Tajawal", sans-serif; \
                    margin: 0; \
                    padding: 0;\
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
                .footer { margin-top: 10px; display: flex; justify-content: flex-end; font-size: 10pt; }\
                @media print {\
                    @page { margin: 0.8cm; size: A4; }\
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\
                }\
            </style>\
        \n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : '') + '\n        </head>\
        <body>\n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : '') + '\
            <div id="header-section" class="header-container">\
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
                    <h2 style="text-decoration: underline; margin: 0; line-height:1.2;">قائمة غياب التلاميذ</h2>\
                </div>\
                <div class="header-row" style="border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 3px 0; background-color: #f9f9f9; align-items: center;">\
                    <div class="header-box" style="text-align: right; width: 25%;">\
                        <h3 style="margin:0; line-height:1;">المستوى: ' + scopeText + '</h3>\
                    </div>\
                    <div class="header-box" style="text-align: center; width: 25%;">\
                        <h3 style="margin:0; line-height:1;">عدد الأفواج: ' + sortedGroupKeys.length + '</h3>\
                    </div>\
                    <div class="header-box" style="text-align: center; width: 25%;">\
                        <h3 style="margin:0; line-height:1;">اليوم: ' + today + '</h3>\
                    </div>\
                    <div class="header-box" style="text-align: left; width: 25%;">\
                        <h3 style="margin:0; line-height:1;">المادة: ' + inputSubject + '</h3>\
                    </div>\
                </div>\
            </div>\
            <table id="main-table">\
                <thead>\
                    <tr>\
                        <th width="12%">الفوج</th>\
                        <th width="12%">القاعة</th>\
                        <th width="10%">عدد التلاميذ</th>\
                        <th width="10%">عدد الغياب</th>\
                        <th>التلاميذ الغائبون</th>\
                    </tr>\
                </thead>\
                <tbody>\
                    ' + rowsHtml + '\
                </tbody>\
            </table>\
            <div id="footer-section" class="footer">\
                <div style="text-align: center;">\
                    <div style="margin-bottom: 5px;">حرر بـ: ' + (settings.municipality || '.......') + ' في: ' + today + '</div>\
                    <div>المدير</div>\
                </div>\
            </div>\
            <script>\
                window.onload = function() {\
                    var pageH = 281 * (96 / 25.4);\
                    var twoPages = pageH * 2;\
                    var currentH = document.body.scrollHeight;\
                    var dataRows = document.querySelectorAll(".data-row");\
                    var numRows = dataRows.length;\
                    if (numRows === 0) { // window.print(); /* Replaced by global Toolbar */ return; }\
                    var remaining = twoPages - currentH - 150;\
                    if (remaining > 0) {\
                        var addPerRow = Math.floor(remaining / numRows);\
                        for (var i = 0; i < numRows; i++) {\
                            var cur = dataRows[i].offsetHeight;\
                            dataRows[i].style.height = (cur + addPerRow) + "px";\
                        }\
                    }\
                    // auto-print removed\
                };\
            </script>\
        \n            ' + (window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : '') + '\n        </body>\
        </html>\
    ');
    printWindow.document.close();
}

async function groupByAverage() {
    const level = document.getElementById('levelSelect').value;
    const cls = document.getElementById('classSelect').value;
    const stream = document.getElementById('streamSelect').value;
    const trimester = document.getElementById('trimesterSelect').value;
    numGroups = parseInt(document.getElementById('numGroups').value) || 2;

    if (!level) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولا' });
        return;
    }

    if (!trimester) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار الفصل الدراسي أولا لجلب المعدلات' });
        return;
    }

    // Determine scope based on selection
    let studentsToGroup;
    let scopeText;

    const cleanCls = cls ? cls.trim() : "";
    const cleanStream = stream ? stream.trim() : "";

    if (cleanCls !== "") {
        if (cleanStream !== "") {
            studentsToGroup = allStudents.filter(s => s.level == level && s.stream === stream && s.class == cleanCls);
            scopeText = `شعبة "${getStreamLabel(stream)}" - قسم "${cleanCls}"`;
        } else {
            studentsToGroup = allStudents.filter(s => s.level == level && s.class == cleanCls);
            scopeText = `قسم "${cleanCls}"`;
        }
    } else if (cleanStream !== "") {
        studentsToGroup = allStudents.filter(s => s.level === level && s.stream === stream);
        scopeText = `شعبة "${getStreamLabel(stream)}"`;
    } else {
        studentsToGroup = allStudents.filter(s => s.level === level);
        scopeText = `كل تلاميذ المستوى "${level}"`;
    }

    if (studentsToGroup.length === 0) {
        Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا يوجد تلاميذ للتفويج في هذا النطاق' });
        return;
    }

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: `هل أنت متأكد من التفويج حسب المعدل (الفصل ${trimester}) لـ: ${scopeText}\nسيتم ترتيبهم وتوزيعهم بالتساوي على ${numGroups} أفواج.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#d33',
        confirmButtonText: 'نعم، تفويج حسب المعدل',
        cancelButtonText: 'إلغاء'
    });

    if (!result.isConfirmed) {
        return;
    }

    // Sort descending by average
    // The average was already mapped as tempAverage when loadStudents loaded data from DB.getResults
    studentsToGroup.sort((a, b) => (b.tempAverage || 0) - (a.tempAverage || 0));

    // Initialize groups
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
        groups[i] = [];
    }

    // Distribute by chunks (Sequential distribution by average ranks)
    const totalStudents = studentsToGroup.length;
    const baseSize = Math.floor(totalStudents / numGroups);
    let remainder = totalStudents % numGroups;

    let currentIndex = 0;
    for (let i = 0; i < numGroups; i++) {
        // Calculate size of this group (distribute remainder among first few groups)
        const currentSize = baseSize + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        
        for (let j = 0; j < currentSize; j++) {
            if (currentIndex < totalStudents) {
                groups[i].push(studentsToGroup[currentIndex]);
                currentIndex++;
            }
        }
    }

    // Save results
    groups.forEach((groupStudents, idx) => {
        const groupNum = idx + 1;
        groupStudents.forEach(s => {
            const key = getStudentKey(s); // Uses original student object properties
            examGroupings[key] = groupNum;
        });
    });

    saveExamGroupings();
    renderTable();

    Swal.fire({
        icon: 'success',
        title: 'تم التفويج بنجاح',
        text: `تم ترتيب وتوزيع ${studentsToGroup.length} تلميذ حسب معدل الفصل ${trimester} على ${numGroups} أفواج.`,
        timer: 3000,
        showConfirmButton: false
    });
}

async function printExamSlipsLegacy() {
    if (blockTrialPrint()) return;
    var level = document.getElementById('levelSelect').value;
    if (!level) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولا' });
        return;
    }
    if (filteredStudents.length === 0) {
        Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا توجد بيانات للطباعة' });
        return;
    }

    // Settings modal HTML
    var modalHtml = '<div style="text-align:right; direction:rtl; font-family:inherit;">' +
        '<div style="margin-bottom:14px;">' +
            '<label style="font-weight:800; display:block; margin-bottom:6px;">عنوان القصاصة</label>' +
            '<input id="slipTitle" type="text" value="الامتحان التجريبي دورة ماي ' + new Date().getFullYear() + '" ' +
                'style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:10px; font-family:inherit; font-size:0.95rem; direction:rtl;">' +
        '</div>' +
        '<div style="display:flex; gap:12px; margin-bottom:14px;">' +
            '<div style="flex:1;">' +
                '<label style="font-weight:800; display:block; margin-bottom:6px;">عرض القصاصة (mm)</label>' +
                '<input id="slipWidth" type="number" value="80" min="50" max="120" ' +
                    'style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:10px; font-family:inherit; text-align:center;">' +
            '</div>' +
            '<div style="flex:1;">' +
                '<label style="font-weight:800; display:block; margin-bottom:6px;">ارتفاع القصاصة (mm)</label>' +
                '<input id="slipHeight" type="number" value="40" min="25" max="80" ' +
                    'style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:10px; font-family:inherit; text-align:center;">' +
            '</div>' +
        '</div>' +
        '<div style="margin-bottom:6px;"><label style="font-weight:800; display:block; margin-bottom:8px;">نمط الطباعة</label></div>' +
        '<div style="display:flex; gap:10px; margin-bottom:4px;">' +
            '<label style="flex:1; cursor:pointer; padding:12px; border:2px solid #22c55e; border-radius:12px; text-align:center; background:#f0fdf4; font-weight:700;" id="modeStripeLabel">' +
                '<input type="radio" name="slipMode" value="stripe" checked style="margin-left:6px;">' +
                '<div style="font-size:0.95rem; color:#15803d;">شريط ملون</div>' +
                '<div style="font-size:0.78rem; color:#64748b; margin-top:4px;">فردي أخضر / زوجي بني</div>' +
            '</label>' +
            '<label style="flex:1; cursor:pointer; padding:12px; border:2px solid #cbd5e1; border-radius:12px; text-align:center; background: var(--card-bg); font-weight:700;" id="modeSeparateLabel">' +
                '<input type="radio" name="slipMode" value="separate" style="margin-left:6px;">' +
                '<div style="font-size:0.95rem; color:#1e40af;">فصل الأوراق</div>' +
                '<div style="font-size:0.78rem; color:#64748b; margin-top:4px;">فردي في ورقة / زوجي في ورقة</div>' +
            '</label>' +
        '</div>' +
    '</div>';

    var result = await Swal.fire({
        title: 'إعدادات القصاصات',
        html: modalHtml,
        width: 520,
        showCancelButton: true,
        confirmButtonText: 'طباعة',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#1d4ed8',
        didOpen: function() {
            // Radio button visual toggle
            var radios = document.querySelectorAll('input[name="slipMode"]');
            radios.forEach(function(r) {
                r.addEventListener('change', function() {
                    document.getElementById('modeStripeLabel').style.borderColor = radios[0].checked ? '#22c55e' : '#cbd5e1';
                    document.getElementById('modeStripeLabel').style.background = radios[0].checked ? '#f0fdf4' : '#fff';
                    document.getElementById('modeSeparateLabel').style.borderColor = radios[1].checked ? '#1d4ed8' : '#cbd5e1';
                    document.getElementById('modeSeparateLabel').style.background = radios[1].checked ? '#eff6ff' : '#fff';
                });
            });
        },
        preConfirm: function() {
            return {
                subtitle: document.getElementById('slipTitle').value,
                width: parseInt(document.getElementById('slipWidth').value) || 80,
                height: parseInt(document.getElementById('slipHeight').value) || 40,
                mode: document.querySelector('input[name="slipMode"]:checked').value
            };
        }
    });

    if (!result.isConfirmed || !result.value) return;

    var config = result.value;
    var subtitle = config.subtitle;
    var slipW = config.width;
    var slipH = config.height;
    var printMode = config.mode;
    
    var educationStage = (institutionSettings || {}).educationStage || 'middle';
    var isSecondary = educationStage === 'secondary';

    var groupFilterVal = document.getElementById('groupFilter')?.value;
    var studentsToProcess = allStudents.filter(function(s) { 
        return s.level === level; 
    });

    // If a specific exam group is selected in the UI, filter by it
    if (groupFilterVal) {
        studentsToProcess = studentsToProcess.filter(function(s) {
            return String(examGroupings[getStudentKey(s)]) === String(groupFilterVal);
        });
    }
    // Note: We deliberately ignore the class filter (cls) here because Exam Groups 
    // are level-wide. Printing by class would split the groups incorrectly.

    var orderedGroups = getGroupOrderEntries(studentsToProcess, { includeConfigured: false });

    var fmtGender = function(val) {
        if (!val) return '--';
        var lower = String(val).toLowerCase();
        if (lower === 'm' || lower === 'male' || val === 'ذكر') return 'ذكر';
        if (lower === 'f' || lower === 'female' || val === 'أنثى') return 'أنثى';
        return val;
    };

    var fmtDate = function(val) {
        if (!val) return '--';
        var str = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            var parts = str.split('-');
            return [parts[2], parts[1], parts[0]].join('/');
        }
        return str;
    };

    var SLIP_STREAM_LABELS = {
        common_science: 'جذع مشترك علوم وتكنولوجيا', common_arts: 'جذع مشترك آداب',
        science: 'علوم تجريبية', math: 'رياضيات', tech_math: 'تقني رياضي',
        management: 'تسيير واقتصاد', languages: 'لغات أجنبية', arts: 'آداب وفلسفة'
    };
    var getSlipStreamLabel = function(val) { return SLIP_STREAM_LABELS[val] || val || '--'; };

    var getPrimaryNumber = function(s) {
        if (s.order !== undefined && s.order !== null && String(s.order).trim() !== '') return String(s.order);
        if (s.reg_number) return s.reg_number;
        if (s.national_id) return s.national_id;
        return '--';
    };

    // Build a flat list of all students with their global index for odd/even
    var allSlipStudents = [];
    var useAvgOrderSlipsLegacy = isAverageOrderingActive();
    orderedGroups.forEach(function(entry) {
        var sorted = entry.students.slice().sort(function(a, b) {
            if (useAvgOrderSlipsLegacy) {
                var avgDiff = (parseFloat(b.tempAverage) || 0) - (parseFloat(a.tempAverage) || 0);
                if (avgDiff !== 0) return avgDiff;
            }
            return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
        });
        sorted.forEach(function(s) {
            allSlipStudents.push({ student: s, groupNum: entry.groupNum });
        });
    });

    if (allSlipStudents.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد أفواج للطباعة. يرجى تفويج التلاميذ أولا.' });
        return;
    }

    var getRoomLabelLegacy = function(groupNum) {
        return roomSettings[`${level}_${groupNum}`] || '';
    };

    // Helper to build one slip card HTML
    var buildSlipCard = function(student, globalIndex, groupNum) {
        var fullName = ((student.last_name || '') + ' ' + (student.first_name || '')).trim() || 'بدون اسم';
        var birthDate = fmtDate(student.birth_date || student.date_of_birth);
        var isOdd = (globalIndex % 2 === 1);
        var roomLabel = String(getRoomLabelLegacy(groupNum) || '--').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        let middleLevelFormatted = String(student.level || '--');
        if (!isSecondary) {
            if (typeof isAverageOrderingActive !== 'undefined' && isAverageOrderingActive()) {
                const lvlMatch = String(student.level || '').match(/\d+/);
                const clsMatch = String(student.class || '').match(/\d+/);
                const lvlNum = lvlMatch ? parseInt(lvlMatch[0], 10) : String(student.level || '');
                const clsNum = clsMatch ? parseInt(clsMatch[0], 10) : String(student.class || '');
                middleLevelFormatted = `${lvlNum}م${clsNum}`;
            } else {
                middleLevelFormatted = `${String(student.level || '--')} ${String(student.class || '')}`.trim();
            }
        }
        
        var levelClassHtml = isSecondary
            ? '<div class="slip-meta-item"><span class="slip-meta-label">المستوى</span><span class="slip-meta-value">' + (student.level || '--') + '</span></div>' +
              '<div class="slip-meta-item"><span class="slip-meta-label">الشعبة</span><span class="slip-meta-value">' + getSlipStreamLabel(student.stream) + '</span></div>' +
              '<div class="slip-meta-item"><span class="slip-meta-label">القسم</span><span class="slip-meta-value">' + (student.class || '--') + '</span></div>'
            : '<div class="slip-meta-item"><span class="slip-meta-label">القسم</span><span class="slip-meta-value">' + middleLevelFormatted + '</span></div>';


        // Stripe color logic
        var stripeStyle = '';
        if (printMode === 'stripe') {
            var color = isOdd ? '#16a34a' : '#92400e';
            stripeStyle = 'border-right: 8px solid ' + color + ';';
        }

        var html = '<article class="slip-card" style="' + stripeStyle + '">' +
            '<div class="slip-card-top">' +
                '<div class="slip-header-center-wrap">' +
                    '<div class="slip-subtitle">' + subtitle + '</div>' +
                    '<h3 class="slip-student-name">' + fullName + '</h3>' +
                '</div>' +
                '<div class="slip-number-badge">' + globalIndex + '</div>' +
            '</div>' +
            '<div class="slip-meta-grid">' +
                levelClassHtml +
                '<div class="slip-meta-item"><span class="slip-meta-label">القاعة</span><span class="slip-meta-value">' + roomLabel + '</span></div>' +
                '<div class="slip-meta-item"><span class="slip-meta-label">تاريخ الميلاد</span><span class="slip-meta-value">' + birthDate + '</span></div>' +
                '<div class="slip-meta-item"><span class="slip-meta-label">الجنس</span><span class="slip-meta-value">' + fmtGender(student.gender) + '</span></div>' +
            '</div>' +
        '</article>';
        return html;
    };

    // Build content based on mode
    var allContent = '';

    if (printMode === 'separate') {
        // Odd students page
        var oddCards = '';
        var evenCards = '';
        allSlipStudents.forEach(function(item, idx) {
            var globalIdx = idx + 1;
            var card = buildSlipCard(item.student, globalIdx, item.groupNum);
            if (globalIdx % 2 === 1) {
                oddCards += card;
            } else {
                evenCards += card;
            }
        });

        allContent += '<section class="slips-chunk">' +
            '<h3 class="slips-chunk-title">الأرقام الفردية</h3>' +
            '<div class="slips-grid">' + oddCards + '</div>' +
        '</section>';

        if (evenCards) {
            allContent += '<section class="slips-chunk page-break-before">' +
                '<h3 class="slips-chunk-title">الأرقام الزوجية</h3>' +
                '<div class="slips-grid">' + evenCards + '</div>' +
            '</section>';
        }
    } else {
        // Stripe mode - group by exam groups as before
        var globalCounter = 0;
        orderedGroups.forEach(function(entry) {
            var students = entry.students.slice().sort(function(a, b) {
                return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
            });
            if (students.length === 0) return;

            var pageBreakClass = allContent ? ' page-break-before' : '';
            var groupHtml = '<section class="slips-chunk' + pageBreakClass + '">' +
                '<h3 class="slips-chunk-title">فوج ' + entry.groupNum + '</h3>' +
                '<div class="slips-grid">';

            students.forEach(function(student) {
                globalCounter++;
                groupHtml += buildSlipCard(student, globalCounter, entry.groupNum);
            });

            groupHtml += '</div></section>';
            allContent += groupHtml;
        });
    }

    // CSS for print
    var css = 'body { font-family: "Cairo","Tajawal","Segoe UI",Tahoma,sans-serif; margin:0; padding:0.5cm; }' +
        '.slips-chunk { display:flex; flex-direction:column; gap:12px; }' +
        '.slips-chunk + .slips-chunk { margin-top:24px; }' +
        '.slips-chunk-title { margin:0; font-size:1rem; font-weight:900; color:#000; padding:0 2px; }' +
        '.slips-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(290px,1fr)); gap:12px; }' +
        '.slip-card { position:relative; min-height:178px; border-radius:14px; overflow:visible; background: var(--card-bg); border:1px solid #000; padding:12px 18px; page-break-inside:avoid; break-inside:avoid; box-sizing:border-box; color:#000; }' +
        '.slip-card-top { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; position:relative; margin-bottom:4px; text-align:center; width:100%; }' +
        '.slip-header-center-wrap { width:calc(100% - 70px); margin: 0 auto; display:flex; flex-direction:column; align-items:center; box-sizing: border-box; }' +
        '.slip-number-badge { position:absolute; top:-12px; left:-12px; min-width:36px; height:36px; display:flex; align-items:center; justify-content:center; background: var(--card-bg); color:#000; font-size:1.3rem; font-weight:900; border:2.5pt solid #000; border-radius:50%; z-index:10; }' +
        '.slip-student-name { margin:0; font-size:1.15rem; font-weight:900; line-height:1.1; color:#000; width:100%; }' +
        '.slip-subtitle { margin:0; color:#000; font-size:0.85rem; font-weight:700; width:100%; line-height:1.1; }' +
        '.slip-meta-grid { margin-top:6px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px 8px; }' +
        '.slip-meta-item { background: var(--card-bg); border-radius:6px; padding:4px 8px; border:1px solid #000; display:flex; flex-direction:column; justify-content:center; }' +
        '.slip-meta-label { display:block; color:#000; font-size:0.7rem; font-weight:800; margin-bottom:1px; line-height:1; }' +
        '.slip-meta-value { display:block; color:#000; font-size:0.85rem; font-weight:800; line-height:1.1; word-break:break-word; }' +
        '@media print {' +
            '@page { size:A4; margin:15mm; }' +
            'html,body { background: var(--card-bg) !important; margin:0 !important; padding:0 !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }' +
            '.no-print { display:none !important; }' +
            '.slips-chunk.page-break-before { break-before:page; page-break-before:always; }' +
            '.slips-chunk-title { margin:0 0 6mm !important; font-size:14pt !important; }' +
            '.slips-grid { grid-template-columns:repeat(2,' + slipW + 'mm) !important; justify-content:center !important; gap:10mm 5mm !important; }' +
            '.slip-card { height:' + (slipH + 2) + 'mm !important; min-height:' + (slipH + 2) + 'mm !important; box-shadow:none !important; border: 1px solid #000; padding:10px 14px !important; overflow:visible; display:flex; flex-direction:column; justify-content:space-between; margin-bottom: 5mm; }' +
            '.slip-meta-grid { margin-top:auto !important; gap:3px 8px !important; margin-bottom:2px; }' +
            '.slip-meta-item { padding:4px 6px !important; border-radius:6px !important; }' +
            '.slip-meta-label { font-size:0.75rem !important; margin-bottom:2px !important; }' +
            '.slip-meta-value { font-size:0.95rem !important; }' +
        '}';

    var printWindow = window.open('', '_blank');
    printWindow.document.write(
        '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طباعة قصاصات الطاولات</title>' +
        '<style>' + css + '</style>' +
        (window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : '') +
        '</head><body>' +
        (window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : '') +
        allContent +
        (window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : '') +
        '</body></html>'
    );
    printWindow.document.close();
}

async function printExamSlips() {
    if (blockTrialPrint()) return;
    const level = document.getElementById('levelSelect').value;
    if (!level) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار المستوى أولاً' });
        return;
    }

    if (filteredStudents.length === 0) {
        Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا توجد بيانات للطباعة' });
        return;
    }

    const settings = institutionSettings || {};
    const schoolYear = settings.schoolYear || settings.currentAcademicYear || '';
    const currentYear = new Date().getFullYear();

    const modalHtml = `
        <div style="text-align:right; direction:rtl; font-family:inherit;">
            <div style="background:linear-gradient(135deg,#eff6ff,#f8fafc); border:1px solid #dbeafe; border-radius:16px; padding:14px; margin-bottom:14px;">
                <div style="font-size:1rem; font-weight:900; color:#0f172a; margin-bottom:4px;">تصميم بطاقات الطاولات</div>
                <div style="font-size:0.82rem; color:#475569; line-height:1.6;">سيتم إنشاء بطاقات مناسبة للصق على الطاولات أثناء الامتحان، مع اسم واضح من بعيد ومعلومات القاعة والفوج والقسم بشكل بارز.</div>
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-weight:800; display:block; margin-bottom:6px;">عنوان القصاصة</label>
                <input id="slipTitle" type="text" value="الامتحان التجريبي دورة ماي ${currentYear}"
                    style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:10px; font-family:inherit; font-size:0.95rem; direction:rtl;">
            </div>
            <div style="display:flex; gap:12px; margin-bottom:14px;">
                <div style="flex:1;">
                    <label style="font-weight:800; display:block; margin-bottom:6px;">عرض القصاصة (mm)</label>
                    <input id="slipWidth" type="number" value="75" min="55" max="100"
                        style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:10px; font-family:inherit; text-align:center;">
                </div>
                <div style="flex:1;">
                    <label style="font-weight:800; display:block; margin-bottom:6px;">ارتفاع القصاصة (mm)</label>
                    <input id="slipHeight" type="number" value="45" min="30" max="80"
                        style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:10px; font-family:inherit; text-align:center;">
                </div>
            </div>
            <div style="display:flex; gap:12px; margin-bottom:14px;">
                <div style="flex:1;">
                    <label style="font-weight:800; display:block; margin-bottom:6px;">لون البطاقات الفردية</label>
                    <input id="slipOddColor" type="color" value="#15803d"
                        style="width:100%; height:44px; padding:4px; border:1px solid #cbd5e1; border-radius:10px; background: var(--card-bg);">
                </div>
                <div style="flex:1;">
                    <label style="font-weight:800; display:block; margin-bottom:6px;">لون البطاقات الزوجية</label>
                    <input id="slipEvenColor" type="color" value="#92400e"
                        style="width:100%; height:44px; padding:4px; border:1px solid #cbd5e1; border-radius:10px; background: var(--card-bg);">
                </div>
            </div>
            <div style="margin-bottom:6px;">
                <label style="font-weight:800; display:block; margin-bottom:8px;">نمط الطباعة</label>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:4px;">
                <label style="flex:1; cursor:pointer; padding:12px; border:2px solid #22c55e; border-radius:12px; text-align:center; background:#f0fdf4; font-weight:700;" id="modeStripeLabel">
                    <input type="radio" name="slipMode" value="stripe" checked style="margin-left:6px;">
                    <div style="font-size:0.95rem; color:#15803d;">حسب الأفواج</div>
                    <div style="font-size:0.78rem; color:#64748b; margin-top:4px;">كل فوج في كتلة مستقلة مع تمييز لوني</div>
                </label>
                <label style="flex:1; cursor:pointer; padding:12px; border:2px solid #cbd5e1; border-radius:12px; text-align:center; background: var(--card-bg); font-weight:700;" id="modeSeparateLabel">
                    <input type="radio" name="slipMode" value="separate" style="margin-left:6px;">
                    <div style="font-size:0.95rem; color:#1e40af;">فردي / زوجي</div>
                    <div style="font-size:0.78rem; color:#64748b; margin-top:4px;">في حالة الطباعة على أوراق ملونة</div>
                </label>
            </div>
            <div style="margin-top:10px; color:#64748b; font-size:0.78rem;">
                المؤسسة: ${settings.institutionName || '........'} | السنة: ${schoolYear || '........'}
            </div>
        </div>
    `;

    const result = await Swal.fire({
        title: 'إعدادات القصاصات',
        html: modalHtml,
        width: 560,
        showCancelButton: true,
        confirmButtonText: 'طباعة',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#1d4ed8',
        didOpen: function() {
            const radios = document.querySelectorAll('input[name="slipMode"]');
            radios.forEach(function(radio) {
                radio.addEventListener('change', function() {
                    document.getElementById('modeStripeLabel').style.borderColor = radios[0].checked ? '#22c55e' : '#cbd5e1';
                    document.getElementById('modeStripeLabel').style.background = radios[0].checked ? '#f0fdf4' : '#fff';
                    document.getElementById('modeSeparateLabel').style.borderColor = radios[1].checked ? '#1d4ed8' : '#cbd5e1';
                    document.getElementById('modeSeparateLabel').style.background = radios[1].checked ? '#eff6ff' : '#fff';
                });
            });
        },
        preConfirm: function() {
            return {
                subtitle: document.getElementById('slipTitle').value.trim() || `الامتحان التجريبي دورة ماي ${currentYear}`,
                width: parseInt(document.getElementById('slipWidth').value, 10) || 75,
                height: parseInt(document.getElementById('slipHeight').value, 10) || 45,
                oddColor: document.getElementById('slipOddColor').value || '#15803d',
                evenColor: document.getElementById('slipEvenColor').value || '#92400e',
                mode: document.querySelector('input[name="slipMode"]:checked').value
            };
        }
    });

    if (!result.isConfirmed || !result.value) return;

    const config = result.value;
    const subtitle = config.subtitle;
    const slipW = config.width;
    const slipH = config.height;
    const oddColor = config.oddColor;
    const evenColor = config.evenColor;
    const printMode = config.mode;
    const printColumns = slipW <= 60 ? 3 : 2;
    const educationStage = settings.educationStage || 'middle';
    const isSecondary = educationStage === 'secondary';

    const groupFilterVal = document.getElementById('groupFilter')?.value || '';
    const cls = document.getElementById('classSelect')?.value || '';
    const stream = document.getElementById('streamSelect')?.value || '';

    let studentsToProcess = allStudents.filter(function(student) {
        return student.level === level &&
               (!cls || student.class === cls) &&
               (!stream || student.stream === stream);
    });

    if (groupFilterVal) {
        studentsToProcess = studentsToProcess.filter(function(student) {
            return String(examGroupings[getStudentKey(student)]) === String(groupFilterVal);
        });
    }

    const orderedGroups = getGroupOrderEntries(studentsToProcess, { includeConfigured: false });
    if (orderedGroups.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد أفواج جاهزة للطباعة. يرجى تفويج التلاميذ أولاً.' });
        return;
    }

    const getPrimaryNumber = function(student) {
        if (student.order !== undefined && student.order !== null && String(student.order).trim() !== '') return String(student.order);
        if (student.reg_number) return String(student.reg_number);
        if (student.national_id) return String(student.national_id);
        return '--';
    };

    const fmtDate = function(value) {
        if (!value) return '--';
        const raw = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const parts = raw.split('-');
            return [parts[2], parts[1], parts[0]].join('/');
        }
        return raw;
    };

    const fmtGender = function(value) {
        if (!value) return '--';
        const normalized = String(value).trim().toLowerCase();
        if (normalized === 'm' || normalized === 'male' || value === 'ذكر') return 'ذكر';
        if (normalized === 'f' || normalized === 'female' || value === 'أنثى') return 'أنثى';
        return String(value);
    };

    const getRoomLabel = function(groupNum) {
        return roomSettings[`${level}_${groupNum}`] || '';
    };

    const escapeHtml = function(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const getAccentColor = function(groupNum, globalIndex) {
        return globalIndex % 2 === 1 ? oddColor : evenColor;
    };

    const allSlipStudents = [];
    const useAvgOrderSlips = isAverageOrderingActive();
    orderedGroups.forEach(function(entry) {
        const sortedStudents = entry.students.slice().sort(function(a, b) {
            if (useAvgOrderSlips) {
                var avgDiff = (parseFloat(b.tempAverage) || 0) - (parseFloat(a.tempAverage) || 0);
                if (avgDiff !== 0) return avgDiff;
            }
            return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
        });
        sortedStudents.forEach(function(student, idx) {
            allSlipStudents.push({ student: student, groupNum: entry.groupNum, localIndex: idx + 1 });
        });
    });

    if (allSlipStudents.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد قصاصات للطباعة في هذا النطاق.' });
        return;
    }

    const buildSlipCard = function(student, displayIndex, groupNum, globalIndexForAccent) {
        const accent = getAccentColor(groupNum, globalIndexForAccent || displayIndex);
        const fullName = ((student.last_name || '') + ' ' + (student.first_name || '')).trim() || 'بدون اسم';
        let middleLevelFormatted = escapeHtml(student.level || '--');
        if (!isSecondary) {
            if (typeof isAverageOrderingActive !== 'undefined' && isAverageOrderingActive()) {
                const lvlMatch = String(student.level || '').match(/\d+/);
                const clsMatch = String(student.class || '').match(/\d+/);
                const lvlNum = lvlMatch ? parseInt(lvlMatch[0], 10) : String(student.level || '');
                const clsNum = clsMatch ? parseInt(clsMatch[0], 10) : String(student.class || '');
                middleLevelFormatted = `${lvlNum}م${clsNum}`;
            } else {
                middleLevelFormatted = `${escapeHtml(student.level || '--')} ${escapeHtml(student.class || '')}`.trim();
            }
        }
        
        const levelSectionValue = isSecondary
            ? `${escapeHtml(student.level || '--')} - ${escapeHtml(getStreamLabel(student.stream) || '--')} - ${escapeHtml(student.class || '--')}`
            : middleLevelFormatted;

        const roomLabel = escapeHtml(getRoomLabel(groupNum) || '--');

        return `
            <article class="slip-card" style="--slip-accent:${accent};">
                <div class="slip-card-shell">
                    <header class="slip-header">
                        <div class="slip-header-copy">
                            <div class="slip-overline">${escapeHtml(subtitle)}</div>
                            <div class="slip-title">${escapeHtml(settings.institutionName || 'المؤسسة')}</div>
                        </div>
                        <div class="slip-number-badge">${displayIndex}</div>
                    </header>

                    <section class="slip-identity">
                        <h3 class="slip-student-name">${escapeHtml(fullName)}</h3>
                    </section>

                    <section class="slip-details-grid">
                        <div class="slip-detail-card"><span class="slip-detail-label">${isSecondary ? 'المستوى / الشعبة / القسم' : 'المستوى / القسم'}</span><span class="slip-detail-value">${levelSectionValue}</span></div>
                        <div class="slip-detail-card"><span class="slip-detail-label">القاعة</span><span class="slip-detail-value">${roomLabel}</span></div>
                        <div class="slip-detail-card"><span class="slip-detail-label">تاريخ الميلاد</span><span class="slip-detail-value">${escapeHtml(fmtDate(student.birth_date || student.date_of_birth))}</span></div>
                        <div class="slip-detail-card"><span class="slip-detail-label">الجنس</span><span class="slip-detail-value">${escapeHtml(fmtGender(student.gender))}</span></div>
                    </section>
                </div>
            </article>
        `;
    };

    let allContent = '';

    if (printMode === 'separate') {
        let oddCards = '';
        let evenCards = '';

        allSlipStudents.forEach(function(item, idx) {
            const globalIndex = idx + 1;
            const card = buildSlipCard(item.student, item.localIndex, item.groupNum, globalIndex);
            if (globalIndex % 2 === 1) {
                oddCards += card;
            } else {
                evenCards += card;
            }
        });

        allContent += `
            <section class="slips-chunk">
                <div class="slips-section-head">
                    <h3 class="slips-chunk-title">الأرقام الفردية</h3>
                    <div class="slips-section-meta"><span>عدد القصاصات: ${Math.ceil(allSlipStudents.length / 2)}</span></div>
                </div>
                <div class="slips-grid">${oddCards}</div>
            </section>
        `;

        if (evenCards) {
            allContent += `
                <section class="slips-chunk page-break-before">
                    <div class="slips-section-head">
                        <h3 class="slips-chunk-title">الأرقام الزوجية</h3>
                        <div class="slips-section-meta"><span>عدد القصاصات: ${Math.floor(allSlipStudents.length / 2)}</span></div>
                    </div>
                    <div class="slips-grid">${evenCards}</div>
                </section>
            `;
        }
    } else {
        let globalCounter = 0;
        orderedGroups.forEach(function(entry) {
            const students = entry.students.slice().sort(function(a, b) {
                if (useAvgOrderSlips) {
                    var avgDiff = (parseFloat(b.tempAverage) || 0) - (parseFloat(a.tempAverage) || 0);
                    if (avgDiff !== 0) return avgDiff;
                }
                return ((a.first_name || '') + ' ' + (a.last_name || '')).localeCompare((b.first_name || '') + ' ' + (b.last_name || ''), 'ar');
            });
            if (students.length === 0) return;

            let cardsHtml = '';
            students.forEach(function(student, idx) {
                globalCounter += 1;
                cardsHtml += buildSlipCard(student, idx + 1, entry.groupNum, globalCounter);
            });

            const roomText = getRoomLabel(entry.groupNum);
            allContent += `
                <section class="slips-chunk${allContent ? ' page-break-before' : ''}">
                    <div class="slips-section-head">
                        <h3 class="slips-chunk-title">فوج ${entry.groupNum}</h3>
                        <div class="slips-section-meta">
                            <span>العدد: ${students.length}</span>
                            ${roomText ? `<span>القاعة: ${escapeHtml(roomText)}</span>` : ''}
                        </div>
                    </div>
                    <div class="slips-grid">${cardsHtml}</div>
                </section>
            `;
        });
    }

    const css = `
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        body {
            font-family: "Cairo","Tajawal","Segoe UI",Tahoma,sans-serif;
            margin: 0;
            padding: 10mm;
            background: #eef2f7;
            color: #0f172a;
        }
        .slips-chunk {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .slips-chunk + .slips-chunk {
            margin-top: 18px;
        }
        .slips-section-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 4px;
        }
        .slips-chunk-title {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 900;
            color: #0f172a;
        }
        .slips-section-meta {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            color: #475569;
            font-size: 0.8rem;
            font-weight: 700;
        }
        .slips-section-meta span {
            background: var(--card-bg)fff;
            border: 1px solid #dbe2ea;
            border-radius: 999px;
            padding: 4px 10px;
        }
        .slips-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 10px;
        }
        .slip-card {
            position: relative;
            width: 100%;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .slip-card-shell {
            position: relative;
            min-height: 150px;
            border-radius: 8px;
            border: 1px solid #94a3b8;
            background: var(--card-bg)fff;
            overflow: hidden;
            box-shadow: none;
            padding: 8px;
        }
        .slip-card-shell::before {
            content: "";
            position: absolute;
            inset: 0 auto 0 0;
            width: 4px;
            background: var(--slip-accent);
        }
        .slip-header {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 6px;
            margin-bottom: 6px;
        }
        .slip-header-copy {
            min-width: 0;
            padding-left: 2px;
        }
        .slip-overline {
            font-size: 0.75rem;
            font-weight: 800;
            color: #000;
            margin-bottom: 2px;
        }
        .slip-title {
            font-size: 0.85rem;
            line-height: 1.25;
            font-weight: 800;
            color: #000;
        }
        .slip-number-badge {
            flex-shrink: 0;
            min-width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            color: #000;
            font-size: 0.9rem;
            font-weight: 900;
        }
        .slip-identity {
            position: relative;
            z-index: 1;
            margin-bottom: 6px;
        }
        .slip-student-name {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 900;
            line-height: 1.2;
            color: #000;
            text-align: center;
        }
        .slip-details-grid {
            position: relative;
            z-index: 1;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 2px 4px;
        }
        .slip-detail-card {
            min-height: 34px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 4px 6px;
            background: var(--card-bg);
        }
        .slip-detail-strong {
            background: #f8fafc;
        }
        .slip-detail-wide {
            grid-column: 1 / -1;
        }
        .slip-detail-label {
            font-size: 0.65rem;
            color: #000;
            font-weight: 800;
            margin-bottom: 1px;
        }
        .slip-detail-value {
            font-size: 0.82rem;
            color: #000;
            font-weight: 900;
            line-height: 1.15;
            word-break: break-word;
        }
        @media print {
            @page {
                size: A4;
                margin: 8mm;
            }
            html, body {
                background: var(--card-bg) !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .no-print {
                display: none !important;
            }
            .slips-chunk.page-break-before {
                break-before: page;
                page-break-before: always;
            }
            .slips-section-head {
                margin-bottom: 4mm !important;
            }
            .slips-chunk-title {
                font-size: 13pt !important;
            }
            .slips-section-meta {
                font-size: 8pt !important;
            }
            .slips-grid {
                grid-template-columns: repeat(${printColumns}, ${slipW}mm) !important;
                justify-content: center !important;
                gap: 3mm !important;
            }
            .slip-card {
                width: ${slipW}mm !important;
            }
            .slip-card-shell {
                min-height: ${slipH}mm !important;
                height: ${slipH}mm !important;
                border: 1px solid #94a3b8 !important;
                border-radius: 2mm !important;
                padding: 2.2mm 2.2mm 2mm 3mm !important;
            }
            .slip-card-shell::before {
                width: 1.8mm !important;
            }
            .slip-title {
                font-size: 8.5pt !important;
            }
            .slip-overline {
                font-size: 8pt !important;
            }
            .slip-number-badge {
                min-width: 9mm !important;
                height: 9mm !important;
                font-size: 10pt !important;
                border-radius: 1mm !important;
            }
            .slip-student-name {
                font-size: 13pt !important;
                margin-bottom: 1.5mm !important;
            }
            .slip-details-grid {
                gap: 0.5mm 1.5mm !important;
            }
            .slip-detail-card {
                min-height: 8.5mm !important;
                border-radius: 1mm !important;
                padding: 1.5mm 2mm !important;
            }
            .slip-detail-label {
                font-size: 7.5pt !important;
            }
            .slip-detail-value {
                font-size: 9.5pt !important;
            }
        }
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(
        '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طباعة قصاصات الاختبار</title>' +
        '<style>' + css + '</style>' +
        (window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : '') +
        '</head><body>' +
        (window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : '') +
        allContent +
        (window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : '') +
        '</body></html>'
    );
    printWindow.document.close();
}

async function showPrintOptions() {
    if (blockTrialPrint()) return;
    const result = await Swal.fire({
        title: 'طباعة قوائم التلاميذ',
        text: 'اختر نوع القائمة التي ترغب في طباعتها:',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'قوائم الأفواج',
        denyButtonText: 'القائمة الكلية',
        cancelButtonText: 'إلغاء',
        showDenyButton: true,
        confirmButtonColor: '#3b82f6',
        denyButtonColor: '#8b5cf6',
        cancelButtonColor: '#64748b'
    });

    if (result.isConfirmed) {
        // Show sort order selection dialog before printing group lists
        const sortResult = await Swal.fire({
            title: 'ترتيب قوائم الأفواج',
            html: `
                <div style="text-align: right; direction: rtl; font-family: inherit;">
                    <div style="background: linear-gradient(135deg, #eff6ff, #f8fafc); border: 1px solid #dbeafe; border-radius: 16px; padding: 14px; margin-bottom: 16px;">
                        <div style="font-size: 0.95rem; font-weight: 900; color: #0f172a; margin-bottom: 4px;">اختر طريقة ترتيب التلاميذ داخل كل فوج</div>
                        <div style="font-size: 0.82rem; color: #475569; line-height: 1.6;">سيتم تطبيق الترتيب المختار على جميع الأفواج عند الطباعة.</div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <label style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 2px solid #22c55e; border-radius: 12px; cursor: pointer; background: #f0fdf4; font-weight: 700; transition: all 0.2s;" id="sortLabel_default">
                            <input type="radio" name="sortOrder" value="default" checked style="width: 18px; height: 18px; accent-color: #22c55e;">
                            <div>
                                <div style="font-size: 0.95rem; color: #15803d;"><i class="fas fa-list-ol" style="margin-left: 6px;"></i>ترتيب افتراضي</div>
                                <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">الترتيب الحالي كما هو في الجدول</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 2px solid #cbd5e1; border-radius: 12px; cursor: pointer; background: #fff; font-weight: 700; transition: all 0.2s;" id="sortLabel_last_name">
                            <input type="radio" name="sortOrder" value="last_name" style="width: 18px; height: 18px; accent-color: #3b82f6;">
                            <div>
                                <div style="font-size: 0.95rem; color: #1e40af;"><i class="fas fa-sort-alpha-down" style="margin-left: 6px;"></i>حسب اللقب</div>
                                <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">ترتيب أبجدي حسب لقب التلميذ</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 2px solid #cbd5e1; border-radius: 12px; cursor: pointer; background: #fff; font-weight: 700; transition: all 0.2s;" id="sortLabel_first_name">
                            <input type="radio" name="sortOrder" value="first_name" style="width: 18px; height: 18px; accent-color: #8b5cf6;">
                            <div>
                                <div style="font-size: 0.95rem; color: #6d28d9;"><i class="fas fa-sort-alpha-down" style="margin-left: 6px;"></i>حسب الاسم</div>
                                <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">ترتيب أبجدي حسب اسم التلميذ</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 2px solid #cbd5e1; border-radius: 12px; cursor: pointer; background: #fff; font-weight: 700; transition: all 0.2s;" id="sortLabel_average">
                            <input type="radio" name="sortOrder" value="average" style="width: 18px; height: 18px; accent-color: #f59e0b;">
                            <div>
                                <div style="font-size: 0.95rem; color: #b45309;"><i class="fas fa-chart-line" style="margin-left: 6px;"></i>حسب المعدل</div>
                                <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">ترتيب تنازلي حسب معدل التلميذ</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 2px solid #cbd5e1; border-radius: 12px; cursor: pointer; background: #fff; font-weight: 700; transition: all 0.2s;" id="sortLabel_alternating_gender">
                            <input type="radio" name="sortOrder" value="alternating_gender" style="width: 18px; height: 18px; accent-color: #ec4899;">
                            <div>
                                <div style="font-size: 0.95rem; color: #be185d;"><i class="fas fa-venus-mars" style="margin-left: 6px;"></i>ترتيب متناوب (ذكر / أنثى)</div>
                                <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">تناوب بين الذكور والإناث: ذكر ثم أنثى ثم ذكر...</div>
                            </div>
                        </label>
                    </div>
                </div>
            `,
            width: 520,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-print"></i> طباعة',
            cancelButtonText: 'رجوع',
            confirmButtonColor: '#3b82f6',
            cancelButtonColor: '#64748b',
            didOpen: () => {
                const colorMap = {
                    'default':             { border: '#22c55e', bg: '#f0fdf4' },
                    'last_name':           { border: '#3b82f6', bg: '#eff6ff' },
                    'first_name':          { border: '#8b5cf6', bg: '#f5f3ff' },
                    'average':             { border: '#f59e0b', bg: '#fffbeb' },
                    'alternating_gender':  { border: '#ec4899', bg: '#fdf2f8' }
                };
                const radios = document.querySelectorAll('input[name="sortOrder"]');
                const updateStyles = () => {
                    radios.forEach(radio => {
                        const label = document.getElementById('sortLabel_' + radio.value);
                        if (!label) return;
                        const colors = colorMap[radio.value];
                        if (radio.checked) {
                            label.style.borderColor = colors.border;
                            label.style.background = colors.bg;
                        } else {
                            label.style.borderColor = '#cbd5e1';
                            label.style.background = '#fff';
                        }
                    });
                };
                radios.forEach(radio => radio.addEventListener('change', updateStyles));
            },
            preConfirm: () => {
                const checked = document.querySelector('input[name="sortOrder"]:checked');
                return checked ? checked.value : 'default';
            }
        });

        if (sortResult.isConfirmed) {
            printExamLists(sortResult.value || 'default');
        }
    } else if (result.isDenied) {
        printFullList();
    }
}



async function toggleTrimesterControls(enabled) {
    const controls = document.getElementById('trimesterControls');
    const select = document.getElementById('trimesterSelect');
    const yearSelect = document.getElementById('yearSelect');
    const currentYear = yearSelect ? yearSelect.value : null;

    if (enabled) {
        controls.style.opacity = '1';
        controls.style.pointerEvents = 'all';
        controls.style.filter = 'none';
    } else {
        controls.style.opacity = '0.4';
        controls.style.pointerEvents = 'none';
        controls.style.filter = 'grayscale(1)';
        // Reset select if disabled
        if (select) select.value = '';
    }

    if (enabled) {
        await ensureResultsYearSelection({ showFeedback: true });
    }

    const targetYear = yearSelect ? yearSelect.value : currentYear;
    await loadStudents(targetYear);
    populateFilters();
    checkStreamVisibility();
    updateStreamFilter();
    updateClassFilter();
    updateNumGroupsFromData();
    updateGroupFilterOptions();
    renderTable();
}

function getSortedAcademicYears(values) {
    return [...new Set(
        (values || [])
            .map(value => String(value == null ? '' : value).trim())
            .filter(Boolean)
    )].sort((a, b) => b.localeCompare(a));
}

async function getAvailableResultsYears() {
    const resultsData = await DB.getResults(true) || [];
    return getSortedAcademicYears(resultsData.map(r => (
        r.academic_year || r.schoolYear || r.school_year || r.year
    )));
}

async function ensureResultsYearSelection({ showFeedback = false } = {}) {
    const trimesterSelect = document.getElementById('trimesterSelect');
    const yearSelect = document.getElementById('yearSelect');

    if (!trimesterSelect || !yearSelect || trimesterSelect.value === '') {
        return false;
    }

    const availableYears = await getAvailableResultsYears();
    if (availableYears.length === 0) {
        if (showFeedback) {
            await Swal.fire({
                icon: 'warning',
                title: 'لا توجد نتائج',
                text: 'لا توجد أي نتائج محفوظة حاليًا حتى يتم اعتماد التفويج حسب النتائج.'
            });
        }
        return false;
    }

    const selectedYear = String(yearSelect.value || '').trim();
    if (selectedYear && availableYears.includes(selectedYear)) {
        return false;
    }

    const preferredCurrentYear = String(
        institutionSettings.schoolYear ||
        institutionSettings.currentAcademicYear ||
        ''
    ).trim();
    const fallbackYear = availableYears.includes(preferredCurrentYear)
        ? preferredCurrentYear
        : availableYears[0];

    if (!fallbackYear) {
        return false;
    }

    yearSelect.value = fallbackYear;

    if (showFeedback) {
        const message = selectedYear
            ? `لا توجد نتائج للسنة الدراسية ${selectedYear}. تم التحويل تلقائيًا إلى ${fallbackYear}.`
            : `تم اختيار السنة الدراسية ${fallbackYear} تلقائيًا لأنها تحتوي على نتائج متاحة.`;
        await Swal.fire({
            icon: 'info',
            title: 'تم تصحيح السنة الدراسية',
            text: message
        });
    }

    return true;
}

