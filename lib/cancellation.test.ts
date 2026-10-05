import { describe, expect, it } from "vitest";
import { policyRefund, policyRefundTotal, refundShare } from "@/lib/cancellation";
import { EARLY_CANCELLATION_FEE, FULL_REFUND_DAYS } from "@/lib/config";
import { addDays } from "@/lib/dates";
import type { Booking } from "@/lib/types";

const checkIn = "2027-07-01";
const daysBefore = (n: number) => addDays(checkIn, -n);

describe("avbestillingsregler", () => {
  it("full refusjon fra og med FULL_REFUND_DAYS dager før", () => {
    expect(refundShare(checkIn, daysBefore(FULL_REFUND_DAYS))).toBe(1);
    expect(refundShare(checkIn, daysBefore(90))).toBe(1);
  });

  it("ingen refusjon nærmere enn FULL_REFUND_DAYS, også etter innsjekk", () => {
    expect(refundShare(checkIn, daysBefore(FULL_REFUND_DAYS - 1))).toBe(0);
    expect(refundShare(checkIn, daysBefore(1))).toBe(0);
    expect(refundShare(checkIn, checkIn)).toBe(0);
    expect(refundShare(checkIn, addDays(checkIn, 2))).toBe(0);
  });

});

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    checkIn,
    pricing: { total: 2345.55 },
    prepayment: { status: "paid", amount: 586.39 },
    mainCharge: { status: "card_saved", amount: 1759.16 },
    ...overrides,
  } as unknown as Booking;
}

describe("policyRefund", () => {
  it("tidlig avbestilling: forskuddet minus gebyret", () => {
    expect(policyRefund(booking(), daysBefore(FULL_REFUND_DAYS))).toEqual({
      prepayment: Math.round((586.39 - EARLY_CANCELLATION_FEE) * 100) / 100,
      main: 0,
    });
  });

  it("tidlig avbestilling etter at resten er trukket manuelt: resten refunderes også", () => {
    const b = booking({ mainCharge: { status: "paid", amount: 1759.16 } as Booking["mainCharge"] });
    expect(policyRefundTotal(b, daysBefore(60))).toBe(Math.round((2345.55 - EARLY_CANCELLATION_FEE) * 100) / 100);
  });

  it("gebyret gjør aldri refusjonen negativ", () => {
    const b = booking({ prepayment: { status: "paid", amount: 30 } as Booking["prepayment"] });
    expect(policyRefund(b, daysBefore(60)).prepayment).toBe(0);
  });

  it("eldre booking uten forskudd: hele leien, uten gebyr", () => {
    const b = booking({
      prepayment: undefined,
      mainCharge: { status: "paid", amount: null } as Booking["mainCharge"],
    });
    expect(policyRefund(b, daysBefore(60))).toEqual({ prepayment: 0, main: 2345.55 });
  });

  it("sen avbestilling: ingenting", () => {
    expect(policyRefundTotal(booking(), daysBefore(20))).toBe(0);
  });
});
