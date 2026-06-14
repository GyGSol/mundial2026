import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { usePushNotifications } from '@/hooks/usePushNotifications.js';

const DISMISS_KEY = 'push-opt-in-dismissed:v1';

export default function PushOptInBanner({ enabled = true }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const { supported, subscribed, permission, loading, error, subscribe } = usePushNotifications({
    enabled,
  });

  if (!enabled || !supported || subscribed || dismissed) return null;

  const denied = permission === 'denied';

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore quota / private mode
    }
  }

  return (
    <Card className="border-sky-400/25 bg-sky-500/5">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">Avisame cuando empiece un partido en vivo</p>
          {denied ? (
            <p className="text-xs text-muted-foreground">
              Bloqueaste las notificaciones en este navegador. Para activarlas, abrí el candado o ícono
              junto a la URL y permití notificaciones para este sitio.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Te avisamos si tenés predicción cargada y el partido pasa a en vivo.
            </p>
          )}
          {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {denied ? (
            <Button type="button" size="sm" variant="outline" onClick={dismiss}>
              Entendido
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={loading}
              onClick={subscribe}
            >
              <Bell className="size-4" aria-hidden />
              {loading ? 'Activando…' : 'Activar avisos'}
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground"
            aria-label="Ocultar aviso de notificaciones"
            onClick={dismiss}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
