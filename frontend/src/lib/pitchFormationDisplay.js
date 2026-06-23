/** Flags de capas para PitchFormation (vista Normal interactiva vs modos heatmap). */
export function resolvePitchFormationLayers({
  hasPlayers = false,
  showEventLayer = false,
  heatmapMode = 'normal',
  homeScore = 0,
  awayScore = 0,
} = {}) {
  const isNormalView = !heatmapMode || heatmapMode === 'normal';
  const isHeatmapView =
    heatmapMode === 'shots' || heatmapMode === 'fouls' || heatmapMode === 'goals';
  const isScoreless = (homeScore ?? 0) === 0 && (awayScore ?? 0) === 0;
  const hasGoals = !isScoreless;

  const showAttackHeatmapLayer = showEventLayer && isNormalView;
  const showHeatmapLayer = showEventLayer && isHeatmapView;
  const showPlayerLayer =
    hasPlayers && isNormalView && !(showEventLayer && isScoreless);
  const showEventPins = showEventLayer && isHeatmapView;
  const showGoalPinsOnNormal = showEventLayer && isNormalView && hasGoals;
  const showTeamLabels =
    showPlayerLayer ||
    showHeatmapLayer ||
    showAttackHeatmapLayer ||
    (showEventLayer && isNormalView);

  const shouldRenderPitch = hasPlayers || showEventLayer;

  return {
    isNormalView,
    isHeatmapView,
    isScoreless,
    hasGoals,
    showAttackHeatmapLayer,
    showHeatmapLayer,
    showPlayerLayer,
    showEventPins,
    showGoalPinsOnNormal,
    showTeamLabels,
    shouldRenderPitch,
  };
}
