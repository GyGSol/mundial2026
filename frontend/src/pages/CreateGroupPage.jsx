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
  const [prizesWinnersCount, setPrizesWinnersCount] = useState(0);
  const [prizes, setPrizes] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const syncPrizeRows = (count) => {
    const safeCount = Math.max(0, Math.min(Number(count || 0), 10));
    setPrizes((prev) => {
      const byPos = Object.fromEntries(prev.map((row) => [row.position, row.prize]));
      return Array.from({ length: safeCount }, (_, index) => ({
        position: index + 1,
        prize: byPos[index + 1] || '',
      }));
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await competitionGroupsApi.create(name, description, prizesWinnersCount, prizes);
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
          Armá un grupo privado. El creador queda como administrador y único editor.
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
          <Input
            type="number"
            min={0}
            max={10}
            placeholder="Cantidad de puestos premiados"
            value={prizesWinnersCount}
            onChange={(e) => {
              const count = Number(e.target.value || 0);
              setPrizesWinnersCount(count);
              syncPrizeRows(count);
            }}
          />
          {prizesWinnersCount > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {prizes.map((row) => (
                <Input
                  key={`create-prize-${row.position}`}
                  placeholder={`Premio puesto ${row.position} (opcional)`}
                  value={row.prize}
                  onChange={(e) =>
                    setPrizes((prev) =>
                      prev.map((item) =>
                        item.position === row.position ? { ...item, prize: e.target.value } : item
                      )
                    )
                  }
                />
              ))}
            </div>
          )}
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
