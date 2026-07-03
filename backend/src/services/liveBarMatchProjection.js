/** Campos mínimos para enriquecer partidos en vivo / recién finalizados en barras destacadas. */
export const LIVE_BAR_MATCH_PROJECTION =
  'externalId homeTeamId awayTeamId homeScore awayScore group matchday localDate stadiumId type status finishedAt kickoffAt kickoffTimezone liveStartedPushSentAt weatherOps raw.finished raw.time_elapsed raw.home_scorers raw.away_scorers raw.fifaMeta raw.fifaEvents.timeline raw.fifaEvents.rawEvents raw.fifaLiveState raw.lineupSnapshot raw.formationGridOverrides';

/** Lista /predicciones: sin blob raw completo; fifaMeta basta para marcador 120' y penales. */
export const PREDICTIONS_LIST_MATCH_PROJECTION =
  'externalId homeTeamId awayTeamId homeScore awayScore group matchday localDate stadiumId type status finishedAt kickoffAt kickoffTimezone liveStartedPushSentAt weatherOps raw.fifaMeta raw.home_scorers raw.away_scorers';
