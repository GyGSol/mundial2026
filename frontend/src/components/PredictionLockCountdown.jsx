import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

const LOCK_MS = 60 * 60 * 1000;

function resolveLockAt({ lockAt, kickoffAt }) {
  if (lockAt) {
    const lock = new Date(lockAt);
    if (!Number.isNaN(lock.getTime())) return lock;
  }
  if (!kickoffAt) return null;
  const kickoff = new Date(kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return null;
  return new Date(kickoff.getTime() - LOCK_MS);
}

function formatRemaining(ms) {
  if (ms <= 0) return null;

  const totalMinutes = Math.ceil(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0 && hours > 0) {
    return `${days} d ${hours} h`;
  }
  if (days > 0) {
    return `${days} d`;
  }
  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`;
  }
  if (hours > 0) {
    return `${hours} h`;
  }
  return `${minutes} min`;
}

export default function PredictionLockCountdown({
  kickoffAt,
  lockAt,
  predictionOpen,
  status = 'upcoming',
  className,
}) {
  const lockDate = useMemo(
    () => resolveLockAt({ lockAt, kickoffAt }),
    [lockAt, kickoffAt]
  );

  const [remainingLabel, setRemainingLabel] = useState(() => {
    if (!lockDate) return null;
    return formatRemaining(lockDate.getTime() - Date.now());
  });

  useEffect(() => {
    if (!lockDate) {
      setRemainingLabel(null);
      return undefined;
    }

    const lockMs = lockDate.getTime();
    const update = () => setRemainingLabel(formatRemaining(lockMs - Date.now()));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [lockDate]);

  if (!lockDate || status !== 'upcoming') return null;

  const isOpen = predictionOpen !== false && remainingLabel;

  return (
    <p className={cn('text-center text-xs text-muted-foreground', className)}>
      {isOpen ? (
        <>
          Cuenta regresiva para hacer la predicción:{' '}
          <span className="font-medium text-foreground">{remainingLabel}</span>
        </>
      ) : (
        <span className="font-medium text-amber-200/90">Predicciones cerradas para este partido</span>
      )}
    </p>
  );
}
