import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import ChartCard from './ChartCard.jsx';
import { axisTick, chartColors, chartMargin, tooltipStyle } from './chartTheme.js';

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div style={tooltipStyle} className="p-2">
      <p className="font-medium">{row.name}</p>
      <p>GF/partido: {row.goalsPerGame}</p>
      <p>GC/partido: {row.goalsAgainstPerGame}</p>
      <p>Pedigree: {row.pedigreeIndex}</p>
    </div>
  );
}

export default function OffenseDefenseScatter({ data = [] }) {
  const chartData = data.filter((row) => row.goalsPerGame > 0 || row.goalsAgainstPerGame > 0);

  return (
    <ChartCard
      title="Ofensiva vs defensiva histórica"
      description="Promedio de goles a favor y en contra por partido en Mundiales (Wikipedia)."
      hint="Arriba-derecha = ataque fuerte y defensa sólida en la historia reciente del torneo."
      empty={!chartData.length}
      height="h-72"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ ...chartMargin, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis
            type="number"
            dataKey="goalsPerGame"
            name="GF/partido"
            tick={axisTick}
            label={{ value: 'Goles a favor / partido', position: 'insideBottom', offset: -2, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="goalsAgainstPerGame"
            name="GC/partido"
            tick={axisTick}
            label={{ value: 'Goles en contra / partido', angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          <ZAxis type="number" dataKey="pedigreeIndex" range={[40, 200]} />
          <Tooltip content={<ScatterTooltip />} />
          <Scatter data={chartData} fill={chartColors.chart1} fillOpacity={0.75} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
