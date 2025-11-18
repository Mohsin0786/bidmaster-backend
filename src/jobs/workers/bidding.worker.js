const { biddingQueue } = require('../queues/bidding.queue');
const { Requirement, Bid, User } = require('../../models');
const { REQUIREMENT_STATUS } = require('../../constants/requirement');
const { emailService } = require('../../microservices');
const logger = require('../../config/logger');

/**
 * Process 'close-bidding' job
 * - Find winning bid (lowest offeredPrice)
 * - Update requirement status (CLOSED if no bids, AWARDED if winner exists)
 * - Send emails to creator and winner
 */
biddingQueue.process('close-bidding', async (job) => {
  const { requirementId } = job.data;
  logger.info(`Processing close-bidding job for requirement: ${requirementId}`);

  try {
    // 1. Fetch requirement with creator details
    const requirement = await Requirement.findById(requirementId).populate('createdBy', 'email firstName lastName');

    if (!requirement) {
      logger.warn(`Requirement ${requirementId} not found, skipping job`);
      return { success: false, reason: 'Requirement not found' };
    }

    // Skip if already closed or awarded
    if (requirement.status === REQUIREMENT_STATUS.CLOSED || requirement.status === REQUIREMENT_STATUS.AWARDED) {
      logger.info(`Requirement ${requirementId} already ${requirement.status}, skipping`);
      return { success: true, reason: `Already ${requirement.status}` };
    }

    // 2. Find winning bid (lowest offeredPrice, earliest createdAt as tiebreaker)
    const winningBid = await Bid.findOne({ requirement: requirementId })
      .sort({ offeredPrice: 1, createdAt: 1 })
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
          await emailService.sendEmail(
            requirement.createdBy.email,
            `Bidding Ended: ${requirement.title}`,
            {
              text: `Hello ${requirement.createdBy.firstName || 'there'},

Your requirement "${requirement.title}" has ended.

Unfortunately, no bids were received for this requirement.

You can create a new requirement or modify the existing one to attract more bidders.

Best regards,
BiddingMaster Team`,
            }
          );
          logger.info(`No-bids email sent to creator: ${requirement.createdBy.email}`);
        } catch (emailErr) {
          logger.error(`Failed to send no-bids email to creator: ${emailErr.message}`);
        }
      }

      return { success: true, status: 'CLOSED', bids: 0 };
    }

    // Winner exists
    requirement.status = REQUIREMENT_STATUS.AWARDED;
    requirement.winningBid = winningBid._id;
    await requirement.save();
    logger.info(`Requirement ${requirementId} awarded to bidder ${winningBid.bidder._id}`);

    // 5. Send email to creator (with winner details)
    if (requirement.createdBy?.email) {
      try {
        await emailService.sendEmail(
          requirement.createdBy.email,
          `Bidding Ended: ${requirement.title}`,
          {
            text: `Hello ${requirement.createdBy.firstName || 'there'},

Your requirement "${requirement.title}" has ended successfully!

Winner Details:
- Name: ${winningBid.bidder.firstName || ''} ${winningBid.bidder.lastName || ''}
- Email: ${winningBid.bidder.email}
- Winning Bid: ${requirement.currency || 'INR'} ${winningBid.offeredPrice}
${winningBid.deliveryDays ? `- Delivery Days: ${winningBid.deliveryDays}` : ''}

You can now proceed to contact the winner and finalize the deal.

Best regards,
BiddingMaster Team`,
          }
        );
        logger.info(`Winner notification email sent to creator: ${requirement.createdBy.email}`);
      } catch (emailErr) {
        logger.error(`Failed to send winner email to creator: ${emailErr.message}`);
      }
    }

    // 6. Send email to winner
    if (winningBid.bidder?.email) {
      try {
        await emailService.sendEmail(
          winningBid.bidder.email,
          `Congratulations! You Won: ${requirement.title}`,
          {
            text: `Hello ${winningBid.bidder.firstName || 'there'},

Congratulations! You have won the bid for "${requirement.title}"!

Your Winning Bid: ${requirement.currency || 'INR'} ${winningBid.offeredPrice}
${winningBid.deliveryDays ? `Delivery Days: ${winningBid.deliveryDays}` : ''}

The requirement creator will contact you soon to finalize the details.

Creator Contact:
- Name: ${requirement.createdBy.firstName || ''} ${requirement.createdBy.lastName || ''}
- Email: ${requirement.createdBy.email}

Best regards,
BiddingMaster Team`,
          }
        );
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

logger.info('Bidding worker initialized and listening for jobs');

module.exports = { biddingQueue };
