const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  voteType: {
    type: String,
    enum: ['upvote', 'downvote'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

voteSchema.index({ complaintId: 1, userId: 1 }, { unique: true });
voteSchema.index({ complaintId: 1 });
voteSchema.index({ userId: 1 });

module.exports = mongoose.models.Vote || mongoose.model('Vote', voteSchema);
