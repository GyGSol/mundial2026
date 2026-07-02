export const TOURNAMENT_TYPE_COMMON = 'common';
export const TOURNAMENT_TYPE_CHALLENGE = 'challenge';
export const TOURNAMENT_TYPE_ELIMINATION = 'elimination';
export const TOURNAMENT_TYPE_FUBOLS_CUP = 'fubols_cup';

export const ENROLLABLE_TOURNAMENT_TYPES = [
  TOURNAMENT_TYPE_CHALLENGE,
  TOURNAMENT_TYPE_ELIMINATION,
];

export function isEnrollableTournamentType(tournamentType) {
  return ENROLLABLE_TOURNAMENT_TYPES.includes(tournamentType);
}
