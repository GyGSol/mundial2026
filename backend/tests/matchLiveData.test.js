import { describe, it, expect } from 'vitest';
import {
  enrichMatchLiveFields,
  formatTimeElapsed,
  parseScorersField,
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
      expect(formatTimeElapsed({ time_elapsed: 'ht' })).toBe('ET');
      expect(formatTimeElapsed({ time_elapsed: '45+2' })).toBe("45+2'");
    });

    it('ignora el literal live en el badge', () => {
      expect(formatTimeElapsed({ time_elapsed: 'live' })).toBeNull();
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
  });
});
