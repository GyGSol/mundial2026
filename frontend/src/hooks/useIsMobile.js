import { useEffect, useState } from 'react';

function detectMobile() {
  if (typeof window === 'undefined') return false;
  const narrow = window.matchMedia('(max-width: 768px)').matches;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  return mobileUa || (narrow && touch);
}

/** True when the user is on a phone-sized touch device (predictions calendar export). */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(detectMobile);

  useEffect(() => {
    const update = () => setIsMobile(detectMobile());
    update();
    const mq = window.matchMedia('(max-width: 768px)');
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}
