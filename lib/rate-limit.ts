import type { NextRequest } from "next/server";
import { getStore } from "@/lib/store";

/**
 * Enkel fast-vindu-begrensning per IP, lagret i samme lager som bookingene
 * (Redis i produksjon). Brukes mot passordgjetting på admin-innloggingen og
 * spam på det åpne bookingskjemaet.
 */
export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 15 * 60 },
  booking: { limit: 5, windowSeconds: 60 * 60 },
} as const;

/** Klientens IP – Vercel setter x-forwarded-for, første adresse er klienten. */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** Registrerer ett forsøk og returnerer true hvis grensen er overskredet. */
export async function isRateLimited(kind: keyof typeof RATE_LIMITS, request: NextRequest): Promise<boolean> {
  const { limit, windowSeconds } = RATE_LIMITS[kind];
  const count = await getStore().incrementCounter(`${kind}:${clientIp(request)}`, windowSeconds);
  return count > limit;
}
