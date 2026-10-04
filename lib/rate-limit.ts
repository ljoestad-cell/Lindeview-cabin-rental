import { getStore } from "@/lib/store";

/**
 * Enkel fast-vindu-begrensning per IP, lagret i samme lager som bookingene
 * (Redis i produksjon). Brukes mot passordgjetting på admin-innloggingen og
 * spam på det åpne bookingskjemaet.
 */
export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 15 * 60 },
  /** Feilede kodeforsøk (se isBlocked/recordFailure) – 6 sifre tåler ikke mange gjett. */
  mfa: { limit: 5, windowSeconds: 15 * 60 },
  booking: { limit: 5, windowSeconds: 60 * 60 },
  /** Ukjente «Min booking»-tokens (se isBlocked/recordFailure) – stopper gjetting av lenker. */
  guestToken: { limit: 20, windowSeconds: 15 * 60 },
  /** Handlinger fra «Min booking» (ny kortlenke, be om avbestilling). */
  guestAction: { limit: 10, windowSeconds: 60 * 60 },
} as const;

/** Det rate limit trenger fra en forespørsel – en NextRequest, eller `{ headers: await headers() }` i en side. */
type RequestLike = { headers: { get(name: string): string | null } };

/** Klientens IP – Vercel setter x-forwarded-for, første adresse er klienten. */
export function clientIp(request: RequestLike): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** Registrerer ett forsøk og returnerer true hvis grensen er overskredet. */
export async function isRateLimited(kind: keyof typeof RATE_LIMITS, request: RequestLike): Promise<boolean> {
  const { limit, windowSeconds } = RATE_LIMITS[kind];
  const count = await getStore().incrementCounter(`${kind}:${clientIp(request)}`, windowSeconds);
  return count > limit;
}

/**
 * For kodesjekker (MFA): sperrer først når grensen for *feilede* forsøk er
 * nådd, så vellykkede innlogginger og oppsett ikke teller mot eieren.
 * Brukes sammen med recordFailure().
 */
export async function isBlocked(kind: keyof typeof RATE_LIMITS, request: RequestLike): Promise<boolean> {
  const { limit } = RATE_LIMITS[kind];
  return (await getStore().getCounter(`${kind}:${clientIp(request)}`)) >= limit;
}

export async function recordFailure(kind: keyof typeof RATE_LIMITS, request: RequestLike): Promise<void> {
  await getStore().incrementCounter(`${kind}:${clientIp(request)}`, RATE_LIMITS[kind].windowSeconds);
}
