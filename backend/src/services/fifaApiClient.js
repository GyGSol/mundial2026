import { env } from '../config/env.js';

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en-GB',
};

async function fifaRequest(path, { searchParams } = {}) {
  const base = env.fifaApiUrl.replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`FIFA API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

function localizedText(entry, field = 'Description') {
  const list = entry?.[field] ?? entry;
  if (Array.isArray(list)) {
    return list.find((item) => item.Locale === 'en-GB')?.Description ?? list[0]?.Description ?? '';
  }
  return String(list ?? '');
}

export function extractTeamAbbreviation(teamSide) {
  return (
    teamSide?.Abbreviation ??
    teamSide?.IdCountry ??
    localizedText(teamSide?.TeamName) ??
    ''
  );
}

export async function fetchAllCalendarMatches() {
  const matches = [];
  let continuationToken = null;

  do {
    const params = {
      idSeason: env.fifaSeasonId,
      idCompetition: env.fifaCompetitionId,
      count: 200,
    };
    if (continuationToken) params.continuationToken = continuationToken;

    const data = await fifaRequest('/calendar/matches', { searchParams: params });
    matches.push(...(data?.Results ?? []));
    continuationToken = data?.ContinuationToken ?? null;
  } while (continuationToken);

  return matches;
}

export function findCalendarMatch(calendar, { matchNumber, homeFifaCode, awayFifaCode, kickoffAt }) {
  const number = Number(matchNumber);
  const homeCode = String(homeFifaCode ?? '').toUpperCase();
  const awayCode = String(awayFifaCode ?? '').toUpperCase();
  const kickoffMs = kickoffAt ? new Date(kickoffAt).getTime() : NaN;

  const candidates = calendar.filter((entry) => {
    if (Number(entry.MatchNumber) !== number) return false;

    const entryHome = extractTeamAbbreviation(entry.Home).toUpperCase();
    const entryAway = extractTeamAbbreviation(entry.Away).toUpperCase();
    if (homeCode && entryHome && entryHome !== homeCode) return false;
    if (awayCode && entryAway && entryAway !== awayCode) return false;

    if (Number.isFinite(kickoffMs) && entry.Date) {
      const entryMs = new Date(entry.Date).getTime();
      const diffHours = Math.abs(entryMs - kickoffMs) / (60 * 60 * 1000);
      if (diffHours > 30) return false;
    }

    return true;
  });

  return candidates[0] ?? null;
}

export async function fetchMatchTimeline({ idStage, idMatch }) {
  return fifaRequest(`/timelines/${env.fifaCompetitionId}/${env.fifaSeasonId}/${idStage}/${idMatch}`, {
    searchParams: { language: 'en-GB' },
  });
}

export async function fetchLiveMatchFootball({ idStage, idMatch }) {
  return fifaRequest(
    `/live/football/${env.fifaCompetitionId}/${env.fifaSeasonId}/${idStage}/${idMatch}`
  );
}

export async function resolveFifaMatchEntry(calendar, match, homeTeam, awayTeam) {
  if (match.raw?.fifaMeta?.idMatch && match.raw?.fifaMeta?.idStage) {
    const cached = calendar.find((entry) => String(entry.IdMatch) === String(match.raw.fifaMeta.idMatch));
    if (cached) return cached;

    return {
      IdMatch: match.raw.fifaMeta.idMatch,
      IdStage: match.raw.fifaMeta.idStage,
      MatchNumber: match.raw.fifaMeta.matchNumber ?? Number(match.externalId),
      Home: { IdTeam: match.raw.fifaMeta.homeTeamId },
      Away: { IdTeam: match.raw.fifaMeta.awayTeamId },
    };
  }

  return findCalendarMatch(calendar, {
    matchNumber: match.externalId,
    homeFifaCode: homeTeam?.fifaCode,
    awayFifaCode: awayTeam?.fifaCode,
    kickoffAt: match.kickoffAt,
  });
}
