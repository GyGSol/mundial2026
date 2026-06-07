import { cn } from '@/lib/utils';
import { getTeamFlag } from '@/lib/teamMeta';

function TeamCell({ team, fallback = '—' }) {
  const name = team?.nameEn || fallback;
  const flagUrl = getTeamFlag(team);

  return (
    <div className="flex items-center gap-2">
      {flagUrl ? (
        <img src={flagUrl} alt="" className="size-5 rounded-sm border border-border/60 object-cover" />
      ) : team?.flag ? (
        <span>{team.flag}</span>
      ) : null}
      <span className="font-medium">{name}</span>
      {team?.fifaCode && <span className="text-xs text-muted-foreground">{team.fifaCode}</span>}
    </div>
  );
}

export function getMatchSideShortLabel(team, slotLabel) {
  if (team?.fifaCode) return team.fifaCode;
  if (team?.nameEn) return team.nameEn.slice(0, 3).toUpperCase();
  if (slotLabel) return slotLabel.length > 18 ? `${slotLabel.slice(0, 16)}…` : slotLabel;
  return 'TBD';
}

export default function MatchTeamSide({ team, slotLabel, align = 'left', compact = false }) {
  if (team) {
    if (compact) {
      const flagUrl = getTeamFlag(team);
      const label = team.fifaCode || team.nameEn?.slice(0, 3).toUpperCase() || '—';
      return (
        <span
          className={cn('inline-flex items-center gap-1 text-[10px] font-medium', align === 'right' && 'justify-end')}
          title={team.nameEn}
        >
          {flagUrl ? (
            <img src={flagUrl} alt="" className="size-3 rounded-sm border border-border/60 object-cover" />
          ) : team.flag ? (
            <span className="text-[9px]">{team.flag}</span>
          ) : null}
          {label}
        </span>
      );
    }

    return align === 'right' ? (
      <div className="flex items-center justify-end gap-2">
        {team.fifaCode && <span className="text-xs text-muted-foreground">{team.fifaCode}</span>}
        <span className="font-medium">{team.nameEn}</span>
        {getTeamFlag(team) ? (
          <img
            src={getTeamFlag(team)}
            alt=""
            className="size-5 rounded-sm border border-border/60 object-cover"
          />
        ) : team.flag ? (
          <span>{team.flag}</span>
        ) : null}
      </div>
    ) : (
      <TeamCell team={team} />
    );
  }

  if (slotLabel) {
    return (
      <span
        className={cn(
          compact ? 'text-[10px] font-medium text-muted-foreground' : 'text-sm font-medium text-muted-foreground',
          align === 'right' && 'sm:text-right'
        )}
        title={slotLabel}
      >
        {compact && slotLabel.length > 20 ? `${slotLabel.slice(0, 18)}…` : slotLabel}
      </span>
    );
  }

  return <span className="text-[10px] text-muted-foreground">TBD</span>;
}
