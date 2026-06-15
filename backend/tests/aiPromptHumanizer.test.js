import { describe, it, expect } from 'vitest';
import {
  humanizePromptContext,
  sanitizeAiUserFacingText,
} from '../src/services/aiPromptHumanizer.js';

describe('aiPromptHumanizer', () => {
  it('traduce plantilla y jugadores a español sin claves técnicas', () => {
    const humanized = humanizePromptContext({
      homeTeam: { name: 'Spain' },
      awayTeam: { name: 'Cape Verde' },
      squadAnalysis: {
        home: {
          probableStarters: [
            {
              name: 'Lamine Yamal',
              position: 'FWD',
              club: 'Barcelona',
              league: 'La Liga',
              healthStatus: 'unknown',
              isProbableStarter: true,
            },
          ],
          injuries: [],
          doubtful: [],
          suspended: [],
          cardsRisk: [],
          injuredCount: 0,
          doubtfulCount: 0,
          suspendedCount: 0,
          squadSize: 26,
          intelStale: false,
        },
        away: {
          probableStarters: [],
          injuries: [],
          doubtful: [],
          suspended: [],
          cardsRisk: [],
          injuredCount: 0,
          doubtfulCount: 0,
          suspendedCount: 0,
          squadSize: 23,
          intelStale: true,
        },
      },
      nationContext: { home: null, away: null },
      positionMatchups: [],
    });

    expect(humanized.squadAnalysis).toBeUndefined();
    expect(humanized.análisisPlantilla.local.titularesProbables[0]).toMatchObject({
      nombre: 'Lamine Yamal',
      posición: 'Delantero',
      estadoFísico: 'Sin datos confirmados',
      titularProbable: true,
    });
    expect(humanized.equipoLocal).toMatchObject({ name: 'Spain' });
  });

  it('humaniza duelos por puesto', () => {
    const humanized = humanizePromptContext({
      positionMatchups: [
        {
          position: 'MID',
          home: [{ name: 'Pedri', club: 'Barcelona', league: 'La Liga', healthStatus: 'available' }],
          away: [{ name: 'Rocha', club: 'Benfica', league: 'Primeira Liga', healthStatus: 'doubt' }],
          edge: 'home',
          fieldImpactNote: 'Ventaja local',
        },
      ],
    });

    expect(humanized.duelosPorPuesto[0]).toMatchObject({
      línea: 'Mediocampista',
      ventaja: 'ventaja local',
      local: [{ nombre: 'Pedri', estadoFísico: 'Disponible' }],
      visitante: [{ nombre: 'Rocha', estadoFísico: 'Duda' }],
    });
  });

  it('sanitizeAiUserFacingText quita backticks y traduce campos técnicos', () => {
    const raw = `Sí – aparece en \`probableStarters\` con \`isProbableStarter: true\`.
Estado: \`"unknown"\`. Secciones \`injuries\`, \`doubtful\`.`;
    const cleaned = sanitizeAiUserFacingText(raw);
    expect(cleaned).toContain('titulares probables');
    expect(cleaned).toContain('titular probable: sí');
    expect(cleaned).toContain('sin datos confirmados');
    expect(cleaned).toContain('lesionados');
    expect(cleaned).not.toContain('`');
    expect(cleaned).not.toMatch(/probableStarters/i);
  });
});
