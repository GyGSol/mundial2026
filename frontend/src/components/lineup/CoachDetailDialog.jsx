import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { PopupStadiumIcon } from '@/components/icons/popup/index.js';
import PlayerAvatar from '@/components/PlayerAvatar.jsx';
import { teamsApi } from '@/api/client.js';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { getTeamFlag } from '@/lib/teamMeta.js';
import { cn } from '@/lib/utils';

export default function CoachDetailDialog({ coach, open, onOpenChange }) {
  const dialogRef = useRef(null);
  const [wiki, setWiki] = useState(null);
  const [loadingWiki, setLoadingWiki] = useState(false);
  const [wikiError, setWikiError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || !coach?.name) return;

    setWiki(null);
    setWikiError('');
    setLoadingWiki(true);

    teamsApi
      .coachWiki({
        name: coach.name,
        fifaCode: coach.teamFifaCode,
        teamName: coach.teamName,
      })
      .then((data) => setWiki(data.wiki))
      .catch((err) => setWikiError(err.message))
      .finally(() => setLoadingWiki(false));
  }, [open, coach?.name, coach?.teamFifaCode, coach?.teamName]);

  const handleClose = () => onOpenChange(false);
  const flag = coach?.teamFifaCode ? getTeamFlag({ fifaCode: coach.teamFifaCode }) : null;
  const nationality = wiki?.nationality || coach?.nationality || null;
  const summary = wiki?.summary || null;
  const teamSection = wiki?.teamSection || null;

  return (
    <dialog
      ref={dialogRef}
      className="max-h-[90vh] w-[min(100%,32rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/40"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="coach-detail-title"
    >
      {coach?.name ? (
        <Card className="border-0 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-2.5">
              <PopupStadiumIcon className="mt-0.5" title="Ficha del técnico" />
              <div className="flex min-w-0 flex-col gap-2">
                <CardTitle id="coach-detail-title" className="text-xl">
                  {coach.name}
                </CardTitle>
                <CardDescription>
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {flag ? (
                      <img src={flag} alt="" className="size-5 rounded-sm object-cover" />
                    ) : null}
                    {coach.teamName ? <span>{coach.teamName}</span> : null}
                    <Badge variant="outline">Director técnico</Badge>
                  </span>
                </CardDescription>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>
              Cerrar
            </Button>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="flex justify-center">
              <PlayerAvatar
                name={coach.name}
                photoUrl={coach.photoUrl}
                size="hero"
                variant="portrait"
                className={cn(
                  'rounded-2xl border border-border bg-white shadow-sm',
                  coach.teamSide === 'home' ? 'ring-2 ring-sky-400/60' : 'ring-2 ring-rose-400/60'
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {nationality ? (
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Nacionalidad</p>
                  <p className="font-medium">{nationality}</p>
                </div>
              ) : null}
              {coach.formation ? (
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Formación</p>
                  <p className="font-medium">{coach.formation}</p>
                </div>
              ) : null}
              {coach.teamName ? (
                <div
                  className={cn(
                    'rounded-md border border-border px-3 py-2',
                    !nationality && !coach.formation ? 'col-span-2' : ''
                  )}
                >
                  <p className="text-xs text-muted-foreground">Selección</p>
                  <p className="font-medium">{coach.teamName}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-md border border-border px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Wikipedia</p>
                {wiki?.wikiUrl ? (
                  <a
                    href={wiki.wikiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Ver artículo
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </div>

              {loadingWiki ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : wikiError ? (
                <p className="text-sm text-muted-foreground">{wikiError}</p>
              ) : (
                <>
                  {summary ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
                  ) : null}

                  {wiki?.highlights?.length ? (
                    <ul className="mt-3 space-y-1 text-sm text-foreground">
                      {wiki.highlights.map((item) => (
                        <li key={item} className="leading-snug">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {teamSection ? (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        En {coach.teamName}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {teamSection}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </dialog>
  );
}
