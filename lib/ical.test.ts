import { describe, expect, it } from "vitest";
import { bookingsAndBlocksToIcsEvents, generateIcs, parseIcsBusyRanges } from "@/lib/ical";
import type { BlockedRange, Booking } from "@/lib/types";

describe("iCal", () => {
  it("eksporterer bare bekreftede bookinger og manuelle blokkeringer, uten personopplysninger", () => {
    const bookings = [
      { id: "1", status: "confirmed", checkIn: "2027-06-01", checkOut: "2027-06-08", name: "Kari" },
      { id: "2", status: "pending", checkIn: "2027-07-01", checkOut: "2027-07-08", name: "Ola" },
    ] as Booking[];
    const blocks: BlockedRange[] = [
      { id: "m", start: "2027-08-01", end: "2027-08-03", reason: "", createdAt: "", source: "manual" },
      { id: "a", start: "2027-09-01", end: "2027-09-03", reason: "", createdAt: "", source: "airbnb" },
    ];
    const events = bookingsAndBlocksToIcsEvents(bookings, blocks);
    expect(events.map((e) => e.start)).toEqual(["2027-06-01", "2027-08-01"]);
    expect(generateIcs(events)).not.toContain("Kari");
  });

  it("leser tilbake perioder fra sin egen eksport (rundtur)", () => {
    const ics = generateIcs([{ uid: "x", start: "2027-06-01", end: "2027-06-08", summary: "Reservert" }]);
    expect(parseIcsBusyRanges(ics)).toEqual([{ start: "2027-06-01", end: "2027-06-08" }]);
  });

  it("tåler foldede linjer og DTSTART med tidssone/klokkeslett", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;TZID=Europe/Oslo:20270610T150000",
      "DTEND;VALUE=DATE:2027",
      " 0615",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(parseIcsBusyRanges(ics)).toEqual([{ start: "2027-06-10", end: "2027-06-15" }]);
  });
});
