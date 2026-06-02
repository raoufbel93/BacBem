/**


 * Supervision Schedule Management (جدول الحراسة)


 * Handles teacher management, day/period assignment, and schedule generation


 */





// ======================


// DATA STORAGE


// ======================


const STORAGE_KEYS = {


    TEACHERS: 'supervisionTeachers',


    DAYS: 'supervisionDays',


    SCHEDULE: 'supervisionSchedule',


    SETTINGS: 'supervisionSettings'


};





// ======================


// STATE MANAGEMENT


// ======================


let teachers = [];


let days = [];


let schedule = {}; // { dayId_period: [teacherId, ...] }


let settings = {


    equalDistribution: true,


    maxOnePerDay: true,


    subjectTeachersFirst: true,


    teachersPerPeriod: 2,


    giveRestDay: true


};





// ======================


// INITIALIZATION


// ======================


document.addEventListener('DOMContentLoaded', async () => {


    await loadData();


    await loadTrimesterSelection();


    renderTeachersTable();


    renderDaysGrid();


    renderScheduleTable();


    syncSettingsUI();





    // Settings event listeners


    document.getElementById('equalDistribution').addEventListener('change', updateSettings);


    document.getElementById('maxOnePerDay').addEventListener('change', updateSettings);


    document.getElementById('subjectTeachersFirst').addEventListener('change', updateSettings);


    document.getElementById('giveRestDay').addEventListener('change', updateSettings);


});





async function loadTrimesterSelection() {


    const savedTrimester = await DB.get('supervisionTrimester') || '1';


    const select = document.getElementById('trimesterSelect');


    if (select) select.value = savedTrimester;


}





async function saveTrimesterSelection() {


    const select = document.getElementById('trimesterSelect');


    if (select) await DB.set('supervisionTrimester', select.value);


}





async function getTrimesterLabel() {


    const val = await DB.get('supervisionTrimester') || '1';


    const labels = { 
        '1': 'الفصل الأول', 
        '2': 'الفصل الثاني', 
        '3': 'الفصل الثالث',
        'blanc': 'الامتحان التجريبي (متوسط)',
        'blanc_lycee': 'الامتحان التجريبي (ثانوي)'
    };


    return labels[val] || 'الفصل الأول';


}





async function loadData() {


    // Load from central teachers management list


    const centralTeachers = await DB.getTeachers();





    // Map central format to local format expected by supervision script


    teachers = centralTeachers.map(t => ({


        id: t.id, // Keep original ID (might be string or number)


        surname: t.last_name,


        name: t.first_name,


        subjects: t.subject ? [t.subject] : [], // Convert single subject string to array


        isExempt: t.isExempt || false


    }));





    days = await DB.get(STORAGE_KEYS.DAYS) || [];


    schedule = await DB.get(STORAGE_KEYS.SCHEDULE) || {};


    const savedSettings = await DB.get(STORAGE_KEYS.SETTINGS);


    if (savedSettings) settings = savedSettings;


}





async function saveData() {


    // Teachers are managed centrally, so we don't save them here


    await DB.set(STORAGE_KEYS.DAYS, days);


    await DB.set(STORAGE_KEYS.SCHEDULE, schedule);


    await DB.set(STORAGE_KEYS.SETTINGS, settings);


}





function syncSettingsUI() {


    document.getElementById('equalDistribution').checked = settings.equalDistribution;


    document.getElementById('maxOnePerDay').checked = settings.maxOnePerDay;


    document.getElementById('subjectTeachersFirst').checked = settings.subjectTeachersFirst;


    document.getElementById('giveRestDay').checked = settings.giveRestDay;


}





async function updateSettings() {


    settings.equalDistribution = document.getElementById('equalDistribution').checked;


    settings.maxOnePerDay = document.getElementById('maxOnePerDay').checked;


    settings.subjectTeachersFirst = document.getElementById('subjectTeachersFirst').checked;


    settings.giveRestDay = document.getElementById('giveRestDay').checked;


    await saveData();


}





// ======================


// TEACHER MANAGEMENT


// ======================


// function toggleTeacherForm removed








// function clearTeacherForm removed








// function addTeacher removed








function renderTeachersTable() {


    const tbody = document.getElementById('teachersTableBody');


    if (!tbody) return;





    if (teachers.length === 0) {


        tbody.innerHTML = `


            <tr>


                <td colspan="3" style="text-align: center; color: #888; padding: 30px;">


                    لم يتم إضافة أساتذة في "إدارة الأساتذة" بعد.


                </td>


            </tr>


        `;


        return;


    }





    tbody.innerHTML = teachers.map((teacher, index) => `


        <tr>


            <td>${index + 1}</td>


            <td>${teacher.surname} ${teacher.name}</td>


            <td>


                ${teacher.subjects.length > 0


            ? teacher.subjects.map(s => `<span class="subject-tag">${getSubjectLabel(s)}</span>`).join(' ')


            : '<span style="color: #888;">-</span>'


        }


            </td>


            <td style="text-align: center;">


                <input type="checkbox" onchange="toggleTeacherExemption('${teacher.id}', this.checked)" ${teacher.isExempt ? 'checked' : ''} style="transform: scale(1.2); cursor: pointer;">


            </td>


        </tr>


    `).join('');


}





async function toggleTeacherExemption(teacherId, isChecked) {


    // 1. Update local array in supervision.js


    const teacher = teachers.find(t => t.id === teacherId);


    if (teacher) {


        teacher.isExempt = isChecked;


    }





    // 2. Update central storage (teachersList)


    try {


        const storedTeachers = await DB.getTeachers();


        const index = storedTeachers.findIndex(t => t.id === teacherId);


        if (index !== -1) {


            storedTeachers[index].isExempt = isChecked;


            await DB.saveTeachers(storedTeachers);


        }


    } catch (e) {


        console.error('Error updating exemption:', e);


    }





    // 3. If turning exemption ON (isChecked === true), remove from all current schedules


    if (isChecked) {


        let hasChanges = false;


        Object.keys(schedule).forEach(key => {


            if (Array.isArray(schedule[key])) {


                const initialLength = schedule[key].length;


                schedule[key] = schedule[key].filter(id => id !== teacherId);


                if (schedule[key].length !== initialLength) hasChanges = true;


            }


        });





        if (hasChanges) {


            await saveData();


            renderScheduleTable();


            showToast('تم إعفاء الأستاذ وإزالته من الجدول', 'success');


        }


    }


}





function getSubjectLabel(subjectKey) {


    const labels = {


        'رياضيات': 'رياضيات',


        'فيزياء': 'فيزياء',


        'علوم': 'علوم',


        'عربية': 'عربية',


        'فرنسية': 'فرنسية',


        'انجليزية': 'انجليزية',


        'تاريخ': 'تاريخ',


        'تربية_اسلامية': 'ت.إسلامية',


        'تربية_مدنية': 'ت.مدنية',


        'تربية_فنية': 'ت.فنية',


        'تربية_بدنية': 'ت.بدنية',


        'موسيقى': 'موسيقى',


        'إعلام_آلي': 'إعلام آلي'


    };


    return labels[subjectKey] || subjectKey;


}





// function editTeacher removed


// function closeEditTeacherModal removed


// function saveTeacherEdit removed


// function deleteTeacher removed


// function importTeachersFromExcel removed





// ======================


// DAY MANAGEMENT


// ======================





function openAddDayModal() {


    // Set default date to tomorrow


    const tomorrow = new Date();


    tomorrow.setDate(tomorrow.getDate() + 1);


    document.getElementById('newDayDate').value = tomorrow.toISOString().split('T')[0];


    document.getElementById('morningSubject').value = '';


    document.getElementById('morningSubject2').value = '';


    document.getElementById('eveningSubject').value = '';


    document.getElementById('eveningSubject2').value = '';


    document.getElementById('addDayModal').style.display = 'block';


}





function closeAddDayModal() {


    document.getElementById('addDayModal').style.display = 'none';


}





async function addDay() {


    const date = document.getElementById('newDayDate').value;


    const morningSubject1 = document.getElementById('morningSubject').value;


    const morningSubject2 = document.getElementById('morningSubject2').value;


    const eveningSubject1 = document.getElementById('eveningSubject').value;


    const eveningSubject2 = document.getElementById('eveningSubject2').value;





    if (!date) {


        showToast('يرجى اختيار التاريخ', 'error');


        return;


    }





    // Check if date already exists


    if (days.some(d => d.date === date)) {


        showToast('هذا التاريخ موجود بالفعل', 'error');


        return;


    }





    const newDay = {


        id: Date.now(),


        date,


        morning: {


            subjects: [morningSubject1, morningSubject2].filter(s => s), // Store as array, filter empty


            requiredTeachers: settings.teachersPerPeriod || 2


        },


        evening: {


            subjects: [eveningSubject1, eveningSubject2].filter(s => s),


            requiredTeachers: settings.teachersPerPeriod || 2


        }


    };





    days.push(newDay);


    days.sort((a, b) => new Date(a.date) - new Date(b.date));





    await saveData();


    renderDaysGrid();


    renderScheduleTable();


    closeAddDayModal();


    showToast('تم إضافة يوم الحراسة', 'success');


}





function renderDaysGrid() {


    const container = document.getElementById('daysGrid');





    if (days.length === 0) {


        container.innerHTML = `


            <div style="text-align: center; color: #888; padding: 30px; grid-column: 1/-1;">


                لم يتم إضافة أيام حراسة بعد. اضغط على "إضافة يوم" للبدء.


            </div>


        `;


        return;


    }





    container.innerHTML = days.map(day => {


        // Ensure subjects array exists (migration for old data)


        if (!day.morning.subjects) day.morning.subjects = day.morning.subject ? [day.morning.subject] : [];


        if (!day.evening.subjects) day.evening.subjects = day.evening.subject ? [day.evening.subject] : [];





        // Helper to safely get subject at index


        const getSub = (period, idx) => day[period].subjects[idx] || '';





        return `


        <div class="day-card" style="min-width: 320px;">


            <div class="day-header">


                <span class="day-date">${IconManager.get('calendar')} ${formatDate(day.date)}</span>


                <button class="btn btn-danger btn-sm" onclick="deleteDay(${day.id})">${IconManager.get('trash')}</button>


            </div>


            


            <div class="period-row" style="flex-wrap: wrap; gap: 5px;">


                <div style="width: 100%; display: flex; align-items: center; justify-content: space-between;">


                    <span class="period-label morning">${IconManager.get('sun')} صباح:</span>


                    <input type="number" min="1" max="200" value="${day.morning.requiredTeachers || 2}" 


                        onchange="updatePeriodTeacherCount(${day.id}, 'morning', this.value)"


                        style="width: 50px; padding: 5px; border: 1px solid #ddd; border-radius: 4px; text-align: center;"


                        title="عدد الحراس">


                </div>


                <select onchange="updateDaySubject(${day.id}, 'morning', 0, this.value)" style="padding: 5px; border-radius: 4px; border: 1px solid #ddd; width: 48%; font-size: 0.9em;">


                    <option value="">-- مادة 1 --</option>


                    ${getSubjectOptions(getSub('morning', 0))}


                </select>


                <select onchange="updateDaySubject(${day.id}, 'morning', 1, this.value)" style="padding: 5px; border-radius: 4px; border: 1px solid #ddd; width: 48%; font-size: 0.9em;">


                    <option value="">-- مادة 2 --</option>


                    ${getSubjectOptions(getSub('morning', 1))}


                </select>


            </div>





            <div class="period-row" style="flex-wrap: wrap; gap: 5px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #eee;">


                <div style="width: 100%; display: flex; align-items: center; justify-content: space-between;">


                    <span class="period-label evening">${IconManager.get('moon')} مساء:</span>


                    <input type="number" min="1" max="200" value="${day.evening.requiredTeachers || 2}" 


                        onchange="updatePeriodTeacherCount(${day.id}, 'evening', this.value)"


                        style="width: 50px; padding: 5px; border: 1px solid #ddd; border-radius: 4px; text-align: center;"


                        title="عدد الحراس">


                </div>


                <select onchange="updateDaySubject(${day.id}, 'evening', 0, this.value)" style="padding: 5px; border-radius: 4px; border: 1px solid #ddd; width: 48%; font-size: 0.9em;">


                    <option value="">-- مادة 1 --</option>


                    ${getSubjectOptions(getSub('evening', 0))}


                </select>


                <select onchange="updateDaySubject(${day.id}, 'evening', 1, this.value)" style="padding: 5px; border-radius: 4px; border: 1px solid #ddd; width: 48%; font-size: 0.9em;">


                    <option value="">-- مادة 2 --</option>


                    ${getSubjectOptions(getSub('evening', 1))}


                </select>


            </div>


        </div>


    `}).join('');


}





function getSubjectOptions(selectedValue) {


    const subjects = [


        'الرياضيات',


        'العلوم الطبيعية',


        'الإعلام الآلي',


        'العلوم الفيزيائية والتكنولوجيا',


        'التربية البدنية والرياضية',


        'اللغة الفرنسية',


        'اللغة العربية',


        'اللغة الإنجليزية',


        'التربية التشكيلية',


        'التربية الموسيقية',


        'اللغة الأمازيغية',


        'التربية الإسلامية',


        'التربية المدنية',


        'التاريخ والجغرافيا'


    ];


    return subjects.map(s =>


        `<option value="${s}" ${s === selectedValue ? 'selected' : ''}>${s}</option>`


    ).join('');


}





function formatDate(dateStr) {


    const date = new Date(dateStr);


    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };


    return date.toLocaleDateString('ar-DZ', options);


}





function formatDateShort(dateStr) {


    const date = new Date(dateStr);


    const dayName = date.toLocaleDateString('ar-DZ', { weekday: 'long' });


    const dateFormatted = date.toLocaleDateString('ar-DZ', { day: '2-digit', month: '2-digit' });


    return `${dayName}<br>${dateFormatted}`;


}





async function updateDaySubject(dayId, period, index, subject) {


    const day = days.find(d => d.id === dayId);


    if (!day) return;





    // Ensure subjects array exists


    if (!day[period].subjects) day[period].subjects = [];





    // Update at index


    day[period].subjects[index] = subject;





    await saveData();


    renderScheduleTable();


}





async function updatePeriodTeacherCount(dayId, period, count) {


    const day = days.find(d => d.id === dayId);


    if (!day) return;





    day[period].requiredTeachers = parseInt(count) || 2;


    await saveData();


    renderScheduleTable();


}





async function deleteDay(dayId) {


    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "هل أنت متأكد من حذف هذا اليوم؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، حذف',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;





    days = days.filter(d => d.id !== dayId);





    // Remove schedule entries for this day


    Object.keys(schedule).forEach(key => {


        if (key.startsWith(`${dayId}_`)) {


            delete schedule[key];


        }


    });





    await saveData();


    renderDaysGrid();


    renderScheduleTable();


    showToast('تم حذف يوم الحراسة', 'success');


}





// ======================


// SCHEDULE GENERATION


// ======================


async function generateSchedule() {


    if (teachers.length === 0) {


        showToast('يرجى إضافة الأساتذة أولاً', 'error');


        return;


    }





    if (days.length === 0) {


        showToast('يرجى إضافة أيام الحراسة أولاً', 'error');


        return;


    }





    // Clear existing schedule


    schedule = {};





    // Track teacher assignments for equal distribution


    const teacherCounts = {};


    teachers.forEach(t => teacherCounts[t.id] = 0);





    // Track daily assignments for max-one-per-day rule


    const dailyAssignments = {}; // { dayId: Set of teacherIds }





    // Assign rest days if enabled (each teacher gets one day off)


    const teacherRestDays = {}; // { teacherId: dayId }


    if (settings.giveRestDay && days.length > 1) {


        teachers.forEach((teacher, index) => {


            // Distribute rest days evenly across all days


            const restDayIndex = index % days.length;


            teacherRestDays[teacher.id] = days[restDayIndex].id;


        });


    }





    // Process each day and period


    days.forEach(day => {


        dailyAssignments[day.id] = new Set();





        ['morning', 'evening'].forEach(period => {


            const key = `${day.id}_${period}`;


            schedule[key] = [];





            // Get subjects for this period


            let periodSubjects = day[period].subjects || (day[period].subject ? [day[period].subject] : []);


            periodSubjects = periodSubjects.filter(s => s); // Remove empty





            if (periodSubjects.length === 0) return; // No exam for this period





            // Get available teachers


            let availableTeachers = [...teachers];





            // Filter out teachers whose rest day is this day


            if (settings.giveRestDay && days.length > 1) {


                availableTeachers = availableTeachers.filter(t =>


                    teacherRestDays[t.id] !== day.id


                );


            }





            // Filter out exempt teachers


            availableTeachers = availableTeachers.filter(t => !t.isExempt);





            // Subject relationship mapping


            const getRelatedSubjects = (subject) => {


                const relations = {


                    'اللغة العربية': ['التربية الإسلامية'],


                    'التربية الإسلامية': ['اللغة العربية'],


                    'التاريخ والجغرافيا': ['التربية المدنية'],


                    'التربية المدنية': ['التاريخ والجغرافيا']


                };


                return relations[subject] || [];


            };





            // Check if teacher can supervise any of these subjects


            const canTeachSubjects = (teacher, targetSubjects) => {


                return targetSubjects.some(subject => {


                    if (teacher.subjects.some(s => s.includes(subject) || subject.includes(s))) return true;


                    const relatedSubjects = getRelatedSubjects(subject);


                    return teacher.subjects.some(s =>


                        relatedSubjects.some(rel => s.includes(rel) || rel.includes(s))


                    );


                });


            };





            // Filter by subject if setting enabled


            if (settings.subjectTeachersFirst) {


                const subjectTeachers = availableTeachers.filter(t => canTeachSubjects(t, periodSubjects));


                if (subjectTeachers.length > 0) {


                    // Put subject teachers first, then others


                    const otherTeachers = availableTeachers.filter(t => !canTeachSubjects(t, periodSubjects));


                    availableTeachers = [...subjectTeachers, ...otherTeachers];


                }


            }





            // Filter out already assigned today if setting enabled


            if (settings.maxOnePerDay) {


                availableTeachers = availableTeachers.filter(t =>


                    !dailyAssignments[day.id].has(t.id)


                );


            }





            // Sort by assignment count for equal distribution


            if (settings.equalDistribution) {


                availableTeachers.sort((a, b) => teacherCounts[a.id] - teacherCounts[b.id]);


            }





            // Assign teachers based on per-period required count


            const requiredCount = day[period].requiredTeachers !== undefined ? day[period].requiredTeachers : (settings.teachersPerPeriod || 2);


            if (requiredCount === 0) return; // Skip if 0 teachers required


            const numToAssign = Math.min(availableTeachers.length, requiredCount);


            const assigned = availableTeachers.slice(0, numToAssign);





            assigned.forEach(teacher => {


                schedule[key].push(teacher.id);


                teacherCounts[teacher.id]++;


                dailyAssignments[day.id].add(teacher.id);


            });


        });


    });





    await saveData();


    renderScheduleTable();


    showToast('تم توليد الجدول بنجاح', 'success');


}





function renderScheduleTable() {


    const container = document.getElementById('scheduleTableContainer');





    if (teachers.length === 0 || days.length === 0) {


        container.innerHTML = `


            <p style="text-align: center; color: #888; padding: 40px;">


                أضف الأساتذة وأيام الحراسة أولاً، ثم اضغط "توليد الجدول تلقائياً"


            </p>


        `;


        return;


    }





    // Build header


    let headerRow1 = '<th rowspan="2">#</th><th rowspan="2">الأستاذ</th>';


    let headerRow2 = '';





    days.forEach((day, dayIndex) => {


        const morningCount = schedule[`${day.id}_morning`]?.length || 0;


        const eveningCount = schedule[`${day.id}_evening`]?.length || 0;





        let mSubjects = day.morning.subjects || (day.morning.subject ? [day.morning.subject] : []);


        let eSubjects = day.evening.subjects || (day.evening.subject ? [day.evening.subject] : []);


        mSubjects = mSubjects.filter(s => s).join(' + ');


        eSubjects = eSubjects.filter(s => s).join(' + ');





        headerRow1 += `<th colspan="2" class="day-header-cell">${formatDateShort(day.date)}</th>`;


        headerRow2 += `


            <th class="period-header" title="${mSubjects || 'لا يوجد'}">صباح (${morningCount}/${day.morning.requiredTeachers || 2})<br><span style="font-size:0.8em;font-weight:normal">${mSubjects || '-'}</span></th>


            <th class="period-header" title="${eSubjects || 'لا يوجد'}">مساء (${eveningCount}/${day.evening.requiredTeachers || 2})<br><span style="font-size:0.8em;font-weight:normal">${eSubjects || '-'}</span></th>


        `;


    });





    headerRow1 += '<th rowspan="2" class="total-col">المجموع</th>';





    // Sort teachers by subject for display, excluding exempt ones


    // Filter out exempt teachers for display


    const activeTeachers = teachers.filter(t => !t.isExempt);





    const sortedTeachers = [...activeTeachers].sort((a, b) => {


        const subjectA = (a.subjects && a.subjects[0]) ? a.subjects[0] : 'ززز';


        const subjectB = (b.subjects && b.subjects[0]) ? b.subjects[0] : 'ززز';


        return subjectA.localeCompare(subjectB, 'ar');


    });





    // Build body


    let bodyRows = '';


    sortedTeachers.forEach((teacher, index) => {


        const subjectDisplay = teacher.subjects.length > 0 ? teacher.subjects[0] : '-';


        let row = `<td style="text-align: center; font-weight: bold;">${index + 1}</td>`;


        row += `<td class="teacher-name">${teacher.surname} ${teacher.name}<br><small style="color:#888;">${subjectDisplay}</small></td>`;


        let totalCount = 0;





        days.forEach((day, dayIndex) => {


            ['morning', 'evening'].forEach((period, periodIndex) => {


                const key = `${day.id}_${period}`;


                const isAssigned = schedule[key]?.includes(teacher.id);





                let pSubjects = day[period].subjects || (day[period].subject ? [day[period].subject] : []);


                const hasSubject = pSubjects.some(s => s);


                const isDayEnd = period === 'evening';





                if (isAssigned) totalCount++;





                row += `


                    <td class="check-cell ${isAssigned ? 'checked' : ''} ${!hasSubject ? 'disabled' : ''}"


                        style="${isDayEnd ? 'border-left: 3px solid #333;' : ''}"


                        onclick="${hasSubject ? `toggleAssignment(${day.id}, '${period}', '${teacher.id}')` : ''}"


                        title="${hasSubject ? pSubjects.join('+') : 'لا يوجد امتحان'}">


                        ${isAssigned ? IconManager.get('check') : ''}


                    </td>


                `;


            });


        });





        row += `<td class="total-col">${totalCount}</td>`;


        bodyRows += `<tr>${row}</tr>`;


    });





    // Build floating totals bar


    let floatingTotals = '<span class="totals-label">📊 المجموع:</span>';


    days.forEach((day, index) => {


        const morningKey = `${day.id}_morning`;


        const eveningKey = `${day.id}_evening`;


        const morningCount = schedule[morningKey]?.length || 0;


        const eveningCount = schedule[eveningKey]?.length || 0;


        const dayName = new Date(day.date).toLocaleDateString('ar-DZ', { weekday: 'short' });


        floatingTotals += `<span class="total-item" data-day="${index}">${dayName}: ص${morningCount} م${eveningCount}</span>`;


    });





    const existingBar = document.querySelector('.floating-totals-bar');


    if (existingBar) existingBar.remove();





    container.innerHTML = `


        <div class="schedule-table-wrapper">


        <table class="schedule-table" id="mainScheduleTable">


            <thead>


                <tr>${headerRow1}</tr>


                <tr>${headerRow2}</tr>


            </thead>


            <tbody>


                ${bodyRows}


            </tbody>


        </table>


        </div>


    `;





    const floatingBar = document.createElement('div');


    floatingBar.className = 'floating-totals-bar no-print';


    floatingBar.innerHTML = floatingTotals;


    floatingBar.style.display = 'none';


    document.body.appendChild(floatingBar);





    function updateFloatingBarVisibility() {


        const table = document.getElementById('mainScheduleTable');


        if (!table) return;





        const tableRect = table.getBoundingClientRect();


        const bar = document.querySelector('.floating-totals-bar');


        if (!bar) return;





        if (tableRect.top < window.innerHeight && tableRect.bottom > 100) {


            bar.style.display = 'flex';


        } else {


            bar.style.display = 'none';


        }


    }





    window.removeEventListener('scroll', updateFloatingBarVisibility);


    window.addEventListener('scroll', updateFloatingBarVisibility);


    updateFloatingBarVisibility();


}





async function toggleAssignment(dayId, period, teacherId) {


    const key = `${dayId}_${period}`;





    if (!schedule[key]) {


        schedule[key] = [];


    }





    const index = schedule[key].indexOf(teacherId);


    if (index === -1) {


        // Check max-one-per-day rule


        if (settings.maxOnePerDay) {


            const otherPeriod = period === 'morning' ? 'evening' : 'morning';


            const otherKey = `${dayId}_${otherPeriod}`;


            if (schedule[otherKey]?.includes(teacherId)) {


                showToast('هذا الأستاذ مكلف بالفترة الأخرى في نفس اليوم', 'warning');


                return;


            }


        }


        schedule[key].push(teacherId);


    } else {


        schedule[key].splice(index, 1);


    }





    await saveData();


    renderScheduleTable();


}





async function clearSchedule() {


    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "هل أنت متأكد من مسح الجدول بالكامل؟",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، مسح',
        cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;





    schedule = {};


    await saveData();


    renderScheduleTable();


    showToast('تم مسح الجدول', 'success');


}





// ======================


// PRINTING


// ======================


function blockTrialPrint() {
    if (typeof Auth !== 'undefined' && Auth.isTrialRestricted && Auth.isTrialRestricted()) {
        const message = (typeof Auth.getBlockedMessage === 'function')
            ? Auth.getBlockedMessage('print')
            : 'الطباعة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.';
        showToast(message, 'warning');
        return true;
    }
    return false;
}

async function printSchedule() {
    if (blockTrialPrint()) return;


    if (teachers.length === 0 || days.length === 0) {


        showToast('لا يوجد جدول للطباعة', 'error');


        return;


    }





    const institutionSettings = await DB.getSettings() || {};


    const today = new Date().toLocaleDateString('ar-DZ');


    const trimesterLabel = await getTrimesterLabel();





    const printWindow = window.open('', '_blank');


    printWindow.document.write(`


        <!DOCTYPE html>


        <html lang="ar" dir="rtl">


        <head>


            <meta charset="UTF-8">


            <title>جدول الحراسة</title>


            <style>


                @page { size: A4 landscape; margin: 0.5cm; }


                * { box-sizing: border-box; margin: 0; padding: 0; }


                body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; padding: 5mm; }


                


                /* Header - Centered */


                .top-header { text-align: center; margin-bottom: 10px; font-size: 16px; line-height: 1.5; font-weight: bold; }


                .top-header .republic { font-weight: bold; }


                


                /* Info Row */


                .info-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #333; font-size: 14px; font-weight: bold; }


                .info-right, .info-left { width: 40%; line-height: 1.5; }


                .info-right { text-align: right; }


                .info-left { text-align: left; }


                .title-center { text-align: center; font-size: 20px; font-weight: 800; text-decoration: underline; margin: 0 10px; }


                


                /* Table */


                table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 5px; }


                th, td { border: 1px solid #000; padding: 6px 4px; text-align: center; vertical-align: middle; }


                th { background: #ddd !important; color: #000 !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }


                .teacher-name { text-align: right; padding-right: 5px; white-space: nowrap; font-size: 18px !important; font-weight: 900 !important; }


                .teacher-name small { display: none; }


                .checked { background: #c8e6c9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }


                .total-col { background: #f5f5f5 !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }


                .total-row td { background: #eee !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }


                


                /* Footer */


                .print-footer { display: flex; justify-content: space-between; margin-top: 20px; font-size: 14px; font-weight: bold; }


                .signature-block { text-align: center; min-width: 120px; }


                .signature-block .title { margin-bottom: 30px; font-weight: bold; }


            </style>


        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>


        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}


            <div class="top-header">


                <div class="republic">الجمهورية الجزائرية الديمقراطية الشعبية</div>


                <div>وزارة التربية الوطنية</div>


            </div>


            


            <div class="info-row">


                <div class="info-right">


                    <div>مديرية التربية لولاية ${institutionSettings.wilaya || '...'}</div>


                    <div>${institutionSettings.institutionName || '...'}</div>


                </div>


                <div class="title-center">جدول الحراسة - ${trimesterLabel}</div>


                <div class="info-left">


                    <div>بلدية ${institutionSettings.municipality || '...'}</div>


                    <div>السنة الدراسية: ${institutionSettings.schoolYear || '...'}</div>


                </div>


            </div>


            


            ${document.getElementById('scheduleTableContainer').innerHTML}


            


            <div class="print-footer">


                <div>حرر بـ ${institutionSettings.municipality || '...'} في: ${today}</div>


                <div class="signature-block">


                    <div class="title">المدير(ة)</div>


                    <div>${institutionSettings.directorName || '........................'}</div>


                </div>


            </div>


        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}\n        </body>


        </html>


    `);


    printWindow.document.close();


    printWindow.onload = function () {


        // printWindow.print(); /* Replaced by global Toolbar */ /* Replaced by global Toolbar */


    };


}





function toggleSlipDropdown() {


    const dropdown = document.getElementById('slipDropdown');


    if (dropdown) {


        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';


    }


}





async function printTeacherSlips(teachersPerPage = 2) {
    if (blockTrialPrint()) return;


    if (teachers.length === 0 || Object.keys(schedule).length === 0) {


        showToast('لا توجد بيانات للطباعة', 'error');


        return;


    }





    const institutionSettings = await DB.getSettings() || {};


    const today = new Date().toLocaleDateString('ar-DZ');





    // Build slips for teachers who have assignments


    const slips = [];


    teachers.forEach(teacher => {


        const assignments = [];


        let totalPeriods = 0;





        days.forEach(day => {


            ['morning', 'evening'].forEach(period => {


                const key = `${day.id}_${period}`;





                let pSubjects = day[period].subjects || (day[period].subject ? [day[period].subject] : []);


                const hasSubject = pSubjects.some(s => s);





                if (hasSubject && schedule[key]?.includes(teacher.id)) {


                    assignments.push({


                        date: formatDate(day.date),


                        period: period === 'morning' ? 'صباح' : 'مساء',


                        subject: pSubjects.filter(s => s).join(' + ')


                    });


                    totalPeriods++;


                }


            });


        });





        if (assignments.length > 0) {


            slips.push({ teacher, assignments, totalPeriods });


        }


    });





    // Group slips by chosen count per page


    let pagesHTML = '';


    for (let i = 0; i < slips.length; i += teachersPerPage) {


        const pageSlips = slips.slice(i, i + teachersPerPage);


        pagesHTML += '<div class="page">';


        pageSlips.forEach(slip => {


            pagesHTML += `


                <div class="teacher-slip">


                    <div class="slip-header">


                        <div class="slip-top-line">الجمهورية الجزائرية الديمقراطية الشعبية</div>


                        <h3>استدعاء لحراسة الاختبارات - ${getTrimesterLabel()}</h3>


                        <p>${institutionSettings.institutionName || '...'} - السنة الدراسية: ${institutionSettings.schoolYear || '...'}</p>


                    </div>


                    <p class="teacher-name"><strong>الأستاذ(ة):</strong> ${slip.teacher.surname} ${slip.teacher.name} - <strong>المادة:</strong> ${slip.teacher.subjects[0] || '-'}</p>


                    <table class="slip-table">


                        <thead><tr><th>التاريخ</th><th>الفترة</th><th>المادة</th></tr></thead>


                        <tbody>${slip.assignments.map(a => `<tr><td>${a.date}</td><td>${a.period}</td><td>${a.subject}</td></tr>`).join('')}</tbody>


                    </table>


                    <div class="slip-footer">


                        <div>إجمالي الفترات: ${slip.totalPeriods}</div>


                        <div class="signature"><div>المدير(ة)</div><div class="sig-line">${institutionSettings.directorName || '...'}</div></div>


                    </div>


                </div>


            `;


        });


        pagesHTML += '</div>';


    }





    const printWindow = window.open('', '_blank');


    printWindow.document.write(`


        <!DOCTYPE html>


        <html lang="ar" dir="rtl">


        <head>


            <meta charset="UTF-8">


            <title>قصاصات الحراسة</title>


            <style>


                @page { size: A4; margin: 0.8cm; }


                * { box-sizing: border-box; margin: 0; padding: 0; }


                body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; }


                .page { height: 287mm; padding: 5mm; page-break-after: always; display: flex; flex-direction: column; gap: 8mm; }


                .page:last-child { page-break-after: auto; }


                .teacher-slip { border: 2px solid #333; padding: 8px 12px; flex: 1; display: flex; flex-direction: column; }


                .slip-header { text-align: center; margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px solid #333; }


                .slip-top-line { font-size: 9px; }


                .slip-header h3 { margin: 3px 0; font-size: 13px; }


                .slip-header p { font-size: 10px; }


                .teacher-name { font-size: 12px; margin: 5px 0; }


                .slip-table { width: 100%; border-collapse: collapse; margin: 3px 0; font-size: 9px; flex-grow: 1; }


                .slip-table th, .slip-table td { border: 1px solid #333; padding: 2px 3px; text-align: center; }


                .slip-table th { background: #eee; }


                .slip-footer { display: flex; justify-content: space-between; margin-top: 5px; padding-top: 5px; font-size: 10px; border-top: 1px solid #ccc; }


                .signature { text-align: center; }


                .sig-line { margin-top: 15px; }


            </style>


        \n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}\n        </head>


        <body>\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}${pagesHTML}\n            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}\n        </body>


        </html>


    `);


    printWindow.document.close();


    printWindow.onload = function () { // printWindow.print(); /* Replaced by global Toolbar */ /* Replaced by global Toolbar */ };


}





// ======================


// UTILITIES


// ======================


function showToast(message, type = 'info') {


    const container = document.getElementById('toastContainer');


    if (!container) return;





    const toast = document.createElement('div');


    toast.className = `toast toast-${type}`;


    toast.innerHTML = message;





    container.appendChild(toast);





    setTimeout(() => {


        toast.classList.add('show');


    }, 100);





    setTimeout(() => {


        toast.classList.remove('show');


        setTimeout(() => toast.remove(), 300);


    }, 3000);


}





// Close modals when clicking outside


window.onclick = function (event) {


    if (event.target.classList.contains('modal')) {


        event.target.style.display = 'none';


    }


};

}


