const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createRequirement = {
  body: Joi.object().keys({
    title: Joi.string().trim().required(),
    description: Joi.string().trim().required(),
    category: Joi.string().trim().optional(),
    currency: Joi.string().trim().default('INR'),
    ceilingPrice: Joi.number().positive().required(),
    minDecrement: Joi.number().positive().required(),
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
    participantEmails: Joi.array().items(Joi.string().email()).optional(),
    status: Joi.string().valid('DRAFT', 'ACTIVE').optional(),
  }),
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
    .min(1),
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
};
