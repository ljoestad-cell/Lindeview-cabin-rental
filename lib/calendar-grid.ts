import { toIso } from "@/lib/dates";

/**
 * Rene helpere for å bygge månedsruter til en kalender-UI. Delt mellom
 * gjestenes datovelger (components/booking/BookingCalendar.tsx) og
 * admin-kalenderen (components/admin/AdminCalendar.tsx).
 */

export const WEEKDAY_LABELS = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];
export const MONTH_LABELS = [
  "Januar", "Februar", "Mars", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Desember",
];

/** Måneder (år, 0-indeksert måned) mellom season.start og season.end (eksklusiv). */
export function monthsInSeason(season: { start: string; end: string }): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let cursor = `${season.start.slice(0, 7)}-01`;
  while (cursor < season.end) {
    const [year, month] = cursor.split("-").map(Number);
    out.push({ year, month: month - 1 });
    cursor = toIso(new Date(Date.UTC(year, month, 1)));
  }
  return out;
}

/** Én kalenderrute (mandag–søndag) for en måned. `null` = utenfor måneden. */
export function buildMonthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // getUTCDay(): 0 = søndag. Vi vil ha mandag først.
  const leadingBlanks = (first.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toIso(new Date(Date.UTC(year, month, i + 1)))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
