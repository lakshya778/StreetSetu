import { Router } from 'express';
import { login, logout, refresh, register } from '../controllers/authController.js';
import { validateLogin, validateRegister } from '../validators/authValidator.js';
import { authRateLimit } from '../middleware/rateLimits.js';

const router = Router();

router.post('/register', authRateLimit, validateRegister, register);
router.post('/login', authRateLimit, validateLogin, login);
router.post('/refresh', authRateLimit, refresh);
router.post('/logout', logout);

export default router;
