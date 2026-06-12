import { describe, it, expect } from 'vitest';
import {
  enrichMatchLiveFields,
  formatTimeElapsed,
  latestClockFromTimeline,
  parseElapsedClockToSortKey,
  resolveLiveTimeElapsed,
  goalCountsFromTimeline,
  parseBookingsField,
  parseScorersField,
  readMatchTimeline,
  readFifaAuthoritativeScores,
  resolveEffectiveLiveScores,
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
      expect(live.homeScorers).toEqual([{ name: 'Hwang Inbeom', minute: 67, position: null }]);
      expect(live.awayScorers).toEqual([{ name: 'Krejci', minute: 59, position: null }]);
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
      ).toEqual([{ name: 'Krejci', minute: 59, position: null }]);
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
  });

  describe('readFifaAuthoritativeScores', () => {
    it('devuelve null sin syncedAt', () => {
      expect(readFifaAuthoritativeScores({ fifaMeta: { homeScore: 2, awayScore: 1 } })).toBeNull();
    });
  });

});
