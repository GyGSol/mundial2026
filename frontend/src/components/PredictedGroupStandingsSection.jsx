import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import PredictedKnockoutSection from '@/components/PredictedKnockoutSection.jsx';
import { GroupStandingsSection } from '@/components/worldcup/WorldCupSections.jsx';

function buildTeamMap(groups, teams = []) {
  const map = Object.fromEntries(teams.map((team) => [team.externalId, team]));
  for (const group of groups ?? []) {
    for (const row of group.standings ?? []) {
      if (row.teamId && !map[row.teamId]) {
        map[row.teamId] = row;
      }
    }
  }
  return map;
}

export default function PredictedGroupStandingsSection({
  groups,
  knockout,
  thirdPlaceStandings,
  teams,
  loading,
  error,
  onGroupSelect,
}) {
  if (loading && !groups?.length) {
    return <p className="text-sm text-muted-foreground">Cargando tablas de grupos...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!groups?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay datos de grupos para armar tus tablas de predicción.
      </p>
    );
  }

  const groupsWithOmitted = groups.filter((group) => group.matchCounts?.omitted > 0);

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-2 p-4 text-sm text-foreground">
          <p>Resultados reales en partidos ya jugados.</p>
          <p>Tus predicciones guardadas en partidos pendientes.</p>
          <p className="text-muted-foreground">
            Los partidos sin predicción cargada no aparecen en la tabla.
          </p>
          {onGroupSelect ? (
            <p className="text-muted-foreground">Tocá un grupo para ver sus partidos.</p>
          ) : null}
        </CardContent>
      </Card>

      {groupsWithOmitted.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {groupsWithOmitted.map((group) => (
            <Badge key={group.group} variant="outline" className="text-xs">
              Grupo {group.group}: {group.matchCounts.omitted} sin predicción cargada
            </Badge>
          ))}
        </div>
      ) : null}

      <GroupStandingsSection
        groups={groups}
        thirdPlaceStandings={thirdPlaceStandings}
        teamMap={buildTeamMap(groups, teams)}
        onGroupClick={onGroupSelect}
      />

      <div className="flex flex-col gap-3 pt-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Simulación de fase final
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cruces posibles según tus predicciones. Se actualiza al guardar resultados en grupos o
            eliminatorios.
          </p>
        </div>
        <PredictedKnockoutSection knockout={knockout} />
      </div>
    </div>
  );
}
