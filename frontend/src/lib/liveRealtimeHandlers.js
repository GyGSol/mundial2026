import { REALTIME_EVENTS, isLiveMatchReason } from './realtimeSectors.js';
import { mergeLiveSnapshot } from './patchLiveMatchSnapshot.js';

/**
 * Parchea live/recent desde snapshot en lugar de refetch completo.
 * @returns {boolean} true si consumió el evento (skip refresh)
 */
export function handleLiveSnapshotRealtime(msg, { patchData, fetchSnapshot }) {
  if (msg?.type !== REALTIME_EVENTS.MATCHES_UPDATED) return false;
  if (!isLiveMatchReason(msg.reason)) return false;
  if (typeof patchData !== 'function' || typeof fetchSnapshot !== 'function') return false;

  void fetchSnapshot()
    .then((snapshot) => {
      if (!snapshot) return;
      patchData((prev) => mergeLiveSnapshot(prev, snapshot));
    })
    .catch(() => {});

  return true;
}
