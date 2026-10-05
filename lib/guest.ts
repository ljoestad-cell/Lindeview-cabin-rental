import { FULL_REFUND_DAYS } from "@/lib/config";
import { addDays } from "@/lib/dates";
import { cancelledByGuest } from "@/lib/status";
import type { Booking } from "@/lib/types";

/**
 * Regler for gjestens «Min booking»-side (app/booking/[token]). Ren logikk
 * uten lager eller Stripe – brukes både av siden og av API-rutene, så
 * knappene som vises og det serveren tillater alltid stemmer overens.
 */

/** Siste dag gjesten kan avbestille gratis (se lib/cancellation.ts). */
export function freeCancellationDeadline(checkIn: string): string {
  return addDays(checkIn, -FULL_REFUND_DAYS);
}

/** Gjesten kan be om avbestilling av en aktiv booking før innsjekk – én gang. */
export function canRequestCancellation(booking: Booking, today: string): boolean {
  if (booking.status === "declined") return false;
  if (booking.cancellationRequest) return false;
  return today < booking.checkIn;
}

/**
 * Gjesten kan betale forskuddet (uten lagret kort) eller bytte kort (før
 * resten er trukket) på en bekreftet booking. Feilet trekket av resten,
 * betaler gjesten resten direkte i stedet (canPayRest).
 */
export function canUpdateCard(booking: Booking): boolean {
  return (
    booking.status === "confirmed" &&
    (booking.mainCharge.status === "not_saved" || booking.mainCharge.status === "card_saved")
  );
}

/** Det automatiske trekket av resten feilet – gjesten kan betale den selv (med 3D Secure). */
export function canPayRest(booking: Booking): boolean {
  return booking.status === "confirmed" && booking.mainCharge.status === "failed";
}

export function guestStatusLabel(booking: Booking): string {
  if (booking.status === "pending") return "Forespørsel mottatt";
  if (booking.status === "declined") return cancelledByGuest(booking) ? "Avbestilt" : "Avslått";
  if (booking.mainCharge.status === "not_saved") return "Bekreftet – venter på forskudd";
  if (booking.mainCharge.status === "failed") return "Bekreftet – betaling mangler";
  return "Bekreftet";
}
