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
      dsports: 'https://stream.example/dsports.m3u8',
      tyc: 'https://stream.example/tyc.m3u8',
      espn: '',
      'fox-sports': '',
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

  it('devuelve canales default para partidos del mundial', () => {
    const ids = getChannelIdsForMatch('42');
    expect(ids).toContain('dsports');
    expect(ids).toContain('tyc');
  });

  it('aplica override para partidos especiales', () => {
    const ids = getChannelIdsForMatch('19');
    expect(ids).toContain('tv-publica');
    expect(ids).toContain('telefe');
  });

  it('solo incluye canales con URL configurada', () => {
    const channels = getLiveChannelsForMatch('42');
    expect(channels.map((c) => c.id)).toEqual(['dsports', 'tyc']);
    expect(channels[0].url).toBe('https://stream.example/dsports.m3u8');
  });

  it('sustituye placeholders en la URL', () => {
    env.liveStreamUrls.dsports = 'https://stream.example/{matchId}/{channelId}.m3u8';
    expect(resolveStreamUrl('dsports', '19')).toBe(
      'https://stream.example/19/dsports.m3u8'
    );
  });

  it('pickActiveChannel respeta preferencia', () => {
    const channels = getLiveChannelsForMatch('42');
    const picked = pickActiveChannel(channels, 'tyc');
    expect(picked.id).toBe('tyc');
  });
});

describe('streamConfigService', () => {
  const originalEnabled = env.liveStreamEnabled;
  const originalUrls = { ...env.liveStreamUrls };

  beforeEach(() => {
    env.liveStreamEnabled = true;
    env.liveStreamUrls = {
      dsports: 'https://stream.example/dsports.m3u8',
      tyc: 'https://stream.example/tyc.m3u8',
    };
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

  it('rechaza partido finalizado', async () => {
    Match.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({ externalId: '19', status: 'finished' }),
    });
    const result = await getStreamConfig('19');
    expect(result.reason).toBe('not_live');
  });

  it('devuelve config cuando el partido está live', async () => {
    Match.findOne.mockReturnValue({
      lean: () => Promise.resolve({ externalId: '19', status: 'live' }),
    });
    const result = await getStreamConfig('19', 'dsports');
    expect(result.available).toBe(true);
    expect(result.matchId).toBe('19');
    expect(result.active.channelId).toBe('dsports');
    expect(result.active.url).toContain('dsports');
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
