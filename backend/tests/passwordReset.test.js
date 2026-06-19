import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';
import {
  changeUserPassword,
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  generateTemporaryPassword,
  requestPasswordReset,
} from '../src/services/passwordResetService.js';
import { getTestMongoUri } from '../src/config/testDbGuard.js';

const mongoUri = getTestMongoUri();

vi.mock('../src/services/emailService.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ delivered: false, logged: true }),
}));

const TEST_EMAIL = 'password-reset-test@example.com';

describe('passwordResetService', () => {
  beforeAll(async () => {
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await Session.deleteMany({});
    await User.deleteMany({ email: TEST_EMAIL });
    await mongoose.disconnect();
  });

  it('generateTemporaryPassword evita caracteres ambiguos', () => {
    const password = generateTemporaryPassword(24);
    expect(password).toHaveLength(24);
    expect(password).not.toMatch(/[0O1lIl]/);
  });

  it('requestPasswordReset no revela si el email no existe', async () => {
    const result = await requestPasswordReset('no-existe@example.com');
    expect(result.message).toBe(FORGOT_PASSWORD_SUCCESS_MESSAGE);
  });

  it('requestPasswordReset no cambia la clave si falla el envío de email', async () => {
    await User.deleteMany({ email: TEST_EMAIL });
    const originalHash = await bcrypt.hash('keep-this-pass', 10);
    await User.create({
      name: 'Email Fail Test',
      email: TEST_EMAIL,
      passwordHash: originalHash,
    });

    const { sendPasswordResetEmail } = await import('../src/services/emailService.js');
    sendPasswordResetEmail.mockRejectedValueOnce(new Error('EMAIL_DELIVERY_FAILED'));

    await expect(requestPasswordReset(TEST_EMAIL)).rejects.toMatchObject({
      status: 503,
    });

    const unchanged = await User.findOne({ email: TEST_EMAIL });
    expect(unchanged.mustChangePassword).toBe(false);
    expect(await bcrypt.compare('keep-this-pass', unchanged.passwordHash)).toBe(true);
  });

  it('reset permite login con clave provisoria y change-password limpia el flag', async () => {
    await User.deleteMany({ email: TEST_EMAIL });
    const originalHash = await bcrypt.hash('original-pass', 10);
    const user = await User.create({
      name: 'Reset Test',
      email: TEST_EMAIL,
      passwordHash: originalHash,
    });

    const resetResult = await requestPasswordReset(TEST_EMAIL);
    expect(resetResult.message).toBe(FORGOT_PASSWORD_SUCCESS_MESSAGE);

    const updated = await User.findById(user._id);
    expect(updated.mustChangePassword).toBe(true);
    expect(updated.passwordResetAt).toBeTruthy();

    const { sendPasswordResetEmail } = await import('../src/services/emailService.js');
    expect(sendPasswordResetEmail).toHaveBeenCalled();
    const temporaryPassword = sendPasswordResetEmail.mock.calls.at(-1)[0].temporaryPassword;

    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const loginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: temporaryPassword }),
      });
      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      expect(loginData.user.mustChangePassword).toBe(true);

      const badChangeRes = await fetch(`http://127.0.0.1:${port}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
        body: JSON.stringify({
          currentPassword: 'wrong-pass',
          newPassword: 'new-secure-pass',
        }),
      });
      expect(badChangeRes.status).toBe(401);

      const changeRes = await fetch(`http://127.0.0.1:${port}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
        body: JSON.stringify({
          currentPassword: temporaryPassword,
          newPassword: 'new-secure-pass',
        }),
      });
      expect(changeRes.status).toBe(200);
      const changeData = await changeRes.json();
      expect(changeData.user.mustChangePassword).toBe(false);

      const loginOldRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: temporaryPassword }),
      });
      expect(loginOldRes.status).toBe(401);

      const loginNewRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: 'new-secure-pass' }),
      });
      expect(loginNewRes.status).toBe(200);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('changeUserPassword rechaza clave provisoria expirada', async () => {
    await User.deleteMany({ email: TEST_EMAIL });
    const hash = await bcrypt.hash('temp-pass', 10);
    const user = await User.create({
      name: 'Expired Reset',
      email: TEST_EMAIL,
      passwordHash: hash,
      mustChangePassword: true,
      passwordResetAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    await expect(
      changeUserPassword(user._id, {
        currentPassword: 'temp-pass',
        newPassword: 'brand-new-pass',
      })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('expiró'),
    });
  });
});
