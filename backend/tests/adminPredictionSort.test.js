import { describe, it, expect } from 'vitest';
import {
  compareAdminPredictionsBySchedule,
  compareMatchesBySchedule,
} from '../src/services/adminService.js';
import { resolveOfficialKickoffAt } from '../src/services/kickoffTimeService.js';

describe('admin prediction sort', () => {
  const kickoff = '2026-06-15T18:00:00.000Z';

  it('groups predictions by match before user name when kickoff ties', () => {
    const rows = [
      {
        userName: 'Zara',
        match: { externalId: '2', kickoffAt: kickoff, id: 'm2' },
      },
      {
        userName: 'Ana',
        match: { externalId: '1', kickoffAt: kickoff, id: 'm1' },
      },
      {
        userName: 'Bruno',
        match: { externalId: '1', kickoffAt: kickoff, id: 'm1' },
      },
    ];

    rows.sort(compareAdminPredictionsBySchedule);

    expect(rows.map((r) => [r.match.externalId, r.userName])).toEqual([
      ['1', 'Ana'],
      ['1', 'Bruno'],
      ['2', 'Zara'],
    ]);
  });

  it('keeps match order stable when filtering would remove some users', () => {
    const all = [
      { userName: 'Ana', match: { externalId: '1', kickoffAt: kickoff, id: 'm1' } },
      { userName: 'Bruno', match: { externalId: '1', kickoffAt: kickoff, id: 'm1' } },
      { userName: 'Carlos', match: { externalId: '2', kickoffAt: kickoff, id: 'm2' } },
    ].sort(compareAdminPredictionsBySchedule);

    const filtered = all.filter((r) => r.userName !== 'Bruno');
    const matchOrder = [...new Set(filtered.map((r) => r.match.externalId))];
    expect(matchOrder).toEqual(['1', '2']);
  });

  it('orders matches by kickoff then externalId', () => {
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

    matches.sort(compareMatchesBySchedule);

    expect(matches.map((m) => m.externalId)).toEqual(['8', '7']);
    expect(resolveOfficialKickoffAt('8').getTime()).toBeLessThan(
      resolveOfficialKickoffAt('7').getTime()
    );
  });
});
