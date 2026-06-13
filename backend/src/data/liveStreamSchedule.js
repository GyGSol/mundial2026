import { env } from '../config/env.js';

/**
 * Catálogo de canales para el módulo Live Match (independiente de broadcastSchedule.js).
 * URLs configurables vía env LIVE_STREAM_URL_<CHANNEL_ID>.
 */

export const LIVE_CHANNELS = {
  dsports: {
    id: 'dsports',
    name: 'DSports',
    logo: '/broadcasters/dsports.svg',
    type: 'hls',
    envKey: 'LIVE_STREAM_URL_DSPORTS',
  },
  dsports2: {
    id: 'dsports2',
    name: 'DSports 2',
    logo: '/broadcasters/dsports.svg',
    type: 'hls',
    envKey: 'LIVE_STREAM_URL_DSPORTS2',
  },
  tyc: {
    id: 'tyc',
    name: 'TyC Sports',
    logo: '/broadcasters/tyc.svg',
    type: 'hls',
    envKey: 'LIVE_STREAM_URL_TYC',
  },
  telefe: {
    id: 'telefe',
    name: 'Telefe',
    logo: '/broadcasters/telefe.svg',
    type: 'hls',
    envKey: 'LIVE_STREAM_URL_TELEFE',
  },
  disney: {
    id: 'disney',
    name: 'Disney+',
    logo: '/broadcasters/disney.svg',
    type: 'embed',
    envKey: 'LIVE_STREAM_URL_DISNEY',
  },
  'tv-publica': {
    id: 'tv-publica',
    name: 'TV Pública',
    logo: '/broadcasters/tv-publica.svg',
    type: 'hls',
    envKey: 'LIVE_STREAM_URL_TV_PUBLICA',
  },
  espn: {
    id: 'espn',
    name: 'ESPN',
    logo: null,
    type: 'hls',
    envKey: 'LIVE_STREAM_URL_ESPN',
  },
  'fox-sports': {
    id: 'fox-sports',
    name: 'Fox Sports',
    logo: null,
    type: 'hls',
    envKey: 'LIVE_STREAM_URL_FOX_SPORTS',
  },
};

/** Orden de preferencia cuando hay varios canales con URL. */
const CHANNEL_DISPLAY_ORDER = [
  'dsports',
  'dsports2',
  'tyc',
  'telefe',
  'disney',
  'tv-publica',
  'espn',
  'fox-sports',
];

/**
 * Canales por defecto para cualquier partido del Mundial (externalId numérico).
 * Override opcional por partido en MATCH_CHANNEL_OVERRIDES.
 */
const DEFAULT_MATCH_CHANNELS = ['dsports', 'tyc', 'espn', 'fox-sports'];

/** externalId → channel ids (solo cuando difiere del default). */
const MATCH_CHANNEL_OVERRIDES = {
  // Argentina vs Argelia — más señales locales
  19: ['tv-publica', 'telefe', 'tyc', 'disney', 'dsports'],
};

function isWorldCupMatchId(externalId) {
  if (!externalId || String(externalId).startsWith('sim-')) return false;
  return /^\d+$/.test(String(externalId));
}

export function getChannelIdsForMatch(externalId) {
  if (!isWorldCupMatchId(externalId)) return [];
  const id = String(externalId);
  const override = MATCH_CHANNEL_OVERRIDES[id];
  return override ?? DEFAULT_MATCH_CHANNELS;
}

export function resolveStreamUrl(channelId, matchExternalId) {
  const channel = LIVE_CHANNELS[channelId];
  if (!channel) return null;

  const baseUrl = env.liveStreamUrls[channelId] || '';
  if (!baseUrl.trim()) return null;

  const url = baseUrl
    .replace('{matchId}', String(matchExternalId ?? ''))
    .replace('{channelId}', channelId);

  return url.trim() || null;
}

export function getLiveChannelMeta(channelId) {
  const channel = LIVE_CHANNELS[channelId];
  if (!channel) return null;

  return {
    id: channel.id,
    name: channel.name,
    logo: channel.logo,
    type: channel.type,
  };
}

/**
 * Canales aplicables al partido que tengan URL configurada en el backend.
 */
export function getLiveChannelsForMatch(externalId) {
  if (!env.liveStreamEnabled) return [];

  const channelIds = getChannelIdsForMatch(externalId);
  return CHANNEL_DISPLAY_ORDER.filter((id) => channelIds.includes(id))
    .map((id) => {
      const meta = getLiveChannelMeta(id);
      const url = resolveStreamUrl(id, externalId);
      if (!meta || !url) return null;
      return { ...meta, url };
    })
    .filter(Boolean);
}

export function pickActiveChannel(channels, preferredChannelId) {
  if (!channels?.length) return null;
  if (preferredChannelId) {
    const preferred = channels.find((c) => c.id === preferredChannelId);
    if (preferred) return preferred;
  }
  return channels[0];
}
