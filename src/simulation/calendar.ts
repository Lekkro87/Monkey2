import type { Day } from '@/types';

export const START_YEAR = 2026;
const START_UTC = Date.UTC(START_YEAR, 0, 1);
const MS_PER_DAY = 86_400_000;
export const DAYS_PER_YEAR = 365;
export const DAYS_PER_MONTH = 30.4375;

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function dateOf(day: Day): Date {
  return new Date(START_UTC + day * MS_PER_DAY);
}

export function dayOfMonth(day: Day): number {
  return dateOf(day).getUTCDate();
}

export function isMonthStart(day: Day): boolean {
  return dayOfMonth(day) === 1;
}

export function isWeekStart(day: Day): boolean {
  return day > 0 && day % 7 === 0;
}

/** Monatsindex seit Spielstart (Januar 2026 = 0). */
export function monthIndex(day: Day): number {
  const d = dateOf(day);
  return (d.getUTCFullYear() - START_YEAR) * 12 + d.getUTCMonth();
}

export function yearOf(day: Day): number {
  return dateOf(day).getUTCFullYear();
}

export function yearsElapsed(day: Day): number {
  return day / DAYS_PER_YEAR;
}

export function isQuarterStart(day: Day): boolean {
  return isMonthStart(day) && dateOf(day).getUTCMonth() % 3 === 0;
}

export function isYearStart(day: Day): boolean {
  const d = dateOf(day);
  return d.getUTCDate() === 1 && d.getUTCMonth() === 0;
}

export function formatDate(day: Day): string {
  const d = dateOf(day);
  return `${d.getUTCDate()}. ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatShortDate(day: Day): string {
  const d = dateOf(day);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

export function formatMonth(month: number): string {
  const year = START_YEAR + Math.floor(month / 12);
  return `${MONTH_SHORT[((month % 12) + 12) % 12]} ${String(year).slice(2)}`;
}

export function formatMonthLong(month: number): string {
  const year = START_YEAR + Math.floor(month / 12);
  return `${MONTH_NAMES[((month % 12) + 12) % 12]} ${year}`;
}

export function formatWeekLabel(day: Day): string {
  const d = dateOf(day);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCFullYear()).slice(2)}`;
}

export function formatDuration(days: number): string {
  if (days < 1) return 'heute';
  if (days < 14) return `${Math.round(days)} ${Math.round(days) === 1 ? 'Tag' : 'Tage'}`;
  if (days < 60) return `${Math.round(days / 7)} Wochen`;
  if (days < 730) return `${Math.round(days / DAYS_PER_MONTH)} Monate`;
  return `${(days / DAYS_PER_YEAR).toFixed(1).replace('.', ',')} Jahre`;
}
