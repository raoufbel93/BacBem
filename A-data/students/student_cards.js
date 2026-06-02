/**
 * Student Card Generator - React Component
 * ES5 compatible for Windows 7 / Electron 22
 * Uses React.createElement (no JSX)
 */

var e = React.createElement;

// Card type definitions
var CARD_TYPES = [
    { id: 'school_id', label: 'بطاقة التعريف المدرسية', icon: 'fa-id-card' },
    { id: 'library', label: 'بطاقة المكتبة', icon: 'fa-book' },
    { id: 'half_board', label: 'بطاقة نصف داخلي', icon: 'fa-utensils' }
];

var CARD_TEMPLATES = [
    { id: 'classic', label: 'كلاسيكي', icon: 'fa-th-large' },
    { id: 'modern', label: 'عصري', icon: 'fa-bolt' },
    { id: 'formal', label: 'رسمي', icon: 'fa-stamp' },
    { id: 'official', label: 'وزاري', icon: 'fa-landmark' }
];

var DEFAULT_CONFIG = {
    cardType: 'school_id',
    cardTemplate: 'classic',
    headerColor: '#6d28d9',
    textColor: '#1e293b',
    fontSize: 'medium',
    customTitle: '',
    titleColor: '#ffffff',
    schoolYear: '',
    directorate: '',
    printBack: false,
    backTitle: 'تعليمات إدارية',
    backInstructions: '• هذه البطاقة شخصية ولا يجوز إعارتها.\n• في حال الضياع، يرجى التبليغ فوراً.\n• يرجى إعادة البطاقة للمؤسسة إذا وجدت.'
};

// ==================== HELPER ====================
function getStatusLabel(s) {
    if (!s) return 'خارجي';
    var map = { 'external': 'خارجي', 'half_board': 'نصف داخلي', 'boarding': 'داخلي', 'خارجي': 'خارجي', 'نصف داخلي': 'نصف داخلي', 'داخلي': 'داخلي' };
    return map[s] || s;
}

function getStreamLabel(s) {
    if (!s) return '';
    var map = {
        'common_science': 'جذع مشترك علوم وتكنولوجيا', 'common_arts': 'جذع مشترك آداب',
        'science': 'علوم تجريبية', 'scientific': 'علوم تجريبية',
        'math': 'رياضيات', 'maths': 'رياضيات',
        'tech_math': 'تقني رياضي', 'tech_math_civil': 'تقني رياضي (هندسة مدنية)',
        'tech_math_mech': 'تقني رياضي (هندسة ميكانيكية)', 'tech_math_elec': 'تقني رياضي (هندسة كهربائية)',
        'tech_math_methods': 'تقني رياضي (هندسة الطرائق)',
        'management': 'تسيير واقتصاد', 'languages': 'لغات أجنبية', 'foreign_languages': 'لغات أجنبية',
        'arts': 'آداب وفلسفة', 'literary': 'آداب وفلسفة', 'letters': 'آداب وفلسفة',
        'common_letters': 'جذع مشترك آداب'
    };
    return map[s] || s;
}

function formatDate(d) {
    if (!d) return '';
    var raw = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) { var p = raw.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
    return raw;
}

function normalizeLevelValue(levelValue) {
    if (window.AppAcademic && typeof window.AppAcademic.getCanonicalLevel === 'function') {
        return window.AppAcademic.getCanonicalLevel(levelValue) || '';
    }
    return levelValue == null ? '' : String(levelValue).trim();
}

function formatLevelValue(levelValue, isSecondary, includeStageLabel) {
    if (window.AppAcademic && typeof window.AppAcademic.formatLevel === 'function') {
        return window.AppAcademic.formatLevel(levelValue, isSecondary ? 'secondary' : 'middle', {
            includeStageLabel: includeStageLabel === true
        });
    }
    return normalizeLevelValue(levelValue);
}

function buildStudentClassInfo(student, isSecondary) {
    var levelLabel = formatLevelValue(student.level, isSecondary, false);
    return levelLabel + (isSecondary && student.stream ? ' - ' + getStreamLabel(student.stream) : '') + (student.class ? ' - ' + student.class : '');
}

// ==================== BARCODE COMPONENT ====================
function BarcodeCanvas(props) {
    var ref = React.useRef(null);
    React.useEffect(function () {
        if (ref.current && props.value) {
            try {
                JsBarcode(ref.current, String(props.value), {
                    format: 'CODE128', width: 1.2, height: 28, displayValue: false,
                    margin: 0, background: 'transparent'
                });
            } catch (err) { /* silent */ }
        }
    }, [props.value]);
    if (!props.value) return null;
    return e('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', marginTop: '-4px' } },
        e('svg', { ref: ref, className: 'sc-badge-barcode' }),
        e('span', { style: { fontSize: '0.45rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' } }, String(props.value))
    );
}

// ==================== BADGE CARD ====================
function BadgeCard(props) {
    var student = props.student;
    var config = props.config;
    var settings = props.settings;
    var isSecondary = props.isSecondary;

    var _ph = React.useState(null);
    var localPhoto = _ph[0];
    var setLocalPhoto = _ph[1];

    React.useEffect(function() {
        if (!student.id || student.id === 'preview') return;
        if (student.photo) {
            setLocalPhoto(student.photo);
            return;
        }
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('db-get-student-photo', student.id).then(function(res) {
                if (res && res.success && res.data) {
                    setLocalPhoto(res.data);
                } else {
                    setLocalPhoto(null);
                }
            });
        }
    }, [student.id, student.photo]);

    var template = config.cardTemplate || 'classic';
    var txtColor = config.textColor || '#1e293b';
    var cardType = config.cardType;
    var headerBg = config.headerColor || '#6d28d9';
    var titleColor = config.titleColor || '#ffffff';
    var titleText = config.customTitle;
    if (!titleText) {
        if (cardType === 'school_id') titleText = 'بطاقة التعريف المدرسية';
        else if (cardType === 'library') titleText = 'بطاقة المكتبة';
        else titleText = 'بطاقة نصف داخلي';
    }
    var instName = (settings && settings.institutionName) || 'المؤسسة التعليمية';
    var schoolYear = config.schoolYear || (settings && settings.schoolYear) || '';
    var idValue = student.national_id || student.reg_number || student.order || '';
    var classInfo = buildStudentClassInfo(student, isSecondary);
    var fSize = config.fontSize === 'small' ? '0.85em' : config.fontSize === 'large' ? '1.1em' : '1em';
    var statusRow = cardType === 'half_board' ? e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'الصفة: '), e('span', { className: 'val' }, getStatusLabel(student.status))) : null;

    function handlePhotoClick() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg, image/png, image/webp';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(evt) {
                var img = new Image();
                img.onload = function() {
                    var canvas = document.createElement('canvas');
                    var ctx = canvas.getContext('2d');
                    var MAX_WIDTH = 250;
                    var MAX_HEIGHT = 300;
                    var width = img.width;
                    var height = img.height;
                    
                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    if (props.onPhotoUpdate && student.id) {
                        setLocalPhoto(dataUrl);
                        props.onPhotoUpdate(student.id, dataUrl);
                    } else if (!student.id) {
                        // For the preview card with no ID, just update local display if possible
                        // (Not really possible without a state in BadgeCard, but let's avoid errors)
                        console.warn('Cannot update photo: Student has no ID');
                    }
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    var userSvg = e('svg', { viewBox: '0 0 24 24', width: '40', height: '40', fill: 'none', stroke: '#94a3b8', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' },
        e('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
        e('circle', { cx: '12', cy: '7', r: '4' })
    );
    var showPhotos = config.showPhotos !== false;
    var photoElement = (showPhotos && localPhoto) ? e('img', { src: localPhoto, alt: 'صورة' }) : userSvg;

    // ---- TEMPLATE: MODERN ----
    if (template === 'modern') {
        return e('div', { className: 'sc-badge sc-badge--modern', style: { fontSize: fSize } },
            e('div', { className: 'sc-badge--modern-bar', style: { background: 'linear-gradient(135deg, ' + headerBg + ', ' + headerBg + 'bb)' } },
                e('span', { style: { fontWeight: 800, fontSize: '0.9em', color: titleColor } }, titleText),
                e('span', { style: { fontSize: '0.48rem', opacity: 0.9, color: titleColor } }, schoolYear || '')
            ),
            e('div', { className: 'sc-badge--modern-body' },
                e('div', { className: 'sc-badge-photo', onClick: handlePhotoClick }, photoElement),
                e('div', { className: 'sc-badge--modern-details' },
                    e('div', { style: { fontSize: '0.5rem', color: '#000000', fontWeight: 700, marginBottom: '2px' } }, instName),
                    e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'اللقب: '), e('span', { className: 'val' }, student.last_name || '')),
                    e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'الاسم: '), e('span', { className: 'val' }, student.first_name || '')),
                    e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'ت.الميلاد: '), e('span', { className: 'val' }, formatDate(student.birth_date))),
                    e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'القسم: '), e('span', { className: 'val' }, classInfo)),
                    statusRow
                )
            ),
            e('div', { className: 'sc-badge-footer', style: { borderTop: '1px solid ' + headerBg + '22' } },
                e(BarcodeCanvas, { value: idValue }),
                e('div', { className: 'sc-badge-stamp' }, settings && settings.managerName ? 'ختم وإمضاء المدير' : '')
            )
        );
    }

    // ---- TEMPLATE: FORMAL ----
    if (template === 'formal') {
        return e('div', { className: 'sc-badge sc-badge--formal', style: { fontSize: fSize, borderColor: headerBg } },
            e('div', { className: 'sc-badge--formal-inner', style: { borderColor: headerBg + '44' } },
                e('div', { style: { textAlign: 'center', padding: '4px 8px 2px', borderBottom: '1px solid ' + headerBg + '22' } },
                    e('div', { style: { fontWeight: 800, fontSize: '0.95em', color: titleColor } }, titleText),
                    e('div', { style: { fontSize: '0.5rem', color: titleColor, fontWeight: 700 } }, instName + (schoolYear ? ' — ' + schoolYear : ''))
                ),
                e('div', { className: 'sc-badge-body' },
                    e('div', { className: 'sc-badge-photo', onClick: handlePhotoClick }, photoElement),
                    e('div', { className: 'sc-badge-info' },
                        e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'اللقب: '), e('span', { className: 'val' }, student.last_name || '')),
                        e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'الاسم: '), e('span', { className: 'val' }, student.first_name || '')),
                        e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'تاريخ الميلاد: '), e('span', { className: 'val' }, formatDate(student.birth_date))),
                        e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'القسم: '), e('span', { className: 'val' }, classInfo)),
                        statusRow
                    )
                ),
                e('div', { className: 'sc-badge-footer' },
                    e(BarcodeCanvas, { value: idValue }),
                    e('div', { className: 'sc-badge-stamp' }, settings && settings.managerName ? 'ختم وإمضاء المدير' : '')
                )
            )
        );
    }

    // ---- TEMPLATE: OFFICIAL ----
    if (template === 'official') {
        var dirName = config.directorate || 'مديرية التربية لولاية ...';
        return e('div', { className: 'sc-badge sc-badge--official', style: { fontSize: fSize } },
            e('div', { className: 'sc-badge--official-header' },
                e('div', { className: 'sc-badge--official-republic' }, 'الجمهورية الجزائرية الديمقراطية الشعبية'),
                e('div', { className: 'sc-badge--official-ministry' }, 'وزارة التربية الوطنية'),
                e('div', { className: 'sc-badge--official-directorate' }, dirName),
                e('div', { className: 'sc-badge--official-title', style: { color: titleColor, background: headerBg + '22', borderTop: '1.5px solid ' + headerBg + '44', borderBottom: '1.5px solid ' + headerBg + '44', padding: '2px 0', margin: '4px 0', fontWeight: 'bold' } }, titleText),
                e('div', { className: 'sc-badge--official-inst', style: { color: titleColor } }, instName + (schoolYear ? ' — ' + schoolYear : ''))
            ),
            e('div', { className: 'sc-badge-body', style: { paddingTop: '2px', alignItems: 'center' } },
                e('div', { className: 'sc-badge-photo', onClick: handlePhotoClick }, photoElement),
                e('div', { className: 'sc-badge-info' },
                    e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'اللقب: '), e('span', { className: 'val' }, student.last_name || '')),
                    e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'الاسم: '), e('span', { className: 'val' }, student.first_name || '')),
                    e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'تاريخ الميلاد: '), e('span', { className: 'val' }, formatDate(student.birth_date))),
                    e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'القسم: '), e('span', { className: 'val' }, classInfo)),
                    statusRow
                )
            ),
            e('div', { className: 'sc-badge-footer' },
                e(BarcodeCanvas, { value: idValue }),
                e('div', { className: 'sc-badge-stamp' }, settings && settings.managerName ? 'ختم وإمضاء المدير' : '')
            )
        );
    }

    // ---- TEMPLATE: CLASSIC (default) ----
    return e('div', { className: 'sc-badge', style: { fontSize: fSize } },
        e('div', { className: 'sc-badge-header', style: { background: 'linear-gradient(135deg, ' + headerBg + ', ' + headerBg + 'cc)' } },
            e('h3', { style: { color: titleColor } }, titleText),
            e('p', { style: { color: titleColor } }, instName + (schoolYear ? ' — ' + schoolYear : ''))
        ),
        e('div', { className: 'sc-badge-body' },
            e('div', { className: 'sc-badge-photo', onClick: handlePhotoClick }, photoElement),
            e('div', { className: 'sc-badge-info' },
                e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'اللقب: '), e('span', { className: 'val' }, student.last_name || '')),
                e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'الاسم: '), e('span', { className: 'val' }, student.first_name || '')),
                e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'تاريخ الميلاد: '), e('span', { className: 'val' }, formatDate(student.birth_date))),
                e('div', { className: 'sc-badge-row' }, e('span', { className: 'lbl' }, 'القسم: '), e('span', { className: 'val' }, classInfo)),
                statusRow
            )
        ),
        e('div', { className: 'sc-badge-footer' },
            e(BarcodeCanvas, { value: idValue }),
            e('div', { className: 'sc-badge-stamp' }, config.stampText || (settings && settings.managerName ? 'ختم وإمضاء المدير' : ''))
        )
    );
}

// ==================== MAIN APP ====================
function StudentCardGenerator() {
    var _st1 = React.useState([]);       var students = _st1[0]; var setStudents = _st1[1];
    var _st2 = React.useState({});       var settings = _st2[0]; var setSettings = _st2[1];
    var _st3 = React.useState(false);    var isSecondary = _st3[0]; var setIsSecondary = _st3[1];
    var _st4 = React.useState(DEFAULT_CONFIG); var config = _st4[0]; var setConfig = _st4[1];
    var _st5 = React.useState('');       var levelFilter = _st5[0]; var setLevelFilter = _st5[1];
    var _st6 = React.useState('');       var streamFilter = _st6[0]; var setStreamFilter = _st6[1];
    var _st7 = React.useState('');       var classFilter = _st7[0]; var setClassFilter = _st7[1];
    var _st8 = React.useState('');       var statusFilter = _st8[0]; var setStatusFilter = _st8[1];
    var _st9 = React.useState({});       var selected = _st9[0]; var setSelected = _st9[1];
    var _st10 = React.useState(true);    var loading = _st10[0]; var setLoading = _st10[1];
    var _st11 = React.useState('students'); var activeTab = _st11[0]; var setActiveTab = _st11[1];
    var _st12 = React.useState(''); var searchQuery = _st12[0]; var setSearchQuery = _st12[1];
    var _st11 = React.useState('students'); var activeTab = _st11[0]; var setActiveTab = _st11[1];
    var _st12 = React.useState(''); var searchQuery = _st12[0]; var setSearchQuery = _st12[1];

    // Load data
    React.useEffect(function () {
        Promise.all([DB.getStudents(false), DB.getSettings()]).then(function (res) {
            var studs = res[0] || [];
            var sett = res[1] || {};
            setStudents(studs);
            setSettings(sett);
            setIsSecondary(sett.educationStage === 'secondary');
            if (sett.schoolYear || sett.wilaya) setConfig(function (c) { 
                var n = {}; for (var k in c) n[k] = c[k]; 
                if (sett.schoolYear) n.schoolYear = sett.schoolYear; 
                if (sett.wilaya) n.directorate = 'مديرية التربية لولاية ' + sett.wilaya;
                return n; 
            });
            setLoading(false);
        });
    }, []);

    function updateConfig(key, val) {
        setConfig(function (c) { var n = {}; for (var k in c) n[k] = c[k]; n[key] = val; return n; });
    }

    function handlePhotoUpdate(studentId, photoDataUrl) {
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('db-update-student', {
                id: studentId,
                updates: { photo: photoDataUrl }
            }).then(function(res) {
                if (res && res.success) {
                    setStudents(function(prev) {
                        return prev.map(function(s) {
                            if (s.id === studentId) {
                                var newStudent = {};
                                for (var k in s) newStudent[k] = s[k];
                                newStudent.photo = photoDataUrl;
                                return newStudent;
                            }
                            return s;
                        });
                    });
                } else {
                    console.error('Failed to save photo:', res);
                }
            }).catch(function(err) {
                console.error('IPC Error saving photo:', err);
            });
        }
    }

    // Filtered students
    var filtered = students.filter(function (s) {
        if (levelFilter && normalizeLevelValue(s.level) !== levelFilter) return false;
        if (streamFilter && s.stream !== streamFilter) return false;
        if (classFilter && s.class !== classFilter) return false;
        if (statusFilter && getStatusLabel(s.status) !== statusFilter) return false;
        if (searchQuery) {
            var term = searchQuery.toLowerCase();
            var full = ((s.first_name || '') + ' ' + (s.last_name || '')).toLowerCase();
            var fullRev = ((s.last_name || '') + ' ' + (s.first_name || '')).toLowerCase();
            if (full.indexOf(term) === -1 && fullRev.indexOf(term) === -1) return false;
        }
        return true;
    });

    // Unique values for filters
    var levels = [], streams = [], classes = [], statuses = [];
    var _lSet = {}, _sSet = {}, _cSet = {}, _stSet = {};
    students.forEach(function (s) {
        var normalizedLevel = normalizeLevelValue(s.level);
        if (normalizedLevel && !_lSet[normalizedLevel]) { levels.push(normalizedLevel); _lSet[normalizedLevel] = 1; }
        if (s.stream && !_sSet[s.stream]) { streams.push(s.stream); _sSet[s.stream] = 1; }
        if (s.class && !_cSet[s.class]) { classes.push(s.class); _cSet[s.class] = 1; }
        var normStatus = getStatusLabel(s.status);
        if (normStatus && !_stSet[normStatus]) { statuses.push(normStatus); _stSet[normStatus] = 1; }
    });
    levels.sort(function (a, b) {
        if (window.AppAcademic && typeof window.AppAcademic.getLevelRank === 'function') {
            return window.AppAcademic.getLevelRank(a) - window.AppAcademic.getLevelRank(b);
        }
        return String(a).localeCompare(String(b));
    });

    // Classes filtered by level
    var filteredClasses = [];
    var _fcSet = {};
    students.forEach(function (s) {
        if (levelFilter && normalizeLevelValue(s.level) !== levelFilter) return;
        if (streamFilter && s.stream !== streamFilter) return;
        if (s.class && !_fcSet[s.class]) { filteredClasses.push(s.class); _fcSet[s.class] = 1; }
    });

    var selectedCount = Object.keys(selected).filter(function (k) { return selected[k]; }).length;
    var selectedStudents = filtered.filter(function (s, i) { return selected[i]; });

    function toggleStudent(idx) {
        setSelected(function (prev) { var n = {}; for (var k in prev) n[k] = prev[k]; n[idx] = !n[idx]; return n; });
    }

    function selectAll() {
        var allSelected = filtered.length > 0 && filtered.every(function (_, i) { return selected[i]; });
        var n = {};
        if (!allSelected) { filtered.forEach(function (_, i) { n[i] = true; }); }
        setSelected(n);
    }

    function printCards() {
        if (selectedStudents.length === 0) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار تلميذ واحد على الأقل' });
            }
            return;
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({ title: 'جاري التحضير...', text: 'يتم الآن جلب صور البطاقات.', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });
        }

        Promise.all(selectedStudents.map(function(s) {
            if (!window.ipcRenderer || !s.id) return Promise.resolve(s);
            return window.ipcRenderer.invoke('db-get-student-photo', s.id).then(function(res) {
                var newS = {};
                for (var k in s) newS[k] = s[k];
                if (res && res.success && res.data) {
                    newS.photo = res.data;
                } else {
                    newS.photo = null;
                }
                return newS;
            });
        })).then(function(studentsWithPhotos) {
            if (typeof Swal !== 'undefined') Swal.close();

            var printWin = window.open('', '_blank');
            var cardsHtml = '';
            var tpl = config.cardTemplate || 'classic';
            studentsWithPhotos.forEach(function (student, idx) {
            var idVal = student.national_id || student.reg_number || student.order || '';
            var titleText = config.customTitle;
            if (!titleText) {
                if (config.cardType === 'school_id') titleText = 'بطاقة التعريف المدرسية';
                else if (config.cardType === 'library') titleText = 'بطاقة المكتبة';
                else titleText = 'بطاقة نصف داخلي';
            }
            var instName = (settings.institutionName) || 'المؤسسة التعليمية';
            var yr = config.schoolYear || settings.schoolYear || '';
            var hdrBg = config.headerColor || '#6d28d9';
            var txtColor = config.textColor || '#1e293b';
            var tColor = config.titleColor || '#ffffff';
            var classInfo = buildStudentClassInfo(student, isSecondary);
            var statusRow = config.cardType === 'half_board' ? '<div class="row"><span class="lbl">الصفة: </span><span class="val">' + getStatusLabel(student.status) + '</span></div>' : '';
            var infoRows = '<div class="row"><span class="lbl">اللقب: </span><span class="val">' + (student.last_name || '') + '</span></div>' +
                '<div class="row"><span class="lbl">الاسم: </span><span class="val">' + (student.first_name || '') + '</span></div>' +
                '<div class="row"><span class="lbl">تاريخ الميلاد: </span><span class="val">' + formatDate(student.birth_date) + '</span></div>' +
                '<div class="row"><span class="lbl">القسم: </span><span class="val">' + classInfo + '</span></div>' + statusRow;
            var userSvgHtml = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
            var showPhotos = config.showPhotos !== false;
                var photoHtml = (showPhotos && student.photo) ? '<img src="' + student.photo + '">' : userSvgHtml;
            var footerHtml = '<div class="badge-footer"><div style="display:flex;flex-direction:column;align-items:center;gap:0.3mm"><svg id="bc-' + idx + '"></svg><span class="bc-id">' + idVal + '</span></div><div class="stamp">' + (settings.managerName ? 'ختم وإمضاء المدير' : '') + '</div></div>';

            if (tpl === 'modern') {
                cardsHtml += '<div class="badge modern"><div class="accent" style="background:linear-gradient(135deg,' + hdrBg + ',' + hdrBg + 'bb)"><span style="font-weight:800;font-size:0.65em;color:' + tColor + '">' + titleText + '</span><span style="font-size:0.48em;opacity:0.9;color:' + tColor + '">' + (yr || '') + '</span></div>' +
                    '<div class="m-top"><div class="photo">' + photoHtml + '</div><div class="m-title"><div style="font-size:0.5em;color:#000000;font-weight:700;margin-bottom:0.3mm">' + instName + '</div>' + infoRows + '</div></div>' +
                    footerHtml + '</div>';
            } else if (tpl === 'formal') {
                cardsHtml += '<div class="badge formal" style="border-color:' + hdrBg + '"><div class="f-inner" style="border-color:' + hdrBg + '44">' +
                    '<div style="text-align:center;padding:1mm 2mm 0.5mm;border-bottom:0.3mm solid ' + hdrBg + '22"><div style="font-weight:800;font-size:0.7em;color:' + tColor + '">' + titleText + '</div><div style="font-size:0.5em;color:' + tColor + '">' + instName + (yr ? ' — ' + yr : '') + '</div></div>' +
                    '<div class="badge-body"><div class="photo">' + photoHtml + '</div><div class="info">' + infoRows + '</div></div>' + footerHtml + '</div></div>';
            } else if (tpl === 'official') {
                var dirName = config.directorate || 'مديرية التربية لولاية ...';
                cardsHtml += '<div class="badge official">' +
                    '<div class="o-header"><div class="o-rep">الجمهورية الجزائرية الديمقراطية الشعبية</div><div class="o-min">وزارة التربية الوطنية</div><div class="o-dir">' + dirName + '</div><div class="o-title" style="color:' + tColor + '; background:' + hdrBg + '22; border-top:0.4mm solid ' + hdrBg + '44; border-bottom:0.4mm solid ' + hdrBg + '44; padding:0.5mm 0; margin:1mm 0;">' + titleText + '</div><div class="o-inst">' + instName + (yr ? ' — ' + yr : '') + '</div></div>' +
                    '<div class="badge-body" style="padding-top:0.5mm;align-items:center"><div class="photo" style="height:22mm">' + photoHtml + '</div><div class="info">' + infoRows + '</div></div>' + footerHtml + '</div>';
            } else {
                cardsHtml += '<div class="badge"><div class="badge-header" style="background:linear-gradient(135deg,' + hdrBg + ',' + hdrBg + 'cc)">' +
                    '<h3 style="color:' + tColor + '">' + titleText + '</h3><p style="color:' + tColor + '">' + instName + (yr ? ' — ' + yr : '') + '</p></div>' +
                    '<div class="badge-body"><div class="photo">' + photoHtml + '</div><div class="info">' + infoRows + '</div></div>' + footerHtml + '</div>';
            }
        });

        var fontPath = '../assets/fonts/Cairo-Regular.ttf';
        var fontBoldPath = '../assets/fonts/Cairo-Bold.ttf';

        // Print toolbar
        var toolbarHead = (typeof PrintToolbarHelper !== 'undefined') ? PrintToolbarHelper.getHeadContent() : '';
        var toolbarHtml = (typeof PrintToolbarHelper !== 'undefined') ? PrintToolbarHelper.getToolbarHtml({ advanced: false }) : '';
        var toolbarScript = (typeof PrintToolbarHelper !== 'undefined') ? PrintToolbarHelper.getScriptHtml({ advanced: false }) : '';

        var printCss = '<style>@font-face{font-family:"Cairo";src:url("' + fontPath + '") format("truetype");font-weight:normal}' +
            '@font-face{font-family:"Cairo";src:url("' + fontBoldPath + '") format("truetype");font-weight:bold}' +
            '*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}' +
            '.cards-container{font-family:"Cairo",sans-serif;padding:8mm;display:flex;flex-wrap:wrap;gap:6mm;justify-content:center;direction:rtl}' +
            '.badge{width:85mm;height:55mm;border:1px solid #ccc;border-radius:3mm;overflow:hidden;page-break-inside:avoid;font-size:0.82em}' +
            '.badge-header{padding:2mm 3mm;text-align:center;color:#fff}' +
            '.badge-header h3{font-size:0.95em;font-weight:800;margin:0;line-height:1.3}.badge-header p{font-size:0.6em;margin:0;opacity:0.9}' +
            '.badge-body{display:flex;flex-direction:row-reverse;gap:2mm;padding:2mm 3mm}.photo{width:20mm;height:23mm;border-radius:2mm;border:0.5mm solid #ddd;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:1.4em;flex-shrink:0;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover}.photo svg{width:50%;height:50%}' +
            '.info{flex:1;display:flex;flex-direction:column;justify-content:center;gap:0.3mm}' +
            '.row{display:flex;gap:1mm;font-size:0.65em;line-height:1.4}.lbl{color:#000000;font-weight:700;white-space:nowrap}.val{font-weight:800;color:#000000}' +
            '.badge-footer{padding:1mm 3mm 2mm;display:flex;align-items:center;justify-content:space-between;border-top:0.3mm solid #f1f5f9}' +
            '.badge-footer svg{height:7mm;width:auto}.stamp{font-size:0.5em;color:#94a3b8;font-weight:700}.bc-id{font-size:0.45em;color:#64748b;font-weight:700;letter-spacing:0.3mm}' +
            '.modern{display:flex;flex-direction:column;border-radius:3.5mm}' +
            '.modern .accent{padding:1.5mm 3mm;color:#fff;display:flex;justify-content:space-between;align-items:center;border-radius:3.5mm 3.5mm 0 0}' +
            '.m-content{flex:1;display:flex;flex-direction:column;min-width:0}' +
            '.m-top{display:flex;flex-direction:row-reverse;gap:2.5mm;padding:1.5mm 3mm;flex:1}' +
            '.m-title{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:0.2mm}' +
            '.modern .photo{width:18mm;height:21mm;border-radius:2.5mm;border:none;box-shadow:0 0.5mm 2mm rgba(0,0,0,0.08)}' +
            '.modern .badge-footer{padding:0.5mm 3mm 1.5mm}' +
            '.formal{border:0.7mm solid;border-radius:2.5mm;padding:0.8mm}' +
            '.f-inner{border:0.3mm solid;border-radius:1.5mm;height:100%;display:flex;flex-direction:column;overflow:hidden}' +
            '.formal .photo{width:19mm;height:22mm}.formal .badge-body{padding:1mm 2mm}.formal .badge-footer{margin-top:auto;padding:0.5mm 2mm 1mm}' +
            '.official{border:0.3mm solid #cbd5e1;border-radius:2.5mm;display:flex;flex-direction:column;height:62mm}' +
            '.o-header{text-align:center;padding:1.5mm 2.5mm 1mm;border-bottom:0.5mm solid #e2e8f0}' +
            '.o-rep{font-weight:800;font-size:0.6em;color:#000000;letter-spacing:0.1mm}' +
            '.o-min{font-weight:700;font-size:0.5em;color:#000000;margin-top:0.5mm}' +
            '.o-dir{font-weight:700;font-size:0.45em;color:#000000;margin-top:0.2mm}' +
            '.o-title{font-weight:800;font-size:0.8em;margin-top:1.5mm;border-top:0.2mm solid #d4edda;border-bottom:0.2mm solid #d4edda;}' +
            '.o-inst{font-size:0.45em;color:#000000;font-weight:700;margin-top:0.2mm}' +
            '.official .badge-body{padding:1mm 2.5mm}.official .badge-footer{margin-top:auto;padding:0.5mm 2.5mm 1.5mm;border-top:none}' +
            '.badge-back{width:83mm;height:53mm;border:0.2mm solid #eee;border-radius:2.5mm;padding:4mm;display:flex;flex-direction:column;justify-content:center;text-align:center;background:#fff;page-break-inside:avoid;direction:rtl;margin:1mm auto;box-sizing:border-box;}' +
            '.back-title{font-weight:800;font-size:1em;color:#1e293b;margin-bottom:3mm;text-decoration:underline}' +
            '.back-text{font-size:0.65em;line-height:1.8;color:#334155;text-align:right;white-space:pre-line}' +
            '@media print{.no-print{display:none !important}body{padding:0}@page{margin:5mm;size:A4}}</style>';

        printWin.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طباعة البطاقات</title>' +
            '<link rel="stylesheet" href="../assets/fontawesome/css/all.min.css">' +
            toolbarHead + printCss +
            '</head><body>' + toolbarHtml +
            '<div class="cards-container">' + cardsHtml + '</div>');

        if (config.printBack) {
            var backCardsHtml = '';
            var backText = config.backInstructions || '';
            var backTitle = config.backTitle || 'تعليمات إدارية';
            selectedStudents.forEach(function () {
                backCardsHtml += '<div class="badge-back"><div class="back-title">' + backTitle + '</div><div class="back-text">' + backText + '</div></div>';
            });
            printWin.document.write('<div style="page-break-before:always"></div><div class="cards-container">' + backCardsHtml + '</div>');
        }

        printWin.document.write(toolbarScript + '</body></html>');

        printWin.document.close();

        // Generate barcodes using parent window's JsBarcode
        setTimeout(function () {
            selectedStudents.forEach(function (student, idx) {
                var idVal = student.national_id || student.reg_number || student.order || '';
                if (idVal) {
                    try {
                        var el = printWin.document.getElementById('bc-' + idx);
                        if (el) JsBarcode(el, String(idVal), { format: 'CODE128', width: 1, height: 22, displayValue: false, margin: 0, background: 'transparent' });
                    } catch (err) { }
                }
            });
        }, 300);
        }); // Close the Promise.then
    }

    if (loading) {
        return e('div', { className: 'sc-page', style: { textAlign: 'center', paddingTop: '80px' } },
            e('i', { className: 'fas fa-spinner fa-spin', style: { fontSize: '2rem', color: '#8b5cf6' } }),
            e('p', { style: { marginTop: '12px', fontWeight: 700, color: '#64748b' } }, 'جاري تحميل البيانات...')
        );
    }

    // ===== RENDER =====
    return e('div', { className: 'sc-page no-print' },
        // Header
        e('div', { className: 'sc-page-header' },
            e('div', { className: 'sc-page-header-icon' }, e('i', { className: 'fas fa-id-card' })),
            e('div', null,
                e('h1', null, 'بطاقات التلاميذ'),
                e('p', null, 'توليد وطباعة بطاقات التلاميذ بأنواع مختلفة')
            )
        ),

        e('div', { className: 'sc-grid' },
            // ===== PREVIEW PANEL (Main Area) =====
            e('div', { className: 'sc-panel', style: { position: 'sticky', top: '20px' } },
                e('div', { className: 'sc-panel-header' }, e('i', { className: 'fas fa-eye' }), 'معاينة البطاقة'),
                e('div', { className: 'sc-preview-area' },
                    e('div', { className: 'sc-preview-label' }, e('i', { className: 'fas fa-ruler-combined' }), 'مقاس البطاقة: 8.5سم × ' + (config.cardTemplate === 'official' ? '6.2سم' : '5.5سم')),
                    e('div', { style: { fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginBottom: '16px', textAlign: 'center' } },
                        e('i', { className: 'fas fa-info-circle', style: { marginLeft: '6px', color: '#8b5cf6' } }),
                        'لتغيير صورة التلميذ، قم بالنقر عليها مباشرة في المعاينة.'
                    ),
                    selectedStudents.length > 0
                        ? e('div', { className: 'sc-print-grid' },
                            selectedStudents.slice(0, 8).map(function (s, i) {
                                return e(BadgeCard, { key: i, student: s, config: config, settings: settings, isSecondary: isSecondary, onPhotoUpdate: handlePhotoUpdate });
                            }),
                            selectedStudents.length > 8 ? e('p', { style: { width: '100%', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 700, marginTop: '12px' } }, '... و ' + (selectedStudents.length - 8) + ' بطاقة أخرى ستظهر عند الطباعة') : null
                        )
                        : e('div', { style: { textAlign: 'center', padding: '40px 20px' } },
                            e(BadgeCard, {
                                student: { id: 'preview', last_name: 'بن أحمد', first_name: 'محمد', birth_date: '2010-03-15', level: 'أولى', class: '1م1', national_id: '123456789', status: 'half_board', stream: '' },
                                config: config, settings: settings, isSecondary: isSecondary, onPhotoUpdate: handlePhotoUpdate
                            }),
                            e('p', { style: { marginTop: '18px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700 } }, e('i', { className: 'fas fa-arrow-left', style: { marginLeft: '6px' } }), 'حدد تلاميذ من القائمة لمعاينة بطاقاتهم')
                        )
                )
            ),

            // ===== SIDEBAR (Controls) =====
            e('div', null,
                // Tabs
                e('div', { className: 'sc-sidebar-tabs' },
                    e('div', { className: 'sc-sidebar-tab' + (activeTab === 'students' ? ' active' : ''), onClick: function() { setActiveTab('students'); } }, e('i', { className: 'fas fa-users', style: { marginLeft: '6px' } }), 'التلاميذ'),
                    e('div', { className: 'sc-sidebar-tab' + (activeTab === 'design' ? ' active' : ''), onClick: function() { setActiveTab('design'); } }, e('i', { className: 'fas fa-paint-brush', style: { marginLeft: '6px' } }), 'التصميم'),
                    e('div', { className: 'sc-sidebar-tab' + (activeTab === 'settings' ? ' active' : ''), onClick: function() { setActiveTab('settings'); } }, e('i', { className: 'fas fa-cog', style: { marginLeft: '6px' } }), 'الإعدادات')
                ),

                // Content: Students Tab
                e('div', { style: { display: activeTab === 'students' ? 'block' : 'none' } },
                    e('div', { className: 'sc-panel' },
                        e('div', { className: 'sc-panel-header' }, e('i', { className: 'fas fa-filter' }), 'تصفية وبحث'),
                        e('div', { className: 'sc-panel-body' },
                            e('div', { className: 'sc-search-wrap' },
                                e('i', { className: 'fas fa-search' }),
                                e('input', { type: 'text', placeholder: 'بحث عن تلميذ بالاسم...', value: searchQuery, onChange: function(e) { setSearchQuery(e.target.value); } })
                            ),
                            e('div', { className: 'sc-field' },
                                e('label', null, 'المستوى'),
                                e('select', { value: levelFilter, onChange: function (ev) { setLevelFilter(ev.target.value); setClassFilter(''); setSelected({}); } },
                                    e('option', { value: '' }, '-- الكل --'),
                                    levels.map(function (l) { return e('option', { key: l, value: l }, formatLevelValue(l, isSecondary, false)); })
                                )
                            ),
                            e('div', { className: 'sc-field' },
                                e('label', null, 'القسم'),
                                e('select', { value: classFilter, onChange: function (ev) { setClassFilter(ev.target.value); setSelected({}); } },
                                    e('option', { value: '' }, '-- الكل --'),
                                    filteredClasses.map(function (c) { return e('option', { key: c, value: c }, c); })
                                )
                            ),
                            isSecondary ? e('div', { className: 'sc-field' },
                                e('label', null, 'الشعبة'),
                                e('select', { value: streamFilter, onChange: function (ev) { setStreamFilter(ev.target.value); setClassFilter(''); setSelected({}); } },
                                    e('option', { value: '' }, '-- الكل --'),
                                    streams.map(function (s) { return e('option', { key: s, value: s }, getStreamLabel(s)); })
                                )
                            ) : null,
                            e('div', { className: 'sc-field' },
                                e('label', null, 'الصفة'),
                                e('select', { value: statusFilter, onChange: function (ev) { setStatusFilter(ev.target.value); setSelected({}); } },
                                    e('option', { value: '' }, '-- الكل --'),
                                    statuses.map(function (s) { return e('option', { key: s, value: s }, getStatusLabel(s)); })
                                )
                            ),
                            e('div', { className: 'sc-student-count' }, e('i', { className: 'fas fa-users', style: { fontSize: '0.7rem' } }), 'مجموع: ' + filtered.length + (selectedCount > 0 ? ' | محدد: ' + selectedCount : '')),
                            e('div', { className: 'sc-student-list' },
                                e('div', { className: 'sc-select-all', onClick: selectAll },
                                    e('input', { type: 'checkbox', checked: filtered.length > 0 && filtered.every(function (_, i) { return selected[i]; }), readOnly: true }),
                                    'تحديد/إلغاء الكل'
                                ),
                                filtered.map(function (s, i) {
                                    return e('div', { key: i, className: 'sc-student-item', onClick: function () { toggleStudent(i); } },
                                        e('input', { type: 'checkbox', checked: !!selected[i], readOnly: true }),
                                        e('span', { className: 'sc-student-name' }, (s.last_name || '') + ' ' + (s.first_name || '')),
                                        e('span', { className: 'sc-student-class' }, s.class || '')
                                    );
                                })
                            )
                        )
                    ),
                    e('div', { className: 'sc-btn-group', style: { marginTop: '16px' } },
                        e('button', { className: 'sc-btn sc-btn-primary', style: { width: '100%', padding: '12px', fontSize: '0.9rem' }, onClick: printCards },
                            e('i', { className: 'fas fa-print' }), 'طباعة البطاقات المحددة (' + selectedCount + ')'
                        )
                    )
                ),

                // Content: Design Tab
                e('div', { style: { display: activeTab === 'design' ? 'block' : 'none' } },
                    e('div', { className: 'sc-panel' },
                        e('div', { className: 'sc-panel-header' }, e('i', { className: 'fas fa-layer-group' }), 'نوع البطاقة'),
                        e('div', { className: 'sc-panel-body' },
                            e('div', { className: 'sc-type-tabs' },
                                CARD_TYPES.map(function (ct) {
                                    return e('div', {
                                        key: ct.id,
                                        className: 'sc-type-tab' + (config.cardType === ct.id ? ' active' : ''),
                                        onClick: function () { updateConfig('cardType', ct.id); }
                                    }, e('i', { className: 'fas ' + ct.icon, style: { marginLeft: '4px' } }), ct.label);
                                })
                            )
                        )
                    ),
                    e('div', { className: 'sc-panel' },
                        e('div', { className: 'sc-panel-header' }, e('i', { className: 'fas fa-swatchbook' }), 'نموذج البطاقة'),
                        e('div', { className: 'sc-panel-body' },
                            e('div', { className: 'sc-type-tabs' },
                                CARD_TEMPLATES.map(function (ct) {
                                    return e('div', {
                                        key: ct.id,
                                        className: 'sc-type-tab' + (config.cardTemplate === ct.id ? ' active' : ''),
                                        onClick: function () { updateConfig('cardTemplate', ct.id); }
                                    }, e('i', { className: 'fas ' + ct.icon, style: { marginLeft: '4px' } }), ct.label);
                                })
                            )
                        )
                    ),
                    e('div', { className: 'sc-panel' },
                        e('div', { className: 'sc-panel-header' }, e('i', { className: 'fas fa-palette' }), 'التخصيص'),
                        e('div', { className: 'sc-panel-body' },
                            e('div', { className: 'sc-field' },
                                e('label', null, 'عنوان البطاقة (اختياري)'),
                                e('input', { type: 'text', value: config.customTitle, placeholder: 'عنوان مخصص...', onChange: function (ev) { updateConfig('customTitle', ev.target.value); } })
                            ),
                            e('div', { className: 'sc-row' },
                                e('div', { className: 'sc-field' },
                                    e('label', null, 'لون الرأسية'),
                                    e('input', { type: 'color', value: config.headerColor, onChange: function (ev) { updateConfig('headerColor', ev.target.value); } })
                                ),
                                e('div', { className: 'sc-field' },
                                    e('label', null, 'لون العنوان'),
                                    e('input', { type: 'color', value: config.titleColor || '#ffffff', onChange: function (ev) { updateConfig('titleColor', ev.target.value); } })
                                ),
                                e('div', { className: 'sc-field' },
                                    e('label', null, 'حجم الخط'),
                                    e('select', { value: config.fontSize, onChange: function (ev) { updateConfig('fontSize', ev.target.value); } },
                                        e('option', { value: 'small' }, 'صغير'),
                                        e('option', { value: 'medium' }, 'متوسط'),
                                        e('option', { value: 'large' }, 'كبير')
                                    )
                                )
                            ),
                            e('div', { className: 'sc-row', style: { marginTop: '12px' } },
                                e('div', { className: 'sc-field' },
                                    e('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' } },
                                        e('input', { 
                                            type: 'checkbox', 
                                            checked: config.showPhotos !== false, 
                                            onChange: function (ev) { updateConfig('showPhotos', ev.target.checked); },
                                            style: { width: '18px', height: '18px', margin: 0 }
                                        }),
                                        'إظهار صور التلاميذ في البطاقات'
                                    )
                                )
                            )
                        )
                    )
                ),

                // Content: Settings Tab
                e('div', { style: { display: activeTab === 'settings' ? 'block' : 'none' } },
                    e('div', { className: 'sc-panel' },
                        e('div', { className: 'sc-panel-header' }, e('i', { className: 'fas fa-building' }), 'إعدادات المؤسسة'),
                        e('div', { className: 'sc-panel-body' },
                            e('div', { className: 'sc-field' },
                                e('label', null, 'السنة الدراسية'),
                                e('input', { type: 'text', value: config.schoolYear, placeholder: '2025/2026', onChange: function (ev) { updateConfig('schoolYear', ev.target.value); } })
                            ),
                            e('div', { className: 'sc-field' },
                                e('label', null, 'مديرية التربية (للبطاقة الوزارية)'),
                                e('input', { type: 'text', value: config.directorate, placeholder: 'مديرية التربية لولاية...', onChange: function (ev) { updateConfig('directorate', ev.target.value); } })
                            )
                        )
                    ),
                    e('div', { className: 'sc-panel' },
                        e('div', { className: 'sc-panel-header' }, e('i', { className: 'fas fa-redo' }), 'الوجه الخلفي للبطاقة'),
                        e('div', { className: 'sc-panel-body' },
                            e('div', { className: 'sc-field', style: { flexDirection: 'row', alignItems: 'center', gap: '8px', display: 'flex' } },
                                e('input', { type: 'checkbox', id: 'printBack', checked: config.printBack, onChange: function (ev) { updateConfig('printBack', ev.target.checked); } }),
                                e('label', { htmlFor: 'printBack', style: { margin: 0, cursor: 'pointer' } }, 'تفعيل طباعة ظهر البطاقة')
                            ),
                            config.printBack ? e('div', null,
                                e('div', { className: 'sc-field' },
                                    e('label', null, 'عنوان الظهر'),
                                    e('input', { type: 'text', value: config.backTitle, onChange: function (ev) { updateConfig('backTitle', ev.target.value); } })
                                ),
                                e('div', { className: 'sc-field' },
                                    e('label', null, 'التعليمات (سطر لكل نقطة)'),
                                    e('textarea', { 
                                        style: { width: '100%', minHeight: '100px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontFamily: 'inherit', fontSize: '0.85rem', background: 'var(--bg-color)', color: 'var(--primary-color)' },
                                        value: config.backInstructions, 
                                        onChange: function (ev) { updateConfig('backInstructions', ev.target.value); } 
                                    })
                                )
                            ) : null
                        )
                    )
                )
            )
        )
    );
}
// ==================== MOUNT ====================
document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('student-cards-root');
    if (root && typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
        DB.init().then(function () {
            ReactDOM.render(e(StudentCardGenerator), root);
        });
    }
});

