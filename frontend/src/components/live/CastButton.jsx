import { Cast, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import { useGoogleCast } from '@/hooks/useGoogleCast.js';

export default function CastButton({
  mediaUrl,
  title,
  enabled = true,
  onMediaExpired,
  className,
  size = 'sm',
  variant = 'outline',
}) {
  const { available, connecting, connected, deviceName, error, toggleCast } = useGoogleCast({
    mediaUrl,
    title,
    enabled,
    onMediaExpired,
  });

  if (!available) return null;

  const label = connecting
    ? 'Conectando con el TV…'
    : connected
      ? deviceName
        ? `Transmitiendo a ${deviceName}`
        : 'Transmitiendo al TV'
      : 'Transmitir a TV';

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Button
        type="button"
        size={size}
        variant={connected ? 'default' : variant}
        className="justify-center"
        onClick={toggleCast}
        disabled={connecting || !mediaUrl}
        aria-label={label}
        aria-pressed={connected}
        title={label}
      >
        {connecting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Cast className={cn('size-4', connected && 'fill-current')} aria-hidden />
        )}
        <span className="sr-only">{label}</span>
      </Button>
      {error ? (
        <p className="text-center text-[11px] text-destructive" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
