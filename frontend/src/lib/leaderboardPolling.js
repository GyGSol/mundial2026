/** ¿Debe el ranking seguir haciendo poll? Con en vivo, baseline activo o próximos partidos. */
export function shouldPollLeaderboardLive(data) {
  if ((data?.liveMatches?.length ?? 0) > 0) return true;
  if ((data?.leaderboardKickoffBaseline?.length ?? 0) > 0) return true;
  return (data?.nextUpcomingMatches?.length ?? 0) > 0;
}
