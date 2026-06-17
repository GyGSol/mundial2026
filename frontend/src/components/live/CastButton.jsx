import { Cast, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import { isCastBrowser } from '@/lib/googleCast.js';
import { useGoogleCast } from '@/hooks/useGoogleCast.js';

export default function CastButton({
  mediaUrl,
  title,
  enabled = true,
  onMediaExpired,
  className,
  size = 'sm',
  variant = 'outline',
  showLabel = true,
}) {
  const castBrowser = isCastBrowser();
  const { connecting, connected, deviceName, error, toggleCast } = useGoogleCast({
    mediaUrl,
    title,
    enabled,
    onMediaExpired,
  });

  const label = connecting
    ? 'Conectando con el TV…'
    : connected
      ? deviceName
        ? `Transmitiendo a ${deviceName}`
        : 'Transmitiendo al TV'
      : 'Transmitir a TV';

  const disabledTitle = castBrowser
    ? mediaUrl?.trim()
      ? label
      : 'Obteniendo señal directa para el TV. Si no se habilita, probá otra señal.'
    : 'Para ver en el TV usá Chrome o Edge en la misma WiFi que el televisor.';

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Button
        type="button"
        size={size}
        variant={connected ? 'default' : variant}
        className="justify-center gap-1.5"
        onClick={toggleCast}
        disabled={connecting}
        aria-label={label}
        aria-pressed={connected}
        title={disabledTitle}
      >
        {connecting ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Cast className={cn('size-4 shrink-0', connected && 'fill-current')} aria-hidden />
        )}
        {showLabel ? (
          <span className="truncate">{connected ? 'En el TV' : 'Transmitir'}</span>
        ) : (
          <span className="sr-only">{label}</span>
        )}
      </Button>
      {error ? (
        <p className="col-span-2 text-center text-[11px] text-destructive sm:col-span-1" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
