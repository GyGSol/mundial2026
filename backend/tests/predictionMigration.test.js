import { describe, it, expect } from 'vitest';
import { isLegacyUserPrediction } from '../src/services/predictionMigrationService.js';

const kickoff = new Date('2026-06-12T22:00:00.000Z');

describe('predictionMigrationService', () => {
  it('marca como legacy predicciones con marcador distinto de 0-0', () => {
    expect(
      isLegacyUserPrediction(
        { userSubmitted: false, homeGoals: 2, awayGoals: 1, createdAt: kickoff },
        { kickoffAt: kickoff }
      )
    ).toBe(true);
  });

  it('marca como legacy 0-0 guardado antes del cierre', () => {
    expect(
      isLegacyUserPrediction(
        {
          userSubmitted: false,
          homeGoals: 0,
          awayGoals: 0,
          createdAt: new Date('2026-06-12T20:00:00.000Z'),
        },
        { kickoffAt: kickoff }
      )
    ).toBe(true);
  });

  it('no marca el 0-0 automático insertado al lock', () => {
    expect(
      isLegacyUserPrediction(
        {
          userSubmitted: false,
          homeGoals: 0,
          awayGoals: 0,
          createdAt: new Date('2026-06-12T21:30:00.000Z'),
        },
        { kickoffAt: kickoff }
      )
    ).toBe(false);
  });

  it('ignora predicciones ya marcadas como userSubmitted', () => {
    expect(
      isLegacyUserPrediction(
        { userSubmitted: true, homeGoals: 1, awayGoals: 0, createdAt: kickoff },
        { kickoffAt: kickoff }
      )
    ).toBe(false);
  });
});
