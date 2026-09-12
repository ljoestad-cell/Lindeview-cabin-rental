import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { attachPaymentMethod } from "@/lib/bookings";
import { getPaymentMethodFromSetupIntent } from "@/lib/payments";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe-webhook. Må lese raw body (ikke request.json()) for at
 * signaturverifiseringen skal stemme. Håndterer kun setup-økten som lagrer
 * gjestens kort – selve belastningene skjer off-session andre steder
 * (cron-jobben / admin-knapper) og trenger ingen webhook.
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

    if (session.mode === "setup" && bookingId && customerId && setupIntentId) {
      try {
        const paymentMethodId = await getPaymentMethodFromSetupIntent(setupIntentId);
        if (paymentMethodId) {
          await attachPaymentMethod(bookingId, customerId, paymentMethodId);
        }
      } catch (err) {
        console.error("[stripe-webhook] Kunne ikke lagre betalingsmetode:", err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
