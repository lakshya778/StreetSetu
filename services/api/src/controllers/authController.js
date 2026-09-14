const authService = require('../services/authService');
const { responseFormatter } = require('../utils/responseFormatter');

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    return responseFormatter(res, 201, result, 'Registration successful');
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return responseFormatter(res, 200, result, 'Login successful');
  } catch (error) {
    return next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const result = await authService.refresh(req.body);
    return responseFormatter(res, 200, result, 'Token refreshed');
  } catch (error) {
    return next(error);
  }
}

async function profile(req, res, next) {
  try {
    const result = await authService.getProfile(req.user.id);
    return responseFormatter(res, 200, result, 'Profile retrieved');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  refresh,
  profile,
};
