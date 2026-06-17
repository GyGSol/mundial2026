import AdminCard from '../AdminCard.jsx';
import { adminMuted } from '../adminTheme.js';

export default function AnalyticsChartCard({
  title,
  description,
  hint,
  meta,
  loading,
  error,
  empty,
  emptyMessage = 'Sin datos para este gráfico.',
  height = 'h-64',
  children,
  className = '',
}) {
  return (
    <AdminCard className={className}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-slate-200">{title}</h3>
          {description ? <p className={`mt-0.5 text-xs ${adminMuted}`}>{description}</p> : null}
          {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
        </div>
        {meta ? <p className="text-xs text-slate-400">{meta}</p> : null}
      </div>

      {loading ? <p className={adminMuted}>Cargando…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {!loading && empty ? <p className={adminMuted}>{emptyMessage}</p> : null}
      {!loading && !empty && !error ? (
        <div className={`${height} w-full`}>{children}</div>
      ) : null}
    </AdminCard>
  );
}
