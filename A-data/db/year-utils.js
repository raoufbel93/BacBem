(function (global) {
    global.AppDbModules = global.AppDbModules || {};

    global.AppDbModules.yearUtils = {
        getCurrentAcademicYear: function () {
            var now = new Date();
            var year = now.getFullYear();
            var month = now.getMonth() + 1;

            if (month >= 9) {
                return (year + 1) + "/" + year;
            }

            return year + "/" + (year - 1);
        }
    };
})(window);
