import { describe, expect, it } from 'vitest';
import { getGridTemplate, FORMATION_GRID_TEMPLATES } from './formationGridTemplates.js';
import {
  assignPlayersToPitchGrid,
  enforceUniquePitchCells,
  assertNoPitchOverlaps,
  fineCellKey,
} from './formationPitchGrid.js';
import { normalizeLineupSideForPitch } from './lineupLiveState.js';

describe('formationGridTemplates', () => {
  for (const key of ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-2-3']) {
    it(`${key} tiene 11 celdas únicas`, () => {
      const cells = getGridTemplate(key);
      expect(cells).toHaveLength(11);
      const ids = new Set(cells.map((c) => c.id));
      expect(ids.size).toBe(11);
      const coords = new Set(cells.map((c) => `${c.gridX}:${c.gridY}`));
      expect(coords.size).toBe(11);
    });
  }

  it('4-3-3 coloca EI, DC y ED en bandas distintas', () => {
    const cells = FORMATION_GRID_TEMPLATES['4-3-3'];
    const fwd = cells.filter((c) => ['EI', 'DC', 'ED'].includes(c.role));
    expect(fwd).toHaveLength(3);
    const ys = fwd.map((c) => c.gridY);
    expect(new Set(ys).size).toBe(3);
  });

  it('4-4-2 separa dos DC en ataque', () => {
    const cells = FORMATION_GRID_TEMPLATES['4-4-2'];
    const dc = cells.filter((c) => c.role === 'DC');
    expect(dc).toHaveLength(2);
    expect(Math.abs(dc[0].gridY - dc[1].gridY)).toBeGreaterThanOrEqual(24);
  });
});

/** XI tipo SUI–CAN (4-2-3) con dos CF que provocaban solape DC. */
const CANADA_XI = [
  { shirtNumber: 16, name: 'Maxime Crépeau', position: 'GK', positionDetail: 'Goalkeeper' },
  { shirtNumber: 22, name: 'Richie Laryea', position: 'DEF', positionDetail: 'Right Back' },
  { shirtNumber: 13, name: 'Derek Cornelius', position: 'DEF', positionDetail: 'Centre-Back' },
  { shirtNumber: 4, name: 'Luc de Fougerolles', position: 'DEF', positionDetail: 'Centre-Back' },
  { shirtNumber: 2, name: 'Alphonso Johnston', position: 'DEF', positionDetail: 'Left Back' },
  { shirtNumber: 25, name: 'Nathan Saliba', position: 'MID', positionDetail: 'Right Midfield' },
  { shirtNumber: 6, name: 'Mathieu Choinière', position: 'MID', positionDetail: 'Central Midfield' },
  { shirtNumber: 20, name: 'Zakaria Ahmed', position: 'FW', positionDetail: 'Right Winger' },
  { shirtNumber: 17, name: 'Tajon Buchanan', position: 'FW', positionDetail: 'Centre-Forward' },
  { shirtNumber: 9, name: 'Cyle Larin', position: 'FW', positionDetail: 'Left Winger' },
  { shirtNumber: 10, name: 'Jonathan David', position: 'FW', positionDetail: 'Centre-Forward' },
];

describe('formationPitchGrid', () => {
  it('assignPlayersToPitchGrid asigna una celda por jugador', () => {
    const placed = assignPlayersToPitchGrid(CANADA_XI, '4-2-3');
    expect(placed).toHaveLength(11);
    const cellIds = new Set(placed.map((p) => p.pitchGridCellId));
    expect(cellIds.size).toBe(11);
  });

  it('enforceUniquePitchCells separa pares con misma coordenada', () => {
    const stacked = [
      { name: 'A', shirtNumber: 17, position: 'FW', gridX: 85, gridY: 50 },
      { name: 'B', shirtNumber: 10, position: 'FW', gridX: 85, gridY: 50.1 },
      { name: 'C', shirtNumber: 9, position: 'FW', gridX: 85, gridY: 50 },
    ];
    const next = enforceUniquePitchCells(stacked);
    const keys = new Set(next.map((p) => fineCellKey(p.gridX, p.gridY)));
    expect(keys.size).toBe(3);
    expect(assertNoPitchOverlaps(next)).toEqual([]);
  });

  it('regresión Canada 4-4-2: David + Buchanan no comparten celda', () => {
    const side = normalizeLineupSideForPitch(
      { formation: '4-4-2', players: CANADA_XI },
      'away'
    );
    const buchanan = side.players.find((p) => p.shirtNumber === 17);
    const david = side.players.find((p) => p.shirtNumber === 10);
    expect(buchanan).toBeDefined();
    expect(david).toBeDefined();
    expect(buchanan.pitchGridCellId).not.toBe(david.pitchGridCellId);
    expect(
      Math.abs(Number(buchanan.gridY) - Number(david.gridY)) +
        Math.abs(Number(buchanan.gridX) - Number(david.gridX))
    ).toBeGreaterThan(0);
    expect(assertNoPitchOverlaps(side.players)).toEqual([]);
  });

  it('regresión Canada 4-2-3: sin solapes (cuadrícula)', () => {
    const side = normalizeLineupSideForPitch(
      { formation: '4-2-3', players: CANADA_XI },
      'away'
    );
    expect(assertNoPitchOverlaps(side.players)).toEqual([]);
    expect(new Set(side.players.map((p) => p.pitchGridCellId)).size).toBe(11);
  });

  it('no clasifica pivote defensivo como DFC por substring DEF', () => {
    const players = [
      { name: 'GK', shirtNumber: 1, position: 'GK', positionDetail: 'Goalkeeper' },
      { name: 'LB', shirtNumber: 2, position: 'DEF', positionDetail: 'Left Back' },
      { name: 'CB1', shirtNumber: 3, position: 'DEF', positionDetail: 'Centre-Back' },
      { name: 'CB2', shirtNumber: 4, position: 'DEF', positionDetail: 'Centre-Back' },
      { name: 'RB', shirtNumber: 5, position: 'DEF', positionDetail: 'Right Back' },
      { name: 'Adams', shirtNumber: 6, position: 'DEF', positionDetail: 'Defensive Midfield' },
      { name: 'CM1', shirtNumber: 7, position: 'MID', positionDetail: 'Central Midfield' },
      { name: 'CM2', shirtNumber: 8, position: 'MID', positionDetail: 'Central Midfield' },
      { name: 'Pulisic', shirtNumber: 10, position: 'MID', positionDetail: 'Left Winger' },
      { name: 'ST', shirtNumber: 9, position: 'FWD', positionDetail: 'Centre-Forward' },
      { name: 'RW', shirtNumber: 11, position: 'FWD', positionDetail: 'Right Winger' },
    ];
    const placed = assignPlayersToPitchGrid(players, '4-3-3');
    expect(placed.find((p) => p.name === 'Adams')?.pitchGridRole).toBe('MCD');
    expect(placed.find((p) => p.name === 'Pulisic')?.pitchGridRole).toBe('EI');
    expect(placed.filter((p) => p.pitchGridRole === 'DFC')).toHaveLength(2);
  });
});
