import { describe, expect, it } from 'vitest';
import { getWorldCupHistory } from '../src/services/worldCupHistoryService.js';

describe('worldCupHistoryService', () => {
  it('expone finales, títulos y goleadores históricos', async () => {
    const history = await getWorldCupHistory();

    expect(history.finals.length).toBeGreaterThanOrEqual(22);
    expect(history.titlesByNation.some((row) => row.fifaCode === 'BRA' && row.titles === 5)).toBe(
      true
    );
    expect(history.allTimeTopScorers[0].playerName).toBe('Miroslav Klose');
    expect(history.allTimeTopScorers[0].goals).toBe(16);
    expect(history.topScorersByTournament.some((row) => row.year === 2022)).toBe(true);
  });
});
