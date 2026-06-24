import { useEffect, useState } from 'react';
import { teamsApi } from '../api/client.js';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils';

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
    return <Skeleton className={cn('h-24 w-20 rounded-md', className)} aria-hidden />;
  }

  if (!kit?.parts?.body) return null;

  const { parts } = kit;
  const layers = [
    parts.shorts,
    parts.body,
    parts.leftArm,
    parts.rightArm,
  ].filter(Boolean);

  return (
    <div
      className={cn('relative mx-auto h-24 w-20 sm:mx-0', className)}
      aria-label={`Camiseta de ${code}, dorsal ${numberLabel}`}
    >
      <div className="absolute inset-0 scale-x-[-1]">
        {layers.map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        ))}
      </div>
      <span
        className="pointer-events-none absolute inset-x-0 top-[18%] text-center text-2xl font-bold tabular-nums leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95),0_0_6px_rgba(0,0,0,0.65)]"
        aria-hidden
      >
        {numberLabel}
      </span>
    </div>
  );
}
