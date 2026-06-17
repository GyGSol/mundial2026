const HEALTH_LABELS = {
  available: 'Disponible',
  injured: 'Lesionado',
  doubt: 'Duda',
  unknown: 'Sin datos confirmados',
};

const POSITION_LABELS = {
  GK: 'Portero',
  DEF: 'Defensa',
  MID: 'Mediocampista',
  FWD: 'Delantero',
};

const EDGE_LABELS = {
  home: 'ventaja local',
  away: 'ventaja visitante',
  even: 'paridad',
};

export const WORLD_CUP_USER_FACING_LANGUAGE_RULES = `REGLAS DE RESPUESTA AL USUARIO (obligatorias):
- Respondé en español natural, como un periodista deportivo. El usuario NO ve el JSON de contexto.
- NUNCA cites nombres técnicos del contexto: squadAnalysis, nationContext, positionMatchups, healthStatus, isProbableStarter, injuries, doubtful, suspended, kickoffForecast, fixtureRole, etc.
- NUNCA muestres valores en inglés del sistema (unknown, available, doubt, injured, home, away, even).
- Traducí siempre a lenguaje claro: "titular probable", "sin datos confirmados de su estado físico", "lesionados", "en duda", "suspendidos".
- Nombrá jugadores, equipos, sedes y datos concretos; no describas la estructura del contexto.
- No uses backticks, bloques de código ni tablas con formato técnico; escribí en prosa o listas simples.`;

function humanizePlayer(player) {
  if (!player) return null;
  const name = player.name ?? player.fullName ?? player.nombre;
  return {
    nombre: name,
    posición: POSITION_LABELS[player.position] ?? player.position ?? null,
    club: player.club ?? player.currentClub ?? null,
    liga: player.league ?? player.leagueName ?? null,
    edad: player.age ?? player.edad ?? null,
    dorsal: player.shirtNumber ?? player.dorsal ?? null,
    estadoFísico: HEALTH_LABELS[player.healthStatus] ?? 'Sin datos confirmados',
    lesión: player.injuryInfo ?? player.lesión ?? null,
    amarillas: player.yellowCards ?? player.amarillas ?? 0,
    rojas: player.redCards ?? player.rojas ?? 0,
    suspendido: Boolean(player.suspended ?? player.suspendido),
    motivoSuspensión: player.suspensionInfo ?? player.motivoSuspensión ?? null,
    titularProbable: Boolean(player.isProbableStarter ?? player.titularProbable),
    nota: player.aiNote ?? player.nota ?? null,
  };
}

function humanizeSquadSnapshot(squad) {
  if (!squad) return null;
  const mapPlayers = (list) => (Array.isArray(list) ? list.map(humanizePlayer) : []);

  return {
    titularesProbables: mapPlayers(squad.probableStarters),
    lesionados: mapPlayers(squad.injuries),
    enDuda: mapPlayers(squad.doubtful),
    suspendidos: mapPlayers(squad.suspended),
    riesgoTarjetas: mapPlayers(squad.cardsRisk),
    disponibilidadPlantilla:
      squad.availabilityRate != null ? `${Math.round(squad.availabilityRate * 100)}%` : null,
    resumen: {
      lesionados: squad.injuredCount ?? 0,
      enDuda: squad.doubtfulCount ?? 0,
      suspendidos: squad.suspendedCount ?? 0,
      tamañoPlantilla: squad.squadSize ?? 0,
      intelDesactualizada: Boolean(squad.intelStale),
    },
  };
}

function humanizePositionMatchups(matchups) {
  if (!Array.isArray(matchups)) return [];
  return matchups.map((row) => ({
    línea: POSITION_LABELS[row.position] ?? row.position,
    local: (row.home ?? []).map((p) => ({
      nombre: p.name,
      club: p.club,
      liga: p.league,
      estadoFísico: HEALTH_LABELS[p.healthStatus] ?? 'Sin datos confirmados',
    })),
    visitante: (row.away ?? []).map((p) => ({
      nombre: p.name,
      club: p.club,
      liga: p.league,
      estadoFísico: HEALTH_LABELS[p.healthStatus] ?? 'Sin datos confirmados',
    })),
    ventaja: EDGE_LABELS[row.edge] ?? row.edge,
    nota: row.fieldImpactNote ?? null,
  }));
}

function humanizeNationSide(side) {
  if (!side) return null;
  const morale = side.morale ?? {};
  const favoriteMap = {
    favorite: 'favorito',
    underdog: 'no favorito',
    even: 'paridad',
  };
  const climateMap = {
    tropical_caluroso: 'caluroso y húmedo',
    templado: 'templado',
    frio: 'frío',
    lluvioso: 'lluvioso',
    altitud: 'altitud',
    desafiante: 'desafiante',
    familiar: 'familiar',
  };

  return {
    perfil: side.profile ?? null,
    historialMundial: {
      títulos: side.worldCupTitles ?? null,
      registrosWiki: side.wikiRecords ?? null,
      finalesDestacadas: side.finalHighlights ?? null,
    },
    índiceTalento: side.talentPoolIndex ?? null,
    factoresAnímicos: {
      favoritismo: favoriteMap[morale.favoriteOrUnderdog] ?? morale.favoriteOrUnderdog ?? null,
      debutMundial: morale.isWorldCupDebut ? 'sí' : 'no',
      climaSede: climateMap[morale.venueClimate] ?? morale.venueClimate ?? null,
      adaptaciónClimática: climateMap[morale.climateAdaptation] ?? morale.climateAdaptation ?? null,
      climaKickoff: morale.kickoffWeather ?? null,
      notas: morale.notes ?? null,
    },
  };
}

/** Contexto legible para prompts de IA orientados al usuario final. */
export function humanizePromptContext(context) {
  if (!context || typeof context !== 'object') return context;

  const {
    squadAnalysis,
    nationContext,
    positionMatchups,
    homeTeam,
    awayTeam,
    ...rest
  } = context;

  return {
    ...rest,
    equipoLocal: homeTeam ?? null,
    equipoVisitante: awayTeam ?? null,
    análisisPlantilla: {
      local: humanizeSquadSnapshot(squadAnalysis?.home),
      visitante: humanizeSquadSnapshot(squadAnalysis?.away),
    },
    contextoSelecciones: {
      local: humanizeNationSide(nationContext?.home),
      visitante: humanizeNationSide(nationContext?.away),
    },
    duelosPorPuesto: humanizePositionMatchups(positionMatchups),
  };
}

const COMPETITOR_CONTEXT_PRIORITY_GUIDE = {
  ordenPorDefecto: [
    '1) Rendimiento en Mundial 2026 (forma, goles, tabla, stakes, H2H de esta Copa)',
    '2) Aprendizaje reciente (calibracionReciente) para corregir sesgos de Gdif',
    '3) Plantilla y disponibilidad (lesiones, titulares, duelos por puesto)',
    '4) Mercado/xG y consenso del grupo (señales de apoyo)',
    '5) Ranking FIFA e historial pre-torneo (solo si hay pocos PJ en 2026)',
  ],
  decisionAdaptativa:
    'Ajustá el peso de cada bloque según calibracionReciente: si el error combinado es alto o hay sesgo de goles local/visitante, priorizá mundial2026 y plantilla; reducí confianza en xG/mercado o historial lejano hasta corregir el sesgo.',
};

/**
 * Contexto del competidor IA con torneo 2026 primero; calibración guía pesos adaptativos.
 */
export function humanizeCompetitorPromptContext(context) {
  const humanized = humanizePromptContext(context);
  const {
    matchExternalId,
    phase,
    group,
    matchday,
    kickoffAt,
    fifaRankingsAsOf,
    venue,
    weatherOps,
    weatherRisk,
    liveScheduleContext,
    groupStandings,
    headToHead2026,
    historialReciente,
    stakesContext,
    tablaYClasificacion,
    inteligenciaGrupo,
    carreraPremios,
    calibracionReciente,
    mercadoYxG,
    equipoLocal,
    equipoVisitante,
    análisisPlantilla,
    contextoSelecciones,
    duelosPorPuesto,
    ...leftover
  } = humanized;

  const preTorneoLeftover = { ...leftover };
  for (const key of [
    'nationContext',
    'squadAnalysis',
    'positionMatchups',
    'homeTeam',
    'awayTeam',
    '_calibrationStats',
    '_lightContext',
    'externalIntel',
  ]) {
    delete preTorneoLeftover[key];
  }

  return {
    guiaPrioridadContexto: {
      ...COMPETITOR_CONTEXT_PRIORITY_GUIDE,
      calibracionReciente: calibracionReciente ?? null,
    },
    partido: {
      matchExternalId,
      phase,
      group,
      matchday,
      kickoffAt,
      venue,
      weatherOps,
      weatherRisk,
      liveScheduleContext,
    },
    mundial2026: {
      equipoLocal,
      equipoVisitante,
      historialDetallado: historialReciente ?? null,
      tablaGrupo: groupStandings ?? [],
      enfrentamientoDirecto2026: headToHead2026 ?? null,
      stakesClasificacion: stakesContext ?? null,
      tablaYClasificacion: tablaYClasificacion ?? null,
    },
    plantillaYDisponibilidad: {
      análisisPlantilla,
      duelosPorPuesto,
    },
    senalesExternasYGrupo: {
      mercadoYxG: mercadoYxG ?? null,
      inteligenciaGrupo: inteligenciaGrupo ?? null,
      carreraPremios: carreraPremios ?? null,
    },
    contextoPreTorneoYReferencia: {
      rankingFifaAl: fifaRankingsAsOf ?? null,
      contextoSelecciones,
      ...preTorneoLeftover,
    },
  };
}

const TECHNICAL_TERM_LABELS = {
  squadanalysis: 'análisis de plantilla',
  'squadanalysis.home': 'plantilla local',
  'squadanalysis.away': 'plantilla visitante',
  nationcontext: 'contexto de la selección',
  positionmatchups: 'duelos por puesto',
  probablestarters: 'titulares probables',
  isprobablestarter: 'titular probable',
  healthstatus: 'estado físico',
  injuries: 'lesionados',
  doubtful: 'en duda',
  suspended: 'suspendidos',
  cardsrisk: 'riesgo de tarjetas',
  kickoffforecast: 'pronóstico al kickoff',
  matchweather: 'clima del partido',
  fixtureroll: 'rol en el fixture',
  availabilityrate: 'disponibilidad de la plantilla',
  intelstale: 'datos desactualizados',
};

const ENGLISH_STATUS_LABELS = {
  unknown: 'sin datos confirmados',
  available: 'disponible',
  doubt: 'en duda',
  injured: 'lesionado',
  home: 'local',
  away: 'visitante',
  even: 'paridad',
  true: 'sí',
  false: 'no',
};

function labelForTechnicalTerm(raw) {
  const key = String(raw ?? '').trim().toLowerCase();
  if (!key) return '';
  if (TECHNICAL_TERM_LABELS[key]) return TECHNICAL_TERM_LABELS[key];
  const assignment = key.match(/^([\w.]+)\s*:\s*(.+)$/);
  if (assignment) {
    const field = labelForTechnicalTerm(assignment[1]);
    const value = ENGLISH_STATUS_LABELS[assignment[2].trim().toLowerCase()] ?? assignment[2].trim();
    return `${field}: ${value}`;
  }
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\./g, ' ')
    .toLowerCase();
}

/** Limpia respuestas de IA antes de mostrarlas al usuario. */
export function sanitizeAiUserFacingText(text) {
  let result = String(text ?? '');

  result = result.replace(/`([^`]+)`/g, (_match, inner) => labelForTechnicalTerm(inner));

  for (const [term, label] of Object.entries(TECHNICAL_TERM_LABELS)) {
    const pattern = new RegExp(`\\b${term.replace('.', '\\.')}\\b`, 'gi');
    result = result.replace(pattern, label);
  }

  result = result.replace(/"unknown"/gi, 'sin datos confirmados');
  result = result.replace(/\bunknown\b/gi, 'sin datos confirmados');
  result = result.replace(/"available"/gi, 'disponible');
  result = result.replace(/"doubt"/gi, 'en duda');
  result = result.replace(/"injured"/gi, 'lesionado');

  return result.trim();
}

/** Resumen corto para listados admin (quita markdown pesado). */
export function briefAiReasoning(text, maxLen = 300) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const plain = raw
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^[-*#]+\s+/gm, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  if (plain.length <= maxLen) return plain;
  const cut = plain.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}
