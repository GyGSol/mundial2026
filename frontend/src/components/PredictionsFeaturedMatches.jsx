import { useMemo } from 'react';
import MatchCard from '@/components/MatchCard.jsx';
import { cn } from '@/lib/utils';
import { sortLiveMatchesForFeaturedBar } from '@/lib/liveMatchFeaturedSort.js';
import { resolveLiveMatchesColumnTitle } from '@/lib/matchPlayState.js';

function FeaturedMatchItems({
  matches,
  focusMatchId,
  onSave,
  savingId,
  isScheduled,
  onScheduled,
}) {
  return matches.map((match) => (
    <div
      key={match.id}
      id={`match-${match.id}`}
      className={cn(
        'scroll-mt-28 rounded-xl transition-shadow',
        focusMatchId === match.id && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      <MatchCard
        match={match}
        onSave={onSave}
        savingId={savingId}
        isScheduled={isScheduled}
        onScheduled={onScheduled}
        showPhaseInHeader
      />
    </div>
  ));
}

function FeaturedSection({ title, matches, ...itemProps }) {
  if (!matches.length) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="border-b border-border pb-2">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg md:text-xl">
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-4">
        <FeaturedMatchItems matches={matches} {...itemProps} />
      </div>
    </section>
  );
}

/**
 * Partidos destacados en /predictions: MatchCard + PredictionForm (no LiveMatchesBar del ranking).
 */
export default function PredictionsFeaturedMatches({
  liveMatches = [],
  recentFinishedMatches = [],
  focusMatchId,
  onSave,
  savingId,
  isScheduled,
  onScheduled,
}) {
  const sortedLiveMatches = useMemo(
    () => sortLiveMatchesForFeaturedBar(liveMatches),
    [liveMatches]
  );
  const hasLive = sortedLiveMatches.length > 0;
  const recentForDisplay = hasLive ? [] : recentFinishedMatches;

  if (!hasLive && !recentForDisplay.length) return null;

  const itemProps = {
    focusMatchId,
    onSave,
    savingId,
    isScheduled,
    onScheduled,
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 md:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
      <FeaturedSection
        title={resolveLiveMatchesColumnTitle(sortedLiveMatches)}
        matches={sortedLiveMatches}
        {...itemProps}
      />
      <FeaturedSection
        title={
          recentForDisplay.length > 1
            ? 'Partidos recién finalizados'
            : 'Partido recién finalizado'
        }
        matches={recentForDisplay}
        {...itemProps}
      />
    </div>
  );
}
