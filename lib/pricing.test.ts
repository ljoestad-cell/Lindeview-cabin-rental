import { describe, expect, it } from "vitest";
import { CHARGE_DAYS_BEFORE_CHECKIN } from "@/lib/config";
import { addDays } from "@/lib/dates";
import { DEFAULT_PRICES, prepaymentAmount, quote, type Prices } from "@/lib/pricing";

const prices: Prices = { nightlyRate: 300, cleaningFee: 200, deposit: 1000, evCharger: 50, pet: 40, bedding: 20 };

describe("quote", () => {
  it("regner netter × pris + rengjøring uten tillegg", () => {
    const q = quote(prices, "2027-06-01", "2027-06-08");
    expect(q.nights).toBe(7);
    expect(q.nightsTotal).toBe(2100);
    expect(q.total).toBe(2300);
  });

  it("legger til tillegg som fast pris per booking, ikke per natt", () => {
    const q = quote(prices, "2027-06-01", "2027-06-15", { evChargers: 1, pets: 2, bedding: 4 });
    expect(q.extrasTotal).toBe(50 + 80 + 80);
    expect(q.total).toBe(14 * 300 + 200 + 210);
  });

  it("bruker prisene som sendes inn, ikke standardprisene", () => {
    const q = quote({ ...DEFAULT_PRICES, nightlyRate: 999 }, "2027-06-01", "2027-06-02");
    expect(q.nightlyRate).toBe(999);
  });
});

describe("prepaymentAmount", () => {
  const checkIn = "2027-07-10";
  const due = addDays(checkIn, -CHARGE_DAYS_BEFORE_CHECKIN);

  it("er 25 % avrundet til hele cent når resten forfaller senere", () => {
    expect(prepaymentAmount(2550, checkIn, "2027-01-15")).toBe(637.5);
    expect(prepaymentAmount(2345.55, checkIn, addDays(due, -1))).toBe(586.39);
  });

  it("er hele leien når resten allerede ville forfalt", () => {
    expect(prepaymentAmount(2550, checkIn, due)).toBe(2550);
    expect(prepaymentAmount(2550, checkIn, "2027-07-01")).toBe(2550);
  });
});
