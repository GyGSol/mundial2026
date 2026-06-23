import webpush from 'web-push';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Prediction } from '../models/Prediction.js';
import { Team } from '../models/Team.js';

let vapidConfigured = false;

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  predictionLockReminder: true,
  matchLiveStart: true,
  goals: true,
};

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

export function normalizeNotificationPreferences(preferences = {}) {
  return {
    predictionLockReminder:
      preferences.predictionLockReminder ?? DEFAULT_NOTIFICATION_PREFERENCES.predictionLockReminder,
    matchLiveStart: preferences.matchLiveStart ?? DEFAULT_NOTIFICATION_PREFERENCES.matchLiveStart,
    goals: preferences.goals ?? DEFAULT_NOTIFICATION_PREFERENCES.goals,
  };
}

export function getNotificationPreferences(user) {
  return normalizeNotificationPreferences(user?.notificationPreferences ?? {});
}

export async function getPushPreferencesForUser(userId) {
  const user = await User.findById(userId)
    .select('pushSubscriptions notificationPreferences')
    .lean();
  if (!user) {
    throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
  }
  return {
    subscribed: Boolean(user.pushSubscriptions?.length),
    preferences: getNotificationPreferences(user),
  };
}

export async function updatePushPreferencesForUser(userId, patch = {}) {
  const allowedKeys = ['predictionLockReminder', 'matchLiveStart', 'goals'];
  const update = {};
  for (const key of allowedKeys) {
    if (patch[key] !== undefined) {
      if (typeof patch[key] !== 'boolean') {
        throw Object.assign(new Error(`Preferencia inválida: ${key}`), { status: 400 });
      }
      update[`notificationPreferences.${key}`] = patch[key];
    }
  }
  if (!Object.keys(update).length) {
    throw Object.assign(new Error('No hay cambios para guardar'), { status: 400 });
  }

  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
    .select('pushSubscriptions notificationPreferences')
    .lean();
  if (!user) {
    throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
  }

  return {
    subscribed: Boolean(user.pushSubscriptions?.length),
    preferences: getNotificationPreferences(user),
  };
}

export function userHasNotificationPreference(user, preferenceKey) {
  return getNotificationPreferences(user)[preferenceKey] !== false;
}

export function filterUsersByNotificationPreference(users = [], preferenceKey) {
  return users.filter((user) => userHasNotificationPreference(user, preferenceKey));
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

function formatTeamLabel(team) {
  if (!team) return 'Equipo';
  return team.nameEn || team.fifaCode || 'Equipo';
}

export function formatTournamentGoalOrdinal(count) {
  if (count === 1) return '1.er gol en el torneo';
  if (count === 2) return '2.º gol en el torneo';
  if (count === 3) return '3.er gol en el torneo';
  return `${count}.º gol en el torneo`;
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
 * Notifica a usuarios sin predicción cargada que el cierre es en ~30 minutos.
 * @param {import('mongoose').Document|object} match
 * @param {Array<{ _id: import('mongoose').Types.ObjectId, pushSubscriptions?: object[], notificationPreferences?: object }>} users
 */
export async function notifyPredictionLockClosing(match, users = []) {
  const eligible = filterUsersByNotificationPreference(users, 'predictionLockReminder');
  if (!eligible.length) return { sent: 0, skipped: true };
  if (!ensureVapidConfigured()) return { sent: 0, skipped: true, reason: 'push_disabled' };

  const matchLabel = await buildMatchLabel(match);
  const payload = {
    title: 'Cierra pronto tu predicción',
    body: `${matchLabel} — te quedan 30 min para cargar tu marcador`,
    url: `/predictions?match=${match.externalId}`,
    matchId: match.externalId,
    notificationKind: 'lock',
  };

  const sent = await sendPushToUsers(eligible, payload);
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
      'notificationPreferences.matchLiveStart': { $ne: false },
    })
      .select('pushSubscriptions notificationPreferences')
      .lean();

    const eligible = filterUsersByNotificationPreference(users, 'matchLiveStart');
    if (!eligible.length) continue;

    const payload = {
      title: 'Partido en vivo',
      body: `${matchLabel} empezó — Ver en vivo`,
      url: `/predictions?match=${match.externalId}`,
      matchId: match.externalId,
      notificationKind: 'live',
    };

    sent += await sendPushToUsers(eligible, payload);
  }

  return { sent, skipped: false };
}

/**
 * Notifica gol en vivo a usuarios con toggle de goles activo.
 * @param {object} params
 */
export async function notifyGoalScored({
  match,
  goalEvent,
  scoringTeam,
  opponentTeam,
  homeScore,
  awayScore,
  tournamentGoalNumber,
  pointsBeforeByUserId = new Map(),
}) {
  if (!ensureVapidConfigured()) return { sent: 0, skipped: true, reason: 'push_disabled' };

  const users = await User.find({
    'pushSubscriptions.0': { $exists: true },
    'notificationPreferences.goals': { $ne: false },
  })
    .select('pushSubscriptions notificationPreferences')
    .lean();

  const eligible = filterUsersByNotificationPreference(users, 'goals');
  if (!eligible.length) return { sent: 0, skipped: true };

  const scorer = goalEvent.player || 'Jugador';
  const teamLabel = formatTeamLabel(scoringTeam);
  const teamCode = scoringTeam?.fifaCode || '';
  const opponentLabel = formatTeamLabel(opponentTeam);
  const scoreLine = `${homeScore}-${awayScore}`;
  const tournamentLine = tournamentGoalNumber
    ? ` (${formatTournamentGoalOrdinal(tournamentGoalNumber)})`
    : '';

  const predictions = await Prediction.find({ matchId: match._id })
    .select('userId pointsEarned')
    .lean();
  const pointsByUserId = new Map(
    predictions.map((prediction) => [String(prediction.userId), prediction.pointsEarned ?? 0])
  );

  let sent = 0;
  const goalKey = goalEvent.goalKey;

  for (const user of eligible) {
    const userId = String(user._id);
    const currentPoints = pointsByUserId.get(userId);
    const previousPoints = pointsBeforeByUserId.get(userId);
    let pointsSuffix = '';
    if (currentPoints != null) {
      if (previousPoints != null && previousPoints !== currentPoints) {
        const delta = currentPoints - previousPoints;
        const deltaLabel = delta > 0 ? `+${delta}` : String(delta);
        pointsSuffix = ` Tus puntos: ${currentPoints} (${deltaLabel}).`;
      } else {
        pointsSuffix = ` Tus puntos: ${currentPoints}.`;
      }
    }

    const payload = {
      title: `¡Gol de ${teamLabel}!`,
      body: `${scorer}${tournamentLine} — ${teamCode || teamLabel} ${scoreLine} vs ${opponentLabel}.${pointsSuffix}`,
      url: `/predictions?match=${match.externalId}`,
      matchId: match.externalId,
      notificationKind: 'goal',
      goalKey,
      scorer,
      country: teamCode || teamLabel,
      tournamentGoalNumber: tournamentGoalNumber ?? null,
      score: scoreLine,
      pointsEarned: currentPoints ?? null,
    };

    const subscription = pickLatestPushSubscription(user.pushSubscriptions ?? []);
    if (!subscription) continue;
    const result = await sendToSubscription(subscription, payload);
    if (result.ok) sent += 1;
  }

  return { sent, skipped: false };
}
