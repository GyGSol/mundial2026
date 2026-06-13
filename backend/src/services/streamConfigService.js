import { Match } from '../models/Match.js';
import { env } from '../config/env.js';
import {
  getLiveChannelsForMatch,
  pickActiveChannel,
} from '../data/liveStreamSchedule.js';

/**
 * @param {string} matchId externalId del partido
 * @param {string} [channelId]
 */
export async function getStreamConfig(matchId, channelId) {
  if (!env.liveStreamEnabled) {
    return { available: false, reason: 'disabled' };
  }

  if (!matchId?.trim()) {
    return { available: false, reason: 'missing_match_id' };
  }

  const match = await Match.findOne({ externalId: String(matchId).trim() }).lean();
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

  const channels = getLiveChannelsForMatch(match.externalId).map(({ url, ...meta }) => meta);
  const channelsWithUrls = getLiveChannelsForMatch(match.externalId);

  if (!channelsWithUrls.length) {
    return {
      available: false,
      reason: 'no_streams',
      matchId: match.externalId,
      status: match.status,
    };
  }

  if (channelId) {
    const explicit = channelsWithUrls.find((c) => c.id === channelId);
    if (!explicit) {
      return {
        available: false,
        reason: 'invalid_channel',
        matchId: match.externalId,
        status: match.status,
      };
    }
  }

  const activeChannel = pickActiveChannel(channelsWithUrls, channelId);
  if (!activeChannel) {
    return {
      available: false,
      reason: 'no_streams',
      matchId: match.externalId,
      status: match.status,
    };
  }

  return {
    available: true,
    matchId: match.externalId,
    status: match.status,
    channels,
    active: {
      channelId: activeChannel.id,
      url: activeChannel.url,
      type: activeChannel.type,
    },
    expiresAt: null,
  };
}
