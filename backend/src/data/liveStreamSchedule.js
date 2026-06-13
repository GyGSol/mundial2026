import { env } from '../config/env.js';

/**
 * Catálogo Fubo Sports Network (independiente de broadcastSchedule.js).
 * Plataformas listadas en https://www.fubosportsnetwork.com/
 *
 * `defaultUrl`: enlace oficial cuando no hay LIVE_STREAM_URL_* en env.
 * Solo `fubo-youtube` suele reproducirse embebido; el resto abre app/web externa.
 */

export const LIVE_CHANNELS = {
  'fubo-youtube': {
    id: 'fubo-youtube',
    name: 'Fubo Sports (YouTube)',
    logo: null,
    type: 'youtube',
    envKey: 'LIVE_STREAM_URL_FUBO_YOUTUBE',
    defaultUrl: 'https://www.youtube.com/@FuboSports/live',
  },
  'fubo-web': {
    id: 'fubo-web',
    name: 'Fubo Sports Network',
    logo: null,
    type: 'external',
    envKey: 'LIVE_STREAM_URL_FUBO_WEB',
    defaultUrl: 'https://www.fubosportsnetwork.com/',
  },
  'fubo-app': {
    id: 'fubo-app',
    name: 'Fubo TV',
    logo: null,
    type: 'external',
    envKey: 'LIVE_STREAM_URL_FUBO_APP',
    defaultUrl: 'https://www.fubo.tv/welcome/channel/fubo-sports-network',
  },
  'fubo-roku': {
    id: 'fubo-roku',
    name: 'The Roku Channel',
    logo: null,
    type: 'external',
    envKey: 'LIVE_STREAM_URL_FUBO_ROKU',
    defaultUrl: 'https://therokuchannel.roku.com/',
  },
  'fubo-tubi': {
    id: 'fubo-tubi',
    name: 'Tubi',
    logo: null,
    type: 'external',
    envKey: 'LIVE_STREAM_URL_FUBO_TUBI',
    defaultUrl: 'https://tubitv.com/',
  },
  'fubo-samsung': {
    id: 'fubo-samsung',
    name: 'Samsung TV Plus',
    logo: null,
    type: 'external',
    envKey: 'LIVE_STREAM_URL_FUBO_SAMSUNG',
    defaultUrl: 'https://www.samsung.com/us/tvs/tvplus/',
  },
  'fubo-sling': {
    id: 'fubo-sling',
    name: 'Sling Freestream',
    logo: null,
    type: 'external',
    envKey: 'LIVE_STREAM_URL_FUBO_SLING',
    defaultUrl: 'https://www.sling.com/freestream',
  },
  'fubo-prime': {
    id: 'fubo-prime',
    name: 'Prime Video',
    logo: null,
    type: 'external',
    envKey: 'LIVE_STREAM_URL_FUBO_PRIME',
    defaultUrl: 'https://www.amazon.com/gp/video/storefront',
  },
  'fubo-plex': {
    id: 'fubo-plex',
    name: 'Plex',
    logo: null,
    type: 'external',
    envKey: 'LIVE_STREAM_URL_FUBO_PLEX',
    defaultUrl: 'https://watch.plex.tv/live-tv',
  },
  'fubo-lg': {
    id: 'fubo-lg',
    name: 'LG Channels',
    logo: null,
    type: 'external',
    envKey: 'LIVE_STREAM_URL_FUBO_LG',
    defaultUrl: 'https://www.lg.com/us/tvs/lg-channels',
  },
  'fubo-vizio': {
    id: 'fubo-vizio',
    name: 'Vizio WatchFree+',
    logo: null,
    type: 'external',
    envKey: 'LIVE_STREAM_URL_FUBO_VIZIO',
    defaultUrl: 'https://www.vizio.com/en/watchfreeplus',
  },
  'fubo-tcl': {
    id: 'fubo-tcl',
    name: 'TCL Channels',
    logo: null,
    type: 'external',
    envKey: 'LIVE_STREAM_URL_FUBO_TCL',
    defaultUrl: 'https://www.tcl.com/us/en/tcl-channels',
  },
  'fubo-tablo': {
    id: 'fubo-tablo',
    name: 'Tablo TV',
    logo: null,
    type: 'external',
    envKey: 'LIVE_STREAM_URL_FUBO_TABLO',
    defaultUrl: 'https://www.tablotv.com/',
  },
};

const CHANNEL_DISPLAY_ORDER = [
  'fubo-youtube',
  'fubo-web',
  'fubo-app',
  'fubo-roku',
  'fubo-tubi',
  'fubo-samsung',
  'fubo-sling',
  'fubo-prime',
  'fubo-plex',
  'fubo-lg',
  'fubo-vizio',
  'fubo-tcl',
  'fubo-tablo',
];

/** Todos los partidos del Mundial usan la grilla Fubo Sports Network. */
const DEFAULT_MATCH_CHANNELS = CHANNEL_DISPLAY_ORDER;

function isWorldCupMatchId(externalId) {
  if (!externalId || String(externalId).startsWith('sim-')) return false;
  return /^\d+$/.test(String(externalId));
}

export function getChannelIdsForMatch(externalId) {
  if (!isWorldCupMatchId(externalId)) return [];
  return DEFAULT_MATCH_CHANNELS;
}

export function resolveStreamUrl(channelId, matchExternalId) {
  const channel = LIVE_CHANNELS[channelId];
  if (!channel) return null;

  const baseUrl = (env.liveStreamUrls[channelId] || channel.defaultUrl || '').trim();
  if (!baseUrl) return null;

  return baseUrl
    .replace('{matchId}', String(matchExternalId ?? ''))
    .replace('{channelId}', channelId)
    .trim();
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
