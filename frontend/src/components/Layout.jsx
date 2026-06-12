import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { usePendingApprovals } from '../context/PendingApprovalsContext.jsx';
import EditPlayerDialog from './EditPlayerDialog.jsx';
import GameMobileNav from './GameMobileNav.jsx';
export default function Layout() {
  const { refresh: refreshPendingApprovals } = usePendingApprovals();
  const location = useLocation();
  const [editPlayerOpen, setEditPlayerOpen] = useState(false);

  useEffect(() => {
    refreshPendingApprovals();
  }, [location.pathname, refreshPendingApprovals]);

  return (
    <div className="game-shell game-mesh min-h-screen bg-background">
      <header className="game-header sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
          <Link to="/ranking" className="game-brand shrink-0 text-lg font-semibold tracking-tight">
            Mundial 2026
          </Link>
          <EditPlayerDialog open={editPlayerOpen} onOpenChange={setEditPlayerOpen} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-5 pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <GameMobileNav onEditPlayer={() => setEditPlayerOpen(true)} />
    </div>
  );
}
