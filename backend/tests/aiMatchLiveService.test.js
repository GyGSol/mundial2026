import { describe, it, expect } from 'vitest';
import {
  buildLiveMatchAiContext,
  normalizeLiveBriefingPayload,
  timelineHash,
} from '../src/services/aiMatchLiveService.js';

describe('aiMatchLiveService', () => {
  describe('buildLiveMatchAiContext', () => {
    it('serializa timeline con etiquetas legibles', () => {
      const context = buildLiveMatchAiContext(
        { status: 'live', homeTeamId: 'A', awayTeamId: 'B', group: 'A', type: 'group' },
        { fifaCode: 'MEX', nameEn: 'Mexico' },
        { fifaCode: 'RSA', nameEn: 'South Africa' },
        {
          timeElapsed: "34'",
          homeScore: 1,
          awayScore: 0,
          matchTimeline: [
            { minute: 9, type: 'goal', side: 'home', player: 'Quinones' },
            { minute: 17, type: 'yellow_card', side: 'away', player: 'Mokoena' },
          ],
          fifaReportStats: null,
        }
      );

      expect(context.timeline).toHaveLength(2);
      expect(context.timeline[0].label).toContain('Gol');
      expect(context.score).toEqual({ home: 1, away: 0 });
    });
  });

  describe('normalizeLiveBriefingPayload', () => {
    it('filtra momentos vacios y normaliza momentum', () => {
      const normalized = normalizeLiveBriefingPayload({
        headline: 'México arriba',
        summary: 'Gol tempranero definió el arranque.',
        keyMoments: [{ minute: 9, text: 'Gol de Quinones' }, { text: '' }],
        momentum: 'home',
        discipline: 'Una amarilla',
        tacticalNote: '',
        whatToWatch: 'Respuesta de Sudáfrica',
      });

      expect(normalized.keyMoments).toHaveLength(1);
      expect(normalized.momentum).toBe('home');
    });
  });

  describe('timelineHash', () => {
    it('cambia cuando entra un evento nuevo', () => {
      const before = timelineHash([{ type: 'goal', side: 'home', minute: 1, player: 'A' }]);
      const after = timelineHash([
        { type: 'goal', side: 'home', minute: 1, player: 'A' },
        { type: 'goal', side: 'away', minute: 2, player: 'B' },
      ]);
      expect(before).not.toBe(after);
    });
  });
});
