import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { Match } from '../src/models/Match.js';
import { StreamLinkMapping } from '../src/models/StreamLinkMapping.js';
import {
  getMatchStreamConfig,
  listStreamLinkMappings,
  upsertStreamLinkMapping,
  deleteStreamLinkMapping,
} from '../src/services/streamLinkService.js';

describe('streamLinkService', () => {
  const originalEnabled = env.liveStreamEnabled;
  const originalUrls = { ...env.liveStreamUrls };

  beforeEach(() => {
    env.liveStreamEnabled = true;
    env.liveStreamUrls = {};
    vi.spyOn(Match, 'findOne').mockReset();
    vi.spyOn(StreamLinkMapping, 'findOne').mockReset();
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

  it('rechaza partido que no está en vivo', async () => {
    Match.findOne.mockReturnValue({
      lean: () => Promise.resolve({ externalId: '19', status: 'upcoming' }),
    });
    const result = await getMatchStreamConfig('19');
    expect(result).toMatchObject({ available: false, reason: 'not_live', status: 'upcoming' });
  });

  it('rechaza sin mapping La18', async () => {
    Match.findOne.mockReturnValue({
      lean: () => Promise.resolve({ externalId: '19', status: 'live' }),
    });
    StreamLinkMapping.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const result = await getMatchStreamConfig('19');
    expect(result).toMatchObject({
      available: false,
      reason: 'no_la18_mapping',
      matchId: '19',
    });
    expect(result.fallback?.provider).toBe('fubo');
    expect(result.fallback?.url).toContain('FuboSports');
  });

  it('devuelve config La18 con fallback Fubo cuando está live', async () => {
    Match.findOne.mockReturnValue({
      lean: () => Promise.resolve({ externalId: '19', status: 'live' }),
    });
    StreamLinkMapping.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          matchExternalId: '19',
          la18EventId: 'arg-bra',
          la18PageUrl: 'https://la18hd.com/evento/arg-bra',
          embedUrl: 'https://la18hd.com/evento/arg-bra',
          enabled: true,
        }),
    });

    const result = await getMatchStreamConfig('19');
    expect(result.available).toBe(true);
    expect(result.primary).toMatchObject({
      provider: 'la18hd',
      type: 'iframe',
      url: 'https://la18hd.com/evento/arg-bra',
      eventId: 'arg-bra',
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
