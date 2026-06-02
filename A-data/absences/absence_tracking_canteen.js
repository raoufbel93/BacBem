(function (global) {
    function getDocument(options) {
        return options.document;
    }

    function getState(options) {
        return options.getState();
    }

    function setState(options, partialState) {
        options.setState(partialState);
    }

    function getSafeStudentId(student) {
        if (student.id && student.id !== 'undefined' && student.id !== 'null') {
            return String(student.id);
        }

        return String(student.last_name || '') + '-' + String(student.first_name || '');
    }

    function sortStudentsByLevelStreamClass(a, b) {
        var levelOrder = {
            '1': 1, '1ظ…': 1,
            '2': 2, '2ظ…': 2,
            '3': 3, '3ظ…': 3,
            '4': 4, '4ظ…': 4,
            '1ط«': 5, '2ط«': 6, '3ط«': 7
        };
        var valA = levelOrder[a.level] || 0;
        var valB = levelOrder[b.level] || 0;

        if (valA !== valB) return valA - valB;

        if ((a.stream || '') !== (b.stream || '')) {
            return String(a.stream || '').localeCompare(String(b.stream || ''), 'ar');
        }

        var classA = parseInt(a.class_name || a.class || 0, 10);
        var classB = parseInt(b.class_name || b.class || 0, 10);

        if (classA !== classB) return classA - classB;

        return String(a.last_name || '').localeCompare(String(b.last_name || ''), 'ar');
    }

    function formatClass(student, options) {
        var appSettings = options.getAppSettings ? options.getAppSettings() : null;
        var getShortStreamName = options.getShortStreamName;

        if (student.level) {
            var levelText = String(student.level);

            if (levelText === '1' || levelText === '1ظ…') levelText = 'ط£ظˆظ„ظ‰ ظ…طھظˆط³ط·';
            if (levelText === '2' || levelText === '2ظ…') levelText = 'ط«ط§ظ†ظٹط© ظ…طھظˆط³ط·';
            if (levelText === '3' || levelText === '3ظ…') levelText = 'ط«ط§ظ„ط«ط© ظ…طھظˆط³ط·';
            if (levelText === '1ط«') levelText = '1';
            if (levelText === '2ط«') levelText = '2';
            if (levelText === '3ط«') levelText = '3';
            if (levelText === '4' || levelText === '4ظ…') levelText = 'ط±ط§ط¨ط¹ط© ظ…طھظˆط³ط·';

            var className = student.class_name || student.class || '';

            if (className && !isNaN(className) && String(className).length === 1) {
                className = '0' + className;
            }

            var result = String(levelText) + ' ' + String(className);

            if (appSettings && appSettings.educationStage === 'secondary') {
                var shortStream = typeof getShortStreamName === 'function'
                    ? getShortStreamName(student.stream)
                    : (student.stream || '');
                result = (String(levelText) + ' ' + String(shortStream) + ' ' + String(className)).replace(/\s+/g, ' ').trim();
            }

            return result;
        }

        return ((student.class || '') + ' ' + (student.level || '')).trim() || '-';
    }

    function switchMode(options, mode) {
        var doc = getDocument(options);
        var state = getState(options);
        var btnBen = doc.getElementById('btnCanteenBeneficiaries');
        var btnTrack = doc.getElementById('btnCanteenTracking');
        var beneficiariesView = doc.getElementById('canteenBeneficiariesView');
        var trackingView = doc.getElementById('canteenTrackingView');

        setState(options, { canteenMode: mode });

        if (btnBen) {
            btnBen.classList.toggle('active', mode === 'beneficiaries');
            btnBen.classList.remove(mode === 'beneficiaries' ? 'btn-outline' : 'btn-primary');
            btnBen.classList.add(mode === 'beneficiaries' ? 'btn-primary' : 'btn-outline');
        }

        if (btnTrack) {
            btnTrack.classList.toggle('active', mode === 'tracking');
            btnTrack.classList.remove(mode === 'tracking' ? 'btn-outline' : 'btn-primary');
            btnTrack.classList.add(mode === 'tracking' ? 'btn-primary' : 'btn-outline');
        }

        if (beneficiariesView) beneficiariesView.style.display = mode === 'beneficiaries' ? 'block' : 'none';
        if (trackingView) trackingView.style.display = mode === 'tracking' ? 'block' : 'none';

        if (mode === 'beneficiaries') {
            renderBeneficiaries(options);
        } else {
            renderTracking(options);
        }
    }

    function renderBeneficiaries(options) {
        var doc = getDocument(options);
        var state = getState(options);
        var tbody = doc.getElementById('canteenBeneficiariesBody');
        var searchInput = doc.getElementById('canteenSearchInput');
        var countEl = doc.getElementById('totalBeneficiariesCount');
        var filtered;

        if (!tbody) return;

        filtered = (options.getAllStudents() || []).filter(function (student) {
            var status = String(student.status || '').toLowerCase();
            var fullName = (String(student.last_name || '') + ' ' + String(student.first_name || '')).toLowerCase();
            var isHalfBoard = status === 'half_board' || status.indexOf('ظ†طµظپ') !== -1 || status.indexOf('demi') !== -1;
            var searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';

            return isHalfBoard && fullName.indexOf(searchVal) !== -1;
        });

        filtered.sort(function (a, b) {
            var idA = getSafeStudentId(a);
            var idB = getSafeStudentId(b);
            var isBenA = state.canteenBeneficiaries.some(function (id) { return String(id) === idA; });
            var isBenB = state.canteenBeneficiaries.some(function (id) { return String(id) === idB; });

            if (isBenA && !isBenB) return -1;
            if (!isBenA && isBenB) return 1;

            return sortStudentsByLevelStreamClass(a, b);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state"><div class="icon">â„¹ï¸ڈ</div><p>ظ„ط§ ظٹظˆط¬ط¯ طھظ„ط§ظ…ظٹط° ط¨طµظپط© "ظ†طµظپ ط¯ط§ط®ظ„ظٹ"</p></td></tr>';
            if (countEl) countEl.textContent = String(state.canteenBeneficiaries.length);
            return;
        }

        tbody.innerHTML = filtered.map(function (student, index) {
            var studentId = getSafeStudentId(student);
            var isChecked = state.canteenBeneficiaries.some(function (id) { return String(id) === studentId; });

            return '\n            <tr class="' + (isChecked ? 'selected' : '') + '">\n                <td>' + (index + 1) + '</td>\n                <td style="font-weight:bold;">' + String(student.last_name || '') + ' ' + String(student.first_name || '') + '</td>\n                <td>' + formatClass(student, options) + '</td>\n                <td>\n                    <input type="checkbox" class="absence-checkbox"\n                        ' + (isChecked ? 'checked' : '') + '\n                        onchange="toggleCanteenBeneficiary(\'' + studentId + '\', this)">\n                </td>\n            </tr>\n        ';
        }).join('');

        if (countEl) countEl.textContent = String(state.canteenBeneficiaries.length);
    }

    function renderTracking(options) {
        var doc = getDocument(options);
        var state = getState(options);
        var tbody = doc.getElementById('canteenTrackingBody');
        var countEl = doc.getElementById('canteenAbsentCount');
        var currentDateEl = doc.getElementById('absenceDate');
        var searchTextEl = doc.getElementById('canteenTrackingSearch');
        var levelFilterEl = doc.getElementById('canteenTrackingLevelFilter');
        var beneficiaries;
        var currentDate;
        var currentAbsences;

        if (!tbody || !currentDateEl) return;

        beneficiaries = (options.getAllStudents() || []).filter(function (student) {
            var studentId = getSafeStudentId(student);
            return state.canteenBeneficiaries.some(function (id) { return String(id) === studentId; });
        });

        var searchText = searchTextEl ? String(searchTextEl.value || '').trim().toLowerCase() : '';
        var levelFilter = levelFilterEl ? String(levelFilterEl.value || '') : '';

        if (searchText || levelFilter) {
            beneficiaries = beneficiaries.filter(function (student) {
                if (levelFilter) {
                    var levelValue = String(student.level || '');
                    var mappedLevel = levelValue;

                    if (levelValue === '1' || levelValue === '1ظ…') mappedLevel = 'ط£ظˆظ„ظ‰ ظ…طھظˆط³ط·';
                    if (levelValue === '2' || levelValue === '2ظ…') mappedLevel = 'ط«ط§ظ†ظٹط© ظ…طھظˆط³ط·';
                    if (levelValue === '3' || levelValue === '3ظ…') mappedLevel = 'ط«ط§ظ„ط«ط© ظ…طھظˆط³ط·';
                    if (levelValue === '4' || levelValue === '4ظ…') mappedLevel = 'ط±ط§ط¨ط¹ط© ظ…طھظˆط³ط·';

                    if (mappedLevel !== levelFilter) {
                        return false;
                    }
                }

                if (searchText) {
                    var fullName = (String(student.first_name || '') + ' ' + String(student.last_name || '')).toLowerCase();
                    var reverseName = (String(student.last_name || '') + ' ' + String(student.first_name || '')).toLowerCase();

                    if (fullName.indexOf(searchText) === -1 && reverseName.indexOf(searchText) === -1) {
                        return false;
                    }
                }

                return true;
            });
        }

        beneficiaries.sort(sortStudentsByLevelStreamClass);
        currentDate = currentDateEl.value;
        currentAbsences = state.canteenAbsences[currentDate] || [];

        if (beneficiaries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state"><div class="icon">ًںچ´</div><p>ظ„ظ… ظٹطھظ… طھط­ط¯ظٹط¯ ط£ظٹ ظ…ط³طھظپظٹط¯ظٹظ† ظ…ظ† ط§ظ„ظ…ط·ط¹ظ… ط¨ط¹ط¯.<br>ط§ظ†طھظ‚ظ„ ط¥ظ„ظ‰ "طھط­ط¯ظٹط¯ ط§ظ„ظ…ط³طھظپظٹط¯ظٹظ†" ظ„ط¥ط¶ط§ظپط© طھظ„ط§ظ…ظٹط°.</p></td></tr>';
            if (countEl) countEl.textContent = '0';
            return;
        }

        tbody.innerHTML = beneficiaries.map(function (student, index) {
            var studentId = getSafeStudentId(student);
            var isAbsent = currentAbsences.some(function (id) { return String(id) === studentId; });

            return '\n            <tr class="' + (isAbsent ? 'selected' : '') + '">\n                <td>' + (index + 1) + '</td>\n                <td style="font-weight:bold;">' + String(student.last_name || '') + ' ' + String(student.first_name || '') + '</td>\n                <td>' + formatClass(student, options) + '</td>\n                <td>\n                    <input type="checkbox" class="absence-checkbox"\n                        ' + (isAbsent ? 'checked' : '') + '\n                        onchange="toggleCanteenAbsence(\'' + studentId + '\', this)">\n                </td>\n            </tr>\n        ';
        }).join('');

        if (countEl) countEl.textContent = String(currentAbsences.length);
    }

    function toggleBeneficiary(options, studentId, checkbox) {
        var DB = options.DB;
        var state = getState(options);
        var nextBeneficiaries = state.canteenBeneficiaries.slice();

        if (checkbox.checked) {
            if (!nextBeneficiaries.some(function (id) { return String(id) === String(studentId); })) {
                nextBeneficiaries.push(studentId);
            }
        } else {
            nextBeneficiaries = nextBeneficiaries.filter(function (id) {
                return String(id) !== String(studentId);
            });
        }

        setState(options, { canteenBeneficiaries: nextBeneficiaries });

        return Promise.resolve(DB.set('canteenBeneficiaries', nextBeneficiaries)).then(function () {
            renderBeneficiaries(options);
        });
    }

    function toggleAbsence(options, studentId, checkbox) {
        var DB = options.DB;
        var doc = getDocument(options);
        var state = getState(options);
        var dateEl = doc.getElementById('absenceDate');
        var currentDate = dateEl ? dateEl.value : '';
        var nextAbsences = {};
        var dateAbsences;
        var key;

        for (key in state.canteenAbsences) {
            if (Object.prototype.hasOwnProperty.call(state.canteenAbsences, key)) {
                nextAbsences[key] = state.canteenAbsences[key].slice ? state.canteenAbsences[key].slice() : state.canteenAbsences[key];
            }
        }

        if (!nextAbsences[currentDate]) {
            nextAbsences[currentDate] = [];
        }

        dateAbsences = nextAbsences[currentDate];

        if (checkbox.checked) {
            if (!dateAbsences.some(function (id) { return String(id) === String(studentId); })) {
                dateAbsences.push(studentId);
            }
        } else {
            nextAbsences[currentDate] = dateAbsences.filter(function (id) {
                return String(id) !== String(studentId);
            });
        }

        if (nextAbsences[currentDate] && nextAbsences[currentDate].length === 0) {
            delete nextAbsences[currentDate];
        }

        setState(options, { canteenAbsences: nextAbsences });

        return Promise.resolve(DB.set('canteenAbsences', nextAbsences)).then(function () {
            renderTracking(options);
        });
    }

    function saveDailyInfo(options) {
        var DB = options.DB;
        var doc = getDocument(options);
        var state = getState(options);
        var dateEl = doc.getElementById('absenceDate');
        var proposedMeal = doc.getElementById('canteenProposedMeal');
        var offeredMeal = doc.getElementById('canteenOfferedMeal');
        var notesEl = doc.getElementById('canteenNotes');
        var date = dateEl ? dateEl.value : '';
        var nextDailyInfo = {};
        var key;

        if (!date) return Promise.resolve();

        for (key in state.canteenDailyInfo) {
            if (Object.prototype.hasOwnProperty.call(state.canteenDailyInfo, key)) {
                nextDailyInfo[key] = state.canteenDailyInfo[key];
            }
        }

        nextDailyInfo[date] = {
            proposed: proposedMeal ? proposedMeal.value : '',
            offered: offeredMeal ? offeredMeal.value : '',
            notes: notesEl ? notesEl.value : ''
        };

        setState(options, { canteenDailyInfo: nextDailyInfo });
        return DB.set('canteenDailyInfo', nextDailyInfo);
    }

    function loadDailyInfo(options) {
        var DB = options.DB;
        var doc = getDocument(options);
        var dateEl = doc.getElementById('absenceDate');
        var proposedMeal = doc.getElementById('canteenProposedMeal');
        var offeredMeal = doc.getElementById('canteenOfferedMeal');
        var notesEl = doc.getElementById('canteenNotes');
        var date = dateEl ? dateEl.value : '';

        return Promise.resolve(DB.get('canteenDailyInfo')).then(function (dailyInfo) {
            var info = (dailyInfo || {})[date] || {};

            setState(options, { canteenDailyInfo: dailyInfo || {} });

            if (proposedMeal) proposedMeal.value = info.proposed || '';
            if (offeredMeal) offeredMeal.value = info.offered || '';
            if (notesEl) notesEl.value = info.notes || '';
        });
    }

    global.AbsenceTrackingCanteen = {
        getSafeStudentId: getSafeStudentId,
        formatClass: formatClass,
        switchMode: switchMode,
        renderBeneficiaries: renderBeneficiaries,
        filterBeneficiaries: renderBeneficiaries,
        toggleBeneficiary: toggleBeneficiary,
        renderTracking: renderTracking,
        toggleAbsence: toggleAbsence,
        saveDailyInfo: saveDailyInfo,
        loadDailyInfo: loadDailyInfo
    };
})(window);
