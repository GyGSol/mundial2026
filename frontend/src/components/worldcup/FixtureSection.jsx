import { useEffect, useRef, useState } from 'react';
import CompactGroupTable, { QualificationLegend } from '@/components/worldcup/CompactGroupTable.jsx';
import KnockoutBracket from '@/components/worldcup/KnockoutBracket.jsx';

const GROUP_LETTERS_LEFT = ['A', 'B', 'C', 'D', 'E', 'F'];
const GROUP_LETTERS_RIGHT = ['G', 'H', 'I', 'J', 'K', 'L'];
const FIXTURE_LOGICAL_WIDTH = 1180;

function FixtureScaledViewport({ children }) {
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
      const nextScale = Math.min(1, available / FIXTURE_LOGICAL_WIDTH);
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
      <p className="text-xs text-muted-foreground lg:hidden">
        Deslizá o pellizá para ampliar el fixture completo.
      </p>
      <div
        ref={containerRef}
        className="overflow-auto rounded-lg border border-border/60 bg-muted/10"
        style={{ height: contentHeight ? contentHeight + 16 : 'auto' }}
      >
        <div
          style={{
            width: FIXTURE_LOGICAL_WIDTH * scale,
            height: contentHeight || 'auto',
          }}
        >
          <div
            ref={contentRef}
            style={{
              width: FIXTURE_LOGICAL_WIDTH,
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

  const fixtureGrid = (
    <div className="flex flex-col gap-3">
      <QualificationLegend />
      <div
        className="grid items-start gap-3"
        style={{
          gridTemplateColumns: 'minmax(160px, 1fr) minmax(560px, auto) minmax(160px, 1fr)',
        }}
      >
        <div className="flex flex-col gap-2">
          {GROUP_LETTERS_LEFT.map((letter) =>
            byGroup[letter] ? <CompactGroupTable key={letter} group={byGroup[letter]} /> : null
          )}
        </div>

        <div className="flex min-w-0 flex-col items-center gap-2 px-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fase final
          </p>
          <KnockoutBracket phases={knockout} />
        </div>

        <div className="flex flex-col gap-2">
          {GROUP_LETTERS_RIGHT.map((letter) =>
            byGroup[letter] ? <CompactGroupTable key={letter} group={byGroup[letter]} /> : null
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:block">{fixtureGrid}</div>
      <div className="lg:hidden">
        <FixtureScaledViewport>{fixtureGrid}</FixtureScaledViewport>
      </div>
    </>
  );
}
