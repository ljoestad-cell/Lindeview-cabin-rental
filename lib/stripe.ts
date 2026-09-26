import Stripe from "stripe";

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Kaster hvis STRIPE_SECRET_KEY mangler – kalleren sjekker isStripeConfigured() først. */
export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY mangler.");
    client = new Stripe(key);
  }
  return client;
}
