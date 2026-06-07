import { describe, it, expect } from 'vitest';
import {
  BRACKET_NODES,
  OFFICIAL_KNOCKOUT_MATCH_IDS,
  getBracketConnectors,
  isOfficialKnockoutBracket,
} from '../../frontend/src/lib/worldCupBracketLayout.js';

describe('worldCupBracketLayout', () => {
  it('incluye los 32 partidos eliminatorios oficiales (73–104)', () => {
    expect(Object.keys(BRACKET_NODES)).toHaveLength(32);
    for (const id of OFFICIAL_KNOCKOUT_MATCH_IDS) {
      expect(BRACKET_NODES[id]).toBeDefined();
    }
  });

  it('mapea R16 desde R32 según bracket FIFA', () => {
    expect(BRACKET_NODES['90'].parents).toEqual(['73', '75']);
    expect(BRACKET_NODES['89'].parents).toEqual(['74', '77']);
    expect(BRACKET_NODES['91'].parents).toEqual(['76', '78']);
    expect(BRACKET_NODES['96'].parents).toEqual(['85', '87']);
  });

  it('mapea QF, SF y final', () => {
    expect(BRACKET_NODES['97'].parents).toEqual(['89', '90']);
    expect(BRACKET_NODES['100'].parents).toEqual(['95', '96']);
    expect(BRACKET_NODES['101'].parents).toEqual(['97', '98']);
    expect(BRACKET_NODES['102'].parents).toEqual(['99', '100']);
    expect(BRACKET_NODES['104'].parents).toEqual(['101', '102']);
    expect(BRACKET_NODES['103'].parents).toEqual(['101', '102']);
  });

  it('genera conectores padre → hijo para cada enlace del árbol', () => {
    const connectors = getBracketConnectors();
    expect(connectors.length).toBeGreaterThan(0);
    for (const { from, to } of connectors) {
      expect(BRACKET_NODES[to].parents).toContain(from);
    }
  });

  it('detecta bracket oficial vs simulación', () => {
    const official = [{ matches: [{ externalId: '73' }, { externalId: '104' }] }];
    const sim = [{ matches: [{ externalId: 'sim-1' }] }];
    expect(isOfficialKnockoutBracket(official)).toBe(true);
    expect(isOfficialKnockoutBracket(sim)).toBe(false);
  });
});
