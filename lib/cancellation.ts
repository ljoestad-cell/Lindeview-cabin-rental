import { EARLY_CANCELLATION_FEE, FULL_REFUND_DAYS } from "@/lib/config";
import { nightsBetween } from "@/lib/dates";
import { chargedAmount } from "@/lib/refunds";
import type { Booking } from "@/lib/types";

/**
 * Andelen av leien gjesten får tilbake ved avbestilling på `cancelDate`,
 * etter reglene i lib/config.ts (vist for gjesten på /vilkar).
 * Gjelder avbestilling fra gjesten – avlyser eieren, refunderes alt.
 */
export function refundShare(checkIn: string, cancelDate: string): number {
  const daysBefore = nightsBetween(cancelDate, checkIn);
  return daysBefore >= FULL_REFUND_DAYS ? 1 : 0;
}

function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Hvor mye gjesten har krav på tilbake av forskudd og rest når de avbestiller
 * `cancelDate`: innen fristen alt som er betalt, minus EARLY_CANCELLATION_FEE
 * (som holdes tilbake av forskuddet), ellers ingenting. Beløpene er før
 * eventuelle refusjoner som allerede er gjort.
 */
export function policyRefund(booking: Booking, cancelDate: string): { prepayment: number; main: number } {
  if (refundShare(booking.checkIn, cancelDate) === 0) return { prepayment: 0, main: 0 };
  const prepaid = chargedAmount(booking, "prepayment");
  return {
    prepayment: roundCents(Math.max(0, prepaid - (prepaid > 0 ? EARLY_CANCELLATION_FEE : 0))),
    main: chargedAmount(booking, "main"),
  };
}

/** Sum av policyRefund – det admin forhåndsviser før avbestilling. */
export function policyRefundTotal(booking: Booking, cancelDate: string): number {
  const { prepayment, main } = policyRefund(booking, cancelDate);
  return roundCents(prepayment + main);
}
