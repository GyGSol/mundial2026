import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { worldCupApi } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLiveData } from '../hooks/useLiveData.js';
import { Button } from '@/components/ui/button.jsx';
import {
  GroupMatchesSection,
  GroupStandingsSection,
  KnockoutSection,
  StatsSection,
  TeamsSection,
} from '@/components/worldcup/WorldCupSections.jsx';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'groups', label: 'Grupos' },
  { id: 'knockout', label: 'Fase final' },
  { id: 'matches', label: 'Partidos' },
  { id: 'stats', label: 'Estadísticas' },
  { id: 'teams', label: 'Equipos' },
];

function formatLastUpdated(date) {
  if (!date) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function WorldCupPage() {
  const [activeTab, setActiveTab] = useState('groups');
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const groupId = user?.competitionGroup?.id;

  const fetchOverview = useCallback(() => worldCupApi.overview(groupId), [groupId]);
  const { data, loading, error, lastUpdated } = useLiveData(fetchOverview, [groupId], {
    enabled: !authLoading,
  });
  const pageLoading = authLoading || loading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mundial 2026</h1>
          <p className="text-sm text-muted-foreground">
            Tablas de grupos, fase final, estadios y estadísticas desde la API oficial del torneo.
            {lastUpdated && ` · Actualizado ${formatLastUpdated(lastUpdated)}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            size="sm"
            variant={activeTab === tab.id ? 'default' : 'outline'}
            className={cn(activeTab !== tab.id && 'text-muted-foreground')}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {pageLoading && <p className="text-muted-foreground">Cargando información del mundial...</p>}
      {error && <p className="text-destructive">{error}</p>}

      {!pageLoading && !error && (
        <>
          {activeTab === 'groups' && <GroupStandingsSection groups={data?.groups} />}
          {activeTab === 'knockout' && <KnockoutSection phases={data?.knockout} />}
          {activeTab === 'matches' && (
            <GroupMatchesSection
              matches={data?.groupMatches}
              matchPredictionRankings={data?.matchPredictionRankings}
              predictionGroup={data?.predictionGroup}
              simulationPredictionGroup={data?.simulationPredictionGroup}
              isAuthenticated={isAuthenticated}
            />
          )}
          {activeTab === 'stats' && (
            <StatsSection stats={data?.stats} teams={data?.teams} stadiums={data?.stadiums} />
          )}
          {activeTab === 'teams' && <TeamsSection teams={data?.teams} />}
        </>
      )}
    </div>
  );
}
