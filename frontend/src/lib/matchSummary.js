function countBySide(events, type) {
  let home = 0;
  let away = 0;

  for (const event of events ?? []) {
    if (event.type !== type) continue;
    if (event.side === 'home') home += 1;
    else if (event.side === 'away') away += 1;
  }

  return { home, away };
}

function formatPct(value) {
  return value != null && !Number.isNaN(value) ? `${value}%` : '—';
}

function formatCount(value) {
  return value != null && !Number.isNaN(value) ? String(value) : '—';
}

function pickCount(reportValue, timelineCount) {
  return reportValue != null ? reportValue : timelineCount;
}

/**
 * Filas para el resumen local | etiqueta | visitante.
 * Prioriza fifaReportStats (PDF oficial); completa con conteos del timeline.
 */
export function buildMatchSummaryRows({ timeline = [], reportStats = null } = {}) {
  const events = timeline ?? [];
  const homeReport = reportStats?.home ?? {};
  const awayReport = reportStats?.away ?? {};

  const fouls = countBySide(events, 'foul');
  const yellows = countBySide(events, 'yellow_card');
  const reds = countBySide(events, 'red_card');
  const subs = countBySide(events, 'substitution');

  const rows = [];

  if (homeReport.possession != null || awayReport.possession != null) {
    rows.push({
      label: 'Posesión',
      home: formatPct(homeReport.possession),
      away: formatPct(awayReport.possession),
    });
  }

  rows.push({
    label: 'Faltas',
    home: formatCount(pickCount(homeReport.foulsAgainst, fouls.home)),
    away: formatCount(pickCount(awayReport.foulsAgainst, fouls.away)),
  });

  rows.push({
    label: 'Amarillas',
    home: formatCount(pickCount(homeReport.yellowCards, yellows.home)),
    away: formatCount(pickCount(awayReport.yellowCards, yellows.away)),
  });

  rows.push({
    label: 'Rojas',
    home: formatCount(pickCount(homeReport.redCards, reds.home)),
    away: formatCount(pickCount(awayReport.redCards, reds.away)),
  });

  if (subs.home > 0 || subs.away > 0) {
    rows.push({
      label: 'Cambios',
      home: formatCount(subs.home),
      away: formatCount(subs.away),
    });
  }

  return rows;
}
