import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import TechnicalDifficulties from '../components/TechnicalDifficulties.jsx';
import { isSevereError } from '../lib/apiError.js';
import { joinGroupAfterAuth } from '../lib/joinGroupAfterAuth.js';
import { buildAuthPathWithJoin } from '../lib/inviteLink.js';
import InfoPanel, { InfoList } from '../components/InfoPanel.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function LoginPage() {
  const { login, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const joinGroupId = searchParams.get('joinGroup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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
    try {
      await login(email, password);

      if (joinGroupId) {
        const group = await joinGroupAfterAuth(joinGroupId);
        await refreshUser();
        navigate('/groups', {
          replace: true,
          state: {
            successMessage: group
              ? `Ingresaste y te uniste a ${group.name}.`
              : 'Ingresaste y te uniste al grupo de la invitación.',
          },
        });
        return;
      }

      const from = location.state?.from?.pathname;
      const destination =
        from && !['/login', '/register', '/'].includes(from) ? from : '/ranking';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="game-login-shell">
      <div className="game-login-shell__content mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-10">
        <p className="game-login-brand text-center text-sm font-medium tracking-[0.18em] text-slate-200 uppercase">
          Mundial 2026
        </p>
        <p className="text-center text-sm">
          <Link to="/" className="game-login-back underline-offset-4 hover:underline">
            Volver al inicio
          </Link>
        </p>
        <Card className="game-login-card">
          <CardHeader>
            <CardTitle>Ingresar</CardTitle>
            <CardDescription>
              {joinGroupId
                ? 'Ingresá para unirte al grupo de la invitación. La sesión dura 2 horas.'
                : 'Solo jugadores registrados. Tu sesión permanece activa 2 horas después de ingresar.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit">{joinGroupId ? 'Ingresar y unirme' : 'Ingresar'}</Button>
              <p className="text-sm text-muted-foreground">
                ¿No tenés cuenta?{' '}
                <Link
                  to={joinGroupId ? buildAuthPathWithJoin('/register', joinGroupId) : '/register'}
                  className="text-foreground underline underline-offset-4"
                >
                  Registrate
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        {joinGroupId ? (
          <InfoPanel title="Invitación pendiente">
            <InfoList
              items={[
                'Después de ingresar quedás en el grupo del enlace.',
                'Si ya participabas, no pasa nada: seguís en el grupo.',
              ]}
            />
          </InfoPanel>
        ) : null}
      </div>
    </div>
  );
}
