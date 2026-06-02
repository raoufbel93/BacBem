/**
 * Subject Manager Module
 * Handles subject lists for middle and secondary school.
 */

const SubjectManager = (function () {

    const SUBJECT_CONFIG = {
        middle: {
            common: {
                '1': ['عربية', 'أمازيغية', 'فرنسية', 'انجليزية', 'اسلامية', 'مدنية', 'تاريخ', 'رياضيات', 'علوم', 'فيزياء', 'معلوماتية', 'ت.تشكيلية', 'موسيقى', 'رياضة'],
                '2': ['عربية', 'أمازيغية', 'فرنسية', 'انجليزية', 'اسلامية', 'مدنية', 'تاريخ', 'رياضيات', 'علوم', 'فيزياء', 'معلوماتية', 'ت.تشكيلية', 'موسيقى', 'رياضة'],
                '3': ['عربية', 'أمازيغية', 'فرنسية', 'انجليزية', 'اسلامية', 'مدنية', 'تاريخ', 'رياضيات', 'علوم', 'فيزياء', 'معلوماتية', 'ت.تشكيلية', 'موسيقى', 'رياضة'],
                '4': ['عربية', 'أمازيغية', 'فرنسية', 'انجليزية', 'اسلامية', 'مدنية', 'تاريخ', 'رياضيات', 'علوم', 'فيزياء', 'معلوماتية', 'ت.تشكيلية', 'موسيقى', 'رياضة']
            }
        },

        secondary: {
            '1': {
                common_science: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'رياضيات',
                    'علوم طبيعية', 'علوم فيزيائية', 'تكنولوجيا', 'تاريخ وجغرافيا',
                    'علوم اسلامية', 'اعلام آلي', 'ت.تشكيلية', 'تربية بدنية', 'أمازيغية'
                ],
                common_arts: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'تاريخ وجغرافيا',
                    'علوم اسلامية', 'رياضيات', 'علوم طبيعية', 'فيزياء',
                    'اعلام آلي', 'ت.تشكيلية', 'تربية بدنية', 'أمازيغية'
                ]
            },

            '2': {
                science: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'رياضيات',
                    'علوم طبيعية', 'علوم فيزيائية', 'تاريخ وجغرافيا', 'علوم اسلامية',
                    'ت.تشكيلية', 'تربية بدنية', 'أمازيغية'
                ],
                math: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'رياضيات',
                    'علوم فيزيائية', 'علوم طبيعية', 'تاريخ وجغرافيا', 'علوم اسلامية',
                    'ت.تشكيلية', 'تربية بدنية', 'أمازيغية'
                ],
                tech_math: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'رياضيات',
                    'علوم فيزيائية', 'تكنولوجيا', 'تاريخ وجغرافيا', 'علوم اسلامية',
                    'ت.تشكيلية', 'تربية بدنية', 'أمازيغية'
                ],
                management: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'رياضيات',
                    'تسيير محاسبي', 'اقتصاد ومناجمنت', 'قانون', 'تاريخ وجغرافيا',
                    'علوم اسلامية', 'ت.تشكيلية', 'موسيقى', 'تربية بدنية', 'أمازيغية'
                ],
                languages: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'لغة ثالثة',
                    'تاريخ وجغرافيا', 'علوم اسلامية', 'رياضيات', 'ت.تشكيلية',
                    'تربية بدنية', 'أمازيغية'
                ],
                arts: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'فلسفة',
                    'تاريخ وجغرافيا', 'علوم اسلامية', 'رياضيات', 'علوم طبيعية',
                    'علوم فيزيائية', 'ت.تشكيلية', 'تربية بدنية', 'أمازيغية'
                ]
            },

            '3': {
                science: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'رياضيات',
                    'علوم طبيعية', 'علوم فيزيائية', 'فلسفة', 'تاريخ وجغرافيا',
                    'علوم اسلامية', 'تربية بدنية', 'أمازيغية'
                ],
                math: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'رياضيات',
                    'علوم فيزيائية', 'علوم طبيعية', 'فلسفة', 'تاريخ وجغرافيا',
                    'علوم اسلامية', 'تربية بدنية', 'أمازيغية'
                ],
                tech_math: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'رياضيات',
                    'علوم فيزيائية', 'تكنولوجيا', 'فلسفة', 'تاريخ وجغرافيا',
                    'علوم اسلامية', 'تربية بدنية', 'أمازيغية'
                ],
                management: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'رياضيات',
                    'تسيير محاسبي', 'اقتصاد ومناجمنت', 'قانون', 'فلسفة',
                    'تاريخ وجغرافيا', 'علوم اسلامية', 'ت.تشكيلية', 'موسيقى',
                    'تربية بدنية', 'أمازيغية'
                ],
                languages: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'لغة ثالثة',
                    'فلسفة', 'تاريخ وجغرافيا', 'علوم اسلامية', 'رياضيات',
                    'تربية بدنية', 'أمازيغية'
                ],
                arts: [
                    'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'فلسفة',
                    'تاريخ وجغرافيا', 'علوم اسلامية', 'رياضيات', 'تربية بدنية',
                    'أمازيغية'
                ]
            }
        }
    };

    function _normalizeLevel(levelStr) {
        if (!levelStr) return '1';
        const str = levelStr.toString();
        if (str.includes('1') || str.includes('أولى')) return '1';
        if (str.includes('2') || str.includes('ثانية')) return '2';
        if (str.includes('3') || str.includes('ثالثة')) return '3';
        if (str.includes('4') || str.includes('رابعة')) return '4';
        return '1';
    }

    function getSubjects(stage, level, stream = 'common') {
        if (!SUBJECT_CONFIG[stage]) stage = 'middle';

        const normLevel = _normalizeLevel(level);

        if (stage === 'middle') {
            return SUBJECT_CONFIG.middle.common[normLevel] || SUBJECT_CONFIG.middle.common['1'];
        }

        if (stage === 'secondary') {
            const levelConfig = SUBJECT_CONFIG.secondary[normLevel];
            if (!levelConfig) return [];
            return levelConfig[stream] || [];
        }

        return [];
    }

    function getStreams(level) {
        const normLevel = _normalizeLevel(level);
        if (SUBJECT_CONFIG.secondary[normLevel]) {
            return Object.keys(SUBJECT_CONFIG.secondary[normLevel]);
        }
        return [];
    }

    function getStreamName(streamCode) {
        const map = {
            common_science: 'جذع مشترك علوم وتكنولوجيا',
            common_arts: 'جذع مشترك آداب',
            science: 'علوم تجريبية',
            math: 'رياضيات',
            tech_math: 'تقني رياضي',
            tech_math_civil: 'تقني رياضي (هندسة مدنية)',
            tech_math_mech: 'تقني رياضي (هندسة ميكانيكية)',
            tech_math_elec: 'تقني رياضي (هندسة كهربائية)',
            tech_math_methods: 'تقني رياضي (هندسة الطرائق)',
            management: 'تسيير واقتصاد',
            languages: 'لغات أجنبية',
            arts: 'آداب وفلسفة'
        };
        return map[streamCode] || streamCode;
    }

    function getStreamAbbreviation(streamCode) {
        const map = {
            common_science: 'ج.م.ع.ت',
            common_arts: 'ج.م.آ',
            science: 'ع.تج',
            math: 'ر',
            tech_math: 'ت.ر',
            tech_math_civil: 'ت.ر (ه.م)',
            tech_math_mech: 'ت.ر (ه.ميك)',
            tech_math_elec: 'ت.ر (ه.ك)',
            tech_math_methods: 'ت.ر (ه.ط)',
            management: 'ت.اق',
            languages: 'ل.أ',
            arts: 'آ.ف'
        };
        return map[streamCode] || getStreamName(streamCode);
    }

    function getSubjectCoefficient(stage, level, stream, subjectName) {
        if (stage !== 'middle') return 1;

        const normLevel = _normalizeLevel(level);
        const canonName = matchSubjectForCoefficient(subjectName);

        if (canonName && EXAM_COEFFICIENTS[canonName]) {
            return EXAM_COEFFICIENTS[canonName][normLevel] || 1;
        }
        return 1;
    }

    function matchSubjectForCoefficient(importedName) {
        if (!importedName) return null;

        const name = importedName.trim();

        if (EXAM_COEFFICIENTS[name]) return name;

        if (name.includes('عربية')) return 'اللغة العربية';
        if (name.includes('إنجليزية') || name.includes('انجليزية')) return 'اللغة الإنجليزية';
        if (name.includes('فرنسية')) return 'اللغة الفرنسية';
        if (name.includes('أمازيغية') || name.includes('امازيغية')) return 'اللغة الأمازيغية';
        if (name.includes('رياضيات')) return 'الرياضيات';
        if (name.includes('طبيعة') && (name.includes('حياة') || name.includes('طبيعية'))) return 'ع الطبيعة و الحياة';
        if (name.includes('فيزيائية') || name.includes('فيزياء') || name.includes('التكنولوجيا')) return 'ع الفيزيائية والتكنولوجيا';
        if (name.includes('إسلامية') || name.includes('اسلامية')) return 'التربية الإسلامية';
        if (name.includes('تاريخ') || name.includes('جغرافيا')) return 'التاريخ والجغرافيا';
        if (name.includes('مدنية')) return 'التربية المدنية';
        if (name.includes('تشكيلية')) return 'التربية التشكيلية';
        if (name.includes('موسيقية') || name.includes('موسيقى')) return 'التربية الموسيقية';
        if (name.includes('معلوماتية') || name.includes('اعلام') || name.includes('إعلام')) return 'المعلوماتية';
        if (name.includes('بدنية') || name.includes('رياضة')) return 'ت البدنية و الرياضية';

        return null;
    }

    const EXAM_COEFFICIENTS = {
        'اللغة العربية': { 1: 2, 2: 3, 3: 3, 4: 5 },
        'اللغة الإنجليزية': { 1: 2, 2: 2, 3: 2, 4: 2 },
        'اللغة الفرنسية': { 1: 1, 2: 2, 3: 2, 4: 3 },
        'اللغة الأمازيغية': { 1: 1, 2: 1, 3: 1, 4: 2 },
        'الرياضيات': { 1: 2, 2: 3, 3: 3, 4: 4 },
        'ع الطبيعة و الحياة': { 1: 1, 2: 2, 3: 2, 4: 2 },
        'ع الفيزيائية والتكنولوجيا': { 1: 1, 2: 2, 3: 2, 4: 2 },
        'التربية الإسلامية': { 1: 1, 2: 1, 3: 1, 4: 2 },
        'التاريخ والجغرافيا': { 1: 2, 2: 2, 3: 2, 4: 3 },
        'التربية المدنية': { 1: 1, 2: 1, 3: 1, 4: 1 },
        'التربية التشكيلية': { 1: 1, 2: 1, 3: 1, 4: 1 },
        'التربية الموسيقية': { 1: 1, 2: 1, 3: 1, 4: 1 },
        'المعلوماتية': { 1: 1, 2: 1, 3: 1, 4: 1 },
        'ت البدنية و الرياضية': { 1: 1, 2: 1, 3: 1, 4: 1 }
    };

    return {
        getSubjects,
        getStreams,
        getStreamName,
        getStreamAbbreviation,
        getSubjectCoefficient,
        matchSubjectForCoefficient
    };

})();

window.SubjectManager = SubjectManager;
