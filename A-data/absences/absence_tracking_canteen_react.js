/**
 * Absence Tracking - Canteen Tab React Components
 */

function getCanonicalLevel(levelValue) {
    if (window.AppAcademic && typeof window.AppAcademic.getCanonicalLevel === 'function') {
        return window.AppAcademic.getCanonicalLevel(levelValue) || '';
    }
    return levelValue == null ? '' : String(levelValue).trim();
}

function formatLevelLabel(levelValue, stage, includeStageLabel) {
    if (window.AppAcademic && typeof window.AppAcademic.formatLevel === 'function') {
        return window.AppAcademic.formatLevel(levelValue, stage || 'middle', {
            includeStageLabel: includeStageLabel === true
        });
    }
    return getCanonicalLevel(levelValue);
}

function CanteenTab() {
    const { state, dispatch } = useAbsence();
    const [mode, setMode] = useState('tracking'); // 'tracking' or 'beneficiaries'
    
    // Local filters and states for UI
    const [searchQuery, setSearchQuery] = useState('');
    const [levelFilter, setLevelFilter] = useState('');
    
    // Daily Info state
    const [dailyInfo, setDailyInfo] = useState({ proposed: '', offered: '', notes: '' });

    // Load Daily Info whenever date changes
    useEffect(() => {
        if (typeof DB !== 'undefined' && DB.get) {
            DB.get('canteenDailyInfo').then(data => {
                const info = (data || {})[state.date] || { proposed: '', offered: '', notes: '' };
                setDailyInfo(info);
            });
        }
    }, [state.date]);

    // Save Daily Info
    const updateDailyInfo = (field, value) => {
        const newInfo = { ...dailyInfo, [field]: value };
        setDailyInfo(newInfo);
        
        if (typeof DB !== 'undefined' && DB.get && DB.set) {
            DB.get('canteenDailyInfo').then(data => {
                const newData = { ...(data || {}), [state.date]: newInfo };
                DB.set('canteenDailyInfo', newData);
            });
        }
    };

    // Toggle Beneficiary
    const toggleBeneficiary = (studentId, isChecked) => {
        let nextBeneficiaries = [...(state.canteenBeneficiaries || [])];
        if (isChecked) {
            if (!nextBeneficiaries.includes(studentId)) nextBeneficiaries.push(studentId);
        } else {
            nextBeneficiaries = nextBeneficiaries.filter(id => id !== studentId);
        }
        
        dispatch({ type: 'SET_DATA', payload: { canteenBeneficiaries: nextBeneficiaries } });
        if (typeof DB !== 'undefined') DB.set('canteenBeneficiaries', nextBeneficiaries);
    };

    // Toggle Absence
    const toggleAbsence = (studentId, isChecked) => {
        let nextAbsences = { ...(state.canteenAbsences || {}) };
        let dateAbsences = nextAbsences[state.date] ? [...nextAbsences[state.date]] : [];
        
        if (isChecked) {
            if (!dateAbsences.includes(studentId)) dateAbsences.push(studentId);
        } else {
            dateAbsences = dateAbsences.filter(id => id !== studentId);
        }
        
        if (dateAbsences.length === 0) {
            delete nextAbsences[state.date];
        } else {
            nextAbsences[state.date] = dateAbsences;
        }
        
        dispatch({ type: 'SET_DATA', payload: { canteenAbsences: nextAbsences } });
        if (typeof DB !== 'undefined') DB.set('canteenAbsences', nextAbsences);
    };

    // Formatting helpers
    const getSafeStudentId = (student) => String(student.id || `${student.last_name}-${student.first_name}`);
    const isHalfBoard = (student) => {
        const status = String(student.status || '').toLowerCase();
        return status === 'half_board' || status.includes('نصف') || status.includes('demi');
    };
    const stageKey = state.appSettings && state.appSettings.educationStage === 'secondary' ? 'secondary' : 'middle';
    
    // Sort logic
    const sortStudents = (a, b) => {
        const valA = window.AppAcademic && typeof window.AppAcademic.getLevelRank === 'function'
            ? window.AppAcademic.getLevelRank(a.level)
            : 0;
        const valB = window.AppAcademic && typeof window.AppAcademic.getLevelRank === 'function'
            ? window.AppAcademic.getLevelRank(b.level)
            : 0;
        if (valA !== valB) return valA - valB;
        if ((a.stream || '') !== (b.stream || '')) return String(a.stream || '').localeCompare(String(b.stream || ''), 'ar');
        const classA = parseInt(a.class_name || a.class || 0, 10);
        const classB = parseInt(b.class_name || b.class || 0, 10);
        if (classA !== classB) return classA - classB;
        return String(a.last_name || '').localeCompare(String(b.last_name || ''), 'ar');
    };

    // Data Preparation
    let currentData = [];
    let columns = [];
    let totalCount = 0;
    
    if (mode === 'beneficiaries') {
        const query = searchQuery.trim().toLowerCase();
        currentData = state.allStudents.filter(s => isHalfBoard(s) && (s.first_name + ' ' + s.last_name).toLowerCase().includes(query));
        
        // Sort: checked first, then level/class
        currentData.sort((a, b) => {
            const idA = getSafeStudentId(a);
            const idB = getSafeStudentId(b);
            const benA = (state.canteenBeneficiaries || []).includes(idA);
            const benB = (state.canteenBeneficiaries || []).includes(idB);
            if (benA && !benB) return -1;
            if (!benA && benB) return 1;
            return sortStudents(a, b);
        });

        columns = [
            { id: 'index', name: '#', width: '60px' },
            { id: 'name', name: 'الاسم واللقب', width: '300px', render: r => e('strong', null, `${r.last_name || ''} ${r.first_name || ''}`) },
            { id: 'class', name: 'القسم', width: '150px', render: r => `${r.class || ''} ${formatLevelLabel(r.level, stageKey, false) || ''}` },
            { id: 'action', name: 'مستفيد', width: '100px', render: r => {
                const sId = getSafeStudentId(r);
                const isChecked = (state.canteenBeneficiaries || []).includes(sId);
                return e('input', { type: 'checkbox', className: 'absence-checkbox', checked: isChecked, onChange: e => toggleBeneficiary(sId, e.target.checked) });
            }}
        ];
        totalCount = (state.canteenBeneficiaries || []).length;
        
    } else {
        // Tracking Mode
        currentData = state.allStudents.filter(s => (state.canteenBeneficiaries || []).includes(getSafeStudentId(s)));
        
        if (levelFilter || searchQuery) {
            currentData = currentData.filter(s => {
                if (levelFilter) {
                    if (getCanonicalLevel(s.level) !== levelFilter) return false;
                }
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    const name1 = `${s.first_name} ${s.last_name}`.toLowerCase();
                    const name2 = `${s.last_name} ${s.first_name}`.toLowerCase();
                    if (!name1.includes(q) && !name2.includes(q)) return false;
                }
                return true;
            });
        }
        currentData.sort(sortStudents);
        
        columns = [
            { id: 'index', name: '#', width: '60px' },
            { id: 'name', name: 'الاسم واللقب', width: '300px', render: r => e('strong', null, `${r.last_name || ''} ${r.first_name || ''}`) },
            { id: 'class', name: 'القسم', width: '150px', render: r => `${r.class || ''} ${formatLevelLabel(r.level, stageKey, false) || ''}` },
            { id: 'action', name: 'غائب عن المطعم', width: '150px', render: r => {
                const sId = getSafeStudentId(r);
                const isChecked = ((state.canteenAbsences || {})[state.date] || []).includes(sId);
                return e('input', { type: 'checkbox', className: 'absence-checkbox', checked: isChecked, onChange: e => toggleAbsence(sId, e.target.checked) });
            }}
        ];
        totalCount = ((state.canteenAbsences || {})[state.date] || []).length;
    }

    return e('div', { className: 'tab-content active', id: 'tab-canteen-react' },
        e('div', { className: 'canteen-layout', style: { display: 'flex', gap: '20px', flexDirection: 'row', alignItems: 'flex-start' } },
            
            // Side Panel for Daily Info
            e('div', { className: 'canteen-sidebar', style: { flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: '15px' } },
                e('div', { className: 'canteen-controls', style: { background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e9ecef' } },
                    e('div', { style: { display: 'flex', gap: '10px', marginBottom: '15px' } },
                        e('button', { className: `btn ${mode === 'tracking' ? 'btn-primary' : 'btn-outline'}`, style: { flex: 1 }, onClick: () => setMode('tracking') }, '📊 متابعة الغيابات'),
                        e('button', { className: `btn ${mode === 'beneficiaries' ? 'btn-primary' : 'btn-outline'}`, style: { flex: 1 }, onClick: () => setMode('beneficiaries') }, '👥 تحديد المستفيدين')
                    )
                ),
                mode === 'tracking' && e('div', { className: 'canteen-daily-info', style: { background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' } },
                    e('h3', { style: { marginTop: 0, borderBottom: '2px solid #3498db', paddingBottom: '10px', color: '#2c3e50', fontSize: '1.1rem' } }, '📝 معلومات الوجبة اليومية'),
                    e('div', { className: 'form-group', style: { marginBottom: '15px' } },
                        e('label', { style: { display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#7f8c8d', fontSize: '0.9rem' } }, 'الوجبة المبرمجة:'),
                        e('input', { type: 'text', style: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }, placeholder: 'مثال: فاصولياء باللحم...', value: dailyInfo.proposed, onChange: e => updateDailyInfo('proposed', e.target.value) })
                    ),
                    e('div', { className: 'form-group', style: { marginBottom: '15px' } },
                        e('label', { style: { display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#7f8c8d', fontSize: '0.9rem' } }, 'الوجبة المقدمة فعلياً:'),
                        e('input', { type: 'text', style: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }, placeholder: 'مثال: عدس...', value: dailyInfo.offered, onChange: e => updateDailyInfo('offered', e.target.value) })
                    ),
                    e('div', { className: 'form-group', style: { marginBottom: '15px' } },
                        e('label', { style: { display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#7f8c8d', fontSize: '0.9rem' } }, 'ملاحظات حول المطعم:'),
                        e('textarea', { style: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '80px', resize: 'vertical' }, placeholder: 'ملاحظات حول جودة الوجبة، النظافة...', value: dailyInfo.notes, onChange: e => updateDailyInfo('notes', e.target.value) })
                    )
                )
            ),

            // Main Table Area
            e('div', { className: 'canteen-main', style: { flex: 1, minWidth: 0, background: 'white', borderRadius: '12px', border: '1px solid #e0e0e0', padding: '20px' } },
                e('div', { className: 'filter-row', style: { marginBottom: '20px' } },
                    mode === 'tracking' && e('select', { className: 'filter-select', value: levelFilter, onChange: e => setLevelFilter(e.target.value) },
                        e('option', { value: '' }, 'كل المستويات'),
                        (window.AppAcademic && typeof window.AppAcademic.getLevelOptionsByStage === 'function'
                            ? window.AppAcademic.getLevelOptionsByStage(stageKey)
                            : []
                        ).map(opt => e('option', { key: opt.value, value: opt.value }, opt.label))
                    ),
                    e('div', { className: 'search-box', style: { flex: 1 } },
                        e('input', { type: 'text', placeholder: 'بحث عن تلميذ...', value: searchQuery, onChange: e => setSearchQuery(e.target.value) })
                    ),
                    e('div', { className: `stat-badge ${mode === 'beneficiaries' ? 'primary-stat' : 'danger-stat'}`, style: { margin: 0 } },
                        e('span', null, mode === 'beneficiaries' ? 'عدد المستفيدين:' : '❌ غيابات المطعم:'),
                        e('span', { style: { fontWeight: 'bold', fontSize: '1.2rem', marginRight: '5px' } }, totalCount)
                    )
                ),
                
                currentData.length === 0 ? 
                    e('div', { style: { padding: '20px', textAlign: 'center', color: '#999' } },
                        e('div', { style: { fontSize: '2.5rem', marginBottom: '10px', opacity: 0.5 } }, mode === 'beneficiaries' ? 'ℹ️' : '🍴'),
                        e('p', null, mode === 'beneficiaries' ? 'لا يوجد تلاميذ بصفة "نصف داخلي"' : 'لم يتم تحديد أي مستفيدين من المطعم بعد.')
                    )
                : e(DataTable, { columns, data: currentData.map((d, i) => ({ ...d, index: i + 1 })), pageSize: 20 })
            )
        )
    );
}
