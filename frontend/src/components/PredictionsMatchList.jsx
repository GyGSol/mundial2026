import MatchCard from '@/components/MatchCard.jsx';
import { groupMatchesByPhase } from '@/lib/matchPhases.js';
import { cn } from '@/lib/utils';

export default function PredictionsMatchList({
  matches,
  focusMatchId,
  onSave,
  savingId,
  isScheduled,
  onScheduled,
}) {
  const sections = groupMatchesByPhase(matches);

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <section key={section.key} className="flex flex-col gap-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {section.label}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {section.matches.length} partido{section.matches.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.matches.map((match) => (
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
                  showPhaseInHeader={section.key === 'group'}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
