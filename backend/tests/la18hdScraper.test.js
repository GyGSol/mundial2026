import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildStreamSource,
  clearLa18AgendaCacheForTests,
  groupAgendaEntries,
  labelStreamLink,
  mergeStreamSources,
  parseLa18EventList,
  rankLa18EventsForMatch,
  extractHlsUrlFromHtml,
  sourceIdFromLink,
} from '../src/services/la18hdScraper.js';

describe('la18hdScraper', () => {
  beforeEach(() => {
    clearLa18AgendaCacheForTests();
  });

  it('parseLa18EventList extrae enlaces de eventos', () => {
    const html = `
      <a href="/evento/argentina-brasil">Argentina vs Brasil</a>
      <a href="https://la18hd.com/eventos/otro">Otro</a>
    `;
    const events = parseLa18EventList(html, 'https://la18hd.com');
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].url).toContain('la18hd.com');
  });

  it('groupAgendaEntries agrupa múltiples links del mismo partido', () => {
    const entries = [
      {
        title: 'Copa del Mundo: Haití vs Escocia',
        link: 'https://la18hd.com/vivo/canales.php?stream=dsports',
        language: 'Español',
        time: '20:00',
        date: '2026-06-13',
      },
      {
        title: 'Copa del Mundo: Haití vs Escocia',
        link: 'https://la18hd.com/vivo/canales.php?stream=tycsports',
        language: 'Español',
        time: '20:00',
        date: '2026-06-13',
      },
    ];

    const grouped = groupAgendaEntries(entries);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].streams).toHaveLength(2);
    expect(grouped[0].streams[0].id).toBe('dsports');
    expect(grouped[0].streams[1].id).toBe('tycsports');
  });

  it('labelStreamLink usa slug conocido', () => {
    expect(labelStreamLink('https://la18hd.com/vivo/canales.php?stream=disney6')).toContain('Disney');
    expect(sourceIdFromLink('https://la18hd.com/vivo/canales.php?stream=dsports')).toBe('dsports');
  });

  it('extractHlsUrlFromHtml obtiene m3u8 embebido', () => {
    const html =
      'var src="https://cdn.example.com/disney6/mono.m3u8?token=abc123-d0-999-888";';
    expect(extractHlsUrlFromHtml(html)).toBe(
      'https://cdn.example.com/disney6/mono.m3u8?token=abc123-d0-999-888'
    );
  });

  it('rankLa18EventsForMatch prioriza coincidencias de equipos con alias', () => {
    const events = groupAgendaEntries([
      {
        title: 'Random sport',
        link: 'https://la18hd.com/vivo/canales.php?stream=espn',
        time: '12:00',
        date: '2026-06-13',
      },
      {
        title: 'Copa del Mundo: Haití vs Escocia',
        link: 'https://la18hd.com/vivo/canales.php?stream=dsports',
        time: '20:00',
        date: '2026-06-13',
      },
    ]);

    const ranked = rankLa18EventsForMatch({}, events, 'Haiti', 'Scotland');
    expect(ranked[0].streams[0].id).toBe('dsports');
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it('rankLa18EventsForMatch matchea títulos en español con equipos en inglés', () => {
    const events = groupAgendaEntries([
      {
        title: 'Copa del Mundo: Países Bajos vs Japón',
        link: 'https://la18hd.com/vivo/canales.php?stream=dsports',
        time: '15:00',
        date: '2026-06-14',
      },
    ]);

    const ranked = rankLa18EventsForMatch(
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

  it('mergeStreamSources combina admin + agenda sin duplicar URL', () => {
    const admin = {
      la18PageUrl: 'https://la18hd.com/vivo/canales.php?stream=disney6',
      embedUrl: 'https://la18hd.com/vivo/canales.php?stream=disney6',
      la18EventId: 'disney6',
      notes: 'Manual',
    };
    const la18 = [
      buildStreamSource('https://la18hd.com/vivo/canales.php?stream=disney6'),
      buildStreamSource('https://la18hd.com/vivo/canales.php?stream=dsports'),
    ];

    const merged = mergeStreamSources(admin, la18);
    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe('admin');
  });
});
