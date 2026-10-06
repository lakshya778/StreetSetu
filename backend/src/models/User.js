import mongoose from 'mongoose';
import { COMPLAINT_CATEGORIES } from './Complaint.js';

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
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: {
        type: [Number],
        default: undefined,
        validate: {
          validator: (coordinates) => coordinates.length === 2
            && coordinates[0] >= -180 && coordinates[0] <= 180
            && coordinates[1] >= -90 && coordinates[1] <= 90,
          message: 'Volunteer coordinates must be [longitude, latitude]'
        }
      }
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function toJSON() {
  const user = this.toObject();
  delete user.passwordHash;
  return user;
};

userSchema.index({ role: 1, isActive: 1, location: '2dsphere' });

export default mongoose.model('User', userSchema);
