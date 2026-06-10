/**
 * Fotos locales en /public/stadiums/{slug}.jpg (miniaturas Wikimedia Commons).
 * externalId según worldcup26.ir.
 */
export const STADIUM_ICON_META = {
  '1': { slug: 'azteca', short: 'CDMX', label: 'Estadio Azteca' },
  '2': { slug: 'akron', short: 'GDL', label: 'Estadio Akron' },
  '3': { slug: 'bbva', short: 'MTY', label: 'Estadio BBVA' },
  '4': { slug: 'att', short: 'DAL', label: 'AT&T Stadium' },
  '5': { slug: 'nrg', short: 'HOU', label: 'NRG Stadium' },
  '6': { slug: 'arrowhead', short: 'KC', label: 'Arrowhead Stadium' },
  '7': { slug: 'mercedes-benz', short: 'ATL', label: 'Mercedes-Benz Stadium' },
  '8': { slug: 'hard-rock', short: 'MIA', label: 'Hard Rock Stadium' },
  '9': { slug: 'gillette', short: 'BOS', label: 'Gillette Stadium' },
  '10': { slug: 'lincoln-financial', short: 'PHI', label: 'Lincoln Financial Field' },
  '11': { slug: 'metlife', short: 'NY/NJ', label: 'MetLife Stadium' },
  '12': { slug: 'bmo', short: 'TOR', label: 'BMO Field' },
  '13': { slug: 'bc-place', short: 'VAN', label: 'BC Place' },
  '14': { slug: 'lumen', short: 'SEA', label: 'Lumen Field' },
  '15': { slug: 'levis', short: 'SF', label: "Levi's Stadium" },
  '16': { slug: 'sofi', short: 'LA', label: 'SoFi Stadium' },
};

const NAME_PATTERNS = Object.entries(STADIUM_ICON_META).flatMap(([id, meta]) => [
  { id, pattern: new RegExp(meta.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
  { id, pattern: new RegExp(meta.slug.replace(/-/g, '[\\s-]?'), 'i') },
]);

const EXTRA_NAME_RULES = [
  { id: '1', pattern: /azteca|mexico city stadium|ciudad de m[eé]xico/i },
  { id: '2', pattern: /akron|guadalajara stadium/i },
  { id: '3', pattern: /bbva|monterrey stadium/i },
  { id: '4', pattern: /at&t|dallas stadium|cowboys/i },
  { id: '5', pattern: /nrg|houston stadium/i },
  { id: '6', pattern: /arrowhead|kansas city stadium|geha/i },
  { id: '7', pattern: /mercedes|atlanta stadium/i },
  { id: '8', pattern: /hard rock|miami stadium/i },
  { id: '9', pattern: /gillette|boston stadium|foxborough/i },
  { id: '10', pattern: /lincoln financial|philadelphia stadium/i },
  { id: '11', pattern: /metlife|new york.*jersey|east rutherford/i },
  { id: '12', pattern: /bmo field|toronto stadium/i },
  { id: '13', pattern: /bc place|vancouver/i },
  { id: '14', pattern: /lumen|seattle stadium/i },
  { id: '15', pattern: /levi|san francisco bay|santa clara/i },
  { id: '16', pattern: /sofi|los angeles stadium|inglewood/i },
];

function resolveStadiumExternalId(stadium) {
  if (!stadium) return null;
  const direct = String(stadium.externalId || '').trim();
  if (direct && STADIUM_ICON_META[direct]) return direct;

  const haystack = [stadium.nameEn, stadium.nameFa, stadium.city, stadium.country]
    .filter(Boolean)
    .join(' ');

  for (const { id, pattern } of EXTRA_NAME_RULES) {
    if (pattern.test(haystack)) return id;
  }
  for (const { id, pattern } of NAME_PATTERNS) {
    if (pattern.test(haystack)) return id;
  }
  return null;
}

export function getStadiumIconMeta(stadium) {
  const externalId = resolveStadiumExternalId(stadium);
  if (!externalId) return null;
  return { externalId, ...STADIUM_ICON_META[externalId] };
}

export function getStadiumIconUrl(stadium) {
  const meta = getStadiumIconMeta(stadium);
  if (!meta) return null;
  return `/stadiums/${meta.slug}.jpg`;
}

export function formatStadiumLine(stadium) {
  if (!stadium) return null;
  const parts = [stadium.nameEn, stadium.city].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function formatStadiumCapacity(capacity) {
  if (!capacity || capacity <= 0) return null;
  return capacity.toLocaleString('es-AR');
}

export function formatStadiumTimezone(timezone) {
  if (!timezone) return null;
  try {
    const label = new Intl.DateTimeFormat('es-AR', {
      timeZone: timezone,
      timeZoneName: 'longGeneric',
    })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;
    return label ? `${label} (${timezone})` : timezone;
  } catch {
    return timezone;
  }
}

/** Filas para el popup: solo campos con valor. */
export function getStadiumDetailRows(stadium) {
  if (!stadium) return [];

  const rows = [
    { label: 'Nombre FIFA', value: stadium.fifaName },
    { label: 'Nombre (FA)', value: stadium.nameFa },
    { label: 'Ciudad', value: stadium.city },
    { label: 'País', value: stadium.country },
    {
      label: 'Capacidad',
      value: formatStadiumCapacity(stadium.capacity)
        ? `${formatStadiumCapacity(stadium.capacity)} espectadores`
        : null,
    },
    { label: 'Zona horaria', value: formatStadiumTimezone(stadium.timezone) },
    { label: 'ID sede', value: stadium.externalId },
  ];

  return rows.filter((row) => row.value);
}
