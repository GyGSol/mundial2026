import { cn } from '@/lib/utils';
import { POPUP_ICON, POPUP_ICON_CLASS } from './popupIconStyles.js';

/** Cámara de TV + operador tambaleándose — “dificultades técnicas”. */
export function PopupStreamIcon({ className, ...props }) {
  const { skin, purple, teal, stroke, white, sky } = POPUP_ICON;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(POPUP_ICON_CLASS, className)}
      aria-hidden="true"
      {...props}
    >
      <circle cx="16" cy="16" r="15" fill={sky} stroke={stroke} strokeWidth="1.2" />
      <path d="M4 8h12v8H4z" fill={purple} stroke={stroke} strokeWidth="1" strokeLinejoin="round" />
      <circle cx="10" cy="12" r="2.8" fill="#334155" stroke={stroke} strokeWidth="0.9" />
      <circle cx="10" cy="12" r="1.2" fill={white} opacity="0.4" />
      <rect x="6" y="16" width="2" height="5" fill={stroke} rx="0.3" />
      <rect x="12" y="16" width="2" height="5" fill={stroke} rx="0.3" />
      <path d="M5 21h10" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
      <text x="5.5" y="7" fontSize="3" fontWeight="700" fill={white} fontFamily="sans-serif">
        TV
      </text>
      <circle cx="22" cy="17" r="5.5" fill={skin} stroke={stroke} strokeWidth="1.2" />
      <circle cx="20.5" cy="16" r="0.75" fill={stroke} />
      <circle cx="23.5" cy="16" r="0.75" fill={stroke} />
      <path d="M20 18.5c0.5 0.8 1.3 1.2 2 1.2s1.5-0.4 2-1.2" stroke={stroke} strokeWidth="0.9" strokeLinecap="round" />
      <path d="M19 13l2.5-1.2 1.5 0.8" fill={purple} stroke={stroke} strokeWidth="0.9" strokeLinejoin="round" />
      <rect x="24" y="19" width="3" height="6" rx="0.5" fill="#2D6A4F" stroke={stroke} strokeWidth="0.9" transform="rotate(15 25.5 22)" />
      <text x="24.3" y="23.5" fontSize="2.2" fontWeight="700" fill={white} fontFamily="sans-serif" transform="rotate(15 25.5 22)">
        XXX
      </text>
      <path d="M18 10l1-2M22 9l0.5-2.5M26 11l1.5-1.5" stroke={stroke} strokeWidth="0.9" strokeLinecap="round" />
      <path d="M17 24l1.5 2M24 25l-1 2" stroke={stroke} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
