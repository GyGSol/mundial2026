import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';

export default function GuestRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner variant="fullscreen" label="Preparando tu sesión…" />;
  }

  if (isAuthenticated) {
    return <Navigate to="/ranking" replace />;
  }

  return <Outlet />;
}
