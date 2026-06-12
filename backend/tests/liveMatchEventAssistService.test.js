import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/models/Match.js', () => ({
  Match: {
    updateOne: vi.fn().mockResolvedValue({}),
    find: vi.fn(),
  },
}));

import { Match } from '../src/models/Match.js';
import {
  assistMatchEvents,
  computeAssistInputHash,
  findMissingRawEvents,
  isNamePlausible,
  normalizeTimelinePlayerNames,
  validateAssistedTimeline,
} from '../src/services/liveMatchEventAssistService.js';
import { timelineHash } from '../src/services/matchLiveData.js';

describe('liveMatchEventAssistService', () => {
  const homePlayers = [{ fullName: 'Julian Quinones' }];
  const awayPlayers = [{ fullName: 'Teboho Mokoena' }];

  describe('normalizeTimelinePlayerNames', () => {
    it('normaliza nombres contra el roster del equipo', () => {
      const timeline = normalizeTimelinePlayerNames(
        [{ type: 'goal', side: 'home', minute: 9, player: 'QUINONES' }],
        homePlayers,
        awayPlayers
      );

      expect(timeline[0].player).toBe('Julian Quinones');
    });

    it('agrega posición desde el roster', () => {
      const timeline = normalizeTimelinePlayerNames(
        [{ type: 'yellow_card', side: 'away', minute: 17, player: 'Mokoena' }],
        [{ fullName: 'Julian Quinones', position: 'FWD' }],
        [{ fullName: 'Teboho Mokoena', position: 'DEF' }]
      );

      expect(timeline[0].player).toBe('Teboho Mokoena');
      expect(timeline[0].playerPosition).toBe('DEF');
    });
  });

  describe('findMissingRawEvents', () => {
    it('detecta eventos FIFA omitidos por parser estricto', () => {
      const rawEvents = [
        {
          Type: 0,
          IdTeam: '43911',
          MatchMinute: "12'",
          EventDescription: [
            { Locale: 'en-GB', Description: 'Unknown format without regex match (Mexico)' },
          ],
        },
        {
          Type: 0,
          IdTeam: '43911',
          MatchMinute: "9'",
          EventDescription: [
            { Locale: 'en-GB', Description: 'Julian QUINONES (Mexico) scores!!' },
          ],
        },
      ];

      const timeline = [
        {
          type: 'goal',
          side: 'home',
          minute: 9,
          extraMinute: null,
          player: 'Julian QUINONES',
          sortKey: 9,
        },
      ];

      const missing = findMissingRawEvents(rawEvents, timeline, '43911', '43883');
      expect(missing).toHaveLength(1);
      expect(missing[0].entry.minute).toBe(12);
    });
  });

  describe('validateAssistedTimeline', () => {
    it('rechaza timelines con más goles que el marcador FIFA', () => {
      const original = [
        { type: 'goal', side: 'home', minute: 9, extraMinute: null, player: 'A' },
      ];
      const assisted = [
        ...original,
        { type: 'goal', side: 'home', minute: 12, extraMinute: null, player: 'B' },
      ];

      expect(
        validateAssistedTimeline(assisted, original, { homeScore: 1, awayScore: 0 })
      ).toBe(false);
    });

    it('acepta timeline que conserva eventos originales', () => {
      const original = [
        { type: 'goal', side: 'home', minute: 9, extraMinute: null, player: 'A' },
      ];
      const assisted = [
        { type: 'goal', side: 'home', minute: 9, extraMinute: null, player: 'Julian Quinones' },
      ];

      expect(
        validateAssistedTimeline(assisted, original, { homeScore: 1, awayScore: 0 })
      ).toBe(true);
    });
  });

  describe('isNamePlausible', () => {
    it('acepta nombres presentes en la descripción o roster', () => {
      expect(
        isNamePlausible(
          'Mokoena',
          'MOKOENA (South Africa) is booked by the referee.',
          awayPlayers
        )
      ).toBe(true);
      expect(isNamePlausible('Inventado X', 'MOKOENA is booked', awayPlayers)).toBe(false);
    });
  });

  describe('computeAssistInputHash', () => {
    it('cambia cuando entra un evento crudo nuevo', () => {
      const before = computeAssistInputHash([], [{ type: 'goal', side: 'home', minute: 1 }]);
      const after = computeAssistInputHash(
        [{ Type: 0, MatchMinute: "2'", IdTeam: '1' }],
        [
          { type: 'goal', side: 'home', minute: 1 },
          { type: 'goal', side: 'away', minute: 2 },
        ]
      );
      expect(before).not.toBe(after);
      expect(timelineHash([{ type: 'goal', side: 'home', minute: 1 }])).toBeTruthy();
    });
  });

  describe('assistMatchEvents', () => {
    it('recupera evento omitido con heurística y persiste timeline asistido', async () => {
      Match.updateOne.mockClear();

      const match = {
        _id: 'match1',
        externalId: '1',
        status: 'live',
        homeTeamId: 'h1',
        awayTeamId: 'a1',
        raw: {
          fifaMeta: { homeTeamId: '43911', awayTeamId: '43883', homeScore: 2, awayScore: 0 },
          fifaEvents: {
            timeline: [
              {
                type: 'goal',
                side: 'home',
                minute: 9,
                extraMinute: null,
                player: 'Julian QUINONES',
                sortKey: 9,
              },
            ],
            rawEvents: [
              {
                Type: 0,
                IdTeam: '43911',
                MatchMinute: "12'",
                EventDescription: [
                  {
                    Locale: 'en-GB',
                    Description: 'Julian Quinones scores for Mexico after a corner',
                  },
                ],
              },
              {
                Type: 0,
                IdTeam: '43911',
                MatchMinute: "9'",
                EventDescription: [
                  { Locale: 'en-GB', Description: 'Julian QUINONES (Mexico) scores!!' },
                ],
              },
            ],
          },
        },
      };

      const result = await assistMatchEvents(match, {
        homeTeam: { fifaCode: 'MEX' },
        awayTeam: { fifaCode: 'RSA' },
        homePlayers,
        awayPlayers,
      });

      expect(result.updated).toBe(true);
      expect(Match.updateOne).toHaveBeenCalled();
      const payload = Match.updateOne.mock.calls[0][1].$set['raw.fifaEvents'].timeline;
      expect(payload.some((event) => event.minute === 12 && event.type === 'goal')).toBe(true);
    });

    it('omite re-asistir cuando el hash ya está fresco', async () => {
      Match.updateOne.mockClear();

      const timeline = [
        { type: 'goal', side: 'home', minute: 9, extraMinute: null, player: 'Julian Quinones', sortKey: 9 },
      ];
      const rawEvents = [
        {
          Type: 0,
          IdTeam: '43911',
          MatchMinute: "9'",
          EventDescription: [
            { Locale: 'en-GB', Description: 'Julian QUINONES (Mexico) scores!!' },
          ],
        },
      ];
      const assistHash = computeAssistInputHash(rawEvents, timeline);

      const match = {
        _id: 'match2',
        externalId: '2',
        status: 'live',
        homeTeamId: 'h1',
        awayTeamId: 'a1',
        raw: {
          fifaMeta: { homeTeamId: '43911', awayTeamId: '43883', homeScore: 1, awayScore: 0 },
          fifaEvents: {
            timeline,
            rawEvents,
            assistHash,
            assistedAt: new Date().toISOString(),
          },
        },
      };

      const result = await assistMatchEvents(match, {
        homeTeam: { fifaCode: 'MEX' },
        awayTeam: { fifaCode: 'RSA' },
        homePlayers,
        awayPlayers,
      });

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('fresh_cache');
      expect(Match.updateOne).not.toHaveBeenCalled();
    });
  });
});
