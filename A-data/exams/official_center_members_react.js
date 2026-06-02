const e = React.createElement;
const { useEffect, useMemo, useState } = React;

const EMPTY_MEMBER = {
    full_name: '',
    role: '',
    institution: '',
    phone: '',
    note: ''
};

function createMemberId() {
    return 'official-member-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
}

function normalizeMember(member, index, center) {
    const fallbackInstitution = (center && (center.center_name || center.institution)) || '';
    return {
        id: member && member.id ? member.id : ('official-member-' + index),
        full_name: member && member.full_name ? member.full_name : '',
        role: member && member.role ? member.role : '',
        institution: member && member.institution ? member.institution : fallbackInstitution,
        phone: member && member.phone ? member.phone : '',
        note: member && member.note ? member.note : ''
    };
}

function OfficialCenterMembersApp() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [centerData, setCenterData] = useState({});
    const [members, setMembers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(EMPTY_MEMBER);

    useEffect(function () {
        loadData();
    }, []);

    const filteredMembers = useMemo(function () {
        const q = String(searchTerm || '').trim().toLowerCase();
        if (!q) return members;
        return members.filter(function (member) {
            return [
                member.full_name,
                member.role,
                member.institution,
                member.phone,
                member.note
            ].join(' ').toLowerCase().indexOf(q) !== -1;
        });
    }, [members, searchTerm]);

    const stats = useMemo(function () {
        const roles = {};
        members.forEach(function (member) {
            const role = String(member.role || '').trim();
            if (role) roles[role] = true;
        });
        return {
            total: members.length,
            roles: Object.keys(roles).length
        };
    }, [members]);

    async function loadData() {
        try {
            setIsLoading(true);
            const center = await DB.getOfficialCenter() || {};
            const storedMembers = await DB.getOfficialCenterMembers();
            const normalized = (storedMembers || []).map(function (member, index) {
                return normalizeMember(member, index, center);
            });
            setCenterData(center || {});
            setMembers(normalized);
            setFormData({
                full_name: '',
                role: '',
                institution: center.center_name || center.institution || '',
                phone: '',
                note: ''
            });
        } catch (error) {
            console.error('Official center members load error:', error);
            Swal.fire('خطأ', 'تعذر تحميل أعضاء المركز', 'error');
        } finally {
            setIsLoading(false);
        }
    }

    async function persistMembers(nextMembers, successText) {
        try {
            setIsSaving(true);
            const success = await DB.saveOfficialCenterMembers(nextMembers);
            if (!success) throw new Error('Save failed');
            setMembers(nextMembers);
            Swal.fire({
                title: 'تم الحفظ',
                text: successText,
                icon: 'success',
                timer: 1800,
                showConfirmButton: false
            });
            return true;
        } catch (error) {
            console.error('Official center members save error:', error);
            Swal.fire('خطأ', 'تعذر حفظ أعضاء المركز', 'error');
            return false;
        } finally {
            setIsSaving(false);
        }
    }

    function handleChange(event) {
        const name = event.target.name;
        const value = event.target.value;
        setFormData(function (prev) {
            const next = Object.assign({}, prev);
            next[name] = value;
            return next;
        });
    }

    function resetForm() {
        setEditingId(null);
        setFormData({
            full_name: '',
            role: '',
            institution: centerData.center_name || centerData.institution || '',
            phone: '',
            note: ''
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const fullName = String(formData.full_name || '').trim();
        const role = String(formData.role || '').trim();
        if (!fullName) {
            Swal.fire('تنبيه', 'يرجى إدخال الاسم واللقب', 'warning');
            return;
        }
        if (!role) {
            Swal.fire('تنبيه', 'يرجى إدخال الصفة أو المهمة', 'warning');
            return;
        }

        const payload = {
            id: editingId || createMemberId(),
            full_name: fullName,
            role: role,
            institution: String(formData.institution || centerData.center_name || centerData.institution || '').trim(),
            phone: String(formData.phone || '').trim(),
            note: String(formData.note || '').trim()
        };

        const nextMembers = editingId
            ? members.map(function (member) { return member.id === editingId ? payload : member; })
            : [payload].concat(members);

        const saved = await persistMembers(nextMembers, editingId ? 'تم تحديث العضو بنجاح' : 'تمت إضافة العضو بنجاح');
        if (saved) resetForm();
    }

    function handleEdit(member) {
        setEditingId(member.id);
        setFormData({
            full_name: member.full_name || '',
            role: member.role || '',
            institution: member.institution || '',
            phone: member.phone || '',
            note: member.note || ''
        });
    }

    async function handleDelete(member) {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'حذف عضو',
            text: 'هل تريد حذف هذا العضو من قائمة أعضاء المركز؟',
            showCancelButton: true,
            confirmButtonText: 'نعم، احذف',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#dc2626'
        });
        if (!result.isConfirmed) return;

        const nextMembers = members.filter(function (item) {
            return item.id !== member.id;
        });
        const saved = await persistMembers(nextMembers, 'تم حذف العضو بنجاح');
        if (saved && editingId === member.id) resetForm();
    }

    return e('div', { className: 'page-shell' },
        e('div', { className: 'page-header' },
            e('div', { className: 'header-icon' }, e('i', { className: 'fa-solid fa-users-gear' })),
            e('div', null,
                e('h1', null, 'أعضاء المركز'),
                e('p', null, 'إدارة أعضاء مركز الامتحانات الرسمية واستعمالهم في القوائم والبطاقات')
            )
        ),

        e('div', { className: 'stats-strip' },
            e('div', { className: 'stat-card' },
                e('div', { className: 'num' }, String(stats.total)),
                e('div', { className: 'lbl' }, 'إجمالي الأعضاء')
            ),
            e('div', { className: 'stat-card' },
                e('div', { className: 'num' }, String(stats.roles)),
                e('div', { className: 'lbl' }, 'المهام المختلفة')
            )
        ),

        e('div', { className: 'layout-grid' },
            e('div', { className: 'panel' },
                e('div', { className: 'panel-head' },
                    e('h3', null, editingId ? 'تعديل عضو' : 'إضافة عضو جديد'),
                    editingId ? e('button', {
                        className: 'btn btn-secondary',
                        type: 'button',
                        onClick: resetForm
                    }, 'إلغاء التعديل') : null
                ),
                e('div', { className: 'panel-body' },
                    e('form', { onSubmit: handleSubmit },
                        e('div', { className: 'field' },
                            e('label', null, 'الاسم واللقب'),
                            e('input', {
                                type: 'text',
                                name: 'full_name',
                                value: formData.full_name,
                                onChange: handleChange,
                                placeholder: 'أدخل الاسم واللقب'
                            })
                        ),
                        e('div', { className: 'field' },
                            e('label', null, 'الصفة / المهمة'),
                            e('input', {
                                type: 'text',
                                name: 'role',
                                value: formData.role,
                                onChange: handleChange,
                                placeholder: 'مثال: رئيس المركز، نائب الرئيس...'
                            })
                        ),
                        e('div', { className: 'field' },
                            e('label', null, 'المؤسسة أو المركز'),
                            e('input', {
                                type: 'text',
                                name: 'institution',
                                value: formData.institution,
                                onChange: handleChange,
                                placeholder: centerData.center_name || centerData.institution || 'اسم المؤسسة'
                            })
                        ),
                        e('div', { className: 'field' },
                            e('label', null, 'الهاتف'),
                            e('input', {
                                type: 'text',
                                name: 'phone',
                                value: formData.phone,
                                onChange: handleChange,
                                placeholder: 'رقم الهاتف'
                            })
                        ),
                        e('div', { className: 'field' },
                            e('label', null, 'ملاحظات'),
                            e('textarea', {
                                name: 'note',
                                value: formData.note,
                                onChange: handleChange,
                                placeholder: 'أي ملاحظات إضافية'
                            })
                        ),
                        e('div', { className: 'btn-row' },
                            e('button', {
                                className: 'btn btn-primary',
                                type: 'submit',
                                disabled: isSaving
                            }, isSaving ? 'جارٍ الحفظ...' : (editingId ? 'حفظ التعديل' : 'إضافة العضو')),
                            e('button', {
                                className: 'btn btn-secondary',
                                type: 'button',
                                onClick: resetForm
                            }, 'مسح الحقول')
                        )
                    )
                )
            ),

            e('div', { className: 'panel', style: { position: 'relative' } },
                e('div', { className: 'panel-head' },
                    e('h3', null, 'قائمة الأعضاء'),
                    e('span', { style: { color: 'var(--text-muted)', fontWeight: 800 } }, centerData.center_name || centerData.institution || 'المركز الرسمي')
                ),
                e('div', { className: 'panel-body' },
                    e('input', {
                        className: 'search-box',
                        type: 'text',
                        placeholder: 'ابحث باسم العضو أو الصفة أو المؤسسة',
                        value: searchTerm,
                        onChange: function (event) { setSearchTerm(event.target.value); }
                    }),
                    filteredMembers.length === 0
                        ? e('div', { className: 'empty-state' }, isLoading ? 'جارٍ التحميل...' : 'لا توجد بيانات مطابقة حالياً')
                        : e('table', { className: 'members-table' },
                            e('thead', null,
                                e('tr', null,
                                    e('th', null, 'العضو'),
                                    e('th', null, 'الصفة'),
                                    e('th', null, 'المؤسسة'),
                                    e('th', null, 'الهاتف'),
                                    e('th', null, 'ملاحظات'),
                                    e('th', null, 'إجراءات')
                                )
                            ),
                            e('tbody', null,
                                filteredMembers.map(function (member) {
                                    return e('tr', { key: member.id },
                                        e('td', { className: 'name-cell' }, member.full_name || '-'),
                                        e('td', null, member.role || '-'),
                                        e('td', null, member.institution || '-'),
                                        e('td', null, member.phone || '-'),
                                        e('td', { className: 'note-cell' }, member.note || '-'),
                                        e('td', null,
                                            e('div', { className: 'table-actions' },
                                                e('button', {
                                                    className: 'table-btn edit',
                                                    type: 'button',
                                                    onClick: function () { handleEdit(member); },
                                                    title: 'تعديل'
                                                }, e('i', { className: 'fa-solid fa-pen' })),
                                                e('button', {
                                                    className: 'table-btn delete',
                                                    type: 'button',
                                                    onClick: function () { handleDelete(member); },
                                                    title: 'حذف'
                                                }, e('i', { className: 'fa-solid fa-trash' }))
                                            )
                                        )
                                    );
                                })
                            )
                        )
                ),
                isLoading ? e('div', {
                    style: {
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(255,255,255,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '18px',
                        zIndex: 5
                    }
                }, e('i', { className: 'fa-solid fa-spinner fa-spin fa-2x', style: { color: 'var(--secondary-color)' } })) : null
            )
        )
    );
}

document.addEventListener('DOMContentLoaded', function () {
    const root = document.getElementById('root');
    if (root) {
        ReactDOM.render(e(OfficialCenterMembersApp), root);
    }
});
