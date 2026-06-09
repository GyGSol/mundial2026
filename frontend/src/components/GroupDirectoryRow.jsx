import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { competitionGroupsApi } from '../api/client.js';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

export default function GroupDirectoryRow({
  group,
  isAuthenticated,
  isMember,
  joinRequestPending,
  isNoGroupParticipant,
  joinLoading,
  leaveLoading,
  onRequestJoin,
  onLeave,
}) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');

  const isVirtual = Boolean(group.isVirtual);
  const participates = isVirtual ? isNoGroupParticipant : isMember;

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (!next || members !== null || membersLoading) return;

    setMembersLoading(true);
    setMembersError('');
    try {
      const data = await competitionGroupsApi.members(group.id);
      setMembers(data.members ?? []);
    } catch (err) {
      setMembersError(err.message);
    } finally {
      setMembersLoading(false);
    }
  }

  function handleActionClick(event) {
    event.stopPropagation();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleExpanded();
          }
        }}
        className="flex cursor-pointer flex-col gap-3 p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <ChevronDown
            className={cn(
              'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
              expanded && 'rotate-180'
            )}
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{group.name}</p>
            <p className="text-sm text-muted-foreground">
              {group.memberCount} jugador{group.memberCount === 1 ? '' : 'es'}
              {isVirtual ? ' · ranking sin liga' : ''}
            </p>
            {group.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{group.description}</p>
            )}
          </div>
        </div>

        <div
          className="flex w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end"
          onClick={handleActionClick}
        >
          {!isAuthenticated ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/login">Ingresar</Link>
            </Button>
          ) : isVirtual ? (
            participates ? (
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                Estás aquí
              </span>
            ) : (
              <span className="max-w-[140px] text-right text-xs text-muted-foreground">
                Salí de tus grupos para aparecer acá
              </span>
            )
          ) : participates ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">Participás</span>
              <Button
                size="sm"
                variant="outline"
                disabled={leaveLoading}
                onClick={() => onLeave(group.id)}
              >
                {leaveLoading ? 'Saliendo...' : 'Salir'}
              </Button>
            </>
          ) : joinRequestPending ? (
            <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
              Pendiente de aprobación
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={joinLoading}
              onClick={() => onRequestJoin(group.id)}
            >
              {joinLoading ? 'Enviando...' : 'Solicitar unirme'}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/70 bg-muted/15 px-3 py-3 pl-9">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Jugadores</p>
          {membersLoading && (
            <p className="text-sm text-muted-foreground">Cargando jugadores...</p>
          )}
          {membersError && <p className="text-sm text-destructive">{membersError}</p>}
          {!membersLoading && !membersError && members?.length === 0 && (
            <p className="text-sm text-muted-foreground">Ningún jugador en este grupo.</p>
          )}
          {!membersLoading && !membersError && members?.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-center sm:gap-2"
                >
                  <span className="font-medium">{member.name}</span>
                  <span className="text-muted-foreground">{member.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
