import { useEffect, useRef, useState } from 'react';
import { Loader2, SendHorizontal, Sparkles } from 'lucide-react';
import { predictionsApi } from '@/api/client.js';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import TeamHeader from './TeamHeader.jsx';

function InsightScore({ homeGoals, awayGoals }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-muted/40 px-6 py-4">
      <span className="text-3xl font-bold tabular-nums">{homeGoals}</span>
      <span className="text-xl text-muted-foreground">-</span>
      <span className="text-3xl font-bold tabular-nums">{awayGoals}</span>
    </div>
  );
}

function ChatMessage({ role, content }) {
  const isUser = role === 'user';
  return (
    <div
      className={
        isUser
          ? 'ml-6 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm'
          : 'mr-6 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm'
      }
    >
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {isUser ? 'Vos' : 'IA'}
      </p>
      <p className="whitespace-pre-wrap text-foreground">{content}</p>
    </div>
  );
}

export default function AiPredictionDialog({ match, open, onOpenChange }) {
  const dialogRef = useRef(null);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setInsight(null);
      setError('');
      setQuestion('');
      setHistory([]);
      setLoading(false);
      setAsking(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setInsight(null);
    setHistory([]);
    setQuestion('');

    predictionsApi
      .aiInsight(match.id)
      .then((data) => {
        if (!cancelled) setInsight(data.insight);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, match.id]);

  const handleClose = () => onOpenChange(false);

  const handleAsk = async (e) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || !insight || asking) return;

    setAsking(true);
    setError('');
    const nextHistory = [...history, { role: 'user', content: trimmed }];
    setHistory(nextHistory);
    setQuestion('');

    try {
      const data = await predictionsApi.aiFollowUp(match.id, {
        question: trimmed,
        history,
        insight,
      });
      setHistory([...nextHistory, { role: 'assistant', content: data.reply.answer }]);
    } catch (err) {
      setError(err.message);
      setHistory(history);
      setQuestion(trimmed);
    } finally {
      setAsking(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="max-h-[90vh] w-[min(100%,32rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/40"
      onClose={handleClose}
      onCancel={handleClose}
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="size-4 text-violet-400" aria-hidden />
              Predicción IA
            </CardTitle>
            <CardDescription>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <TeamHeader team={match.homeTeam} slotLabel={match.homeTeamSlotLabel} />
                <TeamHeader team={match.awayTeam} slotLabel={match.awayTeamSlotLabel} />
              </div>
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cerrar
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
              <Skeleton className="h-16 w-40" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : insight ? (
            <>
              <InsightScore homeGoals={insight.homeGoals} awayGoals={insight.awayGoals} />
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Por qué este resultado</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{insight.reasoning}</p>
              </div>

              {history.length > 0 ? (
                <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                  {history.map((entry, index) => (
                    <ChatMessage key={`${entry.role}-${index}`} role={entry.role} content={entry.content} />
                  ))}
                </div>
              ) : null}

              <form onSubmit={handleAsk} className="flex flex-col gap-2 border-t border-border pt-4">
                <label htmlFor={`ai-follow-up-${match.id}`} className="text-sm font-medium">
                  Repreguntar
                </label>
                <textarea
                  id={`ai-follow-up-${match.id}`}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ej: ¿Y si juega el suplente del 9?"
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
          ) : null}
        </CardContent>
      </Card>
    </dialog>
  );
}
