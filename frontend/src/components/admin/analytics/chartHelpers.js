export function formatKickoffShort(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(iso));
}

export function matchLabel(externalId, matchIndex) {
  return `#${externalId ?? matchIndex ?? '?'}`;
}

export function withChartLabels(rows, idKey = 'externalId') {
  return (rows ?? []).map((row, idx) => ({
    ...row,
    label: matchLabel(row[idKey], row.matchIndex ?? idx + 1),
  }));
}
