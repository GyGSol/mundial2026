import { useCallback } from 'react';
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
import { useLiveData } from '../../hooks/useLiveData.js';
import { adminApi } from '../../api/adminClient.js';
import AdminCard from './AdminCard.jsx';
import { adminMuted } from './adminTheme.js';

function formatKickoffShort(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(iso));
}

export default function OracleErrorCurveChart() {
  const fetchCurve = useCallback(() => adminApi.getOracleErrorCurve({ year: 2026 }), []);
  const { data, loading, error } = useLiveData(fetchCurve, []);

  const points = data?.points ?? [];
  const summary = data?.summary ?? null;

  const chartData = points.map((p) => ({
    ...p,
    label: `#${p.externalId ?? p.matchIndex}`,
    kickoffLabel: formatKickoffShort(p.kickoffAt),
  }));

  return (
    <AdminCard className="mb-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-slate-200">Curva de error Oracle</h2>
          <p className={adminMuted}>
            MSE por partido y promedio acumulado — objetivo Gdif → 0.000
          </p>
        </div>
        {summary ? (
          <p className="text-xs text-slate-400">
            {summary.partidos} partidos · MSE prom. {summary.msePromedio} ·{' '}
            {summary.tendencia}
          </p>
        ) : null}
      </div>

      {loading ? <p className={adminMuted}>Cargando curva…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {!loading && !points.length ? (
        <p className={adminMuted}>Sin partidos puntuados del Mundial 2026 todavía.</p>
      ) : null}

      {chartData.length > 0 ? (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  fontSize: 12,
                }}
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
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="cumulativeAvgMse"
                name="MSE promedio acumulado"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </AdminCard>
  );
}
