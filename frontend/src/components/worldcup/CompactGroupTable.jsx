import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';
import { getTeamFlag } from '@/lib/teamMeta';

const qualificationZoneRow = {
  direct: 'border-l-4 border-l-emerald-500',
  third_possible: 'border-l-4 border-l-sky-400',
};

export function QualificationLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        Dieciseisavos de final
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 shrink-0 rounded-full bg-sky-400" aria-hidden />
        Posible clasificado
      </span>
    </div>
  );
}

export default function CompactGroupTable({ group }) {
  if (!group?.standings?.length) return null;

  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="px-2 py-1.5 pb-1">
        <CardTitle className="text-xs font-semibold">Grupo {group.group}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-0">
        <table className="w-full table-fixed text-[10px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="w-4 py-0.5 text-center font-medium">#</th>
              <th className="py-0.5 text-left font-medium">Equipo</th>
              <th className="w-6 py-0.5 text-center font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {group.standings.map((row) => {
              const name = row.nameEn || row.teamId || '—';
              const flagUrl = getTeamFlag(row);
              return (
                <tr
                  key={row.teamId || row.rank}
                  className={cn(
                    'border-b border-border/60',
                    qualificationZoneRow[row.qualificationZone] || 'border-l-2 border-l-transparent'
                  )}
                >
                  <td className="py-0.5 text-center text-muted-foreground">{row.rank}</td>
                  <td className="min-w-0 py-0.5">
                    <span className="inline-flex min-w-0 items-center gap-1" title={name}>
                      {flagUrl ? (
                        <img
                          src={flagUrl}
                          alt=""
                          className="size-3 shrink-0 rounded-sm border border-border/60 object-cover"
                        />
                      ) : row.flag ? (
                        <span className="shrink-0 text-[9px]">{row.flag}</span>
                      ) : null}
                      <span className="truncate font-medium">{row.fifaCode || name}</span>
                    </span>
                  </td>
                  <td className="py-0.5 text-center font-semibold tabular-nums">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
