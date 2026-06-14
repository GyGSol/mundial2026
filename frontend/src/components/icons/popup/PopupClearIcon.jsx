import { cn } from '@/lib/utils';
import { POPUP_ICON, POPUP_ICON_CLASS } from './popupIconStyles.js';

/** Mascota borrando burbujas de chat. */
export function PopupClearIcon({ className, ...props }) {
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
      <ellipse cx="22" cy="10" rx="4.5" ry="3.2" fill={white} stroke={stroke} strokeWidth="1" />
      <ellipse cx="9" cy="12" rx="3.5" ry="2.5" fill={white} stroke={stroke} strokeWidth="1" />
      <path
        d="M20.5 9.5h1.8M21.4 8.6v1.8M8.2 11.2h1.4M8.9 10.5v1.4"
        stroke={stroke}
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <circle cx="16" cy="17" r="5.5" fill={skin} stroke={stroke} strokeWidth="1.2" />
      <path d="M13.5 16.5c0.4 0.8 1.2 1.2 2.5 1.2s2.1-0.4 2.5-1.2" stroke={stroke} strokeWidth="0.9" strokeLinecap="round" />
      <circle cx="14.2" cy="15.8" r="0.7" fill={stroke} />
      <circle cx="17.8" cy="15.8" r="0.7" fill={stroke} />
      <path d="M10.5 14.5l-2.5-1.2 1.8-0.8" fill={purple} stroke={stroke} strokeWidth="0.9" strokeLinejoin="round" />
      <rect x="19" y="20" width="6" height="3.5" rx="0.6" fill={purple} stroke={stroke} strokeWidth="1" transform="rotate(-25 22 21.75)" />
      <path d="M24.5 18.5l2 1.5-1.2 1.8" stroke={stroke} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
