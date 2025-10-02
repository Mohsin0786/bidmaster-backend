const Joi = require('joi');

const baseRegisterSchema = {
  firstName: Joi.string()
    .trim()
    .required(),
  lastName: Joi.string()
    .trim()
    .required(),
  phone: Joi.string().trim(),
  dob: Joi.string().isoDate(),
};

const register = {
  body: Joi.object().keys({
    ...baseRegisterSchema,
    address: Joi.string().trim().required(),
    pincode: Joi.string().trim().required(),
    gstNo: Joi.string().trim().required(),
    designation: Joi.string().trim().required(),
    industry: Joi.string().trim().required(),
  }),
};

module.exports = {
  register,
};
