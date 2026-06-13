import { Match } from '../models/Match.js';
import { StreamLinkMapping } from '../models/StreamLinkMapping.js';
import { env } from '../config/env.js';
import { resolveStreamUrl } from '../data/liveStreamSchedule.js';

function buildFallbackConfig(matchExternalId) {
  const fuboUrl = resolveStreamUrl('fubo-youtube', matchExternalId);
  if (!fuboUrl) return null;

  return {
    provider: 'fubo',
    type: 'youtube',
    url: fuboUrl,
    externalUrl: 'https://www.fubosportsnetwork.com/',
  };
}

/**
 * @param {string} matchExternalId
 * @param {import('mongoose').Types.ObjectId} [_userId]
 */
export async function getMatchStreamConfig(matchExternalId, _userId) {
  if (!env.liveStreamEnabled) {
    return { available: false, reason: 'disabled' };
  }

  const id = String(matchExternalId ?? '').trim();
  if (!id) {
    return { available: false, reason: 'missing_match_id' };
  }

  const match = await Match.findOne({ externalId: id }).lean();
  if (!match) {
    return { available: false, reason: 'not_found' };
  }

  if (match.status !== 'live') {
    return {
      available: false,
      reason: 'not_live',
      matchId: match.externalId,
      status: match.status,
    };
  }

  const mapping = await StreamLinkMapping.findOne({
    matchExternalId: id,
    enabled: true,
  }).lean();

  const fallback = buildFallbackConfig(match.externalId);

  if (!mapping) {
    return {
      available: false,
      reason: 'no_la18_mapping',
      matchId: match.externalId,
      status: match.status,
      fallback,
    };
  }

  return {
    available: true,
    matchId: match.externalId,
    status: match.status,
    primary: {
      provider: 'la18hd',
      type: 'iframe',
      url: mapping.embedUrl,
      eventId: mapping.la18EventId || null,
      pageUrl: mapping.la18PageUrl,
    },
    fallback,
    expiresAt: null,
  };
}

export async function listStreamLinkMappings() {
  return StreamLinkMapping.find().sort({ matchExternalId: 1 }).lean();
}

export async function upsertStreamLinkMapping(matchExternalId, payload, adminUsername = '') {
  const id = String(matchExternalId ?? '').trim();
  if (!id) {
    throw new Error('matchExternalId requerido');
  }

  const la18PageUrl = String(payload.la18PageUrl ?? '').trim();
  const embedUrl = String(payload.embedUrl ?? la18PageUrl).trim();
  if (!la18PageUrl) {
    throw new Error('la18PageUrl requerido');
  }

  const match = await Match.findOne({ externalId: id }).lean();
  if (!match) {
    throw new Error('Partido no encontrado');
  }

  const doc = await StreamLinkMapping.findOneAndUpdate(
    { matchExternalId: id },
    {
      matchExternalId: id,
      la18EventId: String(payload.la18EventId ?? '').trim(),
      la18PageUrl,
      embedUrl,
      enabled: payload.enabled !== false,
      notes: String(payload.notes ?? '').trim(),
      updatedBy: adminUsername,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return doc;
}

export async function deleteStreamLinkMapping(matchExternalId) {
  const id = String(matchExternalId ?? '').trim();
  const result = await StreamLinkMapping.findOneAndDelete({ matchExternalId: id });
  return Boolean(result);
}
