import { randomUUID } from "node:crypto";
import { getAccount, recordAirbnbSync } from "@/lib/admin-account";
import * as calendar from "@/lib/calendar";
import {
  BEDDING_MAX,
  CHARGE_DAYS_BEFORE_CHECKIN,
  DEPOSIT_AMOUNT,
  DEPOSIT_RESERVE_DAYS_BEFORE_CHECKOUT,
  EV_CHARGER_MAX,
  MAX_GUESTS,
  MIN_NIGHTS,
  PET_MAX,
  RETENTION_MONTHS_CONFIRMED,
  RETENTION_MONTHS_OTHER,
  SEASON_END,
  SEASON_START,
  TERMS_VERSION,
} from "@/lib/config";
import { policyRefundAmount } from "@/lib/cancellation";
import { findConflict } from "@/lib/conflicts";
import { canRequestCancellation, canUpdateCard } from "@/lib/guest";
import { addDays, addMonths, isIsoDate, isWithinSeason, nightsBetween, rangesOverlap, today } from "@/lib/dates";
import { parseIcsBusyRanges } from "@/lib/ical";
import {
  guestEmailEnabled,
  notifyGuestOfApproval,
  notifyGuestOfConfirmation,
  notifyOwnerOfBooking,
  notifyOwnerOfCancellationRequest,
  notifyOwnerOfDoubleBooking,
  notifyOwnerOfPaymentIssue,
} from "@/lib/notifications";
import * as payments from "@/lib/payments";
import { isStripeConfigured } from "@/lib/stripe";
import { getPrices } from "@/lib/prices";
import { paymentIntentFor, refundableAmount } from "@/lib/refunds";
import { DEFAULT_EXTRAS, formatEur, quote, type BookingExtras, type Prices } from "@/lib/pricing";
import { guestBookingUrl } from "@/lib/site";
import { getStore } from "@/lib/store";
import { tokensMatch } from "@/lib/tokens";
import {
  DEFAULT_DEPOSIT,
  DEFAULT_GUEST_EMAILS,
  DEFAULT_MAIN_CHARGE,
  type BlockedRange,
  type Booking,
  type BookingRequestInput,
  type BookingStatus,
  type ExtraCharge,
  type Refund,
  type RefundTarget,
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
    mainCharge: { ...DEFAULT_MAIN_CHARGE, ...booking.mainCharge },
    // Bookinger fra før depositum ble lagret på bookingen fikk standardbeløpet.
    deposit: { ...DEFAULT_DEPOSIT, ...booking.deposit, amount: booking.deposit?.amount ?? DEPOSIT_AMOUNT },
    extraCharges: booking.extraCharges ?? [],
    refunds: booking.refunds ?? [],
    guestEmails: { ...DEFAULT_GUEST_EMAILS, ...booking.guestEmails },
    guestToken: booking.guestToken ?? null,
    cancellationRequest: booking.cancellationRequest ?? null,
    extras: booking.extras ?? { ...DEFAULT_EXTRAS },
    termsVersion: booking.termsVersion ?? null,
    termsAcceptedAt: booking.termsAcceptedAt ?? null,
    anonymizedAt: booking.anonymizedAt ?? null,
  };
}

const CONFLICT_MESSAGES = {
  booking: "Datoene er allerede booket.",
  blocked: "Datoene er ikke tilgjengelige.",
} as const;

function validateExtras(extras: BookingExtras) {
  const checks: [number, number, string][] = [
    [extras.evChargers, EV_CHARGER_MAX, "Antall el-biler"],
    [extras.pets, PET_MAX, "Antall kjæledyr"],
    [extras.bedding, BEDDING_MAX, "Antall sett sengetøy/håndklær"],
  ];
  for (const [value, max, label] of checks) {
    if (!Number.isInteger(value) || value < 0 || value > max) {
      throw new BookingValidationError(`${label} må være mellom 0 og ${max}.`);
    }
  }
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
  if (input.acceptedTerms !== true) {
    throw new BookingValidationError("Du må godta leievilkårene for å sende forespørselen.");
  }
  validateExtras(input.extras ?? DEFAULT_EXTRAS);
}

/** Oppretter en bookingforespørsel. Kaster BookingValidationError ved ugyldig input, sesong utenfor, for kort opphold eller overlapp. */
export async function requestBooking(input: BookingRequestInput): Promise<Booking> {
  validateInput(input);

  const store = getStore();
  const requested = { start: input.checkIn, end: input.checkOut };
  const [existing, blockedRanges] = await Promise.all([loadAllBookings(), store.listBlockedRanges()]);
  const conflict = findConflict(requested, existing, blockedRanges);
  if (conflict) throw new BookingValidationError(CONFLICT_MESSAGES[conflict]);

  const extras = input.extras ?? DEFAULT_EXTRAS;
  const prices = await getPrices();
  const pricing = quote(prices, input.checkIn, input.checkOut, extras);
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
    extras,
    pricing,
    calendarEventId: null,
    stripeCustomerId: null,
    defaultPaymentMethodId: null,
    secureCardUrl: null,
    mainCharge: { ...DEFAULT_MAIN_CHARGE },
    deposit: { ...DEFAULT_DEPOSIT, amount: prices.deposit },
    extraCharges: [],
    refunds: [],
    guestEmails: { ...DEFAULT_GUEST_EMAILS },
    guestToken: randomUUID(),
    cancellationRequest: null,
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: new Date().toISOString(),
    anonymizedAt: null,
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

/**
 * Oppretter (eller lager på nytt) secure-card-lenken for en booking. Kaster
 * videre hvis Stripe-kallet feiler – kalleren avgjør om det skal vises til
 * admin (manuell handling) eller bare logges (automatisk ved bekreftelse).
 */
async function refreshSecureCardLink(booking: Booking): Promise<Booking> {
  const session = await payments.createSecureCardSession(booking);
  if (!session) return booking;
  const patch = { stripeCustomerId: session.customerId, secureCardUrl: session.checkoutUrl };
  await getStore().updateBooking(booking.id, patch);
  return { ...booking, ...patch };
}

/**
 * Sørger for at bookingen har en «Min booking»-token. Bookinger fra før
 * lenken fantes får en ved første behov (e-post eller «Kopier gjestelenke»).
 */
export async function ensureGuestToken(booking: Booking): Promise<Booking> {
  if (booking.guestToken) return booking;
  const guestToken = randomUUID();
  await getStore().updateBooking(booking.id, { guestToken });
  return { ...booking, guestToken };
}

/** Admin: gjestens «Min booking»-lenke, opprettet ved behov. */
export async function getGuestLink(id: string): Promise<string | null> {
  const booking = await loadBooking(id);
  if (!booking) return null;
  if (booking.anonymizedAt) throw new BookingValidationError("Bookingen er anonymisert.");
  const withToken = await ensureGuestToken(booking);
  return guestBookingUrl(withToken.guestToken!);
}

/** Gjestens «Min booking»-side: slår opp på hemmelig token. Anonymiserte bookinger finnes ikke lenger for gjesten. */
export async function getBookingByGuestToken(token: string): Promise<Booking | null> {
  if (!token) return null;
  const bookings = await loadAllBookings();
  const match = bookings.find((b) => b.guestToken && tokensMatch(token, b.guestToken));
  return match && !match.anonymizedAt ? match : null;
}

/**
 * Gjesten ber om avbestilling. Endrer ikke status – eieren får e-post og
 * avbestiller selv i admin (med refusjon etter vilkårene).
 */
export async function requestCancellation(booking: Booking, message: string): Promise<Booking> {
  if (!canRequestCancellation(booking, today())) {
    throw new BookingValidationError("Denne bookingen kan ikke avbestilles herfra – ta kontakt med oss.");
  }
  const cancellationRequest = { requestedAt: new Date().toISOString(), message };
  await getStore().updateBooking(booking.id, { cancellationRequest });
  const updated = { ...booking, cancellationRequest };
  try {
    await notifyOwnerOfCancellationRequest(updated);
  } catch (err) {
    console.error("[bookings] Kunne ikke varsle eieren om avbestillingsforespørsel:", err);
  }
  return updated;
}

/**
 * Gjesten vil sikre eller bytte kort fra «Min booking». Lager alltid en ny
 * Checkout-lenke (e-postlenken utløper etter et døgn). Returnerer URL-en.
 */
export async function startGuestCardUpdate(booking: Booking): Promise<string> {
  if (!canUpdateCard(booking)) {
    throw new BookingValidationError("Kortet kan ikke endres på denne bookingen.");
  }
  if (!isStripeConfigured()) {
    throw new BookingValidationError("Betaling er ikke tilgjengelig akkurat nå – ta kontakt med oss.");
  }
  const updated = await refreshSecureCardLink(booking);
  if (!updated.secureCardUrl) throw new BookingValidationError("Kunne ikke lage betalingslenke – prøv igjen.");
  return updated.secureCardUrl;
}

/** Henter én booking (admin-bruk). Returnerer null hvis den ikke finnes. */
export async function getBookingById(id: string): Promise<Booking | null> {
  return loadBooking(id);
}

/** Sender e-post 1 (godkjent + betalingslenke) og noterer tidspunktet. Kaster ved feil fra Resend. */
async function sendApprovalEmail(booking: Booking): Promise<Booking> {
  booking = await ensureGuestToken(booking);
  const sent = await notifyGuestOfApproval(booking);
  if (!sent) return booking;
  const guestEmails = { ...booking.guestEmails, approvalSentAt: new Date().toISOString() };
  await getStore().updateBooking(booking.id, { guestEmails });
  return { ...booking, guestEmails };
}

/**
 * Admin: send e-post 1 på nytt – typisk etter «Generer ny lenke» (lenken
 * utløper etter et døgn). Kaster BookingValidationError med en forklaring
 * admin kan lese hvis e-posten ikke kan sendes.
 */
export async function resendApprovalEmail(id: string): Promise<Booking | null> {
  const booking = await loadBooking(id);
  if (!booking) return null;
  if (booking.status !== "confirmed") {
    throw new BookingValidationError("Bookingen må være bekreftet før gjesten kan få betalingslenken.");
  }
  if (booking.mainCharge.status !== "not_saved") {
    throw new BookingValidationError("Gjesten har allerede sikret et kort.");
  }
  if (!booking.secureCardUrl) {
    throw new BookingValidationError("Lag en betalingslenke først.");
  }
  if (!booking.email) {
    throw new BookingValidationError("Bookingen har ingen e-postadresse.");
  }
  if (!guestEmailEnabled()) {
    throw new BookingValidationError(
      "E-post til gjester er ikke satt opp (RESEND_API_KEY og RESEND_FROM_EMAIL med verifisert domene) – se README.",
    );
  }
  return sendApprovalEmail(booking);
}

/** Admin: lag en ny secure-card-lenke manuelt (sen bestilling, eller utløpt lenke). */
export async function regeneratePaymentLink(id: string): Promise<Booking | null> {
  const booking = await loadBooking(id);
  if (!booking) return null;
  return refreshSecureCardLink(booking);
}

/**
 * Hvor mye som refunderes når en betalt booking avbestilles: "policy" følger
 * leievilkårene (gjesten avbestiller), "full" refunderer alt (eieren avlyser).
 */
export type RefundMode = "policy" | "full";

/**
 * Bekrefter eller avslår/avbestiller en booking. Ved bekreftelse sjekkes
 * overlapp på nytt – to ventende forespørsler på samme datoer kan ellers
 * begge bli godkjent. Kaster BookingValidationError ved konflikt.
 */
export async function setStatus(
  id: string,
  status: BookingStatus,
  refundMode: RefundMode = "full",
): Promise<Booking | null> {
  const store = getStore();
  const before = await loadBooking(id);
  if (!before) return null;

  if (status === "confirmed") {
    const [bookings, blockedRanges] = await Promise.all([loadAllBookings(), store.listBlockedRanges()]);
    const conflict = findConflict({ start: before.checkIn, end: before.checkOut }, bookings, blockedRanges, id);
    if (conflict) throw new BookingValidationError(CONFLICT_MESSAGES[conflict]);
  }

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
    try {
      updated = await refreshSecureCardLink(updated);
    } catch (err) {
      // Skal aldri velte selve bekreftelsen – admin kan lage lenken manuelt
      // etterpå via "Lag betalingslenke", som da viser feilen i klartekst.
      console.error("[bookings] Kunne ikke opprette betalingslenke ved bekreftelse:", err);
    }

    // Uten lenke (Stripe feilet/ikke satt opp) sendes ingenting – admin lager
    // lenken manuelt og bruker «Send e-post til gjest» etterpå.
    if (updated.secureCardUrl) {
      try {
        updated = await sendApprovalEmail(updated);
      } catch (err) {
        console.error("[bookings] Kunne ikke sende godkjennings-e-post til gjesten:", err);
      }
    }
  }

  if (status === "declined" && updated.mainCharge.status === "paid") {
    // Det som allerede er refundert (manuelt eller ved en tidligere avbestilling)
    // trekkes fra, så en booking aldri refunderes mer enn vilkårene sier.
    const entitled =
      refundMode === "policy"
        ? policyRefundAmount(updated.pricing.total, updated.checkIn, today())
        : updated.pricing.total;
    const amount = Math.min(
      refundableAmount(updated, "main"),
      Math.max(0, Math.round((entitled - (updated.mainCharge.refundedAmount ?? 0)) * 100) / 100),
    );
    try {
      if (amount > 0) {
        const reason = refundMode === "policy" ? "Avbestilling – etter leievilkårene" : "Avbestilling – full refusjon";
        const result = await applyRefund(updated, "main", null, amount, reason);
        if (result.ok) updated = result.booking;
        else console.error("[bookings] Refusjon feilet:", result.error);
      } else if (updated.mainCharge.refundedAmount === null) {
        // Ingenting å refundere etter vilkårene – lagres som 0 så admin viser at det er vurdert.
        const mainCharge = { ...updated.mainCharge, refundedAmount: 0 };
        await store.updateBooking(id, { mainCharge });
        updated = { ...updated, mainCharge };
      }
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
  prices: Prices;
  /** Datoperioder gjesten ikke kan velge (bekreftede bookinger + Google-kalender). */
  blocked: { start: string; end: string }[];
  /** Ubehandlede forespørsler – vises svakere, men blokkerer ikke valget. */
  tentative: { start: string; end: string }[];
};

export async function getAvailability(): Promise<Availability> {
  const bookings = await loadAllBookings();
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const pending = bookings.filter((b) => b.status === "pending");
  const [blockedRanges, prices] = await Promise.all([getStore().listBlockedRanges(), getPrices()]);

  let googleBusy: { start: string; end: string }[] = [];
  try {
    googleBusy = await calendar.getBusyRanges({ start: SEASON_START, end: SEASON_END });
  } catch (err) {
    console.error("[bookings] Kunne ikke hente Google Calendar-tilgjengelighet:", err);
  }

  return {
    season: { start: SEASON_START, end: SEASON_END },
    minNights: MIN_NIGHTS,
    prices,
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
  let updated: Booking = { ...booking, ...patch };

  if (chargeAt <= today()) {
    updated = (await retryMainCharge(updated.id)) ?? updated;
  }

  await sendConfirmationEmail(updated);
}

/**
 * E-post 2: kort sikret og booking bekreftet. Sendes bare én gang (Stripe kan
 * levere samme webhook flere ganger), og ikke hvis en umiddelbar belastning
 * feilet – da varsles eieren i stedet, og gjesten hører fra eieren.
 */
async function sendConfirmationEmail(booking: Booking): Promise<void> {
  if (booking.guestEmails.confirmationSentAt) return;
  if (booking.mainCharge.status !== "card_saved" && booking.mainCharge.status !== "paid") return;
  try {
    booking = await ensureGuestToken(booking);
    const sent = await notifyGuestOfConfirmation(booking);
    if (!sent) return;
    const guestEmails = { ...booking.guestEmails, confirmationSentAt: new Date().toISOString() };
    await getStore().updateBooking(booking.id, { guestEmails });
  } catch (err) {
    console.error("[bookings] Kunne ikke sende bekreftelses-e-post til gjesten:", err);
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

/**
 * Reserverer, trekker eller frigir depositumet. Frigis et depositum som aldri
 * ble reservert, merkes det bare som frigitt (ingenting å kansellere i
 * Stripe) – da reserverer heller ikke cron-jobben det senere.
 */
export async function manageDeposit(
  bookingId: string,
  action: "hold" | "capture" | "release",
  amount?: number,
  reason?: string,
): Promise<Booking | null> {
  const booking = await loadBooking(bookingId);
  if (!booking) return null;
  if (!isStripeConfigured()) return booking;

  const store = getStore();
  const nothingToRelease = action === "release" && !booking.deposit.paymentIntentId;
  const result = nothingToRelease
    ? { ok: true as const, paymentIntentId: null }
    : action === "hold"
      ? await payments.holdDeposit(booking)
      : action === "capture"
        ? await payments.captureDeposit(booking, amount, reason)
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
      ...(action === "capture"
        ? { capturedAmount: amount ?? booking.deposit.amount, captureReason: reason ?? null }
        : {}),
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
 * Refunderer i Stripe og fører refusjonen i bookingens logg. Felles for
 * avbestilling (setStatus) og manuell refusjon (refundCharge). Refusjonens id
 * brukes som idempotency-nøkkel, så Stripe aldri utfører samme refusjon to ganger.
 */
async function applyRefund(
  booking: Booking,
  target: RefundTarget,
  extraChargeId: string | null,
  amount: number,
  reason: string,
): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  const id = randomUUID();
  const result = await payments.refundPayment(
    paymentIntentFor(booking, target, extraChargeId),
    amount,
    { bookingId: booking.id, target, reason },
    id,
  );
  if (!result.ok) return result;

  const entry: Refund = {
    id,
    target,
    extraChargeId,
    amount,
    reason,
    createdAt: new Date().toISOString(),
    stripeRefundId: result.paymentIntentId,
  };
  const patch: Partial<Booking> = { refunds: [...booking.refunds, entry] };
  if (target === "main") {
    patch.mainCharge = {
      ...booking.mainCharge,
      refundedAmount: Math.round(((booking.mainCharge.refundedAmount ?? 0) + amount) * 100) / 100,
    };
  }
  await getStore().updateBooking(booking.id, patch);
  return { ok: true, booking: { ...booking, ...patch } };
}

/**
 * Tilbakefører hele eller deler av en vellykket belastning – f.eks. et
 * tilleggsbeløp trukket ved en feil. Kaster BookingValidationError hvis
 * beløpet er større enn det som gjenstår, eller Stripe avviser refusjonen.
 */
export async function refundCharge(
  bookingId: string,
  target: RefundTarget,
  extraChargeId: string | null,
  amount: number,
  reason: string,
): Promise<Booking | null> {
  const booking = await loadBooking(bookingId);
  if (!booking) return null;
  if (!isStripeConfigured()) throw new BookingValidationError("Stripe er ikke koblet til.");

  const remaining = refundableAmount(booking, target, extraChargeId);
  if (remaining <= 0) throw new BookingValidationError("Det er ingenting igjen å refundere på denne belastningen.");
  if (amount > remaining) {
    throw new BookingValidationError(`Kan refundere maks ${formatEur(remaining)} – resten er allerede tilbakeført.`);
  }

  const result = await applyRefund(booking, target, extraChargeId, amount, reason);
  if (!result.ok) throw new BookingValidationError(`Refusjonen feilet: ${result.error}`);
  return result.booking;
}

/**
 * Kjøres daglig av cron-jobben: belaster hovedbeløp som har forfalt, og
 * reserverer depositum for bookinger som er DEPOSIT_RESERVE_DAYS_BEFORE_CHECKOUT
 * dager fra utsjekk.
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
    const due =
      booking.mainCharge.status === "paid" &&
      booking.deposit.status === "none" &&
      addDays(booking.checkOut, -DEPOSIT_RESERVE_DAYS_BEFORE_CHECKOUT) <= now;
    if (due) {
      await manageDeposit(booking.id, "hold");
      deposits.push(booking.id);
    }
  }

  return { charged, deposits };
}

/**
 * Personvern: fjerner navn, e-post, telefon og melding fra bookinger når
 * oppbevaringstiden etter utsjekk er ute (se RETENTION_MONTHS_* i
 * lib/config.ts og /personvern). Datoer og beløp beholdes for regnskap og
 * statistikk. Kjøres daglig sammen med belastningene.
 */
export async function anonymizeExpiredBookings(): Promise<string[]> {
  const bookings = await loadAllBookings();
  const now = today();
  const anonymized: string[] = [];
  for (const b of bookings) {
    if (b.anonymizedAt) continue;
    const months = b.status === "confirmed" ? RETENTION_MONTHS_CONFIRMED : RETENTION_MONTHS_OTHER;
    if (addMonths(b.checkOut, months) > now) continue;
    await getStore().updateBooking(b.id, {
      name: "Anonymisert gjest",
      email: "",
      phone: "",
      message: "",
      secureCardUrl: null,
      guestToken: null,
      cancellationRequest: null,
      anonymizedAt: new Date().toISOString(),
    });
    anonymized.push(b.id);
  }
  return anonymized;
}

// --- Airbnb-kalendersynk ------------------------------------------------

/**
 * Kjøres av cron-jobben (se app/api/cron/calendar-sync): henter Airbnb sin
 * iCal-eksport (URL-en eieren har limt inn i «Min konto») og speiler
 * reservasjonene som blokkeringer med source "airbnb", slik at de telles med
 * i getAvailability() akkurat som manuelle blokkeringer. No-op hvis eieren
 * ikke har satt opp en Airbnb-URL ennå, eller har satt synken på pause
 * (airbnbSyncEnabled) i «Min konto».
 *
 * Full erstatning ved hver kjøring (slett alle gamle "airbnb"-blokkeringer,
 * opprett nye fra feeden) i stedet for diffing – trygt på dette volumet og
 * unngår at fjernede Airbnb-reservasjoner blir hengende igjen som blokkert.
 */
export async function syncAirbnbCalendar(): Promise<{ imported: number }> {
  const account = await getAccount();
  if (!account.airbnbIcalUrl || !account.airbnbSyncEnabled) return { imported: 0 };

  const res = await fetch(account.airbnbIcalUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Airbnb iCal svarte ${res.status}`);
  const ranges = parseIcsBusyRanges(await res.text());

  const store = getStore();
  const existingBlocks = await store.listBlockedRanges();
  for (const block of existingBlocks) {
    if (block.source === "airbnb") await store.deleteBlockedRange(block.id);
  }

  for (const range of ranges) {
    await store.createBlockedRange({
      id: randomUUID(),
      start: range.start,
      end: range.end,
      reason: "Airbnb",
      source: "airbnb",
      createdAt: new Date().toISOString(),
    });
  }

  const confirmed = (await loadAllBookings()).filter((b) => b.status === "confirmed");
  const conflicts = ranges.filter((r) =>
    confirmed.some((b) => rangesOverlap({ start: b.checkIn, end: b.checkOut }, r)),
  );
  if (conflicts.length > 0) {
    try {
      await notifyOwnerOfDoubleBooking(conflicts.map((c) => `${c.start} → ${c.end}`).join("\n"));
    } catch (err) {
      console.error("[bookings] Kunne ikke varsle om mulig dobbeltbooking:", err);
    }
  }

  await recordAirbnbSync();
  return { imported: ranges.length };
}
