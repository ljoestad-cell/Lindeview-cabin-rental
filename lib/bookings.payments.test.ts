import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { earlyCancellationRefund } from "@/lib/cancellation";
import { DEFAULT_DEPOSIT, DEFAULT_GUEST_EMAILS, DEFAULT_MAIN_CHARGE, DEFAULT_PREPAYMENT, type Booking } from "@/lib/types";

/**
 * Betalingsflyten i lib/bookings.ts med Stripe, lager og e-post byttet ut:
 * forskudd → automatisk trekk av resten → feilet trekk → gjesten betaler
 * selv, og refusjon ved avbestilling.
 */

const db = new Map<string, Booking>();

vi.mock("@/lib/store", () => ({
  getStore: () => ({
    listBookings: async () => [...db.values()],
    getBooking: async (id: string) => db.get(id) ?? null,
    updateBooking: async (id: string, patch: Partial<Booking>) => {
      const current = db.get(id);
      if (!current) return null;
      const next = { ...current, ...patch };
      db.set(id, next);
      return next;
    },
    listBlockedRanges: async () => [],
  }),
}));

vi.mock("@/lib/stripe", () => ({ isStripeConfigured: () => true }));
vi.mock("@/lib/calendar", () => ({ upsertEvent: vi.fn(async () => null), deleteEvent: vi.fn(async () => {}) }));

const payments = vi.hoisted(() => ({
  chargeMainAmount: vi.fn(),
  refundPayment: vi.fn(),
  createRestPaymentSession: vi.fn(async () => "https://checkout.stripe.com/rest"),
}));
vi.mock("@/lib/payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/payments")>()),
  ...payments,
}));

const notifications = vi.hoisted(() => ({
  notifyGuestOfConfirmation: vi.fn(async () => true),
  notifyGuestOfPaymentFailed: vi.fn(async () => true),
  notifyGuestOfCancellation: vi.fn(async () => true),
  notifyOwnerOfPaymentIssue: vi.fn(async () => {}),
  notifyOwnerOfRestPaid: vi.fn(async () => {}),
}));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  ...notifications,
}));

const { recordPrepayment, recordRestPayment, runDueCharges, setStatus, startGuestRestPayment } = await import(
  "@/lib/bookings"
);

const TOTAL = 2550;
const PREPAY = 637.5;
const REST = 1912.5;

function seed(overrides: Partial<Booking> = {}): Booking {
  const booking = {
    id: "b1",
    createdAt: "2027-01-01T10:00:00Z",
    status: "confirmed",
    checkIn: "2027-07-10",
    checkOut: "2027-07-17",
    nights: 7,
    guests: 4,
    name: "Anna",
    email: "anna@example.com",
    phone: "1",
    message: "",
    pricing: { total: TOTAL },
    stripeCustomerId: "cus_1",
    defaultPaymentMethodId: null,
    secureCardUrl: "https://checkout.stripe.com/pre",
    prepayment: { ...DEFAULT_PREPAYMENT },
    mainCharge: { ...DEFAULT_MAIN_CHARGE },
    deposit: { ...DEFAULT_DEPOSIT, amount: 1000 },
    extraCharges: [],
    refunds: [],
    guestEmails: { ...DEFAULT_GUEST_EMAILS },
    guestToken: "tok",
    cancellationRequest: null,
    cancelledBy: null,
    declineReason: null,
    ...overrides,
  } as Booking;
  db.set(booking.id, booking);
  return booking;
}

const prepayment = { paymentIntentId: "pi_pre", paymentMethodId: "pm_1", amount: PREPAY };

beforeEach(() => {
  db.clear();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-01-15T12:00:00Z"));
  payments.refundPayment.mockImplementation(async () => ({ ok: true, paymentIntentId: `re_${Math.random()}` }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("forskudd", () => {
  it("lagrer forskudd og kort, planlegger resten 29 dager før innsjekk og bekrefter én gang", async () => {
    seed();
    await recordPrepayment("b1", "cus_1", prepayment);
    await recordPrepayment("b1", "cus_1", prepayment); // Stripe leverer samme webhook igjen

    const b = db.get("b1")!;
    expect(b.prepayment).toMatchObject({ status: "paid", amount: PREPAY, paymentIntentId: "pi_pre" });
    expect(b.defaultPaymentMethodId).toBe("pm_1");
    expect(b.mainCharge).toMatchObject({ status: "card_saved", amount: REST, chargeAt: "2027-06-11" });
    expect(notifications.notifyGuestOfConfirmation).toHaveBeenCalledTimes(1);
    expect(payments.chargeMainAmount).not.toHaveBeenCalled();
  });

  it("sen bestilling: hele leien betalt med forskuddet, ingenting igjen å trekke", async () => {
    vi.setSystemTime(new Date("2027-07-01T12:00:00Z"));
    seed();
    await recordPrepayment("b1", "cus_1", { ...prepayment, amount: TOTAL });

    const b = db.get("b1")!;
    expect(b.mainCharge).toMatchObject({ status: "paid", amount: 0 });
    expect(payments.chargeMainAmount).not.toHaveBeenCalled();
  });
});

describe("trekk av resten", () => {
  const afterPrepayment = async () => {
    seed();
    await recordPrepayment("b1", "cus_1", prepayment);
    vi.setSystemTime(new Date("2027-06-11T06:00:00Z"));
  };

  it("cron trekker restbeløpet på forfallsdagen", async () => {
    await afterPrepayment();
    payments.chargeMainAmount.mockResolvedValue({ ok: true, paymentIntentId: "pi_rest" });
    await runDueCharges();

    expect(payments.chargeMainAmount.mock.calls[0][0].mainCharge.amount).toBe(REST);
    expect(db.get("b1")!.mainCharge).toMatchObject({ status: "paid", paymentIntentId: "pi_rest" });
  });

  it("feilet trekk: eieren varsles, gjesten bes betale selv, og kan betale resten med 3D Secure", async () => {
    await afterPrepayment();
    payments.chargeMainAmount.mockResolvedValue({ ok: false, error: "authentication_required" });
    await runDueCharges();

    let b = db.get("b1")!;
    expect(b.status).toBe("confirmed");
    expect(b.mainCharge.status).toBe("failed");
    expect(notifications.notifyOwnerOfPaymentIssue).toHaveBeenCalledTimes(1);
    expect(notifications.notifyGuestOfPaymentFailed).toHaveBeenCalledTimes(1);
    expect(b.guestEmails.paymentFailedSentAt).not.toBeNull();

    // Cron prøver ikke igjen av seg selv – eieren bestemmer.
    await runDueCharges();
    expect(payments.chargeMainAmount).toHaveBeenCalledTimes(1);

    await startGuestRestPayment(b);
    expect(payments.createRestPaymentSession).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }), REST);

    await recordRestPayment("b1", { paymentIntentId: "pi_rest", paymentMethodId: "pm_2", amount: REST });
    b = db.get("b1")!;
    expect(b.mainCharge).toMatchObject({ status: "paid", paymentIntentId: "pi_rest", lastError: null });
    expect(b.defaultPaymentMethodId).toBe("pm_2");
    expect(notifications.notifyOwnerOfRestPaid).toHaveBeenCalledTimes(1);
  });
});

describe("avbestilling", () => {
  const prepaid = () =>
    seed({
      defaultPaymentMethodId: "pm_1",
      prepayment: { status: "paid", amount: PREPAY, paymentIntentId: "pi_pre", paidAt: "2027-01-15T12:00:00Z" },
      mainCharge: { ...DEFAULT_MAIN_CHARGE, status: "card_saved", amount: REST, chargeAt: "2027-06-11" },
    });

  it("gjesten avbestiller i tide: forskuddet minus 2 % av leien refunderes", async () => {
    prepaid();
    await setStatus("b1", "declined", { refundMode: "policy" });

    expect(payments.refundPayment).toHaveBeenCalledTimes(1);
    expect(payments.refundPayment.mock.calls[0][0]).toBe("pi_pre");
    expect(payments.refundPayment.mock.calls[0][1]).toBe(586.5);
    expect(earlyCancellationRefund(PREPAY, TOTAL)).toBe(586.5);
    expect(db.get("b1")!.mainCharge.refundedAmount).toBe(586.5);
  });

  it("gjesten avbestiller for sent: ingenting refunderes, men det er vurdert", async () => {
    prepaid();
    vi.setSystemTime(new Date("2027-06-20T12:00:00Z"));
    await setStatus("b1", "declined", { refundMode: "policy" });

    expect(payments.refundPayment).not.toHaveBeenCalled();
    expect(db.get("b1")!.mainCharge.refundedAmount).toBe(0);
  });

  it("eieren avlyser etter at alt er betalt: både forskudd og rest refunderes fullt", async () => {
    prepaid();
    const b = db.get("b1")!;
    db.set("b1", { ...b, mainCharge: { ...b.mainCharge, status: "paid", paymentIntentId: "pi_rest" } });
    await setStatus("b1", "declined", { refundMode: "full", reason: "Vannskade" });

    const calls = payments.refundPayment.mock.calls.map((c) => [c[0], c[1]]);
    expect(calls).toEqual([
      ["pi_pre", PREPAY],
      ["pi_rest", REST],
    ]);
    expect(db.get("b1")!.mainCharge.refundedAmount).toBe(TOTAL);
  });
});
