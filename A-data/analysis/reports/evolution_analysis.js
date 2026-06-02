
// --- Year Logic ---
function getStudentYear(s) {
    if (!s) return '';
    const y = s.academic_year || s.schoolYear || s.year || s.school_year || '';
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
let currentAnalyzedData = []; // To store processed data for sorting/filtering
let activeFilter = 'all';
let institutionSettings = {}; // Define global

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
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .replace(/\s+/g, ' ');
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();

    // Listeners
    const yearSelect = document.getElementById('yearSelect');
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            populateFilters();
            applyAnalysis();
        });
    }

    const levelSelect = document.getElementById('levelSelect');
    if (levelSelect) {
        levelSelect.addEventListener('change', () => {
            populateStreamDropdown();
            populateClassDropdown();
        });
    }

    const streamSelect = document.getElementById('streamSelect');
    if (streamSelect) {
        streamSelect.addEventListener('change', () => {
            populateClassDropdown();
        });
    }

    const filterAllBtn = document.getElementById('filterAll');
    if (filterAllBtn) {
        filterAllBtn.addEventListener('click', () => filterTable('all'));
    }
});


async function loadData() {
    institutionSettings = await DB.getSettings() || {};
    let rawStudentsData = await DB.getResults(true) || [];

    const studentMap = new Map();
    console.time('DataProcessing');
    for (const student of rawStudentsData) {
        const cleanStr = (s) => normalizeArabic(s || '').replace(/\s+/g, '');
        const normSection = (s) => (s || '').toString().trim().replace(/^0+/, '') || "1";
        
        const normName = cleanStr(student.name);
        const normDob = cleanStr(student.dob);
        const normClass = normSection(student.class);
        const normLevel = cleanStr(student.level);
        const normStream = cleanStr(student.stream);

        const stYear = getStudentYear(student);
        const uniqueKey = `${stYear}|${normName}|${normDob}|${normClass}|${normLevel}|${normStream}`;

        const getTrimesterValue = (name) => {
            const n = normalizeArabic(name || '');
            if (n.includes('ثاني') || n.includes('2')) return '2';
            if (n.includes('ثالث') || n.includes('3')) return '3';
            return '1'; // Default
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

        // Merge Marks
        if (student.marks) {
            Object.entries(student.marks).forEach(([sub, score]) => {
                const hasSuffix = ['1', '2', '3'].some(t => sub.includes(`ف${t}`) || sub.includes(`فصل ${t}`));
                const finalKey = hasSuffix ? sub : `${sub}${suffix}`;
                targetStudent.marks[finalKey] = score;
            });
        }

        // Merge Averages
        if (student.averages) {
            Object.entries(student.averages).forEach(([t, avg]) => {
                if (avg !== undefined && avg !== null) {
                    targetStudent.averages[t] = parseFloat(avg) || 0;
                }
            });
        }
        
        if (student.average !== undefined) {
            targetStudent.averages[tVal] = parseFloat(student.average) || 0;
        }
    }
    studentsData = Array.from(studentMap.values());
    console.timeEnd('DataProcessing');

    populateFilters();
}





function populateFilters() {
    const yearSelect = document.getElementById('yearSelect');
    const levelSelect = document.getElementById('levelSelect');
    
    // 1. Collect all years present in the data
    const years = new Set();
    studentsData.forEach(s => {
        const y = getStudentYear(s);
        if (y) years.add(y);
    });
    const sortedYears = [...years].sort((a,b) => b.localeCompare(a));
    
    // 2. Populate Year dropdown only if it's currently empty (first load)
    if (yearSelect && yearSelect.options.length === 0) {
        let yHtml = '';
        sortedYears.forEach(y => yHtml += `<option value="${y}">${y}</option>`);
        yearSelect.innerHTML = yHtml;
        if (sortedYears.length > 0) yearSelect.value = sortedYears[0];
    }
    
    const selectedYear = yearSelect ? yearSelect.value : '';

    // 3. Collect unique levels for the selected year
    const levels = new Set();
    studentsData.forEach(s => {
        if (!selectedYear || getStudentYear(s) === selectedYear) {
            if (s.level) levels.add(s.level.trim());
        }
    });

    const sortedLevels = [...levels].sort((a,b) => a.localeCompare(b, 'ar'));
    
    // 4. Update Level Dropdown
    if (levelSelect) {
        let lHtml = '<option value="all">كل المستويات</option>';
        sortedLevels.forEach(l => {
            lHtml += `<option value="${l}">${l}</option>`;
        });
        levelSelect.innerHTML = lHtml;
    }

    // 5. Cascade updates to stream and class dropdowns
    populateStreamDropdown();
    populateClassDropdown();
}

function populateStreamDropdown() {
    const levelSelectElement = document.getElementById('levelSelect');
    if (!levelSelectElement) return;
    const levelSelect = levelSelectElement.value;
    const streamSelect = document.getElementById('streamSelect');
    const streamGroup = document.getElementById('streamFilterGroup');
    const stage = institutionSettings.educationStage || 'middle';

    if (stage === 'secondary') {
        streamGroup.style.display = 'flex';

        let filtered = studentsData;
        const yrVal = document.getElementById('yearSelect')?.value;
        if (yrVal) filtered = filtered.filter(s => getStudentYear(s) === yrVal);


        if (levelSelect !== 'all') {


            filtered = filtered.filter(s => {


                // Reuse matchLevel locally or just strict match if we stored normalized levels


                // But let's use the same flexible matching just in case


                if (levelSelect === '1') return s.level.includes('1') || s.level.includes('أولى');


                if (levelSelect === '2') return s.level.includes('2') || s.level.includes('ثانية');


                if (levelSelect === '3') return s.level.includes('3') || s.level.includes('ثالثة');


                return s.level === levelSelect;


            });


        }





        const streams = [...new Set(filtered.map(s => s.stream).filter(s => s))].sort();





        let html = '<option value="all">جميع الشعب</option>';


        streams.forEach(stream => {


            html += `<option value="${stream}">${getStreamLabel(stream)}</option>`;


        });


        streamSelect.innerHTML = html;


    } else {


        streamGroup.style.display = 'none';


        streamSelect.innerHTML = '<option value="all">جميع الشعب</option>';


    }


}





// Add matchLevel/getStreamLabel helpers if needed or expect them from elsewhere?


// Since this is a standalone JS, better include them.


function getStreamLabel(streamCode) {


    if (!streamCode) return '-';


    const code = streamCode.toLowerCase().trim();


    const map = {


        'science': 'علوم تجريبية',


        'math': 'رياضيات',


        'math_tech': 'تقني رياضي',


        'tech_math': 'تقني رياضي',


        'languages': 'لغات أجنبية',


        'literature': 'آداب وفلسفة',


        'arts': 'آداب وفلسفة',


        'management': 'تسيير واقتصاد',


        'sport': 'رياضة',


        'common_science': 'جذع مشترك علوم وتكنولوجيا',


        'common_arts': 'جذع مشترك آداب'


    };


    return map[code] || streamCode;


}





function populateClassDropdown() {


    const selectedLevel = document.getElementById('levelSelect').value;


    const selectedStream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : 'all';


    const classSelect = document.getElementById('classSelect');


    classSelect.innerHTML = '<option value="all">الكل</option>';





    if (selectedLevel === 'all') {


        classSelect.disabled = true;


        return;


    }





    classSelect.disabled = false;





    const yrVal2 = document.getElementById('yearSelect')?.value;
    let filtered = studentsData.filter(s => {
        if (yrVal2 && getStudentYear(s) !== yrVal2) return false;


        // Simple level match logic


        let matchLvl = (s.level === selectedLevel);


        if (selectedLevel === '1') matchLvl = s.level.includes('1') || s.level.includes('أولى');


        if (selectedLevel === '2') matchLvl = s.level.includes('2') || s.level.includes('ثانية');


        if (selectedLevel === '3') matchLvl = s.level.includes('3') || s.level.includes('ثالثة');


        if (selectedLevel === '4') matchLvl = s.level.includes('4') || s.level.includes('رابعة');


        return matchLvl;


    });





    if (institutionSettings.educationStage === 'secondary' && selectedStream && selectedStream !== 'all') {


        filtered = filtered.filter(s => s.stream === selectedStream);


    }





    const classes = [...new Set(filtered.map(s => s.class).filter(c => c))].sort();





    classes.forEach(c => {


        const opt = document.createElement('option');


        opt.value = c;


        opt.textContent = c;


        classSelect.appendChild(opt);


    });


}





// Helper: Get Average safely


function getTrimesterAverage(student, trimesterVal) {


    // Check 'averages' object first (standard structure)


    if (student.averages && student.averages[trimesterVal] != null) {


        return parseFloat(student.averages[trimesterVal]);


    }


    // Check if student object ITSELF represents this trimester (flat structure import)


    const trimesterMap = { '1': 'الأول', '2': 'الثاني', '3': 'الثالث' };


    if (student.trimester === trimesterMap[trimesterVal] && student.average != null) {


        return parseFloat(student.average);


    }


    return null; // Data missing


}





function applyAnalysis() {


    const level = document.getElementById('levelSelect').value;


    const cls = document.getElementById('classSelect').value;


    const period = document.getElementById('compareSelect').value;


    const thImprove = parseFloat(document.getElementById('thImprove').value);


    const thDeteriorate = parseFloat(document.getElementById('thDeteriorate').value);





    // 1. Filter Scope


    const stream = document.getElementById('streamSelect') ? document.getElementById('streamSelect').value : 'all';


    let scopeData = studentsData;
    const selectedYear = document.getElementById('yearSelect')?.value;
    if (selectedYear) {
        scopeData = scopeData.filter(s => getStudentYear(s) === selectedYear);
    }





    // Level Filter


    if (level !== 'all') {


        scopeData = scopeData.filter(s => {


            if (level === '1') return s.level.includes('1') || s.level.includes('أولى');


            if (level === '2') return s.level.includes('2') || s.level.includes('ثانية');


            if (level === '3') return s.level.includes('3') || s.level.includes('ثالثة');


            return s.level === level;


        });


    }





    // Stream Filter


    if (institutionSettings.educationStage === 'secondary' && stream && stream !== 'all') {


        scopeData = scopeData.filter(s => s.stream === stream);


    }





    if (cls !== 'all') scopeData = scopeData.filter(s => s.class === cls);





    // 2. Process Data


    currentAnalyzedData = [];





    scopeData.forEach(s => {


        let prevAvg = null;


        let currAvg = null;





        if (period === '1-2') {


            prevAvg = getTrimesterAverage(s, '1');


            currAvg = getTrimesterAverage(s, '2');


        } else if (period === '2-3') {


            prevAvg = getTrimesterAverage(s, '2');


            currAvg = getTrimesterAverage(s, '3');


        }





        // Only include if BOTH averages exist


        if (prevAvg !== null && currAvg !== null) {


            const diff = currAvg - prevAvg;


            let status = 'stable';





            if (diff >= thImprove) {


                status = 'improved';


            } else if (diff <= thDeteriorate) {


                status = 'deteriorated';


            } else {


                status = 'stable';


            }





            currentAnalyzedData.push({


                name: s.name,


                class: s.class,
                level: s.level,
                prevAvg: prevAvg,
                currAvg: currAvg,
                diff: diff,
                status: status,
                stream: s.stream // Keep stream logic
            });


        }


    });





    renderStats();


    activeFilter = 'all'; // Reset filter


    updateFilterUI('all');


    renderTable();


}





function renderStats() {


    const improved = currentAnalyzedData.filter(s => s.status === 'improved');


    const deteriorated = currentAnalyzedData.filter(s => s.status === 'deteriorated');


    const stable = currentAnalyzedData.filter(s => s.status === 'stable');


    const total = currentAnalyzedData.length;





    document.getElementById('statImproved').textContent = improved.length;


    document.getElementById('statDeteriorated').textContent = deteriorated.length;


    document.getElementById('statStable').textContent = stable.length;





    const pImproved = total > 0 ? ((improved.length / total) * 100).toFixed(1) : 0;


    const pDeteriorated = total > 0 ? ((deteriorated.length / total) * 100).toFixed(1) : 0;


    const pStable = total > 0 ? ((stable.length / total) * 100).toFixed(1) : 0;





    document.getElementById('percImproved').textContent = pImproved + '%';


    document.getElementById('percDeteriorated').textContent = pDeteriorated + '%';


    document.getElementById('percStable').textContent = pStable + '%';


}





function renderTable(filterStatus = activeFilter) {


    const tbody = document.getElementById('evolutionTableBody');


    tbody.innerHTML = '';





    let displayData = currentAnalyzedData;


    if (filterStatus !== 'all') {


        displayData = displayData.filter(s => s.status === filterStatus);


    }





    if (displayData.length === 0) {


        tbody.innerHTML = '<tr><td colspan="6">لا توجد بيانات بالمقاييس الحالية</td></tr>';


        return;


    }





    const isSecondary = (institutionSettings.educationStage === 'secondary');
    const streamHeader = document.getElementById('streamHeader');
    if (streamHeader) streamHeader.style.display = isSecondary ? '' : 'none';

    displayData.forEach(item => {


        const tr = document.createElement('tr');





        let statusLabel = '';


        let rowClass = '';


        let diffClass = '';


        let icon = '';





        if (item.status === 'improved') {


            statusLabel = 'تحسن';


            rowClass = 'row-improved';


            diffClass = 'diff-pos';


            icon = '⬆️';


        } else if (item.status === 'deteriorated') {


            statusLabel = 'تدهور';


            rowClass = 'row-deteriorated';


            diffClass = 'diff-neg';


            icon = '⬇️';


        } else {


            statusLabel = 'مستقر';


            diffClass = 'diff-zero';


            icon = '➖';


        }





        tr.className = rowClass;


        tr.style.cursor = 'pointer';


        tr.onclick = () => openStudentModal(item);





        const streamCell = isSecondary ? `<td>${getStreamLabel(item.stream)}</td>` : '<td style="display:none;"></td>';

        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${(item.level || '').replace(' متوسط', '')}</td>
            ${streamCell}
            <td>${item.class}</td>
            <td>${item.prevAvg.toFixed(2)}</td>
            <td>${item.currAvg.toFixed(2)}</td>
            <td><span class="diff-tag ${diffClass}">${item.diff > 0 ? '+' : ''}${item.diff.toFixed(2)}</span></td>
            <td>${statusLabel} ${icon}</td>
        `;


        tbody.appendChild(tr);


    });


}





function filterTable(status) {


    activeFilter = status;


    renderTable(status);


    updateFilterUI(status);


}





function updateFilterUI(status) {


    // Reset all cards opacity/border


    document.querySelectorAll('.stat-card').forEach(c => {


        c.style.opacity = '0.5';


        c.style.borderWidth = '4px'; // Maintain border width


    });





    // Highlight active


    if (status === 'all') {


        document.querySelectorAll('.stat-card').forEach(c => c.style.opacity = '1');


        const btn = document.getElementById('filterAll');


        if (btn) btn.classList.add('active');


    } else {


        const cardMap = {


            'improved': document.querySelector('.stat-card.improved'),


            'deteriorated': document.querySelector('.stat-card.deteriorated'),


            'stable': document.querySelector('.stat-card.stable')


        };





        if (cardMap[status]) {


            cardMap[status].style.opacity = '1';


        }





        // Update "All" button state


        const btn = document.getElementById('filterAll');


        if (btn) btn.classList.remove('active');


    }


}





// Sorting logic


let currentSort = { col: -1, asc: true };


function sortTable(colIndex) {


    // 0: Name, 1: Class, 2: Prev, 3: Curr, 4: Diff


    if (currentSort.col === colIndex) currentSort.asc = !currentSort.asc;


    else { currentSort.col = colIndex; currentSort.asc = true; }





    currentAnalyzedData.sort((a, b) => {


        let valA, valB;


        switch (colIndex) {


            case 0: valA = a.name; valB = b.name; break; 
            case 1: valA = a.level; valB = b.level; break; 
            case 2: valA = a.stream; valB = b.stream; break; 
            case 3: valA = a.class; valB = b.class; break; 
            case 4: valA = a.prevAvg; valB = b.prevAvg; break; 
            case 5: valA = a.currAvg; valB = b.currAvg; break; 
            case 6: valA = a.diff; valB = b.diff; break; 
            default: return 0;


        }





        if (typeof valA === 'string') {


            return currentSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);


        } else {


            return currentSort.asc ? valA - valB : valB - valA;


        }


    });





    renderTable();


}





// Student Detail Modal Logic


let evolutionChart = null;


function openStudentModal(analyzedItem) {


    const modal = document.getElementById('studentModal');


    const nameEl = document.getElementById('modalStudentName');





    nameEl.textContent = `${analyzedItem.name} (${analyzedItem.class})`;


    modal.style.display = 'block';





    const fullStudent = studentsData.find(s => s.name === analyzedItem.name && s.class === analyzedItem.class);


    if (fullStudent) {


        renderChart(fullStudent);


        renderAdditionalStats(analyzedItem);


    }


}





function closeModal() {


    document.getElementById('studentModal').style.display = 'none';


}





window.onclick = function (event) {


    const modal = document.getElementById('studentModal');


    if (event.target == modal) {


        modal.style.display = 'none';


    }


}





function renderAdditionalStats(item) {


    const container = document.getElementById('modalStats');





    let trendColor = '#95a5a6';


    let trendText = 'مستقر';





    if (item.status === 'improved') {


        trendColor = '#27ae60';


        trendText = 'تحسن ممتاز';


    } else if (item.status === 'deteriorated') {


        trendColor = '#e74c3c';


        trendText = 'تدهور في المستوى';


    }





    container.innerHTML = `


        <div style="text-align: center;">


            <div style="font-size: 0.9rem; color: #7f8c8d;">الفارق</div>


            <div style="font-size: 1.5rem; font-weight: bold; color: ${trendColor};" dir="ltr">


                ${item.diff > 0 ? '+' : ''}${item.diff.toFixed(2)}


            </div>


        </div>


         <div style="text-align: center;">


            <div style="font-size: 0.9rem; color: #7f8c8d;">التقييم</div>


            <div style="font-size: 1.2rem; font-weight: bold; color: ${trendColor};">


                ${trendText}


            </div>


        </div>
    `;
}

function renderChart(student) {
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    if (evolutionChart) {
        evolutionChart.destroy();
    }
    const avg1 = getTrimesterAverage(student, '1');
    const avg2 = getTrimesterAverage(student, '2');
    const avg3 = getTrimesterAverage(student, '3');
    const dataPoints = [avg1, avg2, avg3];
    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['الفصل الأول', 'الفصل الثاني', 'الفصل الثالث'],
            datasets: [{
                label: 'معدل التلميذ',
                data: dataPoints,
                borderColor: 'var(--secondary-color)',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#2980b9',
                pointRadius: 6,
                pointHoverRadius: 8,
                fill: true,
                tension: 0.3,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 20,
                    grid: { color: '#f0f0f0' }
                },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(44, 62, 80, 0.9)',
                    titleFont: { family: 'Tajawal' },
                    bodyFont: { family: 'Tajawal', size: 14 },
                    padding: 10,
                    callbacks: {
                        label: function (context) {
                            return `المعدل: ${context.parsed.y}`;
                        }
                    }
                }
            }
        }
    });
}

// Expose functions to global scope
window.filterTable = filterTable;
window.applyAnalysis = applyAnalysis;
window.openStudentModal = openStudentModal;
window.closeModal = closeModal;
window.sortTable = sortTable;

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

window.printReport = showPrintOptions;

async function showPrintOptions() {
    if (blockTrialPrint()) return;
    if (currentAnalyzedData.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'الرجاء إجراء التحليل أولاً'
        });
        return;
    }

    // Collect settings AND UI data BEFORE showing Swal (to avoid losing user gesture bit in some environments)
    const settings = await DB.getSettings() || {};
    const period = document.getElementById('compareSelect').options[document.getElementById('compareSelect').selectedIndex].text;
    const level = document.getElementById('levelSelect').options[document.getElementById('levelSelect').selectedIndex].text;
    const cls = document.getElementById('classSelect').options[document.getElementById('classSelect').selectedIndex].text;

    const { value: target } = await Swal.fire({
        title: 'خيارات الطباعة',
        icon: 'info',
        html: `
            <div class="print-options-container" style="text-align: right; font-family: 'Tajawal', sans-serif;">
                <p>اختر الفئة التي ترغب في تضمينها في التقرير:</p>
                <div style="margin-top: 15px;">
                    <label style="display: block; margin-bottom: 10px; cursor: pointer;">
                        <input type="radio" name="printTarget" value="all" checked style="margin-left: 10px;"> جميع التلاميذ في النتائج الحالية
                    </label>
                    <label style="display: block; margin-bottom: 10px; cursor: pointer; color: #27ae60; font-weight: bold;">
                        <input type="radio" name="printTarget" value="improved" style="margin-left: 10px;"> التلاميذ المتحسنون فقط ⬆️
                    </label>
                    <label style="display: block; margin-bottom: 10px; cursor: pointer; color: #e74c3c; font-weight: bold;">
                        <input type="radio" name="printTarget" value="deteriorated" style="margin-left: 10px;"> التلاميذ المتدهورون فقط ⬇️
                    </label>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'تأكيد الطباعة',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: 'var(--secondary-color)',
        preConfirm: () => {
            return document.querySelector('input[name="printTarget"]:checked').value;
        }
    });

    if (target) {
        // We use a slight delay but call the generator function directly
        executePrintReport(target, settings, period, level, cls);
    }
}

async function executePrintReport(targetStatus, settings, period, level, cls) {
    if (blockTrialPrint()) return;
    try {
        let dataToPrint = currentAnalyzedData;
        let subtitle = "تقرير شامل لتطور مستوى التلاميذ";

        if (targetStatus === 'improved') {
            dataToPrint = currentAnalyzedData.filter(s => s.status === 'improved');
            subtitle = "قائمة التلاميذ الذين حققوا تحسناً في نتائجهم";
        } else if (targetStatus === 'deteriorated') {
            dataToPrint = currentAnalyzedData.filter(s => s.status === 'deteriorated');
            subtitle = "قائمة التلاميذ الذين سجلوا تراجعاً في نتائجهم";
        }

        // Stats from UI
        const improved = document.getElementById('statImproved').textContent;
        const deteriorated = document.getElementById('statDeteriorated').textContent;
        const stable = document.getElementById('statStable').textContent;
        const percImproved = document.getElementById('percImproved').textContent;
        const percDeteriorated = document.getElementById('percDeteriorated').textContent;
        const percStable = document.getElementById('percStable').textContent;

        let tableRows = '';
        dataToPrint.forEach(item => {
            let statusLabel = item.status === 'improved' ? 'تحسن ⬆️' : item.status === 'deteriorated' ? 'تدهور ⬇️' : 'مستقر ➖';
            let rowBg = item.status === 'improved' ? '#e8f8f5' : item.status === 'deteriorated' ? '#fdedec' : '';
            const isSecondaryPrint = settings.educationStage === 'secondary';
            const streamCellPrint = isSecondaryPrint ? `<td>${getStreamLabel(item.stream)}</td>` : '';
            tableRows += `
                <tr style="background: ${rowBg};">
                    <td>${item.name}</td>
                    <td>${item.level}</td>
                    ${streamCellPrint}
                    <td>${item.class}</td>
                    <td>${item.prevAvg.toFixed(2)}</td>
                    <td>${item.currAvg.toFixed(2)}</td>
                    <td style="font-weight: bold; color: ${item.diff >= 0 ? 'green' : 'red'};">${item.diff > 0 ? '+' : ''}${item.diff.toFixed(2)}</td>
                    <td>${statusLabel}</td>
                </tr>
            `;
        });

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            Swal.fire({
                icon: 'error',
                title: 'خطأ في الطباعة',
                text: 'فشل فتح نافذة الطباعة. يرجى التأكد من السماح بالنوافذ المنبثقة (Popups) في متصفحك.'
            });
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>تقرير تطور مستوى التلاميذ</title>
                <style>
                    @page { margin: 0.8cm; size: A4; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 0; font-size: 10pt; }
                    .report-header { display: flex; flex-direction: column; align-items: center; margin-bottom: 10px; }
                    .report-header h3 { margin: 1px 0; font-size: 10pt; font-weight: bold; }
                    .info-row { width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; font-size: 9.5pt; }
                    .title-box { text-align: center; margin-top: 10px; width: 100%; }
                    .title-box h2 { margin: 5px 0; border: 2pt solid #000; padding: 5px 20px; display: inline-block; border-radius: 6px; font-size: 13pt; background: #fdfdfd; }
                    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; }
                    .stat-box { border: 1pt solid #000; padding: 10px; text-align: center; background: #f9f9f9; }
                    .stat-box.improved { border-color: #27ae60; }
                    .stat-box.deteriorated { border-color: #e74c3c; }
                    .stat-box.stable { border-color: #95a5a6; }
                    .stat-box .label { font-size: 9pt; color: #555; margin-bottom: 5px; }
                    .stat-box .value { font-size: 16pt; font-weight: bold; }
                    .stat-box .perc { font-size: 10pt; color: #777; }
                    .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9pt; }
                    .data-table th, .data-table td { border: 1pt solid #000 !important; padding: 5px; text-align: center; }
                    .data-table th { background-color: #f2f2f2 !important; color: black !important; font-weight: bold; }
                    .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 10pt; }
                    .signature-box { text-align: center; min-width: 200px; }
                    h3.section-title { margin-bottom: 5px; border-right: 5px solid #333; padding-right: 10px; font-size: 11pt; margin-top: 20px; }
                    @media print { .no-print { display: none; } }
                </style>
                ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getHeadContent() : ''}
            </head>
            <body>
                ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getToolbarHtml({advanced: false}) : ''}
                <div class="report-header">
                    <h3>الجمهورية الجزائرية الديمقراطية الشعبية</h3>
                    <h3>وزارة التربية الوطنية</h3>
                </div>
                <div class="info-row">
                    <div style="text-align: right;">
                        <div>مديرية التربية لولاية: ${settings.wilaya || '.......'}</div>
                        <div>المؤسسة: ${settings.institutionName || '.......'}</div>
                    </div>
                    <div style="text-align: left;">
                        <div>البلدية: ${settings.municipality || '.......'}</div>
                        <div>السنة الدراسية: ${settings.schoolYear || '2025/2026'}</div>
                    </div>
                </div>
                <div class="title-box">
                    <h2>تقرير تطور مستوى التلاميذ</h2>
                    <div style="font-size: 11pt; color: #555; margin-bottom: 5px; font-weight: bold;">${subtitle}</div>
                    <div style="margin-top: 5px; font-weight: bold;">${period} | المستوى: ${level} | القسم: ${cls}</div>
                </div>
                <div class="stats-grid">
                    <div class="stat-box improved">
                        <div class="label">متحسن</div>
                        <div class="value" style="color: #27ae60;">${improved}</div>
                        <div class="perc">${percImproved}</div>
                    </div>
                    <div class="stat-box deteriorated">
                        <div class="label">متدهور</div>
                        <div class="value" style="color: #e74c3c;">${deteriorated}</div>
                        <div class="perc">${percDeteriorated}</div>
                    </div>
                    <div class="stat-box stable">
                        <div class="label">مستقر</div>
                        <div class="value" style="color: #95a5a6;">${stable}</div>
                        <div class="perc">${percStable}</div>
                    </div>
                </div>
                <h3 class="section-title">📋 قائمة التلاميذ</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>اللقب والاسم</th>
                            <th>المستوى</th>
                            ${settings.educationStage === 'secondary' ? '<th>الشعبة</th>' : ''}
                            <th>القسم</th>
                            <th>المعدل السابق</th>
                            <th>المعدل الحالي</th>
                            <th>الفارق (Δ)</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
                <div class="footer">
                    <div style="flex: 1;"></div>
                    <div class="signature-box">
                        المدير<br><br>
                        <strong>${settings.managerName || '................'}</strong>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        if (window.PrintToolbarHelper) {} else { window.print(); }
                    };
                </script>
                ${window.PrintToolbarHelper ? window.PrintToolbarHelper.getScriptHtml({advanced: false}) : ''}
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch (err) {
        console.error('Print Error:', err);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'حدث خطأ أثناء محاولة توليد التقرير'
        });
    }
}
