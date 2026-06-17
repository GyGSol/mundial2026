import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import AnalyticsChartCard from './AnalyticsChartCard.jsx';
import { analyticsColors, tooltipStyle } from './analyticsTheme.js';

const PIE_COLORS = [
  analyticsColors.cyan,
  analyticsColors.amber,
  analyticsColors.emerald,
  analyticsColors.violet,
  analyticsColors.rose,
  '#94a3b8',
];

const SOURCE_LABELS = {
  cerebras: 'Cerebras (Oracle)',
  gemini: 'Gemini',
  groq: 'Groq',
  'heuristic-xg': 'Heurística xG',
  'heuristic-odds': 'Heurística odds',
  heuristic: 'Heurística',
  unknown: 'Desconocido',
};

export default function ModelSourceChart({ data = [] }) {
  const chartData = data.map((row) => ({
    ...row,
    label: SOURCE_LABELS[row.source] ?? row.source,
  }));

  return (
    <AnalyticsChartCard
      title="Fuentes del modelo"
      description="De dónde provino la predicción oficial en cada partido."
      hint="Oracle usa Cerebras como proveedor principal cuando está configurado."
      empty={!chartData.length}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={80}
            paddingAngle={2}
          >
            {chartData.map((_, idx) => (
              <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v, name, props) => [`${v} (${props.payload.pct}%)`, name]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  );
}
