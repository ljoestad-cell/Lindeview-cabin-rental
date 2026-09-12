/**
 * Faste forretningsregler for bookingløsningen.
 * Endres her – ett sted – hvis pris, sesong eller minimumsopphold justeres.
 */

export const NIGHTLY_RATE = 320;
export const CLEANING_FEE = 250;
export const MIN_NIGHTS = 7;
export const MAX_GUESTS = 10;
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

/** Eieren mottar e-postvarsel om nye bookingforespørsler og betalingsproblemer på denne adressen. */
export const OWNER_EMAIL = "ljoestad@gmail.com";
