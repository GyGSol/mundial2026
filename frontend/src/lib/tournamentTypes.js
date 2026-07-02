export const TOURNAMENT_TYPE_COMMON = 'common';
export const TOURNAMENT_TYPE_CHALLENGE = 'challenge';
export const TOURNAMENT_TYPE_ELIMINATION = 'elimination';
export const TOURNAMENT_TYPE_FUBOLS_CUP = 'fubols_cup';

export const DEFAULT_TOURNAMENT_TYPE = TOURNAMENT_TYPE_COMMON;

export const TOURNAMENT_TYPES = [
  { id: TOURNAMENT_TYPE_COMMON, label: 'Torneo' },
  { id: TOURNAMENT_TYPE_CHALLENGE, label: 'Torneo desafío' },
  { id: TOURNAMENT_TYPE_ELIMINATION, label: 'Torneo Eliminación' },
  { id: TOURNAMENT_TYPE_FUBOLS_CUP, label: 'Copa Fubols' },
];

export const ENROLLABLE_TOURNAMENT_TYPES = [
  TOURNAMENT_TYPE_CHALLENGE,
  TOURNAMENT_TYPE_ELIMINATION,
];

const LABEL_BY_ID = Object.fromEntries(TOURNAMENT_TYPES.map((row) => [row.id, row.label]));

export function getTournamentLabel(tournamentType) {
  return LABEL_BY_ID[tournamentType] ?? tournamentType;
}

export function isEnrollableTournamentType(tournamentType) {
  return ENROLLABLE_TOURNAMENT_TYPES.includes(tournamentType);
}

export function isValidTournamentType(tournamentType) {
  return TOURNAMENT_TYPES.some((row) => row.id === tournamentType);
}
