import { describe, expect, it } from 'vitest';
import { resolvePitchFormationLayers } from './pitchFormationDisplay.js';

describe('resolvePitchFormationLayers', () => {
  const base = {
    hasPlayers: true,
    showEventLayer: true,
    heatmapMode: 'normal',
  };

  it('vista Normal mantiene jugadores y calor de ataque', () => {
    const layers = resolvePitchFormationLayers(base);
    expect(layers.showPlayerLayer).toBe(true);
    expect(layers.showAttackHeatmapLayer).toBe(true);
    expect(layers.showEventPins).toBe(false);
    expect(layers.showHeatmapLayer).toBe(false);
  });

  it('Calor goles usa overlay semitransparente sin jugadores', () => {
    const layers = resolvePitchFormationLayers({
      ...base,
      heatmapMode: 'goals',
    });
    expect(layers.showAttackHeatmapLayer).toBe(true);
    expect(layers.showPlayerLayer).toBe(false);
    expect(layers.showEventPins).toBe(true);
    expect(layers.showHeatmapLayer).toBe(false);
  });

  it('Calor tiros usa mapa denso sin overlay Normal', () => {
    const layers = resolvePitchFormationLayers({
      ...base,
      heatmapMode: 'shots',
    });
    expect(layers.showAttackHeatmapLayer).toBe(false);
    expect(layers.showHeatmapLayer).toBe(true);
    expect(layers.showPlayerLayer).toBe(false);
    expect(layers.showEventPins).toBe(true);
  });

  it('renderiza cancha interactiva sin jugadores (pre-kickoff)', () => {
    expect(
      resolvePitchFormationLayers({
        hasPlayers: false,
        showEventLayer: true,
      }).shouldRenderPitch
    ).toBe(true);
  });
});
