import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCard from './ChartCard.jsx';
import { axisTick, chartColors, chartMargin, tooltipStyle } from './chartTheme.js';

export default function TitlesBarChart({ data = [] }) {
  const chartData = data.filter((row) => row.titles > 0);

  return (
    <ChartCard
      title="Títulos mundiales (participantes 2026)"
      description="Copas del Mundo ganadas entre las selecciones de este torneo."
      hint="Mayor peso psicológico e historial en fases finales."
      empty={!chartData.length}
      height="h-56"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis dataKey="name" tick={axisTick} interval={0} angle={-25} textAnchor="end" height={60} />
          <YAxis allowDecimals={false} tick={axisTick} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="titles" name="Títulos" fill={chartColors.chart3} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
