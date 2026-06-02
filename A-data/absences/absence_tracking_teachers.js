/**
 * Absence Tracking - Teachers Tab React Components
 */

function TeachersTab() {
    const { state, dispatch } = useAbsence();

    // Filters
    const [searchQuery, setSearchQuery] = useState('');

    let filteredTeachers = state.allTeachers || [];
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filteredTeachers = filteredTeachers.filter(t => {
            const fullName = `${t.last_name || ''} ${t.first_name || ''}`.toLowerCase();
            const subject = (t.subject || '').toLowerCase();
            return fullName.includes(q) || subject.includes(q);
        });
    }

    const openModal = (teacherId) => {
        dispatch({ type: 'OPEN_MODAL', payload: { modalName: 'teacherAbsence', modalData: { teacherId } } });
    };

    const removeAbsence = (teacherId) => {
        if (window.removeTeacherAbsence) {
            window.removeTeacherAbsence(teacherId);
        } else {
            // React fallback
            const updated = { ...state.selectedTeachers };
            delete updated[teacherId];
            dispatch({ type: 'SET_DATA', payload: { selectedTeachers: updated } });
        }
    };

    // Columns
    const columns = [
        { id: 'index', name: '#', width: '60px' },
        { 
            id: 'name', name: 'الاسم الكامل', width: '250px',
            render: (row) => `${row.last_name || ''} ${row.first_name || ''}`
        },
        { id: 'subject', name: 'المادة', width: '150px' },
        {
            id: 'action', name: 'غائب / تسجيل', width: '150px',
            render: (row) => {
                const teacherId = String(row.id || `${row.last_name}-${row.first_name}`);
                const isSelected = !!state.selectedTeachers[teacherId];
                return e('div', { style: { display: 'flex', gap: '5px', justifyContent: 'center' } },
                    e('button', {
                        className: `btn btn-sm ${isSelected ? 'btn-danger' : 'btn-outline-primary'}`,
                        onClick: () => openModal(teacherId)
                    }, isSelected ? 'تعديل الغياب' : 'تسجيل غياب'),
                    isSelected && e('button', {
                        className: 'btn btn-sm btn-outline-secondary',
                        title: 'حذف الغياب',
                        onClick: () => removeAbsence(teacherId)
                    }, '❌')
                );
            }
        },
        {
            id: 'duration', name: 'المدة', width: '100px',
            render: (row) => {
                const teacherId = String(row.id || `${row.last_name}-${row.first_name}`);
                const teacherData = state.selectedTeachers[teacherId];
                if (!teacherData) return '-';
                if (teacherData.type === 'full') return 'يوم كامل';
                if (teacherData.type === 'partial') return `${teacherData.periods ? teacherData.periods.length : 0} حصص`;
                if (teacherData.type === 'late') return `تأخر (${teacherData.lateDuration || 0} د)`;
                return '-';
            }
        },
        {
            id: 'reason', name: 'السبب', width: '150px',
            render: (row) => {
                const teacherId = String(row.id || `${row.last_name}-${row.first_name}`);
                const teacherData = state.selectedTeachers[teacherId];
                return teacherData ? (teacherData.reason || '-') : '-';
            }
        }
    ];

    const totalTeachers = state.allTeachers.length;
    const absentTeachers = Object.keys(state.selectedTeachers || {}).filter(id => state.allTeachers.some(t => String(t.id || `${t.last_name}-${t.first_name}`) === id)).length;

    return e('div', { className: 'tab-content active', id: 'tab-teachers-react' },
        e('div', { className: 'filter-row' },
            e('div', { className: 'search-box', style: { width: '100%', maxWidth: '400px' } },
                e('input', { 
                    type: 'text', 
                    placeholder: 'بحث عن أستاذ (الاسم أو المادة)...', 
                    value: searchQuery, 
                    onChange: e => setSearchQuery(e.target.value) 
                })
            )
        ),
        e('div', { className: 'stats-bar' },
            e('div', { className: 'stat-badge primary-stat' }, e('span', null, '👨‍🏫 إجمالي الأساتذة:'), e('span', null, totalTeachers)),
            e('div', { className: 'stat-badge danger-stat' }, e('span', null, '❌ الغائبون:'), e('span', null, absentTeachers))
        ),
        filteredTeachers.length === 0 ? 
            e('div', { style: { padding: '20px', textAlign: 'center', color: '#999' } },
                e('div', { style: { fontSize: '2.5rem', marginBottom: '10px', opacity: 0.5 } }, '👨‍🏫'),
                e('p', null, state.allTeachers.length === 0 ? 'لا يوجد أساتذة. قم بإضافة الأساتذة من صفحة إدارة الأساتذة.' : 'لا يوجد أساتذة يطابقون البحث.')
            )
            : e(DataTable, { columns, data: filteredTeachers, pageSize: 20 })
    );
}
