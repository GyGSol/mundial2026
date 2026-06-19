import { describe, expect, it } from 'vitest';
import {
  parseCoachWikiFromWikitext,
  parseManagerWorldCups,
} from '../src/services/coachWikiService.js';

const CLARKE_WIKITEXT_ES = `
{{Ficha de entrenador de fútbol
| nombre = Steve Clarke
| nacionalidad = escocés
| fechadenacimiento = 29 de agosto de 1963 ({{edad|29|8|1963}})
| seleccion = [[Selección de fútbol de Escocia|Escocia]]
| años1 = 2019–
}}

== Carrera como entrenador ==
=== Selección de Escocia ===
En mayo de 2019 fue nombrado entrenador de la [[Selección de fútbol de Escocia|selección de Escocia]].
Llevó a Escocia a la [[Eurocopa 2020]] y a la [[Eurocopa 2024]].
Dirigirá a Escocia en la [[Copa Mundial de Fútbol de 2026]].
`;

describe('coachWikiService', () => {
  it('parseCoachWikiFromWikitext extrae datos del infobox y sección con la selección (es)', () => {
    const parsed = parseCoachWikiFromWikitext(CLARKE_WIKITEXT_ES, {
      summary: 'Exfutbolista y entrenador de fútbol escocés.',
      wikiTitle: 'Steve Clarke',
      wikiUrl: 'https://es.wikipedia.org/wiki/Steve_Clarke',
      teamName: 'Scotland',
      countryEs: 'Escocia',
    });

    expect(parsed.nationality).toMatch(/escoc/i);
    expect(parsed.currentTeam).toMatch(/Escocia/i);
    expect(parsed.teamSection).toMatch(/selección de Escocia/i);
    expect(parsed.worldCupAsManager).toContain(2026);
    expect(parsed.highlights.some((line) => line.includes('Escocia'))).toBe(true);
    expect(parsed.summary).toMatch(/entrenador/i);
  });

  it('parseManagerWorldCups detecta mundiales como DT en español', () => {
    expect(parseManagerWorldCups(CLARKE_WIKITEXT_ES)).toEqual([2026]);
  });
});
