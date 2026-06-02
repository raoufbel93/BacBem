const { useState, useEffect } = React;

const BAC_STREAM_OPTIONS = [
    'آداب وفلسفة',
    'لغات أجنبية',
    'علوم تجريبية',
    'رياضيات',
    'تقني رياضي',
    'تسيير واقتصاد',
    'فنون'
];

function normalizeBacStreams(streams, fallbackBranch) {
    var list = Array.isArray(streams) ? streams.slice() : [];

    if (list.length === 0 && fallbackBranch) {
        var branchItems = String(fallbackBranch)
            .split(/\s*(?:\/|\\|\||،|؛|-)\s*/)
            .map(function (item) { return String(item || '').trim(); })
            .filter(Boolean)
            .filter(function (item) { return BAC_STREAM_OPTIONS.indexOf(item) !== -1; });
        list = branchItems.length >= 2 ? branchItems : [];
    }

    var seen = {};
    return list.filter(function (item) {
        var value = String(item || '').trim();
        if (!value || BAC_STREAM_OPTIONS.indexOf(value) === -1 || seen[value]) return false;
        seen[value] = true;
        return true;
    });
}

function formatBacStreamsBranch(streams, fallbackBranch) {
    var normalized = normalizeBacStreams(streams, fallbackBranch);
    if (normalized.length > 0) return normalized.join(' / ');
    return fallbackBranch || '';
}

function shouldClearBranchFromBacStreams(branch, streams) {
    var branchValue = String(branch || '').trim();
    if (!branchValue) return false;
    var normalized = normalizeBacStreams(streams, branchValue);
    if (normalized.length === 0) return false;
    return branchValue === normalized.join(' / ');
}

const OfficialCenterData = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        ministry: 'وزارة التربية الوطنية',
        office: 'الديوان الوطني للامتحانات و المسابقات',
        branch: '',
        center_code: '',
        center_name: '',
        municipality: '',
        province: '',
        president: '',
        job: '',
        institution: '',
        exam: '',
        session: '',
        bac_streams: [],
        rooms_count: 0,
        guards_per_room: 0,
        exam_days: 0
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const data = await DB.getOfficialCenter();
            if (data) {
                var normalizedStreams = normalizeBacStreams(data.bac_streams, data.branch);
                var cleanedBranch = shouldClearBranchFromBacStreams(data.branch, normalizedStreams)
                    ? ''
                    : String(data.branch || '');
                setFormData(Object.assign({}, data, {
                    bac_streams: normalizedStreams,
                    branch: cleanedBranch
                }));
            }
        } catch (error) {
            console.error('Error loading center data:', error);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل بيانات المركز', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (value ? parseInt(value) : 0) : value
        }));
    };

    const toggleBacStream = (stream) => {
        setFormData(function (prev) {
            var current = normalizeBacStreams(prev.bac_streams, prev.branch);
            var exists = current.indexOf(stream) !== -1;
            var nextStreams = exists
                ? current.filter(function (item) { return item !== stream; })
                : current.concat(stream);

            return Object.assign({}, prev, {
                bac_streams: nextStreams
            });
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            const payload = Object.assign({}, formData, {
                bac_streams: normalizeBacStreams(formData.bac_streams, formData.branch),
                branch: String(formData.branch || '').trim()
            });
            const success = await DB.saveOfficialCenter(payload);
            if (success) {
                setFormData(payload);
                Swal.fire({
                    title: 'تم الحفظ',
                    text: 'تم حفظ بيانات المركز بنجاح',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                throw new Error('Save failed');
            }
        } catch (error) {
            console.error('Error saving center data:', error);
            Swal.fire('خطأ', 'حدث خطأ أثناء حفظ البيانات', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return React.createElement(
        "div",
        { className: "center-data-container" },
        React.createElement(
            "div",
            { className: "page-header" },
            React.createElement(
                "div",
                { className: "header-icon" },
                React.createElement("i", { className: "fa-solid fa-building-columns" })
            ),
            React.createElement(
                "div",
                { className: "header-text" },
                React.createElement("h1", null, "بيانات المركز"),
                React.createElement("p", null, "إدارة بيانات مركز الامتحانات الرسمية للطباعة والتقارير")
            )
        ),
        React.createElement(
            "form",
            { className: "form-section", onSubmit: handleSave, style: { position: 'relative' } },
            isLoading && React.createElement(
                "div",
                { className: "loading-overlay" },
                React.createElement("i", { className: "fa-solid fa-spinner fa-spin fa-2x", style: { color: 'var(--secondary-color)' } })
            ),
            React.createElement(
                "div",
                { className: "form-grid" },
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "الوزارة"),
                    React.createElement("input", {
                        type: "text",
                        name: "ministry",
                        value: formData.ministry || '',
                        onChange: handleChange,
                        placeholder: "وزارة التربية الوطنية"
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "الديوان"),
                    React.createElement("input", {
                        type: "text",
                        name: "office",
                        value: formData.office || '',
                        onChange: handleChange,
                        placeholder: "الديوان الوطني للامتحانات و المسابقات"
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "فرع الديوان"),
                    React.createElement("input", {
                        type: "text",
                        name: "branch",
                        value: formData.branch || '',
                        onChange: handleChange
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group full-width" },
                    React.createElement("label", null, "شعب البكالوريا"),
                    React.createElement(
                        "div",
                        { className: "bac-streams-box" },
                        React.createElement(
                            "div",
                            { className: "bac-streams-grid" },
                            BAC_STREAM_OPTIONS.map(function (stream) {
                                var checked = normalizeBacStreams(formData.bac_streams, formData.branch).indexOf(stream) !== -1;
                                return React.createElement(
                                    "label",
                                    { key: stream, className: checked ? "bac-stream-chip is-selected" : "bac-stream-chip" },
                                    React.createElement("input", {
                                        type: "checkbox",
                                        checked: checked,
                                        onChange: function () { return toggleBacStream(stream); }
                                    }),
                                    React.createElement("span", null, stream)
                                );
                            })
                        )
                    )
                ),
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "رقم المركز"),
                    React.createElement("input", {
                        type: "text",
                        name: "center_code",
                        value: formData.center_code || '',
                        onChange: handleChange
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group full-width" },
                    React.createElement("label", null, "اسم المركز"),
                    React.createElement("input", {
                        type: "text",
                        name: "center_name",
                        value: formData.center_name || '',
                        onChange: handleChange
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "البلدية"),
                    React.createElement("input", {
                        type: "text",
                        name: "municipality",
                        value: formData.municipality || '',
                        onChange: handleChange
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "الولاية"),
                    React.createElement("input", {
                        type: "text",
                        name: "province",
                        value: formData.province || '',
                        onChange: handleChange
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "رئيس المركز"),
                    React.createElement("input", {
                        type: "text",
                        name: "president",
                        value: formData.president || '',
                        onChange: handleChange
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "الوظيفة"),
                    React.createElement("input", {
                        type: "text",
                        name: "job",
                        value: formData.job || '',
                        onChange: handleChange
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group full-width" },
                    React.createElement("label", null, "المؤسسة"),
                    React.createElement("input", {
                        type: "text",
                        name: "institution",
                        value: formData.institution || '',
                        onChange: handleChange
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "امتحان"),
                    React.createElement("input", {
                        type: "text",
                        name: "exam",
                        value: formData.exam || '',
                        onChange: handleChange
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "دورة"),
                    React.createElement("input", {
                        type: "text",
                        name: "session",
                        value: formData.session || '',
                        onChange: handleChange
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "عدد الحجرات"),
                    React.createElement("input", {
                        type: "number",
                        name: "rooms_count",
                        value: formData.rooms_count || 0,
                        onChange: handleChange,
                        min: "0"
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "عدد الحراس في الحجرة"),
                    React.createElement("input", {
                        type: "number",
                        name: "guards_per_room",
                        value: formData.guards_per_room || 0,
                        onChange: handleChange,
                        min: "0"
                    })
                ),
                React.createElement(
                    "div",
                    { className: "form-group" },
                    React.createElement("label", null, "عدد أيام الامتحان"),
                    React.createElement("input", {
                        type: "number",
                        name: "exam_days",
                        value: formData.exam_days || 0,
                        onChange: handleChange,
                        min: "0"
                    })
                )
            ),
            React.createElement(
                "div",
                { className: "form-actions" },
                React.createElement(
                    "button",
                    { type: "submit", className: "btn-submit", disabled: isSaving },
                    isSaving ? React.createElement("i", { className: "fa-solid fa-spinner fa-spin" }) : React.createElement("i", { className: "fa-solid fa-save" }),
                    " حفظ البيانات"
                )
            )
        )
    );
};

ReactDOM.render(React.createElement(OfficialCenterData, null), document.getElementById('root'));
