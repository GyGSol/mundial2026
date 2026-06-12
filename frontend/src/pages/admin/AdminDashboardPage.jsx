import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import TechnicalDifficulties from '../../components/TechnicalDifficulties.jsx';
import { isSevereError } from '../../lib/apiError.js';
import AdminAdvancesSection from '../../components/admin/AdminAdvancesSection.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';

function StatCard({ label, value, hint }) {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardContent className="pt-4">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-slate-100">{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const fetchStats = useCallback(() => adminApi.stats(), []);
  const { data, loading, error, refresh } = useLiveData(fetchStats, []);

  if (error && isSevereError(error)) {
    return (
      <TechnicalDifficulties
        error={error}
        title="No se pudo cargar el panel"
        onRetry={refresh}
      />
    );
  }

  const syncError = data?.lastSyncError;
  const lastSync = data?.lastSyncAt
    ? new Date(data.lastSyncAt).toLocaleString('es-AR')
    : 'Nunca';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Resumen</h2>
          <p className="text-sm text-slate-400">Estado de la base y operaciones del mundial.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          Actualizar
        </Button>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {loading && !data ? <p className="text-sm text-slate-400">Cargando…</p> : null}

      {data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.db === 'connected' ? 'default' : 'outline'}>
              DB: {data.db}
            </Badge>
            {data.syncCredentialsConfigured ? (
              <Badge variant="outline">Sync API configurada</Badge>
            ) : (
              <Badge variant="outline">Sync API sin credenciales</Badge>
            )}
          </div>

          {syncError ? (
            <Card className="border-red-900/50 bg-red-950/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-300">Error de sincronización</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-200">{syncError}</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/admin/sync">Ir a Sync</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Usuarios" value={data.usersCount} />
            <StatCard label="Grupos" value={data.groupsCount} />
            <StatCard label="Membresías" value={data.membershipsCount} />
            <StatCard label="Predicciones" value={data.predictionsCount} />
            <StatCard label="Equipos" value={data.teamsCount} />
            <StatCard
              label="Partidos"
              value={data.matchesCount}
              hint={`↑ ${data.matchStatusCounts?.upcoming ?? 0} · ▶ ${data.matchStatusCounts?.live ?? 0} · ✓ ${data.matchStatusCounts?.finished ?? 0}`}
            />
            <StatCard label="Último sync" value={lastSync} />
          </div>

          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-base">Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/sync">Ejecutar sync</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/matches">Editar partidos</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/users">Usuarios</Link>
              </Button>
            </CardContent>
          </Card>

          <AdminAdvancesSection />

          <p className="text-xs text-slate-500">
            Reset completo de la base: solo por CLI (<code className="text-slate-400">npm run reset-db</code>
            ).
          </p>
        </>
      ) : null}
    </div>
  );
}
