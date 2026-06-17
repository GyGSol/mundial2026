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

export default function GroupPerformanceChart({ data = [] }) {
  const chartData = [...data].sort((a, b) => String(a.group).localeCompare(String(b.group)));

  return (
    <AnalyticsChartCard
      title="Rendimiento por grupo"
      description="MSE y puntos promedio de Oracle en cada grupo del torneo."
      hint="Compará en qué zonas del fixture el modelo erra más."
      empty={!chartData.length}
      height="h-72"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={chartMargin} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={analyticsColors.grid} />
          <XAxis type="number" tick={axisTick} />
          <YAxis type="category" dataKey="group" tick={axisTick} width={32} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Bar dataKey="avgMse" name="MSE prom." fill={analyticsColors.amber} radius={[0, 4, 4, 0]} />
          <Bar dataKey="avgPoints" name="Pts prom." fill={analyticsColors.cyan} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
