/**
 * Mapeo de códigos FIFA en seed/embed → códigos en worldcup26.ir / MongoDB.
 * Mantener en sync con backend/src/data/teamFifaAliases.js
 */
export const FIFA_CODE_ALIASES = {
  SAU: 'KSA',
};

export function fifaCodesForRankingLookup(code) {
  if (!code) return [];
  const upper = String(code).toUpperCase();
  const out = new Set([upper]);
  const mapped = FIFA_CODE_ALIASES[upper];
  if (mapped) out.add(mapped);
  for (const [from, to] of Object.entries(FIFA_CODE_ALIASES)) {
    if (to === upper) out.add(from);
  }
  return [...out];
}

export function lookupFifaRankInTable(code, rankingsByCode = {}) {
  for (const candidate of fifaCodesForRankingLookup(code)) {
    const rank = rankingsByCode[candidate];
    if (rank != null) return rank;
  }
  return null;
}
