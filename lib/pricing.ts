import {
  BEDDING_PRICE,
  CLEANING_FEE,
  CURRENCY,
  DEPOSIT_AMOUNT,
  EV_CHARGER_PRICE,
  NIGHTLY_RATE,
  PET_PRICE,
} from "@/lib/config";
import { nightsBetween } from "@/lib/dates";

/** Alle priser eieren kan endre i /admin/priser (lagret via lib/prices.ts). */
export type Prices = {
  nightlyRate: number;
  cleaningFee: number;
  deposit: number;
  evCharger: number;
  pet: number;
  bedding: number;
};

/** Brukes til eieren har lagret egne priser i admin – og for felt som mangler i lagrede data. */
export const DEFAULT_PRICES: Prices = {
  nightlyRate: NIGHTLY_RATE,
  cleaningFee: CLEANING_FEE,
  deposit: DEPOSIT_AMOUNT,
  evCharger: EV_CHARGER_PRICE,
  pet: PET_PRICE,
  bedding: BEDDING_PRICE,
};

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
 * aldri på tall fra klienten, den regner alltid på nytt med denne funksjonen
 * og prisene den selv har hentet fra lageret.
 */
export function quote(
  prices: Prices,
  checkIn: string,
  checkOut: string,
  extras: BookingExtras = DEFAULT_EXTRAS,
): Quote {
  const nights = Math.max(0, nightsBetween(checkIn, checkOut));
  const nightsTotal = nights * prices.nightlyRate;

  const evChargerTotal = extras.evChargers * prices.evCharger;
  const petTotal = extras.pets * prices.pet;
  const beddingTotal = extras.bedding * prices.bedding;
  const extrasTotal = evChargerTotal + petTotal + beddingTotal;

  return {
    nights,
    nightlyRate: prices.nightlyRate,
    nightsTotal,
    cleaningFee: prices.cleaningFee,
    extras,
    evChargerTotal,
    petTotal,
    beddingTotal,
    extrasTotal,
    total: nightsTotal + prices.cleaningFee + extrasTotal,
    currency: CURRENCY,
  };
}

/** "1 000,00 €" – norsk tallformat med euro-symbol. */
export function formatEur(amount: number): string {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "EUR" }).format(amount);
}
