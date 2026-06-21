import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext.jsx';
import DialogTitleWithIcon from '@/components/DialogTitleWithIcon.jsx';
import UserProfileAvatarButton from '@/components/UserProfileAvatarButton.jsx';
import { PopupFubolIcon } from '@/components/icons/popup/index.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card.jsx';
import { readAndCompressAvatar } from '@/lib/userAvatarUpload.js';
import FubolCoinIcon from './FubolCoinIcon.jsx';

function ReadOnlyField({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

export default function UserProfileDialog({ open, onOpenChange }) {
  const { user, updateProfile } = useAuth();
  const dialogRef = useRef(null);
  const fileInputRef = useRef(null);
  const [name, setName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarPending, setAvatarPending] = useState(undefined);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      setName(user?.name ?? '');
      setAvatarPreview(user?.avatarUrl ?? null);
      setAvatarPending(undefined);
      setError('');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, user?.name, user?.avatarUrl]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handlePickPhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    try {
      const dataUrl = await readAndCompressAvatar(file);
      setAvatarPreview(dataUrl);
      setAvatarPending(dataUrl);
    } catch (err) {
      setError(err.message || 'No se pudo procesar la imagen');
    }
  };

  const handleRemovePhoto = () => {
    setAvatarPreview(null);
    setAvatarPending(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('El nombre de jugador es obligatorio');
      return;
    }

    const nameChanged = trimmedName !== user?.name;
    const avatarChanged = avatarPending !== undefined;
    if (!nameChanged && !avatarChanged) {
      handleClose();
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: trimmedName,
        ...(avatarChanged ? { avatarDataUrl: avatarPending } : {}),
      });
      handleClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const activeGroupName = user.competitionGroup?.name ?? 'Sin grupo activo';

  return createPortal(
    <dialog
      ref={dialogRef}
      className="user-profile-dialog overflow-y-auto rounded-xl border border-border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/55"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="user-profile-title"
    >
      <form onSubmit={handleSubmit} className="w-full">
        <Card className="w-full border-0 shadow-none">
          <CardHeader className="gap-2 pb-4 text-center">
            <DialogTitleWithIcon
              icon={PopupFubolIcon}
              id="user-profile-title"
              iconLabel="Tu perfil de jugador"
              className="justify-center"
            >
              Mi perfil
            </DialogTitleWithIcon>
            <CardDescription className="text-center">
              Datos de tu cuenta y foto visible en el header.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 px-6 pt-0">
            <div className="flex flex-col items-center gap-3">
              <UserProfileAvatarButton
                size="lg"
                avatarUrl={avatarPreview}
                name={name}
                goldBorder
              />
              {avatarPreview !== (user.avatarUrl ?? null) ? (
                <p className="text-xs text-muted-foreground">Vista previa — guardá para aplicar</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handlePickPhoto} disabled={saving}>
                  Cambiar foto
                </Button>
                {avatarPreview ? (
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhoto} disabled={saving}>
                    Quitar foto
                  </Button>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                className="sr-only"
                onChange={handleFileChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
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
              <div className="col-span-2 flex flex-col gap-1.5">
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

              <ReadOnlyField label="Puntos totales">{user.totalPoints ?? 0}</ReadOnlyField>
              <ReadOnlyField label="Fubols">
                <span className="inline-flex items-center gap-1.5">
                  <FubolCoinIcon size="sm" />
                  {user.balanceFubols ?? 0}
                </span>
              </ReadOnlyField>
              <ReadOnlyField label="Créditos IA">{user.aiQuestionCredits ?? 0}</ReadOnlyField>
              <ReadOnlyField label="Grupo activo">{activeGroupName}</ReadOnlyField>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
          <CardFooter className="flex justify-end gap-2 px-6 pb-6 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </dialog>,
    document.body
  );
}
