import { describe, expect, it } from 'vitest';
import { parseFifaMinute, parseFifaTimeline } from '../src/services/fifaTimelineParser.js';

describe('fifaTimelineParser', () => {
  describe('parseFifaMinute', () => {
    it('parsea minutos simples y tiempo añadido', () => {
      expect(parseFifaMinute("9'")).toEqual({ minute: 9, extraMinute: null, sortKey: 9 });
      expect(parseFifaMinute("90'+2'")).toEqual({ minute: 90, extraMinute: 2, sortKey: 90.02 });
    });
  });

  describe('parseFifaTimeline', () => {
    const timelineFixture = {
      Event: [
        {
          Type: 18,
          IdTeam: '43883',
          MatchMinute: "3'",
          EventDescription: [{ Locale: 'en-GB', Description: 'MODIBA (South Africa) commits a foul.' }],
        },
        {
          Type: 0,
          IdTeam: '43911',
          MatchMinute: "9'",
          EventDescription: [{ Locale: 'en-GB', Description: 'Julian QUINONES (Mexico) scores!!' }],
        },
        {
          Type: 2,
          IdTeam: '43883',
          MatchMinute: "17'",
          EventDescription: [{ Locale: 'en-GB', Description: 'MOKOENA (South Africa) is booked by the referee.' }],
        },
        {
          Type: 3,
          IdTeam: '43883',
          MatchMinute: "49'",
          EventDescription: [{ Locale: 'en-GB', Description: 'SITHOLE (South Africa) is sent off!' }],
        },
        {
          Type: 5,
          IdTeam: '43883',
          MatchMinute: "56'",
          EventDescription: [
            {
              Locale: 'en-GB',
              Description:
                'Thalente MBATHA (in) comes off the bench to replace Lyle FOSTER (out) (South Africa)',
            },
          ],
        },
        {
          Type: 0,
          IdTeam: '43911',
          MatchMinute: "67'",
          EventDescription: [{ Locale: 'en-GB', Description: 'RAÚL (Mexico) scores!!' }],
        },
        {
          Type: 3,
          IdTeam: '43911',
          MatchMinute: "90'+2'",
          EventDescription: [{ Locale: 'en-GB', Description: 'Cesar MONTES (Mexico) is sent off!' }],
        },
        {
          Type: 71,
          MatchMinute: "78'",
          EventDescription: [{ Locale: 'en-GB', Description: 'Goal disallowed' }],
        },
      ],
    };

    it('ordena goles, tarjetas, cambios y faltas por minuto', () => {
      const timeline = parseFifaTimeline(timelineFixture, '43911', '43883');

      expect(timeline.map((event) => event.type)).toEqual([
        'foul',
        'goal',
        'yellow_card',
        'red_card',
        'substitution',
        'goal',
        'goal_disallowed',
        'red_card',
      ]);

      expect(timeline[1]).toMatchObject({ minute: 9, type: 'goal', side: 'home', player: 'Julian QUINONES' });
      expect(timeline[4]).toMatchObject({
        minute: 56,
        type: 'substitution',
        side: 'away',
        playerIn: 'Thalente MBATHA',
        playerOut: 'Lyle FOSTER',
      });
      expect(timeline[6].sortKey).toBeGreaterThan(timeline[5].sortKey);
    });

    it('incluye pausas de hidratación y cambios de periodo', () => {
      const timeline = parseFifaTimeline(
        {
          Event: [
            {
              Type: 83,
              MatchMinute: "23'",
              EventDescription: [
                { Locale: 'en-GB', Description: 'Match paused for a hydration break' },
              ],
            },
            {
              Type: 8,
              MatchMinute: "45'+4'",
              EventDescription: [
                { Locale: 'en-GB', Description: 'The referee brings the first period to an end.' },
              ],
            },
            {
              Type: 7,
              MatchMinute: "45'",
              EventDescription: [
                { Locale: 'en-GB', Description: 'The referee signals the start of the second period.' },
              ],
            },
            {
              Type: 7,
              MatchMinute: "0'",
              EventDescription: [
                { Locale: 'en-GB', Description: 'The referee signals the start of the first period.' },
              ],
            },
          ],
        },
        'home',
        'away'
      );

      expect(timeline.map((event) => event.type)).toEqual([
        'hydration_break',
        'period_end',
        'period_start',
      ]);
      expect(timeline[0]).toMatchObject({ type: 'hydration_break', minute: 23 });
      expect(timeline[1]).toMatchObject({ type: 'period_end', phase: 'first', minute: 45, extraMinute: 4 });
      expect(timeline[2]).toMatchObject({ type: 'period_start', phase: 'second', minute: 45 });
    });
  });
});
