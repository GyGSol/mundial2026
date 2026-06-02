import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function GuestRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/ranking" replace />;
  }

  return <Outlet />;
}
