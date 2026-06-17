import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AnalyticsChartCard from './AnalyticsChartCard.jsx';
import { analyticsColors, axisTick, chartMargin, tooltipStyle } from './analyticsTheme.js';
import { withChartLabels } from './chartHelpers.js';

export default function HitRateRollingChart({ data = [] }) {
  const chartData = withChartLabels(data);

  return (
    <AnalyticsChartCard
      title="Tasa de acierto (ventana móvil)"
      description="% de aciertos PA, GL, GV y GT en los últimos 5 partidos."
      hint="PA = ganador; GL/GV = goles por equipo; GT = total de goles."
      empty={!chartData.length}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={analyticsColors.grid} />
          <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
          <YAxis tick={axisTick} domain={[0, 100]} unit="%" />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, '']} />
          <Legend />
          <Line type="monotone" dataKey="paPct" name="PA" stroke={analyticsColors.amber} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="glPct" name="GL" stroke={analyticsColors.cyan} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="gvPct" name="GV" stroke={analyticsColors.emerald} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="gtPct" name="GT" stroke={analyticsColors.violet} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
