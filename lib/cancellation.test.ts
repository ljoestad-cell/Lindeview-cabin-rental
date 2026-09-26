import { describe, expect, it } from "vitest";
import { policyRefundAmount, refundShare } from "@/lib/cancellation";
import { FULL_REFUND_DAYS, PARTIAL_REFUND_DAYS, PARTIAL_REFUND_SHARE } from "@/lib/config";
import { addDays } from "@/lib/dates";

const checkIn = "2027-07-01";
const daysBefore = (n: number) => addDays(checkIn, -n);

describe("avbestillingsregler", () => {
  it("full refusjon fra og med FULL_REFUND_DAYS dager før", () => {
    expect(refundShare(checkIn, daysBefore(FULL_REFUND_DAYS))).toBe(1);
    expect(refundShare(checkIn, daysBefore(90))).toBe(1);
  });

  it("delvis refusjon mellom grensene", () => {
    expect(refundShare(checkIn, daysBefore(FULL_REFUND_DAYS - 1))).toBe(PARTIAL_REFUND_SHARE);
    expect(refundShare(checkIn, daysBefore(PARTIAL_REFUND_DAYS))).toBe(PARTIAL_REFUND_SHARE);
  });

  it("ingen refusjon nærmere enn PARTIAL_REFUND_DAYS, også etter innsjekk", () => {
    expect(refundShare(checkIn, daysBefore(PARTIAL_REFUND_DAYS - 1))).toBe(0);
    expect(refundShare(checkIn, checkIn)).toBe(0);
    expect(refundShare(checkIn, addDays(checkIn, 2))).toBe(0);
  });

  it("runder refusjonsbeløpet til hele cent", () => {
    expect(policyRefundAmount(2345.55, checkIn, daysBefore(20))).toBe(Math.round(2345.55 * PARTIAL_REFUND_SHARE * 100) / 100);
  });
});
