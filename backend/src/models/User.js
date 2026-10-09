import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { COMPLAINT_CATEGORIES } from './Complaint.js';

const userLocationSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: (coordinates) => Array.isArray(coordinates) && coordinates.length === 2
        && Number.isFinite(coordinates[0]) && coordinates[0] >= -180 && coordinates[0] <= 180
        && Number.isFinite(coordinates[1]) && coordinates[1] >= -90 && coordinates[1] <= 90,
      message: 'Volunteer coordinates must be [longitude, latitude] within valid ranges'
    }
  }
}, { _id: false });

const badgeSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  awardedAt: { type: Date, required: true },
  month: { type: String, match: /^\d{4}-\d{2}$/ }
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 30 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['citizen', 'volunteer', 'admin'], default: 'citizen' },
    expertiseCategories: { type: [{ type: String, enum: COMPLAINT_CATEGORIES }], default: [] },
    area: { type: String, trim: true, maxlength: 160 },
    city: { type: String, trim: true, maxlength: 120 },
    availability: { type: String, enum: ['available', 'limited', 'unavailable', 'full_time', 'part_time', 'weekend', 'flexible'], default: 'available', index: true },
    location: { type: userLocationSchema, default: undefined },
    referralCode: { type: String, unique: true, default: () => randomBytes(6).toString('hex').toUpperCase() },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    streakWeeks: { type: Number, default: 0, min: 0 },
    lastReportWeek: { type: String, match: /^\d{4}-W\d{2}$/ },
    totalPoints: { type: Number, default: 0, min: 0 },
    monthlyPoints: { type: Number, default: 0, min: 0 },
    monthlyPointsMonth: { type: String, match: /^\d{4}-\d{2}$/ },
    badges: { type: [badgeSchema], default: [] },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function toJSON() {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.referredBy;
  return user;
};

userSchema.index({ role: 1, isActive: 1, location: '2dsphere' }, { sparse: true });

export default mongoose.model('User', userSchema);
