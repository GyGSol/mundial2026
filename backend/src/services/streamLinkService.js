import { Match } from '../models/Match.js';
import { StreamLinkMapping } from '../models/StreamLinkMapping.js';
import { Team } from '../models/Team.js';
import { env } from '../config/env.js';
import { resolveStreamUrl } from '../data/liveStreamSchedule.js';
import { resolveFptStreamsForMatch } from './fptScraper.js';
import {
  inferStreamSourceKind,
  resolveEffectiveStreamSources,
} from './streamMetaService.js';
import { isStreamWatchEligible } from './streamWatchEligibility.js';

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

async function loadTeamsForMatch(match) {
  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);
  return { homeTeam, awayTeam };
}

function pickStreamSource(sources, sourceId) {
  if (!sources?.length) return null;
  if (!sourceId) return sources[0];

  const id = String(sourceId).trim();
  return sources.find((source) => source.id === id) || sources[0];
}

async function buildPrimaryFromSource(source) {
  if (!source?.url) return null;

  return {
    provider: 'fpt',
    type: 'iframe',
    type: 'iframe',
    url: source.embedUrl || source.url,
    hlsUrl: null,
    eventId: source.eventId || source.id || null,
    pageUrl: source.pageUrl || source.url,
    label: source.label,
    sourceKey: source.id,
    embeddable: source.embeddable !== false,
  };
}

/**
 * @param {string} matchExternalId
 * @param {import('mongoose').Types.ObjectId} [_userId]
 * @param {{ sourceId?: string }} [options]
 */
export async function getMatchStreamConfig(matchExternalId, _userId, options = {}) {
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

  if (!isStreamWatchEligible(match)) {
    return {
      available: false,
      reason: 'not_available',
      matchId: match.externalId,
      status: match.status,
    };
  }

  const explicitMapping = await StreamLinkMapping.findOne({
    matchExternalId: id,
    enabled: true,
  }).lean();

  const { homeTeam, awayTeam } = await loadTeamsForMatch(match);

  let fptEvent = null;
  let fptStreams = [];
  try {
    const resolved = await resolveFptStreamsForMatch(match, { homeTeam, awayTeam });
    fptEvent = resolved.event;
    fptStreams = resolved.streams;
  } catch {
    fptStreams = [];
  }

  const sources = resolveEffectiveStreamSources(match, explicitMapping, fptStreams, {
    homeTeam,
    awayTeam,
  });
  const fallback = buildFallbackConfig(match.externalId);

  if (!sources.length) {
    return {
      available: false,
      reason: 'no_stream_mapping',
      matchId: match.externalId,
      status: match.status,
      fallback,
      sources: [],
    };
  }

  const selected = pickStreamSource(sources, options.sourceId);
  const primary = await buildPrimaryFromSource(selected);
  const sourceKind = inferStreamSourceKind(explicitMapping, selected);

  return {
    available: true,
    matchId: match.externalId,
    status: match.status,
    source: sourceKind,
    event: fptEvent,
    sources: sources.map((source) => ({
      id: source.id,
      label: source.label,
      language: source.language || '',
      url: source.url,
      embeddable: source.embeddable !== false,
      origin: source.source || 'fpt',
    })),
    selectedSourceId: selected?.id || null,
    primary,
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
