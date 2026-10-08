import { CANCELLATION_FEE_SHARE, FULL_REFUND_DAYS } from "@/lib/config";
import { nightsBetween } from "@/lib/dates";
import { chargedAmount } from "@/lib/refunds";
import type { Booking } from "@/lib/types";

/**
 * Om gjesten avbestiller innen fristen (minst FULL_REFUND_DAYS dager før
 * innsjekk) og dermed får det betalte tilbake minus gebyret. Etter fristen
 * refunderes ingenting. Gjelder avbestilling fra gjesten – avlyser eieren,
 * refunderes alt.
 */
export function withinCancellationDeadline(checkIn: string, cancelDate: string): boolean {
  return nightsBetween(cancelDate, checkIn) >= FULL_REFUND_DAYS;
}

function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Gebyret ved avbestilling innen fristen: CANCELLATION_FEE_SHARE av hele leien, avrundet til hele cent. */
export function cancellationFee(total: number): number {
  return roundCents(total * CANCELLATION_FEE_SHARE);
}

/**
 * Det gjesten får tilbake av `paid` ved avbestilling innen fristen, når leien
 * er `total` – samme tall i e-post, Stripe, «Min booking» og refusjonen.
 */
export function earlyCancellationRefund(paid: number, total: number): number {
  return roundCents(Math.max(0, paid - cancellationFee(total)));
}

/**
 * Hvor mye gjesten har krav på tilbake av forskudd og rest når de avbestiller
 * `cancelDate`: innen fristen det som er betalt minus gebyret, ellers
 * ingenting (eldre bookinger uten forskudd: alt). Gebyret trekkes fra
 * forskuddet først – det er alltid stort nok, siden gebyret er mindre enn
 * forskuddsandelen. Beløpene er før eventuelle refusjoner som allerede er gjort.
 */
export function policyRefund(booking: Booking, cancelDate: string): { prepayment: number; main: number } {
  if (!withinCancellationDeadline(booking.checkIn, cancelDate)) return { prepayment: 0, main: 0 };
  const prepaid = chargedAmount(booking, "prepayment");
  const mainPaid = chargedAmount(booking, "main");
  // Bookinger fra før forskudd fantes ble godtatt med gratis avbestilling – ingen gebyr der.
  if (booking.prepayment?.status !== "paid") return { prepayment: 0, main: mainPaid };
  const fee = cancellationFee(booking.pricing.total);
  const fromPrepayment = Math.min(fee, prepaid);
  return {
    prepayment: roundCents(prepaid - fromPrepayment),
    main: roundCents(Math.max(0, mainPaid - (fee - fromPrepayment))),
  };
}

/** Sum av policyRefund – det admin forhåndsviser før avbestilling. */
export function policyRefundTotal(booking: Booking, cancelDate: string): number {
  const { prepayment, main } = policyRefund(booking, cancelDate);
  return roundCents(prepayment + main);
}
