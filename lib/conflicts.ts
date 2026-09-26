import { rangesOverlap, type DateRange } from "@/lib/dates";
import type { BlockedRange, Booking } from "@/lib/types";

/**
 * Finner det som hindrer at `range` kan bekreftes: en annen bekreftet booking
 * eller en blokkert periode (manuell eller fra Airbnb). Ren funksjon, så den
 * kan brukes både ved ny forespørsel og ved godkjenning i admin – og testes.
 */
export function findConflict(
  range: DateRange,
  bookings: Booking[],
  blockedRanges: BlockedRange[],
  excludeBookingId?: string,
): "booking" | "blocked" | null {
  const clashesBooking = bookings.some(
    (b) =>
      b.id !== excludeBookingId &&
      b.status === "confirmed" &&
      rangesOverlap({ start: b.checkIn, end: b.checkOut }, range),
  );
  if (clashesBooking) return "booking";
  if (blockedRanges.some((r) => rangesOverlap({ start: r.start, end: r.end }, range))) return "blocked";
  return null;
}
