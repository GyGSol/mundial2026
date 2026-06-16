import { describe, expect, it } from 'vitest';
import {
  annotateTimelineForDisplay,
  filterTimelineForDisplay,
} from '../../frontend/src/lib/matchTimelineDisplay.js';

describe('matchTimelineDisplay shot/goal dedup', () => {
  const shot = {
    type: 'shot_attempt',
    side: 'home',
    minute: 90,
    extraMinute: 6,
    player: 'Kylian Mbappe',
    sortKey: 90.06,
  };
  const goal = {
    type: 'goal',
    side: 'home',
    minute: 90,
    extraMinute: 6,
    player: 'Kylian Mbappe',
    sortKey: 90.06,
  };
  const miss = {
    type: 'shot_attempt',
    side: 'away',
    minute: 40,
    extraMinute: null,
    player: 'MANE',
    sortKey: 40,
  };

  it('fusiona tiro+gol en una fila y conserva tiros sin gol', () => {
    const annotated = annotateTimelineForDisplay([shot, goal, miss]);

    expect(annotated.filter((e) => e.type === 'shot_attempt')).toHaveLength(1);
    expect(annotated.find((e) => e.type === 'goal')).toMatchObject({ includesShot: true });
    expect(annotated.find((e) => e.type === 'shot_attempt')).toMatchObject({ player: 'MANE' });
  });

  it('filterTimelineForDisplay no lista el tiro absorbido por el gol', () => {
    const rows = filterTimelineForDisplay([shot, goal, miss]);
    const types = rows.map((e) => e.type);

    expect(types).toEqual(['goal', 'shot_attempt']);
    expect(rows[0]).toMatchObject({ type: 'goal', includesShot: true });
  });
});
