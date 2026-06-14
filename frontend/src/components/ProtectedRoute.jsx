import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';

export default function ProtectedRoute() {
  const { isAuthenticated, mustChangePassword, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner variant="fullscreen" label="Preparando tu sesión…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
