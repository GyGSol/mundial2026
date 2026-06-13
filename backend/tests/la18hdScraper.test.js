import { describe, it, expect } from 'vitest';
import {
  parseLa18EventList,
  rankLa18EventsForMatch,
} from '../src/services/la18hdScraper.js';

describe('la18hdScraper', () => {
  it('parseLa18EventList extrae enlaces de eventos', () => {
    const html = `
      <a href="/evento/argentina-brasil">Argentina vs Brasil</a>
      <a href="https://la18hd.com/eventos/otro">Otro</a>
    `;
    const events = parseLa18EventList(html, 'https://la18hd.com');
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].url).toContain('la18hd.com');
  });

  it('rankLa18EventsForMatch prioriza coincidencias de equipos', () => {
    const events = [
      { title: 'Random sport', url: 'https://la18hd.com/evento/a', eventId: 'a' },
      { title: 'Argentina vs Brazil live', url: 'https://la18hd.com/evento/b', eventId: 'b' },
    ];
    const ranked = rankLa18EventsForMatch({}, events, 'Argentina', 'Brazil');
    expect(ranked[0].eventId).toBe('b');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});
