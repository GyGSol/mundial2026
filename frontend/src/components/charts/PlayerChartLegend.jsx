import { cn } from '@/lib/utils';
import LeaderboardUserAvatar from '../LeaderboardUserAvatar.jsx';

export default function PlayerChartLegend({
  series = [],
  hiddenUserIds = new Set(),
  currentUserId = null,
  onToggle,
}) {
  if (!series.length) return null;

  return (
    <ul className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:max-h-48 sm:grid-cols-2 lg:grid-cols-3">
      {series.map((player) => {
        const hidden = hiddenUserIds.has(player.userId);
        const isCurrentUser = currentUserId && player.userId === currentUserId;

        return (
          <li key={player.userId}>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors',
                hidden
                  ? 'border-border/60 bg-muted/30 opacity-50'
                  : 'border-border bg-card hover:bg-muted/40',
                isCurrentUser && !hidden && 'ring-1 ring-primary/40'
              )}
              aria-pressed={!hidden}
              onClick={() => onToggle?.(player.userId)}
            >
              <span
                className="size-3 shrink-0 rounded-full border border-border/80"
                style={{ backgroundColor: player.color }}
                aria-hidden
              />
              <LeaderboardUserAvatar
                name={player.name}
                avatarUrl={player.avatarUrl}
                isAiUser={player.isAiUser}
                className="!size-6 !border-[1.5px]"
              />
              <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {(() => {
                  const rank = player.ranks[player.ranks.length - 1] ?? 0;
                  return rank ? `${rank}°` : 'Inicio';
                })()}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
