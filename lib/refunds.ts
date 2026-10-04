import type { Booking, Refund, RefundTarget } from "@/lib/types";

/**
 * Hvor mye som kan tilbakeføres for hver belastning på en booking. Ren logikk
 * uten Stripe – brukes både av refundCharge() i lib/bookings.ts (validering)
 * og av PaymentPanel (hva «Refunder»-knappen foreslår).
 */

function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Refusjonene som gjelder én bestemt belastning. */
export function refundsFor(booking: Booking, target: RefundTarget, extraChargeId?: string | null): Refund[] {
  return (booking.refunds ?? []).filter(
    (r) => r.target === target && (target !== "extra" || r.extraChargeId === extraChargeId),
  );
}

/** Beløpet som faktisk er trukket for belastningen – 0 hvis ingenting er trukket. */
export function chargedAmount(booking: Booking, target: RefundTarget, extraChargeId?: string | null): number {
  if (target === "main") return booking.mainCharge.status === "paid" ? booking.pricing.total : 0;
  if (target === "deposit") {
    return booking.deposit.status === "captured" ? (booking.deposit.capturedAmount ?? booking.deposit.amount) : 0;
  }
  const extra = booking.extraCharges.find((c) => c.id === extraChargeId);
  return extra?.status === "succeeded" ? extra.amount : 0;
}

/**
 * Sum som allerede er refundert. For hovedbeløpet teller også
 * `mainCharge.refundedAmount`, så avbestillingsrefusjoner fra før loggen
 * fantes ikke kan refunderes en gang til.
 */
export function refundedSoFar(booking: Booking, target: RefundTarget, extraChargeId?: string | null): number {
  const sum = refundsFor(booking, target, extraChargeId).reduce((acc, r) => acc + r.amount, 0);
  if (target === "main") return roundCents(Math.max(sum, booking.mainCharge.refundedAmount ?? 0));
  return roundCents(sum);
}

/** Hvor mye som fortsatt kan tilbakeføres for belastningen. */
export function refundableAmount(booking: Booking, target: RefundTarget, extraChargeId?: string | null): number {
  return Math.max(0, roundCents(chargedAmount(booking, target, extraChargeId) - refundedSoFar(booking, target, extraChargeId)));
}

/** PaymentIntent-en refusjonen må gå mot i Stripe. */
export function paymentIntentFor(booking: Booking, target: RefundTarget, extraChargeId?: string | null): string | null {
  if (target === "main") return booking.mainCharge.paymentIntentId;
  if (target === "deposit") return booking.deposit.paymentIntentId;
  return booking.extraCharges.find((c) => c.id === extraChargeId)?.paymentIntentId ?? null;
}
