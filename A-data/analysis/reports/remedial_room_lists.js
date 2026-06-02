let generatedRoomSections = [];
let remedialRoomsSchedule = [];

const REMEDIAL_ROOMS_SCHEDULE_KEY = 'remedialRoomsSchedule';

/**
 * Returns the official full subject name for display/print.
 * Auto-detects stage from getRemedialStage() if available.
 */
function getRemedialSubjectPrintName(subjectName) {
    if (!subjectName || subjectName === '-') return subjectName || '-';
    const stage = (typeof getRemedialStage === 'function') ? getRemedialStage() : 'middle';

        const normalizeAr = (s) => {
            if (!s) return '';
            let n = typeof normalizeArabic === 'function' ? normalizeArabic(s).trim() : s.trim();
            // Fallback normalization if normalizeArabic isn't doing it
            n = n.replace(/[أإآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
            return n;
        };
        const norm = normalizeAr(subjectName);

        if (stage === 'secondary') {
            const secMap = {
                'لغه عربيه': 'اللغة العربية وآدابها',
                'لغه العربيه': 'اللغة العربية وآدابها',
                'العربيه': 'اللغة العربية وآدابها',
                'لغة عربية': 'اللغة العربية وآدابها',
                'لغة العربية': 'اللغة العربية وآدابها',
                'العربية': 'اللغة العربية وآدابها',
                'لغه فرنسيه': 'اللغة الفرنسية',
                'فرنسيه': 'اللغة الفرنسية',
                'لغة فرنسية': 'اللغة الفرنسية',
                'فرنسية': 'اللغة الفرنسية',
                'لغه انجليزيه': 'اللغة الإنجليزية',
                'لغه انكليزيه': 'اللغة الإنجليزية',
                'انجليزيه': 'اللغة الإنجليزية',
                'لغة انجليزية': 'اللغة الإنجليزية',
                'لغة انكليزية': 'اللغة الإنجليزية',
                'انجليزية': 'اللغة الإنجليزية',
                'رياضيات': 'الرياضيات',
                'فيزياء': 'العلوم الفيزيائية',
                'علوم فيزيائيه': 'العلوم الفيزيائية',
                'علوم فيزيائية': 'العلوم الفيزيائية',
                'علوم طبيعيه': 'علوم الطبيعة والحياة',
                'علوم الطبيعه': 'علوم الطبيعة والحياة',
                'علوم طبيعية': 'علوم الطبيعة والحياة',
                'علوم الطبيعة': 'علوم الطبيعة والحياة',
                'علوم': 'علوم الطبيعة والحياة',
                'تاريخ وجغرافيا': 'التاريخ والجغرافيا',
                'تاريخ و جغرافيا': 'التاريخ والجغرافيا',
                'تاريخ': 'التاريخ والجغرافيا',
                'جغرافيا': 'التاريخ والجغرافيا',
                'علوم اسلاميه': 'العلوم الإسلامية',
                'تربيه اسلاميه': 'العلوم الإسلامية',
                'اسلاميه': 'العلوم الإسلامية',
                'الاسلاميه': 'العلوم الإسلامية',
                'علوم إسلامية': 'العلوم الإسلامية',
                'تربية إسلامية': 'العلوم الإسلامية',
                'إسلامية': 'العلوم الإسلامية',
                'الإسلامية': 'العلوم الإسلامية',
                'علوم اسلامية': 'العلوم الإسلامية',
                'تربية اسلامية': 'العلوم الإسلامية',
                'اسلامية': 'العلوم الإسلامية',
                'الاسلامية': 'العلوم الإسلامية',
                'فلسفه': 'الفلسفة',
                'فلسفة': 'الفلسفة',
                'قانون': 'القانون',
                'اقتصاد و مناجمنت': 'الاقتصاد والمناجمنت',
                'اقتصاد': 'الاقتصاد والمناجمنت',
                'تسيير مالي و محاسبي': 'التسيير المالي والمحاسبي',
                'تسيير مالي': 'التسيير المالي والمحاسبي',
                'هندسه مدنيه': 'الهندسة المدنية',
                'هندسة مدنية': 'الهندسة المدنية',
                'هندسه ميكانيكيه': 'الهندسة الميكانيكية',
                'هندسة ميكانيكية': 'الهندسة الميكانيكية',
                'هندسه كهربائيه': 'الهندسة الكهربائية',
                'هندسة كهربائية': 'الهندسة الكهربائية',
                'هندسه الطرائق': 'هندسة الطرائق',
                'هندسة الطرائق': 'هندسة الطرائق',
                'تربيه بدنيه': 'التربية البدنية والرياضية',
                'بدنيه': 'التربية البدنية والرياضية',
                'تربية بدنية': 'التربية البدنية والرياضية',
                'بدنية': 'التربية البدنية والرياضية',
                'رياضه': 'التربية البدنية والرياضية',
                'رياضة': 'التربية البدنية والرياضية',
                'تربيه تشكيليه': 'التربية التشكيلية',
                'ت.تشكيليه': 'التربية التشكيلية',
                'تشكيليه': 'التربية التشكيلية',
                'تربية تشكيلية': 'التربية التشكيلية',
                'ت.تشكيلية': 'التربية التشكيلية',
                'تشكيلية': 'التربية التشكيلية',
                'تربيه موسيقيه': 'التربية الموسيقية',
                'موسيقي': 'التربية الموسيقية',
                'تربية موسيقية': 'التربية الموسيقية',
                'موسيقى': 'التربية الموسيقية',
                'تربيه فنيه': 'التربية الفنية',
                'فنيه': 'التربية الفنية',
                'تربية فنية': 'التربية الفنية',
                'فنية': 'التربية الفنية',
                'لغه امازيغيه': 'اللغة الأمازيغية',
                'امازيغيه': 'اللغة الأمازيغية',
                'لغة امازيغية': 'اللغة الأمازيغية',
                'امازيغية': 'اللغة الأمازيغية',
                'اعلام الي': 'المعلوماتية',
                'معلوماتيه': 'المعلوماتية',
                'معلوماتية': 'المعلوماتية',
            };
            if (secMap[norm]) return secMap[norm];
            if (norm.includes('اسبانيه') || norm.includes('اسبانية')) return 'اللغة الإسبانية';
            if (norm.includes('المانيه') || norm.includes('الماني') || norm.includes('المانية')) return 'اللغة الألمانية';
            if (norm.includes('ايطاليه') || norm.includes('ايطالية')) return 'اللغة الإيطالية';
        } else {
            const midMap = {
                'لغه عربيه': 'اللغة العربية',
                'لغه العربيه': 'اللغة العربية',
                'العربيه': 'اللغة العربية',
                'لغة عربية': 'اللغة العربية',
                'لغة العربية': 'اللغة العربية',
                'العربية': 'اللغة العربية',
                'لغه فرنسيه': 'اللغة الفرنسية',
                'فرنسيه': 'اللغة الفرنسية',
                'لغة فرنسية': 'اللغة الفرنسية',
                'فرنسية': 'اللغة الفرنسية',
                'لغه انجليزيه': 'اللغة الإنجليزية',
                'لغه انكليزيه': 'اللغة الإنجليزية',
                'انجليزيه': 'اللغة الإنجليزية',
                'لغة انجليزية': 'اللغة الإنجليزية',
                'لغة انكليزية': 'اللغة الإنجليزية',
                'انجليزية': 'اللغة الإنجليزية',
                'رياضيات': 'الرياضيات',
                'فيزياء': 'العلوم الفيزيائية والتكنولوجيا',
                'علوم فيزيائيه': 'العلوم الفيزيائية والتكنولوجيا',
                'علوم فيزيائية': 'العلوم الفيزيائية والتكنولوجيا',
                'علوم طبيعيه': 'علوم الطبيعة والحياة',
                'علوم الطبيعه': 'علوم الطبيعة والحياة',
                'علوم طبيعية': 'علوم الطبيعة والحياة',
                'علوم الطبيعة': 'علوم الطبيعة والحياة',
                'علوم': 'علوم الطبيعة والحياة',
                'تربيه اسلاميه': 'التربية الإسلامية',
                'اسلاميه': 'التربية الإسلامية',
                'تربية إسلامية': 'التربية الإسلامية',
                'إسلامية': 'التربية الإسلامية',
                'تربية اسلامية': 'التربية الإسلامية',
                'اسلامية': 'التربية الإسلامية',
                'تربيه مدنيه': 'التربية المدنية',
                'مدنيه': 'التربية المدنية',
                'تربية مدنية': 'التربية المدنية',
                'مدنية': 'التربية المدنية',
                'تاريخ وجغرافيا': 'التاريخ والجغرافيا',
                'تاريخ و جغرافيا': 'التاريخ والجغرافيا',
                'تاريخ': 'التاريخ والجغرافيا',
                'جغرافيا': 'التاريخ والجغرافيا',
                'تربيه بدنيه': 'التربية البدنية والرياضية',
                'بدنيه': 'التربية البدنية والرياضية',
                'رياضه': 'التربية البدنية والرياضية',
                'تربية بدنية': 'التربية البدنية والرياضية',
                'بدنية': 'التربية البدنية والرياضية',
                'رياضة': 'التربية البدنية والرياضية',
                'تربيه تشكيليه': 'التربية التشكيلية',
                'ت.تشكيليه': 'التربية التشكيلية',
                'تشكيليه': 'التربية التشكيلية',
                'تربية تشكيلية': 'التربية التشكيلية',
                'ت.تشكيلية': 'التربية التشكيلية',
                'تشكيلية': 'التربية التشكيلية',
                'تربيه موسيقيه': 'التربية الموسيقية',
                'موسيقي': 'التربية الموسيقية',
                'تربية موسيقية': 'التربية الموسيقية',
                'موسيقى': 'التربية الموسيقية',
                'تربيه فنيه': 'التربية الفنية',
                'فنيه': 'التربية الفنية',
                'تربية فنية': 'التربية الفنية',
                'فنية': 'التربية الفنية',
                'لغه امازيغيه': 'اللغة الأمازيغية',
                'امازيغيه': 'اللغة الأمازيغية',
                'لغة امازيغية': 'اللغة الأمازيغية',
                'امازيغية': 'اللغة الأمازيغية',
                'اعلام الي': 'المعلوماتية',
                'معلوماتيه': 'المعلوماتية',
                'معلوماتية': 'المعلوماتية',
                'تكنولوجيا': 'التكنولوجيا',
            };
            if (midMap[norm]) return midMap[norm];
        }
        return (typeof subjectName !== 'undefined' ? subjectName : canonicalName);

}

function getTrialPrintBlockedMessage() {
    return (typeof Auth !== 'undefined' && typeof Auth.getFeatureBlockedMessage === 'function')
        ? Auth.getFeatureBlockedMessage('print')
        : 'الطباعة غير متاحة في النسخة التجريبية. يرجى تفعيل الاشتراك.';
}

function isPrintRestrictedForCurrentUser() {
    return typeof Auth !== 'undefined' && typeof Auth.isFeatureRestricted === 'function' && Auth.isFeatureRestricted('print');
}

function blockTrialPrint() {
    if (!isPrintRestrictedForCurrentUser()) return false;

    if (typeof Auth !== 'undefined' && typeof Auth.blockRestrictedFeature === 'function') {
        return Auth.blockRestrictedFeature('print');
    }

    Swal.fire({
        icon: 'warning',
        title: 'تنبيه',
        text: getTrialPrintBlockedMessage()
    });
    return true;
}

function syncRoomsPrintButton(hasPrintableData) {
    const printButton = document.getElementById('printRoomsBtn');
    if (!printButton) return;

    const isRestricted = isPrintRestrictedForCurrentUser();
    printButton.disabled = isRestricted || !hasPrintableData;
    printButton.style.opacity = printButton.disabled ? '0.6' : '';
    printButton.style.cursor = printButton.disabled ? 'not-allowed' : '';
    printButton.title = isRestricted ? getTrialPrintBlockedMessage() : '';
    printButton.setAttribute('aria-disabled', printButton.disabled ? 'true' : 'false');
}

document.addEventListener('DOMContentLoaded', initRemedialRoomsPage);

async function initRemedialRoomsPage() {
    const waitArea = document.getElementById('roomsWaitArea');
    const resultsArea = document.getElementById('roomsResults');

    try {
        if (typeof ensureRemedialDataReady !== 'function') {
            throw new Error('Remedial data helper is not available.');
        }

        await ensureRemedialDataReady();
        await loadRemedialRoomsSchedule();

        if (!remedialStudents || remedialStudents.length === 0) {
            syncRoomsPrintButton(false);
            renderRoomsEmptyState('لا توجد بيانات استدراك متاحة', 'يرجى التأكد من استيراد النتائج السنوية ووجود تلاميذ مؤهلين للاستدراك.');
            return;
        }

        populateRoomsFilters();
        bindRemedialRoomsEvents();
        renderRemedialRoomLists();
        syncRoomsPrintButton(generatedRoomSections.length > 0);

        if (waitArea) waitArea.style.display = 'none';
        if (resultsArea) resultsArea.style.display = 'grid';
    } catch (error) {
        console.error('Failed to initialize remedial room lists page:', error);
        syncRoomsPrintButton(false);
        renderRoomsEmptyState('تعذر تحميل الصفحة', 'حدث خطأ أثناء تجهيز قوائم قاعات الاستدراك.');
    }
}

function bindRemedialRoomsEvents() {
    document.getElementById('roomsYearSelect')?.addEventListener('change', () => {
        populateRoomsFilters();
        renderRemedialRoomLists();
    });

    document.getElementById('roomsLevelSelect')?.addEventListener('change', () => {
        populateRoomsStreamOptions();
        updateGroupByAvailability();
        renderRemedialRoomLists();
    });

    document.getElementById('roomsStreamSelect')?.addEventListener('change', renderRemedialRoomLists);
    document.getElementById('groupBySelect')?.addEventListener('change', renderRemedialRoomLists);
    document.getElementById('studentsPerRoomInput')?.addEventListener('input', renderRemedialRoomLists);
    document.getElementById('startRoomNumberInput')?.addEventListener('input', renderRemedialRoomLists);
    document.getElementById('generateRoomsBtn')?.addEventListener('click', renderRemedialRoomLists);
    document.getElementById('scheduleRoomsBtn')?.addEventListener('click', openRemedialRoomsScheduleModal);
    document.getElementById('printScheduleBtn')?.addEventListener('click', printRemedialRoomsSchedule);
    document.getElementById('printSummonsBtn')?.addEventListener('click', printRemedialSummonsSlips);
    document.getElementById('printRoomsBtn')?.addEventListener('click', showRoomPrintOptions);
}

function populateRoomsFilters() {
    populateRoomsYearOptions();
    populateRoomsLevelOptions();
    populateRoomsStreamOptions();
    updateGroupByAvailability();
}

function populateRoomsYearOptions() {
    const yearSelect = document.getElementById('roomsYearSelect');
    if (!yearSelect) return;

    const years = Array.from(new Set(remedialStudents.map(getStudentYear).filter(Boolean))).sort((a, b) => b.localeCompare(a));
    const currentValue = yearSelect.value;

    yearSelect.innerHTML = '';
    years.forEach(year => {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    });

    if (currentValue && years.includes(currentValue)) {
        yearSelect.value = currentValue;
    } else if (years.length > 0) {
        yearSelect.value = years[0];
    }
}

function populateRoomsLevelOptions() {
    const levelSelect = document.getElementById('roomsLevelSelect');
    const selectedYear = document.getElementById('roomsYearSelect')?.value || '';
    if (!levelSelect) return;

    const stage = getRemedialStage();
    const allowedLevelCodes = getAllowedRemedialLevels(stage);
    const currentValue = levelSelect.value;

    const levels = Array.from(new Set(
        remedialStudents
            .filter(student => !selectedYear || getStudentYear(student) === selectedYear)
            .map(student => student.level)
            .filter(level => level && isAllowedRemedialLevel(level, stage))
    )).sort((a, b) => {
        const codeA = allowedLevelCodes.find(code => matchLevel(a, code)) || '99';
        const codeB = allowedLevelCodes.find(code => matchLevel(b, code)) || '99';
        return Number(codeA) - Number(codeB);
    });

    levelSelect.innerHTML = '<option value="all">جميع المستويات</option>';
    levels.forEach(level => {
        levelSelect.innerHTML += `<option value="${level}">${level}</option>`;
    });

    if (currentValue && (currentValue === 'all' || levels.includes(currentValue))) {
        levelSelect.value = currentValue;
    }
}

function populateRoomsStreamOptions() {
    const streamGroup = document.getElementById('roomsStreamGroup');
    const streamSelect = document.getElementById('roomsStreamSelect');
    if (!streamGroup || !streamSelect) return;

    const stage = getRemedialStage();
    if (stage !== 'secondary') {
        streamGroup.style.display = 'none';
        streamSelect.innerHTML = '<option value="">جميع الشعب</option>';
        return;
    }

    streamGroup.style.display = 'flex';

    const selectedYear = document.getElementById('roomsYearSelect')?.value || '';
    const selectedLevel = document.getElementById('roomsLevelSelect')?.value || 'all';
    const currentValue = streamSelect.value;

    const streams = Array.from(new Set(
        remedialStudents
            .filter(student => !selectedYear || getStudentYear(student) === selectedYear)
            .filter(student => levelMatchesSelection(student.level, selectedLevel))
            .map(student => student.stream)
            .filter(Boolean)
    )).sort();

    streamSelect.innerHTML = '<option value="">جميع الشعب</option>';
    streams.forEach(stream => {
        streamSelect.innerHTML += `<option value="${stream}">${getShortStreamName(stream)}</option>`;
    });

    if (currentValue && streams.includes(currentValue)) {
        streamSelect.value = currentValue;
    } else {
        streamSelect.value = '';
    }
}

function updateGroupByAvailability() {
    const groupBySelect = document.getElementById('groupBySelect');
    if (!groupBySelect) return;

    const stage = getRemedialStage();
    const streamOption = Array.from(groupBySelect.options).find(option => option.value === 'stream');
    if (!streamOption) return;

    const hasStreams = stage === 'secondary' && remedialStudents.some(student => !!student.stream);
    streamOption.disabled = !hasStreams;

    if (!hasStreams && groupBySelect.value === 'stream') {
        groupBySelect.value = 'level';
    }
}

function getRemedialRoomsFilterState() {
    return {
        year: document.getElementById('roomsYearSelect')?.value || '',
        level: document.getElementById('roomsLevelSelect')?.value || 'all',
        stream: document.getElementById('roomsStreamSelect')?.value || '',
        groupBy: document.getElementById('groupBySelect')?.value || 'level',
        studentsPerRoom: sanitizePositiveInteger(document.getElementById('studentsPerRoomInput')?.value, 20, 1, 60),
        startRoomNumber: sanitizePositiveInteger(document.getElementById('startRoomNumberInput')?.value, 1, 1, 999)
    };
}

async function loadRemedialRoomsSchedule() {
    if (!window.DB || typeof DB.get !== 'function') {
        remedialRoomsSchedule = [];
        return;
    }

    const storedSchedule = await DB.get(REMEDIAL_ROOMS_SCHEDULE_KEY);
    remedialRoomsSchedule = Array.isArray(storedSchedule) ? storedSchedule : [];
}

async function saveRemedialRoomsSchedule() {
    if (!window.DB || typeof DB.set !== 'function') return;
    await DB.set(REMEDIAL_ROOMS_SCHEDULE_KEY, remedialRoomsSchedule);
}

function getScheduleYearForRooms() {
    return document.getElementById('roomsYearSelect')?.value || '';
}

function getVisibleRemedialRoomsScheduleEntries() {
    const selectedYear = getScheduleYearForRooms();
    return remedialRoomsSchedule
        .filter(entry => !entry.year || !selectedYear || entry.year === selectedYear)
        .slice()
        .sort((a, b) => {
            const levelCompare = String(a.level || '').localeCompare(String(b.level || ''), 'ar', { numeric: true });
            if (levelCompare !== 0) return levelCompare;
            const streamCompare = getShortStreamName(a.stream || '').localeCompare(getShortStreamName(b.stream || ''), 'ar');
            if (streamCompare !== 0) return streamCompare;
            const dateCompare = String(a.date || '').localeCompare(String(b.date || ''), 'ar', { numeric: true });
            if (dateCompare !== 0) return dateCompare;
            return String(a.startTime || '').localeCompare(String(b.startTime || ''), 'ar', { numeric: true });
        });
}

function getScheduleLevelOptions() {
    const selectedYear = getScheduleYearForRooms();
    const stage = getRemedialStage();
    const allowedLevelCodes = getAllowedRemedialLevels(stage);

    return Array.from(new Set(
        remedialStudents
            .filter(student => !selectedYear || getStudentYear(student) === selectedYear)
            .map(student => student.level)
            .filter(level => level && isAllowedRemedialLevel(level, stage))
    )).sort((a, b) => {
        const codeA = allowedLevelCodes.find(code => matchLevel(a, code)) || '99';
        const codeB = allowedLevelCodes.find(code => matchLevel(b, code)) || '99';
        return Number(codeA) - Number(codeB);
    });
}

function getScheduleSubjectOptions() {
    const selectedYear = getScheduleYearForRooms();
    return Array.from(new Set(
        remedialStudents
            .filter(student => !selectedYear || getStudentYear(student) === selectedYear)
            .flatMap(student => (student.remedialSubjects || []).map(subject => subject.name))
            .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'ar'));
}

function getScheduleStreamOptions() {
    if (getRemedialStage() !== 'secondary') return [];

    const selectedYear = getScheduleYearForRooms();
    return Array.from(new Set(
        remedialStudents
            .filter(student => !selectedYear || getStudentYear(student) === selectedYear)
            .map(student => student.stream)
            .filter(Boolean)
    )).sort((a, b) => getShortStreamName(a).localeCompare(getShortStreamName(b), 'ar'));
}

function renderScheduleSelectOptions(options, selectedValue, placeholder) {
    return [`<option value="">${escapeHtml(placeholder)}</option>`]
        .concat(options.map(option => {
            const selected = option === selectedValue ? 'selected' : '';
            const label = placeholder.includes('الشعبة')
                ? getShortStreamName(option)
                : (placeholder.includes('المادة') ? getRemedialSubjectPrintName(option) : option);
            return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(label)}</option>`;
        }))
        .join('');
}

function renderScheduleModalRow(entry = {}) {
    const levelOptions = getScheduleLevelOptions();
    const streamOptions = getScheduleStreamOptions();
    const subjectOptions = getScheduleSubjectOptions();
    const streamCell = getRemedialStage() === 'secondary'
        ? `
            <td>
                <select class="rooms-schedule-stream">
                    ${renderScheduleSelectOptions(streamOptions, entry.stream || '', 'كل الشعب')}
                </select>
            </td>
        `
        : '<td class="rooms-schedule-stream-cell" style="display:none;"><input class="rooms-schedule-stream" type="hidden" value=""></td>';

    return `
        <tr class="rooms-schedule-row">
            <td>
                <select class="rooms-schedule-level">
                    ${renderScheduleSelectOptions(levelOptions, entry.level || '', 'اختر المستوى')}
                </select>
            </td>
            ${streamCell}
            <td>
                <select class="rooms-schedule-subject">
                    ${renderScheduleSelectOptions(subjectOptions, entry.subject || '', 'اختر المادة')}
                </select>
            </td>
            <td><input class="rooms-schedule-date" type="date" value="${escapeHtml(entry.date || '')}"></td>
            <td><input class="rooms-schedule-start" type="time" value="${escapeHtml(entry.startTime || '')}"></td>
            <td><input class="rooms-schedule-end" type="time" value="${escapeHtml(entry.endTime || '')}"></td>
            <td><input class="rooms-schedule-room" type="text" value="${escapeHtml(entry.room || '')}" placeholder="مثال: القاعة 01"></td>
            <td><input class="rooms-schedule-note" type="text" value="${escapeHtml(entry.note || '')}" placeholder="اختياري"></td>
            <td class="rooms-schedule-actions"><button type="button" class="rooms-schedule-delete" title="حذف السطر">×</button></td>
        </tr>
    `;
}

function collectScheduleEntriesFromModal(year) {
    return Array.from(document.querySelectorAll('.rooms-schedule-row'))
        .map(row => ({
            year,
            level: row.querySelector('.rooms-schedule-level')?.value || '',
            stream: row.querySelector('.rooms-schedule-stream')?.value || '',
            subject: row.querySelector('.rooms-schedule-subject')?.value || '',
            date: row.querySelector('.rooms-schedule-date')?.value || '',
            startTime: row.querySelector('.rooms-schedule-start')?.value || '',
            endTime: row.querySelector('.rooms-schedule-end')?.value || '',
            room: row.querySelector('.rooms-schedule-room')?.value.trim() || '',
            note: row.querySelector('.rooms-schedule-note')?.value.trim() || ''
        }))
        .filter(entry => entry.level || entry.stream || entry.subject || entry.date || entry.startTime || entry.endTime || entry.room || entry.note);
}

async function openRemedialRoomsScheduleModal() {
    const selectedYear = getScheduleYearForRooms();
    const visibleEntries = getVisibleRemedialRoomsScheduleEntries();

    const result = await Swal.fire({
        title: 'رزنامة توقيت الاستدراك',
        html: `
            <style>
                .rooms-schedule-help {
                    text-align: right;
                    direction: rtl;
                    line-height: 1.7;
                    color: #475569;
                    font-weight: 700;
                    margin-bottom: 12px;
                }
                .rooms-schedule-editor {
                    width: 100%;
                    border-collapse: collapse;
                    direction: rtl;
                }
                .rooms-schedule-editor th,
                .rooms-schedule-editor td {
                    border: 1px solid #e2e8f0;
                    padding: 7px;
                    text-align: center;
                    vertical-align: middle;
                }
                .rooms-schedule-editor th {
                    background: #f8fafc;
                    color: #334155;
                    font-size: 0.82rem;
                }
                .rooms-schedule-editor select,
                .rooms-schedule-editor input {
                    width: 100%;
                    min-width: 95px;
                    border: 1px solid #cbd5e1;
                    border-radius: 9px;
                    padding: 7px 8px;
                    font-family: inherit;
                    font-weight: 700;
                    box-sizing: border-box;
                }
                .rooms-schedule-editor .rooms-schedule-subject {
                    min-width: 130px;
                }
                .rooms-schedule-delete,
                #addRoomsScheduleRowBtn {
                    border: none;
                    border-radius: 9px;
                    padding: 8px 12px;
                    font-family: inherit;
                    font-weight: 900;
                    cursor: pointer;
                }
                .rooms-schedule-delete {
                    background: #fee2e2;
                    color: #991b1b;
                    min-width: 42px;
                    padding: 8px 10px;
                    white-space: nowrap;
                    line-height: 1;
                    font-size: 1.15rem;
                }
                .rooms-schedule-actions {
                    width: 54px;
                    min-width: 54px;
                }
                #addRoomsScheduleRowBtn {
                    margin-top: 12px;
                    background: #ede9fe;
                    color: #5b21b6;
                    width: 100%;
                }
            </style>
            <div class="rooms-schedule-help">
                أضف حصة لكل مستوى ومادة، ثم اكتب التاريخ والتوقيت. الحقول الفارغة لا تُحفظ.
            </div>
            <table class="rooms-schedule-editor">
                <thead>
                    <tr>
                        <th>المستوى</th>
                        ${getRemedialStage() === 'secondary' ? '<th>الشعبة</th>' : ''}
                        <th>المادة</th>
                        <th>التاريخ</th>
                        <th>من</th>
                        <th>إلى</th>
                        <th>القاعة / الفوج</th>
                        <th>ملاحظة</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="roomsScheduleRows">
                    ${(visibleEntries.length ? visibleEntries : [{}]).map(entry => renderScheduleModalRow(entry)).join('')}
                </tbody>
            </table>
            <button type="button" id="addRoomsScheduleRowBtn">+ إضافة حصة جديدة</button>
        `,
        showCancelButton: true,
        confirmButtonText: 'حفظ الرزنامة',
        cancelButtonText: 'إلغاء',
        width: '1100px',
        didOpen: () => {
            const rowsBody = document.getElementById('roomsScheduleRows');
            const bindDeleteButtons = () => {
                document.querySelectorAll('.rooms-schedule-delete').forEach(button => {
                    button.onclick = () => {
                        const row = button.closest('tr');
                        if (row) row.remove();
                        if (rowsBody && rowsBody.children.length === 0) {
                            rowsBody.insertAdjacentHTML('beforeend', renderScheduleModalRow({}));
                            bindDeleteButtons();
                        }
                    };
                });
            };

            document.getElementById('addRoomsScheduleRowBtn')?.addEventListener('click', () => {
                rowsBody?.insertAdjacentHTML('beforeend', renderScheduleModalRow({}));
                bindDeleteButtons();
            });

            bindDeleteButtons();
        },
        preConfirm: () => {
            return collectScheduleEntriesFromModal(selectedYear);
        }
    });

    if (!result.isConfirmed) return;

    remedialRoomsSchedule = remedialRoomsSchedule
        .filter(entry => (entry.year || '') !== selectedYear)
        .concat(result.value || []);

    await saveRemedialRoomsSchedule();
    renderRemedialRoomsSchedulePreview();

    Swal.fire({
        icon: 'success',
        title: 'تم الحفظ',
        text: 'تم حفظ رزنامة توقيت الاستدراك بنجاح.',
        timer: 1300,
        showConfirmButton: false
    });
}

function renderRemedialRoomsSchedulePreview() {
    const preview = document.getElementById('roomsSchedulePreview');
    if (!preview) return;

    const entries = getVisibleRemedialRoomsScheduleEntries();
    if (entries.length === 0) {
        preview.style.display = 'none';
        preview.innerHTML = '';
        return;
    }

    preview.style.display = 'none';
    preview.innerHTML = `
        <h3><span data-icon="calendar-clock"></span> رزنامة توقيت الاستدراك</h3>
        <table class="schedule-table">
            <thead>
                <tr>
                    <th>المستوى</th>
                    ${getRemedialStage() === 'secondary' ? '<th>الشعبة</th>' : ''}
                    <th>التاريخ</th>
                    <th>من</th>
                    <th>إلى</th>
                    <th>المادة</th>
                    <th>القاعة / الفوج</th>
                    <th>ملاحظة</th>
                </tr>
            </thead>
            <tbody>
                ${entries.map(entry => `
                    <tr>
                        <td>${escapeHtml(entry.level || '-')}</td>
                        ${getRemedialStage() === 'secondary' ? `<td>${escapeHtml(entry.stream ? getShortStreamName(entry.stream) : 'كل الشعب')}</td>` : ''}
                        <td>${escapeHtml(entry.date || '-')}</td>
                        <td>${escapeHtml(entry.startTime || '-')}</td>
                        <td>${escapeHtml(entry.endTime || '-')}</td>
                        <td>${escapeHtml(getRemedialSubjectPrintName(entry.subject || '-'))}</td>
                        <td>${escapeHtml(entry.room || '-')}</td>
                        <td>${escapeHtml(entry.note || '-')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    if (window.IconManager) window.IconManager.render();
}

function sanitizePositiveInteger(value, fallback, minValue, maxValue) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(minValue, Math.min(maxValue, parsed));
}

function getFilteredRemedialStudentsForRooms() {
    const filters = getRemedialRoomsFilterState();
    return remedialStudents
        .filter(student => !filters.year || getStudentYear(student) === filters.year)
        .filter(student => levelMatchesSelection(student.level, filters.level))
        .filter(student => !filters.stream || student.stream === filters.stream)
        .sort(compareRemedialStudentsForRooms);
}

function compareRemedialStudentsForRooms(a, b) {
    const levelOrderA = getLevelOrderForRooms(a.level);
    const levelOrderB = getLevelOrderForRooms(b.level);
    if (levelOrderA !== levelOrderB) return levelOrderA - levelOrderB;

    const streamA = getShortStreamName(a.stream || '').toString();
    const streamB = getShortStreamName(b.stream || '').toString();
    const streamCompare = streamA.localeCompare(streamB, 'ar');
    if (streamCompare !== 0) return streamCompare;

    const classCompare = String(a.class || '').localeCompare(String(b.class || ''), 'ar', { numeric: true });
    if (classCompare !== 0) return classCompare;

    return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
}

function getLevelOrderForRooms(levelValue) {
    if (matchLevel(levelValue, '1')) return 1;
    if (matchLevel(levelValue, '2')) return 2;
    if (matchLevel(levelValue, '3')) return 3;
    if (matchLevel(levelValue, '4')) return 4;
    return 99;
}

function buildRoomSections(filteredStudents) {
    const filters = getRemedialRoomsFilterState();
    const stage = getRemedialStage();
    const effectiveGroupBy = (filters.groupBy === 'stream' && stage === 'secondary') ? 'stream' : 'level';
    const grouped = new Map();

    filteredStudents.forEach(student => {
        const groupKey = effectiveGroupBy === 'stream'
            ? (student.stream || 'بدون-شعبة')
            : (student.level || 'بدون-مستوى');

        if (!grouped.has(groupKey)) {
            grouped.set(groupKey, []);
        }
        grouped.get(groupKey).push(student);
    });

    const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
        if (effectiveGroupBy === 'stream') {
            return getShortStreamName(a[0]).localeCompare(getShortStreamName(b[0]), 'ar');
        }
        return getLevelOrderForRooms(a[0]) - getLevelOrderForRooms(b[0]);
    });

    let roomCounter = filters.startRoomNumber;
    return sortedGroups.map(([groupKey, students], groupIndex) => {
        const rooms = chunkStudents(students, filters.studentsPerRoom).map((roomStudents, roomIndex) => {
            const roomNumber = String(roomCounter++).padStart(2, '0');
            return {
                roomLabel: `القاعة ${roomNumber}`,
                subgroupLabel: `الفوج ${roomIndex + 1}`,
                students: roomStudents
            };
        });

        return {
            key: `${effectiveGroupBy}-${groupKey}-${groupIndex}`,
            title: effectiveGroupBy === 'stream' ? getShortStreamName(groupKey) : groupKey,
            subtitle: effectiveGroupBy === 'stream' ? 'التقسيم حسب الشعبة' : 'التقسيم حسب المستوى',
            studentCount: students.length,
            roomCount: rooms.length,
            rooms
        };
    });
}

function chunkStudents(students, chunkSize) {
    const result = [];
    for (let index = 0; index < students.length; index += chunkSize) {
        result.push(students.slice(index, index + chunkSize));
    }
    return result;
}

function renderRemedialRoomLists() {
    const waitArea = document.getElementById('roomsWaitArea');
    const resultsArea = document.getElementById('roomsResults');
    const filters = getRemedialRoomsFilterState();
    const filteredStudents = getFilteredRemedialStudentsForRooms();

    if (waitArea) waitArea.style.display = 'none';
    if (resultsArea) resultsArea.style.display = 'grid';

    generatedRoomSections = buildRoomSections(filteredStudents);
    updateRoomsSummary(filteredStudents, generatedRoomSections, filters.groupBy === 'stream' ? 'حسب الشعبة' : 'حسب المستوى');
    renderRemedialRoomsSchedulePreview();

    if (!resultsArea) return;

    if (filteredStudents.length === 0 || generatedRoomSections.length === 0) {
        resultsArea.innerHTML = `
            <div class="empty-state">
                <h3>لا توجد قوائم قابلة للإنشاء</h3>
                <p>غيّر الفلاتر الحالية أو تأكد من وجود تلاميذ مستدركين ضمن الاختيار الحالي.</p>
            </div>
        `;
        syncRoomsPrintButton(false);
        return;
    }

    resultsArea.innerHTML = generatedRoomSections.map(section => `
        <section class="group-card">
            <div class="group-header">
                <div class="group-title">
                    <h3>${escapeHtml(section.title)}</h3>
                    <p>${escapeHtml(section.subtitle)}</p>
                </div>
                <div class="group-badges">
                    <span class="info-pill">${section.studentCount} تلميذ</span>
                    <span class="info-pill">${section.roomCount} قاعة / فوج</span>
                </div>
            </div>
            <div class="rooms-grid">
                ${section.rooms.map(room => renderSingleRoomCard(room)).join('')}
            </div>
        </section>
    `).join('');

    syncRoomsPrintButton(true);
}

function renderSingleRoomCard(room) {
    const isSecondary = getRemedialStage() === 'secondary';
    return `
        <article class="room-card">
            <div class="room-card-header">
                <div>
                    <h4>${escapeHtml(room.roomLabel)}</h4>
                    <p>${escapeHtml(room.subgroupLabel)}</p>
                </div>
                <span class="room-meta">${room.students.length} تلميذ</span>
            </div>
            <div class="room-table-wrap">
                <table class="room-table">
                    <thead>
                        <tr>
                            <th width="6%">#</th>
                            <th width="${isSecondary ? '35%' : '45%'}">الاسم واللقب</th>
                            <th width="${isSecondary ? '9%' : '10%'}">الجنس</th>
                            <th width="${isSecondary ? '15%' : '16%'}">المستوى</th>
                            ${isSecondary ? '<th width="14%">الشعبة</th>' : ''}
                            <th width="${isSecondary ? '10%' : '11%'}">القسم</th>
                            <th width="${isSecondary ? '11%' : '12%'}">المعدل</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${room.students.map((student, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td class="name-cell">${escapeHtml(student.name || '')}</td>
                                <td>${escapeHtml(student.gender || '-')}</td>
                                <td>${escapeHtml(student.level || '-')}</td>
                                ${isSecondary ? `<td>${escapeHtml(getShortStreamName(student.stream || '-') || '-')}</td>` : ''}
                                <td>${escapeHtml(student.class || '-')}</td>
                                <td>${formatRoundedTwoDecimals(student.annualAverage || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </article>
    `;
}

function renderRoomSubjects(subjects) {
    if (!subjects || subjects.length === 0) return '-';
    return subjects.map(subject => `<span class="subject-chip">${escapeHtml(getRemedialSubjectPrintName(subject.name || ''))}</span>`).join('');
}

function updateRoomsSummary(filteredStudents, sections, modeLabel) {
    const totalRooms = sections.reduce((sum, section) => sum + section.roomCount, 0);
    const summaryStudentsCount = document.getElementById('summaryStudentsCount');
    const summaryRoomsCount = document.getElementById('summaryRoomsCount');
    const summaryGroupsCount = document.getElementById('summaryGroupsCount');
    const summaryModeLabel = document.getElementById('summaryModeLabel');

    if (summaryStudentsCount) summaryStudentsCount.textContent = filteredStudents.length;
    if (summaryRoomsCount) summaryRoomsCount.textContent = totalRooms;
    if (summaryGroupsCount) summaryGroupsCount.textContent = sections.length;
    if (summaryModeLabel) summaryModeLabel.textContent = modeLabel;
}

function renderRoomsEmptyState(title, subtitle) {
    const waitArea = document.getElementById('roomsWaitArea');
    const resultsArea = document.getElementById('roomsResults');
    if (waitArea) {
        waitArea.className = 'empty-state';
        waitArea.innerHTML = `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(subtitle)}</p>`;
        waitArea.style.display = 'block';
    }
    if (resultsArea) {
        resultsArea.innerHTML = '';
        resultsArea.style.display = 'none';
    }
}



function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderPrintableRoomsSchedule(scheduleEntries) {
    if (!scheduleEntries || scheduleEntries.length === 0) return '';

    const groupedByLevel = new Map();
    scheduleEntries.forEach(entry => {
        const streamLabel = getRemedialStage() === 'secondary' && entry.stream ? ` - ${getShortStreamName(entry.stream)}` : '';
        const levelLabel = `${entry.level || 'بدون مستوى'}${streamLabel}`;
        if (!groupedByLevel.has(levelLabel)) groupedByLevel.set(levelLabel, []);
        groupedByLevel.get(levelLabel).push(entry);
    });

    const allEntries = Array.from(groupedByLevel.entries());
    return allEntries.map(([levelLabel, entries], idx) => `
        <div class="print-schedule-block" style="${idx < allEntries.length - 1 ? 'page-break-after: always;' : ''}">
            <h3>رزنامة توقيت الاستدراك - ${escapeHtml(levelLabel)}</h3>
            <table class="print-schedule-table">
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>من</th>
                        <th>إلى</th>
                        <th>المادة</th>
                        <th>القاعة / الفوج</th>
                        <th>ملاحظة</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(entry => `
                        <tr>
                            <td>${escapeHtml(entry.date || '-')}</td>
                            <td>${escapeHtml(entry.startTime || '-')}</td>
                            <td>${escapeHtml(entry.endTime || '-')}</td>
                            <td>${escapeHtml(getRemedialSubjectPrintName(entry.subject || '-'))}</td>
                            <td>${escapeHtml(entry.room || '-')}</td>
                            <td>${escapeHtml(entry.note || '-')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('');
}

function getStudentsForRemedialSummons() {
    const fromGeneratedRooms = generatedRoomSections
        .flatMap(section => section.rooms || [])
        .flatMap(room => room.students || []);

    if (fromGeneratedRooms.length > 0) {
        return fromGeneratedRooms;
    }

    return getFilteredRemedialStudentsForRooms();
}

function getStudentScheduleEntries(student) {
    const studentSubjects = new Set(
        (student.remedialSubjects || [])
            .map(subject => normalizeArabic(subject.name || ''))
            .filter(Boolean)
    );
    const studentLevel = normalizeArabic(student.level || '');
    const studentStream = normalizeArabic(student.stream || '');

    return getVisibleRemedialRoomsScheduleEntries().filter(entry => {
        const entryLevel = normalizeArabic(entry.level || '');
        const entryStream = normalizeArabic(entry.stream || '');
        const entrySubject = normalizeArabic(entry.subject || '');
        const levelMatches = !entryLevel || !studentLevel || entryLevel === studentLevel;
        const streamMatches = getRemedialStage() !== 'secondary' || !entryStream || !studentStream || entryStream === studentStream;
        const subjectMatches = !entrySubject || studentSubjects.has(entrySubject);
        return levelMatches && streamMatches && subjectMatches;
    });
}

function renderSummonsSubjects(subjects) {
    if (!subjects || subjects.length === 0) return '<span class="empty-text">لا توجد مواد</span>';

    return subjects.map(subject => `
        <span class="summons-subject-chip">
            ${escapeHtml(getRemedialSubjectPrintName(subject.name || ''))}
        </span>
    `).join('');
}

function renderSummonsSchedule(scheduleEntries) {
    if (!scheduleEntries || scheduleEntries.length === 0) {
        return '<div class="empty-text">لم تُحدد رزنامة لهذه المواد بعد.</div>';
    }

    const stage = (typeof getRemedialStage === 'function') ? getRemedialStage() : 'middle';
    
    if (stage !== 'secondary') {
        return `
        <table class="summons-schedule-table">
            <thead>
                <tr>
                    <th style="width: 18%">المادة</th>
                    ${scheduleEntries.map(entry => `<th>${escapeHtml(getRemedialSubjectPrintName(entry.subject || '-'))}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                <tr>
                    <th>التاريخ</th>
                    ${scheduleEntries.map(entry => `<td>${escapeHtml(entry.date || '-')}</td>`).join('')}
                </tr>
                <tr>
                    <th>التوقيت</th>
                    ${scheduleEntries.map(entry => `<td><span dir="ltr">${escapeHtml([entry.startTime, entry.endTime].filter(Boolean).join(' - ') || '-')}</span><br><small style="color:#475569">(ق: ${escapeHtml(entry.room || '-')})</small></td>`).join('')}
                </tr>
            </tbody>
        </table>
        `;
    }

    return `
        <table class="summons-schedule-table">
            <thead>
                <tr>
                    <th>المادة</th>
                    <th>التاريخ</th>
                    <th>التوقيت والقاعة</th>
                </tr>
            </thead>
            <tbody>
                ${scheduleEntries.map(entry => `
                    <tr>
                        <td>${escapeHtml(getRemedialSubjectPrintName(entry.subject || '-'))}</td>
                        <td>${escapeHtml(entry.date || '-')}</td>
                        <td><span dir="ltr">${escapeHtml([entry.startTime, entry.endTime].filter(Boolean).join(' - ') || '-')}</span><br><small style="color:#475569">(ق: ${escapeHtml(entry.room || '-')})</small></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderSummonsSlip(student, settings, resolvedYear) {
    const scheduleEntries = getStudentScheduleEntries(student);

    return `
        <article class="summons-slip">
            <div class="summons-slip-header">
                <div class="summons-mini-meta">
                    <span>المؤسسة: ${escapeHtml(settings.institutionName || '.......')}</span>
                    <span>السنة الدراسية: ${escapeHtml(resolvedYear)}</span>
                </div>
                <h2>استدعاء الامتحان الاستدراكي</h2>
            </div>

            <div class="summons-student-grid">
                <div><strong>الاسم واللقب:</strong> ${escapeHtml(student.name || '')}</div>
                <div><strong>المستوى:</strong> ${escapeHtml(student.level || '-')}</div>
                <div><strong>القسم:</strong> ${escapeHtml(student.class || '-')}</div>
                <div><strong>المعدل السنوي:</strong> ${formatRoundedTwoDecimals(student.annualAverage || 0)}</div>
            </div>

            <div class="summons-section-title">المواد المعنية بالاستدراك</div>
            <div class="summons-subjects">
                ${renderSummonsSubjects(student.remedialSubjects || [])}
            </div>

            <div class="summons-section-title">رزنامة توقيت مواد التلميذ</div>
            ${renderSummonsSchedule(scheduleEntries)}

            <div class="summons-footer">
                <span>يرجى الحضور في الوقت المحدد مصحوبًا بهذا الاستدعاء.</span>
                <span>الإدارة</span>
            </div>
        </article>
    `;
}

async function printRemedialSummonsSlips() {
    if (blockTrialPrint()) {
        return;
    }

    const students = getStudentsForRemedialSummons();
    if (!students || students.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد تلاميذ لطباعة الاستدعاءات ضمن الاختيار الحالي.' });
        return;
    }

    const settings = (window.DB && typeof DB.getSettings === 'function')
        ? (await DB.getSettings() || {})
        : {};
    const filters = getRemedialRoomsFilterState();
    const resolvedYear = settings.schoolYear || filters.year || '.......';
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
    const fontRegularUrl = new URL('../../assets/fonts/Tajawal-Regular.ttf', window.location.href).href;
    const fontBoldUrl = new URL('../../assets/fonts/Tajawal-Bold.ttf', window.location.href).href;
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'يرجى السماح بالنوافذ المنبثقة (Pop-ups) للطباعة.' });
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>استدعاءات الاستدراك</title>
            <style>
                @font-face {
                    font-family: 'Tajawal';
                    font-style: normal;
                    font-weight: 400;
                    src: url('${fontRegularUrl}') format('truetype');
                }
                @font-face {
                    font-family: 'Tajawal';
                    font-style: normal;
                    font-weight: 700;
                    src: url('${fontBoldUrl}') format('truetype');
                }
                * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                @page { margin: 0; }
                body {
                    margin: 0;
                    padding: 0;
                    background: #fff;
                    color: #0f172a;
                    font-family: 'Tajawal', sans-serif;
                }
                .summons-page {
                    display: grid;
                    grid-template-rows: repeat(3, 1fr);
                    gap: 3mm;
                    padding: 10mm;
                    box-sizing: border-box;
                    min-height: 296mm;
                    break-after: page;
                    page-break-after: always;
                }
                .summons-page:last-child {
                    break-after: auto;
                    page-break-after: auto;
                }
                .summons-slip {
                    border: 1.5pt solid #0f172a;
                    border-radius: 14px;
                    padding: 6px 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    min-height: 0;
                    overflow: hidden;
                }
                .summons-slip-header {
                    border-bottom: 1pt solid #cbd5e1;
                    padding-bottom: 6px;
                }
                .summons-mini-meta {
                    display: flex;
                    justify-content: space-between;
                    gap: 5px;
                    font-size: 8.5pt;
                    color: #475569;
                    font-weight: 700;
                }
                .summons-slip h2 {
                    margin: 2px 0 0;
                    text-align: center;
                    color: #000000;
                    font-size: 13pt;
                }
                .summons-student-grid {
                    display: grid;
                    grid-template-columns: 1.4fr 0.8fr 0.7fr 0.8fr;
                    gap: 6px;
                    font-size: 9.5pt;
                    font-weight: 700;
                }
                .summons-student-grid div {
                    border: 1pt solid #e2e8f0;
                    border-radius: 9px;
                    padding: 5px 7px;
                    background: #f8fafc;
                }
                .summons-section-title {
                    font-size: 9.5pt;
                    font-weight: 700;
                    color: #000000;
                    border-right: 4px solid #000000;
                    padding-right: 4px;
                    line-height: 1.2;
                }
                .summons-subjects {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    min-height: 24px;
                }
                .summons-subject-chip {
                    border: 1pt solid #cbd5e1;
                    background: #f8fafc;
                    color: #000000;
                    border-radius: 999px;
                    padding: 3px 8px;
                    font-size: 8.5pt;
                    font-weight: 700;
                    display: inline-flex;
                    gap: 5px;
                    align-items: center;
                }
                .summons-subject-chip small {
                    color: #475569;
                    font-size: 7.5pt;
                }
                .summons-schedule-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                .summons-schedule-table th,
                .summons-schedule-table td {
                    border: 1pt solid #0f172a;
                    padding: 2px 3px;
                    text-align: center;
                    font-size: 8pt;
                    line-height: 1.2;
                    word-break: break-word;
                }
                .summons-schedule-table th {
                    background: #f1f5f9;
                    color: #000000;
                    font-weight: 700;
                }
                .empty-text {
                    color: #64748b;
                    font-size: 8.5pt;
                    font-weight: 700;
                    padding: 4px 0;
                }
                .summons-footer {
                    margin-top: auto;
                    border-top: 1pt dashed #94a3b8;
                    padding-top: 5px;
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                    color: #475569;
                    font-size: 8.4pt;
                    font-weight: 700;
                }
                @page { size: A4 portrait; margin: 0; }
            </style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
            ${chunkStudents(students, 3).map(pageStudents => `
                <section class="summons-page">
                    ${pageStudents.map(student => renderSummonsSlip(student, settings, resolvedYear)).join('')}
                </section>
            `).join('')}
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
}

async function printRemedialRoomsSchedule() {
    if (blockTrialPrint()) {
        return;
    }

    const scheduleEntries = getVisibleRemedialRoomsScheduleEntries();
    if (!scheduleEntries || scheduleEntries.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد رزنامة محفوظة للطباعة.' });
        return;
    }

    const settings = (window.DB && typeof DB.getSettings === 'function')
        ? (await DB.getSettings() || {})
        : {};
    const filters = getRemedialRoomsFilterState();
    const resolvedYear = settings.schoolYear || filters.year || '.......';
    const institutionName = settings.institutionName || '.......';
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
    const fontRegularUrl = new URL('../../assets/fonts/Tajawal-Regular.ttf', window.location.href).href;
    const fontBoldUrl = new URL('../../assets/fonts/Tajawal-Bold.ttf', window.location.href).href;
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'يرجى السماح بالنوافذ المنبثقة (Pop-ups) للطباعة.' });
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>رزنامة توقيت الاستدراك</title>
            <style>
                @font-face {
                    font-family: 'Tajawal';
                    font-style: normal;
                    font-weight: 400;
                    src: url('${fontRegularUrl}') format('truetype');
                }
                @font-face {
                    font-family: 'Tajawal';
                    font-style: normal;
                    font-weight: 700;
                    src: url('${fontBoldUrl}') format('truetype');
                }
                * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body {
                    font-family: 'Tajawal', sans-serif;
                    margin: 0;
                    padding: 18px;
                    color: #0f172a;
                    background: #fff;
                }
                .schedule-print-header {
                    border-bottom: 2px solid #1d4ed8;
                    padding-bottom: 12px;
                    margin-bottom: 18px;
                }
                .schedule-meta-row {
                    display: flex;
                    justify-content: space-between;
                    gap: 14px;
                    font-size: 10pt;
                    margin-bottom: 6px;
                    font-weight: 700;
                }
                h1 {
                    margin: 8px 0;
                    text-align: center;
                    font-size: 18pt;
                    color: #1d4ed8;
                }
                .schedule-subtitle {
                    text-align: center;
                    margin: 0;
                    color: #475569;
                    font-weight: 700;
                    font-size: 10pt;
                }
                .print-schedule-block {
                    border: 1px solid #000;
                    border-radius: 12px;
                    padding: 10px;
                    margin: 0 0 14px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                .print-schedule-block h3 {
                    display: block;
                    margin: 0 0 8px;
                    text-align: center;
                    color: #1d4ed8;
                    font-size: 12pt;
                }
                .print-schedule-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                .print-schedule-table th,
                .print-schedule-table td {
                    border: 1pt solid #000;
                    padding: 7px 6px;
                    text-align: center;
                    font-size: 9pt;
                    line-height: 1.3;
                    word-break: break-word;
                }
                .print-schedule-table th {
                    background: #f8fafc;
                    color: #1d4ed8;
                    font-weight: 700;
                }
                @page { size: A4 landscape; margin: 1cm; }
            </style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
            <div class="schedule-print-header">
                <div class="schedule-meta-row">
                    <div>الولاية: ${escapeHtml(settings.wilaya || '.......')}</div>
                    <div>البلدية: ${escapeHtml(settings.municipality || '.......')}</div>
                </div>
                <h1>رزنامة توقيت الاستدراك</h1>
                <p class="schedule-subtitle">جدول توقيت مواد الامتحان الاستدراكي حسب المستوى</p>
                <div class="schedule-meta-row" style="margin-top:8px;">
                    <div>السنة الدراسية: ${escapeHtml(resolvedYear)}</div>
                    <div>المؤسسة: ${escapeHtml(institutionName)}</div>
                    <div>تاريخ الطباعة: ${escapeHtml(today)}</div>
                </div>
            </div>
            ${renderPrintableRoomsSchedule(scheduleEntries)}
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({ advanced: false }) : ''}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
}

function buildPrintableRoomSections(settings, filters, today, totals, printModel = 1) {
    const resolvedYear = settings.schoolYear || filters.year || '.......';
    const institutionName = settings.institutionName || '.......';

    return generatedRoomSections
        .flatMap((section, sectionIndex) => section.rooms.map((room, roomIndex) => {
            const roomLevels = Array.from(new Set(room.students.map(student => student.level).filter(Boolean)));
            const roomStreams = Array.from(new Set(
                room.students
                    .map(student => getShortStreamName(student.stream || ''))
                    .filter(Boolean)
            ));
            const isFirstPrintedRoom = sectionIndex === 0 && roomIndex === 0;

            const levelText = roomLevels.length > 0 ? roomLevels.join(' - ') : (filters.level === 'all' ? 'جميع المستويات' : filters.level);
            const streamText = roomStreams.length > 0 ? roomStreams.join(' - ') : (filters.stream ? getShortStreamName(filters.stream) : 'جميع الشعب');

            return `
                <section class="print-room-page">
                    ${isFirstPrintedRoom ? `
                        <div class="report-header report-header-inline">
                            <div class="report-meta-row">
                                <div>الولاية: ${escapeHtml(settings.wilaya || '.......')}</div>
                                <div>البلدية: ${escapeHtml(settings.municipality || '.......')}</div>
                            </div>
                            <h1 class="report-title">قوائم قاعات الاستدراك</h1>
                            <p class="report-subtitle">توزيع التلاميذ المعنيين بالامتحان الاستدراكي على القاعات والأفواج</p>
                            <div class="report-meta-row" style="margin-top:8px;">
                                <div>السنة الدراسية: ${escapeHtml(resolvedYear)}</div>
                                <div>المؤسسة: ${escapeHtml(institutionName)}</div>
                                <div>تاريخ الطباعة: ${escapeHtml(today)}</div>
                            </div>
                        </div>

                        <div class="summary-strip summary-strip-inline">
                            <div class="summary-box">
                                <strong>${totals.totalStudents}</strong>
                                <span>عدد التلاميذ</span>
                            </div>
                            <div class="summary-box">
                                <strong>${totals.totalRooms}</strong>
                                <span>عدد القاعات / الأفواج</span>
                            </div>
                            <div class="summary-box">
                                <strong>${totals.totalGroups}</strong>
                                <span>المجموعات الأساسية</span>
                            </div>
                            <div class="summary-box">
                                <strong>${escapeHtml(totals.groupByLabel)}</strong>
                                <span>طريقة التقسيم</span>
                            </div>
                        </div>

                        <div class="inline-meta inline-meta-intro">
                            <div>المستوى: ${escapeHtml(totals.levelLabel)}</div>
                            <div>الشعبة: ${escapeHtml(totals.streamLabel)}</div>
                            <div>عدد التلاميذ في الفوج: ${totals.studentsPerRoom}</div>
                        </div>
                    ` : ''}
                    <div class="room-print-header">
                        <div class="room-print-top">
                            <div>الولاية: ${escapeHtml(settings.wilaya || '.......')}</div>
                            <div>البلدية: ${escapeHtml(settings.municipality || '.......')}</div>
                        </div>
                        <h2 class="room-print-title">قائمة قاعة / فوج الاستدراك</h2>
                        <div class="room-print-top">
                            <div>المؤسسة: ${escapeHtml(institutionName)}</div>
                            <div>السنة الدراسية: ${escapeHtml(resolvedYear)}</div>
                            <div>تاريخ الطباعة: ${escapeHtml(today)}</div>
                        </div>
                        <div class="room-print-tags">
                            <span class="room-print-tag">المجموعة: ${escapeHtml(section.title)}</span>
                            <span class="room-print-tag">التقسيم: ${escapeHtml(section.subtitle)}</span>
                            <span class="room-print-tag">القاعة: ${escapeHtml(room.roomLabel)}</span>
                            <span class="room-print-tag">الفوج: ${escapeHtml(room.subgroupLabel)}</span>
                            <span class="room-print-tag">المستوى: ${escapeHtml(levelText)}</span>
                            <span class="room-print-tag">الشعبة: ${escapeHtml(streamText)}</span>
                        </div>
                    </div>
                    ${printModel === 2 ? renderSingleRoomCardModel2(room, getRemedialStage()) : renderSingleRoomCard(room)}
                </section>
            `;
        }))
        .join('');
}

async function printRemedialRoomLists(printModel = 1) {
    if (blockTrialPrint()) {
        return;
    }

    if (!generatedRoomSections || generatedRoomSections.length === 0) {
        Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لا توجد قوائم مطبوعة حاليًا. أنشئ القوائم أولًا.' });
        return;
    }

    const settings = (window.DB && typeof DB.getSettings === 'function')
        ? (await DB.getSettings() || {})
        : {};
    const filters = getRemedialRoomsFilterState();
    const yearLabel = filters.year || '';
    const levelLabel = filters.level === 'all' ? 'جميع المستويات' : filters.level;
    const streamLabel = filters.stream ? getShortStreamName(filters.stream) : 'جميع الشعب';
    const groupByLabel = filters.groupBy === 'stream' ? 'حسب الشعبة' : 'حسب المستوى';
    const totalStudents = generatedRoomSections.reduce((sum, section) => sum + section.studentCount, 0);
    const totalRooms = generatedRoomSections.reduce((sum, section) => sum + section.roomCount, 0);
    const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
    const fontRegularUrl = new URL('../../assets/fonts/Tajawal-Regular.ttf', window.location.href).href;
    const fontBoldUrl = new URL('../../assets/fonts/Tajawal-Bold.ttf', window.location.href).href;
    const printSectionsMarkup = buildPrintableRoomSections(settings, filters, today, {
        totalStudents,
        totalRooms,
        totalGroups: generatedRoomSections.length,
        groupByLabel,
        levelLabel,
        streamLabel,
        studentsPerRoom: filters.studentsPerRoom
    }, printModel);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'يرجى السماح بالنوافذ المنبثقة (Pop-ups) للطباعة.' });
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>قوائم قاعات الاستدراك</title>
            <style>
                @font-face {
                    font-family: 'Tajawal';
                    font-style: normal;
                    font-weight: 400;
                    src: url('${fontRegularUrl}') format('truetype');
                }
                @font-face {
                    font-family: 'Tajawal';
                    font-style: normal;
                    font-weight: 700;
                    src: url('${fontBoldUrl}') format('truetype');
                }
                :root {
                    --print-primary: #1d4ed8;
                    --print-text: #0f172a;
                    --print-muted: #475569;
                    --print-border: #000000;
                    --print-header-bg: #f8fafc;
                }
                * {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                body {
                    font-family: 'Tajawal', sans-serif;
                    margin: 0;
                    padding: 18px;
                    color: var(--print-text);
                    background: white;
                }
                .print-shell {
                    width: 100%;
                }
                .report-header {
                    border-bottom: 2px solid var(--print-primary);
                    padding-bottom: 12px;
                    margin-bottom: 18px;
                }
                .print-shell > .report-header {
                    display: none;
                }
                .report-header-inline {
                    display: block;
                }
                .report-meta-row {
                    display: flex;
                    justify-content: space-between;
                    gap: 14px;
                    font-size: 10pt;
                    margin-bottom: 6px;
                }
                .report-title {
                    margin: 8px 0;
                    text-align: center;
                    font-size: 18pt;
                    color: var(--print-primary);
                    font-weight: 700;
                }
                .report-subtitle {
                    text-align: center;
                    color: var(--print-muted);
                    font-size: 9.5pt;
                    margin: 0;
                }
                .summary-strip {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin: 18px 0;
                }
                .print-shell > .summary-strip {
                    display: none;
                }
                .summary-strip-inline {
                    display: grid;
                    margin: 14px 0 12px;
                }
                .summary-box {
                    border: 1px solid var(--print-border);
                    border-radius: 12px;
                    padding: 10px 12px;
                    background: #f8fbff;
                    text-align: center;
                }
                .summary-box strong {
                    display: block;
                    font-size: 15pt;
                    color: var(--print-primary);
                    margin-bottom: 3px;
                }
                .summary-box span {
                    font-size: 8.5pt;
                    color: var(--print-muted);
                    font-weight: 700;
                }
                .inline-meta {
                    display: flex;
                    justify-content: space-between;
                    gap: 14px;
                    margin-bottom: 14px;
                    font-size: 9pt;
                    font-weight: 700;
                }
                .print-shell > .inline-meta {
                    display: none;
                }
                .inline-meta-intro {
                    display: flex;
                    margin-bottom: 12px;
                }
                .print-schedule-block {
                    border: 1px solid var(--print-border);
                    border-radius: 12px;
                    padding: 10px;
                    margin: 0 0 12px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                .print-schedule-block h3 {
                    margin: 0 0 8px;
                    text-align: center;
                    color: var(--print-primary);
                    font-size: 11pt;
                }
                .print-schedule-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                .print-schedule-table th,
                .print-schedule-table td {
                    border: 1pt solid var(--print-border);
                    padding: 5px 6px;
                    text-align: center;
                    font-size: 8.2pt;
                    line-height: 1.25;
                    word-break: break-word;
                }
                .print-schedule-table th {
                    background: var(--print-header-bg);
                    color: var(--print-primary);
                    font-weight: 700;
                }
                .group-card {
                    margin-bottom: 18px;
                    border: 1px solid var(--print-border);
                    border-radius: 14px;
                    overflow: hidden;
                }
                .print-room-page {
                    margin-bottom: 0;
                    break-after: page;
                    page-break-after: always;
                }
                .print-room-page:last-of-type {
                    break-after: auto;
                    page-break-after: auto;
                }
                .room-print-header {
                    border: 1px solid var(--print-border);
                    border-radius: 14px;
                    padding: 12px 14px;
                    margin-bottom: 10px;
                    background: #ffffff;
                }
                .room-print-top {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    font-size: 9pt;
                    font-weight: 700;
                }
                .room-print-title {
                    margin: 8px 0;
                    text-align: center;
                    color: var(--print-primary);
                    font-size: 14pt;
                    font-weight: 700;
                }
                .room-print-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 10px;
                }
                .room-print-tag {
                    border: 1px solid var(--print-border);
                    border-radius: 999px;
                    padding: 4px 9px;
                    font-size: 8.4pt;
                    font-weight: 700;
                    background: #f8fafc;
                }
                .group-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 14px;
                    background: linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%);
                    border-bottom: 1px solid var(--print-border);
                }
                .group-title h3 {
                    margin: 0;
                    font-size: 12pt;
                    font-weight: 700;
                }
                .group-title p {
                    margin: 4px 0 0 0;
                    font-size: 8.5pt;
                    color: var(--print-muted);
                    font-weight: 700;
                }
                .group-badges {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .info-pill,
                .room-meta {
                    border: 1px solid #bfdbfe;
                    color: var(--print-primary);
                    background: white;
                    border-radius: 999px;
                    padding: 4px 8px;
                    font-size: 8pt;
                    font-weight: 700;
                }
                .rooms-grid {
                    display: block;
                    padding: 12px;
                }
                .room-card {
                    border: 1px solid var(--print-border);
                    border-radius: 12px;
                    overflow: hidden;
                    break-inside: avoid;
                    page-break-inside: avoid;
                    break-after: page;
                    page-break-after: always;
                    margin-bottom: 14px;
                }
                .room-card:last-child {
                    break-after: auto;
                    page-break-after: auto;
                }
                .room-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    background: var(--print-header-bg);
                    border-bottom: 1px solid var(--print-border);
                }
                .room-card-header h4 {
                    margin: 0;
                    font-size: 10.5pt;
                    font-weight: 700;
                }
                .room-card-header p {
                    margin: 4px 0 0 0;
                    font-size: 8pt;
                    color: var(--print-muted);
                    font-weight: 700;
                }
                .room-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 8.3pt;
                    table-layout: fixed;
                }
                .room-table th,
                .room-table td {
                    border: 1pt solid var(--print-border);
                    padding: 6px 7px;
                    text-align: center;
                    vertical-align: middle;
                }
                .room-table th {
                    background: #f1f5f9;
                    color: var(--print-text);
                    font-weight: 700;
                    white-space: nowrap;
                }
                .room-table th:nth-child(2),
                .room-table td:nth-child(2) {
                    width: 24%;
                }
                .room-table th:nth-child(4),
                .room-table td:nth-child(4),
                .room-table th:nth-child(5),
                .room-table td:nth-child(5) {
                    width: 11%;
                }
                .room-table th:nth-child(7),
                .room-table td:nth-child(7) {
                    width: 9%;
                }
                .room-table th:nth-child(8),
                .room-table td:nth-child(8) {
                    width: 22%;
                }
                .room-table td.name-cell {
                    text-align: right;
                    font-weight: 700;
                }
                .model-two-room-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 8.3pt;
                    table-layout: fixed;
                }
                .model-two-room-table th,
                .model-two-room-table td {
                    border: 1pt solid var(--print-border);
                    padding: 4px 5px;
                    text-align: center;
                    vertical-align: middle;
                }
                .model-two-room-table th {
                    background: #f1f5f9;
                    color: var(--print-text);
                    font-weight: 700;
                    white-space: nowrap;
                }
                .model-two-room-table td.name-cell {
                    text-align: right;
                    font-weight: 700;
                }
                .model-two-room-table th.subject-column {
                    height: 128px;
                    padding: 4px 0;
                    vertical-align: top;
                    text-align: center;
                    overflow: visible;
                }
                .model-two-room-table th.subject-column .vertical-subject-label {
                    display: inline-flex;
                    align-items: flex-start;
                    justify-content: center;
                    height: 100%;
                    writing-mode: vertical-rl;
                    transform: rotate(180deg);
                    white-space: nowrap;
                    font-size: 8.5pt;
                    font-weight: 700;
                }
                .model-two-room-table td.model-two-subject-cell {
                    text-align: center;
                    font-weight: 700;
                    font-size: 8pt;
                    color: #000;
                }
                .subject-chip {
                    display: inline-block;
                    margin: 1px;
                    padding: 2px 6px;
                    border-radius: 999px;
                    background: #fff7ed;
                    color: #c2410c;
                    border: 1px solid #fdba74;
                    font-size: 7.3pt;
                    font-weight: 700;
                }
                .print-footer {
                    margin-top: 24px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 24px;
                    font-size: 10pt;
                }
                .signature-box {
                    min-width: 220px;
                    text-align: center;
                    font-weight: 700;
                }
                .print-footer .signature-box:first-child {
                    display: none;
                }
                @page {
                    size: landscape;
                    margin: 1cm;
                }
                @media print {
                    .group-card,
                    .room-card,
                    tr {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    .room-card {
                        break-after: page;
                        page-break-after: always;
                    }
                    .room-card:last-child {
                        break-after: auto;
                        page-break-after: auto;
                    }
                }
            </style>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
        </head>
        <body>
            ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({ advanced: false }) : ''}
            <div class="print-shell">
                <div class="report-header">
                    <div class="report-meta-row">
                        <div>الولاية: ${escapeHtml(settings.wilaya || '.......')}</div>
                        <div>البلدية: ${escapeHtml(settings.municipality || '.......')}</div>
                    </div>
                    <h1 class="report-title">قوائم قاعات الاستدراك</h1>
                    <p class="report-subtitle">توزيع التلاميذ المعنيين بالامتحان الاستدراكي على القاعات والأفواج</p>
                    <div class="report-meta-row" style="margin-top:8px;">
                        <div>السنة الدراسية: ${escapeHtml(settings.schoolYear || yearLabel || '.......')}</div>
                        <div>المؤسسة: ${escapeHtml(settings.institutionName || '.......')}</div>
                        <div>تاريخ الطباعة: ${escapeHtml(today)}</div>
                    </div>
                </div>

                <div class="summary-strip">
                    <div class="summary-box">
                        <strong>${totalStudents}</strong>
                        <span>عدد التلاميذ</span>
                    </div>
                    <div class="summary-box">
                        <strong>${totalRooms}</strong>
                        <span>عدد القاعات / الأفواج</span>
                    </div>
                    <div class="summary-box">
                        <strong>${generatedRoomSections.length}</strong>
                        <span>المجموعات الأساسية</span>
                    </div>
                    <div class="summary-box">
                        <strong>${escapeHtml(groupByLabel)}</strong>
                        <span>طريقة التقسيم</span>
                    </div>
                </div>

                <div class="inline-meta">
                    <div>المستوى: ${escapeHtml(levelLabel)}</div>
                    <div>الشعبة: ${escapeHtml(streamLabel)}</div>
                    <div>عدد التلاميذ في الفوج: ${filters.studentsPerRoom}</div>
                </div>

                ${printSectionsMarkup}

                <div class="print-footer">
                    <div class="signature-box">إمضاء المكلف بالقوائم</div>
                    <div class="signature-box">إمضاء الإدارة</div>
                </div>
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.onload = function () {
        printWindow.focus();
        // printWindow.print(); /* Replaced by PrintToolbarHelper */
    };
}

function showRoomPrintOptions() {
    if (blockTrialPrint()) return;

    Swal.fire({
        title: 'خيارات الطباعة',
        html: `
            <div style="display:grid; gap:10px; margin-top:10px;">
                <button id="printRoomsModelOneBtn" class="swal2-confirm swal2-styled" style="margin:0; background:#16a34a;">
                    طباعة القوائم - نموذج 1
                </button>
                <button id="printRoomsModelTwoBtn" class="swal2-confirm swal2-styled" style="margin:0; background:#0ea5e9;">
                    طباعة القوائم - نموذج 2
                </button>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: 400,
        didOpen: () => {
            const bindPrintOption = (buttonId, printModel) => {
                const button = document.getElementById(buttonId);
                if (!button) return;
                button.addEventListener('click', () => {
                    Swal.close();
                    printRemedialRoomLists(printModel);
                });
            };

            bindPrintOption('printRoomsModelOneBtn', 1);
            bindPrintOption('printRoomsModelTwoBtn', 2);
        }
    });
}

function renderSingleRoomCardModel2(room, stage) {
    const subjectColumns = Array.from(new Set(
        room.students.flatMap(student => (student.remedialSubjects || []).map(subject => subject.name))
    )).sort((a, b) => a.localeCompare(b, 'ar'));

    const fixedColumnsWidth = stage === 'secondary' ? 40 : 34;
    const availableSubjectWidth = Math.max(36, 100 - fixedColumnsWidth);
    const subjectColumnWidth = Math.max(4.2, availableSubjectWidth / Math.max(subjectColumns.length, 1));

    const emptyColspan = subjectColumns.length + (stage === 'secondary' ? 6 : 6);

    let html = `
        <article class="room-card">
            <div class="room-card-header">
                <div>
                    <h4>${escapeHtml(room.roomLabel)}</h4>
                    <p>${escapeHtml(room.subgroupLabel)}</p>
                </div>
                <span class="room-meta">${room.students.length} تلميذ</span>
            </div>
            <div class="room-table-wrap">
                <table class="model-two-room-table">
                    <thead>
                        <tr>
                            <th width="4%">#</th>
                            <th width="18%">الاسم واللقب</th>
                            <th width="6%">الجنس</th>
                            <th width="8%">المستوى</th>`;
    if (stage === 'secondary') {
        html += `<th width="10%">الشعبة</th>`;
    }
    html += `
                            <th width="6%">القسم</th>
                            <th width="8%">المعدل</th>`;
    
    subjectColumns.forEach(subjectName => {
        const verticalHeader = getRemedialSubjectPrintName(subjectName).replace(/\s+/g, ' ').trim();
        html += `<th class="subject-column" style="width:${subjectColumnWidth.toFixed(2)}%"><span class="vertical-subject-label">${verticalHeader}</span></th>`;
    });

    html += `
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (room.students.length === 0) {
        html += `<tr><td colspan="${emptyColspan}">لا توجد بيانات</td></tr>`;
    } else {
        room.students.forEach((student, index) => {
            const concernedSubjects = new Set(
                (student.remedialSubjects || []).map(subject => subject.name)
            );

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td class="name-cell">${escapeHtml(student.name || '')}</td>
                    <td>${escapeHtml(student.gender || '-')}</td>
                    <td>${escapeHtml(student.level || '-')}</td>`;
            if (stage === 'secondary') {
                html += `<td>${escapeHtml(getShortStreamName(student.stream || '-') || '-')}</td>`;
            }
            html += `
                    <td>${escapeHtml(student.class || '-')}</td>
                    <td>${formatRoundedTwoDecimals(student.annualAverage || 0)}</td>`;

            subjectColumns.forEach(subjectName => {
                html += `<td class="model-two-subject-cell">${concernedSubjects.has(subjectName) ? 'معني' : ''}</td>`;
            });

            html += `</tr>`;
        });
    }

    html += `
                    </tbody>
                </table>
            </div>
        </article>
    `;
    return html;
}

