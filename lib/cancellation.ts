import { FULL_REFUND_DAYS } from "@/lib/config";
import { nightsBetween } from "@/lib/dates";

/**
 * Andelen av hovedbeløpet gjesten får tilbake ved avbestilling på
 * `cancelDate`, etter reglene i lib/config.ts (vist for gjesten på /vilkar).
 * Gjelder avbestilling fra gjesten – avlyser eieren, refunderes alt.
 */
export function refundShare(checkIn: string, cancelDate: string): number {
  const daysBefore = nightsBetween(cancelDate, checkIn);
  return daysBefore >= FULL_REFUND_DAYS ? 1 : 0;
}

/** Refusjonsbeløp etter vilkårene, avrundet til hele cent. */
export function policyRefundAmount(total: number, checkIn: string, cancelDate: string): number {
  return Math.round(total * refundShare(checkIn, cancelDate) * 100) / 100;
}
