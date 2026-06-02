
function getStudentYear(s) {
    if (!s) return '';
    const y = s.academic_year || s.school_year || s.year || s.schoolYear || '';
    if (y) return y;
    for (const key in s) {
        if (typeof s[key] === 'string' && /\b20\d{2}\b/.test(s[key])) {
            const match = s[key].match(/\b20\d{2}([-/]20\d{2})?\b/);
            if (match) return match[0];
        }
    }
    return '';
}

let studentsData = [];
let targetStudents = [];
let institutionSettings = {};
let exemptSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Auth !== 'undefined') Auth.checkAuth();
    await loadData();
    populateFilters();
    
    document.getElementById('yearSelect').addEventListener('change', () => {
        populateFilters();
        analyzeTargetGroup();
    });
    document.getElementById('levelSelect').addEventListener('change', () => {
        populateStreams();
    });
    
    if (typeof IconManager !== 'undefined') IconManager.render();
});

async function loadData() {
    let rawResults = await DB.getResults(true) || [];
    const studentMap = new Map();
    
    for (const student of rawResults) {
        const cleanStr = (s) => (s || '').toString().trim();
        const normSection = (s) => (s || '').toString().trim().replace(/^0+/, '') || "1";
        
        const stYear = getStudentYear(student);
        const normName = cleanStr(student.name);
        const normDob = cleanStr(student.dob);
        const normClass = normSection(student.class);
        const normLevel = cleanStr(student.level);
        const normStream = cleanStr(student.stream);
        
        const uniqueKey = `${stYear}|${normName}|${normDob}|${normClass}|${normLevel}|${normStream}`;

        const getTrimesterValue = (name) => {
            const n = (name || '').toString().toLowerCase();
            if (n.includes('2')) return '2';
            if (n.includes('3')) return '3';
            return '1';
        };
        const tVal = getTrimesterValue(student.trimester);
        const suffix = ` ف${tVal}`;
        
        let targetStudent;
        if (studentMap.has(uniqueKey)) {
            targetStudent = studentMap.get(uniqueKey);
        } else {
            targetStudent = { 
                ...student, 
                marks: {}, 
                averages: {}, 
                class: normSection(student.class),
                name: (student.name || '').trim(),
                dob: (student.dob || '').trim(),
                level: (student.level || '').trim(),
                stream: (student.stream || '').trim()
            };
            studentMap.set(uniqueKey, targetStudent);
        }
        
        if (student.marks) {
            Object.entries(student.marks).forEach(([sub, score]) => {
                const finalKey = (sub.includes(' ف') || sub.includes(' فصل')) ? sub : `${sub}${suffix}`;
                targetStudent.marks[finalKey] = score;
            });
        }
        if (student.averages) {
            Object.entries(student.averages).forEach(([t, avg]) => {
                if (avg !== undefined && avg !== null) targetStudent.averages[t] = parseFloat(avg) || 0;
            });
        }
        if (student.average !== undefined) targetStudent.averages[tVal] = parseFloat(student.average) || 0;
    }
    
    studentsData = Array.from(studentMap.values());
    institutionSettings = await DB.getSettings() || {};
    exemptSettings = await DB.get('exemptSubjects') || {};
}

function populateFilters() {
    populateYears();
    const levelSelect = document.getElementById('levelSelect');
    if (!levelSelect) return;
    
    let stage = institutionSettings.educationStage;
    if (!stage && studentsData.length > 0) {
        const sampleLvl = studentsData[0].level || '';
        stage = (sampleLvl.includes('ثانوي') || sampleLvl.includes('AS')) ? 'secondary' : 'middle';
    }
    stage = stage || 'middle';
    institutionSettings.educationStage = stage;

    let html = '<option value="all">كل المستويات</option>';
    if (stage === 'secondary') {
        html += '<option value="1">السنة الأولى</option><option value="2">السنة الثانية</option><option value="3">السنة الثالثة</option>';
    } else {
        html += '<option value="1">الأولى</option><option value="2">الثانية</option><option value="3">الثالثة</option><option value="4">الرابعة</option>';
    }
    levelSelect.innerHTML = html;
    populateStreams();
}

function populateYears() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;
    const years = new Set();
    studentsData.forEach(s => {
        const y = getStudentYear(s);
        if (y) years.add(y);
    });
    const sortedYears = [...years].sort((a,b) => b.localeCompare(a));
    let html = '';
    sortedYears.forEach(y => html += '<option value="' + y + '">' + y + '</option>');
    yearSelect.innerHTML = html;
    if (sortedYears.length > 0) yearSelect.value = sortedYears[0];
}

function populateStreams() {
    const levelSelect = document.getElementById('levelSelect')?.value;
    const streamSelect = document.getElementById('streamSelect');
    const streamGroup = document.getElementById('streamGroup');
    const stage = institutionSettings.educationStage || 'middle';
    const yr = document.getElementById('yearSelect')?.value;

    if (stage === 'secondary') {
        if (streamGroup) streamGroup.style.display = 'flex';
        if (streamSelect) {
            streamSelect.innerHTML = '<option value="">كل الشعب</option>';
            let streams = [];
            if (levelSelect === 'all') {
                streams = [...new Set(studentsData.filter(s => getStudentYear(s) === yr).map(s => s.stream).filter(s => s))].sort();
            } else {
                streams = (typeof SubjectManager !== 'undefined') ? SubjectManager.getStreams(levelSelect) : [];
            }
            streams.forEach(code => {
                const opt = document.createElement('option');
                opt.value = code;
                opt.textContent = (typeof SubjectManager !== 'undefined') ? SubjectManager.getStreamName(code) : code;
                streamSelect.appendChild(opt);
            });
        }
    } else {
        if (streamGroup) streamGroup.style.display = 'none';
    }
}

async function analyzeTargetGroup() {
    const selectedYear = document.getElementById('yearSelect')?.value;
    const minAvg = parseFloat(document.getElementById('minAvg').value) || 0;
    const maxAvg = parseFloat(document.getElementById('maxAvg').value) || 20;
    const subjectThreshold = parseFloat(document.getElementById('subjectThreshold').value) || 10;
    const selectedLevel = document.getElementById('levelSelect').value;
    const selectedStream = document.getElementById('streamSelect')?.value;
    
    const trimesters = Array.from(document.querySelectorAll('.trim-check:checked')).map(cb => cb.value);
    
    if (trimesters.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: "يرجى اختيار فصل دراسي واحد على الأقل." });
        return;
    }

    let filtered = studentsData.filter(s => !selectedYear || getStudentYear(s) === selectedYear);
    
    if (selectedLevel !== 'all') {
        filtered = filtered.filter(s => {
            if (selectedLevel === '1') return s.level.includes('1') || s.level.includes('أولى');
            if (selectedLevel === '2') return s.level.includes('2') || s.level.includes('ثانية');
            if (selectedLevel === '3') return s.level.includes('3') || s.level.includes('ثالثة');
            if (selectedLevel === '4') return s.level.includes('4') || s.level.includes('رابعة');
            return s.level === selectedLevel;
        });
    }
    
    if (selectedStream && selectedStream !== '') {
        filtered = filtered.filter(s => s.stream === selectedStream);
    }

    targetStudents = [];
    filtered.forEach(s => {
        let sum = 0;
        let count = 0;
        trimesters.forEach(t => {
            if (s.averages && s.averages[t] !== undefined) {
                sum += parseFloat(s.averages[t]);
                count++;
            }
        });
        
        if (count > 0) {
            const avg = sum / count;
            if (avg >= minAvg && avg <= maxAvg) {
                targetStudents.push({
                    ...s,
                    calculatedGeneralAvg: avg,
                    first_name: (s.name || '').split(' ').slice(1).join(' '),
                    last_name: (s.name || '').split(' ')[0]
                });
            }
        }
    });

    document.getElementById('analysisSummary').style.display = 'flex';
    document.getElementById('printActionBar').style.display = 'flex';
    document.getElementById('totalTargetCount').textContent = targetStudents.length;
    document.getElementById('rangeText').textContent = `${minAvg} - ${maxAvg}`;

    renderSubjectCards(targetStudents, trimesters, subjectThreshold);
}

function normalizeArabic(text) {
    if (!text) return "";
    return text.toString()
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ﻷ|ﻹ|ﻵ|ﻻ/g, 'لا')
        .replace(/لأ|لإ|لآ/g, 'لا')
        .replace(/\s+/g, ' ');
}

function mapSubjectToAnalysisLabel(subjectName) {
    const norm = normalizeArabic(subjectName);
    if (!norm) return null;

    if (norm.includes('عربي')) return 'عربية';
    if (norm.includes('امازيغي')) return 'أمازيغية';
    if (norm.includes('فرنسي')) return 'فرنسية';
    if (norm.includes('انجليزي')) return 'انجليزية';
    if (norm.includes('لغه ثالثه') || norm.includes('الاجنبيه الثالثه') || norm.includes('اللغة الاجنبية الثالثة') || norm.includes('المان') || norm.includes('اسبان') || norm.includes('ايطال')) return 'لغة 3';
    if (norm.includes('اسلام')) return 'اسلامية';
    if (norm.includes('مدني')) return 'مدنية';
    if (norm.includes('تاريخ') || norm.includes('جغرافيا') || norm.includes('اجتماعيات')) return 'تاريخ';
    if (norm.includes('رياضيات')) return 'رياضيات';
    if (norm.includes('طبيعه') || norm.includes('علوم طبيعيه') || norm === 'علوم') return 'علوم';
    if (norm.includes('هندسه')) return 'تكنولوجيا';
    if (norm.includes('تكنولوجيا')) return institutionSettings.educationStage === 'secondary' ? 'تكنولوجيا' : 'فيزياء';
    if (norm.includes('فيزياء') || norm.includes('فيزيائي')) return 'فيزياء';
    if (norm.includes('معلوماتي') || norm.includes('اعلام')) return 'معلوماتية';
    if (norm.includes('تشكيل') || norm.includes('فنيه') || norm.includes('رسم')) return 'ت.تشكيلية';
    if (norm.includes('موسيق')) return 'موسيقى';
    if (norm.includes('بدني') || norm.includes('رياضه') || norm.includes('eps') || norm.includes('sport')) return 'رياضة';
    if (norm.includes('فلسف')) return 'فلسفة';
    if (norm.includes('محاسب') || norm.includes('تسيير')) return 'محاسبة';
    if (norm.includes('اقتصاد') || norm.includes('مناجمنت')) return 'اقتصاد';
    if (norm.includes('قانون')) return 'قانون';
    return null;
}

const exemptionMap = {
    art: ['ت.تشكيلية', 'فنون تشكيلية', 'التربية التشكيلية', 'التربية الفنية', 'رسم', 'فنون'],
    music: ['موسيقى', 'التربية الموسيقية'],
    info: ['معلوماتية', 'اعلام', 'إعلام آلي'],
    ama: ['أمازيغية', 'الأمازيغية', 'اللغة الأمازيغية', 'اللغة اﻷمازيغية']
};

function getStudentsForCurrentContext() {
    const selectedYear = document.getElementById('yearSelect')?.value;
    const selectedLevel = document.getElementById('levelSelect')?.value || 'all';
    const selectedStream = document.getElementById('streamSelect')?.value || '';

    return studentsData.filter(s => {
        if (selectedYear && getStudentYear(s) !== selectedYear) return false;

        if (selectedLevel !== 'all') {
            let matchLevel = s.level === selectedLevel;
            if (selectedLevel === '1') matchLevel = s.level.includes('1') || s.level.includes('أولى');
            if (selectedLevel === '2') matchLevel = s.level.includes('2') || s.level.includes('ثانية');
            if (selectedLevel === '3') matchLevel = s.level.includes('3') || s.level.includes('ثالثة');
            if (selectedLevel === '4') matchLevel = s.level.includes('4') || s.level.includes('رابعة');
            if (!matchLevel) return false;
        }

        if (selectedStream && s.stream !== selectedStream) return false;
        return true;
    });
}

function getAnalysisSubjectPool() {
    const stage = institutionSettings.educationStage || 'middle';
    const selectedLevel = document.getElementById('levelSelect')?.value || 'all';
    const selectedStream = document.getElementById('streamSelect')?.value || '';
    const pool = new Set();

    if (typeof SubjectManager !== 'undefined') {
        if (stage === 'secondary') {
            const levels = selectedLevel !== 'all' ? [selectedLevel] : ['1', '2', '3'];
            levels.forEach(level => {
                const streams = selectedStream ? [selectedStream] : (SubjectManager.getStreams(level) || []);
                streams.forEach(streamCode => {
                    (SubjectManager.getSubjects('secondary', level, streamCode) || []).forEach(subjectName => {
                        const mapped = mapSubjectToAnalysisLabel(subjectName);
                        if (mapped) pool.add(mapped);
                    });
                });
            });
        } else {
            const levels = selectedLevel !== 'all' ? [selectedLevel] : ['1', '2', '3', '4'];
            levels.forEach(level => {
                (SubjectManager.getSubjects('middle', level) || []).forEach(subjectName => {
                    const mapped = mapSubjectToAnalysisLabel(subjectName);
                    if (mapped) pool.add(mapped);
                });
            });
        }
    }

    [
        'عربية', 'رياضيات', 'فرنسية', 'انجليزية', 'علوم', 'فيزياء',
        'تاريخ', 'اسلامية', 'مدنية', 'معلوماتية', 'موسيقى',
        'ت.تشكيلية', 'رياضة', 'أمازيغية', 'فلسفة', 'لغة 3',
        'محاسبة', 'اقتصاد', 'قانون', 'تكنولوجيا'
    ].forEach(subjectName => pool.add(subjectName));

    const subjectPool = Array.from(pool);
    if (window.ExemptSubjectsHelper && typeof window.ExemptSubjectsHelper.filterSubjects === 'function') {
        return window.ExemptSubjectsHelper.filterSubjects(subjectPool, {
            level: selectedLevel,
            students: getStudentsForCurrentContext(),
            exemptSubjects: exemptSettings,
            exemptionMap
        });
    }

    return subjectPool;
}

function getTrimesterScore(student, subjectName, trimester) {
    if (!student.marks) return null;
    const normTarget = normalizeArabic(subjectName);
    const keys = Object.keys(student.marks);
    const tPattern1 = new RegExp(`ف\\s*${trimester}(\\s|$)`);
    const tPattern2 = new RegExp(`فصل\\s*${trimester}(\\s|$)`);
    const isSecondary = institutionSettings.educationStage === 'secondary';

    const subjectAliases = {
        'علوم': ['علوم طبيعية', 'علوم طبيعية و حياة', 'ع.طبيعية', 'ع الطبيعة و الحياة', 'طبيعة و حياة', 'علوم الطبيعة والحياة', 'العلوم الطبيعة والحياة'],
        'فيزياء': isSecondary ? ['علوم فيزيائية', 'ع.فيزيائية'] : ['علوم فيزيائية', 'ع.فيزيائية', 'تكنولوجيا', 'ع الفيزيائية والتكنولوجيا', 'ع الفيزيائية و التكنولوجيا'],
        'تكنولوجيا': ['هندسة', 'هندسة مدنية', 'هندسة ميكانيكية', 'هندسة طرائق', 'هندسة كهربائية', 'تكنولوجيا'],
        'ت.تشكيلية': ['فنون تشكيلية', 'التربية التشكيلية', 'التربية الفنية', 'رسم', 'فنون'],
        'رياضيات': ['رياضيات'],
        'اسلامية': ['إسلامية', 'التربية الاسلامية', 'علوم اسلامية', 'العلوم الإسلامية'],
        'عربية': ['لغة عربية', 'اللغة العربية', 'أدب عربي'],
        'فرنسية': ['لغة فرنسية', 'اللغة الفرنسية'],
        'انجليزية': ['لغة انجليزية', 'اللغة الانجليزية'],
        'تاريخ': ['اجتماعيات', 'تاريخ و جغرافيا', 'تاريخ وجغرافيا', 'التاريخ والجغرافيا', 'التاريخ و الجغرافيا'],
        'مدنية': ['التربية المدنية'],
        'معلوماتية': ['اعلام آلي', 'إعلام آلي'],
        'موسيقى': ['التربية الموسيقية'],
        'رياضة': ['تربية بدنية', 'التربية البدنية', 'ت البدنية والرياضية', 'ت البدنية و الرياضية', 'ت. البدنية و الرياضية'],
        'أمازيغية': ['اللغة الأمازيغية', 'اللغة اﻷمازيغية', 'لغة امازيغية'],
        'فلسفة': ['الفلسفة', 'فلسفة'],
        'لغة 3': ['لغة 3', 'لغة ثالثة', 'لغة أجنبية 3', 'لغة اجنبية 3', 'لغة أجنبية ثالثة', 'لغة اجنبية ثالثة', 'اللغة الأجنبية الثالثة', 'اللغة اﻷجنبية الثالثة', 'اللغة الأجنبية 3', 'اللغة الثالثة', 'لغة أجنبية', 'اسبان', 'المان', 'ايطال', 'إسبان', 'ألمان', 'إيطال', 'الإسبانية', 'الألمانية', 'الإيطالية'],
        'محاسبة': ['تسيير المالي المحاسبي', 'تسيير مالي و محاسبي', 'تسيير محاسبي', 'تسيير مالي', 'محاسبة'],
        'اقتصاد': ['اقتصاد و مناجمنت', 'اقتصاد ومناجمنت', 'إقتصاد المانجمت', 'اقتصاد'],
        'قانون': ['القانون', 'قانون'],
        'هندسة مدنية': ['هندسة مدنية', 'هندسة المدنية'],
        'هندسة طرائق': ['هندسة طرائق', 'هندسة الطرائق'],
        'هندسة ميكانيكية': ['هندسة ميكانيكية', 'هندسة الميكانيكية'],
        'هندسة كهربائية': ['هندسة كهربائية', 'هندسة الكهربائية']
    };
    let bestMatchKey = keys.find(k => {
        const normKey = normalizeArabic(k);
        const isSubjectMatch = (normKey.includes(normTarget) ||
            (subjectAliases[subjectName] && subjectAliases[subjectName].some(alias => normKey.includes(normalizeArabic(alias)))));
        return isSubjectMatch && (tPattern1.test(normKey) || tPattern2.test(normKey));
    });

    if (!bestMatchKey) {
        bestMatchKey = keys.find(k => {
            const normKey = normalizeArabic(k);
            return (normKey.includes(normTarget) || (subjectAliases[subjectName] && subjectAliases[subjectName].some(alias => normKey.includes(normalizeArabic(alias)))));
        });
    }
    return bestMatchKey ? parseFloat(student.marks[bestMatchKey]) : null;
}

// Function to render subject cards
function renderSubjectCards(students, trimesters, threshold) {
    const grid = document.getElementById('subjectGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const allPossibleSubjects = getAnalysisSubjectPool();
    
    // Only analyze and display cards for subjects that actually exist for the selected students
    const activeSubjects = allPossibleSubjects.filter(subName => {
        return students.some(s => {
            return trimesters.some(t => getTrimesterScore(s, subName, t) !== null);
        });
    });
    
    activeSubjects.forEach(subName => {
        let subCount = 0;
        students.forEach(s => {
            let subSum = 0;
            let subTCount = 0;
            trimesters.forEach(t => {
                const score = getTrimesterScore(s, subName, t);
                if (score !== null) {
                    subSum += score;
                    subTCount++;
                }
            });
            
            if (subTCount > 0) {
                const subAvg = subSum / subTCount;
                if (subAvg < threshold) {
                    subCount++;
                }
            }
        });
        
        if (subCount > 0) {
            const card = document.createElement('div');
            card.className = 'subject-card animate-pop-in';
            card.innerHTML = `
                <div class="subject-header">
                    <span class="subject-name">${subName}</span>
                    <span style="background:#fee2e2; color:#ef4444; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:800;">${threshold} عتبة</span>
                </div>
                <div class="subject-body">
                    <div class="student-count">${subCount}</div>
                    <div class="student-label">تلميذ معني بالدعم</div>
                    <button class="btn-details" onclick="showSubjectDetails('${subName}', [${trimesters.map(t => `'${t}'`).join(',')}], ${threshold})">
                        عرض القائمة <span data-icon="chevron-left"></span>
                    </button>
                </div>
            `;
            grid.appendChild(card);
        }
    });

    if (grid.innerHTML === '') {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #94a3b8; font-weight: 700;">لا يوجد تلاميذ معنيين بالدعم حسب المعايير المختارة.</div>';
    }
    
    if (typeof IconManager !== 'undefined') IconManager.render();
}

function showSubjectDetails(subjectName, trimesters, threshold) {
    const modal = document.getElementById('detailsModal');
    const tableBody = document.getElementById('modalTableBody');
    const modalTitle = document.getElementById('modalTitle');
    const isSecondary = institutionSettings.educationStage === 'secondary';
    
    if (!modal || !tableBody || !modalTitle) return;

    // Update Header
    const thead = modal.querySelector('thead tr');
    if (thead) {
        thead.innerHTML = `
            <th>#</th>
            <th>اللقب والاسم</th>
            <th>المستوى</th>
            ${isSecondary ? '<th>الشعبة</th>' : ''}
            <th>القسم</th>
            <th>المعدل العام</th>
            <th>معدل المادة</th>
        `;
    }

    modalTitle.textContent = `قائمة المعنيين بالدعم في مادة ${subjectName}`;
    tableBody.innerHTML = '';
    
    let count = 1;
    targetStudents.forEach(s => {
        let subSum = 0;
        let subTCount = 0;
        trimesters.forEach(t => {
            const score = getTrimesterScore(s, subjectName, t);
            if (score !== null) {
                subSum += score;
                subTCount++;
            }
        });
        
        if (subTCount > 0) {
            const subAvg = subSum / subTCount;
            if (subAvg < threshold) {
                const tr = document.createElement('tr');
                const streamName = isSecondary ? ((typeof SubjectManager !== 'undefined') ? SubjectManager.getStreamName(s.stream) : s.stream) : '';
                
                tr.innerHTML = `
                    <td>${count++}</td>
                    <td>${s.name}</td>
                    <td>${s.level}</td>
                    ${isSecondary ? `<td>${streamName || '-'}</td>` : ''}
                    <td>${s.class}</td>
                    <td>${s.calculatedGeneralAvg.toFixed(2)}</td>
                    <td style="color:#ef4444; font-weight:800;">${subAvg.toFixed(2)}</td>
                `;
                tableBody.appendChild(tr);
            }
        }
    });
    
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('detailsModal');
    if (modal) modal.style.display = 'none';
}

function preparePrintHeader(subtitle = "") {
    const institutionType = institutionSettings.educationStage === 'secondary' ? 'ثانوية' : 'متوسطة';
    const institutionName = institutionSettings.schoolName || institutionSettings.institutionName || '....................';
    document.getElementById('printInstitution').textContent = `${institutionType} ${institutionName}`;
    
    const wilaya = institutionSettings.wilaya || '....................';
    document.getElementById('printDirectorate').textContent = `مديرية التربية لولاية ${wilaya}`;
    
    const yearSelect = document.getElementById('yearSelect');
    document.getElementById('printYear').textContent = `السنة الدراسية: ${yearSelect ? yearSelect.value : '---'}`;
    
    const munNode = document.getElementById('printMunicipality');
    if (munNode) {
        munNode.textContent = institutionSettings.municipality ? `بلدية: ${institutionSettings.municipality}` : '';
    }
    
    if (subtitle) {
        const levelSelect = document.getElementById('levelSelect');
        const levelText = levelSelect && levelSelect.options[levelSelect.selectedIndex] ? levelSelect.options[levelSelect.selectedIndex].text : '';
        
        let streamText = '';
        if (institutionSettings.educationStage === 'secondary') {
            const streamSelect = document.getElementById('streamSelect');
            if (streamSelect && streamSelect.value) {
                streamText = streamSelect.options[streamSelect.selectedIndex].text;
            }
        }
        
        const trimesters = Array.from(document.querySelectorAll('.trim-check:checked')).map(cb => cb.value);
        let trimText = trimesters.length > 0 ? 'الفصل ' + trimesters.join(' و ') : '';
        
        let details = [levelText, streamText, trimText].filter(Boolean).join(' | ');
        
        document.getElementById('printSubtitle').innerHTML = `<span style="font-weight: 800;">${subtitle}</span><br><span style="font-size: 13px; font-weight: 600; display: inline-block; margin-top: 6px; color: #475569;">${details}</span>`;
    }
}

function blockTrialPrint() {
    if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {
        const message = (typeof Auth.getBlockedMessage === 'function')
            ? Auth.getBlockedMessage('print')
            : 'الطباعة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.';
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: message });
        return true;
    }
    return false;
}

function printModal() {
    if (blockTrialPrint()) return;
    const modalTitle = document.getElementById('modalTitle').textContent;
    preparePrintHeader(modalTitle);
    
    const headerHtml = document.getElementById('printHeaderSection').outerHTML;
    const modalBodyHtml = document.querySelector('.modal-body').innerHTML;
    
    const printContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${modalTitle}</title>
    <style>
        @import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap");
        body { direction: rtl; font-family: "Cairo", sans-serif; padding: 25px; background: 'var(--card-bg)'; color: black; }
        .print-header { display: block !important; margin-bottom: 25px; text-align: center; }
        .print-header h3 { font-size: 16px; margin: 0; }
        .print-header h4 { font-size: 14px; margin: 5px 0; }
        .print-header-grid { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .print-header-grid > div { flex: 1; }
        .print-header-grid .right { text-align: right; font-weight: bold; }
        .print-header-grid .center { text-align: center; }
        .print-header-grid .center h2 { text-decoration: underline; font-size: 1.4rem; font-weight: 900; margin: 0; }
        .print-header-grid .left { text-align: left; font-weight: bold; }
        .modern-table { width: 100%; border-collapse: collapse; margin-top: 30px; font-size: 14pt; }
        .modern-table th, .modern-table td { border: 1px solid #000; padding: 10px; text-align: center; }
        .modern-table th { background: #f1f5f9; font-weight: bold; border-bottom: 2px solid #000; }
    </style>
    ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
</head>
<body>
    ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}
    ${headerHtml}
    ${modalBodyHtml}
    ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
</body></html>`;

    var printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
}

function printStatistics() {
    if (blockTrialPrint()) return;
    preparePrintHeader("(إحصائيات الفئة المستهدفة)");
    
    const trimesters = Array.from(document.querySelectorAll('.trim-check:checked')).map(cb => cb.value);
    const threshold = parseFloat(document.getElementById('subjectThreshold').value) || 10;
    
    const allPossibleSubjects = getAnalysisSubjectPool();
    
    const activeSubjects = allPossibleSubjects.filter(subName => {
        return targetStudents.some(s => {
            return trimesters.some(t => getTrimesterScore(s, subName, t) !== null);
        });
    });
    
    let tableHtml = `
        <table class="modern-table" style="margin-top: 30px;">
            <thead>
                <tr>
                    <th style="width: 50%;">المادة</th>
                    <th>عدد التلاميذ المعنيين بالدعم</th>
                    <th>ملاحظات</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let hasData = false;
    activeSubjects.forEach(subName => {
        let subCount = 0;
        targetStudents.forEach(s => {
            let subSum = 0;
            let subTCount = 0;
            trimesters.forEach(t => {
                const score = getTrimesterScore(s, subName, t);
                if (score !== null) {
                    subSum += score;
                    subTCount++;
                }
            });
            if (subTCount > 0 && (subSum / subTCount) < threshold) {
                subCount++;
            }
        });
        
        if (subCount > 0) {
            hasData = true;
            tableHtml += `
                <tr>
                    <td style="font-weight: bold; color: #1e293b;">${subName}</td>
                    <td style="color: #ef4444; font-weight: 800;">${subCount}</td>
                    <td></td>
                </tr>
            `;
        }
    });

    if (!hasData) {
        tableHtml += `<tr><td colspan="3" style="text-align:center; padding:20px;">لا توجد معطيات</td></tr>`;
    }
    
    tableHtml += `
            </tbody>
        </table>
        
        <div style="margin-top: 50px; display: flex; justify-content: space-around;">
            <div style="text-align: center; font-weight: bold;">المدير(ة)</div>
            <div style="text-align: center; font-weight: bold;">مستشار(ة) التوجيه</div>
        </div>
    `;
    
    document.getElementById('printStatsTableContainer').innerHTML = tableHtml;
    
    const headerHtml = document.getElementById('printHeaderSection').outerHTML;
    const printContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>إحصائيات الفئة المستهدفة</title>
    <style>
        @import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap");
        body { direction: rtl; font-family: "Cairo", sans-serif; padding: 25px; background: 'var(--card-bg)'; color: black; }
        .print-header { display: block !important; margin-bottom: 25px; text-align: center; }
        .print-header h3 { font-size: 16px; margin: 0; }
        .print-header h4 { font-size: 14px; margin: 5px 0; }
        .print-header-grid { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .print-header-grid > div { flex: 1; }
        .print-header-grid .right { text-align: right; font-weight: bold; }
        .print-header-grid .center { text-align: center; }
        .print-header-grid .center h2 { text-decoration: underline; font-size: 1.4rem; font-weight: 900; margin: 0; }
        .print-header-grid .left { text-align: left; font-weight: bold; }
        .modern-table { width: 100%; border-collapse: collapse; margin-top: 30px; font-size: 14pt; }
        .modern-table th, .modern-table td { border: 1px solid #000; padding: 10px; text-align: center; }
        .modern-table th { background: #f1f5f9; font-weight: bold; border-bottom: 2px solid #000; }
    </style>
    ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
</head>
<body>
    ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}
    ${headerHtml}
    ${tableHtml}
    ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
</body></html>`;

    var printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
}

function printConsolidatedReport() {
    if (blockTrialPrint()) return;
    preparePrintHeader("(التقرير الشامل)");
    
    const trimesters = Array.from(document.querySelectorAll('.trim-check:checked')).map(cb => cb.value);
    const threshold = parseFloat(document.getElementById('subjectThreshold').value) || 10;
    
    const allPossibleSubjects = getAnalysisSubjectPool();
    
    const activeSubjects = allPossibleSubjects.filter(subName => {
        return targetStudents.some(s => {
            return trimesters.some(t => getTrimesterScore(s, subName, t) !== null);
        });
    });
    
    const isSecondary = institutionSettings.educationStage === 'secondary';
    
    let tableHtml = `
        <table class="modern-table" style="margin-top: 15px; font-size: 0.75rem;">
            <thead>
                <tr>
                    <th>#</th>
                    <th>اللقب والاسم</th>
                    <th>المستوى</th>
                    ${isSecondary ? '<th>الشعبة</th>' : ''}
                    <th>القسم</th>
                    <th>المعدل العام</th>
                    ${activeSubjects.map(sub => `<th class="vertical-text">${sub}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    if (targetStudents.length === 0) {
        tableHtml += `<tr><td colspan="${isSecondary ? 6 + activeSubjects.length : 5 + activeSubjects.length}" style="text-align:center; padding:20px;">لا توجد معطيات</td></tr>`;
    }

    targetStudents.forEach((s, idx) => {
        const streamArabic = (typeof SubjectManager !== 'undefined' && s.stream) ? SubjectManager.getStreamName(s.stream) : (s.stream || '');
        tableHtml += `
            <tr>
                <td>${idx + 1}</td>
                <td style="font-weight:800; color:#1e293b;">${s.name}</td>
                <td>${s.level}</td>
                ${isSecondary ? `<td>${streamArabic}</td>` : ''}
                <td>${s.class}</td>
                <td style="font-weight:900;">${Math.round(s.calculatedGeneralAvg * 100) / 100}</td>
        `;
        
        activeSubjects.forEach(subName => {
            let subSum = 0;
            let subTCount = 0;
            trimesters.forEach(t => {
                const score = getTrimesterScore(s, subName, t);
                if (score !== null) {
                    subSum += score;
                    subTCount++;
                }
            });
            
            if (subTCount > 0) {
                const subAvg = subSum / subTCount;
                if (subAvg < threshold) {
                    tableHtml += `<td style="color:#ef4444; font-weight:900;">${Math.round(subAvg * 100) / 100}</td>`;
                } else {
                    tableHtml += `<td style="color:#94a3b8; font-weight:bold;">/</td>`;
                }
            } else {
                tableHtml += `<td style="color:#94a3b8; font-weight:bold;">/</td>`;
            }
        });
        tableHtml += `</tr>`;
    });
    
    tableHtml += `
            </tbody>
        </table>
        
        <div style="margin-top: 40px; display: flex; justify-content: space-around; font-size: 0.9rem;">
            <div style="text-align: center; font-weight: bold;">المدير(ة)</div>
            <div style="text-align: center; font-weight: bold;">مستشار(ة) التوجيه</div>
        </div>
    `;

    const headerHtml = document.getElementById('printHeaderSection').outerHTML;
    const printContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>التقرير الشامل</title>
    <style>
        @import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap");
        body { direction: rtl; font-family: "Cairo", sans-serif; padding: 20px; background: 'var(--card-bg)'; color: black; }
        .print-header { display: block !important; margin-bottom: 20px; text-align: center; }
        .print-header h3 { font-size: 16px; margin: 0; }
        .print-header h4 { font-size: 14px; margin: 5px 0; }
        .print-header-grid { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .print-header-grid > div { flex: 1; }
        .print-header-grid .right { text-align: right; font-weight: bold; }
        .print-header-grid .center { text-align: center; }
        .print-header-grid .center h2 { text-decoration: underline; font-size: 1.4rem; font-weight: 900; margin: 0; }
        .print-header-grid .left { text-align: left; font-weight: bold; }
        .modern-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10pt; }
        .modern-table th, .modern-table td { border: 1px solid #000; padding: 4px; text-align: center; white-space: nowrap; }
        .modern-table th { background: #f1f5f9; font-weight: bold; border-bottom: 2px solid #000; border-top: 2px solid #000; }
        .modern-table th:nth-child(2), .modern-table td:nth-child(2) { white-space: pre-wrap; width: 15%; text-align: right; }
        .modern-table th.vertical-text { writing-mode: vertical-rl; text-orientation: mixed; height: 110px; vertical-align: middle; padding: 8px 3px; line-height: 1; }
        @page { size: landscape; margin: 1cm; }
    </style>
    ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
</head>
<body>
    ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}
    ${headerHtml}
    ${tableHtml}
    ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
</body></html>`;

    var printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
}
