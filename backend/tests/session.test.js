import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';
import {
  SESSION_TTL_MS,
  createUserSession,
  findUserBySessionToken,
  revokeSessionToken,
} from '../src/services/sessionService.js';

describe('sessionService', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mundial2026_test');
  });

  afterAll(async () => {
    await Session.deleteMany({});
    await User.deleteMany({ email: 'session-test@example.com' });
    await mongoose.disconnect();
  });

  it('crea sesión con vigencia de 2 horas', async () => {
    const user = await User.create({
      name: 'Session Test',
      email: 'session-test@example.com',
      passwordHash: 'hash',
    });

    const before = Date.now();
    const session = await createUserSession(user._id);
    const after = Date.now();

    expect(session.token).toMatch(/^[a-f0-9]{64}$/);
    const expiresMs = new Date(session.expiresAt).getTime();
    expect(expiresMs - before).toBeGreaterThanOrEqual(SESSION_TTL_MS - 1000);
    expect(expiresMs - after).toBeLessThanOrEqual(SESSION_TTL_MS + 1000);

    const resolved = await findUserBySessionToken(session.token);
    expect(resolved?._id.toString()).toBe(user._id.toString());

    await revokeSessionToken(session.token);
    const afterRevoke = await findUserBySessionToken(session.token);
    expect(afterRevoke).toBeNull();
  });
});
