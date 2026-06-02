import { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { useIsMobile } from '@/hooks/useIsMobile.js';
import { canScheduleMatchReminder, scheduleMatchInCalendar } from '@/lib/matchCalendar.js';

export default function MatchScheduleButton({ match }) {
  const isMobile = useIsMobile();
  const [hint, setHint] = useState('');

  if (!isMobile || match.status !== 'upcoming') return null;

  const schedulable = canScheduleMatchReminder(match);

  const handleClick = async () => {
    setHint('');
    try {
      await scheduleMatchInCalendar(match);
      setHint('Si no se abrió solo, revisá Descargas o tu app de Calendario.');
    } catch (err) {
      setHint(err.message || 'No se pudo crear el evento');
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-w-28"
        disabled={!schedulable}
        onClick={handleClick}
      >
        Agendar
      </Button>
      {!schedulable && match.kickoffAt && (
        <p className="text-center text-xs text-muted-foreground">
          El recordatorio (1h 30 antes) ya pasó para este partido.
        </p>
      )}
      {hint ? <p className="text-center text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
