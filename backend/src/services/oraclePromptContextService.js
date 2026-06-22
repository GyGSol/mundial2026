import {
  humanizeCompetitorPromptContext,
} from './aiPromptHumanizer.js';

export const ORACLE_CONTEXT_PROFILES = ['live', 'replay', 'learning'];

const MAX_WIKI_RECORDS = 5;
const MAX_DUELO_PLAYERS_PER_SIDE = 1;

/** Heurística chars/4 — suficiente para budgeting de cuota Cerebras. */
export function estimatePromptTokens(text) {
  return Math.ceil(String(text ?? '').length / 4);
}

export function isHumanizedCompetitorContext(context) {
  return Boolean(context?.guiaPrioridadContexto);
}

/** Quita campos redundantes antes de humanizar (predicción live). */
export function stripRedundantFieldsFromRawContext(context) {
  if (!context || typeof context !== 'object') return context;
  const { externalIntel, _calibrationStats, microEventos, ...rest } = context;
  const out = { ...rest };
  if (rest.mercadoYxG != null) {
    // mercadoYxG ya resume externalIntel
  } else if (externalIntel != null) {
    out.externalIntel = externalIntel;
  }
  if (Array.isArray(microEventos) && microEventos.length > 0) {
    out.microEventos = microEventos;
  }
  return out;
}

function capWikiRecords(side) {
  if (!side?.historialMundial?.registrosWiki) return side;
  const records = side.historialMundial.registrosWiki;
  if (!Array.isArray(records) || records.length <= MAX_WIKI_RECORDS) return side;
  return {
    ...side,
    historialMundial: {
      ...side.historialMundial,
      registrosWiki: records.slice(-MAX_WIKI_RECORDS),
    },
  };
}

function capDuelosPorPuesto(duelos) {
  if (!Array.isArray(duelos)) return duelos;
  return duelos.map((row) => ({
    ...row,
    local: (row.local ?? []).slice(0, MAX_DUELO_PLAYERS_PER_SIDE),
    visitante: (row.visitante ?? []).slice(0, MAX_DUELO_PLAYERS_PER_SIDE),
  }));
}

function stripPlayerRendimientoDetalle(plantillaSide) {
  if (!plantillaSide?.titularesProbables) return plantillaSide;
  return {
    ...plantillaSide,
    titularesProbables: plantillaSide.titularesProbables.map((p) => {
      const { rendimiento, ...rest } = p;
      if (!rendimiento) return p;
      return {
        ...rest,
        rendimientoResumido: {
          PJ: rendimiento.acumuladoTemporada?.PJ ?? rendimiento.seleccion?.PJ ?? 0,
          goles: rendimiento.seleccion?.goles ?? rendimiento.club?.goles ?? 0,
          minutos: rendimiento.acumuladoTemporada?.minutos ?? 0,
        },
      };
    }),
  };
}

function focusInteligenciaGrupo(intel) {
  if (!intel || typeof intel !== 'object') return intel;
  const { todosLosGrupos, tablasConsenso, ...focus } = intel;
  return {
    grupoFoco: focus.grupoFoco ?? null,
    consensoPartido: focus.consensoPartido ?? null,
    tablaProyectadaGrupoFoco: tablasConsenso?.[0] ?? null,
  };
}

function applyCompactionProfile(humanized, profile) {
  if (!humanized || typeof humanized !== 'object') return humanized;

  const plantilla = humanized.plantillaYDisponibilidad?.análisisPlantilla;
  const compactPlantilla = plantilla
    ? {
        local: stripPlayerRendimientoDetalle(plantilla.local),
        visitante: stripPlayerRendimientoDetalle(plantilla.visitante),
      }
    : plantilla;

  const ctxSelecciones = humanized.contextoPreTorneoYReferencia?.contextoSelecciones;
  const compactSelecciones = ctxSelecciones
    ? {
        local: capWikiRecords(ctxSelecciones.local),
        visitante: capWikiRecords(ctxSelecciones.visitante),
      }
    : ctxSelecciones;

  const base = {
    ...humanized,
    plantillaYDisponibilidad: humanized.plantillaYDisponibilidad
      ? {
          ...humanized.plantillaYDisponibilidad,
          análisisPlantilla: compactPlantilla,
          duelosPorPuesto: capDuelosPorPuesto(humanized.plantillaYDisponibilidad.duelosPorPuesto),
        }
      : humanized.plantillaYDisponibilidad,
    contextoPreTorneoYReferencia: humanized.contextoPreTorneoYReferencia
      ? {
          ...humanized.contextoPreTorneoYReferencia,
          contextoSelecciones: compactSelecciones,
        }
      : humanized.contextoPreTorneoYReferencia,
    senalesExternasYGrupo: humanized.senalesExternasYGrupo
      ? {
          ...humanized.senalesExternasYGrupo,
          inteligenciaGrupo: focusInteligenciaGrupo(humanized.senalesExternasYGrupo.inteligenciaGrupo),
        }
      : humanized.senalesExternasYGrupo,
  };

  if (profile === 'live') {
    return {
      ...base,
      senalesExternasYGrupo: base.senalesExternasYGrupo
        ? {
            ...base.senalesExternasYGrupo,
            carreraPremios: null,
          }
        : base.senalesExternasYGrupo,
    };
  }

  if (profile === 'replay' || profile === 'learning') {
    return {
      guiaPrioridadContexto: base.guiaPrioridadContexto,
      sedeYClima: base.sedeYClima,
      partido: {
        matchExternalId: base.partido?.matchExternalId,
        phase: base.partido?.phase,
        group: base.partido?.group,
        kickoffAt: base.partido?.kickoffAt,
        weatherOps: base.partido?.weatherOps,
        weatherRisk: base.partido?.weatherRisk,
      },
      mundial2026: base.mundial2026,
      plantillaYDisponibilidad: {
        análisisPlantilla: base.plantillaYDisponibilidad?.análisisPlantilla,
        duelosPorPuesto: base.plantillaYDisponibilidad?.duelosPorPuesto,
      },
      calibracionReciente: base.guiaPrioridadContexto?.calibracionReciente ?? null,
      mercadoYxG: base.senalesExternasYGrupo?.mercadoYxG ?? null,
      consensoGrupoFoco: base.senalesExternasYGrupo?.inteligenciaGrupo?.consensoPartido ?? null,
    };
  }

  return base;
}

/**
 * Perfiles: live (predicción), replay (shadow Oracle), learning (post-partido).
 */
export function compactCompetitorContext(context, profile = 'live') {
  const humanized = isHumanizedCompetitorContext(context)
    ? context
    : humanizeCompetitorPromptContext(stripRedundantFieldsFromRawContext(context));
  return applyCompactionProfile(humanized, profile);
}

export function prepareOracleContextPayload(context, profile = 'live') {
  return compactCompetitorContext(context, profile);
}

export function serializeContextForPrompt(context, profile = 'live') {
  return JSON.stringify(prepareOracleContextPayload(context, profile));
}

const BLOCK_KEYS = [
  'guiaPrioridadContexto',
  'sedeYClima',
  'partido',
  'mundial2026',
  'plantillaYDisponibilidad',
  'senalesExternasYGrupo',
  'contextoPreTorneoYReferencia',
  'calibracionReciente',
  'mercadoYxG',
  'consensoGrupoFoco',
];

export function analyzeContextBlocks(context, profile = 'live') {
  const payload = prepareOracleContextPayload(context, profile);
  const fullJson = JSON.stringify(payload);
  const rows = BLOCK_KEYS.filter((key) => payload[key] != null).map((key) => {
    const json = JSON.stringify(payload[key]);
    return {
      block: key,
      chars: json.length,
      tokensEst: estimatePromptTokens(json),
    };
  });

  return {
    profile,
    totalChars: fullJson.length,
    totalTokensEst: estimatePromptTokens(fullJson),
    blocks: rows,
  };
}
