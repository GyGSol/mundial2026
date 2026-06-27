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
import * as fptScraper from '../src/services/fptScraper.js';

const SAMPLE_STREAMS = [
  {
    id: 'dsports',
    label: 'DSports (Calidad 1080p)',
    language: '',
    url: 'https://futbolparatodos.su/eventos.html?r=dsports1080',
    pageUrl: 'https://futbolparatodos.su/eventos.html?r=dsports1080',
    embedUrl: 'https://futbolparatodos.su/eventos.html?r=dsports1080',
    eventId: 'dsports',
    embeddable: true,
    provider: 'fpt',
  },
  {
    id: 'fox',
    label: 'FOX (Calidad 1080p)',
    language: '',
    url: 'https://futbolparatodos.su/eventos.html?r=fox1080',
    pageUrl: 'https://futbolparatodos.su/eventos.html?r=fox1080',
    embedUrl: 'https://futbolparatodos.su/eventos.html?r=fox1080',
    eventId: 'fox',
    embeddable: true,
    provider: 'fpt',
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
    vi.spyOn(fptScraper, 'resolveFptStreamsForMatch').mockResolvedValue({
      event: { title: 'Copa del Mundo: Haití vs Escocia' },
      streams: SAMPLE_STREAMS,
      sourceUrl: 'https://futbolparatodos.su/agenda.php',
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

  it('permite calentamiento y devuelve todas las señales FPT', async () => {
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
    expect(result.source).toBe('fpt');
    expect(result.sources).toHaveLength(2);
    expect(result.primary.pageUrl).toContain('futbolparatodos.su');
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

    const result = await getMatchStreamConfig('5', undefined, { sourceId: 'fox' });
    expect(result.selectedSourceId).toBe('fox');
    expect(result.primary.pageUrl).toContain('fox1080');
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
          la18PageUrl: 'https://futbolparatodos.su/canal/espnpremium.html',
          embedUrl: 'https://futbolparatodos.su/canal/espnpremium.html',
          la18EventId: 'espnpremium',
          enabled: true,
        }),
    });

    const result = await getMatchStreamConfig('7');
    expect(result.available).toBe(true);
    expect(result.source).toBe('admin');
    expect(result.sources.some((row) => row.id === 'espnpremium')).toBe(true);
  });

  it('rechaza partido que no está en vivo ni en calentamiento', async () => {
    Match.findOne.mockReturnValue({
      lean: () => Promise.resolve({ externalId: '19', status: 'finished' }),
    });
    const result = await getMatchStreamConfig('19');
    expect(result).toMatchObject({ available: false, reason: 'not_available', status: 'finished' });
  });

  it('rechaza sin streams FPT (simulación)', async () => {
    fptScraper.resolveFptStreamsForMatch.mockResolvedValueOnce({
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
      reason: 'no_stream_mapping',
      matchId: 'sim-1',
    });
    expect(result.fallback?.provider).toBe('fubo');
  });

  it('usa canal auto por televisor cuando la agenda no tiene el partido', async () => {
    fptScraper.resolveFptStreamsForMatch.mockResolvedValueOnce({
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
    expect(result.primary.pageUrl).toContain('/canal/dsports.html');
  });

  it('devuelve config FPT con fallback Fubo cuando está live', async () => {
    Match.findOne.mockReturnValue({
      lean: () => Promise.resolve({ externalId: '19', status: 'live' }),
    });
    StreamLinkMapping.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const result = await getMatchStreamConfig('19');
    expect(result.available).toBe(true);
    expect(result.primary).toMatchObject({
      provider: 'fpt',
      type: 'iframe',
      hlsUrl: null,
    });
    expect(result.fallback?.provider).toBe('fubo');
    expect(result.fallback?.type).toBe('youtube');
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
      upsertStreamLinkMapping('99', { la18PageUrl: 'https://futbolparatodos.su/canal/dsports.html' })
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
