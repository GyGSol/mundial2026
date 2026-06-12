import { useCallback, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';

export default function AdminSyncPage() {
  const [running, setRunning] = useState(false);
  const [playerRunning, setPlayerRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState(null);

  const fetchSync = useCallback(() => adminApi.syncStatus(), []);
  const { data, loading, error, refresh } = useLiveData(fetchSync, []);

  async function handleRunSync() {
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const result = await adminApi.runSync();
      setRunResult(result);
      await refresh();
    } catch (err) {
      setRunError(err.message);
      await refresh();
    } finally {
      setRunning(false);
    }
  }

  async function handleRunPlayerSync() {
    setPlayerRunning(true);
    setRunError(null);
    try {
      await adminApi.runPlayerSync();
      setRunResult({ ok: true, players: true });
      await refresh();
    } catch (err) {
      setRunError(err.message);
    } finally {
      setPlayerRunning(false);
    }
  }

  const lastSync = data?.lastSyncAt
    ? new Date(data.lastSyncAt).toLocaleString('es-AR')
    : 'Nunca';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Sincronización</h2>
        <p className="text-sm text-slate-400">
          Descarga partidos y metadatos desde {data?.worldCupApiUrl || 'worldcup26.ir'}.
        </p>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base">Estado</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {loading && !data ? <p className="text-slate-400">Cargando…</p> : null}
          {error ? <p className="text-red-400">{error}</p> : null}
          {data ? (
            <>
              <p>
                <span className="text-slate-400">Último sync:</span> {lastSync}
              </p>
              <p>
                <span className="text-slate-400">Intervalo cron:</span>{' '}
                {Math.round((data.syncIntervalMs || 0) / 1000)}s
              </p>
              <div className="flex flex-wrap gap-2">
                {data.syncCredentialsConfigured ? (
                  <Badge>Credenciales configuradas</Badge>
                ) : (
                  <Badge variant="outline">Sin WORLD_CUP_SYNC_EMAIL/PASSWORD</Badge>
                )}
              </div>
              {data.lastSyncError ? (
                <p className="rounded-md border border-red-900/50 bg-red-950/30 p-3 text-red-300">
                  {data.lastSyncError}
                </p>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base">Sync manual</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={handleRunSync} disabled={running}>
            {running ? 'Sincronizando…' : 'Ejecutar sync ahora'}
          </Button>
          <Button variant="outline" onClick={handleRunPlayerSync} disabled={playerRunning}>
            {playerRunning ? 'Sync jugadores…' : 'Sync jugadores'}
          </Button>
          {runError ? <p className="text-sm text-red-400">{runError}</p> : null}
          {runResult?.ok ? (
            <p className="text-sm text-emerald-400">
              OK — {runResult.matchesCount} partidos, {runResult.teamsCount} equipos,{' '}
              {runResult.groupsCount} grupos FIFA, {runResult.stadiumsCount} estadios.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
