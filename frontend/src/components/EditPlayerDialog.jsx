import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import DialogTitleWithIcon from '@/components/DialogTitleWithIcon.jsx';
import { PopupEditIcon } from '@/components/icons/popup/index.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card.jsx';

export default function EditPlayerDialog({ open, onOpenChange }) {
  const { user, updateProfile } = useAuth();
  const dialogRef = useRef(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      setName(user?.name ?? '');
      setError('');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, user?.name]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await updateProfile(name);
      handleClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el nombre');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <dialog
      ref={dialogRef}
      className="max-w-md rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/40"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="edit-player-title"
    >
      <form onSubmit={handleSubmit}>
        <Card className="border-0 shadow-none">
          <CardHeader>
            <DialogTitleWithIcon
              icon={PopupEditIcon}
              id="edit-player-title"
              iconLabel="¿Cómo te llamás en la cancha?"
            >
              Editar jugador
            </DialogTitleWithIcon>
            <CardDescription>
              Cambiá cómo aparecés en el ranking y en los grupos. El email no se puede modificar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="player-name" className="text-sm font-medium">
                Nombre de jugador
              </label>
              <Input
                id="player-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoComplete="nickname"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="player-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="player-email"
                type="email"
                value={user.email}
                disabled
                readOnly
                className="bg-muted text-muted-foreground"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </dialog>
  );
}
