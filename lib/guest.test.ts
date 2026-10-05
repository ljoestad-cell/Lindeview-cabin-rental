import { describe, expect, it } from "vitest";
import { FULL_REFUND_DAYS } from "@/lib/config";
import { addDays } from "@/lib/dates";
import { canRequestCancellation, canUpdateCard, freeCancellationDeadline, guestStatusLabel } from "@/lib/guest";
import type { Booking } from "@/lib/types";

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    status: "confirmed",
    checkIn: "2027-07-10",
    mainCharge: { status: "card_saved" },
    cancellationRequest: null,
    ...overrides,
  } as unknown as Booking;
}

describe("freeCancellationDeadline", () => {
  it("er FULL_REFUND_DAYS før innsjekk", () => {
    expect(freeCancellationDeadline("2027-07-10")).toBe(addDays("2027-07-10", -FULL_REFUND_DAYS));
  });
});

describe("canRequestCancellation", () => {
  it("tillater forespørsel på ventende og bekreftede bookinger før innsjekk", () => {
    expect(canRequestCancellation(booking({ status: "pending" }), "2027-07-01")).toBe(true);
    expect(canRequestCancellation(booking(), "2027-07-09")).toBe(true);
  });

  it("stopper på innsjekkdagen og senere", () => {
    expect(canRequestCancellation(booking(), "2027-07-10")).toBe(false);
    expect(canRequestCancellation(booking(), "2027-07-12")).toBe(false);
  });

  it("stopper hvis bookingen er avslått eller gjesten allerede har bedt om det", () => {
    expect(canRequestCancellation(booking({ status: "declined" }), "2027-07-01")).toBe(false);
    const requested = booking({ cancellationRequest: { requestedAt: "2027-06-01T10:00:00Z", message: "" } });
    expect(canRequestCancellation(requested, "2027-07-01")).toBe(false);
  });
});

describe("canUpdateCard", () => {
  it("tillater kortbytte på bekreftede bookinger som ikke er betalt", () => {
    for (const status of ["not_saved", "card_saved", "failed"] as const) {
      expect(canUpdateCard(booking({ mainCharge: { status } as Booking["mainCharge"] }))).toBe(true);
    }
  });

  it("stopper når hovedbeløpet er betalt, og på ventende/avslåtte bookinger", () => {
    expect(canUpdateCard(booking({ mainCharge: { status: "paid" } as Booking["mainCharge"] }))).toBe(false);
    expect(canUpdateCard(booking({ status: "pending" }))).toBe(false);
    expect(canUpdateCard(booking({ status: "declined" }))).toBe(false);
  });
});

describe("guestStatusLabel", () => {
  it("skiller mellom forespørsel, venter på kort, bekreftet og avslått", () => {
    expect(guestStatusLabel(booking({ status: "pending" }))).toBe("Forespørsel mottatt");
    expect(guestStatusLabel(booking({ mainCharge: { status: "not_saved" } as Booking["mainCharge"] }))).toBe(
      "Bekreftet – venter på kort",
    );
    expect(guestStatusLabel(booking())).toBe("Bekreftet");
    expect(guestStatusLabel(booking({ status: "declined", cancelledBy: "owner" }))).toBe("Avslått");
    expect(guestStatusLabel(booking({ status: "declined", cancelledBy: "guest" }))).toBe("Avbestilt");
  });
});
