import { describe, expect, it } from "vitest";
import {
  cancellationFee,
  earlyCancellationRefund,
  policyRefund,
  policyRefundTotal,
  withinCancellationDeadline,
} from "@/lib/cancellation";
import { CANCELLATION_FEE_SHARE, FULL_REFUND_DAYS, PREPAYMENT_SHARE } from "@/lib/config";
import { addDays } from "@/lib/dates";
import type { Booking } from "@/lib/types";

const checkIn = "2027-07-01";
const daysBefore = (n: number) => addDays(checkIn, -n);

describe("avbestillingsfrist", () => {
  it("innen fristen fra og med FULL_REFUND_DAYS dager før", () => {
    expect(withinCancellationDeadline(checkIn, daysBefore(FULL_REFUND_DAYS))).toBe(true);
    expect(withinCancellationDeadline(checkIn, daysBefore(90))).toBe(true);
  });

  it("utenfor fristen nærmere enn FULL_REFUND_DAYS, også etter innsjekk", () => {
    expect(withinCancellationDeadline(checkIn, daysBefore(FULL_REFUND_DAYS - 1))).toBe(false);
    expect(withinCancellationDeadline(checkIn, checkIn)).toBe(false);
    expect(withinCancellationDeadline(checkIn, addDays(checkIn, 2))).toBe(false);
  });

  it("gebyret er mindre enn forskuddet, så det alltid kan trekkes derfra", () => {
    expect(CANCELLATION_FEE_SHARE).toBeLessThan(PREPAYMENT_SHARE);
  });
});

describe("gebyr", () => {
  it("5 000 € booking: 2 % = 100 €, 1 150 € tilbake av 1 250 € forskudd", () => {
    expect(cancellationFee(5000)).toBe(100);
    expect(earlyCancellationRefund(1250, 5000)).toBe(1150);
  });

  it("avrundes til hele cent og blir aldri negativt", () => {
    expect(cancellationFee(2345.55)).toBe(46.91);
    expect(earlyCancellationRefund(10, 5000)).toBe(0);
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
  it("tidlig avbestilling: forskuddet minus 2 % av hele leien", () => {
    expect(policyRefund(booking(), daysBefore(FULL_REFUND_DAYS))).toEqual({ prepayment: 539.48, main: 0 });
  });

  it("tidlig avbestilling etter at resten er trukket manuelt: gebyret trekkes bare én gang, fra forskuddet", () => {
    const b = booking({ mainCharge: { status: "paid", amount: 1759.16 } as Booking["mainCharge"] });
    expect(policyRefund(b, daysBefore(60))).toEqual({ prepayment: 539.48, main: 1759.16 });
    expect(policyRefundTotal(b, daysBefore(60))).toBe(2298.64);
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
