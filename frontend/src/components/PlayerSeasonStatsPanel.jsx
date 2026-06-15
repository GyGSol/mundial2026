import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { formatKm, formatStatValue, hasPlayerStats, totalSeasonGoals } from '../lib/playerStats.js';

function StatBox({ label, value, hint }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function TotalsGrid({ title, data, kmLabel = 'km/partido' }) {
  if (!data) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <StatBox label="PJ" value={formatStatValue(data.PJ, 0)} />
        <StatBox label="Goles" value={formatStatValue(data.goles, 0)} />
        <StatBox label="Minutos" value={formatStatValue(data.minutos, 0)} />
        <StatBox
          label={kmLabel}
          value={data.kmPromedioPartido != null ? formatKm(data.kmPromedioPartido) : '—'}
          hint={data.kmPromedioPartido != null ? 'Estimado' : undefined}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <StatBox label="Asistencias" value={formatStatValue(data.asistencias, 0)} />
        <StatBox label="Amarillas" value={formatStatValue(data.amarillas, 0)} />
        <StatBox label="Rojas" value={formatStatValue(data.rojas, 0)} />
      </div>
    </div>
  );
}

export default function PlayerSeasonStatsPanel({ stats }) {
  if (!hasPlayerStats(stats)) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin estadísticas del año todavía. Consultá la selección con IA o abrí la ficha del jugador
        para intentar sincronizar desde Football-Data.
      </p>
    );
  }

  const updatedLabel = stats.actualizado
    ? new Date(stats.actualizado).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Temporada {stats.temporada ?? new Date().getFullYear()}</h3>
        <p className="text-xs text-muted-foreground">
          {stats.fuente ? `Fuente: ${stats.fuente}` : null}
          {updatedLabel ? ` · ${updatedLabel}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBox label="Goles totales" value={totalSeasonGoals(stats)} />
        <StatBox label="PJ totales" value={formatStatValue(stats.acumuladoTemporada?.PJ, 0)} />
        <StatBox label="Minutos totales" value={formatStatValue(stats.acumuladoTemporada?.minutos, 0)} />
        <StatBox
          label="Km prom."
          value={
            stats.acumuladoTemporada?.kmPromedioPartido != null
              ? formatKm(stats.acumuladoTemporada.kmPromedioPartido)
              : '—'
          }
          hint="Estimado"
        />
      </div>

      <TotalsGrid title="Club" data={stats.club} />
      <TotalsGrid title="Selección" data={stats.seleccion} />

      {stats.ultimosPartidos?.length ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Últimos partidos
          </h4>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Partido</TableHead>
                  <TableHead>Torneo</TableHead>
                  <TableHead>Min</TableHead>
                  <TableHead>G</TableHead>
                  <TableHead>A</TableHead>
                  <TableHead>Tarj.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.ultimosPartidos.map((match) => (
                  <TableRow key={`${match.date}-${match.rival}-${match.torneo}`}>
                    <TableCell className="whitespace-nowrap tabular-nums">{match.date || '—'}</TableCell>
                    <TableCell className="min-w-[10rem]">{match.rival}</TableCell>
                    <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                      {match.torneo || match.ambito || '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">{match.min ?? '—'}</TableCell>
                    <TableCell className="tabular-nums">{match.goles ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{match.asist ?? 0}</TableCell>
                    <TableCell className="tabular-nums">
                      {(match.TA ?? 0) > 0 || (match.TR ?? 0) > 0
                        ? `${match.TA ?? 0}A/${match.TR ?? 0}R`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
