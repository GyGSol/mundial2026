import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { competitionGroupsApi } from '../api/client.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [competitionGroupId, setCompetitionGroupId] = useState(
    searchParams.get('groupId') || ''
  );
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    competitionGroupsApi
      .list()
      .then((data) => setGroups(data.groups ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingGroups(false));
  }, []);

  useEffect(() => {
    const fromQuery = searchParams.get('groupId');
    if (fromQuery) setCompetitionGroupId(fromQuery);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!competitionGroupId) {
      setError('Seleccioná un grupo de competencia');
      return;
    }

    try {
      await register(name, email, password, competitionGroupId);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Registrarse</CardTitle>
        <CardDescription>
          Elegí un grupo existente para competir en su ranking separado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Grupo de competencia</label>
            {loadingGroups ? (
              <p className="text-sm text-muted-foreground">Cargando grupos...</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay grupos.{' '}
                <Link to="/groups/new" className="text-foreground underline">
                  Creá el primero
                </Link>
              </p>
            ) : (
              <Select value={competitionGroupId} onValueChange={setCompetitionGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un grupo" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.memberCount} jugadores)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={!groups.length}>
            Crear cuenta
          </Button>
          <p className="text-sm text-muted-foreground">
            ¿Necesitás un grupo nuevo?{' '}
            <Link to="/groups/new" className="text-foreground underline">
              Crear grupo
            </Link>
            {' · '}
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-foreground underline">
              Ingresá
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
