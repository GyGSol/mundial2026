import { describe, it, expect } from 'vitest';
import {
  completeTimelineEvents,
  deduplicateTimelineGoals,
  enrichMatchLiveFields,
  formatTimeElapsed,
  latestClockFromTimeline,
  parseElapsedClockToSortKey,
  resolveLiveTimeElapsed,
  goalCountsFromTimeline,
  isPlausibleMatchGoalCount,
  mergePlausibleGoalCounts,
  parseBookingsField,
  parseScorersField,
  readMatchTimeline,
  readFifaAuthoritativeScores,
  resolveEffectiveLiveScores,
  sanitizeMatchScores,
  scorersFromTimeline,
  splitFootballDataEvents,
} from '../src/services/matchLiveData.js';

describe('matchLiveData', () => {
  describe('formatTimeElapsed', () => {
    it('ignora notstarted y valores vacíos', () => {
      expect(formatTimeElapsed({ time_elapsed: 'notstarted' })).toBeNull();
      expect(formatTimeElapsed({ time_elapsed: '0' })).toBeNull();
      expect(formatTimeElapsed(null)).toBeNull();
    });

    it('formatea minutos numéricos', () => {
      expect(formatTimeElapsed({ time_elapsed: '45' })).toBe("45'");
      expect(formatTimeElapsed('67')).toBe("67'");
    });

    it('formatea descanso y tiempo añadido', () => {
      expect(formatTimeElapsed({ time_elapsed: 'ht' })).toBe('Entretiempo');
      expect(formatTimeElapsed({ time_elapsed: '45+2' })).toBe("45+2'");
    });

    it('ignora el literal live en el badge', () => {
      expect(formatTimeElapsed({ time_elapsed: 'live' })).toBeNull();
    });
  });

  describe('latestClockFromTimeline', () => {
    it('incluye tiempo añadido del último evento', () => {
      expect(
        latestClockFromTimeline([
          { minute: 88, extraMinute: null, sortKey: 88 },
          { minute: 90, extraMinute: 3, sortKey: 90.03 },
        ])
      ).toBe("90+3'");
    });
  });

  describe('resolveLiveTimeElapsed', () => {
    it('prefiere cronología cuando la API solo marca el minuto base', () => {
      expect(
        resolveLiveTimeElapsed({ time_elapsed: '90' }, [
          { minute: 90, extraMinute: 2, sortKey: 90.02 },
        ])
      ).toBe("90+2'");
    });

    it('respeta entretiempo de la API', () => {
      expect(resolveLiveTimeElapsed({ time_elapsed: 'ht' }, [{ minute: 45, extraMinute: 1 }])).toBe(
        'Entretiempo'
      );
    });
  });

  describe('parseElapsedClockToSortKey', () => {
    it('ordena minuto con añadido después del base', () => {
      expect(parseElapsedClockToSortKey("90+3'")).toBeGreaterThan(parseElapsedClockToSortKey("90'"));
    });
  });

  describe('parseScorersField', () => {
    it('trata "null" como vacío', () => {
      expect(parseScorersField('null')).toEqual([]);
      expect(parseScorersField(null)).toEqual([]);
    });

    it('parsea JSON con nombre y minuto', () => {
      expect(
        parseScorersField('[{"player":"Lozano","minute":23},{"name":"Jiménez","time":67}]')
      ).toEqual([
        { name: 'Lozano', minute: 23 },
        { name: 'Jiménez', minute: 67 },
      ]);
    });

    it('parsea texto delimitado por comas', () => {
      expect(parseScorersField("Lozano 23', Jiménez 67'")).toEqual([
        { name: 'Lozano', minute: 23 },
        { name: 'Jiménez', minute: 67 },
      ]);
    });

    it('parsea pseudo-objeto con comillas sin comas', () => {
      expect(parseScorersField('{"J. Quiñones 9\'" "R. Jiménez 67\'"}')).toEqual([
        { name: 'J. Quiñones', minute: 9 },
        { name: 'R. Jiménez', minute: 67 },
      ]);
    });

    it('parsea pseudo-objeto con comillas tipográficas de worldcup26', () => {
      expect(parseScorersField('{“J. Quiñones 9’”,“R. Jiménez 67’”}')).toEqual([
        { name: 'J. Quiñones', minute: 9 },
        { name: 'R. Jiménez', minute: 67 },
      ]);
    });

    it('parsea goleador con penal al final del texto', () => {
      expect(parseScorersField("Breel Embolo 17' (p)")).toEqual([
        { name: 'Breel Embolo', minute: 17, isPenalty: true },
      ]);
    });
  });

  describe('enrichMatchLiveFields', () => {
    it('expone minuto y goleadores solo en live/finished', () => {
      const live = enrichMatchLiveFields({
        status: 'live',
        raw: {
          time_elapsed: '34',
          home_scorers: "Lozano 12'",
          away_scorers: 'null',
        },
      });

      expect(live.timeElapsed).toBe("34'");
      expect(live.homeScorers).toEqual([{ name: 'Lozano', minute: 12 }]);
      expect(live.awayScorers).toEqual([]);
    });

    it('marca Final en partidos terminados', () => {
      const finished = enrichMatchLiveFields({
        status: 'finished',
        raw: {
          home_scorers: "Lozano 12'",
          away_scorers: 'null',
        },
      });

      expect(finished.timeElapsed).toBe('Final');
      expect(finished.homeScorers).toEqual([{ name: 'Lozano', minute: 12 }]);
    });

    it('no expone datos en upcoming', () => {
      const upcoming = enrichMatchLiveFields({
        status: 'upcoming',
        raw: { time_elapsed: 'notstarted', home_scorers: "Lozano 12'" },
      });

      expect(upcoming.timeElapsed).toBeNull();
      expect(upcoming.homeScorers).toEqual([]);
      expect(upcoming.awayScorers).toEqual([]);
      expect(upcoming.homeBookings).toEqual([]);
    });
  });

  describe('splitFootballDataEvents', () => {
    it('separa tarjetas y cambios por equipo', () => {
      const events = splitFootballDataEvents(
        {
          bookings: [
            {
              minute: 11,
              team: { id: 10 },
              player: { name: 'Player A' },
              card: 'YELLOW',
            },
            {
              minute: 78,
              team: { id: 20 },
              player: { name: 'Player B' },
              card: 'RED',
            },
          ],
          substitutions: [
            {
              minute: 60,
              team: { id: 10 },
              playerOut: { name: 'Out A' },
              playerIn: { name: 'In A' },
            },
          ],
        },
        10,
        20
      );

      expect(events.homeBookings).toEqual([
        { minute: 11, player: 'Player A', card: 'YELLOW' },
      ]);
      expect(events.awayBookings).toEqual([{ minute: 78, player: 'Player B', card: 'RED' }]);
      expect(events.homeSubstitutions).toEqual([
        { minute: 60, playerOut: 'Out A', playerIn: 'In A' },
      ]);
    });

    it('enriquece partido live con eventos guardados', () => {
      const live = enrichMatchLiveFields({
        status: 'live',
        raw: {
          time_elapsed: '67',
          fdEvents: {
            homeBookings: [{ minute: 45, player: 'López', card: 'YELLOW' }],
            awayBookings: [],
            homeSubstitutions: [],
            awaySubstitutions: [{ minute: 70, playerOut: 'Smith', playerIn: 'Jones' }],
          },
        },
      });

      expect(live.homeBookings).toHaveLength(1);
      expect(live.awaySubstitutions).toHaveLength(1);
    });

    it('lee tarjetas desde home_bookings de worldcup26', () => {
      const finished = enrichMatchLiveFields({
        status: 'finished',
        raw: {
          home_bookings: '{"45\' López YELLOW","78\' Pérez RED"}',
        },
      });

      expect(finished.homeBookings).toEqual([
        { minute: 45, player: 'López', card: 'YELLOW' },
        { minute: 78, player: 'Pérez', card: 'RED' },
      ]);
    });
  });

  describe('parseBookingsField', () => {
    it('detecta amarilla y roja en texto', () => {
      expect(parseBookingsField("45' López YELLOW, 78' Pérez RED")).toEqual([
        { minute: 45, player: 'López', card: 'YELLOW' },
        { minute: 78, player: 'Pérez', card: 'RED' },
      ]);
    });
  });
  describe('readMatchTimeline', () => {
    it('prioriza fifaEvents.timeline sobre legacy', () => {
      const timeline = readMatchTimeline({
        fifaEvents: {
          timeline: [{ sortKey: 9, minute: 9, type: 'goal', side: 'home', player: 'QUINONES' }],
        },
        home_scorers: "Otro 12'",
      });

      expect(timeline).toHaveLength(1);
      expect(timeline[0].player).toBe('QUINONES');
    });

    it('enrich expone matchTimeline en partidos finished', () => {
      const finished = enrichMatchLiveFields({
        status: 'finished',
        raw: {
          fifaEvents: {
            timeline: [
              { sortKey: 67, minute: 67, type: 'goal', side: 'home', player: 'Jiménez' },
              { sortKey: 76, minute: 76, type: 'substitution', side: 'home', playerIn: 'Vega', playerOut: 'Quinones' },
            ],
          },
        },
      });

      expect(finished.matchTimeline).toHaveLength(2);
      expect(finished.matchTimeline[0].type).toBe('goal');
    });

    it('enrich usa goles del timeline FIFA cuando worldcup26 no publicó goleadores', () => {
      const live = enrichMatchLiveFields({
        status: 'live',
        homeScore: 0,
        awayScore: 0,
        raw: {
          fifaEvents: {
            timeline: [
              { sortKey: 59, minute: 59, type: 'goal', side: 'away', player: 'Krejci' },
              { sortKey: 67, minute: 67, type: 'goal', side: 'home', player: 'Hwang Inbeom' },
            ],
          },
        },
      });

      expect(live.homeScore).toBe(1);
      expect(live.awayScore).toBe(1);
      expect(live.homeScorers).toEqual([
        { name: 'Hwang Inbeom', minute: 67, position: null, shirtNumber: null, positionX: null, positionY: null },
      ]);
      expect(live.awayScorers).toEqual([
        { name: 'Krejci', minute: 59, position: null, shirtNumber: null, positionX: null, positionY: null },
      ]);
      expect(live.timeElapsed).toBe("67'");
    });

    it('enrich muestra tiempo añadido desde cronología FIFA', () => {
      const live = enrichMatchLiveFields({
        status: 'live',
        homeScore: 1,
        awayScore: 1,
        raw: {
          time_elapsed: '90',
          fifaEvents: {
            timeline: [
              { sortKey: 90.02, minute: 90, extraMinute: 2, type: 'yellow_card', side: 'home', player: 'A' },
            ],
          },
        },
      });

      expect(live.timeElapsed).toBe("90+2'");
    });
  });

  describe('goalCountsFromTimeline', () => {
    it('cuenta goles por lado', () => {
      expect(
        goalCountsFromTimeline([
          { type: 'goal', side: 'home' },
          { type: 'goal', side: 'away' },
          { type: 'foul', side: 'home' },
        ])
      ).toEqual({ home: 1, away: 1 });
    });
  });

  describe('scorersFromTimeline', () => {
    it('arma goleadores con minuto', () => {
      expect(
        scorersFromTimeline([{ type: 'goal', side: 'away', player: 'Krejci', minute: 59 }]).away
      ).toEqual([
        { name: 'Krejci', minute: 59, position: null, shirtNumber: null, positionX: null, positionY: null },
      ]);
    });
  });

  describe('resolveEffectiveLiveScores', () => {
    it('no baja el marcador guardado', () => {
      expect(
        resolveEffectiveLiveScores(
          { homeScore: 2, awayScore: 0 },
          [{ type: 'goal', side: 'home' }]
        )
      ).toEqual({ homeScore: 2, awayScore: 0 });
    });

    it('prioriza marcador FIFA sobre worldcup26 tras gol anulado', () => {
      expect(
        resolveEffectiveLiveScores(
          { homeScore: 2, awayScore: 2 },
          [{ type: 'goal', side: 'away' }, { type: 'goal', side: 'home' }, { type: 'goal', side: 'home' }],
          {
            fifaMeta: {
              homeScore: 2,
              awayScore: 1,
              syncedAt: '2026-06-12T03:00:00.000Z',
            },
          }
        )
      ).toEqual({ homeScore: 2, awayScore: 1 });
    });

    it('ignora marcadores corruptos (año persa 1405) y usa la cronología', () => {
      expect(
        resolveEffectiveLiveScores(
          { homeScore: 1405, awayScore: 1 },
          [{ type: 'goal', side: 'away', minute: 12 }]
        )
      ).toEqual({ homeScore: 0, awayScore: 1 });
    });
  });

  describe('score sanitization', () => {
    it('rechaza el año persa 1405 como marcador', () => {
      expect(isPlausibleMatchGoalCount(1405)).toBe(false);
      expect(sanitizeMatchScores(1405, 1)).toEqual({ homeScore: 0, awayScore: 1 });
    });

    it('mergePlausibleGoalCounts descarta valores corruptos', () => {
      expect(mergePlausibleGoalCounts(1405, 0, 1)).toBe(1);
      expect(mergePlausibleGoalCounts(1405, 0)).toBe(0);
    });
  });

  describe('completeTimelineEvents', () => {
    it('agrega goles faltantes según marcador y goleadores', () => {
      const timeline = completeTimelineEvents(
        [{ type: 'goal', side: 'home', minute: 31, player: 'Balogun', sortKey: 31 }],
        {
          homeScorers: [{ name: 'Pulisic', minute: 12 }],
          homeScore: 2,
          awayScore: 0,
        }
      );

      expect(goalCountsFromTimeline(timeline)).toEqual({ home: 2, away: 0 });
      expect(timeline.some((event) => event.player === 'Pulisic' && event.minute === 12)).toBe(true);
    });

    it('incluye goles sin jugador parseado', () => {
      const timeline = completeTimelineEvents(
        [{ type: 'goal', side: 'home', minute: 9, player: null, sortKey: 9 }],
        { homeScore: 1, awayScore: 0 }
      );

      expect(timeline).toHaveLength(1);
      expect(timeline[0].player).toBeNull();
    });

    it('no agrega goles fantasma sin minuto cuando el marcador supera la cronología', () => {
      const timeline = completeTimelineEvents(
        [
          { type: 'foul', side: 'away', minute: 7, player: 'Embolo', sortKey: 7 },
          { type: 'period_start', side: null, minute: 0, phase: 'first', sortKey: 0 },
        ],
        { homeScore: 0, awayScore: 1 }
      );

      expect(goalCountsFromTimeline(timeline)).toEqual({ home: 0, away: 0 });
      expect(timeline.every((event) => event.type !== 'goal' || event.minute != null)).toBe(true);
    });

    it('ubica el gol de penal desde away_scorers en el minuto correcto', () => {
      const timeline = completeTimelineEvents(
        [
          { type: 'foul', side: 'away', minute: 7, player: 'Embolo', sortKey: 7 },
          { type: 'yellow_card', side: 'home', minute: 16, player: 'Abunada', sortKey: 16 },
          { type: 'period_start', side: null, minute: 0, phase: 'first', sortKey: 0 },
        ],
        {
          awayScorers: [{ name: "Breel Embolo 17' (p)" }],
          homeScore: 0,
          awayScore: 1,
        }
      );

      const goal = timeline.find((event) => event.type === 'goal');
      expect(goal).toMatchObject({
        side: 'away',
        minute: 17,
        player: 'Breel Embolo',
        isPenalty: true,
        sortKey: 17,
      });
    });

    it('no duplica goles FIFA y worldcup26 con distinta ortografía en el mismo minuto', () => {
      const timeline = completeTimelineEvents(
        [
          {
            type: 'goal',
            side: 'home',
            minute: 32,
            player: 'Ramin Rezaeian',
            playerPosition: 'DFC',
            playerShirtNumber: 23,
            sortKey: 32,
          },
        ],
        {
          homeScorers: [{ name: 'Ramin Rzaiian', minute: 32 }],
          homeScore: 1,
          awayScore: 0,
        }
      );

      const homeGoals = timeline.filter((event) => event.type === 'goal' && event.side === 'home');
      expect(homeGoals).toHaveLength(1);
      expect(homeGoals[0].player).toBe('Ramin Rezaeian');
      expect(homeGoals[0].playerShirtNumber).toBe(23);
    });

    it('deduplicateTimelineGoals conserva el evento con más metadatos', () => {
      const timeline = deduplicateTimelineGoals([
        { type: 'goal', side: 'away', minute: 54, player: 'Ali Jast', sortKey: 54 },
        {
          type: 'goal',
          side: 'away',
          minute: 54,
          player: 'Eli Just',
          playerPosition: 'DC',
          playerShirtNumber: 11,
          sortKey: 54,
        },
      ]);

      expect(timeline.filter((event) => event.type === 'goal')).toHaveLength(1);
      expect(timeline[0].player).toBe('Eli Just');
      expect(timeline[0].playerShirtNumber).toBe(11);
    });
  });

  describe('readFifaAuthoritativeScores', () => {
    it('devuelve null sin syncedAt', () => {
      expect(readFifaAuthoritativeScores({ fifaMeta: { homeScore: 2, awayScore: 1 } })).toBeNull();
    });

    it('devuelve null con marcadores implausibles', () => {
      expect(
        readFifaAuthoritativeScores({
          fifaMeta: { homeScore: 1405, awayScore: 1, syncedAt: '2026-06-13T20:00:00.000Z' },
        })
      ).toBeNull();
    });
  });

});
