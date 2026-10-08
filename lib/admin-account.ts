import { randomUUID } from "node:crypto";
import { hashPassword, isCorrectPassword, validatePasswordStrength } from "@/lib/auth";
import { OWNER_EMAIL, PROPERTY_NAME } from "@/lib/property";
import { getStore } from "@/lib/store";
import {
  findRecoveryCode,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUri,
  verifyTotp,
} from "@/lib/totp";
import type { AdminAccount, NotifyRecipient } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function defaultAccount(): AdminAccount {
  return {
    name: "",
    email: OWNER_EMAIL,
    passwordHash: "",
    mfaEnabled: false,
    mfaSecret: null,
    mfaPendingSecret: null,
    mfaRecoveryCodes: [],
    mfaLastUsedStep: null,
    icalExportToken: randomUUID(),
    airbnbIcalUrl: null,
    airbnbSyncEnabled: true,
    airbnbIcalSyncedAt: null,
    bookingNotifyRecipients: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Maks antall mottakere av varsel om nye bookinger. */
export const MAX_NOTIFY_RECIPIENTS = 10;

/**
 * Mottakerne før eieren har endret noe i «Min konto»: eieren selv, pluss
 * adressene i BOOKING_REQUEST_EXTRA_EMAILS (slik det var før listen fantes).
 * Ligger i miljøet, ikke i koden, fordi repoet er offentlig.
 */
function defaultNotifyRecipients(): NotifyRecipient[] {
  const extra = (process.env.BOOKING_REQUEST_EXTRA_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => EMAIL_RE.test(e));
  const emails = [OWNER_EMAIL, ...extra].filter(
    (e, i, all) => all.findIndex((x) => x.toLowerCase() === e.toLowerCase()) === i,
  );
  return emails.map((email) => ({ email, enabled: true }));
}

/**
 * Henter kontoen og fyller inn felter som mangler på eldre lagrede kontoer
 * (samme `??`-mønster som normalizeBooking i lib/bookings.ts). `icalExportToken`
 * må forbli stabil når den først er generert, siden den ligger i en URL
 * eieren limer inn i Airbnb – derfor lagres den tilbake med én gang.
 */
async function loadAccount(): Promise<AdminAccount> {
  const existing = await getStore().getAdminAccount();
  const base = existing ?? defaultAccount();
  const needsToken = !base.icalExportToken;
  const account: AdminAccount = {
    ...base,
    icalExportToken: base.icalExportToken || randomUUID(),
    airbnbIcalUrl: base.airbnbIcalUrl ?? null,
    airbnbSyncEnabled: base.airbnbSyncEnabled ?? true,
    airbnbIcalSyncedAt: base.airbnbIcalSyncedAt ?? null,
    bookingNotifyRecipients: base.bookingNotifyRecipients ?? defaultNotifyRecipients(),
    mfaEnabled: base.mfaEnabled ?? false,
    mfaSecret: base.mfaSecret ?? null,
    mfaPendingSecret: base.mfaPendingSecret ?? null,
    mfaRecoveryCodes: base.mfaRecoveryCodes ?? [],
    mfaLastUsedStep: base.mfaLastUsedStep ?? null,
  };
  if (!existing || needsToken) {
    await getStore().setAdminAccount(account);
  }
  return account;
}

/** Eierens konto uten passordhash og MFA-hemmeligheter – trygt å sende til klienten. */
export type PublicAdminAccount = Omit<
  AdminAccount,
  "passwordHash" | "mfaSecret" | "mfaPendingSecret" | "mfaRecoveryCodes" | "mfaLastUsedStep" | "bookingNotifyRecipients"
> & {
  bookingNotifyRecipients: NotifyRecipient[];
  /** Antall ubrukte reservekoder – selve kodene vises bare én gang, ved oppsett. */
  mfaRecoveryCodesLeft: number;
};

function toPublic(account: AdminAccount): PublicAdminAccount {
  const {
    name,
    email,
    mfaEnabled,
    mfaRecoveryCodes,
    icalExportToken,
    airbnbIcalUrl,
    airbnbSyncEnabled,
    airbnbIcalSyncedAt,
    bookingNotifyRecipients,
    updatedAt,
  } = account;
  return {
    name,
    email,
    mfaEnabled,
    mfaRecoveryCodesLeft: mfaRecoveryCodes.length,
    icalExportToken,
    airbnbIcalUrl,
    airbnbSyncEnabled,
    airbnbIcalSyncedAt,
    bookingNotifyRecipients: bookingNotifyRecipients ?? [],
    updatedAt,
  };
}

export async function getAccount(): Promise<PublicAdminAccount> {
  return toPublic(await loadAccount());
}

export class AccountValidationError extends Error {}

export async function updateProfile(name: string, email: string): Promise<PublicAdminAccount> {
  if (!name.trim()) throw new AccountValidationError("Navn mangler.");
  if (!EMAIL_RE.test(email)) throw new AccountValidationError("Ugyldig e-postadresse.");

  const existing = await loadAccount();
  const updated: AdminAccount = {
    ...existing,
    name: name.trim(),
    email: email.trim(),
    updatedAt: new Date().toISOString(),
  };
  await getStore().setAdminAccount(updated);
  return toPublic(updated);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const correct = await isCorrectPassword(currentPassword);
  if (!correct) return { ok: false, error: "Nåværende passord er feil." };

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) return { ok: false, error: strengthError };

  const existing = await loadAccount();
  const updated: AdminAccount = {
    ...existing,
    passwordHash: hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  };
  await getStore().setAdminAccount(updated);
  return { ok: true };
}

/** Lagrer Airbnb sin iCal-eksport-URL (limt inn av eieren i «Min konto»), brukt av den daglige kalendersynken. Tom streng fjerner den (skrur av import). */
export async function updateAirbnbIcalUrl(url: string): Promise<PublicAdminAccount> {
  const trimmed = url.trim();
  if (trimmed) {
    try {
      new URL(trimmed);
    } catch {
      throw new AccountValidationError("Ugyldig URL.");
    }
  }

  const existing = await loadAccount();
  const updated: AdminAccount = {
    ...existing,
    airbnbIcalUrl: trimmed || null,
    updatedAt: new Date().toISOString(),
  };
  await getStore().setAdminAccount(updated);
  return toPublic(updated);
}

/** Av/på-bryter for Airbnb-synken i «Min konto» – lar eieren pause den uten å slette den lagrede URL-en. */
export async function updateAirbnbSyncEnabled(enabled: boolean): Promise<PublicAdminAccount> {
  const existing = await loadAccount();
  const updated: AdminAccount = { ...existing, airbnbSyncEnabled: enabled, updatedAt: new Date().toISOString() };
  await getStore().setAdminAccount(updated);
  return toPublic(updated);
}

// --- Varsel om nye bookinger ---------------------------------------------

/** Adressene som skal ha e-post om en ny bookingforespørsel (de som er skrudd på). */
export async function getBookingNotifyEmails(): Promise<string[]> {
  const account = await loadAccount();
  return (account.bookingNotifyRecipients ?? []).filter((r) => r.enabled).map((r) => r.email);
}

async function saveNotifyRecipients(
  update: (recipients: NotifyRecipient[]) => NotifyRecipient[],
): Promise<PublicAdminAccount> {
  const existing = await loadAccount();
  const updated: AdminAccount = {
    ...existing,
    bookingNotifyRecipients: update(existing.bookingNotifyRecipients ?? []),
    updatedAt: new Date().toISOString(),
  };
  await getStore().setAdminAccount(updated);
  return toPublic(updated);
}

function sameEmail(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Legger til en mottaker (skrudd på). Kaster ved ugyldig adresse, duplikat eller for mange. */
export async function addNotifyRecipient(email: string): Promise<PublicAdminAccount> {
  const trimmed = email.trim();
  if (!EMAIL_RE.test(trimmed)) throw new AccountValidationError("Ugyldig e-postadresse.");
  const existing = (await loadAccount()).bookingNotifyRecipients ?? [];
  if (existing.some((r) => sameEmail(r.email, trimmed))) {
    throw new AccountValidationError("Adressen står allerede i listen.");
  }
  if (existing.length >= MAX_NOTIFY_RECIPIENTS) {
    throw new AccountValidationError(`Maks ${MAX_NOTIFY_RECIPIENTS} mottakere.`);
  }
  return saveNotifyRecipients((list) => [...list, { email: trimmed, enabled: true }]);
}

/** Skrur varsel av/på for én mottaker uten å fjerne den. */
export async function setNotifyRecipientEnabled(email: string, enabled: boolean): Promise<PublicAdminAccount> {
  return saveNotifyRecipients((list) => list.map((r) => (sameEmail(r.email, email) ? { ...r, enabled } : r)));
}

export async function removeNotifyRecipient(email: string): Promise<PublicAdminAccount> {
  return saveNotifyRecipients((list) => list.filter((r) => !sameEmail(r.email, email)));
}

/** Kalt av kalendersynken (lib/bookings.ts) etter hvert forsøk, som en enkel helsesjekk i admin-UI. */
export async function recordAirbnbSync(): Promise<void> {
  const existing = await loadAccount();
  await getStore().setAdminAccount({ ...existing, airbnbIcalSyncedAt: new Date().toISOString() });
}

// --- Topartsverifisering (TOTP) ------------------------------------------

/**
 * Nødbryter: ADMIN_MFA_DISABLED=true i miljøvariablene slår av kravet om kode
 * ved innlogging (f.eks. mistet telefon og reservekoder). Den som kan sette
 * miljøvariabler i Vercel har uansett full kontroll, så dette svekker ikke
 * sikkerheten.
 */
function mfaBypassed(): boolean {
  return process.env.ADMIN_MFA_DISABLED === "true";
}

/** True hvis innloggingen skal be om kode etter passordet. */
export async function isMfaRequired(): Promise<boolean> {
  if (mfaBypassed()) return false;
  const account = await loadAccount();
  return account.mfaEnabled && Boolean(account.mfaSecret);
}

/**
 * Steg 1 av oppsettet: lager en ny hemmelighet (lagres som «under oppsett»)
 * og returnerer otpauth-lenken QR-koden bygges fra. Ingenting endres i
 * innloggingen før eieren har bekreftet med en gyldig kode.
 */
export async function startMfaSetup(): Promise<{ secret: string; uri: string }> {
  const existing = await loadAccount();
  if (existing.mfaEnabled) throw new AccountValidationError("Topartsverifisering er allerede på.");
  const secret = generateTotpSecret();
  await getStore().setAdminAccount({ ...existing, mfaPendingSecret: secret, updatedAt: new Date().toISOString() });
  return { secret, uri: otpauthUri(secret, PROPERTY_NAME, existing.email || "admin") };
}

/**
 * Steg 2: eieren skriver inn koden appen viser. Riktig kode slår på MFA og
 * returnerer reservekodene i klartekst – den eneste gangen de vises.
 */
export async function confirmMfaSetup(code: string): Promise<{ account: PublicAdminAccount; recoveryCodes: string[] }> {
  const existing = await loadAccount();
  if (existing.mfaEnabled) throw new AccountValidationError("Topartsverifisering er allerede på.");
  if (!existing.mfaPendingSecret) throw new AccountValidationError("Start oppsettet på nytt.");

  const step = verifyTotp(existing.mfaPendingSecret, code);
  if (step === null) throw new AccountValidationError("Feil kode. Sjekk at klokken på telefonen er riktig, og prøv igjen.");

  const recoveryCodes = generateRecoveryCodes();
  const updated: AdminAccount = {
    ...existing,
    mfaEnabled: true,
    mfaSecret: existing.mfaPendingSecret,
    mfaPendingSecret: null,
    mfaRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
    mfaLastUsedStep: step,
    updatedAt: new Date().toISOString(),
  };
  await getStore().setAdminAccount(updated);
  return { account: toPublic(updated), recoveryCodes };
}

/**
 * Sjekker en kode fra appen, eller en reservekode (som da brukes opp).
 * Kalles fra innloggingens andre steg.
 */
export async function verifyMfaCode(code: string): Promise<boolean> {
  const existing = await loadAccount();
  if (!existing.mfaEnabled || !existing.mfaSecret) return false;

  const step = verifyTotp(existing.mfaSecret, code, existing.mfaLastUsedStep);
  if (step !== null) {
    await getStore().setAdminAccount({ ...existing, mfaLastUsedStep: step });
    return true;
  }

  const index = findRecoveryCode(code, existing.mfaRecoveryCodes);
  if (index === -1) return false;
  const mfaRecoveryCodes = existing.mfaRecoveryCodes.filter((_, i) => i !== index);
  await getStore().setAdminAccount({ ...existing, mfaRecoveryCodes });
  return true;
}

/** Slår av MFA – krever både passord og en gyldig kode (eller reservekode). */
export async function disableMfa(password: string, code: string): Promise<PublicAdminAccount> {
  if (!(await isCorrectPassword(password))) throw new AccountValidationError("Feil passord.");
  if (!(await verifyMfaCode(code))) throw new AccountValidationError("Feil kode.");

  const existing = await loadAccount();
  const updated: AdminAccount = {
    ...existing,
    mfaEnabled: false,
    mfaSecret: null,
    mfaPendingSecret: null,
    mfaRecoveryCodes: [],
    mfaLastUsedStep: null,
    updatedAt: new Date().toISOString(),
  };
  await getStore().setAdminAccount(updated);
  return toPublic(updated);
}
