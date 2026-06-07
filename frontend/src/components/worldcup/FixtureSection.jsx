import CompactGroupTable, { QualificationLegend } from '@/components/worldcup/CompactGroupTable.jsx';
import KnockoutBracket from '@/components/worldcup/KnockoutBracket.jsx';

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

function groupMap(groups = []) {
  return Object.fromEntries(groups.map((g) => [String(g.group).toUpperCase(), g]));
}

export default function FixtureSection({ groups, knockout }) {
  if (!groups?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay datos de grupos sincronizados.
      </p>
    );
  }

  const byGroup = groupMap(groups);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <QualificationLegend />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {GROUP_LETTERS.map((letter) =>
            byGroup[letter] ? <CompactGroupTable key={letter} group={byGroup[letter]} /> : null
          )}
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Fase final
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            A medida que se jueguen los partidos, verás aquí banderas, resultados y el camino del torneo.
          </p>
        </div>
        <div className="w-full overflow-x-auto rounded-lg border border-border/60 bg-muted/5 p-3 sm:p-4">
          <KnockoutBracket phases={knockout} />
        </div>
      </div>
    </div>
  );
}
