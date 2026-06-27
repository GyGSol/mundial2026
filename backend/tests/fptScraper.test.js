import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildFptStreamSource,
  clearFptAgendaCacheForTests,
  mergeStreamSources,
  parseFptAgendaHtml,
  parseFptChannelCatalog,
  pickPreferredFptStream,
  sortFptStreams,
} from '../src/services/fptScraper.js';
import { rankEventsForMatch } from '../src/services/streamTeamMatching.js';

const AGENDA_FIXTURE = `
<li class="FIFA"><a href="#">
Copa Mundial de la FIFA 2026: Colombia vs Portugal
<span class="t">00:30</span></a>
<ul>
<li class="subitem1"><a href="/eventos.html?r=aHR0cHM6Ly9zdWRhbWVyaWNhcGxheS5zYnMvY2FuYWxfODExMi9jemFfZHNwb3J0cy5odG1s" target="_top">DSports <span>Calidad 1080p</span></a></li>
<li class="subitem1"><a href="/eventos.html?r=aHR0cHM6Ly9zdHJlYW10cGRheTEueHl6L2dsb2JhbDIucGhwP3N0cmVhbT1kc3BvcnRz" target="_top">DSports Op2 <span>Calidad 720p</span></a></li>
<li class="subitem1"><a href="/eventos.html?r=aHR0cHM6Ly9zdHJlYW14OTk2Lm9uZS9nbG9iYWwxLnBocD9jaGFubmVsPXZpeDM=" target="_top">VIX Op2 <span>Calidad 720p</span></a></li>
</ul>
</li>
<li class="FIFA"><a href="#">
Copa Mundial de la FIFA 2026: RD del Congo vs Uzbekistán
<span class="t">00:30</span></a>
<ul>
<li class="subitem1"><a href="/eventos.html?r=aHR0cHM6Ly9zdWRhbWVyaWNhcGxheS5zYnMvY2FuYWxfODExMi8xZHpwb3J0c3BsdXMuaHRtbA==" target="_top">DSports+ <span>Calidad 1080p</span></a></li>
</ul>
</li>
`;

describe('fptScraper', () => {
  beforeEach(() => {
    clearFptAgendaCacheForTests();
  });

  it('parseFptAgendaHtml extrae eventos FIFA con streams', () => {
    const events = parseFptAgendaHtml(AGENDA_FIXTURE, 'https://futbolparatodos.su');
    expect(events).toHaveLength(2);
    expect(events[0].title).toContain('Colombia vs Portugal');
    expect(events[0].streams.length).toBeGreaterThanOrEqual(3);
    expect(events[0].streams[0].url).toContain('futbolparatodos.su/eventos.html');
    expect(events[0].streams[0].provider).toBe('fpt');
  });

  it('pickPreferredFptStream prefiere 1080p DSports', () => {
    const events = parseFptAgendaHtml(AGENDA_FIXTURE, 'https://futbolparatodos.su');
    const preferred = pickPreferredFptStream(events[0].streams);
    expect(preferred.label).toContain('DSports');
    expect(preferred.quality).toContain('1080');
  });

  it('rankEventsForMatch prioriza Colombia vs Portugal', () => {
    const events = parseFptAgendaHtml(AGENDA_FIXTURE, 'https://futbolparatodos.su');
    const ranked = rankEventsForMatch(
      {},
      events,
      'Colombia',
      'Portugal',
      { nameEn: 'Colombia', fifaCode: 'COL' },
      { nameEn: 'Portugal', fifaCode: 'POR' }
    );

    expect(ranked[0].title).toContain('Colombia vs Portugal');
  });

  it('parseFptChannelCatalog extrae slugs de la home', () => {
    const html = `
      <a href="/canal/dsports.html">DSports</a>
      <a href="/canal/espnpremium.html">ESPN Premium</a>
    `;
    expect(parseFptChannelCatalog(html)).toEqual(['dsports', 'espnpremium']);
  });

  it('mergeStreamSources combina admin + agenda sin duplicar URL', () => {
    const admin = {
      la18PageUrl: 'https://futbolparatodos.su/eventos.html?r=abc',
      embedUrl: 'https://futbolparatodos.su/eventos.html?r=abc',
      la18EventId: 'dsports',
      notes: 'Manual',
    };
    const fpt = [
      buildFptStreamSource('https://futbolparatodos.su/eventos.html?r=abc', 'DSports', '1080p'),
      buildFptStreamSource('https://futbolparatodos.su/eventos.html?r=xyz', 'Fox', '1080p'),
    ];

    const merged = mergeStreamSources(admin, fpt);
    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe('admin');
  });

  it('sortFptStreams ordena por calidad y canal preferido', () => {
    const streams = [
      buildFptStreamSource('https://futbolparatodos.su/eventos.html?r=a', 'VIX', '720p'),
      buildFptStreamSource('https://futbolparatodos.su/eventos.html?r=b', 'DSports', '1080p'),
    ];
    const sorted = sortFptStreams(streams);
    expect(sorted[0].label).toContain('DSports');
  });
});
