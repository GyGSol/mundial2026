import { resolveStadiumCoordinates, formatVenueLocationLine } from '../data/stadiumCoordinates.js';
import { resolveStadiumTimezone } from './stadiumTimezones.js';

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();

const WMO_DESCRIPTIONS = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna moderada',
  55: 'Llovizna intensa',
  56: 'Llovizna helada ligera',
  57: 'Llovizna helada intensa',
  61: 'Lluvia ligera',
  63: 'Lluvia moderada',
  65: 'Lluvia intensa',
  66: 'Lluvia helada ligera',
  67: 'Lluvia helada intensa',
  71: 'Nevada ligera',
  73: 'Nevada moderada',
  75: 'Nevada intensa',
  77: 'Granizo de nieve',
  80: 'Chubascos ligeros',
  81: 'Chubascos moderados',
  82: 'Chubascos intensos',
  85: 'Chubascos de nieve ligeros',
  86: 'Chubascos de nieve intensos',
  95: 'Tormenta',
  96: 'Tormenta con granizo ligero',
  99: 'Tormenta con granizo fuerte',
};

function describeWeatherCode(code) {
  const numeric = Number(code);
  if (!Number.isFinite(numeric)) return 'Sin datos';
  return WMO_DESCRIPTIONS[numeric] ?? 'Condición variable';
}

function cacheKey(latitude, longitude, kickoffAt, timezone) {
  const kickoffKey = kickoffAt ? new Date(kickoffAt).toISOString().slice(0, 13) : 'now';
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}:${timezone ?? 'utc'}:${kickoffKey}`;
}

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key, value) {
  cache.set(key, { at: Date.now(), value });
}

function formatLocalDateTime(isoUtc, timezone) {
  if (!isoUtc || !timezone) return null;
  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: timezone,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(isoUtc));
  } catch {
    return null;
  }
}

function toIsoDateInTimezone(isoUtc, timezone) {
  if (!isoUtc || !timezone) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(isoUtc));
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return {
      date: `${get('year')}-${get('month')}-${get('day')}`,
      hour: `${get('hour')}:${get('minute')}`,
    };
  } catch {
    return null;
  }
}

function pickNearestHourlyIndex(times, kickoffAt) {
  if (!Array.isArray(times) || !times.length || !kickoffAt) return -1;
  const target = new Date(kickoffAt).getTime();
  if (Number.isNaN(target)) return -1;

  let bestIdx = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const ts = new Date(times[i]).getTime();
    if (Number.isNaN(ts)) continue;
    const diff = Math.abs(ts - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function formatWeatherSnapshot({
  temperatureC,
  humidityPct,
  precipitationPct,
  precipitationMm,
  windKmh,
  windGustKmh,
  weatherCode,
}) {
  return {
    temperatureC: temperatureC ?? null,
    humidityPct: humidityPct ?? null,
    precipitationPct: precipitationPct ?? null,
    precipitationMm: precipitationMm ?? null,
    windKmh: windKmh ?? null,
    windGustKmh: windGustKmh ?? null,
    description: describeWeatherCode(weatherCode),
    weatherCode: weatherCode ?? null,
  };
}

async function fetchOpenMeteo({ latitude, longitude, timezone, kickoffAt }, { fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,precipitation',
    hourly:
      'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
    timezone: timezone || 'auto',
    wind_speed_unit: 'kmh',
  });

  const kickoffParts = kickoffAt ? toIsoDateInTimezone(kickoffAt, timezone) : null;
  if (kickoffParts?.date) {
    params.set('start_date', kickoffParts.date);
    params.set('end_date', kickoffParts.date);
  } else {
    params.set('forecast_days', '16');
  }

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo respondió ${response.status}`);
  }

  return response.json();
}

export async function getVenueWeatherForStadium(
  stadium,
  { kickoffAt = null, fetchImpl = fetch, fresh = false } = {}
) {
  const coordinates = resolveStadiumCoordinates(stadium);
  if (!coordinates) {
    return {
      available: false,
      reason: 'coordinates_unavailable',
      locationLine: formatVenueLocationLine(stadium, null),
    };
  }

  const timezone = stadium?.timezone || resolveStadiumTimezone(stadium) || 'UTC';
  const key = cacheKey(coordinates.latitude, coordinates.longitude, kickoffAt, timezone);
  if (!fresh) {
    const cached = readCache(key);
    if (cached) return cached;
  }

  try {
    const data = await fetchOpenMeteo(
      {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        timezone,
        kickoffAt,
      },
      { fetchImpl }
    );

    const current = data?.current
      ? formatWeatherSnapshot({
          temperatureC: data.current.temperature_2m,
          humidityPct: data.current.relative_humidity_2m,
          windKmh: data.current.wind_speed_10m,
          windGustKmh: data.current.wind_gusts_10m,
          precipitationMm: data.current.precipitation,
          weatherCode: data.current.weather_code,
        })
      : null;

    let kickoffForecast = null;
    const hourly = data?.hourly;
    const idx = pickNearestHourlyIndex(hourly?.time, kickoffAt);
    if (idx >= 0 && hourly) {
      kickoffForecast = {
        ...formatWeatherSnapshot({
          temperatureC: hourly.temperature_2m?.[idx],
          humidityPct: hourly.relative_humidity_2m?.[idx],
          precipitationPct: hourly.precipitation_probability?.[idx],
          precipitationMm: hourly.precipitation?.[idx],
          windKmh: hourly.wind_speed_10m?.[idx],
          windGustKmh: hourly.wind_gusts_10m?.[idx],
          weatherCode: hourly.weather_code?.[idx],
        }),
        atUtc: hourly.time?.[idx] ?? null,
        atLocal: formatLocalDateTime(hourly.time?.[idx], timezone),
      };
    } else if (kickoffAt) {
      kickoffForecast = {
        available: false,
        reason: 'forecast_out_of_range',
        atLocal: formatLocalDateTime(kickoffAt, timezone),
      };
    }

    const payload = {
      available: true,
      source: 'open-meteo',
      fetchedAt: new Date().toISOString(),
      timezone,
      coordinates: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      },
      locationLine: formatVenueLocationLine(stadium, coordinates),
      region: coordinates.region ?? null,
      country: coordinates.country ?? stadium?.country ?? null,
      current,
      kickoffForecast,
    };

    writeCache(key, payload);
    return payload;
  } catch (err) {
    return {
      available: false,
      reason: 'fetch_failed',
      message: err.message,
      timezone,
      locationLine: formatVenueLocationLine(stadium, coordinates),
      region: coordinates.region ?? null,
      country: coordinates.country ?? stadium?.country ?? null,
    };
  }
}

export function formatWeatherForClient(weather) {
  if (!weather) return null;
  return {
    available: Boolean(weather.available),
    reason: weather.reason ?? null,
    source: weather.source ?? null,
    fetchedAt: weather.fetchedAt ?? null,
    timezone: weather.timezone ?? null,
    locationLine: weather.locationLine ?? null,
    region: weather.region ?? null,
    country: weather.country ?? null,
    current: weather.current ?? null,
    kickoffForecast: weather.kickoffForecast ?? null,
  };
}

export function buildMatchWeatherPredictionContext(weather) {
  if (!weather?.available) {
    return {
      status: 'unavailable',
      reason: weather?.reason ?? 'unknown',
      locationLine: weather?.locationLine ?? null,
      instruction:
        'Sin datos del panel Sede y clima: no inventes temperatura, humedad ni lluvia concretas en el pronóstico.',
    };
  }

  const kickoff = weather.kickoffForecast;
  const kickoffUsable =
    kickoff &&
    kickoff.available !== false &&
    kickoff.temperatureC != null &&
    Number.isFinite(Number(kickoff.temperatureC));

  return {
    status: 'ok',
    source: 'sede-y-clima-open-meteo',
    authoritativeForPrediction: true,
    instruction:
      'OBLIGATORIO: usá sedeYClima (clima actual + pronóstico al kickoff, Open-Meteo). En vivo priorizá currentAtVenue; próximo partido priorizá kickoffForecast. No sustituyas por clima típico de la ciudad ni morale.venueClimate heurístico.',
    locationLine: weather.locationLine,
    region: weather.region,
    country: weather.country,
    timezone: weather.timezone,
    fetchedAt: weather.fetchedAt,
    kickoffAtLocal: kickoff?.atLocal ?? null,
    kickoffForecast: kickoffUsable
      ? {
          description: kickoff.description,
          temperatureC: kickoff.temperatureC,
          humidityPct: kickoff.humidityPct,
          precipitationPct: kickoff.precipitationPct,
          windKmh: kickoff.windKmh,
        }
      : null,
    currentAtVenue: weather.current ?? null,
  };
}

export function formatWeatherForPrompt(weather) {
  if (!weather?.available) {
    return {
      status: 'unavailable',
      reason: weather?.reason ?? 'unknown',
      locationLine: weather?.locationLine ?? null,
    };
  }

  return {
    status: 'ok',
    locationLine: weather.locationLine,
    region: weather.region,
    country: weather.country,
    timezone: weather.timezone,
    current: weather.current,
    kickoffForecast: weather.kickoffForecast,
    fetchedAt: weather.fetchedAt,
  };
}

/** Línea legible tipo panel Predicciones: "lluvia moderada, 14°C, humedad 98%, viento 14 km/h". */
export function formatWeatherSnapshotLine(snapshot) {
  if (!snapshot || snapshot.available === false) return null;
  const parts = [];
  if (snapshot.description) parts.push(String(snapshot.description).toLowerCase());
  if (snapshot.temperatureC != null && Number.isFinite(Number(snapshot.temperatureC))) {
    const temp = Number(snapshot.temperatureC);
    parts.push(`${Number.isInteger(temp) ? temp : temp.toFixed(1)}°C`);
  }
  if (snapshot.humidityPct != null && Number.isFinite(Number(snapshot.humidityPct))) {
    parts.push(`humedad ${Math.round(Number(snapshot.humidityPct))}%`);
  }
  if (snapshot.windKmh != null && Number.isFinite(Number(snapshot.windKmh))) {
    parts.push(`viento ${Math.round(Number(snapshot.windKmh))} km/h`);
  }
  if (snapshot.precipitationPct != null && Number.isFinite(Number(snapshot.precipitationPct))) {
    parts.push(`${Math.round(Number(snapshot.precipitationPct))}% lluvia`);
  }
  return parts.length ? parts.join(', ') : null;
}

function formatKickoffLocalLabel(venue, weather) {
  return (
    venue?.kickoffLocal ??
    weather?.kickoffForecast?.atLocal ??
    null
  );
}

/**
 * Bloque sede+clima para contexto IA (mismo criterio que panel Predicciones).
 * En vivo prioriza clima actual; próximo partido prioriza pronóstico al kickoff.
 */
export function buildVenueWeatherContextForPrediction(venue, weather, { matchStatus } = {}) {
  const stadium = venue?.stadium ?? null;
  const locationParts = [
    stadium?.name ?? stadium?.nameEn ?? null,
    weather?.locationLine ??
      [stadium?.city, stadium?.country].filter(Boolean).join(', ') ??
      null,
  ].filter(Boolean);
  const kickoffLabel = formatKickoffLocalLabel(venue, weather);
  const estadioLine =
    locationParts.length > 0
      ? `${locationParts.join(', ')}${kickoffLabel ? ` (${kickoffLabel})` : ''}`
      : kickoffLabel
        ? `(${kickoffLabel})`
        : null;

  const currentLine = weather?.current ? formatWeatherSnapshotLine(weather.current) : null;
  const kickoffLine = weather?.kickoffForecast
    ? formatWeatherSnapshotLine(weather.kickoffForecast)
    : null;

  const live = matchStatus === 'live';
  const prioridadClima = live && currentLine ? 'actual_en_sede' : 'kickoff';
  const climaPrincipal =
    prioridadClima === 'actual_en_sede' ? currentLine : kickoffLine ?? currentLine;

  let resumenLinea = null;
  if (estadioLine && climaPrincipal) {
    resumenLinea = `Estadio: ${estadioLine}. Clima: ${climaPrincipal}.`;
  } else if (estadioLine) {
    resumenLinea = `Estadio: ${estadioLine}.`;
  } else if (climaPrincipal) {
    resumenLinea = `Clima: ${climaPrincipal}.`;
  }

  const instruccion =
    weather?.available === false
      ? 'Sin datos de clima en sede: no inventes temperatura, humedad ni lluvia.'
      : live
        ? 'Partido en vivo: citá el clima actual en la sede (Open-Meteo) como condición real del encuentro.'
        : 'Partido próximo: citá el pronóstico al kickoff como clima del partido; podés mencionar también el clima actual en la sede.';

  return {
    disponible: Boolean(weather?.available),
    estadio: estadioLine,
    climaActualEnSede: currentLine
      ? { linea: currentLine, datos: weather.current }
      : null,
    pronosticoAlKickoff: kickoffLine
      ? {
          linea: kickoffLine,
          horaLocal: weather.kickoffForecast?.atLocal ?? null,
          datos: weather.kickoffForecast,
        }
      : null,
    resumenLinea,
    prioridadClima,
    instruccion,
  };
}
