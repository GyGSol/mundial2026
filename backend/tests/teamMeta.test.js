import { describe, expect, it } from 'vitest';
import { fifaCodeToFlagIso, getFifaRankingForTeam, getTeamFlag } from '../../frontend/src/lib/teamMeta.js';

describe('teamMeta flags', () => {
  it('mapea códigos FIFA que no coinciden con las dos primeras letras del ISO', () => {
    expect(fifaCodeToFlagIso('URU')).toBe('uy');
    expect(fifaCodeToFlagIso('SWE')).toBe('se');
    expect(fifaCodeToFlagIso('GER')).toBe('de');
    expect(fifaCodeToFlagIso('FRG')).toBe('de');
    expect(fifaCodeToFlagIso('NED')).toBe('nl');
    expect(fifaCodeToFlagIso('SUI')).toBe('ch');
    expect(fifaCodeToFlagIso('RSA')).toBe('za');
    expect(fifaCodeToFlagIso('CRO')).toBe('hr');
    expect(fifaCodeToFlagIso('KOR')).toBe('kr');
    expect(fifaCodeToFlagIso('DEN')).toBe('dk');
  });

  it('genera URL flagcdn con ISO correcto', () => {
    expect(getTeamFlag({ fifaCode: 'URU' })).toBe('https://flagcdn.com/w80/uy.png');
    expect(getTeamFlag({ fifaCode: 'GER' })).toBe('https://flagcdn.com/w80/de.png');
    expect(getTeamFlag({ fifaCode: 'FRG' })).toBe('https://flagcdn.com/w80/de.png');
  });

  it('resuelve ranking FIFA con alias KSA ↔ SAU', () => {
    expect(getFifaRankingForTeam('KSA')).toEqual({ rank: 61, asOf: '2026-06-11' });
    expect(getFifaRankingForTeam({ fifaCode: 'KSA' })).toEqual({ rank: 61, asOf: '2026-06-11' });
    expect(getFifaRankingForTeam('SAU')).toEqual({ rank: 61, asOf: '2026-06-11' });
  });
});
