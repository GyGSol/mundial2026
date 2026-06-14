import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { authApi } from '../api/client.js';
import TechnicalDifficulties from '../components/TechnicalDifficulties.jsx';
import { isSevereError } from '../lib/apiError.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function ChangePasswordPage() {
  const { user, mustChangePassword, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resending, setResending] = useState(false);

  if (error && isSevereError(error)) {
    return (
      <TechnicalDifficulties
        error={error}
        title="No se pudo conectar con el servidor"
        onRetry={() => setError('')}
      />
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/ranking', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendTemporaryPassword = async () => {
    if (!user?.email) return;
    setResendMessage('');
    setError('');
    setResending(true);
    try {
      const data = await authApi.forgotPassword(user.email);
      setResendMessage(
        data.message ||
          'Te enviamos una clave provisoria nueva. Revisá tu bandeja (y spam) e ingresala arriba.'
      );
      setCurrentPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="game-hero-shell">
      <div className="game-hero-shell__content mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-10">
        <p className="game-hero-brand text-center text-sm font-medium tracking-[0.18em] text-slate-200 uppercase">
          Mundial 2026
        </p>
        <Card className="game-hero-card">
          <CardHeader>
            <CardTitle>
              {mustChangePassword ? 'Definí tu contraseña nueva' : 'Cambiar contraseña'}
            </CardTitle>
            <CardDescription>
              {mustChangePassword
                ? 'Ingresaste con una clave provisoria. Elegí una contraseña personal antes de continuar.'
                : 'Actualizá tu contraseña de acceso.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {user?.email ? (
                <p className="text-sm text-muted-foreground">
                  Cuenta: <span className="text-foreground">{user.email}</span>
                </p>
              ) : null}
              <Input
                type="password"
                placeholder={mustChangePassword ? 'Clave provisoria' : 'Contraseña actual'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <Input
                type="password"
                placeholder="Nueva contraseña"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <Input
                type="password"
                placeholder="Confirmar nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando…' : 'Guardar contraseña'}
              </Button>
              {mustChangePassword ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => logout().then(() => navigate('/login', { replace: true }))}
                >
                  Cerrar sesión
                </Button>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  <Link to="/ranking" className="text-foreground underline underline-offset-4">
                    Volver al ranking
                  </Link>
                </p>
              )}
            </form>
          </CardContent>
        </Card>
        {mustChangePassword ? (
          <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            {resendMessage ? <p>{resendMessage}</p> : null}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-foreground"
              onClick={handleResendTemporaryPassword}
              disabled={resending}
            >
              {resending ? 'Enviando…' : '¿No recibiste la clave? Pedila de nuevo'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
