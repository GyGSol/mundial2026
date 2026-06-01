import { describe, it, expect } from 'vitest';
import {
  mapGameStatus,
  normalizeGame,
  normalizeTeam,
} from '../src/services/worldCupApiClient.js';

const sampleGame = {
  _id: '679c9c8a5749c4077500e014',
  id: '14',
  home_team_id: '29',
  away_team_id: '30',
  home_score: '0',
  away_score: '0',
  group: 'H',
  matchday: '1',
  local_date: '06/15/2026 12:00',
  stadium_id: '14',
  finished: 'FALSE',
  time_elapsed: 'notstarted',
  type: 'group',
};

const sampleTeam = {
  _id: '679c9c8a5749c4077500e001',
  id: '1',
  name_en: 'Mexico',
  name_fa: 'مکزیک',
  fifa_code: 'MEX',
  groups: 'A',
  flag: '🇲🇽',
};

describe('worldCupApiClient normalization', () => {
  it('normaliza un partido de worldcup26.ir', () => {
    const game = normalizeGame(sampleGame);
    expect(game.externalId).toBe('14');
    expect(game.homeTeamId).toBe('29');
    expect(game.awayTeamId).toBe('30');
    expect(game.homeScore).toBe(0);
    expect(game.status).toBe('upcoming');
    expect(game.group).toBe('H');
  });

  it('calcula kickoffAt desde local_date y zona del estadio', () => {
    const game = normalizeGame(sampleGame, { stadiumTimezone: 'America/New_York' });
    expect(game.kickoffAt.toISOString()).toBe('2026-06-15T16:00:00.000Z');
    expect(game.kickoffTimezone).toBe('America/New_York');
  });

  it('detecta partido finalizado desde finished=TRUE', () => {
    expect(mapGameStatus({ ...sampleGame, finished: 'TRUE' })).toBe('finished');
  });

  it('detecta partido en vivo por time_elapsed', () => {
    expect(mapGameStatus({ ...sampleGame, time_elapsed: '45' })).toBe('live');
  });

  it('normaliza un equipo con 48 entradas típicas', () => {
    const team = normalizeTeam(sampleTeam);
    expect(team.externalId).toBe('1');
    expect(team.nameEn).toBe('Mexico');
    expect(team.fifaCode).toBe('MEX');
    expect(team.group).toBe('A');
  });
});

describe('worldCupApiClient live API', () => {
  it('obtiene equipos y partidos desde la API pública', async () => {
    const [gamesRes, teamsRes] = await Promise.all([
      fetch('https://worldcup26.ir/get/games'),
      fetch('https://worldcup26.ir/get/teams'),
    ]);

    expect(gamesRes.ok).toBe(true);
    expect(teamsRes.ok).toBe(true);

    const gamesPayload = await gamesRes.json();
    const teamsPayload = await teamsRes.json();
    const games = gamesPayload.games ?? gamesPayload;
    const teams = teamsPayload.teams ?? teamsPayload;

    expect(games.length).toBeGreaterThan(0);
    expect(teams.length).toBe(48);

    const firstGame = normalizeGame(games[0]);
    const firstTeam = normalizeTeam(teams[0]);
    expect(firstGame.externalId).toBeTruthy();
    expect(firstTeam.nameEn).toBeTruthy();
  }, 15000);
});
