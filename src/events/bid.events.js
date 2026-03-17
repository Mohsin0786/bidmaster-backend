const { Bid } = require('../models');
const logger = require('../config/logger');
let ioRef = null;
function setIO(io) {
  ioRef = io;
}
function getIO() {
  if (!ioRef) throw new Error('Socket.IO not set in events. Call setIO(io) from socket init.');
  return ioRef;
}

/**
 * Emit a real-time event for a newly created bid to the requirement room
 *
 * @param {Object} params
 * @param {string} params.requirementId - Requirement ObjectId as string
 * @param {Object} params.bid - Minimal bid payload to send to clients
 * @param {string} params.bid._id
 * @param {string} params.bid.bidder
 * @param {number} params.bid.offeredPrice
 * @param {number|null} params.bid.deliveryDays
 * @param {string|Date} params.bid.createdAt
 * @param {number|null} params.currentBest - Latest best price after this bid
 * @param {number} params.rank - Rank of this bid among all bids for the requirement (1 = best)
 */
async function emitBidNew({ requirementId, bid, currentBest, rank }) {
  const io = getIO();
  const room = `auction:${requirementId}`;
  io.to(room).emit('bid:new', {
    requirementId,
    bid,
    currentBest,
    rank,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit a real-time event when an existing bid is updated
 *
 * @param {Object} params
 * @param {string} params.requirementId
 * @param {Object} params.bid
 * @param {number|null} params.currentBest
 * @param {number} params.rank
 */
async function emitBidUpdated({ requirementId, bid, currentBest, rank }) {
  const io = getIO();
  const room = `auction:${requirementId}`;
  io.to(room).emit('bid:updated', {
    requirementId,
    bid,
    currentBest,
    rank,
    timestamp: new Date().toISOString(),
  });
}

/**
 * For a requirement, recompute ranks for all bids and notify each bidder in their user room.
 * Emits event 'bid:rank' to room `user:<bidderId>` with { requirementId, rank, currentBest, myBid }.
 */
async function notifyAllBiddersRanks(requirementId) {
  const io = getIO();

  // Fetch all bids sorted by offeredPrice asc, createdAt asc for stable ranking
  const bids = await Bid.find({ requirement: requirementId })
    .sort({ offeredPrice: 1, createdAt: 1 })
    .select('_id bidder offeredPrice deliveryDays createdAt');
  logger.info('notifyAllBiddersRanks', requirementId, bids.length);
  if (!bids || bids.length === 0) return;
  const currentBest = bids[0]?.offeredPrice ?? null;

  for (let i = 0; i < bids.length; i += 1) {
    const b = bids[i];
    const rank = i + 1; // 1-based
    const room = `user:${b.bidder.toString()}`;
    // logger.info('bid:rank', requirementId, rank,b.bidder.toString());
    io.to(room).emit('bid:rank', {
      requirementId: requirementId.toString(),
      rank,
      currentBest,
      myBid: {
        _id: b._id.toString(),
        offeredPrice: b.offeredPrice,
        deliveryDays: b.deliveryDays,
        createdAt: b.createdAt,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Emit requirement stats (e.g., total unique bidders) to everyone in the requirement room.
 * Event: 'requirement:stats' with { requirementId, totalBidders }
 */
async function emitRequirementStats(requirementId) {
  const io = getIO();
  const room = `auction:${requirementId}`;
  const distinctBidders = await Bid.distinct('bidder', { requirement: requirementId });
  io.to(room).emit('requirement:stats', {
    requirementId: requirementId.toString(),
    totalBidders: distinctBidders.length,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { setIO, emitBidNew, emitBidUpdated, notifyAllBiddersRanks, emitRequirementStats };
