import { AlertTriangle, CloudLightning, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils';

function formatResumeCountdown(resumeEarliestAt) {
  if (!resumeEarliestAt) return null;
  const target = new Date(resumeEarliestAt).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  if (diffMs <= 0) return 'Reanudación posible';
  const mins = Math.ceil(diffMs / 60_000);
  return `Reanudación ~${mins} min`;
}

export function getWeatherOpsLabel(weatherOps) {
  const phase = weatherOps?.phase ?? 'normal';
  if (phase === 'suspended') {
    return { text: 'Suspendido por clima', variant: 'warning' };
  }
  if (phase === 'pre_kickoff_delay') {
    return { text: 'Demorado pre-kickoff', variant: 'warning' };
  }
  if (phase === 'postponed') {
    return { text: 'Postergado', variant: 'warning' };
  }
  return null;
}

export function getWeatherRiskBadgeLabel(weatherRisk) {
  const label = weatherRisk?.protocol?.badgeLabel;
  if (label) return label;
  const region = weatherRisk?.profile?.lightningProtocolRegion;
  if (region === 'usa-noaa') return 'Alerta NOAA';
  if (region === 'canada') return 'Alerta MSC';
  return 'Riesgo climático';
}

export default function WeatherOpsBadge({ weatherOps, weatherRisk, className }) {
  const opsLabel = getWeatherOpsLabel(weatherOps);
  const resumeLabel = formatResumeCountdown(weatherOps?.resumeEarliestAt);
  const authorityAlert =
    weatherRisk?.nws?.primaryAlert?.event ?? weatherRisk?.msc?.primaryAlert?.event ?? null;
  const riskLevel = weatherRisk?.riskLevel;
  const riskBadgeLabel = getWeatherRiskBadgeLabel(weatherRisk);

  if (!opsLabel && riskLevel !== 'stop' && riskLevel !== 'high') return null;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {opsLabel ? (
        <Badge
          variant="outline"
          className="border-amber-400/70 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <CloudLightning className="mr-1 size-3" aria-hidden />
          {opsLabel.text}
        </Badge>
      ) : null}
      {!opsLabel && (riskLevel === 'stop' || riskLevel === 'high') ? (
        <Badge
          variant="outline"
          className="border-amber-400/70 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <AlertTriangle className="mr-1 size-3" aria-hidden />
          {riskBadgeLabel}
          {riskLevel === 'stop' ? ' · alto riesgo de demora' : ''}
        </Badge>
      ) : null}
      {resumeLabel ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Timer className="size-3" aria-hidden />
          {resumeLabel}
        </span>
      ) : null}
      {authorityAlert ? (
        <span className="text-[10px] text-muted-foreground">{authorityAlert}</span>
      ) : null}
    </div>
  );
}

export function LiveScheduleAlert({ liveScheduleContext, className }) {
  const integrityWarning = liveScheduleContext?.integrityWarning;
  const concurrentLive = (liveScheduleContext?.concurrentLiveCount ?? 0) > 1;

  if (!integrityWarning && !concurrentLive) return null;

  return (
    <div
      className={cn(
        'rounded-md border border-amber-300/50 bg-amber-50/80 px-2 py-1.5 text-[11px] text-amber-950 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-100',
        className
      )}
    >
      {integrityWarning ? (
        <p className="font-medium">{integrityWarning}</p>
      ) : null}
      {concurrentLive ? (
        <p className="text-muted-foreground">
          {liveScheduleContext.concurrentLiveCount} partidos en vivo simultáneos
          {(liveScheduleContext.weatherDelayedLiveCount ?? 0) > 0
            ? ` (${liveScheduleContext.weatherDelayedLiveCount} con demora climática)`
            : ''}
          .
        </p>
      ) : null}
    </div>
  );
}
