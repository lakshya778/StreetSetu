import jwt from 'jsonwebtoken';

function getSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }

  return 'development_secret';
}

export function signToken(payload) {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}
