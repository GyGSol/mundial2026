import { env } from '../config/env.js';
import { getBroadcastersForMatch } from '../data/broadcastSchedule.js';

/** Slugs en futbolparatodos.su/canal/{slug}.html */
const FPT_CHANNEL_BY_BROADCASTER = {
  disney: 'espnpremium',
  telefe: 'tntsports',
  tyc: 'fox1',
  dsports: 'dsports',
};

const FPT_BROADCASTER_PRIORITY = ['disney', 'telefe', 'tyc', 'dsports'];

export function buildFptChannelPageUrl(channelSlug) {
  const slug = String(channelSlug ?? '').trim();
  if (!slug) return null;
  return `${env.fptBaseUrl}/canal/${slug}.html`;
}

/**
 * Elige el canal FPT según la tele en Argentina (broadcastSchedule).
 * Prioridad: Disney+ / Telefe / TyC / DSports.
 */
export function resolveFptChannelSlug(externalId, options = {}) {
  const broadcasterIds = new Set(
    getBroadcastersForMatch(externalId, options).map((row) => row.id)
  );

  for (const key of FPT_BROADCASTER_PRIORITY) {
    if (broadcasterIds.has(key) && FPT_CHANNEL_BY_BROADCASTER[key]) {
      return FPT_CHANNEL_BY_BROADCASTER[key];
    }
  }

  return FPT_CHANNEL_BY_BROADCASTER.dsports;
}

export function resolveAutoFptMapping(externalId, options = {}) {
  const id = String(externalId ?? '').trim();
  if (!id || id.startsWith('sim-')) return null;

  const channelSlug = resolveFptChannelSlug(id, options);
  const pageUrl = buildFptChannelPageUrl(channelSlug);
  if (!pageUrl) return null;

  return {
    matchExternalId: String(externalId),
    la18EventId: channelSlug,
    la18PageUrl: pageUrl,
    embedUrl: pageUrl,
    enabled: true,
    auto: true,
  };
}
