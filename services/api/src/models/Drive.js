const mongoose = require('mongoose');

const driveSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 150,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  type: {
    type: String,
    enum: ['cleanliness', 'awareness', 'tree_plantation', 'water', 'safety', 'community'],
    required: true,
  },
  wardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
  },
  neighbourhoodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null,
  },
  leadUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  memberUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  startAt: {
    type: Date,
    default: null,
  },
  endAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled'],
    default: 'draft',
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

driveSchema.index({ wardId: 1 });
driveSchema.index({ neighbourhoodId: 1 });
driveSchema.index({ leadUserId: 1 });
driveSchema.index({ status: 1 });
driveSchema.index({ startAt: 1, endAt: 1 });

module.exports = mongoose.models.Drive || mongoose.model('Drive', driveSchema);
