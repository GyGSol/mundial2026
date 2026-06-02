import { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { useIsMobile } from '@/hooks/useIsMobile.js';
import {
  hasUsedScheduleAll,
  markScheduleAllUsed,
} from '@/lib/scheduledMatchesStorage.js';
import {
  getSchedulableMatches,
  scheduleAllMatchesInCalendar,
} from '@/lib/matchCalendar.js';

export default function ScheduleAllButton({ matches, isScheduled, onScheduledMany }) {
  const isMobile = useIsMobile();
  const [scheduleAllUsed, setScheduleAllUsed] = useState(() => hasUsedScheduleAll());

  if (!isMobile || scheduleAllUsed) return null;

  const schedulable = getSchedulableMatches(matches);
  const pending = schedulable.filter((m) => !isScheduled(m.id));

  if (!pending.length) return null;

  const handleClick = () => {
    try {
      scheduleAllMatchesInCalendar(pending);
      onScheduledMany?.(pending.map((m) => m.id));
      markScheduleAllUsed();
      setScheduleAllUsed(true);
    } catch {
      // Reintentar desde un partido individual si falla
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick}>
      Agendar todos
    </Button>
  );
}
