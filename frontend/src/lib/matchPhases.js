/** Secciones de partidos en Predicciones (orden del torneo). */

export const MATCH_PHASE_SECTIONS = [
  { key: 'group', label: 'Fase de grupos', order: 0 },
  { key: 'round_of_32', label: 'Dieciseisavos de final', order: 1 },
  { key: 'round_of_16', label: 'Octavos de final', order: 2 },
  { key: 'quarter_final', label: 'Cuartos de final', order: 3 },
  { key: 'semi_final', label: 'Semifinales', order: 4 },
  { key: 'third_place', label: 'Tercer puesto', order: 5 },
  { key: 'final', label: 'Final', order: 6 },
];

const KNOCKOUT_ID_RANGES = [
  { key: 'round_of_32', min: 73, max: 88 },
  { key: 'round_of_16', min: 89, max: 96 },
  { key: 'quarter_final', min: 97, max: 100 },
  { key: 'semi_final', min: 101, max: 102 },
  { key: 'third_place', min: 103, max: 103 },
  { key: 'final', min: 104, max: 104 },
];

export function resolveMatchPhaseKey(match) {
  if (match?.knockoutPhaseKey) return match.knockoutPhaseKey;
  if (match?.isKnockout && match?.knockoutPhase) {
    const byLabel = MATCH_PHASE_SECTIONS.find((s) => s.label === match.knockoutPhase);
    if (byLabel) return byLabel.key;
  }

  const id = Number(match?.externalId);
  if (Number.isFinite(id)) {
    const byRange = KNOCKOUT_ID_RANGES.find((r) => id >= r.min && id <= r.max);
    if (byRange) return byRange.key;
  }

  if (match?.group) return 'group';
  return 'group';
}

export function getMatchPhaseLabel(match) {
  const key = resolveMatchPhaseKey(match);
  return MATCH_PHASE_SECTIONS.find((s) => s.key === key)?.label ?? 'Fase de grupos';
}

export function groupMatchesByPhase(matches = []) {
  const buckets = new Map(MATCH_PHASE_SECTIONS.map((section) => [section.key, []]));

  for (const match of matches) {
    const key = resolveMatchPhaseKey(match);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(match);
  }

  return MATCH_PHASE_SECTIONS.map((section) => ({
    ...section,
    matches: buckets.get(section.key) ?? [],
  })).filter((section) => section.matches.length > 0);
}
