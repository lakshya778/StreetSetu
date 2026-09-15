import { loginUser, registerUser } from '../services/authService.js';

export async function register(req, res, next) {
  try {
    const data = await registerUser(req.body);
    return res.status(201).json({
      success: true,
      data,
      message: 'User registered successfully'
    });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const data = await loginUser(req.body);
    return res.json({
      success: true,
      data,
      message: 'Login successful'
    });
  } catch (error) {
    return next(error);
  }
}
