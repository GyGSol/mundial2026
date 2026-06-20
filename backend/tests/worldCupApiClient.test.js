import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchWithRetry,
  mapGameStatus,
  normalizeGame,
  normalizeTeam,
  resolveGameStatus,
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

  it('descarta marcadores corruptos al normalizar', () => {
    const game = normalizeGame({ ...sampleGame, home_score: '1405', away_score: '1' });
    expect(game.homeScore).toBe(0);
    expect(game.awayScore).toBe(1);
  });

  it('calcula kickoffAt desde fixture oficial Argentina', () => {
    const game = normalizeGame({ ...sampleGame, id: '14' });
    expect(game.kickoffAt.toISOString()).toBe('2026-06-15T16:00:00.000Z');
  });

  it('calcula kickoffAt desde local_date y zona del estadio si no hay fixture oficial', () => {
    const game = normalizeGame({ ...sampleGame, id: 'demo-x' }, { stadiumTimezone: 'America/New_York' });
    expect(game.kickoffAt.toISOString()).toBe('2026-06-15T16:00:00.000Z');
    expect(game.kickoffTimezone).toBe('America/New_York');
  });

  it('detecta partido finalizado desde finished=TRUE', () => {
    expect(mapGameStatus({ ...sampleGame, finished: 'TRUE' })).toBe('finished');
  });

  it('detecta partido en vivo por time_elapsed', () => {
    expect(mapGameStatus({ ...sampleGame, time_elapsed: '45' })).toBe('live');
  });

  it('detecta partido finalizado por time_elapsed ft/fulltime', () => {
    expect(mapGameStatus({ ...sampleGame, time_elapsed: 'ft', finished: 'FALSE' })).toBe('finished');
    expect(mapGameStatus({ ...sampleGame, time_elapsed: 'fulltime', finished: 'FALSE' })).toBe(
      'finished'
    );
  });

  it('no fuerza finished tras kickoff stale si el partido sigue en curso', () => {
    const kickoff = new Date('2026-06-17T20:00:00.000Z');
    const now = kickoff.getTime() + 130 * 60 * 1000;

    expect(
      resolveGameStatus(
        {
          finished: 'FALSE',
          time_elapsed: '67',
          home_score: '0',
          away_score: '1',
        },
        kickoff,
        { now }
      )
    ).toBe('live');
  });

  it('reabre finished prematuro de worldcup26 con timeline en curso', () => {
    const kickoff = new Date('2026-06-17T20:00:00.000Z');
    const now = kickoff.getTime() + 10 * 60 * 1000;

    expect(
      resolveGameStatus(
        {
          finished: 'TRUE',
          time_elapsed: 'final',
          home_score: '0',
          away_score: '1',
          fifaEvents: {
            timeline: [
              { type: 'kickoff', minute: 0, sortKey: 0 },
              { type: 'goal', minute: 4, side: 'away', sortKey: 4 },
            ],
          },
        },
        kickoff,
        { now }
      )
    ).toBe('live');
  });

  it('ignora finished de worldcup26 si el kickoff canónico aún no llegó', () => {
    const usaParaguayKickoff = new Date('2026-06-13T01:00:00.000Z');
    const beforeKickoff = usaParaguayKickoff.getTime() - 60_000;

    expect(
      resolveGameStatus(
        {
          id: '4',
          finished: 'TRUE',
          time_elapsed: 'finished',
          home_score: '0',
          away_score: '0',
          local_date: '06/12/2026 18:00',
        },
        usaParaguayKickoff,
        { now: beforeKickoff }
      )
    ).toBe('upcoming');

    const game = normalizeGame({
      id: '4',
      home_team_id: '13',
      away_team_id: '14',
      home_score: '0',
      away_score: '0',
      group: 'D',
      matchday: '1',
      local_date: '06/12/2026 18:00',
      finished: 'TRUE',
      time_elapsed: 'finished',
      type: 'group',
    });

    expect(game.kickoffAt.toISOString()).toBe('2026-06-13T01:00:00.000Z');
    if (Date.now() < usaParaguayKickoff.getTime()) {
      expect(game.status).toBe('upcoming');
    }
  });

  it('normaliza un equipo con 48 entradas típicas', () => {
    const team = normalizeTeam(sampleTeam);
    expect(team.externalId).toBe('1');
    expect(team.nameEn).toBe('Mexico');
    expect(team.fifaCode).toBe('MEX');
    expect(team.group).toBe('A');
  });
});

describe('fetchWithRetry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reintenta ante fetch failed intermitente', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithRetry('https://worldcup26.ir/get/games', {}, { attempts: 3 });

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reintenta ante HTTP 503', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithRetry('https://worldcup26.ir/get/games', {}, { attempts: 3 });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('no reintenta ante HTTP 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithRetry('https://worldcup26.ir/get/games', {}, { attempts: 4 });

    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe.skipIf(process.env.RUN_LIVE_WORLDCUP_TESTS !== '1')('worldCupApiClient live API', () => {
  it('obtiene equipos y partidos desde la API pública', async () => {
    const [gamesRes, teamsRes] = await Promise.all([
      fetchWithRetry('https://worldcup26.ir/get/games'),
      fetchWithRetry('https://worldcup26.ir/get/teams'),
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
