(function (global) {
    var React = global.React;
    var ReactDOM = global.ReactDOM;

    if (!React || !ReactDOM) {
        return;
    }

    var e = React.createElement;
    var sectionRoot = null;
    var modalRoot = null;

    function renderInto(container, element, cacheName) {
        if (!container) return;

        if (typeof ReactDOM.createRoot === 'function') {
            if (!container[cacheName]) {
                container[cacheName] = ReactDOM.createRoot(container);
            }
            container[cacheName].render(element);
            return;
        }

        ReactDOM.render(element, container);
    }

    function buildStaticHeaderColumns() {
        var labels = [
            'عربية',
            'أمازيغية',
            'فرنسية',
            'انجليزية',
            'اسلامية',
            'مدنية',
            'تاريخ',
            'رياضيات',
            'علوم',
            'فيزياء',
            'معلوماتية',
            'ت.تشكيلية',
            'موسيقى',
            'رياضة'
        ];

        return labels.map(function (label, index) {
            return e('th', { key: label + '_' + index, className: 'vertical-col' },
                e('div', { className: 'vertical-header' }, label)
            );
        });
    }

    function StudentListSection() {
        return e('section', { className: 'student-list idara-react-section', style: { marginTop: '0' } }, [
            e('div', { key: 'header', className: 'student-list-header' }, [
                e('h2', { key: 'title', style: { margin: '0' } }, '📋 القائمة التفصيلية للتلاميذ'),
                e('input', { key: 'toggle-input', type: 'checkbox', id: 'toggleExamAvgCol', style: { display: 'none' }, defaultChecked: true }),
                e('div', { key: 'toggle', className: 'exam-toggle-wrapper active', id: 'examToggleBtn', onClick: function () { if (typeof global.toggleExamAvgColumn === 'function') global.toggleExamAvgColumn(); } }, [
                    e('span', { key: 'icon', className: 'toggle-icon' }, '📝'),
                    e('span', { key: 'label', className: 'toggle-label' }, 'معدل الاختبار'),
                    e('div', { key: 'track', className: 'toggle-track' }, e('div', { className: 'toggle-thumb' }))
                ])
            ]),
            e('div', { key: 'toolbar', className: 'student-tools-bar' }, [
                e('div', { key: 'meta', className: 'student-table-meta' }, [
                    e('span', { key: 'visible', className: 'table-stat-pill' }, ['المعروض ', e('strong', { id: 'visibleStudentCount' }, '0')]),
                    e('span', { key: 'total', className: 'table-stat-pill' }, ['الإجمالي ', e('strong', { id: 'totalStudentCount' }, '0')]),
                    e('span', { key: 'subjects', className: 'table-stat-pill' }, ['المواد ', e('strong', { id: 'visibleSubjectCount' }, '0')]),
                    e('span', { key: 'sort', className: 'table-stat-pill', id: 'studentSortStatus' }, 'الترتيب: الأعلى أولا')
                ]),
                e('div', { key: 'controls', className: 'student-tools-controls' }, [
                    e('label', { key: 'search', className: 'table-search-box' }, [
                        e('span', { key: 'icon' }, '🔎'),
                        e('input', { key: 'input', type: 'search', id: 'studentSearchInput', placeholder: 'ابحث بالاسم أو تاريخ الميلاد...' })
                    ]),
                    e('label', { key: 'risk', className: 'student-filter-chip' }, [
                        e('input', { key: 'checkbox', type: 'checkbox', id: 'showOnlyAtRisk' }),
                        e('span', { key: 'text' }, 'المتعثرون فقط')
                    ]),
                    e('button', { key: 'density', type: 'button', id: 'studentDensityToggle', className: 'student-density-btn' }, 'عرض مضغوط'),
                    e('button', { 
                        key: 'columns', 
                        type: 'button', 
                        id: 'studentColumnVisibilityToggle', 
                        className: 'student-density-btn',
                        style: { marginRight: '5px' },
                        onClick: function() { if (typeof global.showColumnVisibilityModal === 'function') global.showColumnVisibilityModal(); }
                    }, '👁️ الأعمدة')
                ])
            ]),
            e('div', { key: 'hint', className: 'student-list-hint' }, 'اضغط على سطر التلميذ لعرض التفاصيل، واضغط على عمود المعدل لعكس ترتيب الجدول.'),
            e('div', { key: 'table-container', className: 'data-table-container student-table-container' },
                e('div', { className: 'student-table-scroll' },
                    e('table', { className: 'data-table', id: 'studentsDetailedTable' }, [
                        e('thead', { key: 'head' },
                            e('tr', null, [
                                e('th', { key: 'idx', width: '5%', className: 'sticky-col sticky-index' }, '#'),
                                e('th', { key: 'name', width: '25%' }, 'اللقب والاسم'),
                                e('th', { key: 'gender', width: '3%' }, 'الجنس'),
                                e('th', { key: 'dob', width: '12%' }, 'تاريخ الميلاد')
                            ].concat(buildStaticHeaderColumns()).concat([
                                e('th', {
                                    key: 'exam-avg',
                                    className: 'exam-avg-col',
                                    id: 'examAvgMainHeader',
                                    width: '45',
                                    style: { background: '#f39c12', color: 'white' }
                                }, e('div', { className: 'vertical-header' }, 'م.الاختبار')),
                                e('th', {
                                    key: 'avg',
                                    onClick: function () { if (typeof global.sortStudentsByScore === 'function') global.sortStudentsByScore(); },
                                    style: { cursor: 'pointer', textDecoration: 'underline' }
                                }, e('div', { className: 'vertical-header' }, 'م.الفصل')),
                                e('th', { key: 'app', width: '1%', style: { whiteSpace: 'nowrap' } }, 'التقدير')
                            ]))
                        ),
                        e('tbody', { key: 'body', id: 'detailedTableBody' })
                    ])
                )
            )
        ]);
    }

    function StudentModalShell() {
        return e('div', {
            id: 'studentModal',
            className: 'student-detail-modal-overlay',
            style: { display: 'none' }
        }, e('div', { id: 'studentModalReactRoot' }));
    }

    function mount() {
        var studentSectionContainer = document.getElementById('classCouncilsStudentSectionRoot');
        var studentModalContainer = document.getElementById('classCouncilsStudentModalMount');

        if (studentSectionContainer) {
            renderInto(studentSectionContainer, e(StudentListSection), '__classCouncilsReactRoot');
            sectionRoot = studentSectionContainer;
        }

        if (studentModalContainer) {
            renderInto(studentModalContainer, e(StudentModalShell), '__classCouncilsReactRoot');
            modalRoot = studentModalContainer;
        }
    }

    global.ClassCouncilsReactSections = {
        mount: mount,
        getSectionRoot: function () { return sectionRoot; },
        getModalRoot: function () { return modalRoot; }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})(window);
