import FubolsCupMatchTile from '@/components/worldcup/FubolsCupMatchTile.jsx';
import LeaderboardUserAvatar from '@/components/LeaderboardUserAvatar.jsx';
import { formatGoalDiffScore } from '@/lib/goalDiffStats.js';
import { cn } from '@/lib/utils';

/** Cuartos: izquierda 2v7 + 3v6; derecha 1v8 + 4v5 */
const CUARTOS_LEFT_DUEL_INDEXES = [1, 2];
const CUARTOS_RIGHT_DUEL_INDEXES = [0, 3];

const playerRowGridClass =
  'grid grid-cols-[1.75rem_minmax(0,1fr)_2.5rem_2.25rem] items-center gap-x-1.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_3.5rem_3.5rem] sm:gap-x-2';

const liveDuelPlayerRowGridClass =
  'grid grid-cols-[minmax(0,1fr)_2.5rem_3rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] sm:gap-x-3';

const playerRowPaddingClass = 'px-2.5 sm:px-3';

function WorldCupMatchBlock({ wc, duel, sliceByExternalId }) {
  const duelSlice = wc.duelSlice ?? sliceByExternalId?.[wc.externalId] ?? null;
  const hideViewerPrediction = Boolean(
    duel.isDemo || duel.isLiveDuel || wc.match?.status === 'live'
  );
  return (
    <FubolsCupMatchTile
      match={wc.match}
      externalId={wc.externalId}
      duelSlice={duelSlice}
      playerAName={duel.playerA?.name}
      playerBName={duel.playerB?.name}
      playerAId={duel.playerA?.id}
      playerBId={duel.playerB?.id}
      duelWinnerId={duel.winnerId}
      hideViewerPrediction={hideViewerPrediction}
    />
  );
}

function PlayerLineHeader() {
  return (
    <div
      className={cn(
        playerRowGridClass,
        playerRowPaddingClass,
        'text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]'
      )}
    >
      <span>#</span>
      <span className="min-w-0">Jugador</span>
      <span className="text-center">Gdif</span>
      <span className="text-right">Pts</span>
    </div>
  );
}

function LiveDuelPlayerLineHeader({ partial = false }) {
  return (
    <div
      className={cn(
        liveDuelPlayerRowGridClass,
        playerRowPaddingClass,
        'text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]'
      )}
    >
      <span className="min-w-0">Jugador</span>
      <span className="text-center">Gdif</span>
      <span className="text-right">{partial ? 'Pts parcial' : 'Pts'}</span>
    </div>
  );
}

function formatLiveMatchPoints(points) {
  return points == null ? '—' : String(points);
}

function PlayerLine({ player, isWinner }) {
  if (!player?.name) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        Por definir
      </div>
    );
  }

  return (
    <div
      className={cn(
        playerRowGridClass,
        playerRowPaddingClass,
        'rounded-lg border py-2 sm:py-2.5',
        isWinner === true && 'border-primary bg-primary/10 font-semibold',
        isWinner === false && 'opacity-60'
      )}
    >
      <span
        className={cn(
          'text-sm font-bold tabular-nums leading-none sm:text-lg',
          isWinner === true ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {player.seed ?? '—'}
      </span>
      <span className="flex min-w-0 items-center gap-1 sm:gap-1.5">
        <LeaderboardUserAvatar
          name={player.name}
          avatarUrl={player.avatarUrl}
          isAiUser={player.isAiUser}
        />
        <span className="truncate text-sm font-medium sm:text-base">{player.name}</span>
      </span>
      <span className="text-center tabular-nums text-[11px] text-muted-foreground sm:text-xs">
        {formatGoalDiffScore(player.difGl, player.difGv, player.pj)}
      </span>
      <span className="text-right text-xs font-semibold tabular-nums sm:text-sm">
        {player.totalPoints ?? 0}
      </span>
    </div>
  );
}

function LiveDuelPlayerLine({ player, isWinner, highlightGoalDiff = false }) {
  if (!player?.name) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        Por definir
      </div>
    );
  }

  return (
    <div
      className={cn(
        liveDuelPlayerRowGridClass,
        playerRowPaddingClass,
        'rounded-lg border py-2 sm:py-2.5',
        isWinner === true && 'border-primary bg-primary/10 font-semibold',
        isWinner === false && 'opacity-60'
      )}
    >
      <span className="flex min-w-0 items-center gap-1 sm:gap-1.5">
        <LeaderboardUserAvatar
          name={player.name}
          avatarUrl={player.avatarUrl}
          isAiUser={player.isAiUser}
        />
        <span className="truncate text-sm font-medium sm:text-base">{player.name}</span>
      </span>
      <span
        className={cn(
          'text-center tabular-nums text-[11px] sm:text-xs',
          highlightGoalDiff && isWinner === true && 'font-semibold text-primary',
          highlightGoalDiff && isWinner === false && 'text-muted-foreground',
          !highlightGoalDiff && 'text-muted-foreground'
        )}
      >
        {formatGoalDiffScore(player.difGl, player.difGv, player.pj)}
      </span>
      <span
        className={cn(
          'text-right text-sm font-semibold tabular-nums sm:text-base',
          isWinner === true && 'text-primary'
        )}
      >
        {formatLiveMatchPoints(player.matchPoints)}
      </span>
    </div>
  );
}

function usesLiveDuelLayout(duel) {
  return Boolean(duel?.isDemo || duel?.isLiveDuel);
}

function DuelCard({ duel, className }) {
  const worldCupMatches = duel.worldCupMatches ?? [];
  const sliceByExternalId = Object.fromEntries(
    (duel.matchResults ?? [])
      .filter((row) => row.externalId)
      .map((row) => [String(row.externalId), row])
  );
  const isLiveLayout = usesLiveDuelLayout(duel);
  const highlightGoalDiff = duel.tiebreak?.criterion === 'goal_diff_score';

  return (
    <article
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm sm:gap-3 sm:p-5',
        isLiveLayout && 'border-emerald-500/30',
        className
      )}
    >
      <div className="min-w-0">
        {isLiveLayout ? (
          <LiveDuelPlayerLineHeader partial={Boolean(duel.partialHeaderPoints)} />
        ) : (
          <PlayerLineHeader />
        )}
      </div>
      <div className="flex flex-col gap-2">
        {isLiveLayout ? (
          <>
            <LiveDuelPlayerLine
              player={duel.playerA}
              isWinner={
                duel.winnerId && duel.playerA?.id
                  ? duel.playerA.id === duel.winnerId
                    ? true
                    : duel.winnerId
                      ? false
                      : null
                  : null
              }
              highlightGoalDiff={highlightGoalDiff}
            />
            <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              vs
            </p>
            <LiveDuelPlayerLine
              player={duel.playerB}
              isWinner={
                duel.winnerId && duel.playerB?.id
                  ? duel.playerB.id === duel.winnerId
                    ? true
                    : duel.winnerId
                      ? false
                      : null
                  : null
              }
              highlightGoalDiff={highlightGoalDiff}
            />
          </>
        ) : (
          <>
            <PlayerLine
              player={duel.playerA}
              isWinner={
                duel.winnerId && duel.playerA?.id
                  ? duel.playerA.id === duel.winnerId
                    ? true
                    : duel.winnerId
                      ? false
                      : null
                  : null
              }
            />
            <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              vs
            </p>
            <PlayerLine
              player={duel.playerB}
              isWinner={
                duel.winnerId && duel.playerB?.id
                  ? duel.playerB.id === duel.winnerId
                    ? true
                    : duel.winnerId
                      ? false
                      : null
                  : null
              }
            />
          </>
        )}
      </div>
      {duel.tiebreak?.summary ? (
        <p className="text-center text-xs text-muted-foreground">{duel.tiebreak.summary}</p>
      ) : null}

      {worldCupMatches.length ? (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
          {worldCupMatches.map((wc) => (
            <WorldCupMatchBlock
              key={wc.externalId}
              wc={wc}
              duel={duel}
              sliceByExternalId={sliceByExternalId}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function CuartosSplitBracket({ round }) {
  const duels = round?.duels ?? [];
  const pick = (indexes) => indexes.map((i) => duels[i]).filter(Boolean);

  const leftDuels = pick(CUARTOS_LEFT_DUEL_INDEXES);
  const rightDuels = pick(CUARTOS_RIGHT_DUEL_INDEXES);

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-base font-semibold sm:text-lg">{round?.label ?? 'Cuartos de final'}</h3>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-muted-foreground">Lado izquierdo</p>
          {leftDuels.map((duel) => (
            <DuelCard key={duel.duelId} duel={duel} />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-muted-foreground">Lado derecho</p>
          {rightDuels.map((duel) => (
            <DuelCard key={duel.duelId} duel={duel} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RoundSection({ round, gridClassName }) {
  if (!round?.duels?.length) return null;

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-base font-semibold sm:text-lg">{round.label}</h3>
      <div className={cn('grid gap-4', gridClassName)}>
        {round.duels.map((duel) => (
          <DuelCard key={duel.duelId} duel={duel} />
        ))}
      </div>
    </section>
  );
}

export default function FubolsCupBracket({ rounds = [], demoDuel = null }) {
  if (!rounds.length && !demoDuel) return null;

  const roundByKey = Object.fromEntries(rounds.map((round) => [round.roundKey, round]));
  const cuartos = roundByKey.quarter_final;
  const semis = roundByKey.semi_final;
  const thirdPlace = roundByKey.third_place;
  const final = roundByKey.final;

  return (
    <div className="flex flex-col gap-8 rounded-lg border bg-card/40 p-3 sm:p-6">
      {cuartos ? <CuartosSplitBracket round={cuartos} /> : null}

      {semis ? <RoundSection round={semis} gridClassName="md:grid-cols-2" /> : null}

      {thirdPlace || final ? (
        <section className="flex flex-col gap-4 border-t border-border/60 pt-6">
          <h3 className="text-base font-semibold sm:text-lg">Cierre del torneo</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {thirdPlace ? <RoundSection round={thirdPlace} /> : null}
            {final ? <RoundSection round={final} /> : null}
          </div>
        </section>
      ) : null}

      {demoDuel ? (
        <section className="flex flex-col gap-4 border-t border-border/60 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold sm:text-lg">Prueba · resultado en vivo</h3>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              Prueba
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Puntos del cruce según el marcador en vivo de los partidos del duelo (España–Austria y Portugal–Croacia; sin mostrar pronósticos).
            La columna Gdif es del torneo: si empatan en puntos del partido, gana quien tiene menor Gdif.
          </p>
          <DuelCard duel={demoDuel} />
        </section>
      ) : null}
    </div>
  );
}
