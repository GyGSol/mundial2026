import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseRssItems,
  normalizeNewsArticle,
  extractOgImageFromHtml,
  extractSourceFromBlock,
  normalizeNewsImageUrl,
  __resetNewsCacheForTests,
} from '../src/services/worldCupNewsService.js';
import { normalizeBriefingPayload } from '../src/services/aiWorldCupStatsService.js';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[FIFA World Cup 2026 draw confirmed]]></title>
      <link>https://news.google.com/rss/articles/CBMi?oc=5</link>
      <pubDate>Thu, 05 Dec 2025 10:00:00 GMT</pubDate>
      <description><![CDATA[<img src="https://cdn.fifa.com/image.jpg" /> Official update from FIFA.]]></description>
      <source url="https://www.fifa.com">FIFA</source>
      <media:thumbnail url="https://cdn.fifa.com/hero.jpg"/>
    </item>
    <item>
      <title>Another headline</title>
      <link>https://example.com/story</link>
      <description>Plain text summary</description>
    </item>
  </channel>
</rss>`;

describe('worldCupNewsService', () => {
  beforeEach(() => {
    __resetNewsCacheForTests();
  });

  describe('parseRssItems', () => {
    it('extrae titulo, link, resumen, fuente e imagen', () => {
      const items = parseRssItems(SAMPLE_RSS);
      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('FIFA World Cup 2026 draw confirmed');
      expect(items[0].imageUrl).toBe('https://cdn.fifa.com/hero.jpg');
      expect(items[0].sourceLabel).toBe('FIFA');
      expect(items[0].sourceUrl).toBe('https://www.fifa.com');
      expect(items[0].summary).toContain('Official update');
    });
  });

  describe('extractOgImageFromHtml', () => {
    it('lee og:image del html', () => {
      const html =
        '<meta property="og:image" content="https://lh3.googleusercontent.com/thumb=s0-w300" />';
      expect(extractOgImageFromHtml(html)).toContain('googleusercontent.com');
    });
  });

  describe('normalizeNewsImageUrl', () => {
    it('amplía thumbnails de Google', () => {
      expect(normalizeNewsImageUrl('https://lh3.googleusercontent.com/x=s0-w300')).toContain('w800');
    });
  });

  describe('normalizeNewsArticle', () => {
    it('marca FIFA como fuente oficial', () => {
      const article = normalizeNewsArticle(
        {
          title: 'FIFA update',
          link: 'https://news.google.com/rss/articles/CBMi?oc=5',
          summary: 'Test',
          imageUrl: 'https://cdn.fifa.com/a.jpg',
          publishedAt: '2025-12-05T10:00:00.000Z',
          sourceUrl: 'https://www.fifa.com',
          sourceLabel: 'FIFA',
        },
        { sourceName: 'Google News', official: false }
      );

      expect(article.sourceName).toBe('FIFA');
      expect(article.isOfficial).toBe(true);
    });
  });
});

describe('aiWorldCupStatsService', () => {
  describe('normalizeBriefingPayload', () => {
    it('filtra filas vacias y limita cantidad', () => {
      const normalized = normalizeBriefingPayload({
        overview: 'Resumen del torneo',
        newsDigest: 'Clima informativo',
        keyNumbers: [{ label: 'Equipos', value: '48', note: '' }, { label: '', value: '' }],
        records: [{ title: 'Mas goles', description: 'Pendiente' }],
        trivia: ['  Dato  ', ''],
        phaseSummaries: [{ phase: 'Grupos', summary: 'En curso' }],
        hostFacts: ['Tres paises anfitriones'],
      });

      expect(normalized.overview).toBe('Resumen del torneo');
      expect(normalized.keyNumbers).toHaveLength(1);
      expect(normalized.trivia).toEqual(['Dato']);
      expect(normalized.hostFacts).toHaveLength(1);
    });
  });
});
