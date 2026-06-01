import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { competitionGroupsApi } from '../api/client.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function CreateGroupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await competitionGroupsApi.create(name, description);
      navigate(`/groups`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Crear grupo</CardTitle>
        <CardDescription>
          Armá un grupo privado para que amigos, familia o compañeros compitan entre sí.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            placeholder="Nombre del grupo (ej. Oficina IT)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            placeholder="Descripción opcional"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? 'Creando...' : 'Crear grupo'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Después de crearlo podés registrarte y elegir este grupo.{' '}
            <Link to="/register" className="text-foreground underline">
              Ir al registro
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
