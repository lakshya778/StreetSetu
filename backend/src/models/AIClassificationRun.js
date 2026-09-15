import mongoose from 'mongoose';

const classificationSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    priority: { type: String, required: true },
    isToxic: { type: Boolean, required: true },
    isSpam: { type: Boolean, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    reasons: { type: [String], default: [] }
  },
  { _id: false }
);

const aiClassificationRunSchema = new mongoose.Schema(
  {
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true, trim: true },
    model: { type: String, trim: true },
    classification: { type: classificationSchema, required: true },
    reviewStatus: { type: String, enum: ['pending', 'accepted', 'overridden'], default: 'pending' }
  },
  { timestamps: true }
);

aiClassificationRunSchema.index({ complaint: 1, createdAt: -1 });

export default mongoose.model('AIClassificationRun', aiClassificationRunSchema);