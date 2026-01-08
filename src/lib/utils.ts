import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
    // Simple way to generate more colors: slightly darken existing ones
    const baseColor = colors[i % colors.length];
    const hash = (i.toString()).split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const h = (hash & 0xFF0000) >> 16;
    const s = (hash & 0x00FF00) >> 8;
    const l = (hash & 0x0000FF);
    extendedPalette.push(`#${('00' + h.toString(16)).slice(-2)}${('00' + s.toString(16)).slice(-2)}${('00' + l.toString(16)).slice(-2)}`);
  }

  return extendedPalette;
}
