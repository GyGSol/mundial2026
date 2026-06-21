import { fetchLiveMatchFootball } from './fifaApiClient.js';
import { MIN_CONFIRMED_STARTERS_PER_TEAM } from './aiLineupContextService.js';

function localizedFifaText(list, field = 'Description') {
  if (!Array.isArray(list)) return '';
  return list.find((item) => item.Locale === 'en-GB')?.[field] ?? list[0]?.[field] ?? '';
}

function localizedPlayerName(player) {
  return (
    localizedFifaText(player?.PlayerName) ||
    localizedFifaText(player?.ShortName) ||
    ''
  );
}

/** FIFA live Position: 0=GK, 1=DEF, 2=MID, 3=FWD */
export function mapFifaPositionCode(code) {
  const value = Number(code);
  if (value === 0) return 'GK';
  if (value === 1) return 'DEF';
  if (value === 3) return 'FWD';
  return 'MID';
}

export function buildLineupSideFromFifaTeam(fifaTeam) {
  if (!fifaTeam) return null;

  const starters = (fifaTeam.Players ?? []).filter((player) => Number(player?.Status) === 1);
  if (starters.length < MIN_CONFIRMED_STARTERS_PER_TEAM) return null;

  const formation = String(fifaTeam.Tactics ?? '').trim() || null;
  const coachName = localizedFifaText(fifaTeam.Coaches?.[0]?.Name);

  const players = starters
    .map((player) => {
      const mapped = mapFifaPositionCode(player.Position);
      const lineupX = player.LineupX;
      const lineupY = player.LineupY;
      const hasCoords =
        lineupX != null &&
        lineupY != null &&
        Number.isFinite(Number(lineupX)) &&
        Number.isFinite(Number(lineupY));

      return {
        playerId: player.IdPlayer ? `fifa-${player.IdPlayer}` : null,
        fifaPlayerId: player.IdPlayer ? String(player.IdPlayer) : null,
        name: localizedPlayerName(player),
        shirtNumber: player.ShirtNumber != null ? Number(player.ShirtNumber) : null,
        position: mapped,
        positionDetail: mapped,
        isStarter: true,
        ...(hasCoords
          ? {
              positionX: Number(lineupY),
              positionY: Number(lineupX),
            }
          : {}),
      };
    })
    .sort((a, b) => (Number(a.shirtNumber) || 99) - (Number(b.shirtNumber) || 99));

  return {
    formation,
    coach: coachName || null,
    players,
  };
}

export function buildFifaLineupSides(liveJson) {
  return {
    home: buildLineupSideFromFifaTeam(liveJson?.HomeTeam),
    away: buildLineupSideFromFifaTeam(liveJson?.AwayTeam),
  };
}

export async function fetchFifaLiveMatchLineup(match) {
  const meta = match?.raw?.fifaMeta;
  if (!meta?.idMatch || !meta?.idStage) return null;

  try {
    const live = await fetchLiveMatchFootball({
      idStage: meta.idStage,
      idMatch: meta.idMatch,
    });
    return buildFifaLineupSides(live);
  } catch (err) {
    console.warn(`FIFA live lineup skip match ${match.externalId}:`, err.message);
    return null;
  }
}
