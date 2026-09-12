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

/**
 * Nettsidens egen URL, til bruk i Stripe Checkout sine success/cancel-URLer.
 * Faller tilbake til Vercel sin auto-satte produksjons-URL, så til localhost i dev.
 */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}
