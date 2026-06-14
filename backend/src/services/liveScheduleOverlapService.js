import { normalizeWeatherOps } from './matchWeatherOpsRules.js';

const KICKOFF_SLOT_MS = 5 * 60 * 1000;
const OVERLAP_WINDOW_MS = 3 * 60 * 60 * 1000;

function kickoffMs(match) {
  if (!match?.kickoffAt) return NaN;
  return new Date(match.kickoffAt).getTime();
}

function weatherDelayActive(match) {
  const phase = normalizeWeatherOps(match?.weatherOps).phase;
  return phase === 'suspended' || phase === 'pre_kickoff_delay' || phase === 'postponed';
}

function groupPairKey(match) {
  if (!match?.group || !match?.matchday || !match?.kickoffAt) return null;
  const slot = Math.floor(kickoffMs(match) / KICKOFF_SLOT_MS);
  return `group-${match.group}-md-${match.matchday}-slot-${slot}`;
}

export function buildSimultaneousGroupPairs(matches) {
  const byKey = new Map();
  for (const match of matches) {
    const key = groupPairKey(match);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(match);
  }

  const pairs = new Map();
  for (const [key, group] of byKey) {
    if (group.length < 2) continue;
    for (const match of group) {
      const partners = group.filter((m) => m._id?.toString() !== match._id?.toString());
      pairs.set(match._id?.toString() ?? match.id, {
        overlapGroupKey: key,
        partnerMatchIds: partners.map((p) => p._id?.toString() ?? p.id),
        simultaneousGroupPair: true,
      });
    }
  }
  return pairs;
}

function formatOverlapEntry(match) {
  return {
    matchId: match._id?.toString() ?? match.id,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    kickoffAt: match.kickoffAt?.toISOString?.() ?? match.kickoffAt ?? null,
    status: match.status,
    weatherPhase: normalizeWeatherOps(match.weatherOps).phase,
  };
}

export function buildLiveScheduleContext(targetMatch, allMatches = []) {
  const targetId = targetMatch._id?.toString() ?? targetMatch.id;
  const now = Date.now();
  const liveMatches = allMatches.filter((m) => m.status === 'live');
  const concurrentLiveCount = liveMatches.length;

  const targetKickoff = kickoffMs(targetMatch);
  const overlappingKickoffs = allMatches
    .filter((m) => {
      const id = m._id?.toString() ?? m.id;
      if (id === targetId) return false;
      const otherKickoff = kickoffMs(m);
      if (!Number.isFinite(targetKickoff) || !Number.isFinite(otherKickoff)) return false;
      return Math.abs(otherKickoff - targetKickoff) <= OVERLAP_WINDOW_MS;
    })
    .map(formatOverlapEntry);

  const pairMap = buildSimultaneousGroupPairs(allMatches);
  const pairInfo = pairMap.get(targetId) ?? null;

  let integrityWarning = null;
  if (pairInfo?.simultaneousGroupPair) {
    const partners = allMatches.filter((m) =>
      pairInfo.partnerMatchIds.includes(m._id?.toString() ?? m.id)
    );
    const selfDelayed = weatherDelayActive(targetMatch);
    const partnerPlaying = partners.some(
      (p) => p.status === 'live' && !weatherDelayActive(p)
    );
    const partnerDelayed = partners.some((p) => weatherDelayActive(p));
    const selfPlaying = targetMatch.status === 'live' && !weatherDelayActive(targetMatch);

    if (selfDelayed && partnerPlaying) {
      integrityWarning =
        'El otro partido del mismo grupo sigue en juego mientras este está demorado por clima.';
    } else if (selfPlaying && partnerDelayed) {
      integrityWarning =
        'Este partido sigue en juego mientras el otro partido del grupo está demorado por clima.';
    }
  }

  const weatherDelayedLiveCount = liveMatches.filter(weatherDelayActive).length;

  return {
    concurrentLiveCount,
    weatherDelayedLiveCount,
    overlappingKickoffs,
    simultaneousGroupPair: pairInfo
      ? {
          overlapGroupKey: pairInfo.overlapGroupKey,
          partnerMatchIds: pairInfo.partnerMatchIds,
          simultaneousGroupPair: true,
        }
      : null,
    integrityWarning,
    hasSchedulePressure: Boolean(integrityWarning) || concurrentLiveCount > 1,
  };
}

export function attachOverlapGroupKeys(matches) {
  const pairMap = buildSimultaneousGroupPairs(matches);
  return matches.map((match) => {
    const id = match._id?.toString() ?? match.id;
    const pair = pairMap.get(id);
    if (!pair) return match;
    const ops = normalizeWeatherOps(match.weatherOps);
    if (ops.overlapGroupKey === pair.overlapGroupKey) return match;
    return {
      ...match,
      weatherOps: {
        ...ops,
        overlapGroupKey: pair.overlapGroupKey,
      },
    };
  });
}
