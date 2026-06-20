import { useEffect, useState } from 'react';

export default function LocalQaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.isLocalQa) {
          setVisible(true);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-[60] flex justify-center px-3 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200 shadow-sm backdrop-blur-sm">
        QA local — datos clonados; no es producción
      </span>
    </div>
  );
}
