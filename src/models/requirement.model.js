const mongoose = require('mongoose');
const { paginate } = require('./plugins/paginate');
const { REQUIREMENT_STATUS, PARTICIPANT_STATUS } = require('../constants/requirement');

const requirementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    attachments: [
      {
        key: String,
        url: String,
      },
    ],
    currency: {
      type: String,
      required: true,
      trim: true,
      default: 'INR',
    },
    ceilingPrice: {
      type: Number,
      required: true,
    },
    minDecrement: {
      type: Number,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    participants: [
      {
        email: {
          type: String,
          required: true,
        },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
        status: {
          type: String,
          enum: Object.values(PARTICIPANT_STATUS),
          default: PARTICIPANT_STATUS.INVITED,
        },
      },
    ],
    status: {
      type: String,
      enum: Object.values(REQUIREMENT_STATUS),
      default: REQUIREMENT_STATUS.DRAFT,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    winningBid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bid',
      default: null,
    },
  },
  { timestamps: true }
);

requirementSchema.plugin(paginate);

const Requirement = mongoose.model('Requirement', requirementSchema);

module.exports = {
  Requirement,
};
