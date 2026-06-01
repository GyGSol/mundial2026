import { useState } from 'react';
import { Link } from 'react-router-dom';
import { buildGroupInviteUrl } from '../lib/inviteLink.js';
import InfoPanel, { InfoList } from './InfoPanel.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';

export default function GroupInvitePanel({ group, compact = false }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = buildGroupInviteUrl(group.id);

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: el usuario puede seleccionar el input
    }
  }

  return (
    <div
      className={
        compact
          ? 'mt-3 rounded-md border border-dashed border-border/80 bg-muted/15 p-3'
          : 'flex flex-col gap-3 rounded-md border border-border/70 bg-muted/15 p-4'
      }
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Invitar jugadores</p>
        <p className="text-xs text-muted-foreground">
          Compartí el enlace por WhatsApp, email o el canal que prefieras. Quien lo abra podrá
          registrarse e ingresar a <strong className="text-foreground">{group.name}</strong>.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={inviteUrl} className="font-mono text-xs sm:flex-1" />
        <Button type="button" variant="secondary" size="sm" onClick={handleCopy} className="shrink-0">
          {copied ? 'Copiado' : 'Copiar enlace'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Vista previa del enlace:{' '}
        <Link to={`/invite/${group.id}`} className="text-foreground underline">
          abrir página de invitación
        </Link>
      </p>

      {!compact && (
        <InfoPanel title="Cómo invitar (sin email automático)">
          <InfoList
            items={[
              'Copiá el enlace y enviálo manualmente (WhatsApp, Telegram, email personal, etc.).',
              'La persona abre el link, crea cuenta o ingresa, y queda en el grupo automáticamente.',
              'Cualquiera con el enlace puede unirse: compartilo solo con quienes quieras en la liga.',
              'Podés seguir invitando después; el enlace no vence mientras exista el grupo.',
              'Si ya tiene cuenta, al abrir el link solo debe iniciar sesión y confirmar la unión.',
            ]}
          />
        </InfoPanel>
      )}
    </div>
  );
}
