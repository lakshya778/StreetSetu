import { Router } from 'express';
import { verifyToken } from '../config/jwt.js';
import { create, detail, join, leave, list } from '../controllers/driveController.js';
import { authenticate } from '../middleware/auth.js';
import { validateDriveId, validateDrive } from '../validators/driveValidator.js';

const router = Router();

function optionalAuthenticate(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header) return next();
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid authorization header' } });
  }
  try {
    req.user = verifyToken(header.slice(7));
    return next();
  } catch {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
}

router.get('/', optionalAuthenticate, list);
router.get('/:id', optionalAuthenticate, validateDriveId, detail);
router.post('/', authenticate, validateDrive, create);
router.post('/:id/join', authenticate, validateDriveId, join);
router.post('/:id/leave', authenticate, validateDriveId, leave);

export default router;
