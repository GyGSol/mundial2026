import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { economyApi } from '../api/economyClient.js';
import FubolCoinIcon from './FubolCoinIcon.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { MOCK_CHECKOUT_DELAY_MS } from '../lib/economyConstants.js';

export default function StripeCheckoutModal({ open, onOpenChange, onSuccess }) {
  const dialogRef = useRef(null);
  const { refreshUser } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setError('');
      setProcessing(false);
      setSessionId(null);
      setCardNumber('4242 4242 4242 4242');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    if (processing) return;
    onOpenChange(false);
  };

  async function handlePay(e) {
    e.preventDefault();
    setError('');
    setProcessing(true);
    try {
      const checkout = await economyApi.startCheckout(10);
      setSessionId(checkout.sessionId);
      await new Promise((resolve) => setTimeout(resolve, MOCK_CHECKOUT_DELAY_MS));
      await economyApi.completeCheckout(checkout.sessionId);
      await refreshUser();
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'No se pudo completar el pago');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="max-w-md rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/40"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="stripe-mock-title"
    >
      <form onSubmit={handlePay}>
        <Card className="border-0 shadow-none">
          <CardHeader>
            <CardTitle id="stripe-mock-title" className="flex items-center gap-2 text-lg">
              <span className="rounded bg-[#635bff] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                Stripe
              </span>
              Checkout simulado
            </CardTitle>
            <CardDescription>
              Pagá USD 10.00 y recibí 100 Fubols en tu cuenta (sin cargo real).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="inline-flex items-center gap-2 font-semibold">
                $10.00 → 100 <FubolCoinIcon size="sm" />
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mock-card" className="text-sm font-medium">
                Tarjeta
              </label>
              <Input
                id="mock-card"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                disabled={processing}
              />
            </div>
            {processing ? (
              <p className="text-sm text-muted-foreground" role="status">
                Procesando pago{sessionId ? '…' : '…'}
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={processing}>
              Cancelar
            </Button>
            <Button type="submit" disabled={processing}>
              {processing ? 'Procesando…' : 'Pagar $10.00'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </dialog>
  );
}
