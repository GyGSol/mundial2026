import { cn } from '@/lib/utils';

function KickRow({ kick, align = 'left' }) {
  if (!kick?.player) return null;
  const scored = kick.scored !== false;
  return (
    <li
      className={cn(
        'text-[11px] tabular-nums text-muted-foreground',
        align === 'right' ? 'text-right' : 'text-left'
      )}
    >
      <span className={scored ? 'text-foreground' : 'line-through opacity-70'}>
        {scored ? '✓' : '✗'}
      </span>{' '}
      {kick.player}
    </li>
  );
}

export function PenaltyShootoutScoreLine({ penaltyShootout, className }) {
  if (!penaltyShootout) return null;
  const { homeScore, awayScore } = penaltyShootout;
  if (homeScore == null || awayScore == null) return null;

  return (
    <p className={cn('text-xs font-medium text-muted-foreground tabular-nums', className)}>
      Penales: {homeScore} - {awayScore}
    </p>
  );
}

export default function PenaltyShootoutDisplay({
  penaltyShootout,
  homeCode,
  awayCode,
  compact = false,
  className,
}) {
  if (!penaltyShootout) return null;
  const { homeScore, awayScore, kicks = [] } = penaltyShootout;
  if (homeScore == null && awayScore == null && kicks.length === 0) return null;

  if (compact) {
    return <PenaltyShootoutScoreLine penaltyShootout={penaltyShootout} className={className} />;
  }

  const homeKicks = kicks.filter((kick) => kick.side === 'home');
  const awayKicks = kicks.filter((kick) => kick.side === 'away');

  return (
    <div className={cn('w-full rounded-md border border-border/60 bg-muted/30 px-3 py-2', className)}>
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Tanda de penales
      </p>
      <p className="mb-2 text-center text-sm font-bold tabular-nums">
        {homeCode ?? 'LOC'} {homeScore ?? 0} - {awayScore ?? 0} {awayCode ?? 'VIS'}
      </p>
      {kicks.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 text-left">
          <ul className="flex flex-col gap-0.5">
            {homeKicks.map((kick, index) => (
              <KickRow key={`home-${index}`} kick={kick} align="left" />
            ))}
          </ul>
          <ul className="flex flex-col gap-0.5">
            {awayKicks.map((kick, index) => (
              <KickRow key={`away-${index}`} kick={kick} align="right" />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
