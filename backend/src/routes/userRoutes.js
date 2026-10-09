import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { downloadMyCertificateFile, myCertificates, myGamificationStats, updateMyVolunteerProfile } from '../controllers/userController.js';
import { validateVolunteerProfile } from '../validators/userValidator.js';

const router = Router();

router.use(authenticate);
router.get('/me/stats', myGamificationStats);
router.get('/me/certificates', myCertificates);
router.get('/me/certificates/:certificateId/download', downloadMyCertificateFile);
router.patch('/me/volunteer-profile', authorize('volunteer'), validateVolunteerProfile, updateMyVolunteerProfile);

export default router;
