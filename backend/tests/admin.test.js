import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import {
  adminMiddleware,
  signAdminToken,
  verifyAdminCredentials,
} from '../src/middleware/admin.middleware.js';

describe('admin auth', () => {
  const originalUsername = env.adminUsername;
  const originalPassword = env.adminPassword;

  beforeAll(() => {
    env.adminUsername = 'testadmin';
    env.adminPassword = 'test-admin-pass';
  });

  afterAll(() => {
    env.adminUsername = originalUsername;
    env.adminPassword = originalPassword;
  });

  it('verifyAdminCredentials accepts matching credentials', async () => {
    expect(await verifyAdminCredentials('testadmin', 'test-admin-pass')).toBe(true);
    expect(await verifyAdminCredentials('testadmin', 'wrong')).toBe(false);
    expect(await verifyAdminCredentials('other', 'test-admin-pass')).toBe(false);
  });

  it('signAdminToken produces admin role', () => {
    const token = signAdminToken();
    const payload = jwt.verify(token, env.jwtSecret);
    expect(payload.role).toBe('admin');
    expect(payload.sub).toBe('admin');
  });

  it('POST /api/admin/login returns token with valid credentials', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testadmin', password: 'test-admin-pass' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBeTruthy();
      expect(data.admin.role).toBe('admin');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('POST /api/admin/login rejects invalid credentials', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testadmin', password: 'nope' }),
      });
      expect(res.status).toBe(401);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('adminMiddleware rejects player JWT', () => {
    const playerToken = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, env.jwtSecret);
    const req = { headers: { authorization: `Bearer ${playerToken}` } };
    const res = { statusCode: 0, body: null };
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body) => {
      res.body = body;
    };

    adminMiddleware(req, res, () => {
      throw new Error('should not call next');
    });

    expect(res.statusCode).toBe(403);
  });

  it('GET /api/admin/setup/status reports configured when env is set', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/setup/status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.configured).toBe(true);
      expect(data.source).toBe('env');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /api/admin/stats requires admin token', async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/stats`);
      expect(res.status).toBe(401);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
