const {biddingQueue} = require('../queues/bidding.queue');
const {Requirement, Bid, User} = require('../../models');
const {REQUIREMENT_STATUS} = require('../../constants/requirement');
const {emailService} = require('../../microservices');
const logger = require('../../config/logger');
const {
  noBidsReceivedEmail,
  biddingEndedWithWinnerCreatorEmail,
  biddingWinnerEmail,
} = require('../../utils/emailTemplates');

/**
 * Process 'close-bidding' job
 * - Find winning bid (lowest offeredPrice)
 * - Update requirement status (CLOSED if no bids, AWARDED if winner exists)
 * - Send emails to creator and winner
 */
biddingQueue.process('close-bidding', async job => {
  const {requirementId} = job.data;
  logger.info(`Processing close-bidding job for requirement: ${requirementId}`);

  try {
    // 1. Fetch requirement with creator details
    const requirement = await Requirement.findById(requirementId).populate('createdBy', 'email firstName lastName');

    if (!requirement) {
      logger.warn(`Requirement ${requirementId} not found, skipping job`);
      return {success: false, reason: 'Requirement not found'};
    }

    // Skip if already closed or awarded
    if (requirement.status === REQUIREMENT_STATUS.CLOSED || requirement.status === REQUIREMENT_STATUS.AWARDED) {
      logger.info(`Requirement ${requirementId} already ${requirement.status}, skipping`);
      return {success: true, reason: `Already ${requirement.status}`};
    }

    // 2. Find winning bid (lowest offeredPrice, earliest createdAt as tiebreaker)
    const winningBid = await Bid.findOne({requirement: requirementId})
      .sort({offeredPrice: 1, createdAt: 1})
      .populate('bidder', 'email firstName lastName')
      .lean();

    // 3. Update requirement status
    if (!winningBid) {
      // No bids received
      requirement.status = REQUIREMENT_STATUS.CLOSED;
      requirement.winningBid = null;
      await requirement.save();
      logger.info(`Requirement ${requirementId} closed with no bids`);

      // 4. Send email to creator (no bids)
      if (requirement.createdBy?.email) {
        try {
          const { subject, html } = noBidsReceivedEmail({
  creatorName: requirement.createdBy.firstName,
  requirementTitle: requirement.title,
});
await emailService.sendEmail(requirement.createdBy.email, subject, { html });
          logger.info(`No-bids email sent to creator: ${requirement.createdBy.email}`);
        } catch (emailErr) {
          logger.error(`Failed to send no-bids email to creator: ${emailErr.message}`);
        }
      }

      return {success: true, status: 'CLOSED', bids: 0};
    }

    // Winner exists
    requirement.status = REQUIREMENT_STATUS.AWARDED;
    requirement.winningBid = winningBid._id;
    await requirement.save();
    logger.info(`Requirement ${requirementId} awarded to bidder ${winningBid.bidder._id}`);

    // 5. Send email to creator (with winner details)
    if (requirement.createdBy?.email) {
      try {
        const { subject: creatorSubject, html: creatorHtml } = biddingEndedWithWinnerCreatorEmail({
  creatorName: requirement.createdBy.firstName,
  requirementTitle: requirement.title,
  winnerName: `${winningBid.bidder.firstName || ''} ${winningBid.bidder.lastName || ''}`.trim(),
  winnerEmail: winningBid.bidder.email,
  winningBid: winningBid.offeredPrice,
  currency: requirement.currency,
  deliveryDays: winningBid.deliveryDays,
});
await emailService.sendEmail(requirement.createdBy.email, creatorSubject, { html: creatorHtml });
        logger.info(`Winner notification email sent to creator: ${requirement.createdBy.email}`);
      } catch (emailErr) {
        logger.error(`Failed to send winner email to creator: ${emailErr.message}`);
      }
    }

    // 6. Send email to winner
    if (winningBid.bidder?.email) {
      try {
        const { subject: winnerSubject, html: winnerHtml } = biddingWinnerEmail({
  bidderName: winningBid.bidder.firstName,
  requirementTitle: requirement.title,
  winningBid: winningBid.offeredPrice,
  currency: requirement.currency,
  deliveryDays: winningBid.deliveryDays,
  creatorName: `${requirement.createdBy.firstName || ''} ${requirement.createdBy.lastName || ''}`.trim(),
  creatorEmail: requirement.createdBy.email,
});
await emailService.sendEmail(winningBid.bidder.email, winnerSubject, { html: winnerHtml });
        logger.info(`Congratulations email sent to winner: ${winningBid.bidder.email}`);
      } catch (emailErr) {
        logger.error(`Failed to send congratulations email to winner: ${emailErr.message}`);
      }
    }

    return {
      success: true,
      status: 'AWARDED',
      winningBid: {
        bidderId: winningBid.bidder._id,
        offeredPrice: winningBid.offeredPrice,
      },
    };
  } catch (error) {
    logger.error(`Error processing close-bidding job for ${requirementId}:`, error);
    throw error; // Bull will retry based on attempts config
  }
});

/**
 * Startup recovery: close any ACTIVE requirements whose endTime has already passed.
 * This handles cases where the server was down when the Bull job was supposed to fire.
 */
async function recoverExpiredRequirements() {
  try {
    const now = new Date();
    const expired = await Requirement.find({
      status: REQUIREMENT_STATUS.ACTIVE,
      endTime: { $lte: now },
    }).lean();

    if (expired.length === 0) {
      logger.info('Startup recovery: no expired requirements found');
      return;
    }

    logger.info(`Startup recovery: found ${expired.length} expired requirement(s), queuing close-bidding jobs`);

    for (const req of expired) {
      await biddingQueue.add(
        'close-bidding',
        { requirementId: req._id.toString() },
        { jobId: `close-bidding-recovery-${req._id}` }
      );
    }
  } catch (err) {
    logger.error('Startup recovery error:', err);
  }
}

// Run recovery after a short delay to ensure DB connection is ready
setTimeout(recoverExpiredRequirements, 5000);

logger.info('Bidding worker initialized and listening for jobs');

module.exports = {biddingQueue};
