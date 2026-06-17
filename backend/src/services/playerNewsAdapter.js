/**
 * Adaptador futuro para noticias de convocatorias/lesiones (p. ej. Infobae).
 * Por ahora delega en aiPlayerIntelService.
 */
export async function fetchPlayerAvailabilityNews() {
  return { source: 'stub', items: [] };
}
