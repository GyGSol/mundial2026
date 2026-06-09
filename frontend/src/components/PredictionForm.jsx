import { useEffect, useState } from 'react';
import { Dices } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input.jsx';
import { MAX_GOALS_PER_TEAM, randomMatchScore } from '@/lib/randomMatchScore.js';
import TeamHeader from './TeamHeader.jsx';
import BroadcastBadges from '@/components/BroadcastBadges.jsx';

/** Mismo ancho/alto en web y móvil para Guardar y Editar */
const PREDICTION_ACTION_BUTTON_CLASS = 'min-w-28 px-4';
const EDIT_PREDICTION_BUTTON_CLASS =
  'border border-amber-300/80 bg-amber-100/60 text-amber-900 hover:bg-amber-200/70 hover:text-amber-950';

function ScoreCell({ children }) {
  return <div className="flex justify-center">{children}</div>;
}

function ScoreValue({ value, label }) {
  return (
    <div className="w-16 text-center">
      {label && (
        <span className="mb-0.5 block text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      )}
      <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function MatchScoreboard({
  homeTeam,
  awayTeam,
  showActualScores,
  homeScore,
  awayScore,
  homePrediction,
  awayPrediction,
  homeInput,
  awayInput,
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <TeamHeader team={homeTeam} />
        <TeamHeader team={awayTeam} />
      </div>

      {showActualScores && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <ScoreCell>
            <ScoreValue value={homeScore} label="Resultado" />
          </ScoreCell>
          <span className="text-lg font-medium text-muted-foreground">-</span>
          <ScoreCell>
            <ScoreValue value={awayScore} label="Resultado" />
          </ScoreCell>
        </div>
      )}

      {(homePrediction != null || awayPrediction != null || homeInput || awayInput) && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <ScoreCell>
            {homeInput ?? <ScoreValue value={homePrediction} label={showActualScores ? 'Tu predicción' : null} />}
          </ScoreCell>
          <span className="text-lg font-medium text-muted-foreground">-</span>
          <ScoreCell>
            {awayInput ?? <ScoreValue value={awayPrediction} label={showActualScores ? 'Tu predicción' : null} />}
          </ScoreCell>
        </div>
      )}
    </div>
  );
}

function RandomScoreButton({ onClick }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      title="Completar con un resultado aleatorio (máx. 10 goles por equipo, sin goleadas extremas)"
      className="gap-1.5"
    >
      <Dices className="size-4" aria-hidden />
      Al azar
    </Button>
  );
}

function BroadcastRow({ broadcasters }) {
  if (!broadcasters?.length) return null;
  return (
    <div className="flex w-full justify-center pt-2">
      <BroadcastBadges
        broadcasters={broadcasters}
        size="xs"
        label="Lo podes ver en"
        className="w-full"
      />
    </div>
  );
}

export default function PredictionForm({ match, onSave, saving, broadcasters = [] }) {
  const locked = !match.predictionOpen;
  const hasPrediction = Boolean(match.hasPrediction ?? match.prediction?.userSubmitted);
  const [editing, setEditing] = useState(!hasPrediction && !locked);
  const [home, setHome] = useState(match.prediction?.homeGoals ?? 0);
  const [away, setAway] = useState(match.prediction?.awayGoals ?? 0);

  useEffect(() => {
    setHome(match.prediction?.homeGoals ?? 0);
    setAway(match.prediction?.awayGoals ?? 0);
    setEditing(!hasPrediction && !locked);
  }, [match.id, match.prediction?.homeGoals, match.prediction?.awayGoals, hasPrediction, locked]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(match.id, Number(home), Number(away));
    setEditing(false);
  };

  const applyRandomScore = () => {
    const { homeGoals, awayGoals } = randomMatchScore();
    setHome(homeGoals);
    setAway(awayGoals);
    setEditing(true);
  };

  const showActualScores = match.status !== 'upcoming';
  const prediction = match.prediction;

  const inputProps = (side) => ({
    type: 'number',
    min: 0,
    max: MAX_GOALS_PER_TEAM,
    value: side === 'home' ? home : away,
    onChange: (e) => (side === 'home' ? setHome : setAway)(e.target.value),
    className: 'w-16 text-center text-xl font-bold tabular-nums',
    'aria-label': side === 'home' ? 'Goles local' : 'Goles visitante',
  });

  if (locked) {
    return (
      <div className="flex flex-col items-center gap-3">
        <MatchScoreboard
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          showActualScores={showActualScores}
          homeScore={match.homeScore}
          awayScore={match.awayScore}
          homePrediction={hasPrediction ? prediction?.homeGoals : undefined}
          awayPrediction={hasPrediction ? prediction?.awayGoals : undefined}
        />
        {prediction?.pointsEarned != null && (
          <p className="text-sm font-medium text-foreground">+{prediction.pointsEarned} pts</p>
        )}
        {!hasPrediction && <p className="text-sm text-muted-foreground">Predicción cerrada</p>}
        <BroadcastRow broadcasters={broadcasters} />
      </div>
    );
  }

  if (hasPrediction && !editing) {
    return (
      <div className="flex flex-col items-center gap-4">
        <MatchScoreboard
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          showActualScores={showActualScores}
          homeScore={match.homeScore}
          awayScore={match.awayScore}
          homePrediction={prediction.homeGoals}
          awayPrediction={prediction.awayGoals}
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setEditing(true)}
            className={cn(PREDICTION_ACTION_BUTTON_CLASS, EDIT_PREDICTION_BUTTON_CLASS)}
          >
            Editar
          </Button>
          <RandomScoreButton onClick={applyRandomScore} />
        </div>
        <BroadcastRow broadcasters={broadcasters} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
      <MatchScoreboard
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        showActualScores={showActualScores}
        homeScore={match.homeScore}
        awayScore={match.awayScore}
        homeInput={<Input {...inputProps('home')} />}
        awayInput={<Input {...inputProps('away')} />}
      />

      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <RandomScoreButton onClick={applyRandomScore} />
          <Button
            type="submit"
            size="sm"
            disabled={saving}
            className={PREDICTION_ACTION_BUTTON_CLASS}
          >
            {saving ? '...' : 'Guardar'}
          </Button>
        </div>
        {hasPrediction ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        ) : null}
        <BroadcastRow broadcasters={broadcasters} />
      </div>
    </form>
  );
}
