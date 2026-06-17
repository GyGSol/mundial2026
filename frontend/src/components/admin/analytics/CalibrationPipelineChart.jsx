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

export default function CalibrationPipelineChart({ data = [] }) {
  const chartData = data.map((row) => ({ ...row, label: row.week }));

  return (
    <AnalyticsChartCard
      title="Calibración automática aplicada"
      description="% de predicciones oficiales con nudge de calibración por semana."
      hint="Sube cuando hay suficiente historial de sesgos detectados."
      empty={!chartData.length}
      emptyMessage="Sin logs de predicción todavía."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={analyticsColors.grid} />
          <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
          <YAxis tick={axisTick} domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, _n, props) => [
              `${v}% (${props.payload.applied}/${props.payload.total})`,
              'Calibración',
            ]}
          />
          <Bar dataKey="ratePct" name="% calibración" fill={analyticsColors.emerald} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
