const httpStatus = require('http-status');
const { Requirement } = require('../models');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Create a requirement
 * @param {Object} requirementBody
 * @param {string} userId - ID of the user creating the requirement
 * @returns {Promise<Requirement>}
 */
const createRequirement = async (requirementBody, userId) => {
  const { participantEmails, ...requirementData } = requirementBody;

  // Process participant emails
  const participants = [];
  if (participantEmails && participantEmails.length > 0) {
    for (const email of participantEmails) {
      // Check if user exists
      const user = await User.findOne({ email });
      
      if (user) {
        // User exists - store their ID
        participants.push({
          email,
          userId: user._id,
          status: 'INVITED',
        });
        logger.info(`Participant ${email} found and invited (userId: ${user._id})`);
      } else {
        // User doesn't exist yet - just store email
        participants.push({
          email,
          userId: null,
          status: 'INVITED',
        });
        logger.info(`Participant ${email} invited (not yet registered)`);
      }
    }
  }

  // Create the requirement
  const requirement = await Requirement.create({
    ...requirementData,
    participants,
    createdBy: userId,
  });

  return requirement;
};

/**
 * Query for requirements
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
const queryRequirements = async (filter, options) => {
  const requirements = await Requirement.paginate(filter, options);
  return requirements;
};

/**
 * Get requirement by id
 * @param {ObjectId} id
 * @returns {Promise<Requirement>}
 */
const getRequirementById = async (id) => {
  const requirement = await Requirement.findById(id).populate('createdBy', 'firstName lastName email');
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found');
  }
  return requirement;
};

/**
 * Update requirement by id
 * @param {ObjectId} requirementId
 * @param {Object} updateBody
 * @param {string} userId - ID of the user making the update
 * @returns {Promise<Requirement>}
 */
const updateRequirementById = async (requirementId, updateBody, userId) => {
  const requirement = await getRequirementById(requirementId);

  // Check if user is the creator
  if (requirement.createdBy._id.toString() !== userId.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only update your own requirements');
  }

  // Process participant emails if provided
  if (updateBody.participantEmails) {
    const participants = [];
    for (const email of updateBody.participantEmails) {
      const user = await User.findOne({ email });
      participants.push({
        email,
        userId: user ? user._id : null,
        status: 'INVITED',
      });
    }
    updateBody.participants = participants;
    delete updateBody.participantEmails;
  }

  Object.assign(requirement, updateBody);
  await requirement.save();
  return requirement;
};

/**
 * Delete requirement by id
 * @param {ObjectId} requirementId
 * @param {string} userId - ID of the user making the deletion
 * @returns {Promise<Requirement>}
 */
const deleteRequirementById = async (requirementId, userId) => {
  const requirement = await getRequirementById(requirementId);

  // Check if user is the creator
  if (requirement.createdBy._id.toString() !== userId.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only delete your own requirements');
  }

  await requirement.remove();
  return requirement;
};

module.exports = {
  createRequirement,
  queryRequirements,
  getRequirementById,
  updateRequirementById,
  deleteRequirementById,
};
