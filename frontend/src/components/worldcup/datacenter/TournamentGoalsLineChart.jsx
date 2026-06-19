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
import ChartCard from './ChartCard.jsx';
import { axisTick, chartColors, chartMargin, tooltipStyle } from './chartTheme.js';

export default function TournamentGoalsLineChart({ data = [] }) {
  return (
    <ChartCard
      title="Evolución ofensiva en Mundiales"
      description="Goles anotados por las selecciones del 2026 en cada edición (suma histórica Wikipedia)."
      hint="Picos altos sugieren ediciones con muchos goles de equipos aún presentes en 2026."
      empty={!data.length}
      height="h-64"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis dataKey="year" tick={axisTick} />
          <YAxis tick={axisTick} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="goals" name="Goles" stroke={chartColors.chart2} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="avgGoalsPerMatch" name="GF/partido" stroke={chartColors.chart1} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
