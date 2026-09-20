import type { DateRange } from "@/lib/dates";
import { PROPERTY_NAME } from "@/lib/property";
import type { BlockedRange, Booking } from "@/lib/types";

/**
 * Minimal iCalendar (RFC 5545)-støtte for kalendersynk med Airbnb – ingen
 * ekstern avhengighet, siden både eksport og import her bare trenger
 * heldags-VEVENT med DTSTART/DTEND.
 */

type IcsEvent = { uid: string; start: string; end: string; summary: string };

function toIcsDate(iso: string): string {
  return iso.replace(/-/g, "");
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** RFC 5545: linjer over 75 oktetter skal brytes med CRLF + ett innledende mellomrom. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

/** Bookinger og manuelle blokkeringer → hendelser som skal eksporteres til Airbnb. Ekskluderer blokkeringer importert FRA Airbnb, for å unngå å sende dem tilbake. */
export function bookingsAndBlocksToIcsEvents(bookings: Booking[], blockedRanges: BlockedRange[]): IcsEvent[] {
  const bookingEvents = bookings
    .filter((b) => b.status === "confirmed")
    .map((b) => ({ uid: `booking-${b.id}@lindeview`, start: b.checkIn, end: b.checkOut, summary: "Reservert" }));
  const blockEvents = blockedRanges
    .filter((r) => (r.source ?? "manual") === "manual")
    .map((r) => ({ uid: `blocked-${r.id}@lindeview`, start: r.start, end: r.end, summary: "Reservert" }));
  return [...bookingEvents, ...blockEvents];
}

export function generateIcs(events: IcsEvent[]): string {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lindeview//Booking//NO",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcsText(PROPERTY_NAME)}`,
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${toIcsDate(event.start)}`,
      `DTEND;VALUE=DATE:${toIcsDate(event.end)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function parseIcsDateValue(line: string): string | undefined {
  const value = line.split(":").pop();
  if (!value) return undefined;
  const digits = value.replace(/[^0-9]/g, "").slice(0, 8);
  if (digits.length !== 8) return undefined;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** Trekker ut [DTSTART, DTEND)-perioder fra en ekstern iCal-feed (f.eks. Airbnb). Ignorerer alt annet i VEVENT-blokkene. */
export function parseIcsBusyRanges(ics: string): DateRange[] {
  // Fold-linjer (fortsettelseslinjer starter med mellomrom/tab) slås sammen før parsing.
  const unfolded = ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const lines = unfolded.split("\n");

  const ranges: DateRange[] = [];
  let current: { start?: string; end?: string } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      current = {};
    } else if (line === "END:VEVENT") {
      if (current?.start && current?.end) ranges.push({ start: current.start, end: current.end });
      current = null;
    } else if (current && line.startsWith("DTSTART")) {
      current.start = parseIcsDateValue(line);
    } else if (current && line.startsWith("DTEND")) {
      current.end = parseIcsDateValue(line);
    }
  }
  return ranges;
}
