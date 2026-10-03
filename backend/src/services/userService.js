import mongoose from 'mongoose';
import User from '../models/User.js';

export async function updateVolunteerProfile(userId, { expertiseCategories, location, phone, area, city, availability }) {
  const profile = await User.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(userId), role: 'volunteer' },
    {
      $set: {
        expertiseCategories,
        ...(location ? { location } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(area !== undefined ? { area } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(availability !== undefined ? { availability } : {})
      }
    },
    { new: true, runValidators: true }
  );
  if (!profile) {
    const error = new Error('Volunteer profile not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  return profile;
}
