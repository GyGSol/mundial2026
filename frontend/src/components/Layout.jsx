import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import EditPlayerDialog from './EditPlayerDialog.jsx';
import { Button } from '@/components/ui/button.jsx';

const navClass = ({ isActive }) =>
  isActive
    ? 'text-foreground font-medium'
    : 'text-muted-foreground hover:text-foreground';

export default function Layout() {
  const { user, logout, sessionExpiresLabel } = useAuth();
  const [editPlayerOpen, setEditPlayerOpen] = useState(false);

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
              Grupos
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
