import { AlertTriangle, PauseCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils';
import {
  getEffectiveMatchPlayState,
  getMatchPlayStateBadgeText,
  isMatchPlayPaused,
} from '@/lib/matchPlayState.js';
import { getWeatherOpsLabel } from '@/components/WeatherOpsBadge.jsx';

export function getMatchPlayStateLabel(match) {
  const playState = getEffectiveMatchPlayState(match);
  const playLabel = getMatchPlayStateBadgeText(playState);
  if (playLabel) {
    return { text: playLabel, variant: 'warning', playState };
  }

  const weatherLabel = getWeatherOpsLabel(match?.weatherOps);
  if (weatherLabel) {
    return { ...weatherLabel, playState };
  }

  return null;
}

export default function MatchPlayStateBadge({ match, className }) {
  const label = getMatchPlayStateLabel(match);
  if (!label) return null;

  const playState = label.playState ?? getEffectiveMatchPlayState(match);
  const showClock =
    isMatchPlayPaused(playState) &&
    playState.frozenClock &&
    playState.phase !== 'halftime' &&
    playState.frozenClock !== label.text;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <Badge
        variant="outline"
        className="border-amber-400/70 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      >
        {playState.reason === 'weather' ? (
          <AlertTriangle className="mr-1 size-3" aria-hidden />
        ) : (
          <PauseCircle className="mr-1 size-3" aria-hidden />
        )}
        {label.text}
        {showClock ? ` · ${playState.frozenClock}` : ''}
      </Badge>
    </div>
  );
}
