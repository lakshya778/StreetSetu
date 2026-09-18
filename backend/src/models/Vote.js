import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

voteSchema.index({ complaint: 1, user: 1 }, { unique: true });

export default mongoose.model('Vote', voteSchema);