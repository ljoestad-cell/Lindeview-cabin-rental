import Stripe from "stripe";
import { earlyCancellationRefund } from "@/lib/cancellation";
import { CANCELLATION_FEE_SHARE, CHARGE_DAYS_BEFORE_CHECKIN, CURRENCY, FULL_REFUND_DAYS } from "@/lib/config";
import { addDays, fromIso, today } from "@/lib/dates";
import { prepaymentAmount } from "@/lib/pricing";
import { guestBookingUrl, siteUrl } from "@/lib/site";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import type { Booking } from "@/lib/types";

/**
 * Ekte Stripe-integrasjon. Når en booking bekreftes, betaler gjesten
 * forskuddet via Checkout med 3D Secure, og kortet lagres samtidig
 * (setup_future_usage). Alle senere belastninger (resten, depositum,
 * tilleggsbeløp) skjer off-session mot det lagrede kortet, trigget av
 * cron-jobben eller admin-knapper. Bytter gjesten kort etter forskuddet,
 * brukes Checkout i "setup"-modus (ingen belastning).
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

/** Hva en Checkout-økt gjelder – lagres i metadata og leses av webhooken. */
export type CheckoutKind = "prepayment" | "rest" | "card";

function successUrl(booking: Booking, kind: CheckoutKind): string {
  return `${siteUrl()}/book/sikret?booking=${booking.id}&kind=${kind}`;
}

// Avbryter gjesten, havner de tilbake på sin egen bookingside (eldre bookinger uten token: /book).
function cancelUrl(booking: Booking): string {
  return booking.guestToken ? guestBookingUrl(booking.guestToken) : `${siteUrl()}/book`;
}

/**
 * Checkout-økt der gjesten betaler `amount` mens de er til stede. Ber alltid
 * om 3D Secure (banken tar da ansvaret ved svindel), og lagrer kortet for
 * senere off-session-belastninger.
 */
async function createPaymentSession(
  booking: Booking,
  customerId: string,
  amount: number,
  kind: CheckoutKind,
  productName: string,
  submitMessage?: string,
): Promise<string> {
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY.toLowerCase(),
          unit_amount: toMinorUnits(amount),
          product_data: { name: productName },
        },
      },
    ],
    payment_intent_data: {
      setup_future_usage: "off_session",
      metadata: { bookingId: booking.id, kind },
    },
    payment_method_options: { card: { request_three_d_secure: "any" } },
    ...(submitMessage ? { custom_text: { submit: { message: submitMessage } } } : {}),
    success_url: successUrl(booking, kind),
    cancel_url: cancelUrl(booking),
    metadata: { bookingId: booking.id, kind },
  });
  if (!session.url) throw new Error("Stripe returnerte ingen URL for Checkout-økten.");
  return session.url;
}

const checkoutDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const checkoutAmount = new Intl.NumberFormat("en-IE", { style: "currency", currency: CURRENCY });

/**
 * Vises over betalingsknappen i Checkout: hva som trekkes senere, og hva
 * gjesten får tilbake ved avbestilling – samme tall som i e-postene.
 */
export function prepaymentCheckoutMessage(booking: Booking, amount: number): string {
  const rest = booking.pricing.total - amount;
  if (rest <= 0) {
    return `Check-in is less than ${FULL_REFUND_DAYS} days away, so this payment is non-refundable.`;
  }
  const feePct = Math.round(CANCELLATION_FEE_SHARE * 100);
  const chargeAt = checkoutDate.format(fromIso(addDays(booking.checkIn, -CHARGE_DAYS_BEFORE_CHECKIN)));
  const deadline = checkoutDate.format(fromIso(addDays(booking.checkIn, -FULL_REFUND_DAYS)));
  return (
    `The remaining ${checkoutAmount.format(rest)} is charged automatically to this card on ${chargeAt}. ` +
    `Cancel by ${deadline} and get ${checkoutAmount.format(earlyCancellationRefund(amount, booking.pricing.total))} ` +
    `of this payment refunded (a cancellation fee of ${feePct}% of the total price is retained). ` +
    `After that, the booking is non-refundable.`
  );
}

/**
 * Lenken gjesten bruker for å sikre bookingen. Uten lagret kort: betal
 * forskuddet (hele beløpet ved sen bestilling) og lagre kortet. Med lagret
 * kort (gjesten bytter kort): Checkout i "setup"-modus, ingen belastning.
 * Returnerer null uten Stripe-oppsett.
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

  if (booking.mainCharge.status === "not_saved") {
    const amount = prepaymentAmount(booking.pricing.total, booking.checkIn, today());
    const name =
      amount < booking.pricing.total
        ? `Forskudd – ${booking.checkIn} til ${booking.checkOut}`
        : `Leie – ${booking.checkIn} til ${booking.checkOut}`;
    const checkoutUrl = await createPaymentSession(
      booking,
      customerId,
      amount,
      "prepayment",
      name,
      prepaymentCheckoutMessage(booking, amount),
    );
    return { checkoutUrl, customerId };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    payment_method_types: ["card"],
    success_url: successUrl(booking, "card"),
    cancel_url: cancelUrl(booking),
    metadata: { bookingId: booking.id, kind: "card" },
  });

  if (!session.url) throw new Error("Stripe returnerte ingen URL for Checkout-økten.");
  return { checkoutUrl: session.url, customerId };
}

/**
 * Lenken gjesten bruker for å betale resten selv når det automatiske trekket
 * feilet (kortet avvist, eller banken krever 3D Secure). Kortet som brukes
 * lagres som nytt standardkort.
 */
export async function createRestPaymentSession(booking: Booking, amount: number): Promise<string> {
  const customerId = await getOrCreateCustomer(booking);
  return createPaymentSession(
    booking,
    customerId,
    amount,
    "rest",
    `Resten av leien – ${booking.checkIn} til ${booking.checkOut}`,
  );
}

/** Det gjesten faktisk betalte i en fullført Checkout-økt i "payment"-modus. */
export async function getCheckoutPayment(
  session: Stripe.Checkout.Session,
): Promise<{ paymentIntentId: string; paymentMethodId: string; amount: number } | null> {
  const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!intentId) return null;
  const intent = await getStripe().paymentIntents.retrieve(intentId);
  const pm = intent.payment_method;
  const paymentMethodId = typeof pm === "string" ? pm : pm?.id;
  if (!paymentMethodId || intent.status !== "succeeded") return null;
  return { paymentIntentId: intent.id, paymentMethodId, amount: intent.amount_received / 100 };
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
      // Banken vil at gjesten godkjenner selv – gjesten får en betalingslenke (se applyMainChargeResult).
      if (err.code === "authentication_required") {
        return { ok: false, error: "Banken krever at gjesten godkjenner betalingen selv (3D Secure)." };
      }
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

/** Det som gjenstår av leien etter forskuddet (hele leien på bookinger fra før forskudd fantes). */
export function mainChargeAmount(booking: Booking): number {
  return booking.mainCharge.amount ?? booking.pricing.total;
}

/** Belaster resten av leien på det lagrede kortet. */
export async function chargeMainAmount(booking: Booking): Promise<PaymentResult> {
  return offSessionCharge(booking, mainChargeAmount(booking), "main");
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
