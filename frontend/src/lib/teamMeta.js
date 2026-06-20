/** Copas del Mundo ganadas por código FIFA (hasta 2022). FRG + GER = Alemania. */
import fifaRankingsData from '../data/fifaWorldRankings2026.json';
import { lookupFifaRankInTable } from './fifaCodeAliases.js';
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

/** Código FIFA (3 letras) → ISO 3166-1 alpha-2 para flagcdn.com */
export const FIFA_TO_FLAG_ISO = {
  ARG: 'ar',
  AUS: 'au',
  AUT: 'at',
  BEL: 'be',
  BRA: 'br',
  BUL: 'bg',
  CAN: 'ca',
  CHI: 'cl',
  CIV: 'ci',
  CMR: 'cm',
  COL: 'co',
  CRC: 'cr',
  CRO: 'hr',
  CZE: 'cz',
  DEN: 'dk',
  ECU: 'ec',
  EGY: 'eg',
  ENG: 'gb-eng',
  ESP: 'es',
  FRA: 'fr',
  FRG: 'de',
  GER: 'de',
  GHA: 'gh',
  HAI: 'ht',
  HTI: 'ht',
  CPV: 'cv',
  CUW: 'cw',
  GRE: 'gr',
  HUN: 'hu',
  IRN: 'ir',
  ISL: 'is',
  ITA: 'it',
  JPN: 'jp',
  KOR: 'kr',
  KSA: 'sa',
  MAR: 'ma',
  MEX: 'mx',
  NED: 'nl',
  NGA: 'ng',
  NIR: 'gb-nir',
  NOR: 'no',
  PAN: 'pa',
  PAR: 'py',
  PER: 'pe',
  POL: 'pl',
  POR: 'pt',
  QAT: 'qa',
  ROU: 'ro',
  RSA: 'za',
  RUS: 'ru',
  SCO: 'gb-sct',
  SEN: 'sn',
  SRB: 'rs',
  SUI: 'ch',
  SVK: 'sk',
  SWE: 'se',
  TCH: 'cz',
  TUN: 'tn',
  TUR: 'tr',
  URU: 'uy',
  USA: 'us',
  URS: 'ru',
  WAL: 'gb-wls',
  YUG: 'rs',
};

export function getWorldCupTitles(fifaCode) {
  if (!fifaCode) return 0;
  const code = fifaCode.toUpperCase();
  if (code === 'FRG') return WORLD_CUP_TITLES.GER ?? 0;
  return WORLD_CUP_TITLES[code] ?? 0;
}

export function fifaCodeToFlagIso(fifaCode) {
  if (!fifaCode) return null;
  const code = fifaCode.toUpperCase();
  return FIFA_TO_FLAG_ISO[code] ?? null;
}

export function getFifaRankingForTeam(teamOrCode) {
  if (teamOrCode && typeof teamOrCode === 'object') {
    if (teamOrCode.fifaRanking?.rank != null) return teamOrCode.fifaRanking;
    return getFifaRankingForTeam(teamOrCode.fifaCode);
  }
  const code = String(teamOrCode ?? '').toUpperCase();
  if (!code) return null;
  const rank = lookupFifaRankInTable(code, fifaRankingsData.rankings ?? {});
  if (rank == null) return null;
  return { rank, asOf: fifaRankingsData.asOf ?? null };
}

export function getTeamFlag(team) {
  if (!team) return null;
  if (team.flag?.startsWith('http')) return team.flag;
  if (team.fifaCode) {
    const iso = fifaCodeToFlagIso(team.fifaCode);
    if (!iso) return null;
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
