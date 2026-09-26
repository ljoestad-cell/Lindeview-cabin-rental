/**
 * Faste forretningsregler for bookingløsningen.
 * Endres her – ett sted – hvis pris, sesong eller minimumsopphold justeres.
 *
 * Fakta om selve eiendommen (navn, sted, eier, kapasitet) ligger i
 * lib/property.ts, ikke her – se den filen ved gjenbruk for en annen hytte.
 */
import { GUEST_CAPACITY, PROPERTY_NAME } from "@/lib/property";

export const NIGHTLY_RATE = 320;
export const CLEANING_FEE = 250;
export const MIN_NIGHTS = 7;
export const MAX_GUESTS = GUEST_CAPACITY;
export const CURRENCY = "EUR";

/** Depositum reserveres på kortet ved utsjekk, ikke ved innsjekk – se lib/payments.ts. */
export const DEPOSIT_AMOUNT = 1000;
/** Hvor mange dager eieren normalt trenger til inspeksjon før depositum trekkes/frigis. */
export const DEPOSIT_HOLD_DAYS = 5;
/** Hovedbeløpet belastes automatisk dette antall dager før innsjekk. */
export const CHARGE_DAYS_BEFORE_CHECKIN = 30;

/** Kalenderen er åpen fra og med denne datoen (innsjekk). */
export const SEASON_START = "2027-05-01";
/** Siste natt gjestene kan bo er 2027-09-30, så seneste utsjekk er 1. oktober. */
export const SEASON_END = "2027-10-01";

export const SEASON_LABEL = "1. mai – 30. september 2027";

/** Vises tydelig på bookingsiden – ingen unntak håndheves foreløpig i koden, bare kommunikasjon. */
export const FAMILY_ONLY_NOTICE = `VIKTIG! ${PROPERTY_NAME} leies kun ut til familier — ikke til voksne grupper, firmaer eller arrangementer.`;

/** Tillegg som påvirker prisen – fast pris pr. booking, ikke pr. natt. */
export const EV_CHARGER_PRICE = 60;
export const EV_CHARGER_MAX = 4;

export const PET_PRICE = 60;
export const PET_MAX = 4;

export const BEDDING_PRICE = 25;
export const BEDDING_MAX = 10;
