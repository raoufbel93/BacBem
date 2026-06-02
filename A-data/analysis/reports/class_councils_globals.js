function getStudentYear(s) { 
    let y = s.academic_year || s.schoolYear || s.year || ''; 
    return y.toString().replace(/\//g, '-').trim(); 
}

// 1. البيانات الوهمية (Mock Data) كخيار احتياطي

// ترتيب المواد للعرض في القائمة التفصيلية (ثابت حسب HTML)

const orderedSubjects = [

    'عربية', 'أمازيغية', 'فرنسية', 'انجليزية',

    'اسلامية', 'مدنية', 'تاريخ',

    'رياضيات', 'علوم', 'فيزياء',

    'تسيير محاسبي', 'اقتصاد ومناجمنت', 'قانون',

    'هندسة مدنية', 'هندسة ميكانيكية', 'هندسة كهربائية', 'هندسة طرائق',

    'فلسفة', 'لغة ثالثة',

    'معلوماتية', 'ت.تشكيلية', 'موسيقى', 'رياضة'

];

// توليد بيانات عشوائية لـ 15 تلميذ (للعرض الأولي فقط)
const mockStudentsData = [];

// Global Variables for Data
let studentsData = []; // Define explicitly
let subjects = [];
let exemptSubjects = {};
let teachersList = [];
let classResponsibles = {};
let institutionSettings = {};
let signatureSettings = {};
let secondaryManualDecisions = {};
const SECONDARY_MANUAL_DECISIONS_KEY = 'secondaryManualDecisions';

// Cache for performance
const scoreCache = new Map(); // Key: studentId_subject_trimester -> Score
const statsCache = new Map(); // Key: trimester_subject -> { passed, total, rate }
const studentTableState = {
    searchTerm: '',
    onlyAtRisk: false,
    density: localStorage.getItem('classCouncilsTableDensity') === 'compact' ? 'compact' : 'comfortable',
    sortDirection: localStorage.getItem('classCouncilsTableSort') === 'asc' ? 'asc' : 'desc'
};
let darkifyController = null;
