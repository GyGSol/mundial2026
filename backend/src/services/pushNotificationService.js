import webpush from 'web-push';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Prediction } from '../models/Prediction.js';
import { Team } from '../models/Team.js';

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return env.pushNotificationsEnabled;
  if (!env.pushNotificationsEnabled) return false;
  if (!env.vapidPublicKey || !env.vapidPrivateKey) return false;

  webpush.setVapidDetails(
    env.vapidSubject,
    env.vapidPublicKey,
    env.vapidPrivateKey
  );
  vapidConfigured = true;
  return true;
}

export function getVapidPublicKey() {
  return env.vapidPublicKey || null;
}

export async function savePushSubscription(userId, subscription) {
  if (!subscription?.endpoint || !subscription?.keys) {
    throw Object.assign(new Error('Suscripción push inválida'), { status: 400 });
  }

  const payload = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    updatedAt: new Date(),
  };

  await User.updateOne(
    { _id: userId },
    {
      $pull: { pushSubscriptions: { endpoint: subscription.endpoint } },
    }
  );

  await User.updateOne(
    { _id: userId },
    {
      $push: {
        pushSubscriptions: {
          $each: [payload],
          $slice: -5,
        },
      },
    }
  );
}

async function buildMatchLabel(match) {
  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);

  const home = homeTeam?.nameEn || homeTeam?.fifaCode || 'Local';
  const away = awayTeam?.nameEn || awayTeam?.fifaCode || 'Visitante';
  return `${home} vs ${away}`;
}

/** Una sola suscripción por usuario (la más reciente) para no apilar notificaciones. */
export function pickLatestPushSubscription(subscriptions = []) {
  if (!subscriptions.length) return null;
  return subscriptions.reduce((latest, subscription) => {
    if (!latest) return subscription;
    const latestAt = latest.updatedAt ? new Date(latest.updatedAt).getTime() : 0;
    const subAt = subscription.updatedAt ? new Date(subscription.updatedAt).getTime() : 0;
    return subAt >= latestAt ? subscription : latest;
  });
}

async function sendPushToUsers(users, payload) {
  let sent = 0;
  for (const user of users) {
    const subscription = pickLatestPushSubscription(user.pushSubscriptions ?? []);
    if (!subscription) continue;
    const result = await sendToSubscription(subscription, payload);
    if (result.ok) sent += 1;
  }
  return sent;
}

async function sendToSubscription(subscription, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await User.updateMany(
        { 'pushSubscriptions.endpoint': subscription.endpoint },
        { $pull: { pushSubscriptions: { endpoint: subscription.endpoint } } }
      );
    }
    return { ok: false, error: err.message };
  }
}

/**
 * Notifica a usuarios sin predicción cargada que el cierre es en ~15 minutos.
 * @param {import('mongoose').Document|object} match
 * @param {Array<{ _id: import('mongoose').Types.ObjectId, pushSubscriptions?: object[] }>} users
 */
export async function notifyPredictionLockClosing(match, users = []) {
  if (!users.length) return { sent: 0, skipped: true };
  if (!ensureVapidConfigured()) return { sent: 0, skipped: true, reason: 'push_disabled' };

  const matchLabel = await buildMatchLabel(match);
  const payload = {
    title: 'Cierra pronto tu predicción',
    body: `${matchLabel} — te quedan 15 min para cargar tu marcador`,
    url: `/predictions?match=${match.externalId}`,
    matchId: match.externalId,
    notificationKind: 'lock',
  };

  const sent = await sendPushToUsers(users, payload);
  return { sent, skipped: false };
}

/**
 * Notifica a usuarios con predicción en el partido que acaba de pasar a live.
 * @param {import('mongoose').Document[]} matches
 */
export async function notifyMatchesLiveStarted(matches = []) {
  if (!matches.length) return { sent: 0, skipped: true };
  if (!ensureVapidConfigured()) return { sent: 0, skipped: true, reason: 'push_disabled' };

  let sent = 0;

  for (const match of matches) {
    const matchLabel = await buildMatchLabel(match);
    const predictions = await Prediction.find({ matchId: match._id, userSubmitted: true })
      .select('userId')
      .lean();
    const userIds = [...new Set(predictions.map((p) => String(p.userId)))];

    if (!userIds.length) continue;

    const users = await User.find({
      _id: { $in: userIds },
      'pushSubscriptions.0': { $exists: true },
    })
      .select('pushSubscriptions')
      .lean();

    const payload = {
      title: 'Partido en vivo',
      body: `${matchLabel} empezó — Ver en vivo`,
      url: `/predictions?match=${match.externalId}`,
      matchId: match.externalId,
      notificationKind: 'live',
    };

    sent += await sendPushToUsers(users, payload);
  }

  return { sent, skipped: false };
}
