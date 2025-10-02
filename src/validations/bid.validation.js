const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createBid = {
  body: Joi.object().keys({
    requirementId: Joi.string().custom(objectId).required(),
    offeredPrice: Joi.number().positive().required(),
    deliveryDays: Joi.number().integer().min(0).optional(),
    notes: Joi.string().trim().allow('').optional(),
  }),
};

const listBids = {
  query: Joi.object().keys({
    requirementId: Joi.string().custom(objectId).required(),
    sortBy: Joi.string().valid('createdAt', 'offeredPrice').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

module.exports = { createBid, listBids };
