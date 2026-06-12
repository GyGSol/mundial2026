import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  Globe,
  LogOut,
  MoreHorizontal,
  Pencil,
  Play,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePendingApprovals } from '../context/PendingApprovalsContext.jsx';
import { cn } from '@/lib/utils';

const primaryTabs = [
  { to: '/ranking', label: 'Ranking', icon: Trophy, end: false },
  { to: '/predictions', label: 'Predicciones', icon: ClipboardList, end: false },
  { to: '/mundial', label: 'Mundial', icon: Globe, end: false },
  { to: '/groups', label: 'Grupos', icon: Users, end: false, showBadge: true },
];

const morePaths = ['/simulation', '/rules', '/ai-predictions'];

function TabItem({ to, label, icon: Icon, end, badge }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn('game-mobile-nav__item', isActive && 'game-mobile-nav__item--active')
      }
    >
      <span className="game-mobile-nav__icon">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        {badge ? (
          <span className="game-mobile-nav__badge" aria-hidden>
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
      <span className="game-mobile-nav__label">{label}</span>
    </NavLink>
  );
}

export default function GameMobileNav({ onEditPlayer }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const { count: pendingApprovalCount } = usePendingApprovals();

  const moreActive = morePaths.some((path) => location.pathname.startsWith(path));

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  const groupsBadge = pendingApprovalCount > 0 ? pendingApprovalCount : null;

  return (
    <>
      {moreOpen ? (
        <div className="game-mobile-more" role="presentation">
          <button
            type="button"
            className="game-mobile-more__backdrop"
            aria-label="Cerrar menú"
            onClick={() => setMoreOpen(false)}
          />
          <div className="game-mobile-more__panel" role="dialog" aria-label="Más opciones">
            <div className="game-mobile-more__header">
              <p className="game-mobile-more__title">Más</p>
              <button
                type="button"
                className="game-mobile-more__close"
                aria-label="Cerrar"
                onClick={() => setMoreOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>

            {user?.name ? (
              <p className="game-mobile-more__user" title={user.email ?? user.name}>
                {user.name}
              </p>
            ) : null}

            <nav className="game-mobile-more__links">
              <NavLink
                to="/ai-predictions"
                className={({ isActive }) =>
                  cn('game-mobile-more__link', isActive && 'game-mobile-more__link--active')
                }
                onClick={() => setMoreOpen(false)}
              >
                <Sparkles className="size-5 shrink-0" strokeWidth={1.75} />
                Predicciones IA
              </NavLink>
              <NavLink
                to="/simulation"
                className={({ isActive }) =>
                  cn('game-mobile-more__link', isActive && 'game-mobile-more__link--active')
                }
                onClick={() => setMoreOpen(false)}
              >
                <Play className="size-5 shrink-0" strokeWidth={1.75} />
                Simulación
              </NavLink>
              <NavLink
                to="/rules"
                className={({ isActive }) =>
                  cn('game-mobile-more__link', isActive && 'game-mobile-more__link--active')
                }
                onClick={() => setMoreOpen(false)}
              >
                <BookOpen className="size-5 shrink-0" strokeWidth={1.75} />
                Reglas
              </NavLink>
            </nav>

            <div className="game-mobile-more__actions">
              <button
                type="button"
                className="game-mobile-more__action"
                onClick={() => {
                  setMoreOpen(false);
                  onEditPlayer?.();
                }}
              >
                <Pencil className="size-5 shrink-0" strokeWidth={1.75} />
                Editar perfil
              </button>
              <button
                type="button"
                className="game-mobile-more__action game-mobile-more__action--danger"
                onClick={() => {
                  setMoreOpen(false);
                  logout();
                }}
              >
                <LogOut className="size-5 shrink-0" strokeWidth={1.75} />
                Salir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="game-mobile-nav" aria-label="Navegación principal">
        {primaryTabs.map((tab) => (
          <TabItem
            key={tab.to}
            {...tab}
            badge={tab.showBadge ? groupsBadge : null}
          />
        ))}
        <button
          type="button"
          className={cn('game-mobile-nav__item', moreActive && 'game-mobile-nav__item--active')}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen(true)}
        >
          <span className="game-mobile-nav__icon">
            <MoreHorizontal className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="game-mobile-nav__label">Más</span>
        </button>
      </nav>
    </>
  );
}
