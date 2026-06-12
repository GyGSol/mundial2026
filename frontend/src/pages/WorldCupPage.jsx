import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { worldCupApi } from '../api/client.js';
import { useLiveData } from '../hooks/useLiveData.js';
import { Button } from '@/components/ui/button.jsx';
import {
  GroupMatchesSection,
  GroupStandingsSection,
  KnockoutSection,
  StatsSection,
  TeamsSection,
} from '@/components/worldcup/WorldCupSections.jsx';
import FixtureSection from '@/components/worldcup/FixtureSection.jsx';
import HistorySection from '@/components/worldcup/HistorySection.jsx';
import PlayersSection from '@/components/worldcup/PlayersSection.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'groups', label: 'Grupos' },
  { id: 'knockout', label: 'Fase final' },
  { id: 'matches', label: 'Partidos' },
  { id: 'stats', label: 'Estadísticas' },
  { id: 'teams', label: 'Equipos' },
  { id: 'fixture', label: 'Fixture' },
  { id: 'history', label: 'Historia' },
  { id: 'players', label: 'Jugadores', ai: true },
];

function formatLastUpdated(date) {
  if (!date) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function shouldPollWorldCupLive(data) {
  return (data?.stats?.matches?.live ?? 0) > 0;
}

export default function WorldCupPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('groups');
  const fetchOverview = useCallback(() => worldCupApi.overview(), []);
  const { data, loading, error, lastUpdated } = useLiveData(fetchOverview, [], {
    enabled: true,
    pollIntervalMs: 15000,
    pollWhen: shouldPollWorldCupLive,
  });
  const pageLoading = loading;

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Mundial 2026</h1>
          <p className="text-sm text-muted-foreground">
            Grupos, fixture y estadísticas del torneo.
            {lastUpdated && ` · Actualizado ${formatLastUpdated(lastUpdated)}`}
          </p>
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            size="sm"
            variant={activeTab === tab.id ? 'default' : 'outline'}
            className={cn('shrink-0', activeTab !== tab.id && 'text-muted-foreground')}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {tab.ai ? (
                <Badge className="border-violet-500/40 bg-violet-500/10 px-1.5 py-0 text-[10px] font-semibold text-violet-200">
                  IA
                </Badge>
              ) : null}
            </span>
          </Button>
        ))}
      </div>

      {activeTab === 'players' ? (
        <PlayersSection />
      ) : activeTab === 'history' ? (
        <HistorySection />
      ) : (
        <>
          {pageLoading && (
            <p className="text-muted-foreground">Cargando información del mundial...</p>
          )}
          {error && <p className="text-destructive">{error}</p>}
          {!pageLoading && !error && (
            <>
              {activeTab === 'groups' && (
                <GroupStandingsSection
                  groups={data?.groups}
                  thirdPlaceStandings={data?.thirdPlaceStandings}
                  teamMap={Object.fromEntries((data?.teams ?? []).map((t) => [t.externalId, t]))}
                />
              )}
              {activeTab === 'knockout' && <KnockoutSection phases={data?.knockout} />}
              {activeTab === 'matches' && <GroupMatchesSection matches={data?.groupMatches} />}
              {activeTab === 'stats' && (
                <StatsSection
                  stats={data?.stats}
                  teams={data?.teams}
                  stadiums={data?.stadiums}
                  tournament2026PlayerStats={data?.tournament2026PlayerStats}
                />
              )}
              {activeTab === 'teams' && <TeamsSection teams={data?.teams} />}
              {activeTab === 'fixture' && (
                <FixtureSection
                  groups={data?.groups}
                  knockout={data?.knockout}
                  thirdPlaceStandings={data?.thirdPlaceStandings}
                  teamMap={Object.fromEntries((data?.teams ?? []).map((t) => [t.externalId, t]))}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
