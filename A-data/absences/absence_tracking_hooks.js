/**
 * Absence Tracking - React Hooks & Data Management
 */

// Function to load all required data into the React state
async function loadAllData(dispatch) {
    try {
        const appSettings = await DB.get('institutionSettings') || {};
        const allStudents = await DB.getStudents(false) || [];
        const allTeachers = await DB.getTeachers() || [];
        const allSupervisors = await DB.get('supervisorsList') || [];
        
        // Canteen Data
        const canteenBeneficiaries = await DB.get('canteenBeneficiaries') || [];
        const canteenAbsences = await DB.get('canteenAbsences') || {};
        
        const teacherAssignments = await DB.get('teacherAssignments') || {};
        const holidays = await DB.get('app_holidays') || [];
        
        // Load report number
        const reportData = await DB.get('reportNumberData') || { lastNumber: 0, lastDate: null };
        let reportNumber = reportData.lastNumber || 1;

        dispatch({
            type: 'SET_DATA',
            payload: {
                appSettings,
                allStudents,
                allTeachers,
                allSupervisors,
                canteenBeneficiaries,
                canteenAbsences,
                teacherAssignments,
                holidays,
                reportNumber,
                loading: false
            }
        });
        
    } catch (error) {
        console.error('Error loading data:', error);
        if (typeof showToast === 'function') showToast('خطأ في تحميل البيانات', 'error');
    }
}

// Helper hook to access global functions
function useGlobalAbsenceLogic() {
    const getScheduleForDate = useCallback((date) => {
        if (window.getScheduleForDate) return window.getScheduleForDate(date);
        return null;
    }, []);

    const calculateConsecutiveDays = useCallback((studentId, date, allRecords, isSelected) => {
        if (window.calculateConsecutiveDays) return window.calculateConsecutiveDays(studentId, date, allRecords, isSelected);
        return isSelected ? 1 : 0;
    }, []);

    return { getScheduleForDate, calculateConsecutiveDays };
}
