import nationProfiles from '../data/nationFootballProfiles.json' with { type: 'json' };
import { TRANSMISSIONS_TIMEZONE } from './transmissionService.js';

const SPANISH_NATION_NAMES_BY_FIFA = Object.fromEntries(
  Object.entries(nationProfiles.profiles ?? {}).map(([code, profile]) => [
    code.toUpperCase(),
    profile?.name ?? '',
  ])
);

/** Variantes de nombres usadas en agendas de streaming en español. */
export const TEAM_ALIASES = {
  argentina: ['argentina', 'arg'],
  brazil: ['brazil', 'brasil', 'bra'],
  morocco: ['morocco', 'marruecos', 'mar'],
  haiti: ['haiti', 'haití', 'hai', 'hti'],
  scotland: ['scotland', 'escocia', 'sco'],
  czech: ['czech', 'checa', 'republica checa', 'rep checa', 'cze', 'checoslovaquia'],
  southafrica: ['south africa', 'sudafrica', 'sur africa', 'rsa'],
  bosnia: ['bosnia', 'herzegovina', 'bosnia herzegovina', 'bosnia-herzegovina', 'bih'],
  korea: ['korea', 'corea', 'corea del sur', 'kor'],
  usa: ['usa', 'estados unidos', 'united states', 'us'],
  netherlands: ['netherlands', 'paises bajos', 'holanda', 'ned'],
  japan: ['japan', 'japon', 'jpn'],
  mexico: ['mexico', 'méxico', 'mex'],
  switzerland: ['switzerland', 'suiza', 'sui'],
  qatar: ['qatar', 'catar', 'qat'],
  canada: ['canada', 'canadá', 'can'],
  colombia: ['colombia', 'col'],
  portugal: ['portugal', 'por'],
  congo: ['congo', 'rd del congo', 'rdc'],
  uzbekistan: ['uzbekistan', 'uzb'],
  jordan: ['jordan', 'jordania', 'jor'],
  algeria: ['algeria', 'argelia', 'alg'],
  austria: ['austria', 'aut'],
};

export function normalizeTeamToken(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function collectTeamTokens(team) {
  const tokens = new Set();
  for (const value of [team?.nameEn, team?.nameFa, team?.fifaCode, team?.externalId]) {
    const normalized = normalizeTeamToken(value);
    if (normalized) tokens.add(normalized);
  }

  const fifaCode = String(team?.fifaCode ?? '').trim().toUpperCase();
  const spanishName = SPANISH_NATION_NAMES_BY_FIFA[fifaCode];
  if (spanishName) {
    const normalized = normalizeTeamToken(spanishName);
    if (normalized) tokens.add(normalized);
  }

  return [...tokens];
}

export function expandTeamTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const aliases of Object.values(TEAM_ALIASES)) {
      if (aliases.some((alias) => token.includes(alias) || alias.includes(token))) {
        aliases.forEach((alias) => expanded.add(alias));
      }
    }
  }
  return [...expanded];
}

function parseAgendaTimeMinutes(timeStr) {
  const match = String(timeStr ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function kickoffMinutesInArgentina(kickoffAt) {
  if (!kickoffAt) return null;
  const date = kickoffAt instanceof Date ? kickoffAt : new Date(kickoffAt);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TRANSMISSIONS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? NaN);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function scoreKickoffTimeBonus(match, eventTime) {
  const agendaMinutes = parseAgendaTimeMinutes(eventTime);
  const kickoffMinutes = kickoffMinutesInArgentina(match?.kickoffAt);
  if (agendaMinutes == null || kickoffMinutes == null) return 0;

  const diff = Math.abs(agendaMinutes - kickoffMinutes);
  const wrappedDiff = Math.min(diff, 24 * 60 - diff);
  return wrappedDiff <= 30 ? 3 : wrappedDiff <= 60 ? 1 : 0;
}

export function scoreEventForMatch(
  event,
  homeTeamName,
  awayTeamName,
  homeTeam,
  awayTeam,
  match = null
) {
  const haystack = normalizeTeamToken(event.title);
  const homeTokens = expandTeamTokens([
    normalizeTeamToken(homeTeamName),
    ...collectTeamTokens(homeTeam),
  ]).filter(Boolean);
  const awayTokens = expandTeamTokens([
    normalizeTeamToken(awayTeamName),
    ...collectTeamTokens(awayTeam),
  ]).filter(Boolean);

  if (!haystack || (!homeTokens.length && !awayTokens.length)) return 0;

  let score = 0;
  for (const token of homeTokens) {
    if (token.length >= 3 && haystack.includes(token)) score += 2;
  }
  for (const token of awayTokens) {
    if (token.length >= 3 && haystack.includes(token)) score += 2;
  }

  const homeHit = homeTokens.some((token) => token.length >= 3 && haystack.includes(token));
  const awayHit = awayTokens.some((token) => token.length >= 3 && haystack.includes(token));
  if (homeHit && awayHit) score += 4;

  if (match) {
    score += scoreKickoffTimeBonus(match, event.time);
  }

  return score;
}

/**
 * @param {import('../models/Match.js').Match} match
 * @param {Array<{ title?: string, time?: string, streams?: unknown[] }>} events
 */
export function rankEventsForMatch(
  match,
  events,
  homeTeamName = '',
  awayTeamName = '',
  homeTeam = null,
  awayTeam = null
) {
  return [...events]
    .map((event) => ({
      ...event,
      score: scoreEventForMatch(event, homeTeamName, awayTeamName, homeTeam, awayTeam, match),
    }))
    .filter((event) => event.score > 0)
    .sort((a, b) => b.score - a.score || (b.streams?.length ?? 0) - (a.streams?.length ?? 0));
}
