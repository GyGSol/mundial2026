import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCard from './ChartCard.jsx';
import { axisTick, chartMargin, tooltipStyle, TIER_CHART_COLORS } from './chartTheme.js';

export default function RoundDistributionChart({ data = [], tierLabels = {} }) {
  const chartData = data
    .filter((row) => row.count > 0)
    .map((row) => ({
      ...row,
      label: tierLabels[row.tier] ?? row.tier,
    }));

  return (
    <ChartCard
      title="Fases alcanzadas (histórico agregado)"
      description="Cuántas veces las 48 selecciones llegaron a cada fase en Mundiales pasados."
      hint="Más presencia en cuartos/semis indica regularidad en eliminatorias."
      empty={!chartData.length}
      height="h-64"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={axisTick} />
          <YAxis allowDecimals={false} tick={axisTick} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Apariciones">
            {chartData.map((entry) => (
              <Cell key={entry.tier} fill={TIER_CHART_COLORS[entry.tier] ?? 'hsl(var(--primary))'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
