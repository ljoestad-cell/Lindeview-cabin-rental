import { describe, expect, it } from "vitest";
import { findConflict } from "@/lib/conflicts";
import type { BlockedRange, Booking } from "@/lib/types";

function booking(id: string, status: Booking["status"], checkIn: string, checkOut: string): Booking {
  return { id, status, checkIn, checkOut } as Booking;
}
const block = (start: string, end: string): BlockedRange => ({ id: "b", start, end, reason: "", createdAt: "" });

const june = { start: "2027-06-01", end: "2027-06-08" };

describe("findConflict", () => {
  it("stopper overlapp med en bekreftet booking", () => {
    expect(findConflict(june, [booking("a", "confirmed", "2027-06-05", "2027-06-12")], [])).toBe("booking");
  });

  it("ignorerer ventende og avslåtte bookinger", () => {
    const others = [booking("a", "pending", "2027-06-01", "2027-06-08"), booking("b", "declined", "2027-06-01", "2027-06-08")];
    expect(findConflict(june, others, [])).toBeNull();
  });

  it("ignorerer bookingen som selv skal bekreftes", () => {
    expect(findConflict(june, [booking("self", "confirmed", "2027-06-01", "2027-06-08")], [], "self")).toBeNull();
  });

  it("stopper overlapp med blokkerte perioder", () => {
    expect(findConflict(june, [], [block("2027-06-07", "2027-06-09")])).toBe("blocked");
  });

  it("tillater bytte samme dag", () => {
    expect(findConflict(june, [booking("a", "confirmed", "2027-06-08", "2027-06-15")], [block("2027-05-20", "2027-06-01")])).toBeNull();
  });
});
