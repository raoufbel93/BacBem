/**
 * Absence Tracking - Supervisors Tab React Components
 */

function SupervisorsTab() {
    const { state, dispatch } = useAbsence();
    const [searchQuery, setSearchQuery] = useState('');

    let filteredSupervisors = state.allSupervisors || [];
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filteredSupervisors = filteredSupervisors.filter(s => {
            const text = (s.name || s.id || '').toLowerCase();
            return text.includes(q);
        });
    }

    const toggleAbsence = (supId, isSelected) => {
        if (isSelected) {
            const updated = { ...state.selectedSupervisors };
            delete updated[supId];
            dispatch({ type: 'SET_DATA', payload: { selectedSupervisors: updated } });
        } else {
            const updated = { ...state.selectedSupervisors, [supId]: { period: 'FULL', reason: '' } };
            dispatch({ type: 'SET_DATA', payload: { selectedSupervisors: updated } });
        }
    };

    const updateSupervisorData = (supId, field, value) => {
        const currentData = state.selectedSupervisors[supId] || { period: 'FULL', reason: '' };
        
        let newData = { ...currentData };
        if (typeof currentData === 'string') {
            newData = { period: 'FULL', reason: currentData };
        }

        if (field === 'period' && value === 'PARTIAL' && !newData.from) {
            // Setup defaults for partial
            newData.from = '08:00';
            newData.to = '10:00';
            if (window.getScheduleForDate) {
                const sched = window.getScheduleForDate(state.date);
                if (sched && sched.am_from) {
                    newData.from = sched.am_from;
                    const h = parseInt(newData.from.split(':')[0]);
                    const m = newData.from.split(':')[1];
                    newData.to = `${String(h + 2).padStart(2, '0')}:${m}`;
                }
            }
        }

        newData[field] = value;
        dispatch({
            type: 'SET_DATA',
            payload: { selectedSupervisors: { ...state.selectedSupervisors, [supId]: newData } }
        });
    };

    const updateRole = (supId, newRole) => {
        // Since we cannot easily await DB here without side effects, we trigger the global function
        if (window.updateSupervisorRole) {
            window.updateSupervisorRole(supId, newRole).then(() => {
                // Refresh data if necessary, or just rely on global state update mechanism
                if (window.loadAllData) window.loadAllData();
            });
        }
    };

    const deleteSupervisor = (supId) => {
        if (window.deleteSupervisor) {
            window.deleteSupervisor(supId);
        }
    };

    const columns = [
        { id: 'index', name: '#', width: '50px' },
        { id: 'name', name: 'الاسم الكامل', width: '180px' },
        { 
            id: 'role', name: 'الوظيفة', width: '130px',
            render: (row) => e('select', {
                className: 'period-select',
                style: { width: '100%', boxSizing: 'border-box', minWidth: 0, padding: '5px', fontSize: '0.9rem' },
                value: row.role || 'supervisor',
                onChange: (e) => updateRole(row.id || row.name, e.target.value)
            }, 
                e('option', { value: 'supervisor' }, 'مشرف تربية'),
                e('option', { value: 'agent' }, 'عون مصلحة'),
                e('option', { value: '/' }, '/')
            )
        },
        { id: 'rank', name: 'الرتبة / السبب', width: '120px', render: row => row.rank || '-' },
        { 
            id: 'absent', name: 'غائب', width: '70px',
            render: (row) => {
                const supId = String(row.id || row.name);
                const isSelected = !!state.selectedSupervisors[supId];
                return e('input', {
                    type: 'checkbox',
                    className: 'absence-checkbox',
                    checked: isSelected,
                    onChange: () => toggleAbsence(supId, isSelected)
                });
            }
        },
        { 
            id: 'duration', name: 'المدة', width: '150px',
            render: (row) => {
                const supId = String(row.id || row.name);
                const isSelected = !!state.selectedSupervisors[supId];
                const rawData = state.selectedSupervisors[supId];
                
                let period = 'FULL';
                let from = '08:00', to = '10:00', lateDuration = '';
                
                if (rawData && typeof rawData === 'object') {
                    period = rawData.period || 'FULL';
                    from = rawData.from || from;
                    to = rawData.to || to;
                    lateDuration = rawData.lateDuration || '';
                }

                return e('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' } },
                    e('select', {
                        className: 'period-select',
                        style: { width: '100%', boxSizing: 'border-box', minWidth: 0, padding: '5px', fontSize: '0.9rem' },
                        disabled: !isSelected,
                        value: period,
                        onChange: (ev) => updateSupervisorData(supId, 'period', ev.target.value)
                    }, 
                        e('option', { value: 'FULL' }, 'يوم كامل'),
                        e('option', { value: 'AM' }, 'صباح'),
                        e('option', { value: 'PM' }, 'مساء'),
                        e('option', { value: 'PARTIAL' }, 'غياب جزئي'),
                        e('option', { value: 'LATE' }, 'تأخر')
                    ),
                    period === 'PARTIAL' && e('div', { style: { background: 'transparent', padding: '2px 0', width: '100%', boxSizing: 'border-box' } },
                        e('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px', fontSize: '0.8rem', width: '100%' } },
                            e('span', { style: { fontWeight: 600, fontSize: '0.75rem' } }, 'من:'),
                            e('input', { type: 'time', className: 'supervisor-time-select', value: from, onChange: ev => updateSupervisorData(supId, 'from', ev.target.value), style: { width: '75%', padding: '2px 4px', border: '1px solid #bdc3c7', borderRadius: '4px' } })
                        ),
                        e('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', width: '100%' } },
                            e('span', { style: { fontWeight: 600, fontSize: '0.75rem' } }, 'إلى:'),
                            e('input', { type: 'time', className: 'supervisor-time-select', value: to, onChange: ev => updateSupervisorData(supId, 'to', ev.target.value), style: { width: '75%', padding: '2px 4px', border: '1px solid #bdc3c7', borderRadius: '4px' } })
                        )
                    ),
                    period === 'LATE' && e('div', { style: { background: 'transparent', padding: '2px 0', width: '100%', boxSizing: 'border-box' } },
                        e('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', width: '100%' } },
                            e('span', { style: { fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' } }, 'المدة (د):'),
                            e('input', { type: 'number', className: 'supervisor-time-select', placeholder: 'د', value: lateDuration, onChange: ev => updateSupervisorData(supId, 'lateDuration', ev.target.value), style: { width: '60%', height: '24px', padding: '0 4px' } })
                        )
                    )
                );
            }
        },
        { 
            id: 'note', name: 'ملاحظات', width: '210px',
            render: (row) => {
                const supId = String(row.id || row.name);
                const isSelected = !!state.selectedSupervisors[supId];
                const rawData = state.selectedSupervisors[supId];
                const reason = rawData ? (typeof rawData === 'string' ? rawData : rawData.reason || '') : '';
                return e('input', {
                    type: 'text',
                    className: 'reason-select',
                    style: { width: '100%', boxSizing: 'border-box', minWidth: 0, padding: '5px', fontSize: '0.9rem' },
                    placeholder: 'السبب (اختياري)',
                    disabled: !isSelected,
                    value: reason,
                    onChange: (ev) => updateSupervisorData(supId, 'reason', ev.target.value)
                });
            }
        },
        {
            id: 'delete', name: 'حذف', width: '60px',
            render: (row) => e('button', {
                className: 'btn btn-danger btn-sm',
                onClick: () => deleteSupervisor(String(row.id || row.name))
            }, '🗑️')
        }
    ];

    const totalSupervisors = state.allSupervisors.length;
    const absentSupervisors = Object.keys(state.selectedSupervisors || {}).length;

    return e('div', { className: 'tab-content active', id: 'tab-supervisors-react' },
        e('div', { className: 'filter-row' },
            e('div', { className: 'search-box', style: { width: '100%', maxWidth: '400px' } },
                e('input', { 
                    type: 'text', 
                    placeholder: 'بحث عن مشرف أو إداري...', 
                    value: searchQuery, 
                    onChange: e => setSearchQuery(e.target.value) 
                })
            ),
            e('div', { style: { marginRight: 'auto', display: 'flex', gap: '10px' } },
                e('button', { className: 'btn btn-success', onClick: () => dispatch({ type: 'OPEN_MODAL', payload: { modalName: 'addSupervisor' } }) }, '➕ إضافة مشرف/إداري يدوياً'),
                e('button', { className: 'btn btn-outline', onClick: () => dispatch({ type: 'OPEN_MODAL', payload: { modalName: 'supervisorStats' } }) }, '📊 إحصائيات المشرفين')
            )
        ),
        e('div', { className: 'stats-bar' },
            e('div', { className: 'stat-badge primary-stat' }, e('span', null, '👔 إجمالي المشرفين:'), e('span', null, totalSupervisors)),
            e('div', { className: 'stat-badge danger-stat' }, e('span', null, '❌ الغائبون:'), e('span', null, absentSupervisors))
        ),
        filteredSupervisors.length === 0 ? 
            e('div', { style: { padding: '20px', textAlign: 'center', color: '#999' } },
                e('div', { style: { fontSize: '2.5rem', marginBottom: '10px', opacity: 0.5 } }, '👔'),
                e('p', null, 'لا يوجد مشرفين/إداريين. استورد من Excel أو أضف يدوياً.')
            )
            : e(DataTable, { columns, data: filteredSupervisors.map((s, i) => ({ ...s, index: i + 1 })), pageSize: 20 })
    );
}
