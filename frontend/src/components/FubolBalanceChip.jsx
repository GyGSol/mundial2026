import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FubolCoinIcon from './FubolCoinIcon.jsx';
import { cn } from '@/lib/utils';

export default function FubolBalanceChip({ className }) {
  const { user } = useAuth();
  const balance = user?.balanceFubols ?? 0;

  return (
    <Link
      to="/economy"
      className={cn(
        'ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-muted',
        className
      )}
      aria-label={`${balance} Fubols — ir a economía`}
    >
      <FubolCoinIcon size="sm" />
      <span>{balance}</span>
    </Link>
  );
}
