(function (global) {
    var React = global.React;
    var ReactDOM = global.ReactDOM;

    if (!React || !ReactDOM) {
        return;
    }

    var e = React.createElement;
    var mountedRoot = null;
    var mountedContainer = null;
    var currentViewModel = null;

    function renderInto(container, element) {
        if (!container) return;

        if (typeof ReactDOM.createRoot === 'function') {
            if (!mountedRoot) {
                mountedRoot = ReactDOM.createRoot(container);
            }
            mountedRoot.render(element);
            return;
        }

        ReactDOM.render(element, container);
    }

    function chip(text, className) {
        return e('span', { className: className || 'student-detail-chip' }, text);
    }

    function SummaryCard(props) {
        return e('div', { className: 'student-summary-card' }, [
            e('div', { key: 'label', className: 'student-summary-label' }, props.label),
            e('div', { key: 'value', className: 'student-summary-value' }, props.value)
        ]);
    }

    function StudentPhotoPanel(props) {
        var viewModel = props.viewModel || {};
        var hasPhoto = !!viewModel.photoData;
        var shouldShowLargeCard = hasPhoto || !!viewModel.photoLoading;

        if (!shouldShowLargeCard) {
            return e('div', { className: 'student-photo-compact-card' }, [
                e('div', { key: 'fallback', className: 'student-photo-fallback compact' }, viewModel.initials || '?'),
                e('div', { key: 'hint', className: 'student-photo-compact-text' }, 'لا توجد صورة مرتبطة بهذا التلميذ')
            ]);
        }

        return e('div', { className: 'student-photo-card' }, [
            hasPhoto
                ? e('img', {
                    key: 'img',
                    src: viewModel.photoData,
                    alt: 'صورة التلميذ',
                    className: 'student-photo-image'
                })
                : e('div', { key: 'fallback', className: 'student-photo-fallback' }, viewModel.initials || '?'),
            viewModel.photoLoading
                ? e('div', { key: 'loading', className: 'student-photo-loading-badge' }, 'جاري جلب الصورة...')
                : null
        ]);
    }

    function StudentIdentityCard(props) {
        var viewModel = props.viewModel || {};
        var identityDetails = [
            viewModel.levelLabel || 'مستوى غير محدد',
            'القسم ' + (viewModel.classLabel || '-'),
            viewModel.streamLabel || null,
            viewModel.birthDateLabel ? 'تاريخ الميلاد: ' + viewModel.birthDateLabel : null
        ].filter(Boolean);

        return e('div', { className: 'student-identity-card' }, [
            e('div', { key: 'name', className: 'student-identity-name' }, viewModel.title || 'تفاصيل التلميذ'),
            e('div', { key: 'subtitle', className: 'student-identity-subtitle' }, 'بطاقة متابعة التلميذ'),
            e('div', { key: 'meta', className: 'student-identity-meta' },
                identityDetails.map(function (detail, index) {
                    return e('span', { key: 'detail_' + index, className: 'student-identity-meta-item' }, detail);
                })
            )
        ]);
    }

    function StudentStatsPanel(props) {
        var viewModel = props.viewModel || {};

        return e('div', { className: 'student-detail-stats-panel' }, [
            e('div', { key: 'status-row', className: 'student-status-row' }, [
                viewModel.genderLabel ? chip(viewModel.genderLabel, 'student-detail-chip gender') : null,
                viewModel.trimesterLabel ? chip(viewModel.trimesterLabel) : null,
                viewModel.decisionLabel ? chip('القرار: ' + viewModel.decisionLabel, 'student-detail-chip decision') : null,
                viewModel.subjectCount ? chip('المواد: ' + viewModel.subjectCount, 'student-detail-chip muted') : null
            ]),
            e('div', { key: 'average', className: 'student-average-card', style: { borderColor: viewModel.averageColor } }, [
                e('div', { key: 'label', className: 'student-average-label' }, 'المعدل الفصلي'),
                e('div', { key: 'value', className: 'student-average-value', style: { color: viewModel.averageColor } }, viewModel.averageLabel),
                e('div', { key: 'app', className: 'student-average-appreciation', style: { color: viewModel.averageColor, background: viewModel.averageTint } }, viewModel.appreciation),
                viewModel.previousAverageLabel
                    ? e('div', { key: 'prev', className: 'student-average-trend' }, [
                        e('span', { key: 'prev-label' }, 'السابق: ' + viewModel.previousAverageLabel),
                        viewModel.previousAverageDeltaLabel
                            ? e('span', {
                                key: 'prev-delta',
                                className: 'student-average-delta ' + (viewModel.previousAverageDirection || 'steady')
                            }, viewModel.previousAverageDeltaLabel)
                            : null
                    ])
                    : null
            ]),
            e('div', { key: 'cards', className: 'student-summary-grid' },
                (viewModel.summaryCards || []).map(function (card, index) {
                    return e(SummaryCard, { key: card.label + '_' + index, label: card.label, value: card.value });
                })
            )
        ]);
    }

    function SubjectTable(props) {
        var rows = (props.rows || []).map(function (item, index) {
            return e('tr', { key: item.subject + '_' + index }, [
                e('td', { key: 'subject', className: 'subject-table-subject-cell' }, item.subject),
                e('td', { key: 'score', className: 'subject-table-score-cell' },
                    e('span', {
                        className: 'student-subject-score',
                        style: { color: item.scoreColor, background: item.scoreBackground }
                    }, item.scoreLabel)
                ),
                e('td', { key: 'previous', className: 'subject-table-previous-cell' }, item.previousScoreLabel || '-'),
                e('td', { key: 'delta', className: 'subject-table-delta-cell' },
                    item.deltaLabel ? e('span', {
                        className: 'student-detail-chip trend ' + (item.deltaDirection || 'steady')
                    }, item.deltaLabel) : '-'
                ),
                e('td', { key: 'hint', className: 'subject-table-hint-cell' }, item.scoreHint || '')
            ]);
        });

        if (!rows.length) {
            return e('div', { className: 'student-subjects-empty' }, 'لا توجد علامات متاحة لهذا التلميذ ضمن الفصل المحدد.');
        }

        return e('div', { className: 'student-subjects-table-wrap' },
            e('table', { className: 'student-subjects-table' }, [
                e('thead', { key: 'thead' },
                    e('tr', null, [
                        e('th', { key: 'subject' }, 'المادة'),
                        e('th', { key: 'score' }, 'العلامة'),
                        e('th', { key: 'previous' }, 'السابق'),
                        e('th', { key: 'delta' }, 'الفارق'),
                        e('th', { key: 'hint' }, 'ملاحظة')
                    ])
                ),
                e('tbody', { key: 'tbody' }, rows)
            ])
        );
    }

    function StudentDetailModal(props) {
        var viewModel = props.viewModel || {};
        var hasPhotoBlock = !!viewModel.photoData || !!viewModel.photoLoading;

        return e('div', { className: 'animate-pop-in student-detail-modal-content' }, [
            e('div', { key: 'header', className: 'student-detail-modal-header' }, [
                e('div', { key: 'title-wrap', className: 'student-detail-title-wrap' }, [
                    e('div', { key: 'eyebrow', className: 'student-detail-eyebrow' }, 'بطاقة متابعة التلميذ'),
                    e('h3', { key: 'title', className: 'student-detail-title' }, 'متابعة النتائج والمواد')
                ]),
                e('button', {
                    key: 'close',
                    type: 'button',
                    className: 'student-detail-close',
                    onClick: props.onClose
                }, '×')
            ]),
            e('div', { key: 'body', className: 'student-detail-modal-body' }, [
                e(StudentIdentityCard, { key: 'identity-card', viewModel: viewModel }),
                e('section', {
                    key: 'overview',
                    className: 'student-detail-overview' + (hasPhotoBlock ? ' has-photo' : ' no-photo')
                }, [
                    hasPhotoBlock
                        ? e('div', { key: 'photo-col', className: 'student-detail-photo-column' }, [
                            e(StudentPhotoPanel, { viewModel: viewModel })
                        ])
                        : null,
                    e('div', { key: 'stats-col', className: 'student-detail-stats-column' }, [
                        !hasPhotoBlock
                            ? e('div', { key: 'photo-inline', className: 'student-inline-photo-status' }, [
                                e('div', { key: 'fallback', className: 'student-photo-fallback compact' }, viewModel.initials || '?'),
                                e('div', { key: 'text-wrap', className: 'student-inline-photo-text' }, [
                                    e('div', { key: 'title', className: 'student-inline-photo-title' }, 'الصورة غير متوفرة'),
                                    e('div', { key: 'caption', className: 'student-inline-photo-caption' }, 'لا توجد صورة مرتبطة بهذا التلميذ في سجل التلاميذ.')
                                ])
                            ])
                            : null,
                        e(StudentStatsPanel, { viewModel: viewModel })
                    ])
                ]),
                e('section', { key: 'subjects-section', className: 'student-detail-subjects-section' }, [
                    e('div', { key: 'subjects-header', className: 'student-subjects-header' }, [
                        e('h4', { key: 'heading' }, 'علامات المواد'),
                        e('span', { key: 'hint', className: 'student-subjects-hint' }, 'الجدول يعرض المواد بشكل أوضح مع العلامة والسابق والفارق.')
                    ]),
                    e(SubjectTable, { rows: viewModel.subjectRows || [] })
                ])
            ])
        ]);
    }

    function getOverlay() {
        return document.getElementById('studentModal');
    }

    function getMountNode() {
        return document.getElementById('studentModalReactRoot');
    }

    function ensureMounted() {
        var mountNode = getMountNode();
        if (!mountNode) return null;
        mountedContainer = mountNode;
        return mountNode;
    }

    function syncOverlayDisplay(isOpen) {
        var overlay = getOverlay();
        if (overlay) {
            overlay.style.display = isOpen ? 'flex' : 'none';
        }
    }

    function renderCurrent() {
        var mountNode = ensureMounted();
        if (!mountNode || !currentViewModel) return;

        renderInto(mountNode, e(StudentDetailModal, {
            viewModel: currentViewModel,
            onClose: close
        }));
    }

    function open(viewModel) {
        currentViewModel = Object.assign({}, viewModel || {});
        syncOverlayDisplay(true);
        renderCurrent();
    }

    function updatePhoto(studentKey, photoData) {
        if (!currentViewModel || currentViewModel.key !== studentKey) {
            return;
        }

        currentViewModel = Object.assign({}, currentViewModel, {
            photoData: photoData || null,
            photoLoading: false
        });
        renderCurrent();
    }

    function close() {
        currentViewModel = null;
        syncOverlayDisplay(false);
        if (mountedContainer) {
            renderInto(mountedContainer, e(React.Fragment, null));
        }
    }

    global.ClassCouncilsStudentModal = {
        open: open,
        close: close,
        updatePhoto: updatePhoto,
        isOpen: function () { return !!currentViewModel; },
        getCurrentKey: function () { return currentViewModel ? currentViewModel.key : null; }
    };
})(window);
