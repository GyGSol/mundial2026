import { env } from '../config/env.js';
import { getBroadcastersForMatch } from '../data/broadcastSchedule.js';

/** Slugs probados en la18hd.com/vivo/canales.php */
const LA18_SLUG_BY_BROADCASTER = {
  disney: 'disney6',
  telefe: 'telefe',
  tyc: 'tyc',
  dsports: 'dsports',
};

const LA18_BROADCASTER_PRIORITY = ['disney', 'telefe', 'tyc', 'dsports'];

export function buildLa18ChannelPageUrl(streamSlug) {
  const slug = String(streamSlug ?? '').trim();
  if (!slug) return null;
  return `${env.la18hdBaseUrl}/vivo/canales.php?stream=${encodeURIComponent(slug)}`;
}

/**
 * Elige el canal La18HD según la tele en Argentina (broadcastSchedule).
 * Prioridad: Disney+ / Telefe / TyC / DSports.
 */
export function resolveLa18StreamSlug(externalId, options = {}) {
  const broadcasterIds = new Set(
    getBroadcastersForMatch(externalId, options).map((row) => row.id)
  );

  for (const key of LA18_BROADCASTER_PRIORITY) {
    if (broadcasterIds.has(key) && LA18_SLUG_BY_BROADCASTER[key]) {
      return LA18_SLUG_BY_BROADCASTER[key];
    }
  }

  return LA18_SLUG_BY_BROADCASTER.dsports;
}

export function resolveAutoLa18Mapping(externalId, options = {}) {
  const id = String(externalId ?? '').trim();
  if (!id || id.startsWith('sim-')) return null;

  const streamSlug = resolveLa18StreamSlug(id, options);
  const la18PageUrl = buildLa18ChannelPageUrl(streamSlug);
  if (!la18PageUrl) return null;

  return {
    matchExternalId: String(externalId),
    la18EventId: streamSlug,
    la18PageUrl,
    embedUrl: la18PageUrl,
    enabled: true,
    auto: true,
  };
}
