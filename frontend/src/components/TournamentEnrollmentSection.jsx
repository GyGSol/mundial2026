import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { competitionGroupsApi } from '../api/client.js';
import {
  ENROLLABLE_TOURNAMENT_TYPES,
  getTournamentLabel,
  TOURNAMENT_TYPE_COMMON,
  TOURNAMENT_TYPE_ELIMINATION,
} from '../lib/tournamentTypes.js';
import {
  ELIMINATION_TOURNAMENT_PRIZE_FUBOLS,
  computeEliminationEntryFee,
} from '../lib/economyConstants.js';
import FubolCoinIcon from './FubolCoinIcon.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';

const TOURNAMENT_DESCRIPTIONS = {
  [TOURNAMENT_TYPE_COMMON]:
    'Ranking principal del grupo. Participás automáticamente al ser miembro.',
  challenge: 'Competencia especial con reglas propias. Próximamente.',
  [TOURNAMENT_TYPE_ELIMINATION]:
    'Por cada partido finalizado se elimina al último del ranking de ese partido. El campeón recibe 100 Fubols.',
};

const ELIMINATION_STATUS_LABELS = {
  inactive: 'Sin activar',
  open: 'Inscripciones abiertas',
  running: 'En curso',
  completed: 'Finalizado',
};

export default function TournamentEnrollmentSection({
  myGroups,
  activeGroupId,
  tournamentEnrollmentsByGroupId = {},
  onEnrolled,
  onError,
}) {
  const realGroups = useMemo(
    () => (myGroups ?? []).filter((group) => group.id !== '__nogroup' && !group.isVirtual),
    [myGroups]
  );

  const defaultGroupId = useMemo(() => {
    if (activeGroupId && realGroups.some((group) => group.id === activeGroupId)) {
      return activeGroupId;
    }
    return realGroups[0]?.id ?? '';
  }, [activeGroupId, realGroups]);

  const [selectedGroupId, setSelectedGroupId] = useState(defaultGroupId);
  const [enrollLoading, setEnrollLoading] = useState('');
  const [eliminationData, setEliminationData] = useState(null);
  const [eliminationLoading, setEliminationLoading] = useState(false);
  const [eliminationActionLoading, setEliminationActionLoading] = useState('');

  useEffect(() => {
    setSelectedGroupId((current) =>
      current && realGroups.some((group) => group.id === current) ? current : defaultGroupId
    );
  }, [defaultGroupId, realGroups]);

  const effectiveGroupId =
    selectedGroupId && realGroups.some((group) => group.id === selectedGroupId)
      ? selectedGroupId
      : defaultGroupId;

  const selectedGroup = realGroups.find((group) => group.id === effectiveGroupId);
  const memberCount = selectedGroup?.memberCount ?? eliminationData?.memberCount ?? 0;
  const fallbackEntryFee = computeEliminationEntryFee(memberCount);

  const refreshElimination = useCallback(async () => {
    if (!effectiveGroupId) return;
    setEliminationLoading(true);
    try {
      const data = await competitionGroupsApi.eliminationTournament.get(effectiveGroupId);
      setEliminationData(data);
    } catch {
      setEliminationData(null);
    } finally {
      setEliminationLoading(false);
    }
  }, [effectiveGroupId]);

  useEffect(() => {
    refreshElimination();
  }, [refreshElimination]);

  const enrolledTypes = useMemo(
    () => new Set(tournamentEnrollmentsByGroupId[effectiveGroupId] ?? []),
    [tournamentEnrollmentsByGroupId, effectiveGroupId]
  );

  const handleEnroll = async (tournamentType) => {
    if (!effectiveGroupId) return;
    setEnrollLoading(tournamentType);
    onError?.('');
    try {
      await competitionGroupsApi.tournamentEnrollments.enroll(effectiveGroupId, tournamentType);
      onEnrolled?.(effectiveGroupId, tournamentType);
      if (tournamentType === TOURNAMENT_TYPE_ELIMINATION) {
        await refreshElimination();
      }
    } catch (err) {
      onError?.(err.message || 'No se pudo completar la inscripción');
    } finally {
      setEnrollLoading('');
    }
  };

  const handleActivateElimination = async () => {
    if (!effectiveGroupId) return;
    setEliminationActionLoading('activate');
    onError?.('');
    try {
      const data = await competitionGroupsApi.eliminationTournament.activate(effectiveGroupId);
      setEliminationData(data);
      onEnrolled?.(effectiveGroupId, TOURNAMENT_TYPE_ELIMINATION);
    } catch (err) {
      onError?.(err.message || 'No se pudo activar el torneo');
    } finally {
      setEliminationActionLoading('');
    }
  };

  const handleStartElimination = async () => {
    if (!effectiveGroupId) return;
    setEliminationActionLoading('start');
    onError?.('');
    try {
      const data = await competitionGroupsApi.eliminationTournament.start(effectiveGroupId);
      setEliminationData(data);
    } catch (err) {
      onError?.(err.message || 'No se pudo iniciar el torneo');
    } finally {
      setEliminationActionLoading('');
    }
  };

  if (!realGroups.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Torneos especiales</CardTitle>
          <CardDescription>
            Sumate a un grupo para participar en el torneo común y en los formatos especiales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Todavía no participás en ningún grupo.{' '}
            <Link to="/groups" className="text-primary underline">
              Creá uno o unite a un grupo existente
            </Link>{' '}
            para inscribirte en torneos.
          </p>
        </CardContent>
      </Card>
    );
  }

  const eliminationStatus = eliminationData?.tournament?.status ?? 'inactive';
  const entryFeeFubols = eliminationData?.entryFeeFubols ?? fallbackEntryFee;
  const eliminationEnrollmentsOpen = eliminationStatus === 'open';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Torneos especiales</CardTitle>
        <CardDescription>
          Elegí el grupo y inscribite en los formatos adicionales. El torneo común ya está incluido
          con tu membresía.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {realGroups.length > 1 ? (
          <div className="flex flex-col gap-2 sm:max-w-sm">
            <label htmlFor="tournament-enrollment-group" className="text-sm font-medium">
              Grupo
            </label>
            <Select value={effectiveGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger id="tournament-enrollment-group">
                <SelectValue placeholder="Elegir grupo" />
              </SelectTrigger>
              <SelectContent>
                {realGroups.map((group) => (
                  <SelectItem key={`tournament-group-${group.id}`} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Grupo: <span className="font-medium text-foreground">{selectedGroup?.name}</span>
          </p>
        )}

        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{getTournamentLabel(TOURNAMENT_TYPE_COMMON)}</p>
                <p className="text-sm text-muted-foreground">
                  {TOURNAMENT_DESCRIPTIONS[TOURNAMENT_TYPE_COMMON]}
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Incluido
              </span>
            </div>
          </div>

          {ENROLLABLE_TOURNAMENT_TYPES.map((tournamentType) => {
            const isEnrolled = enrolledTypes.has(tournamentType);
            const isElimination = tournamentType === TOURNAMENT_TYPE_ELIMINATION;

            if (isElimination) {
              return (
                <div key={tournamentType} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{getTournamentLabel(tournamentType)}</p>
                        <p className="text-sm text-muted-foreground">
                          {TOURNAMENT_DESCRIPTIONS[tournamentType]}
                        </p>
                        <p className="mt-2 inline-flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                          Cuota: {entryFeeFubols} <FubolCoinIcon size="sm" />
                          <span className="text-xs">
                            (premio {ELIMINATION_TOURNAMENT_PRIZE_FUBOLS} ÷ {memberCount || '…'}{' '}
                            miembros)
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Estado:{' '}
                          <span className="font-medium text-foreground">
                            {eliminationLoading
                              ? '…'
                              : ELIMINATION_STATUS_LABELS[eliminationStatus]}
                          </span>
                          {eliminationStatus === 'open'
                            ? ` · ${eliminationData?.tournament?.enrolledCount ?? 0} inscriptos`
                            : null}
                        </p>
                      </div>
                      <div className="flex flex-col items-stretch gap-2 sm:items-end">
                        {isEnrolled ? (
                          <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            Inscripto
                          </span>
                        ) : eliminationEnrollmentsOpen ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={Boolean(enrollLoading) || eliminationLoading}
                            onClick={() => handleEnroll(tournamentType)}
                          >
                            {enrollLoading === tournamentType ? 'Inscribiendo…' : 'Inscribirse'}
                          </Button>
                        ) : eliminationStatus === 'inactive' ? (
                          <span className="text-xs text-muted-foreground">
                            Esperando activación del admin
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Inscripciones cerradas
                          </span>
                        )}
                      </div>
                    </div>

                    {eliminationData?.canActivate ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={Boolean(eliminationActionLoading)}
                        onClick={handleActivateElimination}
                      >
                        {eliminationActionLoading === 'activate'
                          ? 'Activando…'
                          : 'Activar Torneo Eliminación'}
                      </Button>
                    ) : null}

                    {eliminationData?.canStart ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={Boolean(eliminationActionLoading)}
                        onClick={handleStartElimination}
                      >
                        {eliminationActionLoading === 'start' ? 'Iniciando…' : 'Iniciar torneo'}
                      </Button>
                    ) : null}

                    {eliminationStatus === 'running' || eliminationStatus === 'completed' ? (
                      <Button asChild size="sm" variant="link" className="h-auto justify-start p-0">
                        <Link to={`/ranking?torneo=elimination&grupo=${effectiveGroupId}`}>
                          Ver tabla del torneo
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            }

            return (
              <div key={tournamentType} className="rounded-lg border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{getTournamentLabel(tournamentType)}</p>
                    <p className="text-sm text-muted-foreground">
                      {TOURNAMENT_DESCRIPTIONS[tournamentType]}
                    </p>
                  </div>
                  {isEnrolled ? (
                    <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      Inscripto
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(enrollLoading)}
                      onClick={() => handleEnroll(tournamentType)}
                    >
                      {enrollLoading === tournamentType ? 'Inscribiendo…' : 'Inscribirse'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
