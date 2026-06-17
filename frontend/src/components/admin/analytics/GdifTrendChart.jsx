import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AnalyticsChartCard from './AnalyticsChartCard.jsx';
import { analyticsColors, axisTick, chartMargin, tooltipStyle } from './analyticsTheme.js';
import { withChartLabels } from './chartHelpers.js';

export default function GdifTrendChart({ data = [] }) {
  const chartData = withChartLabels(data);

  return (
    <AnalyticsChartCard
      title="Gdif combinado acumulado"
      description="Error de goles combinado a lo largo del torneo."
      hint="Objetivo: 0.000 — cuanto más bajo, mejor precisión en el desempate."
      empty={!chartData.length}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={chartMargin}>
          <defs>
            <linearGradient id="gdifGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={analyticsColors.emerald} stopOpacity={0.4} />
              <stop offset="100%" stopColor={analyticsColors.emerald} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={analyticsColors.grid} />
          <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
          <YAxis tick={axisTick} />
          <ReferenceLine y={0} stroke={analyticsColors.cyan} strokeDasharray="4 4" />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Gdif']} />
          <Area
            type="monotone"
            dataKey="value"
            name="Gdif acum."
            stroke={analyticsColors.emerald}
            fill="url(#gdifGrad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
