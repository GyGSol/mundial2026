import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function ChartCard({
  title,
  description,
  hint,
  empty,
  emptyMessage = 'Sin datos para este gráfico.',
  height = 'h-64',
  children,
  className = '',
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {hint ? <p className="text-xs text-muted-foreground/80">{hint}</p> : null}
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className={`${height} w-full`}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
