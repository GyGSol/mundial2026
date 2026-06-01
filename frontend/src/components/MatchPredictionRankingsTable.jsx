import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';

const statColumns = [
  { key: 'pa', label: 'PA', title: 'Acierto resultado' },
  { key: 'gl', label: 'GL', title: 'Goles local' },
  { key: 'gv', label: 'GV', title: 'Goles visitante' },
  { key: 'gt', label: 'GT', title: 'Goles totales' },
];

export default function MatchPredictionRankingsTable({
  rankings,
  groupName,
  compact = false,
  onlyScorers = true,
}) {
  const rows = onlyScorers ? (rankings || []).filter((row) => row.points > 0) : rankings || [];

  if (!rows.length) {
    return null;
  }

  return (
    <div className="rounded-md border border-border/70 bg-muted/10 px-2 py-2">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Quienes sumaron puntos{groupName ? ` · ${groupName}` : ''}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={compact ? 'h-8 px-2' : undefined}>#</TableHead>
            <TableHead className={compact ? 'h-8 px-2' : undefined}>Jugador</TableHead>
            {statColumns.map((col) => (
              <TableHead
                key={col.key}
                className={compact ? 'h-8 px-2 text-center' : 'text-center'}
                title={col.title}
              >
                {col.label}
              </TableHead>
            ))}
            <TableHead className={compact ? 'h-8 px-2 text-center' : 'text-center'} title="Punto bonus">
              PB
            </TableHead>
            <TableHead className={compact ? 'h-8 px-2 text-right' : 'text-right'}>Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className={compact ? 'px-2 py-1 text-muted-foreground' : 'text-muted-foreground'}>
                {row.rank}
              </TableCell>
              <TableCell className={compact ? 'px-2 py-1' : undefined}>
                <span className="font-medium">{row.name}</span>
                {row.bonusReason && (
                  <p className="mt-0.5 text-[11px] leading-snug text-amber-700">{row.bonusReason}</p>
                )}
              </TableCell>
              {statColumns.map((col) => (
                <TableCell
                  key={col.key}
                  className={compact ? 'px-2 py-1 text-center tabular-nums' : 'text-center tabular-nums'}
                >
                  {row[col.key] ?? 0}
                </TableCell>
              ))}
              <TableCell className={compact ? 'px-2 py-1 text-center tabular-nums' : 'text-center tabular-nums'}>
                {row.pb ?? 0}
              </TableCell>
              <TableCell
                className={
                  compact ? 'px-2 py-1 text-right font-semibold tabular-nums' : 'text-right font-semibold tabular-nums'
                }
              >
                {row.points}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
