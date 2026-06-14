import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext.jsx';
import { useMatchStream } from '@/hooks/useMatchStream.js';
import { canShowMatchStream, isMatchStreamWarmup } from '@/lib/streamWatch.js';
import La18StreamPlayer from './La18StreamPlayer.jsx';

export default function LiveMatchPanel({
  match,
  className,
  theaterMode = false,
  onTheaterModeChange,
}) {
  const matchId = match?.externalId ?? match?.id;
  const canWatch = canShowMatchStream(match);
  const isWarmup = isMatchStreamWarmup(match);
  const { isAuthenticated } = useAuth();

  const { config, loading, error, reload, selectSource, selectedSourceId } = useMatchStream(matchId, {
    enabled: canWatch && Boolean(matchId) && isAuthenticated,
  });

  if (!canWatch) return null;

  if (!isAuthenticated) {
    return (
      <div className={cn('live-match-panel rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-sm', className)}>
        <p className="text-muted-foreground">Iniciá sesión para ver la transmisión en vivo.</p>
        <Button type="button" size="sm" className="mt-3" asChild>
          <Link to="/login">Iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('live-match-panel flex w-full flex-col gap-3', className)}>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Transmisión La18HD · alternativa independiente de la programación oficial.
        {isWarmup ? ' Calentamiento previo al partido.' : null}
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {isWarmup ? 'Buscando señal de calentamiento…' : 'Buscando señal en vivo…'}
        </div>
      ) : null}

      {!loading && error ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-3 text-center text-sm text-muted-foreground">
            {error}
            {config?.reason === 'no_la18_mapping' ? (
              <p className="mt-2 text-xs">
                Falta configurar la URL de La18HD para el partido{' '}
                <strong>{matchId}</strong> en el panel admin.
              </p>
            ) : null}
          </div>
          {config?.fallback?.url ? (
            <>
              <p className="text-xs text-muted-foreground">Señal alternativa (Fubo Sports):</p>
              <La18StreamPlayer
                primary={null}
                fallback={config.fallback}
                theaterMode={theaterMode}
                onTheaterModeChange={onTheaterModeChange}
                onReloadPrimary={reload}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {!loading && config?.available ? (
        <La18StreamPlayer
          primary={config.primary}
          sources={config.sources}
          selectedSourceId={selectedSourceId}
          onSourceChange={selectSource}
          fallback={config.fallback}
          theaterMode={theaterMode}
          onTheaterModeChange={onTheaterModeChange}
          onReloadPrimary={reload}
        />
      ) : null}
    </div>
  );
}
