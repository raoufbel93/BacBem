(function (global) {
    function copyToClipboard(text, btnEl) {
        if (!navigator.clipboard) {
            var textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) { }
            document.body.removeChild(textArea);
        } else {
            navigator.clipboard.writeText(text);
        }

        if (btnEl) {
            var originalHtml = btnEl.innerHTML;
            btnEl.innerHTML = '<i class="fas fa-check"></i> تم النسخ';
            btnEl.classList.add('btn-success-soft');
            setTimeout(function () {
                btnEl.innerHTML = originalHtml;
                btnEl.classList.remove('btn-success-soft');
            }, 2000);
        }
    }

    global.AppUI = global.AppUI || {};
    global.AppUI.copyToClipboard = copyToClipboard;
})(window);
