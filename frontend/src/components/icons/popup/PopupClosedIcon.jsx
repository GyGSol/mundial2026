import { cn } from '@/lib/utils';
import { POPUP_ICON, POPUP_ICON_CLASS } from './popupIconStyles.js';

/** Mascota con candado y reloj — predicción cerrada. */
export function PopupClosedIcon({ className, ...props }) {
  const { skin, purple, teal, stroke, white } = POPUP_ICON;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(POPUP_ICON_CLASS, className)}
      aria-hidden="true"
      {...props}
    >
      <circle cx="16" cy="16" r="15" fill={teal} stroke={stroke} strokeWidth="1.2" />
      <circle cx="13" cy="15" r="5.5" fill={skin} stroke={stroke} strokeWidth="1.2" />
      <circle cx="11.5" cy="14.2" r="0.7" fill={stroke} />
      <circle cx="14.5" cy="14.2" r="0.7" fill={stroke} />
      <path d="M11 16.5c0.5 0.7 1.2 1 2 1s1.5-0.3 2-1" stroke={stroke} strokeWidth="0.9" strokeLinecap="round" />
      <path d="M8.5 12l2.5-1 1.5 0.7" fill={purple} stroke={stroke} strokeWidth="0.9" strokeLinejoin="round" />
      <rect x="20" y="18" width="7" height="6" rx="1" fill={white} stroke={stroke} strokeWidth="1" />
      <path d="M21.5 18v-2a2.5 2.5 0 0 1 5 0v2" stroke={stroke} strokeWidth="1.2" fill="none" />
      <circle cx="23.5" cy="21" r="1" fill={stroke} />
      <circle cx="7" cy="24" r="3" fill={white} stroke={stroke} strokeWidth="1" />
      <path d="M7 22v4M5 24h4" stroke={stroke} strokeWidth="0.8" />
      <path d="M6 23.5h2M6 24.5h2" stroke={purple} strokeWidth="0.6" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
