import mongoose from 'mongoose';

const duplicateSupportSchema = new mongoose.Schema({
  complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

duplicateSupportSchema.index({ complaint: 1, user: 1 }, { unique: true });
duplicateSupportSchema.index({ category: 1, createdAt: -1 });

export default mongoose.model('DuplicateSupport', duplicateSupportSchema);
