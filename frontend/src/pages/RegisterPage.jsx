import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import InfoPanel, { InfoList } from '../components/InfoPanel.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await register(name, email, password);
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
            Creá tu cuenta personal para cargar pronósticos y competir en el ranking del Mundial
            2026.
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
            <Button type="submit">Crear cuenta</Button>
            <p className="text-sm text-muted-foreground">
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="text-foreground underline">
                Ingresá
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      <InfoPanel title="¿Qué pasa después del registro?">
        <InfoList
          items={[
            'No elegís grupo acá: primero creás la cuenta y después definís en qué grupos competís.',
            'En la pestaña Grupos podés crear un grupo nuevo (quedás como administrador) o unirte a uno existente por nombre.',
            'Podés participar en varios grupos a la vez con la misma cuenta y los mismos pronósticos.',
            'Tus puntos se calculan una sola vez; cada grupo tiene su propio ranking.',
            'En Predicciones cargás resultados; en Ranking ves posiciones generales o por grupo.',
          ]}
        />
      </InfoPanel>

      <InfoPanel title="Grupos: conceptos clave">
        <InfoList
          items={[
            'Grupo de competencia: liga privada (oficina, amigos, familia) con ranking propio.',
            'Administrador: quien creó el grupo; puede editar nombre, descripción y premios.',
            'Grupo activo: el que usás como referencia en algunas vistas (botón Usar en Grupos).',
          ]}
        />
      </InfoPanel>
    </div>
  );
}
