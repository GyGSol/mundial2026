import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { economyApi } from '../api/economyClient.js';
import FubolCoinIcon from '../components/FubolCoinIcon.jsx';
import StripeCheckoutModal from '../components/StripeCheckoutModal.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { formatFubolAmount, TX_TYPE_LABELS } from '../lib/economyConstants.js';

function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export default function EconomyPage() {
  const { user, refreshUser } = useAuth();
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [balanceData, txData] = await Promise.all([
        economyApi.getBalance(),
        economyApi.getTransactions({ limit: 50 }),
      ]);
      setSummary(balanceData);
      setTransactions(txData.items || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la economía');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const balance = summary?.balanceFubols ?? user?.balanceFubols ?? 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Economía</h1>
        <p className="text-sm text-muted-foreground">
          Fubols virtuales para inscripciones y premios. 10 USD = 100 Fubols.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FubolCoinIcon size="lg" />
              <span>{balance} Fubols</span>
            </CardTitle>
            <CardDescription>
              Retiro máximo disponible: {summary?.maxWithdrawal ?? 0} Fubols
            </CardDescription>
          </div>
          <Button onClick={() => setCheckoutOpen(true)}>Cargar Fubols</Button>
        </CardHeader>
        {successMsg ? (
          <CardContent>
            <p className="text-sm text-primary" role="status">
              {successMsg}
            </p>
          </CardContent>
        ) : null}
      </Card>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
          <CardDescription>Ingresos, inscripciones, premios y bonos.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(tx.createdAt)}
                    </TableCell>
                    <TableCell>{TX_TYPE_LABELS[tx.type] || tx.type}</TableCell>
                    <TableCell className="text-right font-medium">
                      <span className="inline-flex items-center justify-end gap-1">
                        {formatFubolAmount(tx.amount)}
                        <FubolCoinIcon size="sm" />
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <StripeCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onSuccess={async () => {
          setSuccessMsg('¡Carga exitosa! Sumaste 100 Fubols.');
          await refreshUser();
          await load();
        }}
      />
    </div>
  );
}
