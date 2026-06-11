import { describe, expect, it } from 'vitest';
import { buildMatchSummaryRows } from '../../frontend/src/lib/matchSummary.js';

describe('buildMatchSummaryRows', () => {
  const timeline = [
    { type: 'foul', side: 'home' },
    { type: 'foul', side: 'home' },
    { type: 'foul', side: 'away' },
    { type: 'yellow_card', side: 'home' },
    { type: 'red_card', side: 'away' },
    { type: 'substitution', side: 'away' },
    { type: 'substitution', side: 'away' },
  ];

  it('cuenta faltas y tarjetas desde el timeline', () => {
    const rows = buildMatchSummaryRows({ timeline });
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row]));

    expect(byLabel.Faltas).toEqual({ label: 'Faltas', home: '2', away: '1' });
    expect(byLabel.Amarillas).toEqual({ label: 'Amarillas', home: '1', away: '0' });
    expect(byLabel.Rojas).toEqual({ label: 'Rojas', home: '0', away: '1' });
    expect(byLabel.Cambios).toEqual({ label: 'Cambios', home: '0', away: '2' });
  });

  it('prioriza fifaReportStats sobre conteos del timeline', () => {
    const rows = buildMatchSummaryRows({
      timeline,
      reportStats: {
        home: { possession: 58, foulsAgainst: 10, yellowCards: 2, redCards: 0 },
        away: { possession: 42, foulsAgainst: 14, yellowCards: 1, redCards: 1 },
      },
    });
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row]));

    expect(byLabel.Posesión).toEqual({ label: 'Posesión', home: '58%', away: '42%' });
    expect(byLabel.Faltas).toEqual({ label: 'Faltas', home: '10', away: '14' });
    expect(byLabel.Amarillas).toEqual({ label: 'Amarillas', home: '2', away: '1' });
  });
});
