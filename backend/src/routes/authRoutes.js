import { Router } from 'express';
import { login, logout, refresh, register } from '../controllers/authController.js';
import { validateLogin, validateRegister } from '../validators/authValidator.js';
import { authRateLimit } from '../middleware/rateLimits.js';
import { requireTrustedBrowserOrigin } from '../middleware/trustedOrigin.js';

const router = Router();

router.post('/register', authRateLimit, requireTrustedBrowserOrigin, validateRegister, register);
router.post('/login', authRateLimit, requireTrustedBrowserOrigin, validateLogin, login);
router.post('/refresh', authRateLimit, requireTrustedBrowserOrigin, refresh);
router.post('/logout', requireTrustedBrowserOrigin, logout);

export default router;
