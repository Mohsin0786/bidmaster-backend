const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { requirementService } = require('../services');
const { fileUploadService } = require('../microservices');

// POST /v1/requirements
const createRequirement = catchAsync(async (req, res) => {
  // Handle attachments if provided via multipart/form-data
  let attachments = [];
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    attachments = await fileUploadService.s3Upload(req.files, 'requirements');
  }

  const payload = {
    ...req.body,
    attachments,
  };

  // participantEmails may come as comma-separated string from form-data
  if (typeof payload.participantEmails === 'string') {
    payload.participantEmails = payload.participantEmails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
  }

  const requirement = await requirementService.createRequirement(payload, req.user._id);
  res.status(httpStatus.CREATED).json({ data: requirement, status: true });
});

// GET /v1/requirements
const getRequirements = catchAsync(async (req, res) => {
  const { query } = req;
  const filter = {};
  const timezone = req.get('X-Timezone') || 'UTC';
  if (query.title) filter.title = new RegExp(query.title, 'i');
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;


  const options = {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    populate: 'createdBy::firstName,lastName,email',
  };

  const data = await requirementService.queryRequirements(filter, options, timezone);
  res.json({ data });
});

// GET /v1/requirements/:requirementId
const getRequirement = catchAsync(async (req, res) => {
  const requirement = await requirementService.getRequirementById(req.params.requirementId);
  res.json({ data: requirement, status: true });
});

// PATCH /v1/requirements/:requirementId
const updateRequirement = catchAsync(async (req, res) => {
  // Optional: handle re-uploads of attachments (append)
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    const uploads = await fileUploadService.s3Upload(req.files, 'requirements');
    req.body.attachments = [...(req.body.attachments || []), ...uploads];
  }

  if (typeof req.body.participantEmails === 'string') {
    req.body.participantEmails = req.body.participantEmails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
  }

  const requirement = await requirementService.updateRequirementById(
    req.params.requirementId,
    req.body,
    req.user._id
  );
  res.json({ data: requirement, status: true });
});

// DELETE /v1/requirements/:requirementId
const deleteRequirement = catchAsync(async (req, res) => {
  await requirementService.deleteRequirementById(req.params.requirementId, req.user._id);
  res.status(httpStatus.NO_CONTENT).send();
});



// GET /v1/requirements/invited
const getInvitedRequirements = catchAsync(async (req, res) => {
  const { sortBy, sortOrder, page, limit, window } = req.query;
  const options = { sortBy, sortOrder, page, limit };
  const timezone = req.get('X-Timezone') || 'UTC';
  const result = await requirementService.listInvitedActiveRequirements(req.user, options, window, timezone);
  return res.json({ data: result, status: true });
});



module.exports = {
  createRequirement,
  getRequirements,
  getRequirement,
  updateRequirement,
  deleteRequirement,
  getInvitedRequirements,
};
