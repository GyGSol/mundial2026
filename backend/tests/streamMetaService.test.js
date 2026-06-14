import { describe, it, expect } from 'vitest';
import {
  inferStreamSourceKind,
  resolveEffectiveStreamSources,
} from '../src/services/streamMetaService.js';

describe('streamMetaService', () => {
  it('prioriza señales de la agenda sobre el canal auto', () => {
    const match = { externalId: '42' };
    const la18Streams = [
      {
        id: 'dsports',
        label: 'DSports',
        url: 'https://la18hd.com/vivo/canales.php?stream=dsports',
        source: 'la18hd',
      },
    ];

    const sources = resolveEffectiveStreamSources(match, null, la18Streams);
    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBe('dsports');
    expect(inferStreamSourceKind(null, sources[0])).toBe('la18hd');
  });

  it('usa canal auto cuando la agenda no devuelve señales', () => {
    const match = { externalId: '19' };
    const sources = resolveEffectiveStreamSources(match, null, []);

    expect(sources).toHaveLength(1);
    expect(sources[0].url).toContain('stream=disney6');
    expect(sources[0].source).toBe('auto');
    expect(inferStreamSourceKind(null, sources[0])).toBe('auto');
  });

  it('no auto-mapea partidos sim-*', () => {
    const match = { externalId: 'sim-99' };
    const sources = resolveEffectiveStreamSources(match, null, []);
    expect(sources).toHaveLength(0);
  });
});
