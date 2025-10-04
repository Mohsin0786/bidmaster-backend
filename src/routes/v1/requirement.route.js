const express = require('express');

const validate = require('../../middlewares/validate');
const { firebaseAuth } = require('../../middlewares/firebaseAuth');
const { requirementValidation } = require('../../validations');
const { requirementController } = require('../../controllers');
const { fileUploadService } = require('../../microservices');

const router = express.Router();

// Create a requirement (bidding event)
router.post(
  '/',
  firebaseAuth('All'),
  fileUploadService.multerUpload.array('attachments'),
  validate(requirementValidation.createRequirement),
  requirementController.createRequirement
);

// List requirements
router.get('/', firebaseAuth('All'), validate(requirementValidation.getRequirements), requirementController.getRequirements);

// List invited ACTIVE requirements for current user (place BEFORE parameterized routes)
router.get(
  '/invited',
  firebaseAuth('All'),
  validate(requirementValidation.getInvitedRequirements),
  requirementController.getInvitedRequirements
);

// Get a single requirement
router.get(
  '/:requirementId',
  firebaseAuth('All'),
  validate(requirementValidation.getRequirement),
  requirementController.getRequirement
);

// Update a requirement
router.patch(
  '/:requirementId',
  firebaseAuth('All'),
  fileUploadService.multerUpload.array('attachments'),
  validate(requirementValidation.updateRequirement),
  requirementController.updateRequirement
);

// Delete a requirement
router.delete(
  '/:requirementId',
  firebaseAuth('All'),
  validate(requirementValidation.deleteRequirement),
  requirementController.deleteRequirement
);

module.exports = router;

