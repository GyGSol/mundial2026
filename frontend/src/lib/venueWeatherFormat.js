/** Formato compartido entre panel IA (MatchVenueWeather) y esquina en tarjetas live. */
export function formatWeatherSnapshot(snapshot) {
  if (!snapshot || snapshot.available === false) return null;
  const temp =
    snapshot.temperatureC != null ? `${Math.round(snapshot.temperatureC)}°C` : null;
  const humidity =
    snapshot.humidityPct != null ? `${Math.round(snapshot.humidityPct)}% hum.` : null;
  const wind = snapshot.windKmh != null ? `${Math.round(snapshot.windKmh)} km/h` : null;
  const rain =
    snapshot.precipitationPct != null ? `${Math.round(snapshot.precipitationPct)}% lluvia` : null;
  const description = snapshot.description ?? null;

  return { temp, humidity, wind, rain, description };
}

export function hasCurrentVenueWeather(weather) {
  if (!weather?.available) return false;
  const current = formatWeatherSnapshot(weather.current);
  if (!current) return false;
  return Boolean(current.description || current.temp || current.humidity || current.wind);
}
