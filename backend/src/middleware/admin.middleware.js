import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';
import {
  isAdminConfiguredFromEnv,
  verifyStoredAdminCredentials,
} from '../services/adminSetupService.js';

export function signAdminToken() {
  return jwt.sign({ sub: 'admin', role: 'admin' }, env.jwtSecret, {
    expiresIn: env.adminJwtExpires,
  });
}

export function adminMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.role !== 'admin' || payload.sub !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.admin = { role: 'admin' };
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

async function verifyEnvAdminCredentials(username, password) {
  if (!env.adminUsername || !env.adminPassword) {
    return false;
  }
  if (username !== env.adminUsername) {
    return false;
  }

  const expected = env.adminPassword;
  if (expected.startsWith('$2a$') || expected.startsWith('$2b$') || expected.startsWith('$2y$')) {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, expected);
  }

  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function verifyAdminCredentials(username, password) {
  const trimmedUsername = String(username ?? '').trim();
  const plainPassword = String(password ?? '');

  if (isAdminConfiguredFromEnv()) {
    return verifyEnvAdminCredentials(trimmedUsername, plainPassword);
  }

  return verifyStoredAdminCredentials(trimmedUsername, plainPassword);
}
