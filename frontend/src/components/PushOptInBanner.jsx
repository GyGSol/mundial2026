import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { usePushNotifications } from '@/hooks/usePushNotifications.js';

export default function PushOptInBanner({ enabled = true }) {
  const { supported, subscribed, loading, error, subscribe } = usePushNotifications({ enabled });

  if (!enabled || !supported || subscribed) return null;

  return (
    <Card className="border-sky-400/25 bg-sky-500/5">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">Avisame cuando empiece un partido en vivo</p>
          <p className="text-xs text-muted-foreground">
            Te avisamos si tenés predicción cargada y el partido pasa a en vivo.
          </p>
          {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
        <Button type="button" size="sm" className="gap-1.5 shrink-0" disabled={loading} onClick={subscribe}>
          <Bell className="size-4" aria-hidden />
          {loading ? 'Activando…' : 'Activar avisos'}
        </Button>
      </CardContent>
    </Card>
  );
}
