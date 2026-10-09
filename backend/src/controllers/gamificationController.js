import { getLeaderboard } from '../services/gamificationService.js';

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
