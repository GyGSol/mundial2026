import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { adminAuthApi } from '../../api/adminClient.js';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';

export default function AdminRoute() {
  const { isAuthenticated, loading } = useAdminAuth();
  const [setupChecked, setSetupChecked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    adminAuthApi
      .setupStatus()
      .then((data) => setNeedsSetup(!data.configured))
      .finally(() => setSetupChecked(true));
  }, []);

  if (!setupChecked || loading) {
    return (
      <div className="admin-theme admin-mesh flex min-h-screen items-center justify-center text-slate-300">
        Cargando panel…
      </div>
    );
  }

  if (needsSetup) {
    return <Navigate to="/admin/setup" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
