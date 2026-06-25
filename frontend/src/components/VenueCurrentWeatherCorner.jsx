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
        'pointer-events-none absolute right-2 top-2 z-10 max-w-[min(100%-1rem,14rem)] rounded-md border border-border/70 bg-background/95 px-2 py-1.5 text-right shadow-sm backdrop-blur-sm sm:right-3 sm:top-3 sm:max-w-[16rem]',
        className
      )}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
        Clima actual en la sede
      </p>
      <div className="mt-0.5 flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
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
