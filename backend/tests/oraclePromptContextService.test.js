import { describe, it, expect } from 'vitest';
import {
  analyzeContextBlocks,
  compactCompetitorContext,
  estimatePromptTokens,
  stripRedundantFieldsFromRawContext,
} from '../src/services/oraclePromptContextService.js';

const HUMANIZED_FIXTURE = {
  guiaPrioridadContexto: { calibracionReciente: { sesgoLocal: 0.1 } },
  sedeYClima: { resumenLinea: 'Estadio X · 22°C' },
  partido: {
    matchExternalId: '42',
    phase: 'group',
    group: 'A',
    kickoffAt: '2026-06-15T18:00:00.000Z',
  },
  mundial2026: { lecturaTorneo2026: 'Primer partido del grupo' },
  plantillaYDisponibilidad: {
    análisisPlantilla: {
      local: {
        titularesProbables: [
          {
            nombre: 'Jugador A',
            rendimiento: {
              acumuladoTemporada: { PJ: 10, minutos: 900 },
              seleccion: { PJ: 5, goles: 2 },
            },
          },
        ],
      },
      visitante: { titularesProbables: [] },
    },
    duelosPorPuesto: [
      { local: [{ n: 1 }, { n: 2 }], visitante: [{ n: 3 }] },
    ],
  },
  senalesExternasYGrupo: {
    mercadoYxG: { xgLocal: 1.2 },
    externalIntel: { odds: true },
    carreraPremios: { posicion: 3 },
    inteligenciaGrupo: {
      todosLosGrupos: [{ grupo: 'B' }],
      tablasConsenso: [{ grupo: 'A', filas: [] }],
      consensoPartido: { mediana: '2-1' },
      grupoFoco: 'A',
    },
  },
  contextoPreTorneoYReferencia: {
    contextoSelecciones: {
      local: {
        historialMundial: {
          registrosWiki: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: i })),
        },
      },
      visitante: {},
    },
  },
};

describe('oraclePromptContextService', () => {
  describe('estimatePromptTokens', () => {
    it('estima ~chars/4', () => {
      expect(estimatePromptTokens('abcd')).toBe(1);
      expect(estimatePromptTokens('')).toBe(0);
    });
  });

  describe('stripRedundantFieldsFromRawContext', () => {
    it('omite externalIntel si ya hay mercadoYxG', () => {
      const out = stripRedundantFieldsFromRawContext({
        mercadoYxG: { xg: 1 },
        externalIntel: { heavy: true },
        microEventos: [],
      });
      expect(out.externalIntel).toBeUndefined();
      expect(out.mercadoYxG).toEqual({ xg: 1 });
    });
  });

  describe('compactCompetitorContext', () => {
    it('perfil replay reduce bloques vs live', () => {
      const live = compactCompetitorContext(HUMANIZED_FIXTURE, 'live');
      const replay = compactCompetitorContext(HUMANIZED_FIXTURE, 'replay');
      const liveJson = JSON.stringify(live);
      const replayJson = JSON.stringify(replay);

      expect(replayJson.length).toBeLessThan(liveJson.length);
      expect(replay.carreraPremios).toBeUndefined();
      expect(replay.consensoGrupoFoco).toEqual({ mediana: '2-1' });
      expect(replay.senalesExternasYGrupo).toBeUndefined();
    });

    it('live elimina carreraPremios', () => {
      const live = compactCompetitorContext(HUMANIZED_FIXTURE, 'live');
      expect(live.senalesExternasYGrupo?.carreraPremios).toBeNull();
    });

    it('capa wiki y duelos en live', () => {
      const live = compactCompetitorContext(HUMANIZED_FIXTURE, 'live');
      const wiki = live.contextoPreTorneoYReferencia.contextoSelecciones.local.historialMundial
        .registrosWiki;
      expect(wiki).toHaveLength(5);
      expect(live.plantillaYDisponibilidad.duelosPorPuesto[0].local).toHaveLength(1);
      const titular = live.plantillaYDisponibilidad.análisisPlantilla.local.titularesProbables[0];
      expect(titular.rendimiento).toBeUndefined();
      expect(titular.rendimientoResumido).toMatchObject({ PJ: 10, goles: 2 });
    });
  });

  describe('analyzeContextBlocks', () => {
    it('devuelve filas por bloque presente', () => {
      const analysis = analyzeContextBlocks(HUMANIZED_FIXTURE, 'replay');
      expect(analysis.profile).toBe('replay');
      expect(analysis.totalChars).toBeGreaterThan(0);
      expect(analysis.blocks.some((b) => b.block === 'partido')).toBe(true);
    });
  });
});
