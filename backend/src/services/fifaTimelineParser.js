/** @typedef {'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'foul' | 'goal_disallowed'} TimelineEventType */

const INCLUDED_TYPES = new Set([0, 2, 3, 5, 18, 71]);

const TYPE_MAP = {
  0: 'goal',
  2: 'yellow_card',
  3: 'red_card',
  5: 'substitution',
  18: 'foul',
  71: 'goal_disallowed',
};

export function parseFifaMinute(matchMinute) {
  const raw = String(matchMinute ?? '').trim();
  if (!raw || /^ht$/i.test(raw)) {
    return { minute: null, extraMinute: null, sortKey: Number.POSITIVE_INFINITY };
  }

  const extraMatch = raw.match(/^(\d+)\s*['']?\s*\+\s*(\d+)\s*['']?$/);
  if (extraMatch) {
    const minute = Number(extraMatch[1]);
    const extraMinute = Number(extraMatch[2]);
    return { minute, extraMinute, sortKey: minute + extraMinute / 100 };
  }

  const simpleMatch = raw.match(/^(\d+)\s*['']?$/);
  if (simpleMatch) {
    const minute = Number(simpleMatch[1]);
    return { minute, extraMinute: null, sortKey: minute };
  }

  return { minute: null, extraMinute: null, sortKey: Number.POSITIVE_INFINITY };
}

function localizedDescription(event) {
  return event?.EventDescription?.find((item) => item.Locale === 'en-GB')?.Description ?? '';
}

function extractPlayerName(description, fallback = '') {
  const trimmed = String(description ?? '').trim();
  if (!trimmed) return fallback;

  const patterns = [
    /^(.+?)\s*\([^)]+\)\s+(?:scores!!|is booked|is sent off!|commits a foul\.)/i,
    /^(.+?)\s*\(in\)/i,
    /^(.+?)\s*\(out\)/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return fallback;
}

function parseSubstitution(description) {
  const match = String(description ?? '').match(
    /(.+?)\s*\(in\).*?replace\s+(.+?)\s*\(out\)/i
  );
  if (!match) return { playerIn: null, playerOut: null };

  return {
    playerIn: match[1].trim(),
    playerOut: match[2].trim(),
  };
}

function resolveSide(teamId, homeTeamId, awayTeamId) {
  const id = String(teamId ?? '');
  if (id && id === String(homeTeamId)) return 'home';
  if (id && id === String(awayTeamId)) return 'away';
  return null;
}

export function parseFifaTimeline(timelineJson, homeTeamId, awayTeamId) {
  const events = timelineJson?.Event ?? [];
  const parsed = [];

  for (const event of events) {
    if (!INCLUDED_TYPES.has(event.Type)) continue;

    const description = localizedDescription(event);
    const timing = parseFifaMinute(event.MatchMinute);
    const type = /** @type {TimelineEventType} */ (TYPE_MAP[event.Type]);
    const side = resolveSide(event.IdTeam, homeTeamId, awayTeamId);
    if (!side && type !== 'goal_disallowed') continue;

    const entry = {
      sortKey: timing.sortKey,
      minute: timing.minute,
      extraMinute: timing.extraMinute,
      type,
      side,
      player: extractPlayerName(description),
      playerIn: null,
      playerOut: null,
      description,
    };

    if (type === 'substitution') {
      const { playerIn, playerOut } = parseSubstitution(description);
      entry.playerIn = playerIn;
      entry.playerOut = playerOut;
      entry.player = playerIn ?? playerOut ?? entry.player;
      if (!entry.playerIn || !entry.playerOut) continue;
    } else if (type === 'goal_disallowed') {
      entry.player = description || 'Gol anulado';
    } else if (!entry.player) {
      continue;
    }

    parsed.push(entry);
  }

  return parsed.sort((a, b) => a.sortKey - b.sortKey);
}
