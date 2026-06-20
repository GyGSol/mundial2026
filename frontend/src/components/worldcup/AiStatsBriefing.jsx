import { useCallback, useState } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { worldCupApi } from '../../api/client.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import { REALTIME_EVENTS } from '../../lib/realtimeSectors.js';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import LoadingSpinner from '@/components/LoadingSpinner.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

function formatFetchedAt(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AiStatsBriefing() {
  const [refreshing, setRefreshing] = useState(false);
  const fetchBriefing = useCallback(() => worldCupApi.aiBriefing(), []);
  const { data, loading, error, refresh } = useLiveData(fetchBriefing, [], {
    enabled: true,
    pollIntervalMs: 0,
    realtimeEvents: [REALTIME_EVENTS.SYNC_COMPLETE],
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await worldCupApi.refreshAiBriefing();
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const briefing = data?.briefing;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-400" />
          <h2 className="text-base font-semibold">Briefing IA · Mundial 2026</h2>
          {briefing?.stale ? (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              caché
            </Badge>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={loading || refreshing}
          onClick={handleRefresh}
          className="gap-1.5"
        >
          {refreshing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Actualizar IA
        </Button>
      </div>

      {loading && !data ? (
        <LoadingSpinner variant="compact" label="Generando briefing con IA…" />
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {briefing?.overview ? (
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Panorama del torneo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="text-foreground/90">{briefing.overview}</p>
            {briefing.newsDigest ? <p>{briefing.newsDigest}</p> : null}
            <p className="text-xs">
              {briefing.model ? `Modelo: ${briefing.model}` : 'Sin modelo IA'}
              {briefing.fetchedAt ? ` · ${formatFetchedAt(briefing.fetchedAt)}` : ''}
            </p>
          </CardContent>
        </Card>
      ) : !loading && !data?.aiAvailable ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Configurá CEREBRAS_API_KEY, GEMINI_API_KEY o GROQ_API_KEY para activar el briefing con IA.
          </CardContent>
        </Card>
      ) : null}

      {briefing?.keyNumbers?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {briefing.keyNumbers.map((item) => (
            <Card key={`${item.label}-${item.value}`}>
              <CardContent className="pt-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
                {item.note ? <p className="mt-1 text-xs text-muted-foreground">{item.note}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {(briefing?.records?.length || briefing?.trivia?.length) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {briefing.records?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Récords y momentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {briefing.records.map((row) => (
                  <div key={row.title}>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-muted-foreground">{row.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {briefing.trivia?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos curiosos</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                  {briefing.trivia.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {briefing?.phaseSummaries?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por fase</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {briefing.phaseSummaries.map((row) => (
              <div key={row.phase} className="rounded-lg border border-border/60 p-3">
                <p className="text-sm font-medium">{row.phase}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {briefing?.hostFacts?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sedes y formato 2026</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
              {briefing.hostFacts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
