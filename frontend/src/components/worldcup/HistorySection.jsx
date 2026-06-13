import { useCallback } from 'react';
import { worldCupApi } from '../../api/client.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import { getTeamFlag } from '../../lib/teamMeta.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import LoadingSpinner from '@/components/LoadingSpinner.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';

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

export default function HistorySection() {
  const fetchHistory = useCallback(() => worldCupApi.history(), []);
  const { data, loading, error } = useLiveData(fetchHistory, []);

  if (loading && !data) {
    return <LoadingSpinner variant="compact" label="Cargando historia del Mundial…" />;
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!data) return null;

  const finals = data.finals ?? [];
  const titles = data.titlesByNation ?? [];
  const allTime = data.allTimeTopScorers ?? [];
  const byTournament = data.topScorersByTournament ?? [];
  const squadLegends = data.squadLegends ?? [];
  const wc2026 = data.tournament2026PlayerStats ?? {};

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
        {data.syncedAt
          ? ` · actualizado ${new Date(data.syncedAt).toLocaleDateString('es-AR')}`
          : ''}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Copas del Mundo por selección</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {titles.map((row) => (
                <li key={row.fifaCode} className="flex items-center justify-between gap-2">
                  <NationCell fifaCode={row.fifaCode} name={row.name} />
                  <span className="font-semibold tabular-nums">{row.titles}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

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
      </div>

      {squadLegends.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leyendas en el Mundial 2026</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Jugadores convocados en este torneo con historial de goles en Copas del Mundo.
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {squadLegends.map((row) => (
                <li key={row.playerId} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{row.fullName}</span>
                  <span className="text-muted-foreground">
                    {row.careerWorldCupGoals} goles en Mundiales · ranking histórico #{row.careerRank}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campeones del mundo (todas las finales)</CardTitle>
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
              {[...finals].reverse().map((row) => (
                <TableRow key={row.year}>
                  <TableCell className="font-medium tabular-nums">{row.year}</TableCell>
                  <TableCell>{row.hostLabel ?? '—'}</TableCell>
                  <TableCell>
                    <NationCell fifaCode={row.winnerFifa} name={row.winnerName} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.finalScore ?? '—'}
                    {row.penalties ? ' (pen.)' : ''}
                    {row.extraTime && !row.penalties ? ' (a.e.t.)' : ''}
                  </TableCell>
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
          {[...byTournament].reverse().map((edition) => (
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goleadores — Mundial 2026 (jugadores convocados)</CardTitle>
        </CardHeader>
        <CardContent>
          {wc2026.leaders?.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {wc2026.leaders.map((row) => (
                <li key={row.playerId} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2">
                    {getTeamFlag({ fifaCode: row.fifaCode, flag: row.flag }) ? (
                      <img
                        src={getTeamFlag({ fifaCode: row.fifaCode, flag: row.flag })}
                        alt=""
                        className="size-5 rounded-sm object-cover"
                      />
                    ) : null}
                    <span className="font-medium">{row.fullName}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{row.goals} goles</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {wc2026.note ??
                'Todavía no hay goles de jugadores registrados en este torneo.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
