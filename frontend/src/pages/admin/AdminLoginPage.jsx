import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { adminAuthApi } from '../../api/adminClient.js';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import TechnicalDifficulties from '../../components/TechnicalDifficulties.jsx';
import { isSevereError } from '../../lib/apiError.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100">
        <CardHeader>
          <CardTitle>Admin — Mundial 2026</CardTitle>
          <p className="text-sm text-slate-400">Acceso restringido al panel de operaciones.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="admin-user" className="text-sm text-slate-300">
                Usuario
              </label>
              <Input
                id="admin-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="border-slate-700 bg-slate-950"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="admin-pass" className="text-sm text-slate-300">
                Contraseña
              </label>
              <Input
                id="admin-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="border-slate-700 bg-slate-950"
              />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
