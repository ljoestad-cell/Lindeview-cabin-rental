/**
 * Nettsidens egen URL – brukt i Stripe Checkout sine success/cancel-URLer,
 * og som base for sitemap, robots og Open Graph-bilder.
 * Faller tilbake til Vercel sin auto-satte produksjons-URL, så til localhost i dev.
 */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}
