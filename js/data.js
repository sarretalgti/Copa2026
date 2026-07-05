// ============================================================
// Base de dados — Álbum Panini Copa do Mundo FIFA 2026
// 980 figurinhas: seção especial FWC (20) + 48 seleções x 20
// Numeração oficial: por seleção, com prefixo do país (ex: BRA 1..BRA 20)
// ============================================================

const GROUPS = {
  A: ['MEX', 'RSA', 'KOR', 'CZE'],
  B: ['CAN', 'SUI', 'QAT', 'BIH'],
  C: ['BRA', 'MAR', 'SCO', 'HAI'],
  D: ['USA', 'PAR', 'AUS', 'TUR'],
  E: ['GER', 'CUW', 'CIV', 'ECU'],
  F: ['NED', 'JPN', 'SWE', 'TUN'],
  G: ['BEL', 'EGY', 'IRN', 'NZL'],
  H: ['ESP', 'CPV', 'KSA', 'URU'],
  I: ['FRA', 'NOR', 'SEN', 'IRQ'],
  J: ['ARG', 'AUT', 'ALG', 'JOR'],
  K: ['POR', 'COD', 'UZB', 'COL'],
  L: ['ENG', 'CRO', 'GHA', 'PAN'],
};

const TEAMS = {
  MEX: { name: 'México', flag: '🇲🇽' },
  RSA: { name: 'África do Sul', flag: '🇿🇦' },
  KOR: { name: 'Coreia do Sul', flag: '🇰🇷' },
  CZE: { name: 'Tchéquia', flag: '🇨🇿' },
  CAN: { name: 'Canadá', flag: '🇨🇦' },
  SUI: { name: 'Suíça', flag: '🇨🇭' },
  QAT: { name: 'Catar', flag: '🇶🇦' },
  BIH: { name: 'Bósnia e Herzegovina', flag: '🇧🇦' },
  BRA: { name: 'Brasil', flag: '🇧🇷' },
  MAR: { name: 'Marrocos', flag: '🇲🇦' },
  SCO: { name: 'Escócia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  HAI: { name: 'Haiti', flag: '🇭🇹' },
  USA: { name: 'Estados Unidos', flag: '🇺🇸' },
  PAR: { name: 'Paraguai', flag: '🇵🇾' },
  AUS: { name: 'Austrália', flag: '🇦🇺' },
  TUR: { name: 'Turquia', flag: '🇹🇷' },
  GER: { name: 'Alemanha', flag: '🇩🇪' },
  CUW: { name: 'Curaçao', flag: '🇨🇼' },
  CIV: { name: 'Costa do Marfim', flag: '🇨🇮' },
  ECU: { name: 'Equador', flag: '🇪🇨' },
  NED: { name: 'Holanda', flag: '🇳🇱' },
  JPN: { name: 'Japão', flag: '🇯🇵' },
  SWE: { name: 'Suécia', flag: '🇸🇪' },
  TUN: { name: 'Tunísia', flag: '🇹🇳' },
  BEL: { name: 'Bélgica', flag: '🇧🇪' },
  EGY: { name: 'Egito', flag: '🇪🇬' },
  IRN: { name: 'Irã', flag: '🇮🇷' },
  NZL: { name: 'Nova Zelândia', flag: '🇳🇿' },
  ESP: { name: 'Espanha', flag: '🇪🇸' },
  CPV: { name: 'Cabo Verde', flag: '🇨🇻' },
  KSA: { name: 'Arábia Saudita', flag: '🇸🇦' },
  URU: { name: 'Uruguai', flag: '🇺🇾' },
  FRA: { name: 'França', flag: '🇫🇷' },
  NOR: { name: 'Noruega', flag: '🇳🇴' },
  SEN: { name: 'Senegal', flag: '🇸🇳' },
  IRQ: { name: 'Iraque', flag: '🇮🇶' },
  ARG: { name: 'Argentina', flag: '🇦🇷' },
  AUT: { name: 'Áustria', flag: '🇦🇹' },
  ALG: { name: 'Argélia', flag: '🇩🇿' },
  JOR: { name: 'Jordânia', flag: '🇯🇴' },
  POR: { name: 'Portugal', flag: '🇵🇹' },
  COD: { name: 'RD Congo', flag: '🇨🇩' },
  UZB: { name: 'Uzbequistão', flag: '🇺🇿' },
  COL: { name: 'Colômbia', flag: '🇨🇴' },
  ENG: { name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  CRO: { name: 'Croácia', flag: '🇭🇷' },
  GHA: { name: 'Gana', flag: '🇬🇭' },
  PAN: { name: 'Panamá', flag: '🇵🇦' },
};

const STICKERS_PER_TEAM = 20;

// Seção especial de abertura do álbum (troféu, mascotes e os 16 estádios-sede)
const FWC_LABELS = [
  'Troféu da Copa do Mundo',
  'Mascote Maple (Canadá)',
  'Mascote Zayu (México)',
  'Mascote Clutch (EUA)',
  'Estádio Azteca — Cidade do México',
  'Estádio Akron — Guadalajara',
  'Estádio BBVA — Monterrey',
  'BMO Field — Toronto',
  'BC Place — Vancouver',
  'MetLife Stadium — Nova York/NJ',
  'SoFi Stadium — Los Angeles',
  'AT&T Stadium — Dallas',
  'NRG Stadium — Houston',
  'Mercedes-Benz Stadium — Atlanta',
  'Hard Rock Stadium — Miami',
  'Lincoln Financial Field — Filadélfia',
  "Levi's Stadium — São Francisco",
  'Lumen Field — Seattle',
  'Arrowhead Stadium — Kansas City',
  'Gillette Stadium — Boston',
];

function defaultLabel(teamCode, num) {
  if (teamCode === 'FWC') return FWC_LABELS[num - 1] || 'Especial';
  if (num === 1) return 'Escudo';
  if (num === 2) return 'Foto da Seleção';
  return 'Jogador';
}

// Lista de seções na ordem do álbum: FWC primeiro, depois grupos A-L
function buildSections() {
  const sections = [
    { code: 'FWC', name: 'Copa do Mundo 2026', flag: '🏆', group: null, count: STICKERS_PER_TEAM },
  ];
  for (const [group, codes] of Object.entries(GROUPS)) {
    for (const code of codes) {
      sections.push({
        code,
        name: TEAMS[code].name,
        flag: TEAMS[code].flag,
        group,
        count: STICKERS_PER_TEAM,
      });
    }
  }
  return sections;
}

const SECTIONS = buildSections();
const TOTAL_STICKERS = SECTIONS.reduce((sum, s) => sum + s.count, 0); // 980

// Mapeia nomes de times vindos da API de jogos (em inglês) para nossos códigos
const API_NAME_TO_CODE = {
  'mexico': 'MEX', 'south africa': 'RSA', 'south korea': 'KOR', 'korea republic': 'KOR',
  'czechia': 'CZE', 'czech republic': 'CZE', 'canada': 'CAN', 'switzerland': 'SUI',
  'qatar': 'QAT', 'bosnia and herzegovina': 'BIH', 'bosnia-herzegovina': 'BIH', 'bosnia': 'BIH',
  'brazil': 'BRA', 'morocco': 'MAR', 'scotland': 'SCO', 'haiti': 'HAI',
  'united states': 'USA', 'usa': 'USA', 'paraguay': 'PAR', 'australia': 'AUS',
  'turkey': 'TUR', 'türkiye': 'TUR', 'turkiye': 'TUR', 'germany': 'GER',
  'curacao': 'CUW', 'curaçao': 'CUW', 'ivory coast': 'CIV', "cote d'ivoire": 'CIV', 'côte d\'ivoire': 'CIV',
  'ecuador': 'ECU', 'netherlands': 'NED', 'japan': 'JPN', 'sweden': 'SWE', 'tunisia': 'TUN',
  'belgium': 'BEL', 'egypt': 'EGY', 'iran': 'IRN', 'ir iran': 'IRN', 'new zealand': 'NZL',
  'spain': 'ESP', 'cape verde': 'CPV', 'cabo verde': 'CPV', 'saudi arabia': 'KSA',
  'uruguay': 'URU', 'france': 'FRA', 'norway': 'NOR', 'senegal': 'SEN', 'iraq': 'IRQ',
  'argentina': 'ARG', 'austria': 'AUT', 'algeria': 'ALG', 'jordan': 'JOR',
  'portugal': 'POR', 'dr congo': 'COD', 'congo dr': 'COD', 'democratic republic of the congo': 'COD',
  'uzbekistan': 'UZB', 'colombia': 'COL', 'england': 'ENG', 'croatia': 'CRO',
  'ghana': 'GHA', 'panama': 'PAN',
};

function apiTeamToCode(name) {
  if (!name) return null;
  return API_NAME_TO_CODE[name.trim().toLowerCase()] || null;
}
