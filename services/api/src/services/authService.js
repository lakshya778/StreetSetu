const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const env = require('../config/env');
const logger = require('../config/logger');

const rolePermissions = {
  citizen: ['issue:create', 'issue:read', 'issue:comment', 'issue:vote'],
  volunteer: ['issue:create', 'issue:read', 'issue:comment', 'issue:vote', 'drive:join'],
  ward_officer: ['issue:read', 'issue:assign', 'issue:status', 'issue:comment', 'ward:read'],
  department_owner: ['issue:read', 'issue:assign', 'issue:status', 'department:read'],
  admin: ['admin:read', 'admin:write', 'issue:read', 'issue:assign', 'permission:manage'],
  system_admin: ['admin:read', 'admin:write', 'issue:read', 'issue:assign', 'permission:manage', 'system:manage'],
};

function normalizeRole(role) {
  return String(role || 'citizen').toLowerCase();
}

function makePublicUser(user) {
  if (!user) return null;

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    role: user.role,
    status: user.status,
    isVerified: user.isVerified,
    wardId: user.wardId || null,
    neighbourhoodId: user.neighbourhoodId || null,
    departmentId: user.departmentId || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function buildPayload(user) {
  const role = normalizeRole(user.role);
  const permissions = rolePermissions[role] || rolePermissions.citizen;

  return {
    sub: String(user._id),
    id: String(user._id),
    email: user.email,
    role,
    roles: [role],
    permissions,
    wardId: user.wardId || null,
    departmentId: user.departmentId || null,
  };
}

function signAccessToken(user) {
  const payload = buildPayload(user);
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN || '1h' });
}

function signRefreshToken(user) {
  const payload = {
    sub: String(user._id),
    type: 'refresh',
    jti: crypto.randomUUID(),
    role: normalizeRole(user.role),
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET || env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

async function register(payload) {
  const { name, email, phone, password, role = 'citizen', wardId, neighbourhoodId, departmentId } = payload;

  if (!name || !email || !password) {
    const error = new Error('Name, email, and password are required');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    const error = new Error('User already exists');
    error.statusCode = 409;
    error.code = 'USER_EXISTS';
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    phone,
    passwordHash,
    role: normalizeRole(role),
    wardId,
    neighbourhoodId,
    departmentId,
    status: 'pending',
    isVerified: false,
  });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  logger.info(`Registered new user ${user.email}`);

  return {
    user: makePublicUser(user),
    token: {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: env.JWT_EXPIRES_IN || '1h',
    },
  };
}

async function login(payload) {
  const { email, password } = payload;

  if (!email || !password) {
    const error = new Error('Email and password are required');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  if (user.status !== 'active') {
    const error = new Error('Account is not active');
    error.statusCode = 403;
    error.code = 'ACCOUNT_INACTIVE';
    throw error;
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  logger.info(`Authenticated user ${user.email}`);

  return {
    user: makePublicUser(user),
    token: {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: env.JWT_EXPIRES_IN || '1h',
    },
  };
}

async function refresh(payload) {
  const { refreshToken } = payload;

  if (!refreshToken) {
    const error = new Error('Refresh token is required');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET || env.JWT_SECRET);
    if (decoded.type !== 'refresh') {
      const error = new Error('Invalid refresh token type');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    const user = await User.findById(decoded.sub);
    if (!user || user.status !== 'active') {
      const error = new Error('Invalid refresh token user');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    const accessToken = signAccessToken(user);
    const nextRefreshToken = signRefreshToken(user);

    return {
      user: makePublicUser(user),
      token: {
        accessToken,
        refreshToken: nextRefreshToken,
        tokenType: 'Bearer',
        expiresIn: env.JWT_EXPIRES_IN || '1h',
      },
    };
  } catch (error) {
    const wrapped = new Error('Invalid or expired refresh token');
    wrapped.statusCode = 401;
    wrapped.code = 'UNAUTHORIZED';
    throw wrapped;
  }
}

async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return { user: makePublicUser(user) };
}

module.exports = {
  register,
  login,
  refresh,
  getProfile,
  buildPayload,
  signAccessToken,
  signRefreshToken,
};
