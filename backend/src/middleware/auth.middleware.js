import { findUserBySessionToken } from '../services/sessionService.js';

async function attachUserFromBearer(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  return findUserBySessionToken(token);
}

export async function authMiddleware(req, res, next) {
  try {
    const user = await attachUserFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function optionalAuth(req, res, next) {
  attachUserFromBearer(req)
    .then((user) => {
      if (user) req.user = user;
      next();
    })
    .catch(() => next());
}
