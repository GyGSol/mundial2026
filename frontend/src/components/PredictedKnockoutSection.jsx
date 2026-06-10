import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import KnockoutBracket from '@/components/worldcup/KnockoutBracket.jsx';

function formatProgress(progress) {
  if (!progress) return null;
  const parts = [
    progress.roundOf32
      ? `${progress.roundOf32.resolved}/${progress.roundOf32.total * 2} dieciseisavos`
      : null,
    progress.roundOf16
      ? `${progress.roundOf16.resolved}/${progress.roundOf16.total * 2} octavos`
      : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export default function PredictedKnockoutSection({ knockout }) {
  const phases = knockout?.phases ?? [];
  const progressLabel = formatProgress(knockout?.progress);

  if (!phases.length) {
    return (
      <p className="text-sm text-muted-foreground">
        La fase final todavía no tiene partidos publicados para simular.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-2 p-4 text-sm text-foreground">
          <p>Dieciseisavos según tus tablas de grupo (resultados reales + predicciones guardadas).</p>
          <p>Octavos en adelante según predicciones en partidos eliminatorios (pestaña Partidos).</p>
          <p className="text-muted-foreground">
            Si predichés empate en un eliminatorio, no se asigna ganador para la ronda siguiente.
          </p>
          {knockout?.thirdPlaceCombinationKey ? (
            <p className="text-muted-foreground">
              Combinación de 3.º puestos: {knockout.thirdPlaceCombinationKey}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {progressLabel ? (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            Cruces resueltos: {progressLabel}
          </Badge>
        </div>
      ) : null}

      <div className="rounded-lg border border-border/60 bg-muted/5 p-3 sm:p-4">
        <KnockoutBracket phases={phases} />
      </div>
    </div>
  );
}
