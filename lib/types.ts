import type { BookingExtras, Quote } from "@/lib/pricing";

export type BookingStatus = "pending" | "confirmed" | "declined";

export type MainChargeStatus = "not_saved" | "card_saved" | "paid" | "failed";

/**
 * Resten av leien – det som ikke ble betalt som forskudd. Trekkes automatisk
 * fra det lagrede kortet `chargeAt`. Statusen følger også kortet: "not_saved"
 * betyr at gjesten ikke har betalt forskuddet/sikret kort ennå.
 */
export type MainCharge = {
  status: MainChargeStatus;
  /** Beløpet som trekkes. null på bookinger fra før forskudd fantes – da trekkes hele pricing.total. */
  amount: number | null;
  /** "YYYY-MM-DD" – checkIn minus CHARGE_DAYS_BEFORE_CHECKIN, eller i dag ved sen bestilling. */
  chargeAt: string | null;
  paymentIntentId: string | null;
  paidAt: string | null;
  lastError: string | null;
  /**
   * Sum refundert av leien – forskudd og rest til sammen (avbestilling +
   * manuelle refusjoner). null hvis ingenting er refundert eller vurdert.
   */
  refundedAmount: number | null;
};

export type PrepaymentStatus = "none" | "paid";

/**
 * Forskuddet (PREPAYMENT_SHARE av leien, eller alt ved sen bestilling) som
 * gjesten betaler med 3D Secure når kortet sikres. Kortet lagres samtidig for
 * resten, depositum og tilleggsbeløp.
 */
export type Prepayment = {
  status: PrepaymentStatus;
  /** Betalt beløp – 0 til det er betalt. */
  amount: number;
  paymentIntentId: string | null;
  paidAt: string | null;
};

export type DepositStatus = "none" | "held" | "captured" | "released" | "failed";

export type Deposit = {
  status: DepositStatus;
  /** Beløpet som reserveres – låst da gjesten sendte forespørselen, så senere prisendringer i admin ikke påvirker den. */
  amount: number;
  paymentIntentId: string | null;
  heldAt: string | null;
  resolvedAt: string | null;
  /** Satt hvis bare deler av depositumet ble trukket. */
  capturedAmount: number | null;
  /** Eierens begrunnelse for trekket (maks DEPOSIT_CAPTURE_REASON_MAX tegn) – lagres også som metadata i Stripe. */
  captureReason: string | null;
  lastError: string | null;
};

export type ExtraCharge = {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
  status: "succeeded" | "failed";
  paymentIntentId: string | null;
};

/** Hvilken belastning en refusjon gjelder. */
export type RefundTarget = "prepayment" | "main" | "deposit" | "extra";

/** Et beløp som er tilbakeført til gjesten – ved avbestilling eller manuelt fra admin. */
export type Refund = {
  id: string;
  target: RefundTarget;
  /** ExtraCharge.id når target er "extra", ellers null. */
  extraChargeId: string | null;
  amount: number;
  /** Eierens begrunnelse (maks REFUND_REASON_MAX tegn) – lagres også som metadata i Stripe. */
  reason: string;
  createdAt: string;
  stripeRefundId: string | null;
};

export const DEFAULT_MAIN_CHARGE: MainCharge = {
  status: "not_saved",
  amount: null,
  chargeAt: null,
  paymentIntentId: null,
  paidAt: null,
  lastError: null,
  refundedAmount: null,
};

export const DEFAULT_PREPAYMENT: Prepayment = {
  status: "none",
  amount: 0,
  paymentIntentId: null,
  paidAt: null,
};

/** Uten `amount` – det settes fra gjeldende pris når bookingen opprettes. */
export const DEFAULT_DEPOSIT: Omit<Deposit, "amount"> = {
  status: "none",
  paymentIntentId: null,
  heldAt: null,
  resolvedAt: null,
  capturedAmount: null,
  captureReason: null,
  lastError: null,
};

/** Når e-postene til gjesten ble sendt – vises i admin, og hindrer at bekreftelsen sendes to ganger. */
export type GuestEmails = {
  /** Godkjent + betalingslenke (siste gang den ble sendt). */
  approvalSentAt: string | null;
  /** Kort sikret, booking bekreftet – sendes bare én gang. */
  confirmationSentAt: string | null;
  /** Automatisk trekk av resten feilet – gjesten ble bedt om å betale selv (siste gang). */
  paymentFailedSentAt: string | null;
  /** Forespørsel avslått eller bekreftet booking avbestilt – sendes bare én gang, og bare hvis eieren lot avkrysningen stå. */
  cancellationSentAt: string | null;
};

export const DEFAULT_GUEST_EMAILS: GuestEmails = {
  approvalSentAt: null,
  confirmationSentAt: null,
  paymentFailedSentAt: null,
  cancellationSentAt: null,
};

/** Gjesten har bedt om avbestilling via «Min booking» – eieren avbestiller selv i admin. */
export type CancellationRequest = {
  requestedAt: string;
  /** Valgfri melding fra gjesten (maks CANCELLATION_MESSAGE_MAX tegn). */
  message: string;
};

export type Booking = {
  id: string;
  createdAt: string; // ISO timestamp
  status: BookingStatus;
  checkIn: string; // "YYYY-MM-DD"
  checkOut: string; // "YYYY-MM-DD"
  nights: number;
  guests: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  extras: BookingExtras;
  pricing: Quote;
  /** Id på hendelsen i Google Calendar, når kalenderkobling er satt opp. */
  calendarEventId: string | null;

  stripeCustomerId: string | null;
  /** Kortet gjesten sikret via Checkout – brukes til alle senere off-session-belastninger. */
  defaultPaymentMethodId: string | null;
  /** Engangslenke gjesten bruker for å betale forskudd og sikre kortet (Stripe Checkout). */
  secureCardUrl: string | null;

  prepayment: Prepayment;
  mainCharge: MainCharge;
  deposit: Deposit;
  extraCharges: ExtraCharge[];
  /** Alle tilbakeføringer, eldste først. Se lib/refunds.ts for hvor mye som gjenstår å refundere. */
  refunds: Refund[];
  guestEmails: GuestEmails;
  /** Ugjettbar nøkkel i gjestens «Min booking»-lenke (/booking/<token>). null på eldre bookinger til den lages, og etter anonymisering. */
  guestToken: string | null;
  cancellationRequest: CancellationRequest | null;
  /** Hvem som avsluttet en avslått booking – "guest" vises som «Avbestilt», "owner" som «Avslått». null på eldre data (se lib/status.ts). */
  cancelledBy: "guest" | "owner" | null;
  /** Eierens begrunnelse når eieren selv avslår eller avbestiller (maks DECLINE_REASON_MAX tegn) – vises også for gjesten. */
  declineReason: string | null;

  /** TERMS_VERSION gjesten krysset av for på /book – null på bookinger fra før vilkårene fantes. */
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  /** Satt når personopplysningene er fjernet etter oppbevaringstiden (se anonymizeExpiredBookings). */
  anonymizedAt: string | null;
};

/** En periode som ikke kan bookes – manuelt blokkert av eieren, eller importert fra en ekstern kalender. */
export type BlockedRange = {
  id: string;
  start: string; // "YYYY-MM-DD", inkludert
  end: string; // "YYYY-MM-DD", ekskludert
  reason: string;
  createdAt: string;
  /** "manual" (satt av eieren i /admin) eller "airbnb" (hentet fra Airbnb sin iCal-eksport, se lib/ical.ts). Udefinert på eldre data = "manual". */
  source?: "manual" | "airbnb";
};

/** En mottaker av varsel om nye bookingforespørsler – kan skrus av uten å fjernes. */
export type NotifyRecipient = { email: string; enabled: boolean };

/** Eierens admin-konto. Én konto – ingen flerbrukerstøtte. */
export type AdminAccount = {
  name: string;
  email: string;
  /** "saltHex:hashHex" (scrypt) – se lib/auth.ts. Tomt inntil eieren har satt et eget passord. */
  passwordHash: string;
  /** Topartsverifisering (TOTP, se lib/totp.ts) – krever kode fra autentiseringsapp ved innlogging. */
  mfaEnabled: boolean;
  /** Base32-hemmeligheten appen er satt opp med. Forlater aldri serveren etter oppsett. */
  mfaSecret: string | null;
  /** Hemmelighet under oppsett – blir mfaSecret først når eieren har bekreftet med en gyldig kode. */
  mfaPendingSecret: string | null;
  /** SHA-256 av ubrukte reservekoder. En kode fjernes når den brukes. */
  mfaRecoveryCodes: string[];
  /** Siste brukte TOTP-tidssteg – hindrer at samme kode brukes to ganger. */
  mfaLastUsedStep: number | null;
  /** Ugjettbar del av URL-en Airbnb bruker til å importere Lindeviews kalender (se app/api/ical/[token]). Stabil – regenereres aldri automatisk. */
  icalExportToken: string;
  /** Airbnb sin iCal-eksport-URL, limt inn av eieren i «Min konto» – brukes til å importere Airbnb-reservasjoner som blokkeringer. */
  airbnbIcalUrl: string | null;
  /** Av/på-bryter, uavhengig av airbnbIcalUrl – lar eieren pause synken uten å miste den lagrede URL-en. */
  airbnbSyncEnabled: boolean;
  /** Tidspunkt for siste vellykkede synk mot airbnbIcalUrl, vist i admin-UI som en enkel helsesjekk. */
  airbnbIcalSyncedAt: string | null;
  /**
   * Hvem som får e-post om nye bookingforespørsler («Min konto»). null til
   * eieren har endret noe – da gjelder eieren + BOOKING_REQUEST_EXTRA_EMAILS.
   */
  bookingNotifyRecipients: NotifyRecipient[] | null;
  updatedAt: string;
};

/** Felter en gjest sender inn – resten fylles/regnes på serveren. */
export type BookingRequestInput = {
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  extras: BookingExtras;
  /** Må være true – gjesten har krysset av for leievilkårene. */
  acceptedTerms: boolean;
};
