import mongoose from 'mongoose';

const refreshSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenId: { type: String, required: true, unique: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date },
  userAgent: { type: String, maxlength: 500 },
  ipAddress: { type: String, maxlength: 100 }
}, { timestamps: true });

refreshSessionSchema.index({ user: 1, revokedAt: 1, expiresAt: 1 });
export default mongoose.model('RefreshSession', refreshSessionSchema);
