import pdf from 'pdf-parse/lib/pdf-parse.js';
import { env } from '../config/env.js';

export const FIFA_REPORT_STATS_VERSION = 2;

function buildReportUrl(matchNumber) {
  const reportId = env.fifaReportIdBase + Number(matchNumber);
  return `https://fdp.fifa.org/assetspublic/${env.fifaReportAssetPrefix}/r${reportId}/pdf/FullTimeMatchReport-English.pdf`;
}

function parseStatisticsSection(text) {
  const sectionMatch = text.match(
    /Statistics\s*([\s\S]*?)(?=\n(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|\n#POS|\nGreen\s+-|$)/i
  );
  return sectionMatch?.[1]?.trim() ?? null;
}

function assignPair(sideStats, key, match) {
  if (!match) return;
  sideStats.home[key] = Number(match[1]);
  sideStats.away[key] = Number(match[2]);
}

/**
 * Parsea el bloque "Statistics" del reporte FIFA (formato home | label | away).
 * @param {string} text
 */
export function parseMatchStatisticsFromText(text) {
  const section = parseStatisticsSection(text);
  if (!section) return null;

  const sideStats = { home: {}, away: {} };

  const possession = section.match(/(\d+)%\s*Ball possession\s*(\d+)%/i);
  if (possession) {
    sideStats.home.possession = Number(possession[1]);
    sideStats.away.possession = Number(possession[2]);
  }

  const attempts = section.match(
    /(\d+)\s*\/\s*(\d+)\s*Attempts at Goal \(Total\/On Target\)\s*(\d+)\s*\/\s*(\d+)/i
  );
  if (attempts) {
    sideStats.home.attemptsTotal = Number(attempts[1]);
    sideStats.home.attemptsOnTarget = Number(attempts[2]);
    sideStats.away.attemptsTotal = Number(attempts[3]);
    sideStats.away.attemptsOnTarget = Number(attempts[4]);
  }

  const pairPatterns = [
    ['attemptsBlocked', /(\d+)\s*Attempts at Goal blocked\s*(\d+)/i],
    ['foulsAgainst', /(\d+)\s*Fouls Against\s*(\d+)/i],
    ['corners', /(\d+)\s*Corners\s*(\d+)/i],
    ['directFreeKicks', /(\d+)\s*Direct free kicks\s*(\d+)/i],
    ['indirectFreeKicks', /(\d+)\s*Indirect free kicks\s*(\d+)/i],
    ['offsides', /(\d+)\s*Offsides\s*(\d+)/i],
    ['ownGoals', /(\d+)\s*Own goals\s*(\d+)/i],
    ['yellowCards', /(\d+)\s*Yellow cards\s*(\d+)/i],
    ['redCardsSecondYellow', /(\d+)\s*Red Cards for second caution\s*(\d+)/i],
    ['directRedCards', /(\d+)\s*Direct red cards\s*(\d+)/i],
  ];

  for (const [key, pattern] of pairPatterns) {
    assignPair(sideStats, key, section.match(pattern));
  }

  const penalties = section.match(
    /(\d+)\s*\/\s*(\d+)\s*Penalties \(total\/scored\)\s*(\d+)\s*\/\s*(\d+)/i
  );
  if (penalties) {
    sideStats.home.penaltiesTotal = Number(penalties[1]);
    sideStats.home.penaltiesScored = Number(penalties[2]);
    sideStats.away.penaltiesTotal = Number(penalties[3]);
    sideStats.away.penaltiesScored = Number(penalties[4]);
  }

  if (!Object.keys(sideStats.home).length && !Object.keys(sideStats.away).length) {
    return null;
  }

  return sideStats;
}

function validateReportText(text, { homeName, awayName, matchNumber }) {
  const normalized = String(text ?? '');
  if (!normalized.includes(String(homeName)) || !normalized.includes(String(awayName))) {
    return false;
  }
  if (matchNumber && !normalized.includes(`#${matchNumber}`)) {
    return false;
  }
  return true;
}

function parseAttendance(text) {
  const match = String(text ?? '').match(/Attendance:\s*([\d,]+)/i);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

export async function fetchFifaReportStats({ matchNumber, homeName, awayName }) {
  const pdfUrl = buildReportUrl(matchNumber);

  try {
    const res = await fetch(pdfUrl);
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const parsed = await pdf(buffer);
    const text = parsed?.text ?? '';

    if (!validateReportText(text, { homeName, awayName, matchNumber })) {
      return null;
    }

    const parsedStats = parseMatchStatisticsFromText(text);
    if (!parsedStats) return null;

    return {
      home: parsedStats.home,
      away: parsedStats.away,
      attendance: parseAttendance(text),
      pdfUrl,
      statsVersion: FIFA_REPORT_STATS_VERSION,
      syncedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
