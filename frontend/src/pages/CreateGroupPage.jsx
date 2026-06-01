import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { competitionGroupsApi } from '../api/client.js';
import InfoPanel, { InfoList } from '../components/InfoPanel.jsx';
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
      navigate('/groups', { state: { welcome: false, created: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Crear grupo</CardTitle>
          <CardDescription>
            Armá una liga privada. Vos quedás como administrador y podés invitar a otros a unirse
            desde la pestaña Grupos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Nombre del grupo</label>
              <Input
                placeholder="Ej: Oficina IT · Amigos del bar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Debe ser único. Los jugadores te buscan por este nombre para unirse.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Descripción (opcional)</label>
              <Input
                placeholder="Ej: Pronósticos del equipo de marketing"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Puestos premiados (0–10)</label>
              <Input
                type="number"
                min={0}
                max={10}
                value={prizesWinnersCount}
                onChange={(e) => {
                  const count = Number(e.target.value || 0);
                  setPrizesWinnersCount(count);
                  syncPrizeRows(count);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Con 0 no hay premios configurados. Con 3 podés definir qué recibe 1°, 2° y 3° (texto
                libre: dinero, regalo, etc.).
              </p>
            </div>

            {prizesWinnersCount > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                <p className="sm:col-span-2 text-sm font-medium">Detalle de premios (opcional)</p>
                {prizes.map((row) => (
                  <Input
                    key={`create-prize-${row.position}`}
                    placeholder={`Puesto ${row.position}: ej. $5000 / Cena / Camiseta`}
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
              <Link to="/groups" className="text-foreground underline">
                Volver a Grupos
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      <InfoPanel title="Como administrador podés">
        <InfoList
          items={[
            'Editar nombre, descripción y premios del grupo en cualquier momento.',
            'Eliminar el grupo si ya no se usa (los jugadores no pierden puntos globales).',
            'Compartir el nombre del grupo para que otros se unan con Unirme.',
          ]}
        />
      </InfoPanel>
    </div>
  );
}
