/** Flags de capas para PitchFormation (vista Normal interactiva vs modos heatmap). */
export function resolvePitchFormationLayers({
  hasPlayers = false,
  showEventLayer = false,
  heatmapMode = 'normal',
} = {}) {
  const isNormalView = !heatmapMode || heatmapMode === 'normal';
  const isGoalsView = heatmapMode === 'goals';
  const isHeatmapView =
    heatmapMode === 'shots' || heatmapMode === 'fouls' || heatmapMode === 'goals';

  /** Calor de ataque semitransparente: vista Normal y Calor goles. */
  const showAttackHeatmapLayer =
    showEventLayer && (isNormalView || isGoalsView);
  /** Mapa denso por tipo: solo tiros y faltas (goles usa overlay + pins). */
  const showHeatmapLayer =
    showEventLayer && (heatmapMode === 'shots' || heatmapMode === 'fouls');
  const showPlayerLayer = hasPlayers && isNormalView;
  const showEventPins = showEventLayer && isHeatmapView;
  const showTeamLabels =
    showPlayerLayer || showHeatmapLayer || showAttackHeatmapLayer;

  const shouldRenderPitch = hasPlayers || showEventLayer;

  return {
    isNormalView,
    isGoalsView,
    isHeatmapView,
    showAttackHeatmapLayer,
    showHeatmapLayer,
    showPlayerLayer,
    showEventPins,
    showTeamLabels,
    shouldRenderPitch,
  };
}
