import { describe, expect, it } from 'vitest';
import {
  buildGeneratorTxtForTeam,
  parseWikipediaSquadsWikitext,
} from '../src/utils/wikipediaSquadsParser.js';

const FIXTURE = `
===Mexico===
Coach: [[Javier Aguirre]]

{{nat fs g start}}
{{nat fs g player|no=4|pos=DF|name=[[Edson Álvarez]]|sortname=Álvarez, Edson|other=[[Captain (association football)|captain]]|age={{birth date and age2|2026|6|11|1997|10|24}}|caps=98|goals=7|club=[[Fenerbahçe S.K. (football)|Fenerbahçe]]|clubnat=TUR}}
{{nat fs g player|no=9|pos=FW|name=[[Raúl Jiménez]]|sortname=Jiménez, Raúl|age={{birth date and age2|2026|6|11|1991|5|5}}|caps=124|goals=45|club=[[Fulham F.C.|Fulham]]|clubnat=ENG}}
{{nat fs g player|no=15|pos=MF|name=[[Nicolás González (footballer, born 1998)|Nicolás González]]|sortname=Gonzalez, Nicolas|age={{birth date and age2|2026|6|11|1998|4|6}}|caps=51|goals=6|club=[[Juventus FC|Juventus]]|clubnat=ITA}}
{{nat fs g end}}
`;

describe('wikipediaSquadsParser', () => {
  it('parsea plantel con DT, dorsal, caps, goles y capitán', () => {
    const doc = parseWikipediaSquadsWikitext(FIXTURE);
    expect(doc.teams).toHaveLength(1);

    const mex = doc.teams[0];
    expect(mex.fifaCode).toBe('MEX');
    expect(mex.coach).toBe('Javier Aguirre');
    expect(mex.players).toHaveLength(3);

    const captain = mex.players.find((p) => p.fullName === 'Edson Álvarez');
    expect(captain.shirtNumber).toBe(4);
    expect(captain.isCaptain).toBe(true);
    expect(captain.caps).toBe(98);
    expect(captain.goals).toBe(7);
    expect(captain.photoFilename).toBe('mex-edson-alvarez.png');

    const gonzalez = mex.players.find((p) => p.fullName === 'Nicolás González');
    expect(gonzalez?.photoFilename).toBe('mex-nicolas-gonzalez.png');
  });

  it('genera txt para el generador de imágenes', () => {
    const doc = parseWikipediaSquadsWikitext(FIXTURE);
    const txt = buildGeneratorTxtForTeam(doc.teams[0]);
    expect(txt).toContain('DT: Javier Aguirre');
    expect(txt).toContain('mex-edson-alvarez.png | #4 | Edson Álvarez (C)');
    expect(txt).toContain('Raúl Jiménez');
  });
});
