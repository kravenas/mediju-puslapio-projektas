// Shared HTML/attribute escaping helpers. Loaded before other JS.
(function () {
    'use strict';

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(value);
        return div.innerHTML;
    }

    // Safe for use inside double-quoted HTML attributes.
    function escapeAttr(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Allow only http(s)/mailto/tel/relative URLs. Strips javascript:, data:, vbscript:, etc.
    function safeUrl(value) {
        if (!value) return '';
        const s = String(value).trim();
        if (/^(https?:|mailto:|tel:)/i.test(s)) return escapeAttr(s);
        if (/^[/.#?]/.test(s)) return escapeAttr(s); // relative
        return '';
    }

    window.escapeHtml = escapeHtml;
    window.escapeAttr = escapeAttr;
    window.safeUrl = safeUrl;
})();
