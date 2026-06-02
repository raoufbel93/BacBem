/**
 * Absence Tracking - Main React Application
 */

const AbsenceContext = createContext(null);
function useAbsence() { return useContext(AbsenceContext); }

// ============ Reducer & State ============
const initialState = {
    date: new Date().toISOString().split('T')[0],
    period: 'ALL',
    reportNumber: '',
    
    // Data
    allStudents: [],
    allTeachers: [],
    allSupervisors: [],
    settings: {},
    holidays: [],
    
    // Selections
    selectedStudents: {},
    selectedTeachers: {},
    selectedSupervisors: {},
    
    // UI State
    activeTab: 'students',
    loading: true,
    reportLogVisible: true,
    reportLog: [],
    
    // Filters
    levelFilter: '',
    classFilter: '',
    streamFilter: '',
    searchQuery: '',
    consecutiveFilter: '',
    
    // Modal State
    activeModal: null, // null, 'savedAbsences', 'importAbsences', 'teacherAbsence', 'supervisorStats', 'addSupervisor'
    modalData: {} // To pass props to modals (e.g. teacherId)
};

function absenceReducer(state, action) {
    switch (action.type) {
        case 'SET_DATA':
            return { ...state, ...action.payload };
        case 'SET_DATE':
            return { ...state, date: action.payload };
        case 'SWITCH_TAB':
            return { ...state, activeTab: action.payload };
        case 'SET_FILTER':
            return { ...state, [action.filterType]: action.value };
        case 'UPDATE_STUDENT_SELECTION':
            return { ...state, selectedStudents: { ...state.selectedStudents, ...action.payload } };
        case 'OPEN_MODAL':
            return { ...state, activeModal: action.payload.modalName, modalData: action.payload.modalData || {} };
        case 'CLOSE_MODAL':
            return { ...state, activeModal: null, modalData: {} };
        default:
            return state;
    }
}

// ============ Shell Components ============

function PageHeader() {
    return e('div', { className: 'page-header' },
        e('h1', null, '📝 متابعة الغيابات (React)'),
        e('div', { className: 'header-actions' },
            e('button', { className: 'btn btn-outline', style: { backgroundColor: '#f1c40f', color: 'var(--primary-color)', borderColor: '#f39c12', fontWeight: 'bold' } }, '❓ دليل الاستخدام'),
            e('button', { className: 'btn btn-outline' }, '⚙️ إعدادات التقرير'),
            e('button', { className: 'btn btn-outline' }, '📋 الغيابات المحفوظة')
        )
    );
}

function TopBar() {
    const { state, dispatch } = useAbsence();
    
    return e('div', { className: 'top-bar' },
        e('div', { className: 'top-bar-controls' },
            e('div', null,
                e('label', { style: { fontWeight: 500, marginLeft: '10px', color: '#7f8c8d' } }, '📅 التاريخ:'),
                e('input', { 
                    type: 'date', 
                    className: 'date-input', 
                    value: state.date,
                    onChange: (ev) => dispatch({ type: 'SET_DATE', payload: ev.target.value }) 
                })
            )
        ),
        e('div', { className: 'top-bar-buttons' },
            e('div', { className: 'report-number-group', style: { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-color)', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e0e0e0' } },
                e('label', { style: { fontWeight: 500, color: '#7f8c8d', fontSize: '0.9rem' } }, 'رقم التقرير:'),
                e('input', { type: 'number', className: 'date-input', style: { width: '80px', textAlign: 'center', fontWeight: 'bold' }, min: 1 })
            ),
            e('button', { 
                className: 'btn', 
                style: { background: 'linear-gradient(135deg, #3498db, #2980b9)', color: 'white', fontWeight: 'bold', minWidth: '140px' },
                onClick: () => { if (window.generateReport) window.generateReport(); }
            }, '💾 إنشاء تقرير'),
            e('button', { 
                className: 'btn btn-primary',
                onClick: () => { if (window.printReport) window.printReport(); else window.print(); }
            }, '📄 طباعة التقرير اليومي')
        )
    );
}

function TabsHeader() {
    const { state, dispatch } = useAbsence();
    const tabs = [
        { id: 'students', label: '👥 غيابات التلاميذ' },
        { id: 'teachers', label: '👨‍🏫 غيابات الأساتذة' },
        { id: 'supervisors', label: '👔 غيابات مشرفين/إداريين' },
        { id: 'canteen', label: '🍴 المطعم' },
        { id: 'notes', label: '📝 ملاحظات/المرافق' }
    ];

    return e('div', { className: 'tabs-header' },
        tabs.map(tab => 
            e('button', {
                key: tab.id,
                className: `tab-btn ${state.activeTab === tab.id ? 'active' : ''}`,
                onClick: () => dispatch({ type: 'SWITCH_TAB', payload: tab.id })
            }, tab.label)
        )
    );
}

function TabsContent() {
    const { state } = useAbsence();
    
    // Render the correct component based on active tab
    let content = null;
    switch (state.activeTab) {
        case 'students':
            content = typeof StudentsTab !== 'undefined' ? e(StudentsTab) : e('div', { className: 'empty-state' }, 'تبويب التلاميذ (قيد التطوير)');
            break;
        case 'teachers':
            content = typeof TeachersTab !== 'undefined' ? e(TeachersTab) : e('div', { className: 'empty-state' }, 'تبويب الأساتذة (قيد التطوير)');
            break;
        case 'supervisors':
            content = typeof SupervisorsTab !== 'undefined' ? e(SupervisorsTab) : e('div', { className: 'empty-state' }, 'تبويب المشرفين (قيد التطوير)');
            break;
        case 'canteen':
            content = typeof CanteenTab !== 'undefined' ? e(CanteenTab) : e('div', { className: 'empty-state' }, 'تبويب المطعم (قيد التطوير)');
            break;
        case 'notes':
            content = typeof NotesTab !== 'undefined' ? e(NotesTab) : e('div', { className: 'empty-state' }, 'تبويب الملاحظات (قيد التطوير)');
            break;
        default:
            content = e('div', { className: 'empty-state' }, 'التبويب قيد التطوير...');
    }

    return e('div', { className: 'tab-content active', style: { display: 'block' } }, content);
}

// ============ Main App Component ============

function AbsenceTrackingApp() {
    const [state, dispatch] = useReducer(absenceReducer, initialState);

    // Initial data load
    useEffect(() => {
        logger.info('Initializing React App...');
        if (typeof loadAllData === 'function') {
            loadAllData(dispatch);
        } else {
            setTimeout(() => {
                dispatch({ type: 'SET_DATA', payload: { loading: false } });
                logger.info('App data loaded.');
            }, 500);
        }
    }, []);

    // Sync React state to global variables to keep legacy reports working perfectly
    useEffect(() => {
        if (state.loading) return;
        
        // Sync Students
        window.selectedStudents = new Map();
        Object.entries(state.selectedStudents || {}).forEach(([id, data]) => {
            window.selectedStudents.set(id, data);
        });

        // Sync Teachers
        window.selectedTeachers = new Map();
        Object.entries(state.selectedTeachers || {}).forEach(([id, data]) => {
            window.selectedTeachers.set(id, data);
        });

        // Sync Supervisors
        window.selectedSupervisors = new Map();
        Object.entries(state.selectedSupervisors || {}).forEach(([id, data]) => {
            window.selectedSupervisors.set(id, data);
        });

        // Sync Canteen
        window.canteenBeneficiaries = state.canteenBeneficiaries || [];
        window.canteenAbsences = state.canteenAbsences || {};

    }, [state.selectedStudents, state.selectedTeachers, state.selectedSupervisors, state.canteenBeneficiaries, state.canteenAbsences, state.loading]);

    const contextValue = { state, dispatch };

    return e(AbsenceContext.Provider, { value: contextValue },
        e('div', { className: 'container no-print', style: { paddingBottom: '50px' } },
            e(PageHeader),
            e('div', { className: 'main-card', style: { marginBottom: '20px' } },
                e(TopBar)
            ),
            e('div', { className: 'main-card' },
                e('div', { className: 'tabs-container' },
                    e(TabsHeader),
                    state.loading ? e('div', { className: 'empty-state' }, 'جاري التحميل...') : e(TabsContent)
                )
            )
        )
    );
}

// Mount point will be handled in a separate script or when React is active
