import { cn } from '@/lib/utils';

export const ADMIN_BANNERS = {
  sync: '/admin/avances/avance-mundial-stats.png',
  matches: '/admin/avances/avance-ranking-vivo.png',
  users: '/admin/avances/avance-panel-admin.png',
  groups: '/admin/avances/avance-grupos-amigos.png',
  predictions: '/admin/avances/avance-predicciones.png',
  simulation: '/admin/avances/avance-ranking-vivo.png',
};

export const adminPage = 'flex flex-col gap-6';

export const adminCard = 'border-slate-800 bg-slate-900 text-slate-100';

export const adminCardInner = 'overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60';

export const adminInput = 'border-slate-700 bg-slate-950';

export const adminLabel = 'text-sm text-slate-300';

export const adminMuted = 'text-sm text-slate-400';

export const adminHint = 'text-xs text-slate-500';

export const adminBadgeOutline = 'border-amber-500/40 text-amber-200';

export const adminHighlight =
  'border-amber-500/40 bg-amber-500/10';

export function adminTableRow(className) {
  return cn('border-slate-800 hover:bg-slate-800/40', className);
}
