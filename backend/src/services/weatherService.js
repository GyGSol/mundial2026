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

function formatWeatherSnapshot({ temperatureC, humidityPct, precipitationPct, windKmh, weatherCode }) {
  return {
    temperatureC: temperatureC ?? null,
    humidityPct: humidityPct ?? null,
    precipitationPct: precipitationPct ?? null,
    windKmh: windKmh ?? null,
    description: describeWeatherCode(weatherCode),
    weatherCode: weatherCode ?? null,
  };
}

async function fetchOpenMeteo({ latitude, longitude, timezone, kickoffAt }, { fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m',
    timezone: timezone || 'auto',
    forecast_days: '16',
    wind_speed_unit: 'kmh',
  });

  const kickoffParts = kickoffAt ? toIsoDateInTimezone(kickoffAt, timezone) : null;
  if (kickoffParts?.date) {
    params.set('start_date', kickoffParts.date);
    params.set('end_date', kickoffParts.date);
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
  { kickoffAt = null, fetchImpl = fetch } = {}
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
  const cached = readCache(key);
  if (cached) return cached;

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
          windKmh: hourly.wind_speed_10m?.[idx],
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
