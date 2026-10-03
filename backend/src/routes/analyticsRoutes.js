import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { geoSummary, heatmap, hotspots } from '../controllers/geoAnalyticsController.js';
import { validateGeoAnalyticsQuery } from '../validators/geoAnalyticsValidator.js';

const router = Router();
router.use(authenticate, authorize('admin'), validateGeoAnalyticsQuery);
router.get('/heatmap', heatmap);
router.get('/hotspots', hotspots);
router.get('/geo-summary', geoSummary);

export default router;
