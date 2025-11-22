import jwt from 'jsonwebtoken';

function checkJWTSecret(secret, name) {
  if (!secret) {
    throw new Error(`Missing ${name}. Please set ${name} in your .env file.`);
  }
  return secret;
}

export function signAccessToken(payload) {
  const secret = checkJWTSecret(process.env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');
  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

export function signRefreshToken(payload) {
  const secret = checkJWTSecret(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyToken(token, secret) {
  if (!secret) {
    throw new Error('JWT secret is required for token verification');
  }
  return jwt.verify(token, secret);
}


