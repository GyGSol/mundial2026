import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { competitionGroupsApi } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { buildAuthPathWithJoin } from '../lib/inviteLink.js';
import InfoPanel, { InfoList } from '../components/InfoPanel.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function InviteJoinPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, refreshUser } = useAuth();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    competitionGroupsApi
      .invitePreview(groupId)
      .then((data) => setPreview(data.group))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    if (authLoading || loading || !isAuthenticated || !preview || joining) return;

    let cancelled = false;
    setJoining(true);
    competitionGroupsApi
      .join(groupId)
      .then(async () => {
        await refreshUser();
        if (!cancelled) {
          navigate('/groups', {
            replace: true,
            state: {
              successMessage: `Te uniste a ${preview.name} mediante el enlace de invitación.`,
            },
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setJoining(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, loading, isAuthenticated, preview, groupId, joining, navigate, refreshUser]);

  if (loading || authLoading) {
    return <p className="text-sm text-muted-foreground">Cargando invitación...</p>;
  }

  if (error && !preview) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Invitación no válida</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/">Volver al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4 py-10">
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/" className="text-foreground underline">
          Volver al inicio
        </Link>
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Te invitaron a un grupo</CardTitle>
          <CardDescription>
            Unite a <strong className="text-foreground">{preview?.name}</strong> para competir en
            ese ranking del Mundial 2026.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {preview?.description ? (
            <p className="text-sm text-muted-foreground">{preview.description}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {preview?.memberCount ?? 0} jugador
            {preview?.memberCount === 1 ? '' : 'es'} en el grupo.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {joining || isAuthenticated ? (
            <p className="text-sm text-muted-foreground">Uniéndote al grupo...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to={buildAuthPathWithJoin('/register', groupId)}>Crear cuenta y unirme</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={buildAuthPathWithJoin('/login', groupId)}>Ya tengo cuenta</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <InfoPanel title="Qué hace este enlace">
        <InfoList
          items={[
            'No enviamos emails desde la app: quien te invitó compartió el link por su cuenta.',
            'Al registrarte o ingresar, quedás en el grupo sin buscarlo por nombre.',
            'Podés participar en otros grupos después desde la pestaña Grupos.',
          ]}
        />
      </InfoPanel>
    </div>
  );
}
