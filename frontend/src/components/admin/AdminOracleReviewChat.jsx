import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, SendHorizontal, Trash2 } from 'lucide-react';
import { adminApi } from '../../api/adminClient.js';
import MarkdownContent from '../MarkdownContent.jsx';
import { adminBtnOutline, adminInput, adminMuted } from './adminTheme.js';
import { Button } from '@/components/ui/button.jsx';

export const ADMIN_ORACLE_QUESTION_MAX_LEN = 2000;

const QUICK_PROMPTS = [
  '¿Hay alucinaciones en el razonamiento?',
  '¿Qué variables del contexto pesaron más?',
  '¿Cómo corregirías el prompt de entrenamiento?',
  'Resume el error vs el resultado real',
];

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function ChatBubble({ role, content, createdAt }) {
  const isUser = role === 'user';
  return (
    <div
      className={
        isUser
          ? 'ml-6 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm'
          : 'mr-6 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-sm'
      }
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {isUser ? 'Admin' : 'Oracle'}
        </span>
        {createdAt ? <time className="text-[10px] text-slate-500">{formatTime(createdAt)}</time> : null}
      </div>
      {isUser ? (
        <p className="whitespace-pre-wrap text-slate-200">{content}</p>
      ) : (
        <MarkdownContent className="text-sm text-slate-300">{content}</MarkdownContent>
      )}
    </div>
  );
}

export default function AdminOracleReviewChat({ logId, disabled = false }) {
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');

  const loadThread = useCallback(async () => {
    if (!logId) {
      setThread(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = await adminApi.getAdminOracleReview(logId);
      setThread(payload);
    } catch (err) {
      setError(err.message);
      setThread(null);
    } finally {
      setLoading(false);
    }
  }, [logId]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const messagesNewestFirst = useMemo(
    () => [...(thread?.messages ?? [])].reverse(),
    [thread?.messages]
  );

  async function handleAsk(event) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || !logId || asking) return;

    setAsking(true);
    setError('');
    try {
      const payload = await adminApi.askAdminOracleReview(logId, trimmed);
      setThread(payload);
      setQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  }

  async function handleClear() {
    if (!logId || clearing) return;
    setClearing(true);
    setError('');
    try {
      const payload = await adminApi.clearAdminOracleReview(logId);
      setThread(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setClearing(false);
    }
  }

  if (!logId) {
    return <p className={adminMuted}>Seleccioná un log oficial para revisar contexto con Oracle.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-slate-200">Revisión interactiva con Oracle</h3>
          <p className={`text-xs ${adminMuted}`}>
            Preguntá sobre el contexto, detectá alucinaciones y definí correcciones para entrenamiento.
          </p>
        </div>
        {thread?.messages?.length ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-slate-400 hover:text-red-300"
            disabled={asking || clearing}
            onClick={() => void handleClear()}
          >
            {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            <span className="ml-1">Limpiar</span>
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {loading ? (
        <p className={adminMuted}>Cargando conversación…</p>
      ) : (
        <>
          {messagesNewestFirst.length ? (
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
              {messagesNewestFirst.map((entry) => (
                <ChatBubble
                  key={entry.id ?? `${entry.role}-${entry.createdAt}`}
                  role={entry.role}
                  content={entry.content}
                  createdAt={entry.createdAt}
                />
              ))}
            </div>
          ) : (
            <p className={`rounded-lg border border-dashed border-slate-700/60 px-3 py-4 text-center text-xs ${adminMuted}`}>
              Sin mensajes todavía. Usá una consulta rápida o escribí tu pregunta.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                size="sm"
                variant="outline"
                className={`${adminBtnOutline} text-xs`}
                disabled={disabled || asking}
                onClick={() => setQuestion(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>

          <form onSubmit={handleAsk} className="flex flex-col gap-2 border-t border-slate-700/60 pt-3">
            <label className="text-xs text-slate-400">
              Tu pregunta ({question.length}/{ADMIN_ORACLE_QUESTION_MAX_LEN})
            </label>
            <textarea
              className={`${adminInput} min-h-[100px] w-full resize-y`}
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, ADMIN_ORACLE_QUESTION_MAX_LEN))}
              placeholder="Ej: ¿Inventó algún dato del clima o de lesiones que no está en el contexto?"
              disabled={disabled || asking}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                className={adminBtnOutline}
                disabled={disabled || asking || !question.trim()}
              >
                {asking ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <SendHorizontal className="mr-1 size-3.5" />
                )}
                {asking ? 'Consultando…' : 'Preguntar a Oracle'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
