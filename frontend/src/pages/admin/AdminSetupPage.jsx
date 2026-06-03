import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { adminAuthApi } from '../../api/adminClient.js';
import TechnicalDifficulties from '../../components/TechnicalDifficulties.jsx';
import { isSevereError } from '../../lib/apiError.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import AdminBrand from '../../components/admin/AdminBrand.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';

export default function AdminSetupPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [alreadyConfigured, setAlreadyConfigured] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    adminAuthApi
      .setupStatus()
      .then((data) => {
        if (data.configured) {
          setAlreadyConfigured(true);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Verificando configuración…
      </div>
    );
  }

  if (alreadyConfigured) {
    return <Navigate to="/admin/login" replace />;
  }

  if (error && isSevereError(error)) {
    return (
      <TechnicalDifficulties
        error={error}
        title="No se pudo conectar con el servidor"
        onRetry={() => {
          setError('');
          setChecking(true);
          adminAuthApi
            .setupStatus()
            .then((data) => setAlreadyConfigured(Boolean(data.configured)))
            .catch((err) => setError(err.message))
            .finally(() => setChecking(false));
        }}
      />
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await adminAuthApi.setup(username.trim(), password, confirmPassword);
      localStorage.setItem('admin_token', data.token);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo crear el administrador');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-theme flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100">
        <CardHeader>
          <AdminBrand
            title="Primer ingreso — Administrador"
            description="Creá el usuario y la contraseña del panel. Solo se puede hacer una vez."
          />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="setup-user" className="text-sm text-slate-300">
                Usuario
              </label>
              <Input
                id="setup-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                minLength={3}
                className="border-slate-700 bg-slate-950"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="setup-pass" className="text-sm text-slate-300">
                Contraseña
              </label>
              <Input
                id="setup-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="border-slate-700 bg-slate-950"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="setup-pass2" className="text-sm text-slate-300">
                Repetir contraseña
              </label>
              <Input
                id="setup-pass2"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="border-slate-700 bg-slate-950"
              />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Crear administrador e ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
