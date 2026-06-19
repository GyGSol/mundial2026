import { useState } from 'react';
import PlayerAvatar from '@/components/PlayerAvatar.jsx';
import PlayerDetailDialog from '@/components/PlayerDetailDialog.jsx';
import CoachDetailDialog from '@/components/lineup/CoachDetailDialog.jsx';
import { inferTacticalPosition } from '@/lib/playerPositionLabel.js';
import { cn } from '@/lib/utils';

/** Margen desde el arco dentro de cada mitad (0–100 de profundidad). */
const DEPTH_EDGE = 6;
const DEPTH_SPAN = 88;

function shortName(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 9);
  return parts[parts.length - 1].slice(0, 11);
}

function lineupPositionLabel(player) {
  return (
    inferTacticalPosition({
      position: player.position,
      positionX: player.gridX,
      positionY: player.gridY,
    }) ?? player.position
  );
}

function formatHoverDetail(player, position) {
  const parts = [
    position,
    player.shirtNumber != null ? `#${player.shirtNumber}` : null,
    player.name,
  ].filter(Boolean);
  return parts.join(' · ');
}

/**
 * gridX: 0 = arco propio, 100 = línea de medio campo (dentro de la mitad del equipo).
 * gridY: 0 = banda superior, 100 = banda inferior.
 */
function teamDotStyle(player, side) {
  const depth = Math.min(100, Math.max(0, Number(player.gridX ?? 50)));
  const lateral = Math.min(100, Math.max(0, Number(player.gridY ?? 50)));
  const top = `${8 + lateral * 0.84}%`;
  const alongHalf = DEPTH_EDGE + (depth / 100) * DEPTH_SPAN;
  const horizontal = side === 'home' ? alongHalf : 100 - alongHalf;

  return { left: `${horizontal}%`, top };
}

function PlayerMarker({ player, side, index, teamCode, onPlayerClick }) {
  const label = shortName(player.name);
  const number = player.shirtNumber;
  const position = lineupPositionLabel(player);
  const style = teamDotStyle(player, side);
  const ringClass = side === 'home' ? 'ring-sky-400/80' : 'ring-rose-400/80';
  const hoverDetail = formatHoverDetail(player, position);

  return (
    <div
      key={player.playerId ?? `${side}-${index}`}
      className="group/marker absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={style}
    >
      <button
        type="button"
        className="flex flex-col items-center gap-px rounded-md p-px transition hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        onClick={(event) => {
          event.stopPropagation();
          onPlayerClick?.({
            ...player,
            position,
            teamSide: side,
            teamFifaCode: teamCode,
          });
        }}
        aria-label={`Ver ficha de ${player.name}`}
      >
        {position ? (
          <span className="text-[5px] font-semibold leading-none text-white/90 sm:text-[6px]">
            {position}
          </span>
        ) : null}

        <PlayerAvatar
          name={player.name}
          photoUrl={player.photoUrl}
          size="xs"
          className={cn('h-5 w-5 shadow-sm ring-1 sm:h-6 sm:w-6', ringClass)}
        />

        {label ? (
          <span className="max-w-[40px] truncate rounded bg-black/65 px-0.5 py-px text-[6px] font-medium leading-tight text-white shadow-sm sm:max-w-[48px] sm:text-[7px]">
            {number != null ? (
              <span className={cn('font-bold', side === 'home' ? 'text-sky-200' : 'text-rose-200')}>
                {number}
              </span>
            ) : null}
            {number != null ? ' ' : null}
            {label}
          </span>
        ) : null}
      </button>

      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden w-max max-w-[11rem] -translate-x-1/2 rounded-md border border-white/20 bg-black/90 px-2 py-1 text-center text-[9px] leading-snug text-white shadow-lg group-hover/marker:block"
      >
        <p className="font-semibold">{hoverDetail}</p>
        {player.positionDetail ? (
          <p className="text-[8px] text-white/75">{player.positionDetail}</p>
        ) : null}
        <p className="mt-0.5 text-[8px] text-white/60">Clic para ver ficha</p>
      </div>
    </div>
  );
}

function PitchHalf({ players, side, teamLabel, teamCode, onPlayerClick }) {
  return (
    <div
      className={cn(
        'absolute inset-y-0 w-1/2',
        side === 'home' ? 'left-0' : 'right-0'
      )}
      aria-label={teamLabel}
    >
      <div className="relative h-full w-full">
        {players.map((player, index) => (
          <PlayerMarker
            key={player.playerId ?? `${side}-${index}`}
            player={player}
            side={side}
            index={index}
            teamCode={teamCode}
            onPlayerClick={onPlayerClick}
          />
        ))}
      </div>
    </div>
  );
}

function CoachBadge({ coach, side, formation, onCoachClick }) {
  const coachName = typeof coach === 'string' ? coach : coach?.name;
  const photoUrl = typeof coach === 'object' && coach ? coach.photoUrl : null;
  if (!coachName) return null;

  const label = shortName(coachName);
  const ringClass = side === 'home' ? 'ring-sky-400/80' : 'ring-rose-400/80';

  return (
    <div className="group/coach relative">
      <button
        type="button"
        className="flex flex-col items-center gap-px rounded-md p-px transition hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        onClick={(event) => {
          event.stopPropagation();
          onCoachClick?.({
            ...(typeof coach === 'object' && coach ? coach : { name: coachName, photoUrl }),
            formation: formation ?? null,
            teamSide: side,
          });
        }}
        aria-label={`Ver ficha de ${coachName}`}
      >
        <span className="text-[5px] font-semibold leading-none text-white/90 sm:text-[6px]">DT</span>
        <PlayerAvatar
          name={coachName}
          photoUrl={photoUrl}
          size="xs"
          className={cn('h-5 w-5 shadow-sm ring-1 sm:h-6 sm:w-6', ringClass)}
        />
        {label ? (
          <span className="max-w-[40px] truncate rounded bg-black/65 px-0.5 py-px text-[6px] font-medium leading-tight text-white shadow-sm sm:max-w-[48px] sm:text-[7px]">
            {label}
          </span>
        ) : null}
      </button>

      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden w-max max-w-[11rem] -translate-x-1/2 rounded-md border border-white/20 bg-black/90 px-2 py-1 text-center text-[9px] leading-snug text-white shadow-lg group-hover/coach:block"
      >
        <p className="font-semibold">DT · {coachName}</p>
        <p className="mt-0.5 text-[8px] text-white/60">Clic para ver ficha</p>
      </div>
    </div>
  );
}

function PitchMarkings() {
  return (
    <>
      <div className="pointer-events-none absolute inset-2 rounded border border-white/35" />

      <div className="pointer-events-none absolute bottom-2 left-1/2 top-2 w-px -translate-x-1/2 bg-white/35" />

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" />

      <div className="pointer-events-none absolute bottom-[18%] left-2 top-[18%] w-[18%] border border-white/30" />
      <div className="pointer-events-none absolute bottom-[32%] left-2 top-[32%] w-[7%] border border-white/25" />

      <div className="pointer-events-none absolute bottom-[18%] right-2 top-[18%] w-[18%] border border-white/30" />
      <div className="pointer-events-none absolute bottom-[32%] right-2 top-[32%] w-[7%] border border-white/25" />

      <div className="pointer-events-none absolute bottom-[28%] left-2 top-[28%] w-px bg-white/50" />
      <div className="pointer-events-none absolute bottom-[28%] right-2 top-[28%] w-px bg-white/50" />
    </>
  );
}

export default function PitchFormation({
  lineup,
  homeLabel,
  awayLabel,
  homeTeamCode,
  awayTeamCode,
  className,
}) {
  const homePlayers = lineup?.home?.players ?? [];
  const awayPlayers = lineup?.away?.players ?? [];
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPreview, setDetailPreview] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedExternalId, setSelectedExternalId] = useState(null);
  const [coachDetailOpen, setCoachDetailOpen] = useState(false);
  const [coachDetail, setCoachDetail] = useState(null);

  if (!homePlayers.length && !awayPlayers.length) return null;

  const handlePlayerClick = (player) => {
    setDetailPreview({
      name: player.name,
      photoUrl: player.photoUrl,
      shirtNumber: player.shirtNumber,
      position: player.position,
      teamFifaCode: player.teamFifaCode,
      playerId: player.mongoId ?? null,
      externalId: player.externalId ?? null,
    });
    setSelectedPlayerId(player.mongoId ?? null);
    setSelectedExternalId(player.externalId ?? null);
    setDetailOpen(true);
  };

  const handleDetailOpenChange = (open) => {
    setDetailOpen(open);
    if (!open) {
      setDetailPreview(null);
      setSelectedPlayerId(null);
      setSelectedExternalId(null);
    }
  };

  const handleCoachClick = (coach) => {
    setCoachDetail({
      ...coach,
      teamName:
        coach.teamName ?? (coach.teamSide === 'home' ? homeLabel : awayLabel),
      teamFifaCode:
        coach.teamFifaCode ?? (coach.teamSide === 'home' ? homeTeamCode : awayTeamCode),
    });
    setCoachDetailOpen(true);
  };

  const handleCoachDetailOpenChange = (open) => {
    setCoachDetailOpen(open);
    if (!open) setCoachDetail(null);
  };

  return (
    <>
      <div
        className={cn(
          'relative mx-auto aspect-[5/3] w-full max-w-lg overflow-visible rounded-lg',
          className
        )}
      >
        <div className="absolute inset-0 overflow-hidden rounded-lg border border-emerald-700/50 bg-gradient-to-b from-emerald-700 to-emerald-800">
          <PitchMarkings />

          <div className="pointer-events-none absolute bottom-1 left-2 flex items-end gap-1">
            <div className="pointer-events-auto">
              <CoachBadge
                coach={lineup?.home?.coach}
                side="home"
                formation={lineup?.home?.formation}
                onCoachClick={handleCoachClick}
              />
            </div>
            <span className="rounded bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">
              {homeLabel}
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-1 right-2 flex items-end gap-1">
            <span className="rounded bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">
              {awayLabel}
            </span>
            <div className="pointer-events-auto">
              <CoachBadge
                coach={lineup?.away?.coach}
                side="away"
                formation={lineup?.away?.formation}
                onCoachClick={handleCoachClick}
              />
            </div>
          </div>
        </div>

        <PitchHalf
          players={homePlayers}
          side="home"
          teamLabel={homeLabel}
          teamCode={homeTeamCode}
          onPlayerClick={handlePlayerClick}
        />
        <PitchHalf
          players={awayPlayers}
          side="away"
          teamLabel={awayLabel}
          teamCode={awayTeamCode}
          onPlayerClick={handlePlayerClick}
        />
      </div>

      {detailOpen ? (
        <PlayerDetailDialog
          playerId={selectedPlayerId}
          externalId={selectedExternalId}
          preview={detailPreview}
          open={detailOpen}
          onOpenChange={handleDetailOpenChange}
        />
      ) : null}

      {coachDetailOpen ? (
        <CoachDetailDialog
          coach={coachDetail}
          open={coachDetailOpen}
          onOpenChange={handleCoachDetailOpenChange}
        />
      ) : null}
    </>
  );
}
