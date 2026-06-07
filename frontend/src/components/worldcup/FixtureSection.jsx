import { useEffect, useRef, useState } from 'react';
import CompactGroupTable, { QualificationLegend } from '@/components/worldcup/CompactGroupTable.jsx';
import KnockoutBracket from '@/components/worldcup/KnockoutBracket.jsx';

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const BRACKET_LOGICAL_WIDTH = 860;

function BracketScaledViewport({ children }) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const updateScale = () => {
      const available = container.clientWidth;
      const nextScale = Math.min(1, available / BRACKET_LOGICAL_WIDTH);
      setScale(nextScale);
      setContentHeight(content.offsetHeight * nextScale);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    observer.observe(content);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground sm:hidden">
        Deslizá o pellizá para ampliar las llaves.
      </p>
      <div
        ref={containerRef}
        className="overflow-auto rounded-lg border border-border/60 bg-muted/10"
        style={{ height: contentHeight ? contentHeight + 16 : 'auto' }}
      >
        <div
          style={{
            width: BRACKET_LOGICAL_WIDTH * scale,
            height: contentHeight || 'auto',
          }}
        >
          <div
            ref={contentRef}
            className="mx-auto"
            style={{
              width: BRACKET_LOGICAL_WIDTH,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

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

  const bracket = (
    <div className="flex flex-col items-center gap-2">
      <KnockoutBracket phases={knockout} />
    </div>
  );

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

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Fase final
        </p>
        <div className="hidden sm:block overflow-x-auto">{bracket}</div>
        <div className="sm:hidden">
          <BracketScaledViewport>{bracket}</BracketScaledViewport>
        </div>
      </div>
    </div>
  );
}
