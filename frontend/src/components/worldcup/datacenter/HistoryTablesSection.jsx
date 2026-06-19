import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { getTeamFlag } from '@/lib/teamMeta.js';

function NationCell({ fifaCode, name }) {
  const flag = getTeamFlag({ fifaCode, nameEn: name });
  return (
    <span className="inline-flex items-center gap-2">
      {flag ? (
        <img src={flag} alt="" className="size-5 rounded-sm border border-border/60 object-cover" />
      ) : null}
      <span>{name || fifaCode}</span>
    </span>
  );
}

export default function HistoryTablesSection({ history = {}, syncedAt }) {
  const finals = history.finals ?? [];
  const allTime = history.allTimeTopScorers ?? [];
  const byTournament = history.topScorersByTournament ?? [];
  const squadLegends = history.squadLegends ?? [];
  const wc2026 = history.tournament2026PlayerStats ?? {};

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Datos históricos desde{' '}
        <a
          href="https://en.wikipedia.org/wiki/FIFA_World_Cup"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Wikipedia
        </a>
        {syncedAt ? ` · actualizado ${new Date(syncedAt).toLocaleDateString('es-AR')}` : ''}
      </p>

      {squadLegends.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leyendas en el Mundial 2026</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Jugadores convocados con historial de goles en Copas del Mundo.
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {squadLegends.map((row) => (
                <li key={row.playerId} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{row.fullName}</span>
                  <span className="text-muted-foreground">
                    {row.careerWorldCupGoals} goles en Mundiales · #{row.careerRank}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Máximos goleadores históricos</CardTitle>
        </CardHeader>
        <CardContent className="max-h-80 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Jugador</TableHead>
                <TableHead>Selección</TableHead>
                <TableHead className="text-right">Goles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allTime.slice(0, 25).map((row) => (
                <TableRow key={`${row.rank}-${row.playerName}`}>
                  <TableCell className="tabular-nums">{row.rank}</TableCell>
                  <TableCell className="font-medium">{row.playerName}</TableCell>
                  <TableCell>
                    <NationCell fifaCode={row.nationFifa} name={row.nationName} />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{row.goals}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finales históricas (últimas 10)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Año</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead>Campeón</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Subcampeón</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...finals].reverse().slice(0, 10).map((row) => (
                <TableRow key={row.year}>
                  <TableCell className="font-medium tabular-nums">{row.year}</TableCell>
                  <TableCell>{row.hostLabel ?? '—'}</TableCell>
                  <TableCell>
                    <NationCell fifaCode={row.winnerFifa} name={row.winnerName} />
                  </TableCell>
                  <TableCell className="tabular-nums">{row.finalScore ?? '—'}</TableCell>
                  <TableCell>
                    <NationCell fifaCode={row.runnerUpFifa} name={row.runnerUpName} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goleadores por Mundial</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...byTournament].reverse().slice(0, 12).map((edition) => (
            <div key={edition.year} className="rounded-lg border border-border/70 p-3 text-sm">
              <p className="mb-2 font-semibold">
                {edition.year}
                {edition.hostLabel ? ` · ${edition.hostLabel}` : ''}
              </p>
              <ul className="flex flex-col gap-1 text-muted-foreground">
                {edition.topScorers.map((scorer) => (
                  <li key={`${edition.year}-${scorer.playerName}`} className="flex justify-between gap-2">
                    <span>{scorer.playerName}</span>
                    <span className="font-medium tabular-nums text-foreground">{scorer.goals}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {wc2026.leaders?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Goleadores — Mundial 2026</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {wc2026.leaders.map((row) => (
                <li key={row.playerId} className="flex items-center justify-between gap-2">
                  <span className="font-medium">{row.fullName}</span>
                  <span className="font-semibold tabular-nums">{row.goals} goles</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
