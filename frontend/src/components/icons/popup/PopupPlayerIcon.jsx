import { cn } from '@/lib/utils';
import { POPUP_ICON, POPUP_ICON_CLASS } from './popupIconStyles.js';

/** Mascota con lupa y pelota de fútbol. */
export function PopupPlayerIcon({ className, ...props }) {
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
      <circle cx="14" cy="15" r="5.5" fill={skin} stroke={stroke} strokeWidth="1.2" />
      <circle cx="12.5" cy="14" r="0.7" fill={stroke} />
      <circle cx="15.5" cy="14" r="0.7" fill={stroke} />
      <path d="M12.5 16.5c0.5 0.7 1.2 1 2.5 1s2-0.3 2.5-1" stroke={stroke} strokeWidth="0.9" strokeLinecap="round" />
      <path d="M9 12l2.5-1 1.5 0.8" fill={purple} stroke={stroke} strokeWidth="0.9" strokeLinejoin="round" />
      <circle cx="22" cy="22" r="5.5" fill={white} stroke={stroke} strokeWidth="1.2" />
      <path d="M22 17.5v9M17.5 22h9" stroke={stroke} strokeWidth="0.8" />
      <path d="M19.5 19.5l5 5M24.5 19.5l-5 5" stroke={stroke} strokeWidth="0.7" opacity="0.5" />
      <circle cx="8" cy="24" r="3.5" fill={white} stroke={stroke} strokeWidth="1" />
      <path d="M8 21.5v5M5.5 24h5" stroke={stroke} strokeWidth="0.7" />
      <path d="M25.5 12l2.5 4.5" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="27.5" cy="11" r="1.8" fill="none" stroke={stroke} strokeWidth="1.2" />
    </svg>
  );
}
