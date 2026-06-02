/**

 * Signature Settings Management (Simplified - No Images)

 * Handles signers data and per-report signature settings

 */

// Report types configuration

const REPORT_TYPES = [

    { id: 'student_list', name: 'قائمة التلاميذ', icon: '📋' },

    { id: 'class_analysis', name: 'تحليل نتائج القسم', icon: '📈' },

    { id: 'level_analysis', name: 'تحليل نتائج المستوى', icon: '📊' },

    { id: 'institution_analysis', name: 'تحليل نتائج المؤسسة', icon: '🏫' },

    { id: 'teachers_list', name: 'قائمة الأساتذة', icon: '👨‍🏫' },

    { id: 'subject_responsibles', name: 'مسؤولي المواد', icon: '📘' },

    { id: 'class_responsibles', name: 'مسؤولي الأقسام', icon: '🏫' },

    { id: 'subject_statistics', name: 'إحصائيات المواد', icon: '📊' },

    { id: 'supervision', name: 'جدول الحراسة', icon: '📝' },

    { id: 'exam_lists', name: 'قوائم الاختبار', icon: '📋' },

    { id: 'assessment_lists', name: 'قوائم التقويم', icon: '📝' },

    { id: 'certificates', name: 'الشهادات التقديرية', icon: '🏆' },

    { id: 'repeaters', name: 'قائمة المعيدين', icon: '🔄' },

    { id: 'census', name: 'التعداد', icon: '📊' },

    { id: 'reception_hours', name: 'ساعات الاستقبال', icon: '🕒' },
    { id: 'class_council', name: 'محضر مجلس الأقسام', icon: '📄' }

];

// Current settings in memory

let currentSettings = {

    signers: {

        director: {

            title: 'المدير',

            fullName: '',

            gender: 'male'

        },

        supervisor: {

            title: 'الناظر',

            fullName: '',

            gender: 'male'

        }

    },

    reportSettings: {}

};

// Initialize on page load

document.addEventListener('DOMContentLoaded', async function () {

    await loadSettings();

    renderReportsTable();

});

/**

 * Load settings from IndexedDB

 */

async function loadSettings() {

    // Use DB.get() instead of localStorage

    const storedSettings = await DB.get('signatureSettings');

    if (storedSettings) {

        // Direct object assignment, no JSON.parse needed as IndexedDB stores objects

        currentSettings.signers = storedSettings.signers || currentSettings.signers;

        currentSettings.reportSettings = storedSettings.reportSettings || {};

    }

    // Ensure signers structure exists

    if (!currentSettings.signers) {

        currentSettings.signers = {

            director: { title: 'المدير', fullName: '' },

            supervisor: { title: 'الناظر', fullName: '' }

        };

    }

    if (!currentSettings.signers.director) currentSettings.signers.director = { title: 'المدير', fullName: '' };

    if (!currentSettings.signers.supervisor) currentSettings.signers.supervisor = { title: 'الناظر', fullName: '' };

    // Initialize report settings with defaults only if missing

    if (!currentSettings.reportSettings) currentSettings.reportSettings = {};

    REPORT_TYPES.forEach(report => {

        if (!currentSettings.reportSettings[report.id]) {

            currentSettings.reportSettings[report.id] = {

                signer: 'director',

                showSignature: true

            };

        }

    });

    // Populate form fields

    populateForm();

}

/**

 * Populate form with current settings

 */

function populateForm() {

    document.getElementById('directorName').value = currentSettings.signers.director.fullName || '';

    document.getElementById('supervisorName').value = currentSettings.signers.supervisor.fullName || '';

    // Set gender dropdowns

    const directorGender = document.getElementById('directorGender');

    const supervisorGender = document.getElementById('supervisorGender');

    if (directorGender) directorGender.value = currentSettings.signers.director.gender || 'male';

    if (supervisorGender) supervisorGender.value = currentSettings.signers.supervisor.gender || 'male';

}

/**

 * Render reports table

 */

function renderReportsTable() {

    const tbody = document.getElementById('reportsTableBody');

    tbody.innerHTML = REPORT_TYPES.map(report => {

        const settings = currentSettings.reportSettings[report.id] || { signer: 'director', showSignature: true };

        return `

            <tr>

                <td>${report.icon} ${report.name}</td>

                <td>

                    <select id="signer_${report.id}" onchange="updateReportSetting('${report.id}', 'signer', this.value)">

                        <option value="director" ${settings.signer === 'director' ? 'selected' : ''}>المدير</option>

                        <option value="supervisor" ${settings.signer === 'supervisor' ? 'selected' : ''}>الناظر</option>

                    </select>

                </td>

                <td>

                    <div class="checkbox-wrapper">

                        <input type="checkbox" id="sig_${report.id}"

                            ${settings.showSignature ? 'checked' : ''}

                            onchange="updateReportSetting('${report.id}', 'showSignature', this.checked)">

                    </div>

                </td>

            </tr>

        `;

    }).join('');

}

/**

 * Update report setting

 */

function updateReportSetting(reportId, field, value) {

    if (!currentSettings.reportSettings[reportId]) {

        currentSettings.reportSettings[reportId] = { signer: 'director', showSignature: true };

    }

    currentSettings.reportSettings[reportId][field] = value;

}

/**

 * Save all settings to IndexedDB

 */

async function saveAllSettings() {

    // Update names from form

    currentSettings.signers.director.fullName = document.getElementById('directorName').value.trim();

    currentSettings.signers.supervisor.fullName = document.getElementById('supervisorName').value.trim();

    // Update gender from form

    const directorGender = document.getElementById('directorGender');

    const supervisorGender = document.getElementById('supervisorGender');

    currentSettings.signers.director.gender = directorGender ? directorGender.value : 'male';

    currentSettings.signers.supervisor.gender = supervisorGender ? supervisorGender.value : 'male';

    // Save to IndexedDB

    await DB.set('signatureSettings', currentSettings);

    // Show success toast

    showToast('✅ تم حفٍ إعدادات التوقيع بنجاح');

}

/**

 * Show toast notification

 */

function showToast(message) {

    const toast = document.getElementById('toast');

    toast.textContent = message;

    toast.style.display = 'block';

    setTimeout(() => {

        toast.style.display = 'none';

    }, 3000);

}
