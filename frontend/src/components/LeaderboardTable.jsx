import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';

const statColumns = [
  { key: 'pa', label: 'PA', title: 'Acierto resultado' },
  { key: 'gl', label: 'GL', title: 'Goles local' },
  { key: 'gv', label: 'GV', title: 'Goles visitante' },
  { key: 'gt', label: 'GT', title: 'Goles totales' },
];

export default function LeaderboardTable({ leaderboard, showGroupName = false }) {
  if (!leaderboard?.length) {
    return <p className="text-muted-foreground">Aún no hay jugadores en el ranking.</p>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Jugador</TableHead>
              {statColumns.map((col) => (
                <TableHead key={col.key} className="text-center" title={col.title}>
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="text-center" title="Puntos bonus (consuelo)">
                PB
              </TableHead>
              <TableHead className="text-right">Puntos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">{row.rank}</TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center justify-between gap-2">
                    <span>{row.name}</span>
                    {showGroupName && row.groupName ? (
                      <span className="text-xs font-normal text-muted-foreground">{row.groupName}</span>
                    ) : null}
                  </div>
                </TableCell>
                {statColumns.map((col) => (
                  <TableCell key={col.key} className="text-center tabular-nums">
                    {row[col.key] ?? 0}
                  </TableCell>
                ))}
                <TableCell className="text-center tabular-nums">{row.pb ?? 0}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {row.totalPoints}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
