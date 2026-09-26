import { describe, expect, it } from "vitest";
import { addDays, addMonths, formatSeasonLabel, isIsoDate, nightsBetween, rangesOverlap } from "@/lib/dates";

describe("dates", () => {
  it("validerer ISO-datoer, også ugyldige kalenderdager", () => {
    expect(isIsoDate("2027-05-01")).toBe(true);
    expect(isIsoDate("2027-02-30")).toBe(false);
    expect(isIsoDate("1.5.2027")).toBe(false);
  });

  it("teller netter og legger til dager over månedsskifte", () => {
    expect(nightsBetween("2027-06-28", "2027-07-05")).toBe(7);
    expect(addDays("2027-06-30", 1)).toBe("2027-07-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });

  it("legger til måneder", () => {
    expect(addMonths("2027-06-15", 6)).toBe("2027-12-15");
    expect(addMonths("2027-06-15", 60)).toBe("2032-06-15");
  });

  it("regner bytte på samme dag (utsjekk = innsjekk) som ikke-overlapp", () => {
    const a = { start: "2027-06-01", end: "2027-06-08" };
    expect(rangesOverlap(a, { start: "2027-06-08", end: "2027-06-15" })).toBe(false);
    expect(rangesOverlap(a, { start: "2027-06-07", end: "2027-06-15" })).toBe(true);
    expect(rangesOverlap(a, { start: "2027-05-25", end: "2027-06-01" })).toBe(false);
  });

  it("lager sesongteksten fra datoene, med siste natt som slutt", () => {
    expect(formatSeasonLabel("2027-05-01", "2027-10-01")).toBe("1. mai – 30. september 2027");
    expect(formatSeasonLabel("2027-12-20", "2028-01-03")).toBe("20. desember 2027 – 2. januar 2028");
  });
});
