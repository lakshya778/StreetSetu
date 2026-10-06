import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
  citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  volunteer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  comment: { type: String, trim: true, maxlength: 1000, default: '' }
}, { timestamps: true });

feedbackSchema.index({ complaint: 1 }, { unique: true });

export default mongoose.model('Feedback', feedbackSchema);
