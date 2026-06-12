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
  return value != null && !Number.isNaN(value) ? `${value}%` : null;
}

function formatCount(value) {
  return value != null && !Number.isNaN(value) ? String(value) : null;
}

function formatPenalties(total, scored) {
  if (total == null && scored == null) return null;
  return `${total ?? 0} / ${scored ?? 0}`;
}

function pickCount(reportValue, timelineCount) {
  return reportValue != null ? reportValue : timelineCount;
}

function totalRedCards(reportSide) {
  const direct = reportSide?.directRedCards ?? 0;
  const secondYellow = reportSide?.redCardsSecondYellow ?? 0;
  if (reportSide?.directRedCards == null && reportSide?.redCardsSecondYellow == null) {
    return null;
  }
  return direct + secondYellow;
}

function readSide(reportSide, key) {
  return reportSide?.[key] ?? null;
}

function pushRow(rows, label, home, away) {
  if (home == null && away == null) return;
  rows.push({
    label,
    home: home ?? '—',
    away: away ?? '—',
  });
}

/**
 * Filas para el resumen local | etiqueta | visitante.
 * Prioriza fifaReportStats (PDF oficial); completa faltas/tarjetas con el timeline.
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

  pushRow(
    rows,
    'Posesión',
    formatPct(readSide(homeReport, 'possession')),
    formatPct(readSide(awayReport, 'possession'))
  );

  pushRow(
    rows,
    'Tiros',
    formatCount(readSide(homeReport, 'attemptsTotal')),
    formatCount(readSide(awayReport, 'attemptsTotal'))
  );

  pushRow(
    rows,
    'Al arco',
    formatCount(readSide(homeReport, 'attemptsOnTarget')),
    formatCount(readSide(awayReport, 'attemptsOnTarget'))
  );

  pushRow(
    rows,
    'Bloqueados',
    formatCount(readSide(homeReport, 'attemptsBlocked')),
    formatCount(readSide(awayReport, 'attemptsBlocked'))
  );

  pushRow(
    rows,
    'Faltas',
    formatCount(pickCount(readSide(homeReport, 'foulsAgainst'), fouls.home)),
    formatCount(pickCount(readSide(awayReport, 'foulsAgainst'), fouls.away))
  );

  pushRow(
    rows,
    'Córners',
    formatCount(readSide(homeReport, 'corners')),
    formatCount(readSide(awayReport, 'corners'))
  );

  pushRow(
    rows,
    'Tiros libres',
    formatCount(readSide(homeReport, 'directFreeKicks')),
    formatCount(readSide(awayReport, 'directFreeKicks'))
  );

  pushRow(
    rows,
    'Offside',
    formatCount(readSide(homeReport, 'offsides')),
    formatCount(readSide(awayReport, 'offsides'))
  );

  pushRow(
    rows,
    'Penales',
    formatPenalties(readSide(homeReport, 'penaltiesTotal'), readSide(homeReport, 'penaltiesScored')),
    formatPenalties(readSide(awayReport, 'penaltiesTotal'), readSide(awayReport, 'penaltiesScored'))
  );

  pushRow(
    rows,
    'Autogoles',
    formatCount(readSide(homeReport, 'ownGoals')),
    formatCount(readSide(awayReport, 'ownGoals'))
  );

  pushRow(
    rows,
    'Amarillas',
    formatCount(pickCount(readSide(homeReport, 'yellowCards'), yellows.home)),
    formatCount(pickCount(readSide(awayReport, 'yellowCards'), yellows.away))
  );

  const homeReds =
    totalRedCards(homeReport) ??
    (reds.home > 0 || reportStats == null ? reds.home : null);
  const awayReds =
    totalRedCards(awayReport) ??
    (reds.away > 0 || reportStats == null ? reds.away : null);

  pushRow(rows, 'Rojas', formatCount(homeReds), formatCount(awayReds));

  if (subs.home > 0 || subs.away > 0) {
    pushRow(rows, 'Cambios', formatCount(subs.home), formatCount(subs.away));
  }

  return rows;
}

/** Subtítulo del resumen cuando faltan stats oficiales del PDF FIFA. */
export function getMatchSummaryNotice(status, hasReportStats) {
  if (hasReportStats) return null;
  if (status === 'live') return 'Estadísticas parciales (en curso)';
  if (status === 'finished') return 'Parcial (cronología) · reporte FIFA pendiente';
  return null;
}

export function formatMatchAttendance(reportStats) {
  const attendance = reportStats?.attendance;
  if (attendance == null || Number.isNaN(attendance)) return null;
  return new Intl.NumberFormat('es-AR').format(attendance);
}
