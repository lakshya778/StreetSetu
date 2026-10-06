import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { geoSummary, heatmap, hotspots } from '../controllers/geoAnalyticsController.js';
import { areas, categories, leaderboard, overview, resolutionTrend } from '../controllers/advancedAnalyticsController.js';
import { validateGeoAnalyticsQuery } from '../validators/geoAnalyticsValidator.js';
import { validateDashboardQuery } from '../validators/dashboardValidator.js';

const router = Router();
router.use(authenticate, authorize('admin'));
router.get('/overview', validateDashboardQuery, overview);
router.use(validateGeoAnalyticsQuery);
router.get('/categories', categories);
router.get('/areas', areas);
router.get('/resolution-trend', resolutionTrend);
router.get('/leaderboard', leaderboard);
router.get('/heatmap', heatmap);
router.get('/hotspots', hotspots);
router.get('/geo-summary', geoSummary);

export default router;
