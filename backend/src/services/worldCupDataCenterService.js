import { Team } from '../models/Team.js';
import { lookupFifaRankInTable } from '../data/teamFifaAliases.js';
import { getFifaWorldRankings } from './aiTeamMatchContextService.js';
import {
  buildNationHistoricalSummary,
  buildWorldCupHistoryOverview,
  getWorldCupHistory,
} from './worldCupHistoryService.js';
import { getNationProfile, buildTalentPoolIndex } from './nationFootballProfileService.js';

const FIFA_CODE_ALIASES = {
  GER: ['GER', 'FRG', 'DEU'],
  FRG: ['GER', 'FRG', 'DEU'],
};

const DEEP_RUN_TIERS = new Set(['champion', 'final', 'semifinal', 'quarter']);

export function isValidWikiRecord(row) {
  if (!row || typeof row !== 'object') return false;
  const year = Number(row.year);
  if (!Number.isFinite(year) || year < 1930 || year > 2022) return false;
  const round = String(row.round ?? '');
  if (/rowspan|colspan|''/i.test(round)) return false;
  if (/withdrew|did not enter|banned|disqualified|suspended/i.test(round)) return false;
  const played = Number(row.played);
  if (!Number.isFinite(played) || played <= 0) return false;
  return Boolean(row.round || row.position);
}

export function sanitizeWikiRecords(records = []) {
  return records.filter(isValidWikiRecord);
}

export function classifyFinishTier(row) {
  const round = String(row.round ?? '').toLowerCase();
  const pos = String(row.position ?? '').toLowerCase();

  if (round.includes('champion') || round.includes('winner') || /\b1st\b/.test(pos)) {
    return 'champion';
  }
  if (round.includes('runner') || /\b2nd\b/.test(pos) || round === 'final') {
    return 'final';
  }
  if (round.includes('third') || round.includes('fourth') || round.includes('semi') || /\b3rd\b|\b4th\b/.test(pos)) {
    return 'semifinal';
  }
  if (round.includes('quarter')) return 'quarter';
  if (round.includes('round of 16') || round.includes('last 16') || round.includes('round of sixteen')) {
    return 'round16';
  }
  if (round.includes('group')) return 'group';
  return 'other';
}

const FINISH_TIER_RANK = {
  champion: 1,
  final: 2,
  semifinal: 3,
  quarter: 4,
  round16: 5,
  group: 6,
  other: 7,
};

function recordsForNation(history, fifaCode) {
  const code = String(fifaCode ?? '').toUpperCase();
  return sanitizeWikiRecords(history.recordsByNation?.[code] ?? []);
}

function titlesForNation(fifaCode, history) {
  const codes = new Set(
    (FIFA_CODE_ALIASES[String(fifaCode ?? '').toUpperCase()] ?? [String(fifaCode ?? '').toUpperCase()])
  );
  let titles = 0;
  for (const row of history.titlesByNation ?? []) {
    if (codes.has(String(row.fifaCode ?? '').toUpperCase())) {
      titles += Number(row.titles ?? 0);
    }
  }
  return titles;
}

function finalsForNation(fifaCode, history) {
  const codes = new Set(
    (FIFA_CODE_ALIASES[String(fifaCode ?? '').toUpperCase()] ?? [String(fifaCode ?? '').toUpperCase()])
  );
  return (history.finals ?? []).filter(
    (row) =>
      codes.has(String(row.winnerFifa ?? '').toUpperCase()) ||
      codes.has(String(row.runnerUpFifa ?? '').toUpperCase())
  );
}

export function computePedigreeIndex({
  worldCupTitles = 0,
  finalsPlayed = 0,
  deepRunRate = 0,
  winRate = 0,
  fifaRank = null,
}) {
  const titleScore = Math.min(worldCupTitles * 12, 36);
  const finalScore = Math.min(finalsPlayed * 5, 20);
  const deepScore = Math.max(0, Math.min(deepRunRate, 1)) * 22;
  const winScore = Math.max(0, Math.min(winRate, 1)) * 15;
  const rankScore =
    fifaRank != null && fifaRank > 0
      ? Math.max(0, (51 - Math.min(fifaRank, 50)) / 50) * 7
      : 0;
  return Math.round(Math.min(100, titleScore + finalScore + deepScore + winScore + rankScore));
}

export function computeNationMetrics(fifaCode, history, { fifaRank = null, profile = null } = {}) {
  const code = String(fifaCode ?? '').toUpperCase();
  const wikiRecords = recordsForNation(history, code);
  const appearances = wikiRecords.length;

  let totalPlayed = 0;
  let totalWon = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let deepRuns = 0;
  const roundCounts = {
    champion: 0,
    final: 0,
    semifinal: 0,
    quarter: 0,
    round16: 0,
    group: 0,
    other: 0,
  };

  let bestFinishTier = 'other';
  let bestFinishRank = FINISH_TIER_RANK.other;

  for (const row of wikiRecords) {
    totalPlayed += Number(row.played ?? 0);
    totalWon += Number(row.won ?? 0);
    goalsFor += Number(row.goalsFor ?? 0);
    goalsAgainst += Number(row.goalsAgainst ?? 0);

    const tier = classifyFinishTier(row);
    roundCounts[tier] += 1;
    if (DEEP_RUN_TIERS.has(tier)) deepRuns += 1;

    const tierRank = FINISH_TIER_RANK[tier];
    if (tierRank < bestFinishRank) {
      bestFinishRank = tierRank;
      bestFinishTier = tier;
    }
  }

  const winRate = totalPlayed > 0 ? totalWon / totalPlayed : 0;
  const goalsPerGame = totalPlayed > 0 ? goalsFor / totalPlayed : 0;
  const goalsAgainstPerGame = totalPlayed > 0 ? goalsAgainst / totalPlayed : 0;
  const goalDiffPerGame = goalsPerGame - goalsAgainstPerGame;
  const deepRunRate = appearances > 0 ? deepRuns / appearances : 0;

  const worldCupTitles = titlesForNation(code, history);
  const finalsPlayed = finalsForNation(code, history).length;

  const recentForm = [...wikiRecords]
    .sort((a, b) => b.year - a.year)
    .slice(0, 4)
    .map((row) => ({
      year: row.year,
      tier: classifyFinishTier(row),
      round: row.round,
      position: row.position ?? null,
    }));

  const pedigreeIndex = computePedigreeIndex({
    worldCupTitles,
    finalsPlayed,
    deepRunRate,
    winRate,
    fifaRank,
  });

  const name = profile?.name ?? history.nationNames?.[code] ?? code;

  return {
    fifaCode: code,
    name,
    group: null,
    appearances,
    totalPlayed,
    winRate: Number(winRate.toFixed(3)),
    goalsPerGame: Number(goalsPerGame.toFixed(2)),
    goalsAgainstPerGame: Number(goalsAgainstPerGame.toFixed(2)),
    goalDiffPerGame: Number(goalDiffPerGame.toFixed(2)),
    bestFinishTier,
    deepRunRate: Number(deepRunRate.toFixed(3)),
    worldCupTitles,
    finalsPlayed,
    pedigreeIndex,
    fifaRank,
    domesticLeagueTier: profile?.domesticLeagueTier ?? null,
    populationMillions: profile?.populationMillions ?? null,
    talentPoolIndex: profile ? buildTalentPoolIndex(profile) : null,
    worldCupAppearancesProfile: profile?.worldCupAppearances ?? null,
    worldCupBestFinish: profile?.worldCupBestFinish ?? null,
    recentForm,
    roundCounts,
  };
}

function buildTournamentGoalsTimeline(history, nationCodes) {
  const byYear = new Map();

  for (const code of nationCodes) {
    for (const row of recordsForNation(history, code)) {
      const year = row.year;
      const entry = byYear.get(year) ?? { year, goals: 0, matches: 0 };
      entry.goals += Number(row.goalsFor ?? 0);
      entry.matches += Number(row.played ?? 0);
      byYear.set(year, entry);
    }
  }

  return [...byYear.values()]
    .sort((a, b) => a.year - b.year)
    .map((row) => ({
      year: row.year,
      goals: row.goals,
      avgGoalsPerMatch: row.matches > 0 ? Number((row.goals / row.matches).toFixed(2)) : 0,
    }));
}

function buildRoundDistribution(nationRankings) {
  const totals = {
    champion: 0,
    final: 0,
    semifinal: 0,
    quarter: 0,
    round16: 0,
    group: 0,
    other: 0,
  };

  for (const nation of nationRankings) {
    for (const [tier, count] of Object.entries(nation.roundCounts ?? {})) {
      if (tier in totals) totals[tier] += count;
    }
  }

  return Object.entries(totals).map(([tier, count]) => ({ tier, count }));
}

const TIER_LABELS = {
  champion: 'Campeón',
  final: 'Final',
  semifinal: 'Semifinal',
  quarter: 'Cuartos',
  round16: 'Octavos',
  group: 'Grupos',
  other: 'Otras',
};

export async function buildNationDataCenterDetail(fifaCode) {
  const code = String(fifaCode ?? '').toUpperCase();
  const [summary, profile, rankings] = await Promise.all([
    buildNationHistoricalSummary(code),
    getNationProfile(code),
    getFifaWorldRankings(),
  ]);

  const fifaRank = lookupFifaRankInTable(code, rankings.byCode);

  return {
    ...summary,
    profile,
    fifaRank,
    fifaRankAsOf: rankings.asOf,
    wikiRecords: sanitizeWikiRecords(summary.wikiRecords ?? []),
    tierLabels: TIER_LABELS,
  };
}

export async function buildWorldCupDataCenter({ nationCode = null } = {}) {
  const [teams, history, historyOverview, rankings] = await Promise.all([
    Team.find().lean(),
    getWorldCupHistory(),
    buildWorldCupHistoryOverview(),
    getFifaWorldRankings(),
  ]);

  const teamByCode = new Map(
    teams.map((t) => [String(t.fifaCode ?? '').toUpperCase(), t])
  );
  const nationCodes = [...teamByCode.keys()].filter(Boolean).sort();

  const nationRankings = await Promise.all(
    nationCodes.map(async (code) => {
      const profile = await getNationProfile(code);
      const fifaRank = lookupFifaRankInTable(code, rankings.byCode);
      const metrics = computeNationMetrics(code, history, { fifaRank, profile });
      const team = teamByCode.get(code);
      return {
        ...metrics,
        group: team?.group ?? null,
        flag: team?.flag ?? null,
      };
    })
  );

  nationRankings.sort(
    (a, b) => b.pedigreeIndex - a.pedigreeIndex || a.name.localeCompare(b.name)
  );

  const titlesAmongParticipants = (history.titlesByNation ?? [])
    .filter((row) => nationCodes.includes(String(row.fifaCode ?? '').toUpperCase()))
    .map((row) => ({
      fifaCode: row.fifaCode,
      name: row.name,
      titles: row.titles,
    }))
    .sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name));

  const payload = {
    source: history.source,
    syncedAt: history.syncedAt,
    recordsByNationSyncedAt: history.recordsByNationSyncedAt ?? null,
    fifaRankAsOf: rankings.asOf,
    nationCount: nationCodes.length,
    nationRankings,
    charts: {
      pedigreeBar: nationRankings.slice(0, 15).map((n) => ({
        fifaCode: n.fifaCode,
        name: n.name,
        pedigreeIndex: n.pedigreeIndex,
        fifaRank: n.fifaRank,
      })),
      scatterOffenseDefense: nationRankings.map((n) => ({
        fifaCode: n.fifaCode,
        name: n.name,
        goalsPerGame: n.goalsPerGame,
        goalsAgainstPerGame: n.goalsAgainstPerGame,
        pedigreeIndex: n.pedigreeIndex,
      })),
      titlesBar: titlesAmongParticipants,
      fifaVsPedigree: nationRankings
        .filter((n) => n.fifaRank != null)
        .map((n) => ({
          fifaCode: n.fifaCode,
          name: n.name,
          fifaRank: n.fifaRank,
          pedigreeIndex: n.pedigreeIndex,
        })),
      tournamentGoalsTimeline: buildTournamentGoalsTimeline(history, nationCodes),
      roundDistribution: buildRoundDistribution(nationRankings),
    },
    tierLabels: TIER_LABELS,
    history: {
      titlesByNation: titlesAmongParticipants,
      allTimeTopScorers: historyOverview.allTimeTopScorers ?? [],
      topScorersByTournament: historyOverview.topScorersByTournament ?? [],
      finals: historyOverview.finals ?? [],
      squadLegends: historyOverview.squadLegends ?? [],
      tournament2026PlayerStats: historyOverview.tournament2026PlayerStats ?? {},
    },
  };

  if (nationCode) {
    const code = String(nationCode).toUpperCase();
    if (nationCodes.includes(code)) {
      payload.nationDetail = await buildNationDataCenterDetail(code);
    }
  }

  return payload;
}

const CACHE_TTL_MS = 5 * 60_000;
let cachedPayload = null;
let cachedExpiresAt = 0;
let cachedPromise = null;

export function clearWorldCupDataCenterCache() {
  cachedPayload = null;
  cachedExpiresAt = 0;
  cachedPromise = null;
}

export async function getCachedWorldCupDataCenter(options = {}) {
  const now = Date.now();
  const nationKey = options.nationCode ? String(options.nationCode).toUpperCase() : '';

  if (!nationKey && cachedPayload && cachedExpiresAt > now) {
    return cachedPayload;
  }

  if (!nationKey && cachedPromise) {
    return cachedPromise;
  }

  if (nationKey) {
    return buildWorldCupDataCenter(options);
  }

  cachedPromise = buildWorldCupDataCenter()
    .then((value) => {
      cachedPayload = value;
      cachedExpiresAt = Date.now() + CACHE_TTL_MS;
      cachedPromise = null;
      return value;
    })
    .catch((err) => {
      cachedPromise = null;
      throw err;
    });

  return cachedPromise;
}
