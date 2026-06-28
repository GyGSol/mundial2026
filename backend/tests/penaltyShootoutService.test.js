import { describe, it, expect } from 'vitest';
import {
  buildPenaltyShootoutKicksFromRawEvents,
  isFifaShootoutPeriod,
  readFifaPenaltyShootoutScores,
  resolvePenaltyShootoutForMatch,
  partitionTimelineForShootout,
} from '../src/services/penaltyShootoutService.js';
import { goalCountsFromTimeline as goalCounts } from '../src/services/matchLiveData.js';
import { buildFifaTimelineEntry } from '../src/services/fifaTimelineParser.js';

describe('penaltyShootoutService', () => {
  it('lee marcador de tanda desde calendario FIFA (HomeTeamPenaltyScore)', () => {
    expect(
      readFifaPenaltyShootoutScores({
        Home: { Score: 1, IdTeam: 'h1' },
        Away: { Score: 1, IdTeam: 'a1' },
        HomeTeamPenaltyScore: 4,
        AwayTeamPenaltyScore: 3,
        Winner: 'h1',
      })
    ).toEqual({ homeScore: 4, awayScore: 3 });
  });

  it('detecta periodo 9 como tanda de penales', () => {
    expect(isFifaShootoutPeriod(9)).toBe(true);
    expect(isFifaShootoutPeriod('AfterPenalty')).toBe(true);
    expect(isFifaShootoutPeriod(5)).toBe(false);
  });

  it('arma kicks desde eventos crudos de tanda', () => {
    const kicks = buildPenaltyShootoutKicksFromRawEvents(
      [
        {
          Period: 9,
          IdTeam: 'home-id',
          Type: 0,
          HomePenaltyGoals: 1,
          AwayPenaltyGoals: 0,
          EventDescription: [{ Locale: 'en-GB', Description: 'Player A (Home) scores in the penalty shoot-out!' }],
        },
        {
          Period: 9,
          IdTeam: 'away-id',
          Type: 0,
          HomePenaltyGoals: 1,
          AwayPenaltyGoals: 0,
          EventDescription: [{ Locale: 'en-GB', Description: 'Player B (Away) misses in the penalty shoot-out' }],
        },
      ],
      'home-id',
      'away-id'
    );

    expect(kicks).toHaveLength(2);
    expect(kicks[0]).toMatchObject({ side: 'home', scored: true });
    expect(kicks[1]).toMatchObject({ side: 'away', scored: false });
  });

  it('resolvePenaltyShootoutForMatch usa fifaMeta y kicks', () => {
    const shootout = resolvePenaltyShootoutForMatch({
      fifaMeta: {
        homeTeamId: 'h1',
        awayTeamId: 'a1',
        homePenaltyScore: 5,
        awayPenaltyScore: 4,
        winnerTeamId: 'h1',
      },
      fifaEvents: { rawEvents: [] },
    });

    expect(shootout).toMatchObject({
      homeScore: 5,
      awayScore: 4,
      winnerSide: 'home',
    });
  });

  it('particiona timeline de campo vs tanda', () => {
    const { fieldEvents, shootoutKicks } = partitionTimelineForShootout([
      { type: 'goal', side: 'home', minute: 55 },
      { type: 'penalty_shootout_kick', side: 'home', isShootoutKick: true, player: 'A' },
    ]);

    expect(fieldEvents).toHaveLength(1);
    expect(shootoutKicks).toHaveLength(1);
  });
});

describe('goalCountsFromTimeline shootout exclusion', () => {
  it('no cuenta goles de tanda en marcador de juego', () => {
    const timeline = [
      { type: 'goal', side: 'home', minute: 10 },
      { type: 'goal', side: 'away', minute: 80 },
      { type: 'penalty_shootout_kick', side: 'home', isShootoutKick: true, scored: true },
      { type: 'penalty_shootout_kick', side: 'away', isShootoutKick: true, scored: true },
    ];

    expect(goalCounts(timeline)).toEqual({ home: 1, away: 1 });
  });
});

describe('fifaTimelineParser penalties', () => {
  it('Type 41 en juego es gol con isPenalty', () => {
    const entry = buildFifaTimelineEntry(
      {
        Type: 41,
        Period: 3,
        MatchMinute: "17'",
        IdTeam: 'home-id',
        IdPlayer: 'p1',
        EventDescription: [
          { Locale: 'en-GB', Description: 'Breel EMBOLO (Switzerland) successfully converts the penalty!' },
        ],
      },
      'home-id',
      'away-id'
    );

    expect(entry).toMatchObject({
      type: 'goal',
      isPenalty: true,
      side: 'home',
      minute: 17,
    });
  });

  it('gol en periodo 9 es kick de tanda', () => {
    const entry = buildFifaTimelineEntry(
      {
        Type: 0,
        Period: 9,
        MatchMinute: "1'",
        IdTeam: 'home-id',
        EventDescription: [
          { Locale: 'en-GB', Description: 'Player X (Home) scores in the penalty shoot-out!' },
        ],
      },
      'home-id',
      'away-id'
    );

    expect(entry).toMatchObject({
      type: 'penalty_shootout_kick',
      isShootoutKick: true,
      fifaPeriod: 9,
      scored: true,
    });
  });
});

describe('FIFA API sync contract', () => {
  it('Home.Score y HomeTeamPenaltyScore son campos separados en calendario', () => {
    const entry = {
      Home: { Score: 1 },
      Away: { Score: 1 },
      HomeTeamPenaltyScore: 4,
      AwayTeamPenaltyScore: 3,
    };
    expect(entry.Home.Score).toBe(1);
    expect(entry.HomeTeamPenaltyScore).toBe(4);
    expect(readFifaPenaltyShootoutScores(entry)).toEqual({ homeScore: 4, awayScore: 3 });
  });
});
