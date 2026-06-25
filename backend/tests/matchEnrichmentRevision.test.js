import { describe, it, expect } from 'vitest';
import { matchEnrichmentRevision, featuredBarInputsSignature } from '../src/services/matchEnrichmentRevision.js';

describe('matchEnrichmentRevision', () => {
  it('cambia cuando varía el marcador o la cronología', () => {
    const base = { homeScore: 0, awayScore: 1, raw: { time_elapsed: "45'" } };
    const scored = { homeScore: 0, awayScore: 2, raw: { time_elapsed: "45'" } };
    const timeline = {
      homeScore: 0,
      awayScore: 1,
      raw: { time_elapsed: "45'", fifaEvents: { timeline: [{ type: 'goal' }] } },
    };

    expect(matchEnrichmentRevision(base)).not.toBe(matchEnrichmentRevision(scored));
    expect(matchEnrichmentRevision(base)).not.toBe(matchEnrichmentRevision(timeline));
  });

  it('featuredBarInputsSignature distingue sets de partidos', () => {
    const a = [{ _id: '1', raw: { homeScore: 0, awayScore: 0 } }];
    const b = [{ _id: '1', raw: { homeScore: 0, awayScore: 1 } }];
    expect(featuredBarInputsSignature(a, [])).not.toBe(featuredBarInputsSignature(b, []));
  });
});
