/**
 * Televisación confirmada en Argentina (jun 2026).
 * DSports: 104 partidos. Resto según acuerdos publicados por cada señal.
 */

export const BROADCASTERS = {
  'tv-publica': {
    id: 'tv-publica',
    name: 'TV Pública',
    logo: '/broadcasters/tv-publica.svg',
  },
  telefe: {
    id: 'telefe',
    name: 'Telefe',
    logo: '/broadcasters/telefe.svg',
  },
  tyc: {
    id: 'tyc',
    name: 'TyC Sports',
    logo: '/broadcasters/tyc.svg',
  },
  disney: {
    id: 'disney',
    name: 'Disney+',
    logo: '/broadcasters/disney.svg',
  },
  dsports: {
    id: 'dsports',
    name: 'DSports',
    logo: '/broadcasters/dsports.svg',
  },
};

/** 22 partidos de fase de grupos confirmados en Telefe / Disney+ Premium. */
const TELEFE_GROUP = new Set([
  '1',
  '4',
  '6',
  '10',
  '11',
  '15',
  '19',
  '22',
  '26',
  '30',
  '34',
  '37',
  '39',
  '41',
  '45',
  '46',
  '51',
  '56',
  '60',
  '61',
  '64',
  '72',
]);

/** 39 partidos de grupos + final confirmados en TyC (lista oficial). */
const TYC_GROUP = new Set([
  '2',
  '4',
  '7',
  '8',
  '10',
  '12',
  '14',
  '15',
  '16',
  '18',
  '19',
  '20',
  '22',
  '23',
  '24',
  '25',
  '28',
  '29',
  '31',
  '33',
  '34',
  '37',
  '40',
  '41',
  '43',
  '45',
  '47',
  '49',
  '52',
  '54',
  '56',
  '57',
  '59',
  '61',
  '64',
  '65',
  '67',
  '70',
  '72',
]);

/**
 * TyC confirmó 6 dieciseisavos, 4 octavos, 1 cuartos y 1 semifinal sin números de partido.
 * Se asignan los cruces de mayor perfil mediático hasta publicar la grilla completa.
 */
const TYC_KNOCKOUT = new Set(['74', '76', '77', '79', '89', '90', '91', '92', '97', '101', '104']);

/** Disney+ Premium: 22 grupos + 2 dieciseisavos + 2 octavos + 1 cuartos + 2 semis + final. */
const DISNEY_KNOCKOUT = new Set(['74', '76', '89', '90', '97', '101', '102', '104']);

const DISPLAY_ORDER = ['tv-publica', 'telefe', 'tyc', 'disney', 'dsports'];

function isArgentinaTeam(team) {
  if (!team) return false;
  return (
    team.fifaCode === 'ARG' ||
    String(team.nameEn || '')
      .toLowerCase()
      .includes('argentina')
  );
}

function matchInvolvesArgentina({ homeTeam, awayTeam } = {}) {
  return isArgentinaTeam(homeTeam) || isArgentinaTeam(awayTeam);
}

export function getBroadcastersForMatch(externalId, options = {}) {
  if (!externalId || String(externalId).startsWith('sim-')) return [];

  const id = String(externalId);
  const ids = new Set(['dsports']);
  const argentina = matchInvolvesArgentina(options);

  if (argentina) {
    ids.add('tv-publica');
    ids.add('telefe');
    ids.add('tyc');
    ids.add('disney');
  } else {
    if (TELEFE_GROUP.has(id)) ids.add('telefe');
    if (TYC_GROUP.has(id) || TYC_KNOCKOUT.has(id)) ids.add('tyc');
    if (TELEFE_GROUP.has(id) || DISNEY_KNOCKOUT.has(id)) ids.add('disney');
  }

  return DISPLAY_ORDER.filter((key) => ids.has(key)).map((key) => BROADCASTERS[key]);
}
