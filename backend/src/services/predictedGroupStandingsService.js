import {
  applyResult,
  createStanding,
  isGroupPhaseMatch,
  sortStandings,
} from './groupStandingsUtils.js';

export function computePredictedGroupStandings(teams, matches, predictionsByMatchId) {
  const groupMatches = matches.filter(isGroupPhaseMatch);

  const teamsByGroup = new Map();
  for (const team of teams) {
    const groupName = String(team.group || '').toUpperCase();
    if (!groupName) continue;
    if (!teamsByGroup.has(groupName)) teamsByGroup.set(groupName, []);
    teamsByGroup.get(groupName).push(team);
  }

  const results = [];

  for (const [groupName, groupTeams] of teamsByGroup.entries()) {
    const standingsMap = new Map(groupTeams.map((team) => [team.externalId, createStanding(team)]));
    const matchCounts = { real: 0, predicted: 0, omitted: 0 };

    for (const match of groupMatches) {
      if (String(match.group || '').toUpperCase() !== groupName) continue;

      const matchKey = match._id?.toString() ?? match.id;
      const prediction = predictionsByMatchId.get(matchKey);

      let homeGoals;
      let awayGoals;

      if (match.status === 'finished') {
        homeGoals = match.homeScore;
        awayGoals = match.awayScore;
        matchCounts.real += 1;
      } else if (prediction?.userSubmitted) {
        homeGoals = prediction.homeGoals;
        awayGoals = prediction.awayGoals;
        matchCounts.predicted += 1;
      } else {
        matchCounts.omitted += 1;
        continue;
      }

      const home = standingsMap.get(match.homeTeamId);
      const away = standingsMap.get(match.awayTeamId);
      if (!home || !away) continue;

      applyResult(home, homeGoals, awayGoals);
      applyResult(away, awayGoals, homeGoals);
    }

    const standings = sortStandings([...standingsMap.values()]).map((row, index) => ({
      ...row,
      rank: index + 1,
      source: 'predicted',
    }));

    results.push({
      group: groupName,
      standings,
      matchCounts,
      source: 'predicted',
    });
  }

  return results.sort((a, b) => a.group.localeCompare(b.group));
}
