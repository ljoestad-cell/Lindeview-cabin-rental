import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { attachPaymentMethod, recordPrepayment, recordRestPayment } from "@/lib/bookings";
import { getCheckoutPayment, getPaymentMethodFromSetupIntent } from "@/lib/payments";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe-webhook. Må lese raw body (ikke request.json()) for at
 * signaturverifiseringen skal stemme. Håndterer Checkout-øktene gjesten
 * fullfører selv: forskudd (lagrer også kortet), betaling av resten etter et
 * feilet trekk, og kortbytte. Off-session-belastningene (cron-jobben /
 * admin-knapper) får svaret direkte og trenger ingen webhook.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe er ikke konfigurert." }, { status: 501 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET mangler." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Mangler stripe-signature-header." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Ugyldig signatur:", err);
    return NextResponse.json({ error: "Ugyldig signatur." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    const setupIntentId =
      typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;

    try {
      if (session.mode === "setup" && bookingId && customerId && setupIntentId) {
        const paymentMethodId = await getPaymentMethodFromSetupIntent(setupIntentId);
        if (paymentMethodId) {
          await attachPaymentMethod(bookingId, customerId, paymentMethodId);
        }
      } else if (session.mode === "payment" && session.payment_status === "paid" && bookingId && customerId) {
        const payment = await getCheckoutPayment(session);
        const kind = session.metadata?.kind;
        if (payment && kind === "prepayment") await recordPrepayment(bookingId, customerId, payment);
        else if (payment && kind === "rest") await recordRestPayment(bookingId, payment);
      }
    } catch (err) {
      // 500 får Stripe til å prøve igjen senere – behandlingen over tåler å kjøres flere ganger.
      console.error("[stripe-webhook] Kunne ikke lagre betalingen:", err);
      return NextResponse.json({ error: "Kunne ikke lagre betalingen." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
