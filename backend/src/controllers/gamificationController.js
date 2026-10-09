import { getLeaderboard } from '../services/gamificationService.js';
import { closeMonth, getLatestMonthlyTopThree } from '../services/monthlyGamificationService.js';

export async function leaderboard(req, res, next) {
  try {
    const data = await getLeaderboard({
      scope: req.leaderboardQuery.scope,
      ward: req.leaderboardQuery.ward,
      viewerId: req.user.sub
    });
    return res.json({ success: true, data, message: 'Leaderboard loaded' });
  } catch (error) {
    return next(error);
  }
}

export async function latestMonthlyTopThree(req, res, next) {
  try {
    return res.json({ success: true, data: await getLatestMonthlyTopThree(), message: 'Monthly community highlights loaded' });
  } catch (error) {
    return next(error);
  }
}

export async function closeGamificationMonth(req, res, next) {
  try {
    if (!req.query.month) {
      const error = new Error('Month is required in YYYY-MM format');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const data = await closeMonth(req.query.month);
    return res.json({ success: true, data, message: data.alreadyClosed ? 'Month was already closed' : 'Monthly awards have been closed' });
  } catch (error) {
    return next(error);
  }
}
