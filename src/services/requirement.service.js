const httpStatus = require('http-status');
const { Requirement } = require('../models');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const moment = require('moment-timezone');
const { REQUIREMENT_STATUS, PARTICIPANT_STATUS } = require('../constants/requirement');
const { biddingQueue } = require('../jobs');

/**
 * Create a requirement
 * @param {Object} requirementBody
 * @param {string} userId - ID of the user creating the requirement
 * @returns {Promise<Requirement>}
 */
const createRequirement = async (requirementBody, userId) => {
  const { participantEmails, status, ...rest } = requirementBody;

  let participants = [];
  // Only prepare participant invitations for ACTIVE requirements
  if (status !== REQUIREMENT_STATUS.DRAFT && participantEmails && participantEmails.length > 0) {
    for (const email of participantEmails) {
      const user = await User.findOne({ email });
      participants.push({
        email,
        userId: user ? user._id : null,
        status: PARTICIPANT_STATUS.INVITED,
      });
      logger.info(
        `Participant ${email} ${user ? `found (userId: ${user._id})` : 'invited (not yet registered)'}.`
      );
    }
  }
  logger.info('Requirement created successfully');

  const requirement = await Requirement.create({
    ...rest,
    status: status || REQUIREMENT_STATUS.DRAFT,
    participants,
    createdBy: userId,
  });

  // Schedule job to close bidding at endTime if status is ACTIVE
  if (requirement.status === REQUIREMENT_STATUS.ACTIVE && requirement.endTime) {
    const delay = new Date(requirement.endTime).getTime() - Date.now();
    if (delay > 0) {
      await biddingQueue.add(
        'close-bidding',
        { requirementId: requirement._id.toString() },
        { delay, jobId: `close-bidding-${requirement._id}` }
      );
      logger.info(`Scheduled close-bidding job for requirement ${requirement._id} at ${requirement.endTime}`);
    }
  }

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

  // If status transitioning to ACTIVE, enforce completeness and process participant invitations
  const isActivating = updateBody.status === REQUIREMENT_STATUS.ACTIVE && requirement.status !== REQUIREMENT_STATUS.ACTIVE;

  logger.info(`Requirement ${requirementId} is being updated by ${userId}`);
  // Handle participant emails only when activating or already ACTIVE
  if (updateBody.participantEmails && (isActivating || requirement.status === REQUIREMENT_STATUS.ACTIVE)) {
    const participants = [];
    for (const email of updateBody.participantEmails) {
      const user = await User.findOne({ email });
      participants.push({
        email,
        userId: user ? user._id : null,
        status: PARTICIPANT_STATUS.INVITED,
      });
    }
    logger.info('Participant emails processed successfully');
    updateBody.participants = participants;
    delete updateBody.participantEmails;
  } else {
    // ignore participantEmails updates while in DRAFT
    delete updateBody.participantEmails;
  }
  logger.info('Requirement updated successfully');

  Object.assign(requirement, updateBody);

  if (isActivating) {
    // Ensure required fields are present before activation
    const missing = [];
    if (!requirement.title) missing.push('title');
    if (!requirement.description) missing.push('description');
    if (!requirement.currency) missing.push('currency');
    if (requirement.ceilingPrice == null) missing.push('ceilingPrice');
    if (requirement.minDecrement == null) missing.push('minDecrement');
    if (!requirement.startTime) missing.push('startTime');
    if (!requirement.endTime) missing.push('endTime');
    if (missing.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot activate requirement. Missing fields: ${missing.join(', ')}`
      );
    }
    if (new Date(requirement.endTime) <= new Date(requirement.startTime)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'endTime must be greater than startTime');
    }
  }

  await requirement.save();

  // Handle job scheduling for status transitions
  if (isActivating && requirement.endTime) {
    // Schedule close-bidding job when transitioning to ACTIVE
    const delay = new Date(requirement.endTime).getTime() - Date.now();
    if (delay > 0) {
      await biddingQueue.add(
        'close-bidding',
        { requirementId: requirement._id.toString() },
        { delay, jobId: `close-bidding-${requirement._id}` }
      );
      logger.info(`Scheduled close-bidding job for requirement ${requirement._id} at ${requirement.endTime}`);
    }
  } else if (requirement.status === REQUIREMENT_STATUS.ACTIVE && updateBody.endTime) {
    // If endTime is updated while ACTIVE, reschedule the job
    try {
      const existingJob = await biddingQueue.getJob(`close-bidding-${requirement._id}`);
      if (existingJob) {
        await existingJob.remove();
        logger.info(`Removed old close-bidding job for requirement ${requirement._id}`);
      }
    } catch (err) {
      logger.warn(`Could not remove old job: ${err.message}`);
    }
    
    const delay = new Date(requirement.endTime).getTime() - Date.now();
    if (delay > 0) {
      await biddingQueue.add(
        'close-bidding',
        { requirementId: requirement._id.toString() },
        { delay, jobId: `close-bidding-${requirement._id}` }
      );
      logger.info(`Rescheduled close-bidding job for requirement ${requirement._id} at ${requirement.endTime}`);
    }
  }

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

  // Remove scheduled job if exists
  try {
    const existingJob = await biddingQueue.getJob(`close-bidding-${requirementId}`);
    if (existingJob) {
      await existingJob.remove();
      logger.info(`Removed close-bidding job for deleted requirement ${requirementId}`);
    }
  } catch (err) {
    logger.warn(`Could not remove job for deleted requirement: ${err.message}`);
  }

  await requirement.remove();
  return requirement;
};

/**
 * List ACTIVE requirements where the current user is invited
 * @param {Object} user - current user (expects _id and email)
 * @param {Object} options - pagination/sort options
 * @returns {Promise<QueryResult>}
 */
const createBaseInvitedFilter = (user) => ({
  $or: [
    { 'participants.userId': user._id },
    ...(user.email ? [{ 'participants.email': user.email }] : [])
  ]
});

const createTimeFilters = (now) => ({
  live: {
    startTime: { $lte: now },
    endTime: { $gt: now }
  },
  upcoming: {
    startTime: { $gt: now }
  },
  all: {} // No time filters for 'all'
});

const listInvitedActiveRequirements = async (user, options, window = 'all', timezone) => {
  const now = moment().tz(timezone).toDate();
  logger.info(`Current time in ${timezone}: ${now}`);
  const baseInvited = createBaseInvitedFilter(user);
  const timeFilters = createTimeFilters(now);
  logger.info(`Time filters: ${JSON.stringify(timeFilters)}`);
  const filter = {
    status: REQUIREMENT_STATUS.ACTIVE,
    ...baseInvited,
    ...(timeFilters[window] || timeFilters.all)
  };
  logger.info(`Filter: ${JSON.stringify(filter)}`);

  // Ensure createdBy is populated with basic identity fields using plugin's string format
  const populate = 'createdBy::firstName,lastName';

  // Add pipeline to compute totalBidders (distinct bidders who placed a bid on this requirement)
  const pipeline = [
    {
      $lookup: {
        from: 'bids',
        localField: '_id',
        foreignField: 'requirement',
        as: 'bids_for_req',
      },
    },
    {
      $addFields: {
        totalBidders: {
          $size: {
            $setUnion: [
              {
                $map: { input: '$bids_for_req', as: 'b', in: '$$b.bidder' },
              },
              [],
            ],
          },
        },
      },
    },
    { $unset: 'bids_for_req' },
  ];

  const project = {
    title: 1,
    category: 1,
    startTime: 1,
    endTime: 1,
    createdBy: 1,
    createdAt: 1,
    ceilingPrice: 1,
    totalBidders: 1,
  }; // only include these

  const paginateOptions = { ...options, populate, project, pipeline };
  return Requirement.paginate(filter, paginateOptions);
};
module.exports = {
  createRequirement,
  queryRequirements,
  getRequirementById,
  updateRequirementById,
  deleteRequirementById,
  listInvitedActiveRequirements,
};
