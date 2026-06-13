import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { env } from '../src/config/env.js';
import { getVapidPublicKey, notifyMatchesLiveStarted } from '../src/services/pushNotificationService.js';

describe('pushNotificationService', () => {
  const originalPushEnabled = env.pushNotificationsEnabled;
  const originalPublic = env.vapidPublicKey;
  const originalPrivate = env.vapidPrivateKey;

  afterEach(() => {
    env.pushNotificationsEnabled = originalPushEnabled;
    env.vapidPublicKey = originalPublic;
    env.vapidPrivateKey = originalPrivate;
  });

  it('getVapidPublicKey devuelve la clave configurada', () => {
    env.vapidPublicKey = 'test-public-key';
    expect(getVapidPublicKey()).toBe('test-public-key');
  });

  it('notifyMatchesLiveStarted se omite si push está deshabilitado', async () => {
    env.pushNotificationsEnabled = false;
    const result = await notifyMatchesLiveStarted([{ _id: '1', externalId: '19' }]);
    expect(result).toMatchObject({ sent: 0, skipped: true });
  });

  it('notifyMatchesLiveStarted se omite sin claves VAPID', async () => {
    env.pushNotificationsEnabled = true;
    env.vapidPublicKey = '';
    env.vapidPrivateKey = '';
    const result = await notifyMatchesLiveStarted([{ _id: '1', externalId: '19' }]);
    expect(result).toMatchObject({ sent: 0, skipped: true, reason: 'push_disabled' });
  });
});
