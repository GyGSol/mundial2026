import { describe, it, expect } from 'vitest';
import {
  extractHistoricalH2HFromPreTournament,
  buildQualificationContextForTeam,
} from '../src/services/aiMatchHistoryContextService.js';

describe('aiMatchHistoryContextService', () => {
  it('extrae H2H histórico desde partidos pre-torneo de jugadores', () => {
    const home = {
      preTorneo: [
        {
          fecha: '2025-11-10',
          rival: 'Panama',
          resultado: 'W 2-1',
          competicion: 'Amistoso',
        },
      ],
    };
    const away = { preTorneo: [] };
    const meetings = extractHistoricalH2HFromPreTournament(
      home,
      away,
      { fifaCode: 'GHA', nameEn: 'Ghana' },
      { fifaCode: 'PAN', nameEn: 'Panama' }
    );
    expect(meetings).toHaveLength(1);
    expect(meetings[0].competicion).toBe('Amistoso');
  });

  it('expone perfil de clasificación y mundiales', async () => {
    const profile = await buildQualificationContextForTeam({ fifaCode: 'GHA', nameEn: 'Ghana' });
    expect(profile?.participacionesMundial).toBeGreaterThan(0);
    expect(profile?.notaHistoricaYClasificacion).toContain('2010');
  });
});
