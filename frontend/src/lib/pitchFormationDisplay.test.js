import { describe, expect, it } from 'vitest';
import { resolvePitchFormationLayers } from './pitchFormationDisplay.js';

describe('resolvePitchFormationLayers', () => {
  const base = {
    hasPlayers: true,
    showEventLayer: true,
    heatmapMode: 'normal',
  };

  it('a 0-0 oculta jugadores y pins de gol pero muestra calor', () => {
    const layers = resolvePitchFormationLayers({
      ...base,
      homeScore: 0,
      awayScore: 0,
    });
    expect(layers.showPlayerLayer).toBe(false);
    expect(layers.showGoalPinsOnNormal).toBe(false);
    expect(layers.showAttackHeatmapLayer).toBe(true);
    expect(layers.showTeamLabels).toBe(true);
  });

  it('con goles muestra pins sobre el calor en vista Normal', () => {
    const layers = resolvePitchFormationLayers({
      ...base,
      homeScore: 1,
      awayScore: 0,
    });
    expect(layers.showGoalPinsOnNormal).toBe(true);
    expect(layers.showAttackHeatmapLayer).toBe(true);
    expect(layers.showPlayerLayer).toBe(true);
  });

  it('renderiza cancha interactiva sin jugadores (pre-kickoff)', () => {
    expect(
      resolvePitchFormationLayers({
        hasPlayers: false,
        showEventLayer: true,
        homeScore: 0,
        awayScore: 0,
      }).shouldRenderPitch
    ).toBe(true);
  });

  it('modo Tiros no usa overlay Normal de goles', () => {
    const layers = resolvePitchFormationLayers({
      ...base,
      heatmapMode: 'shots',
      homeScore: 2,
      awayScore: 1,
    });
    expect(layers.showGoalPinsOnNormal).toBe(false);
    expect(layers.showEventPins).toBe(true);
    expect(layers.showPlayerLayer).toBe(false);
  });
});
