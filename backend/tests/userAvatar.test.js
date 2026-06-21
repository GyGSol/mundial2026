import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';
import { createUserSession } from '../src/services/sessionService.js';
import { normalizeAvatarDataUrlInput, decodeAvatarDataUrl, getUserAvatarPublicPath, resolvePublicAvatarUrl } from '../src/services/userAvatarService.js';
import { AI_USER_AVATAR_URL } from '../src/constants/aiUser.js';
import { getTestMongoUri } from '../src/config/testDbGuard.js';

const mongoUri = getTestMongoUri();
const TEST_EMAIL = 'avatar-test@example.com';

/** 1×1 JPEG — well under size limit */
const VALID_AVATAR =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';

describe('userAvatarService', () => {
  it('normalizeAvatarDataUrlInput acepta JPEG válido', () => {
    expect(normalizeAvatarDataUrlInput(VALID_AVATAR)).toBe(VALID_AVATAR);
  });

  it('normalizeAvatarDataUrlInput borra con null o vacío', () => {
    expect(normalizeAvatarDataUrlInput(null)).toBe(null);
    expect(normalizeAvatarDataUrlInput('')).toBe(null);
    expect(normalizeAvatarDataUrlInput('   ')).toBe(null);
  });

  it('normalizeAvatarDataUrlInput no cambia con undefined', () => {
    expect(normalizeAvatarDataUrlInput(undefined)).toBe(undefined);
  });

  it('normalizeAvatarDataUrlInput rechaza prefijo inválido', () => {
    expect(() => normalizeAvatarDataUrlInput('data:image/png;base64,abc')).toThrow(/JPEG o WebP/);
  });

  it('normalizeAvatarDataUrlInput rechaza payload demasiado grande', () => {
    const huge = `data:image/jpeg;base64,${'A'.repeat(200_000)}`;
    expect(() => normalizeAvatarDataUrlInput(huge)).toThrow(/demasiado grande/);
  });

  it('decodeAvatarDataUrl decodifica JPEG válido', () => {
    const decoded = decodeAvatarDataUrl(VALID_AVATAR);
    expect(decoded?.contentType).toBe('image/jpeg');
    expect(decoded?.buffer.length).toBeGreaterThan(0);
  });

  it('getUserAvatarPublicPath devuelve ruta pública', () => {
    expect(getUserAvatarPublicPath('abc123')).toBe('/api/users/abc123/avatar');
  });

  it('resolvePublicAvatarUrl usa moneda Fubol para IA sin foto', () => {
    expect(
      resolvePublicAvatarUrl({ isAiUser: true, avatarDataUrl: null, userId: 'ai1' })
    ).toBe(AI_USER_AVATAR_URL);
  });

  it('resolvePublicAvatarUrl usa API para humanos con foto', () => {
    expect(
      resolvePublicAvatarUrl({ isAiUser: false, avatarDataUrl: VALID_AVATAR, userId: 'u1' })
    ).toBe('/api/users/u1/avatar');
  });
});

describe('PATCH /api/auth/me avatar', () => {
  let user;
  let token;
  let server;
  let port;

  beforeAll(async () => {
    await mongoose.connect(mongoUri);
    await User.deleteMany({ email: TEST_EMAIL });
    user = await User.create({
      name: 'Avatar Tester',
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash('test-pass', 10),
    });
    const session = await createUserSession(user._id);
    token = session.token;

    const app = createApp();
    server = app.listen(0);
    port = server.address().port;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await Session.deleteMany({});
    await User.deleteMany({ email: TEST_EMAIL });
    await mongoose.disconnect();
  });

  async function patchMe(body) {
    return fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  it('guarda avatar y lo expone en GET /me', async () => {
    const patchRes = await patchMe({ avatarDataUrl: VALID_AVATAR });
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.user.avatarUrl).toBe(VALID_AVATAR);

    const meRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    expect(meData.user.avatarUrl).toBe(VALID_AVATAR);
  });

  it('borra avatar con null', async () => {
    const patchRes = await patchMe({ avatarDataUrl: null });
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.user.avatarUrl).toBe(null);
  });

  it('rechaza data URL inválida', async () => {
    const patchRes = await patchMe({ avatarDataUrl: 'not-an-image' });
    expect(patchRes.status).toBe(400);
  });

  it('actualiza nombre y avatar juntos', async () => {
    const patchRes = await patchMe({
      name: 'Nuevo Nombre',
      avatarDataUrl: VALID_AVATAR,
    });
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.user.name).toBe('Nuevo Nombre');
    expect(patchData.user.avatarUrl).toBe(VALID_AVATAR);
  });

  it('GET /api/users/:id/avatar sirve la imagen', async () => {
    await patchMe({ avatarDataUrl: VALID_AVATAR });
    const avatarRes = await fetch(`http://127.0.0.1:${port}/api/users/${user._id}/avatar`);
    expect(avatarRes.status).toBe(200);
    expect(avatarRes.headers.get('content-type')).toMatch(/image\/jpeg/);
    const buf = Buffer.from(await avatarRes.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });
});
