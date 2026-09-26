import { describe, expect, it } from "vitest";
import { DEFAULT_PRICES, quote, type Prices } from "@/lib/pricing";

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
