import { Button } from '@/components/ui/button.jsx';
import { useIsMobile } from '@/hooks/useIsMobile.js';
import {
  fetchStandingsByGroupForCalendar,
  getSchedulableMatches,
  scheduleAllMatchesInCalendar,
} from '@/lib/matchCalendar.js';

export default function ScheduleAllButton({ matches, onScheduledMany }) {
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  const schedulable = getSchedulableMatches(matches);
  if (!schedulable.length) return null;

  const handleClick = async () => {
    try {
      let standingsByGroup = {};
      try {
        standingsByGroup = await fetchStandingsByGroupForCalendar();
      } catch {
        // Sin sesión o error de red: se agenda sin tablas de grupo
      }
      scheduleAllMatchesInCalendar(schedulable, standingsByGroup);
      onScheduledMany?.(schedulable.map((m) => m.id));
    } catch {
      // Reintentar desde un partido individual si falla
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 border-t border-border/80 bg-background/95 px-3 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Button type="button" variant="default" size="lg" className="w-full" onClick={handleClick}>
        Agendar todos ({schedulable.length})
      </Button>
    </div>
  );
}
