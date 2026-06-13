import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import AdminBrand from './AdminBrand.jsx';
import { adminBtnOutline, adminNavLink, adminNavLinkActive } from './adminTheme.js';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/admin', label: 'Resumen', end: true },
  { to: '/admin/sync', label: 'Sync' },
  { to: '/admin/matches', label: 'Partidos' },
  { to: '/admin/stream-links', label: 'La18HD' },
  { to: '/admin/users', label: 'Usuarios' },
  { to: '/admin/groups', label: 'Grupos' },
  { to: '/admin/predictions', label: 'Predicciones' },
  { to: '/admin/simulation', label: 'Simulación' },
];

export default function AdminLayout() {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="admin-theme admin-mesh min-h-screen text-slate-100">
      <header className="admin-header">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <AdminBrand />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className={adminBtnOutline} asChild>
              <a href="/">Ver app</a>
            </Button>
            <Button variant="outline" size="sm" className={adminBtnOutline} onClick={handleLogout}>
              Salir
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(isActive ? adminNavLinkActive : adminNavLink)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
