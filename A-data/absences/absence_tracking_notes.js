/**
 * Absence Tracking - Notes Tab React Components
 */

function NotesTab() {
    const { state, dispatch } = useAbsence();

    // Local states for tables
    const [escorts, setEscorts] = useState([]);
    const [notes, setNotes] = useState([]);

    // Load data when date changes
    useEffect(() => {
        if (typeof DB !== 'undefined' && DB.get) {
            DB.get('facilitiesData').then(data => {
                const dayData = (data || {})[state.date] || { escorts: [], notes: [] };
                
                // Set default empty rows if empty
                setEscorts(dayData.escorts.length > 0 ? dayData.escorts : [{ escort: '', note: '', exception: '' }]);
                setNotes(dayData.notes.length > 0 ? dayData.notes : [{ note: '' }]);
            });
        }
    }, [state.date]);

    // Save data automatically when lists change
    useEffect(() => {
        if (typeof DB !== 'undefined' && DB.get && DB.set) {
            // Clean up empty rows before saving, except if it's the only row and it's empty
            const cleanedEscorts = escorts.filter(e => e.escort.trim() || e.note.trim() || e.exception.trim());
            const cleanedNotes = notes.filter(n => n.note.trim());
            
            DB.get('facilitiesData').then(data => {
                const newData = { ...(data || {}), [state.date]: { escorts: cleanedEscorts, notes: cleanedNotes } };
                DB.set('facilitiesData', newData);
            });
        }
    }, [escorts, notes, state.date]);

    // --- Escort Handlers ---
    const updateEscort = (index, field, value) => {
        const updated = [...escorts];
        updated[index][field] = value;
        setEscorts(updated);
    };

    const addEscort = () => {
        setEscorts([...escorts, { escort: '', note: '', exception: '' }]);
    };

    const removeEscort = (index) => {
        if (escorts.length === 1) {
            setEscorts([{ escort: '', note: '', exception: '' }]);
        } else {
            setEscorts(escorts.filter((_, i) => i !== index));
        }
    };

    // --- Note Handlers ---
    const updateNote = (index, value) => {
        const updated = [...notes];
        updated[index].note = value;
        setNotes(updated);
    };

    const addNote = () => {
        setNotes([...notes, { note: '' }]);
    };

    const removeNote = (index) => {
        if (notes.length === 1) {
            setNotes([{ note: '' }]);
        } else {
            setNotes(notes.filter((_, i) => i !== index));
        }
    };

    return e('div', { className: 'tab-content active', id: 'tab-notes-react' },
        e('div', { className: 'main-card', style: { padding: '20px', borderRadius: '12px', background: 'white', border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' } },
            
            // --- Escorts Table ---
            e('h3', { style: { marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px' } }, '🚗 جدول المرافق'),
            e('div', { className: 'table-wrapper', style: { marginBottom: '30px' } },
                e('table', { className: 'report-table' },
                    e('thead', null,
                        e('tr', null,
                            e('th', { width: '5%' }, '#'),
                            e('th', { width: '35%' }, 'المرافق'),
                            e('th', { width: '30%' }, 'الملاحظة'),
                            e('th', { width: '25%' }, 'الاستثناءات'),
                            e('th', { width: '5%' }, 'حذف')
                        )
                    ),
                    e('tbody', null,
                        escorts.map((item, index) => e('tr', { key: index },
                            e('td', { style: { textAlign: 'center' } }, index + 1),
                            e('td', null, e('input', { type: 'text', style: { width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }, value: item.escort, onChange: e => updateEscort(index, 'escort', e.target.value), placeholder: 'اسم المرافق أو الجهة...' })),
                            e('td', null, e('input', { type: 'text', style: { width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }, value: item.note, onChange: e => updateEscort(index, 'note', e.target.value), placeholder: 'ملاحظة حول المرافق...' })),
                            e('td', null, e('input', { type: 'text', style: { width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }, value: item.exception, onChange: e => updateEscort(index, 'exception', e.target.value), placeholder: 'أقسام أو مستويات مستثناة...' })),
                            e('td', { style: { textAlign: 'center' } }, e('button', { className: 'btn btn-sm btn-danger', onClick: () => removeEscort(index) }, '🗑️'))
                        ))
                    )
                ),
                e('div', { style: { marginTop: '10px', textAlign: 'right' } },
                    e('button', { className: 'btn btn-sm btn-primary', onClick: addEscort }, '➕ إضافة صف')
                )
            ),

            e('hr', { style: { margin: '30px 0', borderTop: '1px solid var(--border-color)' } }),

            // --- Notes Table ---
            e('h3', { style: { marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #2ecc71', paddingBottom: '10px' } }, '📝 جدول الملاحظات والتوصيات'),
            e('div', { className: 'table-wrapper' },
                e('table', { className: 'report-table' },
                    e('thead', null,
                        e('tr', null,
                            e('th', { width: '5%' }, '#'),
                            e('th', { width: '85%' }, 'الملاحظات / التوصيات'),
                            e('th', { width: '10%' }, 'حذف')
                        )
                    ),
                    e('tbody', null,
                        notes.map((item, index) => e('tr', { key: index },
                            e('td', { style: { textAlign: 'center' } }, index + 1),
                            e('td', null, e('input', { type: 'text', style: { width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }, value: item.note, onChange: e => updateNote(index, e.target.value), placeholder: 'اكتب ملاحظة أو توصية للتقرير...' })),
                            e('td', { style: { textAlign: 'center' } }, e('button', { className: 'btn btn-sm btn-danger', onClick: () => removeNote(index) }, '🗑️'))
                        ))
                    )
                ),
                e('div', { style: { marginTop: '10px', textAlign: 'right' } },
                    e('button', { className: 'btn btn-sm btn-success', onClick: addNote }, '➕ إضافة ملاحظة')
                )
            )
        )
    );
}
