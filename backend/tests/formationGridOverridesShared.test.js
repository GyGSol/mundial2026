import { describe, it, expect } from 'vitest';
import {
  applyFormationGridOverridesToLineupPlayers,
  formationOverrideKey,
} from '../shared/formationGridOverrides.js';
import { applyLiveLineupState } from '../frontend/src/lib/lineupLiveState.js';

describe('formationGridOverrides shared', () => {
  it('formationOverrideKey usa dorsal o nombre', () => {
    expect(formationOverrideKey('home', 16, 'Dahmen')).toBe('home:16');
    expect(formationOverrideKey('away', null, 'Depay')).toBe('away:Depay');
    expect(formationOverrideKey('home', '', 'Sin dorsal')).toBe('home:Sin dorsal');
  });

  it('reaplica overrides después de sustituciones en vivo', () => {
    const lineup = {
      status: 'confirmed',
      home: {
        formation: '4-3-3',
        players: [
          { name: 'A', shirtNumber: 9, gridX: 70, gridY: 50, position: 'FWD' },
          { name: 'B', shirtNumber: 10, gridX: 50, gridY: 50, position: 'MID' },
        ],
      },
      away: { formation: '4-4-2', players: [] },
    };
    const overrides = {
      'home:10': { gridX: 22, gridY: 40 },
    };
    const subs = [
      {
        minute: 60,
        playerOut: 'B',
        playerOutShirtNumber: 10,
        playerIn: 'C',
        playerInShirtNumber: 10,
        playerInPosition: 'MID',
      },
    ];
    const live = applyLiveLineupState(lineup, subs, [], []);
    const patched = applyFormationGridOverridesToLineupPlayers(live, overrides);
    const player10 = patched.home.players.find((p) => p.shirtNumber === 10);
    expect(player10?.gridX).toBe(22);
    expect(player10?.gridY).toBe(40);
  });
});
