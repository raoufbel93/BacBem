const e = React.createElement;
const { useEffect, useMemo, useState } = React;

const EMPTY_VALUE = '--';
const FINAL_LEVEL_BY_STAGE = {
    secondary: 3,
    middle: 4,
    primary: 5
};

const STREAM_LABELS = {
    common_science: 'جذع مشترك علوم وتكنولوجيا',
    common_arts: 'جذع مشترك آداب',
    science: 'علوم تجريبية',
    math: 'رياضيات',
    tech_math: 'تقني رياضي',
    tech_math_civil: 'تقني رياضي - هندسة مدنية',
    tech_math_mech: 'تقني رياضي - هندسة ميكانيكية',
    tech_math_elec: 'تقني رياضي - هندسة كهربائية',
    tech_math_methods: 'تقني رياضي - هندسة الطرائق',
    management: 'تسيير واقتصاد',
    languages: 'لغات أجنبية',
    arts: 'آداب وفلسفة'
};

function normalizeArabicDigits(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[٠-٩]/g, function (digit) {
        return '٠١٢٣٤٥٦٧٨٩'.indexOf(digit);
    });
}

function extractNumericValue(value) {
    const normalized = normalizeArabicDigits(value);
    if (!normalized) return null;
    const match = normalized.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}

function naturalTextCompare(a, b) {
    return normalizeArabicDigits(a || '').localeCompare(normalizeArabicDigits(b || ''), 'ar', {
        numeric: true,
        sensitivity: 'base'
    });
}

function sortLevels(levels) {
    return levels.slice().sort(function (a, b) {
        const aNum = extractNumericValue(a);
        const bNum = extractNumericValue(b);

        if (aNum !== null && bNum !== null && aNum !== bNum) {
            return aNum - bNum;
        }

        return naturalTextCompare(a, b);
    });
}

function sortClasses(classes) {
    return classes.slice().sort(function (a, b) {
        const aNum = extractNumericValue(a);
        const bNum = extractNumericValue(b);

        if (aNum !== null && bNum !== null && aNum !== bNum) {
            return aNum - bNum;
        }

        return naturalTextCompare(a, b);
    });
}

function uniqueValues(items) {
    return Array.from(new Set(items.filter(Boolean)));
}

function formatDateDisplay(value) {
    if (!value) return EMPTY_VALUE;

    const stringValue = String(value).trim();
    if (!stringValue) return EMPTY_VALUE;

    if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
        const parts = stringValue.split('-');
        return [parts[2], parts[1], parts[0]].join('/');
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(stringValue)) {
        return stringValue;
    }

    return stringValue;
}

function formatGender(value) {
    const normalized = String(value || '').trim().toLowerCase();

    if (normalized === 'm' || normalized === 'male' || value === 'ذكر') return 'ذكر';
    if (normalized === 'f' || normalized === 'female' || value === 'أنثى') return 'أنثى';

    return value || EMPTY_VALUE;
}

function getStreamLabel(value) {
    if (!value) return EMPTY_VALUE;
    return STREAM_LABELS[value] || value;
}

function normalizeStudent(student) {
    return Object.assign({}, student, {
        class: student.class || student.class_number || '',
        birth_date: student.birth_date || student.date_of_birth || '',
        stream: student.stream || ''
    });
}

function getStudentKey(student) {
    return student.class + '_' + ((student.last_name || '') + (student.first_name || '')).replace(/\s+/g, '') + '_' + student.birth_date;
}

function getStudentPrimaryNumber(student) {
    if (student.order !== undefined && student.order !== null && String(student.order).trim() !== '') {
        return student.order;
    }

    if (student.reg_number) return student.reg_number;
    if (student.national_id) return student.national_id;

    return '';
}

function getStudentNumberValue(student, fallback) {
    const numeric = extractNumericValue(getStudentPrimaryNumber(student));
    return numeric !== null ? numeric : fallback;
}

function getStudentDisplayNumber(student, fallback) {
    const primary = getStudentPrimaryNumber(student);
    return primary ? String(primary) : String(fallback);
}

function isFinalLevel(level, stage) {
    const expectedNumber = FINAL_LEVEL_BY_STAGE[stage];
    if (!expectedNumber) return true;

    return extractNumericValue(level) === expectedNumber;
}

function getFinalLevelOptions(students, stage) {
    const allLevels = sortLevels(uniqueValues(students.map(function (student) {
        return student.level;
    })));

    if (!allLevels.length) return [];

    const finalLevels = allLevels.filter(function (level) {
        return isFinalLevel(level, stage);
    });

    return finalLevels.length ? finalLevels : allLevels;
}

function createStudentComparator() {
    return function (studentA, studentB) {
        const orderA = getStudentNumberValue(studentA, Number.MAX_SAFE_INTEGER);
        const orderB = getStudentNumberValue(studentB, Number.MAX_SAFE_INTEGER);

        if (orderA !== orderB) return orderA - orderB;

        const regCompare = naturalTextCompare(studentA.reg_number || '', studentB.reg_number || '');
        if (regCompare !== 0) return regCompare;

        const lastNameCompare = naturalTextCompare(studentA.last_name || '', studentB.last_name || '');
        if (lastNameCompare !== 0) return lastNameCompare;

        return naturalTextCompare(studentA.first_name || '', studentB.first_name || '');
    };
}

function FilterField(props) {
    return e('div', { className: 'slips-field' }, [
        e('label', { key: 'label', htmlFor: props.id }, props.label),
        props.children
    ]);
}

function ModeOption(props) {
    return e('button', {
        type: 'button',
        className: 'slips-mode-option' + (props.active ? ' is-active' : ''),
        onClick: props.onClick
    }, [
        e('strong', { key: 'title' }, props.title),
        e('span', { key: 'description' }, props.description)
    ]);
}

function EmptyState(props) {
    return e('div', { className: props.className || 'slips-empty' }, props.message);
}

function SlipCard(props) {
    const student = props.student;
    const metaItems = [
        { key: 'birth', label: 'تاريخ الميلاد', value: formatDateDisplay(student.birth_date) },
        { key: 'gender', label: 'الجنس', value: formatGender(student.gender) },
        { key: 'level', label: 'المستوى', value: student.level || EMPTY_VALUE }
    ];

    if (props.showStream) {
        metaItems.push({ key: 'stream', label: 'الشعبة', value: getStreamLabel(student.stream) });
    }

    metaItems.push({ key: 'class', label: 'القسم', value: student.class || EMPTY_VALUE });

    return e('article', {
        className: 'slip-card'
    }, [
        e('div', { key: 'top', className: 'slip-card-top' }, [
            e('div', { key: 'badge', className: 'slip-number-badge' }, 'رقم ' + props.displayNumber),
            e('div', { key: 'copy', className: 'slip-header-center' }, [
                e('div', { key: 'subtitle', className: 'slip-subtitle' }, props.subtitle || 'الامتحان التجريبي دورة ماي 2026'),
                e('h3', { key: 'name', className: 'slip-student-name' }, ((student.last_name || '') + ' ' + (student.first_name || '')).trim() || 'بدون اسم')
            ])
        ]),
        e('div', { key: 'meta', className: 'slip-meta-grid' },
            metaItems.map(function (item) {
                return e('div', {
                    key: item.key,
                    className: 'slip-meta-item'
                }, [
                    e('span', { key: 'label', className: 'slip-meta-label' }, item.label),
                    e('span', { key: 'value', className: 'slip-meta-value' }, item.value)
                ]);
            })
        )
    ]);
}

function SlipsChunk(props) {
    return e('section', {
        className: 'slips-chunk' + (props.chunk.pageBreak ? ' page-break-before' : '')
    }, [
        props.chunk.title
            ? e('h3', { key: 'title', className: 'slips-chunk-title' }, props.chunk.title)
            : null,
        e('div', { key: 'grid', className: 'slips-grid' },
            props.chunk.students.map(function (student) {
                const accentColor = student.__numberValue % 2 === 1 ? props.oddColor : props.evenColor;

                return e(SlipCard, {
                    key: (student.reg_number || student.order || student.national_id || student.last_name || '') + '_' + student.__sortIndex,
                    student: student,
                    showStream: props.showStream,
                    displayNumber: student.__displayNumber,
                    accentColor: accentColor,
                    subtitle: props.subtitle
                });
            })
        )
    ]);
}

function App() {
    const [students, setStudents] = useState([]);
    const [examGroupings, setExamGroupings] = useState({});
    const [settings, setSettings] = useState(null);
    const [selectedLevel, setSelectedLevel] = useState('');
    const [selectedStream, setSelectedStream] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [printMode, setPrintMode] = useState('stripe');
    const [oddColor, setOddColor] = useState('#2563eb');
    const [evenColor, setEvenColor] = useState('#f97316');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [customWidth, setCustomWidth] = useState(80);
    const [customHeight, setCustomHeight] = useState(40);
    const [slipSubtitle, setSlipSubtitle] = useState('الامتحان التجريبي دورة ماي 2026');

    useEffect(function () {
        let mounted = true;

        async function loadPageData() {
            try {
                const values = await Promise.all([
                    DB.getSettings(),
                    DB.getStudents(false),
                    DB.get('examGroupings')
                ]);

                if (!mounted) return;

                const loadedSettings = values[0] || {};
                const loadedStudents = (values[1] || []).map(normalizeStudent);
                const loadedGroupings = values[2] || {};

                const normalizedGroupings = {};
                
                Object.keys(loadedGroupings).forEach(function(key) {
                    const parts = key.split('_');
                    if (parts.length >= 4) {
                        const dob = parts.pop();
                        const first = parts.pop();
                        const last = parts.pop();
                        const cls = parts.pop();
                        const robustKey = cls + '_' + (last + first).replace(/\s+/g, '') + '_' + dob;
                        normalizedGroupings[robustKey] = loadedGroupings[key];
                    }
                });

                setSettings(loadedSettings);
                setStudents(loadedStudents);
                setExamGroupings(normalizedGroupings);
                setError('');
            } catch (loadError) {
                if (!mounted) return;
                setError('تعذر تحميل بيانات التلاميذ. يرجى المحاولة مرة أخرى.');
            } finally {
                if (mounted) setLoading(false);
            }
        }

        loadPageData();

        return function () {
            mounted = false;
        };
    }, []);

    const stage = (settings && settings.educationStage) || 'middle';
    const isSecondary = stage === 'secondary';

    const levelOptions = useMemo(function () {
        return getFinalLevelOptions(students, stage);
    }, [students, stage]);

    useEffect(function () {
        if (!levelOptions.length) {
            if (selectedLevel) setSelectedLevel('');
            return;
        }

        if (!selectedLevel || levelOptions.indexOf(selectedLevel) === -1) {
            setSelectedLevel(levelOptions[0]);
            setSelectedStream('');
        }
    }, [levelOptions, selectedLevel]);

    const streamOptions = useMemo(function () {
        if (!selectedLevel) return [];

        return uniqueValues(students.filter(function (student) {
            return student.level === selectedLevel && student.stream;
        }).map(function (student) {
            return student.stream;
        })).sort(function (a, b) {
            return naturalTextCompare(getStreamLabel(a), getStreamLabel(b));
        });
    }, [students, selectedLevel]);

    const requiresStreamSelection = isSecondary && streamOptions.length > 1;

    const groupOptions = useMemo(function () {
        if (!selectedLevel) return [];
        const groups = new Set();
        students.forEach(function (student) {
            if (student.level !== selectedLevel) return;
            if (isSecondary && selectedStream && student.stream !== selectedStream) return;
            const key = getStudentKey(student);
            const group = examGroupings[key];
            if (group) groups.add(String(group));
        });
        return Array.from(groups).sort(function (a, b) { return parseInt(a) - parseInt(b); });
    }, [students, selectedLevel, selectedStream, examGroupings, isSecondary]);

    useEffect(function () {
        if (!selectedLevel) {
            if (selectedStream) setSelectedStream('');
            if (selectedGroup) setSelectedGroup('');
            return;
        }

        if (selectedStream && streamOptions.indexOf(selectedStream) === -1) {
            setSelectedStream('');
        }

        if (!selectedStream && streamOptions.length === 1) {
            setSelectedStream(streamOptions[0]);
        }

        if (selectedGroup && groupOptions.indexOf(String(selectedGroup)) === -1) {
            setSelectedGroup('');
        }
    }, [selectedLevel, selectedStream, selectedGroup, streamOptions, groupOptions]);

    const preparedStudents = useMemo(function () {
        if (!selectedLevel) return [];
        if (requiresStreamSelection && !selectedStream) return [];

        const scopedStudents = students.filter(function (student) {
            if (student.level !== selectedLevel) return false;
            if (isSecondary && selectedStream && student.stream !== selectedStream) return false;
            
            const key = getStudentKey(student);
            const group = examGroupings[key];
            if (!group) return false;

            if (selectedGroup && String(group) !== String(selectedGroup)) return false;
            
            return true;
        }).sort(createStudentComparator());

        return scopedStudents.map(function (student, index) {
            const fallbackNumber = index + 1;
            const key = getStudentKey(student);
            return Object.assign({}, student, {
                __displayNumber: getStudentDisplayNumber(student, fallbackNumber),
                __numberValue: getStudentNumberValue(student, fallbackNumber),
                __sortIndex: fallbackNumber,
                __examGroup: examGroupings[key] || null
            });
        });
    }, [students, selectedLevel, selectedStream, selectedGroup, examGroupings, isSecondary, requiresStreamSelection]);

    const oddStudents = useMemo(function () {
        return preparedStudents.filter(function (student) {
            return student.__numberValue % 2 === 1;
        });
    }, [preparedStudents]);

    const evenStudents = useMemo(function () {
        return preparedStudents.filter(function (student) {
            return student.__numberValue % 2 === 0;
        });
    }, [preparedStudents]);

    const chunks = useMemo(function () {
        if (printMode === 'group') {
            const groupsMap = {};
            preparedStudents.forEach(function (student) {
                const g = student.__examGroup || 'بدون فوج';
                if (!groupsMap[g]) groupsMap[g] = [];
                groupsMap[g].push(student);
            });
            const result = [];
            const sortedKeys = Object.keys(groupsMap).sort(function (a, b) {
                const numA = parseInt(a);
                const numB = parseInt(b);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
            });
            sortedKeys.forEach(function (g, index) {
                result.push({
                    key: 'group_' + g,
                    title: g === 'بدون فوج' ? g : 'الفوج ' + g,
                    students: groupsMap[g],
                    pageBreak: index > 0
                });
            });
            return result;
        }

        if (printMode !== 'split') {
            return [{ key: 'all', title: '', students: preparedStudents, pageBreak: false }];
        }

        const result = [];

        if (oddStudents.length) {
            result.push({
                key: 'odd',
                title: 'القصاصات الفردية',
                students: oddStudents,
                pageBreak: false
            });
        }

        if (evenStudents.length) {
            result.push({
                key: 'even',
                title: 'القصاصات الزوجية',
                students: evenStudents,
                pageBreak: oddStudents.length > 0
            });
        }

        return result;
    }, [preparedStudents, printMode, oddStudents, evenStudents]);

    const selectionSummary = selectedLevel
        ? [
            selectedLevel,
            isSecondary && selectedStream ? getStreamLabel(selectedStream) : '',
            selectedGroup ? 'الفوج ' + selectedGroup : 'كل الأفواج'
        ].filter(Boolean).join(' - ')
        : '';

    function handlePrint() {
        if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {
            const message = (typeof Auth.getBlockedMessage === 'function')
                ? Auth.getBlockedMessage('print')
                : 'الطباعة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.';
            if (typeof Swal !== 'undefined' && Swal.fire) {
                Swal.fire({ icon: 'warning', title: 'تنبيه', text: message });
            } else {
                alert(message);
            }
            return;
        }
        window.print();
    }

    function getSelectionPrompt() {
        if (!selectedLevel) return 'اختر المستوى النهائي لعرض القصاصات.';
        if (requiresStreamSelection && !selectedStream) return 'اختر الشعبة أولاً.';
        if (groupOptions.length === 0) return 'يجب تفويج المستوى في صفحة قوائم الاختبار.';
        return '';
    }

    return e('div', { className: 'slips-page' }, [
        e('style', { key: 'dynamic-print-styles' }, `
            @media print {
                .slips-grid { grid-template-columns: repeat(2, ${customWidth}mm) !important; }
                .slip-card { height: ${customHeight}mm !important; }
            }
        `),

        e('section', { key: 'controls', className: 'slips-controls no-print' }, [
            e('div', { key: 'filters', className: 'slips-card' }, [
                e('h2', { key: 'title' }, 'تحديد القسم النهائي'),
                e('p', { key: 'note', className: 'slips-card-note' }, 'الخيارات المعروضة مخصصة للأقسام النهائية فقط. اختر المستوى ثم الشعبة في الثانوي ثم القسم لعرض القصاصات الجاهزة للطباعة.'),
                e('div', { key: 'grid', className: 'slips-filters-grid' }, [
                    e(FilterField, {
                        key: 'level-field',
                        id: 'slips-level',
                        label: 'المستوى'
                    }, e('select', {
                        id: 'slips-level',
                        value: selectedLevel,
                        onChange: function (event) {
                            setSelectedLevel(event.target.value);
                            setSelectedStream('');
                        }
                    }, [
                        e('option', { key: 'empty-level', value: '' }, '-- اختر المستوى --')
                    ].concat(levelOptions.map(function (level) {
                        return e('option', { key: level, value: level }, level);
                    })))),
                    isSecondary ? e(FilterField, {
                        key: 'stream-field',
                        id: 'slips-stream',
                        label: 'الشعبة'
                    }, e('select', {
                        id: 'slips-stream',
                        value: selectedStream,
                        disabled: !selectedLevel || !streamOptions.length,
                        onChange: function (event) {
                            setSelectedStream(event.target.value);
                        }
                    }, [
                        e('option', { key: 'empty-stream', value: '' }, requiresStreamSelection ? '-- اختر الشعبة --' : '-- كل الشعب --')
                    ].concat(streamOptions.map(function (stream) {
                        return e('option', { key: stream, value: stream }, getStreamLabel(stream));
                    })))) : null,
                    e(FilterField, {
                        key: 'group-field',
                        id: 'slips-group',
                        label: 'الفوج'
                    }, e('select', {
                        id: 'slips-group',
                        value: selectedGroup,
                        disabled: !selectedLevel || !groupOptions.length,
                        onChange: function (event) {
                            setSelectedGroup(event.target.value);
                        }
                    }, [
                        e('option', { key: 'empty-group', value: '' }, '-- كل الأفواج --')
                    ].concat(groupOptions.map(function (group) {
                        return e('option', { key: group, value: group }, 'فوج ' + group);
                    }))))
                ])
            ]),
            e('div', { key: 'print-actions', className: 'slips-card slips-print-actions' }, [
                e('div', { key: 'mode-copy' }, [
                    e('h2', { key: 'title' }, 'خيارات الطباعة'),
                    e('p', { key: 'note', className: 'slips-card-note' }, 'يمكنك التمييز بين الفردي والزوجي بشريط جانبي ملون، أو فصل كل مجموعة في صفحة مستقلة عند الطباعة.')
                ]),
                e('div', { key: 'modes', className: 'slips-mode-toggle' }, [
                    e(ModeOption, {
                        key: 'stripe',
                        active: printMode === 'stripe',
                        title: 'شريط جانبي ملون',
                        description: 'الفردي والزوجي في نفس الصفحة مع لونين مختلفين.',
                        onClick: function () {
                            setPrintMode('stripe');
                        }
                    }),
                    e(ModeOption, {
                        key: 'split',
                        active: printMode === 'split',
                        title: 'فصل الفردي والزوجي',
                        description: 'يبدأ الزوجي في صفحة جديدة أثناء الطباعة.',
                        onClick: function () {
                            setPrintMode('split');
                        }
                    }),
                    e(ModeOption, {
                        key: 'group',
                        active: printMode === 'group',
                        title: 'فصل بالأفواج',
                        description: 'كل فوج في صفحة مستقلة.',
                        onClick: function () {
                            setPrintMode('group');
                        }
                    })
                ]),
                printMode === 'stripe' ? e('div', { key: 'colors', className: 'slips-color-grid' }, [
                    e(FilterField, {
                        key: 'odd-color',
                        id: 'odd-color',
                        label: 'لون الفردي'
                    }, e('input', {
                        id: 'odd-color',
                        type: 'color',
                        value: oddColor,
                        onChange: function (event) {
                            setOddColor(event.target.value);
                        }
                    })),
                    e(FilterField, {
                        key: 'even-color',
                        id: 'even-color',
                        label: 'لون الزوجي'
                    }, e('input', {
                        id: 'even-color',
                        type: 'color',
                        value: evenColor,
                        onChange: function (event) {
                            setEvenColor(event.target.value);
                        }
                    }))
                ]) : null,
                e('div', { key: 'dimensions', className: 'slips-color-grid', style: { marginTop: printMode === 'stripe' ? '0' : '16px' } }, [
                    e(FilterField, {
                        key: 'width-field',
                        id: 'custom-width',
                        label: 'العرض (ملم)'
                    }, e('input', {
                        id: 'custom-width',
                        type: 'number',
                        value: customWidth,
                        min: 40,
                        max: 105,
                        onChange: function (event) {
                            setCustomWidth(event.target.value);
                        }
                    })),
                    e(FilterField, {
                        key: 'height-field',
                        id: 'custom-height',
                        label: 'الارتفاع (ملم)'
                    }, e('input', {
                        id: 'custom-height',
                        type: 'number',
                        value: customHeight,
                        min: 30,
                        max: 100,
                        onChange: function (event) {
                            setCustomHeight(event.target.value);
                        }
                    }))
                ]),
                e('div', { key: 'subtitle-input', className: 'slips-field', style: { marginTop: '16px', marginBottom: '16px' } }, [
                    e('label', { key: 'subtitle-label', htmlFor: 'slip-subtitle' }, 'العبارة أسفل الاسم'),
                    e('input', {
                        key: 'subtitle-field',
                        id: 'slip-subtitle',
                        type: 'text',
                        value: slipSubtitle,
                        onChange: function (event) {
                            setSlipSubtitle(event.target.value);
                        }
                    })
                ]),
                e('button', {
                    key: 'print-button',
                    type: 'button',
                    className: 'slips-print-button',
                    disabled: !preparedStudents.length,
                    onClick: handlePrint
                }, [
                    e('i', { key: 'icon', className: 'fas fa-print', style: { marginLeft: '8px' } }),
                    'طباعة القصاصات'
                ])
            ])
        ]),
        e('section', { key: 'summary', className: 'slips-toolbar no-print' }, [
            e('div', { key: 'summary-items', className: 'slips-summary' }, [
                e('span', { key: 'count', className: 'slips-stat' }, 'عدد القصاصات: ' + preparedStudents.length),
                e('span', { key: 'odd-count', className: 'slips-stat' }, 'الفردي: ' + oddStudents.length),
                e('span', { key: 'even-count', className: 'slips-stat' }, 'الزوجي: ' + evenStudents.length)
            ]),
            e('div', { key: 'hint', className: 'slips-card-note', style: { marginTop: 0 } },
                selectionSummary || getSelectionPrompt()
            )
        ]),
        e('section', { key: 'surface', className: 'slips-surface' },
            loading
                ? e(EmptyState, { className: 'slips-loading', message: 'جار تحميل بيانات التلاميذ...' })
                : error
                    ? e(EmptyState, { className: 'slips-error', message: error })
                    : !preparedStudents.length
                        ? e(EmptyState, { 
                            className: getSelectionPrompt() === 'يجب تفويج المستوى في صفحة قوائم الاختبار.' ? 'slips-error' : 'slips-empty',
                            message: getSelectionPrompt() || 'لا يوجد تلاميذ مطابقون للاختيار الحالي.' 
                        })
                        : chunks.map(function (chunk) {
                            return e(SlipsChunk, {
                                key: chunk.key,
                                chunk: chunk,
                                oddColor: oddColor,
                                evenColor: evenColor,
                                showStream: isSecondary,
                                subtitle: slipSubtitle
                            });
                        })
        )
    ]);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(App));
