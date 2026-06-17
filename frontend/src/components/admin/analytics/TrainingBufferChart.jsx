import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AnalyticsChartCard from './AnalyticsChartCard.jsx';
import { analyticsColors, axisTick, chartMargin, tooltipStyle } from './analyticsTheme.js';

export default function TrainingBufferChart({ data = [] }) {
  const chartData = data.map((row) => ({
    ...row,
    label: row.weekBucket,
  }));

  return (
    <AnalyticsChartCard
      title="Crecimiento del buffer de entrenamiento"
      description="Muestras registradas por semana ISO del torneo."
      hint="Exportadas = ya enviadas a fine-tuning; pendientes = en cola."
      empty={!chartData.length}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={chartMargin}>
          <defs>
            <linearGradient id="exportedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={analyticsColors.emerald} stopOpacity={0.5} />
              <stop offset="100%" stopColor={analyticsColors.emerald} stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="pendingGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={analyticsColors.amber} stopOpacity={0.5} />
              <stop offset="100%" stopColor={analyticsColors.amber} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={analyticsColors.grid} />
          <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
          <YAxis tick={axisTick} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Area
            type="monotone"
            dataKey="exported"
            name="Exportadas"
            stackId="1"
            stroke={analyticsColors.emerald}
            fill="url(#exportedGrad)"
          />
          <Area
            type="monotone"
            dataKey="pending"
            name="Pendientes"
            stackId="1"
            stroke={analyticsColors.amber}
            fill="url(#pendingGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
