import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ARGENTINA_TIMEZONE, formatMatchDate } from '@/lib/dateFormat';
import { getTeamFlag } from '@/lib/teamMeta';
import { getGroupColor, parseKnockoutSlotLabel } from '@/lib/groupColors.js';
import { KnockoutSlotLabel } from '@/components/worldcup/GroupColorUi.jsx';

function TileCountryLine({ team, slotLabel, slotSourceMatch }) {
  const flagUrl = team ? getTeamFlag(team) : null;
  const title = team?.nameEn || team?.fifaCode || slotLabel || 'Por definir';
  const parsed = !team && slotLabel ? parseKnockoutSlotLabel(slotLabel) : null;
  const accentColor =
    parsed?.type === 'group_position'
      ? getGroupColor(parsed.group, parsed.position)
      : null;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-1.5',
        accentColor && 'border-l-[3px] border-solid pl-1.5'
      )}
      style={accentColor ? { borderLeftColor: accentColor } : undefined}
      title={title}
    >
      {team ? (
        flagUrl ? (
          <img
            src={flagUrl}
            alt=""
            className="size-5 shrink-0 rounded-sm border border-border/60 object-cover"
          />
        ) : team.flag ? (
          <span className="shrink-0 text-sm leading-none">{team.flag}</span>
        ) : (
          <span className="size-5 shrink-0 rounded-sm border border-dashed border-primary/30 bg-primary/5" />
        )
      ) : null}
      {team ? (
        <span className="min-w-0 truncate text-sm font-medium">{team.nameEn || team.fifaCode}</span>
      ) : slotLabel || slotSourceMatch ? (
        <KnockoutSlotLabel
          label={slotLabel}
          slotSourceMatch={slotSourceMatch}
          className="min-w-0 text-xs font-medium"
          compact
        />
      ) : (
        <span className="text-xs text-muted-foreground">Por definir</span>
      )}
    </div>
  );
}

function buildPhaseLabel(match) {
  if (match.group) return `Grupo ${match.group}`;
  if (match.isKnockout && match.knockoutPhase) return match.knockoutPhase;
  return null;
}

function buildPredictionSummary(match) {
  const pred = match.prediction;
  const hasPrediction = Boolean(
    match.hasPrediction ?? (pred?.homeGoals != null && pred?.awayGoals != null)
  );
  if (!hasPrediction) {
    return { text: 'Sin predicción · Tocá para cargar', hasPrediction: false };
  }
  const home = pred?.homeGoals ?? '—';
  const away = pred?.awayGoals ?? '—';
  return { text: `Tu predicción: ${home}–${away}`, hasPrediction: true };
}

export default function FubolsCupMatchTile({ match, externalId }) {
  if (!match?.id) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Partido {externalId}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Fixture aún no disponible</p>
      </div>
    );
  }

  const phase = buildPhaseLabel(match);
  const dateTime = formatMatchDate(match, { showTimezone: true, timeZone: ARGENTINA_TIMEZONE });
  const stadiumLine = [match.stadium?.nameEn, match.stadium?.city].filter(Boolean).join(' · ');
  const prediction = buildPredictionSummary(match);
  const homeTitle = match.homeTeam?.nameEn || match.homeTeamSlotLabel || 'Por definir';
  const awayTitle = match.awayTeam?.nameEn || match.awayTeamSlotLabel || 'Por definir';
  const ariaLabel = `Ir a predicciones: ${homeTitle} vs ${awayTitle}`;

  const headerParts = [`Partido ${match.externalId ?? externalId}`, phase, dateTime].filter(Boolean);

  return (
    <Link
      to={`/predictions?match=${encodeURIComponent(match.id)}`}
      className={cn(
        'group block rounded-lg border border-border/70 bg-card px-3 py-3 shadow-sm transition-colors',
        'hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
      )}
      aria-label={ariaLabel}
    >
      <div className="space-y-0.5 text-xs text-muted-foreground">
        <p className="font-medium text-foreground/90">{headerParts.join(' · ')}</p>
        {stadiumLine ? (
          <p className="truncate" title={stadiumLine}>
            {stadiumLine}
          </p>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <TileCountryLine
          team={match.homeTeam}
          slotLabel={match.homeTeamSlotLabel}
          slotSourceMatch={match.homeTeamSlotSourceMatch}
        />
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          vs
        </span>
        <TileCountryLine
          team={match.awayTeam}
          slotLabel={match.awayTeamSlotLabel}
          slotSourceMatch={match.awayTeamSlotSourceMatch}
        />
      </div>

      <p
        className={cn(
          'mt-2 text-xs',
          prediction.hasPrediction ? 'text-amber-200/90' : 'text-muted-foreground'
        )}
      >
        {prediction.text}
      </p>

      <p className="mt-1 text-[10px] text-primary/70 opacity-0 transition-opacity group-hover:opacity-100">
        Ir a Predicciones →
      </p>
    </Link>
  );
}
