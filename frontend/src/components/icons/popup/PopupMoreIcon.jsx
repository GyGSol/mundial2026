import { cn } from '@/lib/utils';
import { POPUP_ICON, POPUP_ICON_CLASS } from './popupIconStyles.js';

/** Mascota asomándose desde menú de tres líneas. */
export function PopupMoreIcon({ className, ...props }) {
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
      <rect x="5" y="6" width="12" height="20" rx="2" fill={white} stroke={stroke} strokeWidth="1" />
      <path d="M8 11h6M8 16h6M8 21h6" stroke={purple} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="22" cy="18" r="6" fill={skin} stroke={stroke} strokeWidth="1.2" />
      <circle cx="20.5" cy="17.2" r="0.75" fill={stroke} />
      <circle cx="23.5" cy="17.2" r="0.75" fill={stroke} />
      <path d="M20 19.5c0.5 0.7 1.2 1 2 1s1.5-0.3 2-1" stroke={stroke} strokeWidth="0.9" strokeLinecap="round" />
      <path d="M19 14.5l2.5-1 1.5 0.8" fill={purple} stroke={stroke} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M16 18c2-1 3.5-0.5 4.5 1" stroke={skin} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
