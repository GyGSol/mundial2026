import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dices, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input.jsx';
import { MAX_GOALS_PER_TEAM, randomMatchScore } from '@/lib/randomMatchScore.js';
import { formatPredictionUpdatedAt } from '@/lib/dateFormat.js';
import TeamHeader from './TeamHeader.jsx';
import BroadcastBadges from '@/components/BroadcastBadges.jsx';
import PredictionLockCountdown from '@/components/PredictionLockCountdown.jsx';
import { PenaltyShootoutScoreLine } from '@/components/PenaltyShootoutDisplay.jsx';
import { resolveFieldMatchScores } from '@/lib/matchDisplayScore.js';

/** Mismo ancho/alto en web y móvil para Guardar y Editar */
const PREDICTION_ACTION_BUTTON_CLASS = 'min-w-28 px-4';
const EDIT_PREDICTION_BUTTON_CLASS =
  'border border-amber-500/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25 hover:text-amber-50';

function ScoreCell({ children }) {
  return <div className="flex justify-center">{children}</div>;
}

function ScoreValue({ value, label }) {
  return (
    <div className="w-16 text-center md:w-20 lg:w-24">
      {label && (
        <span className="mb-0.5 block text-[10px] font-normal uppercase tracking-wide text-muted-foreground md:text-xs">
          {label}
        </span>
      )}
      <p className="text-xl font-bold tabular-nums text-foreground md:text-2xl lg:text-3xl">{value}</p>
    </div>
  );
}

function PredictionUpdatedAt({ updatedAt }) {
  const label = formatPredictionUpdatedAt(updatedAt);
  if (!label) return null;
  return (
    <p className="text-center text-xs text-muted-foreground">
      Última predicción: {label}
    </p>
  );
}

function PredictionLockNotice({ match }) {
  if (match.status !== 'upcoming' || match.predictionOpen === false) return null;
  return (
    <PredictionLockCountdown
      kickoffAt={match.kickoffAt}
      lockAt={match.lockAt}
      predictionOpen={match.predictionOpen}
      status={match.status}
    />
  );
}

function MatchScoreboard({
  homeTeam,
  awayTeam,
  homeTeamSlotLabel,
  awayTeamSlotLabel,
  homeTeamSlotSourceMatch,
  awayTeamSlotSourceMatch,
  showActualScores,
  homeScore,
  awayScore,
  penaltyShootout,
  homePrediction,
  awayPrediction,
  homeInput,
  awayInput,
}) {
  return (
    <div className="flex w-full flex-col gap-3 md:gap-4 lg:gap-5">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:gap-6">
        <TeamHeader
          team={homeTeam}
          slotLabel={homeTeamSlotLabel}
          slotSourceMatch={homeTeamSlotSourceMatch}
        />
        <TeamHeader
          team={awayTeam}
          slotLabel={awayTeamSlotLabel}
          slotSourceMatch={awayTeamSlotSourceMatch}
        />
      </div>

      {showActualScores && (
        <div className="flex flex-col items-center gap-1">
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-3">
            <ScoreCell>
              <ScoreValue value={homeScore} label="Resultado" />
            </ScoreCell>
            <span className="text-lg font-medium text-muted-foreground md:text-xl lg:text-2xl">-</span>
            <ScoreCell>
              <ScoreValue value={awayScore} label="Resultado" />
            </ScoreCell>
          </div>
          <PenaltyShootoutScoreLine penaltyShootout={penaltyShootout} />
        </div>
      )}

      {(homePrediction != null || awayPrediction != null || homeInput || awayInput) && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-3">
          <ScoreCell>
            {homeInput ?? <ScoreValue value={homePrediction} label={showActualScores ? 'Tu predicción' : null} />}
          </ScoreCell>
          <span className="text-lg font-medium text-muted-foreground md:text-xl lg:text-2xl">-</span>
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

function AiInsightButton({ match }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      asChild
      title="Consultar con IA (preguntas, no marcador)"
      className="gap-1.5 min-w-28 border-violet-500/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20 hover:text-violet-50"
    >
      <Link to={`/ai-predictions?topic=match&match=${match.id}`}>
        <Sparkles className="size-4" aria-hidden />
        IA
      </Link>
    </Button>
  );
}

function PredictionActions({ children, match }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
      <AiInsightButton match={match} />
    </div>
  );
}

function KnockoutPredictionHint({ visible }) {
  if (!visible) return null;
  return (
    <p className="max-w-md text-center text-xs text-muted-foreground">
      Fase eliminatoria: predicción = marcador tras el alargue (empate válido). Los penales no cuentan
      para puntos.
    </p>
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
    if (editing) return;
    setHome(match.prediction?.homeGoals ?? 0);
    setAway(match.prediction?.awayGoals ?? 0);
    setEditing(!hasPrediction && !locked);
  }, [match.id, match.prediction?.homeGoals, match.prediction?.awayGoals, hasPrediction, locked, editing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const homeGoals = Number(home);
    const awayGoals = Number(away);
    if (
      !Number.isInteger(homeGoals) ||
      !Number.isInteger(awayGoals) ||
      homeGoals < 0 ||
      awayGoals < 0 ||
      homeGoals > MAX_GOALS_PER_TEAM ||
      awayGoals > MAX_GOALS_PER_TEAM
    ) {
      return;
    }

    try {
      await onSave(match.id, homeGoals, awayGoals);
      setEditing(false);
    } catch {
      // Mantener modo edición si el guardado falló.
    }
  };

  const applyRandomScore = () => {
    const { homeGoals, awayGoals } = randomMatchScore();
    setHome(homeGoals);
    setAway(awayGoals);
    setEditing(true);
  };

  const showActualScores = match.status !== 'upcoming';
  const prediction = match.prediction;
  const fieldScores = resolveFieldMatchScores(match);
  const isKnockout =
    match.isKnockout ||
    (Number(match.externalId) >= 73 && Number(match.externalId) <= 104);

  const inputProps = (side) => ({
    type: 'number',
    min: 0,
    max: MAX_GOALS_PER_TEAM,
    value: side === 'home' ? home : away,
    onChange: (e) => (side === 'home' ? setHome : setAway)(e.target.value),
    className: 'w-16 text-center text-xl font-bold tabular-nums md:w-20 md:text-2xl lg:w-24 lg:text-3xl',
    'aria-label': side === 'home' ? 'Goles local' : 'Goles visitante',
  });

  const teamDisplayProps = {
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeTeamSlotLabel: match.homeTeamSlotLabel,
    awayTeamSlotLabel: match.awayTeamSlotLabel,
    homeTeamSlotSourceMatch: match.homeTeamSlotSourceMatch,
    awayTeamSlotSourceMatch: match.awayTeamSlotSourceMatch,
  };

  if (locked) {
    return (
      <div className="flex flex-col items-center gap-3">
        <MatchScoreboard
          {...teamDisplayProps}
          showActualScores={showActualScores}
          homeScore={fieldScores.homeScore}
          awayScore={fieldScores.awayScore}
          penaltyShootout={match.penaltyShootout}
          homePrediction={hasPrediction ? prediction?.homeGoals : undefined}
          awayPrediction={hasPrediction ? prediction?.awayGoals : undefined}
        />
        {hasPrediction ? <PredictionUpdatedAt updatedAt={prediction?.updatedAt} /> : null}
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
          {...teamDisplayProps}
          showActualScores={showActualScores}
          homeScore={fieldScores.homeScore}
          awayScore={fieldScores.awayScore}
          penaltyShootout={match.penaltyShootout}
          homePrediction={prediction.homeGoals}
          awayPrediction={prediction.awayGoals}
        />
        <PredictionLockNotice match={match} />
        <KnockoutPredictionHint visible={isKnockout} />
        <PredictionUpdatedAt updatedAt={prediction.updatedAt} />
        <PredictionActions match={match}>
          <Button
            type="button"
            size="sm"
            onClick={() => setEditing(true)}
            className={cn(PREDICTION_ACTION_BUTTON_CLASS, EDIT_PREDICTION_BUTTON_CLASS)}
          >
            Editar
          </Button>
          <RandomScoreButton onClick={applyRandomScore} />
        </PredictionActions>
        <BroadcastRow broadcasters={broadcasters} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
      <MatchScoreboard
        {...teamDisplayProps}
        showActualScores={showActualScores}
        homeScore={fieldScores.homeScore}
        awayScore={fieldScores.awayScore}
        penaltyShootout={match.penaltyShootout}
        homeInput={<Input {...inputProps('home')} />}
        awayInput={<Input {...inputProps('away')} />}
      />

      <PredictionLockNotice match={match} />
      <KnockoutPredictionHint visible={isKnockout} />

      <div className="flex flex-col items-center gap-2">
        <PredictionActions match={match}>
          <RandomScoreButton onClick={applyRandomScore} />
          <Button
            type="submit"
            size="sm"
            disabled={saving}
            className={PREDICTION_ACTION_BUTTON_CLASS}
          >
            {saving ? '...' : 'Guardar'}
          </Button>
        </PredictionActions>
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
