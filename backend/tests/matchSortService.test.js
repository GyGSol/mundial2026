import { describe, it, expect } from 'vitest';
import {
  compareMatchesByFifaNumber,
  compareMatchesBySchedule,
  compareMatchesByScheduleDesc,
  sortMatchesBySchedule,
  sortMatchesByScheduleDesc,
} from '../src/services/matchSortService.js';
import { resolveOfficialKickoffAt } from '../src/services/kickoffTimeService.js';

describe('matchSortService', () => {
  const kickoff = '2026-06-15T18:00:00.000Z';

  it('orders matches by schedule kickoff descending (último terminado primero)', () => {
    const matches = [
      { externalId: '1', kickoffAt: '2026-06-11T18:00:00.000Z', id: 'a' },
      { externalId: '3', kickoffAt: '2026-06-12T18:00:00.000Z', id: 'c' },
      { externalId: '2', kickoffAt: '2026-06-11T23:00:00.000Z', id: 'b' },
    ];

    const sorted = sortMatchesByScheduleDesc(matches);

    expect(sorted.map((m) => m.externalId)).toEqual(['3', '2', '1']);
    expect(compareMatchesByScheduleDesc(sorted[0], sorted[1])).toBeLessThan(0);
  });

  it('orders matches by schedule kickoff then externalId', () => {
    const matches = [
      { externalId: '10', kickoffAt: kickoff, id: 'b' },
      { externalId: '2', kickoffAt: kickoff, id: 'a' },
      { externalId: '1', kickoffAt: '2026-06-14T18:00:00.000Z', id: 'c' },
    ];

    matches.sort(compareMatchesBySchedule);

    expect(matches.map((m) => m.externalId)).toEqual(['1', '2', '10']);
  });

  it('uses official fixture kickoff when stored kickoffAt is wrong', () => {
    const wrongKickoff = new Date('2026-06-11T00:00:00.000Z');
    const matches = [
      { externalId: '7', kickoffAt: wrongKickoff, id: 'm7' },
      { externalId: '8', kickoffAt: wrongKickoff, id: 'm8' },
    ];

    const sorted = sortMatchesBySchedule(matches);

    expect(sorted.map((m) => m.externalId)).toEqual(['8', '7']);
    expect(resolveOfficialKickoffAt('8').getTime()).toBeLessThan(
      resolveOfficialKickoffAt('7').getTime()
    );
  });

  it('orders matches by FIFA number for admin selects', () => {
    const matches = [
      { externalId: '16', kickoffAt: '2026-06-15T19:00:00.000Z' },
      { externalId: '9', kickoffAt: '2026-06-14T23:00:00.000Z' },
      { externalId: '11', kickoffAt: '2026-06-14T20:00:00.000Z' },
    ];

    matches.sort(compareMatchesByFifaNumber);

    expect(matches.map((m) => m.externalId)).toEqual(['9', '11', '16']);
  });

  it('weather-delayed kickoffAt does not change schedule sort order', () => {
    const official7 = resolveOfficialKickoffAt('7');
    const official8 = resolveOfficialKickoffAt('8');
    const delayed7 = new Date(official8.getTime() + 60 * 60 * 1000);

    const matches = [
      { externalId: '7', kickoffAt: delayed7, id: 'm7', weatherOps: { phase: 'postponed' } },
      { externalId: '8', kickoffAt: official8, id: 'm8' },
    ];

    const sorted = sortMatchesBySchedule(matches);

    expect(sorted.map((m) => m.externalId)).toEqual(['8', '7']);
    expect(official7.getTime()).toBeGreaterThan(official8.getTime());
  });
});
