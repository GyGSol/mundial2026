import { THIRD_PLACE_COMBINATIONS } from '../data/thirdPlaceCombinations.js';
import { buildWinnerMatchSlotDisplay, formatKnockoutSlotLabelEs, formatMatchSummary } from './worldCupStatsService.js';
import { KNOCKOUT_ROUNDS } from './simulationTournamentService.js';
import { hasUserPrediction } from './predictionLockService.js';
import { rankBestThirdPlaceTeams } from './thirdPlaceRanking.js';

/** Partidos R32 donde un 3.º clasificado enfrenta al ganador del grupo indicado. */
const THIRD_PLACE_MATCH_WINNER_SLOTS = {
  74: '1E',
  77: '1I',
  79: '1A',
  80: '1L',
  81: '1D',
  82: '1G',
  85: '1B',
  87: '1K',
};

const PROGRESS_ROUND_KEYS = {
  round_of_32: 'roundOf32',
  round_of_16: 'roundOf16',
  quarter_final: 'quarterFinal',
  semi_final: 'semiFinal',
  third_place: 'thirdPlace',
  final: 'final',
};

function normalizePhaseKey(type) {
  return String(type || 'group')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

const KNOCKOUT_TYPE_ALIASES = [
  { type: 'round_of_32', keys: ['round_of_32', 'roundof32', 'r32', '32'] },
  { type: 'round_of_16', keys: ['round_of_16', 'roundof16', 'r16', '16'] },
  { type: 'quarter_final', keys: ['quarter_final', 'quarterfinal', 'quarter', 'qf'] },
  { type: 'semi_final', keys: ['semi_final', 'semifinal', 'semi', 'sf'] },
  { type: 'third_place', keys: ['third_place', 'thirdplace', 'third', '3rd'] },
  { type: 'final', keys: ['final', 'f'] },
];

function resolveKnockoutPhase(type) {
  const key = normalizePhaseKey(type);
  if (key === 'group') return null;

  const alias = KNOCKOUT_TYPE_ALIASES.find((entry) =>
    entry.keys.some((candidate) => key.includes(candidate))
  );
  if (!alias) return null;

  return KNOCKOUT_ROUNDS.find((round) => round.type === alias.type) ?? null;
}

function isOfficialKnockoutMatch(match) {
  const id = String(match.externalId || '');
  return /^\d+$/.test(id) && Number(id) >= 73 && Number(id) <= 104;
}

function getAssignedTeam(match, side, teamMap) {
  const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
  if (!teamId || teamId === '0') return null;
  const team = teamMap[teamId];
  return team ? formatTeamRef(team) : null;
}

function extractRawTeamSlotLabel(match, side) {
  const raw = match.raw ?? {};
  const snakeKey = side === 'home' ? 'home_team_label' : 'away_team_label';
  const camelKey = side === 'home' ? 'homeTeamLabel' : 'awayTeamLabel';
  return String(raw[snakeKey] ?? raw[camelKey] ?? '').trim() || null;
}

function formatTeamRef(team) {
  if (!team) return null;
  return {
    externalId: team.externalId,
    nameEn: team.nameEn,
    fifaCode: team.fifaCode,
    flag: team.flag,
  };
}

function buildStandingsByGroup(groupStandings) {
  const byGroup = new Map();
  for (const groupTable of groupStandings) {
    byGroup.set(String(groupTable.group).toUpperCase(), groupTable.standings);
  }
  return byGroup;
}

function getTeamFromStandingRow(row, teamMap) {
  if (!row?.teamId) return null;
  const team = teamMap[row.teamId];
  if (!team) {
    return formatTeamRef({
      externalId: row.teamId,
      nameEn: row.nameEn,
      fifaCode: row.fifaCode,
      flag: row.flag,
    });
  }
  return formatTeamRef(team);
}

function getQualifiedThirdPlaceContext(groupStandings) {
  const { qualified, combinationKey } = rankBestThirdPlaceTeams(groupStandings);
  if (!combinationKey) {
    return { combinationKey: null, thirdByGroup: new Map() };
  }
  const thirdByGroup = new Map(qualified.map((row) => [row.group, row]));
  return { combinationKey, thirdByGroup };
}

function resolveThirdPlaceGroupForMatch(externalId, combinationKey) {
  const winnerSlot = THIRD_PLACE_MATCH_WINNER_SLOTS[Number(externalId)];
  if (!winnerSlot || !combinationKey) return null;

  const mapping = THIRD_PLACE_COMBINATIONS[combinationKey];
  if (!mapping) return null;

  const thirdSlot = mapping[winnerSlot];
  if (!thirdSlot) return null;

  return thirdSlot.replace(/^3/, '');
}

function isThirdPlaceLabel(label) {
  return /^3rd Group /i.test(label) || /^Best 3rd place Group /i.test(label);
}

function resolveSlotLabel({
  label,
  matchExternalId,
  standingsByGroup,
  teamMap,
  combinationKey,
  thirdByGroup,
  matchWinners,
  matchLosers,
  resolvedMatchSides,
}) {
  if (!label) return { team: null, slotLabel: null, slotSourceMatch: null };

  let match = label.match(/^Winner Group ([A-L])$/i);
  if (match) {
    const row = standingsByGroup.get(match[1].toUpperCase())?.[0];
    const team = getTeamFromStandingRow(row, teamMap);
    return { team, slotLabel: team ? null : formatKnockoutSlotLabelEs(label), slotSourceMatch: null };
  }

  match = label.match(/^(?:Runner-up|2nd position) Group ([A-L])$/i);
  if (match) {
    const row = standingsByGroup.get(match[1].toUpperCase())?.[1];
    const team = getTeamFromStandingRow(row, teamMap);
    return { team, slotLabel: team ? null : formatKnockoutSlotLabelEs(label), slotSourceMatch: null };
  }

  if (isThirdPlaceLabel(label)) {
    const thirdGroup = resolveThirdPlaceGroupForMatch(matchExternalId, combinationKey);
    if (thirdGroup) {
      const row = thirdByGroup.get(thirdGroup) || standingsByGroup.get(thirdGroup)?.[2];
      const team = getTeamFromStandingRow(row, teamMap);
      if (team) return { team, slotLabel: null, slotSourceMatch: null };
    }
    return { team: null, slotLabel: formatKnockoutSlotLabelEs(label), slotSourceMatch: null };
  }

  match = label.match(/^Winner Match (\d+)$/i);
  if (match) {
    const winner = matchWinners.get(match[1]);
    if (winner) return { team: winner, slotLabel: null, slotSourceMatch: null };
    const sourceSides = resolvedMatchSides?.get(match[1]);
    if (sourceSides) {
      const display = buildWinnerMatchSlotDisplay(sourceSides);
      return { team: null, slotLabel: display.slotLabel, slotSourceMatch: display.slotSourceMatch };
    }
    return { team: null, slotLabel: formatKnockoutSlotLabelEs(label), slotSourceMatch: null };
  }

  match = label.match(/^Loser Match (\d+)$/i);
  if (match) {
    const loser = matchLosers.get(match[1]);
    if (loser) return { team: loser, slotLabel: null, slotSourceMatch: null };
    return { team: null, slotLabel: formatKnockoutSlotLabelEs(label), slotSourceMatch: null };
  }

  return { team: null, slotLabel: formatKnockoutSlotLabelEs(label) || label, slotSourceMatch: null };
}

function getSimulatedOutcome(match, prediction, teamMap) {
  let homeGoals;
  let awayGoals;

  if (match.status === 'finished') {
    homeGoals = match.homeScore;
    awayGoals = match.awayScore;
  } else if (hasUserPrediction(prediction)) {
    homeGoals = prediction.homeGoals;
    awayGoals = prediction.awayGoals;
  } else {
    return { winner: null, loser: null };
  }

  if (homeGoals === awayGoals) {
    return { winner: null, loser: null };
  }

  const winnerId = homeGoals > awayGoals ? match.homeTeamId : match.awayTeamId;
  const loserId = homeGoals > awayGoals ? match.awayTeamId : match.homeTeamId;
  const winnerTeam = teamMap[winnerId];
  const loserTeam = teamMap[loserId];

  return {
    winner: winnerTeam ? formatTeamRef(winnerTeam) : null,
    loser: loserTeam ? formatTeamRef(loserTeam) : null,
  };
}

function sortKnockoutMatches(matches) {
  return [...matches].sort((a, b) => {
    const phaseA = resolveKnockoutPhase(a.type);
    const phaseB = resolveKnockoutPhase(b.type);
    const orderA = phaseA?.order ?? 99;
    const orderB = phaseB?.order ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return Number(a.externalId) - Number(b.externalId);
  });
}

function buildPredictedMatchSummary({
  match,
  homeTeam,
  awayTeam,
  homeTeamSlotLabel,
  awayTeamSlotLabel,
  homeTeamSlotSourceMatch,
  awayTeamSlotSourceMatch,
  teamMap,
  stadiumMap,
}) {
  const base = formatMatchSummary(
    {
      ...match,
      homeTeamId: homeTeam?.externalId || match.homeTeamId,
      awayTeamId: awayTeam?.externalId || match.awayTeamId,
    },
    teamMap,
    stadiumMap
  );

  return {
    ...base,
    homeTeam,
    awayTeam,
    homeTeamSlotLabel: homeTeam ? null : homeTeamSlotLabel,
    awayTeamSlotLabel: awayTeam ? null : awayTeamSlotLabel,
    homeTeamSlotSourceMatch: homeTeam ? null : homeTeamSlotSourceMatch,
    awayTeamSlotSourceMatch: awayTeam ? null : awayTeamSlotSourceMatch,
    status: match.status === 'finished' ? 'finished' : 'upcoming',
  };
}

function initProgress() {
  return {
    roundOf32: { resolved: 0, total: 16 },
    roundOf16: { resolved: 0, total: 8 },
    quarterFinal: { resolved: 0, total: 4 },
    semiFinal: { resolved: 0, total: 2 },
    thirdPlace: { resolved: 0, total: 1 },
    final: { resolved: 0, total: 1 },
  };
}

function countResolvedSide(team, slotLabel) {
  return team ? 1 : 0;
}

export function buildPredictedKnockoutPhases({
  groupStandings,
  knockoutMatches,
  predictionsByMatchId,
  teamMap,
  stadiumMap = {},
}) {
  const officialMatches = knockoutMatches.filter(isOfficialKnockoutMatch);
  if (!officialMatches.length) {
    return { phases: [], progress: initProgress(), thirdPlaceCombinationKey: null };
  }

  const standingsByGroup = buildStandingsByGroup(groupStandings);
  const { combinationKey, thirdByGroup } = getQualifiedThirdPlaceContext(groupStandings);
  const matchWinners = new Map();
  const matchLosers = new Map();
  const resolvedMatchSides = new Map();
  const progress = initProgress();
  const buckets = new Map();

  for (const match of sortKnockoutMatches(officialMatches)) {
    const phase = resolveKnockoutPhase(match.type);
    if (!phase) continue;

    const matchKey = match._id?.toString() ?? match.id;
    const prediction = predictionsByMatchId.get(matchKey);

    const homeLabel = extractRawTeamSlotLabel(match, 'home');
    const awayLabel = extractRawTeamSlotLabel(match, 'away');

    const assignedHome = getAssignedTeam(match, 'home', teamMap);
    const assignedAway = getAssignedTeam(match, 'away', teamMap);

    const homeResolved = assignedHome
      ? { team: assignedHome, slotLabel: null, slotSourceMatch: null }
      : resolveSlotLabel({
      label: homeLabel,
      matchExternalId: match.externalId,
      standingsByGroup,
      teamMap,
      combinationKey,
      thirdByGroup,
      matchWinners,
      matchLosers,
      resolvedMatchSides,
        });

    const awayResolved = assignedAway
      ? { team: assignedAway, slotLabel: null, slotSourceMatch: null }
      : resolveSlotLabel({
      label: awayLabel,
      matchExternalId: match.externalId,
      standingsByGroup,
      teamMap,
      combinationKey,
      thirdByGroup,
      matchWinners,
      matchLosers,
      resolvedMatchSides,
        });

    const summary = buildPredictedMatchSummary({
      match,
      homeTeam: homeResolved.team,
      awayTeam: awayResolved.team,
      homeTeamSlotLabel: homeResolved.slotLabel,
      awayTeamSlotLabel: awayResolved.slotLabel,
      homeTeamSlotSourceMatch: homeResolved.slotSourceMatch,
      awayTeamSlotSourceMatch: awayResolved.slotSourceMatch,
      teamMap,
      stadiumMap,
    });

    const progressKey = PROGRESS_ROUND_KEYS[phase.type];
    if (progressKey && progress[progressKey]) {
      progress[progressKey].resolved +=
        countResolvedSide(homeResolved.team, homeResolved.slotLabel) +
        countResolvedSide(awayResolved.team, awayResolved.slotLabel);
    }

    if (!buckets.has(phase.order)) {
      buckets.set(phase.order, {
        key: phase.type,
        label: phase.label,
        order: phase.order,
        matches: [],
      });
    }
    buckets.get(phase.order).matches.push(summary);

    resolvedMatchSides.set(String(match.externalId), {
      homeTeam: homeResolved.team,
      awayTeam: awayResolved.team,
      homeTeamSlotLabel: homeResolved.slotLabel,
      awayTeamSlotLabel: awayResolved.slotLabel,
    });

    const outcome = getSimulatedOutcome(
      {
        ...match,
        homeTeamId: homeResolved.team?.externalId || match.homeTeamId,
        awayTeamId: awayResolved.team?.externalId || match.awayTeamId,
      },
      prediction,
      teamMap
    );

    if (outcome.winner) {
      matchWinners.set(String(match.externalId), outcome.winner);
    }
    if (outcome.loser) {
      matchLosers.set(String(match.externalId), outcome.loser);
    }
  }

  const phases = [...buckets.values()]
    .sort((a, b) => a.order - b.order)
    .map((phase) => ({
      ...phase,
      matches: phase.matches.sort(
        (a, b) => Number(a.externalId) - Number(b.externalId)
      ),
    }));

  return {
    phases,
    progress,
    thirdPlaceCombinationKey: combinationKey,
  };
}
