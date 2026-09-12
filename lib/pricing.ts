import { CLEANING_FEE, CURRENCY, NIGHTLY_RATE } from "@/lib/config";
import { nightsBetween } from "@/lib/dates";

export type Quote = {
  nights: number;
  nightlyRate: number;
  nightsTotal: number;
  cleaningFee: number;
  total: number;
  currency: string;
};

/**
 * Regner ut prisen for et opphold. Brukes både av prissammendraget i
 * nettleseren og av server-validering – serveren stoler aldri på tall fra
 * klienten, den regner alltid på nytt med denne funksjonen.
 */
export function quote(checkIn: string, checkOut: string): Quote {
  const nights = Math.max(0, nightsBetween(checkIn, checkOut));
  const nightsTotal = nights * NIGHTLY_RATE;
  return {
    nights,
    nightlyRate: NIGHTLY_RATE,
    nightsTotal,
    cleaningFee: CLEANING_FEE,
    total: nightsTotal + CLEANING_FEE,
    currency: CURRENCY,
  };
}

/** "1 000,00 €" – norsk tallformat med euro-symbol. */
export function formatEur(amount: number): string {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "EUR" }).format(amount);
}
