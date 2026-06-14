/** Perfil climático por sede del Mundial 2026 (protocolo y riesgo estacional). */

export const STADIUM_WEATHER_PROFILE_BY_ID = {
  '1': { lightningProtocolRegion: 'mexico', thunderstormSeasonRisk: 'medium', hasRetractableRoof: false },
  '2': { lightningProtocolRegion: 'mexico', thunderstormSeasonRisk: 'medium', hasRetractableRoof: false },
  '3': { lightningProtocolRegion: 'mexico', thunderstormSeasonRisk: 'medium', hasRetractableRoof: false },
  '4': { lightningProtocolRegion: 'usa-noaa', thunderstormSeasonRisk: 'high', hasRetractableRoof: true },
  '5': { lightningProtocolRegion: 'usa-noaa', thunderstormSeasonRisk: 'high', hasRetractableRoof: true },
  '6': { lightningProtocolRegion: 'usa-noaa', thunderstormSeasonRisk: 'high', hasRetractableRoof: false },
  '7': { lightningProtocolRegion: 'usa-noaa', thunderstormSeasonRisk: 'high', hasRetractableRoof: true },
  '8': { lightningProtocolRegion: 'usa-noaa', thunderstormSeasonRisk: 'high', hasRetractableRoof: false },
  '9': { lightningProtocolRegion: 'usa-noaa', thunderstormSeasonRisk: 'medium', hasRetractableRoof: false },
  '10': { lightningProtocolRegion: 'usa-noaa', thunderstormSeasonRisk: 'medium', hasRetractableRoof: false },
  '11': { lightningProtocolRegion: 'usa-noaa', thunderstormSeasonRisk: 'medium', hasRetractableRoof: false },
  '12': { lightningProtocolRegion: 'canada', thunderstormSeasonRisk: 'low', hasRetractableRoof: false },
  '13': { lightningProtocolRegion: 'canada', thunderstormSeasonRisk: 'low', hasRetractableRoof: true },
  '14': { lightningProtocolRegion: 'usa-noaa', thunderstormSeasonRisk: 'low', hasRetractableRoof: false },
  '15': { lightningProtocolRegion: 'usa-noaa', thunderstormSeasonRisk: 'low', hasRetractableRoof: false },
  '16': { lightningProtocolRegion: 'usa-noaa', thunderstormSeasonRisk: 'low', hasRetractableRoof: true },
};

const DEFAULT_PROFILE = {
  lightningProtocolRegion: 'other',
  thunderstormSeasonRisk: 'medium',
  hasRetractableRoof: false,
};

export function resolveStadiumWeatherProfile(stadium = {}) {
  const id = String(stadium?.externalId ?? '').trim();
  if (id && STADIUM_WEATHER_PROFILE_BY_ID[id]) {
    return { ...DEFAULT_PROFILE, ...STADIUM_WEATHER_PROFILE_BY_ID[id], externalId: id };
  }
  const country = String(stadium?.country ?? '').toLowerCase();
  if (country.includes('usa') || country.includes('estados unidos') || country.includes('united states')) {
    return { ...DEFAULT_PROFILE, lightningProtocolRegion: 'usa-noaa', thunderstormSeasonRisk: 'high' };
  }
  if (country.includes('canad')) {
    return { ...DEFAULT_PROFILE, lightningProtocolRegion: 'canada', thunderstormSeasonRisk: 'low' };
  }
  if (country.includes('mex')) {
    return { ...DEFAULT_PROFILE, lightningProtocolRegion: 'mexico', thunderstormSeasonRisk: 'medium' };
  }
  return { ...DEFAULT_PROFILE };
}

export function noaaProtocolCopy(profile) {
  if (profile?.lightningProtocolRegion !== 'usa-noaa') return null;
  return {
    title: 'Protocolo NOAA (sedes USA)',
    summary:
      'Parada si hay rayo dentro de 8 millas; espera mínima de 30 min sin nuevos impactos antes de reanudar.',
    detail:
      'FIFA sigue las autoridades locales. En EE.UU. se aplica la guía NOAA: evacuación del campo y gradas, cronómetro de 30 min que se reinicia con cada rayo cercano.',
  };
}
