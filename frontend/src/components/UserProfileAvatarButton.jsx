import { useAuth } from '../context/AuthContext.jsx';
import { getInitials, resolveUserAvatarUrl } from '@/lib/userAvatarUpload.js';
import { cn } from '@/lib/utils';

export default function UserProfileAvatarButton({
  onOpenProfile,
  className,
  size = 'sm',
  avatarUrl,
  name,
  goldBorder = false,
}) {
  const { user } = useAuth();
  if (!user && !name) return null;
  if (onOpenProfile && !user) return null;

  const displayName = name ?? user?.name;
  const isAiUser = Boolean(user?.isAIAgent);
  const rawAvatar = avatarUrl !== undefined ? avatarUrl : user?.avatarUrl;
  const displayAvatar = resolveUserAvatarUrl(rawAvatar, isAiUser, displayName);
  const sizeClass = size === 'lg' ? 'size-32 text-2xl' : 'size-9 text-xs';
  const shellClass = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
    goldBorder
      ? 'border-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
      : 'border border-border',
    sizeClass,
    displayAvatar ? 'bg-[#ffffff]' : 'bg-muted/60 transition-colors hover:bg-muted',
    className
  );

  const content = displayAvatar ? (
    <img src={displayAvatar} alt="" className="size-full object-contain" />
  ) : (
    <span className="font-semibold uppercase text-muted-foreground" aria-hidden>
      {getInitials(displayName)}
    </span>
  );

  if (onOpenProfile) {
    return (
      <button
        type="button"
        className={cn(
          shellClass,
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
          displayAvatar && 'transition-opacity hover:opacity-90'
        )}
        aria-label="Ver perfil"
        onClick={onOpenProfile}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={shellClass} aria-hidden>
      {content}
    </span>
  );
}
