import crypto from 'crypto';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createUserSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await Session.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function findUserBySessionToken(token) {
  if (!token?.trim()) return null;

  const session = await Session.findOne({ tokenHash: hashToken(token) });
  if (!session) return null;

  if (session.expiresAt <= new Date()) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }

  return User.findById(session.userId).select('-passwordHash');
}

export async function revokeSessionToken(token) {
  if (!token?.trim()) return;
  await Session.deleteOne({ tokenHash: hashToken(token) });
}

export async function revokeAllUserSessions(userId) {
  await Session.deleteMany({ userId });
}
