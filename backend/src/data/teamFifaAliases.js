/**
 * Mapeo de códigos FIFA en seed/embed → códigos en worldcup26.ir / MongoDB.
 */
export const FIFA_CODE_ALIASES = {
  SAU: 'KSA',
};

export function resolveFifaCode(code) {
  if (!code) return '';
  const upper = String(code).toUpperCase();
  return FIFA_CODE_ALIASES[upper] || upper;
}
