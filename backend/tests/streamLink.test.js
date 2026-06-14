import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { Match } from '../src/models/Match.js';
import { StreamLinkMapping } from '../src/models/StreamLinkMapping.js';
import { Team } from '../src/models/Team.js';
import {
  getMatchStreamConfig,
  listStreamLinkMappings,
  upsertStreamLinkMapping,
  deleteStreamLinkMapping,
} from '../src/services/streamLinkService.js';
import * as la18hdScraper from '../src/services/la18hdScraper.js';

const SAMPLE_STREAMS = [
  {
    id: 'dsports',
    label: 'DSports',
    language: 'Español',
    url: 'https://la18hd.com/vivo/canales.php?stream=dsports',
    pageUrl: 'https://la18hd.com/vivo/canales.php?stream=dsports',
    embedUrl: 'https://la18hd.com/vivo/canales.php?stream=dsports',
    eventId: 'dsports',
    embeddable: true,
    provider: 'la18hd',
  },
  {
    id: 'tycsports',
    label: 'TyC Sports',
    language: 'Español',
    url: 'https://la18hd.com/vivo/canales.php?stream=tycsports',
    pageUrl: 'https://la18hd.com/vivo/canales.php?stream=tycsports',
    embedUrl: 'https://la18hd.com/vivo/canales.php?stream=tycsports',
    eventId: 'tycsports',
    embeddable: true,
    provider: 'la18hd',
  },
];

describe('streamLinkService', () => {
  const originalEnabled = env.liveStreamEnabled;
  const originalUrls = { ...env.liveStreamUrls };

  beforeEach(() => {
    env.liveStreamEnabled = true;
    env.liveStreamUrls = {};
    vi.spyOn(Match, 'findOne').mockReset();
    vi.spyOn(StreamLinkMapping, 'findOne').mockReset();
    vi.spyOn(Team, 'findOne').mockReset();
    vi.spyOn(Team, 'findOne').mockReturnValue({ lean: () => Promise.resolve(null) });
    vi.spyOn(la18hdScraper, 'fetchLa18HlsUrl').mockResolvedValue(null);
    vi.spyOn(la18hdScraper, 'resolveLa18StreamsForMatch').mockResolvedValue({
      event: { title: 'Copa del Mundo: Haití vs Escocia' },
      streams: SAMPLE_STREAMS,
      sourceUrl: 'https://la18hd.com/eventos/json/agenda123.json',
    });
  });

  afterEach(() => {
    env.liveStreamEnabled = originalEnabled;
    env.liveStreamUrls = originalUrls;
    vi.restoreAllMocks();
  });

  it('rechaza cuando el módulo está deshabilitado', async () => {
    env.liveStreamEnabled = false;
    const result = await getMatchStreamConfig('19');
    expect(result).toEqual({ available: false, reason: 'disabled' });
  });

  it('rechaza partido inexistente', async () => {
    Match.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    const result = await getMatchStreamConfig('999');
    expect(result.reason).toBe('not_found');
  });

  it('rechaza partido upcoming con predicciones abiertas', async () => {
    Match.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          externalId: '19',
          status: 'upcoming',
          kickoffAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
        }),
    });
    const result = await getMatchStreamConfig('19');
    expect(result).toMatchObject({ available: false, reason: 'not_available', status: 'upcoming' });
  });

  it('permite calentamiento y devuelve todas las señales La18HD', async () => {
    Match.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          externalId: '5',
          status: 'upcoming',
          kickoffAt: new Date(Date.now() + 30 * 60 * 1000),
          homeTeamId: 'HTI',
          awayTeamId: 'SCO',
        }),
    });
    StreamLinkMapping.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const result = await getMatchStreamConfig('5');
    expect(result.available).toBe(true);
    expect(result.status).toBe('upcoming');
    expect(result.source).toBe('la18hd');
    expect(result.sources).toHaveLength(2);
    expect(result.primary.pageUrl).toContain('stream=dsports');
  });

  it('respeta sourceId al elegir señal', async () => {
    Match.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          externalId: '5',
          status: 'live',
          kickoffAt: new Date(),
        }),
    });
    StreamLinkMapping.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const result = await getMatchStreamConfig('5', undefined, { sourceId: 'tycsports' });
    expect(result.selectedSourceId).toBe('tycsports');
    expect(result.primary.pageUrl).toContain('stream=tycsports');
  });

  it('respeta mapping admin y mantiene otras señales', async () => {
    Match.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          externalId: '7',
          status: 'live',
          kickoffAt: new Date(),
          homeTeamId: 'BRA',
          awayTeamId: 'MAR',
        }),
    });
    StreamLinkMapping.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          matchExternalId: '7',
          la18PageUrl: 'https://la18hd.com/vivo/canales.php?stream=disney6',
          embedUrl: 'https://la18hd.com/vivo/canales.php?stream=disney6',
          la18EventId: 'disney6',
          enabled: true,
        }),
    });

    const result = await getMatchStreamConfig('7');
    expect(result.available).toBe(true);
    expect(result.source).toBe('admin');
    expect(result.sources.some((row) => row.id === 'disney6')).toBe(true);
  });

  it('rechaza partido que no está en vivo ni en calentamiento', async () => {
    Match.findOne.mockReturnValue({
      lean: () => Promise.resolve({ externalId: '19', status: 'finished' }),
    });
    const result = await getMatchStreamConfig('19');
    expect(result).toMatchObject({ available: false, reason: 'not_available', status: 'finished' });
  });

  it('rechaza sin streams La18 (simulación)', async () => {
    la18hdScraper.resolveLa18StreamsForMatch.mockResolvedValueOnce({
      event: null,
      streams: [],
      sourceUrl: '',
    });

    Match.findOne.mockReturnValue({
      lean: () => Promise.resolve({ externalId: 'sim-1', status: 'live' }),
    });
    StreamLinkMapping.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const result = await getMatchStreamConfig('sim-1');
    expect(result).toMatchObject({
      available: false,
      reason: 'no_la18_mapping',
      matchId: 'sim-1',
    });
    expect(result.fallback?.provider).toBe('fubo');
  });

  it('usa canal auto por televisor cuando la agenda no tiene el partido', async () => {
    la18hdScraper.resolveLa18StreamsForMatch.mockResolvedValueOnce({
      event: null,
      streams: [],
      sourceUrl: '',
    });

    Match.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          externalId: '5',
          status: 'live',
          kickoffAt: new Date(),
          homeTeamId: 'HTI',
          awayTeamId: 'SCO',
        }),
    });
    StreamLinkMapping.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const result = await getMatchStreamConfig('5');
    expect(result.available).toBe(true);
    expect(result.source).toBe('auto');
    expect(result.sources).toHaveLength(1);
    expect(result.primary.pageUrl).toContain('stream=dsports');
  });

  it('devuelve config La18 con fallback Fubo cuando está live', async () => {
    Match.findOne.mockReturnValue({
      lean: () => Promise.resolve({ externalId: '19', status: 'live' }),
    });
    StreamLinkMapping.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const result = await getMatchStreamConfig('19');
    expect(result.available).toBe(true);
    expect(result.primary).toMatchObject({
      provider: 'la18hd',
      type: 'iframe',
      hlsUrl: null,
    });
    expect(result.fallback?.provider).toBe('fubo');
    expect(result.fallback?.type).toBe('youtube');
  });

  it('devuelve HLS directo cuando La18HD expone m3u8', async () => {
    la18hdScraper.fetchLa18HlsUrl.mockResolvedValueOnce(
      'https://cgxheq.fubo18.com/disney6/mono.m3u8?token=test-d0-1-2'
    );

    Match.findOne.mockReturnValue({
      lean: () => Promise.resolve({ externalId: '7', status: 'live' }),
    });
    StreamLinkMapping.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          matchExternalId: '7',
          la18PageUrl: 'https://la18hd.com/vivo/canales.php?stream=disney6',
          embedUrl: 'https://la18hd.com/vivo/canales.php?stream=disney6',
          enabled: true,
        }),
    });

    const result = await getMatchStreamConfig('7');
    expect(result.primary.type).toBe('hls');
    expect(result.primary.hlsUrl).toContain('.m3u8');
  });
});

describe('streamLinkService admin helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listStreamLinkMappings ordena por matchExternalId', async () => {
    const sortMock = vi.fn().mockReturnValue({
      lean: () => Promise.resolve([{ matchExternalId: '1' }]),
    });
    vi.spyOn(StreamLinkMapping, 'find').mockReturnValue({ sort: sortMock });

    const rows = await listStreamLinkMappings();
    expect(rows).toHaveLength(1);
    expect(sortMock).toHaveBeenCalledWith({ matchExternalId: 1 });
  });

  it('upsertStreamLinkMapping valida partido', async () => {
    vi.spyOn(Match, 'findOne').mockReturnValue({ lean: () => Promise.resolve(null) });

    await expect(
      upsertStreamLinkMapping('99', { la18PageUrl: 'https://la18hd.com/x' })
    ).rejects.toThrow(/Partido no encontrado/);
  });

  it('deleteStreamLinkMapping elimina documento', async () => {
    vi.spyOn(StreamLinkMapping, 'findOneAndDelete').mockResolvedValue({ matchExternalId: '1' });
    const ok = await deleteStreamLinkMapping('1');
    expect(ok).toBe(true);
  });
});

describe('GET /api/matches/:id/stream', () => {
  it('rechaza sin token de sesión', async () => {
    const { createApp } = await import('../src/app.js');
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/matches/19/stream`);
      expect(res.status).toBe(401);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
