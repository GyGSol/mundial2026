import { cn } from '@/lib/utils';

function shortName(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 10);
  return parts[parts.length - 1].slice(0, 12);
}

function teamDotStyle(player, side) {
  const depth = Number(player.gridX ?? 50);
  const lateral = Number(player.gridY ?? 50);

  if (side === 'home') {
    return {
      left: `${6 + lateral * 0.88}%`,
      top: `${4 + depth * 0.42}%`,
    };
  }

  return {
    left: `${6 + lateral * 0.88}%`,
    top: `${54 + (100 - depth) * 0.42}%`,
  };
}

function PitchHalf({ players, side, teamLabel }) {
  return (
    <div
      className={cn(
        'absolute inset-x-0 h-1/2',
        side === 'home' ? 'top-0' : 'bottom-0'
      )}
      aria-label={teamLabel}
    >
      {players.map((player, index) => {
        const style = teamDotStyle(player, side);
        const label = shortName(player.name);
        const number = player.shirtNumber;

        return (
          <div
            key={player.playerId ?? `${side}-${index}`}
            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
            style={style}
            title={player.name}
          >
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shadow-sm',
                side === 'home'
                  ? 'bg-sky-600 text-white'
                  : 'bg-rose-600 text-white'
              )}
            >
              {number ?? '·'}
            </span>
            {label ? (
              <span className="max-w-[52px] truncate rounded bg-background/85 px-1 text-[9px] font-medium text-foreground shadow-sm">
                {label}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function PitchFormation({ lineup, homeLabel, awayLabel, className }) {
  const homePlayers = lineup?.home?.players ?? [];
  const awayPlayers = lineup?.away?.players ?? [];

  if (!homePlayers.length && !awayPlayers.length) return null;

  return (
    <div
      className={cn(
        'relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-lg border border-emerald-700/40 bg-emerald-800/90',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-3 rounded border border-white/25" />
      <div className="pointer-events-none absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-white/25" />
      <div className="pointer-events-none absolute left-1/2 top-3 h-[18%] w-[38%] -translate-x-1/2 rounded-sm border border-white/20" />
      <div className="pointer-events-none absolute bottom-3 left-1/2 h-[18%] w-[38%] -translate-x-1/2 rounded-sm border border-white/20" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />

      <PitchHalf players={homePlayers} side="home" teamLabel={homeLabel} />
      <PitchHalf players={awayPlayers} side="away" teamLabel={awayLabel} />

      <div className="pointer-events-none absolute left-2 top-1 text-[10px] font-semibold text-white/80">
        {homeLabel}
      </div>
      <div className="pointer-events-none absolute bottom-1 left-2 text-[10px] font-semibold text-white/80">
        {awayLabel}
      </div>
    </div>
  );
}
