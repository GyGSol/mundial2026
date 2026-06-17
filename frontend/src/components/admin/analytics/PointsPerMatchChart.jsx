import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AnalyticsChartCard from './AnalyticsChartCard.jsx';
import { analyticsColors, axisTick, chartMargin, tooltipStyle } from './analyticsTheme.js';
import { withChartLabels } from './chartHelpers.js';

export default function PointsPerMatchChart({ data = [] }) {
  const chartData = withChartLabels(data);

  return (
    <AnalyticsChartCard
      title="Puntos por partido"
      description="Puntos de torneo que ganó Oracle en cada partido puntuado."
      hint="Máximo teórico: 4 pts (PA + GL + GV + GT)."
      empty={!chartData.length}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={chartMargin}>
          <defs>
            <linearGradient id="ptsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={analyticsColors.violet} stopOpacity={0.9} />
              <stop offset="100%" stopColor={analyticsColors.violet} stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={analyticsColors.grid} />
          <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
          <YAxis tick={axisTick} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Puntos']} />
          <Bar dataKey="points" name="Puntos" fill="url(#ptsGrad)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
