import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, MonitorPlay, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import { isIosDevice } from '@/lib/device';
import { isCastBrowser, preloadCastContext } from '@/lib/googleCast.js';
import { USER_STREAM_BRAND } from '@/lib/streamBrand.js';
import StreamAccessNoticeDialog from './StreamAccessNoticeDialog.jsx';
import CastButton from './CastButton.jsx';

const LiveStreamPlayer = lazy(() => import('./LiveStreamPlayer.jsx'));

const LA18_EVENTS_URL = 'https://la18hd.com/eventos/';
const LOAD_TIMEOUT_MS = 8000;
const IOS_LOAD_TIMEOUT_MS = 20000;

export default function La18StreamPlayer({
  primary,
  sources = [],
  selectedSourceId,
  onSourceChange,
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
    preloadCastContext();
  }, []);

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

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const node = containerRef.current;
    if (!node) return;

    if (!document.fullscreenElement) {
      await node.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
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
      setStatusMessage(`Probando reproductor ${USER_STREAM_BRAND}…`);
      return;
    }
    setStatusMessage('Buscando señal alternativa…');
    openAccessNotice();
  };

  const handleDirectHlsStall = () => {
    openAccessNotice();
  };

  if (!primary?.url && !primary?.hlsUrl && !fallback?.url) return null;

  const showSourcePicker = sources.length > 1;

  return (
    <div
      className={cn(
        'la18-stream-player flex w-full flex-col gap-2',
        theaterMode && 'min-h-[60dvh]',
        className
      )}
    >
      {showSourcePicker && !isFullscreen ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Elegí señal ({sources.length} disponibles)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sources.map((source) => {
              const active = source.id === (selectedSourceId || primary?.sourceKey);
              return (
                <Button
                  key={source.id}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  className="h-8 max-w-full truncate text-xs"
                  aria-pressed={active}
                  onClick={() => onSourceChange?.(source.id)}
                >
                  {source.label}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div
        ref={containerRef}
        className={cn(
          'relative w-full overflow-hidden rounded-md border border-border/60 bg-black shadow-inner',
          theaterMode && !isFullscreen ? 'min-h-[50dvh] flex-1' : 'aspect-video',
          isFullscreen && 'aspect-auto h-full min-h-0 rounded-none border-0',
          'fullscreen:aspect-auto fullscreen:h-full fullscreen:min-h-0 fullscreen:rounded-none fullscreen:border-0'
        )}
      >
        {useDirectHls ? (
          <Suspense
            fallback={
              <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                Conectando señal {USER_STREAM_BRAND}…
              </div>
            }
          >
            <LiveStreamPlayer
              url={primary.hlsUrl}
              type="file"
              channelName={USER_STREAM_BRAND}
              className="h-full"
              onError={handleDirectHlsError}
              onStall={handleDirectHlsStall}
              onMediaExpired={onReloadPrimary}
            />
          </Suspense>
        ) : null}

        {showEmbedded ? (
          <iframe
            ref={iframeRef}
            title={`Transmisión ${USER_STREAM_BRAND}`}
            src={iframeSrc}
            className="h-full min-h-[200px] w-full fullscreen:min-h-0 fullscreen:h-full"
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
                  {iosDevice ? `Abrir ${USER_STREAM_BRAND} en Safari` : `Abrir ${USER_STREAM_BRAND} en nueva pestaña`}
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}

        {!iframeLoaded && showEmbedded ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white/80">
            Conectando señal {USER_STREAM_BRAND}…
          </div>
        ) : null}

        {isFullscreen ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute right-3 top-3 z-20 bg-black/70 text-white hover:bg-black/85"
            onClick={toggleFullscreen}
            aria-label="Salir de pantalla completa"
          >
            <Minimize2 className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      <StreamAccessNoticeDialog
        open={showAccessNotice}
        onOpenChange={setShowAccessNotice}
        openUrl={openUrl}
        onRetry={retryPrimary}
      />

      {!isFullscreen ? (
        <div className="grid grid-cols-2 gap-2 rounded-md border border-border/60 bg-muted/20 p-2 sm:flex sm:flex-wrap sm:items-center">
          <Button
            type="button"
            size="sm"
            variant={theaterMode ? 'default' : 'outline'}
            onClick={toggleTheater}
            aria-pressed={theaterMode}
            className="justify-center"
          >
            <MonitorPlay className="mr-1.5 size-4" aria-hidden />
            {theaterMode ? 'Salir de teatro' : 'Modo teatro'}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={toggleFullscreen}
            className="justify-center"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>

          <CastButton
            mediaUrl={primary?.hlsUrl}
            title={USER_STREAM_BRAND}
            onMediaExpired={onReloadPrimary}
          />

          {isCastBrowser() ? (
            <p className="col-span-2 text-center text-[11px] leading-snug text-muted-foreground sm:col-span-3">
              Deco Telecentro con «sitios de video específicos» no recibe esta web (sí YouTube). «Guía deco»
              explica alternativas; «Smart TV — Disponible» sí admite Transmitir pestaña.
            </p>
          ) : null}

          {!isCastBrowser() ? (
            <p className="col-span-2 text-center text-[11px] text-muted-foreground sm:col-span-1">
              Ver en TV: Chrome o Edge + misma WiFi
            </p>
          ) : null}

          {!showFallback ? (
            <Button type="button" size="sm" variant="outline" onClick={activateFallback} className="justify-center">
              Señal alternativa
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={retryPrimary} className="justify-center">
              <RefreshCw className="mr-1.5 size-4" aria-hidden />
              Reintentar {USER_STREAM_BRAND}
            </Button>
          )}

          {openUrl ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="col-span-2 justify-center gap-1.5 sm:col-span-1 sm:ml-auto"
              asChild
            >
              <a href={openUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4 shrink-0" aria-hidden />
                {iosDevice ? 'Abrir en Safari' : `Abrir ${USER_STREAM_BRAND}`}
              </a>
            </Button>
          ) : null}

          {iosDevice ? (
            <Button type="button" size="sm" variant="outline" className="col-span-2 justify-center gap-1.5 sm:col-span-1" asChild>
              <a href={LA18_EVENTS_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4 shrink-0" aria-hidden />
                Más en {USER_STREAM_BRAND}
              </a>
            </Button>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="col-span-2 justify-center text-xs text-muted-foreground sm:col-span-1"
            onClick={() => setShowAccessNotice(true)}
          >
            ¿Se cortó la señal?
          </Button>
        </div>
      ) : null}
    </div>
  );
}
