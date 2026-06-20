import { describe, expect, it } from 'vitest';
import {
  mergeLiveDashboard,
  mergeLiveMatchFields,
  mergeLiveSnapshot,
  mergeTimelineEvents,
} from './patchLiveMatchSnapshot.js';
import {
  isLiveMatchReason,
  REALTIME_EVENTS,
  shouldRefreshSector,
  SECTOR_TAGS,
} from './realtimeSectors.js';

describe('mergeLiveSnapshot', () => {
  it('actualiza marcador en liveMatches y en matches', () => {
    const data = {
      matches: [{ id: 'm1', homeScore: 0, awayScore: 0, status: 'live' }],
      liveMatches: [{ id: 'm1', homeScore: 0, awayScore: 0, status: 'live' }],
      recentFinishedMatches: [],
    };
    const snapshot = {
      liveMatches: [{ id: 'm1', homeScore: 2, awayScore: 1, status: 'live', minute: 67 }],
      recentFinishedMatches: [],
    };

    const next = mergeLiveSnapshot(data, snapshot);
    expect(next.liveMatches[0].homeScore).toBe(2);
    expect(next.matches[0].homeScore).toBe(2);
    expect(next.liveMatches[0].minute).toBe(67);
  });

  it('fusiona lineup del snapshot WS sin congelar la cancha', () => {
    const data = {
      liveMatches: [
        {
          id: 'm1',
          status: 'live',
          lineup: { status: 'confirmed', home: { players: [{ name: 'Old XI' }] } },
        },
      ],
    };
    const snapshot = {
      liveMatches: [
        {
          id: 'm1',
          status: 'live',
          lineup: { status: 'confirmed', home: { players: [{ name: 'Fresh XI' }] } },
        },
      ],
    };

    const next = mergeLiveSnapshot(data, snapshot);
    expect(next.liveMatches[0].lineup.home.players[0].name).toBe('Fresh XI');
  });

  it('conserva eventos de cronología cuando el snapshot trae menos', () => {
    const goal47 = {
      type: 'goal',
      side: 'home',
      minute: 47,
      extraMinute: null,
      sortKey: 47,
      player: 'Cody Gakpo',
    };
    const periodEnd = {
      type: 'period_end',
      side: 'neutral',
      minute: 45,
      extraMinute: 5,
      sortKey: 45.05,
      phase: 'first',
    };
    const data = {
      liveMatches: [
        {
          id: 'm1',
          homeScore: 2,
          awayScore: 0,
          status: 'live',
          matchTimeline: [goal47, periodEnd],
        },
      ],
      recentFinishedMatches: [],
    };
    const snapshot = {
      liveMatches: [
        {
          id: 'm1',
          homeScore: 2,
          awayScore: 0,
          status: 'live',
          minute: 47,
          matchTimeline: [periodEnd],
        },
      ],
      recentFinishedMatches: [],
    };

    const next = mergeLiveSnapshot(data, snapshot);
    expect(next.liveMatches[0].matchTimeline).toHaveLength(2);
    expect(next.liveMatches[0].matchTimeline.some((e) => e.player === 'Cody Gakpo')).toBe(true);
    expect(next.liveMatches[0].minute).toBe(47);
  });

  it('no retrocede el reloj en vivo cuando el snapshot trae 45+5 y el dashboard 59', () => {
    const data = {
      liveMatches: [
        {
          id: 'm1',
          homeScore: 2,
          awayScore: 0,
          status: 'live',
          timeElapsed: "59'",
          raw: { time_elapsed: '59' },
          matchTimeline: [
            { type: 'goal', side: 'home', minute: 59, sortKey: 59, player: 'Gakpo' },
            {
              type: 'period_end',
              side: 'neutral',
              minute: 45,
              extraMinute: 5,
              sortKey: 45.05,
              phase: 'first',
            },
          ],
        },
      ],
      recentFinishedMatches: [],
    };
    const snapshot = {
      liveMatches: [
        {
          id: 'm1',
          homeScore: 2,
          awayScore: 0,
          status: 'live',
          timeElapsed: "45+5'",
          raw: { time_elapsed: '45+5' },
          matchTimeline: [
            {
              type: 'period_end',
              side: 'neutral',
              minute: 45,
              extraMinute: 5,
              sortKey: 45.05,
              phase: 'first',
            },
          ],
        },
      ],
      recentFinishedMatches: [],
    };

    const next = mergeLiveSnapshot(data, snapshot);
    expect(next.liveMatches[0].timeElapsed).toBe("59'");
    expect(next.liveMatches[0].raw.time_elapsed).toBe('59');
  });

  it('agrega partidos nuevos al snapshot', () => {
    const data = { liveMatches: [], recentFinishedMatches: [] };
    const snapshot = {
      liveMatches: [{ id: 'live-2', homeScore: 1, awayScore: 0, status: 'live' }],
      recentFinishedMatches: [{ id: 'fin-1', homeScore: 3, awayScore: 2, status: 'finished' }],
    };

    const next = mergeLiveSnapshot(data, snapshot);
    expect(next.liveMatches).toHaveLength(1);
    expect(next.recentFinishedMatches).toHaveLength(1);
  });
});

describe('mergeLiveDashboard', () => {
  it('conserva cronología acumulada en poll del dashboard', () => {
    const goal59 = {
      type: 'goal',
      side: 'home',
      minute: 59,
      sortKey: 59,
      player: 'Gakpo',
    };
    const prev = {
      leaderboard: [{ userId: 'u1', points: 10 }],
      liveMatches: [
        {
          id: 'm1',
          homeScore: 2,
          awayScore: 0,
          status: 'live',
          timeElapsed: "59'",
          raw: { time_elapsed: '59' },
          matchTimeline: [goal59],
        },
      ],
    };
    const next = {
      leaderboard: [{ userId: 'u1', points: 12 }],
      liveMatches: [
        {
          id: 'm1',
          homeScore: 2,
          awayScore: 0,
          status: 'live',
          timeElapsed: "45+5'",
          raw: { time_elapsed: '45+5' },
          matchTimeline: [
            {
              type: 'period_end',
              side: 'neutral',
              minute: 45,
              extraMinute: 5,
              sortKey: 45.05,
              phase: 'first',
            },
          ],
        },
      ],
    };

    const merged = mergeLiveDashboard(prev, next);
    expect(merged.leaderboard[0].points).toBe(12);
    expect(merged.liveMatches[0].matchTimeline).toHaveLength(2);
    expect(merged.liveMatches[0].timeElapsed).toBe("59'");
  });
});

describe('mergeTimelineEvents', () => {
  it('une por identidad y enriquece campos del snapshot', () => {
    const existing = [
      {
        type: 'goal',
        side: 'home',
        minute: 12,
        sortKey: 12,
        player: 'Gakpo',
      },
    ];
    const incoming = [
      {
        type: 'goal',
        side: 'home',
        minute: 12,
        sortKey: 12,
        player: 'Gakpo',
        playerPhotoUrl: 'https://cdn.example/gakpo.jpg',
      },
      {
        type: 'shot_attempt',
        side: 'away',
        minute: 45,
        extraMinute: 5,
        sortKey: 45.05,
        player: 'Ayari',
      },
    ];

    const merged = mergeTimelineEvents(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.find((e) => e.type === 'goal')?.playerPhotoUrl).toBe(
      'https://cdn.example/gakpo.jpg'
    );
  });
});

describe('mergeLiveMatchFields', () => {
  it('no pierde matchTimeline parcial al parchear marcador', () => {
    const existing = {
      id: 'm1',
      homeScore: 1,
      awayScore: 0,
      matchTimeline: [{ type: 'goal', side: 'home', minute: 10, sortKey: 10, player: 'A' }],
    };
    const incoming = {
      id: 'm1',
      homeScore: 2,
      awayScore: 0,
      matchTimeline: [],
    };

    const merged = mergeLiveMatchFields(existing, incoming);
    expect(merged.homeScore).toBe(2);
    expect(merged.matchTimeline).toHaveLength(1);
  });

  it('alinea marcador con goles en cronología (Elanga 59 → 2-1)', () => {
    const merged = mergeLiveMatchFields(
      {
        id: 'm1',
        homeScore: 2,
        awayScore: 0,
        status: 'live',
        timeElapsed: "59'",
        raw: { time_elapsed: '59' },
        matchTimeline: [
          { type: 'goal', side: 'home', minute: 47, sortKey: 47, player: 'Gakpo' },
          { type: 'goal', side: 'home', minute: 54, sortKey: 54, player: 'Gakpo' },
          { type: 'goal', side: 'away', minute: 59, sortKey: 59, player: 'Elanga' },
        ],
      },
      {
        id: 'm1',
        homeScore: 2,
        awayScore: 0,
        status: 'live',
        timeElapsed: "45+5'",
        raw: { time_elapsed: '45+5' },
        matchTimeline: [],
      }
    );

    expect(merged.homeScore).toBe(2);
    expect(merged.awayScore).toBe(1);
    expect(merged.timeElapsed).toBe("59'");
  });

  it('acepta marcador nuevo cuando el servidor va adelante (4-1 @ 78)', () => {
    const merged = mergeLiveMatchFields(
      {
        id: 'm1',
        homeScore: 2,
        awayScore: 1,
        status: 'live',
        timeElapsed: "59'",
        raw: { time_elapsed: '59' },
        matchTimeline: [{ type: 'goal', side: 'home', minute: 59, sortKey: 59, player: 'A' }],
      },
      {
        id: 'm1',
        homeScore: 4,
        awayScore: 1,
        status: 'live',
        timeElapsed: "78'",
        raw: { time_elapsed: '78' },
        matchTimeline: [
          { type: 'goal', side: 'home', minute: 10, sortKey: 10, player: 'A' },
          { type: 'goal', side: 'home', minute: 30, sortKey: 30, player: 'B' },
          { type: 'goal', side: 'home', minute: 50, sortKey: 50, player: 'C' },
          { type: 'goal', side: 'home', minute: 70, sortKey: 70, player: 'D' },
          { type: 'goal', side: 'away', minute: 40, sortKey: 40, player: 'E' },
        ],
      }
    );

    expect(merged.homeScore).toBe(4);
    expect(merged.awayScore).toBe(1);
    expect(merged.timeElapsed).toBe("78'");
    expect(merged.matchTimeline.filter((e) => e.type === 'goal')).toHaveLength(5);
  });

  it('muestra 78 cuando el marcador viene del servidor pero la cronología llega hasta 59', () => {
    const merged = mergeLiveMatchFields(
      {
        id: 'm1',
        homeScore: 2,
        awayScore: 1,
        status: 'live',
        timeElapsed: "59'",
        raw: { time_elapsed: '59' },
        matchTimeline: [
          { type: 'goal', side: 'home', minute: 47, sortKey: 47, player: 'Gakpo' },
          { type: 'goal', side: 'home', minute: 54, sortKey: 54, player: 'Gakpo' },
          { type: 'goal', side: 'away', minute: 59, sortKey: 59, player: 'Elanga' },
        ],
      },
      {
        id: 'm1',
        homeScore: 4,
        awayScore: 1,
        status: 'live',
        timeElapsed: "78'",
        minute: 78,
        raw: { time_elapsed: '78' },
        matchTimeline: [
          { type: 'goal', side: 'home', minute: 47, sortKey: 47, player: 'Gakpo' },
          { type: 'goal', side: 'home', minute: 54, sortKey: 54, player: 'Gakpo' },
          { type: 'goal', side: 'away', minute: 59, sortKey: 59, player: 'Elanga' },
        ],
      }
    );

    expect(merged.homeScore).toBe(4);
    expect(merged.awayScore).toBe(1);
    expect(merged.timeElapsed).toBe("78'");
  });

  it('corrige goles fantasma cuando el servidor manda 0-1 al mismo minuto', () => {
    const merged = mergeLiveMatchFields(
      {
        id: 'm1',
        homeScore: 1,
        awayScore: 2,
        status: 'live',
        timeElapsed: "30'",
        matchTimeline: [
          { type: 'goal', side: 'home', minute: 30, sortKey: 30, player: 'Musiala' },
          { type: 'goal', side: 'away', minute: 30, sortKey: 30, player: 'Kessie' },
          { type: 'goal', side: 'away', minute: 30, sortKey: 30, player: 'Kessie duplicate' },
        ],
      },
      {
        id: 'm1',
        homeScore: 0,
        awayScore: 1,
        status: 'live',
        timeElapsed: "30'",
        matchTimeline: [
          { type: 'goal', side: 'away', minute: 30, sortKey: 30, player: 'Kessie' },
        ],
      }
    );

    expect(merged.homeScore).toBe(0);
    expect(merged.awayScore).toBe(1);
    expect(merged.matchTimeline.filter((e) => e.type === 'goal')).toHaveLength(1);
  });
});

describe('realtimeSectors', () => {
  it('identifica reasons de partido en vivo', () => {
    expect(isLiveMatchReason('live_scoring_sync')).toBe(true);
    expect(isLiveMatchReason('prediction_saved')).toBe(false);
  });

  it('filtra sectores por tipo de evento', () => {
    expect(
      shouldRefreshSector(SECTOR_TAGS.WORLDCUP_PLAYERS, {
        type: REALTIME_EVENTS.PLAYERS_UPDATED,
      })
    ).toBe(true);
    expect(
      shouldRefreshSector(SECTOR_TAGS.WORLDCUP_PLAYERS, {
        type: REALTIME_EVENTS.MATCHES_UPDATED,
      })
    ).toBe(false);
    expect(
      shouldRefreshSector(SECTOR_TAGS.ADMIN_GROUPS, {
        type: REALTIME_EVENTS.LEADERBOARD_UPDATED,
      })
    ).toBe(false);
  });
});
