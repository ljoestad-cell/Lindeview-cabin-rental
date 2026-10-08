import { CANCELLATION_FEE_SHARE, FULL_REFUND_DAYS } from "@/lib/config";
import { nightsBetween } from "@/lib/dates";
import { chargedAmount } from "@/lib/refunds";
import type { Booking } from "@/lib/types";

/**
 * Andelen av leien gjesten får tilbake ved avbestilling på `cancelDate`,
 * etter reglene i lib/config.ts (vist for gjesten på /vilkar): 1 − gebyret
 * innen fristen, ellers 0. Gjelder avbestilling fra gjesten – avlyser
 * eieren, refunderes alt.
 */
export function refundShare(checkIn: string, cancelDate: string): number {
  const daysBefore = nightsBetween(cancelDate, checkIn);
  return daysBefore >= FULL_REFUND_DAYS ? 1 - CANCELLATION_FEE_SHARE : 0;
}

function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Gebyret som holdes tilbake ved avbestilling innen fristen: CANCELLATION_FEE_SHARE av `paid`, avrundet til hele cent. */
export function cancellationFee(paid: number): number {
  return roundCents(paid * CANCELLATION_FEE_SHARE);
}

/** Det gjesten får tilbake av `paid` ved avbestilling innen fristen – samme tall i e-post, Stripe og refusjon. */
export function earlyCancellationRefund(paid: number): number {
  return roundCents(paid - cancellationFee(paid));
}

/**
 * Hvor mye gjesten har krav på tilbake av forskudd og rest når de avbestiller
 * `cancelDate`: innen fristen det som er betalt minus gebyret, ellers
 * ingenting (eldre bookinger uten forskudd: alt). Gebyret regnes av summen, så totalen alltid er
 * earlyCancellationRefund(betalt), og fordeles på de to betalingene (den
 * siste centen havner på forskuddet). Beløpene er før eventuelle refusjoner
 * som allerede er gjort.
 */
export function policyRefund(booking: Booking, cancelDate: string): { prepayment: number; main: number } {
  if (refundShare(booking.checkIn, cancelDate) === 0) return { prepayment: 0, main: 0 };
  const prepaid = chargedAmount(booking, "prepayment");
  const mainPaid = chargedAmount(booking, "main");
  // Bookinger fra før forskudd fantes ble godtatt med gratis avbestilling – ingen gebyr der.
  if (booking.prepayment?.status !== "paid") return { prepayment: 0, main: mainPaid };
  const total = earlyCancellationRefund(prepaid + mainPaid);
  const main = earlyCancellationRefund(mainPaid);
  return { prepayment: roundCents(total - main), main };
}

/** Sum av policyRefund – det admin forhåndsviser før avbestilling. */
export function policyRefundTotal(booking: Booking, cancelDate: string): number {
  const { prepayment, main } = policyRefund(booking, cancelDate);
  return roundCents(prepayment + main);
}
