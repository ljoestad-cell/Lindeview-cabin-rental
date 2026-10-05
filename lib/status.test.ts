import { describe, expect, it } from "vitest";
import { statusLabel } from "@/lib/status";
import type { Booking } from "@/lib/types";

const booking = (overrides: Partial<Booking>) =>
  ({ status: "declined", cancelledBy: null, cancellationRequest: null, ...overrides }) as Booking;

describe("statusLabel", () => {
  it("viser «Avbestilt» når gjesten tok initiativet, «Avslått» når eieren gjorde det", () => {
    expect(statusLabel(booking({ cancelledBy: "guest" }))).toBe("Avbestilt");
    expect(statusLabel(booking({ cancelledBy: "owner" }))).toBe("Avslått");
  });

  it("bruker avbestillingsforespørselen på eldre bookinger uten cancelledBy", () => {
    const request = { requestedAt: "2026-10-01T10:00:00Z", message: "" };
    expect(statusLabel(booking({ cancellationRequest: request }))).toBe("Avbestilt");
    expect(statusLabel(booking({}))).toBe("Avslått");
  });

  it("viser Venter og Bekreftet for aktive bookinger", () => {
    expect(statusLabel(booking({ status: "pending" }))).toBe("Venter");
    expect(statusLabel(booking({ status: "confirmed" }))).toBe("Bekreftet");
  });
});
