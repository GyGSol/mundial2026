import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { GroupColorSwatch } from '@/components/worldcup/GroupColorUi.jsx';
import { getGroupRowBorderStyle } from '@/lib/groupColors.js';
import { getTeamFlag } from '@/lib/teamMeta';
import { cn } from '@/lib/utils';

const statHead =
  'w-7 px-0.5 text-center text-[10px] font-medium sm:w-8 sm:px-1 sm:text-xs md:w-9';
const statCell =
  'w-7 px-0.5 py-1.5 text-center tabular-nums text-xs sm:w-8 sm:px-1 sm:py-2 sm:text-sm md:w-9';

function resolveTeam(row, teamMap) {
  if (!row?.teamId) return row;
  return teamMap?.[row.teamId] ? { ...row, ...teamMap[row.teamId] } : row;
}

function StatusBadge({ qualifies, provisional }) {
  if (!qualifies) {
    return (
      <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
        Fuera
      </Badge>
    );
  }
  if (provisional) {
    return (
      <Badge className="border-amber-500/40 bg-amber-500/10 text-[10px] font-normal text-amber-900 dark:text-amber-200">
        Provisional
      </Badge>
    );
  }
  return (
    <Badge className="border-emerald-600/40 bg-emerald-600/10 text-[10px] font-normal text-emerald-900 dark:text-emerald-200">
      Clasifica
    </Badge>
  );
}

export default function ThirdPlaceStandingsSection({ thirdPlaceStandings, teamMap }) {
  const ranked = thirdPlaceStandings?.ranked ?? [];
  if (!ranked.length) return null;

  const provisional = Boolean(thirdPlaceStandings?.provisional);
  const combinationKey = thirdPlaceStandings?.combinationKey;

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Mejores terceros</CardTitle>
        <p className="text-xs text-muted-foreground">
          De los 12 terceros del torneo clasifican los 8 mejores según puntos, diferencia de goles
          y goles a favor. Si están empatados en todo, se usa el orden alfabético del grupo (A…L).
          Los cruces de dieciseisavos se asignan con Annex C según qué grupos aportan esos ocho
          terceros.
          {provisional
            ? ' Marcado como provisional mientras no todos los equipos hayan jugado sus 3 partidos.'
            : null}
        </p>
        {combinationKey ? (
          <p className="text-xs font-medium text-foreground">
            Combinación Annex C:{' '}
            <span className="font-mono tracking-wide">{combinationKey.split('').join(' · ')}</span>
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="px-2 pb-2 sm:px-4">
        <table className="w-full table-fixed caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b border-border">
              <th className={cn(statHead, 'w-8')}>#</th>
              <th className="h-9 w-10 px-1 text-center align-middle text-xs font-medium text-muted-foreground">
                Gp
              </th>
              <th className="h-9 min-w-0 px-1 text-left align-middle text-xs font-medium text-muted-foreground sm:px-2 sm:text-sm">
                Equipo
              </th>
              <th className={statHead}>PJ</th>
              <th className={statHead}>DG</th>
              <th className={statHead}>GF</th>
              <th className={cn(statHead, 'font-semibold text-foreground')}>Pts</th>
              <th className="h-9 min-w-[4.5rem] px-1 text-center align-middle text-xs font-medium text-muted-foreground">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {ranked.map((row) => {
              const team = resolveTeam(row, teamMap);
              const name = team.nameEn || team.teamId || '—';
              const flagUrl = getTeamFlag(team);

              return (
                <tr
                  key={`${row.group}-${row.teamId}`}
                  className={cn(
                    'border-b border-border border-l-solid transition-colors',
                    row.qualifies ? 'bg-emerald-500/5' : 'opacity-80'
                  )}
                  style={getGroupRowBorderStyle(row.group, 3)}
                >
                  <td className="w-8 px-0.5 py-1.5 text-center align-middle text-xs font-medium text-muted-foreground sm:py-2">
                    {row.thirdRank}
                  </td>
                  <td className="px-1 py-1.5 text-center align-middle sm:py-2">
                    <span className="inline-flex items-center justify-center gap-1">
                      <GroupColorSwatch group={row.group} position={3} size="md" />
                      <span className="text-xs font-semibold">{row.group}</span>
                    </span>
                  </td>
                  <td className="min-w-0 px-1 py-1.5 align-middle sm:px-2 sm:py-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5" title={name}>
                      {flagUrl ? (
                        <img
                          src={flagUrl}
                          alt=""
                          className="size-4 shrink-0 rounded-sm border border-border/60 object-cover sm:size-5"
                        />
                      ) : team.flag ? (
                        <span className="shrink-0 text-sm">{team.flag}</span>
                      ) : null}
                      <span className="truncate font-medium sm:hidden">
                        {team.fifaCode || name.slice(0, 3).toUpperCase()}
                      </span>
                      <span className="hidden truncate font-medium sm:inline">{name}</span>
                    </span>
                  </td>
                  <td className={statCell}>{row.played}</td>
                  <td className={statCell}>{row.goalDiff}</td>
                  <td className={statCell}>{row.goalsFor}</td>
                  <td className={cn(statCell, 'font-semibold')}>{row.points}</td>
                  <td className="px-1 py-1.5 text-center align-middle sm:py-2">
                    <StatusBadge qualifies={row.qualifies} provisional={provisional} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
