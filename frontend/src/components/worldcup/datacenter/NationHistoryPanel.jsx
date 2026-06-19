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
import NationRadarChart from './NationRadarChart.jsx';

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

export default function NationHistoryPanel({ nation, nationDetail, tierLabels = {} }) {
  if (!nation) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Elegí una selección arriba para ver su historial en Mundiales y métricas de predicción.
        </CardContent>
      </Card>
    );
  }

  const detail = nationDetail ?? nation;
  const records = detail.wikiRecords ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <NationRadarChart nation={nation} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <NationCell fifaCode={nation.fifaCode} name={nation.name} />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Pedigree</p>
              <p className="text-lg font-semibold tabular-nums">{nation.pedigreeIndex}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ranking FIFA</p>
              <p className="text-lg font-semibold tabular-nums">{nation.fifaRank ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Mundiales</p>
              <p className="font-semibold tabular-nums">{nation.appearances}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Títulos</p>
              <p className="font-semibold tabular-nums">{nation.worldCupTitles}</p>
            </div>
            <div>
              <p className="text-muted-foreground">% Victorias</p>
              <p className="font-semibold tabular-nums">{Math.round((nation.winRate ?? 0) * 100)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">GF / GC por partido</p>
              <p className="font-semibold tabular-nums">
                {nation.goalsPerGame} / {nation.goalsAgainstPerGame}
              </p>
            </div>
            {detail.profile?.wikiNote ? (
              <div className="col-span-2 text-muted-foreground">{detail.profile.wikiNote}</div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {detail.finalHighlights?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Finales disputadas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {detail.finalHighlights.map((row) => (
                <li key={row.year}>
                  {row.year}: {row.role} {row.score ? `(${row.score})` : ''} vs {row.opponent}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial por Mundial (Wikipedia)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {records.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Año</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>PJ</TableHead>
                  <TableHead>PG</TableHead>
                  <TableHead>GF</TableHead>
                  <TableHead>GC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...records].reverse().map((row) => (
                  <TableRow key={row.year}>
                    <TableCell className="font-medium tabular-nums">{row.year}</TableCell>
                    <TableCell>{tierLabels[classifyTier(row)] ?? row.round}</TableCell>
                    <TableCell className="tabular-nums">{row.played}</TableCell>
                    <TableCell className="tabular-nums">{row.won}</TableCell>
                    <TableCell className="tabular-nums">{row.goalsFor}</TableCell>
                    <TableCell className="tabular-nums">{row.goalsAgainst}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Sin registros históricos parseados para esta selección.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function classifyTier(row) {
  const round = String(row.round ?? '').toLowerCase();
  if (round.includes('champion') || round.includes('winner')) return 'champion';
  if (round.includes('runner') || round.includes('final')) return 'final';
  if (round.includes('semi') || round.includes('third') || round.includes('fourth')) return 'semifinal';
  if (round.includes('quarter')) return 'quarter';
  if (round.includes('round of 16') || round.includes('last 16')) return 'round16';
  if (round.includes('group')) return 'group';
  return 'other';
}
