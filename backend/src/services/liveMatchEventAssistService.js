import { Match } from '../models/Match.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import {
  enrichNameFromRoster,
  matchNameToRosterPlayer,
  normalizeName,
  rosterPositionForName,
} from '../utils/playerNameMatch.js';
import {
  buildTimelineFromLegacy,
  enrichMatchLiveFields,
  goalCountsFromTimeline,
  readStoredMatchEvents,
  timelineHash,
} from './matchLiveData.js';
import {
  buildFifaTimelineEntry,
  extractPlayerNameFromDescription,
  FIFA_INCLUDED_EVENT_TYPES,
  isNeutralTimelineEvent,
  parseFifaMinute,
  parseSubstitutionFromDescription,
} from './fifaTimelineParser.js';
import { callAiForJson, hasAiProvider } from './aiPredictionService.js';
import { unifyRawTeamPlayers } from './playerRosterUnifyService.js';

const LIVE_ASSIST_TTL_MS = 2 * 60 * 1000;
const FINISHED_ASSIST_TTL_MS = 6 * 60 * 60 * 1000;

const ALLOWED_EVENT_TYPES = new Set([
  'goal',
  'yellow_card',
  'red_card',
  'substitution',
  'foul',
  'shot_attempt',
  'goal_disallowed',
  'yellow_card_reassigned',
  'var_decision',
  'hydration_break',
  'period_start',
  'period_end',
  'match_end',
]);

function rosterForSide(side, homePlayers, awayPlayers) {
  if (side === 'home') return homePlayers;
  if (side === 'away') return awayPlayers;
  return [];
}

function timelineRosterFromRawPlayers(players = []) {
  return unifyRawTeamPlayers(players);
}

export function computeAssistInputHash(rawEvents = [], timeline = []) {
  const rawKey = (rawEvents ?? [])
    .filter((event) => FIFA_INCLUDED_EVENT_TYPES.has(event.Type))
    .map((event) => [event.Type, event.MatchMinute, event.IdTeam ?? ''].join(':'))
    .join('|');
  return `${rawKey}::${timelineHash(timeline)}`;
}

function isAssistFresh(assistedAt, matchStatus, now = Date.now()) {
  if (!assistedAt) return false;
  const ttl = matchStatus === 'live' ? LIVE_ASSIST_TTL_MS : FINISHED_ASSIST_TTL_MS;
  return now - new Date(assistedAt).getTime() < ttl;
}

function eventIdentity(event) {
  const phase = event.phase ?? '';
  return [
    event.type,
    event.side ?? '',
    event.minute ?? '',
    event.extraMinute ?? '',
    phase,
    event.player ?? '',
    event.playerIn ?? '',
    event.playerOut ?? '',
  ].join(':');
}

function timelineHasIdentity(timeline, entry) {
  const key = eventIdentity(entry);
  return timeline.some((event) => eventIdentity(event) === key);
}

function timelineHasEquivalentSlot(timeline, entry) {
  const phase = entry.phase ?? '';
  return timeline.some((event) => {
    const eventPhase = event.phase ?? '';
    return (
      event.type === entry.type &&
      (event.side ?? null) === (entry.side ?? null) &&
      (event.minute ?? null) === (entry.minute ?? null) &&
      (event.extraMinute ?? null) === (entry.extraMinute ?? null) &&
      eventPhase === phase
    );
  });
}

function isEntryComplete(entry) {
  if (isNeutralTimelineEvent(entry.type)) return true;
  if (entry.type === 'substitution') return Boolean(entry.playerIn && entry.playerOut);
  if (entry.type === 'goal') return true;
  return Boolean(entry.player);
}

export function isNamePlausible(name, description, roster = []) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return false;

  const normalized = normalizeName(trimmed);
  const desc = normalizeName(description);
  if (desc.includes(normalized)) return true;

  const parts = normalized.split(/\s+/).filter((part) => part.length > 2);
  if (parts.some((part) => desc.includes(part))) return true;

  return Boolean(matchNameToRosterPlayer(trimmed, roster));
}

export function normalizeTimelinePlayerNames(timeline, homePlayers, awayPlayers) {
  return timeline.map((event) => {
    const roster = rosterForSide(event.side, homePlayers, awayPlayers);
    const normalized = { ...event };

    if (normalized.player) {
      const enriched = enrichNameFromRoster(normalized.player, roster, {
        shirtNumber: normalized.playerShirtNumber ?? null,
      });
      normalized.player = enriched.name;
      normalized.playerPosition = enriched.position ?? normalized.playerPosition ?? null;
      normalized.playerShirtNumber =
        enriched.shirtNumber ?? normalized.playerShirtNumber ?? null;
    }
    if (normalized.playerIn) {
      const enriched = enrichNameFromRoster(normalized.playerIn, roster, {
        shirtNumber: normalized.playerInShirtNumber ?? null,
      });
      normalized.playerIn = enriched.name;
      normalized.playerInPosition = enriched.position ?? normalized.playerInPosition ?? null;
      normalized.playerInShirtNumber =
        enriched.shirtNumber ?? normalized.playerInShirtNumber ?? null;
    }
    if (normalized.playerOut) {
      const enriched = enrichNameFromRoster(normalized.playerOut, roster, {
        shirtNumber: normalized.playerOutShirtNumber ?? null,
      });
      normalized.playerOut = enriched.name;
      normalized.playerOutPosition = enriched.position ?? normalized.playerOutPosition ?? null;
      normalized.playerOutShirtNumber =
        enriched.shirtNumber ?? normalized.playerOutShirtNumber ?? null;
    }

    return normalized;
  });
}

function timelineMissingPositions(timeline, homePlayers, awayPlayers) {
  for (const event of timeline) {
    const roster = rosterForSide(event.side, homePlayers, awayPlayers);

    if (event.player && !event.playerPosition && rosterPositionForName(event.player, roster)) {
      return true;
    }
    if (event.playerIn && !event.playerInPosition && rosterPositionForName(event.playerIn, roster)) {
      return true;
    }
    if (event.playerOut && !event.playerOutPosition && rosterPositionForName(event.playerOut, roster)) {
      return true;
    }
  }

  return false;
}

export function findMissingRawEvents(rawEvents = [], timeline = [], homeTeamId, awayTeamId) {
  const missing = [];

  for (let index = 0; index < rawEvents.length; index += 1) {
    const rawEvent = rawEvents[index];
    if (!FIFA_INCLUDED_EVENT_TYPES.has(rawEvent.Type)) continue;

    const entry = buildFifaTimelineEntry(rawEvent, homeTeamId, awayTeamId);
    if (!entry) continue;

    if (isEntryComplete(entry) && timelineHasIdentity(timeline, entry)) continue;

    missing.push({
      index,
      rawEvent,
      entry,
      description: entry.description ?? '',
    });
  }

  return missing;
}

function tryRecoverEntryHeuristic(entry, roster) {
  const description = entry.description ?? '';
  const recovered = { ...entry };

  if (recovered.type === 'substitution') {
    if (!recovered.playerIn || !recovered.playerOut) {
      let { playerIn, playerOut } = parseSubstitutionFromDescription(description);
      if (!playerIn || !playerOut) {
        const relaxed = description.match(
          /(.+?)\s*\(in\).*?(?:replace|replaces|for)\s+(.+?)\s*\(out\)/i
        );
        if (relaxed) {
          playerIn = relaxed[1].trim();
          playerOut = relaxed[2].trim();
        }
      }
      recovered.playerIn = playerIn ?? recovered.playerIn;
      recovered.playerOut = playerOut ?? recovered.playerOut;
      recovered.player = recovered.playerIn ?? recovered.playerOut ?? recovered.player;
    }
  } else if (!isNeutralTimelineEvent(recovered.type) && !recovered.player) {
    recovered.player =
      extractPlayerNameFromDescription(description) ||
      description.match(/^(.+?)\s*\(/)?.[1]?.trim() ||
      description.match(/^(.+?)\s+scores\b/i)?.[1]?.trim() ||
      description.match(/^(.+?)\s+is booked\b/i)?.[1]?.trim() ||
      description.match(/^(.+?)\s+is sent off\b/i)?.[1]?.trim() ||
      null;
  }

  if (recovered.player && !isNamePlausible(recovered.player, description, roster)) {
    recovered.player = null;
  }
  if (recovered.playerIn && !isNamePlausible(recovered.playerIn, description, roster)) {
    recovered.playerIn = null;
  }
  if (recovered.playerOut && !isNamePlausible(recovered.playerOut, description, roster)) {
    recovered.playerOut = null;
  }

  return recovered;
}

function normalizeAiRecoveredEntry(rawEntry, missingItem, roster) {
  if (!rawEntry || typeof rawEntry !== 'object') return null;

  const entry = { ...missingItem.entry };
  const description = missingItem.description;

  if (entry.type === 'substitution') {
    entry.playerIn = String(rawEntry.playerIn ?? rawEntry.player_in ?? entry.playerIn ?? '').trim() || null;
    entry.playerOut =
      String(rawEntry.playerOut ?? rawEntry.player_out ?? entry.playerOut ?? '').trim() || null;
    entry.player = entry.playerIn ?? entry.playerOut ?? entry.player;
  } else if (!isNeutralTimelineEvent(entry.type)) {
    entry.player = String(rawEntry.player ?? entry.player ?? '').trim() || null;
  }

  if (!isEntryComplete(entry)) return null;

  if (entry.player && !isNamePlausible(entry.player, description, roster)) return null;
  if (entry.playerIn && !isNamePlausible(entry.playerIn, description, roster)) return null;
  if (entry.playerOut && !isNamePlausible(entry.playerOut, description, roster)) return null;

  return entry;
}

function formatRosterForPrompt(players = []) {
  return players
    .map((player) => `${player.fullName} (${player.position ?? '?'})`)
    .join(', ');
}

function buildMissingEventsPrompt(missingItems, homeCode, awayCode, homePlayers = [], awayPlayers = []) {
  const lines = missingItems.map(
    (item, index) =>
      `${index}: minute="${item.rawEvent.MatchMinute}" type="${item.entry.type}" side="${item.entry.side}" description="${item.description.replace(/"/g, "'")}"`
  );

  const homeRoster = formatRosterForPrompt(homePlayers);
  const awayRoster = formatRosterForPrompt(awayPlayers);

  return `Extraé datos estructurados SOLO de estas descripciones de eventos FIFA del Mundial 2026.
NO inventes eventos, minutos ni jugadores que no aparezcan en la descripción.
Usá el roster para completar nombres parciales; NO inventes jugadores fuera del roster.

Equipos: ${homeCode} (home) vs ${awayCode} (away)
Roster ${homeCode}: ${homeRoster || 'sin datos'}
Roster ${awayCode}: ${awayRoster || 'sin datos'}

Eventos sin parsear:
${lines.join('\n')}

Respondé ÚNICAMENTE JSON válido:
{
  "events": [
    { "index": 0, "player": "Nombre Apellido", "playerIn": null, "playerOut": null }
  ]
}

Para sustituciones usá playerIn y playerOut. Para goles/tarjetas/faltas/tiros usá player.`;
}

async function recoverMissingWithAi(missingItems, homeCode, awayCode, homePlayers, awayPlayers) {
  if (!missingItems.length || !hasAiProvider()) {
    return { recovered: [], prompt: null, rawResponse: null, source: null };
  }

  const prompt = buildMissingEventsPrompt(missingItems, homeCode, awayCode, homePlayers, awayPlayers);

  try {
    const result = await callAiForJson(prompt);
    const rows = Array.isArray(result?.data?.events) ? result.data.events : [];
    const recovered = [];

    for (const row of rows) {
      const index = Number(row?.index);
      if (!Number.isInteger(index) || index < 0 || index >= missingItems.length) continue;

      const missingItem = missingItems[index];
      const roster = rosterForSide(missingItem.entry.side, homePlayers, awayPlayers);
      const entry = normalizeAiRecoveredEntry(row, missingItem, roster);
      if (entry) recovered.push(entry);
    }

    return {
      recovered,
      prompt,
      rawResponse: result?.data ?? null,
      source: result?.source ?? null,
    };
  } catch (err) {
    return {
      recovered: [],
      prompt,
      rawResponse: { error: err.message },
      source: null,
    };
  }
}

export function validateAssistedTimeline(assisted, original, fifaMeta = {}) {
  if (!Array.isArray(assisted)) return false;

  for (const event of assisted) {
    if (!ALLOWED_EVENT_TYPES.has(event.type)) return false;
  }

  const { home, away } = goalCountsFromTimeline(assisted);
  if (Number.isFinite(Number(fifaMeta.homeScore)) && home > Number(fifaMeta.homeScore)) {
    return false;
  }
  if (Number.isFinite(Number(fifaMeta.awayScore)) && away > Number(fifaMeta.awayScore)) {
    return false;
  }

  for (const originalEvent of original) {
    if (!timelineHasEquivalentSlot(assisted, originalEvent)) return false;
  }

  return true;
}

function mergeTimelineEntries(baseTimeline, recoveredEntries) {
  const merged = [...baseTimeline];

  for (const entry of recoveredEntries) {
    if (!isEntryComplete(entry)) continue;
    if (timelineHasIdentity(merged, entry)) continue;
    merged.push(entry);
  }

  return merged.sort((a, b) => a.sortKey - b.sortKey);
}

function stripTimelineForStorage(timeline) {
  return timeline.map(({ description, ...event }) => event);
}

export async function assistMatchEvents(match, { homeTeam, awayTeam, homePlayers, awayPlayers } = {}) {
  const raw = match.raw ?? {};
  const fifaEvents = raw.fifaEvents ?? {};
  const rawEvents = Array.isArray(fifaEvents.rawEvents) ? fifaEvents.rawEvents : [];
  const parsedTimeline = Array.isArray(fifaEvents.timeline) ? fifaEvents.timeline : [];
  const homeRoster = timelineRosterFromRawPlayers(homePlayers);
  const awayRoster = timelineRosterFromRawPlayers(awayPlayers);

  let baseTimeline = parsedTimeline.length > 0 ? [...parsedTimeline] : [];
  if (baseTimeline.length === 0) {
    const storedEvents = readStoredMatchEvents(raw);
    baseTimeline = buildTimelineFromLegacy(raw, storedEvents);
  }

  if (baseTimeline.length === 0) {
    return { updated: false, skipped: true, reason: 'empty_timeline' };
  }

  const inputHash = computeAssistInputHash(rawEvents, parsedTimeline.length > 0 ? parsedTimeline : baseTimeline);
  const needsPositions = timelineMissingPositions(baseTimeline, homeRoster, awayRoster);
  if (
    !needsPositions &&
    fifaEvents.assistHash === inputHash &&
    isAssistFresh(fifaEvents.assistedAt, match.status)
  ) {
    return { updated: false, skipped: true, reason: 'fresh_cache' };
  }

  const originalTimeline = baseTimeline.map((event) => ({ ...event }));
  let assistedTimeline = normalizeTimelinePlayerNames(originalTimeline, homeRoster, awayRoster);

  if (rawEvents.length > 0 && raw.fifaMeta?.homeTeamId && raw.fifaMeta?.awayTeamId) {
    const missing = findMissingRawEvents(
      rawEvents,
      originalTimeline,
      raw.fifaMeta.homeTeamId,
      raw.fifaMeta.awayTeamId
    );

    const recovered = [];
    const stillMissing = [];

    for (const missingItem of missing) {
      const roster = rosterForSide(missingItem.entry.side, homeRoster, awayRoster);
      const heuristic = tryRecoverEntryHeuristic(missingItem.entry, roster);
      if (isEntryComplete(heuristic) && !timelineHasIdentity(assistedTimeline, heuristic)) {
        recovered.push(heuristic);
      } else if (!isEntryComplete(heuristic)) {
        stillMissing.push(missingItem);
      }
    }

    if (stillMissing.length > 0) {
      const aiResult = await recoverMissingWithAi(
        stillMissing,
        homeTeam?.fifaCode ?? 'LOC',
        awayTeam?.fifaCode ?? 'VIS',
        homeRoster,
        awayRoster
      );
      recovered.push(...aiResult.recovered);
    }

    const merged = mergeTimelineEntries(assistedTimeline, recovered);
    assistedTimeline = normalizeTimelinePlayerNames(merged, homeRoster, awayRoster);
  }

  if (!validateAssistedTimeline(assistedTimeline, originalTimeline, raw.fifaMeta ?? {})) {
    assistedTimeline = normalizeTimelinePlayerNames(originalTimeline, homeRoster, awayRoster);
  }

  const storedTimeline = stripTimelineForStorage(assistedTimeline);
  const changed = timelineHash(storedTimeline) !== timelineHash(stripTimelineForStorage(originalTimeline));

  if (!changed && fifaEvents.assistHash === inputHash) {
    return { updated: false, skipped: true, reason: 'unchanged' };
  }

  const fifaEventsUpdate = {
    ...fifaEvents,
    timeline: storedTimeline,
    assistHash: inputHash,
    assistedAt: new Date().toISOString(),
  };
  if (rawEvents.length > 0) {
    fifaEventsUpdate.rawEvents = rawEvents;
  }
  if (!fifaEventsUpdate.source) {
    fifaEventsUpdate.source = parsedTimeline.length > 0 ? 'fifa_api' : 'legacy_merge';
  }
  if (!fifaEventsUpdate.syncedAt) {
    fifaEventsUpdate.syncedAt = new Date().toISOString();
  }

  await Match.updateOne(
    { _id: match._id },
    { $set: { 'raw.fifaEvents': fifaEventsUpdate } }
  );

  return { updated: true, skipped: false, events: storedTimeline.length };
}

async function loadMatchBundle(match) {
  const [homeTeam, awayTeam, homePlayers, awayPlayers] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
    Player.find({ teamExternalId: match.homeTeamId }).lean(),
    Player.find({ teamExternalId: match.awayTeamId }).lean(),
  ]);

  return { homeTeam, awayTeam, homePlayers, awayPlayers };
}

export async function assistLiveMatchEvents({ matchIds = [] } = {}) {
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let matches;
  if (matchIds.length > 0) {
    matches = await Match.find({
      _id: { $in: matchIds },
      status: { $in: ['live', 'finished'] },
    }).lean();
  } else {
    const [liveMatches, recentFinished] = await Promise.all([
      Match.find({ status: 'live' }).lean(),
      Match.find({ status: 'finished', kickoffAt: { $gte: recentCutoff } }).lean(),
    ]);
    matches = [...liveMatches, ...recentFinished];
  }

  let updated = 0;
  let skipped = 0;

  for (const match of matches) {
    try {
      const bundle = await loadMatchBundle(match);
      const result = await assistMatchEvents(match, bundle);
      if (result.updated) updated += 1;
      else skipped += 1;
    } catch (err) {
      console.warn(`Live event assist skip match ${match.externalId}:`, err.message);
      skipped += 1;
    }
  }

  return { matches: matches.length, updated, skipped };
}

/**
 * Diagnóstico: qué datos tiene el partido y qué devolvería la IA (sin persistir).
 */
export async function probeLiveEventAssist(
  match,
  { homeTeam, awayTeam, homePlayers, awayPlayers } = {},
  { invokeAi = true } = {}
) {
  const raw = match.raw ?? {};
  const fifaEvents = raw.fifaEvents ?? {};
  const rawEvents = Array.isArray(fifaEvents.rawEvents) ? fifaEvents.rawEvents : [];
  const parsedTimeline = Array.isArray(fifaEvents.timeline) ? fifaEvents.timeline : [];

  let baseTimeline = parsedTimeline.length > 0 ? [...parsedTimeline] : [];
  if (baseTimeline.length === 0) {
    const storedEvents = readStoredMatchEvents(raw);
    baseTimeline = buildTimelineFromLegacy(raw, storedEvents);
  }

  const payloadBefore = enrichMatchLiveFields(match);
  const inputHash = computeAssistInputHash(
    rawEvents,
    parsedTimeline.length > 0 ? parsedTimeline : baseTimeline
  );

  const report = {
    matchId: String(match._id),
    externalId: match.externalId,
    status: match.status,
    aiAvailable: hasAiProvider(),
    assistCacheFresh: Boolean(
      fifaEvents.assistHash === inputHash && isAssistFresh(fifaEvents.assistedAt, match.status)
    ),
    sources: {
      rawFifaEvents: rawEvents.length,
      parsedTimelineEvents: parsedTimeline.length,
      legacyOrMergedTimelineEvents: baseTimeline.length,
      hasFifaMeta: Boolean(raw.fifaMeta?.syncedAt),
      fdEventsStored: Boolean(raw.fdEvents),
    },
    apiPayloadBefore: {
      homeScore: payloadBefore.homeScore,
      awayScore: payloadBefore.awayScore,
      timeElapsed: payloadBefore.timeElapsed,
      timelineEvents: payloadBefore.matchTimeline?.length ?? 0,
      timeline: payloadBefore.matchTimeline ?? [],
      homeScorers: payloadBefore.homeScorers,
      awayScorers: payloadBefore.awayScorers,
      homeBookings: payloadBefore.homeBookings,
      awayBookings: payloadBefore.awayBookings,
      homeSubstitutions: payloadBefore.homeSubstitutions,
      awaySubstitutions: payloadBefore.awaySubstitutions,
      fifaReportStats: payloadBefore.fifaReportStats,
    },
    assistPlan: {
      inputHash,
      missingFromParser: [],
      recoveredHeuristic: [],
      ai: null,
      validationPassed: null,
      wouldAddEvents: 0,
    },
    apiPayloadAfter: null,
  };

  if (baseTimeline.length === 0) {
    report.assistPlan.reason = 'empty_timeline';
    return report;
  }

  const originalTimeline = baseTimeline.map((event) => ({ ...event }));
  const homeRoster = timelineRosterFromRawPlayers(homePlayers);
  const awayRoster = timelineRosterFromRawPlayers(awayPlayers);
  let assistedTimeline = normalizeTimelinePlayerNames(originalTimeline, homeRoster, awayRoster);

  if (rawEvents.length > 0 && raw.fifaMeta?.homeTeamId && raw.fifaMeta?.awayTeamId) {
    const missing = findMissingRawEvents(
      rawEvents,
      originalTimeline,
      raw.fifaMeta.homeTeamId,
      raw.fifaMeta.awayTeamId
    );

    report.assistPlan.missingFromParser = missing.map((item) => ({
      index: item.index,
      minute: item.rawEvent.MatchMinute,
      type: item.entry.type,
      side: item.entry.side,
      description: item.description,
      partialEntry: {
        player: item.entry.player,
        playerIn: item.entry.playerIn,
        playerOut: item.entry.playerOut,
      },
    }));

    const recovered = [];
    const stillMissing = [];

    for (const missingItem of missing) {
      const roster = rosterForSide(missingItem.entry.side, homeRoster, awayRoster);
      const heuristic = tryRecoverEntryHeuristic(missingItem.entry, roster);
      if (isEntryComplete(heuristic) && !timelineHasIdentity(assistedTimeline, heuristic)) {
        recovered.push(heuristic);
        report.assistPlan.recoveredHeuristic.push({
          minute: heuristic.minute,
          type: heuristic.type,
          side: heuristic.side,
          player: heuristic.player,
          playerIn: heuristic.playerIn,
          playerOut: heuristic.playerOut,
        });
      } else if (!isEntryComplete(heuristic)) {
        stillMissing.push(missingItem);
      }
    }

    if (invokeAi && stillMissing.length > 0) {
      const aiResult = await recoverMissingWithAi(
        stillMissing,
        homeTeam?.fifaCode ?? 'LOC',
        awayTeam?.fifaCode ?? 'VIS',
        homeRoster,
        awayRoster
      );
      report.assistPlan.ai = {
        providerConfigured: hasAiProvider(),
        eventsSentToAi: stillMissing.length,
        source: aiResult.source,
        promptPreview: aiResult.prompt?.slice(0, 500) ?? null,
        promptFull: aiResult.prompt,
        rawResponse: aiResult.rawResponse,
        recovered: aiResult.recovered.map((event) => ({
          minute: event.minute,
          type: event.type,
          side: event.side,
          player: event.player,
          playerIn: event.playerIn,
          playerOut: event.playerOut,
        })),
      };
      recovered.push(...aiResult.recovered);
    } else if (stillMissing.length > 0) {
      report.assistPlan.ai = {
        providerConfigured: hasAiProvider(),
        eventsSentToAi: stillMissing.length,
        skipped: !invokeAi ? 'invokeAi=false' : 'no_provider',
      };
    }

    assistedTimeline = normalizeTimelinePlayerNames(
      mergeTimelineEntries(assistedTimeline, recovered),
      homeRoster,
      awayRoster
    );
  }

  const validationPassed = validateAssistedTimeline(
    assistedTimeline,
    originalTimeline,
    raw.fifaMeta ?? {}
  );
  report.assistPlan.validationPassed = validationPassed;

  if (!validationPassed) {
    assistedTimeline = normalizeTimelinePlayerNames(originalTimeline, homeRoster, awayRoster);
  }

  const storedTimeline = stripTimelineForStorage(assistedTimeline);
  report.assistPlan.wouldAddEvents = Math.max(
    0,
    storedTimeline.length - stripTimelineForStorage(originalTimeline).length
  );

  const payloadAfter = enrichMatchLiveFields(
    {
      ...match,
      raw: {
        ...raw,
        fifaEvents: {
          ...fifaEvents,
          timeline: storedTimeline,
        },
      },
    },
    {
      homePlayers: homeRoster,
      awayPlayers: awayRoster,
    }
  );

  report.apiPayloadAfter = {
    homeScore: payloadAfter.homeScore,
    awayScore: payloadAfter.awayScore,
    timeElapsed: payloadAfter.timeElapsed,
    timelineEvents: payloadAfter.matchTimeline?.length ?? 0,
    timeline: payloadAfter.matchTimeline ?? [],
    homeScorers: payloadAfter.homeScorers,
    awayScorers: payloadAfter.awayScorers,
    diffTimelineOnly: storedTimeline.filter(
      (event) => !timelineHasIdentity(originalTimeline, event)
    ),
  };

  return report;
}

export async function probeLiveEventAssistById(matchId, options = {}) {
  const match = await Match.findById(matchId).lean();
  if (!match) throw new Error('Partido no encontrado');

  const bundle = await loadMatchBundle(match);
  return probeLiveEventAssist(match, bundle, options);
}
