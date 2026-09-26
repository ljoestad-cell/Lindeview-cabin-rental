import { DEFAULT_PRICES, type Prices } from "@/lib/pricing";
import { getStore } from "@/lib/store";

/**
 * Gjeldende priser: det eieren har lagret i /admin/priser, med
 * DEFAULT_PRICES (fra lib/config.ts) for alt som ikke er lagret ennå.
 * Kun server – klientkomponenter får prisene som props.
 */
export async function getPrices(): Promise<Prices> {
  const stored = await getStore().getPrices();
  return { ...DEFAULT_PRICES, ...stored };
}

export class PriceValidationError extends Error {}

const PRICE_KEYS = Object.keys(DEFAULT_PRICES) as (keyof Prices)[];

/** Validerer og lagrer alle prisene samlet. Nattpris må være over 0, resten kan være 0 (gratis). */
export async function updatePrices(input: Record<string, unknown>): Promise<Prices> {
  const prices = {} as Prices;
  for (const key of PRICE_KEYS) {
    const value = input[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new PriceValidationError("Alle priser må være tall på 0 eller mer.");
    }
    // Stripe regner i øre/cent – mer enn to desimaler gir ikke mening.
    prices[key] = Math.round(value * 100) / 100;
  }
  if (prices.nightlyRate <= 0) {
    throw new PriceValidationError("Pris per natt må være større enn 0.");
  }
  return getStore().setPrices(prices);
}
