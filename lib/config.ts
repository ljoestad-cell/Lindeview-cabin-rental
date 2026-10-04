/**
 * Faste forretningsregler for bookingløsningen.
 * Endres her – ett sted – hvis pris, sesong eller minimumsopphold justeres.
 *
 * Fakta om selve eiendommen (navn, sted, eier, kapasitet) ligger i
 * lib/property.ts, ikke her – se den filen ved gjenbruk for en annen hytte.
 */
import { formatSeasonLabel } from "@/lib/dates";
import { GUEST_CAPACITY, PROPERTY_NAME } from "@/lib/property";

export const NIGHTLY_RATE = 320;
export const CLEANING_FEE = 250;
export const MIN_NIGHTS = 7;
export const MAX_GUESTS = GUEST_CAPACITY;
export const CURRENCY = "EUR";

/** Depositum reserveres på kortet like før utsjekk, ikke ved innsjekk – se lib/payments.ts. */
export const DEPOSIT_AMOUNT = 1000;
/**
 * Depositum reserveres automatisk dette antall dager før utsjekk. Et korthold
 * varer bare ca. 7 dager hos de fleste banker, så reservasjon + DEPOSIT_HOLD_DAYS
 * må holde seg innenfor det.
 */
export const DEPOSIT_RESERVE_DAYS_BEFORE_CHECKOUT = 1;
/** Depositum frigis normalt innen dette antall dager etter utsjekk (etter inspeksjon). */
export const DEPOSIT_HOLD_DAYS = 5;
/** Maks lengde på begrunnelsen eieren skriver når depositum trekkes. */
export const DEPOSIT_CAPTURE_REASON_MAX = 200;
/**
 * Hovedbeløpet belastes automatisk dette antall dager før innsjekk – første
 * dag etter at fristen for gratis avbestilling (FULL_REFUND_DAYS) er ute, så
 * vi aldri trekker et beløp gjesten fortsatt kan få refundert.
 */
export const CHARGE_DAYS_BEFORE_CHECKIN = 29;

/** Kalenderen er åpen fra og med denne datoen (innsjekk). */
export const SEASON_START = "2027-05-01";
/** Siste natt gjestene kan bo er 2027-09-30, så seneste utsjekk er 1. oktober. */
export const SEASON_END = "2027-10-01";

/** «1. mai – 30. september 2027» – avledet fra datoene over, så teksten aldri kommer ut av synk. */
export const SEASON_LABEL = formatSeasonLabel(SEASON_START, SEASON_END);

/** Vises tydelig på bookingsiden – ingen unntak håndheves foreløpig i koden, bare kommunikasjon. */
export const FAMILY_ONLY_NOTICE = `VIKTIG! ${PROPERTY_NAME} leies kun ut til familier — ikke til voksne grupper, firmaer eller arrangementer.`;

/** Tillegg som påvirker prisen – fast pris pr. booking, ikke pr. natt. */
export const EV_CHARGER_PRICE = 60;
export const EV_CHARGER_MAX = 4;

export const PET_PRICE = 60;
export const PET_MAX = 4;

export const BEDDING_PRICE = 25;
export const BEDDING_MAX = 10;

/**
 * Avbestilling fra gjesten (se lib/cancellation.ts og /vilkar):
 * - minst FULL_REFUND_DAYS dager før innsjekk: alt refunderes (normalt er ingenting trukket ennå)
 * - senere: ingen refusjon
 * Hovedbeløpet trekkes dagen etter at fristen er ute (CHARGE_DAYS_BEFORE_CHECKIN)
 * – avbestilling før trekket koster altså ingenting, etter trekket refunderes ingenting.
 */
export const FULL_REFUND_DAYS = CHARGE_DAYS_BEFORE_CHECKIN + 1;

/** Øk (ny dato) når leievilkårene på /vilkar endres – lagres på hver booking som «godtatt versjon». */
export const TERMS_VERSION = "2026-10-03";

/**
 * Personopplysninger (navn, e-post, telefon, melding) anonymiseres automatisk
 * så mange måneder etter utsjekk. Bekreftede bookinger beholdes i fem år
 * (bokføringslovens oppbevaringstid for regnskapsmateriale), forespørsler som
 * aldri ble noe av slettes raskere.
 */
export const RETENTION_MONTHS_CONFIRMED = 60;
export const RETENTION_MONTHS_OTHER = 6;
