import { useEffect, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import FubolCoinIcon from '../../components/FubolCoinIcon.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';

export default function AdminEconomyPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const overview = await adminApi.getEconomyOverview();
        if (!cancelled) setData(overview);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error cargando economía');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Economía Fubols" subtitle="Pozos, premios proyectados y estado de la Banca" />

      {loading ? <p className="text-slate-400">Cargando…</p> : null}
      {error ? <p className="text-red-300">{error}</p> : null}

      {data ? (
        <>
          <Card className="border-amber-500/40 bg-amber-950/30 text-slate-100">
            <CardHeader>
              <CardTitle className="text-base">Estado de la Banca</CardTitle>
              <CardDescription className="text-amber-100/80">
                {data.bankAlert?.message}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 text-sm">
              <span>
                La Casa:{' '}
                <strong className="inline-flex items-center gap-1">
                  {data.treasury?.houseBalanceFubols ?? 0}
                  <FubolCoinIcon size="sm" />
                </strong>
              </span>
              <span>
                Liquidez:{' '}
                <strong className="inline-flex items-center gap-1">
                  {data.treasury?.liquidFubols ?? 0}
                  <FubolCoinIcon size="sm" />
                </strong>
              </span>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {data.groups?.map((group) => (
              <Card key={group.groupId} className="border-slate-700 bg-slate-900/60 text-slate-100">
                <CardHeader>
                  <CardTitle className="text-lg">{group.groupName}</CardTitle>
                  <CardDescription className="text-slate-400">
                    Pozo actual:{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-200">
                      {group.prizePoolTotal}
                      <FubolCoinIcon size="sm" />
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {group.projection?.distribution?.map((slot) => (
                    <div
                      key={`${group.groupId}-${slot.rank}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-700/80 px-3 py-2 text-sm"
                    >
                      <span>
                        {slot.rank}º — {slot.name || '—'} ({slot.percent}%)
                      </span>
                      <span className="inline-flex items-center gap-2">
                        {slot.isAiUser ? (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-200">
                            La Casa +{slot.retainedByHouse}
                          </Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium">
                            {slot.fubols}
                            <FubolCoinIcon size="sm" />
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                  {group.bankStatus?.aiRank ? (
                    <p className="text-xs text-amber-200/90">
                      IA en puesto {group.bankStatus.aiRank} — custodia proyectada{' '}
                      {group.bankStatus.custodiedFubols} Fubols
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
