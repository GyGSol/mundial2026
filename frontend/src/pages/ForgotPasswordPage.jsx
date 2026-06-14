import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client.js';
import TechnicalDifficulties from '../components/TechnicalDifficulties.jsx';
import { isSevereError } from '../lib/apiError.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    setSuccessMessage('');
    setSubmitting(true);
    try {
      const data = await authApi.forgotPassword(email.trim());
      setSuccessMessage(
        data.message ||
          'Si el email está registrado, te enviamos una clave provisoria. Revisá tu bandeja (y spam).'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="game-hero-shell">
      <div className="game-hero-shell__content mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-10">
        <p className="game-hero-brand text-center text-sm font-medium tracking-[0.18em] text-slate-200 uppercase">
          Mundial 2026
        </p>
        <p className="text-center text-sm">
          <Link to="/login" className="game-hero-link underline-offset-4 hover:underline">
            Volver a ingresar
          </Link>
        </p>
        <Card className="game-hero-card">
          <CardHeader>
            <CardTitle>Recuperar contraseña</CardTitle>
            <CardDescription>
              Ingresá tu email y te enviamos una clave provisoria para volver a entrar y elegir una
              contraseña nueva.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {successMessage ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">{successMessage}</p>
                <Button asChild>
                  <Link to="/login">Ir a ingresar</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Enviando…' : 'Enviar clave provisoria'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
