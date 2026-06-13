import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
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
  const { data, loading, error, refresh } = useLiveData(fetchLinks, []);

  const streamLinks = data?.streamLinks ?? [];

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveLink(event) {
    event.preventDefault();
    if (!form.matchExternalId.trim() || !form.la18PageUrl.trim()) {
      setMessage('Completá matchExternalId y URL La18HD');
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
      await refresh();
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
      await refresh();
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

  return (
    <div className={adminPage}>
      <AdminPageHeader
        title="Transmisión La18HD"
        description="Asigná URLs por partido sin redeploy. Solo visible cuando el partido está en vivo."
      />

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-amber-300">{message}</p> : null}

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
              URL La18HD
            </label>
            <Input
              id="la18PageUrl"
              className={adminInput}
              value={form.la18PageUrl}
              onChange={(e) => updateForm('la18PageUrl', e.target.value)}
              placeholder="https://la18hd.com/evento/..."
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
              Sugerencias scraper
            </Button>
          </div>
        </form>

        {suggestions.length ? (
          <div className="mt-4 space-y-2">
            <p className={adminMuted}>Sugerencias (click para aplicar)</p>
            <ul className="space-y-1 text-sm">
              {suggestions.map((item) => (
                <li key={item.url}>
                  <button
                    type="button"
                    className="text-left text-sky-300 hover:underline"
                    onClick={() => applySuggestion(item)}
                  >
                    [{item.score}] {item.title} — {item.url}
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
              title="Preview La18HD"
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
