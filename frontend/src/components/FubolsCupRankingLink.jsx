import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import FubolCoinIcon from '@/components/FubolCoinIcon.jsx';
import {
  FUBOLS_CUP_CHAMPION_EXTRA_PRIZE,
  FUBOLS_CUP_CHAMPION_PRIZE,
} from '@/lib/economyConstants.js';
import { cn } from '@/lib/utils';

const prominentButtonClass =
  'inline-flex h-auto w-full items-center justify-start border-amber-400/80 bg-gradient-to-r from-amber-600/30 via-amber-500/25 to-yellow-600/30 px-4 py-3 text-amber-50 shadow-[0_0_28px_rgba(245,158,11,0.35)] hover:border-amber-300 hover:from-amber-500/40 hover:to-amber-600/40 hover:shadow-[0_0_36px_rgba(245,158,11,0.45)]';

function CupButtonContent({ prominent }) {
  if (!prominent) {
    return (
      <>
        <Trophy className="mr-1.5 size-4" aria-hidden />
        Ver Copa Fubols
      </>
    );
  }

  return (
    <>
      <Trophy className="mr-2 size-5 shrink-0 text-amber-200" aria-hidden />
      <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
        <span className="text-base font-bold tracking-tight sm:text-lg">Copa Fubols</span>
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-amber-100/95 sm:text-sm">
          <span className="inline-flex items-center gap-1">
            {FUBOLS_CUP_CHAMPION_PRIZE}
            <FubolCoinIcon size="sm" />
          </span>
          <span aria-hidden>·</span>
          <span>{FUBOLS_CUP_CHAMPION_EXTRA_PRIZE}</span>
        </span>
      </span>
    </>
  );
}

export default function FubolsCupRankingLink({
  groupId,
  disabled = false,
  prominent = false,
  className = '',
}) {
  if (!groupId || groupId === '__nogroup') return null;

  const href = `/mundial?tab=fubols-cup&groupId=${encodeURIComponent(groupId)}`;
  const buttonClass = cn(prominent && prominentButtonClass, className);

  if (disabled) {
    return (
      <Button
        type="button"
        size={prominent ? 'lg' : 'sm'}
        variant={prominent ? 'default' : 'outline'}
        disabled
        className={buttonClass}
      >
        <CupButtonContent prominent={prominent} />
      </Button>
    );
  }

  return (
    <Button
      asChild
      size={prominent ? 'lg' : 'sm'}
      variant={prominent ? 'default' : 'outline'}
      className={buttonClass}
    >
      <Link to={href}>
        <CupButtonContent prominent={prominent} />
      </Link>
    </Button>
  );
}
