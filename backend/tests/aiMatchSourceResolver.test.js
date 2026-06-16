import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/aiPredictionService.js', () => ({
  hasAiProvider: vi.fn(() => true),
  callAiForJson: vi.fn(),
}));

vi.mock('../src/models/Match.js', () => ({
  Match: {
    updateOne: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../src/models/Team.js', () => ({
  Team: {
    find: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue([
        { fifaCode: 'IRN' },
        { fifaCode: 'NZL' },
        { fifaCode: 'BEL' },
        { fifaCode: 'EGY' },
      ]),
    })),
  },
}));

import { callAiForJson, hasAiProvider } from '../src/services/aiPredictionService.js';
import { Match } from '../src/models/Match.js';
import {
  buildMatchSourceDisputePrompt,
  validateAiSourceVerdict,
  resolveMatchSourceDispute,
  resolveAndApplySourceDisputes,
} from '../src/services/aiMatchSourceResolverService.js';

const irnNzlDispute = {
  externalId: '15',
  type: 'teams_mismatch',
  summary: 'Payload worldcup26 id=15 describe BEL-EGY, slot FIFA 15 es IRN-NZL',
  matchId: 'match-15',
  fifa: {
    externalId: '15',
    group: 'G',
    matchday: '1',
    homeCode: 'IRN',
    awayCode: 'NZL',
    homeName: 'Iran',
    awayName: 'New Zealand',
    kickoffAtUtc: '2026-06-16T01:00:00.000Z',
  },
  official: { kickoffAtUtc: '2026-06-16T01:00:00.000Z' },
  db: {
    homeCode: 'IRN',
    awayCode: 'NZL',
    homeName: 'Iran',
    awayName: 'New Zealand',
    kickoffAtUtc: '2026-06-16T01:00:00.000Z',
    status: 'live',
  },
  wc26: {
    id: '15',
    homeName: 'Belgium',
    awayName: 'Egypt',
    localDate: '06/15/2026 12:00',
    finished: 'TRUE',
    timeElapsed: 'finished',
  },
  stadium: {
    nameEn: 'SoFi Stadium',
    city: 'Inglewood',
    country: 'USA',
    timezone: 'America/Los_Angeles',
  },
};

describe('aiMatchSourceResolverService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasAiProvider.mockReturnValue(true);
  });

  it('arma prompt con id worldcup26 y slot FIFA explícitos', () => {
    const prompt = buildMatchSourceDisputePrompt(irnNzlDispute);
    expect(prompt).toContain('MatchNumber / externalId: 15');
    expect(prompt).toContain('worldcup26 game id: 15');
    expect(prompt).toContain('NO confundir con MatchNumber FIFA');
    expect(prompt).toContain('Belgium');
    expect(prompt).toContain('Iran');
  });

  it('acepta veredicto IA correcto IRN-NZL', () => {
    const teamCodes = new Set(['IRN', 'NZL', 'BEL', 'EGY']);
    const result = validateAiSourceVerdict(
      {
        homeFifaCode: 'IRN',
        awayFifaCode: 'NZL',
        kickoffAtUtc: '2026-06-16T01:00:00.000Z',
        confidence: 'high',
        reason: 'FIFA match 15',
      },
      irnNzlDispute,
      { teamCodes }
    );
    expect(result.ok).toBe(true);
  });

  it('rechaza veredicto IA con par incorrecto', () => {
    const teamCodes = new Set(['IRN', 'NZL', 'BEL', 'EGY']);
    const result = validateAiSourceVerdict(
      {
        homeFifaCode: 'BEL',
        awayFifaCode: 'EGY',
        kickoffAtUtc: '2026-06-16T01:00:00.000Z',
        confidence: 'high',
      },
      irnNzlDispute,
      { teamCodes }
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('par_no_coincide_con_fifa_ni_db');
  });

  it('resuelve disputa teams_mismatch sin reescribir equipos', async () => {
    callAiForJson.mockResolvedValue({
      data: {
        homeFifaCode: 'IRN',
        awayFifaCode: 'NZL',
        kickoffAtUtc: '2026-06-16T01:00:00.000Z',
        confidence: 'high',
        reason: 'FIFA prevalece',
      },
      source: 'mock',
    });

    const teamCodes = new Set(['IRN', 'NZL', 'BEL', 'EGY']);
    const result = await resolveMatchSourceDispute(irnNzlDispute, { teamCodes });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe('equipos_ya_alineados_ignorar_wc26');
    expect(Match.updateOne).not.toHaveBeenCalled();
  });

  it('actualiza kickoff en disputa kickoff_mismatch validada', async () => {
    callAiForJson.mockResolvedValue({
      data: {
        homeFifaCode: 'IRN',
        awayFifaCode: 'NZL',
        kickoffAtUtc: '2026-06-16T01:00:00.000Z',
        confidence: 'high',
        reason: 'Fixture oficial',
      },
      source: 'mock',
    });

    const kickoffDispute = { ...irnNzlDispute, type: 'kickoff_mismatch' };
    const teamCodes = new Set(['IRN', 'NZL']);
    const result = await resolveMatchSourceDispute(kickoffDispute, { teamCodes });

    expect(result.applied).toBe(true);
    expect(Match.updateOne).toHaveBeenCalledWith(
      { _id: 'match-15' },
      expect.objectContaining({
        $set: expect.objectContaining({ kickoffAt: expect.any(Date) }),
      })
    );
  });

  it('sin proveedor IA solo registra conflicto', async () => {
    hasAiProvider.mockReturnValue(false);
    const results = await resolveAndApplySourceDisputes([irnNzlDispute]);
    expect(results[0].aiSkipped).toBe(true);
    expect(callAiForJson).not.toHaveBeenCalled();
  });
});
