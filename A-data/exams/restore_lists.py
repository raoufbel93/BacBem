import sys
import os

path = r'c:\Users\tamtam\Desktop\analyse\A-data\exams\official_supervision_lists.js'
new_code = """function populatePeriodSelect() {
    const dayId = parseInt(document.getElementById('daySelect').value);
    const periodSelect = document.getElementById('periodSelect');
    const currentValue = periodSelect.value;

    let html = '<option value="morning">صباح</option>';

    const day = days.find(d => d.id === dayId);
    if (day && day.midday) {
        html += '<option value="midday">منتصف</option>';
    }

    html += '<option value="evening">مساء</option>';
    periodSelect.innerHTML = html;

    if (currentValue) periodSelect.value = currentValue;
}

function loadTeachersForPeriod() {
    const dayId = parseInt(document.getElementById('daySelect').value);
    const period = document.getElementById('periodSelect').value;

    if (!dayId || !period) {
        currentTeachers = [];
        renderTeachersTable();
        return;
    }

    const day = days.find(d => d.id === dayId);
    if (!day) return;

    const key = `${dayId}_${period}`;
    const assignedTeacherIds = schedule[key] || [];

    currentTeachers = assignedTeacherIds.map(tid => {
        const teacher = teachers.find(t => t.id === tid);
        if (!teacher) return null;

        const saved = roomAssignments[key]?.[tid] || {};
        return {
            id: teacher.id,
            surname: teacher.surname,
            name: teacher.name,
            subjects: teacher.subjects,
            institution: teacher.institution,
            room: saved.room || 0,
            note: saved.note || '',
            isReserve: saved.isReserve || false
        };
    }).filter(Boolean);

    currentTeachers.sort((a, b) => a.surname.localeCompare(b.surname, 'ar'));

    let periodLabel = 'صباحية';
    if (period === 'midday') periodLabel = 'منتصف';
    if (period === 'evening') periodLabel = 'مسائية';

    const subjects = (day[period].subjects || []).join(' + ') || 'غير محدد';

    const dateStr = new Date(day.date).toLocaleDateString('ar-DZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    const printHeader = document.getElementById('printHeaderSubtitle');
    if (printHeader) {
        printHeader.textContent = `${dateStr} - ${periodLabel} (${subjects})`;
    }

    const topBarTitle = document.querySelector('.top-bar-controls h3');
    if (topBarTitle) {
        topBarTitle.textContent = `${dateStr} - ${periodLabel}`;
    }

    renderTeachersTable();
}
"""

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We need to find the NEW indices since the file changed.
# Let's search for "function populatePeriodSelect"
start_idx = -1
for i, line in enumerate(lines):
    if "function populatePeriodSelect" in line:
        start_idx = i
        break

# Let's search for the end of the mangle
# It currently ends with "let periodLabel = 'صباحية';" followed by blank lines and then "/**"
end_idx = -1
for i in range(start_idx, len(lines)):
    if "let periodLabel = 'صباحية';" in lines[i]:
        end_idx = i + 1
        break

if start_idx != -1 and end_idx != -1:
    new_lines = lines[:start_idx] + [new_code] + lines[end_idx:]
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Restoration Done Successfully")
else:
    print(f"Could not find anchors: start={start_idx}, end={end_idx}")
