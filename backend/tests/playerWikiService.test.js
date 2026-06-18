import { describe, it, expect } from 'vitest';
import {
  stripWikiMarkup,
  extractWikiSection,
  parseWorldCupAppearances,
  parseInternationalGoalsTable,
  parseSquadCallups,
  parsePlayerWikiFromWikitext,
  buildCompactWikiContextForAi,
  isWikiContextFresh,
} from '../src/services/playerWikiService.js';

const SAMPLE_WIKITEXT = `
{{Infobox football biography
| name = Lionel Messi
| nationalcaps = 189
| nationalgoals = 112
| nationalyears = 2005–
}}

== International career ==
Messi made his debut for Argentina in 2005. He played at the [[2006 FIFA World Cup]], [[2010 FIFA World Cup]], [[2014 FIFA World Cup]], [[2018 FIFA World Cup]] and [[2022 FIFA World Cup]].

He was called up for the [[2026 FIFA World Cup]] squad.

== International goals ==
{| class="wikitable" style="text-align:center"
|-
!No. !!Date !!Venue !!Opponent !!Score !!Result !!Competition
|-
|1 ||21 August 2005||[[Hungary national football team|Hungary]]||2–1||Win||Friendly
|-
|2 ||16 October 2023||[[Paraguay national football team|Paraguay]]||1–0||Win||[[2026 FIFA World Cup qualification]]
|}
`;

describe('playerWikiService', () => {
  it('stripWikiMarkup limpia markup básico', () => {
    expect(stripWikiMarkup("[[Argentina|ARG]] ''captain''")).toBe('ARG captain');
  });

  it('extractWikiSection extrae carrera internacional', () => {
    const section = extractWikiSection(SAMPLE_WIKITEXT, ['International career']);
    expect(section).toContain('2005');
    expect(section).toContain('2022 FIFA World Cup');
  });

  it('parseWorldCupAppearances detecta años de mundial', () => {
    const appearances = parseWorldCupAppearances(SAMPLE_WIKITEXT);
    expect(appearances.map((row) => row.year)).toEqual([2006, 2010, 2014, 2018, 2022, 2026]);
  });

  it('parseInternationalGoalsTable extrae partidos recientes', () => {
    const matches = parseInternationalGoalsTable(SAMPLE_WIKITEXT);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].opponent).toMatch(/Paraguay|Hungary/i);
  });

  it('parseSquadCallups detecta convocatorias', () => {
    const callups = parseSquadCallups(SAMPLE_WIKITEXT, 'ARG');
    expect(callups.some((c) => /2026 FIFA World Cup/i.test(c))).toBe(true);
  });

  it('parsePlayerWikiFromWikitext arma payload completo', () => {
    const parsed = parsePlayerWikiFromWikitext(SAMPLE_WIKITEXT, {
      summary: 'Argentine forward',
      wikiTitle: 'Lionel Messi',
      wikiUrl: 'https://en.wikipedia.org/wiki/Lionel_Messi',
    });

    expect(parsed.internationalCaps).toBe(189);
    expect(parsed.internationalGoals).toBe(112);
    expect(parsed.worldCupAppearances.length).toBe(6);
    expect(parsed.careerHighlights.some((h) => h.includes('189'))).toBe(true);
  });

  it('buildCompactWikiContextForAi formatea para prompts', () => {
    const compact = buildCompactWikiContextForAi({
      wikiTitle: 'Lionel Messi',
      wikiUrl: 'https://en.wikipedia.org/wiki/Lionel_Messi',
      summary: 'Forward',
      internationalCaps: 189,
      internationalGoals: 112,
      worldCupAppearances: [{ year: 2022, notes: '' }],
      squadCallups: ['2022 FIFA World Cup'],
      internationalMatches: [{ date: '2023', opponent: 'Paraguay', score: '1-0', result: 'Win', competition: 'Q', goals: 1 }],
      careerHighlights: ['Mundial 2022'],
      fetchedAt: new Date(),
    });

    expect(compact.fuente).toBe('Wikipedia');
    expect(compact.seleccion.caps).toBe(189);
    expect(compact.mundiales[0].anio).toBe(2022);
  });

  it('isWikiContextFresh respeta TTL de 7 días', () => {
    const now = Date.now();
    expect(isWikiContextFresh({ fetchedAt: new Date(now - 1000) }, now)).toBe(true);
    expect(isWikiContextFresh({ fetchedAt: new Date(now - 8 * 24 * 60 * 60 * 1000) }, now)).toBe(false);
  });
});
