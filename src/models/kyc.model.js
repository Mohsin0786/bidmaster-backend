const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  aadhaarNumber: {
    type: String,
    required: true,
    unique: true, // optional, if you want uniqueness
  },
  panNumber: {
    type: String,
    required: true,
    unique: true, // optional
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  aadhaarFront: {
    key: String,
    url: String,
  },
  aadhaarBack: {
    key: String,
    url: String,
  },
  panCard: {
    key: String,
    url: String,
  },
  photo: {
    key: String,
    url: String,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

const KYC = mongoose.model('KYC', kycSchema);

module.exports = KYC;
