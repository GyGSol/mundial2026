import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AnalyticsChartCard from './AnalyticsChartCard.jsx';
import { analyticsColors, axisTick, chartMargin, tooltipStyle } from './analyticsTheme.js';
import { withChartLabels } from './chartHelpers.js';

export default function HumanVsAiChart({ data = [] }) {
  const chartData = withChartLabels(data);

  return (
    <AnalyticsChartCard
      title="Oracle vs consenso humano"
      description="Delta entre la predicción de Oracle y la mediana de usuarios humanos."
      hint="Solo partidos con predicciones humanas suficientes."
      empty={!chartData.length}
      emptyMessage="Sin datos de consenso humano para comparar."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={analyticsColors.grid} />
          <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
          <YAxis tick={axisTick} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [
              v,
              name === 'deltaHome' ? 'Δ local' : 'Δ visitante',
            ]}
          />
          <Legend />
          <Bar dataKey="deltaHome" name="Δ local" fill={analyticsColors.amber} radius={[4, 4, 0, 0]} />
          <Bar dataKey="deltaAway" name="Δ visitante" fill={analyticsColors.cyan} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
