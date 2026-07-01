const KNOCKOUT_PHASES = [
  { key: 'round_of_32', label: 'Dieciseisavos de final', minId: 73, maxId: 88 },
  { key: 'round_of_16', label: 'Octavos de final', minId: 89, maxId: 96 },
  { key: 'quarter_final', label: 'Cuartos de final', minId: 97, maxId: 100 },
  { key: 'semi_final', label: 'Semifinales', minId: 101, maxId: 102 },
  { key: 'third_place', label: 'Tercer puesto', minId: 103, maxId: 103 },
  { key: 'final', label: 'Final', minId: 104, maxId: 104 },
];

const TYPE_ALIASES = [
  { key: 'round_of_32', patterns: ['round_of_32', 'roundof32', 'r32', '32'] },
  { key: 'round_of_16', patterns: ['round_of_16', 'roundof16', 'r16', '16'] },
  { key: 'quarter_final', patterns: ['quarter_final', 'quarterfinal', 'quarter', 'qf'] },
  { key: 'semi_final', patterns: ['semi_final', 'semifinal', 'semi', 'sf'] },
  { key: 'third_place', patterns: ['third_place', 'thirdplace', 'third', '3rd'] },
  { key: 'final', patterns: ['final', 'f'] },
];

function normalizeType(type) {
  return String(type || 'group')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function resolveKnockoutPhaseFromType(type) {
  const key = normalizeType(type);
  if (key === 'group') return null;

  for (const alias of TYPE_ALIASES) {
    if (alias.patterns.some((pattern) => key.includes(pattern))) {
      return KNOCKOUT_PHASES.find((phase) => phase.key === alias.key) ?? null;
    }
  }
  return null;
}

export function resolveKnockoutPhaseFromExternalId(externalId) {
  const id = Number(externalId);
  if (!Number.isFinite(id)) return null;
  return KNOCKOUT_PHASES.find((phase) => id >= phase.minId && id <= phase.maxId) ?? null;
}

export function enrichMatchPhaseFields(match) {
  const fromId = resolveKnockoutPhaseFromExternalId(match.externalId);
  const fromType = resolveKnockoutPhaseFromType(match.type);
  const phase = fromId ?? fromType;

  if (!phase) {
    return {
      type: match.type || 'group',
      isKnockout: false,
      knockoutPhase: null,
      knockoutPhaseKey: null,
    };
  }

  return {
    type: phase.key,
    isKnockout: true,
    knockoutPhase: phase.label,
    knockoutPhaseKey: phase.key,
  };
}

export { KNOCKOUT_PHASES };
