import mongoose from 'mongoose';
import User from '../models/User.js';

export async function updateVolunteerProfile(userId, { expertiseCategories, location }) {
  const profile = await User.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(userId), role: 'volunteer' },
    {
      $set: {
        expertiseCategories,
        ...(location ? { location } : {})
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
