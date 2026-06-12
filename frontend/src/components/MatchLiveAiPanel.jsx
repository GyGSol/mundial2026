import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { matchesApi } from '../api/client.js';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

const MOMENTUM_LABELS = {
  home: 'Impulso local',
  away: 'Impulso visitante',
  balanced: 'Partido parejo',
};

function momentumClass(momentum) {
  if (momentum === 'home') return 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  if (momentum === 'away') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300';
}

export default function MatchLiveAiPanel({ matchId, status = 'live' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!matchId) return;
    setError(null);
    try {
      const payload = await matchesApi.aiLiveBriefing(matchId);
      setData(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const payload = await matchesApi.refreshAiLiveBriefing(matchId);
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const briefing = data?.briefing;

  return (
    <div className="w-full rounded-md border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-left">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
          <Sparkles className="size-3.5" />
          Acciones de juego · IA
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[10px]"
          disabled={loading || refreshing}
          onClick={handleRefresh}
        >
          {refreshing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          <span className="ml-1">Actualizar</span>
        </Button>
      </div>

      {loading && !briefing ? (
        <p className="text-[10px] text-muted-foreground">Analizando acciones del partido...</p>
      ) : null}
      {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
      {data?.emptyTimeline ? (
        <p className="text-[10px] text-muted-foreground">{data.message}</p>
      ) : null}
      {!data?.aiAvailable && !loading ? (
        <p className="text-[10px] text-muted-foreground">
          Configurá una API de IA para ver el análisis de acciones.
        </p>
      ) : null}

      {briefing?.headline ? (
        <p className="text-sm font-semibold leading-snug text-foreground">{briefing.headline}</p>
      ) : null}
      {briefing?.summary ? (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{briefing.summary}</p>
      ) : null}

      {briefing?.momentum ? (
        <Badge variant="outline" className={cn('mt-2 text-[10px]', momentumClass(briefing.momentum))}>
          {MOMENTUM_LABELS[briefing.momentum] ?? briefing.momentum}
        </Badge>
      ) : null}

      {briefing?.keyMoments?.length ? (
        <ul className="mt-2 space-y-1 text-[10px] text-muted-foreground">
          {briefing.keyMoments.map((moment) => (
            <li key={`${moment.minute}-${moment.text}`}>
              {moment.minute != null ? (
                <span className="font-medium tabular-nums text-foreground">{moment.minute}'</span>
              ) : null}{' '}
              {moment.text}
            </li>
          ))}
        </ul>
      ) : null}

      {briefing?.discipline ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Disciplina:</span> {briefing.discipline}
        </p>
      ) : null}
      {briefing?.tacticalNote ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Lectura táctica:</span> {briefing.tacticalNote}
        </p>
      ) : null}
      {status === 'live' && briefing?.whatToWatch ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">A vigilar:</span> {briefing.whatToWatch}
        </p>
      ) : null}
    </div>
  );
}
