import { describe, it, expect } from 'vitest';
import {
  resolveOfficialKickoffAt,
  resolveKickoffAt,
  localWallClockToUtc,
} from '../src/services/kickoffTimeService.js';
import { getBroadcastersForMatch } from '../src/data/broadcastSchedule.js';
import { OFFICIAL_KICKOFFS_AR } from '../src/data/officialFixtureArgentina.js';

describe('official Argentina kickoffs', () => {
  it('tiene los 104 partidos oficiales', () => {
    expect(Object.keys(OFFICIAL_KICKOFFS_AR)).toHaveLength(104);
  });

  it('Argentina vs Argelia (19) a las 22:00 ART', () => {
    const kickoff = resolveOfficialKickoffAt('19');
    expect(kickoff.toISOString()).toBe('2026-06-17T01:00:00.000Z');
  });

  it('México vs Sudáfrica (1) a las 16:00 ART', () => {
    const kickoff = resolveOfficialKickoffAt('1');
    expect(kickoff.toISOString()).toBe('2026-06-11T19:00:00.000Z');
  });

  it('prioriza fixture oficial sobre utc_date de la API', () => {
    const game = {
      id: '19',
      utc_date: '2026-06-16T20:00:00.000Z',
      local_date: '06/16/2026 15:00',
    };
    const kickoff = resolveKickoffAt(game, { stadiumTimezone: 'America/Chicago' });
    expect(kickoff.toISOString()).toBe('2026-06-17T01:00:00.000Z');
  });


  it('Haití vs Escocia (5) a las 22:00 ART', () => {
    const kickoff = resolveOfficialKickoffAt('5');
    expect(kickoff.toISOString()).toBe('2026-06-14T01:00:00.000Z');
  });

  it('Brasil vs Marruecos (7) a las 19:00 ART', () => {
    const kickoff = resolveOfficialKickoffAt('7');
    expect(kickoff.toISOString()).toBe('2026-06-13T22:00:00.000Z');
  });

  it('Qatar vs Suiza (8) a las 16:00 ART', () => {
    const kickoff = resolveOfficialKickoffAt('8');
    expect(kickoff.toISOString()).toBe('2026-06-13T19:00:00.000Z');
  });

  it('medianoche ART (31) convierte correctamente', () => {
    const kickoff = resolveOfficialKickoffAt('31');
    expect(kickoff.toISOString()).toBe('2026-06-20T03:00:00.000Z');
  });

  it('partido 32 a las 16:00 ART', () => {
    const kickoff = resolveOfficialKickoffAt('32');
    expect(kickoff.toISOString()).toBe('2026-06-19T19:00:00.000Z');
  });
});

describe('broadcast schedule', () => {
  it('Argentina vs Argelia tiene TV Pública, Telefe, TyC, Disney+ y DSports', () => {
    const ids = getBroadcastersForMatch('19', {
      homeTeam: { fifaCode: 'ARG', nameEn: 'Argentina' },
      awayTeam: { fifaCode: 'DZA', nameEn: 'Algeria' },
    }).map((b) => b.id);
    expect(ids).toEqual(['tv-publica', 'telefe', 'tyc', 'disney', 'dsports']);
  });

  it('final del Mundial en TyC y Disney+', () => {
    const ids = getBroadcastersForMatch('104').map((b) => b.id);
    expect(ids).toContain('tyc');
    expect(ids).toContain('disney');
    expect(ids).toContain('dsports');
  });

  it('partidos sin acuerdo abierta muestran al menos DSports', () => {
    const ids = getBroadcastersForMatch('9').map((b) => b.id);
    expect(ids).toEqual(['dsports']);
  });

  it('simulación no tiene broadcasters', () => {
    expect(getBroadcastersForMatch('sim-abc-1')).toEqual([]);
  });
});

describe('localWallClockToUtc stadium fallback', () => {
  it('calcula kickoffAt desde local_date y zona del estadio', () => {
    const kickoff = localWallClockToUtc('06/15/2026 12:00', 'America/New_York');
    expect(kickoff.toISOString()).toBe('2026-06-15T16:00:00.000Z');
  });
});
