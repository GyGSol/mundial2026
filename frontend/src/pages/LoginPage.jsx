import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import TechnicalDifficulties from '../components/TechnicalDifficulties.jsx';
import { isSevereError } from '../lib/apiError.js';
import { joinGroupAfterAuth } from '../lib/joinGroupAfterAuth.js';
import { buildAuthPathWithJoin } from '../lib/inviteLink.js';
import InfoPanel, { InfoList } from '../components/InfoPanel.jsx';
import { healthApi } from '../api/client.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';

function LocalDevDbHint() {
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    healthApi
      .get()
      .then((health) => {
        if (health?.databaseName === 'mundial2026_local') return;
        setHint(
          `El backend usa la base "${health?.databaseName ?? 'desconocida'}". Para login con usuarios de prod local, ejecutá npm run dev:local-qa y verificá /api/health → mundial2026_local.`
        );
      })
      .catch(() => {});
  }, []);

  if (!hint) return null;

  return (
    <p className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-left text-xs text-amber-950">
      {hint}
    </p>
  );
}

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
      const loggedInUser = await login(email, password);

      if (loggedInUser?.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }

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
    <div className="game-hero-shell">
      <div className="game-hero-shell__content mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-10">
        <p className="game-hero-brand text-center text-sm font-medium tracking-[0.18em] text-slate-200 uppercase">
          Mundial 2026
        </p>
        <p className="text-center text-sm">
          <Link to="/" className="game-hero-link underline-offset-4 hover:underline">
            Volver al inicio
          </Link>
        </p>
        <Card className="game-hero-card">
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
              <LocalDevDbHint />
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
                <Link
                  to={
                    joinGroupId ? buildAuthPathWithJoin('/forgot-password', joinGroupId) : '/forgot-password'
                  }
                  className="text-foreground underline underline-offset-4"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </p>
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
