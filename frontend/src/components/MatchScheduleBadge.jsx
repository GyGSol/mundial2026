import { Badge } from '@/components/ui/badge.jsx';
import { useIsMobile } from '@/hooks/useIsMobile.js';
import { cn } from '@/lib/utils';
import { canScheduleMatchReminder, scheduleMatchInCalendar } from '@/lib/matchCalendar.js';

const badgeBase =
  'border px-2.5 py-0.5 text-xs font-semibold transition-colors';

const actionBadgeClass =
  'cursor-pointer border-sky-400/70 bg-sky-100/70 text-sky-900 hover:bg-sky-200/80 active:bg-sky-200';

const doneBadgeClass = 'border-emerald-300/80 bg-emerald-100/60 text-emerald-900';

export default function MatchScheduleBadge({ match, isScheduled, onScheduled }) {
  const isMobile = useIsMobile();
  if (!isMobile || match.status !== 'upcoming') return null;

  const schedulable = canScheduleMatchReminder(match);
  const scheduled = isScheduled(match.id);

  if (scheduled) {
    return (
      <Badge variant="outline" className={cn(badgeBase, doneBadgeClass)}>
        Agendado
      </Badge>
    );
  }

  if (!schedulable) return null;

  const handleClick = () => {
    try {
      scheduleMatchInCalendar(match);
      onScheduled?.(match.id);
    } catch {
      // El navegador puede bloquear la descarga; el usuario puede reintentar
    }
  };

  return (
    <Badge
      variant="outline"
      role="button"
      tabIndex={0}
      className={cn(badgeBase, actionBadgeClass)}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      Agendar
    </Badge>
  );
}
