import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILES_PATH = join(__dirname, '../data/nationFootballProfiles.json');

/** Peso por tier de liga doméstica (1 = élite, 5 = microestatal). */
const TIER_WEIGHTS = {
  1: 1.0,
  2: 0.75,
  3: 0.5,
  4: 0.3,
  5: 0.15,
};

/** Población de referencia para normalizar (millones). */
const POPULATION_REFERENCE_M = 85;

let cachedProfiles = null;
let cachedProfilesMtime = null;

async function loadProfilesFile() {
  const stat = await import('fs/promises').then((fs) => fs.stat(PROFILES_PATH));
  if (cachedProfiles && cachedProfilesMtime === stat.mtimeMs) {
    return cachedProfiles;
  }
  const raw = JSON.parse(await readFile(PROFILES_PATH, 'utf8'));
  cachedProfiles = {
    source: raw.source ?? null,
    tierLegend: raw.tierLegend ?? {},
    profiles: raw.profiles ?? {},
  };
  cachedProfilesMtime = stat.mtimeMs;
  return cachedProfiles;
}

export async function getNationProfilesData() {
  return loadProfilesFile();
}

export async function getNationProfile(fifaCode) {
  const code = String(fifaCode ?? '').trim().toUpperCase();
  if (!code) return null;
  const data = await loadProfilesFile();
  const profile = data.profiles[code];
  if (!profile) return null;

  const tier = Number(profile.domesticLeagueTier) || 5;
  return {
    fifaCode: code,
    name: profile.name ?? code,
    populationMillions: profile.populationMillions ?? null,
    domesticLeagueName: profile.domesticLeagueName ?? null,
    domesticLeagueTier: tier,
    domesticLeagueTierLabel: data.tierLegend[String(tier)] ?? null,
    climateHome: profile.climateHome ?? null,
    worldCupAppearances: profile.worldCupAppearances ?? null,
    worldCupBestFinish: profile.worldCupBestFinish ?? null,
    wikiNote: profile.wikiNote ?? null,
  };
}

/**
 * Índice 0–1 que combina población y calidad de liga doméstica.
 * No es probabilidad de victoria; es proxy de profundidad de talento.
 */
export function buildTalentPoolIndex(profile) {
  if (!profile) return null;

  const pop = Number(profile.populationMillions);
  const tier = Number(profile.domesticLeagueTier) || 5;
  const popFactor = Number.isFinite(pop) && pop > 0
    ? Math.min(1, Math.log10(pop * 1_000_000 + 1) / Math.log10(POPULATION_REFERENCE_M * 1_000_000 + 1))
    : 0.1;
  const tierWeight = TIER_WEIGHTS[tier] ?? TIER_WEIGHTS[5];

  return Number((popFactor * 0.4 + tierWeight * 0.6).toFixed(3));
}

export function isWorldCupDebut(profile) {
  if (!profile) return false;
  const appearances = Number(profile.worldCupAppearances);
  const best = String(profile.worldCupBestFinish ?? '').toLowerCase();
  return appearances <= 1 && best.includes('debut');
}
