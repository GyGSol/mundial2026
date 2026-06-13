import { useState } from 'react';
import { Loader2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import { useStreamConfig } from '@/hooks/useStreamConfig.js';
import LiveStreamPlayer from './LiveStreamPlayer.jsx';

function ChannelPicker({ channels, activeId, onSelect }) {
  if (!channels?.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {channels.map((channel) => (
        <Button
          key={channel.id}
          type="button"
          size="sm"
          variant={channel.id === activeId ? 'default' : 'outline'}
          className={cn('gap-1.5', channel.id === activeId && 'ring-1 ring-primary/40')}
          onClick={() => onSelect(channel.id)}
        >
          {channel.logo ? (
            <img src={channel.logo} alt="" className="h-4 w-auto object-contain" loading="lazy" />
          ) : (
            <Radio className="size-3.5 shrink-0" aria-hidden />
          )}
          {channel.name}
        </Button>
      ))}
    </div>
  );
}

export default function LiveMatchPanel({ match, className }) {
  const matchId = match?.externalId ?? match?.id;
  const isLive = match?.status === 'live';
  const [selectedChannelId, setSelectedChannelId] = useState(null);

  const { config, loading, error } = useStreamConfig(matchId, selectedChannelId, {
    enabled: isLive && Boolean(matchId),
  });

  if (!isLive) return null;

  const activeChannelId = config?.active?.channelId ?? selectedChannelId;
  const streamUrl = config?.available ? config.active?.url : null;

  return (
    <div className={cn('live-match-panel flex flex-col gap-3', className)}>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Transmisión alternativa · independiente de la programación oficial del partido.
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Buscando señal en vivo…
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : null}

      {!loading && config?.available ? (
        <>
          <ChannelPicker
            channels={config.channels}
            activeId={activeChannelId}
            onSelect={setSelectedChannelId}
          />
          {streamUrl ? (
            <LiveStreamPlayer
              url={streamUrl}
              type={config.active?.type}
              channelName={config.channels?.find((c) => c.id === activeChannelId)?.name}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
