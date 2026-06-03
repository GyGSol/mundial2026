import { Outlet } from 'react-router-dom';
import { useAdminFavicon } from '../../hooks/useAdminFavicon.js';

/** Aplica favicon azul de admin en todas las rutas bajo /admin. */
export default function AdminFaviconOutlet() {
  useAdminFavicon();
  return <Outlet />;
}
