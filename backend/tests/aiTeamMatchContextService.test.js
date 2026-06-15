import { describe, it, expect } from 'vitest';
import {
  aggregateTournamentStats,
  buildHeadToHeadInTournament,
  buildPowerMetricsFromStats,
  buildRecentTournamentResults,
  buildTeamMatchAnalysis,
  buildWorldCupPedigree,
  classifyDefensivePower,
  classifyOffensivePower,
  extractFifaRankingFromTeam,
} from '../src/services/aiTeamMatchContextService.js';

const teamById = {
  '1': { externalId: '1', nameEn: 'Mexico', fifaCode: 'MEX', group: 'A' },
  '2': { externalId: '2', nameEn: 'South Africa', fifaCode: 'RSA', group: 'A' },
  '3': { externalId: '3', nameEn: 'Argentina', fifaCode: 'ARG', group: 'B' },
};

const finishedMatches = [
  {
    externalId: '10',
    homeTeamId: '1',
    awayTeamId: '2',
    homeScore: 2,
    awayScore: 0,
    status: 'finished',
    group: 'A',
    type: 'group',
    kickoffAt: new Date('2026-06-12T18:00:00.000Z'),
  },
  {
    externalId: '11',
    homeTeamId: '3',
    awayTeamId: '1',
    homeScore: 1,
    awayScore: 1,
    status: 'finished',
    group: 'A',
    type: 'group',
    kickoffAt: new Date('2026-06-14T18:00:00.000Z'),
  },
];

describe('aiTeamMatchContextService', () => {
  describe('extractFifaRankingFromTeam', () => {
    it('usa ranking del seed por código FIFA', () => {
      expect(
        extractFifaRankingFromTeam({ fifaCode: 'ARG' }, { ARG: 1, MEX: 14 })
      ).toEqual({ rank: 1, source: 'fifa_ranking_jun_2026' });
    });

    it('resuelve alias KSA → SAU en el seed de rankings', () => {
      expect(
        extractFifaRankingFromTeam({ fifaCode: 'KSA' }, { SAU: 61 })
      ).toEqual({ rank: 61, source: 'fifa_ranking_jun_2026' });
    });

    it('lee ranking desde team.raw si existe', () => {
      expect(
        extractFifaRankingFromTeam({ fifaCode: 'XYZ', raw: { fifa_rank: 22 } }, {})
      ).toEqual({ rank: 22, source: 'team_api' });
    });
  });

  describe('aggregateTournamentStats', () => {
    it('suma goles y victorias del torneo', () => {
      const stats = aggregateTournamentStats('1', finishedMatches);
      expect(stats).toMatchObject({
        played: 2,
        wins: 1,
        draws: 1,
        losses: 0,
        goalsFor: 3,
        goalsAgainst: 1,
        cleanSheets: 1,
      });
    });
  });

  describe('buildRecentTournamentResults', () => {
    it('devuelve resultados más recientes primero', () => {
      const recent = buildRecentTournamentResults('1', finishedMatches, teamById);
      expect(recent).toHaveLength(2);
      expect(recent[0].score).toBe('1-1');
      expect(recent[1].score).toBe('2-0');
    });
  });

  describe('buildHeadToHeadInTournament', () => {
    it('lista enfrentamientos previos entre ambos', () => {
      const h2h = buildHeadToHeadInTournament('1', '2', finishedMatches, teamById);
      expect(h2h).toHaveLength(1);
      expect(h2h[0].score).toBe('2-0');
    });
  });

  describe('buildPowerMetricsFromStats', () => {
    it('calcula tiers ofensivo y defensivo', () => {
      const power = buildPowerMetricsFromStats({
        played: 2,
        goalsFor: 3,
        goalsAgainst: 1,
        cleanSheets: 1,
      });
      expect(power.offensive.tier).toBe(classifyOffensivePower(1.5));
      expect(power.defensive.tier).toBe(classifyDefensivePower(0.5));
    });
  });

  describe('buildWorldCupPedigree', () => {
    it('resume títulos y finales', () => {
      const pedigree = buildWorldCupPedigree('ARG', {
        titlesByNation: [{ fifaCode: 'ARG', titles: 3 }],
        finals: [{ year: 2022, winnerFifa: 'ARG', runnerUpFifa: 'FRA' }],
      });
      expect(pedigree).toEqual({
        worldCupTitles: 3,
        finalsPlayed: 1,
        lastFinalYear: 2022,
      });
    });
  });

  describe('buildTeamMatchAnalysis', () => {
    it('arma contexto completo del equipo', () => {
      const analysis = buildTeamMatchAnalysis(teamById['1'], {
        allMatches: finishedMatches,
        teamById,
        rankingsByCode: { MEX: 14 },
        standingsByGroup: [
          {
            group: 'A',
            standings: [
              {
                teamId: '1',
                rank: 1,
                played: 2,
                points: 4,
                goalsFor: 3,
                goalsAgainst: 1,
                goalDiff: 2,
              },
            ],
          },
        ],
        fixtureRole: 'local (solo fixture)',
      });

      expect(analysis.fifaRanking).toEqual({ rank: 14, source: 'fifa_ranking_jun_2026' });
      expect(analysis.power.offensive.goalsPerGame).toBe(1.5);
      expect(analysis.tournament2026.form).toBe('DW');
      expect(analysis.groupStanding.rank).toBe(1);
    });
  });
});
