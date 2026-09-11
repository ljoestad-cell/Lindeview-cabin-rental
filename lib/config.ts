/**
 * Faste forretningsregler for bookingløsningen.
 * Endres her – ett sted – hvis pris, sesong eller minimumsopphold justeres.
 */

export const NIGHTLY_RATE = 3200;
export const CLEANING_FEE = 2500;
export const MIN_NIGHTS = 7;
export const MAX_GUESTS = 10;
export const CURRENCY = "NOK";

/** Kalenderen er åpen fra og med denne datoen (innsjekk). */
export const SEASON_START = "2027-05-01";
/** Siste natt gjestene kan bo er 2027-09-30, så seneste utsjekk er 1. oktober. */
export const SEASON_END = "2027-10-01";

export const SEASON_LABEL = "1. mai – 30. september 2027";
