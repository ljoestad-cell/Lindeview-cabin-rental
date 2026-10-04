import Stripe from "stripe";
import { CURRENCY } from "@/lib/config";
import { siteUrl } from "@/lib/site";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import type { Booking } from "@/lib/types";

/**
 * Ekte Stripe-integrasjon. Kortet lagres via Checkout i "setup"-modus når en
 * booking bekreftes (ingen belastning da) – alle senere belastninger
 * (hovedbeløp, depositum, tilleggsbeløp) skjer off-session mot det lagrede
 * kortet, trigget av cron-jobben eller admin-knapper.
 *
 * Uten STRIPE_SECRET_KEY gjør alt her ingenting/kaster tydelig – samme
 * mønster som lib/calendar.ts. Resten av bookingflyten fungerer uansett.
 */

export type PaymentResult =
  | { ok: true; paymentIntentId: string }
  | { ok: false; error: string };

let warnedOnce = false;
function warnNotConfigured() {
  if (warnedOnce) return;
  warnedOnce = true;
  console.info("[payments] STRIPE_SECRET_KEY mangler – betaling er ikke koblet til ennå.");
}

function toMinorUnits(amount: number): number {
  // EUR har 2 desimaler – ingen valuta i denne appen bruker 0-desimalvalutaer.
  return Math.round(amount * 100);
}

async function getOrCreateCustomer(booking: Booking): Promise<string> {
  const stripe = getStripe();
  if (booking.stripeCustomerId) return booking.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: booking.email,
    name: booking.name,
    phone: booking.phone,
    metadata: { bookingId: booking.id },
  });
  return customer.id;
}

/**
 * Oppretter en Stripe Checkout-økt (mode "setup") som lar gjesten sikre en
 * betalingsmetode uten at noe belastes. Returnerer null uten Stripe-oppsett.
 */
export async function createSecureCardSession(
  booking: Booking,
): Promise<{ checkoutUrl: string; customerId: string } | null> {
  if (!isStripeConfigured()) {
    warnNotConfigured();
    return null;
  }

  const stripe = getStripe();
  const customerId = await getOrCreateCustomer(booking);

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    payment_method_types: ["card"],
    success_url: `${siteUrl()}/book/sikret?booking=${booking.id}`,
    cancel_url: `${siteUrl()}/book`,
    metadata: { bookingId: booking.id },
  });

  if (!session.url) throw new Error("Stripe returnerte ingen URL for Checkout-økten.");
  return { checkoutUrl: session.url, customerId };
}

/** Henter payment method-id fra en fullført setup-økt sin SetupIntent. */
export async function getPaymentMethodFromSetupIntent(
  setupIntentId: string,
): Promise<string | null> {
  const stripe = getStripe();
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  const pm = setupIntent.payment_method;
  return typeof pm === "string" ? pm : (pm?.id ?? null);
}

async function offSessionCharge(
  booking: Booking,
  amount: number,
  kind: string,
  extra?: Partial<Stripe.PaymentIntentCreateParams>,
): Promise<PaymentResult> {
  if (!booking.stripeCustomerId || !booking.defaultPaymentMethodId) {
    return { ok: false, error: "Ingen lagret betalingsmetode på denne bookingen." };
  }

  const stripe = getStripe();
  try {
    const intent = await stripe.paymentIntents.create({
      amount: toMinorUnits(amount),
      currency: CURRENCY.toLowerCase(),
      customer: booking.stripeCustomerId,
      payment_method: booking.defaultPaymentMethodId,
      off_session: true,
      confirm: true,
      metadata: { bookingId: booking.id, kind },
      ...extra,
    });
    return { ok: true, paymentIntentId: intent.id };
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

/** Belaster hovedbeløpet (leie + utvask) på det lagrede kortet. */
export async function chargeMainAmount(booking: Booking): Promise<PaymentResult> {
  return offSessionCharge(booking, booking.pricing.total, "main");
}

/** Reserverer (autoriserer, uten å trekke) depositumet – kalles dagen før utsjekk. */
export async function holdDeposit(booking: Booking): Promise<PaymentResult> {
  return offSessionCharge(booking, booking.deposit.amount, "deposit", { capture_method: "manual" });
}

/** Trekker et reservert depositum – helt eller delvis (f.eks. ved skade). */
export async function captureDeposit(booking: Booking, amount?: number, reason?: string): Promise<PaymentResult> {
  if (!booking.deposit.paymentIntentId) {
    return { ok: false, error: "Ingen reservasjon å trekke fra." };
  }
  const stripe = getStripe();
  try {
    const intent = await stripe.paymentIntents.capture(booking.deposit.paymentIntentId, {
      amount_to_capture: amount !== undefined ? toMinorUnits(amount) : undefined,
      metadata: reason ? { captureReason: reason } : undefined,
    });
    return { ok: true, paymentIntentId: intent.id };
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Frigir et reservert depositum uten å trekke noe. */
export async function releaseDeposit(booking: Booking): Promise<PaymentResult> {
  if (!booking.deposit.paymentIntentId) {
    return { ok: false, error: "Ingen reservasjon å frigi." };
  }
  const stripe = getStripe();
  try {
    const intent = await stripe.paymentIntents.cancel(booking.deposit.paymentIntentId);
    return { ok: true, paymentIntentId: intent.id };
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Trekker et vilkårlig tilleggsbeløp (skade, ekstra tjenester) fra det lagrede kortet. */
export async function chargeExtra(
  booking: Booking,
  amount: number,
  description: string,
): Promise<PaymentResult> {
  return offSessionCharge(booking, amount, "extra", { description });
}

/**
 * Tilbakefører `amount` av en vellykket betaling (hovedbeløp, trukket
 * depositum eller tilleggsbeløp). `idempotencyKey` hindrer at et dobbeltklikk
 * eller et nytt forsøk refunderer to ganger. Returnerer refusjonens id.
 */
export async function refundPayment(
  paymentIntentId: string | null,
  amount: number,
  metadata: Record<string, string>,
  idempotencyKey: string,
): Promise<PaymentResult> {
  if (!paymentIntentId) {
    return { ok: false, error: "Ingen betaling å refundere." };
  }
  const stripe = getStripe();
  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: toMinorUnits(amount),
        reason: "requested_by_customer",
        metadata,
      },
      { idempotencyKey },
    );
    if (refund.status === "failed" || refund.status === "canceled") {
      return { ok: false, error: `Stripe avviste refusjonen (${refund.failure_reason ?? refund.status}).` };
    }
    return { ok: true, paymentIntentId: refund.id };
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) return { ok: false, error: err.message };
    throw err;
  }
}
