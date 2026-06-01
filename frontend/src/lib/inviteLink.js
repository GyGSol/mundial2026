/** URL pública para invitar a unirse a un grupo (sin envío de email desde la app). */
export function buildGroupInviteUrl(groupId) {
  if (typeof window === 'undefined' || !groupId) return '';
  return `${window.location.origin}/invite/${groupId}`;
}

export function buildAuthPathWithJoin(path, groupId) {
  if (!groupId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}joinGroup=${encodeURIComponent(groupId)}`;
}
