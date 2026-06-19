import { existsSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Player } from '../models/Player.js';
import { env } from '../config/env.js';
import { FIFA_TO_PHOTO_FOLDER } from '../data/wikipediaSquadCountryMap.js';
import { compactNameKey } from '../utils/playerNameMatch.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');
export const PLAYER_PHOTOS_DIR = join(REPO_ROOT, 'imagenes-jugadores');

/** Carpetas en imagenes-jugadores → código FIFA */
export const TEAM_FOLDER_TO_FIFA = {
  argelia: 'ALG',
  argentina: 'ARG',
  australia: 'AUS',
  austria: 'AUT',
  bosnia: 'BIH',
  brasil: 'BRA',
  'cabo-verde': 'CPV',
  canada: 'CAN',
  catar: 'QAT',
  corea: 'KOR',
  'costa-de-marfil': 'CIV',
  escocia: 'SCO',
  espana: 'ESP',
  'estados-unidos': 'USA',
  ghana: 'GHA',
  haiti: 'HAI',
  iran: 'IRN',
  japon: 'JPN',
  jordania: 'JOR',
  marruecos: 'MAR',
  mexico: 'MEX',
  'paises-bajos': 'NED',
  panama: 'PAN',
  portugal: 'POR',
  uruguay: 'URU',
  uzbekistan: 'UZB',
};

export function slugifyPlayerName(value) {
  return String(value)
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

/** Misma convención que jugadores: `{carpeta}/{fifa3}-{slug-dt}.png`. */
export function buildCoachPhotoKey(fifaCode, coachName) {
  const folder = FIFA_TO_PHOTO_FOLDER[fifaCode];
  const name = String(coachName || '').trim();
  if (!folder || !name || !fifaCode) return '';
  const prefix = String(fifaCode).slice(0, 3).toLowerCase();
  return `${folder}/${prefix}-${slugifyPlayerName(name)}.png`;
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

/** @param {{ fullName: string, position?: string, shirtNumber?: number | null, photoKey?: string | null, _id?: { toString(): string }, externalId?: string }} player */
export function mapPlayerToTimelineRosterEntry(player) {
  return {
    mongoId: player._id?.toString?.() ?? null,
    externalId: player.externalId ?? null,
    fullName: player.fullName,
    position: player.position,
    shirtNumber: player.shirtNumber ?? null,
    photoUrl: resolvePlayerPhotoUrl(player.photoKey) || null,
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
  }

  return [...variants];
}

export function matchPlayerToPhotoFile(player, parsed) {
  if (!player || !parsed) return false;
  const fifa = String(player.fifaCode || '').toLowerCase();
  if (!fifa || fifa.slice(0, 3) !== parsed.fifaPrefix) return false;
  return photoSlugVariants(player.fullName).includes(parsed.nameSlug);
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
    const matches = roster.filter((p) => matchPlayerToPhotoFile(p, file.parsed));
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
    photoFiles.length > 0
      ? (
          await Player.updateMany(
            {
              fifaCode: { $in: [...Object.values(TEAM_FOLDER_TO_FIFA)] },
              externalId: { $nin: [...matchedKeys] },
              photoKey: { $ne: '' },
            },
            { $set: { photoKey: '' } }
          )
        ).modifiedCount
      : 0;

  return {
    files: photoFiles.length,
    matched,
    updated,
    cleared: cleared,
    unmatchedFiles,
    playersWithPhoto: matched,
  };
}
