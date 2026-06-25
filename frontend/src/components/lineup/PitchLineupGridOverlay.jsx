import { lineupGridToHalfPitchPercent, LINEUP_GRID_SNAP_STEP } from '@/lib/pitchCoordinates.js';
import { cn } from '@/lib/utils';

/** Cuadrícula táctica visible (gridX/gridY 0–100) sobre cada mitad de cancha. */
export default function PitchLineupGridOverlay({ side, step = LINEUP_GRID_SNAP_STEP, className }) {
  const depthLines = [];
  const lateralLines = [];

  for (let gx = 0; gx <= 100; gx += step) {
    const { left } = lineupGridToHalfPitchPercent(gx, 50, side);
    depthLines.push({ key: `depth-${gx}`, left, label: gx });
  }

  for (let gy = 0; gy <= 100; gy += step) {
    const { top } = lineupGridToHalfPitchPercent(50, gy, side);
    lateralLines.push({ key: `lat-${gy}`, top, label: gy });
  }

  const majorLine = side === 'home' ? 'bg-sky-300/60' : 'bg-rose-300/60';
  const minorLine = 'bg-white/18';
  const labelClass = side === 'home' ? 'text-sky-200/85' : 'text-rose-200/85';

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-[8]', className)} aria-hidden>
      {depthLines.map(({ key, left, label }) => (
        <div key={key} className="absolute bottom-0 top-0" style={{ left }}>
          <div
            className={cn(
              'h-full w-px',
              label === 0 || label === 50 || label === 100 ? majorLine : minorLine
            )}
          />
          {label % 20 === 0 ? (
            <span
              className={cn(
                'absolute left-0.5 top-0.5 rounded bg-black/55 px-0.5 text-[7px] font-mono tabular-nums leading-none',
                labelClass
              )}
            >
              X{label}
            </span>
          ) : null}
        </div>
      ))}
      {lateralLines.map(({ key, top, label }) => (
        <div key={key} className="absolute left-0 right-0" style={{ top }}>
          <div
            className={cn(
              'h-px w-full',
              label === 0 || label === 50 || label === 100 ? majorLine : minorLine
            )}
          />
          {label % 20 === 0 ? (
            <span
              className={cn(
                'absolute left-0.5 top-0.5 rounded bg-black/55 px-0.5 text-[7px] font-mono tabular-nums leading-none',
                labelClass
              )}
            >
              Y{label}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
