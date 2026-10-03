import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238) for topartsverifisering i admin – samme standard som
 * Google Authenticator, Microsoft Authenticator, 1Password o.l. bruker:
 * 6 sifre, 30-sekunders steg, HMAC-SHA1. Ingen ekstern avhengighet.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
/** Godtar koden fra ett steg før/etter – tåler litt klokkeavvik på telefonen. */
const WINDOW = 1;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Ny hemmelighet, base32 (det formatet appene forventer). 160 bit som anbefalt i RFC 4226. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function currentStep(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

/** Koden for et gitt tidssteg (RFC 4226, dynamisk trunkering). */
export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Sjekker en kode mot gjeldende tidssteg ± WINDOW. Returnerer steget koden
 * gjelder for (lagres for å hindre at samme kode brukes to ganger), eller
 * null. Steg som ikke er nyere enn `lastUsedStep` avvises.
 */
export function verifyTotp(
  secret: string,
  code: string,
  lastUsedStep: number | null = null,
  nowMs: number = Date.now(),
): number | null {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const now = currentStep(nowMs);
  for (let step = now - WINDOW; step <= now + WINDOW; step++) {
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    const expected = Buffer.from(totpCode(secret, step));
    if (timingSafeEqual(expected, Buffer.from(normalized))) return step;
  }
  return null;
}

/** otpauth://-lenken som QR-koden inneholder – appen leser navn, utsteder og hemmelighet herfra. */
export function otpauthUri(secret: string, issuer: string, accountLabel: string): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// --- Reservekoder ---------------------------------------------------------

const RECOVERY_CODE_COUNT = 10;
// Uten lett forvekslbare tegn (0/O, 1/I/L), siden kodene ofte skrives av for hånd.
const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Normaliserer slik at «ABCD-EFGH», «abcd efgh» og «abcdefgh» regnes som samme kode. */
function normalizeRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Lagres som SHA-256 – kodene har ~40 bit tilfeldighet, er engangs og
 * innloggingen er hastighetsbegrenset, så en rask hash er nok (i motsetning
 * til passord, som trenger scrypt).
 */
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

/** 10 engangskoder på formen «abcd-efgh». Vises én gang for eieren – bare hashene lagres. */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const bytes = randomBytes(8);
    const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}

/** Returnerer indeksen til den matchende (ubrukte) koden, eller -1. */
export function findRecoveryCode(code: string, hashes: string[]): number {
  if (!normalizeRecoveryCode(code)) return -1;
  const candidate = Buffer.from(hashRecoveryCode(code));
  return hashes.findIndex((h) => {
    const stored = Buffer.from(h);
    return stored.length === candidate.length && timingSafeEqual(stored, candidate);
  });
}
