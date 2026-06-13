import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import {
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import { isIosDevice } from '@/lib/device';

const ReactPlayer = lazy(() => import('react-player/lazy'));

function PlayerFallback() {
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-md bg-muted/40 text-sm text-muted-foreground">
      Cargando reproductor…
    </div>
  );
}

export default function LiveStreamPlayer({ url, type = 'youtube', channelName, className, onError }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const iosDevice = isIosDevice();
  const [playing, setPlaying] = useState(() => !iosDevice);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [pipSupported] = useState(
    () => typeof document !== 'undefined' && document.pictureInPictureEnabled
  );

  const togglePlay = () => setPlaying((prev) => !prev);

  const toggleMute = () => setMuted((prev) => !prev);

  const handleVolumeChange = (event) => {
    const next = Number(event.target.value);
    setVolume(next);
    setMuted(next === 0);
  };

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

  const enterPictureInPicture = useCallback(async () => {
    const internal = playerRef.current?.getInternalPlayer?.();
    const video = internal?.tagName === 'VIDEO' ? internal : internal?.querySelector?.('video');
    if (!video || !document.pictureInPictureEnabled) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      onError?.('Picture-in-Picture no disponible en este navegador.');
    }
  }, [onError]);

  const handlePlayerError = () => {
    setHasError(true);
    onError?.('No se pudo reproducir la señal. Probá otro canal o abrí el enlace externo.');
  };

  const retry = () => {
    setHasError(false);
    setPlaying(true);
  };

  if (!url) return null;

  if (type === 'external') {
    return (
      <div className={cn('live-stream-player flex flex-col gap-3', className)}>
        <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border/70 bg-muted/20 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            {channelName || 'Este canal'} se ve en su app o sitio oficial (no permite reproductor embebido).
          </p>
          <Button type="button" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              Abrir {channelName || 'canal'}
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('live-stream-player flex flex-col gap-2', className)}>
      <div className="relative overflow-hidden rounded-md bg-black">
        {hasError ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">
            <p>No se pudo cargar la transmisión.</p>
            <Button type="button" size="sm" variant="outline" onClick={retry}>
              <RefreshCw className="mr-1.5 size-4" aria-hidden />
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <Suspense fallback={<PlayerFallback />}>
              <ReactPlayer
                ref={playerRef}
                url={url}
                playing={playing}
                volume={volume}
                muted={muted}
                controls={false}
                width="100%"
                height="100%"
                playsinline
                className="aspect-video [&>video]:object-contain"
                onError={handlePlayerError}
                config={{
                  youtube: {
                    playerVars: {
                      playsinline: 1,
                    },
                  },
                  file: {
                    forceHLS: url.includes('.m3u8'),
                    attributes: {
                      playsInline: true,
                    },
                  },
                }}
              />
            </Suspense>
            {!playing ? (
              <button
                type="button"
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 text-sm text-white"
                onClick={() => setPlaying(true)}
              >
                <Play className="size-10" aria-hidden />
                Tocá para reproducir
              </button>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 p-2">
        <Button type="button" size="sm" variant="outline" onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <Button type="button" size="sm" variant="outline" onClick={toggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
          {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </Button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={handleVolumeChange}
          className="h-1.5 w-24 accent-primary"
          aria-label="Volumen"
        />

        <div className="ml-auto flex items-center gap-2">
          {pipSupported ? (
            <Button type="button" size="sm" variant="outline" onClick={enterPictureInPicture} aria-label="Picture in Picture">
              <PictureInPicture2 className="size-4" />
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={toggleFullscreen} aria-label="Pantalla completa">
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          <Button type="button" size="sm" variant="secondary" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              Abrir externo
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
