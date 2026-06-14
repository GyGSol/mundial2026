import { cn } from '@/lib/utils';
import { POPUP_ICON, POPUP_ICON_CLASS } from './popupIconStyles.js';

/** Mascota señalando un arco de estadio. */
export function PopupStadiumIcon({ className, ...props }) {
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
      <circle cx="16" cy="16" r="15" fill={teal} stroke={stroke} strokeWidth="1.2" />
      <ellipse cx="22" cy="24" rx="7" ry="2.5" fill={sky} stroke={stroke} strokeWidth="0.9" />
      <path d="M16 24v-6" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M16 18c-3 0-5.5 2-5.5 4.5" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M16 18c3 0 5.5 2 5.5 4.5" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <rect x="14.5" y="22" width="3" height="2" fill={white} stroke={stroke} strokeWidth="0.8" />
      <circle cx="11" cy="14" r="5" fill={skin} stroke={stroke} strokeWidth="1.2" />
      <circle cx="9.8" cy="13.2" r="0.65" fill={stroke} />
      <circle cx="12.2" cy="13.2" r="0.65" fill={stroke} />
      <path d="M9.5 15.2c0.4 0.6 1 0.9 1.5 0.9s1.1-0.3 1.5-0.9" stroke={stroke} strokeWidth="0.8" strokeLinecap="round" />
      <path d="M7.5 11.5l2-1 1.5 0.6" fill={purple} stroke={stroke} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M14 16.5l4-2 1 2.5" stroke={skin} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 15l1.5 1.5" stroke={stroke} strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}
