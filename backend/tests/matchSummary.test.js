import { describe, expect, it } from 'vitest';
import {
  buildMatchSummaryRows,
  formatMatchAttendance,
  getMatchSummaryNotice,
} from '../../frontend/src/lib/matchSummary.js';

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

  const fullReport = {
    home: {
      possession: 61,
      attemptsTotal: 16,
      attemptsOnTarget: 4,
      attemptsBlocked: 4,
      foulsAgainst: 12,
      corners: 3,
      directFreeKicks: 11,
      indirectFreeKicks: 1,
      penaltiesTotal: 0,
      penaltiesScored: 0,
      offsides: 1,
      ownGoals: 0,
      yellowCards: 1,
      redCardsSecondYellow: 0,
      directRedCards: 1,
    },
    away: {
      possession: 39,
      attemptsTotal: 3,
      attemptsOnTarget: 2,
      attemptsBlocked: 0,
      foulsAgainst: 11,
      corners: 1,
      directFreeKicks: 12,
      indirectFreeKicks: 1,
      penaltiesTotal: 0,
      penaltiesScored: 0,
      offsides: 1,
      ownGoals: 0,
      yellowCards: 2,
      redCardsSecondYellow: 0,
      directRedCards: 2,
    },
    attendance: 80824,
    statsVersion: 2,
  };

  it('cuenta faltas y tarjetas desde el timeline sin reporte', () => {
    const rows = buildMatchSummaryRows({ timeline });
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row]));

    expect(byLabel.Faltas).toEqual({ label: 'Faltas', home: '2', away: '1' });
    expect(byLabel.Amarillas).toEqual({ label: 'Amarillas', home: '1', away: '0' });
    expect(byLabel.Rojas).toEqual({ label: 'Rojas', home: '0', away: '1' });
    expect(byLabel.Cambios).toEqual({ label: 'Cambios', home: '0', away: '2' });
    expect(byLabel.Tiros).toBeUndefined();
  });

  it('muestra stats completas del reporte FIFA', () => {
    const rows = buildMatchSummaryRows({ timeline, reportStats: fullReport });
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row]));

    expect(byLabel.Posesión).toEqual({ label: 'Posesión', home: '61%', away: '39%' });
    expect(byLabel.Tiros).toEqual({ label: 'Tiros', home: '16', away: '3' });
    expect(byLabel['Al arco']).toEqual({ label: 'Al arco', home: '4', away: '2' });
    expect(byLabel['Bloqueados']).toEqual({ label: 'Bloqueados', home: '4', away: '0' });
    expect(byLabel.Faltas).toEqual({ label: 'Faltas', home: '12', away: '11' });
    expect(byLabel.Córners).toEqual({ label: 'Córners', home: '3', away: '1' });
    expect(byLabel.Rojas).toEqual({ label: 'Rojas', home: '1', away: '2' });
  });

  it('formatea asistencia del reporte', () => {
    expect(formatMatchAttendance(fullReport)).toBe('80.824');
  });
});

describe('getMatchSummaryNotice', () => {
  it('no muestra aviso con reporte FIFA', () => {
    expect(getMatchSummaryNotice('finished', true)).toBeNull();
    expect(getMatchSummaryNotice('live', true)).toBeNull();
  });

  it('en vivo no menciona reporte FIFA pendiente', () => {
    expect(getMatchSummaryNotice('live', false)).toBe('Estadísticas parciales (en curso)');
  });

  it('finalizado sin reporte indica PDF pendiente', () => {
    expect(getMatchSummaryNotice('finished', false)).toBe(
      'Parcial (cronología) · reporte FIFA pendiente'
    );
  });
});
