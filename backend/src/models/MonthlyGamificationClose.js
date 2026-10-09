import mongoose from 'mongoose';

const monthlyGamificationCloseSchema = new mongoose.Schema({
  month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/, unique: true },
  status: { type: String, enum: ['running', 'failed', 'closed'], required: true, default: 'running' },
  lockToken: { type: String },
  lockExpiresAt: { type: Date },
  winnerCount: { type: Number, min: 0, default: 0 },
  closedAt: { type: Date },
  failureReason: { type: String, maxlength: 1000 }
}, { timestamps: true });

export default mongoose.model('MonthlyGamificationClose', monthlyGamificationCloseSchema);
