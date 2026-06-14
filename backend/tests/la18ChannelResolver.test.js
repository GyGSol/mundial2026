import { describe, it, expect } from 'vitest';
import {
  buildLa18ChannelPageUrl,
  resolveAutoLa18Mapping,
  resolveLa18StreamSlug,
} from '../src/services/la18ChannelResolver.js';

describe('la18ChannelResolver', () => {
  it('Haiti vs Scotland (solo DSports) usa canal dsports', () => {
    expect(resolveLa18StreamSlug('5')).toBe('dsports');
    const mapping = resolveAutoLa18Mapping('5');
    expect(mapping?.la18EventId).toBe('dsports');
    expect(mapping?.la18PageUrl).toContain('stream=dsports');
  });

  it('partido TyC usa canal tyc salvo override admin', () => {
    expect(resolveLa18StreamSlug('7')).toBe('tyc');
  });

  it('partido Disney+ usa disney6', () => {
    expect(resolveLa18StreamSlug('19')).toBe('disney6');
  });

  it('buildLa18ChannelPageUrl codifica slug', () => {
    expect(buildLa18ChannelPageUrl('dsports')).toContain('stream=dsports');
  });
});
