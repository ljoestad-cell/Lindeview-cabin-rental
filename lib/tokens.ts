import { timingSafeEqual } from "node:crypto";

/**
 * Sammenligner en hemmelig token (fra en URL) med den lagrede uten å lekke
 * hvor mange tegn som stemte via svartiden. Brukes for iCal-eksporten og
 * gjestens «Min booking»-lenke.
 */
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
