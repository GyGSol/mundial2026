import { cn } from '@/lib/utils';

const PITCH_INSET = 4;
const HALF_USABLE = 46;

function shortName(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 9);
  return parts[parts.length - 1].slice(0, 11);
}

/**
 * gridX: 0 = arco propio, 100 = línea rival (profundidad).
 * gridY: 0 = banda superior, 100 = banda inferior (eje vertical).
 * Local (home) a la izquierda; visitante (away) a la derecha.
 */
function teamDotStyle(player, side) {
  const depth = Math.min(100, Math.max(0, Number(player.gridX ?? 50)));
  const lateral = Math.min(100, Math.max(0, Number(player.gridY ?? 50)));

  const top = `${PITCH_INSET + lateral * 0.84}%`;

  if (side === 'home') {
    return {
      left: `${PITCH_INSET + (depth / 100) * HALF_USABLE}%`,
      top,
    };
  }

  return {
    left: `${100 - PITCH_INSET - (depth / 100) * HALF_USABLE}%`,
    top,
  };
}

function PlayerMarker({ player, side, index }) {
  const label = shortName(player.name);
  const number = player.shirtNumber;
  const style = teamDotStyle(player, side);

  return (
    <div
      key={player.playerId ?? `${side}-${index}`}
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
      style={style}
      title={player.name}
    >
      {label ? (
        <span className="max-w-[56px] truncate rounded bg-black/55 px-1 py-px text-[8px] font-medium leading-tight text-white">
          {label}
        </span>
      ) : null}
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold shadow-md ring-1 ring-white/30',
          side === 'home' ? 'bg-sky-500 text-white' : 'bg-rose-500 text-white'
        )}
      >
        {number ?? '·'}
      </span>
    </div>
  );
}

function PitchHalf({ players, side, teamLabel }) {
  return (
    <div
      className={cn(
        'absolute inset-y-0 w-1/2',
        side === 'home' ? 'left-0' : 'right-0'
      )}
      aria-label={teamLabel}
    >
      {players.map((player, index) => (
        <PlayerMarker
          key={player.playerId ?? `${side}-${index}`}
          player={player}
          side={side}
          index={index}
        />
      ))}
    </div>
  );
}

function PitchMarkings() {
  return (
    <>
      <div className="pointer-events-none absolute inset-2 rounded border border-white/35" />

      {/* Línea de medio campo */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 top-2 w-px -translate-x-1/2 bg-white/35" />

      {/* Círculo central */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" />

      {/* Área grande local (izquierda) */}
      <div className="pointer-events-none absolute bottom-[18%] left-2 top-[18%] w-[18%] border border-white/30" />
      {/* Área chica local */}
      <div className="pointer-events-none absolute bottom-[32%] left-2 top-[32%] w-[7%] border border-white/25" />

      {/* Área grande visitante (derecha) */}
      <div className="pointer-events-none absolute bottom-[18%] right-2 top-[18%] w-[18%] border border-white/30" />
      {/* Área chica visitante */}
      <div className="pointer-events-none absolute bottom-[32%] right-2 top-[32%] w-[7%] border border-white/25" />

      {/* Arcos (línea de meta) */}
      <div className="pointer-events-none absolute bottom-[28%] left-2 top-[28%] w-px bg-white/50" />
      <div className="pointer-events-none absolute bottom-[28%] right-2 top-[28%] w-px bg-white/50" />
    </>
  );
}

export default function PitchFormation({ lineup, homeLabel, awayLabel, className }) {
  const homePlayers = lineup?.home?.players ?? [];
  const awayPlayers = lineup?.away?.players ?? [];

  if (!homePlayers.length && !awayPlayers.length) return null;

  return (
    <div
      className={cn(
        'relative mx-auto aspect-[5/3] w-full max-w-lg overflow-hidden rounded-lg border border-emerald-700/50 bg-gradient-to-b from-emerald-700 to-emerald-800',
        className
      )}
    >
      <PitchMarkings />

      <PitchHalf players={homePlayers} side="home" teamLabel={homeLabel} />
      <PitchHalf players={awayPlayers} side="away" teamLabel={awayLabel} />

      <div className="pointer-events-none absolute bottom-1 left-2 rounded bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">
        {homeLabel}
      </div>
      <div className="pointer-events-none absolute bottom-1 right-2 rounded bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">
        {awayLabel}
      </div>
    </div>
  );
}
