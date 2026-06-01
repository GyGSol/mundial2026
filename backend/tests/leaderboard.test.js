import { describe, it, expect } from 'vitest';
import { compareLeaderboardEntries } from '../src/services/leaderboardService.js';

describe('leaderboardService tiebreakers', () => {
  it('ordena por puntos totales y luego PA', () => {
    const rows = [
      { name: 'B', totalPoints: 10, pa: 2, gl: 1, gv: 1, gt: 0, pb: 0 },
      { name: 'A', totalPoints: 10, pa: 3, gl: 0, gv: 0, gt: 0, pb: 0 },
    ].sort(compareLeaderboardEntries);

    expect(rows.map((row) => row.name)).toEqual(['A', 'B']);
  });

  it('en empate de PA desempata por GL+GV', () => {
    const rows = [
      { name: 'B', totalPoints: 8, pa: 2, gl: 1, gv: 0, gt: 1, pb: 0 },
      { name: 'A', totalPoints: 8, pa: 2, gl: 2, gv: 1, gt: 0, pb: 0 },
    ].sort(compareLeaderboardEntries);

    expect(rows[0].name).toBe('A');
  });

  it('en empate de GL+GV desempata por GT', () => {
    const rows = [
      { name: 'B', totalPoints: 5, pa: 1, gl: 1, gv: 1, gt: 0, pb: 1 },
      { name: 'A', totalPoints: 5, pa: 1, gl: 1, gv: 1, gt: 2, pb: 0 },
    ].sort(compareLeaderboardEntries);

    expect(rows[0].name).toBe('A');
  });

  it('en empate de GT desempata por PB (menos PB = mejor posición)', () => {
    const rows = [
      { name: 'B', totalPoints: 4, pa: 1, gl: 0, gv: 0, gt: 1, pb: 2 },
      { name: 'A', totalPoints: 4, pa: 1, gl: 0, gv: 0, gt: 1, pb: 0 },
    ].sort(compareLeaderboardEntries);

    expect(rows[0].name).toBe('A');
  });
});
