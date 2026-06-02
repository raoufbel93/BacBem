/**
 * Absence Tracking - React Modals
 */

// ==================== GENERIC MODAL WRAPPER ====================
function ModalWrapper({ title, onClose, children, actions, maxWidth = '500px' }) {
    // Escape key listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return e('div', { className: 'modal-overlay', style: { display: 'flex' } },
        e('div', { className: 'modal-content animate-pop-in', style: { maxWidth, maxHeight: '90vh', display: 'flex', flexDirection: 'column' } },
            e('div', { className: 'modal-header' },
                e('h3', { style: { margin: 0 } }, title),
                e('button', { className: 'btn btn-sm btn-danger', style: { padding: '2px 8px' }, onClick: onClose }, '✖')
            ),
            e('div', { className: 'modal-body', style: { overflowY: 'auto', flex: 1, padding: '20px' } }, children),
            actions && e('div', { className: 'modal-buttons', style: { marginTop: '20px', display: 'flex', gap: '10px', justify-content: 'flex-end' } },
                actions
            )
        )
    );
}

// ==================== SPECIFIC MODALS ====================

function ImportAbsencesModal() {
    const { dispatch } = useAbsence();
    const [importDate, setImportDate] = useState('');

    const handleImport = () => {
        if (!importDate) {
            if (window.showToast) window.showToast('الرجاء اختيار تاريخ أولاً', 'error');
            return;
        }
        
        // Use global import function but force refresh via React
        if (window.DB && window.DB.getDailyAbsences) {
            window.DB.getDailyAbsences(importDate).then(data => {
                if (!data) {
                    if (window.showToast) window.showToast('لا توجد بيانات غيابات محفوظة في هذا التاريخ', 'info');
                    return;
                }
                
                dispatch({
                    type: 'SET_DATA',
                    payload: {
                        selectedStudents: data.students || {},
                        selectedTeachers: data.teachers || {},
                        selectedSupervisors: data.supervisors || {},
                        canteenBeneficiaries: data.canteenBeneficiaries || [],
                        canteenAbsences: { [importDate]: data.canteenAbsences || [] }
                    }
                });

                if (window.showToast) window.showToast('تم استيراد الغيابات بنجاح', 'success');
                dispatch({ type: 'CLOSE_MODAL' });
            });
        }
    };

    return e(ModalWrapper, { 
        title: '⏪ استيراد غيابات سابقة', 
        onClose: () => dispatch({ type: 'CLOSE_MODAL' }),
        actions: [
            e('button', { key: 'save', className: 'btn btn-success', onClick: handleImport }, '✅ استيراد الآن'),
            e('button', { key: 'cancel', className: 'btn btn-danger', onClick: () => dispatch({ type: 'CLOSE_MODAL' }) }, 'إلغاء')
        ]
    },
        e('div', { className: 'form-group' },
            e('label', null, 'تاريخ الغيابات المراد استيرادها:'),
            e('input', { 
                type: 'date', 
                className: 'form-input', 
                style: { width: '100%', padding: '10px', boxSizing: 'border-box' },
                value: importDate,
                onChange: (e) => setImportDate(e.target.value)
            })
        )
    );
}

function SavedAbsencesModal() {
    const { dispatch } = useAbsence();
    const [savedRecords, setSavedRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (window.DB && window.DB.getAllAbsencesExport) {
            window.DB.getAllAbsencesExport().then(records => {
                records.sort((a, b) => b.date.localeCompare(a.date));
                setSavedRecords(records);
                setLoading(false);
            });
        }
    }, []);

    const handleDelete = (date) => {
        if (confirm(`هل أنت متأكد من حذف سجل الغيابات ليوم ${date}؟`)) {
            if (window.DB && window.DB.deleteDailyAbsences) {
                window.DB.deleteDailyAbsences(date).then(() => {
                    setSavedRecords(savedRecords.filter(r => r.date !== date));
                    if (window.showToast) window.showToast('تم الحذف بنجاح', 'success');
                });
            }
        }
    };

    return e(ModalWrapper, { 
        title: '📋 سجل الغيابات المحفوظة', 
        maxWidth: '700px',
        onClose: () => dispatch({ type: 'CLOSE_MODAL' })
    },
        loading ? e('div', { style: { textAlign: 'center', color: '#7f8c8d' } }, 'جاري التحميل...') :
        savedRecords.length === 0 ? e('div', { style: { textAlign: 'center', color: '#7f8c8d' } }, 'لا توجد غيابات محفوظة') :
        e('div', { className: 'table-wrapper' },
            e('table', { className: 'report-table', style: { width: '100%', textAlign: 'center' } },
                e('thead', null, 
                    e('tr', null, 
                        e('th', null, 'التاريخ'),
                        e('th', null, 'التلاميذ'),
                        e('th', null, 'الأساتذة'),
                        e('th', null, 'المشرفين'),
                        e('th', null, 'إجراءات')
                    )
                ),
                e('tbody', null,
                    savedRecords.map(record => e('tr', { key: record.date },
                        e('td', { style: { fontWeight: 'bold' } }, record.date),
                        e('td', null, record.studentsCount || 0),
                        e('td', null, record.teachersCount || 0),
                        e('td', null, record.supervisorsCount || 0),
                        e('td', null, 
                            e('button', { 
                                className: 'btn btn-sm btn-danger',
                                onClick: () => handleDelete(record.date)
                            }, '🗑️ حذف')
                        )
                    ))
                )
            )
        )
    );
}

function TeacherAbsenceModal() {
    const { state, dispatch } = useAbsence();
    const teacherId = state.modalData.teacherId;
    const teacherData = state.selectedTeachers[teacherId] || { type: 'full', periods: [], reason: '', lateDuration: '' };
    
    // Check if Teacher Schedule functionality exists globally (legacy support)
    const [scheduleHtml, setScheduleHtml] = useState('');
    
    useEffect(() => {
        if (teacherData.type === 'partial' && window.getTeacherScheduleForDateHtml) {
            const dateStr = state.date;
            window.getTeacherScheduleForDateHtml(teacherId, dateStr).then(html => {
                setScheduleHtml(html || '<div style="color:red; text-align:center;">لا يوجد جدول مسجل لهذا الأستاذ في هذا اليوم.</div>');
            });
        }
    }, [teacherData.type, teacherId, state.date]);

    const handleUpdate = (field, value) => {
        const newData = { ...teacherData, [field]: value };
        // Reset periods if not partial
        if (field === 'type' && value !== 'partial') {
            newData.periods = [];
        }
        dispatch({
            type: 'SET_DATA',
            payload: { selectedTeachers: { ...state.selectedTeachers, [teacherId]: newData } }
        });
    };

    // The logic to handle period toggle inside the raw HTML
    // Since we are generating raw HTML from the old DB.js logic, we have to attach an event listener to the modal body
    useEffect(() => {
        const handlePeriodClick = (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox' && e.target.closest('#teacherScheduleContainerReact')) {
                const checked = e.target.checked;
                const periodValue = e.target.value;
                const currentPeriods = [...(teacherData.periods || [])];
                
                if (checked && !currentPeriods.includes(periodValue)) {
                    handleUpdate('periods', [...currentPeriods, periodValue]);
                } else if (!checked) {
                    handleUpdate('periods', currentPeriods.filter(p => p !== periodValue));
                }
            }
        };
        document.addEventListener('change', handlePeriodClick);
        return () => document.removeEventListener('change', handlePeriodClick);
    }, [teacherData.periods]);

    return e(ModalWrapper, { 
        title: '👨‍🏫 تسجيل غياب أستاذ', 
        maxWidth: '600px',
        onClose: () => dispatch({ type: 'CLOSE_MODAL' }),
        actions: [
            e('button', { key: 'save', className: 'btn btn-success', onClick: () => dispatch({ type: 'CLOSE_MODAL' }) }, '✅ حفظ'),
            e('button', { key: 'cancel', className: 'btn btn-danger', onClick: () => dispatch({ type: 'CLOSE_MODAL' }) }, 'إلغاء')
        ]
    },
        e('div', { className: 'form-group', style: { marginBottom: '15px' } },
            e('label', { style: { display: 'block', marginBottom: '8px' } }, 'نوع الغياب:'),
            e('select', { 
                className: 'form-input', 
                style: { width: '100%', padding: '10px' },
                value: teacherData.type,
                onChange: (e) => handleUpdate('type', e.target.value)
            },
                e('option', { value: 'full' }, 'يوم كامل'),
                e('option', { value: 'am' }, 'غياب صباحي'),
                e('option', { value: 'pm' }, 'غياب مسائي'),
                e('option', { value: 'partial' }, 'غياب جزئي (بالحصص)'),
                e('option', { value: 'late' }, 'تأخر')
            )
        ),

        teacherData.type === 'partial' && e('div', { id: 'teacherScheduleContainerReact', style: { marginBottom: '15px', background: '#f8f9fa', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' } },
            e('label', { style: { display: 'block', marginBottom: '8px', fontWeight: 'bold' } }, 'اختر الحصص التي غاب فيها:'),
            e('div', { dangerouslySetInnerHTML: { __html: scheduleHtml } })
        ),

        teacherData.type === 'late' && e('div', { className: 'form-group', style: { marginBottom: '15px' } },
            e('label', { style: { display: 'block', marginBottom: '8px' } }, 'مدة التأخر (بالدقائق):'),
            e('input', { 
                type: 'number', 
                className: 'form-input', 
                style: { width: '100%', padding: '10px' },
                placeholder: 'مثال: 15',
                value: teacherData.lateDuration || '',
                onChange: (e) => handleUpdate('lateDuration', e.target.value)
            })
        ),

        e('div', { className: 'form-group' },
            e('label', { style: { display: 'block', marginBottom: '8px' } }, 'سبب الغياب أو الملاحظة (اختياري):'),
            e('input', { 
                type: 'text', 
                className: 'form-input', 
                style: { width: '100%', padding: '10px' },
                placeholder: 'مرض، مبرر، بدون مبرر...',
                value: teacherData.reason || '',
                onChange: (e) => handleUpdate('reason', e.target.value)
            })
        )
    );
}

function AddSupervisorModal() {
    const { state, dispatch } = useAbsence();
    const [name, setName] = useState('');

    const handleSave = () => {
        if (!name.trim()) {
            if (window.showToast) window.showToast('الرجاء إدخال اسم المشرف', 'error');
            return;
        }
        if (state.allSupervisors.some(s => s.name === name.trim())) {
            if (window.showToast) window.showToast('هذا المشرف موجود بالفعل', 'error');
            return;
        }

        const newSupervisor = {
            id: Date.now().toString(),
            name: name.trim()
        };

        const updated = [...state.allSupervisors, newSupervisor];
        if (window.DB) window.DB.set('supervisorsList', updated);
        dispatch({ type: 'SET_DATA', payload: { allSupervisors: updated } });
        dispatch({ type: 'CLOSE_MODAL' });
        if (window.showToast) window.showToast('تم إضافة المشرف بنجاح', 'success');
    };

    return e(ModalWrapper, { 
        title: '➕ إضافة مشرف/إداري جديد', 
        maxWidth: '400px',
        onClose: () => dispatch({ type: 'CLOSE_MODAL' }),
        actions: [
            e('button', { key: 'save', className: 'btn btn-success', onClick: handleSave }, '✅ حفظ'),
            e('button', { key: 'cancel', className: 'btn btn-danger', onClick: () => dispatch({ type: 'CLOSE_MODAL' }) }, 'إلغاء')
        ]
    },
        e('div', { className: 'form-group' },
            e('label', { style: { display: 'block', marginBottom: '8px' } }, 'اسم المشرف:'),
            e('input', { 
                type: 'text', 
                className: 'form-input', 
                style: { width: '100%', padding: '10px' },
                placeholder: 'اكتب اسم المشرف...',
                value: name,
                onChange: (e) => setName(e.target.value)
            })
        )
    );
}

// Supervisor Stats uses the old window.generateSupervisorStatsReport logic but rendered in React UI.
function SupervisorStatsModal() {
    const { dispatch } = useAbsence();
    // Default to current month
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Formatting for input type="date"
    const formatDate = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const [startDate, setStartDate] = useState(formatDate(startOfMonth));
    const [endDate, setEndDate] = useState(formatDate(today));

    const generateReport = () => {
        // Since the old logic uses getElementById, we will just bridge it by creating hidden inputs or bypassing
        // The easiest way without rewriting the 150 line report logic is to manually set the DOM elements
        // if they exist, or just call the old function which depends on HTML elements.
        // Actually, the old HTML for this might be gone. We should re-create the DOM elements or rely on the old DOM.
        const startEl = document.getElementById('supStatsStartDate');
        const endEl = document.getElementById('supStatsEndDate');
        if (startEl && endEl) {
            startEl.value = startDate;
            endEl.value = endDate;
            if (window.generateSupervisorStatsReport) {
                window.generateSupervisorStatsReport();
            }
        } else {
            if (window.showToast) window.showToast('يرجى التحقق من وجود الحقول الأصلية للتقارير', 'error');
        }
    };

    return e(ModalWrapper, { 
        title: '📊 إحصائيات غيابات المشرفين', 
        maxWidth: '500px',
        onClose: () => dispatch({ type: 'CLOSE_MODAL' }),
        actions: [
            e('button', { key: 'generate', className: 'btn btn-primary', onClick: generateReport }, '📄 إنشاء تقرير'),
            e('button', { key: 'cancel', className: 'btn btn-danger', onClick: () => dispatch({ type: 'CLOSE_MODAL' }) }, 'إغلاق')
        ]
    },
        e('div', { className: 'form-group', style: { marginBottom: '15px' } },
            e('label', { style: { display: 'block', marginBottom: '8px' } }, 'من تاريخ:'),
            e('input', { 
                type: 'date', 
                id: 'supStatsStartDate', // Keep ID for legacy function
                className: 'form-input', 
                style: { width: '100%', padding: '10px' },
                value: startDate,
                onChange: (e) => setStartDate(e.target.value)
            })
        ),
        e('div', { className: 'form-group' },
            e('label', { style: { display: 'block', marginBottom: '8px' } }, 'إلى تاريخ:'),
            e('input', { 
                type: 'date', 
                id: 'supStatsEndDate', // Keep ID for legacy function
                className: 'form-input', 
                style: { width: '100%', padding: '10px' },
                value: endDate,
                onChange: (e) => setEndDate(e.target.value)
            })
        )
    );
}

// ==================== MAIN EXPORT ====================

function Modals() {
    const { state } = useAbsence();

    switch (state.activeModal) {
        case 'savedAbsences':
            return e(SavedAbsencesModal, null);
        case 'importAbsences':
            return e(ImportAbsencesModal, null);
        case 'teacherAbsence':
            return e(TeacherAbsenceModal, null);
        case 'addSupervisor':
            return e(AddSupervisorModal, null);
        case 'supervisorStats':
            return e(SupervisorStatsModal, null);
        default:
            return null;
    }
}
