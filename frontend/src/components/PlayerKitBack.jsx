import { useEffect, useState } from 'react';
import { teamsApi } from '../api/client.js';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils';

const KIT_FRAME =
  'relative mx-auto w-14 shrink-0 overflow-hidden rounded-xl border-2 border-amber-400 bg-white p-1 shadow-[0_0_8px_rgba(251,191,36,0.35)] sm:mx-0 sm:w-16';

/** @param {{ fifaCode?: string | null, shirtNumber?: number | null, className?: string }} props */
export default function PlayerKitBack({ fifaCode, shirtNumber, className }) {
  const [kit, setKit] = useState(null);
  const [loading, setLoading] = useState(false);

  const code = String(fifaCode ?? '').trim().toUpperCase();
  const numberLabel = shirtNumber != null && Number.isFinite(Number(shirtNumber)) ? String(shirtNumber) : '';

  useEffect(() => {
    if (!code || !numberLabel) {
      setKit(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    teamsApi
      .getKit(code)
      .then((data) => {
        if (!cancelled) setKit(data?.kit ?? null);
      })
      .catch(() => {
        if (!cancelled) setKit(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [code, numberLabel]);

  if (!code || !numberLabel) return null;

  if (loading) {
    return (
      <Skeleton
        className={cn(KIT_FRAME, 'h-[76px] sm:h-[86px]', className)}
        aria-hidden
      />
    );
  }

  if (!kit?.parts?.body) return null;

  const { parts } = kit;
  // Solo torso + short: los brazos generan bloques blancos al espejar la plantilla de Wikipedia.
  const layers = [parts.shorts, parts.body].filter(Boolean);

  return (
    <div
      className={cn(KIT_FRAME, className)}
      style={{ aspectRatio: '5 / 7' }}
      aria-label={`Camiseta de ${code}, dorsal ${numberLabel}`}
    >
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-white">
        <div className="absolute inset-0 grid scale-x-[-1] [&>img]:col-start-1 [&>img]:row-start-1 [&>img]:h-full [&>img]:w-full [&>img]:max-w-none">
          {layers.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              className="pointer-events-none object-none object-top"
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
        <span
          className="pointer-events-none absolute inset-x-0 top-[24%] z-10 text-center text-lg font-bold tabular-nums leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95),0_0_6px_rgba(0,0,0,0.65)] sm:text-xl"
          aria-hidden
        >
          {numberLabel}
        </span>
      </div>
    </div>
  );
}
