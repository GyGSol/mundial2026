import FubolsCupMatchTile from '@/components/worldcup/FubolsCupMatchTile.jsx';
import LeaderboardUserAvatar from '@/components/LeaderboardUserAvatar.jsx';
import { formatGoalDiffScore } from '@/lib/goalDiffStats.js';
import { cn } from '@/lib/utils';

/** Cuartos: izquierda 2v7 + 3v6; derecha 1v8 + 4v5 */
const CUARTOS_LEFT_DUEL_INDEXES = [1, 2];
const CUARTOS_RIGHT_DUEL_INDEXES = [0, 3];

const playerRowGridClass =
  'grid grid-cols-[2rem_minmax(0,1fr)_3rem_3rem] items-center gap-2 sm:grid-cols-[2.5rem_minmax(0,1fr)_3.5rem_3.5rem]';

function WorldCupMatchBlock({ wc }) {
  return <FubolsCupMatchTile match={wc.match} externalId={wc.externalId} />;
}

function PlayerLineHeader() {
  return (
    <div
      className={cn(
        playerRowGridClass,
        'px-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:px-4'
      )}
    >
      <span>#</span>
      <span>Jugador</span>
      <span className="text-center">Gdif</span>
      <span className="text-right">Pts</span>
    </div>
  );
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
        'rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3',
        isWinner === true && 'border-primary bg-primary/10 font-semibold',
        isWinner === false && 'opacity-60'
      )}
    >
      <span
        className={cn(
          'text-base font-bold tabular-nums leading-none sm:text-lg',
          isWinner === true ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {player.seed ?? '—'}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <LeaderboardUserAvatar
          name={player.name}
          avatarUrl={player.avatarUrl}
          isAiUser={player.isAiUser}
        />
        <span className="truncate text-base sm:text-lg">{player.name}</span>
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

function DuelCard({ duel, className }) {
  const worldCupMatches = duel.worldCupMatches ?? [];

  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm sm:gap-3 sm:p-5',
        className
      )}
    >
      <PlayerLineHeader />
      <div className="flex flex-col gap-2">
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
      </div>

      {worldCupMatches.length ? (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
          {worldCupMatches.map((wc) => (
            <WorldCupMatchBlock key={wc.externalId} wc={wc} />
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

export default function FubolsCupBracket({ rounds = [] }) {
  if (!rounds.length) return null;

  const roundByKey = Object.fromEntries(rounds.map((round) => [round.roundKey, round]));
  const cuartos = roundByKey.quarter_final;
  const semis = roundByKey.semi_final;
  const thirdPlace = roundByKey.third_place;
  const final = roundByKey.final;

  return (
    <div className="flex flex-col gap-8 rounded-lg border bg-card/40 p-4 sm:p-6">
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
    </div>
  );
}
