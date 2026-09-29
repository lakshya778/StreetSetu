import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { summary } from '../controllers/dashboardController.js';
import { validateDashboardQuery } from '../validators/dashboardValidator.js';
import { csv, pdf } from '../controllers/reportController.js';
import { list as listAuditLogs } from '../controllers/auditController.js';
import { validateAuditQuery } from '../validators/auditValidator.js';

const router = Router();

router.use(authenticate);
router.get('/export.csv', authorize('admin'), validateDashboardQuery, csv);
router.get('/export.pdf', authorize('admin'), validateDashboardQuery, pdf);
router.get('/activity', authorize('admin'), validateAuditQuery, listAuditLogs);
router.get('/summary', authorize('citizen', 'volunteer', 'admin'), validateDashboardQuery, summary);

export default router;
