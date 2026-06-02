(function (global) {
    'use strict';

    if (global.ExcelExportHelper) {
        return;
    }

    function ensureXlsx() {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library is not loaded.');
        }
    }

    function textValue(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/\s+/g, ' ').trim();
    }

    function decodeHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return textValue(div.textContent || div.innerText || '');
    }

    function fieldValue(field) {
        if (!field) return '';

        if (field.dataset && Object.prototype.hasOwnProperty.call(field.dataset, 'exportValue')) {
            return textValue(field.dataset.exportValue);
        }

        if (field.tagName === 'SELECT') {
            const option = field.selectedOptions && field.selectedOptions[0];
            return textValue(option ? option.textContent : field.value);
        }

        if (field.tagName === 'TEXTAREA') {
            return textValue(field.value);
        }

        const type = (field.type || '').toLowerCase();
        if (type === 'checkbox' || type === 'radio') {
            return field.checked ? textValue(field.value || '1') : '';
        }

        return textValue(field.value);
    }

    function isHidden(element) {
        if (!element) return true;
        if (element.hidden) return true;
        const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
        return !!style && (style.display === 'none' || style.visibility === 'hidden');
    }

    function cellText(cell) {
        if (!cell) return '';
        if (cell.dataset && Object.prototype.hasOwnProperty.call(cell.dataset, 'exportValue')) {
            return textValue(cell.dataset.exportValue);
        }

        const clone = cell.cloneNode(true);
        clone.querySelectorAll('input, select, textarea').forEach((field) => {
            const value = fieldValue(field);
            field.replaceWith(document.createTextNode(value ? ` ${value} ` : ' '));
        });
        clone.querySelectorAll('.no-print, .no-export, button').forEach((node) => node.remove());
        return decodeHtml(clone.innerHTML || clone.textContent || '');
    }

    function tableToAoA(table) {
        if (!table) return [];

        const rows = [];
        Array.from(table.querySelectorAll('tr')).forEach((tr) => {
            if (isHidden(tr)) return;

            const row = [];
            Array.from(tr.children).forEach((cell) => {
                if (isHidden(cell) || cell.classList.contains('no-export')) return;
                if (cell.tagName !== 'TH' && cell.tagName !== 'TD') return;
                row.push(cellText(cell));
            });

            if (row.length > 0) {
                rows.push(row);
            }
        });

        return rows;
    }

    function normalizeAoA(aoa) {
        const maxColumns = aoa.reduce((max, row) => Math.max(max, row.length), 0);
        return aoa.map((row) => {
            const normalized = row.slice();
            while (normalized.length < maxColumns) {
                normalized.push('');
            }
            return normalized;
        });
    }

    function deriveColumns(aoa) {
        if (!aoa.length) return [];

        const columnCount = aoa.reduce((max, row) => Math.max(max, row.length), 0);
        const widths = new Array(columnCount).fill(10);

        aoa.forEach((row) => {
            row.forEach((cell, index) => {
                const cellLength = textValue(cell).length || 1;
                widths[index] = Math.min(Math.max(widths[index], cellLength + 2), 40);
            });
        });

        return widths.map((wch) => ({ wch }));
    }

    function setMerges(ws, rowCount, lastColumnIndex) {
        if (lastColumnIndex < 1) return;
        ws['!merges'] = ws['!merges'] || [];
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
            ws['!merges'].push({
                s: { r: rowIndex, c: 0 },
                e: { r: rowIndex, c: lastColumnIndex }
            });
        }
    }

    function ensureWorksheetCells(ws, aoa) {
        if (!aoa.length) return;

        for (let row = 0; row < aoa.length; row += 1) {
            for (let col = 0; col < aoa[row].length; col += 1) {
                const address = XLSX.utils.encode_cell({ r: row, c: col });
                if (!ws[address]) {
                    ws[address] = { t: 's', v: '' };
                }
            }
        }
    }

    function thinBorder() {
        return {
            top: { style: 'thin', color: { auto: 1 } },
            bottom: { style: 'thin', color: { auto: 1 } },
            left: { style: 'thin', color: { auto: 1 } },
            right: { style: 'thin', color: { auto: 1 } }
        };
    }

    function styleSheet(ws, aoa, options) {
        const ref = ws['!ref'];
        if (!ref) return;

        const titleRows = options.titleRows || 0;
        const metaRows = options.metaRows || 0;
        const headerRowIndex = options.headerRowIndex;
        const bodyStartRowIndex = options.bodyStartRowIndex;
        const range = XLSX.utils.decode_range(ref);

        for (let row = range.s.r; row <= range.e.r; row += 1) {
            for (let col = range.s.c; col <= range.e.c; col += 1) {
                const address = XLSX.utils.encode_cell({ r: row, c: col });
                if (!ws[address]) {
                    ws[address] = { t: 's', v: '' };
                }

                const isEmpty = textValue(aoa[row] && aoa[row][col]) === '';
                const style = {
                    font: { name: 'Arial', sz: 11, bold: false },
                    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
                    border: {},
                    fill: undefined
                };

                if (row < titleRows) {
                    style.font = { name: 'Arial', sz: 14, bold: true };
                } else if (row < titleRows + metaRows) {
                    style.font = { name: 'Arial', sz: 12, bold: true };
                    style.alignment.horizontal = 'right';
                } else if (row === headerRowIndex) {
                    style.font = { name: 'Arial', sz: 11, bold: true };
                    style.fill = { patternType: 'solid', fgColor: { rgb: 'E2EFDA' } };
                    style.border = thinBorder();
                } else if (row >= bodyStartRowIndex) {
                    style.border = thinBorder();
                }

                ws[address].s = style;
            }
        }

        ws['!views'] = [{ rightToLeft: true }];
    }

    function createSheet(spec) {
        ensureXlsx();

        const titleRows = spec.title ? [[spec.title]] : [];
        const metaRows = (spec.metaRows || []).filter(Boolean).map((row) => [row]);
        let bodyRows = [];

        if (spec.table) {
            bodyRows = tableToAoA(spec.table);
        } else {
            if (spec.headers && spec.headers.length) {
                bodyRows.push(spec.headers);
            }
            if (spec.rows && spec.rows.length) {
                bodyRows = bodyRows.concat(spec.rows);
            }
        }

        const includeSpacer = (titleRows.length || metaRows.length) && bodyRows.length;
        const aoa = normalizeAoA([
            ...titleRows,
            ...metaRows,
            ...(includeSpacer ? [['']] : []),
            ...bodyRows
        ]);

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ensureWorksheetCells(ws, aoa);
        ws['!cols'] = spec.cols && spec.cols.length ? spec.cols : deriveColumns(aoa);

        const lastColumnIndex = aoa.length > 0 ? Math.max(0, aoa[0].length - 1) : 0;
        setMerges(ws, titleRows.length + metaRows.length + (includeSpacer ? 1 : 0), lastColumnIndex);

        styleSheet(ws, aoa, {
            titleRows: titleRows.length,
            metaRows: metaRows.length,
            headerRowIndex: spec.table ? titleRows.length + metaRows.length + (includeSpacer ? 1 : 0) : (spec.headers && spec.headers.length ? titleRows.length + metaRows.length + (includeSpacer ? 1 : 0) : -1),
            bodyStartRowIndex: titleRows.length + metaRows.length + (includeSpacer ? 1 : 0) + (spec.headers && spec.headers.length ? 1 : 0)
        });

        return ws;
    }

    function safeSheetName(name, index) {
        const base = textValue(name) || `Sheet${index + 1}`;
        return base.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
    }

    function dateStamp() {
        return new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    }

    function notify(message, type) {
        if (typeof global.showToast === 'function') {
            global.showToast(message, type || 'success');
            return;
        }

        if (global.Swal && typeof global.Swal.fire === 'function') {
            global.Swal.fire({
                icon: type === 'error' ? 'error' : (type === 'warning' ? 'warning' : 'success'),
                title: type === 'error' ? 'خطأ' : (type === 'warning' ? 'تنبيه' : 'تمت العملية'),
                text: message
            });
            return;
        }

        global.alert(message);
    }

    function resolveIpcRenderer() {
        if (global.ipcRenderer && typeof global.ipcRenderer.invoke === 'function') {
            return global.ipcRenderer;
        }

        try {
            if (global.parent && global.parent !== global && global.parent.ipcRenderer && typeof global.parent.ipcRenderer.invoke === 'function') {
                global.ipcRenderer = global.parent.ipcRenderer;
                return global.ipcRenderer;
            }
        } catch (e) { }

        try {
            if (global.top && global.top !== global && global.top.ipcRenderer && typeof global.top.ipcRenderer.invoke === 'function') {
                global.ipcRenderer = global.top.ipcRenderer;
                return global.ipcRenderer;
            }
        } catch (e) { }

        try {
            var req = null;
            if (typeof global.require === 'function') {
                req = global.require;
            } else if (global.parent && typeof global.parent.require === 'function') {
                req = global.parent.require;
            } else if (global.top && typeof global.top.require === 'function') {
                req = global.top.require;
            }

            if (req) {
                var electron = req('electron');
                if (electron && electron.ipcRenderer && typeof electron.ipcRenderer.invoke === 'function') {
                    global.ipcRenderer = electron.ipcRenderer;
                    return global.ipcRenderer;
                }
            }
        } catch (e) { }

        return null;
    }

    async function saveWorkbook(workbook, fileName) {
        ensureXlsx();

        if (global.Auth && typeof global.Auth.blockRestrictedFeature === 'function') {
            if (global.Auth.blockRestrictedFeature('excel-export')) {
                return { success: false, canceled: true, blocked: true };
            }
        }

        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const ipcRenderer = resolveIpcRenderer();

        if (ipcRenderer && typeof ipcRenderer.invoke === 'function') {
            const result = await ipcRenderer.invoke('save-excel', {
                buffer: wbout,
                fileName: fileName
            });
            if (result && result.success) {
                notify(`تم تصدير الملف بنجاح: ${result.filePath}`, 'success');
                return result;
            }

            if (result && result.error) {
                throw new Error(result.error);
            }

            return result;
        }

        XLSX.writeFile(workbook, fileName);
        notify('تم تصدير الملف بنجاح', 'success');
        return { success: true, filePath: fileName };
    }

    async function exportWorkbook(options) {
        ensureXlsx();

        const sheets = Array.isArray(options.sheets) ? options.sheets : [];
        if (!sheets.length) {
            notify('لا توجد بيانات للتصدير', 'warning');
            return;
        }

        const workbook = XLSX.utils.book_new();
        workbook.Workbook = { Views: [{ RTL: true }] };

        sheets.forEach((sheet, index) => {
            const ws = createSheet(sheet);
            XLSX.utils.book_append_sheet(workbook, ws, safeSheetName(sheet.sheetName, index));
        });

        const fileName = options.fileName || `export_${dateStamp()}.xlsx`;
        return saveWorkbook(workbook, fileName);
    }

    global.ExcelExportHelper = {
        dateStamp,
        exportWorkbook,
        notify,
        tableToAoA
    };
}(window));
