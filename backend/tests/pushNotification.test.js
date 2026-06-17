import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { env } from '../src/config/env.js';
import { getVapidPublicKey, notifyMatchesLiveStarted, notifyPredictionLockClosing, pickLatestPushSubscription } from '../src/services/pushNotificationService.js';

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

  it('pickLatestPushSubscription elige la suscripción con updatedAt más reciente', () => {
    const picked = pickLatestPushSubscription([
      { endpoint: 'a', updatedAt: new Date('2026-06-01T10:00:00Z') },
      { endpoint: 'b', updatedAt: new Date('2026-06-15T10:00:00Z') },
      { endpoint: 'c', updatedAt: new Date('2026-06-10T10:00:00Z') },
    ]);
    expect(picked?.endpoint).toBe('b');
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

  it('notifyPredictionLockClosing se omite si push está deshabilitado', async () => {
    env.pushNotificationsEnabled = false;
    const result = await notifyPredictionLockClosing(
      { _id: '1', externalId: '19', homeTeamId: 'a', awayTeamId: 'b' },
      [{ _id: 'u1', pushSubscriptions: [{ endpoint: 'x', keys: {} }] }]
    );
    expect(result).toMatchObject({ sent: 0, skipped: true });
  });
});
