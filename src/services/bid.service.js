const httpStatus = require('http-status');
const { Requirement, Bid } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Ensure requirement exists and is within time window
 */
async function getOpenRequirement(requirementId) {
  const requirement = await Requirement.findById(requirementId);
  if (!requirement) throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found');

  const now = new Date();
  if (now < requirement.startTime) throw new ApiError(httpStatus.FORBIDDEN, 'Bidding has not started yet');
  if (now > requirement.endTime) throw new ApiError(httpStatus.FORBIDDEN, 'Bidding has ended');

  return requirement;
}

/**
 * Check if user is allowed to bid (invited or public)
 */
function assertBidderEligibility(requirement, user) {
  // If no participants specified, it's public
  if (!requirement.participants || requirement.participants.length === 0) return;

  const isInvited = requirement.participants.some((p) => {
    if (p.userId && p.userId.toString() === user._id.toString()) return true;
    if (p.email && user.email && p.email.toLowerCase() === user.email.toLowerCase()) return true;
    return false;
  });
  if (!isInvited) throw new ApiError(httpStatus.FORBIDDEN, 'You are not invited to this requirement');
}

/**
 * Get current best (lowest) offered price for a requirement
 */
async function getCurrentBestPrice(requirementId) {
  const top = await Bid.find({ requirement: requirementId })
    .sort({ offeredPrice: 1 })
    .limit(1);
  return top.length ? top[0].offeredPrice : null;
}

/**
 * Enforce pricing rules: first bid <= ceilingPrice; subsequent bids <= best - minDecrement
 */
function assertPriceRules({ offeredPrice, ceilingPrice, minDecrement, currentBest }) {
  if (currentBest == null) {
    if (offeredPrice > ceilingPrice) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `First bid must be <= ceiling price (${ceilingPrice})`
      );
    }
  } else {
    const requiredMax = currentBest - minDecrement;
    if (offeredPrice > requiredMax) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Bid must be <= ${requiredMax} (best ${currentBest} - decrement ${minDecrement})`
      );
    }
  }
}

/**
 * Create a bid
 */
async function createBid({ user, requirementId, offeredPrice, deliveryDays, notes, attachments }) {
  const requirement = await getOpenRequirement(requirementId);

  if (requirement.createdBy.toString() === user._id.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Creator cannot bid on own requirement');
  }

  assertBidderEligibility(requirement, user);

  const currentBest = await getCurrentBestPrice(requirement._id);
  assertPriceRules({
    offeredPrice,
    ceilingPrice: requirement.ceilingPrice,
    minDecrement: requirement.minDecrement,
    currentBest,
  });

  const bid = await Bid.create({
    requirement: requirement._id,
    bidder: user._id,
    offeredPrice,
    deliveryDays: deliveryDays ?? null,
    notes: notes || '',
    attachments: attachments || [],
  });

  return bid;
}

/**
 * List bids for a requirement (buyer can view; seller can view own bids)
 */
async function listBids({ requirementId, user, options }) {
  // Basic access control: if requester is creator, allow; otherwise show only own bids
  const requirement = await Requirement.findById(requirementId);
  if (!requirement) throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found');

  const filter = { requirement: requirementId };
  if (requirement.createdBy.toString() !== user._id.toString()) {
    filter.bidder = user._id; // blind bidding for others
  }

  return Bid.paginate(filter, options);
}

module.exports = { createBid, listBids };
