import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { adminApi } from '../../api/adminClient.js';
import AdminCard from './AdminCard.jsx';
import AdminStatCard from './AdminStatCard.jsx';
import { adminBtnOutline, adminMuted, adminTableWrap } from './adminTheme.js';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';

function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function downloadJsonl(filename, jsonl) {
  const blob = new Blob([jsonl.endsWith('\n') ? jsonl : `${jsonl}\n`], {
    type: 'application/x-ndjson',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'oracle-training-buffer.jsonl';
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminOracleLearningPanel({ onRefreshOverview }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await adminApi.getAdminLearningOverview();
      setData(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const calibration = data?.calibration ?? null;
  const training = data?.training ?? null;
  const rows = data?.recentTrainingRows ?? [];

  const calibrationNotes = useMemo(() => {
    if (!calibration) return [];
    const items = [];
    if (calibration.nota) items.push(calibration.nota);
    if (calibration.puedeAjustar) items.push('El pipeline puede aplicar nudge automático de calibración.');
    return items;
  }, [calibration]);

  async function handleExport() {
    setExportBusy(true);
    setExportMessage('');
    try {
      const result = await adminApi.exportTrainingBuffer();
      if (!result.exported) {
        setExportMessage('No hay filas pendientes de exportar.');
        return;
      }
      if (result.jsonl) {
        downloadJsonl(result.filename, result.jsonl);
      }
      setExportMessage(`Exportadas ${result.exported} muestras para entrenamiento CS-3.`);
      await load();
      onRefreshOverview?.();
    } catch (err) {
      setExportMessage(err.message);
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <AdminCard>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Laboratorio Oracle — aprendizaje</h2>
          <p className={`mt-1 text-xs ${adminMuted}`}>
            Calibración rolling, buffer de entrenamiento y export para fine-tuning Cerebras.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className={adminBtnOutline}
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className="mr-1 size-3.5" />
            Actualizar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={adminBtnOutline}
            disabled={exportBusy || !training?.unexported}
            onClick={() => void handleExport()}
          >
            {exportBusy ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Download className="mr-1 size-3.5" />
            )}
            Exportar buffer ({training?.unexported ?? 0})
          </Button>
        </div>
      </div>

      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      {exportMessage ? <p className="mb-3 text-xs text-slate-400">{exportMessage}</p> : null}
      {loading && !data ? <p className={adminMuted}>Cargando laboratorio…</p> : null}

      {data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminStatCard
              label="Muestras en buffer"
              value={training?.total ?? 0}
              hint={`${training?.unexported ?? 0} sin exportar`}
            />
            <AdminStatCard
              label="MSE promedio"
              value={training?.avgMse != null ? training.avgMse.toFixed(3) : '—'}
              hint={training?.maxMse != null ? `Máx ${training.maxMse}` : ''}
            />
            <AdminStatCard
              label="Error combinado (Gdif)"
              value={calibration?.errorCombinado ?? '—'}
              hint={`${calibration?.partidosAnalizados ?? 0} partidos analizados`}
            />
            <AdminStatCard
              label="Calibración auto"
              value={calibration?.puedeAjustar ? 'Activa' : 'En espera'}
              hint={data.hasAiProvider ? data.aiUserEmail ?? 'IA configurada' : 'Sin proveedor IA'}
            />
          </div>

          {calibrationNotes.length ? (
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 text-sm text-slate-300">
              <p className="mb-1 font-medium text-slate-200">Sesgos detectados</p>
              <ul className="list-inside list-disc text-xs text-slate-400">
                {calibrationNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
                {calibration?.sesgoLocal ? <li>Sesgo local: {calibration.sesgoLocal}</li> : null}
                {calibration?.sesgoVisitante ? (
                  <li>Sesgo visitante: {calibration.sesgoVisitante}</li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Últimas muestras del buffer
            </h3>
            {rows.length ? (
              <div className={adminTableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partido</TableHead>
                      <TableHead>Predicho</TableHead>
                      <TableHead>Real</TableHead>
                      <TableHead>MSE</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs text-slate-400">
                          {row.matchId.slice(-6)}
                          <div className="text-[10px] text-slate-500">{formatDate(row.createdAt)}</div>
                        </TableCell>
                        <TableCell>
                          {row.predictedScore.home}-{row.predictedScore.away}
                        </TableCell>
                        <TableCell>
                          {row.actualScore.home}-{row.actualScore.away}
                        </TableCell>
                        <TableCell>{row.mseError}</TableCell>
                        <TableCell>
                          {row.exportedAt ? (
                            <Badge variant="outline">Exportada</Badge>
                          ) : (
                            <Badge variant="secondary">Pendiente</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className={adminMuted}>Aún no hay muestras en el buffer (se registran al finalizar partidos).</p>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Cron export: {training?.exportCron ?? '—'} · Registrar siempre:{' '}
              {training?.alwaysRecord ? 'sí' : 'solo si MSE &gt; 0'}
            </p>
          </div>
        </div>
      ) : null}
    </AdminCard>
  );
}
