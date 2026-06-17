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

export default function BiasCalibrationChart({ data = [] }) {
  const chartData = withChartLabels(data);

  return (
    <AnalyticsChartCard
      title="Sesgo de calibración por partido"
      description="Diferencia predicho − real en goles local y visitante."
      hint="Positivo = Oracle predijo de más; negativo = predijo de menos."
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
          <Line type="monotone" dataKey="biasHome" name="Sesgo local" stroke={analyticsColors.amber} strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="biasAway" name="Sesgo visitante" stroke={analyticsColors.cyan} strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
