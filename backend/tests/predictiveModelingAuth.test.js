import { describe, it, expect, vi, beforeEach } from 'vitest';
import { predictiveModelingAuth } from '../src/middleware/predictiveModelingAuth.middleware.js';
import { env } from '../src/config/env.js';

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('predictiveModelingAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('permite llamada interna con secret válido', async () => {
    env.oracleInternalSecret = 'test-secret';
    const req = { headers: { 'x-oracle-internal-secret': 'test-secret' } };
    const res = mockRes();
    const next = vi.fn();

    await predictiveModelingAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.oracleInternal).toBe(true);
  });

  it('bloquea usuario humano sin isAiUser', async () => {
    env.oracleInternalSecret = 'test-secret';
    const req = { headers: {}, user: { _id: 'u1', isAiUser: false } };
    const res = mockRes();
    const next = vi.fn();

    await predictiveModelingAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
