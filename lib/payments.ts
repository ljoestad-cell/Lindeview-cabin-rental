import type { Booking } from "@/lib/types";

/**
 * Betalingsstillas. Ingen betalingsleverandør er koblet til ennå – dette gir
 * resten av koden (bookingflyt, webhook-rute) et stabilt grensesnitt å bygge
 * mot, slik at en ekte leverandør (Stripe, Vipps o.l.) kan settes inn her
 * uten å røre booking-logikken.
 */

export type CheckoutResult =
  | { status: "not_configured" }
  | { status: "created"; checkoutUrl: string };

export type WebhookResult = { status: "not_configured" } | { status: "ok" };

export interface PaymentProvider {
  /** Oppretter en betalingslenke for en bekreftet booking. */
  createCheckout(booking: Booking): Promise<CheckoutResult>;
  /** Verifiserer og håndterer en innkommende webhook fra leverandøren. */
  verifyWebhook(request: Request): Promise<WebhookResult>;
}

class NullPaymentProvider implements PaymentProvider {
  async createCheckout(): Promise<CheckoutResult> {
    return { status: "not_configured" };
  }

  async verifyWebhook(): Promise<WebhookResult> {
    return { status: "not_configured" };
  }
}

let provider: PaymentProvider = new NullPaymentProvider();

export function getPaymentProvider(): PaymentProvider {
  return provider;
}

/** For når en ekte leverandør kobles inn – kall denne fra oppsettskoden da. */
export function setPaymentProvider(next: PaymentProvider): void {
  provider = next;
}
