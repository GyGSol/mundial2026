import { describe, it, expect } from 'vitest';
import { rankEventsForMatch } from '../src/services/streamTeamMatching.js';

describe('streamTeamMatching', () => {
  it('rankEventsForMatch prioriza coincidencias de equipos con alias', () => {
    const events = [
      {
        title: 'Random sport',
        time: '12:00',
        streams: [{ id: 'espn' }],
      },
      {
        title: 'Copa del Mundo: Haití vs Escocia',
        time: '20:00',
        streams: [{ id: 'dsports' }],
      },
    ];

    const ranked = rankEventsForMatch({}, events, 'Haiti', 'Scotland');
    expect(ranked[0].streams[0].id).toBe('dsports');
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it('rankEventsForMatch matchea títulos en español con equipos en inglés', () => {
    const events = [
      {
        title: 'Copa del Mundo: República Checa vs Sur África',
        time: '11:00',
        streams: [{ id: 'dsports' }],
      },
    ];

    const ranked = rankEventsForMatch(
      {},
      events,
      'Czech Republic',
      'South Africa',
      { nameEn: 'Czech Republic', fifaCode: 'CZE' },
      { nameEn: 'South Africa', fifaCode: 'RSA' }
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].streams[0].id).toBe('dsports');
  });

  it('rankEventsForMatch matchea Países Bajos vs Japón', () => {
    const events = [
      {
        title: 'Copa del Mundo: Países Bajos vs Japón',
        time: '15:00',
        streams: [{ id: 'dsports' }],
      },
    ];

    const ranked = rankEventsForMatch(
      {},
      events,
      'Netherlands',
      'Japan',
      { nameEn: 'Netherlands', fifaCode: 'NED' },
      { nameEn: 'Japan', fifaCode: 'JPN' }
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].streams[0].id).toBe('dsports');
  });

  it('suma bonus si la hora de agenda coincide con kickoff', () => {
    const events = [
      {
        title: 'Copa Mundial: Colombia vs Portugal',
        time: '00:30',
        streams: [{ id: 'dsports' }],
      },
      {
        title: 'Copa Mundial: Colombia vs Portugal',
        time: '18:00',
        streams: [{ id: 'fox' }],
      },
    ];

    const match = { kickoffAt: new Date('2026-06-27T03:30:00.000Z') };
    const ranked = rankEventsForMatch(
      match,
      events,
      'Colombia',
      'Portugal',
      { nameEn: 'Colombia', fifaCode: 'COL' },
      { nameEn: 'Portugal', fifaCode: 'POR' }
    );

    expect(ranked[0].time).toBe('00:30');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});
