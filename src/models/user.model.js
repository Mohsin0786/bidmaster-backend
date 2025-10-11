const mongoose = require('mongoose');
const {paginate} = require('./plugins/paginate');
const {USER_ROLES} = require('../constants/user');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    gstNo: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    industry: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      required: true,
    },
    email: {
      type: String,
      trim: true,
      required: true,
    },
    profilePic: {
      type: {
        key: String,
        url: String,
      },
      default: null,
    },
    dob: {
      type: Date,
      required: true,
    },
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
    },
    firebaseSignInProvider: {
      type: String,
      required: true,
    },
    roles: {
      type: [String],
      enum: Object.values(USER_ROLES),
      default: [USER_ROLES.BUYER, USER_ROLES.SELLER],
    },
    appNotificationsLastSeenAt: {
      type: Date,
      default: Date.now,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    preferences: {
      type: {
        notificationEnabled: Boolean,
        locationShared: Boolean,
      },
      default: {
        notificationEnabled: false,
        locationShared: false,
      },
    },
  },
  {timestamps: true}
);

userSchema.plugin(paginate);

const User = mongoose.model('User', userSchema);

module.exports = {
  User,
};
