module.exports = function (context) {
    var ipcMain = context.ipcMain;
    var nodemailer = context.nodemailer;
    var path = context.path;
    var db = context.getDb();

    ipcMain.handle('send-email', async function (event, emailOptions) {
        try {
            var getSetting = function (key) {
                return new Promise(function (resolve) {
                    db.get('SELECT value FROM settings WHERE key = ?', [key], function (err, row) {
                        if (err || !row) {
                            resolve({});
                            return;
                        }
                        try {
                            resolve(JSON.parse(row.value));
                        } catch (e) {
                            resolve(row.value);
                        }
                    });
                });
            };

            var settingsObj = await getSetting('institutionSettings') || {};
            var user = settingsObj.smtpEmail;
            var pass = settingsObj.smtpPassword;
            var host = settingsObj.smtpHost || 'smtp.gmail.com';
            var port = settingsObj.smtpPort || '465';

            if (!user || !pass) {
                return { success: false, error: 'ط¥ط¹ط¯ط§ط¯ط§طھ ط®ط§ط¯ظ… ط§ظ„ط¨ط±ظٹط¯ (SMTP) ط؛ظٹط± ظ…ظƒطھظ…ظ„ط©. ظٹط±ط¬ظ‰ ط¶ط¨ط·ظ‡ط§ ظ…ظ† طµظپط­ط© ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ.' };
            }

            var transporter = nodemailer.createTransport({
                host: host,
                port: parseInt(port, 10),
                secure: parseInt(port, 10) === 465,
                auth: { user: user, pass: pass }
            });

            var mailPayload = {
                from: '"ط¥ط¯ط§ط±ط© ط§ظ„ظ…ط¤ط³ط³ط©" <' + user + '>',
                to: emailOptions.to,
                subject: emailOptions.subject,
                text: emailOptions.body
            };

            if (emailOptions.htmlBody) {
                mailPayload.html = emailOptions.htmlBody;
            }

            if (emailOptions.attachments && Array.isArray(emailOptions.attachments) && emailOptions.attachments.length > 0) {
                mailPayload.attachments = emailOptions.attachments.map(function (att) {
                    return {
                        filename: att.filename || path.basename(att.path),
                        path: att.path
                    };
                });
            }

            var info = await transporter.sendMail(mailPayload);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Email send error:', error);
            var errorMessage = error.message;
            if (errorMessage.includes('Invalid login') || errorMessage.includes('535-5.7.8')) {
                errorMessage = 'ط®ط·ط£ ظپظٹ طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„. ظٹط±ط¬ظ‰ ط§ظ„طھط£ظƒط¯ ظ…ظ† ط§ط³طھط®ط¯ط§ظ… "ظƒظ„ظ…ط© ظ…ط±ظˆط± ط§ظ„طھط·ط¨ظٹظ‚" (App Password) ط§ظ„ظ…ظƒظˆظ†ط© ظ…ظ† 16 ط­ط±ظپط§ظ‹ ظˆظ„ظٹط³ ظƒظ„ظ…ط© ظ…ط±ظˆط± ط§ظ„ط¥ظٹظ…ظٹظ„ ط§ظ„ط¹ط§ط¯ظٹط©.';
            }
            return { success: false, error: errorMessage };
        }
    });
};
