import bcrypt from 'bcryptjs';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import User from '../models/User.js';
import RefreshSession from '../models/RefreshSession.js';
import { signToken, signRefreshToken, verifyRefreshToken } from '../config/jwt.js';

const PASSWORD_SALT_ROUNDS = 12;

export class AuthError extends Error {
  constructor(message, statusCode = 400, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }
function publicUser(user) { return user.toJSON(); }

function expiryDate() {
  const value = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  const match = /^([1-9]\d*)([smhd])$/.exec(value);
  const milliseconds = match
    ? Number(match[1]) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 })[match[2]]
    : 30 * 86400000;
  return new Date(Date.now() + milliseconds);
}

async function createSession(user, req) {
  const tokenId = randomUUID();
  const accessToken = signToken({ sub: String(user._id), email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user._id) }, tokenId);
  await RefreshSession.create({
    user: user._id,
    tokenId,
    tokenHash: hashToken(refreshToken),
    expiresAt: expiryDate(),
    userAgent: req?.get?.('user-agent')?.slice(0, 500),
    ipAddress: req?.ip
  });
  return { user: publicUser(user), token: accessToken, accessToken, refreshToken };
}

export async function registerUser({ name, email, password, role = 'citizen' }, req) {
  if (role === 'admin') throw new AuthError('Admin accounts must be provisioned by an administrator', 403, 'ROLE_NOT_ALLOWED');
  try {
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const user = await User.create({ name, email, passwordHash, role });
    return await createSession(user, req);
  } catch (error) {
    if (error?.code === 11000) throw new AuthError('An account with this email already exists', 409, 'EMAIL_ALREADY_EXISTS');
    throw error;
  }
}

export async function loginUser({ email, password }, req) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }
  return createSession(user, req);
}

export async function rotateRefreshSession(token, req) {
  if (!token) throw new AuthError('Refresh token is required', 401, 'UNAUTHORIZED');
  let claims;
  try { claims = verifyRefreshToken(token); }
  catch { throw new AuthError('Refresh token is invalid or expired', 401, 'UNAUTHORIZED'); }
  if (claims.tokenType !== 'refresh' || !claims.jti || !claims.sub) {
    throw new AuthError('Refresh token is invalid', 401, 'UNAUTHORIZED');
  }
  const presentedHash = hashToken(token);
  const session = await RefreshSession.findOneAndUpdate(
    { tokenId: claims.jti, user: claims.sub, tokenHash: presentedHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } },
    { new: false }
  );
  if (!session || !timingSafeEqual(Buffer.from(session.tokenHash), Buffer.from(presentedHash))) {
    throw new AuthError('Refresh token has already been used or revoked', 401, 'UNAUTHORIZED');
  }
  const user = await User.findOne({ _id: claims.sub, isActive: true });
  if (!user) throw new AuthError('Account is unavailable', 401, 'UNAUTHORIZED');
  return createSession(user, req);
}

export async function revokeRefreshSession(token) {
  if (!token) return;
  try {
    const claims = verifyRefreshToken(token);
    await RefreshSession.updateOne({ tokenId: claims.jti, user: claims.sub, tokenHash: hashToken(token), revokedAt: null }, { $set: { revokedAt: new Date() } });
  } catch { /* Invalid/expired tokens are already unusable. */ }
}
