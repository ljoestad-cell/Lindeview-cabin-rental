import { OWNER_EMAIL } from "@/lib/config";
import type { Booking } from "@/lib/types";

/**
 * Sender et kort varsel til eieren når en ny bookingforespørsel kommer inn –
 * bare navn, datoer og en henvisning til /admin, ikke alle detaljene (de
 * finnes uansett i admin-panelet). Bruker Resend sitt REST-API (ingen
 * SDK-avhengighet nødvendig).
 *
 * Uten RESEND_API_KEY gjør funksjonen ingenting (logger og returnerer) –
 * bookingen lagres og vises i /admin uansett, akkurat som med kalender og
 * betaling. Koble til senere ved å opprette en konto på resend.com (helst
 * med ljoestad@gmail.com, se README) og sette miljøvariabelen.
 */

const RESEND_API = "https://api.resend.com/emails";

let warnedOnce = false;
function warnNotConfigured() {
  if (warnedOnce) return;
  warnedOnce = true;
  console.info(
    "[notifications] RESEND_API_KEY mangler – sender ikke e-postvarsel om nye bookingforespørsler. Se README for oppsett.",
  );
}

function buildEmailBody(booking: Booking): string {
  return [
    `Du har fått en ny bookingforespørsel på Lindeview.`,
    `${booking.name}, ${booking.checkIn} – ${booking.checkOut} (${booking.nights} netter).`,
    ``,
    `Logg inn på /admin for å se detaljene og svare.`,
  ].join("\n");
}

/** Best-effort – kaster videre ved feil, kalleren fanger og logger. */
export async function notifyOwnerOfBooking(booking: Booking): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    warnNotConfigured();
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "Lindeview <onboarding@resend.dev>";

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: OWNER_EMAIL,
      reply_to: booking.email,
      subject: `Ny bookingforespørsel: ${booking.checkIn} – ${booking.checkOut}`,
      text: buildEmailBody(booking),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend svarte ${res.status}: ${body}`);
  }
}
