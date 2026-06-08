// States catalogue for Mexico
export const MEXICAN_STATES = [
  { code: 'AS', name: 'Aguascalientes' },
  { code: 'BC', name: 'Baja California' },
  { code: 'BS', name: 'Baja California Sur' },
  { code: 'CC', name: 'Campeche' },
  { code: 'CL', name: 'Coahuila' },
  { code: 'CM', name: 'Colima' },
  { code: 'CS', name: 'Chiapas' },
  { code: 'CH', name: 'Chihuahua' },
  { code: 'DF', name: 'Ciudad de México (DF)' },
  { code: 'DG', name: 'Durango' },
  { code: 'GT', name: 'Guanajuato' },
  { code: 'GR', name: 'Guerrero' },
  { code: 'HG', name: 'Hidalgo' },
  { code: 'JC', name: 'Jalisco' },
  { code: 'MC', name: 'Estado de México' },
  { code: 'MN', name: 'Michoacán' },
  { code: 'MS', name: 'Morelos' },
  { code: 'NT', name: 'Nayarit' },
  { code: 'NL', name: 'Nuevo León' },
  { code: 'OC', name: 'Oaxaca' },
  { code: 'PL', name: 'Puebla' },
  { code: 'QT', name: 'Querétaro' },
  { code: 'QR', name: 'Quintana Roo' },
  { code: 'SP', name: 'San Luis Potosí' },
  { code: 'SL', name: 'Sinaloa' },
  { code: 'SR', name: 'Sonora' },
  { code: 'TC', name: 'Tabasco' },
  { code: 'TS', name: 'Tamaulipas' },
  { code: 'TL', name: 'Tlaxcala' },
  { code: 'VZ', name: 'Veracruz' },
  { code: 'YN', name: 'Yucatán' },
  { code: 'ZS', name: 'Zacatecas' },
  { code: 'NE', name: 'Nacido en el Extranjero' }
];

const FORBIDDEN_WORDS = [
  'BACA', 'BAKA', 'BUEI', 'BUEY', 'CACA', 'CACO', 'CAGA', 'CAGO', 'CAKA', 'CAKO', 
  'COGE', 'COGI', 'COJA', 'COJE', 'COJI', 'COJO', 'COLA', 'CULO', 'FALO', 'FEDA', 
  'FETO', 'GETA', 'GUEI', 'GUEY', 'JETA', 'JOTO', 'KACA', 'KACO', 'KAGA', 'KAGO', 
  'KAKA', 'KAKO', 'KOGE', 'KOGI', 'KOJA', 'KOJE', 'KOJI', 'KOJO', 'KOLA', 'KULO', 
  'LILO', 'LOCA', 'LOCO', 'LOKA', 'LOKO', 'MAME', 'MAMO', 'MEAR', 'MEAS', 'MEON', 
  'MIAR', 'MION', 'MOCO', 'MOKO', 'MULA', 'MULO', 'NACA', 'NACO', 'PEDA', 'PEDO', 
  'PENE', 'PIPI', 'PITO', 'POPO', 'PUTA', 'PUTO', 'QULO', 'RATA', 'ROBA', 'ROBE', 
  'ROBO', 'RUIN', 'SENO', 'TETA', 'VACA', 'VAGA', 'VAGO', 'VAKA', 'VUEI', 'VUEY'
];

function cleanString(str: string): string {
  if (!str) return '';
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^A-ZÑ]/g, '') // keep only letters
    .trim();
}

function getFirstVowel(str: string): string {
  const clean = cleanString(str).slice(1); // skip first letter
  const match = clean.match(/[AEIOU]/);
  return match ? match[0] : 'X';
}

function getFirstConsonant(str: string): string {
  const clean = cleanString(str).slice(1); // skip first letter
  const match = clean.match(/[BCDFGHJKLMNPQRSTVWXYZ]/);
  return match ? match[0] : 'X';
}

function filterPrepositions(str: string): string {
  // Removes particles like "DE", "DEL", "LA", "LAS", "DE LA", "Y", etc.
  const particles = [
    /^DA\s+/, /^DAS\s+/, /^DE\s+/, /^DEL\s+/, /^DER\s+/, /^DI\s+/, /^DIE\s+/, 
    /^DD\s+/, /^EL\s+/, /^LA\s+/, /^LOS\s+/, /^LAS\s+/, /^LE\s+/, /^LES\s+/, 
    /^MAC\s+/, /^MC\s+/, /^VAN\s+/, /^VON\s+/, /^Y\s+/
  ];
  let result = str.toUpperCase().trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of particles) {
      if (p.test(result)) {
        result = result.replace(p, '');
        changed = true;
      }
    }
  }
  return result;
}

function filterName(name: string): string {
  // If first name is MARÍA or JOSÉ (or abbreviations) and there's a second name, use the second name.
  const clean = name.toUpperCase().trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const firstWord = words[0];
    const normalFirst = firstWord.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (
      ['MARIA', 'MA', 'MA.', 'JOSE', 'J', 'J.'].includes(normalFirst)
    ) {
      // Use second name, but make sure to clean prepositions if any
      return words.slice(1).join(' ');
    }
  }
  return clean;
}

export function calculateCurpBase(params: {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  fechaNacimiento: string; // YYYY-MM-DD
  genero: 'H' | 'M';
  estadoNacimiento: string; // 2-letter state code
}): string {
  let name = filterPrepositions(filterName(params.nombre));
  let pSurname = filterPrepositions(params.apellidoPaterno);
  let mSurname = params.apellidoMaterno ? filterPrepositions(params.apellidoMaterno) : '';

  const cleanName = cleanString(name);
  const cleanPSurname = cleanString(pSurname);
  const cleanMSurname = cleanString(mSurname);

  // Position 1: First letter of father's last name
  let pos1 = cleanPSurname.charAt(0) || 'X';
  if (pos1 === 'Ñ') pos1 = 'X';

  // Position 2: First internal vowel of father's last name
  let pos2 = getFirstVowel(cleanPSurname);

  // Position 3: First letter of mother's last name
  let pos3 = cleanMSurname.charAt(0) || 'X';
  if (pos3 === 'Ñ') pos3 = 'X';

  // Position 4: First letter of first name
  let pos4 = cleanName.charAt(0) || 'X';
  if (pos4 === 'Ñ') pos4 = 'X';

  let base4 = `${pos1}${pos2}${pos3}${pos4}`;
  
  // Replace if inappropriate
  if (FORBIDDEN_WORDS.includes(base4)) {
    base4 = `${base4.charAt(0)}X${base4.slice(2)}`;
  }

  // Date of birth (YYMMDD)
  // format is YYYY-MM-DD
  const dateParts = params.fechaNacimiento.split('-');
  let dob = '000000';
  if (dateParts.length === 3) {
    const year = dateParts[0].slice(-2);
    const month = dateParts[1];
    const day = dateParts[2];
    dob = `${year}${month}${day}`;
  }

  // Gender
  const gender = params.genero === 'H' || params.genero === 'M' ? params.genero : 'X';

  // State code
  const state = params.estadoNacimiento.toUpperCase().slice(0, 2) || 'NE';

  // First internal consonants
  let c1 = getFirstConsonant(cleanPSurname);
  if (c1 === 'Ñ') c1 = 'X';
  let c2 = cleanMSurname ? getFirstConsonant(cleanMSurname) : 'X';
  if (c2 === 'Ñ') c2 = 'X';
  let c3 = getFirstConsonant(cleanName);
  if (c3 === 'Ñ') c3 = 'X';

  return `${base4}${dob}${gender}${state}${c1}${c2}${c3}`;
}
