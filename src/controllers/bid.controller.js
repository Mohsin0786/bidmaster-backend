const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { bidService } = require('../services');
const { fileUploadService } = require('../microservices');

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

  res.status(httpStatus.CREATED).json({ data: bid });
});

// GET /v1/bids?requirementId=...
const listBids = catchAsync(async (req, res) => {
  const { requirementId, sortBy, sortOrder, page, limit } = req.query;
  const options = { sortBy, sortOrder, page, limit };
  const data = await bidService.listBids({ requirementId, user: req.user, options });
  res.json({ data });
});

module.exports = { createBid, listBids };
