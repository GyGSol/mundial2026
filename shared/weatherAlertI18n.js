/**
 * Traducciones al castellano de alertas NOAA/NWS y MSC.
 * Fuente única compartida por backend (API) y frontend (fallback defensivo).
 * Hasta habilitar i18n multi-idioma: no exponer textos de autoridad en inglés al usuario.
 */

/** @typedef {{ label: string, detail?: string | null }} WeatherAlertTranslation */

/** @type {Record<string, WeatherAlertTranslation>} */
export const NWS_ALERT_ES = {
  'Air Quality Alert': {
    label: 'Alerta de calidad del aire',
    detail: 'Calidad del aire perjudicial para grupos sensibles o para actividad al aire libre.',
  },
  'Air Stagnation Advisory': {
    label: 'Aviso de aire estancado',
    detail: 'El aire permanece quieto y puede acumular contaminantes o niebla.',
  },
  'Blizzard Warning': {
    label: 'Alerta de ventisca',
    detail: 'Nevada intensa con vientos fuertes y visibilidad muy reducida.',
  },
  'Blizzard Watch': {
    label: 'Vigilancia de ventisca',
    detail: 'Condiciones favorables para una ventisca en las próximas horas.',
  },
  'Dense Fog Advisory': {
    label: 'Aviso de niebla densa',
    detail: 'Visibilidad muy baja por niebla; puede afectar desplazamientos y operaciones.',
  },
  'Excessive Heat Warning': {
    label: 'Alerta de calor extremo',
    detail: 'Temperaturas o índices de calor peligrosos para la salud.',
  },
  'Excessive Heat Watch': {
    label: 'Vigilancia de calor extremo',
    detail: 'Condiciones favorables para calor peligroso en los próximos días.',
  },
  'Flash Flood Emergency': {
    label: 'Emergencia por inundación repentina',
    detail: 'Inundación repentina grave e inminente; riesgo elevado para personas y bienes.',
  },
  'Flash Flood Warning': {
    label: 'Alerta de inundación repentina',
    detail: 'Inundación repentina inminente o en curso. Evitar zonas bajas y cauces.',
  },
  'Flash Flood Watch': {
    label: 'Vigilancia de inundación repentina',
    detail: 'Condiciones favorables para inundaciones súbitas en la zona.',
  },
  'Flood Advisory': {
    label: 'Aviso de inundación menor',
    detail: 'Inundación menor o molesta; no suele ser catastrófica pero requiere precaución.',
  },
  'Flood Warning': {
    label: 'Alerta de inundación',
    detail: 'Inundación inminente o en curso en la zona afectada.',
  },
  'Flood Watch': {
    label: 'Vigilancia de inundación',
    detail:
      'Condiciones favorables para posibles inundaciones. Aún no hay inundación confirmada; conviene estar atento.',
  },
  'Heat Advisory': {
    label: 'Aviso de calor',
    detail: 'Calor incómodo o potencialmente peligroso, sobre todo con actividad prolongada al aire libre.',
  },
  'High Wind Warning': {
    label: 'Alerta de vientos fuertes',
    detail: 'Vientos sostenidos o ráfagas peligrosas para estructuras temporarias y operaciones.',
  },
  'High Wind Watch': {
    label: 'Vigilancia de vientos fuertes',
    detail: 'Condiciones favorables para vientos fuertes en las próximas horas.',
  },
  'Hurricane Warning': {
    label: 'Alerta de huracán',
    detail: 'Condiciones de huracán esperadas o en curso en la zona.',
  },
  'Hurricane Watch': {
    label: 'Vigilancia de huracán',
    detail: 'Posible amenaza de huracán en las próximas 48 horas.',
  },
  'Red Flag Warning': {
    label: 'Alerta de bandera roja',
    detail: 'Riesgo crítico de incendio por viento, baja humedad o sequedad.',
  },
  'Severe Thunderstorm Warning': {
    label: 'Alerta de tormenta severa',
    detail: 'Tormenta severa confirmada o inminente (granizo, vientos fuertes o rayos intensos).',
  },
  'Severe Thunderstorm Watch': {
    label: 'Vigilancia de tormenta severa',
    detail: 'Condiciones favorables para tormentas severas en las próximas horas.',
  },
  'Severe Weather Statement': {
    label: 'Comunicado de tiempo severo',
    detail: 'Actualización sobre fenómenos severos ya en desarrollo o próximos.',
  },
  'Special Weather Statement': {
    label: 'Comunicado meteorológico especial',
    detail: 'Información relevante sobre condiciones inusuales o en evolución.',
  },
  'Tornado Emergency': {
    label: 'Emergencia por tornado',
    detail: 'Tornado confirmado y extremadamente peligroso; buscar refugio inmediato.',
  },
  'Tornado Warning': {
    label: 'Alerta de tornado',
    detail: 'Tornado avistado o indicado por radar; buscar refugio interior seguro.',
  },
  'Tornado Watch': {
    label: 'Vigilancia de tornado',
    detail: 'Condiciones favorables para tornados en la región.',
  },
  'Tropical Storm Warning': {
    label: 'Alerta de tormenta tropical',
    detail: 'Condiciones de tormenta tropical esperadas o en curso.',
  },
  'Tropical Storm Watch': {
    label: 'Vigilancia de tormenta tropical',
    detail: 'Posible tormenta tropical en las próximas 48 horas.',
  },
  'Wind Advisory': {
    label: 'Aviso de viento',
    detail: 'Vientos moderados a fuertes que pueden dificultar actividades al aire libre.',
  },
  'Winter Storm Warning': {
    label: 'Alerta de tormenta invernal',
    detail: 'Nevada, hielo o viento invernal con impacto significativo.',
  },
  'Winter Storm Watch': {
    label: 'Vigilancia de tormenta invernal',
    detail: 'Condiciones favorables para una tormenta invernal importante.',
  },
};

/** @type {Record<string, WeatherAlertTranslation>} */
export const MSC_ALERT_ES = {
  'thunderstorm warning': {
    label: 'Alerta de tormenta',
    detail: 'Tormenta eléctrica confirmada o inminente según Environment Canada.',
  },
  'severe thunderstorm warning': {
    label: 'Alerta de tormenta severa',
    detail: 'Tormenta severa con granizo, ráfagas o rayos intensos.',
  },
  'tornado warning': {
    label: 'Alerta de tornado',
    detail: 'Tornado avistado o probable; buscar refugio interior seguro.',
  },
  'rainfall warning': {
    label: 'Alerta de lluvia intensa',
    detail: 'Lluvias intensas con riesgo de anegamiento o desbordes.',
  },
  'wind warning': {
    label: 'Alerta de viento',
    detail: 'Vientos fuertes con riesgo para estructuras temporarias y operaciones.',
  },
  'winter storm warning': {
    label: 'Alerta de tormenta invernal',
    detail: 'Nevada, hielo o viento invernal con impacto significativo.',
  },
  'special weather statement': {
    label: 'Comunicado meteorológico especial',
    detail: 'Información relevante sobre condiciones inusuales o en evolución.',
  },
};

const PHRASE_ES = {
  'flash flood': 'inundación repentina',
  flood: 'inundación',
  'severe thunderstorm': 'tormenta severa',
  thunderstorm: 'tormenta',
  tornado: 'tornado',
  'winter storm': 'tormenta invernal',
  'tropical storm': 'tormenta tropical',
  hurricane: 'huracán',
  blizzard: 'ventisca',
  'dense fog': 'niebla densa',
  fog: 'niebla',
  wind: 'viento',
  heat: 'calor',
  snow: 'nieve',
  ice: 'hielo',
  rainfall: 'lluvia intensa',
  rain: 'lluvia',
  lightning: 'rayos',
  hail: 'granizo',
};

const SUFFIX_ES = {
  emergency: { label: 'Emergencia por', detail: 'Situación extrema e inmediata; seguir indicaciones oficiales.' },
  warning: { label: 'Alerta de', detail: 'Fenómeno inminente o en curso.' },
  watch: {
    label: 'Vigilancia de',
    detail: 'Condiciones favorables para que ocurra; aún no confirmado.',
  },
  advisory: { label: 'Aviso de', detail: 'Impacto menor o moderado; precaución recomendada.' },
  statement: {
    label: 'Comunicado de',
    detail: 'Actualización informativa de la autoridad meteorológica.',
  },
};

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function lookupExact(event) {
  const trimmed = String(event ?? '').trim();
  if (!trimmed) return null;
  if (NWS_ALERT_ES[trimmed]) return NWS_ALERT_ES[trimmed];
  const lower = normalizeKey(trimmed);
  for (const [key, value] of Object.entries(NWS_ALERT_ES)) {
    if (normalizeKey(key) === lower) return value;
  }
  for (const [key, value] of Object.entries(MSC_ALERT_ES)) {
    if (normalizeKey(key) === lower) return value;
  }
  return null;
}

function translateByPattern(event) {
  const lower = normalizeKey(event);
  for (const [suffix, meta] of Object.entries(SUFFIX_ES)) {
    const suffixToken = ` ${suffix}`;
    if (!lower.endsWith(suffixToken)) continue;
    const subject = lower.slice(0, -suffixToken.length).trim();
    if (!subject) continue;
    const subjectEs = Object.entries(PHRASE_ES)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([en]) => subject === en || subject.includes(en))?.[1];
    if (!subjectEs) continue;
    return {
      label: `${meta.label} ${subjectEs}`,
      detail: meta.detail,
    };
  }
  return null;
}

/**
 * @param {string | null | undefined} event
 * @returns {WeatherAlertTranslation}
 */
export function translateWeatherAlertEvent(event) {
  const exact = lookupExact(event);
  if (exact) return { label: exact.label, detail: exact.detail ?? null };

  const patterned = translateByPattern(event);
  if (patterned) return patterned;

  return {
    label: 'Alerta meteorológica',
    detail: 'La autoridad local emitió un aviso; consultá fuentes oficiales para detalle.',
  };
}

/**
 * @param {{ event?: string | null, headline?: string | null } | null | undefined} alert
 */
export function localizeAuthorityAlert(alert) {
  if (!alert) return null;
  const { label, detail } = translateWeatherAlertEvent(alert.event);
  return {
    ...alert,
    event: label,
    detail: detail ?? null,
    headline: null,
  };
}

/**
 * @param {{ primaryAlert?: object | null, alerts?: object[] | null } | null | undefined} block
 */
export function localizeAuthorityAlertsBlock(block) {
  if (!block) return block;
  return {
    ...block,
    primaryAlert: localizeAuthorityAlert(block.primaryAlert),
    alerts: Array.isArray(block.alerts)
      ? block.alerts.map((item) => localizeAuthorityAlert(item)).filter(Boolean)
      : [],
  };
}
