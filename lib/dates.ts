/**
 * Rene dato-helpere. Alle datoer håndteres som "YYYY-MM-DD"-strenger (ingen
 * klokkeslett, ingen tidssone) for å unngå at UTC/lokaltid flytter en booking
 * en dag. Konvertering til Date skjer kun internt, alltid i UTC.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type DateRange = { start: string; end: string };

/** True hvis strengen er en gyldig "YYYY-MM-DD"-dato. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && toIso(d) === value;
}

/** Date (tolket i UTC) → "YYYY-MM-DD". */
export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date ved midnatt UTC. */
export function fromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Antall netter mellom to datoer (end må være etter start). */
export function nightsBetween(start: string, end: string): number {
  const ms = fromIso(end).getTime() - fromIso(start).getTime();
  return Math.round(ms / 86_400_000);
}

/** Legg til (eller trekk fra) et antall dager på en ISO-dato. */
export function addDays(iso: string, days: number): string {
  const d = fromIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** Dagens dato som "YYYY-MM-DD" (UTC). */
export function today(): string {
  return toIso(new Date());
}

/**
 * True hvis to halvåpne intervaller [start, end) overlapper.
 * To bookinger som deler kun innsjekk-/utsjekkdag regnes IKKE som overlapp.
 */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Alle datoer fra start (inkl.) til end (ekskl.) som ISO-strenger. */
export function eachDate(range: DateRange): string[] {
  const out: string[] = [];
  for (let d = range.start; d < range.end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** True hvis [checkIn, checkOut) ligger helt innenfor [seasonStart, seasonEnd). */
export function isWithinSeason(
  checkIn: string,
  checkOut: string,
  seasonStart: string,
  seasonEnd: string,
): boolean {
  return checkIn >= seasonStart && checkOut <= seasonEnd;
}
