import jwt from 'jsonwebtoken';

function getSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must contain at least 32 characters in production');
    }
  }

  return 'development_secret';
}

export function signToken(payload) {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    algorithm: 'HS256'
  });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
}

export function signRefreshToken(payload, tokenId) {
  const secret = process.env.JWT_REFRESH_SECRET || getSecret();
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32)) {
    throw new Error('JWT_REFRESH_SECRET must contain at least 32 characters in production');
  }
  return jwt.sign({ ...payload, jti: tokenId, tokenType: 'refresh' }, secret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    algorithm: 'HS256'
  });
}

export function verifyRefreshToken(token) {
  const secret = process.env.JWT_REFRESH_SECRET || getSecret();
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}
