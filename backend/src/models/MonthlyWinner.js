import mongoose from 'mongoose';

const monthlyWinnerSchema = new mongoose.Schema({
  month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  rank: { type: Number, required: true, enum: [1, 2, 3] },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  points: { type: Number, required: true, min: 1 },
  certificatePath: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now }
}, { versionKey: false });

monthlyWinnerSchema.index({ month: 1, rank: 1 }, { unique: true });
monthlyWinnerSchema.index({ user: 1, month: -1 });

export default mongoose.model('MonthlyWinner', monthlyWinnerSchema);
