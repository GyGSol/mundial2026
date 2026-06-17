import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AnalyticsChartCard from './AnalyticsChartCard.jsx';
import { analyticsColors, axisTick, chartMargin, tooltipStyle } from './analyticsTheme.js';
import { withChartLabels } from './chartHelpers.js';

export default function RollingBiasChart({ data = [] }) {
  const chartData = withChartLabels(data);

  return (
    <AnalyticsChartCard
      title="Sesgo promedio acumulado"
      description="Promedio móvil del sesgo local y visitante a medida que avanza el torneo."
      hint="Sirve para ver si Oracle corrige o empeora su calibración con el tiempo."
      empty={!chartData.length}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={analyticsColors.grid} />
          <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
          <YAxis tick={axisTick} />
          <ReferenceLine y={0} stroke={analyticsColors.slate} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="avgBiasHome" name="Sesgo local prom." stroke={analyticsColors.amber} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="avgBiasAway" name="Sesgo visit. prom." stroke={analyticsColors.cyan} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
