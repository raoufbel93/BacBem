/**
 * Absence Tracking - Students Tab React Components (Performance Optimized)
 */

// ==================== PAGINATION & DATATABLE ====================

const Pagination = React.memo(function Pagination({ currentPage, totalPages, onPageChange }) {
    if (totalPages <= 1) return null;
    return e('div', { className: 'pagination-controls' },
        e('button', { 
            className: 'page-btn', 
            disabled: currentPage === 1,
            onClick: () => onPageChange(currentPage - 1)
        }, 'السابق'),
        e('span', { className: 'page-info' }, `صفحة ${currentPage} من ${totalPages}`),
        e('button', { 
            className: 'page-btn', 
            disabled: currentPage === totalPages,
            onClick: () => onPageChange(currentPage + 1)
        }, 'التالي')
    );
});

// Row component for better memoization
const TableRow = React.memo(function TableRow({ row, rowIndex, columns, startIndex }) {
    return e('tr', { className: row.className || '' },
        columns.map((col, colIndex) => {
            const cellContent = col.render ? col.render(row, startIndex + rowIndex) : row[col.id];
            return e('td', { key: colIndex }, cellContent);
        })
    );
}, (prevProps, nextProps) => {
    // Only re-render if className (selection state) changes or row id changes
    return prevProps.row.className === nextProps.row.className && prevProps.row.id === nextProps.row.id;
});

const DataTable = React.memo(function DataTable({ columns, data, pageSize = 50 }) {
    const [page, setPage] = useState(1);
    
    // Reset page if data length changes drastically (filter changed)
    useEffect(() => {
        setPage(1);
    }, [data.length]);

    const totalPages = Math.ceil(data.length / pageSize) || 1;
    // Fix page if it exceeds totalPages
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    const startIndex = (page - 1) * pageSize;
    const pageData = data.slice(startIndex, startIndex + pageSize);

    return e('div', null,
        e('div', { className: 'table-wrapper' },
            e('table', { className: 'absence-table' },
                e('thead', { className: 'thead-light' },
                    e('tr', null, columns.map((col, i) => 
                        e('th', { key: i, style: { width: col.width } }, col.name)
                    ))
                ),
                e('tbody', null, 
                    pageData.length === 0 ? e('tr', null, e('td', { colSpan: columns.length, style: { padding: '20px', color: '#999' } }, 'لا توجد بيانات')) :
                    pageData.map((row, rowIndex) => {
                        return e(TableRow, { 
                            key: row.id || rowIndex, 
                            row, 
                            rowIndex, 
                            columns, 
                            startIndex 
                        });
                    })
                )
            )
        ),
        e(Pagination, { currentPage: page, totalPages, onPageChange: setPage })
    );
});

// ==================== HELPERS ====================

function normalizeAcademicLevel(levelValue) {
    if (window.AppAcademic && typeof window.AppAcademic.getCanonicalLevel === 'function') {
        return window.AppAcademic.getCanonicalLevel(levelValue) || '';
    }
    return levelValue == null ? '' : String(levelValue).trim();
}

function formatAcademicLevel(levelValue, isSecondary) {
    if (window.AppAcademic && typeof window.AppAcademic.formatLevel === 'function') {
        return window.AppAcademic.formatLevel(levelValue, isSecondary ? 'secondary' : 'middle');
    }
    return normalizeAcademicLevel(levelValue);
}

function matchLevel(studentLvl, selectedLvl) {
    if (!studentLvl || !selectedLvl) return false;
    return normalizeAcademicLevel(studentLvl) === normalizeAcademicLevel(selectedLvl);
}

function getShortStreamName(streamName) {
    if (!streamName) return '';
    const map = {
        'جذع مشترك علوم وتكنولوجيا': 'ج.م.ع.ت', 'common_science': 'ج.م.ع.ت',
        'جذع مشترك آداب': 'ج.م.آ', 'common_arts': 'ج.م.آ',
        'علوم تجريبية': 'ع.تجريبية', 'science': 'ع.تجريبية',
        'تسيير واقتصاد': 'ت.إقتصاد', 'management': 'ت.إقتصاد',
        'تقني رياضي': 'ت.رياضي', 'math_tech': 'ت.رياضي', 'tech_math': 'ت.رياضي',
        'tech_math_electrical': 'ت.رياضي', 'tech_math_elec': 'ت.رياضي',
        'tech_math_mechanical': 'ت.رياضي', 'tech_math_mech': 'ت.رياضي',
        'tech_math_civil': 'ت.رياضي', 'tech_math_civ': 'ت.رياضي',
        'tech_math_ge': 'ت.رياضي', 'tech_math_methods': 'ت.رياضي', 'tech_math_proc': 'ت.رياضي',
        'رياضيات': 'رياضيات', 'math': 'رياضيات',
        'لغات أجنبية': 'ل.أجنبية', 'languages': 'ل.أجنبية',
        'آداب وفلسفة': 'آ.فلسفة', 'literature': 'آ.فلسفة', 'arts': 'آ.فلسفة',
        'sport': 'رياضة'
    };
    return map[streamName] || streamName;
}

// Generate time options logic
function getPeriodTimes(period, customStart, customEnd, includeNextHour = false, appSettings = {}) {
    let times = ['Present'];
    let startH, startM, endH;

    if (customStart === '') return times;

    if (customStart && customStart !== '-' && customStart.includes(':')) {
        const parts = customStart.split(':');
        startH = parseInt(parts[0]);
        startM = parts[1];
    } else if (period === 'AM') {
        startH = appSettings.morningEntryTime ? parseInt(appSettings.morningEntryTime.split(':')[0]) : 8;
        startM = appSettings.morningEntryTime ? appSettings.morningEntryTime.split(':')[1] : '00';
    } else {
        startH = appSettings.eveningEntryTime ? parseInt(appSettings.eveningEntryTime.split(':')[0]) : 13;
        startM = appSettings.eveningEntryTime ? appSettings.eveningEntryTime.split(':')[1] : '00';
    }

    if (customEnd && customEnd !== '-' && customEnd.includes(':')) {
        endH = parseInt(customEnd.split(':')[0]);
    } else {
        const defaultDuration = period === 'AM' ? 4 : 3;
        endH = startH + defaultDuration;
    }

    if (endH < startH) endH = startH + (period === 'AM' ? 4 : 3);
    const loopEndH = includeNextHour ? (endH + 1) : endH;

    for (let h = startH; h <= loopEndH; h++) {
        times.push(`${String(h).padStart(2, '0')}:${startM}`);
    }

    return times;
}

// ==================== SUB-COMPONENTS ====================

const TimeSelect = React.memo(function TimeSelect({ value, options, onChange }) {
    return e('select', { 
        className: 'time-select', 
        value: value, 
        onChange: (e) => onChange(e.target.value) 
    }, options.map(opt => e('option', { key: opt, value: opt }, opt === 'Present' ? 'حاضر' : opt)));
});

const AbsenceDetails = React.memo(function AbsenceDetails({ isSelected, dataState, studentId, onUpdate, appSettings, schedule }) {
    const detailsStyle = isSelected
        ? { maxHeight: '150px', opacity: 1, marginTop: '5px', overflow: 'visible' }
        : { maxHeight: '0', opacity: 0, overflow: 'hidden', margin: 0, padding: 0 };

    // Options generation
    const getOpts = (period, val, isEnd) => {
        let customStart = null, customEnd = null;
        if (schedule) {
            if (period === 'AM') { customStart = schedule.am_from; customEnd = schedule.am_to; }
            else if (period === 'PM') { customStart = schedule.pm_from; customEnd = schedule.pm_to; }
        }
        let times = getPeriodTimes(period, customStart, customEnd, isEnd, appSettings);
        if (val && val !== 'Present' && val !== '-' && !times.includes(val)) {
            const hasPresent = times.includes('Present');
            times = times.filter(t => t !== 'Present');
            times.push(val);
            times.sort();
            if (hasPresent) times.unshift('Present');
        }
        return times;
    };

    return e('div', null,
        e('div', { className: 'absence-details', style: detailsStyle },
            e('div', { className: 'time-input-container' },
                e('div', { className: 'time-input-group' },
                    e('span', { className: 'time-label' }, 'من'),
                    e(TimeSelect, { value: dataState.am.from, options: getOpts('AM', dataState.am.from, false), onChange: (v) => onUpdate('am', { ...dataState.am, from: v }) })
                ),
                e('div', { className: 'time-input-group' },
                    e('span', { className: 'time-label' }, 'إلى'),
                    e(TimeSelect, { value: dataState.am.to, options: getOpts('AM', dataState.am.to, true), onChange: (v) => onUpdate('am', { ...dataState.am, to: v }) })
                )
            )
        ),
        e('div', { className: 'absence-details', style: detailsStyle },
            e('div', { className: 'time-input-container' },
                e('div', { className: 'time-input-group' },
                    e('span', { className: 'time-label' }, 'من'),
                    e(TimeSelect, { value: dataState.pm.from, options: getOpts('PM', dataState.pm.from, false), onChange: (v) => onUpdate('pm', { ...dataState.pm, from: v }) })
                ),
                e('div', { className: 'time-input-group' },
                    e('span', { className: 'time-label' }, 'إلى'),
                    e(TimeSelect, { value: dataState.pm.to, options: getOpts('PM', dataState.pm.to, true), onChange: (v) => onUpdate('pm', { ...dataState.pm, to: v }) })
                )
            )
        ),
        e('div', { className: 'absence-details', style: detailsStyle },
            e('input', { 
                type: 'text', 
                className: 'reason-select', 
                value: dataState.reason || '', 
                placeholder: 'اكتب ملاحظة...',
                onChange: (e) => onUpdate('reason', e.target.value)
            })
        )
    );
});

// ==================== MAIN TAB ====================

function StudentsTab() {
    const { state, dispatch } = useAbsence();
    const { getScheduleForDate, calculateConsecutiveDays } = useGlobalAbsenceLogic();
    const [allAbsences, setAllAbsences] = useState([]);

    // Load past absences for streak calculation once
    useEffect(() => {
        if (typeof DB !== 'undefined' && DB.getAllAbsencesExport) {
            DB.getAllAbsencesExport().then(records => {
                records.sort((a, b) => b.date.localeCompare(a.date));
                setAllAbsences(records);
            });
        }
    }, []);

    const isSecondary = state.appSettings?.educationStage === 'secondary';

    // Filters logic
    const handleFilterChange = useCallback((filterType, value) => {
        dispatch({ type: 'SET_FILTER', filterType, value });
    }, [dispatch]);

    // Calculate dynamic lists for filters
    const levels = useMemo(() => {
        return window.AppAcademic && typeof window.AppAcademic.getLevelOptionsByStage === 'function'
            ? window.AppAcademic.getLevelOptionsByStage(isSecondary ? 'secondary' : 'middle')
            : [];
    }, [isSecondary]);
    
    // Memoized Filtered Students
    const filteredStudents = useMemo(() => {
        let students = state.allStudents;
        
        if (state.levelFilter) {
            students = students.filter(s => matchLevel(s.level, state.levelFilter));
        }
        
        if (state.streamFilter) {
            if (state.streamFilter === 'tech_math') {
                students = students.filter(s => s.stream === 'tech_math' || (s.stream && s.stream.startsWith('tech_math_')));
            } else {
                students = students.filter(s => s.stream === state.streamFilter);
            }
        }
        
        if (state.classFilter) {
            students = students.filter(s => String(s.class) === String(state.classFilter));
        }

        if (state.searchQuery) {
            const q = state.searchQuery.toLowerCase();
            students = students.filter(s => `${s.last_name} ${s.first_name}`.toLowerCase().includes(q));
        }

        if (state.consecutiveFilter && parseInt(state.consecutiveFilter) > 0) {
            const minDays = parseInt(state.consecutiveFilter);
            students = students.filter(s => {
                const studentId = String(s.id || `${s.last_name}-${s.first_name}`);
                const isSelected = !!state.selectedStudents[studentId];
                const streak = calculateConsecutiveDays(studentId, state.date, allAbsences, isSelected);
                return streak >= minDays;
            });
        }
        
        return students;
    }, [state.allStudents, state.levelFilter, state.streamFilter, state.classFilter, state.searchQuery, state.consecutiveFilter, state.selectedStudents, state.date, allAbsences, calculateConsecutiveDays]);

    const availableStreams = useMemo(() => {
        return (isSecondary && state.levelFilter && typeof SubjectManager !== 'undefined') ? SubjectManager.getStreams(state.levelFilter) : [];
    }, [isSecondary, state.levelFilter]);

    const classes = useMemo(() => {
        return [...new Set(filteredStudents.map(s => s.class))].filter(Boolean).sort((a, b) => {
            const numA = parseInt(a), numB = parseInt(b);
            return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : String(a).localeCompare(String(b));
        });
    }, [filteredStudents]);

    // Action Handlers
    const schedule = useMemo(() => getScheduleForDate(state.date), [state.date, getScheduleForDate]);

    const toggleStudent = useCallback((studentId, isSelected) => {
        if (isSelected) {
            // Uncheck
            const updated = { ...state.selectedStudents };
            delete updated[studentId];
            dispatch({ type: 'SET_DATA', payload: { selectedStudents: updated } });
        } else {
            // Check with defaults
            let amF = '08:00', amT = '12:00', pmF = '13:00', pmT = '17:00';
            if (schedule) {
                amF = schedule.am_from || amF; amT = schedule.am_to || amT;
                pmF = schedule.pm_from !== '' ? schedule.pm_from : '-';
                pmT = schedule.pm_to !== '' ? schedule.pm_to : '-';
                if (schedule.am_from === '') amF = '-';
                if (schedule.am_to === '') amT = '-';
            }
            dispatch({ 
                type: 'UPDATE_STUDENT_SELECTION', 
                payload: { 
                    [studentId]: { am: { from: amF, to: amT }, pm: { from: pmF, to: pmT }, reason: '', confirmed: true } 
                } 
            });
        }
    }, [dispatch, state.selectedStudents, schedule]);

    const updateStudentData = useCallback((studentId, field, value) => {
        const current = state.selectedStudents[studentId];
        if (current) {
            dispatch({
                type: 'UPDATE_STUDENT_SELECTION',
                payload: { [studentId]: { ...current, [field]: value } }
            });
        }
    }, [dispatch, state.selectedStudents]);

    // Prepare Table Columns (Memoized to prevent unnecessary prop changes for DataTable)
    const columns = useMemo(() => {
        const cols = [
            { id: 'index', name: '#', width: '60px' },
            { 
                id: 'last_name', name: 'اللقب', width: '150px',
                render: (row) => e('span', { style: { cursor: 'pointer', color: '#2980b9', fontWeight: 'bold' } }, row.last_name)
            },
            { 
                id: 'first_name', name: 'الاسم', width: '150px',
                render: (row) => e('span', { style: { cursor: 'pointer', color: '#2980b9', fontWeight: 'bold' } }, row.first_name)
            },
            { id: 'level', name: 'المستوى', width: '120px' }
        ];

        if (isSecondary) {
            cols.push({
                id: 'stream', name: 'الشعبة', width: '120px',
                render: (row) => {
                    const s = row.stream;
                    if (s && (['tech_math_civil', 'tech_math_elec', 'tech_math_methods', 'tech_math_mech'].includes(s) || s.startsWith('tech_math'))) return 'ت.رياضي';
                    return getShortStreamName(s);
                }
            });
        }

        cols.push({ id: 'class', name: 'القسم', width: '80px' });
        
        // Custom Checkbox + Return Button Cell
        cols.push({
            id: 'action', name: 'غائب', width: '150px',
            render: (row) => {
                const studentId = String(row.id || `${row.last_name}-${row.first_name}`);
                const isSelected = !!state.selectedStudents[studentId];
                return e('div', { style: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' } },
                    e('input', {
                        type: 'checkbox',
                        className: 'absence-checkbox',
                        style: { transform: 'scale(1.2)', cursor: 'pointer' },
                        checked: isSelected,
                        onChange: () => toggleStudent(studentId, isSelected)
                    }),
                    isSelected && e('button', {
                        className: 'btn btn-sm return-btn',
                        style: { background: '#e74c3c', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' },
                        onClick: () => toggleStudent(studentId, true),
                        title: 'إلغاء الغياب'
                    }, '🔄 العودة')
                );
            }
        });

        cols.push({
            id: 'streak', name: 'أيام متتالية', width: '110px',
            render: (row) => {
                const studentId = String(row.id || `${row.last_name}-${row.first_name}`);
                const isSelected = !!state.selectedStudents[studentId];
                const count = calculateConsecutiveDays(studentId, state.date, allAbsences, isSelected);
                return e('div', { style: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' } },
                    e('div', { className: `streak-badge streak-badge-${studentId}` },
                        count > 0 ? e('span', { style: { fontWeight: 'bold', color: 'red', fontSize: '0.85rem' } }, count) : '0'
                    )
                );
            }
        });

        // Time Pickers + Note
        cols.push({
            id: 'details', name: 'التفاصيل', width: '380px',
            render: (row) => {
                const studentId = String(row.id || `${row.last_name}-${row.first_name}`);
                const isSelected = !!state.selectedStudents[studentId];
                const dataState = state.selectedStudents[studentId] || { am: { from: '08:00', to: '12:00' }, pm: { from: '13:00', to: '17:00' }, reason: '' };
                return e(AbsenceDetails, { isSelected, dataState, studentId, onUpdate: updateStudentData, appSettings: state.appSettings, schedule });
            }
        });
        
        return cols;
    }, [isSecondary, state.selectedStudents, state.date, allAbsences, calculateConsecutiveDays, toggleStudent, updateStudentData, state.appSettings, schedule]);

    // Stats (Memoized to prevent unnecessary calculations)
    const { totalStudents, absentCount, presentCount } = useMemo(() => {
        const total = filteredStudents.length;
        const absent = Object.keys(state.selectedStudents).filter(id => filteredStudents.some(s => String(s.id || `${s.last_name}-${s.first_name}`) === id)).length;
        return { totalStudents: total, absentCount: absent, presentCount: total - absent };
    }, [filteredStudents, state.selectedStudents]);

    // Map table data with selection className
    const tableData = useMemo(() => {
        return filteredStudents.map((s, i) => ({ 
            ...s, 
            index: i + 1, 
            className: state.selectedStudents[String(s.id || `${s.last_name}-${s.first_name}`)] ? 'selected' : '' 
        }));
    }, [filteredStudents, state.selectedStudents]);

    return e('div', { className: 'tab-content active', id: 'tab-students-react' },
        e('div', { className: 'filter-row' },
            e('select', { className: 'filter-select', value: state.levelFilter, onChange: e => handleFilterChange('levelFilter', e.target.value) },
                e('option', { value: '' }, '-- اختر المستوى --'),
                levels.map(l => e('option', { key: l.value, value: l.value }, l.label))
            ),
            isSecondary && e('select', { className: 'filter-select', style: { display: state.levelFilter ? 'inline-block' : 'none' }, value: state.streamFilter, onChange: e => handleFilterChange('streamFilter', e.target.value) },
                e('option', { value: '' }, '-- اختر الشعبة --'),
                availableStreams.map(s => e('option', { key: s, value: s }, typeof SubjectManager !== 'undefined' ? SubjectManager.getStreamName(s) : s))
            ),
            e('select', { className: 'filter-select', value: state.classFilter, onChange: e => handleFilterChange('classFilter', e.target.value) },
                e('option', { value: '' }, '-- اختر القسم --'),
                classes.map(c => e('option', { key: c, value: c }, c))
            ),
            e('select', { className: 'filter-select', value: state.consecutiveFilter, onChange: e => handleFilterChange('consecutiveFilter', e.target.value) },
                e('option', { value: '' }, '-- فلترة الأيام المتتالية --'),
                e('option', { value: '1' }, 'يوم واحد فأكثر'),
                e('option', { value: '2' }, 'يومان متتاليان'),
                e('option', { value: '3' }, '3 أيام متتالية فأكثر'),
                e('option', { value: '7' }, 'أسبوع (7 أيام) فأكثر')
            ),
            e('div', { className: 'search-box' },
                e('input', { type: 'text', placeholder: 'بحث بالاسم أو اللقب...', value: state.searchQuery, onChange: e => handleFilterChange('searchQuery', e.target.value) })
            )
        ),
        e('div', { className: 'stats-bar' },
            e('div', { style: { marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' } },
                e('button', { className: 'btn btn-info', style: { backgroundColor: '#00b894', color: 'white', border: '1px solid #00a8ff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }, onClick: () => dispatch({ type: 'OPEN_MODAL', payload: { modalName: 'importAbsences' } }) }, '⏪ استيراد غيابات سابقة'),
                e('button', { className: 'btn btn-outline', style: { backgroundColor: '#ecf0f1', border: '1px solid #ced4da', color: 'var(--primary-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } }, '⚙️ الإعدادات'),
                e('button', { className: 'btn btn-warning', style: { backgroundColor: '#f39c12', color: 'white', border: '1px solid #e67e22', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }, onClick: () => dispatch({ type: 'OPEN_MODAL', payload: { modalName: 'savedAbsences' } }) }, '📋 سجل الغيابات')
            ),
            e('div', { className: 'stat-badge primary-stat' }, e('span', null, '👥 إجمالي التلاميذ:'), e('span', null, totalStudents)),
            e('div', { className: 'stat-badge danger-stat' }, e('span', null, '❌ الغائبون:'), e('span', null, absentCount)),
            e('div', { className: 'stat-badge success-stat' }, e('span', null, '✅ الحاضرون:'), e('span', null, presentCount))
        ),
        e(DataTable, { columns, data: tableData })
    );
}
