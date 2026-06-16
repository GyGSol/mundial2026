import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import EditPlayerDialog from './EditPlayerDialog.jsx';
import GameMobileNav from './GameMobileNav.jsx';
import MundialBrandLogo from './MundialBrandLogo.jsx';
import FubolBalanceChip from './FubolBalanceChip.jsx';
export default function Layout() {
  const [editPlayerOpen, setEditPlayerOpen] = useState(false);

  return (
    <div className="game-shell game-mesh min-h-screen bg-background">
      <header className="game-header sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="game-shell__frame flex items-center py-3">
          <Link
            to="/ranking"
            className="game-brand shrink-0 rounded-sm outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Mundial 2026 — inicio"
          >
            <MundialBrandLogo />
          </Link>
          <FubolBalanceChip />
          <EditPlayerDialog open={editPlayerOpen} onOpenChange={setEditPlayerOpen} />
        </div>
      </header>

      <main className="game-shell__frame py-5 pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <GameMobileNav onEditPlayer={() => setEditPlayerOpen(true)} />
    </div>
  );
}
