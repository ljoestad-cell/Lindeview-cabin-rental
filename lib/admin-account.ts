import { hashPassword, isCorrectPassword, validatePasswordStrength } from "@/lib/auth";
import { OWNER_EMAIL } from "@/lib/config";
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
    updatedAt: new Date().toISOString(),
  };
}

/** Eierens konto, uten det sensitive passordhash-feltet – trygt å sende til klienten. */
export type PublicAdminAccount = Omit<AdminAccount, "passwordHash">;

function toPublic(account: AdminAccount): PublicAdminAccount {
  const { name, email, mfaEnabled, mfaSecret, updatedAt } = account;
  return { name, email, mfaEnabled, mfaSecret, updatedAt };
}

export async function getAccount(): Promise<PublicAdminAccount> {
  const account = (await getStore().getAdminAccount()) ?? defaultAccount();
  return toPublic(account);
}

export class AccountValidationError extends Error {}

export async function updateProfile(name: string, email: string): Promise<PublicAdminAccount> {
  if (!name.trim()) throw new AccountValidationError("Navn mangler.");
  if (!EMAIL_RE.test(email)) throw new AccountValidationError("Ugyldig e-postadresse.");

  const existing = (await getStore().getAdminAccount()) ?? defaultAccount();
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

  const existing = (await getStore().getAdminAccount()) ?? defaultAccount();
  const updated: AdminAccount = {
    ...existing,
    passwordHash: hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  };
  await getStore().setAdminAccount(updated);
  return { ok: true };
}
