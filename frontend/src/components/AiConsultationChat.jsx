import { useMemo } from 'react';
import { Loader2, SendHorizontal, Sparkles } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

function formatMessageTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function InsightScore({ homeGoals, awayGoals }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-lg border border-violet-500/30 bg-violet-500/10 px-6 py-4">
      <span className="text-3xl font-bold tabular-nums">{homeGoals}</span>
      <span className="text-xl text-muted-foreground">-</span>
      <span className="text-3xl font-bold tabular-nums">{awayGoals}</span>
    </div>
  );
}

function ChatMessage({ role, content, createdAt }) {
  const isUser = role === 'user';
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        isUser
          ? 'ml-4 border-primary/20 bg-primary/10'
          : 'mr-4 border-border bg-muted/50'
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {isUser ? 'Vos' : 'IA'}
        </p>
        {createdAt ? (
          <time className="text-[10px] text-muted-foreground" dateTime={createdAt}>
            {formatMessageTime(createdAt)}
          </time>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap text-foreground">{content}</p>
    </div>
  );
}

export default function AiConsultationChat({
  thread,
  loading,
  error,
  asking,
  question,
  onQuestionChange,
  onAsk,
  onGenerateInsight,
  showInsightAction,
  quickPrompts = [],
  onQuickPrompt,
}) {
  const hasMessages = (thread?.messages?.length ?? 0) > 0;
  const insight = thread?.initialInsight;
  const messagesNewestFirst = useMemo(
    () => [...(thread?.messages ?? [])].reverse(),
    [thread?.messages]
  );

  return (
    <div className="flex min-h-[24rem] flex-col gap-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <LoadingSpinner variant="compact" label="Cargando consulta…" className="flex-1" />
      ) : (
        <>
          {hasMessages ? (
            <div className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
              {messagesNewestFirst.map((entry) => (
                <ChatMessage
                  key={entry.id ?? `${entry.role}-${entry.createdAt}`}
                  role={entry.role}
                  content={entry.content}
                  createdAt={entry.createdAt}
                />
              ))}
            </div>
          ) : null}

          {insight ? (
            <div className="flex flex-col gap-3">
              <InsightScore homeGoals={insight.homeGoals} awayGoals={insight.awayGoals} />
              <p className="text-xs text-muted-foreground">
                Predicción guardada · {insight.model ?? insight.source}
              </p>
              {showInsightAction ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onGenerateInsight}
                  disabled={asking}
                  className="self-start gap-1.5 border-violet-500/30 text-violet-100 hover:bg-violet-500/10"
                >
                  {asking ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Predecir marcador
                </Button>
              ) : null}
            </div>
          ) : showInsightAction ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-violet-500/40 bg-violet-500/5 px-4 py-8 text-center">
              <Sparkles className="size-6 text-violet-300" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Pedile a la IA un marcador para este partido. La consulta queda guardada.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={onGenerateInsight}
                disabled={asking}
                className="gap-1.5 border-violet-500/30 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25"
              >
                {asking ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Predecir marcador
              </Button>
            </div>
          ) : !hasMessages ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Elegí una consulta rápida o escribí tu pregunta. El historial se guarda para seguir la charla.
            </p>
          ) : null}

          {quickPrompts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={asking}
                  onClick={() => onQuickPrompt(prompt)}
                  className="text-xs"
                >
                  {prompt}
                </Button>
              ))}
            </div>
          ) : null}

          <form onSubmit={onAsk} className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
            <label htmlFor="ai-consultation-question" className="text-sm font-medium">
              Tu pregunta
            </label>
            <textarea
              id="ai-consultation-question"
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              placeholder="Ej: ¿Quién clasifica como tercero del grupo?"
              rows={3}
              maxLength={500}
              disabled={asking}
              className="flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button type="submit" size="sm" disabled={asking || !question.trim()} className="self-end gap-1.5">
              {asking ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <SendHorizontal className="size-4" aria-hidden />
              )}
              {asking ? 'Enviando...' : 'Preguntar'}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
