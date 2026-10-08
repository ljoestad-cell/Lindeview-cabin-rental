import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminAccount } from "@/lib/types";

let stored: AdminAccount | null = null;
vi.mock("@/lib/store", () => ({
  getStore: () => ({
    getAdminAccount: async () => stored,
    setAdminAccount: async (account: AdminAccount) => {
      stored = account;
      return account;
    },
  }),
}));

const { addNotifyRecipient, getAccount, getBookingNotifyEmails, removeNotifyRecipient, setNotifyRecipientEnabled } =
  await import("@/lib/admin-account");
const { OWNER_EMAIL } = await import("@/lib/property");

beforeEach(() => {
  stored = null;
  vi.stubEnv("BOOKING_REQUEST_EXTRA_EMAILS", " a@example.com , ugyldig, A@example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mottakere av varsel om nye bookinger", () => {
  it("starter med eieren og adressene fra BOOKING_REQUEST_EXTRA_EMAILS, uten duplikater", async () => {
    const { bookingNotifyRecipients } = await getAccount();
    expect(bookingNotifyRecipients).toEqual([
      { email: OWNER_EMAIL, enabled: true },
      { email: "a@example.com", enabled: true },
    ]);
  });

  it("legger til, skrur av og fjerner – og bare de som er på får varsel", async () => {
    await addNotifyRecipient("  ny@example.com ");
    await setNotifyRecipientEnabled("A@EXAMPLE.COM", false);
    expect(await getBookingNotifyEmails()).toEqual([OWNER_EMAIL, "ny@example.com"]);

    await removeNotifyRecipient("ny@example.com");
    expect((await getAccount()).bookingNotifyRecipients.map((r) => r.email)).toEqual([OWNER_EMAIL, "a@example.com"]);
  });

  it("lagret liste vinner over miljøvariabelen", async () => {
    await setNotifyRecipientEnabled(OWNER_EMAIL, false);
    vi.stubEnv("BOOKING_REQUEST_EXTRA_EMAILS", "annen@example.com");
    expect(await getBookingNotifyEmails()).toEqual(["a@example.com"]);
  });

  it("avviser ugyldige adresser og duplikater", async () => {
    await expect(addNotifyRecipient("ugyldig")).rejects.toThrow("Ugyldig e-postadresse.");
    await expect(addNotifyRecipient("A@example.com")).rejects.toThrow("allerede i listen");
  });
});
