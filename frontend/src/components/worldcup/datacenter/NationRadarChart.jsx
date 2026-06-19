import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import ChartCard from './ChartCard.jsx';
import { chartColors, tooltipStyle } from './chartTheme.js';

function buildRadarData(nation) {
  if (!nation) return [];
  const rankNorm = nation.fifaRank != null ? Math.max(0, (51 - Math.min(nation.fifaRank, 50)) / 50) * 100 : 0;
  return [
    { metric: 'Pedigree', value: nation.pedigreeIndex ?? 0 },
    { metric: 'Ranking FIFA', value: Math.round(rankNorm) },
    { metric: '% Victorias', value: Math.round((nation.winRate ?? 0) * 100) },
    { metric: 'GF/partido', value: Math.min(100, Math.round((nation.goalsPerGame ?? 0) * 30)) },
    { metric: 'Profundidad', value: Math.round((nation.deepRunRate ?? 0) * 100) },
    { metric: 'Experiencia', value: Math.min(100, (nation.appearances ?? 0) * 5) },
  ];
}

export default function NationRadarChart({ nation }) {
  const chartData = buildRadarData(nation);

  return (
    <ChartCard
      title={nation ? `Perfil analítico — ${nation.name}` : 'Perfil analítico'}
      description="Comparación normalizada de métricas clave para predicción."
      empty={!nation}
      emptyMessage="Elegí una selección para ver su perfil."
      height="h-72"
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Radar dataKey="value" stroke={chartColors.chart2} fill={chartColors.chart2} fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
