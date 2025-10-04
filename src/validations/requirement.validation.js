const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createRequirement = {
  body: Joi.object()
    .keys({
      status: Joi.string().valid('DRAFT', 'ACTIVE').default('DRAFT'),
      title: Joi.string().trim().required(),
      description: Joi.string()
        .trim()
        .when('status', { is: 'ACTIVE', then: Joi.required(), otherwise: Joi.optional() }),
      category: Joi.string().trim().optional(),
      currency: Joi.string()
        .trim()
        .default('INR')
        .when('status', { is: 'ACTIVE', then: Joi.required(), otherwise: Joi.optional() }),
      ceilingPrice: Joi.number()
        .positive()
        .when('status', { is: 'ACTIVE', then: Joi.required(), otherwise: Joi.optional() }),
      minDecrement: Joi.number()
        .positive()
        .when('status', { is: 'ACTIVE', then: Joi.required(), otherwise: Joi.optional() }),
      startTime: Joi.date()
        .iso()
        .when('status', { is: 'ACTIVE', then: Joi.required(), otherwise: Joi.optional() }),
      endTime: Joi.date()
        .iso()
        .greater(Joi.ref('startTime'))
        .when('status', { is: 'ACTIVE', then: Joi.required(), otherwise: Joi.optional() }),
      participantEmails: Joi.array().items(Joi.string().email()).optional(),
    })
    .required(),
};

const getRequirements = {
  query: Joi.object().keys({
    title: Joi.string(),
    category: Joi.string(),
    status: Joi.string().valid('DRAFT', 'ACTIVE', 'CLOSED', 'AWARDED'),
    sortBy: Joi.string(),
    sortOrder: Joi.string().valid('asc', 'desc'),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};


const getRequirement = {
  params: Joi.object().keys({
    requirementId: Joi.string().custom(objectId),
  }),
};
const getInvitedRequirements = {
  query: Joi.object().keys({
    sortBy: Joi.string().default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
    limit: Joi.number().integer().default(10),
    page: Joi.number().integer().default(1),
    window: Joi.string().valid('live', 'upcoming').optional(),
  }),
};

const updateRequirement = {
  params: Joi.object().keys({
    requirementId: Joi.string().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      title: Joi.string().trim(),
      description: Joi.string().trim(),
      category: Joi.string().trim(),
      currency: Joi.string().trim(),
      ceilingPrice: Joi.number().positive(),
      minDecrement: Joi.number().positive(),
      startTime: Joi.date().iso(),
      endTime: Joi.date().iso(),
      participantEmails: Joi.array().items(Joi.string().email()),
      status: Joi.string().valid('DRAFT', 'ACTIVE', 'CLOSED', 'AWARDED'),
    })
    .min(1)
    .when(Joi.object({ status: Joi.valid('ACTIVE') }).unknown(), {
      then: Joi.object({
        title: Joi.string().trim().required(),
        description: Joi.string().trim().required(),
        currency: Joi.string().trim().required(),
        ceilingPrice: Joi.number().positive().required(),
        minDecrement: Joi.number().positive().required(),
        startTime: Joi.date().iso().required(),
        endTime: Joi.date().iso().required(),
      }),
    }),
};

const deleteRequirement = {
  params: Joi.object().keys({
    requirementId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createRequirement,
  getRequirements,
  getRequirement,
  updateRequirement,
  deleteRequirement,
  getInvitedRequirements,
};
