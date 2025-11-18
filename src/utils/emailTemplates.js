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

function noBidsReceivedEmail({ creatorName, requirementTitle }) {
  const subject = `Bidding Ended: ${requirementTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${creatorName || 'there'},</h2>
      <p>Your requirement "${requirementTitle}" has ended.</p>
      <p>Unfortunately, no bids were received for this requirement.</p>
      <p>You can create a new requirement or modify the existing one to attract more bidders.</p>
      <p>Best regards,<br>${config.appName || 'BiddingMaster Team'}</p>
    </div>
  `;
  return { subject, html };
}

function biddingEndedWithWinnerCreatorEmail({ creatorName, requirementTitle, winnerName, winnerEmail, winningBid, currency, deliveryDays }) {
  const subject = `Bidding Ended: ${requirementTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${creatorName || 'there'},</h2>
      <p>Your requirement "${requirementTitle}" has ended successfully!</p>
      <h3>Winner Details:</h3>
      <ul>
        <li><strong>Name:</strong> ${winnerName}</li>
        <li><strong>Email:</strong> ${winnerEmail}</li>
        <li><strong>Winning Bid:</strong> ${currency || 'INR'} ${winningBid}</li>
        ${deliveryDays ? `<li><strong>Delivery Days:</strong> ${deliveryDays}</li>` : ''}
      </ul>
      <p>You can now proceed to contact the winner and finalize the deal.</p>
      <p>Best regards,<br>${config.appName || 'BiddingMaster Team'}</p>
    </div>
  `;
  return { subject, html };
}

function biddingWinnerEmail({ bidderName, requirementTitle, winningBid, currency, deliveryDays, creatorName, creatorEmail }) {
  const subject = `Congratulations! You Won: ${requirementTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${bidderName || 'there'},</h2>
      <p>Congratulations! You have won the bid for "${requirementTitle}"!</p>
      <ul>
        <li><strong>Your Winning Bid:</strong> ${currency || 'INR'} ${winningBid}</li>
        ${deliveryDays ? `<li><strong>Delivery Days:</strong> ${deliveryDays}</li>` : ''}
      </ul>
      <h3>Creator Contact:</h3>
      <ul>
        <li><strong>Name:</strong> ${creatorName}</li>
        <li><strong>Email:</strong> ${creatorEmail}</li>
      </ul>
      <p>The requirement creator will contact you soon to finalize the details.</p>
      <p>Best regards,<br>${config.appName || 'BiddingMaster Team'}</p>
    </div>
  `;
  return { subject, html };
}

module.exports = {
  invitationEmail,
  noBidsReceivedEmail,
  biddingEndedWithWinnerCreatorEmail,
  biddingWinnerEmail,
};
