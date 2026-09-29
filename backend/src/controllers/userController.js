import { updateVolunteerProfile } from '../services/userService.js';

export async function updateMyVolunteerProfile(req, res, next) {
  try {
    const profile = await updateVolunteerProfile(req.user.sub, req.body);
    return res.json({ success: true, data: profile, message: 'Volunteer profile updated successfully' });
  } catch (error) {
    return next(error);
  }
}
