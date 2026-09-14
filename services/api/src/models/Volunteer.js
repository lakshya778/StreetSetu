const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  skills: [{ type: String, trim: true }],
  availability: {
    type: String,
    enum: ['full_time', 'part_time', 'weekend', 'flexible'],
    default: 'flexible',
  },
  neighbourhoodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null,
  },
  wardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null,
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

volunteerSchema.index({ userId: 1 }, { unique: true });
volunteerSchema.index({ wardId: 1 });
volunteerSchema.index({ neighbourhoodId: 1 });
volunteerSchema.index({ verificationStatus: 1 });

module.exports = mongoose.models.Volunteer || mongoose.model('Volunteer', volunteerSchema);
