import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, MonitorPlay, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

const LiveStreamPlayer = lazy(() => import('./LiveStreamPlayer.jsx'));

const LOAD_TIMEOUT_MS = 8000;

export default function La18StreamPlayer({
  primary,
  fallback,
  className,
  theaterMode = false,
  onTheaterModeChange,
}) {
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(() => !primary?.url && Boolean(fallback?.url));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const showFallback = useFallback || iframeFailed;

  useEffect(() => {
    setIframeLoaded(false);
    setIframeFailed(false);
    setUseFallback(false);
    setStatusMessage('');
  }, [primary?.url]);

  useEffect(() => {
    if (!primary?.url && fallback?.url) {
      setUseFallback(true);
    }
  }, [primary?.url, fallback?.url]);

  useEffect(() => {
    if (!primary?.url || showFallback) return undefined;

    const timer = window.setTimeout(() => {
      if (!iframeLoaded) {
        setIframeFailed(true);
        setStatusMessage('Buscando señal alternativa…');
      }
    }, LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [primary?.url, iframeLoaded, showFallback]);

  const toggleFullscreen = useCallback(async () => {
    const node = containerRef.current;
    if (!node) return;

    if (!document.fullscreenElement) {
      await node.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  const toggleTheater = () => {
    onTheaterModeChange?.(!theaterMode);
  };

  const retryPrimary = () => {
    setIframeFailed(false);
    setUseFallback(false);
    setIframeLoaded(false);
    setStatusMessage('');
  };

  const activateFallback = () => {
    setUseFallback(true);
    setStatusMessage('Buscando señal alternativa…');
  };

  if (!primary?.url && !fallback?.url) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'la18-stream-player flex w-full flex-col gap-2',
        theaterMode && 'min-h-[60dvh]',
        className
      )}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-md border border-border/60 bg-black shadow-inner',
          theaterMode ? 'min-h-[50dvh] flex-1' : 'aspect-video'
        )}
      >
        {!showFallback && primary?.url ? (
          <iframe
            ref={iframeRef}
            title="Transmisión La18HD"
            src={primary.url}
            className="h-full min-h-[200px] w-full"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            referrerPolicy="no-referrer"
            onLoad={() => setIframeLoaded(true)}
            onError={() => {
              setIframeFailed(true);
              setStatusMessage('Buscando señal alternativa…');
            }}
          />
        ) : null}

        {showFallback ? (
          <div className="flex min-h-[200px] w-full flex-col gap-3 p-3">
            <p className="text-center text-sm text-muted-foreground">
              {statusMessage || 'Buscando señal alternativa…'}
            </p>
            {fallback?.url ? (
              <Suspense
                fallback={
                  <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                    Cargando Fubo Sports…
                  </div>
                }
              >
                <LiveStreamPlayer
                  url={fallback.url}
                  type={fallback.type}
                  channelName="Fubo Sports"
                />
              </Suspense>
            ) : null}
            {fallback?.externalUrl ? (
              <Button type="button" variant="outline" className="mx-auto" asChild>
                <a href={fallback.externalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 size-4" aria-hidden />
                  Abrir Fubo Sports Network
                </a>
              </Button>
            ) : null}
            {primary?.pageUrl ? (
              <Button type="button" variant="ghost" size="sm" className="mx-auto" asChild>
                <a href={primary.pageUrl} target="_blank" rel="noopener noreferrer">
                  Abrir La18HD en nueva pestaña
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}

        {!iframeLoaded && !showFallback && primary?.url ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white/80">
            Conectando señal La18HD…
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 p-2">
        <Button
          type="button"
          size="sm"
          variant={theaterMode ? 'default' : 'outline'}
          onClick={toggleTheater}
          aria-pressed={theaterMode}
        >
          <MonitorPlay className="mr-1.5 size-4" aria-hidden />
          {theaterMode ? 'Salir de teatro' : 'Modo teatro'}
        </Button>

        <Button type="button" size="sm" variant="outline" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>

        {!showFallback ? (
          <Button type="button" size="sm" variant="outline" onClick={activateFallback}>
            Señal alternativa
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={retryPrimary}>
            <RefreshCw className="mr-1.5 size-4" aria-hidden />
            Reintentar La18HD
          </Button>
        )}

        {primary?.pageUrl ? (
          <Button type="button" size="sm" variant="secondary" className="ml-auto" asChild>
            <a href={primary.pageUrl} target="_blank" rel="noopener noreferrer">
              Abrir La18HD
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
