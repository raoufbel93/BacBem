/**
 * Signature Helper - Shared functions for all reports (Simplified - No Images)
 * Include this file in any page that needs signature functionality
 */

/**
 * Get signature HTML block for a report
 * @param {string} reportType - The report type ID (e.g., 'class_analysis', 'student_list')
 * @returns {string} - HTML for signature block to be inserted in print reports
 */
function getSignatureHTML(reportType, customSettings = null) {
    const settings = customSettings || (window.signatureSettings) || JSON.parse(localStorage.getItem('signatureSettings')) || {};
    const reportConfig = settings.reportSettings?.[reportType] || { signer: 'director', showSignature: true };
    const signer = settings.signers?.[reportConfig.signer] || { fullName: '', gender: 'male' };

    // If signature is disabled, return empty
    if (!reportConfig.showSignature) {
        return '';
    }

    // Determine title based on signer type and gender
    let signerTitle;
    if (reportConfig.signer === 'director') {
        signerTitle = signer.gender === 'female' ? 'المديرة' : 'المدير';
    } else {
        signerTitle = signer.gender === 'female' ? 'الناظرة' : 'الناظر';
    }

    return `
        <div style="text-align: left; margin-top: 40px; page-break-inside: avoid;">
            <div style="display: inline-block; text-align: center; min-width: 200px; padding: 15px;">
                <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 12pt;">${signerTitle}</p>
                <p style="margin: 0; font-size: 11pt; border-bottom: 1px dotted #333; padding-bottom: 30px;">${signer.fullName || ''}</p>
            </div>
        </div>
    `;
}

// Make function globally available
window.getSignatureHTML = getSignatureHTML;
