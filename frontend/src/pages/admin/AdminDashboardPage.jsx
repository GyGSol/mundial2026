import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import TechnicalDifficulties from '../../components/TechnicalDifficulties.jsx';
import { isSevereError } from '../../lib/apiError.js';
import AdminAdvancesSection from '../../components/admin/AdminAdvancesSection.jsx';
import AdminCard from '../../components/admin/AdminCard.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import AdminStatCard from '../../components/admin/AdminStatCard.jsx';
import { adminHint, adminMuted, adminPage } from '../../components/admin/adminTheme.js';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';

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
    <div className={adminPage}>
      <AdminPageHeader
        title="Resumen"
        description="Estado de la base y operaciones del mundial."
      >
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          Actualizar
        </Button>
      </AdminPageHeader>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {loading && !data ? <p className={adminMuted}>Cargando…</p> : null}

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
            <AdminCard
              className="border-red-900/50 bg-red-950/40"
              header={
                <h3 className="text-base font-semibold text-red-300">Error de sincronización</h3>
              }
            >
              <p className="text-sm text-red-200">{syncError}</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/admin/sync">Ir a Sync</Link>
              </Button>
            </AdminCard>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminStatCard label="Usuarios" value={data.usersCount} />
            <AdminStatCard label="Grupos" value={data.groupsCount} />
            <AdminStatCard label="Membresías" value={data.membershipsCount} />
            <AdminStatCard label="Predicciones" value={data.predictionsCount} />
            <AdminStatCard label="Equipos" value={data.teamsCount} />
            <AdminStatCard
              label="Partidos"
              value={data.matchesCount}
              hint={`↑ ${data.matchStatusCounts?.upcoming ?? 0} · ▶ ${data.matchStatusCounts?.live ?? 0} · ✓ ${data.matchStatusCounts?.finished ?? 0}`}
            />
            <AdminStatCard label="Último sync" value={lastSync} />
          </div>

          <AdminCard title="Acciones rápidas">
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/sync">Ejecutar sync</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/matches">Editar partidos</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/users">Usuarios</Link>
              </Button>
            </div>
          </AdminCard>

          <AdminAdvancesSection />

          <p className={adminHint}>
            Reset completo de la base: solo por CLI (<code className="text-slate-400">npm run reset-db</code>
            ).
          </p>
        </>
      ) : null}
    </div>
  );
}
