const config = require('../config/config');

let sendEmail;
if (config.sendgrid) {
  const sgMail = require('@sendgrid/mail');
  const { apiKey, fromEmail, fromName } = config.sendgrid;
  sgMail.setApiKey(apiKey);

  // to: string | { email: string, name?: string }
  // subject: string
  // content: { html?: string, text?: string }
  sendEmail = async function (to, subject, content) {
    const { html, text } = content || {};
    const from = fromName && fromEmail ? { email: fromEmail, name: fromName } : { email: fromEmail || undefined };
    const toObj = typeof to === 'string' ? { email: to } : to;

    const msg = {
      to: toObj,
      from,
      subject,
      text: text || undefined,
      html: html || undefined,
    };
    await sgMail.send(msg);
  };
} else {
  sendEmail = async function () {
    throw new Error('SendGrid configuration is missing. Email service is disabled.');
  };
}

module.exports = {
  sendEmail,
};
