/** Copas del Mundo ganadas por código FIFA (hasta 2022). */
export const WORLD_CUP_TITLES = {
  BRA: 5,
  GER: 4,
  ITA: 4,
  ARG: 3,
  FRA: 2,
  URU: 2,
  ENG: 1,
  ESP: 1,
};

export function getWorldCupTitles(fifaCode) {
  if (!fifaCode) return 0;
  return WORLD_CUP_TITLES[fifaCode.toUpperCase()] ?? 0;
}

export function getTeamFlag(team) {
  if (!team) return null;
  if (team.flag?.startsWith('http')) return team.flag;
  if (team.fifaCode) {
    const isoMap = { ARG: 'ar', BRA: 'br', MEX: 'mx', USA: 'us', ENG: 'gb-eng' };
    const iso = isoMap[team.fifaCode] || team.fifaCode.slice(0, 2).toLowerCase();
    return `https://flagcdn.com/w80/${iso}.png`;
  }
  return null;
}

export function isArgentinaTeam(team) {
  return team?.fifaCode === 'ARG' || team?.nameEn?.toLowerCase() === 'argentina';
}

export function matchInvolvesArgentina(match) {
  return isArgentinaTeam(match.homeTeam) || isArgentinaTeam(match.awayTeam);
}
