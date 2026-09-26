import { describe, expect, it } from "vitest";
import { bookingsToCsv } from "@/lib/backup";
import type { Booking } from "@/lib/types";

const booking = {
  id: "abc",
  status: "confirmed",
  checkIn: "2027-06-01",
  checkOut: "2027-06-08",
  nights: 7,
  guests: 4,
  name: 'Kari "K" Ås; Nordmann',
  email: "kari@example.com",
  phone: "+47 900 00 000",
  pricing: { total: 2490.5 },
  mainCharge: { status: "paid", paidAt: "2027-05-02T06:00:00Z", refundedAmount: null },
  deposit: { status: "released", capturedAmount: null },
  extraCharges: [
    { amount: 100, status: "succeeded" },
    { amount: 50, status: "failed" },
  ],
  createdAt: "2027-01-10T12:00:00Z",
} as unknown as Booking;

describe("bookingsToCsv", () => {
  const csv = bookingsToCsv([booking]);
  const [header, row] = csv.replace("﻿", "").trim().split("\r\n");

  it("starter med BOM og bruker semikolon, så norsk Excel åpner den riktig", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(header.split(";")[0]).toBe("Status");
  });

  it("viser status på norsk", () => {
    expect(row.startsWith("Bekreftet;")).toBe(true);
    expect(row).toContain(";Betalt;");
    expect(row).toContain(";Frigitt;");
  });

  it("bruker desimalkomma og summerer bare vellykkede tilleggsbeløp", () => {
    expect(row).toContain(";2490,5;");
    expect(row).toContain(";100;");
  });

  it("siterer felt med semikolon og anførselstegn", () => {
    expect(row).toContain('"Kari ""K"" Ås; Nordmann"');
  });
});
