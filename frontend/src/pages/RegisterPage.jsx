import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { joinGroupAfterAuth } from '../lib/joinGroupAfterAuth.js';
import { buildAuthPathWithJoin } from '../lib/inviteLink.js';
import InfoPanel, { InfoList } from '../components/InfoPanel.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function RegisterPage() {
  const { register, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const joinGroupId = searchParams.get('joinGroup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await register(name, email, password);

      if (joinGroupId) {
        const group = await joinGroupAfterAuth(joinGroupId);
        await refreshUser();
        navigate('/groups', {
          replace: true,
          state: {
            successMessage: group
              ? `Cuenta creada y te uniste a ${group.name}.`
              : 'Cuenta creada. Ya estás en el grupo de la invitación.',
          },
        });
        return;
      }

      navigate('/groups', {
        replace: true,
        state: { welcome: true },
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Registro de jugador</CardTitle>
          <CardDescription>
            {joinGroupId
              ? 'Creá tu cuenta para aceptar la invitación al grupo.'
              : 'Creá tu cuenta personal para cargar pronósticos y competir en el ranking del Mundial 2026.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-name" className="text-sm font-medium">
                Nombre o apodo
              </label>
              <Input
                id="register-name"
                placeholder="Ej: Gonzalo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Es el nombre que verán los demás en el ranking de cada grupo.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="register-email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Lo usás para ingresar. Debe ser único en la plataforma.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="register-password"
                type="password"
                placeholder="Mínimo 6 caracteres recomendado"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit">
              {joinGroupId ? 'Crear cuenta y unirme' : 'Crear cuenta'}
            </Button>
            <p className="text-sm text-muted-foreground">
              ¿Ya tenés cuenta?{' '}
              <Link
                to={joinGroupId ? buildAuthPathWithJoin('/login', joinGroupId) : '/login'}
                className="text-foreground underline"
              >
                Ingresá
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      {joinGroupId ? (
        <InfoPanel title="Invitación por enlace">
          <InfoList
            items={[
              'Al terminar el registro entrás al grupo automáticamente.',
              'No hace falta buscar el grupo por nombre en la pestaña Grupos.',
              'Después podés sumarte a otros grupos si querés.',
            ]}
          />
        </InfoPanel>
      ) : (
        <>
          <InfoPanel title="¿Qué pasa después del registro?">
            <InfoList
              items={[
                'En la pestaña Grupos podés crear un grupo (administrador) o unirte a uno existente.',
                'Si te pasan un enlace de invitación, abrilo y registrate desde ahí.',
                'Podés participar en varios grupos con la misma cuenta y los mismos pronósticos.',
              ]}
            />
          </InfoPanel>
        </>
      )}
    </div>
  );
}
