import { adminCard } from './adminTheme.js';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';

export default function AdminStatCard({ label, value, hint, className }) {
  return (
    <Card className={cn(adminCard, className)}>
      <CardContent className="pt-4">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-slate-100">{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
