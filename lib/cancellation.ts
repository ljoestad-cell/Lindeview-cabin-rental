import { FULL_REFUND_DAYS, PARTIAL_REFUND_DAYS, PARTIAL_REFUND_SHARE } from "@/lib/config";
import { nightsBetween } from "@/lib/dates";

/**
 * Andelen av hovedbeløpet gjesten får tilbake ved avbestilling på
 * `cancelDate`, etter reglene i lib/config.ts (vist for gjesten på /vilkar).
 * Gjelder avbestilling fra gjesten – avlyser eieren, refunderes alt.
 */
export function refundShare(checkIn: string, cancelDate: string): number {
  const daysBefore = nightsBetween(cancelDate, checkIn);
  if (daysBefore >= FULL_REFUND_DAYS) return 1;
  if (daysBefore >= PARTIAL_REFUND_DAYS) return PARTIAL_REFUND_SHARE;
  return 0;
}

/** Refusjonsbeløp etter vilkårene, avrundet til hele cent. */
export function policyRefundAmount(total: number, checkIn: string, cancelDate: string): number {
  return Math.round(total * refundShare(checkIn, cancelDate) * 100) / 100;
}
