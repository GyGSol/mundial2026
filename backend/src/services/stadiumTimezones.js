/** IANA time zones for FIFA World Cup 2026 host venues (USA, Mexico, Canada). */

const CITY_RULES = [
  { pattern: /vancouver|bc place/i, timezone: 'America/Vancouver' },
  { pattern: /toronto|bmo field/i, timezone: 'America/Toronto' },
  { pattern: /seattle|lumen field/i, timezone: 'America/Los_Angeles' },
  { pattern: /san francisco|santa clara|levi|bay area/i, timezone: 'America/Los_Angeles' },
  { pattern: /los angeles|inglewood|sofi|pasadena|rose bowl/i, timezone: 'America/Los_Angeles' },
  { pattern: /miami|hard rock/i, timezone: 'America/New_York' },
  { pattern: /atlanta|mercedes/i, timezone: 'America/New_York' },
  { pattern: /boston|foxborough|gillette/i, timezone: 'America/New_York' },
  { pattern: /new york|new jersey|east rutherford|metlife|harrison/i, timezone: 'America/New_York' },
  { pattern: /philadelphia|lincoln financial/i, timezone: 'America/New_York' },
  { pattern: /dallas|arlington|at&t|att stadium/i, timezone: 'America/Chicago' },
  { pattern: /houston|nrg/i, timezone: 'America/Chicago' },
  { pattern: /kansas city|arrowhead/i, timezone: 'America/Chicago' },
  { pattern: /monterrey|bbva.*monterrey/i, timezone: 'America/Monterrey' },
  { pattern: /guadalajara|akron/i, timezone: 'America/Mexico_City' },
  { pattern: /mexico city|ciudad de m[eé]xico|azteca|estadio azteca/i, timezone: 'America/Mexico_City' },
];

const COUNTRY_RULES = [
  { pattern: /^canada$/i, timezone: 'America/Toronto' },
  { pattern: /^mexico|méxico$/i, timezone: 'America/Mexico_City' },
  { pattern: /^usa|united states|estados unidos$/i, timezone: 'America/New_York' },
];

export function resolveStadiumTimezone(stadium = {}) {
  const haystack = [stadium.city, stadium.country, stadium.nameEn, stadium.nameFa]
    .filter(Boolean)
    .join(' ');

  if (!haystack.trim()) return null;

  for (const { pattern, timezone } of CITY_RULES) {
    if (pattern.test(haystack)) return timezone;
  }

  for (const { pattern, timezone } of COUNTRY_RULES) {
    if (pattern.test(String(stadium.country || '').trim())) return timezone;
  }

  return null;
}
