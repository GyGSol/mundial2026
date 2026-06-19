import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLiveMatchDetail } from '@/hooks/useLiveMatchDetail.js';

const LiveMatchShell = lazy(() => import('@/components/live/LiveMatchShell.jsx'));

const LiveMatchViewerContext = createContext(null);

export { LiveMatchViewerContext };

function GlobalLiveMatchShell() {
  const {
    open,
    activeMatchId,
    seedMatch,
    liveMatches,
    closeLiveMatch,
    switchLiveMatch,
  } = useLiveMatchViewer();

  const match = useLiveMatchDetail(activeMatchId, seedMatch, open);

  if (!open || !activeMatchId) return null;

  return (
    <Suspense fallback={null}>
      <LiveMatchShell
        match={match}
        open={open}
        liveMatches={liveMatches}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeLiveMatch();
        }}
        onSwitchMatch={switchLiveMatch}
      />
    </Suspense>
  );
}

export function LiveMatchViewerProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [seedMatch, setSeedMatch] = useState(null);
  const [liveMatches, setLiveMatches] = useState([]);

  const openLiveMatch = useCallback((match) => {
    if (!match?.id) return;
    setActiveMatchId(match.id);
    setSeedMatch(match);
    setOpen(true);
  }, []);

  const switchLiveMatch = useCallback(
    (matchId) => {
      if (!matchId) return;
      const found = liveMatches.find((m) => m.id === matchId);
      setActiveMatchId(matchId);
      if (found) setSeedMatch(found);
    },
    [liveMatches]
  );

  const closeLiveMatch = useCallback(() => {
    setOpen(false);
  }, []);

  const syncLiveMatches = useCallback((matches) => {
    setLiveMatches(Array.isArray(matches) ? matches : []);
  }, []);

  const value = useMemo(
    () => ({
      open,
      activeMatchId,
      seedMatch,
      liveMatches,
      openLiveMatch,
      switchLiveMatch,
      closeLiveMatch,
      syncLiveMatches,
    }),
    [
      open,
      activeMatchId,
      seedMatch,
      liveMatches,
      openLiveMatch,
      switchLiveMatch,
      closeLiveMatch,
      syncLiveMatches,
    ]
  );

  return (
    <LiveMatchViewerContext.Provider value={value}>
      {children}
      <GlobalLiveMatchShell />
    </LiveMatchViewerContext.Provider>
  );
}

export function useLiveMatchViewer() {
  const ctx = useContext(LiveMatchViewerContext);
  if (!ctx) {
    throw new Error('useLiveMatchViewer debe usarse dentro de LiveMatchViewerProvider');
  }
  return ctx;
}

/** Sincroniza la lista de partidos activos para el selector del modal. */
export function LiveMatchViewerSync({ matches = [] }) {
  const { syncLiveMatches } = useLiveMatchViewer();

  useEffect(() => {
    syncLiveMatches(matches);
  }, [matches, syncLiveMatches]);

  return null;
}
