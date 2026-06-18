/** ¿Debe el ranking seguir haciendo poll? Solo con partidos en vivo o próximos. */
export function shouldPollLeaderboardLive(data) {
  if ((data?.liveMatches?.length ?? 0) > 0) return true;
  return (data?.nextUpcomingMatches?.length ?? 0) > 0;
}
