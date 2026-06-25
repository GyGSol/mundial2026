import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyLiveLineupState, normalizeLineupForPitch } from './lineupLiveState.js';

const archive = JSON.parse(readFileSync('/tmp/finished-archive.json', 'utf8'));

function sidePlayers(match, side) {
  const live = applyLiveLineupState(
    match.lineup,
    match.homeSubstitutions,
    match.awaySubstitutions,
    match.matchTimeline ?? []
  );
  const normalized = normalizeLineupForPitch(live);
  return normalized[side]?.players ?? [];
}

function findPlayer(players, fragment) {
  return players.find(
    (p) =>
      (p.name || '').includes(fragment) ||
      (p.shortName || '').includes(fragment) ||
      (p.displayName || '').includes(fragment)
  );
}

function grid(player) {
  if (!player) return null;
  return `${Number(player.gridX).toFixed(0)}/${Number(player.gridY).toFixed(0)}`;
}

const TARGETS = {
  '6a3561d0d7b38e7ae4b3aeb6': {
    home: {
      Ordóñez: '40/20',
      Pacho: '30/30',
      Torres: '30/50',
      Estupiñán: '30/60',
      Preciado: '40/80',
    },
    away: {
      Gross: '50/20',
      Sané: '60/70',
      Beier: '90/40',
      Undav: '90/60',
    },
  },
  '6a3561d0d7b38e7ae4b3aeb0': {
    home: { Mazraoui: '20/40', Riad: '20/60' },
    away: { Deedson: '90/40', Pierrot: '90/60', Adé: '30/40', Delcroix: '30/60' },
  },
  '6a3561d0d7b38e7ae4b3aeaf': {
    home: {
      McTominay: '50/30',
      Ferguson: '50/60',
      Christie: '70/20',
      McLean: '70/90',
      Hendry: '20/40',
      Ralston: '30/60',
    },
    away: {
      Neymar: '90/40',
      Endrick: '90/60',
      Marquinhos: '30/40',
      Sandro: '30/60',
    },
  },
  '6a3561d0d7b38e7ae4b3aeb1': {
    home: { Elvedi: '30/40', Akanji: '30/60' },
  },
  '6a3561cfd7b38e7ae4b3aea0': {
    away: { Floranus: '20/50', 'van Eijma': '30/30', Obispo: '30/70' },
  },
};

describe('FBL-9 finished-match manual grids (batch)', () => {
  for (const [matchId, sides] of Object.entries(TARGETS)) {
    const match = archive.finishedMatches.find((m) => m.id === matchId);
    if (!match) {
      it.skip(`missing match ${matchId}`, () => {});
      continue;
    }

    for (const [side, players] of Object.entries(sides)) {
      it(`${match.homeTeam?.nameEn} vs ${match.awayTeam?.nameEn} (${side})`, () => {
        const lineup = sidePlayers(match, side);
        for (const [name, expected] of Object.entries(players)) {
          const player = findPlayer(lineup, name);
          expect(grid(player), `${name} missing`).not.toBeNull();
          expect(grid(player), name).toBe(expected);
        }
      });
    }
  }
});
