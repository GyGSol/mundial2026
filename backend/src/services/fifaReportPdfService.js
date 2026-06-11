import pdf from 'pdf-parse/lib/pdf-parse.js';
import { env } from '../config/env.js';

function buildReportUrl(matchNumber) {
  const reportId = env.fifaReportIdBase + Number(matchNumber);
  return `https://fdp.fifa.org/assetspublic/${env.fifaReportAssetPrefix}/r${reportId}/pdf/FullTimeMatchReport-English.pdf`;
}

function parseTeamStatsBlock(text, teamName) {
  const escaped = teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const possession = text.match(
    new RegExp(`${escaped}[\\s\\S]{0,400}?(\\d+)%\\s+Ball possession\\s+(\\d+)%`, 'i')
  );
  const fouls = text.match(
    new RegExp(`${escaped}[\\s\\S]{0,400}?(\\d+)\\s+Fouls Against\\s+(\\d+)`, 'i')
  );
  const yellowCards = text.match(
    new RegExp(`${escaped}[\\s\\S]{0,400}?(\\d+)\\s+Yellow cards\\s+(\\d+)`, 'i')
  );
  const redCards = text.match(
    new RegExp(`${escaped}[\\s\\S]{0,600}?(\\d+)\\s+Direct red cards\\s+(\\d+)`, 'i')
  );

  if (!possession && !fouls && !yellowCards && !redCards) return null;

  return {
    possession: possession ? Number(possession[1]) : null,
    foulsAgainst: fouls ? Number(fouls[1]) : null,
    yellowCards: yellowCards ? Number(yellowCards[1]) : null,
    redCards: redCards ? Number(redCards[1]) : null,
  };
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

    const home = parseTeamStatsBlock(text, homeName);
    const away = parseTeamStatsBlock(text, awayName);
    if (!home && !away) return null;

    return {
      home: home ?? {},
      away: away ?? {},
      pdfUrl,
      syncedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
