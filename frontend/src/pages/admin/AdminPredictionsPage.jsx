import { useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';

export default function AdminPredictionsPage() {
  const [matchId, setMatchId] = useState('');
  const [userId, setUserId] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    const params = {};
    if (matchId.trim()) params.matchId = matchId.trim();
    if (userId.trim()) params.userId = userId.trim();
    if (!params.matchId && !params.userId) {
      setError('Indicá matchId o userId (ObjectId de Mongo)');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await adminApi.listPredictions(params);
      setPredictions(result.predictions ?? []);
    } catch (err) {
      setError(err.message);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Predicciones</h2>
        <p className="text-sm text-slate-400">Consulta solo lectura por partido o usuario.</p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">matchId</label>
          <Input
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            placeholder="ObjectId del partido"
            className="w-64 border-slate-700 bg-slate-950 font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">userId</label>
          <Input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="ObjectId del usuario"
            className="w-64 border-slate-700 bg-slate-950 font-mono text-xs"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Buscando…' : 'Buscar'}
        </Button>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800">
              <TableHead>Usuario</TableHead>
              <TableHead>Predicción</TableHead>
              <TableHead>Resultado real</TableHead>
              <TableHead className="text-right">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {predictions.map((p) => (
              <TableRow key={p.id} className="border-slate-800">
                <TableCell>
                  <p>{p.userName}</p>
                  <p className="text-xs text-slate-500">{p.userEmail}</p>
                </TableCell>
                <TableCell className="tabular-nums">
                  {p.homeGoals} - {p.awayGoals}
                </TableCell>
                <TableCell className="tabular-nums text-slate-400">
                  {p.match
                    ? `${p.match.homeScore} - ${p.match.awayScore} (${p.match.status})`
                    : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p.pointsEarned}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!loading && !predictions.length && !error ? (
          <p className="p-4 text-sm text-slate-500">Sin resultados.</p>
        ) : null}
      </div>
    </div>
  );
}
