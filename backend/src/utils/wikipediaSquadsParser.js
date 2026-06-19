import {
  FIFA_TO_PHOTO_FOLDER,
  WIKIPEDIA_NON_TEAM_SECTIONS,
  fifaCodeForWikipediaCountry,
} from '../data/wikipediaSquadCountryMap.js';
import { slugifyPlayerName } from '../services/playerPhotoService.js';

const WIKI_LINK_RE = /\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g;

function extractPlayerTemplateBodies(section) {
  const bodies = [];
  const marker = '{{nat fs g player|';
  let searchFrom = 0;

  while (searchFrom < section.length) {
    const start = section.indexOf(marker, searchFrom);
    if (start < 0) break;

    let pos = start + marker.length;
    let depth = 1;

    while (pos < section.length) {
      if (section.startsWith('{{', pos)) {
        depth += 1;
        pos += 2;
        continue;
      }
      if (section.startsWith('}}', pos)) {
        depth -= 1;
        pos += 2;
        if (depth === 0) {
          bodies.push(section.slice(start + marker.length, pos - 2));
          break;
        }
        continue;
      }
      pos += 1;
    }

    searchFrom = pos;
  }

  return bodies;
}

function stripWikiLinks(value) {
  return String(value || '')
    .replace(WIKI_LINK_RE, '$1')
    .replace(/''+/g, '')
    .trim();
}

function parseCoachLine(line) {
  const match = String(line || '').match(/^Coach:\s*(.+)$/i);
  if (!match) return { coachName: '', coachNationality: '' };

  const links = [...match[1].matchAll(WIKI_LINK_RE)].map((m) => m[1].trim());
  if (links.length >= 2) {
    return { coachNationality: links[0], coachName: links.slice(1).join(' ') };
  }
  if (links.length === 1) {
    return { coachName: links[0], coachNationality: '' };
  }
  return { coachName: stripWikiLinks(match[1]), coachNationality: '' };
}

function parseTemplateParams(inner) {
  const parts = [];
  let current = '';
  let braceDepth = 0;
  let wikiDepth = 0;

  for (let i = 0; i < inner.length; i++) {
    if (inner.startsWith('[[', i)) {
      wikiDepth += 1;
      current += '[[';
      i += 1;
      continue;
    }
    if (inner.startsWith(']]', i) && wikiDepth > 0) {
      wikiDepth -= 1;
      current += ']]';
      i += 1;
      continue;
    }

    const ch = inner[i];
    if (ch === '{') braceDepth += 1;
    else if (ch === '}') braceDepth -= 1;

    if (ch === '|' && braceDepth === 0 && wikiDepth === 0) {
      if (current) parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);

  const params = {};
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    params[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return params;
}

function parseAgeFromTemplate(ageValue) {
  const match = String(ageValue || '').match(
    /birth date and age2\|2026\|6\|11\|(\d+)\|(\d+)\|(\d+)/
  );
  if (!match) {
    const aged = String(ageValue || '').match(/\(aged (\d+)\)/i);
    return aged ? Number(aged[1]) : null;
  }
  const [, y, m, d] = match.map(Number);
  const ref = Date.UTC(2026, 5, 11);
  const born = Date.UTC(y, m - 1, d);
  return Math.floor((ref - born) / (365.25 * 24 * 60 * 60 * 1000));
}

function parsePlayerRow(templateBody, fifaCode) {
  const params = parseTemplateParams(templateBody);
  const fullName = stripWikiLinks(params.name);
  const other = String(params.other || '');
  const isCaptain = /captain/i.test(other);
  const prefix = fifaCode.slice(0, 3).toLowerCase();
  const photoFilename = `${prefix}-${slugifyPlayerName(fullName)}.png`;

  return {
    shirtNumber: Number(params.no) || null,
    position: params.pos || 'MID',
    fullName,
    sortName: params.sortname || '',
    age: parseAgeFromTemplate(params.age),
    caps: Number(params.caps) || 0,
    goals: Number(params.goals) || 0,
    currentClub: stripWikiLinks(params.club),
    clubCountry: params.clubnat || '',
    isCaptain,
    photoFilename,
    photoKey: FIFA_TO_PHOTO_FOLDER[fifaCode]
      ? `${FIFA_TO_PHOTO_FOLDER[fifaCode]}/${photoFilename}`
      : '',
  };
}

function extractTeamSection(wikitext, countryName) {
  const header = `===${countryName}===`;
  const start = wikitext.indexOf(header);
  if (start < 0) return '';

  const after = wikitext.slice(start + header.length);
  const nextHeader = after.search(/\n===/);
  return nextHeader < 0 ? after : after.slice(0, nextHeader);
}

export function parseWikipediaSquadsWikitext(wikitext, { sourceUrl = '' } = {}) {
  const teams = [];
  const sectionNames = [...wikitext.matchAll(/^===([^=]+)===$/gm)]
    .map((m) => m[1].trim())
    .filter((name) => !name.startsWith('Group ') && !WIKIPEDIA_NON_TEAM_SECTIONS.has(name));

  for (const countryName of sectionNames) {
    const fifaCode = fifaCodeForWikipediaCountry(countryName);
    if (!fifaCode) continue;

    const section = extractTeamSection(wikitext, countryName);
    const coachLine = section.match(/^Coach:\s*.+$/m)?.[0] ?? '';
    const { coachName, coachNationality } = parseCoachLine(coachLine);

    const players = extractPlayerTemplateBodies(section).map((body) =>
      parsePlayerRow(body, fifaCode)
    );

    teams.push({
      countryName,
      fifaCode,
      photoFolder: FIFA_TO_PHOTO_FOLDER[fifaCode] || '',
      coach: coachName,
      coachNationality,
      players,
    });
  }

  return {
    source: 'wikipedia',
    sourceUrl: sourceUrl || 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads',
    fetchedAt: new Date().toISOString(),
    teamCount: teams.length,
    playerCount: teams.reduce((sum, t) => sum + t.players.length, 0),
    teams,
  };
}

export function buildGeneratorTxtForTeam(team) {
  const lines = [
    `# ${team.countryName} (${team.fifaCode})`,
    `# Fuente: Wikipedia — 2026 FIFA World Cup squads`,
    `# DT: ${team.coach}${team.coachNationality ? ` (${team.coachNationality})` : ''}`,
    '',
    '# Formato: archivo | dorsal | nombre | pos | partidos | goles',
    '',
  ];

  for (const p of team.players) {
    const cap = p.isCaptain ? ' (C)' : '';
    lines.push(
      `${p.photoFilename} | #${p.shirtNumber} | ${p.fullName}${cap} | ${p.position} | ${p.caps} pj | ${p.goals} goles`
    );
  }

  lines.push('', '# Solo nombres (pegar en generador):', '');
  for (const p of team.players) {
    lines.push(p.fullName);
  }

  return `${lines.join('\n')}\n`;
}

export function squadsToSeedPlayers(squadsDoc, teamsByCode = new Map()) {
  const players = [];
  for (const team of squadsDoc.teams) {
    const dbTeam = teamsByCode.get(team.fifaCode);
    for (const p of team.players) {
      players.push({
        externalId: `${team.fifaCode}-${slugifyPlayerName(p.fullName)}`,
        fullName: p.fullName,
        fifaCode: team.fifaCode,
        teamExternalId: dbTeam?.externalId || '',
        teamName: dbTeam?.nameEn || team.countryName,
        position: p.position,
        currentClub: p.currentClub,
        age: p.age,
        shirtNumber: p.shirtNumber,
        nationality: team.fifaCode,
        isCaptain: p.isCaptain,
        internationalCaps: p.caps,
        internationalGoals: p.goals,
        healthStatus: 'available',
        source: 'wikipedia-squads',
        dataSources: { structural: 'wikipedia-squads', injuries: '' },
      });
    }
  }
  return players;
}
