const Joi = require('joi');

const assignComplaintSchema = Joi.object({
  assigneeUserId: Joi.string().required(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('submitted', 'reviewed', 'assigned', 'in_progress', 'resolved', 'rejected', 'escalated').required(),
});

const resolutionProofSchema = Joi.object({
  proofUrl: Joi.string().uri().required(),
});

module.exports = {
  assignComplaintSchema,
  updateStatusSchema,
  resolutionProofSchema,
};
