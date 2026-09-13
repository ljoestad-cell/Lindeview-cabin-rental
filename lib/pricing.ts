import { BEDDING_PRICE, CLEANING_FEE, CURRENCY, EV_CHARGER_PRICE, NIGHTLY_RATE, PET_PRICE } from "@/lib/config";
import { nightsBetween } from "@/lib/dates";

/** Tillegg gjesten velger ved booking – antall pr. type, fast pris pr. booking (ikke pr. natt). */
export type BookingExtras = {
  evChargers: number;
  pets: number;
  bedding: number;
};

export const DEFAULT_EXTRAS: BookingExtras = { evChargers: 0, pets: 0, bedding: 0 };

export type Quote = {
  nights: number;
  nightlyRate: number;
  nightsTotal: number;
  cleaningFee: number;
  extras: BookingExtras;
  evChargerTotal: number;
  petTotal: number;
  beddingTotal: number;
  extrasTotal: number;
  total: number;
  currency: string;
};

/**
 * Regner ut prisen for et opphold, inkludert valgte tillegg. Brukes både av
 * prissammendraget i nettleseren og av server-validering – serveren stoler
 * aldri på tall fra klienten, den regner alltid på nytt med denne funksjonen.
 */
export function quote(checkIn: string, checkOut: string, extras: BookingExtras = DEFAULT_EXTRAS): Quote {
  const nights = Math.max(0, nightsBetween(checkIn, checkOut));
  const nightsTotal = nights * NIGHTLY_RATE;

  const evChargerTotal = extras.evChargers * EV_CHARGER_PRICE;
  const petTotal = extras.pets * PET_PRICE;
  const beddingTotal = extras.bedding * BEDDING_PRICE;
  const extrasTotal = evChargerTotal + petTotal + beddingTotal;

  return {
    nights,
    nightlyRate: NIGHTLY_RATE,
    nightsTotal,
    cleaningFee: CLEANING_FEE,
    extras,
    evChargerTotal,
    petTotal,
    beddingTotal,
    extrasTotal,
    total: nightsTotal + CLEANING_FEE + extrasTotal,
    currency: CURRENCY,
  };
}

/** "1 000,00 €" – norsk tallformat med euro-symbol. */
export function formatEur(amount: number): string {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "EUR" }).format(amount);
}
