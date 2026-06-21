import { describe, expect, it } from 'vitest';
import {
  ATTACK_HEATMAP_WEIGHTS,
  buildAttackHeatmapCells,
  buildHeatmapCells,
  countHeatmapEligibleEvents,
  peakAttackGridValue,
} from './eventHeatmap.js';

describe('eventHeatmap', () => {
  const events = [
    { type: 'shot_attempt', side: 'home', minute: 30, positionX: 12, positionY: 50 },
    { type: 'shot_attempt', side: 'home', minute: 32, positionX: 14, positionY: 48 },
    { type: 'shot_attempt', side: 'away', minute: 21, positionX: 98, positionY: 50 },
    { type: 'foul', side: 'home', minute: 20, positionX: 88, positionY: 20 },
    { type: 'goal', side: 'away', minute: 21, positionX: 98, positionY: 50 },
  ];

  it('concentra tiros del local hacia arco derecho y visitante hacia arco izquierdo (1.er tiempo)', () => {
    const cells = buildHeatmapCells(events, 'shots');
    expect(cells.length).toBeGreaterThan(0);

    const homePeak = cells
      .filter((cell) => cell.side === 'home')
      .reduce((best, cell) => (cell.intensity > best.intensity ? cell : best));
    const awayPeak = cells
      .filter((cell) => cell.side === 'away')
      .reduce((best, cell) => (cell.intensity > best.intensity ? cell : best));

    expect(homePeak.col).toBeGreaterThan(6);
    expect(awayPeak.col).toBeLessThan(6);
  });

  it('countHeatmapEligibleEvents filtra por modo', () => {
    expect(countHeatmapEligibleEvents(events, 'shots')).toBe(4);
    expect(countHeatmapEligibleEvents(events, 'goals')).toBe(1);
    expect(countHeatmapEligibleEvents(events, 'fouls')).toBe(1);
  });

  it('buildAttackHeatmapCells pondera goles más que tiros y faltas', () => {
    expect(ATTACK_HEATMAP_WEIGHTS.goal).toBeGreaterThan(ATTACK_HEATMAP_WEIGHTS.shot_attempt);
    expect(ATTACK_HEATMAP_WEIGHTS.shot_attempt).toBeGreaterThan(ATTACK_HEATMAP_WEIGHTS.foul);

    const spot = { side: 'home', minute: 30, positionX: 12, positionY: 50 };
    const goalValue = peakAttackGridValue([{ type: 'goal', ...spot }], 'home');
    const twoFoulsValue = peakAttackGridValue(
      [
        { type: 'foul', ...spot },
        { type: 'foul', ...spot },
      ],
      'home'
    );

    expect(goalValue).toBeGreaterThan(twoFoulsValue);
  });

  it('buildAttackHeatmapCells combina tiros, faltas y goles por equipo', () => {
    const cells = buildAttackHeatmapCells(events);
    expect(cells.some((cell) => cell.side === 'home')).toBe(true);
    expect(cells.some((cell) => cell.side === 'away')).toBe(true);
  });
});
