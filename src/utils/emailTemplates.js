const config = require('../config/config');

function invitationEmail({ creatorName, requirementTitle, isExistingUser, requirementId, recipientEmail }) {
  const appUrl = config.appUrl || 'http://localhost:3000';
  const requirementLink = isExistingUser
    ? `${appUrl}/login?redirect=/requirements/${requirementId}`
    : `${appUrl}/signup?email=${encodeURIComponent(recipientEmail)}&redirect=/requirements/${requirementId}`;
  const subject = `You've been invited to participate in a requirement: ${requirementTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello!</h2>
      <p>You have been invited by ${creatorName} to participate in the requirement: <strong>${requirementTitle}</strong>.</p>
      ${isExistingUser
        ? '<p>Please log in to view and participate in this requirement.</p>'
        : '<p>To get started, please create an account and join us!</p>'}
      <p>If you believe this is a mistake, you can safely ignore this email.</p>
      <p>Best regards,<br>${config.appName || 'BidMaster Team'}</p>
    </div>
  `;
  return { subject, html };
}

module.exports = {
  invitationEmail,
};
