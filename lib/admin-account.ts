import { randomUUID } from "node:crypto";
import { hashPassword, isCorrectPassword, validatePasswordStrength } from "@/lib/auth";
import { OWNER_EMAIL } from "@/lib/property";
import { getStore } from "@/lib/store";
import type { AdminAccount } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function defaultAccount(): AdminAccount {
  return {
    name: "",
    email: OWNER_EMAIL,
    passwordHash: "",
    mfaEnabled: false,
    mfaSecret: null,
    icalExportToken: randomUUID(),
    airbnbIcalUrl: null,
    airbnbIcalSyncedAt: null,
    updatedAt: new Date().toISOString(),
  };
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
    airbnbIcalSyncedAt: base.airbnbIcalSyncedAt ?? null,
  };
  if (!existing || needsToken) {
    await getStore().setAdminAccount(account);
  }
  return account;
}

/** Eierens konto, uten det sensitive passordhash-feltet – trygt å sende til klienten. */
export type PublicAdminAccount = Omit<AdminAccount, "passwordHash">;

function toPublic(account: AdminAccount): PublicAdminAccount {
  const { name, email, mfaEnabled, mfaSecret, icalExportToken, airbnbIcalUrl, airbnbIcalSyncedAt, updatedAt } =
    account;
  return { name, email, mfaEnabled, mfaSecret, icalExportToken, airbnbIcalUrl, airbnbIcalSyncedAt, updatedAt };
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

/** Kalt av kalendersynken (lib/bookings.ts) etter hvert forsøk, som en enkel helsesjekk i admin-UI. */
export async function recordAirbnbSync(): Promise<void> {
  const existing = await loadAccount();
  await getStore().setAdminAccount({ ...existing, airbnbIcalSyncedAt: new Date().toISOString() });
}
