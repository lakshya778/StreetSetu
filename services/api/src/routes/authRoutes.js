const express = require('express');
const authController = require('../controllers/authController');
const { authRequired } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validation');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require('../validators/authValidator');

const router = express.Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.get('/profile', authRequired, authController.profile);
router.get('/admin-check', authRequired, authorize(['admin:read']), authController.profile);

module.exports = router;
