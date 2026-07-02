import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

export default function FubolsCupRankingLink({ groupId, disabled = false, className = '' }) {
  if (!groupId || groupId === '__nogroup') return null;

  const href = `/mundial?tab=fubols-cup&groupId=${encodeURIComponent(groupId)}`;

  if (disabled) {
    return (
      <Button type="button" size="sm" variant="outline" disabled className={className}>
        <Trophy className="mr-1.5 size-4" aria-hidden />
        Ver Copa Fubols
      </Button>
    );
  }

  return (
    <Button asChild size="sm" variant="outline" className={className}>
      <Link to={href}>
        <Trophy className="mr-1.5 size-4" aria-hidden />
        Ver Copa Fubols
      </Link>
    </Button>
  );
}
