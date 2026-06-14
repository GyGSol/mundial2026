/** Coordenadas aproximadas de sedes del Mundial 2026 (Open-Meteo / geocoding). */

export const STADIUM_COORDINATES_BY_ID = {
  '1': { latitude: 19.3028, longitude: -99.1503, region: 'Ciudad de México', country: 'México' },
  '2': { latitude: 20.6818, longitude: -103.4626, region: 'Jalisco', country: 'México' },
  '3': { latitude: 25.6866, longitude: -100.2453, region: 'Nuevo León', country: 'México' },
  '4': { latitude: 32.7473, longitude: -97.0945, region: 'Texas', country: 'Estados Unidos' },
  '5': { latitude: 29.6847, longitude: -95.4107, region: 'Texas', country: 'Estados Unidos' },
  '6': { latitude: 39.0489, longitude: -94.4839, region: 'Misuri', country: 'Estados Unidos' },
  '7': { latitude: 33.7553, longitude: -84.4006, region: 'Georgia', country: 'Estados Unidos' },
  '8': { latitude: 25.958, longitude: -80.2389, region: 'Florida', country: 'Estados Unidos' },
  '9': { latitude: 42.0909, longitude: -71.2643, region: 'Massachusetts', country: 'Estados Unidos' },
  '10': { latitude: 39.9008, longitude: -75.1675, region: 'Pennsylvania', country: 'Estados Unidos' },
  '11': { latitude: 40.8128, longitude: -74.0742, region: 'Nueva Jersey', country: 'Estados Unidos' },
  '12': { latitude: 43.6332, longitude: -79.4186, region: 'Ontario', country: 'Canadá' },
  '13': { latitude: 49.2768, longitude: -123.1118, region: 'Columbia Británica', country: 'Canadá' },
  '14': { latitude: 47.5952, longitude: -122.3316, region: 'Washington', country: 'Estados Unidos' },
  '15': { latitude: 37.4033, longitude: -121.9694, region: 'California', country: 'Estados Unidos' },
  '16': { latitude: 33.9535, longitude: -118.3392, region: 'California', country: 'Estados Unidos' },
};

const CITY_RULES = [
  { pattern: /vancouver|bc place/i, id: '13' },
  { pattern: /toronto|bmo field/i, id: '12' },
  { pattern: /seattle|lumen field/i, id: '14' },
  { pattern: /san francisco|santa clara|levi/i, id: '15' },
  { pattern: /los angeles|inglewood|sofi/i, id: '16' },
  { pattern: /miami|hard rock/i, id: '8' },
  { pattern: /atlanta|mercedes/i, id: '7' },
  { pattern: /boston|foxborough|gillette/i, id: '9' },
  { pattern: /new york|new jersey|east rutherford|metlife/i, id: '11' },
  { pattern: /philadelphia|lincoln financial/i, id: '10' },
  { pattern: /dallas|arlington|at&t|att stadium/i, id: '4' },
  { pattern: /houston|nrg/i, id: '5' },
  { pattern: /kansas city|arrowhead/i, id: '6' },
  { pattern: /monterrey|bbva/i, id: '3' },
  { pattern: /guadalajara|akron/i, id: '2' },
  { pattern: /mexico city|ciudad de m[eé]xico|azteca/i, id: '1' },
];

export function resolveStadiumCoordinates(stadium = {}) {
  const directId = String(stadium.externalId ?? '').trim();
  if (directId && STADIUM_COORDINATES_BY_ID[directId]) {
    return { ...STADIUM_COORDINATES_BY_ID[directId], externalId: directId };
  }

  const haystack = [stadium.city, stadium.country, stadium.nameEn, stadium.nameFa]
    .filter(Boolean)
    .join(' ');

  if (!haystack.trim()) return null;

  for (const { pattern, id } of CITY_RULES) {
    if (pattern.test(haystack)) {
      return { ...STADIUM_COORDINATES_BY_ID[id], externalId: id };
    }
  }

  return null;
}

export function formatVenueLocationLine(stadium, coordinates) {
  const city = stadium?.city ?? null;
  const region = coordinates?.region ?? null;
  const country = coordinates?.country ?? stadium?.country ?? null;
  const parts = [city, region, country].filter(Boolean);
  return parts.length ? [...new Set(parts)].join(', ') : null;
}
