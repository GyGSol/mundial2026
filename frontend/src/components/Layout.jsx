import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePendingApprovals } from '../context/PendingApprovalsContext.jsx';
import EditPlayerDialog from './EditPlayerDialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

const navClass = ({ isActive }) =>
  cn(
    'game-nav-link shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 transition-colors',
    isActive
      ? 'game-nav-link--active bg-muted font-medium text-foreground max-md:bg-transparent'
      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
  );

export default function Layout() {
  const { user, logout, sessionExpiresLabel } = useAuth();
  const { count: pendingApprovalCount, refresh: refreshPendingApprovals } = usePendingApprovals();
  const location = useLocation();
  const [editPlayerOpen, setEditPlayerOpen] = useState(false);

  useEffect(() => {
    refreshPendingApprovals();
  }, [location.pathname, refreshPendingApprovals]);

  return (
    <div className="game-shell game-mesh min-h-screen bg-background">
      <header className="game-header sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link to="/ranking" className="game-brand shrink-0 text-lg font-semibold tracking-tight">
              Mundial 2026
            </Link>

            <div className="flex min-w-0 items-center gap-2">
              <span
                className="hidden max-w-[10rem] truncate text-sm text-muted-foreground sm:inline md:max-w-xs"
                title={user.name}
              >
                {user.name}
                {sessionExpiresLabel ? (
                  <span className="hidden lg:inline"> · sesión hasta {sessionExpiresLabel}</span>
                ) : null}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="game-btn-outline shrink-0"
                onClick={() => setEditPlayerOpen(true)}
              >
                Editar
              </Button>
              <EditPlayerDialog open={editPlayerOpen} onOpenChange={setEditPlayerOpen} />
              <Button
                variant="outline"
                size="sm"
                className="game-btn-outline shrink-0"
                onClick={() => logout()}
              >
                Salir
              </Button>
            </div>
          </div>

          <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-0.5 text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <NavLink to="/ranking" className={navClass}>
              Ranking
            </NavLink>
            <NavLink to="/predictions" className={navClass}>
              Predicciones
            </NavLink>
            <NavLink to="/mundial" className={navClass}>
              Mundial
            </NavLink>
            <NavLink to="/simulation" className={navClass}>
              Simulación
            </NavLink>
            <NavLink to="/groups" className={navClass}>
              <span className="inline-flex items-center gap-1.5">
                Grupos
                {pendingApprovalCount > 0 ? (
                  <span
                    className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-sm"
                    title={`${pendingApprovalCount} solicitud${pendingApprovalCount === 1 ? '' : 'es'} pendiente${pendingApprovalCount === 1 ? '' : 's'} de aceptar`}
                  >
                    {pendingApprovalCount > 9 ? '9+' : pendingApprovalCount}
                  </span>
                ) : null}
              </span>
            </NavLink>
            <NavLink to="/rules" className={navClass}>
              Reglas
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
