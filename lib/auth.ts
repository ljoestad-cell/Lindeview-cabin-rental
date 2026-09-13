import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getStore } from "@/lib/store";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 timer

const MIN_PASSWORD_LENGTH = 10;
const MIN_DIGITS = 2;
const MIN_SPECIAL_CHARS = 1;

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) {
    throw new Error(
      "ADMIN_SESSION_SECRET mangler. Sett en tilfeldig, lang verdi i miljøvariablene før admin-innlogging kan brukes.",
    );
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Konstant-tid strenglikhet, for å unngå timing-angrep på passord/token. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// --- Passord: hashing og styrkekrav -------------------------------------

/** "saltHex:hashHex" – scrypt, ingen ekstern avhengighet nødvendig. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, 64);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Krav: minst 10 tegn, minst 2 tall, minst 1 spesialtegn.
 * Returnerer en feilmelding, eller null hvis passordet er godkjent.
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passordet må være minst ${MIN_PASSWORD_LENGTH} tegn.`;
  }
  const digitCount = (password.match(/\d/g) ?? []).length;
  if (digitCount < MIN_DIGITS) {
    return `Passordet må inneholde minst ${MIN_DIGITS} tall.`;
  }
  const specialCount = (password.match(/[^A-Za-z0-9]/g) ?? []).length;
  if (specialCount < MIN_SPECIAL_CHARS) {
    return `Passordet må inneholde minst ${MIN_SPECIAL_CHARS} spesialtegn.`;
  }
  return null;
}

/**
 * Sjekker passordet mot den lagrede admin-kontoen (lib/admin-account.ts),
 * med ADMIN_PASSWORD som en evig gyldig reserveinngang – én eier, ingen
 * "glemt passord"-e-post, så en fast miljøvariabel er sikkerhetsnettet
 * hvis det egendefinerte passordet glemmes.
 */
export async function isCorrectPassword(candidate: string): Promise<boolean> {
  const account = await getStore().getAdminAccount();
  if (account?.passwordHash && verifyPasswordHash(candidate, account.passwordHash)) {
    return true;
  }

  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword && safeEqual(candidate, envPassword)) return true;

  if (!account?.passwordHash && !envPassword) {
    throw new Error("Verken ADMIN_PASSWORD eller en admin-konto er satt opp.");
  }
  return false;
}

// --- Sesjon --------------------------------------------------------------

/** Setter en signert, httpOnly sesjonscookie. Kalles etter riktig passord. */
export async function createSession(): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = String(expiresAt);
  const token = `${payload}.${sign(payload)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** True hvis forespørselen har en gyldig, ikke-utløpt admin-sesjon. */
export async function hasValidSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(signature, sign(payload))) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return true;
}
