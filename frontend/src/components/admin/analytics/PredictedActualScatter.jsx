import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import AnalyticsChartCard from './AnalyticsChartCard.jsx';
import { analyticsColors, axisTick, chartMargin, tooltipStyle } from './analyticsTheme.js';

export default function PredictedActualScatter({ data = [] }) {
  const chartData = data.map((row) => ({
    ...row,
    name: `#${row.externalId}`,
  }));

  return (
    <AnalyticsChartCard
      title="Predicho vs real (goles totales)"
      description="Cada punto es un partido: eje X = goles totales predichos, Y = reales."
      hint="Puntos sobre la diagonal y=x serían predicciones perfectas en volumen de goles."
      empty={!chartData.length}
      height="h-72"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={analyticsColors.grid} />
          <XAxis type="number" dataKey="predTotal" name="Predichos" tick={axisTick} allowDecimals={false} />
          <YAxis type="number" dataKey="actualTotal" name="Reales" tick={axisTick} allowDecimals={false} />
          <ZAxis range={[60, 60]} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [v, name === 'predTotal' ? 'Predichos' : 'Reales']}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload;
              if (!row) return '';
              return `${row.name}: pred ${row.predHome}-${row.predAway} · real ${row.actualHome}-${row.actualAway}`;
            }}
          />
          <Legend />
          <Scatter name="Partidos" data={chartData} fill={analyticsColors.violet} />
        </ScatterChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
