import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { aiConsultationsApi, matchesApi } from '../api/client.js';
import AiConsultationChat, { InsightScore } from '../components/AiConsultationChat.jsx';
import MatchVenueWeather from '../components/MatchVenueWeather.jsx';
import { GROUP_LETTERS } from '../lib/groupColors.js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';

const TOPICS = [
  { id: 'match', label: 'Partido' },
  { id: 'group', label: 'Grupo' },
  { id: 'round_of_16', label: '16avos' },
];

const QUICK_PROMPTS = {
  match: [
    '¿Quién es favorito?',
    'Factores clave del partido',
    '¿Cómo afectan las bajas?',
    'Clima y sede del estadio',
    'Compará ranking FIFA y forma reciente',
  ],
  group: [
    '¿Quién pasa del grupo?',
    'Proyectá la tabla final',
    '¿Cuál tercero es más competitivo?',
  ],
  round_of_16: [
    '¿Quién clasifica a los 16avos?',
    '¿Qué terceros pasan?',
    'Explicá los cruces según mis predicciones',
  ],
};

function matchLabel(match) {
  const home = match.homeTeam?.fifaCode ?? match.homeTeam?.nameEn ?? '?';
  const away = match.awayTeam?.fifaCode ?? match.awayTeam?.nameEn ?? '?';
  const date = match.kickoffAt
    ? new Date(match.kickoffAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
    : '';
  return `${home} vs ${away}${date ? ` · ${date}` : ''}`;
}

function resolveTopicFromParams(searchParams) {
  const rawTopic = searchParams.get('topic');
  const topicType = TOPICS.some((t) => t.id === rawTopic)
    ? rawTopic
    : searchParams.get('match')
      ? 'match'
      : 'match';
  const topicKey =
    searchParams.get('key') ??
    searchParams.get('match') ??
    (topicType === 'round_of_16' ? 'round_of_16' : '');
  return { topicType, topicKey };
}

export default function AiPredictionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = resolveTopicFromParams(searchParams);
  const [topicType, setTopicType] = useState(initial.topicType);
  const [topicKey, setTopicKey] = useState(initial.topicKey);
  const [thread, setThread] = useState(null);
  const [matchVenue, setMatchVenue] = useState(null);
  const [threads, setThreads] = useState([]);
  const [matches, setMatches] = useState([]);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [clearingConversation, setClearingConversation] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');

  const syncUrl = useCallback(
    (nextType, nextKey) => {
      const params = new URLSearchParams();
      params.set('topic', nextType);
      if (nextType === 'match' && nextKey) params.set('match', nextKey);
      else if (nextType === 'group' && nextKey) params.set('key', nextKey);
      setSearchParams(params, { replace: true });
    },
    [setSearchParams]
  );

  useEffect(() => {
    matchesApi
      .list({ status: 'upcoming' })
      .then((data) => setMatches(data.matches ?? []))
      .catch(() => setMatches([]));
  }, []);

  useEffect(() => {
    aiConsultationsApi
      .listThreads()
      .then((data) => {
        setThreads(data.threads ?? []);
        setAiAvailable(data.aiAvailable !== false);
      })
      .catch(() => {});
  }, [thread?.updatedAt]);

  const loadThread = useCallback(async (type, key) => {
    if (!key && type !== 'round_of_16') {
      setThread(null);
      setMatchVenue(null);
      return;
    }
    const resolvedKey = type === 'round_of_16' ? 'round_of_16' : key;
    setLoading(true);
    setError('');
    try {
      const data = await aiConsultationsApi.getThread(type, resolvedKey);
      setThread(data.thread);
      setMatchVenue(data.matchVenue ?? null);
      setAiAvailable(data.aiAvailable !== false);
    } catch (err) {
      setError(err.message);
      setThread(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fromUrl = resolveTopicFromParams(searchParams);
    setTopicType(fromUrl.topicType);
    setTopicKey(fromUrl.topicKey);
  }, [searchParams]);

  useEffect(() => {
    if (topicType === 'round_of_16') {
      loadThread('round_of_16', 'round_of_16');
      return;
    }
    if (topicKey) {
      loadThread(topicType, topicKey);
    } else {
      setThread(null);
    }
  }, [topicType, topicKey, loadThread]);

  useEffect(() => {
    if (topicType !== 'match' || topicKey || matches.length === 0) return;
    const first = matches[0]?.id;
    if (first) {
      setTopicKey(first);
      syncUrl('match', first);
    }
  }, [topicType, topicKey, matches, syncUrl]);

  useEffect(() => {
    if (topicType !== 'group' || topicKey) return;
    setTopicKey('A');
    syncUrl('group', 'A');
  }, [topicType, topicKey, syncUrl]);

  const handleTopicChange = (nextType) => {
    setQuestion('');
    setError('');
    if (nextType === 'round_of_16') {
      setTopicType(nextType);
      setTopicKey('round_of_16');
      syncUrl(nextType, 'round_of_16');
      return;
    }
    if (nextType === 'group') {
      setTopicType(nextType);
      setTopicKey('A');
      syncUrl(nextType, 'A');
      return;
    }
    const nextMatch = matches[0]?.id ?? '';
    setTopicType(nextType);
    setTopicKey(nextMatch);
    if (nextMatch) syncUrl(nextType, nextMatch);
  };

  const handleKeyChange = (nextKey) => {
    setQuestion('');
    setError('');
    setTopicKey(nextKey);
    syncUrl(topicType, nextKey);
  };

  const handleGenerateInsight = async () => {
    if (!topicKey || asking) return;
    setAsking(true);
    setError('');
    try {
      const data = await aiConsultationsApi.generateInsight(topicKey);
      setThread(data.thread);
      setMatchVenue(data.matchVenue ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    await submitQuestion(question.trim());
  };

  const submitQuestion = async (trimmed) => {
    const resolvedKey = topicType === 'round_of_16' ? 'round_of_16' : topicKey;
    if (!trimmed || !resolvedKey || asking) return;

    setAsking(true);
    setError('');
    setQuestion('');

    try {
      const data = await aiConsultationsApi.ask({
        topicType,
        topicKey: resolvedKey,
        question: trimmed,
      });
      setThread(data.thread);
      setMatchVenue(data.matchVenue ?? null);
    } catch (err) {
      setError(err.message);
      setQuestion(trimmed);
    } finally {
      setAsking(false);
    }
  };

  const handleQuickPrompt = async (prompt) => {
    if (asking) return;
    if (topicType === 'match' && prompt === 'Predecir marcador') {
      await handleGenerateInsight();
      return;
    }
    await submitQuestion(prompt);
  };

  const handleClearConversation = async () => {
    const resolvedKey = topicType === 'round_of_16' ? 'round_of_16' : topicKey;
    if (!resolvedKey || clearingConversation || asking) return;
    if ((thread?.messages?.length ?? 0) === 0) return;

    const confirmed = window.confirm(
      '¿Borrar las preguntas y respuestas de esta conversación? La predicción de marcador guardada se mantiene.'
    );
    if (!confirmed) return;

    setClearingConversation(true);
    setError('');
    try {
      const data = await aiConsultationsApi.clearConversation({
        topicType,
        topicKey: resolvedKey,
      });
      setThread(data.thread);
      setMatchVenue(data.matchVenue ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setClearingConversation(false);
    }
  };

  const quickPrompts = useMemo(() => {
    const base = QUICK_PROMPTS[topicType] ?? [];
    if (topicType === 'match') {
      return ['Predecir marcador', ...base];
    }
    return base;
  }, [topicType]);

  const threadTitle = useMemo(() => {
    if (thread?.title) return thread.title;
    if (topicType === 'group') return `Grupo ${topicKey}`;
    if (topicType === 'round_of_16') return 'Clasificación a 16avos';
    const match = matches.find((m) => m.id === topicKey);
    return match ? matchLabel(match) : 'Partido';
  }, [thread, topicType, topicKey, matches]);

  const predictionsBackUrl = useMemo(() => {
    if (topicType === 'match' && topicKey) {
      return `/predictions?match=${encodeURIComponent(topicKey)}`;
    }
    return '/predictions';
  }, [topicType, topicKey]);

  return (
    <div className="flex w-full flex-col gap-6 px-0 py-6 pb-24">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-violet-300" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight">Predicciones IA</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Consultá partidos, grupos o quién clasifica a los 16avos. En el Mundial, local y visitante
          son solo la posición en el fixture: la IA analiza sede, estadio y condiciones del partido.
          Tus preguntas y respuestas quedan guardadas para que recuerde el contexto.
        </p>
        {!aiAvailable ? (
          <p className="text-sm text-amber-200">La IA no está disponible en este momento.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {TOPICS.map((topic) => (
          <Button
            key={topic.id}
            type="button"
            size="sm"
            variant={topicType === topic.id ? 'default' : 'outline'}
            onClick={() => handleTopicChange(topic.id)}
          >
            {topic.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" asChild className="ml-auto">
          <Link to={predictionsBackUrl}>Volver a predicciones</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Consulta</CardTitle>
            <CardDescription>Elegí sobre qué querés preguntar</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {topicType === 'match' ? (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Partido</label>
                <Select value={topicKey || undefined} onValueChange={handleKeyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí un partido" />
                  </SelectTrigger>
                  <SelectContent>
                    {matches.map((match) => (
                      <SelectItem key={match.id} value={match.id}>
                        {matchLabel(match)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {topicType === 'group' ? (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Grupo</label>
                <div className="flex flex-wrap gap-2">
                  {GROUP_LETTERS.map((letter) => (
                    <Button
                      key={letter}
                      type="button"
                      size="sm"
                      variant={topicKey === letter ? 'default' : 'outline'}
                      onClick={() => handleKeyChange(letter)}
                    >
                      {letter}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {threads.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <p className="text-sm font-medium">Consultas recientes</p>
                <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                  {threads.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(
                          'w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60',
                          item.topicType === topicType &&
                            item.topicKey === (topicType === 'round_of_16' ? 'round_of_16' : topicKey) &&
                            'bg-muted'
                        )}
                        onClick={() => {
                          setTopicType(item.topicType);
                          setTopicKey(item.topicKey);
                          syncUrl(item.topicType, item.topicKey);
                        }}
                      >
                        <span className="font-medium">{item.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {item.messageCount} mensaje{item.messageCount === 1 ? '' : 's'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{threadTitle}</CardTitle>
            <CardDescription>
              Historial guardado por tema · la IA usa conversaciones anteriores
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {topicType === 'match' && thread?.initialInsight ? (
              <InsightScore
                homeGoals={thread.initialInsight.homeGoals}
                awayGoals={thread.initialInsight.awayGoals}
              />
            ) : null}
            {topicType === 'match' && matchVenue ? (
              <MatchVenueWeather matchVenue={matchVenue} />
            ) : null}
            <AiConsultationChat
              thread={thread}
              loading={loading}
              error={error}
              asking={asking}
              question={question}
              onQuestionChange={setQuestion}
              onAsk={handleAsk}
              onGenerateInsight={handleGenerateInsight}
              showInsightAction={topicType === 'match'}
              quickPrompts={quickPrompts}
              onQuickPrompt={handleQuickPrompt}
              onClearConversation={handleClearConversation}
              clearingConversation={clearingConversation}
              hideInsightScore={topicType === 'match' && Boolean(thread?.initialInsight)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
