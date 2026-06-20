import { useCallback, useMemo, useState } from 'react';
import { worldCupApi } from '@/api/client.js';
import { useLiveData } from '@/hooks/useLiveData.js';
import { REALTIME_EVENTS } from '@/lib/realtimeSectors.js';
import LoadingSpinner from '@/components/LoadingSpinner.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { getTeamFlag } from '@/lib/teamMeta.js';
import PedigreeBarChart from './PedigreeBarChart.jsx';
import OffenseDefenseScatter from './OffenseDefenseScatter.jsx';
import TitlesBarChart from './TitlesBarChart.jsx';
import TournamentGoalsLineChart from './TournamentGoalsLineChart.jsx';
import RoundDistributionChart from './RoundDistributionChart.jsx';
import NationHistoryPanel from './NationHistoryPanel.jsx';
import HistoryTablesSection from './HistoryTablesSection.jsx';

export default function DataCenterSection() {
  const [selectedCode, setSelectedCode] = useState('ARG');
  const [compareCode, setCompareCode] = useState('');

  const fetchDataCenter = useCallback(
    () => worldCupApi.dataCenter({ nation: selectedCode }),
    [selectedCode]
  );

  const { data, loading, error } = useLiveData(fetchDataCenter, [selectedCode], {
    realtimeEvents: [],
    memoryCacheKey: `worldcup:datacenter:${selectedCode}`,
    memoryCacheTtlMs: 300_000,
  });

  const nations = data?.nationRankings ?? [];
  const selectedNation = useMemo(
    () => nations.find((n) => n.fifaCode === selectedCode) ?? null,
    [nations, selectedCode]
  );
  const compareNation = useMemo(
    () => nations.find((n) => n.fifaCode === compareCode) ?? null,
    [nations, compareCode]
  );

  if (loading && !data) {
    return <LoadingSpinner variant="compact" label="Cargando centro de datos histórico…" />;
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!data) return null;

  const charts = data.charts ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
        <h2 className="text-lg font-semibold">Centro de datos para predicción</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Estadísticas históricas de las {data.nationCount} selecciones del Mundial 2026 desde Wikipedia,
          cruzadas con ranking FIFA ({data.fifaRankAsOf ?? 'jun 2026'}) y perfiles de plantel.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Selección principal</p>
          <Select value={selectedCode} onValueChange={setSelectedCode}>
            <SelectTrigger>
              <SelectValue placeholder="Elegir selección" />
            </SelectTrigger>
            <SelectContent>
              {nations.map((n) => (
                <SelectItem key={n.fifaCode} value={n.fifaCode}>
                  {n.name} ({n.fifaCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[200px] flex-1">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Comparar con (opcional)</p>
          <Select value={compareCode || '__none__'} onValueChange={(v) => setCompareCode(v === '__none__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Ninguna" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Ninguna</SelectItem>
              {nations
                .filter((n) => n.fifaCode !== selectedCode)
                .map((n) => (
                  <SelectItem key={n.fifaCode} value={n.fifaCode}>
                    {n.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {compareNation ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[selectedNation, compareNation].filter(Boolean).map((n) => (
            <div key={n.fifaCode} className="rounded-lg border border-border/70 p-3 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium">
                {getTeamFlag(n) ? (
                  <img src={getTeamFlag(n)} alt="" className="size-5 rounded-sm object-cover" />
                ) : null}
                {n.name}
              </div>
              <div className="grid grid-cols-3 gap-2 tabular-nums">
                <div>
                  <p className="text-xs text-muted-foreground">Pedigree</p>
                  <p className="font-semibold">{n.pedigreeIndex}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">FIFA</p>
                  <p className="font-semibold">{n.fifaRank ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">GF/GC</p>
                  <p className="font-semibold">
                    {n.goalsPerGame}/{n.goalsAgainstPerGame}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <PedigreeBarChart data={charts.pedigreeBar} />
        <OffenseDefenseScatter data={charts.scatterOffenseDefense} />
        <TitlesBarChart data={charts.titlesBar} />
        <RoundDistributionChart data={charts.roundDistribution} tierLabels={data.tierLabels} />
        <div className="lg:col-span-2">
          <TournamentGoalsLineChart data={charts.tournamentGoalsTimeline} />
        </div>
      </div>

      <NationHistoryPanel
        nation={selectedNation}
        nationDetail={data.nationDetail}
        tierLabels={data.tierLabels}
      />

      <HistoryTablesSection history={data.history} syncedAt={data.syncedAt} />
    </div>
  );
}
