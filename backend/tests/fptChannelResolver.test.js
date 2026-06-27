import { describe, it, expect } from 'vitest';
import {
  buildFptChannelPageUrl,
  resolveAutoFptMapping,
  resolveFptChannelSlug,
} from '../src/services/fptChannelResolver.js';

describe('fptChannelResolver', () => {
  it('Haiti vs Scotland (solo DSports) usa canal dsports', () => {
    expect(resolveFptChannelSlug('5')).toBe('dsports');
    const mapping = resolveAutoFptMapping('5');
    expect(mapping?.la18EventId).toBe('dsports');
    expect(mapping?.la18PageUrl).toContain('/canal/dsports.html');
  });

  it('partido TyC usa fox1', () => {
    expect(resolveFptChannelSlug('7')).toBe('fox1');
  });

  it('partido Disney+ usa espnpremium', () => {
    expect(resolveFptChannelSlug('19')).toBe('espnpremium');
  });

  it('buildFptChannelPageUrl genera URL de canal', () => {
    expect(buildFptChannelPageUrl('dsports')).toContain('/canal/dsports.html');
  });
});
