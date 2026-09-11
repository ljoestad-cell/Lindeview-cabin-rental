import { randomUUID } from "node:crypto";
import * as calendar from "@/lib/calendar";
import { MAX_GUESTS, MIN_NIGHTS, SEASON_END, SEASON_START } from "@/lib/config";
import { isIsoDate, isWithinSeason, nightsBetween, rangesOverlap } from "@/lib/dates";
import { quote } from "@/lib/pricing";
import { getStore } from "@/lib/store";
import type { Booking, BookingRequestInput, BookingStatus } from "@/lib/types";

export class BookingValidationError extends Error {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateInput(input: BookingRequestInput) {
  if (!isIsoDate(input.checkIn) || !isIsoDate(input.checkOut)) {
    throw new BookingValidationError("Ugyldig dato.");
  }
  if (input.checkOut <= input.checkIn) {
    throw new BookingValidationError("Utsjekk må være etter innsjekk.");
  }
  if (!isWithinSeason(input.checkIn, input.checkOut, SEASON_START, SEASON_END)) {
    throw new BookingValidationError("Datoene er utenfor sesongen.");
  }
  if (nightsBetween(input.checkIn, input.checkOut) < MIN_NIGHTS) {
    throw new BookingValidationError(`Minste opphold er ${MIN_NIGHTS} netter.`);
  }
  if (!Number.isInteger(input.guests) || input.guests < 1 || input.guests > MAX_GUESTS) {
    throw new BookingValidationError(`Antall gjester må være mellom 1 og ${MAX_GUESTS}.`);
  }
  if (!input.name.trim()) throw new BookingValidationError("Navn mangler.");
  if (!EMAIL_RE.test(input.email)) throw new BookingValidationError("Ugyldig e-postadresse.");
  if (!input.phone.trim()) throw new BookingValidationError("Telefonnummer mangler.");
}

/** Oppretter en bookingforespørsel. Kaster BookingValidationError, eller returnerer 409-signal via null overlap check gjort av kalleren. */
export async function requestBooking(input: BookingRequestInput): Promise<Booking> {
  validateInput(input);

  const store = getStore();
  const existing = await store.listBookings();
  const overlapsConfirmed = existing.some(
    (b) =>
      b.status === "confirmed" &&
      rangesOverlap({ start: b.checkIn, end: b.checkOut }, { start: input.checkIn, end: input.checkOut }),
  );
  if (overlapsConfirmed) {
    throw new BookingValidationError("Datoene er allerede booket.");
  }

  const pricing = quote(input.checkIn, input.checkOut);
  const booking: Booking = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending",
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights: pricing.nights,
    guests: input.guests,
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    message: input.message.trim(),
    pricing,
    paymentStatus: "not_configured",
    calendarEventId: null,
  };

  await store.createBooking(booking);

  // Kalendersynk er "best effort" – skal aldri velte selve forespørselen.
  try {
    const eventId = await calendar.upsertEvent(booking);
    if (eventId) await store.updateBooking(booking.id, { calendarEventId: eventId });
  } catch (err) {
    console.error("[bookings] Kunne ikke opprette kalenderhendelse:", err);
  }

  return booking;
}

export async function setStatus(id: string, status: BookingStatus): Promise<Booking | null> {
  const store = getStore();
  const updated = await store.updateBooking(id, { status });
  if (!updated) return null;

  try {
    if (status === "declined") {
      await calendar.deleteEvent(updated);
    } else {
      const eventId = await calendar.upsertEvent(updated);
      if (eventId && eventId !== updated.calendarEventId) {
        await store.updateBooking(id, { calendarEventId: eventId });
      }
    }
  } catch (err) {
    console.error("[bookings] Kunne ikke oppdatere kalenderhendelse:", err);
  }

  return updated;
}

export async function deleteBooking(id: string): Promise<void> {
  const store = getStore();
  const booking = await store.getBooking(id);
  if (booking) {
    try {
      await calendar.deleteEvent(booking);
    } catch (err) {
      console.error("[bookings] Kunne ikke slette kalenderhendelse:", err);
    }
  }
  await store.deleteBooking(id);
}

export async function listForAdmin(): Promise<Booking[]> {
  const bookings = await getStore().listBookings();
  return bookings.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}

export type Availability = {
  season: { start: string; end: string };
  minNights: number;
  /** Datoperioder gjesten ikke kan velge (bekreftede bookinger + Google-kalender). */
  blocked: { start: string; end: string }[];
  /** Ubehandlede forespørsler – vises svakere, men blokkerer ikke valget. */
  tentative: { start: string; end: string }[];
};

export async function getAvailability(): Promise<Availability> {
  const bookings = await getStore().listBookings();
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const pending = bookings.filter((b) => b.status === "pending");

  let googleBusy: { start: string; end: string }[] = [];
  try {
    googleBusy = await calendar.getBusyRanges({ start: SEASON_START, end: SEASON_END });
  } catch (err) {
    console.error("[bookings] Kunne ikke hente Google Calendar-tilgjengelighet:", err);
  }

  return {
    season: { start: SEASON_START, end: SEASON_END },
    minNights: MIN_NIGHTS,
    blocked: [...confirmed.map((b) => ({ start: b.checkIn, end: b.checkOut })), ...googleBusy],
    tentative: pending.map((b) => ({ start: b.checkIn, end: b.checkOut })),
  };
}
