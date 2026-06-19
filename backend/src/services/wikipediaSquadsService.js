import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { SyncMeta } from '../models/SyncMeta.js';
import { fetchWikiWikitext } from '../utils/wikiClient.js';
import {
  buildGeneratorTxtForTeam,
  parseWikipediaSquadsWikitext,
  squadsToSeedPlayers,
} from '../utils/wikipediaSquadsParser.js';
import { slugifyPlayerName } from './playerPhotoService.js';
import { enrichClubFields } from './clubMetaService.js';
import { notifyPlayersUpdated } from './websocketService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const REPO_ROOT = join(__dirname, '../../..');
export const GENERATOR_TXT_DIR = join(REPO_ROOT, 'imagenes-jugadores', 'generador');
export const WIKIPEDIA_SQUADS_JSON = join(DATA_DIR, 'wikipediaSquads.json');

const WIKIPEDIA_PAGE = '2026_FIFA_World_Cup_squads';

export async function fetchWikipediaSquadsWikitext({ fetchImpl = fetch } = {}) {
  const wikitext = await fetchWikiWikitext(WIKIPEDIA_PAGE, { fetchImpl });
  if (!wikitext) throw new Error('No se pudo obtener wikitext de Wikipedia');
  return wikitext;
}

export async function loadWikipediaSquadsFromApi({ fetchImpl = fetch } = {}) {
  const wikitext = await fetchWikipediaSquadsWikitext({ fetchImpl });
  return parseWikipediaSquadsWikitext(wikitext, {
    sourceUrl: `https://en.wikipedia.org/wiki/${WIKIPEDIA_PAGE}`,
  });
}

export async function writeWikipediaSquadsArtifacts(squadsDoc) {
  await mkdir(GENERATOR_TXT_DIR, { recursive: true });

  await writeFile(WIKIPEDIA_SQUADS_JSON, JSON.stringify(squadsDoc, null, 2));

  for (const team of squadsDoc.teams) {
    const slug = team.photoFolder || team.fifaCode.toLowerCase();
    const txtPath = join(GENERATOR_TXT_DIR, `${slug}.txt`);
    await writeFile(txtPath, buildGeneratorTxtForTeam(team));
  }

  return {
    jsonPath: WIKIPEDIA_SQUADS_JSON,
    txtDir: GENERATOR_TXT_DIR,
    txtCount: squadsDoc.teams.length,
  };
}

function buildPerformanceSnapshot(player) {
  return {
    seasonYear: 2026,
    fetchedAt: new Date(),
    source: 'wikipedia-squads',
    nationalTeam: {
      matches: player.caps ?? 0,
      goals: player.goals ?? 0,
      starts: 0,
      minutes: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    },
    club: {
      matches: 0,
      goals: 0,
      starts: 0,
      minutes: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    },
    recentMatches: [],
  };
}

export async function syncWikipediaSquadsToDatabase(squadsDoc) {
  const teamsByCode = new Map(
    (await Team.find({ fifaCode: { $exists: true } }).lean())
      .filter((t) => t.fifaCode)
      .map((t) => [t.fifaCode.toUpperCase(), t])
  );

  let teamsUpdated = 0;
  let playersUpdated = 0;

  for (const squad of squadsDoc.teams) {
    const dbTeam = teamsByCode.get(squad.fifaCode);
    if (!dbTeam) continue;

    await Team.findOneAndUpdate(
      { externalId: dbTeam.externalId },
      {
        $set: {
          headCoach: squad.coach || '',
          coachNationality: squad.coachNationality || '',
          'raw.wikipediaSquad': {
            coach: squad.coach,
            coachNationality: squad.coachNationality,
            playerCount: squad.players.length,
            syncedAt: new Date(),
          },
        },
      }
    );
    teamsUpdated += 1;

    for (const p of squad.players) {
      const externalId = `${squad.fifaCode}-${slugifyPlayerName(p.fullName)}`;
      const base = {
        externalId,
        fullName: p.fullName,
        teamExternalId: dbTeam.externalId,
        fifaCode: squad.fifaCode,
        position: p.position,
        currentClub: p.currentClub || '',
        age: p.age,
        shirtNumber: p.shirtNumber,
        isCaptain: p.isCaptain,
        nationality: squad.fifaCode,
        healthStatus: 'available',
        performanceSnapshot: buildPerformanceSnapshot(p),
        dataSources: { structural: 'wikipedia-squads', injuries: '' },
      };
      const doc = { ...base, ...enrichClubFields(base) };

      await Player.findOneAndUpdate(
        { externalId },
        { $set: doc },
        { upsert: true, new: true }
      );
      playersUpdated += 1;
    }
  }

  await SyncMeta.findOneAndUpdate(
    { key: 'wikipedia-squads' },
    {
      $set: {
        lastSyncAt: new Date(),
        teamCount: squadsDoc.teamCount,
        playerCount: squadsDoc.playerCount,
        teamsUpdated,
        playersUpdated,
        sourceUrl: squadsDoc.sourceUrl,
      },
    },
    { upsert: true }
  );

  notifyPlayersUpdated();
  return { teamsUpdated, playersUpdated, seedPlayers: squadsToSeedPlayers(squadsDoc, teamsByCode) };
}

export async function getWikipediaSquadsSyncMeta() {
  return SyncMeta.findOne({ key: 'wikipedia-squads' }).lean();
}
