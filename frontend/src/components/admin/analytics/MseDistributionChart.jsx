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

export default function MseDistributionChart({ data = [] }) {
  return (
    <AnalyticsChartCard
      title="Distribución de errores (MSE)"
      description="Cuántos partidos caen en cada rango de error cuadrático."
      hint="Picos altos en 10+ indican predicciones muy alejadas del resultado."
      empty={!data.length}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={chartMargin}>
          <defs>
            <linearGradient id="mseHistGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={analyticsColors.rose} stopOpacity={0.85} />
              <stop offset="100%" stopColor={analyticsColors.rose} stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={analyticsColors.grid} />
          <XAxis dataKey="bucket" tick={axisTick} />
          <YAxis tick={axisTick} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Partidos']} />
          <Bar dataKey="count" name="Partidos" fill="url(#mseHistGrad)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
