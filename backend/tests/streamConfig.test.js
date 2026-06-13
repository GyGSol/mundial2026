import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from '../src/config/env.js';
import {
  getChannelIdsForMatch,
  getLiveChannelsForMatch,
  pickActiveChannel,
  resolveStreamUrl,
} from '../src/data/liveStreamSchedule.js';
import { getStreamConfig } from '../src/services/streamConfigService.js';
import { Match } from '../src/models/Match.js';

describe('liveStreamSchedule', () => {
  const originalEnabled = env.liveStreamEnabled;
  const originalUrls = { ...env.liveStreamUrls };

  beforeEach(() => {
    env.liveStreamEnabled = true;
    env.liveStreamUrls = {
      'fubo-youtube': '',
      'fubo-web': '',
    };
  });

  afterEach(() => {
    env.liveStreamEnabled = originalEnabled;
    env.liveStreamUrls = originalUrls;
  });

  it('ignora partidos de simulación', () => {
    expect(getChannelIdsForMatch('sim-abc-1')).toEqual([]);
    expect(getLiveChannelsForMatch('sim-abc-1')).toEqual([]);
  });

  it('devuelve canales Fubo para partidos del mundial', () => {
    const ids = getChannelIdsForMatch('42');
    expect(ids).toContain('fubo-youtube');
    expect(ids).toContain('fubo-tubi');
  });

  it('usa defaultUrl oficial cuando no hay env', () => {
    const channels = getLiveChannelsForMatch('42');
    const youtube = channels.find((c) => c.id === 'fubo-youtube');
    expect(youtube?.url).toContain('youtube.com/@FuboSports');
  });

  it('prioriza env sobre defaultUrl', () => {
    env.liveStreamUrls['fubo-youtube'] = 'https://youtube.com/watch?v=custom';
    expect(resolveStreamUrl('fubo-youtube', '19')).toBe('https://youtube.com/watch?v=custom');
  });

  it('sustituye placeholders en la URL', () => {
    env.liveStreamUrls['fubo-youtube'] = 'https://stream.example/{matchId}/{channelId}';
    expect(resolveStreamUrl('fubo-youtube', '19')).toBe(
      'https://stream.example/19/fubo-youtube'
    );
  });

  it('pickActiveChannel respeta preferencia', () => {
    const channels = getLiveChannelsForMatch('42');
    const picked = pickActiveChannel(channels, 'fubo-web');
    expect(picked.id).toBe('fubo-web');
  });
});

describe('streamConfigService', () => {
  const originalEnabled = env.liveStreamEnabled;
  const originalUrls = { ...env.liveStreamUrls };

  beforeEach(() => {
    env.liveStreamEnabled = true;
    env.liveStreamUrls = {};
    vi.spyOn(Match, 'findOne').mockReset();
  });

  afterEach(() => {
    env.liveStreamEnabled = originalEnabled;
    env.liveStreamUrls = originalUrls;
    vi.restoreAllMocks();
  });

  it('rechaza cuando el módulo está deshabilitado', async () => {
    env.liveStreamEnabled = false;
    const result = await getStreamConfig('19');
    expect(result).toEqual({ available: false, reason: 'disabled' });
  });

  it('rechaza partido inexistente', async () => {
    Match.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    const result = await getStreamConfig('999');
    expect(result.reason).toBe('not_found');
  });

  it('rechaza partido que no está en vivo', async () => {
    Match.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({ externalId: '19', status: 'upcoming' }),
    });
    const result = await getStreamConfig('19');
    expect(result).toMatchObject({ available: false, reason: 'not_live', status: 'upcoming' });
  });

  it('devuelve config cuando el partido está live', async () => {
    Match.findOne.mockReturnValue({
      lean: () => Promise.resolve({ externalId: '19', status: 'live' }),
    });
    const result = await getStreamConfig('19', 'fubo-youtube');
    expect(result.available).toBe(true);
    expect(result.matchId).toBe('19');
    expect(result.active.channelId).toBe('fubo-youtube');
    expect(result.active.url).toContain('FuboSports');
    expect(result.channels.length).toBeGreaterThan(0);
  });

  it('rechaza canal inválido', async () => {
    Match.findOne.mockReturnValue({
      lean: () => Promise.resolve({ externalId: '42', status: 'live' }),
    });
    const result = await getStreamConfig('42', 'nonexistent');
    expect(result.reason).toBe('invalid_channel');
  });
});
