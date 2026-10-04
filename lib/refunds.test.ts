import { describe, expect, it } from "vitest";
import { chargedAmount, refundableAmount, refundedSoFar } from "@/lib/refunds";
import type { Booking, Refund } from "@/lib/types";

function refund(target: Refund["target"], amount: number, extraChargeId: string | null = null): Refund {
  return { id: `r-${amount}`, target, extraChargeId, amount, reason: "test", createdAt: "", stripeRefundId: null };
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    pricing: { total: 2490.5 },
    mainCharge: { status: "paid", paymentIntentId: "pi_main", refundedAmount: null },
    deposit: { status: "captured", amount: 1000, capturedAmount: 300, paymentIntentId: "pi_dep" },
    extraCharges: [
      { id: "x1", amount: 100, status: "succeeded", paymentIntentId: "pi_x1" },
      { id: "x2", amount: 50, status: "failed", paymentIntentId: null },
    ],
    refunds: [],
    ...overrides,
  } as unknown as Booking;
}

describe("refundableAmount", () => {
  it("kan refundere hele det trukne beløpet når ingenting er refundert", () => {
    const b = booking();
    expect(refundableAmount(b, "main")).toBe(2490.5);
    expect(refundableAmount(b, "deposit")).toBe(300);
    expect(refundableAmount(b, "extra", "x1")).toBe(100);
  });

  it("trekker fra flere delrefusjoner, og holder dem adskilt per belastning", () => {
    const b = booking({ refunds: [refund("main", 10.25), refund("main", 0.25), refund("extra", 40, "x1")] });
    expect(refundableAmount(b, "main")).toBe(2480);
    expect(refundableAmount(b, "extra", "x1")).toBe(60);
    expect(refundableAmount(b, "deposit")).toBe(300);
  });

  it("teller avbestillingsrefusjoner fra før loggen fantes", () => {
    const b = booking({ mainCharge: { status: "paid", refundedAmount: 2490.5 } as Booking["mainCharge"] });
    expect(refundedSoFar(b, "main")).toBe(2490.5);
    expect(refundableAmount(b, "main")).toBe(0);
  });

  it("gir 0 for belastninger som ikke har gått gjennom", () => {
    const b = booking({
      mainCharge: { status: "card_saved", refundedAmount: null } as Booking["mainCharge"],
      deposit: { status: "held", amount: 1000, capturedAmount: null } as Booking["deposit"],
    });
    expect(chargedAmount(b, "main")).toBe(0);
    expect(refundableAmount(b, "deposit")).toBe(0);
    expect(refundableAmount(b, "extra", "x2")).toBe(0);
    expect(refundableAmount(b, "extra", "finnes-ikke")).toBe(0);
  });

  it("bruker hele depositumet når det ble trukket uten delbeløp", () => {
    const b = booking({ deposit: { status: "captured", amount: 1000, capturedAmount: null } as Booking["deposit"] });
    expect(refundableAmount(b, "deposit")).toBe(1000);
  });
});
