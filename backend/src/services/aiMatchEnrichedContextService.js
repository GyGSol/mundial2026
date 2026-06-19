import { Player } from '../models/Player.js';
import { pickProbableStarters, LINE_ORDER } from './probableLineupService.js';
import {
  getIntelMapForExternalIds,
  mergePlayerWithIntel,
} from './aiPlayerIntelService.js';
import {
  buildCompactPerformanceContext,
  hydrateRosterPerformanceSnapshots,
} from './playerPerformanceContextService.js';
import {
  getNationProfile,
  buildTalentPoolIndex,
  isWorldCupDebut,
} from './nationFootballProfileService.js';
import { buildNationHistoricalSummary } from './worldCupHistoryService.js';

const MAX_ALERTS = 5;

const ELITE_LEAGUES = new Set([
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
  'Primeira Liga',
  'Eredivisie',
  'Saudi Pro League',
  'MLS',
  'Brasileirão',
  'Liga MX',
  'Liga Profesional',
]);

const STRONG_LEAGUES = new Set([
  'Championship',
  '2. Bundesliga',
  'Serie B',
  'La Liga 2',
  'Ligue 2',
  'Jupiler Pro League',
  'Scottish Premiership',
  'Süper Lig',
  'J1 League',
  'K League',
  'A-League',
  'Liga BetPlay',
  'Liga Pro',
  'Bundesliga (Austria)',
  'Super League',
]);

function playerLeagueName(player) {
  return player.leagueName || player.league || '';
}

function clubLeagueScore(leagueName) {
  const name = String(leagueName ?? '').trim();
  if (!name) return 1;
  if (ELITE_LEAGUES.has(name)) return 5;
  if (STRONG_LEAGUES.has(name)) return 3;
  if (/bundesliga|premier|liga|serie|ligue|eredivisie/i.test(name)) return 2;
  return 1;
}

function serializePlayerForPrompt(player, { includePerformance = false } = {}) {
  const base = {
    name: player.fullName,
    position: player.position,
    club: player.currentClub || null,
    league: player.leagueName || null,
    age: player.age ?? null,
    shirtNumber: player.shirtNumber ?? null,
    healthStatus: player.healthStatus,
    injuryInfo: player.injuryInfo || null,
    yellowCards: player.yellowCards ?? 0,
    redCards: player.redCards ?? 0,
    suspended: Boolean(player.suspended),
    suspensionInfo: player.suspensionInfo || null,
    isProbableStarter: Boolean(player._probableStarter),
    aiNote: player.aiSummary || player.notes || null,
  };
  if (includePerformance) {
    base.rendimiento = buildCompactPerformanceContext(player);
  }
  return base;
}

function availabilityStats(players) {
  if (!players.length) {
    return { availabilityRate: null, injuredCount: 0, doubtfulCount: 0, suspendedCount: 0 };
  }
  let available = 0;
  let injured = 0;
  let doubtful = 0;
  let suspended = 0;

  for (const p of players) {
    if (p.suspended) suspended += 1;
    if (p.healthStatus === 'injured') injured += 1;
    else if (p.healthStatus === 'doubt') doubtful += 1;
    else if (p.healthStatus === 'available') available += 1;
  }

  const availabilityRate = Number((available / players.length).toFixed(2));
  return { availabilityRate, injuredCount: injured, doubtfulCount: doubtful, suspendedCount: suspended };
}

export async function buildSquadSnapshot(teamExternalId, fifaCode, { enrichPerformance = false } = {}) {
  if (!teamExternalId) {
    return {
      probableStarters: [],
      injuries: [],
      doubtful: [],
      suspended: [],
      cardsRisk: [],
      availabilityRate: null,
      intelStale: true,
      squadSize: 0,
    };
  }

  const roster = await Player.find({ teamExternalId }).lean();
  const intelMap = await getIntelMapForExternalIds(roster.map((p) => p.externalId));

  const merged = roster.map((player) => {
    const intel = intelMap.get(player.externalId);
    const base = {
      fullName: player.fullName,
      position: player.position,
      currentClub: player.currentClub,
      leagueName: player.leagueName,
      age: player.age,
      shirtNumber: player.shirtNumber,
      lineupStatus: player.lineupStatus,
      healthStatus: player.healthStatus,
      injuryInfo: player.injuryInfo,
    };
    return mergePlayerWithIntel(base, intel);
  });

  const intelFreshCount = merged.filter((p) => !p.intelStale).length;
  const intelStale = roster.length > 0 && intelFreshCount === 0;

  const probableStarters = pickProbableStarters(merged);

  if (enrichPerformance && probableStarters.length) {
    await hydrateRosterPerformanceSnapshots(probableStarters, { maxFetches: 11 });
  }

  const starterIds = new Set(probableStarters.map((p) => p.fullName));

  const injuries = merged
    .filter((p) => p.healthStatus === 'injured')
    .slice(0, MAX_ALERTS)
    .map(serializePlayerForPrompt);

  const doubtful = merged
    .filter((p) => p.healthStatus === 'doubt')
    .slice(0, MAX_ALERTS)
    .map(serializePlayerForPrompt);

  const suspended = merged
    .filter((p) => p.suspended)
    .slice(0, MAX_ALERTS)
    .map(serializePlayerForPrompt);

  const cardsRisk = merged
    .filter(
      (p) =>
        !p.suspended &&
        ((p.yellowCards ?? 0) >= 1 || (p.redCards ?? 0) >= 1) &&
        starterIds.has(p.fullName)
    )
    .slice(0, MAX_ALERTS)
    .map(serializePlayerForPrompt);

  const stats = availabilityStats(merged);

  return {
    probableStarters: probableStarters.map((p) =>
      serializePlayerForPrompt(p, { includePerformance: enrichPerformance })
    ),
    injuries,
    doubtful,
    suspended,
    cardsRisk,
    ...stats,
    intelStale,
    squadSize: roster.length,
  };
}

function lineStrength(players) {
  if (!players.length) return 0;
  let score = 0;
  for (const p of players) {
    let playerScore = clubLeagueScore(playerLeagueName(p));
    if (p.healthStatus === 'injured') playerScore *= 0.2;
    else if (p.healthStatus === 'doubt') playerScore *= 0.6;
    if (p.suspended) playerScore *= 0.1;
    score += playerScore;
  }
  return score / players.length;
}

function pickLinePlayers(squad, position, count = 2) {
  return (squad.probableStarters ?? [])
    .filter((p) => p.position === position)
    .slice(0, count);
}

function edgeFromScores(homeScore, awayScore) {
  const diff = homeScore - awayScore;
  if (diff > 0.8) return 'home';
  if (diff < -0.8) return 'away';
  return 'even';
}

export function buildPositionMatchups(homeSquad, awaySquad) {
  return LINE_ORDER.map((position) => {
    const homePlayers = pickLinePlayers(homeSquad, position, position === 'GK' ? 1 : 2);
    const awayPlayers = pickLinePlayers(awaySquad, position, position === 'GK' ? 1 : 2);
    const homeScore = lineStrength(homePlayers);
    const awayScore = lineStrength(awayPlayers);
    const edge = edgeFromScores(homeScore, awayScore);

    const homeClubs = [...new Set(homePlayers.map((p) => p.club).filter(Boolean))];
    const awayClubs = [...new Set(awayPlayers.map((p) => p.club).filter(Boolean))];

    let fieldImpactNote = null;
    if (homePlayers.length && awayPlayers.length) {
      if (edge === 'home') {
        fieldImpactNote = `Ventaja ${position} local: jugadores en ligas de mayor nivel (${homeClubs.join(', ') || 'N/D'}).`;
      } else if (edge === 'away') {
        fieldImpactNote = `Ventaja ${position} visitante: jugadores en ligas de mayor nivel (${awayClubs.join(', ') || 'N/D'}).`;
      } else {
        fieldImpactNote = `Paridad en ${position}; duelo táctico entre ${homeClubs[0] || 'local'} y ${awayClubs[0] || 'visitante'}.`;
      }
    }

    return {
      position,
      home: homePlayers.map((p) => ({
        name: p.name ?? p.fullName,
        club: p.club ?? p.currentClub,
        league: playerLeagueName(p),
        healthStatus: p.healthStatus,
      })),
      away: awayPlayers.map((p) => ({
        name: p.name ?? p.fullName,
        club: p.club ?? p.currentClub,
        league: playerLeagueName(p),
        healthStatus: p.healthStatus,
      })),
      edge,
      fieldImpactNote,
    };
  });
}

function kickoffWeatherSnapshot(venue) {
  const kickoff = venue?.matchWeather?.kickoffForecast ?? venue?.weather?.kickoffForecast;
  if (!kickoff || kickoff.available === false) return null;
  if (kickoff.temperatureC == null || !Number.isFinite(Number(kickoff.temperatureC))) return null;
  return kickoff;
}

function venueClimateHint(venue) {
  const kickoff = kickoffWeatherSnapshot(venue);
  if (kickoff) {
    const temp = Number(kickoff.temperatureC);
    const humidity = Number(kickoff.humidityPct ?? 0);
    const rain = Number(kickoff.precipitationPct ?? 0);
    if (temp >= 30 && humidity >= 60) return 'tropical_caluroso';
    if (temp >= 26 && humidity >= 70) return 'tropical_caluroso';
    if (rain >= 50) return 'lluvioso';
    if (temp <= 12) return 'frio';
    return 'templado';
  }

  const city = String(venue?.stadium?.city ?? '').toLowerCase();
  const country = String(venue?.stadium?.country ?? '').toLowerCase();
  const hotHumid =
    /houston|miami|dallas|monterrey|guadalajara|mexico city|atlanta|kansas/i.test(city) ||
    country.includes('usa') ||
    country.includes('mexico');
  if (hotHumid) return 'tropical_caluroso';
  const altitude = /mexico city|bogota|quito/i.test(city);
  if (altitude) return 'altitud';
  return 'templado';
}

function teamClimateFit(profileClimate, venueClimate) {
  if (!profileClimate) return 'unknown';
  if (venueClimate === 'tropical_caluroso') {
    if (profileClimate === 'tropical' || profileClimate === 'subtropical') return 'familiar';
    if (profileClimate === 'templado' || profileClimate === 'mediterráneo') return 'desafiante';
    return 'neutro';
  }
  if (venueClimate === 'altitud') {
    if (profileClimate === 'tropical' || profileClimate === 'subtropical') return 'desafiante';
    return 'neutro';
  }
  return 'neutro';
}

export function buildMoraleFactors({
  teamAnalysis,
  profile,
  squad,
  venue,
  opponentRanking,
  ownRanking,
}) {
  const debut = isWorldCupDebut(profile);
  const kickoffWeather = kickoffWeatherSnapshot(venue);
  const venueClimate = venueClimateHint(venue);
  const venueClimateSource = kickoffWeather ? 'open-meteo-kickoff' : 'heuristic';
  const climateAdaptation = teamClimateFit(profile?.climateHome, venueClimate);

  const ownRank = Number(ownRanking?.rank);
  const oppRank = Number(opponentRanking?.rank);
  let favoriteOrUnderdog = 'even';
  if (Number.isFinite(ownRank) && Number.isFinite(oppRank)) {
    if (ownRank < oppRank - 15) favoriteOrUnderdog = 'favorite';
    else if (ownRank > oppRank + 15) favoriteOrUnderdog = 'underdog';
  }

  const form = teamAnalysis?.tournament2026?.form ?? '';
  const points = teamAnalysis?.groupStanding?.points;
  const played = teamAnalysis?.groupStanding?.played ?? 0;
  let tournamentMomentum = 'sin_partidos';
  if (played > 0) {
    if (form.includes('W') && !form.includes('L')) tournamentMomentum = 'alto';
    else if (form.includes('L') && !form.includes('W')) tournamentMomentum = 'bajo';
    else tournamentMomentum = points >= played * 2 ? 'positivo' : 'irregular';
  }

  const stress =
    (squad?.injuredCount ?? 0) + (squad?.doubtfulCount ?? 0) + (squad?.suspendedCount ?? 0);
  const squadStress = stress >= 4 ? 'alto' : stress >= 2 ? 'medio' : 'bajo';

  const parts = [];
  if (debut) parts.push('debut mundialista con motivación de underdog');
  if (favoriteOrUnderdog === 'favorite') parts.push('presión de favorito por ranking');
  if (favoriteOrUnderdog === 'underdog') parts.push('papel de outsider');
  if (tournamentMomentum === 'alto') parts.push('buen momentum en el torneo');
  if (tournamentMomentum === 'bajo') parts.push('moral resentida por resultados recientes');
  if (squadStress === 'alto') parts.push('plantel tocado por bajas y sanciones');

  return {
    isWorldCupDebut: debut,
    venueClimate,
    venueClimateSource,
    kickoffWeather: kickoffWeather
      ? {
          source: 'sede-y-clima',
          description: kickoffWeather.description,
          temperatureC: kickoffWeather.temperatureC,
          humidityPct: kickoffWeather.humidityPct,
          precipitationPct: kickoffWeather.precipitationPct,
          windKmh: kickoffWeather.windKmh,
          atLocal: kickoffWeather.atLocal ?? venue?.matchWeather?.kickoffAtLocal ?? null,
        }
      : null,
    climateAdaptation,
    favoriteOrUnderdog,
    tournamentMomentum,
    squadStress,
    moraleSummary: parts.length ? parts.join('; ') : 'estado anímico neutro según datos disponibles',
  };
}

async function buildNationSideContext(fifaCode, teamAnalysis, squad, venue, opponentTeam) {
  const [profile, historical] = await Promise.all([
    getNationProfile(fifaCode),
    buildNationHistoricalSummary(fifaCode),
  ]);

  const morale = buildMoraleFactors({
    teamAnalysis,
    profile,
    squad,
    venue,
    ownRanking: teamAnalysis?.fifaRanking,
    opponentRanking: opponentTeam?.fifaRanking,
  });

  return {
    profile: profile
      ? {
          name: profile.name,
          populationMillions: profile.populationMillions,
          domesticLeagueName: profile.domesticLeagueName,
          domesticLeagueTier: profile.domesticLeagueTier,
          domesticLeagueTierLabel: profile.domesticLeagueTierLabel,
          climateHome: profile.climateHome,
          worldCupAppearances: profile.worldCupAppearances,
          worldCupBestFinish: profile.worldCupBestFinish,
          wikiNote: profile.wikiNote,
        }
      : null,
    wikiRecords: historical.wikiRecords,
    finalHighlights: historical.finalHighlights,
    worldCupTitles: historical.worldCupTitles,
    talentPoolIndex: buildTalentPoolIndex(profile),
    morale,
  };
}

export async function buildEnrichedMatchContext({
  homeTeam,
  awayTeam,
  venue,
  teamsAnalysis,
  enrichPerformance = false,
}) {
  const [homeSquad, awaySquad] = await Promise.all([
    buildSquadSnapshot(homeTeam?.externalId, homeTeam?.fifaCode, { enrichPerformance }),
    buildSquadSnapshot(awayTeam?.externalId, awayTeam?.fifaCode, { enrichPerformance }),
  ]);

  const [homeNation, awayNation] = await Promise.all([
    buildNationSideContext(
      homeTeam?.fifaCode,
      teamsAnalysis?.home,
      homeSquad,
      venue,
      teamsAnalysis?.away
    ),
    buildNationSideContext(
      awayTeam?.fifaCode,
      teamsAnalysis?.away,
      awaySquad,
      venue,
      teamsAnalysis?.home
    ),
  ]);

  return {
    nationContext: {
      home: homeNation,
      away: awayNation,
    },
    squadAnalysis: {
      home: homeSquad,
      away: awaySquad,
    },
    positionMatchups: buildPositionMatchups(homeSquad, awaySquad),
  };
}
