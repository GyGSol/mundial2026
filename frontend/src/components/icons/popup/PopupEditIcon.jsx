import { cn } from '@/lib/utils';
import { POPUP_ICON, POPUP_ICON_CLASS } from './popupIconStyles.js';

/** Mascota con camiseta y lapicera para editar nombre. */
export function PopupEditIcon({ className, ...props }) {
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
      <circle cx="15" cy="14" r="6" fill={skin} stroke={stroke} strokeWidth="1.2" />
      <path d="M11.5 12.5h7M12 14.5h5.5" stroke={stroke} strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
      <circle cx="13.2" cy="13.2" r="0.75" fill={stroke} />
      <circle cx="16.8" cy="13.2" r="0.75" fill={stroke} />
      <path d="M13 16c0.5 0.6 1.2 0.9 2 0.9s1.5-0.3 2-0.9" stroke={stroke} strokeWidth="0.9" strokeLinecap="round" />
      <path d="M9 10.5l3-1.5 2.5 1" fill={purple} stroke={stroke} strokeWidth="1" strokeLinejoin="round" />
      <path d="M10 19h10l-1 5H11l-1-5z" fill={white} stroke={stroke} strokeWidth="1" strokeLinejoin="round" />
      <path d="M12 19v-2.5c0-1 1.5-2 3-2s3 1 3 2V19" fill={purple} stroke={stroke} strokeWidth="0.9" />
      <path
        d="M22 8.5l2.5 2.5-5.5 5.5-2.8 0.8 0.8-2.8 5-5z"
        fill="#F4A261"
        stroke={stroke}
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path d="M20 10.5l1.5 1.5" stroke={stroke} strokeWidth="0.7" />
    </svg>
  );
}
