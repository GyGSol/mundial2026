import { cn } from '@/lib/utils';
import { POPUP_ICON, POPUP_ICON_CLASS } from './popupIconStyles.js';

/** Mascota frente a monitor con badge EN VIVO. */
export function PopupLiveIcon({ className, ...props }) {
  const { skin, purple, teal, stroke, white, red } = POPUP_ICON;
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
      <rect x="5" y="8" width="14" height="10" rx="1" fill="#334155" stroke={stroke} strokeWidth="1" />
      <rect x="6.5" y="9.5" width="11" height="7" rx="0.5" fill={purple} opacity="0.8" />
      <rect x="10" y="18" width="4" height="2" fill={stroke} />
      <path d="M8 20h12" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
      <rect x="18" y="5" width="10" height="4" rx="1" fill={red} stroke={stroke} strokeWidth="0.8" />
      <circle cx="19.5" cy="7" r="0.8" fill={white} />
      <text x="20.8" y="7.8" fontSize="2.2" fontWeight="700" fill={white} fontFamily="sans-serif">
        VIVO
      </text>
      <circle cx="23" cy="22" r="5" fill={skin} stroke={stroke} strokeWidth="1.2" />
      <circle cx="21.8" cy="21.2" r="0.65" fill={stroke} />
      <circle cx="24.2" cy="21.2" r="0.65" fill={stroke} />
      <path d="M21.5 23.5c0.4 0.6 1 0.9 1.5 0.9s1.1-0.3 1.5-0.9" stroke={stroke} strokeWidth="0.8" strokeLinecap="round" />
      <path d="M20.5 19l2-1 1.2 0.6" fill={purple} stroke={stroke} strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}
