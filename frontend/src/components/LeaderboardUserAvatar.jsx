import { useState } from 'react';
import { X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover.jsx';
import { getInitials } from '@/lib/userAvatarUpload.js';
import { cn } from '@/lib/utils';

const thumbClass =
  'inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/90 bg-[#ffffff] shadow-[0_0_8px_rgba(245,158,11,0.25)]';

export default function LeaderboardUserAvatar({ name, avatarUrl, className }) {
  const [open, setOpen] = useState(false);

  const thumb = avatarUrl ? (
    <img src={avatarUrl} alt="" className="size-full object-contain" loading="lazy" />
  ) : (
    <span className="text-[10px] font-semibold uppercase text-muted-foreground" aria-hidden>
      {getInitials(name)}
    </span>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(thumbClass, 'cursor-pointer transition-transform hover:scale-105', className)}
          aria-label={`Ver foto de ${name}`}
          onClick={(event) => event.stopPropagation()}
        >
          {thumb}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="relative w-auto border-amber-400/40 bg-card p-3 pt-8 shadow-xl"
      >
        <button
          type="button"
          className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Cerrar"
          onClick={() => setOpen(false)}
        >
          <X className="size-4" aria-hidden />
        </button>
        <div className="flex flex-col items-center gap-2">
          <span className="inline-flex size-24 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400 bg-[#ffffff] shadow-[0_0_16px_rgba(245,158,11,0.35)]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-full object-contain" />
            ) : (
              <span className="text-2xl font-semibold uppercase text-muted-foreground" aria-hidden>
                {getInitials(name)}
              </span>
            )}
          </span>
          <p className="max-w-[12rem] text-center text-sm font-semibold leading-snug">{name}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
