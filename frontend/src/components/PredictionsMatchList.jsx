import { ChevronDown } from 'lucide-react';
import MatchCard from '@/components/MatchCard.jsx';
import { groupMatchesByPhase } from '@/lib/matchPhases.js';
import { cn } from '@/lib/utils';

function sortByKickoff(matches) {
  return [...matches].sort((a, b) => {
    const ta = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
    const tb = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return Number(a.externalId ?? 0) - Number(b.externalId ?? 0);
  });
}

function MatchItems({
  matches,
  focusMatchId,
  onSave,
  savingId,
  isScheduled,
  onScheduled,
  showPhaseInHeader,
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
        showPhaseInHeader={showPhaseInHeader}
      />
    </div>
  ));
}

function FinishedMatchesCollapsible({
  matches,
  defaultOpen,
  focusMatchId,
  onSave,
  savingId,
  isScheduled,
  onScheduled,
  showPhaseInHeader,
}) {
  if (!matches.length) return null;

  return (
    <details
      open={defaultOpen || undefined}
      className="group rounded-xl border border-border bg-muted/20"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <span>
          Finalizados ({matches.length})
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="flex flex-col gap-4 border-t border-border px-2 pb-3 pt-3 sm:px-3">
        <MatchItems
          matches={matches}
          focusMatchId={focusMatchId}
          onSave={onSave}
          savingId={savingId}
          isScheduled={isScheduled}
          onScheduled={onScheduled}
          showPhaseInHeader={showPhaseInHeader}
        />
      </div>
    </details>
  );
}

export default function PredictionsMatchList({
  matches,
  focusMatchId,
  onSave,
  savingId,
  isScheduled,
  onScheduled,
  expandFinished = false,
}) {
  const sections = groupMatchesByPhase(matches);
  const focusIsFinished = Boolean(
    focusMatchId && matches.some((m) => m.id === focusMatchId && m.status === 'finished')
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
      {sections.map((section) => {
        const sorted = sortByKickoff(section.matches);
        const active = sorted.filter((m) => m.status !== 'finished');
        const finished = sorted.filter((m) => m.status === 'finished');
        const showPhaseInHeader = section.key === 'group';

        return (
          <section key={section.key} className="flex flex-col gap-4">
            <div className="border-b border-border pb-2">
              <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {section.label}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {section.matches.length} partido{section.matches.length === 1 ? '' : 's'}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <MatchItems
                matches={active}
                focusMatchId={focusMatchId}
                onSave={onSave}
                savingId={savingId}
                isScheduled={isScheduled}
                onScheduled={onScheduled}
                showPhaseInHeader={showPhaseInHeader}
              />
              <FinishedMatchesCollapsible
                matches={finished}
                defaultOpen={expandFinished || focusIsFinished}
                focusMatchId={focusMatchId}
                onSave={onSave}
                savingId={savingId}
                isScheduled={isScheduled}
                onScheduled={onScheduled}
                showPhaseInHeader={showPhaseInHeader}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
