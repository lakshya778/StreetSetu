import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    volunteer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true, index: true },
    assignedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    endReason: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

assignmentSchema.index({ complaint: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
assignmentSchema.index({ volunteer: 1, isActive: 1, createdAt: -1 });

export default mongoose.model('Assignment', assignmentSchema);