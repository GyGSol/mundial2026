import { describe, expect, it } from 'vitest';
import { buildHeatmapCells, countHeatmapEligibleEvents } from './eventHeatmap.js';

describe('eventHeatmap', () => {
  const events = [
    { type: 'shot_attempt', positionX: 80, positionY: 50 },
    { type: 'shot_attempt', positionX: 82, positionY: 48 },
    { type: 'foul', positionX: 40, positionY: 20 },
    { type: 'goal', positionX: 90, positionY: 50 },
  ];

  it('buildHeatmapCells concentra intensidad cerca de tiros', () => {
    const cells = buildHeatmapCells(events, 'shots');
    expect(cells.length).toBeGreaterThan(0);
    const peak = cells.reduce((best, cell) => (cell.intensity > best.intensity ? cell : best));
    expect(peak.col).toBeGreaterThan(8);
  });

  it('countHeatmapEligibleEvents filtra por modo', () => {
    expect(countHeatmapEligibleEvents(events, 'shots')).toBe(3);
    expect(countHeatmapEligibleEvents(events, 'goals')).toBe(1);
    expect(countHeatmapEligibleEvents(events, 'fouls')).toBe(1);
  });
});
