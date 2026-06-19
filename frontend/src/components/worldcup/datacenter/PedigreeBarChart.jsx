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

export default function PedigreeBarChart({ data = [] }) {
  const chartData = [...data].slice(0, 15);

  return (
    <ChartCard
      title="Pedigree histórico"
      description="Índice 0–100 que combina títulos, finales, profundidad en Mundiales, % victorias y ranking FIFA."
      hint="Útil para comparar experiencia en Copas del Mundo entre selecciones del 2026."
      empty={!chartData.length}
      height="h-80"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis type="number" domain={[0, 100]} tick={axisTick} />
          <YAxis type="category" dataKey="name" tick={axisTick} width={100} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="pedigreeIndex" name="Pedigree" fill={chartColors.chart2} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
