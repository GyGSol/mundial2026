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

const PHASE_LABELS = {
  group: 'Fase de grupos',
  knockout: 'Eliminatorias',
};

export default function PhasePerformanceChart({ data = [] }) {
  const chartData = data.map((row) => ({
    ...row,
    label: PHASE_LABELS[row.phase] ?? row.phase,
  }));

  return (
    <AnalyticsChartCard
      title="MSE por fase del torneo"
      description="Error promedio en grupos vs eliminatorias."
      hint="Útil para detectar si el modelo rinde distinto según la etapa."
      empty={!chartData.length}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={analyticsColors.grid} />
          <XAxis dataKey="label" tick={axisTick} />
          <YAxis tick={axisTick} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, _n, props) => [`${v} (${props.payload.count} partidos)`, 'MSE prom.']}
          />
          <Bar dataKey="avgMse" name="MSE prom." fill={analyticsColors.cyan} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
