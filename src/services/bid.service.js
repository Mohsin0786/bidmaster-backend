const httpStatus = require('http-status');
const { Requirement, Bid } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const moment = require('moment-timezone');
const { emitBidNew, emitBidUpdated, notifyAllBiddersRanks, emitRequirementStats } = require('../events/bid.events');

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
    logger.info(`First bid: ${offeredPrice} <= ceiling price: ${ceilingPrice}`);
  } else {
    const requiredMax = currentBest - minDecrement;
    if (offeredPrice > requiredMax) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Bid must be <= ${requiredMax} (best ${currentBest} - decrement ${minDecrement})`
      );
    }
    logger.info(`Subsequent bid: ${offeredPrice} <= required max: ${requiredMax}`);
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

  // Reject if user already has a bid on this requirement
  const existing = await Bid.findOne({ requirement: requirement._id, bidder: user._id });
  if (existing) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot place bid: a bid for this requirement by this user already exists'
    );
  }

  const currentBest = await getCurrentBestPrice(requirement._id);
  logger.info(`Current best price for requirement ${requirement._id}: ${currentBest}`);
  assertPriceRules({
    offeredPrice,
    ceilingPrice: requirement.ceilingPrice,
    minDecrement: requirement.minDecrement,
    currentBest,
  });

  let bid;
  try {
    bid = await Bid.create({
      requirement: requirement._id,
      bidder: user._id,
      offeredPrice,
      deliveryDays: deliveryDays ?? null,
      notes: notes || '',
      attachments: attachments || [],
    });
  } catch (err) {
    // Handle duplicate key error from unique index (requirement, bidder)
    if (err && err.code === 11000) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot place bid: a bid for this requirement by this user already exists'
      );
    }
    throw err;
  }

  // Emit real-time update to the requirement room
  // try {
  //   const newBest = await getCurrentBestPrice(requirement._id);
  //   const rank = await getBidRank({
  //     requirementId: requirement._id,
  //     offeredPrice: bid.offeredPrice,
  //     createdAt: bid.createdAt,
  //   });
  //   await emitBidNew({
  //     requirementId: requirement._id.toString(),
  //     bid: {
  //       _id: bid._id.toString(),
  //       bidder: bid.bidder.toString(),
  //       offeredPrice: bid.offeredPrice,
  //       deliveryDays: bid.deliveryDays,
  //       createdAt: bid.createdAt,
  //     },
  //     currentBest: newBest,
  //     rank,
  //   });
  // Notify all bidders of their current rank and leading bid
  try { await notifyAllBiddersRanks(requirement._id); } catch (_) { }
  // Broadcast updated unique bidder count to the requirement room
  try { await emitRequirementStats(requirement._id); } catch (_) { }
  // } catch (e) {
  //   // Do not block API on socket errors
  //   logger.warn(`Socket emit failed for requirement ${requirement._id}: ${e.message}`);
  // }

  return bid;
}

/**
 * List bids for a requirement (buyer can view; seller can view own bids)
 */
async function listBids({ requirementId, user, options }) {

  const requirement = await Requirement.findById(requirementId);
  if (!requirement) throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found');
  if (requirement.createdBy.toString() !== user._id.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to view this requirement');
  }
  const filter = { requirement: requirementId };
  logger.info(`Listing bids for requirement ${requirementId} by user ${user._id}`);
  const populate = ['bidder::firstName,lastName,email'];
  const project = {
    requirement: 1,
    bidder: 1,
    offeredPrice: 1,
    deliveryDays: 1,
    notes: 1,
    attachments: 1,
    createdAt: 1,
    updatedAt: 1,
  };
  const paginateOptions = { ...options, populate, project };
  return Bid.paginate(filter, paginateOptions);
}

/**
 * Update a bid (only by its owner) within the bidding window
 */
async function updateBid({ user, bidId, offeredPrice, deliveryDays, notes, attachments }) {
  const bid = await Bid.findById(bidId);
  if (!bid) throw new ApiError(httpStatus.NOT_FOUND, 'Bid not found');

  if (bid.bidder.toString() !== user._id.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only update your own bid');
  }

  // Ensure requirement exists and is open
  const requirement = await getOpenRequirement(bid.requirement);

  // Compute current best excluding this bid
  const top = await Bid.find({ requirement: requirement._id, _id: { $ne: bid._id } })
    .sort({ offeredPrice: 1 })
    .limit(1);
  const currentBestExcludingSelf = top.length ? top[0].offeredPrice : null;

  assertPriceRules({
    offeredPrice,
    ceilingPrice: requirement.ceilingPrice,
    minDecrement: requirement.minDecrement,
    currentBest: currentBestExcludingSelf,
  });

  // Apply updates
  bid.offeredPrice = offeredPrice;
  if (deliveryDays != null) bid.deliveryDays = deliveryDays;
  if (typeof notes === 'string') bid.notes = notes;
  if (attachments) bid.attachments = attachments; // replace if provided

  await bid.save();
  // Emit update with current rank and best price
  // try {
  //   const newBest = await getCurrentBestPrice(requirement._id);
  // await emitBidUpdated({
  //   requirementId: requirement._id.toString(),
  //   bid: {
  //     _id: bid._id.toString(),
  //     bidder: bid.bidder.toString(),
  //     offeredPrice: bid.offeredPrice,
  //     deliveryDays: bid.deliveryDays,
  //     createdAt: bid.createdAt,
  //   },
  //   currentBest: newBest,
  // });
  // Notify all bidders of their current rank and leading bid
  try { await notifyAllBiddersRanks(requirement._id); } catch (e) {
    logger.error('Failed to notify ranks:', e);
  }
  // Broadcast updated unique bidder count to the requirement room
  // try { await emitRequirementStats(requirement._id); } catch (_) {}
  // } catch (e) {
  //   logger.warn(`Socket emit failed for bid update ${bid._id}: ${e.message}`);
  // }
  return bid;
}

/**
 * Get current user's bid for a requirement
 */
async function getMyBid({ requirementId, user }) {
  const requirement = await Requirement.findById(requirementId);
  if (!requirement) throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found');

  const bid = await Bid.findOne({ requirement: requirementId, bidder: user._id });
  if (!bid) throw new ApiError(httpStatus.NOT_FOUND, 'No bid found for this requirement by this user');
  return bid;
}

/**
 * List current user's bids with optional filters
 * - status: undefined => all my bids
 * - status: 'active' => bids where requirement is currently active (startTime <= now < endTime)
 * - status: 'won' => bids where requirement is ended and winningBid equals this bid's _id
 * - status: 'lost' => bids where requirement is ended and winningBid != this bid's _id and winningBid != null
 */
async function listMyBids({ user, status, options, timezone }) {
  const now = moment().tz(timezone).toDate();
  logger.info(`Current time in ${timezone}: ${now}`);
  const filters = { bidder: user._id };

  // Always populate requirement fields we need for filtering
  const populate = [
    'requirement::startTime,endTime,winningBid,title',
  ];

  // Post-population filters operate on populated fields
  const postPopulateFilters = {};

  if (status === 'active') {
    postPopulateFilters['requirement.startTime'] = { $lte: now };
    postPopulateFilters['requirement.endTime'] = { $gt: now };
  } else if (status === 'won') {
    // ended and this bid is the winner
    postPopulateFilters['requirement.endTime'] = { $lte: now };
    postPopulateFilters.$expr = { $eq: ['$requirement.winningBid', '$_id'] };
  } else if (status === 'lost') {
    // ended, there is a winner, and it's not this bid
    postPopulateFilters['requirement.endTime'] = { $lte: now };
    postPopulateFilters.$expr = {
      $and: [
        { $ne: ['$requirement.winningBid', null] },
        { $ne: ['$requirement.winningBid', '$_id'] },
      ],
    };
  }

  const project = {
    requirement: 1,
    bidder: 1,
    offeredPrice: 1,
    deliveryDays: 1,
    notes: 1,
    attachments: 1,
    createdAt: 1,
    updatedAt: 1,
  };

  const paginateOptions = { ...options, populate, project };

  if (Object.keys(postPopulateFilters).length > 0) {
    return Bid.paginate({ ...filters, postPopulateFilters }, paginateOptions);
  }
  return Bid.paginate(filters, paginateOptions);
}

/**
 * Get bid status for current user including rank, currentBest, and myBid
 * This mirrors the data sent via socket in notifyAllBiddersRanks
 */
async function getMyBidStatus({ requirementId, user }) {
  const requirement = await Requirement.findById(requirementId);
  if (!requirement) throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found');

  // Find user's bid
  const myBid = await Bid.findOne({ requirement: requirementId, bidder: user._id });
  if (!myBid) throw new ApiError(httpStatus.NOT_FOUND, 'No bid found for this requirement by this user');

  // Fetch all bids sorted by offeredPrice asc, createdAt asc for stable ranking
  const bids = await Bid.find({ requirement: requirementId })
    .sort({ offeredPrice: 1, createdAt: 1 })
    .select('_id bidder offeredPrice deliveryDays createdAt');

  if (!bids || bids.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No bids found for this requirement');
  }

  // Get currentBest (lowest offer)
  const currentBest = bids[0]?.offeredPrice ?? null;

  // Find user's rank
  let rank = null;
  for (let i = 0; i < bids.length; i += 1) {
    if (bids[i]._id.toString() === myBid._id.toString()) {
      rank = i + 1; // 1-based
      break;
    }
  }

  return {
    requirementId: requirementId.toString(),
    rank,
    currentBest,
    myBid: {
      _id: myBid._id.toString(),
      offeredPrice: myBid.offeredPrice,
      deliveryDays: myBid.deliveryDays,
      createdAt: myBid.createdAt,
    },
    totalBidders: bids.length,
  };
}

module.exports = { createBid, listBids, updateBid, getMyBid, listMyBids, getMyBidStatus };
