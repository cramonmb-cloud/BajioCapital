import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calcula el sábado correspondiente a la semana operativa de una fecha dada,
 * forzando el cálculo al horario de la Ciudad de México.
 * La semana cambia a las 00:00 del sábado (hora CDMX).
 */
export function getSaturdayOfWeek(dateInput: Date = new Date()): Date {
  // 1. Obtener la fecha en formato YYYY-MM-DD en la zona horaria de México
  const mexicoString = dateInput.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const [year, month, day] = mexicoString.split('-').map(Number);
  
  // 2. Crear una fecha base a medianoche
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  
  // 3. Lógica: Sábado es el día 0 de la nueva semana
  // Sun(0) -> -1, Mon(1) -> -2, ..., Fri(5) -> -6, Sat(6) -> -0
  const dayOfWeek = d.getDay(); 
  const diff = (dayOfWeek + 1) % 7;
  
  const saturday = new Date(d);
  saturday.setDate(d.getDate() - diff);
  saturday.setHours(0, 0, 0, 0);
  
  return saturday;
}

/**
 * Obtiene la fecha actual normalizada al horario de la Ciudad de México
 * para cálculos consistentes en el servidor.
 */
export function getMexicoNow(): Date {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(new Date());
  
  const map: any = {};
  parts.forEach(p => map[p.type] = p.value);
  
  return new Date(
    parseInt(map.year),
    parseInt(map.month) - 1,
    parseInt(map.day),
    parseInt(map.hour),
    parseInt(map.minute),
    parseInt(map.second)
  );
}

export function generateColorPalette(numColors: number): string[] {
  const colors = [
    '#3b82f6', // blue-500
    '#22c55e', // green-500
    '#f97316', // orange-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#6366f1', // indigo-500
  ];

  if (numColors <= colors.length) {
    return colors.slice(0, numColors);
  }

  const extendedPalette: string[] = [...colors];
  for (let i = colors.length; i < numColors; i++) {
    const hash = (i.toString()).split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const h = (hash & 0xFF0000) >> 16;
    const s = (hash & 0x00FF00) >> 8;
    const l = (hash & 0x0000FF);
    extendedPalette.push(`#${('00' + h.toString(16)).slice(-2)}${('00' + s.toString(16)).slice(-2)}${('00' + l.toString(16)).slice(-2)}`);
  }

  return extendedPalette;
}
