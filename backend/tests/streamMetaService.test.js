import { describe, it, expect } from 'vitest';
import {
  inferStreamSourceKind,
  resolveEffectiveStreamSources,
} from '../src/services/streamMetaService.js';

describe('streamMetaService', () => {
  it('prioriza señales de la agenda sobre el canal auto', () => {
    const match = { externalId: '42' };
    const fptStreams = [
      {
        id: 'dsports',
        label: 'DSports',
        url: 'https://futbolparatodos.su/eventos.html?r=abc',
        source: 'fpt',
      },
    ];

    const sources = resolveEffectiveStreamSources(match, null, fptStreams);
    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBe('dsports');
    expect(inferStreamSourceKind(null, sources[0])).toBe('fpt');
  });

  it('usa canal auto cuando la agenda no devuelve señales', () => {
    const match = { externalId: '19' };
    const sources = resolveEffectiveStreamSources(match, null, []);

    expect(sources).toHaveLength(1);
    expect(sources[0].url).toContain('/canal/espnpremium.html');
    expect(sources[0].source).toBe('auto');
    expect(inferStreamSourceKind(null, sources[0])).toBe('auto');
  });

  it('no auto-mapea partidos sim-*', () => {
    const match = { externalId: 'sim-99' };
    const sources = resolveEffectiveStreamSources(match, null, []);
    expect(sources).toHaveLength(0);
  });
});
