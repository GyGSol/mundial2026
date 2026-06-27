import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import { REALTIME_EVENTS } from '../../lib/realtimeSectors.js';
import AdminCard from '../../components/admin/AdminCard.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import {
  adminBtnOutline,
  adminInput,
  adminMuted,
  adminPage,
  adminTableWrap,
} from '../../components/admin/adminTheme.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import TeamFlag from '../../components/TeamFlag.jsx';

export default function AdminStreamLinksPage() {
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({
    matchExternalId: '',
    la18PageUrl: '',
    embedUrl: '',
    la18EventId: '',
    notes: '',
  });
  const [suggestions, setSuggestions] = useState([]);

  const fetchLinks = useCallback(() => adminApi.listStreamLinks(), []);
  const fetchToday = useCallback(() => adminApi.listTodayTransmissions(), []);
  const { data, loading, error, refresh } = useLiveData(fetchLinks, [], {
    realtimeEvents: [],
    memoryCacheKey: 'admin:streams',
    memoryCacheTtlMs: 120_000,
  });
  const {
    data: todayData,
    loading: todayLoading,
    refresh: refreshToday,
  } = useLiveData(fetchToday, [], {
    realtimeEvents: [REALTIME_EVENTS.MATCHES_UPDATED],
    realtimeDebounceMs: 750,
  });

  const streamLinks = data?.streamLinks ?? [];
  const todayMatches = todayData?.matches ?? [];

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveLink(event) {
    event.preventDefault();
    if (!form.matchExternalId.trim() || !form.la18PageUrl.trim()) {
      setMessage('Completá matchExternalId y URL FPT');
      return;
    }

    setBusyId('save');
    setMessage('');
    try {
      await adminApi.upsertStreamLink(form.matchExternalId.trim(), {
        la18PageUrl: form.la18PageUrl.trim(),
        embedUrl: form.embedUrl.trim() || form.la18PageUrl.trim(),
        la18EventId: form.la18EventId.trim(),
        notes: form.notes.trim(),
        enabled: true,
      });
      setMessage('Link guardado');
      await Promise.all([refresh(), refreshToday()]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeLink(matchExternalId) {
    setBusyId(matchExternalId);
    setMessage('');
    try {
      await adminApi.deleteStreamLink(matchExternalId);
      setMessage('Link eliminado');
      await Promise.all([refresh(), refreshToday()]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function loadSuggestions() {
    if (!form.matchExternalId.trim()) {
      setMessage('Ingresá un matchExternalId para sugerencias');
      return;
    }

    setBusyId('suggest');
    setMessage('');
    setSuggestions([]);
    try {
      const result = await adminApi.suggestStreamLinks(form.matchExternalId.trim());
      setSuggestions(result.suggestions ?? []);
      if (!result.enabled) {
        setMessage('Scraper desactivado (LA18HD_SCRAPER_ENABLED=false). Pegá la URL manualmente.');
      } else if (!result.suggestions?.length) {
        setMessage('Sin sugerencias para este partido');
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function applySuggestion(item) {
    setForm((prev) => ({
      ...prev,
      la18PageUrl: item.url,
      embedUrl: item.url,
      la18EventId: item.eventId || prev.la18EventId,
    }));
  }

  function fillFormFromMatch(match) {
    const mapping = match.mapping;
    setForm({
      matchExternalId: String(match.externalId),
      la18PageUrl: mapping?.la18PageUrl ?? '',
      embedUrl: mapping?.embedUrl ?? '',
      la18EventId: mapping?.la18EventId ?? '',
      notes: mapping?.notes ?? '',
    });
    setSuggestions([]);
    setMessage('');
  }

  return (
    <div className={adminPage}>
      <AdminPageHeader
        title="Transmisión FPT"
        description="Asigná URLs de Fútbol para Todos por partido sin redeploy. Solo visible cuando el partido está en vivo."
      />

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-amber-300">{message}</p> : null}

      <AdminCard accent flush contentClassName="p-0" title="Partidos de hoy">
        {todayLoading && !todayMatches.length ? (
          <p className={`p-4 ${adminMuted}`}>Cargando partidos…</p>
        ) : null}
        {!todayLoading && !todayMatches.length ? (
          <p className={`p-4 ${adminMuted}`}>No hay partidos programados para hoy.</p>
        ) : null}
        {todayMatches.length ? (
          <div className={adminTableWrap}>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead>Partido</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Señal</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayMatches.map((match) => {
                  const home = match.homeTeam?.nameEn || match.homeTeamId;
                  const away = match.awayTeam?.nameEn || match.awayTeamId;
                  return (
                    <TableRow key={match.externalId} className="border-slate-800">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TeamFlag team={match.homeTeam} sizeClass="size-5" />
                          <span>{home}</span>
                          <span className={adminMuted}>vs</span>
                          <TeamFlag team={match.awayTeam} sizeClass="size-5" />
                          <span>{away}</span>
                          <span className={`text-xs ${adminMuted}`}>#{match.externalId}</span>
                        </div>
                      </TableCell>
                      <TableCell>{match.status}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {match.mapping?.embedUrl || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={adminBtnOutline}
                          onClick={() => fillFormFromMatch(match)}
                        >
                          {match.mapping ? 'Editar URL' : 'Asignar URL'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </AdminCard>

      <AdminCard accent title="Nuevo / editar mapping">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={saveLink}>
          <div className="space-y-2">
            <label htmlFor="matchExternalId" className={`text-sm ${adminMuted}`}>
              matchExternalId
            </label>
            <Input
              id="matchExternalId"
              className={adminInput}
              value={form.matchExternalId}
              onChange={(e) => updateForm('matchExternalId', e.target.value)}
              placeholder="ej. 42"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="la18EventId" className={`text-sm ${adminMuted}`}>
              la18EventId (opcional)
            </label>
            <Input
              id="la18EventId"
              className={adminInput}
              value={form.la18EventId}
              onChange={(e) => updateForm('la18EventId', e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="la18PageUrl" className={`text-sm ${adminMuted}`}>
              URL FPT (eventos o canal)
            </label>
            <Input
              id="la18PageUrl"
              className={adminInput}
              value={form.la18PageUrl}
              onChange={(e) => updateForm('la18PageUrl', e.target.value)}
              placeholder="https://futbolparatodos.su/eventos.html?r=… o /canal/dsports.html"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="embedUrl" className={`text-sm ${adminMuted}`}>
              URL iframe (opcional, default = página)
            </label>
            <Input
              id="embedUrl"
              className={adminInput}
              value={form.embedUrl}
              onChange={(e) => updateForm('embedUrl', e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="notes" className={`text-sm ${adminMuted}`}>
              Notas
            </label>
            <Input
              id="notes"
              className={adminInput}
              value={form.notes}
              onChange={(e) => updateForm('notes', e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button type="submit" disabled={busyId === 'save'}>
              Guardar
            </Button>
            <Button
              type="button"
              variant="outline"
              className={adminBtnOutline}
              disabled={busyId === 'suggest'}
              onClick={loadSuggestions}
            >
              Cargar señales FPT
            </Button>
          </div>
        </form>

        {suggestions.length ? (
          <div className="mt-4 space-y-2">
            <p className={adminMuted}>Señales del evento (click para usar una como override admin)</p>
            <ul className="space-y-1 text-sm">
              {suggestions.map((item) => (
                <li key={item.url}>
                  <button
                    type="button"
                    className="text-left text-sky-300 hover:underline"
                    onClick={() => applySuggestion(item)}
                  >
                    {item.label || item.title} — {item.url}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {form.la18PageUrl ? (
          <div className="mt-6">
            <p className={`mb-2 ${adminMuted}`}>Preview iframe</p>
            <iframe
              title="Preview FPT"
              src={form.embedUrl || form.la18PageUrl}
              className="aspect-video w-full max-w-xl rounded border border-slate-700 bg-black"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
              allow="autoplay; fullscreen; encrypted-media"
            />
          </div>
        ) : null}
      </AdminCard>

      <AdminCard accent flush contentClassName="p-0" title="Mappings activos">
        {loading && !streamLinks.length ? <p className={`p-4 ${adminMuted}`}>Cargando…</p> : null}
        <div className={adminTableWrap}>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead>Partido</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {streamLinks.map((row) => (
                <TableRow key={row.matchExternalId} className="border-slate-800">
                  <TableCell>{row.matchExternalId}</TableCell>
                  <TableCell>{row.la18EventId || '—'}</TableCell>
                  <TableCell className="max-w-xs truncate">{row.embedUrl}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={adminBtnOutline}
                      disabled={busyId === row.matchExternalId}
                      onClick={() => {
                        setForm({
                          matchExternalId: row.matchExternalId,
                          la18PageUrl: row.la18PageUrl,
                          embedUrl: row.embedUrl,
                          la18EventId: row.la18EventId ?? '',
                          notes: row.notes ?? '',
                        });
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="ml-2"
                      disabled={busyId === row.matchExternalId}
                      onClick={() => removeLink(row.matchExternalId)}
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AdminCard>
    </div>
  );
}
