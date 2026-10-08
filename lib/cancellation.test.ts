import { describe, expect, it } from "vitest";
import { cancellationFee, earlyCancellationRefund, policyRefund, policyRefundTotal, refundShare } from "@/lib/cancellation";
import { CANCELLATION_FEE_SHARE, FULL_REFUND_DAYS } from "@/lib/config";
import { addDays } from "@/lib/dates";
import type { Booking } from "@/lib/types";

const checkIn = "2027-07-01";
const daysBefore = (n: number) => addDays(checkIn, -n);

describe("avbestillingsregler", () => {
  it("refusjon minus gebyret fra og med FULL_REFUND_DAYS dager før", () => {
    expect(refundShare(checkIn, daysBefore(FULL_REFUND_DAYS))).toBe(1 - CANCELLATION_FEE_SHARE);
    expect(refundShare(checkIn, daysBefore(90))).toBe(1 - CANCELLATION_FEE_SHARE);
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
  it("tidlig avbestilling: 96 % av forskuddet", () => {
    // 4 % av 586,39 = 23,4556 → 23,46
    expect(policyRefund(booking(), daysBefore(FULL_REFUND_DAYS))).toEqual({ prepayment: 562.93, main: 0 });
  });

  it("5 000 € booking: 1 250 € forskudd, 1 200 € tilbake", () => {
    expect(cancellationFee(1250)).toBe(50);
    expect(earlyCancellationRefund(1250)).toBe(1200);
  });

  it("tidlig avbestilling etter at resten er trukket manuelt: 96 % av alt, og summen stemmer på centen", () => {
    const b = booking({ mainCharge: { status: "paid", amount: 1759.16 } as Booking["mainCharge"] });
    const refund = policyRefund(b, daysBefore(60));
    expect(refund.main).toBe(earlyCancellationRefund(1759.16));
    expect(policyRefundTotal(b, daysBefore(60))).toBe(earlyCancellationRefund(2345.55));
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
