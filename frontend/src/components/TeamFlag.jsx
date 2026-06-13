import { cn } from '@/lib/utils';
import { getTeamFlag } from '@/lib/teamMeta';

export default function TeamFlag({
  team,
  className,
  sizeClass = 'size-10 md:size-12 lg:size-14',
}) {
  const flagUrl = getTeamFlag(team);
  const emoji =
    team?.flag && !String(team.flag).startsWith('http') ? String(team.flag) : null;

  if (flagUrl) {
    return (
      <img
        src={flagUrl}
        alt=""
        width={56}
        height={42}
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn(
          'shrink-0 rounded-sm border border-border/60 object-cover shadow-sm',
          sizeClass,
          className
        )}
      />
    );
  }

  if (emoji) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center text-2xl leading-none md:text-3xl',
          sizeClass,
          className
        )}
        aria-hidden
      >
        {emoji}
      </span>
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-sm border border-dashed border-border/60 bg-muted text-xs text-muted-foreground',
        sizeClass,
        className
      )}
      aria-hidden
    >
      ?
    </div>
  );
}
