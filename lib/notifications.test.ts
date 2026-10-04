import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildApprovalEmail,
  buildConfirmationEmail,
  notifyGuestOfApproval,
  notifyGuestOfConfirmation,
  notifyOwnerOfBooking,
} from "@/lib/notifications";
import { OWNER_EMAIL } from "@/lib/property";
import type { Booking } from "@/lib/types";

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "abc",
    status: "confirmed",
    checkIn: "2027-07-10",
    checkOut: "2027-07-17",
    nights: 7,
    guests: 4,
    name: "Anna <b>Smith</b>",
    email: "anna@example.com",
    pricing: {
      nights: 7,
      nightlyRate: 320,
      nightsTotal: 2240,
      cleaningFee: 250,
      extras: { evChargers: 1, pets: 0, bedding: 0 },
      evChargerTotal: 60,
      petTotal: 0,
      beddingTotal: 0,
      extrasTotal: 60,
      total: 2550,
      currency: "EUR",
    },
    secureCardUrl: "https://checkout.stripe.com/c/pay/test_123",
    mainCharge: { status: "not_saved", chargeAt: null },
    deposit: { amount: 1000 },
    guestEmails: { approvalSentAt: null, confirmationSentAt: null },
    ...overrides,
  } as unknown as Booking;
}

describe("buildApprovalEmail", () => {
  it("inneholder betalingslenke, prislinjer og forfallsdato 29 dager før innsjekk", () => {
    const { subject, text, html } = buildApprovalEmail(makeBooking(), "2027-01-15");
    expect(subject).toContain("Booking approved");
    expect(text).toContain("Secure your card: https://checkout.stripe.com/c/pay/test_123");
    expect(text).toContain("7 nights × €320.00: €2,240.00");
    expect(text).toContain("EV charging (1): €60.00");
    expect(text).not.toContain("Pets");
    expect(text).toContain("Total: €2,550.00");
    expect(text).toContain("charged automatically on Fri, 11 June 2027");
    expect(text).toContain("final confirmation as soon as your payment method has been verified");
    expect(text).toContain("€1,000.00");
    expect(html).toContain('href="https://checkout.stripe.com/c/pay/test_123"');
  });

  it("sier at beløpet trekkes straks ved sen booking", () => {
    const { text } = buildApprovalEmail(makeBooking(), "2027-07-01");
    expect(text).toContain("will be charged as soon as your card is secured");
  });

  it("escaper HTML i gjestens navn", () => {
    const { html } = buildApprovalEmail(makeBooking(), "2027-01-15");
    expect(html).toContain("Anna &lt;b&gt;Smith&lt;/b&gt;");
    expect(html).not.toContain("<b>Smith</b>");
  });
});

describe("buildConfirmationEmail", () => {
  it("oppgir belastningsdato når kortet bare er sikret", () => {
    const booking = makeBooking({ mainCharge: { status: "card_saved", chargeAt: "2027-06-11" } as Booking["mainCharge"] });
    const { subject, text } = buildConfirmationEmail(booking);
    expect(subject).toContain("Booking confirmed");
    expect(text).toContain("Your card has been registered");
    expect(text).toContain("charged automatically on Fri, 11 June 2027");
  });

  it("bekrefter mottatt betaling når beløpet allerede er trukket", () => {
    const booking = makeBooking({ mainCharge: { status: "paid", chargeAt: "2027-07-01" } as Booking["mainCharge"] });
    const { text } = buildConfirmationEmail(booking);
    expect(text).toContain("Your payment of €2,550.00 has been received");
  });
});

describe("«Min booking»-lenke i gjeste-e-postene", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("tas med i begge e-postene når bookingen har token", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://lindeview.no");
    const booking = makeBooking({ guestToken: "tok-123" });
    const url = "https://lindeview.no/booking/tok-123";
    for (const email of [buildApprovalEmail(booking, "2027-01-15"), buildConfirmationEmail(booking)]) {
      expect(email.text).toContain(`View your booking (status, payment card, cancellation): ${url}`);
      expect(email.html).toContain(`href="${url}"`);
    }
  });

  it("utelates for eldre bookinger uten token", () => {
    const { text, html } = buildConfirmationEmail(makeBooking({ guestToken: null }));
    expect(text).not.toContain("View your booking");
    expect(html).not.toContain("/booking/");
  });
});

describe("varsel om ny bookingforespørsel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("går til eieren og hver ekstra mottaker i egne e-poster, med svar til gjesten", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM_EMAIL", "Lindeview <booking@lindeview.no>");
    vi.stubEnv("BOOKING_REQUEST_EXTRA_EMAILS", " a@example.com , ugyldig, b@example.com");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyOwnerOfBooking(makeBooking());

    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(bodies.map((b) => b.to)).toEqual([OWNER_EMAIL, "a@example.com", "b@example.com"]);
    expect(bodies.every((b) => b.reply_to === "anna@example.com")).toBe(true);
  });

  it("varsler bare eieren uten verifisert avsender (sandkassen når ikke andre)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    vi.stubEnv("BOOKING_REQUEST_EXTRA_EMAILS", "a@example.com");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyOwnerOfBooking(makeBooking());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).to).toBe(OWNER_EMAIL);
  });

  it("eierens varsel er sendt selv om en ekstra mottaker feiler", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM_EMAIL", "Lindeview <booking@lindeview.no>");
    vi.stubEnv("BOOKING_REQUEST_EXTRA_EMAILS", "a@example.com");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("nope", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(notifyOwnerOfBooking(makeBooking())).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("sending til gjesten", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sender til gjestens adresse fra verifisert avsender, med svar til eieren", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM_EMAIL", "Lindeview <booking@lindeview.no>");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(notifyGuestOfApproval(makeBooking())).resolves.toBe(true);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toBe("anna@example.com");
    expect(body.from).toBe("Lindeview <booking@lindeview.no>");
    expect(body.reply_to).toBe(OWNER_EMAIL);
    expect(body.html).toContain("<!doctype html>");
  });

  it("sender ingenting uten RESEND_FROM_EMAIL (sandkassen kan ikke nå gjester)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(notifyGuestOfConfirmation(makeBooking())).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("kaster når Resend svarer med feil", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM_EMAIL", "Lindeview <booking@lindeview.no>");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 403 })));

    await expect(notifyGuestOfConfirmation(makeBooking())).rejects.toThrow("Resend svarte 403");
  });
});
