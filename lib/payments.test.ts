import { describe, expect, it } from "vitest";
import { prepaymentCheckoutMessage } from "@/lib/payments";
import type { Booking } from "@/lib/types";

const booking = { checkIn: "2027-07-10", pricing: { total: 2550 } } as unknown as Booking;

describe("prepaymentCheckoutMessage", () => {
  it("viser rest, trekkdato og refusjon minus 2 % av leien på Stripe-siden – samme tall som e-posten", () => {
    const message = prepaymentCheckoutMessage(booking, 637.5);
    expect(message).toContain("remaining €1,912.50 is charged automatically to this card on 11 June 2027");
    expect(message).toContain("Cancel by 10 June 2027 and get €586.50 of this payment refunded");
    expect(message).toContain("2% of the total price is retained");
    expect(message.length).toBeLessThanOrEqual(1200); // Stripes grense for custom_text
  });

  it("sier at sen bestilling (alt betales nå) ikke refunderes", () => {
    expect(prepaymentCheckoutMessage(booking, 2550)).toContain("non-refundable");
  });
});
