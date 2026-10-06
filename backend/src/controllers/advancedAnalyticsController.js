import {
  getAdvancedLeaderboard,
  getAnalyticsOverview,
  getAreaAnalytics,
  getCategoryAnalytics,
  getResolutionTrend
} from '../services/advancedAnalyticsService.js';

export async function overview(req, res, next) {
  try { return res.json({ success: true, data: await getAnalyticsOverview(req), message: 'Analytics overview loaded' }); }
  catch (error) { return next(error); }
}

export async function categories(req, res, next) {
  try { return res.json({ success: true, data: await getCategoryAnalytics(req.geoAnalyticsQuery), message: 'Category analytics loaded' }); }
  catch (error) { return next(error); }
}

export async function areas(req, res, next) {
  try { return res.json({ success: true, data: await getAreaAnalytics(req.geoAnalyticsQuery), message: 'Area analytics loaded' }); }
  catch (error) { return next(error); }
}

export async function resolutionTrend(req, res, next) {
  try { return res.json({ success: true, data: await getResolutionTrend(), message: 'Thirty-day resolution trend loaded' }); }
  catch (error) { return next(error); }
}

export async function leaderboard(req, res, next) {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 10, 1), 50);
    return res.json({ success: true, data: await getAdvancedLeaderboard(limit), message: 'Volunteer leaderboard loaded' });
  } catch (error) { return next(error); }
}
