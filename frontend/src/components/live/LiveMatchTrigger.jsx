import { lazy, Suspense, useState } from 'react';
import { TvMinimalPlay } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

const LiveMatchShell = lazy(() => import('./LiveMatchShell.jsx'));

export default function LiveMatchTrigger({
  match,
  className,
  size = 'sm',
  variant = 'default',
  sideContent,
  label = 'Ver en vivo',
}) {
  const [open, setOpen] = useState(false);

  if (match?.status !== 'live') return null;

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn('gap-1.5', className)}
        onClick={() => setOpen(true)}
      >
        <TvMinimalPlay className="size-4 shrink-0" aria-hidden />
        {label}
      </Button>

      {open ? (
        <Suspense fallback={null}>
          <LiveMatchShell match={match} open={open} onOpenChange={setOpen} sideContent={sideContent} />
        </Suspense>
      ) : null}
    </>
  );
}
