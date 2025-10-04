const express = require('express');

const validate = require('../../middlewares/validate');
const { firebaseAuth } = require('../../middlewares/firebaseAuth');
const { bidValidation } = require('../../validations');
const { bidController } = require('../../controllers');
const { fileUploadService } = require('../../microservices');

const router = express.Router();

// Create a bid on a requirement
router.post(
  '/',
  firebaseAuth('All'),
  fileUploadService.multerUpload.array('attachments'),
  validate(bidValidation.createBid),
  bidController.createBid
);

// List bids for a requirement (creator sees all, others see own bids)
router.get('/', firebaseAuth('All'), validate(bidValidation.listBids), bidController.listBids);

// Update an existing bid
router.patch(
  '/:bidId',
  firebaseAuth('All'),
  fileUploadService.multerUpload.array('attachments'),
  validate(bidValidation.updateBid),
  bidController.updateBid
);

// Get my bid for a requirement
router.get('/my', firebaseAuth('All'), validate(bidValidation.getMyBid), bidController.getMyBid);



module.exports = router;
