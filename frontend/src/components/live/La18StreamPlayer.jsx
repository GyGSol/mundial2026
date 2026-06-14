import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, MonitorPlay, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import { isIosDevice } from '@/lib/device';
import StreamAccessNoticeDialog from './StreamAccessNoticeDialog.jsx';

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
  onReloadPrimary,
}) {
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const hlsRetryCountRef = useRef(0);
  const accessNoticeShownRef = useRef(false);
  const iosDevice = isIosDevice();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [directHlsFailed, setDirectHlsFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(() => !primary?.url && !primary?.hlsUrl && Boolean(fallback?.url));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showAccessNotice, setShowAccessNotice] = useState(false);

  const openAccessNotice = useCallback(() => {
    if (accessNoticeShownRef.current) return;
    accessNoticeShownRef.current = true;
    setShowAccessNotice(true);
  }, []);

  const openUrl = primary?.pageUrl || primary?.url;
  const iframeSrc = primary?.pageUrl || primary?.url;
  const hasHls = Boolean(primary?.hlsUrl);
  const showFallback =
    useFallback ||
    (directHlsFailed && iframeFailed) ||
    (iframeFailed && !hasHls);
  const useDirectHls =
    hasHls && !directHlsFailed && !useFallback && (iosDevice ? !iframeFailed : iframeFailed);
  const showEmbedded = Boolean(iframeSrc) && !useFallback && !useDirectHls && !iframeFailed;

  useEffect(() => {
    setIframeLoaded(false);
    setIframeFailed(false);
    setDirectHlsFailed(false);
    setUseFallback(false);
    setStatusMessage('');
    hlsRetryCountRef.current = 0;
    accessNoticeShownRef.current = false;
    setShowAccessNotice(false);
  }, [primary?.url, primary?.pageUrl, primary?.hlsUrl]);

  useEffect(() => {
    if (!primary?.url && !primary?.hlsUrl && fallback?.url) {
      setUseFallback(true);
    }
  }, [primary?.url, primary?.hlsUrl, fallback?.url]);

  useEffect(() => {
    if (!showFallback || !directHlsFailed || !iframeFailed) return;
    openAccessNotice();
  }, [showFallback, directHlsFailed, iframeFailed, openAccessNotice]);

  useEffect(() => {
    if (showFallback || useDirectHls || !iframeSrc) return;

    const timeoutMs = iosDevice ? IOS_LOAD_TIMEOUT_MS : LOAD_TIMEOUT_MS;
    const timer = window.setTimeout(() => {
      if (!iframeLoaded) {
        setIframeFailed(true);
        if (!hasHls) {
          setStatusMessage('Buscando señal alternativa…');
          openAccessNotice();
        }
      }
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [iframeSrc, iframeLoaded, showFallback, useDirectHls, iosDevice, openAccessNotice, hasHls]);

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
    setDirectHlsFailed(false);
    setUseFallback(false);
    setIframeLoaded(false);
    setStatusMessage('');
    onReloadPrimary?.();
  };

  const activateFallback = () => {
    setUseFallback(true);
    setStatusMessage('Buscando señal alternativa…');
  };

  const handleDirectHlsError = () => {
    if (hlsRetryCountRef.current < 2) {
      hlsRetryCountRef.current += 1;
      setStatusMessage('Renovando señal…');
      onReloadPrimary?.();
      return;
    }
    setDirectHlsFailed(true);
    if (iosDevice && iframeSrc) {
      setStatusMessage('Probando reproductor La18HD…');
      return;
    }
    setStatusMessage('Buscando señal alternativa…');
    openAccessNotice();
  };

  const handleDirectHlsStall = () => {
    openAccessNotice();
  };

  if (!primary?.url && !primary?.hlsUrl && !fallback?.url) return null;

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
        {useDirectHls ? (
          <Suspense
            fallback={
              <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                Conectando señal La18HD…
              </div>
            }
          >
            <LiveStreamPlayer
              url={primary.hlsUrl}
              type="file"
              channelName="La18HD"
              className="h-full"
              onError={handleDirectHlsError}
              onStall={handleDirectHlsStall}
            />
          </Suspense>
        ) : null}

        {showEmbedded ? (
          <iframe
            ref={iframeRef}
            title="Transmisión La18HD"
            src={iframeSrc}
            className="h-full min-h-[200px] w-full"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            onLoad={() => setIframeLoaded(true)}
            onError={() => {
              setIframeFailed(true);
              if (!hasHls) {
                setStatusMessage('Buscando señal alternativa…');
                openAccessNotice();
              }
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

      <StreamAccessNoticeDialog
        open={showAccessNotice}
        onOpenChange={setShowAccessNotice}
        openUrl={openUrl}
        onRetry={retryPrimary}
      />

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

        {iosDevice ? (
          <Button type="button" size="sm" variant="outline" className="gap-1.5" asChild>
            <a href={LA18_EVENTS_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4 shrink-0" aria-hidden />
              Más en La18HD
            </a>
          </Button>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground"
          onClick={() => setShowAccessNotice(true)}
        >
          ¿Se cortó la señal?
        </Button>
      </div>
    </div>
  );
}
