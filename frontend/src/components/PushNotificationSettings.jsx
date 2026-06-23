import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { usePushNotifications } from '@/hooks/usePushNotifications.js';

const DISMISS_KEY = 'push-opt-in-dismissed:v2';

const PREFERENCE_ITEMS = [
  {
    key: 'predictionLockReminder',
    label: 'Cierre de predicción',
    description: 'Avisame 30 min antes de que cierre una predicción sin cargar.',
  },
  {
    key: 'matchLiveStart',
    label: 'Comienzo de partido',
    description: 'Avisame cuando empiece un partido en vivo donde tengo predicción.',
  },
  {
    key: 'goals',
    label: 'Goles en vivo',
    description: 'Avisame cuando haya un gol en partidos en vivo (goleador, país y puntos).',
  },
];

function PreferenceToggle({ id, label, description, checked, disabled, onChange }) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background/50 p-3"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-sky-500"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

export default function PushNotificationSettings({ enabled = true, initialPreferences = null }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const {
    supported,
    subscribed,
    permission,
    loading,
    savingPreference,
    error,
    preferences,
    subscribe,
    updatePreference,
  } = usePushNotifications({ enabled, initialPreferences });

  if (!enabled || !supported || dismissed) return null;

  const denied = permission === 'denied';
  const togglesDisabled = !subscribed || savingPreference;

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
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Notificaciones de predicciones</p>
            {denied ? (
              <p className="text-xs text-muted-foreground">
                Bloqueaste las notificaciones en este navegador. Para activarlas, abrí el candado o ícono
                junto a la URL y permití notificaciones para este sitio.
              </p>
            ) : subscribed ? (
              <p className="text-xs text-muted-foreground">
                Elegí qué avisos querés recibir en este dispositivo.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Activá los avisos del navegador y después elegí los tipos que te interesan.
              </p>
            )}
            {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Ocultar configuración de notificaciones"
            onClick={dismiss}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        {!denied && !subscribed ? (
          <Button
            type="button"
            size="sm"
            className="w-fit gap-1.5"
            disabled={loading}
            onClick={subscribe}
          >
            <Bell className="size-4" aria-hidden />
            {loading ? 'Activando…' : 'Activar avisos'}
          </Button>
        ) : null}

        {!denied && subscribed ? (
          <div className="space-y-2">
            {PREFERENCE_ITEMS.map((item) => (
              <PreferenceToggle
                key={item.key}
                id={`push-pref-${item.key}`}
                label={item.label}
                description={item.description}
                checked={Boolean(preferences[item.key])}
                disabled={togglesDisabled}
                onChange={(value) => updatePreference(item.key, value)}
              />
            ))}
          </div>
        ) : null}

        {denied ? (
          <Button type="button" size="sm" variant="outline" className="w-fit" onClick={dismiss}>
            Entendido
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
