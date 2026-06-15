import { Cloud, CloudLightning, CloudRain, MapPin, Sun, Thermometer, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMatchDate } from '@/lib/dateFormat.js';
import WeatherOpsBadge, { LiveScheduleAlert } from '@/components/WeatherOpsBadge.jsx';

function WeatherMetric({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="text-foreground">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function formatSnapshot(snapshot) {
  if (!snapshot || snapshot.available === false) return null;
  const temp =
    snapshot.temperatureC != null ? `${Math.round(snapshot.temperatureC)}°C` : null;
  const humidity =
    snapshot.humidityPct != null ? `${Math.round(snapshot.humidityPct)}% hum.` : null;
  const wind = snapshot.windKmh != null ? `${Math.round(snapshot.windKmh)} km/h` : null;
  const rain =
    snapshot.precipitationPct != null ? `${Math.round(snapshot.precipitationPct)}% lluvia` : null;
  const description = snapshot.description ?? null;

  return { temp, humidity, wind, rain, description };
}

export default function MatchVenueWeather({ matchVenue, className }) {
  if (!matchVenue) return null;

  const stadium = matchVenue.stadium;
  const weather = matchVenue.weather;
  const weatherRisk = matchVenue.weatherRisk;
  const weatherOps = matchVenue.weatherOps;
  const liveScheduleContext = matchVenue.liveScheduleContext;
  const venue = matchVenue.venue;
  const kickoffLabel = venue?.kickoffLocal
    ? venue.kickoffLocal
    : matchVenue.kickoffAt
      ? formatMatchDate(matchVenue, { useStadiumTimezone: true, showTimezone: true })
      : null;

  const locationParts = [
    stadium?.nameEn,
    weather?.locationLine ?? [stadium?.city, stadium?.country].filter(Boolean).join(', '),
  ].filter(Boolean);

  const current = formatSnapshot(weather?.current);
  const forecast = formatSnapshot(weather?.kickoffForecast);
  const forecastTime = weather?.kickoffForecast?.atLocal ?? null;

  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 text-sm',
        className
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <MapPin className="mt-0.5 size-4 shrink-0 text-sky-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{locationParts.join(' · ')}</p>
          {kickoffLabel ? (
            <p className="text-xs text-muted-foreground">Kickoff: {kickoffLabel}</p>
          ) : null}
        </div>
      </div>

      <WeatherOpsBadge
        weatherOps={weatherOps}
        weatherRisk={weatherRisk}
        className="mt-2 w-full items-start"
      />
      <LiveScheduleAlert liveScheduleContext={liveScheduleContext} className="mt-2 w-full" />

      {weatherRisk?.protocol ? (
        <div className="mt-2 rounded-md border border-sky-500/25 bg-sky-500/5 px-2 py-1.5 text-[11px] text-muted-foreground">
          <p className="inline-flex items-center gap-1 font-medium text-foreground">
            <CloudLightning className="size-3.5 text-sky-400" aria-hidden />
            {weatherRisk.protocol.title}
          </p>
          <p className="mt-0.5">{weatherRisk.protocol.summary}</p>
        </div>
      ) : null}

      {weather?.available ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3">
          {current ? (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Clima actual en la sede
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {current.description ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                    <Sun className="size-3.5" aria-hidden />
                    {current.description}
                  </span>
                ) : null}
                <WeatherMetric icon={Thermometer} label="" value={current.temp} />
                <WeatherMetric icon={Cloud} label="" value={current.humidity} />
                <WeatherMetric icon={Wind} label="" value={current.wind} />
              </div>
            </div>
          ) : null}

          {forecast ? (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pronóstico al kickoff{forecastTime ? ` · ${forecastTime}` : ''}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {forecast.description ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                    <CloudRain className="size-3.5" aria-hidden />
                    {forecast.description}
                  </span>
                ) : null}
                <WeatherMetric icon={Thermometer} label="" value={forecast.temp} />
                <WeatherMetric icon={Cloud} label="" value={forecast.humidity} />
                <WeatherMetric icon={Wind} label="" value={forecast.wind} />
                <WeatherMetric icon={CloudRain} label="" value={forecast.rain} />
              </div>
            </div>
          ) : weather?.kickoffForecast?.reason === 'forecast_out_of_range' ? (
            <p className="text-xs text-muted-foreground">
              El pronóstico horario para el kickoff aún no está disponible.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Clima no disponible para esta sede en este momento.
        </p>
      )}
    </div>
  );
}
