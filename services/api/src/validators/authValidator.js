const Joi = require('joi');

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().email().trim().required(),
  phone: Joi.string().trim().pattern(/^\+?[0-9\s-]{10,15}$/).optional(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('citizen', 'volunteer', 'ward_officer', 'department_owner', 'admin', 'system_admin').optional(),
  wardId: Joi.string().optional(),
  neighbourhoodId: Joi.string().optional(),
  departmentId: Joi.string().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().trim().required(),
  password: Joi.string().min(8).required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
};
