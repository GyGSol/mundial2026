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
import { formatKickoffShort, withChartLabels } from './chartHelpers.js';

export default function OracleErrorCurveChart({ errorCurve, loading, error }) {
  const points = errorCurve?.points ?? [];
  const summary = errorCurve?.summary ?? null;

  const chartData = withChartLabels(points).map((p) => ({
    ...p,
    kickoffLabel: formatKickoffShort(p.kickoffAt),
  }));

  return (
    <AnalyticsChartCard
      title="Curva de error Oracle"
      description="MSE por partido y promedio acumulado — orden cronológico del torneo."
      hint="Menor MSE = mejor. El promedio acumulado muestra la tendencia general."
      meta={
        summary
          ? `${summary.partidos} partidos · MSE prom. ${summary.msePromedio} · ${summary.tendencia}`
          : null
      }
      loading={loading}
      error={error}
      empty={!chartData.length}
      emptyMessage="Sin partidos puntuados del Mundial 2026 todavía."
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={analyticsColors.grid} />
          <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
          <YAxis tick={axisTick} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [value, name === 'mseError' ? 'MSE' : 'MSE acum.']}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload;
              if (!row) return '';
              return `${row.kickoffLabel} · pred ${row.predictedScore?.join('-')} · real ${row.actualScore?.join('-')}`;
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="mseError"
            name="MSE partido"
            stroke={analyticsColors.amber}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="cumulativeAvgMse"
            name="MSE promedio acumulado"
            stroke={analyticsColors.cyan}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
