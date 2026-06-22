import { existsSync, readFileSync } from 'fs';
import { readdir, readFile, stat } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Player } from '../models/Player.js';
import { env } from '../config/env.js';
import { FIFA_TO_PHOTO_FOLDER } from '../data/wikipediaSquadCountryMap.js';
import { areSamePlayer } from './playerRosterUnifyService.js';
import { compactNameKey, normalizeName, slugTransliterationVariants } from '../utils/playerNameMatch.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');
export const PLAYER_PHOTOS_DIR = join(REPO_ROOT, 'imagenes-jugadores');
export const GENERATOR_TXT_DIR = join(PLAYER_PHOTOS_DIR, 'generador');

const GENERATOR_LINE =
  /^([a-z0-9-]+\.png)\s+\|\s+#\d+\s+\|\s+([^|]+?)(?:\s+\([^)]*\))?\s+\|/i;

/** Carpetas en imagenes-jugadores → código FIFA */
export const TEAM_FOLDER_TO_FIFA = {
  argelia: 'ALG',
  'arabia-saudita': 'KSA',
  alemania: 'GER',
  argentina: 'ARG',
  australia: 'AUS',
  austria: 'AUT',
  belgica: 'BEL',
  bosnia: 'BIH',
  brasil: 'BRA',
  'cabo-verde': 'CPV',
  canada: 'CAN',
  catar: 'QAT',
  corea: 'KOR',
  curacao: 'CUW',
  'costa-de-marfil': 'CIV',
  colombia: 'COL',
  escocia: 'SCO',
  ecuador: 'ECU',
  egipto: 'EGY',
  espana: 'ESP',
  francia: 'FRA',
  inglaterra: 'ENG',
  'estados-unidos': 'USA',
  ghana: 'GHA',
  haiti: 'HAI',
  iran: 'IRN',
  japon: 'JPN',
  jordania: 'JOR',
  marruecos: 'MAR',
  mexico: 'MEX',
  'nueva-zelandia': 'NZL',
  'paises-bajos': 'NED',
  panama: 'PAN',
  paraguay: 'PAR',
  portugal: 'POR',
  suiza: 'SUI',
  suecia: 'SWE',
  turquia: 'TUR',
  tunez: 'TUN',
  uruguay: 'URU',
  uzbekistan: 'UZB',
};

export function slugifyPlayerName(value) {
  return String(value)
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parsePhotoFilename(filename) {
  const match = /^([a-z]{3})-(.+)\.(png|jpe?g|webp)$/i.exec(String(filename).trim());
  if (!match) return null;
  return {
    fifaPrefix: match[1].toLowerCase(),
    nameSlug: match[2].toLowerCase(),
  };
}

export function buildPhotoKey(folder, filename) {
  return `${folder}/${filename}`;
}

export function resolvePlayerPhotoUrl(photoKey) {
  if (!photoKey) return '';

  const localPath = join(PLAYER_PHOTOS_DIR, photoKey);
  if (existsSync(localPath)) {
    return `/player-photos/${photoKey.split('/').map(encodeURIComponent).join('/')}`;
  }

  const base = env.playerPhotosGithubBase?.replace(/\/$/, '');
  return base ? `${base}/${photoKey}` : '';
}

/** Índice Wikipedia (photoFilename) — disponible en Heroku sin imagenes-jugadores/. */
let wikiPhotoIndex = null;

function loadWikiPhotoIndex() {
  if (wikiPhotoIndex) return wikiPhotoIndex;

  wikiPhotoIndex = new Map();
  try {
    const squadsPath = join(__dirname, '../data/wikipediaSquads.json');
    const doc = JSON.parse(readFileSync(squadsPath, 'utf8'));
    for (const team of doc.teams ?? []) {
      const folder = FIFA_TO_PHOTO_FOLDER[team.fifaCode];
      if (!folder) continue;
      const entries = (team.players ?? [])
        .filter((p) => p.photoFilename)
        .map((p) => ({
          fullName: p.fullName,
          photoKey: buildPhotoKey(folder, p.photoFilename),
        }));
      if (entries.length) wikiPhotoIndex.set(String(team.fifaCode).toUpperCase(), entries);
    }
  } catch {
    wikiPhotoIndex = new Map();
  }

  return wikiPhotoIndex;
}

/** Resuelve photoKey: Mongo → Wikipedia (transliteración) → slug del nombre. */
export function resolvePlayerPhotoKey({ photoKey, fifaCode, fullName }) {
  if (photoKey) return String(photoKey);
  if (!fifaCode || !fullName) return '';

  const code = String(fifaCode).toUpperCase();
  const roster = loadWikiPhotoIndex().get(code) ?? [];
  for (const entry of roster) {
    if (areSamePlayer({ fullName }, { fullName: entry.fullName })) {
      return entry.photoKey;
    }
  }

  const folder = FIFA_TO_PHOTO_FOLDER[code];
  const prefix = code.slice(0, 3).toLowerCase();
  if (folder) {
    for (const slug of photoSlugVariants(fullName)) {
      const key = buildPhotoKey(folder, `${prefix}-${slug}.png`);
      if (existsSync(join(PLAYER_PHOTOS_DIR, key))) return key;
    }
  }

  return buildPlayerPhotoKey(fifaCode, fullName);
}

/** Misma convención que jugadores: `{carpeta}/{fifa3}-{slug-dt}.png`. */
export function buildCoachPhotoKey(fifaCode, coachName) {
  const folder = FIFA_TO_PHOTO_FOLDER[fifaCode];
  const name = String(coachName || '').trim();
  if (!folder || !name || !fifaCode) return '';
  const prefix = String(fifaCode).slice(0, 3).toLowerCase();
  return `${folder}/${prefix}-${slugifyPlayerName(name)}.png`;
}

/** Convención de archivo en imagenes-jugadores: `{carpeta}/{fifa3}-{slug-nombre}.png`. */
export function buildPlayerPhotoKey(fifaCode, fullName) {
  return buildCoachPhotoKey(fifaCode, fullName);
}

export function mapCoachToLineupEntry(fifaCode, coachName) {
  const name = String(coachName || '').trim();
  if (!name) return null;
  const photoKey = buildCoachPhotoKey(fifaCode, name);
  const photoUrl = photoKey ? resolvePlayerPhotoUrl(photoKey) : '';
  return {
    name,
    photoUrl: photoUrl || null,
    photoKey: photoKey || null,
  };
}

/** DT en alineación: nombre oficial del plantel + caricatura (FIFA a veces trae otro nombre). */
export function resolveCoachForLineup(coachField, team) {
  const lineupName =
    (typeof coachField === 'string' ? coachField : coachField?.name)?.trim() || '';
  const officialName = team?.headCoach?.trim() || '';
  const displayName = officialName || lineupName;
  if (!displayName) return null;

  const photoName = officialName || lineupName;
  const entry = mapCoachToLineupEntry(team?.fifaCode ?? '', photoName);
  if (!entry) return null;

  return {
    ...entry,
    name: displayName,
    nationality: team?.coachNationality || null,
    teamName: team?.nameEn || null,
    teamFifaCode: team?.fifaCode || null,
  };
}

/** @param {{ fullName: string, position?: string, shirtNumber?: number | null, photoKey?: string | null, _id?: { toString(): string }, externalId?: string }} player */
export function mapPlayerToTimelineRosterEntry(player) {
  const photoKey = resolvePlayerPhotoKey({
    photoKey: player.photoKey,
    fifaCode: player.fifaCode,
    fullName: player.fullName,
  });
  const photoUrl = resolvePlayerPhotoUrl(photoKey) || player.photoUrl || null;
  return {
    mongoId: player.mongoId ?? player._id?.toString?.() ?? null,
    externalId: player.externalId ?? null,
    fullName: player.fullName,
    position: player.position,
    shirtNumber: player.shirtNumber ?? null,
    photoUrl,
  };
}

export function photoSlugVariants(fullName) {
  const primary = slugifyPlayerName(fullName);
  const variants = new Set([primary, compactNameKey(fullName)]);
  const words = primary.split('-').filter(Boolean);

  if (words.length >= 2) {
    variants.add([...words].reverse().join('-'));

    for (let i = 0; i < words.length - 1; i += 1) {
      if (words[i].length === 1) {
        const merged = [...words];
        merged[i] = merged[i] + merged[i + 1];
        merged.splice(i + 1, 1);
        variants.add(merged.join('-'));
        variants.add(merged.join(''));
      }
    }

    const first = words[0];
    if (first.length > 3) {
      variants.add(`${first.slice(0, 3)}-${words.slice(1).join('-')}`);
    }

    if (first === 'muhammed' && words.length > 2) {
      variants.add(words.slice(1).join('-'));
    }

    if (words.length >= 2) {
      variants.add(words[words.length - 1]);
      variants.add(words[0]);
    }

    for (const aliasSlug of slugTransliterationVariants(primary)) {
      variants.add(aliasSlug);
    }
  }

  return [...variants];
}

/** Copia photoKey a duplicados del mismo jugador (seed vs Football-Data, ASCII vs acentos). */
export async function propagatePlayerPhotoKeys(players) {
  if (!players.length) return { updated: 0, groups: 0 };

  const byFifa = new Map();
  for (const player of players) {
    const code = player.fifaCode;
    if (!code) continue;
    if (!byFifa.has(code)) byFifa.set(code, []);
    byFifa.get(code).push(player);
  }

  let updated = 0;
  let groups = 0;

  for (const roster of byFifa.values()) {
    const used = new Set();

    for (let i = 0; i < roster.length; i += 1) {
      if (used.has(i)) continue;

      const group = [roster[i]];
      used.add(i);

      for (let j = i + 1; j < roster.length; j += 1) {
        if (used.has(j)) continue;
        if (areSamePlayer(roster[i], roster[j])) {
          group.push(roster[j]);
          used.add(j);
        }
      }

      const photoKey = group.find((p) => p.photoKey)?.photoKey;
      if (!photoKey) continue;

      groups += 1;

      for (const player of group) {
        if (player.photoKey === photoKey) continue;
        const result = await Player.updateOne(
          { _id: player._id },
          { $set: { photoKey } }
        );
        if (result.modifiedCount > 0) updated += 1;
        player.photoKey = photoKey;
      }
    }
  }

  return { updated, groups };
}

export function matchPlayerToPhotoFile(player, parsed) {
  if (!player || !parsed) return false;
  const fifa = String(player.fifaCode || '').toLowerCase();
  if (!fifa || fifa.slice(0, 3) !== parsed.fifaPrefix) return false;
  return photoSlugVariants(player.fullName).includes(parsed.nameSlug);
}

/** Índice nombre normalizado → photoKey desde generador/*.txt (slugs turcos rotos). */
export async function loadGeneratorPhotoNameIndex(photosDir = PLAYER_PHOTOS_DIR) {
  const byName = new Map();
  const byPhotoKey = new Map();
  const txtDir = join(photosDir, 'generador');
  if (!existsSync(txtDir)) return { byName, byPhotoKey };

  const folderByPrefix = new Map(
    Object.entries(TEAM_FOLDER_TO_FIFA).map(([folder, code]) => [
      String(code).slice(0, 3).toLowerCase(),
      folder,
    ])
  );

  for (const txtFile of await readdir(txtDir)) {
    if (!txtFile.endsWith('.txt')) continue;
    const content = await readFile(join(txtDir, txtFile), 'utf8');

    for (const line of content.split('\n')) {
      const match = GENERATOR_LINE.exec(line.trim());
      if (!match) continue;

      const parsed = parsePhotoFilename(match[1]);
      if (!parsed) continue;

      const folder = folderByPrefix.get(parsed.fifaPrefix);
      const fifaCode = folder ? TEAM_FOLDER_TO_FIFA[folder] : '';
      if (!folder || !fifaCode) continue;

      const photoKey = buildPhotoKey(folder, match[1]);
      const playerName = match[2].trim();
      const key = normalizeName(playerName);
      const entry = { photoKey, fifaCode, playerName };

      byName.set(key, entry);
      byPhotoKey.set(photoKey, entry);
    }
  }

  return { byName, byPhotoKey };
}

export function matchPlayerToPhotoFileWithIndex(player, file, generatorIndex) {
  if (matchPlayerToPhotoFile(player, file.parsed)) return true;
  const entry = generatorIndex.byName.get(normalizeName(player.fullName));
  return entry?.photoKey === file.photoKey && entry.fifaCode === file.fifaCode;
}

export async function scanPlayerPhotoFiles(photosDir = PLAYER_PHOTOS_DIR) {
  const entries = [];

  if (!existsSync(photosDir)) {
    return entries;
  }

  for (const folder of Object.keys(TEAM_FOLDER_TO_FIFA)) {
    const folderPath = join(photosDir, folder);
    if (!existsSync(folderPath)) continue;

    const files = await readdir(folderPath);
    for (const filename of files) {
      const filePath = join(folderPath, filename);
      const info = await stat(filePath);
      if (!info.isFile()) continue;

      const parsed = parsePhotoFilename(filename);
      if (!parsed) continue;

      entries.push({
        folder,
        filename,
        photoKey: buildPhotoKey(folder, filename),
        fifaCode: TEAM_FOLDER_TO_FIFA[folder],
        parsed,
      });
    }
  }

  return entries;
}

export async function runPlayerPhotoSync({ photosDir = PLAYER_PHOTOS_DIR } = {}) {
  const photoFiles = await scanPlayerPhotoFiles(photosDir);
  const generatorIndex = await loadGeneratorPhotoNameIndex(photosDir);
  const players = await Player.find({
    fifaCode: { $in: [...new Set(Object.values(TEAM_FOLDER_TO_FIFA))] },
  }).lean();

  const byFifa = new Map();
  for (const player of players) {
    const code = player.fifaCode;
    if (!byFifa.has(code)) byFifa.set(code, []);
    byFifa.get(code).push(player);
  }

  let matched = 0;
  let updated = 0;
  const unmatchedFiles = [];
  const matchedKeys = new Set();

  for (const file of photoFiles) {
    const roster = byFifa.get(file.fifaCode) ?? [];
    const matches = roster.filter((p) =>
      matchPlayerToPhotoFileWithIndex(p, file, generatorIndex)
    );
    if (!matches.length) {
      unmatchedFiles.push(file.photoKey);
      continue;
    }

    matched += 1;

    for (const player of matches) {
      matchedKeys.add(player.externalId);
      const result = await Player.updateOne(
        { _id: player._id },
        { $set: { photoKey: file.photoKey } }
      );
      if (result.modifiedCount > 0) updated += 1;
    }
  }

  const cleared =
    photoFiles.length > 0 && unmatchedFiles.length > 0
      ? (
          await Player.updateMany(
            { photoKey: { $in: unmatchedFiles } },
            { $set: { photoKey: '' } }
          )
        ).modifiedCount
      : 0;

  const refreshed = await Player.find({
    fifaCode: { $in: [...new Set(Object.values(TEAM_FOLDER_TO_FIFA))] },
  }).lean();
  const propagated = await propagatePlayerPhotoKeys(refreshed);

  return {
    files: photoFiles.length,
    matched,
    updated,
    cleared: cleared,
    propagated: propagated.updated,
    propagatedGroups: propagated.groups,
    unmatchedFiles,
    playersWithPhoto: matched,
  };
}
