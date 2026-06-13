import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, MonitorPlay, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import { isIosDevice } from '@/lib/device';

const LiveStreamPlayer = lazy(() => import('./LiveStreamPlayer.jsx'));

const LA18_EVENTS_URL = 'https://la18hd.com/eventos/';
const LOAD_TIMEOUT_MS = 8000;
const IOS_LOAD_TIMEOUT_MS = 20000;

export default function La18StreamPlayer({
  primary,
  fallback,
  className,
  theaterMode = false,
  onTheaterModeChange,
}) {
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const iosDevice = isIosDevice();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(() => !primary?.url && Boolean(fallback?.url));
  const [preferExternal, setPreferExternal] = useState(
    () => iosDevice && Boolean(primary?.pageUrl)
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const showFallback = useFallback || iframeFailed;
  const showEmbedded = !preferExternal && !showFallback && primary?.url;
  const openUrl = primary?.pageUrl || primary?.url;

  useEffect(() => {
    setIframeLoaded(false);
    setIframeFailed(false);
    setUseFallback(false);
    setStatusMessage('');
    setPreferExternal(iosDevice && Boolean(primary?.pageUrl));
  }, [primary?.url, primary?.pageUrl, iosDevice]);

  useEffect(() => {
    if (!primary?.url && fallback?.url) {
      setUseFallback(true);
    }
  }, [primary?.url, fallback?.url]);

  useEffect(() => {
    if (!primary?.url || showFallback || preferExternal) return undefined;

    const timeoutMs = iosDevice ? IOS_LOAD_TIMEOUT_MS : LOAD_TIMEOUT_MS;
    const timer = window.setTimeout(() => {
      if (!iframeLoaded) {
        setIframeFailed(true);
        setStatusMessage('Buscando señal alternativa…');
      }
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [primary?.url, iframeLoaded, showFallback, preferExternal, iosDevice]);

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
    setPreferExternal(false);
    setStatusMessage('');
  };

  const activateFallback = () => {
    setUseFallback(true);
    setStatusMessage('Buscando señal alternativa…');
  };

  if (!primary?.url && !fallback?.url) return null;

  if (preferExternal && openUrl) {
    return (
      <div
        ref={containerRef}
        className={cn('la18-stream-player flex w-full flex-col gap-3', className)}
      >
        <div className="flex min-h-[200px] w-full flex-col items-center justify-center gap-4 rounded-md border border-border/60 bg-muted/20 p-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Smartphone className="size-6" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Ver en Safari</p>
            <p className="text-xs text-muted-foreground">
              En iPhone e iPad la señal La18HD suele funcionar mejor abriéndola fuera del
              reproductor embebido.
            </p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Button type="button" className="w-full gap-2" asChild>
              <a href={openUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4 shrink-0" aria-hidden />
                Abrir transmisión en Safari
              </a>
            </Button>
            <Button type="button" variant="outline" className="w-full gap-2" asChild>
              <a href={LA18_EVENTS_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4 shrink-0" aria-hidden />
                Más opciones en La18HD
              </a>
            </Button>
            {primary?.url ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setPreferExternal(false)}
              >
                Probar reproductor embebido
              </Button>
            ) : null}
          </div>
        </div>

        {fallback?.url ? (
          <div className="rounded-md border border-dashed border-border/60 bg-muted/10 p-3">
            <p className="mb-2 text-center text-xs text-muted-foreground">
              Señal alternativa (puede no estar disponible en tu país):
            </p>
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
          </div>
        ) : null}
      </div>
    );
  }

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
        {showEmbedded ? (
          <iframe
            ref={iframeRef}
            title="Transmisión La18HD"
            src={primary.url}
            className="h-full min-h-[200px] w-full"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-fullscreen"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture; web-share"
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
            {openUrl ? (
              <Button type="button" variant="default" className="mx-auto gap-2" asChild>
                <a href={openUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                  {iosDevice ? 'Abrir La18HD en Safari' : 'Abrir La18HD en nueva pestaña'}
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}

        {!iframeLoaded && showEmbedded ? (
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

        {openUrl ? (
          <Button type="button" size="sm" variant="secondary" className="ml-auto gap-1.5" asChild>
            <a href={openUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4 shrink-0" aria-hidden />
              {iosDevice ? 'Abrir en Safari' : 'Abrir La18HD'}
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
