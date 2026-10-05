import type { Booking } from "@/lib/types";

/**
 * «Avslått» og «Avbestilt» er samme status i data ("declined") – forskjellen
 * er hvem som tok initiativet. Eldre bookinger uten `cancelledBy` regnes som
 * avbestilt av gjesten hvis gjesten ba om det på «Min booking».
 */
export function cancelledByGuest(booking: Booking): boolean {
  if (booking.cancelledBy) return booking.cancelledBy === "guest";
  return Boolean(booking.cancellationRequest);
}

/** Statusteksten i admin og CSV-eksporten. */
export function statusLabel(booking: Booking): string {
  if (booking.status === "pending") return "Venter";
  if (booking.status === "confirmed") return "Bekreftet";
  return cancelledByGuest(booking) ? "Avbestilt" : "Avslått";
}
