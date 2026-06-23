import { describe, expect, it } from 'vitest';
import {
  extractFifaLiveState,
  fifaTokenIndicatesHalftime,
  fifaTokenIndicatesSuspended,
  resolveMatchPlayState,
  serializeMatchPlayStateForClient,
  timelineIndicatesHalftime,
} from '../src/services/matchPlayStateService.js';

describe('matchPlayStateService', () => {
  it('mapea tokens FIFA de suspensión e entretiempo', () => {
    expect(fifaTokenIndicatesSuspended('Suspended')).toBe(true);
    expect(fifaTokenIndicatesSuspended('MatchInterrupted')).toBe(true);
    expect(fifaTokenIndicatesHalftime('HalfTime')).toBe(true);
    expect(fifaTokenIndicatesHalftime('HT')).toBe(true);
    expect(fifaTokenIndicatesSuspended('FirstHalf')).toBe(false);
  });

  it('extrae Period y MatchStatus del live football', () => {
    const state = extractFifaLiveState(
      { Period: 'Suspended', MatchStatus: 'Live', MatchTime: "45+4'" },
      { Period: 'FirstHalf' }
    );
    expect(state.period).toBe('Suspended');
    expect(state.matchStatus).toBe('Live');
    expect(state.matchTime).toBe("45+4'");
  });

  it('detecta entretiempo por cronología (period_end sin 2.º tiempo)', () => {
    const timeline = [
      { type: 'goal', minute: 14, sortKey: 14 },
      { type: 'period_end', minute: 45, phase: 'first', sortKey: 45 },
    ];
    expect(timelineIndicatesHalftime(timeline)).toBe(true);

    const playState = resolveMatchPlayState(
      { status: 'live', weatherOps: { phase: 'normal' }, raw: {} },
      { timeline }
    );
    expect(playState.phase).toBe('halftime');
    expect(playState.label).toBe('Entretiempo');
    expect(playState.source).toBe('fifa_timeline');
  });

  it('prioriza suspensión oficial FIFA sobre entretiempo en cronología', () => {
    const timeline = [{ type: 'period_end', minute: 45, phase: 'first', sortKey: 45 }];
    const playState = resolveMatchPlayState(
      {
        status: 'live',
        weatherOps: { phase: 'normal' },
        raw: { fifaLiveState: { period: 'Suspended', matchStatus: 'Suspended' } },
      },
      { timeline }
    );
    expect(playState.phase).toBe('suspended');
    expect(playState.reason).toBe('official');
    expect(playState.label).toBe('Suspendido');
  });

  it('prioriza suspensión climática', () => {
    const playState = resolveMatchPlayState({
      status: 'live',
      weatherOps: { phase: 'suspended', since: new Date('2026-06-20T20:00:00Z') },
      raw: { fifaLiveState: { period: 'FirstHalf' } },
    });
    expect(playState.phase).toBe('suspended');
    expect(playState.reason).toBe('weather');
    expect(playState.label).toBe('Suspendido por clima');
  });

  it('no marca entretiempo si ya hay juego en el 2.º tiempo', () => {
    const timeline = [
      { type: 'period_end', minute: 45, phase: 'first', sortKey: 45 },
      { type: 'goal', minute: 59, sortKey: 59 },
    ];
    expect(timelineIndicatesHalftime(timeline)).toBe(false);
  });

  it('no marca pausa de hidratación si hubo juego después en el mismo minuto', () => {
    const timeline = [
      { type: 'hydration_break', minute: 90, extraMinute: 9, sortKey: 90.09 },
      { type: 'shot_attempt', minute: 90, extraMinute: 9, sortKey: 90.09 },
    ];
    const playState = resolveMatchPlayState(
      { status: 'live', weatherOps: { phase: 'normal' }, raw: {} },
      { timeline }
    );
    expect(playState.phase).toBe('in_play');
  });

  it('no marca pausa de hidratación si la timeline ya tiene match_end', () => {
    const timeline = [
      { type: 'hydration_break', minute: 90, extraMinute: 9, sortKey: 90.09 },
      { type: 'match_end', minute: 90, extraMinute: 9, sortKey: 90.09 },
    ];
    const playState = resolveMatchPlayState(
      { status: 'live', weatherOps: { phase: 'normal' }, raw: {} },
      { timeline }
    );
    expect(playState.phase).toBe('in_play');
  });

  it('ignora pausa de hidratación cuando FIFA reporta FullTime', () => {
    const timeline = [{ type: 'hydration_break', minute: 90, extraMinute: 9, sortKey: 90.09 }];
    const playState = resolveMatchPlayState(
      {
        status: 'live',
        weatherOps: { phase: 'normal' },
        raw: { fifaLiveState: { period: 'FullTime', matchStatus: 'Ended' } },
      },
      { timeline }
    );
    expect(playState.phase).toBe('in_play');
  });

  it('serializa in_play como estado neutro', () => {
    expect(serializeMatchPlayStateForClient({ phase: 'in_play' }).phase).toBe('in_play');
    expect(serializeMatchPlayStateForClient({ phase: 'halftime', label: 'Entretiempo' }).label).toBe(
      'Entretiempo'
    );
  });
});
