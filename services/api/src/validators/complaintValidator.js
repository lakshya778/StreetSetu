const Joi = require('joi');

const locationSchema = Joi.object({
  type: Joi.string().valid('Point').required(),
  coordinates: Joi.array().items(Joi.number()).length(2).required(),
  locationId: Joi.string().optional(),
});

const createComplaintSchema = Joi.object({
  title: Joi.string().trim().min(5).max(180).required(),
  description: Joi.string().trim().min(20).required(),
  category: Joi.string().required(),
  departmentId: Joi.string().optional(),
  wardId: Joi.string().required(),
  neighbourhoodId: Joi.string().optional(),
  location: locationSchema.required(),
  addressText: Joi.string().trim().optional().allow(''),
  imageUrls: Joi.array().items(Joi.string().uri()).optional(),
  videoUrls: Joi.array().items(Joi.string().uri()).optional(),
});

const uploadSchema = Joi.object({
  url: Joi.string().uri().required(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('submitted', 'reviewed', 'assigned', 'in_progress', 'resolved', 'rejected', 'escalated').required(),
});

const complaintIdSchema = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  createComplaintSchema,
  uploadSchema,
  updateStatusSchema,
  complaintIdSchema,
};
