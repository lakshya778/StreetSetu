import { loginUser, registerUser, revokeRefreshSession, rotateRefreshSession } from '../services/authService.js';

const REFRESH_COOKIE = 'streetsetu_refresh';
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000
});

function sendSession(res, session, status = 200) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions());
  const { refreshToken, ...data } = session;
  return res.status(status).json({ success: true, data, message: 'Authentication successful' });
}

export async function register(req, res, next) {
  try {
    return sendSession(res, await registerUser(req.body, req), 201);
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    return sendSession(res, await loginUser(req.body, req));
  } catch (error) {
    return next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    return sendSession(res, await rotateRefreshSession(req.cookies?.[REFRESH_COOKIE], req));
  } catch (error) { return next(error); }
}

export async function logout(req, res, next) {
  try {
    await revokeRefreshSession(req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    return res.json({ success: true, data: {}, message: 'Logged out successfully' });
  } catch (error) { return next(error); }
}
