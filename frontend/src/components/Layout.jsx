import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePendingApprovals } from '../context/PendingApprovalsContext.jsx';
import EditPlayerDialog from './EditPlayerDialog.jsx';
import { Button } from '@/components/ui/button.jsx';

const navClass = ({ isActive }) =>
  isActive
    ? 'text-foreground font-medium'
    : 'text-muted-foreground hover:text-foreground';

export default function Layout() {
  const { user, logout, sessionExpiresLabel } = useAuth();
  const { count: pendingApprovalCount, refresh: refreshPendingApprovals } = usePendingApprovals();
  const location = useLocation();
  const [editPlayerOpen, setEditPlayerOpen] = useState(false);

  useEffect(() => {
    refreshPendingApprovals();
  }, [location.pathname, refreshPendingApprovals]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link to="/ranking" className="text-lg font-semibold tracking-tight">
            Mundial 2026
          </Link>

          <nav className="flex flex-wrap items-center gap-4 text-sm">
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

          <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
            <span className="text-muted-foreground">
              {user.name}
              {sessionExpiresLabel ? (
                <span className="hidden sm:inline"> · sesión hasta {sessionExpiresLabel}</span>
              ) : null}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditPlayerOpen(true)}
            >
              Editar jugador
            </Button>
            <EditPlayerDialog open={editPlayerOpen} onOpenChange={setEditPlayerOpen} />
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
