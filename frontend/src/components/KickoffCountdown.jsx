import { useEffect, useState } from 'react';

function formatCountdown(ms) {
  if (ms <= 0) return 'Comienza ahora';

  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `Comienza en ${hours} h ${minutes} min`;
  }
  if (hours > 0) {
    return `Comienza en ${hours} h`;
  }
  return `Comienza en ${minutes} min`;
}

export default function KickoffCountdown({ kickoffAt, className }) {
  const [label, setLabel] = useState(() => {
    if (!kickoffAt) return null;
    return formatCountdown(new Date(kickoffAt).getTime() - Date.now());
  });

  useEffect(() => {
    if (!kickoffAt) {
      setLabel(null);
      return undefined;
    }

    const kickoffMs = new Date(kickoffAt).getTime();
    if (Number.isNaN(kickoffMs)) {
      setLabel(null);
      return undefined;
    }

    const update = () => setLabel(formatCountdown(kickoffMs - Date.now()));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [kickoffAt]);

  if (!label) return null;

  return <span className={className}>{label}</span>;
}
