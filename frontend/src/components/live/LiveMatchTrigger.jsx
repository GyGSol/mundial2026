import { lazy, Suspense, useContext, useState } from 'react';
import { TvMinimalPlay } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import { canShowMatchStream, isMatchStreamWarmup } from '@/lib/streamWatch.js';
import { LiveMatchViewerContext } from '@/context/LiveMatchViewerContext.jsx';

const LiveMatchShell = lazy(() => import('./LiveMatchShell.jsx'));

export default function LiveMatchTrigger({
  match,
  className,
  size = 'sm',
  variant = 'default',
  sideContent,
  label = 'Ver en vivo',
}) {
  const viewer = useContext(LiveMatchViewerContext);
  const [localOpen, setLocalOpen] = useState(false);

  if (!canShowMatchStream(match)) return null;

  const labelText = isMatchStreamWarmup(match) && label === 'Ver en vivo' ? 'Ver calentamiento' : label;

  const handleOpen = () => {
    if (viewer) {
      viewer.openLiveMatch(match);
      return;
    }
    setLocalOpen(true);
  };

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn('gap-1.5', className)}
        onClick={handleOpen}
      >
        <TvMinimalPlay className="size-4 shrink-0" aria-hidden />
        {labelText}
      </Button>

      {!viewer && localOpen ? (
        <Suspense fallback={null}>
          <LiveMatchShell match={match} open={localOpen} onOpenChange={setLocalOpen} sideContent={sideContent} />
        </Suspense>
      ) : null}
    </>
  );
}
