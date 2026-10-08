import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildApprovalEmail,
  buildCancellationEmail,
  buildPaymentFailedEmail,
  buildDeclinedRequestEmail,
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
  it("inneholder betalingslenke, prislinjer, forskudd og forfallsdato 29 dager før innsjekk", () => {
    const { subject, text, html } = buildApprovalEmail(makeBooking(), "2027-01-15");
    expect(subject).toContain("Booking approved");
    expect(text).toContain("Pay and secure your booking: https://checkout.stripe.com/c/pay/test_123");
    expect(text).toContain("prepayment of €637.50 (25%) now");
    expect(text).toContain("remaining €1,912.50 will be charged automatically");
    expect(text).toContain("3D Secure");
    expect(text).toContain("7 nights × €320.00: €2,240.00");
    expect(text).toContain("EV charging (1): €60.00");
    expect(text).not.toContain("Pets");
    expect(text).toContain("Total: €2,550.00");
    expect(text).toContain("charged automatically to the same card on Fri, 11 June 2027");
    expect(text).toContain("final confirmation as soon as your payment has been received");
    expect(text).toContain("€1,000.00");
    expect(html).toContain('href="https://checkout.stripe.com/c/pay/test_123"');
  });

  it("sier at hele beløpet betales straks ved sen booking", () => {
    const { text } = buildApprovalEmail(makeBooking(), "2027-07-01");
    expect(text).toContain("the total of €2,550.00 is paid when you secure your booking");
    expect(text).not.toContain("prepayment");
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

  it("bekrefter forskuddet og oppgir resten og datoen", () => {
    const booking = makeBooking({
      prepayment: { status: "paid", amount: 637.5, paymentIntentId: "pi_pre", paidAt: "2027-01-15T10:00:00Z" },
      mainCharge: { status: "card_saved", amount: 1912.5, chargeAt: "2027-06-11" } as Booking["mainCharge"],
    });
    const { text } = buildConfirmationEmail(booking);
    expect(text).toContain("received your prepayment of €637.50");
    expect(text).toContain("remaining €1,912.50 will be charged automatically to the same card on Fri, 11 June 2027");
  });

  it("bekrefter mottatt betaling når beløpet allerede er trukket", () => {
    const booking = makeBooking({ mainCharge: { status: "paid", chargeAt: "2027-07-01" } as Booking["mainCharge"] });
    const { text } = buildConfirmationEmail(booking);
    expect(text).toContain("Your payment of €2,550.00 has been received");
  });
});

describe("buildCancellationEmail", () => {
  const byOwner = (overrides: Partial<Booking> = {}) =>
    makeBooking({ status: "declined", cancelledBy: "owner", declineReason: "Water damage in the cabin", ...overrides });
  const byGuest = (overrides: Partial<Booking> = {}) =>
    makeBooking({ status: "declined", cancelledBy: "guest", declineReason: null, ...overrides });
  const paid = (refundedAmount: number | null) => ({
    mainCharge: { status: "paid", refundedAmount } as Booking["mainCharge"],
  });

  it("åpner ulikt etter hvem som tok initiativet, og tar med eierens begrunnelse", () => {
    expect(buildCancellationEmail(byGuest()).text).toContain("As you requested, your booking");
    const owner = buildCancellationEmail(byOwner()).text;
    expect(owner).toContain("Unfortunately we have had to cancel");
    expect(owner).toContain("Reason: Water damage in the cabin");
    expect(owner).toContain("We are very sorry for the inconvenience.");
  });

  it("viser aldri begrunnelse når gjesten selv avbestilte", () => {
    expect(buildCancellationEmail(byGuest({ declineReason: "intern" })).text).not.toContain("Reason:");
  });

  it("sier at ingenting er trukket når hovedbeløpet ikke er betalt", () => {
    const { subject, text } = buildCancellationEmail(byGuest());
    expect(subject).toContain("Booking cancelled");
    expect(text).toContain("Nothing has been charged to your card");
  });

  it("oppgir full og delvis refusjon", () => {
    expect(buildCancellationEmail(byOwner(paid(2550))).text).toContain("We have refunded €2,550.00 to your card");
    const partial = buildCancellationEmail(byGuest(paid(1000))).text;
    expect(partial).toContain("We have refunded €1,000.00");
    expect(partial).toContain("remaining €1,550.00 of your payment of €2,550.00 is non-refundable");
  });

  it("holder tilbake gebyret av forskuddet ved tidlig avbestilling", () => {
    const text = buildCancellationEmail(
      byGuest({
        prepayment: { status: "paid", amount: 637.5, paymentIntentId: "pi_pre", paidAt: null },
        mainCharge: { status: "card_saved", amount: 1912.5, refundedAmount: 587.5 } as Booking["mainCharge"],
        refunds: [
          { id: "r1", target: "prepayment", extraChargeId: null, amount: 587.5, reason: "", createdAt: "", stripeRefundId: null },
        ],
      }),
    ).text;
    expect(text).toContain("We have refunded €587.50");
    expect(text).toContain("remaining €50.00 of your payment of €637.50 is non-refundable");
    expect(text).toContain("No further payments will be taken.");
  });

  it("sier at forskuddet ikke refunderes ved sen avbestilling", () => {
    const text = buildCancellationEmail(
      byGuest({
        prepayment: { status: "paid", amount: 637.5, paymentIntentId: "pi_pre", paidAt: null },
        mainCharge: { status: "failed", amount: 1912.5, refundedAmount: 0 } as Booking["mainCharge"],
      }),
    ).text;
    expect(text).toContain("your prepayment of €637.50 is non-refundable");
  });

  it("forklarer vilkårene når ingenting refunderes, og lover ikke refusjon som feilet", () => {
    expect(buildCancellationEmail(byGuest(paid(0))).text).toContain("non-refundable for cancellations made less than 30 days");
    expect(buildCancellationEmail(byOwner(paid(null))).text).toContain("We will be in touch about the refund");
  });

  it("escaper HTML i navn og begrunnelse", () => {
    const { html } = buildCancellationEmail(byOwner({ declineReason: "<script>x</script>" }));
    expect(html).toContain("Anna &lt;b&gt;Smith&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("buildDeclinedRequestEmail", () => {
  it("sier at forespørselen ikke kan bekreftes, med begrunnelse og lenke til ny forespørsel", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://lindeview.no");
    const booking = makeBooking({
      status: "declined",
      cancelledBy: "owner",
      declineReason: "Another request for overlapping dates was confirmed first",
    });
    const { subject, text, html } = buildDeclinedRequestEmail(booking);
    expect(subject).toContain("Booking request not confirmed");
    expect(text).toContain("Unfortunately we are not able to confirm your booking request");
    expect(text).toContain("Reason: Another request for overlapping dates was confirmed first");
    expect(text).toContain("Nothing has been charged.");
    expect(html).toContain('href="https://lindeview.no/book"');
    vi.unstubAllEnvs();
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

  it("går til hver mottaker i egne e-poster, med svar til gjesten", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM_EMAIL", "Lindeview <booking@lindeview.no>");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyOwnerOfBooking(makeBooking(), [OWNER_EMAIL, "a@example.com", "b@example.com"]);

    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(bodies.map((b) => b.to)).toEqual([OWNER_EMAIL, "a@example.com", "b@example.com"]);
    expect(bodies.every((b) => b.reply_to === "anna@example.com")).toBe(true);
  });

  it("varsler bare eieren uten verifisert avsender (sandkassen når ikke andre)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyOwnerOfBooking(makeBooking(), ["a@example.com", OWNER_EMAIL]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).to).toBe(OWNER_EMAIL);
  });

  it("én mottaker som feiler stopper ikke de andre", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM_EMAIL", "Lindeview <booking@lindeview.no>");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 403 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(notifyOwnerOfBooking(makeBooking(), ["a@example.com", OWNER_EMAIL])).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sender ingenting når alle mottakere er skrudd av", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await notifyOwnerOfBooking(makeBooking(), []);
    expect(fetchMock).not.toHaveBeenCalled();
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

describe("buildPaymentFailedEmail", () => {
  it("ber gjesten betale resten via sin bookingside", () => {
    const booking = makeBooking({
      guestToken: "tok123",
      mainCharge: { status: "failed", amount: 1912.5 } as Booking["mainCharge"],
    });
    const { subject, text, html } = buildPaymentFailedEmail(booking);
    expect(subject).toContain("Payment needed");
    expect(text).toContain("remaining €1,912.50");
    expect(text).toMatch(/Pay the remaining amount: .*\/booking\/tok123/);
    expect(html).toContain("/booking/tok123");
  });
});
