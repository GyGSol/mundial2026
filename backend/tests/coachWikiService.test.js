import { describe, expect, it } from 'vitest';
import {
  parseCoachWikiFromWikitext,
  parseManagerWorldCups,
} from '../src/services/coachWikiService.js';

const CLARKE_WIKITEXT = `
{{Infobox football manager
| name = Steve Clarke
| nationality = Scottish
| birth_date = {{birth date and age|1963|8|29|df=y}}
| currentclub = [[Scotland national football team|Scotland]]
| managerclubs1 = [[Scotland national football team|Scotland]]
| manageryears1 = 2019–
}}

== Managerial career ==
Clarke was appointed manager of the [[Scotland national football team|Scotland national team]] in May 2019.
He led Scotland to the [[2020 UEFA European Championship]] and the [[2024 UEFA European Championship]].
He will manage Scotland at the [[2026 FIFA World Cup]].
`;

describe('coachWikiService', () => {
  it('parseCoachWikiFromWikitext extrae datos del infobox y sección con la selección', () => {
    const parsed = parseCoachWikiFromWikitext(CLARKE_WIKITEXT, {
      summary: 'Scottish football manager',
      wikiTitle: 'Steve Clarke',
      wikiUrl: 'https://en.wikipedia.org/wiki/Steve_Clarke',
      teamName: 'Scotland',
    });

    expect(parsed.nationality).toMatch(/Scottish/i);
    expect(parsed.currentTeam).toMatch(/Scotland/i);
    expect(parsed.teamSection).toMatch(/Scotland national team/i);
    expect(parsed.worldCupAsManager).toContain(2026);
    expect(parsed.highlights.some((line) => line.includes('Scotland'))).toBe(true);
  });

  it('parseManagerWorldCups detecta mundiales como DT', () => {
    expect(parseManagerWorldCups(CLARKE_WIKITEXT)).toEqual([2026]);
  });
});
