import { randomBytes } from 'node:crypto';
import User from '../models/User.js';

export async function ensureReferralCode(userId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const updated = await User.findOneAndUpdate(
        { _id: userId, $or: [{ referralCode: { $exists: false } }, { referralCode: null }, { referralCode: '' }] },
        { $set: { referralCode: randomBytes(6).toString('hex').toUpperCase() } },
        { new: true }
      ).select('referralCode').lean();
      if (updated?.referralCode) return updated.referralCode;
      const existing = await User.findById(userId).select('referralCode').lean();
      if (existing?.referralCode) return existing.referralCode;
      const error = new Error('User was not found while generating a referral code');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    } catch (error) {
      if (error?.code === 11000 && error?.keyPattern?.referralCode) continue;
      throw error;
    }
  }
  throw new Error('Could not generate a unique referral code after several attempts');
}
