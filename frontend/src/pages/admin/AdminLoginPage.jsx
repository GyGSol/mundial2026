import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { adminAuthApi } from '../../api/adminClient.js';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import TechnicalDifficulties from '../../components/TechnicalDifficulties.jsx';
import { isSevereError } from '../../lib/apiError.js';
import AdminBrand from '../../components/admin/AdminBrand.jsx';
import AdminCard from '../../components/admin/AdminCard.jsx';
import { adminInput, adminLabel } from '../../components/admin/adminTheme.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';

export default function AdminLoginPage() {
  const { login, isAuthenticated, loading } = useAdminAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    adminAuthApi
      .setupStatus()
      .then((data) => setNeedsSetup(!data.configured))
      .catch((err) => setError(err.message))
      .finally(() => setSetupChecked(true));
  }, []);

  if (setupChecked && needsSetup) {
    return <Navigate to="/admin/setup" replace />;
  }

  if (!setupChecked || loading) {
    return (
      <div className="admin-theme admin-mesh flex min-h-screen items-center justify-center text-slate-300">
        Cargando…
      </div>
    );
  }

  if (!loading && isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  if (error && isSevereError(error)) {
    return (
      <TechnicalDifficulties
        error={error}
        title="No se pudo conectar con el servidor"
        onRetry={() => setError('')}
      />
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-theme admin-mesh flex min-h-screen items-center justify-center px-4">
      <AdminCard bannerVariant="auth" className="w-full max-w-md" flush>
        <div className="flex flex-col gap-4 p-6">
          <AdminBrand
            title="Admin — Mundial 2026"
            description="Acceso restringido al panel de operaciones."
          />
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="admin-user" className={adminLabel}>
                Usuario
              </label>
              <Input
                id="admin-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className={adminInput}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="admin-pass" className={adminLabel}>
                Contraseña
              </label>
              <Input
                id="admin-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={adminInput}
              />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>
      </AdminCard>
    </div>
  );
}
