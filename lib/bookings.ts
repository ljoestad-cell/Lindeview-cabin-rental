import { randomUUID } from "node:crypto";
import * as calendar from "@/lib/calendar";
import {
  CHARGE_DAYS_BEFORE_CHECKIN,
  MAX_GUESTS,
  MIN_NIGHTS,
  SEASON_END,
  SEASON_START,
} from "@/lib/config";
import { addDays, isIsoDate, isWithinSeason, nightsBetween, rangesOverlap, today } from "@/lib/dates";
import { notifyOwnerOfBooking, notifyOwnerOfPaymentIssue } from "@/lib/notifications";
import * as payments from "@/lib/payments";
import { isStripeConfigured } from "@/lib/stripe";
import { quote } from "@/lib/pricing";
import { getStore } from "@/lib/store";
import {
  DEFAULT_DEPOSIT,
  DEFAULT_MAIN_CHARGE,
  type BlockedRange,
  type Booking,
  type BookingRequestInput,
  type BookingStatus,
  type ExtraCharge,
} from "@/lib/types";

export class BookingValidationError extends Error {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Fyller inn standardverdier for felter som ikke fantes i eldre lagrede
 * bookinger. `Booking` sier disse alltid finnes, men data skrevet før
 * betalingsfeltene ble lagt til mangler dem i praksis – derfor `??`
 * per felt i stedet for å stole på typen.
 */
function normalizeBooking(booking: Booking): Booking {
  return {
    ...booking,
    stripeCustomerId: booking.stripeCustomerId ?? null,
    defaultPaymentMethodId: booking.defaultPaymentMethodId ?? null,
    secureCardUrl: booking.secureCardUrl ?? null,
    mainCharge: booking.mainCharge ?? { ...DEFAULT_MAIN_CHARGE },
    deposit: booking.deposit ?? { ...DEFAULT_DEPOSIT },
    extraCharges: booking.extraCharges ?? [],
  };
}

async function loadBooking(id: string): Promise<Booking | null> {
  const booking = await getStore().getBooking(id);
  return booking ? normalizeBooking(booking) : null;
}

async function loadAllBookings(): Promise<Booking[]> {
  const bookings = await getStore().listBookings();
  return bookings.map(normalizeBooking);
}

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

/** Oppretter en bookingforespørsel. Kaster BookingValidationError ved ugyldig input, sesong utenfor, for kort opphold eller overlapp. */
export async function requestBooking(input: BookingRequestInput): Promise<Booking> {
  validateInput(input);

  const store = getStore();
  const requested = { start: input.checkIn, end: input.checkOut };
  const existing = await loadAllBookings();
  const overlapsConfirmed = existing.some(
    (b) => b.status === "confirmed" && rangesOverlap({ start: b.checkIn, end: b.checkOut }, requested),
  );
  if (overlapsConfirmed) {
    throw new BookingValidationError("Datoene er allerede booket.");
  }

  const blockedRanges = await store.listBlockedRanges();
  const overlapsBlocked = blockedRanges.some((r) => rangesOverlap({ start: r.start, end: r.end }, requested));
  if (overlapsBlocked) {
    throw new BookingValidationError("Datoene er ikke tilgjengelige.");
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
    calendarEventId: null,
    stripeCustomerId: null,
    defaultPaymentMethodId: null,
    secureCardUrl: null,
    mainCharge: { ...DEFAULT_MAIN_CHARGE },
    deposit: { ...DEFAULT_DEPOSIT },
    extraCharges: [],
  };

  await store.createBooking(booking);

  // Kalendersynk og e-postvarsel er "best effort" – skal aldri velte selve forespørselen.
  try {
    const eventId = await calendar.upsertEvent(booking);
    if (eventId) await store.updateBooking(booking.id, { calendarEventId: eventId });
  } catch (err) {
    console.error("[bookings] Kunne ikke opprette kalenderhendelse:", err);
  }

  try {
    await notifyOwnerOfBooking(booking);
  } catch (err) {
    console.error("[bookings] Kunne ikke sende e-postvarsel:", err);
  }

  return booking;
}

/** Når hovedbeløpet forfaller for en booking – i dag hvis det allerede er nærmere innsjekk enn fristen. */
function computeChargeAt(checkIn: string): string {
  const dueDate = addDays(checkIn, -CHARGE_DAYS_BEFORE_CHECKIN);
  return dueDate < today() ? today() : dueDate;
}

/** Oppretter (eller lager på nytt) secure-card-lenken for en booking. Best-effort. */
async function refreshSecureCardLink(booking: Booking): Promise<Booking> {
  try {
    const session = await payments.createSecureCardSession(booking);
    if (!session) return booking;
    const patch = { stripeCustomerId: session.customerId, secureCardUrl: session.checkoutUrl };
    await getStore().updateBooking(booking.id, patch);
    return { ...booking, ...patch };
  } catch (err) {
    console.error("[bookings] Kunne ikke opprette betalingslenke:", err);
    return booking;
  }
}

/** Henter én booking (admin-bruk). Returnerer null hvis den ikke finnes. */
export async function getBookingById(id: string): Promise<Booking | null> {
  return loadBooking(id);
}

/** Admin: lag en ny secure-card-lenke manuelt (sen bestilling, eller utløpt lenke). */
export async function regeneratePaymentLink(id: string): Promise<Booking | null> {
  const booking = await loadBooking(id);
  if (!booking) return null;
  return refreshSecureCardLink(booking);
}

export async function setStatus(id: string, status: BookingStatus): Promise<Booking | null> {
  const store = getStore();
  const before = await loadBooking(id);
  if (!before) return null;

  await store.updateBooking(id, { status });
  let updated = { ...before, status };

  try {
    if (status === "declined") {
      await calendar.deleteEvent(updated);
    } else {
      const eventId = await calendar.upsertEvent(updated);
      if (eventId && eventId !== updated.calendarEventId) {
        await store.updateBooking(id, { calendarEventId: eventId });
        updated = { ...updated, calendarEventId: eventId };
      }
    }
  } catch (err) {
    console.error("[bookings] Kunne ikke oppdatere kalenderhendelse:", err);
  }

  if (status === "confirmed" && updated.mainCharge.status === "not_saved") {
    updated = await refreshSecureCardLink(updated);
  }

  if (status === "declined" && updated.mainCharge.status === "paid") {
    try {
      const result = await payments.refundMainCharge(updated);
      if (!result.ok) console.error("[bookings] Refusjon feilet:", result.error);
    } catch (err) {
      console.error("[bookings] Kunne ikke refundere hovedbeløp:", err);
    }
  }

  return updated;
}

export async function deleteBooking(id: string): Promise<void> {
  const store = getStore();
  const booking = await loadBooking(id);
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
  const bookings = await loadAllBookings();
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
  const bookings = await loadAllBookings();
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const pending = bookings.filter((b) => b.status === "pending");
  const blockedRanges = await getStore().listBlockedRanges();

  let googleBusy: { start: string; end: string }[] = [];
  try {
    googleBusy = await calendar.getBusyRanges({ start: SEASON_START, end: SEASON_END });
  } catch (err) {
    console.error("[bookings] Kunne ikke hente Google Calendar-tilgjengelighet:", err);
  }

  return {
    season: { start: SEASON_START, end: SEASON_END },
    minNights: MIN_NIGHTS,
    blocked: [
      ...confirmed.map((b) => ({ start: b.checkIn, end: b.checkOut })),
      ...blockedRanges.map((r) => ({ start: r.start, end: r.end })),
      ...googleBusy,
    ],
    tentative: pending.map((b) => ({ start: b.checkIn, end: b.checkOut })),
  };
}

// --- Manuell blokkering av datoer (admin) ------------------------------

export async function listBlockedRanges(): Promise<BlockedRange[]> {
  const ranges = await getStore().listBlockedRanges();
  return ranges.sort((a, b) => a.start.localeCompare(b.start));
}

/** Admin: blokker en periode manuelt (eget bruk, vedlikehold o.l.). */
export async function addBlockedRange(start: string, end: string, reason: string): Promise<BlockedRange> {
  if (!isIsoDate(start) || !isIsoDate(end)) {
    throw new BookingValidationError("Ugyldig dato.");
  }
  if (end <= start) {
    throw new BookingValidationError("Sluttdato må være etter startdato.");
  }

  const bookings = await loadAllBookings();
  const overlapsBooking = bookings.some(
    (b) => b.status !== "declined" && rangesOverlap({ start: b.checkIn, end: b.checkOut }, { start, end }),
  );
  if (overlapsBooking) {
    throw new BookingValidationError("Perioden overlapper med en eksisterende booking.");
  }

  const existingBlocks = await getStore().listBlockedRanges();
  const overlapsBlock = existingBlocks.some((r) => rangesOverlap({ start: r.start, end: r.end }, { start, end }));
  if (overlapsBlock) {
    throw new BookingValidationError("Perioden overlapper med en eksisterende blokkering.");
  }

  const range: BlockedRange = {
    id: randomUUID(),
    start,
    end,
    reason: reason.trim(),
    createdAt: new Date().toISOString(),
  };
  return getStore().createBlockedRange(range);
}

/** Admin: fjern en manuell blokkering. */
export async function removeBlockedRange(id: string): Promise<void> {
  await getStore().deleteBlockedRange(id);
}

// --- Betaling ---------------------------------------------------------

/**
 * Kalles fra Stripe-webhooken når gjesten har sikret et kort (checkout.session.completed,
 * mode "setup"). Lagrer kortet og avgjør om hovedbeløpet skal belastes med
 * en gang (sen bestilling) eller planlegges til CHARGE_DAYS_BEFORE_CHECKIN
 * dager før innsjekk.
 */
export async function attachPaymentMethod(
  bookingId: string,
  customerId: string,
  paymentMethodId: string,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) return;

  const chargeAt = computeChargeAt(booking.checkIn);
  const store = getStore();

  const patch = {
    stripeCustomerId: customerId,
    defaultPaymentMethodId: paymentMethodId,
    mainCharge: { ...booking.mainCharge, status: "card_saved" as const, chargeAt },
  };
  await store.updateBooking(bookingId, patch);
  const updated = { ...booking, ...patch };

  if (chargeAt <= today()) {
    await retryMainCharge(updated.id);
  }
}

async function applyMainChargeResult(booking: Booking, result: payments.PaymentResult): Promise<Booking> {
  const store = getStore();
  if (result.ok) {
    const patch = {
      mainCharge: {
        ...booking.mainCharge,
        status: "paid" as const,
        paymentIntentId: result.paymentIntentId,
        paidAt: new Date().toISOString(),
        lastError: null,
      },
    };
    await store.updateBooking(booking.id, patch);
    return { ...booking, ...patch };
  }

  const patch = {
    mainCharge: { ...booking.mainCharge, status: "failed" as const, lastError: result.error },
  };
  await store.updateBooking(booking.id, patch);
  try {
    await notifyOwnerOfPaymentIssue({ ...booking, ...patch }, result.error);
  } catch (err) {
    console.error("[bookings] Kunne ikke varsle om betalingsfeil:", err);
  }
  return { ...booking, ...patch };
}

/** Belaster hovedbeløpet nå – kalt fra cron når forfalt, eller manuelt fra admin. */
export async function retryMainCharge(bookingId: string): Promise<Booking | null> {
  const booking = await loadBooking(bookingId);
  if (!booking) return null;
  if (!isStripeConfigured()) return booking;

  const result = await payments.chargeMainAmount(booking);
  return applyMainChargeResult(booking, result);
}

/** Reserverer, trekker eller frigir depositumet. */
export async function manageDeposit(
  bookingId: string,
  action: "hold" | "capture" | "release",
  amount?: number,
): Promise<Booking | null> {
  const booking = await loadBooking(bookingId);
  if (!booking) return null;
  if (!isStripeConfigured()) return booking;

  const store = getStore();
  const result =
    action === "hold"
      ? await payments.holdDeposit(booking)
      : action === "capture"
        ? await payments.captureDeposit(booking, amount)
        : await payments.releaseDeposit(booking);

  if (!result.ok) {
    const patch = { deposit: { ...booking.deposit, status: "failed" as const, lastError: result.error } };
    await store.updateBooking(bookingId, patch);
    try {
      await notifyOwnerOfPaymentIssue({ ...booking, ...patch }, `Depositum (${action}): ${result.error}`);
    } catch (err) {
      console.error("[bookings] Kunne ikke varsle om depositum-feil:", err);
    }
    return { ...booking, ...patch };
  }

  const statusByAction = { hold: "held", capture: "captured", release: "released" } as const;
  const patch = {
    deposit: {
      ...booking.deposit,
      status: statusByAction[action],
      paymentIntentId: result.paymentIntentId,
      lastError: null,
      ...(action === "hold" ? { heldAt: new Date().toISOString() } : {}),
      ...(action !== "hold" ? { resolvedAt: new Date().toISOString() } : {}),
      ...(action === "capture" ? { capturedAmount: amount ?? booking.pricing.total } : {}),
    },
  };
  await store.updateBooking(bookingId, patch);
  return { ...booking, ...patch };
}

/** Trekker et tilleggsbeløp (skade, ekstra tjenester) fra det lagrede kortet. */
export async function addExtraCharge(
  bookingId: string,
  amount: number,
  description: string,
): Promise<Booking | null> {
  const booking = await loadBooking(bookingId);
  if (!booking) return null;
  if (!isStripeConfigured()) return booking;

  const result = await payments.chargeExtra(booking, amount, description);
  const entry: ExtraCharge = {
    id: randomUUID(),
    amount,
    description,
    createdAt: new Date().toISOString(),
    status: result.ok ? "succeeded" : "failed",
    paymentIntentId: result.ok ? result.paymentIntentId : null,
  };

  const patch = { extraCharges: [...booking.extraCharges, entry] };
  const store = getStore();
  await store.updateBooking(bookingId, patch);

  if (!result.ok) {
    try {
      await notifyOwnerOfPaymentIssue(booking, `Tilleggsbeløp «${description}»: ${result.error}`);
    } catch (err) {
      console.error("[bookings] Kunne ikke varsle om feilet tilleggsbeløp:", err);
    }
  }

  return { ...booking, ...patch };
}

/**
 * Kjøres daglig av cron-jobben: belaster hovedbeløp som har forfalt, og
 * reserverer depositum for bookinger som har nådd utsjekksdagen.
 */
export async function runDueCharges(): Promise<{ charged: string[]; deposits: string[] }> {
  const bookings = await loadAllBookings();
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const now = today();

  const charged: string[] = [];
  for (const booking of confirmed) {
    const due =
      booking.mainCharge.status === "card_saved" &&
      booking.mainCharge.chargeAt !== null &&
      booking.mainCharge.chargeAt <= now;
    if (due) {
      await retryMainCharge(booking.id);
      charged.push(booking.id);
    }
  }

  const deposits: string[] = [];
  for (const booking of confirmed) {
    const due = booking.mainCharge.status === "paid" && booking.deposit.status === "none" && booking.checkOut <= now;
    if (due) {
      await manageDeposit(booking.id, "hold");
      deposits.push(booking.id);
    }
  }

  return { charged, deposits };
}
