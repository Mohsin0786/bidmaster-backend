const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const {userService} = require('../services');

const getMe = catchAsync(async (req, res) => {
  // req.user is set by firebaseAuth middleware after validation
  const user = await userService.getUserById(req.user._id);
  res.status(httpStatus.OK).json({data: user});
});

const updateUser = catchAsync(async (req, res) => {
  const updatedUser = await userService.updateUserById(req.user._id, req.body, req.file);
  res.status(httpStatus.OK).json({data: updatedUser, message: 'Your details are updated'});
});
const updatePreferences = catchAsync(async (req, res) => {
  const updatedUser = await userService.updatePreferencesById(req.user._id, req.body);
  res.status(httpStatus.OK).json({data: updatedUser, message: 'Your preferences are updated'});
});

const softDeleteUser = catchAsync(async (req, res) => {
  const {userId} = req.params;
  if (req.user.__t !== 'Admin' && userId !== req.user._id.toString()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Sorry, you are not authorized to do this');
  }
  await userService.markUserAsDeletedById(req.params.userId);
  res.status(httpStatus.OK).json({
    message: 'User has been removed successfully.',
  });
});

const deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUserById(req.params.userId);
  res.status(httpStatus.OK).json({message: 'The user deletion process has been completed successfully.'});
});

module.exports = {
  getMe,
  deleteUser,
  updateUser,
  softDeleteUser,
  updatePreferences,
};
