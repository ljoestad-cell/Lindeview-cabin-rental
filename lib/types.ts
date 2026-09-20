import type { BookingExtras, Quote } from "@/lib/pricing";

export type BookingStatus = "pending" | "confirmed" | "declined";

export type MainChargeStatus = "not_saved" | "card_saved" | "paid" | "failed";

export type MainCharge = {
  status: MainChargeStatus;
  /** "YYYY-MM-DD" – checkIn minus CHARGE_DAYS_BEFORE_CHECKIN, eller i dag ved sen bestilling. */
  chargeAt: string | null;
  paymentIntentId: string | null;
  paidAt: string | null;
  lastError: string | null;
};

export type DepositStatus = "none" | "held" | "captured" | "released" | "failed";

export type Deposit = {
  status: DepositStatus;
  paymentIntentId: string | null;
  heldAt: string | null;
  resolvedAt: string | null;
  /** Satt hvis bare deler av depositumet ble trukket. */
  capturedAmount: number | null;
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

export const DEFAULT_MAIN_CHARGE: MainCharge = {
  status: "not_saved",
  chargeAt: null,
  paymentIntentId: null,
  paidAt: null,
  lastError: null,
};

export const DEFAULT_DEPOSIT: Deposit = {
  status: "none",
  paymentIntentId: null,
  heldAt: null,
  resolvedAt: null,
  capturedAmount: null,
  lastError: null,
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
  /** Engangslenke gjesten bruker for å sikre kortet sitt (Stripe Checkout, mode "setup"). */
  secureCardUrl: string | null;

  mainCharge: MainCharge;
  deposit: Deposit;
  extraCharges: ExtraCharge[];
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

/** Eierens admin-konto. Én konto – ingen flerbrukerstøtte. */
export type AdminAccount = {
  name: string;
  email: string;
  /** "saltHex:hashHex" (scrypt) – se lib/auth.ts. Tomt inntil eieren har satt et eget passord. */
  passwordHash: string;
  /** Reservert for fremtidig topartsverifisering – ikke i bruk ennå. */
  mfaEnabled: boolean;
  mfaSecret: string | null;
  /** Ugjettbar del av URL-en Airbnb bruker til å importere Lindeviews kalender (se app/api/ical/[token]). Stabil – regenereres aldri automatisk. */
  icalExportToken: string;
  /** Airbnb sin iCal-eksport-URL, limt inn av eieren i «Min konto» – brukes til å importere Airbnb-reservasjoner som blokkeringer. */
  airbnbIcalUrl: string | null;
  /** Tidspunkt for siste vellykkede synk mot airbnbIcalUrl, vist i admin-UI som en enkel helsesjekk. */
  airbnbIcalSyncedAt: string | null;
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
};
