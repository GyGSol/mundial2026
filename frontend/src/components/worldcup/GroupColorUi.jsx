import { cn } from '@/lib/utils';
import {
  GROUP_COLORS,
  GROUP_LETTERS,
  getGroupColor,
  parseKnockoutSlotLabel,
} from '@/lib/groupColors.js';
import TeamFlag from '@/components/TeamFlag.jsx';

function MatchSideMiniFlag({ team, slotLabel, sizeClass = 'size-5' }) {
  if (team) {
    return <TeamFlag team={team} sizeClass={sizeClass} className="shadow-none" />;
  }

  if (slotLabel) {
    const parsed = parseKnockoutSlotLabel(slotLabel);
    if (parsed?.type === 'group_position') {
      return (
        <GroupColorSwatch group={parsed.group} position={parsed.position} size="md" title={slotLabel} />
      );
    }
    if (parsed?.type === 'third_best') {
      return <GroupColorDotList groups={parsed.groups} position={3} size="xs" />;
    }
  }

  return (
    <span
      className={cn('shrink-0 rounded-sm border border-dashed border-border/60 bg-muted/30', sizeClass)}
      aria-hidden
    />
  );
}

export function MatchWinnerSlotLabel({ slotSourceMatch, label, className, compact = false }) {
  if (!slotSourceMatch) {
    return (
      <span className={cn('text-center leading-tight', className)} title={label}>
        {label}
      </span>
    );
  }

  const prefix = /^Perdedor de /i.test(label) ? 'Perdedor' : 'Ganador';
  const flagSize = compact ? 'size-4' : 'size-5';

  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-center justify-center gap-1.5 leading-tight',
        compact ? 'text-[10px]' : 'text-xs sm:text-sm',
        className
      )}
      title={label}
    >
      <span className="text-muted-foreground">{prefix} de</span>
      <MatchSideMiniFlag
        team={slotSourceMatch.homeTeam}
        slotLabel={slotSourceMatch.homeTeamSlotLabel}
        sizeClass={flagSize}
      />
      <span className="font-medium text-muted-foreground">vs</span>
      <MatchSideMiniFlag
        team={slotSourceMatch.awayTeam}
        slotLabel={slotSourceMatch.awayTeamSlotLabel}
        sizeClass={flagSize}
      />
    </span>
  );
}

export function GroupColorSwatch({ group, position = 1, size = 'sm', className, title }) {
  const color = getGroupColor(group, position);
  if (!color) return null;

  const sizeClass = size === 'xs' ? 'size-2' : size === 'md' ? 'size-3.5' : 'size-2.5';

  return (
    <span
      className={cn('inline-block shrink-0 rounded-full ring-1 ring-black/10', sizeClass, className)}
      style={{ backgroundColor: color }}
      title={title ?? `Grupo ${group}`}
      aria-hidden
    />
  );
}

export function GroupColorDotList({ groups, position = 3, size = 'xs' }) {
  if (!groups?.length) return null;

  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-0.5">
      {groups.map((group) => (
        <GroupColorSwatch
          key={group}
          group={group}
          position={position}
          size={size}
          title={`Grupo ${group}`}
        />
      ))}
    </span>
  );
}

export function KnockoutSlotLabel({ label, slotSourceMatch, className, compact = false }) {
  if (slotSourceMatch) {
    return (
      <MatchWinnerSlotLabel
        slotSourceMatch={slotSourceMatch}
        label={label}
        className={className}
        compact={compact}
      />
    );
  }

  const parsed = parseKnockoutSlotLabel(label);

  if (!parsed || parsed.type === 'unknown') {
    return (
      <span className={cn('text-center leading-tight', className)} title={label}>
        {parsed?.text ?? label}
      </span>
    );
  }

  if (parsed.type === 'group_position') {
    return (
      <span
        className={cn('inline-flex items-center justify-center gap-1.5 leading-tight', className)}
        title={label}
      >
        <GroupColorSwatch group={parsed.group} position={parsed.position} size="md" />
        <span>
          {parsed.position}.º del grupo {parsed.group}
        </span>
      </span>
    );
  }

  if (parsed.type === 'third_best') {
    return (
      <span
        className={cn('inline-flex flex-col items-center gap-0.5 leading-tight', className)}
        title={label}
      >
        <span className="inline-flex items-center gap-1">
          <span>3.º mejor</span>
          <GroupColorDotList groups={parsed.groups} position={3} />
        </span>
      </span>
    );
  }

  if (parsed.type === 'match_winner' || parsed.type === 'match_loser') {
    return (
      <span className={cn('text-center leading-tight', className)} title={label}>
        {label}
      </span>
    );
  }

  return (
    <span className={cn('text-center leading-tight', className)} title={label}>
      {label}
    </span>
  );
}

export function QualificationLegend() {
  return (
    <div className="flex flex-col gap-2 text-xs text-muted-foreground">
      <p>
        Cada grupo tiene un color. En las tablas:{' '}
        <strong className="font-medium text-foreground">1.º</strong> tono oscuro,{' '}
        <strong className="font-medium text-foreground">2.º</strong> medio,{' '}
        <strong className="font-medium text-foreground">3.º</strong> claro (posible clasificado).
        Los mismos colores aparecen en la fase final.
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {GROUP_LETTERS.map((letter) => (
          <span key={letter} className="inline-flex items-center gap-1">
            <GroupColorSwatch group={letter} position={1} size="xs" />
            <span className="font-medium text-foreground">{letter}</span>
            <span className="hidden text-[10px] sm:inline">({GROUP_COLORS[letter].label})</span>
          </span>
        ))}
      </div>
    </div>
  );
}
