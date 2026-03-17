const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { bidService } = require('../services');
const { fileUploadService } = require('../microservices');
const logger = require('../config/logger');

// POST /v1/bids
const createBid = catchAsync(async (req, res) => {
  let attachments = [];
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    attachments = await fileUploadService.s3Upload(req.files, 'bids');
  }

  const { requirementId, offeredPrice, deliveryDays, notes } = req.body;
  const bid = await bidService.createBid({
    user: req.user,
    requirementId,
    offeredPrice: Number(offeredPrice),
    deliveryDays: deliveryDays != null ? Number(deliveryDays) : undefined,
    notes,
    attachments,
  });

  logger.info(`Bid created successfully for requirement ${requirementId} by user ${req.user._id}`);

  res.status(httpStatus.CREATED).json({ data: bid });
});

// GET /v1/bids?requirementId=...
const listBids = catchAsync(async (req, res) => {
  const { requirementId, sortBy, sortOrder, page, limit } = req.query;
  const options = { sortBy, sortOrder, page, limit };
  const data = await bidService.listBids({ requirementId, user: req.user, options });
  res.json({ data });
});

// PATCH /v1/bids/:bidId
const updateBid = catchAsync(async (req, res) => {
  let attachments;
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    attachments = await fileUploadService.s3Upload(req.files, 'bids');
  }

  const { bidId } = req.params;
  const { offeredPrice, deliveryDays, notes } = req.body;

  const bid = await bidService.updateBid({
    user: req.user,
    bidId,
    offeredPrice: Number(offeredPrice),
    deliveryDays: deliveryDays != null ? Number(deliveryDays) : undefined,
    notes,
    attachments,
  });
  logger.info(`Bid updated successfully for requirement ${bid.requirement} by user ${req.user._id}`);

  res.json({ data: bid });
});


const getMyBid = catchAsync(async (req, res) => {
  const { requirementId } = req.query;
  const bid = await bidService.getMyBid({ requirementId, user: req.user });
  res.json({ data: bid });
});

// GET /v1/bids/my-bids?status=active|won|lost
const listMyBids = catchAsync(async (req, res) => {
  const { status, sortBy, sortOrder, page, limit } = req.query;
  const options = { sortBy, sortOrder, page, limit };
  const timezone = req.get('X-Timezone') || 'UTC';
  const data = await bidService.listMyBids({ user: req.user, status, options, timezone });
  res.json({ data });
});


// GET /v1/bids/my-status?requirementId=...
const getMyBidStatus = catchAsync(async (req, res) => {
  const { requirementId } = req.query;
  const status = await bidService.getMyBidStatus({ requirementId, user: req.user });
  res.json({ data: status });
});

module.exports = { createBid, listBids, updateBid, getMyBid, listMyBids, getMyBidStatus };

