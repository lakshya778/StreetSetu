import { getVolunteerLeaderboard } from '../services/leaderboardService.js';

export async function leaderboard(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
    return res.json({ success: true, data: await getVolunteerLeaderboard(limit), message: 'Volunteer leaderboard loaded' });
  } catch (error) { return next(error); }
}
