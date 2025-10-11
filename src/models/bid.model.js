const mongoose = require('mongoose');
const { paginate } = require('./plugins/paginate');

const bidSchema = new mongoose.Schema(
  {
    requirement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Requirement',
      required: true,
      index: true,
    },
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    offeredPrice: {
      type: Number,
      required: true,
    },
    deliveryDays: {
      type: Number, // optional business field
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    attachments: [
      {
        key: String,
        url: String,
      },
    ],
  },
  { timestamps: true }
);

bidSchema.index({ requirement: 1, offeredPrice: 1 });

bidSchema.plugin(paginate);

const Bid = mongoose.model('Bid', bidSchema);

module.exports = { Bid };
