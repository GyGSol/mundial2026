import { Cloud, Sun, Thermometer, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatWeatherSnapshot, hasCurrentVenueWeather } from '@/lib/venueWeatherFormat.js';

function WeatherMetric({ icon: Icon, value }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="text-foreground">{value}</span>
    </span>
  );
}

/**
 * Clima actual en la sede — esquina superior derecha de tarjetas live (mismo copy que IA).
 */
export default function VenueCurrentWeatherCorner({ weather, className }) {
  if (!hasCurrentVenueWeather(weather)) return null;

  const current = formatWeatherSnapshot(weather.current);
  const ariaLabel = [
    'Clima actual en la sede',
    current.description,
    current.temp,
    current.humidity,
    current.wind,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className={cn(
        'pointer-events-none z-10 w-[calc(100%-2rem)] rounded-md border border-border/70 bg-background/95 px-2 py-1.5 text-center shadow-sm backdrop-blur-sm',
        // Mobile: en flujo arriba de la tarjeta para no tapar bandera/nombre visitante
        'mx-4 mt-3',
        // Desktop: esquina superior derecha (comportamiento original)
        'sm:absolute sm:right-3 sm:top-3 sm:mx-0 sm:mt-0 sm:w-auto sm:max-w-[16rem] sm:text-right',
        className
      )}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 sm:justify-end">
        {current.description ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-foreground sm:text-xs">
            <Sun className="size-3 shrink-0" aria-hidden />
            {current.description}
          </span>
        ) : null}
        <WeatherMetric icon={Thermometer} value={current.temp} />
        <WeatherMetric icon={Cloud} value={current.humidity} />
        <WeatherMetric icon={Wind} value={current.wind} />
      </div>
    </div>
  );
}
